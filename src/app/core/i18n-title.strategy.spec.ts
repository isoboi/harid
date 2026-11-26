import { Component, PLATFORM_ID, REQUEST } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { LANG_DICT } from './i18n';
import { I18nTitleStrategy } from './i18n-title.strategy';

@Component({ standalone: true, template: '' })
class Page {}

const req = (cookie: string) => ({ headers: { get: (k: string) => (k === 'cookie' ? cookie : null) } });

async function go(cookie: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'cart', title: 'Корзина — Харид', component: Page }]),
      { provide: TitleStrategy, useClass: I18nTitleStrategy },
      { provide: PLATFORM_ID, useValue: 'server' },
      { provide: REQUEST, useValue: req(cookie) },
      { provide: LANG_DICT, useValue: { 'Корзина — Харид': 'Сабад — Харид' } },
    ],
  });
  await TestBed.inject(Router).navigateByUrl('/cart');
  return TestBed.inject(Title).getTitle();
}

describe('I18nTitleStrategy', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('заголовок вкладки из роута — на выбранном языке', async () => {
    expect(await go('lang=tg')).toBe('Сабад — Харид');
  });
  it('по-русски — как в роуте', async () => {
    expect(await go('')).toBe('Корзина — Харид');
  });
});
