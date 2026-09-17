// Направления, которые выбирает абитуриент, и группы образовательных программ (ГОП),
// по которым в Казахстане проводится конкурс на грант. Коды ГОП уточняются по
// официальному классификатору; пока не подтверждены — проходные баллы помечены demo.
export const DIRECTIONS = [
  { id: 'it',           label: 'IT и программирование',        gops: ['B057'] },
  { id: 'engineering',  label: 'Инженерия и энергетика',       gops: ['B062', 'B063'] },
  { id: 'business',     label: 'Бизнес, экономика, финансы',   gops: ['B044', 'B046'] },
  { id: 'medicine',     label: 'Медицина',                     gops: ['B084'] },
  { id: 'law',          label: 'Право',                        gops: ['B049'] },
  { id: 'education',    label: 'Педагогика',                   gops: ['B003', 'B011'] },
  { id: 'humanities',   label: 'Языки и гуманитарные науки',   gops: ['B036', 'B032'] },
  { id: 'science',      label: 'Естественные науки',           gops: ['B050', 'B052'] },
  { id: 'design',       label: 'Дизайн и искусство',           gops: ['B031'] },
  { id: 'architecture', label: 'Архитектура и строительство',  gops: ['B073', 'B074'] },
];
export const directionLabel = (id) => DIRECTIONS.find((d) => d.id === id)?.label ?? id;

export const CITIES = ['Алматы', 'Астана', 'Шымкент', 'Караганда', 'Актобе', 'Павлодар', 'Усть-Каменогорск', 'Семей', 'Костанай', 'Атырау'];

export const LANGS = [
  { id: 'kz', label: 'Казахский' },
  { id: 'ru', label: 'Русский' },
  { id: 'en', label: 'Английский' },
];
export const langLabel = (id) => LANGS.find((l) => l.id === id)?.label ?? id;
