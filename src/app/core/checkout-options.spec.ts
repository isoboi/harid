import { deliveryFor, DISTRICTS, SLOTS } from './checkout-options';

describe('checkout-options', () => {
  it('город 15, Вахдат и Ҳисор 25', () => {
    expect(deliveryFor('Сино')).toBe(15);
    expect(deliveryFor('Вахдат')).toBe(25);
    expect(deliveryFor('Ҳисор')).toBe(25);
  });
  it('районы и слоты как на бэкенде', () => {
    expect(DISTRICTS).toEqual(['Сино', 'Фирдавсӣ', 'Шоҳмансур', 'Исмоили Сомонӣ', 'Вахдат', 'Ҳисор']);
    expect(SLOTS).toEqual(['Сегодня, 18:00–21:00', 'Завтра, 10:00–14:00', 'Завтра, 14:00–18:00', 'Завтра, 18:00–21:00']);
  });
});
