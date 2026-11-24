import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Product } from '../core/models';
import { RecentlyViewedService } from '../core/recently-viewed.service';
import { RecentStripComponent } from './recent-strip.component';

const p = (id: string, over: Partial<Product> = {}): Product => ({ id, shop_handle: 'technomir.tj', title: `Товар ${id}`, price: 320, old_price: null, image: `${id}.jpg`, category: null, description: '', sizes: [], in_stock: true, posted_at: '', ...over });

async function setup(items: Product[], exclude?: string[]) {
  localStorage.clear();
  await TestBed.configureTestingModule({ imports: [RecentStripComponent], providers: [provideRouter([])] }).compileComponents();
  const recent = TestBed.inject(RecentlyViewedService);
  [...items].reverse().forEach((i) => recent.add(i));
  const f = TestBed.createComponent(RecentStripComponent);
  if (exclude) f.componentRef.setInput('exclude', exclude);
  f.detectChanges();
  const el: HTMLElement = f.nativeElement;
  return { f, el, recent };
}

describe('RecentStripComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('пустая история — ничего не выводит', async () => {
    const { el } = await setup([]);
    expect(el.querySelector('section')).toBeNull();
    expect(el.textContent!.trim()).toBe('');
  });
  it('показывает заголовок, название, цену и ссылку на товар', async () => {
    const { el } = await setup([p('16', { title: 'Наушники', price: 320 })]);
    expect(el.textContent).toContain('Вы смотрели');
    expect(el.textContent).toContain('Наушники');
    expect(el.textContent).toContain('320');
    expect(el.querySelector('a[href="/product/16"]')).not.toBeNull();
  });
  it('свежие первыми', async () => {
    const { el } = await setup([p('2'), p('1')]);
    expect([...el.querySelectorAll('a[href^="/product/"]')].map((a) => a.getAttribute('href'))).toEqual(['/product/2', '/product/1']);
  });
  it('exclude скрывает товары', async () => {
    const { el } = await setup([p('16'), p('17')], ['16']);
    expect(el.querySelector('a[href="/product/16"]')).toBeNull();
    expect(el.querySelector('a[href="/product/17"]')).not.toBeNull();
  });
  it('исключены все — ничего не выводит', async () => {
    const { el } = await setup([p('16')], ['16']);
    expect(el.querySelector('section')).toBeNull();
  });
  it('in_stock: false — пометка «Нет в наличии»', async () => {
    const { el } = await setup([p('16', { in_stock: false })]);
    expect(el.textContent).toContain('Нет в наличии');
  });
  it('в наличии — без пометки', async () => {
    const { el } = await setup([p('16')]);
    expect(el.textContent).not.toContain('Нет в наличии');
  });
  it('цена в Direct (price: null) — карточка есть, ценника нет', async () => {
    const { el } = await setup([p('16', { price: null, title: 'Платье' })]);
    expect(el.textContent).toContain('Платье');
    expect(el.querySelector('.price-tag')).toBeNull();
  });
  it('без фото — нет <img>', async () => {
    const { el } = await setup([p('16', { image: '', images: [] })]);
    expect(el.querySelector('a[href="/product/16"]')).not.toBeNull();
    expect(el.querySelector('img')).toBeNull();
  });
  it('«Очистить» очищает историю и прячет полосу', async () => {
    const { f, el, recent } = await setup([p('16')]);
    const btn = [...el.querySelectorAll('button')].find((b) => b.textContent!.includes('Очистить'))!;
    btn.click();
    f.detectChanges();
    expect(recent.items()).toEqual([]);
    expect(el.querySelector('section')).toBeNull();
  });

  it('после «Очистить» диктор слышит «История просмотров очищена»', async () => {
    const { f, el } = await setup([p('16')]);
    const live = () => el.querySelector('[aria-live="polite"]');
    expect(live()?.textContent?.trim()).toBe('');
    [...el.querySelectorAll('button')].find((b) => b.textContent!.includes('Очистить'))!.click();
    f.detectChanges();
    expect(live()?.textContent?.trim()).toBe('История просмотров очищена');
  });
  it('кнопка «Очистить» подписана для диктора', async () => {
    const { el } = await setup([p('16')]);
    const btn = [...el.querySelectorAll('button')].find((b) => b.textContent!.includes('Очистить'))!;
    expect(btn.getAttribute('aria-label')).toBe('Очистить историю просмотров');
  });
});
