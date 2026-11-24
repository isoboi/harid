import { TestBed } from '@angular/core/testing';
import { By, Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { buyBarVisible, ProductComponent } from './product.component';
import { MarketApi } from '../../core/market-api.service';
import { CartService } from '../../core/cart.service';
import { FlyToCart } from '../../core/fly-to-cart.service';
import { FavoritesService } from '../../core/favorites.service';
import { HAPTIC } from '../../core/haptics.service';
import { RecentlyViewedService } from '../../core/recently-viewed.service';
import { PLATFORM_ID } from '@angular/core';
import { VideoPlayerComponent } from '../../shared/video-player.component';
import { Product, Review } from '../../core/models';

const prod = (over: Partial<Product> = {}): Product => ({ id: '16', shop_handle: 'technomir.tj', title: 'Наушники', price: 540, old_price: 600, image: 'a.jpg', images: ['a.jpg', 'b.jpg'], category: 'gadgets', description: 'Описание', sizes: [], in_stock: true, posted_at: '', ...over });

async function render(p: Product, reviews: Review[] = []) {
  const api = { product: jest.fn(() => of(p)), products: jest.fn(() => of([])), reviews: jest.fn(() => of(reviews)), reviewSummary: jest.fn(() => of(null)), reviewable: jest.fn(() => of([])), shop: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))) };
  await TestBed.configureTestingModule({ imports: [ProductComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
  const f = TestBed.createComponent(ProductComponent);
  f.componentRef.setInput('id', p.id);
  f.detectChanges();
  return Object.assign(f, { api });
}

describe('ProductComponent', () => {
  beforeEach(() => localStorage.clear());
  it('товар не найден или не загрузился — свой заголовок вкладки, а не прошлой страницы', async () => {
    const f = await render(prod());
    const title = TestBed.inject(Title);
    title.setTitle('@lola — Харид');
    f.api.product.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    f.componentRef.setInput('id', '999'); f.detectChanges();
    expect(title.getTitle()).toBe('Товар не найден — Харид');
    f.api.product.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 502 })));
    f.componentRef.setInput('id', '998'); f.detectChanges();
    expect(title.getTitle()).toBe('Товар не загрузился — Харид');
    TestBed.resetTestingModule();
  });
  it('«Написать продавцу» ведёт в новый чат с лавкой и товаром', async () => {
    const f = await render(prod());
    const a = (f.nativeElement as HTMLElement).querySelector('[data-test="write-seller"]') as HTMLAnchorElement;
    expect(a.textContent?.trim()).toBe('Написать продавцу');
    expect(a.getAttribute('href')).toBe('/chats/new?shop=technomir.tj&product=16');
  });
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
  it('плашка «Продавец» — когда лавка загрузилась; без лавки её нет', async () => {
    const f = await render(prod());
    expect((f.nativeElement as HTMLElement).querySelector('app-seller-card')).toBeNull();
    TestBed.resetTestingModule();
    const shop = { handle: 'technomir.tj', name: 'Техномир', bio: '', followers: 1200, district: null, rating: null, reviews_count: 0, delivered_orders: 5, joined_at: '2026-03-02T00:00:00Z', avatar_color: '#000', has_fresh: false };
    const api = { product: jest.fn(() => of(prod())), products: jest.fn(() => of([])), reviews: jest.fn(() => of([])), reviewSummary: jest.fn(() => of(null)), reviewable: jest.fn(() => of([])), shop: jest.fn(() => of(shop)) };
    await TestBed.configureTestingModule({ imports: [ProductComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    const g = TestBed.createComponent(ProductComponent);
    g.componentRef.setInput('id', '16');
    g.detectChanges();
    const card = (g.nativeElement as HTMLElement).querySelector('app-seller-card');
    expect(card?.textContent).toContain('Техномир');
    expect(card?.textContent).toContain('Пока без оценок');
  });
  it('показывает цену, старую цену и все фото', async () => {
    const f = await render(prod());
    const el: HTMLElement = f.nativeElement;
    expect(el.textContent).toContain('540 смн');
    expect(el.textContent).toContain('600 смн');
    expect(el.querySelectorAll('[data-test="thumb"]').length).toBe(2);
  });
  it('видео — последний слайд галереи: по нажатию миниатюры вместо фото плеер, ролик сразу играет, но заранее не грузится', async () => {
    const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const f = await render(prod({ video: 'v.mp4' }));
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('[data-test="video"]')).toBeNull();
    expect(el.querySelectorAll('[data-test="thumb"]').length).toBe(2);
    expect(play).not.toHaveBeenCalled();
    (el.querySelector('[data-test="thumb-video"]') as HTMLButtonElement).click();
    f.detectChanges();
    const video = el.querySelector('app-video-player [data-test="video"]') as HTMLVideoElement;
    expect(video.getAttribute('src')).toBe('v.mp4');
    expect(video.getAttribute('preload')).toBe('none');
    expect(video.getAttribute('poster')).toBe('a.jpg');
    expect(video.getAttribute('aria-label')).toBe('Видео: Наушники');
    expect(video.hasAttribute('controls')).toBe(false);
    expect(play).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.main img:not(.ambient)')).toBeNull();
    (el.querySelector('[data-test="thumb"]') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el.querySelector('[data-test="video"]')).toBeNull();
  });
  describe('галерея: свайп, фото на весь экран, «Поделиться»', () => {
    /** В jsdom нет PointerEvent: собираем из MouseEvent с нужными полями. */
    const ptr = (type: string, x: number, y = 100, pointerType = 'touch') => {
      const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
      Object.defineProperties(e, { pointerId: { value: 1 }, pointerType: { value: pointerType }, isPrimary: { value: true } });
      return e;
    };
    const swipe = (f: Awaited<ReturnType<typeof render>>, from: number, to: number, pointerType = 'touch') => {
      const main = (f.nativeElement as HTMLElement).querySelector('.main') as HTMLElement;
      main.dispatchEvent(ptr('pointerdown', from, 100, pointerType));
      main.dispatchEvent(ptr('pointermove', (from + to) / 2, 100, pointerType));
      main.dispatchEvent(ptr('pointermove', to, 100, pointerType));
      main.dispatchEvent(ptr('pointerup', to, 100, pointerType));
      f.detectChanges();
    };
    const mainSrc = (f: Awaited<ReturnType<typeof render>>) => ((f.nativeElement as HTMLElement).querySelector('.main img') as HTMLImageElement).getAttribute('src');

    it('свайп пальцем листает фото, счётчик «2 / 2»; мышью — нет', async () => {
      const f = await render(prod());
      const el = f.nativeElement as HTMLElement;
      expect(el.querySelector('[data-test="photo-count"]')?.textContent?.trim()).toBe('1 / 2');
      swipe(f, 300, 150, 'mouse');
      expect(mainSrc(f)).toBe('a.jpg');
      swipe(f, 300, 150);
      expect(mainSrc(f)).toBe('b.jpg');
      expect(el.querySelector('[data-test="photo-count"]')?.textContent?.trim()).toBe('2 / 2');
      swipe(f, 150, 300);
      expect(mainSrc(f)).toBe('a.jpg');
    });

    it('нажатие на фото открывает просмотр на весь экран; закрыли на другом фото — галерея на нём', async () => {
      const f = await render(prod());
      const el = f.nativeElement as HTMLElement;
      (el.querySelector('[data-test="open-viewer"]') as HTMLButtonElement).click();
      f.detectChanges();
      expect(el.querySelector('app-photo-viewer')).not.toBeNull();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      f.detectChanges();
      expect(el.querySelector('app-photo-viewer')).toBeNull();
      expect(mainSrc(f)).toBe('b.jpg');
    });

    it('после свайпа click не открывает просмотр', async () => {
      const f = await render(prod());
      const el = f.nativeElement as HTMLElement;
      swipe(f, 300, 150);
      (el.querySelector('[data-test="open-viewer"]') as HTMLButtonElement).click();
      f.detectChanges();
      expect(el.querySelector('app-photo-viewer')).toBeNull();
    });

    it('«Поделиться» — ссылка на товар с названием и ценой', async () => {
      const f = await render(prod());
      const el = f.nativeElement as HTMLElement;
      (el.querySelector('[data-test="share"]') as HTMLButtonElement).click();
      f.detectChanges();
      const tg = new URL((el.querySelector('[data-test="share-telegram"]') as HTMLAnchorElement).href);
      expect(tg.searchParams.get('url')).toMatch(/\/product\/16$/);
      expect(tg.searchParams.get('text')).toContain('Наушники — 540');
    });
  });
  describe('вертикальный просмотр видео (как в Instagram)', () => {
    const open = async (p: Product) => {
      jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
      jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
      const f = await render(p);
      const el: HTMLElement = f.nativeElement;
      (el.querySelector('[data-test="thumb-video"]') as HTMLButtonElement).click();
      f.detectChanges();
      const expand = el.querySelector('[data-test="expand"]') as HTMLButtonElement;
      expand.focus(); // настоящий клик сначала ставит фокус на кнопку
      expand.click();
      f.detectChanges();
      return { f, el, q: (id: string) => el.querySelector(`[data-test="${id}"]`) as HTMLElement };
    };
    afterEach(() => jest.restoreAllMocks());

    it('кнопка «Вертикальный режим» открывает просмотр, а обычный плеер за ним встаёт на паузу — два ролика не играют', async () => {
      const pause = jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
      const t = await open(prod({ video: 'v.mp4' }));
      expect(t.el.querySelector('app-reel-viewer')).not.toBeNull();
      expect(pause).toHaveBeenCalled();
      expect(t.el.querySelector('.main app-video-player')).not.toBeNull();
      expect(t.el.querySelector('.main')?.textContent).not.toContain('Нет фото');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      t.f.detectChanges();
      expect(t.el.querySelector('app-reel-viewer')).toBeNull();
    });

    it('закрыли просмотр — фокус возвращается на кнопку «Вертикальный режим», а не теряется', async () => {
      const t = await open(prod({ video: 'v.mp4' }));
      const expand = t.q('expand');
      expect(document.activeElement).not.toBe(expand); // пока открыт просмотр, фокус внутри него
      (t.el.querySelector('[data-test="reel-close"]') as HTMLButtonElement).click();
      t.f.detectChanges();
      expect(t.el.querySelector('app-reel-viewer')).toBeNull();
      expect(document.activeElement).toBe(expand);
    });

    it('«Добавить в корзину» кладёт товар и превращается в «Перейти в корзину»', async () => {
      const t = await open(prod({ video: 'v.mp4' }));
      expect(t.q('reel-cta').textContent?.trim()).toBe('Добавить в корзину');
      t.q('reel-cta').click();
      t.f.detectChanges();
      expect(TestBed.inject(CartService).count()).toBe(1);
      expect(t.q('reel-cta').textContent?.trim()).toBe('Перейти в корзину');
      expect(t.q('reel-cta').getAttribute('href')).toBe('/cart');
    });

    it('в просмотре товар кладётся без полёта: корзины под ним не видно', async () => {
      const t = await open(prod({ video: 'v.mp4' }));
      const fly = jest.spyOn(TestBed.inject(FlyToCart), 'fly');
      t.q('reel-cta').click();
      t.f.detectChanges();
      expect(TestBed.inject(CartService).count()).toBe(1);
      expect(fly).not.toHaveBeenCalled();
    });

    it('нет в наличии — кнопка выключена', async () => {
      const t = await open(prod({ video: 'v.mp4', in_stock: false }));
      expect((t.q('reel-cta') as HTMLButtonElement).disabled).toBe(true);
      expect(t.q('reel-cta').textContent?.trim()).toBe('Нет в наличии');
    });

    it('размер не выбран: кнопка «Выбрать размер» закрывает просмотр и показывает подсказку у выбора размера', async () => {
      const t = await open(prod({ video: 'v.mp4', sizes: ['S', 'M'] }));
      expect(t.q('reel-cta').textContent?.trim()).toBe('Выбрать размер');
      t.q('reel-cta').click();
      t.f.detectChanges();
      expect(TestBed.inject(CartService).count()).toBe(0);
      expect(t.el.querySelector('app-reel-viewer')).toBeNull();
      expect(t.q('size-hint')).not.toBeNull();
    });

    it('лавка без подключения: «Написать в Direct» — ссылка на чат, и пост копируется в буфер', async () => {
      const writeText = jest.fn(() => Promise.resolve());
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
      const t = await open(prod({ video: 'v.mp4', price: null, old_price: null, shop_verified: false, direct_url: 'https://ig.me/m/technomir.tj', permalink: 'https://www.instagram.com/p/Df4MU6pzP1g/' }));
      const a = t.q('reel-cta') as HTMLAnchorElement;
      expect(a.getAttribute('href')).toBe('https://ig.me/m/technomir.tj');
      expect(a.textContent?.trim()).toBe('Написать в Direct');
      a.addEventListener('click', (e) => e.preventDefault());
      a.click();
      expect(writeText).toHaveBeenCalledWith('https://www.instagram.com/p/Df4MU6pzP1g/');
      expect(TestBed.inject(CartService).count()).toBe(0);
    });

    it('сердечко сбоку переключает избранное, а двойной тап по видео только добавляет — как лайк', async () => {
      const t = await open(prod({ video: 'v.mp4' }));
      const fav = TestBed.inject(FavoritesService);
      expect(fav.has('16')).toBe(false);
      t.q('reel-fav').click();
      t.f.detectChanges();
      expect(fav.has('16')).toBe(true);
      expect(t.q('reel-fav').getAttribute('aria-pressed')).toBe('true');
      t.q('reel-fav').click();
      expect(fav.has('16')).toBe(false);
      // На странице два плеера: обычный (на паузе) и в просмотре — двойной тап приходит из второго
      const player = t.f.debugElement.query(By.css('app-reel-viewer app-video-player')).componentInstance as VideoPlayerComponent;
      player.liked.emit();
      player.liked.emit();
      expect(fav.has('16')).toBe(true);
    });

    it('переключили товар — просмотр закрыт', async () => {
      const t = await open(prod({ video: 'v.mp4' }));
      t.f.componentRef.setInput('id', '17');
      t.f.detectChanges();
      expect(t.el.querySelector('app-reel-viewer')).toBeNull();
    });
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
  describe('неподключённая лавка (shop_verified=false)', () => {
    const direct = (over: Partial<Product> = {}) => prod({ price: null, old_price: null, shop_verified: false, direct_url: 'https://ig.me/m/technomir.tj', permalink: 'https://www.instagram.com/p/Df4MU6pzP1g/', ...over });

    it('вместо корзины — «Написать в Direct» в новой вкладке, без ценника и обещаний курьера', async () => {
      const f = await render(direct());
      const el = f.nativeElement as HTMLElement;
      expect(el.querySelector('[data-test="add"]')).toBeNull();
      const a = el.querySelector('[data-test="direct"]') as HTMLAnchorElement;
      expect(a.getAttribute('href')).toBe('https://ig.me/m/technomir.tj');
      expect(a.target).toBe('_blank');
      expect(a.rel).toContain('noopener');
      expect(a.textContent).toContain('Написать в Direct');
      expect(el.querySelector('[data-test="bar-direct"]')?.getAttribute('href')).toBe('https://ig.me/m/technomir.tj');
      expect(el.querySelector('.price-tag')).toBeNull();
      expect(el.querySelector('.price')).toBeNull();
      expect(el.querySelector('[data-test="direct-promise"]')?.textContent).toContain('скопируется');
      expect(el.querySelector('[data-test="cash-promise"]')).toBeNull();
      expect(el.querySelector('.trust')).toBeNull();
    });

    it.each(['javascript:alert(1)', 'https://example.com/m/x', null])('чужая ссылка на чат (%j) — ведём на ig.me по нику лавки', async (direct_url) => {
      const f = await render(direct({ direct_url }));
      expect((f.nativeElement as HTMLElement).querySelector('[data-test="direct"]')?.getAttribute('href')).toBe('https://ig.me/m/technomir.tj');
    });

    it('нажатие кладёт ссылку на пост в буфер обмена и сообщает об этом', async () => {
      const writeText = jest.fn(() => Promise.resolve());
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      const f = await render(direct());
      f.componentInstance.copyPost();
      await Promise.resolve();
      f.detectChanges();
      expect(writeText).toHaveBeenCalledWith('https://www.instagram.com/p/Df4MU6pzP1g/');
      expect((f.nativeElement as HTMLElement).querySelector('[data-test="copied"]')?.textContent).toContain('скопирована');
    });

    it('без ссылки на пост — буфер не трогаем и про копирование не пишем', async () => {
      const writeText = jest.fn(() => Promise.resolve());
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      const f = await render(direct({ permalink: null }));
      f.componentInstance.copyPost();
      expect(writeText).not.toHaveBeenCalled();
      expect((f.nativeElement as HTMLElement).querySelector('[data-test="direct-promise"]')?.textContent).not.toContain('скопируется');
    });
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
    const api = { product: jest.fn((id: string) => (id === '1' ? s1 : s2)), products: jest.fn(() => of([])), reviews: jest.fn(() => of([])), reviewSummary: jest.fn(() => of(null)), reviewable: jest.fn(() => of([])), shop: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))) };
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
  it('до ответа — заглушка страницы, после — товар', async () => {
    const res = new Subject<Product>();
    const api = { product: jest.fn(() => res), products: jest.fn(() => of([])), reviews: jest.fn(() => of([])), reviewSummary: jest.fn(() => of(null)), reviewable: jest.fn(() => of([])), shop: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))) };
    await TestBed.configureTestingModule({ imports: [ProductComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    const f = TestBed.createComponent(ProductComponent);
    f.componentRef.setInput('id', '1'); f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[data-test="skel-product"]')).not.toBeNull();
    expect(el.querySelector('h1')).toBeNull();
    res.next(prod({ id: '1', title: 'Платье' })); f.detectChanges();
    expect(el.querySelector('[data-test="skel-product"]')).toBeNull();
    expect(el.querySelector('h1')?.textContent).toContain('Платье');
  });
  it('500 — не 404, а сообщение об ошибке', async () => {
    const api = { product: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 500 }))), products: jest.fn(() => of([])), reviews: jest.fn(() => of([])), reviewSummary: jest.fn(() => of(null)), reviewable: jest.fn(() => of([])), shop: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))) };
    await TestBed.configureTestingModule({ imports: [ProductComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    const f = TestBed.createComponent(ProductComponent);
    f.componentRef.setInput('id', '1'); f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.textContent).toContain('Не удалось загрузить');
    expect(el.querySelector('app-not-found')).toBeNull();
  });
  it('404 — страница не найдена', async () => {
    const api = { product: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))), products: jest.fn(() => of([])), reviews: jest.fn(() => of([])), reviewSummary: jest.fn(() => of(null)), reviewable: jest.fn(() => of([])), shop: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))) };
    await TestBed.configureTestingModule({ imports: [ProductComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    const f = TestBed.createComponent(ProductComponent);
    f.componentRef.setInput('id', '1'); f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('app-not-found')).not.toBeNull();
  });
  it('400 (нечисловой id) — тоже страница не найдена, а не ошибка загрузки', async () => {
    const api = { product: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 400 }))), products: jest.fn(() => of([])), reviews: jest.fn(() => of([])), reviewSummary: jest.fn(() => of(null)), reviewable: jest.fn(() => of([])), shop: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))) };
    await TestBed.configureTestingModule({ imports: [ProductComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    const f = TestBed.createComponent(ProductComponent);
    f.componentRef.setInput('id', 'abc'); f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('app-not-found')).not.toBeNull();
    expect(el.textContent).not.toContain('Не удалось загрузить');
  });
  describe('полёт в корзину', () => {
    it('«В корзину» запускает полёт: сначала от фото, запасной источник — нажатая кнопка', async () => {
      const f = await render(prod());
      const fly = jest.spyOn(TestBed.inject(FlyToCart), 'fly').mockImplementation(() => undefined);
      const el: HTMLElement = f.nativeElement;
      const btn = el.querySelector('[data-test="add"]') as HTMLButtonElement;
      btn.click();
      f.detectChanges();
      expect(fly).toHaveBeenCalledTimes(1);
      expect(fly).toHaveBeenCalledWith(el.querySelector('.main'), btn);
    });

    it('липкая панель покупки: запасной источник — её кнопка', async () => {
      const f = await render(prod());
      const fly = jest.spyOn(TestBed.inject(FlyToCart), 'fly').mockImplementation(() => undefined);
      const el: HTMLElement = f.nativeElement;
      const bar = el.querySelector('[data-test="buybar"] .bar-btn') as HTMLButtonElement;
      bar.click();
      f.detectChanges();
      expect(TestBed.inject(CartService).count()).toBe(1);
      expect(fly).toHaveBeenCalledWith(el.querySelector('.main'), bar);
    });

    it('корзина на лимите — товар не добавлен и не «летит»', async () => {
      localStorage.clear();
      const f = await render(prod({ id: '99' }));
      const cart = TestBed.inject(CartService);
      for (let n = 1; n <= 30; n++) cart.add(prod({ id: String(n) }), null);
      const fly = jest.spyOn(TestBed.inject(FlyToCart), 'fly').mockImplementation(() => undefined);
      (f.nativeElement.querySelector('[data-test="add"]') as HTMLButtonElement).click();
      f.detectChanges();
      expect(cart.items().length).toBe(30);
      expect(fly).not.toHaveBeenCalled();
    });

    it('не выбран размер — ничего не добавлено и не «летит»', async () => {
      const f = await render(prod({ sizes: ['S', 'M'] }));
      const fly = jest.spyOn(TestBed.inject(FlyToCart), 'fly').mockImplementation(() => undefined);
      ((f.nativeElement as HTMLElement).querySelector('[data-test="buybar"] .bar-btn') as HTMLButtonElement).click();
      f.detectChanges();
      expect(TestBed.inject(CartService).count()).toBe(0);
      expect(fly).not.toHaveBeenCalled();
    });
  });

  it('корзина на лимите 30 строк — «В корзину» не добавляет и показывает сообщение', async () => {
    localStorage.clear();
    const api = { product: jest.fn(() => of(prod({ id: '99' }))), products: jest.fn(() => of([])), reviews: jest.fn(() => of([])), reviewSummary: jest.fn(() => of(null)), reviewable: jest.fn(() => of([])), shop: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))) };
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

  describe('вибрация', () => {
    afterEach(() => { delete (navigator as { vibrate?: unknown }).vibrate; });
    const spyVibrate = () => {
      const spy = jest.fn(() => true);
      Object.defineProperty(navigator, 'vibrate', { configurable: true, value: spy });
      return spy;
    };
    const click = (f: { nativeElement: unknown; detectChanges(): void }, test: string) => {
      ((f.nativeElement as HTMLElement).querySelector(`[data-test="${test}"]`) as HTMLButtonElement).click();
      f.detectChanges();
    };

    it('товар лёг в корзину — короткая вибрация успеха', async () => {
      const spy = spyVibrate();
      const f = await render(prod());
      click(f, 'add');
      expect(TestBed.inject(CartService).count()).toBe(1);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(HAPTIC.success);
    });

    it('корзина на лимите — вибрация отказа, а не успеха', async () => {
      localStorage.clear();
      const spy = spyVibrate();
      const f = await render(prod({ id: '99' }));
      const cart = TestBed.inject(CartService);
      for (let n = 1; n <= 30; n++) cart.add(prod({ id: String(n) }), null);
      click(f, 'add');
      expect(cart.items().length).toBe(30);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith([20, 50, 20]);
    });

    it('«В избранное» вибрирует при добавлении, а при удалении молчит', async () => {
      const spy = spyVibrate();
      const f = await render(prod());
      const fav = (f.nativeElement as HTMLElement).querySelector('.fav') as HTMLButtonElement;
      fav.click(); f.detectChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(HAPTIC.light);
      fav.click(); f.detectChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });
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

  describe('недавно просмотренные', () => {
    const failing = (status: number) => ({ product: jest.fn(() => throwError(() => new HttpErrorResponse({ status }))), products: jest.fn(() => of([])), reviews: jest.fn(() => of([])), reviewSummary: jest.fn(() => of(null)), reviewable: jest.fn(() => of([])), shop: jest.fn(() => of(null)) });
    async function renderWith(api: object, extra: object[] = []) {
      await TestBed.configureTestingModule({ imports: [ProductComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }, ...extra] }).compileComponents();
      const f = TestBed.createComponent(ProductComponent);
      f.componentRef.setInput('id', '16');
      f.detectChanges();
      return f;
    }
    it('загруженный товар попадает в недавно просмотренные', async () => {
      await render(prod());
      expect(TestBed.inject(RecentlyViewedService).items().map((i) => i.id)).toEqual(['16']);
    });
    it('на сервере просмотр не записывается', async () => {
      const api = { product: jest.fn(() => of(prod())), products: jest.fn(() => of([])), reviews: jest.fn(() => of([])), reviewSummary: jest.fn(() => of(null)), reviewable: jest.fn(() => of([])), shop: jest.fn(() => of(null)) };
      await renderWith(api, [{ provide: PLATFORM_ID, useValue: 'server' }]);
      expect(TestBed.inject(RecentlyViewedService).items()).toEqual([]);
    });
    it('товар не найден (404) — убирается из недавно просмотренных', async () => {
      TestBed.configureTestingModule({});
      TestBed.inject(RecentlyViewedService).add(prod({ id: '17' }));
      TestBed.inject(RecentlyViewedService).add(prod());
      TestBed.resetTestingModule();
      await renderWith(failing(404));
      const recent = TestBed.inject(RecentlyViewedService);
      recent.hydrate();
      // Убран только ненайденный товар — и в памяти, и в хранилище
      expect(recent.items().map((i) => i.id)).toEqual(['17']);
      expect(JSON.parse(localStorage.getItem('harid.recent')!).map((i: { id: string }) => i.id)).toEqual(['17']);
    });
    it('ошибка сети (500) историю не трогает', async () => {
      TestBed.configureTestingModule({});
      TestBed.inject(RecentlyViewedService).add(prod());
      TestBed.resetTestingModule();
      await renderWith(failing(500));
      const recent = TestBed.inject(RecentlyViewedService);
      recent.hydrate();
      expect(recent.items().map((i) => i.id)).toEqual(['16']);
    });
  });
});
