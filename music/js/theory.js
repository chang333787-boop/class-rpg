// 음 이름 · 음계 · 박자 · 음표 길이 · 화음 — 화면과 소리가 없는 순수 계산(node 로도 시험한다)
//  음 높이는 MIDI 번호(60 = 가운데 도). 음 이름은 '다장조 계이름'(도=C) — 리코더 운지표와 같은 이름.

const NAMES = ['도', '도#', '레', '레#', '미', '파', '파#', '솔', '솔#', '라', '라#', '시'];
const LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const pc = p => ((p % 12) + 12) % 12;
// 4옥타브(60~71) = 그냥 이름, 그 위 = '높은', 그 아래 = '낮은'
export function solfege(p, { short = false } = {}) {
  const n = NAMES[pc(p)];
  const oct = Math.floor(p / 12) - 1;
  if (oct === 4) return n;
  if (oct === 5) return short ? n : '높은 ' + n;
  if (oct >= 6) return short ? n : '아주 높은 ' + n;
  return short ? n : '낮은 ' + n;
}
export const octaveMark = p => { const o = Math.floor(p / 12) - 1; return o === 4 ? 0 : o - 4; };   // 위 점 +1 · 아래 점 -1
export const letter = p => LETTERS[pc(p)] + (Math.floor(p / 12) - 1);
export const freq = p => 440 * Math.pow(2, (p - 69) / 12);
export function parsePitch(s) {          // 'C4' · 'F#5' · 'Bb4' → MIDI
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(String(s).trim());
  if (!m) return null;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  return (Number(m[3]) + 1) * 12 + base + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

// 무지개 실로폰 색(도 빨강 · 레 주황 · 미 노랑 · 파 초록 · 솔 하늘 · 라 남색 · 시 보라). 반음은 아래 음 색
const PC_COLOR = ['#e5484d', '#e5484d', '#f08c2e', '#f08c2e', '#f2c230', '#43b25b', '#43b25b', '#2fa3e6', '#2fa3e6', '#4d5fd6', '#4d5fd6', '#9b59d0'];
export const colorOf = p => PC_COLOR[pc(p)];

// ── 음계 ──  rows = 작곡 칸의 줄(낮은 음 → 높은 음). tonic = 끝내면 '마친 느낌'이 나는 음(으뜸음)
export const SCALES = {
  penta:    { name: '5음 음계', short: '5음', pcs: [0, 2, 4, 7, 9], tonic: 0, family: 'west',
              hint: '도·레·미·솔·라 다섯 음. 아무렇게 놓아도 잘 어울려요. 도로 끝내면 마친 느낌.' },
  major:    { name: '장음계', short: '장음계', pcs: [0, 2, 4, 5, 7, 9, 11], tonic: 0, family: 'west',
              hint: '도레미파솔라시 일곱 음을 다 써요. 도로 끝내면 마친 느낌.' },
  pyeong:   { name: '평조 느낌', short: '평조', pcs: [7, 9, 0, 2, 4], tonic: 7, family: 'korean',
              hint: '솔·라·도·레·미. 솔로 끝내면 맑고 씩씩한 국악 느낌이 나요.' },
  gyemyeon: { name: '계면조 느낌', short: '계면조', pcs: [9, 0, 2, 4, 7], tonic: 9, family: 'korean',
              hint: '라·도·레·미·솔. 라로 끝내면 구슬픈 국악 느낌이 나요.' },
};
export const ROW_LOW = 60, ROW_HIGH = 76;   // 기본 줄 = 가운데 도 ~ 높은 미 (소프라노 리코더로 불기 좋은 넓이)
// 음계의 줄. 곡에 이미 있는 음이 넓이를 넘으면 그 음까지 넓힌다(라이브러리 곡을 고쳐 쓸 때)
export function scaleRows(scaleKey, notes = []) {
  const sc = SCALES[scaleKey] || SCALES.penta;
  let lo = ROW_LOW, hi = ROW_HIGH;
  for (const n of notes) { lo = Math.min(lo, n.p); hi = Math.max(hi, n.p); }
  const rows = [];
  for (let p = lo; p <= hi; p++) if (sc.pcs.includes(pc(p)) || notes.some(n => n.p === p)) rows.push(p);
  return rows;
}

// ── 박자 ──  beats = 한 마디의 박 수 · sub = 한 박을 몇 칸으로 나누나(2 = 8분음표 칸, 3 = 겹박자, 4 = 16분음표 칸)
export const METERS = [
  { key: '2/4', beats: 2, sub: 2, name: '2/4 · 두 박' },
  { key: '3/4', beats: 3, sub: 2, name: '3/4 · 세 박' },
  { key: '4/4', beats: 4, sub: 2, name: '4/4 · 네 박' },
  { key: '9/8', beats: 3, sub: 3, name: '세마치 장단 · 9/8', jangdan: 'semachi' },
  { key: '12/8', beats: 4, sub: 3, name: '굿거리 장단 · 12/8', jangdan: 'gutgeori' },
];
export const meterOf = s => METERS.find(m => m.beats === s.beats && m.sub === s.sub) || { key: `${s.beats}/${s.sub === 3 ? 8 : 4}`, beats: s.beats, sub: s.sub, name: `${s.beats}박` };
export const barSteps = s => s.beats * s.sub;
export const totalSteps = s => s.bars * barSteps(s);
export const stepSec = (s, scale = 1) => 60 / (s.tempo * scale) / s.sub;   // 한 칸의 길이(초)

// ── 음표 길이 ──  d = 칸 수. 고르는 판(아이 손에 맞는 것만)과 이름
export function lengthChoices(sub) {
  if (sub === 3) return [1, 2, 3, 6];
  return [1, 2, 3, 4, 6, 8];
}
// 칸 수 → 음표 이름(하나로 쓸 수 있을 때만). 겹박자는 8분음표가 한 칸
export function valueName(d, sub) {
  const unit = sub === 4 ? 16 : 8;                  // 한 칸 = 16분음표 또는 8분음표
  const table = unit === 16
    ? { 1: '16분음표', 2: '8분음표', 3: '점8분음표', 4: '4분음표', 6: '점4분음표', 8: '2분음표', 12: '점2분음표', 16: '온음표' }
    : { 1: '8분음표', 2: '4분음표', 3: '점4분음표', 4: '2분음표', 6: '점2분음표', 8: '온음표', 12: '점온음표' };
  return table[d] || null;
}
export function beatsText(d, sub) {               // '반 박' · '1박' · '1박 반' …
  const b = d / sub;
  if (sub === 3) return b === 1 ? '1박' : b === 2 ? '2박' : (Math.round(b * 10) / 10) + '박';
  if (b === 0.5) return '반 박';
  if (b === 0.25) return '반의 반 박';
  if (Number.isInteger(b)) return b + '박';
  return Math.floor(b) + '박 반';
}

// ── 화음 ──  초등 '주요 3화음'(으뜸·버금딸림·딸림)을 곡의 조(key = 으뜸음 번호, 다장조 0 · 사장조 7)에 맞춰.
//  국악 느낌은 화음 대신 지속음(으뜸음 + 5도)
export const ROMAN = {
  I: { off: 0, ko: '으뜸화음' },
  IV: { off: 5, ko: '버금딸림화음' },
  V: { off: 7, ko: '딸림화음' },
};
export const chordRoot = (roman, key = 0) => (key + ROMAN[roman].off) % 12;
export const chordPcs = (roman, key = 0) => { const r = chordRoot(roman, key); return [r, (r + 4) % 12, (r + 7) % 12]; };
export const chordName = (roman, key = 0) => LETTERS[chordRoot(roman, key)];
// 화음 이름 → 반음 번호들. 'C' · 'Am' · 'F#' · 'Bb' · 'Bdim' · 'E7'(7은 딸림7) · '-' = 화음 없음
export function chordByName(name) {
  const m = /^([A-G])([#b]?)(m|dim|7)?$/.exec(String(name || '').trim());
  if (!m) return null;
  const root = (({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 })[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? 11 : 0)) % 12;
  const third = m[3] === 'm' || m[3] === 'dim' ? 3 : 4, fifth = m[3] === 'dim' ? 6 : 7;
  const pcs = [root, (root + third) % 12, (root + fifth) % 12];
  if (m[3] === '7') pcs.push((root + 10) % 12);
  return { name: m[0], root, pcs };
}
export const keyName = (key = 0) => ({ 0: '다장조', 7: '사장조', 5: '바장조', 2: '라장조' })[key] || LETTERS[key] + ' 장조';

// 마디마다 어울리는 화음 고르기 — 센박·긴 음에 무게, 화음 밖 음은 감점. manual[bar] 가 있으면 그것.
//  같으면 앞 마디 화음 → I → V → IV 순. 첫 마디·끝 마디는 I 가 웬만하면(80%) I.
export function fitChords(song, manual = []) {
  const bs = barSteps(song), key = song.key || 0, out = [];
  for (let b = 0; b < song.bars; b++) {
    if (manual[b] && ROMAN[manual[b]]) { out.push(manual[b]); continue; }
    const a = b * bs, z = a + bs;
    const score = { I: 0, IV: 0, V: 0 };
    let any = false;
    for (const n of song.notes) {
      const s0 = Math.max(n.s, a), s1 = Math.min(n.s + n.d, z);
      if (s1 <= s0) continue;
      any = true;
      const rel = s0 - a;
      const w = (s1 - s0) * (rel === 0 ? 2 : rel % song.sub === 0 ? 1.4 : 1);
      for (const k of Object.keys(score)) score[k] += chordPcs(k, key).includes(pc(n.p)) ? w : -0.5 * w;
    }
    const prev = out[b - 1] || 'I';
    if (!any) { out.push(prev); continue; }
    const order = [...new Set([prev, 'I', 'V', 'IV'])];
    let best = order[0];
    for (const k of order) if (score[k] > score[best] + 1e-9) best = k;
    if ((b === 0 || b === song.bars - 1) && score.I >= score[best] * 0.8) best = 'I';
    out.push(best);
  }
  return out;
}
