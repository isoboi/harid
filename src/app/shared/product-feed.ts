import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, PLATFORM_ID, effect, inject, input, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { I18n, TPipe } from '../core/i18n';
import { MarketApi } from '../core/market-api.service';
import { ToastService } from '../core/toast.service';
import { Product, ProductQuery } from '../core/models';

/** Размер страницы ленты товаров. */
export const FEED_PAGE_SIZE = 24;

/**
 * Лента товаров по страницам: offset = сколько уже загружено.
 * Создаётся в контексте внедрения (поле компонента) — запрос отменяется вместе с компонентом.
 */
export class ProductFeed {
  private readonly api = inject(MarketApi);
  private readonly toasts = inject(ToastService);
  private readonly i18n = inject(I18n);
  private query: ProductQuery | null = null;
  private sub?: Subscription;
  readonly items = signal<Product[]>([]);
  readonly loading = signal(false);
  readonly failed = signal(false);
  /** Сервер вернул неполную страницу (или запроса нет) — догружать нечего. */
  readonly done = signal(true);
  /** Идёт обновление жестом «потянуть вниз»: прежние карточки остаются, пока не придёт свежая первая страница. */
  readonly refreshing = signal(false);

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
    this.refreshing.set(false);
    this.done.set(query === null);
    this.more();
  }

  /**
   * Обновить ленту, не очищая её: первая страница по тому же запросу заменяет список, когда придёт.
   * Подгрузка, что шла в этот момент, отменяется (список всё равно заменяется). Ошибка сети —
   * прежняя лента остаётся как есть. Повторный вызов во время обновления игнорируется.
   */
  refresh(): void {
    const query = this.query;
    if (!query || this.refreshing()) return;
    this.sub?.unsubscribe();
    this.loading.set(false);
    this.failed.set(false);
    this.refreshing.set(true);
    this.sub = this.api.products({ ...query, limit: FEED_PAGE_SIZE, offset: 0 }).subscribe({
      next: (page) => {
        this.items.set(page);
        this.done.set(page.length < FEED_PAGE_SIZE);
        this.refreshing.set(false);
      },
      error: () => {
        this.refreshing.set(false);
        // Без сообщения индикатор просто пропадал, и старая лента выглядела обновлённой
        this.toasts.error(this.i18n.t('Не удалось обновить — проверьте интернет'));
      },
    });
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
 *
 * IntersectionObserver сообщает только о смене видимости. Если страница пришла, а низ ленты так и
 * остался у экрана (высокий экран, мало карточек; или прокрутили под ленту — тогда Chrome по scroll
 * anchoring держит на месте блок под ней), нового события не будет и лента замрёт. Поэтому после
 * каждой страницы наблюдение перезапускается: на observe() браузер сразу присылает текущее состояние.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-feed-more',
  standalone: true,
  imports: [TPipe],
  host: { class: 'more' },
  template: `
    @if (feed().failed()) { <button type="button" class="btn btn--ghost" data-test="more" (click)="feed().more()">{{ 'Показать ещё' | t }}</button> }
    @else if (feed().loading() && feed().items().length) { <span class="muted">{{ 'Загружаем…' | t }}</span> }
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
    // Пришла страница (новый массив items), лента не кончилась — спросить заново, виден ли низ ленты.
    // Лишний перезапуск безопасен: more() во время загрузки ничего не делает.
    effect(() => {
      const f = this.feed();
      f.items();
      if (f.loading() || f.done() || f.failed()) return;
      untracked(() => { io.disconnect(); io.observe(el); });
    });
    inject(DestroyRef).onDestroy(() => io.disconnect());
  }
}
