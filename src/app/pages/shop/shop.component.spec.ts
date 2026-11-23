import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ShopComponent } from './shop.component';
import { MarketApi } from '../../core/market-api.service';
import { Product, Review, Shop } from '../../core/models';

const SHOP = (over: Partial<Shop> = {}): Shop => ({
  handle: 'zebo.style', name: 'Зебо', bio: '', followers: 0, district: null, rating: 4.7, reviews_count: 3, delivered_orders: 412,
  joined_at: '2026-03-02T00:00:00Z', avatar_color: '#000', has_fresh: false, ...over,
});
const REVIEW: Review = { id: 1, product_id: '16', product_title: 'Платье макси', shop_handle: 'zebo.style', author: 'Мехрона', rating: 5, text: 'Тёплый', created_at: '2026-10-19T09:00:00Z' };

async function render(shop: Shop, reviews: Review[]) {
  const api = { shop: jest.fn(() => of(shop)), products: jest.fn(() => of([])), reviews: jest.fn(() => of(reviews)), reviewSummary: jest.fn(() => of(null)), reviewable: jest.fn(() => of([])) };
  await TestBed.configureTestingModule({ imports: [ShopComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
  const f = TestBed.createComponent(ShopComponent);
  f.componentRef.setInput('handle', shop.handle);
  f.detectChanges();
  return { el: f.nativeElement as HTMLElement, api };
}

describe('ShopComponent', () => {
  it('оценка в шапке: число и количество отзывов', async () => {
    const { el } = await render(SHOP(), [REVIEW]);
    const stat = el.querySelector('[data-test="shop-rating"]')!;
    expect(stat.textContent).toContain('4,7');
    expect(stat.textContent).toContain('3 отзыва');
  });
  it('отзывы о лавке: запрос по handle, у каждого отзыва — товар', async () => {
    const { el, api } = await render(SHOP(), [REVIEW]);
    expect(api.reviews).toHaveBeenCalledWith({ shop: 'zebo.style' });
    const item = el.querySelector('[data-test="review"]')!;
    expect(item.textContent).toContain('Мехрона');
    expect(item.querySelector('a')?.textContent?.trim()).toBe('Платье макси');
  });
  it('без оценки — пункта «Оценка» нет, отзывы показывают пустое состояние', async () => {
    const { el } = await render(SHOP({ rating: null, reviews_count: 0 }), []);
    expect(el.querySelector('[data-test="shop-rating"]')).toBeNull();
    expect(el.querySelector('[data-test="empty"]')).not.toBeNull();
  });
});

describe('ShopComponent: товары лавки', () => {
  const item = (id: string, over: Partial<Product> = {}): Product => ({
    id, shop_handle: 'zebo.style', title: `Товар ${id}`, price: 100, old_price: null, image: 'a.jpg', category: null, description: '', sizes: [], in_stock: true, posted_at: '', ...over,
  });

  async function renderWith(products: Product[]) {
    const api = { shop: jest.fn(() => of(SHOP())), products: jest.fn(() => of(products)), reviews: jest.fn(() => of([])), reviewSummary: jest.fn(() => of(null)), reviewable: jest.fn(() => of([])) };
    await TestBed.configureTestingModule({ imports: [ShopComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    const f = TestBed.createComponent(ShopComponent);
    f.componentRef.setInput('handle', 'zebo.style');
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    return { cards: () => Array.from(el.querySelectorAll('app-product-card')).map((c) => c.textContent ?? ''), title: () => el.querySelector('.section-title')?.textContent?.trim() };
  }

  it('сначала можно заказать, без цены — после; сломанные названия скрыты, счётчик по показанным', async () => {
    const { cards, title } = await renderWith([item('1', { price: null, title: 'Пост без цены' }), item('2', { title: '!' }), item('3', { title: 'Платье' })]);
    expect(cards().length).toBe(2);
    expect(cards()[0]).toContain('Платье');
    expect(cards()[1]).toContain('Пост без цены');
    expect(title()).toBe('2 товара');
  });
});
