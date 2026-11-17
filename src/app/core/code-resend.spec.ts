import { TestBed } from '@angular/core/testing';
import { CodeResend } from './code-resend';

describe('CodeResend', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  const make = () => TestBed.runInInjectionContext(() => new CodeResend());

  it('тот же номер в течение 60 с — код повторно не отправляется', () => {
    const r = make();
    r.markSent('931110002');
    jest.advanceTimersByTime(59_000);
    expect(r.isRecent('931110002')).toBe(true);
    expect(r.isRecent('931110003')).toBe(false);
    jest.advanceTimersByTime(1_000);
    expect(r.isRecent('931110002')).toBe(false);
  });
  it('обратный отсчёт идёт до нуля', () => {
    const r = make();
    r.markSent('931110002');
    expect(r.left()).toBe(60);
    jest.advanceTimersByTime(10_000);
    expect(r.left()).toBe(50);
    jest.advanceTimersByTime(50_000);
    expect(r.left()).toBe(0);
  });
  it('повторная отправка перезапускает отсчёт', () => {
    const r = make();
    r.markSent('931110002');
    jest.advanceTimersByTime(60_000);
    r.markSent('931110002');
    expect(r.left()).toBe(60);
  });
  it('таймер снимается при уничтожении', () => {
    const r = make();
    r.markSent('931110002');
    TestBed.resetTestingModule();
    expect(jest.getTimerCount()).toBe(0);
  });
});
