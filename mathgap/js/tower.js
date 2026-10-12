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

// opts: { cur: 차시(지금 보는 층) · order: 다음 켤 층에 '다음' · justLit: 방금 켠 층 · small · reveal · tags: { 차시: '오늘 켬' } · seen: 살펴보기 중 '봤어요' · hideLock: 잠긴 도전 층 숨김(연습 옆 작은 탑) }
//  켤 순서 번호(①②)는 층 번호와 헷갈려(10-11 점검: 4층 옆 ③) '다음' 하나만 둔다
export function towerEl(tw, opts = {}) {
  const { cur = null, order = false, justLit = null, small = false, reveal = false, tags = {}, seen = null, title = true, hideLock = false } = opts;
  const floor = (f, i) => {
    const isCur = cur === f.c, isNew = justLit === f.c, isNext = order && tw.next && tw.next.c === f.c;
    const cls = isNew ? 'new' : isCur ? 'cur' : f.st === 'lit' ? 'on' : f.st === 'teacher' ? 'tc' : f.st === 'q' ? 'q' : 'dk';
    const tag = tags[f.c] || (isCur ? '지금' : seen && seen.has(f.c) && f.st === 'q' ? '봤어요' : '');
    const right = isNext && !tags[f.c] && !isCur ? h('span', { class: 'tag nx' }, '다음')
      : f.st === 'lit' && !isNew && !small && !tags[f.c] ? fire('on', '#2a1a08')
        : f.st === 'teacher' ? h('span', { class: 'tag', style: { border: '1.5px solid #4f6a80', color: '#a9c3d6' } }, '선생님과')
          : tag ? h('span', { class: 'tag', style: isCur ? { color: '#ffc766' } : f.st === 'lit' ? { background: '#2a1a08', color: '#ffc766' } : { border: '1.5px solid #ffc766', color: '#ffc766' } }, tag) : null;
    return h('div', { class: `fl ${cls}${isNext ? ' next' : ''}`, style: reveal ? { animationDelay: `${i * 0.12}s` } : null, title: f.name },
      h('span', { class: 'no' }, f.base ? '기초' : `${f.no}층`), h('span', { class: 'nm' }, f.name), right);
  };
  // 도전 층(문제 유형) — 꼭대기 위 · 아래층을 다 켜기 전엔 잠김
  const top = (f, i) => {
    const isCur = cur === f.c, isNew = justLit === f.c, isNext = order && !tw.next && tw.topNext && tw.topNext.c === f.c;
    const cls = isNew ? 'new' : isCur ? 'cur' : f.st === 'lit' ? 'on' : f.st === 'teacher' ? 'tc' : f.st === 'q' ? 'q' : f.st === 'lock' ? 'lock' : 'dk';
    const tag = tags[f.c] || (isCur ? '지금' : isNext ? '다음' : '');
    const right = f.st === 'lock' && !small ? h('span', { class: 'tag lk' }, '아래층을 다 켜면')
      : f.st === 'teacher' ? h('span', { class: 'tag', style: { border: '1.5px solid #4f6a80', color: '#a9c3d6' } }, '선생님과')
        : tag ? h('span', { class: 'tag', style: isCur ? { color: '#ffc766' } : f.st === 'lit' ? { background: '#2a1a08', color: '#ffc766' } : { border: '1.5px solid #ffc766', color: '#ffc766' } }, tag)
          : f.st === 'lit' && !isNew && !small ? fire('on', '#2a1a08') : null;
    return h('div', { class: `fl top ${cls}${isNext ? ' next' : ''}`, style: reveal ? { animationDelay: `${i * 0.12}s` } : null, title: `도전 층 · ${f.name}` },
      h('span', { class: 'no' }, '도전'), h('span', { class: 'nm' }, f.name), right);
  };
  let i = 0;
  const tops = (tw.tops || []).filter((f) => !hideLock || f.st !== 'lock');
  const kids = [
    ...tw.base.map((f) => floor(f, i++)),
    tw.base.length ? h('div', { class: 'ground', 'aria-hidden': 'true' }) : null,
    ...tw.floors.map((f) => floor(f, i++)),
    tops.length ? h('div', { class: 'roof', 'aria-hidden': 'true' }, h('span', {}, '도전 층')) : null,
    ...tops.map((f) => top(f, i++)),
    title ? h('div', { class: 'flag' }, flag(), `${unitName(tw.unit)} 탑`) : null,
  ];
  const topsLabel = tops.length ? ` · 도전 층 ${tops.length}개 중 ${tops.filter((f) => f.st === 'lit').length}개 켜짐` : '';
  const dense = !small && tw.base.length + tw.floors.length + tops.length > 8;   // 층이 많으면 촘촘하게(한 화면에)
  return h('div', { class: `tower${small ? ' small' : ''}${dense ? ' dense' : ''}${reveal ? ' reveal' : ''}`, role: 'img', 'aria-label': `${unitName(tw.unit)} 탑 — ${tw.total}개 층 중 ${tw.lit}개 층에 불이 켜짐${topsLabel}` }, ...kids);
}

// 아주 작은 탑(선생님 표 한 줄) — card.floors '1009…'(1 켬 · 0 꺼짐 · 2 선생님과 · 9 아직) · tops = 도전 층(8 잠김)
export function miniEl(code, tops = '') {
  const cell = (x, top) => h('i', { class: (x === '1' ? 'on' : x === '2' ? 'tc' : x === '9' ? 'q' : x === '8' ? 'lk' : '') + (top ? ' tp' : '') });
  return h('span', { class: 'mt', 'aria-hidden': 'true' }, ...String(code || '').split('').map((x) => cell(x, false)), ...String(tops || '').split('').map((x) => cell(x, true)));
}
