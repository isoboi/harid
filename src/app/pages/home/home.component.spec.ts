import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HomeComponent } from './home.component';
import { MarketApi } from '../../core/market-api.service';
import { Category, Product } from '../../core/models';

const item = (id: string, over: Partial<Product> = {}): Product => ({
  id, shop_handle: 'shop', title: `Товар ${id}`, price: 100, old_price: null, image: 'a.jpg', category: null, description: '', sizes: [], in_stock: true, posted_at: '', ...over,
});
const CATS: Category[] = [{ slug: 'shoes', name: 'Обувь' }, { slug: 'bags', name: 'Сумки' }, { slug: 'kids', name: 'Детское' }];

async function render(products: ReturnType<MarketApi['products']>) {
  const api = { shops: jest.fn(() => of([])), categories: jest.fn(() => of(CATS)), products: jest.fn(() => products) };
  await TestBed.configureTestingModule({ imports: [HomeComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
  const f = TestBed.createComponent(HomeComponent);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  return {
    api,
    cards: () => Array.from(el.querySelectorAll('app-product-card')).map((c) => c.textContent ?? ''),
    chips: () => Array.from(el.querySelectorAll('nav.chips a')).map((a) => a.textContent?.trim()),
  };
}

describe('HomeComponent: лента', () => {
  it('запрашивает сотню товаров (предел API), а показывает 24', async () => {
    const many = Array.from({ length: 40 }, (_, i) => item(String(i + 1)));
    const { api, cards } = await render(of(many));
    expect(api.products).toHaveBeenCalledWith({ limit: 100 });
    expect(cards().length).toBe(24);
  });

  it('сначала товары, которые можно заказать; без цены — после них', async () => {
    const { cards } = await render(of([item('1', { price: null, title: 'Пост без цены' }), item('2', { title: 'Кроссовки' }), item('3', { title: 'Сумка' })]));
    const text = cards();
    expect(text.map((t) => ['Кроссовки', 'Сумка', 'Пост без цены'].findIndex((x) => t.includes(x)))).toEqual([0, 1, 2]);
  });

  it('товары со сломанным названием («!», «@ник») не показываются', async () => {
    const { cards } = await render(of([item('1', { title: '!' }), item('2', { title: '@leeboss_tj', price: null }), item('3', { title: 'Куртка' })]));
    expect(cards().length).toBe(1);
    expect(cards()[0]).toContain('Куртка');
  });

  it('чипы — только категории, в которых есть товары', async () => {
    const { chips } = await render(of([item('1', { category: 'shoes' }), item('2', { category: null })]));
    expect(chips()).toEqual(['Всё', 'Обувь']);
  });

  it('товары не загрузились — все категории, как раньше, и «Пока пусто»', async () => {
    const { chips, cards } = await render(throwError(() => new Error('500')));
    expect(chips()).toEqual(['Всё', 'Обувь', 'Сумки', 'Детское']);
    expect(cards().length).toBe(0);
  });
});
