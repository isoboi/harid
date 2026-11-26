import { I18nLike, RU } from '../core/i18n';
import { amount } from './money.pipe';

const FORMS: [string, string, string] = ['подписчик', 'подписчика', 'подписчиков'];

/** Число с одним знаком после запятой по-русски: 12.3 → «12,3», 10 → «10». */
const dec = (v: number): string => String(v).replace('.', ',');

/** 349 → «349», 1234 → «1 234», 12345 → «12,3 тыс.», 1234567 → «1,2 млн». */
export const followersCount = (n: number, i18n: I18nLike = RU): string => {
  if (n >= 1_000_000) return i18n.t('{n} млн', { n: dec(Math.round(n / 100_000) / 10) });
  if (n >= 10_000) {
    const k = Math.round(n / 100) / 10;
    // 999 950+ после округления дало бы «1000 тыс.» — это уже миллион
    return k >= 1000 ? i18n.t('{n} млн', { n: 1 }) : i18n.t('{n} тыс.', { n: dec(k) });
  }
  return amount(n);
};

/** Слово при числе: «подписчик / подписчика / подписчиков» (после «тыс.» и «млн» — родительный, как при 5). */
export const followersLabel = (n: number, i18n: I18nLike = RU): string => i18n.plural(n >= 10_000 ? 5 : n, FORMS);
