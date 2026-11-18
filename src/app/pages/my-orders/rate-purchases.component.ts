import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
import { MarketApi } from '../../core/market-api.service';
import { Reviewable, ReviewInput } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { StarsComponent } from '../../shared/stars.component';

const MAX_TEXT = 1000;

/**
 * Одна полученная покупка: выбор звёзд (радиогруппа, стрелки/Home/End), необязательный текст и отправка.
 * Уже оставленный отзыв показан с «Изменить»; повторная отправка обновляет его.
 */
@Component({
  selector: 'app-rate-item',
  standalone: true,
  imports: [RouterLink, IconComponent, StarsComponent],
  template: `
    @let it = item();
    <div class="item">
      <a class="thumb" [routerLink]="['/product', it.product_id]" tabindex="-1" aria-hidden="true">
        @if (it.image) { <img [src]="it.image" alt="" loading="lazy" /> }
      </a>
      <div class="body">
        <a class="t" [routerLink]="['/product', it.product_id]">{{ it.product_title }}</a>
        <p class="meta">&#64;{{ it.shop_handle }} · заказ {{ it.order_number }}</p>
        @if (thanks()) { <p class="thanks" role="status">Спасибо за отзыв!</p> }
        @if (!editing() && it.review; as r) {
          <div class="done">
            <app-stars [rating]="r.rating" [size]="16" />
            @if (r.text) { <p class="text">{{ r.text }}</p> }
            <button type="button" class="link" (click)="edit()">Изменить</button>
          </div>
        } @else {
          <div class="pick" role="radiogroup" [attr.aria-label]="'Оценка товара «' + it.product_title + '»'">
            @for (n of five; track n) {
              <button type="button" role="radio" class="star-btn" [attr.aria-checked]="rating() === n" [attr.aria-label]="'Оценка ' + n + ' из 5'"
                [tabIndex]="n === focusable() ? 0 : -1" (click)="rating.set(n)" (keydown)="onKey($event, n)">
                <app-icon name="star" [size]="28" [filled]="true" [class.on]="n <= rating()" />
              </button>
            }
          </div>
          <label class="sr-only" [attr.for]="'review-' + uid">Текст отзыва</label>
          <textarea [id]="'review-' + uid" rows="3" [attr.maxlength]="maxText" placeholder="Что понравилось, что нет — по желанию"
            [value]="text()" (input)="text.set($any($event.target).value)"></textarea>
          @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
          <div class="actions">
            <button type="button" class="btn" [disabled]="!rating() || sending()" (click)="send()">Отправить отзыв</button>
            @if (it.review) { <button type="button" class="link" (click)="cancel()">Отмена</button> }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block }
    .item { display: flex; gap: 16px; padding-block: 20px }
    .thumb { position: relative; flex: none; width: 72px; height: 72px; overflow: hidden; border-radius: 10px; background: var(--color-mist) }
    .thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover }
    .body { flex: 1; min-width: 0 }
    .t { font-weight: 600; overflow-wrap: anywhere }
    @media (hover: hover) { .t:hover { text-decoration: underline } }
    .meta { margin-top: 2px; font-size: 13px; color: var(--color-ink-soft) }
    .thanks { margin-top: 8px; font-weight: 600; color: var(--color-lapis) }
    .done { margin-top: 8px; display: flex; flex-wrap: wrap; align-items: center; column-gap: 12px }
    .done .text { flex-basis: 100%; order: 3; margin-top: 4px; max-width: 60ch; font-size: 15px; line-height: 1.625; white-space: pre-line; overflow-wrap: anywhere }
    /* Звёзды выбора: видимая звезда 28px, кнопка 44×44 — цель для пальца */
    .pick { margin: 4px 0 0 -8px; display: flex }
    .star-btn { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 10px; color: var(--color-line) }
    .star-btn:focus-visible { outline: 2px solid var(--color-lapis); outline-offset: -2px }
    @media (hover: hover) { .star-btn:hover { background: var(--color-mist) } }
    .star-btn app-icon { display: inline-flex }
    .star-btn .on { color: var(--color-saffron) }
    textarea { display: block; width: 100%; max-width: 560px; margin-top: 8px; padding: 10px 12px; border: 1px solid var(--color-line); border-radius: 10px; font: inherit; font-size: 16px; line-height: 1.5; resize: vertical; background: var(--color-paper); color: var(--color-ink) }
    textarea:focus-visible { outline: 2px solid var(--color-lapis); outline-offset: 1px }
    .error { margin-top: 8px }
    .actions { margin-top: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 12px }
    .link { min-height: 44px; padding: 0 4px; font-weight: 600; color: var(--color-lapis) }
    @media (hover: hover) { .link:hover { text-decoration: underline } }
  `,
})
export class RateItemComponent {
  private static next = 0;
  private readonly api = inject(MarketApi);
  readonly item = input.required<Reviewable>();
  /** Отзыв принят: родитель обновляет строку списка. */
  readonly saved = output<Reviewable>();
  protected readonly uid = ++RateItemComponent.next;
  protected readonly five = [1, 2, 3, 4, 5];
  protected readonly maxText = MAX_TEXT;
  protected readonly editing = signal(false);
  protected readonly rating = signal(0);
  protected readonly text = signal('');
  protected readonly sending = signal(false);
  protected readonly error = signal('');
  protected readonly thanks = signal(false);
  /** Роуминг-фокус: Tab попадает на выбранную звезду, без выбора — на первую. */
  protected readonly focusable = computed(() => this.rating() || 1);

