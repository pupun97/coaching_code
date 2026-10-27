import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting EduNexus database clean & seed (Super Admin Only)...');

  // Clean existing records in reverse dependency order
  await prisma.auditLog.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.publicEnquiry.deleteMany();
  await prisma.teacherFeedback.deleteMany();
  await prisma.assignmentSubmission.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.studyMaterial.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.result.deleteMany();
  await prisma.testAnswer.deleteMany();
  await prisma.testAttempt.deleteMany();
  await prisma.testAssignment.deleteMany();
  await prisma.testQuestion.deleteMany();
  await prisma.test.deleteMany();
  await prisma.questionTag.deleteMany();
  await prisma.questionOption.deleteMany();
  await prisma.question.deleteMany();
  await prisma.timetableSlot.deleteMany();
  await prisma.classStudent.deleteMany();
  await prisma.classTeacher.deleteMany();
  await prisma.classBatch.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.chapter.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.course.deleteMany();
  await prisma.parentStudent.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.student.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();

  // 1. Seed Roles & Permissions
  const rolesData = [
    { name: 'SUPER_ADMIN', displayName: 'Super Administrator', description: 'Full unrestricted platform access', isSystem: true },
    { name: 'ADMIN', displayName: 'Center Manager / Admin', description: 'Manages coaching center operations, users, classes, and reports', isSystem: true },
    { name: 'TEACHER', displayName: 'Faculty / Teacher', description: 'Manages question bank, tests, attendance, materials, and grading', isSystem: true },
    { name: 'STUDENT', displayName: 'Student', description: 'Takes assessments, views analytics, attendance, and study materials', isSystem: true },
    { name: 'PARENT', displayName: 'Parent / Guardian', description: 'Monitors linked children progress, attendance, and communicates with teachers', isSystem: true },
  ];

  const permissionsData = [
    { code: 'users:manage', module: 'Users', description: 'Create, update, deactivate users' },
    { code: 'roles:manage', module: 'Roles', description: 'Create and configure roles and permissions' },
    { code: 'classes:manage', module: 'Classes', description: 'Create and manage batches and timetables' },
    { code: 'questions:manage', module: 'Questions', description: 'Create, import, and edit question bank' },
    { code: 'tests:manage', module: 'Tests', description: 'Create, publish, and assign tests' },
    { code: 'tests:attempt', module: 'Tests', description: 'Take assigned assessments' },
    { code: 'attendance:manage', module: 'Attendance', description: 'Mark and edit class attendance' },
    { code: 'reports:view', module: 'Reports', description: 'Generate and export analytics and PDF reports' },
    { code: 'settings:manage', module: 'Settings', description: 'Configure branding and system settings' },
  ];

  const roleMap: Record<string, string> = {};
  for (const r of rolesData) {
    const created = await prisma.role.create({ data: r });
    roleMap[r.name] = created.id;
  }

  for (const p of permissionsData) {
    const perm = await prisma.permission.create({ data: p });
    await prisma.rolePermission.create({
      data: { roleId: roleMap['SUPER_ADMIN'], permissionId: perm.id },
    });
    if (p.code !== 'settings:manage' && p.code !== 'roles:manage') {
      await prisma.rolePermission.create({
        data: { roleId: roleMap['ADMIN'], permissionId: perm.id },
      });
    }
  }

  // 2. Create ONLY the Super Admin user
  const superAdminPassword = process.env.SUPERADMIN_PASSWORD || 'Welcome@123';
  const superAdminHash = await bcrypt.hash(superAdminPassword, 10);

  const superAdmin = await prisma.user.create({
    data: {
      email: 'superadmin@edunexus.edu',
      username: 'superadmin',
      phone: '+91-9876500001',
      passwordHash: superAdminHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      address: 'Headquarters',
    },
  });

  console.log('✅ Database cleaned and seeded successfully!');
  console.log(`👤 Super Admin created: ${superAdmin.email} / ${superAdminPassword}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
