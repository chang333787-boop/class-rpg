// admin/quests.js — 비번 초기화 · 퀘스트(템플릿·능력치 퀘스트·자동 일일·게시판 퀘스트) · 가져오기(importData) · 개별 보상 지급
//  admin.js 에서 떼어 옮긴 클래식 스크립트 [ADMIN-SPLIT-1] — 글자 그대로 · 전역 그대로 · admin.html 에서 admin.js 바로 뒤에 부른다.
// ── [ADMIN-SPLIT-1] 'quests' — 원래 admin.js 3911~4838줄 ──
// ══════════════════════════════════════════════════
//  PW RESET (비밀번호 초기화)
// ══════════════════════════════════════════════════
function renderPwResetList() {
  const reqs = DB.getPwResetRequests();
  const el   = document.getElementById('pwreset-list');
  if (!el) return;
  if (reqs.length === 0) {
    el.innerHTML = '<div style="padding:1.5rem;text-align:center;font-size:.83rem;color:var(--txt3)">비밀번호 초기화 요청이 없어요 ✅</div>';
    return;
  }
  el.innerHTML = reqs.map(r => `
    <div style="display:flex;align-items:center;gap:.9rem;padding:.9rem 1rem;
      background:rgba(255,255,255,.03);border:1px solid rgba(255,215,0,.15);
      border-radius:12px;margin-bottom:.6rem">
      <div style="font-size:1.5rem">🔑</div>
      <div class="flex-1">
        <div style="font-weight:700;font-size:.9rem">${escHtml(r.name)}</div>
        <div class="text-muted-sm">${r.date} 요청</div>
      </div>
      <div style="display:flex;gap:.5rem;align-items:center">
        <input class="form-input" id="newpw-${r.id}" placeholder="새 비밀번호"
          style="width:100px;padding:.3rem .5rem;font-size:.78rem">
        <button class="btn-sm success fs-72"
          onclick="resetStudentPw('${r.id}','${r.studentId}')">초기화</button>
        <button class="btn-sm danger fs-72"
          onclick="dismissPwReset('${r.id}')">무시</button>
      </div>
    </div>`).join('');
}

function resetStudentPw(reqId, studentId) {
  const newPw = document.getElementById('newpw-' + reqId)?.value.trim();
  if (!newPw) { notify('새 비밀번호를 입력하세요', 'error'); return; }
  const s = DB.getStudent(studentId);
  if (!s) return;
  s.pw = newPw;
  DB.saveStudent(s);
  DB.removePwResetRequest(reqId);
  renderPwResetList();
  updatePwResetBadge();
  // [PW-NOTIFY-1] 교사 화면은 TV 로 미러링된다 — 알림에 새 비밀번호 값을 띄우지 않는다
  notify(`✅ ${s.name} 비밀번호 초기화 완료 · 학생 상세에서 확인`);
}

function dismissPwReset(reqId) {
  DB.removePwResetRequest(reqId);
  renderPwResetList();
  updatePwResetBadge();
  notify('요청을 무시했어요');
}

// ── 퀘스트 템플릿 시스템 ──
const QUEST_TEMPLATES = {
  daily: [
    {name:'독서록 작성하기', stat:'read'},
    {name:'오늘의 한 줄 일기', stat:'value'},
    {name:'줄넘기 50회', stat:'health'},
    {name:'받아쓰기 연습', stat:'study'},
    {name:'수학 문제 5개 풀기', stat:'study'},
    {name:'칭찬 한 마디 전하기', stat:'value'},
    {name:'오늘의 영단어 5개 외우기', stat:'study'},
    {name:'바른 자세로 수업 듣기', stat:'health'},
  ],
  weekly: [
    {name:'책 1권 읽기', stat:'read'},
    {name:'독서 감상문 쓰기', stat:'read'},
    {name:'익힘책 한 단원 완성', stat:'study'},
    {name:'수학 단원 평가 준비', stat:'study'},
    {name:'체육 기록 달성', stat:'health'},
    {name:'그림일기 쓰기', stat:'art'},
    {name:'발표 1번 하기', stat:'value'},
    {name:'친구 도움 주기', stat:'value'},
  ],
};

// Firebase에 커스텀 템플릿 저장
function getCustomTemplates(type) {
  const db = DB.load();
  return (db.customQuestTemplates || {})[type] || [];
}
function getHiddenTemplates(type) {
  const db = DB.load();
  return new Set((db.hiddenQuestTemplates || {})[type] || []);
}
function hideDefaultTemplate(type, name) {
  const db = DB.load();
  db.hiddenQuestTemplates = db.hiddenQuestTemplates || {};
  db.hiddenQuestTemplates[type] = db.hiddenQuestTemplates[type] || [];
  if (!db.hiddenQuestTemplates[type].includes(name))
    db.hiddenQuestTemplates[type].push(name);
  DB._cache = db; // 캐시 즉시 반영 (화면 바로 갱신)
  DB._fbRef.child('hiddenQuestTemplates').set(db.hiddenQuestTemplates);
  // 현재 탭에 맞게 렌더
  if (['read','study','art','value','health','life'].includes(type)) renderAbilityQuests();
  else renderQuestTemplates(type);
}
function saveCustomTemplate(type, name) {
  const db = DB.load();
  db.customQuestTemplates = db.customQuestTemplates || {};
  db.customQuestTemplates[type] = db.customQuestTemplates[type] || [];
  if (!db.customQuestTemplates[type].find(t=>t.name===name)) {
    db.customQuestTemplates[type].push({name, stat:''});
  }
  DB._fbRef.child('customQuestTemplates').set(db.customQuestTemplates);
  DB._cache = db;
}
function removeCustomTemplate(type, name) {
  const db = DB.load();
  if (!db.customQuestTemplates?.[type]) return;
  db.customQuestTemplates[type] = db.customQuestTemplates[type].filter(t=>t.name!==name);
  DB._cache = db;
  DB._fbRef.child('customQuestTemplates').set(db.customQuestTemplates);
}

let QUEST_TAB = 'daily';
let CUR_ABILITY_TAB = 'read';
let CUR_DIFF_FILTER = 'all';

