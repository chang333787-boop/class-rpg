// admin/assign.js — 📝 과제·수업 [CLASS-ASSIGN-1] [CLASS-LIVE-1]
//  · 만들기(문제 묶음: 직접 고르기 · 자동 뽑기 / 기초 코딩 · 음악실 리듬은 고르기 칸만 — 다음 단계가 채움) → 보내기(과제함 · 지금 모두 같이)
//  · 열린 · 닫은 과제 목록 · 결과(반 명단 기준 · 문제별 보기 분포 · 오답) · 수업 조작(다음 · 답 공개 · 결과 보기 · 끝내기) · TV(새 창)
//  · 저장 = classRPG_assign(classRPG_v3 밖 — 관리 화면 root 구독 · renderAll 과 무관). 진행은 live transaction('그 단계일 때만').
//  · 교사 기기 연결 = hosts/<연결>(관리 화면에 로그인한 동안) — 아이 화면 갇힘 방지의 근거. 규칙 · 셈 = common/assign-core.js
//  · 전역 이름 머리 = assign · _assign · _AS

const _AS = {
  booted: false, db: null, offset: 0, connected: false,
  live: null, openRaw: {}, open: {}, hosts: null,
  presAid: '', presOff: null, presence: {}, excAid: '', excOff: null, excused: {},
  results: {}, resOffs: {}, archive: null, archOpen: false, archRaw: {},
  sel: '', selItem: -1, selStu: '', mask: null, draft: null, sending: false, busy: false, startAsk: '', endInbox: true,
  hostN: 0, hostRef: null, wake: null, cleaned: false,
};
const ASSIGN_CAT_LABEL = { calc: '계산', word: '문장제', concept: '개념', expr: '표현', vocab: '낱말', dialog: '대화', apply: '적용', listen: '듣기',
  ox: 'OX', situation: '상황 판단', reason: '따져보기', spell: '맞춤법', grammar: '문법', read: '지문 읽기', dictation: '받아쓰기' };
const ASSIGN_TYPE_LABEL = { choice: '보기', number: '수', short: '글', fraction: '분수' };
const ASSIGN_NUM = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];
//  [ASSIGN-APPS-1] 학습 앱 과제(🧩 기초 코딩 · 🎵 음악실 리듬) — 만들기 · 목록 · 결과 표 · 수업 띠는 이 파일의 공용 틀 하나.
//   앱마다 다른 것만 admin/assign-<앱>.js 가 ASSIGN_APPS.<종류> 에 단다(없으면 그 종류 단추가 '곧'):
//    picker(d) 고르기 칸 · build(d) → { content } | { err } · autoTitle(d) · what(def) 목록 줄 머리
//    cols(def) 결과 표 머리 칸(<th>…) · cells(r, def) 그 줄 칸(<td>…) · top(def, t) 표 위 한 줄 · foot(def, t, lead) 표 끝 줄 · after(def, rows) 표 밑
//    cls 결과 표 class 머리(asg-<cls>-table) · liveRow(def, t) 수업 띠 한 줄 · liveCtl 수업 띠 글 · selfNote '각자 풀기' 옆 글 · startNote [수업으로] 물음 글 · preload() 쪽을 열 때 목록 미리 읽기
const ASSIGN_APPS = {};
const ASSIGN_KIND_LABEL = { quiz: '📝 문제 묶음', coding: '🧩 기초 코딩', music: '🎵 음악실 리듬' };
function _assignApp(kind) { return kind !== 'quiz' && Object.prototype.hasOwnProperty.call(ASSIGN_APPS, kind) ? ASSIGN_APPS[kind] : null; }
function _assignKindReady(kind) { return kind === 'quiz' || !!_assignApp(kind); }
//  '지금 모두 같이'로 보낼 수 있나 — 스위치는 AssignCore.LIVE_APPS 한 곳(지금 비어 있음 = 문제 묶음만 · 보스 결정 10-05) [ASSIGN-LIVE-APPS-1]
function _assignLiveOK(kind) { return AssignCore.isLiveKind(kind) && _assignKindReady(kind); }
//  [ASSIGN-CODING-2] 덮개 안 학습 앱은 아이마다 연결을 1~2개 더 쓴다(학생 화면 1 + 덮개 안 앱 1 + 밑 학습 앱 창 1)
//   요금제(설계 §17 Q10) 확인 전 — 스위치를 켠 뒤에도 받는 아이가 이만큼 넘으면 시작 전에 한 번 더 묻는다
const ASSIGN_APP_LIVE_WARN = 20;
function _assignReceivers(def) { return def && Array.isArray(def.targets) && def.targets.length ? def.targets.length : _assignStudents().length; }
function _assignAppLiveNote(n, kind) { return `받는 아이 ${n}명 — ${ASSIGN_KIND_LABEL[kind] || '학습 앱'} 수업은 아이 한 명이 인터넷 연결을 2~3개 써요(모두 약 ${n * 2}~${n * 3}개). 무료 요금제는 동시 연결 100개까지라 넘으면 우리 반 RPG 화면이 새로 안 열릴 수 있어요.`; }
//  과제함으로만 보내는 종류의 안내 한 줄(만들기 · 목록 공용)
function _assignInboxOnlyNote(kind) { return `${ASSIGN_KIND_LABEL[kind] || '이 앱'} 과제는 과제함으로만 보낼 수 있어요 — '지금 모두 같이'(수업 방)는 문제 묶음만 열려요`; }

//  [CLASS-LIVE-NOTE-1] 수업 방이 저절로 풀리는 때 · 덮개 밑에서 멈추지 않는 학습 앱 — 만들기 화면과 수업 띠에 한 줄(교사 기기 3분 · 안전 시간)
const ASSIGN_LIVE_NOTE = '⚠️ 선생님 화면(관리 · TV)이 3분 넘게 꺼지거나 안전 시간이 지나면 아이 화면의 수업 방이 저절로 풀려요. 🧩 기초 코딩 · 🎵 음악실 창은 덮개 밑에서 저절로 멈추지만, 우리 마을 같은 다른 학습 앱은 계속 돌 수 있어요 — 수업 전에 닫게 해 주세요.';
function _assignRef(p) { return _AS.db.ref(AssignCore.path.full(p)); }
function _assignNow() { return Date.now() + (_AS.offset || 0); }
function _assignTS() { return firebase.database.ServerValue.TIMESTAMP; }
function _assignActive() { const p = document.getElementById('p-assign'); return !!(p && p.classList.contains('active')); }
function _assignMasked() { return _AS.mask === null ? !!(_AS.live && _AS.live.on) : _AS.mask; }

// ── 켜기(관리 화면 로그인 뒤 한 번 — 쪽을 안 열어도 수업 칩 · 교사 기기 연결) ──
function assignAdminBoot() {
  if (_AS.booted) return;
  try {
    if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length || typeof AssignCore === 'undefined') return;
    _AS.db = firebase.database();
  } catch (e) { return; }
  _AS.booted = true;
  const on = (p, cb, raw) => { const r = raw ? _AS.db.ref(p) : _assignRef(p); r.on('value', s => { try { cb(s.val()); } catch (e) { console.warn('[CLASS-ASSIGN-1]', e); } }, e => console.warn('[CLASS-ASSIGN-1]', p, e)); };
  on('.info/serverTimeOffset', v => { _AS.offset = Number(v) || 0; }, true);
  on('.info/connected', v => { _AS.connected = v === true; if (_AS.connected) _assignHostOn(); _assignRenderBits(); }, true);
  on(AssignCore.path.live, v => { _AS.live = v; _assignOnLive(); });
  on(AssignCore.path.hosts, v => { _AS.hosts = v; _assignHostClean(); _assignRenderBits(); });
  on('open', v => { _AS.openRaw = v && typeof v === 'object' ? v : {}; _assignOnOpen(); });
  setInterval(() => { if (_AS.live && _AS.live.on) _assignRenderBits(); }, 20000);   // 남은 시간 · 멈춘 수업 판정
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') _assignWake(); });
}
//  교사 기기 연결 — 이어질 때마다 새 칸(빈 틈을 다시 셀 수 있게 옛 칸은 지우지 않고 끊긴 시각만 남긴다)
function _assignHostOn() {
  try {
    if (_AS.hostRef) { try { _AS.hostRef.onDisconnect().cancel(); } catch (e) {} }
    const key = 'ad' + Math.random().toString(36).slice(2, 7) + '-' + (++_AS.hostN);
    const r = _assignRef(AssignCore.path.host(key));
    r.onDisconnect().update({ on: false, left: _assignTS() });
    r.set({ on: true, at: _assignTS(), w: 'admin' }).catch(() => {});
    _AS.hostRef = r;
  } catch (e) { console.warn('[CLASS-LIVE-1] host', e); }
}
//  이틀 지난 끊긴 칸은 지운다(한 번)
function _assignHostClean() {
  if (_AS.cleaned || !_AS.hosts || typeof _AS.hosts !== 'object') return;
  _AS.cleaned = true;
  const old = _assignNow() - 2 * 86400000, up = {};
  for (const k of Object.keys(_AS.hosts)) { const h = _AS.hosts[k]; if (!h || typeof h !== 'object' || (h.on !== true && (Number(h.left) || Number(h.at) || 0) < old)) up['hosts/' + k] = null; }
  if (Object.keys(up).length) _assignRef('').update(up).catch(() => {});
}
//  화면이 꺼지지 않게(수업 중) — 맥북 잠자기로 와이파이가 끊겨 아이 화면이 풀리는 것을 줄인다
async function _assignWake() {
  const want = !!(_AS.live && _AS.live.on);
  try {
    if (want && !_AS.wake && navigator.wakeLock && document.visibilityState === 'visible') { _AS.wake = await navigator.wakeLock.request('screen'); _AS.wake.addEventListener('release', () => { _AS.wake = null; }); }
    if (!want && _AS.wake) { const w = _AS.wake; _AS.wake = null; await w.release(); }
  } catch (e) {}
}

