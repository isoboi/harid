import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CategoryComponent } from './category.component';
import { MarketApi } from '../../core/market-api.service';
import { Product, ProductQuery } from '../../core/models';
import { FEED_PAGE_SIZE } from '../../shared/product-feed';

const page = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: String(from + i), title: `Товар ${from + i}`, price: 100, image: '', shop_handle: 'zebo.style' }) as unknown as Product);

describe('CategoryComponent: подгрузка ленты', () => {
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

  async function render(products: (q: ProductQuery) => ReturnType<MarketApi['products']>) {
    const spy = jest.fn(products);
    await TestBed.configureTestingModule({
      imports: [CategoryComponent],
      providers: [provideRouter([]), { provide: MarketApi, useValue: { products: spy, categories: () => of([{ slug: 'odezhda', name: 'Одежда' }]) } }],
    }).compileComponents();
    const f = TestBed.createComponent(CategoryComponent);
    f.componentRef.setInput('slug', 'odezhda');
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const scrollToEnd = () => {
      observers.at(-1)!.cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      f.detectChanges();
    };
    return { f, el, spy, scrollToEnd, cards: () => el.querySelectorAll('app-product-card').length };
  }

  it('догружает следующую страницу той же категории', async () => {
    const { spy, scrollToEnd, cards } = await render((q) => of(page(q.offset ?? 0, FEED_PAGE_SIZE)));
    expect(spy).toHaveBeenCalledWith({ category: 'odezhda', limit: FEED_PAGE_SIZE, offset: 0 });
    scrollToEnd();
    expect(spy).toHaveBeenLastCalledWith({ category: 'odezhda', limit: FEED_PAGE_SIZE, offset: FEED_PAGE_SIZE });
    expect(cards()).toBe(FEED_PAGE_SIZE * 2);
  });

  it('другая категория — лента с начала', async () => {
    const { f, spy, scrollToEnd, cards } = await render((q) => of(page(q.offset ?? 0, FEED_PAGE_SIZE)));
    scrollToEnd();
    f.componentRef.setInput('slug', 'gadgets');
    f.detectChanges();
    expect(spy).toHaveBeenLastCalledWith({ category: 'gadgets', limit: FEED_PAGE_SIZE, offset: 0 });
    expect(cards()).toBe(FEED_PAGE_SIZE);
  });

  it('число товаров — только когда лента загружена целиком', async () => {
    const full = await render((q) => of(page(q.offset ?? 0, FEED_PAGE_SIZE)));
    expect(full.el.querySelector('.count')?.textContent).not.toMatch(/\d/);
    TestBed.resetTestingModule();
    const short = await render(() => of(page(0, 5)));
    expect(short.el.querySelector('.count')?.textContent).toContain('5 товаров');
  });
});
