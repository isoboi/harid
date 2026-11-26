# Повторить заказ — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Кнопка «Повторить заказ» кладёт доступные товары прошлого заказа в корзину и открывает её. PR 1 — страница заказа, PR 2 — список «Мои заказы».

**Architecture:** `RepeatOrderService` (`src/app/core/repeat-order.service.ts`) заново запрашивает товары заказа, отсеивает недоступные, добавляет остальные через `CartService.add`, показывает тост и уводит в `/cart`. Тексты тоста собирает чистая функция `repeatMessage`. Страница заказа (Task 2) и список заказов (Task 3) только вызывают `repeat(order)` и показывают «Добавляем…».

**Tech Stack:** Angular 19 (standalone, signals, SSR), RxJS `forkJoin`, Jest + jest-preset-angular.

**Spec:** `docs/superpowers/specs/2026-11-25-repeat-order-design.md`

## Global Constraints

- Кнопка показывается только у заказов со `stage` `delivered` или `cancelled`.
- Текст кнопки «Повторить заказ», во время запросов «Добавляем…» и `disabled`.
- Товары **добавляются** к корзине (`cart.add`), корзина не очищается. Лимиты корзины: 30 позиций (`MAX_LINES`), 20 штук (`MAX_QTY`) — их соблюдает сам `add`.
- Позиция недоступна, если: товар не пришёл (любая ошибка), `!in_stock`, `directOnly(product)`, `price === null`, размер позиции не входит в непустой `product.sizes`.
- Тексты тостов (точно):
  - всё добавлено: `Добавили в корзину ${n} ${plural(n, ['товар', 'товара', 'товаров'])}` (kind `info`);
  - часть: части через `. `: `Добавили ${added} из ${total}`; если есть недоступные — `Нет в наличии: «A», «B»` (до двух названий, дальше ` и ещё ${k}`); если не влезло — `Корзина заполнена — не поместилось ${overflow}` (kind `info`);
  - ничего, и хотя бы одна позиция не влезла: `В корзине уже 30 позиций — оформите заказ или уберите лишнее` (kind `error`);
  - ничего, и все запросы упали не с 404/400: `Не удалось повторить заказ. Проверьте интернет и попробуйте ещё раз` (kind `error`);
  - ничего, остальные случаи: `Товаров из этого заказа сейчас нет в наличии` (kind `error`).
