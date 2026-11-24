import { inject, Injectable, signal } from '@angular/core';
import { BrowserStorage } from './browser-storage.service';
import { Haptics } from './haptics.service';

const KEY = 'harid.fav';

/** Избранное — id товаров в браузере. Стартует пустым, данные — из hydrate(). */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly store = inject(BrowserStorage);
  private readonly haptics = inject(Haptics);
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
  /** Добавление отзывается лёгкой вибрацией (сердечко на карточке, на странице товара, двойной тап по видео); удаление — молча. */
  toggle(id: string): void {
    this.hydrate();
    const adding = !this.state().includes(id);
    this.state.update((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
    this.store.set(KEY, this.state());
    if (adding) this.haptics.light();
  }
}
