import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { FavoritesComponent } from './favorites.component';
import { FavoritesService } from '../../core/favorites.service';
import { MarketApi } from '../../core/market-api.service';
import { Product } from '../../core/models';
import { LANG_COOKIE, LANG_DICT } from '../../core/i18n';
import { TG } from '../../i18n/tg';

const product: Product = { id: '16', shop_handle: 'technomir.tj', title: 'Наушники', price: 320, old_price: null, image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '' };

describe('FavoritesComponent', () => {
  beforeEach(() => localStorage.clear());

  async function setup(productFn: jest.Mock) {
    await TestBed.configureTestingModule({ imports: [FavoritesComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { product: productFn } }] }).compileComponents();
    return TestBed.createComponent(FavoritesComponent);
  }

  it('до гидратации — «Загрузка…», не «Пока пусто»', async () => {
    const f = await setup(jest.fn());
    f.detectChanges();
    const t: string = f.nativeElement.textContent;
    expect(t).toContain('Загрузка');
    expect(t).not.toContain('Пока пусто');
    expect(f.nativeElement.querySelector('[data-test="skel-products"]')).not.toBeNull();
  });

  it('после гидратации пустого избранного — «Пока пусто»', async () => {
    const product = jest.fn();
    const f = await setup(product);
    TestBed.inject(FavoritesService).hydrate();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Пока пусто');
    expect(product).not.toHaveBeenCalled();
  });

  it('показывает товары, снятые с продажи пропускает', async () => {
    const api = jest.fn((id: string) => (id === '16' ? of(product) : throwError(() => new Error('404'))));
    const f = await setup(api);
    const fav = TestBed.inject(FavoritesService);
    fav.hydrate();
    fav.toggle('16');
    fav.toggle('99');
    f.detectChanges();
    const t: string = f.nativeElement.textContent;
    expect(t).toContain('Наушники');
    expect(t).not.toContain('Пока пусто');
  });
});

describe('FavoritesComponent: «Подешевело»', () => {
  const item = (id: string, price: number): Product => ({ ...product, id, title: 'Товар ' + id, price });
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('harid.fav', JSON.stringify(['1', '2', '3']));
    localStorage.setItem('harid.fav.prices', JSON.stringify({ '1': { base: 300, now: 300, stock: true }, '2': { base: 300, now: 300, stock: true }, '3': { base: 300, now: 300, stock: true } }));
  });
  afterEach(() => { TestBed.resetTestingModule(); document.cookie = `${LANG_COOKIE}=; path=/; max-age=0`; });

  async function open(dict?: Record<string, string>) {
    const prices: Record<string, number> = { '1': 300, '2': 300, '3': 250 };
    const providers: unknown[] = [provideRouter([]), { provide: MarketApi, useValue: { product: (id: string) => of(item(id, prices[id])) } }];
    if (dict) { document.cookie = `${LANG_COOKIE}=tg; path=/`; providers.push({ provide: LANG_DICT, useValue: dict }); }
    await TestBed.configureTestingModule({ imports: [FavoritesComponent], providers: providers as never[] }).compileComponents();
    const f = TestBed.createComponent(FavoritesComponent);
    TestBed.inject(FavoritesService).hydrate();
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }
  const titles = (el: HTMLElement) => Array.from(el.querySelectorAll('app-product-card .title')).map((n) => n.textContent?.trim());

  it('подешевевшие — первыми, остальные в прежнем порядке; у подешевевшего плашка', async () => {
    const el = await open();
    expect(titles(el)).toEqual(['Товар 3', 'Товар 1', 'Товар 2']);
    const drops = el.querySelectorAll('[data-test="price-drop"]');
    expect(drops.length).toBe(1);
    expect(drops[0].textContent?.trim()).toBe('Подешевело на 50 смн');
  });

  it('открыли избранное — точка гаснет, плашка остаётся', async () => {
    const el = await open();
    expect(TestBed.inject(FavoritesService).hasFreshDrop()).toBe(false);
    expect(el.querySelector('[data-test="price-drop"]')).not.toBeNull();
  });

  it('товар, который не загрузился, не считается увиденным — его точка не гаснет', async () => {
    localStorage.setItem('harid.fav.prices', JSON.stringify({ '1': { base: 300, now: 300, stock: true }, '2': { base: 300, now: 250, stock: true }, '3': { base: 300, now: 300, stock: true } }));
    const api = { product: (id: string) => (id === '2' ? throwError(() => new Error('сеть')) : of(item(id, 300))) };
    await TestBed.configureTestingModule({ imports: [FavoritesComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    const f = TestBed.createComponent(FavoritesComponent);
    TestBed.inject(FavoritesService).hydrate();
    f.detectChanges();
    expect(TestBed.inject(FavoritesService).hasFreshDrop()).toBe(true);
  });

  it('загрузили избранное — это и есть свежая проверка цен: фоновая не повторяет те же запросы', async () => {
    await open();
    expect(JSON.parse(localStorage.getItem('harid.fav.checkedAt')!)).toEqual(expect.any(Number));
  });

  it('по-таджикски — «Арзон шуд: 50 смн»', async () => {
    const el = await open(TG);
    expect(el.querySelector('[data-test="price-drop"]')?.textContent?.trim()).toBe('Арзон шуд: 50 смн');
  });
});
