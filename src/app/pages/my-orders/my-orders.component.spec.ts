import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { MyOrdersComponent } from './my-orders.component';
import { MarketApi } from '../../core/market-api.service';
import { AuthService } from '../../core/auth.service';
import { RepeatOrderService, RepeatResult } from '../../core/repeat-order.service';

const reviewable = jest.fn(() => of([]));
const myReturns = jest.fn(() => of([]));
const returnable = jest.fn(() => of([]));
const ORDER = { number: 'R-1', stage: 'delivered', items_total: 100, delivery_total: 15, created_at: '2026-11-17T05:08:07Z', customer: { name: 'Ф', phone: '+992 93 111 00 02', district: 'Сино', address: 'ул' }, slot: 'Сегодня', payment: 'cash', lines: [], shops: [] };

describe('MyOrdersComponent', () => {
  beforeEach(() => localStorage.clear());

  it('без входа — на /login с return', async () => {
    const myOrders = jest.fn();
    await TestBed.configureTestingModule({ imports: [MyOrdersComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { myOrders, reviewable, myReturns, returnable } }] }).compileComponents();
    TestBed.inject(AuthService).hydrate();
    const nav = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.createComponent(MyOrdersComponent).detectChanges();
    expect(nav).toHaveBeenCalledWith(['/login'], { queryParams: { return: '/me/orders' } });
    expect(myOrders).not.toHaveBeenCalled();
  });

  it('до гидратации auth — «Загрузка…», без перехода и запроса', async () => {
    const myOrders = jest.fn();
    await TestBed.configureTestingModule({ imports: [MyOrdersComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { myOrders, reviewable, myReturns, returnable } }] }).compileComponents();
    const nav = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const f = TestBed.createComponent(MyOrdersComponent);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Загрузка');
    expect(f.nativeElement.querySelector('[data-test="skel-orders"]')).not.toBeNull();
    expect(nav).not.toHaveBeenCalled();
    expect(myOrders).not.toHaveBeenCalled();
  });

  it('вошёл, список ещё не пришёл — заглушка строк, а не «Заказов пока нет»', async () => {
    const res = new Subject<never[]>();
    const myOrders = jest.fn(() => res);
    await TestBed.configureTestingModule({ imports: [MyOrdersComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { myOrders, reviewable, myReturns, returnable } }] }).compileComponents();
    TestBed.inject(AuthService).setSession({ token: 't', buyer: { id: 1, phone: '+992931110002', name: null }, is_new: false });
    const f = TestBed.createComponent(MyOrdersComponent);
    f.detectChanges();
    expect(myOrders).toHaveBeenCalledTimes(1);
    expect(f.nativeElement.querySelector('[data-test="skel-orders"]')).not.toBeNull();
    expect(f.nativeElement.textContent).not.toContain('Заказов пока нет');
    res.next([]); f.detectChanges();
    expect(f.nativeElement.querySelector('[data-test="skel-orders"]')).toBeNull();
    expect(f.nativeElement.textContent).toContain('Заказов пока нет');
  });

  it('список заказов со ссылками без телефона в адресе (владелец — по Bearer)', async () => {
    const myOrders = jest.fn(() => of([ORDER]));
    await TestBed.configureTestingModule({ imports: [MyOrdersComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { myOrders, reviewable, myReturns, returnable } }] }).compileComponents();
    TestBed.inject(AuthService).setSession({ token: 't', buyer: { id: 1, phone: '+992931110002', name: null }, is_new: false });
    const f = TestBed.createComponent(MyOrdersComponent);
    f.detectChanges();
    const t: string = f.nativeElement.textContent;
    expect(myOrders).toHaveBeenCalledTimes(1);
    expect(t).toContain('R-1');
    expect(t).toContain('Доставлен');
    const href = (f.nativeElement.querySelector('a.row') as HTMLAnchorElement).getAttribute('href');
    expect(href).toContain('/order/R-1');
    expect(href).toBe('/order/R-1');
  });

  it('401 от заказов — на /login с return, без текста ошибки', async () => {
    const myOrders = jest.fn(() => throwError(() => new HttpErrorResponse({ status: 401, error: { error: { message: 'Не авторизован' } } })));
    await TestBed.configureTestingModule({ imports: [MyOrdersComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { myOrders, reviewable, myReturns, returnable } }] }).compileComponents();
    TestBed.inject(AuthService).setSession({ token: 't', buyer: { id: 1, phone: '+992931110002', name: null }, is_new: false });
    const nav = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const f = TestBed.createComponent(MyOrdersComponent);
    f.detectChanges();
    expect(nav).toHaveBeenCalledWith(['/login'], { queryParams: { return: '/me/orders' } });
    expect(f.componentInstance.error()).toBe('');
    expect(f.nativeElement.textContent).not.toContain('Не авторизован');
  });

  it('не запрашивает заказы повторно при последующих проверках', async () => {
    const res = new Subject<never[]>();
    const myOrders = jest.fn(() => res);
    await TestBed.configureTestingModule({ imports: [MyOrdersComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { myOrders, reviewable, myReturns, returnable } }] }).compileComponents();
    TestBed.inject(AuthService).setSession({ token: 't', buyer: { id: 1, phone: '+992931110002', name: null }, is_new: false });
    const f = TestBed.createComponent(MyOrdersComponent);
    f.detectChanges();
    f.detectChanges();
    expect(myOrders).toHaveBeenCalledTimes(1);
  });

  it('строка заказа: что внутри, лавка и подсказки — оценить, срок возврата, статус возврата', async () => {
    const line = (title: string, shop = 'zebo.style') => ({ product_id: '16', shop_handle: shop, title, price: 50, image: 'a.jpg', size: null, qty: 1 });
    const myOrders = jest.fn(() => of([{ ...ORDER, lines: [line('Платье макси'), line('Шарф'), line('Сумка', 'bag.tj')] }]));
    const items = jest.fn(() => of([{ product_id: '16', product_title: 'Платье макси', image: '', shop_handle: 'zebo.style', order_number: 'R-1', review: null }]));
    const ret = jest.fn(() => of([{ id: 1, number: 'R-1', status: 'requested' }]));
    const able = jest.fn(() => of([{ order_id: 4, number: 'R-1', deadline: '2026-11-27T10:00:00Z', lines: [] }]));
    await TestBed.configureTestingModule({ imports: [MyOrdersComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { myOrders, reviewable: items, myReturns: ret, returnable: able } }] }).compileComponents();
    TestBed.inject(AuthService).setSession({ token: 't', buyer: { id: 1, phone: '+992931110002', name: null }, is_new: false });
    const f = TestBed.createComponent(MyOrdersComponent);
    f.detectChanges();
    const t: string = f.nativeElement.textContent.replace(/\s+/g, ' ');
    expect(t).toContain('Платье макси и ещё 2 товара');
    expect(t).toContain('@zebo.style, @bag.tj');
    expect(f.nativeElement.querySelectorAll('.thumb img').length).toBe(3);
    expect(t).toContain('Оцените 1 товар');
    expect(t).toContain('Можно вернуть до 27 ноября');
    expect(t).toContain('Возврат: ждёт ответа лавки');
    // Формы возврата и отзывов живут на странице заказа, не в списке
    expect(f.nativeElement.querySelector('textarea')).toBeNull();
  });

  it('активные заказы — отдельной группой над завершёнными', async () => {
    const myOrders = jest.fn(() => of([ORDER, { ...ORDER, number: 'R-2', stage: 'in_delivery' }]));
    await TestBed.configureTestingModule({ imports: [MyOrdersComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { myOrders, reviewable, myReturns, returnable } }] }).compileComponents();
    TestBed.inject(AuthService).setSession({ token: 't', buyer: { id: 1, phone: '+992931110002', name: null }, is_new: false });
    const f = TestBed.createComponent(MyOrdersComponent);
    f.detectChanges();
    const titles = [...f.nativeElement.querySelectorAll('.group-title')].map((h: Element) => h.textContent?.trim());
    expect(titles).toEqual(['Активные', 'Завершённые']);
    const nums = [...f.nativeElement.querySelectorAll('.num')].map((n: Element) => n.textContent);
    expect(nums).toEqual(['R-2', 'R-1']);
  });
  it('без входа reviewable() не вызывается', async () => {
    const items = jest.fn(() => of([]));
    await TestBed.configureTestingModule({ imports: [MyOrdersComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { myOrders: jest.fn(), reviewable: items } }] }).compileComponents();
    TestBed.inject(AuthService).hydrate();
    jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.createComponent(MyOrdersComponent).detectChanges();
    expect(items).not.toHaveBeenCalled();
  });

  describe('«Повторить» в списке', () => {
    async function list() {
      const subject = new Subject<RepeatResult>();
      const repeat = jest.fn(() => subject);
      const orders = [{ ...ORDER, number: 'R-1', stage: 'delivered' }, { ...ORDER, number: 'R-2', stage: 'cancelled' }, { ...ORDER, number: 'R-3', stage: 'in_delivery' }];
      await TestBed.configureTestingModule({ imports: [MyOrdersComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { myOrders: jest.fn(() => of(orders)), reviewable, myReturns, returnable } }, { provide: RepeatOrderService, useValue: { repeat } }] }).compileComponents();
      TestBed.inject(AuthService).setSession({ token: 't', buyer: { id: 1, phone: '+992931110002', name: null }, is_new: false });
      const f = TestBed.createComponent(MyOrdersComponent);
      f.detectChanges();
      const btns = () => [...(f.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('[data-test="repeat"]')];
      return { f, btns, repeat, subject };
    }

    it('«Повторить» в списке — только у доставленных и отменённых, вне ссылки на заказ', async () => {
      const { btns } = await list();
      expect(btns()).toHaveLength(2);
      for (const b of btns()) {
        expect(b.closest('a')).toBeNull();
        expect(b.textContent?.trim()).toBe('Повторить заказ');
      }
      // Кнопки — у R-1 и R-2, у заказа в пути нет
      expect(btns().map((b) => b.closest('li')!.querySelector('a.row')!.getAttribute('href'))).toEqual(['/order/R-1', '/order/R-2']);
    });
    it('«Повторить» в списке: повтор именно этого заказа, «Добавляем…» только у него', async () => {
      const { f, btns, repeat, subject } = await list();
      btns()[1].click(); f.detectChanges();
      expect(repeat).toHaveBeenCalledWith(expect.objectContaining({ number: 'R-2' }));
      expect(btns()[1].textContent?.trim()).toBe('Добавляем…');
      expect(btns()[1].disabled).toBe(true);
      expect(btns()[0].textContent?.trim()).toBe('Повторить заказ');
      btns()[0].click(); f.detectChanges();
      expect(repeat).toHaveBeenCalledTimes(1);
      subject.next({ added: 1, total: 1, unavailable: [], overflow: 0, offline: false }); subject.complete();
      f.detectChanges();
      expect(btns().map((b) => [b.textContent?.trim(), b.disabled])).toEqual([['Повторить заказ', false], ['Повторить заказ', false]]);
    });
  });
});
