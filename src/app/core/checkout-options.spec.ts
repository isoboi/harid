import { availableSlots, deliveryFor, DISTRICTS, slotWithDate, SLOTS } from './checkout-options';

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

describe('availableSlots: слоты по времени Душанбе (UTC+5)', () => {
  // 11:59Z = 16:59 в Душанбе, 12:00Z = 17:00
  it('до 17:00 по Душанбе — все слоты', () => {
    expect(availableSlots(new Date('2026-11-17T11:59:00Z'))).toEqual(SLOTS);
  });
  it('с 17:00 по Душанбе «Сегодня, 18:00–21:00» скрыт', () => {
    expect(availableSlots(new Date('2026-11-17T12:00:00Z'))).toEqual(SLOTS.slice(1));
  });
  it('поздно вечером и ночью до полуночи — без «Сегодня»', () => {
    expect(availableSlots(new Date('2026-11-17T18:30:00Z'))).not.toContain('Сегодня, 18:00–21:00');
  });
  it('после полуночи по Душанбе (19:30Z) снова все слоты', () => {
    expect(availableSlots(new Date('2026-11-17T19:30:00Z'))).toEqual(SLOTS);
  });
});

describe('slotWithDate: относительный слот → абсолютная дата от created_at', () => {
  it('«Сегодня» — дата создания по Душанбе', () => {
    expect(slotWithDate('Сегодня, 18:00–21:00', '2026-11-17T05:08:07Z')).toBe('17 ноября, 18:00–21:00');
  });
  it('«Завтра» — created_at + 1 день', () => {
    expect(slotWithDate('Завтра, 10:00–14:00', '2026-11-17T05:08:07Z')).toBe('18 ноября, 10:00–14:00');
  });
  it('дата берётся по Душанбе, а не по UTC: 20:00Z — уже следующий день', () => {
    expect(slotWithDate('Сегодня, 18:00–21:00', '2026-11-17T20:00:00Z')).toBe('18 ноября, 18:00–21:00');
  });
  it('«Завтра» через конец месяца и года', () => {
    expect(slotWithDate('Завтра, 14:00–18:00', '2026-12-31T10:00:00Z')).toBe('1 января, 14:00–18:00');
    expect(slotWithDate('Завтра, 14:00–18:00', '2026-02-28T10:00:00Z')).toBe('1 марта, 14:00–18:00');
  });
  it('незнакомый слот или битая дата — как есть', () => {
    expect(slotWithDate('Как договоримся', '2026-11-17T05:08:07Z')).toBe('Как договоримся');
    expect(slotWithDate('Сегодня, 18:00–21:00', 'не дата')).toBe('Сегодня, 18:00–21:00');
  });
});
