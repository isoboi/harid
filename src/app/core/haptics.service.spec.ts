import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HAPTIC, Haptics } from './haptics.service';

/** Подменяет navigator.vibrate и matchMedia; возвращает шпиона на vibrate. */
function setup(opts: { vibrate?: boolean; reduced?: boolean; platform?: string } = {}) {
  const { vibrate = true, reduced = false, platform = 'browser' } = opts;
  const spy = jest.fn(() => true);
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate ? spy : undefined });
  window.matchMedia = jest.fn((q: string) => ({ matches: reduced && q.includes('reduce') })) as unknown as typeof window.matchMedia;
  TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: platform }] });
  return { spy, haptics: TestBed.inject(Haptics) };
}

describe('Haptics', () => {
  afterEach(() => { delete (navigator as { vibrate?: unknown }).vibrate; delete (window as { matchMedia?: unknown }).matchMedia; });

  it('light, success и warning вибрируют своим рисунком', () => {
    const { spy, haptics } = setup();
    haptics.light();
    haptics.success();
    haptics.warning();
    expect(spy.mock.calls).toEqual([[HAPTIC.light], [HAPTIC.success], [[20, 50, 20]]]);
  });

  it('нет navigator.vibrate (iOS) — тихо ничего не делает', () => {
    const { haptics } = setup({ vibrate: false });
    expect(() => { haptics.light(); haptics.success(); haptics.warning(); }).not.toThrow();
  });

  it('«уменьшить движение» — не вибрирует', () => {
    const { spy, haptics } = setup({ reduced: true });
    haptics.success();
    expect(spy).not.toHaveBeenCalled();
  });

  it('на сервере не вибрирует', () => {
    const { spy, haptics } = setup({ platform: 'server' });
    haptics.light();
    expect(spy).not.toHaveBeenCalled();
  });

  it('браузер запретил вибрацию (исключение) — не падает', () => {
    const { spy, haptics } = setup();
    spy.mockImplementation(() => { throw new Error('blocked'); });
    expect(() => haptics.success()).not.toThrow();
  });

  it('без matchMedia (старый браузер) вибрирует', () => {
    const { spy, haptics } = setup();
    delete (window as { matchMedia?: unknown }).matchMedia;
    haptics.light();
    expect(spy).toHaveBeenCalledWith(HAPTIC.light);
  });
});
