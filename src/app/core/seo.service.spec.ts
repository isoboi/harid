import { DOCUMENT } from '@angular/common';
import { Component, REQUEST_CONTEXT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
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
    doc.head.querySelectorAll('link[rel="canonical"], script[type="application/ld+json"]').forEach((n) => n.remove());
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

  it('во время перехода берёт адрес новой страницы, а не прошлой', async () => {
    const { seo, doc, router } = setup();
    await router.navigateByUrl('/catalog');
    let during = '';
    router.events.subscribe(() => { if (router.getCurrentNavigation()?.finalUrl) { seo.set({ title: 't', description: '' }); during = canonical(doc) ?? ''; } });
    await router.navigateByUrl('/product/42');
    expect(during).toBe('http://localhost/product/42');
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
});
