// 명화 탐정 사건 시험 — 그림 파일 · 크기 · 자리(%)가 바른가 · 찾기/생각/질문 짜임 · 질문 문장(조사) · 색 점 세기
//  node scripts/unit/art/cases.test.mjs   (DOM 없음 · 네트워크 없음)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASES, CHAPTERS, FEELS, BECAUSE, caseById } from '../../../art/js/cases.js';
import { KINDS, kindsFor, questionText, partAt, jo, inRect } from '../../../art/js/ask.js';
import { colorOf, colorShare, judgeColors } from '../../../art/js/colors.js';
import { starsOf, TECH } from '../../../art/js/play.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const results = [];
const test = (name, fn) => { try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const rectOK = r => Array.isArray(r) && r.length >= 4 && r.slice(0, 4).every(v => typeof v === 'number' && v >= 0 && v <= 100) && r[0] < r[2] && r[1] < r[3];
const area = r => (r[2] - r[0]) * (r[3] - r[1]);

// WebP 크기 읽기(VP8 · VP8L · VP8X 머리)
function webpSize(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') throw new Error('WebP 아님 ' + file);
  const t = b.toString('ascii', 12, 16);
  if (t === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (t === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (t === 'VP8L') { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
  throw new Error('모르는 WebP ' + t);
}

test('사건 열다섯 · 장 셋 · 이름 겹침 없음', () => {
  ok(CASES.length === 15 && new Set(CASES.map(c => c.id)).size === 15, '사건 15');
  ok([6, 6, 3].every((n, i) => CASES.filter(c => c.ch === CHAPTERS[i].id).length === n) && CHAPTERS.length === 3, '장마다 여섯 · 여섯 · 셋');
  ok(caseById('impression').think.mode === 'gray' && caseById('grande_jatte').think.mode === 'colors' && caseById('childrens_games').think.mode === 'pick', '실험 판');
  ok(caseById('inwang').think.mode === 'order' && caseById('geumgang').think.mode === 'how' && caseById('sehando').think.mode === 'evidence', '3장 수묵화 판');
});
for (const c of CASES) test(`${c.id} ${c.title} — 그림 · 자리 · 짜임`, () => {
  const img = path.join(ROOT, 'art/img', c.img + '.webp'), th = path.join(ROOT, 'art/img/thumb', c.img + '.webp');
  ok(fs.existsSync(img) && fs.existsSync(th), '그림 파일 없음');
  const [w, h] = webpSize(img);
  ok(w === c.w && h === c.h, `크기 ${w}×${h} ≠ ${c.w}×${c.h}`);
  ok(fs.statSync(img).size < 1000 * 1024 && fs.statSync(th).size < 40 * 1024, '파일이 너무 큼(학교 와이파이)');
  ok(c.title && c.artist && c.year && c.where && c.intro && c.look && c.think.reveal, '설명 글');
  ok(c.think.reveal.length < 240 && c.look.length < 200, '해설이 너무 김');
  // 찾기
  ok(c.finds.filter(f => !f.bonus).length >= 4, '찾기 넷 이상');
  for (const f of c.finds) {
    ok(f.q && f.r.length && f.r.every(rectOK), '찾기 자리 ' + f.q);
    ok(!f.need || f.need <= f.r.length, '개수 ' + f.q);
    ok(f.r.every(r => (r[2] - r[0]) >= 2.5 && (r[3] - r[1]) >= 2.5), '너무 작아 못 짚음 ' + f.q);
  }
  //  두 찾기가 겹치면 작은 쪽이 이긴다(play.js tapFind) — 작은 쪽 가운데를 짚으면 작은 쪽이 맞는지
  for (const f of c.finds) for (const r of f.r) {
    const cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2;
    const hits = c.finds.flatMap(g => g.r.filter(q => inRect(cx, cy, q, 1.2)).map(q => [g, q]));
    const win = hits.sort((a, z) => area(a[1]) - area(z[1]))[0];
    ok(win[0] === f || area(win[1]) <= area(r), `‘${f.q}’ 가운데를 짚으면 다른 것이 먼저 잡힘`);
  }
  // 생각
  const t = c.think;
  ok(['evidence', 'pick', 'gray', 'colors', 'order', 'how'].includes(t.mode) && t.q, '생각 갈래');
  if (t.mode === 'evidence') ok(t.opts.length >= 1 && t.opts.every(o => o.t && o.ev.length && o.ev.every(e => rectOK(e) && typeof e[4] === 'string' && e[4])), '단서 짚기 — 고를 것마다 단서와 이름표');
  if (t.mode === 'pick') ok(t.spots.length >= 3 && t.spots.every(s => s[0] && rectOK(s[1])) && t.other, '놀이 고르기');
  if (t.mode === 'gray') ok(t.opts.length === 3 && t.opts[t.answer] && rectOK(t.sun) && t.sky.every(rectOK), '흑백 실험');
  if (t.mode === 'colors') ok(rectOK(t.region), '색 점 세기 자리');
  if (t.mode === 'order') ok(t.spots.length >= 3 && t.spots.every(sp => sp[0] && rectOK(sp[1])) && new Set(t.spots.map(sp => sp[0])).size === t.spots.length, '먹색 차례 재기 — 이름 붙은 네모');
  if (t.mode === 'order') for (const [a, ra] of t.spots) for (const [b, rb] of t.spots) ok(a === b || ra[2] <= rb[0] || rb[2] <= ra[0] || ra[3] <= rb[1] || rb[3] <= ra[1], `네모 겹침 ${a} · ${b}`);
  if (t.mode === 'how') ok(t.items.length >= 2 && t.items.every(x => x.n && rectOK(x.r) && TECH.some(k => k[0] === x.a) && x.say), '붓 자국 읽기 — 곳마다 답 · 해설');
  if (t.try) ok(/^#\/s\/\d-\d$/.test(t.try.hash) && t.try.label, '먹 연구소 길');
  // 질문 만들기
  ok(c.parts.length >= 4 && new Set(c.parts.map(p => p.n)).size === c.parts.length, '이름 붙은 곳 넷 이상 · 겹침 없음');
  for (const [i, p] of c.parts.entries()) {
    ok(rectOK(p.r) && [0, 1, 2].includes(p.who), '곳 ' + p.n);
    const ks = kindsFor(p);
    ok(ks.length >= 4, p.n + ' 질문 갈래가 넷보다 적음');
    for (const k of ks) { const q = questionText(c, k.k, i); ok(q.endsWith('?') && !/undefined|null|\$\{/.test(q), `문장 ‘${q}’`); }
    ok(partAt(c, (p.r[0] + p.r[2]) / 2, (p.r[1] + p.r[3]) / 2) >= 0, p.n + ' 가운데를 짚어도 아무 곳도 안 잡힘');
  }
});
test('조사 — 받침 따라 은/는 · 이/가 · 을/를', () => {
  ok(jo('고양이', '은', '는') === '고양이는' && jo('후지산', '은', '는') === '후지산은' && jo('해', '을', '를') === '해를' && jo('훈장님', '이', '가') === '훈장님이', '조사');
  ok(questionText(caseById('pajeokdo'), 'ifnot', 0) === '만약 고양이가 없다면 그림이 어떻게 달라질까?', '만약 질문');
  ok(questionText(caseById('great_wave'), 'artist', 0) === '화가는 왜 후지산을 이렇게 그렸을까?', '화가에게');
  ok(questionText(caseById('seodang'), 'why', 0) === '우는 아이는 왜 울고 있을까?', '까닭');
  ok(KINDS.every(k => [1, 2, 3, 4].includes(k.level)), '질문 사다리');
});
test('색 점 세기 — 이름 · 셈 · 견주기', () => {
  ok(colorOf(178, 82, 65) === 'red' && colorOf(105, 116, 116) === 'gray' && colorOf(250, 248, 240) === 'white' && colorOf(40, 90, 200) === 'blue' && colorOf(60, 150, 60) === 'green', '색 이름');
  const sh = colorShare([[40, 90, 200], [40, 90, 200], [250, 248, 240], [60, 150, 60]]);
  ok(sh.blue === 50 && sh.white === 25 && sh.green === 25, '셈 ' + JSON.stringify(sh));
  const j = judgeColors(['blue', 'red'], { blue: 40, white: 12, green: 7 });
  ok(!j.ok && j.extra.includes('red') && j.missed.includes('white'), '하나만 맞히면 다시');
  ok(judgeColors(['blue', 'white'], { blue: 40, white: 12 }).ok, '둘 맞히면 통과');
});
test('별 — 헛짚음 · 힌트(두 배)', () => {
  ok(starsOf(0, 0) === 3 && starsOf(2, 0) === 3 && starsOf(1, 1) === 2 && starsOf(4, 1) === 2 && starsOf(3, 2) === 1, '별 셈');
});
test('느낌 · 까닭 칩 — 이름 겹침 없음', () => {
  ok(FEELS.length >= 8 && new Set(FEELS.map(f => f[0])).size === FEELS.length && BECAUSE.length >= 5 && new Set(BECAUSE.map(b => b[0])).size === BECAUSE.length, '칩');
});
test('그림 출처 문서 — 열다섯 장 모두', () => {
  const t = fs.readFileSync(path.join(ROOT, 'art/CREDITS.md'), 'utf8');
  for (const c of CASES) ok(t.includes(c.img + '.webp'), c.img + ' 출처 없음');
  ok(/공공누리 제1유형/.test(t), '공공누리 표시');
});

const fails = results.filter(r => r[0] === 'FAIL');
for (const r of fails) console.log('FAIL', r[1], r[2] || '');
console.log(`명화 탐정 사건 시험 — PASS ${results.length - fails.length} · FAIL ${fails.length}`);
process.exit(fails.length ? 1 : 0);
