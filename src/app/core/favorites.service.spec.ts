import { TestBed } from '@angular/core/testing';
import { FavoritesService } from './favorites.service';
import { ToastService } from './toast.service';

describe('FavoritesService', () => {
  beforeEach(() => { localStorage.clear(); TestBed.configureTestingModule({}); });
  it('toggle добавляет и убирает', () => {
    const f = TestBed.inject(FavoritesService);
    f.toggle('5'); expect(f.has('5')).toBe(true);
    f.toggle('5'); expect(f.has('5')).toBe(false);
  });
  it('до hydrate() пусто, после hydrate() — из хранилища', () => {
    TestBed.inject(FavoritesService).toggle('7');
    TestBed.resetTestingModule(); TestBed.configureTestingModule({});
    const fresh = TestBed.inject(FavoritesService);
    expect(fresh.has('7')).toBe(false);
    fresh.hydrate();
    expect(fresh.has('7')).toBe(true);
  });
  it('повреждённая запись избранного — пусто без исключения', () => {
    localStorage.setItem('harid.fav', '{"a":1}');
    const fresh = TestBed.inject(FavoritesService);
    expect(() => fresh.hydrate()).not.toThrow();
    expect(fresh.ids()).toEqual([]);
  });
  it('ready: false до hydrate(), true после', () => {
    const f = TestBed.inject(FavoritesService);
    expect(f.ready()).toBe(false);
    f.hydrate();
    expect(f.ready()).toBe(true);
  });
  it('toggle до hydrate() сохраняет сохранённые id', () => {
    localStorage.setItem('harid.fav', JSON.stringify(['1']));
    const f = TestBed.inject(FavoritesService);
    f.toggle('2');
    expect(f.ids()).toEqual(['1', '2']);
  });

  describe('плашки', () => {
    it('добавление — «Добавлено в избранное · Открыть» со ссылкой на избранное', () => {
      TestBed.inject(FavoritesService).toggle('5');
      expect(TestBed.inject(ToastService).current()).toMatchObject({ text: 'Добавлено в избранное', action: { label: 'Открыть', link: '/favorites' } });
    });
    it('удаление — «Вернуть» ставит товар на прежнее место и сохраняет', () => {
      const f = TestBed.inject(FavoritesService);
      ['1', '2', '3'].forEach((id) => f.toggle(id));
      f.toggle('2');
      const toast = TestBed.inject(ToastService);
      expect(toast.current()?.text).toBe('Убрано из избранного');
      toast.act();
      expect(f.ids()).toEqual(['1', '2', '3']);
      expect(JSON.parse(localStorage.getItem('harid.fav')!)).toEqual(['1', '2', '3']);
    });
    it('«Вернуть» после повторного добавления не делает дубль', () => {
      const f = TestBed.inject(FavoritesService);
      f.toggle('1');
      f.toggle('1');
      const undo = TestBed.inject(ToastService).current()!.action!.run!;
      f.toggle('1');
      undo();
      expect(f.ids()).toEqual(['1']);
    });
  });

  describe('цены («Подешевело»)', () => {
    const item = (price: number | null, in_stock = true) => ({ price, in_stock });

    it('добавление запоминает цену; снижение на 5%+ — drop и точка', () => {
      const f = TestBed.inject(FavoritesService);
      f.toggle('1', item(300));
      f.observe('1', item(250));
      expect(f.drop('1')).toBe(50);
      expect(f.hasFreshDrop()).toBe(true);
    });
    it('снижение меньше 5% — ни плашки, ни точки', () => {
      const f = TestBed.inject(FavoritesService);
      f.toggle('1', item(300));
      f.observe('1', item(290));
      expect([f.drop('1'), f.hasFreshDrop()]).toEqual([null, false]);
    });
    it('markSeen гасит точку, плашка остаётся; упал ещё — точка снова', () => {
      const f = TestBed.inject(FavoritesService);
      f.toggle('1', item(300));
      f.observe('1', item(250));
      f.markSeen();
      expect(f.hasFreshDrop()).toBe(false);
      expect(f.drop('1')).toBe(50);
      f.observe('1', item(200));
      expect(f.hasFreshDrop()).toBe(true);
    });
    it('цена по запросу при добавлении — base по первой цене, снижения нет', () => {
      const f = TestBed.inject(FavoritesService);
      f.toggle('1', item(null));
      f.observe('1', item(300));
      expect(f.drop('1')).toBeNull();
      f.observe('1', item(250));
      expect(f.drop('1')).toBe(50);
    });
    it('старое избранное без меток — первая цена становится base, точки нет', () => {
      localStorage.setItem('harid.fav', JSON.stringify(['9']));
      const f = TestBed.inject(FavoritesService);
      f.hydrate();
      f.observe('9', item(250));
      expect(f.drop('9')).toBeNull();
      expect(f.hasFreshDrop()).toBe(false);
      f.observe('9', item(200));
      expect(f.drop('9')).toBe(50);
    });
    it('«Вернуть» восстанавливает прежнюю метку, а не текущую цену', () => {
      const f = TestBed.inject(FavoritesService);
      f.toggle('1', item(300));
      f.observe('1', item(250));
      f.toggle('1');
      expect(f.marks()['1']).toBeUndefined();
      TestBed.inject(ToastService).act();
      expect(f.drop('1')).toBe(50);
    });
    it('нет в наличии — ни плашки, ни точки; снова в наличии — есть', () => {
      const f = TestBed.inject(FavoritesService);
      f.toggle('1', item(300));
      f.observe('1', item(250, false));
      expect([f.drop('1'), f.hasFreshDrop()]).toEqual([null, false]);
      f.observe('1', item(250, true));
      expect([f.drop('1'), f.hasFreshDrop()]).toEqual([50, true]);
    });
    it('observe товара не из избранного — ничего не пишет', () => {
      const f = TestBed.inject(FavoritesService);
      f.observe('2', item(100));
      expect(f.marks()).toEqual({});
      expect(localStorage.getItem('harid.fav.prices')).toBeNull();
    });
    it('метки переживают перезагрузку (hydrate)', () => {
      const f = TestBed.inject(FavoritesService);
      f.toggle('1', item(300));
      f.observe('1', item(250));
      TestBed.resetTestingModule(); TestBed.configureTestingModule({});
      const fresh = TestBed.inject(FavoritesService);
      fresh.hydrate();
      expect(fresh.drop('1')).toBe(50);
      expect(fresh.hasFreshDrop()).toBe(true);
    });
    it('повреждённые метки — пусто без исключения, избранное цело', () => {
      localStorage.setItem('harid.fav', JSON.stringify(['1']));
      localStorage.setItem('harid.fav.prices', '[1,2]');
      const f = TestBed.inject(FavoritesService);
      expect(() => f.hydrate()).not.toThrow();
      expect([f.ids(), f.marks()]).toEqual([['1'], {}]);
    });
  });
});
