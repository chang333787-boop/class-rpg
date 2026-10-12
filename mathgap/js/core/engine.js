// 진단 엔진 — 화면과 상관없는 순수 로직 (시뮬레이션·시험에서 그대로 씀)
//
// 흐름: 원래 문제 → (틀리면) 같은 숫자로 쪼갠 단계 → 틀린 단계의 개념 확인 → 모르면 앞 개념으로 한 겹씩
// 판정: gap 처음 막힌 곳 · shaky 아래 때문에 틀림 · bridge 합치기 어려움(부분은 아는데 합치기) · unstable 불안정 · known 앎 · auto 빠르고 정확 · slow 느림 · pending 더 봐야 함
import { byId, makeItem, stepsOf, preOf, corePre, gradeIdx, lessonsOfUnit, unitLabel } from './lessons/index.js';
import { rng } from './math.js';

export const DEFAULTS = { maxItems: 30, freshDays: 30, perConcept: 3, confirmN: 3 };
const DAY = 864e5;
// 원래 문제를 맞혔을 때 더 푸는 새 숫자 문제 수 — 기본 2(엄격 3) · 보기 고르기는 찍을 수 있어 하나 더
export const VERIFY = (item, K = 3) => K - 1 + (item.choices ? 1 : 0);

const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// prior: 학생 표 { cid: { s, t } } — 최근에 '앎·자동'이면 다시 묻지 않는다
export function newSession({ id, sid, problem, prior = {}, opts = {}, now = Date.now(), answered = null }) {
  const o = { ...DEFAULTS, ...opts };
  const fresh = {};
  for (const [cid, st] of Object.entries(prior || {})) {
    if ((st.s === 'known' || st.s === 'auto' || st.s === 'slow') && now - (st.t || 0) < o.freshDays * DAY) fresh[cid] = st.s;
  }
  const S = {
    v: 1, id, sid, t0: now, opts: o,
    problem: { c: problem.c, p: problem.p, text: problem.text || '' },
    phase: 'problem', log: [], steps: [], stepIdx: 0,
    queue: [], cur: null, res: {}, fresh, seq: 0, done: false, stoppedByBudget: false,
  };
  if (answered) answer(S, answered); // 종이에 쓴 답을 선생님이 넣은 경우
  return S;
}

const asked = (S) => S.log.length;

// 차시 그물로 미루어 알기 — 위 차시를 풀었으면 그 아래(언제나 필요한 줄)는 된다 · 아래 차시가 확실히 막혔으면 위도 막힌다
const ancCache = {};
function ancestors(id) {
  if (ancCache[id]) return ancCache[id];
  const seen = new Set(), st = [id];
  while (st.length) { const x = st.pop(); for (const y of corePre(x)) if (!seen.has(y)) { seen.add(y); st.push(y); } }
  return (ancCache[id] = seen);
}
function inferOf(S, id) {
  for (const [c, r] of Object.entries(S.res)) {
    if (!r || r.inferred || r.prior || c === id) continue;
    if (r.st === 'pass' && !r.viaStep && byId[c] && ancestors(c).has(id)) return { st: 'pass', by: c };
    if (r.st === 'fail' && r.conf && ancestors(id).has(c)) return { st: 'fail', by: c };
  }
  return null;
}
function markInferred(S, id, inf, from) {
  S.res[id] = inf.st === 'pass'
    ? { ...(S.res[id] || {}), st: 'pass', inferred: true, by: inf.by, from: from || [inf.by], items: [] }
    : { ...(S.res[id] || {}), st: 'fail', inferred: true, by: inf.by, conf: true, confirmed: true, from: from || [inf.by], items: [], pre: [inf.by] };
}
function nextSeed(S) { S.seq++; return hash(`${S.id}:${S.seq}`); }

// 지금 낼 문항 { role, c, p, why?, depth?, n? } — 없으면 null(끝)
export function current(S) {
  if (S.done) return null;
  if (S.phase === 'problem') return { role: 'problem', c: S.problem.c, p: S.problem.p };
  if (S.phase === 'scan' && S.probe) return { role: 'scan', c: S.probe.c, p: S.probe.p, n: S.probe.items.length + 1 };
  if (S.phase === 'steps') { const st = S.steps[S.stepIdx]; return { role: 'step', c: st.c, p: st.p, why: st.why, n: S.stepIdx + 1, of: S.steps.length }; }
  if (S.phase === 'checks' && S.cur) return { role: 'check', c: S.cur.c, p: S.cur.p, depth: S.cur.depth, n: S.cur.items.length + 1 };
  return null;
}
export const currentItem = (S) => { const q = current(S); return q ? { ...q, item: makeItem(q.c, q.p) } : null; };

