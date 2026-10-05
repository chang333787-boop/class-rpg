// 하위 앱 과제 계약 [ASSIGN-SUBAPP-1] — 기초 코딩 · 음악실(다음 단계가 붙인다) · 그 밖의 학습 앱이 같은 꼴로 쓴다(ES 모듈)
//  RPG 홈 '선생님 과제' 카드 → openExternalEmbed(<앱>, '&assign=<과제>') → 앱 주소 ?sid=…&n=…&assign=<과제>
//  앱이 할 일:
//   1) const A = assignFromUrl(); if (A) { const def = await loadAssign(db, A.aid); … }   — def 가 null 이면 '다시 불러오기' 화면(보통 모드로 가지 않는다)
//   2) watchMine(db, A.aid, A.sid, cell => …)   — 내 칸(이어 하기 · 별 · 판 수). 첫 값이 온 뒤에만 부른다
//   3) reportAssign(db, A.aid, A.sid, patch)     — 결과. RPG 안(iframe)이면 부모 학생 화면에 넘겨 **부모가 쓴다**(쓰는 곳 하나 · iframe 을 닫아도 결과가 남음)
//        patch = { start:true }                 처음 열었을 때(startedAt — 없을 때만)
//                { attempt:true }               실행 · 판 한 번(app/attempts += 1)
//                { score, total }               코딩: 푼 판 수 / 판 수 · 리듬: 가장 좋은 정확도 / 100 — 점수는 늘 때만 써진다
//                { detail: { <열쇠>: { rank, … } } }   판마다(코딩 '2-3') · 곡(리듬 'best') 가장 좋은 기록 — rank 가 더 클 때만 써진다(1KB 안)
//                { done:true }                  다 했을 때(doneAt — 없을 때만). 리듬은 친 음표가 1개 이상일 때만 보낼 것
//   4) onClassPause(on => …)                     — 부모의 '선생님과 수업' 덮개 신호(덮이면 소리 · 실행 · 게임 멈춤)
//   · 과제 판 코드 · 기록은 그 앱의 원래 저장(classRPG_<앱>)을 덮지 않게 다른 열쇠로(예: code/<sid>/<판>__asg_<과제>) — 앱 쪽 몫
//   · RPG 본 데이터(classRPG_v3)는 읽지도 쓰지도 않는다. 쓰는 곳 = classRPG_assign/results/<과제>/<나> 아래만(직접 쓸 때)
import './assign-core.js';

export const AC = globalThis.AssignCore;
const ORIGIN = () => (globalThis.location && globalThis.location.origin) || '';

//  ?assign=<과제>&sid=<아이>[&live=1] → { aid, sid, live } · 손님(sid 없음) · 이상한 값이면 null
export function assignFromUrl(loc = globalThis.location) {
  try {
    const q = new URLSearchParams((loc && loc.search) || '');
    const aid = q.get('assign') || '', sid = q.get('sid') || '';
    if (!AC.safeAid(aid) || !AC.safeKey(sid)) return null;
    return { aid, sid, live: q.get('live') === '1' };
  } catch (e) { return null; }
}

//  과제 정의 — 열린 것(open) → 닫힌 것(archive) 차례 · ms 넘으면 null
export async function loadAssign(db, aid, ms = 4000) {
  if (!db || !AC.safeAid(aid)) return null;
  const once = p => db.ref(AC.path.full(p)).once('value').then(s => s.val());
  const work = (async () => {
    const o = await once(AC.path.open(aid));
    if (o) return AC.normDef(o, aid);
    const a = await once(AC.path.archive(aid));
    const d = a ? AC.normDef(a, aid) : null;
    if (d) d.closed = true;
    return d;
  })();
  return Promise.race([work.catch(() => null), new Promise(r => setTimeout(() => r(null), ms))]);
}

//  정의 듣기 — 바뀌면 cb(def) · 닫히면(open 에서 사라지면) cb(null)
export function watchAssign(db, aid, cb) {
  if (!db || !AC.safeAid(aid)) return () => {};
  const r = db.ref(AC.path.full(AC.path.open(aid)));
  const f = r.on('value', s => { const v = s.val(); cb(v ? AC.normDef(v, aid) : null); });
  return () => r.off('value', f);
}

