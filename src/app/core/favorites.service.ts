import { effect, inject, Injectable, signal } from '@angular/core';
import { BrowserStorage } from './browser-storage.service';

/** Избранное — id товаров в браузере. */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly store = inject(BrowserStorage);
  private readonly state = signal<string[]>(this.store.get<string[]>('harid.fav', []));
  readonly ids = this.state.asReadonly();
  constructor() { effect(() => this.store.set('harid.fav', this.state())); }
  has(id: string): boolean { return this.state().includes(id); }
  toggle(id: string): void { this.state.update((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id])); }
}
