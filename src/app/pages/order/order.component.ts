import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, effect, ElementRef, inject, input, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { slotWithDate, STAGE_LABEL } from '../../core/checkout-options';
import { MarketApi } from '../../core/market-api.service';
import { Order, OrderStage } from '../../core/models';
import { PHONE_PATTERN, phone9 } from '../../core/phone';
import { IconComponent } from '../../shared/icon.component';
import { MoneyPipe } from '../../shared/money.pipe';

const STEPS: OrderStage[] = ['placed', 'assembling', 'in_delivery', 'delivered'];
/** Ответы, после которых заказ не открыть без телефона: показываем форму «Найти заказ», а не голую ошибку. */
const LOOKUP_STATUSES = [400, 401, 403, 404];

type OrderQuery = { phone?: string; token?: string };
/** Чем открываем заказ: запрос (токен, телефон или Bearer), ожидание auth, или нечем — форма поиска. */
type Source = { kind: 'fetch'; number: string; opts: OrderQuery } | { kind: 'wait' } | { kind: 'lookup'; number: string };

@Component({
  selector: 'app-order',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, NgTemplateOutlet, MoneyPipe, IconComponent],
  template: `
    @if (lookup()) {
      <section class="lookup" data-test="lookup" aria-labelledby="lookup-title">
        <h1 id="lookup-title">Найти заказ</h1>
        @if (lookupMiss()) { <p class="error" role="alert">Заказ не найден. Проверьте номер и телефон, на который оформляли заказ.</p> }
        @else { <p class="muted">Введите номер заказа и телефон, на который его оформляли.</p> }
        <form [formGroup]="lookupForm" (ngSubmit)="findOrder()" class="form" novalidate>
          <div class="field">
            <label for="ol-number">Номер заказа</label>
            <input id="ol-number" class="field-control" formControlName="number" placeholder="R-123456" autocomplete="off" autocapitalize="characters" spellcheck="false"
              [attr.aria-invalid]="bad('number') || null" [attr.aria-describedby]="bad('number') ? 'ol-number-err' : null" />
            @if (bad('number')) { <p class="field-error" id="ol-number-err">Укажите номер заказа</p> }
          </div>
          <div class="field">
            <label for="ol-phone">Телефон</label>
            <div class="tel">
              <span class="tel-prefix" id="ol-phone-prefix">+992</span>
              <input id="ol-phone" class="field-control" formControlName="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="93 123 45 67"
                [attr.aria-invalid]="bad('phone') || null" [attr.aria-describedby]="bad('phone') ? 'ol-phone-prefix ol-phone-err' : 'ol-phone-prefix'" />
            </div>
            @if (bad('phone')) { <p class="field-error" id="ol-phone-err">Нужен номер из 9 цифр</p> }
          </div>
          <button class="btn" type="submit">Найти заказ</button>
        </form>
        <ng-container [ngTemplateOutlet]="actions" />
      </section>
    }
    @else if (error()) { <p class="error">{{ error() }}</p><a routerLink="/">На главную</a> }
    @else { @if (order(); as o) {
      @if (isFresh()) {
        <!-- Первый визит сразу после оформления: благодарность и что будет дальше -->
        <section class="confirm" data-test="confirm" aria-labelledby="confirm-title">
          <div class="confirm-head">
            <app-icon name="circle-check" [size]="28" />
            <div>
              <h1 id="confirm-title">Спасибо! Заказ принят</h1>
              <p class="num">Номер заказа <b>{{ o.number }}</b></p>
            </div>
          </div>
          <ul class="next">
            @for (s of o.shops; track s.shop_handle) { <li>Лавка &#64;{{ s.shop_handle }} позвонит, чтобы подтвердить заказ</li> }
            @empty { <li>Лавка позвонит, чтобы подтвердить заказ</li> }
            <li>Курьер привезёт: {{ slot(o) }}</li>
            <li>Приготовьте <b>{{ o.items_total + o.delivery_total | money }}</b> наличными</li>
            <li>Проверьте товар при курьере — не подошло, не берёте</li>
          </ul>
        </section>
      } @else {
        <h1>Заказ {{ o.number }}</h1>
      }
      <!-- Этап показан один раз: текущий шаг выделен и отмечен aria-current, без отдельной строки над списком -->
      @if (o.stage === 'cancelled') { <p class="cancelled">{{ label(o.stage) }}</p> }
      @else {
        <ol class="steps" aria-label="Этапы заказа">@for (s of steps; track s) {
          <li [class.done]="reached(o.stage, s)" [class.now]="o.stage === s" [attr.aria-current]="o.stage === s ? 'step' : null">{{ label(s) }}</li>
        }</ol>
      }
      <p class="muted">{{ slot(o) }} · {{ o.customer.district }}, {{ o.customer.address }}</p>
      @for (l of o.lines; track $index) {
        <div class="row"><span>{{ l.title }}@if (l.size) { · {{ l.size }} } × {{ l.qty }}</span><b>{{ l.price * l.qty | money }}</b></div>
      }
      <div class="row"><span>Доставка</span><b>{{ o.delivery_total | money }}</b></div>
      <div class="row total"><span>Наличными курьеру</span><b>{{ o.items_total + o.delivery_total | money }}</b></div>
      <ng-container [ngTemplateOutlet]="actions" />
    } @else { <p class="muted">Загрузка…</p> } }
    <ng-template #actions>
      <div class="actions">
        <a class="btn" routerLink="/">Продолжить покупки</a>
        <!-- Гостю: вход связывает заказы с номером, и их видно в «Мои заказы» без ссылки -->
        @if (auth.ready() && !auth.loggedIn()) {
          <a class="btn btn--ghost" routerLink="/login" [queryParams]="{ return: '/me/orders' }">Войти, чтобы следить за заказами</a>
        }
      </div>
    </ng-template>
  `,
  styles: `
    .confirm { margin:8px 0 24px; padding:20px; border-radius:var(--radius); background:var(--surface) }
    .confirm-head { display:flex; gap:12px; align-items:flex-start } .confirm-head app-icon { color:var(--accent-strong); margin-top:2px }
    .confirm h1 { margin:0; font-size:24px; line-height:1.2; letter-spacing:-0.02em; text-wrap:balance } .num { margin:4px 0 0; color:var(--muted) } .num b { color:var(--text); font-variant-numeric:tabular-nums }
    .next { margin:16px 0 0; padding:0 0 0 40px; display:flex; flex-direction:column; gap:8px; line-height:1.4 }
    .cancelled { font-size:20px; font-weight:700 }
    .steps { display:flex; gap:8px; padding:0; list-style:none; flex-wrap:wrap }
    .steps li { padding:6px 12px; border-radius:999px; background:var(--surface); color:var(--muted); font-size:13px } .steps li.done { background:var(--text); color:#fff }
    .steps li.now { font-weight:600 }
    /* Телефон: этапы — вертикальный список с точками вместо переносящихся пилюль */
    @media (max-width: 640px) {
      .next { padding-left:20px }
      .steps { flex-direction:column; gap:0 }
      .steps li { position:relative; padding:5px 0 5px 22px; background:none; font-size:14px }
      .steps li::before { content:''; position:absolute; left:2px; top:50%; width:10px; height:10px; margin-top:-5px; border-radius:50%; border:2px solid var(--line); background:var(--bg); box-sizing:border-box }
      .steps li.done { background:none; color:var(--text) } .steps li.done::before { border-color:var(--text); background:var(--text) }
    }
    .row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--line) } .total { font-size:18px; border:0 }
    .lookup { max-width:420px } .lookup h1 { margin-bottom:8px }
    .form { display:flex; flex-direction:column; gap:14px; margin-top:16px }
    .form .btn { min-height:48px }
    .actions { display:flex; flex-wrap:wrap; gap:12px; margin-top:28px }
    .actions a { display:inline-flex; align-items:center; justify-content:center; min-height:44px; text-align:center; text-decoration:none }
    .actions a:focus-visible { outline:2px solid var(--text); outline-offset:2px }
    @media (max-width: 640px) { .actions { flex-direction:column } }
  `,
})
export class OrderComponent {
  private readonly api = inject(MarketApi);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  readonly auth = inject(AuthService);
  readonly number = input.required<string>();
  /** Токен заказа из ссылки после оформления (?t=…). */
  readonly t = input<string>('');
  /** Телефон из старых ссылок (?phone=…): такие ещё лежат в истории и закладках. */
  readonly phone = input<string>('');
  /** fresh=1 из адреса: checkout ставит его при переходе сюда сразу после заказа. */
  readonly fresh = input<string>('');
  readonly isFresh = computed(() => this.fresh() === '1');
  readonly order = signal<Order | null>(null);
  readonly error = signal('');
  /** Показать форму «Найти заказ». */
  readonly lookup = signal(false);
  /** Форма открыта после неудачного запроса — объясняем, что заказ не найден. */
  readonly lookupMiss = signal(false);
  readonly steps = STEPS;
  readonly lookupForm = inject(FormBuilder).nonNullable.group({
    number: ['', [Validators.required, Validators.pattern(/\S/)]],
    phone: ['', [Validators.required, Validators.pattern(PHONE_PATTERN)]],
  });
  private current: Subscription | null = null;

