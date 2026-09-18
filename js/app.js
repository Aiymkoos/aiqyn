// Точка входа: маршрутизация по hash, контекст данных, посадочный талон
import { load, getProfile, update, decodeProfile, subscribe } from './state.js';
import { evaluateAll } from './engine/score.js';
import { UNIVERSITIES } from '../data/universities.js';
import { DIRECTIONS, CITIES, LANGS, directionLabel } from '../data/directions.js';
import { CALENDAR, ENT_PROFILE, ENT_COMMON, THRESHOLDS } from '../data/calendar.js';
import { renderPass } from './ui/pass.js';
import { closeSheet, $ } from './ui/bits.js';
import * as flow from './ui/screens-flow.js';
import * as res from './ui/screens-results.js';

const ctx = {
  directionLabel, universities: UNIVERSITIES, directions: DIRECTIONS, cities: CITIES, langs: LANGS,
  calendar: CALENDAR, entProfile: ENT_PROFILE, entCommon: ENT_COMMON, thresholds: THRESHOLDS,
  compute: (p) => evaluateAll(p, UNIVERSITIES, { directionLabel }),
  renderPass: () => {},
};

const ROUTES = {
  '': { station: 'entry', render: (root) => flow.entry(root, ctx) },
  'profile': { station: 'profile', render: (root, n) => flow.profile(root, ctx, n) },
  'diagnosis': { station: 'diagnosis', guard: true, render: (root) => flow.diagnosis(root, ctx) },
  'board': { station: 'board', guard: true, render: (root) => res.board(root, ctx) },
  'compare': { station: 'compare', guard: true, render: (root) => res.compare(root, ctx) },
  'plan': { station: 'plan', guard: true, render: (root) => res.plan(root, ctx) },
  'next': { station: 'next', guard: true, render: (root) => res.next(root, ctx) },
  'sources': { station: 'sources', render: (root) => res.sources(root, ctx) },
};

function route() {
  const root = $('#screen');
  closeSheet();
  try {
    const hash = location.hash || '#/';
    const [path, query] = hash.slice(1).split('?');
    const params = new URLSearchParams(query ?? '');
    if (params.get('p')) {
      const shared = decodeProfile(params.get('p'));
      if (shared) update({ ...shared, done: getProfile().done });
      history.replaceState(null, '', `#${path}`);
    }
    const [name = '', arg] = path.split('/').filter(Boolean);
    const r = ROUTES[name] ?? ROUTES[''];
    const p = getProfile();
    const station = r.station === 'sources' ? 'board' : r.station;
    ctx.renderPass = () => renderPass(getProfile(), station, { currentQuestion: name === 'profile' ? Number(arg) || 1 : null });
    ctx.renderPass();
    if (r.guard && !(p.interests?.length > 0)) { res.incomplete(root); }
    else r.render(root, arg);
    window.scrollTo({ top: 0, behavior: 'instant' });
    root.focus({ preventScroll: true });
  } catch (err) {
    res.error(root, err);
  }
}

load();
subscribe(() => ctx.renderPass());
// на экранах результатов талон сворачивается при прокрутке, чтобы не съедать экран телефона
let lastY = 0;
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  const pass = $('#pass');
  if (y > 140 && y > lastY) pass.classList.add('compact');
  else if (y < 60 || y < lastY - 40) pass.classList.remove('compact');
  lastY = y;
}, { passive: true });
window.addEventListener('hashchange', route);
window.addEventListener('error', (e) => { if (!$('#screen').innerHTML) res.error($('#screen'), e.error ?? e.message); });
route();
