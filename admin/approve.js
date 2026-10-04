// admin/approve.js — 대시보드 인라인 처리 · 핵심 승인(approveReward·approveAll) · 승인 탭(프리셋·필터·격자·목록) · 선택 상자·배지 · 승급 관리
//  admin.js 에서 떼어 옮긴 클래식 스크립트 [ADMIN-SPLIT-1] — 글자 그대로 · 전역 그대로 · admin.html 에서 admin.js 바로 뒤에 부른다.
// ── [ADMIN-SPLIT-1] 'approve' — 원래 admin.js 1122~1952줄 ──
// ══ 대시보드 인라인 처리 함수 ══
function approveAllDash() {
  approveAllAsk();   // [APPROVE-ALL-ASK-1] 확인창은 approveAllAsk 한 곳(건수·따로 볼 것 안내)
}

function approveSingleDash(studentId, rewardId, btn) {
  btn.disabled = true; btn.textContent = '...';
  approveSingle(studentId, rewardId);
}

function rejectSingleDash(studentId, rewardId, btn) {
  btn.disabled = true;
  if (!rejectSingle(studentId, rewardId)) btn.disabled = false;   // [REJECT-ASK-1] 확인창에서 취소하면 단추 되살림
}

function approvePromoDash(reqId, btn) {
  btn.disabled = true; btn.textContent = '...';
  approvePromotion(reqId);
}

function rejectPromoDash(reqId, btn) {
  btn.disabled = true;
  rejectPromotion(reqId);
}

function approvePwResetDash(reqId, studentId, btn) {
  const newPw = prompt('새 비밀번호를 입력하세요:');
  if (!newPw) return;
  const s = DB.getStudent(studentId);
  if (!s) return;
  s.pw = newPw;
  DB.saveStudent(s);
  DB.removePwResetRequest(reqId);
  renderAll();
  // [PW-NOTIFY-1] 교사 화면은 TV 로 미러링된다 — 알림에 새 비밀번호 값을 띄우지 않는다
  notify(`✅ ${s.name} 비밀번호 초기화 완료 · 학생 상세에서 확인`);
}

function rejectPwResetDash(reqId, btn) {
  btn.disabled = true;
  DB.removePwResetRequest(reqId);
  renderAll();
  notify('요청 무시됨');
}


// ══════════════════════════════════════════════════
//  핵심 승인 함수 (모든 승인은 이 함수만 사용)
// ══════════════════════════════════════════════════
// [APPROVE-AFTER-1] later({ run: [], logs: [] })를 주면 기록 쓰기(goldDaily·작품 전시·퀘스트 기록)를 바로 하지 않고 later.run 에 모은다 —
//   부르는 쪽(approveAndSave)이 학생 저장(보상이 서버에 있을 때만 바뀌는 transaction)이 **된 뒤에만** 돌린다.
//   '이미 처리'(REWARD_GONE)·실패면 안 돌린다(PR #1162 검토: 교사 두 기기·학생 취소 순간 승인에서 작품 두 번 전시·기록 두 줄·0G 인데 전시).
//   later.logs = 이번 묶음에서 아직 안 보낸 퀘스트 기록 — A1 중복 막이가 같은 묶음 안의 같은 퀘스트도 본다.
function approveReward(student, reward, later) {
  const write = (f) => { if (later) later.run.push(f); else f(); };
  // 0. [A1] 중복 지급 방지 — 이미 완료 로그가 있는 퀘스트면 보상 없이 신청만 정리.
  //    (교사가 퀘스트 관리에서 ✔완료 처리한 뒤 남은 신청을 다시 승인하는 경로 차단)
  if (reward.boardQuestId) {
    const inFlight = (typeof approveAndSave === 'function' && approveAndSave._inFlight) || [];   // [APPROVE-INFLIGHT-1]
    const doneLogs = (DB.load().quests || []).concat((later && later.logs) || [], inFlight);
    const qType = reward.boardQuestType || reward.type || 'special';
    if (Utils.isQuestDoneToday(doneLogs, student.id, reward.boardQuestId, qType)) {
      student.pendingRewards = (student.pendingRewards||[]).filter(r =>
        r.id !== reward.id && r.label !== reward.id
      );
      return student;
    }
  }

  // 1. EXP / Gold / Level
  student.exp   = (student.exp||0)  + (reward.exp||0);
  student.gold  = (student.gold||0) + (reward.gold||0);
  if ((reward.gold||0) > 0) {
    student.totalGold = (student.totalGold||0) + reward.gold; // [R7] 누적 골드
    // [GOLD-LOG-1] 승인 시점이 곧 지급 시점이다. 기록 실패는 무시된다(logGold 안에서 catch) —
    //   교사가 승인을 눌렀는데 로그 때문에 지급이 안 되는 일은 없어야 한다.
    const sid = student.id, src = DB.goldSourceOf(reward.boardQuestType || reward.type), g = reward.gold;
    write(() => DB.logGold(sid, src, g));
  }
  student.level = Utils.levelFromExp(student.exp);

  // 2. 스탯 증가 (승인 즉시 지급)
  if (reward.stat && reward.statVal) {
    student.stats = student.stats || {};
    student.stats[reward.stat] = Math.round(((student.stats[reward.stat]||0) + (reward.statVal||1)) * 10) / 10;
  }

  // 3. 타입별 처리
  if (reward.type === 'artwork') {
    const aw = {
      id: 'aw_' + Date.now() + '_' + student.id,
      studentId: student.id,
      title:   reward.artTitle || reward.label,
      artUrl:  reward.artUrl   || '',
      comment: reward.artDesc  || '',
      subject: reward.subject  || '',
      kind:    reward.kind     || 'lesson',   // [ARTFREE-1] 수업 작품 / 자유 작품 구분
      date:    reward.date     || Utils.todayStr(),
    };
    write(() => DB.saveArtwork(aw));
  } else if (reward.type === 'book') {
    // [R4] 독서 탭(confirmBookRecord)과 같은 필드 집합으로 저장.
    //   기존엔 title/review/date 3개만 남겨서 이 경로로 승인하면 별점·분류·인물이 사라지고,
    //   분류 필터에서 빠지며 별점/인물 업적(ach_book_rate·ach_book_char)이 영구 미달성이 됐다.
    // [R5] id가 없으면 교사 코멘트가 엉뚱한 책에 저장된다.
    // teacherChecked는 false로 둔다 — 교사가 독서 탭에서 내용을 확인하기 전이므로.
    student.books = student.books || [];
    student.books.push({
      id:              reward.id || ('bk_' + Date.now() + '_' + student.id),
      title:           reward.bookTitle || reward.label || '',
      category:        reward.category || '',
      customCategory:  reward.customCategory || '',
      rating:          reward.rating || 0,
      characterName:   reward.characterName || '',
      characterReason: reward.characterReason || '',
      summary:         reward.summary || '',
      reflection:      reward.reflection || '',
      review:          reward.bookReview || '',
      date:            reward.bookDate || reward.date || Utils.todayStr(),
      createdAt:       reward.createdAt || Date.now(),
      teacherChecked:  false,
    });
    student.bookCount = student.books.length;
  } else {
    // 일반 퀘스트
    student.totalQuests = (student.totalQuests||0) + 1;
  }

  // 4. quests 로그 저장 (boardQuestId + boardQuestType + date 포함)
  const qlog = {
    studentId:    student.id,
    boardQuestId: reward.boardQuestId || null,
    boardQuestType: reward.boardQuestType || reward.type || 'special',
    type:         reward.type || 'quest',
    name:         reward.label,
    exp:          reward.exp  || 0,
    gold:         reward.gold || 0,
    stat:         reward.stat || '',
    statVal:      reward.statVal || 0,
    icon:         reward.icon || '📋',
    // [A2] 완료일 = 학생이 신청한 날. 승인일로 덮어쓰면 주간퀘스트가 다음 주까지
    //      완료로 잠기고 일일 집계도 승인일로 몰린다. 승인 시각은 approvedAt에 별도 기록.
    date:         reward.date || Utils.todayStr(),
    approvedAt:   Utils.todayStr(),
    approved:     true,
  };
  if (later && later.logs) later.logs.push(qlog);
  write(() => DB.saveQuestLog(qlog));

  // 5. pendingReward 즉시 제거
  student.pendingRewards = (student.pendingRewards||[]).filter(r =>
    r.id !== reward.id && r.label !== reward.id
  );

  return student;
}

