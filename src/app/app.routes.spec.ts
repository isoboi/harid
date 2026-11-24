import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SeoService } from './core/seo.service';
import { routes } from './app.routes';

@Component({ standalone: true, template: '' })
class ShopStub { constructor() { inject(SeoService).set({ title: '@lola — Харид', description: '' }); } }
@Component({ standalone: true, template: '' })
class SellStub {}

describe('app.routes — заголовки вкладки', () => {
  const titleOf = (path: string) => routes.find((r) => r.path === path)?.title;

  it('страницы без SeoService.set() задают свой title, а не оставляют заголовок прошлой', () => {
    for (const path of ['cart', 'checkout', 'order/:number', 'login', 'me/orders', 'favorites', 'sell', 'chats', 'chats/new', 'chats/:id', '**']) {
      expect(typeof titleOf(path)).toBe('string');
      expect(titleOf(path)).toMatch(/Харид/);
    }
  });

  it('публичным страницам title не задан: заголовок ставит SeoService, роутер его не перезаписывает', () => {
    for (const path of ['', 'catalog', 'c/:slug', 'search', 'shop/:handle', 'product/:id']) {
      expect(titleOf(path)).toBeUndefined();
    }
  });

  it('переход лавка → /sell → лавка: заголовок вкладки каждый раз свой', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([
      { path: 'shop/:handle', component: ShopStub },
      { path: 'sell', title: titleOf('sell'), component: SellStub },
    ])] });
    const harness = await RouterTestingHarness.create('/shop/lola');
    const title = TestBed.inject(Title);
    expect(title.getTitle()).toBe('@lola — Харид');
    await harness.navigateByUrl('/sell');
    expect(title.getTitle()).toBe('Открыть лавку на Хариде');
    await harness.navigateByUrl('/shop/lola');
    expect(title.getTitle()).toBe('@lola — Харид');
  });
});
