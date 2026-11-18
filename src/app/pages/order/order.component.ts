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
    <div class="wrap page-top">
    @if (lookup()) {
      <section class="lookup" data-test="lookup" aria-labelledby="lookup-title">
        <h1 id="lookup-title" class="page-title">Найти заказ</h1>
        @if (lookupMiss()) { <p class="lead error" role="alert">Заказ не найден. Проверьте номер и телефон, на который оформляли заказ.</p> }
        @else { <p class="lead">Введите номер заказа и телефон, на который его оформляли.</p> }
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
    @else if (error()) { <p class="error">{{ error() }}</p><a class="home" routerLink="/">На главную</a> }
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
        <h1 class="page-title">Заказ {{ o.number }}</h1>
      }
      <!-- Этап показан один раз: текущий шаг выделен и отмечен aria-current, без отдельной строки над списком -->
      @if (o.stage === 'cancelled') { <p class="cancelled">{{ label(o.stage) }}</p> }
      @else {
        <ol class="steps" aria-label="Этапы заказа">@for (s of steps; track s) {
          <li [class.done]="reached(o.stage, s)" [class.now]="o.stage === s" [attr.aria-current]="o.stage === s ? 'step' : null">{{ label(s) }}</li>
        }</ol>
      }
      <p class="where">{{ slot(o) }} · {{ o.customer.district }}, {{ o.customer.address }}</p>
      <div class="summary bill">
        <dl>
          @for (l of o.lines; track $index) {
            <div class="row"><dt>{{ l.title }}@if (l.size) { · {{ l.size }} } × {{ l.qty }}</dt><dd>{{ l.price * l.qty | money }}</dd></div>
          }
          <div class="row"><dt>Доставка</dt><dd>{{ o.delivery_total | money }}</dd></div>
          <div class="row total"><dt>Наличными курьеру</dt><dd>{{ o.items_total + o.delivery_total | money }}</dd></div>
        </dl>
      </div>
      <ng-container [ngTemplateOutlet]="actions" />
    } @else { <p class="muted">Загрузка…</p> } }
    </div>
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
    /* Подтверждение после оформления: серая карточка прототипа с галочкой лазури */
    .confirm { margin-bottom: 32px; padding: 24px; border-radius: var(--radius-photo); background: var(--color-mist) }
    .confirm-head { display: flex; gap: 12px; align-items: flex-start } .confirm-head app-icon { color: var(--color-lapis); margin-top: 4px }
    .confirm h1 { font-size: 30px; line-height: 1.12; font-weight: 800; letter-spacing: -0.03em; text-wrap: balance }
    .num { margin-top: 6px; color: var(--color-ink-soft) } .num b { color: var(--color-ink); font-variant-numeric: tabular-nums }
    .next { margin-top: 20px; padding-left: 40px; display: flex; flex-direction: column; gap: 8px; list-style: disc; font-size: 15px; line-height: 1.5 }
    .next li::marker { color: var(--color-lapis) }
    .cancelled { margin-top: 16px; font-size: 20px; font-weight: 700; color: var(--color-anor) }
    .steps { margin-top: 20px; display: flex; flex-wrap: wrap; gap: 8px }
    .steps li { display: inline-flex; align-items: center; height: 40px; padding: 0 16px; border: 1px solid var(--color-line); border-radius: 9999px; font-size: 14px; font-weight: 500; color: var(--color-ink-soft) }
    .steps li.done { border-color: var(--color-ink); background: var(--color-ink); color: var(--color-paper) }
    .steps li.now { font-weight: 700 }
    /* Телефон: этапы — вертикальный список с точками вместо переносящихся пилюль */
    @media (max-width: 640px) {
      .next { padding-left: 20px }
      .steps { flex-direction: column; gap: 0 }
      .steps li { position: relative; height: auto; padding: 6px 0 6px 24px; border: 0; background: none; font-size: 15px }
      .steps li::before { content: ''; position: absolute; left: 2px; top: 50%; width: 12px; height: 12px; margin-top: -6px; border-radius: 50%; border: 2px solid var(--color-line); background: var(--color-paper) }
      .steps li.done { background: none; color: var(--color-ink) } .steps li.done::before { border-color: var(--color-lapis); background: var(--color-lapis) }
    }
    .where { margin-top: 16px; color: var(--color-ink-soft) }
    .bill { margin-top: 24px; max-width: 560px }
    .bill dt { overflow-wrap: anywhere }
    .lookup { max-width: 420px; padding-top: 16px }
    .lead { margin-top: 8px; font-size: 16px; line-height: 1.625; color: var(--color-ink-soft) }
    .lead.error { color: var(--color-anor) }
    .form { display: flex; flex-direction: column; gap: 16px; margin-top: 24px }
    .form .btn { margin-top: 4px; width: 100% }
    .home { color: var(--color-lapis); text-decoration: underline; text-underline-offset: 2px }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px }
    /* В поиске заказа главная кнопка — «Найти заказ», остальные действия контурные */
    .lookup .actions .btn { border-color: var(--color-line); background: transparent; color: var(--color-ink) }
    @media (max-width: 640px) { .actions { flex-direction: column } }
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
