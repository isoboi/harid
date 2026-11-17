import { Routes } from '@angular/router';
import { NotFoundComponent } from './pages/not-found/not-found.component';

const stub = () => import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent);

/**
 * Публичные страницы подключены; клиентские пока ведут на заглушку (подключаются в своих задачах).
 * Пути из app.routes.server.ts обязаны существовать и здесь, иначе сборка падает.
 */
export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent) },
  { path: 'c/:slug', loadComponent: () => import('./pages/category/category.component').then((m) => m.CategoryComponent) },
  { path: 'search', loadComponent: () => import('./pages/search/search.component').then((m) => m.SearchComponent) },
  { path: 'shop/:handle', loadComponent: () => import('./pages/shop/shop.component').then((m) => m.ShopComponent) },
  { path: 'product/:id', loadComponent: () => import('./pages/product/product.component').then((m) => m.ProductComponent) },
  { path: 'cart', loadComponent: stub },
  { path: 'checkout', loadComponent: stub },
  { path: 'order/:number', loadComponent: stub },
  { path: 'login', loadComponent: stub },
  { path: 'me/orders', loadComponent: stub },
  { path: 'favorites', loadComponent: stub },
  { path: 'sell', loadComponent: stub },
  { path: '**', component: NotFoundComponent },
];
