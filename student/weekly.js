// student/weekly.js — 주간 다짐(월요일 목표 ↔ 금요일 성찰)
//  student.js 에서 떼어 옮긴 클래식 스크립트 [SPLIT-1] — 글자 그대로 · 전역 그대로 · student.html 에서 student.js 바로 뒤에 부른다.
// ── [SPLIT-1] 'weekly' — 원래 student.js 14698~15083줄 ──
// ══════════════════════════════════════════════════════
//  주간 다짐 (월요일 목표 ↔ 금요일 성찰)
// ══════════════════════════════════════════════════════

// 공통 상수
const WEEKLY_MOOD_OPTS     = ['즐거웠어요','편안했어요','신났어요','보통이었어요','조금 아쉬웠어요','피곤했어요'];
const WEEKLY_FOCUS_OPTS    = ['공부','독서','친구 관계','건강','책임감','발표','리코더','영어 단어'];
const WEEKLY_GOAL_OPTS     = ['책 끝까지 읽기','발표할 때 손 들기','숙제 미루지 않기','친구에게 먼저 친절하게 말하기','리코더 연습하기','단어 자주 보기','끝까지 포기하지 않기'];
const WEEKLY_MINDSET_OPTS  = ['차분하게','자신 있게','꾸준하게','즐겁게','친절하게','용기 있게','끝까지','천천히라도 해보기'];
const WEEKLY_EFFORT_OPTS   = ['많이 노력했어요','꽤 노력했어요','조금 노력했어요','더 노력할걸 그랬어요'];
const WEEKLY_ACHIEVE_OPTS  = ['해냈어요','거의 해냈어요','조금 했어요','아직 못 했어요'];
const WEEKLY_MINDSET_REF   = ['잘 지켰어요','꽤 지켰어요','조금 지켰어요','아쉬웠어요'];
const WEEKLY_BEST_OPTS     = ['끝까지 해낸 것','발표를 해본 것','친구와 잘 지낸 것','책을 읽은 것','리코더를 연습한 것','단어를 열심히 본 것','숙제를 잘 챙긴 것'];
const WEEKLY_NEXT_OPTS     = ['더 꾸준히 하기','발표 더 용기 내기','책 더 읽기','친구에게 더 친절하게 하기','리코더 더 자주 연습하기','단어 더 자주 보기','미루지 않기'];

// 선택형 칩 UI 빌더
function buildChipForm(containerId, opts, selectedVal, allowCustom=true) {
  const customLabel = '직접입력';
  const isCustom = selectedVal && !opts.includes(selectedVal);
  return `
    <div id="${containerId}-chips" style="display:flex;flex-wrap:wrap;gap:.35rem;margin-bottom:.4rem">
      ${opts.map(o => `
        <button type="button" onclick="selectChip('${containerId}','${o.replace(/'/g,"\\'")}')"
          style="padding:.32rem .75rem;border-radius:20px;font-size:.78rem;cursor:pointer;font-family:inherit;
            border:1.5px solid ${selectedVal===o?'var(--sky)':'rgba(255,255,255,.15)'};
            background:${selectedVal===o?'rgba(93,173,226,.2)':'rgba(255,255,255,.05)'};
            color:${selectedVal===o?'var(--sky)':'var(--txt2)'};">${o}</button>`).join('')}
      ${allowCustom?`<button type="button" onclick="selectChip('${containerId}','__custom__')"
        style="padding:.32rem .75rem;border-radius:20px;font-size:.78rem;cursor:pointer;font-family:inherit;
          border:1.5px solid ${isCustom?'var(--gold)':'rgba(255,255,255,.15)'};
          background:${isCustom?'rgba(255,215,0,.15)':'rgba(255,255,255,.05)'};
          color:${isCustom?'var(--gold)':'var(--txt3)'};">✏️ 직접입력</button>`:''}
    </div>
    <input id="${containerId}-custom" type="text" class="form-input-student"
      placeholder="직접 입력해주세요"
      style="display:${isCustom?'':'none'};margin-top:.1rem"
      value="${isCustom?selectedVal:''}">
    <input type="hidden" id="${containerId}-val" value="${selectedVal||''}">`;
}

function selectChip(containerId, val) {
  const isCustom = val === '__custom__';
  const customEl = document.getElementById(`${containerId}-custom`);
  const hiddenEl = document.getElementById(`${containerId}-val`);
  const chips    = document.querySelectorAll(`#${containerId}-chips button`);

  chips.forEach(b => {
    const bVal = b.textContent.trim().replace('✏️ ','');
    const active = isCustom ? bVal === '직접입력' : b.textContent.trim() === val;
    b.style.borderColor = active ? (isCustom?'var(--gold)':'var(--sky)') : 'rgba(255,255,255,.15)';
    b.style.background  = active ? (isCustom?'rgba(255,215,0,.15)':'rgba(93,173,226,.2)') : 'rgba(255,255,255,.05)';
    b.style.color       = active ? (isCustom?'var(--gold)':'var(--sky)') : 'var(--txt2)';
  });
  if (customEl) customEl.style.display = isCustom ? '' : 'none';
  if (!isCustom && hiddenEl) hiddenEl.value = val;
  if (isCustom && customEl) {
    customEl.oninput = () => { if (hiddenEl) hiddenEl.value = customEl.value.trim(); };
    customEl.focus();
  }
}

