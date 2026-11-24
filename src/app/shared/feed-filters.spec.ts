import { convertToParamMap } from '@angular/router';
import { activeFilterCount, filtersToParams, parseFeedFilters } from './feed-filters';

const parse = (p: Record<string, string>) => parseFeedFilters(convertToParamMap(p));

describe('parseFeedFilters', () => {
  it('пустой адрес — пустые фильтры', () => {
    expect(parse({})).toEqual({});
  });

  it('все фильтры', () => {
    expect(parse({ sort: 'price_desc', price_min: '100', price_max: '500', size: ' M ', in_stock: '1' }))
      .toEqual({ sort: 'price_desc', price_min: 100, price_max: 500, size: 'M', in_stock: true });
  });

  it('sort=new — по умолчанию, в фильтры не попадает', () => {
    expect(parse({ sort: 'new' })).toEqual({});
  });

  it('мусор отбрасывается', () => {
    expect(parse({ sort: 'cheap', price_min: '-5', price_max: '1e3', in_stock: 'yes', size: 'x'.repeat(31) })).toEqual({});
  });

  it('цена 0 — тоже фильтр', () => {
    expect(parse({ price_min: '0' })).toEqual({ price_min: 0 });
  });

  it('«от» больше «до» — меняем местами', () => {
    expect(parse({ price_min: '500', price_max: '100' })).toEqual({ price_min: 100, price_max: 500 });
  });
});

describe('filtersToParams', () => {
  it('незаданные — null (убрать из адреса), new тоже', () => {
    expect(filtersToParams({ sort: 'new' })).toEqual({ sort: null, price_min: null, price_max: null, size: null, in_stock: null });
  });

  it('туда и обратно — то же самое', () => {
    const f = { sort: 'price_asc' as const, price_min: 0, price_max: 300, size: '42', in_stock: true };
    const params = Object.fromEntries(Object.entries(filtersToParams(f)).filter(([, v]) => v !== null)) as Record<string, string>;
    expect(parse(params)).toEqual(f);
  });
});

describe('activeFilterCount', () => {
  it('цена — один фильтр, сортировка не считается', () => {
    expect(activeFilterCount({ sort: 'price_asc', price_min: 1, price_max: 2 })).toBe(1);
    expect(activeFilterCount({ price_max: 2, size: 'M', in_stock: true })).toBe(3);
    expect(activeFilterCount({})).toBe(0);
  });
});