  /**
   * Токен важнее телефона; без них ждём гидратацию auth и идём по Bearer.
   * Сравнение по значению: гидратация auth при открытии по токену не повторяет запрос.
   */
  private readonly source = computed<Source>(() => {
    const number = this.number();
    const t = this.t();
    const phone = this.phone();
    if (t) return { kind: 'fetch', number, opts: { token: t } };
    if (phone) return { kind: 'fetch', number, opts: { phone } };
    if (!this.auth.ready()) return { kind: 'wait' };
    return this.auth.loggedIn() ? { kind: 'fetch', number, opts: {} } : { kind: 'lookup', number };
  }, { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) });

  label(s: OrderStage): string { return STAGE_LABEL[s]; }
  reached(cur: OrderStage, s: OrderStage): boolean { return STEPS.indexOf(cur) >= STEPS.indexOf(s); }
  /** «Сегодня, 18:00–21:00» → «17 ноября, 18:00–21:00» относительно даты заказа. */
  slot(o: Order): string { return slotWithDate(o.slot, o.created_at); }

  constructor() {
    // Смена номера/токена/телефона отменяет прежний запрос: поздний ответ не перетирает новый заказ
    effect(() => {
      const src = this.source();
      untracked(() => {
        if (src.kind === 'fetch') this.load(src.number, src.opts);
        else if (src.kind === 'lookup') this.showLookup(src.number, false);
        else this.reset();
      });
    });
    inject(DestroyRef).onDestroy(() => this.current?.unsubscribe());
  }

  bad(field: 'number' | 'phone'): boolean {
    const c = this.lookupForm.controls[field];
    return c.invalid && c.touched;
  }

  /** «Найти заказ»: тот же запрос, что и по старой ссылке, — номер и телефон. */
  findOrder(): void {
    if (this.lookupForm.invalid) {
      this.lookupForm.markAllAsTouched();
      const first = this.lookupForm.controls.number.invalid ? 'number' : 'phone';
      this.host.nativeElement.querySelector<HTMLElement>(`[formControlName="${first}"]`)?.focus();
      return;
    }
    const v = this.lookupForm.getRawValue();
    this.load(v.number.trim(), { phone: phone9(v.phone) });
  }

  private reset(): void {
    this.current?.unsubscribe();
    this.current = null;
    this.order.set(null);
    this.error.set('');
    this.lookup.set(false);
  }

  private showLookup(number: string, miss: boolean): void {
    this.reset();
    this.lookupForm.controls.number.setValue(number);
    this.lookupMiss.set(miss);
    this.lookup.set(true);
  }

  private load(number: string, opts: OrderQuery): void {
    this.reset();
    this.current = this.api.order(number, opts).subscribe({
      next: (o) => this.order.set(o),
      error: (e) => {
        if (e instanceof HttpErrorResponse && LOOKUP_STATUSES.includes(e.status)) this.showLookup(number, true);
        else this.error.set(apiErrorMessage(e));
      },
    });
  }
}
