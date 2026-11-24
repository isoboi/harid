/**
 * robots.txt и sitemap.xml витрины — отдаёт SSR-сервер (src/server.ts).
 * Адрес сайта в них абсолютный, поэтому файлы не статические: origin берётся
 * из SITE_URL или из запроса.
 */

/** Личные разделы покупателя: в выдаче им делать нечего. */
const PRIVATE_PATHS = ['/cart', '/checkout', '/order/', '/login', '/me/', '/favorites', '/chats'];

export function robotsTxt(origin: string): string {
  return ['User-agent: *', ...PRIVATE_PATHS.map((p) => `Disallow: ${p}`), '', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n');
}

export interface SitemapData {
  categories: { slug: string }[];
  shops: { handle: string }[];
  products: { id: string; posted_at?: string | null }[];
}

/** Лимит протокола sitemap — 50 000 адресов в одном файле. */
const MAX_URLS = 50_000;

const xmlEscape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);

/** Дата для lastmod (YYYY-MM-DD); непонятную строку пропускаем. */
function day(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function sitemapXml(origin: string, data: SitemapData): string {
  const urls: { loc: string; lastmod?: string | null }[] = [
    { loc: '/' },
    { loc: '/catalog' },
    { loc: '/sell' },
    ...data.categories.map((c) => ({ loc: `/c/${encodeURIComponent(c.slug)}` })),
    ...data.shops.map((s) => ({ loc: `/shop/${encodeURIComponent(s.handle)}` })),
    ...data.products.map((p) => ({ loc: `/product/${encodeURIComponent(p.id)}`, lastmod: day(p.posted_at) })),
  ].slice(0, MAX_URLS);
  const body = urls
    .map((u) => `  <url><loc>${xmlEscape(origin + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/** Бэкенд отдаёт не больше 100 товаров за запрос. */
const PAGE = 100;
/** Потолок товаров в карте сайта: не больше сотни запросов к API за одно обновление. */
const MAX_PRODUCTS = 10_000;

type FetchJson = (url: string) => Promise<unknown>;

/** Категории, лавки и все товары из публичного API /market (товары — страницами). */
export async function loadSitemapData(apiUrl: string, getJson: FetchJson): Promise<SitemapData> {
  const base = `${apiUrl}/market`;
  const [categories, shops] = await Promise.all([getJson(`${base}/categories`), getJson(`${base}/shops`)]);
  const products: SitemapData['products'] = [];
  for (let offset = 0; offset < MAX_PRODUCTS; offset += PAGE) {
    const page = (await getJson(`${base}/products?limit=${PAGE}&offset=${offset}`)) as SitemapData['products'];
    products.push(...page);
    if (page.length < PAGE) break;
  }
  return { categories: categories as SitemapData['categories'], shops: shops as SitemapData['shops'], products };
}

/**
 * Кэш данных карты сайта: API опрашивается не чаще раза в ttl.
 * Одновременные запросы ждут одну загрузку; если API упал — отдаём прошлые данные.
 */
export function sitemapCache(load: () => Promise<SitemapData>, ttlMs: number, now: () => number = Date.now) {
  let data: SitemapData | null = null;
  let loadedAt = 0;
  let pending: Promise<SitemapData> | null = null;
  return async (): Promise<SitemapData> => {
    if (data && now() - loadedAt < ttlMs) return data;
    pending ??= load()
      .then((d) => { data = d; loadedAt = now(); return d; })
      .catch((e) => { if (data) return data; throw e; })
      .finally(() => { pending = null; });
    return pending;
  };
}

/**
 * Адрес сайта для canonical, og:url и карты сайта. SITE_URL — надёжнее всего
 * (за прокси сервер видит http). Без него — X-Forwarded-Proto и Host запроса.
 * X-Forwarded-Host не берём: его не проверяет список разрешённых хостов,
 * а подменённый адрес попал бы в закэшированную CDN страницу.
 */
export function requestOrigin(siteUrl: string | undefined, req: { protocol: string; headers: Record<string, string | string[] | undefined> }): string {
  if (siteUrl?.trim()) return siteUrl.trim().replace(/\/+$/, '');
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.split(',')[0]?.trim();
  const proto = first(req.headers['x-forwarded-proto']) === 'https' ? 'https' : req.protocol;
  return `${proto}://${first(req.headers['host']) || 'localhost'}`;
}

/**
 * Список хостов, который на деле применит AngularNodeAppEngine: NG_ALLOWED_HOSTS
 * заменяет опцию allowedHosts, а не дополняет её. Без переменной — только локальные адреса.
 */
export function allowedHostsFromEnv(env: string | undefined): string[] {
  const hosts = (env ?? '').split(',').map((h) => h.trim()).filter(Boolean);
  return hosts.length ? hosts : ['localhost', '127.0.0.1'];
}

/**
 * Host входит в список разрешённых — по правилам AngularNodeAppEngine:
 * сравнивается имя без порта, «*.harid.tj» пускает любой поддомен, «*» — любой хост.
 */
export function isAllowedHost(hostHeader: string | undefined, allowed: string[]): boolean {
  let url: URL;
  try {
    url = new URL(`http://${hostHeader ?? ''}`);
  } catch {
    return false;
  }
  if (!url.hostname || url.pathname !== '/' || url.search || url.hash || url.username || url.password) return false;
  const host = url.hostname;
  return allowed.some((entry) => {
    const a = entry.toLowerCase();
    return a === '*' || a === host || (a.startsWith('*.') && host.endsWith(a.slice(1)));
  });
}
