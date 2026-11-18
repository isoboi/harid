import { OrderStage } from './models';

/**
 * Копия distributor/src/Modules/Web/Marketplace/marketplace.constants.ts
 * (MARKET_DISTRICTS, DELIVERY_SLOTS, deliveryFor). Эндпоинта нет — меняйте в обоих местах.
 */
export const SUBURBS = ['Вахдат', 'Ҳисор'];
export const DISTRICTS = ['Сино', 'Фирдавсӣ', 'Шоҳмансур', 'Исмоили Сомонӣ', ...SUBURBS];
export const SLOTS = ['Сегодня, 18:00–21:00', 'Завтра, 10:00–14:00', 'Завтра, 14:00–18:00', 'Завтра, 18:00–21:00'];
export const deliveryFor = (district: string): number => (SUBURBS.includes(district) ? 25 : 15);

export const STAGE_LABEL: Record<OrderStage, string> = {
  placed: 'Принят',
  assembling: 'Собирается',
  in_delivery: 'Курьер в пути',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
};

const TZ = 'Asia/Dushanbe';
const TODAY_EVENING = SLOTS[0];
/** С этого часа по Душанбе вечерний слот на сегодня уже не собрать. */
const TODAY_CUTOFF_HOUR = 17;
const MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/** Год, месяц (1–12), день и час момента по часам Душанбе. */
function dushanbeParts(d: Date): { y: number; m: number; day: number; h: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', hourCycle: 'h23' }).formatToParts(d);
  const n = (t: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === t)?.value);
  return { y: n('year'), m: n('month'), day: n('day'), h: n('hour') % 24 };
}

/** Слоты, которые ещё можно выбрать сейчас: с 17:00 по Душанбе «Сегодня, 18:00–21:00» скрыт. */
export function availableSlots(now: Date): string[] {
  return dushanbeParts(now).h >= TODAY_CUTOFF_HOUR ? SLOTS.filter((s) => s !== TODAY_EVENING) : [...SLOTS];
}

/**
 * Слот хранится относительным текстом («Сегодня, 18:00–21:00»), а заказ открывают и через неделю.
 * Подставляем дату по Душанбе от created_at: «Сегодня» — день создания, «Завтра» — следующий.
 */
export function slotWithDate(slot: string, createdAt: string): string {
  const m = /^(Сегодня|Завтра)(,.*)$/.exec(slot);
  const created = new Date(createdAt);
  if (!m || Number.isNaN(created.getTime())) return slot;
  const p = dushanbeParts(created);
  // Календарная арифметика в UTC: переносы через конец месяца и года считает Date
  const day = new Date(Date.UTC(p.y, p.m - 1, p.day + (m[1] === 'Завтра' ? 1 : 0)));
  return `${day.getUTCDate()} ${MONTHS_GENITIVE[day.getUTCMonth()]}${m[2]}`;
}

/** Дата по Душанбе без года: «2 марта». Пустая строка, если дата не разобралась. */
export function dayMonth(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = dushanbeParts(d);
  return `${p.day} ${MONTHS_GENITIVE[p.m - 1]}`;
}
