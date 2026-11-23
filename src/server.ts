import { AngularNodeAppEngine, createNodeRequestHandler, isMainModule, writeResponseToNodeResponse } from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { environment } from './environments/environment';
import type { Category, Product, Shop } from './app/core/models';
import { siteOrigin } from './app/core/site-url';
import { buildSitemap, robotsTxt, type SitemapData } from './app/core/sitemap';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
/** Разрешённые Host: localhost + NG_ALLOWED_HOSTS (через запятую, например harid.tj,www.harid.tj). */
const allowedHosts = [
  'localhost',
  '127.0.0.1',
  ...(process.env['NG_ALLOWED_HOSTS'] ?? '').split(',').map((h) => h.trim()).filter(Boolean),
];
// Без боевого домена в NG_ALLOWED_HOSTS SSR отвечает HTTP 400 на все страницы
if (process.env['NODE_ENV'] === 'production' && !(process.env['NG_ALLOWED_HOSTS'] ?? '').trim()) {
  console.warn('[harid] NG_ALLOWED_HOSTS пуст: сервер ответит HTTP 400 на все страницы, кроме localhost. Укажите боевой домен.');
}
const angularApp = new AngularNodeAppEngine({ allowedHosts });

/**
 * Адрес сайта для robots.txt и sitemap.xml — по Host запроса, но только разрешённому (как и у страниц):
 * подставить чужой домен в sitemap через заголовок нельзя. Для чужого Host — null, дальше отвечает Angular (400).
 */
function originOf(req: express.Request): string | null {
  const host = (req.headers.host ?? '').toLowerCase();
  if (!allowedHosts.some((h) => h.toLowerCase() === host.replace(/:\d+$/, ''))) return null;
  const forwarded = req.headers['x-forwarded-proto'];
  return siteOrigin(`http://${host}/`, { forwardedProto: Array.isArray(forwarded) ? forwarded[0] : forwarded, production: environment.production }) || null;
}

/** Данные sitemap живут 10 минут: поисковые роботы приходят пачками, а API каждый раз опрашивать незачем. */
const SITEMAP_TTL_MS = 10 * 60 * 1000;
let sitemapCache: { at: number; data: SitemapData } | null = null;
let sitemapLoading: Promise<SitemapData | null> | null = null;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${environment.apiUrl}/market/${path}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`GET market/${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** null — API недоступен целиком; частичный ответ (например, не отдались товары) отдаём, но не кэшируем. */
async function loadSitemapData(): Promise<SitemapData | null> {
  const [categories, shops, products] = await Promise.allSettled([
    getJson<Category[]>('categories'),
    getJson<Shop[]>('shops'),
    // Большой лимит — чтобы в sitemap попали все товары; если бэкенд лимит не принимает, берём ответ по умолчанию
    getJson<Product[]>('products?limit=1000').catch(() => getJson<Product[]>('products')),
  ]);
  if (categories.status === 'rejected' && shops.status === 'rejected' && products.status === 'rejected') return null;
  const data: SitemapData = {
    categories: categories.status === 'fulfilled' ? categories.value : [],
    shops: shops.status === 'fulfilled' ? shops.value : [],
    products: products.status === 'fulfilled' ? products.value : [],
  };
  if (categories.status === 'fulfilled' && shops.status === 'fulfilled' && products.status === 'fulfilled') sitemapCache = { at: Date.now(), data };
  return data;
}

function sitemapData(): Promise<SitemapData | null> {
  if (sitemapCache && Date.now() - sitemapCache.at < SITEMAP_TTL_MS) return Promise.resolve(sitemapCache.data);
  // Одновременные запросы роботов делят одну загрузку
  sitemapLoading ??= loadSitemapData().finally(() => { sitemapLoading = null; });
  return sitemapLoading;
}

app.get('/robots.txt', (req, res, next) => {
  const origin = originOf(req);
  if (!origin) return next();
  res.type('text/plain; charset=utf-8').set('Cache-Control', 'public, max-age=3600').send(robotsTxt(origin));
});

app.get('/sitemap.xml', (req, res, next) => {
  const origin = originOf(req);
  if (!origin) return next();
  sitemapData()
    .then((data) => {
      // Пустой sitemap роботы запомнили бы как «страниц нет» — при сбое API честнее ответить 503
      if (!data) { res.status(503).set('Retry-After', '300').type('text/plain').send('Sitemap временно недоступен'); return; }
      res.type('application/xml; charset=utf-8').set('Cache-Control', 'public, max-age=600').send(buildSitemap(origin, data));
    })
    .catch(next);
});

/** Статика из /browser. */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/** Всё остальное рендерит Angular (серверные маршруты из app.routes.server.ts). */
app.use('/**', (req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/** Запуск, если модуль — точка входа. Порт из PORT, по умолчанию 4000. */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/** Обработчик запросов для Angular CLI (dev-server и сборка) и облачных функций. */
export const reqHandler = createNodeRequestHandler(app);
