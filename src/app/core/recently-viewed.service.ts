import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { BrowserStorage } from './browser-storage.service';
import { Product } from './models';

/** Снимок товара на момент просмотра: только то, что нужно карточке полосы. */
export type RecentItem = Pick<Product, 'id' | 'shop_handle' | 'title' | 'price' | 'old_price' | 'image' | 'in_stock'>;
export const RECENT_LIMIT = 12;
const KEY = 'harid.recent';

const numOrNull = (v: unknown) => v === null || typeof v === 'number';
/** Запись из хранилища годна, только если форма совпадает с RecentItem. */
const isRecentItem = (v: unknown): v is RecentItem => {
  if (!v || typeof v !== 'object') return false;
  const i = v as Record<string, unknown>;
  return typeof i['id'] === 'string' && typeof i['shop_handle'] === 'string' && typeof i['title'] === 'string'
    && numOrNull(i['price']) && numOrNull(i['old_price']) && typeof i['image'] === 'string' && typeof i['in_stock'] === 'boolean';
};

/** Годные записи из хранилища без повторов id (остаётся первая), не больше лимита. */
const clean = (saved: unknown): RecentItem[] => {
  if (!Array.isArray(saved)) return [];
  const seen = new Set<string>();
  return saved.filter((v): v is RecentItem => isRecentItem(v) && !seen.has(v.id) && !!seen.add(v.id)).slice(0, RECENT_LIMIT);
};

/**
 * Недавно просмотренные — снимки товаров в браузере, свежие первыми. Стартует пустым, данные — из hydrate().
 * Хранилище общее для всех вкладок: перед каждой записью список перечитывается, а событие storage
 * из другой вкладки обновляет его здесь — иначе старая вкладка затёрла бы новые просмотры и очистку.
 */
@Injectable({ providedIn: 'root' })
export class RecentlyViewedService {
  private readonly store = inject(BrowserStorage);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  private loaded = false;
  private readonly state = signal<RecentItem[]>([]);
  private readonly readyState = signal(false);
  readonly ready = this.readyState.asReadonly();
  readonly items = this.state.asReadonly();

  /** Загрузка из localStorage один раз; битые записи и повторы отбрасываются. */
  hydrate(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.state.set(this.read());
    this.readyState.set(true);
    if (!this.browser) return;
    // key === null — другая вкладка очистила всё хранилище
    const onStorage = (e: StorageEvent) => { if (e.key === KEY || e.key === null) this.state.set(this.read()); };
    window.addEventListener('storage', onStorage);
    this.destroyRef.onDestroy(() => window.removeEventListener('storage', onStorage));
  }

  /** Повторный просмотр поднимает товар в начало и обновляет снимок. */
  add(p: Product): void {
    this.hydrate();
    // Поля нормализуются: запись, не прошедшая проверку, пропала бы после перезагрузки
    const snap: RecentItem = {
      id: p.id, shop_handle: p.shop_handle, title: p.title ?? '', price: p.price ?? null, old_price: p.old_price ?? null,
      image: p.images?.[0] ?? p.image ?? '', in_stock: p.in_stock === true,
    };
    this.save([snap, ...this.read().filter((i) => i.id !== p.id)].slice(0, RECENT_LIMIT));
  }

  remove(id: string): void {
    this.hydrate();
    const current = this.read();
    const next = current.filter((i) => i.id !== id);
    if (next.length === current.length) { this.state.set(current); return; }
    this.save(next);
  }

  clear(): void {
    this.hydrate();
    this.state.set([]);
    this.store.remove(KEY);
  }

  private read(): RecentItem[] { return clean(this.store.get<unknown>(KEY, [])); }

  private save(list: RecentItem[]): void {
    this.state.set(list);
    this.store.set(KEY, list);
  }
}
