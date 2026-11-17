# Витрина Харида на Angular SSR — дизайн

Дата: 2026-11-17
Решение: [0001](../../decisions/0001-angular-ssr-vitrina.md)
Образец внешнего вида и структуры страниц: https://harid.vercel.app (Next.js, данные зашиты в код).
Бэкенд: `disti/distributor` (публичный контракт `/api/market/*`, решение бэкенда 0004).

## Цель
Покупатель находит товары Instagram-лавок Душанбе, оформляет заказ с оплатой
наличными курьеру и отслеживает его. Владелец Instagram-магазина открывает
лавку по SMS-коду. Все данные — из реального API.

## Проект
- Папка `disti/harid`, отдельный git-репозиторий.
- Angular 19.2 (как в `distributor-admin`): standalone-компоненты, signals,
  `@angular/ssr` (Express), роутинг с `provideRouter` и серверными render modes.
- `src/environments/environment*.ts`: `apiUrl` — локально `http://localhost:3000/api`.
- Тесты — jest (как в админке), проверка шаблонов — `npm run build`.
- Языки интерфейса — только русский. Валюта — «смн», целые числа.
- Стиль — по harid.vercel.app: светлая тема, карточки товаров квадратные,
  шапка (логотип, поиск, «Продавцам», «Избранное», «Войти», «Корзина»),
  подвал («Покупателям», «Продавцам»). Шрифт и палитра — свои CSS-переменные.

## Маршруты
| Маршрут | Render mode | Данные |
|---|---|---|
| `/` | Server | `GET market/shops`, `GET market/categories`, `GET market/products?limit=24` |
| `/c/:slug` | Server | `GET market/products?category=:slug` |
| `/search?q=` | Server | `GET market/products?q=` |
| `/shop/:handle` | Server | `GET market/shops/:handle`, `GET market/products?shop=:handle` |
| `/product/:id` | Server | `GET market/products/:id` (+ товары той же лавки) |
| `/cart` | Client | корзина из `localStorage` |
| `/checkout` | Client | `POST market/orders` |
| `/order/:number` | Client | `GET market/orders/:number?phone=` |
| `/login` | Client | `POST market/auth/send-code`, `POST market/auth/verify` |
| `/me/orders` | Client | `GET market/me/orders` (Bearer) |
| `/favorites` | Client | id товаров из `localStorage` + `GET market/products/:id` |
| `/sell` | Client | `POST market/sellers/apply/send-code`, `POST market/sellers/apply` |
| `**` | Server | страница «Не найдено» (статус 404) |

## Контракт API (как есть на бэкенде)
- Лавка: `{handle, name, bio, followers, district, rating:null, delivered_orders, joined_at, avatar_color, has_fresh}`.
- Товар: `{id:string, shop_handle, title, price:int, old_price:int|null, image, category:string|null, description, sizes:string[], in_stock, posted_at}`.
  Для галереи бэкенд дополнительно отдаёт `images: string[]` (все фото товара,
  первое = `image`) — добавочное поле, прежние поля не меняются (первый шаг плана,
  репозиторий `distributor`). Если `images` пуст — галерея из одного `image`.
- Категории: `[{slug, name}]`.
- Заказ: тело `{customer:{name, phone, district, address, comment?}, slot, payment:'cash', lines:[{product_id:number, size?, qty}]}`;
  ответ `{number, created_at, customer, slot, payment, stage, items_total, delivery_total, lines[{product_id, shop_handle, title, price, image, size, qty}], shops[{shop_handle, status}]}`.
  `stage`: `placed | assembling | in_delivery | delivered | cancelled`.
- Вход: `send-code {phone}` → `verify {phone, code}` → `{token, buyer, is_new}`; токен — `Authorization: Bearer`. С токеном `POST market/orders` привязывает заказ к покупателю.
- Регистрация лавки: `sellers/apply/send-code {phone}` → `sellers/apply {handle, owner_name, phone, code}` → `{id, handle, status:'active'}`.
- Ошибки: тело `{success:false, statusCode, error:{message, errors}}` — показывать `error.message`.

## Константы оформления
Районы (`Сино`, `Фирдавсӣ`, `Шоҳмансур`, `Исмоили Сомонӣ`, `Вахдат`, `Ҳисор`),
слоты (`Сегодня, 18:00–21:00`, `Завтра, 10:00–14:00`, `Завтра, 14:00–18:00`,
`Завтра, 18:00–21:00`) и доставка (город 15 смн, `Вахдат`/`Ҳисор` 25 смн, за
каждую лавку в заказе) — копия `distributor/src/Modules/Web/Marketplace/marketplace.constants.ts`
в `src/app/core/checkout-options.ts` с комментарием-ссылкой. Эндпоинта для них нет.

## Состояние и SSR
- Корзина `{product_id, size|null, qty, snapshot товара}`, избранное (id) и токен
  покупателя — сервисы на signals, хранение в `localStorage` только в браузере
  (`isPlatformBrowser`); на сервере — пусто.
- Корзина группируется по лавкам; доставка = число лавок × тариф района.
- Данные серверных страниц передаются в браузер через HTTP transfer cache
  (`provideClientHydration(withHttpTransferCacheOptions())`) — без повторного запроса.
- Open Graph и `<title>` на серверных страницах: лавка (`@handle — Харид`, bio),
  товар (название, цена, `image`).
- Interceptor добавляет Bearer к `market/me*` и `market/orders` при наличии токена;
  401 на `me` — выход и переход на `/login?return=`.

## Тексты (новая модель)
- Блок «Деньги у нас…» заменяется: «Оплата наличными курьеру» — без предоплаты
  на чужую карту; курьер привозит заказ в выбранное время; проверяете при курьере,
  не подошло — не берёте.
- `/sell`: «Посты из вашего Instagram станут товарами на Хариде» → форма: ник
  Instagram, имя, телефон → «Получить код» → код → «Лавка открыта», ссылка на
  кабинет (`https://admin.disti.site`, из environment).
- Нет упоминаний онлайн-оплаты, Alif, «Душанбе Сити», хранения денег, выплат,
  подключения Instagram через OAuth.

## Ошибки и пустые состояния
- Текст ошибки бэкенда показывается как есть («Товар уже снят с продажи —
  обновите корзину», «Выберите размер для …», «Код уже отправлен…», 409 ника).
- Пустые списки — «Пока пусто»; нет фото — заглушка; неизвестная лавка/товар — 404-страница.
- Товар `in_stock=false` — кнопка «Нет в наличии», недоступна. Есть варианты
  (`sizes.length > 1`) — выбор обязателен; один вариант — выбран сам.

## Вне объёма
Отзывы (API возвращает `[]`), подписка на лавку, онлайн-оплата, кабинет лавки,
несколько языков, деплой (только локальная сборка и SSR-сервер).

## Проверка
- Unit: корзина (группировка, доставка, варианты), сервис API (маппинг ошибок),
  guard/interceptor токена, форма оформления, шаги `/sell`.
- `npm run build` (браузер + сервер), `npm run serve:ssr` отдаёт HTML с данными
  лавки и OG-тегами.
- Ручной e2e на локальном стенде (backend :3000): лавка ТехноМир видна → товар →
  корзина → заказ → заявка «Харид» в админке → трекинг → `/sell` открывает новую лавку.
