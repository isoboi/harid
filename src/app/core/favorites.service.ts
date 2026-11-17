import { inject, Injectable, signal } from '@angular/core';
import { BrowserStorage } from './browser-storage.service';

const KEY = 'harid.fav';

/** Избранное — id товаров в браузере. Стартует пустым, данные — из hydrate(). */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly store = inject(BrowserStorage);
  private loaded = false;
  private readonly state = signal<string[]>([]);
  readonly ids = this.state.asReadonly();

  /** Загрузка из localStorage один раз; вызывается после гидратации. */
  hydrate(): void {
    if (this.loaded) return;
    this.loaded = true;
    const saved = this.store.get<unknown>(KEY, []);
    this.state.set(Array.isArray(saved) ? (saved as string[]) : []);
  }
  has(id: string): boolean { return this.state().includes(id); }
  toggle(id: string): void {
    this.state.update((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
    this.store.set(KEY, this.state());
  }
}
