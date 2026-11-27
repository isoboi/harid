import { dropOf, isFreshDrop, parseMarks } from './price-watch';

describe('dropOf', () => {
  it('снижение на 5% и больше — сумма в сомони', () => {
    expect(dropOf({ base: 300, now: 285, stock: true })).toBe(15);
  });
  it('меньше 5% — null', () => {
    expect(dropOf({ base: 300, now: 290, stock: true })).toBeNull();
  });
  it('подорожал, нет base, нет now, нет метки — null', () => {
    expect(dropOf({ base: 300, now: 350, stock: true })).toBeNull();
    expect(dropOf({ base: null, now: 100, stock: true })).toBeNull();
    expect(dropOf({ base: 300, now: null, stock: true })).toBeNull();
    expect(dropOf(undefined)).toBeNull();
  });
  it('нет в наличии — null', () => {
    expect(dropOf({ base: 300, now: 200, stock: false })).toBeNull();
  });
});

describe('isFreshDrop', () => {
  it('снижение без seen — свежее; seen = now — нет; упал ниже seen — снова свежее', () => {
    expect(isFreshDrop({ base: 300, now: 250, stock: true })).toBe(true);
    expect(isFreshDrop({ base: 300, now: 250, stock: true, seen: 250 })).toBe(false);
    expect(isFreshDrop({ base: 300, now: 200, stock: true, seen: 250 })).toBe(true);
  });
  it('без снижения — не свежее', () => {
    expect(isFreshDrop({ base: 300, now: 295, stock: true })).toBe(false);
    expect(isFreshDrop(undefined)).toBe(false);
  });
});

describe('parseMarks', () => {
  it('не объект — пусто', () => {
    expect(parseMarks(null)).toEqual({});
    expect(parseMarks('x')).toEqual({});
    expect(parseMarks([1, 2])).toEqual({});
  });
  it('мусор отбрасывается, корректные записи остаются', () => {
    expect(parseMarks({
      a: { base: '300', now: 1, stock: true },
      b: { base: NaN, now: 1, stock: true },
      c: 5,
      f: { base: 300, now: 250 },
      g: { base: 300, now: 250, stock: true, seen: 'x' },
      d: { base: 300, now: 250, stock: true, seen: 260 },
      e: { base: null, now: null, stock: false },
    })).toEqual({ d: { base: 300, now: 250, stock: true, seen: 260 }, e: { base: null, now: null, stock: false } });
  });
});
