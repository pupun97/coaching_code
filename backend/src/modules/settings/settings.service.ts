import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async getAllSettings() {
    const rows = await this.prisma.systemSetting.findMany();
    const map: Record<string, any> = {};
    for (const r of rows) {
      try {
        map[r.key] = JSON.parse(r.valueJson);
      } catch {
        map[r.key] = r.valueJson;
      }
    }
    return map;
  }

  async getBranding() {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: 'CENTER_BRANDING' },
    });
    if (!row) {
      return {
        centerName: 'EduNexus Academy of Excellence',
        tagline: 'Where Conceptual Mastery Meets Top-Rank Performance',
        logoText: 'EN',
        primaryColor: '#4f46e5',
        secondaryColor: '#0f172a',
        address: 'Plot 42, 100 Feet Road, Indiranagar, Bengaluru - 560038',
        phone: '+91 80 4567 8900',
        email: 'admissions@edunexus.edu',
        website: 'https://www.edunexus.edu',
        footerText: '© 2026 EduNexus Academy of Excellence. All rights reserved.',
      };
    }
    return JSON.parse(row.valueJson);
  }

  async updateSetting(key: string, value: any, category = 'GENERAL', actor: AuthenticatedUser) {
    const updated = await this.prisma.systemSetting.upsert({
      where: { key },
      create: {
        key,
        valueJson: JSON.stringify(value),
        category,
        updatedById: actor.id,
      },
      update: {
        valueJson: JSON.stringify(value),
        category,
        updatedById: actor.id,
      },
    });

    await this.auditLogs.record({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'SETTINGS_UPDATED',
      entity: 'SystemSetting',
      entityId: key,
      metadata: { key, category },
    });

    return {
      key: updated.key,
      value: JSON.parse(updated.valueJson),
    };
  }

  // --- PUBLIC WEBSITE DATA ---
  async getPublicWebsiteData() {
    const [branding, courses, teachers, announcements, totalStudents, totalTests] =
      await Promise.all([
        this.getBranding(),
        this.prisma.course.findMany({
          where: { isPublished: true },
          include: { subjects: true },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.teacher.findMany({
          where: { isPublicFeatured: true },
          include: {
            user: {
              select: { firstName: true, lastName: true, avatarUrl: true, email: true },
            },
            classAssignments: { include: { subject: true } },
          },
        }),
        this.prisma.announcement.findMany({
          where: { isActive: true, targetScope: 'EVERYONE' },
          orderBy: { publishDate: 'desc' },
          take: 4,
        }),
        this.prisma.student.count(),
        this.prisma.test.count({ where: { status: 'PUBLISHED' } }),
      ]);

    return {
      branding,
      stats: {
        activeStudents: Math.max(totalStudents, 1250),
        expertFaculty: Math.max(teachers.length, 28),
        testsConducted: Math.max(totalTests, 420),
        selectionRate: '94.8%',
      },
      courses: courses.map((c) => ({
        ...c,
        features: JSON.parse(c.featuresJson || '[]'),
      })),
      faculty: teachers.map((t) => ({
        id: t.id,
        name: `${t.user.firstName} ${t.user.lastName}`,
        avatarUrl: t.user.avatarUrl,
        qualification: t.qualification,
        experienceYears: t.experienceYears,
        specialization: t.specialization,
        shortBio: t.shortBio,
        subjects: Array.from(new Set(t.classAssignments.map((ca) => ca.subject.name))),
      })),
      announcements,
    };
  }

  async submitPublicEnquiry(dto: {
    name: string;
    email: string;
    phone: string;
    courseInterest?: string;
    targetGrade?: string;
    message: string;
  }) {
    const created = await this.prisma.publicEnquiry.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        courseInterest: dto.courseInterest || null,
        targetGrade: dto.targetGrade || null,
        message: dto.message,
      },
    });
    return {
      message: 'Thank you! Your enquiry has been recorded. Our academic counselor will reach out shortly.',
      enquiryId: created.id,
    };
  }

  // --- GLOBAL DEBOUNCED SEARCH ---
  async globalSearch(queryText: string, actor: AuthenticatedUser) {
    const q = (queryText || '').trim();
    if (!q || q.length < 2) {
      return { students: [], teachers: [], classes: [], tests: [], questions: [], announcements: [] };
    }

    const isStaff = ['SUPER_ADMIN', 'ADMIN', 'TEACHER'].includes(actor.role);

    const [students, teachers, classes, tests, questions, announcements] = await Promise.all([
      isStaff
        ? this.prisma.student.findMany({
            where: {
              OR: [
                { studentCode: { contains: q } },
                { user: { firstName: { contains: q } } },
                { user: { lastName: { contains: q } } },
                { user: { email: { contains: q } } },
              ],
            },
            take: 5,
            include: { user: { select: { firstName: true, lastName: true, email: true } } },
          })
        : Promise.resolve([]),
      this.prisma.teacher.findMany({
        where: {
          OR: [
            { specialization: { contains: q } },
            { user: { firstName: { contains: q } } },
            { user: { lastName: { contains: q } } },
          ],
        },
        take: 5,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.classBatch.findMany({
        where: {
          OR: [{ name: { contains: q } }, { code: { contains: q } }],
        },
        take: 5,
      }),
      this.prisma.test.findMany({
        where: {
          ...(actor.role === 'STUDENT' ? { status: 'PUBLISHED' } : {}),
          OR: [{ title: { contains: q } }, { code: { contains: q } }],
        },
        take: 5,
        include: { subject: { select: { name: true } } },
      }),
      isStaff
        ? this.prisma.question.findMany({
            where: { isActive: true, questionText: { contains: q } },
            take: 5,
            include: { subject: { select: { name: true } } },
          })
        : Promise.resolve([]),
      this.prisma.announcement.findMany({
        where: {
          isActive: true,
          OR: [{ title: { contains: q } }, { description: { contains: q } }],
        },
        take: 5,
      }),
    ]);

    return { students, teachers, classes, tests, questions, announcements };
  }
}
