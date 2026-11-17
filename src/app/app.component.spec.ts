import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
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

  it('в шапке 4 иконки в навигации и 1 в поиске', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
    const f = TestBed.createComponent(AppComponent);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelectorAll('nav svg').length).toBe(4);
    expect(el.querySelectorAll('form.search svg').length).toBe(1);
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

  it('на /checkout без отступа под нижнюю панель, на других страницах — с ним', async () => {
    @Component({ standalone: true, template: '' }) class Blank {}
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([{ path: '**', component: Blank }]), provideHttpClient()],
    }).compileComponents();
    const f = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/checkout');
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).classList).toContain('no-tabbar');
    await router.navigateByUrl('/cart');
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).classList).not.toContain('no-tabbar');
  });
});
