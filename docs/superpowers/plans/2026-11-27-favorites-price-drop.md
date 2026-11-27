# «Подешевело» в избранном — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** запоминать цену товара при добавлении в избранное и звать покупателя обратно точкой на вкладке «Избранное» и сердечке в шапке, когда цена упала; на странице избранного — плашка «Подешевело на N смн», такие товары первыми.

**Architecture:** чистые функции сравнения цен (`price-watch.ts`) + метки цен в `FavoritesService` под ключом `harid.fav.prices` (формат `harid.fav` не меняется). Текущие цены приходят двумя путями: фоновая проверка `PriceCheckService` в простое браузера (раз в 6 ч, до 30 товаров, по 4 запроса) и попутно из карточек и страницы товара (`observe`). Точка и плашка читают сигналы сервиса.

**Tech Stack:** Angular 19 (signals, standalone, OnPush, SSR), RxJS, Jest + jest-preset-angular, словарь `src/app/i18n/tg`.

**Spec:** `docs/superpowers/specs/2026-11-27-favorites-price-drop-design.md`

## Global Constraints

- Ветка `feat/favorites-price-drop` поверх `fix/tab-bar-tajik-labels` (PR #30).
- `harid.fav` остаётся массивом id; новые ключи: `harid.fav.prices`, `harid.fav.checkedAt`.
- «Подешевело» = товар в наличии и текущая цена ниже `base` минимум на 5% (`DROP_MIN = 0.05`).
- Фоновая проверка: только браузер, после первой отрисовки, в `requestIdleCallback`; не чаще раза в 6 ч (`CHECK_EVERY_MS = 6 * 60 * 60 * 1000`); не больше 30 последних добавленных (`CHECK_LIMIT = 30`); по 4 запроса (`CHECK_CONCURRENCY = 4`); пропуск при `navigator.onLine === false` или `navigator.connection?.saveData`.
- Время — через `CLOCK` из `core/clock.ts`; хранилище — через `BrowserStorage`.
- Каждый новый текст — через `| t` / `i18n.t` с переводом в словаре (`coverage.spec.ts` это проверяет): подписи избранного — `src/app/i18n/tg/account.ts`, шапка и вкладки — `shell.ts`.
- Коммиты: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; `angular.json` и `src/environments/environment.ts` не коммитить.

## Review Focus

1. Товар добавили с `price: null`, позже цена появилась — `base` ставится по первой цене, точки нет (Task 2).
2. Избранное, сохранённое до выкладки (меток нет) — первая увиденная цена становится `base`, точки нет (Task 2).
3. Убрали и нажали «Вернуть» — метка возвращается прежней, а не пересчитывается от текущей цены (Task 2).
4. Мусор в `harid.fav.prices` (не объект, `base` строкой, NaN) — запись отбрасывается без исключения (Task 1).
5. Подешевел, но нет в наличии — ни плашки, ни точки; снова в наличии — появляются (Task 1, Task 2).

---

### Task 1: Сравнение цен — чистые функции

**Files:**
- Create: `src/app/core/price-watch.ts`
- Test: `src/app/core/price-watch.spec.ts`

**Interfaces:**
- Produces:
  - `interface PriceMark { base: number | null; now: number | null; stock: boolean; seen?: number }` — `base` цена при добавлении, `now` последняя известная, `stock` в наличии ли, `seen` цена, по которой покупатель уже видел снижение.
  - `const DROP_MIN = 0.05`
  - `dropOf(m: PriceMark | undefined): number | null` — на сколько сомони подешевел (целое, `base - now`), или `null`, если не «подешевело».
  - `isFreshDrop(m: PriceMark | undefined): boolean` — `dropOf` не null и (`seen` нет или `now < seen`).
  - `parseMarks(raw: unknown): Record<string, PriceMark>` — из `localStorage`, мусор отбрасывается.

- [ ] **Step 1: Тесты**

```ts
describe('dropOf', () => {
  it('снижение на 5% и больше — сумма', () => { expect(dropOf({ base: 300, now: 285, stock: true })).toBe(15); });
  it('меньше 5% — null', () => { expect(dropOf({ base: 300, now: 290, stock: true })).toBeNull(); });
  it('подорожал, нет base, нет now — null', () => {
    expect(dropOf({ base: 300, now: 350, stock: true })).toBeNull();
    expect(dropOf({ base: null, now: 100, stock: true })).toBeNull();
    expect(dropOf({ base: 300, now: null, stock: true })).toBeNull();
    expect(dropOf(undefined)).toBeNull();
  });
  it('нет в наличии — null', () => { expect(dropOf({ base: 300, now: 200, stock: false })).toBeNull(); });
});
describe('isFreshDrop', () => {
  it('снижение без seen — свежее; seen = now — нет; упал ниже seen — снова свежее', () => {
    expect(isFreshDrop({ base: 300, now: 250, stock: true })).toBe(true);
    expect(isFreshDrop({ base: 300, now: 250, stock: true, seen: 250 })).toBe(false);
    expect(isFreshDrop({ base: 300, now: 200, stock: true, seen: 250 })).toBe(true);
  });
});
describe('parseMarks', () => {
  it('мусор отбрасывается, корректные записи остаются', () => {
    expect(parseMarks(null)).toEqual({});
    expect(parseMarks([1, 2])).toEqual({});
    expect(parseMarks({ a: { base: '300', now: 1, stock: true }, b: { base: NaN, now: 1, stock: true }, c: 5,
      d: { base: 300, now: 250, stock: true, seen: 260 }, e: { base: null, now: null, stock: false } }))
      .toEqual({ d: { base: 300, now: 250, stock: true, seen: 260 }, e: { base: null, now: null, stock: false } });
  });
});
```

- [ ] **Step 2:** `npx jest src/app/core/price-watch.spec.ts` — FAIL (модуля нет).
- [ ] **Step 3:** реализовать `price-watch.ts`. Порог: `now <= base * (1 - DROP_MIN)`; сумма `Math.round(base - now)`. `parseMarks` принимает только объект-не-массив; поле валидно, если `base`/`now` — конечное число или `null`, `stock` — boolean, `seen` — конечное число или отсутствует.
- [ ] **Step 4:** тот же запуск — PASS.
- [ ] **Step 5:** коммит `feat(favorites): сравнение цен для «Подешевело»`.

### Task 2: Метки цен в FavoritesService

**Files:**
- Modify: `src/app/core/favorites.service.ts`
- Modify: `src/app/shared/product-card.component.ts:35` (`fav.toggle(p.id, p)`)
- Modify: `src/app/pages/product/product.component.ts:147,194,547` (`fav.toggle(p.id, p)`)
- Test: `src/app/core/favorites.service.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`PriceMark`, `dropOf`, `isFreshDrop`, `parseMarks`).
- Produces (в `FavoritesService`):
  - `type Priced = Pick<Product, 'price' | 'in_stock'>`
  - `toggle(id: string, item?: Priced): void` — при добавлении с `item` метка `{ base: item.price, now: item.price, stock: item.in_stock }`; при удалении метка удаляется; «Вернуть» восстанавливает прежнюю метку.
  - `observe(id: string, item: Priced): void` — только для товара в избранном: `now`/`stock` обновляются; `base`, если был `null`, становится `item.price`. Без изменений — без записи в хранилище.
  - `readonly marks: Signal<Record<string, PriceMark>>`
  - `drop(id: string): number | null` — `dropOf(marks()[id])`.
  - `readonly hasFreshDrop: Signal<boolean>` — есть id из `ids()` с `isFreshDrop`.
  - `markSeen(): void` — у всех подешевевших `seen = now`.
  - Ключ `harid.fav.prices`; `hydrate()` читает его через `parseMarks`.

- [ ] **Step 1: Тесты** (в существующий `favorites.service.spec.ts`; старые вызовы `toggle('5')` остаются рабочими)

```ts
describe('цены', () => {
  const item = (price: number | null, in_stock = true) => ({ price, in_stock });
  it('добавление запоминает цену; снижение на 5%+ — drop и точка', () => {
    const f = TestBed.inject(FavoritesService);
    f.toggle('1', item(300));
    f.observe('1', item(250));
    expect(f.drop('1')).toBe(50);
    expect(f.hasFreshDrop()).toBe(true);
  });
  it('markSeen гасит точку, плашка остаётся; упал ещё — точка снова', () => {
    const f = TestBed.inject(FavoritesService);
    f.toggle('1', item(300)); f.observe('1', item(250)); f.markSeen();
    expect(f.hasFreshDrop()).toBe(false);
    expect(f.drop('1')).toBe(50);
    f.observe('1', item(200));
    expect(f.hasFreshDrop()).toBe(true);
  });
  it('цена по запросу при добавлении — base по первой цене, снижения нет', () => {
    const f = TestBed.inject(FavoritesService);
    f.toggle('1', item(null)); f.observe('1', item(300));
    expect(f.drop('1')).toBeNull();
    f.observe('1', item(250));
    expect(f.drop('1')).toBe(50);
  });
  it('старое избранное без меток — первая цена становится base, точки нет', () => {
    localStorage.setItem('harid.fav', JSON.stringify(['9']));
    const f = TestBed.inject(FavoritesService); f.hydrate();
    f.observe('9', item(250));
    expect(f.drop('9')).toBeNull();
    expect(f.hasFreshDrop()).toBe(false);
  });
  it('«Вернуть» восстанавливает прежнюю метку, а не текущую цену', () => {
    const f = TestBed.inject(FavoritesService);
    f.toggle('1', item(300)); f.observe('1', item(250));
    f.toggle('1');
    expect(f.marks()['1']).toBeUndefined();
    TestBed.inject(ToastService).toasts()[0].action!.run!();   // имя поля — как в существующих тестах «Вернуть»
    expect(f.drop('1')).toBe(50);
  });
  it('нет в наличии — ни плашки, ни точки; снова в наличии — есть', () => {
    const f = TestBed.inject(FavoritesService);
    f.toggle('1', item(300)); f.observe('1', item(250, false));
    expect([f.drop('1'), f.hasFreshDrop()]).toEqual([null, false]);
    f.observe('1', item(250, true));
    expect([f.drop('1'), f.hasFreshDrop()]).toEqual([50, true]);
  });
  it('observe для товара не из избранного — ничего не пишет', () => {
    const f = TestBed.inject(FavoritesService);
    f.observe('2', item(100));
    expect(f.marks()).toEqual({});
    expect(localStorage.getItem('harid.fav.prices')).toBeNull();
  });
  it('метки переживают перезагрузку (hydrate)', () => {
    TestBed.inject(FavoritesService).toggle('1', item(300));
    TestBed.inject(FavoritesService).observe('1', item(250));
    TestBed.resetTestingModule(); TestBed.configureTestingModule({});
    const fresh = TestBed.inject(FavoritesService); fresh.hydrate();
    expect(fresh.drop('1')).toBe(50);
  });
});
```

(Как вызвать «Вернуть» — взять из существующего теста «удаление — … Вернуть» в этом же файле.)

- [ ] **Step 2:** `npx jest src/app/core/favorites.service.spec.ts` — новые тесты FAIL.
- [ ] **Step 3:** реализовать в `favorites.service.ts`; передать товар в `toggle` из карточки и трёх мест страницы товара (`fav.toggle(p.id, p)`).
- [ ] **Step 4:** `npx jest src/app/core/favorites.service.spec.ts src/app/shared/product-card.component.spec.ts src/app/pages/product` — PASS.
- [ ] **Step 5:** коммит `feat(favorites): запоминать цену при добавлении в избранное`.

### Task 3: Фоновая проверка цен

**Files:**
- Create: `src/app/core/price-check.service.ts`
- Modify: `src/app/app.component.ts` (в `afterNextRender` после `fav.hydrate()` — `priceCheck.start()`)
- Test: `src/app/core/price-check.service.spec.ts`

**Interfaces:**
- Consumes: Task 2 (`FavoritesService.ids`, `observe`), `MarketApi.product(id)`, `CLOCK`, `BrowserStorage`.
- Produces: `PriceCheckService.start(): void` (идемпотентен); `PriceCheckService.run(): Observable<void>` — сама проверка без планирования (для тестов); константы `CHECK_EVERY_MS`, `CHECK_LIMIT`, `CHECK_CONCURRENCY` экспортируются.

- [ ] **Step 1: Тесты** (MarketApi — заглушка `{ product: jest.fn((id) => of({ id, price: …, in_stock: true })) }`, `CLOCK` — фиксированное время)

```ts
it('проверяет последние 30 добавленных, не больше 4 запросов одновременно, пишет checkedAt', ...);
// ids '1'..'35' → запрошены '6'..'35'; пиковое число одновременных подписок ≤ 4 (счётчик в заглушке на Subject'ах); harid.fav.checkedAt = now
it('с прошлой проверки меньше 6 часов — запросов нет', ...);
it('ошибка по одному товару не мешает остальным', ...);           // product('2') → throwError, '1' и '3' получили observe
it('пустое избранное, нет сети или saveData — запросов нет', ...);
it('start() на сервере (PLATFORM_ID server) ничего не планирует', ...);
it('цена из ответа доходит до FavoritesService.observe', ...);    // после run(): fav.drop(id) === ожидаемое
```

- [ ] **Step 2:** `npx jest src/app/core/price-check.service.spec.ts` — FAIL.
- [ ] **Step 3:** реализовать: `start()` — только браузер, один раз, через `requestIdleCallback` (нет его — `setTimeout(…, 2000)`); `run()` — `from(ids.slice(-CHECK_LIMIT)).pipe(mergeMap(id => api.product(id).pipe(catchError(() => EMPTY)), CHECK_CONCURRENCY))`, каждый ответ — `fav.observe(p.id, p)`, по завершении `checkedAt = now`.
- [ ] **Step 4:** тот же запуск + `npx jest src/app/app.component.spec.ts` — PASS.
- [ ] **Step 5:** коммит `feat(favorites): фоновая проверка цен избранного`.

### Task 4: Попутные цены из карточки и страницы товара

**Files:**
- Modify: `src/app/shared/product-card.component.ts` (effect: товар в избранном → `fav.observe(p.id, p)`)
- Modify: `src/app/pages/product/product.component.ts` (то же для загруженного `product()`)
- Test: `src/app/shared/product-card.component.spec.ts`, `src/app/pages/product/product.component.spec.ts`

**Interfaces:**
- Consumes: Task 2 (`has`, `observe`).

- [ ] **Step 1: Тесты:** `'карточка товара из избранного сообщает его цену'` — `toggle('1', {price: 300, in_stock: true})`, отрисовать карточку с `price: 250` → `fav.drop('1') === 50`; `'карточка товара не из избранного ничего не пишет'` → `fav.marks()` пуст. То же одним тестом для страницы товара.
- [ ] **Step 2:** запуск этих spec — FAIL.
- [ ] **Step 3:** `effect(() => { const p = this.product(); if (p && this.fav.has(p.id)) untracked(() => this.fav.observe(p.id, p)); })`.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** коммит `feat(favorites): цены из ленты и страницы товара обновляют избранное`.

### Task 5: Страница избранного — плашка и порядок

**Files:**
- Modify: `src/app/shared/product-card.component.ts` (input `drop = input<number | null>(null)`; плашка `data-test="price-drop"`)
- Modify: `src/app/pages/favorites/favorites.component.ts` (подешевевшие первыми, `[drop]="fav.drop(p.id)"`, `fav.markSeen()` после загрузки списка)
- Modify: `src/app/i18n/tg/account.ts` (`'Подешевело на {sum}': 'Арзон шуд: {sum}'`)
- Test: `src/app/pages/favorites/favorites.component.spec.ts` (создать, если нет), `src/app/shared/product-card.component.spec.ts`

**Interfaces:**
- Consumes: Task 2 (`drop`, `markSeen`, `ids`).
- Produces: `ProductCardComponent.drop` input.

- [ ] **Step 1: Тесты:**
  - карточка с `drop = 50` показывает `[data-test=price-drop]` с текстом `'Подешевело на 50 смн'` (сумма через `money`), без `drop` — плашки нет;
  - избранное `['1','2','3']`, подешевел `'3'` → порядок карточек `3, 1, 2`, у `'3'` плашка;
  - после загрузки списка `fav.hasFreshDrop() === false`;
  - по-таджикски (`LANG_DICT = TG`, cookie `lang=tg`) — `'Арзон шуд: 50 смн'`.
- [ ] **Step 2:** запуск — FAIL.
- [ ] **Step 3:** реализовать; плашка — в духе `.discount` на фото, но под ценой (не перекрывает плашку скидки лавки): шафрановый фон `var(--color-saffron)`, текст `var(--color-on-saffron)`.
- [ ] **Step 4:** PASS, плюс `npx jest src/app/i18n` (покрытие словаря).
- [ ] **Step 5:** коммит `feat(favorites): плашка «Подешевело» и подешевевшие первыми`.

### Task 6: Точка на вкладке и в шапке

**Files:**
- Modify: `src/app/shared/tab-bar.component.ts`, `src/app/shared/header.component.ts`
- Modify: `src/app/i18n/tg/shell.ts` (`'Избранное, есть подешевевшие товары': 'Интихобшудаҳо, моли арзоншуда ҳаст'`)
- Test: `src/app/shared/tab-bar.component.spec.ts`, `src/app/shared/header.component.spec.ts`

**Interfaces:**
- Consumes: Task 2 (`hasFreshDrop`).

- [ ] **Step 1: Тесты:** при `hasFreshDrop()` у ссылки `/favorites` есть `[data-test=fav-drop-dot]` и `aria-label="Избранное, есть подешевевшие товары"`; без снижения — ни точки, ни aria-label; по-таджикски aria-label переведён.
- [ ] **Step 2:** запуск — FAIL.
- [ ] **Step 3:** точка 8px, шафрановая с белой обводкой, как `.badge` корзины, `aria-hidden="true"`; на вкладке — у иконки сердца (обернуть иконку в `.ico` как у корзины).
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** коммит `feat(favorites): точка «подешевело» на вкладке и в шапке`.

### Task 7: Проверка целиком и PR

- [ ] `npx jest` — все PASS; `npx ngc -p tsconfig.app.json --noEmit` — 0 ошибок; `npx ng build` — успешно.
- [ ] Ручная проверка: dev-сервер на свободном порту, в `localStorage` `harid.fav` + `harid.fav.prices` с завышенным `base` у реального товара → точка на вкладке, плашка в избранном, после захода точка гаснет; скриншоты RU и TG в `docs/screenshots/pr-favorites-price-drop/`.
- [ ] Push, PR с базой `fix/tab-bar-tajik-labels`, «Фотоотчёт» комментарием.
