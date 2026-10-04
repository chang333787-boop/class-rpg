// 먹 연구소 시험 — 먹 엔진(농담 L*) · 판 짜임 · 채점(먹색 맞추기 · 꼬리 잇기 · 붓 놀이) · 3장 그림이 명화 탐정에 있는가
//  node scripts/unit/ink/stages.test.mjs   (DOM 없음 · 네트워크 없음)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inkRgb, lightOf, TONES, MAX_DROPS, PASS_DL, closeness, starsOf } from '../../../ink/js/inkcolor.js';
import { CHAPTERS, ST, INK_CASES, stById } from '../../../ink/js/stages.js';
import { judgeMix, nextStep, judgeCell, chainStars, judgeBrush, TASKS, readStroke, CHAIN_LAST } from '../../../ink/js/judge.js';
import { caseById } from '../../../art/js/cases.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const results = [];
const test = (name, fn) => { try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const near = (a, b, t, m) => ok(Math.abs(a - b) <= t, `${m}: ${a.toFixed(1)} ≠ ${b}`);
const D = (ink, water) => ({ ink, water });

test('먹 엔진 — 먹색 다섯의 밝기(L*) · 진한 차례', () => {
  const L = TONES.map(t => lightOf(t.ink, t.water));
  [7.5, 34.3, 57.8, 73.3, 92.1].forEach((v, i) => near(L[i], v, 1, TONES[i].name));
  ok(L.every((x, i) => i === 0 || x > L[i - 1] + 10), '한 단계마다 10 넘게 옅어짐');
  ok(inkRgb(0, 0) === null && inkRgb(3, 0).every((v, i) => Math.abs(v - inkRgb(1, 0)[i]) < 1e-9), '빈 접시 null · 먹만이면 양과 상관없이 같은 색');
  const c = inkRgb(1, 0); ok(c[2] > c[0], '진한 먹은 살짝 푸르스름');
});
test('먹 엔진 — 진하기는 양이 아니라 비율', () => {
  near(lightOf(2, 6), lightOf(1, 3), 1e-9, '1:3 = 2:6');
  ok(lightOf(1, 9) < CHAIN_LAST + 10 && lightOf(1, 9) > CHAIN_LAST, '먹 1 : 물 9 = 가장 옅은 먹(마지막 칸에 닿음)');
  ok(closeness(0) === 100 && closeness(PASS_DL) === 80 && starsOf(1) === 3 && starsOf(5) === 1 && starsOf(PASS_DL + 1) === 0, '가까움 · 별');
});
test('판 짜임 — 장 셋 · 이름 겹침 없음 · 글', () => {
  ok(CHAPTERS.length === 3 && new Set(ST.map(s => s.id)).size === ST.length, '장 · 이름');
  ok(ST.filter(s => s.ch === 1).length === 5 && ST.filter(s => s.ch === 2).length === 5, '1장 다섯 · 2장 다섯');
  for (const s of ST) ok(s.title && s.story && s.hint && s.why && ['predict', 'mix', 'chain', 'brush'].includes(s.kind), s.id + ' 글 · 갈래');
});
test('예상 판 — 답이 맞고 보기 먹색이 서로 뚜렷이 다름', () => {
  for (const s of ST.filter(s => s.kind === 'predict')) {
    const T = lightOf(s.drops.ink, s.drops.water), A = s.opts[s.answer];
    near(lightOf(A.d.ink, A.d.water), T, 0.5, s.id + ' 답');
    const Ls = s.opts.map(o => lightOf(o.d.ink, o.d.water)).sort((a, z) => a - z);
    ok(Ls.every((x, i) => i === 0 || x - Ls[i - 1] >= 10), s.id + ' 보기끼리 10 넘게 차이');
    ok(s.opts.every((o, i) => i === s.answer || o.say), s.id + ' 틀린 보기마다 까닭');
  }
});
test('섞기 판 — 아홉 방울 안에서 풀 수 있음(최소 방울 수 포함)', () => {
  for (const s of ST.filter(s => s.kind === 'mix')) {
    let can = false;
    for (let i = 1; i <= MAX_DROPS; i++) for (let w = 0; w <= MAX_DROPS; w++) if (judgeMix(s.target.d, D(i, w), { min: s.min || 0 }).ok) can = true;
    ok(can, s.id + ' 못 풂');
    ok(judgeMix(s.target.d, s.target.d, { min: 0 }).stars === 3, s.id + ' 목표 그대로 = 별 셋');
  }
});
test('먹색 채점 — 너무 진함 · 너무 옅음 · 먹 없음 · 양', () => {
  const t = D(1, 3);
  ok(judgeMix(t, D(1, 1)).kind === 'dark' && /더 옅어요/.test(judgeMix(t, D(1, 1)).say), '진하면 dark');
  ok(judgeMix(t, D(1, 9)).kind === 'pale', '옅으면 pale');
  ok(judgeMix(t, D(0, 4)).kind === 'paper' && judgeMix(t, D(0, 0)).empty, '물만 · 빈 접시');
  const a = judgeMix(t, D(1, 3), { min: 8 }); ok(!a.ok && a.kind === 'amount', '1:3 은 8방울이 안 됨');
  ok(judgeMix(t, D(2, 6), { min: 8 }).ok, '2:6 통과');
  ok(judgeMix(t, D(1, 1), { misses: 1 }).say.includes('물을'), '두 번째부터 다음 한두 방울');
});
test('다음 한두 방울 — 늘 목표에 더 가까워지는 말', () => {
  for (const s of ST.filter(s => s.kind === 'mix')) for (let i = 1; i <= 4; i++) for (let w = 0; w <= 8; w++) {
    const T = lightOf(s.target.d.ink, s.target.d.water), now = Math.abs(lightOf(i, w) - T), say = nextStep(D(i, w), T);
    if (!say) continue;
    ok(/^(먹|물)을 /.test(say) && say.endsWith('볼까요?'), '말 꼴 ' + say);
  }
  ok(nextStep(D(1, 1), lightOf(1, 3)).startsWith('물을'), '1:1 → 1:3 이면 물');
  ok(nextStep(D(1, 7), lightOf(1, 3)).length > 0, '1:7 → 1:3 도 말해 줌');
});
test('농담 꼬리 — 별 셋 꼬리가 있음 · 차례 · 먹 없음 · 마지막 칸', () => {
  const good = [D(1, 0), D(1, 1), D(1, 2), D(1, 4), D(1, 9)];
  good.forEach((d, i) => { if (i) ok(judgeCell(good.slice(0, i).concat([null]).concat(Array(4 - i).fill(null)), i, d).ok, `${i}번 칸`); });
  ok(chainStars(good) === 3, '고른 꼬리 = 별 셋');
  ok(chainStars([D(1, 0), D(2, 1), D(1, 1), D(1, 3), D(1, 9)]) === 2, '덜 고르면 별 둘');
  const cells = [D(1, 0), D(1, 3), null, null, null];
  ok(judgeCell(cells, 2, D(1, 3)).kind === 'order' && judgeCell(cells, 2, D(1, 1)).kind === 'order', '같거나 진하면 차례');
  ok(judgeCell(cells, 2, D(0, 5)).kind === 'paper', '먹 없음');
  ok(judgeCell([D(1, 0), D(1, 1), D(1, 2), D(1, 3), null], 4, D(1, 6)).ok && judgeCell([D(1, 0), D(2, 1), D(1, 1), D(1, 2), null], 4, D(2, 9)).kind === 'dark', '마지막 칸은 아주 옅게(L* 70 넘게)');
});
test('붓 놀이 — 할 일 셈(점 크기 · 선 굵기 · 마른 붓 · 번짐 · 먹색 두 가지)', () => {
  const dot = (w, wet = false, tone = 't1') => ({ dot: true, len: 0, avgW: w, maxW: w, dry: 0, wet, tone });
  const line = (len, avgW, dry = 0, tone = 't1', wet = false) => ({ dot: false, len, avgW, maxW: avgW + 4, dry, wet, tone });
  ok(judgeBrush('dots', [dot(24), dot(26), dot(8), dot(9)]).done && !judgeBrush('dots', [dot(24), dot(26), dot(15), dot(9)]).done, '점');
  ok(judgeBrush('lines', [line(200, 16), line(220, 5)]).done && !judgeBrush('lines', [line(200, 16), line(80, 5)]).done, '선(짧으면 안 셈)');
  ok(judgeBrush('dry', [line(240, 14, 0.4)]).done && !judgeBrush('dry', [line(240, 14, 0.1)]).done, '마른 붓');
  ok(judgeBrush('wet', [dot(20, true), dot(20)]).done && !judgeBrush('wet', [line(200, 14, 0, 't1', true), dot(20)]).done, '번지는 점은 점으로');
  ok(judgeBrush('free', [line(150, 14, 0, 't1'), line(150, 10, 0, 't4'), line(130, 8, 0, 't4')]).done && !judgeBrush('free', [line(150, 14), line(150, 10), line(130, 8)]).done, '자유 그림');
  for (const s of ST.filter(s => s.kind === 'brush')) ok(TASKS[s.task], s.id + ' 할 일 없음');
  ok(/큰 점/.test(readStroke(dot(24))) && /가는 선/.test(readStroke(line(200, 5))) && /마른 붓 40%/.test(readStroke(line(200, 14, 0.4))) && /더 길게/.test(readStroke(line(60, 14))), '붓 자국 읽기');
});
test('3장 — 명화 탐정에 같은 그림이 있음', () => {
  for (const k of INK_CASES) {
    const c = caseById(k.id);
    ok(c && c.ch === 3, k.id + ' 명화 탐정 3장에 없음');
    ok(c.artist === k.artist && c.title === k.title, k.id + ' 화가 · 제목 다름');
    ok(fs.existsSync(path.join(ROOT, 'art/img/thumb', c.img + '.webp')), k.id + ' 작은 그림 없음');
  }
  ok(stById('2-3').why.includes('세한도') && stById('2-5').why.includes('인왕제색도'), '붓 놀이 해설이 3장 그림과 이어짐');
});

const fails = results.filter(r => r[0] === 'FAIL');
for (const r of fails) console.log('FAIL', r[1], r[2] || '');
console.log(`먹 연구소 시험 — PASS ${results.length - fails.length} · FAIL ${fails.length}`);
process.exit(fails.length ? 1 : 0);
