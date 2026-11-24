import { inject, Injectable, signal } from '@angular/core';
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

/** Недавно просмотренные — снимки товаров в браузере, свежие первыми. Стартует пустым, данные — из hydrate(). */
@Injectable({ providedIn: 'root' })
export class RecentlyViewedService {
  private readonly store = inject(BrowserStorage);
  private loaded = false;
  private readonly state = signal<RecentItem[]>([]);
  private readonly readyState = signal(false);
  readonly ready = this.readyState.asReadonly();
  readonly items = this.state.asReadonly();

  /** Загрузка из localStorage один раз; битые записи отбрасываются. */
  hydrate(): void {
    if (this.loaded) return;
    this.loaded = true;
    const saved = this.store.get<unknown>(KEY, []);
    this.state.set(Array.isArray(saved) ? saved.filter(isRecentItem).slice(0, RECENT_LIMIT) : []);
    this.readyState.set(true);
  }

  /** Повторный просмотр поднимает товар в начало и обновляет снимок. */
  add(p: Product): void {
    this.hydrate();
    const snap: RecentItem = { id: p.id, shop_handle: p.shop_handle, title: p.title, price: p.price, old_price: p.old_price, image: p.images?.[0] ?? p.image, in_stock: p.in_stock };
    this.save([snap, ...this.state().filter((i) => i.id !== p.id)].slice(0, RECENT_LIMIT));
  }

  remove(id: string): void {
    this.hydrate();
    this.save(this.state().filter((i) => i.id !== id));
  }

  clear(): void {
    this.hydrate();
    this.state.set([]);
    this.store.remove(KEY);
  }

  private save(list: RecentItem[]): void {
    this.state.set(list);
    this.store.set(KEY, list);
  }
}
