import { TestBed } from '@angular/core/testing';
import { SeoService } from '../core/seo.service';
import { ShareComponent, shareLinks } from './share.component';

describe('shareLinks', () => {
  it('Telegram — ссылка и текст отдельно, WhatsApp — одной строкой; всё закодировано', () => {
    const l = shareLinks('https://harid.tj/product/16', 'Платье & шарф — 320 сомони');
    const tg = new URL(l.telegram);
    expect(tg.origin + tg.pathname).toBe('https://t.me/share/url');
    expect(tg.searchParams.get('url')).toBe('https://harid.tj/product/16');
    // «&» в тексте закодирован — не рвёт параметры ссылки
    expect(tg.searchParams.get('text')).toBe('Платье & шарф — 320 сомони');
    expect(decodeURIComponent(l.whatsapp.split('?text=')[1])).toBe('Платье & шарф — 320 сомони https://harid.tj/product/16');
  });
});

describe('ShareComponent', () => {
  async function render() {
    await TestBed.configureTestingModule({ imports: [ShareComponent], providers: [{ provide: SeoService, useValue: { origin: () => 'https://harid.tj' } }] }).compileComponents();
    const f = TestBed.createComponent(ShareComponent);
    f.componentRef.setInput('path', '/product/16');
    f.componentRef.setInput('text', 'Наушники');
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const q = <T extends HTMLElement>(t: string) => el.querySelector<T>(`[data-test="${t}"]`);
    return { f, el, q };
  }
  afterEach(() => TestBed.resetTestingModule());

  it('меню открывается по кнопке; ссылки — полный адрес витрины', async () => {
    const { f, q } = await render();
    expect(q('share-menu')).toBeNull();
    q('share')!.click(); f.detectChanges();
    expect(q('share')!.getAttribute('aria-expanded')).toBe('true');
    expect(q<HTMLAnchorElement>('share-telegram')!.href).toContain(encodeURIComponent('https://harid.tj/product/16'));
    expect(q<HTMLAnchorElement>('share-whatsapp')!.href).toContain('https://wa.me/?text=');
  });

  it('Esc и нажатие мимо меню закрывают его, Esc возвращает фокус на кнопку', async () => {
    const { f, q } = await render();
    document.body.appendChild(f.nativeElement);
    q('share')!.click(); f.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); f.detectChanges();
    expect(q('share-menu')).toBeNull();
    expect(document.activeElement).toBe(q('share'));
    q('share')!.click(); f.detectChanges();
    document.body.click(); f.detectChanges();
    expect(q('share-menu')).toBeNull();
    f.nativeElement.remove();
  });

  it('«Копировать ссылку» кладёт адрес в буфер и показывает подтверждение', async () => {
    const writeText = jest.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { f, q } = await render();
    q('share')!.click(); f.detectChanges();
    q('share-copy')!.click();
    await Promise.resolve(); f.detectChanges();
    expect(writeText).toHaveBeenCalledWith('https://harid.tj/product/16');
    expect(q('share-copied')?.textContent).toContain('Ссылка скопирована');
    expect(q('share-menu')).toBeNull();
  });

  it('без системного меню «Поделиться» пункта «Другие приложения» нет', async () => {
    const { f, q } = await render();
    q('share')!.click(); f.detectChanges();
    expect(typeof navigator.share).toBe('undefined');
    expect(q('share-native')).toBeNull();
  });
});
