import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { CheckoutComponent, readLastAddress } from './checkout.component';
import { MarketApi } from '../../core/market-api.service';
import { CartService } from '../../core/cart.service';
import { AuthService } from '../../core/auth.service';
import { CLOCK } from '../../core/clock';

// 04:00Z = 09:00 в Душанбе: все слоты доступны; 13:00Z = 18:00 — вечерний на сегодня уже скрыт
const MORNING = new Date('2026-11-17T04:00:00Z');
const EVENING = new Date('2026-11-17T13:00:00Z');

const product = { id: '16', shop_handle: 'technomir.tj', title: 'Наушники', price: 320, old_price: null, image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '' };

async function setup(placeOrder: jest.Mock, now = MORNING) {
  localStorage.clear();
  await TestBed.configureTestingModule({ imports: [CheckoutComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { placeOrder } }, { provide: CLOCK, useValue: () => now }] }).compileComponents();
  TestBed.inject(CartService).hydrate();
  TestBed.inject(AuthService).hydrate();
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
    const placeOrder = jest.fn(() => of({ number: 'R-221526', access_token: 'tok-1' }));
    const { c } = await setup(placeOrder);
    const nav = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.submit();
    expect(placeOrder).toHaveBeenCalledWith({
      customer: { name: 'Фаррух', phone: '931110002', district: 'Сино', address: 'ул. Рудаки 10' },
      slot: 'Сегодня, 18:00–21:00', payment: 'cash', lines: [{ product_id: 16, qty: 2, price: 320 }],
    });
    expect(TestBed.inject(CartService).count()).toBe(0);
    // В адресе токен заказа, а не телефон
    expect(nav).toHaveBeenCalledWith(['/order', 'R-221526'], { queryParams: { t: 'tok-1', fresh: 1 } });
  });
  it('старый бэкенд без access_token — переход с телефоном, как раньше', async () => {
    const { c } = await setup(jest.fn(() => of({ number: 'R-221526' })));
    const nav = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.submit();
    expect(nav).toHaveBeenCalledWith(['/order', 'R-221526'], { queryParams: { phone: '931110002', fresh: 1 } });
  });
  it('телефон: type=tel, autocomplete=tel и неизменяемый префикс +992 в поле', async () => {
    const { f } = await setup(jest.fn());
    const el: HTMLElement = f.nativeElement;
    const input = el.querySelector('input[formControlName="phone"]')!;
    expect(input.getAttribute('type')).toBe('tel');
    expect(input.getAttribute('inputmode')).toBe('tel');
    expect(input.getAttribute('autocomplete')).toBe('tel');
    const prefix = input.parentElement!.querySelector('.tel-prefix');
    expect(prefix?.textContent?.trim()).toBe('+992');
    expect(prefix?.tagName).not.toBe('INPUT');
  });
  it('autocomplete имени и адреса', async () => {
    const { f } = await setup(jest.fn());
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('input[formControlName="name"]')?.getAttribute('autocomplete')).toBe('name');
    expect(el.querySelector('input[formControlName="address"]')?.getAttribute('autocomplete')).toBe('street-address');
  });
  it('поля в двух группах: «Кто получит» и «Куда и когда»', async () => {
    const { f } = await setup(jest.fn());
    const sets = Array.from((f.nativeElement as HTMLElement).querySelectorAll('fieldset'));
    expect(sets.map((s) => s.querySelector('legend')?.textContent?.trim())).toEqual(['Кто получит', 'Куда и когда']);
    const names = (s: Element) => Array.from(s.querySelectorAll('[formControlName]')).map((n) => n.getAttribute('formControlName'));
    expect(names(sets[0])).toEqual(['name', 'phone']);
    expect(names(sets[1])).toEqual(['district', 'address', 'slot', 'comment']);
  });
  it('у района объяснена цена доставки', async () => {
    const { f } = await setup(jest.fn());
    const select = (f.nativeElement as HTMLElement).querySelector('select[formControlName="district"]')!;
    const hint = (f.nativeElement as HTMLElement).querySelector('#' + select.getAttribute('aria-describedby'));
    expect(hint?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Доставка 15 смн, в Вахдат и Ҳисор — 25 смн');
  });
  it('кнопка доступна и при пустой форме; отправка показывает ошибки и ставит фокус на первое неверное поле', async () => {
    const placeOrder = jest.fn();
    const { f, c } = await setup(placeOrder);
    c.form.patchValue({ name: '', phone: '93 11', address: '' });
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    document.body.appendChild(el);
    const btn: HTMLButtonElement = el.querySelector('button[type="submit"]')!;
    expect(btn.disabled).toBe(false);
    btn.click();
    f.detectChanges();
    expect(placeOrder).not.toHaveBeenCalled();
    const t = el.textContent!;
    expect(t).toContain('Укажите имя');
    expect(t).toContain('Нужен номер из 9 цифр');
    expect(t).toContain('Укажите адрес');
    expect(document.activeElement).toBe(el.querySelector('input[formControlName="name"]'));
    expect(el.querySelector('input[formControlName="phone"]')?.getAttribute('aria-invalid')).toBe('true');
    el.remove();
  });
  it('фокус уходит на первое неверное поле, даже если оно не первое', async () => {
    const { f, c } = await setup(jest.fn());
    c.form.patchValue({ phone: '123' });
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    document.body.appendChild(el);
    c.submit();
    f.detectChanges();
    expect(document.activeElement).toBe(el.querySelector('input[formControlName="phone"]'));
    el.remove();
  });
  it('до отправки ошибки не показываются', async () => {
    const { f, c } = await setup(jest.fn());
    c.form.patchValue({ name: '' });
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).not.toContain('Укажите имя');
  });
  it('утром по Душанбе — все слоты, по умолчанию «Сегодня»', async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [CheckoutComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { placeOrder: jest.fn() } }, { provide: CLOCK, useValue: () => MORNING }] }).compileComponents();
    TestBed.inject(CartService).hydrate();
    TestBed.inject(CartService).add(product, null, 1);
    const f = TestBed.createComponent(CheckoutComponent);
    f.detectChanges();
    f.detectChanges();
    expect(f.componentInstance.slots()).toContain('Сегодня, 18:00–21:00');
    expect(f.componentInstance.form.getRawValue().slot).toBe('Сегодня, 18:00–21:00');
  });
  it('вечером по Душанбе «Сегодня» скрыт, и форма не держит скрытый слот', async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [CheckoutComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { placeOrder: jest.fn() } }, { provide: CLOCK, useValue: () => EVENING }] }).compileComponents();
    TestBed.inject(CartService).hydrate();
    TestBed.inject(CartService).add(product, null, 1);
    const f = TestBed.createComponent(CheckoutComponent);
    f.detectChanges();
    f.detectChanges();
    const opts = Array.from((f.nativeElement as HTMLElement).querySelectorAll('select[formControlName="slot"] option')).map((o) => o.textContent?.trim());
    expect(opts).not.toContain('Сегодня, 18:00–21:00');
    expect(f.componentInstance.form.getRawValue().slot).toBe('Завтра, 10:00–14:00');
  });
  it('кнопка называет сумму и способ оплаты', async () => {
    const { f } = await setup(jest.fn());
    f.detectChanges();
    const btn: HTMLButtonElement = f.nativeElement.querySelector('button[type="submit"]');
    expect(btn.textContent?.replace(/\s+/g, ' ').trim()).toBe('Заказать — 655 смн наличными курьеру');
  });
  it('обещание оплаты стоит над кнопкой', async () => {
    const { f } = await setup(jest.fn());
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    const promise = el.querySelector('[data-test="cash-promise"]');
    const btn = el.querySelector('button[type="submit"]');
    expect(promise?.textContent).toContain('без предоплаты');
    expect(promise && btn && promise.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('ошибка бэкенда показывается как есть, корзина не очищается', async () => {
    const err = new HttpErrorResponse({ status: 400, error: { error: { message: 'Товар уже снят с продажи — обновите корзину', errors: [] } } });
    const { f, c } = await setup(jest.fn(() => throwError(() => err)));
    c.submit(); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Товар уже снят с продажи — обновите корзину');
    expect(TestBed.inject(CartService).count()).toBe(2);
  });
  it('409 «Цена изменилась» — цены в корзине обновлены, сообщение вместо общей ошибки, без перехода', async () => {
    const err = new HttpErrorResponse({
      status: 409,
      error: {
        success: false, statusCode: 409,
        error: { message: 'Цена изменилась — проверьте корзину', errors: [], changed: [{ product_id: 16, price: 350, old_price: null, promo_ends_at: null }] },
      },
    });
    const { f, c } = await setup(jest.fn(() => throwError(() => err)));
    const nav = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.submit(); f.detectChanges();
    const cart = TestBed.inject(CartService);
    expect(cart.items()[0].product.price).toBe(350);
    expect(cart.count()).toBe(2);
    expect(c.error()).toBe('Цена изменилась — проверьте корзину');
    expect(c.busy()).toBe(false);
    // Новая сумма на кнопке: 2 × 350 + доставка 15.
    expect(c.total()).toBe(715);
    expect(JSON.parse(localStorage.getItem('harid.cart') ?? '[]')[0].product.price).toBe(350);
    expect(nav).not.toHaveBeenCalled();
  });
  it('409 без changed — обычная ошибка, корзина не меняется', async () => {
    const err = new HttpErrorResponse({ status: 409, error: { error: { message: 'Конфликт', errors: [] } } });
    const { c } = await setup(jest.fn(() => throwError(() => err)));
    c.submit();
    expect(c.error()).toBe('Конфликт');
    expect(TestBed.inject(CartService).items()[0].product.price).toBe(320);
  });
  it('до гидратации корзины не показывает «Корзина пуста»', async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [CheckoutComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { placeOrder: jest.fn() } }] }).compileComponents();
    const f = TestBed.createComponent(CheckoutComponent);
    f.detectChanges();
    const t: string = f.nativeElement.textContent;
    expect(t).not.toContain('Корзина пуста');
    expect(t).toContain('Загрузка');
    expect(f.nativeElement.querySelector('[data-test="skel-checkout"]')).not.toBeNull();
  });
  it('префилл имени и телефона после готовности auth, введённое пользователем не перетирается', async () => {
    localStorage.clear();
    localStorage.setItem('harid.buyer', JSON.stringify({ id: 1, phone: '927000000', name: 'Фаррух' }));
    localStorage.setItem('harid.lastPhone', JSON.stringify('931110002'));
    await TestBed.configureTestingModule({ imports: [CheckoutComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { placeOrder: jest.fn() } }] }).compileComponents();
    TestBed.inject(CartService).hydrate();
    TestBed.inject(AuthService).hydrate();
    TestBed.inject(CartService).add(product, null, 1);
    const f = TestBed.createComponent(CheckoutComponent);
    const c = f.componentInstance;
    c.form.controls.name.markAsDirty();
    c.form.controls.name.setValue('Иван');
    c.form.controls.phone.markAsDirty();
    c.form.controls.phone.setValue('935550000');
    f.detectChanges();
    expect(c.form.getRawValue()).toMatchObject({ name: 'Иван', phone: '935550000' });
  });
  it('телефон вошедшего покупателя важнее последнего номера, но не трогает введённый вручную', async () => {
    localStorage.clear();
    localStorage.setItem('harid.buyer', JSON.stringify({ id: 1, phone: '+992927000000', name: 'Фаррух' }));
    localStorage.setItem('harid.lastPhone', JSON.stringify('931110002'));
    await TestBed.configureTestingModule({ imports: [CheckoutComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { placeOrder: jest.fn() } }] }).compileComponents();
    TestBed.inject(CartService).hydrate();
    TestBed.inject(AuthService).hydrate();
    TestBed.inject(CartService).add(product, null, 1);
    const f = TestBed.createComponent(CheckoutComponent);
    f.detectChanges();
    expect(f.componentInstance.form.getRawValue().phone).toBe('927000000');
  });
  it('поля ограничены лимитами бэкенда', async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [CheckoutComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { placeOrder: jest.fn() } }] }).compileComponents();
    TestBed.inject(CartService).hydrate();
    TestBed.inject(AuthService).hydrate();
    TestBed.inject(CartService).add(product, null, 1);
    const f = TestBed.createComponent(CheckoutComponent);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('input[formControlName="name"]')?.getAttribute('maxlength')).toBe('100');
    expect(el.querySelector('input[formControlName="address"]')?.getAttribute('maxlength')).toBe('255');
    expect(el.querySelector('textarea[formControlName="comment"]')?.getAttribute('maxlength')).toBe('500');
  });
  it('без покупателя телефон берётся из последнего заказа', async () => {
    localStorage.clear();
    localStorage.setItem('harid.lastPhone', JSON.stringify('931110002'));
    await TestBed.configureTestingModule({ imports: [CheckoutComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { placeOrder: jest.fn() } }] }).compileComponents();
    TestBed.inject(CartService).hydrate();
    TestBed.inject(AuthService).hydrate();
    TestBed.inject(CartService).add(product, null, 1);
    const f = TestBed.createComponent(CheckoutComponent);
    f.detectChanges();
    expect(f.componentInstance.form.getRawValue().phone).toBe('931110002');
  });
  it('после заказа запоминает имя, район и адрес (без комментария)', async () => {
    const { c } = await setup(jest.fn(() => of({ number: 'R-1', access_token: 't' })));
    jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.form.controls.district.setValue('Вахдат');
    c.form.controls.address.setValue('  ул. Рудаки 10  ');
    c.form.controls.comment.setValue('домофон 12');
    c.submit();
    expect(JSON.parse(localStorage.getItem('harid.lastAddress')!)).toEqual({ name: 'Фаррух', district: 'Вахдат', address: 'ул. Рудаки 10' });
  });
  it('ошибка заказа — адрес не запоминается', async () => {
    const { c } = await setup(jest.fn(() => throwError(() => new HttpErrorResponse({ status: 500 }))));
    c.submit();
    expect(localStorage.getItem('harid.lastAddress')).toBeNull();
  });
  async function prefilled(last: unknown, buyer?: unknown, touch?: (c: CheckoutComponent) => void) {
    localStorage.clear();
    localStorage.setItem('harid.lastAddress', JSON.stringify(last));
    if (buyer) localStorage.setItem('harid.buyer', JSON.stringify(buyer));
    await TestBed.configureTestingModule({ imports: [CheckoutComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { placeOrder: jest.fn() } }] }).compileComponents();
    TestBed.inject(CartService).hydrate();
    TestBed.inject(AuthService).hydrate();
    TestBed.inject(CartService).add(product, null, 1);
    const f = TestBed.createComponent(CheckoutComponent);
    touch?.(f.componentInstance);
    f.detectChanges();
    return f.componentInstance;
  }
  it('префилл имени, района и адреса из прошлого заказа; доставка пересчитана по району', async () => {
    const c = await prefilled({ name: 'Фаррух', district: 'Вахдат', address: 'ул. Рудаки 10' });
    expect(c.form.getRawValue()).toMatchObject({ name: 'Фаррух', district: 'Вахдат', address: 'ул. Рудаки 10' });
    expect(c.delivery()).toBe(25);
  });
  it('имя из профиля важнее имени из прошлого заказа', async () => {
    const c = await prefilled({ name: 'Старое', district: 'Сино', address: 'ул' }, { id: 1, phone: '+992927000000', name: 'Мадина' });
    expect(c.form.getRawValue().name).toBe('Мадина');
  });
  it('введённое вручную не перетирается сохранённым адресом', async () => {
    const c = await prefilled({ name: 'Фаррух', district: 'Вахдат', address: 'ул. Рудаки 10' }, undefined, (c) => {
      c.form.controls.address.markAsDirty();
      c.form.controls.address.setValue('пр. Сомони 5');
    });
    expect(c.form.getRawValue().address).toBe('пр. Сомони 5');
  });
  it('readLastAddress: мусор и неизвестный район отбрасываются', () => {
    expect(readLastAddress(null)).toEqual({});
    expect(readLastAddress(['x'])).toEqual({});
    expect(readLastAddress({ name: 5, district: 'Марс', address: '  ' })).toEqual({});
    expect(readLastAddress({ name: ' Фаррух ', district: 'Сино', address: 'ул' })).toEqual({ name: 'Фаррух', district: 'Сино', address: 'ул' });
  });
});
