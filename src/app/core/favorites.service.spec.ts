import { TestBed } from '@angular/core/testing';
import { FavoritesService } from './favorites.service';

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
});
