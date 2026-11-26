import { I18nLike, RU } from '../../core/i18n';

/** Время в переписке — по Душанбе, как во всей витрине. */
const TZ = 'Asia/Dushanbe';

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

type Kind = 'time' | 'day' | 'dayYear' | 'shortDay';
const OPTS: Record<Kind, Intl.DateTimeFormatOptions> = {
  time: { timeZone: TZ, hour: '2-digit', minute: '2-digit' },
  day: { timeZone: TZ, day: 'numeric', month: 'long' },
  dayYear: { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' },
  shortDay: { timeZone: TZ, day: 'numeric', month: 'short' },
};

/** Форматтеры создаются один раз на язык и вид. */
const cache = new Map<string, Intl.DateTimeFormat>();

function format(kind: Kind, d: Date, i18n: I18nLike): string {
  const tg = i18n.lang === 'tg';
  // По-таджикски сокращение месяца («Ноя») читается хуже полного «ноябр» — в списке тоже полный месяц
  const k = tg && kind === 'shortDay' ? 'day' : kind;
  const id = `${i18n.locale}|${k}`;
  let f = cache.get(id);
  if (!f) { f = new Intl.DateTimeFormat(i18n.locale, OPTS[k]); cache.set(id, f); }
  // ICU пишет таджикский месяц с заглавной («21 Ноябр») — в подписи нужна строчная
  return tg ? f.format(d).toLocaleLowerCase(i18n.locale) : f.format(d);
}

/** «2026-11-23» — ключ дня для группировки сообщений. */
export function chatDay(iso: string): string {
  return dayKey.format(new Date(iso));
}

/** «09:56» — время внутри пузыря. */
export function chatTime(iso: string, i18n: I18nLike = RU): string {
  return format('time', new Date(iso), i18n);
}

/** Разделитель дня: «Сегодня», «Вчера», «21 ноября», в прошлом году — с годом. */
export function chatDayLabel(iso: string, now = new Date(), i18n: I18nLike = RU): string {
  const d = new Date(iso);
  const key = chatDay(iso);
  if (key === chatDay(now.toISOString())) return i18n.t('Сегодня');
  if (key === chatDay(new Date(now.getTime() - 86_400_000).toISOString())) return i18n.t('Вчера');
  return format(key.slice(0, 4) === chatDay(now.toISOString()).slice(0, 4) ? 'day' : 'dayYear', d, i18n);
}

/** Время в списке чатов: сегодня — «09:56», раньше — «21 нояб.» (по-таджикски «21 ноябр»). */
export function chatListTime(iso: string, now = new Date(), i18n: I18nLike = RU): string {
  return chatDay(iso) === chatDay(now.toISOString()) ? chatTime(iso, i18n) : format('shortDay', new Date(iso), i18n);
}
