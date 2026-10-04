// student/assign.js — 선생님 과제 · 선생님과 수업 [CLASS-ASSIGN-1] [CLASS-LIVE-1]
//  · 홈 '오늘' 맨 위 '선생님 과제' 카드 → 과제함 창(#m-assign · 학습 창과 같은 모양)에서 풀기
//  · '지금 모두 같이' → 무엇을 하든 맨 위에 수업 덮개(#class-live · z 100000). 밑의 화면은 지우지 않고 멈춰 둔다 · 아이는 못 나간다 · 선생님이 끝낸다
//  · 저장 = classRPG_assign(classRPG_v3 밖) — 내 결과 칸(results/<과제>/<나>) · 내 숙달도 칸(mine/<나>) 아래 경로만 update. 학생 기록(saveStudent) 0번
//  · 규칙 · 셈은 common/assign-core.js(AssignCore) 한 곳 · 설계 = docs/class_assign_design.md
//  · 전역 이름 머리 = asg · _asg · classLive(겹침 검사 global-dup)

const _ASG = {
  booted: false, db: null, offs: [], timer: 0,
  live: null, hosts: null, openRaw: null, open: {}, connected: false, offset: 0,
  sid: '', sidOffs: [], cells: {}, cellReady: {}, cellOffs: {}, mine: null, mineRecs: null,
  excAid: '', excOff: null, excused: false,
  inst: { i: null, l: null }, lastTodo: -1,
  conn: 'c' + Math.random().toString(36).slice(2, 8),
};
const _asgLv = { open: false, aid: '', prevFocus: null, overflow: '', pushed: false, presRef: null, focusTimer: 0, deferLv: 0 };
const ASG_NUM = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];

// ── 연결 ──────────────────────────────────────────────
function _asgRef(p) { return _ASG.db.ref(AssignCore.path.full(p)); }
function _asgTS() { return firebase.database.ServerValue.TIMESTAMP; }
function _asgNow() { return Date.now() + (_ASG.offset || 0); }
//  페이지가 뜨면(로그인 전에도) 수업 상태 · 교사 기기 · 열린 과제를 듣는다 — 로그인 화면 '수업 중' 띠와 늦게 들어온 아이의 바로 입장
function asgBoot() {
  if (_ASG.booted) return true;
  try {
    if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length || typeof AssignCore === 'undefined') return false;
    _ASG.db = firebase.database();
  } catch (e) { return false; }
  _ASG.booted = true;
  const on = (p, cb, raw) => {
    const r = raw ? _ASG.db.ref(p) : _asgRef(p);
    const f = r.on('value', s => { try { cb(s.val()); } catch (e) { console.warn('[CLASS-ASSIGN-1]', e); } }, e => console.warn('[CLASS-ASSIGN-1]', p, e));
    _ASG.offs.push(() => r.off('value', f));
  };
  on('.info/serverTimeOffset', v => { _ASG.offset = Number(v) || 0; }, true);
  on('.info/connected', v => {
    const was = _ASG.connected; _ASG.connected = v === true;
    if (_ASG.connected && !was) { if (_asgLv.open) _asgPresenceOn(_asgLv.aid); _asgOutboxFlush(); }
    _asgLiveSync();
  }, true);
  on(AssignCore.path.live, v => { _ASG.live = v; _asgExcusedWatch(); _asgLiveSync(); });
  on(AssignCore.path.hosts, v => { _ASG.hosts = v; _asgLiveSync(); });
  on('open', v => { _ASG.openRaw = v; _asgOnOpen(); });
  _ASG.timer = setInterval(() => { try { _asgLiveSync(); } catch (e) {} }, 10000);   // 시간으로 바뀌는 것(교사 기기 3분 · 안전 끝)
  return true;
}
if (typeof window !== 'undefined' && window.addEventListener) {
  //  DB.init 의 첫 줄이 앱을 만든다 — load 뒤 한 박자 기다렸다가(없으면 몇 번 더) 붙는다
  window.addEventListener('load', () => { let n = 0; const t = () => { if (!asgBoot() && ++n < 40) setTimeout(t, 250); }; setTimeout(t, 0); });
}

//  enterGame 에서(로그인 · 다른 아이로 바꿈) — 내 칸들을 다시 맞춘다
function asgEnter() {
  asgBoot();
  const sid = (typeof CUR !== 'undefined' && CUR && CUR.id) || '';
  if (!_ASG.db || !sid) return;
  if (_ASG.sid !== sid) {
    _ASG.sidOffs.forEach(f => f()); _ASG.sidOffs = [];
    Object.values(_ASG.cellOffs).forEach(f => f()); _ASG.cellOffs = {}; _ASG.cells = {}; _ASG.cellReady = {};
    _ASG.mine = null; _ASG.mineRecs = null;
    if (_ASG.excOff) { _ASG.excOff(); _ASG.excOff = null; } _ASG.excAid = ''; _ASG.excused = false;
    _ASG.sid = sid;
    if (AssignCore.safeKey(sid)) {
      const r = _asgRef(AssignCore.path.mine(sid));
      const f = r.on('value', s => {
        _ASG.mine = s.val(); _ASG.mineRecs = null;
        if (typeof invalidateMastery === 'function') invalidateMastery();   // 함께 푼 문제가 별 · 복습에 바로
      }, e => console.warn('[CLASS-ASSIGN-1] mine', e));
      _ASG.sidOffs.push(() => r.off('value', f));
    }
  }
  if (_ASG.inst.i && !_asgInboxShown()) _asgInstStop('i');
  _asgSyncCells(); _asgExcusedWatch(); _asgOutboxFlush();
  _ASG.lastTodo = -1;
  _asgLiveSync();
}

