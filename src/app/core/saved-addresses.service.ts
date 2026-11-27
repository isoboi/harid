import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { catchError, defer, EMPTY } from 'rxjs';
import { AuthService } from './auth.service';
import { BrowserStorage } from './browser-storage.service';
import { I18n } from './i18n';
import { MarketApi } from './market-api.service';
import { legacyRecipient, MAX_RECIPIENTS, mergeRecipients, parseRecipients, Recipient, recipientKey, recipientsFromOrders } from './saved-addresses';
import { ToastService } from './toast.service';

const KEY = 'harid.addresses';
/** Убранные получатели: из истории заказов их на сервере не удалить, поэтому скрываем по ключу. */
const HIDDEN_KEY = 'harid.addresses.hidden';
/** Старый формат: один адрес прошлого заказа. Только читается, при первой записи удаляется. */
const LEGACY_ADDRESS = 'harid.lastAddress';
const LEGACY_PHONE = 'harid.lastPhone';
export const HIDDEN_LIMIT = 50;

/**
 * Получатели для «Кому доставить»: свои — из заказов в этом браузере (свежие первыми),
 * у вошедшего покупателя дополняются получателями из истории заказов (GET /me/orders).
 * Перед каждой записью список перечитывается — вторая вкладка не затирает чужого получателя.
 */
@Injectable({ providedIn: 'root' })
export class SavedAddresses {
  private readonly store = inject(BrowserStorage);
  private readonly api = inject(MarketApi);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  private readonly i18n = inject(I18n);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly local = signal<Recipient[]>([]);
  private readonly hidden = signal<string[]>([]);
  /** История принадлежит токену: после выхода или входа другого покупателя на том же телефоне её не видно. */
  private readonly history = signal<{ token: string; items: Recipient[] } | null>(null);
  private requestedFor: string | null = null;

  readonly list = computed(() => {
    const h = this.history();
    const token = this.auth.token();
    const fromOrders = h && token && h.token === token ? h.items : [];
    return mergeRecipients([this.local(), fromOrders], new Set(this.hidden()));
  });

  /** Открыли оформление: свежий список из хранилища и, один раз на вход, получатели из истории. */
  load(): void {
    if (!this.browser) return;
    this.local.set(this.readLocal());
    this.hidden.set(this.readHidden());
    const token = this.auth.token();
    if (!token || this.requestedFor === token) return;
    this.requestedFor = token;
    // Нет истории — не беда: остаётся свой список, без сообщения
    defer(() => this.api.myOrders()).pipe(catchError(() => EMPTY)).subscribe((orders) => {
      this.history.set({ token, items: recipientsFromOrders(orders) });
    });
  }

  /** Заказ оформлен: получатель — первым, тот же получатель не дублируется, скрытие снимается. */
  remember(r: Recipient): void {
    const key = recipientKey(r);
    const list = [r, ...this.readLocal().filter((x) => recipientKey(x) !== key)].slice(0, MAX_RECIPIENTS);
    this.write(list, this.readHidden().filter((k) => k !== key));
  }

  /** «Убрать»: из своего списка удаляется, из истории — скрывается. Плашка «Вернуть» возвращает на прежнее место. */
  remove(r: Recipient): void {
    const key = recipientKey(r);
    const local = this.readLocal();
    const index = local.findIndex((x) => recipientKey(x) === key);
    const was = index >= 0 ? local[index] : null;
    const hidden = [...this.readHidden().filter((k) => k !== key), key].slice(-HIDDEN_LIMIT);
    this.write(local.filter((x) => recipientKey(x) !== key), hidden);
    this.toasts.show({
      text: this.i18n.t('Адрес удалён'),
      action: { label: this.i18n.t('Вернуть'), run: () => this.restore(key, index, was) },
    });
  }

  private restore(key: string, index: number, was: Recipient | null): void {
    let local = this.readLocal();
    if (was && !local.some((x) => recipientKey(x) === key)) {
      const at = Math.min(index, local.length);
      local = [...local.slice(0, at), was, ...local.slice(at)].slice(0, MAX_RECIPIENTS);
    }
    this.write(local, this.readHidden().filter((k) => k !== key));
  }

  /** Свой список; если его ещё нет — переносим старый адрес прошлого заказа. */
  private readLocal(): Recipient[] {
    const raw = this.store.get<unknown>(KEY, null);
    if (raw !== null) return parseRecipients(raw);
    const legacy = legacyRecipient(this.store.get<unknown>(LEGACY_ADDRESS, null), this.store.get<unknown>(LEGACY_PHONE, null));
    if (!legacy) return [];
    this.store.set(KEY, [legacy]);
    return [legacy];
  }

  private readHidden(): string[] {
    const raw = this.store.get<unknown>(HIDDEN_KEY, []);
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  }

  private write(local: Recipient[], hidden: string[]): void {
    this.local.set(local);
    this.hidden.set(hidden);
    this.store.set(KEY, local);
    this.store.set(HIDDEN_KEY, hidden);
    this.store.remove(LEGACY_ADDRESS);
    this.store.remove(LEGACY_PHONE);
  }
}
