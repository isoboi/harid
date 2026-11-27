import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { catchError, EMPTY, from, ignoreElements, map, mergeMap, Observable, tap } from 'rxjs';
import { BrowserStorage } from './browser-storage.service';
import { CLOCK } from './clock';
import { FavoritesService } from './favorites.service';
import { MarketApi } from './market-api.service';

/** Не чаще раза в 6 часов: цены в лавках меняются не каждый час, а мобильный трафик дорогой. */
export const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
/** Последние 30 добавленных: давно отложенное реже покупают, а запрос — на каждый товар. */
export const CHECK_LIMIT = 30;
/** Одновременно не больше 4 запросов — не забиваем канал, пока покупатель листает. */
export const CHECK_CONCURRENCY = 4;
const CHECKED_KEY = 'harid.fav.checkedAt';
/** Без requestIdleCallback (Safari) — через 2 с после первой отрисовки. */
const IDLE_FALLBACK_MS = 2000;

/**
 * «Подешевело» с любой страницы: в простое браузера тихо запрашивает цены товаров из избранного
 * и отдаёт их FavoritesService.observe — та зажигает точку на вкладке «Избранное».
 * Пакетного запроса по списку id в API нет, поэтому /products/:id на каждый товар с лимитами выше.
 */
@Injectable({ providedIn: 'root' })
export class PriceCheckService {
  private readonly api = inject(MarketApi);
  private readonly fav = inject(FavoritesService);
  private readonly store = inject(BrowserStorage);
  private readonly clock = inject(CLOCK);
  private readonly win = inject(DOCUMENT).defaultView;
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private started = false;

  /** Один раз за запуск приложения, только в браузере, когда браузер свободен. */
  start(): void {
    if (!this.browser || this.started) return;
    this.started = true;
    const go = () => { this.run().subscribe(); };
    if (typeof this.win?.requestIdleCallback === 'function') this.win.requestIdleCallback(go, { timeout: 10_000 });
    else setTimeout(go, IDLE_FALLBACK_MS);
  }

  /** Сама проверка, без ожидания простоя. Ошибка по товару (снят с продажи, сеть) его просто пропускает. */
  run(): Observable<void> {
    this.fav.hydrate();
    const ids = this.fav.ids().slice(-CHECK_LIMIT);
    if (!ids.length || !this.networkOk() || !this.due()) return EMPTY;
    return from(ids).pipe(
      mergeMap((id) => this.api.product(id).pipe(map((p) => ({ id, p })), catchError(() => EMPTY)), CHECK_CONCURRENCY),
      tap({ next: ({ id, p }) => this.fav.observe(id, p), complete: () => this.store.set(CHECKED_KEY, this.clock().getTime()) }),
      ignoreElements(),
    );
  }

  /** Прошло 6 часов с прошлой проверки; время из будущего (сбились часы) — тоже пора. */
  private due(): boolean {
    const last = this.store.get<unknown>(CHECKED_KEY, null);
    const now = this.clock().getTime();
    return typeof last !== 'number' || last > now || now - last >= CHECK_EVERY_MS;
  }

  /** Без сети и в режиме экономии трафика — не проверяем. */
  private networkOk(): boolean {
    const nav = this.win?.navigator as (Navigator & { connection?: { saveData?: boolean } }) | undefined;
    return nav?.onLine !== false && !nav?.connection?.saveData;
  }
}
