import { TestBed } from '@angular/core/testing';
import { ShopAvatarComponent } from './shop-avatar.component';

describe('ShopAvatarComponent', () => {
  async function render(inputs: Record<string, unknown>) {
    await TestBed.configureTestingModule({ imports: [ShopAvatarComponent] }).compileComponents();
    const f = TestBed.createComponent(ShopAvatarComponent);
    f.componentRef.setInput('name', 'Nodira');
    for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement };
  }

  it('с avatarUrl рисует img с src, alt и referrerpolicy', async () => {
    const { el } = await render({ avatarUrl: 'https://cdn.example/a.jpg', handle: 'nodira' });
    const img = el.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://cdn.example/a.jpg');
    expect(img?.getAttribute('alt')).toBe('Аватар @nodira');
    expect(img?.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(el.querySelector('.face')?.textContent?.trim()).toBe('');
  });

  it('alt берёт ник из name без @, если handle не задан', async () => {
    const { el } = await render({ avatarUrl: 'https://cdn.example/a.jpg', name: '@nodira' });
    expect(el.querySelector('img')?.getAttribute('alt')).toBe('Аватар @nodira');
  });

  it('после ошибки загрузки возвращается буква', async () => {
    const { f, el } = await render({ avatarUrl: 'https://cdn.example/a.jpg', handle: 'nodira' });
    el.querySelector('img')!.dispatchEvent(new Event('error'));
    f.detectChanges();
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.face')?.textContent?.trim()).toBe('N');
  });

  it('без avatarUrl показывает букву', async () => {
    const { el } = await render({});
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.face')?.textContent?.trim()).toBe('N');
  });

  it('null вместо url тоже даёт букву', async () => {
    const { el } = await render({ avatarUrl: null });
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.face')?.textContent?.trim()).toBe('N');
  });

  it('новый url после ошибки снова пробует фото', async () => {
    const { f, el } = await render({ avatarUrl: 'https://cdn.example/a.jpg', handle: 'nodira' });
    el.querySelector('img')!.dispatchEvent(new Event('error'));
    f.detectChanges();
    f.componentRef.setInput('avatarUrl', 'https://cdn.example/b.jpg');
    f.detectChanges();
    expect(el.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/b.jpg');
  });
});
