import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, Observable, of, Subject, throwError } from 'rxjs';
import { ChatThreadComponent } from './chat-thread.component';
import { ChatApi } from '../../core/chat-api.service';
import { ChatSocket } from '../../core/chat-socket.service';
import { AuthService } from '../../core/auth.service';

const m = (id: number, over = {}) => ({ id, chat_id: 3, sender: 'shop', text: `m${id}`, product: null, created_at: '2026-11-22T10:00:00Z', ...over });

describe('ChatThreadComponent', () => {
  const setup = async (history: any[] | Observable<any[]> = [m(1), m(2)]) => {
    const messages$ = new Subject<any>(); const reconnected$ = new Subject<void>();
    const api = {
      messages: jest.fn(() => (Array.isArray(history) ? of(history) : history)),
      send: jest.fn(() => of(m(3, { sender: 'buyer', text: 'Спасибо' }))),
      read: jest.fn(() => of({ unread_total: 0 })),
      list: jest.fn(() => of([])),
    };
    const socket = { messages$, reads$: new Subject(), reconnected$, setUnread: jest.fn() };
    await TestBed.configureTestingModule({ imports: [ChatThreadComponent], providers: [provideRouter([]), { provide: ChatApi, useValue: api }, { provide: ChatSocket, useValue: socket }] }).compileComponents();
    const auth = TestBed.inject(AuthService); auth.hydrate(); auth.setSession({ token: 't', buyer: { id: 1, phone: '+992', name: null }, is_new: false });
    const f = TestBed.createComponent(ChatThreadComponent);
    f.componentRef.setInput('id', '3');
    f.detectChanges();
    return { f, api, socket, messages$, reconnected$, c: f.componentInstance, el: f.nativeElement as HTMLElement };
  };
  beforeEach(() => localStorage.clear());

  it('до ответа — заглушка переписки', async () => {
    const { el } = await setup(NEVER);
    expect(el.querySelector('[data-test="skel-thread"]')).not.toBeNull();
    expect(el.querySelector('[data-test="bubble"]')).toBeNull();
  });

  it('история и «прочитано» при открытии', async () => {
    const { api, socket, el } = await setup();
    expect(api.messages).toHaveBeenCalledWith(3);
    expect(el.querySelectorAll('[data-test="bubble"]').length).toBe(2);
    expect(el.querySelector('[data-test="skel-thread"]')).toBeNull();
    expect(api.read).toHaveBeenCalledWith(3);
    expect(socket.setUnread).toHaveBeenCalledWith(0);
  });

  it('Enter отправляет; пустой текст — нет', async () => {
    const { f, api, c, el } = await setup();
    c.draft.set('   '); f.detectChanges();
    el.querySelector('form')!.dispatchEvent(new Event('submit')); f.detectChanges();
    expect(api.send).not.toHaveBeenCalled();
    c.draft.set('Спасибо'); f.detectChanges();
    el.querySelector('form')!.dispatchEvent(new Event('submit')); f.detectChanges();
    expect(api.send).toHaveBeenCalledWith(3, { text: 'Спасибо' });
    expect(c.draft()).toBe('');
    expect(el.querySelectorAll('[data-test="bubble"]').length).toBe(3);
  });

  it('ошибка отправки — «Повторить», текст не теряется', async () => {
    const { f, api, c, el } = await setup();
    api.send.mockReturnValueOnce(throwError(() => new Error('x')));
    c.draft.set('Спасибо'); f.detectChanges();
    el.querySelector('form')!.dispatchEvent(new Event('submit')); f.detectChanges();
    expect(el.querySelector('[data-test="retry"]')).not.toBeNull();
    (el.querySelector('[data-test="retry"]') as HTMLButtonElement).click(); f.detectChanges();
    expect(api.send).toHaveBeenCalledTimes(2);
  });

  it('сообщение по сокету этого чата добавляется без дубля; чужой чат — игнор', async () => {
    const { f, messages$, el, api } = await setup();
    messages$.next({ chat_id: 3, message: m(5) });
    messages$.next({ chat_id: 3, message: m(5) });
    messages$.next({ chat_id: 4, message: m(6) });
    f.detectChanges();
    expect(el.querySelectorAll('[data-test="bubble"]').length).toBe(3);
    expect(api.read).toHaveBeenCalledTimes(2);
  });

  it('переподключение — догрузка после последнего id', async () => {
    const { api, reconnected$ } = await setup();
    reconnected$.next();
    expect(api.messages).toHaveBeenLastCalledWith(3, { after: 2 });
  });

  it('«Показать раньше» — before первого id', async () => {
    const { f, api, c, el } = await setup();
    // Кнопка видна, когда пришла полная страница (50); здесь включаем её напрямую.
    c.hasOlder.set(true); f.detectChanges();
    (el.querySelector('[data-test="older"]') as HTMLButtonElement).click(); f.detectChanges();
    expect(api.messages).toHaveBeenLastCalledWith(3, { before: 1 });
  });
});
