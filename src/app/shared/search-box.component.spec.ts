import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject, throwError } from 'rxjs';
import { MarketApi } from '../core/market-api.service';
import { SearchSuggestions } from '../core/models';
import { SearchBoxComponent } from './search-box.component';

const answer = (over: Partial<SearchSuggestions> = {}): SearchSuggestions => ({
  shops: [{ handle: 'technomir.tj', name: 'Техномир', avatar_color: '#123', avatar_url: null }],
  categories: [],
  products: [{ id: '42', title: 'Смартфон Honor X8', price: 2100, image: 'https://cdn/1.jpg', shop_handle: 'technomir.tj' }],
  ...over,
});

describe('SearchBoxComponent', () => {
  let replies: Subject<SearchSuggestions>[];
  let suggest: jest.Mock;

  function setup() {
    replies = [];
    suggest = jest.fn(() => { const s = new Subject<SearchSuggestions>(); replies.push(s); return s; });
    TestBed.configureTestingModule({
      imports: [SearchBoxComponent],
      providers: [provideRouter([]), { provide: MarketApi, useValue: { suggest } }],
    });
    const f = TestBed.createComponent(SearchBoxComponent);
    f.detectChanges();
    tick(); // ngModel в форме подключается микрозадачей
    const el: HTMLElement = f.nativeElement;
    const input = el.querySelector('input')!;
    const type = (v: string) => { input.dispatchEvent(new Event('focus')); input.value = v; input.dispatchEvent(new Event('input')); f.detectChanges(); };
    const key = (k: string) => { const e = new KeyboardEvent('keydown', { key: k, cancelable: true }); input.dispatchEvent(e); f.detectChanges(); return e; };
    const reply = (data: SearchSuggestions) => { replies[replies.length - 1].next(data); replies[replies.length - 1].complete(); f.detectChanges(); };
    const panel = () => el.querySelector<HTMLElement>('#search-suggest')!;
    return { f, el, input, type, key, reply, panel };
  }

  it('одна буква — без запроса; с двух — один запрос через 200 мс после последней клавиши', fakeAsync(() => {
    const { type } = setup();
    type('с');
    tick(300);
    expect(suggest).not.toHaveBeenCalled();
    type('см');
    tick(100);
    type('сма');
    tick(199);
    expect(suggest).not.toHaveBeenCalled();
    tick(1);
    expect(suggest).toHaveBeenCalledTimes(1);
    expect(suggest).toHaveBeenCalledWith('сма');
  }));

  it('показывает группы, подсветку, цену и «Все результаты»; combobox раскрыт', fakeAsync(() => {
    const { el, input, type, reply, panel } = setup();
    type('хонор');
    tick(200);
    expect(panel().hidden).toBe(true);
    reply(answer({ products: [{ id: '42', title: 'Honor X8', price: 2100, image: '', shop_handle: 'technomir.tj' }] }));
    expect(panel().hidden).toBe(false);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(Array.from(el.querySelectorAll('.group-label')).map((n) => n.textContent)).toEqual(['Лавки', 'Товары']);
    expect(el.querySelector('.price')?.textContent).toBe('2 100 смн');
    expect(el.querySelector('[data-test="suggest-all"]')?.textContent).toContain('Все результаты по «хонор»');
    type('honor');
    tick(200);
    reply(answer());
    expect(el.querySelector('#sg-1 mark')?.textContent).toBe('Honor');
  }));

  it('новый запрос отменяет старый: опоздавший ответ не показывается', fakeAsync(() => {
    const { f, el, type } = setup();
    type('пл');
    tick(200);
    const first = replies[0];
    type('плат');
    tick(200);
    first.next(answer({ shops: [{ handle: 'old', name: 'Старый', avatar_color: '', avatar_url: null }] }));
    replies[1].next(answer());
    f.detectChanges();
    expect(el.textContent).not.toContain('Старый');
    expect(el.textContent).toContain('Техномир');
  }));

  it('пустой ответ — «Ничего не нашлось» и «Искать «…»»', fakeAsync(() => {
    const { el, type, reply } = setup();
    type('zzzz');
    tick(200);
    reply({ shops: [], categories: [], products: [] });
    expect(el.querySelector('.empty')?.textContent).toContain('Ничего не нашлось');
    expect(el.querySelector('[data-test="suggest-all"]')?.textContent).toContain('Искать «zzzz»');
  }));

  it('ошибка сервера — список молча скрыт, Enter ведёт на полный поиск', fakeAsync(() => {
    const { type, key, panel } = setup();
    suggest.mockReturnValueOnce(throwError(() => new Error('500')));
    type('платье');
    tick(200);
    expect(panel().hidden).toBe(true);
    // Enter не перехвачен — форма отправится и уйдёт на полный поиск
    expect(key('Enter').defaultPrevented).toBe(false);
  }));

  it('↓/↑ по кругу, Enter — переход на выбранный пункт', fakeAsync(() => {
    const { input, type, key, reply } = setup();
    const nav = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    type('тех');
    tick(200);
    reply(answer());
    key('ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe('sg-0');
    key('ArrowUp');
    expect(input.getAttribute('aria-activedescendant')).toBe('sg-2');
    key('ArrowDown');
    key('ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe('sg-1');
    expect(key('Enter').defaultPrevented).toBe(true);
    expect(nav).toHaveBeenCalledWith(['/product', '42']);
  }));

  it('Enter без выбора — /search?q, Esc закрывает список', fakeAsync(() => {
    const { f, type, key, reply, panel } = setup();
    const nav = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    type('  тех ');
    tick(200);
    reply(answer());
    key('Escape');
    expect(panel().hidden).toBe(true);
    f.componentInstance.submit();
    expect(nav).toHaveBeenCalledWith(['/search'], { queryParams: { q: 'тех' } });
  }));

  it('фокус ушёл за пределы — закрыть; внутри — оставить', fakeAsync(() => {
    const { f, el, type, reply, panel } = setup();
    type('тех');
    tick(200);
    reply(answer());
    f.componentInstance.onFocusOut(new FocusEvent('focusout', { relatedTarget: el.querySelector('.opt') }));
    f.detectChanges();
    expect(panel().hidden).toBe(false);
    f.componentInstance.onFocusOut(new FocusEvent('focusout', { relatedTarget: document.body }));
    f.detectChanges();
    expect(panel().hidden).toBe(true);
  }));
});
