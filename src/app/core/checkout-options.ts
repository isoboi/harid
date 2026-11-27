import { I18nLike, RU } from './i18n';
import { OrderStage } from './models';
import { TG_MONTHS } from '../shared/promo';

/**
 * Копия distributor/src/Modules/Web/Marketplace/marketplace.constants.ts
 * (MARKET_DISTRICTS, DELIVERY_SLOTS, deliveryFor). Эндпоинта нет — меняйте в обоих местах.
 */
export const SUBURBS = ['Вахдат', 'Ҳисор'];
export const DISTRICTS = ['Сино', 'Фирдавсӣ', 'Шоҳмансур', 'Исмоили Сомонӣ', ...SUBURBS];
/** Значения уходят в заказ и хранятся текстом — всегда по-русски; перевод только при показе (slotLabel). */
export const SLOTS = ['Сегодня, 18:00–21:00', 'Завтра, 10:00–14:00', 'Завтра, 14:00–18:00', 'Завтра, 18:00–21:00'];
export const deliveryFor = (district: string): number => (SUBURBS.includes(district) ? 25 : 15);

/** Русские подписи этапов — они же ключи словаря; на экран — через stageLabel или пайп t. */
export const STAGE_LABEL: Record<OrderStage, string> = {
  placed: 'Принят',
  assembling: 'Собирается',
  in_delivery: 'Курьер в пути',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
};

/** Подпись этапа на языке страницы. */
export const stageLabel = (stage: OrderStage, i18n: I18nLike = RU): string => i18n.t(STAGE_LABEL[stage]);

const TZ = 'Asia/Dushanbe';
const TODAY_EVENING = SLOTS[0];
/** С этого часа по Душанбе вечерний слот на сегодня уже не собрать. */
const TODAY_CUTOFF_HOUR = 17;
const MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
/** «Сегодня, 18:00–21:00» → день и остаток с часами. */
const RELATIVE_SLOT = /^(Сегодня|Завтра)(,.*)$/;

/** Год, месяц (1–12), день и час момента по часам Душанбе. */
function dushanbeParts(d: Date): { y: number; m: number; day: number; h: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', hourCycle: 'h23' }).formatToParts(d);
  const n = (t: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === t)?.value);
  return { y: n('year'), m: n('month'), day: n('day'), h: n('hour') % 24 };
}

/** «2 марта» по-русски, «2 март» по-таджикски (месяц не склоняется). month — 1–12. */
function dayMonthText(day: number, month: number, i18n: I18nLike): string {
  return `${day} ${(i18n.lang === 'tg' ? TG_MONTHS : MONTHS_GENITIVE)[month - 1]}`;
}

/** Слоты, которые ещё можно выбрать сейчас: с 17:00 по Душанбе «Сегодня, 18:00–21:00» скрыт. */
export function availableSlots(now: Date): string[] {
  return dushanbeParts(now).h >= TODAY_CUTOFF_HOUR ? SLOTS.filter((s) => s !== TODAY_EVENING) : [...SLOTS];
}

/** Слот для показа: «Сегодня, 18:00–21:00» → «Имрӯз, 18:00–21:00». Значение в форме и заказе остаётся русским. */
export function slotLabel(slot: string, i18n: I18nLike = RU): string {
  const m = RELATIVE_SLOT.exec(slot);
  return m ? `${i18n.t(m[1])}${m[2]}` : slot;
}

/**
 * Слот хранится относительным текстом («Сегодня, 18:00–21:00»), а заказ открывают и через неделю.
 * Подставляем дату по Душанбе от created_at: «Сегодня» — день создания, «Завтра» — следующий.
 * Только для показа: по-таджикски — «17 ноябр, 18:00–21:00».
 */
export function slotWithDate(slot: string, createdAt: string, i18n: I18nLike = RU): string {
  const m = RELATIVE_SLOT.exec(slot);
  const created = new Date(createdAt);
  if (!m || Number.isNaN(created.getTime())) return slotLabel(slot, i18n);
  const p = dushanbeParts(created);
  // Календарная арифметика в UTC: переносы через конец месяца и года считает Date
  const day = new Date(Date.UTC(p.y, p.m - 1, p.day + (m[1] === 'Завтра' ? 1 : 0)));
  return `${dayMonthText(day.getUTCDate(), day.getUTCMonth() + 1, i18n)}${m[2]}`;
}

/** Дата по Душанбе без года: «2 марта» (по-таджикски «2 март»). Пустая строка, если дата не разобралась. */
export function dayMonth(iso: string, i18n: I18nLike = RU): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = dushanbeParts(d);
  return dayMonthText(p.day, p.m, i18n);
}
