// 판화 놀이 시험 — 판 셈(뒤집기 · 넓히기 · 파기) · 판 짜임 · 새기기 채점(거울 실수 · 넘쳐 팜 · 덜 팜) · 찍기 채점 · 4장 그림이 명화 탐정에 있는가
//  node scripts/unit/print/stages.test.mjs   (DOM 없음 · 네트워크 없음 · 글자 판은 그림 쪽이라 헤드리스에서 본다)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { N, blank, clone, count, mirror, flipV, invert, and, or, minus, dilate, erode, band, carve, carveLine, iou, shape, circle } from '../../../print/js/block.js';
import { CHAPTERS, ST, PRINT_CASES, blocks, specs, INKS, stById } from '../../../print/js/stages.js';
import { judgeCarve, pressCoverage, judgePress } from '../../../print/js/judge.js';
import { caseById } from '../../../art/js/cases.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const results = [];
const test = (name, fn) => { try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

test('판 셈 — 뒤집기 두 번 = 그대로 · 넓히기 ⊇ 원래 ⊇ 좁히기 · 테두리 띠', () => {
  const m = shape(circle(30, 40, 12));
  ok(same(mirror(mirror(m)), m) && same(flipV(flipV(m)), m) && same(invert(invert(m)), m), '두 번 뒤집기');
  ok(!same(mirror(m), m), '한쪽으로 치우친 모양은 뒤집으면 달라짐');
  const d = dilate(m, 2), e = erode(m, 2);
  ok(count(minus(m, d)) === 0 && count(minus(e, m)) === 0 && count(d) > count(m) && count(m) > count(e), '넓히기 · 좁히기');
  ok(count(band(m, 1.5)) > 0 && count(and(band(m, 1.5), erode(m, 2))) === 0, '테두리 띠');
});
test('파기 — 원 하나 · 끌면 이어진 선 · 같은 곳은 두 번 안 셈', () => {
  const m = blank(), n1 = carve(m, 48, 48, 4.8), n2 = carve(m, 48, 48, 4.8);
  ok(n1 > 60 && n1 < 80 && n2 === 0, '둥근칼 한 번 ' + n1);
  const l = blank(), n = carveLine(l, [10, 10], [80, 10], 1.5);
  ok(n > 140 && n < 260, '세모칼 선 ' + n);
  ok([...Array(70)].every((_, k) => l[10 * N + 10 + k]), '끊김 없음');
});
test('판 짜임 — 장 넷 · 이름 겹침 없음 · 글 · 갈래', () => {
  ok(CHAPTERS.length === 4 && new Set(ST.map(s => s.id)).size === ST.length, '장 · 이름');
  ok(ST.filter(s => s.ch === 1).length === 4 && ST.filter(s => s.ch === 2).length === 4 && ST.filter(s => s.ch === 3).length === 3, '1장 넷 · 2장 넷 · 3장 셋');
  for (const s of ST) ok(s.title && s.story && s.hint && s.why && ['predict', 'choose', 'carve', 'press', 'multi', 'free'].includes(s.kind), s.id + ' 글 · 갈래');
  for (const s of ST.filter(s => s.kind === 'predict' || s.kind === 'choose')) {
    ok(s.opts[s.answer] && s.opts.every((o, i) => i === s.answer || s.say[o[0]]), s.id + ' 답 · 틀린 보기마다 까닭');
    ok(s.kind !== 'choose' || s.target, s.id + ' 목표 종이');
  }
  for (const s of ST.filter(s => s.kind === 'carve')) ok(specs[s.id] && s.guides.every(g => blocks[g]) && ['v', 'u'].includes(s.tool) && s.target, s.id + ' 채점 범위 · 밑그림 · 칼');
  for (const s of ST.filter(s => s.block && !s.block.startsWith('text:'))) ok(blocks[s.block], s.id + ' 판 없음');
  ok(INKS.length >= 3 && INKS.every(c => /^#[0-9a-f]{6}$/.test(c[2])), '잉크 색');
});
test('1-1 새 판 — 좌우가 뚜렷이 달라 예상할 거리가 있음', () => {
  const b = blocks.bird();
  ok(iou(invert(b), invert(mirror(b))) < 0.6, '새는 뒤집으면 많이 다름 ' + iou(invert(b), invert(mirror(b))).toFixed(2));
  ok(count(invert(b)) > 900, '새가 넉넉히 큼');
});
test('1-4 물고기 — 맞는 쪽 · 반대쪽(거울 실수) · 둘 다 · 덜', () => {
  const sp = specs['1-4']();
  ok(count(and(sp.must, sp.other)) === 0, '두 밑그림 띠가 안 겹침');
  ok(judgeCarve('1-4', sp, clone(sp.must)).ok && judgeCarve('1-4', sp, clone(sp.must)).stars === 3, '맞는 쪽 그대로 = 별 셋');
  const wrong = judgeCarve('1-4', sp, clone(sp.other)); ok(!wrong.ok && wrong.kind === 'mirror', '반대쪽 = 거울 실수');
  const both = judgeCarve('1-4', sp, or(sp.must, sp.other)); ok(!both.ok && both.kind === 'mirror' && /두 마리/.test(both.say), '둘 다 = 한 마리만');
  const half = clone(sp.must); for (let i = 0; i < half.length; i++) if (half[i] && i % 2) half[i] = 0;
  ok(judgeCarve('1-4', sp, half).kind === 'less', '반만 = 덜 팜');
});
test('2-3 흰 별 · 2-4 검은 공 — 맞게 · 넘쳐 · 덜', () => {
  for (const id of ['2-3', '2-4']) {
    const sp = specs[id]();
    ok(count(and(sp.must, sp.keep)) === 0, id + ' 팔 곳 · 남길 곳 안 겹침');
    ok(judgeCarve(id, sp, clone(sp.must)).ok, id + ' 맞게');
    ok(judgeCarve(id, sp, blank().fill(1)).kind === 'over', id + ' 다 파면 넘침');
    const half = clone(sp.must); for (let i = 0; i < half.length; i++) if (half[i] && i % 2) half[i] = 0;
    ok(judgeCarve(id, sp, half).kind === 'less', id + ' 덜');
  }
  ok(count(specs['2-4']().must) < 6500, '2-4 파야 할 곳이 너무 넓지 않음(둥근칼로 열 번 안팎) ' + count(specs['2-4']().must));
});
test('찍기 — 잉크 · 문지르기 몫과 채점', () => {
  const m = blocks.pressFish(), full = new Float32Array(N * N).fill(1), none = new Float32Array(N * N);
  const c = pressCoverage(m, full, full); ok(c.ink === 1 && c.rub === 1 && judgePress(c).stars === 3, '다 하면 별 셋');
  ok(judgePress(pressCoverage(m, none, full)).kind === 'ink', '잉크 없음');
  const halfRub = new Float32Array(N * N).map((_, i) => (i % N < N / 2 ? 1 : 0));
  ok(judgePress(pressCoverage(m, full, halfRub)).kind === 'rub', '반만 문지름');
  ok(count(invert(m)) > 1500 && count(m) > 2000, '물고기 판에 남은 면 · 판 곳이 넉넉함');
});
test('4장 — 명화 탐정에 같은 그림이 있음', () => {
  for (const k of PRINT_CASES) {
    const c = caseById(k.id);
    ok(c && c.artist && fs.existsSync(path.join(ROOT, 'art/img/thumb', c.img + '.webp')), k.id + ' 명화 탐정에 없음');
  }
  ok(stById('3-3').kind === 'free', '자유 판화');
});

const fails = results.filter(r => r[0] === 'FAIL');
for (const r of fails) console.log('FAIL', r[1], r[2] || '');
console.log(`판화 놀이 시험 — PASS ${results.length - fails.length} · FAIL ${fails.length}`);
process.exit(fails.length ? 1 : 0);
