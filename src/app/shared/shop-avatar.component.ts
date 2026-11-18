import { Component, computed, input } from '@angular/core';

/**
 * Кружок лавки как в прототипе: кольцо 3px (шафран — есть свежие посты, иначе серое),
 * белая обводка 2px и цветной круг с первой буквой. Буква — 36% диаметра.
 */
@Component({
  selector: 'app-shop-avatar',
  standalone: true,
  host: { 'aria-hidden': 'true' },
  template: `
    <span class="ring" [class.fresh]="fresh()" [style.width.px]="size()" [style.height.px]="size()">
      <span class="face" [style.background]="color() || 'var(--color-lapis)'" [style.font-size.px]="size() * 0.36">{{ letter() }}</span>
    </span>
  `,
  styles: `
    :host { display: inline-flex; flex-shrink: 0 }
    .ring { display: inline-grid; place-items: center; padding: 3px; border-radius: 9999px; background: var(--color-line) }
    .ring.fresh { background: var(--color-saffron) }
    .face { display: grid; place-items: center; width: 100%; height: 100%; border: 2px solid var(--color-paper); border-radius: 9999px; color: var(--color-paper); font-weight: 700; line-height: 1 }
  `,
})
export class ShopAvatarComponent {
  /** Имя или ник лавки: из него берётся первая буква. */
  readonly name = input.required<string>();
  readonly color = input<string>('');
  readonly size = input<number>(72);
  readonly fresh = input<boolean>(false);
  protected readonly letter = computed(() => this.name().replace(/^@/, '').charAt(0).toUpperCase());
}
