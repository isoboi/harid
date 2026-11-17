import { AngularNodeAppEngine, createNodeRequestHandler, isMainModule, writeResponseToNodeResponse } from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
/** Разрешённые Host: localhost + NG_ALLOWED_HOSTS (через запятую, например harid.tj,www.harid.tj). */
const allowedHosts = [
  'localhost',
  '127.0.0.1',
  ...(process.env['NG_ALLOWED_HOSTS'] ?? '').split(',').map((h) => h.trim()).filter(Boolean),
];
const angularApp = new AngularNodeAppEngine({ allowedHosts });

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
