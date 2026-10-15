import { describe, expect, it } from 'vitest'

import { sanitizeAuditSnapshot } from './super-admin-audit.service'
import { buildTenantCleanupConfirmation, calculateInactiveCutoff } from './super-admin-cleanup.service'
import { resolveCommercialStatus, resolveMobileSummary } from './super-admin-users.service'

describe('super-admin observability policies', () => {
  it('redacts sensitive fields recursively before persisting audit snapshots', () => {
    expect(
      sanitizeAuditSnapshot({
        email: 'owner@example.com',
        accessToken: 'secret-token',
        nested: { password: 'secret-password', planId: 'pro' },
        devices: [{ deviceToken: 'secret-device', appVersion: '1.0.0' }],
      }),
    ).toEqual({
      email: 'owner@example.com',
      nested: { planId: 'pro' },
      devices: [{ appVersion: '1.0.0' }],
    })
  })

  it('keeps paid ownership distinct from paid membership and mixed portfolios', () => {
    expect(resolveCommercialStatus({ ownedFreeCount: 0, ownedPaidCount: 0, paidMemberCount: 0 })).toBe('none')
    expect(resolveCommercialStatus({ ownedFreeCount: 1, ownedPaidCount: 0, paidMemberCount: 0 })).toBe('free-owner')
    expect(resolveCommercialStatus({ ownedFreeCount: 0, ownedPaidCount: 1, paidMemberCount: 0 })).toBe('paid-owner')
    expect(resolveCommercialStatus({ ownedFreeCount: 0, ownedPaidCount: 0, paidMemberCount: 1 })).toBe('paid-member')
    expect(resolveCommercialStatus({ ownedFreeCount: 1, ownedPaidCount: 1, paidMemberCount: 0 })).toBe('mixed')
    expect(resolveCommercialStatus({ ownedFreeCount: 1, ownedPaidCount: 0, paidMemberCount: 1 })).toBe('mixed')
  })

  it('requires the exact candidate count in destructive batch confirmation', () => {
    expect(buildTenantCleanupConfirmation(12)).toBe('DELETE 12 EMPTY TENANTS')
  })

  it('subtracts calendar months without overflowing shorter months', () => {
    expect(calculateInactiveCutoff(new Date('2026-05-31T08:30:00.000Z'), 3).toISOString()).toBe(
      '2026-02-28T08:30:00.000Z',
    )
  })

  it('observes mobile use without requiring a registered push device', () => {
    expect(
      resolveMobileSummary({
        activityCount: 4,
        activityLastSeenAt: '2026-08-06T12:00:00.000Z',
        activityAppVersion: '1.4.0',
        deviceCount: 0,
        deviceLastSeenAt: null,
        deviceAppVersion: null,
      }),
    ).toEqual({
      activityCount: 4,
      deviceCount: 0,
      lastSeenAt: '2026-08-06T12:00:00.000Z',
      latestAppVersion: '1.4.0',
    })
  })
})
