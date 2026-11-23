import { RenderMode, ServerRoute } from '@angular/ssr';

/** Публичные страницы — на сервере (OG, поисковики); личные — в браузере. */
export const serverRoutes: ServerRoute[] = [
  // Каталог категорий — публичный, рендерится на сервере вместе с плитками
  { path: 'catalog', renderMode: RenderMode.Server },
  { path: 'cart', renderMode: RenderMode.Client },
  { path: 'checkout', renderMode: RenderMode.Client },
  { path: 'order/:number', renderMode: RenderMode.Client },
  { path: 'login', renderMode: RenderMode.Client },
  { path: 'me/orders', renderMode: RenderMode.Client },
  { path: 'favorites', renderMode: RenderMode.Client },
  // Чат — личный раздел покупателя: рендерится в браузере
  { path: 'chats', renderMode: RenderMode.Client },
  { path: 'chats/new', renderMode: RenderMode.Client },
  { path: 'chats/:id', renderMode: RenderMode.Client },
  { path: 'sell', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];
