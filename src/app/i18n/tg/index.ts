import type { Dict } from '../../core/i18n';
import { ACCOUNT } from './account';
import { BUY } from './buy';
import { CATALOG } from './catalog';
import { CHATS } from './chats';
import { PRODUCT } from './product';
import { SHELL } from './shell';

/**
 * Таджикский словарь: ключ — русский текст из шаблона или кода, значение — перевод.
 * Разбит по разделам сайта; одинаковый ключ в двух разделах должен переводиться одинаково (проверяет i18n-tg.spec.ts).
 */
export const TG: Dict = { ...SHELL, ...CATALOG, ...PRODUCT, ...BUY, ...ACCOUNT, ...CHATS };
