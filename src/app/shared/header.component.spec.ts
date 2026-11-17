import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { HeaderComponent } from './header.component';
import { AuthService } from '../core/auth.service';
import { CartService } from '../core/cart.service';
import { Product } from '../core/models';

const item = (id: string): Product => ({ id, shop_handle: 'a', title: 'T' + id, price: 10, old_price: null, image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '' });

describe('HeaderComponent', () => {
  beforeEach(() => localStorage.clear());

  async function setup() {
    await TestBed.configureTestingModule({ imports: [HeaderComponent], providers: [provideRouter([])] }).compileComponents();
    const f = TestBed.createComponent(HeaderComponent);
    f.detectChanges();
    return f;
  }
  const labels = (el: HTMLElement) => Array.from(el.querySelectorAll('nav a .lbl')).map((n) => n.textContent?.trim());

  it('порядок: сначала покупательские ссылки, «Продавцам» последним', async () => {
    const f = await setup();
    expect(labels(f.nativeElement)).toEqual(['Избранное', 'Войти', 'Корзина', 'Продавцам']);
  });

  it('вошедшему — «Мои заказы» с иконкой коробки', async () => {
    const f = await setup();
    TestBed.inject(AuthService).setSession({ token: 't', buyer: { id: 1, phone: '931110002', name: null }, is_new: false });
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(labels(el)).toEqual(['Избранное', 'Мои заказы', 'Корзина', 'Продавцам']);
    // путь «M12 22V12» есть только у иконки package
    expect(el.querySelector('a[href="/me/orders"] svg path[d="M12 22V12"]')).not.toBeNull();
    expect(f.componentInstance.ordersIcon()).toBe('package');
  });

  it('гостю — «Войти» с иконкой пользователя', async () => {
    const f = await setup();
    expect(f.componentInstance.ordersIcon()).toBe('user');
  });

  it('бейдж корзины: точное число до 99', async () => {
    const f = await setup();
    const cart = TestBed.inject(CartService);
    for (let i = 0; i < 4; i++) cart.add(item(String(i)), null, 20);
    cart.add(item('9'), null, 19);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('.badge')?.textContent?.trim()).toBe('99');
  });

  it('бейдж корзины: больше 99 — «99+»', async () => {
    const f = await setup();
    const cart = TestBed.inject(CartService);
    for (let i = 0; i < 6; i++) cart.add(item(String(i)), null, 20);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('.badge')?.textContent?.trim()).toBe('99+');
  });

  it('пустая корзина — без бейджа', async () => {
    const f = await setup();
    expect((f.nativeElement as HTMLElement).querySelector('.badge')).toBeNull();
  });

  describe('нижняя панель на оформлении заказа', () => {
    @Component({ standalone: true, template: '' }) class Blank {}
    async function at(url: string) {
      await TestBed.configureTestingModule({ imports: [HeaderComponent], providers: [provideRouter([{ path: '**', component: Blank }])] }).compileComponents();
      const f = TestBed.createComponent(HeaderComponent);
      await TestBed.inject(Router).navigateByUrl(url);
      f.detectChanges();
      return (f.nativeElement as HTMLElement).querySelector('nav')!;
    }
    it('на /checkout навигация получает nav--hidden', async () => {
      expect((await at('/checkout')).classList).toContain('nav--hidden');
    });
    it('на /checkout с query — тоже скрыта', async () => {
      expect((await at('/checkout?x=1')).classList).toContain('nav--hidden');
    });
    it.each(['/cart', '/checkout-help'])('на %s навигация видна', async (url) => {
      expect((await at(url)).classList).not.toContain('nav--hidden');
    });
  });
});
