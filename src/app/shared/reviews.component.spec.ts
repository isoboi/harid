import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ReviewsComponent } from './reviews.component';
import { MarketApi } from '../core/market-api.service';
import { AuthService } from '../core/auth.service';
import { Review, ReviewSummary } from '../core/models';

const R = (over: Partial<Review> = {}): Review => ({
  id: 1, product_id: '16', product_title: 'Платье макси', shop_handle: 'zebo.style', author: 'Фарангис', rating: 4,
  text: 'Цвет как на фото.', created_at: '2026-11-18T09:00:00Z', ...over,
});
const SUM: ReviewSummary = { rating: 4.5, count: 2, distribution: { '5': 1, '4': 1, '3': 0, '2': 0, '1': 0 } };

async function render(inputs: Record<string, unknown>, opts: { summary?: ReviewSummary | null; reviewable?: unknown[]; loggedIn?: boolean } = {}) {
  const api = {
    reviewSummary: jest.fn(() => of(opts.summary ?? null)),
    reviews: jest.fn(() => of([R({ id: 9, rating: 5, author: 'Нигина' })])),
    reviewable: jest.fn(() => of(opts.reviewable ?? [])),
  };
  await TestBed.configureTestingModule({ imports: [ReviewsComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
  if (opts.loggedIn) { const a = TestBed.inject(AuthService); a.hydrate(); a.setSession({ token: 't', buyer: { id: 1, phone: '+992', name: null }, is_new: false }); }
  const f = TestBed.createComponent(ReviewsComponent);
  for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  return { f, api, el: f.nativeElement as HTMLElement };
}

describe('ReviewsComponent', () => {
  beforeEach(() => localStorage.clear());

  it('лента: автор, «Покупка подтверждена», звёзды, дата по-русски и текст', async () => {
    const { el } = await render({ reviews: [R(), R({ id: 2, author: 'Нигина', rating: 5, created_at: '2026-10-22T08:00:00Z' })], rating: 4.5, count: 2 });
    expect(el.querySelector('h2')?.textContent?.trim()).toBe('Отзывы');
    const items = el.querySelectorAll('[data-test="review"]');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Фарангис');
    expect(items[0].textContent).toContain('Покупка подтверждена');
    expect(items[0].textContent).toContain('18 ноября');
    expect(items[0].textContent).toContain('Цвет как на фото.');
    expect(items[0].querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Оценка 4 из 5');
    expect(items[1].textContent).toContain('22 октября');
    const sum = el.querySelector('[data-test="summary"]')!;
    expect(sum.textContent).toContain('4,5');
    expect(sum.textContent).toContain('2 отзыва');
    // Глобальный .summary — карточка итогов корзины: с этим классом сводка получала её фон и отступы
    expect(sum.classList.contains('summary')).toBe(false);
  });

  it('сводка с сервера: полосы 5★…1★, пустые оценки неактивны', async () => {
    const { el, api } = await render({ reviews: [R()], rating: 4, count: 1, product: '16' }, { summary: SUM });
    expect(api.reviewSummary).toHaveBeenCalledWith({ product: '16', shop: '' });
    const bars = Array.from(el.querySelectorAll<HTMLButtonElement>('[data-test="bar"]'));
    expect(bars.map((b) => b.querySelector('.bar-n')?.textContent?.trim())).toEqual(['1', '1', '0', '0', '0']);
    expect(bars.map((b) => b.disabled)).toEqual([false, false, true, true, true]);
    expect(el.querySelector('[data-test="summary"]')?.textContent).toContain('4,5');
  });

  it('полоса — фильтр по оценке на сервере; чип сбрасывает', async () => {
    const { f, el, api } = await render({ reviews: [R()], rating: 4, count: 2, product: '16' }, { summary: SUM });
    el.querySelector<HTMLButtonElement>('[data-test="bar"]')!.click(); f.detectChanges();
    expect(api.reviews).toHaveBeenLastCalledWith({ product: '16', rating: 5 });
    expect(el.querySelector('[data-test="review"]')?.textContent).toContain('Нигина');
    el.querySelector<HTMLButtonElement>('[data-test="chip-star"]')!.click(); f.detectChanges();
    expect(el.querySelector('[data-test="chip-star"]')).toBeNull();
    expect(el.querySelector('[data-test="review"]')?.textContent).toContain('Фарангис');
  });

  it('«С текстом» — запрос with_text', async () => {
    const { f, el, api } = await render({ reviews: [R()], rating: 4, count: 1, shop: 'zebo.style' }, { summary: SUM });
    el.querySelector<HTMLButtonElement>('[data-test="chip-text"]')!.click(); f.detectChanges();
    expect(api.reviews).toHaveBeenLastCalledWith({ shop: 'zebo.style', with_text: true });
  });

  it('ответ лавки под отзывом', async () => {
    const { el } = await render({ reviews: [R({ reply: { text: 'Спасибо, ждём снова!', created_at: '2026-11-19T09:00:00Z' } })], rating: 4, count: 1 });
    const reply = el.querySelector('[data-test="reply"]')!;
    expect(reply.textContent).toContain('Ответ лавки @zebo.style');
    expect(reply.textContent).toContain('19 ноября');
    expect(reply.textContent).toContain('Спасибо, ждём снова!');
  });

  it('больше шести — «Показать ещё»', async () => {
    const many = Array.from({ length: 8 }, (_, i) => R({ id: i + 1 }));
    const { f, el } = await render({ reviews: many, rating: 4, count: 8 });
    expect(el.querySelectorAll('[data-test="review"]').length).toBe(6);
    el.querySelector<HTMLButtonElement>('[data-test="more"]')!.click(); f.detectChanges();
    expect(el.querySelectorAll('[data-test="review"]').length).toBe(8);
    expect(el.querySelector('[data-test="more"]')).toBeNull();
  });

  it('пусто — «Отзывов пока нет», без полос и ленты', async () => {
    const { el } = await render({ reviews: [], rating: null, count: 0 });
    expect(el.querySelector('[data-test="empty"]')?.textContent?.trim()).toBe('Отзывов пока нет');
    expect(el.querySelector('[data-test="bar"]')).toBeNull();
    expect(el.querySelectorAll('[data-test="review"]').length).toBe(0);
  });

  it('null (не загрузилось) — раздела нет', async () => {
    const { el } = await render({ reviews: null });
    expect(el.querySelector('section')).toBeNull();
  });

  it('на странице лавки у отзыва — ссылка на товар; на товаре — нет', async () => {
    const shop = await render({ reviews: [R()], rating: 4, count: 1, showProduct: true });
    const a = shop.el.querySelector('[data-test="review"] a') as HTMLAnchorElement;
    expect(a.textContent?.trim()).toBe('Платье макси');
    expect(a.getAttribute('href')).toBe('/product/16');
    TestBed.resetTestingModule();
    const prod = await render({ reviews: [R()], rating: 4, count: 1 });
    expect(prod.el.querySelector('[data-test="review"] a')).toBeNull();
  });

  it('покупатель получил этот товар — оценка прямо в разделе', async () => {
    const item = { product_id: '16', product_title: 'Платье макси', image: '', shop_handle: 'zebo.style', order_number: 'R-1', review: null };
    const { el, api } = await render({ reviews: [], rating: null, count: 0, product: '16' }, { reviewable: [item], loggedIn: true });
    expect(api.reviewable).toHaveBeenCalled();
    const card = el.querySelector('[data-test="rate-here"]')!;
    expect(card.textContent).toContain('Вы купили этот товар — оцените его');
    expect(card.querySelectorAll('[role="radio"]').length).toBe(5);
  });

  it('гость — карточки оценки нет и reviewable не запрашивается', async () => {
    const { el, api } = await render({ reviews: [R()], rating: 4, count: 1, product: '16' });
    expect(api.reviewable).not.toHaveBeenCalled();
    expect(el.querySelector('[data-test="rate-here"]')).toBeNull();
  });
});
