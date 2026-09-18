// Экраны 1–3: вход, анкета (6 вопросов), диагностика
import { esc, $, $$, provChip } from './bits.js';
import { boardHTML } from './board.js';
import { tengeShort, unis } from '../engine/format.js';
import { getProfile, update, QUESTIONS } from '../state.js';
import { directionLabel, langLabel } from '../../data/directions.js';
import { val, provenance } from '../engine/facts.js';

/* ---------- 1. Вход ---------- */
export function entry(root, ctx) {
  const demoProfile = { interests: ['it'], ent: 96, budget: 1_800_000, languages: ['ru', 'en'], cities: ['Алматы'], relocate: false, dorm: true };
  const run = ctx.compute(demoProfile);
  const started = (getProfile().interests?.length ?? 0) > 0;
  root.innerHTML = `<section class="hero">
    <div class="brandline"><span class="logo">AI<b>QYN</b></span><span class="eyebrow">айқын — «ясный» по-казахски</span></div>
    <h1 class="display h1">Куда поступать — <em>и почему именно туда</em></h1>
    <div class="flapword" aria-hidden="true"><span>Каждый вуз:</span><span class="w flap" data-flapword>ПОДХОДИТ</span></div>
    <p class="lead">Шесть вопросов — и вместо списка вузов ты получаешь табло: кто подходит, кто близко, и по какой причине. Поменяешь ответ — талоны перещёлкнутся у тебя на глазах.</p>
    <div class="hero-board" aria-label="Пример табло">
      ${boardHTML(run.results.slice(0, 4), { marquee: 'ПРИМЕР · IT · ЕНТ 96 · 1,8 МЛН ₸ · АЛМАТЫ · СВОЙ МАРШРУТ — НИЖЕ · ', foot: `<span>пример для профиля «IT, Алматы»: <b>${run.summary.fit}</b> подходят, <b>${run.summary.near}</b> близко из ${run.summary.total}</span>` })}
    </div>
    <ul class="promise">
      <li class="numbered"><span class="n">01</span><span><b>С объяснением.</b> Балл собран из слагаемых, у отказа названа причина и разрыв.</span></li>
      <li class="numbered"><span class="n">02</span><span><b>Честно.</b> У каждой цифры — источник и дата проверки, либо пометка «демо».</span></li>
      <li class="numbered"><span class="n">03</span><span><b>Без гарантий.</b> Прошлогодний проходной — ориентир, а не обещание поступления.</span></li>
    </ul>
    <div class="cta">
      <button class="btn amber" data-go="#/profile/1">${started ? 'Продолжить маршрут' : 'Построить мой маршрут'}</button><span class="small" style="color:var(--on-blue-2)">6 вопросов · 2 минуты</span>
      ${started ? '<button class="btn ghost" data-go="#/board">К табло</button>' : ''}
      <a class="link small" href="#/sources">Источники данных</a>
    </div>
  </section>`;
  bindGo(root);
  // слово на табло перещёлкивается: подходит → близко → почему → …
  const words = ['ПОДХОДИТ', 'БЛИЗКО', 'НЕ ПРОХОДИТ', 'И ПОЧЕМУ'];
  const w = $('[data-flapword]', root);
  let i = 0;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!reduced) {
    const timer = setInterval(() => {
      if (!document.body.contains(w)) { clearInterval(timer); return; }
      i = (i + 1) % words.length;
      w.classList.remove('flipping'); void w.offsetWidth; w.classList.add('flipping');
      setTimeout(() => { w.textContent = words[i]; }, 205);
    }, 1900);
  }
}

