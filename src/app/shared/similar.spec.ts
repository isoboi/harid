import { Product } from '../core/models';
import { rankSimilar, SIMILAR_LIMIT } from './similar';

const prod = (over: Partial<Product> = {}): Product => ({ id: '1', shop_handle: 'b', title: 'T', price: 100, old_price: null, image: '', category: 'shoes', description: '', sizes: [], in_stock: true, posted_at: '', ...over });
const cur = prod({ id: '0', shop_handle: 'mine', price: 300 });
const ids = (list: Product[]) => list.map((p) => p.id);

describe('rankSimilar', () => {
  it('убирает текущий товар и всю его лавку', () => {
    expect(ids(rankSimilar([cur, prod({ id: '1', shop_handle: 'mine' }), prod({ id: '2', shop_handle: 'b' })], cur, null))).toEqual(['2']);
  });
  it('сначала в наличии', () => {
    expect(ids(rankSimilar([prod({ id: '1', in_stock: false, price: 300 }), prod({ id: '2', shop_handle: 'c', price: 900 })], cur, null))).toEqual(['2', '1']);
  });
  const sized = [prod({ id: '1', sizes: ['40'], price: 300 }), prod({ id: '2', sizes: ['42', '43'], price: 900 }), prod({ id: '3', sizes: [], price: 950 })];
  it('выбранный размер: с ним или без размеров раньше остальных', () => {
    expect(ids(rankSimilar(sized, cur, '42'))).toEqual(['2', '3', '1']);
  });
  it('без выбранного размера размер не учитывается', () => {
    expect(ids(rankSimilar(sized, cur, null))).toEqual(['1', '2', '3']);
  });
  it('ближе по цене раньше, цена в Direct в конце', () => {
    const list = [prod({ id: '1', price: 1000 }), prod({ id: '2', price: null }), prod({ id: '3', price: 250 }), prod({ id: '4', price: 320 })];
    expect(ids(rankSimilar(list, cur, null))).toEqual(['4', '3', '1', '2']);
  });
  it('у текущего товара нет цены: порядок сервера', () => {
    const list = [prod({ id: '1', price: 1000 }), prod({ id: '2', price: null }), prod({ id: '3', price: 5 })];
    expect(ids(rankSimilar(list, { ...cur, price: null }, null))).toEqual(['1', '2', '3']);
  });
  it('при равенстве порядок сервера', () => {
    expect(ids(rankSimilar([prod({ id: '1', price: 300 }), prod({ id: '2', price: 300 })], cur, null))).toEqual(['1', '2']);
  });
  it('не больше 8', () => {
    const list = Array.from({ length: 12 }, (_, i) => prod({ id: String(i + 1) }));
    expect(SIMILAR_LIMIT).toBe(8);
    expect(rankSimilar(list, cur, null)).toHaveLength(8);
  });
  it('не меняет входной массив', () => {
    const list = [prod({ id: '1', price: 1000 }), prod({ id: '2', price: 310 })];
    const copy = [...list];
    rankSimilar(list, cur, null);
    expect(list).toEqual(copy);
  });
});
