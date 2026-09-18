// Экраны 4–7: табло вузов (с пультом и карточкой вуза), сравнение, план, ближайший шаг + источники, ошибки
import { esc, $, $$, provChip, statusChip, layersBar, legend, funnel, ring, toast, openSheet, closeSheet } from './bits.js';
import { boardHTML, updateBoard } from './board.js';
import { postcard } from './postcard.js';
import { bindGo } from './screens-flow.js';
import { tengeShort, unis, points } from '../engine/format.js';
import { diffRuns, whatIf } from '../engine/delta.js';
import { buildRoadmap, nextStep, progress } from '../engine/roadmap.js';
import { STATUS, LABELS } from '../engine/score.js';
import { val, provenance } from '../engine/facts.js';
import { getProfile, update, encodeProfile, firstUnanswered } from '../state.js';
import { directionLabel, langLabel } from '../../data/directions.js';

const TYPE = { national: 'национальный', state: 'государственный', private: 'частный', international: 'международный', autonomous: 'автономный' };
const footHTML = (s) => `<span>рассмотрено <b>${s.total}</b></span><span>подходят <b>${s.fit}</b></span><span>близко <b>${s.near}</b></span><span>нет данных <b>${s.insufficient}</b></span><span>не проходят <b>${s.out}</b></span>`;

/* взлётная полоса: каждый подходящий и близкий вуз — маркер на шкале балла */
const LANES = [['fit', 'подходят'], ['near', 'близко']];
// шкала полосы: 40–100, ниже 40 подходящих почти не бывает; маркеры чередуют высоту, чтобы не слипаться
const runX = (score) => Math.max(0, Math.min(100, ((score - 40) / 60) * 100));
const ROWS = ['', 'lo', 'mid'];
const planeHTML = (r, k, i = 0) => `<button class="plane ${k} landing ${ROWS[i % 3]}" data-plane="${r.id}" data-label="${esc(r.uni.short)}" style="left:${runX(r.score)}%; animation-delay:${i * 70}ms" title="${esc(r.uni.short)} · ${r.score}" aria-label="${esc(r.uni.short)}, балл ${r.score}"><b>${r.score}</b></button>`;
function runwayHTML(run) {
  return `<div class="runway" aria-label="Вузы по баллу подбора">
    <div class="axis"><span>40</span><span style="left:${runX(60)}%">60</span><span style="left:${runX(80)}%">80</span><span style="left:100%">100</span></div>
    ${LANES.map(([k, label]) => `<div class="lane ${k} ${run[k].length > 3 ? 'dense' : ''}" data-lane="${k}"><span class="tag" data-tag>${label} · ${run[k].length}</span>${run[k].map((r, i) => planeHTML(r, k, i)).join('')}</div>`).join('')}
  </div>`;
}
function updateRunway(el, run) {
  const existing = new Map($$('.plane', el).map((x) => [x.dataset.plane, x]));
  for (const [k, label] of LANES) {
    const lane = $(`[data-lane="${k}"]`, el);
    $('[data-tag]', lane).textContent = `${label} · ${run[k].length}`;
    lane.classList.toggle('dense', run[k].length > 3);
    run[k].forEach((r, i) => {
      let pl = existing.get(r.id);
      if (!pl) { const t = document.createElement('div'); t.innerHTML = planeHTML(r, k, i); pl = t.firstElementChild; lane.appendChild(pl); }
      else { pl.className = `plane ${k} ${ROWS[i % 3]}`; if (pl.parentElement !== lane) lane.appendChild(pl); pl.style.left = `${runX(r.score)}%`; pl.querySelector('b').textContent = r.score; pl.title = `${r.uni.short} · ${r.score}`; }
      existing.delete(r.id);
    });
  }
  for (const pl of existing.values()) { pl.style.opacity = '0'; setTimeout(() => pl.remove(), 400); }
}

