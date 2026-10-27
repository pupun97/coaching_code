import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { StudentsService } from '../students/students.service';
import { buildPaginatedResponse, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class ParentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly studentsService: StudentsService,
  ) {}

  async findAll(query: PaginationQueryDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const skip = (page - 1) * limit;

    const where: any = { user: { deletedAt: null } };
    if (query.search) {
      where.OR = [
        { user: { firstName: { contains: query.search } } },
        { user: { lastName: { contains: query.search } } },
        { user: { email: { contains: query.search } } },
        { user: { phone: { contains: query.search } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.parent.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              address: true,
              status: true,
            },
          },
          children: {
            include: {
              student: {
                include: {
                  user: { select: { firstName: true, lastName: true } },
                  enrollments: { include: { classBatch: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.parent.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  async createParent(dto: any, actor: AuthenticatedUser) {
    return this.usersService.create({ ...dto, role: 'PARENT' }, actor);
  }

  async getParentDashboard(actor: AuthenticatedUser, selectedStudentId?: string) {
    if (!actor.parentId) {
      throw new ForbiddenException('Parent profile required');
    }

    const parent = await this.prisma.parent.findUnique({
      where: { id: actor.parentId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        children: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
                enrollments: { include: { classBatch: true } },
              },
            },
          },
        },
      },
    });

    if (!parent) throw new NotFoundException('Parent profile not found');

    const linkedStudents = parent.children.map((c) => c.student);
    if (linkedStudents.length === 0) {
      return {
        parent,
        children: [],
        activeChild: null,
      };
    }

    const targetStudentId = selectedStudentId || linkedStudents[0].id;
    const isLinked = linkedStudents.some((s) => s.id === targetStudentId);
    if (!isLinked) {
      throw new ForbiddenException('Access denied: student is not linked to your parent account');
    }

    const activeChildDetail = await this.studentsService.findOne(targetStudentId, actor);
    const batchIds = activeChildDetail.enrollments.map((e) => e.classBatchId);

    const [upcomingTests, announcements, timetable] = await Promise.all([
      this.prisma.testAssignment.findMany({
        where: {
          OR: [
            { studentId: targetStudentId },
            { classBatchId: { in: batchIds } },
          ],
          test: { status: 'PUBLISHED' },
        },
        include: {
          test: { include: { subject: true } },
        },
        orderBy: { startTime: 'desc' },
        take: 6,
      }),
      this.prisma.announcement.findMany({
        where: {
          isActive: true,
          OR: [
            { targetScope: 'EVERYONE' },
            { targetScope: 'PARENTS' },
            { targetScope: 'CLASS_BATCH', classBatchId: { in: batchIds } },
          ],
        },
        orderBy: { publishDate: 'desc' },
        take: 6,
      }),
      this.prisma.timetableSlot.findMany({
        where: { classBatchId: { in: batchIds } },
        include: {
          subject: true,
          classBatch: { select: { name: true } },
          teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
      }),
    ]);

    return {
      parent,
      children: linkedStudents,
      activeChild: activeChildDetail,
      upcomingTests,
      announcements,
      timetable,
    };
  }
}
