# Недавно просмотренные — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полоса «Вы смотрели» на главной и в корзине из снимков товаров, сохранённых в localStorage при просмотре.

**Architecture:** `RecentlyViewedService` (по образцу `FavoritesService`/`CartService`) хранит до 12 снимков товара. Страница товара пишет снимок в браузере. Общий компонент `RecentStripComponent` читает сервис сам, страница передаёт только id для исключения.

**Tech Stack:** Angular 19 (standalone, signals, SSR), Jest + jest-preset-angular.

**Spec:** `docs/superpowers/specs/2026-11-24-recently-viewed-design.md`

## Global Constraints

- Ключ хранилища: `harid.recent`; доступ только через `BrowserStorage` (на сервере — no-op).
- Лимит: 12 товаров, свежие первыми, без дублей по `id`.
- Снимок: `id`, `shop_handle`, `title`, `price`, `old_price`, `image`, `in_stock` — больше ничего (описание, галерея, видео не хранятся).
- Тексты: заголовок «Вы смотрели», кнопка «Очистить», пометка «Нет в наличии».
- Никаких запросов к API ради полосы.
- До `hydrate()` и на сервере сервис пуст — серверная разметка и первый клиентский рендер без полосы.
- Комментарии и сообщения коммитов — по-русски, как в репозитории (`feat: …`), с строкой `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Запись до гидратации.** Страница товара может вызвать `add()` раньше, чем `AppComponent` вызовет `hydrate()` в `afterNextRender`. Ожидание: сохранённая история не затирается — `add()` сначала гидратирует (тест в Task 1).
2. **Повреждённое хранилище.** В `harid.recent` не массив или массив с мусором. Ожидание: без исключения, битые записи отброшены, годные остались (тест в Task 1).
3. **Товар удалён с витрины.** Снимок ведёт на 404. Ожидание: страница товара при `missing` убирает id из истории, полоса больше его не предлагает (тест в Task 3; это решение исполнителя-планировщика сверх спека, обоснование — цель «вернуться и купить»).
4. **Цена «в Direct» и товар без фото.** `price: null` — ценник не выводится, карточка остаётся; `image: ''` — нет битого `<img>`, только фон-заглушка (тест в Task 2).
5. **Всё из истории уже в корзине.** Ожидание: полоса в корзине не выводится вовсе, без пустого заголовка (тест в Task 4).

---

### Task 1: RecentlyViewedService

**Files:**
- Create: `src/app/core/recently-viewed.service.ts`
- Test: `src/app/core/recently-viewed.service.spec.ts`
- Modify: `src/app/app.component.ts:39-48` (гидратация в `afterNextRender` рядом с `fav.hydrate()`)

**Interfaces:**
- Produces:
  - `export type RecentItem = Pick<Product, 'id' | 'shop_handle' | 'title' | 'price' | 'old_price' | 'image' | 'in_stock'>`
  - `export const RECENT_LIMIT = 12`
  - `class RecentlyViewedService` (`providedIn: 'root'`): `ready: Signal<boolean>`, `items: Signal<RecentItem[]>`, `hydrate(): void`, `add(p: Product): void`, `remove(id: string): void`, `clear(): void`

- [ ] **Step 1: Write the failing tests** (стиль — как `favorites.service.spec.ts`: `localStorage.clear()` в `beforeEach`, `TestBed.inject`)

```ts
const p = (id: string, over: Partial<Product> = {}): Product => ({ id, shop_handle: 'zebo.style', title: `Товар ${id}`, price: 100, old_price: null, image: `${id}.jpg`, images: [`${id}-g.jpg`], category: null, description: 'длинное', sizes: ['M'], in_stock: true, posted_at: '', video: 'v.mp4', ...over });

