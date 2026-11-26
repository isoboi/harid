import { Component, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { Metric } from 'web-vitals';
import { routePattern, toReport, WebVitals } from './web-vitals.service';

const callbacks: Record<string, (m: Metric) => void> = {};
jest.mock('web-vitals', () => {
  const reg = (name: string) => (cb: (m: Metric) => void) => { callbacks[name] = cb; };
  return { onTTFB: reg('TTFB'), onFCP: reg('FCP'), onLCP: reg('LCP'), onINP: reg('INP'), onCLS: reg('CLS') };
});

@Component({ standalone: true, template: '' })
class Stub {}

const metric = (name: Metric['name'], value: number, id = `${name}-1`): Metric =>
  ({ name, value, rating: 'good', delta: value, id, entries: [], navigationType: 'navigate', navigationId: 1 }) as unknown as Metric;

/** web-vitals грузится через import(): ждём, пока промис разрешится и подпишет обработчики. */
const loaded = () => new Promise((r) => setTimeout(r));

function hide() {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
}

describe('WebVitals', () => {
  let beacon: jest.Mock;

  async function setup(url: string, platform = 'browser') {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: platform },
        provideRouter([{ path: '', component: Stub }, { path: 'product/:id', component: Stub }, { path: 'order/:number', component: Stub }, { path: '**', component: Stub }]),
      ],
    });
    await TestBed.inject(Router).navigateByUrl(url);
    return TestBed.inject(WebVitals);
  }

  beforeEach(() => {
    for (const k of Object.keys(callbacks)) delete callbacks[k];
    beacon = jest.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
  });
  afterEach(() => TestBed.resetTestingModule());

  it('метрики копятся и уходят одним запросом, когда вкладку прячут; маршрут — шаблоном, без id товара', async () => {
    const v = await setup('/product/1316?utm=x');
    v.start(() => 0);
    await loaded();
    callbacks['TTFB'](metric('TTFB', 412.7));
    callbacks['LCP'](metric('LCP', 2399.6));
    callbacks['CLS'](metric('CLS', 0.123456));
    expect(beacon).not.toHaveBeenCalled();
    hide();
    expect(beacon).toHaveBeenCalledTimes(1);
    const [path, body] = beacon.mock.calls[0];
    expect(path).toBe('/vitals');
    const sent = JSON.parse(body);
    expect(sent.map((s: { name: string; value: number }) => [s.name, s.value])).toEqual([['TTFB', 413], ['LCP', 2400], ['CLS', 0.1235]]);
    expect(new Set(sent.map((s: { route: string }) => s.route))).toEqual(new Set(['product/:id']));
    expect(body).not.toContain('1316');
    expect(body).not.toContain('utm');
  });

  it('повтор метрики с тем же id заменяет прежнюю; после отправки очередь пуста', async () => {
    const v = await setup('/');
    v.start(() => 0);
    await loaded();
    callbacks['INP'](metric('INP', 120, 'inp-1'));
    callbacks['INP'](metric('INP', 340, 'inp-1'));
    hide();
    const sent = JSON.parse(beacon.mock.calls[0][1]);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ name: 'INP', value: 340, route: '' });
    hide();
    expect(beacon).toHaveBeenCalledTimes(1);
  });

  it('номер заказа в адрес отчёта не попадает', async () => {
    const v = await setup('/order/R-123456');
    v.start(() => 0);
    await loaded();
    callbacks['FCP'](metric('FCP', 900));
    window.dispatchEvent(new Event('pagehide'));
    const body = beacon.mock.calls[0][1];
    expect(JSON.parse(body)[0].route).toBe('order/:number');
    expect(body).not.toContain('R-123456');
  });

  it('sendBeacon не сработал — запасной fetch с keepalive', async () => {
    beacon.mockReturnValue(false);
    const fetchMock = jest.fn(() => Promise.resolve({ ok: true, status: 204 }));
    const original = window.fetch;
    Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true });
    try {
      const v = await setup('/');
      v.start(() => 0);
      await loaded();
      callbacks['LCP'](metric('LCP', 1800));
      hide();
      expect(fetchMock).toHaveBeenCalledWith('/vitals', expect.objectContaining({ method: 'POST', keepalive: true }));
    } finally {
      Object.defineProperty(window, 'fetch', { value: original, configurable: true });
    }
  });

  it('визит не попал в выборку — библиотека не грузится, ничего не шлётся', async () => {
    const v = await setup('/');
    v.start(() => 1);
    await loaded();
    expect(callbacks['LCP']).toBeUndefined();
  });

  it('на сервере (SSR) не запускается', async () => {
    const v = await setup('/', 'server');
    v.start(() => 0);
    await loaded();
    expect(callbacks['LCP']).toBeUndefined();
  });

  it('повторный start ничего не удваивает', async () => {
    const v = await setup('/');
    v.start(() => 0);
    v.start(() => 0);
    await loaded();
    callbacks['LCP'](metric('LCP', 1800));
    hide();
    expect(beacon).toHaveBeenCalledTimes(1);
  });
});

describe('routePattern и toReport', () => {
  it('шаблон собирается по вложенным маршрутам, пустые пути пропускаются', () => {
    const snap = { routeConfig: null, firstChild: { routeConfig: { path: 'shop/:handle' }, firstChild: { routeConfig: { path: '' }, firstChild: null } } };
    expect(routePattern(snap as never)).toBe('shop/:handle');
  });

  it('мс округляются до целых, CLS — до четырёх знаков', () => {
    expect(toReport(metric('INP', 199.5), 'x', '4g', 'mobile').value).toBe(200);
    expect(toReport(metric('CLS', 0.000049), 'x', '', 'desktop').value).toBe(0);
  });
});
