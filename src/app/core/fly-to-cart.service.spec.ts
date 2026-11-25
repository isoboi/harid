import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BUMP_MS, DOT_SIZE, FLY_MS, FlyToCart, GHOST_SIZE, flightPath } from './fly-to-cart.service';

interface Anim { onfinish: (() => void) | null; oncancel: (() => void) | null }

/** В jsdom нет раскладки и Web Animations: размеры и animate задаём руками. */
function place<T extends HTMLElement>(el: T, box: { left: number; top: number; width: number; height: number }): T {
  el.getBoundingClientRect = () => ({ ...box, right: box.left + box.width, bottom: box.top + box.height, x: box.left, y: box.top, toJSON: () => ({}) });
  return el;
}

const flights: { el: HTMLElement; frames: Keyframe[]; options: KeyframeAnimationOptions; anim: Anim }[] = [];

function setup(opts: { reduced?: boolean; platform?: string; animate?: boolean } = {}) {
  const { reduced = false, platform = 'browser', animate = true } = opts;
  flights.length = 0;
  window.matchMedia = jest.fn((q: string) => ({ matches: reduced && q.includes('reduce') })) as unknown as typeof window.matchMedia;
  if (animate) {
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value(this: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) {
        const anim: Anim = { onfinish: null, oncancel: null };
        flights.push({ el: this, frames, options, anim });
        return anim;
      },
    });
  } else {
    delete (HTMLElement.prototype as { animate?: unknown }).animate;
  }
  TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: platform }] });
  return TestBed.inject(FlyToCart);
}

/** Значок корзины в нижней панели: app-icon внутри помеченного блока. */
function cartTarget(box = { left: 300, top: 700, width: 40, height: 40 }, icon = { left: 309, top: 709, width: 22, height: 22 }) {
  const target = place(document.createElement('span'), box);
  target.setAttribute('data-cart-target', '');
  const ico = place(document.createElement('app-icon'), icon);
  target.appendChild(ico);
  document.body.appendChild(target);
  return target;
}

function photo(box = { left: 100, top: 100, width: 400, height: 400 }) {
  const wrap = place(document.createElement('div'), box);
  const img = document.createElement('img');
  img.src = 'https://cdn.test/a.jpg';
  wrap.appendChild(img);
  document.body.appendChild(wrap);
  return wrap;
}

const ghosts = () => Array.from(document.body.children).filter((e) => e.getAttribute('aria-hidden') === 'true') as HTMLElement[];

describe('flightPath', () => {
  it('сдвиг — между центрами, сжатие — до размера значка', () => {
    const p = flightPath({ left: 0, top: 0, width: 100, height: 100 }, { left: 340, top: 640, width: 22, height: 22 }, 88);
    expect(p.dx).toBe(301);
    expect(p.dy).toBe(601);
    expect(p.scale).toBeCloseTo(0.25, 5);
  });

  it('сжатие не больше 1 и не меньше 0,12', () => {
    expect(flightPath({ left: 0, top: 0, width: 10, height: 10 }, { left: 0, top: 0, width: 200, height: 200 }, 32).scale).toBe(1);
    expect(flightPath({ left: 0, top: 0, width: 10, height: 10 }, { left: 0, top: 0, width: 2, height: 2 }, 88).scale).toBe(0.12);
  });
});

