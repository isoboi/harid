import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { BrowserStorage } from './browser-storage.service';

export const RECENT_SEARCHES_LIMIT = 8;
/** Длиннее — уже не запрос, а вставленный текст: в историю не берём. */
export const RECENT_SEARCH_MAX_LENGTH = 100;
const KEY = 'harid.searches';

/** Пробелы схлопнуты, края обрезаны — «  платье   красное » и «платье красное» один запрос. */
export const normalizeQuery = (q: string): string => q.replace(/\s+/g, ' ').trim();
/** Повтор ищем без учёта регистра: «Платье» и «платье» — одно и то же. */
const same = (a: string, b: string) => a.toLocaleLowerCase('ru') === b.toLocaleLowerCase('ru');

/** Годные строки из хранилища без повторов (остаётся первая, то есть самая свежая), не больше лимита. */
const clean = (saved: unknown): string[] => {
  if (!Array.isArray(saved)) return [];
  const out: string[] = [];
  for (const v of saved) {
    if (typeof v !== 'string') continue;
    const q = normalizeQuery(v);
    if (q && q.length <= RECENT_SEARCH_MAX_LENGTH && !out.some((o) => same(o, q))) out.push(q);
    if (out.length === RECENT_SEARCHES_LIMIT) break;
  }
  return out;
};

/**
 * Недавние запросы поиска — только в этом браузере, на сервер не уходят. Свежие первыми.
 * Как и «Недавно просмотренные»: перед записью список перечитывается, а событие storage из другой
 * вкладки обновляет его здесь, чтобы старая вкладка не затёрла новые запросы или очистку.
 */
@Injectable({ providedIn: 'root' })
export class RecentSearchesService {
  private readonly store = inject(BrowserStorage);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  private loaded = false;
  private readonly state = signal<string[]>([]);
  readonly items = this.state.asReadonly();

  /** Загрузка из localStorage один раз, при первом обращении. */
  hydrate(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.state.set(this.read());
    if (!this.browser) return;
    // key === null — другая вкладка очистила всё хранилище
    const onStorage = (e: StorageEvent) => { if (e.key === KEY || e.key === null) this.state.set(this.read()); };
    window.addEventListener('storage', onStorage);
    this.destroyRef.onDestroy(() => window.removeEventListener('storage', onStorage));
  }

  /** Повторный запрос поднимается в начало; написание берётся последнее. */
  add(query: string): void {
    this.hydrate();
    const q = normalizeQuery(query);
    if (!q || q.length > RECENT_SEARCH_MAX_LENGTH) return;
    this.save([q, ...this.read().filter((o) => !same(o, q))].slice(0, RECENT_SEARCHES_LIMIT));
  }

  remove(query: string): void {
    this.hydrate();
    this.save(this.read().filter((o) => !same(o, query)));
  }

  clear(): void {
    this.hydrate();
    this.state.set([]);
    this.store.remove(KEY);
  }

  private read(): string[] { return clean(this.store.get<unknown>(KEY, [])); }

  private save(list: string[]): void {
    this.state.set(list);
    if (list.length) this.store.set(KEY, list);
    else this.store.remove(KEY);
  }
}
