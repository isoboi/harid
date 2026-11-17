import { Routes } from '@angular/router';
import { NotFoundComponent } from './pages/not-found/not-found.component';

/**
 * Все страницы подключены, включая «sell» (открытие лавки по SMS-коду).
 * Пути из app.routes.server.ts обязаны существовать и здесь, иначе сборка падает.
 */
export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent) },
  { path: 'c/:slug', loadComponent: () => import('./pages/category/category.component').then((m) => m.CategoryComponent) },
  { path: 'search', loadComponent: () => import('./pages/search/search.component').then((m) => m.SearchComponent) },
  { path: 'shop/:handle', loadComponent: () => import('./pages/shop/shop.component').then((m) => m.ShopComponent) },
  { path: 'product/:id', loadComponent: () => import('./pages/product/product.component').then((m) => m.ProductComponent) },
  { path: 'cart', loadComponent: () => import('./pages/cart/cart.component').then((m) => m.CartComponent) },
  { path: 'checkout', loadComponent: () => import('./pages/checkout/checkout.component').then((m) => m.CheckoutComponent) },
  { path: 'order/:number', loadComponent: () => import('./pages/order/order.component').then((m) => m.OrderComponent) },
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent) },
  { path: 'me/orders', loadComponent: () => import('./pages/my-orders/my-orders.component').then((m) => m.MyOrdersComponent) },
  { path: 'favorites', loadComponent: () => import('./pages/favorites/favorites.component').then((m) => m.FavoritesComponent) },
  { path: 'sell', loadComponent: () => import('./pages/sell/sell.component').then((m) => m.SellComponent) },
  { path: '**', component: NotFoundComponent },
];