/* ---------- 4. Табло ---------- */
export function board(root, ctx) {
  let run = ctx.compute(getProfile());
  const p = getProfile();
  root.innerHTML = `<section class="boardscreen">
    <div class="top"><div><span class="eyebrow">Этап 4 · Рекомендации</span><h2 class="display h2">Табло вылетов</h2></div>
      <p class="small">Маркеры на полосе — вузы по баллу. Талон открывается по нажатию: из чего собран балл и где источник каждой цифры.</p></div>
    <div data-runway>${runwayHTML({ fit: [], near: [] })}</div>
    <div data-above></div>
    <div data-board>${boardHTML([], { skeleton: true })}</div>
    <div data-below></div>
    <div class="bottom-nav"><button class="btn amber" data-go="#/compare">Сравнить два варианта</button><button class="btn ghost" data-go="#/plan">К плану</button></div>
  </section>
  <button class="fab" data-panel aria-label="Открыть пульт: изменить ответы">⚙︎ Пульт</button>`;
  bindGo(root);

  const boardEl = $('[data-board]', root);
  const runwayEl = $('[data-runway]', root);
  const below = $('[data-below]', root);
  const above = $('[data-above]', root);
  const marquee = (r) => `DEPARTURES · ${r.summary.total} ВУЗА · ПОДХОДЯТ ${r.summary.fit} · БЛИЗКО ${r.summary.near} · НАЖМИ НА ТАЛОН, ЧТОБЫ УВИДЕТЬ ПОЧЕМУ · `;
  const bindPlanes = () => $$('.plane', runwayEl).forEach((pl) => (pl.onclick = () => openDetail(run.results.find((r) => r.id === pl.dataset.plane), ctx, () => recompute('Изменил цель'))));
  const renderBelow = () => {
    const forks = whatIf(getProfile(), ctx.universities, ctx, ctx.cities);
    const fitOrNear = run.summary.fit + run.summary.near;
    let html = '';
    if (run.summary.fit === 0) {
      const pr = getProfile();
      const hints = [];
      if (pr.ent == null) hints.push('добавь балл ЕНТ — без него мы не проверяем пороги и шансы на грант');
      if (pr.budget == null) hints.push('укажи бюджет или «только грант»');
      if (pr.ent == null && pr.budget === 0) hints.push('при «только грант» балл обязателен: сравнивать с прошлогодним проходным нечего');
      const tail = forks.length ? 'Ниже — какое одно изменение открыло бы вузы.' : hints.length ? `Что поможет: ${hints.join('; ')}. Всё это можно поменять в пульте.` : 'Попробуй расширить города или языки в пульте.';
      html += `<div class="card empty"><h3 class="display h3">${run.summary.near ? 'Точных совпадений нет, но есть близкие' : 'Ничего не подошло'}</h3><p class="muted">${run.summary.near ? `У близких вариантов указано, чего именно не хватает. ${tail}` : `Это честный результат, а не ошибка. ${tail}`}</p></div>`;
    } else if (run.summary.fit < 3) {
      html += `<p class="small muted">Подходящих меньше трёх — добавили близкие варианты с указанием, чего не хватает.</p>`;
    }
    if (forks.length) html += `<div><span class="eyebrow">Развилки · что если</span><div class="forks" style="margin-top:8px">${forks.map((f) => `<button class="fork" data-fork="${f.key}"><span>${esc(f.label)}</span><span class="g">+${unis(f.gain)} →</span></button>`).join('')}</div></div>`;
    // если подходящих нет — объяснение и развилки показываем над списком, а не после 22 талонов «мимо»
    const target = run.summary.fit === 0 ? above : below;
    (target === above ? below : above).innerHTML = '';
    target.innerHTML = html;
    $$('[data-fork]', target).forEach((b) => (b.onclick = () => {
      const f = forks.find((x) => x.key === b.dataset.fork);
      if (!f) return;
      const answered = { ...getProfile().answered };
      if (f.patch.ent != null) answered.ent = true;
      if (f.patch.budget != null) answered.budget = true;
      update({ ...f.patch, answered });
      recompute(`Развилка: ${f.label}`);
    }));
  };
  const recompute = (why) => {
    const prev = run;
    run = ctx.compute(getProfile());
    updateBoard($('.board', boardEl), run.results, { foot: footHTML(run.summary) });
    const mq = $('.marquee', boardEl); mq.textContent = marquee(run); mq.dataset.text = marquee(run);
    updateRunway(runwayEl, run);
    bindPlanes();
    renderBelow();
    const d = diffRuns(prev, run);
    if (d?.any) showDelta(d, why);
    else toast(`<div class="t">Маршрут проверен</div><ul><li>${esc(why)} — состав табло не изменился</li></ul>`, 2600);
    ctx.renderPass();
  };

  // загрузка: табло «прогревается», строки перещёлкиваются из скелета
  setTimeout(() => {
    boardEl.innerHTML = boardHTML(run.results, { foot: footHTML(run.summary), marquee: marquee(run) });
    runwayEl.innerHTML = runwayHTML(run);
    bindPlanes();
    renderBelow();
    $$('.brow[data-id]', boardEl).forEach((row) => (row.onclick = () => openDetail(run.results.find((r) => r.id === row.dataset.id), ctx, () => recompute('Изменил цель'))));
  }, 650);

  $('[data-panel]', root).onclick = () => openPanel(ctx, recompute);
}

function showDelta(d, why) {
  const items = [];
  for (const x of d.dropped) items.push(`<li class="down">↓ <b>${esc(x.short)}</b> — ${STATUS[x.to].toLowerCase()}${x.cause ? `: ${esc(x.cause)}` : ''}</li>`);
  for (const x of d.added) items.push(`<li class="up">↑ <b>${esc(x.short)}</b> — теперь ${STATUS[x.to].toLowerCase()}${x.cause ? ` (${esc(x.cause)})` : ''}</li>`);
  for (const x of d.moved.slice(0, 3)) items.push(`<li>${x.kind === 'up' ? '↑' : '↓'} <b>${esc(x.short)}</b> — с ${x.from}-го на ${x.to}-е место (${x.prevScore} → ${x.score})</li>`);
  toast(`<div class="t">Маршрут перестроен</div><div class="small" style="opacity:.8">${esc(why)} · подходят: ${d.fitBefore} → ${d.fitAfter}</div><ul>${items.slice(0, 5).join('')}</ul>`, 7000);
}

