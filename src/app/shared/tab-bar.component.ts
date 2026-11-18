import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { CartService } from '../core/cart.service';
import { IconComponent } from './icon.component';

/** Путь без query и якоря: «/checkout?x=1» → «/checkout». */
export function pathOf(url: string): string {
  return url.split(/[?#]/)[0] || '/';
}

/**
 * Нижняя панель навигации для телефона: пять вкладок в зоне большого пальца.
 * Разметка рендерится всегда (сервер и первый кадр клиента совпадают), показывают её только стили до 640px.
 * На /checkout панели нет совсем — кнопка «Заказать» ничем не перекрыта. Пока открыта клавиатура
 * (фокус в поле ввода), панель прячет глобальное правило в styles.scss.
 */
@Component({
  selector: 'app-tab-bar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    @if (!onCheckout()) {
      <nav class="tabbar" aria-label="Основная навигация">
        <a class="tab" routerLink="/" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">
          <app-icon name="house" [size]="22" [stroke]="1.8" /><span class="lbl">Главная</span>
        </a>
        <!-- Каталог горит и на /catalog, и внутри любой категории /c/… -->
        <a class="tab" routerLink="/catalog" [class.on]="catalogActive()" [attr.aria-current]="catalogActive() ? 'page' : null">
          <app-icon name="layout-grid" [size]="22" [stroke]="1.8" /><span class="lbl">Каталог</span>
        </a>
        <a class="tab" routerLink="/favorites" routerLinkActive="on" ariaCurrentWhenActive="page">
          <app-icon name="heart" [size]="22" [stroke]="1.8" /><span class="lbl">Избранное</span>
        </a>
        <a class="tab" routerLink="/cart" routerLinkActive="on" ariaCurrentWhenActive="page" [attr.aria-label]="cart.count() ? 'Корзина, товаров: ' + cart.count() : null">
          <span class="ico"><app-icon name="bag" [size]="22" [stroke]="1.8" />
            @if (cart.count()) { <span class="badge" aria-hidden="true">{{ badge() }}</span> }
          </span>
          <span class="lbl">Корзина</span>
        </a>
        @if (auth.loggedIn()) {
          <a class="tab" routerLink="/me/orders" routerLinkActive="on" ariaCurrentWhenActive="page">
            <app-icon name="package" [size]="22" [stroke]="1.8" /><span class="lbl">Заказы</span>
          </a>
        } @else {
          <a class="tab" routerLink="/login" routerLinkActive="on" ariaCurrentWhenActive="page">
            <app-icon name="user" [size]="22" [stroke]="1.8" /><span class="lbl">Войти</span>
          </a>
        }
      </nav>
    }
  `,
  styles: `
    .tabbar { display: none }
    @media (max-width: 640px) {
      /* Белая панель с волосяной линией сверху; высота 60px плюс полоса «домой» у iPhone */
      .tabbar { position: fixed; inset: auto 0 0; z-index: 40; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); height: calc(var(--tabbar-h) + env(safe-area-inset-bottom)); padding: 0 max(4px, env(safe-area-inset-right)) env(safe-area-inset-bottom) max(4px, env(safe-area-inset-left)); border-top: 1px solid var(--color-line); background: var(--color-paper) }
    }
    .tab { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; min-width: 0; height: var(--tabbar-h); border-radius: 10px; color: var(--color-ink-soft) }
    .tab:focus-visible { outline-offset: -4px }
    .lbl { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; line-height: 1.2; font-weight: 500 }
    /* Активная вкладка: лазурь и короткая планка у верхнего края */
    .tab.on { color: var(--color-lapis) }
    .tab.on .lbl { font-weight: 600 }
    .tab.on::before { content: ''; position: absolute; top: 0; left: 50%; width: 28px; height: 3px; margin-left: -14px; border-radius: 0 0 3px 3px; background: var(--color-lapis) }
    .tab:active { background: var(--color-mist) }
    .ico { position: relative; display: inline-flex }
    /* Счётчик корзины — тот же шафрановый бейдж, что в шапке, только компактнее */
    .badge { position: absolute; top: -6px; left: 14px; display: grid; place-items: center; height: 18px; min-width: 18px; padding: 0 5px; border: 2px solid var(--color-paper); border-radius: 9999px; box-sizing: content-box; background: var(--color-saffron); color: var(--color-ink); font-size: 11px; line-height: 1; font-weight: 700; font-variant-numeric: tabular-nums }
  `,
})
export class TabBarComponent {
  private readonly router = inject(Router);
  readonly cart = inject(CartService);
  readonly auth = inject(AuthService);
  /** Текущий путь после каждого перехода. */
  private readonly path = toSignal(
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), map((e) => pathOf(e.urlAfterRedirects))),
    { initialValue: pathOf(this.router.url) },
  );
  readonly onCheckout = computed(() => this.path() === '/checkout');
  readonly catalogActive = computed(() => { const p = this.path(); return p === '/catalog' || p.startsWith('/c/'); });
  /** Больше 99 в бейдж не помещается — «99+». */
  readonly badge = computed(() => { const n = this.cart.count(); return n > 99 ? '99+' : String(n); });
}
