import { isPlatformBrowser } from '@angular/common';
import { Component, computed, effect, ElementRef, inject, input, PLATFORM_ID, signal, untracked, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { CartService } from '../../core/cart.service';
import { deliveryFor, DISTRICTS, SUBURBS } from '../../core/checkout-options';
import { FavoritesService } from '../../core/favorites.service';
import { MarketApi } from '../../core/market-api.service';
import { Product, Review, Shop } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { IconComponent } from '../../shared/icon.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { PriceTagComponent } from '../../shared/price-tag.component';
import { ProductCardComponent } from '../../shared/product-card.component';
import { ratingLabel, ratingNumber } from '../../shared/rating';
import { ReviewsComponent } from '../../shared/reviews.component';
import { ShopAvatarComponent } from '../../shared/shop-avatar.component';
import { NotFoundComponent } from '../not-found/not-found.component';

const money = new MoneyPipe();

/** Видимая часть наблюдения IntersectionObserver — чтобы функцию можно было проверить без браузера. */
export interface ButtonView { isIntersecting: boolean; boundingClientRect: { bottom: number }; rootBounds: { top: number } | null }

/**
 * Липкая кнопка покупки нужна, когда основная кнопка ушла вверх за край экрана.
 * Пока кнопка ещё ниже (страница только открыта) — панели нет, покупатель сначала видит товар.
 */
export function buyBarVisible(e: ButtonView): boolean {
  return !e.isIntersecting && e.boundingClientRect.bottom <= (e.rootBounds?.top ?? 0);
}

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [RouterLink, ProductCardComponent, NotFoundComponent, IconComponent, PriceTagComponent, ShopAvatarComponent, ReviewsComponent],
  template: `
    @if (missing()) { <app-not-found /> }
    @else if (failed()) { <div class="wrap page-top"><p class="muted">Не удалось загрузить. Попробуйте обновить страницу.</p></div> }
    @else { @if (product(); as p) {
      <div class="wrap top">
        <div class="layout">
          <div class="gallery">
            <div class="main">@if (current()) { <img [src]="current()" [alt]="p.title" /> } @else { <span class="muted">Нет фото</span> }</div>
            @if (photos().length > 1) {
              <div class="thumbs">@for (src of photos(); track src; let i = $index) {
                <button type="button" data-test="thumb" [class.on]="i === photo()" [attr.aria-label]="'Фото ' + (i + 1)" [attr.aria-pressed]="i === photo()" (click)="photo.set(i)"><img [src]="src" alt="" /></button>
              }</div>
            }
          </div>
          <div class="info">
            <a class="seller" [routerLink]="['/shop', p.shop_handle]">
              <app-shop-avatar [name]="shop()?.name || p.shop_handle" [color]="shop()?.avatar_color || ''" [fresh]="!!shop()?.has_fresh" [avatarUrl]="shop()?.avatar_url" [handle]="p.shop_handle" [size]="44" />
              <span class="seller-t">
                <span class="seller-name">{{ shop()?.name || p.shop_handle }}</span>
                <span class="seller-h">&#64;{{ p.shop_handle }}
                  @if (shop()?.rating; as r) { <app-icon class="star" name="star" [size]="12" [filled]="true" />{{ rating(r) }} }
                </span>
              </span>
            </a>
            <h1 class="title">{{ p.title }}</h1>
            @if (ratingText()) { <p class="rating" data-test="rating"><app-icon class="star" name="star" [size]="16" [filled]="true" />{{ ratingText() }}</p> }
            <div class="price"><app-price-tag [price]="p.price" [old]="p.old_price" size="lg" [swing]="added()" /></div>
            @if (p.sizes.length > 1) {
              <fieldset class="sizes" #sizes>
                <legend>Размер</legend>
                <div class="size-list">@for (s of p.sizes; track s) {
                  <button type="button" data-test="size" class="size" [class.on]="size() === s" [attr.aria-pressed]="size() === s" (click)="size.set(s)">{{ s }}</button>
                }</div>
                @if (sizeHint() && !size()) { <p class="field-error size-hint" data-test="size-hint" role="alert">Выберите размер, чтобы добавить в корзину</p> }
              </fieldset>
            }
            <p class="cash promise" data-test="cash-promise"><app-icon name="banknote" [size]="20" /><span>Оплата наличными курьеру · без предоплаты · проверяете товар при курьере</span></p>
            <div class="actions" #actions>
              <button type="button" class="btn add" data-test="add" [disabled]="!canAdd()" (click)="add(p)">{{ addLabel() }}</button>
              @if (added()) { <a class="btn btn--ghost" routerLink="/cart">Перейти в корзину</a> }
              <button type="button" class="fav" [attr.aria-pressed]="fav.has(p.id)" (click)="fav.toggle(p.id)">
                <app-icon name="heart" [size]="20" [filled]="fav.has(p.id)" [class.on]="fav.has(p.id)" />{{ fav.has(p.id) ? 'В избранном' : 'В избранное' }}
              </button>
            </div>
            @if (limitError()) { <p class="error limit" data-test="limit">В корзине уже 30 позиций — оформите заказ или уберите лишнее</p> }
            <ul class="trust">
              <li><app-icon name="truck" [size]="20" /><span>Курьер привезёт в выбранное время. По Душанбе — {{ deliveryCity }}, в {{ suburbs }} — {{ deliverySuburb }}.</span></li>
              <li><app-icon name="shield-check" [size]="20" /><span>Не подошло — не берёте и ничего не платите. <a routerLink="/" fragment="cash">Как это работает</a></span></li>
            </ul>
            <!-- Подпись из Instagram — сырой текст лавки: свёрнута, чтобы не теснить цену и кнопку. Телефоны из неё вычищает бэкенд -->
            @if (p.description.trim()) {
              <details class="desc"><summary>Описание из Instagram</summary><p>{{ p.description }}</p></details>
            }
          </div>
        </div>
        <!-- Телефон: цена и кнопка у нижнего края, над панелью вкладок; появляется, когда основная кнопка ушла вверх -->
        <div class="buybar" [class.on]="barShown()" data-test="buybar">
          <app-price-tag class="bar-price" [price]="p.price" [old]="p.old_price" size="sm" />
          @if (!p.in_stock) { <button type="button" class="btn bar-btn" disabled>Нет в наличии</button> }
          @else if (added()) { <a class="btn bar-btn" routerLink="/cart">Перейти в корзину</a> }
          @else { <button type="button" class="btn bar-btn" (click)="barAdd(p)">Добавить в корзину</button> }
        </div>
        <app-reviews class="reviews" [reviews]="reviews()" [rating]="p.rating ?? null" [count]="p.reviews_count ?? 0" />
        @if (more().length) {
          <section class="more">
            <h2 class="section-title">Ещё в лавке <a [routerLink]="['/shop', p.shop_handle]">{{ shop()?.name || '@' + p.shop_handle }}</a></h2>
            <div class="products">@for (m of more(); track m.id) { <app-product-card [product]="m" /> }</div>
          </section>
        }
      </div>
    } }
  `,
  styles: `
    .top { padding-top: 24px }
    @media (min-width: 768px) { .top { padding-top: 40px } }
    .layout { display: grid; gap: 32px }
    @media (min-width: 768px) { .layout { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 56px } .info { padding-top: 8px } }
    .main { position: relative; aspect-ratio: 1; overflow: hidden; border-radius: var(--radius-photo); background: var(--color-mist); display: grid; place-items: center }
    .main img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover }
    .thumbs { display: flex; gap: 8px; margin-top: 12px; overflow-x: auto }
    .thumbs button { flex: none; width: 64px; height: 64px; padding: 0; overflow: hidden; border: 2px solid transparent; border-radius: 10px; background: var(--color-mist) }
    .thumbs button.on { border-color: var(--color-ink) }
    .thumbs img { width: 100%; height: 100%; object-fit: cover }
    .seller { display: inline-flex; align-items: center; gap: 12px; padding: 4px 12px 4px 0; border-radius: 12px }
    @media (hover: hover) { .seller:hover { background: var(--color-mist) } }
    .seller-t { line-height: 1.25 }
    .seller-name { display: block; font-weight: 600 }
    .seller-h { display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--color-ink-soft) }
    .star { margin-left: 4px; color: var(--color-saffron) }
    .title { margin-top: 20px; max-width: 22ch; font-size: 30px; line-height: 1.12; font-weight: 800; letter-spacing: -0.03em; overflow-wrap: anywhere }
    @media (min-width: 640px) { .title { font-size: 36px } }
    /* Оценка товара под названием: звезда шафраном и «4,8 · 12 отзывов» */
    .rating { margin-top: 12px; display: flex; align-items: center; gap: 6px; font-size: 15px; color: var(--color-ink-soft) }
    .rating .star { margin-left: 0 }
    .price { margin-top: 24px }
    .rating + .price { margin-top: 16px }
    .reviews { margin-top: 64px }
    .sizes { margin-top: 28px; border: 0 }
    .sizes legend { font-size: 15px; font-weight: 600 }
    .size-hint { margin-top: 10px }
    .size-list { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px }
    .size { display: inline-flex; align-items: center; justify-content: center; height: 44px; min-width: 48px; padding: 0 12px; border: 1px solid var(--color-line); border-radius: 10px; font-size: 15px; font-weight: 500 }
    @media (hover: hover) { .size:hover { border-color: var(--color-ink) } }
    .size.on { border-color: var(--color-ink); background: var(--color-ink); color: var(--color-paper) }
    .promise { margin-top: 24px }
    .actions { margin-top: 28px; display: flex; flex-wrap: wrap; gap: 12px }
    .add { min-width: 220px }
    .fav { display: inline-flex; align-items: center; gap: 8px; height: 48px; padding: 0 16px; border: 1px solid var(--color-line); border-radius: 10px; font-size: 15px; font-weight: 600 }
    @media (hover: hover) { .fav:hover { border-color: var(--color-ink) } }
    .fav app-icon.on { color: var(--color-anor) }
    .limit { margin-top: 12px }
    .trust { margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--color-line); display: flex; flex-direction: column; gap: 12px; font-size: 15px }
    .trust li { display: flex; gap: 12px }
    .trust app-icon { margin-top: 2px; color: var(--color-lapis) }
    .trust a { color: var(--color-lapis); text-decoration: underline; text-underline-offset: 2px }
    .desc { margin-top: 24px }
    /* summary остаётся list-item, чтобы браузер рисовал треугольник раскрытия; 12px сверху и снизу — цель ≥44px */
    .desc summary { padding: 12px 0; cursor: pointer; font-size: 15px; font-weight: 600; line-height: 20px }
    .desc summary:focus-visible { outline: 2px solid var(--color-lapis); outline-offset: 2px; border-radius: 6px }
    .desc p { margin-top: 4px; max-width: 60ch; white-space: pre-line; font-size: 16px; line-height: 1.625; overflow-wrap: anywhere }
    .more { margin-top: 80px }
    .more h2 { margin-bottom: 20px }
    @media (hover: hover) { .more h2 a:hover { text-decoration: underline } }
    /* Телефон: «В корзину» во всю ширину, ссылка в тексте с полем нажатия 44px */
    @media (max-width: 639.98px) { .add { flex: 1 1 100%; min-width: 0 } .trust a { display: inline-block; padding-block: 12px; margin-block: -12px } }
    /* Стили липкой панели покупки (.buybar) — в styles.scss, в разделе «Мобильная оболочка» */
  `,
})
export class ProductComponent {
  private readonly api = inject(MarketApi);
  private readonly cart = inject(CartService);
  private readonly seo = inject(SeoService);
  readonly fav = inject(FavoritesService);
  readonly id = input.required<string>();
  readonly product = signal<Product | null>(null);
  /** Лавка товара для плашки продавца; не загрузилась — показываем только ник. */
  readonly shop = signal<Shop | null>(null);
  readonly more = signal<Product[]>([]);
  readonly missing = signal(false);
  readonly photo = signal(0);
  readonly size = signal<string | null>(null);
  readonly added = signal(false);
  /** Корзина упёрлась в лимит строк бэкенда. */
  readonly limitError = signal(false);
  /** Липкая панель покупки видна (только телефон: основная кнопка ушла вверх). */
  readonly barShown = signal(false);
  /** Нажали «В корзину» в панели, а размер не выбран — подсказка у выбора размера. */
  readonly sizeHint = signal(false);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly actionsRef = viewChild<ElementRef<HTMLElement>>('actions');
  private readonly sizesRef = viewChild<ElementRef<HTMLElement>>('sizes');
  readonly photos = computed(() => { const p = this.product(); return p ? (p.images?.length ? p.images : p.image ? [p.image] : []) : []; });
  readonly current = computed(() => this.photos()[this.photo()] ?? '');
  readonly canAdd = computed(() => { const p = this.product(); return !!p && p.in_stock && (p.sizes.length <= 1 || !!this.size()); });
  readonly addLabel = computed(() => (!this.product()?.in_stock ? 'Нет в наличии' : this.added() ? 'Добавлено в корзину' : 'Добавить в корзину'));
  /** Цены доставки из той же deliveryFor, что считает итог на оформлении. */
  readonly deliveryCity = money.transform(deliveryFor(DISTRICTS[0]));
  readonly deliverySuburb = money.transform(deliveryFor(SUBURBS[0]));
  readonly suburbs = SUBURBS.join(' и ');

