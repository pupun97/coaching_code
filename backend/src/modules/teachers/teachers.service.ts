import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { buildPaginatedResponse, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class TeachersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async findAll(query: PaginationQueryDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const skip = (page - 1) * limit;

    const where: any = { user: { deletedAt: null } };
    if (query.search) {
      where.OR = [
        { employeeCode: { contains: query.search } },
        { specialization: { contains: query.search } },
        { user: { firstName: { contains: query.search } } },
        { user: { lastName: { contains: query.search } } },
        { user: { email: { contains: query.search } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.teacher.findMany({
        where,
        skip,
        take: limit,
        orderBy: { employeeCode: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatarUrl: true,
              status: true,
              lastLoginAt: true,
            },
          },
          classAssignments: {
            include: {
              classBatch: true,
              subject: true,
            },
          },
        },
      }),
      this.prisma.teacher.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  async findOne(id: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,
            address: true,
            status: true,
            createdAt: true,
            lastLoginAt: true,
          },
        },
        classAssignments: {
          include: {
            classBatch: {
              include: { _count: { select: { students: true } } },
            },
            subject: true,
          },
        },
        timetableSlots: {
          include: {
            classBatch: true,
            subject: true,
          },
        },
      },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');
    return teacher;
  }

  async createTeacher(dto: any, actor: AuthenticatedUser) {
    return this.usersService.create({ ...dto, role: 'TEACHER' }, actor);
  }

  async updateTeacher(id: string, dto: any, actor: AuthenticatedUser) {
    const teacher = await this.prisma.teacher.findUnique({ where: { id } });
    if (!teacher) throw new NotFoundException('Teacher not found');

    await this.usersService.update(teacher.userId, dto, actor);

    await this.prisma.teacher.update({
      where: { id },
      data: {
        ...(dto.qualification !== undefined ? { qualification: dto.qualification } : {}),
        ...(dto.experienceYears !== undefined ? { experienceYears: Number(dto.experienceYears) } : {}),
        ...(dto.specialization !== undefined ? { specialization: dto.specialization } : {}),
        ...(dto.shortBio !== undefined ? { shortBio: dto.shortBio } : {}),
        ...(dto.isPublicFeatured !== undefined ? { isPublicFeatured: Boolean(dto.isPublicFeatured) } : {}),
      },
    });

    return this.findOne(id);
  }

  async assignClassAndSubject(
    teacherId: string,
    dto: { classBatchId: string; subjectId: string; isPrimaryCoordinator?: boolean },
    actor: AuthenticatedUser,
  ) {
    const existing = await this.prisma.classTeacher.findUnique({
      where: {
        classBatchId_teacherId_subjectId: {
          classBatchId: dto.classBatchId,
          teacherId,
          subjectId: dto.subjectId,
        },
      },
    });

    if (!existing) {
      await this.prisma.classTeacher.create({
        data: {
          classBatchId: dto.classBatchId,
          teacherId,
          subjectId: dto.subjectId,
          isPrimaryCoordinator: Boolean(dto.isPrimaryCoordinator),
        },
      });
    }

    await this.auditLogs.record({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'TEACHER_ASSIGNED_TO_CLASS',
      entity: 'Teacher',
      entityId: teacherId,
      metadata: dto,
    });

    return this.findOne(teacherId);
  }

  async getTeacherDashboard(actor: AuthenticatedUser) {
    if (!actor.teacherId) throw new ForbiddenException('Teacher profile required');

    const teacher = await this.findOne(actor.teacherId);
    const assignedBatchIds = Array.from(
      new Set(teacher.classAssignments.map((ca) => ca.classBatchId)),
    );

    const [
      totalStudentsInAssignedClasses,
      upcomingTests,
      recentSubmissions,
      pendingSubjectiveAnswers,
      recentAttendances,
      announcements,
      questionsCreatedCount,
    ] = await Promise.all([
      this.prisma.classStudent.count({
        where: { classBatchId: { in: assignedBatchIds }, status: 'ACTIVE' },
      }),
      this.prisma.test.findMany({
        where: {
          OR: [
            { createdById: actor.id },
            { classBatchId: { in: assignedBatchIds } },
          ],
        },
        orderBy: { startTime: 'desc' },
        take: 8,
        include: {
          subject: true,
          classBatch: true,
          _count: { select: { questions: true, attempts: true } },
        },
      }),
      this.prisma.testAttempt.findMany({
        where: {
          status: { in: ['SUBMITTED', 'EVALUATED'] },
          test: {
            OR: [
              { createdById: actor.id },
              { classBatchId: { in: assignedBatchIds } },
            ],
          },
        },
        orderBy: { submittedAt: 'desc' },
        take: 10,
        include: {
          student: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
          test: { select: { id: true, title: true, totalMarks: true } },
        },
      }),
      this.prisma.testAnswer.count({
        where: {
          isEvaluated: false,
          question: { type: { in: ['SHORT_ANSWER', 'LONG_ANSWER'] } },
          attempt: { status: { in: ['SUBMITTED', 'EVALUATED'] } },
        },
      }),
      this.prisma.attendance.findMany({
        where: { classBatchId: { in: assignedBatchIds } },
        orderBy: { date: 'desc' },
        take: 6,
        include: {
          classBatch: { select: { name: true } },
          subject: { select: { name: true } },
          records: true,
        },
      }),
      this.prisma.announcement.findMany({
        where: {
          isActive: true,
          OR: [{ targetScope: 'EVERYONE' }, { targetScope: 'TEACHERS' }],
        },
        orderBy: { publishDate: 'desc' },
        take: 5,
      }),
      this.prisma.question.count({ where: { createdById: actor.id } }),
    ]);

    return {
      teacher,
      stats: {
        assignedClassesCount: assignedBatchIds.length,
        totalStudentsCount: totalStudentsInAssignedClasses,
        questionsCreatedCount,
        pendingEvaluationsCount: pendingSubjectiveAnswers,
        upcomingTestsCount: upcomingTests.length,
      },
      upcomingTests,
      recentSubmissions,
      recentAttendances,
      announcements,
    };
  }
}
