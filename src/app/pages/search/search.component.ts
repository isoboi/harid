import { Component, computed, effect, untracked, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { FeedFilters } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { activeFilterCount, parseFeedFilters } from '../../shared/feed-filters';
import { FeedFiltersComponent } from '../../shared/feed-filters.component';
import { ProductCardComponent } from '../../shared/product-card.component';
import { FeedMoreComponent, ProductFeed } from '../../shared/product-feed';
import { PullRefreshComponent } from '../../shared/pull-refresh.component';
import { SkelProductsComponent } from '../../shared/skeleton.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [ProductCardComponent, FeedMoreComponent, FeedFiltersComponent, SkelProductsComponent, PullRefreshComponent],
  template: `
    <app-pull-refresh [busy]="feed.refreshing()" (refresh)="feed.refresh()" />
    <div class="wrap page-top">
      @if (!q()) { <p class="muted">Введите запрос</p> }
      @else {
        <h1 class="page-title">Поиск: «{{ q() }}»</h1>
        <app-feed-filters class="filters" [base]="base()" [value]="filters()" />
        <div class="list">
          @if (products().length) { <div class="products">@for (p of products(); track p.id) { <app-product-card [product]="p" /> }</div> }
          @else if (feed.loading()) { <app-skel-products /> }
          @else { <p class="muted">{{ filtered() ? 'По этим фильтрам ничего нет' : 'Ничего не нашлось' }}</p> }
          @if (!feed.done()) { <app-feed-more [feed]="feed" /> }
        </div>
      }
    </div>
  `,
  styles: `.page-title { overflow-wrap: anywhere } .filters { display: block; margin-top: 16px } .list { margin-top: 24px }`,
})
export class SearchComponent {
  /** Запрос уже без пробелов по краям; undefined из query приводится к пустой строке. */
  readonly q = input('', { transform: (v: string | undefined) => (v ?? '').trim() });
  /** Результаты поиска: догружаются при прокрутке. */
  readonly feed = new ProductFeed();
  readonly products = this.feed.items;
  readonly base = computed(() => ({ q: this.q() }));
  readonly filters = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map(parseFeedFilters)), { initialValue: {} as FeedFilters });
  readonly filtered = computed(() => activeFilterCount(this.filters()) > 0);
  constructor() {
    const seo = inject(SeoService);
    effect(() => {
      const q = this.q();
      seo.set({ title: q ? `«${q}» — поиск на Хариде` : 'Поиск — Харид', description: 'Поиск по товарам Instagram-лавок Таджикистана', noindex: true, keepParams: ['q'] });
    });
    // Новый запрос или фильтры — результаты с начала; пустой запрос — без запроса
    effect(() => {
      const q = this.q();
      const filters = this.filters();
      untracked(() => this.feed.reset(q ? { ...filters, q } : null));
    });
  }
}