function getChipVal(containerId) {
  const hidden = document.getElementById(`${containerId}-val`);
  const custom = document.getElementById(`${containerId}-custom`);
  if (custom && custom.style.display !== 'none') return custom.value.trim();
  return hidden ? hidden.value : '';
}

// ── 자동 팝업 체크 ──────────────────────────────────
function checkWeeklyRoutine() {
  if (!CUR) return;
  const d = new Date(Date.now()+9*3600000);
  const day = d.getUTCDay(); // 1=월, 5=금
  const wk  = Utils.weekKey();
  if (day === 1) {
    const existing = DB.getWeeklyGoal(CUR.id, wk);
    if (!existing) openWeeklyModal('monday');
  } else if (day === 5) {
    const existing = DB.getWeeklyReflection(CUR.id, wk);
    if (!existing) openWeeklyModal('friday');
  }
}

// ── 모달 열기 ────────────────────────────────────────
function openWeeklyModal(mode) {
  openModal('m-weekly');
  const titleEl = document.getElementById('weekly-modal-title');
  const bodyEl  = document.getElementById('weekly-modal-body');
  if (!titleEl || !bodyEl) return;
  if (mode === 'monday') {
    titleEl.textContent = '📅 이번 주 다짐';
    bodyEl.innerHTML = buildMondayForm();
  } else {
    titleEl.textContent = '📅 이번 주 돌아보기';
    const wk   = Utils.weekKey();
    const goal = DB.getWeeklyGoal(CUR.id, wk);
    bodyEl.innerHTML = buildFridayForm(goal);
  }
}

// ── 월요일 폼 ────────────────────────────────────────
function buildMondayForm() {
  const wk  = Utils.weekKey();
  const existing = DB.getWeeklyGoal(CUR.id, wk);
  if (existing) return buildMondayReadOnly(existing);

  return `
    <div style="padding:.8rem 1rem;display:flex;flex-direction:column;gap:1.1rem">
      <!-- Q1 -->
      <div>
        <div style="font-size:.8rem;font-weight:700;color:var(--txt1);margin-bottom:.5rem">
          1. 주말에 무엇을 했나요?
        </div>
        <input id="wk-weekend-text" class="form-input-student"
          placeholder="예) 가족과 시간을 보냈어요 / 집에서 쉬었어요"
          style="font-size:.84rem">
      </div>
      <!-- Q2 -->
      <div>
        <div style="font-size:.8rem;font-weight:700;color:var(--txt1);margin-bottom:.5rem">
          2. 주말 기분은 어땠나요?
        </div>
        ${buildChipForm('wk-mood', WEEKLY_MOOD_OPTS, '')}
      </div>
      <!-- Q3 -->
      <div>
        <div style="font-size:.8rem;font-weight:700;color:var(--txt1);margin-bottom:.5rem">
          3. 이번 주 내가 가장 노력할 것은?
        </div>
        ${buildChipForm('wk-focus', WEEKLY_FOCUS_OPTS, '')}
      </div>
      <!-- Q4 -->
      <div>
        <div style="font-size:.8rem;font-weight:700;color:var(--txt1);margin-bottom:.5rem">
          4. 이번 주 내가 해볼 목표는?
        </div>
        ${buildChipForm('wk-goal', WEEKLY_GOAL_OPTS, '')}
      </div>
      <!-- Q5 -->
      <div>
        <div style="font-size:.8rem;font-weight:700;color:var(--txt1);margin-bottom:.5rem">
          5. 이번 주 내 마음가짐은?
        </div>
        ${buildChipForm('wk-mindset', WEEKLY_MINDSET_OPTS, '')}
      </div>
      <button class="btn-gold" style="padding:.6rem;font-size:.88rem;font-weight:800;border-radius:12px"
        onclick="submitMondayGoal()">✅ 다짐 저장</button>
    </div>`;
}

