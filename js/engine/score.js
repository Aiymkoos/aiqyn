// Детерминированный движок подбора. Не LLM: на один и тот же профиль всегда один и тот же
// ответ, каждый балл собран из именованных слагаемых, у каждого отказа есть причина и разрыв.
import { known, val, provenance } from './facts.js';
import { tengeShort, points as pts } from './format.js';

export const WEIGHTS = { direction: 35, money: 20, city: 15, ent: 15, language: 10, dorm: 5 };
export const LABELS = {
  direction: 'Направления', money: 'Деньги', city: 'Город', ent: 'Балл ЕНТ', language: 'Язык обучения', dorm: 'Общежитие',
};
export const STATUS = { fit: 'ПОДХОДИТ', near: 'БЛИЗКО', insufficient: 'НЕТ ДАННЫХ', out: 'НЕ ПРОХОДИТ', incomplete: 'ЗАПОЛНИ ПРОФИЛЬ' };

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const round = (x) => Math.round(x);
const LANG_NAMES = { kz: 'казахский', ru: 'русский', en: 'английский' };
const langs = (arr) => arr.map((l) => LANG_NAMES[l] ?? l).join(', ');

// Стоимость с учётом скидки вуза за балл ЕНТ
export function costFor(uni, program, ent) {
  const base = val(program.tuition);
  if (base == null) return { base: undefined, final: undefined, discount: null };
  let discount = null;
  if (ent != null && Array.isArray(uni.discounts)) {
    const best = uni.discounts.filter((d) => ent >= d.minEnt).sort((a, b) => b.percent - a.percent)[0];
    if (best) discount = best;
  }
  const final = discount ? Math.round(base * (1 - discount.percent / 100)) : base;
  return { base, final, discount };
}

