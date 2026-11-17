import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from './api-error';

describe('apiErrorMessage', () => {
  it('берёт error.error.message бэкенда', () => {
    const e = new HttpErrorResponse({ status: 400, error: { success: false, statusCode: 400, error: { message: 'Выберите размер для «Платье»', errors: [] } } });
    expect(apiErrorMessage(e)).toBe('Выберите размер для «Платье»');
  });
  it('422 с полями — первое сообщение поля', () => {
    const e = new HttpErrorResponse({ status: 422, error: { error: { message: 'Validation failed', errors: { phone: ['Неверный номер'] } } } });
    expect(apiErrorMessage(e)).toBe('Неверный номер');
  });
  it('нет сети — понятный текст', () => {
    expect(apiErrorMessage(new HttpErrorResponse({ status: 0 }))).toBe('Нет связи с сервером. Проверьте интернет.');
  });
  it('неизвестная ошибка — общий текст', () => {
    expect(apiErrorMessage(new Error('x'))).toBe('Что-то пошло не так. Попробуйте ещё раз.');
  });
});
