// 악보로 자동 변환 — 만든 것(작곡 가락 · 오케스트라 편곡 · 비트)을 악보 모양으로 [MUSIC-SCORE-1]
//  화면 · 소리 없음(node 로 시험 — scripts/unit/music/score.test.mjs). 그리기는 notation.js renderScore · 화면 조각은 scoreview.js
//  선생님 10-10 '이거를 하고 악보로 자동으로 변환하는 것도 한번 해줘' — 아이가 칸에 놓은 것이 진짜 악보로 바뀌어, 칸 ↔ 음표를 이어 보게.
//  · 악보에 적는 것 = 실제로 울리는 것: 오케스트라는 편곡(arrange)이 내는 사건 그대로 · 비트는 박자기(beatcore)가 치는 칸 그대로
//  · 조옮김 악기 없이 실제 소리 높이로 적는다. 높이 차이가 큰 악기(글로켄 · 첼레스타 · 콘트라베이스 · 비트 가락)는
//    음자리표에 작은 8 · 15(한 · 두 옥타브 높게/낮게 소리남)를 달아 덧줄을 줄인다 — 총보에서 쓰는 보통 방법
//  · 음표 길이: 칸 수를 박 안에서 읽기 쉬운 음표로(notation.js splitValue) · 북은 다음 칠 때까지(박 끝을 넘지 않게) · 짧게 끊는 음 = 그 박 끝까지 + 점(스타카토)
import { SCALES, fitChords, chordName, chordByName, barSteps, stepSec, pc } from './theory.js';
import { arrange, leadShift, chordLine, normOrch, PRESETS, familyOf, orchOn } from './orchestra.js';
import { INSTS } from './song.js';
import * as C from './beatcore.js';
import { clefPos, ledgerCount } from './notation.js';

export const tsOf = s => [s.beats * (s.sub === 3 ? 3 : 1), s.sub === 3 ? 8 : 4];   // 박자표(위 · 아래) — 가락 악보와 같은 규칙

// ── 공통 ──
//  같은 때 시작한 음 = 한 기둥(길이는 가장 짧은 것) · 겹치면(앞 음이 끝나기 전에 다음이 시작) 둘째 음성으로 · 셋째부터는 앞 음을 그 자리에서 끊음
//  북(e.h 머리가 있음)은 같은 자리라도 머리가 다르면 따로(짝 ● + 박수 × = 셋째 칸에 둘)
export function stacksOf(list) {
  const by = new Map();
  for (const e of list) {
    if (!by.has(e.s)) by.set(e.s, { s: e.s, d: e.d, ps: [], hs: e.h ? [] : null, ex: null });
    const st = by.get(e.s);
    st.d = Math.min(st.d, e.d);
    if (st.ps.some((p, k) => p === e.p && (!st.hs || st.hs[k] === (e.h || 'n')))) continue;   // 같은 음(북은 같은 자리 · 같은 머리)은 한 번
    st.ps.push(e.p); if (st.hs) st.hs.push(e.h || 'n');
    if (e.ex) st.ex = { ...(st.ex || {}), ...e.ex };
  }
  return [...by.values()].sort((a, z) => a.s - z.s).map(st => {
    const ord = st.ps.map((p, k) => k).sort((a, z) => st.ps[a] - st.ps[z]);
    return { s: st.s, d: st.d, ps: ord.map(k => st.ps[k]), ...(st.hs ? { hs: ord.map(k => st.hs[k]) } : {}), ...(st.ex ? { ex: st.ex } : {}) };
  });
}
export function splitVoices(stacks, max = 2) {
  const voices = Array.from({ length: max }, () => []), ends = new Array(max).fill(-Infinity);
  for (const st of stacks) {
    let v = ends.findIndex(e => e <= st.s);
    if (v < 0) {                                                  // 음성이 모자람 → 첫 음성 앞 음을 여기서 끊는다
      v = 0; const prev = voices[0][voices[0].length - 1];
      if (prev) { prev.d = st.s - prev.s; if (prev.d < 1) voices[0].pop(); }
    }
    voices[v].push({ ...st }); ends[v] = st.s + st.d;
  }
  return voices.filter(v => v.length);
}
//  한 칸(손)씩 다음 음까지만(하프 펼침 · 북) — 소리는 저절로 울리지만 악보는 친 차례가 보이게
function monoLine(stacks, cap) {
  const out = stacks.map(st => ({ ...st }));
  for (let k = 0; k < out.length; k++) {
    const nx = out[k + 1], lim = cap ? cap(out[k]) : Infinity;
    out[k].d = Math.max(1, Math.min(out[k].d, nx ? nx.s - out[k].s : Infinity, lim - out[k].s));
  }
  return out;
}
//  덧줄이 덜 생기는 음자리표(같으면 높은음자리표)
export function chooseClef(ps) {
  if (!ps.length) return 'treble';
  const cost = clef => ps.reduce((a, p) => a + ledgerCount(clefPos(p, clef)) * 2 + (clefPos(p, clef) < -6 || clefPos(p, clef) > 14 ? 3 : 0), 0);
  return cost('bass') < cost('treble') ? 'bass' : 'treble';
}
const harmStacks = (harm, shift = 0) => stacksOf((harm || []).map(n => ({ s: n.s, d: n.d, p: n.p + shift }))).map(st => ({ ...st, i: 'h' + st.s }));

