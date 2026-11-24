import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HomeComponent } from './home.component';
import { MarketApi } from '../../core/market-api.service';
import { RecentlyViewedService } from '../../core/recently-viewed.service';
import { Product, ProductQuery } from '../../core/models';
import { FEED_PAGE_SIZE as HOME_PAGE_SIZE } from '../../shared/product-feed';

const item = (id: number): Product => ({ id: String(id), title: `Товар ${id}`, price: 100, image: '', shop_handle: 'zebo.style' }) as unknown as Product;
const page = (from: number, count: number) => Array.from({ length: count }, (_, i) => item(from + i));

describe('HomeComponent: подгрузка ленты', () => {
  let observers: { cb: IntersectionObserverCallback; el?: Element }[];
  const original = (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;

  beforeEach(() => {
    observers = [];
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
      private rec: { cb: IntersectionObserverCallback; el?: Element };
      constructor(cb: IntersectionObserverCallback) { this.rec = { cb }; observers.push(this.rec); }
      observe(el: Element) { this.rec.el = el; }
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
      imports: [HomeComponent],
      providers: [provideRouter([]), { provide: MarketApi, useValue: { products: spy, shops: () => of([]), categories: () => of([]) } }],
    }).compileComponents();
    const f = TestBed.createComponent(HomeComponent);
    f.detectChanges();
    const scrollToEnd = () => {
      const rec = observers.at(-1)!;
      rec.cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      f.detectChanges();
    };
    const cards = () => (f.nativeElement as HTMLElement).querySelectorAll('app-product-card').length;
    return { f, spy, scrollToEnd, cards };
  }

  it('первая страница — с offset 0, следующая — когда низ ленты виден', async () => {
    const { spy, scrollToEnd, cards } = await render((q) => of(page(q.offset ?? 0, HOME_PAGE_SIZE)));
    expect(spy).toHaveBeenCalledWith({ limit: HOME_PAGE_SIZE, offset: 0 });
    expect(cards()).toBe(HOME_PAGE_SIZE);
    scrollToEnd();
    expect(spy).toHaveBeenLastCalledWith({ limit: HOME_PAGE_SIZE, offset: HOME_PAGE_SIZE });
    expect(cards()).toBe(HOME_PAGE_SIZE * 2);
  });

  it('неполная страница — конец ленты, больше не запрашиваем', async () => {
    const { f, spy, cards } = await render((q) => of(page(q.offset ?? 0, 5)));
    expect(cards()).toBe(5);
    // Низ ленты убран — наблюдать нечего, второго запроса не будет
    expect((f.nativeElement as HTMLElement).querySelector('.more')).toBeNull();
    expect(observers).toHaveLength(0);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('повтор товара на стыке страниц не дублирует карточку', async () => {
    const { scrollToEnd, cards } = await render((q) => of(page(q.offset ? q.offset - 1 : 0, HOME_PAGE_SIZE)));
    scrollToEnd();
    expect(cards()).toBe(HOME_PAGE_SIZE * 2 - 1);
  });

  it('сервер без offset отдаёт ту же страницу — лента заканчивается, а не крутится', async () => {
    const { f, spy, scrollToEnd, cards } = await render(() => of(page(0, HOME_PAGE_SIZE)));
    scrollToEnd();
    expect(cards()).toBe(HOME_PAGE_SIZE);
    expect((f.nativeElement as HTMLElement).querySelector('.more')).toBeNull();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('ошибка подгрузки — кнопка «Показать ещё» повторяет запрос', async () => {
    let fail = true;
    const { f, spy, scrollToEnd, cards } = await render((q) => {
      if (q.offset && fail) return throwError(() => new Error('x'));
      return of(page(q.offset ?? 0, HOME_PAGE_SIZE));
    });
    scrollToEnd();
    const retry = (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-test="more"]')!;
    expect(retry).not.toBeNull();
    fail = false;
    retry.click();
    f.detectChanges();
    expect(spy).toHaveBeenCalledTimes(3);
    expect(cards()).toBe(HOME_PAGE_SIZE * 2);
  });
});

describe('HomeComponent: «Вы смотрели»', () => {
  const original = (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
  beforeEach(() => {
    localStorage.clear();
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class { observe() {} disconnect() {} };
  });
  afterEach(() => {
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = original;
    TestBed.resetTestingModule();
  });

  async function render(withHistory: boolean, count = 3) {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([]), { provide: MarketApi, useValue: { products: () => of(page(1, count)), shops: () => of([]), categories: () => of([]) } }],
    }).compileComponents();
    if (withHistory) TestBed.inject(RecentlyViewedService).add({ ...item(77), title: 'Снимок 77' });
    const f = TestBed.createComponent(HomeComponent);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  const after = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  it('десктоп: «Вы смотрели» над «Новое в лавках»', async () => {
    const el = await render(true);
    const strip = el.querySelector('app-recent-strip.recent-d section');
    expect(strip?.textContent).toContain('Снимок 77');
    expect(after(strip!, el.querySelector('#fresh')!)).toBe(true);
  });
  it('телефон: полоса после первых 8 товаров ленты, ниже первого экрана', async () => {
    const el = await render(true, 12);
    const strip = el.querySelector('app-recent-strip.recent-m section')!;
    expect(strip?.textContent).toContain('Снимок 77');
    const cards = el.querySelectorAll('#fresh app-product-card');
    expect(cards).toHaveLength(12);
    expect(after(cards[7], strip)).toBe(true);
    expect(after(strip, cards[8])).toBe(true);
  });
  it('телефон: товаров меньше 8 — полоса после ленты', async () => {
    const el = await render(true, 3);
    const cards = el.querySelectorAll('#fresh app-product-card');
    expect(after(cards[2], el.querySelector('app-recent-strip.recent-m section')!)).toBe(true);
  });
  it('без истории полосы нет', async () => {
    const el = await render(false);
    expect(el.textContent).not.toContain('Вы смотрели');
  });
});
