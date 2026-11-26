import { computed, inject, Injectable, signal } from '@angular/core';
import { BrowserStorage } from './browser-storage.service';
import { Buyer, VerifyResult } from './models';

/** Покупатель в хранилище годен, если это объект (не массив) с числовым id. */
const isBuyer = (v: unknown): v is Buyer => !!v && typeof v === 'object' && !Array.isArray(v) && typeof (v as Buyer).id === 'number';

/** Сессия покупателя: токен и профиль в браузере. Стартует без сессии, данные — из hydrate(). */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly store = inject(BrowserStorage);
  private loaded = false;
  readonly token = signal<string | null>(null);
  readonly buyer = signal<Buyer | null>(null);
  private readonly readyState = signal(false);
  readonly ready = this.readyState.asReadonly();
  readonly loggedIn = computed(() => !!this.token());

  /** Загрузка из localStorage один раз. */
  hydrate(): void {
    if (this.loaded) return;
    this.loaded = true;
    const token = this.store.get<unknown>('harid.token', null);
    const buyer = this.store.get<unknown>('harid.buyer', null);
    this.token.set(typeof token === 'string' && token ? token : null);
    this.buyer.set(isBuyer(buyer) ? buyer : null);
    this.readyState.set(true);
  }
  setSession(r: VerifyResult): void {
    this.hydrate();
    this.token.set(r.token); this.buyer.set(r.buyer);
    this.store.set('harid.token', r.token); this.store.set('harid.buyer', r.buyer);
  }
  /** Обновлённый профиль (после PATCH /market/me): токен не меняется. */
  setBuyer(b: Buyer): void {
    this.hydrate();
    this.buyer.set(b);
    this.store.set('harid.buyer', b);
  }
  logout(): void {
    this.hydrate();
    this.token.set(null); this.buyer.set(null);
    this.store.remove('harid.token'); this.store.remove('harid.buyer');
  }
}
