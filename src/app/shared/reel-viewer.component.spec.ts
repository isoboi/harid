import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { Product, Shop } from '../core/models';
import { CLOSE_DRAG, ReelAction, ReelViewerComponent } from './reel-viewer.component';
import { VideoPlayerComponent } from './video-player.component';

const prod = (over: Partial<Product> = {}): Product => ({ id: '16', shop_handle: 'technomir.tj', title: 'Наушники беспроводные', price: 540, old_price: 600, image: 'a.jpg', images: ['a.jpg', 'b.jpg'], category: 'gadgets', description: '', sizes: [], in_stock: true, posted_at: '', video: 'v.mp4', ...over });
const shop: Shop = { handle: 'technomir.tj', name: 'ТехноМир', bio: '', followers: 0, district: null, rating: null, delivered_orders: 0, joined_at: '', avatar_color: '#2348c9', has_fresh: false };
const cart: ReelAction = { label: 'Добавить в корзину' };

function setup(over: { product?: Product; action?: ReelAction; favorite?: boolean; shop?: Shop | null } = {}) {
  const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  TestBed.configureTestingModule({ imports: [ReelViewerComponent], providers: [provideRouter([])] });
  const f = TestBed.createComponent(ReelViewerComponent);
  f.componentRef.setInput('product', over.product ?? prod());
  f.componentRef.setInput('action', over.action ?? cart);
  if (over.favorite !== undefined) f.componentRef.setInput('favorite', over.favorite);
  f.componentRef.setInput('shop', over.shop === undefined ? shop : over.shop);
  const events = { closed: 0, act: 0, fav: 0, liked: 0 };
  f.componentInstance.closed.subscribe(() => events.closed++);
  f.componentInstance.act.subscribe(() => events.act++);
  f.componentInstance.toggleFavorite.subscribe(() => events.fav++);
  f.componentInstance.liked.subscribe(() => events.liked++);
  f.detectChanges();
  const el: HTMLElement = f.nativeElement;
  const q = <T extends HTMLElement = HTMLElement>(id: string) => el.querySelector(`[data-test="${id}"]`) as T;
  /** Палец: у jsdom нет PointerEvent, поэтому нужные поля дописываем в обычное событие. */
  const touch = (target: HTMLElement, type: string, y: number) => {
    target.dispatchEvent(Object.assign(new Event(type, { bubbles: true }), { clientY: y, pointerType: 'touch', isPrimary: true, pointerId: 1 }));
    f.detectChanges();
  };
  return { f, el, q, play, events, touch };
}

