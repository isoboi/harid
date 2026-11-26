import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, DestroyRef, effect, ElementRef, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { IconComponent } from './icon.component';
import { clampTime, formatTime, fromScrubber, scrubberValue, SCRUBBER_MAX, SEEK_STEP } from './video-time';

/** Через сколько миллисекунд бездействия во время игры управление уходит с видео. */
const IDLE_MS = 2500;

/** Сколько ждать второго тапа, прежде чем считать нажатие одиночным (как в Instagram). */
const DOUBLE_TAP_MS = 250;
/** Сколько живёт сердечко после двойного тапа. */
const HEART_MS = 700;

/** iPhone умеет только системный полный экран самого <video>: у него свои кнопки, зато он работает. */
type IosVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/**
 * Плеер видео товара.
 * Ролики приходят из Instagram и чаще вертикальные, а рамка галереи квадратная: боковые поля
 * заливает размытый постер, как в Reels, вместо чёрных полос. Управление — одним рядом снизу,
 * исчезает во время игры и возвращается от касания, движения мыши или Tab.
 *
 * Вариант reels — вертикальный режим как в Instagram: ролик на всю рамку (вертикальный — с обрезкой по краям),
 * без панели кнопок: тонкая линия прогресса у нижнего края, кнопка звука справа, двойной тап — «нравится».
 * Всё, что передано внутрь тега (подпись лавки, цена, кнопка), встаёт поверх видео.
 */
