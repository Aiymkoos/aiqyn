// Состязательный (adversarial) QA-обзор — см. qa/adversarial-review.md.
// Эти тесты утверждают, как приложение ДОЛЖНО себя вести, а не как оно себя ведёт сегодня —
// поэтому они сейчас красные. Ничего в js/, css/, data/ не менялось; там, где проверяемая логика
// не экспортирована (guessDate, runX, формула контраста), тест копирует её один в один из исходника
// построчно только для верификации — это не изменение исходного файла.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { decodeProfile } from '../js/state.js';
import { evaluate } from '../js/engine/score.js';
import { tengeShort, points } from '../js/engine/format.js';
import { UNIVERSITIES } from '../data/universities.js';
import { directionLabel } from '../data/directions.js';
import { CALENDAR } from '../data/calendar.js';
import { val } from '../js/engine/facts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ctx = { directionLabel };
const kaznu = UNIVERSITIES.find((u) => u.id === 'kaznu');

// Тот же base64url, что понимает decodeProfile() — собран напрямую (не через encodeProfile()),
// как и собрал бы ссылку `#/board?p=...` вручную любой, кто её отредактировал, прислал не с сайта,
// или как её мог бы вернуть повреждённый localStorage. decodeProfile обязан быть готов к такому вводу.
function packProfile(obj) {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* ========== 1. Порча профиля через ссылку `#/board?p=<base64>` ========== */
// js/state.js decodeProfile() проверяет только Array.isArray(p.interests) — остальные поля
// мержатся поверх дефолтов без проверки типа. js/ui/*.js везде предполагает, что cities/compare/
// important/languages — массивы, и вызывает .includes/.filter/.map/.length без `?? []`.

test('decodeProfile: не-массивные cities/compare/important/languages и не-boolean dorm должны приводиться к безопасным значениям, а не приниматься как есть', () => {
  const link = packProfile({ interests: ['it'], compare: 5, important: 42, languages: 'ru,en', cities: {}, dorm: 'yes' });
  const p = decodeProfile(link);
  assert.ok(Array.isArray(p.compare), `compare должен остаться массивом, decodeProfile вернул ${typeof p.compare} (${JSON.stringify(p.compare)})`);
  assert.ok(Array.isArray(p.important), `important должен остаться массивом, decodeProfile вернул ${typeof p.important}`);
  assert.ok(Array.isArray(p.languages), `languages должен остаться массивом, decodeProfile вернул ${typeof p.languages} ("${p.languages}")`);
  assert.ok(Array.isArray(p.cities), `cities должен остаться массивом, decodeProfile вернул ${typeof p.cities}`);
  assert.ok(p.dorm === true || p.dorm === false || p.dorm === null, `dorm должен быть true/false/null, decodeProfile вернул ${JSON.stringify(p.dorm)}`);
});

test('клик по билету вуза (openDetail) после испорченной ссылки не должен падать с TypeError', () => {
  // Воспроизводит screens-results.js:198 `p.compare.includes(u.id)`, вызываемую из
  // row.onclick/plane.onclick (screens-results.js:66,117) — эти обработчики навешаны ПОСЛЕ
  // возврата из route(), поэтому её try/catch их не защищает: ошибка тихо улетает в консоль,
  // сам экран не меняется и не показывает пользователю никакого сообщения.
  const link = packProfile({ interests: ['it'], compare: 5 });
  const p = decodeProfile(link);
  assert.doesNotThrow(() => p.compare.includes('kaznu'));
});

test('открытие пульта (openPanel) после испорченной ссылки не должно падать: p.cities.includes(c)', () => {
  // screens-results.js:146, вызывается из необёрнутого data-panel.onclick (screens-results.js:120).
  const link = packProfile({ interests: ['it'], cities: 42 });
  const p = decodeProfile(link);
  assert.doesNotThrow(() => p.cities.includes('Алматы'));
});

test('экран сравнения (compare()) после испорченной ссылки не должен падать: p.compare.filter(...)', () => {
  // screens-results.js:240 — выполняется синхронно внутри route(), поэтому попадает в try/catch
  // и не роняет вкладку, но стадия 5 кейса («сравнение ≥2 вузов») в итоге всё равно недоступна:
  // вместо неё показывается общий экран "Табло временно не работает".
  const link = packProfile({ interests: ['it'], compare: 5 });
  const p = decodeProfile(link);
  assert.doesNotThrow(() => p.compare.filter((id) => id !== 'kaznu'));
});

test('вопрос 6 анкеты (important.includes) не должен падать при испорченном important', () => {
  // screens-flow.js:101, рендерится синхронно внутри route() при заходе на #/profile/6 — падает,
  // но делает недостижимой стадию 2 кейса («анкета») для профиля, пришедшего по ссылке.
  const link = packProfile({ interests: ['it'], important: 42 });
  const p = decodeProfile(link);
  assert.doesNotThrow(() => p.important.includes('money'));
});

test('экран диагностики (languages.length/.map) не должен падать при испорченном languages', () => {
  // screens-flow.js:199 `p.languages.length >= 2`, затем `.map(langLabel)` — делает недостижимой
  // стадию 3 кейса («диагностика») для профиля, пришедшего по ссылке.
  const link = packProfile({ interests: ['it'], languages: 'ru,en' });
  const p = decodeProfile(link);
  assert.doesNotThrow(() => { if (p.languages.length >= 2) p.languages.map((l) => l); });
});

/* ========== 2. Экспорт в календарь (.ics): guessDate() молча теряет события без года/дня ========== */
// Копия MONTHS/guessDate() из js/ui/screens-results.js:331-340 — функция не экспортирована,
// поэтому тест воспроизводит её логику построчно для проверки, не трогая исходный файл.
const MONTHS = { 'январ': 1, 'феврал': 2, 'март': 3, 'апрел': 4, 'ма': 5, 'июн': 6, 'июл': 7, 'август': 8, 'сентябр': 9, 'октябр': 10, 'ноябр': 11, 'декабр': 12 };
function guessDate(text) {
  const y = (text.match(/20\d\d/) || [])[0];
  if (!y) return null;
  const m = Object.keys(MONTHS).find((k) => text.toLowerCase().includes(k));
  if (!m) return null;
  const d = (text.match(/(\d{1,2})[–-]?\d{0,2}\s*[а-я]+/) || [])[1];
  return `${y}${String(MONTHS[m]).padStart(2, '0')}${String(d ? Number(d) : 1).padStart(2, '0')}`;
}

test('guessDate() должен распознавать дату в каждом событии календаря приёмной кампании (data/calendar.js)', () => {
  // downloadIcs() (screens-results.js:341-343) молча выбрасывает из .ics все события, для которых
  // guessDate вернул null, и предупреждает пользователя, только если ОТВАЛИЛИСЬ ВСЕ события разом.
  const missing = [];
  for (const [key, entry] of Object.entries(CALENDAR)) {
    const text = val(entry.when);
    if (guessDate(text) == null) missing.push(`${key}: "${text}"`);
  }
  assert.deepEqual(missing, [], `эти события молча не попадут в aiqyn-plan.ics без единого предупреждения: ${missing.join('; ')}`);
});

test('"Приём заявлений на грант" (единственная дата с проверенным источником fact()) не должна пропадать из .ics', () => {
  const entry = CALENDAR.grantApply;
  const text = val(entry.when);
  assert.equal(entry.when.kind, 'fact', 'это единственная запись календаря с проверенным источником (testcenter.kz) — остальные demo()');
  assert.notEqual(guessDate(text), null, `guessDate("${text}") вернул null из-за отсутствия года в строке — событие тихо пропадает из aiqyn-plan.ics`);
});

/* ========== 3. Мусорные ent/budget доходят до текста, который видит пользователь ========== */

test('нечисловой балл ЕНТ не должен показывать "NaN" в объяснении причины отказа', () => {
  const p = { interests: ['it'], ent: 'abc', budget: 2_000_000, languages: ['ru'], cities: [], relocate: false, dorm: null };
  const r = evaluate(p, kaznu, ctx);
  const detail = r.filters.find((f) => f.key === 'ent')?.detail ?? '';
  assert.ok(!/NaN/.test(detail), `фильтр «балл ЕНТ» показывает мусор пользователю: "${detail}"`);
});

test('бюджет-объект не должен показывать "[object Object]" в объяснении отказа по деньгам', () => {
  const p = { interests: ['it'], ent: 40, budget: {}, languages: ['ru'], cities: [], relocate: false, dorm: null };
  const r = evaluate(p, kaznu, ctx);
  const detail = r.filters.find((f) => f.key === 'money')?.detail ?? '';
  assert.ok(!/\[object Object\]/.test(detail), `фильтр «деньги» показывает мусор пользователю: "${detail}"`);
});

test('нечисловой бюджет-строка не должен попадать в текст как есть ("many ₸")', () => {
  const p = { interests: ['it'], ent: 40, budget: 'many', languages: ['ru'], cities: [], relocate: false, dorm: null };
  const r = evaluate(p, kaznu, ctx);
  const detail = r.filters.find((f) => f.key === 'money')?.detail ?? '';
  assert.ok(!/many\s*₸/.test(detail), `фильтр «деньги» показывает мусор пользователю: "${detail}"`);
});

test('points()/tengeShort() не должны протекать "NaN" наружу форматирования', () => {
  assert.notEqual(points(NaN), 'NaN баллов');
  assert.notEqual(tengeShort(NaN), 'NaN ₸');
});

test('tengeShort() отрицательных крупных сумм должен форматироваться с разделителем разрядов, как и положительные', () => {
  // tengeShort(500000) -> "500 тыс. ₸", но при n < 0 обе проверки (n>=1_000_000, n>=1_000) ложны,
  // и функция проваливается в необработанную ветку `${n} ₸` без разделителей и сокращения.
  assert.equal(tengeShort(-500000), '-500 тыс. ₸');
});

/* ========== 4. WCAG-контраст: вычислено из реальных значений css/tokens.css ========== */
function hexToRgb(hex) { const h = hex.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }
function relLuminance([r, g, b]) {
  const lin = (c) => { const cs = c / 255; return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4); };
  const [R, G, B] = [r, g, b].map(lin);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function contrastRatio(hex1, hex2) {
  const l1 = relLuminance(hexToRgb(hex1)), l2 = relLuminance(hexToRgb(hex2));
  const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (light + 0.05) / (dark + 0.05);
}
function readToken(name) {
  const css = fs.readFileSync(path.join(__dirname, '../css/tokens.css'), 'utf8');
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `токен --${name} не найден в css/tokens.css — обнови regex теста, если токен переименован`);
  return m[1];
}

