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
    const undoBar = (el: HTMLElement) => el.querySelector('[data-test="undo"]');

    it('× убирает товар и показывает «Товар убран · Вернуть»; «Вернуть» восстанавливает тот же размер и количество', async () => {
      const f = await setup();
      const cart = TestBed.inject(CartService);
      cart.add({ ...product, id: '20', title: 'Платье', sizes: ['S', 'M'] }, 'M', 3);
      cart.add(product, null, 1);
      f.detectChanges();
      removeBtn(f.nativeElement, 'Платье').click();
      f.detectChanges();
      expect(cart.items().map((i) => i.product.id)).toEqual(['16']);
      expect(undoBar(f.nativeElement)?.textContent).toContain('Товар убран');
      (undoBar(f.nativeElement)!.querySelector('button') as HTMLButtonElement).click();
      f.detectChanges();
      expect(cart.items().map((i) => [i.product.id, i.size, i.qty])).toEqual([['20', 'M', 3], ['16', null, 1]]);
      expect(undoBar(f.nativeElement)).toBeNull();
    });
    it('после удаления последнего товара отмена видна и вместе с «пусто»', async () => {
      const f = await setup();
      const cart = TestBed.inject(CartService);
      cart.add(product, null, 2);
      f.detectChanges();
      removeBtn(f.nativeElement, 'Наушники').click();
      f.detectChanges();
      expect(f.nativeElement.textContent).toContain('пока пусто');
      (undoBar(f.nativeElement)!.querySelector('button') as HTMLButtonElement).click();
      f.detectChanges();
      expect(cart.items()[0].qty).toBe(2);
    });
    it('исчезает через 6 секунд', async () => {
      jest.useFakeTimers();
      const f = await setup();
      TestBed.inject(CartService).add(product, null, 1);
      f.detectChanges();
      removeBtn(f.nativeElement, 'Наушники').click();
      f.detectChanges();
      jest.advanceTimersByTime(5999);
      f.detectChanges();
      expect(undoBar(f.nativeElement)).not.toBeNull();
      jest.advanceTimersByTime(1);
      f.detectChanges();
      expect(undoBar(f.nativeElement)).toBeNull();
    });
    it('исчезает при следующем действии с корзиной', async () => {
      const f = await setup();
      const cart = TestBed.inject(CartService);
      cart.add(product, null, 1);
      cart.add({ ...product, id: '17', title: 'Колонка' }, null, 1);
      f.detectChanges();
      removeBtn(f.nativeElement, 'Наушники').click();
      f.detectChanges();
      expect(undoBar(f.nativeElement)).not.toBeNull();
      (f.nativeElement.querySelector('button[aria-label="Больше"]') as HTMLButtonElement).click();
      f.detectChanges();
      expect(undoBar(f.nativeElement)).toBeNull();
      expect(cart.items().map((i) => [i.product.id, i.qty])).toEqual([['17', 2]]);
    });
    it('таймер снимается при уничтожении страницы', async () => {
      const f = await setup();
      TestBed.inject(CartService).add(product, null, 1);
      f.detectChanges();
      const set = jest.spyOn(globalThis, 'setTimeout');
      const clear = jest.spyOn(globalThis, 'clearTimeout');
      removeBtn(f.nativeElement, 'Наушники').click();
      const call = set.mock.calls.findIndex((c) => c[1] === 6000);
      expect(call).toBeGreaterThanOrEqual(0);
      const id = set.mock.results[call].value;
      f.destroy();
      expect(clear).toHaveBeenCalledWith(id);
      set.mockRestore(); clear.mockRestore();
    });
  });
  it('«+» отключён при 20 штуках', async () => {
    const f = await setup();
    TestBed.inject(CartService).add(product, null, 20);
    f.detectChanges();
    const plus = f.nativeElement.querySelector('button[aria-label="Больше"]') as HTMLButtonElement;
    expect(plus.disabled).toBe(true);
  });
});
