// admin/study.js — 학습 범위(STUDY-SCOPE) · 오늘의 공부 보상 · 생각판(관리 화면 안) · 학습 앱 기록
//  admin.js 에서 떼어 옮긴 클래식 스크립트 [ADMIN-SPLIT-1] — 글자 그대로 · 전역 그대로 · admin.html 에서 admin.js 바로 뒤에 부른다.
// ── [ADMIN-SPLIT-1] 'study' — 원래 admin.js 6354~6589줄 ──
// ══════════════════════════════════════════════════
//  📚 학습 범위 — 교사가 진도에 맞는 단원만 켠다 (STUDY-SCOPE-1)
//   · settings.activeProblemUnits = [unitId, ...]
//   · 비어 있거나 없으면 "전체 허용"(CurriculumUtils.activeUnitIds가 null 반환)
//   · 학생 화면은 켜진 단원의 문제만 출제한다
// ══════════════════════════════════════════════════

// [STUDY-REWARD-1] 오늘의 공부 보상 설정 — settings.studyReward (student.js의 studyRewardCfg와 기본값 동일)
function _studyRewardCfg() {
  const s = DB.getSettings() || {};
  const d = { enabled: true, mode: 'auto', exp: 30, gold: 20, bonusPct: 80, bonusExp: 20, bonusGold: 10 };
  return { ...d, ...(s.studyReward || {}) };
}
function saveStudyRewardCfg() {
  const num = (id, def) => { const v = parseInt(document.getElementById(id)?.value); return Number.isFinite(v) && v >= 0 ? v : def; };
  const mode = document.querySelector('input[name="sr-mode"]:checked')?.value === 'approve' ? 'approve' : 'auto';
  const cfg = {
    enabled: !!document.getElementById('sr-enabled')?.checked, mode,
    exp: num('sr-exp', 30), gold: num('sr-gold', 20), bonusPct: Math.min(100, num('sr-pct', 80)),
    bonusExp: num('sr-bexp', 20), bonusGold: num('sr-bgold', 10),
  };
  DB.saveSettings({ ...DB.getSettings(), studyReward: cfg });
  notify(cfg.enabled ? `오늘의 공부 보상 저장 (${cfg.mode === 'approve' ? '승인 후' : '바로'} +${cfg.exp}EXP +${cfg.gold}G)` : '오늘의 공부 보상을 껐어요');
  renderStudyScopePage();
}

function _activeUnitSet() {
  const list = (DB.getSettings() || {}).activeProblemUnits;
  return new Set(Array.isArray(list) ? list : []);
}

