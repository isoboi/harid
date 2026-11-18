import { afterNextRender, ChangeDetectorRef, Component, computed, DestroyRef, inject, NgZone, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { CartService } from '../core/cart.service';
import { HeaderScrollState, nextHeaderState } from './header-scroll';
import { IconComponent } from './icon.component';
import { LogoComponent } from './logo.component';

/**
 * Шапка как в прототипе: бирка-логотип «харид», поиск и иконки справа.
 * Одна разметка на все ширины. До 640px шапка в две строки — логотип, под ним поиск, а иконки уходят
 * в нижнюю панель (app-tab-bar); при прокрутке вниз шапка уезжает вверх, при прокрутке вверх возвращается.
 * На планшете подписи «Войти»/«Корзина» видны, «Продавцам» — от 1024px (на телефоне — в подвале и в первом экране).
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, FormsModule, IconComponent, LogoComponent],
  template: `
    <header class="hdr" [class.hdr--up]="hidden()" (focusin)="onFocus(true)" (focusout)="onFocus(false)">
      <div class="wrap row">
        <app-logo />
        <form class="search" role="search" (ngSubmit)="search()">
          <label class="box">
            <app-icon class="search-icon" name="search" [size]="18" />
            <span class="sr-only">Поиск по товарам</span>
            <input name="q" type="search" enterkeyhint="search" [(ngModel)]="q" placeholder="Платье, кроссовки, @магазин" />
          </label>
        </form>
        <nav class="nav" aria-label="Основное меню">
          <a routerLink="/sell" class="sell"><span class="lbl">Продавцам</span></a>
          <a routerLink="/favorites" class="ico-link"><app-icon name="heart" [size]="22" [stroke]="1.8" /><span class="lbl sr-only">Избранное</span></a>
          @if (auth.loggedIn()) {
            <a routerLink="/me/orders" class="ico-link"><app-icon [name]="ordersIcon()" [size]="22" [stroke]="1.8" /><span class="lbl hide-sm">Мои заказы</span></a>
          } @else {
            <a routerLink="/login" class="ico-link"><app-icon [name]="ordersIcon()" [size]="22" [stroke]="1.8" /><span class="lbl hide-sm">Войти</span></a>
          }
          <a routerLink="/cart" class="cart" [attr.aria-label]="cart.count() ? 'Корзина, товаров: ' + cart.count() : null">
            <app-icon name="bag" [size]="22" [stroke]="1.8" />
            <span class="lbl hide-sm">Корзина</span>
            @if (cart.count()) { <span class="badge" aria-hidden="true">{{ badge() }}</span> }
          </a>
        </nav>
      </div>
    </header>
  `,
  styles: `
    .hdr { position: sticky; top: 0; z-index: 30; border-bottom: 1px solid var(--color-line); background: rgb(255 255 255 / .95); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px) }
    .row { display: flex; flex-wrap: wrap; align-items: center; column-gap: 16px; row-gap: 0; padding-block: 12px }
    /* Поиск: h-11 rounded-[10px] bg-mist, кольцо лазури при фокусе */
    .search { order: 3; flex: 1 0 100%; padding-top: 12px }
    .box { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; border-radius: 10px; background: var(--color-mist) }
    .box:focus-within { box-shadow: 0 0 0 2px var(--color-lapis) }
    .search-icon { color: var(--color-ink-soft) }
    /* 16px на всех ширинах: меньший шрифт заставляет iOS Safari увеличивать страницу при фокусе */
    .box input { width: 100%; min-width: 0; height: 100%; border: 0; background: transparent; font-size: 16px; outline: none; -webkit-appearance: none; appearance: none }
    .box input::-webkit-search-cancel-button { -webkit-appearance: none }
    .nav { order: 2; margin-left: auto; display: flex; align-items: center; gap: 2px }
    .nav a { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 44px; min-width: 44px; padding: 0 10px; border-radius: 10px; font-weight: 500; transition: background-color .15s }
    @media (hover: hover) { .nav a:hover { background: var(--color-mist) } }
    .nav .sell { display: none; padding: 0 12px }
    .nav .cart { padding: 0 12px; font-weight: 600 }
    /* Счётчик корзины: шафран с тёмным текстом, как в прототипе */
    .badge { display: grid; place-items: center; height: 24px; min-width: 24px; padding: 0 6px; border-radius: 9999px; background: var(--color-saffron); color: var(--color-ink); font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums }
    /* Узкий экран 640px: подписи только для скринридера, остаются иконки 44×44 */
    @media (max-width: 639.98px) {
      .hide-sm { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap }
      .nav .cart { gap: 4px; padding: 0 10px }
    }
    @media (min-width: 640px) { .nav { gap: 4px } }
    @media (min-width: 768px) {
      .row { flex-wrap: nowrap }
      .search { order: 1; flex: 1 1 auto; max-width: 520px; padding: 0 0 0 24px }
    }
    @media (min-width: 1024px) { .nav .sell { display: inline-flex } }
    /* Телефон: логотип первой строкой, поиск во всю ширину второй (базовая раскладка), иконки — в нижней панели */
    @media (max-width: 640px) {
      /* Липнет сам хост: у .hdr внутри app-header нет высоты для прилипания (родитель ровно с шапку) */
      :host { position: sticky; top: 0; z-index: 30; display: block }
      .nav { display: none }
    }
    /* Уезжает вверх только на телефоне и только без «уменьшить движение» — иначе просто стоит на месте */
    @media (max-width: 640px) and (prefers-reduced-motion: no-preference) {
      .hdr { transition: transform .25s cubic-bezier(.2, .8, .2, 1) }
      .hdr--up { transform: translateY(-100%) }
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
  /** Шапка уехала вверх (действует только на телефоне, см. стили). На сервере и в первом кадре — видна. */
  readonly hidden = signal(false);
  private focused = false;
  private state: HeaderScrollState = { hidden: false, lastY: 0 };

  constructor() {
    const zone = inject(NgZone);
    const cdr = inject(ChangeDetectorRef);
    const destroyRef = inject(DestroyRef);
    // Слушатель прокрутки — только в браузере и после гидратации; пассивный, вне зоны Angular, раз в кадр
    afterNextRender(() => {
      let frame = 0;
      const apply = () => {
        frame = 0;
        const next = nextHeaderState(this.state, window.scrollY, this.focused);
        this.state = next;
        if (next.hidden === this.hidden()) return;
        // Перерисовываем только шапку: глобальный цикл обнаружения изменений ради одного класса не нужен
        this.hidden.set(next.hidden);
        cdr.detectChanges();
      };
      const onScroll = () => { if (!frame) frame = requestAnimationFrame(apply); };
      zone.runOutsideAngular(() => window.addEventListener('scroll', onScroll, { passive: true }));
      destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', onScroll);
        if (frame) cancelAnimationFrame(frame);
      });
    });
  }

  /** Фокус в шапке (поиск, ссылки с клавиатуры) — шапка не прячется. */
  onFocus(on: boolean): void {
    this.focused = on;
    if (on) {
      this.state = { hidden: false, lastY: this.state.lastY };
      this.hidden.set(false);
    }
  }

  search(): void {
    const q = this.q.trim();
    if (q) this.router.navigate(['/search'], { queryParams: { q } });
  }
}
