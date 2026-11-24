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

/** Ответ API — массив; иначе ошибка, и в кэш не попадёт ответ неожиданной формы. */
function list<T>(value: unknown, url: string): T[] {
  if (!Array.isArray(value)) throw new Error(`${url}: ожидался массив`);
  return value as T[];
}

/**
 * Категории, лавки и все товары из публичного API /market (товары — страницами).
 * Пока идёт обход, каталог может меняться (новые товары сдвигают страницы):
 * повторы отбрасываются, а страница без новых товаров обход заканчивает.
 */
export async function loadSitemapData(apiUrl: string, getJson: FetchJson): Promise<SitemapData> {
  const base = `${apiUrl}/market`;
  const [categories, shops] = await Promise.all([
    getJson(`${base}/categories`).then((v) => list<SitemapData['categories'][number]>(v, `${base}/categories`)),
    getJson(`${base}/shops`).then((v) => list<SitemapData['shops'][number]>(v, `${base}/shops`)),
  ]);
  const products: SitemapData['products'] = [];
  const seen = new Set<string>();
  for (let offset = 0; offset < MAX_PRODUCTS; offset += PAGE) {
    const url = `${base}/products?limit=${PAGE}&offset=${offset}`;
    const page = list<SitemapData['products'][number]>(await getJson(url), url);
    const fresh = page.filter((p) => !seen.has(p.id));
    fresh.forEach((p) => seen.add(p.id));
    products.push(...fresh);
    if (page.length < PAGE || fresh.length === 0) break;
  }
  return { categories, shops, products };
}

export interface SitemapCacheOptions {
  /** Как часто обновлять данные из API. */
  ttlMs: number;
  /** Через сколько повторить, если обновление не удалось, а прошлые данные есть. */
  retryMs: number;
  now?: () => number;
  /** Неудачное обновление при живых прошлых данных: иначе сбой API никто не заметит. */
  onStaleError?: (e: unknown) => void;
}

/**
 * Кэш данных карты сайта: API опрашивается не чаще раза в ttl.
 * Одновременные запросы ждут одну загрузку. Если API упал — отдаём прошлые данные
 * и следующую попытку делаем не раньше чем через retryMs, а не на каждый запрос.
 */
export function sitemapCache(load: () => Promise<SitemapData>, opts: SitemapCacheOptions) {
  const now = opts.now ?? Date.now;
  let data: SitemapData | null = null;
  /** Когда снова идти в API. */
  let nextLoadAt = 0;
  let pending: Promise<SitemapData> | null = null;
  return async (): Promise<SitemapData> => {
    if (data && now() < nextLoadAt) return data;
    pending ??= load()
      .then((d) => { data = d; nextLoadAt = now() + opts.ttlMs; return d; })
      .catch((e) => {
        if (!data) throw e;
        nextLoadAt = now() + opts.retryMs;
        opts.onStaleError?.(e);
        return data;
      })
      .finally(() => { pending = null; });
    return pending;
  };
}

/** SITE_URL без пробелов и «/» в конце; пустая строка или одни пробелы — как не задан. */
export function siteOrigin(env: string | undefined): string | undefined {
  return env?.trim().replace(/\/+$/, '') || undefined;
}

type Headers = Record<string, string | string[] | undefined>;
const firstValue = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.split(',')[0]?.trim() || undefined;

/** Адреса, где порт в ссылках нужен: локальный запуск на :4000. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Адрес сайта для canonical, og:url, robots.txt и карты сайта. SITE_URL — надёжнее всего.
 * Без него адрес собирается из запроса так же, как у AngularNodeAppEngine
 * (X-Forwarded-Host/-Proto/-Port — им сервер доверяет, иначе Host), и оба хоста — Host и
 * X-Forwarded-Host — должны быть в списке разрешённых, иначе null (ответ 400).
 * Порт остаётся только у локальных адресов: подставленный в Host порт не уедет
 * в закэшированный robots.txt.
 */
export function requestOrigin(siteUrl: string | undefined, req: { protocol: string; headers: Headers }, allowed: string[]): string | null {
  if (siteUrl) return siteUrl;
  const host = firstValue(req.headers['host']);
  const forwardedHost = firstValue(req.headers['x-forwarded-host']);
  if (!isAllowedHost(host, allowed) || (forwardedHost && !isAllowedHost(forwardedHost, allowed))) return null;
  const forwardedProto = firstValue(req.headers['x-forwarded-proto'])?.toLowerCase();
  const proto = forwardedProto === 'https' || forwardedProto === 'http' ? forwardedProto : req.protocol;
  const url = new URL(`${proto}://${forwardedHost ?? host}`);
  const forwardedPort = firstValue(req.headers['x-forwarded-port']);
  if (!url.port && forwardedPort && /^\d+$/.test(forwardedPort)) url.port = forwardedPort;
  if (!LOCAL_HOSTS.has(url.hostname)) url.port = '';
  return url.origin;
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