/* ---------- 2. Анкета ---------- */
const Q = [
  { key: 'interests', num: 'Вопрос 1 из 6', title: 'Что тебе интересно?', hint: 'Можно выбрать несколько. Это самый тяжёлый фильтр: без совпадения по направлению вуз не рассматривается.' },
  { key: 'ent', num: 'Вопрос 2 из 6', title: 'Какой у тебя балл ЕНТ?', hint: 'Пробный или настоящий. Максимум 140. Если ещё не сдавал — так и скажи, подбор всё равно сработает.' },
  { key: 'budget', num: 'Вопрос 3 из 6', title: 'Сколько семья готова платить в год?', hint: 'Если рассчитываешь только на грант — выбери «только грант»: сравним твой балл с прошлогодним проходным.' },
  { key: 'languages', num: 'Вопрос 4 из 6', title: 'На каком языке хочешь учиться?', hint: 'Можно несколько. Вуз без обучения на твоём языке не пройдёт фильтр.' },
  { key: 'cities', num: 'Вопрос 5 из 6', title: 'В каком городе?', hint: 'Выбери города или отметь, что готов переехать — тогда город станет плюсом, а не фильтром.' },
  { key: 'dorm', num: 'Вопрос 6 из 6', title: 'Нужно общежитие?', hint: 'И что для тебя важнее всего — по этому мы построим сравнение.' },
];

