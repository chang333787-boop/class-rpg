// 그림 — 물감 통 · 색 바퀴(SVG) · 자연 그림 여섯(칠할 곳 = .pnt) · 색 견주기 카드
import { h } from './util.js';
import { WHEEL, mix, hex } from './color.js';

const NS = 'http://www.w3.org/2000/svg';
export const svgEl = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) e.setAttribute(k, v); for (const k of kids.flat()) if (k) e.append(k); return e; };
const fromStr = s => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstChild; };
export const PAPER = '#f6f0e4';
const shade = (c, f) => { const v = c.match(/\w\w/g).map(x => parseInt(x, 16)); return '#' + v.map(x => Math.max(0, Math.min(255, Math.round(x * f))).toString(16).padStart(2, '0')).join(''); };

// 물감 통 — 몸통(금속) · 색 띠 · 어깨 · 뚜껑(아래로 짜는 모양)
export function tubeSvg(css, k = '') {
  const cap = css === '#ffffff' ? '#d9d2c4' : shade(css, 0.72);
  return fromStr(`<svg class="tube-svg" viewBox="0 0 60 92" aria-hidden="true">
  <path d="M9 4h42l-3 7H12z" fill="#b9b0a2"/><path d="M13 8h34" stroke="#8f8677" stroke-width="1.5"/>
  <rect x="12" y="10" width="36" height="56" rx="7" fill="#ece6da"/>
  <rect x="12" y="22" width="36" height="32" fill="${css}"/>
  <rect x="12" y="22" width="36" height="32" fill="url(#tg${k})" opacity=".35"/>
  <path d="M17 66h26l-5 9H22z" fill="#e2dccf"/>
  <rect x="21" y="74" width="18" height="15" rx="4" fill="${cap}"/>
  <rect x="24" y="76" width="3" height="11" rx="1.5" fill="#fff" opacity=".35"/>
  <defs><linearGradient id="tg${k}" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".0"/><stop offset=".25" stop-color="#fff" stop-opacity=".9"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
</svg>`);
}

