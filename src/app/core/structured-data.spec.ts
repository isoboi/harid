import { Product, Shop } from './models';
import { jsonLdString, productGraph, shopGraph, websiteGraph } from './structured-data';

const origin = 'https://harid.tj';
const product: Product = {
  id: '12', shop_handle: 'my.shop', title: 'Кроссовки', price: 540, old_price: 700, image: 'https://cdn/a.jpg',
  category: 'obuv', description: '  Белые, 42 размер  ', sizes: ['42'], in_stock: true, posted_at: '2026-11-20T10:00:00Z',
  images: ['https://cdn/a.jpg', 'https://cdn/b.jpg'], rating: 4.8, reviews_count: 12,
};
const shop: Shop = {
  handle: 'my.shop', name: 'Моя лавка', bio: 'Обувь из Стамбула', followers: 1200, district: 'Сино', rating: 4.9,
  delivered_orders: 40, joined_at: '2026-10-01', avatar_color: '#123456', has_fresh: false, avatar_url: 'https://cdn/ava.jpg', reviews_count: 30,
};

function nodes(g: Record<string, unknown>): Record<string, any>[] { return g['@graph'] as Record<string, any>[]; }

describe('productGraph', () => {
  const [item, crumbs] = nodes(productGraph(product, shop, origin));

  it('описывает товар: имя, артикул, адрес, все фото и обрезанное описание', () => {
    expect(item['@type']).toBe('Product');
    expect(item['name']).toBe('Кроссовки');
    expect(item['sku']).toBe('12');
    expect(item['url']).toBe('https://harid.tj/product/12');
    expect(item['image']).toEqual(['https://cdn/a.jpg', 'https://cdn/b.jpg']);
    expect(item['description']).toBe('Белые, 42 размер');
  });

  it('цена в сомони, наличие и продавец', () => {
    expect(item['offers']).toEqual({
      '@type': 'Offer', url: 'https://harid.tj/product/12', price: 540, priceCurrency: 'TJS',
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: 'Моя лавка', url: 'https://harid.tj/shop/my.shop' },
    });
  });

  it('товара нет в наличии — OutOfStock', () => {
    const [out] = nodes(productGraph({ ...product, in_stock: false }, shop, origin));
    expect(out['offers'].availability).toBe('https://schema.org/OutOfStock');
  });

  it('оценка покупателей попадает в aggregateRating', () => {
    expect(item['aggregateRating']).toEqual({ '@type': 'AggregateRating', ratingValue: 4.8, reviewCount: 12 });
  });

  it('без отзывов aggregateRating нет', () => {
    const [bare] = nodes(productGraph({ ...product, rating: null, reviews_count: 0 }, shop, origin));
    expect(bare['aggregateRating']).toBeUndefined();
  });

  it('цена null (лавка в Direct) — блока offers нет', () => {
    const [direct] = nodes(productGraph({ ...product, price: null }, shop, origin));
    expect(direct['offers']).toBeUndefined();
  });

  it('нет галереи — одно главное фото; нет фото вовсе — поля image нет', () => {
    const [one] = nodes(productGraph({ ...product, images: undefined }, shop, origin));
    expect(one['image']).toEqual(['https://cdn/a.jpg']);
    const [none] = nodes(productGraph({ ...product, images: undefined, image: '' }, shop, origin));
    expect(none['image']).toBeUndefined();
  });

  it('лавка не загрузилась — продавец подписан ником', () => {
    const [noShop] = nodes(productGraph(product, null, origin));
    expect(noShop['offers'].seller.name).toBe('@my.shop');
  });

  it('«хлебные крошки»: Харид → лавка → товар', () => {
    expect(crumbs['@type']).toBe('BreadcrumbList');
    expect(crumbs['itemListElement'].map((i: any) => [i.position, i.name, i.item])).toEqual([
      [1, 'Харид', 'https://harid.tj/'],
      [2, 'Моя лавка', 'https://harid.tj/shop/my.shop'],
      [3, 'Кроссовки', 'https://harid.tj/product/12'],
    ]);
  });
});

describe('shopGraph', () => {
  const [org] = nodes(shopGraph(shop, origin));

  it('лавка — организация со ссылкой, логотипом, описанием и Instagram', () => {
    expect(org['@type']).toBe('Organization');
    expect(org['name']).toBe('Моя лавка');
    expect(org['url']).toBe('https://harid.tj/shop/my.shop');
    expect(org['logo']).toBe('https://cdn/ava.jpg');
    expect(org['description']).toBe('Обувь из Стамбула');
    expect(org['sameAs']).toEqual(['https://instagram.com/my.shop']);
  });

  it('оценку у организации не размечаем', () => {
    expect(org['aggregateRating']).toBeUndefined();
  });

  it('без названия, фото и описания — ник и без лишних полей', () => {
    const [bare] = nodes(shopGraph({ ...shop, name: '', avatar_url: null, bio: '' }, origin));
    expect(bare['name']).toBe('@my.shop');
    expect(bare['logo']).toBeUndefined();
    expect(bare['description']).toBeUndefined();
  });
});

describe('websiteGraph', () => {
  it('сайт с поиском: шаблон ведёт на /search?q=', () => {
    const [site] = nodes(websiteGraph(origin));
    expect(site['@type']).toBe('WebSite');
    expect(site['potentialAction'].target.urlTemplate).toBe('https://harid.tj/search?q={search_term_string}');
  });
});

describe('jsonLdString', () => {
  it('чужой текст не может закрыть тег script', () => {
    const s = jsonLdString({ name: '</script><script>alert(1)</script>' });
    expect(s).not.toContain('<');
    expect(s).not.toContain('>');
    expect(JSON.parse(s).name).toBe('</script><script>alert(1)</script>');
  });

  it('экранирует амперсанд и разделители строк, но разбирается обратно без потерь', () => {
    const value = 'Тапки & сумки' + String.fromCharCode(0x2028) + String.fromCharCode(0x2029);
    const s = jsonLdString({ name: value });
    expect(s).not.toContain('&');
    expect(s).not.toContain(String.fromCharCode(0x2028));
    expect(JSON.parse(s).name).toBe(value);
  });
});