- Переход `router.navigateByUrl('/cart')` — только если добавлена хотя бы одна позиция.
- PR 1 = Task 1 + Task 2 в ветке `feat/repeat-order`. PR 2 = Task 3 в ветке `feat/repeat-order-list` поверх `feat/repeat-order`.
- Комментарии и сообщения коммитов пишутся по-русски (`feat: …`) и заканчиваются строкой `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Один товар в двух позициях с разными размерами** (`product_id` один, `size` `S` и `M`). Ожидание: один запрос к API, в корзине две строки (тест в Task 1).
2. **Позиция без размера, а у товара теперь несколько размеров.** Покупателю нельзя подставить размер за него: позиция недоступна. Если размер у товара один, берём его (тест в Task 1; это решение планировщика сверх спека).
3. **Двойное нажатие на кнопку**, пока идут запросы. Ожидание: второй вызов `repeat` не происходит (тест в Task 2).
4. **Корзина уже почти полная** (29 позиций, в заказе 3). Ожидание: добавлена одна, тост сообщает «не поместилось 2», переход в корзину (тест в Task 1).
5. **Покупатель ушёл со страницы, пока идут запросы.** Ожидание: подписка не отменяется (товары всё равно добавятся и покажется тост), но переход в корзину всё равно случится — это приемлемо, покупатель сам нажал «Повторить». Тест не нужен, проверить при ревью, что компонент не падает после уничтожения.

---

### Task 1: `RepeatOrderService` и `repeatMessage`

**Files:**
- Create: `src/app/core/repeat-order.service.ts`
- Test: `src/app/core/repeat-order.service.spec.ts`

**Interfaces:**
- Produces:
  - `export interface RepeatResult { added: number; total: number; unavailable: string[]; overflow: number; offline: boolean }`
  - `export function repeatMessage(r: RepeatResult): { text: string; kind: 'info' | 'error' }`
  - `@Injectable({ providedIn: 'root' }) export class RepeatOrderService { repeat(order: Order): Observable<RepeatResult> }` — добавляет в корзину, показывает тост через `ToastService.show(repeatMessage(r))`, при `added > 0` вызывает `router.navigateByUrl('/cart')`.

- [ ] **Step 1: Написать падающие тесты.**
  `repeatMessage` (чистая функция):
  - `всё добавлено`: `{ added: 3, total: 3, unavailable: [], overflow: 0, offline: false }` → `{ text: 'Добавили в корзину 3 товара', kind: 'info' }`; с `added: 1, total: 1` → `'Добавили в корзину 1 товар'`.
  - `часть: два названия`: `{ added: 1, total: 3, unavailable: ['Платье', 'Куртка'], overflow: 0 }` → `'Добавили 1 из 3. Нет в наличии: «Платье», «Куртка»'`.
  - `часть: больше двух названий`: `unavailable: ['A', 'B', 'C', 'D'], added: 1, total: 5` → `'Добавили 1 из 5. Нет в наличии: «A», «B» и ещё 2'`.
  - `часть: не влезло`: `{ added: 1, total: 3, unavailable: [], overflow: 2 }` → `'Добавили 1 из 3. Корзина заполнена — не поместилось 2'`.
  - `ничего: корзина полна`: `{ added: 0, total: 2, unavailable: [], overflow: 2 }` → `{ text: 'В корзине уже 30 позиций — оформите заказ или уберите лишнее', kind: 'error' }`.
  - `ничего: сеть`: `{ added: 0, total: 2, unavailable: ['A', 'B'], overflow: 0, offline: true }` → `'Не удалось повторить заказ. Проверьте интернет и попробуйте ещё раз'`, `error`.
  - `ничего: нет в наличии`: `{ added: 0, total: 2, unavailable: ['A', 'B'], overflow: 0, offline: false }` → `'Товаров из этого заказа сейчас нет в наличии'`, `error`.

  `RepeatOrderService` (TestBed: `provideRouter([])`, `{ provide: MarketApi, useValue: { product: jest.fn((id) => …) } }`, настоящие `CartService` и `ToastService`; `jest.spyOn(router, 'navigateByUrl').mockResolvedValue(true)`; `localStorage.clear()` перед каждым). Фабрики: `line(over)` для `OrderLine` (`product_id: '1', shop_handle: 'a', title: 'T', price: 100, image: '', size: null, qty: 1`), `prod(over)` для `Product` (`in_stock: true, sizes: [], price: 100, shop_verified: true`), `order(lines, stage = 'delivered')`.
  - `все доступны: в корзине с размером и количеством, тост, переход`: две позиции `{ id '1', qty 2 }` и `{ id '2', size 'M' }` (у товара 2 `sizes: ['S', 'M']`) → `cart.items()` содержит `('1', null, 2)` и `('2', 'M', 1)`; результат `{ added: 2, total: 2, unavailable: [], overflow: 0, offline: false }`; `toasts.current()?.text === 'Добавили в корзину 2 товара'`; `navigateByUrl` вызван с `'/cart'`.
  - `цена в корзине — текущая, не из заказа`: позиция `price: 100`, товар `price: 120` → в корзине `product.price === 120`.
  - `недоступные отсеиваются`: пять позиций — 404, `in_stock: false`, `shop_verified: false`, `price: null`, размер `'XL'` при `sizes: ['S', 'M']` — плюс одна доступная → `added: 1, total: 6`, в `unavailable` пять названий в порядке заказа.
  - `без размера, а у товара их несколько — недоступна; размер один — берём его`: позиция `size: null`, товар `sizes: ['S', 'M']` → недоступна; другой товар `sizes: ['Стандарт']` → в корзине с размером `'Стандарт'`.
  - `один товар в двух позициях — один запрос`: позиции `{ id '1', size 'S' }` и `{ id '1', size 'M' }`, товар `sizes: ['S', 'M']` → `api.product` вызван 1 раз, в корзине две строки.
  - `корзина почти полная`: в корзину заранее положить 29 разных товаров (`cart.add`), заказ из трёх доступных → `added: 1, overflow: 2`, переход в `/cart`.
  - `сеть упала у всех`: `api.product` → `throwError(() => new HttpErrorResponse({ status: 0 }))` для всех → `offline: true`, `added: 0`, переход не вызван, тост `error`.
  - `404 у всех — не «сеть»`: все `status: 404` → `offline: false`, тост `'Товаров из этого заказа сейчас нет в наличии'`.

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx jest src/app/core/repeat-order.service.spec.ts`
Expected: FAIL, `Cannot find module './repeat-order.service'`

