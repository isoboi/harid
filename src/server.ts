import { AngularNodeAppEngine, createNodeRequestHandler, isMainModule, writeResponseToNodeResponse } from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { environment } from './environments/environment';
import { allowedHostsFromEnv, isAllowedHost, loadSitemapData, requestOrigin, robotsTxt, sitemapCache, sitemapXml } from './seo-files';

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
const angularApp = new AngularNodeAppEngine({ allowedHosts });
/** Адрес сайта для canonical, og:url и карты сайта; на проде задайте SITE_URL=https://harid.tj. */
const siteUrl = process.env['SITE_URL'];

/** Товары, лавки и категории для sitemap.xml — из API не чаще раза в час. */
const sitemapData = sitemapCache(
  () => loadSitemapData(environment.apiUrl, async (url) => {
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    return r.json();
  }),
  60 * 60 * 1000,
);

/** robots.txt и sitemap.xml: адреса в них абсолютные, поэтому файлы собираются на лету. */
app.get('/robots.txt', (req, res) => {
  if (!siteUrl && !isAllowedHost(req.headers.host, allowedHosts)) { res.status(400).end(); return; }
  res.type('text/plain').set('Cache-Control', 'public, max-age=86400').send(robotsTxt(requestOrigin(siteUrl, req)));
});
app.get('/sitemap.xml', (req, res) => {
  if (!siteUrl && !isAllowedHost(req.headers.host, allowedHosts)) { res.status(400).end(); return; }
  sitemapData()
    .then((data) => res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(sitemapXml(requestOrigin(siteUrl, req), data)))
    .catch((e) => { console.error('[harid] sitemap.xml:', e); res.status(503).set('Retry-After', '600').end(); });
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
    .handle(req, { origin: requestOrigin(siteUrl, req) })
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