//  곡의 화음 이름(작곡 화면 화음 줄과 같은 것 = 실제로 울리는 것) — 국악 느낌 = 없음(지속음) · 오케스트라 = 편곡 화음 · 화음 친구 = 마디마다(진행이 적힌 곡은 박마다)
export function songChords(song) {
  if (!SCALES[song.scale] || SCALES[song.scale].family === 'korean') return [];
  if (orchOn(song)) return chordLine(song).filter(g => g.name).map(g => ({ s: g.s, name: g.name }));
  if (!song.acc || !song.acc.chord) return [];
  const bs = barSteps(song), out = [];
  if (song.prog && song.prog.length) {
    const every = song.progEvery || 1;
    for (let b = 0; b < song.bars; b++) for (let k = 0; k < song.beats; k++) {
      const at = b * song.beats + k, nm = song.prog[Math.floor(at / every) % song.prog.length], pv = at ? song.prog[Math.floor((at - 1) / every) % song.prog.length] : null;
      if (nm !== '-' && chordByName(nm) && (nm !== pv || k === 0)) out.push({ s: b * bs + k * song.sub, name: nm });
    }
    return out;
  }
  return fitChords(song, song.chords).map((r, b) => ({ s: b * bs, name: chordName(r, song.key || 0) }));
}

// ── ① 작곡 '악보 같이 보기' — 가락(+ 아이가 쌓은 화음 = 둘째 오선) ──
export function melodyScore(song, { harmony = true } = {}) {
  const hasH = harmony && (song.harm || []).length > 0;
  const staves = [{ id: 'mel', name: '가락', clef: 'treble', words: true, solY: 22, voices: [{ events: song.notes.map((n, i) => ({ s: n.s, d: n.d, ps: [n.p], i })) }] }];
  if (hasH) staves.push({ id: 'harm', name: '화음', clef: 'treble', voices: [{ events: harmStacks(song.harm) }] });
  return { beats: song.beats, sub: song.sub, bars: song.bars, ts: tsOf(song), staves, chords: songChords(song) };
}

