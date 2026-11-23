import { Component, effect, untracked, inject, input } from '@angular/core';
import { SeoService } from '../../core/seo.service';
import { ProductCardComponent } from '../../shared/product-card.component';
import { FeedMoreComponent, ProductFeed } from '../../shared/product-feed';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [ProductCardComponent, FeedMoreComponent],
  template: `
    <div class="wrap page-top">
      @if (!q()) { <p class="muted">Введите запрос</p> }
      @else {
        <h1 class="page-title">Поиск: «{{ q() }}»</h1>
        <div class="list">
          @if (products().length) { <div class="products">@for (p of products(); track p.id) { <app-product-card [product]="p" /> }</div> }
          @else if (!feed.loading()) { <p class="muted">Ничего не нашлось</p> }
          @if (!feed.done()) { <app-feed-more [feed]="feed" /> }
        </div>
      }
    </div>
  `,
  styles: `.page-title { overflow-wrap: anywhere } .list { margin-top: 24px }`,
})
export class SearchComponent {
  /** Запрос уже без пробелов по краям; undefined из query приводится к пустой строке. */
  readonly q = input('', { transform: (v: string | undefined) => (v ?? '').trim() });
  /** Результаты поиска: догружаются при прокрутке. */
  readonly feed = new ProductFeed();
  readonly products = this.feed.items;
  constructor() {
    const seo = inject(SeoService);
    effect(() => {
      const q = this.q();
      seo.set({ title: q ? `«${q}» — поиск на Хариде` : 'Поиск — Харид', description: 'Поиск по товарам Instagram-лавок Таджикистана' });
      // Новый запрос — результаты с начала; пустой — без запроса
      untracked(() => this.feed.reset(q ? { q } : null));
    });
  }
}