function record(S, q, a, res) {
  S.log.push({ role: q.role, c: q.c, p: q.p, vals: a.vals || [], raws: a.raws || [], idk: !!a.idk, ok: !!res.ok, bug: res.bug || null, ms: a.ms || 0, t: a.t || Date.now(), depth: q.depth || 0 });
}

// 답하기 — a = { vals:[수], raws:[글], idk:bool, ms }
export function answer(S, a) {
  const q = current(S);
  if (!q) return S;
  const item = makeItem(q.c, q.p);
  const res = a.idk ? { ok: false } : item.check(a.vals || [], a.raws || []);
  record(S, q, a, res);

  if (q.role === 'problem') {
    if (res.ok) {
      // 한 문제 맞힌 것만으로 '안다'고 하지 않는다 — 같은 개념을 새 숫자로 더 풀어 본다(verify)
      S.res[q.c] = { st: 'queued', from: [], items: [] };
      S.verifying = true; S.phase = 'checks';
      S.cur = { c: q.c, p: byId[q.c].gen(rng(nextSeed(S))), depth: 0, items: [{ ok: true, ms: a.ms || 0, p: q.p }], from: [], prefill: 1, mode: 'verify' };
      return S;
    }
    S.res[q.c] = { st: 'fail', from: [], items: [{ ok: false, ms: a.ms || 0 }], lastP: q.p, bugs: res.bug ? [res.bug] : [] };
    S.steps = stepsOf(q.c, q.p);
    if (S.steps.length) { S.phase = 'steps'; S.stepIdx = 0; return S; }
    // 쪼갤 단계가 없는 개념 — 같은 개념을 새 숫자로 한두 문항 더 확인하고, 모르면 앞 개념으로
    S.res[q.c].st = 'queued';
    enqueue(S, q.c, 1, null, 'problem');
    [].concat((res.bug && res.bug.to) || []).forEach((cid) => enqueue(S, cid, 2, q.c, 'bug'));
    return startChecks(S);
  }

  if (q.role === 'step') {
    const st = S.steps[S.stepIdx];
    st.ok = res.ok; st.bug = res.bug || null; st.idk = !!a.idk;
    S.stepIdx++;
    if (S.stepIdx < S.steps.length) return S;
    // 단계가 끝남 — 틀린 단계의 개념과 오답 모양이 가리키는 개념을 확인할 차례
    const bad = S.steps.filter((x) => !x.ok);
    const pb = S.res[S.problem.c].bugs || [];
    pb.forEach((b) => [].concat(b.to || []).forEach((cid) => enqueue(S, cid, 1, S.problem.c, 'bug')));
    bad.forEach((x) => { enqueue(S, x.c, 1, S.problem.c, 'step', x.p); [].concat((x.bug && x.bug.to) || []).forEach((cid) => enqueue(S, cid, 2, x.c, 'bug')); });
    // 단계로 다루지 않은 앞 개념도 확인한다 — 앞 개념이 다 있어야 '다리'라고 말할 수 있다
    const stepCs = new Set(S.steps.map((x) => x.c));
    S.uncovered = preOf(S.problem.c, S.res[S.problem.c].lastP || S.problem.p).filter((c) => !stepCs.has(c));
    S.uncovered.forEach((cid) => enqueue(S, cid, 1, S.problem.c, 'pre'));
    return startChecks(S);
  }

  if (q.role === 'scan') return answerScan(S, q, a, res);

  // check
  const cur = S.cur;
  cur.items.push({ ok: res.ok, ms: a.ms || 0, idk: !!a.idk, bug: res.bug || null, p: q.p });
  if (!res.ok) cur.lastBadP = q.p;
  const it0 = makeItem(cur.c, cur.p), needPass = it0.choices ? 3 : 2;
  const fresh = cur.items.slice(cur.prefill || 0);
  const okRun = fresh.filter((x) => x.ok).length;
  let verdict = null;
  if (cur.mode === 'verify') {
    // 원래 문제를 맞힌 뒤: 새 숫자 2문제(보기 고르기는 3문제)를 이어서 맞히면 앎.
    // 하나라도 틀리면 '한 번 틀린 개념'과 같은 규칙(새 숫자 K문제 더)으로 넘어간다
    if (!res.ok) { cur.mode = 'recheck'; cur.prefill = cur.items.length; cur.lastBadP = q.p; }
    else if (fresh.length >= VERIFY(it0, S.opts.confirmN || 3)) verdict = 'pass';
  } else if (cur.mode === 'confirm' || cur.mode === 'recheck') {
    // 한 번 틀렸던 개념을 새 숫자로 3문항 더: 3개 다 맞으면 실수, 2개면 불안정, 그보다 적으면 모름 (2번 틀리면 바로 끝)
    const conf = cur.items.slice(cur.prefill || 0), okC = conf.filter((x) => x.ok).length, badC = conf.length - okC;
    const K = S.opts.confirmN || 3;               // 3(기본) 또는 4(엄격)
    if (badC >= 2) verdict = 'fail';
    else if (conf.length >= K) verdict = okC === K ? 'pass' : 'unstable';
  } else if (!res.ok && fresh.slice(0, -1).some((x) => x.ok)) {
    // 맞히다가 틀림 → 실수일 수 있으니 그 자리에서 실수 규칙(새 숫자 K문제)으로 본다
    cur.mode = 'recheck'; cur.prefill = cur.items.length; cur.lastBadP = q.p;
  } else if (!res.ok) verdict = 'fail';           // 처음부터 틀리면 바로 한 겹 아래로 (확인은 끝에서)
  else if (okRun >= needPass && fresh.every((x) => x.ok)) verdict = 'pass';
  if (verdict) return concludeCheck(S, verdict);
  cur.p = byId[cur.c].gen(rng(nextSeed(S)));
  return S;
}

