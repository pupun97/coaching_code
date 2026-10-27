import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../providers/email/email.service';
import { RealtimeEventsService } from './realtime-events.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly realtime: RealtimeEventsService,
  ) {}

  async createNotification(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    metadata?: Record<string, any>;
    sendEmail?: boolean;
    userEmail?: string;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link || null,
        metadataJson: JSON.stringify(data.metadata || {}),
      },
    });

    // Push real-time notification event immediately
    this.realtime.emitToUser(data.userId, 'NEW_NOTIFICATION', notification);
    if (data.type === 'TEST_ASSIGNED') {
      this.realtime.emitToUser(data.userId, 'TEST_ASSIGNED', notification);
    }

    if (data.sendEmail && data.userEmail) {
      await this.emailService.sendEmail({
        to: data.userEmail,
        subject: data.title,
        template: 'TEST_ASSIGNED',
        context: { message: data.message, link: data.link },
      });
    }

    return notification;
  }

  async createBulkNotifications(
    userIds: string[],
    payload: { type: string; title: string; message: string; link?: string },
  ) {
    if (!userIds.length) return { count: 0 };
    const uniqueIds = Array.from(new Set(userIds));
    const result = await this.prisma.notification.createMany({
      data: uniqueIds.map((userId) => ({
        userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        link: payload.link || null,
      })),
    });

    const eventPayload = {
      id: `rt-${Date.now()}`,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      link: payload.link || null,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    // Push real-time events to all recipient users
    this.realtime.emitToUsers(uniqueIds, 'NEW_NOTIFICATION', eventPayload);
    if (payload.type === 'TEST_ASSIGNED') {
      this.realtime.emitToUsers(uniqueIds, 'TEST_ASSIGNED', eventPayload);
    }

    return result;
  }

  async getMyNotifications(userId: string, unreadOnly = false) {
    const where: any = { userId };
    if (unreadOnly) where.isRead = false;

    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { items, unreadCount };
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}
