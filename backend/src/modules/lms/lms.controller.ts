import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LmsService } from './lms.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Announcements, Study Materials, Assignments & Feedback')
@ApiBearerAuth()
@Controller()
export class LmsController {
  constructor(private readonly lmsService: LmsService) {}

  // Announcements
  @Get('announcements')
  @ApiOperation({ summary: 'List active announcements targeted to current user role/batch' })
  getAnnouncements(@CurrentUser() user: AuthenticatedUser) {
    return this.lmsService.getAnnouncements(user);
  }

  @Post('announcements')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Create a targeted announcement' })
  createAnnouncement(@Body() dto: any, @CurrentUser() user: AuthenticatedUser) {
    return this.lmsService.createAnnouncement(dto, user);
  }

  @Delete('announcements/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Remove an announcement' })
  deleteAnnouncement(@Param('id') id: string) {
    return this.lmsService.deleteAnnouncement(id);
  }

  // Study Materials
  @Get('materials')
  @ApiOperation({ summary: 'List study materials and learning resources' })
  getMaterials(
    @Query('classBatchId') classBatchId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('chapterId') chapterId?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.lmsService.getStudyMaterials({ classBatchId, subjectId, chapterId }, user!);
  }

  @Post('materials')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Upload or link study material' })
  createMaterial(@Body() dto: any, @CurrentUser() user: AuthenticatedUser) {
    return this.lmsService.createStudyMaterial(dto, user);
  }

  @Delete('materials/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Delete study material' })
  deleteMaterial(@Param('id') id: string) {
    return this.lmsService.deleteStudyMaterial(id);
  }

  // Assignments
  @Get('assignments')
  @ApiOperation({ summary: 'List homework assignments and submission statuses' })
  getAssignments(
    @Query('classBatchId') classBatchId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('studentId') studentId?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.lmsService.getAssignments({ classBatchId, subjectId, studentId }, user!);
  }

  @Post('assignments')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Create a homework assignment' })
  createAssignment(@Body() dto: any, @CurrentUser() user: AuthenticatedUser) {
    return this.lmsService.createAssignment(dto, user);
  }

  @Post('assignments/:id/submit')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Student submits homework assignment' })
  submitAssignment(
    @Param('id') id: string,
    @Body() dto: { submissionText?: string; fileUrl?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lmsService.submitAssignment(id, dto, user);
  }

  @Patch('assignments/submissions/:submissionId/grade')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Teacher grades student assignment submission' })
  gradeSubmission(
    @Param('submissionId') submissionId: string,
    @Body() dto: { marksObtained: number; feedback?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lmsService.gradeSubmission(submissionId, dto, user);
  }

  // Teacher Feedback
  @Get('feedback')
  @ApiOperation({ summary: 'Get student feedback records (role & ownership scoped)' })
  getFeedbacks(
    @Query('studentId') studentId?: string,
    @Query('category') category?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.lmsService.getFeedbacks({ studentId, category }, user!);
  }

  @Post('feedback')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Provide structured teacher feedback on a student' })
  createFeedback(@Body() dto: any, @CurrentUser() user: AuthenticatedUser) {
    return this.lmsService.createFeedback(dto, user);
  }
}
