import { fact, demo, unknown } from '../js/engine/facts.js';
// Вузы Казахстана, бакалавриат. Каждое значение — fact (с источником и датой проверки),
// demo (демонстрационное) или unknown (нет данных). Стоимость — за год обучения, ₸.
// Статус на старте: демонстрационные данные; заменяются на fact по мере проверки сайтов.
export const UNIVERSITIES = [
  {
    id: 'kaznu', code: 'ALA·KZNU', short: 'КазНУ', name: 'Казахский национальный университет им. аль-Фараби',
    city: 'Алматы', type: 'national', website: 'https://farabi.university', postcard: 'almaty',
    threshold: demo(65), languages: demo(['kz', 'ru', 'en']), dorm: demo(true),
    programs: [
      { direction: 'it', gop: 'B057', name: 'Информационные системы', tuition: demo(1_900_000) },
      { direction: 'business', gop: 'B046', name: 'Финансы', tuition: demo(1_700_000) },
      { direction: 'law', gop: 'B049', name: 'Юриспруденция', tuition: demo(1_700_000) },
      { direction: 'science', gop: 'B050', name: 'Биология', tuition: demo(1_500_000) },
      { direction: 'humanities', gop: 'B036', name: 'Переводческое дело', tuition: demo(1_500_000) },
    ],
  },
  {
    id: 'kbtu', code: 'ALA·KBTU', short: 'КБТУ', name: 'Казахстанско-Британский технический университет',
    city: 'Алматы', type: 'private', website: 'https://kbtu.edu.kz', postcard: 'almaty',
    threshold: demo(75), languages: demo(['en', 'ru']), dorm: demo(true),
    programs: [
      { direction: 'it', gop: 'B057', name: 'Информационные системы', tuition: demo(2_900_000) },
      { direction: 'engineering', gop: 'B062', name: 'Электроэнергетика', tuition: demo(2_600_000) },
      { direction: 'business', gop: 'B046', name: 'Финансы', tuition: demo(2_700_000) },
    ],
    discounts: [{ minEnt: 120, percent: 50, note: 'демо' }, { minEnt: 110, percent: 25, note: 'демо' }],
  },
  {
    id: 'satbayev', code: 'ALA·SATU', short: 'Satbayev University', name: 'Казахский национальный исследовательский технический университет им. К. Сатпаева',
    city: 'Алматы', type: 'national', website: 'https://satbayev.university', postcard: 'almaty',
    threshold: demo(65), languages: demo(['kz', 'ru', 'en']), dorm: demo(true),
    programs: [
      { direction: 'it', gop: 'B057', name: 'Программная инженерия', tuition: demo(1_600_000) },
      { direction: 'engineering', gop: 'B062', name: 'Электроэнергетика', tuition: demo(1_400_000) },
      { direction: 'architecture', gop: 'B073', name: 'Архитектура', tuition: demo(1_400_000) },
    ],
  },
  {
    id: 'enu', code: 'NQZ·ENU', short: 'ЕНУ', name: 'Евразийский национальный университет им. Л. Н. Гумилёва',
    city: 'Астана', type: 'national', website: 'https://enu.kz', postcard: 'astana',
    threshold: demo(65), languages: demo(['kz', 'ru', 'en']), dorm: demo(true),
    programs: [
      { direction: 'it', gop: 'B057', name: 'Информационные системы', tuition: demo(1_500_000) },
      { direction: 'law', gop: 'B049', name: 'Юриспруденция', tuition: demo(1_400_000) },
      { direction: 'humanities', gop: 'B032', name: 'Филология', tuition: demo(1_200_000) },
      { direction: 'architecture', gop: 'B074', name: 'Строительство', tuition: demo(1_300_000) },
    ],
  },
  {
    id: 'aitu', code: 'NQZ·AITU', short: 'Astana IT University', name: 'Astana IT University',
    city: 'Астана', type: 'state', website: 'https://astanait.edu.kz', postcard: 'astana',
    threshold: demo(75), languages: demo(['en', 'ru']), dorm: demo(true),
    programs: [
      { direction: 'it', gop: 'B057', name: 'Software Engineering', tuition: demo(2_200_000) },
    ],
  },
  {
    id: 'sdu', code: 'ALA·SDU', short: 'SDU', name: 'SDU University',
    city: 'Алматы', type: 'private', website: 'https://sdu.edu.kz', postcard: 'kaskelen',
    threshold: demo(70), languages: demo(['en', 'kz']), dorm: demo(true),
    programs: [
      { direction: 'it', gop: 'B057', name: 'Computer Science', tuition: demo(2_400_000) },
      { direction: 'business', gop: 'B044', name: 'Management', tuition: demo(2_000_000) },
      { direction: 'education', gop: 'B011', name: 'Информатика (педагогика)', tuition: demo(1_300_000) },
    ],
    discounts: [{ minEnt: 125, percent: 100, note: 'демо' }, { minEnt: 115, percent: 50, note: 'демо' }],
  },
  {
    id: 'kargu', code: 'KGF·KARU', short: 'КарУ им. Букетова', name: 'Карагандинский университет им. академика Е. А. Букетова',
    city: 'Караганда', type: 'state', website: 'https://buketov.edu.kz', postcard: 'karaganda',
    threshold: demo(50), languages: demo(['kz', 'ru']), dorm: demo(true),
    programs: [
      { direction: 'it', gop: 'B057', name: 'Информационные системы', tuition: demo(900_000) },
      { direction: 'education', gop: 'B003', name: 'Педагогика и психология', tuition: demo(750_000) },
      { direction: 'science', gop: 'B050', name: 'Биология', tuition: demo(800_000) },
    ],
  },
  {
    id: 'kaznmu', code: 'ALA·KNMU', short: 'КазНМУ', name: 'Казахский национальный медицинский университет им. С. Д. Асфендиярова',
    city: 'Алматы', type: 'national', website: 'https://kaznmu.edu.kz', postcard: 'almaty',
    threshold: demo(70), languages: demo(['kz', 'ru']), dorm: unknown('не проверено'),
    programs: [
      { direction: 'medicine', gop: 'B084', name: 'Медицина', tuition: demo(2_100_000) },
    ],
  },
  {
    id: 'sku', code: 'CIT·SKU', short: 'ЮКУ им. Ауэзова', name: 'Южно-Казахстанский университет им. М. Ауэзова',
    city: 'Шымкент', type: 'state', website: 'https://auezov.edu.kz', postcard: 'shymkent',
    threshold: demo(50), languages: demo(['kz', 'ru']), dorm: demo(true),
    programs: [
      { direction: 'it', gop: 'B057', name: 'Информационные системы', tuition: unknown('не проверено') },
      { direction: 'engineering', gop: 'B062', name: 'Электроэнергетика', tuition: demo(700_000) },
      { direction: 'architecture', gop: 'B074', name: 'Строительство', tuition: demo(700_000) },
    ],
  },
];
