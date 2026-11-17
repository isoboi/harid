import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { OrderComponent } from './order.component';
import { MarketApi } from '../../core/market-api.service';
import { AuthService } from '../../core/auth.service';
import { Order } from '../../core/models';

const ORDER: Order = { number: 'R-221526', stage: 'in_delivery', items_total: 640, delivery_total: 15, created_at: '2026-11-17T05:08:07Z', slot: 'Сегодня, 18:00–21:00', payment: 'cash', customer: { name: 'Ф', phone: '+992 93 111 00 02', district: 'Сино', address: 'ул' }, lines: [], shops: [] };
const notFound = () => throwError(() => new HttpErrorResponse({ status: 404, error: { error: { message: 'Заказ не найден' } } }));
const text = (el: HTMLElement) => el.textContent!.replace(/\s+/g, ' ');

describe('OrderComponent', () => {
  beforeEach(() => localStorage.clear());

  async function setup(order: jest.Mock) {
    await TestBed.configureTestingModule({ imports: [OrderComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { order } }] }).compileComponents();
    return TestBed.createComponent(OrderComponent);
  }
  const loginAsOwner = () => TestBed.inject(AuthService).setSession({ token: 'b', buyer: { id: 1, phone: '931110002', name: null }, is_new: false });

  it('по телефону из старой ссылки: номер, этап и сумма', async () => {
    const order = jest.fn(() => of(ORDER));
    const f = await setup(order);
    TestBed.inject(AuthService).hydrate();
    f.componentRef.setInput('number', 'R-221526');
    f.componentRef.setInput('phone', '931110002');
    f.detectChanges();
    const t: string = f.nativeElement.textContent;
    expect(order).toHaveBeenCalledWith('R-221526', { phone: '931110002' });
    expect(t).toContain('R-221526');
    expect(t).toContain('Курьер в пути');
    expect(t).toContain('655 смн');
  });

  it('по токену из ссылки — сразу, не дожидаясь auth; токен важнее телефона', async () => {
    const order = jest.fn(() => of(ORDER));
    const f = await setup(order);
    f.componentRef.setInput('number', 'R-221526');
    f.componentRef.setInput('t', 'tok-1');
    f.componentRef.setInput('phone', '931110002');
    f.detectChanges();
    expect(order).toHaveBeenCalledWith('R-221526', { token: 'tok-1' });
    // Гидратация auth не повторяет запрос
    TestBed.inject(AuthService).hydrate();
    f.detectChanges();
    expect(order).toHaveBeenCalledTimes(1);
  });

  const FRESH: Order = { ...ORDER, stage: 'placed', lines: [{ product_id: '16', shop_handle: 'technomir.tj', title: 'Наушники', price: 320, image: '', size: null, qty: 2 }], shops: [{ shop_handle: 'technomir.tj', status: 'new' }, { shop_handle: 'moda.dush', status: 'new' }] };

  async function open(fresh: string | undefined, o: Order = FRESH) {
    const f = await setup(jest.fn(() => of(o)));
    TestBed.inject(AuthService).hydrate();
    f.componentRef.setInput('number', 'R-221526');
    f.componentRef.setInput('t', 'tok-1');
    if (fresh !== undefined) f.componentRef.setInput('fresh', fresh);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  it('сразу после заказа (fresh=1) — благодарность и следующие шаги', async () => {
    const el = await open('1');
    const box = el.querySelector('[data-test="confirm"]');
    expect(box).not.toBeNull();
    const t = text(box as HTMLElement);
    expect(t).toContain('Спасибо! Заказ принят');
    expect(t).toContain('R-221526');
    expect(t).toContain('Лавка @technomir.tj позвонит, чтобы подтвердить заказ');
    expect(t).toContain('Лавка @moda.dush позвонит, чтобы подтвердить заказ');
    // Слот с датой: «Сегодня» относительно created_at (17 ноября по Душанбе)
    expect(t).toContain('Курьер привезёт: 17 ноября, 18:00–21:00');
    expect(t).toContain('Приготовьте 655 смн наличными');
    expect(t).toContain('Проверьте товар при курьере — не подошло, не берёте');
  });

  it('слот под заказом — с абсолютной датой, «Завтра» = день после created_at', async () => {
    const el = await open(undefined, { ...ORDER, slot: 'Завтра, 10:00–14:00' });
    expect(text(el)).toContain('18 ноября, 10:00–14:00');
    expect(text(el)).not.toContain('Завтра');
  });

  it('подтверждение стоит над этапами заказа', async () => {
    const el = await open('1');
    const box = el.querySelector('[data-test="confirm"]')!;
    const steps = el.querySelector('.steps')!;
    expect(box.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('«Принят» не дублируется: один текущий этап, отмеченный aria-current', async () => {
    const el = await open('1');
    const steps = Array.from(el.querySelectorAll('.steps li'));
    expect(steps.map((s) => s.textContent?.trim())).toEqual(['Принят', 'Собирается', 'Курьер в пути', 'Доставлен']);
    expect(el.querySelector('.stage')).toBeNull();
    const current = el.querySelectorAll('[aria-current="step"]');
    expect(current.length).toBe(1);
    expect(current[0].textContent?.trim()).toBe('Принят');
  });

  it('текущий этап в пути — отмечен именно он', async () => {
    const el = await open(undefined, ORDER);
    expect(el.querySelector('[aria-current="step"]')?.textContent?.trim()).toBe('Курьер в пути');
  });

  it('отменённый заказ — «Отменён» без шагов', async () => {
    const el = await open(undefined, { ...ORDER, stage: 'cancelled' });
    expect(text(el)).toContain('Отменён');
    expect(el.querySelector('.steps')).toBeNull();
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

  it('под заказом: «Продолжить покупки» и гостю — «Войти, чтобы следить за заказами»', async () => {
    const el = await open('1');
    const links = Array.from(el.querySelectorAll('.actions a')) as HTMLAnchorElement[];
    expect(links.map((a) => a.textContent?.trim())).toEqual(['Продолжить покупки', 'Войти, чтобы следить за заказами']);
    expect(links[0].getAttribute('href')).toBe('/');
    expect(links[1].getAttribute('href')).toBe('/login?return=%2Fme%2Forders');
  });

  it('вошедшему ссылки «Войти» нет', async () => {
    const f = await setup(jest.fn(() => of(ORDER)));
    loginAsOwner();
    f.componentRef.setInput('number', 'R-221526');
    f.detectChanges();
    const links = Array.from((f.nativeElement as HTMLElement).querySelectorAll('.actions a')).map((a) => a.textContent?.trim());
    expect(links).toEqual(['Продолжить покупки']);
  });

  it('без токена и телефона: до готовности auth не запрашивает, владельцу — запрос по Bearer', async () => {
    const order = jest.fn(() => of(ORDER));
    const f = await setup(order);
    f.componentRef.setInput('number', 'R-221526');
    f.detectChanges();
    expect(order).not.toHaveBeenCalled();
    expect(f.nativeElement.textContent).toContain('Загрузка');
    loginAsOwner();
    f.detectChanges();
    expect(order).toHaveBeenCalledTimes(1);
    expect(order).toHaveBeenCalledWith('R-221526', {});
  });

  it('гость без токена и телефона — сразу форма «Найти заказ» с номером из адреса, без запроса', async () => {
    const order = jest.fn();
    const f = await setup(order);
    TestBed.inject(AuthService).hydrate();
    f.componentRef.setInput('number', 'R-221526');
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(order).not.toHaveBeenCalled();
    expect(el.querySelector('[data-test="lookup"]')).not.toBeNull();
    expect(el.querySelector('h1')?.textContent).toContain('Найти заказ');
    expect((el.querySelector('input[formControlName="number"]') as HTMLInputElement).value).toBe('R-221526');
    const tel = el.querySelector('input[formControlName="phone"]')!;
    expect(tel.getAttribute('type')).toBe('tel');
    expect(tel.parentElement!.querySelector('.tel-prefix')?.textContent?.trim()).toBe('+992');
  });

  it('404 — форма «Найти заказ» вместо голой ошибки', async () => {
    const f = await setup(jest.fn(() => notFound()));
    f.componentRef.setInput('number', 'R-221526');
    f.componentRef.setInput('t', 'stale');
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('[data-test="lookup"]')).not.toBeNull();
    expect(text(el)).toContain('Заказ не найден');
  });

  it('форма поиска: неверный телефон — ошибка под полем, запроса нет', async () => {
    const order = jest.fn();
    const f = await setup(order);
    TestBed.inject(AuthService).hydrate();
    f.componentRef.setInput('number', 'R-221526');
    f.detectChanges();
    const c = f.componentInstance;
    c.lookupForm.controls.phone.setValue('93 1');
    c.findOrder();
    f.detectChanges();
    expect(order).not.toHaveBeenCalled();
    expect(text(f.nativeElement)).toContain('Нужен номер из 9 цифр');
  });

  it('форма поиска: номер и телефон — запрос с phone, затем заказ', async () => {
    const order = jest.fn(() => of(ORDER));
    const f = await setup(order);
    TestBed.inject(AuthService).hydrate();
    f.componentRef.setInput('number', 'R-221526');
    f.detectChanges();
    const c = f.componentInstance;
    c.lookupForm.setValue({ number: ' R-221526 ', phone: '93 111 00 02' });
    c.findOrder();
    f.detectChanges();
    expect(order).toHaveBeenCalledWith('R-221526', { phone: '931110002' });
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('[data-test="lookup"]')).toBeNull();
    expect(el.querySelector('h1')?.textContent).toContain('Заказ R-221526');
  });

  it('до ответа показывает «Загрузка…»', async () => {
    const res = new Subject<Order>();
    const f = await setup(jest.fn(() => res));
    f.componentRef.setInput('number', 'R-221526');
    f.componentRef.setInput('t', 'tok-1');
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
    f.componentRef.setInput('t', 'tok-1');
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
