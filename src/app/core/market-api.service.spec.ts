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
  it('sellerApply и sellerSendCode — свои маршруты', () => {
    api.sellerSendCode('931110001').subscribe();
    http.expectOne(`${B}/sellers/apply/send-code`).flush({});
    api.sellerApply({ handle: 'x', owner_name: 'Имя', phone: '931110001', code: '000000' }).subscribe();
    http.expectOne(`${B}/sellers/apply`).flush({});
  });
});