//  열린 과제 목록이 바뀜 — 모양 검사(normDef) 뒤 내 칸 구독 · 카드 · 덮개 · 실행기를 맞춘다
function _asgOnOpen() {
  const next = {};
  const raw = _ASG.openRaw && typeof _ASG.openRaw === 'object' ? _ASG.openRaw : {};
  for (const aid of Object.keys(raw).slice(0, 40)) { const d = AssignCore.normDef(raw[aid], aid); if (d) next[aid] = d; }
  _ASG.open = next;
  for (const k of ['i', 'l']) {
    const st = _ASG.inst[k];
    if (!st) continue;
    if (next[st.aid]) st.def = next[st.aid];
    else if (!st.closed) { st.closed = true; _asgRender(k, true); }
  }
  _asgSyncCells();
  _asgRefreshHome();
  _asgLiveSync();
}
function _asgMyDefs() {
  const sid = _ASG.sid;
  if (!sid) return [];
  return Object.values(_ASG.open).filter(d => AssignCore.isTarget(d, sid)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
function _asgSyncCells() {
  const sid = _ASG.sid;
  if (!_ASG.db || !sid || !AssignCore.safeKey(sid)) return;
  const want = new Set(_asgMyDefs().map(d => d.id));
  for (const k of ['i', 'l']) if (_ASG.inst[k]) want.add(_ASG.inst[k].aid);
  for (const aid of want) {
    if (_ASG.cellOffs[aid]) continue;
    const r = _asgRef(AssignCore.path.result(aid, sid));
    const f = r.on('value', s => { _ASG.cells[aid] = s.val(); _ASG.cellReady[aid] = true; _asgOnCell(aid); }, e => console.warn('[CLASS-ASSIGN-1] cell', e));
    _ASG.cellOffs[aid] = () => r.off('value', f);
  }
  for (const aid of Object.keys(_ASG.cellOffs)) if (!want.has(aid)) { _ASG.cellOffs[aid](); delete _ASG.cellOffs[aid]; delete _ASG.cells[aid]; delete _ASG.cellReady[aid]; }
}
function _asgOnCell(aid) {
  for (const k of ['i', 'l']) { const st = _ASG.inst[k]; if (st && st.aid === aid) _asgRender(k, false); }
  _asgRefreshHome();
}
function _asgExcusedWatch() {
  const live = _ASG.live, sid = _ASG.sid;
  const aid = live && live.on === true && AssignCore.safeAid(live.aid) && sid && AssignCore.safeKey(sid) ? live.aid : '';
  if (aid === _ASG.excAid) return;
  if (_ASG.excOff) { _ASG.excOff(); _ASG.excOff = null; }
  _ASG.excAid = aid; _ASG.excused = false;
  if (!aid || !_ASG.db) return;
  const r = _asgRef(AssignCore.path.excused(aid, sid));
  const f = r.on('value', s => { _ASG.excused = s.val() === true; _asgLiveSync(); });
  _ASG.excOff = () => r.off('value', f);
}

// ── 홈 카드 ───────────────────────────────────────────
//  buildMainHTML 이 '오늘' 머리 바로 아래에 부른다(데스크톱 · 폰 두 판). 바뀌면 .home-assign 안만 다시 쓴다.
function buildAssignCardsHTML() { return `<div class="home-assign" style="display:contents">${_asgCardsInner()}</div>`; }
function _asgIsLiveAid(aid) { return !!(_ASG.live && _ASG.live.on === true && _ASG.live.aid === aid); }
function _asgProgress(def) {
  const cell = _ASG.cells[def.id];
  if (def.kind === 'quiz') { const n = AssignCore.answeredCount(def, cell); return { n, done: n >= def.n }; }
  return { n: cell && cell.app && cell.app.attempts ? 1 : 0, done: !!(cell && cell.doneAt) };
}
//  '오늘 할 일' 수에 더하는 것 — 안 끝낸 과제
function assignTodoCount() { return _asgMyDefs().filter(d => !_asgProgress(d).done).length; }
function _asgCardsInner() {
  const list = _asgMyDefs();
  if (!list.length) return '';
  const left = list.filter(d => !_asgProgress(d).done).length;
  const row = d => {
    const p = _asgProgress(d), live = _asgIsLiveAid(d.id) && d.deliver === 'live';
    const icon = d.kind === 'coding' ? '🧩' : d.kind === 'music' ? '🎵' : '📝';
    const what = d.kind === 'quiz' ? `문제 ${d.n}개` : d.kind === 'coding' ? `기초 코딩 ${d.n}판` : '음악실 리듬';
    const sub = live ? '선생님과 수업 중이에요' : p.done ? '다 했어요 ✓' : p.n ? (d.kind === 'quiz' ? `${p.n}개 했어요` : '하는 중') : '아직 안 했어요';
    const btn = live ? '' : `<button class="asg-card-btn${p.done ? ' done' : ''}" onclick="event.stopPropagation();asgOpenInbox('${d.id}')">${p.done ? '다시 보기' : p.n ? '이어 하기' : '시작'}</button>`;
    return `<div class="asg-row${p.done ? ' done' : ''}"${live ? '' : ` onclick="asgOpenInbox('${d.id}')"`}>
      <span class="asg-row-ic">${icon}</span>
      <span class="asg-row-main"><b>${escHtml(d.title)}</b><span>${what} · ${sub}</span></span>${btn}</div>`;
  };
  return `<div class="today-card asg-card">
    <div class="asg-card-head">📝 선생님 과제${left ? ` · 할 것 ${left}개` : ' · 다 했어요 ✓'}</div>
    ${list.slice(0, 6).map(row).join('')}
  </div>`;
}
function _asgRefreshHome() {
  if (typeof document === 'undefined') return;
  const html = _asgCardsInner();
  document.querySelectorAll('.home-assign').forEach(el => { if (el.innerHTML !== html) el.innerHTML = html; });
  const n = (typeof CUR !== 'undefined' && CUR) ? assignTodoCount() : 0;
  if (_ASG.lastTodo !== -1 && n !== _ASG.lastTodo && typeof CUR !== 'undefined' && CUR
      && !(typeof BATTLE_STATE !== 'undefined' && BATTLE_STATE && !BATTLE_STATE.finished)
      && typeof renderMain === 'function' && document.getElementById('s-game') && document.getElementById('s-game').classList.contains('active')) {
    _ASG.lastTodo = n; renderMain(); renderMobile();   // '오늘 할 일 N개' · 레일 배지
  }
  _ASG.lastTodo = n;
}

// ── 숙달도(study.js 가 부름) ─────────────────────────────
//  내 과제 답 → 오늘의 학습 기록과 같은 모양(AssignCore.masteryRecords). problemRecords(반 전체가 받는 노드)에는 쓰지 않는다.
function asgMasteryRecords(sid) {
  if (!sid || sid !== _ASG.sid || !_ASG.mine) return [];
  if (!_ASG.mineRecs) _ASG.mineRecs = AssignCore.masteryRecords(_ASG.mine, sid);
  return _ASG.mineRecs;
}

// ── 과제함 창 ─────────────────────────────────────────
function _asgInboxEl() {
  let el = document.getElementById('m-assign');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'm-assign';
  el.className = 'overlay';
  el.style.alignItems = 'center';
  el.innerHTML = `<div class="modal">
    <div class="modal-hd"><div class="modal-title" id="asgi-title">📝 선생님 과제</div>
      <button class="modal-close" onclick="asgCloseInbox()" aria-label="닫기">✕</button></div>
    <div id="asgi-body" class="asg-body"></div></div>`;
  document.body.appendChild(el);
  return el;
}
function _asgInboxShown() { const el = document.getElementById('m-assign'); return !!(el && el.classList.contains('open')); }
function asgOpenInbox(aid) {
  const def = _ASG.open[aid];
  if (!def || !CUR || !AssignCore.isTarget(def, CUR.id)) { toast('이 과제는 지금 열 수 없어요'); return; }
  if (_asgIsLiveAid(aid) && def.deliver === 'live') { toast('선생님과 수업 중이에요'); return; }
  if (def.kind !== 'quiz') {   // 기초 코딩 · 음악실 리듬 — 학습 앱 창을 과제와 함께 연다(앱이 그 판 · 곡을 바로 연다 · 결과는 이 화면이 대신 쓴다)
    if (typeof openExternalEmbed === 'function') openExternalEmbed(def.kind, '&assign=' + aid);
    return;
  }
  _asgInboxEl().classList.add('open');
  _asgInstStart('i', aid);
}
function asgCloseInbox() {
  _asgInstStop('i');
  const el = document.getElementById('m-assign');
  if (el) el.classList.remove('open');
  if (typeof renderAll === 'function' && typeof CUR !== 'undefined' && CUR) renderAll();
}

// ── 수업 덮개 ─────────────────────────────────────────
function classLiveIsOpen() { return _asgLv.open; }
//  레벨업 축하는 덮개 동안 미룬다(밑에 가려져 3초 만에 사라지지 않게) — 끝나면 한 번
function classLiveDefer(lv) { if (!_asgLv.open) return false; _asgLv.deferLv = Math.max(_asgLv.deferLv || 0, lv || 0); return true; }
function _asgLiveEl() {
  let el = document.getElementById('class-live');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'class-live';
  el.setAttribute('tabindex', '-1');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `<div class="asg-live-head">
      <span class="asg-live-badge">👩‍🏫 선생님과 수업 중</span>
      <span class="asg-live-title" id="asgl-title"></span>
      <span class="asg-live-st" id="asgl-st"><i class="asg-dot"></i><span id="asgl-st-txt">연결됨</span></span>
    </div>
    <div class="asg-live-wrap"><div id="asgl-body" class="asg-body"></div></div>`;
  document.body.appendChild(el);
  return el;
}
//  지금 덮개를 보여야 하나 — 로그인한 아이(CUR)만 · 판정은 AssignCore.liveState 한 함수
function _asgLiveState() {
  const live = _ASG.live;
  const sid = (typeof CUR !== 'undefined' && CUR && CUR.id) || '';
  if (!sid || !live) return { show: false, why: 'off' };
  const def = live.aid ? _ASG.open[live.aid] : null;
  return AssignCore.liveState(live, def, sid, { now: _asgNow(), hosts: _ASG.hosts, excused: _ASG.excused });
}
function _asgLiveSync() {
  if (typeof document === 'undefined' || !_ASG.booted) return;
  _asgLoginBanner();
  const loggedIn = typeof CUR !== 'undefined' && CUR && document.getElementById('s-game') && document.getElementById('s-game').classList.contains('active');
  const st = loggedIn ? _asgLiveState() : { show: false, why: 'off' };
  if (st.show) {
    const aid = _ASG.live.aid;
    if (!_asgLv.open) classLiveOpen(aid);
    else if (_asgLv.aid !== aid) { _asgInstStop('l'); _asgPresenceOff(); _asgLv.aid = aid; _asgPresenceOn(aid); _asgInstStart('l', aid); }
    else _asgRender('l', false);
    _asgLiveStatus(st);
  } else if (_asgLv.open) classLiveClose(st.why);
}
function classLiveOpen(aid) {
  _asgLv.open = true; _asgLv.aid = aid; _asgLv.deferLv = 0;
  //  하던 것은 지우지 않고 멈춘다 — 꾸미기는 묶어 둔 저장을 지금 보내고 움직임을 멈춘다(deco.js 는 늦게 읽혀 없을 수 있다)
  try { typeof decoFlush === 'function' && decoFlush('수업'); } catch (e) {}
  try { if (typeof _ifMode !== 'undefined' && _ifMode && typeof _animPauseAll === 'function') _animPauseAll(); } catch (e) {}
  try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
  _asgLv.prevFocus = document.activeElement || null;
  _asgLv.overflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const el = _asgLiveEl();
  el.style.display = 'flex';
  try { el.focus({ preventScroll: true }); } catch (e) {}
  _asgPushHistory(aid);
  window.addEventListener('beforeunload', _asgBeforeUnload);
  _asgPostEmbed(true);
  _asgPresenceOn(aid);
  clearInterval(_asgLv.focusTimer);
  _asgLv.focusTimer = setInterval(_asgKeepFocus, 500);
  _asgInstStart('l', aid);
}
function classLiveClose(why) {
  if (!_asgLv.open) return;
  _asgInstStop('l');
  _asgPresenceOff();
  _asgLv.open = false;
  window.removeEventListener('beforeunload', _asgBeforeUnload);
  clearInterval(_asgLv.focusTimer); _asgLv.focusTimer = 0;
  const el = document.getElementById('class-live');
  if (el) el.style.display = 'none';
  document.body.style.overflow = _asgLv.overflow || '';
  if (_asgLv.pushed && history.state && history.state.asgLive) { _asgLv.pushed = false; try { history.back(); } catch (e) {} }
  _asgLv.pushed = false;
  _asgPostEmbed(false);
  try { if (typeof _ifMode !== 'undefined' && _ifMode && typeof _animResumeAll === 'function') _animResumeAll(); } catch (e) {}
  const pf = _asgLv.prevFocus; _asgLv.prevFocus = null;
  try {
    if (pf && pf.id === 'embed-frame' && pf.contentWindow) pf.contentWindow.focus();
    else if (pf && document.contains(pf) && pf.focus) pf.focus({ preventScroll: true });
  } catch (e) {}
  const lv = _asgLv.deferLv; _asgLv.deferLv = 0;
  if (lv && typeof triggerLevelUp === 'function') setTimeout(() => triggerLevelUp(lv), 500);
  const msg = why === 'hostAway' ? '선생님 화면이 꺼져서 수업 방을 닫았어요' : why === 'excused' ? '선생님이 잠깐 나가도 된다고 했어요'
    : why === 'expired' ? '수업 시간이 끝나서 수업 방을 닫았어요' : '수업이 끝났어요';
  if (typeof toast === 'function') setTimeout(() => toast('👩‍🏫 ' + msg), 200);
  _asgRefreshHome();
}
function _asgLiveStatus(st) {
  const t = document.getElementById('asgl-st-txt'), box = document.getElementById('asgl-st');
  if (!t || !box) return;
  const txt = !_ASG.connected ? '인터넷이 끊겼어요 — 다시 잇는 중이에요. 낸 답은 이어지면 보내요'
    : st && st.why === 'waitHost' ? '선생님 화면이 꺼졌어요 — 조금 기다려 볼게요' : '연결됨';
  if (t.textContent !== txt) t.textContent = txt;
  box.className = 'asg-live-st' + (!_ASG.connected || (st && st.why === 'waitHost') ? ' warn' : '');
}
function _asgBeforeUnload(e) { e.preventDefault(); e.returnValue = ''; return ''; }
function _asgPostEmbed(on) {
  try {
    const f = document.getElementById('embed-frame');
    if (f && f.contentWindow && typeof _embedState !== 'undefined' && _embedState) f.contentWindow.postMessage({ type: 'rpg:classlive', on: !!on }, location.origin);
  } catch (e) {}
}
//  뒤로 — 덮개 한 칸을 쌓는다. 밑에 학습 앱 창이 열려 있으면 그 칸(embed)이 덮개 칸 밑에 꼭 있게(뒤로 건너뛰기에도 창이 안 닫히게)
function _asgPushHistory(aid) {
  try {
    const emb = typeof _embedState !== 'undefined' && _embedState ? _embedState.key : '';
    if (emb && !(history.state && history.state.embed)) history.pushState({ embed: emb }, '', location.href);
    history.pushState({ ...(history.state || {}), embed: emb || (history.state && history.state.embed) || undefined, asgLive: aid }, '', location.href);
    _asgLv.pushed = true;
  } catch (e) {}
}
if (typeof window !== 'undefined' && window.addEventListener) {
  //  student.js 의 popstate 처리기는 덮개가 열려 있으면 학습 앱 창을 닫지 않는다(그 처리기 첫 줄) — 여기서는 덮개 칸을 다시 쌓는다
  window.addEventListener('popstate', () => { if (_asgLv.open && !(history.state && history.state.asgLive)) _asgPushHistory(_asgLv.aid); });
  //  키 — 창(window) 캡처 단계에서 먼저 받는다. 덮개 동안 Esc 는 늘 막고(학습 앱 창 · 꾸미기 Esc 처리기까지 못 감) 덮개 밖을 향한 키도 막는다
  window.addEventListener('keydown', e => {
    if (!_asgLv.open) return;
    const el = document.getElementById('class-live');
    if (e.key === 'Escape' || !el || !el.contains(e.target)) {
      e.stopImmediatePropagation(); e.preventDefault();
      if (el && !el.contains(document.activeElement)) { try { el.focus({ preventScroll: true }); } catch (er) {} }
      return;
    }
    if (e.key === 'Tab') {
      const f = [...el.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex="0"]')].filter(x => x.offsetParent !== null);
      if (!f.length) { e.preventDefault(); return; }
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  }, true);
  document.addEventListener('visibilitychange', () => { if (_asgLv.open && _asgLv.presRef) _asgPresenceOn(_asgLv.aid); });
  //  하위 앱(기초 코딩 · 음악실) 결과 — iframe 이 부모에게 넘기면 이 화면(연결이 이미 있음)이 내 칸에 쓴다 · 쓰는 곳 하나
  window.addEventListener('message', e => {
    const d = e.data;
    if (!d || d.type !== 'rpg:assign-report' || e.origin !== location.origin) return;
    const f = document.getElementById('embed-frame');
    if (!f || e.source !== f.contentWindow) return;
    _asgApplyReport(d, ok => { try { e.source.postMessage({ type: 'rpg:assign-ack', id: d.id, ok }, location.origin); } catch (er) {} });
  });
}
//  포커스가 덮개 밖(밑의 iframe 등)으로 가면 되찾는다 — 키가 밑으로 새지 않게
function _asgKeepFocus() {
  if (!_asgLv.open) return;
  const el = document.getElementById('class-live');
  if (el && !el.contains(document.activeElement)) { try { el.focus({ preventScroll: true }); } catch (e) {} }
}
//  들어옴 표시 — 연결(탭)마다 키 하나 · 끊기면 서버가 지운다 · 다시 이어지면 다시 쓴다
function _asgPresenceOn(aid) {
  const sid = _ASG.sid;
  if (!_ASG.db || !aid || !sid || !AssignCore.safeKey(sid)) return;
  try {
    const r = _asgRef(AssignCore.path.presence(aid, sid, _ASG.conn));
    r.onDisconnect().remove();
    const battle = typeof BATTLE_STATE !== 'undefined' && BATTLE_STATE && !BATTLE_STATE.finished;
    r.set({ at: _asgTS(), v: document.visibilityState === 'hidden' ? 'h' : 'v', b: battle ? 1 : 0 }).catch(() => {});
    _asgLv.presRef = r;
  } catch (e) {}
}
function _asgPresenceOff() {
  const r = _asgLv.presRef; _asgLv.presRef = null;
  if (!r) return;
  try { r.onDisconnect().cancel(); r.remove().catch(() => {}); } catch (e) {}
}
//  로그인 화면 띠 — 수업 중이면 '로그인하면 바로 들어가요'(로그인 화면에 머문 아이도 알게)
function _asgLoginBanner() {
  const card = document.querySelector('#s-login .login-card');
  if (!card) return;
  const loggedIn = typeof CUR !== 'undefined' && CUR;
  const live = _ASG.live;
  const def = live && live.aid ? _ASG.open[live.aid] : null;
  const st = !loggedIn && live ? AssignCore.liveState(live, def, undefined, { now: _asgNow(), hosts: _ASG.hosts }) : { show: false };
  let el = document.getElementById('asg-login-banner');
  if (!st.show) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'asg-login-banner';
    el.className = 'asg-login-banner';
    el.textContent = '👩‍🏫 선생님과 수업 중이에요 — 로그인하면 바로 들어가요';
    card.insertBefore(el, card.firstChild);
  }
}

// ── 실행기(과제함 'i' · 수업 'l' — 같은 코드 · 다른 그릇 · 다른 id 머리) ──
function _asgP(inst) { return inst === 'l' ? 'asgl' : 'asgi'; }
function _asgInstStart(inst, aid) {
  const def = _ASG.open[aid];
  if (!def || typeof CUR === 'undefined' || !CUR) return;
  _asgInstStop(inst);
  _ASG.inst[inst] = { inst, aid, sid: CUR.id, def, fb: null, key: '', note: '', psgOpen: '', psgSeen: '', spoke: '', startedSent: false, closed: false, cv: null };
  _asgSyncCells();
  const t = document.getElementById(_asgP(inst) + '-title');
  if (t) t.textContent = inst === 'l' ? def.title : '📝 ' + def.title;
  _asgRender(inst, true);
}
function _asgInstStop(inst) {
  const st = _ASG.inst[inst];
  if (!st) return;
  _asgScratchOff(st);
  _ASG.inst[inst] = null;
  _asgSyncCells();
}
//  지금 보일 화면
function _asgScreen(st) {
  const def = st.def, cell = _ASG.cells[st.aid] || null;
  if (st.closed && st.inst === 'i') return { view: 'closed' };
  if (def.kind !== 'quiz') return { view: 'app' };
  if (!_ASG.cellReady[st.aid]) return { view: 'loading' };
  if (st.inst === 'l') {
    const s = AssignCore.liveScreen(_ASG.live, def, cell);
    if ((s.view === 'self' || s.view === 'done') && st.fb) return { view: 'fb', i: st.fb.i };
    return s;
  }
  if (st.fb) return { view: 'fb', i: st.fb.i };
  const i = AssignCore.firstOpen(def, cell);
  return i < 0 ? { view: 'done' } : { view: 'self', i };
}
//  화면 열쇠가 같으면 DOM 을 그대로 둔다(쓰던 글 · 분수 칸 · 연습장 그림이 수업 상태 변경마다 지워지지 않게) — 상태 줄만
function _asgRender(inst, force) {
  const st = _ASG.inst[inst];
  if (!st) return;
  const body = document.getElementById(_asgP(inst) + '-body');
  if (!body) return;
  const sc = _asgScreen(st), cell = _ASG.cells[st.aid] || null;
  const a = sc.i >= 0 ? AssignCore.ansAt(cell, sc.i) : null;
  const key = [sc.view, sc.i, sc.summary ? 1 : 0, sc.view === 'reveal' || sc.view === 'summary' || sc.view === 'done' ? AssignCore.answeredCount(st.def, cell) + ':' + (a ? 1 : 0) : '', st.closed ? 'x' : ''].join('|');
  if (!force && key === st.key) { _asgNoteShow(st); return; }
  st.key = key;
  _asgScratchOff(st);
  body.innerHTML = _asgScreenHTML(st, sc, cell);
  _asgNoteShow(st);
  if (sc.view === 'self' || sc.view === 'ask') _asgAfterQuestion(st, sc.i);
}
function _asgNote(st, msg) { st.note = msg || ''; _asgNoteShow(st); }
function _asgNoteShow(st) {
  const el = document.getElementById(_asgP(st.inst) + '-note');
  if (el) { el.textContent = st.note || ''; el.style.display = st.note ? '' : 'none'; }
}
function _asgSubjectLabel(def) {
  const key = def && def.content.quiz ? def.content.quiz.subject : '';
  try { const s = CurriculumUtils.subjects().find(x => x.key === key); if (s) return s.label; } catch (e) {}
  return '';
}
function _asgScreenHTML(st, sc, cell) {
  const def = st.def, P = _asgP(st.inst), live = st.inst === 'l';
  const note = `<div class="asg-note" id="${P}-note" style="display:none"></div>`;
  const wrapC = inner => `<div class="st-center asg-center">${inner}</div>`;
  switch (sc.view) {
    case 'loading': return wrapC(`<div class="asg-wait"><div class="asg-wait-ic">⏳</div><b>불러오는 중이에요</b><span>오래 걸리면 인터넷을 확인해요</span></div>`);
    case 'closed': return wrapC(`<div class="asg-wait"><div class="asg-wait-ic">📪</div><b>선생님이 이 과제를 닫았어요</b><span>낸 답은 그대로 남아요</span>
      <button class="st-btn asg-main-btn" onclick="asgCloseInbox()">닫기</button></div>`);
    case 'app': return wrapC(`<div class="asg-wait"><div class="asg-wait-ic">🧩</div><b>이 과제는 과제함에서 풀어요</b><span>홈의 '선생님 과제'를 눌러요</span></div>`);
    case 'lobby': return wrapC(`<div class="asg-wait"><div class="asg-wait-ic asg-bob">🙋</div><b>곧 시작해요</b><span>선생님이 첫 문제를 열면 여기에 나와요</span></div>`);
    case 'self': case 'ask': return _asgQuestionHTML(st, sc.i, live) + note;
    case 'sent': {
      const a = AssignCore.ansAt(cell, sc.i);
      return _asgBarHTML(def, sc.i) + wrapC(`<div class="asg-wait"><div class="asg-wait-ic">✅</div><b>답을 냈어요</b>
        <span>선생님이 정답을 보여 줄 때까지 기다려요</span>${a && !a.skip ? `<div class="asg-mine">내 답: <b>${_asgAnsLabel(def, sc.i, a)}</b></div>` : ''}</div>`);
    }
    case 'reveal': return _asgBarHTML(def, sc.i) + _asgRevealHTML(st, sc.i, cell);
    case 'fb': return _asgFeedbackHTML(st, st.fb);
    case 'summary': case 'done': return _asgDoneHTML(st, cell, sc);
  }
  return '';
}
function _asgBarHTML(def, i) {
  const n = def.n, cur = Math.min(Math.max(i, 0), n);
  return `<div class="asg-bar-wrap"><div class="st-bar"><i style="width:${Math.round(cur / n * 100)}%"></i></div>
    <div class="asg-bar-txt"><span>${cur + 1 > n ? n : cur + 1} / ${n}</span></div></div>`;
}
function _asgAnsLabel(def, i, a) {
  const it = def.content.quiz.items[i];
  if (!a) return '';
  if (a.skip) return '건너뜀';
  if (it && it.type === 'choice' && a.ci != null && !AssignCore.isOX(it)) return `${ASG_NUM[a.ci] || ''} ${escHtml(it.choices[a.ci] != null ? it.choices[a.ci] : a.a)}`;
  if (it && AssignCore.isOX(it)) return a.a === 'O' ? '⭕ 맞아요' : a.a === 'X' ? '❌ 틀려요' : escHtml(a.a);
  return escHtml(a.a);
}
function _asgCorrectLabel(it) {
  if (!it) return '';
  if (AssignCore.isOX(it)) return it.a === 'O' ? '⭕ 맞아요' : '❌ 틀려요';
  if (it.type === 'choice') { const ci = it.choices.indexOf(it.a); return `${ASG_NUM[ci] || ''} ${escHtml(it.a)}`; }
  return escHtml(it.a);
}
//  문제 화면 — 오늘의 학습(student/study.js renderStudyQuestion)과 같은 꼴 · 같은 .st-* 글꼴(student.css :is(#study-body,.asg-body))
function _asgQuestionHTML(st, i, live) {
  const def = st.def, it = def.content.quiz.items[i], P = _asgP(st.inst), I = `'${st.inst}',${i}`;
  const unit = typeof studyUnitInfo === 'function' ? studyUnitInfo(it.unitId) : null;
  const fig = (it.fig && typeof Figures !== 'undefined') ? Figures.render(it.fig) : '';
  //  지문 — 그 세트의 첫 문항은 펼치고 다음 문항부터 접는다(오늘의 학습과 같음)
  const psg = it.passageId ? def.content.quiz.passages[it.passageId] : null;
  if (psg && st.psgSeen !== psg.id) { st.psgSeen = psg.id; st.psgOpen = psg.id; }
  const psgOpen = psg && st.psgOpen === psg.id;
  const psgHtml = !psg ? '' : `<div class="asg-psg">
      <button type="button" class="asg-psg-btn" onclick="asgPsg('${st.inst}')"><span>📖</span><span style="flex:1">${escHtml(psg.title || '지문')}</span>
        <span class="asg-psg-tog">${psgOpen ? '접기 ▲' : '지문 다시 보기 ▼'}</span></button>
      ${psgOpen ? `<div class="asg-psg-text">${escHtml(psg.text || '')}</div>` : ''}</div>`;
  //  소리 — 과제함은 화면이 뜨면 한 번 읽어 준다 · 수업은 자동 읽기 없음(25대가 한꺼번에) · 목소리가 없으면 건너뛰기(영어도)
  const lang = AssignCore.itemLang(it);
  const noVoice = it.audio && typeof hasVoiceFor === 'function' && !hasVoiceFor(lang);
  const speak = JSON.stringify({ lang, rate: it.cat === 'dictation' ? 0.8 : 0.85 }).replace(/"/g, '&quot;');
  const audioHtml = !it.audio ? '' : noVoice ? `<div class="asg-novoice"><div style="font-size:1.6rem">🔇</div>
      <b>이 기기에서는 ${lang.startsWith('ko') ? '한국어' : '영어'} 소리가 나오지 않아요</b>
      <span>선생님께 알려 주세요. 이 문제는 건너뛰어도 돼요.</span>
      <button class="asg-skip" onclick="asgSkip(${I})">이 문제 건너뛰기</button></div>`
    : `<div class="asg-audio"><button class="asg-audio-btn" onclick="speakWord(${JSON.stringify(String(it.audio)).replace(/"/g, '&quot;')}, ${speak})"><span>🔊</span> ${live ? '듣기' : '다시 듣기'}</button>
      <div class="asg-audio-sub">${live ? '이어폰으로 들어요' : '잘 안 들리면 버튼을 눌러 보세요'}</div></div>`;
  const scratch = def.content.quiz.subject === 'math' ? `<div class="st-scratch"><div class="st-scratch-head"><span>✏️ 여기에 풀어 보세요</span>
      <button type="button" class="st-scratch-clear" onclick="asgScratchClear('${st.inst}')">🧹 지우기</button></div>
      <canvas id="${P}-scratch" class="asg-scratch-cv"></canvas></div>` : '';
  let input;
  if (AssignCore.isOX(it)) {
    const io = it.choices.indexOf('O'), ix = it.choices.indexOf('X');
    input = `<div class="st-ox"><button class="st-opt st-ox-btn" onclick="asgPick(${I},${io})"><span class="st-ox-mark">⭕</span>맞아요</button>
      <button class="st-opt st-ox-btn x" onclick="asgPick(${I},${ix})"><span class="st-ox-mark">❌</span>틀려요</button></div>`;
  } else if (it.type === 'choice') {
    input = `<div class="asg-opts">${it.choices.map((c, ci) => `<button class="st-opt asg-opt" onclick="asgPick(${I},${ci})"><span class="asg-num">${ASG_NUM[ci] || ci + 1}</span><span>${escHtml(c)}</span></button>`).join('')}</div>`;
  } else if (it.type === 'fraction') {
    const key = `onkeydown="if(event.key==='Enter'&&!event.isComposing)asgFrac(${I})"`;
    input = `<div class="st-frac asg-frac">
        <label class="asg-frac-w"><input id="${P}-fw" inputmode="numeric" autocomplete="off" maxlength="3" ${key} aria-label="자연수"><span>자연수</span></label>
        <div class="asg-frac-nd"><input id="${P}-fn" inputmode="numeric" autocomplete="off" maxlength="3" ${key} aria-label="분자"><i></i>
          <input id="${P}-fd" inputmode="numeric" autocomplete="off" maxlength="3" ${key} aria-label="분모"></div>
        <button class="st-btn asg-ok" onclick="asgFrac(${I})">확인</button></div>
      <div class="asg-frac-sub">진분수면 자연수 칸은 비워 두세요</div>`;
  } else {
    const en = AssignCore.isEnglish(it);
    const attrs = it.type === 'number' ? 'inputmode="numeric"' : en ? 'lang="en" autocapitalize="off" autocorrect="off" spellcheck="false"' : '';
    const ph = it.type === 'number' ? '숫자를 입력하세요' : en ? '영어로 쓰세요' : '답을 입력하세요';
    input = `<div class="asg-input-row"><input id="${P}-input" class="st-input" ${attrs} placeholder="${ph}" autocomplete="off"
        onkeydown="if(event.key==='Enter'&&!event.isComposing)asgSubmit(${I})">
      <button class="st-btn asg-ok" onclick="asgSubmit(${I})">확인</button></div>${en ? '<div class="asg-en-tip">⌨️ 영어로 쓸 때는 한/영 키를 눌러요</div>' : ''}`;
  }
  return `${_asgBarHTML(def, i)}
    <div class="asg-q-wrap">
      <div class="st-meta">${escHtml((unit && unit.subjectLabel) || _asgSubjectLabel(def))}${unit && unit.name ? ' · ' + escHtml(unit.name) : ''}</div>
      ${fig ? `<div class="st-fig">${fig}</div>` : ''}
      ${psgHtml}
      <div class="st-q asg-q">${escHtml(it.q)}</div>
      ${audioHtml}
      ${scratch}
      ${input}
      ${it.hint && !live ? `<button class="asg-hint-btn" onclick="this.nextElementSibling.style.display='block';this.style.display='none'">힌트 보기</button>
        <div class="st-hint asg-hint" style="display:none">💡 ${escHtml(it.hint)}</div>` : ''}
    </div>`;
}
//  문제를 그린 뒤 — 연습장 · 입력 칸 포커스 · (과제함) 소리 한 번
function _asgAfterQuestion(st, i) {
  const P = _asgP(st.inst), it = st.def.content.quiz.items[i];
  _asgScratchOn(st, document.getElementById(P + '-scratch'));
  const inp = document.getElementById(P + '-input') || document.getElementById(P + '-fw');
  if (inp) setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) {} }, 60);
  if (st.inst === 'i' && it.audio && st.spoke !== it.id && typeof speakWord === 'function'
      && !(typeof hasVoiceFor === 'function' && !hasVoiceFor(AssignCore.itemLang(it)))) {
    st.spoke = it.id;
    setTimeout(() => { if (_ASG.inst.i === st) speakWord(String(it.audio), { lang: AssignCore.itemLang(it), rate: it.cat === 'dictation' ? 0.8 : 0.85 }); }, 350);
  }
}
function asgPsg(inst) {
  const st = _ASG.inst[inst];
  if (!st) return;
  const sc = _asgScreen(st), it = sc.i >= 0 ? st.def.content.quiz.items[sc.i] : null;
  if (!it || !it.passageId) return;
  st.psgOpen = st.psgOpen === it.passageId ? '' : it.passageId;
  _asgRender(inst, true);
}

