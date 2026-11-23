import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { SeoService } from './seo.service';

const prop = (name: string) => TestBed.inject(Meta).getTag(`property="${name}"`)?.content;
const named = (name: string) => TestBed.inject(Meta).getTag(`name="${name}"`)?.content;
const canonical = () => document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;
const ld = () => document.head.querySelector('script[data-seo-ld]');

describe('SeoService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  afterEach(() => {
    // чистим голову документа: jsdom общий на весь файл
    TestBed.inject(SeoService).set({ title: '', description: '' });
    document.head.querySelectorAll('meta[property], meta[name="twitter:card"], meta[name="description"]').forEach((n) => n.remove());
  });

  it('ставит title и og-теги', () => {
    TestBed.inject(SeoService).set({ title: 'Наушники — Харид', description: '540 смн', image: 'http://x/a.jpg' });
    expect(TestBed.inject(Title).getTitle()).toBe('Наушники — Харид');
    expect(prop('og:title')).toBe('Наушники — Харид');
    expect(prop('og:image')).toBe('http://x/a.jpg');
    expect(named('description')).toBe('540 смн');
  });

  it('добавляет название сайта, язык, тип и twitter:card', () => {
    TestBed.inject(SeoService).set({ title: 'Харид', description: 'd', image: 'http://x/a.jpg' });
    expect(prop('og:site_name')).toBe('Харид');
    expect(prop('og:locale')).toBe('ru_RU');
    expect(prop('og:type')).toBe('website');
    expect(named('twitter:card')).toBe('summary_large_image');
  });

  it('без фото — twitter:card summary и нет og:image', () => {
    TestBed.inject(SeoService).set({ title: 'Харид', description: 'd' });
    expect(named('twitter:card')).toBe('summary');
    expect(prop('og:image')).toBeUndefined();
  });

  it('путь превращается в canonical и og:url с адресом сайта', () => {
    TestBed.inject(SeoService).set({ title: 't', description: 'd', path: '/product/5' });
    expect(canonical()).toBe(`${window.location.origin}/product/5`);
    expect(prop('og:url')).toBe(`${window.location.origin}/product/5`);
  });

  it('товар: og:type product и цена в сомони', () => {
    TestBed.inject(SeoService).set({ title: 't', description: 'd', type: 'product', price: 540 });
    expect(prop('og:type')).toBe('product');
    expect(prop('product:price:amount')).toBe('540');
    expect(prop('product:price:currency')).toBe('TJS');
  });

  it('товар без цены (лавка в Direct) — тегов цены нет', () => {
    TestBed.inject(SeoService).set({ title: 't', description: 'd', type: 'product', price: null });
    expect(prop('product:price:amount')).toBeUndefined();
  });

  it('JSON-LD вставляется с адресом сайта', () => {
    TestBed.inject(SeoService).set({ title: 't', description: 'd', jsonLd: (origin) => ({ '@context': 'https://schema.org', url: `${origin}/` }) });
    expect(ld()?.getAttribute('type')).toBe('application/ld+json');
    expect(JSON.parse(ld()?.textContent ?? '{}').url).toBe(`${window.location.origin}/`);
  });

  it('чужой текст в JSON-LD не может закрыть тег script', () => {
    TestBed.inject(SeoService).set({ title: 't', description: 'd', jsonLd: () => ({ name: '</script><img src=x onerror=alert(1)>' }) });
    expect(ld()?.textContent).not.toContain('<');
    expect(document.head.querySelector('img')).toBeNull();
  });

  it('следующая страница убирает всё лишнее от предыдущей', () => {
    const seo = TestBed.inject(SeoService);
    seo.set({ title: 'Товар', description: 'd', image: 'http://x/a.jpg', path: '/product/5', type: 'product', price: 540, jsonLd: () => ({ a: 1 }) });
    seo.set({ title: 'Главная', description: 'd' });
    expect(canonical()).toBeNull();
    expect(ld()).toBeNull();
    expect(prop('og:image')).toBeUndefined();
    expect(prop('og:url')).toBeUndefined();
    expect(prop('product:price:amount')).toBeUndefined();
    expect(prop('og:type')).toBe('website');
  });

  it('повторный вызов не плодит canonical и JSON-LD', () => {
    const seo = TestBed.inject(SeoService);
    seo.set({ title: 'a', description: 'd', path: '/a', jsonLd: () => ({ a: 1 }) });
    seo.set({ title: 'b', description: 'd', path: '/b', jsonLd: () => ({ b: 2 }) });
    expect(document.head.querySelectorAll('link[rel="canonical"]').length).toBe(1);
    expect(document.head.querySelectorAll('script[data-seo-ld]').length).toBe(1);
    expect(canonical()).toBe(`${window.location.origin}/b`);
  });
});
