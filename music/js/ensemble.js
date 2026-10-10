// 합주 연습 [MUSIC-ENSEMBLE-1] — 선생님 곡 가운데 제목이 같고 부분(part)이 다른 곡(예: '겨울 밤' 1부(S1) · 2부(S2))을 한 합주로 묶는다.
//  아이가 한 부분을 리코더 연습 · 리듬 게임으로 할 때 '🎶 함께 연주'를 켜면 나머지 부분이 같이 울린다(반 친구들과 맞춰 불어 보듯).
//  묶는 조건 — 선생님 곡 · 부분 이름이 있음 · 제목이 같음(빈칸은 하나로 맞춰 견줌) · 둘 이상 · 부분 이름이 모두 다름 ·
//   박(beats) · 한 박 칸 수(sub) · 마디 수(bars) · 빠르기(tempo)가 모두 같음. 하나라도 어긋나면 그 제목은 합주로 내놓지 않는다(따로 연습은 그대로).
//  함께 연주 소리 = 짝 부분의 가락을, 연습하는 곡의 칸 시각(세기 박 · 빠르기 배 그대로)에 얹는다 — 같은 칸이면 시각도 똑같은 수(어긋남 0).
//  음색 = 클라리넷(리코더와 같은 관악기라 어울리고 · 리드 소리라 내 리코더와 또렷이 갈림 · 긴 음도 끝까지 이어짐) · 세기는 내 가락보다 작게.
//   (헤드리스 OfflineAudioContext 로 잼: 리코더 0.75 대비 플루트는 밝기가 1.2배뿐이라 섞여 버리고 · 실로폰 · 피아노는 긴 음이 사라짐 → 클라리넷)
//  DOM 없음 — node 로 시험: scripts/unit/music/ensemble.test.mjs
import { totalSteps } from './theory.js';

export const PARTNER = { inst: 'clarinet', vel: 0.7 };    // 함께 연주 한 부분의 소리(부분이 여럿이면 한 부분 세기 = vel / √부분 수)
export const TOGETHER_KEY = 'music.together';             // 이 기기에 '함께 연주' 켬 · 끔을 기억(처음 = 켬)

const nameOf = s => String((s && s.name) || '').replace(/\s+/g, ' ').trim();
const byOrder = (a, z) => ((a.order ?? 99) - (z.order ?? 99)) || String(a.part).localeCompare(String(z.part), 'ko') || String(a.tk).localeCompare(String(z.tk));
const isPart = s => !!(s && s.ts && s.tk && s.part && nameOf(s));

//  같은 제목 묶음이 합주가 될 수 있는지 — '' = 됨 · 아니면 까닭(교사 · 시험이 읽는다)
export function ensembleWhy(arr) {
  if (!arr || arr.length < 2) return '부분이 하나뿐이에요';
  if (new Set(arr.map(s => s.part)).size !== arr.length) return '같은 부분 이름이 두 번 있어요';
  const a = arr[0];
  for (const [k, name] of [['beats', '박이'], ['sub', '한 박 칸 수가'], ['bars', '마디 수가'], ['tempo', '빠르기가']]) if (arr.some(s => s[k] !== a[k])) return `부분마다 ${name} 달라요`;
  return '';
}
//  선생님 곡 목록 → 합주 묶음 [{ name, members(순서대로) }] — 묶을 수 있는 것만
export function ensembleGroups(list) {
  const by = new Map();
  for (const s of list || []) {
    if (!isPart(s)) continue;
    const k = nameOf(s);
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(s);
  }
  const out = [];
  for (const [name, arr] of by) if (!ensembleWhy(arr)) out.push({ name, members: [...arr].sort(byOrder) });
  return out;
}
//  이 곡이 든 합주 묶음(없으면 null) · 짝 부분(나를 뺀 나머지 · 순서대로)
export function groupOf(song, list) {
  if (!isPart(song)) return null;
  return ensembleGroups(list).find(g => g.members.some(s => s.tk === song.tk)) || null;
}
export function partnersOf(song, list) {
  const g = groupOf(song, list);
  return g ? g.members.filter(s => s.tk !== song.tk) : [];
}
//  고르기 목록 순서 — 합주 부분끼리 붙여서(묶음의 첫 부분 자리에 · 부분 순서대로) · 나머지 곡 순서는 그대로
export function ensembleOrder(list) {
  const at = new Map();
  for (const g of ensembleGroups(list)) for (const s of g.members) at.set(s, g);
  const out = [], seen = new Set();
  for (const s of list || []) {
    const g = at.get(s);
    if (!g) { out.push(s); continue; }
    if (seen.has(g)) continue;
    seen.add(g); out.push(...g.members);
  }
  return out;
}
//  함께 칠 부분 고르기(부분이 셋 이상인 합주) — 'all' 또는 모르는 값 = 모두 · 곡키 = 그 부분만
export function pickPartners(partners, pick) {
  const one = (partners || []).find(q => q.tk === pick);
  return one ? [one] : [...(partners || [])];
}
export const partLabel = partners => (partners || []).map(q => q.part).join(' · ');

//  짝 부분 가락 → 소리 사건(track 'partner') — built = 연습하는 곡의 buildEvents 결과(offset · stepDur 를 그대로 쓴다)
//   ownInst: true = 부분마다 제 악기(합주 듣기) · 아니면 PARTNER 소리 · 곡 끝을 넘는 음은 자른다
export function partnerEvents(song, partners, built, o = {}) {
  const list = partners || [];
  if (!list.length || !built) return [];
  const sd = built.stepDur, off = built.offset, total = totalSteps(song), vel = Math.round((o.vel ?? PARTNER.vel) / Math.sqrt(list.length) * 1000) / 1000;
  const ev = [];
  for (const q of list) for (const n of q.notes || []) {
    if (!(n.s >= 0 && n.s < total && n.d >= 1)) continue;
    ev.push({ t: off + n.s * sd, d: Math.min(n.d, total - n.s) * sd, kind: 'note', inst: o.ownInst ? q.inst : (o.inst || PARTNER.inst), p: n.p, vel, track: 'partner', part: q.part });
  }
  return ev;
}
//  사건 목록에 짝 사건을 더해 시각 순서로(Player 는 앞에서부터 차례로 예약한다)
export const withPartners = (built, ev) => (ev && ev.length ? { ...built, events: [...built.events, ...ev].sort((a, z) => a.t - z.t) } : built);
//  짝 부분 음표를 칸으로(연습 화면 아래 얇은 줄)
export const ghostNotes = partners => (partners || []).flatMap(q => q.notes || []).slice().sort((a, z) => a.s - z.s);

//  시험용(?debug=1 일 때만) — Player 가 실제로 소리 장치에 넘긴 사건을 적는다(끈 줄은 안 적음 · 복사본) · 화면 동작은 그대로
export function tapFired(player, log, now) {
  const fire = player._fire.bind(player);
  player._fire = ev => {
    if (!player.mute[ev.track]) log.push({ track: ev.track, t: ev.t, at: player.t0 + ev.t, now: now(), p: ev.p, d: ev.d, inst: ev.inst, vel: ev.vel, part: ev.part || '' });
    fire(ev);
  };
}
