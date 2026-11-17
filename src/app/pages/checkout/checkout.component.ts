import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { BrowserStorage } from '../../core/browser-storage.service';
import { CartService } from '../../core/cart.service';
import { DISTRICTS, SLOTS } from '../../core/checkout-options';
import { MarketApi } from '../../core/market-api.service';
import { PHONE_PATTERN, phone9 } from '../../core/phone';
import { MoneyPipe } from '../../shared/money.pipe';
import { plural } from '../../shared/plural';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MoneyPipe],
  template: `
    <h1>Оформление заказа</h1>
    @if (!cart.ready()) { <p class="muted">Загрузка…</p> }
    @else if (!cart.count()) { <p class="muted">Корзина пуста. <a routerLink="/">К товарам</a></p> }
    @else {
      <form [formGroup]="form" (ngSubmit)="submit()" class="form">
        <label>Имя<input formControlName="name" autocomplete="name" maxlength="100" /></label>
        <label>Телефон<input formControlName="phone" inputmode="tel" placeholder="93 123 45 67" /></label>
        <label>Район<select formControlName="district">@for (d of districts; track d) { <option [value]="d">{{ d }}</option> }</select></label>
        <label>Адрес<input formControlName="address" placeholder="Улица, дом, квартира" maxlength="255" /></label>
        <label>Когда привезти<select formControlName="slot">@for (s of slots; track s) { <option [value]="s">{{ s }}</option> }</select></label>
        <label>Комментарий<textarea formControlName="comment" rows="2" maxlength="500"></textarea></label>
        <div class="sum">
          <div><span>Товары</span><b>{{ cart.itemsTotal() | money }}</b></div>
          <div><span>Доставка{{ cart.groups().length > 1 ? ' (' + cart.groups().length + ' ' + plural(cart.groups().length, shopForms) + ')' : '' }}</span><b>{{ delivery() | money }}</b></div>
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
  private readonly auth = inject(AuthService);
  readonly cart = inject(CartService);
  readonly plural = plural;
  readonly shopForms: [string, string, string] = ['лавка', 'лавки', 'лавок'];
  readonly districts = DISTRICTS;
  readonly slots = SLOTS;
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
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
