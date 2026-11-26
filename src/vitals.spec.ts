import { parseVital, parseVitals, VITALS_MAX_BATCH, VitalReport } from './vitals';

const ok = (over: Partial<Record<keyof VitalReport, unknown>> = {}) => ({
  name: 'LCP', value: 2400, rating: 'good', nav: 'navigate', route: 'product/:id', net: '4g', device: 'mobile', id: 'v5-1700000000000-123', ...over,
});

describe('parseVitals: что принимает POST /vitals', () => {
  it('пачка метрик по форме — как есть', () => {
    const cls = ok({ name: 'CLS', value: 0.0123, id: 'v5-2' });
    expect(parseVitals(JSON.stringify([ok(), cls]))).toEqual([ok(), cls]);
  });

  it('лишние поля не попадают в лог', () => {
    expect(parseVital({ ...ok(), url: '/order/R-123456?phone=931234567', user: 'x' })).toEqual(ok());
  });

  it('главная (пустой маршрут), «не найдено» и браузер без типа сети — допустимы', () => {
    expect(parseVital(ok({ route: '' }))).not.toBeNull();
    expect(parseVital(ok({ route: '**' }))).not.toBeNull();
    expect(parseVital(ok({ net: '' }))).not.toBeNull();
  });

  it.each([
    ['неизвестная метрика', { name: 'FID' }],
    ['не число', { value: '2400' }],
    ['NaN', { value: Number.NaN }],
    ['отрицательное', { value: -1 }],
    ['невозможно большое', { value: 10 * 60_000 }],
    ['CLS больше 100', { name: 'CLS', value: 101 }],
    ['неизвестная оценка', { rating: 'bad' }],
    ['адрес с параметрами вместо шаблона', { route: 'search?q=платье' }],
    ['слишком длинный маршрут', { route: 'a'.repeat(61) }],
    ['неизвестная сеть', { net: '5g' }],
    ['неизвестное устройство', { device: 'tv' }],
    ['id с пробелами', { id: 'a b' }],
    ['nav не строка', { nav: 1 }],
  ])('отклоняет: %s', (_, over) => {
    expect(parseVital(ok(over))).toBeNull();
    expect(parseVitals(JSON.stringify([ok(), ok(over)]))).toBeNull();
  });

  it.each([
    ['не JSON', '{oops'],
    ['не массив', JSON.stringify(ok())],
    ['пустой массив', '[]'],
    ['пустое тело', ''],
    ['слишком много', JSON.stringify(Array.from({ length: VITALS_MAX_BATCH + 1 }, (_, i) => ok({ id: `v${i}` })))],
  ])('запрос целиком не по форме: %s', (_, body) => {
    expect(parseVitals(body)).toBeNull();
  });

  it('тело не строкой (express не разобрал как text/plain) — отклоняется', () => {
    expect(parseVitals({})).toBeNull();
    expect(parseVitals(undefined)).toBeNull();
  });
});
