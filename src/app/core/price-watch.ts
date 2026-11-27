/**
 * «Подешевело» в избранном: сравнение цены товара с той, по которой его отложили.
 * Метки хранятся в браузере (FavoritesService, ключ harid.fav.prices).
 */

/**
 * base — цена, когда товар добавили в избранное (null — цена была неизвестна: «по запросу» или избранное старше этой функции);
 * now — последняя известная цена; stock — в наличии ли;
 * seen — цена, по которой покупатель уже видел снижение (страница избранного): точка горит, только если стало ещё дешевле.
 */
export interface PriceMark { base: number | null; now: number | null; stock: boolean; seen?: number }

/** Меньше 5% — не повод звать обратно (копеечные правки цены). */
export const DROP_MIN = 0.05;

/** На сколько сомони подешевел с момента добавления; null — не подешевел, неизвестно или нет в наличии. */
export function dropOf(m: PriceMark | undefined): number | null {
  if (!m || !m.stock || m.base == null || m.now == null) return null;
  return m.now <= m.base * (1 - DROP_MIN) ? Math.round(m.base - m.now) : null;
}

/** Подешевел, а покупатель этого ещё не видел (или с тех пор стало ещё дешевле). */
export function isFreshDrop(m: PriceMark | undefined): boolean {
  return dropOf(m) !== null && (m!.seen === undefined || m!.now! < m!.seen);
}

const price = (v: unknown): v is number | null => v === null || (typeof v === 'number' && Number.isFinite(v));

/** Метки из localStorage: всё, что не похоже на PriceMark, отбрасывается. */
export function parseMarks(raw: unknown): Record<string, PriceMark> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, PriceMark> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const { base, now, stock, seen } = v as Record<string, unknown>;
    if (!price(base) || !price(now) || typeof stock !== 'boolean') continue;
    if (seen !== undefined && !(typeof seen === 'number' && Number.isFinite(seen))) continue;
    out[id] = seen === undefined ? { base, now, stock } : { base, now, stock, seen };
  }
  return out;
}
