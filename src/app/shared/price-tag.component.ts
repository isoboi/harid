import { Component, computed, input } from '@angular/core';
import { amount } from './money.pipe';

/**
 * Ценник-бирка прототипа: шафрановый ярлык с рукописной ценой.
 * Старая цена — зачёркнутой внутри бирки; для скринридера — «Было N смн».
 * swing=true раскачивает бирку один раз (tag-swing), например после «В корзину».
 * price=null — цены нет (лавка называет её в Direct): бирка не выводится.
 */
@Component({
  selector: 'app-price-tag',
  standalone: true,
  template: `
    @if (price() !== null) {
      <span class="price-tag" [class.price-tag--sm]="size() === 'sm'" [class.price-tag--lg]="size() === 'lg'" [attr.data-swing]="swing() ? 'true' : null">
        <span>{{ now() }}</span>&ngsp;<span class="cur">смн</span>
        @if (was()) { <s><span class="sr-only">Было&ngsp;</span>{{ was() }}<span class="sr-only">&ngsp;смн</span></s> }
        @if (percent()) { <span class="badge">−{{ percent() }}%</span> }
      </span>
      @if (was() && until()) { <span class="until">до {{ until() }}</span> }
    }
  `,
  styles: `
    :host { display: inline-flex; flex-direction: column; align-items: flex-start }
    .badge { align-self: center; padding: 0 .35em; border-radius: var(--radius-sm); background: var(--color-anor); color: var(--color-paper); font-family: var(--font-sans); font-size: .4em; font-weight: 700; line-height: 1.5 }
    .until { margin-top: 2px; color: var(--color-ink-soft); font-family: var(--font-sans); font-size: .7rem; line-height: 1.2; white-space: nowrap }
  `,
})
export class PriceTagComponent {
  readonly price = input.required<number | null>();
  readonly old = input<number | null>(null);
  readonly size = input<'sm' | 'lg'>('sm');
  readonly swing = input<boolean>(false);
  /** Конец акции (ISO); показывается только вместе со старой ценой. */
  readonly endsAt = input<string | null>(null);
  protected readonly now = computed(() => amount(this.price() ?? 0));
  /** Старую цену показываем, только если она выше текущей. */
  protected readonly was = computed(() => { const o = this.old(); const p = this.price(); return o && p !== null && o > p ? amount(o) : ''; });
  protected readonly percent = computed(() => {
    const o = this.old(); const p = this.price();
    return o && p !== null && o > p ? Math.floor(((o - p) / o) * 100) : 0;
  });
  /** «30 ноября» по Душанбе: админка ставит конец акции на 23:59:59 последнего дня. */
  protected readonly until = computed(() => {
    const e = this.endsAt();
    return e ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Asia/Dushanbe' }).format(new Date(e)) : '';
  });
}
