import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Route } from '@angular/router';
import { of, throwError } from 'rxjs';
import { routes } from '../app.routes';
import { PRELOAD_IDLE_TIMEOUT_MS, ShopperPreloading, slowNetwork } from './shopper-preloading';

describe('ShopperPreloading', () => {
  const marked: Route = { path: 'product/:id', data: { preload: true } };
  const setConnection = (c: object | undefined) => Object.defineProperty(navigator, 'connection', { value: c, configurable: true });
  const setup = (platform = 'browser') => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: platform }] });
    return TestBed.inject(ShopperPreloading);
  };
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.useRealTimers(); setConnection(undefined); });

  it('маршрут с data.preload грузится, когда браузер простаивает, а не сразу', () => {
    const load = jest.fn(() => of('chunk'));
    const got: unknown[] = [];
    setup().preload(marked, load).subscribe((v) => got.push(v));
    expect(load).not.toHaveBeenCalled();
    jest.advanceTimersByTime(PRELOAD_IDLE_TIMEOUT_MS);
    expect(load).toHaveBeenCalledTimes(1);
    expect(got).toEqual(['chunk']);
  });

  it('маршрут без отметки не предзагружается', () => {
    const load = jest.fn(() => of('chunk'));
    setup().preload({ path: 'chats' }, load).subscribe();
    jest.advanceTimersByTime(PRELOAD_IDLE_TIMEOUT_MS);
    expect(load).not.toHaveBeenCalled();
  });

  it('на сервере (SSR) ничего не грузит', () => {
    const load = jest.fn(() => of('chunk'));
    setup('server').preload(marked, load).subscribe();
    jest.advanceTimersByTime(PRELOAD_IDLE_TIMEOUT_MS);
    expect(load).not.toHaveBeenCalled();
  });

  it('при «Экономии трафика» и на 2G не грузит', () => {
    const load = jest.fn(() => of('chunk'));
    const s = setup();
    for (const c of [{ saveData: true, effectiveType: '4g' }, { effectiveType: '2g' }, { effectiveType: 'slow-2g' }]) {
      setConnection(c);
      s.preload(marked, load).subscribe();
    }
    jest.advanceTimersByTime(PRELOAD_IDLE_TIMEOUT_MS);
    expect(load).not.toHaveBeenCalled();
  });

  it('ошибка загрузки чанка не ломает предзагрузку остальных', () => {
    const errors: unknown[] = [];
    const done = jest.fn();
    setup().preload(marked, () => throwError(() => new Error('offline'))).subscribe({ error: (e) => errors.push(e), complete: done });
    jest.advanceTimersByTime(PRELOAD_IDLE_TIMEOUT_MS);
    expect(errors).toEqual([]);
    expect(done).toHaveBeenCalled();
  });

  it('отписка до простоя отменяет загрузку', () => {
    const load = jest.fn(() => of('chunk'));
    setup().preload(marked, load).subscribe().unsubscribe();
    jest.advanceTimersByTime(PRELOAD_IDLE_TIMEOUT_MS);
    expect(load).not.toHaveBeenCalled();
  });
});

describe('slowNetwork', () => {
  const setConnection = (c: object | undefined) => Object.defineProperty(navigator, 'connection', { value: c, configurable: true });
  afterEach(() => setConnection(undefined));

  it('без Network Information API (Safari, Firefox) сеть считается нормальной', () => {
    setConnection(undefined);
    expect(slowNetwork()).toBe(false);
  });

  it('3G и 4G — нормальная сеть', () => {
    setConnection({ effectiveType: '3g' });
    expect(slowNetwork()).toBe(false);
    setConnection({ effectiveType: '4g', saveData: false });
    expect(slowNetwork()).toBe(false);
  });
});

describe('app.routes — предзагрузка', () => {
  const preloaded = (path: string) => routes.find((r) => r.path === path)?.data?.['preload'] === true;

  it('путь покупателя предзагружается', () => {
    for (const path of ['', 'catalog', 'c/:slug', 'search', 'shop/:handle', 'product/:id', 'cart', 'checkout']) expect(preloaded(path)).toBe(true);
  });

  it('чат, продажа и личные разделы — нет', () => {
    for (const path of ['login', 'me/orders', 'favorites', 'order/:number', 'sell', 'chats', 'chats/new', 'chats/:id']) expect(preloaded(path)).toBe(false);
  });
});
