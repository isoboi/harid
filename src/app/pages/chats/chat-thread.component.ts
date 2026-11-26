import { Component, computed, DestroyRef, ElementRef, inject, input, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ChatApi } from '../../core/chat-api.service';
import { ChatSocket } from '../../core/chat-socket.service';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/api-error';
import { ChatMessage, ChatSummary } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { ShopAvatarComponent } from '../../shared/shop-avatar.component';
import { ChatBubbleComponent } from './chat-bubble.component';
import { chatDay, chatDayLabel } from './chat-time';

const PAGE = 50;

/** Строка ленты: сообщение, при смене дня — подпись дня, и признак продолжения серии. */
interface Row { message: ChatMessage; day: string | null; grouped: boolean }

/**
 * Переписка с лавкой — экран мессенджера. Сверху всегда видно, с кем разговор (аватар, имя, @ник —
 * ссылка на лавку); лента по дням; снизу поле: Enter отправляет, Shift+Enter — новая строка.
 * На телефоне шапки сайта, вкладок и подвала здесь нет (AppComponent, TabBarComponent).
 */
@Component({
  selector: 'app-chat-thread',
  standalone: true,
  imports: [FormsModule, RouterLink, ChatBubbleComponent, IconComponent, ShopAvatarComponent],
  template: `
    <section class="screen">
      <header class="bar">
        <a class="back" routerLink="/chats" aria-label="Все сообщения"><app-icon name="chevron-left" [size]="24" [stroke]="2" /></a>
        @if (shop(); as s) {
          <a class="who" data-test="thread-shop" [routerLink]="['/shop', s.handle]">
            <app-shop-avatar [name]="s.name" [color]="s.avatar_color" [handle]="s.handle" [size]="40" />
            <span class="who-text">
              <span class="who-name">{{ s.name }}</span>
              <span class="who-handle">&#64;{{ s.handle }} · открыть лавку</span>
            </span>
          </a>
        } @else {
          <!-- Пульс — только пока грузимся; чата нет в списке — остаётся тихая серая плашка -->
          <span class="who who--wait" aria-hidden="true"><span class="ph-ava" [class.skel]="!loaded()"></span><span class="ph-line" [class.skel]="!loaded()"></span></span>
        }
      </header>

      <div class="feed" aria-live="polite">
        @if (hasOlder()) {
          <button type="button" class="older" data-test="older" (click)="older()">Показать предыдущие</button>
        } @else if (loaded() && shop()) {
          @let s = shop()!;
          <div class="intro">
            <app-shop-avatar [name]="s.name" [color]="s.avatar_color" [handle]="s.handle" [size]="64" />
            <p class="intro-name">{{ s.name }}</p>
            <p class="intro-note">Начало переписки с лавкой &#64;{{ s.handle }}. Ответы продавца приходят сюда же.</p>
          </div>
        }
        @if (!loaded()) {
          <!-- Заглушка переписки: пузыри лавки слева и свои справа, как в настоящей ленте -->
          <div class="skel-feed" role="status" data-test="skel-thread">
            <span class="sr-only">Загрузка…</span>
            @for (b of skeleton; track $index) { <span class="skel bubble-skel" aria-hidden="true" [class.mine]="b.mine" [style.width.%]="b.w"></span> }
          </div>
        }
        @for (r of rows(); track r.message.id) {
          @if (r.day) { <p class="day"><span>{{ r.day }}</span></p> }
          <app-chat-bubble [message]="r.message" [grouped]="r.grouped" />
        }
        <span #end class="end"></span>
      </div>

      <div class="dock">
        @if (error()) { <p class="note note--err" role="alert">{{ error() }}</p> }
        @if (failed()) {
          <p class="note note--err">Сообщение не отправлено. <button type="button" class="retry" data-test="retry" (click)="submit()">Повторить</button></p>
        }
        <form class="composer" (ngSubmit)="submit()">
          <label class="sr-only" for="chat-text">Сообщение лавке</label>
          <textarea id="chat-text" name="text" rows="1" maxlength="2000" autocomplete="off" enterkeyhint="send" placeholder="Сообщение"
            [ngModel]="draft()" (ngModelChange)="draft.set($event)" (keydown.enter)="onEnter($event)"></textarea>
          <button class="send" type="submit" aria-label="Отправить" [disabled]="sending() || !draft().trim()">
            <app-icon name="send" [size]="20" [stroke]="2" />
          </button>
        </form>
      </div>
    </section>
  `,
  styles: `
    /* Высота экрана: телефон — весь вьюпорт (шапки сайта нет), шире — минус липкая шапка сайта (69px) */
    .screen { --bar-top: 0px; display: flex; flex-direction: column; max-width: 760px; min-height: 100dvh; margin: 0 auto; background: var(--color-paper) }
    @media (min-width: 641px) { .screen { --bar-top: 69px; min-height: calc(100dvh - 69px); border-inline: 1px solid var(--color-line) } }

    .bar { position: sticky; top: var(--bar-top); z-index: 5; display: flex; align-items: center; gap: 4px; min-height: 64px; padding: 8px 12px 8px 4px; padding-top: max(8px, env(safe-area-inset-top)); border-bottom: 1px solid var(--color-line); background: color-mix(in srgb, var(--color-paper) 96%, transparent); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px) }
    .back { display: grid; place-items: center; flex: none; width: 44px; height: 44px; border-radius: 12px; color: var(--color-ink) }
    .who { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 4px 8px 4px 4px; border-radius: 12px; color: inherit; text-decoration: none }
    @media (hover: hover) { .back:hover, .who:hover { background: var(--color-mist) } }
    .back:active, .who:active { background: var(--color-mist) }
    .who-text { display: flex; flex-direction: column; min-width: 0 }
    .who-name { overflow: hidden; font-size: 16px; font-weight: 700; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap }
    .who-handle { overflow: hidden; font-size: 13px; line-height: 1.3; color: var(--color-ink-soft); text-overflow: ellipsis; white-space: nowrap }
    .ph-ava { width: 46px; height: 46px; border-radius: 50%; background: var(--color-mist) }
    .ph-line { width: 140px; height: 14px; border-radius: 7px; background: var(--color-mist) }
    .skel-feed { display: flex; flex-direction: column }
    .bubble-skel { align-self: flex-start; max-width: 480px; height: 36px; margin-top: 10px; border-radius: 18px 18px 18px 6px }
    .bubble-skel.mine { align-self: flex-end; border-radius: 18px 18px 6px 18px }

    /* Мало сообщений — прижаты к полю ввода, как в мессенджере */
    .feed { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; padding: 12px 16px 8px }
    .older { align-self: center; min-height: 40px; margin-bottom: 4px; padding: 0 16px; border: 1px solid var(--color-line); border-radius: 9999px; background: var(--color-paper); color: var(--color-lapis); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer }
    .intro { display: flex; flex-direction: column; align-items: center; margin: 24px auto 16px; max-width: 34ch; text-align: center }
    .intro-name { margin: 10px 0 2px; font-size: 18px; font-weight: 700 }
    .intro-note { margin: 0; font-size: 14px; line-height: 1.5; color: var(--color-ink-soft); text-wrap: balance }
    .day { display: flex; justify-content: center; margin: 16px 0 4px }
    .day span { padding: 3px 10px; border-radius: 9999px; background: var(--color-mist); font-size: 12px; font-weight: 600; color: var(--color-ink-soft) }
    .end { display: block; height: 1px }

    .dock { position: sticky; bottom: 0; z-index: 5; padding: 8px 12px; padding-bottom: max(8px, env(safe-area-inset-bottom)); border-top: 1px solid var(--color-line); background: var(--color-paper) }
    .note { margin: 0 4px 8px; font-size: 14px }
    .note--err { color: var(--color-anor) }
    .retry { padding: 0; border: 0; background: none; color: var(--color-lapis); font: inherit; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; cursor: pointer }
    .composer { display: flex; align-items: flex-end; gap: 8px }
    /* 16px — иначе iOS увеличивает страницу при фокусе; поле растёт с текстом до ~5 строк */
    .composer textarea { flex: 1; min-height: 44px; max-height: 128px; padding: 11px 16px; border: 1px solid transparent; border-radius: 22px; background: var(--color-mist); color: var(--color-ink); font: inherit; font-size: 16px; line-height: 1.35; resize: none; field-sizing: content; outline: none }
    .composer textarea:focus { border-color: var(--color-lapis); background: var(--color-paper) }
    .composer textarea::placeholder { color: var(--color-ink-soft) }
    .send { display: grid; place-items: center; flex: none; width: 44px; height: 44px; border: 0; border-radius: 50%; background: var(--color-lapis); color: var(--color-on-lapis); cursor: pointer; transition: background-color .15s, opacity .15s }
    .send:not(:disabled):active { background: var(--color-lapis-press) }
    .send:disabled { opacity: .35; cursor: default }
  `,
})
export class ChatThreadComponent implements OnInit {
  private readonly api = inject(ChatApi);
  private readonly socket = inject(ChatSocket);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly end = viewChild<ElementRef<HTMLElement>>('end');
  /** :id из маршрута (withComponentInputBinding). */
  readonly id = input.required<string>();
  readonly messages = signal<ChatMessage[]>([]);
  /** Лавка-собеседник: имя, ник, цвет — из списка чатов. */
  readonly shop = signal<ChatSummary['shop'] | null>(null);
  readonly loaded = signal(false);
  readonly draft = signal('');
  readonly sending = signal(false);
  readonly failed = signal(false);
  readonly error = signal('');
  readonly hasOlder = signal(false);
  /** Пузыри заглушки переписки: чья сторона и ширина. */
  readonly skeleton = [{ mine: false, w: 55 }, { mine: true, w: 40 }, { mine: false, w: 65 }, { mine: true, w: 50 }, { mine: false, w: 35 }];