// ── 답 내기 ───────────────────────────────────────────
function asgPick(inst, i, ci) { _asgAnswer(inst, i, { ci }); }
function asgSubmit(inst, i) { const el = document.getElementById(_asgP(inst) + '-input'); _asgAnswer(inst, i, { v: el ? el.value : '' }); }
function asgSkip(inst, i) { _asgAnswer(inst, i, { skip: true }); }
function asgFrac(inst, i) {
  const P = _asgP(inst), g = id => ((document.getElementById(P + id) || {}).value || '').replace(/[^0-9０-９]/g, '');
  const w = g('-fw'), n = g('-fn'), d = g('-fd'), st = _ASG.inst[inst];
  if (!st) return;
  if (!n && !d) { if (w) _asgAnswer(inst, i, { v: w }); else _asgNote(st, '답을 입력해 주세요'); return; }
  if (!n) { _asgNote(st, '분자를 써 주세요'); return; }
  if (!d || Number(d) === 0) { _asgNote(st, '분모를 써 주세요'); return; }
  const josa = typeof fractionJosa === 'function' ? fractionJosa(w) : '와';
  _asgAnswer(inst, i, { v: w && Number(w) > 0 ? `${w}${josa} ${n}/${d}` : `${n}/${d}` });
}
function _asgAnswer(inst, i, input) {
  const st = _ASG.inst[inst];
  if (!st || typeof CUR === 'undefined' || !CUR || CUR.id !== st.sid || st.closed) return;
  const def = st.def, cell = _ASG.cells[st.aid] || null, it = def.content.quiz && def.content.quiz.items[i];
  if (!it || !_ASG.cellReady[st.aid]) return;
  const mode = inst === 'l' ? 'live' : 'inbox';
  if (!AssignCore.canAnswer(mode, _ASG.live, def, cell, i)) { _asgRender(inst, true); return; }
  let res;
  if (input.skip) res = { a: '', ok: false, skip: true };
  else {
    res = AssignCore.grade(it, input, {
      isCorrect: (p, v) => (typeof CurriculumUtils !== 'undefined' ? CurriculumUtils.isCorrect(p, v) : false),
      dictation: typeof dictationGrade === 'function' ? dictationGrade : null,
    });
    if (!res) { _asgNote(st, '답을 입력해 주세요'); return; }
    if (res.blocked === 'hangul') { _asgNote(st, '⌨️ 한/영 키를 눌러 영어로 바꿔서 다시 써요'); return; }
  }
  const before = ((typeof masteryOf === 'function' && masteryOf(it.id)) || { lv: 0 }).lv;
  const after = res.skip ? before : res.ok ? Math.min(5, before + 1) : Math.max(0, before - 1);
  const patch = AssignCore.answerPatch(def, st.sid, cell, i, res, { TS: _asgTS(), date: Utils.todayStr() });
  if (!patch) return;
  st.note = '';
  if (def.pacing !== 'step' || mode === 'inbox') {
    st.fb = def.showAnswer && !res.skip ? { i, res, before, after, val: input.v != null ? String(input.v) : '' } : null;
    if (!def.showAnswer && !res.skip) st.note = '답을 냈어요 ✓';
  }
  _asgWrite(st.sid, st.aid, i, res, patch);
}
//  쓰기 — 서버 확인(then) 전까지 이 기기에 적어 두었다가(새로고침 · 끊김) 다시 로그인할 때 보낸다
function _asgOutKey(sid) { return 'rpg.asgOut.' + sid; }
function _asgOutGet(sid) { try { return JSON.parse(localStorage.getItem(_asgOutKey(sid)) || '{}') || {}; } catch (e) { return {}; } }
function _asgOutSet(sid, v) { try { if (Object.keys(v).length) localStorage.setItem(_asgOutKey(sid), JSON.stringify(v)); else localStorage.removeItem(_asgOutKey(sid)); } catch (e) {} }
function _asgWrite(sid, aid, i, res, patch) {
  const k = aid + '/' + i, out = _asgOutGet(sid);
  out[k] = { aid, i, res, date: Utils.todayStr() };
  _asgOutSet(sid, out);
  try {
    _asgRef('').update(patch).then(() => { const o = _asgOutGet(sid); delete o[k]; _asgOutSet(sid, o); })
      .catch(e => { console.warn('[CLASS-ASSIGN-1] 저장 실패', e); _asgSaveFail(); });
  } catch (e) { _asgSaveFail(); }
}
function _asgSaveFail() { for (const k of ['i', 'l']) { const st = _ASG.inst[k]; if (st) _asgNote(st, '⚠️ 저장이 안 됐어요 — 인터넷을 확인해요'); } }
function _asgOutboxFlush() {
  const sid = _ASG.sid;
  if (!sid || !_ASG.db || !_ASG.connected) return;
  const out = _asgOutGet(sid), keys = Object.keys(out);
  if (!keys.length) return;
  for (const k of keys) {
    const e = out[k], def = e && _ASG.open[e.aid];
    if (!def) { delete out[k]; continue; }
    _asgRef(AssignCore.path.result(e.aid, sid)).once('value').then(s => {
      const cell = s.val();
      if (AssignCore.ansAt(cell, e.i)) { const o = _asgOutGet(sid); delete o[k]; _asgOutSet(sid, o); return; }
      const p = AssignCore.answerPatch(def, sid, cell, e.i, e.res, { TS: _asgTS(), date: e.date });
      if (p) _asgRef('').update(p).then(() => { const o = _asgOutGet(sid); delete o[k]; _asgOutSet(sid, o); }).catch(() => {});
    }).catch(() => {});
  }
  _asgOutSet(sid, out);
}
function asgNext(inst) {
  const st = _ASG.inst[inst];
  if (!st) return;
  st.fb = null; st.note = '';
  _asgRender(inst, true);
}