@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [IconComponent],
  host: { '(document:visibilitychange)': 'onVisibility()', '(document:fullscreenchange)': 'onFullscreenChange()' },
  template: `
    <div #frame class="frame" data-test="frame" [class.reels]="reels()" [class.portrait]="portrait()" [class.still]="away()" (pointermove)="wake()" (pointerdown)="wake()" (focusin)="wake()" (keydown)="key($event)">
      @if (poster()) { <img class="ambient" data-test="ambient" [src]="poster()" alt="" aria-hidden="true" /> }
      <video #v data-test="video" [src]="src()" [attr.poster]="poster() || null" preload="none" playsinline loop [attr.aria-label]="label()"
        (play)="onPlay()" (pause)="onPause()" (playing)="waiting.set(false)" (canplay)="waiting.set(false)" (waiting)="waiting.set(true)"
        (timeupdate)="sync()" (durationchange)="sync()" (loadedmetadata)="sync()" (volumechange)="muted.set(video().nativeElement.muted)"
        (emptied)="reset()" (error)="failed.set(true)"></video>
      <button type="button" class="surface" data-test="surface" [attr.aria-label]="playing() ? 'Пауза' : started() ? 'Воспроизвести' : 'Смотреть видео'" (click)="tap($event)"></button>
      @if (!playing() && !failed() && !waiting()) {
        @if (reels()) { <span class="reel-play" data-test="big-play" aria-hidden="true"><app-icon name="play" [size]="76" [filled]="true" /></span> }
        @else { <span class="big" data-test="big-play" aria-hidden="true"><app-icon name="play" [size]="30" [filled]="true" /></span> }
      }
      @for (h of hearts(); track h.id) { <app-icon class="heart" data-test="heart" name="heart" [size]="104" [filled]="true" [style.left.px]="h.x" [style.top.px]="h.y" /> }
      @if (waiting() && !failed()) { <span class="spinner" data-test="spinner" aria-hidden="true"></span> }
      @if (failed()) {
        <div class="fail" data-test="error" role="alert">
          <p>Не удалось загрузить видео</p>
          <button type="button" class="retry" data-test="retry" (click)="retry()"><app-icon name="rotate-ccw" [size]="18" />Повторить</button>
        </div>
      }
      @if (reels()) { <div class="slot" data-test="slot"><ng-content /></div> }
      <div class="bar" data-test="bar" [class.away]="away()">
        @if (!reels()) {
          <button type="button" class="ctl" data-test="toggle" [attr.aria-label]="playing() ? 'Пауза' : 'Воспроизвести'" (click)="toggle()">
            <app-icon [name]="playing() ? 'pause' : 'play'" [size]="22" [filled]="true" />
          </button>
        }
        <span class="scrub">
          <span class="track" aria-hidden="true"><span class="fill" [class.snap]="snap()" [style.width.%]="percent()"></span></span>
          <!-- max задан числом в разметке, а не привязкой: иначе value выставится раньше max и обрежется до 100 (значение — SCRUBBER_MAX) -->
          <input type="range" data-test="scrub" min="0" max="1000" step="1" [value]="scrub()" aria-label="Перемотка" [attr.aria-valuetext]="spoken()" (input)="seek($event)" />
        </span>
        @if (!reels()) { <span class="time" data-test="time">{{ elapsed() }} / {{ total() }}</span> }
        <button type="button" class="ctl mute" data-test="mute" [attr.aria-label]="muted() ? 'Включить звук' : 'Выключить звук'" (click)="toggleMute()">
          <app-icon [name]="muted() ? 'volume-x' : 'volume-2'" [size]="22" />
        </button>
        @if (expandable() && !reels()) {
          <button type="button" class="ctl" data-test="expand" aria-label="Вертикальный режим" (click)="expand.emit()"><app-icon name="smartphone" [size]="22" /></button>
        }
        @if (canFullscreen() && !reels()) {
          <button type="button" class="ctl" data-test="fullscreen" [attr.aria-label]="fullscreen() ? 'Выйти из полноэкранного режима' : 'Во весь экран'" (click)="toggleFullscreen()">
            <app-icon [name]="fullscreen() ? 'minimize' : 'maximize'" [size]="22" />
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; position: relative; width: 100%; height: 100%; color: #fff }
    .frame { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--color-night); container-type: inline-size }
    .frame.still { cursor: none }
    /* Постер, растянутый и размытый, — вместо чёрных полей у вертикального ролика */
    .ambient { position: absolute; inset: -12%; width: 124%; height: 124%; object-fit: cover; filter: blur(28px) saturate(1.3) brightness(.65); pointer-events: none }
    video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; background: transparent }
    .surface { position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; border: 0; background: none; cursor: pointer; -webkit-tap-highlight-color: transparent }
    .surface:focus-visible { outline: 2px solid var(--color-saffron); outline-offset: -4px }
    .big { position: absolute; left: 50%; top: 50%; display: grid; place-items: center; width: 72px; height: 72px; margin: -36px 0 0 -36px; border-radius: 50%; background: var(--color-saffron); color: var(--color-on-saffron); box-shadow: 0 8px 24px rgb(19 35 91 / .35); pointer-events: none }
    /* Треугольник оптически тяжелее слева — сдвигаем, чтобы он стоял по центру круга */
    .big app-icon { margin-left: 4px }
    .spinner { position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; margin: -22px 0 0 -22px; border: 3px solid rgb(255 255 255 / .3); border-top-color: var(--color-saffron); border-radius: 50%; pointer-events: none }
    .fail { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 16px; background: rgb(19 35 91 / .78); text-align: center; font-size: 15px }
    .retry { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 18px; border-radius: 10px; background: var(--color-saffron); color: var(--color-on-saffron); font-size: 15px; font-weight: 600 }
    .retry:focus-visible, .ctl:focus-visible { outline: 2px solid var(--color-saffron); outline-offset: 2px }
    .bar { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 2px; padding: 32px 8px 6px; background: linear-gradient(to top, rgb(19 35 91 / .85), transparent) }
    /* Кнопки остаются в порядке Tab: фокус на них (focusin) возвращает управление на экран */
    .bar.away { opacity: 0; pointer-events: none }
    .ctl { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; color: inherit }
    @media (hover: hover) { .ctl:hover { background: rgb(255 255 255 / .16) } }
    .scrub { position: relative; flex: 1 1 auto; min-width: 0; height: 44px; margin: 0 8px }
    .track { position: absolute; left: 0; right: 0; top: 50%; height: 4px; margin-top: -2px; overflow: hidden; border-radius: 2px; background: rgb(255 255 255 / .3) }
    .fill { display: block; height: 100%; background: var(--color-saffron) }
    /* Настоящий range — клавиатура, касания и экранные дикторы работают сами. Поля по 6px = половина бегунка: он ходит ровно по полосе */
    input[type='range'] { position: absolute; left: -6px; top: 0; width: calc(100% + 12px); height: 100%; margin: 0; background: transparent; -webkit-appearance: none; appearance: none; cursor: pointer; touch-action: pan-y }
    input[type='range']::-webkit-slider-runnable-track { height: 44px; background: transparent }
    input[type='range']::-moz-range-track { height: 44px; background: transparent }
    input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; margin-top: 16px; border: 0; border-radius: 50%; background: var(--color-saffron); box-shadow: 0 0 0 2px rgb(19 35 91 / .55) }
    input[type='range']::-moz-range-thumb { width: 12px; height: 12px; border: 0; border-radius: 50%; background: var(--color-saffron); box-shadow: 0 0 0 2px rgb(19 35 91 / .55) }
    input[type='range']:focus-visible { outline: none }
    input[type='range']:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 5px rgb(255 201 60 / .55) }
    input[type='range']:focus-visible::-moz-range-thumb { box-shadow: 0 0 0 5px rgb(255 201 60 / .55) }
    .time { flex: none; padding: 0 6px; font-size: 13px; font-variant-numeric: tabular-nums; white-space: nowrap }
    /* Совсем узкая рамка (телефон 320px): полосе перемотки нужнее место, чем времени */
    @container (max-width: 339px) { .time { display: none } }
    /* Вертикальный режим, как в Instagram: чёрный фон, видео на всю рамку, белые элементы вместо шафрановых */
    .frame.reels { background: #000 }
    .reels.portrait video { object-fit: cover }
    .reels::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 48%; background: linear-gradient(to top, rgb(0 0 0 / .66), transparent); pointer-events: none }
    .reel-play { position: absolute; left: 50%; top: 50%; margin: -38px 0 0 -38px; color: #fff; opacity: .92; filter: drop-shadow(0 2px 14px rgb(0 0 0 / .55)); pointer-events: none }
    /* Подпись и кнопки поверх видео: сам слой пропускает касания, ловят их только вложенные элементы */
    .slot { position: absolute; inset: 0; z-index: 1; pointer-events: none }
    .heart { position: absolute; z-index: 2; margin: -52px 0 0 -52px; color: #fff; filter: drop-shadow(0 4px 18px rgb(0 0 0 / .45)); pointer-events: none; animation: heart-fade .7s linear forwards }
    .reels .bar { top: 0; display: block; padding: 0; background: none; pointer-events: none }
    .reels .scrub { position: absolute; left: 0; right: 0; bottom: 0; height: 28px; margin: 0; pointer-events: auto }
    .reels .track { top: auto; bottom: 0; height: 3px; margin: 0; border-radius: 0 }
    .reels .fill { background: #fff }
    .reels input[type='range']::-webkit-slider-runnable-track { height: 28px }
    .reels input[type='range']::-moz-range-track { height: 28px }
    .reels input[type='range']::-webkit-slider-thumb { margin-top: 8px; background: #fff; transform: scale(0) }
    .reels input[type='range']::-moz-range-thumb { background: #fff; transform: scale(0) }
    .reels input[type='range']:active::-webkit-slider-thumb, .reels input[type='range']:focus-visible::-webkit-slider-thumb { transform: scale(1) }
    .reels input[type='range']:active::-moz-range-thumb, .reels input[type='range']:focus-visible::-moz-range-thumb { transform: scale(1) }
    .reels .mute { position: absolute; right: 12px; bottom: calc(24px + env(safe-area-inset-bottom)); width: 40px; height: 40px; background: rgb(0 0 0 / .45); pointer-events: auto }
    .reels .surface:focus-visible, .reels .ctl:focus-visible { outline-color: #fff }
    @keyframes heart-fade { to { opacity: 0 } }
    @keyframes heart-pop { 0% { transform: scale(.4); opacity: 0 } 18% { transform: scale(1.15); opacity: 1 } 40% { transform: scale(1); opacity: 1 } 100% { transform: scale(1.05) translateY(-18px); opacity: 0 } }
    @media (prefers-reduced-motion: no-preference) {
      .heart { animation-name: heart-pop }
      .bar { transition: opacity .2s }
      .fill { transition: width .25s linear }
      .fill.snap { transition: none }
      .spinner { animation: spin .8s linear infinite }
    }
    @keyframes spin { to { transform: rotate(360deg) } }
  `,
})
export class VideoPlayerComponent {
  /** Адрес ролика. */
  readonly src = input.required<string>();
  /** Постер: виден до запуска и размытым фоном по бокам вертикального ролика. */
  readonly poster = input<string>('');
  /** Подпись для экранных дикторов, например «Видео: Наушники». */
  readonly label = input<string>('Видео');
  /** Начать играть сразу: нужно, когда человек сам выбрал видео и второе нажатие было бы лишним. */
  readonly autoplay = input<boolean>(false);
  /** Вид плеера: обычный с панелью кнопок или вертикальный, как в Instagram. */
  readonly variant = input<'classic' | 'reels'>('classic');
  /** Двойной тап по видео — «нравится». Одиночный тап тогда ждёт DOUBLE_TAP_MS, чтобы отличить его от двойного. */
  readonly likeable = input<boolean>(false);
  /** В обычном плеере: показать кнопку, открывающую вертикальный режим. */
  readonly expandable = input<boolean>(false);
  /** Удерживать на паузе: пока открыт вертикальный просмотр, обычный плеер за ним не играет, но остаётся на месте. */
  readonly hold = input<boolean>(false);
  /** Двойной тап по видео (при likeable). */
  readonly liked = output<void>();
  /** Нажали кнопку вертикального режима (при expandable). */
  readonly expand = output<void>();

