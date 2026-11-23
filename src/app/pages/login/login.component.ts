import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { MarketApi } from '../../core/market-api.service';
import { CodeResend } from '../../core/code-resend';
import { isPhone, phone9 } from '../../core/phone';

const DEFAULT_RETURN = '/me/orders';

/**
 * Куда вернуть после входа: только внутренний путь. Отсекаем «//evil» и «/\evil»:
 * браузер считает обратный слеш за прямой, и такой путь уводит на внешний сайт.
 */
const SAFE_PATH = /^\/(?![\/\\])/;
const safeReturn = (v: string): string => (SAFE_PATH.test(v) ? v : DEFAULT_RETURN);

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="wrap box">
      <h1 class="title">Вход по номеру телефона</h1>
      @if (step() === 'phone') {
        <p class="lead">Пароль не нужен — пришлём код в SMS. Так ваши заказы будут видны в «Мои заказы» на любом устройстве.</p>
        <!-- Форма — чтобы Enter в поле отправлял код, как кнопка -->
        <form (ngSubmit)="submitPhone()">
          <div class="field">
            <label for="login-phone">Номер телефона</label>
            <div class="tel">
              <span class="tel-prefix" id="login-phone-prefix">+992</span>
              <input id="login-phone" name="phone" class="field-control" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="93 123 45 67" aria-describedby="login-phone-prefix"
                [ngModel]="phone()" (ngModelChange)="phone.set($event)" />
            </div>
          </div>
          <button class="btn btn--block go" type="submit" [disabled]="!canSendCode()">Получить код</button>
        </form>
      } @else {
        <p class="lead">Код отправлен на +992 {{ phone9(phone()) }}</p>
        <form (ngSubmit)="submitCode()">
          <div class="field">
            <label for="login-code">Код из SMS</label>
            <input id="login-code" name="code" class="field-control code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" [ngModel]="code()" (ngModelChange)="code.set($event)" />
          </div>
          @if (resend.left() > 0) { <p class="field-hint again" data-test="countdown">Отправить код ещё раз через {{ resend.left() }} с</p> }
          @else { <button class="link again" type="button" data-test="resend" [disabled]="busy()" (click)="send()">Отправить код ещё раз</button> }
          <button class="btn btn--block go" type="submit" [disabled]="!canVerify()">Войти</button>
          <button class="btn btn--ghost btn--block alt" type="button" (click)="step.set('phone')">Другой номер</button>
        </form>
      }
      @if (error()) { <p class="field-error err" role="alert">{{ error() }}</p> }
    </section>
  `,
  styles: `
    /* Узкая колонка прототипа: max-w-[420px] pt-12 sm:pt-16 */
    .box { max-width: 420px; padding-top: 48px }
    @media (min-width: 640px) { .box { padding-top: 64px } }
    .title { font-size: 32px; line-height: 1.25; font-weight: 800; letter-spacing: -0.03em }
    .lead { margin: 8px 0 32px; font-size: 16px; line-height: 1.625; color: var(--color-ink-soft) }
    .code { letter-spacing: .3em; font-variant-numeric: tabular-nums }
    .go { margin-top: 20px }
    .alt { margin-top: 12px }
    .again { margin-top: 12px }
    /* Ссылка-кнопка «ещё раз»: лазурь с подчёркиванием, высота 44px */
    .link { display: inline-flex; align-items: center; min-height: 44px; color: var(--color-lapis); font-weight: 500; text-decoration: underline; text-underline-offset: 2px }
    .link:disabled { opacity: .5 }
    .err { margin-top: 16px }
  `,
})
export class LoginComponent {
  private readonly api = inject(MarketApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  /** Адрес возврата из query ?return=… (привязывается роутером). */
  readonly return = input<string>(DEFAULT_RETURN);
  readonly phone = signal('');
  readonly code = signal('');
  readonly step = signal<'phone' | 'code'>('phone');
  readonly busy = signal(false);
  readonly error = signal('');
  /** Последняя успешная отправка кода и обратный отсчёт повтора. */
  readonly resend = new CodeResend();
  readonly phone9 = phone9;
  readonly isPhone = isPhone;

  canSendCode(): boolean { return !this.busy() && isPhone(this.phone()); }
  canVerify(): boolean { return !this.busy() && this.code().length === 6; }

  /** Отправка формы телефона (кнопка или Enter): те же условия, что у кнопки. */
  submitPhone(): void { if (this.canSendCode()) this.sendCode(); }

  /** Отправка формы кода (кнопка или Enter). */
  submitCode(): void { if (this.canVerify()) this.verify(); }

  /** «Получить код»: если на этот номер код ушёл меньше минуты назад — сразу к вводу кода. */
  sendCode(): void {
    if (this.resend.isRecent(phone9(this.phone()))) { this.error.set(''); this.step.set('code'); return; }
    this.send();
  }

  /** Реальная отправка кода (и повторная по кнопке); успех перезапускает отсчёт. */
  send(): void {
    const p = phone9(this.phone());
    this.busy.set(true);
    this.error.set('');
    this.api.sendCode(p).subscribe({
      next: () => { this.busy.set(false); this.resend.markSent(p); this.step.set('code'); },
      error: (e) => { this.busy.set(false); this.error.set(apiErrorMessage(e)); },
    });
  }

  verify(): void {
    this.busy.set(true);
    this.error.set('');
    this.api.verify(phone9(this.phone()), this.code()).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.auth.setSession(r);
        this.router.navigateByUrl(safeReturn(this.return()));
      },
      error: (e) => { this.busy.set(false); this.error.set(apiErrorMessage(e)); },
    });
  }
}
