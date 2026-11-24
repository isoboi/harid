import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { ReturnsComponent } from './returns.component';
import { MarketApi } from '../../core/market-api.service';
import { MarketReturn, ReturnableOrder } from '../../core/models';

const LINE = (over = {}) => ({ line_id: 71, product_id: '16', title: 'Платье', image: 'a.jpg', size: 'M', price: 420, qty: 3, available: 3, ...over });
const ORDER = (over: Partial<ReturnableOrder> = {}): ReturnableOrder => ({
  order_id: 40, number: 'R-1', shop_handle: 'zebo.style_', shop_name: 'Zebo', shop_phone: '987722151',
  delivered_at: '2026-11-16T10:00:00Z', deadline: '2026-11-23T10:00:00Z', lines: [LINE(), LINE({ line_id: 72, title: 'Шарф', size: null, price: 150, qty: 1, available: 1 })], ...over,
});
const RETURN = (over: Partial<MarketReturn> = {}): MarketReturn => ({
  id: 9, number: 'R-1', order_id: 40, shop_handle: 'zebo.style_', shop_name: 'Zebo', status: 'requested', reason: 'Не подошёл размер', shop_comment: '',
  amount: 840, created_at: '2026-11-18T10:00:00Z', decided_at: null, refunded_at: null, items: [{ line_id: 71, product_id: '16', title: 'Платье', image: 'a.jpg', size: 'M', price: 420, qty: 2 }], ...over,
});

async function render(opts: { returns?: MarketReturn[]; returnable?: ReturnableOrder[]; createReturn?: jest.Mock; cancelReturn?: jest.Mock } = {}) {
  const api = {
    myReturns: jest.fn(() => of(opts.returns ?? [])),
    returnable: jest.fn(() => of(opts.returnable ?? [])),
    createReturn: opts.createReturn ?? jest.fn(),
    cancelReturn: opts.cancelReturn ?? jest.fn(),
  };
  await TestBed.configureTestingModule({ imports: [ReturnsComponent], providers: [{ provide: MarketApi, useValue: api }] }).compileComponents();
  const f = TestBed.createComponent(ReturnsComponent);
  f.detectChanges();
  return { f, el: f.nativeElement as HTMLElement, api };
}
const button = (el: HTMLElement, text: string) => [...el.querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith(text)) as HTMLButtonElement;
const type = (el: HTMLElement, text: string) => {
  const ta = el.querySelector('textarea') as HTMLTextAreaElement;
  ta.value = text;
  ta.dispatchEvent(new Event('input'));
};
const check = (el: HTMLElement, index: number) => {
  const box = el.querySelectorAll('input[type="checkbox"]')[index] as HTMLInputElement;
  box.checked = true;
  box.dispatchEvent(new Event('change'));
};

