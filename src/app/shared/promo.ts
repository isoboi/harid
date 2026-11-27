import { I18nLike, RU } from '../core/i18n';

/** Акция на витрине: процент скидки и последний день — по Душанбе, как во всей витрине. */
const untilFmt = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Dushanbe', day: 'numeric', month: 'long' });
/** День и номер месяца по Душанбе — для таджикской подписи (ICU в браузерах не везде знает tg-TJ). */
const partsFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dushanbe', day: 'numeric', month: 'numeric' });
export const TG_MONTHS = ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];

/**
 * 540 вместо 600 → 10. Скидки нет (старой цены нет, она не выше, меньше 1%) → null.
 * Округляем к ближайшему: цена акции = floor(база × (100 − %) / 100), поэтому
 * обратный пересчёт даёт процент, который магазин задал.
 */
export function discountPercent(price: number | null, old: number | null): number | null {
  if (price === null || old === null || old <= price) return null;
  const pct = Math.round(((old - price) / old) * 100);
  return pct >= 1 ? pct : null;
}

/** «10 декабря» по-русски, «10 декабр» по-таджикски — дата по Душанбе. */
function dayMonth(d: Date, i18n: I18nLike): string {
  if (i18n.lang !== 'tg') return untilFmt.format(d);
  const parts = partsFmt.formatToParts(d);
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? 1);
  return `${day} ${TG_MONTHS[month - 1]}`;
}

/** Конец акции «2026-12-10T23:59:59+05:00» → «до 10 декабря»; без даты — пусто. */
export function promoUntil(endsAt: string | null | undefined, i18n: I18nLike = RU): string {
  return endsAt ? i18n.t('до {date}', { date: dayMonth(new Date(endsAt), i18n) }) : '';
}
