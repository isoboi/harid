import { bioLink, telegramShareUrl, whatsappShareUrl, withUtm } from './share';

describe('withUtm', () => {
  it('добавляет источник и канал', () => {
    expect(withUtm('https://harid.tj/product/5', 'share', 'telegram')).toBe('https://harid.tj/product/5?utm_source=share&utm_medium=telegram');
  });

  it('сохраняет другие параметры и заменяет прежние метки', () => {
    expect(withUtm('https://harid.tj/shop/a?x=1&utm_source=old', 'share', 'copy')).toBe('https://harid.tj/shop/a?x=1&utm_source=share&utm_medium=copy');
  });

  it('неразборчивый адрес возвращает как есть', () => {
    expect(withUtm('/product/5', 'share', 'copy')).toBe('/product/5');
  });
});

describe('ссылки на мессенджеры', () => {
  it('Telegram: адрес и текст закодированы', () => {
    const link = telegramShareUrl('https://harid.tj/p?a=1&b=2', 'Кроссовки за 540 смн');
    expect(link.startsWith('https://t.me/share/url?')).toBe(true);
    expect(link).toContain('url=https%3A%2F%2Fharid.tj%2Fp%3Fa%3D1%26b%3D2');
    expect(link).toContain('text=%D0%9A%D1%80%D0%BE%D1%81%D1%81%D0%BE%D0%B2%D0%BA%D0%B8');
  });

  it('WhatsApp: текст и адрес идут одним сообщением', () => {
    const link = whatsappShareUrl('https://harid.tj/p', 'Смотрите');
    expect(link).toBe(`https://wa.me/?text=${encodeURIComponent('Смотрите https://harid.tj/p')}`);
  });

  it('WhatsApp: без текста — только адрес', () => {
    expect(whatsappShareUrl('https://harid.tj/p', '')).toBe(`https://wa.me/?text=${encodeURIComponent('https://harid.tj/p')}`);
  });
});

describe('bioLink', () => {
  it('ведёт на лавку и помечена как переход из bio Instagram', () => {
    expect(bioLink('https://harid.tj', 'my.shop')).toBe('https://harid.tj/shop/my.shop?utm_source=instagram&utm_medium=bio');
  });
});
