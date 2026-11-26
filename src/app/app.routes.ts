import { Routes } from '@angular/router';
import { NotFoundComponent } from './pages/not-found/not-found.component';

/**
 * Все страницы подключены, включая «sell» (открытие лавки по SMS-коду).
 * Пути из app.routes.server.ts обязаны существовать и здесь, иначе сборка падает.
 * title — у страниц, которые не вызывают SeoService.set(): иначе во вкладке
 * оставался бы заголовок прошлой страницы. Заказ ставит заголовок сам (с номером). Публичным страницам title здесь не задавать —
 * роутер перезапишет им заголовок из SeoService.
 */
export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent) },
  { path: 'catalog', loadComponent: () => import('./pages/catalog/catalog.component').then((m) => m.CatalogComponent) },
  { path: 'c/:slug', loadComponent: () => import('./pages/category/category.component').then((m) => m.CategoryComponent) },
  { path: 'search', loadComponent: () => import('./pages/search/search.component').then((m) => m.SearchComponent) },
  { path: 'shop/:handle', loadComponent: () => import('./pages/shop/shop.component').then((m) => m.ShopComponent) },
  { path: 'product/:id', loadComponent: () => import('./pages/product/product.component').then((m) => m.ProductComponent) },
  { path: 'cart', title: 'Корзина — Харид', loadComponent: () => import('./pages/cart/cart.component').then((m) => m.CartComponent) },
  { path: 'checkout', title: 'Оформление заказа — Харид', loadComponent: () => import('./pages/checkout/checkout.component').then((m) => m.CheckoutComponent) },
  { path: 'order/:number', loadComponent: () => import('./pages/order/order.component').then((m) => m.OrderComponent) },
  { path: 'login', title: 'Вход — Харид', loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent) },
  { path: 'me', title: 'Профиль — Харид', loadComponent: () => import('./pages/profile/profile.component').then((m) => m.ProfileComponent) },
  { path: 'me/orders', title: 'Мои заказы — Харид', loadComponent: () => import('./pages/my-orders/my-orders.component').then((m) => m.MyOrdersComponent) },
  { path: 'favorites', title: 'Избранное — Харид', loadComponent: () => import('./pages/favorites/favorites.component').then((m) => m.FavoritesComponent) },
  { path: 'sell', title: 'Открыть лавку на Хариде', loadComponent: () => import('./pages/sell/sell.component').then((m) => m.SellComponent) },
  { path: 'chats', title: 'Сообщения — Харид', loadComponent: () => import('./pages/chats/chats.component').then((m) => m.ChatsComponent) },
  // «new» раньше «:id», иначе «new» разберётся как номер чата
  { path: 'chats/new', title: 'Вопрос продавцу — Харид', loadComponent: () => import('./pages/chats/chat-new.component').then((m) => m.ChatNewComponent) },
  { path: 'chats/:id', title: 'Сообщения — Харид', loadComponent: () => import('./pages/chats/chat-thread.component').then((m) => m.ChatThreadComponent) },
  { path: '**', title: 'Страница не найдена — Харид', component: NotFoundComponent },
];
