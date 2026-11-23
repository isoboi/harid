import { buildSitemap, DISALLOWED_PATHS, robotsTxt, SITEMAP_MAX_URLS } from './sitemap';

describe('robotsTxt', () => {
  const txt = robotsTxt('https://harid.tj');

  it('закрывает личные страницы и поиск', () => {
    for (const p of ['/cart', '/checkout', '/order/', '/login', '/me/', '/favorites', '/chats', '/search']) expect(txt).toContain(`Disallow: ${p}\n`);
    expect(DISALLOWED_PATHS).toContain('/order/');
  });

  it('не закрывает витрину и страницу «Продавцам»', () => {
    expect(txt).not.toMatch(/Disallow: \/\s*$/m);
    expect(txt).not.toContain('Disallow: /sell');
    expect(txt).not.toContain('Disallow: /product');
    expect(txt).not.toContain('Disallow: /shop');
  });

  it('указывает абсолютный адрес sitemap', () => {
    expect(txt).toContain('Sitemap: https://harid.tj/sitemap.xml');
  });
});

describe('buildSitemap', () => {
  const origin = 'https://harid.tj';
  const xml = buildSitemap(origin, {
    categories: [{ slug: 'odezhda' }],
    shops: [{ handle: 'my.shop' }],
    products: [{ id: '12', posted_at: '2026-11-20T10:30:00.000Z' }, { id: '13', posted_at: 'не дата' }],
  });

  it('начинается с XML-объявления и urlset', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  });

  it('содержит главные страницы, категории, лавки и товары с абсолютными адресами', () => {
    for (const path of ['/', '/catalog', '/sell', '/c/odezhda', '/shop/my.shop', '/product/12', '/product/13']) {
      expect(xml).toContain(`<loc>${origin}${path}</loc>`);
    }
  });

  it('lastmod — дата товара; непонятная дата пропускается', () => {
    expect(xml).toContain('<loc>https://harid.tj/product/12</loc><lastmod>2026-11-20</lastmod>');
    expect(xml).toContain('<loc>https://harid.tj/product/13</loc></url>');
  });

  it('кодирует и экранирует опасные символы в адресах', () => {
    const bad = buildSitemap(origin, { categories: [{ slug: 'a&b<c>' }], shops: [], products: [] });
    expect(bad).toContain('/c/a%26b%3Cc%3E');
    expect(bad).not.toContain('<c>');
    const amp = buildSitemap('https://x.tj/?a=1&b=2', { categories: [], shops: [], products: [] });
    expect(amp).toContain('&amp;b=2');
  });

  it('не превышает лимит протокола в 50 000 адресов', () => {
    const products = Array.from({ length: SITEMAP_MAX_URLS + 10 }, (_, i) => ({ id: String(i) }));
    const big = buildSitemap(origin, { categories: [], shops: [], products });
    expect(big.match(/<url>/g)?.length).toBe(SITEMAP_MAX_URLS);
  });
});
