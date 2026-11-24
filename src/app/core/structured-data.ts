import { Product, Shop } from './models';

/**
 * Разметка schema.org (JSON-LD) для поисковиков: цена, наличие и оценка товара
 * в выдаче Google, карточка лавки, поиск по сайту прямо из выдачи.
 * origin — адрес витрины без завершающего «/» (https://harid.tj).
 */
export type JsonLd = Record<string, unknown>;

const CONTEXT = 'https://schema.org';

/** Описание в разметке — без лишних пробелов и не длиннее, чем имеет смысл показывать. */
function clean(text: string | null | undefined, max = 5000): string | undefined {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : undefined;
}

/** Убирает пустые поля: в JSON-LD не должно быть undefined и пустых массивов. */
function compact(o: JsonLd): JsonLd {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)));
}

/** Адрес страницы товара — один для canonical, разметки и карты сайта. */
export const productPath = (id: string) => `/product/${encodeURIComponent(id)}`;
/** Адрес страницы лавки — один для canonical, разметки и карты сайта. */
export const shopPath = (handle: string) => `/shop/${encodeURIComponent(handle)}`;

/** Главная: сайт и поиск по нему (поле поиска в выдаче Google). */
export function websiteLd(origin: string): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    name: 'Харид',
    url: `${origin}/`,
    inLanguage: 'ru',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${origin}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Товар: цена в сомони и наличие. Без цены («цена в Direct») предложения нет —
 * выдумывать цену нельзя. Оценка — только если есть отзывы.
 * Ни цены, ни отзывов — разметки нет: Google считает Product без offers,
 * review и aggregateRating ошибкой.
 */
export function productLd(p: Product, photos: string[], origin: string): JsonLd | undefined {
  const url = origin + productPath(p.id);
  const offer = p.price === null ? undefined : {
    '@type': 'Offer',
    url,
    price: p.price,
    priceCurrency: 'TJS',
    availability: p.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    seller: { '@type': 'Organization', name: `@${p.shop_handle}` },
  };
  const rating = p.rating && p.reviews_count ? { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.reviews_count, bestRating: 5, worstRating: 1 } : undefined;
  if (!offer && !rating) return undefined;
  return compact({
    '@context': CONTEXT,
    '@type': 'Product',
    name: p.title,
    description: clean(p.description),
    image: photos,
    sku: p.id,
    url,
    offers: offer,
    aggregateRating: rating,
  });
}

/** Лавка: название, аватар и ссылка на её Instagram. */
export function shopLd(s: Shop, origin: string): JsonLd {
  return compact({
    '@context': CONTEXT,
    '@type': 'Organization',
    name: clean(s.name) ?? `@${s.handle}`,
    alternateName: `@${s.handle}`,
    url: origin + shopPath(s.handle),
    logo: s.avatar_url || undefined,
    description: clean(s.bio),
    sameAs: [`https://instagram.com/${s.handle}`],
  });
}
