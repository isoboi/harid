import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { dayMonth } from '../core/checkout-options';
import { Review } from '../core/models';
import { ratingNumber, reviewsCount } from './rating';
import { StarsComponent } from './stars.component';

/**
 * Раздел «Отзывы» как в прототипе: заголовок со сводкой (звёзды, оценка, число отзывов),
 * пояснение и список в две колонки на десктопе. null — отзывы не загрузились, раздел не выводим.
 */
@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [RouterLink, StarsComponent],
  template: `
    @if (reviews(); as list) {
      <section aria-labelledby="reviews-title">
        <div class="head">
          <h2 id="reviews-title" class="title">Отзывы</h2>
          @if (count() > 0) {
            <p class="rating-sum" data-test="summary">
              @if (rating() !== null) { <app-stars [rating]="rating()!" /><b>{{ num(rating()!) }}</b> }
              {{ countText() }}
            </p>
          }
        </div>
        @if (list.length) {
          <p class="note">Оставить отзыв можно только после того, как курьер привёз заказ.</p>
          <ul class="list">
            @for (r of list; track r.id) {
              <li class="item" data-test="review">
                <div class="who"><p class="author">{{ r.author }}</p><time class="date" [attr.datetime]="r.created_at.slice(0, 10)">{{ date(r.created_at) }}</time></div>
                <div class="stars"><app-stars [rating]="r.rating" [size]="14" /></div>
                @if (showProduct()) { <a class="product" [routerLink]="['/product', r.product_id]">{{ r.product_title }}</a> }
                @if (r.text) { <p class="text">{{ r.text }}</p> }
              </li>
            }
          </ul>
        } @else {
          <p class="note" data-test="empty">Отзывов пока нет. Оставить отзыв можно после получения заказа.</p>
        }
      </section>
    }
  `,
  styles: `
    :host { display: block }
    .head { display: flex; flex-wrap: wrap; align-items: flex-end; column-gap: 24px; row-gap: 8px }
    .title { font-size: 22px; font-weight: 700 }
    /* Не .summary: так называется глобальная карточка итогов корзины (фон и отступы) */
    .rating-sum { display: flex; align-items: center; gap: 8px; font-size: 15px; color: var(--color-ink-soft) }
    .rating-sum b { font-weight: 600; color: var(--color-ink) }
    .note { margin-top: 4px; font-size: 14px; color: var(--color-ink-soft) }
    .list { margin-top: 24px; display: grid; column-gap: 40px }
    @media (min-width: 768px) { .list { grid-template-columns: 1fr 1fr } }
    .item { padding-block: 20px; border-top: 1px solid var(--color-line) }
    .who { display: flex; align-items: center; justify-content: space-between; gap: 12px }
    .author { font-weight: 600 }
    .date { font-size: 13px; color: var(--color-ink-soft); white-space: nowrap }
    .stars { margin-top: 4px; display: flex }
    .product { margin-top: 8px; display: inline-block; font-size: 14px; color: var(--color-lapis) }
    @media (hover: hover) { .product:hover { text-decoration: underline } }
    /* Телефон: ссылка на товар получает поле нажатия 44px без сдвига вёрстки */
    @media (max-width: 639.98px) { .product { padding-block: 12px; margin-block: -4px -12px } }
    .text { margin-top: 8px; max-width: 60ch; font-size: 15px; line-height: 1.625; white-space: pre-line; overflow-wrap: anywhere }
  `,
})
export class ReviewsComponent {
  readonly reviews = input<Review[] | null>(null);
  /** Сводка берётся из объекта товара или лавки (rating, reviews_count), а не из страницы списка. */
  readonly rating = input<number | null>(null);
  readonly count = input(0);
  /** На странице лавки у отзыва показываем товар. */
  readonly showProduct = input(false);
  protected readonly countText = computed(() => reviewsCount(this.count()));
  protected readonly num = ratingNumber;
  protected readonly date = dayMonth;
}
