/**
 * Адрес сайта (origin) из адреса запроса: нужен для canonical, og:url, JSON-LD и sitemap.xml.
 * Боевой домен нигде не зашит — берём тот, по которому к серверу пришли (Host уже проверен allowedHosts).
 *
 * За обратным прокси (Vercel, nginx) Node видит http, хотя снаружи https: учитываем X-Forwarded-Proto,
 * а в продакшне для любого не локального хоста принудительно https — canonical на http нам не нужен.
 */
export function siteOrigin(requestUrl: string, opts: { forwardedProto?: string | null; production: boolean }): string {
  let u: URL;
  try { u = new URL(requestUrl); } catch { return ''; }
  const forwarded = (opts.forwardedProto ?? '').split(',')[0].trim().toLowerCase();
  let proto = forwarded === 'http' || forwarded === 'https' ? forwarded : u.protocol.replace(':', '');
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]';
  if (opts.production && !local) proto = 'https';
  return `${proto}://${u.host}`;
}
