#!/usr/bin/env node
// 캐릭터 종이인형 84장 — 조립 규칙 전수 검사 (CHAR-COMBO-CHECK-1, 디자인2 2026-09-15)
//
//  assets/char/*.svg 를 브라우저 없이 읽어(경로·도형·transform 을 직접 계산) 부품 bbox 를 만들고,
//  student.js buildCharDoll 의 합성 규칙대로 쌍별(pairwise) 조합을 전부 검사한다.
//   · 잘림   : 부품 bbox 가 뷰박스(0 0 120 160) 밖 → 카드·전투 무대에서 잘린다            (84장)
//   · 뚫림   : 모자를 써도 남는 머리카락(hair-mid/hair-bottom)이 모자 위로 올라감,
//              모자가 두개골 꼭대기(y20)를 못 덮음                                          (모자 10 × base 4)
//   · 겹침   : 무기 bbox 가 모자 bbox 에 닿음(칼끝·오브가 모자 옆), 모자가 몸통을 15% 넘게 덮음  (모자 10 × 무기 20, 모자 10 × 몸통 30)
//   · 어색   : 몸통 팔 끝이 손 자리(19,100)/(101,100)가 아님, 장갑 손등이 그 자리가 아님,
//              무기에 손잡이(97|96.5, 86) 가 없음                                            (몸통 30, 장갑 10, 무기 20)
//  bbox 는 제어점까지 포함한 근사(실제보다 조금 큼)라 '안'이면 확실히 안이고, '밖' 판정은 여유 1px 를 둔다.
//
// 실행: node scripts/unit/char-combo-check.mjs [--json 파일] [--dir assets/char]
//   뚫림·잘림 1개 이상이면 exit 1 (겹침·어색은 경고).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const DIR = path.resolve(ROOT, opt('--dir', 'assets/char'));
const JSON_OUT = opt('--json', '');
const VB = { x0: 0, y0: 0, x1: 120, y1: 160 };
const TOL = 1.0;

// ── 행렬 ────────────────────────────────────────────────
const I = [1, 0, 0, 1, 0, 0];
const mul = (a, b) => [a[0]*b[0] + a[2]*b[1], a[1]*b[0] + a[3]*b[1], a[0]*b[2] + a[2]*b[3], a[1]*b[2] + a[3]*b[3], a[0]*b[4] + a[2]*b[5] + a[4], a[1]*b[4] + a[3]*b[5] + a[5]];
const apply = (m, x, y) => [m[0]*x + m[2]*y + m[4], m[1]*x + m[3]*y + m[5]];
function parseTransform(s) {
  let m = I.slice();
  if (!s) return m;
  for (const t of s.matchAll(/(translate|scale|rotate)\(([^)]*)\)/g)) {
    const v = t[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let n = I.slice();
    if (t[1] === 'translate') n = [1, 0, 0, 1, v[0] || 0, v[1] || 0];
    else if (t[1] === 'scale') n = [v[0], 0, 0, v[1] ?? v[0], 0, 0];
    else if (t[1] === 'rotate') {
      const a = v[0] * Math.PI / 180, c = Math.cos(a), s2 = Math.sin(a);
      n = [c, s2, -s2, c, 0, 0];
      if (v.length >= 3) n = mul(mul([1, 0, 0, 1, v[1], v[2]], n), [1, 0, 0, 1, -v[1], -v[2]]);
    }
    m = mul(m, n);
  }
  return m;
}

