import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { FavoritesComponent } from './favorites.component';
import { FavoritesService } from '../../core/favorites.service';
import { MarketApi } from '../../core/market-api.service';
import { Product } from '../../core/models';

const product: Product = { id: '16', shop_handle: 'technomir.tj', title: 'Наушники', price: 320, old_price: null, image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '' };

describe('FavoritesComponent', () => {
  beforeEach(() => localStorage.clear());

  async function setup(productFn: jest.Mock) {
    await TestBed.configureTestingModule({ imports: [FavoritesComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { product: productFn } }] }).compileComponents();
    return TestBed.createComponent(FavoritesComponent);
  }

  it('до гидратации — «Загрузка…», не «Пока пусто»', async () => {
    const f = await setup(jest.fn());
    f.detectChanges();
    const t: string = f.nativeElement.textContent;
    expect(t).toContain('Загрузка');
    expect(t).not.toContain('Пока пусто');
  });

  it('после гидратации пустого избранного — «Пока пусто»', async () => {
    const product = jest.fn();
    const f = await setup(product);
    TestBed.inject(FavoritesService).hydrate();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Пока пусто');
    expect(product).not.toHaveBeenCalled();
  });

  it('показывает товары, снятые с продажи пропускает', async () => {
    const api = jest.fn((id: string) => (id === '16' ? of(product) : throwError(() => new Error('404'))));
    const f = await setup(api);
    const fav = TestBed.inject(FavoritesService);
    fav.hydrate();
    fav.toggle('16');
    fav.toggle('99');
    f.detectChanges();
    const t: string = f.nativeElement.textContent;
    expect(t).toContain('Наушники');
    expect(t).not.toContain('Пока пусто');
  });
});
