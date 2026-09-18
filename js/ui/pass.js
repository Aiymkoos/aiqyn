// Посадочный талон — всегда сверху. Заполняется по мере ответов, показывает, где ты на маршруте.
import { esc, $ } from './bits.js';
import { tengeShort } from '../engine/format.js';
import { directionLabel, langLabel } from '../../data/directions.js';
import { QUESTIONS } from '../state.js';

export const STATIONS = [
  { id: 'entry', label: 'Вход', route: '#/' },
  { id: 'profile', label: 'Профиль', route: '#/profile/1' },
  { id: 'diagnosis', label: 'Диагностика', route: '#/diagnosis' },
  { id: 'board', label: 'Вузы', route: '#/board' },
  { id: 'compare', label: 'Сравнение', route: '#/compare' },
  { id: 'plan', label: 'План', route: '#/plan' },
  { id: 'next', label: 'Шаг', route: '#/next' },
];

const FIELDS = [
  { q: 1, k: 'Направление', v: (p) => p.answered?.interests ? (p.interests.length ? p.interests.map(directionLabel).join(', ') : '—') : null },
  { q: 2, k: 'ЕНТ', v: (p) => p.answered?.ent ? (p.ent == null ? 'пока нет' : `${p.ent} / 140`) : null },
  { q: 3, k: 'Бюджет / год', v: (p) => p.answered?.budget ? (p.budget == null ? 'не знаю' : p.budget === 0 ? 'только грант' : tengeShort(p.budget)) : null },
  { q: 4, k: 'Язык', v: (p) => p.answered?.languages ? (p.languages.length ? p.languages.map(langLabel).join(' · ') : 'любой') : null },
  { q: 5, k: 'Город', v: (p) => p.answered?.cities ? (p.cities.length ? p.cities.join(', ') + (p.relocate ? ' +переезд' : '') : 'любой') : null },
  { q: 6, k: 'Общежитие', v: (p) => p.answered?.dorm ? (p.dorm === true ? 'нужно' : p.dorm === false ? 'не нужно' : 'не важно') : null },
];

let prevValues = {};

export function renderPass(profile, stationId, { currentQuestion = null } = {}) {
  const el = $('#pass');
  if (stationId === 'entry') { el.hidden = true; return; }
  el.hidden = false;
  const idx = STATIONS.findIndex((s) => s.id === stationId);
  const answered = QUESTIONS.filter((q) => profile.answered?.[q]).length;
  const fields = FIELDS.map((f) => {
    const v = f.v(profile);
    const printed = v != null && prevValues[f.k] !== v;
    prevValues[f.k] = v;
    const now = currentQuestion === f.q ? ' now' : '';
    return `<button class="pass-field${now}" data-go="#/profile/${f.q}" title="Изменить: ${f.k}">
      <span class="k">${f.k}</span>
      <span class="v ${v == null ? 'blank' : ''} ${printed ? 'printed' : ''}">${v == null ? '· · ·' : esc(v)}</span>
    </button>`;
  }).join('');
  const stations = STATIONS.map((s, i) => {
    const cls = i < idx ? 'done' : i === idx ? 'now' : '';
    const reachable = i <= 1 || answered > 0;
    return `<button class="station ${cls}" data-go="${s.route}" ${reachable ? '' : 'disabled'} aria-current="${i === idx ? 'step' : 'false'}">
      <span class="dot">${i === idx ? '●' : i + 1}</span><span class="lbl">${s.label}</span></button>`;
  }).join('');
  el.innerHTML = `<div class="pass-card">
    <div class="pass-top"><span class="brand">Ai<b>qyn</b> · <span class="full">посадочный </span>талон</span><span class="where">${idx + 1}/7 · ${STATIONS[idx].label}</span></div>
    <div class="pass-fields">${fields}</div>
    <nav class="stations" aria-label="Этапы маршрута">${stations}</nav>
  </div>`;
  el.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => { location.hash = b.dataset.go; }));
}
