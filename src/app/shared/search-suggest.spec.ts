import { highlight, moveActive, suggestOptions } from './search-suggest';

describe('suggestOptions', () => {
  const data = {
    shops: [{ handle: 's_brand_tj', name: 'S Brand', avatar_color: '#123', avatar_url: null }],
    categories: [{ slug: 'shoes', name: 'Обувь' }],
    products: [{ id: '7', title: 'Кроссовки', price: 300, image: '', shop_handle: 's_brand_tj' }],
  };

  it('лавки, категории, товары и последним — «Все результаты»', () => {
    expect(suggestOptions(data, 'обу').map((o) => [o.kind, o.link])).toEqual([
      ['shop', ['/shop', 's_brand_tj']],
      ['category', ['/c', 'shoes']],
      ['product', ['/product', '7']],
      ['all', ['/search']],
    ]);
  });

  it('без ответа — только «Все результаты» с запросом', () => {
    expect(suggestOptions(null, 'платье')).toEqual([{ kind: 'all', link: ['/search'], query: 'платье' }]);
  });
});

describe('highlight', () => {
  it('подсвечивает начала слов, совпавшие с началом слов запроса', () => {
    expect(highlight('Кроссовки Nike Air', 'nik крос')).toEqual([
      { text: 'Крос', hit: true },
      { text: 'совки ', hit: false },
      { text: 'Nik', hit: true },
      { text: 'e Air', hit: false },
    ]);
  });

  it('середина слова и пустой запрос — без подсветки', () => {
    expect(highlight('Платье', 'атье')).toEqual([{ text: 'Платье', hit: false }]);
    expect(highlight('Платье', '  ')).toEqual([{ text: 'Платье', hit: false }]);
  });

  it('берёт самое длинное совпадение', () => {
    expect(highlight('самсунг', 'сам самсу')).toEqual([{ text: 'самсу', hit: true }, { text: 'нг', hit: false }]);
  });
});

describe('moveActive', () => {
  it('по кругу; из «ничего» — к первому или последнему', () => {
    expect(moveActive(-1, 1, 3)).toBe(0);
    expect(moveActive(-1, -1, 3)).toBe(2);
    expect(moveActive(2, 1, 3)).toBe(0);
    expect(moveActive(0, -1, 3)).toBe(2);
    expect(moveActive(0, 1, 0)).toBe(-1);
  });
});
