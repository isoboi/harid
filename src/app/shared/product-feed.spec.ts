import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { MarketApi } from '../core/market-api.service';
import { Product, ProductQuery } from '../core/models';
import { ToastService } from '../core/toast.service';
import { FEED_PAGE_SIZE, FeedMoreComponent, ProductFeed } from './product-feed';

const prod = (id: number): Product => ({ id: String(id), shop_handle: 's', title: `Товар ${id}`, price: 10, old_price: null, image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '' });
const page = (from: number, n: number) => Array.from({ length: n }, (_, i) => prod(from + i));

function setup(respond: (q: ProductQuery) => Observable<Product[]>) {
  const products = jest.fn(respond);
  TestBed.configureTestingModule({ providers: [{ provide: MarketApi, useValue: { products } }] });
  const feed = TestBed.runInInjectionContext(() => new ProductFeed());
  return { feed, products };
}

describe('ProductFeed.refresh', () => {
  it('первая страница заменяет список целиком, подгруженные страницы пропадают', () => {
    let version = 1;
    const { feed, products } = setup((q) => of(page(version * 1000 + (q.offset ?? 0), FEED_PAGE_SIZE)));
    feed.reset({});
    feed.more();
    expect(feed.items()).toHaveLength(FEED_PAGE_SIZE * 2);
    version = 2;
    feed.refresh();
    expect(products).toHaveBeenLastCalledWith({ limit: FEED_PAGE_SIZE, offset: 0 });
    expect(feed.items()).toHaveLength(FEED_PAGE_SIZE);
    expect(feed.items()[0].id).toBe('2000');
    expect(feed.refreshing()).toBe(false);
  });

  it('пока ответа нет, прежние карточки на месте и идёт refreshing', () => {
    const pending = new Subject<Product[]>();
    let first = true;
    const { feed } = setup(() => { if (first) { first = false; return of(page(1, FEED_PAGE_SIZE)); } return pending; });
    feed.reset({ category: 'shoes' });
    feed.refresh();
    expect(feed.refreshing()).toBe(true);
    expect(feed.items()).toHaveLength(FEED_PAGE_SIZE);
    pending.next(page(500, 3));
    expect(feed.items().map((p) => p.id)).toEqual(['500', '501', '502']);
    expect(feed.refreshing()).toBe(false);
    expect(feed.done()).toBe(true); // страница неполная — догружать нечего
  });

  it('запрос тот же, что у ленты: категория и фильтры сохраняются', () => {
    const { feed, products } = setup(() => of([]));
    feed.reset({ category: 'shoes', q: 'ботинки' });
    feed.refresh();
    expect(products).toHaveBeenLastCalledWith({ category: 'shoes', q: 'ботинки', limit: FEED_PAGE_SIZE, offset: 0 });
  });

  it('ошибка сети: прежняя лента остаётся, refreshing снимается', () => {
    let fail = false;
    const { feed } = setup(() => (fail ? throwError(() => new Error('offline')) : of(page(1, FEED_PAGE_SIZE))));
    feed.reset({});
    fail = true;
    feed.refresh();
    expect(feed.items()).toHaveLength(FEED_PAGE_SIZE);
    expect(feed.refreshing()).toBe(false);
    expect(feed.failed()).toBe(false);
    // Без плашки старая лента выглядела бы обновлённой
    expect(TestBed.inject(ToastService).current()).toMatchObject({ kind: 'error', text: 'Не удалось обновить — проверьте интернет' });
  });

  it('повторный вызов во время обновления игнорируется', () => {
    const pending = new Subject<Product[]>();
    let first = true;
    const { feed, products } = setup(() => { if (first) { first = false; return of(page(1, FEED_PAGE_SIZE)); } return pending; });
    feed.reset({});
    feed.refresh();
    feed.refresh();
    expect(products).toHaveBeenCalledTimes(2); // reset + одно обновление
  });

  it('ленты без запроса нет — обновлять нечего', () => {
    const { feed, products } = setup(() => of([]));
    feed.reset(null);
    feed.refresh();
    expect(products).not.toHaveBeenCalled();
    expect(feed.refreshing()).toBe(false);
  });

  it('обновление отменяет идущую подгрузку: список один, без дублей', () => {
    const slow = new Subject<Product[]>();
    let calls = 0;
    const { feed } = setup(() => { calls++; if (calls === 1) return of(page(1, FEED_PAGE_SIZE)); if (calls === 2) return slow; return of(page(100, FEED_PAGE_SIZE)); });
    feed.reset({});
    feed.more();               // подгрузка зависла
    expect(feed.loading()).toBe(true);
    feed.refresh();
    expect(feed.loading()).toBe(false);
    slow.next(page(900, FEED_PAGE_SIZE)); // поздний ответ старой подгрузки — отброшен
    expect(feed.items()[0].id).toBe('100');
    expect(feed.items()).toHaveLength(FEED_PAGE_SIZE);
  });

  it('новый reset снимает refreshing', () => {
    const pending = new Subject<Product[]>();
    let first = true;
    const { feed } = setup(() => { if (first) { first = false; return of(page(1, FEED_PAGE_SIZE)); } return pending; });
    feed.reset({});
    feed.refresh();
    expect(feed.refreshing()).toBe(true);
    feed.reset({ category: 'x' });
    expect(feed.refreshing()).toBe(false);
  });
});

