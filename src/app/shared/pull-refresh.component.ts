import { DOCUMENT } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { IconComponent } from './icon.component';

/** Сколько «резинки» нужно вытянуть, чтобы отпускание запустило обновление. */
export const PULL_TRIGGER = 56;
/** Дальше этого индикатор не тянется. */
export const PULL_MAX = 96;
/** Сдвиг пальца, с которого движение считается жестом, а не дрожанием. */
export const PULL_START = 8;
/** Индикатор движется медленнее пальца, чем сильнее тянут — тем туже. */
const RESISTANCE = 0.55;
/** Куда не реагируем: поля ввода, списки подсказок и всё модальное. */
const IGNORE = 'input, textarea, select, [role="listbox"], [aria-modal="true"], dialog';
/** Класс на <html>, пока жест включён: гасит родное «потянуть» браузера, чтобы два обновления не сработали разом. */
export const PULL_ROOT_CLASS = 'ptr';

/** Насколько вытянулся индикатор при смещении пальца dy (px вниз от точки касания). */
export function pullDistance(dy: number): number {
  return Math.min(PULL_MAX, Math.max(0, dy - PULL_START) * RESISTANCE);
}

/** Сайт открыт как установленное приложение: Android/Chrome — display-mode, iOS — navigator.standalone. */
export function isStandalone(win: Window): boolean {
  const nav = win.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || (typeof win.matchMedia === 'function' && win.matchMedia('(display-mode: standalone)').matches);
}

/**
 * «Потянуть вниз, чтобы обновить» для лент. Работает только в установленном приложении (PWA):
 * в обычном браузере есть своё обновление страницы, а в iOS-приложении его нет вовсе.
 * Жест начинается, когда страница прокручена в самый верх и палец идёт вниз заметно больше, чем вбок;
 * отпустили за порогом — наружу уходит событие refresh, пока busy = true индикатор держится на месте.
 * Не мешает прокрутке: слушатели пассивные, а «резинку» браузера гасит класс `ptr` на <html> (см. styles.scss).
 * Включается после гидратации, поэтому серверная и первая клиентская разметка совпадают (пусто).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-pull-refresh',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (enabled()) {
      <div class="pull" [class.drag]="pulling()" [style.top.px]="top() - DOT" [style.transform]="'translateY(' + offset() * 0.9 + 'px)'" [style.opacity]="opacity()" aria-hidden="true" data-test="pull">
        <span class="dot" [class.spin]="busy()"><app-icon name="rotate-ccw" [size]="20" [stroke]="2" [style.transform]="busy() ? null : 'rotate(' + offset() * 3 + 'deg)'" /></span>
      </div>
      <p class="sr-only" role="status">{{ status() }}</p>
    }
  `,
  styles: `
    :host { display: contents }
    /* Лежит под шапкой (у неё z-index 30) и выезжает из-под её нижней кромки, а не наезжает на поле поиска */
    .pull { position: fixed; left: 50%; z-index: 20; margin-left: -20px; pointer-events: none; transition: transform .25s cubic-bezier(.2, .8, .2, 1), opacity .2s }
    /* Пока ведут пальцем — индикатор идёт за ним без задержки */
    .pull.drag { transition: none }
    .dot { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 9999px; background: var(--color-paper); color: var(--color-lapis); box-shadow: var(--shadow-pop) }
    @media (prefers-reduced-motion: no-preference) { .dot.spin app-icon { animation: pull-spin .8s linear infinite } }
    @keyframes pull-spin { to { transform: rotate(-360deg) } }
  `,
})
export class PullRefreshComponent {
  private readonly doc = inject(DOCUMENT);
  /** Лента обновляется — индикатор остаётся на экране. */
  readonly busy = input(false);
  /** Тянули достаточно и отпустили. */
  readonly refresh = output<void>();

  /** Сторона кружка индикатора, px. */
  protected readonly DOT = 40;
  readonly enabled = signal(false);
  readonly pulling = signal(false);
  /** Нижняя кромка шапки в начале жеста: от неё индикатор выезжает вниз. */
  readonly top = signal(0);
  private readonly pull = signal(0);
  readonly status = signal('');
  readonly offset = computed(() => (this.busy() ? PULL_TRIGGER : this.pull()));
  readonly opacity = computed(() => Math.min(1, this.offset() / 32));

  private tracking = false;
  private startX = 0;
  private startY = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    // «Обновляем…» и «Готово» для скринридера
    effect(() => {
      const busy = this.busy();
      untracked(() => { if (busy) this.status.set('Обновляем ленту…'); else if (this.status()) this.status.set('Лента обновлена'); });
    });
    afterNextRender(() => {
      const win = this.doc.defaultView;
      if (!win || !isStandalone(win)) return;
      this.enabled.set(true);
      const root = this.doc.documentElement;
      root.classList.add(PULL_ROOT_CLASS);
      const on = (type: string, fn: (e: TouchEvent) => void) => {
        this.doc.addEventListener(type, fn as EventListener, { passive: true });
        destroyRef.onDestroy(() => this.doc.removeEventListener(type, fn as EventListener));
      };
      on('touchstart', (e) => this.start(e));
      on('touchmove', (e) => this.move(e));
      on('touchend', () => this.end());
      on('touchcancel', () => this.cancel());
      destroyRef.onDestroy(() => root.classList.remove(PULL_ROOT_CLASS));
    });
  }

  private scrolled(): boolean { return (this.doc.defaultView?.scrollY ?? 0) > 0; }

  private start(e: TouchEvent): void {
    this.tracking = false;
    if (this.busy() || e.touches.length !== 1 || this.scrolled()) return;
    const target = e.target;
    if (target instanceof Element && target.closest(IGNORE)) return;
    this.startX = e.touches[0].clientX;
    this.startY = e.touches[0].clientY;
    this.top.set(Math.max(0, this.doc.querySelector('app-header')?.getBoundingClientRect().bottom ?? 0));
    this.tracking = true;
  }

  private move(e: TouchEvent): void {
    if (!this.tracking) return;
    // Прокрутили вверх, второй палец или страница уехала — это уже не жест обновления
    if (e.touches.length !== 1 || this.scrolled()) return this.cancel();
    const dy = e.touches[0].clientY - this.startY;
    const dx = e.touches[0].clientX - this.startX;
    if (!this.pulling()) {
      if (dy < 0) { this.tracking = false; return; }
      if (dy <= PULL_START || Math.abs(dx) > dy) return;
      this.pulling.set(true);
    }
    this.pull.set(pullDistance(dy));
  }

  private end(): void {
    if (!this.tracking) return;
    const fire = this.pulling() && this.pull() >= PULL_TRIGGER;
    this.cancel();
    if (fire) this.refresh.emit();
  }

  private cancel(): void {
    this.tracking = false;
    this.pulling.set(false);
    this.pull.set(0);
  }
}
