import { plural } from './plural';

const REVIEW_FORMS: [string, string, string] = ['отзыв', 'отзыва', 'отзывов'];

/** Оценка с одним знаком и десятичной запятой: 4.8 → «4,8». */
export const ratingNumber = (r: number): string => r.toFixed(1).replace('.', ',');

/** «12 отзывов», «1 отзыв», «3 отзыва». */
export const reviewsCount = (n: number): string => `${n} ${plural(n, REVIEW_FORMS)}`;

/** Подпись к звезде: «4,8 · 12 отзывов». Без отзывов — пустая строка, и звезду не показываем. */
export function ratingLabel(rating: number | null | undefined, count: number | null | undefined): string {
  if (!count || count <= 0) return '';
  return rating == null ? reviewsCount(count) : `${ratingNumber(rating)} · ${reviewsCount(count)}`;
}
