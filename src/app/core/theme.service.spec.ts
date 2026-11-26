import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { THEME_BAR, THEME_KEY, ThemeService } from './theme.service';

/** Подменяет matchMedia: системная тема тёмная или нет; change() имитирует смену системной темы. */
function systemDark(initial: boolean) {
  const listeners: (() => void)[] = [];
  const mql = {
    matches: initial,
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.splice(listeners.indexOf(fn), 1),
  };
  window.matchMedia = jest.fn(() => mql) as unknown as typeof window.matchMedia;
  return { change(dark: boolean) { mql.matches = dark; listeners.forEach((fn) => fn()); }, listeners };
}

const root = () => document.documentElement;
const bar = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content');

describe('ThemeService', () => {
  function make(platform = 'browser') {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: platform }] });
    return TestBed.inject(ThemeService);
  }
  beforeEach(() => {
    localStorage.clear();
    root().removeAttribute('data-theme');
    document.head.innerHTML = '<meta name="theme-color" content="#ffffff">';
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it('до hydrate() — «как в системе» и <html> не трогается', () => {
    systemDark(true);
    localStorage.setItem(THEME_KEY, JSON.stringify('light'));
    const s = make();
    expect(s.mode()).toBe('system');
    expect(root().hasAttribute('data-theme')).toBe(false);
  });

  it('hydrate() подхватывает сохранённый выбор и ставит data-theme и цвет полосы', () => {
    systemDark(false);
    localStorage.setItem(THEME_KEY, JSON.stringify('dark'));
    const s = make();
    s.hydrate();
    expect(s.mode()).toBe('dark');
    expect(root().getAttribute('data-theme')).toBe('dark');
    expect(bar()).toBe(THEME_BAR.dark);
  });

  it('мусор в хранилище — «как в системе»', () => {
    systemDark(false);
    localStorage.setItem(THEME_KEY, JSON.stringify('purple'));
    const s = make();
    s.hydrate();
    expect(s.mode()).toBe('system');
    expect(root().hasAttribute('data-theme')).toBe(false);
  });

  it('set() сохраняет выбор; «как в системе» убирает запись и data-theme', () => {
    systemDark(false);
    const s = make();
    s.hydrate();
    s.set('light');
    expect(JSON.parse(localStorage.getItem(THEME_KEY) ?? 'null')).toBe('light');
    expect(root().getAttribute('data-theme')).toBe('light');
    expect(bar()).toBe(THEME_BAR.light);
    s.set('system');
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(root().hasAttribute('data-theme')).toBe(false);
  });

  it('«как в системе»: полоса браузера следует за сменой системной темы', () => {
    const sys = systemDark(false);
    const s = make();
    s.hydrate();
    expect(bar()).toBe(THEME_BAR.light);
    sys.change(true);
    expect(bar()).toBe(THEME_BAR.dark);
  });

  it('выбрана светлая — смена системной темы полосу не меняет', () => {
    const sys = systemDark(false);
    const s = make();
    s.hydrate();
    s.set('light');
    sys.change(true);
    expect(bar()).toBe(THEME_BAR.light);
  });

  it('повторный hydrate() не вешает второго слушателя', () => {
    const sys = systemDark(false);
    const s = make();
    s.hydrate();
    s.hydrate();
    expect(sys.listeners.length).toBe(1);
  });

  it('на сервере ничего не делает', () => {
    systemDark(true);
    localStorage.setItem(THEME_KEY, JSON.stringify('dark'));
    const s = make('server');
    s.hydrate();
    s.set('dark');
    expect(root().hasAttribute('data-theme')).toBe(false);
    expect(bar()).toBe('#ffffff');
  });

  describe('скрипт в index.html (до отрисовки)', () => {
    const html = readFileSync(join(__dirname, '../../index.html'), 'utf8');
    const code = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
    const run = () => new Function(code)();

    it('использует тот же ключ и цвет полосы, что и сервис', () => {
      expect(code).toContain(`'${THEME_KEY}'`);
      expect(code).toContain(`'${THEME_BAR.dark}'`);
      expect(html).toContain(`<meta name="theme-color" content="${THEME_BAR.light}">`);
    });

    it('сохранённая тёмная — data-theme и тёмная полоса', () => {
      systemDark(false);
      localStorage.setItem(THEME_KEY, JSON.stringify('dark'));
      run();
      expect(root().getAttribute('data-theme')).toBe('dark');
      expect(bar()).toBe(THEME_BAR.dark);
    });

    it('без выбора при тёмной системе — только тёмная полоса, data-theme нет', () => {
      systemDark(true);
      run();
      expect(root().hasAttribute('data-theme')).toBe(false);
      expect(bar()).toBe(THEME_BAR.dark);
    });

    it('светлая перебивает тёмную систему', () => {
      systemDark(true);
      localStorage.setItem(THEME_KEY, JSON.stringify('light'));
      run();
      expect(root().getAttribute('data-theme')).toBe('light');
      expect(bar()).toBe('#ffffff');
    });

    it('битая запись не роняет страницу', () => {
      systemDark(false);
      localStorage.setItem(THEME_KEY, '{oops');
      expect(run).not.toThrow();
      expect(root().hasAttribute('data-theme')).toBe(false);
    });
  });
});
