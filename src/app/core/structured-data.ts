import { Product, Shop } from './models';

/** Валюта витрины — сомони (в интерфейсе «смн»). */
export const CURRENCY = 'TJS';

type Json = Record<string, unknown>;

const SCHEMA = 'https://schema.org';
const BACKSLASH = String.fromCharCode(0x5c);

/** Все фото товара: галерея, а если её нет — главное фото. */
function photosOf(p: Product): string[] {
  return p.images?.length ? p.images : p.image ? [p.image] : [];
}

/**
 * Товар для поиска: название, фото, цена и наличие, оценка покупателей и «хлебные крошки».
 * Цена null (лавка принимает заказы в Direct) — блока Offer нет: разметка без цены недействительна.
 */
export function productGraph(p: Product, shop: Shop | null, origin: string): Json {
  const url = `${origin}/product/${encodeURIComponent(p.id)}`;
  const shopUrl = `${origin}/shop/${encodeURIComponent(p.shop_handle)}`;
  const shopName = shop?.name || `@${p.shop_handle}`;
  const photos = photosOf(p);
  const description = p.description.trim().slice(0, 300);
  const product: Json = {
    '@type': 'Product',
    '@id': `${url}#product`,
    name: p.title,
    sku: p.id,
    url,
    ...(photos.length ? { image: photos } : {}),
    ...(description ? { description } : {}),
    ...(p.price !== null ? {
      offers: {
        '@type': 'Offer',
        url,
        price: p.price,
        priceCurrency: CURRENCY,
        availability: `${SCHEMA}/${p.in_stock ? 'InStock' : 'OutOfStock'}`,
        seller: { '@type': 'Organization', name: shopName, url: shopUrl },
      },
    } : {}),
    // Оценка — от настоящих покупателей Харида; без отзывов блок не нужен
    ...(p.rating != null && (p.reviews_count ?? 0) > 0 ? {
      aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.reviews_count },
    } : {}),
  };
  const crumbs: Json = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Харид', item: `${origin}/` },
      { '@type': 'ListItem', position: 2, name: shopName, item: shopUrl },
      { '@type': 'ListItem', position: 3, name: p.title, item: url },
    ],
  };
  return { '@context': SCHEMA, '@graph': [product, crumbs] };
}

/**
 * Лавка как организация: название, ссылка, фото и Instagram.
 * Оценку не добавляем: поисковики не показывают её у организаций, а правила разметки такое запрещают.
 */
export function shopGraph(s: Shop, origin: string): Json {
  const url = `${origin}/shop/${encodeURIComponent(s.handle)}`;
  const org: Json = {
    '@type': 'Organization',
    '@id': `${url}#shop`,
    name: s.name || `@${s.handle}`,
    url,
    ...(s.avatar_url ? { logo: s.avatar_url } : {}),
    ...(s.bio ? { description: s.bio.slice(0, 300) } : {}),
    sameAs: [`https://instagram.com/${encodeURIComponent(s.handle)}`],
  };
  return { '@context': SCHEMA, '@graph': [org] };
}

/** Главная: сайт с поиском (строка поиска в выдаче). */
export function websiteGraph(origin: string): Json {
  return {
    '@context': SCHEMA,
    '@graph': [{
      '@type': 'WebSite',
      '@id': `${origin}/#website`,
      name: 'Харид',
      url: `${origin}/`,
      inLanguage: 'ru',
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${origin}/search?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    }],
  };
}

/**
 * JSON для тега <script type="application/ld+json">. Название товара и подпись лавки — чужой текст из Instagram,
 * поэтому «<», «>», «&» и разделители строк экранируются: строка не сможет закрыть тег и вставить свой код.
 */
export function jsonLdString(data: Json): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    // U+2028/U+2029 — разделители строк: в старых разборщиках ломают строку JSON
    .split(String.fromCharCode(0x2028)).join(BACKSLASH + 'u2028')
    .split(String.fromCharCode(0x2029)).join(BACKSLASH + 'u2029');
}