  /** Подпись дня — у первого сообщения дня; серия — подряд одна сторона в пределах дня. */
  readonly rows = computed<Row[]>(() => {
    let prev: ChatMessage | null = null;
    return this.messages().map((m) => {
      const newDay = !prev || chatDay(prev.created_at) !== chatDay(m.created_at);
      const row = { message: m, day: newDay ? chatDayLabel(m.created_at) : null, grouped: !newDay && prev!.sender === m.sender };
      prev = m;
      return row;
    });
  });

  private get chatId(): number { return Number(this.id()); }

  ngOnInit(): void {
    this.auth.hydrate();
    if (!this.auth.loggedIn()) { this.router.navigateByUrl(`/login?return=/chats/${this.id()}`); return; }
    this.api.list().subscribe({ next: (list) => this.shop.set(list.find((c) => c.id === this.chatId)?.shop ?? null), error: () => undefined });
    this.api.messages(this.chatId).subscribe({
      next: (list) => { this.messages.set(list); this.hasOlder.set(list.length >= PAGE); this.loaded.set(true); this.markRead(); this.scrollToEnd(); },
      error: (e) => { this.loaded.set(true); this.error.set(e?.status === 404 ? 'Чат не найден' : apiErrorMessage(e)); },
    });
    this.socket.messages$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((e) => {
      if (e.chat_id !== this.chatId) return;
      if (this.add([e.message])) { this.scrollToEnd(); if (e.message.sender === 'shop') this.markRead(); }
    });
    // После обрыва связи догружаем то, что пришло, пока сокет был недоступен
    this.socket.reconnected$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const last = this.messages().at(-1)?.id;
      this.api.messages(this.chatId, last ? { after: last } : {}).subscribe((list) => { if (this.add(list)) this.scrollToEnd(); });
    });
  }

  older(): void {
    const first = this.messages()[0]?.id;
    if (!first) return;
    this.api.messages(this.chatId, { before: first }).subscribe((list) => {
      this.add(list);
      this.hasOlder.set(list.length >= PAGE);
    });
  }

  /** Enter — отправить; Shift+Enter и набор через IME — обычный перенос/ввод. */
  onEnter(e: Event): void {
    const k = e as KeyboardEvent;
    if (k.shiftKey || k.isComposing) return;
    k.preventDefault();
    this.submit();
  }

  submit(): void {
    const text = this.draft().trim();
    if (!text || this.sending()) return;
    this.sending.set(true); this.failed.set(false); this.error.set('');
    this.api.send(this.chatId, { text }).subscribe({
      next: (m) => { this.sending.set(false); this.draft.set(''); this.add([m]); this.scrollToEnd(); },
      error: (e) => { this.sending.set(false); this.failed.set(true); if (e?.status === 409) this.error.set(apiErrorMessage(e)); },
    });
  }

  /** Добавляет без дублей (своё сообщение приходит и ответом, и по сокету). true — что-то добавлено. */
  private add(list: ChatMessage[]): boolean {
    const have = new Set(this.messages().map((m) => m.id));
    const fresh = list.filter((m) => !have.has(m.id));
    if (fresh.length) this.messages.update((cur) => [...cur, ...fresh].sort((a, b) => a.id - b.id));
    return fresh.length > 0;
  }

  /** После отрисовки — к последнему сообщению (страница только клиентская, см. app.routes.server.ts). */
  private scrollToEnd(): void {
    if (typeof requestAnimationFrame !== 'function') return;
    requestAnimationFrame(() => this.end()?.nativeElement.scrollIntoView?.({ block: 'end' }));
  }

  private markRead(): void {
    this.api.read(this.chatId).subscribe({ next: (r) => this.socket.setUnread(r.unread_total), error: () => undefined });
  }
}
