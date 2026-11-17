import { Component, effect, inject, signal, untracked } from '@angular/core';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { FavoritesService } from '../../core/favorites.service';
import { MarketApi } from '../../core/market-api.service';
import { Product } from '../../core/models';
import { ProductCardComponent } from '../../shared/product-card.component';

/** Избранное: товары по сохранённым id; снятые с продажи пропускаются. */
@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [ProductCardComponent],
  template: `
    <h1>Избранное</h1>
    @if (!fav.ready() || loading()) { <p class="muted">Загрузка…</p> }
    @else if (products().length) {
      <div class="grid">@for (p of products(); track p.id) { <app-product-card [product]="p" /> }</div>
    }
    @else { <p class="muted">Пока пусто</p> }
  `,
  styles: `.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:16px }`,
})
export class FavoritesComponent {
  private readonly api = inject(MarketApi);
  readonly fav = inject(FavoritesService);
  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);

  constructor() {
    // Решаем «пусто» только после гидратации избранного; смена списка отменяет прежний запрос.
    effect((onCleanup) => {
      if (!this.fav.ready()) return;
      const ids = this.fav.ids();
      const sub = untracked(() => this.load(ids));
      onCleanup(() => sub.unsubscribe());
    });
  }

  private load(ids: string[]): Subscription {
    if (!ids.length) {
      this.products.set([]);
      this.loading.set(false);
      return new Subscription();
    }
    this.loading.set(true);
    return forkJoin(ids.map((id) => this.api.product(id).pipe(catchError(() => of(null))))).subscribe((list) => {
      this.products.set(list.filter((p): p is Product => !!p));
      this.loading.set(false);
    });
  }
}