// ── 도형 → 점 목록 ─────────────────────────────────────────
function pathPoints(d) {
  const pts = []; let x = 0, y = 0, sx = 0, sy = 0, cmd = '';
  const tok = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  let i = 0;
  const num = () => Number(tok[i++]);
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === 'Z') { x = sx; y = sy; continue; }
    if (C === 'M' || C === 'L' || C === 'T') { const nx = num(), ny = num(); x = rel ? x + nx : nx; y = rel ? y + ny : ny; pts.push([x, y]); if (C === 'M') { sx = x; sy = y; cmd = rel ? 'l' : 'L'; } }
    else if (C === 'H') { const nx = num(); x = rel ? x + nx : nx; pts.push([x, y]); }
    else if (C === 'V') { const ny = num(); y = rel ? y + ny : ny; pts.push([x, y]); }
    else if (C === 'Q' || C === 'S') {   // 제어점 대신 곡선 위 점 3개(t=.25,.5,.75) — 제어점을 넣으면 실제보다 크게 잡힌다
      const cx = num(), cy = num(), nx = num(), ny = num(); const bx = rel ? x : 0, by = rel ? y : 0;
      const x0 = x, y0 = y, x1 = bx + cx, y1 = by + cy, x2 = bx + nx, y2 = by + ny;
      for (const t of [0.25, 0.5, 0.75]) pts.push([(1-t)*(1-t)*x0 + 2*(1-t)*t*x1 + t*t*x2, (1-t)*(1-t)*y0 + 2*(1-t)*t*y1 + t*t*y2]);
      x = x2; y = y2; pts.push([x, y]); }
    else if (C === 'C') {
      const a1 = num(), b1 = num(), a2 = num(), b2 = num(), nx = num(), ny = num(); const bx = rel ? x : 0, by = rel ? y : 0;
      const x0 = x, y0 = y, x1 = bx + a1, y1 = by + b1, x2 = bx + a2, y2 = by + b2, x3 = bx + nx, y3 = by + ny;
      for (const t of [0.25, 0.5, 0.75]) { const u = 1 - t; pts.push([u*u*u*x0 + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x3, u*u*u*y0 + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y3]); }
      x = x3; y = y3; pts.push([x, y]); }
    else if (C === 'A') { const rx = num(), ry = num(); num(); num(); num(); const nx = num(), ny = num(); const bx = rel ? x : 0, by = rel ? y : 0; const ex = bx + nx, ey = by + ny; const mx = (x + ex) / 2, my = (y + ey) / 2; pts.push([mx - rx, my - ry], [mx + rx, my + ry]); x = ex; y = ey; pts.push([x, y]); }
    else { i++; }
  }
  return pts;
}
function bboxOf(pts, pad = 0) {
  if (!pts.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}
const union = (a, b) => !a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
const area = (b) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
const inter = (a, b) => ({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) });
const r1 = (v) => Math.round(v * 10) / 10;
const fmt = (b) => b ? `[${r1(b.x0)},${r1(b.y0)}~${r1(b.x1)},${r1(b.y1)}]` : '-';

// ── SVG 파싱: 그룹 transform·class 를 따라가며 요소 bbox 수집 ──
function parseSvg(text) {
  const elems = [];   // {cls, bbox, tag}
  const stack = [{ m: I.slice(), cls: [] }];
  const re = /<(\/?)(g|path|rect|circle|ellipse|polygon|svg)\b([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(text))) {
    const [, close, tag, attrs, selfClose] = m;
    if (tag === 'svg') continue;
    if (close) { if (tag === 'g') stack.pop(); continue; }
    const top = stack[stack.length - 1];
    const attr = (n) => { const a = new RegExp(`\\s${n}="([^"]*)"`).exec(attrs); return a ? a[1] : null; };
    const tm = mul(top.m, parseTransform(attr('transform')));
    const cls = [...top.cls, ...((attr('class') || '').split(/\s+/).filter(Boolean))];
    if (tag === 'g') { if (!selfClose) stack.push({ m: tm, cls }); continue; }
    let pts = [];
    if (tag === 'path') pts = pathPoints(attr('d') || '');
    else if (tag === 'rect') { const x = +attr('x') || 0, y = +attr('y') || 0, w = +attr('width'), h = +attr('height'); pts = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]; }
    else if (tag === 'circle') { const cx = +attr('cx') || 0, cy = +attr('cy') || 0, r = +attr('r'); pts = [[cx - r, cy - r], [cx + r, cy + r], [cx - r, cy + r], [cx + r, cy - r]]; }
    else if (tag === 'ellipse') { const cx = +attr('cx') || 0, cy = +attr('cy') || 0, rx = +attr('rx'), ry = +attr('ry'); pts = [[cx - rx, cy - ry], [cx + rx, cy + ry], [cx - rx, cy + ry], [cx + rx, cy - ry]]; }
    else if (tag === 'polygon') pts = (attr('points') || '').trim().split(/\s+/).map(p => p.split(',').map(Number));
    if (!pts.length) continue;
    const sw = attr('stroke') && attr('stroke') !== 'none' ? (+(attr('stroke-width') ?? 1)) / 2 : 0;
    const wpts = pts.map(([x, y]) => apply(tm, x, y));
    const sc = Math.max(Math.abs(tm[0]), Math.abs(tm[3]), 1);
    elems.push({ tag, cls, bbox: bboxOf(wpts, sw * sc), pts: wpts, attrs });
  }
  return elems;
}
const groupBox = (elems, cls) => elems.filter(e => e.cls.includes(cls)).reduce((a, e) => union(a, e.bbox), null);
const allBox = (elems, skip = []) => elems.filter(e => !e.cls.some(c => skip.includes(c))).reduce((a, e) => union(a, e.bbox), null);

