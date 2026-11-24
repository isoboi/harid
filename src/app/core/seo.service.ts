import { DOCUMENT } from '@angular/common';
import { inject, Injectable, REQUEST_CONTEXT } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { JsonLd } from './structured-data';

export interface SeoPage {
  title: string;
  description: string;
  image?: string;
  /** product — страница товара; остальное — website. */
  type?: 'website' | 'product';
  /** Разметка schema.org; без неё прежняя разметка со страницы убирается. */
  jsonLd?: JsonLd | JsonLd[];
  /** Страница не для выдачи (поиск): ссылки с неё поисковик всё равно обходит. */
  noindex?: boolean;
}

/** Контекст запроса, который SSR-сервер передаёт в приложение (src/server.ts). */
export interface SeoRequestContext { origin?: string }

const JSON_LD_ID = 'seo-json-ld';

/**
 * Заголовок, Open Graph и Twitter — для превью ссылок в Telegram/Instagram;
 * canonical и JSON-LD — для поисковиков.
 * canonical и og:url — текущий путь без query: фильтры категории не плодят дубли страниц.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly ctx = inject(REQUEST_CONTEXT, { optional: true }) as SeoRequestContext | null;

  /**
   * Адрес витрины без «/» в конце. На сервере — из контекста запроса
   * (SITE_URL или Host за прокси), в браузере — из адресной строки.
   */
  origin(): string {
    return (this.ctx?.origin || this.doc.location?.origin || '').replace(/\/+$/, '');
  }

  set(p: SeoPage): void {
    const url = this.origin() + this.currentPath();
    this.title.setTitle(p.title);
    this.meta.updateTag({ name: 'description', content: p.description });
    this.meta.updateTag({ property: 'og:site_name', content: 'Харид' });
    this.meta.updateTag({ property: 'og:locale', content: 'ru_RU' });
    this.meta.updateTag({ property: 'og:title', content: p.title });
    this.meta.updateTag({ property: 'og:description', content: p.description });
    this.meta.updateTag({ property: 'og:type', content: p.type ?? 'website' });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ name: 'twitter:card', content: p.image ? 'summary_large_image' : 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: p.title });
    this.meta.updateTag({ name: 'twitter:description', content: p.description });
    // Фото прошлой страницы не должно уехать в превью следующей
    if (p.image) {
      this.meta.updateTag({ property: 'og:image', content: p.image });
      this.meta.updateTag({ name: 'twitter:image', content: p.image });
    } else {
      this.meta.removeTag('property="og:image"');
      this.meta.removeTag('name="twitter:image"');
    }
    if (p.noindex) this.meta.updateTag({ name: 'robots', content: 'noindex, follow' });
    else this.meta.removeTag('name="robots"');
    this.setCanonical(url);
    this.setJsonLd(p.jsonLd);
  }

  /** Путь страницы, которую сейчас открывают (во время перехода router.url ещё старый). */
  private currentPath(): string {
    const tree = this.router.getCurrentNavigation()?.finalUrl ?? this.router.parseUrl(this.router.url);
    return this.router.serializeUrl(tree).split(/[?#]/)[0] || '/';
  }

  private setCanonical(url: string): void {
    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private setJsonLd(data: JsonLd | JsonLd[] | undefined): void {
    this.doc.getElementById(JSON_LD_ID)?.remove();
    if (!data) return;
    const script = this.doc.createElement('script');
    script.id = JSON_LD_ID;
    script.setAttribute('type', 'application/ld+json');
    // «<» экранируется: текст лавки с «</script>» не закроет тег раньше времени
    script.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
    this.doc.head.appendChild(script);
  }
}
