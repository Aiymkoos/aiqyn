const nf = new Intl.NumberFormat('ru-RU');
// Всюду ниже: не просто «n == null», а finite-проверка — NaN/Infinity (например, из арифметики
// над испорченным профилем: 'abc' - 50) не должны протекать в текст как буквальное "NaN ₸".
export const tenge = (n) => (Number.isFinite(n) ? `${nf.format(Math.round(n))} ₸` : '—');
export const tengeShort = (n) => {
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1).replace('.', ',')} млн ₸`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)} тыс. ₸`;
  return `${sign}${abs} ₸`;
};
export const num = (n) => (Number.isFinite(n) ? nf.format(n) : '—');
export const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
};
export const unis = (n) => (Number.isFinite(n) ? `${n} ${plural(n, 'вуз', 'вуза', 'вузов')}` : '—');
export const points = (n) => (Number.isFinite(n) ? `${n} ${plural(n, 'балл', 'балла', 'баллов')}` : '— баллов');
