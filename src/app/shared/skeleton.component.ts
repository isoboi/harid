import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Заглушка ленты товаров на время загрузки: та же сетка .products и те же метрики,
 * что у app-product-card (квадрат фото, две строки названия, @лавка), — после ответа ничего не прыгает.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-skel-products',
  standalone: true,
  template: `
    <div class="products" role="status" data-test="skel-products">
      <span class="sr-only">Загрузка…</span>
      @for (n of cards(); track n) {
        <div class="card" aria-hidden="true">
          <div class="skel img"></div>
          <span class="skel skel--line t1"></span>
          <span class="skel skel--line t2"></span>
          <span class="skel skel--line shop"></span>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block }
    .img { aspect-ratio: 1; border-radius: var(--radius-photo) }
    .t1 { margin-top: 12px; width: 90% }
    .t2 { margin-top: 7px; width: 60% }
    .shop { margin-top: 9px; height: 12px; width: 40% }
  `,
})
export class SkelProductsComponent {
  /** Сколько карточек-заглушек показать. */
  readonly count = input(8);
  protected readonly cards = computed(() => Array.from({ length: this.count() }, (_, i) => i));
}

/**
 * Заглушка сводки заказа справа (.summary из styles.scss): три строки «название — сумма», под ними обещание и кнопка.
 * Сводка сама на фоне mist, поэтому полоски внутри — цвета line, иначе их не видно.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-skel-summary',
  standalone: true,
  template: `
    <div class="summary" aria-hidden="true" data-test="skel-summary">
      @for (w of rows; track $index; let last = $last) {
        <div class="row" [class.total]="last"><span class="skel skel--line" [style.width.%]="w"></span><span class="skel skel--line sum"></span></div>
      }
      @if (actions()) {
        <span class="skel skel--line promise"></span>
        <span class="skel cta"></span>
      }
    </div>
  `,
  styles: `
    :host { display: block }
    .skel { background: var(--color-line) }
    .row { display: flex; justify-content: space-between; gap: 12px; padding-block: 4px }
    .row + .row { margin-top: 8px }
    .row.total { margin-top: 12px; padding-top: 16px; border-top: 1px solid var(--color-line) }
    .sum { width: 72px }
    .promise { margin-top: 24px; width: 85% }
    .cta { display: block; margin-top: 24px; height: 48px }
  `,
})
export class SkelSummaryComponent {
  /** Обещание оплаты и кнопка под суммой (в корзине и на оформлении есть, в заказе — нет). */
  readonly actions = input(true);
  protected readonly rows = [38, 55, 30];
}
