import { Component, inject, PLATFORM_ID, REQUEST } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { I18n, LANG_COOKIE, langFromCookie, LANG_DICT, RU, TPipe, translate } from './i18n';

describe('langFromCookie', () => {
  it('tg — только при lang=tg; всё остальное и пусто — русский', () => {
    expect(langFromCookie('lang=tg')).toBe('tg');
    expect(langFromCookie('a=1; lang=tg; b=2')).toBe('tg');
    expect(langFromCookie('lang=ru')).toBe('ru');
    expect(langFromCookie('lang=en')).toBe('ru');
    expect(langFromCookie('xlang=tg')).toBe('ru');
    expect(langFromCookie('')).toBe('ru');
    expect(langFromCookie(null)).toBe('ru');
  });
});

describe('translate', () => {
  const dict = { 'Корзина': 'Сабад', 'В корзине {n} шт.': 'Дар сабад {n} адад' };
  it('есть перевод — перевод; нет — исходный русский текст', () => {
    expect(translate(dict, 'Корзина')).toBe('Сабад');
    expect(translate(dict, 'Избранное')).toBe('Избранное');
  });
  it('подставляет {параметры} и в переводе, и в русском тексте без перевода', () => {
    expect(translate(dict, 'В корзине {n} шт.', { n: 3 })).toBe('Дар сабад 3 адад');
    expect(translate(null, 'В корзине {n} шт.', { n: 3 })).toBe('В корзине 3 шт.');
    expect(translate(dict, 'Нет {x}', {})).toBe('Нет {x}');
  });
  it('контекст: сначала «контекст|текст», нет такого — обычный перевод, нет и его — русский', () => {
    const d = { 'Избранное': 'Интихобшудаҳо', 'tab|Избранное': 'Интихобҳо', 'tab|Мест {n}': '{n} ҷой' };
    expect(translate(d, 'Избранное', undefined, 'tab')).toBe('Интихобҳо');
    expect(translate(d, 'Избранное')).toBe('Интихобшудаҳо');
    expect(translate({ 'Корзина': 'Сабад' }, 'Корзина', undefined, 'tab')).toBe('Сабад');
    expect(translate(null, 'Избранное', undefined, 'tab')).toBe('Избранное');
    expect(translate(d, 'Мест {n}', { n: 2 }, 'tab')).toBe('2 ҷой');
  });
});

/** В jsdom нет Request: SSR-запрос — только с заголовками. */
const req = (cookie: string) => ({ headers: { get: (k: string) => (k === 'cookie' ? cookie : null) } });

function setup(cookie: string | null, platform: 'browser' | 'server' = 'server') {
  const providers: unknown[] = [{ provide: PLATFORM_ID, useValue: platform }, { provide: LANG_DICT, useValue: { 'Корзина': 'Сабад', 'товар': 'мол' } }];
  if (cookie !== null) providers.push({ provide: REQUEST, useValue: req(cookie) });
  TestBed.configureTestingModule({ providers: providers as never[] });
  return TestBed.inject(I18n);
}

describe('I18n', () => {
  afterEach(() => { TestBed.resetTestingModule(); document.cookie = `${LANG_COOKIE}=; path=/; max-age=0`; });

  it('на сервере язык — из cookie запроса', () => {
    expect(setup('lang=tg').lang).toBe('tg');
    TestBed.resetTestingModule();
    expect(setup('').lang).toBe('ru');
  });
  it('в браузере язык — из document.cookie', () => {
    document.cookie = `${LANG_COOKIE}=tg; path=/`;
    expect(setup(null, 'browser').lang).toBe('tg');
  });
  it('t: по-таджикски — из словаря, по-русски — как есть', () => {
    expect(setup('lang=tg').t('Корзина')).toBe('Сабад');
    TestBed.resetTestingModule();
    expect(setup('').t('Корзина')).toBe('Корзина');
  });
  it('ставит <html lang> под язык', () => {
    setup('lang=tg');
    expect(TestBed.inject(DOCUMENT).documentElement.lang).toBe('tg');
    TestBed.resetTestingModule();
    setup('');
    expect(TestBed.inject(DOCUMENT).documentElement.lang).toBe('ru');
  });
  it('plural: по-русски склоняет, по-таджикски после числа — единственное число из словаря', () => {
    const forms: [string, string, string] = ['товар', 'товара', 'товаров'];
    const ru = setup('');
    expect([ru.plural(1, forms), ru.plural(3, forms), ru.plural(5, forms)]).toEqual(['товар', 'товара', 'товаров']);
    TestBed.resetTestingModule();
    const tg = setup('lang=tg');
    expect([tg.plural(1, forms), tg.plural(3, forms), tg.plural(5, forms)]).toEqual(['мол', 'мол', 'мол']);
  });
  it('locale для Intl: ru-RU или tg-TJ', () => {
    expect(setup('').locale).toBe('ru-RU');
    TestBed.resetTestingModule();
    expect(setup('lang=tg').locale).toBe('tg-TJ');
  });
  it('setLang: пишет cookie на год и перезагружает страницу', () => {
    const i18n = setup(null, 'browser');
    const reload = jest.fn();
    (i18n as unknown as { reload: () => void }).reload = reload;
    i18n.setLang('tg');
    expect(document.cookie).toContain('lang=tg');
    expect(reload).toHaveBeenCalled();
  });
  it('setLang на тот же язык — ничего не делает', () => {
    const i18n = setup(null, 'browser');
    const reload = jest.fn();
    (i18n as unknown as { reload: () => void }).reload = reload;
    i18n.setLang('ru');
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('TPipe', () => {
  @Component({ standalone: true, imports: [TPipe], template: `<p>{{ 'Корзина' | t }}</p><i>{{ 'Нет {x}' | t: { x: 'мол' } }}</i><b>{{ 'Избранное' | t: null : 'tab' }}</b>` })
  class Host { readonly i18n = inject(I18n); }
  it('переводит в шаблоне, подставляет параметры и учитывает контекст', () => {
    TestBed.configureTestingModule({ imports: [Host], providers: [{ provide: REQUEST, useValue: req('lang=tg') }, { provide: PLATFORM_ID, useValue: 'server' }, { provide: LANG_DICT, useValue: { 'Корзина': 'Сабад', 'Нет {x}': '{x} нест', 'Избранное': 'Интихобшудаҳо', 'tab|Избранное': 'Интихобҳо' } }] });
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    expect(f.nativeElement.querySelector('p').textContent).toBe('Сабад');
    expect(f.nativeElement.querySelector('i').textContent).toBe('мол нест');
    expect(f.nativeElement.querySelector('b').textContent).toBe('Интихобҳо');
  });
});

describe('RU (перевод по умолчанию для чистых функций)', () => {
  it('t оставляет русский и подставляет параметры, plural склоняет, locale ru-RU', () => {
    expect(RU.t('Нет {x}', { x: 'мест' })).toBe('Нет мест');
    expect(RU.plural(3, ['лавка', 'лавки', 'лавок'])).toBe('лавки');
    expect(RU.locale).toBe('ru-RU');
    expect(RU.lang).toBe('ru');
  });
});
