// 기초 코딩 · 선생님 과제 셈 [ASSIGN-CODING-1] — DOM · firebase 없음(시험 = scripts/unit/coding/assign.test.mjs)
//  과제 정의 content.coding.stages = ['2-3', '2-4'](1~3판) · 결과는 부모 학생 화면이 내 칸(classRPG_assign/results/<과제>/<나>)에 쓴다(common/assign.js reportAssign)
//  내 칸 app.detail[<판>] = { rank, ok, st 별, n 블록, tries 실행 수, why { 까닭: 수 }, py 마지막 코드(글 코드 앞 300자) }
//   rank — 푼 기록은 늘 못 푼 기록보다 크고(별 많을수록 · 블록 적을수록 큼), 못 푼 판은 실행 수가 곧 rank(실행할 때마다 새로 써진다)
//   AssignCore.appPatch 가 'rank 가 더 클 때만' 쓰므로 좋은 기록을 늦게 온 값이 덮지 않는다
export const STUCK_TRIES = 5;   // 막힘 = 못 풀고 실행 5번 이상(선생님 막힘 지도와 같은 기준)
export const PY_MAX = 300;

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const int = v => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0; };
const whyKey = w => String(w || 'etc').replace(/[^\w]/g, '_').slice(0, 20) || 'etc';

export function rankOf(ok, st, n, tries) {
  return ok ? 1e6 + Math.min(3, int(st)) * 1e4 + (9999 - Math.min(9999, int(n))) : Math.min(999999, int(tries));
}
//  내 칸에서 판마다 기록
export function detailsOf(cell) { return isObj(cell) && isObj(cell.app) && isObj(cell.app.detail) ? cell.app.detail : {}; }
//  과제 판 목록의 지금 상태 — 푼 판 수 · 다 했나 · 안 푼 첫 판 · 판마다 { ok, st, tries, stuck }
export function asgState(stages, cell) {
  const D = detailsOf(cell);
  const list = (stages || []).map(id => {
    const d = isObj(D[id]) ? D[id] : null, ok = !!(d && d.ok), tries = d ? int(d.tries) : 0;
    return { id, ok, st: ok ? Math.min(3, int(d.st)) : 0, n: d ? int(d.n) : 0, tries, stuck: !ok && tries >= STUCK_TRIES };
  });
  const solved = list.filter(x => x.ok).length;
  const first = list.findIndex(x => !x.ok);
  return { list, solved, total: list.length, done: list.length > 0 && solved >= list.length, firstOpen: first < 0 ? null : list[first].id };
}
//  이긴 카드의 '다음' — 과제 판이면 과제 차례의 다음 판(없으면 null = 과제 목록으로) · 과제 밖 판이면 undefined(보통 다음 판)
export function nextAfter(stages, id) {
  const i = (stages || []).indexOf(id);
  if (i < 0) return undefined;
  return i + 1 < stages.length ? stages[i + 1] : null;
}
//  실행 한 번 → reportAssign 에 넘길 patch · 이 판의 새 실행 수
//   run = { ok, why, n, stars } · opt = { localTries(이 창에서 센 실행 수 — 내 칸이 늦게 와도 줄지 않게), py }
export function runPatch(stages, cell, id, run, opt = {}) {
  if (!(stages || []).includes(id) || !isObj(run)) return null;
  const prev = isObj(detailsOf(cell)[id]) ? detailsOf(cell)[id] : null;
  const tries = Math.max(prev ? int(prev.tries) : 0, int(opt.localTries)) + 1;
  const ok = !!run.ok, st = ok ? Math.max(1, Math.min(3, int(run.stars))) : 0, n = int(run.n);
  const why = {};
  if (prev && isObj(prev.why)) for (const k of Object.keys(prev.why).slice(0, 12)) why[whyKey(k)] = int(prev.why[k]);
  if (!ok) { const w = whyKey(run.why); if (w in why || Object.keys(why).length < 12) why[w] = (why[w] || 0) + 1; }
  const entry = { rank: rankOf(ok, st, n, tries), ok, st, n, tries, why, py: String(opt.py || '').slice(0, PY_MAX) };
  const before = asgState(stages, cell);
  const solved = before.solved + (ok && !(prev && prev.ok) ? 1 : 0);
  const patch = { attempt: true, detail: { [id]: entry }, score: solved, total: stages.length };
  if (solved >= stages.length) patch.done = true;
  return { patch, tries };
}
