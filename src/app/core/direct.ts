import { Product } from './models';

/** Ссылки, которые разрешено открывать как чат с лавкой: только Direct и профиль Instagram. */
const INSTAGRAM_CHAT = /^https:\/\/(ig\.me\/m\/|(www\.)?instagram\.com\/)/;
/** Ссылка на пост Instagram — наружу ведём только на сам Instagram. */
const INSTAGRAM_POST = /^https:\/\/(www\.)?instagram\.com\//;

/** Лавка ещё не подключена к Хариду: цену и заказ обсуждают в Instagram Direct, корзины нет. */
export const directOnly = (p: Product): boolean => p.shop_verified === false;

/** Чат с лавкой в Instagram; без ссылки от бэкенда — ig.me по нику лавки. */
export function directLink(p: Product): string {
  const url = p.direct_url ?? '';
  return INSTAGRAM_CHAT.test(url) ? url : `https://ig.me/m/${encodeURIComponent(p.shop_handle)}`;
}

/** Исходный пост товара или пустая строка, если ссылки нет или она ведёт не в Instagram. */
export function postLink(p: Product): string {
  const url = p.permalink ?? '';
  return INSTAGRAM_POST.test(url) ? url : '';
}