// ── 능력치별 퀘스트 템플릿 ──
const ABILITY_QUESTS = {
  read: [
    {name:'오늘 책 10분 읽기',       diff:'easy', stat:'read'},
    {name:'책 제목 말하기',           diff:'easy', stat:'read'},
    {name:'독서 기록장 쓰기',         diff:'easy', stat:'read'},
    {name:'책 1권 읽고 줄거리 쓰기',  diff:'mid',  stat:'read'},
    {name:'독서 감상문 쓰기',         diff:'mid',  stat:'read'},
    {name:'도서관 책 빌리기',         diff:'mid',  stat:'read'},
    {name:'책 3권 읽기',              diff:'hard', stat:'read'},
    {name:'독서 발표하기',            diff:'hard', stat:'read'},
    {name:'친구에게 책 추천 글 쓰기', diff:'hard', stat:'read'},
  ],
  study: [
    {name:'받아쓰기 연습하기',        diff:'easy', stat:'study'},
    {name:'수학 문제 5개 풀기',       diff:'easy', stat:'study'},
    {name:'오늘 배운 내용 정리하기',  diff:'easy', stat:'study'},
    {name:'익힘책 한 단원 풀기',      diff:'mid',  stat:'study'},
    {name:'단원 평가 준비하기',       diff:'mid',  stat:'study'},
    {name:'발표 자료 만들기',         diff:'mid',  stat:'study'},
    {name:'단원 테스트 100점 맞기',   diff:'hard', stat:'study'},
    {name:'심화 문제 풀기',           diff:'hard', stat:'study'},
    {name:'선생님께 질문 3번 하기',   diff:'hard', stat:'study'},
  ],
  art: [
    {name:'그림 그리기',              diff:'easy', stat:'art'},
    {name:'색칠하기',                 diff:'easy', stat:'art'},
    {name:'만들기 완성하기',          diff:'easy', stat:'art'},
    {name:'작품 제출하기',            diff:'mid',  stat:'art'},
    {name:'미술 감상문 쓰기',         diff:'mid',  stat:'art'},
    {name:'노래 외워서 부르기',       diff:'mid',  stat:'art'},
    {name:'전시회 작품 완성하기',     diff:'hard', stat:'art'},
    {name:'악기 연주하기',            diff:'hard', stat:'art'},
    {name:'창작 글짓기',              diff:'hard', stat:'art'},
  ],
  value: [
    {name:'친구에게 칭찬하기',        diff:'easy', stat:'value'},
    {name:'인사 먼저 하기',           diff:'easy', stat:'value'},
    {name:'감사 일기 쓰기',           diff:'easy', stat:'value'},
    {name:'친구 도움 주기',           diff:'mid',  stat:'value'},
    {name:'청소 당번 열심히 하기',    diff:'mid',  stat:'value'},
    {name:'봉사 활동 참여하기',       diff:'mid',  stat:'value'},
    {name:'발표 용기 내기',           diff:'hard', stat:'value'},
    {name:'진심으로 사과하기',        diff:'hard', stat:'value'},
    {name:'학급 행사 기획 참여',      diff:'hard', stat:'value'},
  ],
  health: [
    {name:'줄넘기 30회',              diff:'easy', stat:'health'},
    {name:'바른 자세로 수업 듣기',    diff:'easy', stat:'health'},
    {name:'급식 잔반 없이 먹기',      diff:'easy', stat:'health'},
    {name:'줄넘기 100회',             diff:'mid',  stat:'health'},
    {name:'운동장 3바퀴 뛰기',        diff:'mid',  stat:'health'},
    {name:'체육 기록 달성하기',       diff:'mid',  stat:'health'},
    {name:'체력 테스트 목표 달성',    diff:'hard', stat:'health'},
    {name:'한 달 개근하기',           diff:'hard', stat:'health'},
    {name:'운동 일지 쓰기',           diff:'hard', stat:'health'},
  ],
  life: [
    {name:'사물함 정리하기',          diff:'easy', stat:'life'},
    {name:'교실 청소 열심히 하기',    diff:'easy', stat:'life'},
    {name:'준비물 빠짐없이 챙기기',   diff:'easy', stat:'life'},
    {name:'복도에서 조용히 걷기',     diff:'easy', stat:'life'},
    {name:'급식 배식 도우미',         diff:'mid',  stat:'life'},
    {name:'교실 환경 정리 일주일',    diff:'mid',  stat:'life'},
    {name:'쉬는시간 바르게 사용하기', diff:'mid',  stat:'life'},
    {name:'한 달 생활 규칙 지키기',   diff:'hard', stat:'life'},
    {name:'친구 돕기 3회',            diff:'hard', stat:'life'},
  ],
};

const DIFF_INFO = {
  easy: { label:'🟢 쉬움', exp:35,  gold:25,  icon:'📋', color:'rgba(46,204,113,.15)',  border:'rgba(46,204,113,.3)' },
  mid:  { label:'🟡 중간', exp:55,  gold:40,  icon:'📋', color:'rgba(255,193,7,.1)',    border:'rgba(255,193,7,.35)' },
  hard: { label:'🔴 어려움',exp:80, gold:60,  icon:'⭐', color:'rgba(231,76,60,.1)',    border:'rgba(231,76,60,.3)' },
};

const ABILITY_ICONS = { read:'📚', study:'📖', art:'🎨', value:'💛', health:'💪', life:'🏠' };

function switchQuestTab(tab) {
  QUEST_TAB = tab;
  const allTabs = ['daily','weekly','custom','ability'];
  const abilityTypes = ['read','study','art','value','health','life'];

  // 탭 패널 표시
  allTabs.forEach(t => {
    const el = document.getElementById('qt-'+t);
    if (el) el.style.display = 'none';
  });
  // 버튼 active
  ['daily','weekly','read','study','art','value','health','life','custom'].forEach(t => {
    const btn = document.getElementById('qt-'+t+'-btn');
    if (btn) btn.classList.remove('on');
  });

  if (abilityTypes.includes(tab)) {
    CUR_ABILITY_TAB = tab;
    document.getElementById('qt-ability').style.display = '';
    document.getElementById('qt-'+tab+'-btn').classList.add('on');
    renderAbilityQuests();
  } else {
    const el = document.getElementById('qt-'+tab);
    if (el) el.style.display = '';
    const btn = document.getElementById('qt-'+tab+'-btn');
    if (btn) btn.classList.add('on');
    if (tab !== 'custom') renderQuestTemplates(tab);
  }
}

function setDiffFilter(diff, btn) {
  CUR_DIFF_FILTER = diff;
  document.querySelectorAll('[id^="diff-"]').forEach(b => b.classList.remove('success'));
  btn.classList.add('success');
  renderAbilityQuests();
}

