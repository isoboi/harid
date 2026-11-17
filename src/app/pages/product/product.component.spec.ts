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
});
