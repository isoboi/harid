import { siteOrigin } from './site-url';

describe('siteOrigin', () => {
  it('берёт схему и хост из адреса запроса', () => {
    expect(siteOrigin('http://localhost:4000/product/5?x=1', { production: false })).toBe('http://localhost:4000');
  });

  it('учитывает X-Forwarded-Proto (первое значение списка)', () => {
    expect(siteOrigin('http://harid.tj/', { forwardedProto: 'https, http', production: false })).toBe('https://harid.tj');
  });

  it('игнорирует чужие значения X-Forwarded-Proto', () => {
    expect(siteOrigin('http://harid.tj/', { forwardedProto: 'javascript', production: false })).toBe('http://harid.tj');
  });

  it('в продакшне поднимает http до https для боевого хоста', () => {
    expect(siteOrigin('http://harid.tj/', { production: true })).toBe('https://harid.tj');
  });

  it('в продакшне не трогает localhost: локальный запуск SSR остаётся на http', () => {
    expect(siteOrigin('http://localhost:4000/', { production: true })).toBe('http://localhost:4000');
    expect(siteOrigin('http://127.0.0.1:4000/', { production: true })).toBe('http://127.0.0.1:4000');
  });

  it('на неразборчивом адресе возвращает пустую строку', () => {
    expect(siteOrigin('не адрес', { production: true })).toBe('');
  });
});
