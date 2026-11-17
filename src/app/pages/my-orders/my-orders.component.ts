import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { STAGE_LABEL } from '../../core/checkout-options';
import { MarketApi } from '../../core/market-api.service';
import { Order } from '../../core/models';
import { phone9 } from '../../core/phone';
import { MoneyPipe } from '../../shared/money.pipe';

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [RouterLink, MoneyPipe, DatePipe],
  template: `
    <h1>Мои заказы</h1>
    @if (!auth.ready()) { <p class="muted">Загрузка…</p> }
    @else {
      @if (error()) { <p class="error">{{ error() }}</p> }
      @for (o of orders(); track o.number) {
        <a class="row" [routerLink]="['/order', o.number]" [queryParams]="{ phone: phone9(o.customer.phone) }">
          <b>{{ o.number }}</b><span class="muted">{{ o.created_at | date: 'dd.MM.yyyy' }}</span>
          <span>{{ label[o.stage] }}</span><b>{{ o.items_total + o.delivery_total | money }}</b>
        </a>
      } @empty {
        @if (!error()) { <p class="muted">Заказов пока нет</p> }
      }
      <button class="btn btn--ghost" type="button" (click)="logout()">Выйти</button>
    }
  `,
  styles: `
    .row { display:grid; grid-template-columns:auto auto 1fr auto; gap:12px; padding:12px 0; border-bottom:1px solid var(--line); color:inherit; text-decoration:none }
    .btn { margin-top:24px }
  `,
})
export class MyOrdersComponent {
  private readonly api = inject(MarketApi);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly orders = signal<Order[]>([]);
  readonly error = signal('');
  readonly label = STAGE_LABEL;
  readonly phone9 = phone9;
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
