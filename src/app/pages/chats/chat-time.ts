/** Время в переписке — по Душанбе, как во всей витрине. */
const TZ = 'Asia/Dushanbe';

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, day: 'numeric', month: 'long' });
const dayYearFmt = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' });
const shortDayFmt = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, day: 'numeric', month: 'short' });

/** «2026-11-23» — ключ дня для группировки сообщений. */
export function chatDay(iso: string): string {
  return dayKey.format(new Date(iso));
}

/** «09:56» — время внутри пузыря. */
export function chatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

/** Разделитель дня: «Сегодня», «Вчера», «21 ноября», в прошлом году — с годом. */
export function chatDayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const key = chatDay(iso);
  if (key === chatDay(now.toISOString())) return 'Сегодня';
  if (key === chatDay(new Date(now.getTime() - 86_400_000).toISOString())) return 'Вчера';
  return key.slice(0, 4) === chatDay(now.toISOString()).slice(0, 4) ? dayFmt.format(d) : dayYearFmt.format(d);
}

/** Время в списке чатов: сегодня — «09:56», раньше — «21 нояб.». */
export function chatListTime(iso: string, now = new Date()): string {
  return chatDay(iso) === chatDay(now.toISOString()) ? chatTime(iso) : shortDayFmt.format(new Date(iso));
}
