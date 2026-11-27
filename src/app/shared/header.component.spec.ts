import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { HeaderComponent } from './header.component';
import { AuthService } from '../core/auth.service';
import { CartService } from '../core/cart.service';
import { FavoritesService } from '../core/favorites.service';
import { ChatSocket } from '../core/chat-socket.service';
import { Product } from '../core/models';
import { MarketApi } from '../core/market-api.service';
import { EMPTY } from 'rxjs';

const item = (id: string): Product => ({ id, shop_handle: 'a', title: 'T' + id, price: 10, old_price: null, image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '' });

describe('HeaderComponent', () => {
  const unread = signal(0);
  beforeEach(() => { localStorage.clear(); unread.set(0); });

  async function setup() {
    await TestBed.configureTestingModule({ imports: [HeaderComponent], providers: [provideRouter([]), { provide: ChatSocket, useValue: { unreadTotal: unread } }, { provide: MarketApi, useValue: { suggest: () => EMPTY } }] }).compileComponents();
    const f = TestBed.createComponent(HeaderComponent);
    f.detectChanges();
    return f;
  }
  const labels = (el: HTMLElement) => Array.from(el.querySelectorAll('nav a .lbl')).map((n) => n.textContent?.trim());

  it('порядок как в прототипе: «Продавцам», избранное, вход, корзина', async () => {
    const f = await setup();
    expect(labels(f.nativeElement)).toEqual(['Продавцам', 'Избранное', 'Войти', 'Корзина']);
  });

  it('вошедшему — «Профиль» на /me', async () => {
    const f = await setup();
    TestBed.inject(AuthService).setSession({ token: 't', buyer: { id: 1, phone: '931110002', name: null }, is_new: false });
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(labels(el)).toEqual(['Продавцам', 'Избранное', 'Сообщения', 'Профиль', 'Корзина']);
    expect(el.querySelector('a[href="/me"]')).not.toBeNull();
    expect(el.querySelector('a[href="/me/orders"]')).toBeNull();
  });

  it('«Сообщения» только у вошедшего; бейдж — число непрочитанных', async () => {
    const f = await setup();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('a[href="/chats"]')).toBeNull();
    TestBed.inject(AuthService).setSession({ token: 't', buyer: { id: 1, phone: '931110002', name: null }, is_new: false });
    unread.set(3);
    f.detectChanges();
    expect(el.querySelector('.nav a[href="/chats"]')?.textContent).toContain('Сообщения');
    expect(el.querySelector('[data-test="chat-badge"]')?.textContent?.trim()).toBe('3');
    // Телефон: значок «как в Instagram» рядом с логотипом, со своим счётчиком
    const dm = el.querySelector('[data-test="dm-link"]');
    expect(dm?.getAttribute('href')).toBe('/chats');
    expect(dm?.getAttribute('aria-label')).toBe('Сообщения, непрочитанных: 3');
    expect(dm?.querySelector('.dm-badge')?.textContent?.trim()).toBe('3');
    unread.set(0);
    f.detectChanges();
    expect(el.querySelector('[data-test="chat-badge"]')).toBeNull();
    expect(el.querySelector('.dm-badge')).toBeNull();
  });

  it('гостю — «Войти» с иконкой пользователя', async () => {
    const f = await setup();
    expect((f.nativeElement as HTMLElement).querySelector('a[href="/login"] app-icon')).not.toBeNull();
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

  describe('навигация на оформлении заказа', () => {
    @Component({ standalone: true, template: '' }) class Blank {}
    async function at(url: string) {
      await TestBed.configureTestingModule({ imports: [HeaderComponent], providers: [provideRouter([{ path: '**', component: Blank }]), { provide: ChatSocket, useValue: { unreadTotal: unread } }, { provide: MarketApi, useValue: { suggest: () => EMPTY } }] }).compileComponents();
      const f = TestBed.createComponent(HeaderComponent);
      await TestBed.inject(Router).navigateByUrl(url);
      f.detectChanges();
      return f.nativeElement as HTMLElement;
    }
    // Иконки шапки в разметке на всех страницах (на телефоне их прячут стили — там работает нижняя панель)
    it.each(['/checkout', '/checkout?x=1', '/cart'])('на %s навигация стоит в шапке', async (url) => {
      const el = await at(url);
      const nav = el.querySelector('header nav')!;
      expect(nav).not.toBeNull();
      expect(nav.querySelector('a[href="/cart"]')).not.toBeNull();
      expect(el.querySelectorAll('nav').length).toBe(1);
    });
  });

  describe('скрытие при прокрутке', () => {
    afterEach(() => {
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
      jest.restoreAllMocks();
    });

    it('в первом кадре (и на сервере) шапка видна', async () => {
      const f = await setup();
      expect(f.componentInstance.hidden()).toBe(false);
      expect((f.nativeElement as HTMLElement).querySelector('header')!.classList).not.toContain('hdr--up');
    });

    it('вниз — прячется, вверх — возвращается; фокус в поиске держит шапку на месте', async () => {
      const frames: FrameRequestCallback[] = [];
      jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { frames.push(cb); return frames.length; });
      const f = await setup();
      await f.whenStable();
      const scrollTo = (y: number) => {
        Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
        window.dispatchEvent(new Event('scroll'));
        frames.splice(0).forEach((cb) => cb(0));
        f.detectChanges();
      };
      const header = () => (f.nativeElement as HTMLElement).querySelector('header')!;
      scrollTo(400);
      expect(header().classList).toContain('hdr--up');
      scrollTo(300);
      expect(header().classList).not.toContain('hdr--up');
      scrollTo(700);
      expect(header().classList).toContain('hdr--up');
      header().querySelector('input')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      f.detectChanges();
      expect(header().classList).not.toContain('hdr--up');
      scrollTo(1200);
      expect(header().classList).not.toContain('hdr--up');
    });
  });

  describe('«Подешевело»', () => {
    it('есть непросмотренное снижение — точка у сердечка и подпись для скринридера', async () => {
      localStorage.setItem('harid.fav', JSON.stringify(['1'])); localStorage.setItem('harid.fav.prices', JSON.stringify({ '1': { base: 300, now: 250, stock: true } }));
      const f = await setup();
      TestBed.inject(FavoritesService).hydrate();
      f.detectChanges();
      const a = (f.nativeElement as HTMLElement).querySelector('a[href="/favorites"]')!;
      expect(a.querySelector('[data-test="fav-drop-dot"]')).not.toBeNull();
      expect(a.getAttribute('aria-label')).toBe('Избранное, есть подешевевшие товары');
    });
    it('снижения нет или уже видели — ни точки, ни подписи', async () => {
      localStorage.setItem('harid.fav', JSON.stringify(['1'])); localStorage.setItem('harid.fav.prices', JSON.stringify({ '1': { base: 300, now: 250, stock: true } }));
      const f = await setup();
      const fav = TestBed.inject(FavoritesService);
      fav.hydrate();
      fav.markSeen(['1']);
      f.detectChanges();
      const a = (f.nativeElement as HTMLElement).querySelector('a[href="/favorites"]')!;
      expect(a.querySelector('[data-test="fav-drop-dot"]')).toBeNull();
      expect(a.hasAttribute('aria-label')).toBe(false);
    });
  });
});