- [ ] **Step 3: Реализовать `src/app/core/repeat-order.service.ts`.** Уникальные `product_id` → `forkJoin` из `api.product(id).pipe(map(p => ({ p })), catchError(e => of({ err: e })))`. Пустой заказ — `of` пустого результата без запросов. Затем по позициям в порядке заказа: проверка доступности по Global Constraints, `cart.add(p, size, line.qty)`; `false` → `overflow++`. `offline` = `added === 0` и все ответы — ошибки со статусом не 404/400. После подсчёта: `toasts.show(repeatMessage(r))`, при `added > 0` — `router.navigateByUrl('/cart')`. Названия в `unavailable` — `line.title`.

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx jest src/app/core/repeat-order.service.spec.ts`
Expected: PASS, 15 тестов

- [ ] **Step 5: Коммит**

```bash
git add src/app/core/repeat-order.service.ts src/app/core/repeat-order.service.spec.ts
git commit -m "feat: повтор заказа — товары заново, доступные в корзину"
```

---

### Task 2: Кнопка на странице заказа (PR 1)

**Files:**
- Modify: `src/app/pages/order/order.component.ts` (шаблон `#actions` около строки 168, класс компонента)
- Test: `src/app/pages/order/order.component.spec.ts`

**Interfaces:**
- Consumes: `RepeatOrderService.repeat(order: Order): Observable<RepeatResult>` (Task 1)
- Produces: в разметке `<button type="button" class="btn" data-test="repeat">`.

- [ ] **Step 1: Написать падающие тесты** в `describe('OrderComponent')`. Подменить сервис: `{ provide: RepeatOrderService, useValue: { repeat: jest.fn(() => subject) } }`, где `subject = new Subject<RepeatResult>()`. Заказ открывать по токену (`setInput('t', 'tok-1')`), как в существующем тесте.
  - `«Повторить заказ» — только у доставленных и отменённых`: для `stage` `delivered` и `cancelled` есть `[data-test="repeat"]` с текстом «Повторить заказ»; для `placed`, `assembling`, `in_delivery` кнопки нет.
  - `«Повторить заказ»: вызывает повтор с этим заказом, пока идёт — «Добавляем…» и недоступна`: клик → `repeat` вызван с заказом (`toHaveBeenCalledWith(expect.objectContaining({ number: 'R-221526' }))`), кнопка `disabled` и текст «Добавляем…»; второй клик не вызывает `repeat` повторно (`toHaveBeenCalledTimes(1)`); после `subject.next(...)` и `subject.complete()` текст снова «Повторить заказ», кнопка доступна.
  - `«Повторить заказ»: ошибка сервиса — кнопка снова доступна`: `subject.error(new Error('x'))` → кнопка доступна, текст «Повторить заказ».

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx jest src/app/pages/order/order.component.spec.ts -t "Повторить заказ"`
Expected: FAIL, кнопки `[data-test="repeat"]` нет

- [ ] **Step 3: Реализовать.** В компоненте: `private readonly repeater = inject(RepeatOrderService)`, `readonly repeating = signal(false)`, метод `repeat(o: Order): void` (выход, если `repeating()`; ставит `true`; подписка на `repeater.repeat(o)` с `finalize(() => this.repeating.set(false))`). В `#actions` первой кнопкой: `@if (order(); as o) { @if (o.stage === 'delivered' || o.stage === 'cancelled') { <button …>{{ repeating() ? 'Добавляем…' : 'Повторить заказ' }}</button> } }`. «Продолжить покупки» у такого заказа становится `btn--ghost`, чтобы главным действием была одна кнопка.

