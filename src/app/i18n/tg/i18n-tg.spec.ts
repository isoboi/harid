import { ACCOUNT } from './account';
import { BUY } from './buy';
import { CATALOG } from './catalog';
import { CHATS } from './chats';
import { PRODUCT } from './product';
import { SHELL } from './shell';
import { TG } from './index';

const SECTIONS: Record<string, Record<string, string>> = { SHELL, CATALOG, PRODUCT, BUY, ACCOUNT, CHATS };
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('таджикский словарь', () => {
  it('в переводе те же {параметры}, что в русском ключе', () => {
    const broken = Object.entries(TG).filter(([k, v]) => placeholders(k).join() !== placeholders(v).join());
    expect(broken).toEqual([]);
  });
  it('нет пустых переводов и лишних пробелов по краям', () => {
    const bad = Object.entries(TG).filter(([, v]) => !v.trim() || v !== v.trim());
    expect(bad).toEqual([]);
  });
  it('ключ из двух разделов переводится одинаково (иначе один перевод молча затрёт другой)', () => {
    const seen = new Map<string, { section: string; value: string }>();
    const conflicts: string[] = [];
    for (const [section, dict] of Object.entries(SECTIONS)) {
      for (const [k, v] of Object.entries(dict)) {
        const prev = seen.get(k);
        if (prev && prev.value !== v) conflicts.push(`${k}: ${prev.section}=«${prev.value}», ${section}=«${v}»`);
        else seen.set(k, { section, value: v });
      }
    }
    expect(conflicts).toEqual([]);
  });
});
