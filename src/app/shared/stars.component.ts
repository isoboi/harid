import { Component, computed, input } from '@angular/core';
import { IconComponent } from './icon.component';

/** Пять звёзд для показа оценки, как в прототипе: закрашенные шафраном, остальные — цветом линий. */
@Component({
  selector: 'app-stars',
  standalone: true,
  imports: [IconComponent],
  template: `
    <span class="stars" role="img" [attr.aria-label]="label()">
      @for (n of five; track n) { <app-icon name="star" [size]="size()" [filled]="true" [class.on]="n <= filled()" /> }
    </span>
  `,
  styles: `
    :host { display: inline-flex }
    .stars { display: inline-flex; gap: 2px; color: var(--color-line) }
    .on { color: var(--color-saffron) }
    app-icon { display: inline-flex }
  `,
})
export class StarsComponent {
  readonly rating = input.required<number>();
  readonly size = input(15);
  protected readonly five = [1, 2, 3, 4, 5];
  protected readonly filled = computed(() => Math.round(this.rating()));
  protected readonly label = computed(() => `Оценка ${String(Math.round(this.rating() * 10) / 10).replace('.', ',')} из 5`);
}
