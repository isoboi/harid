import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { VideoPlayerComponent } from './video-player.component';

type Opts = { src?: string; poster?: string; label?: string; autoplay?: boolean };

/** jsdom не умеет играть видео: подменяем методы и время, события шлём руками. */
function setup(opts: Opts = {}) {
  const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  const pause = jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  const load = jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  TestBed.configureTestingModule({ imports: [VideoPlayerComponent] });
  const f = TestBed.createComponent(VideoPlayerComponent);
  f.componentRef.setInput('src', opts.src ?? 'v.mp4');
  if (opts.poster !== undefined) f.componentRef.setInput('poster', opts.poster);
  if (opts.label !== undefined) f.componentRef.setInput('label', opts.label);
  if (opts.autoplay !== undefined) f.componentRef.setInput('autoplay', opts.autoplay);
  f.detectChanges();
  const el: HTMLElement = f.nativeElement;
  const q = <T extends HTMLElement = HTMLElement>(id: string) => el.querySelector(`[data-test="${id}"]`) as T;
  const video = q<HTMLVideoElement>('video');
  let time = 0;
  Object.defineProperty(video, 'currentTime', { configurable: true, get: () => time, set: (v: number) => { time = v; } });
  const emit = (type: string) => { video.dispatchEvent(new Event(type)); f.detectChanges(); };
  const setDuration = (d: number) => { Object.defineProperty(video, 'duration', { configurable: true, value: d }); emit('durationchange'); };
  const at = (t: number) => { time = t; emit('timeupdate'); };
  return { f, el, q, video, emit, setDuration, at, play, pause, load, time: () => time };
}

