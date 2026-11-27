# Несколько сохранённых адресов — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** на оформлении заказа ряд «Кому доставить». Нажатие на получателя заполняет имя, телефон, район и адрес. Список копится сам из заказов в браузере и, для вошедшего покупателя, из истории заказов.

**Architecture:** чистые функции в `core/saved-addresses.ts`: разбор, ключ получателя, слияние, получатели из заказов, старый формат. Сервис `SavedAddresses` в `core/saved-addresses.service.ts`: localStorage, история через `MarketApi.myOrders()`, удаление с «Вернуть». Checkout рисует ряд, подставляет получателя и после заказа вызывает `remember`.

**Tech Stack:** Angular 19 standalone, signals, OnPush, SSR, reactive forms, Jest + jest-preset-angular.

**Spec:** `docs/superpowers/specs/2026-11-27-saved-addresses-design.md`

## Global Constraints
- Получатель — `{ name, phone, district, address }`, `phone` хранится 9 цифрами (`phone9`), `district` только из `DISTRICTS`.
- Ключи хранилища: `harid.addresses` (список, свежие первыми), `harid.addresses.hidden` (скрытые ключи). Старые `harid.lastAddress` и `harid.lastPhone` только читаются.
- Не больше 10 получателей (`MAX_RECIPIENTS = 10`).
- Один получатель — совпадают телефон, район и адрес (адрес без регистра, обрезанный, пробелы схлопнуты). Имя в ключ не входит.
- Комментарий курьеру не сохраняется.
- Backend не меняется. Новые русские строки — ключи словаря, у каждой есть перевод в `src/app/i18n/tg/buy.ts`, `coverage.spec.ts` зелёный.
- Не коммитить `angular.json` и `src/environments/environment.ts`, добавлять файлы явными путями.
- Коммиты заканчиваются строкой `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus
1. Телефон из истории в формате сервера (`+992 93 111 00 02`) — тот же получатель, что и локальный `931110002`, без дубля (тест в Task 1).
2. Убрали получателя, чьи данные сейчас в форме: поля не очищаются и не заменяются следующим получателем (тест в Task 3).
3. История пришла позже: нетронутые поля заполняются получателем из истории, уже введённое покупателем не перетирается (тест в Task 3).
4. Вышел из аккаунта или вошёл другой покупатель на том же телефоне: получателей из чужой истории не видно (тест в Task 2).
5. Скрытый получатель из истории, которому снова сделали заказ, опять виден. Список скрытых не растёт бесконечно, хранятся последние 50 (тесты в Task 2).

---

### Task 1: Чистые функции получателей

**Files:**
- Create: `src/app/core/saved-addresses.ts`
- Test: `src/app/core/saved-addresses.spec.ts`
- Modify: `src/app/pages/checkout/checkout.component.ts:23-37` — `LastAddress` и `readLastAddress` переезжают в `core/saved-addresses.ts`, checkout импортирует их оттуда
- Modify: `src/app/pages/checkout/checkout.component.spec.ts` — тест `readLastAddress` переезжает в новый spec, импорт убрать

**Interfaces:**
- Produces:
  - `interface Recipient { name: string; phone: string; district: string; address: string }`
  - `const MAX_RECIPIENTS = 10`
  - `recipientKey(r: Recipient): string` — `` `${r.phone}|${r.district}|${norm(r.address)}` ``, где `norm` = trim, `\s+` → пробел, toLowerCase
  - `toRecipient(v: unknown): Recipient | null` — объект с name (trim, ≥2), phone (`phone9`, ровно 9 цифр), district (из `DISTRICTS`), address (trim, ≥3), иначе null
  - `parseRecipients(raw: unknown): Recipient[]` — не массив → `[]`, плохие записи выброшены
  - `mergeRecipients(lists: readonly Recipient[][], hidden: ReadonlySet<string>, limit = MAX_RECIPIENTS): Recipient[]` — по порядку, первый с ключом побеждает, скрытые выброшены, обрезано до limit
  - `recipientsFromOrders(orders: readonly Order[]): Recipient[]` — по убыванию `created_at`, `toRecipient(o.customer)`
  - `interface LastAddress`, `readLastAddress(v: unknown): Partial<LastAddress>` — без изменений, только переезд
  - `legacyRecipient(lastAddress: unknown, lastPhone: unknown): Recipient | null` — `toRecipient({ ...readLastAddress(lastAddress), phone: lastPhone })`, при нестроковом телефоне null

- [ ] **Step 1: Написать падающие тесты** (`saved-addresses.spec.ts`)

```ts
const mama = { name: 'Мама', phone: '931110002', district: 'Вахдат', address: 'ул. Ленина 5' };
it('toRecipient: номер к 9 цифрам, мусор и чужой район — null', () => {
  expect(toRecipient({ ...mama, name: ' Мама ', phone: '+992 93 111 00 02' })).toEqual(mama);
  expect(toRecipient({ ...mama, district: 'Марс' })).toBeNull();
  expect(toRecipient({ ...mama, phone: '93111' })).toBeNull();
  expect(toRecipient({ ...mama, address: ' у ' })).toBeNull();
  expect(toRecipient('x')).toBeNull();
});
it('parseRecipients: не массив — пусто, плохие записи выброшены', () => {
  expect(parseRecipients({ a: 1 })).toEqual([]);
  expect(parseRecipients([mama, null, { name: 'x' }])).toEqual([mama]);
});
it('recipientKey: адрес без регистра и лишних пробелов, имя не входит', () => {
  expect(recipientKey({ ...mama, name: 'Модар', address: '  УЛ.  ленина 5 ' })).toBe(recipientKey(mama));
  expect(recipientKey({ ...mama, address: 'ул. Ленина 7' })).not.toBe(recipientKey(mama));
});
it('mergeRecipients: первый побеждает, скрытые выброшены, не больше 10', () => {
  const work = { ...mama, name: 'Наим', district: 'Сино', address: 'Рудаки 12' };
  expect(mergeRecipients([[mama], [{ ...mama, name: 'Модар' }, work]], new Set())).toEqual([mama, work]);
  expect(mergeRecipients([[mama, work]], new Set([recipientKey(mama)]))).toEqual([work]);
  const many = Array.from({ length: 12 }, (_, i) => ({ ...mama, address: `дом ${i + 10}` }));
  expect(mergeRecipients([many], new Set())).toHaveLength(10);
});
it('recipientsFromOrders: свежие первыми, номер сервера к 9 цифрам', () => {
  const order = (created_at: string, customer: object) => ({ created_at, customer }) as unknown as Order;
  expect(recipientsFromOrders([
    order('2026-11-01T10:00:00Z', { ...mama, phone: '+992 93 111 00 02' }),
    order('2026-11-20T10:00:00Z', { name: 'Наим', phone: '+992927000000', district: 'Сино', address: 'Рудаки 12' }),
  ])).toEqual([{ name: 'Наим', phone: '927000000', district: 'Сино', address: 'Рудаки 12' }, mama]);
});
it('legacyRecipient: из lastAddress и lastPhone; без телефона — null', () => {
  expect(legacyRecipient({ name: 'Мама', district: 'Вахдат', address: 'ул. Ленина 5' }, '931110002')).toEqual(mama);
  expect(legacyRecipient({ name: 'Мама', district: 'Вахдат', address: 'ул. Ленина 5' }, null)).toBeNull();
});
```
Плюс сюда переезжает без изменений тест `readLastAddress: мусор и неизвестный район отбрасываются` из checkout spec.

- [ ] **Step 2: Запустить, убедиться, что падает**
Run: `npx jest src/app/core/saved-addresses.spec.ts`
Expected: FAIL — `Cannot find module './saved-addresses'`

- [ ] **Step 3: Реализовать `core/saved-addresses.ts` по Interfaces и перенести `LastAddress`/`readLastAddress`**

- [ ] **Step 4: Запустить тесты**
Run: `npx jest src/app/core/saved-addresses.spec.ts src/app/pages/checkout`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/app/core/saved-addresses.ts src/app/core/saved-addresses.spec.ts src/app/pages/checkout/checkout.component.ts src/app/pages/checkout/checkout.component.spec.ts
git commit -m "feat(checkout): получатели — разбор, ключ, слияние, из истории заказов"
```

