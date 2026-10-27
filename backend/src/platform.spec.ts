import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './app.module';

describe('EduNexus Platform — End-to-End RBAC, Security & Core Workflow Tests', () => {
  let app: INestApplication;

  let adminToken: string;
  let teacherToken: string;
  let student1Token: string;
  let student1Id: string;
  let student9Id: string; // Belongs to Parent 5, NOT Parent 1
  let parent1Token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: false,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Authentication & Role Redirects', () => {
    it('authenticates Admin and returns /admin/dashboard redirect', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'admin@edunexus.edu', password: 'Admin@123' })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.redirectUrl).toBe('/admin/dashboard');
      expect(res.body.user.role).toBe('ADMIN');
      adminToken = res.body.accessToken;
    });

    it('authenticates Teacher and returns /teacher/dashboard redirect', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'dr.sharma@edunexus.edu', password: 'Teacher@123' })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.redirectUrl).toBe('/teacher/dashboard');
      teacherToken = res.body.accessToken;
    });

    it('authenticates Student 1 and returns /student/dashboard redirect', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'student1@edunexus.edu', password: 'Student@123' })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.redirectUrl).toBe('/student/dashboard');
      student1Token = res.body.accessToken;
      student1Id = res.body.user.studentProfile.id;
    });

    it('authenticates Parent 1 and returns /parent/dashboard redirect with linked children', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'parent1@edunexus.edu', password: 'Parent@123' })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.redirectUrl).toBe('/parent/dashboard');
      expect(res.body.user.parentProfile.children.length).toBeGreaterThanOrEqual(2);
      parent1Token = res.body.accessToken;
    });

    it('rejects invalid credentials with 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'admin@edunexus.edu', password: 'WrongPassword!' })
        .expect(401);
    });
  });

  describe('2. Strict Role-Based Access Control (RBAC) & Data Privacy', () => {
    it('prevents Student from accessing Teacher Question Bank API (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .get('/api/questions')
        .set('Authorization', `Bearer ${student1Token}`)
        .expect(403);
    });

    it('prevents Student from creating a Test (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .post('/api/tests')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ title: 'Unauthorized Test' })
        .expect(403);
    });

    it('prevents Teacher from accessing Admin-only User Management API (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(403);
    });

    it('prevents Teacher from accessing Admin-only Audit Logs API (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(403);
    });

    it('prevents Parent 1 from accessing unlinked Student 9 data (403 Forbidden)', async () => {
      const studentsRes = await request(app.getHttpServer())
        .get('/api/students?limit=25')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const unlinkedStudent = studentsRes.body.items.find(
        (s: any) => s.studentCode === 'EDU-2026-0009',
      );
      expect(unlinkedStudent).toBeDefined();
      student9Id = unlinkedStudent.id;

      // Parent 1 tries to view Student 9 profile -> must be 403
      await request(app.getHttpServer())
        .get(`/api/students/${student9Id}`)
        .set('Authorization', `Bearer ${parent1Token}`)
        .expect(403);

      // Parent 1 tries to switch dashboard to Student 9 -> must be 403
      await request(app.getHttpServer())
        .get(`/api/parents/my-dashboard?studentId=${student9Id}`)
        .set('Authorization', `Bearer ${parent1Token}`)
        .expect(403);
    });

    it('prevents Student 1 from viewing Student 9 private profile (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .get(`/api/students/${student9Id}`)
        .set('Authorization', `Bearer ${student1Token}`)
        .expect(403);
    });

    it('allows Parent 1 to view linked child Student 1 profile and dashboard', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/parents/my-dashboard?studentId=${student1Id}`)
        .set('Authorization', `Bearer ${parent1Token}`)
        .expect(200);

      expect(res.body.activeChild.id).toBe(student1Id);
    });
  });

  describe('3. End-to-End Assessment, Auto-Save, Auto-Evaluation, Attendance & PDF Workflow', () => {
    let subjectId: string;
    let classBatchId: string;
    let createdQuestionId: string;
    let createdTestId: string;
    let correctOptionId: string;

    it('Teacher creates a new question in the Question Bank', async () => {
      const subjectsRes = await request(app.getHttpServer())
        .get('/api/subjects')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);
      subjectId = subjectsRes.body[0].id;

      const classesRes = await request(app.getHttpServer())
        .get('/api/classes')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);
      classBatchId = classesRes.body.find((c: any) => c.code === 'BATCH-JEE-27A').id;

      const qRes = await request(app.getHttpServer())
        .post('/api/questions')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          type: 'MCQ_SINGLE',
          questionText: 'What is the SI unit of electric potential difference?',
          explanation: 'Volt (Joule per Coulomb) is the SI unit of electric potential difference.',
          marks: 4,
          negativeMarks: 1,
          difficulty: 'EASY',
          subjectId,
          tags: ['electrostatics', 'units'],
          options: [
            { optionText: 'Volt', isCorrect: true },
            { optionText: 'Ampere', isCorrect: false },
            { optionText: 'Ohm', isCorrect: false },
            { optionText: 'Tesla', isCorrect: false },
          ],
        })
        .expect(201);

      createdQuestionId = qRes.body.id;
      correctOptionId = qRes.body.options.find((o: any) => o.isCorrect).id;
      expect(createdQuestionId).toBeDefined();
    });

    it('Teacher creates and assigns a Test to the Student class batch', async () => {
      const tRes = await request(app.getHttpServer())
        .post('/api/tests')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'E2E Verification Quick Quiz',
          subjectId,
          classBatchId,
          durationMinutes: 20,
          passingMarks: 2,
          negativeMarkingEnabled: true,
          answerVisibility: 'IMMEDIATE',
          questionIds: [createdQuestionId],
        })
        .expect(201);

      createdTestId = tRes.body.id;
      expect(tRes.body.totalMarks).toBe(4);
    });

    it('Student starts the test, auto-saves answer, and submits for automatic evaluation', async () => {
      const startRes = await request(app.getHttpServer())
        .post(`/api/tests/${createdTestId}/start`)
        .set('Authorization', `Bearer ${student1Token}`)
        .expect(201);

      expect(startRes.body.attemptId).toBeDefined();
      // Ensure correct answer was stripped from exam payload
      expect(startRes.body.questions[0].options[0].isCorrect).toBeUndefined();

      // Periodic auto-save
      await request(app.getHttpServer())
        .post(`/api/tests/${createdTestId}/autosave`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          attemptId: startRes.body.attemptId,
          timeSpentSeconds: 45,
          answers: [
            {
              questionId: createdQuestionId,
              selectedOptionIds: [correctOptionId],
              isMarkedForReview: false,
            },
          ],
        })
        .expect(201);

      // Submit & evaluate
      const submitRes = await request(app.getHttpServer())
        .post(`/api/tests/${createdTestId}/submit`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          attemptId: startRes.body.attemptId,
          timeSpentSeconds: 60,
        })
        .expect(201);

      expect(submitRes.body.obtainedMarks).toBe(4);
      expect(submitRes.body.percentage).toBe(100);
      expect(submitRes.body.correctCount).toBe(1);
      expect(submitRes.body.isPassed).toBe(true);
    });

    it('Teacher marks attendance and Student/Parent see updated attendance', async () => {
      const today = new Date().toISOString().split('T')[0];
      await request(app.getHttpServer())
        .post('/api/attendance')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          classBatchId,
          subjectId,
          date: today,
          topicCovered: 'Electrostatics Potential & Capacitance',
          markAllPresent: true,
        })
        .expect(201);

      const stuAtt = await request(app.getHttpServer())
        .get('/api/attendance')
        .set('Authorization', `Bearer ${student1Token}`)
        .expect(200);

      expect(stuAtt.body.summary.total).toBeGreaterThan(0);
    });

    it('Generates valid branded PDF documents for Test Paper and Student Progress Report', async () => {
      const pdfPaper = await request(app.getHttpServer())
        .get(`/api/pdf/test-paper/${createdTestId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(pdfPaper.headers['content-type']).toContain('application/pdf');
      expect(pdfPaper.body.toString('utf8', 0, 5)).toBe('%PDF-');

      const pdfReport = await request(app.getHttpServer())
        .get(`/api/pdf/progress-report/${student1Id}`)
        .set('Authorization', `Bearer ${parent1Token}`)
        .expect(200);

      expect(pdfReport.headers['content-type']).toContain('application/pdf');
    });
  });
});