/* пульт — быстрое изменение ключевых ответов */
function openPanel(ctx, recompute) {
  const p = getProfile();
  const bmode = p.budget === 0 ? 'grant' : p.budget == null ? 'unknown' : 'paid';
  const bval = p.budget && p.budget > 0 ? p.budget : 1_500_000;
  openSheet(`<div class="panel">
    <div class="row between"><h3 class="display h3">Пульт</h3><button class="btn quiet sm" data-close-sheet>Готово</button></div>
    <p class="small muted">Меняй — табло перестроится сразу и объяснит, что изменилось.</p>
    <div class="ctl"><div class="k"><span>ЕНТ</span><b data-pv-ent>${p.ent ?? 'пока нет'}</b></div>
      <input class="slider" type="range" min="40" max="140" step="1" value="${p.ent ?? 90}" data-p-ent style="--fill:${(((p.ent ?? 90) - 40) / 100) * 100}%">
      <button class="chip" data-p-ent-unknown aria-pressed="${p.ent == null}">Пока не знаю</button></div>
    <div class="ctl"><div class="k"><span>Бюджет в год</span><b data-pv-budget>${bmode === 'grant' ? 'только грант' : bmode === 'unknown' ? 'не знаю' : tengeShort(bval)}</b></div>
      <div class="seg"><button data-p-bmode="paid" aria-pressed="${bmode === 'paid'}">Платно</button><button data-p-bmode="grant" aria-pressed="${bmode === 'grant'}">Только грант</button><button data-p-bmode="unknown" aria-pressed="${bmode === 'unknown'}">Не знаю</button></div>
      <input class="slider" type="range" min="300000" max="5000000" step="100000" value="${bval}" data-p-budget ${bmode === 'paid' ? '' : 'hidden'} style="--fill:${((bval - 300000) / 4700000) * 100}%"></div>
    <div class="ctl"><div class="k"><span>Направления</span></div><div class="chips">${ctx.directions.map((d) => `<button class="chip" data-p-dir="${d.id}" aria-pressed="${p.interests.includes(d.id)}">${d.label}</button>`).join('')}</div></div>
    <div class="ctl"><div class="k"><span>Города</span></div><div class="chips">${ctx.cities.map((c) => `<button class="chip" data-p-city="${c}" aria-pressed="${p.cities.includes(c)}">${c}</button>`).join('')}<button class="chip" data-p-relocate aria-pressed="${p.relocate}">Готов переехать</button></div></div>
    <div class="ctl"><div class="k"><span>Язык</span></div><div class="chips">${ctx.langs.map((l) => `<button class="chip" data-p-lang="${l.id}" aria-pressed="${p.languages.includes(l.id)}">${l.label}</button>`).join('')}</div></div>
    <div class="ctl"><div class="k"><span>Общежитие</span></div><div class="seg"><button data-p-dorm="true" aria-pressed="${p.dorm === true}">Нужно</button><button data-p-dorm="false" aria-pressed="${p.dorm === false}">Не нужно</button><button data-p-dorm="null" aria-pressed="${p.dorm === null}">Не важно</button></div></div>
  </div>`);
  const sheet = $('#sheet-body');
  const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const entS = $('[data-p-ent]', sheet);
  const applyEnt = debounce((v) => { update({ ent: v, answered: { ...getProfile().answered, ent: true } }); recompute(`ЕНТ ${v}`); }, 260);
  entS.oninput = () => { const v = Number(entS.value); entS.style.setProperty('--fill', `${((v - 40) / 100) * 100}%`); $('[data-pv-ent]', sheet).textContent = v; $('[data-p-ent-unknown]', sheet).setAttribute('aria-pressed', 'false'); applyEnt(v); };
  $('[data-p-ent-unknown]', sheet).onclick = () => { $('[data-pv-ent]', sheet).textContent = 'пока нет'; $('[data-p-ent-unknown]', sheet).setAttribute('aria-pressed', 'true'); update({ ent: null, answered: { ...getProfile().answered, ent: true } }); recompute('ЕНТ: пока нет'); };
  const bS = $('[data-p-budget]', sheet);
  const applyBudget = debounce((v) => { update({ budget: v, answered: { ...getProfile().answered, budget: true } }); recompute(`Бюджет ${tengeShort(v)}`); }, 260);
  bS.oninput = () => { const v = Number(bS.value); bS.style.setProperty('--fill', `${((v - 300000) / 4700000) * 100}%`); $('[data-pv-budget]', sheet).textContent = tengeShort(v); applyBudget(v); };
  $$('[data-p-bmode]', sheet).forEach((b) => (b.onclick = () => {
    const m = b.dataset.pBmode;
    $$('[data-p-bmode]', sheet).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    bS.hidden = m !== 'paid';
    const budget = m === 'grant' ? 0 : m === 'unknown' ? null : Number(bS.value);
    $('[data-pv-budget]', sheet).textContent = m === 'grant' ? 'только грант' : m === 'unknown' ? 'не знаю' : tengeShort(budget);
    update({ budget, answered: { ...getProfile().answered, budget: true } });
    recompute(m === 'grant' ? 'Только грант' : m === 'unknown' ? 'Бюджет: не знаю' : `Бюджет ${tengeShort(budget)}`);
  }));
  $$('[data-p-dir]', sheet).forEach((b) => (b.onclick = () => {
    const interests = toggleIn(getProfile().interests, b.dataset.pDir);
    if (!interests.length) { toast('<div class="t">Нужно хотя бы одно направление</div>', 2000); return; }
    b.setAttribute('aria-pressed', String(interests.includes(b.dataset.pDir)));
    update({ interests }); recompute(`Направления: ${interests.map(directionLabel).join(', ')}`);
  }));
  $$('[data-p-city]', sheet).forEach((b) => (b.onclick = () => {
    const cities = toggleIn(getProfile().cities, b.dataset.pCity);
    b.setAttribute('aria-pressed', String(cities.includes(b.dataset.pCity)));
    update({ cities, answered: { ...getProfile().answered, cities: true } }); recompute(cities.length ? `Города: ${cities.join(', ')}` : 'Город: любой');
  }));
  $('[data-p-relocate]', sheet).onclick = (e) => { const relocate = !getProfile().relocate; e.currentTarget.setAttribute('aria-pressed', String(relocate)); update({ relocate }); recompute(relocate ? 'Готов переехать' : 'Без переезда'); };
  $$('[data-p-lang]', sheet).forEach((b) => (b.onclick = () => {
    const languages = toggleIn(getProfile().languages, b.dataset.pLang);
    b.setAttribute('aria-pressed', String(languages.includes(b.dataset.pLang)));
    update({ languages, answered: { ...getProfile().answered, languages: true } }); recompute(languages.length ? `Язык: ${languages.map(langLabel).join(', ')}` : 'Язык: любой');
  }));
  $$('[data-p-dorm]', sheet).forEach((b) => (b.onclick = () => {
    const v = b.dataset.pDorm === 'true' ? true : b.dataset.pDorm === 'false' ? false : null;
    $$('[data-p-dorm]', sheet).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    update({ dorm: v, answered: { ...getProfile().answered, dorm: true } }); recompute(v === true ? 'Нужно общежитие' : v === false ? 'Общежитие не нужно' : 'Общежитие не важно');
  }));
}

