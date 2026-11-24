import { Product, Shop } from './models';
import { productLd, shopLd, websiteLd } from './structured-data';

const ORIGIN = 'https://harid.tj';
const product = (over: Partial<Product> = {}): Product => ({
  id: '42', shop_handle: 'lola.shop', title: 'Платье', price: 540, old_price: null, image: 'https://cdn/a.jpg', category: 'dresses',
  description: '  Лёгкое\n\nлетнее  ', sizes: [], in_stock: true, posted_at: '2026-11-01T00:00:00Z', ...over,
});

describe('structured-data', () => {
  it('товар с ценой: предложение в сомони и наличие', () => {
    const ld = productLd(product(), ['https://cdn/a.jpg', 'https://cdn/b.jpg'], ORIGIN);
    expect(ld).toMatchObject({
      '@type': 'Product', name: 'Платье', description: 'Лёгкое летнее', sku: '42', url: 'https://harid.tj/product/42',
      image: ['https://cdn/a.jpg', 'https://cdn/b.jpg'],
      offers: { '@type': 'Offer', price: 540, priceCurrency: 'TJS', availability: 'https://schema.org/InStock', seller: { name: '@lola.shop' } },
    });
  });

  it('нет в наличии — OutOfStock', () => {
    const ld = productLd(product({ in_stock: false }), [], ORIGIN) as { offers: { availability: string } };
    expect(ld.offers.availability).toBe('https://schema.org/OutOfStock');
  });

  it('«цена в Direct» — без предложения, а не с выдуманной ценой; без фото — без image', () => {
    const ld = productLd(product({ price: null, rating: 4.5, reviews_count: 3 }), [], ORIGIN)!;
    expect(ld['offers']).toBeUndefined();
    expect(ld['aggregateRating']).toBeDefined();
    expect('image' in ld).toBe(false);
  });

  it('ни цены, ни отзывов — разметки Product нет (Google счёл бы её ошибкой)', () => {
    expect(productLd(product({ price: null }), [], ORIGIN)).toBeUndefined();
    expect(productLd(product({ price: null, rating: 4.5, reviews_count: 0 }), [], ORIGIN)).toBeUndefined();
  });

  it('оценка — только когда есть отзывы', () => {
    expect(productLd(product({ rating: 4.5, reviews_count: 0 }), [], ORIGIN)?.['aggregateRating']).toBeUndefined();
    expect(productLd(product({ rating: 4.5, reviews_count: 12 }), [], ORIGIN)?.['aggregateRating']).toMatchObject({ ratingValue: 4.5, reviewCount: 12 });
  });

  it('лавка: имя, ник, Instagram; пустое имя — ник', () => {
    const shop: Shop = { handle: 'lola.shop', name: '', bio: 'Платья', followers: 10, district: null, rating: null, delivered_orders: 0, joined_at: '', avatar_color: '#fff', has_fresh: false, avatar_url: 'https://cdn/ava.jpg' };
    expect(shopLd(shop, ORIGIN)).toMatchObject({
      '@type': 'Organization', name: '@lola.shop', url: 'https://harid.tj/shop/lola.shop', logo: 'https://cdn/ava.jpg', description: 'Платья',
      sameAs: ['https://instagram.com/lola.shop'],
    });
  });

  it('сайт: поиск по адресу /search?q=', () => {
    expect(websiteLd(ORIGIN)).toMatchObject({ '@type': 'WebSite', url: 'https://harid.tj/', potentialAction: { target: { urlTemplate: 'https://harid.tj/search?q={search_term_string}' } } });
  });
});
