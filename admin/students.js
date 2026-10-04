// admin/students.js — 학생 목록 · 학생 상세 창(쪽지 · 일괄 쪽지 · 능력치/승급/전체 초기화 · 저장 · 골드 주기) · 학생 추가
//  admin.js 에서 떼어 옮긴 클래식 스크립트 [ADMIN-SPLIT-1] — 글자 그대로 · 전역 그대로 · admin.html 에서 admin.js 바로 뒤에 부른다.
// ── [ADMIN-SPLIT-1] 'students' — 원래 admin.js 596~1121줄 ──
// ══════════════════════════════════════════════════
//  STUDENT TABLE
// ══════════════════════════════════════════════════
function renderStudentTable() {
  const students = DB.getStudents();
  document.getElementById('student-table').innerHTML = students.map(s => `
    <tr>
      <td><div class="td-avatar">${s.avatar}</div></td>
      <td><div class="td-name">${escHtml(s.name)}</div></td>
      <td><div class="td-level">Lv.${s.level}</div></td>
      <td>
        <div style="display:flex;align-items:center;gap:.5rem">
          <div class="progress-mini"><div class="pm-fill" style="width:${Math.min(100,((s.exp-Utils.expForLevel(s.level))/(Utils.expForNextLevel(s.level)-Utils.expForLevel(s.level)))*100)}%"></div></div>
          <span class="text-muted-tiny">${s.exp}</span>
        </div>
      </td>
      <td><div class="td-gold">💰 ${s.gold}G</div></td>
      <td><span style="font-size:.78rem;color:var(--purple)">${s.title||'-'}</span></td>
      <td><span style="font-size:.75rem;color:var(--txt2)">${s.job||'-'}</span></td>
      <td><div class="td-actions">
        <button class="btn-sm" onclick="openStudentDetail('${s.id}')">상세</button>
        <button class="btn-sm success" style="font-size:.7rem" onclick="quickGiveGold('${s.id}')">+골드</button>
      </div></td>
    </tr>`).join('');
}

