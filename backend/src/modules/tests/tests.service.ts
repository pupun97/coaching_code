import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { buildPaginatedResponse, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class TestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async findAll(
    query: PaginationQueryDto & { status?: string; subjectId?: string; classBatchId?: string },
    actor: AuthenticatedUser,
  ) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status.toUpperCase();
    if (query.subjectId) where.subjectId = query.subjectId;
    if (query.classBatchId) where.classBatchId = query.classBatchId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { code: { contains: query.search } },
        { description: { contains: query.search } },
      ];
    }

    // If student requests /api/tests, only return published tests assigned to them or their batch
    if (actor.role === 'STUDENT') {
      if (!actor.studentId) throw new ForbiddenException('Student profile required');
      const enrollments = await this.prisma.classStudent.findMany({
        where: { studentId: actor.studentId },
      });
      const batchIds = enrollments.map((e) => e.classBatchId);

      where.status = 'PUBLISHED';
      where.OR = [
        { classBatchId: { in: batchIds } },
        {
          assignments: {
            some: {
              OR: [
                { studentId: actor.studentId },
                { classBatchId: { in: batchIds } },
              ],
            },
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.test.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          subject: { select: { id: true, name: true, code: true, color: true } },
          classBatch: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { questions: true, attempts: true, assignments: true } },
          ...(actor.role === 'STUDENT' && actor.studentId
            ? {
                attempts: {
                  where: { studentId: actor.studentId },
                  orderBy: { attemptNumber: 'desc' },
                },
              }
            : {}),
        },
      }),
      this.prisma.test.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const test = await this.prisma.test.findUnique({
      where: { id },
      include: {
        subject: true,
        classBatch: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        questions: {
          orderBy: { orderIndex: 'asc' },
          include: {
            question: {
              include: {
                options: { orderBy: { orderIndex: 'asc' } },
                chapter: true,
                topic: true,
                tags: true,
              },
            },
          },
        },
        assignments: {
          include: {
            classBatch: { select: { id: true, name: true } },
            student: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
        _count: { select: { attempts: true, results: true } },
      },
    });

    if (!test) throw new NotFoundException('Test not found');

    if (actor.role === 'STUDENT') {
      await this.assertStudentAssignedToTest(test.id, actor.studentId!);
      // Strip correct answers from preview for students
      return {
        ...test,
        questions: test.questions.map((tq) => ({
          ...tq,
          question: {
            id: tq.question.id,
            type: tq.question.type,
            questionText: tq.question.questionText,
            marks: tq.marks,
            negativeMarks: tq.negativeMarks,
            difficulty: tq.question.difficulty,
            options: tq.question.options.map((o) => ({
              id: o.id,
              optionText: o.optionText,
              orderIndex: o.orderIndex,
            })),
          },
        })),
      };
    }

    return test;
  }

  async assertStudentAssignedToTest(testId: string, studentId: string) {
    const enrollments = await this.prisma.classStudent.findMany({
      where: { studentId },
    });
    const batchIds = enrollments.map((e) => e.classBatchId);

    const test = await this.prisma.test.findFirst({
      where: {
        id: testId,
        status: 'PUBLISHED',
        OR: [
          { classBatchId: { in: batchIds } },
          {
            assignments: {
              some: {
                OR: [
                  { studentId },
                  { classBatchId: { in: batchIds } },
                ],
              },
            },
          },
        ],
      },
    });

    if (!test) {
      throw new ForbiddenException('You are not assigned to this test or the test is not published');
    }
    return test;
  }

  async createTest(dto: any, actor: AuthenticatedUser) {
    if (!dto.title || !dto.subjectId) {
      throw new BadRequestException('Test title and subjectId are required');
    }

    let selectedQuestions: { id: string; marks: number; negativeMarks: number }[] = [];

    if (dto.generationMode === 'AUTOMATIC' || dto.autoGenerate) {
      // Automatic Test Generation from Question Bank
      const whereQ: any = {
        isActive: true,
        subjectId: dto.subjectId,
      };
      if (dto.chapterId) whereQ.chapterId = dto.chapterId;
      if (Array.isArray(dto.chapterIds) && dto.chapterIds.length > 0) {
        whereQ.chapterId = { in: dto.chapterIds };
      }
      if (dto.topicId) whereQ.topicId = dto.topicId;
      if (dto.difficulty && dto.difficulty !== 'MIXED') {
        whereQ.difficulty = dto.difficulty.toUpperCase();
      }
      if (Array.isArray(dto.questionTypes) && dto.questionTypes.length > 0) {
        whereQ.type = { in: dto.questionTypes };
      }

      const pool = await this.prisma.question.findMany({ where: whereQ });
      if (pool.length === 0) {
        throw new BadRequestException('No matching questions found in the Question Bank for automatic generation');
      }

      // Shuffle pool and pick requested count
      const count = Math.min(Number(dto.questionCount || 10), pool.length);
      const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, count);

      selectedQuestions = shuffled.map((q) => ({
        id: q.id,
        marks: Number(dto.marksPerQuestion ?? q.marks ?? 4),
        negativeMarks: dto.negativeMarkingEnabled === false ? 0 : Number(q.negativeMarks ?? 1),
      }));
    } else if (Array.isArray(dto.questionIds) && dto.questionIds.length > 0) {
      const dbQuestions = await this.prisma.question.findMany({
        where: { id: { in: dto.questionIds } },
      });
      selectedQuestions = dbQuestions.map((q) => ({
        id: q.id,
        marks: q.marks,
        negativeMarks: dto.negativeMarkingEnabled === false ? 0 : q.negativeMarks,
      }));
    } else if (Array.isArray(dto.questions) && dto.questions.length > 0) {
      selectedQuestions = dto.questions.map((q: any) => ({
        id: q.questionId || q.id,
        marks: Number(q.marks ?? 4),
        negativeMarks: Number(q.negativeMarks ?? 1),
      }));
    }

    const computedTotalMarks =
      selectedQuestions.length > 0
        ? selectedQuestions.reduce((acc, q) => acc + q.marks, 0)
        : Number(dto.totalMarks || 100);

    const code = dto.code || `TST-${Date.now().toString().slice(-6)}`;
    const now = new Date();
    const startTime = dto.startTime ? new Date(dto.startTime) : now;
    const endTime = dto.endTime
      ? new Date(dto.endTime)
      : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const test = await this.prisma.test.create({
      data: {
        title: dto.title,
        code,
        description: dto.description || null,
        instructions:
          dto.instructions ||
          '1. Read all instructions carefully.\n2. Answers are saved automatically.\n3. Click Submit Test when finished.',
        classBatchId: dto.classBatchId || null,
        subjectId: dto.subjectId,
        totalMarks: computedTotalMarks,
        passingMarks: Number(dto.passingMarks ?? Math.round(computedTotalMarks * 0.4)),
        durationMinutes: Number(dto.durationMinutes || 60),
        startTime,
        endTime,
        negativeMarkingEnabled: dto.negativeMarkingEnabled !== false,
        randomizeQuestions: Boolean(dto.randomizeQuestions),
        randomizeOptions: Boolean(dto.randomizeOptions),
        answerVisibility: dto.answerVisibility || 'IMMEDIATE',
        showRankings: Boolean(dto.showRankings),
        maxAttempts: Number(dto.maxAttempts || 1),
        allowLateSubmission: Boolean(dto.allowLateSubmission),
        generationMode: dto.generationMode || (dto.autoGenerate ? 'AUTOMATIC' : 'MANUAL'),
        status: dto.status || 'PUBLISHED',
        createdById: actor.id,
        questions: {
          create: selectedQuestions.map((q, idx) => ({
            questionId: q.id,
            orderIndex: idx + 1,
            marks: q.marks,
            negativeMarks: q.negativeMarks,
          })),
        },
      },
      include: {
        subject: true,
        classBatch: true,
        questions: { include: { question: { include: { options: true } } } },
      },
    });

    // Increment timesUsed on selected questions
    if (selectedQuestions.length > 0) {
      await this.prisma.question.updateMany({
        where: { id: { in: selectedQuestions.map((q) => q.id) } },
        data: { timesUsed: { increment: 1 } },
      });
    }

    // If classBatchId is provided, automatically create a default TestAssignment
    if (test.classBatchId) {
      await this.assignTest(
        test.id,
        {
          classBatchIds: [test.classBatchId],
          startTime: test.startTime.toISOString(),
          endTime: test.endTime.toISOString(),
          durationMinutes: test.durationMinutes,
          maxAttempts: test.maxAttempts,
          passingMarks: test.passingMarks,
          allowLateSubmission: test.allowLateSubmission,
        },
        actor,
      );
    }

    await this.auditLogs.record({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'TEST_CREATED',
      entity: 'Test',
      entityId: test.id,
      metadata: { title: test.title, code: test.code, totalMarks: test.totalMarks },
    });

    return test;
  }

  async publishTest(testId: string, actor: AuthenticatedUser) {
    const test = await this.prisma.test.update({
      where: { id: testId },
      data: { status: 'PUBLISHED' },
    });

    await this.auditLogs.record({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'TEST_PUBLISHED',
      entity: 'Test',
      entityId: test.id,
      metadata: { title: test.title },
    });

    return test;
  }

  async assignTest(
    testId: string,
    dto: {
      classBatchId?: string;
      classBatchIds?: string[];
      studentId?: string;
      studentIds?: string[];
      startTime?: string;
      endTime?: string;
      durationMinutes?: number;
      maxAttempts?: number;
      passingMarks?: number;
      allowLateSubmission?: boolean;
    },
    actor: AuthenticatedUser,
  ) {
    const test = await this.prisma.test.findUnique({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test not found');

    // Ensure test is published when assigned
    if (test.status === 'DRAFT') {
      await this.prisma.test.update({
        where: { id: testId },
        data: { status: 'PUBLISHED' },
      });
    }

    const startTime = dto.startTime ? new Date(dto.startTime) : test.startTime;
    const endTime = dto.endTime ? new Date(dto.endTime) : test.endTime;
    const durationMinutes = Number(dto.durationMinutes || test.durationMinutes);
    const maxAttempts = Number(dto.maxAttempts || test.maxAttempts);
    const passingMarks = Number(dto.passingMarks || test.passingMarks);
    const allowLateSubmission = dto.allowLateSubmission ?? test.allowLateSubmission;

    const batchIds = [
      ...(dto.classBatchId ? [dto.classBatchId] : []),
      ...(Array.isArray(dto.classBatchIds) ? dto.classBatchIds : []),
    ];
    const studentIds = [
      ...(dto.studentId ? [dto.studentId] : []),
      ...(Array.isArray(dto.studentIds) ? dto.studentIds : []),
    ];

    const createdAssignments: any[] = [];
    const notifiedUserIds: string[] = [];

    for (const batchId of Array.from(new Set(batchIds))) {
      const assignment = await this.prisma.testAssignment.create({
        data: {
          testId,
          targetType: 'CLASS_BATCH',
          classBatchId: batchId,
          startTime,
          endTime,
          durationMinutes,
          maxAttempts,
          passingMarks,
          allowLateSubmission,
          assignedById: actor.id,
        },
      });
      createdAssignments.push(assignment);

      const enrolled = await this.prisma.classStudent.findMany({
        where: { classBatchId: batchId },
        include: { student: true },
      });
      enrolled.forEach((e) => notifiedUserIds.push(e.student.userId));
    }

    for (const stuId of Array.from(new Set(studentIds))) {
      const assignment = await this.prisma.testAssignment.create({
        data: {
          testId,
          targetType: 'INDIVIDUAL_STUDENT',
          studentId: stuId,
          startTime,
          endTime,
          durationMinutes,
          maxAttempts,
          passingMarks,
          allowLateSubmission,
          assignedById: actor.id,
        },
      });
      createdAssignments.push(assignment);

      const stu = await this.prisma.student.findUnique({ where: { id: stuId } });
      if (stu) notifiedUserIds.push(stu.userId);
    }

    if (notifiedUserIds.length > 0) {
      await this.notifications.createBulkNotifications(notifiedUserIds, {
        type: 'TEST_ASSIGNED',
        title: `New Assessment Assigned: ${test.title}`,
        message: `You have been assigned "${test.title}" (${durationMinutes} mins, ${test.totalMarks} marks).`,
        link: '/student/tests',
      });
    }

    await this.auditLogs.record({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'TEST_ASSIGNED',
      entity: 'Test',
      entityId: testId,
      metadata: { batchIds, studentIds, assignmentsCount: createdAssignments.length },
    });

    return {
      message: 'Test assigned successfully',
      assignments: createdAssignments,
      notifiedStudentsCount: new Set(notifiedUserIds).size,
    };
  }

  // --- STUDENT EXAM INTERFACE: START / RESUME, AUTO-SAVE & SUBMIT ---
  async startOrResumeAttempt(testId: string, actor: AuthenticatedUser) {
    if (!actor.studentId) {
      throw new ForbiddenException('Only students can start a test attempt');
    }

    await this.assertStudentAssignedToTest(testId, actor.studentId);

    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      include: {
        subject: true,
        questions: {
          orderBy: { orderIndex: 'asc' },
          include: {
            question: {
              include: {
                options: { orderBy: { orderIndex: 'asc' } },
              },
            },
          },
        },
      },
    });
    if (!test) throw new NotFoundException('Test not found');

    // Check if there is an existing IN_PROGRESS attempt to recover
    let attempt = await this.prisma.testAttempt.findFirst({
      where: {
        testId,
        studentId: actor.studentId,
        status: 'IN_PROGRESS',
      },
      include: { answers: true },
    });

    if (!attempt) {
      const completedCount = await this.prisma.testAttempt.count({
        where: { testId, studentId: actor.studentId },
      });

      if (completedCount >= test.maxAttempts) {
        throw new BadRequestException(
          `Maximum allowed attempts (${test.maxAttempts}) reached for this test`,
        );
      }

      attempt = await this.prisma.testAttempt.create({
        data: {
          testId,
          studentId: actor.studentId,
          attemptNumber: completedCount + 1,
          status: 'IN_PROGRESS',
          totalMarks: test.totalMarks,
        },
        include: { answers: true },
      });
    }

    // Prepare sanitized exam paper (no correct answers or explanations leaked!)
    let examQuestions = test.questions.map((tq) => {
      let opts = tq.question.options.map((o) => ({
        id: o.id,
        optionText: o.optionText,
        orderIndex: o.orderIndex,
      }));
      if (test.randomizeOptions) {
        opts = [...opts].sort(() => Math.random() - 0.5);
      }
      return {
        testQuestionId: tq.id,
        questionId: tq.question.id,
        orderIndex: tq.orderIndex,
        type: tq.question.type,
        questionText: tq.question.questionText,
        marks: tq.marks,
        negativeMarks: test.negativeMarkingEnabled ? tq.negativeMarks : 0,
        difficulty: tq.question.difficulty,
        options: opts,
      };
    });

    if (test.randomizeQuestions) {
      examQuestions = [...examQuestions].sort(() => Math.random() - 0.5);
    }

    const savedAnswersMap: Record<string, any> = {};
    for (const ans of attempt.answers) {
      savedAnswersMap[ans.questionId] = {
        questionId: ans.questionId,
        selectedOptionIds: JSON.parse(ans.selectedOptionIdsJson || '[]'),
        textAnswer: ans.textAnswer,
        numericalAnswer: ans.numericalAnswer,
        isMarkedForReview: ans.isMarkedForReview,
        timeSpentSeconds: ans.timeSpentSeconds,
      };
    }

    return {
      attemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      startedAt: attempt.startedAt,
      lastSavedAt: attempt.lastSavedAt,
      timeSpentSeconds: attempt.timeSpentSeconds,
      test: {
        id: test.id,
        title: test.title,
        code: test.code,
        subject: test.subject,
        instructions: test.instructions,
        durationMinutes: test.durationMinutes,
        totalMarks: test.totalMarks,
        passingMarks: test.passingMarks,
        negativeMarkingEnabled: test.negativeMarkingEnabled,
      },
      questions: examQuestions,
      savedAnswers: savedAnswersMap,
    };
  }

  async autoSaveAnswers(
    testId: string,
    dto: {
      attemptId?: string;
      timeSpentSeconds?: number;
      answers: {
        questionId: string;
        selectedOptionIds?: string[];
        textAnswer?: string;
        numericalAnswer?: number | null;
        isMarkedForReview?: boolean;
        timeSpentSeconds?: number;
      }[];
    },
    actor: AuthenticatedUser,
  ) {
    if (!actor.studentId) throw new ForbiddenException('Student profile required');

    const attempt = await this.prisma.testAttempt.findFirst({
      where: {
        ...(dto.attemptId ? { id: dto.attemptId } : { testId, studentId: actor.studentId, status: 'IN_PROGRESS' }),
      },
    });

    if (!attempt || attempt.studentId !== actor.studentId) {
      throw new NotFoundException('Active test attempt not found');
    }
    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Cannot modify answers of an already submitted test attempt');
    }

    if (Array.isArray(dto.answers)) {
      for (const ans of dto.answers) {
        await this.prisma.testAnswer.upsert({
          where: {
            attemptId_questionId: {
              attemptId: attempt.id,
              questionId: ans.questionId,
            },
          },
          create: {
            attemptId: attempt.id,
            questionId: ans.questionId,
            selectedOptionIdsJson: JSON.stringify(ans.selectedOptionIds || []),
            textAnswer: ans.textAnswer ?? null,
            numericalAnswer:
              ans.numericalAnswer !== undefined && ans.numericalAnswer !== null
                ? Number(ans.numericalAnswer)
                : null,
            isMarkedForReview: Boolean(ans.isMarkedForReview),
            timeSpentSeconds: Number(ans.timeSpentSeconds || 0),
          },
          update: {
            selectedOptionIdsJson: JSON.stringify(ans.selectedOptionIds || []),
            textAnswer: ans.textAnswer ?? null,
            numericalAnswer:
              ans.numericalAnswer !== undefined && ans.numericalAnswer !== null
                ? Number(ans.numericalAnswer)
                : null,
            isMarkedForReview: Boolean(ans.isMarkedForReview),
            timeSpentSeconds: Number(ans.timeSpentSeconds || 0),
          },
        });
      }
    }

    const updatedAttempt = await this.prisma.testAttempt.update({
      where: { id: attempt.id },
      data: {
        lastSavedAt: new Date(),
        ...(dto.timeSpentSeconds !== undefined ? { timeSpentSeconds: Number(dto.timeSpentSeconds) } : {}),
      },
    });

    return {
      saved: true,
      attemptId: updatedAttempt.id,
      lastSavedAt: updatedAttempt.lastSavedAt,
    };
  }

  // --- AUTOMATIC EVALUATION ENGINE ---
  async submitAndEvaluateTest(
    testId: string,
    dto: {
      attemptId?: string;
      timeSpentSeconds?: number;
      answers?: {
        questionId: string;
        selectedOptionIds?: string[];
        textAnswer?: string;
        numericalAnswer?: number | null;
        isMarkedForReview?: boolean;
      }[];
    },
    actor: AuthenticatedUser,
  ) {
    if (!actor.studentId) {
      throw new ForbiddenException('Only students can submit a test');
    }

    await this.assertStudentAssignedToTest(testId, actor.studentId);

    // Ensure an active attempt exists (or create one if submitting directly in a single call)
    let attempt = await this.prisma.testAttempt.findFirst({
      where: {
        ...(dto.attemptId
          ? { id: dto.attemptId }
          : { testId, studentId: actor.studentId, status: 'IN_PROGRESS' }),
      },
    });

    if (!attempt) {
      const started = await this.startOrResumeAttempt(testId, actor);
      attempt = await this.prisma.testAttempt.findUnique({ where: { id: started.attemptId } });
    }

    if (!attempt || attempt.studentId !== actor.studentId) {
      throw new NotFoundException('Test attempt not found');
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestException('This test attempt has already been submitted');
    }

    // Save any final answers submitted with the request
    if (Array.isArray(dto.answers) && dto.answers.length > 0) {
      await this.autoSaveAnswers(
        testId,
        {
          attemptId: attempt.id,
          timeSpentSeconds: dto.timeSpentSeconds,
          answers: dto.answers,
        },
        actor,
      );
    }

    // Fetch full test with questions, options, chapters, topics, and saved answers
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      include: {
        subject: true,
        questions: {
          include: {
            question: {
              include: {
                options: true,
                chapter: true,
                topic: true,
              },
            },
          },
        },
      },
    });
    if (!test) throw new NotFoundException('Test not found');

    const savedAnswers = await this.prisma.testAnswer.findMany({
      where: { attemptId: attempt.id },
    });
    const answerByQuestionId = new Map(savedAnswers.map((a) => [a.questionId, a]));

    let obtainedMarks = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;
    let hasPendingSubjective = false;

    const topicBreakdown: Record<string, { correct: number; total: number; percentage: number }> = {};

    for (const tq of test.questions) {
      const q = tq.question;
      const ans = answerByQuestionId.get(q.id);
      const topicName = q.topic?.name || q.chapter?.name || 'General';

      if (!topicBreakdown[topicName]) {
        topicBreakdown[topicName] = { correct: 0, total: 0, percentage: 0 };
      }
      topicBreakdown[topicName].total += 1;

      const selectedIds: string[] = ans ? JSON.parse(ans.selectedOptionIdsJson || '[]') : [];
      const hasObjectiveSelection = selectedIds.length > 0;
      const hasTextAnswer = Boolean(ans?.textAnswer && ans.textAnswer.trim().length > 0);
      const hasNumericalAnswer = ans?.numericalAnswer !== null && ans?.numericalAnswer !== undefined;

      const isAnswered = hasObjectiveSelection || hasTextAnswer || hasNumericalAnswer;

      if (!isAnswered) {
        unansweredCount += 1;
        await this.prisma.testAnswer.upsert({
          where: { attemptId_questionId: { attemptId: attempt.id, questionId: q.id } },
          create: {
            attemptId: attempt.id,
            questionId: q.id,
            isCorrect: false,
            marksAwarded: 0,
            isEvaluated: true,
          },
          update: {
            isCorrect: false,
            marksAwarded: 0,
            isEvaluated: true,
          },
        });
        continue;
      }

      let isCorrect = false;
      let marksAwarded = 0;
      let isEvaluated = true;

      if (q.type === 'MCQ_SINGLE' || q.type === 'MCQ_MULTIPLE') {
        const correctOptionIds = q.options.filter((o) => o.isCorrect).map((o) => o.id).sort();
        const sortedSelected = [...selectedIds].sort();
        isCorrect =
          correctOptionIds.length === sortedSelected.length &&
          correctOptionIds.every((val, idx) => val === sortedSelected[idx]);
      } else if (q.type === 'TRUE_FALSE') {
        const correctOpt = q.options.find((o) => o.isCorrect);
        if (selectedIds.length > 0 && correctOpt) {
          isCorrect = selectedIds[0] === correctOpt.id;
        } else if (hasTextAnswer && q.correctTextAnswer) {
          isCorrect = ans!.textAnswer!.trim().toUpperCase() === q.correctTextAnswer.trim().toUpperCase();
        }
      } else if (q.type === 'NUMERICAL') {
        if (hasNumericalAnswer && q.numericalAnswer !== null) {
          const tolerance = q.numericalTolerance ?? 0.01;
          isCorrect = Math.abs(Number(ans!.numericalAnswer) - Number(q.numericalAnswer)) <= tolerance;
        }
      } else if (q.type === 'SHORT_ANSWER' || q.type === 'LONG_ANSWER') {
        // Subjective questions require teacher grading unless exact reference match
        if (
          q.correctTextAnswer &&
          ans?.textAnswer &&
          ans.textAnswer.trim().toLowerCase() === q.correctTextAnswer.trim().toLowerCase()
        ) {
          isCorrect = true;
          isEvaluated = true;
        } else {
          isEvaluated = false;
          hasPendingSubjective = true;
        }
      }

      if (isEvaluated) {
        if (isCorrect) {
          marksAwarded = tq.marks;
          correctCount += 1;
          topicBreakdown[topicName].correct += 1;
        } else {
          marksAwarded = test.negativeMarkingEnabled ? -Math.abs(tq.negativeMarks) : 0;
          incorrectCount += 1;
        }
        obtainedMarks += marksAwarded;

        // Update question bank statistics
        await this.prisma.question.update({
          where: { id: q.id },
          data: {
            attemptCount: { increment: 1 },
            ...(isCorrect ? { correctCount: { increment: 1 } } : {}),
          },
        });
      }

      await this.prisma.testAnswer.update({
        where: { attemptId_questionId: { attemptId: attempt.id, questionId: q.id } },
        data: {
          isCorrect: isEvaluated ? isCorrect : null,
          marksAwarded,
          isEvaluated,
        },
      });
    }

    for (const key of Object.keys(topicBreakdown)) {
      const tb = topicBreakdown[key];
      tb.percentage = tb.total > 0 ? Number(((tb.correct / tb.total) * 100).toFixed(1)) : 0;
    }

    const finalObtained = Number(Math.max(0, obtainedMarks).toFixed(2));
    const totalQuestions = test.questions.length;
    const answeredCount = correctCount + incorrectCount;
    const accuracy =
      answeredCount > 0 ? Number(((correctCount / answeredCount) * 100).toFixed(1)) : 0;
    const percentage =
      test.totalMarks > 0 ? Number(((finalObtained / test.totalMarks) * 100).toFixed(1)) : 0;
    const isPassed = finalObtained >= test.passingMarks;
    const timeTakenSeconds =
      dto.timeSpentSeconds ||
      Math.max(30, Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000));

    const attemptStatus = hasPendingSubjective ? 'SUBMITTED' : 'EVALUATED';

    const updatedAttempt = await this.prisma.testAttempt.update({
      where: { id: attempt.id },
      data: {
        status: attemptStatus,
        submittedAt: new Date(),
        timeSpentSeconds: timeTakenSeconds,
        totalMarks: test.totalMarks,
        obtainedMarks: finalObtained,
        correctCount,
        incorrectCount,
        unansweredCount,
        accuracy,
        percentage,
        isPassed,
      },
    });

    // Upsert Result record
    const resultRecord = await this.prisma.result.upsert({
      where: { attemptId: attempt.id },
      create: {
        attemptId: attempt.id,
        testId: test.id,
        studentId: actor.studentId,
        classBatchId: test.classBatchId,
        subjectId: test.subjectId,
        totalMarks: test.totalMarks,
        obtainedMarks: finalObtained,
        percentage,
        accuracy,
        correctCount,
        incorrectCount,
        unansweredCount,
        timeTakenSeconds,
        isPassed,
        subjectBreakdownJson: JSON.stringify({
          [test.subject.name]: {
            total: test.totalMarks,
            obtained: finalObtained,
            percentage,
          },
        }),
        topicBreakdownJson: JSON.stringify(topicBreakdown),
      },
      update: {
        obtainedMarks: finalObtained,
        percentage,
        accuracy,
        correctCount,
        incorrectCount,
        unansweredCount,
        timeTakenSeconds,
        isPassed,
        topicBreakdownJson: JSON.stringify(topicBreakdown),
      },
    });

    // Recompute ranks across all results for this test
    await this.recomputeTestRanks(test.id);

    // Notify student
    await this.notifications.createNotification({
      userId: actor.id,
      type: 'RESULT_PUBLISHED',
      title: `Assessment Submitted: ${test.title}`,
      message: `You scored ${finalObtained}/${test.totalMarks} (${percentage}%).`,
      link: `/student/results/${resultRecord.id}`,
    });

    return this.getResultDetail(resultRecord.id, actor);
  }

  private async recomputeTestRanks(testId: string) {
    const allResults = await this.prisma.result.findMany({
      where: { testId },
      orderBy: [{ obtainedMarks: 'desc' }, { timeTakenSeconds: 'asc' }],
    });

    for (let i = 0; i < allResults.length; i++) {
      const rank = i + 1;
      await Promise.all([
        this.prisma.result.update({
          where: { id: allResults[i].id },
          data: { rank },
        }),
        this.prisma.testAttempt.update({
          where: { id: allResults[i].attemptId },
          data: { rank },
        }),
      ]);
    }
  }

  // --- TEACHER SUBJECTIVE EVALUATION ---
  async gradeSubjectiveAnswer(
    attemptId: string,
    dto: { questionId: string; marksAwarded: number; teacherRemarks?: string },
    actor: AuthenticatedUser,
  ) {
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: { test: true, answers: true },
    });
    if (!attempt) throw new NotFoundException('Test attempt not found');

    await this.prisma.testAnswer.update({
      where: {
        attemptId_questionId: {
          attemptId,
          questionId: dto.questionId,
        },
      },
      data: {
        marksAwarded: Number(dto.marksAwarded),
        isCorrect: Number(dto.marksAwarded) > 0,
        isEvaluated: true,
        teacherRemarks: dto.teacherRemarks || null,
        evaluatedById: actor.id,
        evaluatedAt: new Date(),
      },
    });

    // Recalculate attempt totals
    const allAnswers = await this.prisma.testAnswer.findMany({ where: { attemptId } });
    const obtainedMarks = Math.max(
      0,
      allAnswers.reduce((acc, a) => acc + (a.marksAwarded || 0), 0),
    );
    const correctCount = allAnswers.filter((a) => a.isCorrect === true).length;
    const incorrectCount = allAnswers.filter((a) => a.isCorrect === false && a.isEvaluated).length;
    const allEvaluated = allAnswers.every((a) => a.isEvaluated);
    const percentage =
      attempt.totalMarks > 0
        ? Number(((obtainedMarks / attempt.totalMarks) * 100).toFixed(1))
        : 0;

    await this.prisma.testAttempt.update({
      where: { id: attemptId },
      data: {
        obtainedMarks,
        correctCount,
        incorrectCount,
        percentage,
        status: allEvaluated ? 'EVALUATED' : 'SUBMITTED',
        isPassed: obtainedMarks >= attempt.test.passingMarks,
      },
    });

    await this.prisma.result.updateMany({
      where: { attemptId },
      data: {
        obtainedMarks,
        correctCount,
        incorrectCount,
        percentage,
        isPassed: obtainedMarks >= attempt.test.passingMarks,
      },
    });

    await this.recomputeTestRanks(attempt.testId);

    await this.auditLogs.record({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'RESULT_MODIFIED_SUBJECTIVE_GRADING',
      entity: 'TestAttempt',
      entityId: attemptId,
      metadata: dto,
    });

    return { message: 'Subjective response graded and result updated', obtainedMarks, percentage };
  }

  // --- RESULTS ---
  async getResults(
    query: PaginationQueryDto & { studentId?: string; testId?: string; classBatchId?: string; subjectId?: string },
    actor: AuthenticatedUser,
  ) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.testId) where.testId = query.testId;
    if (query.classBatchId) where.classBatchId = query.classBatchId;
    if (query.subjectId) where.subjectId = query.subjectId;

    if (actor.role === 'STUDENT') {
      where.studentId = actor.studentId;
    } else if (actor.role === 'PARENT') {
      const links = await this.prisma.parentStudent.findMany({
        where: { parentId: actor.parentId },
      });
      const allowedIds = links.map((l) => l.studentId);
      if (query.studentId) {
        if (!allowedIds.includes(query.studentId)) {
          throw new ForbiddenException('Access denied: student is not linked to your parent account');
        }
        where.studentId = query.studentId;
      } else {
        where.studentId = { in: allowedIds };
      }
    } else if (query.studentId) {
      where.studentId = query.studentId;
    }

    const [items, total] = await Promise.all([
      this.prisma.result.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: 'desc' },
        include: {
          test: {
            select: {
              id: true,
              title: true,
              code: true,
              totalMarks: true,
              passingMarks: true,
              showRankings: true,
              answerVisibility: true,
            },
          },
          subject: { select: { id: true, name: true, color: true } },
          classBatch: { select: { id: true, name: true } },
          student: {
            include: {
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
        },
      }),
      this.prisma.result.count({ where }),
    ]);

    const formatted = items.map((r) => ({
      ...r,
      rank: r.test.showRankings || actor.role === 'ADMIN' || actor.role === 'SUPER_ADMIN' || actor.role === 'TEACHER' ? r.rank : null,
      subjectBreakdown: JSON.parse(r.subjectBreakdownJson || '{}'),
      topicBreakdown: JSON.parse(r.topicBreakdownJson || '{}'),
    }));

    return buildPaginatedResponse(formatted, total, page, limit);
  }

  async getResultDetail(resultId: string, actor: AuthenticatedUser) {
    const result = await this.prisma.result.findUnique({
      where: { id: resultId },
      include: {
        test: true,
        subject: true,
        classBatch: true,
        student: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        attempt: {
          include: {
            answers: {
              include: {
                question: {
                  include: {
                    options: { orderBy: { orderIndex: 'asc' } },
                    chapter: true,
                    topic: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!result) throw new NotFoundException('Result not found');

    // Verify ownership for Student and Parent
    if (actor.role === 'STUDENT' && result.studentId !== actor.studentId) {
      throw new ForbiddenException('Students can only view their own test results');
    }
    if (actor.role === 'PARENT') {
      const link = await this.prisma.parentStudent.findFirst({
        where: { parentId: actor.parentId, studentId: result.studentId },
      });
      if (!link) {
        throw new ForbiddenException('Parents can only view results of their linked children');
      }
    }

    const now = new Date();
    const canSeeAnswers =
      actor.role === 'SUPER_ADMIN' ||
      actor.role === 'ADMIN' ||
      actor.role === 'TEACHER' ||
      result.test.answerVisibility === 'IMMEDIATE' ||
      (result.test.answerVisibility === 'AFTER_TEST_CLOSE' && result.test.endTime <= now);

    const questionResults = result.attempt.answers.map((ans) => ({
      questionId: ans.questionId,
      questionText: ans.question.questionText,
      type: ans.question.type,
      difficulty: ans.question.difficulty,
      chapter: ans.question.chapter?.name,
      topic: ans.question.topic?.name,
      selectedOptionIds: JSON.parse(ans.selectedOptionIdsJson || '[]'),
      textAnswer: ans.textAnswer,
      numericalAnswer: ans.numericalAnswer,
      isCorrect: ans.isCorrect,
      marksAwarded: ans.marksAwarded,
      maxMarks: ans.question.marks,
      isEvaluated: ans.isEvaluated,
      teacherRemarks: ans.teacherRemarks,
      ...(canSeeAnswers
        ? {
            options: ans.question.options,
            explanation: ans.question.explanation,
            correctTextAnswer: ans.question.correctTextAnswer,
            correctNumericalAnswer: ans.question.numericalAnswer,
          }
        : {
            options: ans.question.options.map((o) => ({
              id: o.id,
              optionText: o.optionText,
              orderIndex: o.orderIndex,
            })),
          }),
    }));

    return {
      ...result,
      rank:
        result.test.showRankings ||
        actor.role === 'SUPER_ADMIN' ||
        actor.role === 'ADMIN' ||
        actor.role === 'TEACHER'
          ? result.rank
          : null,
      canSeeAnswers,
      subjectBreakdown: JSON.parse(result.subjectBreakdownJson || '{}'),
      topicBreakdown: JSON.parse(result.topicBreakdownJson || '{}'),
      questionResults,
    };
  }
}
