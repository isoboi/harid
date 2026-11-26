import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, NgZone, PLATFORM_ID } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter, take } from 'rxjs';
import type { Metric } from 'web-vitals';
import { VITAL_NETS, VITALS_MAX_BATCH, VITALS_PATH, VitalReport } from '../../vitals';

/** Доля визитов, которые шлют метрики: 1 — все. Уменьшить, если логов станет слишком много. */
export const VITALS_SAMPLE_RATE = 1;
/** Ширина «телефона» — та же граница, что в стилях витрины. */
const MOBILE_QUERY = '(max-width: 640px)';

/** Шаблон маршрута без параметров: «product/:id», «c/:slug», «» — главная. Номера заказов и id в отчёт не попадают. */
export function routePattern(root: ActivatedRouteSnapshot): string {
  const parts: string[] = [];
  for (let r: ActivatedRouteSnapshot | null = root; r; r = r.firstChild) {
    const path = r.routeConfig?.path;
    if (path) parts.push(path);
  }
  return parts.join('/');
}

/** Метрика web-vitals → строка отчёта: мс целыми, CLS — четыре знака. */
export function toReport(m: Pick<Metric, 'name' | 'value' | 'rating' | 'navigationType' | 'id'>, route: string, net: VitalReport['net'], device: VitalReport['device']): VitalReport {
  const value = m.name === 'CLS' ? Math.round(m.value * 10_000) / 10_000 : Math.round(m.value);
  return { name: m.name, value, rating: m.rating, nav: m.navigationType, route, net, device, id: m.id };
}

/**
 * Core Web Vitals у живых покупателей: TTFB, FCP, LCP, INP, CLS.
 * Библиотека web-vitals грузится отдельным чанком после первой отрисовки — в начальную загрузку не входит.
 * Метрики копятся и уходят одним запросом, когда вкладку прячут или закрывают (sendBeacon переживает закрытие).
 * Маршрут — тот, с которого начался визит: так считает и Chrome (CrUX), INP и CLS копятся за всю жизнь страницы.
 */
@Injectable({ providedIn: 'root' })
export class WebVitals {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly doc = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  /** По id: повтор той же метрики заменяет прежнюю, а не дублирует. */
  private readonly queue = new Map<string, VitalReport>();
  private started = false;

  /** Один раз из AppComponent после первой отрисовки. */
  start(random: () => number = Math.random): void {
    if (this.started || !this.browser) return;
    this.started = true;
    if (random() >= VITALS_SAMPLE_RATE) return;
    const win = this.doc.defaultView;
    if (!win) return;

    let route = routePattern(this.router.routerState.snapshot.root);
    if (!this.router.navigated) {
      this.router.events.pipe(filter((e) => e instanceof NavigationEnd), take(1))
        .subscribe(() => (route = routePattern(this.router.routerState.snapshot.root)));
    }
    const effective = (win.navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType ?? '';
    const net = (VITAL_NETS as readonly string[]).includes(effective) ? (effective as VitalReport['net']) : '';
    const device: VitalReport['device'] = win.matchMedia?.(MOBILE_QUERY).matches ? 'mobile' : 'desktop';

    // Вне зоны Angular: метрики и отправка не должны будить обнаружение изменений
    this.zone.runOutsideAngular(() => {
      import('web-vitals').then(({ onTTFB, onFCP, onLCP, onINP, onCLS }) => {
        const add = (m: Metric) => { this.queue.set(m.id, toReport(m, route, net, device)); };
        onTTFB(add); onFCP(add); onLCP(add); onINP(add); onCLS(add);
        // После on*(): web-vitals дописывает итоговые INP и CLS на том же событии — наш обработчик (на window) срабатывает позже
        win.addEventListener('visibilitychange', () => { if (this.doc.visibilityState === 'hidden') this.flush(); });
        // Safari не всегда шлёт visibilitychange при закрытии вкладки
        win.addEventListener('pagehide', () => this.flush());
      }).catch(() => undefined);
    });
  }

  /** Отправить накопленное. Пустая очередь — запроса нет. */
  flush(): void {
    const win = this.doc.defaultView;
    if (!win || !this.queue.size) return;
    const all = [...this.queue.values()];
    this.queue.clear();
    for (let i = 0; i < all.length; i += VITALS_MAX_BATCH) {
      const body = JSON.stringify(all.slice(i, i + VITALS_MAX_BATCH));
      const sent = typeof win.navigator.sendBeacon === 'function' && win.navigator.sendBeacon(VITALS_PATH, body);
      if (!sent) win.fetch?.(VITALS_PATH, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => undefined);
    }
  }
}
