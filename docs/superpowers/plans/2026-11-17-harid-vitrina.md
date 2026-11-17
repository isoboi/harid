# Витрина Харида на Angular SSR — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Новый фронтенд витрины Харида (`disti/harid`) на Angular 19 SSR, работающий с реальным API `/api/market/*`.

**Architecture:** Отдельное Angular-приложение со standalone-компонентами и signals. Публичные страницы (главная, категория, поиск, лавка, товар) рендерятся на сервере с Open Graph, личные (корзина, оформление, вход, заказы, `/sell`) — в браузере. Один `MarketApi`-сервис на `HttpClient`, состояние корзины/избранного/токена — сервисы на signals с `localStorage` только в браузере.

**Tech Stack:** Angular 19.2, `@angular/ssr` (Express), jest 29 + jest-preset-angular 14, SCSS. Бэкенд — NestJS (`disti/distributor`).

**Spec:** `docs/superpowers/specs/2026-11-17-harid-vitrina-design.md` (в этом репозитории). Решение — `docs/decisions/0001-angular-ssr-vitrina.md`.

## Global Constraints

- Angular **19.2** (как `distributor-admin`), standalone, signals, без NgModules.
- Весь текст интерфейса — на русском. Валюта — «смн», цены — целые числа.
- Комментарии в коде и сообщения коммитов — на русском.
- Никаких упоминаний онлайн-оплаты, Alif, «Душанбе Сити», хранения денег у Харида, выплат, OAuth-подключения Instagram.
- `window`, `document`, `localStorage` — только под `isPlatformBrowser` (код выполняется и на сервере).
- Контракт API менять нельзя, кроме добавочного поля `images` (Task 1).
- Ошибку бэкенда показывать из `error.error.message`; тело ошибки: `{success:false, statusCode, error:{message, errors}}`.
- API локально: `http://localhost:3000/api`. Кабинет лавки: `https://admin.disti.site`.
- Коммиты только локально, без push.

---

## Структура файлов (harid)

```
harid/
  angular.json, package.json, tsconfig*.json, jest.config.js, setup-jest.ts
  server.ts                                  # Express SSR (генерирует CLI)
  src/main.ts, main.server.ts, index.html, styles.scss
  src/environments/environment.ts            # apiUrl, cabinetUrl (dev)
  src/environments/environment.prod.ts
  src/app/app.component.ts                   # шапка + router-outlet + подвал
  src/app/app.config.ts, app.config.server.ts, app.routes.ts, app.routes.server.ts
  src/app/core/models.ts                     # типы контракта API
  src/app/core/market-api.service.ts         # все вызовы /market/*
  src/app/core/api-error.ts                  # apiErrorMessage(err)
  src/app/core/checkout-options.ts           # районы, слоты, доставка
  src/app/core/browser-storage.service.ts    # localStorage только в браузере
  src/app/core/cart.service.ts               # корзина (signals)
  src/app/core/favorites.service.ts          # избранное (signals)
  src/app/core/auth.service.ts               # токен и покупатель
  src/app/core/auth.interceptor.ts           # Bearer для me*/orders
  src/app/core/seo.service.ts                # title + Open Graph
  src/app/shared/header.component.ts, footer.component.ts
  src/app/shared/product-card.component.ts, shop-strip.component.ts, money.pipe.ts
  src/app/pages/home/…, category/…, search/…, shop/…, product/…
  src/app/pages/cart/…, checkout/…, order/…, login/…, my-orders/…, favorites/…, sell/…, not-found/…
```

---

### Task 1: Бэкенд — поле `images` у товара витрины

Репозиторий `C:/Users/DIYORBEK/Desktop/nestjs/disti/distributor`. В основном checkout ветки `feat/marketplace-bayzo` лежит незакоммиченная работа владельца — **не трогать её**. Работать в отдельном worktree:

```bash
cd C:/Users/DIYORBEK/Desktop/nestjs/disti/distributor
git worktree add .worktrees/harid-images -b feat/harid-images feat/marketplace-bayzo
cd .worktrees/harid-images
cmd //c mklink /J node_modules ..\\..\\node_modules
cp ../../.env .env
```

**Files:**
- Modify: `src/Modules/Storefront/storefront-catalog.service.ts` (интерфейс `MarketProduct`, метод `mapProduct`)
- Test: `src/Modules/Storefront/storefront-catalog.service.spec.ts`

**Interfaces:**
- Produces: `MarketProduct.images: string[]` — последнее поле объекта товара (после `posted_at`), все фото `goods.images` по порядку; `[]`, если фото нет. `image` остаётся `images[0] ?? ''`.

- [ ] **Step 1: Тест.** В `storefront-catalog.service.spec.ts`, в существующем тесте порядка ключей `mapProduct` (ищите `Object.keys`), добавьте `'images'` в конец ожидаемого списка ключей; добавьте тест:

```ts
it('отдаёт все фото товара в images, первое — image', async () => {
  // используйте ту же фабрику товара, что соседние тесты getProduct
  const goods = makeGoods({ images: ['a.jpg', 'b.jpg', 'c.jpg'] });
  qb.getOne.mockResolvedValue(goods);
  const p = await service.getProduct(goods.id);
  expect(p.image).toBe('a.jpg');
  expect(p.images).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
});

it('images — пустой массив, если фото нет', async () => {
  const goods = makeGoods({ images: [] });
  qb.getOne.mockResolvedValue(goods);
  const p = await service.getProduct(goods.id);
  expect(p.image).toBe('');
  expect(p.images).toEqual([]);
});
```

(Если фабрика/мок в спеке называются иначе — используйте их имена; смысл тестов не менять.)

- [ ] **Step 2:** `npx jest src/Modules/Storefront/storefront-catalog.service.spec.ts` — FAIL (`images` нет).
- [ ] **Step 3: Реализация.** В `MarketProduct` после `posted_at: Date;` добавить `images: string[];`. В `mapProduct` последним полем: `images: Array.isArray(g.images) ? g.images : [],`.
- [ ] **Step 4:** `npx jest src/Modules/Storefront src/Modules/Web/Marketplace` и `npx tsc --noEmit -p tsconfig.json` — PASS.
- [ ] **Step 5: Коммит**

```bash
git add src/Modules/Storefront/storefront-catalog.service.ts src/Modules/Storefront/storefront-catalog.service.spec.ts
git commit -m "feat(storefront): все фото товара витрины в поле images"
```

---

### Task 2: Каркас проекта Angular 19 SSR, jest, оболочка

**Files:**
- Create: весь каркас в `C:/Users/DIYORBEK/Desktop/nestjs/disti/harid` (репозиторий уже существует, в нём только `docs/`).
- Create: `jest.config.js`, `setup-jest.ts`, `tsconfig.spec.json`, `src/environments/*`, `src/app/app.component.ts`, `src/app/shared/header.component.ts`, `src/app/shared/footer.component.ts`, `src/app/pages/not-found/not-found.component.ts`, `src/app/app.routes.ts`, `src/app/app.routes.server.ts`, `src/styles.scss`
- Test: `src/app/app.component.spec.ts`

**Interfaces:**
- Produces: `environment.apiUrl: string`, `environment.cabinetUrl: string`; маршруты из спецификации (страницы — заглушки `NotFoundComponent` до своих задач подменяются ленивыми `loadComponent`); CSS-переменные в `styles.scss`: `--bg #fff`, `--surface #f6f6f4`, `--text #141414`, `--muted #6b6b6b`, `--accent #e8432e`, `--line #e7e7e3`, `--radius 14px`.

- [ ] **Step 1: Генерация в соседней папке и перенос** (CLI не умеет в непустую папку с `.git` без конфликтов):

```bash
cd C:/Users/DIYORBEK/Desktop/nestjs/disti
npx -y @angular/cli@19.2 new harid-tmp --ssr --style=scss --routing --skip-git --skip-tests=false --package-manager=npm --defaults
cp -r harid-tmp/. harid/ && rm -rf harid-tmp
cd harid
```

- [ ] **Step 2: jest вместо karma**

```bash
npm remove karma karma-chrome-launcher karma-coverage karma-jasmine karma-jasmine-html-reporter jasmine-core @types/jasmine
npm i -D jest@29 jest-preset-angular@14 @types/jest@29
```

`jest.config.js`:

```js
/** Jest для Angular (jest-preset-angular, zone). */
module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
};
```

`setup-jest.ts`:

```ts
import presetAngular from 'jest-preset-angular/setup-env/zone';

presetAngular.setupZoneTestEnv();
```

`tsconfig.spec.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
    "module": "CommonJS",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "types": ["jest", "node"]
  },
  "include": ["src/**/*.spec.ts", "src/**/*.d.ts", "setup-jest.ts"]
}
```

В `package.json`: `"test": "jest"`. В `angular.json` удалить секцию `test` (karma).

- [ ] **Step 3: environments**

`src/environments/environment.ts`:

```ts
/** Локальная разработка: бэкенд distributor на :3000. */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  cabinetUrl: 'https://admin.disti.site',
};
```

`src/environments/environment.prod.ts` — то же с `production: true` и `apiUrl: 'https://api.disti.site/api'`. В `angular.json` → `configurations.production.fileReplacements` заменить `environment.ts` на `environment.prod.ts`.

- [ ] **Step 4: Тест оболочки** `src/app/app.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  it('рисует шапку с навигацией и подвал', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
    const f = TestBed.createComponent(AppComponent);
    f.detectChanges();
    const text = f.nativeElement.textContent as string;
    for (const s of ['Харид', 'Продавцам', 'Избранное', 'Войти', 'Корзина', 'Покупателям']) {
      expect(text).toContain(s);
    }
  });
});
```

- [ ] **Step 5:** `npx jest` — FAIL.
- [ ] **Step 6: Реализация оболочки.**

`src/app/shared/header.component.ts`:

```ts
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

/** Шапка витрины: логотип, поиск, ссылки. Счётчик корзины добавит Task 4. */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <header class="hdr">
      <a routerLink="/" class="logo" aria-label="Харид — на главную">Харид</a>
      <form class="search" (ngSubmit)="search()">
        <input name="q" [(ngModel)]="q" placeholder="Поиск по товарам" aria-label="Поиск по товарам" />
      </form>
      <nav class="nav">
        <a routerLink="/sell">Продавцам</a>
        <a routerLink="/favorites">Избранное</a>
        <a routerLink="/login">Войти</a>
        <a routerLink="/cart" class="cart">Корзина</a>
      </nav>
    </header>
  `,
  styles: `
    .hdr { display:flex; gap:16px; align-items:center; padding:12px 16px; border-bottom:1px solid var(--line); position:sticky; top:0; background:var(--bg); z-index:10 }
    .logo { font-weight:800; font-size:22px; color:var(--text); text-decoration:none }
    .search { flex:1 } .search input { width:100%; padding:10px 14px; border:1px solid var(--line); border-radius:999px; background:var(--surface) }
    .nav { display:flex; gap:14px } .nav a { color:var(--text); text-decoration:none; font-size:14px }
    @media (max-width: 640px) { .nav a:not(.cart) { display:none } }
  `,
})
export class HeaderComponent {
  private readonly router = inject(Router);
  q = '';
  search(): void {
    const q = this.q.trim();
    if (q) this.router.navigate(['/search'], { queryParams: { q } });
  }
}
```

`src/app/shared/footer.component.ts`:

```ts
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="ftr">
      <div><b>Покупателям</b><a routerLink="/" fragment="cash">Оплата наличными курьеру</a><a routerLink="/me/orders">Мои заказы</a></div>
      <div><b>Продавцам</b><a routerLink="/sell">Открыть лавку</a></div>
    </footer>
  `,
  styles: `
    .ftr { display:flex; gap:48px; padding:32px 16px; border-top:1px solid var(--line); margin-top:48px; color:var(--muted) }
    .ftr div { display:flex; flex-direction:column; gap:8px } .ftr a { color:var(--muted); text-decoration:none }
  `,
})
export class FooterComponent {}
```