function buildMondayReadOnly(g) {
  return `
    <div style="padding:.8rem 1rem">
      <div style="background:rgba(93,173,226,.07);border:1px solid rgba(93,173,226,.2);
        border-radius:12px;padding:.9rem;margin-bottom:.7rem">
        <div style="font-size:.72rem;color:var(--sky);font-weight:700;margin-bottom:.6rem">✅ 이번 주 다짐 완료</div>
        <div style="font-size:.82rem;color:var(--txt2);margin-bottom:.3rem">🏖️ 주말: ${escHtml(g.weekendText||'')}</div>
        <div style="font-size:.82rem;color:var(--txt2);margin-bottom:.3rem">😊 기분: ${escHtml(g.weekendMood||'')}</div>
        <div style="font-size:.82rem;color:var(--txt2);margin-bottom:.3rem">💪 노력할 것: ${escHtml(g.focusArea||'')}</div>
        <div style="font-size:.82rem;color:var(--txt2);margin-bottom:.3rem">🎯 목표: ${escHtml(g.goalText||'')}</div>
        <div style="font-size:.82rem;color:var(--txt2)">🌟 마음가짐: ${escHtml(g.mindset||'')}</div>
      </div>
      <div style="font-size:.75rem;color:var(--txt3);text-align:center">이미 작성했어요! 금요일에 다시 만나요 😊</div>
    </div>`;
}

function submitMondayGoal() {
  const weekendText = document.getElementById('wk-weekend-text')?.value.trim() || '';
  const weekendMood = getChipVal('wk-mood');
  const focusArea   = getChipVal('wk-focus');
  const goalText    = getChipVal('wk-goal');
  const mindset     = getChipVal('wk-mindset');
  if (!weekendText) { toast('주말에 무엇을 했는지 써주세요!'); return; }
  if (!weekendMood) { toast('주말 기분을 선택해주세요!'); return; }
  if (!focusArea)   { toast('이번 주 노력할 것을 선택해주세요!'); return; }
  if (!goalText)    { toast('이번 주 목표를 선택해주세요!'); return; }
  if (!mindset)     { toast('이번 주 마음가짐을 선택해주세요!'); return; }

  const wk = Utils.weekKey();
  const id = `weekly_goal_${wk.replace('-','_')}_${CUR.id}`;
  DB.saveWeeklyGoal({ id, studentId:CUR.id, studentName:CUR.name,
    weekKey:wk, type:'monday_goal', weekendText, weekendMood,
    focusArea, goalText, mindset, createdAt:Date.now() });
  toast('📅 이번 주 다짐 저장! 금요일에 돌아봐요 😊');
  closeModal('m-weekly');
  renderMain(); renderMobile();
  if (document.getElementById('house-tab-weekly')?.style.display !== 'none') renderWeeklyTab();
}

