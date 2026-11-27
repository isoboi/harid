import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, Observable, of, Subject } from 'rxjs';
import { ChatsComponent } from './chats.component';
import { ChatApi } from '../../core/chat-api.service';
import { ChatSocket } from '../../core/chat-socket.service';
import { AuthService } from '../../core/auth.service';
import { LANG_COOKIE, LANG_DICT } from '../../core/i18n';
import { TG } from '../../i18n/tg';

const summary = (over = {}) => ({ id: 3, shop: { handle: 'zebo.style', name: 'Zebo', avatar_color: '#f00' }, last_message: { text: 'Есть M?', sender: 'buyer', created_at: '2026-11-22T10:00:00Z', product_title: 'Платье' }, unread: 2, ...over });

describe('ChatsComponent', () => {
  const setup = async (list: any[] | Observable<any[]>, extra: any[] = []) => {
    const messages$ = new Subject<any>();
    const api = { list: jest.fn(() => (Array.isArray(list) ? of(list) : list)) };
    await TestBed.configureTestingModule({ imports: [ChatsComponent], providers: [provideRouter([]), { provide: ChatApi, useValue: api }, { provide: ChatSocket, useValue: { messages$, unreadTotal: () => 0 } }, ...extra] }).compileComponents();
    const auth = TestBed.inject(AuthService); auth.hydrate(); auth.setSession({ token: 't', buyer: { id: 1, phone: '+992', name: null }, is_new: false });
    const f = TestBed.createComponent(ChatsComponent); f.detectChanges();
    return { f, api, messages$, el: f.nativeElement as HTMLElement };
  };
  beforeEach(() => localStorage.clear());

  it('лавки со счётчиком и последним сообщением; ссылка на переписку', async () => {
    const { el } = await setup([summary()]);
    const row = el.querySelector('[data-test="chat-row"]') as HTMLAnchorElement;
    expect(row.textContent).toContain('Zebo');
    expect(row.textContent).toContain('Есть M?');
    expect(el.querySelector('[data-test="unread"]')?.textContent?.trim()).toBe('2');
    expect(row.getAttribute('href')).toBe('/chats/3');
  });

  it('до ответа — заглушка строк, без подсказки «пусто»', async () => {
    const { el } = await setup(NEVER);
    expect(el.querySelector('[data-test="skel-chats"]')).not.toBeNull();
    expect(el.textContent).not.toContain('Пока нет сообщений');
  });

  it('пусто — подсказка', async () => {
    const { el } = await setup([]);
    expect(el.textContent).toContain('Пока нет сообщений');
    expect(el.querySelector('[data-test="skel-chats"]')).toBeNull();
  });

  it('новое сообщение по сокету — список перечитывается', async () => {
    const { f, api, messages$ } = await setup([summary()]);
    messages$.next({ chat_id: 3, message: { id: 9 } }); f.detectChanges();
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  describe('по-таджикски (lang=tg)', () => {
    beforeEach(() => { document.cookie = `${LANG_COOKIE}=tg; path=/`; });
    afterEach(() => { document.cookie = `${LANG_COOKIE}=; path=/; max-age=0`; });
    const tg = [{ provide: LANG_DICT, useValue: TG }];

    it('пусто — подсказка на таджикском', async () => {
      const { el } = await setup([], tg);
      expect(el.querySelector('h1')?.textContent?.trim()).toBe('Паёмҳо');
      expect(el.textContent).toContain('Ҳоло паём нест');
    });
    it('своё последнее сообщение — «Шумо:», счётчик подписан, дата с таджикским месяцем', async () => {
      const { el } = await setup([summary()], tg);
      expect(el.querySelector('.you')?.textContent?.trim()).toBe('Шумо:');
      expect(el.querySelector('[data-test="unread"]')?.getAttribute('aria-label')).toBe('Нохонда: 2');
      expect(el.querySelector('time')?.textContent?.trim()).toBe('22 ноябр');
    });
  });
});