---

### Task 2: Сервис `SavedAddresses`

**Files:**
- Create: `src/app/core/saved-addresses.service.ts`
- Test: `src/app/core/saved-addresses.service.spec.ts`

**Interfaces:**
- Consumes: всё из Task 1; `MarketApi.myOrders(): Observable<Order[]>`; `AuthService.token`, `AuthService.loggedIn`; `BrowserStorage`; `ToastService.show`; `I18n.t`.
- Produces (`@Injectable({ providedIn: 'root' })`):
  - `readonly list: Signal<Recipient[]>` — `mergeRecipients([local, history], hidden)`. История учитывается, только если она загружена для текущего `auth.token()`.
  - `load(): void` — только в браузере. Читает локальный список, а если `harid.addresses` нет, переносит `legacyRecipient(harid.lastAddress, harid.lastPhone)` и записывает. Для вошедшего покупателя один раз на токен запрашивает `myOrders()`, ошибку молча пропускает. Повторный вызов с тем же токеном не делает запроса, но заново читает локальное хранилище.
  - `remember(r: Recipient): void` — перечитать `harid.addresses`, убрать запись с тем же ключом, поставить `r` первой, обрезать до 10, записать. Ключ убрать из скрытых. Удалить `harid.lastAddress` и `harid.lastPhone`.
  - `remove(r: Recipient): void` — перечитать, убрать из локального списка (запомнить индекс), добавить ключ в скрытые (последние 50), записать оба ключа, удалить старые ключи. Плашка `{ text: i18n.t('Адрес удалён'), action: { label: i18n.t('Вернуть'), run } }`: `run` снимает скрытие и возвращает запись на прежний индекс, если она была локальной.
  - Ключи хранилища — константы модуля, `HIDDEN_LIMIT = 50`.

