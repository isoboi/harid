import { HttpErrorResponse } from '@angular/common/http';
import { ChangedPrice } from './models';

/** Строки 409 «Цена изменилась» (error.changed) или null, если это другая ошибка. */
export function priceChanges(err: unknown): ChangedPrice[] | null {
  if (!(err instanceof HttpErrorResponse) || err.status !== 409) return null;
  const changed: unknown = err.error?.error?.changed;
  if (!Array.isArray(changed)) return null;
  const valid = changed.filter((c): c is ChangedPrice =>
    !!c && typeof c === 'object' && Number.isInteger(c.product_id) && typeof c.price === 'number');
  return valid.length ? valid.map((c) => ({ product_id: c.product_id, price: c.price, old_price: typeof c.old_price === 'number' ? c.old_price : null, promo_ends_at: typeof c.promo_ends_at === 'string' ? c.promo_ends_at : null })) : null;
}

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
