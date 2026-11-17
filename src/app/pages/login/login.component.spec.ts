import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { MarketApi } from '../../core/market-api.service';
import { AuthService } from '../../core/auth.service';

describe('LoginComponent', () => {
  beforeEach(() => localStorage.clear());

  it('телефон → код → сессия и переход на return', async () => {
    const api = {
      sendCode: jest.fn(() => of({})),
      verify: jest.fn(() => of({ token: 't', buyer: { id: 1, phone: '+992931110002', name: null }, is_new: true })),
    };
    await TestBed.configureTestingModule({ imports: [LoginComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    TestBed.inject(AuthService).hydrate();
    const f = TestBed.createComponent(LoginComponent);
    f.componentRef.setInput('return', '/me/orders');
    f.detectChanges();
    const c = f.componentInstance;
    const nav = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    c.phone.set('+992 93 111 00 02');
    c.sendCode();
    expect(api.sendCode).toHaveBeenCalledWith('931110002');
    expect(c.step()).toBe('code');
    c.code.set('000000');
    c.verify();
    expect(api.verify).toHaveBeenCalledWith('931110002', '000000');
    expect(TestBed.inject(AuthService).loggedIn()).toBe(true);
    expect(nav).toHaveBeenCalledWith('/me/orders');
  });

  it('чужой или внешний return не используется — переход на /me/orders', async () => {
    const api = { sendCode: jest.fn(), verify: jest.fn(() => of({ token: 't', buyer: { id: 1, phone: '+992931110002', name: null }, is_new: false })) };
    await TestBed.configureTestingModule({ imports: [LoginComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    TestBed.inject(AuthService).hydrate();
    const f = TestBed.createComponent(LoginComponent);
    f.componentRef.setInput('return', 'https://evil.example');
    f.detectChanges();
    const nav = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    f.componentInstance.phone.set('931110002');
    f.componentInstance.step.set('code');
    f.componentInstance.code.set('000000');
    f.componentInstance.verify();
    expect(nav).toHaveBeenCalledWith('/me/orders');
  });

  it.each([
    ['//evil.com', '/me/orders'],
    ['/\\evil', '/me/orders'],
    ['/cart', '/cart'],
  ])('return «%s» → переход на %s', async (ret, expected) => {
    const api = { sendCode: jest.fn(), verify: jest.fn(() => of({ token: 't', buyer: { id: 1, phone: '+992931110002', name: null }, is_new: false })) };
    await TestBed.configureTestingModule({ imports: [LoginComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    TestBed.inject(AuthService).hydrate();
    const f = TestBed.createComponent(LoginComponent);
    f.componentRef.setInput('return', ret);
    f.detectChanges();
    const nav = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    f.componentInstance.phone.set('931110002');
    f.componentInstance.step.set('code');
    f.componentInstance.code.set('000000');
    f.componentInstance.verify();
    expect(nav).toHaveBeenCalledWith(expected);
  });

  it('ошибка кода показывается, сессии нет', async () => {
    const api = { sendCode: jest.fn(), verify: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 400, error: { error: { message: 'Код неверный' } } }))) };
    await TestBed.configureTestingModule({ imports: [LoginComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
    TestBed.inject(AuthService).hydrate();
    const f = TestBed.createComponent(LoginComponent);
    f.detectChanges();
    const c = f.componentInstance;
    c.phone.set('931110002');
    c.step.set('code');
    c.code.set('111111');
    c.verify();
    expect(c.error()).toBe('Код неверный');
    expect(TestBed.inject(AuthService).loggedIn()).toBe(false);
  });
});