// [APPROVE-AFTER-1] 보상 하나 승인 = 상태 바꾸기(approveReward) + 학생 저장(students/<id> transaction 하나 · 그 보상이 서버에 있을 때만)
//   + 저장이 **된 뒤에만** 기록 쓰기(goldDaily·작품 전시·퀘스트 기록). 돌려주는 약속: 저장 결과(REWARD_GONE·실패면 거절).
//   logs: 같은 묶음([전체 승인])의 아직 안 보낸 퀘스트 기록(A1 중복 막이가 함께 본다)
//  [APPROVE-INFLIGHT-1] 답을 기다리는 승인의 퀘스트 기록 — 기록은 저장 답 뒤에 캐시에 들어가므로, 그 사이(왕복 하나·오프라인)
//   따로 누른 같은 퀘스트의 다른 신청을 A1 이 못 보고 또 지급했다(PR #1162 3차 검토: 0ms 간격 1040 · 기대 1020). 끝나면(성공·실패) 뺀다.
//   목록은 함수에 붙여 둔다(approveAndSave._inFlight) — 시험이 함수만 잘라 써도 같은 목록을 본다.
function approveAndSave(s, reward, logs) {
  const later = { run: [], logs: logs || [] };
  const mark = later.logs.length;
  approveReward(s, reward, later);
  const mine = later.logs.slice(mark);
  approveAndSave._inFlight = (approveAndSave._inFlight || []).concat(mine);
  const done = () => { approveAndSave._inFlight = (approveAndSave._inFlight || []).filter(l => !mine.includes(l)); };
  return saveStudentAwait(s, { atomic: true }).then(r => {
    later.run.forEach(f => { try { f(); } catch (e) { console.error('[APPROVE-AFTER-1] 기록 쓰기 실패', e); } });
    done();
    return r;
  }, e => { done(); throw e; });
}

// [APPROVE-AWAIT-1] 학생 저장의 약속(Promise)을 받는다.
//   DB.saveStudent 는 약속을 돌려주지 않아(gamedata.js 저장 내부는 묶음 3 구역이라 여기서 안 바꾼다)
//   '승인 완료' 알림이 서버 저장 전에 떴다 — 인터넷이 끊겨도 완료라고 나왔다.
//   saveStudent 가 부르는 students/<id> 쓰기(set·update)의 약속을 그 순간에만 옆에서 받아 돌려준다. 쓰기는 한 번 그대로.
//   saveStudent 가 나중에 약속을 돌려주게 바뀌면 그것을 그대로 쓴다.
//   [APPROVE-ATOMIC-1] opt 는 DB.saveStudent 로 그대로 넘긴다(승인 = { atomic: true } → students/<id> transaction 하나).
function saveStudentAwait(s, opt) {
  const ref = DB._fbRef, want = 'students/' + s.id;
  let got = null;
  const canHook = !!(ref && typeof ref.child === 'function');
  const own = canHook && Object.prototype.hasOwnProperty.call(ref, 'child');
  const origChild = canHook ? ref.child : null;
  if (canHook) {
    ref.child = function (p) {
      const c = origChild.apply(this, arguments);
      if (p === want && c) ['set', 'update'].forEach(m => {
        if (typeof c[m] !== 'function') return;
        const orig = c[m];
        c[m] = function () { const pr = orig.apply(this, arguments); if (!got) got = pr; return pr; };
      });
      return c;
    };
  }
  let ret;
  try { ret = DB.saveStudent(s, opt); }
  finally { if (canHook) { if (own) ref.child = origChild; else delete ref.child; } }
  if (ret && typeof ret.then === 'function') return ret;
  return got && typeof got.then === 'function' ? got : Promise.resolve();
}

