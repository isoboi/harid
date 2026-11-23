import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { MarketApi } from '../../core/market-api.service';
import { CatalogFeed } from '../../core/catalog-feed.service';
import { curate, visibleCategories } from '../../core/feed';
import { Product } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { plural } from '../../shared/plural';
import { ProductCardComponent } from '../../shared/product-card.component';

@Component({
  selector: 'app-category',
  standalone: true,
  imports: [RouterLink, ProductCardComponent],
  template: `
    <div class="wrap page-top">
      <h1 class="page-title">{{ name() }}</h1>
      <p class="count muted">{{ shown().length }} {{ plural(shown().length, productForms) }} из Instagram-магазинов</p>
      <nav class="chips cats" aria-label="Категории">
        <a class="chip" routerLink="/">Всё</a>
        @for (c of categories(); track c.slug) {
          <a class="chip" [class.chip--on]="c.slug === slug()" [attr.aria-current]="c.slug === slug() ? 'page' : null" [routerLink]="['/c', c.slug]">{{ c.name }}</a>
        }
      </nav>
      <div class="list">
        @if (shown().length) { <div class="products">@for (p of shown(); track p.id) { <app-product-card [product]="p" /> }</div> }
        @else { <p class="muted">Пока пусто</p> }
      </div>
    </div>
  `,
  styles: `
    .count { margin-top: 4px }
    .cats { margin-top: 24px }
    .list { margin-top: 24px }
  `,
})
export class CategoryComponent {
  private readonly api = inject(MarketApi);
  private readonly seo = inject(SeoService);
  readonly plural = plural;
  readonly productForms: [string, string, string] = ['товар', 'товара', 'товаров'];
  readonly slug = input.required<string>();
  readonly products = signal<Product[]>([]);
  private readonly allCategories = toSignal(this.api.categories().pipe(catchError(() => of([]))), { initialValue: [] });
  /** Свежие товары: undefined — грузятся, null — не загрузились. */
  private readonly latest = toSignal(inject(CatalogFeed).products(), { initialValue: undefined });
  /** Чипы — только категории с товарами (текущая остаётся всегда); пока лента грузится — без чипов. */
  readonly categories = computed(() => { const l = this.latest(); return l === undefined ? [] : visibleCategories(this.allCategories(), l, this.slug()); });
  /** Товары категории: без поломанных названий, сначала доступные для заказа. */
  readonly shown = computed(() => curate(this.products()));
  readonly name = computed(() => this.categories().find((c) => c.slug === this.slug())?.name ?? 'Категория');
  constructor() {
    effect((onCleanup) => {
      const slug = this.slug();
      this.products.set([]);
      const sub = untracked(() => this.api.products({ category: slug }).pipe(catchError(() => of([]))).subscribe((p) => this.products.set(p)));
      onCleanup(() => sub.unsubscribe());
    });
    effect(() => this.seo.set({ title: `${this.name()} — Харид`, description: `${this.name()} в Instagram-лавках Таджикистана` }));
  }
}
