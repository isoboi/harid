import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { TG } from './index';

/**
 * Каждый русский текст, который код отдаёт на перевод, есть в таджикском словаре.
 * Ищем литералы в исходниках: `'…' | t`, `.t('…')`, первую форму `.plural(n, ['…', …])`
 * и в `[string, string, string] = ['…', …]`, `title: '…'` в роутах.
 * Динамические ключи (`{{ label | t }}`) этот тест не видит — их значения должны попасть сюда через литерал где-то ещё.
 */
const APP = join(__dirname, '..', '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'i18n' ? [] : sources(p);
    return p.endsWith('.ts') && !p.endsWith('.spec.ts') ? [p] : [];
  });
}

const STR = `'((?:[^'\\\\\\n]|\\\\.)*)'`;
const PATTERNS = [
  new RegExp(`${STR}\\s*\\|\\s*t\\b`, 'g'),
  new RegExp(`\\.t\\(\\s*${STR}`, 'g'),
  new RegExp(`\\.plural\\([^,()]+,\\s*\\[\\s*${STR}`, 'g'),
  new RegExp(`\\[string, string, string\\]\\s*=\\s*\\[\\s*${STR}`, 'g'),
];
/**
 * Подписи в массивах и словарях-константах, которые шаблон переводит через `{{ s.title | t }}` / `{{ label[x] | t }}`:
 * поля label/title/text объектов и значения констант *_LABEL. `title:` вне роутов тоже сюда попадает —
 * литерал в SeoService.set({ title: '…' }) без перевода ушёл бы во вкладку по-русски.
 */
const FIELD = new RegExp(`\\b(?:label|title|text):\\s*${STR}`, 'g');
const LABEL_MAP = /_LABEL\b[^=\n]*=\s*\{([^}]*)\}/g;
const ROUTE_TITLE = new RegExp(`title:\\s*${STR}`, 'g');
/** `{{ (busy() ? 'Отменяем…' : 'Да, отменить') | t }}` — обе ветки. */
const TERNARY = new RegExp(`\\?\\s*${STR}\\s*:\\s*${STR}\\s*\\)\\s*\\|\\s*t\\b`, 'g');
/** Перевод с контекстом: `'Избранное' | t: null : 'tab'` и `.t('Избранное', null, 'tab')` → ключ «tab|Избранное». */
const ARGS = `(?:null|undefined|\\{[^}]*\\})`;
const CTX_PIPE = new RegExp(`${STR}\\s*\\|\\s*t\\s*:\\s*${ARGS}\\s*:\\s*${STR}`, 'g');
const CTX_CALL = new RegExp(`\\.t\\(\\s*${STR}\\s*,\\s*${ARGS}\\s*,\\s*${STR}`, 'g');
const unescape = (s: string) => s.replace(/\\(.)/g, '$1');
const hasCyrillic = (s: string) => /[Ѐ-ӿ]/.test(s);

/** Ключи «контекст|текст», которые код действительно запрашивает. */
const ctxUsed = new Set<string>();

function keys(): Map<string, string> {
  const found = new Map<string, string>();
  for (const file of sources(APP)) {
    // Примеры в комментариях («{{ 'В корзине {n}' | t }}» в i18n.ts) — не вызовы перевода
    const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const where = relative(APP, file).replace(/\\/g, '/');
    const add = (key: string) => { if (hasCyrillic(key) && !found.has(key)) found.set(key, where); };
    const patterns = where === 'app.routes.ts' ? [...PATTERNS, ROUTE_TITLE] : [...PATTERNS, FIELD];
    for (const re of patterns) for (const m of text.matchAll(re)) add(unescape(m[1]));
    for (const m of text.matchAll(TERNARY)) { add(unescape(m[1])); add(unescape(m[2])); }
    for (const m of text.matchAll(LABEL_MAP)) for (const v of m[1].matchAll(new RegExp(STR, 'g'))) add(unescape(v[1]));
    for (const re of [CTX_PIPE, CTX_CALL]) for (const m of text.matchAll(re)) ctxUsed.add(`${unescape(m[2])}|${unescape(m[1])}`);
  }
  return found;
}

describe('таджикский словарь покрывает код', () => {
  const found = keys();

  it('находит ключи в исходниках (сам поиск не сломан)', () => {
    expect(found.get('Корзина')).toBeDefined();
    expect(found.get('Корзина — Харид')).toBe('app.routes.ts');
    expect(found.get('Сначала дешевле')).toBe('shared/feed-filters.ts');
    expect(found.get('Без оплаты на сайте и без перевода на карту.')).toBe('pages/home/home.component.ts');
    expect(found.get('Курьер в пути')).toBe('core/checkout-options.ts');
    expect(found.get('Да, отменить')).toBe('pages/order/order.component.ts');
    expect(found.get('Избранное')).toBeDefined();
    expect(ctxUsed.has('tab|Избранное')).toBe(true);
  });

  it('каждый ключ «контекст|текст» в словаре запрашивается кодом (опечатка в контексте молча вернула бы обычный перевод)', () => {
    const orphans = Object.keys(TG).filter((k) => k.includes('|') && !ctxUsed.has(k));
    expect(orphans).toEqual([]);
  });

  it('у ключа с контекстом есть и обычный перевод — его покажут там, где контекста нет', () => {
    const noBase = Object.keys(TG).filter((k) => k.includes('|')).map((k) => k.slice(k.indexOf('|') + 1)).filter((base) => !(base in TG));
    expect(noBase).toEqual([]);
  });

  it('у каждого ключа из кода есть перевод', () => {
    const missing = [...found].filter(([k]) => !(k in TG)).map(([k, where]) => `${where}: ${k}`);
    expect(missing).toEqual([]);
  });
});