/* карточка вуза */
export function openDetail(r, ctx, onTarget) {
  if (!r) return;
  const p = getProfile();
  const u = r.uni;
  const inCompare = p.compare.includes(u.id);
  const isTarget = p.target === u.id;
  const src = r.used.filter((x) => x.kind !== 'unknown');
  const grantBlock = r.grant ? `<div class="card paper"><span class="eyebrow">Грант · ${esc(r.grant.name)} (${r.grant.gop})</span>
      <p style="margin-top:6px">В прошлом году проходили с <b>${r.grant.pass}</b>, у тебя <b>${p.ent}</b> — ${r.grant.diff >= 0 ? `выше на ${r.grant.diff}` : `не хватает ${points(-r.grant.diff)}`}. <span class="muted">Это ориентир по прошлому конкурсу, не гарантия.</span> ${provChip(r.grant.prov, { short: true })}</p></div>` : (p.ent == null ? `<div class="card hatched"><span class="eyebrow">Грант</span><p class="small" style="margin-top:6px">Добавь балл ЕНТ — сравним с прошлогодним проходным по группе программ.</p></div>` : '');
  const costBlock = r.cost ? `<dl class="kv"><dt>Стоимость «${esc(r.cost.program.name)}»</dt><dd>${tengeShort(r.cost.base)} ${provChip(provenance(r.cost.program.tuition), { short: true })}</dd>
      ${r.cost.discount ? `<dt>Скидка за балл ${r.cost.discount.minEnt}+</dt><dd>−${r.cost.discount.percent}% → <b>${tengeShort(r.cost.final)}</b></dd>` : ''}
      ${p.budget ? `<dt>Твой бюджет</dt><dd>${tengeShort(p.budget)}</dd>` : ''}</dl>` : '';
  openSheet(`<div class="detail">
    ${postcard(u)}
    <div class="head">${r.score != null ? ring(r.score) : `<span class="status ${r.status}" style="font-size:18px">${STATUS[r.status]}</span>`}<div><h3 class="display h3">${esc(u.short)}</h3><div class="small muted">${esc(u.name)}</div><div class="row small" style="margin-top:6px"><span class="pill">${esc(u.city)}</span><span class="pill">${TYPE[u.type] ?? ''}</span>${r.score != null ? statusChip(r.status) : ''}</div></div></div>
    ${r.status === 'out' ? `<div class="card paper"><span class="eyebrow">Почему не проходит</span><ul class="stack" style="margin-top:6px">${r.reasons.map((x) => `<li>✕ ${esc(x)}</li>`).join('')}</ul></div>` : ''}
    ${r.status === 'near' ? `<div class="card paper"><span class="eyebrow">Чего не хватает</span><ul class="stack" style="margin-top:6px">${r.reasons.map((x) => `<li>≈ ${esc(x)}</li>`).join('')}</ul></div>` : ''}
    ${r.status === 'insufficient' ? `<div class="card hatched"><span class="eyebrow">Недостаточно данных для оценки</span><p class="small" style="margin-top:6px">Неизвестно: ${[...r.gaps.map((g) => g.label), ...r.missing.map((m) => m.label)].join(', ') || '—'}. Балл по одному полю хуже отсутствия балла — мы его не выдумываем.</p></div>` : ''}
    ${r.score != null ? `<div><div class="row between"><span class="eyebrow">Из чего собран балл ${r.score}</span><span class="small muted">достоверность ${r.confidence}%</span></div><div style="margin:8px 0 10px">${layersBar(r)}</div>${legend(r)}</div>` : ''}
    <div><span class="eyebrow">Фильтры · прошёл ${r.filters.filter((f) => f.pass === true).length} из ${r.filters.length}</span><div style="margin-top:8px">${funnel(r)}</div></div>
    ${grantBlock}
    ${costBlock ? `<div class="card">${costBlock}</div>` : ''}
    ${r.gaps.length ? `<p class="small muted">Нет данных: ${r.gaps.map((g) => esc(g.label)).join(', ')} — эти измерения не влияют на балл, но снижают достоверность.</p>` : ''}
    <div><span class="eyebrow">Источники по этому вузу</span><div class="row" style="margin-top:8px">${src.length ? src.map((x) => `<span class="row small" style="gap:6px">${esc(x.label)} ${provChip(x, { short: true })}</span>`).join('') : '<span class="small muted">пока только демонстрационные данные</span>'}</div>
      <p class="small" style="margin-top:8px"><a class="link" href="${esc(u.website)}" target="_blank" rel="noopener">Сайт вуза ↗</a></p></div>
    <div class="row">
      <button class="btn ${inCompare ? 'quiet' : 'ghost'}" data-cmp>${inCompare ? '✓ В сравнении' : '+ В сравнение'}</button>
      <button class="btn ${isTarget ? 'quiet' : 'amber'}" data-target>${isTarget ? '✓ Моя цель' : 'Сделать целью плана'}</button>
      <button class="btn quiet" data-close-sheet>Закрыть</button>
    </div>
  </div>`);
  const body = $('#sheet-body');
  $('[data-cmp]', body).onclick = () => {
    let compare = p.compare.includes(u.id) ? p.compare.filter((x) => x !== u.id) : [...p.compare, u.id].slice(-2);
    update({ compare });
    toast(`<div class="t">Сравнение</div><ul><li>${compare.length === 2 ? 'Два варианта выбраны — открой «Сравнение»' : compare.length === 1 ? 'Выбери ещё один вуз' : 'Список пуст'}</li></ul>`, 2400);
    closeSheet();
  };
  $('[data-target]', body).onclick = () => { update({ target: isTarget ? null : u.id }); closeSheet(); onTarget?.(); };
}

