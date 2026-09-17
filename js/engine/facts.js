// Каждое значение в данных хранится вместе с его происхождением.
// fact    — проверено: есть ссылка на источник и дата проверки
// demo    — демонстрационное значение, честно помечено
// unknown — данных нет; движок не отсеивает вуз и не начисляет баллы, а понижает достоверность
export const fact = (value, source, checked, note) => ({ kind: 'fact', value, source, checked, note });
export const demo = (value, note) => ({ kind: 'demo', value, note });
export const unknown = (note) => ({ kind: 'unknown', value: undefined, note });

export const known = (f) => !!f && f.kind !== 'unknown' && f.value !== undefined && f.value !== null;
export const val = (f) => (known(f) ? f.value : undefined);
export const isFact = (f) => !!f && f.kind === 'fact';
export const isDemo = (f) => !!f && f.kind === 'demo';

// Подпись происхождения для чипа в интерфейсе
export const provenance = (f) => {
  if (!f || f.kind === 'unknown') return { kind: 'unknown', label: 'нет данных' };
  if (f.kind === 'demo') return { kind: 'demo', label: 'демо' };
  return { kind: 'fact', label: 'проверено', source: f.source, checked: f.checked };
};