- [ ] **Step 1: Написать падающие тесты.** MarketApi подменяется `{ myOrders: jest.fn(() => of(orders)) }`, вход — `auth.setSession({ token: 't1', buyer: { id: 1, phone: '+992927000000', name: null }, is_new: false })`.

```ts
it('переносит старый адрес: lastAddress + lastPhone → первая запись', ...)       // list() == [mama], harid.addresses записан
it('без входа историю не запрашивает', ...)                                        // myOrders not called
it('вошедший: локальные первыми, за ними из истории, без дублей', ...)             // local [work], history [mama, work'] → [work, mama]
it('история запрашивается один раз на токен', ...)                                 // load() x2 → myOrders called 1
it('ошибка истории — только локальный список', ...)                                // myOrders → throwError → list() == local
it('после выхода и входа другого покупателя чужой истории нет', ...)               // logout → list() без истории; setSession t2 + load() → новый запрос, старых нет
it('remember: свежий наверх, тот же получатель не дублируется, имя обновляется', ...)
it('remember: не больше 10', ...)
it('remember не затирает запись другой вкладки', ...)                              // localStorage.setItem('harid.addresses', [other]) до remember → оба в хранилище
it('remember удаляет harid.lastAddress и harid.lastPhone', ...)
it('remove скрывает получателя из истории; «Вернуть» показывает снова', ...)      // ToastService.act()
it('remove локального и «Вернуть» — на прежнее место', ...)
it('снова заказали скрытому получателю — он опять виден', ...)                     // remove(mama) → remember(mama) → list() содержит mama
it('скрытых хранится не больше 50', ...)                                           // 55 remove → harid.addresses.hidden length 50
it('на сервере load() ничего не читает и не запрашивает', ...)                    // PLATFORM_ID 'server'
```
Каждый `it` проверяет значения из комментария справа: `expect(s.list()).toEqual(...)`, `expect(myOrders).toHaveBeenCalledTimes(n)`, `JSON.parse(localStorage.getItem(...))`.

