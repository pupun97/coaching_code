import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'List administrative and security audit logs with filtering and pagination' })
  findAll(
    @Query() query: PaginationQueryDto,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('userId') userId?: string,
  ) {
    return this.auditLogsService.findAll({ ...query, action, entity, userId });
  }
}