// ── 금요일 폼 ────────────────────────────────────────
function buildFridayForm(goal) {
  const wk = Utils.weekKey();
  const existing = DB.getWeeklyReflection(CUR.id, wk);
  if (existing) return buildFridayReadOnly(goal, existing);

  const focusQ   = goal ? `이번 주 나는 <strong style="color:var(--sky)">'${escHtml(goal.focusArea)}'</strong>를 얼마나 노력했나요?` : '이번 주 얼마나 노력했나요?';
  const goalQ    = goal ? `이번 주 나는 <strong style="color:var(--sky)">'${escHtml(goal.goalText)}'</strong>를 어떻게 해냈나요?` : '이번 주 목표를 어떻게 해냈나요?';
  const mindsetQ = goal ? `이번 주 나는 <strong style="color:var(--sky)">'${escHtml(goal.mindset||"마음가짐")}'</strong>으로 지내려고 얼마나 노력했나요?` : '이번 주 마음가짐을 얼마나 지켰나요?';

  return `
    <div style="padding:.8rem 1rem;display:flex;flex-direction:column;gap:1.1rem">
      ${goal ? `
      <div style="background:rgba(255,215,0,.07);border:1px solid rgba(255,215,0,.2);
        border-radius:12px;padding:.8rem;font-size:.8rem">
        <div style="font-size:.72rem;color:var(--gold);font-weight:700;margin-bottom:.5rem">📅 이번 주 월요일 다짐</div>
        <div style="color:var(--txt2);margin-bottom:.2rem">🏖️ 주말에 한 일: <b>${escHtml(goal.weekendText||'')}</b></div>
        <div style="color:var(--txt2);margin-bottom:.2rem">😊 주말 기분: <b>${escHtml(goal.weekendMood||'')}</b></div>
        <div style="color:var(--txt2);margin-bottom:.2rem">💪 노력할 것: <b>${escHtml(goal.focusArea||'')}</b></div>
        <div style="color:var(--txt2);margin-bottom:.2rem">🎯 목표: <b>${escHtml(goal.goalText||'')}</b></div>
        <div style="color:var(--txt2)">🌟 마음가짐: <b>${escHtml(goal.mindset||'')}</b></div>
      </div>` : ''}
      <!-- Q1 -->
      <div>
        <div style="font-size:.8rem;font-weight:700;color:var(--txt1);margin-bottom:.5rem">${focusQ}</div>
        ${buildChipForm('wk-effort', WEEKLY_EFFORT_OPTS, '', false)}
      </div>
      <!-- Q2 -->
      <div>
        <div style="font-size:.8rem;font-weight:700;color:var(--txt1);margin-bottom:.5rem">${goalQ}</div>
        ${buildChipForm('wk-achieve', WEEKLY_ACHIEVE_OPTS, '', false)}
      </div>
      <!-- Q3 마음가짐 성찰 -->
      <div>
        <div style="font-size:.8rem;font-weight:700;color:var(--txt1);margin-bottom:.5rem">3. ${mindsetQ}</div>
        ${buildChipForm('wk-mindset-ref', WEEKLY_MINDSET_REF, '', false)}
      </div>
      <!-- Q4 -->
      <div>
        <div style="font-size:.8rem;font-weight:700;color:var(--txt1);margin-bottom:.5rem">4. 이번 주 내가 가장 잘한 점은?</div>
        ${buildChipForm('wk-best', WEEKLY_BEST_OPTS, '')}
      </div>
      <!-- Q5 -->
      <div>
        <div style="font-size:.8rem;font-weight:700;color:var(--txt1);margin-bottom:.5rem">5. 다음 주에는 무엇을 더 해보고 싶나요?</div>
        ${buildChipForm('wk-next', WEEKLY_NEXT_OPTS, '')}
      </div>
      <button class="btn-gold" style="padding:.6rem;font-size:.88rem;font-weight:800;border-radius:12px"
        onclick="submitFridayReflection()">✅ 돌아보기 저장</button>
    </div>`;
}

function buildFridayReadOnly(goal, ref) {
  return `
    <div style="padding:.8rem 1rem">
      ${goal ? `<div style="background:rgba(255,215,0,.07);border:1px solid rgba(255,215,0,.2);
        border-radius:12px;padding:.8rem;margin-bottom:.7rem;font-size:.8rem">
        <div style="font-size:.72rem;color:var(--gold);font-weight:700;margin-bottom:.5rem">📅 이번 주 다짐</div>
        <div style="color:var(--txt2);margin-bottom:.2rem">💪 ${escHtml(goal.focusArea)}</div>
        <div style="color:var(--txt2)">🎯 ${escHtml(goal.goalText)}</div>
      </div>` : ''}
      <div style="background:rgba(46,204,113,.07);border:1px solid rgba(46,204,113,.2);
        border-radius:12px;padding:.9rem;margin-bottom:.7rem">
        <div style="font-size:.72rem;color:var(--emerald);font-weight:700;margin-bottom:.6rem">✅ 이번 주 돌아보기 완료</div>
        <div style="font-size:.82rem;color:var(--txt2);margin-bottom:.3rem">📊 노력: ${escHtml(ref.focusReflection||'')}</div>
        <div style="font-size:.82rem;color:var(--txt2);margin-bottom:.3rem">🎯 목표: ${escHtml(ref.goalReflection||'')}</div>
        <div style="font-size:.82rem;color:var(--txt2);margin-bottom:.3rem">🌟 마음가짐: ${ref.mindsetReflection||''}</div>
        <div style="font-size:.82rem;color:var(--txt2);margin-bottom:.3rem">⭐ 잘한 것: ${escHtml(ref.bestMoment||'')}</div>
        <div style="font-size:.82rem;color:var(--txt2)">➡️ 다음 주: ${escHtml(ref.nextWeekGoal||'')}</div>
      </div>
    </div>`;
}

