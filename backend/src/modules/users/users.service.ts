import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { buildPaginatedResponse, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async findAll(query: PaginationQueryDto & { role?: string; status?: string }) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.role) where.role = query.role;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search } },
        { lastName: { contains: query.search } },
        { email: { contains: query.search } },
        { username: { contains: query.search } },
        { phone: { contains: query.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: query.sortOrder || 'desc' },
        select: {
          id: true,
          email: true,
          username: true,
          phone: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          address: true,
          dateOfBirth: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          studentProfile: { select: { id: true, studentCode: true, grade: true } },
          teacherProfile: { select: { id: true, employeeCode: true, specialization: true } },
          parentProfile: { select: { id: true, occupation: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        studentProfile: {
          include: {
            enrollments: { include: { classBatch: true } },
            parents: { include: { parent: { include: { user: true } } } },
          },
        },
        teacherProfile: {
          include: {
            classAssignments: { include: { classBatch: true, subject: true } },
          },
        },
        parentProfile: {
          include: {
            children: { include: { student: { include: { user: true } } } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash, ...safe } = user;
    return safe;
  }

  private async generateStudentCode(): Promise<string> {
    const count = await this.prisma.student.count();
    const year = new Date().getFullYear();
    return `EDU-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private async generateEmployeeCode(): Promise<string> {
    const count = await this.prisma.teacher.count();
    const year = new Date().getFullYear();
    return `TCH-${year}-${String(count + 1).padStart(3, '0')}`;
  }

  async create(dto: any, actor: AuthenticatedUser) {
    const email = dto.email.trim().toLowerCase();
    const username = (dto.username || email.split('@')[0] + Math.floor(Math.random() * 1000)).trim().toLowerCase();

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      throw new ConflictException('A user with this email or username already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password || 'Welcome@123', 10);
    const role = dto.role || 'STUDENT';

    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        phone: dto.phone || null,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        address: dto.address || null,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        role,
        status: dto.status || 'ACTIVE',
        emailVerified: true,
      },
    });

    if (role === 'STUDENT') {
      const studentCode = await this.generateStudentCode();
      const student = await this.prisma.student.create({
        data: {
          userId: user.id,
          studentCode,
          grade: dto.grade || 'Class 12',
          academicYear: dto.academicYear || '2026-2027',
          targetExam: dto.targetExam || 'JEE / NEET',
          schoolName: dto.schoolName || null,
        },
      });
      if (dto.classBatchId) {
        await this.prisma.classStudent.create({
          data: { classBatchId: dto.classBatchId, studentId: student.id },
        });
      }
    } else if (role === 'TEACHER') {
      const employeeCode = await this.generateEmployeeCode();
      await this.prisma.teacher.create({
        data: {
          userId: user.id,
          employeeCode,
          qualification: dto.qualification || 'M.Sc. / B.Tech',
          experienceYears: Number(dto.experienceYears || 3),
          specialization: dto.specialization || 'General Sciences',
          shortBio: dto.shortBio || null,
        },
      });
    } else if (role === 'PARENT') {
      const parent = await this.prisma.parent.create({
        data: {
          userId: user.id,
          occupation: dto.occupation || null,
          alternatePhone: dto.alternatePhone || null,
        },
      });
      if (Array.isArray(dto.studentIds)) {
        for (const studentId of dto.studentIds) {
          await this.prisma.parentStudent.create({
            data: { parentId: parent.id, studentId, relationship: dto.relationship || 'Parent' },
          });
        }
      }
    }

    await this.auditLogs.record({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'USER_CREATED',
      entity: 'User',
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
    });

    return this.findOne(user.id);
  }

  async update(id: string, dto: any, actor: AuthenticatedUser) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException('User not found');

    const roleChanged = dto.role && dto.role !== existing.role;

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.dateOfBirth ? { dateOfBirth: new Date(dto.dateOfBirth) } : {}),
      },
    });

    if (roleChanged) {
      await this.auditLogs.record({
        userId: actor.id,
        userEmail: actor.email,
        userRole: actor.role,
        action: 'USER_ROLE_CHANGED',
        entity: 'User',
        entityId: id,
        metadata: { oldRole: existing.role, newRole: dto.role },
      });
    } else {
      await this.auditLogs.record({
        userId: actor.id,
        userEmail: actor.email,
        userRole: actor.role,
        action: 'USER_UPDATED',
        entity: 'User',
        entityId: id,
      });
    }

    const { passwordHash, ...safe } = updated;
    return safe;
  }

  async toggleStatus(id: string, status: 'ACTIVE' | 'INACTIVE', actor: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status },
    });

    await this.auditLogs.record({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: status === 'ACTIVE' ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entity: 'User',
      entityId: id,
    });

    return { id: updated.id, status: updated.status };
  }

  async adminResetPassword(id: string, newPassword: string, actor: AuthenticatedUser) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });

    await this.auditLogs.record({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'ADMIN_PASSWORD_RESET',
      entity: 'User',
      entityId: id,
    });

    return { message: 'User password reset successfully' };
  }

  async softDelete(id: string, actor: AuthenticatedUser) {
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });

    await this.auditLogs.record({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'USER_DELETED',
      entity: 'User',
      entityId: id,
    });

    return { message: 'User deactivated and archived' };
  }
}