export function profile(root, ctx, n) {
  const i = Math.min(Math.max(Number(n) || 1, 1), 6);
  const q = Q[i - 1];
  const p = getProfile();
  let body = '';
  if (q.key === 'interests') {
    body = `<div class="chips">${ctx.directions.map((d) => `<button class="chip lg" data-dir="${d.id}" aria-pressed="${p.interests.includes(d.id)}">${d.label}</button>`).join('')}</div>`;
  } else if (q.key === 'ent') {
    const v = p.ent ?? 90;
    const untouched = !p.answered?.ent;
    body = `<div class="bigval" data-entval>${untouched ? '<span class="muted">—<small>двигай ползунок</small></span>' : p.ent == null ? '<span class="muted">пока нет</span>' : `${v}<small>из 140</small>`}</div>
      <input class="slider" type="range" min="40" max="140" step="1" value="${v}" data-ent aria-label="Балл ЕНТ" style="--fill:${((v - 40) / 100) * 100}%">
      <div class="scale"><span>40</span><span>порог 50 · 65 нац. · 70 мед. · 75 пед.</span><span>140</span></div>
      <button class="btn quiet sm dontknow" data-ent-unknown aria-pressed="${!untouched && p.ent == null}">${!untouched && p.ent == null ? '✓ ' : ''}Ещё не сдавал — пока не знаю</button>
      <p class="hint">Прошлогодний проходной на грант — ориентир, не гарантия. Мы никогда не скажем «ты проходишь».</p>`;
  } else if (q.key === 'budget') {
    const mode = p.budget === 0 ? 'grant' : p.budget == null ? 'unknown' : 'paid';
    const v = p.budget && p.budget > 0 ? p.budget : 1_500_000;
    body = `<div class="seg" role="group" aria-label="Режим оплаты">
        <button data-bmode="paid" aria-pressed="${mode === 'paid'}">Платно, до суммы</button>
        <button data-bmode="grant" aria-pressed="${mode === 'grant'}">Только грант</button>
        <button data-bmode="unknown" aria-pressed="${mode === 'unknown'}">Пока не знаю</button>
      </div>
      <div data-budget-slider ${mode === 'paid' ? '' : 'hidden'}>
        <div class="bigval" data-budgetval>${tengeShort(v)}<small>в год</small></div>
        <input class="slider" type="range" min="300000" max="5000000" step="100000" value="${v}" data-budget aria-label="Бюджет в год" style="--fill:${((v - 300000) / 4700000) * 100}%">
        <div class="scale"><span>300 тыс.</span><span>5 млн</span></div>
      </div>
      <p class="hint" data-budget-hint>${mode === 'grant' ? 'Сравним твой балл ЕНТ с прошлогодним проходным по твоей группе программ.' : mode === 'unknown' ? 'Без бюджета и балла подбор покажет «нет данных» — это честнее выдуманной оценки.' : 'Стоимость сравниваем со скидками вуза за твой балл, если они есть.'}</p>`;
  } else if (q.key === 'languages') {
    body = `<div class="chips">${ctx.langs.map((l) => `<button class="chip lg" data-lang="${l.id}" aria-pressed="${p.languages.includes(l.id)}">${l.label}</button>`).join('')}</div>`;
  } else if (q.key === 'cities') {
    body = `<div class="chips">${ctx.cities.map((c) => `<button class="chip" data-city="${c}" aria-pressed="${p.cities.includes(c)}">${c}</button>`).join('')}</div>
      <button class="chip lg" data-relocate aria-pressed="${p.relocate}">Готов переехать в другой город</button>`;
  } else if (q.key === 'dorm') {
    const IMPORTANT = [['money', 'Цена'], ['grant', 'Шанс на грант'], ['city', 'Город'], ['language', 'Язык'], ['dorm', 'Общежитие'], ['prestige', 'Статус вуза']];
    body = `<div class="seg" role="group" aria-label="Общежитие">
        <button data-dorm="true" aria-pressed="${p.dorm === true}">Нужно</button>
        <button data-dorm="false" aria-pressed="${p.dorm === false}">Не нужно</button>
        <button data-dorm="null" aria-pressed="${p.dorm === null}">Не важно</button>
      </div>
      <p class="hint" style="margin-top:8px">Что важнее всего? Выбери до трёх — по ним построим сравнение.</p>
      <div class="chips">${IMPORTANT.map(([k, l]) => `<button class="chip" data-imp="${k}" aria-pressed="${p.important.includes(k)}">${l}</button>`).join('')}</div>`;
  }
  root.innerHTML = `<section class="q">
    <span class="num">${q.num}</span>
    <h2 class="display h2">${q.title}</h2>
    <p class="hint">${q.hint}</p>
    ${body}
    <div class="nav">
      ${i > 1 ? `<button class="btn ghost" data-go="#/profile/${i - 1}">Назад</button>` : `<button class="btn ghost" data-go="#/">Назад</button>`}
      <button class="btn amber" data-next ${q.key === 'interests' && !p.interests.length ? 'disabled' : ''}>${i < 6 ? 'Дальше' : 'Готово — к диагностике'}</button>
    </div>
  </section>`;

  const mark = (patch = {}) => update({ ...patch, answered: { ...getProfile().answered, [q.key]: true } });
  const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  $$('[data-dir]', root).forEach((b) => (b.onclick = () => {
    const interests = toggleIn(getProfile().interests, b.dataset.dir);
    b.setAttribute('aria-pressed', String(interests.includes(b.dataset.dir)));
    update({ interests, answered: { ...getProfile().answered, interests: interests.length > 0 } });
    $('[data-next]', root).disabled = !interests.length;
  }));
  const entSlider = $('[data-ent]', root);
  if (entSlider) {
    entSlider.oninput = () => {
      const v = Number(entSlider.value);
      entSlider.style.setProperty('--fill', `${((v - 40) / 100) * 100}%`);
      $('[data-entval]', root).innerHTML = `${v}<small>из 140</small>`;
      $('[data-ent-unknown]', root).setAttribute('aria-pressed', 'false');
      $('[data-ent-unknown]', root).textContent = 'Ещё не сдавал — пока не знаю';
      mark({ ent: v });
    };
    $('[data-ent-unknown]', root).onclick = () => { mark({ ent: null }); profile(root, ctx, i); };
  }
  $$('[data-bmode]', root).forEach((b) => (b.onclick = () => {
    const m = b.dataset.bmode;
    mark({ budget: m === 'grant' ? 0 : m === 'unknown' ? null : Number($('[data-budget]', root).value) });
    profile(root, ctx, i);
  }));
  const bs = $('[data-budget]', root);
  if (bs) bs.oninput = () => {
    const v = Number(bs.value);
    bs.style.setProperty('--fill', `${((v - 300000) / 4700000) * 100}%`);
    $('[data-budgetval]', root).innerHTML = `${tengeShort(v)}<small>в год</small>`;
    mark({ budget: v });
  };
  $$('[data-lang]', root).forEach((b) => (b.onclick = () => {
    const languages = toggleIn(getProfile().languages, b.dataset.lang);
    b.setAttribute('aria-pressed', String(languages.includes(b.dataset.lang)));
    mark({ languages });
  }));
  $$('[data-city]', root).forEach((b) => (b.onclick = () => {
    const cities = toggleIn(getProfile().cities, b.dataset.city);
    b.setAttribute('aria-pressed', String(cities.includes(b.dataset.city)));
    mark({ cities });
  }));
  const rel = $('[data-relocate]', root);
  if (rel) rel.onclick = () => { const relocate = !getProfile().relocate; rel.setAttribute('aria-pressed', String(relocate)); mark({ relocate }); };
  $$('[data-dorm]', root).forEach((b) => (b.onclick = () => {
    const v = b.dataset.dorm === 'true' ? true : b.dataset.dorm === 'false' ? false : null;
    $$('[data-dorm]', root).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    mark({ dorm: v });
  }));
  $$('[data-imp]', root).forEach((b) => (b.onclick = () => {
    let important = toggleIn(getProfile().important, b.dataset.imp).slice(-3);
    $$('[data-imp]', root).forEach((x) => x.setAttribute('aria-pressed', String(important.includes(x.dataset.imp))));
    mark({ important });
  }));
  $('[data-next]', root).onclick = () => {
    // вопрос считается отвеченным, даже если оставили значение по умолчанию
    const patch = {};
    if (q.key === 'ent' && !getProfile().answered?.ent) patch.ent = null; // не трогал ползунок — честно считаем, что балла пока нет
    if (q.key === 'budget' && !getProfile().answered?.budget) patch.budget = getProfile().budget ?? (bs ? Number(bs.value) : null);
    mark(patch);
    location.hash = i < 6 ? `#/profile/${i + 1}` : '#/diagnosis';
  };
  bindGo(root);
}

