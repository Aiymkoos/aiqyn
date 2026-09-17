const nf = new Intl.NumberFormat('ru-RU');
export const tenge = (n) => (n == null ? '—' : `${nf.format(Math.round(n))} ₸`);
export const tengeShort = (n) => {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1).replace('.', ',')} млн ₸`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} тыс. ₸`;
  return `${n} ₸`;
};
export const num = (n) => (n == null ? '—' : nf.format(n));
export const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
};
export const unis = (n) => `${n} ${plural(n, 'вуз', 'вуза', 'вузов')}`;
export const points = (n) => `${n} ${plural(n, 'балл', 'балла', 'баллов')}`;
