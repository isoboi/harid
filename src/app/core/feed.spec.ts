import { Category, Product } from './models';
import { curate, FEED_LIMIT, isBrokenTitle, isOrderable, visibleCategories } from './feed';

const p = (id: string, over: Partial<Product> = {}): Product => ({
  id, shop_handle: 'shop', title: `Товар ${id}`, price: 100, old_price: null, image: 'a.jpg', category: null, description: '', sizes: [], in_stock: true, posted_at: '', ...over,
});

describe('isBrokenTitle', () => {
  it('«!», «@ник», одни эмодзи и цифры — сломанные названия', () => {
    for (const t of ['!', '  ', '@jahongir.mirzonaimov', '@madinanazarova_dress', '🔥🔥', '12345', '.', 'я']) expect(isBrokenTitle(t)).toBe(true);
  });

  it('обычные названия, в том числе короткие и на таджикском, проходят', () => {
    for (const t of ['Кеды', 'Стоп', 'Ручная работа', 'Зебоӣ аз интихоби дуруст оғоз мешавад', 'iPhone 15', 'TV']) expect(isBrokenTitle(t)).toBe(false);
  });
});

describe('isOrderable', () => {
  it('нужны подключённая лавка, цена и наличие', () => {
    expect(isOrderable(p('1'))).toBe(true);
    expect(isOrderable(p('1b', { shop_verified: true }))).toBe(true);
    expect(isOrderable(p('2', { price: null }))).toBe(false);
    expect(isOrderable(p('3', { in_stock: false }))).toBe(false);
  });

  it('у лавки без подключения цена из подписи не делает товар заказываемым: заказ только через Direct', () => {
    expect(isOrderable(p('4', { shop_verified: false }))).toBe(false);
  });
});

describe('curate', () => {
  it('сначала то, что можно заказать, порядок внутри групп сохраняется', () => {
    const list = [p('1', { price: null }), p('2'), p('3', { price: null }), p('4'), p('5', { in_stock: false })];
    expect(curate(list).map((x) => x.id)).toEqual(['2', '4', '5', '1', '3']);
  });

  it('три уровня: заказ на Харид → цена из подписи (Direct) → «цену спросите в Direct»', () => {
    const list = [
      p('1', { shop_verified: false, price: null }),
      p('2', { shop_verified: false, price: 300 }),
      p('3', { shop_verified: true }),
      p('4', { shop_verified: false, price: 250 }),
      p('5', { shop_verified: false, price: null }),
    ];
    expect(curate(list).map((x) => x.id)).toEqual(['3', '2', '4', '1', '5']);
  });

  it('убирает сломанные названия, даже у товаров с ценой', () => {
    const list = [p('1', { title: '!' }), p('2'), p('3', { title: '@shop', price: null })];
    expect(curate(list).map((x) => x.id)).toEqual(['2']);
  });

  it('не меняет исходный массив', () => {
    const list = [p('1', { price: null }), p('2')];
    curate(list);
    expect(list.map((x) => x.id)).toEqual(['1', '2']);
  });
});

describe('visibleCategories', () => {
  const cats: Category[] = [{ slug: 'shoes', name: 'Обувь' }, { slug: 'bags', name: 'Сумки' }, { slug: 'kids', name: 'Детское' }];

  it('оставляет только категории, в которых есть товары', () => {
    const feed = [p('1', { category: 'shoes' }), p('2', { category: null })];
    expect(visibleCategories(cats, feed).map((c) => c.slug)).toEqual(['shoes']);
  });

  it('товары со сломанным названием категорию не «оживляют»', () => {
    const feed = [p('1', { category: 'bags', title: '!' })];
    expect(visibleCategories(cats, feed)).toEqual([]);
  });

  it('текущую категорию не прячет, даже пустую', () => {
    expect(visibleCategories(cats, [], 'kids').map((c) => c.slug)).toEqual(['kids']);
  });

  it('товары не загрузились — ничего не скрывает', () => {
    expect(visibleCategories(cats, null)).toEqual(cats);
  });

  it('выдача упёрлась в предел API — ничего не скрывает: категории могли остаться за пределом', () => {
    const full = Array.from({ length: FEED_LIMIT }, (_, i) => p(String(i), { category: 'shoes' }));
    expect(visibleCategories(cats, full)).toEqual(cats);
    expect(visibleCategories(cats, full.slice(1)).map((c) => c.slug)).toEqual(['shoes']);
  });
});
