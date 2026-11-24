import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { ShopComponent } from './shop.component';
import { MarketApi } from '../../core/market-api.service';
import { Product, Review, Shop } from '../../core/models';
import { FEED_PAGE_SIZE } from '../../shared/product-feed';

const SHOP = (over: Partial<Shop> = {}): Shop => ({
  handle: 'zebo.style', name: 'Зебо', bio: '', followers: 0, district: null, rating: 4.7, reviews_count: 3, delivered_orders: 412,
  joined_at: '2026-03-02T00:00:00Z', avatar_color: '#000', has_fresh: false, ...over,
});
const REVIEW: Review = { id: 1, product_id: '16', product_title: 'Платье макси', shop_handle: 'zebo.style', author: 'Мехрона', rating: 5, text: 'Тёплый', created_at: '2026-10-19T09:00:00Z' };
const goods = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i + 1), title: `Товар ${i + 1}`, price: 100, image: '', shop_handle: 'zebo.style' }) as unknown as Product);

async function render(shop: Shop, reviews: Review[], opts: { products?: Product[]; query?: Record<string, string> } = {}) {
  const api = {
    shop: jest.fn(() => of(shop)), products: jest.fn(() => of(opts.products ?? [])), reviews: jest.fn(() => of(reviews)),
    reviewSummary: jest.fn(() => of(null)), reviewable: jest.fn(() => of([])), productFacets: jest.fn(() => of({ sizes: [], price_min: null, price_max: null })),
  };
  await TestBed.configureTestingModule({ imports: [ShopComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
  const router = TestBed.inject(Router);
  if (opts.query) await router.navigate([], { queryParams: opts.query });
  const f = TestBed.createComponent(ShopComponent);
  f.componentRef.setInput('handle', shop.handle);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const q = (t: string) => el.querySelector<HTMLElement>(`[data-test="${t}"]`);
  /** Нажатие, затем дожидаемся навигации и перерисовки. */
  const click = async (t: string) => { q(t)!.click(); await f.whenStable(); f.detectChanges(); };
  return { f, el, q, click, api, router };
}

describe('ShopComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('лавка не найдена или не загрузилась — свой заголовок вкладки, а не прошлой страницы', async () => {
    const { f, api } = await render(SHOP(), []);
    const title = TestBed.inject(Title);
    title.setTitle('Платье — Харид');
    api.shop.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    f.componentRef.setInput('handle', 'nobody'); f.detectChanges();
    expect(title.getTitle()).toBe('Лавка не найдена — Харид');
    api.shop.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 502 })));
    f.componentRef.setInput('handle', 'down'); f.detectChanges();
    expect(title.getTitle()).toBe('Лавка не загрузилась — Харид');
  });

  it('оценка в шапке: число и количество отзывов', async () => {
    const { q } = await render(SHOP(), [REVIEW]);
    const stat = q('shop-rating')!;
    expect(stat.textContent).toContain('4,7');
    expect(stat.textContent).toContain('3 отзыва');
  });

  it('по умолчанию — вкладка «Товары»: лента лавки, отзывов на странице нет', async () => {
    const { q, api } = await render(SHOP(), [REVIEW], { products: goods(2) });
    expect(q('tab-goods')!.getAttribute('aria-selected')).toBe('true');
    expect(q('tab-reviews')!.getAttribute('aria-selected')).toBe('false');
    expect(api.products).toHaveBeenCalledWith({ shop: 'zebo.style', limit: FEED_PAGE_SIZE, offset: 0 });
    expect(q('panel-goods')!.querySelectorAll('app-product-card').length).toBe(2);
    expect(q('review')).toBeNull();
  });

  it('числа на вкладках: товары (когда лента целиком) и отзывы', async () => {
    const { q } = await render(SHOP(), [REVIEW], { products: goods(2) });
    expect(q('tab-goods')!.textContent).toContain('2');
    expect(q('tab-reviews')!.textContent).toContain('3');
  });

  it('вкладка «Отзывы»: в адресе ?tab=reviews, у каждого отзыва — товар', async () => {
    const { q, click, api, router } = await render(SHOP(), [REVIEW]);
    await click('tab-reviews');
    expect(router.url).toContain('tab=reviews');
    expect(api.reviews).toHaveBeenCalledWith({ shop: 'zebo.style' });
    const item = q('review')!;
    expect(item.textContent).toContain('Мехрона');
    expect(item.querySelector('a')?.textContent?.trim()).toBe('Платье макси');
    expect(q('panel-goods')).toBeNull();
  });

  it('ссылка с ?tab=reviews открывает отзывы сразу', async () => {
    const { q } = await render(SHOP(), [REVIEW], { query: { tab: 'reviews' } });
    expect(q('panel-reviews')).not.toBeNull();
  });

  it('«3 отзыва» в шапке ведут на вкладку отзывов', async () => {
    const { q, click } = await render(SHOP(), [REVIEW]);
    await click('to-reviews');
    expect(q('panel-reviews')).not.toBeNull();
  });

  it('смена вкладки не перезапрашивает ленту', async () => {
    const { click, api } = await render(SHOP(), [REVIEW], { products: goods(2) });
    expect(api.products).toHaveBeenCalledTimes(1);
    await click('tab-reviews');
    await click('tab-goods');
    expect(api.products).toHaveBeenCalledTimes(1);
  });

  it('стрелки переключают вкладки', async () => {
    const { f, q } = await render(SHOP(), [REVIEW]);
    q('tab-goods')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await f.whenStable(); f.detectChanges();
    expect(q('tab-reviews')!.getAttribute('aria-selected')).toBe('true');
  });

  it('фильтры: у лавки с парой товаров скрыты, при многих — есть; фильтр из адреса — в запросе', async () => {
    const few = await render(SHOP(), [], { products: goods(3) });
    expect(few.el.querySelector('app-feed-filters')).toBeNull();
    TestBed.resetTestingModule();
    const many = await render(SHOP(), [], { products: goods(12) });
    expect(many.el.querySelector('app-feed-filters')).not.toBeNull();
    TestBed.resetTestingModule();
    const filtered = await render(SHOP(), [], { products: goods(1), query: { sort: 'price_asc' } });
    expect(filtered.api.products).toHaveBeenCalledWith({ sort: 'price_asc', shop: 'zebo.style', limit: FEED_PAGE_SIZE, offset: 0 });
    expect(filtered.el.querySelector('app-feed-filters')).not.toBeNull();
  });

  it('без оценки — «Пока без оценок», отзывы показывают пустое состояние', async () => {
    const { q, click } = await render(SHOP({ rating: null, reviews_count: 0 }), []);
    expect(q('shop-rating')?.textContent).toContain('Пока без оценок');
    await click('tab-reviews');
    expect(q('empty')).not.toBeNull();
  });

  it('лавка в Direct — оценок нет и не будет, «Доставлено» не показываем', async () => {
    const { el, q } = await render(SHOP({ rating: null, reviews_count: 0, verified: false, delivered_orders: 0 }), []);
    const stat = q('shop-rating')!;
    expect(stat.textContent).toContain('Нет');
    expect(stat.textContent).toContain('заказы в Direct');
    expect(el.querySelector('.stats')?.textContent).not.toContain('Доставлено');
  });
});
