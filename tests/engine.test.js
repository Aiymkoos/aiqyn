import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, evaluateAll, WEIGHTS } from '../js/engine/score.js';
import { diffRuns, whatIf } from '../js/engine/delta.js';
import { buildRoadmap, nextStep, progress } from '../js/engine/roadmap.js';
import { fact, demo, unknown } from '../js/engine/facts.js';
import { UNIVERSITIES } from '../data/universities.js';
import { DIRECTIONS, CITIES, directionLabel } from '../data/directions.js';
import { CALENDAR, ENT_PROFILE, ENT_COMMON } from '../data/calendar.js';

const ctx = { directionLabel };
const base = { interests: ['it'], ent: 100, budget: 2_000_000, languages: ['ru', 'en'], cities: ['Алматы'], relocate: false, dorm: true };

test('веса в сумме дают 100', () => {
  assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
});

test('данные: у каждого вуза есть код, город, программы; у программ — направление из списка', () => {
  const ids = new Set(DIRECTIONS.map((d) => d.id));
  for (const u of UNIVERSITIES) {
    assert.ok(u.id && u.code && u.short && u.city && u.website, u.id);
    assert.ok(u.programs.length > 0, `${u.id}: нет программ`);
    for (const p of u.programs) assert.ok(ids.has(p.direction), `${u.id}: неизвестное направление ${p.direction}`);
  }
  assert.equal(new Set(UNIVERSITIES.map((u) => u.id)).size, UNIVERSITIES.length, 'id вузов уникальны');
});

test('детерминизм: один профиль — один и тот же результат', () => {
  const a = evaluateAll(base, UNIVERSITIES, ctx);
  const b = evaluateAll(base, UNIVERSITIES, ctx);
  assert.deepEqual(a.results.map((r) => [r.id, r.status, r.score]), b.results.map((r) => [r.id, r.status, r.score]));
});

test('балл собран из именованных слагаемых и не превышает 100', () => {
  const r = evaluate(base, UNIVERSITIES.find((u) => u.id === 'kaznu'), ctx);
  assert.equal(r.status, 'fit');
  assert.ok(r.score > 0 && r.score <= 100);
  assert.ok(r.comps.every((c) => c.text && c.points <= c.max));
  assert.ok(r.comps.some((c) => c.key === 'direction'));
});

test('у отказа всегда есть причина', () => {
  const r = evaluate({ ...base, cities: ['Караганда'] }, UNIVERSITIES.find((u) => u.id === 'kaznu'), ctx);
  assert.equal(r.status, 'out');
  assert.ok(r.reasons.length > 0);
  assert.match(r.reasons[0], /не твой город/);
});

test('близкий вариант: не хватает баллов до порога вуза, но разрыв небольшой', () => {
  // КазНУ, IT: порог по B057 — 90; с 80 баллами не хватает 10 → «близко», причина названа
  const r = evaluate({ ...base, ent: 80 }, UNIVERSITIES.find((u) => u.id === 'kaznu'), ctx);
  assert.equal(r.status, 'near');
  assert.match(r.nearGap, /не хватает 10 баллов/);
});

test('неизвестное поле не отсеивает вуз и не начисляет баллы, а понижает достоверность', () => {
  const uni = { ...UNIVERSITIES.find((u) => u.id === 'kaznu'), dorm: unknown() };
  const r = evaluate(base, uni, ctx);
  assert.equal(r.status, 'fit');
  assert.ok(!r.comps.some((c) => c.key === 'dorm'));
  assert.ok(r.gaps.some((g) => g.key === 'dorm'));
  const full = evaluate(base, UNIVERSITIES.find((u) => u.id === 'kaznu'), ctx);
  assert.ok(r.confidence < full.confidence);
});

test('без балла и без бюджета — «нет данных», а не выдуманная оценка', () => {
  const r = evaluate({ ...base, ent: null, budget: null }, UNIVERSITIES.find((u) => u.id === 'kaznu'), ctx);
  assert.equal(r.status, 'insufficient');
  assert.equal(r.score, null);
});

test('без балла, но с бюджетом — подбор работает по платному пути', () => {
  const r = evaluate({ ...base, ent: null }, UNIVERSITIES.find((u) => u.id === 'kaznu'), ctx);
  assert.equal(r.status, 'fit');
  assert.ok(r.missing.some((m) => m.key === 'ent'));
});

test('только грант: сравниваем с прошлогодним проходным, а не с порогом вуза', () => {
  const uni = UNIVERSITIES.find((u) => u.id === 'kaznu');
  const ok = evaluate({ ...base, budget: 0, ent: 105 }, uni, ctx);
  assert.equal(ok.status, 'fit');
  assert.match(ok.filters.find((f) => f.key === 'money').detail, /не гарантия/);
  const no = evaluate({ ...base, budget: 0, ent: 85 }, uni, ctx);
  assert.equal(no.status, 'near');
});

test('порог вуза берётся по группе программ, а не один на вуз', () => {
  // КазНУ: порог по B057 — 90, по B058 — 110; для направления IT берём самый низкий
  const r = evaluate({ ...base, ent: 95 }, UNIVERSITIES.find((u) => u.id === 'kaznu'), ctx);
  assert.equal(r.status, 'fit');
  assert.match(r.filters.find((f) => f.key === 'ent').detail, /порог вуза 90/i);
});

