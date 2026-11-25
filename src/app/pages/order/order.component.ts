import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, effect, ElementRef, inject, input, signal, untracked } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { dayMonth, slotWithDate, STAGE_LABEL } from '../../core/checkout-options';
import { MarketApi } from '../../core/market-api.service';
import { RepeatOrderService } from '../../core/repeat-order.service';
import { Order, OrderLine, OrderStage, Reviewable } from '../../core/models';
import { PHONE_PATTERN, phone9 } from '../../core/phone';
import { IconComponent } from '../../shared/icon.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { plural } from '../../shared/plural';
import { SkelSummaryComponent } from '../../shared/skeleton.component';
import { RateItemComponent } from '../my-orders/rate-purchases.component';
import { ReturnsComponent } from '../my-orders/returns.component';

const STEPS: OrderStage[] = ['placed', 'assembling', 'in_delivery', 'delivered'];
/** Ответы, после которых заказ не открыть без телефона: показываем форму «Найти заказ», а не голую ошибку. */
const LOOKUP_STATUSES = [400, 401, 403, 404];

type OrderQuery = { phone?: string; token?: string };
/** Чем открываем заказ: запрос (токен, телефон или Bearer), ожидание auth, или нечем — форма поиска. */
type Source = { kind: 'fetch'; number: string; opts: OrderQuery } | { kind: 'wait' } | { kind: 'lookup'; number: string };

