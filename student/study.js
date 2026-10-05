// student/study.js — 영어 단어장·팝업 퀴즈 + 오늘의 학습 + 문항별 숙달도(MASTERY)
//  student.js 에서 떼어 옮긴 클래식 스크립트 [SPLIT-1] — 글자 그대로 · 전역 그대로 · student.html 에서 student.js 바로 뒤에 부른다.
// ── [SPLIT-1] 'vocab' — 원래 student.js 15084~15211줄 ──
// ══════════════════════════════════════════════════════
//  영어 단어장 + 팝업 퀴즈
// ══════════════════════════════════════════════════════

const VOCAB_CATEGORIES = ['school','people','family','food','drink','animal','body','clothes','nature',
  'time','place','transport','adjective','verb','number','color','home','position','question','greeting','basic','subject','activity','quantity'];
const VOCAB_POS = ['noun','verb','adjective','adverb','pronoun','preposition','conjunction','interjection','number','other'];

// [KOREAN-B] 읽어 주기 — 두 번째 인자로 언어·속도를 받는다.
//   speakWord('apple')            → 지금까지와 똑같다(영어, 0.85). 기존 호출부는 손대지 않았다.
//   speakWord('문장', 'ko-KR')     → 한국어
//   speakWord('문장', { lang:'ko-KR', rate:0.8 })  → 받아쓰기처럼 또박또박
function speakWord(word, opts) {
  if (!word) return;
  if (!window.speechSynthesis) { toast('이 기기는 발음 기능을 지원하지 않아요'); return; }
  const o = (typeof opts === 'string') ? { lang: opts } : (opts || {});
  const lang = o.lang || 'en-US';
  // 이전 발음 중단
  window.speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(word);
  utter.lang = lang;
  utter.rate = (typeof o.rate === 'number') ? o.rate : 0.85;   // 약간 느리게 — 학생이 듣기 좋게
  utter.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const head = lang.slice(0, 2);
  const same = voices.filter(v => v.lang && v.lang.replace('_', '-').startsWith(head));
  let best = null;
  if (head === 'en') {
    // 가장 자연스러운 영어 음성 선택
    const preferred = [
      'Samantha','Alex','Daniel','Karen','Moira', // 좋은 영어 음성들
      'Google US English','Microsoft Zira','Microsoft David'
    ];
    for (const name of preferred) {
      best = same.find(v => v.name.includes(name));
      if (best) break;
    }
  } else if (head === 'ko') {
    // 한국어는 기기 기본 음성으로 충분하다(영어와 달리 발음이 어색해지지 않는다)
    for (const name of ['Google 한국의', 'Microsoft Heami', 'Yuna', 'Google Korean']) {
      best = same.find(v => v.name.includes(name));
      if (best) break;
    }
  }
  if (!best && same.length > 0) best = same[0];
  if (best) utter.voice = best;

  window.speechSynthesis.speak(utter);
}

// [KOREAN-B] 이 기기에 그 언어 음성이 있는지 — 없으면 듣기 문항을 안내와 함께 건너뛰게 한다
function hasVoiceFor(lang) {
  if (!window.speechSynthesis) return false;
  const vs = window.speechSynthesis.getVoices() || [];
  // [VOICE-READY-1] 음성 목록은 비동기로 채워진다. 아직 비어 있는 것은 '없다'가 아니라 '모른다'이므로
  //   없다고 단정하면 페이지를 열자마자 들어온 학생에게 "소리가 나오지 않아요"가 잘못 뜬다.
  if (!vs.length) return true;
  const head = String(lang || 'en').slice(0, 2);
  return vs.some(v => v.lang && v.lang.replace('_', '-').startsWith(head));
}
// 문항의 언어 — 문항이 정해 두었으면 그것, 아니면 국어 단원이면 한국어(그 밖에는 지금까지처럼 영어)
function problemLang(p) {
  if (p && p.lang) return p.lang;
  return (p && String(p.unitId || '').startsWith('ko')) ? 'ko-KR' : 'en-US';
}

// ── 받아쓰기 채점 ──────────────────────────────────────────
// 맞춤법(글자)이 1순위고 띄어쓰기는 따로 알려 준다. 정책이 바뀌면 이 상수만 true로 바꾸면 된다.
const DICTATION_STRICT_SPACING = false;
function dictationGrade(p, val) {
  const nosp  = s => String(s == null ? '' : s).replace(/\s+/g, '');
  // 띄어쓰기는 '어디서 띄었는가'만 본다(어절 길이의 모양). 글자를 틀렸다고 띄어쓰기까지 틀렸다고 알리면 안 된다.
  const shape = s => String(s == null ? '' : s).trim().split(/\s+/).map(w => w.length).join('-');
  const charOk = nosp(val) === nosp(p.a);
  const spaceOk = shape(val) === shape(p.a);
  return { ok: DICTATION_STRICT_SPACING ? (charOk && spaceOk) : charOk, charOk, spaceOk };
}
// 정답 글자와 학생이 쓴 글자를 맞춰 본다(가장 긴 공통 부분 기준) → 정답 글자마다 맞았는지 표시
function dictationMarks(answer, input) {
  const A = String(answer).replace(/\s+/g, ''), B = String(input || '').replace(/\s+/g, '');
  const n = A.length, m = B.length;
  const d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++)
    d[i][j] = A[i - 1] === B[j - 1] ? d[i - 1][j - 1] + 1 : Math.max(d[i - 1][j], d[i][j - 1]);
  const okIdx = new Set();
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (A[i - 1] === B[j - 1]) { okIdx.add(i - 1); i--; j--; }
    else if (d[i - 1][j] >= d[i][j - 1]) i--; else j--;
  }
  return { okIdx, matched: okIdx.size, total: n };
}
// 정답 문장을 글자마다 색으로 보여 준다 — 맞은 글자는 그대로, 틀리거나 빠뜨린 글자는 빨갛게
function dictationDiffHtml(answer, input) {
  const { okIdx } = dictationMarks(answer, input);
  let k = 0, out = '';
  for (const ch of String(answer)) {
    if (/\s/.test(ch)) { out += ' '; continue; }
    const good = okIdx.has(k); k++;
    out += good
      ? `<span style="color:var(--emerald)">${escHtml(ch)}</span>`
      : `<span style="color:var(--red);font-weight:800;border-bottom:2px solid var(--red)">${escHtml(ch)}</span>`;
  }
  return out;
}

// 음성 목록 미리 로드 (일부 브라우저 필요)
if (window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
    // [VOICE-READY-1] 목록이 늦게 왔을 때 이미 열려 있는 듣기 문항을 한 번 다시 그린다
    //   (목록이 없어 안내가 떴다면 소리 버튼으로, 정말 없다면 안내로 바뀐다)
    try {
      const q = STUDY_SESSION && STUDY_SESSION.questions[STUDY_SESSION.cur];
      if (q && q.audio && document.getElementById('study-body')) renderStudyQuestion();
    } catch (e) {}
  };
}

// ── 퀴즈 생성 + 진행 ────────────────────────────────
let VOCAB_QUIZ = { questions:[], cur:0, correct:0, wrongIds:[] };

// [ACH-GOLD-1] 업적 골드 — gamedata AchievementUtils.checkNew 가 주는 값과 같은 셈(reward.gold, 없으면 20)
function achRewardGold(a) { return (a && a.reward && a.reward.gold) || 20; }

// ── [SPLIT-1] 'study' — 원래 student.js 15405~15414줄 ──
// ══════════════════════════════════════════════════
//  오늘의 학습 (교과 문제 풀이) — DAILY-STUDY-1
//  · 하루 10문제. 학생이 과목을 고른다.
//  · 팝업 강제 방식을 폐기하고 홈 카드에서 학생이 눌러서 시작한다.
//  · 문항/채점은 curriculum.js(CurriculumUtils)를 그대로 쓴다.
//  · 기록은 problemRecords에 남기고, **고른 오답까지 저장**한다(혼동 진단용).
// ══════════════════════════════════════════════════

const STUDY_PER_DAY = 10;   // 하루 분량

// ── [SPLIT-1] 'mastery' — 원래 student.js 15652~16774줄 ──
// ══════════════════════════════════════════════════
//  [MASTERY-1] 문항별 숙달도(별 0~5)와 복습 주기
//  · 새로 저장하는 것이 없다. 이미 쌓이는 problemRecords(문항별 정답 여부 + 날짜)를
//    날짜순으로 재생해 문항마다 별과 '다음 복습일'을 계산한다 → 학생 스키마·백업 그대로.
//  · 규칙은 영어 복습앱과 같다: 맞으면 별 +1(최대 5), 틀리면 −1(최소 0),
//    다음 복습일 = 마지막으로 푼 날 + GAP[별]. 별 0은 GAP 0이라 늘 복습 대상이 된다.
//  · 보충(review:true) 기록은 뺀다(보상 집계와 같은 기준).
//  · 계산은 학생당 수 ms지만 매 렌더 반복은 낭비라 메모리에 캐시하고
//    기록이 바뀔 때(onDataChange)와 세션이 끝날 때만 버린다.
// ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════
//  [READING-1] 지문 세트 — 지문 1편에 문항 4개가 딸린다.
//  · 문항은 보통 문항과 같은 풀에 있다(cat 'read', passageId를 가짐).
//    그래야 숙달도·복습 주기·보상·기록·교사 학습 범위가 그대로 걸린다.
//  · 한 세션에 지문 세트는 하나만, 그리고 그 문항 4개는 연속으로 나온다
//    (중간에 다른 문제가 끼면 지문을 다시 읽어야 하므로).
//  · curriculum_reading.js가 없으면 지문 문항 자체가 없어 앱은 지금까지처럼 돈다.
// ══════════════════════════════════════════════════
function passageById(id) {
  if (typeof READING_PASSAGES === 'undefined' || !id) return null;
  return READING_PASSAGES.find(p => p.id === id) || null;
}
let _passageOpen = '';   // 지금 펼쳐 둔 지문 id — 같은 지문의 두 번째 문항부터는 접어 둔다
function togglePassage(id) {
  _passageOpen = (_passageOpen === id) ? '' : id;
  renderStudyQuestion();
}

