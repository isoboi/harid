import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { MyOrdersComponent } from './my-orders.component';
import { MarketApi } from '../../core/market-api.service';
import { AuthService } from '../../core/auth.service';

const ORDER = { number: 'R-1', stage: 'delivered', items_total: 100, delivery_total: 15, created_at: '2026-11-17T05:08:07Z', customer: { name: 'Ф', phone: '+992 93 111 00 02', district: 'Сино', address: 'ул' }, slot: 'Сегодня', payment: 'cash', lines: [], shops: [] };

describe('MyOrdersComponent', () => {
  beforeEach(() => localStorage.clear());

  it('без входа — на /login с return', async () => {
    const myOrders = jest.fn();
    await TestBed.configureTestingModule({ imports: [MyOrdersComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { myOrders } }] }).compileComponents();
    TestBed.inject(AuthService).hydrate();
    const nav = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.createComponent(MyOrdersComponent).detectChanges();
    expect(nav).toHaveBeenCalledWith(['/login'], { queryParams: { return: '/me/orders' } });
    expect(myOrders).not.toHaveBeenCalled();
  });

  it('до гидратации auth — «Загрузка…», без перехода и запроса', async () => {
    const myOrders = jest.fn();
    await TestBed.configureTestingModule({ imports: [MyOrdersComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { myOrders } }] }).compileComponents();
    const nav = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const f = TestBed.createComponent(MyOrdersComponent);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Загрузка');
    expect(nav).not.toHaveBeenCalled();
    expect(myOrders).not.toHaveBeenCalled();
  });

  it('список заказов со ссылками без телефона в адресе (владелец — по Bearer)', async () => {
    const myOrders = jest.fn(() => of([ORDER]));
    await TestBed.configureTestingModule({ imports: [MyOrdersComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { myOrders } }] }).compileComponents();
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
    await TestBed.configureTestingModule({ imports: [MyOrdersComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { myOrders } }] }).compileComponents();
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
    await TestBed.configureTestingModule({ imports: [MyOrdersComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { myOrders } }] }).compileComponents();
    TestBed.inject(AuthService).setSession({ token: 't', buyer: { id: 1, phone: '+992931110002', name: null }, is_new: false });
    const f = TestBed.createComponent(MyOrdersComponent);
    f.detectChanges();
    f.detectChanges();
    expect(myOrders).toHaveBeenCalledTimes(1);
  });
});
