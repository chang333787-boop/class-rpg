// 음악실 비트 만들기 시험 [MUSIC-BEAT-1] — 모양 · 살피기(틀린 값 · 너무 큰 값) · 저장 모양 왕복 · 고르게 나누기 · 스윙 시각 · 녹음 칸 고르기
//  · 필인 · 주사위 · 기본 리듬 카드 · 칸 수 바꾸기 · 되풀이 박자기(가짜 시계 — 시각이 안 밀리는지 · 늦는 칸이 없는지) · 저장소(손님 · 가짜 Firebase)
//  node scripts/unit/music/beat.test.mjs   (DOM 없음 · 네트워크 없음)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as B from '../../../music/js/beatcore.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const results = [];
const test = async (name, fn) => { try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e)]); } };
const ok = (c, m) => { if (!c) throw new Error(m || '아님'); };
const eq = (a, b, m) => { const sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error(`${m ? m + ': ' : ''}기대 ${sb.slice(0, 300)} · 실제 ${sa.slice(0, 300)}`); };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const NO_WORD = '\uBE0C\uB79C\uCE58';   // 쓰지 않기로 한 낱말(사용자 규칙) — 글자 그대로 적지 않으려고 유니코드로

//  아무 비트(무작위) — 왕복 시험용
function randomBeat(rng) {
  const b = B.emptyBeat();
  b.grid = B.GRID_KEYS[Math.floor(rng() * B.GRID_KEYS.length)];
  const g = B.gridOf(b.grid), len = B.lenOf(g);
  b.pats = [0, 1, 2, 3].map(() => {
    const p = B.emptyPattern(g);
    for (const r of B.ROWS) p.d[r] = Array.from({ length: len }, () => [0, 0, 1, 2][Math.floor(rng() * 4)]);
    p.b = Array.from({ length: len }, () => [-1, -1, -1, 0, 1, 2, 3, 4, 5, 9][Math.floor(rng() * 10)]);
    p.c = p.c.map(() => [null, 'I', 'IV', 'V', 'vi'][Math.floor(rng() * 5)]);
    p.cs = B.STYLE_KEYS[Math.floor(rng() * 3)];
    return p;
  });
  b.title = '비트 ' + Math.floor(rng() * 1000);
  b.bpm = B.BPM_MIN + Math.floor(rng() * 91); b.swing = Math.floor(rng() * 61); b.kit = B.KIT_KEYS[Math.floor(rng() * 3)];
  b.arr = Array.from({ length: Math.floor(rng() * 9) }, () => Math.floor(rng() * 4));
  b.mode = rng() < 0.5 ? 'song' : 'loop'; b.cur = Math.floor(rng() * 4);
  for (const r of B.MIX) b.mix[r] = { v: Math.round(rng() * 100) / 100, m: rng() < 0.2, s: rng() < 0.1 };
  b.show = { shaker: rng() < 0.5, cymbal: rng() < 0.5 }; b.fill = rng() < 0.5; b.click = rng() < 0.5;
  return b;
}

await test('빈 비트 모양 — 16칸 · 패턴 넷 · 줄 여덟 · 베이스 빈칸 · 화음 넷 · 빠르기 96', () => {
  const b = B.emptyBeat();
  eq([b.grid, b.bpm, b.swing, b.kit, b.pats.length, b.mode, b.cur, b.arr.length], ['16', 96, 0, 'elec', 4, 'loop', 0, 0]);
  for (const p of b.pats) { eq(Object.keys(p.d), B.ROWS); ok(B.ROWS.every(r => p.d[r].length === 16 && p.d[r].every(v => v === 0))); eq(p.b.length, 16); ok(p.b.every(v => v === -1)); eq(p.c, [null, null, null, null]); eq(p.cs, 'long'); }
  ok(!B.hasContent(b) && B.patternEmpty(b.pats[0]));
  eq(Object.keys(b.mix), [...B.ROWS, 'mel', 'bass', 'chord']);
  eq(B.normalizeBeat(b), b, '빈 비트 살피기 = 그대로');
});

await test('칸 수 다섯 — 16 · 8 · 32 · 12 · 9 = 길이 · 박 · 화음 칸', () => {
  eq(B.GRID_KEYS.map(k => [B.lenOf(B.gridOf(k)), B.beatsOf(B.gridOf(k)), B.slotsOf(B.gridOf(k)), B.slotLen(B.gridOf(k))]), [[16, 4, 4, 4], [8, 4, 4, 2], [32, 8, 4, 8], [12, 4, 4, 3], [9, 3, 3, 3]]);
  eq(B.gridOf('모름').key, '16'); eq(B.gridOf('toString').key, '16'); eq(B.gridOf('__proto__').key, '16');
});

