import { DOCUMENT } from '@angular/common';
import { Component, inject, makeStateKey, REQUEST_CONTEXT, TransferState } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SeoService } from './seo.service';

@Component({ standalone: true, template: '' })
class BlankComponent {}

function setup(ctx?: { origin?: string }) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', component: BlankComponent }]),
      ...(ctx ? [{ provide: REQUEST_CONTEXT, useValue: ctx }] : []),
    ],
  });
  return { seo: TestBed.inject(SeoService), meta: TestBed.inject(Meta), doc: TestBed.inject(DOCUMENT), router: TestBed.inject(Router) };
}

const canonical = (doc: Document) => doc.head.querySelector('link[rel="canonical"]')?.getAttribute('href');
const jsonLd = (doc: Document) => doc.head.querySelectorAll('script[type="application/ld+json"]');

describe('SeoService', () => {
  afterEach(() => {
    const doc = TestBed.inject(DOCUMENT);
    doc.head.querySelectorAll('link[rel="canonical"], script[type="application/ld+json"], meta').forEach((n) => n.remove());
  });

  it('ставит title, description, og- и twitter-теги', () => {
    const { seo, meta } = setup();
    seo.set({ title: 'Наушники — Харид', description: '540 смн', image: 'http://x/a.jpg' });
    expect(TestBed.inject(Title).getTitle()).toBe('Наушники — Харид');
    expect(meta.getTag('property="og:title"')?.content).toBe('Наушники — Харид');
    expect(meta.getTag('property="og:image"')?.content).toBe('http://x/a.jpg');
    expect(meta.getTag('name="description"')?.content).toBe('540 смн');
    expect(meta.getTag('property="og:type"')?.content).toBe('website');
    expect(meta.getTag('property="og:site_name"')?.content).toBe('Харид');
    expect(meta.getTag('name="twitter:card"')?.content).toBe('summary_large_image');
    expect(meta.getTag('name="twitter:image"')?.content).toBe('http://x/a.jpg');
  });

  it('страница без фото убирает фото прошлой страницы', () => {
    const { seo, meta } = setup();
    seo.set({ title: 'Товар', description: '', image: 'http://x/a.jpg' });
    seo.set({ title: 'Каталог', description: '' });
    expect(meta.getTag('property="og:image"')).toBeNull();
    expect(meta.getTag('name="twitter:image"')).toBeNull();
    expect(meta.getTag('name="twitter:card"')?.content).toBe('summary');
  });

  it('canonical и og:url — текущий путь без query и якоря', async () => {
    const { seo, meta, doc, router } = setup();
    await router.navigateByUrl('/c/dresses?sort=price_asc&size=M#top');
    seo.set({ title: 'Платья', description: '' });
    expect(canonical(doc)).toBe('http://localhost/c/dresses');
    expect(meta.getTag('property="og:url"')?.content).toBe('http://localhost/c/dresses');
    // повторный вызов не плодит второй link
    seo.set({ title: 'Платья', description: '' });
    expect(doc.head.querySelectorAll('link[rel="canonical"]').length).toBe(1);
  });

  it('страница, созданная во время перехода, получает свой адрес', async () => {
    @Component({ standalone: true, template: '' })
    class PageComponent { constructor() { inject(SeoService).set({ title: 'Товар', description: '' }); } }
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'product/:id', component: PageComponent }, { path: '**', component: BlankComponent }])] });
    const harness = await RouterTestingHarness.create('/catalog');
    await harness.navigateByUrl('/product/42', PageComponent);
    expect(canonical(TestBed.inject(DOCUMENT))).toBe('http://localhost/product/42');
  });

  it('поздний set() уходящей страницы во время перехода не применяется', async () => {
    let seo!: SeoService;
    const lateResponse = () => { seo.set({ title: 'Лавка', description: '', jsonLd: { '@type': 'Organization' } }); return true; };
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'sell', component: BlankComponent, canActivate: [lateResponse] }, { path: '**', component: BlankComponent }])] });
    seo = TestBed.inject(SeoService);
    const router = TestBed.inject(Router);
    const doc = TestBed.inject(DOCUMENT);
    await router.navigateByUrl('/shop/lola');
    seo.set({ title: 'Каталог', description: '' });
    await router.navigateByUrl('/sell');
    expect(TestBed.inject(Title).getTitle()).toBe('Каталог');
    expect(canonical(doc)).toBeUndefined();
    expect(jsonLd(doc).length).toBe(0);
  });

  it('path страницы важнее адресной строки: /product/042 — canonical /product/42', async () => {
    const { seo, doc, router } = setup();
    await router.navigateByUrl('/product/042;utm=x?ref=ig');
    seo.set({ title: 't', description: '', path: '/product/42' });
    expect(canonical(doc)).toBe('http://localhost/product/42');
    await router.navigateByUrl('/product/042;utm=x');
    expect(canonical(doc)).toBe('http://localhost/product/42');
  });

  it('на сервере адрес сайта — из контекста запроса', async () => {
    const { seo, doc, router } = setup({ origin: 'https://harid.tj/' });
    await router.navigateByUrl('/shop/lola');
    seo.set({ title: 't', description: '' });
    expect(seo.origin()).toBe('https://harid.tj');
    expect(canonical(doc)).toBe('https://harid.tj/shop/lola');
  });

  it('JSON-LD: один script, «<» экранирован, без разметки — убирается', () => {
    const { seo, doc } = setup();
    seo.set({ title: 't', description: '', jsonLd: { '@type': 'Product', name: '</script><b>' } });
    seo.set({ title: 't', description: '', jsonLd: { '@type': 'Product', name: '</script><b>' } });
    const scripts = jsonLd(doc);
    expect(scripts.length).toBe(1);
    expect(scripts[0].textContent).not.toContain('</script>');
    expect(JSON.parse(scripts[0].textContent ?? '')).toEqual({ '@type': 'Product', name: '</script><b>' });
    seo.set({ title: 't', description: '' });
    expect(jsonLd(doc).length).toBe(0);
  });

  it('noindex ставит robots, следующая страница его снимает', () => {
    const { seo, meta } = setup();
    seo.set({ title: 'Поиск', description: '', noindex: true });
    expect(meta.getTag('name="robots"')?.content).toBe('noindex, follow');
    seo.set({ title: 'Главная', description: '' });
    expect(meta.getTag('name="robots"')).toBeNull();
  });

  it('og:type product для товара', () => {
    const { seo, meta } = setup();
    seo.set({ title: 't', description: '', type: 'product' });
    expect(meta.getTag('property="og:type"')?.content).toBe('product');
  });
  it('в браузере адрес сайта — тот, что передал сервер, а не Host посетителя', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', component: BlankComponent }])] });
    TestBed.inject(TransferState).set(makeStateKey<string>('seo-origin'), 'https://harid.tj');
    const seo = TestBed.inject(SeoService);
    const doc = TestBed.inject(DOCUMENT);
    await TestBed.inject(Router).navigateByUrl('/product/42');
    seo.set({ title: 't', description: '' });
    expect(seo.origin()).toBe('https://harid.tj');
    expect(canonical(doc)).toBe('https://harid.tj/product/42');
  });

  it('сервер кладёт свой адрес в TransferState', () => {
    setup({ origin: 'https://harid.tj/' });
    expect(TestBed.inject(TransferState).get(makeStateKey<string>('seo-origin'), null)).toBe('https://harid.tj');
  });

  it('переход на страницу без set() убирает canonical, og:url, JSON-LD и noindex прошлой', async () => {
    const { seo, meta, doc, router } = setup();
    await router.navigateByUrl('/search?q=x');
    seo.set({ title: 'Поиск', description: '', noindex: true, jsonLd: { '@type': 'WebSite' } });
    await router.navigateByUrl('/sell');
    expect(canonical(doc)).toBeUndefined();
    expect(meta.getTag('property="og:url"')).toBeNull();
    expect(meta.getTag('name="robots"')).toBeNull();
    expect(jsonLd(doc).length).toBe(0);
  });

  it('другой товар того же маршрута — теги прошлого тоже убираются', async () => {
    const { seo, doc, router } = setup();
    await router.navigateByUrl('/product/42');
    seo.set({ title: 't', description: '', jsonLd: { '@type': 'Product' } });
    await router.navigateByUrl('/product/999');
    expect(canonical(doc)).toBeUndefined();
    expect(jsonLd(doc).length).toBe(0);
  });

  it('смена только query теги страницы не убирает', async () => {
    const { seo, doc, router } = setup();
    await router.navigateByUrl('/c/dresses');
    seo.set({ title: 'Платья', description: '', jsonLd: { '@type': 'CollectionPage' } });
    await router.navigateByUrl('/c/dresses?sort=price_asc');
    expect(canonical(doc)).toBe('http://localhost/c/dresses');
    expect(jsonLd(doc).length).toBe(1);
  });

  it('keepParams остаются в canonical и og:url и следуют за адресом', async () => {
    const { seo, meta, doc, router } = setup();
    await router.navigateByUrl('/search?q=платье&sort=price_asc');
    seo.set({ title: 't', description: '', keepParams: ['q'] });
    expect(canonical(doc)).toBe('http://localhost/search?q=%D0%BF%D0%BB%D0%B0%D1%82%D1%8C%D0%B5');
    expect(meta.getTag('property="og:url"')?.content).toBe(canonical(doc));
    await router.navigateByUrl('/shop/lola');
    seo.set({ title: 't', description: '', keepParams: ['tab'] });
    await router.navigateByUrl('/shop/lola?tab=reviews');
    expect(canonical(doc)).toBe('http://localhost/shop/lola?tab=reviews');
    await router.navigateByUrl('/shop/lola');
    expect(canonical(doc)).toBe('http://localhost/shop/lola');
  });

  it('первый переход в браузере не трогает теги, которые поставил сервер', async () => {
    const doc = document;
    const link = doc.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', 'https://harid.tj/product/42');
    doc.head.appendChild(link);
    const { router } = setup();
    await router.navigateByUrl('/product/42');
    expect(canonical(doc)).toBe('https://harid.tj/product/42');
    await router.navigateByUrl('/sell');
    expect(canonical(doc)).toBeUndefined();
  });
});
