// Мелкие общие элементы интерфейса
import { WEIGHTS, LABELS, STATUS } from '../engine/score.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const ICONS = { fit: '✓', near: '≈', insufficient: '?', out: '✕', incomplete: '…' };
export const statusChip = (s) => `<span class="status ${s}">${ICONS[s] ?? ''} ${STATUS[s] ?? s}</span>`;

// Чип происхождения: проверено (ссылка + дата) / демо / нет данных
export function provChip(p, { short = false } = {}) {
  if (!p) return '';
  if (p.kind === 'fact') {
    const date = p.checked ? ` · ${esc(p.checked)}` : '';
    const inner = p.source ? `<a href="${esc(p.source)}" target="_blank" rel="noopener">✓ источник</a>` : `✓ ${esc(p.label && p.label !== 'проверено' ? p.label : 'проверено')}`;
    return `<span class="prov fact" title="Проверено${date}">${inner}${short ? '' : date}</span>`;
  }
  if (p.kind === 'demo') return `<span class="prov demo" title="Демонстрационные данные">◌ демо</span>`;
  return `<span class="prov unknown" title="Данных нет">⊘ нет данных</span>`;
}

// Слоистый балл: каждое слагаемое — своя полоса, неприменимое — штриховка
export function layersBar(r) {
  const keys = Object.keys(WEIGHTS);
  const have = new Map(r.comps.map((c) => [c.key, c]));
  return `<div class="layers" role="img" aria-label="Балл ${r.score ?? '—'} из 100">${keys.map((k) => {
    const c = have.get(k);
    if (!c) return `<span class="layer unknown" style="flex-basis:${WEIGHTS[k]}%" title="${LABELS[k]}: не оценивалось"></span>`;
    return `<span class="layer ${k}" style="flex-basis:${WEIGHTS[k]}%; opacity:${0.35 + 0.65 * (c.points / c.max)}" title="${esc(c.text)}"></span>`;
  }).join('')}</div>`;
}

export function legend(r) {
  const keys = Object.keys(WEIGHTS);
  const have = new Map(r.comps.map((c) => [c.key, c]));
  return `<div class="legend">${keys.map((k) => {
    const c = have.get(k);
    if (!c) {
      const f = r.filters.find((x) => x.key === k);
      const why = f && f.pass === false ? 'не проходит' : f && f.pass === null ? 'нет данных' : k === 'dorm' ? 'не нужно тебе' : k === 'city' ? 'город не важен' : 'нет данных';
      return `<div class="legend-row"><span class="pts na">—</span><span class="txt na"><i class="sw layer unknown"></i>${LABELS[k]} · ${why} (${WEIGHTS[k]} не считаем)</span></div>`;
    }
    return `<div class="legend-row"><span class="pts">+${c.points}</span><span class="txt"><i class="sw layer ${k}"></i>${esc(c.text)} <span class="muted">· из ${c.max}</span></span></div>`;
  }).join('')}</div>`;
}

export function funnel(r) {
  return `<div class="funnel">${r.filters.map((f) => {
    const cls = f.pass === true ? 'ok' : f.pass === null ? 'skip' : f.severity === 'near' ? 'near' : 'fail';
    const m = f.pass === true ? '✓' : f.pass === null ? '?' : f.severity === 'near' ? '≈' : '✕';
    return `<div class="frow ${cls}"><span class="m">${m}</span><div><span class="k">${LABELS[f.key]}</span> · <span class="d">${esc(f.detail)}</span></div></div>`;
  }).join('')}</div>`;
}

export const ring = (value, { lg = false, label = '' } = {}) => `<div class="ring ${lg ? 'lg' : ''}" style="--p:${value ?? 0}" role="img" aria-label="${label || `Балл ${value ?? '—'}`}"><b>${value ?? '—'}</b></div>`;

export function toast(html, ms = 5200) {
  const el = $('#toast');
  el.innerHTML = html;
  el.hidden = false;
  el.onclick = () => { clearTimeout(el._t); el.hidden = true; };
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, ms);
}

export function openSheet(html, { onClose } = {}) {
  const sheet = $('#sheet');
  $('#sheet-body').innerHTML = html;
  sheet.hidden = false;
  document.body.style.overflow = 'hidden';
  const close = () => { sheet.hidden = true; document.body.style.overflow = ''; onClose?.(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  $('[data-close]', sheet).onclick = close;
  $$('[data-close-sheet]', sheet).forEach((b) => (b.onclick = close));
  $('.sheet-panel', sheet).scrollTop = 0;
  return close;
}
export const closeSheet = () => { const s = $('#sheet'); if (!s.hidden) { s.hidden = true; document.body.style.overflow = ''; } };
