import { allowedHostsFromEnv, isAllowedHost, loadSitemapData, requestOrigin, robotsTxt, siteOrigin, sitemapCache, SitemapData, sitemapXml } from './seo-files';

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

  it('новый товар сдвинул страницы во время обхода — повтор отбрасывается', async () => {
    const all = Array.from({ length: 150 }, (_, i) => ({ id: String(150 - i) }));
    let published = false;
    const getJson = async (url: string) => {
      if (!url.includes('/products')) return [];
      const offset = Number(new URL(url).searchParams.get('offset'));
      const feed = published ? [{ id: '151' }, ...all] : all;
      published = true; // после первой страницы опубликован ещё один
      return feed.slice(offset, offset + 100);
    };
    const d = await loadSitemapData('https://api/api', getJson);
    const ids = d.products.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(150);
  });

  it('страница без новых товаров заканчивает обход', async () => {
    let calls = 0;
    const page = Array.from({ length: 100 }, (_, i) => ({ id: String(i) }));
    const getJson = async (url: string) => (url.includes('/products') ? (calls++, page) : []);
    const d = await loadSitemapData('https://api/api', getJson);
    expect(d.products.length).toBe(100);
    expect(calls).toBe(2);
  });

  it('ответ не массив — ошибка, а не кэш мусора', async () => {
    const getJson = async (url: string) => (url.endsWith('/shops') ? { items: [] } : []);
    await expect(loadSitemapData('https://api/api', getJson)).rejects.toThrow('/shops');
  });
});

describe('sitemapCache', () => {
  const sample: SitemapData = { categories: [], shops: [], products: [] };

  it('в пределах ttl API не дёргает, одновременные запросы ждут одну загрузку', async () => {
    let t = 0;
    const load = jest.fn(async () => sample);
    const get = sitemapCache(load, { ttlMs: 1000, retryMs: 100, now: () => t });
    await Promise.all([get(), get()]);
    expect(load).toHaveBeenCalledTimes(1);
    t = 500; await get();
    expect(load).toHaveBeenCalledTimes(1);
    t = 1500; await get();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('API упал — прошлые данные, ошибка в лог, повтор не раньше retryMs; данных ещё нет — ошибка', async () => {
    let t = 0;
    let fail = false;
    const errors: unknown[] = [];
    const load = jest.fn(async () => { if (fail) throw new Error('down'); return sample; });
    const get = sitemapCache(load, { ttlMs: 1000, retryMs: 100, now: () => t, onStaleError: (e) => errors.push(e) });
    await get();
    fail = true; t = 2000;
    await expect(get()).resolves.toBe(sample);
    expect(errors).toHaveLength(1);
    t = 2050; await get();
    expect(load).toHaveBeenCalledTimes(2);
    t = 2100; await get();
    expect(load).toHaveBeenCalledTimes(3);
    const empty = sitemapCache(async () => { throw new Error('down'); }, { ttlMs: 1000, retryMs: 100 });
    await expect(empty()).rejects.toThrow('down');
  });
});

describe('siteOrigin', () => {
  it('«/» в конце убирается, пустой или из пробелов — не задан', () => {
    expect(siteOrigin(' https://harid.tj/ ')).toBe('https://harid.tj');
    expect(siteOrigin(' ')).toBeUndefined();
    expect(siteOrigin(undefined)).toBeUndefined();
  });
});

describe('requestOrigin', () => {
  const ALLOWED = ['harid.tj', '*.harid.tj', 'localhost'];
  const req = (headers: Record<string, string>) => ({ protocol: 'http', headers });

  it('SITE_URL важнее запроса', () => {
    expect(requestOrigin('https://harid.tj', req({ host: 'evil.com' }), ALLOWED)).toBe('https://harid.tj');
  });

  it('за прокси — как у Angular: X-Forwarded-Host и -Proto (в любом регистре)', () => {
    expect(requestOrigin(undefined, req({ host: 'harid.tj', 'x-forwarded-proto': 'HTTPS', 'x-forwarded-host': 'www.harid.tj' }), ALLOWED)).toBe('https://www.harid.tj');
    expect(requestOrigin(undefined, req({ host: 'localhost:4000' }), ALLOWED)).toBe('http://localhost:4000');
  });

  it('хост не из списка — в Host или X-Forwarded-Host — null', () => {
    expect(requestOrigin(undefined, req({ host: 'evil.com' }), ALLOWED)).toBeNull();
    expect(requestOrigin(undefined, req({ host: 'harid.tj', 'x-forwarded-host': 'evil.com' }), ALLOWED)).toBeNull();
    expect(requestOrigin(undefined, req({ host: '127.0.0.1:4000', 'x-forwarded-host': 'harid.tj' }), ALLOWED)).toBeNull();
  });

  it('порт — только у локальных адресов', () => {
    expect(requestOrigin(undefined, req({ host: 'harid.tj:6666' }), ALLOWED)).toBe('http://harid.tj');
    expect(requestOrigin(undefined, req({ host: 'harid.tj', 'x-forwarded-port': '8443', 'x-forwarded-proto': 'https' }), ALLOWED)).toBe('https://harid.tj');
    expect(requestOrigin(undefined, req({ host: 'localhost', 'x-forwarded-port': '4200' }), ALLOWED)).toBe('http://localhost:4200');
  });
});

describe('isAllowedHost', () => {
  it('сравнивает без порта и регистра', () => {
    expect(isAllowedHost('Harid.tj:443', ['harid.tj'])).toBe(true);
    expect(isAllowedHost('evil.com', ['harid.tj'])).toBe(false);
    expect(isAllowedHost(undefined, ['harid.tj'])).toBe(false);
  });

  it('«*.домен» пускает поддомены, как AngularNodeAppEngine', () => {
    expect(isAllowedHost('www.harid.tj', ['harid.tj', '*.harid.tj'])).toBe(true);
    expect(isAllowedHost('evilharid.tj', ['*.harid.tj'])).toBe(false);
    expect(isAllowedHost('anything.example', ['*'])).toBe(true);
  });

  it('Host с путём или логином не проходит', () => {
    expect(isAllowedHost('harid.tj/x', ['harid.tj'])).toBe(false);
    expect(isAllowedHost('u@harid.tj', ['harid.tj'])).toBe(false);
  });
});

describe('allowedHostsFromEnv', () => {
  it('NG_ALLOWED_HOSTS заменяет локальные адреса, а не дополняет', () => {
    expect(allowedHostsFromEnv('harid.tj, *.harid.tj ,')).toEqual(['harid.tj', '*.harid.tj']);
    expect(allowedHostsFromEnv(undefined)).toEqual(['localhost', '127.0.0.1']);
    expect(allowedHostsFromEnv(' ')).toEqual(['localhost', '127.0.0.1']);
  });
});
