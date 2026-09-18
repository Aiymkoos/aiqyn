// Профиль абитуриента и прогресс. Хранится в браузере (localStorage) — без бэкенда,
// как разрешает кейс. Профиль можно упаковать в ссылку и открыть на другом устройстве.
const KEY = 'aiqyn.v1';

export const defaultProfile = () => ({
  interests: [],
  ent: null,            // балл ЕНТ или null — «пока не знаю»
  budget: null,         // null — не знаю; 0 — только грант; число — ₸ в год
  languages: [],
  cities: [],
  relocate: false,
  dorm: null,           // true — нужно; false — не нужно; null — не важно/не ответил
  important: [],        // что важнее всего (для сравнения)
  answered: {},         // какие вопросы отвечены
  done: {},             // отмеченные шаги плана
  compare: [],          // id вузов для сравнения
  target: null,         // id выбранного вуза («мой выбор»)
});

// Приводит произвольный объект (пришедший из ссылки `#/board?p=...` или из localStorage,
// который мог отредактировать кто угодно) к безопасной форме профиля. Ничего не выбрасывает
// без причины — то, что не удалось безопасно привести к ожидаемому типу, становится тем же
// значением, что и «не отвечено» (null/[]/{}), а не мусором, на котором упадёт js/ui/*.
const asStringArray = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
const asFiniteOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const asBoolOrNull = (v) => (v === true || v === false ? v : null);
const asPlainObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

function sanitizeProfile(raw) {
  return {
    ...defaultProfile(),
    interests: asStringArray(raw.interests),
    ent: asFiniteOrNull(raw.ent),
    budget: asFiniteOrNull(raw.budget), // 0 — «только грант» — остаётся 0, это конечное число
    languages: asStringArray(raw.languages),
    cities: asStringArray(raw.cities),
    relocate: raw.relocate === true,
    dorm: asBoolOrNull(raw.dorm),
    important: asStringArray(raw.important),
    answered: asPlainObject(raw.answered),
    done: asPlainObject(raw.done),
    compare: asStringArray(raw.compare),
    target: typeof raw.target === 'string' ? raw.target : null,
  };
}

let profile = defaultProfile();
const listeners = new Set();

export const getProfile = () => profile;
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = (patch) => listeners.forEach((fn) => fn(profile, patch));

export function update(patch) {
  profile = { ...profile, ...patch };
  save();
  emit(patch);
  return profile;
}

export function reset() {
  profile = defaultProfile();
  save();
  emit({});
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* приватный режим — работаем без сохранения */ }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) profile = sanitizeProfile(JSON.parse(raw));
  } catch { profile = defaultProfile(); }
  return profile;
}

// Сколько из шести вопросов отвечено, и какой первый неотвеченный
export const QUESTIONS = ['interests', 'ent', 'budget', 'languages', 'cities', 'dorm'];
export function answeredCount(p = profile) { return QUESTIONS.filter((q) => p.answered?.[q]).length; }
export function firstUnanswered(p = profile) { const i = QUESTIONS.findIndex((q) => !p.answered?.[q]); return i === -1 ? null : i + 1; }
export function profileComplete(p = profile) { return (p.interests?.length ?? 0) > 0 && QUESTIONS.every((q) => p.answered?.[q]); }

// Ссылка с профилем — для родителей или второго устройства
export function encodeProfile(p = profile) {
  const slim = { interests: p.interests, ent: p.ent, budget: p.budget, languages: p.languages, cities: p.cities, relocate: p.relocate, dorm: p.dorm, important: p.important, answered: p.answered, target: p.target };
  const json = JSON.stringify(slim);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeProfile(s) {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(b64)));
    const p = JSON.parse(json);
    if (!p || typeof p !== 'object' || !Array.isArray(p.interests)) return null;
    return sanitizeProfile(p);
  } catch { return null; }
}