function enqueue(S, cid, depth, from, why, p = null) {
  if (!byId[cid]) return;
  const r = S.res[cid];
  if (r && from) { if (!r.from.includes(from)) r.from.push(from); }
  if (r && r.st !== 'queued') return;
  if (S.queue.some((x) => x.c === cid)) { const x = S.queue.find((y) => y.c === cid); if (from && !x.from.includes(from)) x.from.push(from); if (why === 'bug') x.pri = 0; return; }
  S.queue.push({ c: cid, depth, from: from ? [from] : [], pri: why === 'bug' ? 0 : 1, p });
  S.res[cid] = S.res[cid] || { st: 'queued', from: from ? [from] : [], items: [] };
}

function startChecks(S) { S.phase = 'checks'; return pickNext(S); }

function pickNext(S) {
  S.cur = null;
  while (S.queue.length) {
    if (asked(S) >= S.opts.maxItems) { S.stoppedByBudget = true; break; }
    // 얕은 겹부터, 같은 겹이면 오답 모양이 가리킨 것 먼저, 그다음 높은 학년(문제에 가까운 것) 먼저
    S.queue.sort((a, b) => a.depth - b.depth || a.pri - b.pri || gradeIdx(byId[b.c].g) - gradeIdx(byId[a.c].g));
    const x = S.queue.shift();
    const r = S.res[x.c];
    if (r.st !== 'queued') continue;
    // 최근 기록에서 '앎'이거나, 이번에 단계에서 맞힌 개념이면 묻지 않는다
    if (S.fresh[x.c]) { r.st = 'pass'; r.prior = S.fresh[x.c]; continue; }
    const inf = inferOf(S, x.c);
    if (inf) { markInferred(S, x.c, inf, r.from); continue; }
    const stepsOfC = S.steps.filter((st) => st.c === x.c);
    const stepOk = stepsOfC.length && stepsOfC.every((st) => st.ok) && !makeItem(stepsOfC[0].c, stepsOfC[0].p).choices;
    if (stepOk && x.c !== S.problem.c) { r.st = 'pass'; r.viaStep = true; continue; }
    const p = byId[x.c].gen(rng(nextSeed(S)));
    S.cur = { c: x.c, p, depth: x.depth, items: [], from: x.from };
    // 원래 문제의 개념을 다시 확인할 때는 원래 문제의 오답을 한 문항으로 친다
    if (x.c === S.problem.c && !S.steps.length) {
      const l0 = S.log.find((l) => l.role === 'problem');
      if (l0) { S.cur.items.push({ ok: false, ms: l0.ms, idk: l0.idk, bug: l0.bug, p: l0.p }); S.cur.lastBadP = l0.p; S.cur.prefill = 1; S.cur.mode = 'recheck'; }
    }
    return S;
  }
  // 막힌 차시 아래를 반씩 좁혀 찾기 (찾기마다 뿌리 하나)
  while (!S.cur && !S.stoppedByBudget && (S.jobs || []).some((j) => !j.done)) {
    const j = S.jobs.find((x) => !x.done);
    const y = nextInJob(S, j);
    if (!y) { j.done = true; continue; }
    if (asked(S) >= S.opts.maxItems) { S.stoppedByBudget = true; S.res[y] = S.res[y] || { st: 'pending', from: [j.x], items: [] }; if (S.res[y].st === 'queued') S.res[y].st = 'pending'; break; }
    if (!S.res[y]) S.res[y] = { st: 'queued', from: [j.x], items: [] };
    else if (!S.res[y].from.includes(j.x)) S.res[y].from.push(j.x);
    S.res[y].st = 'queued';
    S.cur = { c: y, p: byId[y].gen(rng(nextSeed(S))), depth: j.depth + 1, items: [], from: [j.x], job: j };
    return S;
  }
  if (!S.cur && !S.stoppedByBudget && asked(S) < S.opts.maxItems) {
    const cid = confirmCandidate(S);
    if (cid) {
      const r = S.res[cid];
      r.confirmed = true;
      S.cur = { c: cid, p: byId[cid].gen(rng(nextSeed(S))), depth: r.depth || 1, items: [], from: r.from, mode: 'confirm' };
      return S;
    }
  }
  if (!S.cur) return finish(S);
  return S;
}

