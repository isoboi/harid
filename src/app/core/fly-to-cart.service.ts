import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';

/** Прямоугольник на экране — то, что отдаёт getBoundingClientRect(). */
export interface Box { left: number; top: number; width: number; height: number }

/** Сторона летящей картинки, px (меньше — если источник меньше). */
export const GHOST_SIZE = 88;
/** Сторона летящей точки, когда источник — кнопка, а не фото. */
export const DOT_SIZE = 32;
/** Полёт и «подпрыгивание» значка корзины, мс. Ease-in: ускоряется к корзине, как будто её затягивает. */
export const FLY_MS = 560;
export const BUMP_MS = 320;
const FLY_EASING = 'cubic-bezier(.5, 0, .75, 0)';
const BUMP_EASING = 'cubic-bezier(.34, 1.56, .64, 1)';

const center = (b: Box) => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });

/** Сдвиг от центра источника к центру значка и во сколько раз сжаться до его размера. */
export function flightPath(from: Box, to: Box, size: number): { dx: number; dy: number; scale: number } {
  const a = center(from);
  const b = center(to);
  const scale = Math.min(1, Math.max(0.12, Math.max(to.width, to.height) / size));
  return { dx: b.x - a.x, dy: b.y - a.y, scale };
}

/** Центр источника на экране: иначе фото, наполовину уехавшее за край, запустило бы полёт из пустоты. */
function onScreen(b: Box, vw: number, vh: number): boolean {
  const c = center(b);
  return b.width > 0 && b.height > 0 && c.x >= 0 && c.x <= vw && c.y >= 0 && c.y <= vh;
}

/**
 * Товар «улетает» в корзину: уменьшенное фото (или точка, если источник — кнопка) летит к значку корзины,
 * в конце значок подпрыгивает. Значки помечены `data-cart-target`: в нижней панели телефона и в шапке.
 * Летим к последнему видимому — на телефоне это нижняя панель (она всегда на экране), на десктопе — шапка.
 * Только transform и opacity, поэтому анимация идёт на видеокарте и не дёргает вёрстку.
 * Без движения (на сервере, без Web Animations, при «уменьшить движение») ничего не делает:
 * счётчик на значке и так обновился. Источники передаются по порядку предпочтения; берётся первый, чей центр на экране.
 */
@Injectable({ providedIn: 'root' })
export class FlyToCart {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly doc = inject(DOCUMENT);

  fly(...sources: (Element | null | undefined)[]): void {
    if (!this.browser || this.calm()) return;
    const win = this.doc.defaultView;
    if (!win) return;
    const target = this.target();
    if (!target) return;
    const from = sources.find((s): s is Element => !!s && onScreen(s.getBoundingClientRect(), win.innerWidth, win.innerHeight));
    if (!from) return;

    const src = from.getBoundingClientRect();
    const img = from instanceof HTMLImageElement ? from : from.querySelector('img');
    const ghost = img ? this.photo(img) : this.dot();
    const size = img ? Math.max(24, Math.min(GHOST_SIZE, src.width, src.height)) : DOT_SIZE;
    if (typeof ghost.animate !== 'function') return;

    const c = center(src);
    const { dx, dy, scale } = flightPath(src, (target.querySelector('app-icon') ?? target).getBoundingClientRect(), size);
    Object.assign(ghost.style, {
      position: 'fixed', left: `${c.x - size / 2}px`, top: `${c.y - size / 2}px`, width: `${size}px`, height: `${size}px`,
      margin: '0', zIndex: '1000', pointerEvents: 'none', willChange: 'transform, opacity',
    });
    ghost.setAttribute('aria-hidden', 'true');
    this.doc.body.appendChild(ghost);

    let done = false;
    const finish = (landed: boolean) => {
      if (done) return;
      done = true;
      ghost.remove();
      if (landed) this.bump(target);
    };
    const flight = ghost.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.4 },
      ],
      { duration: FLY_MS, easing: FLY_EASING, fill: 'forwards' },
    );
    flight.onfinish = () => finish(true);
    flight.oncancel = () => finish(false);
    // Страховка: вкладку свернули или анимацию сняли — летающий элемент не должен застрять на экране
    win.setTimeout(() => finish(false), FLY_MS + 500);
  }

  private calm(): boolean {
    const win = this.doc.defaultView;
    return !win || (typeof win.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /** Последний из помеченных значков, который сейчас виден (у скрытого размер нулевой). */
  private target(): HTMLElement | null {
    const all = Array.from(this.doc.querySelectorAll<HTMLElement>('[data-cart-target]'));
    const visible = all.filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    return visible[visible.length - 1] ?? null;
  }

  /** Копия фото без атрибутов исходного <img>: стили страницы на неё не действуют. */
  private photo(img: HTMLImageElement): HTMLImageElement {
    const ghost = this.doc.createElement('img');
    ghost.src = img.currentSrc || img.src;
    ghost.referrerPolicy = img.referrerPolicy;
    ghost.alt = '';
    Object.assign(ghost.style, { objectFit: 'cover', borderRadius: '14px', boxShadow: '0 6px 20px rgb(0 0 0 / .25)', background: 'var(--color-mist)' });
    return ghost;
  }

  private dot(): HTMLElement {
    const ghost = this.doc.createElement('div');
    Object.assign(ghost.style, { borderRadius: '50%', background: 'var(--color-saffron)', boxShadow: '0 4px 14px rgb(0 0 0 / .25)' });
    return ghost;
  }

  /** Значок корзины «принимает» товар: быстро вырастает и возвращается. */
  private bump(target: HTMLElement): void {
    if (typeof target.animate !== 'function') return;
    target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.22)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: BUMP_MS, easing: BUMP_EASING });
  }
}
