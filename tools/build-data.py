# Собирает data/universities.js из сырых данных в tools/cache/ (см. README, раздел «Данные»).
# Каждое значение получает происхождение: fact(значение, ссылка, дата проверки) либо unknown().
# Запуск: python tools/build-data.py
import json, pathlib, datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / 'tools' / 'cache'
CHECKED = '2026-09-18'
UV = 'https://univision.kz'

# Направление продукта → группы образовательных программ (ГОП), по которым идёт конкурс на грант
DIR_GOPS = {
    'it': ['B057', 'B058'],
    'engineering': ['B062', 'B063', 'B064'],
    'business': ['B044', 'B046', 'B045', 'B047'],
    'law': ['B049'],
    'medicine': ['B086', 'B084', 'B085'],
    'education': ['B003', 'B001', 'B009', 'B011', 'B018'],
    'humanities': ['B036', 'B037'],
    'science': ['B050', 'B053', 'B054', 'B055', 'B051', 'B052'],
    'design': ['B031', 'B029', 'B030'],
    'architecture': ['B073', 'B074'],
}
GOP_NAMES = {
    'B057': 'Информационные технологии', 'B058': 'Информационная безопасность',
    'B062': 'Электротехника и энергетика', 'B063': 'Электротехника и автоматизация', 'B064': 'Механика и металлообработка',
    'B044': 'Менеджмент и управление', 'B045': 'Аудит и налогообложение', 'B046': 'Финансы, экономика, банковское и страховое дело', 'B047': 'Маркетинг и реклама',
    'B049': 'Право',
    'B084': 'Сестринское дело', 'B085': 'Фармация', 'B086': 'Общая медицина',
    'B001': 'Педагогика и психология', 'B003': 'Педагогика и методика начального обучения', 'B009': 'Подготовка учителей математики',
    'B011': 'Подготовка учителей информатики', 'B018': 'Подготовка учителей иностранного языка',
    'B036': 'Переводческое дело', 'B037': 'Филология',
    'B050': 'Биологические и смежные науки', 'B051': 'Окружающая среда', 'B052': 'Наука о земле', 'B053': 'Химия', 'B054': 'Физика', 'B055': 'Математика и статистика',
    'B031': 'Мода, дизайн', 'B029': 'Аудиовизуальные средства и медиапроизводство', 'B030': 'Изобразительное искусство',
    'B073': 'Архитектура', 'B074': 'Градостроительство, строительные работы и гражданское строительство',
}

