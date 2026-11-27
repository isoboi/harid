import { HttpErrorResponse } from '@angular/common/http';
import { I18nLike, RU } from './i18n';
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

/**
 * Текст ошибки для пользователя: сообщение бэкенда — как пришло (его не переводим), иначе общий текст на языке страницы.
 */
export function apiErrorMessage(err: unknown, i18n: I18nLike = RU): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return i18n.t('Нет связи с сервером. Проверьте интернет.');
    const body = err.error?.error;
    const fields = body?.errors;
    if (fields && !Array.isArray(fields) && typeof fields === 'object') {
      const first = Object.values(fields as Record<string, string[]>)[0]?.[0];
      if (first) return first;
    }
    // 422 без сообщения по полю: в проде бэкенд отдаёт английский «Validation failed» — показываем свой текст
    if (err.status === 422) return i18n.t('Проверьте введённые данные');
    if (typeof body?.message === 'string' && body.message) return body.message;
    if (Array.isArray(body?.message)) {
      const first = (body.message as unknown[]).find((m): m is string => typeof m === 'string' && m !== '');
      if (first) return first;
    }
  }
  return i18n.t('Что-то пошло не так. Попробуйте ещё раз.');
}
