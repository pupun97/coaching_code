import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StudentsService } from '../students/students.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentsService: StudentsService,
  ) {}

  async getAdminDashboard() {
    const [
      totalStudents,
      totalTeachers,
      totalParents,
      totalClasses,
      activeCourses,
      testsConducted,
      totalQuestions,
      results,
      attendanceSessions,
      recentAuditLogs,
      newRegistrations,
      announcements,
      classesWithStats,
    ] = await Promise.all([
      this.prisma.student.count({ where: { user: { deletedAt: null } } }),
      this.prisma.teacher.count({ where: { user: { deletedAt: null } } }),
      this.prisma.parent.count({ where: { user: { deletedAt: null } } }),
      this.prisma.classBatch.count({ where: { status: 'ACTIVE' } }),
      this.prisma.course.count({ where: { isPublished: true } }),
      this.prisma.test.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.question.count({ where: { isActive: true } }),
      this.prisma.result.findMany({
        include: {
          subject: { select: { name: true } },
          classBatch: { select: { name: true } },
        },
      }),
      this.prisma.attendance.findMany({
        orderBy: { date: 'desc' },
        take: 14,
        include: { records: true, classBatch: { select: { name: true } } },
      }),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
      this.prisma.announcement.findMany({
        where: { isActive: true },
        orderBy: { publishDate: 'desc' },
        take: 5,
      }),
      this.prisma.classBatch.findMany({
        where: { status: 'ACTIVE' },
        include: {
          _count: { select: { students: true, tests: true } },
          results: { select: { percentage: true } },
        },
      }),
    ]);

    const averagePerformance =
      results.length > 0
        ? Number((results.reduce((a, b) => a + b.percentage, 0) / results.length).toFixed(1))
        : 81.5;

    // Attendance summary across recent sessions
    let totalAttRecords = 0;
    let totalPresentRecords = 0;
    const attendanceTrends = attendanceSessions
      .slice(0, 7)
      .reverse()
      .map((session) => {
        const total = session.records.length;
        const present = session.records.filter(
          (r) => r.status === 'PRESENT' || r.status === 'LATE',
        ).length;
        totalAttRecords += total;
        totalPresentRecords += present;
        return {
          date: session.dateString,
          batch: session.classBatch.name,
          percentage: total > 0 ? Number(((present / total) * 100).toFixed(1)) : 100,
          present,
          total,
        };
      });

    const overallAttendanceRate =
      totalAttRecords > 0
        ? Number(((totalPresentRecords / totalAttRecords) * 100).toFixed(1))
        : 92.4;

    // Subject-wise average performance chart
    const subjectMap: Record<string, { sum: number; count: number }> = {};
    for (const r of results) {
      const sName = r.subject?.name || 'General';
      if (!subjectMap[sName]) subjectMap[sName] = { sum: 0, count: 0 };
      subjectMap[sName].sum += r.percentage;
      subjectMap[sName].count += 1;
    }
    const subjectPerformanceChart = Object.entries(subjectMap).map(([subject, data]) => ({
      subject,
      averagePercentage: Number((data.sum / data.count).toFixed(1)),
      attemptsCount: data.count,
    }));

    // Class-wise performance chart
    const classPerformanceChart = classesWithStats.map((cls) => {
      const avg =
        cls.results.length > 0
          ? Number(
              (cls.results.reduce((a, b) => a + b.percentage, 0) / cls.results.length).toFixed(1),
            )
          : 78.5;
      return {
        id: cls.id,
        name: cls.name,
        studentsCount: cls._count.students,
        testsCount: cls._count.tests,
        averageScore: avg,
      };
    });

    return {
      kpis: {
        totalStudents,
        totalTeachers,
        totalParents,
        totalClasses,
        activeCourses,
        testsConducted,
        totalQuestions,
        averagePerformance,
        overallAttendanceRate,
      },
      charts: {
        subjectPerformance: subjectPerformanceChart,
        attendanceTrends,
        classPerformance: classPerformanceChart,
      },
      recentActivities: recentAuditLogs,
      newRegistrations,
      announcements,
    };
  }

  async getStudentPerformanceAnalytics(studentId: string, actor: AuthenticatedUser) {
    const targetId = studentId === 'me' && actor.studentId ? actor.studentId : studentId;
    const student = await this.studentsService.findOne(targetId, actor);

    const results = await this.prisma.result.findMany({
      where: { studentId: targetId },
      orderBy: { publishedAt: 'asc' },
      include: {
        test: { select: { id: true, title: true, code: true, totalMarks: true } },
        subject: { select: { id: true, name: true, color: true } },
      },
    });

    // Subject-wise breakdown
    const bySubject: Record<string, { sumPct: number; sumAcc: number; count: number; color: string }> = {};
    // Topic-wise breakdown
    const byTopic: Record<string, { correct: number; total: number; percentage: number }> = {};

    const improvementTrend = results.map((r, index) => {
      const sName = r.subject.name;
      if (!bySubject[sName]) {
        bySubject[sName] = { sumPct: 0, sumAcc: 0, count: 0, color: r.subject.color || '#4f46e5' };
      }
      bySubject[sName].sumPct += r.percentage;
      bySubject[sName].sumAcc += r.accuracy;
      bySubject[sName].count += 1;

      const topics = JSON.parse(r.topicBreakdownJson || '{}');
      for (const [tName, tVal] of Object.entries<any>(topics)) {
        if (!byTopic[tName]) byTopic[tName] = { correct: 0, total: 0, percentage: 0 };
        byTopic[tName].correct += Number(tVal.correct || 0);
        byTopic[tName].total += Number(tVal.total || 0);
      }

      return {
        index: index + 1,
        testId: r.testId,
        testTitle: r.test.title,
        subject: sName,
        date: r.publishedAt.toISOString().split('T')[0],
        percentage: r.percentage,
        accuracy: r.accuracy,
        obtainedMarks: r.obtainedMarks,
        totalMarks: r.totalMarks,
      };
    });

    const subjectPerformance = Object.entries(bySubject).map(([subject, d]) => ({
      subject,
      percentage: Number((d.sumPct / d.count).toFixed(1)),
      accuracy: Number((d.sumAcc / d.count).toFixed(1)),
      testsCount: d.count,
      color: d.color,
    }));

    const topicPerformance = Object.entries(byTopic).map(([topic, d]) => {
      const pct = d.total > 0 ? Number(((d.correct / d.total) * 100).toFixed(1)) : 0;
      return {
        topic,
        correct: d.correct,
        total: d.total,
        percentage: pct,
      };
    });

    const strongAreas = topicPerformance.filter((t) => t.percentage >= 75);
    const weakAreas = topicPerformance.filter((t) => t.percentage < 75);

    const overallPercentage =
      results.length > 0
        ? Number((results.reduce((a, b) => a + b.percentage, 0) / results.length).toFixed(1))
        : 0;
    const overallAccuracy =
      results.length > 0
        ? Number((results.reduce((a, b) => a + b.accuracy, 0) / results.length).toFixed(1))
        : 0;
    const bestScore =
      results.length > 0 ? Math.max(...results.map((r) => r.percentage)) : 0;

    return {
      student: {
        id: student.id,
        studentCode: student.studentCode,
        fullName: `${student.user.firstName} ${student.user.lastName}`,
        grade: student.grade,
        targetExam: student.targetExam,
        attendancePercentage: student.summary.attendancePercentage,
      },
      overview: {
        overallPercentage,
        overallAccuracy,
        averageScore: overallPercentage,
        bestScore,
        testsAttempted: results.length,
      },
      subjectPerformance,
      topicPerformance,
      improvementTrend,
      strongAreas,
      weakAreas,
    };
  }

  async generateCsvReport(type: string): Promise<{ filename: string; csv: string }> {
    if (type === 'attendance') {
      const records = await this.prisma.attendanceRecord.findMany({
        include: {
          student: { include: { user: true } },
          attendance: { include: { classBatch: true, subject: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
      const header = 'Date,Batch,Subject,Student Code,Student Name,Status,CheckInTime,Remarks\n';
      const rows = records
        .map(
          (r) =>
            `"${r.attendance.dateString}","${r.attendance.classBatch.name}","${r.attendance.subject?.name || 'General'}","${r.student.studentCode}","${r.student.user.firstName} ${r.student.user.lastName}","${r.status}","${r.checkInTime || ''}","${r.remarks || ''}"`,
        )
        .join('\n');
      return { filename: `edunexus-attendance-report.csv`, csv: header + rows };
    }

    if (type === 'results' || type === 'tests') {
      const results = await this.prisma.result.findMany({
        include: {
          student: { include: { user: true } },
          test: true,
          subject: true,
        },
        orderBy: { publishedAt: 'desc' },
      });
      const header = 'Test Code,Test Title,Subject,Student Code,Student Name,Obtained Marks,Total Marks,Percentage,Accuracy,Rank,Status\n';
      const rows = results
        .map(
          (r) =>
            `"${r.test.code}","${r.test.title}","${r.subject.name}","${r.student.studentCode}","${r.student.user.firstName} ${r.student.user.lastName}",${r.obtainedMarks},${r.totalMarks},${r.percentage}%,${r.accuracy}%,${r.rank || '-'},"${r.isPassed ? 'PASSED' : 'FAILED'}"`,
        )
        .join('\n');
      return { filename: `edunexus-test-results-report.csv`, csv: header + rows };
    }

    // Default: Students Report
    const students = await this.prisma.student.findMany({
      include: {
        user: true,
        enrollments: { include: { classBatch: true } },
      },
      orderBy: { studentCode: 'asc' },
    });
    const header = 'Student Code,First Name,Last Name,Email,Phone,Grade,Batch,Target Exam,Status\n';
    const rows = students
      .map(
        (s) =>
          `"${s.studentCode}","${s.user.firstName}","${s.user.lastName}","${s.user.email}","${s.user.phone || ''}","${s.grade}","${s.enrollments[0]?.classBatch?.name || ''}","${s.targetExam || ''}","${s.user.status}"`,
      )
      .join('\n');
    return { filename: `edunexus-students-report.csv`, csv: header + rows };
  }
}
