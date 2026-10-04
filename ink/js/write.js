// 판본체 쓰기 — 본보기 글자(획 목록) · 칸 자리 · 획 읽기(기울기 · 곧음 · 굵기 고름 · 둥긂 · 꺾은 곳 · 시작 멈춤) · 획순 · 방향. DOM 없음
//  시험 = scripts/unit/ink/stages.test.mjs. 칸 좌표 = 0~100(왼쪽 위 0,0). 붓 자국(brush.js onStroke)의 pts = [x, y, w](종이 px)
//  판본체 = 1446년 「훈민정음 해례본」처럼 판(목판)에 새긴 책의 글씨체 — 획의 굵기가 고르고, 가로는 수평 · 세로는 수직, 이응은 동그랗게.

// ── 본보기 획 ── k: h 가로 · v 세로 · bend 꺾은 · circle 동그라미 · dot 점
const H = (x0, y, x1, n = '가로획') => ({ k: 'h', p: [[x0, y], [x1, y]], n });
const V = (x, y0, y1, n = '세로획') => ({ k: 'v', p: [[x, y0], [x, y1]], n });
const B = (p, n) => ({ k: 'bend', p, n });
const O = (cx, cy, r, n = '이응(동그라미)') => ({ k: 'circle', c: [cx, cy, r], n });
const D = (cx, cy, r, n = '점(·)') => ({ k: 'dot', c: [cx, cy, r], n });
export const STROKE_W = 9;   // 본보기 획 굵기(칸의 9%)

// 칸마다 획 목록(획순 = 목록 차례) — 위에서 아래로 · 왼쪽에서 오른쪽으로
export const GLYPHS = {
  hlines: [H(15, 25, 85, '위 가로획'), H(15, 50, 85, '가운데 가로획'), H(15, 75, 85, '아래 가로획')],
  vlines: [V(25, 15, 85, '왼 세로획'), V(50, 15, 85, '가운데 세로획'), V(75, 15, 85, '오른 세로획')],
  ieung: [O(50, 50, 30)],
  giyeok: [B([[20, 20], [80, 20], [80, 80]], 'ㄱ 꺾은획')],
  nieun: [B([[20, 20], [20, 80], [80, 80]], 'ㄴ 꺾은획')],
  bu: [V(30, 12, 52, 'ㅂ 왼 세로'), V(70, 12, 52, 'ㅂ 오른 세로'), H(30, 32, 70, 'ㅂ 가운데 가로'), H(30, 52, 70, 'ㅂ 아래 가로'), H(12, 68, 88, 'ㅜ 가로'), V(50, 68, 92, 'ㅜ 세로')],
  mo: [V(28, 12, 52, 'ㅁ 왼 세로'), B([[28, 12], [72, 12], [72, 52]], 'ㅁ 꺾은획'), H(28, 52, 72, 'ㅁ 아래 가로'), V(50, 60, 76, 'ㅗ 세로'), H(12, 78, 88, 'ㅗ 가로')],
  u: [O(50, 34, 21, 'ㅇ 동그라미'), H(12, 68, 88, 'ㅜ 가로'), V(50, 68, 92, 'ㅜ 세로')],
  ri: [B([[14, 14], [58, 14], [58, 50]], 'ㄹ 첫 꺾은획'), H(14, 50, 58, 'ㄹ 가운데 가로'), B([[14, 50], [14, 86], [58, 86]], 'ㄹ 아래 꺾은획'), V(78, 8, 94, 'ㅣ 세로')],
  //  해례본의 ‘감’ — ㅏ 를 세로획 옆 동그란 점(·)으로
  gam: [B([[14, 14], [52, 14], [52, 44]], 'ㄱ 꺾은획'), V(70, 6, 52, 'ㅣ 세로'), D(85, 29, 6, '점(·)'), V(24, 62, 94, 'ㅁ 왼 세로'), B([[24, 62], [76, 62], [76, 94]], 'ㅁ 꺾은획'), H(24, 94, 76, 'ㅁ 아래 가로')],
};
export const KIND_NAME = { h: '가로획', v: '세로획', bend: '꺾은획', circle: '동그라미', dot: '점' };

