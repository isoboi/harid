import { PLATFORM_ID, REQUEST } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FavoritesService } from '../core/favorites.service';
import { LANG_DICT } from '../core/i18n';
import { TG } from '../i18n/tg';
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
  it('сердечко запоминает цену товара в момент добавления — для «Подешевело»', async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [ProductCardComponent], providers: [provideRouter([])] }).compileComponents();
    const f = TestBed.createComponent(ProductCardComponent);
    f.componentRef.setInput('product', { id: '16', shop_handle: 'a', title: 'Т', price: 300, old_price: null, image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '' });
    f.detectChanges();
    (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.fav')!.click();
    expect(TestBed.inject(FavoritesService).marks()['16']).toEqual({ base: 300, now: 300, stock: true });
  });
  it('карточка товара из избранного сообщает его свежую цену — и когда избранное загрузилось позже карточки', async () => {
    localStorage.clear();
    localStorage.setItem('harid.fav', JSON.stringify(['16']));
    localStorage.setItem('harid.fav.prices', JSON.stringify({ '16': { base: 300, now: 300, stock: true } }));
    await TestBed.configureTestingModule({ imports: [ProductCardComponent], providers: [provideRouter([])] }).compileComponents();
    const f = TestBed.createComponent(ProductCardComponent);
    f.componentRef.setInput('product', { id: '16', shop_handle: 'a', title: 'Т', price: 250, old_price: null, image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '' });
    f.detectChanges();
    const fav = TestBed.inject(FavoritesService);
    fav.hydrate();
    f.detectChanges();
    expect(fav.drop('16')).toBe(50);
  });
  it('карточка товара не из избранного цен не пишет', async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [ProductCardComponent], providers: [provideRouter([])] }).compileComponents();
    const f = TestBed.createComponent(ProductCardComponent);
    f.componentRef.setInput('product', { id: '16', shop_handle: 'a', title: 'Т', price: 250, old_price: null, image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '' });
    TestBed.inject(FavoritesService).hydrate();
    f.detectChanges();
    expect(TestBed.inject(FavoritesService).marks()).toEqual({});
    expect(localStorage.getItem('harid.fav.prices')).toBeNull();
  });
});

describe('ProductCardComponent по-таджикски', () => {
  /** Язык страницы — из cookie запроса (как на SSR), словарь — настоящий таджикский. */
  const req = { headers: { get: (k: string) => (k === 'cookie' ? 'lang=tg' : null) } };
  afterEach(() => TestBed.resetTestingModule());
  it('оплата, оценка и подпись сердечка — на тоҷикӣ', async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCardComponent],
      providers: [provideRouter([]), { provide: PLATFORM_ID, useValue: 'server' }, { provide: REQUEST, useValue: req }, { provide: LANG_DICT, useValue: TG }],
    }).compileComponents();
    const f = TestBed.createComponent(ProductCardComponent);
    f.componentRef.setInput('product', { id: '16', shop_handle: 'a', title: 'Наушники', price: 1250, old_price: 1500, image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '', rating: 4.8, reviews_count: 12 });
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('[data-test="cod"]')?.textContent?.trim()).toBe('Пардохт ҳангоми гирифтан');
    expect(el.querySelector('[data-test="rating"]')?.textContent?.trim()).toBe('4,8 · 12 шарҳ');
    expect(el.querySelector('.ph')?.textContent?.trim()).toBe('Акс нест');
    expect(el.querySelector('.price-tag s')?.textContent).toContain('Пештар');
    expect(el.querySelector('.fav')?.getAttribute('aria-label')).toBe('«Наушники»-ро ба интихобшудаҳо илова кардан');
  });
});
