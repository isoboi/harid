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
    <section class="box">
      <h1>Вход по номеру телефона</h1>
      @if (step() === 'phone') {
        <label>Номер телефона<input [ngModel]="phone()" (ngModelChange)="phone.set($event)" inputmode="tel" placeholder="93 123 45 67" /></label>
        <button class="btn" type="button" [disabled]="busy() || !isPhone(phone())" (click)="sendCode()">Получить код</button>
      } @else {
        <p class="muted">Код отправлен на +992 {{ phone9(phone()) }}</p>
        <label>Код из SMS<input [ngModel]="code()" (ngModelChange)="code.set($event)" inputmode="numeric" maxlength="6" /></label>
        @if (resend.left() > 0) { <p class="muted" data-test="countdown">Отправить код ещё раз через {{ resend.left() }} с</p> }
        @else { <button class="btn btn--ghost" type="button" data-test="resend" [disabled]="busy()" (click)="send()">Отправить код ещё раз</button> }
        <button class="btn" type="button" [disabled]="busy() || code().length !== 6" (click)="verify()">Войти</button>
        <button class="btn btn--ghost" type="button" (click)="step.set('phone')">Другой номер</button>
      }
      @if (error()) { <p class="error">{{ error() }}</p> }
    </section>
  `,
  styles: `
    .box { max-width:380px; margin:40px auto; display:flex; flex-direction:column; gap:12px }
    label { display:flex; flex-direction:column; gap:4px }
    input { padding:10px 12px; border:1px solid var(--line); border-radius:10px; font:inherit }
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
