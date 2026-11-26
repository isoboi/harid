import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { MarketApi } from '../../core/market-api.service';
import { prettyPhone } from '../../core/phone';
import { ToastService } from '../../core/toast.service';
import { IconComponent, IconName } from '../../shared/icon.component';

const RETURN = '/me';
/** Как у бэкенда (UpdateBuyerDto): 1–100 символов после trim. */
const NAME_MAX = 100;

const LINKS: { path: string; icon: IconName; label: string }[] = [
  { path: '/me/orders', icon: 'package', label: 'Мои заказы' },
  { path: '/favorites', icon: 'heart', label: 'Избранное' },
  { path: '/chats', icon: 'message-circle', label: 'Сообщения' },
  { path: '/sell', icon: 'store', label: 'Открыть лавку' },
];

/** «Мадина Рахимова» → «МР», «мадина» → «М», пусто → ''. */
export function initialsOf(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

/**
 * Профиль покупателя: карточка с аватаром, именем и номером; по нажатию — форма имени
 * (PATCH /market/me), номер только для чтения — он же вход по SMS,
 * ссылки на личные разделы и выход. Без входа — на /login с возвратом сюда.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
  template: `
    <div class="wrap page-top">
      <h1 class="page-title head">Профиль</h1>
      @if (auth.buyer(); as b) {
        @if (!editing()) {
          <button class="card who" type="button" data-test="profile-card" (click)="edit()">
            <span class="avatar" aria-hidden="true" data-test="avatar">
              @if (initials()) { {{ initials() }} } @else { <app-icon name="user" [size]="28" [stroke]="1.8" /> }
            </span>
            <span class="who-text">
              <span class="who-name" [class.empty]="!b.name" data-test="name">{{ b.name || 'Укажите имя' }}</span>
              <span class="phone" data-test="phone">{{ phone() }}</span>
            </span>
            <app-icon class="go" name="pencil" [size]="20" [stroke]="1.8" /><span class="sr-only">Изменить</span>
          </button>
        } @else {
          <form class="card" (ngSubmit)="save()" (keydown.escape)="cancelEdit()" data-test="name-form">
            <div class="field">
              <label for="profile-name">Как к вам обращаться</label>
              <input id="profile-name" name="name" class="field-control" autocomplete="name" [maxlength]="nameMax"
                [ngModel]="name()" (ngModelChange)="name.set($event)" [attr.aria-invalid]="error() ? true : null" />
              @if (error()) { <p class="field-error" role="alert" data-test="name-error">{{ error() }}</p> }
            </div>
            <div class="field">
              <span class="label">Номер телефона</span>
              <p class="phone" data-test="phone">{{ phone() }}</p>
              <p class="field-hint">По этому номеру вы входите на Харид, поэтому изменить его нельзя.</p>
            </div>
            <div class="actions">
              <button class="btn" type="submit" data-test="save" [disabled]="!canSave()">{{ busy() ? 'Сохраняем…' : 'Сохранить' }}</button>
              <button class="btn btn--ghost" type="button" data-test="cancel-edit" [disabled]="busy()" (click)="cancelEdit()">Отмена</button>
            </div>
          </form>
        }

        <nav class="links" aria-label="Личные разделы">
          <ul>
            @for (l of links; track l.path) {
              <li><a class="link-row" [routerLink]="l.path"><app-icon [name]="l.icon" [size]="22" [stroke]="1.8" /><span>{{ l.label }}</span><app-icon class="go" name="chevron-right" [size]="20" /></a></li>
            }
          </ul>
        </nav>

        <button class="btn btn--ghost out" type="button" data-test="logout" (click)="logout()">Выйти</button>
      } @else {
        <div class="card" role="status"><span class="sr-only">Загрузка…</span><span class="skel skel--line" aria-hidden="true"></span></div>
      }
    </div>
  `,
  styles: `
    .head { margin-bottom: 24px }
    .card, .links, .out { max-width: 560px; width: 100% }
    .card { display: flex; flex-direction: column; gap: 20px; padding: 24px; border: 1px solid var(--color-line); border-radius: 14px }
    .phone { font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums }
    .who { flex-direction: row; align-items: center; gap: 16px; text-align: left; font: inherit; color: inherit; background: none; cursor: pointer }
    @media (hover: hover) { .who:hover { background: var(--color-mist) } }
    .avatar { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: 50%; background: var(--color-mist); font-size: 22px; font-weight: 700; letter-spacing: .02em }
    .who-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px }
    .who-name { font-size: 18px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
    .who-name.empty { color: var(--color-ink-soft); font-weight: 600 }
    .who .phone { font-weight: 500; color: var(--color-ink-soft) }
    .actions { display: flex; gap: 12px; flex-wrap: wrap }
    .links { margin-top: 32px; border-top: 1px solid var(--color-line) }
    .links li { border-bottom: 1px solid var(--color-line) }
    .link-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 14px; min-height: 56px; padding: 0 8px; margin-inline: -8px; border-radius: 10px; font-weight: 600 }
    .link-row app-icon { display: inline-flex }
    .go { color: var(--color-ink-soft) }
    @media (hover: hover) { .link-row:hover { background: var(--color-mist) } }
    .out { margin-top: 32px }
    @media (max-width: 639.98px) { .card { padding: 16px } .actions .btn { flex: 1 } }
  `,
})
export class ProfileComponent {
  private readonly api = inject(MarketApi);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly links = LINKS;
  readonly nameMax = NAME_MAX;
  readonly name = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  /** Карточка профиля или форма имени. */
  readonly editing = signal(false);
  /** До двух первых букв имени для аватара; без имени — иконка. */
  readonly initials = computed(() => initialsOf(this.auth.buyer()?.name ?? ''));
  readonly phone = computed(() => prettyPhone(this.auth.buyer()?.phone ?? ''));
  /** Есть что сохранять: непустое имя, отличное от текущего. */
  readonly canSave = computed(() => {
    const n = this.name().trim();
    return !this.busy() && n.length > 0 && n !== (this.auth.buyer()?.name ?? '');
  });
  private requested = false;

  constructor() {
    effect(() => {
      if (!this.auth.ready()) return;
      untracked(() => {
        if (this.requested) return;
        this.requested = true;
        if (!this.auth.loggedIn()) { this.toLogin(); return; }
        this.name.set(this.auth.buyer()?.name ?? '');
        // Свежий профиль с сервера: имя могли поменять на другом устройстве
        this.api.me().subscribe({
          next: (b) => {
            const untouched = this.name() === (this.auth.buyer()?.name ?? '');
            this.auth.setBuyer(b);
            if (untouched) this.name.set(b.name ?? '');
          },
          error: (e) => { if (e instanceof HttpErrorResponse && e.status === 401) this.toLogin(); },
        });
      });
    });
  }

  edit(): void {
    this.name.set(this.auth.buyer()?.name ?? '');
    this.error.set('');
    this.editing.set(true);
    // Фокус в поле, когда форма отрисуется
    setTimeout(() => (document.getElementById('profile-name') as HTMLInputElement | null)?.focus());
  }

  cancelEdit(): void {
    if (this.busy()) return;
    this.error.set('');
    this.editing.set(false);
  }

  save(): void {
    if (!this.canSave()) return;
    this.busy.set(true);
    this.error.set('');
    this.api.updateMe(this.name().trim()).subscribe({
      next: (b) => {
        this.busy.set(false);
        this.auth.setBuyer(b);
        this.name.set(b.name ?? '');
        this.editing.set(false);
        this.toast.show({ text: 'Имя сохранено' });
      },
      error: (e) => {
        this.busy.set(false);
        if (e instanceof HttpErrorResponse && e.status === 401) { this.toLogin(); return; }
        this.error.set(apiErrorMessage(e));
      },
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }

  private toLogin(): void {
    this.router.navigate(['/login'], { queryParams: { return: RETURN } });
  }
}
