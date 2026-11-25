import { Component, inject } from '@angular/core';
import { PwaService } from '../core/pwa.service';

/**
 * Плашка «Нет интернета» внизу экрана, над панелью вкладок. Область role="status" есть всегда,
 * меняется только текст — так скринридер объявит и пропажу, и возвращение сети.
 */
@Component({
  selector: 'app-offline-banner',
  standalone: true,
  template: `
    <div class="live" role="status">
      @if (!pwa.online()) {
        <p class="bar" data-test="offline">Нет интернета. Показываем то, что уже загружалось; заказать получится, когда сеть вернётся.</p>
      }
    </div>
  `,
  styles: `
    .live { position: fixed; left: 0; right: 0; bottom: calc(16px + env(safe-area-inset-bottom)); z-index: 60; display: flex; justify-content: center; padding-inline: 16px; pointer-events: none }
    @media (max-width: 640px) { .live { bottom: calc(var(--tabbar-h) + 8px + env(safe-area-inset-bottom)) } }
    /* Шафран, а не синий: синяя плашка сливалась бы с подвалом */
    .bar { max-width: 560px; padding: 10px 16px; border-radius: 12px; background: var(--color-saffron); color: var(--color-ink); font-weight: 500; font-size: 14px; line-height: 1.4; box-shadow: var(--shadow-pop); pointer-events: auto }
  `,
})
export class OfflineBannerComponent {
  protected readonly pwa = inject(PwaService);
}
