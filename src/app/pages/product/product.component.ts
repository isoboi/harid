import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { CartService } from '../../core/cart.service';
import { FavoritesService } from '../../core/favorites.service';
import { MarketApi } from '../../core/market-api.service';
import { Product } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { MoneyPipe } from '../../shared/money.pipe';
import { ProductCardComponent } from '../../shared/product-card.component';
import { NotFoundComponent } from '../not-found/not-found.component';

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [RouterLink, MoneyPipe, ProductCardComponent, NotFoundComponent],
  template: `
    @if (missing()) { <app-not-found /> }
    @else { @if (product(); as p) {
      <div class="wrap">
        <div class="gallery">
          <div class="main">@if (current()) { <img [src]="current()" [alt]="p.title" /> } @else { <span class="muted">Нет фото</span> }</div>
          @if (photos().length > 1) {
            <div class="thumbs">@for (src of photos(); track src; let i = $index) {
              <button type="button" data-test="thumb" [class.on]="i === photo()" (click)="photo.set(i)"><img [src]="src" alt="" /></button>
            }</div>
          }
        </div>
        <div class="info">
          <a class="muted" [routerLink]="['/shop', p.shop_handle]">&#64;{{ p.shop_handle }}</a>
          <h1>{{ p.title }}</h1>
          <div class="price"><b>{{ p.price | money }}</b>@if (p.old_price) { <s>{{ p.old_price | money }}</s> }</div>
          @if (p.sizes.length > 1) {
            <div class="sizes">@for (s of p.sizes; track s) {
              <button type="button" data-test="size" class="size" [class.on]="size() === s" (click)="size.set(s)">{{ s }}</button>
            }</div>
          }
          <div class="actions">
            <button type="button" class="btn" data-test="add" [disabled]="!canAdd()" (click)="add(p)">{{ addLabel() }}</button>
            <button type="button" class="btn btn--ghost" (click)="fav.toggle(p.id)">{{ fav.has(p.id) ? 'В избранном' : 'В избранное' }}</button>
          </div>
          <p class="muted small">Оплата наличными курьеру. Проверяете заказ при курьере.</p>
          <p class="desc">{{ p.description }}</p>
        </div>
      </div>
      @if (more().length) { <h2>Ещё в лавке</h2><div class="grid">@for (m of more(); track m.id) { <app-product-card [product]="m" /> }</div> }
    }
    }
  `,
  styles: `
    .wrap { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:32px } @media (max-width:760px){ .wrap { grid-template-columns:1fr } }
    .main { aspect-ratio:1; border-radius:var(--radius); overflow:hidden; background:var(--surface); display:grid; place-items:center } .main img { width:100%; height:100%; object-fit:cover }
    .thumbs { display:flex; gap:8px; margin-top:8px; overflow-x:auto } .thumbs button { padding:0; border:2px solid transparent; border-radius:10px; overflow:hidden; width:64px; height:64px; background:none } .thumbs button.on { border-color:var(--text) } .thumbs img { width:100%; height:100%; object-fit:cover }
    .price { display:flex; gap:10px; align-items:baseline; font-size:24px } .price s { font-size:16px; color:var(--muted) }
    .sizes { display:flex; gap:8px; flex-wrap:wrap; margin:16px 0 } .size { padding:8px 14px; border:1px solid var(--line); border-radius:999px; background:none } .size.on { background:var(--text); color:#fff }
    .actions { display:flex; gap:12px; margin:16px 0 } .desc { white-space:pre-line } .small { font-size:13px }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:16px }
  `,
})
export class ProductComponent {
  private readonly api = inject(MarketApi);
  private readonly cart = inject(CartService);
  private readonly seo = inject(SeoService);
  readonly fav = inject(FavoritesService);
  readonly id = input.required<string>();
  readonly product = signal<Product | null>(null);
  readonly more = signal<Product[]>([]);
  readonly missing = signal(false);
  readonly photo = signal(0);
  readonly size = signal<string | null>(null);
  readonly added = signal(false);
  readonly photos = computed(() => { const p = this.product(); return p ? (p.images?.length ? p.images : p.image ? [p.image] : []) : []; });
  readonly current = computed(() => this.photos()[this.photo()] ?? '');
  readonly canAdd = computed(() => { const p = this.product(); return !!p && p.in_stock && (p.sizes.length <= 1 || !!this.size()); });
  readonly addLabel = computed(() => (!this.product()?.in_stock ? 'Нет в наличии' : this.added() ? 'Добавлено в корзину' : 'В корзину'));

  constructor() {
    effect(() => {
      const id = this.id();
      this.missing.set(false); this.photo.set(0); this.size.set(null); this.added.set(false);
      this.api.product(id).subscribe({
        next: (p) => {
          this.product.set(p);
          if (p.sizes.length === 1) this.size.set(p.sizes[0]);
          this.seo.set({ title: `${p.title} — ${p.price} смн · Харид`, description: `@${p.shop_handle} · ${p.description.slice(0, 140)}`, image: p.image || undefined });
          this.api.products({ shop: p.shop_handle, limit: 9 }).pipe(catchError(() => of([]))).subscribe((list) => this.more.set(list.filter((x) => x.id !== p.id).slice(0, 8)));
        },
        error: () => this.missing.set(true),
      });
    });
  }

  add(p: Product): void {
    if (!this.canAdd()) return;
    this.cart.add(p, p.sizes.length ? this.size() : null);
    this.added.set(true);
  }
}
