import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartItem, CartService, MAX_QTY } from '../../core/cart.service';
import { ToastService } from '../../core/toast.service';
import { deliveryFor, DISTRICTS, SUBURBS } from '../../core/checkout-options';
import { IconComponent } from '../../shared/icon.component';
import { RecentStripComponent } from '../../shared/recent-strip.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { plural } from '../../shared/plural';
import { SkelSummaryComponent } from '../../shared/skeleton.component';

const money = new MoneyPipe();
/** Сколько висит плашка «Товар убран · Вернуть». */
export const UNDO_MS = 6000;

/** Корзина как в прототипе: товары по лавкам слева, сводка в серой карточке справа (на десктопе — липкая). */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-cart',
  standalone: true,
  imports: [RouterLink, MoneyPipe, IconComponent, RecentStripComponent, SkelSummaryComponent],
  template: `
    <div class="wrap page-top">
      <h1 class="page-title head">Корзина</h1>
      @if (!cart.ready()) {
        <!-- Заглушка до чтения корзины из браузера: лавка с двумя строками и сводка справа -->
        <div class="layout" role="status" data-test="skel-cart">
          <span class="sr-only">Загрузка…</span>
          <div class="groups" aria-hidden="true">
            <section>
              <span class="skel skel--line shop-skel"></span>
              <span class="skel skel--line note-skel"></span>
              <div class="rows">
                @for (n of [1, 2]; track n) {
                  <div class="row">
                    <span class="skel thumb"></span>
                    <div class="body">
                      <span class="skel skel--line t-skel"></span>
                      <span class="skel skel--line t-skel t-skel--short"></span>
                      <div class="foot"><span class="skel qty-skel"></span><span class="skel skel--line sum-skel"></span></div>
                    </div>
                  </div>
                }
              </div>
            </section>
          </div>
          <app-skel-summary class="side" />
        </div>
      }
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
                        @if (thumb(i); as src) { <img [src]="src" alt="" loading="lazy" /> }
                      </a>
                      <div class="body">
                        <div class="line">
                          <a class="t" [routerLink]="['/product', i.product.id]">{{ i.product.title }}</a>
                          <button type="button" class="x" (click)="remove(i)" [attr.aria-label]="'Убрать «' + i.product.title + '» из корзины'"><app-icon name="x" [size]="18" /></button>
                        </div>
                        @if (i.size) { <p class="size">Размер: {{ i.size }}</p> }
                        <div class="foot">
                          <div class="qty">
                            <button type="button" [disabled]="i.qty <= 1" (click)="changeQty(i, i.qty - 1)" aria-label="Меньше"><app-icon name="minus" [size]="16" /></button>
                            <span class="n">{{ i.qty }}</span>
                            <button type="button" [disabled]="i.qty >= maxQty" (click)="changeQty(i, i.qty + 1)" aria-label="Больше"><app-icon name="plus" [size]="16" /></button>
                          </div>
                          <span class="sum">{{ (i.product.price ?? 0) * i.qty | money }}</span>
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
      <!-- «Вы смотрели» под содержимым корзины; то, что уже в корзине, не повторяем -->
      @if (cart.ready()) { <app-recent-strip class="recent" [exclude]="inCart()" /> }
    </div>
  `,
  styles: `
    .head { margin-bottom: 32px }
    .recent:has(section) { margin-top: 20px }
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
    /* Кнопки степпера 44×44 — цель для пальца на любом экране; иконка остаётся 16px */
    .qty button { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 9px }
    @media (hover: hover) { .qty button:hover:not(:disabled) { background: var(--color-mist) } }
    .qty button:disabled { opacity: .4 }
    .n { width: 32px; text-align: center; font-weight: 600; font-variant-numeric: tabular-nums }
    .sum { font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap }
    .promise { margin-top: 20px; font-size: 14px }
    /* Заглушка загрузки: строки в размер настоящих (превью 96, степпер 44px) */
    .shop-skel { width: 120px; height: 16px; margin-block: 2px }
    .note-skel { width: 210px; height: 12px; margin-top: 4px }
    .t-skel { width: 80%; margin-top: 5px }
    .t-skel--short { width: 50%; margin-top: 8px }
    .qty-skel { width: 122px; height: 46px }
    .sum-skel { width: 72px }
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
  /** id товаров в корзине — их полоса «Вы смотрели» не показывает. */
  readonly inCart = computed(() => this.cart.items().map((i) => i.product.id));
  private readonly toasts = inject(ToastService);
  /** id плашки «Товар убран · Вернуть» — её убираем при следующем действии с корзиной. */
  private undoToast = 0;

  /** Миниатюра из снимка товара в корзине: первое фото галереи, иначе обложка. */
  thumb(i: CartItem): string { return i.product.images?.[0] ?? i.product.image; }

  changeQty(i: CartItem, qty: number): void {
    this.dismissUndo();
    if (qty < 1) return; // «−» на 1 отключён: удаление только крестиком, с возможностью отмены
    this.cart.setQty(i.product.id, i.size, qty);
  }

  /** Строка уходит сразу; «Вернуть» в плашке ставит её на прежнее место с тем же размером и количеством. */
  remove(i: CartItem): void {
    this.dismissUndo();
    const index = this.cart.items().findIndex((x) => x.product.id === i.product.id && x.size === i.size);
    this.cart.remove(i.product.id, i.size);
    this.undoToast = this.toasts.show({
      text: 'Товар убран',
      action: { label: 'Вернуть', run: () => this.cart.restore(i, index) },
      duration: UNDO_MS,
    });
  }

  private dismissUndo(): void {
    if (this.undoToast) this.toasts.dismiss(this.undoToast);
    this.undoToast = 0;
  }
}
