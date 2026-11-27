import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, Subject, throwError } from 'rxjs';
import { OrderComponent } from './order.component';
import { MarketApi } from '../../core/market-api.service';
import { AuthService } from '../../core/auth.service';
import { Order, OrderStage } from '../../core/models';
import { RepeatOrderService, RepeatResult } from '../../core/repeat-order.service';
import { ToastService } from '../../core/toast.service';
import { LANG_COOKIE, LANG_DICT } from '../../core/i18n';
import { TG } from '../../i18n/tg';

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

  describe('отмена покупателем', () => {
    async function openWith(o: Order, cancelOrder: jest.Mock = jest.fn()) {
      await TestBed.configureTestingModule({ imports: [OrderComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { order: jest.fn(() => of(o)), cancelOrder } }] }).compileComponents();
      const f = TestBed.createComponent(OrderComponent);
      TestBed.inject(AuthService).hydrate();
      f.componentRef.setInput('number', o.number);
      f.componentRef.setInput('t', 'tok-1');
      f.detectChanges();
      const el = f.nativeElement as HTMLElement;
      const click = (test: string) => { (el.querySelector(`[data-test="${test}"]`) as HTMLButtonElement).click(); f.detectChanges(); };
      return { f, el, click };
    }
    const PLACED: Order = { ...FRESH, shops: [{ shop_handle: 'technomir.tj', status: 'paid' }] };

    it.each([
      ['лавка собирает', { ...PLACED, stage: 'placed', shops: [{ shop_handle: 'a', status: 'paid' }, { shop_handle: 'b', status: 'assembling' }] }],
      ['в пути', { ...PLACED, stage: 'in_delivery' }],
      ['уже отменён', { ...PLACED, stage: 'cancelled' }],
    ] as [string, Order][])('%s — кнопки отмены нет', async (_n, o) => {
      const { el } = await openWith(o);
      expect(el.querySelector('[data-test="cancel-open"]')).toBeNull();
    });

    it('«Принят» — «Отменить заказ», затем подтверждение; «Не отменять» сворачивает', async () => {
      const { el, click } = await openWith(PLACED);
      expect(el.querySelector('[data-test="cancel-box"]')).toBeNull();
      click('cancel-open');
      expect(text(el)).toContain('Отменить заказ R-221526?');
      click('cancel-no');
      expect(el.querySelector('[data-test="cancel-box"]')).toBeNull();
      expect(el.querySelector('[data-test="cancel-open"]')).not.toBeNull();
    });

    it('«Да, отменить» — телефон из заказа и причина; этап «Отменён» и всплывашка', async () => {
      const cancelOrder = jest.fn(() => of({ ...PLACED, stage: 'cancelled' as const, shops: [{ shop_handle: 'technomir.tj', status: 'cancelled' }] }));
      const { f, el, click } = await openWith(PLACED, cancelOrder);
      const toast = jest.spyOn(TestBed.inject(ToastService), 'show');
      click('cancel-open');
      f.componentInstance.reason.set('  Передумала ');
      click('cancel-yes');
      expect(cancelOrder).toHaveBeenCalledWith('R-221526', { phone: '931110002', reason: 'Передумала' });
      expect(el.querySelector('.cancelled')?.textContent).toContain('Отменён');
      expect(el.querySelector('[data-test="cancel-open"]')).toBeNull();
      expect(toast).toHaveBeenCalledWith({ text: 'Заказ отменён' });
    });

    it('без причины — причина не уходит', async () => {
      const cancelOrder = jest.fn(() => of({ ...PLACED, stage: 'cancelled' as const }));
      const { click } = await openWith(PLACED, cancelOrder);
      click('cancel-open');
      click('cancel-yes');
      expect(cancelOrder).toHaveBeenCalledWith('R-221526', { phone: '931110002' });
    });

    it('409 — лавка успела начать: всплывашка с причиной и заказ перезапрашивается', async () => {
      const conflict = new HttpErrorResponse({ status: 409, error: { error: { message: 'Лавка уже собирает заказ — отменить его можно только через неё' } } });
      const cancelOrder = jest.fn(() => throwError(() => conflict));
      const { el, click } = await openWith(PLACED, cancelOrder);
      const order = TestBed.inject(MarketApi).order as jest.Mock;
      const err = jest.spyOn(TestBed.inject(ToastService), 'error');
      click('cancel-open');
      click('cancel-yes');
      expect(err).toHaveBeenCalledWith(expect.stringContaining('Лавка уже собирает'));
      expect(order).toHaveBeenCalledTimes(2);
      expect(el.querySelector('[data-test="cancel-box"]')).toBeNull();
    });

    it('прочая ошибка — текст в блоке, блок остаётся', async () => {
      const cancelOrder = jest.fn(() => throwError(() => new HttpErrorResponse({ status: 500 })));
      const { el, click } = await openWith(PLACED, cancelOrder);
      click('cancel-open');
      click('cancel-yes');
      expect(el.querySelector('[data-test="cancel-error"]')).not.toBeNull();
      expect(el.querySelector('[data-test="cancel-box"]')).not.toBeNull();
    });
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

  it('доставленный заказ владельцу: назад к списку, товары с фото по лавкам, оценка строки и возврат этого заказа', async () => {
    const line = { product_id: '16', shop_handle: 'zebo.style', title: 'Платье макси', price: 420, image: 'a.jpg', size: 'M', qty: 2 };
    const delivered: Order = { ...ORDER, stage: 'delivered', lines: [line, { ...line, product_id: '17', title: 'Шарф', size: null, qty: 1 }] };
    const reviewable = jest.fn(() => of([
      { product_id: '16', product_title: 'Платье макси', image: '', shop_handle: 'zebo.style', order_number: 'R-221526', review: null },
      { product_id: '16', product_title: 'Платье макси', image: '', shop_handle: 'zebo.style', order_number: 'R-999', review: null },
    ]));
    const able = { order_id: 4, number: 'R-221526', shop_handle: 'zebo.style', shop_name: 'Z', shop_phone: '', delivered_at: '', deadline: '2026-11-27T10:00:00Z', lines: [] };
    const api = { order: jest.fn(() => of(delivered)), reviewable, myReturns: jest.fn(() => of([])), returnable: jest.fn(() => of([able, { ...able, order_id: 5, number: 'R-999' }])) };
    await TestBed.configureTestingModule({ imports: [OrderComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    const f = TestBed.createComponent(OrderComponent);
    loginAsOwner();
    f.componentRef.setInput('number', 'R-221526');
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[data-test="back"]')?.getAttribute('href')).toBe('/me/orders');
    expect(text(el)).toContain('3 товара');
    expect(el.querySelectorAll('[data-test="line"] img').length).toBe(2);
    expect(text(el)).toContain('Размер M · 2 шт');
    expect(el.querySelector('.shop-name')?.textContent).toContain('@zebo.style');
    // Оценка только у строки из этого заказа, у второго товара её нет
    expect(el.querySelectorAll('[data-test="rate"]').length).toBe(1);
    // Возврат — только по этому заказу
    expect(el.querySelectorAll('[data-test="returnable"] > li').length).toBe(1);
    expect(text(el)).toContain('Оплачено');
  });

  it('гостю по ссылке: без отзывов, возвратов и кнопки «назад»', async () => {
    const reviewable = jest.fn();
    await TestBed.configureTestingModule({ imports: [OrderComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { order: jest.fn(() => of({ ...ORDER, stage: 'delivered' })), reviewable } }] }).compileComponents();
    const f = TestBed.createComponent(OrderComponent);
    f.componentRef.setInput('number', 'R-221526');
    f.componentRef.setInput('t', 'tok');
    f.detectChanges();
    expect(reviewable).not.toHaveBeenCalled();
    expect(f.nativeElement.querySelector('app-returns')).toBeNull();
    expect(f.nativeElement.querySelector('[data-test="back"]')).toBeNull();
  });

  it('без токена и телефона: до готовности auth не запрашивает, владельцу — запрос по Bearer', async () => {
    const order = jest.fn(() => of(ORDER));
    const f = await setup(order);
    f.componentRef.setInput('number', 'R-221526');
    f.detectChanges();
    expect(order).not.toHaveBeenCalled();
    expect(f.nativeElement.textContent).toContain('Загрузка');
    expect(f.nativeElement.querySelector('[data-test="skel-order"]')).not.toBeNull();
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

  it('заголовок вкладки: номер заказа, форма поиска или просто «Заказ»', async () => {
    const pending = new Subject<Order>();
    const order = jest.fn<Observable<Order>, unknown[]>(() => pending);
    const f = await setup(order);
    const title = TestBed.inject(Title);
    f.componentRef.setInput('number', 'R-221526');
    f.componentRef.setInput('t', 'tok');
    f.detectChanges();
    expect(title.getTitle()).toBe('Заказ — Харид');
    pending.next(ORDER); f.detectChanges();
    expect(title.getTitle()).toBe('Заказ R-221526 — Харид');
    order.mockReturnValue(notFound());
    f.componentRef.setInput('t', 'stale'); f.detectChanges();
    expect(title.getTitle()).toBe('Найти заказ — Харид');
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
    expect(f.nativeElement.querySelector('[data-test="skel-order"]')).not.toBeNull();
    res.next(ORDER);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('R-221526');
    expect(f.nativeElement.querySelector('[data-test="skel-order"]')).toBeNull();
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

  describe('«Повторить заказ»', () => {
    async function open(stage: OrderStage) {
      const subject = new Subject<RepeatResult>();
      const repeat = jest.fn(() => subject);
      await TestBed.configureTestingModule({ imports: [OrderComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { order: jest.fn(() => of({ ...ORDER, stage })) } }, { provide: RepeatOrderService, useValue: { repeat } }] }).compileComponents();
      const f = TestBed.createComponent(OrderComponent);
      f.componentRef.setInput('number', 'R-221526');
      f.componentRef.setInput('t', 'tok-1');
      f.detectChanges();
      const btn = () => (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-test="repeat"]');
      return { f, btn, repeat, subject };
    }

    it('«Повторить заказ» — только у доставленных и отменённых', async () => {
      for (const stage of ['delivered', 'cancelled'] as OrderStage[]) {
        const { btn } = await open(stage);
        expect(btn()?.textContent?.trim()).toBe('Повторить заказ');
        TestBed.resetTestingModule();
      }
      for (const stage of ['placed', 'assembling', 'in_delivery'] as OrderStage[]) {
        const { btn } = await open(stage);
        expect(btn()).toBeNull();
        TestBed.resetTestingModule();
      }
    });
    it('«Повторить заказ»: вызывает повтор с этим заказом, пока идёт — «Добавляем…» и недоступна', async () => {
      const { f, btn, repeat, subject } = await open('delivered');
      btn()!.click(); f.detectChanges();
      expect(repeat).toHaveBeenCalledWith(expect.objectContaining({ number: 'R-221526' }));
      expect(btn()!.disabled).toBe(true);
      expect(btn()!.textContent?.trim()).toBe('Добавляем…');
      (f.componentInstance as OrderComponent).repeat({ ...ORDER, stage: 'delivered' });
      expect(repeat).toHaveBeenCalledTimes(1);
      subject.next({ added: 1, total: 1, unavailable: [], overflow: 0, offline: false }); subject.complete();
      f.detectChanges();
      expect(btn()!.disabled).toBe(false);
      expect(btn()!.textContent?.trim()).toBe('Повторить заказ');
    });
    it('«Повторить заказ»: ошибка сервиса — кнопка снова доступна', async () => {
      const { f, btn, subject } = await open('cancelled');
      btn()!.click(); f.detectChanges();
      subject.error(new Error('x'));
      f.detectChanges();
      expect(btn()!.disabled).toBe(false);
      expect(btn()!.textContent?.trim()).toBe('Повторить заказ');
    });
  });
});

describe('OrderComponent по-таджикски', () => {
  beforeEach(() => { localStorage.clear(); document.cookie = `${LANG_COOKIE}=tg; path=/`; });
  afterEach(() => { TestBed.resetTestingModule(); document.cookie = `${LANG_COOKIE}=; path=/; max-age=0`; });

  it('благодарность, этапы и слот с таджикской датой; данные заказа и слот в заказе — как есть', async () => {
    const o: Order = { ...ORDER, stage: 'placed', slot: 'Завтра, 10:00–14:00', lines: [{ product_id: '16', shop_handle: 'technomir.tj', title: 'Наушники', price: 320, image: '', size: 'M', qty: 2 }], shops: [{ shop_handle: 'technomir.tj', status: 'new' }] };
    await TestBed.configureTestingModule({
      imports: [OrderComponent],
      providers: [provideRouter([]), { provide: MarketApi, useValue: { order: jest.fn(() => of(o)) } }, { provide: LANG_DICT, useValue: TG }],
    }).compileComponents();
    const f = TestBed.createComponent(OrderComponent);
    TestBed.inject(AuthService).hydrate();
    f.componentRef.setInput('number', 'R-221526');
    f.componentRef.setInput('t', 'tok-1');
    f.componentRef.setInput('fresh', '1');
    f.detectChanges();
    const t = text(f.nativeElement);
    expect(t).toContain('Ташаккур! Фармоиш қабул шуд');
    expect(t).toContain('Дӯкони @technomir.tj барои тасдиқи фармоиш занг мезанад');
    expect(t).toContain('Курйер меорад: 18 ноябр, 10:00–14:00');
    expect(t).toContain('Пули нақд омода кунед: 655 смн');
    expect(t).toContain('Андоза M · 2 адад × 320 смн');
    expect(t).toContain('Наушники');
    expect(t).not.toContain('Заказ');
    const now = f.nativeElement.querySelector('.steps [aria-current="step"]') as HTMLElement;
    expect(now.textContent?.trim()).toBe('Қабул шуд');
    expect(TestBed.inject(Title).getTitle()).toBe('Фармоиши R-221526 — Харид');
  });
});
