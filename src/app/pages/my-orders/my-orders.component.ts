import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { STAGE_LABEL } from '../../core/checkout-options';
import { MarketApi } from '../../core/market-api.service';
import { Order } from '../../core/models';
import { MoneyPipe } from '../../shared/money.pipe';
import { RatePurchasesComponent } from './rate-purchases.component';
import { ReturnsComponent } from './returns.component';

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [RouterLink, MoneyPipe, DatePipe, RatePurchasesComponent, ReturnsComponent],
  template: `
    <div class="wrap page-top">
      <h1 class="page-title head">Мои заказы</h1>
      @if (!auth.ready()) { <p class="muted">Загрузка…</p> }
      @else {
        @if (error()) { <p class="error">{{ error() }}</p> }
        <div class="list">
          @for (o of orders(); track o.number) {
            <!-- Без телефона в адресе: страница заказа узнаёт владельца по Bearer -->
            <a class="row" [routerLink]="['/order', o.number]">
              <b class="num">{{ o.number }}</b><span class="muted">{{ o.created_at | date: 'dd.MM.yyyy' }}</span>
              <span class="stage">{{ label[o.stage] }}</span><b class="sum">{{ o.items_total + o.delivery_total | money }}</b>
            </a>
          } @empty {
            @if (!error()) { <p class="muted">Заказов пока нет</p> }
          }
        </div>
        <!-- Только вошедшему: без сессии страница уже уходит на /login, а reviewable требует Bearer -->
        @if (auth.loggedIn()) { <app-returns class="rate" /> <app-rate-purchases class="rate" /> }
        <button class="btn btn--ghost out" type="button" (click)="logout()">Выйти</button>
      }
    </div>
  `,
  styles: `
    .head { margin-bottom: 32px }
    .list { max-width: 760px; border-top: 1px solid var(--color-line) }
    .row { display: grid; grid-template-columns: auto auto 1fr auto; align-items: center; gap: 12px; min-height: 56px; padding: 12px 0; border-bottom: 1px solid var(--color-line) }
    @media (hover: hover) { .row:hover .num { text-decoration: underline } }
    .num, .sum { font-weight: 600; font-variant-numeric: tabular-nums }
    .stage { color: var(--color-ink-soft) }
    @media (max-width: 639.98px) { .row { grid-template-columns: 1fr auto } .stage { grid-column: 1 } }
    .rate { margin-top: 48px }
    .out { margin-top: 32px }
  `,
})
export class MyOrdersComponent {
  private readonly api = inject(MarketApi);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly orders = signal<Order[]>([]);
  readonly error = signal('');
  readonly label = STAGE_LABEL;
  private requested = false;

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
          next: (o) => this.orders.set(o),
          error: (e) => {
            // 401: интерцептор уже вышел из аккаунта — отправляем на вход, а не показываем ошибку.
            if (e instanceof HttpErrorResponse && e.status === 401) {
              this.router.navigate(['/login'], { queryParams: { return: '/me/orders' } });
              return;
            }
            this.error.set(apiErrorMessage(e));
          },
        });
      });
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }
}
