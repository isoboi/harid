import { Component, effect, inject, input, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { MarketApi } from '../../core/market-api.service';
import { Product, Shop } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { ProductCardComponent } from '../../shared/product-card.component';
import { NotFoundComponent } from '../not-found/not-found.component';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [ProductCardComponent, NotFoundComponent],
  template: `
    @if (missing()) { <app-not-found /> }
    @else { @if (shop(); as s) {
      <header class="head">
        <span class="ava" [style.background]="s.avatar_color">{{ s.handle.charAt(0).toUpperCase() }}</span>
        <div><h1>&#64;{{ s.handle }}</h1><p class="muted">{{ s.bio }}</p>
          <p class="muted small">@if (s.district) { {{ s.district }} · } Доставлено заказов: {{ s.delivered_orders }}</p></div>
      </header>
      @if (products().length) { <div class="grid">@for (p of products(); track p.id) { <app-product-card [product]="p" /> }</div> }
      @else { <p class="muted">Пока пусто</p> }
    }
    }
  `,
  styles: `
    .head { display:flex; gap:16px; align-items:center; margin:16px 0 24px } .head h1 { margin:0 }
    .ava { width:72px; height:72px; border-radius:50%; display:grid; place-items:center; color:#fff; font-size:28px; font-weight:700 }
    .small { font-size:13px } .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:16px }
  `,
})
export class ShopComponent {
  private readonly api = inject(MarketApi);
  private readonly seo = inject(SeoService);
  readonly handle = input.required<string>();
  readonly shop = signal<Shop | null>(null);
  readonly products = signal<Product[]>([]);
  readonly missing = signal(false);
  constructor() {
    effect(() => {
      const h = this.handle();
      this.missing.set(false);
      this.api.shop(h).subscribe({
        next: (s) => { this.shop.set(s); this.seo.set({ title: `@${s.handle} — Харид`, description: s.bio || `Лавка @${s.handle} на Хариде` }); },
        error: () => this.missing.set(true),
      });
      this.api.products({ shop: h }).pipe(catchError(() => of([]))).subscribe((p) => this.products.set(p));
    });
  }
}