const MASTERY_GAP = [0, 1, 2, 4, 7, 14];   // 별 0~5일 때 며칠 뒤에 다시 볼지
let _masteryCache = null, _masteryOwner = null;
function invalidateMastery() { _masteryCache = null; _masteryOwner = null; }
function addDaysStr(dateStr, n) {
  // [MASTERY-TZ-1] 날짜만 다루므로 UTC 로만 센다. 전에는 로컬 자정을 만들고 toISOString(UTC)으로 찍어
  //   KST(UTC+9)에서 항상 하루가 빠졌다 — 오늘 맞힌 문항이 오늘 바로 '복습'으로 떴다.
  const d = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(d)) return dateStr;
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function masteryMap(studentId) {
  const id = studentId || (typeof CUR !== 'undefined' && CUR ? CUR.id : '');
  if (_masteryCache && _masteryOwner === id) return _masteryCache;
  const m = new Map();
  try {
    const recs = (typeof DB.getProblemRecords === 'function' ? DB.getProblemRecords(id) : [])
      .concat(typeof asgMasteryRecords === 'function' ? asgMasteryRecords(id) : [])   // [CLASS-ASSIGN-1] 선생님 과제에서 낸 답도 별 · 복습에(student/assign.js · 하루 10문제 셈과 보상에는 안 들어감)
      .filter(r => r && !r.review && Array.isArray(r.answers))
      .sort((a, b) => String(a.date) < String(b.date) ? -1 : String(a.date) > String(b.date) ? 1 : 0);
    for (const r of recs) for (const a of r.answers) {
      if (!a || !a.problemId) continue;
      const p = m.get(a.problemId) || { lv: 0, last: '' };
      p.lv = a.correct ? Math.min(5, p.lv + 1) : Math.max(0, p.lv - 1);
      p.last = r.date || p.last;
      m.set(a.problemId, p);
    }
    for (const [, p] of m) p.next = p.last ? addDaysStr(p.last, MASTERY_GAP[p.lv]) : '';
  } catch (e) { /* 기록이 없거나 모양이 다르면 빈 채로 둔다 — 처음 쓰는 학생과 같다 */ }
  _masteryCache = m; _masteryOwner = id;
  return m;
}
// 한 번이라도 푼 문항인가 / 오늘 다시 볼 때가 됐는가
function masteryOf(problemId) { return masteryMap().get(problemId) || null; }
function isDueForReview(problemId) {
  const p = masteryMap().get(problemId);
  if (!p) return false;                       // 아직 안 푼 것은 '복습'이 아니라 '새 문항'
  return !p.next || p.next <= Utils.todayStr();
}
function starsText(lv) { return '★'.repeat(lv) + '☆'.repeat(5 - lv); }

// 교사가 켠 단원 안에서, 과목별로 오늘 복습할 문항 수 — 규칙은 학습 세션과 똑같이 건다
function dueCountsBySubject() {
  const active = CurriculumUtils.activeUnitIds();
  const out = [];
  for (const sub of CurriculumUtils.subjects()) {
    if (sub.key === 'english') continue;      // [ENGLISH-LINK-1] 영어는 영어앱으로
    let n = 0;
    for (const u of sub.units) {
      if (active && !active.includes(u.id)) continue;
      for (const p of CurriculumUtils.problemsByUnit(u.id)) if (isDueForReview(p.id)) n++;
    }
    if (n > 0) out.push({ key: sub.key, label: sub.label, icon: sub.icon, n });
  }
  return out;
}
// 단원 한 개의 별 평균과 복습 개수
function unitMastery(unitId) {
  const ps = CurriculumUtils.problemsByUnit(unitId);
  let sum = 0, seen = 0, due = 0;
  for (const p of ps) {
    const m = masteryOf(p.id);
    if (m) { sum += m.lv; seen++; if (isDueForReview(p.id)) due++; }
  }
  return { avg: seen ? Math.round(sum / seen) : 0, seen, due, total: ps.length };
}
let STUDY_SESSION = null;   // { subjectKey, questions[], cur, correct, answers[], cat?, review?, grade? }

// [STUDY-MODES-1] 문제 성격(cat)별 모드 — 영어앱의 연습 모드처럼 고르게 한다. null = 골고루
let STUDY_CAT = null;
const STUDY_MODES = {
  math:   [{ key: 'calc', icon: '🔢', label: '계산 연습' }, { key: 'word', icon: '📖', label: '문장제' }, { key: 'concept', icon: '💡', label: '개념' }],
  korean: [{ key: 'dictation', icon: '🔊', label: '받아쓰기' }, { key: 'vocab', icon: '📗', label: '낱말' },
           { key: 'spell', icon: '✏️', label: '맞춤법' }, { key: 'grammar', icon: '🧩', label: '문법' },
           { key: 'read', icon: '🧠', label: '생각하기' }],
  social: [{ key: 'concept', icon: '💡', label: '개념' }, { key: 'ox', icon: '⭕', label: 'OX 퀴즈' },
           { key: 'situation', icon: '🧭', label: '상황 판단' }, { key: 'reason', icon: '🔍', label: '따져보기' }, { key: 'apply', icon: '🧩', label: '적용' }],
};
const catOk = p => !STUDY_CAT || p.cat === STUDY_CAT;

// 보충(1~3학년, curriculum_review.js) — 파일이 없으면 모든 함수가 빈 값을 돌려준다
const Review = {
  on()            { return typeof REVIEW_CURRICULUM !== 'undefined' && typeof REVIEW_PROBLEMS !== 'undefined'; },
  grades()        { return this.on() ? Object.entries(REVIEW_CURRICULUM.math.grades).map(([g, v]) => ({ grade: g, ...v })) : []; },
  units(grade)    { const g = this.on() && REVIEW_CURRICULUM.math.grades[grade]; return g ? g.units : []; },
  unitById(id)    { for (const g of this.grades()) { const u = g.units.find(x => x.id === id); if (u) return { ...u, grade: g.grade, subjectLabel: `${g.label} 보충`, icon: '🧮' }; } return null; },
  problemsByUnit(id) { return this.on() ? REVIEW_PROBLEMS.filter(p => p.unitId === id) : []; },
  problemsByGrade(grade) { const ids = new Set(this.units(grade).map(u => u.id)); return this.on() ? REVIEW_PROBLEMS.filter(p => ids.has(p.unitId)) : []; },
};
// 단원 정보 — 교과(4-1) 먼저, 없으면 보충
function studyUnitInfo(unitId) { return CurriculumUtils.unitById(unitId) || Review.unitById(unitId); }

// 모드 칩 한 줄 (수학·사회·보충 공용). counts: {cat: n}
function studyModeChipsHTML(modes, counts, onclickFn) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const chip = (key, icon, label, n) => `
    <button class="st-chip ${STUDY_CAT === key ? 'on' : ''}" ${n ? '' : 'disabled'}
      onclick="${onclickFn}(${key ? `'${key}'` : 'null'})">${icon} ${label}<span class="st-chip-n">${n}</span></button>`;
  return `<div class="st-chips">${chip(null, '🎲', '골고루', total)}${modes.map(m => chip(m.key, m.icon, m.label, counts[m.key] || 0)).join('')}</div>`;
}

// 오늘 이 학생이 남긴 학습 기록
function getTodayStudyRecords(studentId) {
  if (typeof DB.getProblemRecords !== 'function') return [];
  const today = Utils.todayStr();
  return DB.getProblemRecords(studentId).filter(r => r && r.date === today);
}

// 홈에 붙는 "오늘의 학습" 카드
// [HOME-C-1] 세 조각(생각판 칸 · 우리 반 작품 · 오늘의 학습)을 홈 구역마다 따로 쓴다. 예전 이름은 셋을 이어 붙여 돌려준다.
function buildStudyCardHTML(s) {
  if (typeof CurriculumUtils === 'undefined') return buildThinkboardSlotHTML();
  return buildThinkboardSlotHTML() + buildArtCardHTML() + buildStudyTaskHTML(s);
}
function buildThinkboardSlotHTML() {
  return `<div class="home-thinkboard" style="display:contents">${thinkboardHomeCards()}</div>`;   // [THINKBOARD-HOME-1]
}
function buildArtCardHTML() {
  return `
    <div class="today-card" onclick="openArtFree('class')"
      style="cursor:pointer;grid-column:1/-1;border:1px solid rgba(200,150,46,.3);margin-top:.5rem">
      <div style="display:flex;align-items:center;gap:.6rem">
        <span style="font-size:1.4rem">🎨</span>
        <div style="flex:1">
          <div style="font-size:.85rem;font-weight:800;color:var(--gold)">우리 반 작품</div>
          <div style="font-size:.7rem;color:var(--txt3);margin-top:.15rem">그린 그림을 올리고 친구들 작품도 봐요</div>
        </div>
        <span style="color:var(--txt3)">▶</span>
      </div>
    </div>`;
}
function buildStudyTaskHTML(s) {
  if (typeof CurriculumUtils === 'undefined') return '';
  const recs  = getTodayStudyRecords(s.id);
  const done  = recs.reduce((n, r) => n + (r.total || 0), 0);
  const right = recs.reduce((n, r) => n + (r.correct || 0), 0);
  const cleared = done >= STUDY_PER_DAY;
  const pct = done > 0 ? Math.round(right / done * 100) : 0;

  // [ARTFREE-1] 그림 올리기는 집 탭 안쪽에 있어 아이들이 못 찾았다 — 홈에서 바로 들어가게 한다(→ buildArtCardHTML)
  return `
    <div class="today-card" onclick="openStudyModal()"
      style="cursor:pointer;grid-column:1/-1;border:1px solid ${cleared?'rgba(46,204,113,.35)':'rgba(255,215,0,.28)'}">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:.6rem">
        <div>
          <div style="font-size:.85rem;font-weight:800;color:${cleared?'var(--emerald)':'var(--gold)'}">
            ${cleared ? '📚 오늘 공부 끝!' : '📚 오늘의 학습'}
          </div>
          <div style="font-size:.7rem;color:var(--txt3);margin-top:.15rem">
            ${cleared
              ? `${done}문제 풀었어요 · 정답률 ${pct}%${(s.studyRewards||{})[Utils.todayStr()] ? ' · 🎁 보상 받음' : ''}`
              : `하루 ${STUDY_PER_DAY}문제 · ${done > 0 ? `${done}문제 했어요` : '아직 안 했어요'}${studyRewardCfg().enabled ? ` · 다 풀면 +${studyRewardCfg().exp}EXP` : ''}`}
          </div>
        </div>
        <div style="font-size:.72rem;padding:.3rem .7rem;border-radius:8px;flex-shrink:0;
          background:${cleared?'rgba(46,204,113,.15)':'var(--gold)'};
          color:${cleared?'var(--emerald)':'#1a1a1a'};font-weight:700">
          ${cleared ? '다시 풀기' : '시작하기'}
        </div>
      </div>
    </div>`;
}

