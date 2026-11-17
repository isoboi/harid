import { Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

/** Текущий адрес роутера сигналом: обновляется после каждой завершённой навигации. */
export function injectUrl(): Signal<string> {
  const router = inject(Router);
  return toSignal(
    router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), map((e) => e.urlAfterRedirects)),
    { initialValue: router.url },
  );
}

/** Оформление заказа — на нём нижняя панель навигации прячется, чтобы не закрывать кнопку «Заказать». */
export const isCheckoutUrl = (url: string): boolean => url.split(/[?#]/)[0] === '/checkout';