  edit(): void {
    const r = this.item().review;
    this.rating.set(r?.rating ?? 0);
    this.text.set(r?.text ?? '');
    this.error.set(''); this.thanks.set(false);
    this.editing.set(true);
  }
  cancel(): void { this.editing.set(false); this.error.set(''); }

  onKey(e: KeyboardEvent, n: number): void {
    const next = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? Math.min(5, n + 1)
      : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? Math.max(1, n - 1)
      : e.key === 'Home' ? 1 : e.key === 'End' ? 5 : 0;
    if (!next) return;
    e.preventDefault();
    this.rating.set(next);
    // Все пять кнопок всегда в DOM: фокус переводим сразу, не дожидаясь перерисовки
    const group = (e.currentTarget as HTMLElement).parentElement;
    (group?.children[next - 1] as HTMLElement | undefined)?.focus();
  }

  send(): void {
    const rating = this.rating();
    if (!rating || this.sending()) return;
    const text = this.text().trim().slice(0, MAX_TEXT);
    const body: ReviewInput = { product_id: Number(this.item().product_id), rating, ...(text ? { text } : {}) };
    this.sending.set(true); this.error.set('');
    this.api.postReview(body).subscribe({
      next: (r) => {
        this.sending.set(false);
        this.editing.set(false);
        this.thanks.set(true);
        this.saved.emit({ ...this.item(), review: { rating: r?.rating ?? rating, text: r?.text ?? text } });
      },
      error: (e) => { this.sending.set(false); this.error.set(apiErrorMessage(e)); },
    });
  }
}

/** Блок «Оцените покупки» на «Моих заказах»: полученные товары из reviewable(). Пусто или ошибка — блока нет. */
@Component({
  selector: 'app-rate-purchases',
  standalone: true,
  imports: [RateItemComponent],
  template: `
    @if (items().length) {
      <section class="rate" aria-labelledby="rate-title">
        <h2 id="rate-title" class="title">Оцените покупки</h2>
        <p class="note">Отзыв увидят другие покупатели на странице товара и лавки.</p>
        <ul class="list">
          @for (it of items(); track it.product_id + '|' + it.order_number) {
            <li><app-rate-item [item]="it" (saved)="update($event)" /></li>
          }
        </ul>
      </section>
    }
  `,
  styles: `
    :host { display: block }
    .rate { max-width: 760px }
    .title { font-size: 22px; font-weight: 700 }
    .note { margin-top: 4px; font-size: 14px; color: var(--color-ink-soft) }
    .list { margin-top: 12px; border-top: 1px solid var(--color-line) }
    .list li + li { border-top: 1px solid var(--color-line) }
  `,
})
export class RatePurchasesComponent {
  private readonly api = inject(MarketApi);
  readonly items = signal<Reviewable[]>([]);

  constructor() {
    // Блок выводится только вошедшему покупателю после гидратации auth — запрос идёт уже в браузере
    this.api.reviewable().subscribe({ next: (list) => this.items.set(list), error: () => this.items.set([]) });
  }

  update(next: Reviewable): void {
    this.items.update((list) => list.map((i) => (i.product_id === next.product_id && i.order_number === next.order_number ? next : i)));
  }
}