describe('VideoPlayerComponent', () => {
  afterEach(() => { jest.restoreAllMocks(); TestBed.resetTestingModule(); });

  it('сначала постер и крупная кнопка: видео не грузится, пока его не нажали', () => {
    const t = setup({ poster: 'a.jpg', label: 'Видео: Наушники' });
    expect(t.video.getAttribute('src')).toBe('v.mp4');
    expect(t.video.getAttribute('poster')).toBe('a.jpg');
    expect(t.video.getAttribute('preload')).toBe('none');
    expect(t.video.hasAttribute('playsinline')).toBe(true);
    expect(t.video.loop).toBe(true);
    expect(t.video.hasAttribute('controls')).toBe(false);
    expect(t.video.getAttribute('aria-label')).toBe('Видео: Наушники');
    expect(t.q('big-play')).not.toBeNull();
    expect(t.q('surface').getAttribute('aria-label')).toBe('Смотреть видео');
    expect(t.play).not.toHaveBeenCalled();
  });

  it('вертикальный ролик в квадратной рамке: боковые поля залиты размытым постером', () => {
    const t = setup({ poster: 'a.jpg' });
    const ambient = t.q<HTMLImageElement>('ambient');
    expect(ambient.getAttribute('src')).toBe('a.jpg');
    expect(ambient.getAttribute('alt')).toBe('');
    expect(ambient.getAttribute('aria-hidden')).toBe('true');
    TestBed.resetTestingModule();
    expect(setup().q('ambient')).toBeNull();
  });

  it('нажатие на видео запускает, повторное — ставит на паузу', () => {
    const t = setup();
    t.q('surface').click();
    expect(t.play).toHaveBeenCalledTimes(1);
    t.emit('play');
    expect(t.q('big-play')).toBeNull();
    expect(t.q('surface').getAttribute('aria-label')).toBe('Пауза');
    expect(t.q('toggle').getAttribute('aria-label')).toBe('Пауза');
    t.q('surface').click();
    expect(t.pause).toHaveBeenCalledTimes(1);
    t.emit('pause');
    expect(t.q('big-play')).not.toBeNull();
    expect(t.q('toggle').getAttribute('aria-label')).toBe('Воспроизвести');
  });

  it('autoplay: ролик стартует сам, как только плеер появился (человек сам выбрал видео)', () => {
    const t = setup({ autoplay: true });
    expect(t.play).toHaveBeenCalledTimes(1);
  });

  it('браузер не дал играть со звуком — запускаем без звука, а не оставляем стоять', async () => {
    const t = setup();
    t.play.mockRejectedValueOnce(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
    t.q('surface').click();
    await Promise.resolve(); await Promise.resolve();
    expect(t.video.muted).toBe(true);
    expect(t.play).toHaveBeenCalledTimes(2);
    t.f.detectChanges();
    expect(t.q('mute').getAttribute('aria-label')).toBe('Включить звук');
  });

  it('время и ползунок: «0:12 / 0:24», ползунок посередине', () => {
    const t = setup();
    expect(t.q('time').textContent?.trim()).toBe('0:00 / 0:00');
    t.setDuration(24);
    t.at(12);
    expect(t.q('time').textContent?.trim()).toBe('0:12 / 0:24');
    const scrub = t.q<HTMLInputElement>('scrub');
    expect(scrub.value).toBe('500');
    expect(scrub.getAttribute('aria-label')).toBe('Перемотка');
    expect(scrub.getAttribute('aria-valuetext')).toBe('0:12 из 0:24');
  });

  it('полоса прогресса плавно едет вперёд, но при зацикливании и перемотке назад прыгает сразу', () => {
    const t = setup();
    t.setDuration(24);
    const fill = t.q('scrub').parentElement!.querySelector('.fill') as HTMLElement;
    t.at(20);
    expect(fill.classList.contains('snap')).toBe(false);
    expect(fill.style.width).toBe('83.3%');
    t.at(0.2); // ролик зациклился
    expect(fill.classList.contains('snap')).toBe(true);
    t.at(0.4);
    expect(fill.classList.contains('snap')).toBe(false);
  });

  it('потянули ползунок — ролик перематывается на ту же долю', () => {
    const t = setup();
    t.setDuration(24);
    const scrub = t.q<HTMLInputElement>('scrub');
    scrub.value = '250';
    scrub.dispatchEvent(new Event('input'));
    expect(t.time()).toBe(6);
  });

  it('звук: кнопка выключает и включает, подпись и иконка меняются', () => {
    const t = setup();
    expect(t.q('mute').getAttribute('aria-label')).toBe('Выключить звук');
    t.q('mute').click(); t.f.detectChanges();
    expect(t.video.muted).toBe(true);
    expect(t.q('mute').getAttribute('aria-label')).toBe('Включить звук');
    t.q('mute').click(); t.f.detectChanges();
    expect(t.video.muted).toBe(false);
  });

  it('клавиатура: стрелки перематывают на 5 секунд и не выходят за ролик, «m» — звук', () => {
    const t = setup();
    t.setDuration(24);
    t.at(2);
    const key = (k: string) => { t.q('surface').dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); t.f.detectChanges(); };
    key('ArrowLeft');
    expect(t.time()).toBe(0);
    key('ArrowRight'); key('ArrowRight');
    expect(t.time()).toBe(10);
    t.at(22);
    key('ArrowRight');
    expect(t.time()).toBe(24);
    key('m');
    expect(t.video.muted).toBe(true);
  });

  it('стрелки на самом ползунке остаются его собственными: плеер не перематывает второй раз', () => {
    const t = setup();
    t.setDuration(24);
    t.at(10);
    t.q('scrub').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(t.time()).toBe(10);
  });

  it('буферизация: пока видео ждёт данные, крутится индикатор', () => {
    const t = setup();
    t.emit('play');
    t.emit('waiting');
    expect(t.q('spinner')).not.toBeNull();
    t.emit('playing');
    expect(t.q('spinner')).toBeNull();
  });

  it('ошибка загрузки: понятное сообщение и «Повторить» перезагружает ролик', () => {
    const t = setup();
    t.emit('error');
    expect(t.q('error').getAttribute('role')).toBe('alert');
    expect(t.q('error').textContent).toContain('Не удалось загрузить видео');
    expect(t.q('big-play')).toBeNull();
    t.q('retry').click(); t.f.detectChanges();
    expect(t.load).toHaveBeenCalledTimes(1);
    expect(t.play).toHaveBeenCalledTimes(1);
    expect(t.q('error')).toBeNull();
  });

  it('управление прячется через 2,5 с игры и возвращается от движения; на паузе видно всегда', fakeAsync(() => {
    const t = setup();
    const bar = t.q('bar');
    expect(bar.classList.contains('away')).toBe(false);
    t.emit('play');
    tick(2400); t.f.detectChanges();
    expect(bar.classList.contains('away')).toBe(false);
    tick(200); t.f.detectChanges();
    expect(bar.classList.contains('away')).toBe(true);
    t.q('frame').dispatchEvent(new Event('pointermove', { bubbles: true })); t.f.detectChanges();
    expect(bar.classList.contains('away')).toBe(false);
    tick(2600); t.f.detectChanges();
    expect(bar.classList.contains('away')).toBe(true);
    t.emit('pause');
    expect(bar.classList.contains('away')).toBe(false);
    tick(5000); t.f.detectChanges();
    expect(bar.classList.contains('away')).toBe(false);
  }));

  it('вкладка ушла в фон — играющий ролик встаёт на паузу', () => {
    const t = setup();
    t.emit('play');
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    try {
      document.dispatchEvent(new Event('visibilitychange'));
      expect(t.pause).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    }
  });

  it('полный экран: кнопка есть, только если браузер умеет, и открывает рамку целиком (с нашим управлением)', () => {
    const none = setup();
    none.f.detectChanges();
    expect(none.q('fullscreen')).toBeNull();
    TestBed.resetTestingModule();
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
    try {
      const t = setup();
      t.f.detectChanges(); // поддержку полного экрана плеер узнаёт после первого кадра
      const frame = t.q('frame');
      frame.requestFullscreen = jest.fn(() => Promise.resolve());
      expect(t.q('fullscreen').getAttribute('aria-label')).toBe('Во весь экран');
      t.q('fullscreen').click();
      expect(frame.requestFullscreen).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: undefined });
    }
  });
});