function renderStudyScopePage() {
  const body = document.getElementById('study-scope-body');
  if (!body) return;
  if (typeof CurriculumUtils === 'undefined') {
    body.innerHTML = `<div class="card"><div class="empty-state">학습 자료를 불러오지 못했습니다</div></div>`;
    return;
  }

  const active = _activeUnitSet();
  const subjects = CurriculumUtils.subjects();
  const allUnits = subjects.flatMap(s => s.units.map(u => u.id));
  const onCount  = active.size;
  const isAllOpen = onCount === 0;   // 아무것도 안 켜면 전체 허용

  // 학급 전체가 이 단원을 얼마나 풀었는지(참고용)
  const recs = (typeof DB.getProblemRecords === 'function') ? DB.getProblemRecords() : [];
  const stat = {};
  for (const r of recs) for (const a of (r.answers || [])) {
    if (!a || !a.unitId) continue;
    stat[a.unitId] = stat[a.unitId] || { t: 0, c: 0 };
    stat[a.unitId].t++; if (a.correct) stat[a.unitId].c++;
  }

  const rw = _studyRewardCfg();
  body.innerHTML = `
    <div class="card" style="margin-bottom:1rem">
      <div style="display:flex;align-items:center;gap:.6rem;font-weight:700;font-size:1.02rem;margin-bottom:.5rem">
        <span>🎁 오늘의 공부 보상</span>
        <span class="text-muted-sm">하루 ${typeof STUDY_PER_DAY !== 'undefined' ? STUDY_PER_DAY : 10}문제를 채우면 1회</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem .9rem;align-items:end">
        <label style="display:flex;align-items:center;gap:.5rem;grid-column:1/-1">
          <input type="checkbox" id="sr-enabled" ${rw.enabled ? 'checked' : ''} style="width:18px;height:18px">
          <span>보상 주기</span>
        </label>
        <div style="grid-column:1/-1;display:flex;gap:1.2rem;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:.4rem">
            <input type="radio" name="sr-mode" value="auto" ${rw.mode !== 'approve' ? 'checked' : ''}> 바로 지급</label>
          <label style="display:flex;align-items:center;gap:.4rem">
            <input type="radio" name="sr-mode" value="approve" ${rw.mode === 'approve' ? 'checked' : ''}> 선생님 승인 후 지급</label>
        </div>
        <div><div class="text-muted-sm">EXP</div><input class="form-input" type="number" id="sr-exp" value="${rw.exp}"></div>
        <div><div class="text-muted-sm">골드</div><input class="form-input" type="number" id="sr-gold" value="${rw.gold}"></div>
        <div><div class="text-muted-sm">보너스 기준 정답률(%)</div><input class="form-input" type="number" id="sr-pct" value="${rw.bonusPct}"></div>
        <div><div class="text-muted-sm">보너스 EXP</div><input class="form-input" type="number" id="sr-bexp" value="${rw.bonusExp}"></div>
        <div><div class="text-muted-sm">보너스 골드</div><input class="form-input" type="number" id="sr-bgold" value="${rw.bonusGold}"></div>
        <button class="btn-sm" onclick="saveStudyRewardCfg()">저장</button>
      </div>
      <div class="text-muted-sm" style="margin-top:.6rem">
        · 4학년 교과 문제만 집계합니다. <b>1~3학년 보충</b>은 보상과 무관합니다.<br>
        · '선생님 승인 후 지급'을 고르면 보상 지급 탭 대기열에 뜹니다.
      </div>
    </div>

    <div class="card" style="margin-bottom:1rem">
      <div style="display:flex;align-items:center;gap:.8rem;flex-wrap:wrap">
        <div style="flex:1;min-width:220px">
          <div style="font-weight:700;margin-bottom:.2rem">
            ${isAllOpen
              ? '지금은 <span style="color:#1a7f4b">모든 단원</span>이 열려 있습니다'
              : `지금은 <span style="color:#1a7f4b">${onCount}개 단원</span>만 열려 있습니다`}
          </div>
          <div class="text-muted-sm">
            ${isAllOpen
              ? '단원을 하나라도 켜면 그 단원만 학생에게 나옵니다. 진도에 맞춰 골라 주세요.'
              : '학생 화면에는 켜진 단원의 문제만 나옵니다.'}
          </div>
        </div>
        <button class="btn-sm" onclick="setAllStudyUnits(true)">전체 켜기</button>
        <button class="btn-sm outline" onclick="setAllStudyUnits(false)">전체 끄기(=모든 단원 허용)</button>
      </div>
    </div>

    ${subjects.map(sub => {
      const onInSub = sub.units.filter(u => active.has(u.id)).length;
      return `
      <div class="card" style="margin-bottom:1rem">
        <div style="display:flex;align-items:center;gap:.5rem;font-weight:700;font-size:1.02rem">
          <span>${sub.icon || '📘'} ${escHtml(sub.label)}</span>
          <span class="text-muted-sm">${onInSub}/${sub.units.length} 단원 켜짐</span>
          <button class="btn-sm" style="margin-left:auto"
            onclick="setSubjectStudyUnits('${sub.key}',true)">이 과목 전부</button>
          <button class="btn-sm outline"
            onclick="setSubjectStudyUnits('${sub.key}',false)">해제</button>
        </div>
        <div style="display:grid;gap:.5rem;margin-top:.6rem">
          ${sub.units.map(u => {
            const n = CurriculumUtils.problemsByUnit(u.id).length;
            const st = stat[u.id];
            const pct = st && st.t >= 5 ? Math.round(st.c / st.t * 100) : null;
            const on = active.has(u.id);
            return `
            <label style="display:flex;align-items:center;gap:.7rem;padding:.6rem .8rem;
              border:1px solid ${on ? 'rgba(26,127,75,.35)' : 'var(--line, rgba(0,0,0,.1))'};
              border-radius:10px;cursor:pointer;background:${on ? 'rgba(26,127,75,.06)' : 'transparent'}">
              <input type="checkbox" ${on ? 'checked' : ''}
                onchange="toggleStudyUnit('${u.id}', this.checked)"
                style="width:18px;height:18px;cursor:pointer;flex-shrink:0">
              <span style="flex:1;min-width:0">
                <span style="display:block;font-weight:600">${u.no}. ${escHtml(u.name)}</span>
                <span class="text-muted-sm">
                  문제 ${n}개${pct !== null ? ` · 학급 정답률 ${pct}% (${st.t}회 풀이)` : ' · 아직 푼 기록 없음'}
                </span>
              </span>
            </label>`;
          }).join('')}
        </div>
      </div>`;
    }).join('')}

    <div class="card">
      <div class="text-muted-sm">
        · 아무 단원도 켜지 않으면 <b>모든 단원</b>이 학생에게 나옵니다(기본값).<br>
        · 바꾸면 바로 저장되고 학생 화면에 반영됩니다.<br>
        · 켜진 단원에 문제가 없으면 학생 화면에 아무것도 나오지 않으니 주의하세요.
      </div>
    </div>`;
}

function _saveActiveUnits(arr) {
  const prev = DB.getSettings();
  DB.saveSettings({ ...prev, activeProblemUnits: arr });
}

function toggleStudyUnit(unitId, on) {
  const set = _activeUnitSet();
  if (on) set.add(unitId); else set.delete(unitId);
  _saveActiveUnits([...set]);
  renderStudyScopePage();
}

function setSubjectStudyUnits(subjectKey, on) {
  const sub = CurriculumUtils.subjects().find(s => s.key === subjectKey);
  if (!sub) return;
  const set = _activeUnitSet();
  sub.units.forEach(u => { if (on) set.add(u.id); else set.delete(u.id); });
  _saveActiveUnits([...set]);
  renderStudyScopePage();
  notify(on ? `${sub.label} 단원을 모두 켰어요` : `${sub.label} 단원을 모두 껐어요`);
}

