import { amount } from './money.pipe';
import { plural } from './plural';

const FORMS: [string, string, string] = ['подписчик', 'подписчика', 'подписчиков'];

/** Число с одним знаком после запятой по-русски: 12.3 → «12,3», 10 → «10». */
const dec = (v: number): string => String(v).replace('.', ',');

/** 349 → «349», 1234 → «1 234», 12345 → «12,3 тыс.», 1234567 → «1,2 млн». */
export const followersCount = (n: number): string => {
  if (n >= 1_000_000) return `${dec(Math.round(n / 100_000) / 10)} млн`;
  if (n >= 10_000) {
    const k = Math.round(n / 100) / 10;
    // 999 950+ после округления дало бы «1000 тыс.» — это уже миллион
    return k >= 1000 ? '1 млн' : `${dec(k)} тыс.`;
  }
  return amount(n);
};

/** Слово при числе: «подписчик / подписчика / подписчиков» (после «тыс.» и «млн» — родительный). */
export const followersLabel = (n: number): string => plural(n, FORMS);
