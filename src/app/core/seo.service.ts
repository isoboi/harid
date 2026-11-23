import { DOCUMENT } from '@angular/common';
import { inject, Injectable, REQUEST } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../environments/environment';
import { siteOrigin } from './site-url';
import { CURRENCY, jsonLdString } from './structured-data';

export interface SeoInput {
  title: string;
  description: string;
  image?: string;
  /** Путь страницы без query, например «/product/5»: из него и адреса сайта строятся canonical и og:url. */
  path?: string;
  /** «product» — карточка товара (og:type и цена для превью); по умолчанию «website». */
  type?: 'website' | 'product';
  /** Цена товара в смн — для превью ссылки; null или без значения — не выводим. */
  price?: number | null;
  /** Структурированные данные страницы; адрес сайта подставляется сервисом. */
  jsonLd?: (origin: string) => Record<string, unknown>;
}

/**
 * Заголовок, Open Graph (превью ссылок в Telegram/Instagram/WhatsApp), canonical и JSON-LD для поиска.
 * Каждый вызов задаёт все теги заново: при переходе между страницами ничего не остаётся от предыдущей
 * (фото, canonical и разметка товара не «прилипают» к главной).
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private readonly request = inject(REQUEST, { optional: true });

  /**
   * Адрес сайта. На сервере — из запроса (боевой домен нигде не зашит), в браузере — из адресной строки.
   * Пустая строка — адрес неизвестен: canonical и разметка пропускаются, а не выводятся с относительными ссылками.
   */
  origin(): string {
    const req = this.request;
    if (req) return siteOrigin(req.url, { forwardedProto: req.headers.get('x-forwarded-proto'), production: environment.production });
    return this.doc.location?.origin ?? '';
  }

  set(p: SeoInput): void {
    const origin = this.origin();
    const url = p.path && origin ? origin + p.path : '';
    this.title.setTitle(p.title);
    this.tag('name', 'description', p.description);
    this.tag('property', 'og:title', p.title);
    this.tag('property', 'og:description', p.description);
    this.tag('property', 'og:type', p.type ?? 'website');
    this.tag('property', 'og:site_name', 'Харид');
    this.tag('property', 'og:locale', 'ru_RU');
    this.tag('property', 'og:url', url);
    this.tag('property', 'og:image', p.image);
    this.tag('name', 'twitter:card', p.image ? 'summary_large_image' : 'summary');
    const priced = p.type === 'product' && p.price != null;
    this.tag('property', 'product:price:amount', priced ? String(p.price) : undefined);
    this.tag('property', 'product:price:currency', priced ? CURRENCY : undefined);
    this.canonical(url);
    this.jsonLd(p.jsonLd && origin ? p.jsonLd(origin) : null);
  }

  /** Тег с содержимым — обновить, без содержимого — убрать (чтобы не осталось значения прошлой страницы). */
  private tag(attr: 'name' | 'property', key: string, content?: string): void {
    if (content) this.meta.updateTag({ [attr]: key, content });
    else this.meta.removeTag(`${attr}="${key}"`);
  }

  private canonical(url: string): void {
    const head = this.doc.head;
    let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!url) { link?.remove(); return; }
    if (!link) { link = this.doc.createElement('link'); link.setAttribute('rel', 'canonical'); head.appendChild(link); }
    link.setAttribute('href', url);
  }

  private jsonLd(data: Record<string, unknown> | null): void {
    const head = this.doc.head;
    head.querySelectorAll('script[data-seo-ld]').forEach((n) => n.remove());
    if (!data) return;
    const script = this.doc.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute('data-seo-ld', '');
    script.textContent = jsonLdString(data);
    head.appendChild(script);
  }
}
