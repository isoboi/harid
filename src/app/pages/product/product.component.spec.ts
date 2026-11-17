import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ProductComponent } from './product.component';
import { MarketApi } from '../../core/market-api.service';
import { CartService } from '../../core/cart.service';
import { Product } from '../../core/models';

const prod = (over: Partial<Product> = {}): Product => ({ id: '16', shop_handle: 'technomir.tj', title: 'Наушники', price: 540, old_price: 600, image: 'a.jpg', images: ['a.jpg', 'b.jpg'], category: 'gadgets', description: 'Описание', sizes: [], in_stock: true, posted_at: '', ...over });

async function render(p: Product) {
  const api = { product: jest.fn(() => of(p)), products: jest.fn(() => of([])) };
  await TestBed.configureTestingModule({ imports: [ProductComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
  const f = TestBed.createComponent(ProductComponent);
  f.componentRef.setInput('id', p.id);
  f.detectChanges();
  return f;
}

describe('ProductComponent', () => {
  beforeEach(() => localStorage.clear());
  it('показывает цену, старую цену и все фото', async () => {
    const f = await render(prod());
    const el: HTMLElement = f.nativeElement;
    expect(el.textContent).toContain('540 смн');
    expect(el.textContent).toContain('600 смн');
    expect(el.querySelectorAll('[data-test="thumb"]').length).toBe(2);
  });
  it('обещание оплаты наличными стоит под ценой и над кнопками', async () => {
    const f = await render(prod());
    const el: HTMLElement = f.nativeElement;
    const promise = el.querySelector('[data-test="cash-promise"]');
    expect(promise?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Оплата наличными курьеру · без предоплаты · проверяете товар при курьере');
    const price = el.querySelector('.price')!;
    const add = el.querySelector('[data-test="add"]')!;
    expect(price.compareDocumentPosition(promise!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(promise!.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('описание свёрнуто под «Описание из Instagram» и закрыто по умолчанию', async () => {
    const f = await render(prod({ description: 'Строка 1\nСтрока 2' }));
    const d = (f.nativeElement as HTMLElement).querySelector('details.desc') as HTMLDetailsElement;
    expect(d).not.toBeNull();
    expect(d.open).toBe(false);
    expect(d.querySelector('summary')?.textContent?.trim()).toBe('Описание из Instagram');
    expect(d.textContent).toContain('Строка 1\nСтрока 2');
  });
  it.each(['', '   \n '])('пустое описание (%j) — блока нет', async (description) => {
    const f = await render(prod({ description }));
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('details')).toBeNull();
    expect(el.textContent).not.toContain('Описание из Instagram');
  });
  it('несколько вариантов — кнопка недоступна до выбора', async () => {
    const f = await render(prod({ sizes: ['128 ГБ', '256 ГБ'] }));
    const btn: HTMLButtonElement = f.nativeElement.querySelector('[data-test="add"]');
    expect(btn.disabled).toBe(true);
    (f.nativeElement.querySelectorAll('[data-test="size"]')[1] as HTMLButtonElement).click();
    f.detectChanges();
    expect(btn.disabled).toBe(false);
    btn.click();
    expect(TestBed.inject(CartService).items()[0].size).toBe('256 ГБ');
  });
  it('один вариант выбран сам; нет в наличии — кнопка недоступна', async () => {
    const f = await render(prod({ sizes: ['Стандарт'], in_stock: false }));
    const btn: HTMLButtonElement = f.nativeElement.querySelector('[data-test="add"]');
    expect(btn.textContent).toContain('Нет в наличии');
    expect(btn.disabled).toBe(true);
  });
  it('смена id: ответ устаревшего запроса не показывается', async () => {
    const s1 = new Subject<Product>(); const s2 = new Subject<Product>();
    const api = { product: jest.fn((id: string) => (id === '1' ? s1 : s2)), products: jest.fn(() => of([])) };
    await TestBed.configureTestingModule({ imports: [ProductComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    const f = TestBed.createComponent(ProductComponent);
    f.componentRef.setInput('id', '1'); f.detectChanges();
    f.componentRef.setInput('id', '2'); f.detectChanges();
    s2.next(prod({ id: '2', title: 'Второй' })); s2.complete();
    s1.next(prod({ id: '1', title: 'Первый' })); s1.complete();
    f.detectChanges();
    const text = (f.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Второй');
    expect(text).not.toContain('Первый');
  });
  it('500 — не 404, а сообщение об ошибке', async () => {
    const api = { product: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 500 }))), products: jest.fn(() => of([])) };
    await TestBed.configureTestingModule({ imports: [ProductComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    const f = TestBed.createComponent(ProductComponent);
    f.componentRef.setInput('id', '1'); f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.textContent).toContain('Не удалось загрузить');
    expect(el.querySelector('app-not-found')).toBeNull();
  });
  it('404 — страница не найдена', async () => {
    const api = { product: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))), products: jest.fn(() => of([])) };
    await TestBed.configureTestingModule({ imports: [ProductComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    const f = TestBed.createComponent(ProductComponent);
    f.componentRef.setInput('id', '1'); f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('app-not-found')).not.toBeNull();
  });
  it('400 (нечисловой id) — тоже страница не найдена, а не ошибка загрузки', async () => {
    const api = { product: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 400 }))), products: jest.fn(() => of([])) };
    await TestBed.configureTestingModule({ imports: [ProductComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    const f = TestBed.createComponent(ProductComponent);
    f.componentRef.setInput('id', 'abc'); f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('app-not-found')).not.toBeNull();
    expect(el.textContent).not.toContain('Не удалось загрузить');
  });
  it('корзина на лимите 30 строк — «В корзину» не добавляет и показывает сообщение', async () => {
    localStorage.clear();
    const api = { product: jest.fn(() => of(prod({ id: '99' }))), products: jest.fn(() => of([])) };
    await TestBed.configureTestingModule({ imports: [ProductComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    const cart = TestBed.inject(CartService);
    for (let n = 1; n <= 30; n++) cart.add(prod({ id: String(n) }), null);
    const f = TestBed.createComponent(ProductComponent);
    f.componentRef.setInput('id', '99'); f.detectChanges();
    (f.nativeElement.querySelector('[data-test="add"]') as HTMLButtonElement).click();
    f.detectChanges();
    expect(cart.items().length).toBe(30);
    expect(f.nativeElement.textContent).toContain('В корзине уже 30 позиций — оформите заказ или уберите лишнее');
  });
});
