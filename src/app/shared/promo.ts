/** Акция на витрине: процент скидки и последний день — по Душанбе, как во всей витрине. */
const untilFmt = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Dushanbe', day: 'numeric', month: 'long' });

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

/** Конец акции «2026-12-10T23:59:59+05:00» → «до 10 декабря»; без даты — пусто. */
export function promoUntil(endsAt: string | null | undefined): string {
  return endsAt ? `до ${untilFmt.format(new Date(endsAt))}` : '';
}
