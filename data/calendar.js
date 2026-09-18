import { fact, demo } from '../js/engine/facts.js';
// Ключевые даты приёмной кампании. Даты 2027 года ещё не опубликованы — пока используем
// ориентир по кампании 2026 года и честно помечаем это. Заменяются на fact(...) по мере проверки.
// Пороговые баллы ЕНТ для участия в конкурсе (2026): источник — брифинг НЦТ, nur.kz от 26.02.2026
export const THRESHOLDS = fact({ national: 65, pedagogy: 75, law: 75, medicine: 70, agriculture: 50, other: 50 },
  'https://www.nur.kz/society/2348017-porogovye-bally-i-granty-vypusknikam-kazahstana-raskryli-informaciyu-po-ent-2026/', '2026-09-18');

export const CALENDAR = {
  entRegistration: { label: 'Регистрация на основное ЕНТ', when: demo('апрель 2027'), note: 'ориентир по прошлому году' },
  entMain:         { label: 'Основное ЕНТ',                 when: demo('май — июль 2027'), note: 'ориентир по прошлому году' },
  grantApply:      { label: 'Приём заявлений на грант',     when: fact('13–20 июля', 'https://testcenter.kz/?lang=ru&page_id=15638', '2026-09-18', 'даты кампании 2026 по данным НЦТ; на 2027 ещё не опубликованы'), note: 'так было в 2026' },
  grantResults:    { label: 'Итоги конкурса грантов',       when: demo('до 10 августа 2027'), note: 'ориентир по прошлому году' },
  enroll:          { label: 'Подача документов в вуз',      when: demo('до 25 августа 2027'), note: 'ориентир по прошлому году' },
};

// Обязательные предметы ЕНТ одинаковы для всех; два профильных зависят от группы программ.
export const ENT_COMMON = ['История Казахстана', 'Математическая грамотность', 'Грамотность чтения'];
export const ENT_PROFILE = {
  it:           demo(['Математика', 'Информатика или Физика']),
  engineering:  demo(['Математика', 'Физика']),
  business:     demo(['Математика', 'География']),
  medicine:     demo(['Биология', 'Химия']),
  law:          demo(['История', 'Основы права']),
  education:    demo(['зависит от предмета преподавания']),
  humanities:   demo(['Иностранный язык', 'Всемирная история']),
  science:      demo(['Биология', 'Химия']),
  design:       demo(['Творческий экзамен вместо профильных']),
  architecture: demo(['Математика', 'Физика']),
};
