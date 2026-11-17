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
