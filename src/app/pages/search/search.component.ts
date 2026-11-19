import { Component, effect, untracked, inject, input, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { MarketApi } from '../../core/market-api.service';
import { Product } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { ProductCardComponent } from '../../shared/product-card.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [ProductCardComponent],
  template: `
    <div class="wrap page-top">
      @if (!q()) { <p class="muted">Введите запрос</p> }
      @else {
        <h1 class="page-title">Поиск: «{{ q() }}»</h1>
        <div class="list">
          @if (products().length) { <div class="products">@for (p of products(); track p.id) { <app-product-card [product]="p" /> }</div> }
          @else { <p class="muted">Ничего не нашлось</p> }
        </div>
      }
    </div>
  `,
  styles: `.page-title { overflow-wrap: anywhere } .list { margin-top: 24px }`,
})
export class SearchComponent {
  private readonly api = inject(MarketApi);
  /** Запрос уже без пробелов по краям; undefined из query приводится к пустой строке. */
  readonly q = input('', { transform: (v: string | undefined) => (v ?? '').trim() });
  readonly products = signal<Product[]>([]);
  constructor() {
    const seo = inject(SeoService);
    effect((onCleanup) => {
      const q = this.q();
      seo.set({ title: q ? `«${q}» — поиск на Хариде` : 'Поиск — Харид', description: 'Поиск по товарам Instagram-лавок Таджикистана' });
      if (!q) return this.products.set([]);
      const sub = untracked(() => this.api.products({ q }).pipe(catchError(() => of([]))).subscribe((p) => this.products.set(p)));
      onCleanup(() => sub.unsubscribe());
    });
  }
}
