import { Routes } from '@angular/router';
import { NotFoundComponent } from './pages/not-found/not-found.component';

const stub = () => import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent);

/**
 * Страницы подключаются в своих задачах; пока все ведут на заглушку.
 * Пути из app.routes.server.ts обязаны существовать и здесь, иначе сборка падает.
 */
export const routes: Routes = [
  { path: '', loadComponent: stub },
  { path: 'cart', loadComponent: stub },
  { path: 'checkout', loadComponent: stub },
  { path: 'order/:number', loadComponent: stub },
  { path: 'login', loadComponent: stub },
  { path: 'me/orders', loadComponent: stub },
  { path: 'favorites', loadComponent: stub },
  { path: 'sell', loadComponent: stub },
  { path: '**', component: NotFoundComponent },
];
