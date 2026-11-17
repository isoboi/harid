import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { CartService } from '../core/cart.service';
import { IconComponent } from './icon.component';

/** Шапка витрины: логотип, поиск, ссылки с иконками, счётчик корзины и вход/личный кабинет. */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, FormsModule, IconComponent],
  template: `
    <header class="hdr">
      <a routerLink="/" class="logo" aria-label="Харид — на главную">Харид</a>
      <form class="search" (ngSubmit)="search()">
        <app-icon class="search-icon" name="search" [size]="18" />
        <input name="q" [(ngModel)]="q" placeholder="Поиск по товарам" aria-label="Поиск по товарам" />
      </form>
      <nav class="nav">
        <a routerLink="/sell"><app-icon name="store" [size]="20" /><span class="lbl">Продавцам</span></a>
        <a routerLink="/favorites"><app-icon name="heart" [size]="20" /><span class="lbl">Избранное</span></a>
        @if (auth.loggedIn()) {
          <a routerLink="/me/orders"><app-icon name="user" [size]="20" /><span class="lbl">Мои заказы</span></a>
        } @else {
          <a routerLink="/login"><app-icon name="user" [size]="20" /><span class="lbl">Войти</span></a>
        }
        <a routerLink="/cart" class="cart">
          <span class="ico"><app-icon name="bag" [size]="20" />@if (cart.count()) { <span class="badge">{{ cart.count() }}</span> }</span>
          <span class="lbl">Корзина</span>
        </a>
      </nav>
    </header>
  `,
  styles: `
    .hdr { display:flex; gap:16px; align-items:center; padding:12px 16px; border-bottom:1px solid var(--line); position:sticky; top:0; background:var(--bg); z-index:10 }
    .logo { font-weight:800; font-size:22px; color:var(--text); text-decoration:none }
    /* Иконка лупы внутри поля слева; отступ слева у input под неё */
    .search { flex:1; min-width:0; position:relative }
    .search input { width:100%; padding:10px 14px 10px 42px; border:1px solid var(--line); border-radius:999px; background:var(--surface) }
    .search-icon { position:absolute; left:14px; top:50%; transform:translateY(-50%); color:var(--muted); pointer-events:none }
    .nav { display:flex; gap:14px }
    .nav a { display:inline-flex; align-items:center; gap:6px; color:var(--text); text-decoration:none; font-size:14px }
    /* Обёртка иконки корзины: бейдж позиционируется относительно неё */
    .ico { position:relative; display:inline-flex }
    .badge { position:absolute; top:-7px; right:-9px; min-width:16px; height:16px; padding:0 4px; border-radius:999px; background:var(--accent); color:#fff; font-size:10px; font-weight:600; line-height:16px; text-align:center; box-sizing:border-box }
    /* Телефон: ссылки не прячем, а переносим второй строкой под логотип и поиск; иконка над подписью */
    @media (max-width: 640px) {
      .hdr { flex-wrap:wrap; gap:8px 12px; padding:8px 12px }
      .logo { font-size:20px }
      .nav { order:3; flex:0 0 100%; gap:8px }
      .nav a { flex:1 1 0; min-width:0; flex-direction:column; justify-content:center; gap:3px; font-size:11px; line-height:1.2 }
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
