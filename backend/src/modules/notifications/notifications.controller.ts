import { Controller, Get, Patch, Param, Query, Sse, MessageEvent, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { Observable, interval, merge, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { NotificationsService } from './notifications.service';
import { RealtimeEventsService } from './realtime-events.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly realtimeEvents: RealtimeEventsService,
    private readonly jwtService: JwtService,
  ) {}

  @Public()
  @Sse('stream')
  @ApiOperation({ summary: 'Real-time Server-Sent Events (SSE) stream for live chat & notifications' })
  streamEvents(@Query('token') token: string): Observable<MessageEvent> {
    if (!token) {
      throw new UnauthorizedException('Missing stream token');
    }

    let userId: string;
    try {
      const decoded = this.jwtService.verify(token, {
        secret: process.env.JWT_ACCESS_SECRET || 'edunexus-dev-access-secret-key-2026-secure-token-32chars',
      });
      userId = decoded.sub || decoded.id;
    } catch {
      throw new UnauthorizedException('Invalid or expired stream token');
    }

    const initialConnected$ = of({
      data: {
        event: 'CONNECTED',
        data: { userId },
        timestamp: new Date().toISOString(),
      },
    } as MessageEvent);

    const heartbeat$ = interval(25000).pipe(
      map(
        () =>
          ({
            data: {
              event: 'HEARTBEAT',
              timestamp: new Date().toISOString(),
            },
          }) as MessageEvent,
      ),
    );

    const userEvents$ = this.realtimeEvents.subscribeForUser(userId);
    return merge(initialConnected$, userEvents$, heartbeat$);
  }

  @Get()
  @ApiOperation({ summary: 'Get current user notifications and unread badge count' })
  getMyNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.getMyNotifications(user.id, unreadOnly === 'true');
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  markAsRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.markAsRead(user.id, id);
  }
}
