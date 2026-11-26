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

  it('чужой или внешний return не используется — переход в профиль /me', async () => {
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
    expect(nav).toHaveBeenCalledWith('/me');
  });

  it.each([
    ['//evil.com', '/me'],
    ['/\\evil', '/me'],
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

  describe('Enter в поле отправляет форму', () => {
    const setup = async () => {
      const api = {
        sendCode: jest.fn(() => of({})),
        verify: jest.fn(() => of({ token: 't', buyer: { id: 1, phone: '+992931110002', name: null }, is_new: false })),
      };
      await TestBed.configureTestingModule({ imports: [LoginComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
      TestBed.inject(AuthService).hydrate();
      const f = TestBed.createComponent(LoginComponent);
      f.detectChanges();
      jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      const submit = () => {
        const form = (f.nativeElement as HTMLElement).querySelector('form');
        expect(form).not.toBeNull();
        form!.dispatchEvent(new Event('submit', { cancelable: true }));
        f.detectChanges();
      };
      return { api, f, c: f.componentInstance, submit };
    };

    it('шаг телефона: отправка формы запрашивает код', async () => {
      const { api, c, f, submit } = await setup();
      c.phone.set('931110002');
      f.detectChanges();
      submit();
      expect(api.sendCode).toHaveBeenCalledWith('931110002');
      expect(c.step()).toBe('code');
    });

    it('шаг телефона: неполный номер — код не запрашивается', async () => {
      const { api, c, f, submit } = await setup();
      c.phone.set('93111');
      f.detectChanges();
      submit();
      expect(api.sendCode).not.toHaveBeenCalled();
      expect(c.step()).toBe('phone');
    });

    it('шаг кода: отправка формы входит, неполный код — нет', async () => {
      const { api, c, f, submit } = await setup();
      c.phone.set('931110002');
      c.step.set('code');
      c.code.set('0000');
      f.detectChanges();
      submit();
      expect(api.verify).not.toHaveBeenCalled();
      c.code.set('000000');
      f.detectChanges();
      submit();
      expect(api.verify).toHaveBeenCalledWith('931110002', '000000');
    });
  });

  describe('повторная отправка кода', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());
    const setup = async () => {
      const api = { sendCode: jest.fn(() => of({})), verify: jest.fn() };
      await TestBed.configureTestingModule({ imports: [LoginComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
      TestBed.inject(AuthService).hydrate();
      const f = TestBed.createComponent(LoginComponent);
      f.detectChanges();
      return { api, f, c: f.componentInstance };
    };

    it('назад и тот же номер в течение 60 с — send-code не вызывается повторно', async () => {
      const { api, c } = await setup();
      c.phone.set('93 111 00 02');
      c.sendCode();
      c.step.set('phone');
      jest.advanceTimersByTime(30_000);
      c.sendCode();
      expect(api.sendCode).toHaveBeenCalledTimes(1);
      expect(c.step()).toBe('code');
    });
    it('другой номер или прошло 60 с — код отправляется снова', async () => {
      const { api, c } = await setup();
      c.phone.set('931110002');
      c.sendCode();
      c.step.set('phone');
      c.phone.set('931110003');
      c.sendCode();
      expect(api.sendCode).toHaveBeenCalledTimes(2);
      c.step.set('phone');
      jest.advanceTimersByTime(60_000);
      c.sendCode();
      expect(api.sendCode).toHaveBeenCalledTimes(3);
    });
    it('отсчёт доходит до нуля, кнопка «ещё раз» зовёт API и перезапускает отсчёт', async () => {
      const { api, f, c } = await setup();
      c.phone.set('931110002');
      c.sendCode();
      f.detectChanges();
      const el: HTMLElement = f.nativeElement;
      expect(el.querySelector('[data-test="countdown"]')?.textContent).toContain('через 60 с');
      expect(el.querySelector('[data-test="resend"]')).toBeNull();
      jest.advanceTimersByTime(60_000);
      f.detectChanges();
      expect(c.resend.left()).toBe(0);
      const btn = el.querySelector('[data-test="resend"]') as HTMLButtonElement;
      expect(btn.textContent).toContain('Отправить код ещё раз');
      btn.click();
      expect(api.sendCode).toHaveBeenCalledTimes(2);
      f.detectChanges();
      expect(c.resend.left()).toBe(60);
      expect(el.querySelector('[data-test="resend"]')).toBeNull();
    });
  });
});
