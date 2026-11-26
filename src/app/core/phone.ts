/** 9 цифр номера: «+992 93 111 00 02» → «931110002». Используется оформлением заказа и входом. */
export const phone9 = (v: string): string => v.replace(/\D/g, '').slice(-9);

/** Номер для показа: «+992931110002» → «+992 93 111 00 02»; не 9 цифр — как пришёл. */
export function prettyPhone(v: string): string {
  const d = phone9(v);
  return d.length === 9 ? `+992 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}` : v;
}

/** Ровно 9 цифр номера, перед ними допустимо 992 или +992; пробелы, скобки и дефисы разрешены. */
export const PHONE_PATTERN = /^\s*(\+?992)?[\s()-]*(\d[\s()-]*){9}$/;

/** Проверка номера для формы: короткие и лишние цифры отклоняются, чтобы SMS не ушла не на тот номер. */
export const isPhone = (v: string): boolean => PHONE_PATTERN.test(v);
