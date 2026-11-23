import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CategoryComponent } from './category.component';
import { MarketApi } from '../../core/market-api.service';
import { Category, Product } from '../../core/models';

const item = (id: string, over: Partial<Product> = {}): Product => ({
  id, shop_handle: 'shop', title: `Товар ${id}`, price: 100, old_price: null, image: 'a.jpg', category: null, description: '', sizes: [], in_stock: true, posted_at: '', ...over,
});
const CATS: Category[] = [{ slug: 'shoes', name: 'Обувь' }, { slug: 'bags', name: 'Сумки' }, { slug: 'kids', name: 'Детское' }];

/** feed — общая лента для чипов (limit=100); inCategory — товары самой категории (category=…). */
async function render(slug: string, inCategory: Product[], feed: Product[]) {
  const products = jest.fn((q: { category?: string; limit?: number }) => of(q.category ? inCategory : feed));
  await TestBed.configureTestingModule({ imports: [CategoryComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { categories: () => of(CATS), products } }] }).compileComponents();
  const f = TestBed.createComponent(CategoryComponent);
  f.componentRef.setInput('slug', slug);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  return {
    products,
    cards: () => Array.from(el.querySelectorAll('app-product-card')).map((c) => c.textContent ?? ''),
    chips: () => Array.from(el.querySelectorAll('nav.chips a')).map((a) => a.textContent?.trim()),
    count: () => el.querySelector('.count')?.textContent?.trim(),
  };
}

describe('CategoryComponent: лента и чипы', () => {
  it('в категории — без сломанных названий и сначала доступные для заказа; счётчик по показанным', async () => {
    const inCat = [item('1', { price: null, title: 'Без цены', category: 'shoes' }), item('2', { title: '!', category: 'shoes' }), item('3', { title: 'Кеды', category: 'shoes' })];
    const { cards, count } = await render('shoes', inCat, inCat);
    expect(cards().length).toBe(2);
    expect(cards()[0]).toContain('Кеды');
    expect(cards()[1]).toContain('Без цены');
    expect(count()).toContain('2 товара');
  });

  it('чипы — категории с товарами; текущая остаётся, даже если пуста', async () => {
    const feed = [item('1', { category: 'bags' }), item('2', { category: null })];
    const { chips } = await render('kids', [], feed);
    expect(chips()).toEqual(['Всё', 'Сумки', 'Детское']);
  });

  it('пустая категория — «Пока пусто»', async () => {
    const { cards } = await render('kids', [], []);
    expect(cards().length).toBe(0);
  });
});
