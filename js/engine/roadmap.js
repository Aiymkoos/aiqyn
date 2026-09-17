// План поступления: шаги зависят от профиля и выбранного вуза. У каждой даты — происхождение.
import { val, provenance } from './facts.js';

export function buildRoadmap(profile, top, ctx) {
  const { calendar, entProfile, entCommon, directionLabel } = ctx;
  const steps = [];
  const dirs = profile.interests ?? [];
  const uni = top?.uni ?? null;
  const add = (s) => steps.push({ done: false, ...s });

  const subjects = dirs.map((d) => `${directionLabel(d)}: ${(val(entProfile[d]) ?? ['уточнить']).join(' + ')}`);
  add({
    id: 'subjects', phase: 'Подготовка', title: 'Выбрать профильные предметы ЕНТ под свою группу программ',
    why: 'Три предмета сдают все, а два профильных зависят от направления. Ошибка здесь закрывает грант на год.',
    detail: [`Обязательные: ${entCommon.join(', ')}`, ...subjects],
    when: { text: 'сейчас', prov: { kind: 'fact', label: 'логика' } },
  });

  if (profile.ent == null) {
    add({
      id: 'mock', phase: 'Подготовка', title: 'Сдать пробное ЕНТ и записать балл в профиль',
      why: 'Без балла мы не можем проверить пороги вузов и шансы на грант — достоверность подбора ниже.',
      when: { text: 'ближайший месяц', prov: { kind: 'fact', label: 'логика' } },
    });
  } else if (top?.grant && top.grant.diff < 0) {
    add({
      id: 'raise', phase: 'Подготовка', title: `Добрать ${-top.grant.diff} баллов до прошлогоднего проходного на грант (${top.grant.pass})`,
      why: `${uni.short}: прошлогодний проходной по группе «${top.grant.name}» — ${top.grant.pass}, у тебя ${profile.ent}. Это ориентир, не гарантия.`,
      when: { text: 'до основного ЕНТ', prov: { kind: 'fact', label: 'логика' } },
    });
  }

  add({
    id: 'register', phase: 'ЕНТ', title: calendar.entRegistration.label,
    why: 'Регистрация проходит на сайте Национального центра тестирования. Без неё на ЕНТ не попасть.',
    when: { text: val(calendar.entRegistration.when), prov: provenance(calendar.entRegistration.when), note: calendar.entRegistration.note },
  });
  add({
    id: 'ent', phase: 'ЕНТ', title: calendar.entMain.label,
    why: 'Максимум 140 баллов. Пороги: 50 обычные вузы, 65 национальные, 70 медицина, 75 педагогика и право.',
    when: { text: val(calendar.entMain.when), prov: provenance(calendar.entMain.when), note: calendar.entMain.note },
  });

  if (profile.budget === 0 || (profile.budget ?? 0) > 0) {
    add({
      id: 'grant', phase: 'Конкурс', title: calendar.grantApply.label,
      why: `В заявке указывают одну группу программ и до четырёх вузов${uni ? ` — например, ${uni.short}` : ''}. Подать можно онлайн.`,
      when: { text: val(calendar.grantApply.when), prov: provenance(calendar.grantApply.when), note: calendar.grantApply.note },
    });
    add({
      id: 'results', phase: 'Конкурс', title: calendar.grantResults.label,
      why: 'Если гранта нет — есть платное: сравни стоимость со своим бюджетом и скидками вуза за балл.',
      when: { text: val(calendar.grantResults.when), prov: provenance(calendar.grantResults.when), note: calendar.grantResults.note },
    });
  }

  add({
    id: 'docs', phase: 'Зачисление', title: uni ? `Подать документы в ${uni.short}` : calendar.enroll.label,
    why: 'Аттестат, сертификат ЕНТ, фото, медсправка. Точный список — на сайте вуза.',
    detail: uni ? [`Сайт вуза: ${uni.website}`] : [],
    when: { text: val(calendar.enroll.when), prov: provenance(calendar.enroll.when), note: calendar.enroll.note },
  });

  if (profile.dorm === true) {
    add({
      id: 'dorm', phase: 'Зачисление', title: 'Подать заявку на общежитие',
      why: uni && val(uni.dorm) === false ? `${uni.short}: общежития нет — заранее искать жильё.` : 'Места дают в порядке очереди — заявка сразу после зачисления.',
      when: { text: 'сразу после зачисления', prov: { kind: 'fact', label: 'логика' } },
    });
  }

  return steps;
}

export function nextStep(steps, done = {}) {
  return steps.find((s) => !done[s.id]) ?? null;
}

export function progress(steps, done = {}) {
  const total = steps.length;
  const n = steps.filter((s) => done[s.id]).length;
  return { done: n, total, percent: total ? Math.round((n / total) * 100) : 0 };
}