await test('살피기 — 틀린 값 · 모르는 칸 · 너무 큰 값은 버리거나 기본값(화면이 안 깨짐)', () => {
  for (const raw of [null, undefined, 0, 1, 'x', [], [1, 2], true, () => 1]) eq(B.normalizeBeat(raw), B.emptyBeat(), '이상한 값 ' + String(raw));
  const huge = { grid: 'toString', kit: '__proto__', bpm: 9999, swing: -5, title: '가'.repeat(500), id: 'x'.repeat(500), cur: 99, mode: 'party',
    pats: { 0: { d: { kick: '2'.repeat(100000), snare: { 0: 2, 3: '1', 5: 7, 4294967294: 2 }, hatc: [1, 1, 'a', null, true, 2.5], tom: 12345 }, b: '0123459x?-'.repeat(1000), c: ['I', 'toString', '__proto__', 'vi', 'V'], cs: 'constructor' }, 7: { d: {} } },
    arr: [0, 1, 2, 3, 4, -1, '2', 'x', 1, 1, 1, 1, 1], mix: { kick: { v: 7, m: 'yes', s: 1 }, snare: { v: -3 }, bass: { v: '0.5' }, chord: null, toString: { v: 1 } },
    show: { shaker: 1, cymbal: 'true' }, fill: 'true', click: 1, extra: { deep: [1, 2, 3] } };
  const t0 = Date.now();
  const b = B.normalizeBeat(huge);
  ok(Date.now() - t0 < 200, '너무 오래 걸림 ' + (Date.now() - t0) + 'ms');
  eq([b.grid, b.kit, b.bpm, b.swing, b.title.length, b.id.length, b.cur, b.mode], ['16', 'elec', 160, 0, 30, 60, 3, 'loop']);
  eq(b.pats[0].d.kick, new Array(16).fill(2), '긴 글은 16칸만');
  eq(b.pats[0].d.snare, [2, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], '객체 꼴(Firebase) · 7 은 버림 · 엄청 큰 번호는 안 읽음');
  eq(b.pats[0].d.hatc, [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "'a' · null · true · 2.5 는 0");
  eq(b.pats[0].d.tom, new Array(16).fill(0), '숫자 하나는 줄이 아님');
  eq(b.pats[0].b, [0, 1, 2, 3, 4, 5, 9, 9, -1, -1, 0, 1, 2, 3, 4, 5], "베이스: '9' · 'x' = 쉼 · '?' · '-' 는 빈칸");
  eq(b.pats[0].c, ['I', null, null, 'vi'], '모르는 화음 카드 · 물려받은 이름(toString) 은 빈칸 · 다섯째는 버림');
  eq(b.pats[0].cs, 'long');
  eq(b.arr, [0, 1, 2, 3, 2], '순서: 0~3 만 · 앞 여덟 칸만 읽음');
  eq(b.mix.kick, { v: 1, m: false, s: true }); eq(b.mix.snare.v, 0); eq(b.mix.bass.v, 0.5); eq(b.mix.chord, { v: 0.8, m: false, s: false });
  eq(b.show, { shaker: true, cymbal: false }); eq([b.fill, b.click], [false, true]);
  ok(!('extra' in b) && !('toString' in b.mix && b.mix.toString !== Object.prototype.toString), '모르는 칸은 안 남김');
  //  칸 수가 바뀌면 줄 길이도 그 칸 수
  const b9 = B.normalizeBeat({ grid: 9, pats: [{ d: { kick: '2'.repeat(40) }, b: '0'.repeat(40), c: ['I', 'V', 'IV', 'vi'] }] });
  eq([b9.grid, b9.pats[0].d.kick.length, b9.pats[0].b.length, b9.pats[0].c], ['9', 9, 9, ['I', 'V', 'IV']]);
  const b32 = B.normalizeBeat({ grid: '32' });
  eq([b32.pats[3].d.cymbal.length, b32.pats[3].b.length, b32.pats[3].c.length], [32, 32, 4]);
});

await test('저장 모양 왕복 — 무작위 비트 300개: normalizeBeat(packBeat(b)) = b · 글자 줄 · JSON 크기 4KB 아래', () => {
  const rng = B.mulberry32(7);
  let maxSize = 0;
  for (let k = 0; k < 300; k++) {
    const b = randomBeat(rng);
    const packed = B.packBeat(b);
    const json = JSON.stringify(packed); maxSize = Math.max(maxSize, json.length);
    ok(typeof packed.pats[0].d.kick === 'string' && typeof packed.pats[0].b === 'string' && packed.pats[0].c.every(c => typeof c === 'string'), '글자 줄');
    eq(B.normalizeBeat(JSON.parse(json)), b, '왕복 ' + k);
    //  Firebase 가 배열을 객체로 바꿔도
    const fb = JSON.parse(json); fb.pats = Object.assign({}, fb.pats); fb.arr = Object.assign({}, fb.arr); for (const p of Object.values(fb.pats)) p.c = Object.assign({}, p.c);
    eq(B.normalizeBeat(fb), b, '객체 꼴 왕복 ' + k);
  }
  ok(maxSize < 4096, '가장 큰 저장 ' + maxSize + '자');
});

await test('고르게 나누기 — n 칸에 k 번 · 첫 칸부터 · 사이는 몫 또는 몫+1(1~32칸 전부)', () => {
  eq(B.euclid(3, 8), [1, 0, 0, 1, 0, 0, 1, 0], '3 / 8 = x..x..x.');
  eq(B.euclid(4, 16).map((v, i) => (v ? i : -1)).filter(i => i >= 0), [0, 4, 8, 12]);
  eq(B.euclid(0, 16), new Array(16).fill(0)); eq(B.euclid(16, 16), new Array(16).fill(1)); eq(B.euclid(99, 8), new Array(8).fill(1));
  for (let n = 1; n <= 32; n++) for (let k = 1; k <= n; k++) {
    const r = B.euclid(k, n), g = B.gaps(r);
    ok(r.length === n && r.filter(Boolean).length === k && r[0] === 1, `${k}/${n} 개수`);
    ok(Math.max(...g) - Math.min(...g) <= 1 && g.reduce((a, x) => a + x, 0) === n, `${k}/${n} 사이 ${g}`);
  }
  eq(B.describeEuclid(4, 16).text, '16칸 ÷ 4 = 4 → 4칸마다 한 번');
  eq(B.describeEuclid(5, 16).text, '16칸 ÷ 5 = 3 … 1 → 3칸 사이 4번 · 4칸 사이 1번');
  eq(B.describeEuclid(3, 16).text, '16칸 ÷ 3 = 5 … 1 → 5칸 사이 2번 · 6칸 사이 1번');
  const g5 = B.gaps(B.euclid(5, 16)); eq([g5.filter(x => x === 3).length, g5.filter(x => x === 4).length], [4, 1], '글과 실제 사이가 같음');
  eq(B.describeEuclid(0, 16).text, '16칸에 하나도 없어요');
});

await test('엇박으로 밀기 — 한 칸 뒤로 · 앞으로 = 되돌림 · 끝 칸은 처음으로', () => {
  const r = [2, 0, 0, 1, 0, 0, 0, 1];
  eq(B.rotate(r, 1), [1, 2, 0, 0, 1, 0, 0, 0]); eq(B.rotate(B.rotate(r, 1), -1), r); eq(B.rotate(r, 8), r); eq(B.rotate([], 1), []);
});

await test('스윙 시각 — 둘째 칸마다 늦게 · 0% = 곧게 · 60% 여도 다음 칸보다 앞 · 한 박 = 세 칸이면 스윙 없음', () => {
  const g = B.gridOf('16'), sd = 60 / 120 / 4;
  for (let i = 0; i < 16; i++) ok(near(B.stepOffset(i, 120, 0, g), i * sd), '곧게 ' + i);
  ok(near(B.stepOffset(1, 120, 50, g), sd * 1.5) && near(B.stepOffset(2, 120, 50, g), sd * 2) && near(B.stepOffset(3, 120, 33, g), sd * 3.33));
  for (const sw of [0, 10, 33, 50, 60]) for (let i = 0; i < 15; i++) ok(B.stepOffset(i, 96, sw, g) < B.stepOffset(i + 1, 96, sw, g), `차례 ${sw}% ${i}`);
  const g12 = B.gridOf('12'); ok(near(B.stepOffset(1, 90, 60, g12), 60 / 90 / 3), '12칸 = 스윙 없음');
  const g8 = B.gridOf('8'); ok(near(B.stepOffset(1, 100, 50, g8), 0.3 * 1.5), '8칸 = 반 박 스윙(셔플)');
  near(B.barDur(96, g), 2.5) || ok(false, '96 = 한 마디 2.5초');
});

await test('녹음 칸 고르기 — 가장 가까운 칸 · 마디 끝 가까이 = 첫 칸 · 스윙 자리 · 실제 울린 시각 목록에서', () => {
  const g = B.gridOf('16'), sd = 60 / 100 / 4;
  eq(B.nearestStep(0.001, 100, 0, g), 0); eq(B.nearestStep(sd * 4.4, 100, 0, g), 4); eq(B.nearestStep(sd * 4.6, 100, 0, g), 5);
  eq(B.nearestStep(sd * 15.7, 100, 0, g), 0, '끝 → 다음 마디 첫 칸'); eq(B.nearestStep(-sd * 0.3, 100, 0, g), 0, '조금 일찍 = 첫 칸');
  eq(B.nearestStep(sd * 16 * 3 + sd * 2, 100, 0, g), 2, '여러 마디 지나도');
  eq(B.nearestStep(sd * 1.55, 100, 60, g), 1, '스윙 60%: 1.55칸 자리 = 둘째 칸(늦게 오는)'); eq(B.nearestStep(sd * 1.2, 100, 0, g), 1);
  eq(B.nearestStep(sd * 1.2, 100, 60, g), 1); eq(B.nearestStep(sd * 0.75, 100, 60, g), 0, '스윙이면 0.75 는 첫 칸 쪽');
  const c = [{ t: 1.0, step: 3 }, { t: 1.1, step: 4 }, { t: 1.2, step: 5 }];
  eq(B.nearestOf(1.13, c).step, 4); eq(B.nearestOf(0.2, c).step, 3); eq(B.nearestOf(5, c).step, 5); eq(B.nearestOf(1, []), null);
});

await test('필인 — 마지막 한 박만 통 · 짝 굴리기 · 앞 칸 · 원래 패턴은 그대로 · 쿵은 남김(칸 수 다섯 전부)', () => {
  for (const k of B.GRID_KEYS) {
    const g = B.gridOf(k), len = B.lenOf(g), p = B.starterPattern(B.STARTERS[0]);
    const src = k === '16' ? p : B.convertPattern(p, '16', k);
    src.d.kick[len - 1] = 1; src.d.hatc[len - 1] = 1;
    const keep = JSON.stringify(src);
    for (let v = 0; v < 3; v++) {
      const f = B.fillDrums(src.d, g, v);
      eq(JSON.stringify(src), keep, '원래 패턴 안 바뀜');
      for (const r of B.ROWS) for (let i = 0; i < len - g.sub; i++) ok(f[r][i] === src.d[r][i], `${k} 앞 칸 ${r}${i}`);
      const last = Array.from({ length: g.sub }, (_, j) => len - g.sub + j);
      ok(last.every(i => f.tom[i] || f.snare[i]), `${k} 마지막 박이 통 · 짝으로 꽉`); ok(last.every(i => !f.hatc[i] && !f.hato[i] && !f.clap[i]), `${k} 칙 · 박수 비움`);
      eq(f.snare[len - 1], 2, '마지막은 세게'); eq(f.kick[len - 1], 1, '쿵은 남김');
    }
  }
});

await test('주사위 — 첫 박 쿵(세게) · 2·4박 짝(세 박이면 2·3박) · 칙이 있음 · 값은 0/1/2 · 같은 씨앗 = 같은 결과 · 여러 모양', () => {
  const seen = new Set();
  for (const k of B.GRID_KEYS) {
    const g = B.gridOf(k), len = B.lenOf(g), S = g.sub;
    for (let seed = 1; seed <= 60; seed++) {
      const d = B.dice(g, B.mulberry32(seed));
      eq(Object.keys(d), B.ROWS); ok(B.ROWS.every(r => d[r].length === len && d[r].every(v => v === 0 || v === 1 || v === 2)), '값');
      for (let bar = 0; bar < g.bars; bar++) {
        const o = bar * g.beats * S;
        ok(d.kick[o] === 2, `${k} 첫 박 쿵`);
        if (g.beats === 4) ok(d.snare[o + S] === 2 && d.snare[o + 3 * S] === 2, `${k} 2·4박 짝`); else ok(d.snare[o + S] && d.snare[o + 2 * S] === 2, `${k} 2·3박`);
      }
      ok(d.hatc.some(Boolean), '칙');
      eq(B.dice(g, B.mulberry32(seed)), d, '같은 씨앗');
      seen.add(JSON.stringify(d));
    }
  }
  ok(seen.size > 200, '모양 수 ' + seen.size);
});

await test('기본 리듬 카드 — 일곱 장 · 장르 이름 없음 · 북+베이스+화음 · 살피기 그대로 · 우리 장단 = 우리 장단 소리 + 한 박 세 칸', () => {
  eq(B.STARTERS.length, 7);
  const GENRE = /붐뱁|붐 뱁|트랩|힙합|하우스|테크노|디스코|레게|재즈|펑크|록|락|EDM|덥|드릴|로파이|lo-?fi|trap|boom|house|techno|disco|reggae|jazz|funk|rock|hip/i;
  const ids = new Set();
  for (const st of B.STARTERS) {
    ok(!ids.has(st.id), '같은 id ' + st.id); ids.add(st.id);
    ok(!GENRE.test(st.name + st.desc), '장르 이름 ' + st.name);
    const g = B.gridOf(st.grid), p = B.starterPattern(st);
    ok(B.ROWS.some(r => p.d[r].some(Boolean)) && p.b.some(v => v >= 0 && v <= 5) && p.c.some(Boolean), st.id + ' 북 · 베이스 · 화음');
    for (const r of Object.keys(st.d)) eq(st.d[r].replace(/\s/g, '').length, B.lenOf(g), `${st.id} ${r} 길이`);
    eq(st.b.replace(/\s/g, '').length, B.lenOf(g), st.id + ' 베이스 길이'); eq(st.c.length, B.slotsOf(g), st.id + ' 화음 칸');
    const b = { ...B.emptyBeat(), grid: st.grid, pats: [p, B.emptyPattern(g), B.emptyPattern(g), B.emptyPattern(g)] };
    eq(B.normalizeBeat(B.packBeat(b)).pats[0], p, st.id + ' 왕복');
    ok(st.bpm >= B.BPM_MIN && st.bpm <= B.BPM_MAX && st.swing >= 0 && st.swing <= B.SWING_MAX);
  }
  const semachi = B.STARTERS.find(s => s.id === 'semachi'), gut = B.STARTERS.find(s => s.id === 'gutgeori');
  eq([semachi.kit, semachi.grid, gut.kit, gut.grid], ['kor', '9', 'kor', '12']);
  //  세마치 = 덩 · 덩 | 쿵 · 덕 | 쿵 덕 ·
  const sp = B.starterPattern(semachi), word = i => (sp.d.clap[i] ? '덩' : sp.d.shaker[i] ? '쿵' : sp.d.snare[i] ? '덕' : '·');
  eq(Array.from({ length: 9 }, (_, i) => word(i)).join(''), '덩·덩쿵·덕쿵덕·');
  const st = B.STARTERS.find(s => s.id === 'bounce'); ok(st.swing > 0, '통통 튀는 = 스윙');
  const basic = B.starterPattern(B.STARTERS[0]); eq(basic.d.kick.map((v, i) => (v ? i : -1)).filter(i => i >= 0), [0, 8]); eq(basic.d.snare.map((v, i) => (v ? i : -1)).filter(i => i >= 0), [4, 12]);
});

await test('카드 넣기 — 지금 패턴만 바뀜 · 빠르기 · 스윙 · 소리 묶음 · 칸 수가 다르면 다른 패턴도 옮김(converted) · 줄 보이기', () => {
  const b = B.emptyBeat(); b.cur = 1; b.pats[0].d.kick[4] = 2;
  const r = B.applyStarter(b, 'dance');
  ok(!r.converted); eq(r.beat.pats[0], b.pats[0]); eq(r.beat.pats[1], B.starterPattern(B.STARTERS.find(s => s.id === 'dance'))); eq([r.beat.bpm, r.beat.kit], [120, 'elec']);
  const r2 = B.applyStarter(b, 'semachi');
  ok(r2.converted, '다른 패턴에 칸이 있으면 알림'); eq([r2.beat.grid, r2.beat.kit, r2.beat.pats[0].d.kick.length, r2.beat.show.shaker], ['9', 'kor', 9, true]);
  eq(r2.beat.pats[0].d.kick.map((v, i) => (v ? i : -1)).filter(i => i >= 0), [3], '16칸 2박 → 9칸 2박');
  ok(!B.applyStarter(B.emptyBeat(), 'gutgeori').converted, '빈 패턴만 있으면 알릴 것 없음');
  eq(B.applyStarter(b, '없는 카드').beat, b);
});

await test('칸 수 바꾸기 — 16→8 박 자리 · 8→16 · 16→32 되풀이 · 32→16 첫 마디 · 16→9 넷째 박 버림 · 화음 칸 옮김', () => {
  const p = B.starterPattern(B.STARTERS[0]); p.c = ['I', 'IV', 'V', 'vi'];
  const p8 = B.convertPattern(p, '16', '8'); eq(p8.d.kick.map((v, i) => (v ? i : -1)).filter(i => i >= 0), [0, 4]); eq(p8.d.snare.map((v, i) => (v ? i : -1)).filter(i => i >= 0), [2, 6]); eq(p8.c, ['I', 'IV', 'V', 'vi']);
  eq(B.convertPattern(p8, '8', '16').d.snare.map((v, i) => (v ? i : -1)).filter(i => i >= 0), [4, 12]);
  const p32 = B.convertPattern(p, '16', '32'); eq(p32.d.kick.map((v, i) => (v ? i : -1)).filter(i => i >= 0), [0, 8, 16, 24]); eq(p32.c, ['I', 'V', 'I', 'V']); eq(p32.b.slice(16), p32.b.slice(0, 16));
  const back = B.convertPattern(p32, '32', '16'); eq(back.d, p.d); eq(back.c, ['I', 'I', 'V', 'V']);
  const p9 = B.convertPattern(p, '16', '9'); eq(p9.d.snare.map((v, i) => (v ? i : -1)).filter(i => i >= 0), [3], '4박 짝은 버림'); eq(p9.c, ['I', 'IV', 'V']);
  const p12 = B.convertPattern(p, '16', '12'); eq(p12.d.hatc.map((v, i) => (v ? i : -1)).filter(i => i >= 0), [0, 2, 3, 5, 6, 8, 9, 11], '반 박 → 한 박 세 칸의 가까운 칸');
  const cb = B.convertBeat(B.emptyBeat(), '32'); eq([cb.grid, cb.pats[2].d.kick.length], ['32', 32]); eq(B.convertBeat(cb, '없음'), cb);
});

await test('베이스 · 화음 사건 — 다음 음 · 쉼까지 이어짐 · 쉼 = 끊기 · 치는 법 셋 · 빈 화음 칸 = 앞 화음이 이어짐(베이스와 같은 규칙)', () => {
  const g = B.gridOf('16'), p = B.emptyPattern(g);
  p.b[0] = 0; p.b[6] = 3; p.b[8] = B.B_REST; p.b[12] = 5;
  eq(B.bassAt(p, 0, 16), { n: 0, end: 6 }); eq(B.bassAt(p, 6, 16), { n: 3, end: 8 }); eq(B.bassAt(p, 8, 16), { rest: true }); eq(B.bassAt(p, 12, 16), { n: 5, end: 16 }); eq(B.bassAt(p, 3, 16), null);
  p.c = ['I', null, 'V', 'vi'];
  const hitsOf = cs => { p.cs = cs; return Array.from({ length: 16 }, (_, i) => B.chordAt(p, g, i)).map((h, i) => (h ? `${i}${h.ch}:${h.d}` : '')).filter(Boolean).join(' '); };
  eq(hitsOf('long'), '0I:8 8V:4 12vi:4'); eq(hitsOf('oom'), '2I:2 6I:2 10V:2 14vi:2'); eq(hitsOf('short'), '0I:1 2I:1 4I:1 6I:1 8V:1 10V:1 12vi:1 14vi:1');
  ok(!B.chordGap(p, g, 4) && !B.chordGap(p, g, 0) && !B.chordGap(p, g, 5), '앞 화음이 있으면 끊지 않음');
  p.c = [null, 'I', null, null]; p.cs = 'long';
  eq(hitsOf('long'), '4I:12', '도 하나 + 길게 = 패턴 끝까지'); ok(B.chordGap(p, g, 0) && !B.chordGap(p, g, 4) && !B.chordGap(p, g, 8), '맡은 화음이 없는 칸만 끊음');
  eq([B.chordOwner(p, 0), B.chordOwner(p, 1), B.chordOwner(p, 3)], [-1, 1, 1]);
  const g9 = B.gridOf('9'), q = B.emptyPattern(g9); q.c = ['I', 'IV', 'V']; q.cs = 'oom';
  eq(Array.from({ length: 9 }, (_, i) => (B.chordAt(q, g9, i) ? i : -1)).filter(i => i >= 0), [1, 2, 4, 5, 7, 8], '세 박: 쿵짝짝');
  for (const k of B.CHORD_KEYS) { const n = B.CHORDS[k].notes; ok(n.length === 3 && n.every(x => x >= 57 && x <= 72), k); }
  eq(B.BASS.map(x => x.p % 12), [0, 2, 4, 7, 9, 0], '베이스 = 도 레 미 솔 라 도(다섯 음 음계)');
});

await test('왜 그럴까? — 빈 패턴 = 시작 안내 · 쿵 1·3 짝 2·4 = 들썩 · 엇박 · 스윙 · 우리 장단 · 순서 셋 넘으면 반복과 변화', () => {
  const b = B.emptyBeat();
  eq(B.tipsFor(b)[0], 'start');
  b.pats[0] = B.starterPattern(B.STARTERS[0]);
  const t1 = B.tipsFor(b); ok(t1[0] === 'backbeat' && t1.includes('hats') && t1.includes('bass') && t1.includes('chord') && !t1.includes('offbeat'), t1.join());
  b.pats[0].d.kick[7] = 1; b.swing = 30; ok(B.tipsFor(b).includes('offbeat') && B.tipsFor(b).includes('swing'));
  b.arr = [0, 0, 0, 1]; ok(B.tipsFor(b).includes('repeat'));
  const k = B.applyStarter(B.emptyBeat(), 'semachi').beat; ok(B.tipsFor(k).includes('jangdan'));
  for (const key of Object.keys(B.TIPS)) ok(/[가-힣]/.test(B.TIPS[key]) && !B.TIPS[key].includes(NO_WORD), key);
});

//  ── 되풀이 박자기(가짜 시계) ──
function runSeq(beat, { secs = 20, tick = 0.025, jitter = 0, stallAt = -1, stall = 0, onTick = null, countIn = false, at = 0.1 } = {}) {
  let now = 0;
  const ev = [], late = [];
  const seq = new B.Sequencer({ now: () => now, emit: e => { ev.push({ ...e, at: now }); if (e.t < now - 1e-9) late.push(e); }, beat: () => beat });
  seq.start({ at, countIn });
  const rng = B.mulberry32(3);
  while (now < secs) {
    let dt = tick + (jitter ? (rng() * 2 - 1) * jitter : 0);
    if (stallAt >= 0 && now < stallAt && now + dt >= stallAt) dt += stall;
    now += Math.max(0.001, dt);
    onTick && onTick(now, seq);
    seq.tick();
  }
  return { ev, late, seq };
}
await test('박자기 — 칸마다 정확한 시각(80초 · 50마디 밀림 0) · 예약은 0.12초 앞 안 · 늦은 칸 0 · 타이머가 들쭉날쭉해도', () => {
  const b = B.emptyBeat(); b.bpm = 150; b.pats[0] = B.starterPattern(B.STARTERS[1]); b.pats[0].d.hatc.fill(1);
  for (const jitter of [0, 0.015]) {
    const { ev, late } = runSeq(b, { secs: 80, jitter });
    const steps = ev.filter(e => e.kind === 'step'), sd = 60 / 150 / 4;
    ok(steps.length >= 799 && steps.length <= 802, '칸 수 ' + steps.length);
    steps.forEach((e, k) => { ok(near(e.t, 0.1 + k * sd, 1e-9), `칸 ${k} 시각 ${e.t} ≠ ${0.1 + k * sd}`); ok(e.step === k % 16 && e.bar === Math.floor(k / 16), '칸 번호'); ok(e.t - e.at <= B.LOOKAHEAD + 1e-9 && e.t >= e.at - 1e-9, '예약 창'); });
    eq(late.length, 0, '늦은 사건');
    const hats = ev.filter(e => e.kind === 'drum' && e.row === 'hatc'); eq(hats.length, steps.length, '칙 = 칸마다 하나(빠짐 · 겹침 0)');
  }
});
await test('박자기 — 스윙: 둘째 칸만 늦게 · 빠르기를 바꾸면 다음 칸부터 · 패턴 바꾸기는 다음 마디 · 순서대로 · 필인 · 심벌', () => {
  const b = B.emptyBeat(); b.bpm = 120; b.swing = 50;
  b.pats[0] = B.starterPattern(B.STARTERS[0]); b.pats[1] = B.starterPattern(B.STARTERS[4]);
  let { ev } = runSeq(b, { secs: 3 });
  const st = ev.filter(e => e.kind === 'step'), sd = 60 / 120 / 4;
  ok(near(st[1].t - st[0].t, sd * 1.5) && near(st[2].t - st[1].t, sd * 0.5) && near(st[2].t - st[0].t, sd * 2), '스윙 50%');
  //  빠르기: 1초쯤에 120 → 60
  b.swing = 0;
  let changedAt = null;
  ({ ev } = runSeq(b, { secs: 4, onTick: (now) => { if (changedAt == null && now >= 1) { b.bpm = 60; changedAt = now; } } }));
  const s2 = ev.filter(e => e.kind === 'step'), k = s2.findIndex(e => e.at >= changedAt);
  ok(k > 0, '바뀐 뒤 칸');
  const d1 = s2[k - 1].t - s2[k - 2].t, d2 = s2[k + 1].t - s2[k].t;
  ok(near(d1, 60 / 120 / 4) && near(d2, 60 / 60 / 4), `빠르기 ${d1} → ${d2}`);
  for (let j = 1; j < s2.length; j++) ok(s2[j].t > s2[j - 1].t, '시각 차례');
  //  지금 패턴만 반복: 1.1초에 B 를 고르면 다음 마디(2초)부터 B
  b.bpm = 120; b.cur = 0; b.mode = 'loop';
  let picked = false;
  ({ ev } = runSeq(b, { secs: 5, onTick: now => { if (!picked && now >= 1.1) { b.cur = 1; picked = true; } } }));
  const bars = {}; for (const e of ev.filter(x => x.kind === 'step')) bars[e.bar] = bars[e.bar] ?? e.pat;
  eq([bars[0], bars[1], bars[2]], [0, 1, 1], '마디마다 패턴(마디 = 2초)');
  ok(ev.filter(x => x.kind === 'step' && x.bar === 0).every(x => x.pat === 0), '첫 마디는 끝까지 A');
  //  순서대로: A A B A
  b.mode = 'song'; b.arr = [0, 0, 1, 0]; b.cur = 0;
  ({ ev } = runSeq(b, { secs: 17 }));
  const order = []; for (const e of ev.filter(x => x.kind === 'step' && x.step === 0)) order.push(B.LETTERS[e.pat]);
  eq(order.slice(0, 8).join(''), 'AABAAABA', '순서 되풀이');
  //  필인: 4번째 마디마다 마지막 박에 통 · 짝 · 다음 마디 첫 칸에 심벌
  b.mode = 'loop'; b.fill = true; b.arr = [];
  ({ ev } = runSeq(b, { secs: 17 }));
  const fills = ev.filter(x => x.kind === 'step' && x.fill).map(x => x.bar); eq([...new Set(fills)], [3, 7], '필인 마디');
  const toms = ev.filter(x => x.kind === 'drum' && x.row === 'tom'); ok(toms.length && toms.every(x => x.bar % 4 === 3 && x.step >= 12), '통은 필인 박에만');
  const crash = ev.filter(x => x.kind === 'drum' && x.crash); eq(crash.map(x => [x.bar, x.step]), [[4, 0], [8, 0]], '필인 다음 첫 칸 심벌');
  b.kit = 'kor'; ({ ev } = runSeq(b, { secs: 9 })); eq(ev.filter(x => x.crash).length, 0, '우리 장단은 심벌 없음');
});
await test('박자기 — 셈 시작(한 마디 딸깍 · 하나가 세게) · 빈 비트면 딸깍 · 멈추면 사건 0 · 오래 멈췄다 깨도 몰아 울리지 않음', () => {
  const b = B.emptyBeat(); b.bpm = 100;
  let { ev } = runSeq(b, { secs: 3, countIn: true, at: 2.5 });
  const cnt = ev.filter(e => e.kind === 'click' && e.count);
  eq(cnt.map(e => Math.round(e.t * 1000) / 1000), [0.1, 0.7, 1.3, 1.9], '셈 딸깍 넷(한 박 0.6초)'); ok(cnt[0].accent && !cnt[1].accent);
  const auto = ev.filter(e => e.kind === 'click' && !e.count); ok(auto.length >= 1 && near(auto[0].t, 2.5), '빈 비트 = 박마다 딸깍');
  b.pats[0].d.kick[0] = 2;
  ({ ev } = runSeq(b, { secs: 3 })); eq(ev.filter(e => e.kind === 'click').length, 0, '소리가 있으면 딸깍 끔');
  b.click = true; ({ ev } = runSeq(b, { secs: 2.45 })); eq(ev.filter(e => e.kind === 'click').length, 4 + 1, '딸깍 켜면 박마다');
  //  멈춤
  let stopAt = -1;
  ({ ev } = runSeq(b, { secs: 4, onTick: (now, seq) => { if (now >= 1 && seq.playing) { seq.stop(); stopAt = now; } } }));
  ok(stopAt > 0 && ev.length > 0 && ev.every(e => e.at < stopAt), '멈춘 뒤 사건 0');
  //  3초 멈춤(탭이 잠듦) → 지난 칸은 건너뛰고(몰아 울리지 않음) 마디 자리는 그대로
  b.click = false;
  const r = runSeq(b, { secs: 6, stallAt: 2, stall: 3 });
  ok(r.late.length === 0, '늦은 사건 ' + r.late.length);
  const st = r.ev.filter(e => e.kind === 'step');
  for (let j = 1; j < st.length; j++) { const dt = st[j].t - st[j - 1].t; ok(near(dt, 0.15) || dt > 2.9, '건너뜀 ' + dt); }
  ok(st.every(e => near(((e.t - 0.1) / 0.15) % 16, e.step, 1e-6) || near(((e.t - 0.1) / 0.15) % 16 - 16, e.step, 1e-6)), '건너뛰어도 칸 번호 = 시각 자리');
});
await test('박자기 — 베이스 길이 = 다음 음까지 · 쉼 = 끊기 · 화음 길이 · 칸 수를 줄여도 안 멈춤 · 가운데서 고친 칸은 아직 예약 안 했으면 바로', () => {
  const b = B.emptyBeat(); b.bpm = 120;
  const p = b.pats[0]; p.b[0] = 0; p.b[6] = 3; p.b[8] = B.B_REST; p.c = ['I', 'I', 'V', 'V'];
  let { ev } = runSeq(b, { secs: 2.2 });
  const sd = 60 / 120 / 4;
  const bass = ev.filter(e => e.kind === 'bass'); ok(near(bass[0].d, 6 * sd) && near(bass[1].d, 2 * sd), '베이스 길이');
  eq(ev.filter(e => e.kind === 'bassoff').length, 1);
  const ch = ev.filter(e => e.kind === 'chord' && e.bar === 0); eq(ch.length, 4); ok(ch.every(c => near(c.d, 4 * sd)));
  //  칸 수 바꾸기(16 → 8)를 가운데서 — 계속 울림
  let changed = false;
  ({ ev } = runSeq(b, { secs: 6, onTick: now => { if (!changed && now > 1.3) { Object.assign(b, B.convertBeat(b, '8')); changed = true; } } }));
  const st = ev.filter(e => e.kind === 'step'); ok(st[st.length - 1].t > 5.5 && st.every(e => e.step < 16), '안 멈춤');
  //  고친 칸
  const c = B.emptyBeat(); c.bpm = 120;
  let put = false;
  ({ ev } = runSeq(c, { secs: 2.2, onTick: now => { if (!put && now >= 0.5) { c.pats[0].d.clap[12] = 1; put = true; } } }));
  ok(ev.some(e => e.kind === 'drum' && e.row === 'clap' && e.bar === 0 && e.step === 12), '같은 마디 안에서 바로 들림');
});

//  ── 저장소 ── 손님(이 기기) · 학급 RTDB(가짜 firebase) 가 같은 모양: listMyBeats · getBeat · saveBeat(살핀 모양만) · deleteBeat · 비트 모음
const mem = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true,
  value: { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) } });
