import { I18nLike, RU } from '../core/i18n';
import { Shop } from '../core/models';

const REVIEW_FORMS: [string, string, string] = ['отзыв', 'отзыва', 'отзывов'];

/** Оценка с одним знаком и десятичной запятой: 4.8 → «4,8». */
export const ratingNumber = (r: number): string => r.toFixed(1).replace('.', ',');

/** «12 отзывов», «1 отзыв», «3 отзыва». */
export const reviewsCount = (n: number, i18n: I18nLike = RU): string => `${n} ${i18n.plural(n, REVIEW_FORMS)}`;

/** Подпись к звезде: «4,8 · 12 отзывов». Без отзывов — пустая строка, и звезду не показываем. */
/**
 * Состояние оценки лавки для шапки и плашки продавца:
 * rated — есть оценка; none — оценок пока нет; direct — лавка принимает заказы в Direct,
 * а отзыв оставляют только после доставки через Харид, поэтому оценок у неё не будет.
 */
export type ShopRating = { kind: 'rated'; value: string; count: string } | { kind: 'none' } | { kind: 'direct' };

export function shopRating(shop: Pick<Shop, 'rating' | 'reviews_count' | 'verified'>, i18n: I18nLike = RU): ShopRating {
  if (shop.rating != null) return { kind: 'rated', value: ratingNumber(shop.rating), count: reviewsCount(shop.reviews_count ?? 0, i18n) };
  return shop.verified === false ? { kind: 'direct' } : { kind: 'none' };
}

export function ratingLabel(rating: number | null | undefined, count: number | null | undefined, i18n: I18nLike = RU): string {
  if (!count || count <= 0) return '';
  return rating == null ? reviewsCount(count, i18n) : `${ratingNumber(rating)} · ${reviewsCount(count, i18n)}`;
}
