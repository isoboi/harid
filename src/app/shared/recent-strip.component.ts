import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RecentItem, RecentlyViewedService } from '../core/recently-viewed.service';
import { MoneyPipe } from './money.pipe';

/**
 * «Вы смотрели»: снимки недавно открытых товаров полосой вбок, как лента лавок.
 * Данные — из браузера (снимок на момент просмотра); актуальные цену и наличие показывает страница товара.
 * Пусто (или всё исключено) — компонент ничего не выводит, кроме пустого живого региона:
 * страницы задают отступы хосту через :has(section).
 */
let nextId = 0;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-recent-strip',
  standalone: true,
  imports: [RouterLink, MoneyPipe],
  template: `
    <!-- Живой регион есть всегда: после «Очистить» секция исчезает вместе с кнопкой — диктор озвучит итог,
         а фокус переходит сюда (tabindex=-1), а не падает на body -->
    <p #status class="sr-only" aria-live="polite" tabindex="-1">{{ announce() }}</p>
    @if (visible().length) {
      <section class="recent" [attr.aria-labelledby]="titleId">
        <div class="head">
          <h2 [id]="titleId" class="title">Вы смотрели</h2>
          <button type="button" class="clear" aria-label="Очистить историю просмотров" (click)="clear()">Очистить</button>
        </div>
        <ul class="strip">
          @for (i of visible(); track i.id) {
            <li>
              <!-- В разметке название первым: диктор читает «товар, цена»; фото визуально выше (order) -->
              <a class="item" [routerLink]="['/product', i.id]">
                <span class="t">{{ i.title }}</span>
                <span class="img">@if (i.image) { <img [src]="i.image" alt="" loading="lazy" /> }</span>
                <!-- Цена строкой под фото: бирка на узкой карточке обрезалась бы вместе со старой ценой -->
                @if (i.price !== null) {
                  <span class="price" data-test="price">
                    <b>{{ i.price | money }}</b>
                    @if (i.old_price !== null && i.old_price > i.price) { <s><span class="sr-only">Было </span>{{ i.old_price | money }}</s> }
                  </span>
                }
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
    .head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 8px }
    .title { font-size: 20px; font-weight: 800; letter-spacing: -0.02em }
    .clear { min-height: 44px; padding: 0 4px; font-size: 14px; color: var(--color-ink-soft) }
    @media (hover: hover) { .clear:hover { color: var(--color-ink); text-decoration: underline } }
    /* Поля 4px сверху и снизу — чтобы рамка фокуса карточки не срезалась краем прокрутки.
       scroll-padding равен боковому полю, иначе привязка прижимает первую карточку к краю экрана */
    .strip { display: flex; gap: 12px; margin: -4px -16px 0; padding: 4px 16px; scroll-padding-inline: 16px; overflow-x: auto; scroll-snap-type: x proximity; scrollbar-width: none }
    .strip::-webkit-scrollbar { display: none }
    @media (min-width: 640px) { .strip { margin-inline: -24px; padding-inline: 24px; scroll-padding-inline: 24px; gap: 16px } }
    li { flex: none; width: 120px; scroll-snap-align: start }
    @media (min-width: 640px) { li { width: 150px } }
    .item { display: flex; flex-direction: column; border-radius: var(--radius-photo) }
    .img { order: -1; position: relative; display: block; aspect-ratio: 1; overflow: hidden; border-radius: var(--radius-photo); background: var(--color-mist) }
    .img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover }
    .t { margin-top: 8px; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; font-size: 14px; line-height: 1.375; font-weight: 500 }
    .price { margin-top: 2px; display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 6px; font-size: 14px; font-variant-numeric: tabular-nums }
    .price s { font-size: 12px; color: var(--color-ink-soft) }
    .out { margin-top: 2px; font-size: 12px; color: var(--color-ink-soft) }
    @media (hover: hover) { .item:hover .t { text-decoration: underline } }
  `,
})
export class RecentStripComponent {
  protected readonly recent = inject(RecentlyViewedService);
  /** Уникальный id заголовка: на главной две полосы (телефон и десктоп), у каждой свой. */
  protected readonly titleId = `recent-title-${++nextId}`;
  private readonly status = viewChild.required<ElementRef<HTMLElement>>('status');
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
    this.status().nativeElement.focus({ preventScroll: true });
  }
}
