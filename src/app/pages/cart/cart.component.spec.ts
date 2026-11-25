import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CartComponent, UNDO_MS } from './cart.component';
import { CartService } from '../../core/cart.service';
import { ToastService } from '../../core/toast.service';
import { RecentlyViewedService } from '../../core/recently-viewed.service';
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
    expect(f.nativeElement.querySelector('[data-test="skel-cart"]')).not.toBeNull();
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
  it('обещание оплаты наличными — блоком над кнопкой оформления', async () => {
    const f = await setup();
    TestBed.inject(CartService).add(product, null, 1);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    const promise = el.querySelector('[data-test="cash-promise"]');
    const btn = el.querySelector('a.btn')!;
    expect(promise?.textContent).toContain('Оплата наличными курьеру');
    expect(promise!.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('«−» отключён при 1 штуке: удалить можно только крестиком', async () => {
    const f = await setup();
    const cart = TestBed.inject(CartService);
    cart.add(product, null, 1);
    f.detectChanges();
    const minus = () => f.nativeElement.querySelector('button[aria-label="Меньше"]') as HTMLButtonElement;
    expect(minus().disabled).toBe(true);
    minus().click();
    expect(cart.count()).toBe(1);
    cart.setQty(product.id, null, 2);
    f.detectChanges();
    expect(minus().disabled).toBe(false);
  });
  it('миниатюра: первое фото из images, ссылка на товар; без фото — серая заглушка', async () => {
    const f = await setup();
    const cart = TestBed.inject(CartService);
    cart.add({ ...product, image: 'old.jpg', images: ['first.jpg', 'second.jpg'] }, null, 1);
    cart.add({ ...product, id: '17', title: 'Без фото', image: '' }, null, 1);
    f.detectChanges();
    const thumbs = f.nativeElement.querySelectorAll('a.thumb') as NodeListOf<HTMLAnchorElement>;
    expect(thumbs.length).toBe(2);
    expect(thumbs[0].getAttribute('href')).toBe('/product/16');
    expect(thumbs[0].querySelector('img')?.getAttribute('src')).toBe('first.jpg');
    expect(thumbs[1].querySelector('img')).toBeNull();
    expect(thumbs[1].getAttribute('href')).toBe('/product/17');
  });
  it('миниатюра без images берёт image', async () => {
    const f = await setup();
    TestBed.inject(CartService).add({ ...product, image: 'only.jpg' }, null, 1);
    f.detectChanges();
    expect(f.nativeElement.querySelector('a.thumb img')?.getAttribute('src')).toBe('only.jpg');
  });

  describe('отмена удаления', () => {
    afterEach(() => jest.useRealTimers());
    const removeBtn = (el: HTMLElement, title: string) => el.querySelector(`button[aria-label="Убрать «${title}» из корзины"]`) as HTMLButtonElement;
    const toast = () => TestBed.inject(ToastService).current();

    it('× убирает товар и показывает «Товар убран · Вернуть»; «Вернуть» восстанавливает тот же размер и количество', async () => {
      const f = await setup();
      const cart = TestBed.inject(CartService);
      cart.add({ ...product, id: '20', title: 'Платье', sizes: ['S', 'M'] }, 'M', 3);
      cart.add(product, null, 1);
      f.detectChanges();
      removeBtn(f.nativeElement, 'Платье').click();
      f.detectChanges();
      expect(cart.items().map((i) => i.product.id)).toEqual(['16']);
      expect(toast()?.text).toBe('Товар убран');
      expect(toast()?.action?.label).toBe('Вернуть');
      TestBed.inject(ToastService).act();
      expect(cart.items().map((i) => [i.product.id, i.size, i.qty])).toEqual([['20', 'M', 3], ['16', null, 1]]);
      expect(toast()?.leaving).toBe(true);
    });
    it('после удаления последнего товара «Вернуть» возвращает его в пустую корзину', async () => {
      const f = await setup();
      const cart = TestBed.inject(CartService);
      cart.add(product, null, 2);
      f.detectChanges();
      removeBtn(f.nativeElement, 'Наушники').click();
      f.detectChanges();
      expect(f.nativeElement.textContent).toContain('пока пусто');
      TestBed.inject(ToastService).act();
      expect(cart.items()[0].qty).toBe(2);
    });
    it('плашка висит 6 секунд', async () => {
      jest.useFakeTimers();
      const f = await setup();
      TestBed.inject(CartService).add(product, null, 1);
      f.detectChanges();
      removeBtn(f.nativeElement, 'Наушники').click();
      jest.advanceTimersByTime(UNDO_MS - 1);
      expect(toast()?.leaving).toBe(false);
      jest.advanceTimersByTime(1);
      expect(toast()?.leaving).toBe(true);
    });
    it('исчезает при следующем действии с корзиной', async () => {
      const f = await setup();
      const cart = TestBed.inject(CartService);
      cart.add(product, null, 1);
      cart.add({ ...product, id: '17', title: 'Колонка' }, null, 1);
      f.detectChanges();
      removeBtn(f.nativeElement, 'Наушники').click();
      f.detectChanges();
      expect(toast()?.leaving).toBe(false);
      (f.nativeElement.querySelector('button[aria-label="Больше"]') as HTMLButtonElement).click();
      f.detectChanges();
      expect(toast()?.leaving).toBe(true);
      expect(cart.items().map((i) => [i.product.id, i.qty])).toEqual([['17', 2]]);
    });
    it('чужую плашку следующее действие не трогает', async () => {
      const f = await setup();
      const cart = TestBed.inject(CartService);
      cart.add(product, null, 1);
      cart.add({ ...product, id: '17', title: 'Колонка' }, null, 1);
      f.detectChanges();
      removeBtn(f.nativeElement, 'Наушники').click();
      f.detectChanges();
      TestBed.inject(ToastService).show({ text: 'Снова в сети' });
      (f.nativeElement.querySelector('button[aria-label="Больше"]') as HTMLButtonElement).click();
      expect(toast()?.text).toBe('Снова в сети');
      expect(toast()?.leaving).toBe(false);
    });
  });
  it('«+» отключён при 20 штуках', async () => {
    const f = await setup();
    TestBed.inject(CartService).add(product, null, 20);
    f.detectChanges();
    const plus = f.nativeElement.querySelector('button[aria-label="Больше"]') as HTMLButtonElement;
    expect(plus.disabled).toBe(true);
  });

  describe('«Вы смотрели»', () => {
    const other: Product = { ...product, id: '17', title: 'Чехол' };
    const strip = (f: { nativeElement: HTMLElement }) => f.nativeElement.querySelector('app-recent-strip section');
    it('пустая корзина после гидратации — полоса под призывом', async () => {
      const f = await setup();
      TestBed.inject(RecentlyViewedService).add(other);
      TestBed.inject(CartService).hydrate();
      f.detectChanges();
      const el: HTMLElement = f.nativeElement;
      expect(el.textContent).toContain('пока пусто');
      expect(strip(f)?.textContent).toContain('Чехол');
      expect(el.querySelector('.empty')!.compareDocumentPosition(strip(f)!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    it('товар из корзины в полосе не повторяется', async () => {
      const f = await setup();
      const recent = TestBed.inject(RecentlyViewedService);
      recent.add(product); recent.add(other);
      TestBed.inject(CartService).add(product, null, 1);
      f.detectChanges();
      expect(strip(f)?.textContent).toContain('Чехол');
      expect(strip(f)?.querySelector('a[href="/product/16"]')).toBeNull();
    });
    it('полоса следит за корзиной: убранный товар появляется, возвращённый — снова скрыт', async () => {
      const f = await setup();
      const recent = TestBed.inject(RecentlyViewedService);
      recent.add(product); recent.add(other);
      TestBed.inject(CartService).add(product, null, 1);
      f.detectChanges();
      const has16 = () => !!strip(f)?.querySelector('a[href="/product/16"]');
      expect(has16()).toBe(false);
      f.componentInstance.remove(TestBed.inject(CartService).items()[0]);
      f.detectChanges();
      expect(has16()).toBe(true);
      TestBed.inject(ToastService).act();
      f.detectChanges();
      expect(has16()).toBe(false);
    });
    it('вся история уже в корзине — полосы нет', async () => {
      const f = await setup();
      TestBed.inject(RecentlyViewedService).add(product);
      TestBed.inject(CartService).add(product, null, 1);
      f.detectChanges();
      expect(f.nativeElement.textContent).not.toContain('Вы смотрели');
    });
    it('до гидратации корзины полосы нет', async () => {
      const f = await setup();
      TestBed.inject(RecentlyViewedService).add(other);
      f.detectChanges();
      expect(f.nativeElement.textContent).toContain('Загрузка');
      expect(f.nativeElement.textContent).not.toContain('Вы смотрели');
    });
  });
});
