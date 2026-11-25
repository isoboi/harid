import { DOCUMENT } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, OnInit, output, signal, viewChild } from '@angular/core';
import { IconComponent } from './icon.component';

/** Пределы увеличения и шаг двойного нажатия. */
export const MAX_SCALE = 4;
export const TAP_SCALE = 2.5;
/** Сдвиг пальца вбок, после которого отпускание листает фото. */
export const SWIPE_X = 60;
/** Сдвиг вниз, после которого отпускание закрывает просмотр. */
export const CLOSE_Y = 100;
/** Окно двойного нажатия и допустимое дрожание пальца между нажатиями. */
const DOUBLE_TAP_MS = 300;
const TAP_SLOP = 10;

export interface Pan { x: number; y: number }

/**
 * Сдвиг увеличенного фото не даёт краю картинки отойти от края экрана.
 * Масштаб считается от центра (transform-origin: center), поэтому запас — половина «лишнего» размера.
 */
export function clampPan(pan: Pan, scale: number, w: number, h: number): Pan {
  const mx = (w * scale - w) / 2;
  const my = (h * scale - h) / 2;
  return { x: Math.min(mx, Math.max(-mx, pan.x)), y: Math.min(my, Math.max(-my, pan.y)) };
}

/**
 * Новый сдвиг, чтобы точка под пальцем (p — от центра экрана) осталась на месте при смене масштаба s0 → s1.
 * Точка картинки под пальцем: c = (p - pan) / s0; после: pan' = p - c * s1.
 */
export function zoomAt(pan: Pan, s0: number, s1: number, p: Pan): Pan {
  return { x: p.x - ((p.x - pan.x) / s0) * s1, y: p.y - ((p.y - pan.y) / s0) * s1 };
}

export function clampScale(s: number): number { return Math.min(MAX_SCALE, Math.max(1, s)); }

