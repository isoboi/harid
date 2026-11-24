import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';

/** Рисунки вибрации в мс: число — один импульс, массив — «вибрация, пауза, вибрация…». */
export const HAPTIC = {
  /** Лёгкое касание: добавили в избранное. */
  light: 10,
  /** Дело сделано: товар лёг в корзину. */
  success: 15,
  /** Не вышло: два коротких импульса (например, корзина на лимите). */
  warning: [20, 50, 20],
} as const;

/**
 * Короткая вибрация в ответ на действие — как в приложениях.
 * Работает там, где есть `navigator.vibrate` (Android: Chrome, Samsung Internet, установленный PWA);
 * в iOS (Safari и PWA) метода нет, и вызовы тихо ничего не делают.
 * Не вибрирует на сервере и у тех, кто включил «уменьшить движение»: для них это та же настройка покоя.
 * Звать только из обработчиков касаний и кликов — иначе браузер вибрацию не пропустит.
 */
@Injectable({ providedIn: 'root' })
export class Haptics {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  light(): void { this.buzz(HAPTIC.light); }
  success(): void { this.buzz(HAPTIC.success); }
  warning(): void { this.buzz([...HAPTIC.warning]); }

  private buzz(pattern: number | number[]): void {
    if (!this.browser || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try { navigator.vibrate(pattern); } catch { /* запрещено политикой браузера — не страшно */ }
  }
}
