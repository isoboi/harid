import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

const session = { token: 'tok', buyer: { id: 1, phone: '+992931110002', name: null }, is_new: false };

describe('AuthService', () => {
  beforeEach(() => { localStorage.clear(); TestBed.configureTestingModule({}); });
  it('до hydrate() — выход, после hydrate() — сессия из хранилища', () => {
    TestBed.inject(AuthService).setSession(session);
    TestBed.resetTestingModule(); TestBed.configureTestingModule({});
    const fresh = TestBed.inject(AuthService);
    expect(fresh.loggedIn()).toBe(false);
    fresh.hydrate();
    expect(fresh.loggedIn()).toBe(true);
    expect(fresh.token()).toBe('tok');
  });
  it('logout очищает хранилище', () => {
    const a = TestBed.inject(AuthService);
    a.setSession(session);
    a.logout();
    expect(localStorage.getItem('harid.token')).toBeNull();
    expect(localStorage.getItem('harid.buyer')).toBeNull();
  });
  it('ready: false до hydrate(), true после', () => {
    const a = TestBed.inject(AuthService);
    expect(a.ready()).toBe(false);
    a.hydrate();
    expect(a.ready()).toBe(true);
  });
  it('покупатель не объект-массив: сохранённый [] даёт null', () => {
    localStorage.setItem('harid.token', JSON.stringify('tok'));
    localStorage.setItem('harid.buyer', JSON.stringify([]));
    const a = TestBed.inject(AuthService);
    a.hydrate();
    expect(a.buyer()).toBeNull();
  });
  it('покупатель без числового id отбрасывается', () => {
    localStorage.setItem('harid.buyer', JSON.stringify({ id: 'x', phone: '1', name: null }));
    const a = TestBed.inject(AuthService);
    a.hydrate();
    expect(a.buyer()).toBeNull();
  });
});
