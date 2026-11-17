/** Русское склонение по числу: plural(2, ['лавка', 'лавки', 'лавок']) → «лавки». */
export const plural = (n: number, forms: [string, string, string]): string => {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b === 1) return forms[0];
  if (b >= 2 && b <= 4) return forms[1];
  return forms[2];
};