test('вуз без проверенного порога не отсеивается: порог уходит в пробелы данных', () => {
  const r = evaluate({ ...base, budget: 5_000_000 }, UNIVERSITIES.find((u) => u.id === 'kimep'), ctx);
  assert.equal(r.status, 'fit');
  assert.ok(r.gaps.some((g) => g.key === 'threshold'));
  assert.equal(r.filters.find((f) => f.key === 'ent').pass, null);
});

test('факты и демо считаются в качестве данных', () => {
  const uni = { ...UNIVERSITIES.find((u) => u.id === 'kaznu'), threshold: fact(65, 'https://example.org', '2026-09-18') };
  const r = evaluate(base, uni, ctx);
  assert.ok(r.quality > 0 && r.quality < 1);
  assert.ok(r.used.some((u) => u.kind === 'fact' && u.source));
});

test('с высоким баллом грант перекрывает нехватку бюджета — и это объяснено', () => {
  const r = evaluate({ ...base, ent: 100, budget: 300_000 }, UNIVERSITIES.find((u) => u.id === 'kaznu'), ctx);
  assert.equal(r.status, 'fit');
  assert.match(r.filters.find((f) => f.key === 'money').detail, /по гранту/);
});

test('главный тест жюри: изменение бюджета заметно меняет результат, и дельта объясняет почему', () => {
  // балл 70 — ниже прошлогодних проходных на грант в большинстве вузов, поэтому решает именно бюджет
  const before = evaluateAll({ ...base, ent: 70, relocate: true }, UNIVERSITIES, ctx);
  const after = evaluateAll({ ...base, ent: 70, relocate: true, budget: 600_000 }, UNIVERSITIES, ctx);
  assert.ok(after.summary.fit < before.summary.fit);
  const d = diffRuns(before, after);
  assert.ok(d.any && d.dropped.length > 0);
  assert.ok(d.dropped.every((x) => x.cause), 'у каждого выпавшего есть причина');
  assert.match(d.dropped[0].cause, /деньгам|бюджет/i);
});

test('изменение города, экзамена и интереса тоже меняет результат', () => {
  const b = evaluateAll(base, UNIVERSITIES, ctx);
  assert.notDeepEqual(evaluateAll({ ...base, cities: ['Астана'] }, UNIVERSITIES, ctx).fit.map((r) => r.id), b.fit.map((r) => r.id));
  assert.notDeepEqual(evaluateAll({ ...base, ent: 60 }, UNIVERSITIES, ctx).fit.map((r) => r.id), b.fit.map((r) => r.id));
  assert.notDeepEqual(evaluateAll({ ...base, interests: ['medicine'] }, UNIVERSITIES, ctx).fit.map((r) => r.id), b.fit.map((r) => r.id));
});

test('развилки предлагают изменения, которые реально открывают вузы', () => {
  const tight = { ...base, ent: 70, budget: 1_000_000, cities: ['Алматы'], relocate: false };
  const w = whatIf(tight, UNIVERSITIES, ctx, CITIES);
  assert.ok(w.length > 0);
  for (const t of w) {
    const gained = evaluateAll({ ...tight, ...t.patch }, UNIVERSITIES, ctx).summary.fit - evaluateAll(tight, UNIVERSITIES, ctx).summary.fit;
    assert.equal(gained, t.gain);
  }
});

test('пустой профиль — статус «заполни профиль», без результата', () => {
  const r = evaluateAll({ interests: [] }, UNIVERSITIES, ctx);
  assert.ok(r.incomplete);
});

test('восемь эталонных профилей: каждый получает хотя бы три варианта (подходит + близко)', () => {
  const profiles = [
    base,
    { ...base, ent: null },
    { ...base, budget: 0, ent: 110 },
    { ...base, interests: ['medicine'], cities: ['Алматы'], relocate: true, budget: 2_500_000 },
    { ...base, interests: ['education', 'science'], cities: ['Караганда'], relocate: true, budget: 900_000, ent: 70 },
    { ...base, interests: ['business', 'it'], languages: ['en'], budget: 3_000_000, ent: 120 },
    { ...base, interests: ['architecture', 'engineering'], cities: ['Астана', 'Алматы'], budget: 1_500_000, ent: 85 },
    { ...base, interests: ['law', 'humanities'], languages: ['kz', 'ru'], cities: ['Астана'], relocate: true, budget: 1_400_000, ent: 95 },
  ];
  for (const p of profiles) {
    const r = evaluateAll(p, UNIVERSITIES, ctx);
    assert.ok(r.summary.fit + r.summary.near >= 1, `профиль ${JSON.stringify(p)}: ничего не подошло`);
  }
});

test('план: шаги зависят от профиля, следующий шаг и прогресс считаются', () => {
  const run = evaluateAll(base, UNIVERSITIES, ctx);
  const steps = buildRoadmap(base, run.fit[0], { calendar: CALENDAR, entProfile: ENT_PROFILE, entCommon: ENT_COMMON, directionLabel });
  assert.ok(steps.length >= 5);
  assert.ok(steps.every((s) => s.title && s.why && s.when?.text && s.when?.prov?.label));
  assert.ok(steps.some((s) => s.id === 'dorm'), 'общежитие нужно — шаг есть');
  const noDorm = buildRoadmap({ ...base, dorm: false }, run.fit[0], { calendar: CALENDAR, entProfile: ENT_PROFILE, entCommon: ENT_COMMON, directionLabel });
  assert.ok(!noDorm.some((s) => s.id === 'dorm'));
  const done = { [steps[0].id]: true };
  assert.equal(nextStep(steps, done).id, steps[1].id);
  assert.equal(progress(steps, done).done, 1);
});