function concludeCheck(S, verdict) {
  const cur = S.cur, r = S.res[cur.c];
  const allItems = cur.mode === 'confirm' ? [...(r.items || []), ...cur.items] : cur.items;
  r.st = verdict; r.items = allItems; r.depth = cur.depth;
  const bad = allItems.filter((x) => !x.ok);
  r.conf = verdict === 'fail' && (bad.length >= 2 || bad.some((x) => x.idk));
  if (verdict === 'pass' && (cur.mode === 'confirm' || cur.mode === 'recheck')) r.slip = true;
  // 원래 문제를 맞혔는데 새 숫자로는 못 풂 → 그 문제를 같은 숫자로 쪼개 본다
  if (verdict === 'fail' && cur.c === S.problem.c && S.verifying) {
    const badP = cur.lastBadP || cur.p, steps = stepsOf(cur.c, badP);
    r.lastP = badP; r.bugs = cur.items.map((x) => x.bug).filter(Boolean);
    if (steps.length) { S.steps = steps; S.stepIdx = 0; S.phase = 'steps'; S.cur = null; return S; }
  }
  if (verdict === 'fail' && cur.mode !== 'confirm') {
    r.lastP = cur.lastBadP || cur.p;
    const bugs = cur.items.map((x) => x.bug).filter(Boolean);
    r.bugs = bugs;
    const pre = preOf(cur.c, r.lastP);
    r.pre = pre;
    spawnJob(S, cur.c, pre, bugs, cur.depth);
  }
  // 실수 규칙으로 '실수'가 된 차시가 어느 찾기의 마지막 막힘이었다면 → 그 찾기를 다시 연다
  if (verdict === 'pass' && cur.mode === 'confirm') (S.jobs || []).forEach((j) => { if (j.lastFail === cur.c) { j.lastFail = null; j.done = false; j.cand = jobCand(S, j.x, preOf(j.x, (S.res[j.x] || {}).lastP)); } });
  return pickNext(S);
}

