import { DestroyRef, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Сколько секунд код считается свежим и повторная отправка не нужна. */
export const RESEND_SECONDS = 60;

/**
 * Учёт последней успешной отправки SMS-кода: номер и время.
 * Нужен, чтобы «Назад → тот же номер» не слал код заново, и для обратного отсчёта «Отправить ещё раз».
 * Создаётся в контексте внедрения; таймер живёт только в браузере и снимается при уничтожении.
 */
export class CodeResend {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private phone: string | null = null;
  private sentAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly leftState = signal(0);
  /** Секунд до возможной повторной отправки; 0 — можно слать. */
  readonly left = this.leftState.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Запоминает успешную отправку на номер и запускает отсчёт. */
  markSent(phone9: string): void {
    this.phone = phone9;
    this.sentAt = Date.now();
    this.stop();
    this.leftState.set(RESEND_SECONDS);
    if (!this.browser) return;
    this.timer = setInterval(() => this.tick(), 1000);
  }

  /** Код на этот номер отправлен меньше RESEND_SECONDS назад. */
  isRecent(phone9: string): boolean {
    return this.phone === phone9 && Date.now() - this.sentAt < RESEND_SECONDS * 1000;
  }

  private tick(): void {
    const left = Math.max(0, Math.ceil((this.sentAt + RESEND_SECONDS * 1000 - Date.now()) / 1000));
    this.leftState.set(left);
    if (left === 0) this.stop();
  }

  private stop(): void {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
  }
}