// ── 받은 값 ──
function _assignOnOpen() {
  const next = {};
  for (const aid of Object.keys(_AS.openRaw || {})) { const d = AssignCore.normDef(_AS.openRaw[aid], aid); if (d) next[aid] = d; }
  _AS.open = next;
  _assignSyncResults();
  _assignRenderBits(true);
}
function _assignOnLive() {
  const live = _AS.live, aid = live && live.on === true && AssignCore.safeAid(live.aid) ? live.aid : '';
  if (aid !== _AS.presAid) {
    if (_AS.presOff) { _AS.presOff(); _AS.presOff = null; }
    _AS.presAid = aid; _AS.presence = {};
    if (aid) { const r = _assignRef(AssignCore.path.presenceAll(aid)); const f = r.on('value', s => { _AS.presence = s.val() || {}; _assignRenderBits(); }); _AS.presOff = () => r.off('value', f); }
  }
  if (aid !== _AS.excAid) {
    if (_AS.excOff) { _AS.excOff(); _AS.excOff = null; }
    _AS.excAid = aid; _AS.excused = {};
    if (aid) { const r = _assignRef(AssignCore.path.excused(aid)); const f = r.on('value', s => { _AS.excused = s.val() || {}; _assignRenderBits(); }); _AS.excOff = () => r.off('value', f); }
  }
  _assignSyncResults();
  _assignWake();
  _assignRenderBits();
}
function _assignSyncResults() {
  if (!_AS.db) return;
  const want = new Set(Object.keys(_AS.open));
  if (_AS.sel) want.add(_AS.sel);
  if (_AS.presAid) want.add(_AS.presAid);
  for (const aid of want) {
    if (_AS.resOffs[aid] || !AssignCore.safeAid(aid)) continue;
    const r = _assignRef(AssignCore.path.results(aid));
    const f = r.on('value', s => { _AS.results[aid] = s.val() || {}; _assignRenderBits(); }, e => console.warn('[CLASS-ASSIGN-1] results', e));
    _AS.resOffs[aid] = () => r.off('value', f);
  }
  for (const aid of Object.keys(_AS.resOffs)) if (!want.has(aid)) { _AS.resOffs[aid](); delete _AS.resOffs[aid]; delete _AS.results[aid]; }
}
//  다시 그리기 — 만들기 창은 건드리지 않는다(수업 중에 다음 과제를 만들고 있어도 칸이 안 지워지게)
let _assignRaf = 0;
function _assignRenderBits(lists) {
  _assignTopChip();
  if (!_assignActive()) return;
  if (_assignRaf) { if (lists) _assignRaf.lists = true; return; }
  _assignRaf = { lists: !!lists };
  setTimeout(() => {
    const o = _assignRaf; _assignRaf = 0;
    try {
      const m = document.getElementById('asg-mask'); if (m) m.checked = _assignMasked();   // 수업이 다른 기기에서 켜져도 '이름 가리기'가 따라감
      _assignRenderStale(); _assignRenderLive(); _assignRenderLists(); _assignRenderResult();
    } catch (e) { console.error('[CLASS-ASSIGN-1] 그리기', e); }
  }, 30);
}

