import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Analytics, ANALYTICS_ID, analyticsUrl } from './analytics.service';

type Ym = { a: IArguments[] };
const win = window as unknown as { ym?: Ym };
const calls = () => (win.ym?.a ?? []).map((c) => Array.from(c));
const tags = () => document.head.querySelectorAll('script[src*="mc.yandex.ru"]');

function setup(id: string, platform: 'browser' | 'server' = 'browser'): Analytics {
  TestBed.configureTestingModule({ providers: [{ provide: ANALYTICS_ID, useValue: id }, { provide: PLATFORM_ID, useValue: platform }] });
  return TestBed.inject(Analytics);
}

function setDnt(value: string | null): void {
  Object.defineProperty(window.navigator, 'doNotTrack', { value, configurable: true });
}

describe('Analytics', () => {
  afterEach(() => {
    delete win.ym;
    tags().forEach((t) => t.remove());
    setDnt(null);
  });

  it('без номера счётчика ничего не подключает и не падает', () => {
    const a = setup('');
    a.pageview('/');
    a.track('add_to_cart');
    expect(tags().length).toBe(0);
    expect(win.ym).toBeUndefined();
  });

  it('на сервере ничего не подключает', () => {
    const a = setup('123', 'server');
    a.pageview('/');
    a.track('add_to_cart');
    expect(tags().length).toBe(0);
    expect(win.ym).toBeUndefined();
  });

  it('при включённом «Не отслеживать» ничего не подключает', () => {
    setDnt('1');
    const a = setup('123');
    a.track('purchase');
    expect(tags().length).toBe(0);
  });

  it('нечисловой номер счётчика считается ошибкой настройки и не подключает скрипт', () => {
    const a = setup('<script>');
    a.track('purchase');
    expect(tags().length).toBe(0);
  });

  it('при первом обращении подключает tag.js один раз и инициализирует счётчик без автосбора', () => {
    const a = setup('123');
    a.track('add_to_cart');
    a.track('add_to_cart');
    expect(tags().length).toBe(1);
    expect(calls()[0]).toEqual([123, 'init', { defer: true, clickmap: false, trackLinks: false, accurateTrackBounce: false, webvisor: false }]);
  });

  it('track отправляет цель с параметрами', () => {
    const a = setup('123');
    a.track('add_to_cart', { shop: 'my.shop', price: 540 });
    expect(calls()[1]).toEqual([123, 'reachGoal', 'add_to_cart', { shop: 'my.shop', price: 540 }]);
  });

  it('pageview отправляет очищенный адрес: без токена заказа и телефона', () => {
    const a = setup('123');
    a.pageview('/order/H-1042?t=SECRET&fresh=1&phone=931234567', 'Заказ');
    const hit = calls()[1];
    expect(hit.slice(0, 3)).toEqual([123, 'hit', '/order/:number']);
    expect(JSON.stringify(hit)).not.toContain('SECRET');
    expect(JSON.stringify(hit)).not.toContain('931234567');
  });

  it('следующий pageview передаёт предыдущую страницу как referrer', () => {
    const a = setup('123');
    a.pageview('/');
    a.pageview('/product/5');
    expect(calls()[1][3]).toEqual({});
    expect(calls()[2][3]).toEqual({ referrer: `${window.location.origin}/` });
  });
});

describe('analyticsUrl', () => {
  it('оставляет путь и убирает query и якорь', () => {
    expect(analyticsUrl('/product/5?size=42#reviews')).toBe('/product/5');
  });

  it('сохраняет UTM-метки — по ним видно источник', () => {
    expect(analyticsUrl('/shop/a?utm_source=instagram&utm_medium=bio&x=1')).toBe('/shop/a?utm_source=instagram&utm_medium=bio');
  });

  it('прячет номер заказа и номер чата', () => {
    expect(analyticsUrl('/order/H-1042?t=SECRET')).toBe('/order/:number');
    expect(analyticsUrl('/chats/77')).toBe('/chats/:id');
  });

  it('«/chats/new» остаётся как есть', () => {
    expect(analyticsUrl('/chats/new?shop=a&product=5')).toBe('/chats/new');
  });
});
