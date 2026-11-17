import { HttpErrorResponse } from '@angular/common/http';

/** Текст для 422, если бэкенд не отдал сообщение по полю (в проде приходит английский «Validation failed»). */
const VALIDATION_FALLBACK = 'Проверьте введённые данные';

/** Текст ошибки для пользователя: сообщение бэкенда на русском, иначе общий текст. */
export function apiErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Нет связи с сервером. Проверьте интернет.';
    const body = err.error?.error;
    const fields = body?.errors;
    if (fields && !Array.isArray(fields) && typeof fields === 'object') {
      const first = Object.values(fields as Record<string, string[]>)[0]?.[0];
      if (first) return first;
    }
    if (err.status === 422) return VALIDATION_FALLBACK;
    if (typeof body?.message === 'string' && body.message) return body.message;
    if (Array.isArray(body?.message)) {
      const first = (body.message as unknown[]).find((m): m is string => typeof m === 'string' && m !== '');
      if (first) return first;
    }
  }
  return 'Что-то пошло не так. Попробуйте ещё раз.';
}
