// 음악실 악보 시험 [MUSIC-SCORE-1] — 악보로 자동 변환(작곡 '악보 같이 보기' · 오케스트라 총보 · 비트 악보)
//  node scripts/unit/music/score.test.mjs   (가짜 DOM 만 · 소리 없음 · 네트워크 없음)
//  · 예전 renderStaff(가락 악보) 그림이 한 글자도 안 바뀌었는지 — 기본 곡 15곡 × 너비 셋 × (화음 있음/없음)을 staff-golden.json 의 지문과 견준다
//    (지문 다시 만들기: UPDATE_GOLDEN=1 node scripts/unit/music/score.test.mjs — 예전 그림을 일부러 바꿀 때만)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { installFakeDom, serialize } from './fake-svg-dom.mjs';
installFakeDom();
const { renderStaff, renderScore, layoutVoice, staffPos, clefPos, ledgerCount, legendStaff } = await import('../../../music/js/notation.js');
const { librarySongs, libraryOnce, chordify, normalize, emptySong, buildEvents } = await import('../../../music/js/song.js');
const { scaleRows, barSteps, stepSec, chordName, fitChords } = await import('../../../music/js/theory.js');
const SC = await import('../../../music/js/score.js');
const O = await import('../../../music/js/orchestra.js');
const C = await import('../../../music/js/beatcore.js');
const { EX_SONGS, EX_BEATS, exampleSong } = await import('../../../music/js/showcase.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = path.join(HERE, 'staff-golden.json');
const results = [];
const test = async (name, fn) => { try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const ok = (c, m) => { if (!c) throw new Error(m || '아님'); };
const sha = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
const eq = (a, b, m) => { const sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error(`${m ? m + ': ' : ''}기대 ${sb.slice(0, 300)} · 실제 ${sa.slice(0, 300)}`); };
const read = f => fs.readFileSync(path.join(HERE, '..', '..', '..', f), 'utf8');

// ── 예전 가락 악보 지문 ──  화음 = 가락 음마다 음계 두 칸 아래(작곡 '아래 3도 넣기'와 같은 규칙)
function withThirds(song) {
  const rows = scaleRows(song.scale, song.notes), harm = [];
  for (const m of song.notes) { const i = rows.indexOf(m.p), q = rows[i - 2]; if (i >= 2 && q != null) harm.push({ s: m.s, d: m.d, p: q }); }
  return { ...song, harm: chordify(harm) };
}
function goldenCases() {
  const out = {};
  for (const s of librarySongs()) for (const w of [1000, 640, 380]) {
    out[`${s.lk}@${w}`] = sha(serialize(renderStaff(s, { width: w }).el));
    if (w === 1000) out[`${s.lk}@${w}+harm`] = sha(serialize(renderStaff(withThirds(s), { width: w }).el));
  }
  return out;
}
await test('예전 가락 악보(renderStaff) 그림 그대로 — 기본 곡 15곡 × 너비 셋 + 화음', () => {
  const now = goldenCases();
  if (process.env.UPDATE_GOLDEN) { fs.writeFileSync(GOLDEN, JSON.stringify(now, null, 1) + '\n'); console.log('지문을 새로 썼어요: ' + Object.keys(now).length); }
  const old = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  const diff = Object.keys(old).filter(k => old[k] !== now[k]);
  ok(Object.keys(old).length >= 60 && !diff.length, '바뀐 그림 ' + diff.length + ': ' + diff.slice(0, 6).join(', '));
});


// ── 자리 셈 ──
await test('낮은음자리표 자리 — 솔2 = 아래 첫 줄 · 라3 = 맨 윗줄 · 가운데 도 = 위 덧줄 · 미2 = 아래 덧줄', () => {
  eq([43, 57, 60, 40, 36, 48].map(p => clefPos(p, 'bass')), [0, 8, 10, -2, -4, 3]);
  eq([64, 77, 60, 81, 79].map(p => clefPos(p, 'treble')), [0, 8, -2, 10, 9]);
  ok(clefPos(65) === staffPos(65), '높은음자리표 = 예전 staffPos 그대로');
  eq([-1, -2, -3, -4, 4, 8, 9, 10, 11, 12].map(ledgerCount), [0, 1, 1, 2, 0, 0, 0, 1, 1, 2]);
});
await test('음자리표 고르기 — 덧줄이 덜 생기는 쪽', () => {
  ok(SC.chooseClef([36, 38, 40, 43, 45, 48]) === 'bass', '베이스 음');
  ok(SC.chooseClef([60, 62, 64, 67, 69, 72, 76]) === 'treble', '가락 음');
  ok(SC.chooseClef([28, 31, 35]) === 'bass' && SC.chooseClef([]) === 'treble' && SC.chooseClef([79, 84]) === 'treble', '끝 쪽');
});
await test('한 기둥(같은 때 = 화음) · 겹치면 둘째 음성 · 셋째는 앞 음을 끊음', () => {
  const st = SC.stacksOf([{ s: 0, d: 4, p: 64 }, { s: 0, d: 2, p: 60 }, { s: 0, d: 4, p: 64 }, { s: 4, d: 4, p: 67 }]);
  eq(st, [{ s: 0, d: 2, ps: [60, 64] }, { s: 4, d: 4, ps: [67] }], '가장 짧은 길이 · 같은 음 한 번');
  const dr = SC.stacksOf([{ s: 0, d: 1, p: 5, h: 'n' }, { s: 0, d: 1, p: 5, h: 'x' }, { s: 0, d: 1, p: 9, h: 'x' }]);
  eq(dr[0].ps, [5, 5, 9], '북: 같은 자리라도 머리가 다르면 둘(짝 ● + 박수 ×)'); eq(dr[0].hs, ['n', 'x', 'x']);
  const v = SC.splitVoices([{ s: 0, d: 8, ps: [48] }, { s: 2, d: 2, ps: [60] }, { s: 4, d: 4, ps: [62] }]);
  ok(v.length === 2 && v[0].length === 1 && v[1].length === 2, '긴 음 아래 두 음 = 둘째 음성 ' + JSON.stringify(v));
  const v3 = SC.splitVoices([{ s: 0, d: 8, ps: [48] }, { s: 0, d: 8, ps: [50] }, { s: 2, d: 2, ps: [60] }, { s: 4, d: 4, ps: [62] }].map((x, k) => ({ ...x, s: x.s + (k === 1 ? 1 : 0) })));
  ok(v3.length === 2 && v3.flat().every(x => x.d >= 1), '셋째 겹침 = 앞 음 끊음 ' + JSON.stringify(v3));
});

// ── 마디 안 음표 길이 합 = 한 마디(쉼표 포함 · 그려지는 음성마다) ──
function checkBars(sc, name) {
  const bs = sc.beats * sc.sub, song = { beats: sc.beats, sub: sc.sub, bars: sc.bars, notes: [] };
  for (const st of sc.staves) st.voices.forEach((v, j) => {
    const lay = layoutVoice(song, v.events);
    lay.forEach((items, b) => {
      if (j > 0 && !items.some(it => !it.rest)) return;   // 둘째 음성 빈 마디 = 안 그림
      const sum = items.reduce((a, it) => a + it.v, 0);
      ok(sum === bs, `${name} · ${st.id} 음성${j} ${b + 1}마디 길이 ${sum} ≠ ${bs}`);
      for (const it of items) ok([1, 2, 3, 4, 6, 8, 12, 16].includes(it.v) && ['w', 'h', 'q', 'e', 's'].includes(it.base), `${name} 음표 모양 ${JSON.stringify(it)}`);
    });
    for (const e of v.events) { ok(Number.isInteger(e.s) && Number.isInteger(e.d) && e.d >= 1 && e.s >= 0 && e.s + e.d <= sc.bars * bs, `${name} · ${st.id} 칸 ${JSON.stringify(e)}`); ok(e.ps.every(Number.isFinite), name + ' 음 높이'); }
  });
}
//  그린 악보에서 오선마다 음표 머리 수
const headsIn = (el, staff) => el.querySelectorAll(`g[data-staff="${staff}"]`).reduce((a, g) => a + g.querySelectorAll('ellipse.st-head').length + g.querySelectorAll('path.st-xhead').length + g.querySelectorAll('path.st-trihead').length, 0);

// ── 비트 악보 ──
const cardBeat = (id, over = {}) => { const r = C.applyStarter(C.emptyBeat(), id); return { ...r.beat, ...over }; };
const countHits = st => Object.values(st.d).reduce((a, x) => a + x.replace(/\s/g, '').replace(/\./g, '').length, 0);
for (const st of C.STARTERS) {
  await test(`비트 악보 — 시작 카드 '${st.name}'(${st.grid}칸)`, () => {
    const b = cardBeat(st.id), G = C.gridOf(b.grid), sc = SC.beatScore(b);
    checkBars(sc, st.id);
    eq(sc.ts, G.sub === 3 ? [G.beats * 3, 8] : [4, 4], '박자표');
    ok(sc.hits === countHits(st), `북 친 칸 ${sc.hits} = 카드 칸 ${countHits(st)}`);
    const drums = sc.staves.find(x => x.id === 'drums'), mel = sc.staves.find(x => x.id === 'mel'), bass = sc.staves.find(x => x.id === 'bass');
    ok(drums.clef === 'perc' && drums.voices[0].stem === 'up' && drums.voices[1].stem === 'down', '북 오선 · 손 위 · 발 아래');
    for (const v of drums.voices) for (const e of v.events) ok(Math.floor(e.s / G.sub) === Math.floor((e.s + e.d - 1) / G.sub), '북 음표가 박을 넘지 않음 ' + JSON.stringify(e));
    const strong = Object.values(st.d).reduce((a, x) => a + (x.match(/X/g) || []).length, 0);
    ok(strong === 0 || drums.voices.flatMap(v => v.events).some(e => e.ex && e.ex.accent), '세게(X) = >');
    ok(drums.voices[1].events.every(e => e.ps.every(p => p === 1)), '쿵 = 아래 첫째 칸(자리 1)');
    eq(mel ? mel.voices[0].events.length : 0, C.melCount(b.pats[b.cur]), '가락 음 수');
    eq(bass ? bass.voices[0].events.length : 0, b.pats[b.cur].b.filter(v => v >= 0 && v <= 5).length, '베이스 음 수');
    ok(!mel || (mel.clef === 'treble' && mel.oct === (b.lead === 'glock' ? 2 : 1) && mel.words === 'lab'), '가락 = 높은음자리표 · 작은 8');
    ok(!bass || (bass.clef === 'bass' && bass.oct === (b.kit === 'kor' ? 1 : 0)), '베이스 = 낮은음자리표');
    eq(sc.repeat, { from: 0, to: G.bars - 1 }, '지금 패턴만 = 도돌이표');
    eq(sc.marks.map(m => m.text), ['A'], '패턴 글자');
    //  화음 이름 = 화음 칸이 바뀌는 자리(빈 칸 = 이어짐)
    const want = []; let cur = null; st.c.forEach((c, k) => { if (c && c !== cur) { want.push([k * C.slotLen(G), SC.CHORD_LETTER[c], C.CHORDS[c].full]); cur = c; } });
    eq(sc.chords.map(c => [c.s, c.name, c.ko]), want, '화음 이름');
    //  그려 보기 — 북 머리 수 = 친 칸 수 · 가락 · 베이스 머리 ≥ 음 수 · 도돌이 점 · 세게 표
    const r = renderScore(sc, { width: 1000 });
    ok(headsIn(r.el, 'drums') === sc.hits, `그린 북 머리 ${headsIn(r.el, 'drums')} = ${sc.hits}`);
    if (mel) ok(headsIn(r.el, 'mel') >= mel.voices[0].events.length, '가락 머리');
    if (bass) ok(headsIn(r.el, 'bass') >= bass.voices[0].events.length, '베이스 머리');
    ok(r.el.querySelectorAll('circle.st-dot').length >= 4 * sc.staves.length, '도돌이표 점');
    ok(r.el.querySelectorAll('text.st-chord').length === want.length && r.el.querySelectorAll('text.st-chordko').length >= 1, '화음 이름 그림');
    ok(strong === 0 || r.el.querySelectorAll('path.st-accent').length > 0, '> 그림');
  });
}
await test('비트 악보 — 이어 붙인 순서대로(A B A C) · 32칸(두 마디) · 열린 칙 o · 짝+박수 같은 칸', () => {
  const b = cardBeat('basic');
  b.pats[1] = C.starterPattern(C.STARTERS.find(s => s.id === 'run'));
  b.pats[2] = C.starterPattern(C.STARTERS.find(s => s.id === 'dance'));
  b.arr = [0, 1, 0, 2]; b.mode = 'song';
  const sc = SC.beatScore(b);
  checkBars(sc, 'song');
  ok(sc.bars === 4 && sc.repeat === null && sc.song, '네 마디 · 도돌이 없음');
  eq(sc.marks.map(m => [m.bar, m.text]), [[0, 'A'], [1, 'B'], [2, 'A'], [3, 'C']], '마디 위 패턴 글자');
  const hits = [0, 1, 0, 2].reduce((a, i) => a + C.ROWS.reduce((x, r) => x + b.pats[i].d[r].filter(Boolean).length, 0), 0);
  ok(sc.hits === hits, `북 ${sc.hits} = ${hits}`);
  const r = renderScore(sc, { width: 1000 });
  ok(headsIn(r.el, 'drums') === hits, '그린 북 머리 = 친 칸');
  ok(r.el.querySelectorAll('g.st-mark.box').length === 4, '패턴 글자 상자 넷');
  ok(r.el.querySelectorAll('circle.st-open').length > 0, '열린 칙(춤추는 카드 치이) = o');
  //  32칸 — 두 마디 · 마디를 넘는 가락 = 붙임줄
  const b2 = C.convertBeat(cardBeat('basic'), '32');
  b2.pats[b2.cur].m = new Array(32).fill(C.B_EMPTY); b2.pats[b2.cur].m[12] = 2;   // 미 = 13칸부터 끝까지
  const sc2 = SC.beatScore(b2);
  checkBars(sc2, '32칸');
  ok(sc2.bars === 2 && sc2.repeat.to === 1, '두 마디 도돌이');
  const mel = sc2.staves.find(x => x.id === 'mel');
  eq(mel.voices[0].events.map(e => [e.s, e.d]), [[12, 20]], '가락 한 음 20칸');
  const r2 = renderScore(sc2, { width: 1000 });
  ok(r2.el.querySelectorAll('path.st-tie').length >= 1, '마디를 넘는 붙임줄');
  //  짝 + 박수 같은 칸
  const b3 = cardBeat('basic'); b3.pats[b3.cur].d.clap[4] = 1;
  const sc3 = SC.beatScore(b3), st4 = sc3.staves.find(x => x.id === 'drums').voices[0].events.find(e => e.s === 4);
  eq(st4.ps, [5, 5, 9], '짝 · 박수 · 칙'); eq(st4.hs, ['n', 'x', 'x']);
});
await test('비트 악보 — 우리 장단 이름 · 12칸 · 9칸 · 예시 비트(순서 여덟)', () => {
  const b = cardBeat('gutgeori'), L = SC.beatLegend(b);
  ok(L.drums.some(d => d.name === '북' && d.feet) && L.drums.some(d => d.name === '장구 덩' && d.head === 'x') && L.drums.some(d => d.name === '더러러러' && d.pos === 10), '안내 = 우리 장단 줄 이름 ' + JSON.stringify(L.drums.map(d => d.name)));
  ok(SC.beatScore(b).staves.find(s => s.id === 'drums').name === '장단', '오선 이름 장단');
  eq(SC.beatScore(cardBeat('semachi')).ts, [9, 8]); eq(SC.beatScore(b).ts, [12, 8]);
  ok(EX_BEATS.length >= 3, '예시 비트');
  for (const ex of EX_BEATS) {
    const nb = C.exampleBeat(ex), sc = SC.beatScore(nb);
    ok(sc.song && sc.order.length === ex.arr.length, '예시 = 이어 붙인 순서대로');
    checkBars(sc, '예시 ' + (ex.title || ex.key));
    ok(sc.hits === SC.beatOrder(nb).reduce((a, i) => a + C.ROWS.reduce((x, r) => x + nb.pats[i].d[r].filter(Boolean).length, 0), 0), '예시 북 칸 수');
  }
});
await test('가락 악기 옥타브 = beatkit.js 소리(LEAD_SND oct) 와 같음', () => {
  const src = read('music/js/beatkit.js'), m = [...src.matchAll(/(\w+): \{ (?:inst: '\w+', )?oct: (\d+)/g)];
  ok(m.length >= 7, '표 읽음 ' + m.length);
  for (const [, k, oct] of m) ok((SC.LEAD_OCT[k] || 1) === Number(oct) / 12, `${k} oct ${oct}`);
});

// ── 오케스트라 총보 ──
const orchSong = (lib, preset, over = {}) => { const s = normalize({ ...libraryOnce(lib), id: null, lib: false, scale: 'major' }); O.applyPreset(s, preset); return Object.assign(s, over); };
for (const k of O.PRESET_KEYS) {
  await test(`오케스트라 총보 — ${O.PRESETS[k].name}: 편곡 사건이 빠짐없이 · 악기 차례 · 음자리표`, () => {
    for (const lib of ['star', 'birthday', 'joy']) {
      const song = orchSong(lib, k), sc = SC.orchScore(song);
      checkBars(sc, `${k}/${lib}`);
      const ids = sc.staves.map(s => s.id);
      eq(ids, SC.ORCH_ORDER.filter(x => ids.includes(x)), '악기 차례');
      ok(ids.includes('lead'), '가락 오선');
      const by = Object.fromEntries(sc.staves.map(s => [s.id, s]));
      for (const id of ['tuba', 'timp', 'cello', 'cb', 'harpL']) if (by[id]) ok(by[id].clef === 'bass', id + ' 낮은음자리표');
      if (by.cb) ok(by.cb.oct === -1, '콘트라베이스 = 아래 8');
      if (by.sparkle) ok(by.sparkle.oct === (by.sparkle.name === '글로켄슈필' ? 2 : 1), '반짝이 옥타브');
      if (by.drums) ok(by.drums.clef === 'perc1', '타악기 한 줄');
      //  편곡이 내는 음(시작 칸 · 높이)이 악보에 모두 있음 — 하프 글리산도(첫 · 끝 음만)는 빼고
      const shift = O.leadShift(song), evs = O.arrange(song, { sd: stepSec(song), shift, melody: true });
      const segs = O.chordLine(song), fin = segs[segs.length - 1], gliss = O.PRESETS[k].gliss && song.bars > 1;
      const octOf = id => (by[id] ? by[id].oct || 0 : 0);
      const staffOf = e => e.kind === 'drum' ? 'drums' : e.track === 'sparkle' ? 'sparkle' : e.track === 'winds' ? 'winds' : e.track === 'brass' ? (e.inst === 'tuba' ? 'tuba' : 'horn') : e.track === 'perc' ? 'timp' : e.track === 'harp' ? (e.p >= 60 ? 'harpR' : 'harpL') : e.track === 'strings' ? 'strings' : e.inst === 'contrabass' ? 'cb' : 'cello';
      const have = new Set(sc.staves.flatMap(st => st.voices.flatMap(v => v.events.flatMap(e => e.ps.map(p => st.id + '|' + e.s + '|' + p)))));
      let n = 0;
      for (const e of evs) {
        if (e.kind === 'drum') continue;
        if (gliss && e.track === 'harp' && e.s >= fin.s) continue;
        const id = staffOf(e);
        if (e.track === 'bass' && e.inst === 'pizz') { ok(have.has('cello|' + Math.round(e.s) + '|' + e.p) || have.has('cb|' + Math.round(e.s) + '|' + (e.p + 12)), '피치카토 ' + JSON.stringify(e)); n++; continue; }
        ok(have.has(id + '|' + Math.round(e.s) + '|' + (e.p - 12 * octOf(id))), `${k}/${lib} 빠진 음 ${id} ${JSON.stringify(e)}`); n++;
      }
      ok(n > 10, '음 수 ' + n);
      //  길이 — 길게 내는 음(짧게 끊기 · 하프 · 팀파니 빼고)은 편곡 길이 그대로(같은 때 더 짧은 음과 한 기둥이거나 다음 기둥에서 끊긴 것만 짧음)
      let same = 0, all = 0;
      for (const e of evs) {
        if (e.kind === 'drum' || e.art === 'stacc' || e.track === 'harp' || e.track === 'perc' || e.inst === 'pizz') continue;
        const id = staffOf(e), st = by[id], s0 = Math.round(e.s), p0 = e.p - 12 * octOf(id);
        const hit = st.voices.flatMap(v => v.events.map(x => ({ x, v }))).find(({ x }) => x.s === s0 && x.ps.includes(p0));
        ok(hit && hit.x.d <= Math.round(e.d), `${id} 길이 ${JSON.stringify(e)} → ${hit && hit.x.d}`);
        const cut = hit && hit.v.events.some(y => y.s === hit.x.s + hit.x.d);
        all++; if (hit.x.d === Math.round(e.d) || cut || evs.some(y => y !== e && y.kind !== 'drum' && staffOf(y) === id && Math.round(y.s) === s0 && y.d < e.d)) same++;
      }
      ok(same === all, `길이 그대로 ${same}/${all}`);
      //  가락 = 아이 가락 + 가락 악기 높이
      eq(by.lead.voices[0].events.map(e => [e.s, e.d, e.ps[0]]), song.notes.map(x => [x.s, x.d, x.p + shift]), '가락 오선 = 지은 가락');
      //  타악기 친 수 = 북 사건 수(같은 때 같은 북 하나)
      const dr = evs.filter(e => e.kind === 'drum'), dk = new Set(dr.map(e => Math.round(e.s) + '|' + (e.drum === 'swell' ? 'cymbal' : e.drum)));
      if (by.drums) ok(by.drums.voices[0].events.reduce((a, e) => a + e.ps.length, 0) === dk.size, `타악기 ${dk.size}`);
      //  짧게 끊는 음 = 점 · 굴리기 = 빗금
      if (evs.some(e => e.art === 'stacc')) ok(sc.staves.some(st => st.voices.some(v => v.events.some(e => e.ex && e.ex.stacc))), '스타카토 점');
      if (evs.some(e => e.art === 'roll')) ok(by.timp && by.timp.voices.some(v => v.events.some(e => e.ex && e.ex.roll)), '팀파니 굴리기');
      ok(!song.orch.rit || (sc.marks[0].text.startsWith('rit.') && sc.fermata), 'rit. · 늘임표');
      //  그려 보기 — 오선 수 · 이름 · 낮은음자리표 글자
      const r = renderScore(sc, { width: 1040 });
      ok(r.el.querySelectorAll('text.st-name').filter(t => !(t.getAttribute('class') || '').includes('sub')).length >= sc.staves.filter(s => s.name).length, '악기 이름');
      ok(!sc.staves.some(s => s.clef === 'bass') || r.el.querySelectorAll('text.st-clef.bass').length > 0, '낮은음자리표 그림');
      ok(!gliss || r.el.querySelectorAll('line.st-gliss').length === 1, '하프 글리산도 선');
    }
  });
}
await test('오케스트라 총보 — 화음 칸: 목관이 맡으면 목관 오선 · 아니면 가락 오선 둘째 음성(기둥 아래)', () => {
  const base = exampleSong('hero');
  const a = SC.orchScore(base), w = a.staves.find(s => s.id === 'winds');
  ok(base.harm.length > 0 && w, '목관 오선(화음 칸 = 목관)');
  const b = SC.orchScore({ ...base, orch: { ...base.orch, parts: { ...base.orch.parts, winds: false } } }), lead = b.staves.find(s => s.id === 'lead');
  ok(lead.voices.length === 2 && lead.voices[1].stem === 'down' && lead.voices[1].events.length === new Set(base.harm.map(h => h.s)).size, '가락 오선 둘째 음성');
  checkBars(b, 'hero 화음');
  for (const ex of EX_SONGS) { const sg = exampleSong(ex.key); checkBars(SC.orchScore(sg), '예시 곡 ' + ex.key); checkBars(SC.melodyScore(sg), '예시 띠 ' + ex.key); }
});

// ── 작곡 '악보 같이 보기' ──
await test('작곡 악보 띠 — 칸과 같은 가로 자리 · 음을 놓아도 높이 그대로 · 화음 칸 = 둘째 오선 · 화음 이름', () => {
  const song = normalize({ ...emptySong(), notes: [{ s: 0, d: 2, p: 60 }, { s: 2, d: 1, p: 64 }, { s: 4, d: 4, p: 67 }, { s: 9, d: 3, p: 72 }] });
  const A = { left: 58, stepW: 26 }, ranges = [[60, 76]];
  const sc = SC.melodyScore(song), r = renderScore(sc, { align: A, ranges });
  checkBars(sc, '띠');
  const cx = r.el.querySelectorAll('g.st-note').map(g => ({ i: g.getAttribute('data-i'), x: +g.querySelector('ellipse.st-head').getAttribute('cx') }));
  for (const n of song.notes) { const i = song.notes.indexOf(n), g = cx.find(c => c.i === String(i)); ok(g && Math.abs(g.x - (A.left + (n.s + 0.5) * A.stepW)) < 0.01, `음 ${i} 가로 자리 ${g && g.x}`); }
  ok(+r.el.getAttribute('width') === A.left + song.bars * 8 * A.stepW + 2, '띠 너비 = 칸 너비');
  const r2 = renderScore(SC.melodyScore({ ...song, notes: [{ s: 0, d: 1, p: 76 }] }), { align: A, ranges });
  ok(r2.height === r.height, `높이 그대로 ${r.height} · ${r2.height}`);
  eq(sc.chords.map(c => c.name), fitChords(song, song.chords).map(x => chordName(x, 0)), '화음 이름 = 화음 친구');
  ok(SC.melodyScore({ ...song, acc: { ...song.acc, chord: false } }).chords.length === 0, '화음 친구 쉼 = 이름 없음');
  ok(SC.melodyScore({ ...song, scale: 'pyeong' }).chords.length === 0, '국악 느낌 = 이름 없음(지속음)');
  const h = SC.melodyScore({ ...song, harm: [{ s: 0, d: 2, p: 55 }, { s: 0, d: 2, p: 57 }, { s: 4, d: 2, p: 60 }] });
  ok(h.staves.length === 2 && h.staves[1].voices[0].events.length === 2 && h.staves[1].voices[0].events[0].ps.length === 2, '화음 오선 · 한 기둥 두 음');
  const rh = renderScore(h, { align: A, ranges: [[55, 76], [55, 76]] });
  ok(rh.height > r.height && headsIn(rh.el, 'harm') === 3, '화음 오선 그림 ' + headsIn(rh.el, 'harm'));
  const o = orchSong('star', 'film'); ok(SC.melodyScore(o).chords.map(c => c.name).join(',') === O.chordLine(o).filter(g => g.name).map(g => g.name).join(','), '오케스트라 = 편곡 화음(G7 마침 포함)');
});
await test('안내 작은 오선 · 낮은음자리표 글자(Noto Music 받는 글자에 𝄢)', () => {
  const m = legendStaff({ pos: 9, head: 'xo', stem: 'up' });
  ok(m.querySelectorAll('path.st-xhead').length === 1 && m.querySelectorAll('circle.st-open').length === 1, '열린 칙 안내');
  ok(legendStaff({ clef: 'bass', oct: 1 }).querySelectorAll('text.st-oct').length === 1, '옥타브 표시');
  const html = read('music/index.html');
  ok(html.includes('family=Noto+Music&text=') && html.includes('%F0%9D%84%A2'), 'index.html 글자 목록에 낮은음자리표');
  const v = m2 => (html.match(new RegExp(`"\\./js/${m2}\\.js": "\\./js/${m2}\\.js\\?v=([^"]+)"`)) || [])[1];
  for (const m2 of ['score', 'scoreview', 'notation', 'compose', 'beat']) ok(Number(String(v(m2) || '').slice(0, 8)) >= 20261010, m2 + ' 버스터 ' + v(m2));
  ok(v('score') === v('scoreview') && v('notation') === v('score'), '새 모듈 같은 값');
});

const fail = results.filter(r => r[0] === 'FAIL');
for (const r of results) console.log(r[0], r[1], r[2] || '');
console.log(`\n음악실 악보: PASS ${results.length - fail.length} · FAIL ${fail.length}`);
process.exit(fail.length ? 1 : 0);
