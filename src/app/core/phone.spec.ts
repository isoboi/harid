import { isPhone, phone9, prettyPhone } from './phone';

describe('phone9', () => {
  it('оставляет последние 9 цифр номера', () => {
    expect(phone9('+992 93 111 00 02')).toBe('931110002');
    expect(phone9('93 111 00 02')).toBe('931110002');
  });
});

describe('isPhone', () => {
  it.each(['93 111 00 01', '+992 93 111 00 01', '992931110001'])('принимает %s', (v) => {
    expect(isPhone(v)).toBe(true);
  });
  it.each(['93 111 00 01 5', '9311100'])('отклоняет %s', (v) => {
    expect(isPhone(v)).toBe(false);
  });
});

describe('prettyPhone', () => {
  it('9 цифр с кодом страны — с пробелами по группам', () => {
    expect(prettyPhone('+992931110002')).toBe('+992 93 111 00 02');
    expect(prettyPhone('931110002')).toBe('+992 93 111 00 02');
  });
  it('не номер — как пришёл', () => {
    expect(prettyPhone('123')).toBe('123');
    expect(prettyPhone('')).toBe('');
  });
});