export function evaluate(profile, uni, ctx) {
  const grants = ctx?.grants ?? {};
  const dirLabel = ctx?.directionLabel ?? ((id) => id);
  const filters = [];      // жёсткие фильтры: pass true/false/null (нельзя проверить)
  const comps = [];        // мягкие слагаемые балла
  const gaps = [];         // чего нет в данных о вузе
  const missing = [];      // чего не хватает в профиле
  const used = [];         // какие поля данных участвовали (для достоверности и чипов источников)
  const use = (f, key, label) => {
    used.push({ key, label, ...provenance(f) });
    if (!known(f)) gaps.push({ key, label });
    return known(f);
  };

  const interests = profile.interests ?? [];
  if (!interests.length) {
    return { id: uni.id, uni, status: 'incomplete', score: null, confidence: 0, filters, comps, gaps, missing: [{ key: 'interests', label: 'направления' }], used, grant: null, cost: null, reasons: [] };
  }

  // 1. Направления — жёсткий фильтр
  const programs = (uni.programs ?? []).filter((p) => interests.includes(p.direction));
  const covered = [...new Set(programs.map((p) => p.direction))];
  if (!programs.length) {
    const has = [...new Set((uni.programs ?? []).map((p) => dirLabel(p.direction)))];
    filters.push({ key: 'direction', pass: false, severity: 'out', detail: `Нет твоих направлений. Есть: ${has.slice(0, 3).join(', ')}${has.length > 3 ? '…' : ''}` });
  } else {
    filters.push({ key: 'direction', pass: true, detail: `${covered.map(dirLabel).join(', ')} — ${covered.length} из ${interests.length}` });
    comps.push({ key: 'direction', max: WEIGHTS.direction, points: round((WEIGHTS.direction * covered.length) / interests.length),
      text: `Совпали направления · ${covered.map(dirLabel).join(', ')} — ${covered.length} из ${interests.length}` });
  }

  // 2. Язык обучения
  const myLangs = profile.languages ?? [];
  if (myLangs.length) {
    if (use(uni.languages, 'languages', 'язык обучения')) {
      const inter = val(uni.languages).filter((l) => myLangs.includes(l));
      if (inter.length) {
        filters.push({ key: 'language', pass: true, detail: `Есть обучение: ${langs(inter)}` });
        comps.push({ key: 'language', max: WEIGHTS.language, points: round((WEIGHTS.language * inter.length) / myLangs.length),
          text: `Язык обучения · ${langs(inter)}` });
      } else {
        filters.push({ key: 'language', pass: false, severity: 'out', detail: `Обучение только на: ${langs(val(uni.languages))}, ты выбрал ${langs(myLangs)}` });
      }
    } else filters.push({ key: 'language', pass: null, detail: 'Язык обучения не проверен' });
  }

  // 3. Порог ЕНТ — у вуза он свой по каждой группе программ; берём самый низкий среди твоих направлений
  const ent = profile.ent ?? null;
  let thr = null;
  for (const p of programs) {
    const f = p.threshold ?? uni.threshold;
    if (known(f) && (thr == null || val(f) < thr.v)) thr = { v: val(f), f, p };
  }
  if (ent == null) {
    missing.push({ key: 'ent', label: 'балл ЕНТ' });
    filters.push({ key: 'ent', pass: null, detail: 'Без балла ЕНТ порог не проверить' });
  } else if (thr) {
    use(thr.f, 'threshold', `порог ЕНТ${thr.p.gop ? ` (${thr.p.gop})` : ''}`);
    const label = thr.p.gop ? `по группе ${thr.p.gop}` : '';
    if (ent >= thr.v) {
      filters.push({ key: 'ent', pass: true, detail: `Порог вуза ${thr.v}${label ? ` ${label}` : ''}, у тебя ${ent} — запас ${ent - thr.v}` });
      comps.push({ key: 'ent', max: WEIGHTS.ent, points: round(WEIGHTS.ent * (0.4 + 0.6 * clamp01((ent - thr.v) / 40))),
        text: `Запас по ЕНТ · порог ${thr.v}, у тебя ${ent}` });
    } else {
      const gap = thr.v - ent;
      filters.push({ key: 'ent', pass: false, severity: gap <= 15 ? 'near' : 'out', gap, detail: `Порог вуза ${thr.v}${label ? ` ${label}` : ''}, у тебя ${ent} — не хватает ${pts(gap)}` });
    }
  } else {
    gaps.push({ key: 'threshold', label: 'порог ЕНТ' });
    filters.push({ key: 'ent', pass: null, detail: 'Порог вуза не проверен' });
  }

  // 4. Деньги: платно (бюджет против стоимости со скидкой) или грант (балл против прошлогоднего проходного)
  const budget = profile.budget; // null — не знаю; 0 — только грант; число — ₸ в год
  let cost = null;
  const seenDir = new Set();
  for (const p of programs) {
    if (seenDir.has(p.direction)) continue; // стоимость одна на направление
    seenDir.add(p.direction);
    use(p.tuition, `tuition:${p.direction}`, `стоимость · ${dirLabel(p.direction)}`);
    const c = costFor(uni, p, ent);
    if (c.final != null && (cost == null || c.final < cost.final)) cost = { ...c, program: p };
  }
  let grant = null;
  let grantKnown = false;
  if (ent != null) {
    for (const p of programs) {
      const f = p.grantPass ?? (p.gop ? grants[p.gop]?.pass : null);
      if (!known(f)) continue;
      grantKnown = true;
      use(f, `grant:${p.gop}`, `проходной на грант · ${p.gop}`);
      const diff = ent - val(f);
      if (!grant || diff > grant.diff) grant = { gop: p.gop, name: p.name, pass: val(f), diff, program: p, prov: provenance(f) };
    }
    if (!grantKnown && programs.length) gaps.push({ key: 'grant', label: 'проходной на грант' });
  }
  const paidOk = budget != null && budget > 0 && cost != null && cost.final <= budget;
  const grantOk = grant != null && grant.diff >= 0;
  if (budget == null && !grant) {
    missing.push({ key: 'budget', label: 'бюджет' });
    filters.push({ key: 'money', pass: null, detail: 'Не знаем ни бюджета, ни шансов на грант' });
  } else if (budget === 0) {
    if (!grant) filters.push({ key: 'money', pass: null, detail: ent == null ? 'Только грант, а балла ЕНТ пока нет' : 'Прошлогодний проходной на грант по твоим группам в этом вузе неизвестен' });
    else if (grantOk) {
      filters.push({ key: 'money', pass: true, detail: `Грант: в 2025 сюда проходили с ${grant.pass} (${grant.gop}), у тебя ${ent} (+${grant.diff}). Ориентир, не гарантия` });
      comps.push({ key: 'money', max: WEIGHTS.money, points: round(WEIGHTS.money * (0.5 + 0.5 * clamp01(grant.diff / 20))),
        text: `Шанс на грант · выше прошлогоднего проходного на ${grant.diff}` });
    } else {
      const gap = -grant.diff;
      filters.push({ key: 'money', pass: false, severity: gap <= 10 ? 'near' : 'out', gap, detail: `Только грант: в 2025 сюда проходили с ${grant.pass} (${grant.gop}), у тебя ${ent} — не хватает ${pts(gap)}` });
    }
  } else if (budget != null) {
    if (cost == null && !grant) filters.push({ key: 'money', pass: null, detail: 'Стоимость обучения не проверена' });
    else if (paidOk) {
      const margin = clamp01((budget - cost.final) / budget);
      const d = cost.discount ? ` со скидкой ${cost.discount.percent}%` : '';
      filters.push({ key: 'money', pass: true, detail: `Платно${d}: от ${tengeShort(cost.final)} в год при бюджете ${tengeShort(budget)}` });
      comps.push({ key: 'money', max: WEIGHTS.money, points: round(WEIGHTS.money * (0.5 + 0.5 * margin)),
        text: `Запас по бюджету · от ${tengeShort(cost.final)}${d} из ${tengeShort(budget)}` });
    } else if (grantOk) {
      filters.push({ key: 'money', pass: true, detail: `Платно дорого (${cost ? `от ${tengeShort(cost.final)}` : 'стоимость неизвестна'}), но по гранту проходил бы: в 2025 сюда проходили с ${grant.pass} (${grant.gop}), у тебя ${ent}` });
      comps.push({ key: 'money', max: WEIGHTS.money, points: round(WEIGHTS.money * (0.3 + 0.5 * clamp01(grant.diff / 20))),
        text: `Только через грант · выше прошлогоднего проходного на ${grant.diff}` });
    } else {
      const moneyGap = cost ? cost.final - budget : null;
      const nearMoney = moneyGap != null && moneyGap <= cost.final * 0.25;
      const nearGrant = grant && grant.diff >= -10;
      const parts = [];
      if (cost) parts.push(`платно от ${tengeShort(cost.final)}, твой бюджет ${tengeShort(budget)}`);
      if (grant) parts.push(`на грант в 2025 сюда проходили с ${grant.pass}, у тебя ${ent}`);
      filters.push({ key: 'money', pass: false, severity: nearMoney || nearGrant ? 'near' : 'out', gap: moneyGap, detail: `Не проходит по деньгам: ${parts.join('; ')}` });
    }
  }

  // 5. Город
  const cities = profile.cities ?? [];
  if (cities.length) {
    if (cities.includes(uni.city)) {
      filters.push({ key: 'city', pass: true, detail: `${uni.city} — твой город` });
      comps.push({ key: 'city', max: WEIGHTS.city, points: WEIGHTS.city, text: `Город · ${uni.city}` });
    } else if (profile.relocate) {
      filters.push({ key: 'city', pass: true, detail: `${uni.city} — не из твоего списка, но ты готов переехать` });
      comps.push({ key: 'city', max: WEIGHTS.city, points: round(WEIGHTS.city / 2), text: `Город · ${uni.city}, переезд` });
    } else {
      filters.push({ key: 'city', pass: false, severity: 'out', detail: `${uni.city} — не твой город, а переезд ты не рассматриваешь` });
    }
  }

  // 6. Общежитие — только мягкое слагаемое
  if (profile.dorm === true) {
    if (use(uni.dorm, 'dorm', 'общежитие')) {
      comps.push({ key: 'dorm', max: WEIGHTS.dorm, points: val(uni.dorm) ? WEIGHTS.dorm : 0,
        text: val(uni.dorm) ? 'Общежитие · есть' : 'Общежитие · нет, придётся снимать' });
    }
  }

  // Итог
  const outs = filters.filter((f) => f.pass === false && f.severity === 'out');
  const nears = filters.filter((f) => f.pass === false && f.severity === 'near');
  const nulls = filters.filter((f) => f.pass === null).map((f) => f.key);
  const applicable = comps.reduce((s, c) => s + c.max, 0);
  let status;
  if (outs.length) status = 'out';
  else if (nears.length) status = 'near';
  else if ((nulls.includes('money') && nulls.includes('ent')) || applicable < 50) status = 'insufficient';
  else status = 'fit';

  const score = status === 'fit' || status === 'near' ? round((comps.reduce((s, c) => s + c.points, 0) / applicable) * 100) : null;
  const facts = used.filter((u) => u.kind === 'fact').length;
  const demos = used.filter((u) => u.kind === 'demo').length;
  // пробелы в данных тоже снижают качество: неизвестное поле — это не «ничего», а минус к достоверности
  const quality = facts + demos + gaps.length ? facts / (facts + demos + gaps.length) : 0;
  const confidence = round(applicable * (0.6 + 0.4 * quality));
  const reasons = [...outs, ...nears].map((f) => f.detail);

  return { id: uni.id, uni, status, score, confidence, quality, applicable, filters, comps, gaps, missing, used, grant, cost, reasons,
    nearGap: nears[0] ? nears[0].detail : null };
}

export function evaluateAll(profile, universities, ctx) {
  const results = universities.map((u) => evaluate(profile, u, ctx));
  const byStatus = (s) => results.filter((r) => r.status === s);
  const fit = byStatus('fit').sort((a, b) => b.score - a.score || a.uni.short.localeCompare(b.uni.short));
  const near = byStatus('near').sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const insufficient = byStatus('insufficient');
  const out = byStatus('out');
  const ranked = [...fit, ...near, ...insufficient, ...out];
  ranked.forEach((r, i) => { r.rank = i + 1; });
  return {
    results: ranked, fit, near, insufficient, out,
    incomplete: results.some((r) => r.status === 'incomplete'),
    summary: { total: results.length, fit: fit.length, near: near.length, insufficient: insufficient.length, out: out.length },
  };
}
