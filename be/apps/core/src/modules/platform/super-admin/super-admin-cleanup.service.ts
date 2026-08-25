import {
  authSessions,
  authUsers,
  creemSubscriptions,
  generateId,
  managedStorageFileReferences,
  photoAssets,
  platformActivityEvents,
  tenantCleanupBatches,
  tenantCleanupItems,
  tenantDomains,
  tenantMemberships,
  tenants,
} from '@afilmory/db'
import { DbAccessor } from '@core/database/database.provider'
import { BizException, ErrorCode } from '@core/errors'
import { DataManagementService } from '@core/modules/platform/data-management/data-management.service'
import { and, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm'
import { injectable } from 'tsyringe'

import { SuperAdminAuditService } from './super-admin-audit.service'

export interface TenantCleanupCandidate {
  id: string
  slug: string
  name: string
  createdAt: string
  lastActivityAt: string
  ownerName: string | null
  ownerEmail: string | null
}

export function buildTenantCleanupConfirmation(count: number): string {
  return `DELETE ${count} EMPTY TENANTS`
}

export function calculateInactiveCutoff(reference: Date, inactiveMonths: number): Date {
  const cutoff = new Date(reference)
  const originalDay = cutoff.getUTCDate()
  cutoff.setUTCDate(1)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - inactiveMonths)
  const lastDayOfTargetMonth = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate()
  cutoff.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth))
  return cutoff
}

@injectable()
export class SuperAdminCleanupService {
  constructor(
    private readonly dbAccessor: DbAccessor,
    private readonly dataManagement: DataManagementService,
    private readonly audit: SuperAdminAuditService,
  ) {}

  async listCandidates(inactiveMonths: number, restrictTenantIds?: string[]) {
    const cutoff = calculateInactiveCutoff(new Date(), inactiveMonths)
    const cutoffIso = cutoff.toISOString()
    const db = this.dbAccessor.get()

    const lastActivity = sql<string>`greatest(
      ${tenants.createdAt},
      ${tenants.updatedAt},
      coalesce(
        (select max(a.occurred_at) from ${platformActivityEvents} a where a.tenant_id = ${tenants.id}),
        ${tenants.createdAt}
      ),
      coalesce(
        (select max(s.updated_at) from ${authSessions} s where s.active_tenant_id = ${tenants.id}),
        ${tenants.createdAt}
      ),
      coalesce(
        (select max(m.updated_at) from ${tenantMemberships} m where m.tenant_id = ${tenants.id}),
        ${tenants.createdAt}
      )
    )`

    const restrictions
      = restrictTenantIds && restrictTenantIds.length > 0 ? inArray(tenants.id, restrictTenantIds) : undefined
    const candidates = await db
      .select({
        id: tenants.id,
        slug: tenants.slug,
        name: tenants.name,
        createdAt: tenants.createdAt,
        lastActivityAt: lastActivity,
        ownerName: sql<string | null>`(
          select u.name from ${tenantMemberships} m
          join ${authUsers} u on u.id = m.user_id
          where m.tenant_id = ${tenants.id} and m.role = 'owner' and m.status = 'active'
          limit 1
        )`,
        ownerEmail: sql<string | null>`(
          select u.email from ${tenantMemberships} m
          join ${authUsers} u on u.id = m.user_id
          where m.tenant_id = ${tenants.id} and m.role = 'owner' and m.status = 'active'
          limit 1
        )`,
      })
      .from(tenants)
      .where(
        and(
          inArray(tenants.status, ['active', 'inactive']),
          eq(tenants.banned, false),
          eq(tenants.planId, 'free'),
          isNull(tenants.storagePlanId),
          lt(tenants.createdAt, cutoffIso),
          sql`${lastActivity} < ${cutoffIso}`,
          sql`not exists(select 1 from ${photoAssets} p where p.tenant_id = ${tenants.id})`,
          sql`not exists(
            select 1 from ${managedStorageFileReferences} f where f.tenant_id = ${tenants.id}
          )`,
          sql`not exists(select 1 from ${tenantDomains} d where d.tenant_id = ${tenants.id} and d.status = 'verified')`,
          sql`not exists(
            select 1 from ${creemSubscriptions} cs
            where cs.tenant_id = ${tenants.id}
              and (cs.status in ('active', 'trialing', 'pending') or cs.period_end > now())
          )`,
          sql`not exists(
            select 1 from ${tenantMemberships} m
            join ${authSessions} s on s.user_id = m.user_id
            where m.tenant_id = ${tenants.id}
              and m.status = 'active'
              and s.updated_at >= ${cutoffIso}
          )`,
          sql`${tenants.slug} <> 'root'`,
          restrictions,
        ),
      )
      .orderBy(desc(tenants.createdAt))

    return {
      candidates,
      total: candidates.length,
      inactiveMonths,
      cutoff: cutoffIso,
      confirmation: buildTenantCleanupConfirmation(candidates.length),
    }
  }

