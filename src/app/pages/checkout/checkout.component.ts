import { afterNextRender, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage, priceChanges } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { BrowserStorage } from '../../core/browser-storage.service';
import { CartService } from '../../core/cart.service';
import { availableSlots, deliveryFor, DISTRICTS, slotLabel, SLOTS, SUBURBS } from '../../core/checkout-options';
import { CLOCK } from '../../core/clock';
import { I18n, TPipe } from '../../core/i18n';
import { MarketApi } from '../../core/market-api.service';
import { PHONE_PATTERN, phone9 } from '../../core/phone';
import { readLastAddress, Recipient, recipientKey } from '../../core/saved-addresses';
import { SavedAddresses } from '../../core/saved-addresses.service';
import { IconComponent } from '../../shared/icon.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { SkelSummaryComponent } from '../../shared/skeleton.component';

type Field = 'name' | 'phone' | 'district' | 'address' | 'slot' | 'comment';
/** Порядок полей на странице: фокус после неудачной отправки идёт на первое неверное. */
const FIELD_ORDER: Field[] = ['name', 'phone', 'district', 'address', 'slot', 'comment'];
const money = new MoneyPipe();

const LAST_ADDRESS = 'harid.lastAddress';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-checkout',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MoneyPipe, IconComponent, SkelSummaryComponent, TPipe],
  template: `
    <div class="wrap page-top">
      <h1 class="page-title head">{{ 'Оформление заказа' | t }}</h1>
      @if (!cart.ready()) {
        <!-- Заглушка до чтения корзины: два блока полей формы и сводка справа -->
        <div class="layout" role="status" data-test="skel-checkout">
          <span class="sr-only">{{ 'Загрузка…' | t }}</span>
          <div class="sets" aria-hidden="true">
            @for (set of skelSets; track $index) {
              <div class="skel-set">
                <span class="skel skel--line legend-skel"></span>
                <div class="grid two">
                  @for (n of set; track $index) { <div class="field"><span class="skel skel--line label-skel"></span><span class="skel control-skel"></span></div> }
                </div>
              </div>
            }
          </div>
          <app-skel-summary class="side" />
        </div>
      }
      @else if (!cart.count()) { <p class="empty">{{ 'Корзина пуста.' | t }} <a routerLink="/">{{ 'К товарам' | t }}</a></p> }
      @else {
        <!-- novalidate: ошибки показываем свои, на языке страницы и под полем, а не всплывашкой браузера -->
        <form [formGroup]="form" (ngSubmit)="submit()" class="layout" novalidate>
          <div class="sets">
            <fieldset>
              <legend>{{ 'Кто получит' | t }}</legend>
              @if (saved.list().length) {
                <div class="recipients" role="group" aria-labelledby="co-rcp-title">
                  <p class="rcp-title" id="co-rcp-title">{{ 'Кому доставить' | t }}</p>
                  <div class="rcp-row">
                    @for (r of saved.list(); track rcpKey(r)) {
                      <div class="rcp" data-test="recipient" [class.rcp--on]="isPicked(r)">
                        <button type="button" class="rcp-pick" data-test="recipient-pick" [attr.aria-pressed]="isPicked(r)" (click)="pick(r)">
                          <span class="rcp-name">{{ r.name }}@if (phoneTail(r); as tail) { · {{ tail }} }</span>
                          <span class="rcp-where">{{ r.district }} · {{ r.address }}</span>
                        </button>
                        <button type="button" class="rcp-x" data-test="recipient-remove" [attr.aria-label]="'Убрать: {name}' | t: { name: r.name }" (click)="saved.remove(r)">
                          <app-icon name="x" [size]="16" />
                        </button>
                      </div>
                    }
                    <button type="button" class="rcp-new" data-test="recipient-new" (click)="newRecipient()">
                      <app-icon name="plus" [size]="18" /><span>{{ 'Новый получатель' | t }}</span>
                    </button>
                  </div>
                </div>
              }
              <div class="grid two">
                <div class="field">
                  <label for="co-name">{{ 'Имя' | t }}</label>
                  <input id="co-name" class="field-control" formControlName="name" autocomplete="name" maxlength="100"
                    [attr.aria-invalid]="bad('name') || null" [attr.aria-describedby]="bad('name') ? 'co-name-err' : null" />
                  @if (bad('name')) { <p class="field-error" id="co-name-err">{{ 'Укажите имя' | t }}</p> }
                </div>
                <div class="field">
                  <label for="co-phone">{{ 'Телефон' | t }}</label>
                  <div class="tel">
                    <span class="tel-prefix" id="co-phone-prefix">+992</span>
                    <input id="co-phone" class="field-control" formControlName="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="93 123 45 67"
                      [attr.aria-invalid]="bad('phone') || null" [attr.aria-describedby]="bad('phone') ? 'co-phone-prefix co-phone-err' : 'co-phone-prefix co-phone-hint'" />
                  </div>
                  @if (bad('phone')) { <p class="field-error" id="co-phone-err">{{ 'Нужен номер из 9 цифр' | t }}</p> }
                  @else { <p class="field-hint" id="co-phone-hint">{{ 'Лавка и курьер позвонят на этот номер' | t }}</p> }
                </div>
              </div>
            </fieldset>
            <fieldset>
              <legend>{{ 'Куда и когда' | t }}</legend>
              <div class="grid where">
                <div class="field">
                  <label for="co-district">{{ 'Район' | t }}</label>
                  <select id="co-district" class="field-control" formControlName="district" aria-describedby="co-district-hint">
                    @for (d of districts; track d) { <option [value]="d">{{ d }}</option> }
                  </select>
                  <p class="field-hint" id="co-district-hint">{{ deliveryHint }}</p>
                </div>
                <div class="field">
                  <label for="co-address">{{ 'Улица, дом, квартира' | t }}</label>
                  <input id="co-address" class="field-control" formControlName="address" autocomplete="street-address" maxlength="255"
                    [attr.aria-invalid]="bad('address') || null" [attr.aria-describedby]="bad('address') ? 'co-address-err' : null" />
                  @if (bad('address')) { <p class="field-error" id="co-address-err">{{ 'Укажите адрес' | t }}</p> }
                </div>
              </div>
              <div class="grid two">
                <div class="field">
                  <label for="co-slot">{{ 'Когда привезти' | t }}</label>
                  <select id="co-slot" class="field-control" formControlName="slot">
                    <!-- value — русский слот, он уходит в заказ; подпись — на языке страницы -->
                    @for (s of slots(); track s) { <option [value]="s">{{ slotText(s) }}</option> }
                  </select>
                </div>
              </div>
              <div class="field">
                <label for="co-comment">{{ 'Комментарий курьеру' | t }} <span class="opt">{{ '— необязательно' | t }}</span></label>
                <textarea id="co-comment" class="field-control" formControlName="comment" rows="2" maxlength="500"></textarea>
              </div>
            </fieldset>
          </div>
          <aside class="summary side">
            <dl>
              <div><dt>{{ 'Товары, {n} шт.' | t: { n: cart.count() } }}</dt><dd>{{ cart.itemsTotal() | money }}</dd></div>
              <div><dt>{{ cart.groups().length > 1 ? ('Доставка ({n} {shops})' | t: { n: cart.groups().length, shops: i18n.plural(cart.groups().length, shopForms) }) : ('Доставка' | t) }}</dt><dd>{{ delivery() | money }}</dd></div>
              <div class="total"><dt>{{ 'Итого наличными курьеру' | t }}</dt><dd>{{ total() | money }}</dd></div>
            </dl>
            <p class="cash promise" data-test="cash-promise"><app-icon name="banknote" [size]="20" /><span>{{ 'Оплата наличными курьеру · без предоплаты · проверяете товар при курьере' | t }}</span></p>
            @if (error()) { <p class="field-error err" role="alert">{{ error() }}</p> }
            <!-- Кнопка доступна всегда: неверная форма объясняет себя ошибками под полями, а не молчит -->
            <button class="btn submit" type="submit" [disabled]="busy()">@if (busy()) { {{ 'Отправляем…' | t }} } @else { {{ 'Заказать — {total} наличными курьеру' | t: { total: (total() | money) } }} }</button>
          </aside>
        </form>
      }
    </div>
  `,
  styles: `
    .head { margin-bottom: 32px }
    .empty a { color: var(--color-lapis); text-decoration: underline; text-underline-offset: 2px }
    .layout { display: grid; align-items: start; gap: 40px }
    @media (min-width: 1024px) { .layout { grid-template-columns: minmax(0, 1fr) 360px } .side { position: sticky; top: 96px } }
    .sets { display: flex; flex-direction: column; gap: 40px; min-width: 0 }
    /* min-width: 0 тут и у .sets: иначе ряд получателей с прокруткой растягивает колонку сетки и форму за экран */
    fieldset { display: flex; flex-direction: column; gap: 16px; min-width: 0; margin: 0; padding: 0; border: 0 }
    /* legend «плавает» над рамкой — отступ даём ему самому */
    legend { margin-bottom: 16px; font-size: 20px; font-weight: 700 }
    .grid { display: grid; gap: 16px }
    @media (min-width: 640px) { .two { grid-template-columns: repeat(2, minmax(0, 1fr)) } .where { grid-template-columns: 220px minmax(0, 1fr) } }
    .opt { font-weight: 400; color: var(--color-ink-soft) }
    .promise { margin-top: 20px; font-size: 14px }
    .err { margin-top: 12px }
    /* Заглушка загрузки: легенда 20px, подпись 14px и поле 48px — как у настоящих полей */
    .skel-set { display: flex; flex-direction: column; gap: 16px }
    .legend-skel { width: 140px; height: 20px; margin-block: 5px 11px }
    .label-skel { width: 90px; margin-block: 3px }
    .control-skel { display: block; height: 48px }
    .submit { min-height: 48px; height: auto; padding-block: 12px; text-wrap: balance }
    /* «Кому доставить»: получатели в одну строку, на телефоне листаются вбок */
    .recipients { display: flex; flex-direction: column; gap: 8px; min-width: 0 }
    .rcp-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--color-ink-soft) }
    .rcp-row { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scroll-snap-type: x proximity; scrollbar-width: thin }
    .rcp { flex: none; display: flex; max-width: 260px; border: 1px solid var(--color-line); border-radius: var(--radius-photo); background: var(--color-paper); color: var(--color-ink); scroll-snap-align: start }
    .rcp--on { border-color: var(--color-ink); background: var(--color-ink); color: var(--color-paper) }
    .rcp-pick { flex: 1; min-width: 0; min-height: 52px; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: 2px; padding: 6px 2px 6px 14px; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer }
    .rcp-name, .rcp-where { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
    .rcp-name { font-size: 15px; font-weight: 600 }
    .rcp-where { font-size: 13px; opacity: .75 }
    .rcp-x { flex: none; width: 44px; min-height: 44px; display: grid; place-items: center; border: 0; border-radius: 0 var(--radius-photo) var(--radius-photo) 0; background: none; color: inherit; opacity: .75; cursor: pointer }
    .rcp-new { flex: none; min-height: 52px; display: inline-flex; align-items: center; gap: 6px; padding: 0 16px; border: 1px dashed var(--color-line); border-radius: var(--radius-photo); background: none; color: var(--color-ink); font: inherit; font-size: 14px; font-weight: 500; white-space: nowrap; cursor: pointer; scroll-snap-align: start }
    /* Места хватает — переносим на следующую строку вместо прокрутки */
    @media (min-width: 640px) { .rcp-row { flex-wrap: wrap; overflow-x: visible } }
    @media (hover: hover) { .rcp:hover, .rcp-new:hover { border-color: var(--color-ink) } .rcp-x:hover { opacity: 1 } }
  `,
})
export class CheckoutComponent {
  private readonly api = inject(MarketApi);
  private readonly router = inject(Router);
  private readonly store = inject(BrowserStorage);
  private readonly auth = inject(AuthService);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  readonly cart = inject(CartService);
  /** Сколько полей в каждом блоке заглушки: «Кто получит» и «Куда и когда». */
  readonly skelSets = [[1, 2], [1, 2, 3, 4]];
  protected readonly i18n = inject(I18n);
  readonly shopForms: [string, string, string] = ['лавка', 'лавки', 'лавок'];
  readonly districts = DISTRICTS;
  /** «Доставка 15 смн, в Вахдат и Ҳисор — 25 смн» — цены из той же deliveryFor, что и итог. */
  readonly deliveryHint = this.i18n.t('Доставка {price}, в {places} — {suburbPrice}', {
    price: money.transform(deliveryFor(DISTRICTS[0])), places: SUBURBS.join(` ${this.i18n.t('и')} `), suburbPrice: money.transform(deliveryFor(SUBURBS[0])),
  });
  /** На сервере и в первом рендере — все слоты; по часам Душанбе фильтруем только после гидратации. */
  readonly slots = signal<string[]>(SLOTS);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    // Пользователь вводит 9 цифр после «+992»; автозаполнение с +992 тоже проходит, phone9 его срежет
    phone: ['', [Validators.required, Validators.pattern(PHONE_PATTERN)]],
    district: [DISTRICTS[0], Validators.required],
    address: ['', [Validators.required, Validators.minLength(3)]],
    comment: [''],
    slot: [SLOTS[0], Validators.required],
  });
  private readonly district = toSignal(this.form.controls.district.valueChanges, { initialValue: this.form.controls.district.value });
  readonly delivery = computed(() => this.cart.deliveryTotal(this.district()));
  readonly total = computed(() => this.cart.itemsTotal() + this.delivery());
  /** «Кому доставить»: свои получатели и, у вошедшего, из истории заказов. */
  readonly saved = inject(SavedAddresses);
  readonly rcpKey = recipientKey;
  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  private savedLoaded = false;
  private prefilledFromSaved = false;

  constructor() {
    const clock = inject(CLOCK);
    // Только в браузере: время сервера и момент рендера не равны времени покупателя
    afterNextRender(() => {
      const list = availableSlots(clock());
      this.slots.set(list);
      const slot = this.form.controls.slot;
      if (!list.includes(slot.value)) slot.setValue(list[0]);
    });
    // Префилл только после гидратации auth и только в поля, которых пользователь ещё не трогал.
    // Получатели из истории приходят позже — effect запустится снова и подставит самого свежего.
    effect(() => {
      if (!this.auth.ready()) return;
      untracked(() => {
        if (this.savedLoaded) return;
        this.savedLoaded = true;
        this.saved.load();
      });
      const first = this.saved.list()[0];
      untracked(() => {
        const { name, phone, district, address } = this.form.controls;
        // Получатель уже подставлен: убрали его или пришла история — введённое и выбранное не меняем
        if (this.prefilledFromSaved) return;
        if (first) {
          this.prefilledFromSaved = true;
          // Только целиком: история пришла, когда покупатель уже начал вводить, — не смешиваем его ввод с чужим
          // получателем (имя одного, адрес другого). Ряд уже на экране — выберет сам.
          const fields = [name, phone, district, address];
          if (fields.every((c) => c.pristine)) this.form.patchValue({ name: first.name, phone: first.phone, district: first.district, address: first.address });
          return;
        }
        // Сохранённых получателей нет: как раньше — профиль и адрес прошлого заказа в старом формате
        const last = readLastAddress(this.store.get<unknown>(LAST_ADDRESS, null));
        // Имя из профиля важнее имени из прошлого заказа
        const buyerName = this.auth.buyer()?.name || last.name;
        // Телефон вошедшего покупателя важнее последнего номера из прошлого заказа
        const buyerPhone = phone9(this.auth.buyer()?.phone ?? '');
        const lastPhone = this.store.get<unknown>('harid.lastPhone', '');
        const prefill = buyerPhone || (typeof lastPhone === 'string' ? lastPhone : '');
        if (name.pristine && buyerName) name.setValue(buyerName);
        if (phone.pristine && prefill) phone.setValue(prefill);
        if (district.pristine && last.district) district.setValue(last.district);
        if (address.pristine && last.address) address.setValue(last.address);
      });
    });
  }

  /** Нажали на получателя: четыре поля из него; dirty — дальше префилл их не трогает. */
  pick(r: Recipient): void {
    const { name, phone, district, address } = this.form.controls;
    this.form.patchValue({ name: r.name, phone: r.phone, district: r.district, address: r.address });
    for (const c of [name, phone, district, address]) c.markAsDirty();
  }

  /** «Новый получатель»: форма как пустая — имя, телефон и адрес пустые, район по умолчанию (не район прошлого получателя). */
  newRecipient(): void {
    const { name, phone, district, address } = this.form.controls;
    this.form.patchValue({ name: '', phone: '', district: DISTRICTS[0], address: '' });
    for (const c of [name, phone, district, address]) c.markAsDirty();
    this.host.nativeElement.querySelector<HTMLInputElement>('#co-name')?.focus();
  }

  /** Получатели с тем же именем и адресом, но другим номером (сменила номер, опечатка): на кнопке нужен номер, иначе не отличить. */
  private readonly twins = computed(() => {
    const seen = new Map<string, number>();
    const look = (r: Recipient) => recipientKey({ ...r, phone: '' }) + '|' + r.name;
    for (const r of this.saved.list()) seen.set(look(r), (seen.get(look(r)) ?? 0) + 1);
    return new Set(this.saved.list().filter((r) => seen.get(look(r))! > 1).map(recipientKey));
  });

  /** «… 00 02» — конец номера на кнопке у получателей-двойников. */
  phoneTail(r: Recipient): string | null {
    return this.twins().has(recipientKey(r)) ? `… ${r.phone.slice(5, 7)} ${r.phone.slice(7)}` : null;
  }

  /** Получатель выделен, пока поля совпадают с ним: поменяли номер — выделение снимается. */
  isPicked(r: Recipient): boolean {
    const v = this.formValue();
    const name = (v.name ?? '').trim();
    const current = { name, phone: phone9(v.phone ?? ''), district: v.district ?? '', address: (v.address ?? '').trim() };
    return name === r.name && recipientKey(current) === recipientKey(r);
  }

  /** Подпись слота в списке; в форме и заказе остаётся русское значение. */
  slotText(slot: string): string { return slotLabel(slot, this.i18n); }

  /** Ошибку поля показываем после касания или попытки отправки, не с первого взгляда. */
  bad(field: Field): boolean {
    const c = this.form.controls[field];
    return c.invalid && c.touched;
  }

  submit(): void {
    if (this.busy()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }
    const v = this.form.getRawValue();
    const phone = phone9(v.phone);
    this.busy.set(true); this.error.set('');
    this.api.placeOrder({
      customer: { name: v.name.trim(), phone, district: v.district, address: v.address.trim(), ...(v.comment.trim() ? { comment: v.comment.trim() } : {}) },
      slot: v.slot, payment: 'cash', lines: this.cart.toOrderLines(),
    }).subscribe({
      next: (o) => {
        this.cart.clear();
        this.saved.remember({ name: v.name.trim(), phone, district: v.district, address: v.address.trim() });
        this.busy.set(false);
        // fresh=1 — страница заказа покажет благодарность и следующие шаги; переживает перезагрузку.
        // Телефона в адресе нет: заказ открывается токеном. Старый бэкенд токен не отдаёт — тогда по телефону.
        const queryParams = o.access_token ? { t: o.access_token, fresh: 1 } : { phone, fresh: 1 };
        this.router.navigate(['/order', o.number], { queryParams });
      },
      error: (e) => {
        this.busy.set(false);
        // 409 «Цена изменилась»: корзина получает цены сервера, покупатель видит новую сумму и жмёт ещё раз.
        const changed = priceChanges(e);
        if (changed) this.cart.applyPrices(changed);
        this.error.set(apiErrorMessage(e, this.i18n));
      },
    });
  }

  /** Фокус и прокрутка к первому неверному полю — по порядку на странице. */
  private focusFirstInvalid(): void {
    const first = FIELD_ORDER.find((f) => this.form.controls[f].invalid);
    const el = first && this.host.nativeElement.querySelector<HTMLElement>(`[formControlName="${first}"]`);
    if (!el) return;
    el.focus({ preventScroll: true });
    // По центру экрана: у края его закрыла бы липкая шапка. В jsdom scrollIntoView нет
    el.scrollIntoView?.({ block: 'center' });
  }
}