function renderAbilityQuests() {
  const type = CUR_ABILITY_TAB;
  const el = document.getElementById('qt-ability-list');
  if (!el) return;
  const db = DB.load();
  const customs = ((db.customQuestTemplates||{})[type]||[]);
  const hiddenSet = getHiddenTemplates(type);
  let items = [
    ...ABILITY_QUESTS[type].filter(t => !hiddenSet.has(t.name)),
    ...customs.map(t => ({...t, custom:true})),
  ];
  if (CUR_DIFF_FILTER !== 'all') items = items.filter(t => t.diff === CUR_DIFF_FILTER);

  el.innerHTML = items.map((t,i) => {
    const d = DIFF_INFO[t.diff] || DIFF_INFO.easy;
    return `<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem .7rem;
      background:${d.color};border-radius:8px;border:0.5px solid ${d.border}">
      <input type="checkbox" id="aq-chk-${i}" data-name="${escHtml(t.name)}" data-diff="${t.diff}" data-stat="${t.stat||type}"
        style="width:16px;height:16px;cursor:pointer;accent-color:var(--emerald)">
      <label for="aq-chk-${i}" style="flex:1;cursor:pointer;font-size:.86rem">${escHtml(t.name)}</label>
      <span class="text-muted-xs">${d.label}</span>
      <span style="font-size:.68rem;color:var(--gold)">+${d.exp}EXP</span>
      <button onclick="${t.custom ? `removeCustomTemplate('${type}','${escJsAttr(t.name)}');renderAbilityQuests()` : `hideDefaultTemplate('${type}','${escJsAttr(t.name)}')`}"
        style="background:none;border:none;color:var(--txt3);cursor:pointer;font-size:.8rem;padding:.1rem .3rem"
        title="${t.custom ? '삭제' : '숨기기'}">✕</button>
    </div>`;
  }).join('') || '<div style="padding:1rem;color:var(--txt3);font-size:.82rem;text-align:center">해당 난이도 퀘스트가 없어요</div>';
}

function addAbilityTemplate() {
  const name = document.getElementById('qt-ability-custom').value.trim();
  const diff = document.getElementById('qt-ability-custom-diff').value;
  if (!name) return;
  const db = DB.load();
  db.customQuestTemplates = db.customQuestTemplates || {};
  db.customQuestTemplates[CUR_ABILITY_TAB] = db.customQuestTemplates[CUR_ABILITY_TAB] || [];
  db.customQuestTemplates[CUR_ABILITY_TAB].push({name, diff, stat:CUR_ABILITY_TAB, custom:true});
  DB._cache = db;
  DB._fbRef.child('customQuestTemplates').set(db.customQuestTemplates);
  document.getElementById('qt-ability-custom').value = '';
  renderAbilityQuests();
}

function postCheckedAbilityQuests() {
  const checked = [...document.querySelectorAll('[id^="aq-chk-"]:checked')];
  if (checked.length === 0) { notify('항목을 선택하세요', 'error'); return; }
  const db = DB.load();
  db.boardQuests = db.boardQuests || [];
  let count = 0;
  const skipped = []; // [B12] 이름이 겹쳐 건너뛴 항목 — 기존엔 아무 말 없이 빠져서 교사가 몰랐다
  checked.forEach(chk => {
    const name = chk.dataset.name;
    const diff = chk.dataset.diff;
    const stat = chk.dataset.stat;
    const d = DIFF_INFO[diff] || DIFF_INFO.easy;
    // 이미 게시된 동일 퀘스트 스킵
    if (db.boardQuests.find(q => q.name===name && q.active!==false)) { skipped.push(name); return; }
    db.boardQuests.push({
      id: 'bq_'+Date.now()+'_'+count,
      name, type:'special', diff,
      exp: d.exp, gold: d.gold,
      stat, statVal: 1,
      icon: ABILITY_ICONS[stat]||d.icon,
      active: true, date: Utils.todayStr(),
    });
    count++;
  });
  if (count === 0) { notify('이미 게시된 퀘스트예요', 'error'); return; }
  DB._cache = db;
  DB._fbRef.child('boardQuests').set(db.boardQuests);
  renderBoardQuestList();
  notify(`📌 ${count}개 능력치 퀘스트 게시 완료!`);
  // [B12] 건너뛴 항목이 있으면 별도 안내
  if (skipped.length > 0) {
    notify(`⚠️ 이미 게시 중이라 ${skipped.length}개는 건너뛰었어요: ${skipped.join(', ')}`, 'error');
  }
}

function renderQuestTemplates(type) {
  const el = document.getElementById('qt-'+type+'-list');
  if (!el) return;
  const hidden   = getHiddenTemplates(type);
  const defaults = (QUEST_TEMPLATES[type] || []).filter(t => !hidden.has(t.name));
  const customs  = getCustomTemplates(type);
  const all = [
    ...defaults.map(t => ({...t, custom:false})),
    ...customs.map(t => ({...t, custom:true})),
  ];
  const statOpts = `<option value="">없음</option>
    <option value="read">📚 독서</option>
    <option value="study">✏️ 학습</option>
    <option value="art">🎨 예술</option>
    <option value="value">💎 가치</option>
    <option value="health">💪 건강</option>
    <option value="life">🏠 생활</option>`;
  el.innerHTML = all.map((t,i) => `
    <div style="display:flex;align-items:center;gap:.5rem;padding:.4rem .6rem;
      background:rgba(255,255,255,.03);border-radius:8px;border:0.5px solid rgba(255,255,255,.07)">
      <input type="checkbox" id="qt-chk-${type}-${i}" style="width:16px;height:16px;cursor:pointer;accent-color:var(--emerald)">
      <label for="qt-chk-${type}-${i}" style="flex:1;cursor:pointer;font-size:.84rem">${escHtml(t.name)}</label>
      <select id="qt-stat-${type}-${i}" style="font-size:.7rem;padding:.15rem .25rem;border-radius:6px;
        background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:var(--txt);width:72px">
        ${statOpts}
      </select>
      <input type="number" id="qt-statval-${type}-${i}" value="1" min="0.1" max="10" step="0.1"
        style="width:44px;font-size:.7rem;padding:.15rem .25rem;border-radius:6px;text-align:center;
          background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:var(--txt)">
      <button onclick="${t.custom ? `removeCustomTemplate('${type}','${escJsAttr(t.name)}');renderQuestTemplates('${type}')` : `hideDefaultTemplate('${type}','${escJsAttr(t.name)}')`}"
        style="background:none;border:none;color:var(--txt3);cursor:pointer;font-size:.8rem;padding:.1rem .3rem"
        title="${t.custom ? '삭제' : '목록에서 숨기기'}">✕</button>
    </div>`).join('');
  // 기존 stat 값 복원
  all.forEach((t,i) => {
    const sel = document.getElementById(`qt-stat-${type}-${i}`);
    if (sel && t.stat) sel.value = t.stat;
    const valEl = document.getElementById(`qt-statval-${type}-${i}`);
    if (valEl && t.statVal) valEl.value = t.statVal;
  });
}

