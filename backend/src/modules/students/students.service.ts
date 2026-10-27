import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { buildPaginatedResponse, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async assertCanAccessStudent(studentId: string, actor: AuthenticatedUser) {
    if (actor.role === 'SUPER_ADMIN' || actor.role === 'ADMIN' || actor.role === 'TEACHER') {
      return true;
    }
    if (actor.role === 'STUDENT') {
      if (actor.studentId !== studentId) {
        throw new ForbiddenException('Students may only access their own academic profile and records');
      }
      return true;
    }
    if (actor.role === 'PARENT') {
      const link = await this.prisma.parentStudent.findFirst({
        where: {
          parentId: actor.parentId || '',
          studentId,
        },
      });
      if (!link) {
        throw new ForbiddenException('Parents may only access records of their linked children');
      }
      return true;
    }
    throw new ForbiddenException('Unauthorized access to student record');
  }

  async findAll(
    query: PaginationQueryDto & { grade?: string; classBatchId?: string; status?: string },
    actor: AuthenticatedUser,
  ) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const skip = (page - 1) * limit;

    const where: any = {
      user: { deletedAt: null },
    };

    if (query.grade) where.grade = query.grade;
    if (query.status) where.user.status = query.status;
    if (query.classBatchId) {
      where.enrollments = { some: { classBatchId: query.classBatchId } };
    }
    if (query.search) {
      where.OR = [
        { studentCode: { contains: query.search } },
        { user: { firstName: { contains: query.search } } },
        { user: { lastName: { contains: query.search } } },
        { user: { email: { contains: query.search } } },
      ];
    }

    // If parent requests list, scope only to linked children
    if (actor.role === 'PARENT') {
      where.parents = { some: { parentId: actor.parentId } };
    }

    const [items, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { studentCode: 'asc' },
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
              dateOfBirth: true,
              status: true,
              lastLoginAt: true,
            },
          },
          enrollments: {
            include: {
              classBatch: {
                include: { course: true },
              },
            },
          },
          parents: {
            include: {
              parent: {
                include: {
                  user: {
                    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
                  },
                },
              },
            },
          },
          _count: {
            select: { results: true, attendanceRecords: true },
          },
        },
      }),
      this.prisma.student.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  async findOne(studentId: string, actor: AuthenticatedUser) {
    await this.assertCanAccessStudent(studentId, actor);

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            username: true,
            phone: true,
            avatarUrl: true,
            address: true,
            dateOfBirth: true,
            status: true,
            createdAt: true,
            lastLoginAt: true,
          },
        },
        enrollments: {
          include: {
            classBatch: {
              include: {
                course: true,
                teachers: {
                  include: {
                    subject: true,
                    teacher: {
                      include: {
                        user: { select: { firstName: true, lastName: true, email: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        parents: {
          include: {
            parent: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
              },
            },
          },
        },
        results: {
          orderBy: { publishedAt: 'desc' },
          take: 20,
          include: {
            test: { select: { id: true, title: true, code: true, totalMarks: true, passingMarks: true } },
            subject: { select: { id: true, name: true, color: true } },
          },
        },
        attendanceRecords: {
          orderBy: { createdAt: 'desc' },
          take: 30,
          include: {
            attendance: {
              include: {
                classBatch: { select: { id: true, name: true } },
                subject: { select: { id: true, name: true } },
              },
            },
          },
        },
        feedbacks: {
          orderBy: { createdAt: 'desc' },
          include: {
            teacher: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        submissions: {
          orderBy: { submittedAt: 'desc' },
          include: {
            assignment: { include: { subject: true } },
          },
        },
      },
    });

    if (!student) throw new NotFoundException('Student not found');

    // Compute Attendance & Performance Summary
    const totalAttendance = student.attendanceRecords.length;
    const presentCount = student.attendanceRecords.filter(
      (r) => r.status === 'PRESENT' || r.status === 'LATE',
    ).length;
    const attendancePercentage =
      totalAttendance > 0 ? Number(((presentCount / totalAttendance) * 100).toFixed(1)) : 100;

    const totalResults = student.results.length;
    const avgPercentage =
      totalResults > 0
        ? Number(
            (
              student.results.reduce((acc, r) => acc + r.percentage, 0) / totalResults
            ).toFixed(1),
          )
        : 0;
    const bestScore =
      totalResults > 0
        ? Math.max(...student.results.map((r) => r.percentage))
        : 0;

    return {
      ...student,
      summary: {
        totalAttendance,
        presentCount,
        attendancePercentage,
        totalTestsTaken: totalResults,
        averagePercentage: avgPercentage,
        bestPercentage: bestScore,
      },
    };
  }

  async createStudent(dto: any, actor: AuthenticatedUser) {
    return this.usersService.create({ ...dto, role: 'STUDENT' }, actor);
  }

  async updateStudent(studentId: string, dto: any, actor: AuthenticatedUser) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    await this.usersService.update(student.userId, dto, actor);

    await this.prisma.student.update({
      where: { id: studentId },
      data: {
        ...(dto.grade !== undefined ? { grade: dto.grade } : {}),
        ...(dto.academicYear !== undefined ? { academicYear: dto.academicYear } : {}),
        ...(dto.targetExam !== undefined ? { targetExam: dto.targetExam } : {}),
        ...(dto.schoolName !== undefined ? { schoolName: dto.schoolName } : {}),
        ...(dto.emergencyContact !== undefined ? { emergencyContact: dto.emergencyContact } : {}),
        ...(dto.bloodGroup !== undefined ? { bloodGroup: dto.bloodGroup } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    if (dto.classBatchId) {
      await this.assignToClass(studentId, dto.classBatchId, actor);
    }

    return this.findOne(studentId, actor);
  }

  async assignToClass(studentId: string, classBatchId: string, actor: AuthenticatedUser) {
    const existing = await this.prisma.classStudent.findUnique({
      where: { classBatchId_studentId: { classBatchId, studentId } },
    });
    if (!existing) {
      await this.prisma.classStudent.create({
        data: { classBatchId, studentId, status: 'ACTIVE' },
      });
    }
    await this.auditLogs.record({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'STUDENT_ASSIGNED_TO_CLASS',
      entity: 'Student',
      entityId: studentId,
      metadata: { classBatchId },
    });
    return { message: 'Student assigned to class batch successfully' };
  }

  async linkParent(
    studentId: string,
    parentId: string,
    relationship = 'Parent',
    actor: AuthenticatedUser,
  ) {
    const existing = await this.prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
    });
    if (!existing) {
      await this.prisma.parentStudent.create({
        data: { parentId, studentId, relationship, isPrimary: true },
      });
    }
    await this.auditLogs.record({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'PARENT_LINKED_TO_STUDENT',
      entity: 'Student',
      entityId: studentId,
      metadata: { parentId, relationship },
    });
    return { message: 'Parent linked to student successfully' };
  }

  async getStudentDashboard(actor: AuthenticatedUser) {
    if (!actor.studentId) throw new ForbiddenException('Student profile not found');
    const studentData = await this.findOne(actor.studentId, actor);

    const batchIds = studentData.enrollments.map((e) => e.classBatchId);

    const [assignedTests, upcomingTimetable, announcements, studyMaterials, assignments] =
      await Promise.all([
        this.prisma.testAssignment.findMany({
          where: {
            OR: [
              { studentId: actor.studentId },
              { classBatchId: { in: batchIds } },
            ],
            test: { status: 'PUBLISHED' },
          },
          orderBy: { startTime: 'desc' },
          include: {
            test: {
              include: {
                subject: true,
                _count: { select: { questions: true } },
              },
            },
            attempts: {
              where: { studentId: actor.studentId },
              orderBy: { attemptNumber: 'desc' },
            },
          },
        }),
        this.prisma.timetableSlot.findMany({
          where: { classBatchId: { in: batchIds } },
          include: {
            subject: true,
            classBatch: { select: { name: true } },
            teacher: {
              include: { user: { select: { firstName: true, lastName: true } } },
            },
          },
          orderBy: { startTime: 'asc' },
        }),
        this.prisma.announcement.findMany({
          where: {
            isActive: true,
            OR: [
              { targetScope: 'EVERYONE' },
              { targetScope: 'STUDENTS' },
              { targetScope: 'CLASS_BATCH', classBatchId: { in: batchIds } },
            ],
          },
          orderBy: { publishDate: 'desc' },
          take: 8,
        }),
        this.prisma.studyMaterial.findMany({
          where: {
            OR: [
              { classBatchId: { in: batchIds } },
              { studentId: actor.studentId },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { subject: true, chapter: true },
        }),
        this.prisma.assignment.findMany({
          where: {
            status: 'ACTIVE',
            OR: [
              { classBatchId: { in: batchIds } },
              { studentId: actor.studentId },
            ],
          },
          orderBy: { dueDate: 'asc' },
          include: {
            subject: true,
            submissions: { where: { studentId: actor.studentId } },
          },
        }),
      ]);

    return {
      student: studentData,
      assignedTests,
      upcomingTimetable,
      announcements,
      studyMaterials,
      assignments,
    };
  }
}
