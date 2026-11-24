import { TestBed } from '@angular/core/testing';
import { isStandalone, PULL_MAX, PULL_ROOT_CLASS, PULL_START, PULL_TRIGGER, PullRefreshComponent, pullDistance } from './pull-refresh.component';

function mock(opts: { standalone?: boolean; ios?: boolean; scrollY?: number } = {}) {
  const { standalone = true, ios = false, scrollY = 0 } = opts;
  window.matchMedia = jest.fn((q: string) => ({ matches: standalone && q.includes('standalone') })) as unknown as typeof window.matchMedia;
  Object.defineProperty(navigator, 'standalone', { configurable: true, value: ios ? true : undefined });
  Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollY });
}

function fire(type: string, y: number, o: { x?: number; fingers?: number; target?: EventTarget } = {}) {
  const { x = 100, fingers = 1, target = document.body } = o;
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'touches', { value: type === 'touchend' || type === 'touchcancel' ? [] : Array.from({ length: fingers }, () => ({ clientX: x, clientY: y })) });
  target.dispatchEvent(e);
}

/** Тянет вниз от y=100 на dy и отпускает (или нет). */
function drag(dy: number, o: { release?: boolean; x?: number; target?: EventTarget } = {}) {
  const { release = true, x, target } = o;
  fire('touchstart', 100, { x, target });
  fire('touchmove', 100 + dy, { x, target });
  if (release) fire('touchend', 100 + dy, { target });
}

async function create() {
  await TestBed.configureTestingModule({ imports: [PullRefreshComponent] }).compileComponents();
  const f = TestBed.createComponent(PullRefreshComponent);
  const refreshed = jest.fn();
  f.componentInstance.refresh.subscribe(refreshed);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const pull = () => el.querySelector('[data-test="pull"]') as HTMLElement | null;
  return { f, el, refreshed, pull };
}

describe('pullDistance', () => {
  it('до порога дрожания — 0; дальше с «резинкой»; не больше максимума', () => {
    expect(pullDistance(0)).toBe(0);
    expect(pullDistance(PULL_START)).toBe(0);
    expect(pullDistance(-50)).toBe(0);
    expect(pullDistance(PULL_START + 100)).toBeCloseTo(55, 5);
    expect(pullDistance(10_000)).toBe(PULL_MAX);
  });
});

describe('isStandalone', () => {
  afterEach(() => { delete (window as { matchMedia?: unknown }).matchMedia; delete (navigator as { standalone?: unknown }).standalone; });
  it('display-mode: standalone (Android) и navigator.standalone (iOS) — да; обычная вкладка — нет', () => {
    mock({ standalone: true });
    expect(isStandalone(window)).toBe(true);
    mock({ standalone: false, ios: true });
    expect(isStandalone(window)).toBe(true);
    mock({ standalone: false });
    expect(isStandalone(window)).toBe(false);
  });
});

