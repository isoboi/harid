import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { TPipe } from '../core/i18n';
import { MarketApi } from '../core/market-api.service';
import { FeedFilters, ProductFacets, ProductQuery, ProductSort } from '../core/models';
import { activeFilterCount, filtersToParams, SORT_OPTIONS } from './feed-filters';

const NO_FACETS: ProductFacets = { sizes: [], price_min: null, price_max: null };

/**
 * Кнопка «Фильтры» над лентой; по нажатию — панель: сортировка, «В наличии»,
 * цена и вариант. Состояние — только в адресе (?sort=…&price_min=…): страница
 * читает его и перезапускает ленту, ссылку можно отправить, SSR рисует ту же выдачу.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-feed-filters',
  standalone: true,
  imports: [TPipe],
  template: `
    <div class="bar">
      <button type="button" class="chip" data-test="toggle" [class.chip--on]="open()" [attr.aria-expanded]="open()" aria-controls="feed-filters-panel" (click)="open.set(!open())">
        {{ 'Фильтры' | t }}@if (count()) { · {{ count() }} }
      </button>
      @if (count()) { <button type="button" class="reset" data-test="reset" (click)="reset()">{{ 'Сбросить' | t }}</button> }
    </div>
    @if (open()) {
      <form id="feed-filters-panel" class="panel" data-test="panel" (submit)="applyPrice($event, min.value, max.value)">
        <div class="row">
          <label class="sort">
            <span class="sr-only">{{ 'Сортировка' | t }}</span>
            <select class="field-control" data-test="sort" [value]="value().sort ?? 'new'" (change)="setSort($any($event.target).value)">
              @for (o of sorts; track o.value) { <option [value]="o.value">{{ o.label | t }}</option> }
            </select>
          </label>
          <button type="button" class="chip" data-test="in-stock" [class.chip--on]="value().in_stock" [attr.aria-pressed]="!!value().in_stock" (click)="toggleStock()">{{ 'В наличии' | t }}</button>
        </div>
        <fieldset class="price">
          <legend class="label">{{ 'Цена, смн' | t }}</legend>
          <input #min class="field-control" data-test="min" inputmode="numeric" autocomplete="off" [attr.aria-label]="'Цена от' | t"
                 [value]="value().price_min ?? ''" [placeholder]="facets().price_min !== null ? ('от {n}' | t: { n: facets().price_min ?? '' }) : ('от' | t)" />
          <span aria-hidden="true">—</span>
          <input #max class="field-control" data-test="max" inputmode="numeric" autocomplete="off" [attr.aria-label]="'Цена до' | t"
                 [value]="value().price_max ?? ''" [placeholder]="facets().price_max !== null ? ('до {n}' | t: { n: facets().price_max ?? '' }) : ('до' | t)" />
          <button type="submit" class="btn" data-test="apply">{{ 'Показать' | t }}</button>
        </fieldset>
        @if (facets().sizes.length) {
          <div class="sizes">
            <span class="label">{{ 'Размер / вариант' | t }}</span>
            <div class="chips">
              @for (s of facets().sizes; track s) {
                <button type="button" class="chip" data-test="size" [class.chip--on]="value().size === s" [attr.aria-pressed]="value().size === s" (click)="toggleSize(s)">{{ s }}</button>
              }
            </div>
          </div>
        }
      </form>
    }
  `,
  styles: `
    .bar, .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px }
    .sort .field-control { height: 40px; width: auto; padding-right: 36px; border-radius: 9999px; font-size: 14px; font-weight: 500;
      background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);
      background-position: right 18px center, right 13px center; background-size: 5px 5px; background-repeat: no-repeat }
    .chip { cursor: pointer; background: var(--color-paper); color: var(--color-ink) }
    .chip.chip--on { background: var(--color-ink); color: var(--color-paper) }
    .reset { height: 40px; padding: 0 8px; color: var(--color-lapis); font-size: 14px; font-weight: 600 }
    .panel { margin-top: 12px; padding: 16px; border: 1px solid var(--color-line); border-radius: var(--radius-photo); display: grid; gap: 16px }
    .price { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; border: 0; padding: 0; margin: 0 }
    .price legend { width: 100%; margin-bottom: 6px }
    .price .field-control { width: 7.5em; height: 44px }
    .price .btn { min-height: 44px }
    .sizes { display: grid; gap: 8px }
    .sizes .chips { flex-wrap: wrap; margin-inline: 0; padding-inline: 0 }
  `,
})
export class FeedFiltersComponent {
  private readonly api = inject(MarketApi);
  private readonly router = inject(Router);
  /** Категория/поиск страницы — по ним считаются варианты и диапазон цен. */
  readonly base = input.required<Pick<ProductQuery, 'category' | 'shop' | 'q'>>();
  /** Текущие фильтры из адреса. */
  readonly value = input.required<FeedFilters>();
  readonly sorts = SORT_OPTIONS;
  /** Панель закрыта, пока не нажали «Фильтры» — даже если фильтры уже в адресе. */
  readonly open = signal(false);
  /** Число на кнопке: фильтры плюс сортировка не по умолчанию — панель закрыта, иначе её не видно. */
  readonly count = computed(() => activeFilterCount(this.value()) + (this.value().sort ? 1 : 0));
  readonly facets = toSignal(
    toObservable(this.base).pipe(switchMap((b) => this.api.productFacets(b).pipe(catchError(() => of(NO_FACETS))))),
    { initialValue: NO_FACETS },
  );

  setSort(sort: ProductSort): void { this.go({ ...this.value(), sort }); }
  toggleStock(): void { this.go({ ...this.value(), in_stock: !this.value().in_stock }); }
  toggleSize(size: string): void { this.go({ ...this.value(), size: this.value().size === size ? undefined : size }); }
  /** Сбрасывает всё, включая сортировку. */
  reset(): void { this.go({}); }

  applyPrice(event: Event, min: string, max: string): void {
    event.preventDefault();
    const num = (v: string) => { const d = v.replace(/\D/g, ''); return d ? Number(d) : undefined; };
    let lo = num(min); let hi = num(max);
    if (lo !== undefined && hi !== undefined && lo > hi) [lo, hi] = [hi, lo];
    this.go({ ...this.value(), price_min: lo, price_max: hi });
  }

  private go(next: FeedFilters): void {
    // replaceUrl: каждое нажатие фильтра не должно копить шаги «Назад»
    void this.router.navigate([], { queryParams: filtersToParams(next), queryParamsHandling: 'merge', replaceUrl: true });
  }
}
