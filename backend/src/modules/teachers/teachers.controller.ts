import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TeachersService } from './teachers.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Teachers')
@ApiBearerAuth()
@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Get('my-dashboard')
  @Roles('TEACHER')
  @ApiOperation({ summary: 'Get authenticated teacher dashboard summary and assigned classes' })
  getMyDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.teachersService.getTeacherDashboard(user);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT')
  @ApiOperation({ summary: 'List teachers with assigned subjects and batches' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.teachersService.findAll(query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Get teacher profile and timetable' })
  findOne(@Param('id') id: string) {
    return this.teachersService.findOne(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Create a new teacher account' })
  create(@Body() dto: any, @CurrentUser() user: AuthenticatedUser) {
    return this.teachersService.createTeacher(dto, user);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Update teacher profile and qualification' })
  update(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teachersService.updateTeacher(id, dto, user);
  }

  @Post(':id/assign')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Assign class/batch and subject to a teacher' })
  assignClass(
    @Param('id') id: string,
    @Body() dto: { classBatchId: string; subjectId: string; isPrimaryCoordinator?: boolean },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teachersService.assignClassAndSubject(id, dto, user);
  }
}