// ── 반씩 좁혀 찾기: 막힌 차시 X의 아래(앞 차시들과 그 아래 전부)에서, 남은 후보를 반으로 가르는 차시를 물어본다
//   통과 → 그 차시와 그 아래는 된다(후보에서 뺌) · 막힘 → 뿌리는 그 차시나 그 아래에 있다(후보를 그 아래로 좁힘)
//   후보가 없어지면 마지막으로 막힌 차시(없으면 X)가 처음 막힌 곳
//   후보는 배열로 둔다 — 세션을 JSON 으로 저장했다 이어 갈 때 Set 은 {} 가 되어 깨진다
function jobCand(S, x, pre) {
  const cand = new Set();
  (pre || []).forEach((y) => { if (!byId[y]) return; cand.add(y); ancestors(y).forEach((a) => cand.add(a)); });
  cand.delete(x);
  return [...cand];
}
function spawnJob(S, x, pre, bugs, depth = 0) {
  S.jobs = S.jobs || [];
  if (S.jobs.some((j) => j.x === x && !j.done)) return;
  const prio = [].concat(...(bugs || []).map((b) => [].concat(b.to || []))).filter((y) => byId[y]);
  S.jobs.push({ x, cand: jobCand(S, x, pre), prio, lastFail: null, done: false, depth });
}
function nextInJob(S, j) {
  // 이미 알게 된 것으로 후보 줄이기
  let changed = true, cand = new Set(j.cand);
  while (changed) {
    changed = false;
    for (const c of [...cand]) {
      let r = S.res[c];
      if (!r || r.st === 'queued') { const inf = inferOf(S, c); if (inf) { markInferred(S, c, inf); r = S.res[c]; } }
      if (!r || r.st === 'queued') continue;
      if (r.prior || r.st === 'pass' || r.st === 'unstable') { cand.delete(c); ancestors(c).forEach((a) => cand.delete(a)); changed = true; }
      else if (r.st === 'fail') {
        cand.delete(c);
        if (!r.inferred) { const below = new Set(jobCand(S, c, r.pre || preOf(c, r.lastP))); cand = new Set([...cand].filter((a) => below.has(a))); j.lastFail = c; }
        changed = true;
      } else { cand.delete(c); changed = true; }      // pending
    }
  }
  j.cand = [...cand];
  if (!cand.size) return null;
  const list = [...cand], n = list.length;
  const hit = j.prio.find((y) => cand.has(y));
  if (hit) { j.prio = j.prio.filter((y) => y !== hit); return hit; }
  let best = null, bestScore = -1;
  for (const y of list) {
    const below = list.filter((a) => ancestors(y).has(a)).length;
    const score = Math.min(below + 1, n - below);
    if (score > bestScore || (score === bestScore && below > best.below)) { best = { y, below }; bestScore = score; }
  }
  return best.y;
}

// 앞 개념은 다 아는데 한 번만 틀린 개념 → 끝에서 한 번 더 확인 (실수로 빈칸이 되지 않게)
function confirmCandidate(S) {
  for (const [cid, r] of Object.entries(S.res)) {
    if (r.st !== 'fail' || r.conf || r.confirmed || cid === S.problem.c) continue;
    const pre = r.pre || preOf(cid, r.lastP);
    if (pre.every((x) => S.res[x] && (S.res[x].st === 'pass' || S.res[x].st === 'unstable'))) return cid;
  }
  return null;
}

function finish(S) {
  S.phase = 'done'; S.done = true; S.cur = null;
  S.queue.forEach((x) => { if (S.res[x.c] && S.res[x.c].st === 'queued') S.res[x.c].st = 'pending'; });
  S.queue = [];
  S.result = classify(S);
  return S;
}

// 선생님이 중간에 그만하기 — 남은 것은 '더 확인'으로 두고 판정한다
export function stop(S) {
  if (S.done) return S;
  if (S.cur) { const r = S.res[S.cur.c]; if (r && (r.st === 'queued')) r.st = 'pending'; }
  if (S.phase === 'scan' && S.probe && !S.res[S.probe.c]) S.res[S.probe.c] = { st: 'pending', from: ['unit'], items: S.probe.items };
  S.stoppedByUser = true;
  if (S.phase === 'problem') { S.phase = 'done'; S.done = true; S.result = classify(S); return S; }
  // 아직 안 푼 단계는 '더 확인'으로 남긴다
  S.steps.forEach((st) => { if (st.ok === undefined && !S.res[st.c]) S.res[st.c] = { st: 'pending', from: [S.problem.c], items: [] }; });
  return finish(S);
}

