import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { MarketApi } from '../../core/market-api.service';
import { Category } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { IconComponent } from '../../shared/icon.component';

/**
 * Каталог: все категории крупными плитками — вход из вкладки «Каталог» нижней панели.
 * Рендерится на сервере, как остальные публичные страницы. В шапке десктопа ссылки нет — маршрут просто работает.
 */
@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="wrap page-top">
      <h1 class="page-title">Каталог</h1>
      @if (categories(); as list) {
        <ul class="tiles">
          <li><a class="tile tile--all" routerLink="/" fragment="fresh" data-test="all"><span>Все товары</span><app-icon name="chevron-right" [size]="20" /></a></li>
          @for (c of list; track c.slug) {
            <li><a class="tile" [routerLink]="['/c', c.slug]" data-test="category"><span>{{ c.name }}</span><app-icon name="chevron-right" [size]="20" /></a></li>
          }
        </ul>
      } @else if (categories() === null) {
        <p class="muted state">Не удалось загрузить категории. Попробуйте обновить страницу.</p>
        <a class="btn state-btn" routerLink="/" fragment="fresh">Все товары</a>
      } @else {
        <ul class="tiles" aria-hidden="true">@for (n of skeleton; track n) { <li class="skel tile-skel"></li> }</ul>
      }
      <!-- Вход для продавцов: на телефоне первого экрана главной нет, сюда ведёт вкладка «Каталог» -->
      <a class="sell" routerLink="/sell" data-test="sell"><app-icon name="store" [size]="22" /><span><span class="sell-t">Продавцам</span><span class="sell-s">У вас Instagram-магазин? Откройте лавку на Хариде</span></span><app-icon class="sell-go" name="chevron-right" [size]="20" /></a>
    </div>
  `,
  styles: `
    .tiles { margin-top: 24px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px }
    @media (min-width: 640px) { .tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px } }
    @media (min-width: 1024px) { .tiles { grid-template-columns: repeat(4, minmax(0, 1fr)) } }
    /* Плитка: фон mist, крупная подпись и стрелка; высота 88px — попасть пальцем легко */
    .tile { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; min-height: 88px; height: 100%; padding: 16px; border-radius: var(--radius-photo); background: var(--color-mist); font-size: 17px; line-height: 1.25; font-weight: 600; overflow-wrap: anywhere; transition: background-color .15s }
    .tile app-icon { flex: none; color: var(--color-ink-soft) }
    @media (hover: hover) { .tile:hover { background: var(--color-line) } }
    .tile:active { background: var(--color-line) }
    .tile--all { background: var(--color-ink); color: var(--color-paper) }
    .tile--all app-icon { color: var(--color-saffron) }
    @media (hover: hover) { .tile--all:hover { background: var(--color-lapis-press) } }
    .tile--all:active { background: var(--color-lapis-press) }
    .tile-skel { min-height: 88px; border-radius: var(--radius-photo) }
    /* Строка «Продавцам»: контур, как вторичная кнопка; высота от 64px */
    .sell { margin-top: 32px; display: flex; align-items: center; gap: 14px; min-height: 64px; padding: 12px 16px; border: 1px solid var(--color-line); border-radius: var(--radius-photo); line-height: 1.35 }
    @media (hover: hover) { .sell:hover { border-color: var(--color-ink) } }
    .sell > app-icon:first-child { color: var(--color-lapis) }
    .sell-t { display: block; font-weight: 600 }
    .sell-s { display: block; font-size: 14px; color: var(--color-ink-soft) }
    .sell-go { margin-left: auto; color: var(--color-ink-soft) }
    .state { margin-top: 16px }
    .state-btn { margin-top: 20px }
  `,
})
export class CatalogComponent {
  private readonly api = inject(MarketApi);
  /** undefined — грузится, null — ошибка, массив — категории. На сервере запрос ждётся, и плитки уходят в HTML. */
  readonly categories = toSignal<Category[] | null | undefined>(this.api.categories().pipe(catchError(() => of(null))), { initialValue: undefined });
  readonly skeleton = [1, 2, 3, 4, 5, 6];
  constructor() {
    inject(SeoService).set({ title: 'Каталог — Харид', description: 'Все категории товаров Instagram-лавок Таджикистана с оплатой наличными курьеру.' });
  }
}
