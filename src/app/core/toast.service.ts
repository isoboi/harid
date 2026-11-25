import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

/** Кнопка в плашке: ссылка внутри витрины или действие («Вернуть», «Обновить»). */
export interface ToastAction {
  label: string;
  link?: string;
  run?: () => void;
}

export interface ToastInput {
  text: string;
  /** error — что-то не получилось; info — подтверждение. */
  kind?: 'info' | 'error';
  action?: ToastAction;
  /** Сколько висит, мс. По умолчанию: 4 с, с кнопкой — 6 с, ошибка — 5 с. */
  duration?: number;
}

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error';
  action?: ToastAction;
  /** Плашка уезжает: ещё видна, но кнопка уже не сработает дважды. */
  leaving: boolean;
}

export const TOAST_MS = 4000;
export const TOAST_ACTION_MS = 6000;
export const TOAST_ERROR_MS = 5000;
/** Сколько длится уход плашки — столько же, сколько анимация в ToastComponent. */
export const TOAST_LEAVE_MS = 160;

/**
 * Короткие сообщения внизу экрана: «Добавлено в избранное», «Не удалось обновить», «Товар убран · Вернуть».
 * Одна плашка за раз — новая заменяет прежнюю (как snackbar на телефоне).
 * Пока на плашку навели мышь или фокус — она не исчезает.
 * На сервере ничего не показывается: таймер задержал бы рендер, а сообщения — ответ на действие в браузере.
 * Ошибки форм сюда не идут: они остаются у поля, пока их не исправят.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly state = signal<Toast | null>(null);
  readonly current = this.state.asReadonly();
  private nextId = 1;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private leaveTimer: ReturnType<typeof setTimeout> | null = null;
  /** Когда плашка должна уйти и сколько ей оставалось на момент паузы. */
  private deadline = 0;
  private remaining = 0;
  private paused = false;

  /** Показать плашку; возвращает её id (для dismiss). На сервере — 0. */
  show(input: ToastInput): number {
    if (!this.browser) return 0;
    this.clearTimers();
    const kind = input.kind ?? 'info';
    const toast: Toast = { id: this.nextId++, text: input.text, kind, action: input.action, leaving: false };
    this.state.set(toast);
    this.paused = false;
    this.schedule(input.duration ?? (input.action ? TOAST_ACTION_MS : kind === 'error' ? TOAST_ERROR_MS : TOAST_MS));
    return toast.id;
  }

  error(text: string, action?: ToastAction): number { return this.show({ text, kind: 'error', action }); }

  /** Убрать плашку. С id — только если на экране всё ещё она (новая не пропадёт по старой причине). */
  dismiss(id?: number): void {
    const t = this.state();
    if (!t || t.leaving || (id !== undefined && t.id !== id)) return;
    this.clearTimers();
    this.state.set({ ...t, leaving: true });
    this.leaveTimer = setTimeout(() => {
      this.leaveTimer = null;
      if (this.state()?.id === t.id) this.state.set(null);
    }, TOAST_LEAVE_MS);
  }

  /** Нажата кнопка плашки: действие один раз, затем плашка уходит. */
  act(): void {
    const t = this.state();
    if (!t || t.leaving) return;
    this.dismiss(t.id);
    t.action?.run?.();
  }

  pause(): void {
    if (this.paused || !this.timer) return;
    this.paused = true;
    this.remaining = Math.max(0, this.deadline - Date.now());
    clearTimeout(this.timer);
    this.timer = null;
  }

  /** Мышь или фокус ушли с плашки: досчитываем остаток, но не меньше полутора секунд — чтобы успеть дочитать. */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    const t = this.state();
    if (t && !t.leaving) this.schedule(Math.max(1500, this.remaining));
  }

  private schedule(ms: number): void {
    const id = this.state()?.id;
    this.deadline = Date.now() + ms;
    this.timer = setTimeout(() => { this.timer = null; this.dismiss(id); }, ms);
  }

  private clearTimers(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.leaveTimer) { clearTimeout(this.leaveTimer); this.leaveTimer = null; }
  }
}
