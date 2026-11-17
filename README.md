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

Сервер принимает запросы только с разрешённых Host: `localhost` и `127.0.0.1` разрешены всегда, остальные задаются переменной `NG_ALLOWED_HOSTS` (через запятую). Продакшн: `NG_ALLOWED_HOSTS=harid.tj,www.harid.tj node dist/harid/server/server.mjs`.