/* ---------- 5. Сравнение ---------- */
export function compare(root, ctx) {
  const p = getProfile();
  const run = ctx.compute(p);
  const pool = run.results.filter((r) => r.status !== 'out');
  let ids = p.compare.filter((id) => pool.some((r) => r.id === id));
  if (ids.length < 2) ids = [...new Set([...ids, ...pool.slice(0, 2).map((r) => r.id)])].slice(0, 2);
  const pick = (id) => run.results.find((r) => r.id === id);
  const [a, b] = ids.map(pick);
  if (!a || !b) {
    root.innerHTML = `<section class="cmp"><span class="eyebrow">Этап 5 · Сравнение</span><h2 class="display h2">Сравнивать пока нечего</h2><p class="lead">Нужны хотя бы два вуза со статусом «подходит», «близко» или «нет данных».</p><div class="bottom-nav"><button class="btn amber" data-go="#/board">К табло</button></div></section>`;
    bindGo(root); return;
  }
  const important = p.important.length ? p.important : ['money', 'grant', 'city'];
  const ROWS = {
    money: { label: 'Цена для тебя в год', cell: (r) => r.cost ? [`${tengeShort(r.cost.final)}`, r.cost.discount ? `со скидкой ${r.cost.discount.percent}%` : (p.budget ? (r.cost.final <= p.budget ? 'в бюджете' : `выше бюджета на ${tengeShort(r.cost.final - p.budget)}`) : ''), provenance(r.cost.program.tuition)] : ['—', 'нет данных о стоимости', { kind: 'unknown' }], better: (r) => (r.cost ? -r.cost.final : -Infinity) },
    grant: { label: 'Грант: прошлогодний проходной', cell: (r) => r.grant ? [`${r.grant.pass}`, `${r.grant.diff >= 0 ? `у тебя выше на ${r.grant.diff}` : `не хватает ${-r.grant.diff}`} · ориентир`, r.grant.prov] : ['—', p.ent == null ? 'нужен балл ЕНТ' : 'нет данных', { kind: 'unknown' }], better: (r) => (r.grant ? r.grant.diff : -Infinity) },
    city: { label: 'Город', cell: (r) => [r.uni.city, p.cities.includes(r.uni.city) ? 'твой город' : p.relocate ? 'переезд' : '', null], better: (r) => (p.cities.includes(r.uni.city) ? 1 : 0) },
    language: { label: 'Язык обучения', cell: (r) => [ (val(r.uni.languages) ?? []).map(langLabel).join(' · ') || '—', '', provenance(r.uni.languages)], better: (r) => (val(r.uni.languages) ?? []).filter((l) => p.languages.includes(l)).length },
    dorm: { label: 'Общежитие', cell: (r) => [val(r.uni.dorm) == null ? '—' : val(r.uni.dorm) ? 'есть' : 'нет', '', provenance(r.uni.dorm)], better: (r) => (val(r.uni.dorm) ? 1 : 0) },
    prestige: { label: 'Статус вуза', cell: (r) => [TYPE[r.uni.type] ?? '—', r.uni.type === 'national' ? 'порог 65' : '', null], better: (r) => (r.uni.type === 'national' ? 1 : 0) },
    ent: { label: 'Порог ЕНТ вуза', cell: (r) => [val(r.uni.threshold) ?? '—', p.ent != null && val(r.uni.threshold) != null ? (p.ent >= val(r.uni.threshold) ? `у тебя ${p.ent}, проходишь` : `у тебя ${p.ent}, не хватает ${val(r.uni.threshold) - p.ent}`) : '', provenance(r.uni.threshold)], better: (r) => -(val(r.uni.threshold) ?? Infinity) },
    score: { label: 'Балл подбора', cell: (r) => [r.score ?? '—', `достоверность ${r.confidence}%`, null], better: (r) => r.score ?? -1 },
  };
  const keys = [...new Set([...important, 'score', 'ent', 'language', 'dorm'])];
  const rows = keys.filter((k) => ROWS[k]).map((k) => {
    const R = ROWS[k];
    const [ca, cb] = [R.cell(a), R.cell(b)];
    const [ba, bb] = [R.better(a), R.better(b)];
    const win = ba === bb ? null : ba > bb ? 'a' : 'b';
    const cell = (c, w) => `<div class="cmp-cell ${w ? 'win' : ''}"><b>${esc(c[0])}</b>${c[1] ? `<span class="why">${esc(c[1])}</span>` : ''}${c[2] ? provChip(c[2], { short: true }) : ''}</div>`;
    return `<div class="cmp-row"><span class="lbl">${R.label}${important.includes(k) ? ' · важно для тебя' : ''}</span>${cell(ca, win === 'a')}${cell(cb, win === 'b')}</div>`;
  }).join('');
  const head = (r) => `<div class="cmp-head">${postcard(r.uni, { title: false })}<div><b class="display h3">${esc(r.uni.short)}</b><div class="row small" style="margin-top:4px">${statusChip(r.status)}</div></div></div>`;
  root.innerHTML = `<section class="cmp">
    <div><span class="eyebrow">Этап 5 · Сравнение</span><h2 class="display h2">Два маршрута рядом</h2><p class="small muted">Строки — по тому, что ты отметил важным. Зелёным закрашен тот, кто лучше по этой строке.</p></div>
    <div class="row"><span class="small muted">Заменить:</span>${pool.slice(0, 6).map((r) => `<button class="chip" data-swap="${r.id}" aria-pressed="${ids.includes(r.id)}">${esc(r.uni.short)}</button>`).join('')}</div>
    <div class="cmp-grid">${head(a)}${head(b)}</div>
    ${rows}
    <div class="bottom-nav"><button class="btn amber" data-go="#/plan">Построить план</button><button class="btn ghost" data-go="#/board">К табло</button></div>
  </section>`;
  bindGo(root);
  $$('[data-swap]', root).forEach((btn) => (btn.onclick = () => {
    const id = btn.dataset.swap;
    let next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-2);
    update({ compare: next });
    compare(root, ctx);
  }));
}

