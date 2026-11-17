import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

/** Шапка витрины: логотип, поиск, ссылки. Счётчик корзины добавит Task 4. */
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
        <a routerLink="/login">Войти</a>
        <a routerLink="/cart" class="cart">Корзина</a>
      </nav>
    </header>
  `,
  styles: `
    .hdr { display:flex; gap:16px; align-items:center; padding:12px 16px; border-bottom:1px solid var(--line); position:sticky; top:0; background:var(--bg); z-index:10 }
    .logo { font-weight:800; font-size:22px; color:var(--text); text-decoration:none }
    .search { flex:1 } .search input { width:100%; padding:10px 14px; border:1px solid var(--line); border-radius:999px; background:var(--surface) }
    .nav { display:flex; gap:14px } .nav a { color:var(--text); text-decoration:none; font-size:14px }
    @media (max-width: 640px) { .nav a:not(.cart) { display:none } }
  `,
})
export class HeaderComponent {
  private readonly router = inject(Router);
  q = '';
  search(): void {
    const q = this.q.trim();
    if (q) this.router.navigate(['/search'], { queryParams: { q } });
  }
}
