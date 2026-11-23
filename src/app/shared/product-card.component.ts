import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { directOnly } from '../core/direct';
import { FavoritesService } from '../core/favorites.service';
import { Product } from '../core/models';
import { IconComponent } from './icon.component';
import { PriceTagComponent } from './price-tag.component';
import { ratingLabel } from './rating';

/**
 * Карточка товара как в прототипе: квадратное фото с ценником-биркой, сердечко в углу,
 * название в две строки и @лавка. Сердечко — отдельная кнопка рядом со ссылкой, не внутри неё.
 */
@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink, IconComponent, PriceTagComponent],
  template: `
    @let p = product();
    <div class="card">
      <a class="link" [routerLink]="['/product', p.id]">
        <div class="img">
          @if (p.image) { <img [src]="p.image" [alt]="p.title" loading="lazy" /> } @else { <span class="ph">Нет фото</span> }
          <app-price-tag class="tag" [price]="p.price" [old]="p.old_price" size="sm" />
        </div>
        <h3 class="title">{{ p.title }}</h3>
        <p class="shop">&#64;{{ p.shop_handle }}</p>
        @if (ratingText()) { <p class="rating" data-test="rating"><app-icon class="star" name="star" [size]="12" [filled]="true" />{{ ratingText() }}</p> }
        <p class="cod" data-test="cod">{{ direct() ? 'Заказ в Instagram Direct' : 'Оплата при получении' }}</p>
      </a>
      <button type="button" class="fav" [class.on]="faved()" [attr.aria-pressed]="faved()" [attr.aria-label]="favLabel()" (click)="fav.toggle(p.id)">
        <span class="fav-dot"><app-icon name="heart" [size]="18" [filled]="faved()" /></span>
      </button>
    </div>
  `,
  styles: `
    :host { display: block }
    .card { position: relative }
    .link { display: block; border-radius: var(--radius-photo) }
    .img { position: relative; aspect-ratio: 1; overflow: hidden; border-radius: var(--radius-photo); background: var(--color-mist); display: grid; place-items: center }
    .img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .5s cubic-bezier(.4, 0, .2, 1) }
    .ph { color: var(--color-ink-soft); font-size: 13px }
    .tag { position: absolute; top: 12px; left: 10px }
    .title { margin-top: 10px; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; font-size: 15px; line-height: 1.375; font-weight: 500 }
    .shop { margin-top: 2px; font-size: 13px; color: var(--color-ink-soft) }
    /* Оценка товара — той же тихой строкой, что @лавка; звезда шафраном, как в прототипе */
    .rating { margin-top: 2px; display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--color-ink-soft); font-variant-numeric: tabular-nums }
    .star { display: inline-flex; color: var(--color-saffron) }
    /* Тихая пометка о наличных: видна в ленте, но не спорит с ценой */
    .cod { margin-top: 2px; font-size: 12px; color: var(--color-ink-soft) }
    @media (hover: hover) {
      .link:hover .img img { transform: scale(1.03) }
      .link:hover .title { text-decoration: underline }
    }
    /* Видимый кружок 36px, а сама кнопка 44px — палец не промахивается */
    .fav { position: absolute; top: 6px; right: 6px; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 9999px; color: var(--color-ink) }
    .fav-dot { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 9999px; background: rgb(255 255 255 / .9) }
    @media (hover: hover) { .fav:hover .fav-dot { background: var(--color-paper) } }
    .fav.on { color: var(--color-anor) }
  `,
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
  readonly fav = inject(FavoritesService);
  /** «4,8 · 12 отзывов»; без отзывов — пусто, строку не выводим. */
  protected readonly ratingText = computed(() => ratingLabel(this.product().rating, this.product().reviews_count));
  /** Неподключённая лавка: вместо оплаты курьеру — заказ в Instagram Direct. */
  protected readonly direct = computed(() => directOnly(this.product()));
  protected readonly faved =computed(() => this.fav.ids().includes(this.product().id));
  protected readonly favLabel = computed(() => {
    const t = this.product().title;
    return this.faved() ? `Убрать «${t}» из избранного` : `Добавить «${t}» в избранное`;
  });
}
