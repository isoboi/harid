# Похожие товары — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Блок «Похожие в других лавках» на странице товара: до 8 товаров той же категории из других лавок, отсортированных как замена текущему.

**Architecture:** Чистая функция `rankSimilar` в `src/app/shared/similar.ts` фильтрует и сортирует ответ `products({ category, limit: 24 })`. `ProductComponent` делает этот запрос рядом с «Ещё в лавке», хранит сырой ответ в сигнале и выводит `computed` от него и от `size()`. Положение блока зависит от `in_stock`.

**Tech Stack:** Angular 19 (standalone, signals, SSR), Jest + jest-preset-angular.

**Spec:** `docs/superpowers/specs/2026-11-25-similar-products-design.md`

## Global Constraints

- Запрос: `api.products({ category: p.category, limit: 24 })`. Если `p.category` пустая или `null`, запроса нет.
- В подборке нет текущего товара и нет ни одного товара лавки `p.shop_handle`.
- Порядок ключей: в наличии → подходит по выбранному размеру (товар с этим размером или вообще без размеров) → `|price − p.price|` по возрастанию, `price: null` в конце; если у текущего товара `price === null`, ценовой ключ не учитывается; при равенстве ключей сохраняется порядок сервера.
- Лимит: 8 товаров. Блок выводится только при **≥ 2** товарах.
- Заголовок: «Похожие в других лавках». Карточки: `app-product-card`, сетка `.products`, как в «Ещё в лавке».
- Место: если `p.in_stock`, блок стоит под «Ещё в лавке»; если нет, сразу под `.layout` (над отзывами).
- Ошибка запроса превращается в пустой список, страница товара работает как раньше.
- Комментарии и сообщения коммитов пишутся по-русски (`feat: …`) и заканчиваются строкой `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Текущий товар с ценой «в Direct»** (`price: null`). Ожидание: подборка строится по наличию и размеру, без падения и без `NaN` в сортировке (тест в Task 1).
2. **Альтернатива без размеров** (`sizes: []`) при выбранном размере. Ожидание: считается подходящей и не опускается ниже товаров «не того» размера (тест в Task 1).
3. **Переход на другой товар, пока подборка ещё грузится.** Ожидание: старый ответ не попадает на новую страницу (тест в Task 2).
4. **Категория есть, но в ней только товары этой же лавки.** Ожидание: блока нет, без пустого заголовка (тест в Task 2).
5. **Покупатель выбирает размер.** Ожидание: порядок меняется без нового запроса к API (тест в Task 2).

---

### Task 1: Функция подбора `rankSimilar`

**Files:**
- Create: `src/app/shared/similar.ts`
- Test: `src/app/shared/similar.spec.ts`

**Interfaces:**
- Produces: `export const SIMILAR_LIMIT = 8;` и `export function rankSimilar(list: Product[], product: Product, size: string | null): Product[]`

- [ ] **Step 1: Написать падающие тесты** в `src/app/shared/similar.spec.ts`. Фабрика: `const prod = (over: Partial<Product> = {}): Product => ({ id: '1', shop_handle: 'a', title: 'T', price: 100, old_price: null, image: '', category: 'shoes', description: '', sizes: [], in_stock: true, posted_at: '', ...over });`. Текущий товар `cur = prod({ id: '0', shop_handle: 'mine', price: 300 })`.
  - `убирает текущий товар и всю его лавку`: list `[cur, prod({ id: '1', shop_handle: 'mine' }), prod({ id: '2', shop_handle: 'b' })]` → ids `['2']`.
  - `сначала в наличии`: `[prod({ id: '1', shop_handle: 'b', in_stock: false, price: 300 }), prod({ id: '2', shop_handle: 'c', price: 900 })]` → `['2', '1']`.
  - `выбранный размер: с ним или без размеров раньше остальных`: size `'42'`; list `[{id:'1', sizes:['40'], price:300}, {id:'2', sizes:['42','43'], price:900}, {id:'3', sizes:[], price:950}]` (все из лавки `'b'`) → `['2', '3', '1']`.
  - `без выбранного размера размер не учитывается`: тот же list, size `null` → `['1', '2', '3']`.
  - `ближе по цене раньше, цена в Direct в конце`: `[{id:'1', price:1000}, {id:'2', price:null}, {id:'3', price:250}, {id:'4', price:320}]` → `['4', '3', '1', '2']`.
  - `у текущего товара нет цены: порядок сервера`: `cur` с `price: null`, list `[{id:'1', price:1000}, {id:'2', price:null}, {id:'3', price:5}]` → `['1', '2', '3']`.
  - `при равенстве порядок сервера`: два товара с `price: 300` (`id '1'`, `id '2'`) → `['1', '2']`.
  - `не больше 8`: 12 товаров из лавки `'b'` → длина `8`, `SIMILAR_LIMIT === 8`.
  - `не меняет входной массив`: после вызова `list` совпадает со своей копией (`toEqual`).

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx jest src/app/shared/similar.spec.ts`
Expected: FAIL, `Cannot find module './similar'`

