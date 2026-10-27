import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginatedResponse, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: PaginationQueryDto & {
      subjectId?: string;
      chapterId?: string;
      topicId?: string;
      difficulty?: string;
      type?: string;
      tag?: string;
      grade?: string;
    },
  ) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };
    if (query.subjectId) where.subjectId = query.subjectId;
    if (query.chapterId) where.chapterId = query.chapterId;
    if (query.topicId) where.topicId = query.topicId;
    if (query.difficulty) where.difficulty = query.difficulty.toUpperCase();
    if (query.type) where.type = query.type;
    if (query.grade) where.grade = query.grade;
    if (query.tag) {
      where.tags = { some: { tag: { contains: query.tag } } };
    }
    if (query.search) {
      where.OR = [
        { questionText: { contains: query.search } },
        { explanation: { contains: query.search } },
        { examType: { contains: query.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: query.sortOrder || 'desc' },
        include: {
          subject: { select: { id: true, name: true, code: true, color: true } },
          chapter: { select: { id: true, name: true } },
          topic: { select: { id: true, name: true } },
          options: { orderBy: { orderIndex: 'asc' } },
          tags: true,
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.question.count({ where }),
    ]);

    const enriched = items.map((q) => ({
      ...q,
      correctPercentage:
        q.attemptCount > 0 ? Number(((q.correctCount / q.attemptCount) * 100).toFixed(1)) : 0,
      tagList: q.tags.map((t) => t.tag),
    }));

    return buildPaginatedResponse(enriched, total, page, limit);
  }

  async findOne(id: string) {
    const q = await this.prisma.question.findUnique({
      where: { id },
      include: {
        subject: true,
        chapter: true,
        topic: true,
        options: { orderBy: { orderIndex: 'asc' } },
        tags: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!q) throw new NotFoundException('Question not found');
    return {
      ...q,
      correctPercentage:
        q.attemptCount > 0 ? Number(((q.correctCount / q.attemptCount) * 100).toFixed(1)) : 0,
      tagList: q.tags.map((t) => t.tag),
    };
  }

  async getOrganizationAndStats() {
    const [subjects, questions] = await Promise.all([
      this.prisma.subject.findMany({
        include: {
          chapters: {
            include: { topics: true },
          },
        },
      }),
      this.prisma.question.findMany({
        where: { isActive: true },
        select: {
          id: true,
          subjectId: true,
          chapterId: true,
          topicId: true,
          difficulty: true,
          type: true,
          timesUsed: true,
          attemptCount: true,
          correctCount: true,
          averageScore: true,
        },
      }),
    ]);

    const difficultyStats = {
      EASY: { count: 0, avgAccuracy: 0 },
      MEDIUM: { count: 0, avgAccuracy: 0 },
      HARD: { count: 0, avgAccuracy: 0 },
    };

    for (const diff of ['EASY', 'MEDIUM', 'HARD'] as const) {
      const subset = questions.filter((q) => q.difficulty === diff);
      difficultyStats[diff].count = subset.length;
      const totalAttempts = subset.reduce((a, b) => a + b.attemptCount, 0);
      const totalCorrect = subset.reduce((a, b) => a + b.correctCount, 0);
      difficultyStats[diff].avgAccuracy =
        totalAttempts > 0 ? Number(((totalCorrect / totalAttempts) * 100).toFixed(1)) : 0;
    }

    const hierarchy = subjects.map((s) => {
      const sQuestions = questions.filter((q) => q.subjectId === s.id);
      return {
        id: s.id,
        name: s.name,
        code: s.code,
        totalQuestions: sQuestions.length,
        chapters: s.chapters.map((c) => {
          const cQuestions = sQuestions.filter((q) => q.chapterId === c.id);
          return {
            id: c.id,
            name: c.name,
            totalQuestions: cQuestions.length,
            topics: c.topics.map((t) => {
              const tQuestions = cQuestions.filter((q) => q.topicId === t.id);
              return {
                id: t.id,
                name: t.name,
                totalQuestions: tQuestions.length,
                byDifficulty: {
                  EASY: tQuestions.filter((q) => q.difficulty === 'EASY').length,
                  MEDIUM: tQuestions.filter((q) => q.difficulty === 'MEDIUM').length,
                  HARD: tQuestions.filter((q) => q.difficulty === 'HARD').length,
                },
              };
            }),
          };
        }),
      };
    });

    return {
      totalQuestions: questions.length,
      difficultyStats,
      hierarchy,
    };
  }

  private validateQuestionInput(dto: any) {
    if (!dto.questionText || !dto.questionText.trim()) {
      throw new BadRequestException('Question text is required');
    }
    if (!dto.subjectId) {
      throw new BadRequestException('Subject ID is required');
    }
    const type = dto.type || 'MCQ_SINGLE';
    if (type === 'MCQ_SINGLE' || type === 'MCQ_MULTIPLE') {
      if (!Array.isArray(dto.options) || dto.options.length < 2) {
        throw new BadRequestException('MCQ questions require at least 2 options');
      }
      const hasCorrect = dto.options.some((o: any) => Boolean(o.isCorrect));
      if (!hasCorrect) {
        throw new BadRequestException('At least one option must be marked as correct');
      }
    }
  }

  async create(dto: any, actor: AuthenticatedUser) {
    this.validateQuestionInput(dto);

    const options = Array.isArray(dto.options)
      ? dto.options.map((opt: any, idx: number) => ({
          optionText: String(opt.optionText),
          isCorrect: Boolean(opt.isCorrect),
          orderIndex: idx,
        }))
      : dto.type === 'TRUE_FALSE'
      ? [
          { optionText: 'TRUE', isCorrect: String(dto.correctTextAnswer).toUpperCase() === 'TRUE', orderIndex: 0 },
          { optionText: 'FALSE', isCorrect: String(dto.correctTextAnswer).toUpperCase() !== 'TRUE', orderIndex: 1 },
        ]
      : [];

    const tags: string[] = Array.isArray(dto.tags)
      ? dto.tags.map((t: any) => (typeof t === 'string' ? t.trim() : t.tag)).filter(Boolean)
      : typeof dto.tags === 'string'
      ? dto.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      : [];

    const created = await this.prisma.question.create({
      data: {
        type: dto.type || 'MCQ_SINGLE',
        questionText: dto.questionText.trim(),
        explanation: dto.explanation || null,
        marks: Number(dto.marks ?? 4),
        negativeMarks: Number(dto.negativeMarks ?? 1),
        difficulty: (dto.difficulty || 'MEDIUM').toUpperCase(),
        subjectId: dto.subjectId,
        chapterId: dto.chapterId || null,
        topicId: dto.topicId || null,
        grade: dto.grade || 'Class 12',
        examType: dto.examType || 'JEE / NEET',
        correctTextAnswer: dto.correctTextAnswer || null,
        numericalAnswer:
          dto.numericalAnswer !== undefined && dto.numericalAnswer !== null && dto.numericalAnswer !== ''
            ? Number(dto.numericalAnswer)
            : null,
        numericalTolerance: Number(dto.numericalTolerance ?? 0.01),
        createdById: actor.id,
        options: { create: options },
        tags: {
          create: Array.from(new Set(tags)).map((tag) => ({ tag })),
        },
      },
      include: { options: true, tags: true, subject: true, chapter: true, topic: true },
    });

    return created;
  }

  async update(id: string, dto: any) {
    const existing = await this.prisma.question.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Question not found');

    if (Array.isArray(dto.options)) {
      await this.prisma.questionOption.deleteMany({ where: { questionId: id } });
      await this.prisma.questionOption.createMany({
        data: dto.options.map((opt: any, idx: number) => ({
          questionId: id,
          optionText: String(opt.optionText),
          isCorrect: Boolean(opt.isCorrect),
          orderIndex: idx,
        })),
      });
    }

    if (dto.tags !== undefined) {
      const tags: string[] = Array.isArray(dto.tags)
        ? dto.tags.map((t: any) => (typeof t === 'string' ? t.trim() : t.tag)).filter(Boolean)
        : typeof dto.tags === 'string'
        ? dto.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
        : [];
      await this.prisma.questionTag.deleteMany({ where: { questionId: id } });
      await this.prisma.questionTag.createMany({
        data: Array.from(new Set(tags)).map((tag) => ({ questionId: id, tag })),
      });
    }

    await this.prisma.question.update({
      where: { id },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.questionText !== undefined ? { questionText: dto.questionText } : {}),
        ...(dto.explanation !== undefined ? { explanation: dto.explanation } : {}),
        ...(dto.marks !== undefined ? { marks: Number(dto.marks) } : {}),
        ...(dto.negativeMarks !== undefined ? { negativeMarks: Number(dto.negativeMarks) } : {}),
        ...(dto.difficulty !== undefined ? { difficulty: dto.difficulty.toUpperCase() } : {}),
        ...(dto.subjectId !== undefined ? { subjectId: dto.subjectId } : {}),
        ...(dto.chapterId !== undefined ? { chapterId: dto.chapterId } : {}),
        ...(dto.topicId !== undefined ? { topicId: dto.topicId } : {}),
        ...(dto.grade !== undefined ? { grade: dto.grade } : {}),
        ...(dto.examType !== undefined ? { examType: dto.examType } : {}),
        ...(dto.correctTextAnswer !== undefined ? { correctTextAnswer: dto.correctTextAnswer } : {}),
        ...(dto.numericalAnswer !== undefined ? { numericalAnswer: Number(dto.numericalAnswer) } : {}),
      },
    });

    return this.findOne(id);
  }

  async duplicate(id: string, actor: AuthenticatedUser) {
    const orig = await this.findOne(id);
    return this.create(
      {
        type: orig.type,
        questionText: `${orig.questionText} (Copy)`,
        explanation: orig.explanation,
        marks: orig.marks,
        negativeMarks: orig.negativeMarks,
        difficulty: orig.difficulty,
        subjectId: orig.subjectId,
        chapterId: orig.chapterId,
        topicId: orig.topicId,
        grade: orig.grade,
        examType: orig.examType,
        correctTextAnswer: orig.correctTextAnswer,
        numericalAnswer: orig.numericalAnswer,
        numericalTolerance: orig.numericalTolerance,
        options: orig.options.map((o) => ({ optionText: o.optionText, isCorrect: o.isCorrect })),
        tags: orig.tags.map((t) => t.tag),
      },
      actor,
    );
  }

  async remove(id: string) {
    await this.prisma.question.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Question deleted successfully' };
  }

  async bulkDelete(ids: string[]) {
    if (!Array.isArray(ids) || !ids.length) {
      throw new BadRequestException('Provide an array of question IDs to delete');
    }
    const res = await this.prisma.question.updateMany({
      where: { id: { in: ids } },
      data: { isActive: false },
    });
    return { deletedCount: res.count };
  }

  async bulkImport(
    payload: { subjectId: string; chapterId?: string; topicId?: string; csvContent?: string; questions?: any[] },
    actor: AuthenticatedUser,
  ) {
    const created: any[] = [];
    const errors: { row: number; error: string }[] = [];

    let rows: any[] = [];
    if (Array.isArray(payload.questions) && payload.questions.length > 0) {
      rows = payload.questions;
    } else if (payload.csvContent) {
      // Parse CSV lines: QuestionText,Type,OptionA,OptionB,OptionC,OptionD,CorrectOption(A/B/C/D or number),Marks,NegativeMarks,Difficulty,Explanation
      const lines = payload.csvContent
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const startIdx = lines[0]?.toLowerCase().includes('question') ? 1 : 0;
      for (let i = startIdx; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim());
        const [
          questionText,
          type = 'MCQ_SINGLE',
          optA,
          optB,
          optC,
          optD,
          correctAns = 'A',
          marks = '4',
          negativeMarks = '1',
          difficulty = 'MEDIUM',
          explanation = '',
        ] = cols;

        const upperCorrect = correctAns.toUpperCase();
        rows.push({
          questionText,
          type: type || 'MCQ_SINGLE',
          subjectId: payload.subjectId,
          chapterId: payload.chapterId,
          topicId: payload.topicId,
          marks: Number(marks || 4),
          negativeMarks: Number(negativeMarks || 1),
          difficulty: difficulty || 'MEDIUM',
          explanation,
          numericalAnswer: type === 'NUMERICAL' ? Number(correctAns) : undefined,
          correctTextAnswer: type === 'TRUE_FALSE' || type === 'SHORT_ANSWER' ? correctAns : undefined,
          options:
            type === 'MCQ_SINGLE' || type === 'MCQ_MULTIPLE'
              ? [
                  { optionText: optA, isCorrect: upperCorrect.includes('A') || upperCorrect === '1' },
                  { optionText: optB, isCorrect: upperCorrect.includes('B') || upperCorrect === '2' },
                  ...(optC ? [{ optionText: optC, isCorrect: upperCorrect.includes('C') || upperCorrect === '3' }] : []),
                  ...(optD ? [{ optionText: optD, isCorrect: upperCorrect.includes('D') || upperCorrect === '4' }] : []),
                ]
              : [],
        });
      }
    }

    for (let idx = 0; idx < rows.length; idx++) {
      try {
        const q = await this.create(
          {
            ...rows[idx],
            subjectId: rows[idx].subjectId || payload.subjectId,
            chapterId: rows[idx].chapterId || payload.chapterId,
            topicId: rows[idx].topicId || payload.topicId,
          },
          actor,
        );
        created.push(q);
      } catch (err) {
        errors.push({ row: idx + 1, error: (err as Error).message });
      }
    }

    return {
      importedCount: created.length,
      failedCount: errors.length,
      errors,
      items: created,
    };
  }
}
