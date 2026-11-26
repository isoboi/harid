import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { apiErrorMessage } from '../../core/api-error';
import { MarketApi } from '../../core/market-api.service';
import { ToastService } from '../../core/toast.service';
import { MarketReturn, ReturnableOrder, ReturnStatus } from '../../core/models';
import { MoneyPipe } from '../../shared/money.pipe';
import { plural } from '../../shared/plural';

const MIN_REASON = 5;
const MAX_REASON = 500;

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  requested: 'Ждёт ответа лавки',
  approved: 'Одобрен — передайте товар лавке',
  refunded: 'Деньги возвращены',
  rejected: 'Лавка отказала',
  cancelled: 'Вы отменили запрос',
};

/**
 * Блок «Возвраты» на «Моих заказах»: запросы покупателя со статусами и доставленные заказы,
 * из которых ещё можно вернуть товар (7 дней). Нет ни того, ни другого — блока нет.
 */
@Component({
  selector: 'app-returns',
  standalone: true,
  imports: [DatePipe, MoneyPipe],
  template: `
    @if (shownReturns().length || shownReturnable().length) {
      <section class="returns" aria-labelledby="returns-title">
        <h2 id="returns-title" class="title">{{ order() ? 'Возврат' : 'Возвраты' }}</h2>
        <p class="note">Товар можно вернуть в течение 7 дней после доставки. Деньги возвращает лавка.</p>
        @if (done()) { <p class="ok" role="status">Запрос отправлен. Лавка ответит здесь же.</p> }

        @if (shownReturns().length) {
          <ul class="list" data-test="returns">
            @for (r of shownReturns(); track r.id) {
              <li class="card">
                <p class="head">
                  @if (!order()) { <b>Заказ {{ r.number }}</b><span class="muted"> · </span> }
                  <span class="muted">&#64;{{ r.shop_handle }} · запрос от {{ r.created_at | date: 'dd.MM.yyyy' }}</span>
                </p>
                <p class="status" [attr.data-status]="r.status">{{ label[r.status] }}</p>
                <ul class="items">
                  @for (it of r.items; track it.line_id) {
                    <li>{{ it.title }}@if (it.size) { <span class="muted"> · {{ it.size }}</span> } × {{ it.qty }}</li>
                  }
                </ul>
                <p class="sum">К возврату: <b>{{ r.amount | money }}</b></p>
                @if (r.shop_comment) { <p class="reply"><span class="muted">Ответ лавки:</span> {{ r.shop_comment }}</p> }
                @if (r.status === 'requested') {
                  <button type="button" class="link" [disabled]="busy()" (click)="cancel(r)">Отменить запрос</button>
                }
              </li>
            }
          </ul>
        }

        @if (shownReturnable().length) {
          <h3 class="sub">Можно вернуть</h3>
          <ul class="list" data-test="returnable">
            @for (o of shownReturnable(); track o.order_id) {
              <li class="card">
                <p class="head">
                  @if (!order()) { <b>Заказ {{ o.number }}</b><span class="muted"> · </span> }
                  <span class="muted">&#64;{{ o.shop_handle }} · до {{ o.deadline | date: 'dd.MM.yyyy' }}</span>
                </p>
                @if (open() !== o.order_id) {
                  <button type="button" class="btn btn--ghost start" (click)="start(o)">Оформить возврат</button>
                } @else {
                  <fieldset class="form">
                    <legend class="sr-only">Что возвращаете из заказа {{ o.number }}</legend>
                    @for (l of o.lines; track l.line_id) {
                      <div class="line">
                        <label class="pick">
                          <input type="checkbox" [checked]="(qty()[l.line_id] || 0) > 0" (change)="toggle(l.line_id, $any($event.target).checked)" />
                          <span>{{ l.title }}@if (l.size) { <span class="muted"> · {{ l.size }}</span> } <span class="muted">· {{ l.price | money }}</span></span>
                        </label>
                        @if (l.available > 1 && (qty()[l.line_id] || 0) > 0) {
                          <span class="step">
                            <button type="button" [attr.aria-label]="'Меньше: ' + l.title" [disabled]="qty()[l.line_id] <= 1" (click)="bump(l.line_id, -1, l.available)">−</button>
                            <b aria-live="polite">{{ qty()[l.line_id] }}</b>
                            <button type="button" [attr.aria-label]="'Больше: ' + l.title" [disabled]="qty()[l.line_id] >= l.available" (click)="bump(l.line_id, 1, l.available)">+</button>
                          </span>
                        }
                      </div>
                    }
                    <label class="sr-only" [attr.for]="'return-reason-' + o.order_id">Причина возврата</label>
                    <textarea [id]="'return-reason-' + o.order_id" rows="3" [attr.maxlength]="maxReason" placeholder="Причина возврата: не подошёл размер, брак, не то прислали…"
                      [value]="reason()" (input)="reason.set($any($event.target).value)"></textarea>
                    @if (o.shop_phone) { <p class="hint">Как передать товар, договоритесь с лавкой: {{ o.shop_phone }}</p> }
                    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
                    <div class="actions">
                      <button type="button" class="btn" [disabled]="!canSend() || busy()" [attr.aria-describedby]="missing() ? 'return-missing-' + o.order_id : null"
                        (click)="send(o)">Отправить запрос@if (total(o)) { · {{ total(o) | money }} }</button>
                      <button type="button" class="link" (click)="close()">Отмена</button>
                    </div>
                    <!-- Без подсказки закрытая кнопка выглядит сломанной: называем, чего не хватает -->
                    @if (missing()) { <p class="missing" [id]="'return-missing-' + o.order_id" data-test="return-missing">{{ missing() }}</p> }
                  </fieldset>
                }
              </li>
            }
          </ul>
        }
      </section>
    }
  `,
  styles: `
    :host { display: block }
    .returns { max-width: 760px }
    .title { font-size: 22px; font-weight: 700 }
    .sub { margin-top: 28px; font-size: 17px; font-weight: 700 }
    .note { margin-top: 4px; font-size: 14px; color: var(--color-ink-soft) }
    .ok { margin-top: 12px; font-weight: 600; color: var(--color-lapis) }
    .list { margin-top: 12px; border-top: 1px solid var(--color-line) }
    .card { padding-block: 16px; border-bottom: 1px solid var(--color-line) }
    .head { overflow-wrap: anywhere }
    .status { margin-top: 4px; font-weight: 600 }
    .status[data-status='requested'] { color: var(--color-ink-soft) }
    .status[data-status='approved'], .status[data-status='refunded'] { color: var(--color-lapis) }
    .items { margin-top: 8px; font-size: 15px; line-height: 1.6 }
    .sum, .reply { margin-top: 6px; font-size: 15px }
    .reply { overflow-wrap: anywhere }
    .start { margin-top: 12px }
    .form { margin-top: 12px; padding: 0; border: 0; min-width: 0 }
    .line { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px }
    .pick { display: flex; align-items: center; gap: 10px; min-height: 44px; flex: 1; min-width: 0; cursor: pointer; overflow-wrap: anywhere }
    .pick input { flex: none; width: 20px; height: 20px; accent-color: var(--color-ink) }
    .step { display: inline-flex; align-items: center; gap: 4px; flex: none }
    .step button { width: 44px; height: 44px; border: 1px solid var(--color-line); border-radius: 10px; font-size: 20px }
    .step button:disabled { opacity: .4 }
    .step b { min-width: 28px; text-align: center; font-variant-numeric: tabular-nums }
    textarea { display: block; width: 100%; max-width: 560px; margin-top: 8px; padding: 10px 12px; border: 1px solid var(--color-field-line); border-radius: 10px; font: inherit; font-size: 16px; line-height: 1.5; resize: vertical; background: var(--color-paper); color: var(--color-ink) }
    textarea:focus-visible { outline: 2px solid var(--color-lapis); outline-offset: 1px }
    .hint { margin-top: 8px; font-size: 14px; color: var(--color-ink-soft) }
    .error { margin-top: 8px }
    .actions { margin-top: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 12px }
    .missing { margin-top: 8px; font-size: 14px; color: var(--color-ink-soft) }
    .link { min-height: 44px; padding: 0 4px; font-weight: 600; color: var(--color-lapis) }
    .link:disabled { opacity: .5 }
    @media (hover: hover) { .link:hover { text-decoration: underline } }
  `,
})
export class ReturnsComponent {
  private readonly api = inject(MarketApi);
  private readonly toasts = inject(ToastService);
  readonly returns = signal<MarketReturn[]>([]);
  readonly returnable = signal<ReturnableOrder[]>([]);
  /** Номер заказа: блок на странице заказа показывает только его возвраты. Пусто — все. */
  readonly order = input<string | null>(null);
  protected readonly shownReturns = computed(() => {
    const n = this.order();
    return n ? this.returns().filter((r) => r.number === n) : this.returns();
  });
  protected readonly shownReturnable = computed(() => {
    const n = this.order();
    return n ? this.returnable().filter((o) => o.number === n) : this.returnable();
  });
  protected readonly label = RETURN_STATUS_LABEL;
  protected readonly maxReason = MAX_REASON;
  /** Заявка, для которой открыта форма; одновременно — одна. */
  protected readonly open = signal<number | null>(null);
  /** Количество к возврату по строкам заявки; 0 — строка не выбрана. */
  protected readonly qty = signal<Record<number, number>>({});
  protected readonly reason = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly done = signal(false);
  protected readonly canSend = computed(
    () => Object.values(this.qty()).some((n) => n > 0) && this.reason().trim().length >= MIN_REASON,
  );
  /** Чего не хватает для отправки — словами под кнопкой; пусто, когда отправить можно. */
  protected readonly missing = computed(() => {
    const picked = Object.values(this.qty()).some((n) => n > 0);
    const left = MIN_REASON - this.reason().trim().length;
    if (!picked && left > 0) return `Отметьте товар и напишите причину — от ${MIN_REASON} символов`;
    if (!picked) return 'Отметьте товар, который возвращаете';
    if (left > 0) return `Причина: ещё ${left} ${plural(left, ['символ', 'символа', 'символов'])}`;
    return '';
  });

