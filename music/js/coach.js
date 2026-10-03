// 작곡 코치 — 정해진 규칙으로 가락을 살펴보고 한두 마디 건넨다(점수 매기기 아님). 교과 창작의 말(마침·반복·가락선·쉼·리듬)로.
import { SCALES, solfege, pc, barSteps, totalSteps } from './theory.js';

// → [{ kind: 'good'|'tip', text }]  좋은 점 먼저, 해 볼 것 다음
export function coach(song) {
  const out = [], notes = [...song.notes].sort((a, z) => a.s - z.s);
  const sc = SCALES[song.scale] || SCALES.penta, bs = barSteps(song);
  if (!notes.length) return [{ kind: 'tip', text: '칸을 눌러 첫 음을 놓아 보세요. 아무 데나 괜찮아요.' }];
  if (notes.length < 4) return [{ kind: 'tip', text: '조금 더 놓아 보세요. 음이 네 개가 넘으면 가락의 모양이 보여요.' }];

  // 마침 — 마지막 음
  const last = notes[notes.length - 1], lastBar = Math.floor(last.s / bs);
  const tonicName = solfege(60 + sc.tonic, { short: true });
  if (lastBar === song.bars - 1) {
    if (pc(last.p) === sc.tonic) out.push({ kind: 'good', text: `마지막 음이 '${tonicName}'라서 노래가 끝난 느낌이 나요(마침).` });
    else out.push({ kind: 'tip', text: `마지막 음이 '${solfege(last.p, { short: true })}'예요. 아직 이어질 것 같은 느낌 — 끝난 느낌을 주려면 '${tonicName}'로 끝내 보세요.` });
  }
  // 빈 마디
  const empty = [];
  for (let b = 0; b < song.bars; b++) if (!notes.some(n => n.s < (b + 1) * bs && n.s + n.d > b * bs)) empty.push(b + 1);
  if (empty.length && empty.length < song.bars) out.push({ kind: 'tip', text: `${empty.join('·')}마디가 비어 있어요. '아이디어 친구'에게 이어 짓기를 부탁해 볼까요?` });
  // 반복 — 같은 리듬 꼴의 마디
  const rhythmOf = b => notes.filter(n => n.s >= b * bs && n.s < (b + 1) * bs).map(n => `${n.s - b * bs}:${n.d}`).join(',');
  const seen = new Map();
  for (let b = 0; b < song.bars; b++) { const r = rhythmOf(b); if (!r) continue; if (seen.has(r)) { out.push({ kind: 'good', text: `${seen.get(r) + 1}마디와 ${b + 1}마디의 리듬이 같아요. 반복이 있으면 기억하기 쉬워요.` }); break; } seen.set(r, b); }
  // 가락선 — 큰 뜀
  let leaps = 0, maxLeap = 0;
  for (let i = 1; i < notes.length; i++) { const d = Math.abs(notes[i].p - notes[i - 1].p); if (d >= 8) leaps++; maxLeap = Math.max(maxLeap, d); }
  if (leaps >= 3) out.push({ kind: 'tip', text: `음이 크게 뛰는 곳이 ${leaps}번 있어요. 노래로 부르기 어려울 수 있어요 — 한두 곳은 옆 음으로 이어 볼까요?` });
  else if (maxLeap <= 4 && notes.length >= 8) out.push({ kind: 'good', text: '옆 음으로 차근차근 움직여서 부르기 쉬운 가락이에요.' });
  // 끝으로 갈수록 올라가나 내려가나
  const tail = notes.slice(-4);
  if (tail.length === 4) {
    const up = tail.every((n, i) => !i || n.p >= tail[i - 1].p), down = tail.every((n, i) => !i || n.p <= tail[i - 1].p);
    if (up && tail[3].p > tail[0].p) out.push({ kind: 'good', text: '끝에서 가락이 올라가요 — 힘차고 밝게 들려요.' });
    else if (down && tail[3].p < tail[0].p) out.push({ kind: 'good', text: '끝에서 가락이 내려와요 — 차분하게 마무리돼요.' });
  }
  // 쉼 — 숨 쉴 틈
  let filled = 0; for (const n of notes) filled += n.d;
  if (filled >= totalSteps(song) * 0.97 && song.bars >= 4) out.push({ kind: 'tip', text: '쉬는 곳 없이 음이 이어져요. 중간에 쉼을 하나 두면 숨 쉴 틈이 생겨요.' });
  // 리듬 — 다 같은 길이
  const lens = new Set(notes.map(n => n.d));
  if (lens.size === 1 && notes.length >= 6) out.push({ kind: 'tip', text: '모든 음의 길이가 같아요. 긴 음을 섞으면 리듬이 살아나요(음 길이 고르기).' });
  else if (lens.size >= 3) out.push({ kind: 'good', text: '짧은 음과 긴 음이 섞여 리듬이 재미있어요.' });
  // [MUSIC-HARM-1] 화음 — 가락과 같은 때 울리는 화음 음이 어울리나(바로 옆 음 = 부딪힘 · 3도·5도·6도 = 어울림)
  if (song.harm && song.harm.length) {
    let good = 0; const clash = [];
    for (const hn of song.harm) {
      const m = notes.find(n => n.s <= hn.s && hn.s < n.s + n.d);
      if (!m) continue;
      const iv = ((m.p - hn.p) % 12 + 12) % 12;
      if ([1, 2, 10, 11].includes(iv)) clash.push(hn); else good++;
    }
    if (clash.length) out.push({ kind: 'tip', text: `화음과 가락이 부딪히는 곳이 ${clash.length}군데 있어요(예: ${Math.floor(clash[0].s / bs) + 1}마디 '${solfege(clash[0].p, { short: true })}'). 바로 옆 음끼리는 부딪혀요 — 두 칸 떨어진 음(3도)이 잘 어울려요.` });
    else if (good) out.push({ kind: 'good', text: `화음 ${good}음이 가락과 잘 어울려요(3도 · 5도 · 6도).` });
  }
  // 국악 느낌
  if (sc.family === 'korean') out.push({ kind: 'good', text: `${sc.name}: ${sc.hint}` });
  const good = out.filter(x => x.kind === 'good'), tip = out.filter(x => x.kind === 'tip');
  return [...good.slice(0, 2), ...tip.slice(0, 2)];
}

