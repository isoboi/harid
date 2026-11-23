import { effect, inject, Injectable, Injector, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ChatApi } from './chat-api.service';
import { ChatMessage, ChatSender } from './models';

/**
 * Сокет чата с лавками (/market-chat): только в браузере и только для
 * вошедшего покупателя. Сервер шлёт новые сообщения, «прочитано» и счётчик.
 */
@Injectable({ providedIn: 'root' })
export class ChatSocket {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly auth = inject(AuthService);
  private readonly api = inject(ChatApi);
  private readonly injector = inject(Injector);
  private socket: Socket | null = null;
  private started = false;
  private readonly unread = signal(0);
  readonly unreadTotal = this.unread.asReadonly();
  readonly messages$ = new Subject<{ chat_id: number; message: ChatMessage }>();
  readonly reads$ = new Subject<{ chat_id: number; side: ChatSender }>();
  readonly reconnected$ = new Subject<void>();

  /** Один раз из AppComponent: следит за входом и выходом. */
  start(): void {
    if (this.started || !this.browser) return;
    this.started = true;
    effect(() => {
      const token = this.auth.token();
      this.disconnect();
      if (token) this.connect(token);
    }, { injector: this.injector });
  }

  /** Страница переписки после «прочитано» знает новый итог раньше сокета. */
  setUnread(n: number): void { this.unread.set(n); }

  private connect(token: string): void {
    let connectedOnce = false;
    const s = io(`${environment.socketUrl}/market-chat`, { transports: ['websocket'], auth: { token } });
    s.on('connect', () => {
      if (connectedOnce) this.reconnected$.next();
      connectedOnce = true;
    });
    s.on('chat:message', (e: { chat_id: number; message: ChatMessage }) => this.messages$.next(e));
    s.on('chat:read', (e: { chat_id: number; side: ChatSender }) => this.reads$.next(e));
    s.on('chat:unread', (e: { unread_total: number }) => this.unread.set(Number(e?.unread_total) || 0));
    this.socket = s;
    this.api.unread().subscribe({ next: (r) => this.unread.set(r.unread_total), error: () => undefined });
  }

  private disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.unread.set(0);
  }
}