// [APPROVE-AWAIT-1] 저장 약속들이 끝난 뒤 알린다. 8초가 지나도 안 끝나면 '아직 저장 중' 을 한 번 알린다(오프라인이면 SDK 가 계속 기다린다).
//   [APPROVE-ATOMIC-1] onDone(실패 수, 전체 수, 이미 처리된 보상 수) — 셋째 = 승인 저장이 '이미 다른 곳에서 처리된 보상'이라
//   아무것도 안 바꾼 수(DB._stuSendAtomic 의 REWARD_GONE). 실패가 아니므로 첫째(실패 수)에는 안 넣는다.
function afterSaves(promises, onDone) {
  const list = (promises || []).map(p => Promise.resolve(p));
  let finished = false;
  const slow = setTimeout(() => { if (!finished) notify('⏳ 아직 저장 중이에요 — 인터넷 연결을 확인해 주세요', 'error'); }, 8000);
  return Promise.allSettled(list).then(rs => {
    finished = true; clearTimeout(slow);
    const gone = rs.filter(r => r.status === 'rejected' && r.reason && r.reason.code === 'REWARD_GONE').length;
    const failed = rs.filter(r => r.status === 'rejected').length - gone;
    onDone(failed, rs.length, gone);
    return failed;
  });
}

function approveSingle(studentId, rewardId, opts) {
  const s = DB.getStudent(studentId);
  // [C9] 무음 return이면 대시보드 버튼이 '...' 상태로 영구 고착된다(교사는 멈춘 줄 앎).
  //      찾지 못한 이유를 알리고 화면을 다시 그려 버튼 상태를 복구한다.
  if (!s) { notify('학생을 찾을 수 없어요', 'error'); renderAll(); return Promise.resolve(false); }
  const reward = (s.pendingRewards||[]).find(r => r.id === rewardId || r.label === rewardId);
  if (!reward) { notify('이미 처리된 보상이에요', 'error'); renderAll(); return Promise.resolve(false); }
  //  [APPROVE-ATOMIC-1] 보상 빼기 + 골드·EXP 를 한 쓰기로 — 보상이 서버에 아직 있을 때만(다른 기기가 먼저 승인했으면 아무것도 안 함)
  //  [APPROVE-AFTER-1] 기록 쓰기는 저장이 된 뒤에만
  const saved = approveAndSave(s, reward);
  renderAll();
  if (opts && opts.quiet) return saved;   // 묶음 승인(approveAllByQuest)은 끝에 한 번만 알린다
  // [APPROVE-AWAIT-1] 저장이 끝난 뒤에 알린다. 실패면 실패 안내.
  return afterSaves([saved], (failed, n, gone) => {
    if (gone) notify(`ℹ️ ${s.name} · ${reward.label} 은(는) 이미 다른 곳에서 처리된 보상이에요 — 한 번만 지급했어요`, 'error');
    else if (failed) notify(`⚠️ ${s.name} · ${reward.label} 승인 저장에 실패했어요. 새로고침 뒤 다시 확인해 주세요.`, 'error');
    else notify(`✅ ${s.name} · ${reward.label} 승인 완료!`);
  }).then(failed => !failed);
}

// [APPROVE-ALL-ASK-1] [전체 승인]에서 빼는 것 — 작품(그림·사진)·독서록은 교사가 하나씩 보고 승인한다.
//   한꺼번에 승인하면 내용을 보지 않은 그림·글이 그대로 작품 관리·독서 기록에 올라간다.
const APPROVE_ALL_SKIP_TYPES = ['artwork', 'book'];
function approveAllCounts() {
  let ok = 0, skip = 0;
  DB.getStudents().forEach(s => (s.pendingRewards || []).forEach(r => {
    if (!r) return;
    if (APPROVE_ALL_SKIP_TYPES.includes(r.type)) skip++; else ok++;
  }));
  return { ok, skip };
}
// 단추가 부르는 자리 — 건수를 보여 주고 묻는다
function approveAllAsk() {
  const { ok, skip } = approveAllCounts();
  if (ok === 0) {
    notify(skip ? `한꺼번에 승인할 보상이 없어요 · 작품·독서록 ${skip}건은 하나씩 보고 승인해 주세요` : '승인할 대기가 없어요', 'error');
    return;
  }
  const skipLine = skip ? `\n\n작품(그림·사진)·독서록 ${skip}건은 빼요 — 하나씩 보고 승인해 주세요.` : '';
  if (!confirm(`보상 ${ok}건을 한꺼번에 승인할까요?\n보상이 바로 지급되고 되돌릴 수 없어요.${skipLine}`)) return;
  approveAll();
}

function approveAll() {
  const students = DB.getStudents();
  let count = 0, skipped = 0;
  const saves = [];
  students.forEach(s => {
    const pending = (s.pendingRewards||[]).filter(Boolean);
    if (pending.length === 0) return;
    // [APPROVE-ALL-ASK-1] 작품·독서록은 남겨 둔다(따로 확인)
    const held = pending.filter(r => APPROVE_ALL_SKIP_TYPES.includes(r.type));
    const go   = pending.filter(r => !APPROVE_ALL_SKIP_TYPES.includes(r.type));
    skipped += held.length;
    if (go.length === 0) return;
    //  [APPROVE-ATOMIC-1] **보상마다** 한 쓰기(그 보상이 서버에 있을 때만) — 학생 한 명을 한 쓰기로 묶으면 그중 하나가 사라졌을 때
    //   (키오스크 취소·다른 교사 기기) 다른 보상까지 지급이 안 되고, 기록만 남아 다시 승인하면 A1 이 0G 로 지웠다(PR #1162 검토 Y8·Y9).
    //   승인한 것은 approveReward 가 하나씩 뺀다 — 남는 것은 작품·독서록(held)뿐
    const logs = [];
    go.forEach(r => saves.push(approveAndSave(s, r, logs)));
    count += go.length;
  });
  renderAll();
  // [APPROVE-AWAIT-1] 저장이 끝난 뒤에 알린다
  return afterSaves(saves, (failed, n, gone) => {
    const tail = skipped ? ` · 따로 확인할 것 ${skipped}건(작품·독서록)` : '';
    const goneTail = gone ? ` · ${gone}건은 이미 다른 곳에서 처리돼 그대로 둠` : '';
    if (failed) notify(`⚠️ ${n}건 중 ${failed}건 저장 안 됨 — 새로고침 뒤 다시 확인해 주세요${goneTail}${tail}`, 'error');
    else notify(`✅ ${n - gone}건 전체 승인 완료!${goneTail}${tail}`);
  });
}

