import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService, MAX_QTY } from '../../core/cart.service';
import { IconComponent } from '../../shared/icon.component';
import { MoneyPipe } from '../../shared/money.pipe';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [RouterLink, MoneyPipe, IconComponent],
  template: `
    <h1>Корзина</h1>
    @if (!cart.ready()) { <p class="muted">Загрузка…</p> }
    @else if (!cart.count()) { <p class="muted">В корзине пока пусто. <a routerLink="/">К товарам</a></p> }
    @else {
      @for (g of cart.groups(); track g.shop_handle) {
        <section class="group">
          <h2>&#64;{{ g.shop_handle }}</h2>
          @for (i of g.items; track i.product.id + (i.size ?? '')) {
            <div class="row">
              <a [routerLink]="['/product', i.product.id]" class="t">{{ i.product.title }}@if (i.size) { <span class="muted"> · {{ i.size }}</span> }</a>
              <div class="qty">
                <button type="button" (click)="cart.setQty(i.product.id, i.size, i.qty - 1)" aria-label="Меньше">−</button>
                <span>{{ i.qty }}</span>
                <button type="button" [disabled]="i.qty >= maxQty" (click)="cart.setQty(i.product.id, i.size, i.qty + 1)" aria-label="Больше">+</button>
              </div>
              <b>{{ i.product.price * i.qty | money }}</b>
              <button type="button" class="x" (click)="cart.remove(i.product.id, i.size)" aria-label="Убрать">×</button>
            </div>
          }
        </section>
      }
      <div class="sum"><span>Товары</span><b>{{ cart.itemsTotal() | money }}</b></div>
      <p class="muted small">Доставка — {{ cart.groups().length > 1 ? 'за каждую лавку, ' : '' }}посчитаем на следующем шаге.</p>
      <div class="cash" data-test="cash-promise"><app-icon name="banknote" [size]="20" /><span>Оплата наличными курьеру · без предоплаты · проверяете товар при курьере</span></div>
      <a class="btn" routerLink="/checkout">Оформить заказ</a>
    }
  `,
  styles: `
    .group { border:1px solid var(--line); border-radius:var(--radius); padding:12px 16px; margin-bottom:12px } .group h2 { font-size:16px; margin:0 0 8px }
    .row { display:grid; grid-template-columns:1fr auto auto auto; gap:12px; align-items:center; padding:8px 0 } .t { color:inherit; text-decoration:none }
    .qty { display:flex; gap:8px; align-items:center } .qty button, .x { border:1px solid var(--line); background:none; border-radius:8px; width:28px; height:28px }
    .sum { display:flex; justify-content:space-between; font-size:18px; margin:16px 0 4px } .small { font-size:13px; margin:0 } a.btn { display:inline-block; text-decoration:none; margin-top:12px }
    /* Обещание оплаты над кнопкой — там, где покупатель решается */
    .cash { display:flex; gap:10px; align-items:flex-start; max-width:520px; margin-top:16px; padding:12px 14px; border-radius:12px; background:var(--surface); font-size:14px; line-height:1.4 } .cash app-icon { color:var(--accent-strong); margin-top:-1px }
  `,
})
export class CartComponent {
  readonly cart = inject(CartService);
  readonly maxQty = MAX_QTY;
}
