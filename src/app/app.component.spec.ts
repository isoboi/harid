import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app.component';
import { CartService } from './core/cart.service';
import { Product } from './core/models';

describe('AppComponent', () => {
  beforeEach(() => localStorage.clear());

  it('рисует шапку с навигацией и подвал', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
    const f = TestBed.createComponent(AppComponent);
    f.detectChanges();
    const text = f.nativeElement.textContent as string;
    for (const s of ['Харид', 'Продавцам', 'Избранное', 'Войти', 'Корзина', 'Покупателям']) {
      expect(text).toContain(s);
    }
  });

  it('после первого рендера загружает корзину из хранилища', async () => {
    const p = { id: '1', shop_handle: 'a', title: 'T', price: 100, old_price: null, image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '' } as Product;
    localStorage.setItem('harid.cart', JSON.stringify([{ product: p, size: null, qty: 3 }]));
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
    const f = TestBed.createComponent(AppComponent);
    expect(TestBed.inject(CartService).count()).toBe(0);
    f.detectChanges();
    await f.whenStable();
    expect(TestBed.inject(CartService).count()).toBe(3);
  });
});
