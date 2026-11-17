import { TestBed } from '@angular/core/testing';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  beforeEach(() => { localStorage.clear(); TestBed.configureTestingModule({}); });
  it('toggle добавляет и убирает', () => {
    const f = TestBed.inject(FavoritesService);
    f.toggle('5'); expect(f.has('5')).toBe(true);
    f.toggle('5'); expect(f.has('5')).toBe(false);
  });
});
