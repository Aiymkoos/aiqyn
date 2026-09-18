// Табло вылетов: строка на вуз. При изменении профиля ячейки перещёлкиваются,
// строки переезжают на новые места (FLIP), а не перерисовываются с нуля.
import { esc, reducedMotion } from './bits.js';
import { STATUS } from '../engine/score.js';

const TYPE = { national: 'национальный', state: 'государственный', private: 'частный', international: 'международный', autonomous: 'автономный' };

const STUB_LABEL = { fit: 'балл', near: 'близко', insufficient: 'нет данных', out: 'мимо' };
const rowHTML = (r, i = 0) => `<button class="brow ${r.status}" data-id="${r.id}" style="--i:${i}" aria-label="${esc(r.uni.short)}: ${STATUS[r.status]}">
  <span class="main">
    <span class="code"><span class="flap">${esc(r.uni.code)}</span></span>
    <span class="name">${esc(r.uni.short)}</span>
    <span class="meta">${esc(r.uni.city)} · ${TYPE[r.uni.type] ?? ''}</span>
    <span class="stc"><span class="flap st ${r.status}">${STATUS[r.status]}</span></span>
  </span>
  <span class="stub"><span><span class="flap sc ${r.status !== 'fit' ? 'dim' : ''}">${r.score == null ? '—' : r.score}</span><small>${STUB_LABEL[r.status] ?? ''}</small></span></span>
</button>`;

export function boardHTML(results, { title = 'DEPARTURES · ВУЗЫ', skeleton = false, foot = '', marquee = '' } = {}) {
  const rows = skeleton
    ? Array.from({ length: 5 }, () => `<div class="brow skeleton"><span class="main"><span class="code">········</span><span class="name">··········</span><span class="meta">·······</span><span class="stc"><span class="st">·······</span></span></span><span class="stub"><span class="sc">··</span></span></div>`).join('')
    : results.map(rowHTML).join('');
  return `<div class="board" aria-live="polite">
    <div class="board-head"><span class="t">${marquee ? `<span class="marquee" data-text="${esc(marquee)}">${esc(marquee)}</span>` : title}</span><span class="clock" data-clock>${clock()}</span></div>
    <div class="board-cols" aria-hidden="true"><span>код</span><span>вуз</span><span>город</span><span>статус</span><span style="text-align:right">балл</span></div>
    <div class="board-rows">${rows}</div>
    ${foot ? `<div class="board-foot">${foot}</div>` : ''}
  </div>`;
}

export const clock = () => new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

// Обновить существующее табло под новые результаты
export function updateBoard(board, results, { foot = '' } = {}) {
  const rowsEl = board.querySelector('.board-rows');
  const existing = new Map([...rowsEl.querySelectorAll('.brow[data-id]')].map((el) => [el.dataset.id, el]));
  const first = new Map([...existing].map(([id, el]) => [id, el.getBoundingClientRect().top]));
  const motion = !reducedMotion();
  const changed = new Set();

  results.forEach((r) => {
    let el = existing.get(r.id);
    if (!el) { const t = document.createElement('div'); t.innerHTML = rowHTML(r, 0); el = t.firstElementChild; }
    const st = el.querySelector('.st'), sc = el.querySelector('.sc');
    const newSt = STATUS[r.status], newSc = r.score == null ? '—' : String(r.score);
    if (st.textContent !== newSt || sc.textContent !== newSc) changed.add(r.id);
    flipCell(st, newSt, motion, () => { st.className = `flap st ${r.status}`; });
    flipCell(sc, newSc, motion, () => { sc.classList.toggle('dim', r.status !== 'fit'); });
    const small = el.querySelector('.stub small'); if (small) small.textContent = STUB_LABEL[r.status] ?? '';
    el.className = `brow ${r.status}`;
    el.style.animation = 'none'; // после первого появления строки только переезжают
    el.setAttribute('aria-label', `${r.uni.short}: ${newSt}`);
    rowsEl.appendChild(el); // порядок = порядок результатов
  });
  for (const [id, el] of existing) if (!results.some((r) => r.id === id)) el.remove();

  if (motion) {
    results.forEach((r) => {
      const el = existing.get(r.id);
      if (!el) return;
      const dy = (first.get(r.id) ?? 0) - el.getBoundingClientRect().top;
      if (Math.abs(dy) > 1) {
        el.style.transition = 'none';
        el.style.transform = `translateY(${dy}px)`;
        requestAnimationFrame(() => { el.style.transition = 'transform 520ms cubic-bezier(0.2,0.8,0.2,1)'; el.style.transform = ''; });
        el.classList.remove('moved'); void el.offsetWidth; el.classList.add('moved');
      }
    });
  }
  const footEl = board.querySelector('.board-foot');
  if (footEl && foot) footEl.innerHTML = foot;
  const c = board.querySelector('[data-clock]'); if (c) c.textContent = clock();
  return changed;
}

function flipCell(el, text, motion, after) {
  if (el.textContent === text) { after?.(); return; }
  if (!motion) { el.textContent = text; after?.(); return; }
  el.classList.remove('flipping'); void el.offsetWidth; el.classList.add('flipping');
  setTimeout(() => { el.textContent = text; after?.(); }, 205);
}
