import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { dayMonth } from '../../core/checkout-options';
import { MarketApi } from '../../core/market-api.service';
import { Product, Review, Shop } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { IconComponent } from '../../shared/icon.component';
import { followersCount, followersLabel } from '../../shared/followers';
import { plural } from '../../shared/plural';
import { ProductCardComponent } from '../../shared/product-card.component';
import { ratingNumber, reviewsCount } from '../../shared/rating';
import { ReviewsComponent } from '../../shared/reviews.component';
import { ShopAvatarComponent } from '../../shared/shop-avatar.component';
import { NotFoundComponent } from '../not-found/not-found.component';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [ProductCardComponent, NotFoundComponent, IconComponent, ShopAvatarComponent, ReviewsComponent],
  template: `
    @if (missing()) { <app-not-found /> }
    @else if (failed()) { <div class="wrap page-top"><p class="muted">Не удалось загрузить. Попробуйте обновить страницу.</p></div> }
    @else {
      @if (shop(); as s) {
        <div class="wrap page-top">
          <header class="head">
            <app-shop-avatar [name]="s.name || s.handle" [color]="s.avatar_color" [fresh]="s.has_fresh" [avatarUrl]="s.avatar_url" [handle]="s.handle" [size]="112" />
            <div class="who">
              <h1 class="name">{{ s.name || s.handle }}</h1>
              <a class="ig" [href]="'https://instagram.com/' + s.handle" target="_blank" rel="noopener">
                <app-icon name="instagram" [size]="16" [stroke]="1.8" />&#64;{{ s.handle }}<span class="sr-only">(откроется Instagram)</span>
              </a>
              @if (s.bio) { <p class="bio">{{ s.bio }}</p> }
            </div>
            <dl class="stats">
              @if (s.rating !== null) {
                <div data-test="shop-rating">
                  <dt>Оценка</dt><dd class="rating"><app-icon class="star" name="star" [size]="17" [filled]="true" />{{ rating(s.rating) }}</dd>
                  @if (s.reviews_count) { <dd class="count">{{ reviewsCount(s.reviews_count) }}</dd> }
                </div>
              }
              <div><dt>Доставлено</dt><dd>{{ s.delivered_orders }}</dd></div>
              @if (s.followers > 0) { <div data-test="followers"><dt>В Instagram</dt><dd>{{ followersCount(s.followers) }} {{ followersLabel(s.followers) }}</dd></div> }
            </dl>
          </header>
          <p class="meta">
            @if (s.district) { <span class="pin"><app-icon name="map-pin" [size]="15" />Лавка в районе {{ s.district }}</span> }
            @if (joined()) { <span>На Хариде с {{ joined() }}</span> }
            <span>Оценка и заказы — только по доставкам через Харид</span>
          </p>
          <section class="goods">
            <h2 class="section-title">{{ products().length }} {{ plural(products().length, productForms) }}</h2>
            @if (products().length) { <div class="products">@for (p of products(); track p.id) { <app-product-card [product]="p" /> }</div> }
            @else { <p class="muted">Пока пусто</p> }
          </section>
          <app-reviews class="reviews" [reviews]="reviews()" [rating]="s.rating" [count]="s.reviews_count ?? 0" [showProduct]="true" [shop]="s.handle" />
        </div>
      } @else {
        <!-- Заглушка загрузки, как в прототипе: кружок-строки и сетка серых квадратов -->
        <div class="wrap page-top" role="status">
          <span class="sr-only">Загружаем…</span>
          <div class="skel" style="height:36px;width:256px"></div>
          <div class="skel" style="height:16px;width:192px;margin-top:12px"></div>
          <div class="products" style="margin-top:32px">
            @for (i of [1, 2, 3, 4]; track i) { <div><div class="skel" style="aspect-ratio:1;border-radius:var(--radius-photo)"></div><div class="skel" style="height:16px;width:80%;margin-top:12px"></div></div> }
          </div>
        </div>
      }
    }
  `,
  styles: `
    .head { display: flex; flex-direction: column; gap: 24px; padding-bottom: 32px; border-bottom: 1px solid var(--color-line) }
    @media (min-width: 640px) { .head { flex-direction: row; align-items: center } }
    .who { min-width: 0; flex: 1 }
    .name { font-size: 30px; line-height: 1.25; font-weight: 800; letter-spacing: -0.03em; overflow-wrap: anywhere }
    .ig { margin-top: 4px; display: inline-flex; align-items: center; gap: 6px; min-height: 44px; color: var(--color-ink-soft) }
    @media (hover: hover) { .ig:hover { color: var(--color-ink) } }
    .bio { margin-top: 8px; max-width: 56ch; font-size: 16px; line-height: 1.625 }
    .stats { display: grid; grid-template-columns: repeat(3, auto); justify-content: start; gap: 24px }
    @media (min-width: 640px) { .stats { gap: 32px } }
    dt { font-size: 13px; color: var(--color-ink-soft) }
    dd { margin-top: 2px; font-size: 20px; font-weight: 700 }
    .rating { display: flex; align-items: center; gap: 4px }
    .count { margin-top: 0; font-size: 13px; font-weight: 400; color: var(--color-ink-soft) }
    .reviews { margin-top: 64px }
    .star { color: var(--color-saffron) }
    .meta { margin-top: 16px; display: flex; flex-wrap: wrap; align-items: center; column-gap: 20px; row-gap: 4px; font-size: 14px; color: var(--color-ink-soft) }
    .pin { display: inline-flex; align-items: center; gap: 6px }
    .goods { margin-top: 32px }
    .goods h2 { margin-bottom: 20px }
  `,
})
export class ShopComponent {
  private readonly api = inject(MarketApi);
  private readonly seo = inject(SeoService);
  readonly plural = plural;
  readonly followersCount = followersCount;
  readonly followersLabel = followersLabel;
  readonly productForms: [string, string, string] = ['товар', 'товара', 'товаров'];
  readonly handle = input.required<string>();
  readonly shop = signal<Shop | null>(null);
  readonly products = signal<Product[]>([]);
  readonly missing = signal(false);
  readonly failed = signal(false);
  readonly joined = computed(() => dayMonth(this.shop()?.joined_at ?? ''));
  /** Отзывы о товарах лавки; null — не загрузились, раздел скрыт. */
  readonly reviews = signal<Review[] | null>(null);
  readonly reviewsCount = reviewsCount;
  rating(r: number): string { return ratingNumber(r); }
  constructor() {
    effect((onCleanup) => {
      const h = this.handle();
      this.missing.set(false); this.failed.set(false); this.shop.set(null); this.products.set([]); this.reviews.set(null);
      const subs = untracked(() => [
        this.api.shop(h).subscribe({
          next: (s) => { this.shop.set(s); this.seo.set({ title: `@${s.handle} — Харид`, description: s.bio || `Лавка @${s.handle} на Хариде` }); },
          error: (e) => { if (e instanceof HttpErrorResponse && e.status === 404) this.missing.set(true); else this.failed.set(true); },
        }),
        this.api.products({ shop: h }).pipe(catchError(() => of([]))).subscribe((p) => this.products.set(p)),
        this.api.reviews({ shop: h }).pipe(catchError(() => of(null))).subscribe((r) => this.reviews.set(r)),
      ]);
      onCleanup(() => subs.forEach((x) => x.unsubscribe()));
    });
  }
}