- [ ] **Step 3: Реализовать `rankSimilar` в `src/app/shared/similar.ts`.** Фильтр по `id` и `shop_handle`, затем `[...list].sort(...)` (`Array.prototype.sort` стабилен) по трём ключам из Global Constraints, затем `slice(0, SIMILAR_LIMIT)`. Над функцией нужен короткий комментарий по-русски о том, зачем такой порядок («замена товару, который не подошёл»).

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx jest src/app/shared/similar.spec.ts`
Expected: PASS, 9 тестов

- [ ] **Step 5: Коммит**

```bash
git add src/app/shared/similar.ts src/app/shared/similar.spec.ts
git commit -m "feat: подбор похожих товаров из других лавок"
```

---

### Task 2: Блок на странице товара

**Files:**
- Modify: `src/app/pages/product/product.component.ts` (шаблон около строк 136 и 166–171, поля около 301, эффект загрузки около 369–383)
- Test: `src/app/pages/product/product.component.spec.ts`

**Interfaces:**
- Consumes: `rankSimilar(list, product, size)` и `SIMILAR_LIMIT` из `../../shared/similar` (Task 1)
- Produces: внутри компонента `similarRaw = signal<Product[]>([])` и `readonly similar = computed<Product[]>(...)`. В разметке `<section class="similar" data-test="similar">` с `<h2 class="section-title">Похожие в других лавках</h2>`.

- [ ] **Step 1: Написать падающие тесты** в `describe('ProductComponent')`. В `api.products` использовать `mockImplementation((q) => q.category ? of(alts) : of([]))`, чтобы отличать запрос подборки от «Ещё в лавке». `alts`: два товара из лавки `'other'` категории `'gadgets'` (id `'21'` с ценой 900, id `'22'` с ценой 550) и один из `'technomir.tj'` (id `'23'`). Для своих api-объектов можно расширить `render` необязательным третьим параметром `products`.
  - `похожие: запрос по категории на 24 товара, свои товары лавки не попадают`: `expect(api.products).toHaveBeenCalledWith({ category: 'gadgets', limit: 24 })`. В `[data-test="similar"]` заголовок «Похожие в других лавках», ссылки карточек ведут на `/product/22` и `/product/21` (именно в таком порядке, 550 ближе к 540), ссылки на `/product/23` нет.
  - `похожие: без категории запроса нет и блока нет`: `prod({ category: null })`. Ни один вызов `products` не содержит `category`, `[data-test="similar"]` равен `null`.
  - `похожие: меньше двух — блока нет`: `alts` из одного товара другой лавки. Блока нет.
  - `похожие: ошибка API — страница работает`: подборка отвечает `throwError(() => new HttpErrorResponse({ status: 500 }))`. Заголовок `h1` товара на месте, блока нет.
  - `похожие: в наличии — под «Ещё в лавке»; нет в наличии — над отзывами`: запрос с `shop` здесь отвечает `[prod({ id: '30' })]`, чтобы «Ещё в лавке» не была пустой. Для `in_stock: true` `section.more.compareDocumentPosition(similar) & Node.DOCUMENT_POSITION_FOLLOWING` истинно. Для `in_stock: false` блок предшествует `app-reviews` (`similar.compareDocumentPosition(reviews) & FOLLOWING`).
  - `похожие: выбор размера меняет порядок без нового запроса`: текущий `prod({ sizes: ['S', 'M'] })`, `alts` = `[{id:'21', sizes:['S'], price:540}, {id:'22', sizes:['M'], price:900}]` из лавки `'other'`. Сначала порядок `21, 22`. Затем клик по кнопке размера `M` (`[data-test="size"]`, вторая) и `detectChanges()`: порядок `22, 21`, а число вызовов `products` с `category` по-прежнему `1`.
  - `похожие: смена товара — старая подборка не показывается`: подборка для первого товара — `Subject<Product[]>`. Переключить `id` до её ответа, потом отправить в первый `Subject` товары. Ни одной ссылки из устаревшего ответа в DOM нет.

- [ ] **Step 2: Убедиться, что новые тесты падают**

Run: `npx jest src/app/pages/product/product.component.spec.ts -t "похожие"`
Expected: FAIL, блока `[data-test="similar"]` нет

- [ ] **Step 3: Реализовать в `ProductComponent`**
  - Поля: `private readonly similarRaw = signal<Product[]>([]);` и `readonly similar = computed(() => { const p = this.product(); return p ? rankSimilar(this.similarRaw(), p, this.size()) : []; });`.
  - В эффекте загрузки сбрасывать `this.similarRaw.set([])` рядом с `this.more.set([])`. В `nested` добавить запрос `this.api.products({ category: p.category, limit: 24 }).pipe(catchError(() => of([])))` под условием `if (p.category)`: он отменяется в существующем `onCleanup`.
  - Разметка: блок описан один раз в `<ng-template #similarBlock>` (`<section class="similar" data-test="similar">` с заголовком и `.products` из `app-product-card`) и выводится через `NgTemplateOutlet` (добавить в `imports`) в двух местах. Первое: сразу после закрывающего `</div>` элемента `.layout`, при `!p.in_stock && similar().length >= 2`. Второе: после секции `.more`, при `p.in_stock && similar().length >= 2`.
  - Стили: `.similar` получает те же отступы, что `.more` (`margin-top: 80px`, у `h2` `margin-bottom: 20px`). В верхнем положении (товар не в наличии) отступ `margin-top: 48px`.

- [ ] **Step 4: Убедиться, что все тесты проекта проходят**

Run: `npx jest`
Expected: PASS, все наборы, включая старые тесты страницы товара

- [ ] **Step 5: Проверить сборку с SSR**

Run: `npx ng build`
Expected: сборка без ошибок

- [ ] **Step 6: Коммит**

```bash
git add src/app/pages/product/product.component.ts src/app/pages/product/product.component.spec.ts
git commit -m "feat: «Похожие в других лавках» на странице товара"
```