describe('FeedMoreComponent: низ ленты', () => {
  /**
   * Мок как в браузере: на observe() наблюдатель присылает текущее состояние элемента,
   * дальше — только при смене видимости. Уведомления копятся и доставляются по flush().
   */
  let visible: boolean;
  let pending: (() => void)[];
  const original = (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;

  @Component({ standalone: true, imports: [FeedMoreComponent], template: `<app-feed-more [feed]="feed" />` })
  class HostComponent { readonly feed = new ProductFeed(); }

  beforeEach(() => {
    visible = true;
    pending = [];
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
      constructor(private readonly cb: IntersectionObserverCallback) {}
      observe() { pending.push(() => this.cb([{ isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver)); }
      disconnect() { pending = []; }
    };
  });
  afterEach(() => {
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = original;
    TestBed.resetTestingModule();
  });

  /** Лента на сервере: 24 + 24 + 2 товара. */
  function render(respond: (q: ProductQuery) => Observable<Product[]> = (q) => of(page(q.offset ?? 0, Math.max(0, Math.min(FEED_PAGE_SIZE, 50 - (q.offset ?? 0)))))) {
    const products = jest.fn(respond);
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [{ provide: MarketApi, useValue: { products } }] });
    const f = TestBed.createComponent(HostComponent);
    const feed = f.componentInstance.feed;
    feed.reset({});
    /** Отрисовка и доставка уведомлений наблюдателя, пока они есть. */
    const settle = () => {
      for (let i = 0; i < 20; i++) {
        f.detectChanges();
        const batch = pending; pending = [];
        if (!batch.length) return;
        batch.forEach((deliver) => deliver());
      }
      throw new Error('лента грузится без конца');
    };
    return { f, feed, products, settle };
  }

  it('низ ленты так и остался у экрана после страницы — догружает следующие, пока лента не кончится', () => {
    const { feed, products, settle } = render();
    settle();
    expect(products.mock.calls.map(([q]) => q.offset)).toEqual([0, 24, 48]);
    expect(feed.items()).toHaveLength(50);
    expect(feed.done()).toBe(true);
  });

  it('низ ленты ушёл с экрана — следующая страница не грузится, пока к нему не прокрутят', () => {
    const { feed, products, settle } = render();
    visible = false;
    settle();
    expect(products).toHaveBeenCalledTimes(1);
    expect(feed.items()).toHaveLength(FEED_PAGE_SIZE);
  });

  it('после ошибки сама не повторяет: остаётся кнопка «Показать ещё»', () => {
    let calls = 0;
    const { f, products, settle } = render((q) => (++calls === 2 ? throwError(() => new Error('offline')) : of(page(q.offset ?? 0, FEED_PAGE_SIZE))));
    settle();
    expect(products).toHaveBeenCalledTimes(2);
    expect((f.nativeElement as HTMLElement).querySelector('[data-test=more]')?.textContent).toContain('Показать ещё');
  });
});