- [ ] **Step 4: Убедиться, что все тесты проходят**

Run: `npx jest`
Expected: PASS всех наборов, кроме известного `chat-socket.service.spec.ts` (падает только из-за незакоммиченного `environment.ts` пользователя)

- [ ] **Step 5: Проверить сборку**

Run: `npx ng build`
Expected: сборка без ошибок

- [ ] **Step 6: Коммит**

```bash
git add src/app/pages/order/order.component.ts src/app/pages/order/order.component.spec.ts
git commit -m "feat: «Повторить заказ» на странице заказа"
```

---

### Task 3: Кнопка в «Моих заказах» (PR 2)

**Files:**
- Branch: `git checkout -b feat/repeat-order-list` от `feat/repeat-order` (после коммита Task 2)
- Modify: `src/app/pages/my-orders/my-orders.component.ts` (строка списка около строк 70–102, стили `.row`)
- Test: `src/app/pages/my-orders/my-orders.component.spec.ts`

**Interfaces:**
- Consumes: `RepeatOrderService.repeat(order: Order): Observable<RepeatResult>` (Task 1)
- Produces: в строке заказа `<button type="button" class="repeat" data-test="repeat">` **вне** `a.row`.

- [ ] **Step 1: Написать падающие тесты.** Подмена сервиса — как в Task 2.
  - `«Повторить» в списке — только у доставленных и отменённых, вне ссылки на заказ`: список из заказов `delivered`, `cancelled`, `in_delivery` → две кнопки `[data-test="repeat"]`; ни одна не лежит внутри `a.row` (`btn.closest('a') === null`).
  - `«Повторить» в списке: повтор именно этого заказа, «Добавляем…» только у него`: клик по кнопке второго заказа → `repeat` вызван с его `number`; у него текст «Добавляем…» и `disabled`, у другого — «Повторить заказ» и доступна; после `complete()` всё как было.
  - Существующие тесты с `a.row` (переход на заказ по href) должны проходить без изменений.

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx jest src/app/pages/my-orders/my-orders.component.spec.ts -t "Повторить"`
Expected: FAIL, кнопок нет

- [ ] **Step 3: Реализовать.** `readonly repeatingNumber = signal<string | null>(null)`; метод `repeat(o: Order)` — выход, если `repeatingNumber()` не `null` (один повтор за раз), иначе как в Task 2 с `finalize(() => this.repeatingNumber.set(null))`. Разметка `li`: `a.row` как сейчас, кнопка после неё, внутри того же `li`. Вид: небольшая кнопка-ссылка «Повторить заказ» под строкой, с отступом слева на ширину превью на десктопе и без отступа на телефоне; поле нажатия не меньше 44px.

- [ ] **Step 4: Убедиться, что все тесты проходят**

Run: `npx jest`
Expected: PASS всех наборов, кроме известного `chat-socket.service.spec.ts`

- [ ] **Step 5: Проверить сборку**

Run: `npx ng build`
Expected: сборка без ошибок

- [ ] **Step 6: Коммит**

```bash
git add src/app/pages/my-orders/my-orders.component.ts src/app/pages/my-orders/my-orders.component.spec.ts
git commit -m "feat: «Повторить заказ» в списке «Мои заказы»"
```