test('WCAG AA: белый текст кнопки на коралловой точке --grad должен давать хотя бы 3:1 (порог для крупного жирного текста)', () => {
  // .btn.amber (16px/800) и .chip[aria-pressed="true"] (17px/700) технически НЕ «крупный текст»
  // по WCAG (нужно >=18.66px bold), поэтому им на самом деле нужно 4.5:1 — здесь проверяем даже
  // более мягкий порог 3:1 и он всё равно не проходит.
  const coral = readToken('coral'); // #FF7A59 — самая светлая точка градиента (стоп 130% в 135deg --grad)
  const ratio = contrastRatio('#FFFFFF', coral);
  assert.ok(ratio >= 3, `белый на ${coral} даёт только ${ratio.toFixed(2)}:1 (нужно >=3:1, а для реального 16-17px текста кнопок — >=4.5:1)`);
});

test('WCAG AA: приглушённый текст --ink-3 на белом фоне должен давать хотя бы 4.5:1 (обычный текст мельче 18px)', () => {
  // --ink-3 используется как мелкий/приглушённый текст в местах мельче 18px: .pass-field .v.blank,
  // .board-foot, .q .scale, .panel .ctl .k, .tstep .det, .kv dt, .runway .axis/.tag, .station .lbl,
  // .brow .meta, .legend-row .txt.na — везде нужен порог именно обычного (не крупного) текста.
  const ink3 = readToken('ink-3'); // #7B7A9E
  const ratio = contrastRatio(ink3, '#FFFFFF');
  assert.ok(ratio >= 4.5, `--ink-3 на белом даёт только ${ratio.toFixed(2)}:1 (нужно >=4.5:1)`);
});
