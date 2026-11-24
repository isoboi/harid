import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Buyer, Category, CreateOrderInput, MarketReturn, Order, Product, ProductFacets, SearchSuggestions, ProductQuery, ReturnableOrder, ReturnInput, Review, Reviewable, ReviewInput, ReviewQuery, ReviewSummary, Shop, VerifyResult } from './models';

/** Все вызовы публичного API витрины /market/*. */
@Injectable({ providedIn: 'root' })
export class MarketApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/market`;

  categories(): Observable<Category[]> { return this.http.get<Category[]>(`${this.base}/categories`); }
  shops(): Observable<Shop[]> { return this.http.get<Shop[]>(`${this.base}/shops`); }
  shop(handle: string): Observable<Shop> { return this.http.get<Shop>(`${this.base}/shops/${encodeURIComponent(handle)}`); }
  products(q: ProductQuery = {}): Observable<Product[]> {
    let params = new HttpParams();
    // false у флага (in_stock) — то же, что «не задан»: в query не уходит
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '' && v !== false) params = params.set(k, String(v));
    return this.http.get<Product[]>(`${this.base}/products`, { params });
  }
  /** Варианты и диапазон цен для панели фильтров — по категории, лавке или поиску. */
  productFacets(q: Pick<ProductQuery, 'category' | 'shop' | 'q'> = {}): Observable<ProductFacets> {
    const params: Record<string, string> = {};
    if (q.category) params['category'] = q.category;
    if (q.shop) params['shop'] = q.shop;
    if (q.q) params['q'] = q.q;
    return this.http.get<ProductFacets>(`${this.base}/products/facets`, { params });
  }
  /** Подсказки при наборе: до 6 товаров, 3 лавок и 3 категорий; короче 2 символов — пусто. */
  suggest(q: string): Observable<SearchSuggestions> { return this.http.get<SearchSuggestions>(`${this.base}/search/suggest`, { params: { q } }); }
  product(id: string): Observable<Product> { return this.http.get<Product>(`${this.base}/products/${encodeURIComponent(id)}`); }
  placeOrder(body: CreateOrderInput): Observable<Order> { return this.http.post<Order>(`${this.base}/orders`, body); }
  /**
   * Заказ по номеру: токен из ссылки после оформления, телефон из формы «Найти заказ»,
   * или ничего — тогда бэкенд узнаёт владельца по Bearer. Пустые значения в query не уходят.
   */
  order(number: string, opts: { phone?: string; token?: string } = {}): Observable<Order> {
    const params: Record<string, string> = {};
    if (opts.token) params['token'] = opts.token;
    if (opts.phone) params['phone'] = opts.phone;
    return this.http.get<Order>(`${this.base}/orders/${encodeURIComponent(number)}`, { params });
  }
  /** Отзывы по товару или по лавке; пустые значения в query не уходят. */
  reviews(q: ReviewQuery): Observable<Review[]> {
    const params: Record<string, string> = {};
    if (q.product) params['product'] = q.product;
    if (q.shop) params['shop'] = q.shop;
    if (q.rating) params['rating'] = String(q.rating);
    if (q.with_text) params['with_text'] = 'true';
    return this.http.get<Review[]>(`${this.base}/reviews`, { params });
  }
  /** Сводка по товару или лавке: средняя, число, распределение 5★…1★. */
  reviewSummary(q: Pick<ReviewQuery, 'product' | 'shop'>): Observable<ReviewSummary> {
    const params: Record<string, string> = {};
    if (q.product) params['product'] = q.product;
    if (q.shop) params['shop'] = q.shop;
    return this.http.get<ReviewSummary>(`${this.base}/reviews/summary`, { params });
  }
  /** Полученные покупки, которые можно оценить (Bearer). */
  reviewable(): Observable<Reviewable[]> { return this.http.get<Reviewable[]>(`${this.base}/me/reviewable`); }
  /** Оставить или изменить отзыв (Bearer); 403 — заказ ещё не получен. */
  postReview(body: ReviewInput): Observable<Review> { return this.http.post<Review>(`${this.base}/reviews`, body); }
  /** Доставленные заказы, из которых ещё можно вернуть товар (Bearer). */
  returnable(): Observable<ReturnableOrder[]> { return this.http.get<ReturnableOrder[]>(`${this.base}/me/returnable`); }
  /** Возвраты покупателя — новые сверху (Bearer). */
  myReturns(): Observable<MarketReturn[]> { return this.http.get<MarketReturn[]>(`${this.base}/me/returns`); }
  /** Запросить возврат (Bearer); 400 — срок истёк или количество больше доступного. */
  createReturn(body: ReturnInput): Observable<MarketReturn> { return this.http.post<MarketReturn>(`${this.base}/returns`, body); }
  /** Отменить запрос, пока лавка не ответила (Bearer). */
  cancelReturn(id: number): Observable<MarketReturn> { return this.http.post<MarketReturn>(`${this.base}/returns/${id}/cancel`, {}); }
  sendCode(phone: string) { return this.http.post(`${this.base}/auth/send-code`, { phone }); }
  verify(phone: string, code: string): Observable<VerifyResult> { return this.http.post<VerifyResult>(`${this.base}/auth/verify`, { phone, code }); }
  me(): Observable<Buyer> { return this.http.get<Buyer>(`${this.base}/me`); }
  myOrders(): Observable<Order[]> { return this.http.get<Order[]>(`${this.base}/me/orders`); }
  sellerSendCode(phone: string) { return this.http.post(`${this.base}/sellers/apply/send-code`, { phone }); }
  sellerApply(body: { handle: string; owner_name: string; phone: string; code: string }) {
    return this.http.post<{ id: number; handle: string; status: string }>(`${this.base}/sellers/apply`, body);
  }
}
