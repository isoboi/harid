import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { CartService } from '../../core/cart.service';
import { FavoritesService } from '../../core/favorites.service';
import { MarketApi } from '../../core/market-api.service';
import { Product } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { IconComponent } from '../../shared/icon.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { ProductCardComponent } from '../../shared/product-card.component';
import { NotFoundComponent } from '../not-found/not-found.component';

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [RouterLink, MoneyPipe, ProductCardComponent, NotFoundComponent, IconComponent],
  template: `
    @if (missing()) { <app-not-found /> }
    @else if (failed()) { <p class="muted">Не удалось загрузить. Попробуйте обновить страницу.</p> }
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
          <div class="cash" data-test="cash-promise"><app-icon name="banknote" [size]="20" /><span>Оплата наличными курьеру · без предоплаты · проверяете товар при курьере</span></div>
          <div class="actions">
            <button type="button" class="btn" data-test="add" [disabled]="!canAdd()" (click)="add(p)">{{ addLabel() }}</button>
            <button type="button" class="btn btn--ghost" (click)="fav.toggle(p.id)">{{ fav.has(p.id) ? 'В избранном' : 'В избранное' }}</button>
          </div>
          @if (limitError()) { <p class="error" data-test="limit">В корзине уже 30 позиций — оформите заказ или уберите лишнее</p> }
          <!-- Подпись из Instagram — сырой текст лавки: свёрнута, чтобы не теснить цену и кнопку. Телефоны из неё вычищает бэкенд -->
          @if (p.description.trim()) {
            <details class="desc"><summary>Описание из Instagram</summary><p>{{ p.description }}</p></details>
          }
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
    .actions { display:flex; gap:12px; margin:16px 0 }
    .desc { margin-top:8px; border-top:1px solid var(--line) }
    /* summary остаётся list-item, чтобы браузер рисовал треугольник раскрытия; 12px сверху и снизу — цель ≥44px */
    .desc summary { padding:12px 0; cursor:pointer; font-weight:600; line-height:20px }
    .desc summary:focus-visible { outline:2px solid var(--text); outline-offset:2px; border-radius:6px }
    .desc p { margin:0 0 12px; white-space:pre-line; line-height:1.5; max-width:65ch; overflow-wrap:anywhere }
    /* Обещание оплаты у цены: поверхность и акцентная купюра — единственный акцент на странице */
    .cash { display:flex; gap:10px; align-items:flex-start; margin-top:16px; padding:12px 14px; border-radius:12px; background:var(--surface); font-size:14px; line-height:1.4 } .cash app-icon { color:var(--accent-strong); margin-top:-1px }
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
  /** Корзина упёрлась в лимит строк бэкенда. */
  readonly limitError = signal(false);
  readonly photos = computed(() => { const p = this.product(); return p ? (p.images?.length ? p.images : p.image ? [p.image] : []) : []; });
  readonly current = computed(() => this.photos()[this.photo()] ?? '');
  readonly canAdd = computed(() => { const p = this.product(); return !!p && p.in_stock && (p.sizes.length <= 1 || !!this.size()); });
  readonly addLabel = computed(() => (!this.product()?.in_stock ? 'Нет в наличии' : this.added() ? 'Добавлено в корзину' : 'В корзину'));

  readonly failed = signal(false);
  private readonly money = new MoneyPipe();

  constructor() {
    effect((onCleanup) => {
      const id = this.id();
      this.missing.set(false); this.failed.set(false); this.photo.set(0); this.size.set(null); this.added.set(false); this.limitError.set(false);
      this.product.set(null); this.more.set([]);
      let nested: { unsubscribe(): void } | null = null;
      const sub = untracked(() => this.api.product(id).subscribe({
        next: (p) => {
          this.product.set(p);
          if (p.sizes.length === 1) this.size.set(p.sizes[0]);
          this.seo.set({ title: `${p.title} — ${this.money.transform(p.price)} · Харид`, description: `@${p.shop_handle} · ${p.description.slice(0, 140)}`, image: this.photos()[0] || undefined });
          nested = this.api.products({ shop: p.shop_handle, limit: 9 }).pipe(catchError(() => of([]))).subscribe((list) => this.more.set(list.filter((x) => x.id !== p.id).slice(0, 8)));
        },
        // 400 — нечисловой id отклонён валидацией бэкенда: для покупателя это тоже «нет такого товара»
        error: (e) => { if (e instanceof HttpErrorResponse && (e.status === 404 || e.status === 400)) this.missing.set(true); else this.failed.set(true); },
      }));
      onCleanup(() => { sub.unsubscribe(); nested?.unsubscribe(); });
    });
  }

  add(p: Product): void {
    if (!this.canAdd()) return;
    const ok = this.cart.add(p, p.sizes.length ? this.size() : null);
    this.limitError.set(!ok);
    this.added.set(ok);
  }
}