// ── ② 오케스트라 총보 ──  편곡 사건 → 악기마다 오선(악기 차례 = 반짝이 · 목관 · 금관 · 타악기 · 하프 · 가락 · 현악기 화음 · 낮은 현)
const PERC_POS = { bassdrum: [3, 'n', '큰북'], snare: [5, 'n', '작은북'], cymbal: [6, 'x', '심벌즈'], swell: [6, 'x', '심벌즈'], triangle: [7, 'tri', '트라이앵글'] };
export const ORCH_ORDER = ['sparkle', 'winds', 'horn', 'tuba', 'timp', 'drums', 'harpR', 'harpL', 'lead', 'strings', 'cello', 'cb'];
export function orchScore(song) {
  const orch = normOrch(song.orch), P = PRESETS[orch.preset];
  const bs = barSteps(song), sub = song.sub, shift = leadShift(song);
  const evs = arrange(song, { sd: stepSec(song), shift, melody: true });
  const segs = chordLine(song), finalSeg = segs[segs.length - 1];
  const mp = song.notes.map(n => n.p + shift), lowLead = mp.length ? (Math.min(...mp) + Math.max(...mp)) / 2 < 58 : false;
  const G = {}; const put = (k, e) => (G[k] = G[k] || []).push(e);
  const glissFrom = P.gliss && song.bars > 1 && finalSeg ? finalSeg.s : Infinity;
  const pizzAt = new Map();
  for (const e of evs) if (e.track === 'bass' && e.inst === 'pizz') { if (!pizzAt.has(e.s)) pizzAt.set(e.s, []); pizzAt.get(e.s).push(e.p); }
  for (const e of evs) {
    if (e.kind === 'drum') { put('drums', e); continue; }
    if (e.track === 'sparkle') put('sparkle', e);
    else if (e.track === 'winds') put('winds', e);
    else if (e.track === 'brass') put(e.inst === 'tuba' ? 'tuba' : 'horn', e);
    else if (e.track === 'perc') put('timp', e);
    else if (e.track === 'harp') put(e.s >= glissFrom ? 'gliss' : e.p >= 60 ? 'harpR' : 'harpL', e);
    else if (e.track === 'strings') put('strings', e);
    else if (e.track === 'bass') {
      if (e.inst === 'contrabass') put('cb', e);
      else if (e.inst === 'cello') put('cello', e);
      else { const at = pizzAt.get(e.s) || [e.p]; put(at.length > 1 ? (e.p === Math.max(...at) ? 'cello' : 'cb') : lowLead ? 'cb' : 'cello', e); }   // 피치카토 — 둘이면 높은 것 = 첼로
    }
  }
  //  짧게 끊는 음(stacc) = 그 박 끝까지 적고 점 · 소수 칸은 가까운 칸으로
  const beatEnd = x => (Math.floor(x / sub + 1e-9) + 1) * sub;
  const quant = (e, oct = 0) => {
    const s = Math.round(e.s);
    let d = e.art === 'stacc' ? beatEnd(e.s + e.d - 1e-6) - s : Math.round(e.s + e.d) - s;
    d = Math.max(1, d);
    const ex = e.art === 'stacc' ? { stacc: true } : e.art === 'roll' ? { roll: true } : null;
    return { s, d, p: e.p - 12 * oct, ...(ex ? { ex } : {}) };
  };
  const ids = k => (st, j) => ({ ...st, i: k + ':' + st.s + ':' + j });
  const voicesOf = (k, list, oct = 0, mono = false) => {
    let stacks = stacksOf(list.map(e => quant(e, oct)));
    if (mono) return [{ events: monoLine(stacks).map(ids(k)) }];
    const vs = splitVoices(stacks);
    return vs.map((v, j) => ({ ...(vs.length > 1 ? { stem: j ? 'down' : 'up' } : {}), events: v.map(ids(k + j)) }));
  };
  const staffOf = (k, list, { name, sub: sb, clef = 'auto', oct = 0, fam, mono = false, words = false, extra = [] } = {}) => {
    const voices = voicesOf(k, list, oct, mono);
    for (const v of extra) voices.push(v);
    const ps = voices.flatMap(v => v.events.flatMap(e => e.ps));
    return { id: k, name, ...(sb ? { sub: sb } : {}), clef: clef === 'auto' ? chooseClef(ps) : clef, oct, fam, words, ...(words ? { solY: 28 } : {}), voices };
  };
  const nameOf = k => INSTS[k] || k;
  const uniq = a => [...new Set(a)];
  const out = {};
  if (G.sparkle) { const inst = G.sparkle[0].inst; out.sparkle = staffOf('sparkle', G.sparkle, { name: nameOf(inst), clef: 'treble', oct: inst === 'glock' ? 2 : 1, fam: 'perc' }); }
  if (G.winds) out.winds = staffOf('winds', G.winds, { name: '목관', sub: uniq(G.winds.map(e => nameOf(e.inst))).join(' · '), fam: 'wood' });
  if (G.horn) out.horn = staffOf('horn', G.horn, { name: '호른', fam: 'brass' });
  if (G.tuba) out.tuba = staffOf('tuba', G.tuba, { name: '튜바', clef: 'bass', fam: 'brass' });
  if (G.timp) out.timp = staffOf('timp', G.timp, { name: '팀파니', clef: 'bass', fam: 'perc' });
  if (G.drums) {
    //  한 줄 오선 — 줄 아래 큰북 · 줄 위 작은북 · × 심벌즈 · △ 트라이앵글(같은 때 = 한 기둥) · 다음 칠 때까지(박 끝을 넘지 않게) · 심벌 부풂 = 한 마디 굴리기
    const hits = G.drums.map(e => {
      const [pos, hd] = PERC_POS[e.drum] || [5, 'n'];
      const s = Math.round(e.s), swell = e.drum === 'swell';
      return { s, d: swell ? Math.max(1, Math.round(e.span || bs)) : sub, p: pos, h: hd, ...(swell ? { ex: { roll: true } } : {}) };
    });
    const st = monoLine(stacksOf(hits), x => (x.ex && x.ex.roll ? x.s + x.d : beatEnd(x.s)));
    out.drums = { id: 'drums', name: '타악기', sub: uniq(G.drums.map(e => (PERC_POS[e.drum] || [0, 0, e.drum])[2])).join(' · '), clef: 'perc1', oct: 0, fam: 'perc', voices: [{ stem: 'up', events: st.map(ids('drums')) }] };
  }
  if (G.harpR || G.harpL || G.gliss) {
    const R = [...(G.harpR || [])], L = [...(G.harpL || [])], gl = [];
    if (G.gliss && G.gliss.length) {                             // 끝 마디 글리산도 = 첫 음 ─ gliss. ─ 끝 음(그다음 끝까지)
      const run = [...G.gliss].sort((a, z) => a.s - z.s || a.p - z.p), a = run[0], z = run[run.length - 1];
      const s0 = Math.round(a.s), end = Math.round(a.s + a.d);
      gl.push({ s: s0, d: Math.min(sub, end - s0), ps: [a.p], ex: { gliss: true }, i: 'gliss:a' });
      if (end - s0 > sub) gl.push({ s: s0 + sub, d: end - s0 - sub, ps: [z.p], i: 'gliss:z' });
    }
    //  펼친 화음 = 뜯는 차례만 적는다(다음 음 · 박 끝까지) — 소리는 저절로 울림(l.v.) · 박을 넘는 붙임줄 사슬이 안 생기게
    const harpLine = list => monoLine(stacksOf(list.map(e => quant(e))), x => beatEnd(x.s));
    const rv = { events: [...harpLine(R).map(ids('harpR')).filter(e => !gl.length || e.s + e.d <= gl[0].s), ...gl] };
    out.harpR = { id: 'harpR', name: '하프', sub: 'l.v. 울림', clef: 'treble', oct: 0, fam: 'str', brace: 'start', voices: [rv] };
    out.harpL = { id: 'harpL', name: '', clef: 'bass', oct: 0, fam: 'str', voices: [{ events: harpLine(L).map(ids('harpL')) }] };
  }
  //  가락 = 아이가 지은 가락(가락 악기 높이로 옮긴 그대로) · 화음 칸을 목관이 안 맡으면 그 화음도 가락 악기로(둘째 음성)
  const lead = song.notes.map((n, i) => ({ s: n.s, d: n.d, ps: [n.p + shift], i }));
  const harmOnLead = (song.harm || []).length && !orch.parts.winds ? harmStacks(song.harm, shift) : [];
  const leadPs = [...lead.flatMap(e => e.ps), ...harmOnLead.flatMap(e => e.ps)];
  out.lead = { id: 'lead', name: '가락', sub: nameOf(song.inst), clef: chooseClef(leadPs), oct: 0, fam: familyOf(song.inst), words: !harmOnLead.length, solY: 28,
    voices: harmOnLead.length ? [{ stem: 'up', events: lead }, { stem: 'down', events: harmOnLead }] : [{ events: lead }] };
  if (G.strings) out.strings = staffOf('strings', G.strings, { name: '현악기 화음', sub: '바이올린 · 비올라', fam: 'str' });
  if (G.cello) out.cello = staffOf('cello', G.cello, { name: '첼로', sub: G.cello.some(e => e.inst === 'pizz') ? 'pizz. 뜯기' : '', clef: 'bass', fam: 'str' });
  if (G.cb) out.cb = staffOf('cb', G.cb, { name: '콘트라베이스', sub: G.cb.some(e => e.inst === 'pizz') ? 'pizz. 뜯기' : '', clef: 'bass', oct: -1, fam: 'str' });
  const staves = ORCH_ORDER.filter(k => out[k]).map(k => out[k]);
  if (out.harpR && !out.harpL) delete out.harpR.brace;
  const marks = orch.rit && song.bars >= 2 ? [{ bar: song.bars - 2, text: 'rit. 점점 느리게', cls: 'rit' }] : [];
  return { beats: song.beats, sub: song.sub, bars: song.bars, ts: tsOf(song), staves, chords: songChords(song), marks,
    tempo: { bpm: song.tempo, dotted: song.sub === 3 }, ...(orch.rit && finalSeg ? { fermata: { s: finalSeg.s } } : {}), preset: orch.preset };
}

