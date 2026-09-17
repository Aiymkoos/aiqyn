// Дельта между двумя прогонами («маршрут перестроен») и развилки «что если».
import { evaluateAll } from './score.js';
import { tengeShort, unis } from './format.js';

const ORDER = { fit: 0, near: 1, insufficient: 2, out: 3 };

// Что изменилось между prev и next: кто выпал, кто добавился, кто передвинулся — и почему.
export function diffRuns(prev, next) {
  if (!prev) return null;
  const before = new Map(prev.results.map((r) => [r.id, r]));
  const changes = [];
  for (const r of next.results) {
    const b = before.get(r.id);
    if (!b) continue;
    const worse = ORDER[r.status] > ORDER[b.status];
    const better = ORDER[r.status] < ORDER[b.status];
    if (worse || better) {
      // фильтр, который изменил решение
      const cause = r.filters.find((f) => {
        const bf = b.filters.find((x) => x.key === f.key);
        return bf && bf.pass !== f.pass;
      }) ?? (better ? b.filters.find((f) => f.pass === false) : r.filters.find((f) => f.pass === false));
      changes.push({
        id: r.id, short: r.uni.short, kind: worse ? 'dropped' : 'added', from: b.status, to: r.status,
        cause: cause ? cause.detail : null,
      });
    } else if (r.status === 'fit' && b.status === 'fit' && r.rank !== b.rank) {
      changes.push({ id: r.id, short: r.uni.short, kind: r.rank < b.rank ? 'up' : 'down', from: b.rank, to: r.rank, score: r.score, prevScore: b.score });
    }
  }
  const dropped = changes.filter((c) => c.kind === 'dropped');
  const added = changes.filter((c) => c.kind === 'added');
  const moved = changes.filter((c) => c.kind === 'up' || c.kind === 'down');
  return { dropped, added, moved, any: changes.length > 0, fitBefore: prev.summary.fit, fitAfter: next.summary.fit };
}

// Развилки: какое одно изменение в профиле открыло бы больше всего вузов.
export function whatIf(profile, universities, ctx, cities = []) {
  const base = evaluateAll(profile, universities, ctx).summary.fit;
  const tries = [];
  if (profile.ent != null) {
    for (const d of [5, 10, 15]) tries.push({ key: `ent+${d}`, label: `ЕНТ +${d} (до ${profile.ent + d})`, patch: { ent: profile.ent + d } });
  }
  if (profile.budget != null && profile.budget > 0) {
    for (const d of [300_000, 600_000]) tries.push({ key: `budget+${d}`, label: `Бюджет +${tengeShort(d)}`, patch: { budget: profile.budget + d } });
  }
  if (profile.cities?.length && !profile.relocate) {
    tries.push({ key: 'relocate', label: 'Готов переехать в другой город', patch: { relocate: true } });
    for (const c of cities.filter((c) => !profile.cities.includes(c)).slice(0, 4)) {
      tries.push({ key: `city:${c}`, label: `+ ${c}`, patch: { cities: [...profile.cities, c] } });
    }
  }
  if ((profile.languages?.length ?? 0) === 1) {
    for (const l of ['kz', 'ru', 'en'].filter((l) => !profile.languages.includes(l))) {
      const names = { kz: 'казахском', ru: 'русском', en: 'английском' };
      tries.push({ key: `lang:${l}`, label: `Учиться и на ${names[l]}`, patch: { languages: [...profile.languages, l] } });
    }
  }
  const scored = tries
    .map((t) => ({ ...t, family: t.key.split(/[+:]/)[0], gain: evaluateAll({ ...profile, ...t.patch }, universities, ctx).summary.fit - base }))
    .filter((t) => t.gain > 0);
  // в семье (ЕНТ, бюджет, город…) оставляем самое маленькое изменение для каждого уровня выигрыша,
  // а потом берём по одной лучшей развилке на семью — так список не повторяется
  const best = new Map();
  for (const t of scored) {
    const cur = best.get(t.family);
    if (!cur || t.gain > cur.gain) best.set(t.family, t);
  }
  return [...best.values()]
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 3)
    .map((t) => ({ ...t, text: `${t.label} → ещё ${unis(t.gain)}` }));
}
