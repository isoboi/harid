import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ChatApi } from '../../core/chat-api.service';
import { ChatSocket } from '../../core/chat-socket.service';
import { AuthService } from '../../core/auth.service';
import { ChatSummary } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { ShopAvatarComponent } from '../../shared/shop-avatar.component';
import { chatListTime } from './chat-time';

/**
 * «Сообщения»: переписки покупателя с лавками, новые сверху. Строка — как в мессенджере: аватар лавки,
 * имя и время, ниже последнее сообщение («Вы: …» для своих) и счётчик непрочитанных.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-chats',
  standalone: true,
  imports: [RouterLink, IconComponent, ShopAvatarComponent],
  template: `
    <section class="wrap box">
      <h1 class="title">Сообщения</h1>
      @if (loaded() && !chats().length) {
        <div class="empty">
          <span class="empty-ico"><app-icon name="message-circle" [size]="28" [stroke]="1.8" /></span>
          <p class="empty-title">Пока нет сообщений</p>
          <p class="empty-note">Вопрос о размере или наличии задайте лавке прямо со страницы товара — кнопка «Написать продавцу».</p>
          <a class="btn" routerLink="/catalog">В каталог</a>
        </div>
      }
      @if (!loaded()) {
        <!-- Заглушка списка: кружок лавки, имя со временем и строка последнего сообщения -->
        <div role="status" data-test="skel-chats">
          <span class="sr-only">Загрузка…</span>
          <ul class="list" aria-hidden="true">
            @for (w of skeleton; track $index) {
              <li class="row">
                <span class="skel skel--round ava-skel"></span>
                <span class="body">
                  <span class="top"><span class="skel skel--line name-skel" [style.width.%]="w"></span><span class="skel skel--line when-skel"></span></span>
                  <span class="skel skel--line last-skel"></span>
                </span>
              </li>
            }
          </ul>
        </div>
      }
      <ul class="list">
        @for (c of chats(); track c.id) {
          <li>
            <a class="row" data-test="chat-row" [class.unread]="c.unread" [routerLink]="['/chats', c.id]">
              <app-shop-avatar [name]="c.shop.name" [color]="c.shop.avatar_color" [handle]="c.shop.handle" [size]="52" />
              <span class="body">
                <span class="top">
                  <span class="name">{{ c.shop.name }}</span>
                  @if (c.last_message) { <time class="when" [attr.datetime]="c.last_message.created_at">{{ when(c.last_message.created_at) }}</time> }
                </span>
                <span class="bottom">
                  <span class="last">
                    @if (c.last_message; as m) {
                      @if (m.sender === 'buyer') { <span class="you">Вы: </span> }{{ m.text }}
                    } @else { &#64;{{ c.shop.handle }} }
                  </span>
                  @if (c.unread) { <span class="badge" data-test="unread" [attr.aria-label]="'Непрочитанных: ' + c.unread">{{ c.unread }}</span> }
                </span>
              </span>
            </a>
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    .box { max-width: 720px; padding-top: 28px; padding-bottom: 40px }
    .title { margin: 0 0 12px; font-size: 28px; font-weight: 800; letter-spacing: -0.02em }
    .list { list-style: none; margin: 0 -12px; padding: 0 }
    .row { display: flex; align-items: center; gap: 12px; min-height: 76px; padding: 10px 12px; border-radius: 14px; color: inherit; text-decoration: none }
    @media (hover: hover) { .row:hover { background: var(--color-mist) } }
    .row:active { background: var(--color-mist) }
    .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px }
    .top, .bottom { display: flex; align-items: baseline; gap: 8px; min-width: 0 }
    .bottom { align-items: center }
    .name { flex: 1; min-width: 0; overflow: hidden; font-size: 16px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap }
    .when { flex: none; font-size: 13px; color: var(--color-ink-soft); font-variant-numeric: tabular-nums }
    .last { flex: 1; min-width: 0; overflow: hidden; font-size: 14px; color: var(--color-ink-soft); text-overflow: ellipsis; white-space: nowrap }
    .you { color: var(--color-ink) }
    /* Есть непрочитанные — имя и текст плотнее, время лазурью */
    .unread .name { font-weight: 800 }
    .unread .last { color: var(--color-ink); font-weight: 500 }
    .unread .when { color: var(--color-lapis); font-weight: 600 }
    .badge { flex: none; display: grid; place-items: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 9999px; background: var(--color-anor); color: var(--color-paper); font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums }
    /* Заглушка: строки той же высоты 76px, без подсветки при наведении */
    li.row { pointer-events: none }
    .ava-skel { flex: none; width: 52px; height: 52px }
    .name-skel { height: 16px; margin-block: 2px }
    .when-skel { flex: none; margin-left: auto; width: 40px; height: 12px }
    .last-skel { width: 75%; margin-top: 4px }
    .empty { display: flex; flex-direction: column; align-items: center; padding: 48px 16px; text-align: center }
    .empty-ico { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 50%; background: var(--color-mist); color: var(--color-lapis) }
    .empty-title { margin: 16px 0 4px; font-size: 18px; font-weight: 700 }
    .empty-note { max-width: 36ch; margin: 0 0 20px; color: var(--color-ink-soft); line-height: 1.5; text-wrap: balance }
  `,
})
export class ChatsComponent implements OnInit {
  private readonly api = inject(ChatApi);
  private readonly socket = inject(ChatSocket);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly chats = signal<ChatSummary[]>([]);
  readonly loaded = signal(false);
  readonly when = chatListTime;
  /** Ширины имён в строках заглушки — чтобы список не выглядел штампованным. */
  readonly skeleton = [42, 30, 50, 36, 26];

  ngOnInit(): void {
    this.auth.hydrate();
    if (!this.auth.loggedIn()) { this.router.navigateByUrl('/login?return=/chats'); return; }
    this.load();
    // Новое сообщение по сокету — перечитываем список (порядок и счётчики приходят с сервера)
    this.socket.messages$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  private load(): void {
    this.api.list().subscribe({ next: (list) => { this.chats.set(list); this.loaded.set(true); }, error: () => this.loaded.set(true) });
  }
}