// ── 파일 읽기 ─────────────────────────────────────────────
const names = [];
for (let i = 1; i <= 4; i++) names.push('base_' + i);
for (let i = 1; i <= 30; i++) names.push('body_e_b' + i);
for (let i = 1; i <= 10; i++) names.push('head_e_h' + i, 'glove_e_g' + i, 'shoe_e_s' + i, 'weapon_e_w' + i, 'weapon_e_ws' + i);
const F = {};
let missing = 0;
for (const n of names) {
  const p = path.join(DIR, n + '.svg');
  if (!fs.existsSync(p)) { missing++; continue; }
  const text = fs.readFileSync(p, 'utf8');
  F[n] = { text, elems: parseSvg(text) };
}
const V = [];   // {sev, rule, subject, detail}
const add = (sev, rule, subject, detail) => V.push({ sev, rule, subject, detail });

// 1) 잘림: 부품 bbox 뷰박스 밖 (base 는 hair-top 포함 — 모자 없을 때 그대로 보이므로)
for (const n of names) {
  const f = F[n]; if (!f) continue;
  const b = allBox(f.elems);
  if (!b) continue;
  if (b.x0 < VB.x0 - TOL || b.y0 < VB.y0 - TOL || b.x1 > VB.x1 + TOL || b.y1 > VB.y1 + TOL) add('잘림', '뷰박스 밖', n, fmt(b));
}
// 2) 뚫림: 모자 × base
const heads = names.filter(n => n.startsWith('head_')), bases = names.filter(n => n.startsWith('base_'));
const weapons = names.filter(n => n.startsWith('weapon_')), bodies = names.filter(n => n.startsWith('body_')), gloves = names.filter(n => n.startsWith('glove_'));
for (const h of heads) {
  const H = F[h]; if (!H) continue;
  const hb = allBox(H.elems);
  const keepTop = H.text.includes('keep-hair-top');
  if (hb.y0 > 20 + TOL && !keepTop) add('뚫림', '모자가 정수리(y20)를 못 덮음', h, fmt(hb));
  for (const b of bases) {
    const B = F[b]; if (!B) continue;
    const hair = union(groupBox(B.elems, 'hair-mid'), groupBox(B.elems, 'hair-bottom'));
    if (hair && !keepTop && hair.y0 < hb.y0 - TOL) add('뚫림', '남는 머리카락이 모자 위로', `${h} × ${b}`, `머리 ${fmt(hair)} vs 모자 ${fmt(hb)}`);
  }
}
// 3) 겹침: 모자 × 무기 (칼끝·오브가 모자에 닿음), 모자 × 몸통 (15% 이상)
//    무기는 회전된 가는 도형이라 전체 bbox 가 아니라 **무기 점(꼭짓점·제어점)이 모자 요소 bbox 안에 들어오는지**로 본다.
const inside = (p, b, pad = 0) => p[0] >= b.x0 - pad && p[0] <= b.x1 + pad && p[1] >= b.y0 - pad && p[1] <= b.y1 + pad;
for (const h of heads) {
  const H = F[h]; if (!H) continue; const hb = allBox(H.elems);
  for (const w of weapons) {
    const W = F[w]; if (!W) continue;
    let hits = 0, where = null;
    for (const we of W.elems) for (const p of we.pts) for (const he of H.elems) if (inside(p, he.bbox, -1.5)) { hits++; where = where || [r1(p[0]), r1(p[1])]; }   // 모자 요소 bbox 를 1.5px 안쪽으로 — 곡선 날개의 빈 모서리 오탐 방지
    if (hits) add('겹침', '무기가 모자에 닿음', `${h} × ${w}`, `무기 점 ${hits}개가 모자 요소 안 (첫 점 ${where})`);
  }
  for (const bd of bodies) {   // 요소끼리 겹친 넓이 합(전체 bbox 는 빈 공간이 많아 과장됨)
    const B = F[bd]; if (!B) continue;
    let a = 0;
    for (const he of H.elems) for (const be of B.elems) a += area(inter(he.bbox, be.bbox));
    if (a / area(hb) > 0.35) add('겹침', '모자가 몸통을 35% 넘게 덮음', `${h} × ${bd}`, `${Math.round(a / area(hb) * 100)}%`);   // 투구 볼가리개가 깃·견갑 위에 오는 건 정상(15~32%)
  }
}
// 4) 어색: 팔 끝·손등·손잡이 자리
for (const bd of bodies) {
  const t = F[bd] && F[bd].text; if (!t) continue;
  if (!t.includes('L19,100') || !t.includes('L101,100')) add('어색', '몸통 팔 끝이 손 자리(19,100)/(101,100)가 아님', bd, '');
}
for (const g of gloves) {
  const G = F[g]; if (!G) continue;
  const circles = G.elems.filter(e => e.tag === 'circle' && e.cls.includes('hand-back')).map(e => [(e.bbox.x0 + e.bbox.x1) / 2, (e.bbox.y0 + e.bbox.y1) / 2]);
  const has = (x, y) => circles.some(c => Math.abs(c[0] - x) < 1.5 && Math.abs(c[1] - y) < 1.5);
  if (!(has(19, 100) && has(101, 100))) add('어색', '장갑 손등 원이 손 자리(19,100)/(101,100)가 아님', g, JSON.stringify(circles.map(c => c.map(r1))));
  if (!/class="fingers-front"/.test(G.text)) add('어색', '장갑에 fingers-front 없음', g, '');
}
for (const w of weapons) {
  const t = F[w] && F[w].text; if (!t) continue;
  if (!/<rect x="9(?:7|6\.5)" y="86" width="(?:8|9)" height="\d+"/.test(t)) add('어색', '무기 손잡이 rect(97|96.5, 86)가 없음', w, '');
}
// 5) 합성 그룹 규격
for (const b of bases) {
  const t = F[b] && F[b].text; if (!t) continue;
  for (const c of ['hair-top', 'hair-bottom', 'hand-back', 'fingers-front']) if (!t.includes(`class="${c}"`)) add('어색', `base 에 ${c} 그룹 없음`, b, '');
}
for (const n of names) { const t = F[n] && F[n].text; if (t && (/ id=/.test(t) || /<style/.test(t) || /Gradient/.test(t))) add('어색', 'id/style/gradient 사용(합성 시 충돌)', n, ''); }

