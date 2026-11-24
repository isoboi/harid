import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RecentItem, RecentlyViewedService } from '../core/recently-viewed.service';
import { PriceTagComponent } from './price-tag.component';

/**
 * «Вы смотрели»: снимки недавно открытых товаров полосой вбок, как лента лавок.
 * Данные — из браузера (снимок на момент просмотра); актуальные цену и наличие показывает страница товара.
 * Пусто (или всё исключено) — компонент ничего не выводит, кроме пустого живого региона:
 * страницы задают отступы хосту через :has(section).
 */
@Component({
  selector: 'app-recent-strip',
  standalone: true,
  imports: [RouterLink, PriceTagComponent],
  template: `
    <!-- Живой регион есть всегда: после «Очистить» секция исчезает вместе с кнопкой, диктор озвучит итог -->
    <p class="sr-only" aria-live="polite">{{ announce() }}</p>
    @if (visible().length) {
      <section class="recent" aria-labelledby="recent-title">
        <div class="head">
          <h2 id="recent-title" class="title">Вы смотрели</h2>
          <button type="button" class="clear" aria-label="Очистить историю просмотров" (click)="clear()">Очистить</button>
        </div>
        <ul class="strip">
          @for (i of visible(); track i.id) {
            <li>
              <a class="item" [routerLink]="['/product', i.id]">
                <span class="img">
                  @if (i.image) { <img [src]="i.image" alt="" loading="lazy" /> }
                  <app-price-tag class="tag" [price]="i.price" [old]="i.old_price" size="sm" />
                </span>
                <span class="t">{{ i.title }}</span>
                @if (!i.in_stock) { <span class="out">Нет в наличии</span> }
              </a>
            </li>
          }
        </ul>
      </section>
    }
  `,
  styles: `
    :host { display: block }
    .recent { padding-top: 28px }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 12px }
    .title { font-size: 20px; font-weight: 800; letter-spacing: -0.02em }
    .clear { min-height: 44px; padding: 0 4px; font-size: 14px; color: var(--color-ink-soft) }
    @media (hover: hover) { .clear:hover { color: var(--color-ink); text-decoration: underline } }
    .strip { display: flex; gap: 12px; margin-inline: -16px; padding: 0 16px 4px; overflow-x: auto; scroll-snap-type: x proximity; scrollbar-width: none }
    .strip::-webkit-scrollbar { display: none }
    @media (min-width: 640px) { .strip { margin-inline: -24px; padding-inline: 24px; gap: 16px } }
    @media (max-width: 640px) { .strip { scroll-padding-inline: 16px } }
    li { flex: none; width: 120px; scroll-snap-align: start }
    @media (min-width: 640px) { li { width: 150px } }
    .item { display: block; border-radius: var(--radius-photo) }
    .img { position: relative; display: block; aspect-ratio: 1; overflow: hidden; border-radius: var(--radius-photo); background: var(--color-mist) }
    .img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover }
    .tag { position: absolute; top: 8px; left: 6px }
    .t { margin-top: 8px; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; font-size: 14px; line-height: 1.375; font-weight: 500 }
    .out { display: block; margin-top: 2px; font-size: 12px; color: var(--color-ink-soft) }
    @media (hover: hover) { .item:hover .t { text-decoration: underline } }
  `,
})
export class RecentStripComponent {
  protected readonly recent = inject(RecentlyViewedService);
  /** id, которые не показывать (например, уже лежащие в корзине). */
  readonly exclude = input<string[]>([]);
  readonly visible = computed<RecentItem[]>(() => {
    const skip = new Set(this.exclude());
    return this.recent.items().filter((i) => !skip.has(i.id));
  });
  /** Сообщение для диктора; заполняется только после очистки. */
  readonly announce = signal('');

  clear(): void {
    this.recent.clear();
    this.announce.set('История просмотров очищена');
  }
}
