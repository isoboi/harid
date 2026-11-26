import { afterNextRender, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage, priceChanges } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { BrowserStorage } from '../../core/browser-storage.service';
import { CartService } from '../../core/cart.service';
import { availableSlots, deliveryFor, DISTRICTS, SLOTS, SUBURBS } from '../../core/checkout-options';
import { CLOCK } from '../../core/clock';
import { MarketApi } from '../../core/market-api.service';
import { PHONE_PATTERN, phone9 } from '../../core/phone';
import { IconComponent } from '../../shared/icon.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { plural } from '../../shared/plural';
import { SkelSummaryComponent } from '../../shared/skeleton.component';

type Field = 'name' | 'phone' | 'district' | 'address' | 'slot' | 'comment';
/** Порядок полей на странице: фокус после неудачной отправки идёт на первое неверное. */
const FIELD_ORDER: Field[] = ['name', 'phone', 'district', 'address', 'slot', 'comment'];
const money = new MoneyPipe();

/** Кто и куда получал прошлый заказ — для префилла следующего. Комментарий не храним: он про один заказ. */
export interface LastAddress { name: string; district: string; address: string }
const LAST_ADDRESS = 'harid.lastAddress';

/** Сохранённый адрес, если он цел; район вне текущего списка (список поменяли) — без района. */
export function readLastAddress(v: unknown): Partial<LastAddress> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const o = v as Record<string, unknown>;
  const str = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : undefined);
  const out: Partial<LastAddress> = {};
  const name = str(o['name']); if (name) out.name = name;
  const address = str(o['address']); if (address) out.address = address;
  const district = str(o['district']); if (district && DISTRICTS.includes(district)) out.district = district;
  return out;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-checkout',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MoneyPipe, IconComponent, SkelSummaryComponent],
  template: `
    <div class="wrap page-top">
      <h1 class="page-title head">Оформление заказа</h1>
      @if (!cart.ready()) {
        <!-- Заглушка до чтения корзины: два блока полей формы и сводка справа -->
        <div class="layout" role="status" data-test="skel-checkout">
          <span class="sr-only">Загрузка…</span>
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
      @else if (!cart.count()) { <p class="empty">Корзина пуста. <a routerLink="/">К товарам</a></p> }
      @else {
        <!-- novalidate: ошибки показываем свои, по-русски и под полем, а не всплывашкой браузера -->
        <form [formGroup]="form" (ngSubmit)="submit()" class="layout" novalidate>
          <div class="sets">
            <fieldset>
              <legend>Кто получит</legend>
              <div class="grid two">
                <div class="field">
                  <label for="co-name">Имя</label>
                  <input id="co-name" class="field-control" formControlName="name" autocomplete="name" maxlength="100"
                    [attr.aria-invalid]="bad('name') || null" [attr.aria-describedby]="bad('name') ? 'co-name-err' : null" />
                  @if (bad('name')) { <p class="field-error" id="co-name-err">Укажите имя</p> }
                </div>
                <div class="field">
                  <label for="co-phone">Телефон</label>
                  <div class="tel">
                    <span class="tel-prefix" id="co-phone-prefix">+992</span>
                    <input id="co-phone" class="field-control" formControlName="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="93 123 45 67"
                      [attr.aria-invalid]="bad('phone') || null" [attr.aria-describedby]="bad('phone') ? 'co-phone-prefix co-phone-err' : 'co-phone-prefix co-phone-hint'" />
                  </div>
                  @if (bad('phone')) { <p class="field-error" id="co-phone-err">Нужен номер из 9 цифр</p> }
                  @else { <p class="field-hint" id="co-phone-hint">Лавка и курьер позвонят на этот номер</p> }
                </div>
              </div>
            </fieldset>
            <fieldset>
              <legend>Куда и когда</legend>
              <div class="grid where">
                <div class="field">
                  <label for="co-district">Район</label>
                  <select id="co-district" class="field-control" formControlName="district" aria-describedby="co-district-hint">
                    @for (d of districts; track d) { <option [value]="d">{{ d }}</option> }
                  </select>
                  <p class="field-hint" id="co-district-hint">{{ deliveryHint }}</p>
                </div>
                <div class="field">
                  <label for="co-address">Улица, дом, квартира</label>
                  <input id="co-address" class="field-control" formControlName="address" autocomplete="street-address" maxlength="255"
                    [attr.aria-invalid]="bad('address') || null" [attr.aria-describedby]="bad('address') ? 'co-address-err' : null" />
                  @if (bad('address')) { <p class="field-error" id="co-address-err">Укажите адрес</p> }
                </div>
              </div>
              <div class="grid two">
                <div class="field">
                  <label for="co-slot">Когда привезти</label>
                  <select id="co-slot" class="field-control" formControlName="slot">
                    @for (s of slots(); track s) { <option [value]="s">{{ s }}</option> }
                  </select>
                </div>
              </div>
              <div class="field">
                <label for="co-comment">Комментарий курьеру <span class="opt">— необязательно</span></label>
                <textarea id="co-comment" class="field-control" formControlName="comment" rows="2" maxlength="500"></textarea>
              </div>
            </fieldset>
          </div>
          <aside class="summary side">
            <dl>
              <div><dt>Товары, {{ cart.count() }} шт.</dt><dd>{{ cart.itemsTotal() | money }}</dd></div>
              <div><dt>Доставка{{ cart.groups().length > 1 ? ' (' + cart.groups().length + ' ' + plural(cart.groups().length, shopForms) + ')' : '' }}</dt><dd>{{ delivery() | money }}</dd></div>
              <div class="total"><dt>Итого наличными курьеру</dt><dd>{{ total() | money }}</dd></div>
            </dl>
            <p class="cash promise" data-test="cash-promise"><app-icon name="banknote" [size]="20" /><span>Оплата наличными курьеру · без предоплаты · проверяете товар при курьере</span></p>
            @if (error()) { <p class="field-error err" role="alert">{{ error() }}</p> }
            <!-- Кнопка доступна всегда: неверная форма объясняет себя ошибками под полями, а не молчит -->
            <button class="btn submit" type="submit" [disabled]="busy()">@if (busy()) { Отправляем… } @else { Заказать — {{ total() | money }} наличными курьеру }</button>
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
    .sets { display: flex; flex-direction: column; gap: 40px }
    fieldset { display: flex; flex-direction: column; gap: 16px; margin: 0; padding: 0; border: 0 }
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
  readonly plural = plural;
  readonly shopForms: [string, string, string] = ['лавка', 'лавки', 'лавок'];
  readonly districts = DISTRICTS;
  /** «Доставка 15 смн, в Вахдат и Ҳисор — 25 смн» — цены из той же deliveryFor, что и итог. */
  readonly deliveryHint = `Доставка ${money.transform(deliveryFor(DISTRICTS[0]))}, в ${SUBURBS.join(' и ')} — ${money.transform(deliveryFor(SUBURBS[0]))}`;
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
    effect(() => {
      if (!this.auth.ready()) return;
      untracked(() => {
        const { name, phone, district, address } = this.form.controls;
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
        this.store.set('harid.lastPhone', phone);
        this.store.set(LAST_ADDRESS, { name: v.name.trim(), district: v.district, address: v.address.trim() } satisfies LastAddress);
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
        this.error.set(apiErrorMessage(e));
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