  async execute(input: { inactiveMonths: number, tenantIds: string[], confirmation: string }) {
    const uniqueIds = [...new Set(input.tenantIds)]
    const expectedConfirmation = buildTenantCleanupConfirmation(uniqueIds.length)
    if (input.confirmation !== expectedConfirmation) {
      throw new BizException(ErrorCode.COMMON_VALIDATION, { message: `请输入 ${expectedConfirmation} 以确认操作。` })
    }

    const preview = await this.listCandidates(input.inactiveMonths, uniqueIds)
    const candidateMap = new Map(preview.candidates.map(candidate => [candidate.id, candidate]))
    const batchId = generateId()
    const actorUserId = this.audit.getActorUserId()
    const db = this.dbAccessor.get()

    await db.insert(tenantCleanupBatches).values({
      id: batchId,
      actorUserId,
      inactiveMonths: input.inactiveMonths,
      candidateCount: uniqueIds.length,
    })
    await db.insert(tenantCleanupItems).values(
      uniqueIds.map((tenantId) => {
        const candidate = candidateMap.get(tenantId)
        return {
          batchId,
          tenantId,
          tenantSlug: candidate?.slug ?? tenantId,
          lastActivityAt: candidate?.lastActivityAt ?? null,
          status: candidate ? 'pending' : 'skipped',
          reason: candidate ? null : 'no-longer-eligible',
        }
      }),
    )

    let deletedCount = 0
    let skippedCount = 0
    let failedCount = 0

    for (const tenantId of uniqueIds) {
      const candidate = candidateMap.get(tenantId)
      if (!candidate) {
        skippedCount += 1
        await this.audit.record({
          action: 'tenant.cleanup',
          targetType: 'tenant',
          targetId: tenantId,
          batchId,
          result: 'skipped',
          after: { reason: 'no-longer-eligible' },
        })
        continue
      }

      try {
        const latest = await this.listCandidates(input.inactiveMonths, [tenantId])
        if (!latest.candidates.some(item => item.id === tenantId)) {
          skippedCount += 1
          await this.updateItem(batchId, tenantId, 'skipped', 'no-longer-eligible')
          await this.audit.record({
            action: 'tenant.cleanup',
            targetType: 'tenant',
            targetId: tenantId,
            batchId,
            result: 'skipped',
            before: candidate,
            after: { reason: 'no-longer-eligible' },
          })
          continue
        }

        await this.dataManagement.deleteTenantAccountById(tenantId)
        deletedCount += 1
        await this.updateItem(batchId, tenantId, 'deleted', null)
        await this.audit.record({
          action: 'tenant.cleanup',
          targetType: 'tenant',
          targetId: tenantId,
          batchId,
          before: candidate,
          after: { deleted: true },
        })
      }
      catch (error) {
        failedCount += 1
        const errorCode = error instanceof BizException ? String(error.code) : 'unknown'
        await this.updateItem(
          batchId,
          tenantId,
          'failed',
          error instanceof Error ? error.message : 'unknown error',
          errorCode,
        )
        await this.audit.record({
          action: 'tenant.cleanup',
          targetType: 'tenant',
          targetId: tenantId,
          batchId,
          result: 'failed',
          errorCode,
          before: candidate,
        })
      }
    }

    const completedAt = new Date().toISOString()
    await db
      .update(tenantCleanupBatches)
      .set({
        status: failedCount > 0 ? 'completed_with_errors' : 'completed',
        deletedCount,
        skippedCount,
        failedCount,
        completedAt,
      })
      .where(eq(tenantCleanupBatches.id, batchId))

    return { batchId, deletedCount, skippedCount, failedCount, completedAt }
  }

  async getBatch(batchId: string) {
    const db = this.dbAccessor.get()
    const [batch] = await db.select().from(tenantCleanupBatches).where(eq(tenantCleanupBatches.id, batchId)).limit(1)
    if (!batch)
      throw new BizException(ErrorCode.COMMON_NOT_FOUND, { message: '清理批次不存在' })
    const items = await db.select().from(tenantCleanupItems).where(eq(tenantCleanupItems.batchId, batchId))
    return { batch, items }
  }

  private async updateItem(
    batchId: string,
    tenantId: string,
    status: string,
    reason: string | null,
    errorCode?: string,
  ) {
    await this.dbAccessor
      .get()
      .update(tenantCleanupItems)
      .set({ status, reason, errorCode: errorCode ?? null, completedAt: new Date().toISOString() })
      .where(and(eq(tenantCleanupItems.batchId, batchId), eq(tenantCleanupItems.tenantId, tenantId)))
  }
}
