import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeEventsService } from '../notifications/realtime-events.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeEventsService,
  ) {}

  async getMyConversations(actor: AuthenticatedUser, search?: string) {
    const where: any = {
      participants: { some: { userId: actor.id } },
    };
    if (search) {
      where.OR = [
        { subject: { contains: search } },
        {
          participants: {
            some: {
              user: {
                OR: [
                  { firstName: { contains: search } },
                  { lastName: { contains: search } },
                  { email: { contains: search } },
                ],
              },
            },
          },
        },
      ];
    }

    const conversations = await this.prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                avatarUrl: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: conv.id,
            senderId: { not: actor.id },
            isRead: false,
          },
        });
        const otherParticipants = conv.participants
          .map((p) => p.user)
          .filter((u) => u.id !== actor.id);

        return {
          ...conv,
          otherParticipants,
          lastMessage: conv.messages[0] || null,
          unreadCount,
        };
      }),
    );

    return enriched;
  }

  async getConversationMessages(conversationId: string, actor: AuthenticatedUser) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                avatarUrl: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!conv) throw new NotFoundException('Conversation not found');

    const isParticipant = conv.participants.some((p) => p.userId === actor.id);
    if (!isParticipant && actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    // Mark incoming messages as read
    await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: actor.id },
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });

    return conv;
  }

  async sendMessage(
    dto: {
      conversationId?: string;
      recipientUserId?: string;
      subject?: string;
      studentContextId?: string;
      content: string;
      attachmentUrl?: string;
      attachmentName?: string;
    },
    actor: AuthenticatedUser,
  ) {
    if (!dto.content || !dto.content.trim()) {
      throw new BadRequestException('Message content cannot be empty');
    }

    let conversationId = dto.conversationId;

    if (!conversationId) {
      if (!dto.recipientUserId) {
        throw new BadRequestException('Either conversationId or recipientUserId is required');
      }

      const recipient = await this.prisma.user.findUnique({
        where: { id: dto.recipientUserId },
      });
      if (!recipient) throw new NotFoundException('Recipient user not found');

      // Enforce communication privacy matrix
      if (actor.role === 'PARENT') {
        if (recipient.role !== 'TEACHER' && recipient.role !== 'ADMIN' && recipient.role !== 'SUPER_ADMIN') {
          throw new ForbiddenException('Parents may only message Teachers or Administrators');
        }
        if (dto.studentContextId) {
          const link = await this.prisma.parentStudent.findFirst({
            where: { parentId: actor.parentId, studentId: dto.studentContextId },
          });
          if (!link) {
            throw new ForbiddenException('Parents can only message regarding their linked children');
          }
        }
      } else if (actor.role === 'STUDENT') {
        if (recipient.role !== 'TEACHER' && recipient.role !== 'ADMIN' && recipient.role !== 'SUPER_ADMIN') {
          throw new ForbiddenException('Students may only message Teachers or Administrators');
        }
      }

      const conv = await this.prisma.conversation.create({
        data: {
          subject: dto.subject || `Chat with ${recipient.firstName} ${recipient.lastName}`,
          studentContextId: dto.studentContextId || actor.studentId || null,
          participants: {
            create: [{ userId: actor.id }, { userId: recipient.id }],
          },
        },
      });
      conversationId = conv.id;
    } else {
      const conv = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { participants: true },
      });
      if (!conv) throw new NotFoundException('Conversation not found');
      const isParticipant = conv.participants.some((p) => p.userId === actor.id);
      if (!isParticipant) {
        throw new ForbiddenException('You are not a participant in this conversation');
      }
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: actor.id,
        content: dto.content.trim(),
        attachmentUrl: dto.attachmentUrl || null,
        attachmentName: dto.attachmentName || null,
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true },
        },
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    // Notify other participants
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: actor.id } },
    });
    const recipientIds = participants.map((p) => p.userId);

    // Emit instant real-time NEW_MESSAGE event to recipients and sender
    this.realtime.emitToUsers([...recipientIds, actor.id], 'NEW_MESSAGE', {
      conversationId,
      message,
    });

    await this.notifications.createBulkNotifications(
      recipientIds,
      {
        type: 'MESSAGE',
        title: `New Message from ${actor.firstName} ${actor.lastName}`,
        message: dto.content.slice(0, 100),
        link: '/messages',
      },
    );

    return message;
  }

  async emitTyping(conversationId: string, isTyping: boolean, actor: AuthenticatedUser) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: actor.id } },
    });
    const recipientIds = participants.map((p) => p.userId);
    this.realtime.emitToUsers(recipientIds, 'TYPING', {
      conversationId,
      userId: actor.id,
      userName: `${actor.firstName} ${actor.lastName}`,
      isTyping,
    });
    return { ok: true };
  }

  async getAvailableContacts(actor: AuthenticatedUser) {
    let rolesAllowed: string[] = [];
    if (actor.role === 'SUPER_ADMIN' || actor.role === 'ADMIN') {
      rolesAllowed = ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT'];
    } else if (actor.role === 'TEACHER') {
      rolesAllowed = ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT'];
    } else if (actor.role === 'STUDENT' || actor.role === 'PARENT') {
      rolesAllowed = ['SUPER_ADMIN', 'ADMIN', 'TEACHER'];
    }

    return this.prisma.user.findMany({
      where: {
        id: { not: actor.id },
        status: 'ACTIVE',
        deletedAt: null,
        role: { in: rolesAllowed },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        avatarUrl: true,
      },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
      take: 100,
    });
  }
}