  private readonly doc = inject(DOCUMENT);
  protected readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('v');
  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');

  protected readonly playing = signal(false);
  /** Ролик хоть раз запускали: до этого кнопка зовёт «Смотреть видео», потом — «Воспроизвести». */
  protected readonly started = signal(false);
  protected readonly waiting = signal(false);
  protected readonly failed = signal(false);
  protected readonly muted = signal(false);
  protected readonly fullscreen = signal(false);
  protected readonly canFullscreen = signal(false);
  protected readonly current = signal(0);
  protected readonly duration = signal(NaN);
  /** Последний шаг времени был назад: у полосы прогресса на этот кадр плавность выключена. */
  protected readonly snap = signal(false);
  /** Ролик вертикальный (выше, чем шире): в вертикальном режиме такой растягивается на всю рамку. */
  protected readonly portrait = signal(false);
  /** Сердечки после двойного тапа; каждое живёт HEART_MS. */
  protected readonly hearts = signal<{ id: number; x: number; y: number }[]>([]);
  private heartId = 0;
  private tapTimer: ReturnType<typeof setTimeout> | undefined;
  /** Управление на виду: двигали мышью, касались или переходили по Tab меньше IDLE_MS назад. */
  private readonly awake = signal(true);
  private sleepTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly reels = computed(() => this.variant() === 'reels');
  protected readonly away = computed(() => !this.reels() && this.playing() && !this.awake());
  protected readonly scrub = computed(() => scrubberValue(this.current(), this.duration()));
  protected readonly percent = computed(() => (this.scrub() / SCRUBBER_MAX) * 100);
  protected readonly elapsed = computed(() => formatTime(this.current()));
  protected readonly total = computed(() => formatTime(this.duration()));
  protected readonly spoken = computed(() => `${this.elapsed()} из ${this.total()}`);

