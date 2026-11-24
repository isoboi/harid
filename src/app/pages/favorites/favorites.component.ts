import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { FavoritesService } from '../../core/favorites.service';
import { MarketApi } from '../../core/market-api.service';
import { Product } from '../../core/models';
import { ProductCardComponent } from '../../shared/product-card.component';
import { SkelProductsComponent } from '../../shared/skeleton.component';

/** Избранное: товары по сохранённым id; снятые с продажи пропускаются. */
@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [ProductCardComponent, RouterLink, SkelProductsComponent],
  template: `
    <div class="wrap page-top">
      <h1 class="page-title head">Избранное</h1>
      <!-- Перезагрузка списка (сняли сердечко) не прячет уже показанные карточки за заглушкой -->
      @if (!fav.ready() || (loading() && !products().length)) { <app-skel-products [count]="skelCount()" /> }
      @else if (products().length) {
        <div class="products">@for (p of products(); track p.id) { <app-product-card [product]="p" /> }</div>
      }
      @else {
        <div class="empty">
          <p>Пока пусто. Нажмите на сердечко у товара — он появится здесь.</p>
          <a class="btn" routerLink="/">Смотреть товары</a>
        </div>
      }
    </div>
  `,
  styles: `
    .head { margin-bottom: 32px }
    .empty { max-width: 46ch }
    .empty p { font-size: 18px; line-height: 1.625 }
    .empty .btn { margin-top: 24px }
  `,
})
export class FavoritesComponent {
  private readonly api = inject(MarketApi);
  readonly fav = inject(FavoritesService);
  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  /** Заглушек столько, сколько сохранено товаров (до гидратации — 4), но не больше двух рядов. */
  readonly skelCount = computed(() => Math.min(this.fav.ids().length || 4, 8));

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
