import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Analytics, Reports & Branded PDF Generation')
@ApiBearerAuth()
@Controller()
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly pdfGenerator: PdfGeneratorService,
  ) {}

  @Get('reports/admin-dashboard')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Get comprehensive Admin Dashboard KPIs, charts, and activity summary' })
  getAdminDashboard() {
    return this.reportsService.getAdminDashboard();
  }

  @Get('reports/student-analytics/:studentId')
  @ApiOperation({ summary: 'Get detailed student performance analytics, trends, strong & weak areas' })
  getStudentAnalytics(
    @Param('studentId') studentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.getStudentPerformanceAnalytics(studentId, user);
  }

  @Get('reports/export/csv')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Export report to CSV/Excel format (students | attendance | results)' })
  async exportCsv(@Query('type') type = 'students', @Res() res: Response) {
    const { filename, csv } = await this.reportsService.generateCsvReport(type);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  // --- BRANDED PDF ENDPOINTS ---
  @Get('pdf/test-paper/:testId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Generate branded Test Question Paper PDF' })
  async downloadTestPaperPdf(@Param('testId') testId: string, @Res() res: Response) {
    const buffer = await this.pdfGenerator.generateTestPaperPdf(testId, false);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="test-paper-${testId}.pdf"`);
    res.send(buffer);
  }

  @Get('pdf/answer-key/:testId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Generate branded Test Answer Key & Solutions PDF' })
  async downloadAnswerKeyPdf(@Param('testId') testId: string, @Res() res: Response) {
    const buffer = await this.pdfGenerator.generateTestPaperPdf(testId, true);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="answer-key-${testId}.pdf"`);
    res.send(buffer);
  }

  @Get('pdf/result/:resultId')
  @ApiOperation({ summary: 'Generate branded Student Test Result Scorecard PDF' })
  async downloadResultPdf(@Param('resultId') resultId: string, @Res() res: Response) {
    const buffer = await this.pdfGenerator.generateSingleResultPdf(resultId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="result-${resultId}.pdf"`);
    res.send(buffer);
  }

  @Get('pdf/progress-report/:studentId')
  @ApiOperation({ summary: 'Generate branded Student Progress Report Card PDF' })
  async downloadProgressReportPdf(
    @Param('studentId') studentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const targetId = studentId === 'me' && user.studentId ? user.studentId : studentId;
    const buffer = await this.pdfGenerator.generateStudentProgressReportPdf(targetId, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="progress-report-${targetId}.pdf"`);
    res.send(buffer);
  }

  @Get('pdf/attendance-report')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Generate branded Attendance Summary Report PDF' })
  async downloadAttendanceReportPdf(
    @Query('classBatchId') classBatchId: string | undefined,
    @Res() res: Response,
  ) {
    const buffer = await this.pdfGenerator.generateAttendanceReportPdf(classBatchId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-report.pdf"`);
    res.send(buffer);
  }
}
