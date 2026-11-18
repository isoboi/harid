import { Component, computed, input } from '@angular/core';
import { amount } from './money.pipe';

/**
 * Ценник-бирка прототипа: шафрановый ярлык с рукописной ценой.
 * Старая цена — зачёркнутой внутри бирки; для скринридера — «Было N смн».
 * swing=true раскачивает бирку один раз (tag-swing), например после «В корзину».
 */
@Component({
  selector: 'app-price-tag',
  standalone: true,
  template: `
    <span class="price-tag" [class.price-tag--sm]="size() === 'sm'" [class.price-tag--lg]="size() === 'lg'" [attr.data-swing]="swing() ? 'true' : null">
      <span>{{ now() }}</span>&ngsp;<span class="cur">смн</span>
      @if (was()) { <s><span class="sr-only">Было&ngsp;</span>{{ was() }}<span class="sr-only">&ngsp;смн</span></s> }
    </span>
  `,
  styles: `:host { display: inline-flex }`,
})
export class PriceTagComponent {
  readonly price = input.required<number>();
  readonly old = input<number | null>(null);
  readonly size = input<'sm' | 'lg'>('sm');
  readonly swing = input<boolean>(false);
  protected readonly now = computed(() => amount(this.price()));
  /** Старую цену показываем, только если она выше текущей. */
  protected readonly was = computed(() => { const o = this.old(); return o && o > this.price() ? amount(o) : ''; });
}