function setAllStudyUnits(on) {
  if (!on) {
    _saveActiveUnits([]);
    renderStudyScopePage();
    notify('모든 단원이 열렸습니다(범위 지정 해제)');
    return;
  }
  const all = CurriculumUtils.subjects().flatMap(s => s.units.map(u => u.id));
  _saveActiveUnits(all);
  renderStudyScopePage();
  notify('전체 단원을 켰어요');
}

// [THINKBOARD-1·2] 생각판 선생님 화면 — 관리 화면 안(쪽)에서 연다. 관리 화면에 로그인했으니 비밀번호를 다시 묻지 않게
//   이 기기에 12시간 '선생님' 표시를 남긴다(TV 처럼 새 탭으로 연 화면도 통과). 학생은 자기 크롬북이라 이 표시가 없다.
function _tbTeacherMark() {
  try { sessionStorage.setItem('tb.teacher', '1'); localStorage.setItem('tb.teacherUntil', String(Date.now() + 12 * 3600 * 1000)); } catch (e) {}
}
function openThinkboardInline() {
  _tbTeacherMark();
  const f = document.getElementById('tb-frame');
  if (f && !f.getAttribute('src')) f.setAttribute('src', 'thinkboard/index.html?rpg=1#/t');
}
function openThinkboard() {   // 새 탭(TV 등)
  _tbTeacherMark();
  const w = window.open('thinkboard/index.html?rpg=1#/t', '_blank');
  if (!w) location.href = 'thinkboard/index.html?rpg=1#/t';
}

// [LEARN-APPS-1] 학습 앱 선생님 화면 — 그동안 관리 화면에 링크가 없어 주소를 직접 쳐야 했다(생각판만 있었음).
//   <app>/index.html?teacher=1#/t 를 새 탭으로 연다. 각 앱 teacher.js 는 sessionStorage '<app>.teacher'='1' 이면
//   비밀번호를 다시 묻지 않는다 → 열기 전에 이 탭에 그 표시를 세운다. window.open(noopener 없이)은 sessionStorage 를
//   새 탭에 복사하므로 새 탭도 통과한다. 학생 크롬북에는 이 표시가 없다(관리 화면에 들어온 탭에서만 선다).
const LEARN_APPS = [
  { key: 'music',   icon: '🎵', name: '음악실',     what: '아이별 곡 · 리코더 연습 횟수 · 음악회 내리기' },
  { key: 'coding',  icon: '🧩', name: '기초 코딩',   what: '막힘 지도 · 판마다 많이 한 실수 · 마지막 코드' },
  { key: 'pattern', icon: '🔷', name: '무늬 공방',   what: '헷갈림 지도 · 좌우·돌리기 헷갈림 · 무늬 전시 내리기' },
  { key: 'paint',   icon: '🎨', name: '물감 연구소', what: '헷갈림 지도 · 밝기·선명함 · 느낌의 색 모자이크' },
  { key: 'art',     icon: '🔍', name: '명화 탐정',   what: '탐정 기록 · 질문 사다리 · 조형 요소 찾기' },
  { key: 'ink',     icon: '🖌️', name: '먹 연구소',   what: '헷갈림 지도 · 농담(진함·옅음) · 먹색 꼬리' },
  { key: 'print',   icon: '🖨️', name: '판화 놀이',   what: '헷갈림 지도 · 거울(좌우 반전) 실수 · 넘쳐 팜' },
];
function learnAppUrl(key) { return key + '/index.html?teacher=1#/t'; }
function renderLearnAppsPage() {
  const el = document.getElementById('learnapps-grid');
  if (!el) return;
  el.innerHTML = LEARN_APPS.map(a => `
    <button type="button" class="learnapp-card" data-app="${a.key}" onclick="openLearnApp('${a.key}')"
      style="display:flex;flex-direction:column;align-items:flex-start;gap:.35rem;text-align:left;cursor:pointer;
      background:var(--card);border:1px solid var(--border2);border-radius:var(--r);padding:1rem 1.1rem;color:inherit;font:inherit">
      <span style="font-size:1.5rem;line-height:1">${a.icon}</span>
      <span style="font-size:.95rem;font-weight:700">${escHtml(a.name)}</span>
      <span style="font-size:.74rem;color:var(--txt2);line-height:1.5">${escHtml(a.what)}</span>
      <span style="margin-top:auto;font-size:.72rem;color:var(--sky);font-weight:600">새 탭으로 열기 ↗</span>
    </button>`).join('');
}
function openLearnApp(key) {
  const app = LEARN_APPS.find(a => a.key === key);
  if (!app) return;
  try { sessionStorage.setItem(key + '.teacher', '1'); } catch (e) {}
  const url = learnAppUrl(key);
  const w = window.open(url, '_blank');
  if (!w) location.href = url;   // 팝업이 막히면 이 탭에서(생각판 openThinkboard 와 같다)
}