  constructor() {
    // Блок выводится только вошедшему покупателю после гидратации auth — запросы идут уже в браузере
    this.api.myReturns().subscribe({ next: (list) => this.returns.set(list), error: () => this.returns.set([]) });
    this.loadReturnable();
  }

  start(o: ReturnableOrder): void {
    this.open.set(o.order_id);
    // Одна строка в заявке — выбираем её сразу: спрашивать нечего
    this.qty.set(o.lines.length === 1 ? { [o.lines[0].line_id]: 1 } : {});
    this.reason.set(''); this.error.set(''); this.done.set(false);
  }
  close(): void { this.open.set(null); this.error.set(''); }

  toggle(lineId: number, on: boolean): void { this.qty.update((q) => ({ ...q, [lineId]: on ? 1 : 0 })); }
  bump(lineId: number, delta: number, max: number): void {
    this.qty.update((q) => ({ ...q, [lineId]: Math.min(max, Math.max(1, (q[lineId] || 1) + delta)) }));
  }
  total(o: ReturnableOrder): number {
    return o.lines.reduce((sum, l) => sum + l.price * (this.qty()[l.line_id] || 0), 0);
  }

  send(o: ReturnableOrder): void {
    if (!this.canSend() || this.busy()) return;
    const items = o.lines.filter((l) => (this.qty()[l.line_id] || 0) > 0).map((l) => ({ line_id: l.line_id, qty: this.qty()[l.line_id] }));
    this.busy.set(true); this.error.set('');
    this.api.createReturn({ order_id: o.order_id, reason: this.reason().trim().slice(0, MAX_REASON), items }).subscribe({
      next: (created) => {
        this.busy.set(false);
        this.open.set(null);
        this.done.set(true);
        this.returns.update((list) => [created, ...list]);
        this.loadReturnable();
      },
      error: (e) => { this.busy.set(false); this.error.set(apiErrorMessage(e)); },
    });
  }

  cancel(r: MarketReturn): void {
    if (this.busy()) return;
    this.busy.set(true); this.done.set(false);
    this.api.cancelReturn(r.id).subscribe({
      next: (next) => {
        this.busy.set(false);
        this.returns.update((list) => list.map((x) => (x.id === next.id ? next : x)));
        this.loadReturnable();
        this.toasts.show({ text: 'Запрос на возврат отменён' });
      },
      // Лавка успела ответить — перечитываем список, чтобы показать её решение
      error: () => {
        this.busy.set(false);
        this.toasts.error('Не удалось отменить: лавка уже ответила на запрос или нет сети');
        this.api.myReturns().subscribe({ next: (list) => this.returns.set(list), error: () => undefined });
      },
    });
  }

  private loadReturnable(): void {
    this.api.returnable().subscribe({ next: (list) => this.returnable.set(list), error: () => this.returnable.set([]) });
  }
}