  constructor() {
    // Возможности браузера известны только в нём: на сервере кнопки полного экрана нет
    afterNextRender(() => {
      const v = this.video().nativeElement as IosVideo;
      this.canFullscreen.set(!!this.doc.fullscreenEnabled || typeof v.webkitEnterFullscreen === 'function');
      if (this.autoplay()) void this.start();
    });
    effect(() => { if (this.hold()) untracked(() => this.video().nativeElement.pause()); });
    inject(DestroyRef).onDestroy(() => { this.cancelSleep(); this.cancelTap(); });
  }

  /** Нажатие на видео: пауза/запуск, а при likeable второй тап подряд — «нравится». */
  tap(e: MouseEvent): void {
    if (!this.likeable()) { this.toggle(); return; }
    if (this.tapTimer !== undefined) { this.cancelTap(); this.like(e); return; }
    this.tapTimer = setTimeout(() => { this.tapTimer = undefined; this.toggle(); }, DOUBLE_TAP_MS);
  }

  toggle(): void {
    if (this.failed()) return;
    if (this.playing()) this.video().nativeElement.pause();
    else void this.start();
  }

  retry(): void {
    this.failed.set(false);
    this.video().nativeElement.load();
    void this.start();
  }

  toggleMute(): void {
    const v = this.video().nativeElement;
    v.muted = !v.muted;
    this.muted.set(v.muted);
  }

