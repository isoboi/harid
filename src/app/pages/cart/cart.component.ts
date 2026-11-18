import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService, MAX_QTY } from '../../core/cart.service';
import { deliveryFor, DISTRICTS, SUBURBS } from '../../core/checkout-options';
import { IconComponent } from '../../shared/icon.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { plural } from '../../shared/plural';

const money = new MoneyPipe();

/** Корзина как в прототипе: товары по лавкам слева, сводка в серой карточке справа (на десктопе — липкая). */
@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [RouterLink, MoneyPipe, IconComponent],
  template: `
    <div class="wrap page-top">
      <h1 class="page-title head">Корзина</h1>
      @if (!cart.ready()) { <p class="muted">Загрузка…</p> }
      @else if (!cart.count()) {
        <div class="empty">
          <p>В корзине пока пусто. Загляните в лавки — новые товары появляются каждый день.</p>
          <a class="btn" routerLink="/">Смотреть товары</a>
        </div>
      }
      @else {
        <div class="layout">
          <div class="groups">
            @for (g of cart.groups(); track g.shop_handle) {
              <section>
                <h2 class="shop">
                  <a [routerLink]="['/shop', g.shop_handle]">&#64;{{ g.shop_handle }}</a>
                  <span class="shop-note">Отдельная доставка от этой лавки</span>
                </h2>
                <ul class="rows">
                  @for (i of g.items; track i.product.id + (i.size ?? '')) {
                    <li class="row">
                      <a class="thumb" [routerLink]="['/product', i.product.id]" tabindex="-1" aria-hidden="true">
                        @if (i.product.image) { <img [src]="i.product.image" alt="" loading="lazy" /> }
                      </a>
                      <div class="body">
                        <div class="line">
                          <a class="t" [routerLink]="['/product', i.product.id]">{{ i.product.title }}</a>
                          <button type="button" class="x" (click)="cart.remove(i.product.id, i.size)" [attr.aria-label]="'Убрать «' + i.product.title + '» из корзины'"><app-icon name="x" [size]="18" /></button>
                        </div>
                        @if (i.size) { <p class="size">Размер: {{ i.size }}</p> }
                        <div class="foot">
                          <div class="qty">
                            <button type="button" (click)="cart.setQty(i.product.id, i.size, i.qty - 1)" aria-label="Меньше"><app-icon name="minus" [size]="16" /></button>
                            <span class="n">{{ i.qty }}</span>
                            <button type="button" [disabled]="i.qty >= maxQty" (click)="cart.setQty(i.product.id, i.size, i.qty + 1)" aria-label="Больше"><app-icon name="plus" [size]="16" /></button>
                          </div>
                          <span class="sum">{{ i.product.price * i.qty | money }}</span>
                        </div>
                      </div>
                    </li>
                  }
                </ul>
              </section>
            }
          </div>
          <aside class="summary side">
            <dl>
              <div><dt>Товары</dt><dd>{{ cart.itemsTotal() | money }}</dd></div>
              <div><dt>Доставка из {{ cart.groups().length }} {{ plural(cart.groups().length, shopForms) }}</dt><dd>{{ delivery() | money }}</dd></div>
              <div class="total"><dt>Итого</dt><dd>{{ cart.itemsTotal() + delivery() | money }}</dd></div>
            </dl>
            <p class="cash promise" data-test="cash-promise"><app-icon name="banknote" [size]="20" /><span>Оплата наличными курьеру · без предоплаты · проверяете товар при курьере</span></p>
            <a class="btn" routerLink="/checkout">Оформить заказ</a>
            <p class="note">{{ suburbNote }}</p>
          </aside>
        </div>
      }
    </div>
  `,
  styles: `
    .head { margin-bottom: 32px }
    .empty { max-width: 46ch }
    .empty p { font-size: 18px; line-height: 1.625 }
    .empty .btn { margin-top: 24px }
    .layout { display: grid; align-items: start; gap: 40px }
    @media (min-width: 1024px) { .layout { grid-template-columns: minmax(0, 1fr) 360px } .side { position: sticky; top: 96px } }
    .groups { display: flex; flex-direction: column; gap: 40px }
    .shop { display: flex; flex-direction: column; line-height: 1.25; font-weight: 600 }
    .shop-note { font-size: 13px; font-weight: 400; color: var(--color-ink-soft) }
    .rows { margin-top: 16px; border-block: 1px solid var(--color-line) }
    .row { display: flex; gap: 16px; padding-block: 16px }
    .row + .row { border-top: 1px solid var(--color-line) }
    .thumb { position: relative; flex: none; width: 96px; height: 96px; overflow: hidden; border-radius: 10px; background: var(--color-mist) }
    .thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover }
    .body { display: flex; flex: 1; min-width: 0; flex-direction: column }
    .line { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px }
    .t { font-weight: 500; overflow-wrap: anywhere }
    @media (hover: hover) { .t:hover { text-decoration: underline } .x:hover { color: var(--color-anor) } }
    /* Крестик: иконка 18px, кнопка 44px — поле нажатия выходит за отступы строки */
    .x { display: grid; place-items: center; flex: none; width: 44px; height: 44px; margin: -12px -12px 0 0; border-radius: var(--radius-md); color: var(--color-ink-soft) }
    .size { font-size: 14px; color: var(--color-ink-soft) }
    .foot { margin-top: auto; padding-top: 8px; display: flex; align-items: center; justify-content: space-between; gap: 12px }
    .qty { display: flex; align-items: center; border: 1px solid var(--color-line); border-radius: 10px }
    .qty button { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 9px }
    @media (hover: hover) { .qty button:hover:not(:disabled) { background: var(--color-mist) } }
    .qty button:disabled { opacity: .4 }
    @media (max-width: 639.98px) { .qty button { width: 44px; height: 44px } }
    .n { width: 32px; text-align: center; font-weight: 600; font-variant-numeric: tabular-nums }
    .sum { font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap }
    .promise { margin-top: 20px; font-size: 14px }
    /* Телефон: текстовые ссылки получают поле нажатия 44px без сдвига вёрстки */
    @media (max-width: 639.98px) { .t, .shop a { display: inline-block; padding-block: 10px; margin-block: -10px } }
  `,
})
export class CartComponent {
  readonly cart = inject(CartService);
  readonly maxQty = MAX_QTY;
  readonly plural = plural;
  readonly shopForms: [string, string, string] = ['лавки', 'лавок', 'лавок'];
  /** Доставка по Душанбе за каждую лавку; пригород дороже — уточним на оформлении. */
  readonly delivery = computed(() => this.cart.deliveryTotal(DISTRICTS[0]));
  readonly suburbNote = `Доставка в ${SUBURBS.join(' и ')} — ${money.transform(deliveryFor(SUBURBS[0]))} за лавку. Точная сумма будет на следующем шаге.`;
}