/* ---------- 6. План ---------- */
function roadmapFor(ctx) {
  const p = getProfile();
  const run = ctx.compute(p);
  const top = (p.target && run.results.find((r) => r.id === p.target && r.status !== 'out')) || run.fit[0] || run.near[0] || null;
  const steps = buildRoadmap(p, top, ctx);
  return { p, run, top, steps };
}

export function plan(root, ctx) {
  const { p, top, steps } = roadmapFor(ctx);
  const pr = progress(steps, p.done);
  const nxt = nextStep(steps, p.done);
  let phase = '';
  const items = steps.map((s) => {
    const ph = s.phase !== phase ? `<div class="phase">${esc(s.phase)}</div>` : '';
    phase = s.phase;
    const done = !!p.done[s.id];
    return `${ph}<div class="tstep ${done ? 'done' : ''} ${nxt?.id === s.id ? 'next' : ''}"><div class="card">
      <div><div class="when">${esc(s.when.text)} ${provChip(s.when.prov, { short: true })}${s.when.note ? `<span class="muted">· ${esc(s.when.note)}</span>` : ''}</div>
        <div class="title" style="font-weight:800">${esc(s.title)}</div><div class="why">${esc(s.why)}</div>
        ${s.detail?.length ? `<div class="det">${s.detail.map((d) => `<span>· ${esc(d)}</span>`).join('')}</div>` : ''}</div>
      <button class="check" role="checkbox" aria-checked="${done}" data-done="${s.id}" aria-label="Отметить: ${esc(s.title)}">${done ? '✓' : ''}</button>
    </div></div>`;
  }).join('');
  root.innerHTML = `<section class="plan">
    <div class="top"><div><span class="eyebrow">Этап 6 · План</span><h2 class="display h2">Маршрут с пересадками</h2><p class="small muted">${top ? `Цель: <b>${esc(top.uni.short)}</b> · ` : ''}${pr.done} из ${pr.total} шагов. Даты 2027 года ещё не опубликованы — показываем ориентир по прошлому году и помечаем это.</p></div>
      ${ring(pr.percent, { label: `Выполнено ${pr.percent}%` })}</div>
    <div class="timeline">${items}</div>
    <div class="row"><button class="btn ghost sm" data-ics>📅 В календарь телефона (.ics)</button><button class="btn ghost sm" data-share>🔗 Ссылка для родителей</button></div>
    <div class="bottom-nav"><button class="btn amber" data-go="#/next">Ближайший шаг</button><button class="btn ghost" data-go="#/board">К табло</button></div>
  </section>`;
  bindGo(root);
  $$('[data-done]', root).forEach((b) => (b.onclick = () => { const done = { ...getProfile().done }; done[b.dataset.done] = !done[b.dataset.done]; update({ done }); plan(root, ctx); }));
  $('[data-ics]', root).onclick = () => downloadIcs(steps);
  $('[data-share]', root).onclick = () => shareLink();
}

