import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { CatalogComponent } from './catalog.component';
import { MarketApi } from '../../core/market-api.service';
import { Category } from '../../core/models';

describe('CatalogComponent', () => {
  async function render(categories: ReturnType<MarketApi['categories']>) {
    await TestBed.configureTestingModule({ imports: [CatalogComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { categories: () => categories } }] }).compileComponents();
    const f = TestBed.createComponent(CatalogComponent);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  it('все категории — плитками со ссылками /c/…, первой — «Все товары»', async () => {
    const list: Category[] = [{ slug: 'odezhda', name: 'Одежда' }, { slug: 'gadgets', name: 'Гаджеты' }];
    const el = await render(of(list));
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Каталог');
    const tiles = Array.from(el.querySelectorAll('[data-test="category"]'));
    expect(tiles.map((t) => t.textContent?.trim())).toEqual(['Одежда', 'Гаджеты']);
    expect(tiles.map((t) => t.getAttribute('href'))).toEqual(['/c/odezhda', '/c/gadgets']);
    const all = el.querySelector('[data-test="all"]')!;
    expect(all.textContent?.trim()).toBe('Все товары');
    expect(all.getAttribute('href')).toBe('/#fresh');
    expect(all.closest('li')).toBe(el.querySelector('.tiles li'));
  });

  it('внизу — вход «Продавцам» на /sell (на телефоне главная без первого экрана)', async () => {
    const el = await render(of([]));
    const sell = el.querySelector('[data-test="sell"]')!;
    expect(sell.getAttribute('href')).toBe('/sell');
    expect(sell.textContent).toContain('Продавцам');
  });

  it('пока грузится — заглушки, без ссылок', async () => {
    const el = await render(NEVER);
    expect(el.querySelectorAll('.tile-skel').length).toBeGreaterThan(0);
    expect(el.querySelector('[data-test="category"]')).toBeNull();
  });

  it('ошибка — сообщение и ссылка «Все товары»', async () => {
    const el = await render(throwError(() => new Error('x')));
    expect(el.textContent).toContain('Не удалось загрузить категории');
    expect(el.querySelector('a[href="/#fresh"]')?.textContent?.trim()).toBe('Все товары');
  });
});