function addQuestTemplate(type) {
  const inp = document.getElementById('qt-'+type+'-custom');
  const name = inp.value.trim();
  if (!name) return;
  saveCustomTemplate(type, name);
  inp.value = '';
  renderQuestTemplates(type);
}

function postCheckedQuests(type) {
  // ★ renderQuestTemplates와 동일하게 hidden 필터 적용 (인덱스 일치)
  const hidden   = getHiddenTemplates(type);
  const defaults = (QUEST_TEMPLATES[type] || []).filter(t => !hidden.has(t.name));
  const customs  = getCustomTemplates(type);
  const all = [...defaults, ...customs];
  const expMap  = {daily:35, weekly:80};
  const goldMap = {daily:25, weekly:70};
  const iconMap = {daily:'📋', weekly:'📅'};

  // 일일/주간 탭 스탯 설정값 읽기
  const tabStat    = document.getElementById(`qt-${type}-stat`)?.value || '';
  const tabStatVal = tabStat ? Math.round((parseFloat(document.getElementById(`qt-${type}-statval`)?.value)||1)*10)/10 : 0;

  let count = 0;
  const db = DB.load();
  db.boardQuests = db.boardQuests || [];

  all.forEach((t, i) => {
    const chk = document.getElementById(`qt-chk-${type}-${i}`);
    if (!chk || !chk.checked) return;

    // 항목별 스탯 선택 (모든 타입)
    // [B1] 행 select가 비어 있으면 탭 하단의 공통 능력치 설정을 쓴다.
    //      기존엔 tabStat/tabStatVal을 읽어만 두고 쓰지 않아, 커스텀 항목처럼 행 값이 빈 경우
    //      교사가 하단에서 능력치를 골라도 stat:''로 게시되어 능력치가 0 지급됐다.
    const statEl    = document.getElementById(`qt-stat-${type}-${i}`);
    const statValEl = document.getElementById(`qt-statval-${type}-${i}`);
    const rowStat = statEl ? statEl.value : (t.stat || '');
    const stat    = rowStat || tabStat;
    const statVal = stat
      ? (rowStat ? (parseFloat(statValEl?.value)||1) : (tabStatVal || 1))
      : 0;
    // 이미 같은 이름의 활성 퀘스트가 있으면 중복 방지
    if (db.boardQuests.find(q => q.name===t.name && q.active!==false)) {
      notify(`"${t.name}"은 이미 게시 중이에요`, 'error');
      return;
    }
    db.boardQuests.push({
      id: 'bq_' + Date.now() + '_' + i,
      name: t.name,
      type,
      exp:  expMap[type]  || 80,
      gold: goldMap[type] || 50,
      icon: iconMap[type] || '📋',
      stat, statVal,
      dueDate: '', date: Utils.todayStr(),
      active: true,
    });
    count++;
  });

  if (count === 0) { notify('체크한 항목이 없어요!', 'error'); return; }
  DB._cache = db;
  DB._fbRef.child('boardQuests').set(db.boardQuests);
  renderBoardQuestList();
  renderQuestTemplates(type);
  notify(`📌 ${count}개 퀘스트 게시판에 등록!`);
}

function saveAutoDaily() {
  const hidden   = getHiddenTemplates('daily');
  const defaults = (QUEST_TEMPLATES['daily'] || []).filter(t => !hidden.has(t.name));
  const customs  = getCustomTemplates('daily');
  const all = [...defaults, ...customs];
  const items = [];
  all.forEach((t, i) => {
    const chk = document.getElementById(`qt-chk-daily-${i}`);
    if (!chk || !chk.checked) return;
    const stat    = document.getElementById(`qt-stat-daily-${i}`)?.value || '';
    const statVal = stat ? (parseFloat(document.getElementById(`qt-statval-daily-${i}`)?.value)||1) : 0;
    items.push({ name: t.name, stat, statVal });
  });
  // [B7] 0개 체크 = 자동 등록 끄기. 기존엔 에러만 내고 저장을 거부해서 한번 켜면 끄는 수단이 없었다.
  if (items.length === 0 &&
      !confirm('체크한 항목이 없습니다.\n\n자동 등록을 끌까요?\n(이미 오늘 올라간 퀘스트는 그대로 남습니다)')) return;

  const prev = DB.getSettings();
  // [B7] autoDailyLastDate를 비워 오늘 안에 변경분이 반영되게 한다.
  //   기존엔 '오늘 이미 처리됨'으로 막혀 교사가 저장해도 종일 반영되지 않았다.
  DB.saveSettings({ ...prev, autoDailyQuests: items, autoDailyLastDate: '' });
  if (items.length === 0) {
    notify('⏹️ 자동 등록을 껐어요. 이제 매일 아침 자동 게시되지 않아요.');
    renderAutoDailyStatus();
    return;
  }
  // 저장 직후 오늘치 반영 (다음 학생 로그인까지 기다리지 않도록)
  if (DB.ensureDailyQuests) DB.ensureDailyQuests();
  renderBoardQuestList();
  notify(`🔁 ${items.length}개 항목 매일 자동 등록으로 저장! 오늘 것부터 바로 게시판에 올라갔어요.`);
  renderAutoDailyStatus(); // [Q-3A-1] 저장 후 현황 카드 갱신(저장 로직은 위에서 끝, 여기선 표시만)
}

// 매일 일일퀘스트 자동 등록 체크 (앱 로드 시 실행)
// [Q-2A] 핵심 로직은 DB.ensureDailyQuests()(gamedata.js)로 이전됨.
//        window.onload 호출부 유지를 위한 얇은 wrapper. 동작은 기존과 동일.
function checkAutoDailyQuests() {
  return DB.ensureDailyQuests();
}

