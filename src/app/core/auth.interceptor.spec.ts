import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient; let ctl: HttpTestingController; let auth: AuthService;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpClient); ctl = TestBed.inject(HttpTestingController); auth = TestBed.inject(AuthService);
    auth.setSession({ token: 'tok', buyer: { id: 1, phone: '+992931110002', name: null }, is_new: false });
  });
  it('Bearer к /market/me и POST /market/orders', () => {
    http.get('http://x/api/market/me').subscribe();
    expect(ctl.expectOne('http://x/api/market/me').request.headers.get('Authorization')).toBe('Bearer tok');
    http.post('http://x/api/market/orders', {}).subscribe();
    expect(ctl.expectOne('http://x/api/market/orders').request.headers.get('Authorization')).toBe('Bearer tok');
  });
  it('Bearer к GET заказа по номеру (трекинг покупателя без телефона)', () => {
    http.get('http://x/api/market/orders/R-1').subscribe();
    expect(ctl.expectOne('http://x/api/market/orders/R-1').request.headers.get('Authorization')).toBe('Bearer tok');
  });
  it('Bearer к POST /market/reviews и GET /market/me/reviewable', () => {
    http.post('http://x/api/market/reviews', { product_id: 16, rating: 5 }).subscribe();
    expect(ctl.expectOne('http://x/api/market/reviews').request.headers.get('Authorization')).toBe('Bearer tok');
    http.get('http://x/api/market/me/reviewable').subscribe();
    expect(ctl.expectOne('http://x/api/market/me/reviewable').request.headers.get('Authorization')).toBe('Bearer tok');
  });
  it('Bearer к возвратам: POST /market/returns, отмена и списки /me/returns, /me/returnable', () => {
    http.post('http://x/api/market/returns', { order_id: 40 }).subscribe();
    expect(ctl.expectOne('http://x/api/market/returns').request.headers.get('Authorization')).toBe('Bearer tok');
    http.post('http://x/api/market/returns/9/cancel', {}).subscribe();
    expect(ctl.expectOne('http://x/api/market/returns/9/cancel').request.headers.get('Authorization')).toBe('Bearer tok');
    http.get('http://x/api/market/me/returns').subscribe();
    expect(ctl.expectOne('http://x/api/market/me/returns').request.headers.get('Authorization')).toBe('Bearer tok');
    http.get('http://x/api/market/me/returnable').subscribe();
    expect(ctl.expectOne('http://x/api/market/me/returnable').request.headers.get('Authorization')).toBe('Bearer tok');
  });
  it('без Bearer к публичному списку отзывов (GET /market/reviews)', () => {
    http.get('http://x/api/market/reviews?product=16').subscribe();
    expect(ctl.expectOne('http://x/api/market/reviews?product=16').request.headers.has('Authorization')).toBe(false);
  });
  it('без Bearer к списку заказов и каталогу', () => {
    http.get('http://x/api/market/orders').subscribe();
    expect(ctl.expectOne('http://x/api/market/orders').request.headers.has('Authorization')).toBe(false);
    http.get('http://x/api/market/products').subscribe();
    expect(ctl.expectOne('http://x/api/market/products').request.headers.has('Authorization')).toBe(false);
  });
  it('без Bearer к каталогу', () => {
    http.get('http://x/api/market/products').subscribe();
    expect(ctl.expectOne('http://x/api/market/products').request.headers.has('Authorization')).toBe(false);
  });
  it('401 на /market/me — выход', () => {
    http.get('http://x/api/market/me').subscribe({ error: () => undefined });
    ctl.expectOne('http://x/api/market/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.loggedIn()).toBe(false);
  });
  it('401 на /market/menu — не выход (граница пути как у needsToken)', () => {
    http.get('http://x/api/market/menu').subscribe({ error: () => undefined });
    ctl.expectOne('http://x/api/market/menu').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.loggedIn()).toBe(true);
  });
  it('401 без отправленного токена — сессия не трогается', () => {
    auth.logout();
    auth.setSession({ token: 'tok', buyer: { id: 1, phone: '+992931110002', name: null }, is_new: false });
    http.get('http://x/api/market/products').subscribe({ error: () => undefined });
    ctl.expectOne('http://x/api/market/products').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.loggedIn()).toBe(true);
  });
});