// ── 피드백 · 공개 · 끝 화면 ──────────────────────────────
function _asgStars(before, after) {
  if (typeof starsText !== 'function') return '';
  return `<div class="asg-stars"><span>${starsText(before)}</span> → <b>${starsText(after)}</b></div>`;
}
function _asgFeedbackHTML(st, fb) {
  const def = st.def, it = def.content.quiz.items[fb.i], ok = fb.res.ok;
  const last = AssignCore.firstOpen(def, _ASG.cells[st.aid] || null) < 0;
  const btn = `<button class="st-btn asg-main-btn" onclick="asgNext('${st.inst}')">${last ? '결과 보기' : '다음 문제'}</button>`;
  if (it.cat === 'dictation' && typeof dictationMarks === 'function' && typeof dictationDiffHtml === 'function') {
    const m = dictationMarks(it.a, fb.val);
    const g = typeof dictationGrade === 'function' ? dictationGrade(it, fb.val) : { spaceOk: true, charOk: ok };
    return `<div class="st-center asg-center"><div class="st-emoji ${ok ? '' : 'wrong'}">${ok ? '🎉' : '🤔'}</div>
      <div class="asg-fb-title ${ok ? 'ok' : 'no'}">${ok ? '맞았어요!' : '아쉬워요'}</div>
      <div class="asg-fb-sub">맞은 글자 ${m.matched} / ${m.total}</div>
      <div class="asg-fb-box"><span>내가 쓴 것</span><div class="asg-fb-mine">${escHtml(fb.val)}</div>
        <span>정답</span><div class="asg-fb-ans">${dictationDiffHtml(it.a, fb.val)}</div>
        ${!g.spaceOk ? `<div class="asg-fb-space">✏️ 글자는 ${g.charOk ? '모두 맞았어요' : '위를 보세요'}. 띄어쓰기가 정답과 달라요 (점수에는 넣지 않았어요).</div>` : ''}</div>
      ${_asgStars(fb.before, fb.after)}${btn}</div>`;
  }
  const equal = ok && it.type === 'fraction' && typeof CurriculumUtils !== 'undefined' && CurriculumUtils.fractionMatch(it, fb.val) === 'equal';
  return `<div class="st-center asg-center"><div class="st-emoji ${ok ? '' : 'wrong'}">${ok ? '🎉' : '🤔'}</div>
    <div class="asg-fb-title ${ok ? 'ok' : 'no'}">${ok ? '맞았어요!' : '아쉬워요'}</div>
    ${equal ? `<div class="asg-fb-box gold">값이 같아요! 정답 모양 <b>${escHtml(it.a)}</b></div>` : ''}
    ${!ok ? `<div class="asg-fb-box"><span>내가 고른 답</span><div class="asg-fb-mine">${_asgAnsLabel(def, fb.i, fb.res)}</div>
      <span>정답</span><div class="asg-fb-ans">${_asgCorrectLabel(it)}</div>
      ${it.hint ? `<div class="asg-fb-hint">💡 ${escHtml(it.hint)}</div>` : ''}</div>` : ''}
    ${_asgStars(fb.before, fb.after)}${btn}</div>`;
}
function _asgRevealHTML(st, i, cell) {
  const def = st.def, it = def.content.quiz.items[i], a = AssignCore.ansAt(cell, i);
  const late = a && AssignCore.isLate(a, (_ASG.live && _ASG.live.revealAt) || def.revealed, i);
  const head = !a || a.skip ? `<div class="st-emoji">📝</div><div class="asg-fb-title">이 문제는 못 냈어요</div>`
    : `<div class="st-emoji ${a.ok ? '' : 'wrong'}">${a.ok ? '🎉' : '🤔'}</div><div class="asg-fb-title ${a.ok ? 'ok' : 'no'}">${a.ok ? '맞았어요!' : '아쉬워요'}</div>`;
  return `<div class="st-center asg-center">${head}
    <div class="asg-fb-box">${a && !a.skip ? `<span>내 답</span><div class="asg-fb-mine">${_asgAnsLabel(def, i, a)}${late ? ' <small>(공개 뒤에 닿았어요)</small>' : ''}</div>` : ''}
      <span>정답</span><div class="asg-fb-ans">${_asgCorrectLabel(it)}</div>
      ${it.hint ? `<div class="asg-fb-hint">💡 ${escHtml(it.hint)}</div>` : ''}</div>
    <div class="asg-fb-sub">선생님과 이야기해 봐요 · 다음 문제는 선생님이 열어요</div></div>`;
}
function _asgDoneHTML(st, cell, sc) {
  const def = st.def, live = st.inst === 'l';
  const s = AssignCore.summarize(def, cell, { revealed: (_ASG.live && _ASG.live.revealAt) || def.revealed });
  const show = def.showAnswer || sc.view === 'summary' || sc.summary || def.pacing === 'step';
  const wrong = s.items.map((x, i) => ({ x, i })).filter(o => !o.x || !o.x.ok);
  const list = show && wrong.length ? `<div class="asg-review"><b>다시 볼 문제 ${wrong.length}개</b>${wrong.slice(0, 8).map(o => {
    const it = def.content.quiz.items[o.i];
    return `<div class="asg-review-row">${o.i + 1}. ${escHtml(it.q.slice(0, 40))}${it.q.length > 40 ? '…' : ''} <span>→ ${_asgCorrectLabel(it)}</span></div>`;
  }).join('')}</div>` : '';
  const pct = s.total ? Math.round(s.correct / s.total * 100) : 0;
  const emoji = !show ? '✅' : pct === 100 ? '🏆' : pct >= 80 ? '👏' : pct >= 50 ? '💪' : '🌱';
  const top = live ? (sc.view === 'summary' ? '수업 정리' : '다 했어요!') : '다 했어요!';
  const sub = live ? (sc.view === 'summary' ? '선생님이 수업을 끝낼 때까지 기다려요' : '선생님이 수업을 끝낼 때까지 기다려요') : '선생님이 결과를 봐요';
  return `<div class="st-center asg-center"><div class="st-emoji">${emoji}</div>
    <div class="asg-fb-title">${top}</div>
    ${show ? `<div class="st-score asg-score">${s.correct} / ${s.total}</div>` : ''}
    <div class="asg-fb-sub">${sub}</div>${list}
    ${live ? '' : `<button class="st-btn asg-main-btn" onclick="asgCloseInbox()">닫기</button>`}</div>`;
}