function submitFridayReflection() {
  const focusReflection   = getChipVal('wk-effort');
  const goalReflection    = getChipVal('wk-achieve');
  const mindsetReflection = getChipVal('wk-mindset-ref');
  const bestMoment        = getChipVal('wk-best');
  const nextWeekGoal      = getChipVal('wk-next');
  if (!focusReflection)   { toast('노력 정도를 선택해주세요!'); return; }
  if (!goalReflection)    { toast('목표 달성을 선택해주세요!'); return; }
  if (!mindsetReflection) { toast('마음가짐을 얼마나 지켰는지 골라 주세요!'); return; }
  if (!bestMoment)        { toast('잘한 점을 선택해주세요!'); return; }
  if (!nextWeekGoal)      { toast('다음 주 목표를 선택해주세요!'); return; }

  const wk   = Utils.weekKey();
  const goal = DB.getWeeklyGoal(CUR.id, wk);
  const id   = `weekly_ref_${wk.replace('-','_')}_${CUR.id}`;
  DB.saveWeeklyReflection({ id, studentId:CUR.id, studentName:CUR.name,
    weekKey:wk, type:'friday_reflection',
    mondayGoalId: goal?.id || null,
    focusReflection, goalReflection, mindsetReflection, bestMoment, nextWeekGoal,
    createdAt: Date.now() });
  toast('📅 이번 주 돌아보기 완료! 수고했어요 🎉');
  closeModal('m-weekly');
  renderMain(); renderMobile();
  if (document.getElementById('house-tab-weekly')?.style.display !== 'none') renderWeeklyTab();
}

// ── 포트폴리오 주간 다짐 탭 렌더 ────────────────────
function renderWeeklyTab() {
  const el = document.getElementById('weekly-tab-content');
  if (!el) return;
  const d   = new Date(Date.now()+9*3600000);
  const day = d.getUTCDay();
  const wk  = Utils.weekKey();
  const curGoal = DB.getWeeklyGoal(CUR.id, wk);
  const curRef  = DB.getWeeklyReflection(CUR.id, wk);

  // 이번 주 작성 버튼
  let thisWeekHtml = `<div style="margin-bottom:1rem">
    <div style="font-size:.78rem;font-weight:700;color:var(--txt1);margin-bottom:.5rem">📅 이번 주</div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap">
      <button onclick="openWeeklyModal('monday')"
        style="padding:.45rem .9rem;border-radius:10px;font-size:.8rem;cursor:pointer;font-family:inherit;
          border:1.5px solid ${curGoal?'rgba(46,204,113,.4)':'rgba(93,173,226,.4)'};
          background:${curGoal?'rgba(46,204,113,.1)':'rgba(93,173,226,.1)'};
          color:${curGoal?'var(--emerald)':'var(--sky)'}">
        ${curGoal?'✅ 월요일 다짐 보기':'📝 이번 주 다짐 작성'}
      </button>
      <button onclick="openWeeklyModal('friday')"
        style="padding:.45rem .9rem;border-radius:10px;font-size:.8rem;cursor:pointer;font-family:inherit;
          border:1.5px solid ${curRef?'rgba(46,204,113,.4)':'rgba(255,215,0,.3)'};
          background:${curRef?'rgba(46,204,113,.1)':'rgba(255,215,0,.07)'};
          color:${curRef?'var(--emerald)':'var(--gold)'}">
        ${curRef?'✅ 금요일 돌아보기 보기':'📝 이번 주 돌아보기 작성'}
      </button>
    </div>
  </div>`;

  // 이번 주 카드
  if (curGoal || curRef) {
    thisWeekHtml += buildWeekCard(wk, curGoal, curRef, true);
  }

  // 지난 기록 누적
  const allGoals = DB.getWeeklyGoals(CUR.id);
  const allRefs  = allGoals.map(g => DB.getWeeklyReflection(CUR.id, g.weekKey));
  const allWeeks = [...new Set(allGoals.map(g=>g.weekKey))].sort().reverse();
  const pastWeeks = allWeeks.filter(w => w !== wk);

  const pastHtml = pastWeeks.length === 0 ? '' : `
    <div style="font-size:.78rem;font-weight:700;color:var(--txt1);margin-bottom:.5rem">📚 지난 기록</div>
    ${pastWeeks.map(w => {
      const g = allGoals.find(x=>x.weekKey===w);
      const r = DB.getWeeklyReflection(CUR.id, w);
      return buildWeekCard(w, g, r, false);
    }).join('')}`;

  el.innerHTML = thisWeekHtml + pastHtml;
}

