import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { RealtimeEventsService } from './realtime-events.service';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'edunexus-super-secret-jwt-key-2026',
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, RealtimeEventsService],
  exports: [NotificationsService, RealtimeEventsService],
})
export class NotificationsModule {}
