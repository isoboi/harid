#!/usr/bin/env node
/**
 * Свод Core Web Vitals из лога SSR-сервера (строки {"vital":{…},"at":"…"}, их пишет POST /vitals в src/server.ts).
 *
 *   node scripts/vitals-report.mjs server.log [ещё.log …]
 *   pm2 logs harid --raw --lines 100000 | node scripts/vitals-report.mjs
 *   node scripts/vitals-report.mjs --since 2026-11-01 server.log
 *
 * По каждому маршруту и типу устройства: число визитов и p75 каждой метрики — так их считает Google
 * (оценка по p75: ✓ хорошо, ~ терпимо, ✗ плохо). Префиксы строк (время, имя процесса pm2/docker) не мешают.
 */
import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

/** Пороги Google: [хорошо до, плохо от]. CLS — доля, остальное — мс. */
export const THRESHOLDS = { LCP: [2500, 4000], INP: [200, 500], CLS: [0.1, 0.25], FCP: [1800, 3000], TTFB: [800, 1800] };
const METRICS = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];

/** p75 по «ближайшему рангу», как в CrUX. */
export function p75(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.75) - 1];
}

export function grade(name, value) {
  const [good, poor] = THRESHOLDS[name];
  return value <= good ? '✓' : value < poor ? '~' : '✗';
}

/** Строка лога → метрика или null. */
export function parseLine(line) {
  const at = line.indexOf('{"vital"');
  if (at < 0) return null;
  try {
    const row = JSON.parse(line.slice(at));
    return row && row.vital && typeof row.vital.value === 'number' ? { ...row.vital, at: row.at } : null;
  } catch {
    return null;
  }
}

/** Метрики → свод: [{ route, device, visits, metrics: { LCP: { p75, count } … } }], сначала самые посещаемые. */
export function summarize(vitals, { since } = {}) {
  const seen = new Set();
  const groups = new Map();
  for (const v of vitals) {
    if (since && (!v.at || v.at < since)) continue;
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    const key = `${v.route}\u0000${v.device}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { route: v.route, device: v.device, values: {} }));
    (g.values[v.name] ??= []).push(v.value);
  }
  return [...groups.values()]
    .map((g) => ({
      route: g.route,
      device: g.device,
      // Визит — это TTFB: он приходит на каждой загрузке страницы
      visits: (g.values.TTFB ?? g.values.FCP ?? []).length,
      metrics: Object.fromEntries(METRICS.filter((m) => g.values[m]).map((m) => [m, { p75: p75(g.values[m]), count: g.values[m].length }])),
    }))
    .sort((a, b) => b.visits - a.visits || a.route.localeCompare(b.route));
}

const fmt = (name, v) => (name === 'CLS' ? v.toFixed(3) : `${Math.round(v)} мс`);

export function render(rows) {
  if (!rows.length) return 'Метрик в логе нет: строки {"vital":…} пишет POST /vitals (src/server.ts).\n';
  const head = ['Маршрут', 'Устройство', 'Визиты', ...METRICS.map((m) => `${m} p75`)];
  const body = rows.map((r) => [
    r.route === '' ? '/ (главная)' : r.route === '**' ? '** (не найдено)' : r.route,
    r.device,
    String(r.visits),
    ...METRICS.map((m) => (r.metrics[m] ? `${fmt(m, r.metrics[m].p75)} ${grade(m, r.metrics[m].p75)}` : '—')),
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((row) => row[i].length)));
  const line = (cells) => cells.map((c, i) => (i >= 2 ? c.padStart(widths[i]) : c.padEnd(widths[i]))).join('  ');
  return [line(head), widths.map((w) => '─'.repeat(w)).join('  '), ...body.map(line), '', '✓ хорошо · ~ терпимо · ✗ плохо (пороги Google по p75)'].join('\n') + '\n';
}

async function main(argv) {
  const args = [...argv];
  let since;
  const s = args.indexOf('--since');
  if (s >= 0) { since = args[s + 1]; args.splice(s, 2); }
  const inputs = args.length ? args.map((f) => createReadStream(f, 'utf8')) : [process.stdin];
  const vitals = [];
  for (const input of inputs) {
    for await (const line of createInterface({ input, crlfDelay: Infinity })) {
      const v = parseLine(line);
      if (v) vitals.push(v);
    }
  }
  process.stdout.write(render(summarize(vitals, { since })));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main(process.argv.slice(2)).catch((e) => { console.error(e); process.exit(1); });
}