// 색 바퀴 — 12칸 고리(12시 = 빨강 · 시계 방향). colors[i] = 칠한 색(없으면 빈 칸 점선) · onPick(i)
export function wheelSvg({ colors, size = 300, active = -1, labels = true, onPick = null, mark = [], lines = [], center = null }) {
  const c = 150, R = labels ? 112 : 136, r = labels ? 54 : 62;
  const pt = (rad, deg) => { const a = (deg - 90) * Math.PI / 180; return [c + rad * Math.cos(a), c + rad * Math.sin(a)]; };
  const wedge = i => { const a0 = i * 30 - 15, a1 = i * 30 + 15, [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1), [x2, y2] = pt(r, a1), [x3, y3] = pt(r, a0);
    return `M${x0} ${y0}A${R} ${R} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r} ${r} 0 0 0 ${x3} ${y3}Z`; };
  const svg = svgEl('svg', { class: 'wheel' + (onPick ? ' pick' : ''), viewBox: '0 0 300 300', width: size, height: size, role: 'img', 'aria-label': '색 바퀴' });
  svg.append(svgEl('circle', { cx: c, cy: c, r: R + 4, fill: '#1d1611' }));
  WHEEL.forEach(([name], i) => {
    const col = colors[i], g = svgEl('g', { class: 'wd' + (i === active ? ' on' : '') + (mark.includes(i) ? ' mk' : ''), 'data-i': i });
    g.append(svgEl('path', { d: wedge(i), fill: col || PAPER, stroke: col ? '#1d1611' : '#8a7a66', 'stroke-width': col ? 2 : 1.6, 'stroke-dasharray': col ? null : '5 4', class: 'wp' }));
    if (!col) { const [x, y] = pt((R + r) / 2, i * 30); g.append(svgEl('text', { x, y: y + 5, 'text-anchor': 'middle', class: 'wq' }, document.createTextNode('?'))); }
    if (labels) { const [x, y] = pt(R + 17, i * 30); g.append(svgEl('text', { x, y: y + 4, 'text-anchor': 'middle', class: 'wl' }, document.createTextNode(name))); }
    if (onPick) g.addEventListener('click', () => onPick(i));
    svg.append(g);
  });
  //  고른 칸 · 짝 표시는 맨 위에(이웃 칸에 가리지 않게)
  for (const i of [active, ...mark].filter(i => i >= 0)) svg.append(svgEl('path', { d: wedge(i), fill: 'none', stroke: i === active ? '#ffc766' : '#fff', 'stroke-width': 4, 'pointer-events': 'none', class: 'wring' }));
  svg.append(svgEl('circle', { cx: c, cy: c, r: r - 8, fill: center || '#241b13', class: 'wc' }));
  for (const [a, b] of lines) { const [x0, y0] = pt(r - 2, a * 30), [x1, y1] = pt(r - 2, b * 30); svg.append(svgEl('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: '#ffc766', 'stroke-width': 4, 'stroke-linecap': 'round', class: 'wline' })); }
  return svg;
}
export const wheelColors = (mine = {}) => WHEEL.map(([, d], i) => mine[i] || ([0, 4, 8].includes(i) ? hex(mix(d)) : null));

// 색 견주기 — 목표 | 내 색 (붙여 놓아야 눈이 차이를 잘 본다)
export function compareCard(targetHex, label = '목표') {
  const mine = h('div', { class: 'cmp-m' }, h('span', { class: 'cmp-e' }, '물감을 넣어요'));
  const el = h('div', { class: 'cmp' }, h('div', { class: 'cmp-row' }, h('div', { class: 'cmp-t', style: { background: targetHex } }), mine),
    h('div', { class: 'cmp-lab' }, h('span', {}, label), h('span', {}, '내 색')));
  return { el, set(rgbHex) { mine.style.background = rgbHex || ''; mine.classList.toggle('is-empty', !rgbHex); } };
}

// ── 자연 그림(400 × 260) — 칠할 곳은 class="pnt" · 그 위 그늘 · 빛은 반투명이라 아이가 칠한 색이 그대로 보인다 ──
const SCENES = {
  sprout: `<rect width="400" height="260" fill="#e4f2ff"/><circle cx="330" cy="54" r="26" fill="#fff6c9"/>
    <path d="M0 214 Q200 176 400 214 V260 H0Z" fill="#7a5236"/><path d="M0 230 Q200 200 400 230" stroke="#5f3e28" stroke-width="3" fill="none" opacity=".5"/>
    <ellipse cx="120" cy="232" rx="9" ry="5" fill="#9b7a5c"/><ellipse cx="292" cy="238" rx="12" ry="6" fill="#9b7a5c"/>
    <path d="M200 206 C198 176 204 150 200 122" stroke="#5f8f3a" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path class="pnt" d="M200 128 C170 92 120 92 98 110 C122 140 172 146 200 128Z"/><path class="pnt" d="M202 120 C228 80 282 72 306 90 C286 124 236 136 202 120Z"/>
    <path d="M200 128 C170 112 140 106 112 110 M202 120 C232 104 262 96 292 92" stroke="#fff" stroke-width="2.5" fill="none" opacity=".45"/>
    <path d="M200 128 C170 92 120 92 98 110 C122 140 172 146 200 128Z" fill="#000" opacity=".08" transform="translate(0 6) scale(1 .96)"/>
    <circle cx="150" cy="104" r="5" fill="#fff" opacity=".7"/><circle cx="272" cy="92" r="4" fill="#fff" opacity=".7"/>`,
  sunset: `<rect class="pnt" width="400" height="200"/><rect width="400" height="200" fill="url(#skyTop)"/>
    <circle cx="200" cy="176" r="38" fill="#fff1c2"/><circle cx="200" cy="176" r="52" fill="#fff1c2" opacity=".25"/>
    <path d="M0 172 Q90 120 180 168 Q250 132 320 160 Q370 140 400 150 V260 H0Z" fill="#3c2a46"/><path d="M0 206 Q120 170 230 204 Q320 180 400 196 V260 H0Z" fill="#271c31"/>
    <path d="M86 70 q8 -8 16 0 q8 -8 16 0 M128 50 q6 -6 12 0 q6 -6 12 0" stroke="#2a1d33" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <defs><linearGradient id="skyTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1838" stop-opacity=".35"/><stop offset=".6" stop-color="#2b1838" stop-opacity="0"/></linearGradient></defs>`,
  field: `<rect width="400" height="260" fill="#d6ecff"/><path d="M0 104 Q100 70 210 98 Q300 74 400 96 V130 H0Z" fill="#7fae67"/>
    <path class="pnt" d="M0 122 H400 V260 H0Z"/>
    <g stroke="#000" stroke-width="3" fill="none" opacity=".16"><path d="M0 150 Q200 136 400 150"/><path d="M0 182 Q200 164 400 182"/><path d="M0 220 Q200 198 400 220"/></g>
    <g stroke="#4f8a34" stroke-width="3" stroke-linecap="round" fill="none">${[40, 110, 180, 250, 320].map(x => `<path d="M${x} 148 l-5 -9 M${x} 148 l5 -10"/><path d="M${x + 20} 180 l-6 -11 M${x + 20} 180 l6 -12"/>`).join('')}</g>
    <path d="M0 122 H400" stroke="#fff" stroke-width="2" opacity=".3"/>`,
  rock: `<rect width="400" height="260" fill="#9ccb72"/><path d="M0 170 Q120 150 240 176 Q320 192 400 172 V226 Q300 244 200 230 Q90 214 0 232Z" fill="#7cc3e6"/>
    <path d="M30 196 q30 -8 60 0 M250 208 q34 -8 68 0" stroke="#fff" stroke-width="3" fill="none" opacity=".6" stroke-linecap="round"/>
    <path class="pnt" d="M112 186 C104 122 160 84 222 92 C290 100 318 150 300 192 C270 212 150 214 112 186Z"/>
    <path d="M150 112 C176 96 222 94 252 108 C230 104 186 108 160 128Z" fill="#fff" opacity=".28"/>
    <path d="M114 186 C150 210 270 212 300 192 C296 202 280 214 206 214 C150 214 124 202 114 186Z" fill="#000" opacity=".22"/>
    <g fill="#5d9a3e">${[60, 340, 90, 360].map((x, k) => `<path d="M${x} ${150 + k * 6} l4 -16 l4 16 l4 -12 l3 12z"/>`).join('')}</g>
    <ellipse cx="330" cy="200" rx="14" ry="8" fill="#b9b2a6"/><ellipse cx="80" cy="214" rx="10" ry="6" fill="#b9b2a6"/>`,
  sea: `<rect width="400" height="64" fill="#9edaf3"/><path class="pnt" d="M0 56 Q50 48 100 56 T200 56 T300 56 T400 56 V260 H0Z"/>
    <path d="M60 56 L20 260 H80Z M200 56 L170 260 H230Z M330 56 L300 260 H350Z" fill="#fff" opacity=".07"/>
    <rect y="140" width="400" height="120" fill="#000" opacity=".12"/>
    <g fill="#f08c2e"><path d="M120 130 q22 -14 44 0 q-22 14 -44 0z M164 130 l12 -9 v18z"/><path d="M262 178 q18 -11 36 0 q-18 11 -36 0z M298 178 l10 -7 v14z"/></g>
    <g fill="#fff" opacity=".9"><circle cx="128" cy="128" r="2.5"/><circle cx="270" cy="176" r="2"/></g>
    <g stroke="#3e8f58" stroke-width="6" fill="none" stroke-linecap="round"><path d="M40 260 q-10 -30 4 -60 q12 -24 -2 -50"/><path d="M360 260 q12 -26 -2 -52 q-10 -20 4 -40"/></g>
    <g fill="#fff" opacity=".45"><circle cx="210" cy="110" r="4"/><circle cx="216" cy="92" r="3"/><circle cx="208" cy="76" r="2"/></g>`,
  blossom: `<rect width="400" height="260" fill="#dcefff"/>
    <path d="M-10 230 C80 200 140 170 220 150 C270 138 320 110 410 70" stroke="#6b4a3a" stroke-width="14" fill="none" stroke-linecap="round"/>
    <path d="M150 168 C160 130 150 110 170 86 M260 136 C276 112 300 104 316 82" stroke="#6b4a3a" stroke-width="7" fill="none" stroke-linecap="round"/>
    ${[[170, 82], [118, 176], [228, 140], [316, 78], [286, 120], [70, 206], [356, 92]].map(([x, y]) => `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map(a => `<ellipse class="pnt" cx="0" cy="-12" rx="9" ry="12" transform="rotate(${a})"/>`).join('')}<circle r="5" fill="#f2c14e"/></g>`).join('')}
    ${[[96, 110, 20], [240, 210, -30], [330, 190, 40], [40, 120, 10]].map(([x, y, a]) => `<ellipse class="pnt" cx="${x}" cy="${y}" rx="6" ry="9" transform="rotate(${a} ${x} ${y})"/>`).join('')}`,
};
export function sceneEl(name, label, targetHex) {
  const svg = fromStr(`<svg class="scene" viewBox="0 0 400 260" role="img" aria-label="${label}">${SCENES[name]}</svg>`);
  const card = h('div', { class: 'obs' }, h('span', { class: 'obs-c', style: { background: targetHex } }), h('span', {}, h('b', {}, '관찰 카드'), h('span', {}, label)));
  const el = h('div', { class: 'scene-wrap' }, svg, card);
  const paint = c => svg.querySelectorAll('.pnt').forEach(p => { p.setAttribute('fill', c || PAPER); p.setAttribute('stroke', c ? 'none' : '#8a7a66'); p.setAttribute('stroke-dasharray', c ? '' : '6 5'); p.setAttribute('stroke-width', c ? 0 : 2); });
  paint(null);
  return { el, paint };
}
export const SCENE_KEYS = Object.keys(SCENES);
