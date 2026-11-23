import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, InjectionToken, PLATFORM_ID } from '@angular/core';
import { environment } from '../../environments/environment';

/** Номер счётчика Яндекс.Метрики. Пустой — аналитика выключена (локально и пока счётчик не заведён). */
export const ANALYTICS_ID = new InjectionToken<string>('ANALYTICS_ID', { providedIn: 'root', factory: () => environment.metrikaId });

/** Параметры события: только простые значения — ни телефонов, ни имён, ни адресов. */
export type EventParams = Record<string, string | number | boolean>;

type Ym = ((...args: unknown[]) => void) & { a?: IArguments[]; l?: number };
type MetrikaWindow = Window & { ym?: Ym };

const TAG_URL = 'https://mc.yandex.ru/metrika/tag.js';
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

/**
 * Адрес страницы для аналитики. В нём бывают токен заказа (/order/…?t=…) и телефон (?phone=…),
 * поэтому наружу уходит только путь без query и без номера заказа; остаются лишь UTM-метки — по ним видно источник.
 */
export function analyticsUrl(url: string): string {
  const [beforeHash] = url.split('#');
  const [rawPath, query = ''] = beforeHash.split('?');
  const path = rawPath.replace(/^\/order\/[^/]+/, '/order/:number').replace(/^\/chats\/(?!new(?:\/|$))[^/]+/, '/chats/:id');
  const params = new URLSearchParams(query);
  const kept = new URLSearchParams();
  for (const key of UTM_PARAMS) { const v = params.get(key); if (v) kept.set(key, v); }
  const q = kept.toString();
  return q ? `${path}?${q}` : path;
}

/**
 * Аналитика посетителей: просмотры страниц и события воронки (товар → корзина → оформление → заказ).
 * Только в браузере, только с номером счётчика и не при включённом «Не отслеживать».
 * Счётчик подключается по первому обращению, так что порядок «событие раньше инициализации» не важен.
 *
 * Автосбор Метрики (карта кликов, отслеживание ссылок, вебвизор) выключен: он отправляет адрес текущей страницы
 * как есть, а в адресе заказа лежит токен доступа к нему.
 */
@Injectable({ providedIn: 'root' })
export class Analytics {
  private readonly id = inject(ANALYTICS_ID);
  private readonly doc = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private started = false;
  private lastUrl: string | null = null;

  /** Просмотр страницы при переходе внутри приложения (SPA). */
  pageview(url: string, title?: string): void {
    const ym = this.start();
    if (!ym) return;
    const clean = analyticsUrl(url);
    const options: Record<string, string> = {};
    if (title) options['title'] = title;
    // Первый просмотр берёт referrer браузера; дальше источником служит предыдущая страница сайта
    if (this.lastUrl !== null) options['referrer'] = this.doc.location.origin + this.lastUrl;
    this.lastUrl = clean;
    ym(Number(this.id), 'hit', clean, options);
  }

  /** Событие воронки: view_product, add_to_cart, begin_checkout, purchase, share, seller_signup, direct_click. */
  track(name: string, params?: EventParams): void {
    this.start()?.(Number(this.id), 'reachGoal', name, params);
  }

  private start(): Ym | null {
    const win = this.doc.defaultView as MetrikaWindow | null;
    if (!this.browser || !win || !/^\d+$/.test(this.id)) return null;
    if (win.navigator?.doNotTrack === '1') return null;
    if (!this.started) {
      this.started = true;
      if (!win.ym) {
        const queue: IArguments[] = [];
        // Классическая заглушка Метрики: вызовы копятся, пока не загрузится tag.js
        win.ym = Object.assign(function () { queue.push(arguments); }, { a: queue, l: Date.now() }) as Ym;
      }
      const script = this.doc.createElement('script');
      script.async = true;
      script.src = TAG_URL;
      this.doc.head.appendChild(script);
      // defer: первый просмотр отправляем сами, с очищенным адресом
      win.ym(Number(this.id), 'init', { defer: true, clickmap: false, trackLinks: false, accurateTrackBounce: false, webvisor: false });
    }
    return win.ym ?? null;
  }
}
