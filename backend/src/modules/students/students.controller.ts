import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Students')
@ApiBearerAuth()
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get('my-dashboard')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Get authenticated student complete dashboard data' })
  getMyDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.studentsService.getStudentDashboard(user);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER', 'PARENT')
  @ApiOperation({ summary: 'List students with server-side pagination, search & filters' })
  findAll(
    @Query() query: PaginationQueryDto,
    @Query('grade') grade?: string,
    @Query('classBatchId') classBatchId?: string,
    @Query('status') status?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.studentsService.findAll({ ...query, grade, classBatchId, status }, user!);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get student profile, results, attendance, and feedback (RBAC & ownership enforced)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.studentsService.findOne(id, user);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Create a new student with auto-generated Student ID' })
  create(@Body() dto: any, @CurrentUser() user: AuthenticatedUser) {
    return this.studentsService.createStudent(dto, user);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Update student profile and academic info' })
  update(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentsService.updateStudent(id, dto, user);
  }

  @Post(':id/assign-class')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Assign student to a class/batch' })
  assignToClass(
    @Param('id') id: string,
    @Body('classBatchId') classBatchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentsService.assignToClass(id, classBatchId, user);
  }

  @Post(':id/link-parent')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Link a parent account to this student' })
  linkParent(
    @Param('id') id: string,
    @Body() body: { parentId: string; relationship?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentsService.linkParent(id, body.parentId, body.relationship, user);
  }
}
