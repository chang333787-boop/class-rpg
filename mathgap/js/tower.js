// 탑 그리기 — 아이 화면 · 선생님 화면이 같이 쓴다. 층 = 단원 차시(아래 → 위) · 땅 아래 = 기초 층(옛 단원에서 처음 막힌 곳)
import { h } from './util.js';
import { unitLabel } from './core/lessons/index.js';

const NS = 'http://www.w3.org/2000/svg';
const FIRE_D = 'M12 2c1.2 3.6 5.5 5.6 5.5 10.6a5.5 5.5 0 0 1-11 0c0-2.2 1.1-3.9 2.3-5 0 2 1 3.2 2.2 3.2 0-3.2-1.2-6.1 1-8.8z';
// 불씨 그림 — on: 켜짐 · off: 꺼진 자리 · gone: 방금 꺼짐(파란 점선)
export function fire(kind = 'on', color = '#f2a93b', cls = 'fire') {
  const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', cls); s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(NS, 'path'); p.setAttribute('d', FIRE_D);
  if (kind === 'on') p.setAttribute('fill', color);
  else { p.setAttribute('fill', 'none'); p.setAttribute('stroke', kind === 'gone' ? '#7cc0f0' : '#6b5640'); p.setAttribute('stroke-width', '1.8'); if (kind === 'gone') p.setAttribute('stroke-dasharray', '3 2'); }
  s.append(p); return s;
}
export function flag() {
  const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 30 34'); s.setAttribute('width', '26'); s.setAttribute('height', '30'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<path d="M5 33V3" stroke="#d9c9ae" stroke-width="3" stroke-linecap="round"/><path d="M6 4h19l-5 6 5 6H6z" fill="#ffc766"/>';
  return s;
}
export const unitName = (u) => unitLabel(u).replace(/^\d-\d\s*/, '');

// opts: { cur: 차시(지금 보는 층) · next: 순서 숫자 보이기 · lit: 방금 켠 층 · small · reveal · tags: { 차시: '오늘 켬' } · showQ: 살펴보기 중 '봤어요' }
export function towerEl(tw, opts = {}) {
  const { cur = null, order = false, justLit = null, small = false, reveal = false, tags = {}, seen = null, title = true } = opts;
  const darkOrder = tw.all.filter((f) => f.st === 'dark').map((f) => f.c);
  const floor = (f, i) => {
    const isCur = cur === f.c, isNew = justLit === f.c, isNext = order && tw.next && tw.next.c === f.c;
    const cls = isNew ? 'new' : isCur ? 'cur' : f.st === 'lit' ? 'on' : f.st === 'teacher' ? 'tc' : f.st === 'q' ? 'q' : 'dk';
    const tag = tags[f.c] || (isCur ? '지금' : seen && seen.has(f.c) && f.st === 'q' ? '봤어요' : '');
    const right = order && f.st === 'dark' && !tags[f.c] ? h('span', { class: 'st' }, String(darkOrder.indexOf(f.c) + 1))
      : f.st === 'lit' && !isNew && !small && !tags[f.c] ? fire('on', '#2a1a08')
        : f.st === 'teacher' ? h('span', { class: 'tag', style: { border: '1.5px solid #4f6a80', color: '#a9c3d6' } }, '선생님과')
          : tag ? h('span', { class: 'tag', style: isCur ? { color: '#ffc766' } : f.st === 'lit' ? { background: '#2a1a08', color: '#ffc766' } : { border: '1.5px solid #ffc766', color: '#ffc766' } }, tag) : null;
    return h('div', { class: `fl ${cls}${isNext ? ' next' : ''}`, style: reveal ? { animationDelay: `${i * 0.12}s` } : null, title: f.name },
      h('span', { class: 'no' }, f.base ? '기초' : `${f.no}층`), h('span', { class: 'nm' }, f.name), right);
  };
  let i = 0;
  const kids = [
    ...tw.base.map((f) => floor(f, i++)),
    tw.base.length ? h('div', { class: 'ground', 'aria-hidden': 'true' }) : null,
    ...tw.floors.map((f) => floor(f, i++)),
    title ? h('div', { class: 'flag' }, flag(), `${unitName(tw.unit)} 탑`) : null,
  ];
  return h('div', { class: `tower${small ? ' small' : ''}${reveal ? ' reveal' : ''}`, role: 'img', 'aria-label': `${unitName(tw.unit)} 탑 — ${tw.total}층 중 ${tw.lit}층 불이 켜짐` }, ...kids);
}

// 아주 작은 탑(선생님 표 한 줄) — card.floors '1009…'(1 켬 · 0 꺼짐 · 2 선생님과 · 9 아직)
export function miniEl(code) {
  return h('span', { class: 'mt', 'aria-hidden': 'true' }, ...String(code || '').split('').map((x) => h('i', { class: x === '1' ? 'on' : x === '2' ? 'tc' : x === '9' ? 'q' : '' })));
}