// [REJECT-ASK-1] 반려하면 신청이 지워진다 — 작품·독서록이면 아이가 쓴 글·그림 신청도 함께 사라진다. 먼저 묻는다.
//   돌려주는 값: 실제로 반려했으면 true(대시보드 단추 되살리기에 쓴다)
function rejectSingle(studentId, rewardId) {
  const s = DB.getStudent(studentId);
  if (!s) return false;
  const r = (s.pendingRewards||[]).find(x => x && (x.id === rewardId || x.label === rewardId));
  const what = r && r.type === 'book' ? '\n\n독서록이에요 — 아이가 쓴 글이 함께 지워져요.'
             : r && r.type === 'artwork' ? '\n\n작품이에요 — 아이가 올린 그림·사진 신청이 함께 지워져요.' : '';
  if (!confirm(`${s.name} · ${(r && r.label) || '이 신청'}을(를) 반려할까요?\n보상 없이 신청이 지워지고 되돌릴 수 없어요.${what}`)) return false;
  s.pendingRewards = (s.pendingRewards||[]).filter(r => r.id !== rewardId && r.label !== rewardId);
  const saved = saveStudentAwait(s);
  renderAll();
  afterSaves([saved], failed => {
    if (failed) notify(`⚠️ ${s.name} 반려 저장에 실패했어요. 새로고침 뒤 다시 확인해 주세요.`, 'error');
    else notify('🗑️ 반려됨', 'error');
  });
  return true;
}

function quickApprove() {
  const studentId = document.getElementById('qa-student').value;
  const name  = document.getElementById('qa-name').value.trim();
  const exp   = Utils.intOr(document.getElementById('qa-exp').value, 30);   // [ZERO-OK-1] 0 은 0
  const gold  = Utils.intOr(document.getElementById('qa-gold').value, 30);
  const stat  = document.getElementById('qa-stat').value;
  const icon  = document.getElementById('qa-icon')?.value?.trim() || '📋';
  if (!name) { notify('활동명을 입력하세요', 'error'); return; }

  const reward = {
    id: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    label: name, exp, gold, stat, statVal: stat ? (Math.round((parseFloat(document.getElementById('reward-statval')?.value)||1)*10)/10) : 0,
    icon, date: Utils.todayStr(),
  };

  if (studentId === 'all') {
    DB.getStudents().forEach(s => {
      s.pendingRewards = [...(s.pendingRewards||[]), {...reward}];
      DB.saveStudent(s);
    });
    notify(`✅ 전체 학생에게 "${name}" 보상 대기를 만들었어요. 승인하면 지급돼요.`);
  } else {
    const s = DB.getStudent(studentId);
    if (!s) { notify('학생을 찾을 수 없어요', 'error'); return; }
    s.pendingRewards = [...(s.pendingRewards||[]), reward];
    DB.saveStudent(s);
    notify(`✅ ${s.name}에게 "${name}" 보상 대기를 만들었어요. 승인하면 지급돼요.`);
  }
  renderAll();
}

// ── 프리셋 ──
const PRESETS = {
  read:    { name:'📚 독서 완료',        exp:30, gold:20, stat:'read',   icon:'📚' },
  hw:      { name:'📝 숙제 완료',        exp:25, gold:20, stat:'study',  icon:'📝' },
  clean:   { name:'🧹 청소 당번',        exp:20, gold:15, stat:'health', icon:'🧹' },
  prep:    { name:'🎒 준비물 챙기기',    exp:15, gold:15, stat:'value',  icon:'🎒' },
  present: { name:'🙋 발표 참여',        exp:35, gold:25, stat:'study',  icon:'🙋' },
  help:    { name:'🤝 친구 도움',        exp:30, gold:20, stat:'value',  icon:'🤝' },
  daily:   { name:'📋 일일 퀘스트',     exp:30, gold:30, stat:'',       icon:'📋' },
  special: { name:'⭐ 특별 활동 보상',   exp:50, gold:50, stat:'',       icon:'⭐' },
};
let _lastPreset = null;

function fillPreset(type) {
  const p = PRESETS[type];
  if (!p) return;
  document.getElementById('qa-name').value  = p.name;
  document.getElementById('qa-exp').value   = p.exp;
  document.getElementById('qa-gold').value  = p.gold;
  document.getElementById('qa-stat').value  = p.stat || '';
  document.getElementById('qa-icon').value  = p.icon || '✅';
  _lastPreset = type;
  // 하이라이트
  document.querySelectorAll('[onclick^="fillPreset"]').forEach(b => b.classList.remove('success'));
  event?.target?.classList.add('success');
  const hint = document.getElementById('last-preset-hint');
  if (hint) hint.textContent = `"${p.name}" 보상 칸 채움`;
}

// ── 필터 ──
let APPROVE_FILTER = 'all';
function setApproveFilter(type, el) {
  APPROVE_FILTER = type;
  document.querySelectorAll('[id^="af-"]').forEach(b => {
    b.classList.remove('success');
    b.classList.add('outline');
  });
  el.classList.remove('outline');
  el.classList.add('success');
  renderApproveList();
}

