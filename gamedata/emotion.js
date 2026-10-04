// gamedata/emotion.js — 오늘의 감정(EMOTION_DATA·점수·DB_EMOTION·감정 보상) · 감정 돌아보기(문구·후보 고르기·횟수·저장)
//  gamedata.js 에서 떼어 옮긴 클래식 스크립트 [GAMEDATA-SPLIT-1] — 글자 그대로 · 전역 그대로 · html 네 곳에서 gamedata.js 바로 뒤에 부른다(gamedata/data.js → gamedata/rules.js → gamedata/emotion.js → gamedata/battle.js).
// ── [GAMEDATA-SPLIT-1] 'emotion' — 원래 gamedata.js 2710~2926줄 ──
// ══════════════════════════════════════════════════
//  EMOTION SYSTEM — 오늘의 감정
// ══════════════════════════════════════════════════

const EMOTION_DATA = [
  // 긍정 (positive)
  { key:'happy',      label:'행복하다',   group:'positive', icon:'😄' },
  { key:'excited',    label:'신나다',     group:'positive', icon:'🤩' },
  { key:'joyful',     label:'즐겁다',     group:'positive', icon:'😊' },
  { key:'thrilled',   label:'설레다',     group:'positive', icon:'🥰' },
  { key:'fun',        label:'재미있다',   group:'positive', icon:'😆' },
  { key:'calm',       label:'편안하다',   group:'positive', icon:'😌' },
  { key:'glad',       label:'기쁘다',     group:'positive', icon:'😁' },
  { key:'proud',      label:'뿌듯하다',   group:'positive', icon:'🥳' },
  { key:'satisfied',  label:'만족하다',   group:'positive', icon:'😀' },
  // 보통 (neutral)
  { key:'lonely',     label:'외롭다',     group:'neutral',  icon:'😶' },
  { key:'flustered',  label:'당황하다',   group:'neutral',  icon:'😳' },
  { key:'sorry',      label:'미안하다',   group:'neutral',  icon:'😔' },
  { key:'shameful',   label:'창피하다',   group:'neutral',  icon:'😳' },
  { key:'shy',        label:'부끄럽다',   group:'neutral',  icon:'😊' },
  { key:'surprised',  label:'놀라다',     group:'neutral',  icon:'😲' },
  { key:'annoyed',    label:'얄밉다',     group:'neutral',  icon:'😒' },
  // 부정 (negative)
  { key:'scared',     label:'무섭다',     group:'negative', icon:'😨' },
  { key:'sad',        label:'슬프다',     group:'negative', icon:'😢' },
  { key:'irritated',  label:'짜증나다',   group:'negative', icon:'😤' },
  { key:'angry',      label:'화나다',     group:'negative', icon:'😠' },
  { key:'unfair',     label:'억울하다',   group:'negative', icon:'😤' },
  { key:'frustrated', label:'답답하다',   group:'negative', icon:'😩' },
  { key:'worried',    label:'걱정되다',   group:'negative', icon:'😟' },
  { key:'jealous',    label:'샘나다',     group:'negative', icon:'😒' },
  { key:'disappointed',label:'실망하다',  group:'negative', icon:'😞' },
  { key:'tearful',    label:'울고싶다',   group:'negative', icon:'😭' },
  { key:'upset',      label:'속상하다',   group:'negative', icon:'😣' },
  { key:'depressed',  label:'우울하다',   group:'negative', icon:'😔' },
  { key:'hurt',       label:'서운하다',   group:'negative', icon:'🥺' },
  { key:'anxious',    label:'불안하다',   group:'negative', icon:'😰' },
  { key:'gloomy',     label:'쓸쓸하다',   group:'negative', icon:'😕' },
  { key:'nervous',    label:'신경질나다', group:'negative', icon:'😡' },
  { key:'regretful',  label:'아쉽다',     group:'negative', icon:'😣' },
  { key:'vexed',      label:'약오르다',   group:'negative', icon:'😤' },
  { key:'remorseful', label:'후회되다',   group:'negative', icon:'😞' },
];

const EMOTION_LEVEL = [
  { value:1, label:'조금' },
  { value:2, label:'보통' },
  { value:3, label:'많이' },
];

const EMOTION_GROUP_VALUE = { positive:1, neutral:0, negative:-1 };