// 판정
export function classify(S) {
  const R = S.res, out = {}, C0 = S.problem.c;
  const statusOf = (cid) => (R[cid] ? R[cid].st : null);
  for (const [cid, r] of Object.entries(R)) {
    if (r.st === 'pass' || r.st === 'unstable') {
      if (r.prior) { out[cid] = { s: r.prior, prior: true }; continue; }
      if (r.inferred) { out[cid] = { s: 'known', inferred: true }; continue; }
      const c = byId[cid], ms = r.items.filter((x) => x.ok && x.ms).map((x) => x.ms).sort((a, b) => a - b);
      const med = ms.length ? ms[Math.floor(ms.length / 2)] : 0;
      const lim = c.sec * 1000;
      if (r.st === 'unstable') { out[cid] = { s: 'unstable', ms: med, note: `한 번 틀린 뒤 새 문제 ${S.opts.confirmN || 3}개 중 ${(S.opts.confirmN || 3) - 1}개만 맞혔어요.` }; continue; }
      let s = 'known';
      if (!r.viaStep && med) { if (med > lim * 2) s = 'slow'; else if (c.fact && med <= lim) s = 'auto'; }
      out[cid] = { s, viaStep: !!r.viaStep, ms: med, slip: !!r.slip };
    } else if (r.st === 'fail') {
      if (cid === C0 && S.steps.length) continue; // 아래에서 따로
      const pre = r.pre || preOf(cid, r.lastP);
      const ps = pre.map(statusOf);
      if (r.inferred) { out[cid] = { s: 'shaky', because: [r.by || pre[0]].filter(Boolean), inferred: true }; continue; }
      // 반씩 좁혀 찾았으면 앞 차시를 다 묻지 않았을 수 있다 → 그 아래 어딘가가 막혔으면 '아래 때문에 틀림'
      const belowFail = [...jobCand(S, cid, pre)].filter((x) => statusOf(x) === 'fail');
      const unknown = pre.filter((x) => !R[x] || !R[x].st);
      if (!ps.some((x) => x === 'fail') && belowFail.length) { out[cid] = { s: 'shaky', because: belowFail.filter((x) => !R[x].inferred).slice(0, 3) }; continue; }
      if (!r.conf && !r.confirmed && !ps.some((x) => x === 'fail')) { out[cid] = { s: 'pending', note: '한 번만 틀렸어요 — 실수인지 더 확인해야 해요' }; continue; }
      if (!ps.some((x) => x === 'fail') && unknown.length) { out[cid] = { s: 'pending', note: '앞 차시 확인이 남았어요' }; continue; }
      if (ps.some((x) => x === 'fail')) out[cid] = { s: 'shaky', because: pre.filter((x) => statusOf(x) === 'fail') };
      else if (ps.some((x) => x === 'pending' || x === 'queued')) out[cid] = { s: 'pending', note: '앞 개념 확인이 남았어요' };
      else out[cid] = { s: 'gap' };
    } else if (r.st === 'pending' || r.st === 'queued') {
      out[cid] = { s: 'pending' };
    }
  }
  // 원래 문제
  const r0 = R[C0];
  if (r0 && r0.st === 'fail' && S.steps.length) {
    const badSteps = S.steps.filter((x) => x.ok === false).map((x) => x.c);
    const unanswered = S.steps.filter((x) => x.ok === undefined).map((x) => x.c);
    const below = [...new Set([...badSteps, ...unanswered, ...(S.uncovered || [])])];
    const stillBad = below.filter((c) => out[c] && ['gap', 'shaky'].includes(out[c].s));
    const open = below.filter((c) => !out[c] || out[c].s === 'pending');
    if (stillBad.length) out[C0] = { s: 'shaky', because: stillBad };
    else if (open.length) out[C0] = { s: 'pending', note: '단계와 앞 개념을 다 확인하지 못했어요.' };
    else if (!badSteps.length) out[C0] = { s: 'bridge', note: '단계도 앞 개념도 모두 맞혔어요. 합쳐서 푸는 것이 빈칸이에요.' };
    else out[C0] = { s: 'bridge', note: '틀린 단계를 따로 물으니 맞혔어요. 문제 안에서 이어 쓰는 것이 빈칸이에요.' };
  }
  const by = (s) => Object.keys(out).filter((k) => out[k].s === s).sort((a, b) => gradeIdx(byId[a].g) - gradeIdx(byId[b].g));
  const bugs = [];
  S.log.forEach((l) => { if (l.bug && l.bug.name) bugs.push({ c: l.c, name: l.bug.name, to: l.bug.to, role: l.role }); });
  return {
    states: out,
    roots: by('gap'), bridges: by('bridge'), shaky: by('shaky'), pending: by('pending'),
    known: [...by('auto'), ...by('known'), ...by('slow')], unstable: by('unstable'),
    bugs, items: S.log.length, ms: S.log.reduce((a, l) => a + (l.ms || 0), 0), budget: S.stoppedByBudget,
    unit: S.unit || null, boundaries: S.boundaries || [], chains: S.chains || null,
  };
}

