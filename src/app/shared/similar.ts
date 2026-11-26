import { Product } from '../core/models';

/** Сколько похожих товаров показывать на странице товара. */
export const SIMILAR_LIMIT = 8;

/**
 * Похожие товары — замена товару, который не подошёл: только из других лавок
 * (свою лавку показывает «Ещё в лавке»). Сначала то, что можно купить вместо него:
 * в наличии, с выбранным размером (или вовсе без размеров), по близкой цене.
 * Цена «в Direct» (null) — в конце; у текущего товара нет цены — цену не сравниваем.
 * При равенстве — порядок сервера (sort стабилен). Входной массив не меняется.
 */
export function rankSimilar(list: Product[], product: Product, size: string | null): Product[] {
  const fits = (p: Product) => !size || p.sizes.length === 0 || p.sizes.includes(size);
  const base = product.price;
  const gap = (p: Product) => (base === null ? 0 : p.price === null ? Infinity : Math.abs(p.price - base));
  return list
    .filter((p) => p.id !== product.id && p.shop_handle !== product.shop_handle)
    .sort((a, b) => Number(b.in_stock) - Number(a.in_stock) || Number(fits(b)) - Number(fits(a)) || cmp(gap(a), gap(b)))
    .slice(0, SIMILAR_LIMIT);
}

/** Infinity − Infinity даёт NaN — сравниваем без вычитания. */
const cmp = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0);