describe('PullRefreshComponent', () => {
  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
    delete (navigator as { standalone?: unknown }).standalone;
    delete (window as { scrollY?: unknown }).scrollY;
    document.documentElement.classList.remove(PULL_ROOT_CLASS);
    document.body.innerHTML = '';
  });

  it('в обычном браузере ничего не рисует, жесты не слушает и класс на <html> не ставит', async () => {
    mock({ standalone: false });
    const t = await create();
    expect(t.pull()).toBeNull();
    expect(document.documentElement.classList.contains(PULL_ROOT_CLASS)).toBe(false);
    drag(200);
    expect(t.refreshed).not.toHaveBeenCalled();
  });

  it('установленное приложение (Android): индикатор есть, а на <html> стоит класс, гасящий родное «потянуть»', async () => {
    mock();
    const t = await create();
    expect(t.pull()).not.toBeNull();
    expect(document.documentElement.classList.contains(PULL_ROOT_CLASS)).toBe(true);
    t.f.destroy();
    expect(document.documentElement.classList.contains(PULL_ROOT_CLASS)).toBe(false);
  });

  it('установленное приложение на iOS (navigator.standalone) тоже включается', async () => {
    mock({ standalone: false, ios: true });
    const t = await create();
    expect(t.pull()).not.toBeNull();
  });

  it('потянули за порог и отпустили — одно событие refresh', async () => {
    mock();
    const t = await create();
    drag(PULL_START + PULL_TRIGGER / 0.55 + 5);
    expect(t.refreshed).toHaveBeenCalledTimes(1);
  });

  it('недотянули и отпустили — обновления нет, индикатор возвращается', async () => {
    mock();
    const t = await create();
    drag(60, { release: false });
    t.f.detectChanges();
    expect(t.pull()?.classList.contains('drag')).toBe(true);
    expect(t.f.componentInstance.offset()).toBeGreaterThan(0);
    fire('touchend', 160);
    t.f.detectChanges();
    expect(t.refreshed).not.toHaveBeenCalled();
    expect(t.f.componentInstance.offset()).toBe(0);
    expect(t.pull()?.classList.contains('drag')).toBe(false);
  });

  it('индикатор идёт за пальцем: до порога прозрачность растёт', async () => {
    mock();
    const t = await create();
    drag(40, { release: false });
    t.f.detectChanges();
    const o1 = t.f.componentInstance.opacity();
    expect(o1).toBeGreaterThan(0);
    expect(o1).toBeLessThanOrEqual(1);
    fire('touchmove', 100 + 120);
    t.f.detectChanges();
    expect(t.f.componentInstance.offset()).toBeGreaterThan(PULL_TRIGGER - 1);
    expect(t.pull()?.style.transform).toMatch(/^translateY\(-?[\d.]+px\)$/);
  });

  it('индикатор прячется под шапкой и выезжает из-под её нижней кромки', async () => {
    mock();
    const t = await create();
    const header = document.createElement('app-header');
    header.getBoundingClientRect = () => ({ bottom: 120, top: 0, left: 0, right: 390, width: 390, height: 120, x: 0, y: 0, toJSON: () => ({}) });
    document.body.appendChild(header);
    fire('touchstart', 100);
    t.f.detectChanges();
    expect(t.pull()?.style.top).toBe('80px'); // кромка 120 минус кружок 40: целиком под шапкой
    fire('touchmove', 100 + PULL_START + PULL_TRIGGER / 0.55);
    t.f.detectChanges();
    expect(parseFloat((t.pull()?.style.transform ?? '').replace('translateY(', ''))).toBeCloseTo(PULL_TRIGGER * 0.9, 1);
  });

  it('страница прокручена вниз — жест не начинается', async () => {
    mock({ scrollY: 80 });
    const t = await create();
    drag(200);
    expect(t.refreshed).not.toHaveBeenCalled();
  });

  it('прокрутили вниз во время жеста — жест отменяется', async () => {
    mock();
    const t = await create();
    fire('touchstart', 100);
    fire('touchmove', 160);
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 30 });
    fire('touchmove', 300);
    fire('touchend', 300);
    expect(t.refreshed).not.toHaveBeenCalled();
    expect(t.f.componentInstance.offset()).toBe(0);
  });

  it('больше вбок, чем вниз — это не обновление', async () => {
    mock();
    const t = await create();
    fire('touchstart', 100, { x: 50 });
    fire('touchmove', 140, { x: 300 });
    fire('touchend', 140, { x: 300 });
    expect(t.refreshed).not.toHaveBeenCalled();
    expect(t.f.componentInstance.pulling()).toBe(false);
  });

  it('палец пошёл вверх (прокрутка) — жест не включается, даже если потом вернуть вниз', async () => {
    mock();
    const t = await create();
    fire('touchstart', 200);
    fire('touchmove', 150);
    fire('touchmove', 400);
    fire('touchend', 400);
    expect(t.refreshed).not.toHaveBeenCalled();
  });

  it('два пальца — не обновление', async () => {
    mock();
    const t = await create();
    fire('touchstart', 100, { fingers: 2 });
    fire('touchmove', 300, { fingers: 2 });
    fire('touchend', 300);
    expect(t.refreshed).not.toHaveBeenCalled();
  });

  it('касание в поле ввода и в списке подсказок игнорируется', async () => {
    mock();
    const t = await create();
    const input = document.createElement('input');
    const list = document.createElement('div');
    list.setAttribute('role', 'listbox');
    const opt = document.createElement('a');
    list.appendChild(opt);
    document.body.append(input, list);
    drag(200, { target: input });
    drag(200, { target: opt });
    expect(t.refreshed).not.toHaveBeenCalled();
  });

  it('системная отмена касания сбрасывает жест', async () => {
    mock();
    const t = await create();
    fire('touchstart', 100);
    fire('touchmove', 220);
    fire('touchcancel', 220);
    fire('touchend', 220);
    expect(t.refreshed).not.toHaveBeenCalled();
    expect(t.f.componentInstance.offset()).toBe(0);
  });

  it('пока лента обновляется: индикатор держится на пороге, новый жест не начинается, статус озвучивается', async () => {
    mock();
    const t = await create();
    t.f.componentRef.setInput('busy', true);
    t.f.detectChanges();
    expect(t.f.componentInstance.offset()).toBe(PULL_TRIGGER);
    expect(t.el.querySelector('[role="status"]')?.textContent).toContain('Обновляем');
    drag(250);
    expect(t.refreshed).not.toHaveBeenCalled();
    t.f.componentRef.setInput('busy', false);
    t.f.detectChanges();
    expect(t.f.componentInstance.offset()).toBe(0);
    expect(t.el.querySelector('[role="status"]')?.textContent).toContain('обновлена');
  });

  it('после уничтожения жесты больше не слушаются', async () => {
    mock();
    const t = await create();
    t.f.destroy();
    drag(250);
    expect(t.refreshed).not.toHaveBeenCalled();
  });
});
