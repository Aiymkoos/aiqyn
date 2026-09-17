// Открытка города — генеративная иллюстрация. Чужие фотографии кампусов брать нельзя
// (правило кейса), поэтому картинка рисуется из id вуза: зерно задаёт цвета неба и холмов,
// ключ города — силуэт. Работает без сети. В данных есть поле photo: лицензированное фото
// со ссылкой вытеснит рисунок, не трогая вёрстку.
const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rnd = (seed) => { let x = seed || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; }; };

export function hueOf(id) { return hash(id) % 360; }

const SKYLINES = {
  almaty: (r, c) => `
    <path d="M0 150 L60 92 L110 122 L170 70 L230 118 L290 84 L340 112 L400 90 L400 200 L0 200Z" fill="${c.far}"/>
    <path d="M60 92 L74 104 L84 96 L96 108 L110 122" stroke="#fff" stroke-width="5" fill="none" opacity=".8"/>
    <path d="M170 70 L184 84 L196 76 L214 96 L230 118" stroke="#fff" stroke-width="5" fill="none" opacity=".8"/>
    <path d="M0 170 L80 140 L160 160 L260 132 L400 158 L400 200 L0 200Z" fill="${c.near}"/>
    <g fill="${c.ink}">${Array.from({ length: 12 }, (_, i) => { const x = 20 + i * 32; const h = 20 + r() * 34; return `<rect x="${x}" y="${190 - h}" width="18" height="${h}" rx="1"/>`; }).join('')}</g>`,
  astana: (r, c) => `
    <path d="M0 160 L400 150 L400 200 L0 200Z" fill="${c.far}"/>
    <g fill="${c.ink}">${Array.from({ length: 10 }, (_, i) => { const x = 10 + i * 40; const h = 24 + r() * 60; return `<rect x="${x}" y="${182 - h}" width="${14 + r() * 12}" height="${h}" rx="1"/>`; }).join('')}</g>
    <g><line x1="300" y1="182" x2="300" y2="70" stroke="${c.ink}" stroke-width="6"/><circle cx="300" cy="62" r="18" fill="${c.sun}" stroke="${c.ink}" stroke-width="4"/>
    <path d="M280 182 L300 100 L320 182" fill="none" stroke="${c.ink}" stroke-width="3"/></g>
    <path d="M0 182 L400 178 L400 200 L0 200Z" fill="${c.near}"/>`,
  karaganda: (r, c) => `
    <path d="M0 150 L400 156 L400 200 L0 200Z" fill="${c.far}"/>
    <g fill="${c.ink}">${Array.from({ length: 9 }, (_, i) => { const x = 16 + i * 44; const h = 26 + r() * 40; return `<rect x="${x}" y="${182 - h}" width="24" height="${h}" rx="1"/>`; }).join('')}
    <rect x="330" y="80" width="10" height="102"/><rect x="352" y="96" width="8" height="86"/></g>
    <g fill="#fff" opacity=".5"><ellipse cx="338" cy="70" rx="14" ry="8"/><ellipse cx="360" cy="84" rx="10" ry="6"/></g>
    <path d="M0 182 L400 180 L400 200 L0 200Z" fill="${c.near}"/>`,
  shymkent: (r, c) => `
    <path d="M0 160 Q100 110 200 150 T400 140 L400 200 L0 200Z" fill="${c.far}"/>
    <g fill="${c.ink}">${Array.from({ length: 10 }, (_, i) => { const x = 14 + i * 38; const h = 16 + r() * 30; return `<rect x="${x}" y="${184 - h}" width="22" height="${h}" rx="1"/>`; }).join('')}
    <path d="M250 184 L250 130 Q272 100 294 130 L294 184Z"/><rect x="304" y="120" width="6" height="64"/></g>
    <path d="M0 184 L400 182 L400 200 L0 200Z" fill="${c.near}"/>`,
  kaskelen: (r, c) => `
    <path d="M0 130 L80 96 L150 124 L240 86 L320 120 L400 100 L400 200 L0 200Z" fill="${c.far}"/>
    <path d="M240 86 L252 98 L262 92 L276 104" stroke="#fff" stroke-width="4" fill="none" opacity=".8"/>
    <path d="M0 168 L120 150 L240 164 L400 148 L400 200 L0 200Z" fill="${c.near}"/>
    <g fill="${c.ink}">${Array.from({ length: 7 }, (_, i) => { const x = 60 + i * 42; const h = 18 + r() * 22; return `<rect x="${x}" y="${190 - h}" width="26" height="${h}" rx="1"/>`; }).join('')}</g>`,
  default: (r, c) => `
    <path d="M0 150 Q120 100 220 140 T400 130 L400 200 L0 200Z" fill="${c.far}"/>
    <path d="M0 176 Q160 150 400 172 L400 200 L0 200Z" fill="${c.near}"/>
    <g fill="${c.ink}">${Array.from({ length: 9 }, (_, i) => { const x = 20 + i * 42; const h = 18 + r() * 32; return `<rect x="${x}" y="${188 - h}" width="22" height="${h}" rx="1"/>`; }).join('')}</g>`,
};

export function postcard(uni, { title = true } = {}) {
  if (uni.photo?.src) {
    return `<figure class="postcard"><img src="${uni.photo.src}" alt="${uni.photo.alt ?? uni.short}" loading="lazy"></figure>`;
  }
  const h = hueOf(uni.id);
  const r = rnd(hash(uni.id));
  const c = {
    sky1: `hsl(${h} 70% 88%)`, sky2: `hsl(${(h + 30) % 360} 60% 70%)`,
    sun: `hsl(${(h + 40) % 360} 90% 65%)`,
    far: `hsl(${h} 35% 62%)`, near: `hsl(${h} 40% 44%)`, ink: `hsl(${h} 35% 22%)`,
  };
  const draw = SKYLINES[uni.postcard] ?? SKYLINES.default;
  const sunX = 60 + r() * 200, sunY = 40 + r() * 40;
  return `<figure class="postcard" aria-label="Иллюстрация: ${uni.city}, сгенерирована из названия вуза">
    <svg viewBox="0 0 400 200" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="sky-${uni.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.sky1}"/><stop offset="1" stop-color="${c.sky2}"/></linearGradient></defs>
      <rect width="400" height="200" fill="url(#sky-${uni.id})"/>
      <circle cx="${sunX}" cy="${sunY}" r="22" fill="${c.sun}"/>
      ${draw(r, c)}
      ${title ? `<text x="14" y="26" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700" letter-spacing="2" fill="${c.ink}" opacity=".85">${uni.code}</text>` : ''}
    </svg>
  </figure>`;
}
