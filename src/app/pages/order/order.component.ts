import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
import { STAGE_LABEL } from '../../core/checkout-options';
import { MarketApi } from '../../core/market-api.service';
import { Order, OrderStage } from '../../core/models';
import { MoneyPipe } from '../../shared/money.pipe';

const STEPS: OrderStage[] = ['placed', 'assembling', 'in_delivery', 'delivered'];

@Component({
  selector: 'app-order',
  standalone: true,
  imports: [RouterLink, MoneyPipe],
  template: `
    @if (error()) { <p class="error">{{ error() }}</p><a routerLink="/">На главную</a> }
    @else {
      @if (order(); as o) {
        <h1>Заказ {{ o.number }}</h1>
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
    .stage { font-size:20px; font-weight:700 } .steps { display:flex; gap:8px; padding:0; list-style:none; flex-wrap:wrap }
    .steps li { padding:6px 12px; border-radius:999px; background:var(--surface); color:var(--muted); font-size:13px } .steps li.done { background:var(--text); color:#fff }
    .row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--line) } .total { font-size:18px; border:0 }
  `,
})
export class OrderComponent {
  private readonly api = inject(MarketApi);
  readonly number = input.required<string>();
  readonly phone = input<string>('');
  readonly order = signal<Order | null>(null);
  readonly error = signal('');
  readonly steps = STEPS;
  label(s: OrderStage): string { return STAGE_LABEL[s]; }
  reached(cur: OrderStage, s: OrderStage): boolean { return STEPS.indexOf(cur) >= STEPS.indexOf(s); }
  constructor() {
    effect(() => {
      this.api.order(this.number(), this.phone() ?? '').subscribe({
        next: (o) => this.order.set(o),
        error: (e) => this.error.set(apiErrorMessage(e)),
      });
    });
  }
}