it('add кладёт снимок первым и хранит только поля снимка', () => {
  s.add(p('1')); s.add(p('2'));
  expect(s.items().map((i) => i.id)).toEqual(['2', '1']);
  expect(s.items()[0]).toEqual({ id: '2', shop_handle: 'zebo.style', title: 'Товар 2', price: 100, old_price: null, image: '2-g.jpg', in_stock: true });
  expect(JSON.parse(localStorage.getItem('harid.recent')!)).toHaveLength(2);
});
it('повторный просмотр поднимает товар и обновляет снимок', () => {
  s.add(p('1')); s.add(p('2')); s.add(p('1', { price: 90 }));
  expect(s.items().map((i) => i.id)).toEqual(['1', '2']);
  expect(s.items()[0].price).toBe(90);
});
it('не больше 12, вытесняется самый старый', () => {
  for (let i = 1; i <= 13; i++) s.add(p(String(i)));
  expect(s.items()).toHaveLength(12);
  expect(s.items().at(-1)!.id).toBe('2');
});
it('до hydrate() пусто, после — из хранилища; ready переключается', () => { /* как в favorites spec */ });
it('add до hydrate() не затирает сохранённую историю', () => {
  localStorage.setItem('harid.recent', JSON.stringify([{ id: '1', shop_handle: 'a', title: 'A', price: 1, old_price: null, image: '', in_stock: true }]));
  s.add(p('2'));
  expect(s.items().map((i) => i.id)).toEqual(['2', '1']);
});
it('повреждённое хранилище: не массив — пусто без исключения', () => { localStorage.setItem('harid.recent', '{"a":1}'); expect(() => s.hydrate()).not.toThrow(); expect(s.items()).toEqual([]); });
it('битые записи отброшены, годные остались', () => {
  localStorage.setItem('harid.recent', JSON.stringify([null, { id: 5 }, { id: '1', shop_handle: 'a', title: 'A', price: null, old_price: null, image: '', in_stock: false }]));
  s.hydrate();
  expect(s.items().map((i) => i.id)).toEqual(['1']);
});
it('remove убирает по id; clear очищает и хранилище', () => {
  s.add(p('1')); s.add(p('2')); s.remove('1');
  expect(s.items().map((i) => i.id)).toEqual(['2']);
  s.clear();
  expect(s.items()).toEqual([]);
  expect(localStorage.getItem('harid.recent')).toBeNull();
});
```

- [ ] **Step 2: Run** `npx jest src/app/core/recently-viewed.service.spec.ts` — Expected: FAIL, модуль не найден.

- [ ] **Step 3: Implement** `src/app/core/recently-viewed.service.ts`. Структура как у `FavoritesService` (`loaded`, `state`, `readyState`, `hydrate()` один раз). `image` снимка — `p.images?.[0] ?? p.image` (как `thumb()` в корзине). Валидатор записи по образцу `isCartItem`: `id`, `shop_handle`, `title` — строки; `price` и `old_price` — число или `null`; `image` — строка; `in_stock` — boolean. `add`/`remove` сначала вызывают `hydrate()`. `clear()` — `store.remove(KEY)`.

- [ ] **Step 4: Add `recent.hydrate()`** в `afterNextRender` в `src/app/app.component.ts` рядом с `fav.hydrate()`.

- [ ] **Step 5: Run** `npx jest src/app/core/recently-viewed.service.spec.ts src/app/app.component` — Expected: PASS.

- [ ] **Step 6: Commit** `feat: хранилище недавно просмотренных товаров`

---

### Task 2: RecentStripComponent

**Files:**
- Create: `src/app/shared/recent-strip.component.ts`
- Test: `src/app/shared/recent-strip.component.spec.ts`

**Interfaces:**
- Consumes: `RecentlyViewedService`, `RecentItem` (Task 1); `PriceTagComponent` (`[price]`, `[old]`, `size="sm"`).
- Produces: `<app-recent-strip [exclude]="string[]" />`, класс `RecentStripComponent`, `exclude = input<string[]>([])`, `visible = computed<RecentItem[]>` (items без исключённых).

- [ ] **Step 1: Write the failing tests** (`provideRouter([])`, данные кладутся через `TestBed.inject(RecentlyViewedService).add(...)`)

```ts
it('пустая история — ничего не выводит', () => { expect(f.nativeElement.textContent.trim()).toBe(''); expect(f.nativeElement.querySelector('section')).toBeNull(); });
it('показывает заголовок, название, цену и ссылку на товар', () => {
  // add(p('16', { title: 'Наушники', price: 320 }))
  expect(text).toContain('Вы смотрели'); expect(text).toContain('Наушники'); expect(text).toContain('320');
  expect(el.querySelector('a[href="/product/16"]')).not.toBeNull();
});
it('exclude скрывает товары; если исключены все — ничего не выводит', () => { /* setInput('exclude', ['16']) при единственном 16 → section === null */ });
it('in_stock: false — пометка «Нет в наличии»', () => { /* … */ });
it('цена в Direct (price: null) — карточка есть, ценника нет', () => { /* querySelector('.price-tag') === null, название на месте */ });
it('без фото — нет <img>', () => { /* image: '', images: [] → querySelector('img') === null */ });
it('«Очистить» очищает историю и прячет полосу', () => { /* click по button с текстом «Очистить» → section === null, service.items() пуст */ });
```

- [ ] **Step 2: Run** `npx jest src/app/shared/recent-strip.component.spec.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** `src/app/shared/recent-strip.component.ts`. Разметка: `@if (visible().length) { <section aria-labelledby=…> заголовок h2 «Вы смотрели» + <button type="button">Очистить</button>; <ul> горизонтальная лента </ul> }`. Карточка — `<a [routerLink]="['/product', i.id]">`: квадратное фото (`loading="lazy"`, `alt=""`, `@if (i.image)`, иначе фон `var(--color-mist)`), `app-price-tag`, название в две строки с обрезкой, «Нет в наличии» при `!i.in_stock`. Прокрутка и отступы — как `.strip` в `shop-strip.component.ts` (`overflow-x: auto`, `scroll-snap`, скрытая полоса прокрутки, те же отрицательные поля 16/24px); ширина карточки ~120px на телефоне, ~150px от 640px. Кнопка «Очистить» — минимум 44px высоты.

