import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const ME = /\/market\/me(\/|$|\?)/;
const ORDERS = /\/market\/orders$/;
/** Заказ по номеру: GET /market/orders/<номер> (без вложенных путей). */
const ORDER_ONE = /\/market\/orders\/[^/?#]+$/;
const needsToken = (url: string, method: string) =>
  ME.test(url) || (method === 'POST' && ORDERS.test(url)) || (method === 'GET' && ORDER_ONE.test(url));

/** Bearer покупателя для личных запросов; 401 на /me при отправленном токене — выход. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const sent = !!token && needsToken(req.url, req.method);
  const r = sent ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(r).pipe(catchError((e: unknown) => {
    if (sent && e instanceof HttpErrorResponse && e.status === 401 && ME.test(req.url)) auth.logout();
    return throwError(() => e);
  }));
};
