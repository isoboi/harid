import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { STAGE_LABEL } from '../../core/checkout-options';
import { MarketApi } from '../../core/market-api.service';
import { Order, OrderStage } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { MoneyPipe } from '../../shared/money.pipe';

const STEPS: OrderStage[] = ['placed', 'assembling', 'in_delivery', 'delivered'];

@Component({
  selector: 'app-order',
  standalone: true,
  imports: [RouterLink, MoneyPipe, IconComponent],
  template: `
    @if (error()) { <p class="error">{{ error() }}</p><a routerLink="/">На главную</a> }
    @else {
      @if (!order()) { <p class="muted">Загрузка…</p> }
      @if (order(); as o) {
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
              <li>Курьер привезёт: {{ o.slot }}</li>
              <li>Приготовьте <b>{{ o.items_total + o.delivery_total | money }}</b> наличными</li>
              <li>Проверьте товар при курьере — не подошло, не берёте</li>
            </ul>
          </section>
        } @else {
          <h1>Заказ {{ o.number }}</h1>
        }
        <p class="stage">{{ label(o.stage) }}</p>
        @if (o.stage !== 'cancelled') {
          <ol class="steps">@for (s of steps; track s) { <li [class.done]="reached(o.stage, s)">{{ label(s) }}</li> }</ol>
        }
        <p class="muted">{{ o.slot }} · {{ o.customer.district }}, {{ o.customer.address }}</p>
        @for (l of o.lines; track $index) {
          <div class="row"><span>{{ l.title }}@if (l.size) { · {{ l.size }} } × {{ l.qty }}</span><b>{{ l.price * l.qty | money }}</b></div>
        }
        <div class="row"><span>Доставка</span><b>{{ o.delivery_total | money }}</b></div>
        <div class="row total"><span>Наличными курьеру</span><b>{{ o.items_total + o.delivery_total | money }}</b></div>
      }
    }
  `,
  styles: `
    .confirm { margin:8px 0 24px; padding:20px; border-radius:var(--radius); background:var(--surface) }
    .confirm-head { display:flex; gap:12px; align-items:flex-start } .confirm-head app-icon { color:var(--accent-strong); margin-top:2px }
    .confirm h1 { margin:0; font-size:24px; line-height:1.2; letter-spacing:-0.02em; text-wrap:balance } .num { margin:4px 0 0; color:var(--muted) } .num b { color:var(--text); font-variant-numeric:tabular-nums }
    .next { margin:16px 0 0; padding:0 0 0 40px; display:flex; flex-direction:column; gap:8px; line-height:1.4 }
    .stage { font-size:20px; font-weight:700 } .steps { display:flex; gap:8px; padding:0; list-style:none; flex-wrap:wrap }
    .steps li { padding:6px 12px; border-radius:999px; background:var(--surface); color:var(--muted); font-size:13px } .steps li.done { background:var(--text); color:#fff }
    /* Телефон: этапы — вертикальный список с точками вместо переносящихся пилюль */
    @media (max-width: 640px) {
      .next { padding-left:20px }
      .steps { flex-direction:column; gap:0 }
      .steps li { position:relative; padding:5px 0 5px 22px; background:none; font-size:14px }
      .steps li::before { content:''; position:absolute; left:2px; top:50%; width:10px; height:10px; margin-top:-5px; border-radius:50%; border:2px solid var(--line); background:var(--bg); box-sizing:border-box }
      .steps li.done { background:none; color:var(--text) } .steps li.done::before { border-color:var(--text); background:var(--text) }
    }
    .row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--line) } .total { font-size:18px; border:0 }
  `,
})
export class OrderComponent {
  private readonly api = inject(MarketApi);
  private readonly auth = inject(AuthService);
  readonly number = input.required<string>();
  readonly phone = input<string>('');
  /** fresh=1 из адреса: checkout ставит его при переходе сюда сразу после заказа. */
  readonly fresh = input<string>('');
  readonly isFresh = computed(() => this.fresh() === '1');
  readonly order = signal<Order | null>(null);
  readonly error = signal('');
  readonly steps = STEPS;
  label(s: OrderStage): string { return STAGE_LABEL[s]; }
  reached(cur: OrderStage, s: OrderStage): boolean { return STEPS.indexOf(cur) >= STEPS.indexOf(s); }
  constructor() {
    // Ждём гидратацию auth: токен нужен покупателю при перезагрузке. Смена номера/телефона отменяет прежний запрос.
    effect((onCleanup) => {
      if (!this.auth.ready()) return;
      const number = this.number();
      const phone = this.phone();
      const sub = untracked(() => this.load(number, phone));
      onCleanup(() => sub.unsubscribe());
    });
  }

  private load(number: string, phone: string): Subscription {
    this.order.set(null);
    this.error.set('');
    return this.api.order(number, phone).subscribe({
      next: (o) => this.order.set(o),
      error: (e) => this.error.set(apiErrorMessage(e)),
    });
  }
}