`src/app/app.component.ts`:

```ts
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/header.component';
import { FooterComponent } from './shared/footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  template: `<app-header /><main class="page"><router-outlet /></main><app-footer />`,
  styles: `.page { max-width: 1200px; margin: 0 auto; padding: 16px }`,
})
export class AppComponent {}
```

`src/app/pages/not-found/not-found.component.ts`:

```ts
import { Component, Inject, Optional, RESPONSE_INIT } from '@angular/core';
import { RouterLink } from '@angular/router';

/** 404: на сервере ставит статус ответа. */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `<section class="nf"><h1>Страница не найдена</h1><a routerLink="/">На главную</a></section>`,
  styles: `.nf { text-align:center; padding:80px 0 }`,
})
export class NotFoundComponent {
  constructor(@Optional() @Inject(RESPONSE_INIT) res: ResponseInit | null) {
    if (res) (res as { status?: number }).status = 404;
  }
}
```

(Если в 19.2 `RESPONSE_INIT` экспортируется из `@angular/core` иначе — используйте `import { RESPONSE_INIT } from '@angular/core'` как в документации 19 «server routing»; без него 404-статус не ставится, страница всё равно рисуется.)

`src/app/app.routes.ts` (страницы подключаются в своих задачах; пока все ведут на заглушку):

```ts
import { Routes } from '@angular/router';
import { NotFoundComponent } from './pages/not-found/not-found.component';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent) },
  { path: '**', component: NotFoundComponent },
];
```

`src/app/app.routes.server.ts`:

```ts
import { RenderMode, ServerRoute } from '@angular/ssr';

/** Публичные страницы — на сервере (OG, поисковики); личные — в браузере. */
export const serverRoutes: ServerRoute[] = [
  { path: 'cart', renderMode: RenderMode.Client },
  { path: 'checkout', renderMode: RenderMode.Client },
  { path: 'order/:number', renderMode: RenderMode.Client },
  { path: 'login', renderMode: RenderMode.Client },
  { path: 'me/orders', renderMode: RenderMode.Client },
  { path: 'favorites', renderMode: RenderMode.Client },
  { path: 'sell', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];
```

`src/app/app.config.ts` — провайдеры: `provideZoneChangeDetection({ eventCoalescing: true })`, `provideRouter(routes, withComponentInputBinding())`, `provideHttpClient(withFetch())`, `provideClientHydration(withHttpTransferCacheOptions({ includePostRequests: false }))`. `app.config.server.ts` — как сгенерировал CLI с `provideServerRouting(serverRoutes)` (в 19.2: `provideServerRendering()` + `provideServerRouting(serverRoutes)` из `@angular/ssr`).

`src/styles.scss`:

```scss
:root { --bg:#fff; --surface:#f6f6f4; --text:#141414; --muted:#6b6b6b; --accent:#e8432e; --line:#e7e7e3; --radius:14px; }
* { box-sizing: border-box; }
body { margin:0; font-family: Inter, system-ui, -apple-system, 'Segoe UI', sans-serif; color:var(--text); background:var(--bg); }
button { font:inherit; cursor:pointer; }
.btn { padding:12px 20px; border-radius:999px; border:0; background:var(--text); color:#fff; }
.btn:disabled { opacity:.4; cursor:default; }
.btn--ghost { background:transparent; color:var(--text); border:1px solid var(--line); }
.error { color:#b3261e; }
.muted { color:var(--muted); }
```

`src/index.html`: `<html lang="ru">`, `<title>Харид — Instagram-магазины Душанбе</title>`.

- [ ] **Step 7:** `npx jest` — PASS; `npm run build` — успех (браузер + сервер).
- [ ] **Step 8: Коммит**

```bash
git add -A
git commit -m "feat: каркас витрины Харида на Angular 19 SSR"
```

---

### Task 3: Ядро — модели, API, ошибки, константы оформления

**Files:**
- Create: `src/app/core/models.ts`, `src/app/core/api-error.ts`, `src/app/core/market-api.service.ts`, `src/app/core/checkout-options.ts`, `src/app/shared/money.pipe.ts`
- Test: `src/app/core/market-api.service.spec.ts`, `src/app/core/api-error.spec.ts`, `src/app/core/checkout-options.spec.ts`

**Interfaces:**
- Produces (все последующие задачи используют эти имена):

```ts
// models.ts
export interface Category { slug: string; name: string }
export interface Shop { handle: string; name: string; bio: string; followers: number; district: string | null; rating: number | null; delivered_orders: number; joined_at: string; avatar_color: string; has_fresh: boolean }
export interface Product { id: string; shop_handle: string; title: string; price: number; old_price: number | null; image: string; category: string | null; description: string; sizes: string[]; in_stock: boolean; posted_at: string; images?: string[] }
export type OrderStage = 'placed' | 'assembling' | 'in_delivery' | 'delivered' | 'cancelled';
export interface OrderCustomer { name: string; phone: string; district: string; address: string; comment?: string }
export interface OrderLineInput { product_id: number; size?: string; qty: number }
export interface CreateOrderInput { customer: OrderCustomer; slot: string; payment: 'cash'; lines: OrderLineInput[] }
export interface OrderLine { product_id: string; shop_handle: string; title: string; price: number; image: string; size: string | null; qty: number }
export interface Order { number: string; created_at: string; customer: OrderCustomer; slot: string; payment: 'cash'; stage: OrderStage; items_total: number; delivery_total: number; lines: OrderLine[]; shops: { shop_handle: string; status: string }[] }
export interface Buyer { id: number; phone: string; name: string | null }
export interface VerifyResult { token: string; buyer: Buyer; is_new: boolean }
export interface ProductQuery { category?: string; shop?: string; q?: string; limit?: number }

// api-error.ts
export function apiErrorMessage(err: unknown): string;

// market-api.service.ts — @Injectable({providedIn:'root'}) class MarketApi
categories(): Observable<Category[]>;
shops(): Observable<Shop[]>;
shop(handle: string): Observable<Shop>;
products(q?: ProductQuery): Observable<Product[]>;
product(id: string): Observable<Product>;
placeOrder(body: CreateOrderInput): Observable<Order>;
order(number: string, phone: string): Observable<Order>;
sendCode(phone: string): Observable<unknown>;
verify(phone: string, code: string): Observable<VerifyResult>;
me(): Observable<Buyer>;
myOrders(): Observable<Order[]>;
sellerSendCode(phone: string): Observable<unknown>;
sellerApply(body: { handle: string; owner_name: string; phone: string; code: string }): Observable<{ id: number; handle: string; status: string }>;

// checkout-options.ts
export const DISTRICTS: string[]; export const SLOTS: string[];
export function deliveryFor(district: string): number;   // 15 | 25
export const STAGE_LABEL: Record<OrderStage, string>;

// money.pipe.ts — pipe 'money': 1250 → '1 250 смн'
```

(`Buyer` — проверьте форму `mapBuyer` в `distributor/src/Modules/Web/Marketplace/market-auth.service.ts` и приведите интерфейс к фактическим полям.)

- [ ] **Step 1: Тесты**

`src/app/core/api-error.spec.ts`:

```ts
import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from './api-error';

describe('apiErrorMessage', () => {
  it('берёт error.error.message бэкенда', () => {
    const e = new HttpErrorResponse({ status: 400, error: { success: false, statusCode: 400, error: { message: 'Выберите размер для «Платье»', errors: [] } } });
    expect(apiErrorMessage(e)).toBe('Выберите размер для «Платье»');
  });
  it('422 с полями — первое сообщение поля', () => {
    const e = new HttpErrorResponse({ status: 422, error: { error: { message: 'Validation failed', errors: { phone: ['Неверный номер'] } } } });
    expect(apiErrorMessage(e)).toBe('Неверный номер');
  });
  it('нет сети — понятный текст', () => {
    expect(apiErrorMessage(new HttpErrorResponse({ status: 0 }))).toBe('Нет связи с сервером. Проверьте интернет.');
  });
  it('неизвестная ошибка — общий текст', () => {
    expect(apiErrorMessage(new Error('x'))).toBe('Что-то пошло не так. Попробуйте ещё раз.');
  });
});
```

`src/app/core/checkout-options.spec.ts`:

```ts
import { deliveryFor, DISTRICTS, SLOTS } from './checkout-options';

describe('checkout-options', () => {
  it('город 15, Вахдат и Ҳисор 25', () => {
    expect(deliveryFor('Сино')).toBe(15);
    expect(deliveryFor('Вахдат')).toBe(25);
    expect(deliveryFor('Ҳисор')).toBe(25);
  });
  it('районы и слоты как на бэкенде', () => {
    expect(DISTRICTS).toEqual(['Сино', 'Фирдавсӣ', 'Шоҳмансур', 'Исмоили Сомонӣ', 'Вахдат', 'Ҳисор']);
    expect(SLOTS).toEqual(['Сегодня, 18:00–21:00', 'Завтра, 10:00–14:00', 'Завтра, 14:00–18:00', 'Завтра, 18:00–21:00']);
  });
});
```

`src/app/core/market-api.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MarketApi } from './market-api.service';
import { environment } from '../../environments/environment';

describe('MarketApi', () => {
  let api: MarketApi; let http: HttpTestingController;
  const B = environment.apiUrl + '/market';
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(MarketApi); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('products: только заданные параметры', () => {
    api.products({ shop: 'technomir.tj', limit: 24 }).subscribe();
    const r = http.expectOne((req) => req.url === `${B}/products`);
    expect(r.request.params.get('shop')).toBe('technomir.tj');
    expect(r.request.params.get('limit')).toBe('24');
    expect(r.request.params.has('q')).toBe(false);
    r.flush([]);
  });
  it('shop: handle кодируется', () => {
    api.shop('a.b').subscribe();
    http.expectOne(`${B}/shops/a.b`).flush({});
  });
  it('order: телефон в query', () => {
    api.order('R-1', '931110002').subscribe();
    const r = http.expectOne((req) => req.url === `${B}/orders/R-1`);
    expect(r.request.params.get('phone')).toBe('931110002');
    r.flush({});
  });
  it('placeOrder: POST тела как есть', () => {
    const body = { customer: { name: 'А', phone: '931110002', district: 'Сино', address: 'ул' }, slot: 'Сегодня, 18:00–21:00', payment: 'cash' as const, lines: [{ product_id: 16, qty: 1 }] };
    api.placeOrder(body).subscribe();
    const r = http.expectOne(`${B}/orders`);
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual(body);
    r.flush({});
  });
  it('sellerApply и sellerSendCode — свои маршруты', () => {
    api.sellerSendCode('931110001').subscribe();
    http.expectOne(`${B}/sellers/apply/send-code`).flush({});
    api.sellerApply({ handle: 'x', owner_name: 'Имя', phone: '931110001', code: '000000' }).subscribe();
    http.expectOne(`${B}/sellers/apply`).flush({});
  });
});
```

- [ ] **Step 2:** `npx jest src/app/core` — FAIL.
- [ ] **Step 3: Реализация**

`src/app/core/api-error.ts`:

```ts
import { HttpErrorResponse } from '@angular/common/http';

/** Текст ошибки для пользователя: сообщение бэкенда как есть. */
export function apiErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Нет связи с сервером. Проверьте интернет.';
    const body = err.error?.error;
    const fields = body?.errors;
    if (fields && !Array.isArray(fields) && typeof fields === 'object') {
      const first = Object.values(fields as Record<string, string[]>)[0]?.[0];
      if (first) return first;
    }
    if (typeof body?.message === 'string' && body.message) return body.message;
  }
  return 'Что-то пошло не так. Попробуйте ещё раз.';
}
```

