import { DatabaseModule } from '@core/database/database.module'
import { SystemSettingModule } from '@core/modules/configuration/system-setting/system-setting.module'
import { PhotoBuilderService } from '@core/modules/content/photo/builder/photo-builder.service'
import { PhotoModule } from '@core/modules/content/photo/photo.module'
import { BillingModule } from '@core/modules/platform/billing/billing.module'
import { DataManagementModule } from '@core/modules/platform/data-management/data-management.module'
import { ManagedStorageModule } from '@core/modules/platform/managed-storage/managed-storage.module'
import { TenantModule } from '@core/modules/platform/tenant/tenant.module'
import { Module } from '@tsuki-hono/common'

import { SuperAdminAuditService } from './super-admin-audit.service'
import { SuperAdminBuilderDebugController } from './super-admin-builder.controller'
import { SuperAdminCleanupController } from './super-admin-cleanup.controller'
import { SuperAdminCleanupService } from './super-admin-cleanup.service'
import { SuperAdminSettingController } from './super-admin-settings.controller'
import { SuperAdminStorageProbeController } from './super-admin-storage-probe.controller'
import { SuperAdminStorageProbeService } from './super-admin-storage-probe.service'
import { SuperAdminTenantController } from './super-admin-tenants.controller'
import { SuperAdminAuditController, SuperAdminUsersController } from './super-admin-users.controller'
import { SuperAdminUsersService } from './super-admin-users.service'

@Module({
  imports: [
    SystemSettingModule,
    BillingModule,
    TenantModule,
    ManagedStorageModule,
    DatabaseModule,
    PhotoModule,
    DataManagementModule,
  ],
  controllers: [
    SuperAdminSettingController,
    SuperAdminBuilderDebugController,
    SuperAdminStorageProbeController,
    SuperAdminTenantController,
    SuperAdminUsersController,
    SuperAdminAuditController,
    SuperAdminCleanupController,
  ],
  providers: [
    PhotoBuilderService,
    SuperAdminStorageProbeService,
    SuperAdminAuditService,
    SuperAdminUsersService,
    SuperAdminCleanupService,
  ],
})
export class SuperAdminModule {}
