import { inject, Injectable } from '@angular/core';
import { catchError, Observable, of, shareReplay } from 'rxjs';
import { FEED_LIMIT } from './feed';
import { MarketApi } from './market-api.service';
import { Product } from './models';

/** Как долго в браузере держим ленту: главная, категории и каталог не запрашивают её заново при каждом переходе. */
export const FEED_TTL_MS = 60_000;

/**
 * Свежие товары (до FEED_LIMIT) для главной, чипов категорий и каталога. Один общий запрос.
 * На сервере экземпляр свой на каждый запрос страницы, так что кэш не переживает рендер.
 */
@Injectable({ providedIn: 'root' })
export class CatalogFeed {
  private readonly api = inject(MarketApi);
  private cache: { at: number; list$: Observable<Product[] | null> } | null = null;

  /** null — не загрузилось: страницы показывают всё как есть, без скрытия и сортировки. */
  products(): Observable<Product[] | null> {
    const now = Date.now();
    if (!this.cache || now - this.cache.at >= FEED_TTL_MS) {
      this.cache = { at: now, list$: this.api.products({ limit: FEED_LIMIT }).pipe(catchError(() => of(null)), shareReplay(1)) };
    }
    return this.cache.list$;
  }
}
