import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginatedResponse, PaginationQueryDto } from '../../common/dto/pagination.dto';

export interface CreateAuditLogInput {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action: string;
  entity: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: CreateAuditLogInput) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          userId: input.userId || null,
          userEmail: input.userEmail || null,
          userRole: input.userRole || null,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId || null,
          ipAddress: input.ipAddress || '127.0.0.1',
          userAgent: input.userAgent || null,
          metadataJson: JSON.stringify(input.metadata || {}),
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log [${input.action}]: ${(err as Error).message}`);
      return null;
    }
  }

  async findAll(query: PaginationQueryDto & { action?: string; entity?: string; userId?: string }) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 25);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.action) where.action = query.action;
    if (query.entity) where.entity = query.entity;
    if (query.userId) where.userId = query.userId;
    if (query.search) {
      where.OR = [
        { action: { contains: query.search } },
        { entity: { contains: query.search } },
        { userEmail: { contains: query.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, role: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const formatted = items.map((item) => ({
      ...item,
      metadata: JSON.parse(item.metadataJson || '{}'),
    }));

    return buildPaginatedResponse(formatted, total, page, limit);
  }
}