const { createStore } = await import('../../../music/js/store.js');
const sample = () => { const b = B.applyStarter(B.emptyBeat(), 'basic').beat; b.title = '쿵짝 비트'; b.arr = [0, 0, 1, 0]; b.mode = 'song'; b.pats[1] = B.starterPattern(B.STARTERS[4]); return b; };
await test('저장소(손님 · 이 기기) — 저장 · 목록 · 다시 열기 = 같은 비트 · 이상한 값은 살핀 뒤 저장 · 모음 = 고운 이름만 · 지우기 · 다른 기록 그대로', async () => {
  mem.set('music.local', JSON.stringify({ songs: { s1: { id: 's1', title: '내 곡' } }, practice: {}, rhythm: {} }));   // beats 칸이 없던 예전 기록
  const st = createStore({});
  ok(st.me.guest === true);
  eq(await st.listMyBeats(), []);
  const b = sample();
  const saved = await st.saveBeat({ ...B.packBeat(b), bpm: 9999, junk: '버릴 칸', pats: { ...B.packBeat(b).pats, 9: { d: {} } } });
  ok(saved.id && saved.rev === 1 && saved.by === 'guest' && saved.bpm === 160 && !('junk' in saved), '살핀 모양 · 누가 · 몇 번째 ' + JSON.stringify(Object.keys(saved)));
  const got = B.normalizeBeat(await st.getBeat('guest', saved.id));
  eq(got.pats, b.pats, '패턴 그대로'); eq([got.title, got.arr, got.mode], ['쿵짝 비트', [0, 0, 1, 0], 'song']);
  eq((await st.listMyBeats()).map(x => x.id), [saved.id]);
  eq(await st.listBeatClass(), [], '올리지 않으면 모음에 없음');
  await st.saveBeat({ ...B.packBeat(got), id: saved.id, rev: saved.rev, pub: true });
  const row = (await st.listBeatClass())[0];
  ok(row && row.t === '쿵짝 비트' && row.sid === 'guest' && row.bpm === got.bpm && row.na === 4, '모음 한 줄 ' + JSON.stringify(row));
  await st.saveBeat({ ...B.packBeat(got), id: saved.id, rev: 2, title: '시발 비트', pub: true });
  eq(await st.listBeatClass(), [], '고운 말이 아닌 이름은 모음에 안 뜸');
  await st.deleteBeat(saved.id);
  eq(await st.listMyBeats(), []);
  ok(JSON.parse(mem.get('music.local')).songs.s1.title === '내 곡', '내 곡은 그대로');
});
await test('저장소(학급 RTDB) — beats/<sid>/<id> + beatclass/<sid>_<id> 에만 · 다시 저장해도 선생님 숨김 남음 · 내리면 줄 지움 · 숨긴 줄은 목록에서 빠짐', async () => {
  const tree = {};
  const seg = p => p.split('/').filter(Boolean);
  const get = p => seg(p).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), tree) ?? null;
  const put = (p, v) => { const ks = seg(p); let o = tree; ks.slice(0, -1).forEach(k => { o = o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}; }); if (v == null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v)); };
  const writes = [];
  const ref = p => ({ child: c => ref(p + '/' + c), once: async () => ({ val: () => get(p) }), set: async v => { writes.push(p); put(p, v); }, remove: async () => { writes.push(p); put(p, null); },
    update: async up => { for (const [k, v] of Object.entries(up)) { writes.push(p + '/' + k); put(p + '/' + k, v); } }, push: () => ref(p + '/x'), on(ev, fn) { fn({ val: () => get(p) }); }, off() {} });
  const fb = { apps: [1], database: () => ({ ref }) };
  const st = createStore({ sid: 's1', name: '하늘', fb });
  const b = sample(); b.pub = true;
  const s1 = await st.saveBeat(B.packBeat(b));
  const k = 'classRPG_music/beatclass/s1_' + s1.id;
  ok(get(`classRPG_music/beats/s1/${s1.id}`).pats[0].d.kick === '2000000020000000' && get(k).t === '쿵짝 비트' && get(k).n === '하늘', '두 곳에 씀');
  ok(writes.every(w => w.startsWith('classRPG_music/beats/s1/') || w.startsWith(k)), '다른 곳은 안 씀 ' + writes.join());
  await st.setBeatHidden('s1', s1.id, true);
  eq(await st.listBeatClass(), [], '숨긴 줄은 목록에서 빠짐');
  let seen = null; const stop = st.watchBeatClass(list => { seen = list; }); stop(); eq(seen, [], '지켜보기도 같음');
  await st.saveBeat({ ...B.packBeat(b), id: s1.id, rev: s1.rev, title: '새 이름' });
  ok(get(k).hide === true && get(k).t === '새 이름' && get(`classRPG_music/beats/s1/${s1.id}`).rev === 2, '다시 저장 = 숨김 남음 · 이름만 바뀜');
  await st.setBeatHidden('s1', s1.id, false);
  eq((await st.listBeatClass()).map(r => r.t), ['새 이름']);
  await st.saveBeat({ ...B.packBeat(b), id: s1.id, rev: 2, pub: false });
  ok(get(k) === null, '내리면(올리기 끔) 모음 줄 지움');
  ok(Object.keys(await st.allBeats()).join() === 's1' && (await st.allBeatClass()).length === 0, '선생님 읽기');
  await st.deleteBeat(s1.id);
  ok(get(`classRPG_music/beats/s1/${s1.id}`) === null, '지우기');
});
await test('화면 연결(글로 확인) — 첫 화면 넷째 문 · #/beat 길(처음 열 때만 불러옴) · import map 버스터 · 교사 화면 · 장르 이름 · 쓰지 않기로 한 낱말 없음 · 공용 소리 파일은 안 고침', () => {
  const app = read('music/js/app.js'), html = read('music/index.html'), beat = read('music/js/beat.js'), core = read('music/js/beatcore.js'), kitjs = read('music/js/beatkit.js'), teacher = read('music/js/teacher.js'), store = read('music/js/store.js');
  ok(app.includes("h('button', { class: 'door d-beat', onclick: () => ctx.go('#/beat') }") && app.includes("await import('./beat.js')") && app.includes('replaceBeatRef'), 'app 문 · 길');
  const v = m => (html.match(new RegExp(`"\\./js/${m}\\.js": "\\./js/${m}\\.js\\?v=([^"]+)"`)) || [])[1];
  for (const m of ['beat', 'beatcore', 'beatkit', 'app', 'store', 'teacher']) ok(Number(String(v(m) || '').slice(0, 8)) >= 20261010, m + ' 버스터 ' + v(m));
  ok(html.includes(`<script type="module" src="js/app.js?v=${v('app')}">`) && Number(((html.match(/css\/music\.css\?v=(\d{8})/) || [])[1]) || 0) >= 20261010, 'script · css');
  ok(teacher.includes('비트 모음에서 내리기') && teacher.includes('setBeatHidden') && store.includes("beatclass/") && store.includes("'beats/' + sid"), '교사 · 저장소');
  const GENRE = /붐뱁|트랩|힙합|하우스|테크노|디스코|레게|재즈|펑크|로파이|\bEDM\b|\blo-?fi\b/;   // 글(아이에게 보이는 말 · 주석) — 영어 이름은 낱말로만(warnedMute 같은 이름 안 걸리게)
  for (const [n, src] of [['beat', beat], ['beatcore', core], ['beatkit', kitjs]]) { ok(!GENRE.test(src), n + ' 장르 이름'); ok(!src.includes(NO_WORD), n + ' 쓰지 않기로 한 낱말'); }
  ok(!/from '\.\/(song|compose)\.js'/.test(beat + core + kitjs), '비트는 song · compose 를 안 부름');
});

const fail = results.filter(r => r[0] === 'FAIL');
for (const r of results) console.log(r[0], r[1], r[2] || '');
console.log(`\n음악실 비트: PASS ${results.length - fail.length} · FAIL ${fail.length}`);
process.exit(fail.length ? 1 : 0);
