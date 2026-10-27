import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class LmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  // --- ANNOUNCEMENTS ---
  async getAnnouncements(actor: AuthenticatedUser) {
    const where: any = { isActive: true };

    if (actor.role === 'STUDENT' && actor.studentId) {
      const enrollments = await this.prisma.classStudent.findMany({
        where: { studentId: actor.studentId },
      });
      const batchIds = enrollments.map((e) => e.classBatchId);
      where.OR = [
        { targetScope: 'EVERYONE' },
        { targetScope: 'STUDENTS' },
        { targetScope: 'CLASS_BATCH', classBatchId: { in: batchIds } },
      ];
    } else if (actor.role === 'PARENT') {
      where.OR = [{ targetScope: 'EVERYONE' }, { targetScope: 'PARENTS' }];
    } else if (actor.role === 'TEACHER') {
      where.OR = [{ targetScope: 'EVERYONE' }, { targetScope: 'TEACHERS' }, { targetScope: 'CLASS_BATCH' }];
    }

    return this.prisma.announcement.findMany({
      where,
      orderBy: { publishDate: 'desc' },
      take: 30,
      include: {
        classBatch: { select: { id: true, name: true } },
        createdBy: { select: { firstName: true, lastName: true, role: true } },
      },
    });
  }

  async createAnnouncement(dto: any, actor: AuthenticatedUser) {
    const created = await this.prisma.announcement.create({
      data: {
        title: dto.title,
        description: dto.description,
        targetScope: dto.targetScope || 'EVERYONE',
        classBatchId: dto.classBatchId || null,
        priority: dto.priority || 'NORMAL',
        attachmentUrl: dto.attachmentUrl || null,
        publishDate: dto.publishDate ? new Date(dto.publishDate) : new Date(),
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        createdById: actor.id,
      },
    });

    await this.auditLogs.record({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'ANNOUNCEMENT_CREATED',
      entity: 'Announcement',
      entityId: created.id,
      metadata: { title: created.title, targetScope: created.targetScope },
    });

    return created;
  }

  async deleteAnnouncement(id: string) {
    await this.prisma.announcement.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Announcement removed' };
  }

  // --- STUDY MATERIALS ---
  async getStudyMaterials(
    query: { classBatchId?: string; subjectId?: string; chapterId?: string },
    actor: AuthenticatedUser,
  ) {
    const where: any = {};
    if (query.classBatchId) where.classBatchId = query.classBatchId;
    if (query.subjectId) where.subjectId = query.subjectId;
    if (query.chapterId) where.chapterId = query.chapterId;

    if (actor.role === 'STUDENT' && actor.studentId) {
      const enrollments = await this.prisma.classStudent.findMany({
        where: { studentId: actor.studentId },
      });
      const batchIds = enrollments.map((e) => e.classBatchId);
      where.OR = [
        { classBatchId: { in: batchIds } },
        { studentId: actor.studentId },
        { classBatchId: null, studentId: null },
      ];
    } else if (actor.role === 'PARENT') {
      where.visibleToParents = true;
    }

    return this.prisma.studyMaterial.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        subject: { select: { id: true, name: true, color: true } },
        classBatch: { select: { id: true, name: true } },
        chapter: { select: { id: true, name: true } },
        topic: { select: { id: true, name: true } },
        uploadedBy: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async createStudyMaterial(dto: any, actor: AuthenticatedUser) {
    return this.prisma.studyMaterial.create({
      data: {
        title: dto.title,
        description: dto.description || null,
        materialType: dto.materialType || 'PDF',
        fileUrl: dto.fileUrl || null,
        externalLink: dto.externalLink || null,
        classBatchId: dto.classBatchId || null,
        subjectId: dto.subjectId,
        chapterId: dto.chapterId || null,
        topicId: dto.topicId || null,
        studentId: dto.studentId || null,
        visibleToParents: dto.visibleToParents !== false,
        uploadedById: actor.id,
      },
      include: { subject: true, classBatch: true },
    });
  }

  async deleteStudyMaterial(id: string) {
    await this.prisma.studyMaterial.delete({ where: { id } });
    return { message: 'Study material deleted' };
  }

  // --- HOMEWORK / ASSIGNMENTS ---
  async getAssignments(
    query: { classBatchId?: string; subjectId?: string; studentId?: string },
    actor: AuthenticatedUser,
  ) {
    const where: any = {};
    if (query.classBatchId) where.classBatchId = query.classBatchId;
    if (query.subjectId) where.subjectId = query.subjectId;

    let studentScopeId = query.studentId;
    if (actor.role === 'STUDENT' && actor.studentId) {
      studentScopeId = actor.studentId;
      const enrollments = await this.prisma.classStudent.findMany({
        where: { studentId: actor.studentId },
      });
      const batchIds = enrollments.map((e) => e.classBatchId);
      where.OR = [
        { classBatchId: { in: batchIds } },
        { studentId: actor.studentId },
      ];
    } else if (actor.role === 'PARENT' && actor.parentId) {
      const links = await this.prisma.parentStudent.findMany({
        where: { parentId: actor.parentId },
      });
      const allowedIds = links.map((l) => l.studentId);
      if (studentScopeId && !allowedIds.includes(studentScopeId)) {
        throw new ForbiddenException('Access denied: student not linked to your parent account');
      }
      if (!studentScopeId && allowedIds.length > 0) {
        studentScopeId = allowedIds[0];
      }
    }

    return this.prisma.assignment.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      include: {
        subject: { select: { id: true, name: true, color: true } },
        classBatch: { select: { id: true, name: true } },
        createdBy: { select: { firstName: true, lastName: true } },
        submissions: studentScopeId
          ? {
              where: { studentId: studentScopeId },
              include: {
                student: { include: { user: { select: { firstName: true, lastName: true } } } },
              },
            }
          : {
              include: {
                student: { include: { user: { select: { firstName: true, lastName: true } } } },
              },
            },
      },
    });
  }

  async createAssignment(dto: any, actor: AuthenticatedUser) {
    return this.prisma.assignment.create({
      data: {
        title: dto.title,
        instructions: dto.instructions,
        classBatchId: dto.classBatchId || null,
        subjectId: dto.subjectId,
        studentId: dto.studentId || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : new Date(Date.now() + 7 * 86400000),
        maxMarks: Number(dto.maxMarks || 20),
        attachmentUrl: dto.attachmentUrl || null,
        status: 'ACTIVE',
        createdById: actor.id,
      },
      include: { subject: true, classBatch: true },
    });
  }

  async submitAssignment(
    assignmentId: string,
    dto: { submissionText?: string; fileUrl?: string },
    actor: AuthenticatedUser,
  ) {
    if (!actor.studentId) throw new ForbiddenException('Only students can submit assignments');

    const assignment = await this.prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const isLate = new Date() > assignment.dueDate;

    return this.prisma.assignmentSubmission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId: actor.studentId,
        },
      },
      create: {
        assignmentId,
        studentId: actor.studentId,
        submissionText: dto.submissionText || null,
        fileUrl: dto.fileUrl || null,
        status: isLate ? 'LATE' : 'SUBMITTED',
      },
      update: {
        submissionText: dto.submissionText || null,
        fileUrl: dto.fileUrl || null,
        status: isLate ? 'LATE' : 'SUBMITTED',
        submittedAt: new Date(),
      },
    });
  }

  async gradeSubmission(
    submissionId: string,
    dto: { marksObtained: number; feedback?: string },
    actor: AuthenticatedUser,
  ) {
    return this.prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        marksObtained: Number(dto.marksObtained),
        feedback: dto.feedback || null,
        status: 'GRADED',
        gradedById: actor.id,
        gradedAt: new Date(),
      },
    });
  }

  // --- TEACHER FEEDBACK ---
  async getFeedbacks(query: { studentId?: string; category?: string }, actor: AuthenticatedUser) {
    const where: any = {};
    if (query.category) where.category = query.category.toUpperCase();

    if (actor.role === 'STUDENT') {
      where.studentId = actor.studentId;
      where.isVisibleToStudent = true;
    } else if (actor.role === 'PARENT') {
      const links = await this.prisma.parentStudent.findMany({
        where: { parentId: actor.parentId },
      });
      const allowedIds = links.map((l) => l.studentId);
      if (query.studentId) {
        if (!allowedIds.includes(query.studentId)) {
          throw new ForbiddenException('Parents can only view feedback for their linked children');
        }
        where.studentId = query.studentId;
      } else {
        where.studentId = { in: allowedIds };
      }
      where.isVisibleToParent = true;
    } else if (query.studentId) {
      where.studentId = query.studentId;
    }

    return this.prisma.teacherFeedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        teacher: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        classBatch: { select: { id: true, name: true } },
      },
    });
  }

  async createFeedback(dto: any, actor: AuthenticatedUser) {
    let teacherId = actor.teacherId;
    if (!teacherId) {
      const firstTeacher = await this.prisma.teacher.findFirst();
      teacherId = firstTeacher?.id;
    }
    if (!teacherId) throw new ForbiddenException('Teacher profile required');

    return this.prisma.teacherFeedback.create({
      data: {
        studentId: dto.studentId,
        teacherId,
        classBatchId: dto.classBatchId || null,
        category: (dto.category || 'ACADEMIC').toUpperCase(),
        rating: Number(dto.rating || 4),
        comment: dto.comment,
        actionPlan: dto.actionPlan || null,
        isVisibleToParent: dto.isVisibleToParent !== false,
        isVisibleToStudent: dto.isVisibleToStudent !== false,
      },
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true } } } },
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
  }
}
