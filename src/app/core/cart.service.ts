import { computed, inject, Injectable, signal } from '@angular/core';
import { BrowserStorage } from './browser-storage.service';
import { deliveryFor } from './checkout-options';
import { OrderLineInput, Product } from './models';

export interface CartItem { product: Product; size: string | null; qty: number }
export interface CartGroup { shop_handle: string; items: CartItem[]; subtotal: number }

/** Лимиты бэкенда: qty строки 1..20, строк в заказе не больше 30. */
export const MAX_QTY = 20;
export const MAX_LINES = 30;
const KEY = 'harid.cart';
const same = (i: CartItem, id: string, size: string | null) => i.product.id === id && i.size === size;

/** Строка из хранилища годна, только если форма совпадает с CartItem. */
const isCartItem = (v: unknown): v is CartItem => {
  if (!v || typeof v !== 'object') return false;
  const i = v as Record<string, unknown>;
  const p = i['product'] as Record<string, unknown> | null;
  return !!p && typeof p === 'object' && typeof p['id'] === 'string' && typeof p['shop_handle'] === 'string' && typeof p['price'] === 'number'
    && Number.isInteger(i['qty']) && (i['qty'] as number) > 0
    && (i['size'] === null || typeof i['size'] === 'string');
};

/** Корзина: строки по товару и варианту; доставка — за каждую лавку. Стартует пустой, данные — из hydrate(). */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly store = inject(BrowserStorage);
  private loaded = false;
  private readonly state = signal<CartItem[]>([]);
  private readonly readyState = signal(false);
  readonly ready = this.readyState.asReadonly();
  readonly items = this.state.asReadonly();
  readonly count = computed(() => this.state().reduce((n, i) => n + i.qty, 0));
  readonly groups = computed<CartGroup[]>(() => {
    const map = new Map<string, CartItem[]>();
    for (const i of this.state()) map.set(i.product.shop_handle, [...(map.get(i.product.shop_handle) ?? []), i]);
    return [...map].map(([shop_handle, items]) => ({ shop_handle, items, subtotal: items.reduce((s, i) => s + i.product.price * i.qty, 0) }));
  });
  readonly itemsTotal = computed(() => this.groups().reduce((s, g) => s + g.subtotal, 0));

  /** Загрузка из localStorage один раз; невалидные строки отбрасываются. */
  hydrate(): void {
    if (this.loaded) return;
    this.loaded = true;
    const saved = this.store.get<unknown>(KEY, []);
    this.state.set(Array.isArray(saved) ? saved.filter(isCartItem) : []);
    this.readyState.set(true);
  }

  /** false — корзина уже на лимите строк, новая не добавлена. Количество строки режется до MAX_QTY. */
  add(product: Product, size: string | null, qty = 1): boolean {
    this.hydrate();
    const list = this.state();
    const exists = list.some((i) => same(i, product.id, size));
    if (!exists && list.length >= MAX_LINES) return false;
    this.state.set(exists
      ? list.map((i) => (same(i, product.id, size) ? { ...i, qty: Math.min(MAX_QTY, i.qty + qty), product } : i))
      : [...list, { product, size, qty: Math.min(MAX_QTY, qty) }]);
    this.save();
    return true;
  }
  setQty(id: string, size: string | null, qty: number): void {
    this.hydrate();
    if (qty <= 0) return this.remove(id, size);
    const next = Math.min(MAX_QTY, qty);
    this.state.update((list) => list.map((i) => (same(i, id, size) ? { ...i, qty: next } : i)));
    this.save();
  }
  remove(id: string, size: string | null): void {
    this.hydrate();
    this.state.update((list) => list.filter((i) => !same(i, id, size)));
    this.save();
  }
  clear(): void { this.hydrate(); this.state.set([]); this.save(); }
  deliveryTotal(district: string): number { return this.groups().length * deliveryFor(district); }
  toOrderLines(): OrderLineInput[] {
    return this.state().map((i) => ({ product_id: Number(i.product.id), ...(i.size ? { size: i.size } : {}), qty: i.qty }));
  }

  private save(): void { this.store.set(KEY, this.state()); }
}
