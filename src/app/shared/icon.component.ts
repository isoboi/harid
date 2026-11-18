import { Component, computed, input } from '@angular/core';

/** Имена иконок витрины. */
export type IconName =
  | 'search' | 'store' | 'heart' | 'user' | 'bag' | 'package' | 'banknote' | 'circle-check'
  | 'truck' | 'shield-check' | 'star' | 'map-pin' | 'x' | 'minus' | 'plus' | 'instagram'
  | 'house' | 'layout-grid' | 'chevron-right';

const ICON_NAMES: readonly string[] = [
  'search', 'store', 'heart', 'user', 'bag', 'package', 'banknote', 'circle-check',
  'truck', 'shield-check', 'star', 'map-pin', 'x', 'minus', 'plus', 'instagram',
  'house', 'layout-grid', 'chevron-right',
];

/**
 * Инлайн-SVG иконка без внешних библиотек и шрифтов.
 * Пути взяты из Lucide (лицензия ISC) той же версии, что в прототипе; неизвестное имя ничего не выводит.
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    @if (known()) {
      <svg
        [attr.width]="size()"
        [attr.height]="size()"
        viewBox="0 0 24 24"
        [attr.fill]="filled() ? 'currentColor' : 'none'"
        stroke="currentColor"
        [attr.stroke-width]="stroke()"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        @switch (name()) {
          @case ('search') {
            <path d="m21 21-4.34-4.34" />
            <circle cx="11" cy="11" r="8" />
          }
          @case ('store') {
            <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
            <path d="M2 7h20" />
            <path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" />
          }
          @case ('heart') {
            <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
          }
          @case ('user') {
            <circle cx="12" cy="8" r="5" />
            <path d="M20 21a8 8 0 0 0-16 0" />
          }
          @case ('bag') {
            <path d="M16 10a4 4 0 0 1-8 0" />
            <path d="M3.103 6.034h17.794" />
            <path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" />
          }
          @case ('package') {
            <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
            <path d="M12 22V12" />
            <path d="m3.3 7 7.61 4.4a2 2 0 0 0 2.18 0L20.7 7" />
            <path d="m7.5 4.27 9 5.15" />
          }
          @case ('banknote') {
            <rect width="20" height="12" x="2" y="6" rx="2" />
            <circle cx="12" cy="12" r="2" />
            <path d="M6 12h.01M18 12h.01" />
          }
          @case ('circle-check') {
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
          }
          @case ('truck') {
            <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
            <path d="M15 18H9" />
            <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
            <circle cx="17" cy="18" r="2" />
            <circle cx="7" cy="18" r="2" />
          }
          @case ('shield-check') {
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
            <path d="m9 12 2 2 4-4" />
          }
          @case ('star') {
            <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
          }
          @case ('map-pin') {
            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
            <circle cx="12" cy="10" r="3" />
          }
          @case ('x') {
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          }
          @case ('minus') {
            <path d="M5 12h14" />
          }
          @case ('plus') {
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          }
          @case ('house') {
            <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
            <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          }
          @case ('layout-grid') {
            <rect width="7" height="7" x="3" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="14" rx="1" />
            <rect width="7" height="7" x="3" y="14" rx="1" />
          }
          @case ('chevron-right') {
            <path d="m9 18 6-6-6-6" />
          }
          @case ('instagram') {
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <path d="M17.5 6.5h.01" />
          }
        }
      </svg>
    }
  `,
  styles: `
    :host { display: inline-flex; flex-shrink: 0; line-height: 0 }
    svg { display: block }
  `,
})
export class IconComponent {
  /** Имя иконки из набора IconName; неизвестное значение не рисуется. */
  readonly name = input<IconName | string>('');
  /** Размер стороны квадрата в пикселях. */
  readonly size = input<number>(20);
  /** Толщина линии: в шапке прототипа 1.8, в остальных местах 2. */
  readonly stroke = input<number>(2);
  /** Залить фигуру цветом линии: сердечко «в избранном», звезда оценки. */
  readonly filled = input<boolean>(false);
  protected readonly known = computed(() => ICON_NAMES.includes(this.name()));
}
