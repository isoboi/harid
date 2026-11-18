import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ReviewsComponent } from './reviews.component';
import { Review } from '../core/models';

const R = (over: Partial<Review> = {}): Review => ({
  id: 1, product_id: '16', product_title: 'Платье макси', shop_handle: 'zebo.style', author: 'Фарангис', rating: 4,
  text: 'Цвет как на фото.', created_at: '2026-11-18T09:00:00Z', ...over,
});

async function render(inputs: { reviews: Review[] | null; rating?: number | null; count?: number; showProduct?: boolean }) {
  await TestBed.configureTestingModule({ imports: [ReviewsComponent], providers: [provideRouter([])] }).compileComponents();
  const f = TestBed.createComponent(ReviewsComponent);
  for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
  f.detectChanges();
  return f;
}

describe('ReviewsComponent', () => {
  it('список: автор, звёзды, дата по-русски и текст', async () => {
    const f = await render({ reviews: [R(), R({ id: 2, author: 'Нигина', rating: 5, text: 'Длинновато', created_at: '2026-10-22T08:00:00Z' })], rating: 4.5, count: 2 });
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('h2')?.textContent?.trim()).toBe('Отзывы');
    const items = el.querySelectorAll('[data-test="review"]');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Фарангис');
    expect(items[0].textContent).toContain('18 ноября');
    expect(items[0].textContent).toContain('Цвет как на фото.');
    expect(items[0].querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Оценка 4 из 5');
    expect(items[0].querySelectorAll('.on').length).toBe(4);
    expect(items[1].textContent).toContain('22 октября');
    expect(el.querySelector('[data-test="summary"]')?.textContent).toContain('4,5');
    expect(el.querySelector('[data-test="summary"]')?.textContent).toContain('2 отзыва');
  });
  it('пустой список — «Отзывов пока нет…» без сводки', async () => {
    const f = await render({ reviews: [], rating: null, count: 0 });
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('[data-test="empty"]')?.textContent?.trim()).toBe('Отзывов пока нет. Оставить отзыв можно после получения заказа.');
    expect(el.querySelector('[data-test="summary"]')).toBeNull();
    expect(el.querySelectorAll('[data-test="review"]').length).toBe(0);
  });
  it('null (не загрузилось) — раздела нет', async () => {
    const f = await render({ reviews: null });
    expect((f.nativeElement as HTMLElement).querySelector('section')).toBeNull();
  });
  it('на странице лавки у отзыва — ссылка на товар', async () => {
    const f = await render({ reviews: [R()], rating: 4, count: 1, showProduct: true });
    const a = (f.nativeElement as HTMLElement).querySelector('[data-test="review"] a') as HTMLAnchorElement;
    expect(a.textContent?.trim()).toBe('Платье макси');
    expect(a.getAttribute('href')).toBe('/product/16');
  });
  it('на странице товара название товара не повторяется', async () => {
    const f = await render({ reviews: [R()], rating: 4, count: 1 });
    expect((f.nativeElement as HTMLElement).querySelector('[data-test="review"] a')).toBeNull();
  });
});
