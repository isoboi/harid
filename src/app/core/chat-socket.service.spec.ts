import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ChatSocket } from './chat-socket.service';
import { ChatApi } from './chat-api.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

const handlers: Record<string, (p?: any) => void> = {};
const fake = { on: jest.fn((e: string, h: any) => { handlers[e] = h; }), disconnect: jest.fn() };
jest.mock('socket.io-client', () => ({ io: jest.fn(() => fake) }));
import { io } from 'socket.io-client';

/** socket.io-client подгружается через import(): ждём, пока промис разрешится. */
const loaded = () => new Promise((r) => setTimeout(r));

describe('ChatSocket', () => {
  const setup = (platform = 'browser') => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: platform }, { provide: ChatApi, useValue: { unread: () => of({ unread_total: 2 }) } }] });
    const auth = TestBed.inject(AuthService); auth.hydrate();
    const s = TestBed.inject(ChatSocket); s.start();
    return { auth, s };
  };
  beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });

  it('после входа — подключение с токеном и счётчик с сервера', async () => {
    const { auth, s } = setup();
    auth.setSession({ token: 't1', buyer: { id: 1, phone: '+992', name: null }, is_new: false });
    TestBed.flushEffects();
    await loaded();
    expect(io).toHaveBeenCalledWith(`${environment.socketUrl}/market-chat`, expect.objectContaining({ transports: ['websocket'], auth: { token: 't1' } }));
    expect(s.unreadTotal()).toBe(2);
  });

  it('события сокета: unread меняет счётчик, message уходит в поток', async () => {
    const { auth, s } = setup();
    auth.setSession({ token: 't1', buyer: { id: 1, phone: '+992', name: null }, is_new: false });
    TestBed.flushEffects();
    await loaded();
    const got: any[] = []; s.messages$.subscribe((m) => got.push(m));
    handlers['chat:unread']({ unread_total: 7 });
    handlers['chat:message']({ chat_id: 3, message: { id: 1 } });
    expect(s.unreadTotal()).toBe(7);
    expect(got).toEqual([{ chat_id: 3, message: { id: 1 } }]);
  });

  it('выход — отключение и счётчик 0', async () => {
    const { auth, s } = setup();
    auth.setSession({ token: 't1', buyer: { id: 1, phone: '+992', name: null }, is_new: false });
    TestBed.flushEffects();
    await loaded();
    auth.logout(); TestBed.flushEffects();
    expect(fake.disconnect).toHaveBeenCalled();
    expect(s.unreadTotal()).toBe(0);
  });

  it('выход раньше, чем загрузилась библиотека сокета, — сокет не создаётся', async () => {
    const { auth, s } = setup();
    auth.setSession({ token: 't1', buyer: { id: 1, phone: '+992', name: null }, is_new: false });
    TestBed.flushEffects();
    auth.logout(); TestBed.flushEffects();
    await loaded();
    expect(io).not.toHaveBeenCalled();
    expect(s.unreadTotal()).toBe(0);
  });

  it('на сервере (SSR) сокет не создаётся', async () => {
    const { auth } = setup('server');
    auth.setSession({ token: 't1', buyer: { id: 1, phone: '+992', name: null }, is_new: false });
    TestBed.flushEffects();
    await loaded();
    expect(io).not.toHaveBeenCalled();
  });
});
