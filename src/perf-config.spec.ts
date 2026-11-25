import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { environment as prod } from './environments/environment.prod';

/**
 * Адрес API в ngsw-config.json и preconnect в index.html прописаны строками, а не берутся из environment:
 * при переезде API они бы молча перестали работать. Тест сверяет их с environment.prod.ts.
 */
const root = join(__dirname, '..');
const ngsw = JSON.parse(readFileSync(join(root, 'ngsw-config.json'), 'utf8')) as {
  dataGroups: { name: string; urls: string[]; cacheConfig: { strategy: string; timeout?: string; maxAge: string } }[];
};
const indexHtml = readFileSync(join(root, 'src/index.html'), 'utf8');
const apiOrigin = new URL(prod.apiUrl).origin;
const seconds = (d: string) => Number(d.replace(/s$/, ''));

describe('service worker: кэш API', () => {
  const group = (name: string) => ngsw.dataGroups.find((g) => g.name === name)!;

  it('все адреса кэша — на боевом API из environment.prod.ts', () => {
    for (const g of ngsw.dataGroups) for (const url of g.urls) expect(url.startsWith(`${prod.apiUrl}/`)).toBe(true);
  });

  it('категории (только slug и name) — сразу из кэша, без ожидания сети', () => {
    const g = group('categories-api');
    expect(g.urls).toEqual([`${prod.apiUrl}/market/categories`]);
    expect(g.cacheConfig.strategy).toBe('performance');
    // Порядок важен: service worker берёт первую подходящую группу
    expect(ngsw.dataGroups.indexOf(g)).toBeLessThan(ngsw.dataGroups.indexOf(group('catalog-api')));
  });

  it('товары, лавки и отзывы — свежие из сети, но на плохой сети кэш не дольше чем через 3 с', () => {
    const g = group('catalog-api');
    expect(g.cacheConfig.strategy).toBe('freshness');
    expect(seconds(g.cacheConfig.timeout!)).toBeLessThanOrEqual(3);
    for (const path of ['shops', 'products', 'reviews']) expect(g.urls.some((u) => u.includes(`/market/${path}`))).toBe(true);
  });
});

describe('index.html: preconnect к API', () => {
  it('соединение к домену API готовится заранее — и для fetch (crossorigin), и для картинок', () => {
    const links = [...indexHtml.matchAll(/<link rel="preconnect" href="([^"]+)"( crossorigin)?>/g)].filter((m) => m[1] === apiOrigin);
    expect(links.map((m) => Boolean(m[2])).sort()).toEqual([false, true]);
  });
});
