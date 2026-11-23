import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, DestroyRef, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { IconComponent } from './icon.component';
import { clampTime, formatTime, fromScrubber, scrubberValue, SCRUBBER_MAX, SEEK_STEP } from './video-time';

/** Через сколько миллисекунд бездействия во время игры управление уходит с видео. */
const IDLE_MS = 2500;

/** iPhone умеет только системный полный экран самого <video>: у него свои кнопки, зато он работает. */
type IosVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/**
 * Плеер видео товара.
 * Ролики приходят из Instagram и чаще вертикальные, а рамка галереи квадратная: боковые поля
 * заливает размытый постер, как в Reels, вместо чёрных полос. Управление — одним рядом снизу,
 * исчезает во время игры и возвращается от касания, движения мыши или Tab.
 */
@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [IconComponent],
  host: { '(document:visibilitychange)': 'onVisibility()', '(document:fullscreenchange)': 'onFullscreenChange()' },
  template: `
    <div #frame class="frame" data-test="frame" [class.still]="away()" (pointermove)="wake()" (pointerdown)="wake()" (focusin)="wake()" (keydown)="key($event)">
      @if (poster()) { <img class="ambient" data-test="ambient" [src]="poster()" alt="" aria-hidden="true" /> }
      <video #v data-test="video" [src]="src()" [attr.poster]="poster() || null" preload="none" playsinline loop [attr.aria-label]="label()"
        (play)="onPlay()" (pause)="onPause()" (playing)="waiting.set(false)" (canplay)="waiting.set(false)" (waiting)="waiting.set(true)"
        (timeupdate)="sync()" (durationchange)="sync()" (loadedmetadata)="sync()" (volumechange)="muted.set(video().nativeElement.muted)"
        (emptied)="reset()" (error)="failed.set(true)"></video>
      <button type="button" class="surface" data-test="surface" [attr.aria-label]="playing() ? 'Пауза' : started() ? 'Воспроизвести' : 'Смотреть видео'" (click)="toggle()"></button>
      @if (!playing() && !failed() && !waiting()) { <span class="big" data-test="big-play" aria-hidden="true"><app-icon name="play" [size]="30" [filled]="true" /></span> }
      @if (waiting() && !failed()) { <span class="spinner" data-test="spinner" aria-hidden="true"></span> }
      @if (failed()) {
        <div class="fail" data-test="error" role="alert">
          <p>Не удалось загрузить видео</p>
          <button type="button" class="retry" data-test="retry" (click)="retry()"><app-icon name="rotate-ccw" [size]="18" />Повторить</button>
        </div>
      }
      <div class="bar" data-test="bar" [class.away]="away()">
        <button type="button" class="ctl" data-test="toggle" [attr.aria-label]="playing() ? 'Пауза' : 'Воспроизвести'" (click)="toggle()">
          <app-icon [name]="playing() ? 'pause' : 'play'" [size]="22" [filled]="true" />
        </button>
        <span class="scrub">
          <span class="track" aria-hidden="true"><span class="fill" [class.snap]="snap()" [style.width.%]="percent()"></span></span>
          <!-- max задан числом в разметке, а не привязкой: иначе value выставится раньше max и обрежется до 100 (значение — SCRUBBER_MAX) -->
          <input type="range" data-test="scrub" min="0" max="1000" step="1" [value]="scrub()" aria-label="Перемотка" [attr.aria-valuetext]="spoken()" (input)="seek($event)" />
        </span>
        <span class="time" data-test="time">{{ elapsed() }} / {{ total() }}</span>
        <button type="button" class="ctl" data-test="mute" [attr.aria-label]="muted() ? 'Включить звук' : 'Выключить звук'" (click)="toggleMute()">
          <app-icon [name]="muted() ? 'volume-x' : 'volume-2'" [size]="22" />
        </button>
        @if (canFullscreen()) {
          <button type="button" class="ctl" data-test="fullscreen" [attr.aria-label]="fullscreen() ? 'Выйти из полноэкранного режима' : 'Во весь экран'" (click)="toggleFullscreen()">
            <app-icon [name]="fullscreen() ? 'minimize' : 'maximize'" [size]="22" />
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; position: relative; width: 100%; height: 100%; color: #fff }
    .frame { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--color-ink); container-type: inline-size }
    .frame.still { cursor: none }
    /* Постер, растянутый и размытый, — вместо чёрных полей у вертикального ролика */
    .ambient { position: absolute; inset: -12%; width: 124%; height: 124%; object-fit: cover; filter: blur(28px) saturate(1.3) brightness(.65); pointer-events: none }
    video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; background: transparent }
    .surface { position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; border: 0; background: none; cursor: pointer; -webkit-tap-highlight-color: transparent }
    .surface:focus-visible { outline: 2px solid var(--color-saffron); outline-offset: -4px }
    .big { position: absolute; left: 50%; top: 50%; display: grid; place-items: center; width: 72px; height: 72px; margin: -36px 0 0 -36px; border-radius: 50%; background: var(--color-saffron); color: var(--color-ink); box-shadow: 0 8px 24px rgb(19 35 91 / .35); pointer-events: none }
    /* Треугольник оптически тяжелее слева — сдвигаем, чтобы он стоял по центру круга */
    .big app-icon { margin-left: 4px }
    .spinner { position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; margin: -22px 0 0 -22px; border: 3px solid rgb(255 255 255 / .3); border-top-color: var(--color-saffron); border-radius: 50%; pointer-events: none }
    .fail { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 16px; background: rgb(19 35 91 / .78); text-align: center; font-size: 15px }
    .retry { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 18px; border-radius: 10px; background: var(--color-saffron); color: var(--color-ink); font-size: 15px; font-weight: 600 }
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
    @media (prefers-reduced-motion: no-preference) {
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
  /** Управление на виду: двигали мышью, касались или переходили по Tab меньше IDLE_MS назад. */
  private readonly awake = signal(true);
  private sleepTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly away = computed(() => this.playing() && !this.awake());
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
    inject(DestroyRef).onDestroy(() => this.cancelSleep());
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
    else if ((e.key.toLowerCase() === 'f' || e.code === 'KeyF') && this.canFullscreen()) this.toggleFullscreen();
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
  }

  sync(): void {
    const v = this.video().nativeElement;
    this.show(v.currentTime);
    this.duration.set(v.duration);
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