/**
 * Фото товара на весь экран: листание свайпом и стрелками, увеличение щипком, двойным нажатием или колёсиком,
 * перетаскивание увеличенного фото. Закрывается крестиком, Esc и свайпом вниз.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-photo-viewer',
  standalone: true,
  imports: [IconComponent],
  host: { '(document:keydown)': 'key($event)' },
  template: `
    <div #stage class="stage" role="dialog" aria-modal="true" [attr.aria-label]="'Фото: ' + alt()" data-test="photo-viewer"
      [class.moving]="moving()" (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up($event)" (pointercancel)="up($event)" (wheel)="wheel($event)">
      <div class="track" [style.transform]="'translate3d(calc(' + (-index() * 100) + '% + ' + dx() + 'px), ' + dy() + 'px, 0)'" [style.opacity]="dy() ? 1 - dy() / 600 : null">
        @for (src of photos(); track $index; let i = $index) {
          <div class="slide" [attr.aria-hidden]="i !== index()">
            <img [src]="src" [alt]="alt() + ' — фото ' + (i + 1)" draggable="false" data-test="viewer-img"
              [style.transform]="i === index() && scale() > 1 ? 'translate(' + pan().x + 'px, ' + pan().y + 'px) scale(' + scale() + ')' : null" />
          </div>
        }
      </div>
      @if (photos().length > 1) {
        <p class="count" data-test="viewer-count">{{ index() + 1 }} / {{ photos().length }}</p>
        <button type="button" class="nav prev" aria-label="Предыдущее фото" [disabled]="index() === 0" (click)="go(-1)"><app-icon name="chevron-left" [size]="28" /></button>
        <button type="button" class="nav next" aria-label="Следующее фото" [disabled]="index() === photos().length - 1" (click)="go(1)"><app-icon name="chevron-right" [size]="28" /></button>
      }
      <button #closeBtn type="button" class="close" data-test="viewer-close" aria-label="Закрыть" (click)="close()"><app-icon name="x" [size]="24" /></button>
    </div>
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 100; background: rgb(0 0 0 / .94) }
    /* Все жесты внутри — наши: листание, щипок и перетаскивание, страница под окном не двигается */
    .stage { position: absolute; inset: 0; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none }
    .track { display: flex; height: 100%; transition: transform .25s ease-out, opacity .25s ease-out }
    .moving .track, .moving img { transition: none }
    @media (prefers-reduced-motion: reduce) { .track, img { transition: none } }
    .slide { flex: 0 0 100%; height: 100%; overflow: hidden }
    /* Картинка во весь экран с contain: фото любой пропорции вписано целиком, а рамка зума совпадает с экраном */
    img { display: block; width: 100%; height: 100%; object-fit: contain; transform-origin: center; transition: transform .2s ease-out; -webkit-user-drag: none }
    .count { position: absolute; top: calc(20px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); padding: 4px 12px; border-radius: 9999px; background: rgb(0 0 0 / .45); color: #fff; font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums }
    .close, .nav { position: absolute; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: rgb(0 0 0 / .45); color: #fff }
    .close { top: calc(12px + env(safe-area-inset-top)); right: 12px }
    .nav { top: 50%; margin-top: -22px }
    .prev { left: 12px } .next { right: 12px }
    .nav:disabled { opacity: 0; pointer-events: none }
    /* На телефоне листают пальцем — стрелки только мешают смотреть */
    @media (hover: none) { .nav { display: none } }
    .close:focus-visible, .nav:focus-visible { outline: 2px solid #fff; outline-offset: 2px }
  `,
})
export class PhotoViewerComponent implements OnInit {
  readonly photos = input.required<string[]>();
  readonly start = input(0);
  readonly alt = input('');
  /** Закрыли — с номером фото, на котором остановились (галерея страницы переключится на него). */
  readonly closed = output<number>();

  private readonly doc = inject(DOCUMENT);
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly closeBtn = viewChild.required<ElementRef<HTMLButtonElement>>('closeBtn');
  private readonly opener = this.doc.activeElement as HTMLElement | null;
  private readonly pageOverflow = this.doc.body?.style.overflow ?? '';

  readonly index = signal(0);
  readonly scale = signal(1);
  readonly pan = signal<Pan>({ x: 0, y: 0 });
  /** Сдвиг ленты пальцем (листание) и вниз (закрытие), пока палец на экране. */
  readonly dx = signal(0);
  readonly dy = signal(0);
  readonly moving = signal(false);

  private readonly pointers = new Map<number, Pan>();
  private gesture: 'none' | 'swipe' | 'close' | 'pan' | 'pinch' = 'none';
  private startPoint: Pan = { x: 0, y: 0 };
  private startPan: Pan = { x: 0, y: 0 };
  private startScale = 1;
  private startDist = 0;
  private lastTap = { time: 0, x: 0, y: 0 };

  constructor() {
    afterNextRender(() => {
      this.doc.body.style.overflow = 'hidden';
      this.closeBtn().nativeElement.focus({ preventScroll: true });
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.doc.body) this.doc.body.style.overflow = this.pageOverflow;
      if (this.opener?.isConnected) this.opener.focus({ preventScroll: true });
    });
  }

  ngOnInit(): void {
    // До первой отрисовки, иначе лента сначала покажет первое фото и уедет к нужному
    this.index.set(Math.min(Math.max(0, this.start()), this.photos().length - 1));
  }

  close(): void { this.closed.emit(this.index()); }

  go(step: number): void {
    const next = this.index() + step;
    if (next < 0 || next >= this.photos().length) return;
    this.index.set(next);
    this.resetZoom();
  }

  key(e: KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); this.close(); }
    else if (e.key === 'ArrowLeft') this.go(-1);
    else if (e.key === 'ArrowRight') this.go(1);
    else if (e.key === 'Tab') this.trap(e);
  }

  down(e: PointerEvent): void {
    if ((e.target as Element).closest('button')) return;
    this.stage().nativeElement.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.moving.set(true);
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.gesture = 'pinch';
      this.startDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      this.startScale = this.scale();
      this.startPan = this.pan();
      this.dx.set(0); this.dy.set(0);
      return;
    }
    this.gesture = 'none';
    this.startPoint = { x: e.clientX, y: e.clientY };
    this.startPan = this.pan();
  }

  move(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const box = this.box();
    if (this.gesture === 'pinch' && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const s1 = clampScale(this.startScale * Math.hypot(a.x - b.x, a.y - b.y) / this.startDist);
      const mid = { x: (a.x + b.x) / 2 - box.cx, y: (a.y + b.y) / 2 - box.cy };
      this.scale.set(s1);
      this.pan.set(clampPan(zoomAt(this.startPan, this.startScale, s1, mid), s1, box.w, box.h));
      return;
    }
    const mx = e.clientX - this.startPoint.x;
    const my = e.clientY - this.startPoint.y;
    if (this.gesture === 'none') {
      if (Math.hypot(mx, my) < TAP_SLOP) return;
      // Увеличенное фото тянем; обычное — листаем вбок или закрываем вниз
      this.gesture = this.scale() > 1 ? 'pan' : Math.abs(mx) > Math.abs(my) ? 'swipe' : my > 0 ? 'close' : 'none';
    }
    if (this.gesture === 'pan') this.pan.set(clampPan({ x: this.startPan.x + mx, y: this.startPan.y + my }, this.scale(), box.w, box.h));
    else if (this.gesture === 'swipe') {
      // У крайних фото лента тянется туго — видно, что дальше ничего нет
      const edge = (mx > 0 && this.index() === 0) || (mx < 0 && this.index() === this.photos().length - 1);
      this.dx.set(edge ? mx / 3 : mx);
    } else if (this.gesture === 'close') this.dy.set(Math.max(0, my));
  }

  up(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 1 && this.gesture === 'pinch') {
      // Один палец отпустили — второй продолжает тянуть увеличенное фото с текущего места
      const [rest] = [...this.pointers.values()];
      this.gesture = this.scale() > 1 ? 'pan' : 'none';
      this.startPoint = rest; this.startPan = this.pan();
      return;
    }
    if (this.pointers.size) return;
    this.moving.set(false);
    const gesture = this.gesture;
    this.gesture = 'none';
    if (gesture === 'swipe') {
      const dx = this.dx();
      this.dx.set(0);
      if (dx <= -SWIPE_X) this.go(1);
      else if (dx >= SWIPE_X) this.go(-1);
    } else if (gesture === 'close') {
      const dy = this.dy();
      this.dy.set(0);
      if (dy >= CLOSE_Y) this.close();
    } else if (gesture === 'pinch') {
      if (this.scale() <= 1.05) this.resetZoom();
    } else if (gesture === 'none') this.tap(e);
  }

  /** Колёсико (и щипок на тачпаде — это колёсико с Ctrl) увеличивает к курсору. */
  wheel(e: WheelEvent): void {
    e.preventDefault();
    const box = this.box();
    const s0 = this.scale();
    const s1 = clampScale(s0 * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)));
    this.applyZoom(s0, s1, { x: e.clientX - box.cx, y: e.clientY - box.cy });
  }

  /** Двойное нажатие: увеличить к точке нажатия или вернуть как было. */
  private tap(e: PointerEvent): void {
    const now = e.timeStamp || Date.now();
    const near = Math.hypot(e.clientX - this.lastTap.x, e.clientY - this.lastTap.y) < TAP_SLOP * 3;
    if (now - this.lastTap.time < DOUBLE_TAP_MS && near) {
      this.lastTap = { time: 0, x: 0, y: 0 };
      const box = this.box();
      const s0 = this.scale();
      this.applyZoom(s0, s0 > 1 ? 1 : TAP_SCALE, { x: e.clientX - box.cx, y: e.clientY - box.cy });
      return;
    }
    this.lastTap = { time: now, x: e.clientX, y: e.clientY };
  }

  private applyZoom(s0: number, s1: number, p: Pan): void {
    if (s1 <= 1) { this.resetZoom(); return; }
    const box = this.box();
    this.scale.set(s1);
    this.pan.set(clampPan(zoomAt(this.pan(), s0, s1, p), s1, box.w, box.h));
  }

  private resetZoom(): void { this.scale.set(1); this.pan.set({ x: 0, y: 0 }); }

  private box(): { w: number; h: number; cx: number; cy: number } {
    const r = this.stage().nativeElement.getBoundingClientRect();
    return { w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }

  /** Фокус остаётся в окне: Tab ходит только по его кнопкам. */
  private trap(e: KeyboardEvent): void {
    const nodes = Array.from(this.stage().nativeElement.querySelectorAll<HTMLElement>('button:not([disabled])'));
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = this.doc.activeElement;
    if (e.shiftKey && (active === first || !nodes.includes(active as HTMLElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (active === last || !nodes.includes(active as HTMLElement))) { e.preventDefault(); first.focus(); }
  }
}
