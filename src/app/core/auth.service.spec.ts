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
});
