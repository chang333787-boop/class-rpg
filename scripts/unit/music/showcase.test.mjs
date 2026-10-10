// 음악실 예시 작품 시험 [MUSIC-SHOWCASE-1] — '4학년 음악 친구'의 작곡 곡 셋 · 비트 셋이 앱 모양 그대로 읽히고, 음악적으로 맞게 지어졌는지
//  node scripts/unit/music/showcase.test.mjs   (DOM 없음 · 네트워크 없음) · 모두 새로 지은 곡(저작권 없음)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EX_SONGS, EX_BEATS, exampleSong, EX_BY } from '../../../music/js/showcase.js';
import { buildEvents, INSTS } from '../../../music/js/song.js';
import { chordPcs, pc, barSteps } from '../../../music/js/theory.js';
import { leadShift, orchOn, PRESETS, PART_KEYS } from '../../../music/js/orchestra.js';
import { recorderOK } from '../../../music/js/recorder.js';
import { badWords } from '../../../music/js/safety.js';
import * as C from '../../../music/js/beatcore.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const results = [];
const test = async (name, fn) => { try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const ok = (c, m) => { if (!c) throw new Error(m || '아님'); };
const eq = (a, b, m) => { const sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error(`${m ? m + ': ' : ''}기대 ${sb.slice(0, 200)} · 실제 ${sa.slice(0, 200)}`); };

await test('작곡 곡 셋 — 16마디 · 앱 모양(normalize) · 고른 화음 · 오케스트라 설정 그대로 · 소리 사건이 유한', () => {
  eq(EX_SONGS.map(x => x.key), ['hero', 'fairywaltz', 'sportsmarch']);
  for (const x of EX_SONGS) {
    const s = exampleSong(x.key);
    ok(s && s.id === 'ex_' + x.key && s.lib === true && s.lk === 'ex_' + x.key, x.key + ' id');
    eq([s.bars, s.beats, s.sub, s.tempo, s.inst, s.scale], [16, x.beats, x.sub, x.tempo, x.inst, 'major'], x.key + ' 모양');
    ok(INSTS[s.inst], x.key + ' 악기');
    eq(s.chords, x.chords, x.key + ' 화음');
    ok(orchOn(s) && s.orch.preset === x.orch.preset && s.orch.dyn === x.orch.dyn && s.orch.rit === x.orch.rit && PART_KEYS.every(k => s.orch.parts[k] === x.orch.parts[k]), x.key + ' 오케스트라');
    ok(PRESETS[x.orch.preset], x.key + ' 편성');
    eq(leadShift(s), 0, x.key + ' 가락 = 악기 음역 안(옮기지 않음)');
    const b = buildEvents(s, { orchFinale: true });
    ok(b.events.length > 150 && b.events.every(e => Number.isFinite(e.t) && (e.d == null || (Number.isFinite(e.d) && e.d > 0))), x.key + ' 사건');
    ok(b.total > 20 && b.total < 60, x.key + ' 길이 ' + b.total.toFixed(1) + '초');
    ok(!badWords(x.title).length && x.notes.length >= 4 && x.tryIt.length >= 2 && x.line && x.em, x.key + ' 글');
  }
});

await test('지은 솜씨 — 센박(마디 첫 박) 음은 그 마디 화음의 음 · 박 위 긴 음도 대부분 화음 음(70% 넘게) · 끝 음 = 도(으뜸음) · 끝 마디 화음 = 도', () => {
  for (const x of EX_SONGS) {
    const s = exampleSong(x.key), bs = barSteps(s);
    let strong = 0, inChord = 0;
    for (const n of s.notes) {
      const bar = Math.floor(n.s / bs), pcs = chordPcs(s.chords[bar], 0), down = n.s % bs === 0;
      if (down) ok(pcs.includes(pc(n.p)) || (s.chords[bar] === 'V' && pc(n.p) === 5), `${x.key} ${bar + 1}마디 첫 박 음이 화음 밖`);   // 솔 화음의 파 = 딸림7
      if (down || (n.s % s.sub === 0 && n.d >= s.sub)) { strong++; if (pcs.includes(pc(n.p))) inChord++; }
    }
    ok(inChord / strong >= 0.7, `${x.key} 박 위 긴 음 화음 음 ${inChord}/${strong}`);
    const last = [...s.notes].sort((a, z) => a.s - z.s).pop();
    eq([pc(last.p), s.chords[15]], [0, 'I'], x.key + ' 마침');
  }
});

await test('반복과 변화 — 주제가 되돌아옴(용사 1 = 5 = 13마디 · 왈츠 1~2 = 9~10마디 · 행진 1 = 5 = 13마디)', () => {
  const barNotes = (s, b) => { const bs = barSteps(s); return s.notes.filter(n => Math.floor(n.s / bs) === b).map(n => [n.s - b * bs, n.d, n.p]); };
  const hero = exampleSong('hero'), waltz = exampleSong('fairywaltz'), march = exampleSong('sportsmarch');
  eq(barNotes(hero, 4), barNotes(hero, 0), '용사 5마디'); eq(barNotes(hero, 12), barNotes(hero, 0), '용사 13마디');
  eq([barNotes(waltz, 8), barNotes(waltz, 9)], [barNotes(waltz, 0), barNotes(waltz, 1)], '왈츠 9~10마디');
  eq(barNotes(march, 4), barNotes(march, 0), '행진 5마디'); eq(barNotes(march, 12), barNotes(march, 0), '행진 13마디');
  //  행진 1 · 3마디 = 같은 리듬 다른 높이(시퀀스)
  eq(barNotes(march, 2).map(n => n[1]), barNotes(march, 0).map(n => n[1]), '행진 1 · 3마디 리듬');
});

await test('화음 칸 — 가락보다 아래 · 같은 때 세 음까지 · 목관 칸이 켜져 목관이 분다 · 행진곡은 화음 칸 없이 목관이 저절로 3도 아래', () => {
  for (const key of ['hero', 'fairywaltz']) {
    const s = exampleSong(key);
    ok(s.harm.length >= 7 && s.orch.parts.winds, key + ' 화음 칸 · 목관');
    for (const h of s.harm) {
      const over = s.notes.filter(n => n.s < h.s + h.d && n.s + n.d > h.s);
      ok(over.length && over.every(n => n.p > h.p), `${key} 화음 칸 ${h.s} 이 가락 아래`);
    }
    const byStart = new Map(); for (const h of s.harm) byStart.set(h.s, (byStart.get(h.s) || 0) + 1);
    ok([...byStart.values()].every(n => n <= 3), key + ' 세 음까지');
    const b = buildEvents(s, { orchFinale: true });
    ok(b.events.some(e => e.track === 'winds') && !b.events.some(e => e.track === 'harm'), key + ' 화음 칸 = 목관');
  }
  const m = exampleSong('sportsmarch');
  ok(!m.harm.length && buildEvents(m).events.some(e => e.track === 'winds'), '행진곡 목관');
});

await test('리코더로 같이 — 용사 · 행진곡은 바로크식 운지로 다 불 수 있음(첫 화면 🪈) · 왈츠는 높은 도(84)가 있어 안 됨', () => {
  eq(EX_SONGS.map(x => recorderOK(exampleSong(x.key), 'baroque')), [true, false, true]);
});

await test('비트 셋 — 패턴 넷 · 순서 여덟 · 이어 붙인 순서대로 · 저장 모양을 거쳐도 같음 · 가락 · 베이스 · 화음 칸 수', () => {
  eq(EX_BEATS.map(x => x.key), ['monsterparty', 'rainyday', 'janggu']);
  for (const x of EX_BEATS) {
    const b = C.exampleBeat(x), g = C.gridOf(x.grid), len = C.lenOf(g);
    eq(C.normalizeBeat(C.packBeat(b)), b, x.key + ' 저장 모양');
    ok(b.id === null && b.title === x.title && b.mode === 'song' && b.arr.length === 8 && b.fill === x.fill, x.key + ' 순서 · 모드');
    eq([b.grid, b.bpm, b.swing, b.kit, b.lead], [x.grid, x.bpm, x.swing, x.kit, x.lead], x.key + ' 설정');
    eq(C.usedCount(b), 4, x.key + ' 패턴 넷');
    for (const p of b.pats) {
      ok(p.m.length === len && p.b.length === len && p.c.length === C.slotsOf(g), x.key + ' 줄 길이');
      ok(p.m.some(v => v >= 0), x.key + ' 가락 있음');
    }
    ok(!badWords(x.title).length && x.notes.length >= 4 && x.tryIt.length >= 2, x.key + ' 글');
  }
});

await test('비트 솜씨 — 화음 칸 처음 박의 가락 음 = 그 화음의 음(가락이 있는 곳) · 쉬는 패턴(비 오는 날 C)은 북이 하나도 없음', () => {
  for (const x of EX_BEATS) {
    const b = C.exampleBeat(x), g = C.gridOf(x.grid), sl = C.slotLen(g);
    for (const [pi, p] of b.pats.entries()) for (let k = 0; k < p.c.length; k++) {
      const ch = p.c[k]; if (!ch) continue;
      const v = p.m[k * sl]; if (!(v >= 0)) continue;
      ok(C.CHORD_MEL[ch].includes(v), `${x.key} ${'ABCD'[pi]} 화음 칸 ${k + 1} 첫 가락 음`);
    }
  }
  const rain = C.exampleBeat(EX_BEATS[1]);
  ok(C.ROWS.every(r => rain.pats[2].d[r].every(v => !v)) && rain.arr.filter(i => i === 2).length === 2, '쉬는 패턴 둘');
});

await test('화면 연결(글로 확인) — 첫 화면 칸 · 작곡 예시 노트 · 비트 예시 열기 · 시작 카드 예시 칸 · import map', () => {
  const app = read('music/js/app.js'), comp = read('music/js/compose.js'), beat = read('music/js/beat.js'), html = read('music/index.html');
  ok(app.includes('showcaseShelf()') && app.includes("'#/compose/ex_'") && app.includes("'#/beat/ex.'") && app.includes("ref.startsWith('ex_')") && app.includes("'#/practice/ex_'"), 'app');
  ok(comp.includes("init.lk.startsWith('ex_')") && comp.includes('이렇게 만들었어요'), 'compose');
  ok(beat.includes("ref.startsWith('ex.')") && beat.includes('C.exampleBeat(ex)') && beat.includes('예시 비트 — 패턴 넷'), 'beat');
  ok(/"\.\/js\/showcase\.js": "\.\/js\/showcase\.js\?v=\d{8}\w+"/.test(html), 'import map');
  ok(EX_BY === '4학년 음악 친구', '만든 사람');
});

const fail = results.filter(r => r[0] === 'FAIL');
for (const r of results) console.log(r[0], r[1], r[2] || '');
console.log(`\n음악실 예시 작품: PASS ${results.length - fail.length} · FAIL ${fail.length}`);
process.exit(fail.length ? 1 : 0);
