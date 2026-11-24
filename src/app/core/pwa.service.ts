import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/** Событие Chrome/Edge/Samsung Internet «сайт можно установить»; в lib.dom его нет. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Приложение на домашнем экране и работа без сети.
 * - online: есть ли сеть (на сервере и до hydrate() — всегда true, чтобы гидратация совпала).
 * - canInstall / install(): браузер разрешил предложить установку (beforeinstallprompt).
 *   Событие слушаем с самого старта: оно может прийти раньше первого рендера.
 *   Своё мини-окно браузера не отключаем — кнопка лишь дополнительный путь.
 * - Сервис-воркер в «неисправимом» состоянии (файлы версии удалены с сервера) — перезагрузка.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly onlineState = signal(true);
  private readonly installState = signal(false);
  private prompt: InstallPromptEvent | null = null;
  private hydrated = false;
  readonly online = this.onlineState.asReadonly();
  readonly canInstall = this.installState.asReadonly();

  constructor() {
    if (!this.browser) return;
    const destroyRef = inject(DestroyRef);
    const on = (type: string, fn: (e: Event) => void) => {
      window.addEventListener(type, fn);
      destroyRef.onDestroy(() => window.removeEventListener(type, fn));
    };
    on('beforeinstallprompt', (e) => {
      this.prompt = e as InstallPromptEvent;
      if (this.hydrated) this.installState.set(true);
    });
    on('appinstalled', () => this.forgetPrompt());
    on('online', () => this.onlineState.set(true));
    on('offline', () => this.onlineState.set(false));
    // Без provideServiceWorker (тесты) SwUpdate нет; в разработке воркер выключен
    const sw = inject(SwUpdate, { optional: true });
    if (sw?.isEnabled) sw.unrecoverable.subscribe(() => location.reload());
  }

  /** После гидратации: настоящее состояние сети и уже пришедшее предложение установки. */
  hydrate(): void {
    if (!this.browser || this.hydrated) return;
    this.hydrated = true;
    this.onlineState.set(navigator.onLine);
    this.installState.set(this.prompt !== null);
  }

  /** Системный диалог установки. Показать его можно один раз — после ответа кнопка пропадает. */
  async install(): Promise<boolean> {
    const p = this.prompt;
    if (!p) return false;
    this.forgetPrompt();
    try {
      await p.prompt();
      return (await p.userChoice).outcome === 'accepted';
    } catch {
      return false;
    }
  }

  private forgetPrompt(): void {
    this.prompt = null;
    this.installState.set(false);
  }
}
