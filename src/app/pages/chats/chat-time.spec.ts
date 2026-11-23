import { chatDayLabel, chatListTime, chatTime } from './chat-time';

describe('chat-time (Душанбе, UTC+5)', () => {
  const now = new Date('2026-11-23T10:00:00Z'); // 15:00 в Душанбе

  it('время пузыря — часы и минуты по Душанбе', () => {
    expect(chatTime('2026-11-23T04:56:00Z')).toBe('09:56');
  });

  it('подпись дня: сегодня, вчера, дата; другой год — с годом', () => {
    expect(chatDayLabel('2026-11-23T01:00:00Z', now)).toBe('Сегодня');
    // 22 ноября 21:00 UTC — уже 23-е в Душанбе
    expect(chatDayLabel('2026-11-22T21:00:00Z', now)).toBe('Сегодня');
    expect(chatDayLabel('2026-11-22T10:00:00Z', now)).toBe('Вчера');
    expect(chatDayLabel('2026-11-02T10:00:00Z', now)).toBe('2 ноября');
    expect(chatDayLabel('2025-11-02T10:00:00Z', now)).toBe('2 ноября 2025 г.');
  });

  it('время в списке: сегодня — часы, раньше — короткая дата', () => {
    expect(chatListTime('2026-11-23T04:56:00Z', now)).toBe('09:56');
    expect(chatListTime('2026-11-21T04:56:00Z', now)).toBe('21 нояб.');
  });
});
