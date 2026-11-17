import { HttpErrorResponse } from '@angular/common/http';

/** Текст ошибки для пользователя: сообщение бэкенда как есть. */
export function apiErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Нет связи с сервером. Проверьте интернет.';
    const body = err.error?.error;
    const fields = body?.errors;
    if (fields && !Array.isArray(fields) && typeof fields === 'object') {
      const first = Object.values(fields as Record<string, string[]>)[0]?.[0];
      if (first) return first;
    }
    if (typeof body?.message === 'string' && body.message) return body.message;
  }
  return 'Что-то пошло не так. Попробуйте ещё раз.';
}
