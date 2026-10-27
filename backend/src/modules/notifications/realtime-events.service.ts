import { Injectable, MessageEvent } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface RealtimeEventPayload {
  userId?: string;
  userIds?: string[];
  broadcast?: boolean;
  event: 'NEW_MESSAGE' | 'NEW_NOTIFICATION' | 'TEST_ASSIGNED' | 'TYPING' | 'CONNECTED';
  data: any;
}

@Injectable()
export class RealtimeEventsService {
  private readonly eventBus$ = new Subject<RealtimeEventPayload>();

  emitToUser(userId: string, event: RealtimeEventPayload['event'], data: any) {
    this.eventBus$.next({ userId, event, data });
  }

  emitToUsers(userIds: string[], event: RealtimeEventPayload['event'], data: any) {
    if (!userIds || !userIds.length) return;
    const unique = Array.from(new Set(userIds));
    this.eventBus$.next({ userIds: unique, event, data });
  }

  broadcast(event: RealtimeEventPayload['event'], data: any) {
    this.eventBus$.next({ broadcast: true, event, data });
  }

  subscribeForUser(userId: string): Observable<MessageEvent> {
    return this.eventBus$.asObservable().pipe(
      filter(
        (payload) =>
          Boolean(payload.broadcast) ||
          payload.userId === userId ||
          Boolean(payload.userIds && payload.userIds.includes(userId)),
      ),
      map(
        (payload) =>
          ({
            data: {
              event: payload.event,
              data: payload.data,
              timestamp: new Date().toISOString(),
            },
          }) as MessageEvent,
      ),
    );
  }
}
