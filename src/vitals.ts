/**
 * Скорость сайта у живых покупателей (Core Web Vitals): браузер шлёт метрики на POST /vitals,
 * сервер проверяет их и пишет в лог по строке JSON на метрику — свод считает scripts/vitals-report.mjs.
 *
 * Никаких личных данных: ни адреса страницы с параметрами, ни номеров заказов — только шаблон
 * маршрута («product/:id»), тип сети и «телефон/компьютер».
 */

/** Куда браузер отправляет метрики (тот же сервер, что отдаёт страницы). */
export const VITALS_PATH = '/vitals';
/** Сколько метрик за раз: на страницу их пять (TTFB, FCP, LCP, INP, CLS), с запасом на повторы после bfcache. */
export const VITALS_MAX_BATCH = 20;

export const VITAL_NAMES = ['TTFB', 'FCP', 'LCP', 'INP', 'CLS'] as const;
export type VitalName = (typeof VITAL_NAMES)[number];
export const VITAL_RATINGS = ['good', 'needs-improvement', 'poor'] as const;
export const VITAL_NETS = ['slow-2g', '2g', '3g', '4g', ''] as const;
export const VITAL_DEVICES = ['mobile', 'desktop'] as const;

/** Одна метрика в отчёте. value — мс; у CLS — безразмерная доля сдвига. */
export interface VitalReport {
  name: VitalName;
  value: number;
  rating: (typeof VITAL_RATINGS)[number];
  /** Как открыли страницу: navigate, reload, back-forward… */
  nav: string;
  /** Шаблон маршрута, с которого начался визит: «product/:id», «» — главная, «**» — не найдено. */
  route: string;
  /** navigator.connection.effectiveType; '' — браузер не сообщает (Safari, Firefox). */
  net: (typeof VITAL_NETS)[number];
  device: (typeof VITAL_DEVICES)[number];
  /** Случайный id метрики от web-vitals: повтор той же метрики можно отбросить. */
  id: string;
}

const NAV = /^[a-z-]{1,30}$/;
const ROUTE = /^[a-z0-9/:*-]{0,60}$/i;
const ID = /^[\w.-]{1,60}$/;
/** Верхние границы: всё выше — мусор, а не медленный сайт. */
const MAX_VALUE: Record<VitalName, number> = { TTFB: 120_000, FCP: 120_000, LCP: 120_000, INP: 60_000, CLS: 100 };

const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);

/** Одна метрика из запроса или null, если она не по форме. Лишние поля отбрасываются. */
export function parseVital(raw: unknown): VitalReport | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!oneOf(VITAL_NAMES, r['name'])) return null;
  const value = r['value'];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_VALUE[r['name']]) return null;
  if (!oneOf(VITAL_RATINGS, r['rating']) || !oneOf(VITAL_NETS, r['net']) || !oneOf(VITAL_DEVICES, r['device'])) return null;
  const { nav, route, id } = r;
  if (typeof nav !== 'string' || !NAV.test(nav) || typeof route !== 'string' || !ROUTE.test(route) || typeof id !== 'string' || !ID.test(id)) return null;
  return { name: r['name'], value, rating: r['rating'], nav, route, net: r['net'], device: r['device'], id };
}

/** Тело POST /vitals → проверенные метрики; null — запрос целиком не по форме (тогда 400). */
export function parseVitals(body: unknown): VitalReport[] | null {
  if (typeof body !== 'string' || !body) return null;
  let data: unknown;
  try { data = JSON.parse(body); } catch { return null; }
  if (!Array.isArray(data) || !data.length || data.length > VITALS_MAX_BATCH) return null;
  const out = data.map(parseVital);
  return out.every((v): v is VitalReport => v !== null) ? out : null;
}
