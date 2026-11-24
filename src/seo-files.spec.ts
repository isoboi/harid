import { isAllowedHost, loadSitemapData, requestOrigin, robotsTxt, sitemapCache, SitemapData, sitemapXml } from './seo-files';

describe('robots.txt', () => {
  it('закрывает личные разделы и указывает карту сайта', () => {
    const txt = robotsTxt('https://harid.tj');
    expect(txt).toContain('User-agent: *');
    for (const p of ['/cart', '/checkout', '/order/', '/login', '/me/', '/favorites', '/chats']) expect(txt).toContain(`Disallow: ${p}\n`);
    expect(txt).not.toContain('Disallow: /product');
    expect(txt).toContain('Sitemap: https://harid.tj/sitemap.xml');
  });
});

describe('sitemap.xml', () => {
  const data: SitemapData = {
    categories: [{ slug: 'dresses' }],
    shops: [{ handle: 'lola&co' }],
    products: [{ id: '42', posted_at: '2026-11-01T10:00:00Z' }, { id: '43', posted_at: 'мусор' }],
  };

  it('главная, каталог, категории, лавки и товары с lastmod', () => {
    const xml = sitemapXml('https://harid.tj', data);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<loc>https://harid.tj/</loc>');
    expect(xml).toContain('<loc>https://harid.tj/catalog</loc>');
    expect(xml).toContain('<loc>https://harid.tj/c/dresses</loc>');
    expect(xml).toContain('<url><loc>https://harid.tj/product/42</loc><lastmod>2026-11-01</lastmod></url>');
    expect(xml).toContain('<url><loc>https://harid.tj/product/43</loc></url>');
  });

  it('ник кодируется в адресе, XML не ломается', () => {
    expect(sitemapXml('https://harid.tj', data)).toContain('<loc>https://harid.tj/shop/lola%26co</loc>');
  });
});

describe('loadSitemapData', () => {
  it('берёт товары страницами по 100, пока страница не неполная', async () => {
    const calls: string[] = [];
    const getJson = async (url: string) => {
      calls.push(url);
      if (url.endsWith('/categories')) return [{ slug: 'a' }];
      if (url.endsWith('/shops')) return [{ handle: 'b' }];
      const offset = Number(new URL(url).searchParams.get('offset'));
      const n = offset === 0 ? 100 : 30;
      return Array.from({ length: n }, (_, i) => ({ id: String(offset + i) }));
    };
    const d = await loadSitemapData('https://api/api', getJson);
    expect(d.products.length).toBe(130);
    expect(calls).toContain('https://api/api/market/products?limit=100&offset=0');
    expect(calls).toContain('https://api/api/market/products?limit=100&offset=100');
    expect(calls.filter((c) => c.includes('/products')).length).toBe(2);
  });
});

describe('sitemapCache', () => {
  const sample: SitemapData = { categories: [], shops: [], products: [] };

  it('в пределах ttl API не дёргает, одновременные запросы ждут одну загрузку', async () => {
    let t = 0;
    const load = jest.fn(async () => sample);
    const get = sitemapCache(load, 1000, () => t);
    await Promise.all([get(), get()]);
    expect(load).toHaveBeenCalledTimes(1);
    t = 500; await get();
    expect(load).toHaveBeenCalledTimes(1);
    t = 1500; await get();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('API упал — прошлые данные; данных ещё нет — ошибка', async () => {
    let t = 0;
    let fail = false;
    const get = sitemapCache(async () => { if (fail) throw new Error('down'); return sample; }, 1000, () => t);
    await get();
    fail = true; t = 2000;
    await expect(get()).resolves.toBe(sample);
    const empty = sitemapCache(async () => { throw new Error('down'); }, 1000);
    await expect(empty()).rejects.toThrow('down');
  });
});

describe('requestOrigin', () => {
  it('SITE_URL важнее запроса, «/» в конце убирается', () => {
    expect(requestOrigin('https://harid.tj/', { protocol: 'http', headers: { host: 'evil.com' } })).toBe('https://harid.tj');
  });

  it('за прокси: https из X-Forwarded-Proto, хост — из Host, X-Forwarded-Host игнорируется', () => {
    expect(requestOrigin(undefined, { protocol: 'http', headers: { host: 'harid.tj', 'x-forwarded-proto': 'https', 'x-forwarded-host': 'evil.com' } })).toBe('https://harid.tj');
    expect(requestOrigin('', { protocol: 'http', headers: { host: 'localhost:4000' } })).toBe('http://localhost:4000');
  });
});

describe('isAllowedHost', () => {
  it('сравнивает без порта и регистра', () => {
    expect(isAllowedHost('Harid.tj:443', ['harid.tj'])).toBe(true);
    expect(isAllowedHost('evil.com', ['harid.tj'])).toBe(false);
    expect(isAllowedHost(undefined, ['harid.tj'])).toBe(false);
  });
});
