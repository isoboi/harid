import { TestBed } from '@angular/core/testing';
import { throwError, of } from 'rxjs';
import { CatalogFeed, FEED_TTL_MS } from './catalog-feed.service';
import { MarketApi } from './market-api.service';

describe('CatalogFeed', () => {
  afterEach(() => jest.useRealTimers());

  function setup(products: jest.Mock) {
    TestBed.configureTestingModule({ providers: [{ provide: MarketApi, useValue: { products } }] });
    return TestBed.inject(CatalogFeed);
  }

  it('запрашивает сотню (предел API) и отдаёт товары', (done) => {
    const products = jest.fn(() => of([{ id: '1' }]));
    setup(products).products().subscribe((list) => {
      expect(products).toHaveBeenCalledWith({ limit: 100 });
      expect(list).toEqual([{ id: '1' }]);
      done();
    });
  });

  it('несколько страниц подряд — один запрос', () => {
    const products = jest.fn(() => of([]));
    const feed = setup(products);
    feed.products().subscribe();
    feed.products().subscribe();
    feed.products().subscribe();
    expect(products).toHaveBeenCalledTimes(1);
  });

  it('через минуту запрашивает заново', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-23T10:00:00Z'));
    const products = jest.fn(() => of([]));
    const feed = setup(products);
    feed.products().subscribe();
    jest.setSystemTime(Date.now() + FEED_TTL_MS - 1);
    feed.products().subscribe();
    expect(products).toHaveBeenCalledTimes(1);
    jest.setSystemTime(Date.now() + 1);
    feed.products().subscribe();
    expect(products).toHaveBeenCalledTimes(2);
  });

  it('ошибка API — null, а не падение страницы', (done) => {
    setup(jest.fn(() => throwError(() => new Error('500')))).products().subscribe((list) => {
      expect(list).toBeNull();
      done();
    });
  });
});
