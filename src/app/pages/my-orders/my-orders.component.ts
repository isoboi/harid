import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { dayMonth, STAGE_LABEL } from '../../core/checkout-options';
import { MarketApi } from '../../core/market-api.service';
import { MarketReturn, Order, OrderStage, ReturnableOrder, Reviewable } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { plural } from '../../shared/plural';

/** Сколько превью товаров в строке заказа; остальное — плашкой «+N». */
const THUMBS = 4;
const ACTIVE: OrderStage[] = ['placed', 'assembling', 'in_delivery'];

/** Что по заказу ждёт покупателя: возврат в работе, срок возврата, неоценённые товары. */
type Hint = { kind: 'return' | 'deadline' | 'rate'; text: string };

/** Короткие статусы возврата для строки списка; подробности — на странице заказа. */
const RETURN_HINT: Record<MarketReturn['status'], string> = {
  requested: 'Возврат: ждёт ответа лавки',
  approved: 'Возврат одобрен — передайте товар',
  refunded: 'Деньги за возврат вернули',
  rejected: 'Лавка отказала в возврате',
  cancelled: '',
};

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [RouterLink, MoneyPipe, IconComponent],
  template: `
    <div class="wrap page-top">
      <h1 class="page-title head">Мои заказы</h1>
      @if (!auth.ready()) { <p class="muted">Загрузка…</p> }
      @else {
        @if (error()) { <p class="error">{{ error() }}</p> }
        @if (loaded() && !orders().length && !error()) {
          <div class="empty">
            <p>Заказов пока нет</p>
            <a class="btn" routerLink="/">Перейти к покупкам</a>
          </div>
        }
        @for (g of groups(); track g.title) {
          <section class="group" [attr.aria-label]="g.title">
            @if (groups().length > 1) { <h2 class="group-title">{{ g.title }}</h2> }
            <ul class="list">
              @for (o of g.orders; track o.number) {
                <li>
                  <!-- Без телефона в адресе: страница заказа узнаёт владельца по Bearer -->
                  <a class="row" [routerLink]="['/order', o.number]">
                    <div class="thumbs" aria-hidden="true">
                      @for (l of o.lines.slice(0, thumbs); track $index) {
                        <span class="thumb">@if (l.image) { <img [src]="l.image" alt="" loading="lazy" /> }</span>
                      }
                      @if (o.lines.length > thumbs) { <span class="thumb more">+{{ o.lines.length - thumbs }}</span> }
                    </div>
                    <div class="body">
                      <p class="top">
                        <span class="stage" [attr.data-stage]="o.stage">{{ label[o.stage] }}</span>
                        <span class="muted">{{ day(o.created_at) }}</span>
                      </p>
                      <p class="what">{{ summary(o) }}</p>
                      <p class="meta"><span class="num">{{ o.number }}</span>@if (shops(o)) { · {{ shops(o) }} }</p>
                      @if (hints().get(o.number); as hs) {
                        <ul class="hints">
                          @for (h of hs; track h.kind) {
                            <li class="hint" [attr.data-kind]="h.kind">
                              @if (h.kind === 'rate') { <app-icon name="star" [size]="14" [filled]="true" /> }
                              {{ h.text }}
                            </li>
                          }
                        </ul>
                      }
                    </div>
                    <div class="end">
                      <b class="sum">{{ o.items_total + o.delivery_total | money }}</b>
                      <app-icon class="go" name="chevron-right" [size]="20" />
                    </div>
                  </a>
                </li>
              }
            </ul>
          </section>
        }
        <button class="btn btn--ghost out" type="button" (click)="logout()">Выйти</button>
      }
    </div>
  `,
  styles: `
    .head { margin-bottom: 24px }
    .group { max-width: 860px }
    .group + .group { margin-top: 40px }
    .group-title { margin-bottom: 8px; font-size: 20px; font-weight: 700; letter-spacing: -0.02em }
    .list { border-top: 1px solid var(--color-line) }
    .list > li { border-bottom: 1px solid var(--color-line) }
    .row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 20px; align-items: start; padding: 20px 8px; margin-inline: -8px; border-radius: 14px; transition: background-color .15s }
    @media (hover: hover) { .row:hover { background: var(--color-mist) } .row:hover .what { text-decoration: underline; text-underline-offset: 3px } }
    .row:focus-visible { outline: 2px solid var(--color-lapis); outline-offset: -2px }
    /* Превью внахлёст: видно, что внутри, без раскрытия */
    /* Ширина под 4 превью и «+N»: текст всех строк начинается с одной линии */
    .thumbs { display: flex; width: 236px; padding-left: 16px }
    .thumb { position: relative; display: grid; place-items: center; flex: none; width: 60px; height: 60px; margin-left: -16px; overflow: hidden; border: 2px solid var(--color-paper); border-radius: 12px; background: var(--color-mist) }
    .thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover }
    .thumb.more { font-size: 14px; font-weight: 700; color: var(--color-ink-soft) }
    .body { min-width: 0 }
    .top { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; font-size: 14px }
    .stage { display: inline-flex; align-items: center; gap: 6px; font-weight: 700 }
    .stage::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--color-lapis) }
    .stage[data-stage='delivered'] { color: var(--color-ink-soft) }
    .stage[data-stage='delivered']::before { background: var(--color-ink-soft) }
    .stage[data-stage='cancelled'] { color: var(--color-anor) }
    .stage[data-stage='cancelled']::before { background: var(--color-anor) }
    .what { margin-top: 6px; font-weight: 600; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
    .meta { margin-top: 2px; font-size: 14px; color: var(--color-ink-soft); overflow-wrap: anywhere }
    .num { font-variant-numeric: tabular-nums }
    .hints { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px }
    .hint { display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 0 10px; border-radius: 9999px; background: var(--color-mist); font-size: 13px; font-weight: 600; color: var(--color-ink) }
    .hint[data-kind='deadline'] { color: var(--color-lapis) }
    .hint app-icon { display: inline-flex; color: var(--color-saffron) }
    .end { display: flex; align-items: center; gap: 4px; padding-top: 20px }
    .sum { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap }
    .go { display: inline-flex; color: var(--color-ink-soft) }
    .empty { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; padding: 32px 0; color: var(--color-ink-soft) }
    @media (max-width: 639.98px) {
      .row { grid-template-columns: minmax(0, 1fr) auto; gap: 12px 16px }
      .thumbs { grid-column: 1 / -1; width: auto }
      .thumb { width: 56px; height: 56px }
      .end { grid-column: 2; grid-row: 2; padding-top: 0 }
      .what { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical }
    }
    .out { margin-top: 40px }
  `,
})
export class MyOrdersComponent {
  private readonly api = inject(MarketApi);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly orders = signal<Order[]>([]);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly label = STAGE_LABEL;
  readonly thumbs = THUMBS;
  private readonly returns = signal<MarketReturn[]>([]);
  private readonly returnable = signal<ReturnableOrder[]>([]);
  private readonly reviewable = signal<Reviewable[]>([]);
  private requested = false;