// ── 과목 선택 ──────────────────────────────────────
function openStudyModal() {
  if (typeof CurriculumUtils === 'undefined') { toast('학습 자료를 불러오지 못했어요'); return; }
  openModal('m-study');
  renderStudySubjectPick();
}

function closeStudyModal() {
  // [STUDY-CLOSE-1] 푸는 중에 ✕ — 기록은 끝에서만 저장되므로 한 문제라도 풀었으면 먼저 물어본다
  const doneN = (STUDY_SESSION && STUDY_SESSION.answers) ? STUDY_SESSION.answers.length : 0;
  if (doneN > 0 && !confirm(`푼 문제 ${doneN}개가 사라져요. 그만할까요?`)) return;
  STUDY_SESSION = null;
  closeModal('m-study');
  renderAll();
}

// 단원별 성취도 — 내가 푼 기록에서 단원마다 몇 개 중 몇 개를 맞혔는지
//   answers[]가 있는 기록만 집계한다(단원 정보가 거기 들어 있음).
function getUnitStats(studentId) {
  if (typeof DB.getProblemRecords !== 'function') return {};
  const st = {};
  for (const r of DB.getProblemRecords(studentId).concat(typeof asgMasteryRecords === 'function' ? asgMasteryRecords(studentId) : [])) {   // [CLASS-ASSIGN-1]
    for (const a of (r.answers || [])) {
      if (!a || !a.unitId) continue;
      st[a.unitId] = st[a.unitId] || { t: 0, c: 0 };
      st[a.unitId].t++;
      if (a.correct) st[a.unitId].c++;
    }
  }
  return st;
}

// 성취도 → 색·라벨 (아이에게 순위가 아니라 상태를 보여준다)
function unitLevelOf(stat) {
  if (!stat || stat.t < 3) return { key: 'none',  color: 'var(--txt3)',   label: '아직 안 풀어봤어요', pct: null };
  const pct = Math.round(stat.c / stat.t * 100);
  if (pct >= 80) return { key: 'good', color: 'var(--emerald)', label: '잘하고 있어요', pct };
  if (pct >= 60) return { key: 'mid',  color: 'var(--gold)',    label: '조금만 더',     pct };
  return               { key: 'weak', color: 'var(--red)',     label: '더 연습해요',   pct };
}

function renderStudySubjectPick() {
  const body = document.getElementById('study-body');
  const ttl  = document.getElementById('study-title');
  if (!body) return;
  if (ttl) ttl.textContent = '오늘의 학습';

  const active = CurriculumUtils.activeUnitIds();   // 교사가 켠 단원(없으면 전체)
  const stats  = getUnitStats(CUR.id);
  const subjects = CurriculumUtils.subjects().map(sub => {
    const units = sub.units.filter(u => !active || active.includes(u.id));
    const count = units.reduce((n, u) => n + CurriculumUtils.problemsByUnit(u.id).length, 0);
    let t = 0, c = 0;
    units.forEach(u => { const s = stats[u.id]; if (s) { t += s.t; c += s.c; } });
    const weak = units.filter(u => unitLevelOf(stats[u.id]).key === 'weak').length;
    return { ...sub, units, count, t, c, weak };
  }).filter(sub => sub.count > 0 && sub.key !== 'english');   // [ENGLISH-LINK-1] 영어는 영어앱으로

  // [MASTERY-1] 오늘 복습할 것 — 과목별로 나눠 보여 주고, 누르면 그 과목의 복습 세션을 연다.
  //   과목을 섞지 않는다(기록·보상·문항 렌더가 과목 단위라 섞으면 집계가 흔들린다).
  const dueList = dueCountsBySubject();
  const dueTotal = dueList.reduce((n, d) => n + d.n, 0);
  const dueCard = dueTotal === 0 ? '' : `
          <div style="padding:.8rem 1.1rem;border-radius:14px;margin-bottom:.8rem;
            border:1px solid rgba(93,173,226,.4);background:rgba(93,173,226,.10)">
            <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.15rem">
              <span style="font-size:1.4rem">🔁</span>
              <span style="font-size:1.1rem;font-weight:800;color:var(--sky)">오늘 복습할 것 ${dueTotal}개</span>
            </div>
            <div style="font-size:.85rem;color:var(--txt3);margin-bottom:.6rem">한 번 푼 문제를 잊을 때쯤 다시 보여 줘요</div>
            <div class="st-due-row">
              ${dueList.map(d => `
                <button onclick="startStudySession('${d.key}','',true)"
                  style="display:flex;align-items:center;gap:.7rem;width:100%;padding:.7rem .9rem;border-radius:11px;
                    cursor:pointer;font-family:inherit;text-align:left;color:var(--txt);
                    background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12)">
                  <span style="font-size:1.3rem">${d.icon || '📘'}</span>
                  <span style="flex:1;font-weight:700">${escHtml(d.label)}</span>
                  <span style="font-weight:800;color:var(--sky)">${d.n}개</span>
                  <span style="color:var(--txt3)">▶</span>
                </button>`).join('')}
            </div>
          </div>`;

  // [ENGLISH-LINK-1] 외부 학습 앱 카드 — RPG 내부 문항 대신 전용 앱으로 보낸다.
  //   다음 앱(예: 데생)은 EXTERNAL_STUDY에 한 줄만 추가하면 된다. 순서 = 배열 순서.
  const EXTERNAL_STUDY = externalStudyItems().filter(x => x.study !== false);   // [WATERCOLOR-EMBED-1] 정의는 최상위 externalStudyItems() · [VILLAGE-DOOR-1] 마을은 뺀다
  // [UX-TRIM-G4] 과목이 먼저 — 외부 앱은 그 아래 '학습 앱' 묶음에 작은 타일(그림 · 이름)로. 설명은 title 로 남긴다
  const externalCards = EXTERNAL_STUDY.map(x => x.embed ? `
          <button class="st-app-tile" onclick="openExternalEmbed('${x.key}')" title="${escHtml(x.sub)}"
            style="border-color:${x.border};background:${x.bg}">
            <span class="st-app-ic">${x.icon}</span><span class="st-app-name">${escHtml(x.title)}</span>
          </button>` : `
          <a class="st-app-tile" href="${x.href}" target="_blank" rel="noopener" title="${escHtml(x.sub)}"
            style="border-color:${x.border};background:${x.bg}">
            <span class="st-app-ic">${x.icon}</span><span class="st-app-name">${escHtml(x.title)}</span>
          </a>`).join('');

  // [STUDY-MODES-1] 1~3학년 수학 보충 — 보상 없이 연습만. curriculum_review.js가 있을 때만 보인다
  const reviewCard = Review.on() ? `
          <button class="st-subject-card" onclick="renderReviewGradePick()"
            style="display:flex;align-items:center;gap:1rem;width:100%;padding:1.15rem 1.2rem;
              border:1px solid rgba(46,204,113,.35);cursor:pointer;background:rgba(46,204,113,.07);
              color:var(--txt);font-family:inherit;text-align:left">
            <span style="font-size:2.2rem">🧮</span>
            <span style="flex:1;min-width:0">
              <span class="st-subject" style="display:block;font-weight:700">1~3학년 수학 보충</span>
              <span class="st-subject-sub" style="display:block;color:var(--txt3);margin-top:.2rem">
                예전에 배운 것 다시 연습 · 보상은 없어요</span>
            </span>
            <span style="font-size:1.3rem;color:var(--txt3)">▶</span>
          </button>` : '';

  if (subjects.length === 0 && !externalCards && !reviewCard) {
    body.innerHTML = `<div style="text-align:center;padding:2rem 1rem;color:var(--txt3);font-size:1rem">
      선생님이 공부할 단원을 정하면 여기에 나와요</div>`;
    return;
  }

  const recs = getTodayStudyRecords(CUR.id);
  const done = recs.reduce((n, r) => n + (r.total || 0), 0);

  body.innerHTML = `
    <div style="padding:.2rem 1rem 1rem">
      <div class="st-meta" style="color:var(--txt3);margin-bottom:1.2rem;text-align:center">
        ${done >= STUDY_PER_DAY
          ? `오늘 ${done}문제 다 했어요. 더 풀고 싶으면 골라 보세요`
          : `오늘 ${STUDY_PER_DAY}문제 중 <b style="color:var(--gold)">${done}</b>문제 했어요`}
      </div>
      ${dueCard}
      <div class="st-subject-grid">
        ${subjects.map(sub => {
          const pct = sub.t >= 3 ? Math.round(sub.c / sub.t * 100) : null;
          return `
          <button class="st-subject-card" onclick="renderStudyUnitPick('${sub.key}')"
            style="display:flex;align-items:center;gap:1rem;width:100%;padding:1.15rem 1.2rem;
              border:1px solid rgba(255,255,255,.1);cursor:pointer;
              background:rgba(255,255,255,.05);color:var(--txt);font-family:inherit;text-align:left">
            <span style="font-size:2.2rem">${sub.icon || '📘'}</span>
            <span style="flex:1;min-width:0">
              <span class="st-subject" style="display:block;font-weight:700">${escHtml(sub.label)}</span>
              <span class="st-subject-sub" style="display:block;color:var(--txt3);margin-top:.2rem">
                ${sub.units.length}단원 · 문제 ${sub.count}개${pct !== null ? ` · 정답률 ${pct}%` : ''}
                ${sub.weak > 0 ? `<span style="color:var(--red)"> · 약한 단원 ${sub.weak}개</span>` : ''}
              </span>
            </span>
            <span style="font-size:1.3rem;color:var(--txt3)">▶</span>
          </button>`;
        }).join('')}
        ${reviewCard}
      </div>
      ${externalCards ? `
      <div class="st-app-head">학습 앱</div>
      <div class="st-app-grid">${externalCards}</div>` : ''}
    </div>`;
}

