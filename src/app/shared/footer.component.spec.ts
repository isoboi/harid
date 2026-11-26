import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { THEME_KEY, ThemeService } from '../core/theme.service';
import { FooterComponent } from './footer.component';

describe('FooterComponent — выбор темы', () => {
  async function render() {
    window.matchMedia = jest.fn(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
    await TestBed.configureTestingModule({
      imports: [FooterComponent],
      providers: [provideRouter([]), { provide: PLATFORM_ID, useValue: 'browser' }],
    }).compileComponents();
    const f = TestBed.createComponent(FooterComponent);
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement, theme: TestBed.inject(ThemeService) };
  }
  const radio = (el: HTMLElement, mode: string) => el.querySelector<HTMLInputElement>(`[data-test="theme-${mode}"]`)!;

  beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-theme'); });
  afterEach(() => { TestBed.resetTestingModule(); delete (window as { matchMedia?: unknown }).matchMedia; });

  it('три варианта в группе «Тема», по умолчанию — «Светлая»', async () => {
    const { el } = await render();
    expect(el.querySelector('fieldset legend')?.textContent?.trim()).toBe('Тема');
    const labels = [...el.querySelectorAll('.opt')].map((l) => l.textContent?.trim());
    expect(labels).toEqual(['Светлая', 'Тёмная', 'Как в системе']);
    expect(radio(el, 'light').checked).toBe(true);
    expect(el.querySelector('.opt.on')?.textContent?.trim()).toBe('Светлая');
  });

  it('выбор «Тёмная» включает тёмную тему и запоминает её', async () => {
    const { f, el, theme } = await render();
    radio(el, 'dark').click();
    f.detectChanges();
    expect(theme.mode()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(JSON.parse(localStorage.getItem(THEME_KEY) ?? 'null')).toBe('dark');
    expect(el.querySelector('.opt.on')?.textContent?.trim()).toBe('Тёмная');
  });

  it('показывает сохранённый выбор после hydrate()', async () => {
    localStorage.setItem(THEME_KEY, JSON.stringify('system'));
    const { f, el, theme } = await render();
    theme.hydrate();
    f.detectChanges();
    expect(radio(el, 'system').checked).toBe(true);
  });
});
