import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcademicService } from './academic.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Classes, Subjects & Timetable')
@ApiBearerAuth()
@Controller()
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  @Get('courses')
  @ApiOperation({ summary: 'List all courses and programs' })
  getCourses() {
    return this.academicService.getCourses();
  }

  @Post('courses')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Create a new course' })
  createCourse(@Body() dto: any, @CurrentUser() user: AuthenticatedUser) {
    return this.academicService.createCourse(dto, user);
  }

  @Get('subjects')
  @ApiOperation({ summary: 'List subjects with chapters and topics hierarchy' })
  getSubjects(@Query('courseId') courseId?: string) {
    return this.academicService.getSubjectsHierarchy(courseId);
  }

  @Post('subjects')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Create a subject' })
  createSubject(@Body() dto: any) {
    return this.academicService.createSubject(dto);
  }

  @Post('subjects/chapters')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Create a chapter within a subject' })
  createChapter(@Body() dto: any) {
    return this.academicService.createChapter(dto);
  }

  @Post('subjects/topics')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Create a topic within a chapter' })
  createTopic(@Body() dto: any) {
    return this.academicService.createTopic(dto);
  }

  @Get('classes')
  @ApiOperation({ summary: 'List all classes/batches' })
  getClasses(@Query('status') status?: string) {
    return this.academicService.getClasses(status);
  }

  @Get('classes/:id')
  @ApiOperation({ summary: 'Get detailed class/batch with enrolled students, teachers, and timetable' })
  getClassById(@Param('id') id: string) {
    return this.academicService.getClassById(id);
  }

  @Post('classes')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Create a new class/batch' })
  createClass(@Body() dto: any, @CurrentUser() user: AuthenticatedUser) {
    return this.academicService.createClass(dto, user);
  }

  @Patch('classes/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Update class/batch details' })
  updateClass(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.academicService.updateClass(id, dto, user);
  }

  @Post('classes/:id/students')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Add student to class/batch' })
  addStudent(
    @Param('id') classBatchId: string,
    @Body() body: { studentId: string; rollNumber?: number },
  ) {
    return this.academicService.addStudentToClass(classBatchId, body.studentId, body.rollNumber);
  }

  @Delete('classes/:id/students/:studentId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Remove student from class/batch' })
  removeStudent(
    @Param('id') classBatchId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.academicService.removeStudentFromClass(classBatchId, studentId);
  }

  @Post('classes/:id/teachers')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Assign teacher and subject to class/batch' })
  assignTeacher(
    @Param('id') classBatchId: string,
    @Body() body: { teacherId: string; subjectId: string; isPrimaryCoordinator?: boolean },
  ) {
    return this.academicService.assignTeacherToClass(classBatchId, body);
  }

  @Get('timetable')
  @ApiOperation({ summary: 'Get timetable slots for class, teacher, or authenticated student' })
  getTimetable(
    @Query('classBatchId') classBatchId?: string,
    @Query('teacherId') teacherId?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.academicService.getTimetable({ classBatchId, teacherId }, user!);
  }

  @Post('timetable')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Create a timetable slot' })
  createTimetableSlot(@Body() dto: any) {
    return this.academicService.createTimetableSlot(dto);
  }

  @Delete('timetable/:id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Delete a timetable slot' })
  deleteTimetableSlot(@Param('id') id: string) {
    return this.academicService.deleteTimetableSlot(id);
  }
}
