import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, ElementRef, PLATFORM_ID, inject, input, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { MarketApi } from '../core/market-api.service';
import { Product, ProductQuery } from '../core/models';

/** Размер страницы ленты товаров. */
export const FEED_PAGE_SIZE = 24;

/**
 * Лента товаров по страницам: offset = сколько уже загружено.
 * Создаётся в контексте внедрения (поле компонента) — запрос отменяется вместе с компонентом.
 */
export class ProductFeed {
  private readonly api = inject(MarketApi);
  private query: ProductQuery | null = null;
  private sub?: Subscription;
  readonly items = signal<Product[]>([]);
  readonly loading = signal(false);
  readonly failed = signal(false);
  /** Сервер вернул неполную страницу (или запроса нет) — догружать нечего. */
  readonly done = signal(true);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.sub?.unsubscribe());
  }

  /** Новый запрос — лента с начала; null — пустая лента без запроса. */
  reset(query: ProductQuery | null): void {
    this.sub?.unsubscribe();
    this.query = query;
    this.items.set([]);
    this.loading.set(false);
    this.failed.set(false);
    this.done.set(query === null);
    this.more();
  }

  /** Следующая страница. Повторы на стыке страниц (новый товар сдвинул offset) отбрасываются. */
  more(): void {
    const query = this.query;
    if (!query || this.loading() || this.done()) return;
    this.loading.set(true);
    this.failed.set(false);
    this.sub = this.api.products({ ...query, limit: FEED_PAGE_SIZE, offset: this.items().length }).subscribe({
      next: (page) => {
        const seen = new Set(this.items().map((p) => p.id));
        const fresh = page.filter((p) => !seen.has(p.id));
        this.items.update((list) => [...list, ...fresh]);
        // Ни одного нового товара — сервер не понял offset; иначе лента запрашивала бы одно и то же
        if (page.length < FEED_PAGE_SIZE || !fresh.length) this.done.set(true);
        this.loading.set(false);
      },
      error: () => { this.failed.set(true); this.loading.set(false); },
    });
  }
}

/**
 * Низ ленты: когда он ближе 600px к экрану, просит следующую страницу.
 * После ошибки сам не повторяет — показывает кнопку «Показать ещё».
 */
@Component({
  selector: 'app-feed-more',
  standalone: true,
  host: { class: 'more' },
  template: `
    @if (feed().failed()) { <button type="button" class="btn btn--ghost" data-test="more" (click)="feed().more()">Показать ещё</button> }
    @else if (feed().loading() && feed().items().length) { <span class="muted">Загружаем…</span> }
  `,
  styles: `:host { display: flex; justify-content: center; min-height: 1px; margin-top: 24px }`,
})
export class FeedMoreComponent {
  readonly feed = input.required<ProductFeed>();
  constructor() {
    const el = inject(ElementRef<HTMLElement>).nativeElement;
    if (!isPlatformBrowser(inject(PLATFORM_ID)) || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !this.feed().failed()) this.feed().more(); }, { rootMargin: '600px 0px' });
    io.observe(el);
    inject(DestroyRef).onDestroy(() => io.disconnect());
  }
}
