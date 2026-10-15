import { PlatformRoles } from '@core/guards/roles.decorator'
import { BypassResponseTransform } from '@core/interceptors/response-transform.decorator'
import { Body, Controller, Get, Param, Post, Query } from '@tsuki-hono/common'

import { CleanupCandidatesQueryDto, ExecuteTenantCleanupDto } from './super-admin.dto'
import { SuperAdminCleanupService } from './super-admin-cleanup.service'

@Controller('super-admin/tenant-cleanup')
@PlatformRoles('superadmin')
@BypassResponseTransform()
export class SuperAdminCleanupController {
  constructor(private readonly cleanup: SuperAdminCleanupService) {}

  @Get('/candidates')
  async candidates(@Query() query: CleanupCandidatesQueryDto) {
    return await this.cleanup.listCandidates(query.inactiveMonths)
  }

  @Post('/batches')
  async execute(@Body() body: ExecuteTenantCleanupDto) {
    return await this.cleanup.execute(body)
  }

  @Get('/batches/:batchId')
  async batch(@Param('batchId') batchId: string) {
    return await this.cleanup.getBatch(batchId)
  }
}