// ── 명단 ──
function _assignStudents() {
  const list = (typeof DB !== 'undefined' && DB.getStudents) ? DB.getStudents() : [];
  return list.filter(s => s && s.id && AssignCore.safeKey(s.id)).map(s => ({ sid: s.id, name: String(s.name || '') }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}
//  지금 명단 기준(이름도 지금 이름) — 만든 때 명단에만 있던 아이(그 뒤 지움)의 결과는 tally 의 '명단 밖' 줄로 따로 보인다
function _assignRoster(def) { return _assignStudents().filter(x => AssignCore.isTarget(def, x.sid)); }
function _assignNameHTML(name, idx) {
  if (!_assignMasked()) return escHtml(name);
  return `<button class="asg-mask-name" data-n="${escHtml(name)}" onclick="event.stopPropagation();this.textContent=this.dataset.n;this.classList.add('on')">학생 ${idx + 1}</button>`;
}

// ── 윗줄 수업 칩(어느 쪽을 보든) ──
function _assignTopChip() {
  const right = document.querySelector('.topbar-right');
  if (!right) return;
  let chip = document.getElementById('asg-topchip');
  const live = _AS.live;
  if (!live || live.on !== true) { if (chip) chip.remove(); return; }
  if (!chip) {
    chip = document.createElement('button');
    chip.id = 'asg-topchip'; chip.className = 'asg-topchip';
    chip.onclick = () => nav('assign', document.getElementById('nav-assign'));
    right.insertBefore(chip, right.firstChild);
  }
  const def = _AS.open[live.aid];
  const st = AssignCore.liveState(live, def, undefined, { now: _assignNow(), hosts: _AS.hosts });
  let txt;
  if (!st.show) txt = st.why === 'expired' ? '⏰ 수업 시간 지남 — 끝내기' : st.why === 'stale' ? '⚠️ 지난 수업이 켜져 있어요' : '⚠️ 수업 확인';
  else if (live.pacing === 'step') txt = `🔴 수업 중 · ${live.step < 0 ? '기다림' : live.phase === 'summary' ? '정리' : `${live.step + 1}/${def ? def.n : '?'}번`}`;
  else { const t = def ? AssignCore.tally(def, _AS.results[live.aid], _assignRoster(def)) : null; txt = `🔴 수업 중${t ? ` · 다 한 친구 ${t.counts.done}/${t.rows.length}` : ''}`; }
  if (chip.textContent !== txt) chip.textContent = txt;
  chip.classList.toggle('warn', !st.show);
}

// ── 쪽 ──
function renderAssignPage() {
  assignAdminBoot();
  const box = document.getElementById('assign-page');
  if (!box) return;
  if (!box.dataset.ready) {
    box.dataset.ready = '1';
    box.innerHTML = `
      <div class="asg-toolbar">
        <div class="asg-tb-title">📝 과제 · 수업<span class="text-muted-sm">우리 반 모두에게 같은 문제를 보내고 결과를 봐요 · 보상 없음</span></div>
        <button class="btn-sm" onclick="assignNew()">+ 새 과제</button>
        <button class="btn-sm outline" onclick="assignOpenTV()">📺 TV 화면 열기</button>
        <label class="asg-mask-tog" title="선생님 화면을 TV 에 비출 때 아이 이름 · 점수를 가려요"><input type="checkbox" id="asg-mask" onchange="assignMaskToggle(this.checked)"> 이름 가리기 (TV 비추는 중)</label>
      </div>
      <div id="asg-stale"></div><div id="asg-live"></div><div id="asg-create"></div><div id="asg-lists"></div><div id="asg-result"></div>`;
  }
  const m = document.getElementById('asg-mask'); if (m) m.checked = _assignMasked();
  //  [ASSIGN-APPS-1] 학습 앱 목록(코딩 판 · 음악 곡)을 쪽을 열 때 미리 읽는다 — 고르기 칸을 처음 열 때 다시 그리기로 첫 클릭이 빠지지 않게
  for (const a of Object.values(ASSIGN_APPS)) { try { if (a.preload) a.preload(); } catch (e) { console.warn('[ASSIGN-APPS-1]', e); } }
  if (!_AS.db) {
    document.getElementById('asg-lists').innerHTML = `<div class="table-card"><div class="asg-empty">연결을 기다리는 중이에요…</div></div>`;
    return;
  }
  _assignRenderCreate();
  _assignRenderStale(); _assignRenderLive(); _assignRenderLists(); _assignRenderResult();
}
function assignMaskToggle(on) { _AS.mask = !!on; _assignRenderBits(true); }

// ── 멈춘 수업 · 시간 지남 ──
function _assignRenderStale() {
  const el = document.getElementById('asg-stale');
  if (!el) return;
  const live = _AS.live;
  if (!live || live.on !== true) { el.innerHTML = ''; return; }
  const def = _AS.open[live.aid];
  const st = AssignCore.liveState(live, def, undefined, { now: _assignNow(), hosts: _AS.hosts });
  let html = '';
  if (st.why === 'stale') html = `<div class="asg-alert"><b>⚠️ 지난 수업이 아직 켜져 있어요 — ${escHtml(def ? def.title : '정의 없는 수업')}</b>
      <span>선생님 화면이 15분 넘게 꺼져 있어서 아이 화면은 지금 덮여 있지 않아요. 이어 하면 로그인한 아이 화면이 다시 덮여요.</span>
      <div class="asg-btns">${def ? `<button class="btn-sm" onclick="assignLiveResume()">이어 하기</button>` : ''}<button class="btn-sm danger" onclick="assignLiveEnd()">끝내기</button></div></div>`;
  else if (st.why === 'expired') html = `<div class="asg-alert"><b>⏰ 수업 안전 시간이 지나 아이 화면이 풀렸어요</b>
      <div class="asg-btns"><button class="btn-sm" onclick="assignLiveExtend()">10분 더</button><button class="btn-sm danger" onclick="assignLiveEnd()">끝내기</button></div></div>`;
  else if (st.why === 'appOff') html = `<div class="asg-alert"><b>⚠️ ${escHtml(def.title)} — ${_assignInboxOnlyNote(def.kind)}</b><span>아이 화면은 덮이지 않아요.</span>
      <div class="asg-btns"><button class="btn-sm danger" onclick="assignLiveEnd()">끝내기</button></div></div>`;
  else if (st.why === 'noDef') html = `<div class="asg-alert"><b>⚠️ 과제 정의가 없는 수업이 켜져 있어요</b><span>아이 화면은 덮이지 않아요.</span>
      <div class="asg-btns"><button class="btn-sm danger" onclick="assignLiveEnd(false, true)">끝내기</button></div></div>`;
  if (el.innerHTML !== html) el.innerHTML = html;
}

// ── 수업 띠 ──
function _assignRenderLive() {
  const el = document.getElementById('asg-live');
  if (!el) return;
  const live = _AS.live, def = live && live.on === true ? _AS.open[live.aid] : null;
  if (!def) { el.innerHTML = ''; return; }
  const st = AssignCore.liveState(live, def, undefined, { now: _assignNow(), hosts: _AS.hosts });
  const roster = _assignRoster(def), R = _AS.results[def.id] || {}, P = _AS.presence || {}, E = _AS.excused || {};
  const t = AssignCore.tally(def, R, roster, { revealed: live.revealAt || def.revealed, excused: E });
  const present = roster.filter(x => P[x.sid] && Object.keys(P[x.sid]).length);
  const absent = roster.filter(x => !E[x.sid] && !(P[x.sid] && Object.keys(P[x.sid]).length));
  const battling = present.filter(x => Object.values(P[x.sid]).some(v => v && v.b));
  const away = present.filter(x => Object.values(P[x.sid]).every(v => v && v.v === 'h'));
  const step = live.pacing === 'step', n = def.n, s = Math.floor(Number(live.step)), ph = String(live.phase || '');
  const left = Math.max(0, Math.round((AssignCore.endsAtOf(live) - _assignNow()) / 60000));
  const where = !step ? (ph === 'summary' ? '결과 보는 중' : '각자 풀기') : s < 0 ? '기다림' : ph === 'summary' ? '정리' : `${s + 1} / ${n}번 · ${ph === 'reveal' ? '답 공개' : '답 받는 중'}`;
  const names = list => _assignMasked() ? `${list.length}명` : list.map(x => escHtml(x.name)).join(' · ');
  let mid = '';
  if (step && s >= 0 && s < n) {
    const it = def.content.quiz.items[s], is = t.items[s];
    const sent = roster.filter(x => !E[x.sid] && AssignCore.ansAt(R[x.sid], s)).length;
    const dist = it.type === 'choice'
      ? is.dist.map(d => `<span class="asg-dist-chip${d.ok ? ' ok' : ''}${is.topWrong && is.topWrong.ci === d.ci ? ' top' : ''}">${ASSIGN_NUM[d.ci] || d.ci + 1} ${d.c}</span>`).join('')
      : `<span class="asg-dist-chip ok">맞음 ${is.ok}</span>${is.wrongTop.map(w => `<span class="asg-dist-chip">${escHtml(w.v)} ${w.c}</span>`).join('')}`;
    const wrongWho = it.type === 'choice' && is.topWrong && !_assignMasked()
      ? `<div class="asg-live-who">${AssignCore.isOX(it) ? (is.topWrong.v === 'O' ? "'맞아요'를" : "'틀려요'를") : ASSIGN_NUM[is.topWrong.ci] + AssignCore.choiceJosa(is.topWrong.ci)} 고른 아이: ${roster.filter(x => { const a = AssignCore.ansAt(R[x.sid], s); return a && a.ci === is.topWrong.ci && !AssignCore.isLate(a, live.revealAt, s); }).map(x => escHtml(x.name)).join(' · ')}</div>` : '';
    mid = `<div class="asg-live-q"><span class="asg-live-qn">${s + 1}번</span> ${escHtml(it.q.slice(0, 90))}${it.q.length > 90 ? '…' : ''}</div>
      <div class="asg-live-row"><b>냈어요 ${sent} / ${present.length}</b>${is.late ? ` · 공개 뒤 ${is.late}` : ''}<span class="asg-live-sep"></span><span class="text-muted-sm">선생님만 보는 분포</span> ${dist}</div>${wrongWho}`;
  } else if (!step) {
    mid = `<div class="asg-live-row"><b>다 한 아이 ${t.counts.done} / ${roster.length}</b> · 하는 중 ${t.counts.doing} · 안 함 ${t.counts.none}${t.counts.excused ? ` · 빠짐 ${t.counts.excused}` : ''}</div>`;
    const A = _assignApp(def.kind);
    if (A && A.liveRow && !_assignMasked()) mid += A.liveRow(def, t);   // [ASSIGN-APPS-1] 앱마다 한 줄(리듬 = 정확도 평균 · 등급)
  }
  const ctl = step
    ? `<button class="btn-sm outline" onclick="assignLivePrev()" ${s <= 0 ? 'disabled' : ''}>◀ 앞</button>
       ${s >= 0 && s < n && ph === 'answer' ? `<button class="btn-sm gold" onclick="assignLiveReveal()">답 공개</button>` : ''}
       ${ph !== 'summary' ? `<button class="btn-sm" onclick="assignLiveNext()">${s < 0 ? '첫 문제 ▶' : s >= n - 1 ? '정리 ▶' : '다음 ▶'}</button>` : ''}`
    : def.kind !== 'quiz' ? `<span class="text-muted-sm">${(_assignApp(def.kind) || {}).liveCtl || '아이들이 각자 해요 · 다 한 아이는 더 해 보거나 기다려요'}</span>`
    : (ph !== 'summary' ? `<button class="btn-sm gold" onclick="assignLiveSummary()">결과 보기</button>` : '<span class="text-muted-sm">다 한 아이는 자기 답과 정답을 보고 있어요</span>');
  const html = `<div class="asg-live-card">
    <div class="asg-live-top"><span class="asg-live-dot"></span><b>지금 수업 중</b> · ${escHtml(def.title)} · ${step ? '한 문제씩' : '각자 풀기'} · ${where}
      <span class="text-muted-sm">남은 시간 ${left}분</span>${st.why === 'waitHost' ? '<span class="asg-warn">교사 화면 연결 확인 중</span>' : ''}</div>
    <div class="asg-live-row">들어온 아이 <b>${present.length} / ${roster.filter(x => !E[x.sid]).length}</b>
      ${absent.length ? `<span class="asg-live-absent">안 들어옴: ${names(absent)} — 새로고침하라고 말해 주세요</span>` : ''}
      ${battling.length ? `<span class="asg-live-absent">⚔️ 전투 중 ${battling.length} — 새로고침하면 진 걸로 쳐져요</span>` : ''}
      ${away.length ? `<span class="asg-live-absent">다른 화면 봄 ${away.length}</span>` : ''}</div>
    ${mid}
    <div class="text-muted-sm asg-live-note">${ASSIGN_LIVE_NOTE}</div>
    <div class="asg-live-ctl">${ctl}
      <label class="asg-inline"><input type="checkbox" ${live.names ? 'checked' : ''} onchange="assignLiveNames(this.checked)"> TV 에 이름</label>
      <button class="btn-sm outline" onclick="assignLiveExtend()">10분 더</button>
      <button class="btn-sm outline" onclick="assignOpenTV()">📺 TV</button>
      <span class="asg-live-sep"></span>
      <label class="asg-inline" title="끝낼 때 다 못 한 아이에게 홈 카드로 남겨 이어서 풀게 해요"><input type="checkbox" id="asg-end-inbox" ${_AS.endInbox ? 'checked' : ''} onchange="assignEndInbox(this.checked)"> 못 한 아이는 과제함으로 남기기</label>
      <button class="btn-sm danger" onclick="assignLiveEnd()">끝내기</button></div></div>`;
  if (el.innerHTML !== html) el.innerHTML = html;
}

// ── 수업 조작(transaction — 그 단계일 때만) ──
function _assignTx(fn, what) {
  if (!_AS.db) return Promise.resolve(false);
  return _assignRef(AssignCore.path.live).transaction(cur => fn(cur)).then(r => {
    if (!r.committed) notify(`${what} — 이미 바뀌었어요(다른 화면이 먼저 눌렀어요)`, 'error');
    return r.committed;
  }).catch(e => { console.warn(e); notify(`⚠️ ${what}이 안 됐어요 — 인터넷을 확인하고 다시 눌러 주세요`, 'error'); return false; });
}
function _assignLiveNow() { const l = _AS.live; return l && l.on === true ? { l, def: _AS.open[l.aid], s: Math.floor(Number(l.step)), ph: String(l.phase || '') } : null; }
function assignLiveNext() { const x = _assignLiveNow(); if (x && x.def) _assignTx(AssignCore.ctl.next(x.l.aid, x.s, x.ph, x.def.n, _assignNow()), '다음'); }
function assignLivePrev() { const x = _assignLiveNow(); if (x) _assignTx(AssignCore.ctl.prev(x.l.aid, x.s, x.ph), '앞'); }
function assignLiveReveal() { const x = _assignLiveNow(); if (x) _assignTx(AssignCore.ctl.reveal(x.l.aid, x.s, _assignNow()), '답 공개'); }
function assignLiveSummary() { const x = _assignLiveNow(); if (x && x.def) _assignTx(AssignCore.ctl.summary(x.l.aid, x.s, x.ph, x.def.n), '결과 보기'); }
function assignLiveGoto(i) { const x = _assignLiveNow(); if (x) _assignTx(AssignCore.ctl.goto(x.l.aid, x.s, x.ph, i), '문제 보기'); }
function assignLiveExtend() { const x = _assignLiveNow(); if (x) _assignTx(AssignCore.ctl.extend(x.l.aid, 10, _assignNow()), '10분 더'); }
function assignLiveResume() { const x = _assignLiveNow(); if (x) _assignTx(AssignCore.ctl.resume(x.l.aid, _assignNow()), '이어 하기'); }
function assignLiveNames(on) { if (_AS.db && _AS.live && _AS.live.on) _assignRef('live/names').set(!!on).catch(() => {}); }
function assignExcuse(sid, on) {
  const x = _assignLiveNow();
  if (!x || !AssignCore.safeKey(sid)) return;
  _assignRef(AssignCore.path.excused(x.l.aid, sid)).set(on ? true : null).catch(() => notify('⚠️ 저장이 안 됐어요', 'error'));
}
//  끝내기 — live 를 끄고(transaction) 정의는 닫거나(archive) 못 한 아이에게 과제함으로 남긴다
//   toInbox: true(늘 과제함으로) · false(과제함에 안 남김 — 과제함에서 돌린 수업만 되돌림) · 없으면 '못 한 아이는 과제함으로 남기기' 칸(기본 켬 · 보스 결정 10-05)을 따른다 [ASSIGN-END-INBOX-2]
//   어떻게 둘지는 AssignCore.endPlan 한 함수(TV E 와 같음): 칸 켬 + 못 한 아이 있음 → 과제함 · 과제함에서 돌린 수업 → 과제함으로 되돌림 · 그 밖 → 닫기
function assignEndInbox(on) { _AS.endInbox = !!on; }
async function assignLiveEnd(toInbox, force) {
  const x = _assignLiveNow();
  if (!x) return;
  const aid = x.l.aid, raw = _AS.openRaw[aid], def = _AS.open[aid];
  const keep = toInbox === undefined ? _AS.endInbox : !!toInbox;
  const t = def ? AssignCore.tally(def, _AS.results[aid], _assignRoster(def)) : null;
  const plan = toInbox === true ? 'inbox' : AssignCore.endPlan(raw, t, keep);   // true = 못 한 아이가 없어도 과제함으로(옛 [끝내고 과제함으로])
  const left = t ? t.rows.filter(r => r.status !== 'done').length : 0;
  const msg = plan === 'inbox' ? `수업을 끝낼까요?\n아이 화면의 수업 방이 닫히고 하던 자리로 돌아가요.\n못 한 아이 ${left}명에게는 홈에 과제가 남아요(이어서 풀 수 있어요).`
    : plan === 'back' ? '수업을 끝낼까요?\n아이 화면의 수업 방이 닫히고 하던 자리로 돌아가요.\n이 과제는 원래대로 과제함에 남아요(안 한 아이는 홈 카드로 풀어요).'
    : `수업을 끝낼까요?\n아이 화면의 수업 방이 닫히고 하던 자리로 돌아가요.\n${keep && t ? '모두 다 해서 ' : ''}이 과제도 함께 닫혀요(아이 홈 카드가 사라져요 · 낸 답과 결과는 남아요).`;
  if (!confirm(msg)) return;
  const revealAt = x.l.revealAt || null;
  const ok = await _assignTx(AssignCore.ctl.end(force ? '' : aid, _assignNow()), '끝내기');
  if (!ok) return;
  if (!_AS.openRaw[aid]) return;
  if (plan === 'inbox' || plan === 'back') await _assignToInbox(aid, revealAt, plan === 'inbox');
  else await _assignClose(aid);
  notify(plan === 'inbox' ? '수업을 끝냈어요 — 못 한 아이는 과제함에서 이어 해요' : plan === 'back' ? '수업을 끝냈어요 — 과제는 과제함에 그대로 있어요' : '수업을 끝냈어요');
}
//  수업이 끝난 과제를 과제함으로 — fromLive: '수업 → 과제함' 표시(못 한 아이에게 남김) · fromInbox 표시는 지운다 [ASSIGN-END-INBOX-1]
function _assignToInbox(aid, revealAt, fromLive) {
  const u = { [`open/${aid}/deliver`]: 'inbox', [`open/${aid}/pacing`]: 'self', [`open/${aid}/fromInbox`]: null, [`open/${aid}/revealed`]: revealAt || null };
  if (fromLive) u[`open/${aid}/fromLive`] = true;
  return _assignRef('').update(u).catch(() => notify('⚠️ 과제함으로 남기기가 안 됐어요', 'error'));
}

// ── 목록 ──
function _assignKindLabel(def) {
  if (def.kind !== 'quiz') { const A = _assignApp(def.kind); return A && A.what ? A.what(def) : ASSIGN_KIND_LABEL[def.kind] || ''; }   // [ASSIGN-APPS-1] 앱이 정한 줄 머리(곡 이름 · 판 수)
  const sub = (() => { try { const s = CurriculumUtils.subjects().find(x => x.key === def.content.quiz.subject); return s ? s.label : ''; } catch (e) { return ''; } })();
  return `📝 ${escHtml(sub)} ${def.n}문제`;
}
function _assignDate(ms) { if (!ms) return ''; const k = new Date(Number(ms) + 9 * 3600000); return `${k.getUTCMonth() + 1}-${String(k.getUTCDate()).padStart(2, '0')}`; }
function _assignRenderLists() {
  const el = document.getElementById('asg-lists');
  if (!el) return;
  const list = Object.values(_AS.open).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const liveAid = _AS.live && _AS.live.on === true ? _AS.live.aid : '';
  const row = d => {
    const t = AssignCore.tally(d, _AS.results[d.id], _assignRoster(d));
    const isLive = d.id === liveAid;
    return `<tr class="${_AS.sel === d.id ? 'asg-sel' : ''}">
      <td><b>${escHtml(d.title)}</b><div class="text-muted-sm">${_assignKindLabel(d)} · ${isLive ? '<span class="asg-tag live">수업 중</span>' : d.fromLive ? '수업 → 과제함' : '과제함'} · ${_assignDate(d.createdAt)}${d.targets ? ` · ${d.targets.length}명` : ''}</div></td>
      <td class="nowrap">끝 ${t.counts.done} · 하는 중 ${t.counts.doing} · 안 함 ${t.counts.none}</td>
      <td class="td-actions"><button class="btn-sm outline" onclick="assignSelect('${d.id}')">결과</button>
        ${_assignLiveOK(d.kind) && !isLive ? `<button class="btn-sm outline" onclick="assignStartFrom('${d.id}')" title="이 과제를 반 전체가 지금 같이 풀어요">수업으로</button>` : ''}
        <button class="btn-sm outline" onclick="assignOpenTV('${d.id}')">TV</button>
        ${isLive ? '' : `<button class="btn-sm danger" onclick="assignCloseAsk('${d.id}')">닫기</button>`}</td></tr>
      ${_AS.startAsk === d.id ? `<tr class="asg-ask"><td colspan="3">지금 반 모두 같이 풀까요? 로그인한 아이 화면에 수업 방이 열려요 · ${d.kind !== 'quiz' ? `${(_assignApp(d.kind) || {}).startNote || '덮개 안에서 그 앱이 열려요'}${_assignReceivers(d) > ASSIGN_APP_LIVE_WARN ? ` · <b>받는 아이 ${_assignReceivers(d)}명 — 연결이 많아요</b>` : ''}` : '이미 낸 답은 건너뛰어요'}
        ${d.kind === 'quiz' ? `<button class="btn-sm" onclick="assignStartFromGo('${d.id}','step')">한 문제씩 같이</button>` : ''}<button class="btn-sm" onclick="assignStartFromGo('${d.id}','self')">각자 풀기</button>
        <button class="btn-sm outline" onclick="assignStartFrom('')">그만</button></td></tr>` : ''}`;
  };
  const arch = _AS.archOpen ? Object.values(_AS.archRaw || {}).map(r => AssignCore.normDef(r, r && r.id)).filter(Boolean)
    .sort((a, b) => (b.closedAt || b.createdAt || 0) - (a.closedAt || a.createdAt || 0)) : [];
  const html = `<div class="table-card">
      <div class="tc-header"><div class="tc-title">열린 과제 ${list.length}개</div><div class="text-muted-sm">아이 홈 '오늘' 맨 위에 카드로 떠요 · 닫으면 카드가 사라져요(결과는 남아요)</div></div>
      ${list.length ? `<table><tbody>${list.map(row).join('')}</tbody></table>` : `<div class="asg-empty">열린 과제가 없어요 — [+ 새 과제]로 만들어요</div>`}
    </div>
    <div class="table-card">
      <div class="tc-header"><button class="asg-link" onclick="assignArchiveToggle()">닫은 과제 ${_AS.archOpen ? '▾' : '▸'}</button><span class="text-muted-sm">최근 30개 · 펼칠 때 읽어요</span></div>
      ${_AS.archOpen ? (arch.length ? `<table><tbody>${arch.map(d => `<tr class="${_AS.sel === d.id ? 'asg-sel' : ''}"><td><b>${escHtml(d.title)}</b><div class="text-muted-sm">${_assignKindLabel(d)} · ${_assignDate(d.createdAt)} → 닫음 ${_assignDate(d.closedAt)}</div></td>
          <td class="td-actions"><button class="btn-sm outline" onclick="assignSelect('${d.id}')">결과</button><button class="btn-sm outline" onclick="assignReopen('${d.id}')">다시 열기</button></td></tr>`).join('')}</tbody></table>`
        : `<div class="asg-empty">${_AS.archive === 'loading' ? '읽는 중…' : '닫은 과제가 없어요'}</div>`) : ''}
    </div>`;
  if (el.innerHTML !== html) el.innerHTML = html;
}
function assignArchiveToggle() {
  _AS.archOpen = !_AS.archOpen;
  if (_AS.archOpen) {
    _AS.archive = 'loading';
    _assignRef('archive').orderByKey().limitToLast(30).once('value').then(s => { _AS.archRaw = s.val() || {}; _AS.archive = 'ok'; _assignRenderBits(true); })
      .catch(() => { _AS.archive = 'err'; _assignRenderBits(true); });
  }
  _assignRenderBits(true);
}
function assignSelect(aid) { _AS.sel = _AS.sel === aid ? '' : aid; _AS.selItem = -1; _AS.selStu = ''; _assignSyncResults(); _assignRenderBits(true);
  if (_AS.sel) setTimeout(() => { const r = document.getElementById('asg-result'); if (r && r.scrollIntoView) r.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80); }
function assignCloseAsk(aid) {
  const d = _AS.open[aid];
  if (!d || !confirm(`'${d.title}' 과제를 닫을까요?\n아이 홈에서 카드가 사라져요. 낸 답과 결과는 그대로 남아요.`)) return;
  _assignClose(aid).then(() => notify('과제를 닫았어요'));
}
function _assignClose(aid) {
  const raw = _AS.openRaw[aid];
  if (!raw) return Promise.resolve();
  return _assignRef('').update({ [`open/${aid}`]: null, [`archive/${aid}`]: { ...raw, closedAt: _assignTS() } }).catch(() => notify('⚠️ 닫기가 안 됐어요', 'error'));
}
function assignReopen(aid) {
  const raw = (_AS.archRaw || {})[aid];
  if (!raw) return;
  _assignRef('').update({ [`archive/${aid}`]: null, [`open/${aid}`]: { ...raw, closedAt: null, deliver: 'inbox', pacing: 'self', fromInbox: null } })
    .then(() => { delete _AS.archRaw[aid]; notify('다시 열었어요 — 아이 홈에 카드가 떠요'); _assignRenderBits(true); }).catch(() => notify('⚠️ 다시 열기가 안 됐어요', 'error'));
}
//  열린 과제를 그대로 수업으로(같은 결과 칸 — 이미 낸 답은 건너뛴다)
function assignStartFrom(aid) {
  const d = aid ? _AS.open[aid] : null;
  if (d && !_assignLiveOK(d.kind)) { _AS.startAsk = ''; notify('📥 ' + _assignInboxOnlyNote(d.kind)); return; }   // 스위치가 꺼진 학습 앱 [ASSIGN-LIVE-APPS-1]
  _AS.startAsk = _AS.startAsk === aid ? '' : aid; _assignRenderBits(true);
}
function assignStartFromGo(aid, pacing) {
  _AS.startAsk = '';
  if (!_AS.open[aid] || !_AS.openRaw[aid]) return;
  _assignStartLive({ ..._AS.openRaw[aid], pacing: pacing === 'step' ? 'step' : 'self', deliver: 'live' }, AssignCore.MIN_DEFAULT, true, true);
}

// ── 결과 ──
function _assignRenderResult() {
  const el = document.getElementById('asg-result');
  if (!el) return;
  const aid = _AS.sel;
  const def = aid ? (_AS.open[aid] || AssignCore.normDef((_AS.archRaw || {})[aid], aid)) : null;
  if (!def) { if (el.innerHTML) el.innerHTML = ''; return; }
  const roster = _assignRoster(def), R = _AS.results[aid] || {};
  const liveOn = _AS.live && _AS.live.on === true && _AS.live.aid === aid;
  const revealed = liveOn ? (_AS.live.revealAt || def.revealed) : def.revealed;
  const t = AssignCore.tally(def, R, roster, { revealed, excused: liveOn ? _AS.excused : {} });
  const avg = AssignCore.avgText(def, t, '아이');   // [ASSIGN-AVG-1] 종류마다 뜻이 다른 반 평균(TV 와 같은 셈 · 이름 없는 반 숫자라 가리기 중에도 보임)
  const head = `<div class="tc-header"><div class="tc-title">${escHtml(def.title)} <span class="text-muted-sm">${_assignKindLabel(def)} · 받는 아이 ${t.rows.length}명 · 끝 ${t.counts.done} · 하는 중 ${t.counts.doing} · 안 함 ${t.counts.none}${avg ? ' · ' + avg : ''}</span></div>
    <div class="tc-actions"><button class="btn-sm outline" onclick="assignOpenTV('${aid}')">TV 로 보기</button><button class="btn-sm outline" onclick="assignSelect('${aid}')">접기</button></div></div>`;
  let body;
  if (def.kind !== 'quiz') body = _assignAppResultHTML(def, t, liveOn);   // [ASSIGN-APPS-1] 학습 앱 — 공용 틀 + 앱 칸
  else {
    const n = def.n, mask = _assignMasked();
    const cell = (a) => !a ? '<td class="asg-c none">·</td>' : a.skip ? '<td class="asg-c skip" title="건너뜀">⤼</td>'
      : `<td class="asg-c ${a.ok ? 'ok' : 'no'}${a.late ? ' late' : ''}" title="${escHtml(a.a)}${a.late ? ' (공개 뒤)' : ''}">${a.ok ? '✓' : '✗' + (a.ci != null && a.ci >= 0 ? (ASSIGN_NUM[a.ci] || '') : '')}${a.late ? '⏰' : ''}</td>`;
    const rows = [...t.rows, ...t.outside].map((r, i) => `<tr class="${r.excused ? 'asg-ex' : ''}"><td class="td-name">${_assignRowName(r, i, liveOn)}</td>
      <td>${_assignStatus(r)}</td><td class="nowrap">${mask ? '●' : r.status === 'none' ? '-' : `${r.correct}/${n}`}</td>
      <td class="nowrap">${mask || r.ms == null || def.pacing === 'step' ? '-' : _assignMs(r.ms)}</td>
      ${mask ? `<td colspan="${n}" class="text-muted-sm">이름 가리기 중</td>` : r.items.map(cell).join('')}</tr>`).join('');
    const rateRow = `<tr class="asg-rate"><td colspan="4">맞힌 비율(낸 아이 중) · 누르면 그 문제</td>${t.items.map(s => `<td class="asg-c rate${s.i === t.hardest ? ' hard' : ''}${_AS.selItem === s.i ? ' on' : ''}" onclick="assignItem(${s.i})">${s.rate == null ? '—' : s.rate + '%'}</td>`).join('')}</tr>`;
    const headRow = `<tr><th>이름</th><th>상태</th><th>점수</th><th>걸린 시간</th>${def.content.quiz.items.map((_, i) => `<th class="asg-c">${i + 1}</th>`).join('')}</tr>`;
    body = `<div class="asg-table-wrap"><table class="asg-table"><thead>${headRow}</thead><tbody>${rows}${rateRow}</tbody></table></div>${_assignItemHTML(def, t, R, roster, revealed, liveOn)}`;
  }
  const html = `<div class="table-card asg-result">${head}${body}</div>`;
  if (el.innerHTML !== html) el.innerHTML = html;
}
//  결과 표 이름 칸(문제 묶음 · 학습 앱 공용) — 명단 밖 이름도 가리기를 따른다 · 수업 중이면 [빼기 / 다시 넣기](보건실 · 화장실)
function _assignRowName(r, i, liveOn) {
  return `${r.outside ? `<span class="text-muted-sm">명단 밖</span> ${_assignNameHTML(r.name || r.sid, i)}` : _assignNameHTML(r.name, i)}${r.excused ? ' <span class="asg-tag">빠짐</span>' : ''}${liveOn && !r.outside ? ` <button class="asg-mini" onclick="assignExcuse('${escJsAttr(r.sid)}', ${r.excused ? 'false' : 'true'})">${r.excused ? '다시 넣기' : '빼기'}</button>` : ''}`;
}
//  [ASSIGN-APPS-1] 학습 앱 결과 표 — 틀(명단 차례 · 이름 · 상태 · 이름 가리기 · 빼기)은 하나, 칸은 앱이(cols · cells · top · foot · after)
function _assignAppResultHTML(def, t, liveOn) {
  const A = _assignApp(def.kind), mask = _assignMasked(), all = [...t.rows, ...t.outside];
  const cols = A ? A.cols(def) : ['<th>점수</th>', '<th>실행 · 판</th>', '<th>자세히</th>'];
  const cells = r => A ? A.cells(r, def) : `<td>${r.status === 'none' ? '-' : `${r.correct} / ${r.total}`}</td><td>${r.attempts || 0}</td><td class="text-muted-sm">${escHtml(Object.keys(r.detail || {}).join(' · '))}</td>`;
  const rows = all.map((r, i) => `<tr class="${r.excused ? 'asg-ex' : ''}"><td class="td-name">${_assignRowName(r, i, liveOn)}</td><td>${_assignStatus(r)}</td>${mask ? `<td colspan="${cols.length}" class="text-muted-sm">이름 가리기 중</td>` : cells(r)}</tr>`).join('');
  const foot = !mask && A && A.foot ? A.foot(def, t, 2) : '';
  return `${!mask && A && A.top ? A.top(def, t) : ''}<div class="asg-table-wrap"><table class="asg-table asg-app-table asg-${(A && A.cls) || def.kind}-table"><thead><tr><th>이름</th><th>상태</th>${cols.join('')}</tr></thead><tbody>${rows}${foot}</tbody></table></div>${!mask && A && A.after ? A.after(def, all) : ''}`;
}
function _assignStatus(r) { return r.status === 'done' ? '<span class="tag approved">끝</span>' : r.status === 'doing' ? '<span class="tag pending">하는 중</span>' : '<span class="tag wait">안 함</span>'; }
function _assignMs(ms) { const s = Math.round(ms / 1000); return s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`; }
function assignItem(i) { _AS.selItem = _AS.selItem === i ? -1 : i; _assignRenderBits(); }
//  문제 하나 — 보기별 막대 · 정답 초록 · 가장 많이 고른 오답 주황 · 그 보기를 고른 아이(교사 화면만 · 이름 가리기 중엔 숨김)
function _assignItemHTML(def, t, R, roster, revealed, liveOn) {
  const i = _AS.selItem;
  if (i < 0 || i >= def.n) return '';
  const it = def.content.quiz.items[i], s = t.items[i], mask = _assignMasked();
  const max = Math.max(1, ...s.dist.map(d => d.c), ...(s.wrongTop || []).map(w => w.c), s.ok);
  const who = pred => mask ? '' : roster.filter(x => { const a = AssignCore.ansAt(R[x.sid], i); return a && !a.skip && !AssignCore.isLate(a, revealed, i) && pred(a); }).map(x => escHtml(x.name)).join(' · ');
  const bars = it.type === 'choice'
    ? s.dist.map(d => `<div class="asg-bar-row${d.ok ? ' ok' : ''}${s.topWrong && s.topWrong.ci === d.ci ? ' top' : ''}"><span class="asg-bar-l">${ASSIGN_NUM[d.ci] || d.ci + 1} ${escHtml(d.v)}${d.ok ? ' ✓' : ''}</span>
        <span class="asg-bar-b"><i style="width:${Math.round(d.c / max * 100)}%"></i></span><span class="asg-bar-n">${d.c}명</span>
        ${!d.ok && d.c ? `<span class="asg-bar-who">${who(a => a.ci === d.ci)}</span>` : ''}</div>`).join('')
    : `<div class="asg-bar-row ok"><span class="asg-bar-l">정답 ${escHtml(it.a)} ✓</span><span class="asg-bar-b"><i style="width:${Math.round(s.ok / max * 100)}%"></i></span><span class="asg-bar-n">${s.ok}명</span></div>
       ${s.wrongTop.map((w, k) => `<div class="asg-bar-row${k === 0 && w.c >= 2 ? ' top' : ''}"><span class="asg-bar-l">${escHtml(w.v)}</span><span class="asg-bar-b"><i style="width:${Math.round(w.c / max * 100)}%"></i></span><span class="asg-bar-n">${w.c}명</span>
         <span class="asg-bar-who">${who(a => !a.ok && AssignCore.normAns(a.a) === AssignCore.normAns(w.v))}</span></div>`).join('')}`;
  const fig = it.fig && typeof Figures !== 'undefined' ? `<div class="asg-fig">${Figures.render(it.fig)}</div>` : '';
  return `<div class="asg-item">
    <div class="asg-item-q"><b>${i + 1}번</b> <span class="text-muted-sm">${ASSIGN_TYPE_LABEL[it.type] || ''}${it.cat ? ' · ' + escHtml(ASSIGN_CAT_LABEL[it.cat] || it.cat) : ''}${it.audio ? ' · 소리' : ''}</span>
      <div class="asg-item-text">${escHtml(it.q)}</div>${fig}</div>
    ${bars}
    <div class="text-muted-sm">낸 아이 ${s.n}명${s.rate != null ? ` · 맞힘 ${s.rate}%` : ''}${s.late ? ` · 공개 뒤 ${s.late}명(셈에서 뺌)` : ''}${s.skip ? ` · 건너뜀 ${s.skip}` : ''}${it.hint ? ` · 💡 ${escHtml(it.hint)}` : ''}</div>
    ${liveOn && _AS.live.pacing === 'step' && _AS.live.phase === 'summary' ? `<button class="btn-sm outline" onclick="assignLiveGoto(${i})">이 문제를 아이 · TV 화면에 다시 보이기</button>` : ''}
  </div>`;
}

// ── TV ──
function assignOpenTV(aid) {
  try { sessionStorage.setItem('assign.teacher', '1'); } catch (e) {}
  const url = 'assign/index.html' + (aid && AssignCore.safeAid(aid) ? '#/a/' + aid : '#/');
  const w = window.open(url, 'assign-tv');
  if (!w) notify('팝업이 막혔어요 — 주소창 오른쪽에서 팝업을 허용해 주세요', 'error');
}

// ══ 만들기 ═══════════════════════════════════════════
function assignNew() {
  if (!_AS.db) { notify('연결을 기다리는 중이에요', 'error'); return; }
  const subs = (typeof CurriculumUtils !== 'undefined') ? CurriculumUtils.subjects() : [];
  //  과제 id 는 창을 열 때 정한다 — [보내기]를 여러 번 눌러도 같은 자리에 쓰여 과제가 하나(멱등)
  _AS.draft = { aid: AssignCore.newId(_assignNow()), kind: 'quiz', subject: (subs.find(s => s.key === 'math') || subs[0] || {}).key || 'math',
    how: 'pick', picked: [], units: [], n: 10, cat: '', drawn: null, q: '', openUnit: '', preview: '',
    title: '', titleTouched: false, who: 'all', targets: [], deliver: 'inbox', pacing: 'self', minutes: AssignCore.MIN_DEFAULT, showAnswer: true,
    coding: { stages: [] }, music: { song: '', level: 'easy', tempo: 1, keys: 0 } };
  _assignRenderCreate();
  setTimeout(() => { const c = document.getElementById('asg-create'); if (c && c.scrollIntoView) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
}
function assignCancel() { _AS.draft = null; _assignRenderCreate(); }
function _assignBank(subject) {
  if (typeof CurriculumUtils === 'undefined') return [];
  return CurriculumUtils.problemsBySubject(subject);
}
function _assignUnits(subject) { try { return (CurriculumUtils.subjects().find(s => s.key === subject) || {}).units || []; } catch (e) { return []; } }
function _assignPicked(d) {
  if (d.kind !== 'quiz') return [];
  const all = new Map(_assignBank(d.subject).map(p => [p.id, p]));
  if (d.how === 'auto') return (d.drawn || []).map(id => all.get(id)).filter(Boolean);
  return d.picked.map(id => all.get(id)).filter(Boolean);
}
function _assignAutoTitle(d) {
  if (d.kind !== 'quiz') { const A = _assignApp(d.kind); return String(A && A.autoTitle ? A.autoTitle(d) : (ASSIGN_KIND_LABEL[d.kind] || '').replace(/^\S+ /, '')).slice(0, AssignCore.TITLE_MAX); }
  const sub = (CurriculumUtils.subjects().find(s => s.key === d.subject) || {}).label || '';
  const items = _assignPicked(d), units = [...new Set(items.map(p => p.unitId))];
  const uName = units.length === 1 ? ((CurriculumUtils.unitById(units[0]) || {}).name || '') : units.length ? '여러 단원' : '';
  return `${sub}${uName ? ' · ' + uName : ''} ${items.length || (d.how === 'auto' ? d.n : 0)}문제`.slice(0, AssignCore.TITLE_MAX);
}
function _assignRenderCreate() {
  const el = document.getElementById('asg-create');
  if (!el) return;
  const d = _AS.draft;
  if (!d) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="table-card asg-create">
    <div class="tc-header"><div class="tc-title">새 과제</div><button class="btn-sm outline" onclick="assignCancel()">✕ 닫기</button></div>
    <div class="asg-c-sec"><div class="asg-c-h">① 무엇을</div><div id="asg-c-kind"></div><div id="asg-c-what"></div></div>
    <div class="asg-c-sec"><div class="asg-c-h">② 이름 · ③ 누구에게 · ④ 어떻게</div><div id="asg-c-meta"></div></div>
  </div>`;
  _assignCKind(); _assignCWhat(); _assignCMeta();
}
function _assignCKind() {
  const d = _AS.draft, el = document.getElementById('asg-c-kind');
  if (!d || !el) return;
  const k = (key, label, ready) => `<button class="asg-seg${d.kind === key ? ' on' : ''}" ${ready ? `onclick="assignDraft('kind','${key}')"` : 'disabled title="앱 쪽 준비가 끝나면 열려요(다음 단계)"'}>${label}${ready ? '' : ' <small>곧</small>'}</button>`;
  el.innerHTML = `<div class="asg-segs">${AssignCore.KINDS.map(x => k(x, ASSIGN_KIND_LABEL[x] || x, _assignKindReady(x))).join('')}</div>`;
}
function assignDraft(key, val) {
  const d = _AS.draft;
  if (!d) return;
  if (key === 'kind') { d.kind = val; if (val !== 'quiz') d.pacing = 'self'; if (!_assignLiveOK(val)) d.deliver = 'inbox'; _assignCKind(); _assignCWhat(); _assignCMeta(); return; }
  if (key === 'subject') { d.subject = val; d.picked = []; d.units = []; d.drawn = null; d.cat = ''; d.openUnit = ''; d.q = ''; _assignCWhat(); _assignCMeta(); return; }
  if (key === 'how') { d.how = val; d.drawn = null; _assignCWhat(); _assignCMeta(); return; }
  if (key === 'n') { d.n = Math.max(1, Math.min(AssignCore.ITEMS_MAX, Number(val) || 10)); d.drawn = null; _assignCWhat(); _assignCMeta(); return; }
  if (key === 'cat') { d.cat = val; d.drawn = null; _assignCWhat(); _assignCMeta(); return; }
  if (key === 'title') { d.title = String(val || '').slice(0, AssignCore.TITLE_MAX); d.titleTouched = !!d.title; return; }
  if (key === 'who') { d.who = val; _assignCMeta(); return; }
  if (key === 'deliver') { d.deliver = val; if (val === 'inbox') d.pacing = 'self'; _assignCMeta(); return; }
  if (key === 'pacing') { d.pacing = d.kind === 'quiz' ? val : 'self'; _assignCMeta(); return; }
  if (key === 'minutes') { d.minutes = Number(val) || AssignCore.MIN_DEFAULT; return; }
  if (key === 'showAnswer') { d.showAnswer = !!val; return; }
}
function _assignTypeChips(p) {
  const c = [ASSIGN_TYPE_LABEL[p.type] || p.type];
  if (p.audio) c.push('소리'); if (p.fig) c.push('그림'); if (p.passageId) c.push('지문');
  return c.map(x => `<span class="asg-chip">${x}</span>`).join('');
}
function _assignCWhat() {
  const d = _AS.draft, el = document.getElementById('asg-c-what');
  if (!d || !el) return;
  if (d.kind !== 'quiz') {   // [ASSIGN-APPS-1] 학습 앱 — 고르기 칸은 그 앱이(#asg-pick-<종류>)
    const A = _assignApp(d.kind);
    el.innerHTML = `<div id="asg-pick-${d.kind}" class="asg-slot${A ? ' asg-slot-app' : ''}">${A ? A.picker(d) : '앱 쪽이 붙으면 여기에 고르기 칸이 떠요'}</div>`;
    return;
  }
  const subs = CurriculumUtils.subjects();
  const top = `<div class="asg-c-row"><label>과목 <select class="form-select asg-sel-sm" onchange="assignDraft('subject', this.value)">${subs.map(s => `<option value="${s.key}" ${s.key === d.subject ? 'selected' : ''}>${escHtml(s.label)}</option>`).join('')}</select></label>
    <span class="asg-segs small"><button class="asg-seg${d.how === 'pick' ? ' on' : ''}" onclick="assignDraft('how','pick')">직접 고르기</button><button class="asg-seg${d.how === 'auto' ? ' on' : ''}" onclick="assignDraft('how','auto')">자동 뽑기</button></span>
    ${d.subject === 'english' ? '<span class="text-muted-sm">영어는 오늘의 학습에서 숨겨 둔 과목이에요 — 과제로는 보낼 수 있어요</span>' : ''}</div>`;
  el.innerHTML = top + (d.how === 'auto' ? _assignAutoHTML(d) : _assignPickHTML(d));
}
// 직접 고르기 — 단원을 펼치면 문제 줄(□ · 형식 · 물음 앞 60자 · 미리 보기). 지문 문항은 지문 세트로 한 줄(세트 통째)
function _assignPickHTML(d) {
  const units = _assignUnits(d.subject), bank = _assignBank(d.subject), q = d.q.trim();
  const picked = new Set(d.picked);
  const cats = [...new Set(bank.map(p => p.cat))];
  const match = p => (!d.cat || p.cat === d.cat) && (!q || String(p.q).includes(q) || String(p.a).includes(q));
  const unitHTML = u => {
    const ps = bank.filter(p => p.unitId === u.id);
    const sel = ps.filter(p => picked.has(p.id)).length;
    const open = d.openUnit === u.id || !!q;
    const shown = ps.filter(match);
    if (q && !shown.length) return '';
    const sets = {}, singles = [];
    for (const p of shown) { if (p.passageId) (sets[p.passageId] = sets[p.passageId] || []).push(p); else singles.push(p); }
    const rowP = p => `<div class="asg-prow${picked.has(p.id) ? ' on' : ''}"><label><input type="checkbox" ${picked.has(p.id) ? 'checked' : ''} onchange="assignPick('${escJsAttr(p.id)}', this.checked)">
        ${_assignTypeChips(p)}<span class="asg-pq">${escHtml(String(p.q).replace(/\s+/g, ' ').slice(0, 60))}</span></label>
        <button class="asg-mini" onclick="assignPreview('${escJsAttr(p.id)}')">미리 보기</button></div>${d.preview === p.id ? _assignPreviewHTML(p) : ''}`;
    const rowS = (pid, list) => {
      const all = bank.filter(p => p.passageId === pid), on = all.every(p => picked.has(p.id));
      const title = (typeof READING_PASSAGES !== 'undefined' && (READING_PASSAGES.find(x => x.id === pid) || {}).title) || '지문';
      return `<div class="asg-prow set${on ? ' on' : ''}"><label><input type="checkbox" ${on ? 'checked' : ''} onchange="assignPickSet('${escJsAttr(pid)}', this.checked)">
        <span class="asg-chip">지문 세트</span><span class="asg-pq">📖 ${escHtml(title)} · 문항 ${all.length}개(통째로)</span></label></div>`;
    };
    return `<div class="asg-unit"><button class="asg-unit-h" onclick="assignOpenUnit('${escJsAttr(u.id)}')">${open ? '▾' : '▸'} ${u.no ? u.no + '. ' : ''}${escHtml(u.name)} <span class="text-muted-sm">문제 ${ps.length}${sel ? ` · 고름 ${sel}` : ''}</span></button>
      ${open ? `<div class="asg-plist">${Object.keys(sets).map(pid => rowS(pid, sets[pid])).join('')}${singles.map(rowP).join('')}</div>` : ''}</div>`;
  };
  return `<div class="asg-c-row"><input class="form-input asg-find" placeholder="문제 찾기(물음 · 정답 글자)" value="${escHtml(d.q)}" oninput="assignFind(this.value)">
      <span class="asg-chips">${['', ...cats].map(c => `<button class="asg-chip-btn${d.cat === c ? ' on' : ''}" onclick="assignDraft('cat','${escJsAttr(c)}')">${c ? escHtml(ASSIGN_CAT_LABEL[c] || c) : '모든 성격'}</button>`).join('')}</span></div>
    <div id="asg-c-units" class="asg-units">${units.map(unitHTML).join('') || '<div class="asg-empty">문제가 없어요</div>'}</div>
    <div id="asg-c-sel">${_assignSelHTML(d)}</div>`;
}
function _assignSelHTML(d) {
  const items = _assignPicked(d);
  if (!items.length) return `<div class="asg-sel-box empty">고른 문제가 없어요 — 단원을 펼쳐 □ 를 눌러요</div>`;
  return `<div class="asg-sel-box"><div class="asg-sel-h"><b>고른 문제 ${items.length}개</b>${items.length > AssignCore.ITEMS_MAX ? ` <span class="asg-warn">최대 ${AssignCore.ITEMS_MAX}개</span>` : ''}
      ${d.how === 'pick' ? `<button class="asg-mini" onclick="assignShufflePicked()">섞기</button><button class="asg-mini" onclick="assignClearPicked()">모두 빼기</button>` : ''}</div>
    <ol class="asg-sel-list">${items.map(p => `<li>${_assignTypeChips(p)} ${escHtml(String(p.q).replace(/\s+/g, ' ').slice(0, 50))}${d.how === 'pick' ? ` <button class="asg-x" onclick="assignPick('${escJsAttr(p.id)}', false)">✕</button>` : ''}</li>`).join('')}</ol></div>`;
}
function _assignPreviewHTML(p) {
  const fig = p.fig && typeof Figures !== 'undefined' ? `<div class="asg-fig">${Figures.render(p.fig)}</div>` : '';
  const psg = p.passageId && typeof READING_PASSAGES !== 'undefined' ? READING_PASSAGES.find(x => x.id === p.passageId) : null;
  return `<div class="asg-preview">${psg ? `<div class="asg-psg-pre"><b>📖 ${escHtml(psg.title || '')}</b><div>${escHtml(psg.text || '')}</div></div>` : ''}
    ${fig}<div class="asg-item-text">${escHtml(p.q)}</div>
    ${p.choices ? `<ol class="asg-pre-ch">${p.choices.map(c => `<li class="${c === p.a ? 'ok' : ''}">${escHtml(c)}${c === p.a ? ' ✓' : ''}</li>`).join('')}</ol>` : `<div>정답: <b>${escHtml(p.a)}</b>${(p.alt || []).length ? ` <span class="text-muted-sm">(또는 ${escHtml(p.alt.join(', '))})</span>` : ''}</div>`}
    ${p.audio ? `<div class="text-muted-sm">🔊 소리: ${escHtml(p.audio)}</div>` : ''}${p.hint ? `<div class="text-muted-sm">💡 ${escHtml(p.hint)}</div>` : ''}</div>`;
}
let _assignFindT = 0;
function assignFind(v) { const d = _AS.draft; if (!d) return; d.q = String(v || '').slice(0, 30); clearTimeout(_assignFindT); _assignFindT = setTimeout(() => { const u = document.getElementById('asg-c-units'); if (!u) return; const keep = document.activeElement; _assignCWhat(); const f = document.querySelector('.asg-find'); if (f && keep && keep.classList && keep.classList.contains('asg-find')) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }, 250); }
function assignOpenUnit(id) { const d = _AS.draft; if (!d) return; d.openUnit = d.openUnit === id ? '' : id; _assignCWhat(); }
function assignPreview(id) { const d = _AS.draft; if (!d) return; d.preview = d.preview === id ? '' : id; _assignCWhat(); }
function assignPick(id, on) {
  const d = _AS.draft; if (!d) return;
  d.picked = d.picked.filter(x => x !== id);
  if (on) d.picked.push(id);
  _assignRefreshPick();
}
function assignPickSet(pid, on) {
  const d = _AS.draft; if (!d) return;
  const ids = _assignBank(d.subject).filter(p => p.passageId === pid).map(p => p.id).sort();
  d.picked = d.picked.filter(x => !ids.includes(x));
  if (on) d.picked.push(...ids);   // 세트는 연달아
  _assignRefreshPick();
}
function assignShufflePicked() {
  const d = _AS.draft; if (!d) return;
  //  지문 세트는 한 덩어리로 섞는다(세트 문항은 연달아)
  const bank = new Map(_assignBank(d.subject).map(p => [p.id, p])), blocks = [], seen = new Set();
  for (const id of d.picked) { const p = bank.get(id); if (!p) continue; if (p.passageId) { if (seen.has(p.passageId)) continue; seen.add(p.passageId); blocks.push(d.picked.filter(x => (bank.get(x) || {}).passageId === p.passageId)); } else blocks.push([id]); }
  for (let i = blocks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [blocks[i], blocks[j]] = [blocks[j], blocks[i]]; }
  d.picked = blocks.flat();
  _assignRefreshPick();
}
function assignClearPicked() { const d = _AS.draft; if (!d) return; d.picked = []; _assignCWhat(); _assignCMeta(); }
function _assignRefreshPick() {
  const d = _AS.draft, s = document.getElementById('asg-c-sel');
  if (s) s.innerHTML = _assignSelHTML(d);
  //  체크 모양은 그 줄만 — 단원 목록을 다시 그리지 않아 스크롤이 안 튄다
  document.querySelectorAll('#asg-c-units .asg-prow').forEach(r => { const c = r.querySelector('input'); if (c) r.classList.toggle('on', c.checked); });
  _assignCMeta();
}
// 자동 뽑기 — 단원 · 개수 · 성격 → [미리 뽑아 보기] — 보낼 때 이 목록 그대로(반 전체 같은 문제)
function _assignAutoHTML(d) {
  const units = _assignUnits(d.subject), bank = _assignBank(d.subject);
  const pool = _assignAutoPool(d);
  const cats = [...new Set(bank.map(p => p.cat))];
  return `<div class="asg-c-row"><span class="text-muted-sm">단원</span>${units.map(u => `<label class="asg-ucheck"><input type="checkbox" ${d.units.includes(u.id) ? 'checked' : ''} onchange="assignAutoUnit('${escJsAttr(u.id)}', this.checked)"> ${u.no ? u.no + '. ' : ''}${escHtml(u.name)}</label>`).join('')}</div>
    <div class="asg-c-row"><span class="text-muted-sm">개수</span>${[5, 10, 15, 20].map(n => `<button class="asg-chip-btn${d.n === n ? ' on' : ''}" onclick="assignDraft('n', ${n})">${n}</button>`).join('')}
      <span class="text-muted-sm">성격</span><select class="form-select asg-sel-sm" onchange="assignDraft('cat', this.value)"><option value="">골고루</option>${cats.map(c => `<option value="${escHtml(c)}" ${d.cat === c ? 'selected' : ''}>${escHtml(ASSIGN_CAT_LABEL[c] || c)}</option>`).join('')}</select>
      <span class="text-muted-sm">고를 수 있는 문제 ${pool.length}개</span>
      <button class="btn-sm" onclick="assignDraw()" ${pool.length ? '' : 'disabled'}>${d.drawn ? '다시 뽑기 🎲' : '미리 뽑아 보기 🎲'}</button></div>
    <div id="asg-c-sel">${d.drawn ? _assignSelHTML(d) : '<div class="asg-sel-box empty">[미리 뽑아 보기]를 누르면 보낼 문제가 보여요 — 안 누르고 보내면 보낼 때 한 번 뽑아요</div>'}</div>`;
}
function _assignAutoPool(d) {
  const units = d.units.length ? d.units : _assignUnits(d.subject).map(u => u.id);
  return _assignBank(d.subject).filter(p => units.includes(p.unitId) && (!d.cat || p.cat === d.cat));
}
function assignAutoUnit(id, on) { const d = _AS.draft; if (!d) return; d.units = d.units.filter(x => x !== id); if (on) d.units.push(id); d.drawn = null; _assignCWhat(); _assignCMeta(); }
function assignDraw() { const d = _AS.draft; if (!d) return; d.drawn = AssignCore.pickSet(_assignAutoPool(d), d.n).map(p => p.id); _assignCWhat(); _assignCMeta(); }
// ②③④
function _assignCMeta() {
  const d = _AS.draft, el = document.getElementById('asg-c-meta');
  if (!d || !el) return;
  if (!d.titleTouched) d.title = _assignAutoTitle(d);
  const studs = _assignStudents();
  const items = _assignPicked(d);
  const nAudio = items.filter(p => p.audio).length, nEnText = items.filter(p => AssignCore.isEnglish(p) && p.type !== 'choice').length;
  const live = d.deliver === 'live', app = d.kind !== 'quiz', liveOK = _assignLiveOK(d.kind), A = _assignApp(d.kind);
  el.innerHTML = `<div class="asg-c-row"><label class="asg-grow">이름 <input class="form-input" maxlength="${AssignCore.TITLE_MAX}" value="${escHtml(d.title)}" oninput="assignDraft('title', this.value)"></label></div>
    <div class="asg-c-row"><span class="text-muted-sm">누구에게</span>
      <label class="asg-inline"><input type="radio" name="asg-who" ${d.who === 'all' ? 'checked' : ''} onchange="assignDraft('who','all')"> 우리 반 모두(${studs.length}명)</label>
      <label class="asg-inline"><input type="radio" name="asg-who" ${d.who === 'some' ? 'checked' : ''} onchange="assignDraft('who','some')"> 골라서</label></div>
    ${d.who === 'some' ? `<div class="asg-c-row asg-who">${studs.map(s => `<label class="asg-ucheck"><input type="checkbox" ${d.targets.includes(s.sid) ? 'checked' : ''} onchange="assignTarget('${escJsAttr(s.sid)}', this.checked)"> ${escHtml(s.name)}</label>`).join('')}</div>` : ''}
    <div class="asg-c-row"><span class="text-muted-sm">어떻게</span>
      <span class="asg-segs"><button class="asg-seg${!live ? ' on' : ''}" onclick="assignDraft('deliver','inbox')">📥 과제함에 넣기</button>
      <button class="asg-seg live${live ? ' on' : ''}" ${!liveOK ? `disabled title="${escHtml(_assignInboxOnlyNote(d.kind))}"` : `onclick="assignDraft('deliver','live')"`}>🔴 지금 모두 같이</button></span></div>
    ${app && !liveOK ? `<div class="asg-note-t">📥 ${escHtml(_assignInboxOnlyNote(d.kind))}</div>` : ''}
    <div class="text-muted-sm asg-explain">${live ? `로그인한 아이 화면 위에 바로 수업 방이 열려요. 하던 것은 그대로 멈춰 두고, 선생님이 끝내면 하던 자리로 돌아가요. 아이는 스스로 못 나가요.<br>${ASSIGN_LIVE_NOTE}` : '아이는 하던 것을 그대로 하고, 홈 \'오늘\' 맨 위 카드를 눌러 풀어요.'}</div>
    ${live ? `<div class="asg-c-row"><span class="text-muted-sm">진행</span>
      <label class="asg-inline"><input type="radio" name="asg-pace" ${d.pacing === 'self' ? 'checked' : ''} onchange="assignDraft('pacing','self')"> 각자 풀기</label>${app ? `<span class="text-muted-sm">— ${(A && A.selfNote) || '덮개 안에서 그 앱이 열려요'}</span>` : ''}
      ${app ? '' : `<label class="asg-inline"><input type="radio" name="asg-pace" ${d.pacing === 'step' ? 'checked' : ''} onchange="assignDraft('pacing','step')"> 한 문제씩 같이(선생님이 넘김 · 답 공개 · TV 막대)</label>`}
      <span class="text-muted-sm">안전 시간</span><select class="form-select asg-sel-sm" onchange="assignDraft('minutes', this.value)">${[20, 30, 40, 45, 50, 60, 90, 120].map(m => `<option value="${m}" ${d.minutes === m ? 'selected' : ''}>${m}분</option>`).join('')}</select></div>` : ''}
    ${live && app ? (() => { const n = d.who === 'some' ? d.targets.length : studs.length; return `<div class="asg-note-t">🔌 ${_assignAppLiveNote(n, d.kind)}${n > ASSIGN_APP_LIVE_WARN ? ' <b>모둠을 골라 보내는 것을 권해요.</b>' : ''}</div>`; })() : ''}
    ${!app && (!live || d.pacing === 'self') ? `<div class="asg-c-row"><label class="asg-inline"><input type="checkbox" ${d.showAnswer ? 'checked' : ''} onchange="assignDraft('showAnswer', this.checked)"> 문제마다 정답 바로 보여 주기</label></div>` : ''}
    ${nAudio ? `<div class="asg-note-t">🔊 소리 문제 ${nAudio}개 — ${live && d.pacing === 'step' ? 'TV 화면의 🔊 로 선생님이 들려줘요' : '각자 풀기는 이어폰이 있으면 좋아요(수업 중에는 자동으로 읽지 않아요)'}</div>` : ''}
    ${nEnText ? `<div class="asg-note-t">⌨️ 영어로 쓰는 문제 ${nEnText}개 — 한글로 쓰면 아이 화면에 '한/영 키' 안내가 떠요(오답으로 세지 않음)</div>` : ''}
    <div class="asg-c-row asg-send"><button class="btn-sm ${live ? 'danger' : 'success'}" id="asg-send" onclick="assignSend()" ${_AS.sending ? 'disabled' : ''}>${live ? '🔴 지금 보내고 수업 시작' : '📥 과제함에 보내기'}</button>
      <span class="text-muted-sm">${app ? '' : `문제 ${items.length || (d.how === 'auto' ? d.n : 0)}개`}</span></div>`;
}
function assignTarget(sid, on) { const d = _AS.draft; if (!d) return; d.targets = d.targets.filter(x => x !== sid); if (on) d.targets.push(sid); }

// ── 보내기 ──
function _assignBuildDef(d) {
  const studs = _assignStudents();
  const targets = d.who === 'some' ? d.targets.filter(sid => studs.some(s => s.sid === sid)) : null;
  if (d.who === 'some' && !targets.length) return { err: '받을 아이를 골라 주세요' };
  const roster = {};
  for (const s of studs) if (!targets || targets.includes(s.sid)) roster[s.sid] = s.name.slice(0, 20);
  const base = { id: d.aid, kind: d.kind, title: (d.title || _assignAutoTitle(d)).slice(0, AssignCore.TITLE_MAX), deliver: d.deliver, pacing: d.deliver === 'live' ? d.pacing : 'self',
    showAnswer: d.showAnswer, targets, roster, reward: null };
  if (d.kind === 'quiz') {
    let probs = _assignPicked(d);
    if (d.how === 'auto' && !probs.length) probs = AssignCore.pickSet(_assignAutoPool(d), d.n);   // 미리 안 뽑았으면 지금 한 번
    if (!probs.length) return { err: '문제를 골라 주세요' };
    if (probs.length > AssignCore.ITEMS_MAX) return { err: `문제는 ${AssignCore.ITEMS_MAX}개까지 보낼 수 있어요` };
    const items = probs.map(p => AssignCore.snapItem(p));   // 보기는 여기서 한 번 섞는다 — 반 전체 · TV 가 같은 차례
    const passages = {};
    for (const p of items) if (p.passageId && typeof READING_PASSAGES !== 'undefined') { const x = READING_PASSAGES.find(r => r.id === p.passageId); if (x) passages[x.id] = { id: x.id, title: x.title || '', text: x.text || '' }; }
    base.content = { quiz: { subject: d.subject, items, passages, src: { how: d.how, units: d.how === 'auto' ? d.units.slice() : [...new Set(items.map(i => i.unitId))], n: items.length, cat: d.cat || '' } } };
  } else {   // [ASSIGN-APPS-1] 학습 앱 — 내용은 그 앱이(판 · 곡)
    const A = _assignApp(d.kind);
    const r = A && A.build ? A.build(d) : { err: '이 종류는 아직 보낼 수 없어요' };
    if (r.err) return r;
    base.content = r.content;
  }
  if (!AssignCore.normDef({ ...base, createdAt: 1 }, d.aid)) return { err: '과제 모양이 맞지 않아요' };
  return { def: base };
}
async function assignSend() {
  const d = _AS.draft;
  if (!d || _AS.sending) return;
  const b = _assignBuildDef(d);
  if (b.err) { notify('⚠️ ' + b.err, 'error'); return; }
  const def = b.def, ndef = AssignCore.normDef({ ...def, createdAt: 1 }, d.aid);
  const same = Object.values(_AS.open).find(o => o.id !== d.aid && AssignCore.contentSig(o) === AssignCore.contentSig(ndef));
  if (same && !confirm(`같은 내용의 과제 '${same.title}' 가 이미 열려 있어요.\n그래도 하나 더 보낼까요?`)) return;
  if (d.deliver === 'live') { await _assignStartLive(def, d.minutes, false); return; }
  _AS.sending = true; _assignCMeta();
  try {
    await _assignRef(AssignCore.path.open(d.aid)).set({ ...def, createdAt: _assignTS() });
    notify(`📥 '${def.title}' 을(를) 과제함에 보냈어요`);
    _AS.draft = null; _AS.sel = d.aid; _assignRenderCreate(); _assignSyncResults(); _assignRenderBits(true);
  } catch (e) { console.warn(e); notify(_asgDenied(e) ? '⚠️ 보내기가 막혔어요 — 저장 권한이 없어요(DB 규칙). 관리자에게 classRPG_assign 쓰기를 열어 달라고 해 주세요' : '⚠️ 보내기가 안 됐어요 — 인터넷을 확인하고 다시 눌러 주세요(같은 과제로 다시 보내져요)', 'error'); }
  finally { _AS.sending = false; _assignCMeta(); }
}
//  지금 모두 같이 — 수업 상태(live)를 transaction 으로 먼저 켜고(수업 중이 아닐 때만 — 두 관리 탭이 동시에 눌러도 하나) 정의를 쓴다
async function _assignStartLive(def, minutes, fromOpen, asked) {
  if (_AS.sending) return;
  if (!_assignLiveOK(def.kind)) { notify('⚠️ ' + _assignInboxOnlyNote(def.kind), 'error'); return; }   // 스위치(AssignCore.LIVE_APPS)가 꺼진 종류 [ASSIGN-LIVE-APPS-1]
  const cur = _AS.live;
  if (cur && cur.on === true) {
    if (!confirm('지금 다른 수업이 켜져 있어요. 그 수업을 끝내고 새로 시작할까요?')) return;
    const ok = await _assignTx(AssignCore.ctl.end('', _assignNow()), '앞 수업 끝내기');
    if (!ok) return;
    if (cur.aid && _AS.openRaw[cur.aid] && cur.aid !== def.id) {
      if (_AS.openRaw[cur.aid].fromInbox) await _assignToInbox(cur.aid, cur.revealAt, false);   // [ASSIGN-END-INBOX-1]
      else await _assignClose(cur.aid);
    }
  } else if (!asked && !confirm(`'${def.title}'\n지금 로그인한 아이 화면에 수업 방이 열려요. 하던 것은 그대로 멈춰 둬요.\n시작할까요?`)) return;
  if (def.kind !== 'quiz') {   // [ASSIGN-CODING-2] 연결 수 — 큰 반이면 한 번 더
    const n = _assignReceivers(def);
    if (n > ASSIGN_APP_LIVE_WARN && !confirm(`${_assignAppLiveNote(n, def.kind)}\n\n모둠을 골라 보내거나 과제함으로 보내는 것을 권해요. 그래도 시작할까요?`)) return;
  }
  _AS.sending = true; _assignCMeta();
  try {
    const ndef = AssignCore.normDef({ ...def, createdAt: 1 }, def.id);
    const ok = await _assignTx(AssignCore.ctl.start(ndef, { minutes }, _assignNow()), '수업 시작');
    if (!ok) return;
    //  [ASSIGN-END-INBOX-1] 과제함에서 돌린 수업은 표시(fromInbox)를 남겨 끝낼 때 과제함으로 되돌린다
    if (fromOpen) await _assignRef('').update({ [`open/${def.id}/deliver`]: 'live', [`open/${def.id}/pacing`]: ndef.pacing, [`open/${def.id}/fromInbox`]: true });
    else await _assignRef(AssignCore.path.open(def.id)).set({ ...def, createdAt: _assignTS() });
    notify(`🔴 수업을 시작했어요 — ${def.title}`);
    if (!fromOpen) _AS.draft = null;
    _AS.sel = def.id; _AS.mask = null;
    _assignRenderCreate(); _assignSyncResults(); _assignRenderBits(true);
    const m = document.getElementById('asg-mask'); if (m) m.checked = _assignMasked();
  } catch (e) { console.warn(e); notify(_asgDenied(e) ? '⚠️ 수업 시작이 막혔어요 — 저장 권한이 없어요(DB 규칙)' : '⚠️ 수업 시작이 안 됐어요 — 인터넷을 확인해 주세요', 'error'); }
  finally { _AS.sending = false; _assignCMeta(); }
}

// [ASG-DENIED-1] DB 규칙에 막힌 것과 인터넷 끊김을 따로 말한다(리허설 때 원인을 헷갈리지 않게)
function _asgDenied(e) { const m = String((e && (e.code || e.message)) || ''); return /permission[_ ]denied/i.test(m); }
