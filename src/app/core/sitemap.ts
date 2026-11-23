/** Пути личных и служебных страниц: в поиск они не нужны, а у части в адресе лежит токен заказа. */
export const DISALLOWED_PATHS = ['/cart', '/checkout', '/order/', '/login', '/me/', '/favorites', '/chats', '/search'] as const;

/** Лимит протокола sitemap: не больше 50 000 адресов в одном файле. */
export const SITEMAP_MAX_URLS = 50_000;

export interface SitemapData {
  categories: { slug: string }[];
  shops: { handle: string }[];
  products: { id: string; posted_at?: string }[];
}

/** robots.txt: личные страницы закрыты, витрина открыта, адрес sitemap — абсолютный. */
export function robotsTxt(origin: string): string {
  return [
    'User-agent: *',
    ...DISALLOWED_PATHS.map((p) => `Disallow: ${p}`),
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

const XML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
function esc(s: string): string { return s.replace(/[&<>"']/g, (c) => XML_ESCAPES[c]); }

/** lastmod — только дата; непонятное значение лучше пропустить, чем сломать файл. */
function lastmod(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/** sitemap.xml: главная, каталог, «Продавцам», категории, лавки и товары. */
export function buildSitemap(origin: string, data: SitemapData): string {
  const entries: { path: string; lastmod?: string }[] = [
    { path: '/' },
    { path: '/catalog' },
    { path: '/sell' },
    ...data.categories.map((c) => ({ path: `/c/${encodeURIComponent(c.slug)}` })),
    ...data.shops.map((s) => ({ path: `/shop/${encodeURIComponent(s.handle)}` })),
    ...data.products.map((p) => ({ path: `/product/${encodeURIComponent(p.id)}`, lastmod: lastmod(p.posted_at) })),
  ].slice(0, SITEMAP_MAX_URLS);
  const urls = entries.map((e) => `  <url><loc>${esc(origin + e.path)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}
