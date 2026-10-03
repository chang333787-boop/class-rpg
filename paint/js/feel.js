// 느낌의 색 — 우리 반 모자이크(색 칸 · 고른 까닭 칩) + 한 줄 정리(밝기 · 따뜻함을 셈으로). 아이 화면 · 선생님 화면이 같이 쓴다
import { h } from './util.js';
import { hexToRgb, readColor } from './color.js';
import { WHY_CHIPS } from './stages.js';
import { cleanFeel } from './store.js';

const CHIP_KEYS = WHY_CHIPS.map(c => c[0]), CHIP_WORD = Object.fromEntries(WHY_CHIPS);

export function feelSummary(entries) {
  const n = entries.length, light = { 밝은: 0, '중간 밝기': 0, 어두운: 0 }, warm = { warm: 0, cool: 0, mid: 0, none: 0 }, chips = {};
  for (const e of entries) {
    const r = readColor(hexToRgb(e.c));
    light[r.light]++; warm[r.warm]++;
    for (const w of (e.w || '').split(',').filter(Boolean)) chips[w] = (chips[w] || 0) + 1;
  }
  //  절반 넘게 같은 쪽이면 '대체로' · 아니면 '저마다' — 정답이 없는 판이라 좋고 나쁨은 말하지 않는다
  const most = (o, words) => { const [k, v] = Object.entries(o).sort((a, z) => z[1] - a[1])[0] || []; return v > n / 2 ? words[k] : ''; };
  const L = most(light, { 밝은: '밝', '중간 밝기': '', 어두운: '어둡' }), W = most(warm, { warm: '따뜻한', cool: '차가운', mid: '그 사이(중성)', none: '회색에 가까운' });
  const Lw = L && (W ? L + '고' : { 밝: '밝은', 어둡: '어두운' }[L]);   // 밝고 따뜻한 색 · 밝은 색
  const line = n < 2 ? '' : L || W ? `우리 반은 이 장면을 대체로 ${[Lw, W].filter(Boolean).join(' ')} 색으로 느꼈어요.` : '우리 반은 이 장면을 저마다 다른 색으로 느꼈어요 — 정답이 없는 색이에요.';
  const topChips = Object.entries(chips).sort((a, z) => z[1] - a[1]).slice(0, 3).map(([k, v]) => `${CHIP_WORD[k] || k} ${v}`);
  return { n, light, warm, chips, line, topChips };
}

// feel = { sid: {c,w,t} } · names = { sid: 이름 } · me = 내 sid(테두리) · showNames = 선생님 화면만 이름을 글로
export function mosaicEl(feel, names, { me = '', showNames = false } = {}) {
  const list = Object.entries(feel || {}).map(([sid, f]) => [sid, cleanFeel(f, CHIP_KEYS)]).filter(([, f]) => f).sort((a, z) => a[1].t - z[1].t);
  if (!list.length) return h('p', { class: 'muted' }, '아직 아무도 붙이지 않았어요.');
  const sum = feelSummary(list.map(([, f]) => f));
  const tiles = list.map(([sid, f]) => {
    const why = f.w.split(',').filter(Boolean).map(w => CHIP_WORD[w]).join(' · ');
    return h('div', { class: 'tile' + (sid === me ? ' me' : ''), title: `${names[sid] || ''}${why ? ' — ' + why : ''}` },
      h('span', { class: 'tile-c', style: { background: f.c } }), showNames ? h('span', { class: 'tile-n' }, names[sid] || sid) : sid === me ? h('span', { class: 'tile-n' }, '나') : null);
  });
  return h('div', { class: 'mosaic-wrap' },
    h('div', { class: 'mosaic' }, ...tiles),
    h('div', { class: 'mosaic-sum' },
      h('b', {}, `${sum.n}명`),
      sum.line ? h('span', {}, sum.line) : null,
      sum.topChips.length ? h('span', { class: 'muted' }, '고른 까닭: ' + sum.topChips.join(' · ')) : null));
}
