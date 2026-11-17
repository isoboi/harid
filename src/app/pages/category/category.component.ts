import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { MarketApi } from '../../core/market-api.service';
import { Product } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { ProductCardComponent } from '../../shared/product-card.component';

@Component({
  selector: 'app-category',
  standalone: true,
  imports: [ProductCardComponent],
  template: `
    <h1>{{ name() }}</h1>
    @if (products().length) { <div class="grid">@for (p of products(); track p.id) { <app-product-card [product]="p" /> }</div> }
    @else { <p class="muted">Пока пусто</p> }
  `,
  styles: `.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:16px }`,
})
export class CategoryComponent {
  private readonly api = inject(MarketApi);
  private readonly seo = inject(SeoService);
  readonly slug = input.required<string>();
  readonly products = signal<Product[]>([]);
  private readonly categories = toSignal(this.api.categories().pipe(catchError(() => of([]))), { initialValue: [] });
  readonly name = computed(() => this.categories().find((c) => c.slug === this.slug())?.name ?? 'Категория');
  constructor() {
    effect(() => {
      const slug = this.slug();
      this.api.products({ category: slug }).pipe(catchError(() => of([]))).subscribe((p) => this.products.set(p));
    });
    effect(() => this.seo.set({ title: `${this.name()} — Харид`, description: `${this.name()} в Instagram-лавках Душанбе` }));
  }
}
