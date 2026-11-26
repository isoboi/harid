import { discountPercent, promoUntil } from './promo';

describe('discountPercent', () => {
  it.each([
    [540, 600, 10],
    [1737, 1930, 10],
    [7128, 7920, 10],
    [333, 1000, 67],
  ])('%i вместо %i — скидка %i%%', (price, old, pct) => {
    expect(discountPercent(price, old)).toBe(pct);
  });

  it.each([
    [540, null],
    [600, 600],
    [700, 600],
    [null, 600],
    [999, 1000],
  ])('%s при старой %s — скидки нет', (price, old) => {
    expect(discountPercent(price, old)).toBeNull();
  });
});

describe('promoUntil', () => {
  it('последний день акции по Душанбе: конец дня 10 декабря — «до 10 декабря»', () => {
    expect(promoUntil('2026-12-10T18:59:59.000Z')).toBe('до 10 декабря');
  });

  it('без даты окончания — пусто', () => {
    expect(promoUntil(null)).toBe('');
    expect(promoUntil(undefined)).toBe('');
  });
});
