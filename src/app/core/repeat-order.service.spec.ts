import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';
import { CartService } from './cart.service';
import { MarketApi } from './market-api.service';
import { Order, OrderLine, OrderStage, Product } from './models';
import { RepeatOrderService, RepeatResult, repeatMessage } from './repeat-order.service';
import { ToastService } from './toast.service';

const r = (over: Partial<RepeatResult>): RepeatResult => ({ added: 0, total: 0, unavailable: [], overflow: 0, offline: false, ...over });

describe('repeatMessage', () => {
  it('всё добавлено', () => {
    expect(repeatMessage(r({ added: 3, total: 3 }))).toEqual({ text: 'Добавили в корзину 3 товара', kind: 'info' });
    expect(repeatMessage(r({ added: 1, total: 1 })).text).toBe('Добавили в корзину 1 товар');
  });
  it('часть: два названия', () => {
    expect(repeatMessage(r({ added: 1, total: 3, unavailable: ['Платье', 'Куртка'] }))).toEqual({ text: 'Добавили 1 из 3. Нет в наличии: «Платье», «Куртка»', kind: 'info' });
  });
  it('часть: больше двух названий', () => {
    expect(repeatMessage(r({ added: 1, total: 5, unavailable: ['A', 'B', 'C', 'D'] })).text).toBe('Добавили 1 из 5. Нет в наличии: «A», «B» и ещё 2');
  });
  it('часть: не влезло', () => {
    expect(repeatMessage(r({ added: 1, total: 3, overflow: 2 })).text).toBe('Добавили 1 из 3. Корзина заполнена — не поместилось 2');
  });
  it('ничего: корзина полна', () => {
    expect(repeatMessage(r({ added: 0, total: 2, overflow: 2 }))).toEqual({ text: 'В корзине уже 30 позиций — оформите заказ или уберите лишнее', kind: 'error' });
  });
  it('ничего: сеть', () => {
    expect(repeatMessage(r({ total: 2, unavailable: ['A', 'B'], offline: true }))).toEqual({ text: 'Не удалось повторить заказ. Проверьте интернет и попробуйте ещё раз', kind: 'error' });
  });
  it('ничего: нет в наличии', () => {
    expect(repeatMessage(r({ total: 2, unavailable: ['A', 'B'] }))).toEqual({ text: 'Товаров из этого заказа сейчас нет в наличии', kind: 'error' });
  });
});

const line = (over: Partial<OrderLine> = {}): OrderLine => ({ product_id: '1', shop_handle: 'a', title: 'T', price: 100, image: '', size: null, qty: 1, ...over });
const prod = (over: Partial<Product> = {}): Product => ({ id: '1', shop_handle: 'a', title: 'T', price: 100, old_price: null, image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '', shop_verified: true, ...over });
const order = (lines: OrderLine[], stage: OrderStage = 'delivered'): Order => ({ number: 'R-1', created_at: '', customer: { name: 'Ф', phone: '', district: '', address: '' }, slot: '', payment: 'cash', stage, items_total: 0, delivery_total: 0, lines, shops: [] });
const fail = (status: number) => throwError(() => new HttpErrorResponse({ status }));