`src/app/core/checkout-options.ts`:

```ts
import { OrderStage } from './models';

/**
 * Копия distributor/src/Modules/Web/Marketplace/marketplace.constants.ts
 * (MARKET_DISTRICTS, DELIVERY_SLOTS, deliveryFor). Эндпоинта нет — меняйте в обоих местах.
 */
export const SUBURBS = ['Вахдат', 'Ҳисор'];
export const DISTRICTS = ['Сино', 'Фирдавсӣ', 'Шоҳмансур', 'Исмоили Сомонӣ', ...SUBURBS];
export const SLOTS = ['Сегодня, 18:00–21:00', 'Завтра, 10:00–14:00', 'Завтра, 14:00–18:00', 'Завтра, 18:00–21:00'];
export const deliveryFor = (district: string): number => (SUBURBS.includes(district) ? 25 : 15);

export const STAGE_LABEL: Record<OrderStage, string> = {
  placed: 'Принят',
  assembling: 'Собирается',
  in_delivery: 'Курьер в пути',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
};
```

`src/app/core/market-api.service.ts`:

```ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Buyer, Category, CreateOrderInput, Order, Product, ProductQuery, Shop, VerifyResult } from './models';

/** Все вызовы публичного API витрины /market/*. */
@Injectable({ providedIn: 'root' })
export class MarketApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/market`;

  categories(): Observable<Category[]> { return this.http.get<Category[]>(`${this.base}/categories`); }
  shops(): Observable<Shop[]> { return this.http.get<Shop[]>(`${this.base}/shops`); }
  shop(handle: string): Observable<Shop> { return this.http.get<Shop>(`${this.base}/shops/${encodeURIComponent(handle)}`); }
  products(q: ProductQuery = {}): Observable<Product[]> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') params = params.set(k, String(v));
    return this.http.get<Product[]>(`${this.base}/products`, { params });
  }
  product(id: string): Observable<Product> { return this.http.get<Product>(`${this.base}/products/${encodeURIComponent(id)}`); }
  placeOrder(body: CreateOrderInput): Observable<Order> { return this.http.post<Order>(`${this.base}/orders`, body); }
  order(number: string, phone: string): Observable<Order> {
    return this.http.get<Order>(`${this.base}/orders/${encodeURIComponent(number)}`, { params: { phone } });
  }
  sendCode(phone: string) { return this.http.post(`${this.base}/auth/send-code`, { phone }); }
  verify(phone: string, code: string): Observable<VerifyResult> { return this.http.post<VerifyResult>(`${this.base}/auth/verify`, { phone, code }); }
  me(): Observable<Buyer> { return this.http.get<Buyer>(`${this.base}/me`); }
  myOrders(): Observable<Order[]> { return this.http.get<Order[]>(`${this.base}/me/orders`); }
  sellerSendCode(phone: string) { return this.http.post(`${this.base}/sellers/apply/send-code`, { phone }); }
  sellerApply(body: { handle: string; owner_name: string; phone: string; code: string }) {
    return this.http.post<{ id: number; handle: string; status: string }>(`${this.base}/sellers/apply`, body);
  }
}
```

`src/app/shared/money.pipe.ts`:

```ts
import { Pipe, PipeTransform } from '@angular/core';

/** 1250 → «1 250 смн». */
@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(v: number | null | undefined): string {
    if (v === null || v === undefined) return '';
    return `${Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} смн`;
  }
}
```

`models.ts` — как в блоке Interfaces.

- [ ] **Step 4:** `npx jest src/app` — PASS.
- [ ] **Step 5: Коммит** `git add src/app/core src/app/shared/money.pipe.ts && git commit -m "feat: API витрины, модели, константы оформления"`

---

### Task 4: Состояние — хранилище, корзина, избранное, вход покупателя

**Files:**
- Create: `src/app/core/browser-storage.service.ts`, `cart.service.ts`, `favorites.service.ts`, `auth.service.ts`, `auth.interceptor.ts`
- Modify: `src/app/app.config.ts` (`withInterceptors([authInterceptor])`), `src/app/shared/header.component.ts` (счётчик корзины, «Войти»/«Мои заказы»)
- Test: `cart.service.spec.ts`, `favorites.service.spec.ts`, `auth.interceptor.spec.ts`

**Interfaces:**
- Consumes: `Product`, `deliveryFor` (Task 3).
- Produces:

```ts
// browser-storage.service.ts
class BrowserStorage { get<T>(key: string, fallback: T): T; set(key: string, value: unknown): void; remove(key: string): void }

// cart.service.ts
export interface CartItem { product: Product; size: string | null; qty: number }
export interface CartGroup { shop_handle: string; items: CartItem[]; subtotal: number }
class CartService {
  items: Signal<CartItem[]>; count: Signal<number>; groups: Signal<CartGroup[]>; itemsTotal: Signal<number>;
  add(product: Product, size: string | null, qty?: number): void;   // тот же товар+вариант → qty суммируется
  setQty(productId: string, size: string | null, qty: number): void; // qty<=0 → удалить
  remove(productId: string, size: string | null): void;
  clear(): void;
  deliveryTotal(district: string): number;  // число лавок × deliveryFor(district)
  toOrderLines(): OrderLineInput[];          // {product_id:Number(id), size?, qty}
}

// favorites.service.ts
class FavoritesService { ids: Signal<string[]>; has(id: string): boolean; toggle(id: string): void }

// auth.service.ts
class AuthService { token: Signal<string | null>; buyer: Signal<Buyer | null>; loggedIn: Signal<boolean>; setSession(r: VerifyResult): void; logout(): void }

// auth.interceptor.ts
export const authInterceptor: HttpInterceptorFn;  // Bearer к /market/me*, /market/orders (POST); 401 на /market/me* → logout
```

Ключи `localStorage`: `harid.cart`, `harid.fav`, `harid.token`, `harid.buyer`.

- [ ] **Step 1: Тесты**

`src/app/core/cart.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { CartService } from './cart.service';
import { Product } from './models';

const p = (id: string, shop: string, price: number, sizes: string[] = []): Product =>
  ({ id, shop_handle: shop, title: 'T' + id, price, old_price: null, image: '', category: null, description: '', sizes, in_stock: true, posted_at: '' });

describe('CartService', () => {
  let cart: CartService;
  beforeEach(() => { localStorage.clear(); TestBed.configureTestingModule({}); cart = TestBed.inject(CartService); });

  it('тот же товар и вариант — количество суммируется, разный вариант — отдельная строка', () => {
    cart.add(p('1', 'a', 100, ['S', 'M']), 'S');
    cart.add(p('1', 'a', 100, ['S', 'M']), 'S', 2);
    cart.add(p('1', 'a', 100, ['S', 'M']), 'M');
    expect(cart.items().map((i) => [i.size, i.qty])).toEqual([['S', 3], ['M', 1]]);
    expect(cart.count()).toBe(4);
  });
  it('группы по лавкам, итог товаров и доставка за каждую лавку', () => {
    cart.add(p('1', 'a', 100), null, 2);
    cart.add(p('2', 'b', 50), null);
    expect(cart.groups().map((g) => [g.shop_handle, g.subtotal])).toEqual([['a', 200], ['b', 50]]);
    expect(cart.itemsTotal()).toBe(250);
    expect(cart.deliveryTotal('Сино')).toBe(30);
    expect(cart.deliveryTotal('Вахдат')).toBe(50);
  });
  it('setQty 0 удаляет; toOrderLines — числа и размер только если есть', () => {
    cart.add(p('1', 'a', 100), null);
    cart.add(p('2', 'a', 100, ['S', 'M']), 'M', 2);
    cart.setQty('1', null, 0);
    expect(cart.toOrderLines()).toEqual([{ product_id: 2, size: 'M', qty: 2 }]);
  });
  it('сохраняется в localStorage и читается новым экземпляром', () => {
    cart.add(p('1', 'a', 100), null, 3);
    TestBed.resetTestingModule(); TestBed.configureTestingModule({});
    expect(TestBed.inject(CartService).count()).toBe(3);
  });
});
```

`src/app/core/favorites.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  beforeEach(() => { localStorage.clear(); TestBed.configureTestingModule({}); });
  it('toggle добавляет и убирает', () => {
    const f = TestBed.inject(FavoritesService);
    f.toggle('5'); expect(f.has('5')).toBe(true);
    f.toggle('5'); expect(f.has('5')).toBe(false);
  });
});
```

`src/app/core/auth.interceptor.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient; let ctl: HttpTestingController; let auth: AuthService;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpClient); ctl = TestBed.inject(HttpTestingController); auth = TestBed.inject(AuthService);
    auth.setSession({ token: 'tok', buyer: { id: 1, phone: '+992931110002', name: null }, is_new: false });
  });
  it('Bearer к /market/me и POST /market/orders', () => {
    http.get('http://x/api/market/me').subscribe();
    expect(ctl.expectOne('http://x/api/market/me').request.headers.get('Authorization')).toBe('Bearer tok');
    http.post('http://x/api/market/orders', {}).subscribe();
    expect(ctl.expectOne('http://x/api/market/orders').request.headers.get('Authorization')).toBe('Bearer tok');
  });
  it('без Bearer к каталогу', () => {
    http.get('http://x/api/market/products').subscribe();
    expect(ctl.expectOne('http://x/api/market/products').request.headers.has('Authorization')).toBe(false);
  });
  it('401 на /market/me — выход', () => {
    http.get('http://x/api/market/me').subscribe({ error: () => undefined });
    ctl.expectOne('http://x/api/market/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.loggedIn()).toBe(false);
  });
});
```

- [ ] **Step 2:** `npx jest src/app/core` — FAIL.
- [ ] **Step 3: Реализация**

`browser-storage.service.ts`:

```ts
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** localStorage только в браузере; на сервере — fallback и no-op. */
@Injectable({ providedIn: 'root' })
export class BrowserStorage {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  get<T>(key: string, fallback: T): T {
    if (!this.browser) return fallback;
    try { const raw = localStorage.getItem(key); return raw === null ? fallback : (JSON.parse(raw) as T); } catch { return fallback; }
  }
  set(key: string, value: unknown): void { if (this.browser) try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* квота/приватный режим */ } }
  remove(key: string): void { if (this.browser) try { localStorage.removeItem(key); } catch { /* ignore */ } }
}
```

`cart.service.ts`:

```ts
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { BrowserStorage } from './browser-storage.service';
import { deliveryFor } from './checkout-options';
import { OrderLineInput, Product } from './models';

export interface CartItem { product: Product; size: string | null; qty: number }
export interface CartGroup { shop_handle: string; items: CartItem[]; subtotal: number }

const KEY = 'harid.cart';
const same = (i: CartItem, id: string, size: string | null) => i.product.id === id && i.size === size;

