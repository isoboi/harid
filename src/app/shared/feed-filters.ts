import { ParamMap } from '@angular/router';
import { FeedFilters, ProductSort } from '../core/models';

export const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'new', label: 'Сначала новые' },
  { value: 'price_asc', label: 'Сначала дешевле' },
  { value: 'price_desc', label: 'Сначала дороже' },
];

/** Имена query-параметров фильтров — те же, что у API. */
export const FILTER_PARAMS = ['sort', 'price_min', 'price_max', 'size', 'in_stock'] as const;

const SORTS = new Set<string>(SORT_OPTIONS.map((o) => o.value));

/** Целое ≥ 0 из строки; всё остальное — «не задано». */
function price(v: string | null): number | undefined {
  if (v === null || !/^\d{1,7}$/.test(v.trim())) return undefined;
  return Number(v.trim());
}

/**
 * Фильтры из адреса. Мусор (?sort=abc, ?price_min=-5) молча отбрасывается —
 * ссылку руками правят, ошибка 400 из-за неё была бы хуже пустого фильтра.
 * «new» — значение по умолчанию, в фильтры не попадает.
 */
export function parseFeedFilters(params: ParamMap): FeedFilters {
  const f: FeedFilters = {};
  const sort = params.get('sort');
  if (sort && sort !== 'new' && SORTS.has(sort)) f.sort = sort as ProductSort;
  let min = price(params.get('price_min'));
  let max = price(params.get('price_max'));
  // «от 500 до 100» — пользователь перепутал поля; меняем местами
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
  if (min !== undefined) f.price_min = min;
  if (max !== undefined) f.price_max = max;
  const size = params.get('size')?.trim();
  if (size && size.length <= 30) f.size = size;
  if (params.get('in_stock') === '1' || params.get('in_stock') === 'true') f.in_stock = true;
  return f;
}

/** Фильтры → query-параметры адреса; null убирает параметр (queryParamsHandling: 'merge'). */
export function filtersToParams(f: FeedFilters): Record<(typeof FILTER_PARAMS)[number], string | null> {
  return {
    sort: f.sort && f.sort !== 'new' ? f.sort : null,
    price_min: f.price_min !== undefined ? String(f.price_min) : null,
    price_max: f.price_max !== undefined ? String(f.price_max) : null,
    size: f.size || null,
    in_stock: f.in_stock ? '1' : null,
  };
}

/** Сколько фильтров включено (без сортировки) — для значка на кнопке и «Сбросить». */
export function activeFilterCount(f: FeedFilters): number {
  return (f.price_min !== undefined || f.price_max !== undefined ? 1 : 0) + (f.size ? 1 : 0) + (f.in_stock ? 1 : 0);
}
