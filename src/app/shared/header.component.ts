import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { CartService } from '../core/cart.service';
import { IconComponent } from './icon.component';

/**
 * Шапка витрины: логотип, поиск и навигация.
 * На десктопе ссылки стоят в строке шапки; на телефоне (≤640px) та же навигация
 * становится закреплённой нижней панелью в зоне большого пальца — разметка одна, меняется только CSS,
 * поэтому серверный рендер и первый рендер клиента совпадают.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, FormsModule, IconComponent],
  template: `
    <header class="hdr">
      <a routerLink="/" class="logo" aria-label="Харид — на главную">Харид</a>
      <form class="search" role="search" (ngSubmit)="search()">
        <app-icon class="search-icon" name="search" [size]="18" />
        <input name="q" type="search" enterkeyhint="search" [(ngModel)]="q" placeholder="Поиск по товарам" aria-label="Поиск по товарам" />
      </form>
      <nav class="nav" aria-label="Основное меню">
        <a routerLink="/favorites"><app-icon name="heart" [size]="22" /><span class="lbl">Избранное</span></a>
        @if (auth.loggedIn()) {
          <a routerLink="/me/orders"><app-icon [name]="ordersIcon()" [size]="22" /><span class="lbl">Мои заказы</span></a>
        } @else {
          <a routerLink="/login"><app-icon [name]="ordersIcon()" [size]="22" /><span class="lbl">Войти</span></a>
        }
        <a routerLink="/cart" class="cart" [attr.aria-label]="cart.count() ? 'Корзина, товаров: ' + cart.count() : null">
          <span class="ico"><app-icon name="bag" [size]="22" />@if (cart.count()) { <span class="badge" aria-hidden="true">{{ badge() }}</span> }</span>
          <span class="lbl">Корзина</span>
        </a>
        <a routerLink="/sell"><app-icon name="store" [size]="22" /><span class="lbl">Продавцам</span></a>
      </nav>
    </header>
  `,
  styles: `
    .hdr { display:flex; gap:16px; align-items:center; padding:10px 16px; border-bottom:1px solid var(--line); position:sticky; top:0; background:var(--bg); z-index:10 }
    .logo { font-weight:700; font-size:22px; letter-spacing:-0.02em; color:var(--text); text-decoration:none }
    /* Иконка лупы внутри поля слева; отступ слева у input под неё */
    .search { flex:1; min-width:0; position:relative }
    /* 16px на всех ширинах: меньший шрифт заставляет iOS Safari увеличивать страницу при фокусе */
    .search input { width:100%; height:44px; padding:0 14px 0 42px; border:1px solid var(--line); border-radius:999px; background:var(--surface); font:inherit; font-size:16px; color:var(--text); -webkit-appearance:none; appearance:none }
    .search input::-webkit-search-cancel-button { -webkit-appearance:none }
    /* Подсказка #6b6b6b на #f6f6f4 — 4.9:1 */
    .search input::placeholder { color:var(--muted); opacity:1 }
    .search input:focus-visible { outline:2px solid var(--text); outline-offset:1px }
    .search-icon { position:absolute; left:14px; top:50%; transform:translateY(-50%); color:var(--muted); pointer-events:none }
    .nav { display:flex; gap:4px }
    .nav a { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-width:44px; min-height:44px; padding:0 8px; border-radius:999px; color:var(--text); text-decoration:none; font-size:14px }
    .nav a:focus-visible { outline:2px solid var(--text); outline-offset:-2px }
    @media (hover:hover) { .nav a:hover { background:var(--surface) } }
    /* Обёртка иконки корзины: бейдж позиционируется относительно неё */
    .ico { position:relative; display:inline-flex }
    /* В строке шапки бейдж выступает вправо — отодвигаем подпись, чтобы «99+» её не перекрывал */
    .cart .ico { margin-right:6px }
    /* Бейдж: белый жирный 11px на #c9341f — 5.3:1 */
    .badge { position:absolute; top:-8px; right:-11px; min-width:18px; height:18px; padding:0 5px; border-radius:999px; background:var(--accent-strong); color:#fff; font-size:11px; font-weight:700; line-height:18px; text-align:center; font-variant-numeric:tabular-nums; box-shadow:0 0 0 2px var(--bg) }
    /* Телефон: сверху только логотип и поиск, навигация — нижняя панель с иконкой над подписью */
    @media (max-width: 640px) {
      .hdr { gap:12px; padding:7px 12px }
      .logo { font-size:20px }
      .nav { position:fixed; left:0; right:0; bottom:0; z-index:20; gap:0; background:var(--bg); border-top:1px solid var(--line);
        padding:4px max(4px, env(safe-area-inset-right)) max(4px, env(safe-area-inset-bottom)) max(4px, env(safe-area-inset-left)) }
      .nav a { flex:1 1 0; min-width:0; min-height:52px; flex-direction:column; gap:3px; padding:4px 2px; border-radius:12px; font-size:12px; line-height:1.15 }
      .cart .ico { margin-right:0 }
      .lbl { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
    }
  `,
})
export class HeaderComponent {
  private readonly router = inject(Router);
  readonly cart = inject(CartService);
  readonly auth = inject(AuthService);
  /** Вошедшему — коробка «Мои заказы», гостю — человечек «Войти». */
  readonly ordersIcon = computed(() => (this.auth.loggedIn() ? 'package' : 'user'));
  /** Счётчик корзины: больше 99 не помещается в бейдж — показываем «99+». */
  readonly badge = computed(() => { const n = this.cart.count(); return n > 99 ? '99+' : String(n); });
  q = '';
  search(): void {
    const q = this.q.trim();
    if (q) this.router.navigate(['/search'], { queryParams: { q } });
  }
}
