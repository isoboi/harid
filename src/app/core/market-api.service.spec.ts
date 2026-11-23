import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MarketApi } from './market-api.service';
import { environment } from '../../environments/environment';

describe('MarketApi', () => {
  let api: MarketApi; let http: HttpTestingController;
  const B = environment.apiUrl + '/market';
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(MarketApi); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('products: только заданные параметры', () => {
    api.products({ shop: 'technomir.tj', limit: 24 }).subscribe();
    const r = http.expectOne((req) => req.url === `${B}/products`);
    expect(r.request.params.get('shop')).toBe('technomir.tj');
    expect(r.request.params.get('limit')).toBe('24');
    expect(r.request.params.has('q')).toBe(false);
    r.flush([]);
  });
  it('shop: handle кодируется', () => {
    api.shop('a.b').subscribe();
    http.expectOne(`${B}/shops/a.b`).flush({});
  });
  it('order: телефон в query', () => {
    api.order('R-1', { phone: '931110002' }).subscribe();
    const r = http.expectOne((req) => req.url === `${B}/orders/R-1`);
    expect(r.request.params.get('phone')).toBe('931110002');
    expect(r.request.params.has('token')).toBe(false);
    r.flush({});
  });
  it('order: токен заказа в query', () => {
    api.order('R-1', { token: 'abc' }).subscribe();
    const r = http.expectOne((req) => req.url === `${B}/orders/R-1`);
    expect(r.request.params.get('token')).toBe('abc');
    expect(r.request.params.has('phone')).toBe(false);
    r.flush({});
  });
  it('order без телефона и токена: пустой query (трекинг по Bearer)', () => {
    api.order('R-1', {}).subscribe();
    const r = http.expectOne((req) => req.url === `${B}/orders/R-1`);
    expect(r.request.params.keys()).toEqual([]);
    r.flush({});
  });
  it('order с пустыми значениями: они не уходят в query', () => {
    api.order('R-1', { phone: '', token: '' }).subscribe();
    const r = http.expectOne((req) => req.url === `${B}/orders/R-1`);
    expect(r.request.params.keys()).toEqual([]);
    r.flush({});
  });
  it('placeOrder: POST тела как есть', () => {
    const body = { customer: { name: 'А', phone: '931110002', district: 'Сино', address: 'ул' }, slot: 'Сегодня, 18:00–21:00', payment: 'cash' as const, lines: [{ product_id: 16, qty: 1 }] };
    api.placeOrder(body).subscribe();
    const r = http.expectOne(`${B}/orders`);
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual(body);
    r.flush({});
  });
  it('reviews: по товару или по лавке, пустые параметры не уходят', () => {
    api.reviews({ product: '16' }).subscribe();
    const a = http.expectOne((req) => req.url === `${B}/reviews`);
    expect(a.request.params.get('product')).toBe('16');
    expect(a.request.params.has('shop')).toBe(false);
    a.flush([]);
    api.reviews({ shop: 'zebo.style' }).subscribe();
    const b = http.expectOne((req) => req.url === `${B}/reviews`);
    expect(b.request.params.get('shop')).toBe('zebo.style');
    expect(b.request.params.has('product')).toBe(false);
    b.flush([]);
  });
  it('reviews: фильтры rating и with_text уходят на сервер', () => {
    api.reviews({ product: '16', rating: 5, with_text: true }).subscribe();
    const r = http.expectOne((req) => req.url === `${B}/reviews`);
    expect(r.request.params.get('rating')).toBe('5');
    expect(r.request.params.get('with_text')).toBe('true');
    r.flush([]);
  });
  it('reviewSummary: GET /reviews/summary по лавке', () => {
    api.reviewSummary({ shop: 'zebo.style' }).subscribe();
    const r = http.expectOne((req) => req.url === `${B}/reviews/summary`);
    expect(r.request.method).toBe('GET');
    expect(r.request.params.get('shop')).toBe('zebo.style');
    expect(r.request.params.has('product')).toBe(false);
    r.flush({ rating: null, count: 0, distribution: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 } });
  });
  it('reviewable: GET /me/reviewable; postReview: POST /reviews с телом как есть', () => {
    api.reviewable().subscribe();
    expect(http.expectOne(`${B}/me/reviewable`).request.method).toBe('GET');
    api.postReview({ product_id: 16, rating: 5, text: 'Хорошо' }).subscribe();
    const r = http.expectOne(`${B}/reviews`);
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual({ product_id: 16, rating: 5, text: 'Хорошо' });
    r.flush({});
  });
  it('sellerApply и sellerSendCode — свои маршруты', () => {
    api.sellerSendCode('931110001').subscribe();
    http.expectOne(`${B}/sellers/apply/send-code`).flush({});
    api.sellerApply({ handle: 'x', owner_name: 'Имя', phone: '931110001', code: '000000' }).subscribe();
    http.expectOne(`${B}/sellers/apply`).flush({});
  });
});
