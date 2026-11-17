import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProductCardComponent } from './product-card.component';

describe('ProductCardComponent', () => {
  it('ссылка на товар, цена и @лавка', async () => {
    await TestBed.configureTestingModule({ imports: [ProductCardComponent], providers: [provideRouter([])] }).compileComponents();
    const f = TestBed.createComponent(ProductCardComponent);
    f.componentRef.setInput('product', { id: '16', shop_handle: 'technomir.tj', title: 'Наушники', price: 1250, old_price: null, image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '' });
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/product/16');
    expect(el.textContent).toContain('1 250 смн');
    expect(el.textContent).toContain('@technomir.tj');
    expect(el.querySelector('[data-test="cod"]')?.textContent?.trim()).toBe('Оплата при получении');
  });
});