describe('ReelViewerComponent', () => {
  afterEach(() => { jest.restoreAllMocks(); TestBed.resetTestingModule(); document.body.style.overflow = ''; });

  it('окно-диалог: подпись для дикторов, вертикальный плеер сам начинает играть', () => {
    const t = setup();
    const stage = t.q('reel-stage');
    expect(stage.getAttribute('role')).toBe('dialog');
    expect(stage.getAttribute('aria-modal')).toBe('true');
    expect(stage.getAttribute('aria-label')).toBe('Видео: Наушники беспроводные');
    const video = stage.querySelector('video') as HTMLVideoElement;
    expect(video.getAttribute('src')).toBe('v.mp4');
    expect(video.getAttribute('poster')).toBe('a.jpg');
    expect(stage.querySelector('.frame')?.classList.contains('reels')).toBe(true);
    expect(t.play).toHaveBeenCalledTimes(1);
  });

  it('поверх видео: лавка, название и цена', () => {
    const t = setup();
    expect(t.q('reel-shop').textContent).toContain('@technomir.tj');
    expect(t.q('reel-shop').getAttribute('href')).toBe('/shop/technomir.tj');
    expect(t.q('reel-title').textContent).toBe('Наушники беспроводные');
    expect(t.q('reel-info').textContent).toContain('540');
  });

  it('без цены (цену договаривают в Direct) блок цены не рисуется', () => {
    const t = setup({ product: prod({ price: null, old_price: null }) });
    expect(t.q('reel-info').querySelector('app-price-tag')).toBeNull();
  });

  it('открылось — страница под ним не прокручивается, фокус на «Закрыть»; закрылось — всё как было', () => {
    document.body.style.overflow = 'scroll';
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const t = setup();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(t.q('reel-close'));
    t.f.destroy();
    expect(document.body.style.overflow).toBe('scroll');
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('закрывается крестиком, нажатием на тёмный фон и клавишей Esc', () => {
    const t = setup();
    t.q('reel-close').click();
    t.q('reel-scrim').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(t.events.closed).toBe(3);
  });

  it('Tab не уходит за окно: с последней кнопки — на первую, Shift+Tab с первой — на последнюю', () => {
    const t = setup();
    const nodes = Array.from(t.q('reel-stage').querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])'));
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    last.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    last.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    const back = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    first.dispatchEvent(back);
    expect(back.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
    // Обычный Tab в середине окна браузер обрабатывает сам
    const mid = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    first.focus();
    first.dispatchEvent(mid);
    expect(mid.defaultPrevented).toBe(false);
  });

  describe('главная кнопка', () => {
    it('обычная кнопка: сообщает о нажатии', () => {
      const t = setup();
      const b = t.q<HTMLButtonElement>('reel-cta');
      expect(b.tagName).toBe('BUTTON');
      expect(b.textContent?.trim()).toBe('Добавить в корзину');
      b.click();
      expect(t.events.act).toBe(1);
    });
    it('«Нет в наличии» — кнопка выключена', () => {
      const t = setup({ action: { label: 'Нет в наличии', disabled: true } });
      const b = t.q<HTMLButtonElement>('reel-cta');
      expect(b.disabled).toBe(true);
      b.click();
      expect(t.events.act).toBe(0);
    });
    it('Direct: ссылка наружу в новой вкладке, нажатие тоже сообщается (там копируется пост)', () => {
      const t = setup({ action: { label: 'Написать в Direct', href: 'https://ig.me/m/shop' } });
      const a = t.q<HTMLAnchorElement>('reel-cta');
      expect(a.getAttribute('href')).toBe('https://ig.me/m/shop');
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toBe('noopener nofollow');
      a.addEventListener('click', (e) => e.preventDefault());
      a.click();
      expect(t.events.act).toBe(1);
    });
    it('«Перейти в корзину»: ссылка внутри сайта, просмотр при этом закрывается', () => {
      const t = setup({ action: { label: 'Перейти в корзину', link: '/cart' } });
      const a = t.q<HTMLAnchorElement>('reel-cta');
      expect(a.getAttribute('href')).toBe('/cart');
      a.click();
      expect(t.events.closed).toBe(1);
    });
  });

  it('переход в лавку закрывает просмотр', () => {
    const t = setup();
    t.q('reel-shop').click();
    expect(t.events.closed).toBe(1);
  });

  it('сердечко сбоку: подпись и нажатое состояние от избранного, нажатие сообщается', () => {
    const t = setup({ favorite: false });
    expect(t.q('reel-fav').getAttribute('aria-pressed')).toBe('false');
    expect(t.q('reel-fav').getAttribute('aria-label')).toBe('В избранное');
    t.q('reel-fav').click();
    expect(t.events.fav).toBe(1);
    t.f.componentRef.setInput('favorite', true);
    t.f.detectChanges();
    expect(t.q('reel-fav').getAttribute('aria-pressed')).toBe('true');
    expect(t.q('reel-fav').getAttribute('aria-label')).toBe('Убрать из избранного');
  });

  it('двойной тап по видео пробрасывается наружу', () => {
    const t = setup();
    t.f.debugElement.query(By.directive(VideoPlayerComponent)).componentInstance.liked.emit();
    expect(t.events.liked).toBe(1);
  });

  describe('свайп вниз пальцем', () => {
    it(`дальше ${CLOSE_DRAG}px — закрывает`, () => {
      const t = setup();
      const stage = t.q('reel-stage');
      t.touch(stage, 'pointerdown', 100);
      t.touch(stage, 'pointermove', 150);
      expect(stage.style.transform).toBe('translateY(50px)');
      expect(stage.classList.contains('dragging')).toBe(true);
      t.touch(stage, 'pointermove', 100 + CLOSE_DRAG + 20);
      t.touch(stage, 'pointerup', 0);
      expect(t.events.closed).toBe(1);
    });
    it('недотянули — окно возвращается на место и не закрывается', () => {
      const t = setup();
      const stage = t.q('reel-stage');
      t.touch(stage, 'pointerdown', 100);
      t.touch(stage, 'pointermove', 160);
      t.touch(stage, 'pointerup', 0);
      expect(t.events.closed).toBe(0);
      expect(stage.style.transform).toBe('');
      expect(stage.classList.contains('dragging')).toBe(false);
    });
    it('вверх и мелкая дрожь пальца — не свайп: обычные нажатия на кнопки не ломаются', () => {
      const t = setup();
      const stage = t.q('reel-stage');
      t.touch(stage, 'pointerdown', 300);
      t.touch(stage, 'pointermove', 295);
      t.touch(stage, 'pointermove', 305);
      expect(stage.classList.contains('dragging')).toBe(false);
      t.touch(stage, 'pointerup', 0);
      expect(t.events.closed).toBe(0);
    });
    it('мышью не закрывается: там есть крестик и Esc', () => {
      const t = setup();
      const stage = t.q('reel-stage');
      stage.dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true }), { clientY: 100, pointerType: 'mouse', isPrimary: true, pointerId: 1 }));
      t.touch(stage, 'pointermove', 400);
      t.touch(stage, 'pointerup', 0);
      expect(t.events.closed).toBe(0);
    });
  });
});