@Component({
  selector: 'app-order',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, NgTemplateOutlet, MoneyPipe, IconComponent, RateItemComponent, ReturnsComponent, SkelSummaryComponent],
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
        @if (auth.loggedIn()) {
          <a class="back" routerLink="/me/orders" data-test="back"><app-icon name="chevron-left" [size]="18" />Мои заказы</a>
        }
        <h1 class="page-title">Заказ {{ o.number }}</h1>
        <p class="sub">от {{ day(o.created_at) }} · {{ count(o) }}</p>
      }
      <!-- Этап показан один раз: текущий шаг выделен и отмечен aria-current, без отдельной строки над списком -->
      @if (o.stage === 'cancelled') { <p class="cancelled">{{ label(o.stage) }}</p> }
      @else {
        <ol class="steps" aria-label="Этапы заказа">@for (s of steps; track s) {
          <li [class.done]="reached(o.stage, s)" [class.now]="o.stage === s" [attr.aria-current]="o.stage === s ? 'step' : null">{{ label(s) }}</li>
        }</ol>
      }
      <div class="layout">
        <div class="main">
          <!-- Состав по лавкам: у каждой своя сборка, свой возврат и свой чат -->
          @for (g of groups(); track g.shop) {
            <section class="shop" [attr.aria-label]="'Лавка @' + g.shop">
              <div class="shop-head">
                <a class="shop-name" [routerLink]="['/shop', g.shop]">&#64;{{ g.shop }}</a>
                @if (auth.loggedIn()) {
                  <a class="shop-chat" routerLink="/chats/new" [queryParams]="{ shop: g.shop }"><app-icon name="message-circle" [size]="16" />Написать лавке</a>
                }
              </div>
              <ul class="lines">
                @for (l of g.lines; track $index) {
                  <li class="line" data-test="line">
                    <a class="thumb" [routerLink]="['/product', l.product_id]" tabindex="-1" aria-hidden="true">
                      @if (l.image) { <img [src]="l.image" alt="" loading="lazy" /> }
                    </a>
                    <div class="info">
                      <a class="t" [routerLink]="['/product', l.product_id]">{{ l.title }}</a>
                      <p class="meta">@if (l.size) { Размер {{ l.size }} · }{{ l.qty }} шт × {{ l.price | money }}</p>
                    </div>
                    <b class="price">{{ l.price * l.qty | money }}</b>
                    @if (rateFor(l); as r) {
                      <div class="rate" data-test="rate">
                        @if (!r.review) { <p class="rate-q">Как вам товар?</p> }
                        <app-rate-item [item]="r" [compact]="true" (saved)="rated($event)" />
                      </div>
                    }
                  </li>
                }
              </ul>
            </section>
          }
          @if (auth.loggedIn() && o.stage === 'delivered') { <app-returns class="returns" [order]="o.number" /> }
        </div>
        <aside class="side">
          <div class="summary bill">
            <h2 class="side-title">Доставка</h2>
            <p class="where">{{ slot(o) }}<br />{{ o.customer.district }}, {{ o.customer.address }}</p>
            <dl>
              <div class="row"><dt>Товары</dt><dd>{{ o.items_total | money }}</dd></div>
              <div class="row"><dt>Доставка</dt><dd>{{ o.delivery_total | money }}</dd></div>
              <div class="row total"><dt>{{ o.stage === 'delivered' ? 'Оплачено' : 'Наличными курьеру' }}</dt><dd>{{ o.items_total + o.delivery_total | money }}</dd></div>
            </dl>
          </div>
        </aside>
      </div>
      <ng-container [ngTemplateOutlet]="actions" />
    } @else {
      <!-- Заглушка загрузки: номер и дата, этапы, строки состава и сводка доставки справа -->
      <div role="status" data-test="skel-order">
        <span class="sr-only">Загрузка…</span>
        <div aria-hidden="true">
          <span class="skel skel--line title-skel"></span>
          <span class="skel skel--line sub-skel"></span>
          <div class="steps-skel">@for (w of stepSkeleton; track $index) { <span class="skel" [style.width.px]="w"></span> }</div>
          <div class="layout">
            <div class="main">
              <div class="shop-head"><span class="skel skel--line shop-skel"></span></div>
              @for (n of [1, 2]; track n) {
                <div class="line">
                  <span class="skel thumb"></span>
                  <div class="info"><span class="skel skel--line t-skel"></span><span class="skel skel--line meta-skel"></span></div>
                  <span class="skel skel--line price-skel"></span>
                </div>
              }
            </div>
            <app-skel-summary class="side" [actions]="false" />
          </div>
        </div>
      </div>
    } }
    </div>
    <ng-template #actions>
      <div class="actions">
        <!-- Купить то же самое снова — у заказов, которые уже закончились -->
        @if (canRepeat()) {
          <button type="button" class="btn" data-test="repeat" [disabled]="repeating()" (click)="repeat(order()!)">{{ repeating() ? 'Добавляем…' : 'Повторить заказ' }}</button>
        }
        <a class="btn" [class.btn--ghost]="canRepeat()" routerLink="/">Продолжить покупки</a>
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
    /* Заглушка загрузки: заголовок 34px, этапы-пилюли 40px (на телефоне — строки списка), строки состава */
    .title-skel { height: 34px; width: min(280px, 80%); margin-block: 4px }
    .sub-skel { margin-top: 10px; width: 180px }
    .steps-skel { margin-top: 20px; display: flex; flex-wrap: wrap; gap: 8px }
    .steps-skel .skel { height: 40px; border-radius: 9999px }
    @media (max-width: 640px) { .steps-skel { flex-direction: column; gap: 14px } .steps-skel .skel { height: 20px; border-radius: 10px } }
    .shop-skel { width: 120px; height: 17px; margin-block: 14px 13px }
    .t-skel { width: 75%; margin-top: 3px }
    .meta-skel { width: 45%; margin-top: 10px; height: 12px }
    .price-skel { width: 64px; margin-top: 4px }
    .back { display: inline-flex; align-items: center; gap: 4px; min-height: 44px; margin: -8px 0 4px -4px; padding-right: 8px; font-size: 15px; font-weight: 600; color: var(--color-lapis) }
    @media (hover: hover) { .back:hover { text-decoration: underline; text-underline-offset: 3px } }
    .sub { margin-top: 4px; color: var(--color-ink-soft) }
    /* Состав слева, доставка и сумма справа; на телефоне сумма уходит под состав */
    .layout { margin-top: 32px; display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 48px; align-items: start }
    .side { position: sticky; top: 96px }
    @media (max-width: 899.98px) { .layout { grid-template-columns: minmax(0, 1fr); gap: 32px } .side { position: static } }
    .shop + .shop { margin-top: 32px }
    .shop-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 16px; padding-bottom: 8px; border-bottom: 1px solid var(--color-line) }
    .shop-name { font-size: 17px; font-weight: 700; overflow-wrap: anywhere }
    .shop-chat { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; font-size: 15px; font-weight: 600; color: var(--color-lapis) }
    @media (hover: hover) { .shop-name:hover, .shop-chat:hover { text-decoration: underline; text-underline-offset: 3px } }
    .line { display: grid; grid-template-columns: 88px minmax(0, 1fr) auto; column-gap: 16px; padding-block: 16px; border-bottom: 1px solid var(--color-line) }
    /* Фото на две строки сетки: оценка встаёт сразу под названием, а не под фото */
    .thumb { position: relative; grid-row: 1 / span 2; width: 88px; height: 88px; overflow: hidden; border-radius: 12px; background: var(--color-mist) }
    .thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover }
    .info { min-width: 0; padding-top: 2px }
    .t { font-weight: 600; line-height: 1.4; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden }
    @media (hover: hover) { .t:hover { text-decoration: underline; text-underline-offset: 3px } }
    .meta { margin-top: 4px; font-size: 14px; color: var(--color-ink-soft); font-variant-numeric: tabular-nums }
    .price { padding-top: 2px; font-variant-numeric: tabular-nums; white-space: nowrap }
    /* Оценка — под названием, на всю оставшуюся ширину строки */
    .rate { grid-column: 2 / -1; margin-top: 8px }
    .rate-q { font-size: 14px; font-weight: 600 }
    @media (max-width: 639.98px) {
      .line { grid-template-columns: 72px minmax(0, 1fr); column-gap: 12px }
      .thumb { grid-row: 1 / span 2; width: 72px; height: 72px }
      .price { grid-column: 2; padding-top: 6px }
      .rate { grid-column: 1 / -1 }
    }
    .returns { display: block; margin-top: 40px }
    .side-title { font-size: 17px; font-weight: 700 }
    .where { margin-top: 6px; margin-bottom: 16px; font-size: 15px; line-height: 1.5; color: var(--color-ink-soft); overflow-wrap: anywhere }
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
  private readonly repeater = inject(RepeatOrderService);
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
  /** Повтор только у завершённых заказов: доставлен или отменён. */
  readonly canRepeat = computed(() => { const s = this.order()?.stage; return s === 'delivered' || s === 'cancelled'; });
  /** Идёт повтор: кнопка недоступна, второе нажатие не запускает его снова. */
  readonly repeating = signal(false);
  readonly error = signal('');
  /** Показать форму «Найти заказ». */
  readonly lookup = signal(false);
  /** Форма открыта после неудачного запроса — объясняем, что заказ не найден. */
  readonly lookupMiss = signal(false);
  readonly steps = STEPS;
  /** Ширины серых пилюль этапов, пока заказ грузится. */
  readonly stepSkeleton = [104, 132, 120, 112];
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

  /** Полученные товары этого заказа, которые можно оценить (только вошедшему, только доставленный заказ). */
  readonly reviewables = signal<Reviewable[]>([]);
  /** Строки заказа по лавкам в порядке появления. */
  readonly groups = computed(() => {
    const out: { shop: string; lines: OrderLine[] }[] = [];
    for (const l of this.order()?.lines ?? []) {
      const g = out.find((x) => x.shop === l.shop_handle);
      if (g) g.lines.push(l); else out.push({ shop: l.shop_handle, lines: [l] });
    }
    return out;
  });

  /** Товары заказа — в корзину; тост и переход делает сервис. Ошибка тоже возвращает кнопку. */
  repeat(o: Order): void {
    if (this.repeating()) return;
    this.repeating.set(true);
    this.repeater.repeat(o).pipe(finalize(() => this.repeating.set(false))).subscribe({ error: () => undefined });
  }
  label(s: OrderStage): string { return STAGE_LABEL[s]; }
  day(iso: string): string { return dayMonth(iso); }
  count(o: Order): string {
    const n = o.lines.reduce((s, l) => s + l.qty, 0);
    return `${n} ${plural(n, ['товар', 'товара', 'товаров'])}`;
  }
  rateFor(l: OrderLine): Reviewable | undefined { return this.reviewables().find((r) => r.product_id === String(l.product_id)); }
  rated(next: Reviewable): void {
    this.reviewables.update((list) => list.map((r) => (r.product_id === next.product_id ? next : r)));
  }
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
    // Заголовок вкладки — по тому, что на экране: номер заказа или форма поиска
    const title = inject(Title);
    effect(() => {
      const o = this.order();
      title.setTitle(o ? `Заказ ${o.number} — Харид` : this.lookup() ? 'Найти заказ — Харид' : 'Заказ — Харид');
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

  /** Отзывы требуют Bearer и полученный товар: гостю по ссылке и до доставки не запрашиваем. */
  private loadReviewables(o: Order): void {
    if (!this.auth.loggedIn() || o.stage !== 'delivered') return;
    this.api.reviewable().subscribe({
      next: (list) => { if (this.order()?.number === o.number) this.reviewables.set(list.filter((r) => r.order_number === o.number)); },
      error: () => this.reviewables.set([]),
    });
  }

  private reset(): void {
    this.current?.unsubscribe();
    this.current = null;
    this.reviewables.set([]);
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
      next: (o) => { this.order.set(o); this.loadReviewables(o); },
      error: (e) => {
        if (e instanceof HttpErrorResponse && LOOKUP_STATUSES.includes(e.status)) this.showLookup(number, true);
        else this.error.set(apiErrorMessage(e));
      },
    });
  }
}
