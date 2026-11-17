import { computed, inject, Injectable, signal } from '@angular/core';
import { BrowserStorage } from './browser-storage.service';
import { Buyer, VerifyResult } from './models';

/** Сессия покупателя: токен и профиль в браузере. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly store = inject(BrowserStorage);
  readonly token = signal<string | null>(this.store.get<string | null>('harid.token', null));
  readonly buyer = signal<Buyer | null>(this.store.get<Buyer | null>('harid.buyer', null));
  readonly loggedIn = computed(() => !!this.token());
  setSession(r: VerifyResult): void {
    this.token.set(r.token); this.buyer.set(r.buyer);
    this.store.set('harid.token', r.token); this.store.set('harid.buyer', r.buyer);
  }
  logout(): void {
    this.token.set(null); this.buyer.set(null);
    this.store.remove('harid.token'); this.store.remove('harid.buyer');
  }
}
