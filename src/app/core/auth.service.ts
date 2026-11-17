import { computed, inject, Injectable, signal } from '@angular/core';
import { BrowserStorage } from './browser-storage.service';
import { Buyer, VerifyResult } from './models';

/** Сессия покупателя: токен и профиль в браузере. Стартует без сессии, данные — из hydrate(). */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly store = inject(BrowserStorage);
  private loaded = false;
  readonly token = signal<string | null>(null);
  readonly buyer = signal<Buyer | null>(null);
  readonly loggedIn = computed(() => !!this.token());

  /** Загрузка из localStorage один раз; вызывается после гидратации. */
  hydrate(): void {
    if (this.loaded) return;
    this.loaded = true;
    const token = this.store.get<unknown>('harid.token', null);
    const buyer = this.store.get<unknown>('harid.buyer', null);
    this.token.set(typeof token === 'string' && token ? token : null);
    this.buyer.set(buyer && typeof buyer === 'object' ? (buyer as Buyer) : null);
  }
  setSession(r: VerifyResult): void {
    this.token.set(r.token); this.buyer.set(r.buyer);
    this.store.set('harid.token', r.token); this.store.set('harid.buyer', r.buyer);
  }
  logout(): void {
    this.token.set(null); this.buyer.set(null);
    this.store.remove('harid.token'); this.store.remove('harid.buyer');
  }
}