/** Корзина: строки по товару и варианту; доставка — за каждую лавку. */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly store = inject(BrowserStorage);
  private readonly state = signal<CartItem[]>(this.store.get<CartItem[]>(KEY, []));
  readonly items = this.state.asReadonly();
  readonly count = computed(() => this.state().reduce((n, i) => n + i.qty, 0));
  readonly groups = computed<CartGroup[]>(() => {
    const map = new Map<string, CartItem[]>();
    for (const i of this.state()) map.set(i.product.shop_handle, [...(map.get(i.product.shop_handle) ?? []), i]);
    return [...map].map(([shop_handle, items]) => ({ shop_handle, items, subtotal: items.reduce((s, i) => s + i.product.price * i.qty, 0) }));
  });
  readonly itemsTotal = computed(() => this.groups().reduce((s, g) => s + g.subtotal, 0));

  constructor() { effect(() => this.store.set(KEY, this.state())); }

  add(product: Product, size: string | null, qty = 1): void {
    this.state.update((list) => list.some((i) => same(i, product.id, size))
      ? list.map((i) => (same(i, product.id, size) ? { ...i, qty: i.qty + qty, product } : i))
      : [...list, { product, size, qty }]);
  }
  setQty(id: string, size: string | null, qty: number): void {
    if (qty <= 0) return this.remove(id, size);
    this.state.update((list) => list.map((i) => (same(i, id, size) ? { ...i, qty } : i)));
  }
  remove(id: string, size: string | null): void { this.state.update((list) => list.filter((i) => !same(i, id, size))); }
  clear(): void { this.state.set([]); }
  deliveryTotal(district: string): number { return this.groups().length * deliveryFor(district); }
  toOrderLines(): OrderLineInput[] {
    return this.state().map((i) => ({ product_id: Number(i.product.id), ...(i.size ? { size: i.size } : {}), qty: i.qty }));
  }
}
```

Тест «сохраняется в localStorage» требует, чтобы `effect` успел выполниться: в тесте после `add` вызовите `TestBed.flushEffects()` перед `resetTestingModule` (добавьте эту строку в тест).

`favorites.service.ts`:

```ts
import { effect, inject, Injectable, signal } from '@angular/core';
import { BrowserStorage } from './browser-storage.service';

/** Избранное — id товаров в браузере. */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly store = inject(BrowserStorage);
  private readonly state = signal<string[]>(this.store.get<string[]>('harid.fav', []));
  readonly ids = this.state.asReadonly();
  constructor() { effect(() => this.store.set('harid.fav', this.state())); }
  has(id: string): boolean { return this.state().includes(id); }
  toggle(id: string): void { this.state.update((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id])); }
}
```

`auth.service.ts`:

```ts
import { computed, inject, Injectable, signal } from '@angular/core';
import { BrowserStorage } from './browser-storage.service';
import { Buyer, VerifyResult } from './models';

/** Сессия покупателя: токен и профиль в браузере. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly store = inject(BrowserStorage);
  readonly token = signal<string | null>(this.store.get<string | null>('harid.token', null));
  readonly buyer = signal<Buyer | null>(this.store.get<Buyer | null>('harid.buyer', null));
  readonly loggedIn = computed(() => !!this.token());
  setSession(r: VerifyResult): void {
    this.token.set(r.token); this.buyer.set(r.buyer);
    this.store.set('harid.token', r.token); this.store.set('harid.buyer', r.buyer);
  }
  logout(): void {
    this.token.set(null); this.buyer.set(null);
    this.store.remove('harid.token'); this.store.remove('harid.buyer');
  }
}
```

`auth.interceptor.ts`:

```ts
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const needsToken = (url: string, method: string) => /\/market\/me(\/|$|\?)/.test(url) || (method === 'POST' && /\/market\/orders$/.test(url));

/** Bearer покупателя для личных запросов; 401 на /me — выход. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const r = token && needsToken(req.url, req.method) ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(r).pipe(catchError((e: unknown) => {
    if (e instanceof HttpErrorResponse && e.status === 401 && /\/market\/me/.test(req.url)) auth.logout();
    return throwError(() => e);
  }));
};
```

Шапка: внедрить `CartService` и `AuthService`; ссылка «Корзина» показывает `@if (cart.count()) { <span class="badge">{{ cart.count() }}</span> }`; вместо «Войти» при `auth.loggedIn()` — ссылка «Мои заказы» на `/me/orders`. В `app.component.spec.ts` ожидание «Войти» остаётся верным (по умолчанию не вошли).

- [ ] **Step 4:** `npx jest` — PASS.
- [ ] **Step 5: Коммит** `git add src/app && git commit -m "feat: корзина, избранное и вход покупателя"`

---

### Task 5: Публичные страницы (SSR) — главная, категория, поиск, лавка, товар

**Files:**
- Create: `src/app/core/seo.service.ts`, `src/app/shared/product-card.component.ts`, `src/app/shared/shop-strip.component.ts`, `src/app/pages/home/home.component.ts`, `src/app/pages/category/category.component.ts`, `src/app/pages/search/search.component.ts`, `src/app/pages/shop/shop.component.ts`, `src/app/pages/product/product.component.ts`
- Modify: `src/app/app.routes.ts`
- Test: `product.component.spec.ts`, `product-card.component.spec.ts`, `seo.service.spec.ts`

**Interfaces:**
- Consumes: `MarketApi`, `CartService.add`, `FavoritesService`, `MoneyPipe`, модели.
- Produces: маршруты `''`, `c/:slug`, `search`, `shop/:handle`, `product/:id`; `SeoService.set({title, description, image?, url?})`; `<app-product-card [product]>`; `<app-shop-strip [shops]>`.

- [ ] **Step 1: Тесты**

`src/app/core/seo.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  it('ставит title и og-теги', () => {
    TestBed.configureTestingModule({});
    TestBed.inject(SeoService).set({ title: 'Наушники — Харид', description: '540 смн', image: 'http://x/a.jpg' });
    expect(TestBed.inject(Title).getTitle()).toBe('Наушники — Харид');
    const meta = TestBed.inject(Meta);
    expect(meta.getTag('property="og:title"')?.content).toBe('Наушники — Харид');
    expect(meta.getTag('property="og:image"')?.content).toBe('http://x/a.jpg');
    expect(meta.getTag('name="description"')?.content).toBe('540 смн');
  });
});
```

`src/app/pages/product/product.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProductComponent } from './product.component';
import { MarketApi } from '../../core/market-api.service';
import { CartService } from '../../core/cart.service';
import { Product } from '../../core/models';

const prod = (over: Partial<Product> = {}): Product => ({ id: '16', shop_handle: 'technomir.tj', title: 'Наушники', price: 540, old_price: 600, image: 'a.jpg', images: ['a.jpg', 'b.jpg'], category: 'gadgets', description: 'Описание', sizes: [], in_stock: true, posted_at: '', ...over });

async function render(p: Product) {
  const api = { product: jest.fn(() => of(p)), products: jest.fn(() => of([])) };
  await TestBed.configureTestingModule({ imports: [ProductComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
  const f = TestBed.createComponent(ProductComponent);
  f.componentRef.setInput('id', p.id);
  f.detectChanges();
  return f;
}

describe('ProductComponent', () => {
  beforeEach(() => localStorage.clear());
  it('показывает цену, старую цену и все фото', async () => {
    const f = await render(prod());
    const el: HTMLElement = f.nativeElement;
    expect(el.textContent).toContain('540 смн');
    expect(el.textContent).toContain('600 смн');
    expect(el.querySelectorAll('[data-test="thumb"]').length).toBe(2);
  });
  it('несколько вариантов — кнопка недоступна до выбора', async () => {
    const f = await render(prod({ sizes: ['128 ГБ', '256 ГБ'] }));
    const btn: HTMLButtonElement = f.nativeElement.querySelector('[data-test="add"]');
    expect(btn.disabled).toBe(true);
    (f.nativeElement.querySelectorAll('[data-test="size"]')[1] as HTMLButtonElement).click();
    f.detectChanges();
    expect(btn.disabled).toBe(false);
    btn.click();
    expect(TestBed.inject(CartService).items()[0].size).toBe('256 ГБ');
  });
  it('один вариант выбран сам; нет в наличии — кнопка недоступна', async () => {
    const f = await render(prod({ sizes: ['Стандарт'], in_stock: false }));
    const btn: HTMLButtonElement = f.nativeElement.querySelector('[data-test="add"]');
    expect(btn.textContent).toContain('Нет в наличии');
    expect(btn.disabled).toBe(true);
  });
});
```

`src/app/shared/product-card.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProductCardComponent } from './product-card.component';

describe('ProductCardComponent', () => {
  it('ссылка на товар, цена и @лавка', async () => {
    await TestBed.configureTestingModule({ imports: [ProductCardComponent], providers: [provideRouter([])] }).compileComponents();
    const f = TestBed.createComponent(ProductCardComponent);
    f.componentRef.setInput('product', { id: '16', shop_handle: 'technomir.tj', title: 'Наушники', price: 1250, old_price: null, image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '' });
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/product/16');
    expect(el.textContent).toContain('1 250 смн');
    expect(el.textContent).toContain('@technomir.tj');
  });
});
```

- [ ] **Step 2:** `npx jest src/app` — FAIL.
- [ ] **Step 3: Реализация**

`src/app/core/seo.service.ts`:

```ts
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

/** Заголовок и Open Graph — для превью ссылок в Telegram/Instagram. */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  set(p: { title: string; description: string; image?: string; url?: string }): void {
    this.title.setTitle(p.title);
    this.meta.updateTag({ name: 'description', content: p.description });
    this.meta.updateTag({ property: 'og:title', content: p.title });
    this.meta.updateTag({ property: 'og:description', content: p.description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    if (p.image) this.meta.updateTag({ property: 'og:image', content: p.image });
    if (p.url) this.meta.updateTag({ property: 'og:url', content: p.url });
  }
}
```

`src/app/shared/product-card.component.ts`:

```ts
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../core/models';
import { MoneyPipe } from './money.pipe';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink, MoneyPipe],
  template: `
    @let p = product();
    <a class="card" [routerLink]="['/product', p.id]">
      <div class="img">@if (p.image) { <img [src]="p.image" [alt]="p.title" loading="lazy" /> } @else { <span class="ph">Нет фото</span> }</div>
      <div class="price"><b>{{ p.price | money }}</b>@if (p.old_price) { <s>{{ p.old_price | money }}</s> }</div>
      <div class="title">{{ p.title }}</div>
      <div class="shop muted">&#64;{{ p.shop_handle }}</div>
    </a>
  `,
  styles: `
    .card { display:block; color:inherit; text-decoration:none }
    .img { aspect-ratio:1; border-radius:var(--radius); overflow:hidden; background:var(--surface); display:grid; place-items:center }
    .img img { width:100%; height:100%; object-fit:cover } .ph { color:var(--muted); font-size:13px }
    .price { margin-top:8px; display:flex; gap:8px; align-items:baseline } .price s { color:var(--muted); font-size:13px }
    .title { font-size:14px; line-height:1.3 } .shop { font-size:13px }
  `,
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
}
```

`src/app/shared/shop-strip.component.ts`:

```ts
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Shop } from '../core/models';

