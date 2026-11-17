import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CartComponent } from './cart.component';
import { CartService } from '../../core/cart.service';
import { Product } from '../../core/models';

const product: Product = { id: '16', shop_handle: 'technomir.tj', title: 'Наушники', price: 320, old_price: null, image: '', category: null, description: '', sizes: [], in_stock: true, posted_at: '' };

async function setup() {
  await TestBed.configureTestingModule({ imports: [CartComponent], providers: [provideRouter([])] }).compileComponents();
  return TestBed.createComponent(CartComponent);
}

describe('CartComponent', () => {
  beforeEach(() => localStorage.clear());
  it('до гидратации показывает загрузку, а не «пусто»', async () => {
    const f = await setup();
    f.detectChanges();
    const t: string = f.nativeElement.textContent;
    expect(t).toContain('Загрузка');
    expect(t).not.toContain('пока пусто');
  });
  it('после гидратации пустой корзины — призыв к товарам', async () => {
    const f = await setup();
    TestBed.inject(CartService).hydrate();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('пока пусто');
  });
  it('показывает товар и итог', async () => {
    const f = await setup();
    TestBed.inject(CartService).add(product, null, 2);
    f.detectChanges();
    const t: string = f.nativeElement.textContent;
    expect(t).toContain('Наушники');
    expect(t).toContain('640 смн');
  });
  it('«+» отключён при 20 штуках', async () => {
    const f = await setup();
    TestBed.inject(CartService).add(product, null, 20);
    f.detectChanges();
    const plus = f.nativeElement.querySelector('button[aria-label="Больше"]') as HTMLButtonElement;
    expect(plus.disabled).toBe(true);
  });
});
