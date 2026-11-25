import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PwaService } from '../core/pwa.service';

/**
 * Плашка «Нет интернета» внизу экрана, над панелью вкладок (положение — .dock в styles.scss).
 * Область role="status" есть всегда, меняется только текст — так скринридер объявит и пропажу,
 * и возвращение сети.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
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
    :host { display: contents }
    .live { display: flex; justify-content: center; width: 100% }
    /* Шафран, а не синий: синяя плашка сливалась бы с подвалом */
    .bar { max-width: 560px; padding: 10px 16px; border-radius: 12px; background: var(--color-saffron); color: var(--color-ink); font-weight: 500; font-size: 14px; line-height: 1.4; box-shadow: var(--shadow-pop); pointer-events: auto }
  `,
})
export class OfflineBannerComponent {
  protected readonly pwa = inject(PwaService);
}
