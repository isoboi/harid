import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { amount } from './money.pipe';

/**
 * Ценник-бирка прототипа: шафрановый ярлык с рукописной ценой.
 * Старая цена — зачёркнутой внутри бирки; для скринридера — «Было N смн».
 * swing=true раскачивает бирку один раз (tag-swing), например после «В корзину».
 * price=null — цены нет (лавка называет её в Direct): бирка не выводится.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-price-tag',
  standalone: true,
  template: `
    @if (price() !== null) {
      <span class="price-tag" [class.price-tag--sm]="size() === 'sm'" [class.price-tag--lg]="size() === 'lg'" [attr.data-swing]="swing() ? 'true' : null">
        <span>{{ now() }}</span>&ngsp;<span class="cur">смн</span>
        @if (was()) { <s><span class="sr-only">Было&ngsp;</span>{{ was() }}<span class="sr-only">&ngsp;смн</span></s> }
      </span>
    }
  `,
  styles: `:host { display: inline-flex }`,
})
export class PriceTagComponent {
  readonly price = input.required<number | null>();
  readonly old = input<number | null>(null);
  readonly size = input<'sm' | 'lg'>('sm');
  readonly swing = input<boolean>(false);
  protected readonly now = computed(() => amount(this.price() ?? 0));
  /** Старую цену показываем, только если она выше текущей. */
  protected readonly was = computed(() => { const o = this.old(); const p = this.price(); return o && p !== null && o > p ? amount(o) : ''; });
}
