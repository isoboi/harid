import { TestBed } from '@angular/core/testing';
import { Product } from './models';
import { RecentlyViewedService } from './recently-viewed.service';

const p = (id: string, over: Partial<Product> = {}): Product => ({ id, shop_handle: 'zebo.style', title: `Товар ${id}`, price: 100, old_price: null, image: `${id}.jpg`, images: [`${id}-g.jpg`], category: null, description: 'длинное', sizes: ['M'], in_stock: true, posted_at: '', video: 'v.mp4', ...over });
const saved = (id: string) => ({ id, shop_handle: 'a', title: id, price: 1, old_price: null, image: '', in_stock: true });

describe('RecentlyViewedService', () => {
  let s: RecentlyViewedService;
  beforeEach(() => { localStorage.clear(); TestBed.configureTestingModule({}); s = TestBed.inject(RecentlyViewedService); });

  it('add кладёт снимок первым и хранит только поля снимка', () => {
    s.add(p('1')); s.add(p('2'));
    expect(s.items().map((i) => i.id)).toEqual(['2', '1']);
    expect(s.items()[0]).toEqual({ id: '2', shop_handle: 'zebo.style', title: 'Товар 2', price: 100, old_price: null, image: '2-g.jpg', in_stock: true });
    expect(JSON.parse(localStorage.getItem('harid.recent')!)).toHaveLength(2);
  });
  it('без галереи снимок берёт обложку', () => {
    s.add(p('1', { images: [] }));
    expect(s.items()[0].image).toBe('1.jpg');
  });
  it('повторный просмотр поднимает товар и обновляет снимок', () => {
    s.add(p('1')); s.add(p('2')); s.add(p('1', { price: 90 }));
    expect(s.items().map((i) => i.id)).toEqual(['1', '2']);
    expect(s.items()[0].price).toBe(90);
  });
  it('не больше 12, вытесняется самый старый', () => {
    for (let i = 1; i <= 13; i++) s.add(p(String(i)));
    expect(s.items()).toHaveLength(12);
    expect(s.items().at(-1)!.id).toBe('2');
  });
  it('до hydrate() пусто, после — из хранилища; ready переключается', () => {
    localStorage.setItem('harid.recent', JSON.stringify([saved('1')]));
    expect(s.ready()).toBe(false);
    expect(s.items()).toEqual([]);
    s.hydrate();
    expect(s.ready()).toBe(true);
    expect(s.items().map((i) => i.id)).toEqual(['1']);
  });
  it('add до hydrate() не затирает сохранённую историю', () => {
    localStorage.setItem('harid.recent', JSON.stringify([saved('1')]));
    s.add(p('2'));
    expect(s.items().map((i) => i.id)).toEqual(['2', '1']);
  });
  it('повреждённое хранилище: не массив — пусто без исключения', () => {
    localStorage.setItem('harid.recent', '{"a":1}');
    expect(() => s.hydrate()).not.toThrow();
    expect(s.items()).toEqual([]);
  });
  it('битые записи отброшены, годные остались', () => {
    localStorage.setItem('harid.recent', JSON.stringify([null, { id: 5 }, { ...saved('1'), price: null, in_stock: false }]));
    s.hydrate();
    expect(s.items().map((i) => i.id)).toEqual(['1']);
  });
  it('remove убирает по id; clear очищает и хранилище', () => {
    s.add(p('1')); s.add(p('2')); s.remove('1');
    expect(s.items().map((i) => i.id)).toEqual(['2']);
    s.clear();
    expect(s.items()).toEqual([]);
    expect(localStorage.getItem('harid.recent')).toBeNull();
  });
});
