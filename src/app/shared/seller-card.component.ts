import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { dayMonth } from '../core/checkout-options';
import { Shop } from '../core/models';
import { followersCount, followersLabel } from './followers';
import { IconComponent } from './icon.component';
import { shopRating } from './rating';
import { ShopAvatarComponent } from './shop-avatar.component';

/**
 * Плашка «Продавец» на странице товара: кто продаёт, оценка лавки (или почему её нет),
 * факты о лавке и переход ко всем её товарам.
 */
@Component({
  selector: 'app-seller-card',
  standalone: true,
  imports: [RouterLink, IconComponent, ShopAvatarComponent],
  template: `
    @let s = shop();
    @let r = rate();
    <h2 class="h" id="seller-card-h">Продавец</h2>
    <a class="who" [routerLink]="['/shop', s.handle]">
      <app-shop-avatar [name]="s.name || s.handle" [color]="s.avatar_color" [fresh]="s.has_fresh" [avatarUrl]="s.avatar_url" [handle]="s.handle" [size]="56" />
      <span class="who-t">
        <span class="name" data-test="seller-name">{{ s.name || s.handle }}</span>
        <span class="handle">&#64;{{ s.handle }}</span>
      </span>
    </a>
    <p class="rate" data-test="seller-rating">
      @if (r.kind === 'rated') {
        <app-icon class="star" name="star" [size]="18" [filled]="true" /><strong>{{ r.value }}</strong><span class="soft">· {{ r.count }}</span>
      } @else if (r.kind === 'direct') {
        <strong>Оценок нет — заказы в Direct.</strong> <span class="soft">Отзыв оставляют только после доставки через Харид.</span>
      } @else {
        <strong>Пока без оценок.</strong> <span class="soft">Отзывы появятся после первых доставок.</span>
      }
    </p>
    <dl class="facts" data-test="seller-facts">
      @if (joined()) { <div><dt>На Хариде</dt><dd>с {{ joined() }}</dd></div> }
      @if (s.followers > 0) { <div><dt>В Instagram</dt><dd>{{ followers(s.followers) }} {{ followersWord(s.followers) }}</dd></div> }
      @if (s.verified !== false) { <div><dt>Доставлено</dt><dd>{{ s.delivered_orders }}</dd></div> }
    </dl>
    <a class="all" data-test="seller-all" [routerLink]="['/shop', s.handle]">Все товары лавки<app-icon name="chevron-right" [size]="18" /></a>
  `,
  host: { role: 'region', 'aria-labelledby': 'seller-card-h' },
  styles: `
    :host { display: block; padding: 20px; border: 1px solid var(--color-line); border-radius: 16px; background: var(--color-paper) }
    @media (min-width: 640px) { :host { padding: 24px } }
    .h { font-size: 15px; font-weight: 600; color: var(--color-ink-soft) }
    .who { margin-top: 12px; display: flex; align-items: center; gap: 14px; min-height: 56px; border-radius: 12px }
    .who:focus-visible, .all:focus-visible { outline: 2px solid var(--color-lapis); outline-offset: 3px }
    .who-t { min-width: 0; line-height: 1.25 }
    .name { display: block; font-size: 18px; font-weight: 700; letter-spacing: -0.01em; overflow-wrap: anywhere }
    .handle { display: block; margin-top: 2px; font-size: 14px; color: var(--color-ink-soft) }
    @media (hover: hover) { .who:hover .name { text-decoration: underline; text-underline-offset: 3px } }
    .rate { margin-top: 16px; display: flex; flex-wrap: wrap; align-items: center; column-gap: 6px; row-gap: 2px; font-size: 15px; line-height: 1.5 }
    .rate strong { font-weight: 700 }
    .rate .soft { color: var(--color-ink-soft) }
    .star { color: var(--color-saffron) }
    .facts { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-line); display: flex; flex-wrap: wrap; column-gap: 28px; row-gap: 12px }
    .facts dt { font-size: 13px; color: var(--color-ink-soft) }
    .facts dd { margin-top: 2px; font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums }
    .all { margin-top: 20px; display: inline-flex; align-items: center; gap: 4px; min-height: 44px; font-size: 15px; font-weight: 600; color: var(--color-lapis); border-radius: 8px }
    @media (hover: hover) { .all:hover { text-decoration: underline; text-underline-offset: 3px } }
  `,
})
export class SellerCardComponent {
  readonly shop = input.required<Shop>();
  protected readonly rate = computed(() => shopRating(this.shop()));
  protected readonly joined = computed(() => dayMonth(this.shop().joined_at));
  protected readonly followers = followersCount;
  protected readonly followersWord = followersLabel;
}
