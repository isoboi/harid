import { DOCUMENT } from '@angular/common';
import { inject, Injectable, makeStateKey, REQUEST_CONTEXT, TransferState } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, NavigationStart, Params, Router, UrlTree } from '@angular/router';
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
  /**
   * Параметры адреса, без которых страница другая (q поиска, вкладка лавки):
   * они остаются в canonical и og:url, остальной query отбрасывается.
   */
  keepParams?: string[];
}

/** Контекст запроса, который SSR-сервер передаёт в приложение (src/server.ts). */
export interface SeoRequestContext { origin?: string }

const JSON_LD_ID = 'seo-json-ld';
/** Адрес сайта, с которым рендерил сервер: браузер берёт его, а не свой Host (www, IP). */
const ORIGIN_KEY = makeStateKey<string>('seo-origin');
/** Теги в <head> поставил сервер, а не страница в этом браузере (путь так не выглядит: он с «/»). */
const FROM_SERVER = 'server';

/**
 * Заголовок, Open Graph и Twitter — для превью ссылок в Telegram/Instagram;
 * canonical и JSON-LD — для поисковиков.
 * canonical и og:url — текущий путь без query (кроме keepParams): фильтры категории не плодят дубли страниц.
 * При переходе на другую страницу canonical, og:url, JSON-LD и robots прошлой убираются,
 * даже если новая страница set() не вызывает (корзина, «не найдено»).
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly state = inject(TransferState);
  private readonly ctx = inject(REQUEST_CONTEXT, { optional: true }) as SeoRequestContext | null;
  /** Путь страницы, чьи теги сейчас в <head>; null — тегов страницы нет. */
  private owner: string | null = null;
  private keep: string[] = [];

  constructor() {
    const serverOrigin = this.trimSlash(this.ctx?.origin ?? '');
    if (serverOrigin) this.state.set(ORIGIN_KEY, serverOrigin);
    else if (this.doc.head.querySelector('link[rel="canonical"]')) this.owner = FROM_SERVER;
    this.router.events.subscribe((e) => {
      // Первый переход открывает ту же страницу, что отрисовал сервер, — её теги верные
      if (e instanceof NavigationStart && e.id > 1 && this.owner !== null && this.pathOf(this.router.parseUrl(e.url)) !== this.owner) {
        this.clear();
      }
      // Сменился только query (вкладка лавки, запрос поиска) — адрес страницы следом за ним
      if (e instanceof NavigationEnd && this.owner !== null) {
        const tree = this.router.parseUrl(this.router.url);
        if (this.pathOf(tree) === this.owner) this.setUrl(this.pageUrl(tree));
      }
    });
  }

  /**
   * Адрес витрины без «/» в конце. На сервере — из контекста запроса
   * (SITE_URL или Host за прокси), в браузере — тот, что сервер передал в TransferState.
   */
  origin(): string {
    return this.trimSlash(this.ctx?.origin || this.state.get(ORIGIN_KEY, null) || this.doc.location?.origin || '');
  }

  set(p: SeoPage): void {
    const tree = this.currentTree();
    this.owner = this.pathOf(tree);
    this.keep = p.keepParams ?? [];
    this.title.setTitle(p.title);
    this.meta.updateTag({ name: 'description', content: p.description });
    this.meta.updateTag({ property: 'og:site_name', content: 'Харид' });
    this.meta.updateTag({ property: 'og:locale', content: 'ru_RU' });
    this.meta.updateTag({ property: 'og:title', content: p.title });
    this.meta.updateTag({ property: 'og:description', content: p.description });
    this.meta.updateTag({ property: 'og:type', content: p.type ?? 'website' });
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
    this.setUrl(this.pageUrl(tree));
    this.setJsonLd(p.jsonLd);
  }

  /** Адрес страницы, которую сейчас открывают (во время перехода router.url ещё старый). */
  private currentTree(): UrlTree {
    return this.router.getCurrentNavigation()?.finalUrl ?? this.router.parseUrl(this.router.url);
  }

  private pathOf(tree: UrlTree): string {
    return this.router.serializeUrl(tree).split(/[?#]/)[0] || '/';
  }

  /** Полный адрес для canonical и og:url: путь и только keepParams из query. */
  private pageUrl(tree: UrlTree): string {
    const copy = this.router.parseUrl(this.pathOf(tree));
    const params: Params = {};
    for (const k of this.keep) {
      const v = tree.queryParams[k];
      if (v !== undefined && v !== null && v !== '') params[k] = v;
    }
    copy.queryParams = params;
    return this.origin() + this.router.serializeUrl(copy);
  }

  private setUrl(url: string): void {
    this.meta.updateTag({ property: 'og:url', content: url });
    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  /** Убрать теги, привязанные к адресу прошлой страницы. */
  private clear(): void {
    this.owner = null;
    this.keep = [];
    this.doc.head.querySelector('link[rel="canonical"]')?.remove();
    this.meta.removeTag('property="og:url"');
    this.meta.removeTag('name="robots"');
    this.setJsonLd(undefined);
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

  private trimSlash(s: string): string {
    return s.replace(/\/+$/, '');
  }
}
