import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { MarketApi } from '../../core/market-api.service';
import { SeoService } from '../../core/seo.service';
import { plural } from '../../shared/plural';
import { ProductCardComponent } from '../../shared/product-card.component';
import { FeedMoreComponent, ProductFeed } from '../../shared/product-feed';

@Component({
  selector: 'app-category',
  standalone: true,
  imports: [RouterLink, ProductCardComponent, FeedMoreComponent],
  template: `
    <div class="wrap page-top">
      <h1 class="page-title">{{ name() }}</h1>
      <!-- Общего числа сервер не отдаёт: пока лента не загружена до конца, число было бы неверным -->
      <p class="count muted">
        @if (feed.done()) { {{ products().length }} {{ plural(products().length, productForms) }} из Instagram-магазинов }
        @else { Товары из Instagram-магазинов }
      </p>
      <nav class="chips cats" aria-label="Категории">
        <a class="chip" routerLink="/">Всё</a>
        @for (c of categories(); track c.slug) {
          <a class="chip" [class.chip--on]="c.slug === slug()" [attr.aria-current]="c.slug === slug() ? 'page' : null" [routerLink]="['/c', c.slug]">{{ c.name }}</a>
        }
      </nav>
      <div class="list">
        @if (products().length) { <div class="products">@for (p of products(); track p.id) { <app-product-card [product]="p" /> }</div> }
        @else if (!feed.loading()) { <p class="muted">Пока пусто</p> }
        @if (!feed.done()) { <app-feed-more [feed]="feed" /> }
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
  readonly feed = new ProductFeed();
  readonly products = this.feed.items;
  readonly categories = toSignal(this.api.categories().pipe(catchError(() => of([]))), { initialValue: [] });
  readonly name = computed(() => this.categories().find((c) => c.slug === this.slug())?.name ?? 'Категория');
  constructor() {
    // Другая категория — лента с начала
    effect(() => {
      const slug = this.slug();
      untracked(() => this.feed.reset({ category: slug }));
    });
    effect(() => this.seo.set({ title: `${this.name()} — Харид`, description: `${this.name()} в Instagram-лавках Таджикистана` }));
  }
}
