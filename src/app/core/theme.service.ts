import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { BrowserStorage } from './browser-storage.service';

/** Светлая (по умолчанию), тёмная или «как в системе». */
export type ThemeMode = 'light' | 'dark' | 'system';

/** Ключ и цвета полосы браузера продублированы в скрипте src/index.html — менять вместе (это проверяет тест). */
export const THEME_KEY = 'harid.theme';
export const THEME_BAR = { light: '#ffffff', dark: '#0d1430' } as const;
const DARK_QUERY = '(prefers-color-scheme: dark)';

const isMode = (v: unknown): v is ThemeMode => v === 'system' || v === 'light' || v === 'dark';

/**
 * Тема оформления. Цвета живут в styles.scss: светлые токены в :root, тёмные — при data-theme="dark" на <html>
 * или при data-theme="system" и системной тёмной теме. Без атрибута тема светлая.
 * - По умолчанию — светлая: записи в localStorage нет. «Тёмная» и «Как в системе» сохраняются.
 * - До отрисовки тему ставит скрипт в index.html; hydrate() лишь подхватывает выбор в сигнал.
 * - На сервере и до hydrate() mode — 'light', чтобы гидратация совпала.
 * - meta theme-color (полоса браузера и установленного приложения) следует за темой, в том числе
 *   за сменой системной темы, пока выбрано «Как в системе».
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly doc = inject(DOCUMENT);
  private readonly storage = inject(BrowserStorage);
  private readonly destroyRef = inject(DestroyRef);
  private readonly state = signal<ThemeMode>('light');
  private media: MediaQueryList | null = null;
  readonly mode = this.state.asReadonly();

  hydrate(): void {
    if (!this.browser || this.media) return;
    const saved = this.storage.get<unknown>(THEME_KEY, 'light');
    this.state.set(isMode(saved) ? saved : 'light');
    this.media = typeof matchMedia === 'function' ? matchMedia(DARK_QUERY) : null;
    const onChange = () => { if (this.state() === 'system') this.paintBar(); };
    this.media?.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => this.media?.removeEventListener('change', onChange));
    this.apply();
  }

  set(mode: ThemeMode): void {
    this.state.set(mode);
    if (mode === 'light') this.storage.remove(THEME_KEY);
    else this.storage.set(THEME_KEY, mode);
    this.apply();
  }

  private apply(): void {
    if (!this.browser) return;
    const root = this.doc.documentElement;
    const mode = this.state();
    if (mode === 'light') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);
    this.paintBar();
  }

  private paintBar(): void {
    const mode = this.state();
    const dark = mode === 'dark' || (mode === 'system' && !!this.media?.matches);
    this.doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? THEME_BAR.dark : THEME_BAR.light);
  }
}
