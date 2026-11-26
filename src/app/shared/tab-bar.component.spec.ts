import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { TabBarComponent, isChatThread, pathOf } from './tab-bar.component';
import { AuthService } from '../core/auth.service';
import { CartService } from '../core/cart.service';
import { Product } from '../core/models';

const item = (id: string): Product => ({ id, shop_handle: 'a', title: 'T' + id, price: 10, old_price: null, image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '' });

@Component({ standalone: true, template: '' }) class Blank {}

describe('TabBarComponent', () => {
  beforeEach(() => localStorage.clear());

  async function at(url = '/') {
    await TestBed.configureTestingModule({ imports: [TabBarComponent], providers: [provideRouter([{ path: '**', component: Blank }])] }).compileComponents();
    const f = TestBed.createComponent(TabBarComponent);
    await TestBed.inject(Router).navigateByUrl(url);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    return f;
  }
  const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
  const labels = (root: HTMLElement) => Array.from(root.querySelectorAll('.tab .lbl')).map((n) => n.textContent?.trim());
  const active = (root: HTMLElement) => Array.from(root.querySelectorAll('.tab.on')).map((a) => a.getAttribute('href'));

  it('пять вкладок по порядку, nav с подписью «Основная навигация»', async () => {
    const root = el(await at('/'));
    expect(root.querySelector('nav')?.getAttribute('aria-label')).toBe('Основная навигация');
    expect(labels(root)).toEqual(['Главная', 'Каталог', 'Избранное', 'Корзина', 'Войти']);
    expect(Array.from(root.querySelectorAll('.tab')).map((a) => a.getAttribute('href'))).toEqual(['/', '/catalog', '/favorites', '/cart', '/login']);
  });

  it('на главной активна только «Главная» (точное совпадение) и помечена aria-current', async () => {
    const root = el(await at('/'));
    expect(active(root)).toEqual(['/']);
    expect(root.querySelector('a[href="/"]')?.getAttribute('aria-current')).toBe('page');
    expect(root.querySelectorAll('[aria-current]').length).toBe(1);
  });

  it.each([
    ['/favorites', '/favorites'],
    ['/cart', '/cart'],
    ['/catalog', '/catalog'],
    ['/c/odezhda', '/catalog'],
    ['/login', '/login'],
  ])('на %s активна вкладка %s', async (url, href) => {
    const root = el(await at(url));
    expect(active(root)).toEqual([href]);
    expect(root.querySelector(`a[href="${href}"]`)?.getAttribute('aria-current')).toBe('page');
  });

  it('вошедшему — «Профиль» на /me вместо «Войти»; вкладок по-прежнему пять', async () => {
    const f = await at('/');
    TestBed.inject(AuthService).setSession({ token: 't', buyer: { id: 1, phone: '931110002', name: null }, is_new: false });
    f.detectChanges();
    expect(labels(el(f))).toEqual(['Главная', 'Каталог', 'Избранное', 'Корзина', 'Профиль']);
    expect(el(f).querySelector('a[href="/me"]')).not.toBeNull();
    expect(el(f).querySelector('a[href="/login"]')).toBeNull();
    // «Сообщения» — значок в шапке, не вкладка
    expect(el(f).querySelector('a[href="/chats"]')).toBeNull();
  });

  it.each(['/me', '/me/orders'])('«Профиль» горит на %s', async (url) => {
    const f = await at(url);
    TestBed.inject(AuthService).setSession({ token: 't', buyer: { id: 1, phone: '931110002', name: null }, is_new: false });
    f.detectChanges();
    expect(active(el(f))).toEqual(['/me']);
    expect(el(f).querySelector('a[href="/me"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('в открытой переписке панели нет — снизу поле сообщения', async () => {
    expect(el(await at('/chats/5')).querySelector('.tabbar')).toBeNull();
  });

  it('isChatThread: только /chats/<id>', () => {
    expect(isChatThread('/chats/12')).toBe(true);
    expect(isChatThread('/chats')).toBe(false);
    expect(isChatThread('/chats/new')).toBe(false);
  });

  it('бейдж корзины: число, «99+» и подпись для скринридера', async () => {
    const f = await at('/');
    expect(el(f).querySelector('.badge')).toBeNull();
    const cart = TestBed.inject(CartService);
    cart.add(item('1'), null, 3);
    f.detectChanges();
    expect(el(f).querySelector('.badge')?.textContent?.trim()).toBe('3');
    expect(el(f).querySelector('.badge')?.getAttribute('aria-hidden')).toBe('true');
    expect(el(f).querySelector('a[href="/cart"]')?.getAttribute('aria-label')).toBe('Корзина, товаров: 3');
    for (let i = 2; i < 8; i++) cart.add(item(String(i)), null, 20);
    f.detectChanges();
    expect(el(f).querySelector('.badge')?.textContent?.trim()).toBe('99+');
  });

  it.each(['/checkout', '/checkout?step=2'])('на %s панели нет — кнопку «Заказать» ничто не перекрывает', async (url) => {
    const root = el(await at(url));
    expect(root.querySelector('nav')).toBeNull();
  });

  it('pathOf отбрасывает query и якорь', () => {
    expect(pathOf('/checkout?x=1#a')).toBe('/checkout');
    expect(pathOf('')).toBe('/');
  });
});