// ── 보충(1~3학년) 학년 → 단원 선택 ──
function renderReviewGradePick() {
  const body = document.getElementById('study-body');
  const ttl  = document.getElementById('study-title');
  if (!body || !Review.on()) { renderStudySubjectPick(); return; }
  if (ttl) ttl.textContent = '🧮 수학 보충 — 학년 고르기';
  const stats = getUnitStats(CUR.id);
  body.innerHTML = `
    <div style="padding:.2rem 1rem 1rem">
      <button onclick="renderStudySubjectPick()"
        style="background:none;border:none;color:var(--txt3);font-size:1rem;cursor:pointer;font-family:inherit;padding:0 0 .8rem">← 과목 다시 고르기</button>
      <div class="st-meta" style="color:var(--txt3);margin-bottom:.6rem">보충은 보상 없이 연습만 해요</div>
      <div style="display:grid;gap:.6rem">
        ${Review.grades().map(g => {
          const n = Review.problemsByGrade(g.grade).length;
          let t = 0, c = 0; g.units.forEach(u => { const st = stats[u.id]; if (st) { t += st.t; c += st.c; } });
          return `
          <button class="st-subject-card" onclick="renderReviewUnitPick('${g.grade}')"
            style="display:flex;align-items:center;gap:1rem;width:100%;padding:1.1rem 1.2rem;border-radius:14px;
              border:1px solid rgba(255,255,255,.12);cursor:pointer;background:rgba(255,255,255,.05);
              color:var(--txt);font-family:inherit;text-align:left">
            <span style="font-size:2rem">${['', '1️⃣', '2️⃣', '3️⃣'][+g.grade] || '🔢'}</span>
            <span style="flex:1;min-width:0">
              <span class="st-subject" style="display:block;font-weight:700">${escHtml(g.label)} 수학</span>
              <span class="st-subject-sub" style="display:block;color:var(--txt3);margin-top:.2rem">
                ${g.units.length}단원 · 문제 ${n}개${t ? ` · 정답률 ${Math.round(c / t * 100)}%` : ''}</span>
            </span>
            <span style="font-size:1.3rem;color:var(--txt3)">▶</span>
          </button>`;
        }).join('')}
      </div>
    </div>`;
}

function setReviewCat(grade, cat) { STUDY_CAT = cat; renderReviewUnitPick(grade); }

function renderReviewUnitPick(grade) {
  const body = document.getElementById('study-body');
  const ttl  = document.getElementById('study-title');
  if (!body || !Review.on()) { renderStudySubjectPick(); return; }
  const g = Review.grades().find(x => x.grade === String(grade));
  if (!g) { renderReviewGradePick(); return; }
  if (ttl) ttl.textContent = `🧮 ${g.label} 수학 — 단원 고르기`;
  if (STUDY_CAT && !STUDY_MODES.math.some(m => m.key === STUDY_CAT)) STUDY_CAT = null;
  const stats = getUnitStats(CUR.id);
  const all = Review.problemsByGrade(g.grade);
  const counts = {}; all.forEach(p => { counts[p.cat] = (counts[p.cat] || 0) + 1; });
  const units = g.units
    .map(u => ({ ...u, count: Review.problemsByUnit(u.id).filter(catOk).length, stat: stats[u.id] }))
    .filter(u => u.count > 0);
  body.innerHTML = `
    <div style="padding:.2rem 1rem 1rem">
      <button onclick="renderReviewGradePick()"
        style="background:none;border:none;color:var(--txt3);font-size:1rem;cursor:pointer;font-family:inherit;padding:0 0 .8rem">← 학년 다시 고르기</button>
      ${studyModeChipsHTML(STUDY_MODES.math, counts, `setReviewCat.bind(null,'${g.grade}')`)}
      <button onclick="startReviewSession('${g.grade}')"
        style="display:flex;align-items:center;gap:.8rem;width:100%;padding:1rem 1.2rem;margin-bottom:1rem;
          border-radius:14px;border:1px solid rgba(46,204,113,.35);cursor:pointer;
          background:rgba(46,204,113,.08);color:var(--txt);font-family:inherit;text-align:left">
        <span style="font-size:1.8rem">🎲</span>
        <span style="flex:1">
          <span style="display:block;font-size:1.15rem;font-weight:700;color:var(--emerald)">전체에서 골고루</span>
          <span style="display:block;font-size:.9rem;color:var(--txt3);margin-top:.15rem">${g.label} 모든 단원에서 ${STUDY_PER_DAY}문제</span>
        </span>
      </button>
      <div class="st-meta" style="color:var(--txt3);margin-bottom:.6rem">단원별로 풀기</div>
      <div style="display:grid;gap:.55rem">
        ${units.map(u => {
          const lv = unitLevelOf(u.stat);
          return `
          <button onclick="startReviewSession('${g.grade}','${u.id}')"
            style="display:flex;align-items:center;gap:.9rem;width:100%;padding:.95rem 1.1rem;border-radius:12px;cursor:pointer;
              font-family:inherit;text-align:left;color:var(--txt);background:rgba(255,255,255,.045);
              border:1px solid ${lv.key === 'weak' ? 'rgba(231,76,60,.35)' : 'rgba(255,255,255,.1)'}">
            <span style="flex:1;min-width:0">
              <span style="display:block;font-size:1.1rem;font-weight:700">${u.no}. ${escHtml(u.name)}</span>
              <span style="display:block;font-size:.82rem;color:var(--txt3);margin-top:.3rem">
                ${lv.label} · 문제 ${u.count}개${u.stat ? ` · ${u.stat.c}/${u.stat.t} 맞힘` : ''}</span>
              ${(() => {   // [MASTERY-1] 별 평균과 오늘 복습할 개수
                const mm = unitMastery(u.id);
                if (!mm.seen) return '';
                return `<span style="display:block;font-size:.82rem;margin-top:.25rem">
                  <span style="color:var(--gold);letter-spacing:.06em">${starsText(mm.avg)}</span>
                  <span style="color:var(--txt3)"> · ${mm.seen}/${mm.total}개 풀어 봤어요</span>
                  ${mm.due ? `<span style="color:var(--sky);font-weight:700"> · 복습 ${mm.due}개</span>` : ''}</span>`;
              })()}
            </span>
            <span style="font-size:1.2rem;color:var(--txt3)">▶</span>
          </button>`;
        }).join('')}
      </div>
    </div>`;
}

function startReviewSession(grade, unitId) {
  let pool = unitId ? Review.problemsByUnit(unitId) : Review.problemsByGrade(grade);
  pool = pool.filter(catOk);
  if (pool.length === 0) { toast('풀 수 있는 문제가 없어요'); return; }
  const picked = pickStudyQuestions(pool);
  STUDY_SESSION = { subjectKey: 'math', unitId: unitId || '', cat: STUDY_CAT, review: true, grade: String(grade),
    questions: picked, cur: 0, correct: 0, answers: [] };
  renderStudyQuestion();
}

// ── 단원 선택 — 내가 어느 단원을 모르는지 보면서 고른다 ──
function renderStudyUnitPick(subjectKey) {
  const body = document.getElementById('study-body');
  const ttl  = document.getElementById('study-title');
  if (!body) return;

  const sub = CurriculumUtils.subjects().find(s => s.key === subjectKey);
  if (!sub) { renderStudySubjectPick(); return; }
  if (ttl) ttl.textContent = `${sub.icon || '📘'} ${sub.label} — 단원 고르기`;

  const active = CurriculumUtils.activeUnitIds();
  const stats  = getUnitStats(CUR.id);
  // [STUDY-MODES-1] 이 과목에 모드가 있으면 칩을 보여주고, 고른 모드로 단원별 문제 수를 센다
  const modes = STUDY_MODES[subjectKey] || [];
  if (STUDY_CAT && !modes.some(m => m.key === STUDY_CAT)) STUDY_CAT = null;
  const counts = {};
  sub.units.filter(u => !active || active.includes(u.id))
    .forEach(u => CurriculumUtils.problemsByUnit(u.id).forEach(p => { counts[p.cat] = (counts[p.cat] || 0) + 1; }));
  const units  = sub.units
    .filter(u => !active || active.includes(u.id))
    .map(u => ({ ...u, count: CurriculumUtils.problemsByUnit(u.id).filter(catOk).length, stat: stats[u.id] }))
    .filter(u => u.count > 0);

  body.innerHTML = `
    <div style="padding:.2rem 1rem 1rem">
      <button onclick="renderStudySubjectPick()"
        style="background:none;border:none;color:var(--txt3);font-size:1rem;cursor:pointer;
          font-family:inherit;padding:0 0 .8rem">← 과목 다시 고르기</button>
      ${modes.length ? studyModeChipsHTML(modes, counts, `setStudyCat.bind(null,'${subjectKey}')`) : ''}

      <button onclick="startStudySession('${subjectKey}')"
        style="display:flex;align-items:center;gap:.8rem;width:100%;padding:1rem 1.2rem;margin-bottom:1rem;
          border-radius:14px;border:1px solid rgba(255,215,0,.35);cursor:pointer;
          background:rgba(255,215,0,.1);color:var(--txt);font-family:inherit;text-align:left">
        <span style="font-size:1.8rem">🎲</span>
        <span style="flex:1">
          <span style="display:block;font-size:1.15rem;font-weight:700;color:var(--gold)">전체에서 골고루</span>
          <span style="display:block;font-size:.9rem;color:var(--txt3);margin-top:.15rem">
            모든 단원에서 섞어서 ${STUDY_PER_DAY}문제</span>
        </span>
      </button>

      <div class="st-meta" style="color:var(--txt3);margin-bottom:.6rem">단원별로 풀기</div>
      <div style="display:grid;gap:.55rem">
        ${units.map(u => {
          const lv = unitLevelOf(u.stat);
          const bar = lv.pct !== null ? lv.pct : 0;
          return `
          <button onclick="startStudySession('${subjectKey}','${u.id}')"
            style="display:flex;align-items:center;gap:.9rem;width:100%;padding:.95rem 1.1rem;
              border-radius:12px;cursor:pointer;font-family:inherit;text-align:left;color:var(--txt);
              border:1px solid ${lv.key === 'weak' ? 'rgba(231,76,60,.35)' : 'rgba(255,255,255,.1)'};
              background:rgba(255,255,255,.045)">
            <span style="flex:1;min-width:0">
              <span style="display:block;font-size:1.1rem;font-weight:700">
                ${u.no}. ${escHtml(u.name)}</span>
              <span style="display:flex;align-items:center;gap:.5rem;margin-top:.45rem">
                <span style="flex:1;height:6px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden">
                  <span style="display:block;height:100%;width:${bar}%;border-radius:6px;background:${lv.color}"></span>
                </span>
                <span style="font-size:.85rem;color:${lv.color};flex-shrink:0;font-weight:700">
                  ${lv.pct !== null ? lv.pct + '%' : '—'}</span>
              </span>
              <span style="display:block;font-size:.82rem;color:var(--txt3);margin-top:.3rem">
                ${lv.label} · 문제 ${u.count}개${u.stat ? ` · ${u.stat.c}/${u.stat.t} 맞힘` : ''}</span>
              ${(() => {   // [MASTERY-1] 별 평균과 오늘 복습할 개수
                const mm = unitMastery(u.id);
                if (!mm.seen) return '';
                return `<span style="display:block;font-size:.82rem;margin-top:.25rem">
                  <span style="color:var(--gold);letter-spacing:.06em">${starsText(mm.avg)}</span>
                  <span style="color:var(--txt3)"> · ${mm.seen}/${mm.total}개 풀어 봤어요</span>
                  ${mm.due ? `<span style="color:var(--sky);font-weight:700"> · 복습 ${mm.due}개</span>` : ''}</span>`;
              })()}
            </span>
            <span style="font-size:1.2rem;color:var(--txt3)">▶</span>
          </button>`;
        }).join('')}
      </div>
    </div>`;
}

