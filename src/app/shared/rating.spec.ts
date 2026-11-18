import { ratingLabel, ratingNumber, reviewsCount } from './rating';

describe('рейтинг и отзывы', () => {
  it('оценка с десятичной запятой и одним знаком', () => {
    expect(ratingNumber(4.8)).toBe('4,8');
    expect(ratingNumber(5)).toBe('5,0');
    expect(ratingNumber(4.666)).toBe('4,7');
  });
  it.each([
    [1, '1 отзыв'], [2, '2 отзыва'], [4, '4 отзыва'], [5, '5 отзывов'], [11, '11 отзывов'],
    [12, '12 отзывов'], [14, '14 отзывов'], [21, '21 отзыв'], [22, '22 отзыва'], [111, '111 отзывов'],
  ])('%i → «%s»', (n, text) => expect(reviewsCount(n)).toBe(text));
  it('подпись «4,8 · 12 отзывов»', () => {
    expect(ratingLabel(4.8, 12)).toBe('4,8 · 12 отзывов');
    expect(ratingLabel(5, 1)).toBe('5,0 · 1 отзыв');
    expect(ratingLabel(4.25, 3)).toBe('4,3 · 3 отзыва');
  });
  it('без отзывов — пусто, даже если оценка есть', () => {
    expect(ratingLabel(4.8, 0)).toBe('');
    expect(ratingLabel(null, 0)).toBe('');
    expect(ratingLabel(undefined, undefined)).toBe('');
  });
  it('оценки нет, а отзывы есть — только число отзывов', () => {
    expect(ratingLabel(null, 2)).toBe('2 отзыва');
  });
});