# Справочные поля вузов. Языки обучения и общежитие пока не проверены по сайтам вузов — помечаются demo.
META = [
    dict(id='kaznu', code='ALA·KZNU', short='КазНУ им. аль-Фараби', name='Казахский национальный университет имени аль-Фараби', city='Алматы', type='national', website='https://farabi.university', postcard='almaty', langs=['kz', 'ru', 'en'], dorm=True),
    dict(id='kbtu', code='ALA·KBTU', short='КБТУ', name='Казахстанско-Британский технический университет', city='Алматы', type='private', website='https://kbtu.edu.kz', postcard='almaty', langs=['en', 'ru'], dorm=True),
    dict(id='satbayev', code='ALA·SATU', short='Satbayev University', name='Казахский национальный исследовательский технический университет имени К. И. Сатпаева', city='Алматы', type='national', website='https://satbayev.university', postcard='almaty', langs=['kz', 'ru', 'en'], dorm=True),
    dict(id='enu', code='NQZ·ENU', short='ЕНУ им. Гумилёва', name='Евразийский национальный университет имени Л. Н. Гумилёва', city='Астана', type='national', website='https://enu.kz', postcard='astana', langs=['kz', 'ru', 'en'], dorm=True),
    dict(id='aitu', code='NQZ·AITU', short='Astana IT University', name='Astana IT University', city='Астана', type='state', website='https://astanait.edu.kz', postcard='astana', langs=['en', 'ru'], dorm=True),
    dict(id='sdu', code='ALA·SDU', short='SDU University', name='SDU University (Университет имени Сулеймана Демиреля), Каскелен', city='Алматы', type='private', website='https://sdu.edu.kz', postcard='kaskelen', langs=['en', 'kz', 'ru'], dorm=True),
    dict(id='kargu', code='KGF·KARU', short='КарУ им. Букетова', name='Карагандинский университет имени академика Е. А. Букетова', city='Караганда', type='state', website='https://buketov.edu.kz', postcard='karaganda', langs=['kz', 'ru'], dorm=True),
    dict(id='kaznmu', code='ALA·KNMU', short='КазНМУ им. Асфендиярова', name='Казахский национальный медицинский университет имени С. Д. Асфендиярова', city='Алматы', type='national', website='https://kaznmu.edu.kz', postcard='almaty', langs=['kz', 'ru'], dorm=True),
    dict(id='sku', code='CIT·SKU', short='ЮКУ им. Ауэзова', name='Южно-Казахстанский университет имени М. Ауэзова', city='Шымкент', type='state', website='https://auezov.edu.kz', postcard='shymkent', langs=['kz', 'ru'], dorm=True),
    dict(id='kimep', code='ALA·KIMEP', short='КИМЭП', name='Университет КИМЭП', city='Алматы', type='private', website='https://kimep.kz', postcard='almaty', langs=['en'], dorm=True),
    dict(id='almau', code='ALA·ALMAU', short='AlmaU', name='Алматы Менеджмент Университет', city='Алматы', type='private', website='https://almau.edu.kz', postcard='almaty', langs=['ru', 'en', 'kz'], dorm=None),
    dict(id='iitu', code='ALA·IITU', short='МУИТ (IITU)', name='Международный университет информационных технологий', city='Алматы', type='private', website='https://iitu.edu.kz', postcard='almaty', langs=['ru', 'en', 'kz'], dorm=None),
    dict(id='kaznpu', code='ALA·KNPU', short='КазНПУ им. Абая', name='Казахский национальный педагогический университет имени Абая', city='Алматы', type='national', website='https://abaiuniversity.edu.kz', postcard='almaty', langs=['kz', 'ru'], dorm=True),
    dict(id='mua', code='NQZ·MUA', short='МУА', name='Медицинский университет Астана', city='Астана', type='state', website='https://amu.edu.kz', postcard='astana', langs=['kz', 'ru'], dorm=True),
    dict(id='kazatu', code='NQZ·KATU', short='КазАТУ им. Сейфуллина', name='Казахский агротехнический исследовательский университет имени С. Сейфуллина', city='Астана', type='state', website='https://kazatu.edu.kz', postcard='astana', langs=['kz', 'ru'], dorm=True),
    dict(id='kartu', code='KGF·KTU', short='КарТУ им. Сагинова', name='Карагандинский технический университет имени Абылкаса Сагинова', city='Караганда', type='state', website='https://kstu.kz', postcard='karaganda', langs=['kz', 'ru'], dorm=True),
    dict(id='narxoz', code='ALA·NARXOZ', short='Нархоз', name='Университет Нархоз', city='Алматы', type='private', website='https://narxoz.kz', postcard='almaty', langs=['ru', 'kz', 'en'], dorm=True),
    dict(id='turan', code='ALA·TURAN', short='Туран', name='Университет «Туран»', city='Алматы', type='private', website='https://turan-edu.kz', postcard='almaty', langs=['ru', 'kz', 'en'], dorm=None),
    dict(id='toraighyrov', code='PWQ·TOU', short='Торайгыров университет', name='Торайгыров университет (Павлодар)', city='Павлодар', type='state', website='https://tou.edu.kz', postcard='default', langs=['kz', 'ru'], dorm=True),
    dict(id='vktu', code='UKK·EKTU', short='ВКТУ им. Серикбаева', name='Восточно-Казахстанский технический университет имени Д. Серикбаева', city='Усть-Каменогорск', type='state', website='https://ektu.kz', postcard='default', langs=['kz', 'ru'], dorm=True),
    dict(id='kru', code='KSN·KRU', short='КРУ им. Байтурсынова', name='Костанайский региональный университет имени Ахмет Байтұрсынұлы', city='Костанай', type='state', website='https://kru.edu.kz', postcard='default', langs=['kz', 'ru'], dorm=True),
    dict(id='argu', code='AKX·ARU', short='АРУ им. Жубанова', name='Актюбинский региональный университет имени К. Жубанова', city='Актобе', type='state', website='https://aru.edu.kz', postcard='default', langs=['kz', 'ru'], dorm=True),
]

# Стоимость из других источников — там, где на univision её нет (ссылка, дата публикации источника)
ER10 = 'https://er10.kz/read/texnologii/obzory/universitety-almaty-skolko-stoit-bakalavriat-v-2025-godu/'
BES_KBTU = 'https://bes.media/news/postuplenie-v-kbtu-v-2026-godu-podrobnyy-gid-dlya-abiturientov/'
EXTRA_TUITION = {
    'kbtu': {d: (2_100_000, BES_KBTU, 'от 2,1 до 3 млн ₸ в год (35–50 тыс. ₸ за кредит), 2025/26') for d in ['it', 'engineering', 'business']},
    'kimep': {d: (4_352_700, ER10, '145 090 ₸ за кредит × 30 кредитов в год — стандартная нагрузка; 2025/26') for d in ['business', 'it', 'humanities', 'law']},
    'narxoz': {d: (1_300_000, ER10, 'от 1,3 до 1,86 млн ₸ в год, 2025/26') for d in ['business', 'it', 'law', 'science']},
}
# Вузы без данных на univision, но с известным набором направлений (платно)
EXTRA_DIRS = {'kimep': ['business', 'it', 'humanities', 'law'], 'mua': ['medicine'], 'argu': ['education', 'science', 'it', 'engineering', 'humanities']}


def js_str(s):
    return "'" + str(s).replace('\\', '\\\\').replace("'", "\\'") + "'"