  readonly failed = signal(false);
  /** Отзывы о товаре; null — ещё грузятся или не загрузились (раздел скрыт). Запрос идёт и при серверном рендере. */
  readonly reviews = signal<Review[] | null>(null);
  readonly ratingText = computed(() => { const p = this.product(); return p ? ratingLabel(p.rating, p.reviews_count) : ''; });

  rating(r: number): string { return ratingNumber(r); }

  constructor() {
    effect((onCleanup) => {
      const id = this.id();
      this.missing.set(false); this.failed.set(false); this.photo.set(0); this.size.set(null); this.added.set(false); this.limitError.set(false); this.barShown.set(false); this.sizeHint.set(false);
      this.product.set(null); this.more.set([]); this.shop.set(null); this.reviews.set(null);
      const nested: { unsubscribe(): void }[] = [];
      const sub = untracked(() => this.api.product(id).subscribe({
        next: (p) => {
          this.product.set(p);
          if (p.sizes.length === 1) this.size.set(p.sizes[0]);
          this.seo.set({ title: `${p.title} — ${money.transform(p.price)} · Харид`, description: `@${p.shop_handle} · ${p.description.slice(0, 140)}`, image: this.photos()[0] || undefined });
          nested.push(
            this.api.products({ shop: p.shop_handle, limit: 9 }).pipe(catchError(() => of([]))).subscribe((list) => this.more.set(list.filter((x) => x.id !== p.id).slice(0, 8))),
            this.api.shop(p.shop_handle).pipe(catchError(() => of(null))).subscribe((s) => this.shop.set(s)),
            // Ошибка отзывов не ломает страницу товара: раздел просто не выводится
            this.api.reviews({ product: p.id }).pipe(catchError(() => of(null))).subscribe((r) => this.reviews.set(r)),
          );
        },
        // 400 — нечисловой id отклонён валидацией бэкенда: для покупателя это тоже «нет такого товара»
        error: (e) => { if (e instanceof HttpErrorResponse && (e.status === 404 || e.status === 400)) this.missing.set(true); else this.failed.set(true); },
      }));
      onCleanup(() => { sub.unsubscribe(); nested.forEach((n) => n.unsubscribe()); });
    });
    // Следим за основной кнопкой только в браузере: на сервере и в первом кадре панели нет
    effect((onCleanup) => {
      const el = this.actionsRef()?.nativeElement;
      if (!this.browser || !el || typeof IntersectionObserver === 'undefined') return;
      // Низ корня растянут далеко вниз: «не пересекается» значит ровно «ушла за верхний край».
      // Так прыжок прокрутки снизу сразу выше кнопки (якорь, быстрый свайп) тоже меняет состояние и не теряется
      const io = new IntersectionObserver(([e]) => this.barShown.set(buyBarVisible(e)), { rootMargin: '0px 0px 100000px 0px' });
      io.observe(el);
      onCleanup(() => io.disconnect());
    });
  }

  /** Кнопка липкой панели: добавляет, а без выбранного размера ведёт к выбору и показывает подсказку. */
  barAdd(p: Product): void {
    if (this.canAdd()) return this.add(p);
    if (!p.in_stock || p.sizes.length <= 1) return;
    this.sizeHint.set(true);
    const box = this.sizesRef()?.nativeElement;
    if (!box || !this.browser) return;
    const calm = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    box.scrollIntoView?.({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
    box.querySelector<HTMLButtonElement>('[data-test="size"]')?.focus({ preventScroll: true });
  }

  add(p: Product): void {
    if (!this.canAdd()) return;
    const ok = this.cart.add(p, p.sizes.length ? this.size() : null);
    this.limitError.set(!ok);
    this.added.set(ok);
  }
}