// 아이디어 친구 — 비어 있는 첫 마디에 넣을 가락 몇 가지(반복 · 한 칸 위로 · 끝맺기)
export function ideas(song, rows) {
  const bs = barSteps(song), notes = [...song.notes].sort((a, z) => a.s - z.s);
  const has = b => notes.some(n => n.s < (b + 1) * bs && n.s + n.d > b * bs);
  let target = -1;
  for (let b = 1; b < song.bars; b++) if (!has(b) && has(b - 1)) { target = b; break; }
  if (target < 0) return null;
  const src = notes.filter(n => n.s >= (target - 1) * bs && n.s < target * bs);
  const move = (n, steps) => { const i = rows.indexOf(n.p); const j = Math.max(0, Math.min(rows.length - 1, (i < 0 ? 0 : i) + steps)); return rows[j]; };
  const shift = off => src.map(n => ({ s: n.s + bs, d: Math.min(n.d, (target + 1) * bs - (n.s + bs)), p: off ? move(n, off) : n.p }));
  const sc = SCALES[song.scale] || SCALES.penta;
  const out = [
    { name: '따라 하기', why: '앞 마디를 그대로 한 번 더 — 반복', notes: shift(0) },
    { name: '한 칸 위로', why: '리듬은 같게, 음만 한 칸씩 위로 — 비슷하지만 조금 다르게', notes: shift(1) },
    { name: '한 칸 아래로', why: '리듬은 같게, 음만 한 칸씩 아래로', notes: shift(-1) },
  ];
  if (target === song.bars - 1) {                     // 끝 마디면 '끝맺기' — 으뜸음으로 길게
    const tonic = rows.filter(p => pc(p) === sc.tonic).sort((a, z) => Math.abs(a - (src[src.length - 1]?.p || 67)) - Math.abs(z - (src[src.length - 1]?.p || 67)))[0] || 60;
    const first = src[0];
    const end = [];
    if (first && first.s - (target - 1) * bs === 0 && first.d < bs) end.push({ s: target * bs, d: first.d, p: move(first, 1) });
    const at = end.length ? target * bs + end[0].d : target * bs;
    end.push({ s: at, d: (target + 1) * bs - at, p: tonic });
    out.unshift({ name: '끝맺기', why: `마지막 마디 — '${solfege(tonic, { short: true })}'로 길게 끝내기`, notes: end });
  }
  return { bar: target, options: out.filter(o => o.notes.length) };
}