describe('RepeatOrderService', () => {
  /** products: id → товар или код ошибки. */
  function setup(products: Record<string, Product | number>) {
    localStorage.clear();
    const product = jest.fn((id: string) => { const v = products[id]; return typeof v === 'number' ? fail(v) : of(v); });
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: MarketApi, useValue: { product } }] });
    const nav = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    return { product, nav, svc: TestBed.inject(RepeatOrderService), cart: TestBed.inject(CartService), toasts: TestBed.inject(ToastService) };
  }
  const rows = (cart: CartService) => cart.items().map((i) => [i.product.id, i.size, i.qty]);

  it('все доступны: в корзине с размером и количеством, тост, переход', async () => {
    const t = setup({ '1': prod(), '2': prod({ id: '2', sizes: ['S', 'M'] }) });
    const res = await firstValueFrom(t.svc.repeat(order([line({ qty: 2 }), line({ product_id: '2', size: 'M' })])));
    expect(rows(t.cart)).toEqual([['1', null, 2], ['2', 'M', 1]]);
    // Считаем штуки, как шапка заказа («3 товара») и значок корзины
    expect(res).toEqual({ added: 3, total: 3, unavailable: [], overflow: 0, offline: false });
    expect(t.toasts.current()?.text).toBe('Добавили в корзину 3 товара');
    expect(t.nav).toHaveBeenCalledWith('/cart');
  });
  it('цена в корзине — текущая, не из заказа', async () => {
    const t = setup({ '1': prod({ price: 120 }) });
    await firstValueFrom(t.svc.repeat(order([line({ price: 100 })])));
    expect(t.cart.items()[0].product.price).toBe(120);
  });
  it('недоступные отсеиваются', async () => {
    const t = setup({ '1': 404, '2': prod({ id: '2', in_stock: false }), '3': prod({ id: '3', shop_verified: false }), '4': prod({ id: '4', price: null }), '5': prod({ id: '5', sizes: ['S', 'M'] }), '6': prod({ id: '6' }) });
    const lines = ['1', '2', '3', '4', '5', '6'].map((id) => line({ product_id: id, title: `Т${id}`, size: id === '5' ? 'XL' : null }));
    const res = await firstValueFrom(t.svc.repeat(order(lines)));
    expect(res).toMatchObject({ added: 1, total: 6, unavailable: ['Т1', 'Т2', 'Т3', 'Т4', 'Т5'] });
    expect(rows(t.cart)).toEqual([['6', null, 1]]);
  });
  it('без размера, а у товара их несколько — недоступна; размер один — берём его', async () => {
    const t = setup({ '1': prod({ sizes: ['S', 'M'] }), '2': prod({ id: '2', sizes: ['Стандарт'] }) });
    const res = await firstValueFrom(t.svc.repeat(order([line({ title: 'Много' }), line({ product_id: '2' })])));
    expect(res.unavailable).toEqual(['Много']);
    expect(rows(t.cart)).toEqual([['2', 'Стандарт', 1]]);
  });
  it('один товар в двух позициях — один запрос', async () => {
    const t = setup({ '1': prod({ sizes: ['S', 'M'] }) });
    await firstValueFrom(t.svc.repeat(order([line({ size: 'S' }), line({ size: 'M' })])));
    expect(t.product).toHaveBeenCalledTimes(1);
    expect(rows(t.cart)).toEqual([['1', 'S', 1], ['1', 'M', 1]]);
  });
  it('часть — в штуках, как в шапке заказа', async () => {
    const t = setup({ '1': prod(), '2': 404 });
    await firstValueFrom(t.svc.repeat(order([line({ qty: 3 }), line({ product_id: '2', title: 'Шарф', qty: 2 })])));
    expect(t.toasts.current()?.text).toBe('Добавили 3 из 5. Нет в наличии: «Шарф»');
  });
  it('у товара пропали размеры — старый размер в корзину не идёт', async () => {
    const t = setup({ '1': prod({ sizes: [] }) });
    await firstValueFrom(t.svc.repeat(order([line({ size: 'M' })])));
    expect(rows(t.cart)).toEqual([['1', null, 1]]);
  });
  it('корзина почти полная', async () => {
    const t = setup({ a: prod({ id: 'a' }), b: prod({ id: 'b' }), c: prod({ id: 'c' }) });
    for (let i = 0; i < 29; i++) t.cart.add(prod({ id: `x${i}` }), null);
    const res = await firstValueFrom(t.svc.repeat(order(['a', 'b', 'c'].map((id) => line({ product_id: id })))));
    expect(res).toMatchObject({ added: 1, overflow: 2 });
    expect(t.toasts.current()?.text).toBe('Добавили 1 из 3. Корзина заполнена — не поместилось 2');
    expect(t.nav).toHaveBeenCalledWith('/cart');
  });
  it('сеть упала у всех', async () => {
    const t = setup({ '1': 0, '2': 0 });
    const res = await firstValueFrom(t.svc.repeat(order([line(), line({ product_id: '2' })])));
    expect(res).toMatchObject({ added: 0, offline: true });
    expect(t.nav).not.toHaveBeenCalled();
    expect(t.toasts.current()?.kind).toBe('error');
  });
  it('404 у всех — не «сеть»', async () => {
    const t = setup({ '1': 404, '2': 404 });
    const res = await firstValueFrom(t.svc.repeat(order([line(), line({ product_id: '2' })])));
    expect(res.offline).toBe(false);
    expect(t.toasts.current()?.text).toBe('Товаров из этого заказа сейчас нет в наличии');
  });
});
