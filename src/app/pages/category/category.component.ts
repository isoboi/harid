import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { MarketApi } from '../../core/market-api.service';
import { Category, FeedFilters } from '../../core/models';
import { I18n, TPipe } from '../../core/i18n';
import { SeoService } from '../../core/seo.service';
import { activeFilterCount, parseFeedFilters } from '../../shared/feed-filters';
import { FeedFiltersComponent } from '../../shared/feed-filters.component';
import { ProductCardComponent } from '../../shared/product-card.component';
import { FeedMoreComponent, ProductFeed } from '../../shared/product-feed';
import { PullRefreshComponent } from '../../shared/pull-refresh.component';
import { SkelProductsComponent } from '../../shared/skeleton.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-category',
  standalone: true,
  imports: [RouterLink, ProductCardComponent, FeedMoreComponent, FeedFiltersComponent, SkelProductsComponent, PullRefreshComponent, TPipe],
  template: `
    <app-pull-refresh [busy]="feed.refreshing()" (refresh)="feed.refresh()" />
    <div class="wrap page-top">
      @if (categories()) { <h1 class="page-title">{{ name() }}</h1> }
      @else { <h1 class="page-title"><span class="skel title-skel" aria-hidden="true"></span><span class="sr-only">{{ 'Загрузка…' | t }}</span></h1> }
      <!-- Общего числа сервер не отдаёт: пока лента не загружена до конца, число было бы неверным -->
      <p class="count muted">
        @if (feed.done()) { {{ '{n} {products} из Instagram-магазинов' | t: { n: products().length, products: i18n.plural(products().length, productForms) } }} }
        @else { {{ 'Товары из Instagram-магазинов' | t }} }
      </p>
      <nav class="chips cats" [attr.aria-label]="'Категории' | t">
        <a class="chip" routerLink="/">{{ 'Всё' | t }}</a>
        @if (categories(); as list) {
          @for (c of list; track c.slug) {
            <a class="chip" [class.chip--on]="c.slug === slug()" [attr.aria-current]="c.slug === slug() ? 'page' : null" [routerLink]="['/c', c.slug]">{{ c.name }}</a>
          }
        } @else {
          @for (w of chipSkeleton; track $index) { <span class="skel chip" aria-hidden="true" [style.width.px]="w"></span> }
        }
      </nav>
      <app-feed-filters class="filters" [base]="base()" [value]="filters()" />
      <div class="list">
        @if (products().length) { <div class="products">@for (p of products(); track p.id) { <app-product-card [product]="p" /> }</div> }
        @else if (feed.loading()) { <app-skel-products /> }
        @else { <p class="muted">{{ filtered() ? ('По этим фильтрам ничего нет' | t) : ('Пока пусто' | t) }}</p> }
        @if (!feed.done()) { <app-feed-more [feed]="feed" /> }
      </div>
    </div>
  `,
  styles: `
    /* Серая полоса высотой в строку заголовка — h1 не меняет высоту, когда придёт имя */
    .title-skel { display: inline-block; vertical-align: middle; height: 34px; width: min(220px, 70%) }
    .count { margin-top: 4px }
    .cats { margin-top: 24px }
    .filters { display: block; margin-top: 16px }
    .list { margin-top: 24px }
  `,
})
export class CategoryComponent {
  private readonly api = inject(MarketApi);
  private readonly seo = inject(SeoService);
  protected readonly i18n = inject(I18n);
  readonly productForms: [string, string, string] = ['товар', 'товара', 'товаров'];
  readonly slug = input.required<string>();
  readonly feed = new ProductFeed();
  readonly products = this.feed.items;
  /** undefined — ещё грузятся (вместо имени и чипов — заглушки), при ошибке — пустой список. */
  readonly categories = toSignal<Category[] | undefined>(this.api.categories().pipe(catchError(() => of([]))), { initialValue: undefined });
  readonly name = computed(() => this.categories()?.find((c) => c.slug === this.slug())?.name ?? this.i18n.t('Категория'));
  /** Ширины серых чипов, пока категории не пришли. */
  readonly chipSkeleton = [96, 120, 84, 132, 104];
  readonly base = computed(() => ({ category: this.slug() }));
  readonly filters = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map(parseFeedFilters)), { initialValue: {} as FeedFilters });
  readonly filtered = computed(() => activeFilterCount(this.filters()) > 0);
  constructor() {
    // Другая категория или фильтры — лента с начала
    effect(() => {
      const query = { ...this.filters(), ...this.base() };
      untracked(() => this.feed.reset(query));
    });
    effect(() => {
      const name = this.name();
      this.seo.set({ title: this.i18n.t('{name} — Харид', { name }), description: this.i18n.t('{name} в Instagram-лавках Таджикистана', { name }) });
    });
  }
}