// [Q-3A-1] 자동 일일퀘스트 현황 카드 (표시 전용·read-only)
//   settings.autoDailyQuests / autoDailyLastDate / boardQuests를 읽기만 해서 상태를 보여준다.
//   저장/삭제/DB.save·set 호출 없음. ON/OFF 토글·개별 편집 없음(Q-3F 범위).
function renderAutoDailyStatus() {
  const el = document.getElementById('auto-daily-status');
  if (!el) return; // mount 없으면 조용히 종료

  const db        = DB.load();
  const settings  = db.settings || {};
  const autoItems = settings.autoDailyQuests || [];
  const isOn      = autoItems.length > 0;
  const today     = Utils.todayStr();
  const lastDate  = settings.autoDailyLastDate || '';
  const ranToday  = lastDate === today;
  const boardQuests = db.boardQuests || [];

  const todayAutoDaily = boardQuests.filter(q =>
    q && q.type === 'daily' && q.date === today &&
    String(q.id || '').startsWith(`bq_auto_${today}_`));
  const activeDaily = boardQuests.filter(q => q && q.type === 'daily' && q.active !== false);
  const closedDaily = boardQuests.filter(q => q && q.type === 'daily' && q.active === false);

  const onBadge = isOn
    ? `<span style="font-size:.72rem;font-weight:700;color:var(--emerald);background:rgba(46,204,113,.12);border-radius:8px;padding:.1rem .5rem">ON</span>`
    : `<span style="font-size:.72rem;font-weight:700;color:var(--txt3);background:rgba(255,255,255,.06);border-radius:8px;padding:.1rem .5rem">OFF</span>`;

  const itemNames = isOn
    ? autoItems.map(it => (it && it.name) ? it.name : '').filter(Boolean).join(', ')
    : '';

  const row = (label, value) => `
    <div style="display:flex;justify-content:space-between;gap:.6rem;padding:.18rem 0;font-size:.78rem">
      <span style="color:var(--txt3)">${label}</span>
      <span style="color:var(--txt2);font-weight:600;text-align:right">${value}</span>
    </div>`;

  el.innerHTML = `
    <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:1rem 1.2rem;margin-bottom:.9rem">
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.6rem">
        <span style="font-size:1.2rem">🔁</span>
        <span style="font-weight:700;font-size:.92rem;flex:1">자동 일일퀘스트 현황</span>
        ${onBadge}
      </div>
      ${isOn ? `
        ${row('등록 항목', `${autoItems.length}개`)}
        ${itemNames ? `<div style="font-size:.74rem;color:var(--txt3);padding:.1rem 0 .35rem;line-height:1.5">${itemNames}</div>` : ''}
        ${row('마지막 실행', lastDate || '아직 없음')}
        ${row('오늘 실행', ranToday ? '✅ 완료' : '아직 아님')}
        ${row('오늘 자동 생성', `${todayAutoDaily.length}개`)}
        ${row('현재 활성 daily', `${activeDaily.length}개`)}
        ${row('닫힌 daily', `${closedDaily.length}개`)}
      ` : `
        <div style="font-size:.78rem;color:var(--txt3);padding:.2rem 0 .5rem">등록된 자동 일일퀘스트가 없어요. 아래 일일 템플릿에서 항목을 체크해 "매일 자동 등록으로 저장"하면 켜집니다.</div>
        ${row('현재 활성 daily', `${activeDaily.length}개`)}
        ${row('닫힌 daily', `${closedDaily.length}개`)}
      `}
      <div style="font-size:.7rem;color:var(--txt3);margin-top:.6rem;padding-top:.5rem;border-top:1px solid rgba(255,255,255,.06);line-height:1.55">
        ℹ️ 자동 일일퀘스트는 교사 또는 학생이 접속할 때 확인·생성됩니다. 키오스크 단독 접속은 아직 자동 생성과 연결되어 있지 않습니다.
      </div>
    </div>`;
}

function restoreHiddenTemplates(type) {
  const db = DB.load();
  db.hiddenQuestTemplates = db.hiddenQuestTemplates || {};
  db.hiddenQuestTemplates[type] = [];
  DB._cache = db;
  DB._fbRef.child('hiddenQuestTemplates').set(db.hiddenQuestTemplates);
  if (['read','study','art','value','health','life'].includes(type)) renderAbilityQuests();
  else renderQuestTemplates(type);
  notify('🔄 숨긴 항목을 복원했습니다');
}

// 퀘스트 페이지 진입 시 초기화
function initQuestPage() {
  renderQuestTemplates('daily');
  renderAutoDailyStatus(); // [Q-3A-1] 퀘스트 탭 열 때 현황 카드 갱신(read-only)
}

// 퀘스트 유형 변경 시 아이콘·EXP·골드 자동 설정
function onQuestTypeChange(type) {
  const iconMap  = { daily:'📋', weekly:'📅', special:'✏️', event:'⭐' };
  const expMap   = { daily:80, weekly:150, special:120, event:200 };
  const goldMap  = { daily:50, weekly:100, special:80,  event:150 };
  document.getElementById('nq-icon').value  = iconMap[type]  || '📋';
  document.getElementById('nq-exp').value   = expMap[type]   || 80;
  document.getElementById('nq-gold').value  = goldMap[type]  || 50;
}

function addBoardQuest() {
  const name = document.getElementById('nq-name').value.trim();
  if (!name) { notify('퀘스트 이름을 입력하세요', 'error'); return; }
  // [B9] 기존엔 `parseInt(v)||기본값`이라 음수(-50)는 그대로 저장되고(승인 시 보상을 깎아 레벨 하락),
  //      0은 falsy라 조용히 기본값으로 바뀌었다. 빈칸만 기본값으로 처리한다.
  const readNum = (elId, dflt) => {
    const raw = (document.getElementById(elId)?.value ?? '').trim();
    if (raw === '') return dflt;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : dflt;
  };
  const exp     = readNum('nq-exp', 80);
  const gold    = readNum('nq-gold', 50);
  if (exp < 0 || gold < 0) { notify('보상은 0 이상으로 입력해주세요', 'error'); return; }
  const icon    = document.getElementById('nq-icon').value || '📋';
  const stat    = document.getElementById('nq-stat').value;
  const statVal = stat ? Math.max(0, Math.round((parseFloat(document.getElementById('nq-statval')?.value)||1) * 10) / 10) : 0;
  const type    = document.getElementById('nq-type').value;
  const dueDate = document.getElementById('nq-due').value || '';

  // [B9] 같은 이름이 이미 게시 중이면 확인 — 그대로 두면 학생이 같은 활동으로 보상을 두 번 받는다
  const dupName = (DB.load().boardQuests || []).some(q => q.active !== false && q.name === name);
  if (dupName && !confirm(`"${name}" 퀘스트가 이미 게시 중입니다.\n\n그래도 하나 더 등록할까요?\n(학생이 같은 활동으로 보상을 두 번 받을 수 있어요)`)) return;

  const quest = {
    id: 'bq_' + Date.now(),
    name, type, exp, gold, icon, stat, statVal,
    dueDate, date: Utils.todayStr(),
    active: true,
  };

  const db = DB.load();
  db.boardQuests = db.boardQuests || [];
  db.boardQuests.push(quest);
  DB._cache = db;
  DB._fbRef.child('boardQuests').set(db.boardQuests);

  document.getElementById('nq-name').value = '';
  document.getElementById('nq-due').value  = '';
  renderBoardQuestList();
  notify(`📌 "${name}" 게시판에 등록!`);
}

