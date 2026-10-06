// 소프라노 리코더 운지 — [엄지, 1, 2, 3, 4, 5, 6, 7] · 1 막음 · 0 엶 · 0.5 엄지 반 구멍(살짝 열기)
//  악보에 적힌 음 기준(소프라노 리코더는 적힌 음보다 한 옥타브 높게 소리 난다 — 이름은 그대로 '도·레·미').
//  바로크식과 저먼식은 '파'가 다르다(바로크 = 4 뒤 6·7 막음, 저먼 = 4까지만). 확인 안 된 운지는 넣지 않는다 → 그 음이 있는 곡은 연습에서 뺀다.
import { svg } from './util.js';
import { solfege } from './theory.js';

const BAROQUE = {
  60: [1, 1, 1, 1, 1, 1, 1, 1],    // 도
  62: [1, 1, 1, 1, 1, 1, 1, 0],    // 레
  64: [1, 1, 1, 1, 1, 1, 0, 0],    // 미
  65: [1, 1, 1, 1, 1, 0, 1, 1],    // 파(바로크)
  66: [1, 1, 1, 1, 0, 1, 1, 0],    // 파#
  67: [1, 1, 1, 1, 0, 0, 0, 0],    // 솔
  69: [1, 1, 1, 0, 0, 0, 0, 0],    // 라
  70: [1, 1, 0, 1, 1, 0, 0, 0],    // 시♭ — 엄지 · 1 · 3 · 4 (바로크식 '0 1 3 4' · dolmetsch.com/dlesson9.htm) [MUSIC-TSONG-1]
  71: [1, 1, 0, 0, 0, 0, 0, 0],    // 시
  72: [1, 0, 1, 0, 0, 0, 0, 0],    // 높은 도
  74: [0, 0, 1, 0, 0, 0, 0, 0],    // 높은 레
  76: [0.5, 1, 1, 1, 1, 1, 0, 0],  // 높은 미
  77: [0.5, 1, 1, 1, 1, 0, 1, 0],  // 높은 파(바로크)
  79: [0.5, 1, 1, 1, 0, 0, 0, 0],  // 높은 솔
  81: [0.5, 1, 1, 0, 0, 0, 0, 0],  // 높은 라
};
const GERMAN = { ...BAROQUE, 65: [1, 1, 1, 1, 1, 0, 0, 0] };
delete GERMAN[66]; delete GERMAN[77];
delete GERMAN[70];   // 시♭ — 저먼식 운지는 확인 안 됨 → 넣지 않는다(그 음이 있는 곡은 저먼식 연습에서 빠짐) [MUSIC-TSONG-1]

export const SYSTEMS = { baroque: '바로크식', german: '저먼식' };
export const fingering = (p, sys = 'baroque') => (sys === 'german' ? GERMAN : BAROQUE)[p] || null;
export const recorderOK = (song, sys = 'baroque') => song.notes.every(n => fingering(n.p, sys));

// 운지 그림 — 교과서 운지표처럼 굵게. size = 높이(px). prev 를 주면 바뀌는 구멍에 노란 테두리
export function fingerSVG(p, { size = 180, sys = 'baroque', prev = null, label = true } = {}) {
  const f = fingering(p, sys);
  const W = 92, H = 236;
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: Math.round(size * W / H), height: size, class: 'finger', role: 'img', 'aria-label': `${solfege(p)} 운지` });
  root.append(
    svg('path', { d: 'M30 4 h32 a5 5 0 0 1 5 5 v16 l-4 7 v168 a10 10 0 0 1 -5 8 l-3 22 h-18 l-3 -22 a10 10 0 0 1 -5 -8 v-168 l-4 -7 v-16 a5 5 0 0 1 5 -5z', class: 'rec-body' }),
    svg('rect', { x: 38, y: 14, width: 16, height: 5, rx: 2.5, class: 'rec-mouth' }));
  if (!f) { root.append(svg('text', { x: 46, y: 125, 'text-anchor': 'middle', class: 'rec-none' }, '?')); return root; }
  const ys = [62, 88, 114, 146, 172, 197, 218];          // 1~7 번 구멍(위 → 아래)
  const pf = prev ? fingering(prev, sys) : null;
  const hole = (cx, cy, r, v, changed, thumb = false) => {
    const g = svg('g', {});
    if (changed) g.append(svg('circle', { cx, cy, r: r + 3.4, class: 'rec-changed' }));
    g.append(svg('circle', { cx, cy, r, class: (v === 1 ? 'rec-hole on' : 'rec-hole') + (thumb ? ' thumb' : '') }));
    if (v === 0.5) g.append(svg('path', { d: `M${cx} ${cy - r} a${r} ${r} 0 0 0 0 ${2 * r}z`, class: 'rec-half' }));
    return g;
  };
  // 엄지 구멍은 뒤쪽 — 왼쪽으로 빼서 그린다
  root.append(svg('line', { x1: 18, y1: 50, x2: 28, y2: 50, class: 'rec-tick' }));
  root.append(hole(11, 50, 8, f[0], pf && pf[0] !== f[0], true));
  if (label) root.append(svg('text', { x: 11, y: 34, 'text-anchor': 'middle', class: 'rec-lbl' }, '엄지'));
  for (let i = 1; i <= 7; i++) {
    const cy = ys[i - 1], ch = pf && pf[i] !== f[i];
    if (i >= 6) root.append(hole(40, cy, 5.5, f[i], ch), hole(53, cy, 5.5, f[i], false));   // 6·7 번은 작은 두 구멍
    else root.append(hole(46, cy, 9, f[i], ch));
  }
  root.append(svg('line', { x1: 64, y1: 130, x2: 80, y2: 130, class: 'rec-tick' }));   // 왼손 / 오른손 경계
  if (label) { root.append(svg('text', { x: 84, y: 92, class: 'rec-lbl', 'text-anchor': 'middle' }, '왼')); root.append(svg('text', { x: 84, y: 186, class: 'rec-lbl', 'text-anchor': 'middle' }, '오')); }
  return root;
}
