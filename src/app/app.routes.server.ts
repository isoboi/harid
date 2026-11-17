import { RenderMode, ServerRoute } from '@angular/ssr';

/** Публичные страницы — на сервере (OG, поисковики); личные — в браузере. */
export const serverRoutes: ServerRoute[] = [
  { path: 'cart', renderMode: RenderMode.Client },
  { path: 'checkout', renderMode: RenderMode.Client },
  { path: 'order/:number', renderMode: RenderMode.Client },
  { path: 'login', renderMode: RenderMode.Client },
  { path: 'me/orders', renderMode: RenderMode.Client },
  { path: 'favorites', renderMode: RenderMode.Client },
  { path: 'sell', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];
