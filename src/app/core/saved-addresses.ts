import { DISTRICTS } from './checkout-options';
import { Order } from './models';
import { phone9 } from './phone';

/** Кому и куда везти: курьер звонит получателю, он же платит наличными. phone — 9 цифр, как в поле формы. */
export interface Recipient { name: string; phone: string; district: string; address: string }

/** Сколько получателей показываем в «Кому доставить». */
export const MAX_RECIPIENTS = 10;

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/** Тот же получатель — тот же телефон, район и адрес; имя не входит: «Мама» и «Модар» — один человек. */
export function recipientKey(r: Recipient): string { return `${r.phone}|${r.district}|${norm(r.address)}`; }

/** Получатель, если запись проходит те же проверки, что форма оформления; иначе null. */
export function toRecipient(v: unknown): Recipient | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o['name'] !== 'string' || typeof o['phone'] !== 'string' || typeof o['district'] !== 'string' || typeof o['address'] !== 'string') return null;
  const name = o['name'].trim();
  const phone = phone9(o['phone']);
  const district = o['district'];
  const address = o['address'].trim();
  if (name.length < 2 || phone.length !== 9 || !DISTRICTS.includes(district) || address.length < 3) return null;
  return { name, phone, district, address };
}

/** Список из хранилища: не массив — пусто, испорченные записи выброшены. */
export function parseRecipients(raw: unknown): Recipient[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(toRecipient).filter((r): r is Recipient => r !== null);
}

/** Списки по порядку важности: первый с ключом побеждает, скрытые выброшены. */
export function mergeRecipients(lists: readonly Recipient[][], hidden: ReadonlySet<string>, limit = MAX_RECIPIENTS): Recipient[] {
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const r of lists.flat()) {
    const key = recipientKey(r);
    if (seen.has(key) || hidden.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out.slice(0, limit);
}

/** Получатели прошлых заказов, свежие первыми; заказы с районом не из списка пропускаются. */
export function recipientsFromOrders(orders: readonly Order[]): Recipient[] {
  return [...orders]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map((o) => toRecipient(o.customer))
    .filter((r): r is Recipient => r !== null);
}

/** Старый формат: кто и куда получал прошлый заказ (harid.lastAddress). Комментарий не храним: он про один заказ. */
export interface LastAddress { name: string; district: string; address: string }

/** Сохранённый адрес, если он цел; район вне текущего списка (список поменяли) — без района. */
export function readLastAddress(v: unknown): Partial<LastAddress> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const o = v as Record<string, unknown>;
  const str = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : undefined);
  const out: Partial<LastAddress> = {};
  const name = str(o['name']); if (name) out.name = name;
  const address = str(o['address']); if (address) out.address = address;
  const district = str(o['district']); if (district && DISTRICTS.includes(district)) out.district = district;
  return out;
}

/** Получатель из старых harid.lastAddress и harid.lastPhone — первая запись нового списка. */
export function legacyRecipient(lastAddress: unknown, lastPhone: unknown): Recipient | null {
  if (typeof lastPhone !== 'string') return null;
  return toRecipient({ ...readLastAddress(lastAddress), phone: lastPhone });
}