// ── 세션 시작 ──────────────────────────────────────
function setStudyCat(subjectKey, cat) { STUDY_CAT = cat; renderStudyUnitPick(subjectKey); }

function startStudySession(subjectKey, unitId, onlyDue) {
  // [MASTERY-DUE-1] 복습 카드의 숫자는 모드와 상관없이 센다 → 복습 세션도 모드를 풀고 연다.
  //   전에는 다른 과목에서 고른 모드(받아쓰기 등)가 남아 "수학 6개"를 눌러도 0문제가 됐다.
  if (onlyDue) STUDY_CAT = null;
  const active = CurriculumUtils.activeUnitIds();
  let pool = unitId
    ? CurriculumUtils.problemsByUnit(unitId)       // 단원 하나만 골라 풀기
    : CurriculumUtils.problemsBySubject(subjectKey);
  if (active) pool = pool.filter(p => active.includes(p.unitId));
  pool = pool.filter(catOk);                       // [STUDY-MODES-1] 고른 모드만
  // [MASTERY-1] 복습 세션 — 오늘 다시 볼 때가 된 것만. 그 밖의 규칙(하루 분량·학습 범위·
  //   모드·보상)은 보통 세션과 똑같이 간다. 새 보상 경로를 만들지 않는다.
  if (onlyDue) {
    const due = pool.filter(p => isDueForReview(p.id));
    if (due.length === 0) { toast('오늘 복습할 것을 다 했어요'); renderStudySubjectPick(); return; }
    pool = due;
  }
  if (pool.length === 0) { toast('풀 수 있는 문제가 없어요'); return; }
  const picked = pickStudyQuestions(pool);
  STUDY_SESSION = {
    subjectKey,
    unitId: unitId || '',   // 단원 지정이면 결과 화면에서 그 단원으로 되돌아간다
    cat: STUDY_CAT,
    questions: picked,
    cur: 0,
    correct: 0,
    answers: [],       // { problemId, unitId, chosen, correct } — 고른 오답까지 저장
  };
  renderStudyQuestion();
}

// 풀에서 하루 분량을 뽑는다 — 교과·보충 공용
function pickStudyQuestions(pool) {
  // 최근에 틀린 문제를 자주 나오게(단어장 복습 가중치와 같은 방식)
  //  [CLASS-ASSIGN-1] 선생님 과제 기록(id prob_<날짜>_…_asg_…)도 키 차례(= 날짜 차례)로 섞어 '최근 8건'을 고른다
  const _asg = typeof asgMasteryRecords === 'function' ? asgMasteryRecords(CUR.id) : [];
  const recent = (_asg.length ? DB.getProblemRecords(CUR.id).concat(_asg).sort((a, b) => String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0) : DB.getProblemRecords(CUR.id)).slice(-8);
  const wrongIds = new Set(recent.flatMap(r => r.wrongIds || []));
  const weighted = [];
  pool.forEach(p => {
    const times = wrongIds.has(p.id) ? 3 : 1;
    for (let i = 0; i < times; i++) weighted.push(p);
  });

  // [MASTERY-1] 순위를 얹는다 — 0: 복습일이 지난 것, 1: 아직 안 푼 것, 2: 다음에 볼 것.
  //   가중 배열(최근 오답 ×3)은 그대로 두고, 섞은 뒤 순위로만 안정 정렬해서
  //   같은 순위 안에서는 지금까지의 무작위·가중 순서가 유지되게 한다.
  const _today = Utils.todayStr();
  const rankOf = p => {
    const m = masteryOf(p.id);
    if (!m) return 1;
    return (m.next && m.next > _today) ? 2 : 0;
  };
  const picked = [];
  const used = new Set();
  const shuffled = weighted.sort(() => Math.random() - .5).sort((a, b) => rankOf(a) - rankOf(b));
  for (const p of shuffled) {
    if (picked.length >= STUDY_PER_DAY) break;
    if (!used.has(p.id)) { picked.push(p); used.add(p.id); }
  }
  // 가중 배열에서 못 채우면 나머지로 보충(여기서도 복습일이 지난 것을 먼저)
  for (const p of pool.slice().sort((a, b) => rankOf(a) - rankOf(b))) {
    if (picked.length >= STUDY_PER_DAY) break;
    if (!used.has(p.id)) { picked.push(p); used.add(p.id); }
  }
  return orderPassageSets(picked, pool);
}

// [READING-1] 지문 세트 정리 — 세트는 한 세션에 하나만 두고, 그 문항들은 연속으로 놓는다.
//   복습(onlyDue)으로 세트 중 일부만 뽑혔으면 그 문항만 지문과 함께 낸다(보스 승인).
function orderPassageSets(picked, pool) {
  const setOf = p => p && p.passageId ? p.passageId : '';
  const sets = [...new Set(picked.map(setOf).filter(Boolean))];
  if (sets.length === 0) return picked;
  const keep = sets[0];                                   // 남길 세트 하나
  let out = picked.filter(p => !setOf(p) || setOf(p) === keep);
  // 빠진 만큼 지문 없는 문항으로 채운다
  const used = new Set(out.map(p => p.id));
  for (const p of pool) {
    if (out.length >= picked.length) break;
    if (!used.has(p.id) && !setOf(p)) { out.push(p); used.add(p.id); }
  }
  // 남긴 세트의 문항을 한자리에 모은다(첫 번째가 있던 자리에, 세트 안에서는 원래 순서대로)
  const setItems = out.filter(p => setOf(p) === keep)
    .sort((a, b) => String(a.id) < String(b.id) ? -1 : 1);
  const rest = out.filter(p => setOf(p) !== keep);
  const at = out.findIndex(p => setOf(p) === keep);
  rest.splice(Math.max(0, Math.min(at, rest.length)), 0, ...setItems);
  return rest;
}

