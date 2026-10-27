import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class AcademicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  // --- COURSES ---
  async getCourses() {
    const courses = await this.prisma.course.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        subjects: true,
        _count: { select: { classes: true } },
      },
    });
    return courses.map((c) => ({
      ...c,
      features: JSON.parse(c.featuresJson || '[]'),
    }));
  }

  async createCourse(dto: any, actor: AuthenticatedUser) {
    const code = dto.code || `CRS-${Date.now().toString().slice(-4)}`;
    return this.prisma.course.create({
      data: {
        name: dto.name,
        code,
        description: dto.description || '',
        duration: dto.duration || '1 Year',
        targetGrade: dto.targetGrade || 'Class 12',
        category: dto.category || 'Competitive',
        feeSummary: dto.feeSummary || null,
        featuresJson: JSON.stringify(dto.features || []),
        isPublished: dto.isPublished !== false,
      },
    });
  }

  // --- SUBJECTS, CHAPTERS & TOPICS ---
  async getSubjectsHierarchy(courseId?: string) {
    const where: any = {};
    if (courseId) where.courseId = courseId;

    return this.prisma.subject.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        course: { select: { id: true, name: true } },
        chapters: {
          orderBy: { orderIndex: 'asc' },
          include: {
            topics: { orderBy: { orderIndex: 'asc' } },
            _count: { select: { questions: true } },
          },
        },
        _count: { select: { questions: true, tests: true } },
      },
    });
  }

  async createSubject(dto: any) {
    const code = dto.code || `SUB-${Date.now().toString().slice(-4)}`;
    return this.prisma.subject.create({
      data: {
        name: dto.name,
        code,
        description: dto.description || null,
        grade: dto.grade || 'Class 12',
        courseId: dto.courseId || null,
        icon: dto.icon || 'menu_book',
        color: dto.color || '#4f46e5',
      },
    });
  }

  async createChapter(dto: { subjectId: string; name: string; code?: string; orderIndex?: number; description?: string }) {
    return this.prisma.chapter.create({
      data: {
        subjectId: dto.subjectId,
        name: dto.name,
        code: dto.code || null,
        orderIndex: Number(dto.orderIndex || 1),
        description: dto.description || null,
      },
    });
  }

  async createTopic(dto: { chapterId: string; name: string; orderIndex?: number; description?: string }) {
    return this.prisma.topic.create({
      data: {
        chapterId: dto.chapterId,
        name: dto.name,
        orderIndex: Number(dto.orderIndex || 1),
        description: dto.description || null,
      },
    });
  }

  // --- CLASSES / BATCHES ---
  async getClasses(status?: string) {
    const where: any = {};
    if (status) where.status = status;

    return this.prisma.classBatch.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        course: true,
        teachers: {
          include: {
            subject: true,
            teacher: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
              },
            },
          },
        },
        _count: {
          select: { students: true, tests: true, attendances: true },
        },
      },
    });
  }

  async getClassById(id: string) {
    const batch = await this.prisma.classBatch.findUnique({
      where: { id },
      include: {
        course: true,
        teachers: {
          include: {
            subject: true,
            teacher: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
              },
            },
          },
        },
        students: {
          include: {
            student: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true } },
              },
            },
          },
          orderBy: { rollNumber: 'asc' },
        },
        timetableSlots: {
          include: {
            subject: true,
            teacher: {
              include: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
        results: {
          take: 25,
          orderBy: { publishedAt: 'desc' },
          include: {
            student: { include: { user: { select: { firstName: true, lastName: true } } } },
            test: { select: { title: true } },
            subject: { select: { name: true } },
          },
        },
      },
    });
    if (!batch) throw new NotFoundException('Class/Batch not found');
    return batch;
  }

  async createClass(dto: any, actor: AuthenticatedUser) {
    const code = dto.code || `BATCH-${Date.now().toString().slice(-4)}`;
    const created = await this.prisma.classBatch.create({
      data: {
        name: dto.name,
        code,
        description: dto.description || null,
        academicYear: dto.academicYear || '2026-2027',
        courseId: dto.courseId || null,
        grade: dto.grade || 'Class 12',
        room: dto.room || 'Hall 101',
        capacity: Number(dto.capacity || 40),
        scheduleSummary: dto.scheduleSummary || 'Mon - Sat • 9:00 AM - 1:00 PM',
        status: dto.status || 'ACTIVE',
      },
    });

    await this.auditLogs.record({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'CLASS_CREATED',
      entity: 'ClassBatch',
      entityId: created.id,
      metadata: { name: created.name, code: created.code },
    });

    return created;
  }

  async updateClass(id: string, dto: any, actor: AuthenticatedUser) {
    const updated = await this.prisma.classBatch.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.academicYear !== undefined ? { academicYear: dto.academicYear } : {}),
        ...(dto.courseId !== undefined ? { courseId: dto.courseId } : {}),
        ...(dto.grade !== undefined ? { grade: dto.grade } : {}),
        ...(dto.room !== undefined ? { room: dto.room } : {}),
        ...(dto.capacity !== undefined ? { capacity: Number(dto.capacity) } : {}),
        ...(dto.scheduleSummary !== undefined ? { scheduleSummary: dto.scheduleSummary } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });

    await this.auditLogs.record({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'CLASS_UPDATED',
      entity: 'ClassBatch',
      entityId: id,
    });

    return updated;
  }

  async addStudentToClass(classBatchId: string, studentId: string, rollNumber?: number) {
    const existing = await this.prisma.classStudent.findUnique({
      where: { classBatchId_studentId: { classBatchId, studentId } },
    });
    if (existing) return existing;

    const count = await this.prisma.classStudent.count({ where: { classBatchId } });
    return this.prisma.classStudent.create({
      data: {
        classBatchId,
        studentId,
        rollNumber: rollNumber || count + 1,
        status: 'ACTIVE',
      },
    });
  }

  async removeStudentFromClass(classBatchId: string, studentId: string) {
    await this.prisma.classStudent.deleteMany({
      where: { classBatchId, studentId },
    });
    return { message: 'Student removed from class batch' };
  }

  async assignTeacherToClass(
    classBatchId: string,
    dto: { teacherId: string; subjectId: string; isPrimaryCoordinator?: boolean },
  ) {
    const existing = await this.prisma.classTeacher.findUnique({
      where: {
        classBatchId_teacherId_subjectId: {
          classBatchId,
          teacherId: dto.teacherId,
          subjectId: dto.subjectId,
        },
      },
    });
    if (existing) return existing;

    return this.prisma.classTeacher.create({
      data: {
        classBatchId,
        teacherId: dto.teacherId,
        subjectId: dto.subjectId,
        isPrimaryCoordinator: Boolean(dto.isPrimaryCoordinator),
      },
    });
  }

  // --- TIMETABLE ---
  async getTimetable(query: { classBatchId?: string; teacherId?: string }, actor: AuthenticatedUser) {
    const where: any = {};
    if (query.classBatchId) where.classBatchId = query.classBatchId;
    if (query.teacherId) where.teacherId = query.teacherId;

    if (actor.role === 'STUDENT' && actor.studentId && !query.classBatchId) {
      const enrollments = await this.prisma.classStudent.findMany({
        where: { studentId: actor.studentId },
      });
      where.classBatchId = { in: enrollments.map((e) => e.classBatchId) };
    } else if (actor.role === 'TEACHER' && actor.teacherId && !query.teacherId && !query.classBatchId) {
      where.teacherId = actor.teacherId;
    }

    return this.prisma.timetableSlot.findMany({
      where,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      include: {
        classBatch: { select: { id: true, name: true, code: true } },
        subject: { select: { id: true, name: true, color: true } },
        teacher: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async createTimetableSlot(dto: any) {
    return this.prisma.timetableSlot.create({
      data: {
        classBatchId: dto.classBatchId,
        subjectId: dto.subjectId,
        teacherId: dto.teacherId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        room: dto.room || 'Room 101',
        topicNote: dto.topicNote || null,
      },
    });
  }

  async deleteTimetableSlot(id: string) {
    await this.prisma.timetableSlot.delete({ where: { id } });
    return { message: 'Timetable slot deleted' };
  }
}
