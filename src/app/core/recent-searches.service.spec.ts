import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { normalizeQuery, RECENT_SEARCH_MAX_LENGTH, RECENT_SEARCHES_LIMIT, RecentSearchesService } from './recent-searches.service';

const KEY = 'harid.searches';
const saved = () => JSON.parse(localStorage.getItem(KEY) ?? 'null');

describe('RecentSearchesService', () => {
  function make(platform = 'browser') {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: platform }] });
    return TestBed.inject(RecentSearchesService);
  }
  beforeEach(() => localStorage.clear());
  afterEach(() => TestBed.resetTestingModule());

  it('normalizeQuery: схлопывает пробелы и обрезает края', () => {
    expect(normalizeQuery('  платье   красное \n')).toBe('платье красное');
  });

  it('свежий запрос первым; повтор без учёта регистра поднимается наверх с новым написанием', () => {
    const s = make();
    s.add('платье');
    s.add('кроссовки');
    s.add('  ПЛАТЬЕ ');
    expect(s.items()).toEqual(['ПЛАТЬЕ', 'кроссовки']);
    expect(saved()).toEqual(['ПЛАТЬЕ', 'кроссовки']);
  });

  it('пустые и слишком длинные запросы не сохраняются; хранится не больше лимита', () => {
    const s = make();
    s.add('   ');
    s.add('я'.repeat(RECENT_SEARCH_MAX_LENGTH + 1));
    expect(s.items()).toEqual([]);
    for (let i = 0; i < RECENT_SEARCHES_LIMIT + 3; i++) s.add(`запрос ${i}`);
    expect(s.items().length).toBe(RECENT_SEARCHES_LIMIT);
    expect(s.items()[0]).toBe(`запрос ${RECENT_SEARCHES_LIMIT + 2}`);
  });

  it('remove убирает один запрос, clear — все и чистит хранилище', () => {
    const s = make();
    s.add('а1'); s.add('б2'); s.add('в3');
    s.remove('Б2');
    expect(s.items()).toEqual(['в3', 'а1']);
    s.clear();
    expect(s.items()).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('битое хранилище: мусор отброшен, повторы схлопнуты', () => {
    localStorage.setItem(KEY, JSON.stringify(['платье', 42, null, ' Платье ', '', { q: 'x' }, 'шарф']));
    const s = make();
    s.hydrate();
    expect(s.items()).toEqual(['платье', 'шарф']);
    localStorage.setItem(KEY, '{не json');
    const t = (TestBed.resetTestingModule(), make());
    t.hydrate();
    expect(t.items()).toEqual([]);
  });

  it('другая вкладка изменила историю — список обновился здесь', () => {
    const s = make();
    s.add('платье');
    localStorage.setItem(KEY, JSON.stringify(['шарф', 'платье']));
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    expect(s.items()).toEqual(['шарф', 'платье']);
    localStorage.clear();
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(s.items()).toEqual([]);
  });

  it('на сервере ничего не читает и не пишет', () => {
    localStorage.setItem(KEY, JSON.stringify(['платье']));
    const s = make('server');
    s.hydrate();
    expect(s.items()).toEqual([]);
    s.add('шарф');
    expect(saved()).toEqual(['платье']);
  });
});
