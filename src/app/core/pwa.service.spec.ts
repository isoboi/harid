import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PwaService } from './pwa.service';

/** Событие beforeinstallprompt, как его шлёт Chrome. */
function installEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const e = new Event('beforeinstallprompt') as Event & { prompt: jest.Mock; userChoice: Promise<{ outcome: string }> };
  e.prompt = jest.fn(() => Promise.resolve());
  e.userChoice = Promise.resolve({ outcome });
  return e;
}

describe('PwaService', () => {
  function make(platform = 'browser') {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: platform }] });
    return TestBed.inject(PwaService);
  }
  afterEach(() => TestBed.resetTestingModule());

  it('до hydrate() — «сеть есть» и установки нет, как на сервере; потом — настоящее состояние', () => {
    const online = jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const s = make();
    window.dispatchEvent(installEvent());
    expect(s.online()).toBe(true);
    expect(s.canInstall()).toBe(false);
    s.hydrate();
    expect(s.online()).toBe(false);
    // Предложение пришло раньше первого рендера — не потерялось
    expect(s.canInstall()).toBe(true);
    online.mockRestore();
  });

  it('события online/offline переключают состояние сети', () => {
    const s = make();
    s.hydrate();
    window.dispatchEvent(new Event('offline'));
    expect(s.online()).toBe(false);
    window.dispatchEvent(new Event('online'));
    expect(s.online()).toBe(true);
  });

  it('install(): системный диалог один раз, после ответа кнопка пропадает', async () => {
    const s = make();
    s.hydrate();
    const e = installEvent('accepted');
    window.dispatchEvent(e);
    expect(s.canInstall()).toBe(true);
    await expect(s.install()).resolves.toBe(true);
    expect(e.prompt).toHaveBeenCalledTimes(1);
    expect(s.canInstall()).toBe(false);
    await expect(s.install()).resolves.toBe(false);
    expect(e.prompt).toHaveBeenCalledTimes(1);
  });

  it('отказ в диалоге — false; установка другим путём (appinstalled) прячет кнопку', async () => {
    const s = make();
    s.hydrate();
    window.dispatchEvent(installEvent('dismissed'));
    await expect(s.install()).resolves.toBe(false);
    window.dispatchEvent(installEvent());
    expect(s.canInstall()).toBe(true);
    window.dispatchEvent(new Event('appinstalled'));
    expect(s.canInstall()).toBe(false);
  });

  it('на сервере ничего не слушает', () => {
    const s = make('server');
    s.hydrate();
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(installEvent());
    expect(s.online()).toBe(true);
    expect(s.canInstall()).toBe(false);
  });
});
