import { clampTime, formatTime, fromScrubber, scrubberValue, SCRUBBER_MAX, SEEK_STEP } from './video-time';

describe('video-time', () => {
  describe('formatTime', () => {
    it('минуты и секунды: «0:07», «1:05», «12:00»', () => {
      expect(formatTime(0)).toBe('0:00');
      expect(formatTime(7)).toBe('0:07');
      expect(formatTime(65)).toBe('1:05');
      expect(formatTime(720)).toBe('12:00');
    });
    it('секунды округляются вниз — как на часах плеера', () => {
      expect(formatTime(7.99)).toBe('0:07');
    });
    it('больше часа — с часами', () => {
      expect(formatTime(3723)).toBe('1:02:03');
    });
    it('мусор вместо времени (NaN, Infinity, минус) — «0:00»', () => {
      expect(formatTime(NaN)).toBe('0:00');
      expect(formatTime(Infinity)).toBe('0:00');
      expect(formatTime(-5)).toBe('0:00');
    });
  });

  describe('clampTime', () => {
    it('держит время внутри ролика', () => {
      expect(clampTime(-3, 20)).toBe(0);
      expect(clampTime(25, 20)).toBe(20);
      expect(clampTime(8, 20)).toBe(8);
    });
    it('длительность неизвестна — не уходит ниже нуля, сверху не ограничено', () => {
      expect(clampTime(-1, NaN)).toBe(0);
      expect(clampTime(9, NaN)).toBe(9);
    });
  });

  describe('ползунок перемотки', () => {
    it('позиция ролика ↔ значение ползунка', () => {
      expect(scrubberValue(12, 24)).toBe(SCRUBBER_MAX / 2);
      expect(fromScrubber(SCRUBBER_MAX / 2, 24)).toBe(12);
    });
    it('длительность неизвестна — ползунок в нуле, перемотка ничего не делает', () => {
      expect(scrubberValue(5, NaN)).toBe(0);
      expect(scrubberValue(5, 0)).toBe(0);
      expect(fromScrubber(500, NaN)).toBe(0);
    });
    it('значение никогда не выходит за 0…SCRUBBER_MAX', () => {
      expect(scrubberValue(30, 24)).toBe(SCRUBBER_MAX);
      expect(scrubberValue(-1, 24)).toBe(0);
    });
  });

  it('шаг перемотки с клавиатуры — 5 секунд', () => {
    expect(SEEK_STEP).toBe(5);
  });
});
