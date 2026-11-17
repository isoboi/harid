import { MoneyPipe } from './money.pipe';

describe('MoneyPipe', () => {
  const pipe = new MoneyPipe();
  it('1250 → «1 250 смн»', () => {
    expect(pipe.transform(1250)).toBe('1 250 смн');
  });
  it('320 → «320 смн»', () => {
    expect(pipe.transform(320)).toBe('320 смн');
  });
  it('null → пустая строка', () => {
    expect(pipe.transform(null)).toBe('');
  });
});