/* ---------- 3. Диагностика ---------- */
export function diagnosis(root, ctx) {
  const p = getProfile();
  const run = ctx.compute(p);
  const total = run.summary.total;
  // воронка: сколько вузов остаётся после каждого фильтра
  const order = ['direction', 'language', 'ent', 'money', 'city'];
  const labels = { direction: 'по направлению', language: 'по языку обучения', ent: 'по порогу ЕНТ', money: 'по деньгам или гранту', city: 'по городу' };
  let alive = run.results;
  const stages = [{ label: 'Все вузы в базе', n: total }];
  for (const k of order) {
    const before = alive.length;
    alive = alive.filter((r) => { const f = r.filters.find((x) => x.key === k); return !f || f.pass !== false || f.severity === 'near'; });
    if (before !== alive.length || run.results.some((r) => r.filters.some((f) => f.key === k))) stages.push({ label: `Прошли ${labels[k]}`, n: alive.length, cut: before - alive.length });
  }
  const strengths = [], limits = [], missing = [];
  if (p.ent != null && p.ent >= 100) strengths.push(`Балл ${p.ent} — выше порога национальных вузов (65) с большим запасом`);
  else if (p.ent != null && p.ent >= 65) strengths.push(`Балл ${p.ent} проходит порог национальных вузов (65)`);
  else if (p.ent != null && p.ent >= 50) strengths.push(`Балл ${p.ent} проходит общий порог (50), но не порог национальных вузов (65)`);
  if (p.languages.length >= 2) strengths.push(`${p.languages.length} языка обучения расширяют выбор: ${p.languages.map(langLabel).join(', ')}`);
  if (p.relocate) strengths.push('Готовность к переезду: город стал плюсом, а не фильтром');
  if (p.budget != null && p.budget >= 2_000_000) strengths.push(`Бюджет ${tengeShort(p.budget)} покрывает большинство платных программ`);
  if (p.budget === 0) limits.push('Только грант: всё решает балл против прошлогоднего проходного по группе программ');
  if (p.cities.length && !p.relocate) limits.push(`Только ${p.cities.join(', ')} — вузы других городов не рассматриваем`);
  if (p.languages.length === 1) limits.push(`Один язык обучения — ${langLabel(p.languages[0])}`);
  if (p.ent == null) missing.push({ t: 'Балл ЕНТ', e: 'не проверяем пороги вузов и шансы на грант — достоверность подбора ниже' });
  if (p.budget == null) missing.push({ t: 'Бюджет', e: 'не проверяем стоимость — часть вузов получит статус «нет данных»' });
  const fitOrNear = run.summary.fit + run.summary.near;
  root.innerHTML = `<section class="diag">
    <div class="head"><div><span class="eyebrow">Этап 3 · Диагностика</span><h2 class="display h2">Талон готов. Вот что он значит</h2></div><span class="stamp ${fitOrNear ? 'fit' : 'near'}">${fitOrNear ? 'к вылету' : 'ждём данных'}</span></div>
    <div class="block"><span class="eyebrow">Цель</span><p class="goal">${esc(p.interests.map(directionLabel).join(', '))}${p.budget === 0 ? ' — на грант' : p.budget ? ` — до ${tengeShort(p.budget)} в год` : ''}${p.cities.length ? `, ${p.relocate ? 'лучше в ' : ''}${esc(p.cities.join(' / '))}` : ''}</p></div>
    <div class="grid-2">
      <div class="block"><span class="eyebrow">Сильные стороны</span>${strengths.length ? `<ul class="stack">${strengths.map((s) => `<li>✓ ${esc(s)}</li>`).join('')}</ul>` : '<p class="muted">Пока нечего выделить — добавь балл или бюджет.</p>'}</div>
      <div class="block"><span class="eyebrow">Ограничения</span>${limits.length ? `<ul class="stack">${limits.map((s) => `<li>• ${esc(s)}</li>`).join('')}</ul>` : '<p class="muted">Жёстких ограничений нет.</p>'}</div>
    </div>
    ${missing.length ? `<div class="missing"><span class="eyebrow">Не хватает данных</span><ul class="stack" style="margin-top:8px">${missing.map((m) => `<li><b>${m.t}</b> — ${esc(m.e)}. <a class="link" href="#/profile/${m.t === 'Балл ЕНТ' ? 2 : 3}">Добавить</a></li>`).join('')}</ul></div>` : ''}
    <div class="block"><span class="eyebrow">Как работает отбор</span>
      <div class="funnelbars" style="margin-top:6px">${stages.map((s, i) => `<div class="fb ${s.cut ? 'cut' : ''}"><div class="lbl"><span>${esc(s.label)}${s.cut ? ` <span class="muted">· −${s.cut}</span>` : ''}</span><b>${s.n}</b></div><div class="bar"><i style="width:${(s.n / total) * 100}%; animation-delay:${i * 120}ms"></i></div></div>`).join('')}</div>
      <p class="small muted" style="margin-top:6px">Близкие варианты (разрыв небольшой) остаются в воронке — их мы покажем отдельно с указанием, чего не хватает.</p>
    </div>
    <div class="bottom-nav"><button class="btn amber" data-go="#/board">Открыть табло · ${unis(fitOrNear)}</button><button class="btn ghost" data-go="#/profile/6">Изменить ответы</button></div>
  </section>`;
  bindGo(root);
}

export function bindGo(root) {
  $$('[data-go]', root).forEach((b) => (b.onclick = () => { location.hash = b.dataset.go; }));
}
