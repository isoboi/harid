import { inject, Injectable, signal } from '@angular/core';
import { BrowserStorage } from './browser-storage.service';

const KEY = 'harid.fav';

/** Избранное — id товаров в браузере. Стартует пустым, данные — из hydrate(). */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly store = inject(BrowserStorage);
  private loaded = false;
  private readonly state = signal<string[]>([]);
  private readonly readyState = signal(false);
  readonly ready = this.readyState.asReadonly();
  readonly ids = this.state.asReadonly();

  /** Загрузка из localStorage один раз; нестроковые значения отбрасываются. */
  hydrate(): void {
    if (this.loaded) return;
    this.loaded = true;
    const saved = this.store.get<unknown>(KEY, []);
    this.state.set(Array.isArray(saved) ? saved.filter((x): x is string => typeof x === 'string') : []);
    this.readyState.set(true);
  }
  has(id: string): boolean { return this.state().includes(id); }
  toggle(id: string): void {
    this.hydrate();
    this.state.update((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
    this.store.set(KEY, this.state());
  }
}