// ── 연습장(캔버스마다 따로 — 밑의 오늘의 학습 연습장을 빼앗지 않는다) ──
function _asgScratchOn(st, cv) {
  if (!cv) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const fit = () => {
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (cv.width === pw && cv.height === ph) return;
    const prev = (cv.width && cv.height) ? cv.toDataURL() : null;
    cv.width = pw; cv.height = ph;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2.6; ctx.strokeStyle = '#2B3A55'; ctx.fillStyle = '#2B3A55';
    if (prev) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, w, h); img.src = prev; }
  };
  fit();
  let drawing = false, lx = 0, ly = 0;
  const at = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.onpointerdown = e => { const ctx = cv.getContext('2d'); drawing = true; try { cv.setPointerCapture(e.pointerId); } catch (er) {} [lx, ly] = at(e);
    ctx.beginPath(); ctx.arc(lx, ly, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); e.preventDefault(); };
  cv.onpointermove = e => { if (!drawing) return; const ctx = cv.getContext('2d'), [x, y] = at(e); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(x, y); ctx.stroke(); lx = x; ly = y; e.preventDefault(); };
  const stop = e => { if (!drawing) return; drawing = false; try { cv.releasePointerCapture(e.pointerId); } catch (er) {} };
  cv.onpointerup = stop; cv.onpointercancel = stop;
  st.cv = { cv, fit };
  window.addEventListener('resize', fit);
}
function _asgScratchOff(st) {
  if (!st || !st.cv) return;
  window.removeEventListener('resize', st.cv.fit);
  st.cv = null;
}
function asgScratchClear(inst) {
  const cv = document.getElementById(_asgP(inst) + '-scratch');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore();
}

// ── 하위 앱 결과 받아 쓰기(common/assign.js 의 reportAssign → postMessage) ──
//  내 칸 아래 경로만 — AssignCore.appPatch 가 모양을 만든다(점수 · 판 수 · 판마다 가장 좋은 기록)
function _asgApplyReport(d, ack) {
  const aid = d && d.aid, def = AssignCore.safeAid(aid) ? _ASG.open[aid] : null;
  const sid = _ASG.sid;
  if (!def || def.kind === 'quiz' || !sid || typeof CUR === 'undefined' || !CUR || CUR.id !== sid || !AssignCore.isTarget(def, sid) || !_ASG.db) { ack(false); return; }
  const p = AssignCore.appPatch(def, sid, _ASG.cells[aid] || null, d.patch, { TS: _asgTS(), INC: n => firebase.database.ServerValue.increment(n) });
  if (!p) { ack(false); return; }
  _asgRef('').update(p).then(() => ack(true), () => ack(false));
}
