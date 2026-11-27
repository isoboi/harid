import { DOCUMENT } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product, Shop } from '../core/models';
import { TPipe } from '../core/i18n';
import { IconComponent } from './icon.component';
import { PriceTagComponent } from './price-tag.component';
import { ShopAvatarComponent } from './shop-avatar.component';
import { VideoPlayerComponent } from './video-player.component';

/** Главная кнопка под видео: ссылка наружу, переход внутри сайта или обычная кнопка. */
export interface ReelAction { label: string; href?: string; link?: string; disabled?: boolean }

/** На сколько пикселей надо потянуть вниз, чтобы просмотр закрылся; меньше — вернётся на место. */
export const CLOSE_DRAG = 100;
/** С какого сдвига касание считаем свайпом, а не нажатием: пока не дотянули, клики по кнопкам идут как обычно. */
const DRAG_START = 10;

/**
 * Вертикальный просмотр видео товара на весь экран, как в Instagram Reels.
 * Плеер — в варианте reels, поверх видео: лавка, название, цена, кнопка покупки и сердечко.
 * Закрывается крестиком, Esc, нажатием на тёмный фон (на компьютере) и свайпом вниз (на телефоне).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-reel-viewer',
  standalone: true,
  imports: [VideoPlayerComponent, IconComponent, RouterLink, ShopAvatarComponent, PriceTagComponent, TPipe],
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    <div class="scrim" data-test="reel-scrim" (click)="close()"></div>
    <div #stage class="stage" data-test="reel-stage" role="dialog" aria-modal="true" [attr.aria-label]="'Видео: {title}' | t: { title: product().title }"
      [class.dragging]="dragging()" [style.transform]="dragY() ? 'translateY(' + dragY() + 'px)' : null" [style.opacity]="dragY() ? 1 - dragY() / 700 : null"
      (keydown)="trap($event)" (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up()" (pointercancel)="up()">
      <app-video-player variant="reels" [src]="product().video || ''" [poster]="poster()" [label]="'Видео: {title}' | t: { title: product().title }" [autoplay]="true" [likeable]="true" (liked)="liked.emit()">
        <div class="rail">
          <button type="button" class="rail-btn" data-test="reel-fav" [attr.aria-pressed]="favorite()" [attr.aria-label]="favorite() ? ('Убрать из избранного' | t) : ('В избранное' | t)" (click)="toggleFavorite.emit()">
            <app-icon name="heart" [size]="30" [filled]="favorite()" />
          </button>
        </div>
        <div class="info" data-test="reel-info">
          <a class="shop" data-test="reel-shop" [routerLink]="['/shop', product().shop_handle]" (click)="close()">
            <app-shop-avatar [name]="shop()?.name || product().shop_handle" [color]="shop()?.avatar_color || ''" [fresh]="!!shop()?.has_fresh" [avatarUrl]="shop()?.avatar_url" [handle]="product().shop_handle" [size]="36" />
            <span>&#64;{{ product().shop_handle }}</span>
          </a>
          <p class="title" data-test="reel-title">{{ product().title }}</p>
          @if (product().price !== null) { <app-price-tag class="price" [price]="product().price" [old]="product().old_price" size="sm" /> }
          @let a = action();
          @if (a.href) { <a class="btn cta" data-test="reel-cta" [href]="a.href" target="_blank" rel="noopener nofollow" (click)="act.emit()">{{ a.label }}</a> }
          @else if (a.link) { <a class="btn cta" data-test="reel-cta" [routerLink]="a.link" (click)="close()">{{ a.label }}</a> }
          @else { <button type="button" class="btn cta" data-test="reel-cta" [disabled]="a.disabled" (click)="act.emit()">{{ a.label }}</button> }
        </div>
      </app-video-player>
      <button #closeBtn type="button" class="close" data-test="reel-close" [attr.aria-label]="'Закрыть' | t" (click)="close()"><app-icon name="x" [size]="24" /></button>
    </div>
  `,
  styles: `
    /* Весь экран поверх страницы, вкладок и липкой панели покупки */
    :host { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center }
    .scrim { position: absolute; inset: 0; background: rgb(0 0 0 / .86) }
    /* Касания на сцене нужны нам самим (свайп вниз), а не странице под ней */
    .stage { position: relative; width: 100%; height: 100vh; height: 100dvh; overflow: hidden; background: #000; touch-action: none }
    .stage:not(.dragging) { transition: transform .2s ease-out, opacity .2s ease-out }
    @media (prefers-reduced-motion: reduce) { .stage:not(.dragging) { transition: none } }
    @media (min-width: 640px) { .stage { width: auto; height: min(calc(100dvh - 32px), 920px); aspect-ratio: 9 / 16; border-radius: 16px } }
    .close { position: absolute; z-index: 5; top: calc(12px + env(safe-area-inset-top)); right: 12px; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: rgb(0 0 0 / .45); color: #fff }
    .close:focus-visible, .rail-btn:focus-visible, .shop:focus-visible { outline: 2px solid #fff; outline-offset: 2px }
    .rail { position: absolute; right: 8px; bottom: calc(84px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; align-items: center; pointer-events: auto }
    .rail-btn { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; color: #fff; filter: drop-shadow(0 1px 6px rgb(0 0 0 / .55)) }
    .rail-btn[aria-pressed='true'] { color: var(--color-anor) }
    .info { position: absolute; left: 0; right: 64px; bottom: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding: 0 16px calc(32px + env(safe-area-inset-bottom)); color: #fff; pointer-events: none }
    .info > * { pointer-events: auto }
    .shop { display: inline-flex; align-items: center; gap: 10px; border-radius: 8px; font-size: 15px; font-weight: 700; color: #fff; text-shadow: 0 1px 6px rgb(0 0 0 / .55) }
    .title { max-width: 32ch; font-size: 15px; line-height: 1.35; font-weight: 600; text-shadow: 0 1px 6px rgb(0 0 0 / .55); overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden }
    .cta { min-height: 44px }
  `,
})
export class ReelViewerComponent {
  readonly product = input.required<Product>();
  readonly shop = input<Shop | null>(null);
  /** Товар в избранном: сердечко закрашено. */
  readonly favorite = input<boolean>(false);
  readonly action = input.required<ReelAction>();
  /** Просят закрыть: крестик, Esc, фон, свайп вниз или переход в лавку. */
  readonly closed = output<void>();
  /** Нажали главную кнопку (если это не переход по ссылке внутри сайта). */
  readonly act = output<void>();
  readonly toggleFavorite = output<void>();
  /** Двойной тап по видео. */
  readonly liked = output<void>();

  private readonly doc = inject(DOCUMENT);
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly closeBtn = viewChild.required<ElementRef<HTMLButtonElement>>('closeBtn');
  /** Кто был в фокусе до открытия — туда и вернёмся при закрытии. */
  private readonly opener = this.doc.activeElement as HTMLElement | null;
  private readonly pageOverflow = this.doc.body?.style.overflow ?? '';

  protected readonly dragY = signal(0);
  protected readonly dragging = signal(false);
  private startY: number | null = null;
  private swiping = false;

  protected poster(): string { const p = this.product(); return p.images?.[0] || p.image || ''; }

  constructor() {
    afterNextRender(() => {
      // Страница под просмотром не должна прокручиваться
      this.doc.body.style.overflow = 'hidden';
      this.closeBtn().nativeElement.focus({ preventScroll: true });
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.doc.body) this.doc.body.style.overflow = this.pageOverflow;
      if (this.opener?.isConnected) this.opener.focus({ preventScroll: true });
    });
  }

  close(): void { this.closed.emit(); }

  /** Фокус остаётся внутри окна: Tab с последней кнопки идёт на первую и наоборот. */
  trap(e: KeyboardEvent): void {
    if (e.key !== 'Tab') return;
    const nodes = Array.from(this.stage().nativeElement.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])'));
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = this.doc.activeElement;
    if (e.shiftKey && (active === first || !nodes.includes(active as HTMLElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (active === last || !nodes.includes(active as HTMLElement))) { e.preventDefault(); first.focus(); }
  }

  down(e: PointerEvent): void {
    // Мышью окно закрывают крестиком и Esc; свайп — жест пальца
    if (e.pointerType === 'mouse' || !e.isPrimary) return;
    this.startY = e.clientY;
    this.swiping = false;
  }

  move(e: PointerEvent): void {
    if (this.startY === null) return;
    const dy = Math.max(0, e.clientY - this.startY);
    if (!this.swiping && dy < DRAG_START) return;
    if (!this.swiping) {
      // Дальше палец ведёт окно: перехватываем касание, но не раньше — иначе пропадут обычные нажатия на кнопки
      (e.currentTarget as Element | null)?.setPointerCapture?.(e.pointerId);
      this.swiping = true;
      this.dragging.set(true);
    }
    this.dragY.set(dy);
  }

  up(): void {
    if (this.startY === null) return;
    const far = this.dragY() > CLOSE_DRAG;
    this.startY = null;
    this.swiping = false;
    this.dragging.set(false);
    if (far) this.close();
    else this.dragY.set(0);
  }
}
