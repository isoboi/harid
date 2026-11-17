import { computed, inject, Injectable, signal } from '@angular/core';
import { BrowserStorage } from './browser-storage.service';
import { deliveryFor } from './checkout-options';
import { OrderLineInput, Product } from './models';

export interface CartItem { product: Product; size: string | null; qty: number }
export interface CartGroup { shop_handle: string; items: CartItem[]; subtotal: number }

const KEY = 'harid.cart';
const same = (i: CartItem, id: string, size: string | null) => i.product.id === id && i.size === size;

/** Корзина: строки по товару и варианту; доставка — за каждую лавку. Стартует пустой, данные — из hydrate(). */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly store = inject(BrowserStorage);
  private loaded = false;
  private readonly state = signal<CartItem[]>([]);
  readonly items = this.state.asReadonly();
  readonly count = computed(() => this.state().reduce((n, i) => n + i.qty, 0));
  readonly groups = computed<CartGroup[]>(() => {
    const map = new Map<string, CartItem[]>();
    for (const i of this.state()) map.set(i.product.shop_handle, [...(map.get(i.product.shop_handle) ?? []), i]);
    return [...map].map(([shop_handle, items]) => ({ shop_handle, items, subtotal: items.reduce((s, i) => s + i.product.price * i.qty, 0) }));
  });
  readonly itemsTotal = computed(() => this.groups().reduce((s, g) => s + g.subtotal, 0));

  /** Загрузка из localStorage один раз; вызывается после гидратации. */
  hydrate(): void {
    if (this.loaded) return;
    this.loaded = true;
    const saved = this.store.get<unknown>(KEY, []);
    this.state.set(Array.isArray(saved) ? (saved as CartItem[]) : []);
  }

  add(product: Product, size: string | null, qty = 1): void {
    this.state.update((list) => list.some((i) => same(i, product.id, size))
      ? list.map((i) => (same(i, product.id, size) ? { ...i, qty: i.qty + qty, product } : i))
      : [...list, { product, size, qty }]);
    this.save();
  }
  setQty(id: string, size: string | null, qty: number): void {
    if (qty <= 0) return this.remove(id, size);
    this.state.update((list) => list.map((i) => (same(i, id, size) ? { ...i, qty } : i)));
    this.save();
  }
  remove(id: string, size: string | null): void {
    this.state.update((list) => list.filter((i) => !same(i, id, size)));
    this.save();
  }
  clear(): void { this.state.set([]); this.save(); }
  deliveryTotal(district: string): number { return this.groups().length * deliveryFor(district); }
  toOrderLines(): OrderLineInput[] {
    return this.state().map((i) => ({ product_id: Number(i.product.id), ...(i.size ? { size: i.size } : {}), qty: i.qty }));
  }

  private save(): void { this.store.set(KEY, this.state()); }
}
