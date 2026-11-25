import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, forkJoin, map, Observable, of, tap } from 'rxjs';
import { plural } from '../shared/plural';
import { CartService } from './cart.service';
import { directOnly } from './direct';
import { MarketApi } from './market-api.service';
import { Order, OrderLine, Product } from './models';
import { ToastService } from './toast.service';

/** Итог повтора: сколько позиций добавлено из скольких, что недоступно и что не влезло в корзину. */
export interface RepeatResult { added: number; total: number; unavailable: string[]; overflow: number; offline: boolean }

/** Ответ по одному товару: сам товар или ошибка запроса. */
type Fetched = { p: Product } | { err: unknown };

/** Названия недоступных: до двух в кавычках, остальные — числом. */
function names(list: string[]): string {
  const shown = list.slice(0, 2).map((t) => `«${t}»`).join(', ');
  return list.length > 2 ? `${shown} и ещё ${list.length - 2}` : shown;
}

/** Текст тоста по итогу повтора. Ничего не добавлено — ошибка, иначе подтверждение. */
export function repeatMessage(r: RepeatResult): { text: string; kind: 'info' | 'error' } {
  if (r.added === 0) {
    if (r.overflow > 0) return { text: 'В корзине уже 30 позиций — оформите заказ или уберите лишнее', kind: 'error' };
    if (r.offline) return { text: 'Не удалось повторить заказ. Проверьте интернет и попробуйте ещё раз', kind: 'error' };
    return { text: 'Товаров из этого заказа сейчас нет в наличии', kind: 'error' };
  }
  if (r.added === r.total) return { text: `Добавили в корзину ${r.added} ${plural(r.added, ['товар', 'товара', 'товаров'])}`, kind: 'info' };
  const parts = [`Добавили ${r.added} из ${r.total}`];
  if (r.unavailable.length) parts.push(`Нет в наличии: ${names(r.unavailable)}`);
  if (r.overflow) parts.push(`Корзина заполнена — не поместилось ${r.overflow}`);
  return { text: parts.join('. '), kind: 'info' };
}

/**
 * Размер, с которым позицию можно положить в корзину, или undefined — позиция недоступна.
 * Размер из заказа должен остаться у товара. Без размера: один размер у товара — берём его,
 * несколько — выбирать за покупателя нельзя.
 */
function sizeFor(line: OrderLine, p: Product): string | null | undefined {
  if (!p.sizes.length) return line.size;
  if (line.size) return p.sizes.includes(line.size) ? line.size : undefined;
  return p.sizes.length === 1 ? p.sizes[0] : undefined;
}

/**
 * «Повторить заказ»: товары запрашиваются заново (цена и наличие — текущие), доступные
 * добавляются к корзине, покупатель видит итог тостом и попадает в корзину.
 */
@Injectable({ providedIn: 'root' })
export class RepeatOrderService {
  private readonly api = inject(MarketApi);
  private readonly cart = inject(CartService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  repeat(order: Order): Observable<RepeatResult> {
    const ids = [...new Set(order.lines.map((l) => l.product_id))];
    // Ошибка одного товара не роняет остальные — он просто недоступен
    const fetched$: Observable<Fetched[]> = ids.length
      ? forkJoin(ids.map((id) => this.api.product(id).pipe(map((p): Fetched => ({ p })), catchError((err) => of<Fetched>({ err })))))
      : of([]);
    return fetched$.pipe(
      map((list) => this.apply(order, new Map(ids.map((id, i) => [id, list[i]])))),
      tap((r) => {
        this.toasts.show(repeatMessage(r));
        if (r.added > 0) void this.router.navigateByUrl('/cart');
      }),
    );
  }

  private apply(order: Order, byId: Map<string, Fetched>): RepeatResult {
    const r: RepeatResult = { added: 0, total: order.lines.length, unavailable: [], overflow: 0, offline: false };
    for (const line of order.lines) {
      const f = byId.get(line.product_id);
      const p = f && 'p' in f ? f.p : null;
      const size = p ? sizeFor(line, p) : undefined;
      if (!p || !p.in_stock || directOnly(p) || p.price === null || size === undefined) { r.unavailable.push(line.title); continue; }
      if (this.cart.add(p, size, line.qty)) r.added++;
      else r.overflow++;
    }
    // «Нет интернета» — только если не пришёл ни один товар и ни одна ошибка не говорит «товара нет»
    const results = [...byId.values()];
    r.offline = r.added === 0 && results.length > 0 && results.every((f) => 'err' in f && !isGone(f.err));
    return r;
  }
}

/** 404/400 — товара нет (или id отклонён), а не сбой сети. */
const isGone = (e: unknown) => e instanceof HttpErrorResponse && (e.status === 404 || e.status === 400);