//  내 결과 칸 듣기 — 첫 값이 온 뒤에만 cb(그 전에 '더 좋을 때만' 견주면 좋은 기록을 덮는다)
export function watchMine(db, aid, sid, cb) {
  if (!db || !AC.safeAid(aid) || !AC.safeKey(sid)) return () => {};
  const r = db.ref(AC.path.full(AC.path.result(aid, sid)));
  const f = r.on('value', s => cb(s.val() || {}));
  return () => r.off('value', f);
}

// ── 결과 보내기 ──
let seq = 0;
const pending = new Map(), listened = new WeakSet();
function listenAck(win) {
  if (!win || !win.addEventListener || listened.has(win)) return;
  listened.add(win);
  win.addEventListener('message', e => {
    if (e.origin !== ORIGIN()) return;
    const d = e.data;
    if (!d || d.type !== 'rpg:assign-ack') return;
    const p = pending.get(d.id);
    if (p) { pending.delete(d.id); p(!!d.ok); }
  });
}
//  직접 쓰기(RPG 밖에서 열었거나 부모가 2초 안에 답이 없을 때) — 내 칸 아래만(AC.appPatch)
async function directWrite(db, aid, sid, patch) {
  if (!db) return false;
  try {
    const def = await loadAssign(db, aid);
    if (!def || def.closed || !AC.isTarget(def, sid)) return false;
    const cell = (await db.ref(AC.path.full(AC.path.result(aid, sid))).once('value')).val();
    const SV = (globalThis.firebase && globalThis.firebase.database && globalThis.firebase.database.ServerValue) || null;
    const up = AC.appPatch(def, sid, cell, patch, { TS: SV ? SV.TIMESTAMP : { '.sv': 'timestamp' }, INC: n => (SV ? SV.increment(n) : { '.sv': { increment: n } }) });
    if (!up) return false;
    await db.ref(AC.ROOT).update(up);
    return true;
  } catch (e) { console.warn('[ASSIGN-SUBAPP-1] 결과 쓰기 실패', e); return false; }
}
//  opt = { parent(부모 창 — 시험용), win(내 창), ackMs(기본 2000) } → Promise<boolean>
export function reportAssign(db, aid, sid, patch, opt = {}) {
  if (!AC.safeAid(aid) || !AC.safeKey(sid) || !patch || typeof patch !== 'object') return Promise.resolve(false);
  const win = opt.win || globalThis;
  const parent = opt.parent !== undefined ? opt.parent : (win.parent && win.parent !== win ? win.parent : null);
  if (!parent) return directWrite(db, aid, sid, patch);
  listenAck(win);
  const id = 'r' + (++seq) + Math.random().toString(36).slice(2, 6);
  return new Promise(res => {
    const t = setTimeout(() => { if (pending.delete(id)) directWrite(db, aid, sid, patch).then(res); }, opt.ackMs || 2000);
    pending.set(id, ok => { clearTimeout(t); res(ok); });   // 부모가 '안 됨'이라 하면(닫힌 과제 · 대상 아님) 직접 쓰지 않는다
    try { parent.postMessage({ type: 'rpg:assign-report', id, aid, patch }, ORIGIN()); }
    catch (e) { clearTimeout(t); pending.delete(id); directWrite(db, aid, sid, patch).then(res); }
  });
}

//  부모 RPG 의 '선생님과 수업' 덮개 — { type:'rpg:classlive', on } · 같은 origin 의 부모가 보낸 것만
export function onClassPause(cb, win = globalThis) {
  if (!win || !win.addEventListener) return () => {};
  const f = e => {
    if (e.origin !== ORIGIN() || (win.parent && e.source && e.source !== win.parent)) return;
    const d = e.data;
    if (d && d.type === 'rpg:classlive') cb(!!d.on);
  };
  win.addEventListener('message', f);
  return () => win.removeEventListener('message', f);
}
