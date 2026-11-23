import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Analytics } from '../core/analytics.service';
import { ShareComponent } from './share.component';

@Component({
  standalone: true,
  imports: [ShareComponent],
  template: `<app-share path="/product/5" title="Кроссовки" text="Кроссовки — 540 смн на Хариде" kind="product" />`,
})
class HostComponent {}

describe('ShareComponent', () => {
  const track = jest.fn();
  const nav = window.navigator as unknown as Record<string, unknown>;

  beforeEach(async () => {
    track.mockReset();
    await TestBed.configureTestingModule({ imports: [HostComponent], providers: [{ provide: Analytics, useValue: { track } }] }).compileComponents();
  });

  afterEach(() => {
    delete nav['share'];
    delete nav['clipboard'];
  });

  function render() {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const q = (sel: string) => el.querySelector<HTMLElement>(`[data-test="${sel}"]`);
    return { f, el, q, tick: () => f.detectChanges() };
  }

  it('меню закрыто, пока не нажали «Поделиться»', () => {
    const { q } = render();
    expect(q('share')?.textContent).toContain('Поделиться');
    expect(q('share-menu')).toBeNull();
  });

  it('без системного окна открывает меню со ссылками на Telegram и WhatsApp с UTM-метками', async () => {
    const { q, tick } = render();
    await (q('share') as HTMLButtonElement).click();
    tick();
    expect(q('share-menu')).not.toBeNull();
    const tg = q('share-telegram')?.getAttribute('href') ?? '';
    const wa = q('share-whatsapp')?.getAttribute('href') ?? '';
    expect(tg.startsWith('https://t.me/share/url?')).toBe(true);
    expect(decodeURIComponent(tg)).toContain(`${window.location.origin}/product/5?utm_source=share&utm_medium=telegram`);
    expect(wa.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(wa)).toContain('utm_medium=whatsapp');
    expect(q('share')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('клик по Telegram отправляет событие share', () => {
    const { q, tick } = render();
    (q('share') as HTMLButtonElement).click();
    tick();
    const link = q('share-telegram') as HTMLAnchorElement;
    link.addEventListener('click', (e) => e.preventDefault());
    link.click();
    expect(track).toHaveBeenCalledWith('share', { method: 'telegram', kind: 'product' });
  });

  it('«Копировать ссылку» кладёт адрес с меткой в буфер и сообщает об этом', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    nav['clipboard'] = { writeText };
    const { q, tick, f } = render();
    (q('share') as HTMLButtonElement).click();
    tick();
    (q('share-copy') as HTMLButtonElement).click();
    await f.whenStable();
    tick();
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/product/5?utm_source=share&utm_medium=copy`);
    expect(q('share-copy')?.textContent).toContain('Ссылка скопирована');
    expect(track).toHaveBeenCalledWith('share', { method: 'copy', kind: 'product' });
  });

  it('буфер недоступен — просит скопировать адрес вручную', async () => {
    const { q, tick, f } = render();
    (q('share') as HTMLButtonElement).click();
    tick();
    (q('share-copy') as HTMLButtonElement).click();
    await f.whenStable();
    tick();
    expect(f.nativeElement.textContent).toContain('Не удалось скопировать');
    expect(track).not.toHaveBeenCalled();
  });

  it('если есть системное окно «Поделиться» — открывает его, а не меню', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    nav['share'] = share;
    const { q, tick, f } = render();
    (q('share') as HTMLButtonElement).click();
    await f.whenStable();
    tick();
    expect(share).toHaveBeenCalledWith({
      title: 'Кроссовки', text: 'Кроссовки — 540 смн на Хариде', url: `${window.location.origin}/product/5?utm_source=share&utm_medium=native`,
    });
    expect(q('share-menu')).toBeNull();
    expect(track).toHaveBeenCalledWith('share', { method: 'native', kind: 'product' });
  });

  it('закрыли системное окно — не ошибка и не событие', async () => {
    nav['share'] = jest.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'));
    const { q, f } = render();
    (q('share') as HTMLButtonElement).click();
    await f.whenStable();
    expect(track).not.toHaveBeenCalled();
  });

  it('клик мимо и Escape закрывают меню', () => {
    const { q, tick, f } = render();
    (q('share') as HTMLButtonElement).click();
    tick();
    document.body.click();
    tick();
    expect(q('share-menu')).toBeNull();
    (q('share') as HTMLButtonElement).click();
    tick();
    f.nativeElement.querySelector('app-share').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    tick();
    expect(q('share-menu')).toBeNull();
  });
});