function renderBoardQuestList() {
  const db = DB.load();
  const boardQuests = (db.boardQuests || []).filter(q => q.active !== false);
  const students    = DB.getStudents();
  const typeNames   = { daily:'일일', weekly:'주간', special:'과제', event:'특별' };
  const container   = document.getElementById('board-quest-list');
  if (!container) return;

  if (boardQuests.length === 0) {
    container.innerHTML = '<div style="padding:1.5rem;text-align:center;font-size:.83rem;color:var(--txt3)">게시 중인 퀘스트가 없어요</div>';
    return;
  }

  container.innerHTML = boardQuests.map(q => {
    // 학생별 완료 여부 — 날짜/타입 기반 (학생·키오스크와 동일 로직)
    const allQuestLogs = db.quests||[];
    const doneSids = new Set(
      students.filter(s => Utils.isQuestDoneToday(allQuestLogs, s.id, q.id, q.type)).map(s => s.id)
    );
    // [A1] 신청중(대기)인 학생 표시 — 교사가 모르고 ✔완료를 눌러 중복 지급되던 것을 눈에 보이게
    const pendingSids = new Set(
      students.filter(s =>
        Utils.questStatus(s.id, q.id, q.type, allQuestLogs, s.pendingRewards, null) === 'pending'
      ).map(s => s.id)
    );

    const studentRows = students.map(s => {
      const done = doneSids.has(s.id);
      const pending = pendingSids.has(s.id);
      return `<div style="display:flex;align-items:center;gap:.6rem;padding:.35rem .5rem;
        border-radius:8px;background:${done?'rgba(46,204,113,.08)':'rgba(255,255,255,.03)'};
        border:1px solid ${done?'rgba(46,204,113,.2)':'rgba(255,255,255,.06)'};margin-bottom:.3rem">
        <span style="font-size:1rem">${s.avatar}</span>
        <span style="font-size:.83rem;font-weight:600;flex:1">${escHtml(s.name)}</span>
        ${done
          ? `<span style="font-size:.72rem;color:var(--emerald);font-weight:700">✅ 완료</span>`
          : `${pending?`<span style="font-size:.68rem;color:var(--gold);font-weight:700;margin-right:.35rem">⏳ 신청 중</span>`:''}
             <button class="btn-sm success" style="font-size:.7rem;padding:.25rem .6rem"
              onclick="completeQuestForStudent('${q.id}','${s.id}')">✔ 완료</button>`
        }
      </div>`;
    }).join('');

    return `<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);
      border-radius:14px;padding:1rem 1.2rem;margin-bottom:.8rem">
      <div style="display:flex;align-items:center;gap:.7rem;margin-bottom:.8rem">
        <span style="font-size:1.8rem">${escHtml(q.icon||'📋')}</span>
        <div class="flex-1">
          <div style="font-weight:700;font-size:.95rem">${escHtml(q.name)}</div>
          <div style="font-size:.72rem;color:var(--txt3);margin-top:.15rem">
            <span class="tag active">${typeNames[q.type]||q.type}</span>
            &nbsp;+${q.exp}EXP · +${q.gold}G
            ${q.stat?` · ${GAME_DATA.statNames[q.stat]||q.stat} +${Math.round((parseFloat(q.statVal)||1)*10)/10}`:''}
            ${q.dueDate?` · 마감 ${q.dueDate}`:''}
          </div>
        </div>
        <div style="display:flex;gap:.4rem">
          <span class="text-muted-base">${doneSids.size}/${students.length}명</span>
          <button class="btn-sm danger" style="font-size:.68rem;padding:.2rem .5rem"
            onclick="closeBoardQuest('${q.id}')">🗑️ 닫기</button>
        </div>
      </div>
      <div style="font-size:.72rem;color:var(--txt3);margin-bottom:.5rem">학생별 완료 처리</div>
      ${studentRows}
    </div>`;
  }).join('');
}

function completeQuestForStudent(questId, studentId) {
  const db = DB.load();
  const bq = (db.boardQuests||[]).find(q => q.id === questId);
  if (!bq) return;
  const s = DB.getStudent(studentId);
  if (!s) return;

  // 이미 완료 처리됐으면 스킵
  const alreadyDone = Utils.isQuestDoneToday(db.quests||[], studentId, questId, bq.type);
  if (alreadyDone) { notify('이미 완료 처리된 학생입니다', 'error'); return; }

  // 보상 지급
  s.exp   = (s.exp||0)  + bq.exp;
  s.gold  = (s.gold||0) + bq.gold;
  if ((bq.gold||0) > 0) {
    s.totalGold = (s.totalGold||0) + bq.gold; // [R7] 누적 골드
    DB.logGold(s.id, DB.goldSourceOf(bq.type), bq.gold);   // [GOLD-LOG-1]
  }
  s.level = Utils.levelFromExp(s.exp);
  // [A3] 교사가 설정한 능력치 수치(statVal)를 반영 — 기존엔 항상 +1이라 학생 신청 경로와 달랐다
  const statGain = Math.round((parseFloat(bq.statVal) || 1) * 10) / 10;
  if (bq.stat) {
    s.stats = s.stats || {};
    s.stats[bq.stat] = Math.round(((s.stats[bq.stat]||0) + statGain) * 10) / 10;
  }
  s.totalQuests = (s.totalQuests||0) + 1;

  // [A1] 같은 퀘스트로 남아있는 신청 제거 — 안 지우면 활동 승인 탭에서 한 번 더 승인돼 보상이 2배가 된다
  s.pendingRewards = (s.pendingRewards||[]).filter(r => r.boardQuestId !== questId);

  DB.saveStudent(s);

  // 퀘스트 로그 기록 (saveQuestLog 통일 구조 — approveReward와 필드 동일하게)
  DB.saveQuestLog({
    studentId,
    boardQuestId: questId,
    boardQuestType: bq.type || 'special',
    type:         bq.type || 'special',
    name:         bq.name,
    exp:          bq.exp,
    gold:         bq.gold,
    stat:         bq.stat || '',
    statVal:      bq.stat ? statGain : 0,
    icon:         bq.icon||'📋',
    date:         Utils.todayStr(),
    approved:     true,
  });

  renderBoardQuestList();
  renderDashboard();
  notify(`✅ ${s.name} · "${bq.name}" 완료 처리!`);
}

