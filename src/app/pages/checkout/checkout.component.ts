import { afterNextRender, Component, computed, effect, ElementRef, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
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

type Field = 'name' | 'phone' | 'district' | 'address' | 'slot' | 'comment';
/** Порядок полей на странице: фокус после неудачной отправки идёт на первое неверное. */
const FIELD_ORDER: Field[] = ['name', 'phone', 'district', 'address', 'slot', 'comment'];
const money = new MoneyPipe();

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MoneyPipe, IconComponent],
  template: `
    <h1>Оформление заказа</h1>
    @if (!cart.ready()) { <p class="muted">Загрузка…</p> }
    @else if (!cart.count()) { <p class="muted">Корзина пуста. <a routerLink="/">К товарам</a></p> }
    @else {
      <!-- novalidate: ошибки показываем свои, по-русски и под полем, а не всплывашкой браузера -->
      <form [formGroup]="form" (ngSubmit)="submit()" class="form" novalidate>
        <fieldset>
          <legend>Кто получит</legend>
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
                [attr.aria-invalid]="bad('phone') || null" [attr.aria-describedby]="bad('phone') ? 'co-phone-prefix co-phone-err' : 'co-phone-prefix'" />
            </div>
            @if (bad('phone')) { <p class="field-error" id="co-phone-err">Нужен номер из 9 цифр</p> }
          </div>
        </fieldset>
        <fieldset>
          <legend>Куда и когда</legend>
          <div class="field">
            <label for="co-district">Район</label>
            <select id="co-district" class="field-control" formControlName="district" aria-describedby="co-district-hint">
              @for (d of districts; track d) { <option [value]="d">{{ d }}</option> }
            </select>
            <p class="field-hint" id="co-district-hint">{{ deliveryHint }}</p>
          </div>
          <div class="field">
            <label for="co-address">Адрес</label>
            <input id="co-address" class="field-control" formControlName="address" autocomplete="street-address" placeholder="Улица, дом, квартира" maxlength="255"
              [attr.aria-invalid]="bad('address') || null" [attr.aria-describedby]="bad('address') ? 'co-address-err' : null" />
            @if (bad('address')) { <p class="field-error" id="co-address-err">Укажите адрес</p> }
          </div>
          <div class="field">
            <label for="co-slot">Когда привезти</label>
            <select id="co-slot" class="field-control" formControlName="slot">
              @for (s of slots(); track s) { <option [value]="s">{{ s }}</option> }
            </select>
          </div>
          <div class="field">
            <label for="co-comment">Комментарий <span class="muted">— необязательно</span></label>
            <textarea id="co-comment" class="field-control" formControlName="comment" rows="2" maxlength="500"></textarea>
          </div>
        </fieldset>
        <div class="sum">
          <div><span>Товары</span><b>{{ cart.itemsTotal() | money }}</b></div>
          <div><span>Доставка{{ cart.groups().length > 1 ? ' (' + cart.groups().length + ' ' + plural(cart.groups().length, shopForms) + ')' : '' }}</span><b>{{ delivery() | money }}</b></div>
          <div class="total"><span>Итого наличными курьеру</span><b>{{ total() | money }}</b></div>
        </div>
        <div class="cash" data-test="cash-promise"><app-icon name="banknote" [size]="20" /><span>Оплата наличными курьеру · без предоплаты · проверяете товар при курьере</span></div>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <!-- Кнопка доступна всегда: неверная форма объясняет себя ошибками под полями, а не молчит -->
        <button class="btn" type="submit" [disabled]="busy()">@if (busy()) { Отправляем… } @else { Заказать — {{ total() | money }} наличными курьеру }</button>
      </form>
    }
  `,
  styles: `
    .form { display:flex; flex-direction:column; gap:24px; max-width:520px }
    fieldset { display:flex; flex-direction:column; gap:14px; min-width:0; margin:0; padding:0; border:0 }
    legend { padding:0; margin-bottom:14px; font-size:17px; font-weight:600 }
    textarea.field-control { resize:vertical }
    .sum { border-top:1px solid var(--line); padding-top:12px } .sum div { display:flex; justify-content:space-between; margin:4px 0 } .total { font-size:18px }
    /* Обещание оплаты над кнопкой, а не мелкой сноской под ней */
    .cash { display:flex; gap:10px; align-items:flex-start; padding:12px 14px; border-radius:12px; background:var(--surface); font-size:14px; line-height:1.4 } .cash app-icon { color:var(--accent-strong); margin-top:-1px }
    .btn { min-height:48px; text-wrap:balance }
  `,
})
export class CheckoutComponent {
  private readonly api = inject(MarketApi);
  private readonly router = inject(Router);
  private readonly store = inject(BrowserStorage);
  private readonly auth = inject(AuthService);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  readonly cart = inject(CartService);
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
        const { name, phone } = this.form.controls;
        const buyerName = this.auth.buyer()?.name;
        // Телефон вошедшего покупателя важнее последнего номера из прошлого заказа
        const buyerPhone = phone9(this.auth.buyer()?.phone ?? '');
        const lastPhone = this.store.get<unknown>('harid.lastPhone', '');
        const prefill = buyerPhone || (typeof lastPhone === 'string' ? lastPhone : '');
        if (name.pristine && buyerName) name.setValue(buyerName);
        if (phone.pristine && prefill) phone.setValue(prefill);
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
        this.busy.set(false);
        // fresh=1 — страница заказа покажет благодарность и следующие шаги; переживает перезагрузку.
        // Телефона в адресе нет: заказ открывается токеном. Старый бэкенд токен не отдаёт — тогда по телефону.
        const queryParams = o.access_token ? { t: o.access_token, fresh: 1 } : { phone, fresh: 1 };
        this.router.navigate(['/order', o.number], { queryParams });
      },
      error: (e) => { this.busy.set(false); this.error.set(apiErrorMessage(e)); },
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
