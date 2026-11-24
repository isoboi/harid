import { SearchSuggestions } from '../core/models';

/** С какой длины запроса просить подсказки — как на сервере (решение 0009). */
export const SUGGEST_MIN_LENGTH = 2;
/** Пауза после последней клавиши, прежде чем спросить сервер. */
export const SUGGEST_DEBOUNCE_MS = 200;

/** Пункт выпадающего списка — то, по чему ходят стрелками. */
export type SuggestOption =
  | { kind: 'shop'; link: string[]; shop: SearchSuggestions['shops'][number] }
  | { kind: 'category'; link: string[]; category: SearchSuggestions['categories'][number] }
  | { kind: 'product'; link: string[]; product: SearchSuggestions['products'][number] }
  | { kind: 'all'; link: string[]; query: string };

/**
 * Подсказки → плоский список пунктов в порядке показа: лавки, категории, товары,
 * последним — «Все результаты». Индекс в этом списке и есть активный пункт.
 */
export function suggestOptions(s: SearchSuggestions | null, query: string): SuggestOption[] {
  const all: SuggestOption = { kind: 'all', link: ['/search'], query };
  if (!s) return [all];
  return [
    ...s.shops.map((shop): SuggestOption => ({ kind: 'shop', link: ['/shop', shop.handle], shop })),
    ...s.categories.map((category): SuggestOption => ({ kind: 'category', link: ['/c', category.slug], category })),
    ...s.products.map((product): SuggestOption => ({ kind: 'product', link: ['/product', product.id], product })),
    all,
  ];
}

/** Кусок подписи: совпавший с запросом или обычный. */
export interface Mark { text: string; hit: boolean }

/**
 * Подсветка: начала слов подписи, совпавшие с началом любого слова запроса.
 * Сервер ищет по префиксам слов, поэтому и подсвечиваем префиксы — опечатки не подсвечиваются.
 */
export function highlight(label: string, query: string): Mark[] {
  const terms = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (!terms.length) return [{ text: label, hit: false }];
  const marks: Mark[] = [];
  const push = (text: string, hit: boolean) => {
    if (!text) return;
    const last = marks[marks.length - 1];
    if (last && last.hit === hit) last.text += text;
    else marks.push({ text, hit });
  };
  // Слова и разделители по очереди: split с группой сохраняет разделители
  for (const part of label.split(/([^\p{L}\p{N}]+)/u)) {
    const lower = part.toLowerCase();
    const len = terms.reduce((best, t) => (lower.startsWith(t) && t.length > best ? t.length : best), 0);
    push(part.slice(0, len), true);
    push(part.slice(len), false);
  }
  return marks;
}

/** Следующий активный пункт по стрелке: по кругу, -1 — «ничего не выбрано». */
export function moveActive(current: number, delta: 1 | -1, count: number): number {
  if (!count) return -1;
  if (current < 0) return delta > 0 ? 0 : count - 1;
  return (current + delta + count) % count;
}
