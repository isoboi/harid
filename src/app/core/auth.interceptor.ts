import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const needsToken = (url: string, method: string) => /\/market\/me(\/|$|\?)/.test(url) || (method === 'POST' && /\/market\/orders$/.test(url));

/** Bearer покупателя для личных запросов; 401 на /me — выход. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const r = token && needsToken(req.url, req.method) ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(r).pipe(catchError((e: unknown) => {
    if (e instanceof HttpErrorResponse && e.status === 401 && /\/market\/me/.test(req.url)) auth.logout();
    return throwError(() => e);
  }));
};
