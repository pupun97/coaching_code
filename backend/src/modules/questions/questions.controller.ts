import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QuestionsService } from './questions.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Question Bank')
@ApiBearerAuth()
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Search, filter, sort, and paginate question bank' })
  findAll(
    @Query() query: PaginationQueryDto,
    @Query('subjectId') subjectId?: string,
    @Query('chapterId') chapterId?: string,
    @Query('topicId') topicId?: string,
    @Query('difficulty') difficulty?: string,
    @Query('type') type?: string,
    @Query('tag') tag?: string,
    @Query('grade') grade?: string,
  ) {
    return this.questionsService.findAll({
      ...query,
      subjectId,
      chapterId,
      topicId,
      difficulty,
      type,
      tag,
      grade,
    });
  }

  @Get('organization')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Get Subject -> Chapter -> Topic -> Difficulty hierarchy and question stats' })
  getOrganization() {
    return this.questionsService.getOrganizationAndStats();
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Preview question details and statistics' })
  findOne(@Param('id') id: string) {
    return this.questionsService.findOne(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Create a new question in the question bank' })
  create(@Body() dto: any, @CurrentUser() user: AuthenticatedUser) {
    return this.questionsService.create(dto, user);
  }

  @Post('bulk-import')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Bulk import questions via CSV text or JSON array with validation' })
  bulkImport(@Body() body: any, @CurrentUser() user: AuthenticatedUser) {
    return this.questionsService.bulkImport(body, user);
  }

  @Post('bulk-delete')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Bulk delete multiple questions' })
  bulkDelete(@Body('ids') ids: string[]) {
    return this.questionsService.bulkDelete(ids);
  }

  @Post(':id/duplicate')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Duplicate an existing question' })
  duplicate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.questionsService.duplicate(id, user);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Update question, options, and tags' })
  update(@Param('id') id: string, @Body() dto: any) {
    return this.questionsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Delete a question' })
  remove(@Param('id') id: string) {
    return this.questionsService.remove(id);
  }
}
