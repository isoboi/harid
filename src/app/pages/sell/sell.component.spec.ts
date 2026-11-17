import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { SellComponent } from './sell.component';
import { MarketApi } from '../../core/market-api.service';

async function setup(api: Partial<Record<'sellerSendCode' | 'sellerApply', jest.Mock>>) {
  await TestBed.configureTestingModule({ imports: [SellComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: api }] }).compileComponents();
  const f = TestBed.createComponent(SellComponent); f.detectChanges();
  return { f, c: f.componentInstance };
}

describe('SellComponent', () => {
  it('ник+имя+телефон → код → лавка открыта со ссылкой на кабинет', async () => {
    const api = { sellerSendCode: jest.fn(() => of({})), sellerApply: jest.fn(() => of({ id: 2, handle: 'technomir.tj', status: 'active' })) };
    const { f, c } = await setup(api);
    c.form.setValue({ handle: '@TechnoMir.tj', owner_name: 'Рустам', phone: '93 111 00 01' });
    c.sendCode();
    expect(api.sellerSendCode).toHaveBeenCalledWith('931110001');
    expect(c.step()).toBe('code');
    c.code.set('000000'); c.apply(); f.detectChanges();
    expect(api.sellerApply).toHaveBeenCalledWith({ handle: '@TechnoMir.tj', owner_name: 'Рустам', phone: '931110001', code: '000000' });
    expect(f.nativeElement.textContent).toContain('Лавка открыта');
    expect(f.nativeElement.querySelector('a[data-test="cabinet"]')?.getAttribute('href')).toBe('https://admin.disti.site');
  });
  it('ник занят — текст бэкенда', async () => {
    const err = new HttpErrorResponse({ status: 409, error: { error: { message: 'Этот ник уже занят другой лавкой', errors: [] } } });
    const { f, c } = await setup({ sellerSendCode: jest.fn(() => of({})), sellerApply: jest.fn(() => throwError(() => err)) });
    c.form.setValue({ handle: 'x', owner_name: 'Рустам', phone: '931110001' });
    c.sendCode(); c.code.set('000000'); c.apply(); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Этот ник уже занят другой лавкой');
  });
  it('ник с пробелами проходит проверку и уходит обрезанным', async () => {
    const api = { sellerSendCode: jest.fn(() => of({})), sellerApply: jest.fn(() => of({ id: 2, handle: 'zebo.style', status: 'active' })) };
    const { f, c } = await setup(api);
    c.form.setValue({ handle: ' @zebo.style ', owner_name: 'Рустам', phone: '93 111 00 01' });
    f.detectChanges();
    const btn = f.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    c.sendCode();
    expect(c.step()).toBe('code');
    c.code.set('000000'); c.apply();
    expect(api.sellerApply).toHaveBeenCalledWith({ handle: '@zebo.style', owner_name: 'Рустам', phone: '931110001', code: '000000' });
  });
  it('«Изменить данные» сбрасывает код и ошибку', async () => {
    const err = new HttpErrorResponse({ status: 400, error: { error: { message: 'Код неверный', errors: [] } } });
    const { f, c } = await setup({ sellerSendCode: jest.fn(() => of({})), sellerApply: jest.fn(() => throwError(() => err)) });
    c.form.setValue({ handle: 'zebo', owner_name: 'Рустам', phone: '931110001' });
    c.sendCode(); c.code.set('111111'); c.apply(); f.detectChanges();
    expect(c.error()).toBe('Код неверный');
    c.back(); f.detectChanges();
    expect(c.step()).toBe('form');
    expect(c.code()).toBe('');
    expect(c.error()).toBe('');
  });

  describe('повторная отправка кода', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('назад и тот же номер в течение 60 с — send-code не вызывается повторно', async () => {
      const api = { sellerSendCode: jest.fn(() => of({})), sellerApply: jest.fn() };
      const { c } = await setup(api);
      c.form.setValue({ handle: 'zebo', owner_name: 'Рустам', phone: '93 111 00 01' });
      c.sendCode();
      c.back();
      jest.advanceTimersByTime(20_000);
      c.sendCode();
      expect(api.sellerSendCode).toHaveBeenCalledTimes(1);
      expect(c.step()).toBe('code');
    });
    it('отсчёт доходит до нуля, кнопка «ещё раз» зовёт API', async () => {
      const api = { sellerSendCode: jest.fn(() => of({})), sellerApply: jest.fn() };
      const { f, c } = await setup(api);
      c.form.setValue({ handle: 'zebo', owner_name: 'Рустам', phone: '931110001' });
      c.sendCode(); f.detectChanges();
      const el: HTMLElement = f.nativeElement;
      expect(el.querySelector('[data-test="countdown"]')?.textContent).toContain('через 60 с');
      jest.advanceTimersByTime(60_000); f.detectChanges();
      (el.querySelector('[data-test="resend"]') as HTMLButtonElement).click();
      expect(api.sellerSendCode).toHaveBeenCalledTimes(2);
      expect(c.resend.left()).toBe(60);
    });
  });
  it('поля ограничены лимитами бэкенда', async () => {
    const { f } = await setup({});
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('input[formControlName="handle"]')?.getAttribute('maxlength')).toBe('31');
    expect(el.querySelector('input[formControlName="owner_name"]')?.getAttribute('maxlength')).toBe('150');
  });
});