export function shareLink() {
  const url = `${location.origin}${location.pathname}#/board?p=${encodeProfile()}`;
  const done = () => toast('<div class="t">Ссылка скопирована</div><ul><li>Откроется тот же маршрут — без регистрации, на любом телефоне</li></ul>', 3200);
  if (navigator.share) navigator.share({ title: 'Aiqyn — мой маршрут поступления', url }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(url).then(done).catch(() => prompt('Скопируй ссылку:', url));
  else prompt('Скопируй ссылку:', url);
}

const MONTHS = { 'январ': 1, 'феврал': 2, 'март': 3, 'апрел': 4, 'ма': 5, 'июн': 6, 'июл': 7, 'август': 8, 'сентябр': 9, 'октябр': 10, 'ноябр': 11, 'декабр': 12 };
function guessDate(text) {
  // «13–20 июля 2027» → 2027-07-13; «апрель 2027» → 2027-04-01; иначе null
  const y = (text.match(/20\d\d/) || [])[0];
  if (!y) return null;
  const m = Object.keys(MONTHS).find((k) => text.toLowerCase().includes(k));
  if (!m) return null;
  const d = (text.match(/(\d{1,2})[–-]?\d{0,2}\s*[а-я]+/) || [])[1];
  return `${y}${String(MONTHS[m]).padStart(2, '0')}${String(d ? Number(d) : 1).padStart(2, '0')}`;
}
function downloadIcs(steps) {
  const ev = steps.map((s) => ({ s, d: guessDate(s.when.text) })).filter((x) => x.d);
  if (!ev.length) { toast('<div class="t">Календарь</div><ul><li>Пока нет шагов с датой</li></ul>', 2500); return; }
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Aiqyn//RU', 'CALSCALE:GREGORIAN'];
  for (const { s, d } of ev) {
    lines.push('BEGIN:VEVENT', `UID:aiqyn-${s.id}-${d}@aiqyn`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, `DTSTART;VALUE=DATE:${d}`, `SUMMARY:${s.title.replace(/,/g, '\\,')}`, `DESCRIPTION:${(s.why + (s.when.note ? ` (${s.when.note})` : '')).replace(/,/g, '\\,')}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'aiqyn-plan.ics'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- 7. Ближайший шаг ---------- */
export function next(root, ctx) {
  const { p, top, steps } = roadmapFor(ctx);
  const pr = progress(steps, p.done);
  const s = nextStep(steps, p.done);
  root.innerHTML = `<section class="next">
    <div><span class="eyebrow">Этап 7 · Следующее действие</span><h2 class="display h2">Посадка</h2></div>
    ${s ? `<div class="gate"><span class="eyebrow">Ближайший шаг · ${esc(s.when.text)}</span><h3 class="display h2">${esc(s.title)}</h3><p class="why">${esc(s.why)}</p>
      ${s.detail?.length ? `<div class="small" style="opacity:.8">${s.detail.map(esc).join('<br>')}</div>` : ''}
      <button class="btn amber" data-done-next="${s.id}">✓ Сделано</button></div>`
      : `<div class="gate"><span class="eyebrow">Все шаги отмечены</span><h3 class="display h2">Маршрут пройден</h3><p class="why">Осталось дождаться результатов. Если что-то изменилось — поправь профиль, план перестроится.</p></div>`}
    <div class="card"><div class="progress">${ring(pr.percent, { label: `Прогресс ${pr.percent}%` })}<div><b>${pr.done} из ${pr.total}</b> шагов выполнено<div class="small muted">${top ? `Цель: ${esc(top.uni.short)}. ` : ''}Прогресс сохраняется в этом браузере.</div></div></div></div>
    <div class="bottom-nav"><button class="btn ghost" data-go="#/plan">Весь план</button><button class="btn ghost" data-go="#/board">К табло</button><button class="btn quiet" data-share>🔗 Поделиться</button></div>
  </section>`;
  bindGo(root);
  const b = $('[data-done-next]', root);
  if (b) b.onclick = () => { const done = { ...getProfile().done, [b.dataset.doneNext]: true }; update({ done }); next(root, ctx); };
  $('[data-share]', root).onclick = () => shareLink();
}

/* ---------- источники ---------- */
export function sources(root, ctx) {
  const list = ctx.universities.map((u) => {
    const rows = [];
    const add = (label, f) => rows.push(`<div class="src-row"><span>${esc(label)}</span>${provChip(provenance(f))}</div>`);
    add('Языки обучения', u.languages); add('Общежитие', u.dorm);
    const seen = new Set();
    for (const pr of u.programs) {
      if (!seen.has(pr.direction)) { seen.add(pr.direction); add(`Стоимость · ${ctx.directionLabel(pr.direction)} · от ${val(pr.tuition) != null ? tengeShort(val(pr.tuition)) : '—'}`, pr.tuition); }
      if (pr.gop) add(`${pr.gop} ${pr.name}: грант 2025 от ${val(pr.grantPass) ?? '—'}, порог ${val(pr.threshold) ?? '—'}`, val(pr.grantPass) != null ? pr.grantPass : pr.threshold);
    }
    return `<div class="card src-uni"><b class="display h3">${esc(u.short)}</b><a class="link small" href="${esc(u.website)}" target="_blank" rel="noopener">${esc(u.website)}</a>${rows.join('')}</div>`;
  }).join('');
  const cal = Object.values(ctx.calendar).map((c) => `<div class="src-row"><span>${esc(c.label)} — ${esc(val(c.when) ?? '—')}</span>${provChip(provenance(c.when))}</div>`).join('');
  const thr = val(ctx.thresholds);
  const thrRow = thr ? `<div class="src-row"><span>Пороги ЕНТ 2026: национальные вузы ${thr.national}, педагогика и право ${thr.pedagogy}, медицина ${thr.medicine}, остальные ${thr.other}</span>${provChip(provenance(ctx.thresholds))}</div>` : '';
  const facts = ctx.universities.flatMap((u) => u.programs.flatMap((p) => [p.tuition, p.grantPass, p.threshold])).filter((f) => f?.kind === 'fact').length;
  const total = ctx.universities.reduce((n, u) => n + u.programs.length * 3, 0);
  root.innerHTML = `<section class="sources">
    <div><span class="eyebrow">Честность данных</span><h2 class="display h2">Источники</h2><p class="lead">Каждое значение хранится вместе с происхождением. <span class="prov fact">✓ источник</span> — есть ссылка и дата проверки. <span class="prov demo">◌ демо</span> — демонстрационное. <span class="prov unknown">⊘ нет данных</span> — не влияет на балл, снижает достоверность.</p></div>
    <div class="card"><b class="display h3">Откуда данные</b>
      <p class="small" style="margin-top:6px">Проходные баллы на грант и пороги вузов — итоги конкурса 2025 года по каждому вузу и группе программ (агрегатор <a class="link" href="https://univision.kz" target="_blank" rel="noopener">univision.kz</a>). Стоимость — прайсы вузов 2025 года там же, для КБТУ, КИМЭП и Нархоз — публикации <a class="link" href="https://er10.kz" target="_blank" rel="noopener">er10.kz</a> и <a class="link" href="https://bes.media" target="_blank" rel="noopener">bes.media</a>. Даты кампании — Национальный центр тестирования.</p>
      <p class="small muted" style="margin-top:6px">Проверено значений со ссылкой: <b>${facts}</b> из ${total} полей по программам. Языки обучения и общежития пока помечены «демо» — не сверены с сайтами вузов.</p>
      ${thrRow}</div>
    <div class="card"><b class="display h3">Календарь приёмной кампании</b>${cal}</div>
    ${list}
    <div class="bottom-nav"><button class="btn ghost" data-go="#/">На главную</button></div>
  </section>`;
  bindGo(root);
}

/* ---------- профиль не заполнен ---------- */
export function incomplete(root) {
  const q = firstUnanswered() ?? 1;
  root.innerHTML = `<section class="q"><span class="num">Профиль заполнен не до конца</span><h2 class="display h2">Сначала — пара ответов</h2>
    <p class="hint">Табло строится по твоим ответам. Осталось начать с вопроса ${q}.</p>
    <div class="nav"><button class="btn amber" data-go="#/profile/${q}">Продолжить с вопроса ${q}</button></div></section>`;
  bindGo(root);
}

/* ---------- ошибка ---------- */
export function error(root, err) {
  console.error(err);
  root.innerHTML = `<section class="errbox"><span class="eyebrow">Что-то пошло не так</span><h2 class="display h2">Табло временно не работает</h2>
    <p class="lead">Ошибка: <code class="mono small">${esc(err?.message ?? err)}</code>. Данные профиля не потеряны.</p>
    <div class="row"><button class="btn amber" onclick="location.reload()">Перезагрузить</button><button class="btn ghost" data-reset>Сбросить профиль</button></div></section>`;
  $('[data-reset]', root).onclick = () => { try { localStorage.clear(); } catch {} location.hash = '#/'; location.reload(); };
}