- [ ] **Step 2: Запустить, убедиться, что падает**
Run: `npx jest src/app/core/saved-addresses.service.spec.ts`
Expected: FAIL — `Cannot find module './saved-addresses.service'`

- [ ] **Step 3: Реализовать сервис по Interfaces.** Сигналы `local`, `hidden`, `history: { token: string; items: Recipient[] } | null`. `list` — computed, который проверяет `history.token === auth.token()`. Запрос `myOrders` обёрнут в `defer` + `catchError(() => EMPTY)`.

- [ ] **Step 4: Запустить тесты**
Run: `npx jest src/app/core/saved-addresses.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/app/core/saved-addresses.service.ts src/app/core/saved-addresses.service.spec.ts
git commit -m "feat(checkout): сервис сохранённых получателей — браузер и история заказов"
```

---

### Task 3: Ряд «Кому доставить» на оформлении

**Files:**
- Modify: `src/app/pages/checkout/checkout.component.ts` — шаблон перед `<fieldset>` «Кто получит», префилл-effect (`:197-218`), `submit` (`:245-247`), стили
- Modify: `src/app/i18n/tg/buy.ts` — новые строки
- Test: `src/app/pages/checkout/checkout.component.spec.ts`

**Interfaces:**
- Consumes: `SavedAddresses.list/load/remember/remove`, `recipientKey`, `Recipient` (Task 1–2).
- Produces в компоненте:
  - `readonly saved = inject(SavedAddresses)`
  - `pick(r: Recipient): void` — `patchValue` четырёх полей и `markAsDirty` каждого (дальше префилл их не трогает)
  - `newRecipient(): void` — name, phone, address = `''` и `markAsDirty`, район не меняется (у select нет пустого значения), фокус на `#co-name`
  - `isPicked(r: Recipient): boolean` — из `toSignal(form.valueChanges)`: `recipientKey` от `{ name, phone: phone9(phone), district, address: address.trim() }` совпадает и `name.trim() === r.name`
- Префилл: effect следит за `auth.ready()` и `saved.list()`, вызывает `saved.load()` один раз после `auth.ready()`. Если список не пуст и получатель ещё не подставлялся (флаг `prefilledFromSaved`), первый получатель идёт во все четыре нетронутых поля и флаг ставится. Пока список пуст — старый префилл без изменений (имя профиля или `lastAddress.name`, телефон покупателя или `lastPhone`, район и адрес из `lastAddress`).
- `submit` при успехе: `this.saved.remember({ name: v.name.trim(), phone, district: v.district, address: v.address.trim() })` вместо двух `store.set`.
- Шаблон:
  - `<div class="recipients" role="group" aria-labelledby="co-rcp-title">` с `<p id="co-rcp-title">{{ 'Кому доставить' | t }}</p>`, только при `saved.list().length`.
  - На каждого получателя (`track recipientKey(r)`) `data-test="recipient"`: кнопка выбора с `[attr.aria-pressed]="isPicked(r)"`, имя и строка `{{ r.district }} · {{ r.address }}` (обрезка многоточием). Рядом `data-test="recipient-remove"` с иконкой `x` и `aria-label` `{{ 'Убрать: {name}' | t: { name: r.name } }}`, зона нажатия не меньше 44×44.
  - В конце `data-test="recipient-new"`: иконка `plus` и `{{ 'Новый получатель' | t }}`.
  - Ряд в одну строку с прокруткой вбок (`overflow-x: auto`), стиль как `.chip` в `feed-filters.component.ts`, выбранный — как `.chip--on`.
- Таджикский (`buy.ts`): `'Кому доставить': 'Ба кӣ расонем'`, `'Новый получатель': 'Гирандаи нав'`, `'Убрать: {name}': 'Хориҷ кардан: {name}'`, `'Адрес удалён': 'Суроға хориҷ шуд'`.

- [ ] **Step 1: Написать падающие тесты.** Существующие тесты префилла (`префилл имени и телефона…`, `телефон вошедшего покупателя важнее…`, `без покупателя телефон…`, `префилл имени, района и адреса…`, `имя из профиля важнее…`, `введённое вручную не перетирается…`) не меняются: в них нет `harid.addresses` и нет пары lastAddress + lastPhone. Два теста про запоминание меняются:

```ts
it('после заказа получатель запоминается (без комментария)', ...)
  // как сейчас, но: expect(JSON.parse(localStorage.getItem('harid.addresses')!)).toEqual([{ name: 'Фаррух', phone: '931110002', district: 'Вахдат', address: 'ул. Рудаки 10' }])
it('ошибка заказа — получатель не запоминается', ...)   // harid.addresses === null
```
Новые (`harid.addresses` кладётся в localStorage до создания компонента; для истории MarketApi подменяется `{ placeOrder, myOrders }`, покупатель входит через `harid.token` + `harid.buyer`):
```ts
it('ряд «Кому доставить» с получателями; без сохранённых — ряда нет', ...)        // [data-test=recipient] x2 / querySelector('.recipients') === null
it('при открытии подставлен самый свежий получатель — все четыре поля', ...)      // [mama, work] → form = mama, delivery() 25
it('нажатие на получателя заполняет форму и выделяет его', ...)                   // click 2-го → form = work, aria-pressed 'true' у 2-го, 'false' у 1-го
it('поменяли номер — выделение снимается', ...)                                    // phone.setValue('935550000') → все aria-pressed 'false'
it('«Новый получатель» очищает имя, телефон, адрес и ставит фокус на имя', ...)  // document.activeElement.id === 'co-name'
it('убрали получателя, который в форме, — поля не меняются', ...)                 // click remove у 1-го → form по-прежнему mama, [data-test=recipient] x1
it('история пришла позже: нетронутые поля из истории, введённое не трогается', ...)  // myOrders → Subject; name dirty 'Иван'; subject.next([order(mama)]) → name 'Иван', phone/district/address из mama
it('кнопка «Убрать» подписана именем получателя', ...)                            // aria-label 'Убрать: Мама'
```
В `describe('CheckoutComponent по-таджикски')` добавить: `'Ба кӣ расонем'` в тексте и `aria-label` `'Хориҷ кардан: Мама'` при одном сохранённом получателе.

- [ ] **Step 2: Запустить, убедиться, что падает**
Run: `npx jest src/app/pages/checkout`
Expected: FAIL — нет `[data-test="recipient"]`, `harid.addresses` равен null

- [ ] **Step 3: Реализовать в checkout и добавить переводы в `buy.ts`**

- [ ] **Step 4: Запустить тесты, `ngc` и весь набор**
Run: `npx jest src/app/pages/checkout src/app/i18n` → PASS
Run: `npx ngc -p tsconfig.app.json --noEmit` → без ошибок
Run: `npx jest` → всё зелёное (было 981 на `feat/favorites-price-drop`)

- [ ] **Step 5: Commit**
```bash
git add src/app/pages/checkout/checkout.component.ts src/app/pages/checkout/checkout.component.spec.ts src/app/i18n/tg/buy.ts
git commit -m "feat(checkout): ряд «Кому доставить» — выбор, новый получатель, убрать"
```

---

### Task 4: Проверка вживую и скриншоты к PR

**Files:**
- Create: `docs/screenshots/pr-saved-addresses/*.jpg`

- [ ] **Step 1:** `npx ng build` → сборка проходит.
- [ ] **Step 2:** dev-сервер `npx ng serve --port 4417 < /dev/null`. Playwright с `channel: 'chrome'`: в localStorage два получателя (Сино и Вахдат) и товар в корзине. Открыть `/checkout` на 390px и 1280px, по-русски и по-таджикски (cookie языка), снять полную страницу через `clip`. Проверить: первый получатель подставлен, нажатие на второго меняет доставку на 25 смн, × убирает получателя и показывает плашку «Вернуть».
- [ ] **Step 3:** остановить dev-сервер и убедиться, что порт 4417 свободен.
- [ ] **Step 4: Commit**
```bash
git add docs/screenshots/pr-saved-addresses
git commit -m "docs: скриншоты «Кому доставить» к PR"
```
