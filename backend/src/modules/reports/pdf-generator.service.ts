import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { StudentsService } from '../students/students.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class PdfGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly studentsService: StudentsService,
  ) {}

  private drawBrandedHeader(doc: PDFKit.PDFDocument, branding: any, docTitle: string, subtitle?: string) {
    const primaryColor = branding.primaryColor || '#4f46e5';

    // Top accent bar
    doc.rect(0, 0, doc.page.width, 8).fill(primaryColor);

    // Logo Badge
    doc.roundedRect(45, 24, 44, 44, 8).fill(primaryColor);
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(branding.logoText || 'EN', 45, 38, { width: 44, align: 'center' });

    // Coaching Center Name & Contact Details
    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(16)
      .text(branding.centerName || 'EduNexus Academy of Excellence', 102, 24);

    doc
      .fillColor('#475569')
      .font('Helvetica')
      .fontSize(9)
      .text(branding.address || '', 102, 44)
      .text(
        `Phone: ${branding.phone || ''}  |  Email: ${branding.email || ''}  |  Web: ${branding.website || ''}`,
        102,
        56,
      );

    // Divider line
    doc
      .moveTo(45, 80)
      .lineTo(doc.page.width - 45, 80)
      .strokeColor('#cbd5e1')
      .lineWidth(1)
      .stroke();

    // Document Title Banner
    doc.roundedRect(45, 90, doc.page.width - 90, 36, 6).fill('#f8fafc');
    doc
      .fillColor(primaryColor)
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(docTitle.toUpperCase(), 55, 98);

    if (subtitle) {
      doc
        .fillColor('#334155')
        .font('Helvetica')
        .fontSize(9)
        .text(subtitle, 55, 113);
    }

    doc.y = 140;
  }

  private drawFootersAndPageNumbers(doc: PDFKit.PDFDocument, branding: any) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const bottomY = doc.page.height - 40;
      doc
        .moveTo(45, bottomY - 8)
        .lineTo(doc.page.width - 45, bottomY - 8)
        .strokeColor('#e2e8f0')
        .lineWidth(0.7)
        .stroke();

      doc
        .fillColor('#64748b')
        .font('Helvetica')
        .fontSize(8)
        .text(
          branding.footerText || '© 2026 EduNexus Academy of Excellence',
          45,
          bottomY,
          { width: doc.page.width - 180, align: 'left' },
        );

      doc
        .fillColor('#334155')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(`Page ${i + 1} of ${range.count}`, doc.page.width - 135, bottomY, {
          width: 90,
          align: 'right',
        });
    }
  }

  private finalizePdfBuffer(doc: PDFKit.PDFDocument, branding: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      this.drawFootersAndPageNumbers(doc, branding);
      doc.end();
    });
  }

  // 1. TEST QUESTION PAPER OR ANSWER KEY PDF
  async generateTestPaperPdf(testId: string, includeAnswerKey = false): Promise<Buffer> {
    const [branding, test] = await Promise.all([
      this.settingsService.getBranding(),
      this.prisma.test.findUnique({
        where: { id: testId },
        include: {
          subject: true,
          classBatch: true,
          questions: {
            orderBy: { orderIndex: 'asc' },
            include: {
              question: {
                include: {
                  options: { orderBy: { orderIndex: 'asc' } },
                  chapter: true,
                  topic: true,
                },
              },
            },
          },
        },
      }),
    ]);

    if (!test) throw new NotFoundException('Test not found');

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 45, bottom: 55, left: 45, right: 45 },
      bufferPages: true,
    });

    this.drawBrandedHeader(
      doc,
      branding,
      includeAnswerKey ? `${test.title} — OFFICIAL ANSWER KEY` : test.title,
      `Subject: ${test.subject.name}  |  Batch: ${test.classBatch?.name || 'All Batches'}  |  Test Code: ${test.code}`,
    );

    // Metadata Box
    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(
        `Date: ${test.startTime.toISOString().split('T')[0]}      Duration: ${test.durationMinutes} Mins      Maximum Marks: ${test.totalMarks}      Passing Marks: ${test.passingMarks}`,
        45,
        doc.y,
      );
    doc.moveDown(0.6);

    // Instructions
    if (test.instructions && !includeAnswerKey) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b').text('General Instructions:');
      doc.font('Helvetica').fontSize(9).fillColor('#334155').text(test.instructions);
      doc.moveDown(0.8);
    }

    doc
      .moveTo(45, doc.y)
      .lineTo(doc.page.width - 45, doc.y)
      .strokeColor('#cbd5e1')
      .stroke();
    doc.moveDown(0.8);

    // Render Questions
    const optionLabels = ['(A)', '(B)', '(C)', '(D)', '(E)', '(F)'];

    test.questions.forEach((tq, index) => {
      if (doc.y > doc.page.height - 150) {
        doc.addPage();
      }
      const q = tq.question;
      doc
        .font('Helvetica-Bold')
        .fontSize(10.5)
        .fillColor('#0f172a')
        .text(
          `Q${index + 1}. ${q.questionText}   [+${tq.marks} Marks${test.negativeMarkingEnabled && tq.negativeMarks ? `, -${tq.negativeMarks} Neg` : ''}]`,
        );

      doc.moveDown(0.3);

      if (q.options && q.options.length > 0) {
        q.options.forEach((opt, oIdx) => {
          const prefix = optionLabels[oIdx] || `(${oIdx + 1})`;
          const markCorrect = includeAnswerKey && opt.isCorrect ? '  ✓ [CORRECT]' : '';
          doc
            .font(includeAnswerKey && opt.isCorrect ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(9.5)
            .fillColor(includeAnswerKey && opt.isCorrect ? '#059669' : '#334155')
            .text(`    ${prefix} ${opt.optionText}${markCorrect}`);
        });
      } else if (q.type === 'NUMERICAL') {
        doc
          .font('Helvetica-Oblique')
          .fontSize(9)
          .fillColor('#475569')
          .text('    [Numerical Value Response Question]');
        if (includeAnswerKey) {
          doc
            .font('Helvetica-Bold')
            .fillColor('#059669')
            .text(`    ✓ Correct Numerical Answer: ${q.numericalAnswer}`);
        }
      } else {
        doc
          .font('Helvetica-Oblique')
          .fontSize(9)
          .fillColor('#475569')
          .text('    [Subjective Answer Space]');
        if (includeAnswerKey && q.correctTextAnswer) {
          doc
            .font('Helvetica-Bold')
            .fillColor('#059669')
            .text(`    ✓ Reference Answer: ${q.correctTextAnswer}`);
        }
      }

      if (includeAnswerKey && q.explanation) {
        doc.moveDown(0.2);
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#1e40af')
          .text(`    Explanation: ${q.explanation}`);
      }

      doc.moveDown(0.8);
    });

    return this.finalizePdfBuffer(doc, branding);
  }

  // 2. STUDENT PROGRESS REPORT CARD PDF
  async generateStudentProgressReportPdf(studentId: string, actor: AuthenticatedUser): Promise<Buffer> {
    const [branding, studentData] = await Promise.all([
      this.settingsService.getBranding(),
      this.studentsService.findOne(studentId, actor),
    ]);

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 45, bottom: 55, left: 45, right: 45 },
      bufferPages: true,
    });

    const fullName = `${studentData.user.firstName} ${studentData.user.lastName}`;
    const batchName = studentData.enrollments[0]?.classBatch?.name || 'General Batch';

    this.drawBrandedHeader(
      doc,
      branding,
      'OFFICIAL STUDENT ACADEMIC PROGRESS REPORT CARD',
      `Academic Year: ${studentData.academicYear}  |  Generated: ${new Date().toISOString().split('T')[0]}`,
    );

    // Student Profile Card
    doc.roundedRect(45, doc.y, doc.page.width - 90, 68, 6).strokeColor('#cbd5e1').stroke();
    const boxTop = doc.y + 10;
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#0f172a')
      .text(`Student Name: ${fullName}`, 58, boxTop)
      .text(`Student ID: ${studentData.studentCode}`, 320, boxTop)
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor('#334155')
      .text(`Class / Grade: ${studentData.grade}`, 58, boxTop + 18)
      .text(`Enrolled Batch: ${batchName}`, 320, boxTop + 18)
      .text(`Target Exam: ${studentData.targetExam || 'Board & Competitive'}`, 58, boxTop + 36)
      .text(`Attendance Rate: ${studentData.summary.attendancePercentage}%`, 320, boxTop + 36);

    doc.y = boxTop + 72;

    // Executive Summary Metrics
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#0f172a')
      .text('1. Overall Performance & Attendance Summary', 45, doc.y);
    doc.moveDown(0.4);
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor('#334155')
      .text(
        `• Tests Completed: ${studentData.summary.totalTestsTaken}    |    Average Score: ${studentData.summary.averagePercentage}%    |    Best Score: ${studentData.summary.bestPercentage}%`,
      )
      .text(
        `• Classes Attended: ${studentData.summary.presentCount} / ${studentData.summary.totalAttendance} (${studentData.summary.attendancePercentage}%)`,
      );
    doc.moveDown(0.8);

    // Test History Table
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#0f172a')
      .text('2. Assessment & Test History');
    doc.moveDown(0.4);

    if (studentData.results.length === 0) {
      doc.font('Helvetica').fontSize(9.5).fillColor('#64748b').text('No evaluated tests recorded yet.');
    } else {
      studentData.results.forEach((r, idx) => {
        doc
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .fillColor('#1e293b')
          .text(
            `${idx + 1}. ${r.test.title} (${r.subject.name}) — Score: ${r.obtainedMarks}/${r.totalMarks} (${r.percentage}%) | Accuracy: ${r.accuracy}%`,
          );
        if (r.teacherRemarks) {
          doc
            .font('Helvetica-Oblique')
            .fontSize(8.5)
            .fillColor('#475569')
            .text(`   Remarks: ${r.teacherRemarks}`);
        }
        doc.moveDown(0.3);
      });
    }

    doc.moveDown(0.6);

    // Teacher Feedback & Recommendations
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#0f172a')
      .text('3. Faculty Remarks, Strengths & Action Plan');
    doc.moveDown(0.4);

    if (studentData.feedbacks.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(9.5)
        .fillColor('#334155')
        .text('• Consistent participation in classroom sessions. Continue regular DPP practice.');
    } else {
      studentData.feedbacks.forEach((f) => {
        doc
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .fillColor('#0f172a')
          .text(
            `[${f.category}] Rating: ${f.rating}/5 — by ${f.teacher.user.firstName} ${f.teacher.user.lastName}`,
          );
        doc.font('Helvetica').fontSize(9).fillColor('#334155').text(`Feedback: ${f.comment}`);
        if (f.actionPlan) {
          doc
            .font('Helvetica-Oblique')
            .fontSize(9)
            .fillColor('#4f46e5')
            .text(`Recommended Action Plan: ${f.actionPlan}`);
        }
        doc.moveDown(0.4);
      });
    }

    return this.finalizePdfBuffer(doc, branding);
  }

  // 3. SINGLE TEST RESULT PDF
  async generateSingleResultPdf(resultId: string): Promise<Buffer> {
    const [branding, result] = await Promise.all([
      this.settingsService.getBranding(),
      this.prisma.result.findUnique({
        where: { id: resultId },
        include: {
          test: true,
          subject: true,
          student: { include: { user: true } },
        },
      }),
    ]);

    if (!result) throw new NotFoundException('Result not found');

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 45, bottom: 55, left: 45, right: 45 },
      bufferPages: true,
    });

    this.drawBrandedHeader(
      doc,
      branding,
      `ASSESSMENT SCORECARD — ${result.test.title}`,
      `Student: ${result.student.user.firstName} ${result.student.user.lastName} (${result.student.studentCode})`,
    );

    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#0f172a')
      .text(`Score Obtained: ${result.obtainedMarks} / ${result.totalMarks} (${result.percentage}%)`)
      .moveDown(0.4);

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#334155')
      .text(`Subject: ${result.subject.name}`)
      .text(`Accuracy: ${result.accuracy}%`)
      .text(`Correct Answers: ${result.correctCount}  |  Incorrect: ${result.incorrectCount}  |  Unanswered: ${result.unansweredCount}`)
      .text(`Time Taken: ${Math.floor(result.timeTakenSeconds / 60)}m ${result.timeTakenSeconds % 60}s`)
      .text(`Status: ${result.isPassed ? 'PASSED' : 'NEEDS IMPROVEMENT'}`);

    if (result.teacherRemarks) {
      doc.moveDown(0.8);
      doc.font('Helvetica-Bold').text('Faculty Evaluation Remarks:');
      doc.font('Helvetica').text(result.teacherRemarks);
    }

    return this.finalizePdfBuffer(doc, branding);
  }

  // 4. ATTENDANCE REPORT PDF
  async generateAttendanceReportPdf(classBatchId?: string): Promise<Buffer> {
    const [branding, sessions] = await Promise.all([
      this.settingsService.getBranding(),
      this.prisma.attendance.findMany({
        where: classBatchId ? { classBatchId } : {},
        orderBy: { date: 'desc' },
        take: 25,
        include: {
          classBatch: true,
          subject: true,
          records: true,
        },
      }),
    ]);

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 45, bottom: 55, left: 45, right: 45 },
      bufferPages: true,
    });

    this.drawBrandedHeader(
      doc,
      branding,
      'OFFICIAL ATTENDANCE SUMMARY REPORT',
      `Generated on ${new Date().toISOString().split('T')[0]}`,
    );

    sessions.forEach((s, idx) => {
      const total = s.records.length;
      const present = s.records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
      const absent = s.records.filter((r) => r.status === 'ABSENT').length;
      const pct = total > 0 ? ((present / total) * 100).toFixed(1) : '100.0';

      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#0f172a')
        .text(
          `${idx + 1}. ${s.dateString} — ${s.classBatch.name} (${s.subject?.name || 'General'})`,
        );
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#334155')
        .text(
          `   Present: ${present}/${total} (${pct}%)  |  Absent: ${absent}  |  Topic: ${s.topicCovered || 'Standard Session'}`,
        );
      doc.moveDown(0.4);
    });

    return this.finalizePdfBuffer(doc, branding);
  }
}