// score = groupValue × level
function calcEmotionScore(emotionKey, level) {
  const e = EMOTION_DATA.find(x => x.key === emotionKey);
  if (!e) return 0;
  return EMOTION_GROUP_VALUE[e.group] * level;
}

// ── DB 감정 함수 ──────────────────────────────────
// key 고정 구조: studentId_date_period → 중복 불가
const DB_EMOTION = {
  _ref(db) {
    return (typeof DB !== 'undefined' ? DB._fbRef : null);
  },

  // 저장 (있으면 덮어쓰기)
  save(studentId, date, period, emotionKey, level, reason) {
    const key = `${studentId}_${date}_${period}`;
    const e = EMOTION_DATA.find(x => x.key === emotionKey);
    if (!e) return;
    const record = {
      id:           key,
      studentId,
      date,
      period,           // 'am' | 'pm'
      emotionKey,
      emotionLabel:  e.label,
      emotionIcon:   e.icon,
      group:         e.group,
      level,            // 1~3
      levelLabel:    EMOTION_LEVEL.find(x=>x.value===level)?.label || '',
      score:         calcEmotionScore(emotionKey, level),
      reason:        reason || '',
      updatedAt:     Date.now(),
    };
    // 캐시 갱신
    const db = (typeof DB !== 'undefined') ? DB.load() : {};
    db.emotionLogs = db.emotionLogs || {};
    db.emotionLogs[key] = record;
    if (typeof DB !== 'undefined') {
      DB._cache = db;
      DB._fbRef.child('emotionLogs/' + key).set(record);
    }
    return record;
  },

  // 단건 조회
  get(studentId, date, period) {
    const key = `${studentId}_${date}_${period}`;
    const db = (typeof DB !== 'undefined') ? DB.load() : {};
    return (db.emotionLogs || {})[key] || null;
  },

  // 날짜별 전체 조회
  getByDate(date) {
    const db = (typeof DB !== 'undefined') ? DB.load() : {};
    if (typeof DB !== 'undefined' && DB._snaps) console.warn('[STUDENT-COLD-1] 학생 기기 캐시엔 내 감정 기록만 있음 — getByDate 는 교사·키오스크용');   // G6
    return Object.values(db.emotionLogs || {}).filter(r => r && r.date === date);
  },

  // 학생별 전체 조회
  getByStudent(studentId) {
    const db = (typeof DB !== 'undefined') ? DB.load() : {};
    return Object.values(db.emotionLogs || {})
      .filter(r => r && r.studentId === studentId)
      .sort((a,b) => a.date.localeCompare(b.date));
  },

  // 주간 요약 (보상 계산용)
  getWeeklySummary(studentId, weekStart) {
    const records = this.getByStudent(studentId)
      .filter(r => r.date >= weekStart);
    return {
      total:      records.length,
      amCount:    records.filter(r => r.period==='am').length,
      pmCount:    records.filter(r => r.period==='pm').length,
      reasonCount:records.filter(r => r.reason && r.reason !== '없음').length,
      avgScore:   records.length ? (records.reduce((s,r)=>s+r.score,0)/records.length).toFixed(2) : 0,
    };
  },
};

// ── 감정 보상 기준 ──────────────────────────────────
const EMOTION_REWARDS = [
  {
    id:       'emo_participate',
    label:    '💭 감정 참여 보상',
    desc:     '이번 주 감정 4회 이상 기록',
    condition:(summary) => summary.total >= 4,
    exp:      20,
    gold:     15,
  },
  {
    id:       'emo_steady',
    label:    '💪 꾸준한 감정 기록',
    desc:     '이번 주 감정 8회 이상 기록',
    condition:(summary) => summary.total >= 8,
    exp:      50,
    gold:     40,
  },
  {
    id:       'emo_reflect',
    label:    '🤔 성찰 보상',
    desc:     '이번 주 이유 3회 이상 입력',
    condition:(summary) => summary.reasonCount >= 3,
    exp:      30,
    gold:     20,
  },
];

