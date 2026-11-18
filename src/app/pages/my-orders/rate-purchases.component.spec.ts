import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { RatePurchasesComponent } from './rate-purchases.component';
import { MarketApi } from '../../core/market-api.service';
import { Reviewable } from '../../core/models';

const ITEM = (over: Partial<Reviewable> = {}): Reviewable => ({
  product_id: '16', product_title: 'Платье макси', image: 'a.jpg', shop_handle: 'zebo.style', order_number: 'R-1', review: null, ...over,
});

async function render(items: Reviewable[], postReview = jest.fn()) {
  const api = { reviewable: jest.fn(() => of(items)), postReview };
  await TestBed.configureTestingModule({ imports: [RatePurchasesComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
  const f = TestBed.createComponent(RatePurchasesComponent);
  f.detectChanges();
  return { f, el: f.nativeElement as HTMLElement, api };
}
const star = (el: HTMLElement, n: number) => el.querySelector(`button[aria-label="Оценка ${n} из 5"]`) as HTMLButtonElement;
const submit = (el: HTMLElement) => [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Отправить отзыв') as HTMLButtonElement;
const type = (el: HTMLElement, text: string) => {
  const ta = el.querySelector('textarea') as HTMLTextAreaElement;
  ta.value = text;
  ta.dispatchEvent(new Event('input'));
};

describe('RatePurchasesComponent', () => {
  it('блок «Оцените покупки»: пять кнопок-звёзд, поле до 1000 знаков, отправка закрыта до выбора оценки', async () => {
    const { el } = await render([ITEM()]);
    expect(el.querySelector('h2')?.textContent?.trim()).toBe('Оцените покупки');
    expect(el.textContent).toContain('Платье макси');
    for (let n = 1; n <= 5; n++) expect(star(el, n)).not.toBeNull();
    expect(el.querySelector('textarea')?.getAttribute('maxlength')).toBe('1000');
    expect(submit(el).disabled).toBe(true);
  });

  it('выбор звезды и отправка: тело { product_id: число, rating, text }, затем «Спасибо за отзыв!» и отзыв с «Изменить»', async () => {
    const postReview = jest.fn(() => of({ id: 9, product_id: '16', product_title: 'Платье макси', shop_handle: 'zebo.style', author: 'Ф', rating: 4, text: 'Супер', created_at: '2026-11-18T09:00:00Z' }));
    const { f, el } = await render([ITEM()], postReview);
    star(el, 4).click();
    f.detectChanges();
    expect(star(el, 4).getAttribute('aria-checked')).toBe('true');
    expect(star(el, 5).getAttribute('aria-checked')).toBe('false');
    expect(el.querySelectorAll('.pick .on').length).toBe(4);
    type(el, '  Супер  ');
    f.detectChanges();
    submit(el).click();
    f.detectChanges();
    expect(postReview).toHaveBeenCalledWith({ product_id: 16, rating: 4, text: 'Супер' });
    expect(el.textContent).toContain('Спасибо за отзыв!');
    expect(el.querySelector('textarea')).toBeNull();
    expect(el.textContent).toContain('Супер');
    expect([...el.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Изменить')).toBe(true);
  });

  it('пустой текст не отправляется', async () => {
    const postReview = jest.fn(() => of({ id: 9, product_id: '16', product_title: '', shop_handle: '', author: '', rating: 5, text: '', created_at: '' }));
    const { f, el } = await render([ITEM()], postReview);
    star(el, 5).click();
    type(el, '   ');
    f.detectChanges();
    submit(el).click();
    expect(postReview).toHaveBeenCalledWith({ product_id: 16, rating: 5 });
  });

  it('клавиатура: стрелки меняют оценку, фокус — на выбранной звезде', async () => {
    const { f, el } = await render([ITEM()]);
    star(el, 3).click();
    f.detectChanges();
    expect(star(el, 3).tabIndex).toBe(0);
    expect(star(el, 1).tabIndex).toBe(-1);
    star(el, 3).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    f.detectChanges();
    expect(star(el, 4).getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(star(el, 4));
    star(el, 4).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    star(el, 3).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    f.detectChanges();
    expect(star(el, 2).getAttribute('aria-checked')).toBe('true');
    star(el, 2).dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    f.detectChanges();
    expect(star(el, 5).getAttribute('aria-checked')).toBe('true');
  });

  it('403 от бэкенда показывается текстом', async () => {
    const postReview = jest.fn(() => throwError(() => new HttpErrorResponse({ status: 403, error: { error: { message: 'Отзыв можно оставить после получения заказа' } } })));
    const { f, el } = await render([ITEM()], postReview);
    star(el, 2).click();
    f.detectChanges();
    submit(el).click();
    f.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent?.trim()).toBe('Отзыв можно оставить после получения заказа');
    expect(el.textContent).not.toContain('Спасибо за отзыв!');
    expect(submit(el).disabled).toBe(false);
  });

  it('уже оставленный отзыв показан с «Изменить»; по нажатию — форма с прежней оценкой и текстом', async () => {
    const { f, el } = await render([ITEM({ review: { rating: 3, text: 'Нормально' } })]);
    expect(el.querySelector('textarea')).toBeNull();
    expect(el.textContent).toContain('Нормально');
    ([...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Изменить') as HTMLButtonElement).click();
    f.detectChanges();
    expect(star(el, 3).getAttribute('aria-checked')).toBe('true');
    expect((el.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Нормально');
  });

  it('нечего оценивать или запрос упал — блока нет', async () => {
    const { el } = await render([]);
    expect(el.querySelector('section')).toBeNull();
    TestBed.resetTestingModule();
    const api = { reviewable: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))), postReview: jest.fn() };
    await TestBed.configureTestingModule({ imports: [RatePurchasesComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    const f = TestBed.createComponent(RatePurchasesComponent);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('section')).toBeNull();
  });
});