// ══════════════════════════════════════════════════
//  STUDENT DETAIL MODAL
// ══════════════════════════════════════════════════
// [DET-PW-MASK-1] 교사 화면은 TV 로 미러링된다 — 학생 상세의 비밀번호는 ●●●● 로 가리고 [보기] 로만 잠깐 보인다
function toggleDetPw() {
  const inp = document.getElementById('det-pw');
  const btn = document.getElementById('det-pw-toggle');
  if (!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  if (btn) btn.textContent = show ? '가리기' : '보기';
}

function openStudentDetail(id) {
  const s = DB.getStudent(id);
  document.getElementById('modal-student-title').textContent = `${s.avatar} ${s.name} 상세`;
  const statNames = GAME_DATA.statNames;

  document.getElementById('modal-student-body').innerHTML = `
    <div class="modal-section">
      <div class="ms-label">기본 정보</div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">이름</label>
          <input class="form-input" id="det-name" value="${escHtml(s.name)}"></div>
        <div class="form-group"><label class="form-label">직업(장래희망)</label>
          <input class="form-input" id="det-job" value="${s.job||''}"></div>
        <div class="form-group"><label class="form-label">칭호</label>
          <select class="form-select" id="det-title">
            ${GAME_DATA.titles.map(t=>`<option ${s.title===t?'selected':''}>${t}</option>`).join('')}
          </select></div>
        <div class="form-group"><label class="form-label">비밀번호</label>
          <div style="display:flex;gap:.4rem">
            <input class="form-input flex-1" type="password" autocomplete="new-password" id="det-pw" value="${escHtml(s.pw||'1234')}">
            <button type="button" class="btn-sm outline" id="det-pw-toggle" onclick="toggleDetPw()">보기</button>
          </div></div>
        <div class="form-group"><label class="form-label">레벨</label>
          <input class="form-input" type="number" id="det-lv" value="${s.level}"></div>
        <div class="form-group"><label class="form-label">골드</label>
          <input class="form-input" type="number" id="det-gold" value="${s.gold}"></div>
        <div class="form-group"><label class="form-label">EXP</label>
          <input class="form-input" type="number" id="det-exp" value="${s.exp}"></div>
        <div class="form-group"><label class="form-label">읽은 책 수</label>
          <input class="form-input" type="number" id="det-books" value="${s.bookCount||0}"></div>
      </div>
    </div>
    <div class="modal-section">
      <div class="ms-label">활동 능력치</div>
      <div class="ab-grid">
        ${Object.entries(s.stats||{}).map(([k,v]) => `
          <div class="ab-admin-row">
            <span class="ab-admin-name">${statNames[k]||k}</span>
            <div class="ab-admin-bar"><div class="ab-admin-fill" style="width:${Math.min(100,v/20*100)}%"></div></div>
            <input class="ab-admin-input" type="number" id="det-stat-${k}" value="${v}">
          </div>`).join('')}
      </div>
    </div>
    <div class="modal-section">
      <div class="ms-label">📝 쪽지 (학생은 읽기만 합니다)</div>
      <div id="note-list-${id}" style="margin-bottom:.6rem"></div>
      ${noteFormHTML(id)}
    </div>
    <div style="display:flex;gap:.6rem;margin-top:1rem;flex-wrap:wrap">
      <button class="btn-sm success" onclick="saveStudentDetail('${id}')">✅ 저장</button>
      <button class="btn-sm danger" onclick="resetStudentStats('${id}')" style="font-size:.75rem">🔄 수치 초기화</button>
      <button class="btn-sm outline" onclick="closeModal()">취소</button>
    </div>`;

  document.getElementById('m-student').classList.add('open');
  renderStudentNotes(id);   // [NOTES-1]
}

// ══ 학생 쪽지 (NOTES-1) ════════════════════════════════════════
//  교사가 학생마다 쪽지를 써 주고(외부 학습 사이트 안내가 주 용도) 학생은 읽기만 한다.
//  저장은 DB.saveStudentNote / DB.deleteStudentNote — studentNotes/<sid>/<noteId> 개별 경로.
//  통짜 set 은 쓰지 않는다(교사가 두 화면에서 만져도 서로 지우지 않게).
//  ★ 비밀번호 칸은 일부러 없다. 이 앱은 인증이 없고 공개 사이트라 DB 를 누구나 읽을 수 있다.
//    화면에서 가려도 저장된 값 자체는 못 지킨다 — 그래서 아예 받지 않는다.
const NOTE_PW_WARNING = '⚠️ 비밀번호는 여기에 적지 마세요. 이 앱은 인증이 없어 누구나 읽을 수 있는 곳에 저장됩니다.';

function _noteWarnHTML() {
  return `<div style="font-size:.7rem;color:#E67E22;background:rgba(230,126,34,.08);
    border:1px solid rgba(230,126,34,.25);border-radius:6px;padding:.4rem .6rem;margin-bottom:.6rem">
    ${escHtml(NOTE_PW_WARNING)}</div>`;
}

function renderStudentNotes(sid) {
  const el = document.getElementById('note-list-' + sid);
  if (!el) return;
  const notes = DB.getStudentNotes(sid);
  el.innerHTML = notes.length ? notes.map(n => `
    <div style="border:1px solid var(--border2);border-radius:8px;padding:.5rem .6rem;margin-bottom:.4rem">
      <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.25rem">
        <span style="font-size:.9rem">${n.kind === 'account' ? '🔑' : '📝'}</span>
        <b style="font-size:.82rem;flex:1">${escHtml(n.site || n.memo || '(제목 없음)')}</b>
        <button class="btn-sm outline" style="font-size:.68rem;padding:.2rem .5rem"
          onclick="editStudentNote('${sid}','${n.id}')">수정</button>
        <button class="btn-sm danger" style="font-size:.68rem;padding:.2rem .5rem"
          onclick="removeStudentNote('${sid}','${n.id}')">삭제</button>
      </div>
      ${n.kind === 'account' ? `<div style="font-size:.72rem;color:var(--txt2)">
        ${n.url ? escHtml(n.url) + ' · ' : ''}아이디 ${escHtml(n.loginId || '-')}</div>` : ''}
      ${n.memo ? `<div style="font-size:.72rem;color:var(--txt2);margin-top:.15rem">${escHtml(n.memo)}</div>` : ''}
    </div>`).join('') : '<div style="font-size:.75rem;color:var(--txt3)">아직 쪽지가 없어요.</div>';
}

function noteFormHTML(sid) {
  return `${_noteWarnHTML()}
    <div class="form-grid">
      <div class="form-group"><label class="form-label">종류</label>
        <select class="form-select" id="nf-kind-${sid}">
          <option value="account">사이트 안내</option><option value="memo">그냥 메모</option>
        </select></div>
      <div class="form-group"><label class="form-label">사이트 이름 / 제목</label>
        <input class="form-input" id="nf-site-${sid}" placeholder="예: 영어 복습앱"></div>
      <div class="form-group"><label class="form-label">주소</label>
        <input class="form-input" id="nf-url-${sid}" placeholder="https://..."></div>
      <div class="form-group"><label class="form-label">아이디</label>
        <input class="form-input" id="nf-id-${sid}"></div>
      <div class="form-group" style="grid-column:1/-1"><label class="form-label">메모</label>
        <input class="form-input" id="nf-memo-${sid}" placeholder="아이들에게 해 줄 말"></div>
    </div>
    <input type="hidden" id="nf-editing-${sid}" value="">
    <button class="btn-sm success" style="margin-top:.4rem" onclick="submitStudentNote('${sid}')">쪽지 저장</button>
    <button class="btn-sm outline" style="margin-top:.4rem" onclick="clearNoteForm('${sid}')">비우기</button>`;
}

function clearNoteForm(sid) {
  ['site','url','id','memo','editing'].forEach(k => {
    const el = document.getElementById('nf-' + k + '-' + sid); if (el) el.value = '';
  });
}

function editStudentNote(sid, noteId) {
  const n = DB.getStudentNotes(sid).find(x => x.id === noteId);
  if (!n) return;
  const set = (k, v) => { const el = document.getElementById('nf-' + k + '-' + sid); if (el) el.value = v || ''; };
  set('kind', n.kind || 'account'); set('site', n.site); set('url', n.url);
  set('id', n.loginId); set('memo', n.memo); set('editing', n.id);
  notify('✏️ 내용을 바꾸고 [쪽지 저장]을 누르세요.');
}

function submitStudentNote(sid) {
  const get = k => (document.getElementById('nf-' + k + '-' + sid) || {}).value || '';
  const site = get('site').trim(), memo = get('memo').trim();
  if (!site && !memo) { notify('⚠️ 사이트 이름이나 메모 중 하나는 적어 주세요.'); return; }
  const editing = get('editing');
  const base = editing ? (DB.getStudentNotes(sid).find(x => x.id === editing) || {}) : {};
  DB.saveStudentNote(sid, {
    id: editing || undefined, createdAt: base.createdAt,
    kind: get('kind') || 'account',
    site, url: get('url').trim(), loginId: get('id').trim(), memo,
  });
  clearNoteForm(sid);
  renderStudentNotes(sid);
  notify('✅ 쪽지를 저장했어요.');
}

function removeStudentNote(sid, noteId) {
  if (!confirm('이 쪽지를 지울까요?')) return;
  DB.deleteStudentNote(sid, noteId);
  renderStudentNotes(sid);
  notify('🗑️ 쪽지를 지웠어요.');
}

// ── 쪽지 일괄 주기 ─────────────────────────────────────────
//  사이트 하나를 반 전체에 줄 때. 공통 정보는 위에 한 번, 아이디만 학생별로 넣는다.
//  저장은 학생마다 개별 경로 한 건씩(DB.saveStudentNote) — 통짜 set 없음.
function openBulkNotes() {
  document.getElementById('m-bulk-note').classList.add('open');
  renderBulkNotes();
}

function renderBulkNotes() {
  const el = document.getElementById('bulk-note-body');
  if (!el) return;
  const students = DB.load().students || [];
  el.innerHTML = `
    ${_noteWarnHTML()}
    <div class="form-grid">
      <div class="form-group"><label class="form-label">사이트 이름</label>
        <input class="form-input" id="bn-site" placeholder="예: 영어 복습앱"></div>
      <div class="form-group"><label class="form-label">주소</label>
        <input class="form-input" id="bn-url" placeholder="https://..."></div>
      <div class="form-group" style="grid-column:1/-1"><label class="form-label">공통 메모 (모두에게 같이 들어갑니다)</label>
        <input class="form-input" id="bn-memo"></div>
    </div>

    <div class="ms-label" style="margin-top:.8rem">붙여넣기 (선택)</div>
    <div style="font-size:.7rem;color:var(--txt3);margin-bottom:.3rem">
      엑셀·한글 표에서 <b>이름 / 아이디</b> 두 칸을 복사해 붙여넣으면 아래 표가 채워집니다.
      이름이 안 맞는 줄은 <span style="color:var(--red)">빨갛게</span> 표시되고 저장되지 않습니다.
    </div>
    <textarea class="form-input" id="bn-paste" rows="3"
      style="font-family:ui-monospace,Consolas,monospace;font-size:.75rem"
      placeholder="홍길동&#9;hong01&#10;김철수&#9;kim02"></textarea>
    <button class="btn-sm outline" style="margin-top:.3rem" onclick="applyBulkPaste()">표에 채우기</button>

    <div class="ms-label" style="margin-top:.8rem">학생별 아이디</div>
    <div id="bn-unmatched" style="font-size:.72rem;color:var(--red);margin-bottom:.3rem"></div>
    <div style="max-height:260px;overflow-y:auto">
      ${students.map(st => `
        <div style="display:flex;align-items:center;gap:.5rem;padding:.2rem 0">
          <span style="width:5.5rem;font-size:.78rem;flex-shrink:0">${escHtml(st.name)}</span>
          <input class="form-input" id="bn-id-${st.id}" style="flex:1" placeholder="아이디 (비우면 안 줌)">
        </div>`).join('')}
    </div>
    <button class="btn-sm success" style="margin-top:.6rem" onclick="submitBulkNotes()">📝 적은 학생에게 한 번에 주기</button>`;
}

// 붙여넣은 표를 학생 행에 채운다. 이름이 안 맞으면 저장하지 않고 알려준다.
function applyBulkPaste() {
  const raw = (document.getElementById('bn-paste') || {}).value || '';
  const students = DB.load().students || [];
  const byName = new Map(students.map(st => [String(st.name).replace(/\s/g, ''), st]));
  const unmatched = [];
  let filled = 0;
  const LF = String.fromCharCode(10), CR = String.fromCharCode(13);
  raw.split(LF).forEach(rawLine => {
    const line = rawLine.split(CR).join('');
    if (!line.trim()) return;
    const cols = line.split(/	|,|\s{2,}/).map(c => c.trim()).filter(Boolean);
    if (cols.length < 2) { unmatched.push(line.trim()); return; }
    const st = byName.get(cols[0].replace(/\s/g, ''));
    if (!st) { unmatched.push(cols[0]); return; }
    const input = document.getElementById('bn-id-' + st.id);
    if (input) { input.value = cols[1]; filled++; }
  });
  const box = document.getElementById('bn-unmatched');
  if (box) box.textContent = unmatched.length
    ? ('⚠️ 이름을 못 찾은 줄 ' + unmatched.length + '개: ' + unmatched.join(', ') + ' — 이 줄은 저장되지 않습니다.')
    : '';
  notify(filled ? ('✅ ' + filled + '명 채웠어요.') : '⚠️ 채운 줄이 없어요.');
}

function submitBulkNotes() {
  const site = (document.getElementById('bn-site') || {}).value.trim();
  const url  = (document.getElementById('bn-url')  || {}).value.trim();
  const memo = (document.getElementById('bn-memo') || {}).value.trim();
  if (!site) { notify('⚠️ 사이트 이름을 적어 주세요.'); return; }
  const students = DB.load().students || [];
  const targets = students.filter(st => ((document.getElementById('bn-id-' + st.id) || {}).value || '').trim());
  if (!targets.length) { notify('⚠️ 아이디를 적은 학생이 없어요.'); return; }
  if (!confirm(targets.length + '명에게 "' + site + '" 쪽지를 줄까요?')) return;
  targets.forEach(st => DB.saveStudentNote(st.id, {
    kind: 'account', site, url, memo,
    loginId: (document.getElementById('bn-id-' + st.id).value || '').trim(),
  }));
  closeModal();
  notify('✅ ' + targets.length + '명에게 쪽지를 줬어요.');
}

function resetStudentStats(id) {
  if (!confirm('이 학생의 모든 수치를 초기화할까요?\n\n레벨·EXP·골드·스탯뿐 아니라\n승인 대기 보상, 가방(장비/장식), 책·독서 기록, 업적, 칭호, 집 꾸미기까지\n학생 성장 데이터가 함께 초기화됩니다.\n이 작업은 되돌릴 수 없습니다.')) return;
  const s = DB.getStudent(id);
  if (!s) return;
  s.level = 1; s.exp = 0; s.gold = 0;
  s.stats = {read:0, study:0, art:0, value:0, health:0, life:0};
  s.combat = {atk:0, def:6, mag:0, spd:0};
  s.totalQuests = 0; s.bookCount = 0;
  s.books = []; s.monsterLog = [];
  s.pendingRewards = []; s.titles = [];
  s.title = ''; s.achievements = [];
  s.equipmentIds = {}; s.inventory = [];
  s.houseDecorations = []; s.yardFloor = {}; s.yardFloors = {}; s.indoor = {};   // [DECO-SPACE-1] 공간 2·3 바닥도 · [IN-2] 집 안 벽지·바닥
  s.decoLife = {};   // [DECO-LIFE-1] 친해지기·손님·선물도(보스 결정 ③)
  s.lastAttendDate = '';
  resetPromotionState(s);   // [PROMO-RESET-1] 다시 그 레벨에 오르면 승급할 수 있게
  DB.getPromotionRequests().filter(r => r.studentId === s.id).forEach(r => DB.removePromotionRequest(r.id));
  DB.saveStudent(s);
  closeModal();
  renderAll();
  notify(`🔄 ${s.name} 수치 초기화 완료!`);
}

// [PROMO-RESET-1] 수치를 처음으로 돌리면 승급 기록도 처음으로.
//   예전엔 promotedLevels 가 남아 Lv5 를 다시 올라도 승급 단추가 안 떴고(student.js renderHUD canPromo),
//   job(중학생 등)이 남아 student.js 자동 복구가 그 레벨을 '이미 승급'으로 다시 적었다.
function resetPromotionState(s) {
  s.promotedLevels = [];
  s.promotionPending = false;
  if (s.job) s.job = Utils.getJobTitle(s.dream || s.job, 1);
}

// [RESET-ALL-SAFE-1] 확인창 한 번 → '초기화' 글자 입력 + 먼저 백업(실패하면 멈춤).
async function resetAllStudents() {
  const n = DB.getStudents().length;
  const typed = prompt(`⚠️ 학생 ${n}명의 레벨·EXP·골드·아이템·기록을 모두 처음으로 돌려요.\n이름·비번·아바타는 그대로예요. 먼저 지금 상태를 백업해요.\n\n계속하려면 '초기화' 라고 적어 주세요.`);
  if (typed === null) return;
  if (String(typed).trim() !== '초기화') { notify('글자가 달라 초기화를 멈췄어요', 'error'); return; }
  notify('💾 초기화 전 백업 중…');
  try { await saveBackup(true, '초기화 전'); }
  catch (e) { notify('⚠️ 백업에 실패해 초기화를 멈췄어요. 인터넷 연결을 확인해 주세요.', 'error'); return; }
  const saves = [];
  DB.getStudents().forEach(s => {
    s.level = 1; s.exp = 0; s.gold = 0;
    s.stats = {read:0, study:0, art:0, value:0, health:0, life:0};
    s.combat = {atk:0, def:6, mag:0, spd:0};
    s.totalQuests = 0; s.bookCount = 0;
    s.books = []; s.monsterLog = [];
    s.pendingRewards = []; s.titles = [];
    s.title = ''; s.achievements = [];
    s.equipmentIds = {}; s.inventory = [];
    s.houseDecorations = []; s.yardFloor = {}; s.yardFloors = {}; s.indoor = {};   // [DECO-SPACE-1] 공간 2·3 바닥도 · [IN-2] 집 안 벽지·바닥
    s.decoLife = {};   // [DECO-LIFE-1] 친해지기·손님·선물도(보스 결정 ③)
    s.lastAttendDate = '';
    resetPromotionState(s);   // [PROMO-RESET-1]
    saves.push(saveStudentAwait(s));
  });
  // 퀘스트 로그도 초기화 · [PROMO-RESET-1] 남은 승급 신청도(초기화 전 레벨의 신청이라 승인하면 보상이 잘못 나간다)
  saves.push(DB._fbRef.update({
    quests: null,
    questLogs: null,
    promotionRequests: null,
  }));
  const db = DB.load(); if (db) db.promotionRequests = [];
  renderAll();
  afterSaves(saves, failed => failed
    ? notify(`⚠️ 초기화 저장 ${failed}건 실패 — 새로고침 뒤 확인해 주세요 (초기화 전 상태는 백업에 있어요)`, 'error')
    : notify('🔄 전체 학생 수치 초기화 완료! (초기화 전 상태는 백업에 있어요)'));
}

function saveStudentDetail(id) {
  const s = DB.getStudent(id);
  // [SYNC-MERGE-2] 창을 연 뒤 **바꾼 칸만** 저장한다. 창은 열 때 값으로 칸을 채우므로, 안 바꾼 칸까지 되쓰면
  //   그사이 학생이 번 골드·EXP·받은 칭호를 열 때 값으로 되돌렸다. 바꿨는지는 칸의 처음 값(defaultValue)과 견준다.
  const $ = (k) => document.getElementById(k);
  const touched = (k) => { const el = $(k); return !!el && el.value !== el.defaultValue; };
  const titleEl = $('det-title');
  const titleTouched = !!titleEl && titleEl.selectedIndex !== Math.max(0, Array.from(titleEl.options).findIndex(o => o.defaultSelected));

  // [GOLD-GUARD-1] 골드는 다른 필드보다 **먼저** 판정한다.
  //   DB.getStudent()는 캐시 객체를 그대로 돌려주므로, 필드를 바꾼 뒤 확인 창에서 취소하면
  //   저장은 안 되지만 바뀐 값이 캐시에 남는다. 그래서 아무것도 건드리기 전에 묻는다.
  //   [SYNC-MERGE-2] 골드는 '바꾼 만큼'(적은 값 − 연 때 값)을 지금 골드에 더한다 — 그사이 번 골드를 지우지 않는다.
  const prevGold = s.gold || 0;
  const goldEl = $('det-gold');
  const goldDelta = touched('det-gold') ? (parseInt(goldEl.value) || 0) - (parseInt(goldEl.defaultValue) || 0) : 0;
  const newGold  = Math.max(0, prevGold + goldDelta);

  // 오타 방어 — 현재 골드의 10배를 넘거나 한 번에 +50,000G 이상 늘리면 되묻는다.
  //   (2026-09-10 골드 감사: 게임으로는 만들어질 수 없는 89만G 두 건이 확인됐고,
  //    gold만 늘고 totalGold가 안 늘어난 경로는 이 입력칸뿐이었다. docs/rpg_gold_audit_20260910.md §1-1)
  //   1,000G 미만의 소액 수정은 묻지 않는다(신규 학생 초기값 설정 등에서 성가시지 않도록).
  const bigMultiple = prevGold > 0 && newGold > prevGold * 10 && goldDelta >= 1000;
  const bigJump     = goldDelta >= 50000;
  if (goldDelta > 0 && (bigMultiple || bigJump)) {
    const ok = confirm(
      `${s.name}의 골드를

  ${prevGold.toLocaleString()}G  →  ${newGold.toLocaleString()}G  (+${goldDelta.toLocaleString()}G)

로 바꿉니다. 정말 바꿀까요?`
    );
    if (!ok) return;   // 다른 필드도 아직 안 건드린 상태 — 그대로 빠져나간다
  }

  if (touched('det-name')) s.name = $('det-name').value;
  if (touched('det-job'))  s.job = $('det-job').value;
  if (titleTouched)        s.title = titleEl.value;
  if (touched('det-pw'))   s.pw = $('det-pw').value;
  if (goldDelta) {
    s.gold = newGold;
    // [R7][GOLD-GUARD-1] 누적 골드 — quickGiveGold와 같은 규칙: 늘어난 만큼만 반영, 차감은 제외.
    //   이게 없으면 gold > totalGold가 되어 '얼마나 벌었나' 통계·골드 랭킹·누적 골드 업적이 어긋난다.
    if (goldDelta > 0) s.totalGold = (s.totalGold || 0) + goldDelta;
  }
  // ★ exp 필드를 직접 입력했으면 그대로, 아니면 level에 맞는 exp 최솟값으로 맞춤 — [SYNC-MERGE-2] 레벨·EXP 중 하나라도 바꿨을 때만
  if (touched('det-lv') || touched('det-exp')) {
    s.level = parseInt($('det-lv').value) || 1;
    const inputExp = parseInt($('det-exp').value) || 0;
    const levelFromInputExp = Utils.levelFromExp(inputExp);
    if (levelFromInputExp !== s.level) {
      // exp와 level이 불일치 → level 기준으로 exp를 맞춤 (level 변경 의도)
      s.exp = Utils.expForLevel(s.level);
    } else {
      s.exp = inputExp;
    }
  }
  if (touched('det-books')) s.bookCount = parseInt($('det-books').value) || 0;
  ['read','study','art','value','health','life'].forEach(k => {
    const el = $(`det-stat-${k}`);
    if (el && el.value !== el.defaultValue) { s.stats = s.stats || {}; s.stats[k] = Math.round((parseFloat(el.value)||0) * 10) / 10; }
  });
  DB.saveStudent(s);
  closeModal();
  renderAll();
  notify('✅ 학생 정보가 저장되었습니다!');
}

function quickGiveGold(id) {
  const amt = parseInt(prompt('지급할 골드 양을 입력하세요 (음수: 차감)') || '0');
  if (isNaN(amt)) return;
  const s = DB.getStudent(id);
  s.gold = Math.max(0, s.gold + amt);
  if (amt > 0) s.totalGold = (s.totalGold||0) + amt; // [R7] 누적 골드(차감 제외)
  DB.saveStudent(s);
  renderAll();
  notify(`💰 ${s.name}에게 ${amt > 0 ? '+' : ''}${amt}G 지급!`);
}

function openAddStudent() {
  const el = document.createElement('div');
  el.className = 'overlay open';

  const rows = Array.from({length:6}, (_,i) => `
    <tr id="add-row-${i}" style="${i>0?'opacity:.45':''}">
      <td style="padding:.3rem .2rem;font-size:.8rem;color:var(--txt3);text-align:center;width:24px">${i+1}</td>
      <td style="padding:.2rem .3rem"><input class="form-input" id="add-name-${i}" placeholder="이름" style="padding:.35rem .5rem;font-size:.82rem" oninput="onAddRowInput(${i})"></td>
      <td style="padding:.2rem .3rem"><input class="form-input" id="add-pw-${i}" value="1234" style="padding:.35rem .5rem;font-size:.82rem;width:64px" oninput="onAddRowInput(${i})"></td>
      <td style="padding:.2rem .3rem"><input class="form-input" id="add-job-${i}" placeholder="장래희망" style="padding:.35rem .5rem;font-size:.82rem" oninput="onAddRowInput(${i})"></td>
      <td style="padding:.2rem .3rem">
        <select class="form-select" id="add-char-${i}" style="padding:.35rem .4rem;font-size:.82rem">
          <option value="1">👦 남</option>
          <option value="2">👧 여</option>
        </select>
      </td>
    </tr>`).join('');

  el.innerHTML = `<div class="modal" style="max-width:600px">
    <div class="modal-hd">
      <div class="modal-title">👤 학생 추가 (한 번에 최대 6명)</div>
      <button class="modal-close" onclick="this.closest('.overlay').remove()">✕</button>
    </div>
    <div style="font-size:.75rem;color:var(--txt3);margin-bottom:.6rem">이름을 입력하면 해당 줄이 활성화돼요. 비어 있는 줄은 건너뛰어요.</div>
    <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse">
      <thead><tr class="text-muted-sm">
        <th style="padding:.2rem;width:24px">#</th>
        <th style="padding:.2rem;text-align:left">이름 *</th>
        <th style="padding:.2rem;text-align:left">비번</th>
        <th style="padding:.2rem;text-align:left">장래희망</th>
        <th style="padding:.2rem;text-align:left">캐릭터</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </div>
    <div style="display:flex;gap:.6rem;margin-top:1rem">
      <button class="btn-sm success" style="flex:1;padding:.65rem" onclick="doAddStudents(this)">✅ 추가하기</button>
      <button class="btn-sm outline" onclick="this.closest('.overlay').remove()">취소</button>
    </div>
  </div>`;
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
  document.body.appendChild(el);
  setTimeout(() => document.getElementById('add-name-0').focus(), 50);
}

function onAddRowInput(i) {
  // 이름 입력하면 해당 줄 활성화
  const row = document.getElementById(`add-row-${i}`);
  const name = document.getElementById(`add-name-${i}`)?.value.trim();
  if (row) row.style.opacity = name ? '1' : (i === 0 ? '1' : '.45');
  // 이름 입력되면 다음 줄도 살짝 활성화 힌트
  if (name && i < 5) {
    const nextRow = document.getElementById(`add-row-${i+1}`);
    if (nextRow) nextRow.style.opacity = '.7';
  }
}

function doAddStudents(btn) {
  const avatarMap = {1:'👦',2:'👧'};
  let count = 0;

  for (let i = 0; i < 6; i++) {
    const name = document.getElementById(`add-name-${i}`)?.value.trim();
    if (!name) continue;
    const pw       = document.getElementById(`add-pw-${i}`)?.value || '1234';
    const job      = document.getElementById(`add-job-${i}`)?.value.trim() || '미래를 꿈꾸는 학생';
    const charType = parseInt(document.getElementById(`add-char-${i}`)?.value) || 1;
    const id = 's' + (Date.now() + i);
    const newStudent = {
      id, name, pw, charType,
      dream: job, job: '학생',
      avatar: avatarMap[charType]||'👦',
      level:1, exp:0, gold:0,
      title:'', titles:[],
      stats:{read:0,study:0,art:0,value:0,health:0,life:0},
      combat:{atk:0,def:0,mag:0,spd:0},
      equipment:{}, equipmentIds:{},
      inventory:[], farm:[], books:[],
      monsterLog:[], monsterDailyCount:0, lastMonsterDate:'',
      totalQuests:0, bookCount:0,
      pendingRewards:[], promotionPending:false,
      houseDecorations:[], yardFloor:{}, lastAttendDate:'', achievements:[],
    };
    DB.saveStudent(newStudent);
    count++;
  }

  if (count === 0) { notify('이름을 최소 1명 입력해주세요', 'error'); return; }
  btn.closest('.overlay').remove();
  renderAll();
  populateSelectStudents();
  notify(`✅ ${count}명 추가 완료!`);
}

// approveSelfApply 호환용
function approveSelfApply(studentId, rewardId) {
  approveSingle(studentId, rewardId);
}