// 이번 주에 수령 가능한 감정 보상 목록 반환
function getClaimableEmotionRewards(student, weekStart) {
  const db = (typeof DB !== 'undefined' ? DB.load() : {});
  const cfg = ((db.settings || {}).emotionRewards || {});
  // 감정 보상 기능 꺼져있으면 빈 배열
  if (cfg.enabled === false) return [];
  const summary = DB_EMOTION.getWeeklySummary(student.id, weekStart);
  const claimed  = (student.emotionRewardsClaimed || {})[weekStart] || [];
  const thresholds = {
    emo_participate: cfg.participate || 4,
    emo_steady:      cfg.steady      || 8,
    emo_reflect:     cfg.reflect     || 3,
  };
  const rewards = {
    // [ZERO-OK-1] 교사가 0 을 넣으면 0 — 빈칸·글자·음수만 기본값
    emo_participate: { exp: Utils.intOr(cfg.participateExp, 20), gold: Utils.intOr(cfg.participateGold, 15) },
    emo_steady:      { exp: Utils.intOr(cfg.steadyExp,      50), gold: Utils.intOr(cfg.steadyGold,      40) },
    emo_reflect:     { exp: Utils.intOr(cfg.reflectExp,     30), gold: Utils.intOr(cfg.reflectGold,     20) },
  };
  return EMOTION_REWARDS.filter(r => {
    if (claimed.includes(r.id)) return false;
    if (r.id === 'emo_participate') return summary.total >= thresholds.emo_participate;
    if (r.id === 'emo_steady')      return summary.total >= thresholds.emo_steady;
    if (r.id === 'emo_reflect')     return summary.reasonCount >= thresholds.emo_reflect;
    return r.condition(summary);
  }).map(r => {
    const thresh = thresholds[r.id];
    const rwd    = rewards[r.id] || { exp: r.exp, gold: r.gold };
    let desc = r.desc;
    if (r.id === 'emo_participate') desc = `이번 주 감정 ${thresh}회 이상 기록`;
    if (r.id === 'emo_steady')      desc = `이번 주 감정 ${thresh}회 이상 기록`;
    if (r.id === 'emo_reflect')     desc = `이번 주 이유 ${thresh}회 이상 입력`;
    return { ...r, desc, exp: rwd.exp, gold: rwd.gold, summary };
  });
}


// ══════════════════════════════════════════════════
//  EMOTION REFLECTION (감정 돌아보기 팝업)
// ══════════════════════════════════════════════════

const EMOTION_PAST_TEXT = {
  "무섭다":"무서웠다고","슬프다":"슬펐다고","외롭다":"외로웠다고",
  "짜증나다":"짜증났다고","화나다":"화가 났다고","신나다":"신났다고",
  "행복하다":"행복했다고","당황하다":"당황했다고","미안하다":"미안했다고",
  "창피하다":"창피했다고","억울하다":"억울했다고","즐겁다":"즐거웠다고",
  "답답하다":"답답했다고","걱정되다":"걱정됐다고","설레다":"설렜다고",
  "샘나다":"샘이 났다고","실망하다":"실망했다고","울고싶다":"울고 싶었다고",
  "부끄럽다":"부끄러웠다고","재미있다":"재미있었다고","편안하다":"편안했다고",
  "기쁘다":"기뻤다고","얄밉다":"얄밉게 느껴졌다고","알밉다":"얄밉게 느껴졌다고","속상하다":"속상했다고",
  "뿌듯하다":"뿌듯했다고","우울하다":"우울했다고","서운하다":"서운했다고",
  "만족하다":"만족스러웠다고","불안하다":"불안했다고","놀라다":"놀랐다고",
  "쓸쓸하다":"쓸쓸했다고","신경질나다":"신경질이 났다고","아쉽다":"아쉬웠다고",
  "약오르다":"약이 올랐다고","후회되다":"후회됐다고",
};

// ── [GAMEDATA-SPLIT-1] 'reflect' — 원래 gamedata.js 3644~3779줄 ──
// ═══════════════════════════════════════════════════════
//  감정 시스템
function getReflectionCandidate(studentId) {
  const db = (typeof DB !== 'undefined') ? DB.load() : {};
  const logs = db.emotionLogs || {};
  const today = (typeof Utils !== 'undefined') ? Utils.todayStr()
    : new Date(Date.now()+9*3600000).toISOString().slice(0,10);

  // 2~7일 사이 기록 (오늘 제외)
  const candidates = Object.values(logs).filter(r => {
    if (!r || r.studentId !== studentId) return false;
    if (r.date === today) return false;
    const diff = (new Date(today) - new Date(r.date)) / 86400000;
    return diff >= 1 && diff <= 7;
  });
  if (!candidates.length) return null;

  // 이미 사용한 기록 제외
  const reflections = db.emotionReflections || {};
  const usedIds = new Set(
    Object.values(reflections)
      .filter(r => r && r.studentId === studentId)
      .map(r => r.promptSourceId)
  );

  // 부정 감정 우선, 이유 있는 것 우선
  const available = candidates.filter(r => !usedIds.has(r.id));
  if (!available.length) return null;

  available.sort((a, b) => {
    const gScore = {negative:2, neutral:1, positive:0};
    const gs = (gScore[b.group]||0) - (gScore[a.group]||0);
    if (gs !== 0) return gs;
    const hasReasonA = a.reason && a.reason !== '없음' ? 1 : 0;
    const hasReasonB = b.reason && b.reason !== '없음' ? 1 : 0;
    return hasReasonB - hasReasonA;
  });

  return available[0];
}