  toggleFullscreen(): void {
    const frame = this.frame().nativeElement;
    if (this.doc.fullscreenElement) { void this.doc.exitFullscreen?.(); return; }
    // Весь плеер, а не <video>: иначе наше управление останется за кадром
    if (frame.requestFullscreen) frame.requestFullscreen()?.catch(() => undefined);
    else (this.video().nativeElement as IosVideo).webkitEnterFullscreen?.();
  }

  seek(e: Event): void {
    const v = this.video().nativeElement;
    v.currentTime = fromScrubber(Number((e.target as HTMLInputElement).value), this.duration());
    this.show(v.currentTime);
  }

  /** Управление возвращается на экран и снова уйдёт через IDLE_MS, если ролик играет. */
  wake(): void {
    this.awake.set(true);
    this.cancelSleep();
    if (this.playing()) this.sleepTimer = setTimeout(() => this.awake.set(false), IDLE_MS);
  }

  key(e: KeyboardEvent): void {
    // На самом ползунке стрелки — его собственные
    if ((e.target as HTMLElement).tagName === 'INPUT' || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowLeft') this.skip(-SEEK_STEP);
    else if (e.key === 'ArrowRight') this.skip(SEEK_STEP);
    // По e.code, чтобы «m» и «f» работали и на русской раскладке
    else if (e.key.toLowerCase() === 'm' || e.code === 'KeyM') this.toggleMute();
    else if ((e.key.toLowerCase() === 'f' || e.code === 'KeyF') && this.canFullscreen() && !this.reels()) this.toggleFullscreen();
    else return;
    e.preventDefault();
    this.wake();
  }

  onPlay(): void {
    this.playing.set(true);
    this.started.set(true);
    this.wake();
  }

  onPause(): void {
    this.playing.set(false);
    this.cancelSleep();
    this.awake.set(true);
  }

  onVisibility(): void {
    if (this.doc.hidden && this.playing()) this.video().nativeElement.pause();
  }

  onFullscreenChange(): void {
    this.fullscreen.set(this.doc.fullscreenElement === this.frame().nativeElement);
  }

  /** Браузер сбросил ролик (новый адрес, перезагрузка) — плеер возвращается к постеру. */
  reset(): void {
    this.playing.set(false);
    this.started.set(false);
    this.waiting.set(false);
    this.failed.set(false);
    this.current.set(0);
    this.duration.set(NaN);
    this.snap.set(true);
    this.portrait.set(false);
  }

  sync(): void {
    const v = this.video().nativeElement;
    this.show(v.currentTime);
    this.duration.set(v.duration);
    this.portrait.set(v.videoHeight > v.videoWidth);
  }

  private like(e: MouseEvent): void {
    this.liked.emit();
    const box = this.frame().nativeElement.getBoundingClientRect();
    // Нажатие с клавиатуры (detail 0) не несёт координат — сердечко по центру
    const heart = e.detail === 0 ? { id: ++this.heartId, x: box.width / 2, y: box.height / 2 } : { id: ++this.heartId, x: e.clientX - box.left, y: e.clientY - box.top };
    this.hearts.update((l) => [...l, heart]);
    setTimeout(() => this.hearts.update((l) => l.filter((h) => h.id !== heart.id)), HEART_MS);
  }

  private cancelTap(): void {
    clearTimeout(this.tapTimer);
    this.tapTimer = undefined;
  }

  private skip(delta: number): void {
    const v = this.video().nativeElement;
    v.currentTime = clampTime(v.currentTime + delta, this.duration());
    this.show(v.currentTime);
  }

  /** Показывает новое время. Пошло назад (ролик зациклился или перемотали) — полоса прыгает сразу, а не уезжает обратно. */
  private show(t: number): void {
    this.snap.set(t < this.current());
    this.current.set(t);
  }

  private async start(): Promise<void> {
    const v = this.video().nativeElement;
    try {
      await v.play();
    } catch (e) {
      // AbortError — нас перебила пауза или новая загрузка: это норма. Не разрешили со звуком — играем без него
      if ((e as { name?: string } | null)?.name !== 'NotAllowedError') return;
      v.muted = true;
      this.muted.set(true);
      try { await v.play(); } catch { /* совсем не дали — остаются постер и кнопка */ }
    }
  }

  private cancelSleep(): void {
    clearTimeout(this.sleepTimer);
    this.sleepTimer = undefined;
  }
}
