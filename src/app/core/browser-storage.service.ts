import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** localStorage только в браузере; на сервере — fallback и no-op. */
@Injectable({ providedIn: 'root' })
export class BrowserStorage {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  get<T>(key: string, fallback: T): T {
    if (!this.browser) return fallback;
    try { const raw = localStorage.getItem(key); return raw === null ? fallback : (JSON.parse(raw) as T); } catch { return fallback; }
  }
  set(key: string, value: unknown): void { if (this.browser) try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* квота/приватный режим */ } }
  remove(key: string): void { if (this.browser) try { localStorage.removeItem(key); } catch { /* ignore */ } }
}