// ── 단원 점검: 단원 안 차시들에서 '여기까지는 되고 여기부터 막힘'을 찾는다
//   차시는 prev(짧은 줄)로 이어진 갈래들. 갈래마다 맨 위 차시를 먼저 보고(되면 갈래 전체 통과),
//   안 되면 반씩 좁혀 경계를 찾는다. 경계 차시는 그 차시의 긴 줄(옛 단원 차시)을 확인하며 아래로 내려간다.
//   한 차시 확인 = 새 숫자 2문제(보기 3문제) 연속 정답이면 통과 · 하나 틀리면 실수 규칙(K문제 더)
export function chainsOf(unit) {
  const ids = lessonsOfUnit(unit);
  const inU = new Set(ids), kids = {};
  ids.forEach((x) => { const pv = byId[x].prev; if (pv && inU.has(pv)) (kids[pv] = kids[pv] || []).push(x); });
  const heads = ids.filter((x) => !byId[x].prev || !inU.has(byId[x].prev));
  const chains = [];
  const walk = (start) => {
    const ch = [start];
    let last = start;
    while (kids[last] && kids[last].length) { const [first, ...rest] = kids[last]; rest.forEach(walk); ch.push(first); last = first; }
    chains.push(ch);
  };
  heads.forEach(walk);
  return chains.sort((a, b) => byId[a[0]].n - byId[b[0]].n);
}
export function newUnitScan({ id, sid, unit, prior = {}, opts = {}, now = Date.now() }) {
  const ids = lessonsOfUnit(unit);
  if (!ids.length) throw new Error('이 단원에는 문제로 재는 차시가 없어요.');
  const top = ids[ids.length - 1];
  const S = newSession({ id, sid, problem: { c: top, p: null, text: unitLabel(unit) }, prior, opts, now });
  S.mode = 'unit'; S.unit = unit; S.phase = 'scan';
  S.chains = chainsOf(unit);
  S.scan = S.chains.map((ch) => ({ lo: -1, hi: ch.length, topTried: false }));
  S.boundaries = [];
  return nextProbe(S);
}
function nextProbe(S) {
  S.probe = null;
  for (let k = 0; k < S.chains.length; k++) {
    const ch = S.chains[k], st = S.scan[k];
    while (st.hi - st.lo > 1) {
      if (asked(S) >= S.opts.maxItems) { S.stoppedByBudget = true; return endScan(S); }
      const idx = !st.topTried ? ch.length - 1 : (st.lo + st.hi) >> 1;
      st.topTried = true;
      const c = ch[idx];
      if (S.fresh[c]) { S.res[c] = { st: 'pass', prior: S.fresh[c], from: ['unit'], items: [] }; st.lo = idx; continue; }
      if (S.res[c] && S.res[c].st) { if (S.res[c].st === 'pass') st.lo = idx; else st.hi = idx; continue; }
      const inf = inferOf(S, c);
      if (inf) { markInferred(S, c, inf, ['unit']); if (inf.st === 'pass') st.lo = idx; else st.hi = idx; continue; }
      S.probe = { c, p: byId[c].gen(rng(nextSeed(S))), items: [], k, idx, mode: 'probe' };
      return S;
    }
  }
  return endScan(S);
}
function answerScan(S, q, a, res) {
  const pr = S.probe;
  pr.items.push({ ok: !!res.ok, ms: a.ms || 0, idk: !!a.idk, bug: res.bug || null, p: q.p });
  if (!res.ok) pr.lastBadP = q.p;
  const it0 = makeItem(pr.c, pr.p), needPass = it0.choices ? 3 : 2;
  // 점검 한 차시: 2문제 연속 정답 = 통과 · 2번 틀리면 막힘 · 1번 틀린 뒤 K문제 연속 정답 = 실수로 통과
  let verdict = null;
  const bad = pr.items.filter((x) => !x.ok).length, K = S.opts.confirmN || 3;
  if (bad >= 2) verdict = 'fail';
  else if (bad === 0 && pr.items.length >= needPass) verdict = 'pass';
  else if (bad === 1) { const after = pr.items.slice(pr.items.findIndex((x) => !x.ok) + 1); if (after.length >= K) { verdict = 'pass'; pr.mode = 'slip'; } }
  if (!verdict) { pr.p = byId[pr.c].gen(rng(nextSeed(S))); return S; }
  const r = S.res[pr.c] = { st: verdict, from: ['unit'], items: pr.items, probe: true, conf: true, confirmed: true, depth: 0 };
  if (verdict === 'pass' && pr.mode === 'slip') r.slip = true;
  if (verdict !== 'pass') { r.lastP = pr.lastBadP || pr.p; r.pre = preOf(pr.c, r.lastP); r.bugs = pr.items.map((x) => x.bug).filter(Boolean); }
  const st = S.scan[pr.k];
  if (verdict === 'pass') st.lo = pr.idx; else st.hi = pr.idx;
  return nextProbe(S);
}
function endScan(S) {
  S.probe = null;
  S.chains.forEach((ch, k) => {
    const st = S.scan[k], f = st.hi;
    // 경계 아래(안 물어본 차시)는 위 차시가 되니 됨으로 본다 · 경계 위는 경계가 막혀 같이 막힌 것으로 본다
    for (let i = 0; i < f && i < ch.length; i++) if (!S.res[ch[i]]) S.res[ch[i]] = { st: 'pass', inferred: true, from: ['unit'], items: [] };
    if (f >= ch.length || st.hi - st.lo > 1) return;     // 갈래 전체 통과 · 또는 예산으로 못 끝냄
    const L = ch[f];
    for (let i = f + 1; i < ch.length; i++) if (!S.res[ch[i]]) S.res[ch[i]] = { st: 'fail', inferred: true, conf: true, confirmed: true, from: [L], items: [], pre: [L] };
    if (!S.boundaries.includes(L)) S.boundaries.push(L);
    const r = S.res[L];
    if (r && (r.st === 'fail' || r.st === 'unstable')) spawnJob(S, L, r.pre || preOf(L, r.lastP), r.bugs || [], 0);
  });
  S.phase = 'checks';
  return pickNext(S);
}

