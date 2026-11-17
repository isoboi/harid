import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Buyer, Category, CreateOrderInput, Order, Product, ProductQuery, Shop, VerifyResult } from './models';

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
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') params = params.set(k, String(v));
    return this.http.get<Product[]>(`${this.base}/products`, { params });
  }
  product(id: string): Observable<Product> { return this.http.get<Product>(`${this.base}/products/${encodeURIComponent(id)}`); }
  placeOrder(body: CreateOrderInput): Observable<Order> { return this.http.post<Order>(`${this.base}/orders`, body); }
  /** Телефон необязателен: для покупателя с Bearer бэкенд узнаёт заказ по токену. */
  order(number: string, phone?: string): Observable<Order> {
    const params: Record<string, string> = phone ? { phone } : {};
    return this.http.get<Order>(`${this.base}/orders/${encodeURIComponent(number)}`, { params });
  }
  sendCode(phone: string) { return this.http.post(`${this.base}/auth/send-code`, { phone }); }
  verify(phone: string, code: string): Observable<VerifyResult> { return this.http.post<VerifyResult>(`${this.base}/auth/verify`, { phone, code }); }
  me(): Observable<Buyer> { return this.http.get<Buyer>(`${this.base}/me`); }
  myOrders(): Observable<Order[]> { return this.http.get<Order[]>(`${this.base}/me/orders`); }
  sellerSendCode(phone: string) { return this.http.post(`${this.base}/sellers/apply/send-code`, { phone }); }
  sellerApply(body: { handle: string; owner_name: string; phone: string; code: string }) {
    return this.http.post<{ id: number; handle: string; status: string }>(`${this.base}/sellers/apply`, body);
  }
}
