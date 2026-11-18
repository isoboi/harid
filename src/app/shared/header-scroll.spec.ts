import { HEADER_SCROLL_STEP, HEADER_TOP_ZONE, nextHeaderState } from './header-scroll';

describe('nextHeaderState', () => {
  const shown = { hidden: false, lastY: 200 };
  const up = { hidden: true, lastY: 600 };

  it('прокрутка вниз прячет шапку', () => {
    expect(nextHeaderState(shown, 260, false)).toEqual({ hidden: true, lastY: 260 });
  });

  it('прокрутка вверх возвращает шапку', () => {
    expect(nextHeaderState(up, 500, false)).toEqual({ hidden: false, lastY: 500 });
  });

  it('мелкий сдвиг меньше шага ничего не меняет и копится', () => {
    const small = HEADER_SCROLL_STEP - 1;
    expect(nextHeaderState(shown, 200 + small, false)).toBe(shown);
    // два мелких сдвига подряд дают полный шаг от прежней точки
    expect(nextHeaderState(shown, 200 + small * 2, false).hidden).toBe(true);
  });

  it('наверху страницы шапка видна всегда', () => {
    expect(nextHeaderState(up, HEADER_TOP_ZONE, false)).toEqual({ hidden: false, lastY: HEADER_TOP_ZONE });
    expect(nextHeaderState(up, 0, false).hidden).toBe(false);
  });

  it('пока в шапке фокус (поиск), она не прячется', () => {
    expect(nextHeaderState(shown, 900, true)).toEqual({ hidden: false, lastY: 900 });
  });
});
