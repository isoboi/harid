/**
 * Ссылки «Поделиться». UTM-метки нужны, чтобы в аналитике было видно, откуда пришли люди:
 * из Telegram, WhatsApp, по скопированной ссылке или из шапки профиля Instagram у лавки.
 */

/** Добавляет utm_source и utm_medium; на неразборчивом адресе возвращает его как есть. */
export function withUtm(url: string, source: string, medium: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', source);
    u.searchParams.set('utm_medium', medium);
    return u.toString();
  } catch { return url; }
}

export function telegramShareUrl(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

export function whatsappShareUrl(url: string, text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`.trim())}`;
}

/** Ссылка на лавку для шапки профиля Instagram: открывает витрину лавки, метка — «пришли из bio». */
export function bioLink(origin: string, handle: string): string {
  return withUtm(`${origin}/shop/${encodeURIComponent(handle)}`, 'instagram', 'bio');
}