- [ ] **Step 4: Run** `npx jest src/app/shared/recent-strip.component.spec.ts` — Expected: PASS.

- [ ] **Step 5: Commit** `feat: полоса «Вы смотрели»`

---

### Task 3: Запись просмотра на странице товара

**Files:**
- Modify: `src/app/pages/product/product.component.ts` (конструктор, `effect` загрузки товара: `next` и `error`)
- Test: `src/app/pages/product/product.component.spec.ts`

**Interfaces:**
- Consumes: `RecentlyViewedService.add(p: Product)`, `.remove(id: string)` (Task 1).

- [ ] **Step 1: Write the failing tests** (используют существующие `render()` и `prod()` из спеки)

```ts
it('загруженный товар попадает в недавно просмотренные', async () => {
  await render(prod());
  expect(TestBed.inject(RecentlyViewedService).items().map((i) => i.id)).toEqual(['16']);
});
it('на сервере просмотр не записывается', async () => {
  // configureTestingModule с { provide: PLATFORM_ID, useValue: 'server' } → items() пуст
});
it('товар не найден (404) — убирается из недавно просмотренных', async () => {
  // заранее service.add(prod()); api.product → throwError(new HttpErrorResponse({ status: 404 })) → items() пуст
});
```

- [ ] **Step 2: Run** `npx jest src/app/pages/product/product.component.spec.ts -t "недавно"` — Expected: FAIL.

- [ ] **Step 3: Implement.** Внедрить `RecentlyViewedService`. В `next` после `this.product.set(p)`: `if (this.browser) this.recent.add(p)`. В `error` при 404/400 рядом с `missing.set(true)`: `if (this.browser) this.recent.remove(id)`. Ошибки сети (`failed`) историю не трогают.

- [ ] **Step 4: Run** `npx jest src/app/pages/product` — Expected: PASS (вся спека товара).

- [ ] **Step 5: Commit** `feat: страница товара запоминает просмотр`

---

### Task 4: Полоса на главной и в корзине

**Files:**
- Modify: `src/app/pages/home/home.component.ts` (шаблон: между `</section>` героя и `<section id="fresh">`)
- Modify: `src/app/pages/cart/cart.component.ts` (шаблон: после блока `@if/@else` состояний, внутри `.wrap`; класс: `inCart` computed)
- Test: `src/app/pages/home/home.component.spec.ts`, `src/app/pages/cart/cart.component.spec.ts`

**Interfaces:**
- Consumes: `<app-recent-strip [exclude] />` (Task 2), `RecentlyViewedService.add` (Task 1, для подготовки данных в тестах).
- Produces: `CartComponent.inCart = computed<string[]>(() => cart.items().map((i) => i.product.id))`.

- [ ] **Step 1: Write the failing tests**

```ts
// home.component.spec.ts — отдельный describe, MarketApi замокан как в существующем render()
it('с историей — «Вы смотрели» над «Новое в лавках»', () => {
  // recent.add(item(1)) до createComponent → strip находится раньше #fresh (compareDocumentPosition)
});
it('без истории полосы нет', () => { /* textContent не содержит «Вы смотрели» */ });

// cart.component.spec.ts
it('пустая корзина после гидратации — полоса под призывом', async () => { /* recent.add(other); cart.hydrate(); есть «пока пусто» и «Вы смотрели» */ });
it('товар из корзины в полосе не повторяется', async () => { /* recent.add(product); recent.add(other); cart.add(product) → в полосе только other */ });
it('вся история уже в корзине — полосы нет', async () => { /* recent.add(product); cart.add(product) → нет «Вы смотрели» */ });
it('до гидратации корзины полосы нет', async () => { /* видно «Загрузка», нет «Вы смотрели» */ });
```

- [ ] **Step 2: Run** `npx jest src/app/pages/home src/app/pages/cart` — Expected: FAIL на новых тестах.

- [ ] **Step 3: Implement.** Главная: `<app-recent-strip />` в `.wrap` перед `<section id="fresh">` (на телефоне герой скрыт — полоса окажется между лавками и лентой). Корзина: `@if (cart.ready()) { <app-recent-strip [exclude]="inCart()" /> }` после состояний, с верхним отступом ~48px от содержимого.

- [ ] **Step 4: Run** `npx jest` — Expected: PASS, все спеки.

- [ ] **Step 5: Run** `npm run build` — Expected: сборка без ошибок (проверка SSR-части).

- [ ] **Step 6: Commit** `feat: «Вы смотрели» на главной и в корзине`
