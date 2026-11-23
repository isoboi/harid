import { directOnly } from './direct';
import { Category, Product } from './models';

/** Предел API на один запрос товаров (ProductListDto: limit ≤ 100, постраничной выдачи нет). */
export const FEED_LIMIT = 100;

/** Сколько товаров показывает главная. */
export const FEED_SHOWN = 24;

/**
 * Название не годится для карточки: «!», «@ник», одни эмодзи или цифры.
 * Такие заголовки получаются из подписи к посту, которая сама не описывает товар.
 * Больше витрина понять не может: смысл «это не товар» (адрес, шутка, анонс) определяет бэкенд при импорте.
 */
export function isBrokenTitle(title: string): boolean {
  const t = title.trim();
  if (t.startsWith('@')) return true;
  return (t.match(/\p{L}/gu) ?? []).length < 2;
}

/** Товар можно заказать на Хариде: лавка подключена, есть цена и он в наличии. У лавки без подключения заказ только через Direct. */
export function isOrderable(p: Product): boolean {
  return !directOnly(p) && p.price !== null && p.in_stock;
}

/** 0 — заказ на Хариде, 1 — цена видна, но заказ в Direct, 2 — цены нет вовсе. */
function tier(p: Product): 0 | 1 | 2 {
  if (isOrderable(p)) return 0;
  return p.price !== null ? 1 : 2;
}

/**
 * Лента для покупателя: без сломанных названий; сначала то, что можно заказать на Хариде,
 * затем товары с ценой, и в конце — «цену спросите в Direct». Порядок внутри уровней сохраняется:
 * API отдаёт новые товары первыми.
 */
export function curate(list: Product[]): Product[] {
  const ok = list.filter((p) => !isBrokenTitle(p.title));
  return [0, 1, 2].flatMap((t) => ok.filter((p) => tier(p) === t));
}

/**
 * Категории, в которых есть товары. Пустые плитки и «чипы» ведут на пустые страницы.
 * Список товаров ограничен FEED_LIMIT: если выдача упёрлась в предел, в ней может не быть
 * товаров какой-то категории, поэтому ничего не скрываем. Не загрузилась — тоже.
 * keep — категория, на странице которой покупатель сейчас: её не прячем.
 */
export function visibleCategories(cats: Category[], feed: Product[] | null, keep?: string): Category[] {
  if (!feed || feed.length >= FEED_LIMIT) return cats;
  const used = new Set(curate(feed).map((p) => p.category).filter((c): c is string => !!c));
  return cats.filter((c) => used.has(c.slug) || c.slug === keep);
}
