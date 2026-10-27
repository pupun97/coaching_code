import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async markOrUpdateAttendance(
    dto: {
      classBatchId: string;
      subjectId?: string;
      date: string; // YYYY-MM-DD
      topicCovered?: string;
      notes?: string;
      markAllPresent?: boolean;
      records?: { studentId: string; status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'; remarks?: string; checkInTime?: string }[];
    },
    actor: AuthenticatedUser,
  ) {
    if (!dto.classBatchId || !dto.date) {
      throw new BadRequestException('classBatchId and date are required');
    }

    const dateString = dto.date.split('T')[0];
    const dateObj = new Date(dateString);

    let studentRecords = dto.records || [];
    if (dto.markAllPresent || studentRecords.length === 0) {
      const enrolled = await this.prisma.classStudent.findMany({
        where: { classBatchId: dto.classBatchId, status: 'ACTIVE' },
      });
      studentRecords = enrolled.map((e) => ({
        studentId: e.studentId,
        status: 'PRESENT',
        checkInTime: '09:00 AM',
      }));
    }

    const attendanceSession = await this.prisma.attendance.upsert({
      where: {
        classBatchId_dateString: {
          classBatchId: dto.classBatchId,
          dateString,
        },
      },
      create: {
        classBatchId: dto.classBatchId,
        subjectId: dto.subjectId || null,
        date: dateObj,
        dateString,
        topicCovered: dto.topicCovered || null,
        notes: dto.notes || null,
        markedById: actor.teacherId || null,
      },
      update: {
        subjectId: dto.subjectId || null,
        topicCovered: dto.topicCovered || null,
        notes: dto.notes || null,
        markedById: actor.teacherId || null,
      },
    });

    const absentStudentIds: string[] = [];

    for (const rec of studentRecords) {
      const status = (rec.status || 'PRESENT').toUpperCase();
      if (status === 'ABSENT') absentStudentIds.push(rec.studentId);

      await this.prisma.attendanceRecord.upsert({
        where: {
          attendanceId_studentId: {
            attendanceId: attendanceSession.id,
            studentId: rec.studentId,
          },
        },
        create: {
          attendanceId: attendanceSession.id,
          studentId: rec.studentId,
          status,
          remarks: rec.remarks || null,
          checkInTime: rec.checkInTime || '09:00 AM',
        },
        update: {
          status,
          remarks: rec.remarks || null,
          checkInTime: rec.checkInTime || '09:00 AM',
        },
      });
    }

    // Notify absent students and their parents
    if (absentStudentIds.length > 0) {
      const absentStudents = await this.prisma.student.findMany({
        where: { id: { in: absentStudentIds } },
        include: {
          user: true,
          parents: { include: { parent: true } },
        },
      });
      const notifyIds: string[] = [];
      for (const s of absentStudents) {
        notifyIds.push(s.userId);
        s.parents.forEach((p) => notifyIds.push(p.parent.userId));
      }
      await this.notifications.createBulkNotifications(notifyIds, {
        type: 'ATTENDANCE',
        title: `Attendance Update (${dateString})`,
        message: `Marked ABSENT for class session on ${dateString}.`,
        link: '/attendance',
      });
    }

    await this.auditLogs.record({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'ATTENDANCE_MARKED',
      entity: 'Attendance',
      entityId: attendanceSession.id,
      metadata: { classBatchId: dto.classBatchId, dateString, count: studentRecords.length },
    });

    return this.getSessionByClassAndDate(dto.classBatchId, dateString);
  }

  async getSessionByClassAndDate(classBatchId: string, dateString: string) {
    const cleanDate = dateString.split('T')[0];
    const session = await this.prisma.attendance.findUnique({
      where: {
        classBatchId_dateString: {
          classBatchId,
          dateString: cleanDate,
        },
      },
      include: {
        classBatch: true,
        subject: true,
        records: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
              },
            },
          },
        },
      },
    });

    if (session) return session;

    // Return roster template if not marked yet for that date
    const enrolled = await this.prisma.classStudent.findMany({
      where: { classBatchId, status: 'ACTIVE' },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { rollNumber: 'asc' },
    });

    return {
      id: null,
      classBatchId,
      dateString: cleanDate,
      isMarked: false,
      records: enrolled.map((e) => ({
        studentId: e.studentId,
        status: 'PRESENT',
        remarks: '',
        student: e.student,
      })),
    };
  }

  async getAttendanceList(
    query: {
      classBatchId?: string;
      studentId?: string;
      startDate?: string;
      endDate?: string;
      month?: string; // YYYY-MM
    },
    actor: AuthenticatedUser,
  ) {
    let targetStudentId = query.studentId;

    if (actor.role === 'STUDENT') {
      targetStudentId = actor.studentId;
    } else if (actor.role === 'PARENT') {
      const links = await this.prisma.parentStudent.findMany({
        where: { parentId: actor.parentId },
      });
      const allowedIds = links.map((l) => l.studentId);
      if (targetStudentId && !allowedIds.includes(targetStudentId)) {
        throw new ForbiddenException('Parents can only view attendance for their linked children');
      }
      if (!targetStudentId && allowedIds.length > 0) {
        targetStudentId = allowedIds[0];
      }
    }

    if (targetStudentId) {
      const whereRecord: any = { studentId: targetStudentId };
      if (query.month) {
        whereRecord.attendance = { dateString: { startsWith: query.month } };
      } else if (query.startDate && query.endDate) {
        whereRecord.attendance = {
          dateString: { gte: query.startDate, lte: query.endDate },
        };
      }

      const records = await this.prisma.attendanceRecord.findMany({
        where: whereRecord,
        orderBy: { attendance: { date: 'desc' } },
        include: {
          attendance: {
            include: {
              classBatch: { select: { id: true, name: true, code: true } },
              subject: { select: { id: true, name: true, color: true } },
            },
          },
        },
      });

      const total = records.length;
      const present = records.filter((r) => r.status === 'PRESENT').length;
      const late = records.filter((r) => r.status === 'LATE').length;
      const excused = records.filter((r) => r.status === 'EXCUSED').length;
      const absent = records.filter((r) => r.status === 'ABSENT').length;
      const percentage = total > 0 ? Number((((present + late) / total) * 100).toFixed(1)) : 100;

      // Group by month
      const monthlySummary: Record<string, { present: number; absent: number; total: number; percentage: number }> = {};
      for (const r of records) {
        const m = r.attendance.dateString.slice(0, 7);
        if (!monthlySummary[m]) {
          monthlySummary[m] = { present: 0, absent: 0, total: 0, percentage: 0 };
        }
        monthlySummary[m].total += 1;
        if (r.status === 'PRESENT' || r.status === 'LATE') monthlySummary[m].present += 1;
        if (r.status === 'ABSENT') monthlySummary[m].absent += 1;
      }
      for (const m of Object.keys(monthlySummary)) {
        const ms = monthlySummary[m];
        ms.percentage = ms.total > 0 ? Number(((ms.present / ms.total) * 100).toFixed(1)) : 0;
      }

      return {
        studentId: targetStudentId,
        summary: { total, present, late, excused, absent, percentage },
        monthlySummary,
        records,
      };
    }

    // Class / Admin view
    const whereSession: any = {};
    if (query.classBatchId) whereSession.classBatchId = query.classBatchId;
    if (query.month) whereSession.dateString = { startsWith: query.month };
    if (query.startDate && query.endDate) {
      whereSession.dateString = { gte: query.startDate, lte: query.endDate };
    }

    const sessions = await this.prisma.attendance.findMany({
      where: whereSession,
      orderBy: { date: 'desc' },
      take: 50,
      include: {
        classBatch: { select: { id: true, name: true, code: true } },
        subject: { select: { id: true, name: true } },
        markedBy: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        records: {
          include: {
            student: {
              include: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
    });

    return {
      sessions: sessions.map((s) => {
        const total = s.records.length;
        const present = s.records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
        const absent = s.records.filter((r) => r.status === 'ABSENT').length;
        return {
          ...s,
          stats: {
            total,
            present,
            absent,
            percentage: total > 0 ? Number(((present / total) * 100).toFixed(1)) : 0,
          },
        };
      }),
    };
  }
}
