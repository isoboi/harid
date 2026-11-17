import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { CheckoutComponent } from './checkout.component';
import { MarketApi } from '../../core/market-api.service';
import { CartService } from '../../core/cart.service';
import { AuthService } from '../../core/auth.service';

const product = { id: '16', shop_handle: 'technomir.tj', title: 'Наушники', price: 320, old_price: null, image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '' };

async function setup(placeOrder: jest.Mock) {
  localStorage.clear();
  await TestBed.configureTestingModule({ imports: [CheckoutComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { placeOrder } }] }).compileComponents();
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
    const placeOrder = jest.fn(() => of({ number: 'R-221526' }));
    const { c } = await setup(placeOrder);
    const nav = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.submit();
    expect(placeOrder).toHaveBeenCalledWith({
      customer: { name: 'Фаррух', phone: '931110002', district: 'Сино', address: 'ул. Рудаки 10' },
      slot: 'Сегодня, 18:00–21:00', payment: 'cash', lines: [{ product_id: 16, qty: 2 }],
    });
    expect(TestBed.inject(CartService).count()).toBe(0);
    expect(nav).toHaveBeenCalledWith(['/order', 'R-221526'], { queryParams: { phone: '931110002' } });
  });
  it('ошибка бэкенда показывается как есть, корзина не очищается', async () => {
    const err = new HttpErrorResponse({ status: 400, error: { error: { message: 'Товар уже снят с продажи — обновите корзину', errors: [] } } });
    const { f, c } = await setup(jest.fn(() => throwError(() => err)));
    c.submit(); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Товар уже снят с продажи — обновите корзину');
    expect(TestBed.inject(CartService).count()).toBe(2);
  });
  it('до гидратации корзины не показывает «Корзина пуста»', async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [CheckoutComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { placeOrder: jest.fn() } }] }).compileComponents();
    const f = TestBed.createComponent(CheckoutComponent);
    f.detectChanges();
    const t: string = f.nativeElement.textContent;
    expect(t).not.toContain('Корзина пуста');
    expect(t).toContain('Загрузка');
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
    f.detectChanges();
    expect(c.form.getRawValue()).toMatchObject({ name: 'Иван', phone: '931110002' });
  });
});