// 칸 자리(종이 px) — 가운데 정렬 · 칸 사이 간격
export function layoutCells(W, H, n) {
  const gap = Math.max(16, W * 0.03), s = Math.max(60, Math.min(H * 0.84, (W * 0.92 - gap * (n - 1)) / n));
  const x0 = (W - (s * n + gap * (n - 1))) / 2, y0 = (H - s) / 2;
  return Array.from({ length: n }, (_, i) => ({ x: x0 + i * (s + gap), y: y0, s }));
}
// 칸 안의 본보기 획 → 모양 점들(칸 좌표). 동그라미는 맨 위에서 시작해 한 바퀴
export function samples(m, step = 2) {
  if (m.k === 'circle' || m.k === 'dot') {
    const [cx, cy, r] = m.c, n = Math.max(12, Math.round(2 * Math.PI * r / step));
    return Array.from({ length: n + 1 }, (_, i) => { const a = -Math.PI / 2 - i / n * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
  }
  const out = [];
  for (let i = 1; i < m.p.length; i++) {
    const [ax, ay] = m.p[i - 1], [bx, by] = m.p[i], L = Math.hypot(bx - ax, by - ay), k = Math.max(1, Math.round(L / step));
    for (let j = i === 1 ? 0 : 1; j <= k; j++) out.push([ax + (bx - ax) * j / k, ay + (by - ay) * j / k]);
  }
  return out;
}
const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const polyDist = (p, poly) => { let d = Infinity; for (let i = 1; i < poly.length; i++) d = Math.min(d, segDist(p, poly[i - 1], poly[i])); return poly.length === 1 ? Math.hypot(p[0] - poly[0][0], p[1] - poly[0][1]) : d; };
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const clamp01 = v => Math.max(0, Math.min(1, v));
const pct = v => Math.round(v * 100) + '%';

// 붓 자국 하나 → 칸 좌표 획 { cell, pts:[[x,y,w]], dot, hold, len }(칸 밖 자국은 가장 가까운 칸으로)
export function toCellStroke(st, cells) {
  const P = st.pts && st.pts.length ? st.pts : [];
  if (!P.length) return null;
  const cx = mean(P.map(p => p[0])), cy = mean(P.map(p => p[1]));
  let ci = 0, best = Infinity;
  cells.forEach((c, i) => { const d = Math.hypot(cx - (c.x + c.s / 2), cy - (c.y + c.s / 2)); if (d < best) { best = d; ci = i; } });
  const c = cells[ci], k = 100 / c.s;
  const pts = P.map(([x, y, w]) => [(x - c.x) * k, (y - c.y) * k, w * k]);
  let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return { cell: ci, pts, dot: !!st.dot, hold: st.hold || 0, len, cap: (st.cap || 34) * k };
}

// ── 획 읽기 — 본보기 획 m 과 내 획 u(칸 좌표)를 견준다 ──
//  기울기 — 처음과 끝을 이은 줄이 수평(가로) · 수직(세로)에서 몇 도 벗어났나(방향은 따로 본다) · 곧음 — 그 줄에서 가장 멀리 벗어난 거리
function lineRead(u, m) {
  const A = u.pts[0], Z = u.pts[u.pts.length - 1], ang = Math.abs(Math.atan2(Z[1] - A[1], Z[0] - A[0]) * 180 / Math.PI);   // 0~180
  const tilt = m.k === 'h' ? Math.min(ang, 180 - ang) : Math.abs(ang - 90);
  const dev = Math.max(...u.pts.map(p => segDist(p, A, Z)));
  return { tilt: Math.round(tilt), dev };
}
//  굵기 고름 — 처음 · 끝 15%(붓을 대고 떼는 곳)를 뺀 가운데 굵기의 들쭉날쭉(변동 계수)
function evenness(u) {
  const w = u.pts.map(p => p[2]), n = w.length, a = Math.floor(n * 0.15), z = Math.ceil(n * 0.85), mid = z - a >= 3 ? w.slice(a, z) : w;
  const mu = mean(mid), sd = Math.sqrt(mean(mid.map(x => (x - mu) ** 2)));
  return mu ? sd / mu : 1;
}
// 본보기 점들 가운데 내 획이 덮은 몫(획 굵기 반 + 4 안)
function coverOf(u, ms) { const poly = u.pts.map(p => [p[0], p[1]]); return mean(ms.map(q => (polyDist(q, poly) <= STROKE_W / 2 + 4 ? 1 : 0))); }
// 동그라미 — 내 점들의 각도가 얼마나 한 바퀴를 채웠나(36칸)
function angleBins(pts, c) { const bins = new Set(); for (const p of pts) { const a = Math.atan2(p[1] - c[1], p[0] - c[0]); bins.add(Math.floor(((a + Math.PI) / (2 * Math.PI)) * 36) % 36); } return bins; }

//  굵기 — 가운데 굵기가 본보기 굵기(붓이 낼 수 있는 만큼)에 얼마나 가까운가 · 가늘면(빨리 그으면) 낮다
function thickOf(u) {
  const w = u.pts.map(p => p[2]), n = w.length, a = Math.floor(n * 0.15), z = Math.ceil(n * 0.85), mid = z - a >= 3 ? w.slice(a, z) : w;
  const W0 = Math.min(STROKE_W, u.cap || STROKE_W) * 0.85, mw = mean(mid);
  return clamp01(1 - (Math.max(0, (W0 - mw) / W0) - 0.15) / 0.5);
}
//  가장 아쉬운 점 — 0.35 아래인 점수 가운데 먼저 고칠 것(기울기 → 모양 → 길이 → 굵기 차례)을 말로(없으면 '')
const ISSUE = { tilt: t => `기울었어요(${t}°)`, straight: () => '구불구불해요 — 곧게', even: () => '굵기가 들쭉날쭉해요 — 같은 빠르기로', thick: () => '너무 가늘어요 — 천천히 눌러서',
  full: () => '끝까지 그어요', round: () => '더 동그랗게', closed: () => '끝을 시작과 이어 닫아요', size: () => '크기를 본보기에 맞춰요', corner: () => '꺾은 곳을 또렷하게', place: () => '점 자리를 맞춰요' };
const FIRST = ['tilt', 'corner', 'round', 'closed', 'straight', 'full', 'thick', 'even', 'size', 'place'];
function issueOf(sc, tilt) {
  const k = FIRST.find(x => sc[x] != null && sc[x] < 0.35);
  return k ? ISSUE[k](tilt) : '';
}
const tipOf = (sc, u) => [sc.thick != null && sc.thick < 0.7 ? '더 굵게(천천히)' : '', sc.full != null && sc.full < 0.8 ? '끝까지' : '', u.hold < 120 ? '시작에 잠깐 멈춰요' : ''].filter(Boolean).map(t => ' · ' + t).join('');

export function readStroke(m, u) {
  const sc = {};
  const out = (say, tilt) => { const q = mean(Object.values(sc)), issue = issueOf(sc, tilt); return { sc, q, tilt, issue, weak: !!issue || q < 0.5, say }; };
  if (m.k === 'dot') {
    const [cx, cy, r] = m.c, P = u.pts[0], d = Math.hypot(P[0] - cx, P[1] - cy), size = Math.max(...u.pts.map(p => p[2])) / 2;
    sc.place = clamp01(1 - (d - 2) / 8); sc.size = clamp01(1 - (Math.abs(size - r) / r - 0.2) / 0.6);
    return out(`자리 ${pct(sc.place)} · 크기 ${pct(sc.size)}${size < r * 0.6 ? ' · 꾹 눌러 더 크게' : ''}`);
  }
  if (m.k === 'circle') {
    //  둥긂 = 내 점들의 가운데(무게 중심)에서 잰 반지름이 얼마나 고른가 · 닫힘 = 한 바퀴(36칸)를 얼마나 채웠나 · 크기 = 본보기 반지름과 견줌
    const [, , r] = m.c, cxu = mean(u.pts.map(p => p[0])), cyu = mean(u.pts.map(p => p[1]));
    const rs = u.pts.map(p => Math.hypot(p[0] - cxu, p[1] - cyu)), mr = mean(rs), cv = Math.sqrt(mean(rs.map(x => (x - mr) ** 2))) / (mr || 1);
    sc.round = clamp01(1 - (cv - 0.04) / 0.2); sc.closed = clamp01((angleBins(u.pts, m.c).size / 36 - 0.6) / 0.32);
    sc.size = clamp01(1 - (Math.abs(mr - r) / r - 0.08) / 0.4); sc.even = clamp01(1 - (evenness(u) - 0.06) / 0.3); sc.thick = thickOf(u);
    return out(`둥긂 ${pct(sc.round)} · 닫힘 ${pct(sc.closed)} · 굵기 고름 ${pct(sc.even)}${sc.thick < 0.7 ? ' · 더 굵게(천천히)' : ''}`);
  }
  const ms = samples(m), cover = coverOf(u, ms);
  sc.full = clamp01((cover - 0.5) / 0.42); sc.even = clamp01(1 - (evenness(u) - 0.06) / 0.3); sc.thick = thickOf(u); sc.start = u.hold >= 120 ? 1 : 0.6;
  if (m.k === 'bend') {
    const corner = m.p[1], dc = Math.min(...u.pts.map(p => Math.hypot(p[0] - corner[0], p[1] - corner[1])));
    const legs = [[m.p[0], m.p[1]], [m.p[1], m.p[2]]], dev = Math.max(...u.pts.map(p => Math.min(segDist(p, legs[0][0], legs[0][1]), segDist(p, legs[1][0], legs[1][1]))));
    sc.corner = clamp01(1 - (dc - 3) / 8); sc.straight = clamp01(1 - (dev - 2) / 7);
    return out(`꺾은 곳 ${pct(sc.corner)} · 곧음 ${pct(sc.straight)} · 굵기 고름 ${pct(sc.even)}${tipOf(sc, u)}`);
  }
  const { tilt, dev } = lineRead(u, m);
  sc.tilt = clamp01(1 - (tilt - 2) / 10); sc.straight = clamp01(1 - (dev - 1.5) / 6);
  return out(`기울기 ${tilt}° · 곧음 ${pct(sc.straight)} · 굵기 고름 ${pct(sc.even)}${tipOf(sc, u)}`, tilt);
}

// ── 한 번 쓰기(한 장) — 붓 자국이 올 때마다 어느 획인지 찾고 · 획순 · 방향 · 획 읽기 ──
//  cells = 칸 이름 목록(GLYPHS 열쇠). 동그라미는 두 번(왼쪽 반 · 오른쪽 반)에 나눠 써도 된다.
export function makeSheet(cellKeys) {
  const model = cellKeys.flatMap((key, ci) => GLYPHS[key].map((m, i) => ({ ...m, cell: ci, i })));
  const done = model.map(() => null), circlePts = model.map(() => []), events = [];
  const flags = { order: 0, reverse: 0, off: 0 };
  const open = j => !done[j] || (model[j].k === 'circle' && !done[j].complete);
  const next = () => model.findIndex((_, j) => open(j));
  function add(u) {
    if (!u) return null;
    if (u.dot && Math.max(...u.pts.map(p => p[2])) < 5 && !model.some((m, j) => !done[j] && m.k === 'dot' && m.cell === u.cell)) return { type: 'tiny' };   // 실수로 콕 — 셈하지 않음
    const poly = u.pts.map(p => [p[0], p[1]]);
    let best = -1, bd = Infinity;
    model.forEach((m, j) => {
      if (m.cell !== u.cell || !open(j)) return;
      if (u.dot && m.k !== 'dot') return;                 // 콕 찍은 점은 점 획에만
      if (m.k === 'dot' && !u.dot && u.len >= 4) return;  // 점 획에는 찍기(조금 움직인 것까지)
      const ms = samples(m), d = m.k === 'circle' || m.k === 'dot' ? mean(poly.map(p => polyDist(p, ms))) : (mean(poly.map(p => polyDist(p, ms))) * 0.6 + mean(ms.map(q => polyDist(q, poly))) * 0.4);
      if (d < bd) { bd = d; best = j; }
    });
    if (best < 0 || bd > 11) { flags.off++; const ev = { type: 'off', say: '밑그림 밖에 그었어요 — 연한 본보기 위에 써요' }; events.push(ev); return ev; }
    const m = model[best], expected = next();
    let type = 'ok';
    if (best !== expected && !(m.k === 'circle' && done[best])) { flags.order++; type = 'order'; }   // 동그라미 나머지 반은 획순으로 안 셈
    //  방향 — 가로는 왼쪽 → 오른쪽 · 세로는 위 → 아래 · 꺾은획은 본보기 처음 자리에서
    if (m.k === 'h' || m.k === 'v' || m.k === 'bend') {
      const A = poly[0], s0 = m.p[0], s1 = m.p[m.p.length - 1];
      if (Math.hypot(A[0] - s1[0], A[1] - s1[1]) + 2 < Math.hypot(A[0] - s0[0], A[1] - s0[1])) { flags.reverse++; if (type === 'ok') type = 'reverse'; }
    }
    //  동그라미 — 한 번에 한 바퀴(31/36칸 넘게)면 끝 · 아니면 다음 붓질(나머지 반)까지 모아 읽는다
    if (m.k === 'circle') {
      const first = !circlePts[best].length;
      circlePts[best].push(...u.pts);
      const merged = { ...u, pts: circlePts[best] }, bins = angleBins(merged.pts, m.c).size, r = readStroke(m, merged), complete = bins >= 31 || !first;
      done[best] = { ...r, complete };
      const ev = { type: complete ? type : type === 'ok' ? 'part' : type, idx: best, m, ...r, say: complete ? r.say : `동그라미 반쪽 — 나머지 반을 이어서 닫아요` };
      events.push(ev); return ev;
    }
    const r = readStroke(m, u);
    done[best] = r;
    const ev = { type, idx: best, m, ...r }; events.push(ev); return ev;
  }
  function result() {
    const finished = model.every((_, j) => !open(j));
    const qs = done.map(x => (x ? x.q : 0)), avg = mean(qs);
    const weak = done.map((x, j) => ({ x, j })).filter(o => o.x && o.x.weak);
    let pass = finished && !flags.order && !flags.reverse && !flags.off && !weak.length && avg >= 0.62, why = '';
    if (!finished) why = '아직 다 안 썼어요';
    else if (flags.order) why = '획순을 지켜 다시 써 봐요 — 숫자 차례대로';
    else if (flags.reverse) why = '방향을 지켜요 — 가로는 왼쪽에서 오른쪽, 세로는 위에서 아래로';
    else if (flags.off) why = '밑그림 밖에 그은 획이 있어요';
    else if (weak.length) why = weak.slice(0, 2).map(o => `${o.j + 1}번 ${model[o.j].n} — ${o.x.issue || '더 곧고 고르게'}`).join(' · ');
    else if (avg < 0.62) why = '조금 더 곧고 고르게 — 천천히 같은 빠르기로';
    const kind = !finished ? 'less' : flags.order ? 'order' : flags.reverse ? 'reverse' : flags.off ? 'off' : 'weak';
    return { finished, pass, avg, stars: avg >= 0.85 ? 3 : avg >= 0.72 ? 2 : 1, why, kind, flags: { ...flags } };
  }
  return { model, done, events, add, result, next, get flags() { return flags; } };
}
