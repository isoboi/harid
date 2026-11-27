import { Order } from './models';
import { legacyRecipient, mergeRecipients, parseRecipients, readLastAddress, recipientKey, recipientsFromOrders, toRecipient } from './saved-addresses';

const mama = { name: 'Мама', phone: '931110002', district: 'Вахдат', address: 'ул. Ленина 5' };
const work = { name: 'Наим', phone: '927000000', district: 'Сино', address: 'Рудаки 12' };

describe('saved-addresses', () => {
  it('toRecipient: номер к 9 цифрам, мусор и чужой район — null', () => {
    expect(toRecipient({ ...mama, name: ' Мама ', phone: '+992 93 111 00 02' })).toEqual(mama);
    expect(toRecipient({ ...mama, district: 'Марс' })).toBeNull();
    expect(toRecipient({ ...mama, phone: '93111' })).toBeNull();
    expect(toRecipient({ ...mama, phone: 931110002 })).toBeNull();
    expect(toRecipient({ ...mama, address: ' у ' })).toBeNull();
    expect(toRecipient({ ...mama, name: 'М' })).toBeNull();
    expect(toRecipient('x')).toBeNull();
    expect(toRecipient(null)).toBeNull();
  });
  it('toRecipient: адрес и имя без крайних пробелов', () => {
    expect(toRecipient({ ...mama, address: '  ул. Ленина 5 ' })).toEqual(mama);
  });
  it('parseRecipients: не массив — пусто, плохие записи выброшены', () => {
    expect(parseRecipients({ a: 1 })).toEqual([]);
    expect(parseRecipients(null)).toEqual([]);
    expect(parseRecipients([mama, null, { name: 'x' }])).toEqual([mama]);
  });
  it('recipientKey: адрес без регистра и лишних пробелов, имя не входит', () => {
    expect(recipientKey({ ...mama, name: 'Модар', address: '  УЛ.  ленина 5 ' })).toBe(recipientKey(mama));
    expect(recipientKey({ ...mama, address: 'ул. Ленина 7' })).not.toBe(recipientKey(mama));
    expect(recipientKey({ ...mama, phone: '935550000' })).not.toBe(recipientKey(mama));
    expect(recipientKey({ ...mama, district: 'Сино' })).not.toBe(recipientKey(mama));
  });
  it('mergeRecipients: первый побеждает, скрытые выброшены, не больше 10', () => {
    expect(mergeRecipients([[mama], [{ ...mama, name: 'Модар' }, work]], new Set())).toEqual([mama, work]);
    expect(mergeRecipients([[mama, work]], new Set([recipientKey(mama)]))).toEqual([work]);
    const many = Array.from({ length: 12 }, (_, i) => ({ ...mama, address: `дом ${i + 10}` }));
    expect(mergeRecipients([many], new Set())).toHaveLength(10);
  });
  it('recipientsFromOrders: свежие первыми, номер сервера к 9 цифрам', () => {
    const order = (created_at: string, customer: object) => ({ created_at, customer }) as unknown as Order;
    expect(recipientsFromOrders([
      order('2026-11-01T10:00:00Z', { ...mama, phone: '+992 93 111 00 02' }),
      order('2026-11-20T10:00:00Z', { ...work, phone: '+992927000000' }),
      order('2026-11-10T10:00:00Z', { ...mama, district: 'Старый район' }),
    ])).toEqual([work, mama]);
  });
  it('legacyRecipient: из lastAddress и lastPhone; без телефона — null', () => {
    expect(legacyRecipient({ name: 'Мама', district: 'Вахдат', address: 'ул. Ленина 5' }, '931110002')).toEqual(mama);
    expect(legacyRecipient({ name: 'Мама', district: 'Вахдат', address: 'ул. Ленина 5' }, null)).toBeNull();
    expect(legacyRecipient(null, '931110002')).toBeNull();
  });
  it('readLastAddress: мусор и неизвестный район отбрасываются', () => {
    expect(readLastAddress(null)).toEqual({});
    expect(readLastAddress(['x'])).toEqual({});
    expect(readLastAddress({ name: 5, district: 'Марс', address: '  ' })).toEqual({});
    expect(readLastAddress({ name: ' Фаррух ', district: 'Сино', address: 'ул' })).toEqual({ name: 'Фаррух', district: 'Сино', address: 'ул' });
  });
});
