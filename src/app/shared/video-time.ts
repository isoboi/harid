/** Шаг перемотки стрелками с клавиатуры, секунды. */
export const SEEK_STEP = 5;

/** Ползунок перемотки — целые 0…1000: ролики короткие, но шаг в долю секунды плавнее процента. */
export const SCRUBBER_MAX = 1000;

const finite = (n: number): boolean => Number.isFinite(n);

/** «0:07», «1:05», «1:02:03». Мусор (NaN, Infinity, минус) — «0:00»; секунды округляются вниз. */
export function formatTime(sec: number): string {
  const total = finite(sec) && sec > 0 ? Math.floor(sec) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** Время внутри ролика: не меньше нуля и не больше длительности (если она известна). */
export function clampTime(t: number, duration: number): number {
  const lower = Math.max(0, t);
  return finite(duration) ? Math.min(lower, duration) : lower;
}

/** Позиция ролика → значение ползунка. Длительность неизвестна — ноль. */
export function scrubberValue(current: number, duration: number): number {
  if (!finite(duration) || duration <= 0) return 0;
  return Math.round(Math.min(Math.max(current / duration, 0), 1) * SCRUBBER_MAX);
}

/** Значение ползунка → секунды ролика. Длительность неизвестна — ноль: перематывать некуда. */
export function fromScrubber(value: number, duration: number): number {
  if (!finite(duration) || duration <= 0) return 0;
  return clampTime((value / SCRUBBER_MAX) * duration, duration);
}