describe('ReturnsComponent', () => {
  it('нет возвратов и нечего возвращать — блока нет', async () => {
    const { el } = await render();
    expect(el.querySelector('section')).toBeNull();
  });

  it('возврат покупателя: номер заказа, статус словами, товары, сумма и ответ лавки', async () => {
    const { el } = await render({ returns: [RETURN({ status: 'rejected', shop_comment: 'Товар был в употреблении' })] });
    const t = el.textContent ?? '';
    expect(t).toContain('Заказ R-1');
    expect(t).toContain('Лавка отказала');
    expect(t).toContain('Платье');
    expect(t).toContain('× 2');
    expect(t).toContain('840 смн');
    expect(t).toContain('Товар был в употреблении');
    expect(button(el, 'Отменить запрос')).toBeUndefined();
  });

  it('форма: отправка закрыта без товара и причины; уходят выбранные строки с количеством', async () => {
    const createReturn = jest.fn(() => of(RETURN()));
    const { f, el, api } = await render({ returnable: [ORDER()], createReturn });
    expect(el.textContent).toContain('до 23.11.2026');
    button(el, 'Оформить возврат').click();
    f.detectChanges();
    expect(button(el, 'Отправить запрос').disabled).toBe(true);

    check(el, 0);
    f.detectChanges();
    button(el, 'Отправить запрос'); // количество 1
    (el.querySelector('button[aria-label="Больше: Платье"]') as HTMLButtonElement).click();
    f.detectChanges();
    type(el, 'мал');
    f.detectChanges();
    expect(button(el, 'Отправить запрос').disabled).toBe(true); // причина короче 5 знаков
    type(el, '  Не подошёл размер ');
    f.detectChanges();
    expect(button(el, 'Отправить запрос').textContent).toContain('840 смн');

    button(el, 'Отправить запрос').click();
    f.detectChanges();
    expect(createReturn).toHaveBeenCalledWith({ order_id: 40, reason: 'Не подошёл размер', items: [{ line_id: 71, qty: 2 }] });
    expect(el.textContent).toContain('Запрос отправлен');
    expect(el.textContent).toContain('Ждёт ответа лавки');
    expect(el.querySelector('textarea')).toBeNull();
    expect(api.returnable).toHaveBeenCalledTimes(2); // остаток перечитан
  });

  it('количество не выходит за доступное; одна строка в заказе выбрана сразу', async () => {
    const { f, el } = await render({ returnable: [ORDER({ lines: [LINE({ available: 2 })] })] });
    button(el, 'Оформить возврат').click();
    f.detectChanges();
    expect((el.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(true);
    const more = el.querySelector('button[aria-label="Больше: Платье"]') as HTMLButtonElement;
    more.click(); f.detectChanges();
    expect(more.disabled).toBe(true);
    expect(el.querySelector('.step b')?.textContent).toBe('2');
  });

  it('закрытая кнопка объясняет, чего не хватает', async () => {
    const { f, el } = await render({ returnable: [ORDER()] });
    button(el, 'Оформить возврат').click(); f.detectChanges();
    const hint = () => el.querySelector('[data-test="return-missing"]')?.textContent?.trim();
    expect(hint()).toBe('Отметьте товар и напишите причину — от 5 символов');
    check(el, 0); type(el, 'test'); f.detectChanges();
    expect(hint()).toBe('Причина: ещё 1 символ');
    expect(button(el, 'Отправить запрос').getAttribute('aria-describedby')).toBe('return-missing-40');
    type(el, 'test!'); f.detectChanges();
    expect(hint()).toBeUndefined();
    expect(button(el, 'Отправить запрос').disabled).toBe(false);
  });

  it('с номером заказа — только его возвраты, без «Заказ …» в строке', async () => {
    const { f, el } = await render({ returns: [RETURN(), RETURN({ id: 10, number: 'R-2' })], returnable: [ORDER(), ORDER({ order_id: 41, number: 'R-2' })] });
    f.componentRef.setInput('order', 'R-2');
    f.detectChanges();
    expect(el.querySelectorAll('[data-test="returns"] > li').length).toBe(1);
    expect(el.querySelectorAll('[data-test="returnable"] > li').length).toBe(1);
    expect(el.querySelector('#returns-title')?.textContent).toBe('Возврат');
    expect(el.textContent).not.toContain('Заказ R-2');
  });

  it('ошибка сервера показана в форме, форма остаётся открытой', async () => {
    const createReturn = jest.fn(() => throwError(() => new HttpErrorResponse({ status: 400, error: { error: { message: 'Срок возврата истёк: 7 дней после доставки' } } })));
    const { f, el } = await render({ returnable: [ORDER()], createReturn });
    button(el, 'Оформить возврат').click(); f.detectChanges();
    check(el, 1); type(el, 'Не то прислали'); f.detectChanges();
    button(el, 'Отправить запрос').click(); f.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Срок возврата истёк');
    expect(el.querySelector('textarea')).not.toBeNull();
  });

  it('«Отменить запрос» — только у ждущего ответа; после отмены статус меняется', async () => {
    const cancelReturn = jest.fn(() => of(RETURN({ status: 'cancelled' })));
    const { f, el } = await render({ returns: [RETURN()], cancelReturn });
    button(el, 'Отменить запрос').click();
    f.detectChanges();
    expect(cancelReturn).toHaveBeenCalledWith(9);
    expect(el.textContent).toContain('Вы отменили запрос');
    expect(button(el, 'Отменить запрос')).toBeUndefined();
  });
});