function buildWeekCard(wk, goal, ref, expanded) {
  const id = 'wk-card-' + wk.replace(/[^a-z0-9]/gi,'_');
  return `
    <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
      border-radius:12px;margin-bottom:.6rem;overflow:hidden">
      <div onclick="toggleWeekCard('${id}')" style="display:flex;align-items:center;justify-content:space-between;
        padding:.6rem .9rem;cursor:pointer">
        <div style="display:flex;align-items:center;gap:.5rem">
          <span style="font-size:.8rem;font-weight:700;color:var(--sky)">${wk}</span>
          ${goal?`<span style="font-size:.65rem;background:rgba(93,173,226,.12);color:var(--sky);border-radius:8px;padding:.1rem .4rem">월 ✓</span>`:''}
          ${ref ?`<span style="font-size:.65rem;background:rgba(46,204,113,.12);color:var(--emerald);border-radius:8px;padding:.1rem .4rem">금 ✓</span>`:''}
        </div>
        <span id="${id}-arrow" style="font-size:.7rem;color:var(--txt3)">${expanded?'▲':'▼'}</span>
      </div>
      <div id="${id}" style="display:${expanded?'':'none'};padding:0 .9rem .8rem">
        ${goal?`<div style="font-size:.78rem;color:var(--txt2);margin-bottom:.5rem;padding:.6rem;
          background:rgba(255,215,0,.05);border-radius:8px;border:1px solid rgba(255,215,0,.1)">
          <div style="font-size:.68rem;color:var(--gold);font-weight:700;margin-bottom:.35rem">📅 월요일 다짐</div>
          <div style="margin-bottom:.2rem">🏖️ ${escHtml(goal.weekendText||'')} <span style="color:var(--txt3)">(${escHtml(goal.weekendMood||'')})</span></div>
          <div style="margin-bottom:.2rem">💪 노력할 것: <b>${escHtml(goal.focusArea||'')}</b></div>
          <div style="margin-bottom:.2rem">🎯 목표: <b>${escHtml(goal.goalText||'')}</b></div>
          <div>🌟 마음가짐: <b>${escHtml(goal.mindset||'')}</b></div>
        </div>`:'<div style="font-size:.75rem;color:var(--txt3);padding:.3rem 0">월요일 다짐 없음</div>'}
        ${ref?`<div style="font-size:.78rem;color:var(--txt2);padding:.6rem;
          background:rgba(46,204,113,.05);border-radius:8px;border:1px solid rgba(46,204,113,.1)">
          <div style="font-size:.68rem;color:var(--emerald);font-weight:700;margin-bottom:.35rem">📅 금요일 돌아보기</div>
          <div style="margin-bottom:.2rem">📊 노력: ${escHtml(ref.focusReflection||'')}</div>
          <div style="margin-bottom:.2rem">🎯 목표: ${escHtml(ref.goalReflection||'')}</div>
          <div style="margin-bottom:.2rem">🌟 마음가짐: ${ref.mindsetReflection||''}</div>
          <div style="margin-bottom:.2rem">⭐ 잘한 것: ${escHtml(ref.bestMoment||'')}</div>
          <div>➡️ 다음 주: ${escHtml(ref.nextWeekGoal||'')}</div>
        </div>`:'<div style="font-size:.75rem;color:var(--txt3);padding:.3rem 0">금요일 돌아보기 없음</div>'}
      </div>
    </div>`;
}

function toggleWeekCard(id) {
  const el = document.getElementById(id);
  const arrow = document.getElementById(id+'-arrow');
  if (!el) return;
  const open = el.style.display === 'none';
  el.style.display = open ? '' : 'none';
  if (arrow) arrow.textContent = open ? '▲' : '▼';
}

