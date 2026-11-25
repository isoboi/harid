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
});
