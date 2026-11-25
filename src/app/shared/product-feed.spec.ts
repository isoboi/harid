import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { MarketApi } from '../core/market-api.service';
import { Product, ProductQuery } from '../core/models';
import { ToastService } from '../core/toast.service';
import { FEED_PAGE_SIZE, ProductFeed } from './product-feed';

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
