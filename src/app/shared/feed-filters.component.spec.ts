import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { MarketApi } from '../core/market-api.service';
import { FeedFilters } from '../core/models';
import { FeedFiltersComponent } from './feed-filters.component';

describe('FeedFiltersComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render(value: FeedFilters = {}) {
    const facets = jest.fn(() => of({ sizes: ['M', 'L'], price_min: 120, price_max: 900 }));
    await TestBed.configureTestingModule({
      imports: [FeedFiltersComponent],
      providers: [provideRouter([]), { provide: MarketApi, useValue: { productFacets: facets } }],
    }).compileComponents();
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const f = TestBed.createComponent(FeedFiltersComponent);
    f.componentRef.setInput('base', { category: 'women' });
    f.componentRef.setInput('value', value);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const q = <T extends HTMLElement>(t: string) => el.querySelector<T>(`[data-test="${t}"]`)!;
    const all = (t: string) => Array.from(el.querySelectorAll<HTMLElement>(`[data-test="${t}"]`));
    const lastParams = () => navigate.mock.lastCall![1]!.queryParams;
    const openPanel = () => { q('toggle').click(); f.detectChanges(); };
    return { f, el, q, all, navigate, facets, lastParams, openPanel };
  }

  it('сначала видна только кнопка «Фильтры»; панель открывается и закрывается по нажатию', async () => {
    const { el, q, openPanel } = await render();
    expect(el.querySelector('[data-test="panel"]')).toBeNull();
    expect(el.querySelector('[data-test="sort"]')).toBeNull();
    expect(el.querySelector('[data-test="in-stock"]')).toBeNull();
    expect(q('toggle').getAttribute('aria-expanded')).toBe('false');
    openPanel();
    expect(q('toggle').getAttribute('aria-expanded')).toBe('true');
    expect(q('sort')).not.toBeNull();
    expect(q('in-stock')).not.toBeNull();
    openPanel();
    expect(el.querySelector('[data-test="panel"]')).toBeNull();
  });

  it('по ссылке с фильтрами панель тоже закрыта, число — на кнопке', async () => {
    const { el, q } = await render({ sort: 'price_asc', size: 'M', in_stock: true });
    expect(el.querySelector('[data-test="panel"]')).toBeNull();
    expect(q('toggle').textContent).toContain('Фильтры · 3');
  });

  it('варианты и цены — по категории страницы', async () => {
    const { facets } = await render();
    expect(facets).toHaveBeenCalledWith({ category: 'women' });
  });

  it('сортировка: меняет адрес с merge и replaceUrl', async () => {
    const { q, navigate, lastParams, openPanel } = await render();
    openPanel();
    const select = q<HTMLSelectElement>('sort');
    select.value = 'price_asc';
    select.dispatchEvent(new Event('change'));
    expect(lastParams()).toEqual(expect.objectContaining({ sort: 'price_asc' }));
    expect(navigate.mock.lastCall![1]).toEqual(expect.objectContaining({ queryParamsHandling: 'merge', replaceUrl: true }));
  });

  it('«В наличии» включает и выключает', async () => {
    const off = await render();
    off.openPanel();
    off.q('in-stock').click();
    expect(off.lastParams()).toEqual(expect.objectContaining({ in_stock: '1' }));
    TestBed.resetTestingModule();
    const on = await render({ in_stock: true });
    on.openPanel();
    expect(on.q('in-stock').getAttribute('aria-pressed')).toBe('true');
    on.q('in-stock').click();
    expect(on.lastParams()).toEqual(expect.objectContaining({ in_stock: null }));
  });

  it('в панели — цена с подсказками из фасетов и варианты', async () => {
    const { q, all, openPanel } = await render();
    openPanel();
    expect(q<HTMLInputElement>('min').placeholder).toBe('от 120');
    expect(q<HTMLInputElement>('max').placeholder).toBe('до 900');
    expect(all('size').map((b) => b.textContent?.trim())).toEqual(['M', 'L']);
  });

  it('«Показать»: только цифры, перепутанные поля меняются местами', async () => {
    const { q, lastParams, openPanel } = await render();
    openPanel();
    q<HTMLInputElement>('min').value = '1 000';
    q<HTMLInputElement>('max').value = '200';
    q('apply').click();
    expect(lastParams()).toEqual(expect.objectContaining({ price_min: '200', price_max: '1000' }));
  });

  it('вариант: повторное нажатие снимает', async () => {
    const { all, lastParams, openPanel } = await render({ size: 'M' });
    openPanel();
    all('size')[0].click();
    expect(lastParams()).toEqual(expect.objectContaining({ size: null }));
    all('size')[1].click();
    expect(lastParams()).toEqual(expect.objectContaining({ size: 'L' }));
  });

  it('«Сбросить» — только при фильтрах или сортировке, убирает всё', async () => {
    const none = await render();
    expect(none.el.querySelector('[data-test="reset"]')).toBeNull();
    TestBed.resetTestingModule();
    const some = await render({ sort: 'price_asc', size: 'M' });
    some.q('reset').click();
    expect(some.lastParams()).toEqual({ sort: null, price_min: null, price_max: null, size: null, in_stock: null });
  });
});
