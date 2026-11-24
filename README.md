# Харид — витрина

Публичная витрина маркетплейса Харид (Таджикистан, Душанбе): каталог товаров, магазины, корзина, оформление заказа с оплатой наличными и личный кабинет покупателя. Построена на Angular 19 с SSR.

Бэкенд — сервис distributor (по умолчанию `http://localhost:3000/api`, см. `src/environments/environment.ts`).

## Команды

```bash
npm install        # зависимости
npm start          # dev-сервер на http://localhost:4200/
npm test           # юнит-тесты (jest)
npm run build      # продакшн-сборка в dist/harid (браузер и сервер)
```

## Запуск SSR

После `npm run build` серверная часть запускается командой:

```bash
node dist/harid/server/server.mjs
```

По умолчанию сервер слушает порт из переменной окружения `PORT` (или 4000).

Сервер принимает запросы только с разрешённых Host: `localhost` и `127.0.0.1` разрешены всегда, остальные задаются переменной `NG_ALLOWED_HOSTS` (через запятую). **Это обязательная переменная деплоя:** если боевого домена в ней нет, SSR-сервер отвечает HTTP 400 на ВСЕ страницы. При `NODE_ENV=production` и пустой переменной при старте выводится предупреждение. Продакшн: `SITE_URL=https://harid.tj NG_ALLOWED_HOSTS=harid.tj,www.harid.tj node dist/harid/server/server.mjs`.

`SITE_URL` — адрес сайта для `canonical`, `og:url`, JSON-LD и карты сайта. Без него адрес берётся из `Host` и `X-Forwarded-Proto` запроса; за прокси без `X-Forwarded-Proto` ссылки получатся `http://`, поэтому на проде переменную лучше задать.

## SEO

- `/robots.txt` и `/sitemap.xml` собирает SSR-сервер (`src/seo-files.ts`): главная, каталог, категории, лавки и товары из `/api/market/*`. Данные карты сайта обновляются из API не чаще раза в час; если API недоступен, отдаются прошлые.
- Страницы задают title, description, Open Graph, Twitter, `canonical` (путь без query) и разметку schema.org через `SeoService` (`src/app/core/seo.service.ts`, `structured-data.ts`). Поиск помечен `noindex`.
- Иконки и манифест — в `public/` (`icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `manifest.webmanifest`).
