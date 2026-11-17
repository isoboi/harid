import { Component, computed, input } from '@angular/core';

/** Имена иконок витрины. */
export type IconName = 'search' | 'store' | 'heart' | 'user' | 'bag' | 'package' | 'banknote' | 'circle-check';

const ICON_NAMES: readonly string[] = ['search', 'store', 'heart', 'user', 'bag', 'package', 'banknote', 'circle-check'];

/**
 * Инлайн-SVG иконка без внешних библиотек и шрифтов.
 * Пути взяты из Lucide (лицензия ISC); неизвестное имя ничего не выводит.
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
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        @switch (name()) {
          @case ('search') {
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          }
          @case ('store') {
            <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
            <path d="M2 7h20" />
            <path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" />
          }
          @case ('heart') {
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          }
          @case ('user') {
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          }
          @case ('bag') {
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
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
  protected readonly known = computed(() => ICON_NAMES.includes(this.name()));
}
