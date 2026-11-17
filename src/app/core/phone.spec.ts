import { phone9 } from './phone';

describe('phone9', () => {
  it('оставляет последние 9 цифр номера', () => {
    expect(phone9('+992 93 111 00 02')).toBe('931110002');
    expect(phone9('93 111 00 02')).toBe('931110002');
  });
});