// [Q-3B] 닫기/삭제 시 남게 될 미승인 보상 건수 (읽기 전용 계산)
// [C12] 현재 정책은 '보존' — 닫거나 삭제해도 미승인 보상은 지우지 않고
//       활동 승인 탭의 '⚠️ 확인 필요 보상'에서 교사가 사후 처리한다(Q-3F-1).
function countPendingRewardsForQuest(questId) {
  return DB.getStudents().reduce((a, s) =>
    a + (s.pendingRewards||[]).filter(r => r.boardQuestId === questId && !r.approved).length, 0);
}

function closeBoardQuest(questId) {
  const pendingCnt = countPendingRewardsForQuest(questId);
  // [Q-3F-1] 닫을 때 미승인 보상은 삭제하지 않고 보존 → 활동 승인 탭 ⚠️ 확인 필요 보상에 남음
  const msg = pendingCnt > 0
    ? `이 퀘스트를 게시판에서 내릴까요?\n\n미승인 보상 ${pendingCnt}건은 삭제되지 않고 활동 승인 탭의 ⚠️ 확인 필요 보상에 남습니다.\n내린 뒤에도 교사가 승인 또는 반려로 처리할 수 있습니다.`
    : '이 퀘스트를 게시판에서 내릴까요?';
  if (!confirm(msg)) return;
  const db = DB.load();
  db.boardQuests = (db.boardQuests||[]).map(q => q.id === questId ? {...q, active:false} : q);
  // [Q-3F-1] cleanQuestPending 호출 제거 — 미승인 보상 보존 (승인 탭에서 사후 처리)
  DB._cache = db;
  DB._fbRef.child('boardQuests').set(db.boardQuests);
  renderAll();
  notify('퀘스트를 내렸어요');
}

// 퀘스트 삭제/닫기 시 학생 pendingRewards 정리
function reactivateBoardQuest(questId) {
  const db = DB.load();
  const target = (db.boardQuests||[]).find(q => q.id === questId);
  if (!target) return;

  // [B6] 지난 날짜의 daily를 그대로 다시 켜면, 다음 학생 접속 때 자동 마감 로직이
  //      (date !== today) 조건으로 즉시 다시 내려버린다 → "다시 올렸는데 아이들 화면에 없다".
  const isDaily = target.type === 'daily';
  const today   = Utils.todayStr();
  if (!isDaily && target.type !== 'weekly') {
    // special/event는 완료 로그가 날짜와 무관하게 영구 완료로 판정되므로,
    // 이전에 완료한 학생은 다시 못 한다는 점을 교사에게 알린다.
    const doneCnt = (db.students||[]).filter(s =>
      Utils.isQuestDoneToday(db.quests||[], s.id, questId, target.type)).length;
    if (doneCnt > 0 && !confirm(
      `이 퀘스트를 이미 완료한 학생이 ${doneCnt}명 있습니다.\n\n` +
      `다시 게시해도 그 학생들은 '✅ 완료' 상태로 남아 다시 신청할 수 없어요.\n` +
      `모두가 새로 하게 하려면 같은 이름으로 새 퀘스트를 만드는 편이 좋습니다.\n\n그래도 다시 게시할까요?`)) return;
  }

  db.boardQuests = (db.boardQuests||[]).map(q =>
    q.id === questId ? { ...q, active:true, ...(isDaily ? { date: today } : {}) } : q
  );
  DB._cache = db;
  DB._fbRef.child('boardQuests').set(db.boardQuests);
  renderBoardQuestList();
  notify(isDaily ? '✅ 오늘 날짜로 다시 게시했습니다' : '✅ 퀘스트를 다시 게시했습니다');
}

function deleteBoardQuest(questId) {
  const pendingCnt = countPendingRewardsForQuest(questId);
  // [Q-3F-1] 삭제할 때 미승인 보상은 삭제하지 않고 보존 → 활동 승인 탭 ⚠️ 확인 필요 보상에 남음
  const msg = pendingCnt > 0
    ? `이 퀘스트를 완전히 삭제할까요?\n\n미승인 보상 ${pendingCnt}건은 삭제되지 않고 활동 승인 탭의 ⚠️ 확인 필요 보상에 남습니다.\n삭제된 퀘스트 보상으로 표시되며, 교사가 승인 또는 반려로 처리할 수 있습니다.`
    : '이 퀘스트를 완전히 삭제할까요?';
  if (!confirm(msg)) return;
  const db = DB.load();
  db.boardQuests = (db.boardQuests||[]).filter(q => q.id !== questId);
  // [Q-3F-1] cleanQuestPending 호출 제거 — 미승인 보상 보존 (승인 탭에서 사후 처리)
  DB._cache = db;
  DB._fbRef.child('boardQuests').set(db.boardQuests);
  renderAll();
  notify('🗑️ 퀘스트를 삭제했어요', 'error');
}

function toggleInactiveQuests() {
  const el = document.getElementById('inactive-quest-list');
  const btn = event.target;
  if (el.style.display === 'none') {
    el.style.display = '';
    btn.textContent = '접기';
    renderInactiveQuests();
  } else {
    el.style.display = 'none';
    btn.textContent = '펼치기';
  }
}

function renderInactiveQuests() {
  const db = DB.load();
  const inactive = (db.boardQuests||[]).filter(q => q.active === false);
  const el = document.getElementById('inactive-quest-list');
  if (!el) return;
  if (inactive.length === 0) {
    el.innerHTML = '<div style="padding:.8rem 1.2rem;font-size:.82rem;color:var(--txt3)">비활성 퀘스트가 없어요</div>';
    return;
  }
  const typeNames = { daily:'일일', weekly:'주간', special:'과제', event:'특별' };
  el.innerHTML = inactive.map(q => `
    <div style="display:flex;align-items:center;gap:.7rem;padding:.6rem 1.2rem;
      border-bottom:1px solid rgba(255,255,255,.04);opacity:.6">
      <span style="font-size:1.2rem">${escHtml(q.icon||'📋')}</span>
      <div class="flex-1">
        <div style="font-size:.85rem;font-weight:600">${escHtml(q.name)}</div>
        <div class="text-muted-tiny">${typeNames[q.type]||q.type} · +${q.exp}EXP · +${q.gold}G</div>
      </div>
      <button class="btn-sm success" style="font-size:.7rem;padding:.25rem .6rem"
        onclick="reactivateBoardQuest('${q.id}')">↑ 재게시</button>
      <button class="btn-sm danger" style="font-size:.7rem;padding:.25rem .5rem"
        onclick="deleteBoardQuest('${q.id}')">🗑️</button>
    </div>`).join('');
}

