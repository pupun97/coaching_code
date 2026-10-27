import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../providers/email/email.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
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
    return this.prisma.notification.createMany({
      data: uniqueIds.map((userId) => ({
        userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        link: payload.link || null,
      })),
    });
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
