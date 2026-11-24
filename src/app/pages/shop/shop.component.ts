import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { dayMonth } from '../../core/checkout-options';
import { MarketApi } from '../../core/market-api.service';
import { FeedFilters, Review, Shop } from '../../core/models';
import { activeFilterCount, parseFeedFilters } from '../../shared/feed-filters';
import { FeedFiltersComponent } from '../../shared/feed-filters.component';
import { FeedMoreComponent, ProductFeed } from '../../shared/product-feed';
import { SeoService } from '../../core/seo.service';
import { shopLd, shopPath } from '../../core/structured-data';
import { IconComponent } from '../../shared/icon.component';
import { followersCount, followersLabel } from '../../shared/followers';
import { ProductCardComponent } from '../../shared/product-card.component';
import { ShopRating, shopRating } from '../../shared/rating';
import { ReviewsComponent } from '../../shared/reviews.component';
import { ShareComponent } from '../../shared/share.component';
import { ShopAvatarComponent } from '../../shared/shop-avatar.component';
import { SkelProductsComponent } from '../../shared/skeleton.component';
import { NotFoundComponent } from '../not-found/not-found.component';

type ShopTab = 'goods' | 'reviews';
/** Фильтры появляются, когда товаров больше этого числа. */
const FILTERS_FROM = 8;

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [ProductCardComponent, NotFoundComponent, IconComponent, ShopAvatarComponent, ReviewsComponent, FeedFiltersComponent, FeedMoreComponent, ShareComponent, SkelProductsComponent],
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
              <app-share class="share" [path]="shopPath(s.handle)" [text]="'Лавка @' + s.handle + ' на Хариде'" />
            </div>
            <dl class="stats">
              <!-- Пункт «Оценка» есть всегда: без оценок пустое место выглядело бы как скрытый плохой рейтинг -->
              <div data-test="shop-rating">
                <dt>Оценка</dt>
                @let r = rate();
                @if (r.kind === 'rated') {
                  <dd class="rating"><app-icon class="star" name="star" [size]="17" [filled]="true" />{{ r.value }}</dd>
                  <dd class="count"><button type="button" class="to-reviews" data-test="to-reviews" (click)="setTab('reviews')">{{ r.count }}</button></dd>
                } @else if (r.kind === 'direct') { <dd class="quiet">Нет</dd><dd class="count">заказы в Direct</dd> }
                @else { <dd class="quiet">Пока без оценок</dd> }
              </div>
              <!-- Лавка в Direct не возит через Харид — «0 доставлено» выглядело бы как плохой показатель -->
              @if (s.verified !== false) { <div><dt>Доставлено</dt><dd>{{ s.delivered_orders }}</dd></div> }
              @if (s.followers > 0) { <div data-test="followers"><dt>В Instagram</dt><dd>{{ followersCount(s.followers) }} {{ followersLabel(s.followers) }}</dd></div> }
            </dl>
          </header>
          <p class="meta">
            @if (s.district) { <span class="pin"><app-icon name="map-pin" [size]="15" />Лавка в районе {{ s.district }}</span> }
            @if (joined()) { <span>На Хариде с {{ joined() }}</span> }
            <span>Оценка и заказы — только по доставкам через Харид</span>
          </p>
          <!-- Товары и отзывы — вкладки: длинная лента больше не прячет отзывы в самый низ. Вкладка — в адресе (?tab=reviews) -->
          <div class="tabs" role="tablist" aria-label="Разделы лавки" (keydown)="onTabKey($event)">
            <button type="button" role="tab" id="tab-goods" class="tab" data-test="tab-goods" aria-controls="panel-goods"
              [attr.aria-selected]="tab() === 'goods'" [attr.tabindex]="tab() === 'goods' ? 0 : -1" (click)="setTab('goods')">
              Товары @if (goodsCount() !== null) { <span class="tab-n">{{ goodsCount() }}</span> }
            </button>
            <button type="button" role="tab" id="tab-reviews" class="tab" data-test="tab-reviews" aria-controls="panel-reviews"
              [attr.aria-selected]="tab() === 'reviews'" [attr.tabindex]="tab() === 'reviews' ? 0 : -1" (click)="setTab('reviews')">
              Отзывы @if (reviewsCount()) { <span class="tab-n">{{ reviewsCount() }}</span> }
            </button>
          </div>
          @if (tab() === 'goods') {
            <section id="panel-goods" class="panel" role="tabpanel" aria-labelledby="tab-goods" data-test="panel-goods">
              @if (showFilters()) { <app-feed-filters class="filters" [base]="base()" [value]="filters()" /> }
              @if (products().length) { <div class="products">@for (p of products(); track p.id) { <app-product-card [product]="p" /> }</div> }
              @else if (feed.loading()) { <app-skel-products /> }
              @else { <p class="muted">{{ filtered() ? 'По этим фильтрам ничего нет' : 'Пока пусто' }}</p> }
              @if (!feed.done()) { <app-feed-more [feed]="feed" /> }
            </section>
          } @else {
            <section id="panel-reviews" class="panel" role="tabpanel" aria-labelledby="tab-reviews" data-test="panel-reviews">
              <app-reviews [reviews]="reviews()" [rating]="s.rating" [count]="s.reviews_count ?? 0" [showProduct]="true" [shop]="s.handle" [hideTitle]="true" />
            </section>
          }
        </div>
      } @else {
        <!-- Заглушка загрузки по форме шапки лавки: аватар, имя, @ник, три показателя, вкладки и сетка товаров -->
        <!-- «Загрузка…» для экранных чтецов объявляет app-skel-products -->
        <div class="wrap page-top" data-test="skel-shop">
          <div aria-hidden="true">
            <div class="head">
              <span class="skel skel--round ava-skel"></span>
              <div class="who">
                <span class="skel skel--line name-skel"></span>
                <span class="skel skel--line ig-skel"></span>
              </div>
              <div class="stats">
                @for (n of [1, 2, 3]; track n) { <div><span class="skel skel--line dt-skel"></span><span class="skel skel--line dd-skel"></span></div> }
              </div>
            </div>
            <span class="skel skel--line meta-skel"></span>
            <div class="tabs"><span class="tab"><span class="skel skel--line tab-skel"></span></span><span class="tab"><span class="skel skel--line tab-skel"></span></span></div>
          </div>
          <app-skel-products class="panel" />
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
    .quiet { font-size: 16px; font-weight: 600; line-height: 30px; color: var(--color-ink-soft) }
    .to-reviews { padding: 0; font: inherit; color: inherit; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--color-line); cursor: pointer }
    @media (hover: hover) { .to-reviews:hover { color: var(--color-ink); text-decoration-color: currentColor } }
    .star { color: var(--color-saffron) }
    /* Вкладки: подчёркивание чернилами под активной, общая линия под рядом */
    .tabs { margin-top: 32px; display: flex; gap: 28px; border-bottom: 1px solid var(--color-line) }
    .tab { position: relative; display: inline-flex; align-items: baseline; gap: 8px; min-height: 48px; padding: 12px 0; font-size: 17px; font-weight: 600; color: var(--color-ink-soft); cursor: pointer; transition: color .15s }
    .tab::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 3px; border-radius: 3px 3px 0 0; background: var(--color-ink); transform: scaleX(0); transition: transform .25s cubic-bezier(.16, 1, .3, 1) }
    .tab[aria-selected="true"] { color: var(--color-ink) }
    .tab[aria-selected="true"]::after { transform: scaleX(1) }
    @media (hover: hover) { .tab:hover { color: var(--color-ink) } }
    .tab:focus-visible { outline: 2px solid var(--color-lapis); outline-offset: 2px; border-radius: 4px }
    .tab-n { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--color-ink-soft) }
    .panel { margin-top: 24px }
    .filters { display: block; margin-bottom: 24px }
    @media (prefers-reduced-motion: reduce) { .tab::after { transition: none } }
    .meta { margin-top: 16px; display: flex; flex-wrap: wrap; align-items: center; column-gap: 20px; row-gap: 4px; font-size: 14px; color: var(--color-ink-soft) }
    .pin { display: inline-flex; align-items: center; gap: 6px }
    /* Своей строкой под ником, а не вплотную к ссылке Instagram */
    app-share.share { display: block; width: fit-content; margin-top: 8px }
    /* Заглушка: размеры блоков совпадают с настоящей шапкой (аватар 112, имя 30px, ссылка 44px) */
    .ava-skel { flex: none; width: 112px; height: 112px }
    .name-skel { height: 30px; margin-block: 4px; width: min(256px, 80%) }
    .ig-skel { margin-top: 19px; margin-bottom: 15px; width: 140px }
    .dt-skel { height: 12px; width: 64px; margin-block: 3px }
    .dd-skel { height: 20px; width: 48px; margin-top: 6px }
    .meta-skel { margin-top: 20px; width: min(420px, 90%) }
    .tab-skel { width: 88px; height: 17px; align-self: center }
    app-skel-products.panel { display: block }
  `,
})
export class ShopComponent {
  private readonly api = inject(MarketApi);
  private readonly seo = inject(SeoService);
  private readonly title = inject(Title);
  readonly followersCount = followersCount;
  readonly followersLabel = followersLabel;
  readonly shopPath = shopPath;
  readonly handle = input.required<string>();
  readonly shop = signal<Shop | null>(null);
  /** Товары лавки по страницам — с фильтрами из адреса. */
  readonly feed = new ProductFeed();
  readonly products = this.feed.items;
  readonly base = computed(() => ({ shop: this.handle() }));
  private readonly params = toSignal(inject(ActivatedRoute).queryParamMap, { requireSync: true });
  /** Сравнение по значению: смена ?tab= даёт новый объект фильтров, но ленту перезапускать незачем. */
  readonly filters = computed<FeedFilters>(() => parseFeedFilters(this.params()), { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) });
  readonly filtered = computed(() => activeFilterCount(this.filters()) > 0 || !!this.filters().sort);
  readonly tab = computed<ShopTab>(() => (this.params().get('tab') === 'reviews' ? 'reviews' : 'goods'));
  /** Число на вкладке — только когда лента загружена целиком, иначе оно было бы неверным. */
  readonly goodsCount = computed(() => (this.feed.done() && !this.feed.loading() ? this.products().length : null));
  readonly reviewsCount = computed(() => this.shop()?.reviews_count ?? this.reviews()?.length ?? 0);
  /** У лавки с парой товаров фильтры — шум; показываем, когда товаров много или фильтр уже включён. */
  readonly showFilters = computed(() => this.filtered() || !this.feed.done() || this.products().length > FILTERS_FROM);
  private readonly router = inject(Router);
  readonly missing = signal(false);
  readonly failed = signal(false);
  readonly joined = computed(() => dayMonth(this.shop()?.joined_at ?? ''));
  /** Отзывы о товарах лавки; null — не загрузились, раздел скрыт. */
  readonly reviews = signal<Review[] | null>(null);
  readonly rate = computed<ShopRating>(() => { const s = this.shop(); return s ? shopRating(s) : { kind: 'none' }; });
  constructor() {
    effect((onCleanup) => {
      const h = this.handle();
      this.missing.set(false); this.failed.set(false); this.shop.set(null); this.reviews.set(null);
      const subs = untracked(() => [
        this.api.shop(h).subscribe({
          next: (s) => { this.shop.set(s); this.seo.set({ title: `@${s.handle} — Харид`, description: s.bio || `Лавка @${s.handle} на Хариде`, image: s.avatar_url || undefined, jsonLd: shopLd(s, this.seo.origin()), keepParams: ['tab'], path: shopPath(s.handle) }); },
          error: (e) => {
            // Теги прошлой страницы SeoService убрал при переходе; заголовок вкладки — свой
            if (e instanceof HttpErrorResponse && e.status === 404) { this.missing.set(true); this.title.setTitle('Лавка не найдена — Харид'); }
            else { this.failed.set(true); this.title.setTitle('Лавка не загрузилась — Харид'); }
          },
        }),
        this.api.reviews({ shop: h }).pipe(catchError(() => of(null))).subscribe((r) => this.reviews.set(r)),
      ]);
      onCleanup(() => subs.forEach((x) => x.unsubscribe()));
    });
    // Другая лавка или фильтры — лента с начала (смена вкладки ленту не трогает)
    effect(() => {
      const query = { ...this.filters(), ...this.base() };
      untracked(() => this.feed.reset(query));
    });
  }

  setTab(tab: ShopTab): void {
    if (tab === this.tab()) return;
    void this.router.navigate([], { queryParams: { tab: tab === 'reviews' ? 'reviews' : null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** Стрелки и Home/End переключают вкладки и переводят на них фокус — как у системных вкладок. */
  onTabKey(event: KeyboardEvent): void {
    const order: ShopTab[] = ['goods', 'reviews'];
    const i = order.indexOf(this.tab());
    const next = { ArrowRight: order[(i + 1) % 2], ArrowLeft: order[(i + 1) % 2], Home: order[0], End: order[1] }[event.key];
    if (!next) return;
    event.preventDefault();
    this.setTab(next);
    (event.currentTarget as HTMLElement).querySelector<HTMLElement>(`#tab-${next}`)?.focus();
  }
}
