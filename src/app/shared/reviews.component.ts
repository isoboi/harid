import { afterNextRender, ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { dayMonth } from '../core/checkout-options';
import { MarketApi } from '../core/market-api.service';
import { Review, Reviewable, ReviewQuery, ReviewSummary } from '../core/models';
import { RateItemComponent } from '../pages/my-orders/rate-purchases.component';
import { IconComponent } from './icon.component';
import { ratingNumber, reviewsCount } from './rating';
import { StarsComponent } from './stars.component';

type Star = 5 | 4 | 3 | 2 | 1;
/** Фильтр списка: все, только с текстом или одна оценка. */
type Filter = { kind: 'all' } | { kind: 'text' } | { kind: 'star'; star: Star };

const FIRST_PAGE = 6;
const MORE = 12;

/**
 * Раздел «Отзывы» на странице товара и лавки (решение 0007).
 * Слева (на телефоне — сверху) сводка: средняя, число и полосы 5★…1★ — полоса работает как фильтр.
 * Справа лента: автор, оценка, «Покупка подтверждена», текст и публичный ответ лавки.
 * Покупатель, получивший этот товар, оценивает его прямо здесь (карточка с выбором звёзд).
 * reviews — первый список от страницы (рендерится и на сервере); null — отзывы не загрузились, раздел скрыт.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-reviews',
  standalone: true,
  imports: [RouterLink, StarsComponent, IconComponent, RateItemComponent],
  template: `
    @if (reviews()) {
      <section class="rv" aria-labelledby="reviews-title">
        <h2 id="reviews-title" class="title" [class.sr-only]="hideTitle()">Отзывы</h2>

        <div class="grid" [class.grid--empty]="!total()" [class.grid--flush]="hideTitle()">
          <aside class="sum" data-test="summary">
            @if (total()) {
              <div class="score">
                <span class="score-num">{{ num(avg()!) }}</span>
                <span class="score-meta">
                  <app-stars [rating]="avg()!" [size]="18" />
                  <span class="score-count">{{ countText() }}</span>
                </span>
              </div>
              @if (dist(); as d) {
                <ul class="bars" aria-label="Распределение оценок">
                  @for (s of stars; track s) {
                    <li>
                      <button type="button" class="bar" data-test="bar" [class.on]="isStar(s)" [disabled]="!d[s]"
                        [attr.aria-pressed]="isStar(s)" [attr.aria-label]="s + ' из 5: ' + d[s] + ' — показать только их'" (click)="toggleStar(s)">
                        <span class="bar-s">{{ s }}<app-icon name="star" [size]="12" [filled]="true" /></span>
                        <span class="bar-track"><span class="bar-fill" [style.width.%]="share(d[s])"></span></span>
                        <span class="bar-n">{{ d[s] }}</span>
                      </button>
                    </li>
                  }
                </ul>
              }
            } @else {
              <p class="none-title" data-test="empty">Отзывов пока нет</p>
            }
            <p class="rule"><app-icon name="circle-check" [size]="16" [stroke]="2" />Отзыв оставляют только после получения заказа</p>
          </aside>

          <div class="feed">
            @if (rateItem(); as it) {
              <div class="rate" data-test="rate-here">
                <p class="rate-title">{{ it.review ? 'Ваш отзыв' : 'Вы купили этот товар — оцените его' }}</p>
                <app-rate-item [item]="it" [compact]="true" (saved)="onRated($event)" />
              </div>
            }

            @if (total()) {
              <div class="chips" role="group" aria-label="Фильтр отзывов">
                <button type="button" class="chip" [class.on]="filter().kind === 'all'" [attr.aria-pressed]="filter().kind === 'all'" (click)="setFilter({ kind: 'all' })">Все</button>
                <button type="button" class="chip" data-test="chip-text" [class.on]="filter().kind === 'text'" [attr.aria-pressed]="filter().kind === 'text'" (click)="setFilter({ kind: 'text' })">С текстом</button>
                @if (starFilter(); as s) {
                  <button type="button" class="chip on" data-test="chip-star" aria-label="Сбросить фильтр по оценке" (click)="setFilter({ kind: 'all' })">
                    {{ s }}<app-icon name="star" [size]="12" [filled]="true" /><app-icon name="x" [size]="14" [stroke]="2.2" />
                  </button>
                }
              </div>

              @if (loading()) {
                <p class="state" role="status">Загружаем…</p>
              } @else if (!list().length) {
                <p class="state" data-test="filtered-empty">Таких отзывов нет. <button type="button" class="link" (click)="setFilter({ kind: 'all' })">Показать все</button></p>
              } @else {
                <ul class="list">
                  @for (r of shown(); track r.id) {
                    <li class="item" data-test="review">
                      <div class="head">
                        <span class="ava" aria-hidden="true">{{ initial(r.author) }}</span>
                        <span class="who">
                          <span class="author">{{ r.author }}</span>
                          <span class="verified"><app-icon name="circle-check" [size]="13" [stroke]="2.2" />Покупка подтверждена</span>
                        </span>
                        <time class="date" [attr.datetime]="r.created_at.slice(0, 10)">{{ date(r.created_at) }}</time>
                      </div>
                      <app-stars class="stars" [rating]="r.rating" [size]="16" />
                      @if (showProduct()) { <a class="product" [routerLink]="['/product', r.product_id]">{{ r.product_title }}</a> }
                      @if (r.text) { <p class="text">{{ r.text }}</p> }
                      @if (r.reply; as reply) {
                        <div class="reply" data-test="reply">
                          <p class="reply-head"><span class="reply-who">Ответ лавки &#64;{{ r.shop_handle }}</span><time [attr.datetime]="reply.created_at.slice(0, 10)">{{ date(reply.created_at) }}</time></p>
                          <p class="reply-text">{{ reply.text }}</p>
                        </div>
                      }
                    </li>
                  }
                </ul>
                @if (list().length > shown().length) {
                  <button type="button" class="more" data-test="more" (click)="limit.set(limit() + more)">Показать ещё {{ Math.min(more, list().length - shown().length) }}</button>
                }
              }
            } @else if (!rateItem()) {
              <p class="state">Здесь появятся оценки покупателей, получивших {{ showProduct() ? 'товары этой лавки' : 'этот товар' }}.</p>
            }
          </div>
        </div>
      </section>
    }
  `,
  styles: `
    :host { display: block }
    .title { font-size: 22px; font-weight: 700 }
    .grid { margin-top: 20px; display: grid; gap: 24px }
    .grid--flush { margin-top: 0 }
    @media (min-width: 900px) {
      .grid { grid-template-columns: 300px minmax(0, 1fr); gap: 48px; align-items: start }
      .sum { position: sticky; top: 92px }
    }

    /* Сводка: крупная оценка, полосы распределения — тот же шафран, что у звёзд */
    .sum { padding: 20px; border-radius: 16px; background: var(--color-mist) }
    .score { display: flex; align-items: center; gap: 14px }
    .score-num { font-size: 48px; font-weight: 800; line-height: 1; letter-spacing: -0.03em; font-variant-numeric: tabular-nums }
    .score-meta { display: flex; flex-direction: column; gap: 4px }
    .score-count { font-size: 14px; color: var(--color-ink-soft) }
    .bars { margin: 16px 0 0; padding: 0; list-style: none; display: grid; gap: 2px }
    .bar { display: grid; grid-template-columns: 30px 1fr 32px; align-items: center; gap: 10px; width: 100%; min-height: 32px; padding: 0 6px; border-radius: 8px; color: var(--color-ink); font: inherit; text-align: left; cursor: pointer }
    @media (hover: hover) { .bar:not(:disabled):hover { background: color-mix(in srgb, var(--color-paper) 70%, transparent) } }
    .bar.on { background: var(--color-paper); box-shadow: 0 1px 2px rgb(19 35 91 / .08) }
    .bar:disabled { cursor: default; opacity: .55 }
    .bar:focus-visible { outline: 2px solid var(--color-lapis); outline-offset: 1px }
    .bar-s { display: inline-flex; align-items: center; gap: 3px; font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums }
    .bar-s app-icon { display: inline-flex; color: var(--color-saffron) }
    .bar-track { height: 8px; border-radius: 9999px; background: var(--color-line); overflow: hidden }
    .bar-fill { display: block; height: 100%; border-radius: inherit; background: var(--color-saffron); transition: width .4s cubic-bezier(.2, .8, .2, 1) }
    .bar-n { font-size: 13px; color: var(--color-ink-soft); text-align: right; font-variant-numeric: tabular-nums }
    .none-title { font-size: 17px; font-weight: 700 }
    .rule { display: flex; gap: 8px; align-items: flex-start; margin-top: 16px; font-size: 13px; line-height: 1.45; color: var(--color-ink-soft) }
    .rule app-icon { flex: none; display: inline-flex; margin-top: 1px; color: var(--color-lapis) }

    .rate { margin-bottom: 20px; padding: 4px 16px 0; border: 1px solid var(--color-line); border-radius: 16px }
    .rate-title { margin-top: 14px; font-weight: 700 }

    .chips { display: flex; flex-wrap: wrap; gap: 8px }
    .chip { display: inline-flex; align-items: center; gap: 4px; min-height: 36px; padding: 0 14px; border: 1px solid var(--color-line); border-radius: 9999px; background: var(--color-paper); color: var(--color-ink); font: inherit; font-size: 14px; font-weight: 500; cursor: pointer }
    .chip app-icon { display: inline-flex }
    .chip.on { border-color: var(--color-ink); background: var(--color-ink); color: var(--color-paper) }
    @media (hover: hover) { .chip:not(.on):hover { background: var(--color-mist) } }
    .state { margin-top: 20px; color: var(--color-ink-soft) }
    .link { padding: 0; border: 0; background: none; color: var(--color-lapis); font: inherit; font-weight: 600; cursor: pointer; text-decoration: underline; text-underline-offset: 2px }

    .list { margin: 8px 0 0; padding: 0; list-style: none }
    .item { padding-block: 20px; border-bottom: 1px solid var(--color-line) }
    .head { display: flex; align-items: center; gap: 12px }
    .ava { flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: var(--color-mist); color: var(--color-ink); font-weight: 700 }
    .who { flex: 1; min-width: 0; display: flex; flex-direction: column }
    .author { overflow: hidden; font-weight: 600; text-overflow: ellipsis; white-space: nowrap }
    .verified { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--color-ink-soft) }
    .verified app-icon { display: inline-flex; color: var(--color-lapis) }
    .date { flex: none; font-size: 13px; color: var(--color-ink-soft); white-space: nowrap }
    .stars { margin-top: 10px }
    .product { margin-top: 6px; display: inline-block; font-size: 14px; font-weight: 500; color: var(--color-lapis) }
    @media (hover: hover) { .product:hover { text-decoration: underline; text-underline-offset: 2px } }
    @media (max-width: 639.98px) { .product { padding-block: 12px; margin-block: -6px -12px } }
    .text { margin-top: 8px; max-width: 65ch; font-size: 15px; line-height: 1.6; white-space: pre-line; overflow-wrap: anywhere }
    /* Ответ лавки: туманная подложка с отступом — голос продавца отделён от голоса покупателя */
    .reply { margin-top: 12px; margin-left: 52px; max-width: 60ch; padding: 12px 14px; border-radius: 4px 14px 14px 14px; background: var(--color-mist) }
    @media (max-width: 639.98px) { .reply { margin-left: 0 } }
    .reply-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px; font-size: 13px; color: var(--color-ink-soft) }
    .reply-who { font-weight: 600; color: var(--color-ink) }
    .reply-text { margin-top: 4px; font-size: 15px; line-height: 1.55; white-space: pre-line; overflow-wrap: anywhere }
    .more { margin-top: 16px; min-height: 44px; padding: 0 20px; border: 1px solid var(--color-line); border-radius: 9999px; background: var(--color-paper); color: var(--color-ink); font: inherit; font-weight: 600; cursor: pointer }
    @media (hover: hover) { .more:hover { background: var(--color-mist) } }
  `,
})
export class ReviewsComponent {
  private readonly api = inject(MarketApi);
  private readonly auth = inject(AuthService);
  readonly reviews = input<Review[] | null>(null);
  /** Сводка из объекта товара или лавки — до прихода /reviews/summary. */
  readonly rating = input<number | null>(null);
  readonly count = input(0);
  /** На странице лавки у отзыва показываем товар. */
  readonly showProduct = input(false);
  /** id товара — для сводки, фильтров и «Оценить здесь». */
  readonly product = input<string>('');
  /** Ник лавки — для сводки и фильтров на странице лавки. */
  readonly shop = input<string>('');
  /** Заголовок уже есть снаружи (вкладка «Отзывы») — видимый h2 прячем, для чтения с экрана он остаётся. */
  readonly hideTitle = input(false);

  protected readonly stars: Star[] = [5, 4, 3, 2, 1];
  protected readonly more = MORE;
  protected readonly Math = Math;
  protected readonly summary = signal<ReviewSummary | null>(null);
  protected readonly filter = signal<Filter>({ kind: 'all' });
  /** Список по фильтру; null — используем первый список страницы. */
  private readonly filtered = signal<Review[] | null>(null);
  /** Свежий полный список после своего отзыва. */
  private readonly fresh = signal<Review[] | null>(null);
  protected readonly loading = signal(false);
  protected readonly limit = signal(FIRST_PAGE);
  protected readonly rateItem = signal<Reviewable | null>(null);
  private readonly hydrated = signal(false);

  protected readonly avg = computed(() => this.summary()?.rating ?? this.rating());
  protected readonly total = computed(() => this.summary()?.count ?? this.count());
  protected readonly dist = computed(() => this.summary()?.distribution ?? null);
  protected readonly countText = computed(() => reviewsCount(this.total()));
  protected readonly list = computed(() => this.filtered() ?? this.fresh() ?? this.reviews() ?? []);
  protected readonly shown = computed(() => this.list().slice(0, this.limit()));
  protected readonly starFilter = computed(() => { const f = this.filter(); return f.kind === 'star' ? f.star : null; });
  protected readonly num = ratingNumber;
  protected readonly date = dayMonth;

  private get query(): ReviewQuery { return this.product() ? { product: this.product() } : this.shop() ? { shop: this.shop() } : {}; }

  constructor() {
    // Сводка с распределением — по товару или лавке (идёт и при серверном рендере)
    effect((onCleanup) => {
      const q = { product: this.product(), shop: this.shop() };
      if (!q.product && !q.shop) return;
      untracked(() => { this.filter.set({ kind: 'all' }); this.filtered.set(null); this.fresh.set(null); this.limit.set(FIRST_PAGE); });
      const sub = this.api.reviewSummary(q).pipe(catchError(() => of(null))).subscribe((s) => this.summary.set(s));
      onCleanup(() => sub.unsubscribe());
    });
    // «Оценить здесь»: только в браузере после гидратации, только вошедшему и только если товар у него доставлен
    afterNextRender(() => { this.auth.hydrate(); this.hydrated.set(true); });
    effect((onCleanup) => {
      const id = this.product();
      if (!this.hydrated() || !id || !this.auth.loggedIn()) { untracked(() => this.rateItem.set(null)); return; }
      const sub = this.api.reviewable().pipe(catchError(() => of([] as Reviewable[]))).subscribe((list) => this.rateItem.set(list.find((i) => i.product_id === id) ?? null));
      onCleanup(() => sub.unsubscribe());
    });
  }

  protected isStar(s: Star): boolean { return this.starFilter() === s; }
  protected toggleStar(s: Star): void { this.setFilter(this.isStar(s) ? { kind: 'all' } : { kind: 'star', star: s }); }
  protected share(n: number): number { const t = this.total(); return t ? Math.max(n ? 3 : 0, (n / t) * 100) : 0; }
  protected initial(name: string): string { return (name.trim().charAt(0) || '?').toUpperCase(); }

  protected setFilter(f: Filter): void {
    this.filter.set(f);
    this.limit.set(FIRST_PAGE);
    if (f.kind === 'all') { this.filtered.set(null); return; }
    this.loading.set(true);
    const q: ReviewQuery = { ...this.query, ...(f.kind === 'star' ? { rating: f.star } : { with_text: true }) };
    this.api.reviews(q).pipe(catchError(() => of([] as Review[]))).subscribe((list) => { this.filtered.set(list); this.loading.set(false); });
  }

  /** Свой отзыв принят — обновляем карточку, сводку и ленту. */
  protected onRated(item: Reviewable): void {
    this.rateItem.set(item);
    const q = this.query;
    this.api.reviewSummary(q).pipe(catchError(() => of(null))).subscribe((s) => s && this.summary.set(s));
    this.api.reviews(q).pipe(catchError(() => of(null))).subscribe((list) => list && this.fresh.set(list));
    if (this.filter().kind !== 'all') this.setFilter(this.filter());
  }
}
