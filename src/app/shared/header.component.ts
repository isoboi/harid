import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { CartService } from '../core/cart.service';

/** Шапка витрины: логотип, поиск, ссылки, счётчик корзины и вход/личный кабинет. */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <header class="hdr">
      <a routerLink="/" class="logo" aria-label="Харид — на главную">Харид</a>
      <form class="search" (ngSubmit)="search()">
        <input name="q" [(ngModel)]="q" placeholder="Поиск по товарам" aria-label="Поиск по товарам" />
      </form>
      <nav class="nav">
        <a routerLink="/sell">Продавцам</a>
        <a routerLink="/favorites">Избранное</a>
        @if (auth.loggedIn()) {
          <a routerLink="/me/orders">Мои заказы</a>
        } @else {
          <a routerLink="/login">Войти</a>
        }
        <a routerLink="/cart" class="cart">Корзина @if (cart.count()) { <span class="badge">{{ cart.count() }}</span> }</a>
      </nav>
    </header>
  `,
  styles: `
    .hdr { display:flex; gap:16px; align-items:center; padding:12px 16px; border-bottom:1px solid var(--line); position:sticky; top:0; background:var(--bg); z-index:10 }
    .logo { font-weight:800; font-size:22px; color:var(--text); text-decoration:none }
    .search { flex:1; min-width:0 } .search input { width:100%; padding:10px 14px; border:1px solid var(--line); border-radius:999px; background:var(--surface) }
    .nav { display:flex; gap:14px } .nav a { color:var(--text); text-decoration:none; font-size:14px }
    .badge { display:inline-block; min-width:18px; padding:0 5px; margin-left:4px; border-radius:999px; background:var(--text); color:var(--bg); font-size:12px; line-height:18px; text-align:center }
    /* Телефон: ссылки не прячем, а переносим второй строкой под логотип и поиск, компактно */
    @media (max-width: 640px) {
      .hdr { flex-wrap:wrap; gap:8px 12px; padding:8px 12px }
      .logo { font-size:20px }
      .nav { order:3; flex:0 0 100%; justify-content:space-between; gap:8px; flex-wrap:wrap }
      .nav a { font-size:13px }
    }
  `,
})
export class HeaderComponent {
  private readonly router = inject(Router);
  readonly cart = inject(CartService);
  readonly auth = inject(AuthService);
  q = '';
  search(): void {
    const q = this.q.trim();
    if (q) this.router.navigate(['/search'], { queryParams: { q } });
  }
}