function renderStudyQuestion() {
  const body = document.getElementById('study-body');
  const ttl  = document.getElementById('study-title');
  if (!body || !STUDY_SESSION) return;
  const { questions, cur } = STUDY_SESSION;
  if (cur >= questions.length) { finishStudySession(); return; }

  const p = questions[cur];
  const unit = studyUnitInfo(p.unitId);
  if (ttl) ttl.textContent = `${unit?.icon || '📚'} ${cur + 1} / ${questions.length}`;
  // [FIG-1] 그림이 있는 문항은 문제 위에 그린다(렌더러 없거나 모르는 kind면 빈 문자열)
  const figHtml = (p.fig && typeof Figures !== 'undefined') ? Figures.render(p.fig) : '';

  // 진행 막대 — 몇 문제 남았는지 한눈에
  const bar = `
    <div style="margin:0 1rem .9rem">
      <div class="st-bar"><i style="width:${Math.round(cur / questions.length * 100)}%"></i></div>
      <div style="display:flex;justify-content:space-between;margin-top:.35rem">
        <span style="font-size:.85rem;color:var(--txt3)">${'⭐'.repeat(Math.min(cur, 10))}</span>
        <span style="font-size:.85rem;color:var(--txt3)">${questions.length - cur}문제 남았어요</span>
      </div>
    </div>`;

  let inputHtml = '';
  const isOX = p.type === 'choice' && (p.cat === 'ox' || ((p.choices || []).length === 2 && (p.choices || []).every(c => c === 'O' || c === 'X')));
  if (isOX) {
    // [SOCIAL-TYPES-1] OX는 섞지 않고 좌우 큰 버튼 두 개
    inputHtml = `<div class="st-ox">
      <button class="st-opt st-ox-btn" onclick="submitStudyAnswer('O')"><span class="st-ox-mark">⭕</span>맞아요</button>
      <button class="st-opt st-ox-btn x" onclick="submitStudyAnswer('X')"><span class="st-ox-mark">❌</span>틀려요</button>
    </div>`;
  } else if (p.type === 'choice') {
    const opts = [...(p.choices || [])].sort(() => Math.random() - .5);
    inputHtml = `<div style="display:grid;gap:.6rem">
      ${opts.map(c => `
        <button class="st-opt" onclick="submitStudyAnswer(${JSON.stringify(String(c)).replace(/"/g, '&quot;')})"
          style="width:100%;cursor:pointer;font-family:inherit;
            border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);
            color:var(--txt);text-align:left;word-break:keep-all">${escHtml(String(c))}</button>`).join('')}
    </div>`;
  } else if (p.type === 'fraction') {
    // [FRACTION-INPUT-1] 분수 입력칸 — 자연수·분자·분모 세 칸, 모두 숫자 키패드(태블릿에서 / 와 '와'를 칠 일이 없게).
    //   자연수 칸은 비워도 된다(진분수). 제출값은 지금 기록과 같은 문자열('4와 2/5')로 만든다 → 기록 모양 그대로.
    const box = 'width:3.6rem;text-align:center;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.25);color:var(--txt);font-family:inherit;outline:none;font-size:1.4rem;padding:.45rem 0;border-radius:10px';
    const key = `onkeydown="if(event.key==='Enter'&&!event.isComposing)submitFractionInputs()"`;
    inputHtml = `
      <div class="st-frac" style="display:flex;align-items:center;justify-content:center;gap:.7rem;flex-wrap:wrap">
        <label style="display:flex;flex-direction:column;align-items:center;gap:.25rem">
          <input id="study-fw" inputmode="numeric" autocomplete="off" maxlength="3" ${key} style="${box};height:4.2rem" aria-label="자연수">
          <span style="font-size:.8rem;color:var(--txt3)">자연수</span></label>
        <div style="display:flex;flex-direction:column;align-items:center;gap:.3rem">
          <input id="study-fn" inputmode="numeric" autocomplete="off" maxlength="3" ${key} style="${box}" aria-label="분자">
          <div style="width:4.2rem;height:3px;background:var(--txt);border-radius:2px"></div>
          <input id="study-fd" inputmode="numeric" autocomplete="off" maxlength="3" ${key} style="${box}" aria-label="분모">
        </div>
        <button class="st-btn" onclick="submitFractionInputs()"
          style="border:none;background:var(--gold);color:#1a1a1a;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0">확인</button>
      </div>
      <div style="text-align:center;font-size:.85rem;color:var(--txt3);margin-top:.5rem">진분수면 자연수 칸은 비워 두세요</div>`;
  } else {
    const ph = p.type === 'number' ? '숫자를 입력하세요' : '답을 입력하세요';
    const mode = p.type === 'number' ? 'inputmode="numeric"' : '';
    inputHtml = `
      <div style="display:flex;gap:.5rem">
        <input id="study-input" class="st-input" ${mode} placeholder="${ph}" autocomplete="off"
          onkeydown="if(event.key==='Enter'&&!event.isComposing)submitStudyAnswer(this.value)"
          style="flex:1;border:1px solid rgba(255,255,255,.14);
            background:rgba(0,0,0,.25);color:var(--txt);font-family:inherit;outline:none">
        <button class="st-btn" onclick="submitStudyAnswer(document.getElementById('study-input').value)"
          style="border:none;background:var(--gold);color:#1a1a1a;font-weight:700;
            cursor:pointer;font-family:inherit;flex-shrink:0">확인</button>
      </div>`;
  }

  // 듣기 문항 — audio가 있으면 소리 버튼을 크게 띄우고 자동으로 한 번 읽어 준다
  // [KOREAN-B] 국어(받아쓰기)는 한국어로, 또박또박(0.8) 읽는다. 기기에 그 언어 음성이 없으면 안내하고 건너뛴다.
  const pLang = problemLang(p);
  const speakOpt = JSON.stringify({ lang: pLang, rate: p.cat === 'dictation' ? 0.8 : 0.85 }).replace(/"/g, '&quot;');
  // 안내·건너뛰기는 한국어 문항에만 적용한다 — 영어 듣기 문항의 동작은 지금까지와 똑같이 둔다(회귀 0)
  const noVoice = p.audio && String(pLang).startsWith('ko') && !hasVoiceFor(pLang);
  const audioHtml = !p.audio ? '' : noVoice ? `
    <div style="text-align:center;margin-bottom:1.4rem;background:rgba(255,255,255,.05);border-radius:12px;padding:1.1rem">
      <div style="font-size:1.6rem">🔇</div>
      <div style="font-weight:700;margin:.4rem 0">이 기기에서는 ${pLang.startsWith('ko') ? '한국어' : '영어'} 소리가 나오지 않아요</div>
      <div style="font-size:.92rem;color:var(--txt3);margin-bottom:.8rem">선생님께 알려 주세요. 이 문제는 건너뛰어도 돼요.</div>
      <button onclick="nextStudyQuestion()" style="border:1px solid rgba(255,255,255,.2);background:none;color:var(--txt2);
        border-radius:10px;padding:.55rem 1.1rem;cursor:pointer;font-family:inherit">이 문제 건너뛰기</button>
    </div>` : `
    <div style="text-align:center;margin-bottom:1.4rem">
      <button onclick="speakWord(${JSON.stringify(String(p.audio)).replace(/"/g, '&quot;')}, ${speakOpt})"
        style="display:inline-flex;align-items:center;gap:.6rem;padding:1.1rem 2rem;border-radius:16px;
          border:1px solid rgba(93,173,226,.4);background:rgba(93,173,226,.14);color:var(--sky);
          font-family:inherit;font-size:1.25rem;font-weight:700;cursor:pointer">
        <span style="font-size:1.8rem">🔊</span> 다시 듣기
      </button>
      <div style="font-size:.9rem;color:var(--txt3);margin-top:.6rem">잘 안 들리면 버튼을 눌러 보세요</div>
    </div>`;

  // [READING-1] 지문 카드 — 40vh까지만 쓰고 넘치면 그 안에서 스크롤한다(태블릿 세로 대비).
  //   같은 지문의 두 번째 문항부터는 접어 두고 "지문 다시 보기"로 펼친다.
  const _psg = p.passageId ? passageById(p.passageId) : null;
  if (_psg && !STUDY_SESSION._psgSeen) {
    _passageOpen = _psg.id; STUDY_SESSION._psgSeen = _psg.id;   // 그 지문의 첫 문항은 펼쳐서 보여 준다
  }
  const _psgOpen = _psg && _passageOpen === _psg.id;
  const passageHtml = !_psg ? '' : `
    <div style="border:1px solid rgba(93,173,226,.35);background:rgba(93,173,226,.07);
      border-radius:14px;padding:.9rem 1rem;margin-bottom:1.1rem">
      <button type="button" onclick="togglePassage('${_psg.id}')"
        style="display:flex;align-items:center;gap:.5rem;width:100%;background:none;border:none;
          padding:0;cursor:pointer;color:var(--sky);font-family:inherit;font-size:1rem;font-weight:700;text-align:left">
        <span>📖</span><span style="flex:1">${escHtml(_psg.title || '지문')}</span>
        <span style="font-size:.85rem;color:var(--txt3);font-weight:600">${_psgOpen ? '접기 ▲' : '지문 다시 보기 ▼'}</span>
      </button>
      ${_psgOpen ? `<div style="max-height:40vh;overflow-y:auto;margin-top:.7rem;
        font-size:1.05rem;line-height:1.8;color:var(--txt2);white-space:pre-wrap;word-break:keep-all">${escHtml(_psg.text || '')}</div>` : ''}
    </div>`;

  // 수학은 세로셈·자리 계산을 손으로 써 봐야 풀린다. 문제 아래에 필기 공간을 둔다.
  // 저장하지 않는다 — 그 문제를 푸는 동안만 쓰는 연습장이고, 다음 문제로 넘어가면 새 종이가 된다.
  const scratchHtml = STUDY_SESSION.subjectKey === 'math' ? `
    <div class="st-scratch">
      <div class="st-scratch-head">
        <span>✏️ 여기에 풀어 보세요</span>
        <button type="button" class="st-scratch-clear" onclick="clearStudyScratch()">🧹 지우기</button>
      </div>
      <canvas id="study-scratch"></canvas>
    </div>` : '';

  body.innerHTML = `
    ${bar}
    <div style="padding:0 1rem 1rem">
      <div class="st-meta" style="color:var(--txt3);margin-bottom:.8rem">
        ${escHtml(unit?.subjectLabel || '')} · ${escHtml(unit?.name || '')}
      </div>
      ${figHtml ? `<div class="st-fig">${figHtml}</div>` : ''}
      ${passageHtml}
      <!-- [STUDY-Q-NEWLINE-1] 물음의 줄바꿈(자료 줄 ↔ 묻는 말)을 살린다. pre-line이라 앞뒤 공백 없이 붙여 쓴다 -->
      <div class="st-q" style="margin-bottom:${p.audio ? '1rem' : '1.6rem'};white-space:pre-line">${escHtml(p.q)}</div>
      ${audioHtml}
      ${scratchHtml}
      ${inputHtml}
      ${p.hint ? `<button onclick="this.nextElementSibling.style.display='block';this.style.display='none'"
        style="margin-top:1rem;background:none;border:none;color:var(--txt3);font-size:1rem;
          cursor:pointer;font-family:inherit;text-decoration:underline">힌트 보기</button>
        <div class="st-hint" style="display:none;margin-top:.7rem;color:var(--sky);
          background:rgba(93,173,226,.1);padding:.8rem 1rem;border-radius:10px;word-break:keep-all">
          💡 ${escHtml(p.hint)}</div>` : ''}
    </div>`;

  initStudyScratch();
  const inp = document.getElementById('study-input') || document.getElementById('study-fw');
  if (inp) setTimeout(() => inp.focus(), 60);
  // 듣기 문항은 화면이 뜨면 한 번 자동으로 읽어 준다(학생이 버튼을 못 찾는 것 방지)
  if (p.audio && typeof speakWord === 'function' && !(String(problemLang(p)).startsWith('ko') && !hasVoiceFor(problemLang(p))))
    setTimeout(() => speakWord(String(p.audio), { lang: problemLang(p), rate: p.cat === 'dictation' ? 0.8 : 0.85 }), 350);
}

// ── 풀이 연습장(수학) ──────────────────────────────
// 손으로 세로셈을 쓰는 공간. 기능은 둘뿐이다 — 필기 · 지우기.
// 저장하지 않고, 문제를 넘기면(renderStudyQuestion 재렌더) 새 종이가 된다.
let SCRATCH_CTX = null;       // 현재 연습장 2D 컨텍스트
let SCRATCH_ONRESIZE = null;  // 창 크기 변경 핸들러(중복 등록 방지용)

function initStudyScratch() {
  const cv = document.getElementById('study-scratch');
  if (!cv) { SCRATCH_CTX = null; return; }

  // 캔버스 실제 픽셀을 화면 배율(dpr)에 맞춘다. 안 맞추면 선이 흐리게 번진다.
  const fit = () => {
    const el = document.getElementById('study-scratch');
    if (!el) {  // 학습 화면을 떠났으면 핸들러를 걷어낸다
      if (SCRATCH_ONRESIZE) { window.removeEventListener('resize', SCRATCH_ONRESIZE); SCRATCH_ONRESIZE = null; }
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    const ctx = el.getContext('2d');   // 같은 캔버스면 항상 같은 컨텍스트가 돌아온다
    // 크기가 그대로면 그린 것을 건드리지 않는다.
    // 다만 쓸 수 있는 상태로는 만들어 놓고 나간다(안 그러면 필기가 먹힌다).
    if (el.width === pw && el.height === ph) { SCRATCH_CTX = ctx; return; }
    const prev = (el.width && el.height) ? el.toDataURL() : null;
    el.width = pw; el.height = ph;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = 2.6; ctx.strokeStyle = '#2B3A55'; ctx.fillStyle = '#2B3A55';
    SCRATCH_CTX = ctx;
    // 크기가 바뀌어도 쓰던 풀이는 살려 둔다
    if (prev) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, w, h); img.src = prev; }
  };
  fit();

  if (SCRATCH_ONRESIZE) window.removeEventListener('resize', SCRATCH_ONRESIZE);
  SCRATCH_ONRESIZE = fit;
  window.addEventListener('resize', SCRATCH_ONRESIZE);

  // 마우스·손가락·스타일러스를 한 갈래로 받는다(pointer 이벤트)
  let drawing = false, lx = 0, ly = 0;
  const at = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  cv.onpointerdown = e => {
    if (!SCRATCH_CTX) return;
    drawing = true;
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    [lx, ly] = at(e);
    SCRATCH_CTX.beginPath();                                  // 톡 찍기만 해도 점이 남게
    SCRATCH_CTX.arc(lx, ly, SCRATCH_CTX.lineWidth / 2, 0, Math.PI * 2);
    SCRATCH_CTX.fill();
    e.preventDefault();
  };
  cv.onpointermove = e => {
    if (!drawing || !SCRATCH_CTX) return;
    const [x, y] = at(e);
    SCRATCH_CTX.beginPath();
    SCRATCH_CTX.moveTo(lx, ly); SCRATCH_CTX.lineTo(x, y); SCRATCH_CTX.stroke();
    lx = x; ly = y;
    e.preventDefault();
  };
  const stop = e => {
    if (!drawing) return;
    drawing = false;
    try { cv.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  cv.onpointerup = stop;
  cv.onpointercancel = stop;
}

function clearStudyScratch() {
  const cv = document.getElementById('study-scratch');
  if (!cv) return;
  const ctx = SCRATCH_CTX || cv.getContext('2d');
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);   // dpr 변환을 잠시 몰아내고 캔버스 전체를 지운다
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.restore();
}

function submitStudyAnswer(chosen) {
  if (!STUDY_SESSION) return;
  const p = STUDY_SESSION.questions[STUDY_SESSION.cur];
  if (!p) return;
  const val = String(chosen == null ? '' : chosen).trim();
  if (!val) { toast('답을 입력해 주세요'); return; }

  // [KOREAN-B] 받아쓰기는 띄어쓰기를 따로 보므로 전용 채점을 쓴다. 다른 문항은 지금까지와 같다.
  const dict = (p.cat === 'dictation') ? dictationGrade(p, val) : null;
  const ok = dict ? dict.ok : CurriculumUtils.isCorrect(p, val);
  if (ok) STUDY_SESSION.correct++;
  // [MASTERY-1] 이 문제의 별이 어떻게 바뀌는지 — 화면에 보여 주려고 미리 계산해 둔다
  //   (실제 저장은 세션이 끝날 때 problemRecords로 남고, 별은 거기서 다시 계산된다)
  const _mBefore = (masteryOf(p.id) || { lv: 0 }).lv;
  STUDY_SESSION.starBefore = _mBefore;
  STUDY_SESSION.starAfter = ok ? Math.min(5, _mBefore + 1) : Math.max(0, _mBefore - 1);
  // 고른 답을 그대로 남긴다 — 무엇과 헷갈리는지 나중에 볼 수 있게
  STUDY_SESSION.answers.push({ problemId: p.id, unitId: p.unitId, chosen: val, correct: ok });
  showStudyFeedback(p, val, ok);
}

// [FRACTION-INPUT-1] 분수 칸 세 개 → '4와 2/5' 문자열로 제출. 빈 칸·분모 0은 제출 전에 알려 준다.
function fractionJosa(w) { return /[013678]$/.test(String(w)) ? '과' : '와'; }   // 일·삼·육·칠·팔·십(영)은 받침 → 과
function submitFractionInputs() {
  const g = id => ((document.getElementById(id) || {}).value || '').replace(/[^0-9０-９]/g, '');
  const w = g('study-fw'), n = g('study-fn'), d = g('study-fd');
  if (!n && !d) { if (w) submitStudyAnswer(w); else toast('답을 입력해 주세요'); return; }
  if (!n) { toast('분자를 써 주세요'); return; }
  if (!d || Number(d) === 0) { toast('분모를 써 주세요'); return; }
  submitStudyAnswer(w && Number(w) > 0 ? `${w}${fractionJosa(w)} ${n}/${d}` : `${n}/${d}`);
}

// 틀렸을 때 정답을 바로 보여준다(교정 피드백)
function showStudyFeedback(p, chosen, ok) {
  const body = document.getElementById('study-body');
  if (!body) return;
  const last = STUDY_SESSION.cur >= STUDY_SESSION.questions.length - 1;
  // [KOREAN-B] 받아쓰기 — 어디를 틀렸는지 글자로 짚어 준다(맞은 글자는 초록, 틀리거나 빠뜨린 글자는 빨강)
  if (p.cat === 'dictation') {
    const g = dictationGrade(p, chosen), m = dictationMarks(p.a, chosen);
    body.innerHTML = `
      <div class="st-center" style="padding:1.2rem 1rem;text-align:center">
        <div class="st-emoji ${ok ? '' : 'wrong'}" style="margin-bottom:.5rem">${ok ? '🎉' : '🤔'}</div>
        <div style="font-size:1.4rem;font-weight:800;color:${ok ? 'var(--emerald)' : 'var(--red)'};margin-bottom:.3rem">
          ${ok ? '맞았어요!' : '아쉬워요'}</div>
        <div style="font-size:1rem;color:var(--txt3);margin-bottom:1.1rem">맞은 글자 ${m.matched} / ${m.total}</div>
        <div style="background:rgba(255,255,255,.05);border-radius:12px;padding:1.1rem 1.2rem;text-align:left">
          <div style="font-size:.92rem;color:var(--txt3)">내가 쓴 것</div>
          <div style="font-size:1.2rem;margin-bottom:.9rem;word-break:keep-all">${escHtml(String(chosen))}</div>
          <div style="font-size:.92rem;color:var(--txt3)">정답</div>
          <div style="font-size:1.45rem;font-weight:700;letter-spacing:.02em;word-break:keep-all">${dictationDiffHtml(p.a, chosen)}</div>
          ${!g.spaceOk ? `<div style="font-size:.95rem;color:var(--gold);margin-top:.9rem">
            ✏️ 글자는 ${g.charOk ? '모두 맞았어요' : '위를 보세요'}. 띄어쓰기가 정답과 달라요${DICTATION_STRICT_SPACING ? '' : ' (점수에는 넣지 않았어요)'}.</div>` : ''}
        </div>
        <button class="st-btn" onclick="nextStudyQuestion()"
          style="width:100%;margin-top:1.2rem;border:none;background:var(--gold);color:#1a1a1a;
            font-weight:700;cursor:pointer;font-family:inherit">${last ? '결과 보기' : '다음 문제'}</button>
      </div>`;
    return;
  }
  body.innerHTML = `
    <div class="st-center" style="padding:1.2rem 1rem;text-align:center">
      <div class="st-emoji ${ok ? '' : 'wrong'}" style="margin-bottom:.6rem">${ok ? '🎉' : '🤔'}</div>
      <div style="font-size:1.5rem;font-weight:800;color:${ok ? 'var(--emerald)' : 'var(--red)'};margin-bottom:1.2rem">
        ${ok ? '맞았어요!' : '아쉬워요'}
      </div>
      ${ok && p.type === 'fraction' && CurriculumUtils.fractionMatch(p, chosen) === 'equal' ? (() => {
        // [FRACTION-INPUT-1] 값은 맞았지만 모양이 다를 때 — 맞았다고 하고, 정답 모양을 보여 준다
        const u = CurriculumUtils.parseFraction(chosen) || {};
        const msg = (u.n >= u.d) ? '대분수로 바꿔 써 볼까요?' : '문제에서 쓰는 모양으로도 써 봐요.';
        return `<div style="background:rgba(255,215,0,.08);border-radius:12px;padding:.9rem 1.1rem;margin-bottom:1.1rem;text-align:left;word-break:keep-all">
          <div style="font-size:1.05rem;color:var(--gold);font-weight:700">값이 같아요! ${msg}</div>
          <div style="font-size:.95rem;color:var(--txt3);margin-top:.35rem">내가 쓴 답 ${escHtml(chosen)} → 정답 모양 <b style="color:var(--emerald);font-size:1.15rem">${escHtml(String(p.a))}</b></div></div>`;
      })() : ''}
      ${!ok ? `
        <div style="background:rgba(255,255,255,.05);border-radius:12px;padding:1.1rem 1.2rem;
          margin-bottom:1.2rem;text-align:left">
          <div style="font-size:.95rem;color:var(--txt3)">내가 쓴 답</div>
          <div style="font-size:1.25rem;color:var(--red);margin-bottom:.9rem">${escHtml(chosen)}</div>
          <div style="font-size:.95rem;color:var(--txt3)">정답</div>
          <div style="font-size:1.6rem;font-weight:700;color:var(--emerald)">${escHtml(String(p.a))}</div>
          ${p.hint ? `<div style="font-size:1.05rem;color:var(--txt2);margin-top:.9rem;word-break:keep-all">
            💡 ${escHtml(p.hint)}</div>` : ''}
        </div>` : ''}
      ${STUDY_SESSION && STUDY_SESSION.starAfter !== undefined ? `
        <div style="font-size:.95rem;color:var(--txt3);margin-bottom:.9rem">
          <span style="color:var(--gold);letter-spacing:.06em">${starsText(STUDY_SESSION.starBefore)}</span>
          → <span style="color:var(--gold);letter-spacing:.06em;font-weight:800">${starsText(STUDY_SESSION.starAfter)}</span>
        </div>` : ''}
      <button class="st-btn" onclick="nextStudyQuestion()"
        style="width:100%;border:none;background:var(--gold);
          color:#1a1a1a;font-weight:700;cursor:pointer;font-family:inherit">
        ${last ? '결과 보기' : '다음 문제'}
      </button>
    </div>`;
}

function nextStudyQuestion() {
  if (!STUDY_SESSION) return;
  STUDY_SESSION.cur++;
  // [READING-1] 지문이 바뀌면 새 지문은 펼쳐서 보여 준다(같은 지문이면 접힌 채로 이어 푼다)
  const _nx = STUDY_SESSION.questions[STUDY_SESSION.cur];
  if (!_nx || _nx.passageId !== STUDY_SESSION._psgSeen) STUDY_SESSION._psgSeen = '';   // 새 지문이면 다음 렌더에서 펼친다
  else _passageOpen = '';   // 같은 지문이면 접어 둔다 — 이미 읽은 글을 매번 밀어 올리지 않는다
  renderStudyQuestion();
}

// ── 오늘의 공부 보상 (STUDY-REWARD-1) ──────────────────────
// 하루 10문제(STUDY_PER_DAY)를 채우면 1회 지급. 정답률이 기준 이상이면 보너스.
// 설정은 settings.studyReward — 교사 화면 '학습 범위'에서 바꾼다. 없으면 아래 기본값.
//   mode 'auto'    : 감정 보상과 같은 방식 — 즉시 지급 + questLog
//   mode 'approve' : pendingRewards(approved:false) → 교사 승인 후 지급
// 보충(1~3학년, 세션 review:true) 기록은 집계에서 빼서 보상과 무관하게 둔다.
function studyRewardCfg() {
  const s = (typeof DB.getSettings === 'function' && DB.getSettings()) || {};
  const d = { enabled: true, mode: 'auto', exp: 30, gold: 20, bonusPct: 80, bonusExp: 20, bonusGold: 10 };
  return { ...d, ...(s.studyReward || {}) };
}

function grantStudyReward(justSaved) {
  const cfg = studyRewardCfg();
  if (!cfg.enabled) return null;
  const today = Utils.todayStr();
  CUR.studyRewards = CUR.studyRewards || {};
  if (CUR.studyRewards[today]) return { already: true, ...CUR.studyRewards[today] };

  // 오늘 기록 합산 — 방금 저장한 기록이 캐시에 아직 없으면 직접 더한다
  const recs = getTodayStudyRecords(CUR.id).filter(r => !r.review);
  let done  = recs.reduce((n, r) => n + (r.total || 0), 0);
  let right = recs.reduce((n, r) => n + (r.correct || 0), 0);
  if (justSaved && !recs.some(r => r.id === justSaved.id)) { done += justSaved.total; right += justSaved.correct; }
  if (done < STUDY_PER_DAY) return { need: STUDY_PER_DAY - done };

  const pct   = Math.round(right / done * 100);
  const bonus = pct >= cfg.bonusPct;
  const exp   = (cfg.exp  || 0) + (bonus ? (cfg.bonusExp  || 0) : 0);
  const gold  = (cfg.gold || 0) + (bonus ? (cfg.bonusGold || 0) : 0);
  const label = `📚 오늘의 공부 ${done}문제 완료${bonus ? ` · 정답률 ${pct}%` : ''}`;
  const rec   = { exp, gold, pct, bonus, mode: cfg.mode, date: today };

  if (cfg.mode === 'approve') {
    CUR.pendingRewards = [...(CUR.pendingRewards || []), {
      id: 'r_study_' + today + '_' + Date.now(), studentId: CUR.id,
      boardQuestId: null, boardQuestType: 'study', type: 'study',
      name: label, label, exp, gold, stat: '', statVal: 0, icon: '📚', date: today, approved: false,
    }];
  } else {
    CUR.exp       = (CUR.exp || 0) + exp;
    CUR.gold      = (CUR.gold || 0) + gold;
    CUR.totalGold = (CUR.totalGold || 0) + gold;
    DB.logGold(CUR.id, 'study', gold);   // [GOLD-LOG-1] 승인 모드는 admin 승인 시점에 기록(후속)
    const oldLv = CUR.level;
    CUR.level = Utils.levelFromExp(CUR.exp);
    DB.saveQuestLog({
      studentId: CUR.id, boardQuestId: null, boardQuestType: 'study', type: 'study',
      name: label, exp, gold, stat: '', statVal: 0, icon: '📚', date: today, approved: true,
    });
    if (CUR.level > oldLv) rec.levelUp = CUR.level;
  }
  CUR.studyRewards[today] = rec;
  DB.saveStudent(CUR);
  if (typeof renderAll === 'function') renderAll();
  if (rec.levelUp && typeof triggerLevelUp === 'function') setTimeout(() => triggerLevelUp(rec.levelUp), 400);
  return rec;
}

// 결과 화면에 붙는 보상 안내
function studyRewardBannerHTML(r) {
  if (!r) return '';
  const box = (bg, bd, inner) => `
    <div style="background:${bg};border:1px solid ${bd};border-radius:14px;padding:.9rem 1.1rem;
      margin-bottom:1.2rem;text-align:center;font-size:1.05rem;line-height:1.5;word-break:keep-all">${inner}</div>`;
  if (r.need) return box('rgba(255,255,255,.04)', 'rgba(255,255,255,.1)',
    `<span style="color:var(--txt3)">${r.need}문제 더 풀면 오늘의 보상!</span>`);
  if (r.already) return box('rgba(255,255,255,.04)', 'rgba(255,255,255,.1)',
    `<span style="color:var(--txt3)">오늘 보상은 이미 받았어요 ✓</span>`);
  if (r.mode === 'approve') return box('rgba(255,215,0,.08)', 'rgba(255,215,0,.3)',
    `🎁 <b style="color:var(--gold)">+${r.exp}EXP +${r.gold}G</b><br>
     <span style="font-size:.95rem;color:var(--txt3)">선생님 승인 후 지급돼요</span>`);
  return box('rgba(46,204,113,.1)', 'rgba(46,204,113,.35)',
    `🎁 <b style="color:var(--emerald)">+${r.exp}EXP +${r.gold}G</b> 받았어요!
     ${r.bonus ? `<br><span style="font-size:.95rem;color:var(--gold)">⭐ 정답률 ${r.pct}% 보너스 포함</span>` : ''}`);
}

