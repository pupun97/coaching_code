import { Injectable, NgZone, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { ToastService } from './toast.service';

export interface RealtimePacket {
  event: 'NEW_MESSAGE' | 'NEW_NOTIFICATION' | 'TEST_ASSIGNED' | 'TYPING' | 'CONNECTED' | 'HEARTBEAT';
  data?: any;
  timestamp?: string;
}

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private eventSource: EventSource | null = null;
  private reconnectTimer: any = null;

  readonly isConnected = signal<boolean>(false);
  readonly events$ = new Subject<RealtimePacket>();
  readonly incomingMessage$ = new Subject<{ conversationId: string; message: any }>();
  readonly incomingNotification$ = new Subject<any>();
  readonly testAssigned$ = new Subject<any>();
  readonly typingStatus$ = new Subject<{ conversationId: string; userId: string; userName: string; isTyping: boolean }>();

  constructor(
    private readonly auth: AuthService,
    private readonly api: ApiService,
    private readonly toast: ToastService,
    private readonly zone: NgZone,
  ) {}

  connect() {
    const token = this.auth.getAccessToken();
    if (!token) return;
    if (this.eventSource && this.eventSource.readyState !== EventSource.CLOSED) {
      return;
    }

    this.disconnect();

    const streamUrl = `${this.api.baseUrl}/notifications/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(streamUrl);
    this.eventSource = es;

    es.onopen = () => {
      this.zone.run(() => {
        this.isConnected.set(true);
      });
    };

    es.onmessage = (rawEvent) => {
      this.zone.run(() => {
        try {
          const packet: RealtimePacket = JSON.parse(rawEvent.data);
          this.events$.next(packet);

          if (packet.event === 'CONNECTED') {
            this.isConnected.set(true);
          } else if (packet.event === 'NEW_MESSAGE' && packet.data) {
            this.incomingMessage$.next(packet.data);
            const currentUserId = this.auth.currentUser()?.id;
            const sender = packet.data.message?.sender;
            if (sender && sender.id !== currentUserId) {
              this.playNotificationChime();
              this.toast.info(
                `💬 ${sender.firstName} ${sender.lastName}`,
                packet.data.message.content?.slice(0, 80) || 'Sent a new message',
              );
            }
          } else if (packet.event === 'TEST_ASSIGNED' && packet.data) {
            this.testAssigned$.next(packet.data);
            this.playNotificationChime();
            this.toast.success(
              '📝 New Assessment Assigned!',
              packet.data.title || 'A new test has been assigned to you.',
            );
          } else if (packet.event === 'NEW_NOTIFICATION' && packet.data) {
            this.incomingNotification$.next(packet.data);
            if (packet.data.type !== 'MESSAGE' && packet.data.type !== 'TEST_ASSIGNED') {
              this.playNotificationChime();
              this.toast.info(packet.data.title || 'New Notification', packet.data.message || '');
            }
          } else if (packet.event === 'TYPING' && packet.data) {
            this.typingStatus$.next(packet.data);
          }
        } catch {
          // Ignore malformed keep-alive frames
        }
      });
    };

    es.onerror = () => {
      this.zone.run(() => {
        this.isConnected.set(false);
        this.disconnect();
        clearTimeout(this.reconnectTimer);
        if (this.auth.isAuthenticated()) {
          this.reconnectTimer = setTimeout(() => this.connect(), 5000);
        }
      });
    };
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected.set(false);
  }

  private playNotificationChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Browser autoplay policy may block audio before user interaction
    }
  }
}