/** Лента лавок: кружок с первой буквой и ник. */
@Component({
  selector: 'app-shop-strip',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="strip">
      @for (s of shops(); track s.handle) {
        <a class="shop" [routerLink]="['/shop', s.handle]">
          <span class="ava" [class.fresh]="s.has_fresh" [style.background]="s.avatar_color">{{ s.handle.charAt(0).toUpperCase() }}</span>
          <span class="h">{{ s.handle }}</span>
        </a>
      }
    </div>
  `,
  styles: `
    .strip { display:flex; gap:16px; overflow-x:auto; padding:8px 0 }
    .shop { display:flex; flex-direction:column; align-items:center; gap:6px; color:inherit; text-decoration:none; min-width:72px }
    .ava { width:60px; height:60px; border-radius:50%; display:grid; place-items:center; color:#fff; font-weight:700; font-size:22px }
    .ava.fresh { outline:3px solid var(--accent); outline-offset:2px } .h { font-size:12px }
  `,
})
export class ShopStripComponent {
  readonly shops = input.required<Shop[]>();
}
```

`src/app/pages/home/home.component.ts`:

```ts
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { MarketApi } from '../../core/market-api.service';
import { SeoService } from '../../core/seo.service';
import { ProductCardComponent } from '../../shared/product-card.component';
import { ShopStripComponent } from '../../shared/shop-strip.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, ProductCardComponent, ShopStripComponent],
  template: `
    <app-shop-strip [shops]="shops()" />
    <section class="hero">
      <h1>Покупайте в Instagram-магазинах Душанбе без предоплаты</h1>
      <p class="muted">{{ shops().length }} лавок уже здесь. Платите наличными курьеру, когда заказ у вас в руках.</p>
      <div class="cta"><a class="btn" href="#new">Смотреть товары</a><a class="btn btn--ghost" routerLink="/sell">У меня Instagram-магазин</a></div>
    </section>
    <h2 id="new">Новое в лавках</h2>
    <nav class="cats"><a routerLink="/">Всё</a>@for (c of categories(); track c.slug) { <a [routerLink]="['/c', c.slug]">{{ c.name }}</a> }</nav>
    @if (products().length) { <div class="grid">@for (p of products(); track p.id) { <app-product-card [product]="p" /> }</div> }
    @else { <p class="muted">Пока пусто</p> }
    <section id="cash" class="how">
      <h2>Оплата наличными курьеру</h2>
      <p class="muted">Не нужно переводить предоплату на карту незнакомому человеку из директа.</p>
      <ol>
        <li><b>Оформляете заказ</b> — без оплаты на сайте.</li>
        <li><b>Лавка собирает заказ</b> и передаёт курьеру.</li>
        <li><b>Курьер привозит</b> в выбранное время.</li>
        <li><b>Проверяете при курьере и платите наличными.</b> Не подошло — не берёте.</li>
      </ol>
    </section>
  `,
  styles: `
    .hero { padding:32px 0 } .hero h1 { font-size:clamp(26px,4vw,40px); margin:0 0 8px } .cta { display:flex; gap:12px; flex-wrap:wrap; margin-top:16px } .cta a { text-decoration:none }
    .cats { display:flex; gap:8px; overflow-x:auto; margin-bottom:16px } .cats a { padding:6px 14px; border:1px solid var(--line); border-radius:999px; color:inherit; text-decoration:none; white-space:nowrap; font-size:14px }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:16px }
    .how { margin-top:48px } .how ol { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:16px; padding-left:18px }
  `,
})
export class HomeComponent {
  private readonly api = inject(MarketApi);
  readonly shops = toSignal(this.api.shops().pipe(catchError(() => of([]))), { initialValue: [] });
  readonly categories = toSignal(this.api.categories().pipe(catchError(() => of([]))), { initialValue: [] });
  readonly products = toSignal(this.api.products({ limit: 24 }).pipe(catchError(() => of([]))), { initialValue: [] });
  constructor() {
    inject(SeoService).set({ title: 'Харид — Instagram-магазины Душанбе', description: 'Товары Instagram-лавок Душанбе с оплатой наличными курьеру.' });
  }
}
```

`src/app/pages/category/category.component.ts`:

```ts
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { MarketApi } from '../../core/market-api.service';
import { Product } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { ProductCardComponent } from '../../shared/product-card.component';

@Component({
  selector: 'app-category',
  standalone: true,
  imports: [ProductCardComponent],
  template: `
    <h1>{{ name() }}</h1>
    @if (products().length) { <div class="grid">@for (p of products(); track p.id) { <app-product-card [product]="p" /> }</div> }
    @else { <p class="muted">Пока пусто</p> }
  `,
  styles: `.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:16px }`,
})
export class CategoryComponent {
  private readonly api = inject(MarketApi);
  private readonly seo = inject(SeoService);
  readonly slug = input.required<string>();
  readonly products = signal<Product[]>([]);
  private readonly categories = toSignal(this.api.categories().pipe(catchError(() => of([]))), { initialValue: [] });
  readonly name = computed(() => this.categories().find((c) => c.slug === this.slug())?.name ?? 'Категория');
  constructor() {
    effect(() => {
      const slug = this.slug();
      this.api.products({ category: slug }).pipe(catchError(() => of([]))).subscribe((p) => this.products.set(p));
    });
    effect(() => this.seo.set({ title: `${this.name()} — Харид`, description: `${this.name()} в Instagram-лавках Душанбе` }));
  }
}
```

`src/app/pages/search/search.component.ts` — как `CategoryComponent`, но вход `q = input<string>('')` (query-параметр через `withComponentInputBinding`), заголовок `Поиск: «{{ q() }}»`, запрос `products({ q })`, пустой `q` — «Введите запрос», без результатов — «Ничего не нашлось».

```ts
import { Component, effect, inject, input, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { MarketApi } from '../../core/market-api.service';
import { Product } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { ProductCardComponent } from '../../shared/product-card.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [ProductCardComponent],
  template: `
    @if (!q()) { <p class="muted">Введите запрос</p> }
    @else {
      <h1>Поиск: «{{ q() }}»</h1>
      @if (products().length) { <div class="grid">@for (p of products(); track p.id) { <app-product-card [product]="p" /> }</div> }
      @else { <p class="muted">Ничего не нашлось</p> }
    }
  `,
  styles: `.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:16px }`,
})
export class SearchComponent {
  private readonly api = inject(MarketApi);
  readonly q = input<string>('');
  readonly products = signal<Product[]>([]);
  constructor() {
    const seo = inject(SeoService);
    effect(() => {
      const q = (this.q() ?? '').trim();
      seo.set({ title: q ? `«${q}» — поиск на Хариде` : 'Поиск — Харид', description: 'Поиск по товарам Instagram-лавок Душанбе' });
      if (!q) return this.products.set([]);
      this.api.products({ q }).pipe(catchError(() => of([]))).subscribe((p) => this.products.set(p));
    });
  }
}
```

`src/app/pages/shop/shop.component.ts`:

```ts
import { Component, effect, inject, input, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { MarketApi } from '../../core/market-api.service';
import { Product, Shop } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { ProductCardComponent } from '../../shared/product-card.component';
import { NotFoundComponent } from '../not-found/not-found.component';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [ProductCardComponent, NotFoundComponent],
  template: `
    @if (missing()) { <app-not-found /> }
    @else if (shop(); as s) {
      <header class="head">
        <span class="ava" [style.background]="s.avatar_color">{{ s.handle.charAt(0).toUpperCase() }}</span>
        <div><h1>&#64;{{ s.handle }}</h1><p class="muted">{{ s.bio }}</p>
          <p class="muted small">@if (s.district) { {{ s.district }} · } Доставлено заказов: {{ s.delivered_orders }}</p></div>
      </header>
      @if (products().length) { <div class="grid">@for (p of products(); track p.id) { <app-product-card [product]="p" /> }</div> }
      @else { <p class="muted">Пока пусто</p> }
    }
  `,
  styles: `
    .head { display:flex; gap:16px; align-items:center; margin:16px 0 24px } .head h1 { margin:0 }
    .ava { width:72px; height:72px; border-radius:50%; display:grid; place-items:center; color:#fff; font-size:28px; font-weight:700 }
    .small { font-size:13px } .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:16px }
  `,
})
export class ShopComponent {
  private readonly api = inject(MarketApi);
  private readonly seo = inject(SeoService);
  readonly handle = input.required<string>();
  readonly shop = signal<Shop | null>(null);
  readonly products = signal<Product[]>([]);
  readonly missing = signal(false);
  constructor() {
    effect(() => {
      const h = this.handle();
      this.missing.set(false);
      this.api.shop(h).subscribe({
        next: (s) => { this.shop.set(s); this.seo.set({ title: `@${s.handle} — Харид`, description: s.bio || `Лавка @${s.handle} на Хариде` }); },
        error: () => this.missing.set(true),
      });
      this.api.products({ shop: h }).pipe(catchError(() => of([]))).subscribe((p) => this.products.set(p));
    });
  }
}
```

`src/app/pages/product/product.component.ts`:

```ts
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { CartService } from '../../core/cart.service';
import { FavoritesService } from '../../core/favorites.service';
import { MarketApi } from '../../core/market-api.service';
import { Product } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { MoneyPipe } from '../../shared/money.pipe';
import { ProductCardComponent } from '../../shared/product-card.component';
import { NotFoundComponent } from '../not-found/not-found.component';

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [RouterLink, MoneyPipe, ProductCardComponent, NotFoundComponent],
  template: `
    @if (missing()) { <app-not-found /> }
    @else if (product(); as p) {
      <div class="wrap">
        <div class="gallery">
          <div class="main">@if (current()) { <img [src]="current()" [alt]="p.title" /> } @else { <span class="muted">Нет фото</span> }</div>
          @if (photos().length > 1) {
            <div class="thumbs">@for (src of photos(); track src; let i = $index) {
              <button type="button" data-test="thumb" [class.on]="i === photo()" (click)="photo.set(i)"><img [src]="src" alt="" /></button>
            }</div>
          }
        </div>
        <div class="info">
          <a class="muted" [routerLink]="['/shop', p.shop_handle]">&#64;{{ p.shop_handle }}</a>
          <h1>{{ p.title }}</h1>
          <div class="price"><b>{{ p.price | money }}</b>@if (p.old_price) { <s>{{ p.old_price | money }}</s> }</div>
          @if (p.sizes.length > 1) {
            <div class="sizes">@for (s of p.sizes; track s) {
              <button type="button" data-test="size" class="size" [class.on]="size() === s" (click)="size.set(s)">{{ s }}</button>
            }</div>
          }
          <div class="actions">
            <button type="button" class="btn" data-test="add" [disabled]="!canAdd()" (click)="add(p)">{{ addLabel() }}</button>
            <button type="button" class="btn btn--ghost" (click)="fav.toggle(p.id)">{{ fav.has(p.id) ? 'В избранном' : 'В избранное' }}</button>
          </div>
          <p class="muted small">Оплата наличными курьеру. Проверяете заказ при курьере.</p>
          <p class="desc">{{ p.description }}</p>
        </div>
      </div>
      @if (more().length) { <h2>Ещё в лавке</h2><div class="grid">@for (m of more(); track m.id) { <app-product-card [product]="m" /> }</div> }
    }
  `,
  styles: `
    .wrap { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:32px } @media (max-width:760px){ .wrap { grid-template-columns:1fr } }
    .main { aspect-ratio:1; border-radius:var(--radius); overflow:hidden; background:var(--surface); display:grid; place-items:center } .main img { width:100%; height:100%; object-fit:cover }
    .thumbs { display:flex; gap:8px; margin-top:8px; overflow-x:auto } .thumbs button { padding:0; border:2px solid transparent; border-radius:10px; overflow:hidden; width:64px; height:64px; background:none } .thumbs button.on { border-color:var(--text) } .thumbs img { width:100%; height:100%; object-fit:cover }
    .price { display:flex; gap:10px; align-items:baseline; font-size:24px } .price s { font-size:16px; color:var(--muted) }
    .sizes { display:flex; gap:8px; flex-wrap:wrap; margin:16px 0 } .size { padding:8px 14px; border:1px solid var(--line); border-radius:999px; background:none } .size.on { background:var(--text); color:#fff }
    .actions { display:flex; gap:12px; margin:16px 0 } .desc { white-space:pre-line } .small { font-size:13px }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:16px }
  `,
})
export class ProductComponent {
  private readonly api = inject(MarketApi);
  private readonly cart = inject(CartService);
  private readonly seo = inject(SeoService);
  readonly fav = inject(FavoritesService);
  readonly id = input.required<string>();
  readonly product = signal<Product | null>(null);
  readonly more = signal<Product[]>([]);
  readonly missing = signal(false);
  readonly photo = signal(0);
  readonly size = signal<string | null>(null);
  readonly added = signal(false);
  readonly photos = computed(() => { const p = this.product(); return p ? (p.images?.length ? p.images : p.image ? [p.image] : []) : []; });
  readonly current = computed(() => this.photos()[this.photo()] ?? '');
  readonly canAdd = computed(() => { const p = this.product(); return !!p && p.in_stock && (p.sizes.length <= 1 || !!this.size()); });
  readonly addLabel = computed(() => (!this.product()?.in_stock ? 'Нет в наличии' : this.added() ? 'Добавлено в корзину' : 'В корзину'));

  constructor() {
    effect(() => {
      const id = this.id();
      this.missing.set(false); this.photo.set(0); this.size.set(null); this.added.set(false);
      this.api.product(id).subscribe({
        next: (p) => {
          this.product.set(p);
          if (p.sizes.length === 1) this.size.set(p.sizes[0]);
          this.seo.set({ title: `${p.title} — ${p.price} смн · Харид`, description: `@${p.shop_handle} · ${p.description.slice(0, 140)}`, image: p.image || undefined });
          this.api.products({ shop: p.shop_handle, limit: 9 }).pipe(catchError(() => of([]))).subscribe((list) => this.more.set(list.filter((x) => x.id !== p.id).slice(0, 8)));
        },
        error: () => this.missing.set(true),
      });
    });
  }

  add(p: Product): void {
    if (!this.canAdd()) return;
    this.cart.add(p, p.sizes.length ? this.size() : null);
    this.added.set(true);
  }
}
```