function finishStudySession() {
  if (!STUDY_SESSION) return;
  const { subjectKey, unitId: sessionUnit, questions, correct, answers, review, grade } = STUDY_SESSION;
  const total = questions.length;
  const wrongIds = answers.filter(a => !a.correct).map(a => a.problemId);
  const pct = total > 0 ? Math.round(correct / total * 100) : 0;

  // 기록 저장 — unitId는 이번 세션에서 가장 많이 나온 단원
  const unitCount = {};
  answers.forEach(a => { unitCount[a.unitId] = (unitCount[a.unitId] || 0) + 1; });
  const mainUnit = Object.entries(unitCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  const recId = `prob_${Utils.todayStr()}_${CUR.id}_${Date.now()}`;
  if (typeof DB.saveProblemRecord === 'function') {
    DB.saveProblemRecord({
      id: recId,
      studentId: CUR.id,
      date: Utils.todayStr(),
      subjectKey,
      unitId: mainUnit,
      total, correct,
      wrongIds,
      answers,          // 고른 답까지 보존
      review: !!STUDY_SESSION.review,   // 보충(1~3학년) 세션이면 true — 보상 집계에서 뺀다
    });
  }

  // [STUDY-REWARD-1] 오늘 10문제를 채우면 하루 1회 보상
  const reward = STUDY_SESSION.review ? null : grantStudyReward({ id: recId, total, correct });

  const emoji = pct === 100 ? '🏆' : pct >= 80 ? '👏' : pct >= 50 ? '💪' : '🌱';
  const msg   = pct === 100 ? '다 맞았어요!' : pct >= 80 ? '잘했어요!' : pct >= 50 ? '조금만 더!' : '천천히 해봐요';
  const wrong = answers.filter(a => !a.correct);

  const body = document.getElementById('study-body');
  const ttl  = document.getElementById('study-title');
  if (ttl) ttl.textContent = '📚 학습 결과';
  if (!body) return;

  body.innerHTML = `
    <div class="st-center" style="padding:1.2rem 1rem">
      <div style="text-align:center;margin-bottom:1.4rem">
        <div class="st-emoji">${emoji}</div>
        <div class="st-score" style="font-weight:800;color:var(--gold);margin:.4rem 0">
          ${correct} / ${total}</div>
        <div style="font-size:1.15rem;color:var(--txt2)">${msg}</div>
      </div>
      ${studyRewardBannerHTML(reward)}
      ${wrong.length > 0 ? `
        <div style="background:rgba(255,255,255,.04);border-radius:12px;padding:1rem 1.1rem;margin-bottom:1.2rem">
          <div style="font-size:1.05rem;font-weight:700;color:var(--red);margin-bottom:.7rem">
            다시 볼 문제 ${wrong.length}개</div>
          ${wrong.slice(0, 5).map(a => {
            const p = questions.find(q => q.id === a.problemId);
            if (!p) return '';
            return `<div style="font-size:1rem;color:var(--txt2);padding:.55rem 0;line-height:1.5;
              border-top:1px solid rgba(255,255,255,.05);word-break:keep-all">
              ${escHtml(p.q.slice(0, 42))}${p.q.length > 42 ? '…' : ''}
              <span style="color:var(--emerald);font-weight:700"> → ${escHtml(String(p.a))}</span></div>`;
          }).join('')}
        </div>` : ''}
      <button class="st-btn" onclick="closeStudyModal()"
        style="width:100%;border:none;background:var(--gold);
          color:#1a1a1a;font-weight:700;cursor:pointer;font-family:inherit">
        끝내기
      </button>
      <button onclick="${review ? `renderReviewUnitPick('${grade}')` : sessionUnit ? `renderStudyUnitPick('${subjectKey}')` : 'renderStudySubjectPick()'}"
        style="width:100%;padding:.8rem;margin-top:.5rem;border-radius:12px;cursor:pointer;
          border:1px solid rgba(255,255,255,.12);background:none;color:var(--txt3);
          font-size:1.05rem;font-family:inherit">더 풀기</button>
    </div>`;

  STUDY_SESSION = null;
  invalidateMastery();   // [MASTERY-1] 방금 푼 것이 별·복습일에 바로 반영되게
  if (typeof checkAchievements === 'function') checkAchievements();
}
