import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { OrderComponent } from './order.component';
import { MarketApi } from '../../core/market-api.service';
import { AuthService } from '../../core/auth.service';
import { Order } from '../../core/models';

const ORDER: Order = { number: 'R-221526', stage: 'in_delivery', items_total: 640, delivery_total: 15, created_at: '2026-11-17T05:08:07Z', slot: 'Сегодня, 18:00–21:00', payment: 'cash', customer: { name: 'Ф', phone: '+992 93 111 00 02', district: 'Сино', address: 'ул' }, lines: [], shops: [] };

describe('OrderComponent', () => {
  beforeEach(() => localStorage.clear());

  async function setup(order: jest.Mock) {
    await TestBed.configureTestingModule({ imports: [OrderComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { order } }] }).compileComponents();
    return TestBed.createComponent(OrderComponent);
  }

  it('показывает номер, этап и сумму', async () => {
    const order = jest.fn(() => of(ORDER));
    const f = await setup(order);
    TestBed.inject(AuthService).hydrate();
    f.componentRef.setInput('number', 'R-221526');
    f.componentRef.setInput('phone', '931110002');
    f.detectChanges();
    const t: string = f.nativeElement.textContent;
    expect(order).toHaveBeenCalledWith('R-221526', '931110002');
    expect(t).toContain('R-221526');
    expect(t).toContain('Курьер в пути');
    expect(t).toContain('655 смн');
  });

  const FRESH: Order = { ...ORDER, stage: 'placed', lines: [{ product_id: '16', shop_handle: 'technomir.tj', title: 'Наушники', price: 320, image: '', size: null, qty: 2 }], shops: [{ shop_handle: 'technomir.tj', status: 'new' }, { shop_handle: 'moda.dush', status: 'new' }] };

  async function open(fresh: string | undefined) {
    const f = await setup(jest.fn(() => of(FRESH)));
    TestBed.inject(AuthService).hydrate();
    f.componentRef.setInput('number', 'R-221526');
    if (fresh !== undefined) f.componentRef.setInput('fresh', fresh);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  it('сразу после заказа (fresh=1) — благодарность и следующие шаги', async () => {
    const el = await open('1');
    const box = el.querySelector('[data-test="confirm"]');
    expect(box).not.toBeNull();
    const t = box!.textContent!.replace(/\s+/g, ' ');
    expect(t).toContain('Спасибо! Заказ принят');
    expect(t).toContain('R-221526');
    expect(t).toContain('Лавка @technomir.tj позвонит, чтобы подтвердить заказ');
    expect(t).toContain('Лавка @moda.dush позвонит, чтобы подтвердить заказ');
    expect(t).toContain('Курьер привезёт: Сегодня, 18:00–21:00');
    expect(t).toContain('Приготовьте 655 смн наличными');
    expect(t).toContain('Проверьте товар при курьере — не подошло, не берёте');
  });

  it('подтверждение стоит над этапами заказа', async () => {
    const el = await open('1');
    const box = el.querySelector('[data-test="confirm"]')!;
    const steps = el.querySelector('.steps')!;
    expect(box.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('обычный визит — без благодарности, прежний заголовок', async () => {
    const el = await open(undefined);
    expect(el.querySelector('[data-test="confirm"]')).toBeNull();
    expect(el.querySelector('h1')?.textContent).toContain('Заказ R-221526');
  });

  it('fresh с другим значением не считается свежим', async () => {
    const el = await open('0');
    expect(el.querySelector('[data-test="confirm"]')).toBeNull();
  });

  it('кнопки отмены нет', async () => {
    const el = await open('1');
    expect(el.textContent).not.toMatch(/Отменить/);
  });

  it('до готовности auth не запрашивает заказ', async () => {
    const order = jest.fn(() => of(ORDER));
    const f = await setup(order);
    f.componentRef.setInput('number', 'R-221526');
    f.detectChanges();
    expect(order).not.toHaveBeenCalled();
    TestBed.inject(AuthService).hydrate();
    f.detectChanges();
    expect(order).toHaveBeenCalledTimes(1);
  });

  it('до ответа показывает «Загрузка…»', async () => {
    const res = new Subject<Order>();
    const f = await setup(jest.fn(() => res));
    TestBed.inject(AuthService).hydrate();
    f.componentRef.setInput('number', 'R-221526');
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Загрузка');
    res.next(ORDER);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('R-221526');
  });

  it('смена номера отменяет прежний запрос: поздний ответ не перетирает новый заказ', async () => {
    const first = new Subject<Order>();
    const second = new Subject<Order>();
    const order = jest.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const f = await setup(order);
    TestBed.inject(AuthService).hydrate();
    f.componentRef.setInput('number', 'R-1');
    f.detectChanges();
    f.componentRef.setInput('number', 'R-2');
    f.detectChanges();
    expect(first.observed).toBe(false);
    second.next({ ...ORDER, number: 'R-2' });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('R-2');
  });
});