// 이어서 하기 — 남은(pending) 개념을 새 세션의 출발점으로
export function continueSession(prev, { id, now = Date.now(), prior = {} }) {
  const S = newSession({ id, sid: prev.sid, problem: prev.problem, prior, opts: prev.opts, now });
  S.phase = 'checks'; S.cont = prev.id;
  if (prev.mode) { S.mode = prev.mode; S.unit = prev.unit; S.boundaries = (prev.boundaries || []).slice(); S.chains = prev.chains; }
  const pend = Object.entries(prev.res).filter(([, r]) => r.st === 'pending').map(([c]) => c);
  // 앞 세션의 판정을 그대로 들고 온다 (pass·fail)
  for (const [cid, r] of Object.entries(prev.res)) if (r.st === 'pass' || r.st === 'fail') S.res[cid] = { ...r, copied: true };
  S.steps = prev.steps || []; S.uncovered = prev.uncovered || [];
  pend.forEach((c) => enqueue(S, c, 1, null, 'pre'));
  return pickNext(S);
}

// 학생 표에 이번 결과를 합친다
export function mergeStates(states, S, now = Date.now()) {
  const out = { ...states };
  const res = S.result ? S.result.states : {};
  for (const [cid, v] of Object.entries(res)) {
    if (v.prior) continue;
    // 미루어 안 것(위 차시를 풀어서 앎 · 경계가 막혀 위도 막힘)은 직접 확인한 기록을 덮지 않고 '미루어 앎'으로만 남긴다
    if (v.inferred) { const old = out[cid] || {}; if (!old.s || old.inf || v.s === 'known') out[cid] = { s: v.s, t: now, inf: true, h: old.h || [] }; continue; }
    const old = out[cid] || {};
    if (S.res[cid] && S.res[cid].copied && old.s === v.s) continue;
    const items = (S.res[cid] && S.res[cid].items) || [];
    const hist = [...(old.h || []), { t: now, s: v.s, sess: S.id, ok: items.filter((x) => x.ok).length, n: items.length }].slice(-12);
    // 단계에서 한 번 맞힌 것만으로는 예전의 빈칸을 덮지 않는다
    if (v.viaStep && old.s && ['gap', 'shaky', 'bridge'].includes(old.s)) { out[cid] = { ...old, h: hist }; continue; }
    out[cid] = { s: v.s, t: now, h: hist };
  }
  return out;
}
