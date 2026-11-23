import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { ChatNewComponent } from './chat-new.component';
import { ChatApi } from '../../core/chat-api.service';
import { MarketApi } from '../../core/market-api.service';
import { AuthService } from '../../core/auth.service';

describe('ChatNewComponent', () => {
  const setup = async (loggedIn = true) => {
    const api = { start: jest.fn(() => of({ chat_id: 3, message: {} })) };
    const market = { product: jest.fn(() => of({ id: '42', title: 'Платье', price: 250, image: 'a.jpg', shop_handle: 'zebo.style' })), shop: jest.fn(() => of({ handle: 'zebo.style', name: 'Zebo', avatar_color: '#f00' })) };
    await TestBed.configureTestingModule({ imports: [ChatNewComponent], providers: [provideRouter([]), { provide: ChatApi, useValue: api }, { provide: MarketApi, useValue: market }] }).compileComponents();
    const auth = TestBed.inject(AuthService); auth.hydrate();
    if (loggedIn) auth.setSession({ token: 't', buyer: { id: 1, phone: '+992', name: null }, is_new: false });
    const nav = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const f = TestBed.createComponent(ChatNewComponent);
    f.componentRef.setInput('shop', 'zebo.style');
    f.componentRef.setInput('product', '42');
    f.detectChanges();
    return { f, api, nav, c: f.componentInstance, el: f.nativeElement as HTMLElement };
  };
  beforeEach(() => localStorage.clear());

  it('без входа — на вход с возвратом сюда', async () => {
    const { nav } = await setup(false);
    expect(nav).toHaveBeenCalledWith('/login?return=' + encodeURIComponent('/chats/new?shop=zebo.style&product=42'));
  });

  it('карточка товара и отправка первого сообщения → переписка', async () => {
    const { f, api, nav, c, el } = await setup();
    expect(el.textContent).toContain('Платье');
    c.draft.set('Есть M?'); f.detectChanges();
    el.querySelector('form')!.dispatchEvent(new Event('submit')); f.detectChanges();
    expect(api.start).toHaveBeenCalledWith({ shop_handle: 'zebo.style', text: 'Есть M?', product_id: 42 });
    expect(nav).toHaveBeenCalledWith('/chats/3');
  });
});
