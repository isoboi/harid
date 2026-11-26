import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, InjectionToken, Pipe, PipeTransform, PLATFORM_ID, provideAppInitializer, REQUEST } from '@angular/core';
import { plural as ruPlural } from '../shared/plural';

/**
 * Языки витрины. Русский — исходный: текст в шаблонах пишется по-русски, он же ключ словаря.
 * Таджикский — словарь src/app/i18n/tg (грузится отдельным чанком, только если выбран тоҷикӣ).
 */
export type Lang = 'ru' | 'tg';
export type Dict = Readonly<Record<string, string>>;
export type TParams = Readonly<Record<string, string | number>>;

/** Cookie с выбранным языком: её читает и SSR (страница сразу на нужном языке), и браузер. */
export const LANG_COOKIE = 'lang';
const YEAR_S = 365 * 24 * 60 * 60;

/** Словарь вместо загружаемого чанка — для тестов. */
export const LANG_DICT = new InjectionToken<Dict>('LANG_DICT');

/** tg — только при явном lang=tg; любой другой или пустой cookie — русский. */
export function langFromCookie(cookie: string | null | undefined): Lang {
  for (const part of (cookie ?? '').split(';')) {
    const [k, v] = part.trim().split('=');
    if (k === LANG_COOKIE) return v === 'tg' ? 'tg' : 'ru';
  }
  return 'ru';
}

/** Перевод по словарю (нет перевода — исходный текст) и подстановка {параметров}; неизвестный {x} остаётся как есть. */
export function translate(dict: Dict | null, text: string, params?: TParams): string {
  const s = dict?.[text] ?? text;
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/**
 * Язык страницы выбирается один раз на запуск приложения: смена языка — перезагрузка страницы
 * (адрес тот же). Поэтому пайп t чистый, а сервисы и функции могут переводить в момент вызова.
 */
@Injectable({ providedIn: 'root' })
export class I18n {
  private readonly doc = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private dict: Dict | null = inject(LANG_DICT, { optional: true });
  readonly lang: Lang;
  /** Для Intl.DateTimeFormat и toLocale*. */
  readonly locale: string;
  private reload = () => this.doc.defaultView?.location.reload();

  constructor() {
    const request = inject(REQUEST, { optional: true });
    const cookie = this.browser ? this.doc.cookie : request?.headers.get('cookie');
    this.lang = langFromCookie(cookie);
    this.locale = this.lang === 'tg' ? 'tg-TJ' : 'ru-RU';
    this.doc.documentElement.lang = this.lang;
  }

  get needsDict(): boolean { return this.lang === 'tg' && !this.dict; }
  useDict(dict: Dict): void { this.dict = dict; }

  t(text: string, params?: TParams): string {
    return translate(this.lang === 'tg' ? this.dict : null, text, params);
  }

  /**
   * Слово при числе. По-таджикски после числа существительное в единственном числе («5 мол»),
   * поэтому переводится первая форма; по-русски — обычное склонение.
   */
  plural(n: number, forms: [string, string, string]): string {
    return this.lang === 'tg' ? this.t(forms[0]) : ruPlural(n, forms);
  }

  /** Запомнить язык на год и перерисовать текущую страницу на нём. */
  setLang(lang: Lang): void {
    if (!this.browser || lang === this.lang) return;
    this.doc.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=${YEAR_S}; SameSite=Lax`;
    this.reload();
  }
}

/**
 * Что нужно чистой функции, которая возвращает текст для покупателя (followersCount, ratingLabel…):
 * последним параметром `i18n: I18nLike = RU`, вызывающий компонент передаёт inject(I18n).
 */
export type I18nLike = Pick<I18n, 'lang' | 'locale' | 't' | 'plural'>;

/** Русский без DI — значение по умолчанию для I18nLike в чистых функциях и тестах. */
export const RU: I18nLike = {
  lang: 'ru',
  locale: 'ru-RU',
  t: (text, params) => translate(null, text, params),
  plural: (n, forms) => ruPlural(n, forms),
};

/** Таджикский словарь — до первого рендера (и на сервере, и до гидратации), иначе страница мигнёт русским. */
export const provideI18n = () =>
  provideAppInitializer(async () => {
    const i18n = inject(I18n);
    if (i18n.needsDict) i18n.useDict((await import('../i18n/tg')).TG);
  });

/** {{ 'Корзина' | t }}, {{ 'В корзине {n}' | t: { n: count } }}. */
@Pipe({ name: 't', standalone: true })
export class TPipe implements PipeTransform {
  private readonly i18n = inject(I18n);
  transform(text: string, params?: TParams): string { return this.i18n.t(text, params); }
}