`src/app/app.routes.ts`:

```ts
import { Routes } from '@angular/router';
import { NotFoundComponent } from './pages/not-found/not-found.component';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent) },
  { path: 'c/:slug', loadComponent: () => import('./pages/category/category.component').then((m) => m.CategoryComponent) },
  { path: 'search', loadComponent: () => import('./pages/search/search.component').then((m) => m.SearchComponent) },
  { path: 'shop/:handle', loadComponent: () => import('./pages/shop/shop.component').then((m) => m.ShopComponent) },
  { path: 'product/:id', loadComponent: () => import('./pages/product/product.component').then((m) => m.ProductComponent) },
  { path: '**', component: NotFoundComponent },
];
```

- [ ] **Step 4:** `npx jest` — PASS; `npm run build` — успех.
- [ ] **Step 5: Проверка SSR.** Запустить бэкенд (:3000) и `node dist/harid/server/server.mjs` (порт по умолчанию 4000); `curl -s http://localhost:4000/shop/technomir.tj | grep -o 'og:title[^>]*'` — содержит `@technomir.tj — Харид`; `curl -s http://localhost:4000/ | grep -c 'technomir.tj'` ≥ 1.
- [ ] **Step 6: Коммит** `git add src/app && git commit -m "feat: публичные страницы витрины с SSR и Open Graph"`

---

### Task 6: Корзина, оформление заказа, трекинг

**Files:**
- Create: `src/app/pages/cart/cart.component.ts`, `src/app/pages/checkout/checkout.component.ts`, `src/app/pages/order/order.component.ts`
- Modify: `src/app/app.routes.ts` (маршруты `cart`, `checkout`, `order/:number`)
- Test: `checkout.component.spec.ts`, `order.component.spec.ts`

**Interfaces:**
- Consumes: `CartService` (`groups`, `itemsTotal`, `deliveryTotal`, `toOrderLines`, `setQty`, `remove`, `clear`), `AuthService.buyer`, `MarketApi.placeOrder/order`, `DISTRICTS`, `SLOTS`, `STAGE_LABEL`, `apiErrorMessage`, `MoneyPipe`.
- Produces: после успешного заказа — переход на `/order/<number>?phone=<телефон>`, корзина очищена; телефон последнего заказа в `localStorage` `harid.lastPhone`.

- [ ] **Step 1: Тесты**

`src/app/pages/checkout/checkout.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { CheckoutComponent } from './checkout.component';
import { MarketApi } from '../../core/market-api.service';
import { CartService } from '../../core/cart.service';

const product = { id: '16', shop_handle: 'technomir.tj', title: 'Наушники', price: 320, old_price: null, image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '' };

async function setup(placeOrder: jest.Mock) {
  localStorage.clear();
  await TestBed.configureTestingModule({ imports: [CheckoutComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { placeOrder } }] }).compileComponents();
  TestBed.inject(CartService).add(product, null, 2);
  const f = TestBed.createComponent(CheckoutComponent);
  f.detectChanges();
  const c = f.componentInstance;
  c.form.setValue({ name: 'Фаррух', phone: '93 111 00 02', district: 'Сино', address: 'ул. Рудаки 10', comment: '', slot: 'Сегодня, 18:00–21:00' });
  return { f, c };
}

describe('CheckoutComponent', () => {
  it('итог: товары + доставка за лавку', async () => {
    const { c } = await setup(jest.fn());
    expect(c.total()).toBe(655);
  });
  it('отправляет заказ с наличными и строками корзины, очищает корзину и идёт на трекинг', async () => {
    const placeOrder = jest.fn(() => of({ number: 'R-221526' }));
    const { c } = await setup(placeOrder);
    const nav = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.submit();
    expect(placeOrder).toHaveBeenCalledWith({
      customer: { name: 'Фаррух', phone: '931110002', district: 'Сино', address: 'ул. Рудаки 10' },
      slot: 'Сегодня, 18:00–21:00', payment: 'cash', lines: [{ product_id: 16, qty: 2 }],
    });
    expect(TestBed.inject(CartService).count()).toBe(0);
    expect(nav).toHaveBeenCalledWith(['/order', 'R-221526'], { queryParams: { phone: '931110002' } });
  });
  it('ошибка бэкенда показывается как есть, корзина не очищается', async () => {
    const err = new HttpErrorResponse({ status: 400, error: { error: { message: 'Товар уже снят с продажи — обновите корзину', errors: [] } } });
    const { f, c } = await setup(jest.fn(() => throwError(() => err)));
    c.submit(); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Товар уже снят с продажи — обновите корзину');
    expect(TestBed.inject(CartService).count()).toBe(2);
  });
});
```

`src/app/pages/order/order.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OrderComponent } from './order.component';
import { MarketApi } from '../../core/market-api.service';

describe('OrderComponent', () => {
  it('показывает номер, этап и сумму', async () => {
    const order = jest.fn(() => of({ number: 'R-221526', stage: 'in_delivery', items_total: 640, delivery_total: 15, slot: 'Сегодня, 18:00–21:00', customer: { name: 'Ф', phone: '+992 93 111 00 02', district: 'Сино', address: 'ул' }, lines: [], shops: [] }));
    await TestBed.configureTestingModule({ imports: [OrderComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { order } }] }).compileComponents();
    const f = TestBed.createComponent(OrderComponent);
    f.componentRef.setInput('number', 'R-221526');
    f.componentRef.setInput('phone', '931110002');
    f.detectChanges();
    const t: string = f.nativeElement.textContent;
    expect(order).toHaveBeenCalledWith('R-221526', '931110002');
    expect(t).toContain('R-221526');
    expect(t).toContain('Курьер в пути');
    expect(t).toContain('655 смн');
  });
});
```

- [ ] **Step 2:** `npx jest src/app/pages` — FAIL.
- [ ] **Step 3: Реализация**

`src/app/pages/cart/cart.component.ts`:

```ts
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../../core/cart.service';
import { MoneyPipe } from '../../shared/money.pipe';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [RouterLink, MoneyPipe],
  template: `
    <h1>Корзина</h1>
    @if (!cart.count()) { <p class="muted">В корзине пока пусто. <a routerLink="/">К товарам</a></p> }
    @else {
      @for (g of cart.groups(); track g.shop_handle) {
        <section class="group">
          <h2>&#64;{{ g.shop_handle }}</h2>
          @for (i of g.items; track i.product.id + (i.size ?? '')) {
            <div class="row">
              <a [routerLink]="['/product', i.product.id]" class="t">{{ i.product.title }}@if (i.size) { <span class="muted"> · {{ i.size }}</span> }</a>
              <div class="qty">
                <button type="button" (click)="cart.setQty(i.product.id, i.size, i.qty - 1)" aria-label="Меньше">−</button>
                <span>{{ i.qty }}</span>
                <button type="button" (click)="cart.setQty(i.product.id, i.size, i.qty + 1)" aria-label="Больше">+</button>
              </div>
              <b>{{ i.product.price * i.qty | money }}</b>
              <button type="button" class="x" (click)="cart.remove(i.product.id, i.size)" aria-label="Убрать">×</button>
            </div>
          }
        </section>
      }
      <div class="sum"><span>Товары</span><b>{{ cart.itemsTotal() | money }}</b></div>
      <p class="muted small">Доставка — {{ cart.groups().length > 1 ? 'за каждую лавку, ' : '' }}посчитаем на следующем шаге. Оплата наличными курьеру.</p>
      <a class="btn" routerLink="/checkout">Оформить заказ</a>
    }
  `,
  styles: `
    .group { border:1px solid var(--line); border-radius:var(--radius); padding:12px 16px; margin-bottom:12px } .group h2 { font-size:16px; margin:0 0 8px }
    .row { display:grid; grid-template-columns:1fr auto auto auto; gap:12px; align-items:center; padding:8px 0 } .t { color:inherit; text-decoration:none }
    .qty { display:flex; gap:8px; align-items:center } .qty button, .x { border:1px solid var(--line); background:none; border-radius:8px; width:28px; height:28px }
    .sum { display:flex; justify-content:space-between; font-size:18px; margin:16px 0 4px } .small { font-size:13px } a.btn { display:inline-block; text-decoration:none; margin-top:12px }
  `,
})
export class CartComponent {
  readonly cart = inject(CartService);
}
```

`src/app/pages/checkout/checkout.component.ts`:

```ts
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { BrowserStorage } from '../../core/browser-storage.service';
import { CartService } from '../../core/cart.service';
import { DISTRICTS, SLOTS } from '../../core/checkout-options';
import { MarketApi } from '../../core/market-api.service';
import { MoneyPipe } from '../../shared/money.pipe';

/** 9 цифр номера: «+992 93 111 00 02» → «931110002». */
export const phone9 = (v: string) => v.replace(/\D/g, '').slice(-9);

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MoneyPipe],
  template: `
    <h1>Оформление заказа</h1>
    @if (!cart.count()) { <p class="muted">Корзина пуста. <a routerLink="/">К товарам</a></p> }
    @else {
      <form [formGroup]="form" (ngSubmit)="submit()" class="form">
        <label>Имя<input formControlName="name" autocomplete="name" /></label>
        <label>Телефон<input formControlName="phone" inputmode="tel" placeholder="93 123 45 67" /></label>
        <label>Район<select formControlName="district">@for (d of districts; track d) { <option [value]="d">{{ d }}</option> }</select></label>
        <label>Адрес<input formControlName="address" placeholder="Улица, дом, квартира" /></label>
        <label>Когда привезти<select formControlName="slot">@for (s of slots; track s) { <option [value]="s">{{ s }}</option> }</select></label>
        <label>Комментарий<textarea formControlName="comment" rows="2"></textarea></label>
        <div class="sum">
          <div><span>Товары</span><b>{{ cart.itemsTotal() | money }}</b></div>
          <div><span>Доставка{{ cart.groups().length > 1 ? ' (' + cart.groups().length + ' лавки)' : '' }}</span><b>{{ delivery() | money }}</b></div>
          <div class="total"><span>Итого наличными курьеру</span><b>{{ total() | money }}</b></div>
        </div>
        @if (error()) { <p class="error">{{ error() }}</p> }
        <button class="btn" type="submit" [disabled]="form.invalid || busy()">{{ busy() ? 'Отправляем…' : 'Заказать' }}</button>
        <p class="muted small">Без предоплаты. Проверяете заказ при курьере и платите наличными.</p>
      </form>
    }
  `,
  styles: `
    .form { display:flex; flex-direction:column; gap:12px; max-width:520px } label { display:flex; flex-direction:column; gap:4px; font-size:14px }
    input, select, textarea { padding:10px 12px; border:1px solid var(--line); border-radius:10px; font:inherit }
    .sum { border-top:1px solid var(--line); padding-top:12px } .sum div { display:flex; justify-content:space-between; margin:4px 0 } .total { font-size:18px } .small { font-size:13px }
  `,
})
export class CheckoutComponent {
  private readonly api = inject(MarketApi);
  private readonly router = inject(Router);
  private readonly store = inject(BrowserStorage);
  readonly cart = inject(CartService);
  readonly districts = DISTRICTS;
  readonly slots = SLOTS;
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({
    name: [inject(AuthService).buyer()?.name ?? '', [Validators.required, Validators.minLength(2)]],
    phone: [this.store.get<string>('harid.lastPhone', ''), [Validators.required, Validators.pattern(/^\D*(\d\D*){9,12}$/)]],
    district: [DISTRICTS[0], Validators.required],
    address: ['', [Validators.required, Validators.minLength(3)]],
    comment: [''],
    slot: [SLOTS[0], Validators.required],
  });
  private readonly district = toSignal(this.form.controls.district.valueChanges, { initialValue: this.form.controls.district.value });
  readonly delivery = computed(() => this.cart.deliveryTotal(this.district()));
  readonly total = computed(() => this.cart.itemsTotal() + this.delivery());

  submit(): void {
    if (this.form.invalid || this.busy()) return;
    const v = this.form.getRawValue();
    const phone = phone9(v.phone);
    this.busy.set(true); this.error.set('');
    this.api.placeOrder({
      customer: { name: v.name.trim(), phone, district: v.district, address: v.address.trim(), ...(v.comment.trim() ? { comment: v.comment.trim() } : {}) },
      slot: v.slot, payment: 'cash', lines: this.cart.toOrderLines(),
    }).subscribe({
      next: (o) => {
        this.cart.clear();
        this.store.set('harid.lastPhone', phone);
        this.busy.set(false);
        this.router.navigate(['/order', o.number], { queryParams: { phone } });
      },
      error: (e) => { this.busy.set(false); this.error.set(apiErrorMessage(e)); },
    });
  }
}
```

Тест `итог` проверяет 640 + 15 = 655: `district` по умолчанию `Сино`, `toSignal` берёт `initialValue`; `setValue` в тесте эмитит `valueChanges`.

`src/app/pages/order/order.component.ts`:

```ts
import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
import { STAGE_LABEL } from '../../core/checkout-options';
import { MarketApi } from '../../core/market-api.service';
import { Order, OrderStage } from '../../core/models';
import { MoneyPipe } from '../../shared/money.pipe';

const STEPS: OrderStage[] = ['placed', 'assembling', 'in_delivery', 'delivered'];

@Component({
  selector: 'app-order',
  standalone: true,
  imports: [RouterLink, MoneyPipe],
  template: `
    @if (error()) { <p class="error">{{ error() }}</p><a routerLink="/">На главную</a> }
    @else if (order(); as o) {
      <h1>Заказ {{ o.number }}</h1>
      <p class="stage">{{ label(o.stage) }}</p>
      @if (o.stage !== 'cancelled') {
        <ol class="steps">@for (s of steps; track s) { <li [class.done]="reached(o.stage, s)">{{ label(s) }}</li> }</ol>
      }
      <p class="muted">{{ o.slot }} · {{ o.customer.district }}, {{ o.customer.address }}</p>
      @for (l of o.lines; track $index) {
        <div class="row"><span>{{ l.title }}@if (l.size) { · {{ l.size }} } × {{ l.qty }}</span><b>{{ l.price * l.qty | money }}</b></div>
      }
      <div class="row"><span>Доставка</span><b>{{ o.delivery_total | money }}</b></div>
      <div class="row total"><span>Наличными курьеру</span><b>{{ o.items_total + o.delivery_total | money }}</b></div>
    }
  `,
  styles: `
    .stage { font-size:20px; font-weight:700 } .steps { display:flex; gap:8px; padding:0; list-style:none; flex-wrap:wrap }
    .steps li { padding:6px 12px; border-radius:999px; background:var(--surface); color:var(--muted); font-size:13px } .steps li.done { background:var(--text); color:#fff }
    .row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--line) } .total { font-size:18px; border:0 }
  `,
})
export class OrderComponent {
  private readonly api = inject(MarketApi);
  readonly number = input.required<string>();
  readonly phone = input<string>('');
  readonly order = signal<Order | null>(null);
  readonly error = signal('');
  readonly steps = STEPS;
  label(s: OrderStage): string { return STAGE_LABEL[s]; }
  reached(cur: OrderStage, s: OrderStage): boolean { return STEPS.indexOf(cur) >= STEPS.indexOf(s); }
  constructor() {
    effect(() => {
      this.api.order(this.number(), this.phone() ?? '').subscribe({
        next: (o) => this.order.set(o),
        error: (e) => this.error.set(apiErrorMessage(e)),
      });
    });
  }
}
```

Маршруты в `app.routes.ts` (перед `**`):

```ts
{ path: 'cart', loadComponent: () => import('./pages/cart/cart.component').then((m) => m.CartComponent) },
{ path: 'checkout', loadComponent: () => import('./pages/checkout/checkout.component').then((m) => m.CheckoutComponent) },
{ path: 'order/:number', loadComponent: () => import('./pages/order/order.component').then((m) => m.OrderComponent) },
```

- [ ] **Step 4:** `npx jest` — PASS; `npm run build` — успех.
- [ ] **Step 5: Коммит** `git add src/app && git commit -m "feat: корзина, оформление заказа наличными и трекинг"`

---

### Task 7: Вход по SMS, «Мои заказы», избранное

**Files:**
- Create: `src/app/pages/login/login.component.ts`, `src/app/pages/my-orders/my-orders.component.ts`, `src/app/pages/favorites/favorites.component.ts`
- Modify: `src/app/app.routes.ts` (`login`, `me/orders`, `favorites`)
- Test: `login.component.spec.ts`, `my-orders.component.spec.ts`

**Interfaces:**
- Consumes: `MarketApi.sendCode/verify/myOrders/product`, `AuthService.setSession/loggedIn/logout`, `FavoritesService.ids`, `phone9` (из `checkout.component.ts` — перенесите в `src/app/core/phone.ts` и импортируйте в обоих местах), `STAGE_LABEL`, `MoneyPipe`, `ProductCardComponent`.
- Produces: `/login?return=/me/orders` — после входа переход на `return` (по умолчанию `/me/orders`); `/me/orders` без входа — переход на `/login?return=/me/orders`.

- [ ] **Step 1: Тесты**

`src/app/pages/login/login.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { LoginComponent } from './login.component';
import { MarketApi } from '../../core/market-api.service';
import { AuthService } from '../../core/auth.service';

describe('LoginComponent', () => {
  it('телефон → код → сессия и переход на return', async () => {
    localStorage.clear();
    const api = { sendCode: jest.fn(() => of({})), verify: jest.fn(() => of({ token: 't', buyer: { id: 1, phone: '+992931110002', name: null }, is_new: true })) };
    await TestBed.configureTestingModule({ imports: [LoginComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    const f = TestBed.createComponent(LoginComponent);
    f.componentRef.setInput('return', '/me/orders');
    f.detectChanges();
    const c = f.componentInstance;
    const nav = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    c.phone.set('+992 93 111 00 02'); c.sendCode();
    expect(api.sendCode).toHaveBeenCalledWith('931110002');
    expect(c.step()).toBe('code');
    c.code.set('000000'); c.verify();
    expect(api.verify).toHaveBeenCalledWith('931110002', '000000');
    expect(TestBed.inject(AuthService).loggedIn()).toBe(true);
    expect(nav).toHaveBeenCalledWith('/me/orders');
  });
});
```

`src/app/pages/my-orders/my-orders.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { MyOrdersComponent } from './my-orders.component';
import { MarketApi } from '../../core/market-api.service';
import { AuthService } from '../../core/auth.service';

describe('MyOrdersComponent', () => {
  beforeEach(() => localStorage.clear());
  it('без входа — на /login с return', async () => {
    await TestBed.configureTestingModule({ imports: [MyOrdersComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { myOrders: jest.fn() } }] }).compileComponents();
    const nav = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.createComponent(MyOrdersComponent).detectChanges();
    expect(nav).toHaveBeenCalledWith(['/login'], { queryParams: { return: '/me/orders' } });
  });
  it('список заказов со ссылками', async () => {
    const myOrders = jest.fn(() => of([{ number: 'R-1', stage: 'delivered', items_total: 100, delivery_total: 15, created_at: '2026-11-17T05:08:07Z', customer: { phone: '+992 93 111 00 02' }, lines: [], shops: [] }]));
    await TestBed.configureTestingModule({ imports: [MyOrdersComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { myOrders } }] }).compileComponents();
    TestBed.inject(AuthService).setSession({ token: 't', buyer: { id: 1, phone: '+992931110002', name: null }, is_new: false });
    const f = TestBed.createComponent(MyOrdersComponent); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('R-1');
    expect(f.nativeElement.textContent).toContain('Доставлен');
  });
});
```

- [ ] **Step 2:** `npx jest src/app/pages` — FAIL.
- [ ] **Step 3: Реализация**

`src/app/core/phone.ts`:

```ts
/** 9 цифр номера: «+992 93 111 00 02» → «931110002». */
export const phone9 = (v: string): string => v.replace(/\D/g, '').slice(-9);
```

(В `checkout.component.ts` заменить локальную функцию на импорт `phone9` из `../../core/phone`.)

`src/app/pages/login/login.component.ts`:

```ts
import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { MarketApi } from '../../core/market-api.service';
import { phone9 } from '../../core/phone';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="box">
      <h1>Вход по номеру телефона</h1>
      @if (step() === 'phone') {
        <label>Номер телефона<input [ngModel]="phone()" (ngModelChange)="phone.set($event)" inputmode="tel" placeholder="93 123 45 67" /></label>
        <button class="btn" type="button" [disabled]="busy() || phone9(phone()).length !== 9" (click)="sendCode()">Получить код</button>
      } @else {
        <p class="muted">Код отправлен на +992 {{ phone9(phone()) }}</p>
        <label>Код из SMS<input [ngModel]="code()" (ngModelChange)="code.set($event)" inputmode="numeric" maxlength="6" /></label>
        <button class="btn" type="button" [disabled]="busy() || code().length !== 6" (click)="verify()">Войти</button>
        <button class="btn btn--ghost" type="button" (click)="step.set('phone')">Другой номер</button>
      }
      @if (error()) { <p class="error">{{ error() }}</p> }
    </section>
  `,
  styles: `.box { max-width:380px; margin:40px auto; display:flex; flex-direction:column; gap:12px } label { display:flex; flex-direction:column; gap:4px } input { padding:10px 12px; border:1px solid var(--line); border-radius:10px; font:inherit }`,
})
export class LoginComponent {
  private readonly api = inject(MarketApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly return = input<string>('/me/orders');
  readonly phone = signal('');
  readonly code = signal('');
  readonly step = signal<'phone' | 'code'>('phone');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly phone9 = phone9;

  sendCode(): void {
    this.busy.set(true); this.error.set('');
    this.api.sendCode(phone9(this.phone())).subscribe({
      next: () => { this.busy.set(false); this.step.set('code'); },
      error: (e) => { this.busy.set(false); this.error.set(apiErrorMessage(e)); },
    });
  }
  verify(): void {
    this.busy.set(true); this.error.set('');
    this.api.verify(phone9(this.phone()), this.code()).subscribe({
      next: (r) => { this.busy.set(false); this.auth.setSession(r); this.router.navigateByUrl(this.return() || '/me/orders'); },
      error: (e) => { this.busy.set(false); this.error.set(apiErrorMessage(e)); },
    });
  }
}
```

`src/app/pages/my-orders/my-orders.component.ts`:

```ts
import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { STAGE_LABEL } from '../../core/checkout-options';
import { MarketApi } from '../../core/market-api.service';
import { Order } from '../../core/models';
import { phone9 } from '../../core/phone';
import { MoneyPipe } from '../../shared/money.pipe';

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [RouterLink, MoneyPipe, DatePipe],
  template: `
    <h1>Мои заказы</h1>
    @if (error()) { <p class="error">{{ error() }}</p> }
    @for (o of orders(); track o.number) {
      <a class="row" [routerLink]="['/order', o.number]" [queryParams]="{ phone: phone9(o.customer.phone) }">
        <b>{{ o.number }}</b><span class="muted">{{ o.created_at | date: 'dd.MM.yyyy' }}</span>
        <span>{{ label[o.stage] }}</span><b>{{ o.items_total + o.delivery_total | money }}</b>
      </a>
    } @empty { @if (!error()) { <p class="muted">Заказов пока нет</p> } }
    <button class="btn btn--ghost" type="button" (click)="logout()">Выйти</button>
  `,
  styles: `.row { display:grid; grid-template-columns:auto auto 1fr auto; gap:12px; padding:12px 0; border-bottom:1px solid var(--line); color:inherit; text-decoration:none } .btn { margin-top:24px }`,
})
export class MyOrdersComponent {
  private readonly api = inject(MarketApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly orders = signal<Order[]>([]);
  readonly error = signal('');
  readonly label = STAGE_LABEL;
  readonly phone9 = phone9;
  constructor() {
    if (!this.auth.loggedIn()) { this.router.navigate(['/login'], { queryParams: { return: '/me/orders' } }); return; }
    this.api.myOrders().subscribe({ next: (o) => this.orders.set(o), error: (e) => this.error.set(apiErrorMessage(e)) });
  }
  logout(): void { this.auth.logout(); this.router.navigate(['/']); }
}
```

`src/app/pages/favorites/favorites.component.ts`:

```ts
import { Component, effect, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { FavoritesService } from '../../core/favorites.service';
import { MarketApi } from '../../core/market-api.service';
import { Product } from '../../core/models';
import { ProductCardComponent } from '../../shared/product-card.component';

/** Избранное: товары по сохранённым id; снятые с продажи пропускаются. */
@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [ProductCardComponent],
  template: `
    <h1>Избранное</h1>
    @if (products().length) { <div class="grid">@for (p of products(); track p.id) { <app-product-card [product]="p" /> }</div> }
    @else { <p class="muted">Пока пусто</p> }
  `,
  styles: `.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:16px }`,
})
export class FavoritesComponent {
  private readonly api = inject(MarketApi);
  readonly products = signal<Product[]>([]);
  constructor() {
    const fav = inject(FavoritesService);
    effect(() => {
      const ids = fav.ids();
      if (!ids.length) return this.products.set([]);
      forkJoin(ids.map((id) => this.api.product(id).pipe(catchError(() => of(null)))))
        .subscribe((list) => this.products.set(list.filter((p): p is Product => !!p)));
    });
  }
}
```

Маршруты (перед `**`):

```ts
{ path: 'login', loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent) },
{ path: 'me/orders', loadComponent: () => import('./pages/my-orders/my-orders.component').then((m) => m.MyOrdersComponent) },
{ path: 'favorites', loadComponent: () => import('./pages/favorites/favorites.component').then((m) => m.FavoritesComponent) },
```

- [ ] **Step 4:** `npx jest` — PASS; `npm run build` — успех.
- [ ] **Step 5: Коммит** `git add src/app && git commit -m "feat: вход по SMS, мои заказы, избранное"`

---

### Task 8: `/sell` — открыть лавку по SMS-коду

**Files:**
- Create: `src/app/pages/sell/sell.component.ts`
- Modify: `src/app/app.routes.ts` (`sell`)
- Test: `src/app/pages/sell/sell.component.spec.ts`

**Interfaces:**
- Consumes: `MarketApi.sellerSendCode/sellerApply`, `apiErrorMessage`, `phone9`, `environment.cabinetUrl`.

- [ ] **Step 1: Тест**

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { SellComponent } from './sell.component';
import { MarketApi } from '../../core/market-api.service';

async function setup(api: Partial<Record<'sellerSendCode' | 'sellerApply', jest.Mock>>) {
  await TestBed.configureTestingModule({ imports: [SellComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
  const f = TestBed.createComponent(SellComponent); f.detectChanges();
  return { f, c: f.componentInstance };
}

describe('SellComponent', () => {
  it('ник+имя+телефон → код → лавка открыта со ссылкой на кабинет', async () => {
    const api = { sellerSendCode: jest.fn(() => of({})), sellerApply: jest.fn(() => of({ id: 2, handle: 'technomir.tj', status: 'active' })) };
    const { f, c } = await setup(api);
    c.form.setValue({ handle: '@TechnoMir.tj', owner_name: 'Рустам', phone: '93 111 00 01' });
    c.sendCode();
    expect(api.sellerSendCode).toHaveBeenCalledWith('931110001');
    expect(c.step()).toBe('code');
    c.code.set('000000'); c.apply(); f.detectChanges();
    expect(api.sellerApply).toHaveBeenCalledWith({ handle: '@TechnoMir.tj', owner_name: 'Рустам', phone: '931110001', code: '000000' });
    expect(f.nativeElement.textContent).toContain('Лавка открыта');
    expect(f.nativeElement.querySelector('a[data-test="cabinet"]')?.getAttribute('href')).toBe('https://admin.disti.site');
  });
  it('ник занят — текст бэкенда', async () => {
    const err = new HttpErrorResponse({ status: 409, error: { error: { message: 'Этот ник уже занят другой лавкой', errors: [] } } });
    const { f, c } = await setup({ sellerSendCode: jest.fn(() => of({})), sellerApply: jest.fn(() => throwError(() => err)) });
    c.form.setValue({ handle: 'x', owner_name: 'Рустам', phone: '931110001' });
    c.sendCode(); c.code.set('000000'); c.apply(); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Этот ник уже занят другой лавкой');
  });
});
```

- [ ] **Step 2:** `npx jest src/app/pages/sell` — FAIL.
- [ ] **Step 3: Реализация** `src/app/pages/sell/sell.component.ts`:

```ts
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { apiErrorMessage } from '../../core/api-error';
import { MarketApi } from '../../core/market-api.service';
import { phone9 } from '../../core/phone';

/** Открытие лавки: ник, имя, телефон → SMS-код → лавка и кабинет в админке. */
@Component({
  selector: 'app-sell',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule],
  template: `
    <section class="box">
      <h1>Посты из вашего Instagram станут товарами на Хариде</h1>
      <p class="muted">Импортируйте посты в кабинете, отметьте «На витрине» — покупатели закажут, курьер привезёт и заберёт оплату наличными.</p>
      @switch (step()) {
        @case ('form') {
          <form [formGroup]="form" (ngSubmit)="sendCode()" class="form">
            <label>Ник в Instagram<input formControlName="handle" placeholder="@my.shop" autocapitalize="none" /></label>
            <label>Ваше имя<input formControlName="owner_name" /></label>
            <label>Телефон<input formControlName="phone" inputmode="tel" placeholder="93 123 45 67" /></label>
            <button class="btn" type="submit" [disabled]="form.invalid || busy()">Получить код</button>
          </form>
        }
        @case ('code') {
          <p class="muted">Код отправлен на +992 {{ phone9(form.getRawValue().phone) }}</p>
          <label>Код из SMS<input [ngModel]="code()" (ngModelChange)="code.set($event)" inputmode="numeric" maxlength="6" /></label>
          <button class="btn" type="button" [disabled]="busy() || code().length !== 6" (click)="apply()">Открыть лавку</button>
          <button class="btn btn--ghost" type="button" (click)="step.set('form')">Изменить данные</button>
        }
        @case ('done') {
          <h2>Лавка открыта</h2>
          <p>&#64;{{ handle() }} уже на Хариде. Войдите в кабинет по номеру телефона, чтобы добавить товары.</p>
          <a class="btn" data-test="cabinet" [href]="cabinetUrl">Перейти в кабинет</a>
        }
      }
      @if (error()) { <p class="error">{{ error() }}</p> }
    </section>
  `,
  styles: `.box { max-width:520px; margin:24px auto; display:flex; flex-direction:column; gap:12px } .form { display:flex; flex-direction:column; gap:12px } label { display:flex; flex-direction:column; gap:4px } input { padding:10px 12px; border:1px solid var(--line); border-radius:10px; font:inherit } a.btn { text-decoration:none; text-align:center }`,
})
export class SellComponent {
  private readonly api = inject(MarketApi);
  readonly cabinetUrl = environment.cabinetUrl;
  readonly phone9 = phone9;
  readonly step = signal<'form' | 'code' | 'done'>('form');
  readonly code = signal('');
  readonly handle = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({
    handle: ['', [Validators.required, Validators.pattern(/^@?[A-Za-z0-9._]{1,30}$/)]],
    owner_name: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(/^\D*(\d\D*){9,12}$/)]],
  });

  sendCode(): void {
    if (this.form.invalid) return;
    this.busy.set(true); this.error.set('');
    this.api.sellerSendCode(phone9(this.form.getRawValue().phone)).subscribe({
      next: () => { this.busy.set(false); this.step.set('code'); },
      error: (e) => { this.busy.set(false); this.error.set(apiErrorMessage(e)); },
    });
  }
  apply(): void {
    const v = this.form.getRawValue();
    this.busy.set(true); this.error.set('');
    this.api.sellerApply({ handle: v.handle.trim(), owner_name: v.owner_name.trim(), phone: phone9(v.phone), code: this.code() }).subscribe({
      next: (r) => { this.busy.set(false); this.handle.set(r.handle); this.step.set('done'); },
      error: (e) => { this.busy.set(false); this.error.set(apiErrorMessage(e)); },
    });
  }
}
```

Маршрут (перед `**`): `{ path: 'sell', loadComponent: () => import('./pages/sell/sell.component').then((m) => m.SellComponent) },`

- [ ] **Step 4:** `npx jest` — PASS; `npm run build` — успех.
- [ ] **Step 5: Коммит** `git add src/app && git commit -m "feat: открытие лавки по SMS-коду"`

---

### Task 9: Ручная проверка на локальном стенде (контроллер, без коммитов кода)

- [ ] Бэкенд worktree `feat/harid-images` (или `feat/marketplace-bayzo` после слияния Task 1) запущен на :3000, Redis запущен; в `.env` бэкенда `MARKETPLACE_TEST_PHONES=931110001,931110002`.
- [ ] `npm run build && node dist/harid/server/server.mjs` (или `npm run serve:ssr:harid`) → http://localhost:4000.
- [ ] `curl` главной и `/shop/technomir.tj` — HTML содержит лавку и `og:title`; `/product/16` — `og:image`.
- [ ] В браузере: главная → лавка ТехноМир → товар (галерея из всех фото) → в корзину → оформление (Сино, слот) → `/order/R-…` → в админке заявка «Харид» → смена статуса → трекинг обновляется.
- [ ] `/login` тестовым номером (код 000000) → `/me/orders` показывает заказ.
- [ ] `/sell` с новым ником и тестовым номером → «Лавка открыта» → лавка видна в `/` после включения товаров.
- [ ] Ширина 375px: шапка, сетка, корзина без горизонтальной прокрутки.
- [ ] Отчёт: что проверено, что нет.
