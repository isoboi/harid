import { effect, inject, Injectable, Injector, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subject } from 'rxjs';
import type { Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ChatApi } from './chat-api.service';
import { ChatMessage, ChatSender } from './models';

/**
 * Сокет чата с лавками (/market-chat): только в браузере и только для
 * вошедшего покупателя. Сервер шлёт новые сообщения, «прочитано» и счётчик.
 * socket.io-client (~40 КБ) грузится отдельным чанком при первом входе, а не в начальном бандле.
 */
@Injectable({ providedIn: 'root' })
export class ChatSocket {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly auth = inject(AuthService);
  private readonly api = inject(ChatApi);
  private readonly injector = inject(Injector);
  private socket: Socket | null = null;
  /** Номер подключения: ответ import() от прошлого токена (вышел или сменил аккаунт) отбрасывается. */
  private generation = 0;
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
    const gen = this.generation;
    // Счётчик с сервера — сразу, не дожидаясь загрузки библиотеки сокета
    this.api.unread().subscribe({ next: (r) => { if (gen === this.generation) this.unread.set(r.unread_total); }, error: () => undefined });
    import('socket.io-client').then(({ io }) => {
      if (gen !== this.generation) return;
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
    }, (e) => console.error('[harid] не загрузился socket.io-client:', e));
  }

  private disconnect(): void {
    this.generation++;
    this.socket?.disconnect();
    this.socket = null;
    this.unread.set(0);
  }
}
