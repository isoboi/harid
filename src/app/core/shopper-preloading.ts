import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, NgZone, PLATFORM_ID } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { catchError, Observable, of, switchMap } from 'rxjs';

/** Сколько ждать простоя браузера, прежде чем всё равно начать предзагрузку. */
export const PRELOAD_IDLE_TIMEOUT_MS = 3000;

/**
 * Предзагрузка чанков страниц, куда покупатель скорее всего пойдёт дальше (маршруты с `data: { preload: true }`):
 * товар, лавка, категория, корзина… Переход на них — без ожидания загрузки кода.
 * Не трогает чат, продажу и личные разделы: трафик в мобильной сети дорогой, а туда заходят редко.
 * Только в браузере, когда он простаивает (после первой отрисовки), и не при «Экономии трафика» или 2G.
 */
@Injectable({ providedIn: 'root' })
export class ShopperPreloading implements PreloadingStrategy {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly zone = inject(NgZone);

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (!this.browser || route.data?.['preload'] !== true || slowNetwork()) return of(null);
    return this.idle().pipe(
      switchMap(() => load()),
      // Нет сети или вышла новая сборка — не беда: чанк загрузится при переходе
      catchError(() => of(null)),
    );
  }

  /** Срабатывает, когда браузер свободен. Таймер вне зоны: не держит приложение «нестабильным» (гидратация, service worker). */
  private idle(): Observable<void> {
    return new Observable<void>((sub) => {
      const done = () => this.zone.run(() => { sub.next(); sub.complete(); });
      return this.zone.runOutsideAngular(() => {
        if (typeof requestIdleCallback === 'function') {
          const id = requestIdleCallback(done, { timeout: PRELOAD_IDLE_TIMEOUT_MS });
          return () => cancelIdleCallback(id);
        }
        const id = setTimeout(done, PRELOAD_IDLE_TIMEOUT_MS);
        return () => clearTimeout(id);
      });
    });
  }
}

/** Человек бережёт трафик (Save-Data) или сеть 2G — лишнего не качаем. */
export function slowNetwork(): boolean {
  const c = (globalThis.navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } } | undefined)?.connection;
  return !!c && (c.saveData === true || /(^|-)2g$/.test(c.effectiveType ?? ''));
}
