import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TOAST_ACTION_MS, TOAST_ERROR_MS, TOAST_LEAVE_MS, TOAST_MS, ToastService } from './toast.service';

describe('ToastService', () => {
  function make(platform = 'browser') {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: platform }] });
    return TestBed.inject(ToastService);
  }
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.useRealTimers(); TestBed.resetTestingModule(); });

  it('показывает плашку и убирает её через 4 с (после анимации ухода)', () => {
    const t = make();
    t.show({ text: 'Готово' });
    expect(t.current()).toMatchObject({ text: 'Готово', kind: 'info', leaving: false });
    jest.advanceTimersByTime(TOAST_MS - 1);
    expect(t.current()?.leaving).toBe(false);
    jest.advanceTimersByTime(1);
    expect(t.current()?.leaving).toBe(true);
    jest.advanceTimersByTime(TOAST_LEAVE_MS);
    expect(t.current()).toBeNull();
  });

  it('с кнопкой висит 6 с, ошибка — 5 с, duration — сколько сказали', () => {
    const t = make();
    t.show({ text: 'a', action: { label: 'Вернуть', run: () => undefined } });
    jest.advanceTimersByTime(TOAST_ACTION_MS - 1);
    expect(t.current()?.leaving).toBe(false);
    t.error('b');
    jest.advanceTimersByTime(TOAST_ERROR_MS - 1);
    expect(t.current()).toMatchObject({ text: 'b', kind: 'error', leaving: false });
    t.show({ text: 'c', duration: 100 });
    jest.advanceTimersByTime(100);
    expect(t.current()?.leaving).toBe(true);
  });

  it('новая плашка заменяет прежнюю, и таймер прежней её не убирает', () => {
    const t = make();
    t.show({ text: 'первая' });
    jest.advanceTimersByTime(TOAST_MS - 100);
    t.show({ text: 'вторая' });
    jest.advanceTimersByTime(200);
    expect(t.current()).toMatchObject({ text: 'вторая', leaving: false });
  });

  it('dismiss(id) не трогает уже другую плашку', () => {
    const t = make();
    const old = t.show({ text: 'первая' });
    t.show({ text: 'вторая' });
    t.dismiss(old);
    expect(t.current()?.leaving).toBe(false);
  });

  it('act() выполняет действие один раз и убирает плашку', () => {
    const t = make();
    const run = jest.fn();
    t.show({ text: 'Товар убран', action: { label: 'Вернуть', run } });
    t.act();
    t.act();
    expect(run).toHaveBeenCalledTimes(1);
    expect(t.current()?.leaving).toBe(true);
  });

  it('пауза под мышью: не исчезает, после — досчитывает не меньше 1,5 с', () => {
    const t = make();
    t.show({ text: 'Готово' });
    jest.advanceTimersByTime(TOAST_MS - 500);
    t.pause();
    jest.advanceTimersByTime(60_000);
    expect(t.current()?.leaving).toBe(false);
    t.resume();
    jest.advanceTimersByTime(1499);
    expect(t.current()?.leaving).toBe(false);
    jest.advanceTimersByTime(1);
    expect(t.current()?.leaving).toBe(true);
  });

  it('на сервере ничего не показывает и таймеров не ставит', () => {
    const t = make('server');
    expect(t.show({ text: 'Готово' })).toBe(0);
    expect(t.current()).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });
});