function renderApproveGrid() {
  const el = document.getElementById('approve-grid');
  if (!el) return;
  const students    = DB.getStudents();
  const db          = DB.load();
  const boardQuests = (db.boardQuests||[]).filter(q => q.active!==false);
  const today       = Utils.todayStr();
  const weekStart   = Utils.weekStartStr();

  if (boardQuests.length === 0) {
    el.innerHTML = '<div style="padding:1rem;text-align:center;font-size:.82rem;color:var(--txt3)">활성 퀘스트가 없어요</div>';
    return;
  }

  // ★ 공통 기준: questLogs 배열 + activeBQIds
  const allQuests   = db.quests || []; // _normalizeArrays에서 questLogs → quests로 정규화됨
  const activeBQIds = new Set(boardQuests.map(q=>q.id));
  function getStatus(studentId, questId, questType, s) {
    return Utils.questStatus(studentId, questId, questType, allQuests, s.pendingRewards, activeBQIds);
  }

  let html = `<table style="width:max-content;min-width:100%;border-collapse:collapse">
    <thead><tr style="background:var(--bg3)">
      <th style="padding:.5rem .8rem;text-align:left;font-size:.78rem;border:1px solid var(--border2);min-width:160px;position:sticky;left:0;background:var(--bg3);z-index:5">퀘스트</th>
      ${students.map(s=>`<th style="padding:.4rem .3rem;text-align:center;font-size:.72rem;border:1px solid var(--border2);min-width:64px">
        <div style="font-size:1rem">${s.avatar}</div>
        <div>${escHtml(s.name)}</div>
      </th>`).join('')}
    </tr></thead><tbody>`;

  boardQuests.forEach(q => {
    html += `<tr>
      <td style="padding:.4rem .8rem;font-size:.78rem;font-weight:600;border:1px solid var(--border2);position:sticky;left:0;background:var(--bg2);z-index:4">
        ${escHtml(q.icon||'📋')} ${escHtml(q.name)}
        <div style="font-size:.65rem;color:var(--gold);font-weight:400">+${q.exp}EXP +${q.gold}G</div>
      </td>`;
    students.forEach(s => {
      const _st     = getStatus(s.id, q.id, q.type, s);
      const done    = _st === 'done';
      const pending = _st === 'pending';
      const reward  = pending ? (s.pendingRewards||[]).find(r=>r.boardQuestId===q.id) : null;
      if (done) {
        html += `<td style="border:1px solid var(--border2);text-align:center;padding:.3rem">
          <div style="width:40px;height:40px;border-radius:50%;background:rgba(46,204,113,.15);border:2px solid #2ECC71;display:flex;align-items:center;justify-content:center;margin:auto;font-size:1.1rem;color:#2ECC71">✓</div>
        </td>`;
      } else if (pending && reward) {
        html += `<td style="border:1px solid var(--border2);text-align:center;padding:.3rem">
          <div onclick="gridApprove('${s.id}','${reward.id}')" style="width:40px;height:40px;border-radius:50%;background:rgba(255,215,0,.15);border:2px solid var(--gold);display:flex;align-items:center;justify-content:center;margin:auto;font-size:1rem;cursor:pointer;color:var(--gold)" title="클릭하여 승인">⏳</div>
        </td>`;
      } else {
        html += `<td style="border:1px solid var(--border2);text-align:center;padding:.3rem">
          <div style="width:40px;height:40px;border-radius:50%;border:2px solid rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;margin:auto;font-size:.9rem;color:rgba(255,255,255,.2)">○</div>
        </td>`;
      }
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  el.innerHTML = html;
}

function gridApprove(studentId, rewardId) {
  const s = DB.getStudent(studentId);
  if (!s) return;
  const reward = (s.pendingRewards||[]).find(r => r.id === rewardId);
  if (!reward) return;
  const saved = approveAndSave(s, reward);   // [APPROVE-AWAIT-1] · [APPROVE-ATOMIC-1] 한 쓰기 · 보상이 있을 때만 · [APPROVE-AFTER-1] 기록은 그 뒤
  renderApproveGrid();
  renderApproveList();
  renderDashboard();
  afterSaves([saved], (failed, n, gone) => gone
    ? notify(`ℹ️ ${s.name} · ${reward.label} 은(는) 이미 다른 곳에서 처리된 보상이에요 — 한 번만 지급했어요`, 'error')
    : failed
    ? notify(`⚠️ ${s.name} · ${reward.label} 승인 저장에 실패했어요. 새로고침 뒤 다시 확인해 주세요.`, 'error')
    : notify(`✅ ${s.name} · ${reward.label} 승인!`));
}

function renderApproveList() {
  const students  = DB.getStudents();
  const container = document.getElementById('approve-list');
  const today     = Utils.todayStr();

  // [Q-3D] 활동 승인 탭 렌더 시 pendingRewards를 삭제/저장하지 않는다.
  //        (이전엔 비활성/삭제 퀘스트 참조 pending을 필터링한 뒤 DB에 저장 → 활동 승인 탭에
  //         진입하는 것만으로 미승인 보상이 영구 삭제됐음. Q-1 보존 정책과 정합하도록 제거.)
  //        비활성/삭제 퀘스트의 미승인 보상도 목록에 남겨 교사가 나중에 승인/반려할 수 있게 한다.
  //        (reward 객체에 label/exp/gold/stat/statVal이 있어 원 퀘스트 active 여부와 무관하게 승인 가능)
  let items = students.flatMap(s =>
    (s.pendingRewards||[])
      .filter(r => !r.approved)
      .map(r => ({...r, student: s}))
  );

  // [B5] '오늘만' 필터는 일반 대기에만 적용한다.
  //   ⚠️ 확인 필요 보상(닫힌·삭제된 퀘스트 참조)은 정의상 과거 것이라, 필터에 걸리면
  //   섹션째 사라져 "뱃지엔 3건인데 목록은 비어 있음"이 됐다(교사는 오류로 오인).
  if (APPROVE_FILTER === 'today') {
    const _bqToday = new Map((DB.load().boardQuests || []).map(q => [q.id, q]));
    items = items.filter(i => {
      if (i.date === today) return true;
      if (!i.boardQuestId) return false;
      const q = _bqToday.get(i.boardQuestId);
      return !q || q.active === false; // 삭제·닫힘 = 확인 필요 → 필터와 무관하게 표시
    });
  }

  if (items.length === 0) {
    container.innerHTML = '<div style="padding:1.5rem;text-align:center;font-size:.85rem;color:var(--txt3)">대기 중인 활동이 없어요 ✅</div>';
    updatePendingBadge(); return;
  }

  // boardQuestId 기준으로 묶음 승인 가능한 그룹 계산
  const questGroups = {};
  items.forEach(item => {
    if (item.boardQuestId) {
      if (!questGroups[item.boardQuestId]) questGroups[item.boardQuestId] = [];
      questGroups[item.boardQuestId].push(item);
    }
  });

  // [Q-3E-1] boardQuest 상태 판정 (read-only) — 닫힌/삭제 퀘스트 보상 표시용
  const _db3e = DB.load();
  const questMap = new Map((_db3e.boardQuests || []).map(q => [q.id, q]));
  function getRewardQuestStatus(item) {
    if (!item.boardQuestId) return { key: 'general', badge: '' };
    const quest = questMap.get(item.boardQuestId);
    if (!quest) return { key: 'deleted', badge: '🗑️ 삭제된 퀘스트' };
    if (quest.active === false) return { key: 'inactive', badge: '🚫 닫힌 퀘스트' };
    return { key: 'active', badge: '' };
  }
  let inactiveCount = 0, deletedCount = 0;
  items.forEach(item => {
    const k = getRewardQuestStatus(item).key;
    if (k === 'inactive') inactiveCount++;
    else if (k === 'deleted') deletedCount++;
  });
  const needsReviewCount = inactiveCount + deletedCount;
  const reviewSummary = needsReviewCount > 0 ? `
    <div style="margin-bottom:.7rem;padding:.6rem .9rem;background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.2);border-radius:var(--r);font-size:.78rem;line-height:1.6">
      <div style="font-weight:700;color:var(--gold)">⚠️ 확인 필요 보상 ${needsReviewCount}건</div>
      <div style="color:var(--txt2)">${[inactiveCount>0?`🚫 닫힌 퀘스트 ${inactiveCount}건`:'', deletedCount>0?`🗑️ 삭제된 퀘스트 ${deletedCount}건`:''].filter(Boolean).join(' · ')}</div>
      <div style="color:var(--txt3);font-size:.72rem">승인/반려는 기존과 동일하게 처리할 수 있습니다.</div>
    </div>` : '';

  // [Q-3E-2-1] 카드 렌더는 helper로 추출 (기존 카드 HTML/onclick 인자/배지/만료표시 그대로 유지)
  const renderRewardCard = (item) => {
    const isExpired = item.date && item.date < today;
    const groupCount = item.boardQuestId ? (questGroups[item.boardQuestId]||[]).length : 0;
    const qStatus = getRewardQuestStatus(item);
    return `
    <div class="approve-card" style="${isExpired?'border-left:3px solid rgba(255,100,100,.4)':''}">
      <div style="font-size:1.5rem">${item.icon||'📋'}</div>
      <div class="ac-left">
        <div class="ac-student">${item.student.avatar} ${escHtml(item.student.name)}
          <span style="font-size:.65rem;color:${isExpired?'var(--red)':'var(--txt3)'};margin-left:.3rem">
            ${item.date||''}${isExpired?' (기간 만료)':''}
          </span>
          ${item.type==='book'?`<span style="font-size:.68rem;background:rgba(93,173,226,.12);color:var(--sky);border-radius:8px;padding:.05rem .4rem;margin-left:.3rem">📚 독서</span>`:''}
          ${item.type==='artwork'?`<span style="font-size:.68rem;background:rgba(155,89,182,.12);color:var(--purple);border-radius:8px;padding:.05rem .4rem;margin-left:.3rem">🎨 작품</span>`:''}
          ${qStatus.badge?`<span style="font-size:.68rem;background:rgba(255,215,0,.12);color:var(--gold);border-radius:8px;padding:.05rem .4rem;margin-left:.3rem">${qStatus.badge}</span>`:''}
        </div>
        <div class="ac-quest">${escHtml(item.label)}</div>
        ${item.bookReview?`<div style="font-size:.72rem;color:var(--txt2);margin-top:.3rem;padding:.3rem .5rem;background:rgba(255,255,255,.04);border-radius:8px;border-left:2px solid rgba(93,173,226,.3);line-height:1.5">${escHtml(item.bookReview.length>80?item.bookReview.slice(0,80)+'...':item.bookReview)}</div>`:''}
        <div class="ac-rewards">
          <span class="ac-tag">+${item.exp}EXP</span>
          <span class="ac-tag">+${item.gold||0}G</span>
          ${item.stat ? `<span class="ac-tag">${GAME_DATA.statNames[item.stat]||item.stat} +${item.statVal||1}</span>` : ''}
        </div>
      </div>
      <div class="ac-right" style="display:flex;flex-direction:column;gap:.3rem">
        <button class="btn-sm success" onclick="approveSingle('${item.student.id}','${item.id}')">✅</button>
        <button class="btn-sm danger"  onclick="rejectSingle('${item.student.id}','${item.id}')">✕</button>
        ${groupCount > 1 ? `<button class="btn-sm outline" style="font-size:.64rem;padding:.2rem .4rem;white-space:nowrap"
          onclick="approveAllByQuest('${item.boardQuestId}')">전체(${groupCount})</button>` : ''}
      </div>
    </div>`;
  };

  // [Q-3E-2-1] 상태 기준 2그룹 분리 (general/active = 일반, inactive/deleted = 확인 필요)
  //            카드 순서는 각 그룹 내부에서 기존 items 순서를 그대로 유지한다.
  const generalItems = items.filter(item => {
    const k = getRewardQuestStatus(item).key;
    return k === 'general' || k === 'active';
  });
  const needsReviewItems = items.filter(item => {
    const k = getRewardQuestStatus(item).key;
    return k === 'inactive' || k === 'deleted';
  });

  const sectionHeader = (title, count, desc) => `
    <div style="margin:.9rem 0 .5rem;display:flex;align-items:baseline;gap:.4rem">
      <span style="font-weight:700;font-size:.82rem;color:var(--txt)">${title}</span>
      <span style="font-size:.72rem;color:var(--txt3)">${count}건</span>
    </div>${desc?`<div style="font-size:.72rem;color:var(--txt3);margin-bottom:.4rem;line-height:1.5">${desc}</div>`:''}`;

  let listHtml = '';
  // 일반 승인 대기 섹션: 일반/활성 보상이 있을 때만 표시
  if (generalItems.length > 0) {
    listHtml += sectionHeader('일반 승인 대기', generalItems.length, '')
      + generalItems.map(renderRewardCard).join('');
  }
  // 확인 필요 보상 섹션: 닫힌/삭제 퀘스트 보상이 1건 이상일 때만 표시
  if (needsReviewItems.length > 0) {
    // [Q-3F-2-1] 안내 문구 강화 + 가장 오래된 신청일/경과일 표시 (표시 전용, 데이터/구조 변경 없음)
    let needsReviewDesc = '닫힌/삭제된 퀘스트에서 온 보상입니다. 오래 남기지 말고 승인 또는 반려로 정리하세요. 승인/반려는 기존과 동일하게 처리됩니다.';
    const reviewDates = needsReviewItems
      .map(item => item.date)
      .filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (reviewDates.length > 0) {
      const oldest = reviewDates.reduce((a, b) => (a < b ? a : b));
      const oldestMs = Date.parse(oldest + 'T00:00:00');
      const todayMs  = Date.parse(Utils.todayStr() + 'T00:00:00');
      let elapsedTxt = '';
      if (!isNaN(oldestMs) && !isNaN(todayMs) && todayMs >= oldestMs) {
        const days = Math.floor((todayMs - oldestMs) / 86400000);
        elapsedTxt = ` (${days}일 경과)`;
      }
      needsReviewDesc += `<br/>가장 오래된 신청: ${oldest}${elapsedTxt}`;
    }
    listHtml += sectionHeader('⚠️ 확인 필요 보상', needsReviewItems.length, needsReviewDesc)
      + needsReviewItems.map(renderRewardCard).join('');
  }

  container.innerHTML = reviewSummary + listHtml;
  updatePendingBadge();
}

// 같은 퀘스트 전체 승인
function approveAllByQuest(boardQuestId) {
  const students = DB.getStudents();
  // [C10] 일괄 지급은 되돌릴 수 없는데 확인창이 없어 오클릭 위험이 컸다.
  const targets = students.filter(s => (s.pendingRewards||[]).some(r=>r.boardQuestId===boardQuestId));
  if (targets.length === 0) { notify('승인할 대기가 없어요', 'error'); return; }
  const qName = (DB.load().boardQuests||[]).find(q=>q.id===boardQuestId)?.name || '이 퀘스트';
  if (!confirm(`"${qName}" 신청 ${targets.length}명을 모두 승인할까요?\n\n보상이 즉시 지급되며 되돌릴 수 없어요.`)) return;

  let count = 0;
  const saves = [];
  targets.forEach(s => {
    const reward = (s.pendingRewards||[]).find(r=>r.boardQuestId===boardQuestId);
    if (reward) { saves.push(approveSingle(s.id, reward.id, { quiet: true })); count++; }
  });
  // [APPROVE-AWAIT-1] 저장이 끝난 뒤 한 번만 알린다
  if (count > 0) afterSaves(saves, (failed, n, gone) => {   // [APPROVE-ATOMIC-1] '이미 처리'는 실패와 따로
    const goneTail = gone ? ` · ${gone}명은 이미 다른 곳에서 처리돼 그대로 둠` : '';
    if (failed) notify(`⚠️ ${count}명 중 ${failed}명 저장 실패 — 새로고침 뒤 다시 확인해 주세요${goneTail}`, 'error');
    else notify(`✅ ${count - gone}명 전체 승인 완료!${goneTail}`);
  });
}

// ══════════════════════════════════════════════════
//  POPULATE SELECTS
// ══════════════════════════════════════════════════

function populateSelectStudents() {
  const sel = document.getElementById('qa-student');
  DB.getStudents().forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id; opt.textContent = s.name;
    sel.appendChild(opt);
  });
}

function updatePendingBadge() {
  const total = DB.getStudents().reduce((a,s) => a + (s.pendingRewards||[]).filter(r => !r.approved).length, 0);
  const badge = document.getElementById('pending-badge');
  if (total > 0) { badge.style.display = 'inline'; badge.textContent = total; }
  else badge.style.display = 'none';
}

function updatePromoBadge() {
  const total = DB.getPromotionRequests().length;
  const badge = document.getElementById('promo-badge');
  if (!badge) return;
  if (total > 0) { badge.style.display = 'inline'; badge.textContent = total; }
  else badge.style.display = 'none';
}

// ══════════════════════════════════════════════════
//  PROMOTION MANAGEMENT
// ══════════════════════════════════════════════════
function renderPromotionList() {
  try {
    const requests = DB.getPromotionRequests() || [];
    updatePromoBadge();
    const container = document.getElementById('promo-list');
    if (!container) return;

    const students = DB.getStudents();
    const validIds = new Set(students.map(s => s.id));
    const orphans  = requests.filter(r => !validIds.has(r.studentId));

    // 디버그 로그
    if (orphans.length) console.warn('[승급관리] 고아 요청:', orphans);

    if (requests.length === 0) {
      container.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--txt3);font-size:.85rem">대기 중인 승급 신청이 없어요</div>';
    } else {
      container.innerHTML = requests.map(req => {
        const s = DB.getStudent(req.studentId);
        if (!s) {
          return `<div class="approve-card" style="border:1px solid var(--red);opacity:.9">
            <div style="font-size:2rem">⚠️</div>
            <div class="ac-left">
              <div class="ac-student" style="color:var(--red)">알 수 없는 학생</div>
              <div class="ac-quest">studentId: ${req.studentId} · Lv.${req.level} · ${req.date||''}</div>
              <div class="ac-rewards"><span class="ac-tag" style="background:rgba(231,76,60,.15);color:var(--red)">⚠️ 주인 없는 신청 — 학생 목록에 없는 학생의 신청이에요</span></div>
            </div>
            <div class="ac-right">
              <button class="btn-sm danger" onclick="rejectPromotion('${req.id}')">🗑️ 삭제</button>
            </div>
          </div>`;
        }
        return `<div class="approve-card">
          <div style="font-size:2rem">⬆️</div>
          <div class="ac-left">
            <div class="ac-student">${s.avatar} ${escHtml(s.name)}</div>
            <div class="ac-quest">Lv.${req.level} 승급 신청 · ${req.date||''}</div>
            <div class="ac-rewards">
              <span class="ac-tag">현재 Lv.${s.level||1}</span>
              <span class="ac-tag">EXP ${s.exp||0}</span>
            </div>
          </div>
          <div class="ac-right">
            <button class="btn-sm success" onclick="approvePromotion('${req.id}')">✅ 승급 승인</button>
            <button class="btn-sm danger" onclick="rejectPromotion('${req.id}')">✕ 반려</button>
          </div>
        </div>`;
      }).join('');

      if (orphans.length > 0) {
        container.innerHTML += `<div style="padding:.7rem 1rem;background:rgba(231,76,60,.06);
          border-top:1px solid rgba(231,76,60,.2);display:flex;align-items:center;gap:.8rem">
          <span style="font-size:.78rem;color:var(--red);flex:1">
            ⚠️ 학생을 찾을 수 없는 요청 ${orphans.length}건 — 위의 🗑️ 버튼 또는 아래 일괄 정리</span>
          <button class="btn-sm danger" onclick="cleanupOrphanPromoRequests()">🧹 일괄 정리</button>
        </div>`;
      }
    }

    const statusEl = document.getElementById('promo-student-status');
    if (!statusEl) return;
    if (students.length === 0) { statusEl.innerHTML = ''; return; }
    // [STUDENT-ORDER-1] 복사해서 정렬한다. students 는 DB.getStudents() 가 돌려준 **캐시 배열 그 자체**라
    //   제자리 sort 하면 캐시 순서가 레벨순으로 바뀌고, 학생 목록 등 다른 화면이 그 순서를 따른다.
    //   다음 쓰기(쪽지 등)가 루트 on('value') 를 깨우면 재정규화로 id순으로 돌아가 "순서가 바뀌었다"로 보였다.
    statusEl.innerHTML = [...students].sort((a,b)=>(b.level||0)-(a.level||0)).map(s => {
      const isPending = requests.some(r=>r.studentId===s.id);
      const expTable  = typeof GAME_DATA !== 'undefined' ? GAME_DATA.expTable : [];
      const curIdx = Math.min((s.level||1)-1, expTable.length-1);
      const nxtIdx = Math.min((s.level||1),   expTable.length-1);
      const curExp = expTable[curIdx] || 0;
      const nxtExp = expTable[nxtIdx] || curExp+1;
      const expPct = nxtExp > curExp ? Math.min(100,Math.round(((s.exp||0)-curExp)/(nxtExp-curExp)*100)) : 100;
      return `<div style="display:flex;align-items:center;gap:.7rem;padding:.5rem 1.2rem;
        border-bottom:1px solid rgba(255,255,255,.05)">
        <span>${s.avatar||'🙂'}</span>
        <span style="font-weight:700;font-size:.88rem;min-width:60px">${escHtml(s.name)}</span>
        <span style="font-size:.78rem;font-weight:700;color:var(--sky)">Lv.${s.level||1}</span>
        <span class="text-muted-sm">${s.job||'학생'}</span>
        <div style="flex:1;height:5px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden;max-width:120px">
          <div style="height:100%;background:linear-gradient(90deg,var(--sky),var(--purple));border-radius:3px;width:${expPct}%"></div>
        </div>
        <span class="text-muted-tiny">${s.exp||0} EXP</span>
        ${isPending?'<span style="font-size:.68rem;background:rgba(155,89,182,.2);color:var(--purple);border-radius:20px;padding:.1rem .45rem;font-weight:700">신청 중</span>':''}
      </div>`;
    }).join('');
  } catch(e) {
    console.error('renderPromotionList 에러:', e);
    const el = document.getElementById('promo-list');
    if (el) el.innerHTML = `<div style="padding:1rem;color:var(--red)">오류: ${e.message}</div>`;
  }
}

function cleanupOrphanPromoRequests() {
  if (!confirm('학생을 찾을 수 없는 승급 요청을 모두 삭제할까요?')) return;
  const validIds = new Set(DB.getStudents().map(s=>s.id));
  const valid = DB.getPromotionRequests().filter(r=>validIds.has(r.studentId));
  DB.savePromotionRequests(valid);
  notify('🧹 주인 없는 승급 신청 정리 완료');
  renderPromotionList();
  updatePromoBadge();
}


function approvePromotion(reqId) {
  const req = DB.getPromotionRequests().find(r => r.id === reqId);
  if (!req) return;
  const s = DB.getStudent(req.studentId);
  // [PROMO-PER-ID-1] 이미 승급한 레벨의 신청(되살아난 신청 등)은 보상 없이 목록에서만 치운다
  if (s && (s.promotedLevels || []).map(Number).includes(Number(req.level))) {
    DB.removePromotionRequest(reqId);
    renderAll();
    notify(`${s.name} Lv.${req.level} 은 이미 승급했어요 — 신청만 정리했습니다`);
    return;
  }
  // 직업명 자동 변경 (장래희망 기반)
  //   [PROMO-JOB-DREAM-1] 꿈이 먼저. 예전엔 job 이 먼저라 Lv20 승급 때 이미 "대학생"인 job 을 꿈으로 써서
  //   "대학생 지망생"이 됐다(운영 3명). 학생 화면(student.js)은 원래 dream || job 순서.
  const newJob = Utils.getJobTitle(s.dream || s.job || '', req.level);
  const oldJob = s.job || '';
  s.job = newJob;
  // 승급 보상 즉시 지급 (받기 버튼 없이)
  s.gold = (s.gold||0) + 100;
  s.totalGold = (s.totalGold||0) + 100;
  s.exp  = (s.exp||0) + 50;
  s.level = Utils.levelFromExp(s.exp);
  s.promotionPending = false;
  // 승급한 레벨 기록 (중복 승급 방지)
  s.promotedLevels = s.promotedLevels || [];
  if (!s.promotedLevels.includes(req.level)) s.promotedLevels.push(req.level);
  // 활동 내역 기록
  DB.saveQuestLog({
    studentId:     s.id,
    boardQuestId:  null,
    boardQuestType:'promotion',
    type:          'promotion',
    name:          `⬆️ Lv.${req.level} 승급! ${oldJob ? `${oldJob} → ` : ''}${newJob}`,
    exp:           50,
    gold:          100,
    stat:          '',
    statVal:       0,
    icon:          '⬆️',
    date:          Utils.todayStr(),
    approved:      true,
  });
  DB.saveStudent(s);
  DB.removePromotionRequest(reqId);
  renderAll();
  notify(`🎉 ${s.name} Lv.${req.level} 승급! 직업: ${newJob}`);
}

function rejectPromotion(reqId) {
  const req = DB.getPromotionRequests().find(r => r.id === reqId);
  if (!req) return;
  const s = DB.getStudent(req.studentId);
  s.promotionPending = false;
  DB.saveStudent(s);
  DB.removePromotionRequest(reqId);
  renderAll();
  notify('승급 신청 반려됨', 'error');
}