// 팝업 노출 가능 여부 체크
function canShowReflectionPopup(studentId) {
  const db = (typeof DB !== 'undefined') ? DB.load() : {};
  const today = (typeof Utils !== 'undefined') ? Utils.todayStr()
    : new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  const weekStart = (typeof Utils !== 'undefined') ? Utils.weekStartStr()
    : today.slice(0,8)+'01';

  const stats = (db.emotionPromptStats || {})[studentId] || {};

  // 오늘 이미 했으면 금지
  if (stats.lastShownDate === today) return false;
  // 이번 주 2회 이상이면 금지
  if ((stats.weekCount || {})[weekStart] >= 2) return false;
  // 감정 기록 3개 이상이어야
  const logCount = Object.values(db.emotionLogs || {})
    .filter(r => r && r.studentId === studentId).length;
  if (logCount < 3) return false;

  return true;
}

// 팝업 통계 업데이트
function updateReflectionStats(studentId, type) {
  const db = (typeof DB !== 'undefined') ? DB.load() : {};
  const today = (typeof Utils !== 'undefined') ? Utils.todayStr()
    : new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  const weekStart = (typeof Utils !== 'undefined') ? Utils.weekStartStr()
    : today.slice(0,8)+'01';

  db.emotionPromptStats = db.emotionPromptStats || {};
  db.emotionPromptStats[studentId] = db.emotionPromptStats[studentId] || {};
  const stats = db.emotionPromptStats[studentId];

  if (type !== 'later') {
    stats.lastShownDate = today;
    stats.weekCount = stats.weekCount || {};
    stats.weekCount[weekStart] = (stats.weekCount[weekStart] || 0) + 1;
  } else {
    stats.lastShownDate = today; // later도 오늘은 재노출 금지
  }

  if (typeof DB !== 'undefined') {
    DB._cache = db;
    DB._fbRef.child('emotionPromptStats/' + studentId).set(stats);
  }
}

// Reflection 저장
function saveEmotionReflection(studentId, candidate, responseType, responseText, teacherRequest) {
  const db = (typeof DB !== 'undefined') ? DB.load() : {};
  const today = (typeof Utils !== 'undefined') ? Utils.todayStr()
    : new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  const weekStart = (typeof Utils !== 'undefined') ? Utils.weekStartStr()
    : today.slice(0,8)+'01';
  const key = `${studentId}_${today}_${Date.now()}`;

  const record = {
    id: key,
    studentId,
    promptSourceId:    candidate.id,
    promptDate:        candidate.date,
    promptPeriod:      candidate.period,
    promptEmotionKey:  candidate.emotionKey,
    promptEmotionLabel:candidate.emotionLabel,
    promptEmotionGroup:candidate.group,
    promptEmotionScore:candidate.score,
    promptReason:      candidate.reason || '',
    responseType,
    responseText:      responseText || '',
    teacherRequest:    !!teacherRequest,
    createdAt:         Date.now(),
    weekKey:           weekStart,
  };

  if (typeof DB !== 'undefined') {
    db.emotionReflections = db.emotionReflections || {};
    db.emotionReflections[key] = record;
    DB._cache = db;
    DB._fbRef.child('emotionReflections/' + key).set(record);

    // 관리자 알림
    if (teacherRequest) {
      const student = DB.getStudent(studentId);
      DB._fbRef.child('emotionAlerts/' + key).set({
        ...record,
        studentName: student?.name || '',
        studentAvatar: student?.avatar || '',
        read: false,
      });
    }
  }
  return record;
}