// renderQuestTable은 renderBoardQuestList 로 대체
function renderQuestTable() { renderBoardQuestList(); }

// [IMPORT-SAFE-1] 가져오기는 RPG 데이터 전체를 덮어쓴다 — 확인 한 번(확인창)으로는 너무 쉬웠다.
//   ① '가져오기' 글자를 적어야 진행 ② 덮기 전에 지금 상태를 백업(실패하면 멈춤) ③ 그다음 덮어쓰기.
//   새 형식(classRPG-export-2)이면 rpg 칸만 되돌린다 — 학습 앱·마을(roots)은 수업 중인 판을 되감지 않게 자동으로 되돌리지 않고 안내만.
//   쓸 때 학생은 id 키로, 승급 신청은 id 키로(_promoObj), 파생 배열 quests 는 빼고 쓴다 — 지금 저장 모양과 같게
//   (예전엔 캐시 배열 그대로 써서 students/0·1… 숫자 키가 생겼고, 저장할 때 students/<id> 가 따로 생겨 두 벌이 됐다).
function importPayload(rpg) {
  const out = { ...rpg };
  delete out.quests;   // questLogs 에서 매번 다시 만드는 파생 배열(cleanupDerivedNodes 참고)
  if (Array.isArray(out.students) && out.students.every(st => st && st.id)) {
    const o = {}; out.students.forEach(st => { o[st.id] = st; }); out.students = o;
  }
  if (out.promotionRequests != null) {
    out.promotionRequests = DB._promoObj(Array.isArray(out.promotionRequests) ? out.promotionRequests : Object.values(out.promotionRequests));
  }
  return out;
}
function importData(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    let data;
    try { data = JSON.parse(e.target.result); }
    catch (err) { notify('파일 파싱 오류: ' + err.message, 'error'); return; }
    const isNew = !!(data && data.format === EXPORT_FORMAT && data.rpg);
    const rpg = isNew ? data.rpg : data;
    if (!rpg || !rpg.students || !Array.isArray(rpg.students)) {
      notify('올바른 데이터 파일이 아닙니다', 'error'); return;
    }
    const typed = prompt(`⚠️ 지금 RPG 데이터를 이 파일로 덮어써요 (학생 ${rpg.students.length}명).\n되돌리기 전에 지금 상태를 먼저 백업해요.\n\n계속하려면 '가져오기' 라고 적어 주세요.`);
    if (typed === null) return;
    if (String(typed).trim() !== '가져오기') { notify('글자가 달라 가져오기를 멈췄어요', 'error'); return; }
    notify('💾 가져오기 전 백업 중…');
    try { await saveBackup(true, '가져오기 전'); }
    catch (err) { notify('⚠️ 백업에 실패해 가져오기를 멈췄어요. 인터넷 연결을 확인해 주세요.', 'error'); return; }
    try {
      await DB._fbRef.set(importPayload(rpg));
    } catch (err) { notify('⚠️ 가져오기 저장에 실패했어요: ' + (err && err.message || err), 'error'); return; }
    const appNote = isNew && data.roots && Object.keys(data.roots).length ? ' · 학습 앱·마을 기록은 파일에만 있고 자동으로 되돌리지 않아요' : '';
    notify('✅ 데이터 가져오기 완료! (가져오기 전 상태는 백업에 있어요)' + appNote);
    setTimeout(() => location.reload(), appNote ? 2500 : 800);
  };
  reader.readAsText(file);
  input.value = ''; // 같은 파일 재선택 허용
}

// renderQuestTable → renderBoardQuestList 로 대체

// ══════════════════════════════════════════════════
//  REWARD (individual)
// ══════════════════════════════════════════════════
function populateRewardStudents() {
  const sel = document.getElementById('rw-student');
  const students = DB.getStudents();
  // ★ 버그 수정: innerHTML 초기화 후 재구성 (중복 방지)
  sel.innerHTML = students.map(s => `<option value="${s.id}">${s.avatar} ${escHtml(s.name)}</option>`).join('');
  loadRewardStudent();
}

function loadRewardStudent() {
  const id = document.getElementById('rw-student').value;
  const s = DB.getStudent(id);
  if (!s) return;
  const statNames = GAME_DATA.statNames;
  document.getElementById('reward-stats').innerHTML = Object.entries(s.stats||{}).map(([k,v]) => `
    <div class="ab-admin-row">
      <span class="ab-admin-name">${statNames[k]||k}</span>
      <div class="ab-admin-bar"><div class="ab-admin-fill" style="width:${Math.min(100,v/20*100)}%"></div></div>
      <input class="ab-admin-input" type="number" id="rw-stat-${k}" value="${v}">
    </div>`).join('');
}

function applyReward(isLevelUp) {
  const id = document.getElementById('rw-student').value;
  const s = DB.getStudent(id);
  if (!s) { notify('학생을 먼저 선택하세요.', 'error'); return; }
  const goldDelta = parseInt(document.getElementById('rw-gold').value)||0;
  const expDelta = parseInt(document.getElementById('rw-exp').value)||0;
  const title = document.getElementById('rw-title').value;
  const newPw = document.getElementById('rw-pw').value;

  s.gold = Math.max(0, s.gold + goldDelta);
  // [R7] 누적 골드는 '받은 골드'만 쌓는다(차감은 제외) — 골드 랭킹·누적 골드 업적 기준값
  if (goldDelta > 0) s.totalGold = (s.totalGold||0) + goldDelta;
  s.exp += expDelta;
  s.level = Utils.levelFromExp(s.exp);
  if (title) { s.title = title; if(!(s.titles||[]).includes(title)) s.titles = [...(s.titles||[]), title]; }
  if (newPw) s.pw = newPw;

  // [R3] 능력치는 소수 단위로 관리된다(퀘스트 statVal 0.5 등). parseInt로 읽으면
  //      골드만 주려고 [적용]을 눌러도 모든 능력치의 소수점이 잘려 조용히 훼손된다.
  ['read','study','art','value','health','life'].forEach(k => {
    const el = document.getElementById(`rw-stat-${k}`);
    if (el) s.stats[k] = Math.round((parseFloat(el.value)||0) * 10) / 10;
  });

  DB.saveStudent(s);
  renderAll();
  notify(`✅ ${s.name} 보상 적용 완료!${isLevelUp ? ' 🎉 레벨업 이벤트!' : ''}`);
}

