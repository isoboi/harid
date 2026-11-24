import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SearchComponent } from './search.component';
import { MarketApi } from '../../core/market-api.service';
import { Product, ProductQuery } from '../../core/models';
import { FEED_PAGE_SIZE } from '../../shared/product-feed';

const page = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: String(from + i), title: `Товар ${from + i}`, price: 100, image: '', shop_handle: 'zebo.style' }) as unknown as Product);

describe('SearchComponent: подгрузка результатов', () => {
  let observers: { cb: IntersectionObserverCallback }[];
  const original = (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;

  beforeEach(() => {
    observers = [];
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
      constructor(cb: IntersectionObserverCallback) { observers.push({ cb }); }
      observe() {}
      disconnect() {}
    };
  });
  afterEach(() => {
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = original;
    TestBed.resetTestingModule();
  });

  async function render(q: string, products: (q: ProductQuery) => ReturnType<MarketApi['products']>) {
    const spy = jest.fn(products);
    await TestBed.configureTestingModule({ imports: [SearchComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { products: spy, productFacets: () => of({ sizes: [], price_min: null, price_max: null }) } }] }).compileComponents();
    const f = TestBed.createComponent(SearchComponent);
    f.componentRef.setInput('q', q);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const scrollToEnd = () => {
      observers.at(-1)!.cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      f.detectChanges();
    };
    return { f, el, spy, scrollToEnd, cards: () => el.querySelectorAll('app-product-card').length };
  }

  it('догружает следующую страницу результатов того же запроса', async () => {
    const { spy, scrollToEnd, cards } = await render('  платье ', (q) => of(page(q.offset ?? 0, FEED_PAGE_SIZE)));
    expect(spy).toHaveBeenCalledWith({ q: 'платье', limit: FEED_PAGE_SIZE, offset: 0 });
    scrollToEnd();
    expect(spy).toHaveBeenLastCalledWith({ q: 'платье', limit: FEED_PAGE_SIZE, offset: FEED_PAGE_SIZE });
    expect(cards()).toBe(FEED_PAGE_SIZE * 2);
  });

  it('пустой запрос — ничего не запрашиваем', async () => {
    const { el, spy } = await render('', () => of(page(0, 1)));
    expect(spy).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Введите запрос');
    expect(el.querySelector('app-feed-more')).toBeNull();
  });

  it('ничего не нашлось — сообщение, без подгрузки', async () => {
    const { el } = await render('xyz', () => of([]));
    expect(el.textContent).toContain('Ничего не нашлось');
    expect(el.querySelector('app-feed-more')).toBeNull();
  });
});
