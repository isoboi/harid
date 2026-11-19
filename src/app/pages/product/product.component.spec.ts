import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { buyBarVisible, ProductComponent } from './product.component';
import { MarketApi } from '../../core/market-api.service';
import { CartService } from '../../core/cart.service';
import { Product, Review } from '../../core/models';

const prod = (over: Partial<Product> = {}): Product => ({ id: '16', shop_handle: 'technomir.tj', title: 'Наушники', price: 540, old_price: 600, image: 'a.jpg', images: ['a.jpg', 'b.jpg'], category: 'gadgets', description: 'Описание', sizes: [], in_stock: true, posted_at: '', ...over });

async function render(p: Product, reviews: Review[] = []) {
  const api = { product: jest.fn(() => of(p)), products: jest.fn(() => of([])), reviews: jest.fn(() => of(reviews)), shop: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))) };
  await TestBed.configureTestingModule({ imports: [ProductComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
  const f = TestBed.createComponent(ProductComponent);
  f.componentRef.setInput('id', p.id);
  f.detectChanges();
  return Object.assign(f, { api });
}

describe('ProductComponent', () => {
  beforeEach(() => localStorage.clear());
  it('оценка под названием: «★ 4,8 · 12 отзывов»; без отзывов — ничего', async () => {
    const f = await render(prod({ rating: 4.8, reviews_count: 12 }));
    expect((f.nativeElement as HTMLElement).querySelector('[data-test="rating"]')?.textContent?.trim()).toBe('4,8 · 12 отзывов');
    TestBed.resetTestingModule();
    const g = await render(prod({ rating: null, reviews_count: 0 }));
    expect((g.nativeElement as HTMLElement).querySelector('[data-test="rating"]')).toBeNull();
  });
  it('раздел «Отзывы» под описанием: запрос по товару, список и пустое состояние', async () => {
    const review: Review = { id: 1, product_id: '16', product_title: 'Наушники', shop_handle: 'technomir.tj', author: 'Фарангис', rating: 5, text: 'Отлично', created_at: '2026-11-18T09:00:00Z' };
    const f = await render(prod({ rating: 5, reviews_count: 1 }), [review]);
    expect(f.api.reviews).toHaveBeenCalledWith({ product: '16' });
    const el: HTMLElement = f.nativeElement;
    const section = el.querySelector('app-reviews')!;
    expect(section.textContent).toContain('Фарангис');
    expect(section.textContent).toContain('18 ноября');
    expect(el.querySelector('details.desc')!.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    TestBed.resetTestingModule();
    const g = await render(prod());
    expect((g.nativeElement as HTMLElement).querySelector('[data-test="empty"]')?.textContent).toContain('Отзывов пока нет');
  });
  it('показывает цену, старую цену и все фото', async () => {
    const f = await render(prod());
    const el: HTMLElement = f.nativeElement;
    expect(el.textContent).toContain('540 смн');
    expect(el.textContent).toContain('600 смн');
    expect(el.querySelectorAll('[data-test="thumb"]').length).toBe(2);
  });
  it('видео — последний слайд галереи: по нажатию миниатюры вместо фото плеер без предзагрузки', async () => {
    const f = await render(prod({ video: 'v.mp4' }));
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('[data-test="video"]')).toBeNull();
    expect(el.querySelectorAll('[data-test="thumb"]').length).toBe(2);
    (el.querySelector('[data-test="thumb-video"]') as HTMLButtonElement).click();
    f.detectChanges();
    const video = el.querySelector('[data-test="video"]') as HTMLVideoElement;
    expect(video.getAttribute('src')).toBe('v.mp4');
    expect(video.getAttribute('preload')).toBe('none');
    expect(video.getAttribute('poster')).toBe('a.jpg');
    expect(el.querySelector('.main img')).toBeNull();
    (el.querySelector('[data-test="thumb"]') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el.querySelector('[data-test="video"]')).toBeNull();
  });
  it('одно фото и видео — миниатюры показаны; без видео миниатюры видео нет', async () => {
    const f = await render(prod({ images: ['a.jpg'], video: 'v.mp4' }));
    expect((f.nativeElement as HTMLElement).querySelectorAll('.thumbs button').length).toBe(2);
    TestBed.resetTestingModule();
    const g = await render(prod({ video: null }));
    expect((g.nativeElement as HTMLElement).querySelector('[data-test="thumb-video"]')).toBeNull();
  });
  it('обещание оплаты наличными стоит под ценой и над кнопками', async () => {
    const f = await render(prod());
    const el: HTMLElement = f.nativeElement;
    const promise = el.querySelector('[data-test="cash-promise"]');
    expect(promise?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Оплата наличными курьеру · без предоплаты · проверяете товар при курьере');
    const price = el.querySelector('.price')!;
    const add = el.querySelector('[data-test="add"]')!;
    expect(price.compareDocumentPosition(promise!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(promise!.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('описание свёрнуто под «Описание из Instagram» и закрыто по умолчанию', async () => {
    const f = await render(prod({ description: 'Строка 1\nСтрока 2' }));
    const d = (f.nativeElement as HTMLElement).querySelector('details.desc') as HTMLDetailsElement;
    expect(d).not.toBeNull();
    expect(d.open).toBe(false);
    expect(d.querySelector('summary')?.textContent?.trim()).toBe('Описание из Instagram');
    expect(d.textContent).toContain('Строка 1\nСтрока 2');
  });
  it.each(['', '   \n '])('пустое описание (%j) — блока нет', async (description) => {
    const f = await render(prod({ description }));
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('details')).toBeNull();
    expect(el.textContent).not.toContain('Описание из Instagram');
  });
  it('товар из Instagram — «Пост в Instagram» открывает исходный пост в новой вкладке', async () => {
    const f = await render(prod({ permalink: 'https://www.instagram.com/p/Df4MU6pzP1g/' }));
    const a = (f.nativeElement as HTMLElement).querySelector('[data-test="ig-post"]') as HTMLAnchorElement;
    expect(a).not.toBeNull();
    expect(a.getAttribute('href')).toBe('https://www.instagram.com/p/Df4MU6pzP1g/');
    expect(a.target).toBe('_blank');
    expect(a.rel).toContain('noopener');
    expect(a.textContent).toContain('Пост в Instagram');
  });
  it.each([undefined, null, '', 'https://example.com/p/1/', 'javascript:alert(1)'])('ссылки на пост Instagram нет (%j) — и блока нет', async (permalink) => {
    const f = await render(prod({ permalink }));
    expect((f.nativeElement as HTMLElement).querySelector('[data-test="ig-post"]')).toBeNull();
  });
  it('несколько вариантов — кнопка недоступна до выбора', async () => {
    const f = await render(prod({ sizes: ['128 ГБ', '256 ГБ'] }));
    const btn: HTMLButtonElement = f.nativeElement.querySelector('[data-test="add"]');
    expect(btn.disabled).toBe(true);
    (f.nativeElement.querySelectorAll('[data-test="size"]')[1] as HTMLButtonElement).click();
    f.detectChanges();
    expect(btn.disabled).toBe(false);
    btn.click();
    expect(TestBed.inject(CartService).items()[0].size).toBe('256 ГБ');
  });
  it('один вариант выбран сам; нет в наличии — кнопка недоступна', async () => {
    const f = await render(prod({ sizes: ['Стандарт'], in_stock: false }));
    const btn: HTMLButtonElement = f.nativeElement.querySelector('[data-test="add"]');
    expect(btn.textContent).toContain('Нет в наличии');
    expect(btn.disabled).toBe(true);
  });
  it('смена id: ответ устаревшего запроса не показывается', async () => {
    const s1 = new Subject<Product>(); const s2 = new Subject<Product>();
    const api = { product: jest.fn((id: string) => (id === '1' ? s1 : s2)), products: jest.fn(() => of([])), reviews: jest.fn(() => of([])), shop: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))) };
    await TestBed.configureTestingModule({ imports: [ProductComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    const f = TestBed.createComponent(ProductComponent);
    f.componentRef.setInput('id', '1'); f.detectChanges();
    f.componentRef.setInput('id', '2'); f.detectChanges();
    s2.next(prod({ id: '2', title: 'Второй' })); s2.complete();
    s1.next(prod({ id: '1', title: 'Первый' })); s1.complete();
    f.detectChanges();
    const text = (f.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Второй');
    expect(text).not.toContain('Первый');
  });
  it('500 — не 404, а сообщение об ошибке', async () => {
    const api = { product: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 500 }))), products: jest.fn(() => of([])), reviews: jest.fn(() => of([])), shop: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))) };
    await TestBed.configureTestingModule({ imports: [ProductComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    const f = TestBed.createComponent(ProductComponent);
    f.componentRef.setInput('id', '1'); f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.textContent).toContain('Не удалось загрузить');
    expect(el.querySelector('app-not-found')).toBeNull();
  });
  it('404 — страница не найдена', async () => {
    const api = { product: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))), products: jest.fn(() => of([])), reviews: jest.fn(() => of([])), shop: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))) };
    await TestBed.configureTestingModule({ imports: [ProductComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    const f = TestBed.createComponent(ProductComponent);
    f.componentRef.setInput('id', '1'); f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('app-not-found')).not.toBeNull();
  });
  it('400 (нечисловой id) — тоже страница не найдена, а не ошибка загрузки', async () => {
    const api = { product: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 400 }))), products: jest.fn(() => of([])), reviews: jest.fn(() => of([])), shop: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))) };
    await TestBed.configureTestingModule({ imports: [ProductComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    const f = TestBed.createComponent(ProductComponent);
    f.componentRef.setInput('id', 'abc'); f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('app-not-found')).not.toBeNull();
    expect(el.textContent).not.toContain('Не удалось загрузить');
  });
  it('корзина на лимите 30 строк — «В корзину» не добавляет и показывает сообщение', async () => {
    localStorage.clear();
    const api = { product: jest.fn(() => of(prod({ id: '99' }))), products: jest.fn(() => of([])), reviews: jest.fn(() => of([])), shop: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))) };
    await TestBed.configureTestingModule({ imports: [ProductComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    const cart = TestBed.inject(CartService);
    for (let n = 1; n <= 30; n++) cart.add(prod({ id: String(n) }), null);
    const f = TestBed.createComponent(ProductComponent);
    f.componentRef.setInput('id', '99'); f.detectChanges();
    (f.nativeElement.querySelector('[data-test="add"]') as HTMLButtonElement).click();
    f.detectChanges();
    expect(cart.items().length).toBe(30);
    expect(f.nativeElement.textContent).toContain('В корзине уже 30 позиций — оформите заказ или уберите лишнее');
  });

  describe('липкая панель покупки (телефон)', () => {
    const bar = (f: { nativeElement: unknown }) => (f.nativeElement as HTMLElement).querySelector('[data-test="buybar"]') as HTMLElement;
    const barBtn = (f: { nativeElement: unknown }) => bar(f).querySelector('.bar-btn') as HTMLButtonElement;

    it('видна, пока основная кнопка не на экране целиком; скрыта, только когда кнопка видна полностью', () => {
      // выше экрана или ниже первого экрана / под вкладками — пересечения нет
      expect(buyBarVisible({ isIntersecting: false, intersectionRatio: 0 })).toBe(true);
      // кнопку наполовину закрывает панель вкладок
      expect(buyBarVisible({ isIntersecting: true, intersectionRatio: 0.5 })).toBe(true);
      expect(buyBarVisible({ isIntersecting: true, intersectionRatio: 1 })).toBe(false);
    });

    describe('наблюдение за основной кнопкой', () => {
      let calls: { cb: IntersectionObserverCallback; opts?: IntersectionObserverInit; el?: Element }[];
      const original = (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
      beforeEach(() => {
        calls = [];
        (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
          private readonly rec: (typeof calls)[number];
          constructor(cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) { this.rec = { cb, opts }; calls.push(this.rec); }
          observe(el: Element) { this.rec.el = el; }
          disconnect() {}
        };
      });
      afterEach(() => { (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = original; });

      it('поле наблюдения поднято над вкладками и панелью; кнопка ниже первого экрана — панель видна сразу', async () => {
        const f = await render(prod());
        f.detectChanges();
        const rec = calls[calls.length - 1];
        expect(rec.el).toBe((f.nativeElement as HTMLElement).querySelector('.actions'));
        expect(rec.opts).toEqual({ rootMargin: '0px 0px -128px 0px', threshold: 1 });
        // первый кадр — панель скрыта, как на сервере
        expect(bar(f).classList).not.toContain('on');
        rec.cb([{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry], {} as IntersectionObserver);
        f.detectChanges();
        expect(bar(f).classList).toContain('on');
        rec.cb([{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry], {} as IntersectionObserver);
        f.detectChanges();
        expect(bar(f).classList).not.toContain('on');
      });
    });

    it('в первом кадре скрыта; с ценой и «Добавить в корзину», добавление → «Перейти в корзину»', async () => {
      const f = await render(prod());
      expect(bar(f).classList).not.toContain('on');
      expect(bar(f).textContent).toContain('540');
      f.componentInstance.barShown.set(true);
      f.detectChanges();
      expect(bar(f).classList).toContain('on');
      expect(barBtn(f).textContent?.trim()).toBe('Добавить в корзину');
      barBtn(f).click();
      f.detectChanges();
      expect(TestBed.inject(CartService).count()).toBe(1);
      const link = barBtn(f);
      expect(link.tagName).toBe('A');
      expect(link.textContent?.trim()).toBe('Перейти в корзину');
      expect(link.getAttribute('href')).toBe('/cart');
    });

    it('нет в наличии — кнопка недоступна', async () => {
      const f = await render(prod({ in_stock: false }));
      expect(barBtn(f).textContent?.trim()).toBe('Нет в наличии');
      expect(barBtn(f).disabled).toBe(true);
    });

    it('размер не выбран — не добавляет, а ведёт к выбору и показывает подсказку', async () => {
      const f = await render(prod({ sizes: ['S', 'M'] }));
      const el: HTMLElement = f.nativeElement;
      expect(el.querySelector('[data-test="size-hint"]')).toBeNull();
      expect(barBtn(f).disabled).toBe(false);
      barBtn(f).click();
      f.detectChanges();
      expect(TestBed.inject(CartService).count()).toBe(0);
      expect(el.querySelector('[data-test="size-hint"]')?.textContent).toContain('Выберите размер');
      expect(document.activeElement).toBe(el.querySelector('[data-test="size"]'));
      (el.querySelectorAll('[data-test="size"]')[1] as HTMLButtonElement).click();
      f.detectChanges();
      expect(el.querySelector('[data-test="size-hint"]')).toBeNull();
      barBtn(f).click();
      expect(TestBed.inject(CartService).items()[0].size).toBe('M');
    });
  });
});
