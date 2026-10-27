import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { RealtimeEventsService } from './realtime-events.service';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'edunexus-dev-access-secret-key-2026-secure-token-32chars',
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, RealtimeEventsService],
  exports: [NotificationsService, RealtimeEventsService],
})
export class NotificationsModule {}
