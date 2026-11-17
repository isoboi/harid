import { TestBed } from '@angular/core/testing';
import { CartService } from './cart.service';
import { Product } from './models';

const p = (id: string, shop: string, price: number, sizes: string[] = []): Product =>
  ({ id, shop_handle: shop, title: 'T' + id, price, old_price: null, image: '', category: null, description: '', sizes, in_stock: true, posted_at: '' });

const reopen = () => { TestBed.resetTestingModule(); TestBed.configureTestingModule({}); return TestBed.inject(CartService); };

describe('CartService', () => {
  let cart: CartService;
  beforeEach(() => { localStorage.clear(); TestBed.configureTestingModule({}); cart = TestBed.inject(CartService); });

  it('тот же товар и вариант — количество суммируется, разный вариант — отдельная строка', () => {
    cart.add(p('1', 'a', 100, ['S', 'M']), 'S');
    cart.add(p('1', 'a', 100, ['S', 'M']), 'S', 2);
    cart.add(p('1', 'a', 100, ['S', 'M']), 'M');
    expect(cart.items().map((i) => [i.size, i.qty])).toEqual([['S', 3], ['M', 1]]);
    expect(cart.count()).toBe(4);
  });
  it('группы по лавкам, итог товаров и доставка за каждую лавку', () => {
    cart.add(p('1', 'a', 100), null, 2);
    cart.add(p('2', 'b', 50), null);
    expect(cart.groups().map((g) => [g.shop_handle, g.subtotal])).toEqual([['a', 200], ['b', 50]]);
    expect(cart.itemsTotal()).toBe(250);
    expect(cart.deliveryTotal('Сино')).toBe(30);
    expect(cart.deliveryTotal('Вахдат')).toBe(50);
  });
  it('setQty 0 удаляет; toOrderLines — числа и размер только если есть', () => {
    cart.add(p('1', 'a', 100), null);
    cart.add(p('2', 'a', 100, ['S', 'M']), 'M', 2);
    cart.setQty('1', null, 0);
    expect(cart.toOrderLines()).toEqual([{ product_id: 2, size: 'M', qty: 2 }]);
  });
  it('сохраняется в localStorage и после hydrate() читается новым экземпляром', () => {
    cart.add(p('1', 'a', 100), null, 3);
    const fresh = reopen();
    fresh.hydrate();
    expect(fresh.count()).toBe(3);
  });
  it('до hydrate() новый экземпляр пуст, даже если в хранилище есть данные', () => {
    cart.add(p('1', 'a', 100), null, 3);
    expect(reopen().count()).toBe(0);
  });
  it('hydrate() дважды не дублирует строки', () => {
    cart.add(p('1', 'a', 100), null, 3);
    const fresh = reopen();
    fresh.hydrate();
    fresh.hydrate();
    expect(fresh.items().length).toBe(1);
    expect(fresh.count()).toBe(3);
  });
  it('повреждённая запись корзины — пустая корзина без исключения', () => {
    localStorage.setItem('harid.cart', '"x"');
    const fresh = reopen();
    expect(() => fresh.hydrate()).not.toThrow();
    expect(fresh.items()).toEqual([]);
  });
  it('ready: false до hydrate(), true после', () => {
    const fresh = reopen();
    expect(fresh.ready()).toBe(false);
    fresh.hydrate();
    expect(fresh.ready()).toBe(true);
  });
  it('add до hydrate() сохраняет сохранённую строку A и добавляет B', () => {
    cart.add(p('1', 'a', 100), null, 1);
    const fresh = reopen();
    fresh.add(p('2', 'b', 50), null, 1);
    expect(fresh.items().map((i) => i.product.id)).toEqual(['1', '2']);
    expect(fresh.count()).toBe(2);
  });
  it('невалидные строки отбрасываются: [{}] — пустая корзина без исключения', () => {
    localStorage.setItem('harid.cart', JSON.stringify([{}]));
    const fresh = reopen();
    expect(() => fresh.hydrate()).not.toThrow();
    expect(fresh.items()).toEqual([]);
    expect(fresh.count()).toBe(0);
  });
  it('невалидные строки отбрасываются, валидные остаются (qty 0 и size не строка)', () => {
    const good = { product: p('1', 'a', 100), size: null, qty: 2 };
    localStorage.setItem('harid.cart', JSON.stringify([good, { ...good, qty: 0 }, { ...good, size: 5 }]));
    const fresh = reopen();
    fresh.hydrate();
    expect(fresh.items().length).toBe(1);
    expect(fresh.count()).toBe(2);
  });
});
