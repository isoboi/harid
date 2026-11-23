import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SellerCardComponent } from './seller-card.component';
import { Shop } from '../core/models';
import { shopRating } from './rating';

const SHOP = (over: Partial<Shop> = {}): Shop => ({
  handle: 'leeboss_tj', name: 'Leeboss', bio: '', followers: 27046, district: null, rating: 4.8, reviews_count: 12, delivered_orders: 37,
  joined_at: '2026-11-23T10:54:13Z', avatar_color: '#2348C9', has_fresh: true, verified: true, ...over,
});

async function render(shop: Shop) {
  await TestBed.configureTestingModule({ imports: [SellerCardComponent], providers: [provideRouter([])] }).compileComponents();
  const f = TestBed.createComponent(SellerCardComponent);
  f.componentRef.setInput('shop', shop);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('shopRating', () => {
  it('есть оценка — число и отзывы', () => {
    expect(shopRating(SHOP())).toEqual({ kind: 'rated', value: '4,8', count: '12 отзывов' });
  });
  it('нет оценки — «пока без оценок»', () => {
    expect(shopRating(SHOP({ rating: null, reviews_count: 0 }))).toEqual({ kind: 'none' });
  });
  it('лавка в Direct без оценки — оценок не будет', () => {
    expect(shopRating(SHOP({ rating: null, reviews_count: 0, verified: false }))).toEqual({ kind: 'direct' });
  });
});

describe('SellerCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('имя, оценка, факты и ссылка на все товары лавки', async () => {
    const el = await render(SHOP());
    expect(el.querySelector('[data-test="seller-name"]')?.textContent).toContain('Leeboss');
    expect(el.querySelector('[data-test="seller-rating"]')?.textContent).toContain('4,8');
    expect(el.querySelector('[data-test="seller-rating"]')?.textContent).toContain('12 отзывов');
    const facts = el.querySelector('[data-test="seller-facts"]')!.textContent!;
    expect(facts).toContain('23 ноября');
    expect(facts).toContain('27 тыс.');
    expect(facts).toContain('37');
    expect(el.querySelector('[data-test="seller-all"]')?.getAttribute('href')).toBe('/shop/leeboss_tj');
  });

  it('без оценок — так и пишем', async () => {
    const el = await render(SHOP({ rating: null, reviews_count: 0 }));
    expect(el.querySelector('[data-test="seller-rating"]')?.textContent).toContain('Пока без оценок');
  });

  it('лавка в Direct — объясняем, почему оценок нет, доставки не считаем', async () => {
    const el = await render(SHOP({ rating: null, reviews_count: 0, verified: false, delivered_orders: 0 }));
    expect(el.querySelector('[data-test="seller-rating"]')?.textContent).toContain('заказы в Direct');
    expect(el.querySelector('[data-test="seller-facts"]')?.textContent).not.toContain('Доставлено');
  });

  it('без подписчиков — строку не показываем', async () => {
    const el = await render(SHOP({ followers: 0 }));
    expect(el.querySelector('[data-test="seller-facts"]')?.textContent).not.toContain('Instagram');
  });
});