// ── 출력 ─────────────────────────────────────────────────
const order = { '뚫림': 0, '잘림': 1, '겹침': 2, '어색': 3 };
V.sort((a, b) => order[a.sev] - order[b.sev] || a.rule.localeCompare(b.rule) || a.subject.localeCompare(b.subject));
const count = (s) => V.filter(v => v.sev === s).length;
const combos = heads.length * bases.length + heads.length * weapons.length + heads.length * bodies.length;
console.log(`캐릭터 조립 규칙 전수 검사 — 부품 ${names.length - missing}/${names.length}장, 쌍별 조합 ${combos}건 + 단품 규격`);
for (const v of V) console.log(`  [${v.sev}] ${v.rule} — ${v.subject} ${v.detail}`);
console.log(`요약: 뚫림 ${count('뚫림')} · 잘림 ${count('잘림')} · 겹침 ${count('겹침')} · 어색 ${count('어색')} · 누락 ${missing}`);
const hard = count('뚫림') + count('잘림') + missing;
console.log(hard ? '최종 결과: 🔴 FAIL (뚫림·잘림은 에셋 수정 대상, 겹침·어색은 경고)' : `최종 결과: ✅ PASS${count('겹침') + count('어색') ? ' (경고 ' + (count('겹침') + count('어색')) + ')' : ''}`);
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ violations: V, combos, parts: names.length - missing }, null, 1));
process.exit(hard ? 1 : 0);
