import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TestsService } from './tests.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Tests, Assessments & Results')
@ApiBearerAuth()
@Controller()
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  @Get('tests')
  @ApiOperation({ summary: 'List tests with pagination and role-scoped visibility' })
  findAll(
    @Query() query: PaginationQueryDto,
    @Query('status') status?: string,
    @Query('subjectId') subjectId?: string,
    @Query('classBatchId') classBatchId?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.testsService.findAll({ ...query, status, subjectId, classBatchId }, user!);
  }

  @Get('tests/:id')
  @ApiOperation({ summary: 'Get test details and preview' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.testsService.findOne(id, user);
  }

  @Post('tests')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Create a test (Manual question selection or Automatic Generator)' })
  create(@Body() dto: any, @CurrentUser() user: AuthenticatedUser) {
    return this.testsService.createTest(dto, user);
  }

  @Patch('tests/:id/publish')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Publish a draft test' })
  publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.testsService.publishTest(id, user);
  }

  @Post('tests/:id/assign')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Assign a test to classes/batches or individual students' })
  assign(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.testsService.assignTest(id, dto, user);
  }

  @Post('tests/:id/start')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Start or resume an assigned test attempt (recovers saved answers)' })
  startAttempt(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.testsService.startOrResumeAttempt(id, user);
  }

  @Post('tests/:id/autosave')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Auto-save student answers and timer progress periodically' })
  autoSave(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.testsService.autoSaveAnswers(id, dto, user);
  }

  @Post('tests/:id/submit')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Submit test attempt and trigger automatic evaluation engine' })
  submit(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.testsService.submitAndEvaluateTest(id, dto, user);
  }

  @Post('tests/attempts/:attemptId/grade-subjective')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Grade subjective question answer and recalculate result' })
  gradeSubjective(
    @Param('attemptId') attemptId: string,
    @Body() dto: { questionId: string; marksAwarded: number; teacherRemarks?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.testsService.gradeSubjectiveAnswer(attemptId, dto, user);
  }

  @Get('results')
  @ApiOperation({ summary: 'List test results (scoped by role and ownership)' })
  getResults(
    @Query() query: PaginationQueryDto,
    @Query('studentId') studentId?: string,
    @Query('testId') testId?: string,
    @Query('classBatchId') classBatchId?: string,
    @Query('subjectId') subjectId?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.testsService.getResults(
      { ...query, studentId, testId, classBatchId, subjectId },
      user!,
    );
  }

  @Get('results/:id')
  @ApiOperation({ summary: 'Get detailed result with subject/topic breakdown and question review' })
  getResultDetail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.testsService.getResultDetail(id, user);
  }
}
