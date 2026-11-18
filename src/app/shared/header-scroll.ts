/** Состояние скрывающейся шапки: спрятана ли она и с какой прокрутки считаем следующий сдвиг. */
export interface HeaderScrollState { hidden: boolean; lastY: number }

/** Наверху страницы (до высоты шапки: логотип + поиск ≈ 105px) шапка видна всегда. */
export const HEADER_TOP_ZONE = 112;
/** Мелкую дрожь пальца и инерцию не считаем: шапка реагирует на сдвиг от 8px. */
export const HEADER_SCROLL_STEP = 8;

/**
 * Следующее состояние шапки по новой прокрутке y. Чистая функция без DOM — её легко проверить тестом.
 * Вниз — прячем, вверх — показываем; пока в шапке фокус (поиск), она не прячется.
 */
export function nextHeaderState(prev: HeaderScrollState, y: number, focused: boolean): HeaderScrollState {
  if (focused || y <= HEADER_TOP_ZONE) return { hidden: false, lastY: y };
  const delta = y - prev.lastY;
  // Сдвиг меньше шага копится: lastY не трогаем, пока палец не уведёт страницу дальше
  if (Math.abs(delta) < HEADER_SCROLL_STEP) return prev;
  return { hidden: delta > 0, lastY: y };
}