describe('FlyToCart', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete (HTMLElement.prototype as { animate?: unknown }).animate;
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it('фото: летящая копия стоит над фото и летит к значку корзины, потом исчезает, а значок подпрыгивает', () => {
    const fly = setup();
    const target = cartTarget();
    fly.fly(photo());

    const [ghost] = ghosts();
    expect(ghost).toBeDefined();
    expect(ghost.tagName).toBe('IMG');
    expect((ghost as HTMLImageElement).src).toBe('https://cdn.test/a.jpg');
    // центр фото (300, 300), сторона 88 → левый верх (256, 256)
    expect(ghost.style.left).toBe('256px');
    expect(ghost.style.top).toBe('256px');
    expect(ghost.style.width).toBe(`${GHOST_SIZE}px`);

    const flight = flights.find((f) => f.el === ghost)!;
    expect(flight.options.duration).toBe(FLY_MS);
    // значок: центр (320, 720) → сдвиг (20, 420), сжатие 22 / 88
    expect(flight.frames[1]['transform']).toBe('translate(20px, 420px) scale(0.25)');

    flight.anim.onfinish!();
    expect(ghosts()).toHaveLength(0);
    const bump = flights.find((f) => f.el === target)!;
    expect(bump.options.duration).toBe(BUMP_MS);
    expect(bump.frames.map((f) => f['transform'])).toEqual(['scale(1)', 'scale(1.22)', 'scale(1)']);
  });

  it('кнопка вместо фото: летит точка', () => {
    const fly = setup();
    cartTarget();
    const btn = place(document.createElement('button'), { left: 20, top: 500, width: 200, height: 48 });
    document.body.appendChild(btn);
    fly.fly(btn);
    const [ghost] = ghosts();
    expect(ghost.tagName).toBe('DIV');
    expect(ghost.style.width).toBe(`${DOT_SIZE}px`);
  });

  it('значков два — летит к последнему видимому (нижняя панель телефона)', () => {
    const fly = setup();
    const header = cartTarget({ left: 900, top: 10, width: 40, height: 40 }, { left: 909, top: 19, width: 22, height: 22 });
    const tabbar = cartTarget();
    fly.fly(photo());
    flights.find((f) => f.el === ghosts()[0])!.anim.onfinish!();
    expect(flights.some((f) => f.el === tabbar)).toBe(true);
    expect(flights.some((f) => f.el === header)).toBe(false);
  });

  it('нижняя панель скрыта (десктоп, нулевой размер) — летит к значку в шапке', () => {
    const fly = setup();
    const header = cartTarget({ left: 900, top: 10, width: 40, height: 40 }, { left: 909, top: 19, width: 22, height: 22 });
    cartTarget({ left: 0, top: 0, width: 0, height: 0 }, { left: 0, top: 0, width: 0, height: 0 });
    fly.fly(photo());
    flights.find((f) => f.el === ghosts()[0])!.anim.onfinish!();
    expect(flights.some((f) => f.el === header)).toBe(true);
  });

  it('первый источник за экраном — берётся следующий; ни одного на экране — полёта нет', () => {
    const fly = setup();
    cartTarget();
    const off = photo({ left: 100, top: -900, width: 400, height: 400 });
    const on = place(document.createElement('button'), { left: 20, top: 500, width: 200, height: 48 });
    document.body.appendChild(on);
    fly.fly(off, on);
    expect(ghosts()).toHaveLength(1);
    expect(ghosts()[0].style.width).toBe(`${DOT_SIZE}px`);
    ghosts()[0].remove();
    fly.fly(off, null, undefined);
    expect(ghosts()).toHaveLength(0);
  });

  it('значка корзины на экране нет — полёта нет', () => {
    const fly = setup();
    fly.fly(photo());
    expect(ghosts()).toHaveLength(0);
  });

  it('«уменьшить движение», сервер и браузер без Web Animations — ничего не делают', () => {
    for (const opts of [{ reduced: true }, { platform: 'server' }, { animate: false }]) {
      TestBed.resetTestingModule();
      const fly = setup(opts);
      cartTarget();
      fly.fly(photo());
      expect(ghosts()).toHaveLength(0);
      document.body.innerHTML = '';
    }
  });

  it('полёт отменили — копия убирается, значок не подпрыгивает', () => {
    const fly = setup();
    const target = cartTarget();
    fly.fly(photo());
    flights.find((f) => f.el === ghosts()[0])!.anim.oncancel!();
    expect(ghosts()).toHaveLength(0);
    expect(flights.some((f) => f.el === target)).toBe(false);
  });

  it('страховка: анимация не закончилась — копия всё равно убирается по таймеру', () => {
    jest.useFakeTimers();
    try {
      const fly = setup();
      cartTarget();
      fly.fly(photo());
      expect(ghosts()).toHaveLength(1);
      jest.advanceTimersByTime(FLY_MS + 500);
      expect(ghosts()).toHaveLength(0);
    } finally { jest.useRealTimers(); }
  });
});