def fact(v, src, note=None):
    n = f", {js_str(note)}" if note else ''
    return f"fact({v if isinstance(v, (int, float)) else js_str(v)}, {js_str(src)}, {js_str(CHECKED)}{n})"


def unknown(note):
    return f"unknown({js_str(note)})"


def demo(v, note=None):
    n = f", {js_str(note)}" if note else ''
    v = 'true' if v is True else 'false' if v is False else v if isinstance(v, (int, float)) else json.dumps(v, ensure_ascii=False).replace('"', "'")
    return f"demo({v}{n})"


def build():
    price = json.loads((CACHE / 'price.json').read_text(encoding='utf-8'))
    out = []
    for m in META:
        uv = json.loads((CACHE / f"univision-{m['id']}.json").read_text(encoding='utf-8'))
        ball_url = UV + uv['url']
        price_url = UV + price[m['id']]['url']
        gen = {row[0]: (int(row[1]), int(row[2])) for row in uv['g']}
        thr = {row[0]: int(row[1]) for row in uv['t']}
        best = price[m['id']]['best']
        programs = []
        dirs_here = set()
        for d, gops in DIR_GOPS.items():
            has = [g for g in gops if g in gen or g in thr]
            if has or d in best or d in EXTRA_TUITION.get(m['id'], {}) or d in EXTRA_DIRS.get(m['id'], []):
                dirs_here.add(d)
            # стоимость — одна на направление (минимальная по программам направления)
            if d in best:
                b = best[d]
                tuition = fact(b['p'], price_url, f"минимум по направлению: {b['c']}{(' ' + b['n']) if b['n'] else ''}, {price[m['id']]['h2'][0]}")
            elif d in EXTRA_TUITION.get(m['id'], {}):
                v, src, note = EXTRA_TUITION[m['id']][d]
                tuition = fact(v, src, note)
            else:
                tuition = unknown('стоимость не проверена')
            if not (has or d in dirs_here):
                continue
            if not has:
                programs.append(f"    {{ direction: '{d}', gop: null, name: {js_str({'it':'IT-программы','business':'Бизнес-программы','law':'Право','humanities':'Гуманитарные программы','medicine':'Медицина','education':'Педагогика','science':'Естественные науки','engineering':'Инженерия','design':'Дизайн','architecture':'Архитектура'}[d])}, tuition: {tuition}, grantPass: {unknown('гранты по этой группе не отслеживаются')}, threshold: {unknown('порог вуза не проверен')} }}")
                continue
            for g in has:
                gp = fact(gen[g][0], ball_url, f"итоги конкурса 2025: минимальный балл получивших грант в этом вузе по {g}, грантов {gen[g][1]}") if g in gen else unknown('в 2025 году грантов по этой группе в вузе не было')
                th = fact(thr[g], ball_url, f"пороговый балл вуза 2025 по {g}") if g in thr else unknown('порог вуза не проверен')
                programs.append(f"    {{ direction: '{d}', gop: '{g}', name: {js_str(GOP_NAMES[g])}, tuition: {tuition}, grantPass: {gp}, threshold: {th} }}")
        langs = demo(m['langs'], 'языки обучения по общедоступным сведениям, не проверены на сайте вуза')
        dorm = demo(m['dorm'], 'не проверено на сайте вуза') if m['dorm'] is not None else unknown('наличие общежития не проверено')
        out.append(f"""  {{
    id: '{m['id']}', code: '{m['code']}', short: {js_str(m['short'])}, name: {js_str(m['name'])},
    city: '{m['city']}', type: '{m['type']}', website: '{m['website']}', postcard: '{m['postcard']}',
    languages: {langs}, dorm: {dorm},
    programs: [
{chr(10).join(p + ',' for p in programs)}
    ],
  }}""")
    header = f"""import {{ fact, demo, unknown }} from '../js/engine/facts.js';
// Вузы Казахстана, бакалавриат. СГЕНЕРИРОВАНО tools/build-data.py из tools/cache/ — не править руками.
// Каждое значение хранится с происхождением: fact (ссылка + дата проверки {CHECKED}), demo, unknown.
// grantPass — минимальный балл ЕНТ получивших грант в этом вузе по группе программ в 2025 году
// (ориентир по прошлому конкурсу, не гарантия). threshold — пороговый балл вуза 2025.
// tuition — минимальная стоимость года по направлению.
export const UNIVERSITIES = [
"""
    (ROOT / 'data' / 'universities.js').write_text(header + ',\n'.join(out) + ',\n];\n', encoding='utf-8')
    names = ',\n'.join(f"  {k}: {js_str(v)}" for k, v in GOP_NAMES.items())
    (ROOT / 'data' / 'gops.js').write_text(f"// Названия групп образовательных программ (ГОП) бакалавриата. СГЕНЕРИРОВАНО tools/build-data.py\nexport const GOP_NAMES = {{\n{names},\n}};\n", encoding='utf-8')
    print(f"universities: {len(out)}, programs: {sum(len(o.splitlines()) - 7 for o in out)}")


if __name__ == '__main__':
    build()
