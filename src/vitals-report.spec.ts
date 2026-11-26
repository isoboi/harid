import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/** scripts/vitals-report.mjs запускается так же, как его запустит человек: node, лог на stdin. */
const script = join(__dirname, '..', 'scripts', 'vitals-report.mjs');
const report = (lines: string[], ...args: string[]) => execFileSync(process.execPath, [script, ...args], { input: lines.join('\n'), encoding: 'utf8' });

let n = 0;
const vital = (name: string, value: number, route: string, device = 'mobile', at = '2026-11-25T10:00:00.000Z', id = `id-${++n}`) =>
  `0|harid  | ${JSON.stringify({ vital: { name, value, rating: 'good', nav: 'navigate', route, net: '4g', device, id }, at })}`;

describe('scripts/vitals-report.mjs', () => {
  it('p75 по маршруту и устройству, оценка по порогам Google', () => {
    const lcp = [1000, 2000, 3000, 5000].map((v) => vital('LCP', v, 'product/:id'));
    const ttfb = [300, 400, 500, 600].map((v) => vital('TTFB', v, 'product/:id'));
    const out = report([...lcp, ...ttfb, vital('TTFB', 100, '', 'desktop')]);
    const row = out.split('\n').find((l) => l.startsWith('product/:id'))!;
    // p75 из четырёх — третье по величине: 3000 мс (терпимо), TTFB 500 мс (хорошо)
    expect(row).toMatch(/mobile\s+4\s+3000 мс ~/);
    expect(row).toContain('500 мс ✓');
    expect(out).toContain('/ (главная)');
    // Самый посещаемый маршрут — первым
    expect(out.indexOf('product/:id')).toBeLessThan(out.indexOf('/ (главная)'));
  });

  it('повтор той же метрики (одинаковый id), чужие строки и битый JSON не считаются', () => {
    const dup = vital('LCP', 6000, 'c/:slug', 'mobile', undefined, 'same');
    const out = report(['Node Express server listening', dup, dup, '{"vital": oops', vital('TTFB', 200, 'c/:slug')]);
    expect(out.split('\n').find((l) => l.startsWith('c/:slug'))).toMatch(/mobile\s+1\s+6000 мс ✗/);
  });

  it('--since отсекает старые строки', () => {
    const out = report([vital('TTFB', 200, 'catalog', 'mobile', '2026-10-01T00:00:00.000Z'), vital('TTFB', 200, 'search', 'mobile', '2026-11-20T00:00:00.000Z')], '--since', '2026-11-01');
    expect(out).toContain('search');
    expect(out).not.toContain('catalog');
  });

  it('метрик нет — подсказка, откуда они берутся', () => {
    expect(report(['просто лог'])).toContain('POST /vitals');
  });
});
