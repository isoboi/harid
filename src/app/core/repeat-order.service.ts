import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, forkJoin, map, Observable, of, tap } from 'rxjs';
import { CartService } from './cart.service';
import { directOnly } from './direct';
import { I18n, I18nLike, RU } from './i18n';
import { MarketApi } from './market-api.service';
import { Order, OrderLine, Product } from './models';
import { ToastService } from './toast.service';

/**
 * Итог повтора. added, total и overflow — в штуках, как «3 товара» в шапке заказа и значок корзины:
 * иначе заказ «3 товара» из одной позиции дал бы «Добавили 1 товар».
 */
export interface RepeatResult { added: number; total: number; unavailable: string[]; overflow: number; offline: boolean }

/** Ответ по одному товару: сам товар или ошибка запроса. */
type Fetched = { p: Product } | { err: unknown };

/** Названия недоступных: до двух в кавычках, остальные — числом. */
function names(list: string[], i18n: I18nLike): string {
  const shown = list.slice(0, 2).map((t) => `«${t}»`).join(', ');
  return list.length > 2 ? i18n.t('{shown} и ещё {n}', { shown, n: list.length - 2 }) : shown;
}

/** Текст тоста по итогу повтора. Ничего не добавлено — ошибка, иначе подтверждение. */
export function repeatMessage(r: RepeatResult, i18n: I18nLike = RU): { text: string; kind: 'info' | 'error' } {
  if (r.added === 0) {
    if (r.overflow > 0) return { text: i18n.t('В корзине уже 30 позиций — оформите заказ или уберите лишнее'), kind: 'error' };
    if (r.offline) return { text: i18n.t('Не удалось повторить заказ. Проверьте интернет и попробуйте ещё раз'), kind: 'error' };
    return { text: i18n.t('Товаров из этого заказа сейчас нет в наличии'), kind: 'error' };
  }
  if (r.added === r.total) {
    return { text: i18n.t('Добавили в корзину {n} {items}', { n: r.added, items: i18n.plural(r.added, ['товар', 'товара', 'товаров']) }), kind: 'info' };
  }
  const parts = [i18n.t('Добавили {added} из {total}', { added: r.added, total: r.total })];
  if (r.unavailable.length) parts.push(i18n.t('Нет в наличии: {names}', { names: names(r.unavailable, i18n) }));
  if (r.overflow) parts.push(i18n.t('Корзина заполнена — не поместилось {n}', { n: r.overflow }));
  return { text: parts.join('. '), kind: 'info' };
}

/**
 * Размер, с которым позицию можно положить в корзину, или undefined — позиция недоступна.
 * Размер из заказа должен остаться у товара. Без размера: один размер у товара — берём его,
 * несколько — выбирать за покупателя нельзя.
 */
function sizeFor(line: OrderLine, p: Product): string | null | undefined {
  // Размеров у товара больше нет — старый размер не отправляем, бэкенд мог бы его отклонить
  if (!p.sizes.length) return null;
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
  private readonly i18n = inject(I18n);

  repeat(order: Order): Observable<RepeatResult> {
    const ids = [...new Set(order.lines.map((l) => l.product_id))];
    // Ошибка одного товара не роняет остальные — он просто недоступен
    const fetched$: Observable<Fetched[]> = ids.length
      ? forkJoin(ids.map((id) => this.api.product(id).pipe(map((p): Fetched => ({ p })), catchError((err) => of<Fetched>({ err })))))
      : of([]);
    return fetched$.pipe(
      map((list) => this.apply(order, new Map(ids.map((id, i) => [id, list[i]])))),
      tap((r) => {
        this.toasts.show(repeatMessage(r, this.i18n));
        if (r.added > 0) void this.router.navigateByUrl('/cart');
      }),
    );
  }

  private apply(order: Order, byId: Map<string, Fetched>): RepeatResult {
    const r: RepeatResult = { added: 0, total: order.lines.reduce((n, l) => n + l.qty, 0), unavailable: [], overflow: 0, offline: false };
    for (const line of order.lines) {
      const f = byId.get(line.product_id);
      const p = f && 'p' in f ? f.p : null;
      const size = p ? sizeFor(line, p) : undefined;
      if (!p || !p.in_stock || directOnly(p) || p.price === null || size === undefined) { r.unavailable.push(line.title); continue; }
      if (this.cart.add(p, size, line.qty)) r.added += line.qty;
      else r.overflow += line.qty;
    }
    // «Нет интернета» — только если не пришёл ни один товар и ни одна ошибка не говорит «товара нет»
    const results = [...byId.values()];
    r.offline = r.added === 0 && results.length > 0 && results.every((f) => 'err' in f && !isGone(f.err));
    return r;
  }
}

/** 404/400 — товара нет (или id отклонён), а не сбой сети. */
const isGone = (e: unknown) => e instanceof HttpErrorResponse && (e.status === 404 || e.status === 400);