// ── ③ 비트 악보 ──  북 오선(손 = 기둥 위 · 발(쿵) = 기둥 아래) · 가락(높은음자리표) · 베이스(낮은음자리표) · 화음 이름
//  북 자리(오선 맨 아랫줄 = 0 · 한 칸 위 = +1): 쿵 = 아래 첫째 칸(파4) · 짝 · 박수 = 셋째 칸(도5) · 칙 = 오선 위 ×(솔5) · 치이 = × 위 o ·
//   통 = 둘째 칸(라4) · 쉐이커 = 맨 윗줄 ×(파5) · 심벌 = 덧줄 위 ×(라5)
export const DRUM_POS = { kick: [1, 'n'], snare: [5, 'n'], clap: [5, 'x'], hatc: [9, 'x'], hato: [9, 'xo'], tom: [3, 'n'], shaker: [8, 'x'], cymbal: [10, 'x'] };
const FEET = new Set(['kick']);
export const LEAD_OCT = { glock: 2 };                           // 가락 악기가 칸보다 몇 옥타브 높게 소리 나나(beatkit.js LEAD_SND oct ÷ 12 · 나머지 = 1)
export const CHORD_LETTER = { I: 'C', IV: 'F', V: 'G', vi: 'Am' };
export const beatOrder = b => (b.mode === 'song' && b.arr.length ? b.arr.slice(0, 8) : [b.cur]);
export function beatScore(b, { patColors = ['#f2a93b', '#4cc9b0', '#ff8ab3', '#b48be6'] } = {}) {
  const G = C.gridOf(b.grid), len = C.lenOf(G), sub = G.sub, sl = C.slotLen(G);
  const song = b.mode === 'song' && b.arr.length > 0, order = beatOrder(b);
  const hands = [], feet = [], mel = [], bass = [], chords = [], marks = [];
  const beatEnd = x => (Math.floor(x / sub) + 1) * sub;
  order.forEach((pi, k) => {
    const p = b.pats[pi] || b.pats[0], base = k * len;
    marks.push({ bar: k * G.bars, text: C.LETTERS[pi], box: true, color: patColors[pi] });
    //  북 — 같은 칸 = 한 기둥 · 다음 칠 때까지(박 끝을 넘지 않게) · 세게(2) = > 표
    const H = [], F = [];
    for (const r of C.ROWS) for (let i = 0; i < len; i++) {
      const v = p.d[r][i]; if (!v) continue;
      const [pos, hd] = DRUM_POS[r];
      (FEET.has(r) ? F : H).push({ s: base + i, d: len, p: pos, h: hd, ...(v === 2 || hd === 'xo' ? { ex: { ...(v === 2 ? { accent: true } : {}), ...(hd === 'xo' ? { open: true } : {}) } } : {}) });
    }
    const cap = x => Math.min(base + len, base + beatEnd(x.s - base));
    hands.push(...monoLine(stacksOf(H), cap).map(st => ({ ...st, i: 'dh' + st.s })));
    feet.push(...monoLine(stacksOf(F), cap).map(st => ({ ...st, i: 'dk' + st.s })));
    //  가락 · 베이스 — 칸 값 = 음 · 빈칸 = 앞 음이 이어짐 · x = 쉼 · 패턴 끝에서 끝남(박자기와 같은 셈)
    for (let i = 0; i < len; i++) {
      const m = C.melAt(p, i, len);
      if (m && !m.rest) mel.push({ s: base + i, d: m.end - i, ps: [C.MEL[m.n].p], lab: C.melShort(m.n), i: 'm' + (base + i) });
      const q = C.bassAt(p, i, len);
      if (q && !q.rest) bass.push({ s: base + i, d: q.end - i, ps: [C.BASS[q.n].p], lab: q.n === 5 ? '도˙' : C.BASS[q.n].n, i: 'b' + (base + i) });
    }
    //  화음 이름 — 화음이 바뀌는 칸마다(빈 칸 = 앞 화음이 이어짐 · 패턴마다 새로)
    let curCh = null;
    for (let j = 0; j < C.slotsOf(G); j++) { const ch = p.c[j]; if (ch && ch !== curCh) { chords.push({ s: base + j * sl, name: CHORD_LETTER[ch], ko: C.CHORDS[ch].full, ch }); curCh = ch; } }
  });
  const staves = [];
  if (mel.length) staves.push({ id: 'mel', name: '가락', sub: C.LEADS[C.leadOf(b.lead)].name, clef: 'treble', oct: LEAD_OCT[C.leadOf(b.lead)] || 1, words: 'lab', solY: 26, voices: [{ events: mel }] });
  if (bass.length) staves.push({ id: 'bass', name: '베이스', clef: 'bass', oct: b.kit === 'kor' ? 1 : 0, words: 'lab', solY: 26, voices: [{ events: bass }] });
  staves.push({ id: 'drums', name: b.kit === 'kor' ? '장단' : '북', sub: C.KITS[C.KIT_KEYS.includes(b.kit) ? b.kit : 'elec'].name, clef: 'perc', oct: 0,
    voices: [{ stem: 'up', restDy: -8, events: hands }, { stem: 'down', restDy: 22, events: feet }] });
  const swingTxt = b.swing > 0 && C.swingable(G) ? `통통 튀게 ${b.swing}%` : '';
  return { beats: G.beats, sub, bars: order.length * G.bars, ts: tsOf({ beats: G.beats, sub }), staves, chords, marks,
    repeat: song ? null : { from: 0, to: G.bars - 1 }, tempo: { bpm: b.bpm, dotted: sub === 3, ...(swingTxt ? { extra: swingTxt } : {}) },
    order, song, grid: G.key, hits: hands.reduce((a, e) => a + e.ps.length, 0) + feet.reduce((a, e) => a + e.ps.length, 0) };
}
//  칸판 줄 ↔ 악보 자리 안내(쓰인 줄만) — 화면은 scoreview.js 가 작은 오선에 그린다
export function beatLegend(b) {
  const order = beatOrder(b), pats = order.map(i => b.pats[i] || b.pats[0]);
  const used = r => pats.reduce((a, p) => a + p.d[r].filter(Boolean).length, 0);
  const drums = C.ROWS.filter(r => used(r)).map(r => ({ row: r, name: C.rowName(b.kit, r), what: C.rowWhat(b.kit, r), pos: DRUM_POS[r][0], head: DRUM_POS[r][1], feet: FEET.has(r), n: used(r) }));
  const strong = pats.some(p => C.ROWS.some(r => p.d[r].includes(2)));
  const chordKeys = [...new Set(pats.flatMap(p => p.c.filter(Boolean)))];
  return { drums, strong, mel: pats.some(p => C.melCount(p) > 0), bass: pats.some(p => p.b.some(v => v >= 0 && v <= 5)), chords: chordKeys, fill: !!b.fill };
}
