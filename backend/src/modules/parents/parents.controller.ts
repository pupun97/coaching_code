import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ParentsService } from './parents.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Parents')
@ApiBearerAuth()
@Controller('parents')
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @Get('my-dashboard')
  @Roles('PARENT')
  @ApiOperation({ summary: 'Get parent dashboard with multi-child switcher and active child analytics' })
  getMyDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query('studentId') studentId?: string,
  ) {
    return this.parentsService.getParentDashboard(user, studentId);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'List parents and their linked students' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.parentsService.findAll(query);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Create a new parent account and optionally link students' })
  create(@Body() dto: any, @CurrentUser() user: AuthenticatedUser) {
    return this.parentsService.createParent(dto, user);
  }
}
