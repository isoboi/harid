import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProductCardComponent } from './product-card.component';

describe('ProductCardComponent', () => {
  it('ссылка на товар, цена и @лавка', async () => {
    await TestBed.configureTestingModule({ imports: [ProductCardComponent], providers: [provideRouter([])] }).compileComponents();
    const f = TestBed.createComponent(ProductCardComponent);
    f.componentRef.setInput('product', { id: '16', shop_handle: 'technomir.tj', title: 'Наушники', price: 1250, old_price: null, image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '' });
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/product/16');
    expect(el.textContent).toContain('1 250 смн');
    expect(el.textContent).toContain('@technomir.tj');
    expect(el.querySelector('[data-test="cod"]')?.textContent?.trim()).toBe('Оплата при получении');
    expect(el.querySelector('[data-test="rating"]')).toBeNull();
  });
  it('товар со скидкой — плашка «−10%» на фото; без скидки плашки нет', async () => {
    await TestBed.configureTestingModule({ imports: [ProductCardComponent], providers: [provideRouter([])] }).compileComponents();
    const f = TestBed.createComponent(ProductCardComponent);
    const base = { id: '16', shop_handle: 'a', title: 'Т', image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '' };
    f.componentRef.setInput('product', { ...base, price: 540, old_price: 600 });
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('.img [data-test="discount"]')?.textContent?.trim()).toBe('−10%');
    f.componentRef.setInput('product', { ...base, price: 540, old_price: null });
    f.detectChanges();
    expect(el.querySelector('[data-test="discount"]')).toBeNull();
  });
  it.each([
    [4.8, 12, '4,8 · 12 отзывов'],
    [5, 1, '5,0 · 1 отзыв'],
    [4.33, 3, '4,3 · 3 отзыва'],
  ])('оценка %s при %i отзывах — «★ %s»', async (rating, reviews_count, text) => {
    await TestBed.configureTestingModule({ imports: [ProductCardComponent], providers: [provideRouter([])] }).compileComponents();
    const f = TestBed.createComponent(ProductCardComponent);
    f.componentRef.setInput('product', { id: '16', shop_handle: 'a', title: 'Т', price: 1, old_price: null, image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '', rating, reviews_count });
    f.detectChanges();
    const r = (f.nativeElement as HTMLElement).querySelector('[data-test="rating"]');
    expect(r?.textContent?.trim()).toBe(text);
    expect(r?.querySelector('svg')).not.toBeNull();
  });
  it('неподключённая лавка — без ценника, «Заказ в Instagram Direct» вместо оплаты при получении', async () => {
    await TestBed.configureTestingModule({ imports: [ProductCardComponent], providers: [provideRouter([])] }).compileComponents();
    const f = TestBed.createComponent(ProductCardComponent);
    f.componentRef.setInput('product', { id: '16', shop_handle: 'a', title: 'Т', price: null, old_price: null, image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '', shop_verified: false });
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('.price-tag')).toBeNull();
    expect(el.textContent).not.toContain('смн');
    expect(el.querySelector('[data-test="cod"]')?.textContent?.trim()).toBe('Заказ в Instagram Direct');
  });
  it('0 отзывов — оценки не видно', async () => {
    await TestBed.configureTestingModule({ imports: [ProductCardComponent], providers: [provideRouter([])] }).compileComponents();
    const f = TestBed.createComponent(ProductCardComponent);
    f.componentRef.setInput('product', { id: '16', shop_handle: 'a', title: 'Т', price: 1, old_price: null, image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '', rating: 4.9, reviews_count: 0 });
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('[data-test="rating"]')).toBeNull();
  });
});
