import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { apiErrorMessage } from '../../core/api-error';
import { MarketApi } from '../../core/market-api.service';
import { CodeResend } from '../../core/code-resend';
import { PHONE_PATTERN, phone9 } from '../../core/phone';

/** Открытие лавки: ник, имя, телефон → SMS-код → лавка и кабинет в админке. */
@Component({
  selector: 'app-sell',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule],
  template: `
    <div class="wrap top">
      <h1 class="title">Посты из вашего Instagram станут товарами на <span class="nowrap">Хариде</span></h1>
      <p class="lead">Импортируйте посты в кабинете, отметьте «На витрине» — покупатели закажут, курьер привезёт и заберёт оплату наличными.</p>
      <section class="card" aria-label="Открыть лавку">
        @switch (step()) {
          @case ('form') {
            <form [formGroup]="form" (ngSubmit)="sendCode()" class="form">
              <div class="field">
                <label for="sell-handle">Ник в Instagram</label>
                <div class="at-wrap">
                  <span class="at" aria-hidden="true">&#64;</span>
                  <input id="sell-handle" class="field-control at-input" formControlName="handle" placeholder="my.shop" autocapitalize="none" autocomplete="off" spellcheck="false" maxlength="31" />
                </div>
              </div>
              <div class="field">
                <label for="sell-name">Ваше имя</label>
                <input id="sell-name" class="field-control" formControlName="owner_name" autocomplete="name" maxlength="150" />
              </div>
              <div class="field">
                <label for="sell-phone">Телефон</label>
                <div class="tel">
                  <span class="tel-prefix" id="sell-phone-prefix">+992</span>
                  <input id="sell-phone" class="field-control" formControlName="phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="93 123 45 67" aria-describedby="sell-phone-prefix sell-phone-hint" />
                </div>
                <p class="field-hint" id="sell-phone-hint">Пришлём код в SMS — по этому номеру вы будете входить в кабинет</p>
              </div>
              <button class="btn go" type="submit" [disabled]="form.invalid || busy()">Получить код</button>
            </form>
          }
          @case ('code') {
            <div class="form">
              <p class="muted">Код отправлен на +992 {{ phone9(form.getRawValue().phone) }}</p>
              <div class="field">
                <label for="sell-code">Код из SMS</label>
                <input id="sell-code" class="field-control code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" [ngModel]="code()" (ngModelChange)="code.set($event)" />
              </div>
              @if (resend.left() > 0) { <p class="field-hint" data-test="countdown">Отправить код ещё раз через {{ resend.left() }} с</p> }
              @else { <button class="link" type="button" data-test="resend" [disabled]="busy()" (click)="send()">Отправить код ещё раз</button> }
              <div class="row">
                <button class="btn" type="button" [disabled]="busy() || code().length !== 6" (click)="apply()">Открыть лавку</button>
                <button class="btn btn--ghost" type="button" (click)="back()">Изменить данные</button>
              </div>
            </div>
          }
          @case ('done') {
            <div class="form">
              <h2 class="done">Лавка открыта</h2>
              <p>&#64;{{ handle() }} уже на Хариде. Войдите в кабинет по номеру телефона, чтобы добавить товары.</p>
              <a class="btn go" data-test="cabinet" [href]="cabinetUrl">Перейти в кабинет</a>
            </div>
          }
        }
        @if (error()) { <p class="field-error err" role="alert">{{ error() }}</p> }
      </section>
      <section id="terms" class="terms">
        <h2 class="terms-title">Как это работает</h2>
        <dl class="terms-list">
          <div><dt>Посты становятся товарами</dt><dd>Импортируйте посты в кабинете и отметьте «На витрине» — товар появится у покупателей.</dd></div>
          <div><dt>Без предоплаты</dt><dd>Покупатель платит наличными курьеру, когда проверил заказ. Переводы на карту собирать не нужно.</dd></div>
          <div><dt>Курьер забирает и привозит</dt><dd>Вы подтверждаете заказ звонком, курьер забирает его из лавки и привозит в выбранное время.</dd></div>
          <div><dt>Вход по номеру телефона</dt><dd>Кабинет без пароля: код приходит в SMS на номер, который вы укажете выше.</dd></div>
        </dl>
      </section>
    </div>
  `,
  styles: `
    .top { padding-top: 40px }
    @media (min-width: 768px) { .top { padding-top: 56px } }
    .title { max-width: 20ch; font-size: 38px; line-height: 1.05; font-weight: 800; letter-spacing: -0.035em }
    @media (min-width: 640px) { .title { font-size: 52px } }
    .nowrap { white-space: nowrap }
    .lead { margin-top: 20px; max-width: 52ch; font-size: 18px; line-height: 1.625; color: var(--color-ink-soft) }
    /* Карточка подключения: rounded-[14px] border p-5 sm:p-8 */
    .card { margin-top: 40px; padding: 20px; border: 1px solid var(--color-line); border-radius: var(--radius-photo) }
    @media (min-width: 640px) { .card { padding: 32px } }
    .form { max-width: 520px; display: flex; flex-direction: column; gap: 16px }
    .at-wrap { position: relative }
    .at { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--color-ink-soft); pointer-events: none }
    .at-input { padding-left: 32px }
    .code { letter-spacing: .3em; font-variant-numeric: tabular-nums }
    .go { align-self: flex-start; margin-top: 4px }
    .row { display: flex; flex-wrap: wrap; gap: 12px }
    .link { align-self: flex-start; display: inline-flex; align-items: center; min-height: 44px; color: var(--color-lapis); font-weight: 500; text-decoration: underline; text-underline-offset: 2px }
    .link:disabled { opacity: .5 }
    .done { font-size: 22px; font-weight: 700 }
    .err { margin-top: 16px }
    .terms { margin-top: 80px; scroll-margin-top: 96px }
    .terms-title { font-size: 28px; font-weight: 800; letter-spacing: -0.02em }
    .terms-list { margin-top: 24px; display: grid; column-gap: 48px; row-gap: 32px }
    @media (min-width: 768px) { .terms-list { grid-template-columns: repeat(2, minmax(0, 1fr)) } }
    .terms-list > div { border-top: 2px solid var(--color-ink); padding-top: 16px }
    .terms-list dt { font-size: 19px; font-weight: 700 }
    .terms-list dd { margin-top: 6px; max-width: 46ch; line-height: 1.625; color: var(--color-ink-soft) }
    @media (max-width: 639.98px) { .go, .row .btn { width: 100% } }
  `,
})
export class SellComponent {
  private readonly api = inject(MarketApi);
  readonly cabinetUrl = environment.cabinetUrl;
  /** Последняя успешная отправка кода и обратный отсчёт повтора. */
  readonly resend = new CodeResend();
  readonly phone9 = phone9;
  readonly step = signal<'form' | 'code' | 'done'>('form');
  readonly code = signal('');
  readonly handle = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({
    handle: ['', [Validators.required, Validators.pattern(/^\s*@?[A-Za-z0-9._]{1,30}\s*$/)]],
    owner_name: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(PHONE_PATTERN)]],
  });

  /** Возврат к форме: код и ошибка сбрасываются, чтобы не остались от прошлой попытки. */
  back(): void {
    this.step.set('form'); this.code.set(''); this.error.set('');
  }

  /** «Получить код»: если на этот номер код ушёл меньше минуты назад — сразу к вводу кода. */
  sendCode(): void {
    if (this.form.invalid) return;
    if (this.resend.isRecent(phone9(this.form.getRawValue().phone))) { this.error.set(''); this.step.set('code'); return; }
    this.send();
  }

  /** Реальная отправка кода (и повторная по кнопке); успех перезапускает отсчёт. */
  send(): void {
    const p = phone9(this.form.getRawValue().phone);
    this.busy.set(true); this.error.set('');
    this.api.sellerSendCode(p).subscribe({
      next: () => { this.busy.set(false); this.resend.markSent(p); this.step.set('code'); },
      error: (e) => { this.busy.set(false); this.error.set(apiErrorMessage(e)); },
    });
  }
  apply(): void {
    const v = this.form.getRawValue();
    this.busy.set(true); this.error.set('');
    this.api.sellerApply({ handle: v.handle.trim(), owner_name: v.owner_name.trim(), phone: phone9(v.phone), code: this.code() }).subscribe({
      next: (r) => { this.busy.set(false); this.handle.set(r.handle); this.step.set('done'); },
      error: (e) => { this.busy.set(false); this.error.set(apiErrorMessage(e)); },
    });
  }
}