  /** Активные сверху: их ждут; остальные — история. Одна группа — без заголовка. */
  readonly groups = computed(() => {
    const active = this.orders().filter((o) => ACTIVE.includes(o.stage));
    const done = this.orders().filter((o) => !ACTIVE.includes(o.stage));
    return [
      { title: 'Активные', orders: active },
      { title: 'Завершённые', orders: done },
    ].filter((g) => g.orders.length);
  });

  readonly hints = computed(() => {
    const map = new Map<string, Hint[]>();
    const add = (n: string | null, h: Hint) => { if (n) map.set(n, [...(map.get(n) ?? []), h]); };
    // Свежий возврат по заказу важнее старых: список приходит новыми сверху
    const seen = new Set<string>();
    for (const r of this.returns()) {
      if (!r.number || seen.has(r.number) || !RETURN_HINT[r.status]) continue;
      seen.add(r.number);
      add(r.number, { kind: 'return', text: RETURN_HINT[r.status] });
    }
    const deadlines = new Map<string, string>();
    for (const o of this.returnable()) {
      if (o.number && (!deadlines.has(o.number) || o.deadline < deadlines.get(o.number)!)) deadlines.set(o.number, o.deadline);
    }
    deadlines.forEach((d, n) => add(n, { kind: 'deadline', text: `Можно вернуть до ${dayMonth(d)}` }));
    const unrated = new Map<string, number>();
    for (const r of this.reviewable()) if (!r.review) unrated.set(r.order_number, (unrated.get(r.order_number) ?? 0) + 1);
    unrated.forEach((n, num) => add(num, { kind: 'rate', text: `Оцените ${n} ${plural(n, ['товар', 'товара', 'товаров'])}` }));
    return map;
  });

  constructor() {
    // Не проверяем вход в конструкторе: до hydrate() сессия пуста даже у вошедшего покупателя.
    effect(() => {
      if (!this.auth.ready()) return;
      untracked(() => {
        if (this.requested) return;
        this.requested = true;
        if (!this.auth.loggedIn()) {
          this.router.navigate(['/login'], { queryParams: { return: '/me/orders' } });
          return;
        }
        this.api.myOrders().subscribe({
          next: (o) => { this.orders.set(o); this.loaded.set(true); },
          error: (e) => {
            // 401: интерцептор уже вышел из аккаунта — отправляем на вход, а не показываем ошибку.
            if (e instanceof HttpErrorResponse && e.status === 401) {
              this.router.navigate(['/login'], { queryParams: { return: '/me/orders' } });
              return;
            }
            this.error.set(apiErrorMessage(e));
          },
        });
        // Подсказки к строкам — необязательны: ошибка любого из списков просто убирает их
        this.api.myReturns().subscribe({ next: (l) => this.returns.set(l), error: () => undefined });
        this.api.returnable().subscribe({ next: (l) => this.returnable.set(l), error: () => undefined });
        this.api.reviewable().subscribe({ next: (l) => this.reviewable.set(l), error: () => undefined });
      });
    });
  }

  day(iso: string): string { return dayMonth(iso); }

  /** «Платье» · «Платье и ещё 2 товара»; пустой заказ — по номеру. */
  summary(o: Order): string {
    if (!o.lines.length) return `Заказ ${o.number}`;
    const rest = o.lines.length - 1;
    return rest ? `${o.lines[0].title} и ещё ${rest} ${plural(rest, ['товар', 'товара', 'товаров'])}` : o.lines[0].title;
  }

  shops(o: Order): string {
    const handles = [...new Set(o.lines.map((l) => l.shop_handle).filter(Boolean))];
    return handles.map((h) => '@' + h).join(', ');
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }
}
