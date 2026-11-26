import { isPlatformBrowser } from '@angular/common';
import { Component, computed, effect, ElementRef, inject, input, PLATFORM_ID, signal, untracked, viewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { CartService } from '../../core/cart.service';
import { FlyToCart } from '../../core/fly-to-cart.service';
import { directLink, directOnly, postLink } from '../../core/direct';
import { deliveryFor, DISTRICTS, SUBURBS } from '../../core/checkout-options';
import { FavoritesService } from '../../core/favorites.service';
import { Haptics } from '../../core/haptics.service';
import { ToastService } from '../../core/toast.service';
import { RecentlyViewedService } from '../../core/recently-viewed.service';
import { MarketApi } from '../../core/market-api.service';
import { Product, Review, Shop } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { productLd, productPath } from '../../core/structured-data';
import { IconComponent } from '../../shared/icon.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { PriceTagComponent } from '../../shared/price-tag.component';
import { ProductCardComponent } from '../../shared/product-card.component';
import { ratingLabel, ratingNumber } from '../../shared/rating';
import { SellerCardComponent } from '../../shared/seller-card.component';
import { ReviewsComponent } from '../../shared/reviews.component';
import { ShopAvatarComponent } from '../../shared/shop-avatar.component';
import { PhotoViewerComponent, SWIPE_X } from '../../shared/photo-viewer.component';
import { ReelAction, ReelViewerComponent } from '../../shared/reel-viewer.component';
import { ShareComponent } from '../../shared/share.component';
import { VideoPlayerComponent } from '../../shared/video-player.component';
import { NotFoundComponent } from '../not-found/not-found.component';

const money = new MoneyPipe();
/** С какого сдвига пальца вбок касание фото считаем листанием, а не нажатием. */
const SWIPE_START = 10;

/** Видимая часть наблюдения IntersectionObserver — чтобы функцию можно было проверить без браузера. */
export interface ButtonView { isIntersecting: boolean; intersectionRatio: number }

/**
 * Нижний край области наблюдения поднят на высоту вкладок (60px) и самой панели (68px):
 * кнопка «видна», только если целиком стоит над ними. Значения — как --tabbar-h и --buybar-h в styles.scss.
 */
export const BUY_BAR_ROOT_MARGIN = '0px 0px -128px 0px';

/**
 * Липкая кнопка покупки нужна, пока основная кнопка не видна на экране целиком:
 * ушла вверх, ещё ниже первого экрана или спряталась под панелью вкладок — в том числе сразу после открытия.
 */
export function buyBarVisible(e: ButtonView): boolean {
  return !e.isIntersecting || e.intersectionRatio < 1;
}

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [RouterLink, ProductCardComponent, NotFoundComponent, IconComponent, PriceTagComponent, ShopAvatarComponent, ReviewsComponent, VideoPlayerComponent, ReelViewerComponent, SellerCardComponent, ShareComponent, PhotoViewerComponent],
  template: `
    @if (missing()) { <app-not-found /> }
    @else if (failed()) { <div class="wrap page-top"><p class="muted">Не удалось загрузить. Попробуйте обновить страницу.</p></div> }
    @else { @if (product(); as p) {
      <div class="wrap top">
        <div class="layout">
          <div class="gallery">
            <!-- Телефон: фото листаются пальцем вбок; нажатие открывает фото на весь экран с увеличением -->
            <div class="main" #main [class.video]="videoOn()" [class.swiping]="swipeDx() !== 0"
              (pointerdown)="swipeDown($event)" (pointermove)="swipeMove($event)" (pointerup)="swipeUp()" (pointercancel)="swipeUp()">
              <!-- Человек сам выбрал слайд с видео — играем сразу, без второго нажатия -->
              @if (videoOn()) { <app-video-player [src]="video()" [poster]="photos()[0] || ''" [label]="'Видео: ' + p.title" [autoplay]="true" [expandable]="true" [hold]="reel()" (expand)="reel.set(true)" /> }
              @else if (current()) {
                <button type="button" class="zoom" data-test="open-viewer" aria-label="Открыть фото на весь экран" (click)="openViewer()">
                  <img [src]="current()" [alt]="p.title" [style.transform]="swipeDx() ? 'translateX(' + swipeDx() + 'px)' : null" />
                </button>
              }
              @else { <span class="muted">Нет фото</span> }
              @if (slides() > 1 && !videoOn()) { <span class="count" data-test="photo-count" aria-hidden="true">{{ photo() + 1 }} / {{ slides() }}</span> }
            </div>
            @if (photos().length + (video() ? 1 : 0) > 1) {
              <div class="thumbs">@for (src of photos(); track src; let i = $index) {
                <button type="button" data-test="thumb" [class.on]="i === photo()" [attr.aria-label]="'Фото ' + (i + 1)" [attr.aria-pressed]="i === photo()" (click)="photo.set(i)"><img [src]="src" alt="" /></button>
              }
              @if (video()) {
                <button type="button" class="play" data-test="thumb-video" [class.on]="videoOn()" aria-label="Видео" [attr.aria-pressed]="videoOn()" (click)="photo.set(photos().length)">
                  @if (photos()[0]) { <img [src]="photos()[0]" alt="" /> }
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
                </button>
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
            @if (p.price !== null) { <div class="price"><app-price-tag [price]="p.price" [old]="p.old_price" size="lg" [swing]="added()" /></div> }
            @if (!direct() && p.sizes.length > 1) {
              <fieldset class="sizes" #sizes>
                <legend>Размер</legend>
                <div class="size-list">@for (s of p.sizes; track s) {
                  <button type="button" data-test="size" class="size" [class.on]="size() === s" [attr.aria-pressed]="size() === s" (click)="size.set(s)">{{ s }}</button>
                }</div>
                @if (sizeHint() && !size()) { <p class="field-error size-hint" data-test="size-hint" role="alert">Выберите размер, чтобы добавить в корзину</p> }
              </fieldset>
            }
            <!-- Неподключённая лавка: заказ и цена — в Instagram Direct продавца, корзины и курьера Харида нет -->
            @if (direct()) {
              <p class="promise direct-note" data-test="direct-promise"><app-icon name="instagram" [size]="20" /><span>Лавка принимает заказы в Instagram Direct.@if (igPost()) { При нажатии ссылка на этот пост скопируется — вставьте её в сообщение продавцу.}</span></p>
            } @else {
              <p class="cash promise" data-test="cash-promise"><app-icon name="banknote" [size]="20" /><span>Оплата наличными курьеру · без предоплаты · проверяете товар при курьере</span></p>
            }
            <div class="actions" #actions>
              @if (direct()) {
                <a class="btn add" data-test="direct" [href]="directUrl()" target="_blank" rel="noopener nofollow" (click)="copyPost()"><app-icon name="instagram" [size]="20" />Написать в Direct</a>
              } @else {
                <button type="button" class="btn add" data-test="add" [disabled]="!canAdd()" (click)="add(p, $event.currentTarget)">{{ addLabel() }}</button>
                @if (added()) { <a class="btn btn--ghost" routerLink="/cart">Перейти в корзину</a> }
              }
              <button type="button" class="fav" [attr.aria-pressed]="fav.has(p.id)" (click)="fav.toggle(p.id)">
                <app-icon name="heart" [size]="20" [filled]="fav.has(p.id)" [class.on]="fav.has(p.id)" />{{ fav.has(p.id) ? 'В избранном' : 'В избранное' }}
              </button>
              <app-share [path]="sharePath()" [text]="shareText()" />
              <a class="btn btn--ghost write" data-test="write-seller" routerLink="/chats/new" [queryParams]="{ shop: p.shop_handle, product: p.id }">Написать продавцу</a>
            </div>
            @if (copied()) { <p class="copied" data-test="copied" role="status">Ссылка на пост скопирована — вставьте её в чат</p> }
            @if (limitError()) { <p class="error limit" data-test="limit">В корзине уже 30 позиций — оформите заказ или уберите лишнее</p> }
            @if (!direct()) {
              <ul class="trust">
                <li><app-icon name="truck" [size]="20" /><span>Курьер привезёт в выбранное время. По Душанбе — {{ deliveryCity }}, в {{ suburbs }} — {{ deliverySuburb }}.</span></li>
                <li><app-icon name="shield-check" [size]="20" /><span>Не подошло — не берёте и ничего не платите. <a routerLink="/" fragment="cash">Как это работает</a></span></li>
              </ul>
            }
            <!-- Подпись из Instagram — сырой текст лавки: свёрнута, чтобы не теснить цену и кнопку. Телефоны из неё вычищает бэкенд -->
            @if (p.description.trim()) {
              <details class="desc"><summary>Описание из Instagram</summary><p>{{ p.description }}</p></details>
            }
            <!-- Товар импортирован из поста — покупатель может открыть исходный пост -->
            @if (igPost()) {
              <a class="ig-post" data-test="ig-post" [href]="igPost()" target="_blank" rel="noopener nofollow"><app-icon name="instagram" [size]="20" /><span>Пост в Instagram</span></a>
            }
            <!-- Кто продаёт: оценка лавки (или почему её нет) и факты — перед решением купить -->
            @if (shop(); as s) { <app-seller-card class="seller-card" [shop]="s" /> }
          </div>
        </div>
        <!-- Телефон: цена и кнопка у нижнего края, над панелью вкладок; появляется, когда основная кнопка ушла вверх -->
        <div class="buybar" [class.on]="barShown()" data-test="buybar">
          @if (p.price !== null) { <app-price-tag class="bar-price" [price]="p.price" [old]="p.old_price" size="sm" /> }
          @if (direct()) { <a class="btn bar-btn" data-test="bar-direct" [href]="directUrl()" target="_blank" rel="noopener nofollow" (click)="copyPost()">Написать в Direct</a> }
          @else if (!p.in_stock) { <button type="button" class="btn bar-btn" disabled>Нет в наличии</button> }
          @else if (added()) { <a class="btn bar-btn" routerLink="/cart">Перейти в корзину</a> }
          @else { <button type="button" class="btn bar-btn" (click)="barAdd(p, $event.currentTarget)">Добавить в корзину</button> }
        </div>
        @if (viewer()) {
          <app-photo-viewer [photos]="photos()" [start]="photo()" [alt]="p.title" (closed)="closeViewer($event)" />
        }
        @if (reel()) {
          <app-reel-viewer [product]="p" [shop]="shop()" [favorite]="fav.has(p.id)" [action]="reelAction()" (closed)="reel.set(false)" (act)="reelAct(p)" (toggleFavorite)="fav.toggle(p.id)" (liked)="like(p)" />
        }
        <app-reviews class="reviews" [reviews]="reviews()" [rating]="p.rating ?? null" [count]="p.reviews_count ?? 0" [product]="p.id" />
        @if (more().length) {
          <section class="more">
            <h2 class="section-title">Ещё в лавке <a [routerLink]="['/shop', p.shop_handle]">{{ shop()?.name || '@' + p.shop_handle }}</a></h2>
            <div class="products">@for (m of more(); track m.id) { <app-product-card [product]="m" /> }</div>
          </section>
        }
      </div>
    } @else {
      <!-- Заглушка загрузки в той же сетке: фото с превью слева, продавец, название, цена и кнопки справа -->
      <div class="wrap top" role="status" data-test="skel-product">
        <span class="sr-only">Загрузка…</span>
        <div class="layout" aria-hidden="true">
          <div class="gallery">
            <div class="main skel"></div>
            <div class="thumbs">@for (n of [1, 2, 3, 4]; track n) { <span class="skel thumb-skel"></span> }</div>
          </div>
          <div class="info">
            <div class="seller-skel">
              <span class="skel skel--round ava-skel"></span>
              <span class="seller-t"><span class="skel skel--line seller-name-skel"></span><span class="skel skel--line seller-h-skel"></span></span>
            </div>
            <span class="skel skel--line title-skel"></span>
            <span class="skel skel--line title-skel title-skel--short"></span>
            <span class="skel price-skel"></span>
            <span class="skel skel--line promise-skel"></span>
            <div class="actions"><span class="skel btn-skel btn-skel--add"></span><span class="skel btn-skel"></span></div>
          </div>
        </div>
      </div>
    } }
  `,
  styles: `
    .top { padding-top: 24px }
    @media (min-width: 768px) { .top { padding-top: 40px } }
    .layout { display: grid; gap: 32px }
    @media (min-width: 768px) { .layout { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 56px } .info { padding-top: 8px } }
    .main { position: relative; aspect-ratio: 1; overflow: hidden; border-radius: var(--radius-photo); background: var(--color-mist); display: grid; place-items: center }
    .main img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .2s ease-out }
    .main.swiping img { transition: none }
    /* Вертикальная прокрутка страницы — браузеру, жест вбок — нам (листание фото) */
    .main:not(.video) { touch-action: pan-y }
    .zoom { position: absolute; inset: 0; padding: 0; cursor: zoom-in }
    .zoom:focus-visible { outline: 2px solid var(--color-lapis); outline-offset: -2px; border-radius: var(--radius-photo) }
    .count { position: absolute; right: 12px; bottom: 12px; padding: 2px 10px; border-radius: 9999px; background: rgb(19 35 91 / .6); color: #fff; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; pointer-events: none }
    .thumbs { display: flex; gap: 8px; margin-top: 12px; overflow-x: auto }
    .thumbs button { flex: none; width: 64px; height: 64px; padding: 0; overflow: hidden; border: 2px solid transparent; border-radius: 10px; background: var(--color-mist) }
    .thumbs button.on { border-color: var(--color-ink) }
    .thumbs img { width: 100%; height: 100%; object-fit: cover }
    .main.video { background: var(--color-night) }
    .main app-video-player { position: absolute; inset: 0 }
    .thumbs .play { position: relative; display: grid; place-items: center; color: #fff }
    .thumbs .play img { position: absolute; inset: 0; filter: brightness(.6) }
    .thumbs .play svg { position: relative; width: 26px; height: 26px }
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
    /* Пометка для лавки в Direct — та же раскладка, что у обещания оплаты (.cash в styles.scss) */
    .direct-note { display: flex; gap: 12px; font-size: 15px; line-height: 1.5 }
    .direct-note app-icon { flex: none; margin-top: 2px; color: var(--color-lapis) }
    .actions { margin-top: 28px; display: flex; flex-wrap: wrap; gap: 12px }
    .add { min-width: 220px }
    /* Заглушка загрузки: размеры по настоящим блокам (превью 64, аватар 44, строка названия 30/36px, кнопки 48) */
    .seller-skel { display: flex; align-items: center; gap: 12px; padding-block: 4px }
    .thumb-skel { flex: none; width: 64px; height: 64px }
    .ava-skel { flex: none; width: 44px; height: 44px }
    .seller-name-skel { width: 140px; height: 15px; margin-block: 2px }
    .seller-h-skel { width: 96px; height: 12px; margin-top: 6px }
    .title-skel { margin-top: 24px; width: min(100%, 420px); height: 30px }
    .title-skel--short { margin-top: 8px; width: min(70%, 280px) }
    @media (min-width: 640px) { .title-skel { height: 36px } }
    .price-skel { display: block; margin-top: 28px; width: 150px; height: 44px }
    .promise-skel { margin-top: 28px; width: min(100%, 360px) }
    .btn-skel { width: 160px; height: 48px }
    .btn-skel--add { width: 220px }
    @media (max-width: 639.98px) { .btn-skel--add { flex: 1 1 100% } }
    .fav { display: inline-flex; align-items: center; gap: 8px; height: 48px; padding: 0 16px; border: 1px solid var(--color-line); border-radius: 10px; font-size: 15px; font-weight: 600 }
    @media (hover: hover) { .fav:hover { border-color: var(--color-ink) } }
    .fav app-icon.on { color: var(--color-anor) }
    .limit { margin-top: 12px }
    .copied { margin-top: 12px; font-size: 14px; color: var(--color-ink-soft) }
    .trust { margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--color-line); display: flex; flex-direction: column; gap: 12px; font-size: 15px }
    .trust li { display: flex; gap: 12px }
    .trust app-icon { margin-top: 2px; color: var(--color-lapis) }
    .trust a { color: var(--color-lapis); text-decoration: underline; text-underline-offset: 2px }
    .desc { margin-top: 24px }
    /* summary остаётся list-item, чтобы браузер рисовал треугольник раскрытия; 12px сверху и снизу — цель ≥44px */
    .desc summary { padding: 12px 0; cursor: pointer; font-size: 15px; font-weight: 600; line-height: 20px }
    .desc summary:focus-visible { outline: 2px solid var(--color-lapis); outline-offset: 2px; border-radius: 6px }
    .desc p { margin-top: 4px; max-width: 60ch; white-space: pre-line; font-size: 16px; line-height: 1.625; overflow-wrap: anywhere }
    /* Ссылка на исходный пост: вторичная, под описанием; 44px по высоте — цель нажатия */
    .ig-post { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; margin-top: 12px; font-size: 15px; font-weight: 600; color: var(--color-lapis) }
    .ig-post:focus-visible { outline: 2px solid var(--color-lapis); outline-offset: 2px; border-radius: 6px }
    @media (hover: hover) { .ig-post:hover span { text-decoration: underline; text-underline-offset: 2px } }
    .seller-card { margin-top: 32px }
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
  private readonly haptics = inject(Haptics);
  private readonly seo = inject(SeoService);
  private readonly title = inject(Title);
  readonly fav = inject(FavoritesService);
  private readonly recent = inject(RecentlyViewedService);
  private readonly fly = inject(FlyToCart);
  private readonly toasts = inject(ToastService);
  readonly id = input.required<string>();
  readonly product = signal<Product | null>(null);
  /** Лавка товара для плашки продавца; не загрузилась — показываем только ник. */
  readonly shop = signal<Shop | null>(null);
  readonly more = signal<Product[]>([]);
  readonly missing = signal(false);
  readonly photo = signal(0);
  /** Открыт вертикальный просмотр видео (как в Instagram) поверх страницы. */
  readonly reel = signal(false);
  /** Открыт просмотр фото на весь экран. */
  readonly viewer = signal(false);
  /** Сдвиг фото за пальцем, пока его листают вбок. */
  readonly swipeDx = signal(0);
  private swipe: { x: number; y: number; on: boolean } | null = null;
  /** После свайпа браузер всё равно пришлёт click — его не считаем нажатием «открыть». */
  private swallowClick = false;
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
  private readonly mainRef = viewChild<ElementRef<HTMLElement>>('main');
  readonly photos = computed(() => { const p = this.product(); return p ? (p.images?.length ? p.images : p.image ? [p.image] : []) : []; });
  readonly current = computed(() => this.photos()[this.photo()] ?? '');
  /** Видео товара — последний слайд галереи, после всех фото. */
  readonly video = computed(() => this.product()?.video || '');
  /** Ссылка на исходный пост; наружу ведём только на сам Instagram. */
  readonly igPost = computed(() => { const p = this.product(); return p ? postLink(p) : ''; });
  /** Лавка не подключена к Хариду: вместо корзины — чат с продавцом в Instagram Direct. */
  readonly direct = computed(() => { const p = this.product(); return !!p && directOnly(p); });
  readonly directUrl = computed(() => { const p = this.product(); return p ? directLink(p) : ''; });
  /** Ссылка на пост скопирована в буфер после нажатия «Написать в Direct». */
  readonly copied = signal(false);
  /** Слайдов в галерее: фото и, если есть, видео последним. */
  readonly slides = computed(() => this.photos().length + (this.video() ? 1 : 0));
  readonly videoOn = computed(() => !!this.video() && this.photo() === this.photos().length);
  readonly canAdd = computed(() => { const p = this.product(); return !!p && !directOnly(p) && p.in_stock && (p.sizes.length <= 1 || !!this.size()); });
  /** Главная кнопка под видео в вертикальном просмотре — та же логика, что у кнопок страницы. */
  readonly reelAction = computed<ReelAction>(() => {
    const p = this.product();
    if (!p) return { label: '' };
    if (this.direct()) return { label: 'Написать в Direct', href: this.directUrl() };
    if (!p.in_stock) return { label: 'Нет в наличии', disabled: true };
    if (this.added()) return { label: 'Перейти в корзину', link: '/cart' };
    return { label: p.sizes.length > 1 && !this.size() ? 'Выбрать размер' : 'Добавить в корзину' };
  });
  /** Что уходит в мессенджер при «Поделиться»: название и цена, ссылка — на канонический адрес товара. */
  readonly sharePath = computed(() => productPath(this.product()?.id ?? ''));
  readonly shareText = computed(() => { const p = this.product(); return !p ? '' : p.price === null ? p.title : `${p.title} — ${money.transform(p.price)}`; });
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
      this.missing.set(false); this.failed.set(false); this.photo.set(0); this.size.set(null); this.added.set(false); this.limitError.set(false); this.barShown.set(false); this.sizeHint.set(false); this.copied.set(false); this.reel.set(false); this.viewer.set(false);
      this.product.set(null); this.more.set([]); this.shop.set(null); this.reviews.set(null);
      const nested: { unsubscribe(): void }[] = [];
      const sub = untracked(() => this.api.product(id).subscribe({
        next: (p) => {
          this.product.set(p);
          // Снимок для «Вы смотрели» — только в браузере: на сервере хранилища нет
          if (this.browser) this.recent.add(p);
          if (p.sizes.length === 1) this.size.set(p.sizes[0]);
          this.seo.set({ title: p.price === null ? `${p.title} · Харид` : `${p.title} — ${money.transform(p.price)} · Харид`, description: `@${p.shop_handle} · ${p.description.slice(0, 140)}`, image: this.photos()[0] || undefined, type: 'product', jsonLd: productLd(p, this.photos(), this.seo.origin()), path: productPath(p.id) });
          nested.push(
            this.api.products({ shop: p.shop_handle, limit: 9 }).pipe(catchError(() => of([]))).subscribe((list) => this.more.set(list.filter((x) => x.id !== p.id).slice(0, 8))),
            this.api.shop(p.shop_handle).pipe(catchError(() => of(null))).subscribe((s) => this.shop.set(s)),
            // Ошибка отзывов не ломает страницу товара: раздел просто не выводится
            this.api.reviews({ product: p.id }).pipe(catchError(() => of(null))).subscribe((r) => this.reviews.set(r)),
          );
        },
        // 400 — нечисловой id отклонён валидацией бэкенда: для покупателя это тоже «нет такого товара»
        error: (e) => {
          // Теги прошлой страницы SeoService убрал при переходе; заголовок вкладки — свой.
          // Товара больше нет — убираем его и из «Вы смотрели»; сетевые ошибки историю не трогают
          if (e instanceof HttpErrorResponse && (e.status === 404 || e.status === 400)) {
            this.missing.set(true);
            this.title.setTitle('Товар не найден — Харид');
            if (this.browser) this.recent.remove(id);
          } else { this.failed.set(true); this.title.setTitle('Товар не загрузился — Харид'); }
        },
      }));
      onCleanup(() => { sub.unsubscribe(); nested.forEach((n) => n.unsubscribe()); });
    });
    // Следим за основной кнопкой только в браузере: на сервере и в первом кадре панели нет
    effect((onCleanup) => {
      const el = this.actionsRef()?.nativeElement;
      if (!this.browser || !el || typeof IntersectionObserver === 'undefined') return;
      // Порог 1: событие приходит, когда кнопка становится видна целиком и когда перестаёт.
      // Первое наблюдение приходит сразу после подписки — панель появляется и при открытии, если кнопки не видно
      const io = new IntersectionObserver(([e]) => this.barShown.set(buyBarVisible(e)), { rootMargin: BUY_BAR_ROOT_MARGIN, threshold: 1 });
      io.observe(el);
      onCleanup(() => io.disconnect());
    });
  }

  /** Кнопка липкой панели: добавляет, а без выбранного размера ведёт к выбору и показывает подсказку. */
  barAdd(p: Product, trigger: EventTarget | null = null): void {
    if (this.canAdd()) return this.add(p, trigger);
    if (!p.in_stock || p.sizes.length <= 1) return;
    this.sizeHint.set(true);
    const box = this.sizesRef()?.nativeElement;
    if (!box || !this.browser) return;
    const calm = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    box.scrollIntoView?.({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
    box.querySelector<HTMLButtonElement>('[data-test="size"]')?.focus({ preventScroll: true });
  }

  /**
   * «Написать в Direct»: ссылка сама открывает чат, а пост кладём в буфер обмена —
   * у ig.me нет документированного параметра, чтобы подставить текст сообщения.
   */
  openViewer(): void {
    if (this.swallowClick) { this.swallowClick = false; return; }
    if (this.photos().length) this.viewer.set(true);
  }

  closeViewer(index: number): void {
    this.viewer.set(false);
    this.photo.set(index);
  }

  swipeDown(e: PointerEvent): void {
    // Мышью листают превью; свайп — жест пальца. На видео жесты у плеера
    if (e.pointerType === 'mouse' || !e.isPrimary || this.videoOn() || this.slides() < 2) return;
    this.swipe = { x: e.clientX, y: e.clientY, on: false };
    this.swallowClick = false;
  }

  swipeMove(e: PointerEvent): void {
    const s = this.swipe;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (!s.on) {
      if (Math.abs(dx) < SWIPE_START || Math.abs(dx) < Math.abs(e.clientY - s.y)) return;
      s.on = true;
      (e.currentTarget as Element | null)?.setPointerCapture?.(e.pointerId);
    }
    // У крайних слайдов фото тянется туго — видно, что дальше ничего нет
    const edge = (dx > 0 && this.photo() === 0) || (dx < 0 && this.photo() === this.slides() - 1);
    this.swipeDx.set(edge ? dx / 3 : dx);
  }

  swipeUp(): void {
    const s = this.swipe;
    this.swipe = null;
    if (!s?.on) return;
    const dx = this.swipeDx();
    this.swipeDx.set(0);
    this.swallowClick = true;
    setTimeout(() => (this.swallowClick = false));
    const next = this.photo() + (dx <= -SWIPE_X ? 1 : dx >= SWIPE_X ? -1 : 0);
    if (next >= 0 && next < this.slides()) this.photo.set(next);
  }

  copyPost(): void {
    const post = this.igPost();
    if (!this.browser || !post || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(post).then(
      () => {
        this.copied.set(true);
        // В вертикальном просмотре подсказку под кнопкой не видно — говорим плашкой
        if (this.reel()) this.toasts.show({ text: 'Ссылка на пост скопирована — вставьте её в чат' });
      },
      () => this.toasts.error('Не удалось скопировать ссылку на пост — напишите лавке название товара'),
    );
  }

  /** Кнопка вертикального просмотра: Direct копирует пост; в корзину кладём; не выбран размер — закрываем и ведём к выбору. */
  reelAct(p: Product): void {
    if (this.direct()) { this.copyPost(); return; }
    if (this.canAdd()) { this.add(p); return; }
    this.reel.set(false);
    this.barAdd(p);
  }

  /** Двойной тап в просмотре только добавляет в избранное, как «лайк» в Instagram: повторный тап не убирает. */
  like(p: Product): void {
    if (!this.fav.has(p.id)) this.fav.toggle(p.id);
  }

  /**
   * trigger — нажатая кнопка. Летим от фото, пока оно на экране, иначе (липкая панель внизу,
   * страница прокручена) — от самой кнопки. В полноэкранном просмотре корзины не видно — без полёта.
   */
  add(p: Product, trigger: EventTarget | null = null): void {
    if (!this.canAdd()) return;
    const ok = this.cart.add(p, p.sizes.length ? this.size() : null);
    if (ok) this.haptics.success(); else this.haptics.warning();
    this.limitError.set(!ok);
    this.added.set(ok);
    if (!this.reel()) {
      if (ok) this.fly.fly(this.mainRef()?.nativeElement, trigger instanceof Element ? trigger : null);
      return;
    }
    // В вертикальном просмотре корзины и подсказок под кнопкой не видно — полёта нет, говорим плашкой
    if (ok) this.toasts.show({ text: 'Товар в корзине', action: { label: 'Перейти', link: '/cart' } });
    else this.toasts.error('В корзине уже 30 позиций — оформите заказ или уберите лишнее');
  }
}
