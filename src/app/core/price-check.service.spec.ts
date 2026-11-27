import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { CLOCK } from './clock';
import { FavoritesService } from './favorites.service';
import { MarketApi } from './market-api.service';
import { CHECK_CONCURRENCY, CHECK_EVERY_MS, CHECK_LIMIT, PriceCheckService } from './price-check.service';

const NOW = new Date('2026-11-27T12:00:00+05:00').getTime();
const CHECKED = 'harid.fav.checkedAt';
const product = (id: string, price: number, in_stock = true) => ({ id, price, in_stock, shop_handle: 'a', title: 'T', old_price: null, image: '', category: null, description: '', sizes: [], posted_at: '' });

function setup(api: Partial<MarketApi>, platform: 'browser' | 'server' = 'browser') {
  TestBed.configureTestingModule({ providers: [{ provide: MarketApi, useValue: api }, { provide: CLOCK, useValue: () => new Date(NOW) }, { provide: PLATFORM_ID, useValue: platform }] });
  return TestBed.inject(PriceCheckService);
}
/** Избранное из id; у каждого запомнена цена 300. */
function favorites(ids: string[]) {
  localStorage.setItem('harid.fav', JSON.stringify(ids));
  localStorage.setItem('harid.fav.prices', JSON.stringify(Object.fromEntries(ids.map((id) => [id, { base: 300, now: 300, stock: true }]))));
}
const setNavigator = (key: string, value: unknown) => Object.defineProperty(navigator, key, { configurable: true, get: () => value });

describe('PriceCheckService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { setNavigator('onLine', true); setNavigator('connection', undefined); jest.useRealTimers(); });

  it('константы из спецификации: раз в 6 часов, до 30 товаров, по 4 запроса', () => {
    expect([CHECK_EVERY_MS, CHECK_LIMIT, CHECK_CONCURRENCY]).toEqual([6 * 60 * 60 * 1000, 30, 4]);
  });

  it('проверяет 30 последних добавленных, не больше 4 запросов одновременно, запоминает время', () => {
    favorites(Array.from({ length: 35 }, (_, i) => String(i + 1)));
    let active = 0, peak = 0;
    const pending: (() => void)[] = [];
    const api = { product: jest.fn((id: string) => new Observable<ReturnType<typeof product>>((s) => {
      active++; peak = Math.max(peak, active);
      pending.push(() => { s.next(product(id, 250)); s.complete(); });
      return () => { active--; };
    })) };
    setup(api as never).run().subscribe();
    while (pending.length) pending.shift()!();
    expect(api.product.mock.calls.map(([id]) => id)).toEqual(Array.from({ length: 30 }, (_, i) => String(i + 6)));
    expect(peak).toBe(4);
    expect(JSON.parse(localStorage.getItem(CHECKED)!)).toBe(NOW);
  });

  it('свежая цена из ответа доходит до избранного', () => {
    favorites(['1']);
    setup({ product: () => of(product('1', 250)) } as never).run().subscribe();
    expect(TestBed.inject(FavoritesService).drop('1')).toBe(50);
  });

  it('с прошлой проверки меньше 6 часов — запросов нет; прошло 6 часов — снова проверяет', () => {
    favorites(['1']);
    const api = { product: jest.fn(() => of(product('1', 250))) };
    localStorage.setItem(CHECKED, JSON.stringify(NOW - CHECK_EVERY_MS + 1000));
    setup(api as never).run().subscribe();
    expect(api.product).not.toHaveBeenCalled();
    localStorage.setItem(CHECKED, JSON.stringify(NOW - CHECK_EVERY_MS));
    TestBed.inject(PriceCheckService).run().subscribe();
    expect(api.product).toHaveBeenCalledTimes(1);
  });

  it('время проверки из будущего (сбились часы) — проверяет, а не ждёт', () => {
    favorites(['1']);
    const api = { product: jest.fn(() => of(product('1', 250))) };
    localStorage.setItem(CHECKED, JSON.stringify(NOW + 24 * 60 * 60 * 1000));
    setup(api as never).run().subscribe();
    expect(api.product).toHaveBeenCalledTimes(1);
  });

  it('ошибка по одному товару не мешает остальным', () => {
    favorites(['1', '2', '3']);
    const api = { product: (id: string) => (id === '2' ? throwError(() => new Error('404')) : of(product(id, 250))) };
    setup(api as never).run().subscribe();
    const fav = TestBed.inject(FavoritesService);
    expect([fav.drop('1'), fav.drop('2'), fav.drop('3')]).toEqual([50, null, 50]);
  });

  it('пустое избранное, нет сети или режим экономии трафика — запросов нет', () => {
    const api = { product: jest.fn(() => of(product('1', 250))) };
    setup(api as never).run().subscribe();
    favorites(['1']);
    TestBed.resetTestingModule();
    setNavigator('onLine', false);
    setup(api as never).run().subscribe();
    setNavigator('onLine', true);
    setNavigator('connection', { saveData: true });
    TestBed.resetTestingModule();
    setup(api as never).run().subscribe();
    expect(api.product).not.toHaveBeenCalled();
  });

  it('start() откладывает проверку, пока браузер не освободится, и запускает её один раз', () => {
    jest.useFakeTimers();
    favorites(['1']);
    const api = { product: jest.fn(() => of(product('1', 250))) };
    const s = setup(api as never);
    s.start();
    s.start();
    expect(api.product).not.toHaveBeenCalled();
    jest.runAllTimers();
    expect(api.product).toHaveBeenCalledTimes(1);
  });

  it('start() на сервере ничего не планирует', () => {
    jest.useFakeTimers();
    favorites(['1']);
    const api = { product: jest.fn(() => of(product('1', 250))) };
    setup(api as never, 'server').start();
    jest.runAllTimers();
    expect(api.product).not.toHaveBeenCalled();
  });
});
