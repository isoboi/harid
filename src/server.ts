import { AngularNodeAppEngine, createNodeRequestHandler, isMainModule, writeResponseToNodeResponse } from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { environment } from './environments/environment';
import { allowedHostsFromEnv, loadSitemapData, requestOrigin, robotsTxt, siteOrigin, sitemapCache, sitemapXml } from './seo-files';
import { parseVitals, VITALS_PATH } from './vitals';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
/**
 * Разрешённые Host: NG_ALLOWED_HOSTS (через запятую, например harid.tj,www.harid.tj или *.harid.tj),
 * без неё — localhost и 127.0.0.1. Тот же список проверяет robots.txt и sitemap.xml.
 */
const allowedHosts = allowedHostsFromEnv(process.env['NG_ALLOWED_HOSTS']);
// Без боевого домена в NG_ALLOWED_HOSTS SSR отвечает HTTP 400 на все страницы
if (process.env['NODE_ENV'] === 'production' && !(process.env['NG_ALLOWED_HOSTS'] ?? '').trim()) {
  console.warn('[harid] NG_ALLOWED_HOSTS пуст: сервер ответит HTTP 400 на все страницы, кроме localhost. Укажите боевой домен.');
}
/**
 * Заголовки прокси, которым SSR доверяет. Любой другой X-Forwarded-* (nginx по умолчанию шлёт
 * X-Forwarded-For) Angular считает подозрительным и отдаёт пустую CSR-страницу без SEO-тегов.
 * X-Forwarded-Prefix не берём: он меняет базовый путь приложения. Переопределяется NG_TRUST_PROXY_HEADERS.
 */
const trustProxyHeaders = ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-port'];
const angularApp = new AngularNodeAppEngine({ allowedHosts, trustProxyHeaders });
/** Адрес сайта для canonical, og:url и карты сайта; на проде задайте SITE_URL=https://harid.tj. */
const siteUrl = siteOrigin(process.env['SITE_URL']);

/** Товары, лавки и категории для sitemap.xml — из API не чаще раза в час. */
const sitemapData = sitemapCache(
  () => loadSitemapData(environment.apiUrl, async (url) => {
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    return r.json();
  }),
  {
    ttlMs: 60 * 60 * 1000,
    retryMs: 10 * 60 * 1000,
    onStaleError: (e) => console.error('[harid] sitemap.xml: API недоступен, отдаём прошлые данные:', e),
  },
);

/** robots.txt и sitemap.xml: адреса в них абсолютные, поэтому файлы собираются на лету. */
app.get('/robots.txt', (req, res) => {
  const origin = requestOrigin(siteUrl, req, allowedHosts);
  if (!origin) { res.status(400).end(); return; }
  res.type('text/plain').set('Cache-Control', 'public, max-age=86400').send(robotsTxt(origin));
});
app.get('/sitemap.xml', (req, res) => {
  const origin = requestOrigin(siteUrl, req, allowedHosts);
  if (!origin) { res.status(400).end(); return; }
  sitemapData()
    // XML собирается до заголовков: ошибка не уйдёт клиенту с Cache-Control на час
    .then((data) => sitemapXml(origin, data))
    .then((xml) => res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml))
    .catch((e) => { console.error('[harid] sitemap.xml:', e); res.status(503).set({ 'Cache-Control': 'no-store', 'Retry-After': '600' }).end(); });
});

/**
 * Скорость у живых покупателей: браузер шлёт метрики (sendBeacon, text/plain), сервер пишет по строке JSON
 * на метрику — {"vital":{…},"at":"…"}. Свод по маршрутам: node scripts/vitals-report.mjs < лог.
 * Запрос не по форме — 400 без записи в лог.
 */
app.post(VITALS_PATH, express.text({ type: 'text/plain', limit: '8kb' }), (req, res) => {
  if (!requestOrigin(siteUrl, req, allowedHosts)) { res.status(400).end(); return; }
  const vitals = parseVitals(req.body);
  if (!vitals) { res.status(400).end(); return; }
  const at = new Date().toISOString();
  for (const vital of vitals) console.log(JSON.stringify({ vital, at }));
  res.status(204).end();
});
/** Слишком большое или битое тело — просто код ответа: стек ошибки в лог не пишем, иначе его засорит любой желающий. */
app.use(VITALS_PATH, (err: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(err.status && err.status >= 400 && err.status < 500 ? err.status : 400).end();
});

/** Имя с хэшем сборки (main-6YBIB7PB.js, chunk-…, styles-…): при изменении файла меняется и адрес. */
const HASHED = /-[A-Z0-9]{8}\.[a-z0-9]+$/;
/** Шрифты из public/fonts: версия в имени (golos-text-v7-latin.woff2), при обновлении шрифта меняется имя. */
const VERSIONED_FONT = /[\\/]fonts[\\/][a-z0-9-]+-v\d+[a-z0-9-]*\.woff2$/;

/**
 * Статика из /browser. Файлы сборки с хэшем в имени и шрифты с версией в имени кэшируются на год.
 * Остальные файлы из public/ (favicon, иконки, manifest) имя не меняют, поэтому браузер
 * проверяет их при каждом заходе (no-cache + ETag, обычно ответ 304).
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
    setHeaders: (res, path) => {
      if (!HASHED.test(path) && !VERSIONED_FONT.test(path)) res.setHeader('Cache-Control', 'no-cache');
    },
  }),
);

/** Всё остальное рендерит Angular (серверные маршруты из app.routes.server.ts). */
app.use('/**', (req, res, next) => {
  angularApp
    .handle(req, { origin: requestOrigin(siteUrl, req, allowedHosts) ?? undefined })
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
