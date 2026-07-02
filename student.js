// ══ 상태 ══
let CUR = null, SEL_STUDENT = null, SEL_CHAR = null;
let SHOP_TAB = 'head', INV_TAB = 'equip', SEL_SEED = null, CUR_EQUIP_SLOT = 'all';
let BATTLE_MON = null, BATTLE_TRIES = 0, BATTLE_DONE = false;
let BATTLE_STATE = null; // 새 턴제 전투 엔진 상태
let BATTLE_MENU = 'main'; // 'main' | 'attack' | 'skill'
let MOB_TAB = 'home';
var _lbTouchX = 0; // 라이트박스 스와이프 시작 X (인라인 ontouchstart/end가 전역 접근 → window 프로퍼티 필요, let 금지)

// ══ HTML 이스케이프 (학생 입력 문자열 → innerHTML 삽입용) ══
function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── 이미지 아이콘 + 이모지 폴백 ──
function iconImg(entity, kind, sizeCss) {
  const icon = escHtml(entity?.icon || '❓');
  const size = /^(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|%)$/.test(String(sizeCss)) ? String(sizeCss) : '1.5rem';
  const collection = GAME_DATA[kind];
  const isBaseEntity = entity?.id && Array.isArray(collection) && collection.some(item => item.id === entity.id);
  if (!isBaseEntity) return `<span style="display:inline-grid;place-items:center;width:${size};height:${size}">${icon}</span>`;

  return `<span style="display:inline-grid;place-items:center;width:${size};height:${size}">`
    + `<img src="./assets/${escHtml(kind)}/${escHtml(entity.id)}.png" alt="${escHtml(entity.name || '')}" `
    + `style="display:block;width:100%;height:100%;object-fit:contain" `
    + `onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">`
    + `<span style="display:none">${icon}</span></span>`;
}

// ══ 초기화 ══
window.onload = async () => {
  const loading = document.getElementById('loading-screen');
  try {
    await DB.init();
    applyShopOverrides(); // 상점 오버라이드 적용
    applyBattleSettings(); // 전투 밸런스 오버라이드 적용
    DB.onDataChange(() => {
      applyShopOverrides();
      applyBattleSettings();
      if (typeof CUR !== 'undefined' && CUR) {
        const fresh = DB.getStudent(CUR.id);
        if (fresh) CUR = fresh;

        if (BATTLE_STATE && !BATTLE_STATE.finished) {
          if (typeof renderHUD === 'function') renderHUD();
        } else {
          if (typeof renderHUD === 'function') { renderHUD(); renderMain(); renderMobile(); }
          // 사냥터 모달이 열려 있으면 즉시 재렌더
          const monModal = document.getElementById('m-monster');
          if (monModal && monModal.classList.contains('open')) {
            renderMonsterStep();
          }
        }
      }
    });
  } catch(e) {
    console.error('Firebase 연결 실패:', e);
    alert('서버 연결에 실패했습니다. 인터넷 연결을 확인해주세요.');
  }
  loading.style.display = 'none';
  buildLoginGrid();
};

function buildLoginGrid() {
  const grid = document.getElementById('student-grid');
  grid.innerHTML = DB.getStudents().map(s => {
    const av = (s.avatar || '').trim();
    const nm = (s.name  || '').trim();
    // 이름 자체에 아이콘이 이미 포함된 경우 avatar 중복 제거
    const hasAvInName = av && nm.includes(av);
    const label = hasAvInName ? nm : (av ? `${av} ${nm}` : nm);
    return `<button class="stu-btn" onclick="selectStudent('${s.id}',this)">${escHtml(label)}</button>`;
  }).join('');
}

// ══ 화면 전환 ══
function gotoLogin() {
  const t = document.getElementById('s-title');
  t.classList.add('gone');
  setTimeout(() => { t.classList.add('hidden'); showScreen('s-login'); }, 500);
}
function showScreen(id) {
  document.getElementById(id).classList.remove('hidden');
}
function hideScreen(id) { document.getElementById(id).classList.add('hidden'); }

function selectStudent(id, el) {
  document.querySelectorAll('.stu-btn').forEach(b => b.classList.remove('sel'));
  el.classList.add('sel'); SEL_STUDENT = id;
  document.getElementById('login-err').textContent = '';
}

function checkAccessTime() {
  const settings = DB.getSettings();
  const startStr = settings.accessStart || '08:30';
  const endStr   = settings.accessEnd   || '16:00';
  const now = new Date(Date.now() + 9*3600000); // KST
  const h = now.getUTCHours(), m = now.getUTCMinutes();
  const cur  = h * 60 + m;
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  const start = sh * 60 + sm;
  const end   = eh * 60 + em;
  // 허용 시간 외면 차단
  return cur < start || cur >= end;
}

function doLogin() {
  if (!SEL_STUDENT) { document.getElementById('login-err').textContent = '이름을 선택해주세요!'; return; }

  // 접속 시간 체크 (8:30~16:00만 허용)
  if (checkAccessTime()) {
    document.getElementById('login-err').textContent = '⏰ 접속 가능 시간: 오전 8:30 ~ 오후 4:00';
    return;
  }

  const student = DB.getStudent(SEL_STUDENT);
  if (document.getElementById('pw-input').value !== student.pw) {
    document.getElementById('login-err').textContent = '비밀번호가 틀렸어요!'; return;
  }
  CUR = JSON.parse(JSON.stringify(student));
  if (!CUR.charType) {
    hideScreen('s-login');
    showScreen('s-charsel');
  } else {
    hideScreen('s-login');
    enterGame();
  }
}

function selChar(type, el) {
  document.querySelectorAll('.char-opt').forEach(o => o.classList.remove('sel'));
  el.classList.add('sel'); SEL_CHAR = type;
  const btn = document.getElementById('btn-char-ok');
  btn.disabled = false; btn.style.opacity = '1';
}

function confirmChar() {
  if (!SEL_CHAR) return;
  CUR.charType = SEL_CHAR;
  CUR.avatar = Utils.charEmoji(SEL_CHAR);
  DB.saveStudent(CUR);
  hideScreen('s-charsel');
  enterGame();
}

let _accessTimer = null;

function startAccessTimer() {
  if (_accessTimer) clearInterval(_accessTimer);
  _accessTimer = setInterval(() => {
    if (!CUR) return;
    if (checkAccessTime()) {
      clearInterval(_accessTimer);
      _accessTimer = null;
      // 데이터 저장 후 로그아웃
      DB.saveStudent(CUR);
      CUR = null;
      document.getElementById('s-game').classList.remove('active');
      hideScreen('s-game');
      showScreen('s-login');
      document.getElementById('login-err').textContent = '⏰ 접속 시간이 종료됐어요. 내일 다시 만나요!';
    }
  }, 30000); // 30초마다 체크
}

function enterGame() {
  // [Q-2B] 교사가 admin을 열지 않아도 학생 첫 접속 시 오늘 일일 퀘스트가 생성되게 한다.
  // 로직은 Q-2A에서 공통화한 DB.ensureDailyQuests()(gamedata.js)를 그대로 호출.
  // (DB.init 완료 후 호출되는 흐름이며, 실패해도 게임 진입이 막히지 않도록 보호)
  try {
    if (DB.ensureDailyQuests) DB.ensureDailyQuests();
  } catch (e) {
    console.warn('자동 일일 퀘스트 확인 실패:', e);
  }

  autoCloseDailyQuests();
  cleanInactivePending();

  // ★ 미완료 전투 감지: 전투 도중 창을 닫고 재접속한 경우
  // 횟수는 startBattle()에서 이미 차감됐으므로 상태만 정리 (패배 처리)
  if (CUR.battleInProgress) {
    const monName = CUR.battleInProgress.monName || '몬스터';
    CUR.battleInProgress = null;
    DB.saveStudent(CUR);
    // 게임 화면 진입 후 안내 (renderAll 이후에 보여야 잘 보임)
    setTimeout(() => toast(`⚠️ [${monName}] 전투 도중 종료되어 패배 처리됐어요.\n이미 사용한 전투 기회는 복구되지 않아요.`), 500);
  }

  document.getElementById('s-game').classList.add('active');
  applyLayout(LAYOUT_MODE);
  // 비율고정 버튼 초기 상태 복원
  const sBtn = document.getElementById('scale-mode-btn');
  if (sBtn) sBtn.textContent = SCALE_MODE ? '🔍 비율고정 ON' : '🔍 비율고정';
  applyScale();
  renderAll();
  startAccessTimer();
  setTimeout(() => checkWeeklyRoutine(), 1500);   // 주간 다짐 자동 팝업
  setTimeout(() => checkVocabQuizTrigger(), 10000); // 영어 단어 퀴즈 팝업
  setTimeout(() => tryShowReflectionPopup(), 30000);
}

function cleanInactivePending() {
  let changed = false;

  // [Q-1] 미승인 보상은 교사 승인 전까지 보존한다.
  // 닫힌(비활성) boardQuest를 이유로 pendingRewards를 자동 삭제하지 않는다.
  // (이전 동작: active boardQuest에 없는 boardQuestId의 pending을 onload마다 삭제
  //  → 교사가 승인하기 전에 다음날/퀘스트 마감과 함께 보상이 유실되는 버그)

  // 구형 승급 pending 정리 (패치 전 방식으로 남아있는 ⬆️ 승급 항목)
  // 이제 승급은 즉시 지급되므로 pending에 남아있을 필요 없음
  const beforePromo = (CUR.pendingRewards||[]).length;
  CUR.pendingRewards = (CUR.pendingRewards||[]).filter(r =>
    r.type !== 'promotion' && !(r.icon === '⬆️' && r.exp === 50)
  );
  if (CUR.pendingRewards.length !== beforePromo) changed = true;

  // promotedLevels 자동 복구
  const promotionLevels = [5,10,15,20,25,30];
  CUR.promotedLevels = CUR.promotedLevels || [];

  // 현재 레벨 이하의 모든 승급 레벨은 이미 통과한 것
  promotionLevels.forEach(lv => {
    if (lv < CUR.level && !CUR.promotedLevels.includes(lv)) {
      CUR.promotedLevels.push(lv);
      changed = true;
    }
  });

  // 현재 레벨이 승급 레벨이고 직업이 이미 바뀐 경우 (ex: Lv5인데 중학생)
  const expectedJob = Utils.getJobTitle(CUR.dream || CUR.job || '', CUR.level - 1);
  const currentJob  = Utils.getJobTitle(CUR.dream || CUR.job || '', CUR.level);
  if (CUR.job && CUR.job !== expectedJob && CUR.job === currentJob) {
    if (Utils.isPromotionLevel(CUR.level) && !CUR.promotedLevels.includes(CUR.level)) {
      CUR.promotedLevels.push(CUR.level);
      changed = true;
    }
  }

  if (changed) DB.saveStudent(CUR);
}

// ══ 자동 출석 ══
// ══ 렌더 전체 ══
function renderAll() { renderHUD(); renderSide(); renderMain(); renderMobile(); }

function renderHUD() {
  const s = CUR;
  const pct = Utils.expPct(s);
  document.getElementById('hud-ava').textContent     = s.avatar || Utils.charEmoji(s.charType);
  document.getElementById('hud-name').textContent    = s.name;
  document.getElementById('hud-title').textContent   = '📖 ' + (s.title || '');
  document.getElementById('hud-lv').textContent      = s.level;
  document.getElementById('hud-gold').textContent    = s.gold;
  document.getElementById('hud-exp-fill').style.width = pct + '%';
  document.getElementById('hud-exp-txt').textContent = `${s.exp} / ${Utils.expForNextLevel(s.level)} EXP`;

  // 승급 배지
  const canPromo = Utils.isPromotionLevel(s.level) && !s.promotionPending && !(s.promotedLevels||[]).includes(s.level) && !DB.getPromotionRequests().find(r => r.studentId === s.id);
  document.getElementById('promo-badge').style.display = canPromo ? 'inline-flex' : 'none';
}

function renderSide() {
  const s = CUR;
  renderCharCard('char-svg-wrap','char-cname','char-job','char-combat','equip-grid','ability-bars', s);
}

// ══ SVG 캐릭터 빌더 ══
const EQUIP_COLORS = {
  none:    { body:'#3a3a4a', outline:'#555',  shine:'#555'  },
  e_b1:    { body:'#c8c8d8', outline:'#999',  shine:'#eee'  }, // 천
  e_b2:    { body:'#7B4F2E', outline:'#5a3820',shine:'#a06838'}, // 가죽
  e_b3:    { body:'#7B3FA0', outline:'#5a2e78',shine:'#a060c8'}, // 견습 로브
  e_b4:    { body:'#4a7abf', outline:'#2e5a9a',shine:'#6a9adf'}, // 철 갑옷
  e_b5:    { body:'#2a6090', outline:'#1a4070',shine:'#4a90c0'}, // 연구 로브
  e_b6:    { body:'#2C3E6E', outline:'#1a2850',shine:'#4a6090'}, // 기사 갑옷
  e_b7:    { body:'#4a2070', outline:'#2e1050',shine:'#7a40a0'}, // 대마법 로브
  e_b8:    { body:'#C8970A', outline:'#a07808',shine:'#f0c020'}, // 황금 갑옷
  e_b9:    { body:'#8B1A1A', outline:'#600000',shine:'#c04040'}, // 전설 갑옷
  e_b10:   { body:'#8B6914', outline:'#604800',shine:'#d4a820'}, // 왕의 갑옷
};
const HEAD_COLORS = {
  none:    null,
  e_h1:    { fill:'#c8c8d8', outline:'#999'  },
  e_h2:    { fill:'#7B4F2E', outline:'#5a3820'},
  e_h3:    { fill:'#7B3FA0', outline:'#5a2e78'},
  e_h4:    { fill:'#4a7abf', outline:'#2e5a9a'},
  e_h5:    { fill:'#2a6090', outline:'#1a4070'},
  e_h6:    { fill:'#2C3E6E', outline:'#1a2850'},
  e_h7:    { fill:'#4a2070', outline:'#2e1050'},
  e_h8:    { fill:'#C8970A', outline:'#a07808'},
  e_h9:    { fill:'#8B1A1A', outline:'#600000'},
  e_h10:   { fill:'#C8970A', outline:'#7a5000'},
};
const WEAPON_SHAPES = {
  none:   null,
  e_w1:   'sword',   e_w2:  'sword',  e_w3:  'staff',
  e_w4:   'sword',   e_w5:  'staff',  e_w6:  'sword',
  e_w7:   'staff',   e_w8:  'sword',  e_w9:  'sword',  e_w10: 'sword',
};
const WEAPON_COLORS = {
  none:   '#555',
  e_w1:   '#8B6914', e_w2:  '#aaa',   e_w3:  '#9B59B6',
  e_w4:   '#6a9adf', e_w5:  '#2a6090',e_w6:  '#2C3E6E',
  e_w7:   '#9B59B6', e_w8:  '#C8970A',e_w9:  '#8B1A1A', e_w10: '#e040fb',
};
const SHOE_COLORS = {
  none:   '#3a3a4a',
  e_s1:   '#c8c8d8', e_s2:  '#7B4F2E',e_s3:  '#7B3FA0',
  e_s4:   '#4a7abf', e_s5:  '#2a6090',e_s6:  '#2C3E6E',
  e_s7:   '#4a2070', e_s8:  '#C8970A',e_s9:  '#8B1A1A', e_s10: '#e040fb',
};
const GLOVE_COLORS = {
  none:   '#c8a87a',
  e_g1:   '#d8d8e8', e_g2:  '#8B5E3C',e_g3:  '#9B59B6',
  e_g4:   '#5a8abf', e_g5:  '#2a6090',e_g6:  '#3C4E7E',
  e_g7:   '#6a40a0', e_g8:  '#D4A820',e_g9:  '#A01A1A', e_g10: '#e040fb',
};

function buildCharSVG(s) {
  const eqIds  = s.equipmentIds || {};
  const bodyId   = eqIds.body   || 'none';
  const headId   = eqIds.head   || 'none';
  const weaponId = eqIds.weapon || 'none';
  const gloveId  = eqIds.glove  || 'none';
  const shoeId   = eqIds.shoe   || 'none';

  const isFemale = (s.charType === 2 || s.charType === 4);

  // ── 피부/머리카락 ──
  const skin = s.charType===2?'#FDDCB5':s.charType===3?'#C68642':s.charType===4?'#8D5524':'#FFCC80';
  const skinD = s.charType===2?'#E8B98A':s.charType===3?'#A0522D':s.charType===4?'#6B3A2A':'#E8A87C';
  const hairColors = {1:'#3E1F00',2:'#6A1B9A',3:'#0D2B6B',4:'#1B5E20'};
  const hair  = hairColors[s.charType]||'#3E1F00';
  const hairH = s.charType===2?'#9C27B0':s.charType===3?'#1565C0':s.charType===4?'#2E7D32':'#5D4037';

  // ── 장비 색상 팔레트 ──
  const BODY_PAL = {
    none:   {a:'#5C7AEA',b:'#3A5BCC',c:'#8FA8FF',belt:'#8B6914'},
    e_b1:   {a:'#BDBDBD',b:'#9E9E9E',c:'#E0E0E0',belt:'#795548'},
    e_b2:   {a:'#8D6E63',b:'#6D4C41',c:'#A1887F',belt:'#795548'},
    e_b3:   {a:'#9C27B0',b:'#7B1FA2',c:'#CE93D8',belt:'#4A148C'},
    e_b4:   {a:'#78909C',b:'#546E7A',c:'#B0BEC5',belt:'#37474F'},
    e_b5:   {a:'#7E57C2',b:'#5E35B1',c:'#B39DDB',belt:'#4527A0'},
    e_b6:   {a:'#455A64',b:'#263238',c:'#78909C',belt:'#BF360C'},
    e_b7:   {a:'#4A148C',b:'#311B92',c:'#9C27B0',belt:'#F57F17'},
    e_b8:   {a:'#F9A825',b:'#F57F17',c:'#FFF176',belt:'#E65100'},
    e_b9:   {a:'#37474F',b:'#1C313A',c:'#546E7A',belt:'#FFD700'},
    e_b10:  {a:'#880E4F',b:'#560027',c:'#C2185B',belt:'#FFD700'},
  };
  const SHOE_PAL = {
    none:'#4E342E', e_s1:'#5D4037', e_s2:'#795548', e_s3:'#7B1FA2',
    e_s4:'#37474F', e_s5:'#5E35B1', e_s6:'#1A237E', e_s7:'#4A148C',
    e_s8:'#E65100', e_s9:'#1C313A', e_s10:'#880E4F',
  };
  const GLOVE_PAL = {
    none:skin, e_g1:'#795548', e_g2:'#6D4C41', e_g3:'#9C27B0',
    e_g4:'#546E7A', e_g5:'#7E57C2', e_g6:'#455A64', e_g7:'#4A148C',
    e_g8:'#F9A825', e_g9:'#37474F', e_g10:'#880E4F',
  };
  const HEAD_PAL = {
    e_h1:{a:'#BDBDBD',b:'#9E9E9E',type:'cloth'},
    e_h2:{a:'#8D6E63',b:'#6D4C41',type:'leather'},
    e_h3:{a:'#9C27B0',b:'#7B1FA2',type:'magic'},
    e_h4:{a:'#78909C',b:'#546E7A',type:'helm'},
    e_h5:{a:'#7E57C2',b:'#5E35B1',type:'magic'},
    e_h6:{a:'#455A64',b:'#263238',type:'helm'},
    e_h7:{a:'#4A148C',b:'#311B92',type:'magic'},
    e_h8:{a:'#F9A825',b:'#F57F17',type:'helm'},
    e_h9:{a:'#37474F',b:'#1C313A',type:'helm'},
    e_h10:{a:'#FFD700',b:'#FF8F00',type:'crown'},
  };
  const WEAPON_PAL = {
    e_w1:{a:'#A1887F',b:'#6D4C41',type:'sword'},
    e_w2:{a:'#90A4AE',b:'#546E7A',type:'sword'},
    e_w3:{a:'#CE93D8',b:'#9C27B0',type:'staff'},
    e_w4:{a:'#B0BEC5',b:'#78909C',type:'sword'},
    e_w5:{a:'#B39DDB',b:'#7E57C2',type:'staff'},
    e_w6:{a:'#90CAF9',b:'#1976D2',type:'sword'},
    e_w7:{a:'#E1BEE7',b:'#7B1FA2',type:'staff'},
    e_w8:{a:'#FFE082',b:'#F9A825',type:'sword'},
    e_w9:{a:'#B0BEC5',b:'#37474F',type:'sword'},
    e_w10:{a:'#F48FB1',b:'#880E4F',type:'sword'},
  };

  const bp   = BODY_PAL[bodyId]  || BODY_PAL.none;
  const shoe = SHOE_PAL[shoeId]  || SHOE_PAL.none;
  const glv  = GLOVE_PAL[gloveId]|| GLOVE_PAL.none;
  const hp   = HEAD_PAL[headId];
  const wp   = WEAPON_PAL[weaponId];

  // ── 무기: 손잡이=오른손(cx=101,cy=100) 위에서 그려짐 ──
  // 실제 렌더는 오른팔/장갑 다음에 위치
  let weaponSvg = '';

  // ── 투구/머리 장식 SVG ──
  let helmSvg = '';
  if (hp) {
    if (hp.type === 'crown') {
      // 왕관: 머리 위로 올리고 크게
      helmSvg = `
        <rect x="40" y="18" width="40" height="10" rx="2" fill="${hp.a}"/>
        <polygon points="40,18 45,5 50,18" fill="${hp.a}"/>
        <polygon points="55,18 60,8 65,18" fill="${hp.a}"/>
        <polygon points="70,18 75,5 80,18" fill="${hp.a}"/>
        <rect x="42" y="20" width="36" height="6" fill="${hp.b}" opacity=".6"/>
        <circle cx="60" cy="9" r="2.5" fill="#FFD700" opacity=".9"/>
        <circle cx="47" cy="6" r="2" fill="#FFD700" opacity=".8"/>
        <circle cx="73" cy="6" r="2" fill="#FFD700" opacity=".8"/>`;
    } else if (hp.type === 'magic') {
      // 마법 모자: 크고 위로 (이미 수정됨)
      helmSvg = `
        <polygon points="60,-4 44,24 76,24" fill="${hp.a}"/>
        <polygon points="60,-4 57,24 63,24" fill="${hp.b}"/>
        <rect x="40" y="21" width="40" height="8" rx="4" fill="${hp.a}"/>
        <rect x="40" y="21" width="40" height="3" fill="${hp.b}" opacity=".5"/>
        <circle cx="60" cy="-4" r="3" fill="${hp.b}" opacity=".7"/>`;
    } else if (hp.type === 'helm' || hp.type === 'leather') {
      // 투구/가죽: 머리 전체 덮게
      helmSvg = `
        <rect x="38" y="14" width="44" height="24" rx="9" fill="${hp.a}"/>
        <rect x="38" y="14" width="44" height="10" rx="9" fill="${hp.b}"/>
        <rect x="38" y="32" width="12" height="8" rx="3" fill="${hp.b}"/>
        <rect x="70" y="32" width="12" height="8" rx="3" fill="${hp.b}"/>
        <rect x="40" y="16" width="7" height="3" rx="1" fill="rgba(255,255,255,.3)"/>`;
    } else {
      // cloth: 부드러운 천 모자
      helmSvg = `
        <path d="M40,28 Q38,10 60,8 Q82,10 80,28" fill="${hp.a}"/>
        <path d="M40,28 Q38,10 60,8 Q82,10 80,28 Q72,18 60,18 Q48,18 40,28Z" fill="${hp.b}" opacity=".5"/>
        <ellipse cx="60" cy="28" rx="22" ry="4" fill="${hp.a}"/>`;
    }
  }

  // ── 에픽 글로우 ──
  const isEpic = ['e_b8','e_b9','e_b10'].includes(bodyId);
  const glowEl = isEpic ? `<ellipse cx="60" cy="148" rx="28" ry="6" fill="${bp.a}" opacity=".3"/>` : '';

  // ── 캐릭터 픽셀아트 ──
  return `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;image-rendering:pixelated">

  ${glowEl}
  <!-- 그림자 -->
  <ellipse cx="60" cy="152" rx="22" ry="4" fill="rgba(0,0,0,.25)"/>

  <!-- 무기는 오른손 다음에 그림 -->

  <!-- ═══ 신발 ═══ -->
  <rect x="42" y="130" width="15" height="12" rx="3" fill="${shoe}"/>
  <rect x="63" y="130" width="15" height="12" rx="3" fill="${shoe}"/>
  <rect x="40" y="135" width="19" height="7" rx="3" fill="${shoe}"/>
  <rect x="61" y="135" width="19" height="7" rx="3" fill="${shoe}"/>
  <rect x="42" y="130" width="15" height="3" fill="rgba(255,255,255,.15)" rx="1"/>
  <rect x="63" y="130" width="15" height="3" fill="rgba(255,255,255,.15)" rx="1"/>

  <!-- ═══ 다리 ═══ -->
  <rect x="44" y="104" width="13" height="28" rx="4" fill="${bp.b}"/>
  <rect x="63" y="104" width="13" height="28" rx="4" fill="${bp.b}"/>
  <rect x="44" y="104" width="13" height="3" fill="${bp.a}" opacity=".5"/>
  <rect x="63" y="104" width="13" height="3" fill="${bp.a}" opacity=".5"/>

  <!-- ═══ 몸통 ═══ -->
  <rect x="36" y="64" width="48" height="44" rx="7" fill="${bp.a}"/>
  <rect x="36" y="64" width="48" height="8" rx="7" fill="${bp.c}" opacity=".4"/>
  <rect x="38" y="68" width="5" height="16" rx="2" fill="${bp.c}" opacity=".3"/>
  <!-- 중앙선 -->
  <rect x="58" y="68" width="4" height="36" rx="2" fill="${bp.b}" opacity=".35"/>
  <!-- 버클 -->
  <rect x="36" y="104" width="48" height="4" rx="2" fill="${bp.belt||'#795548'}"/>
  <rect x="56" y="103" width="8" height="6" rx="2" fill="${bp.belt||'#795548'}"/>
  <rect x="58" y="104" width="4" height="4" rx="1" fill="#FFD700" opacity=".7"/>

  <!-- ═══ 왼팔 ═══ -->
  <rect x="18" y="65" width="20" height="11" rx="6" fill="${bp.a}"/>
  <rect x="14" y="74" width="10" height="24" rx="5" fill="${bp.a}"/>
  <rect x="14" y="74" width="10" height="4" fill="${bp.c}" opacity=".3" rx="2"/>
  <!-- 왼장갑 -->
  <ellipse cx="19" cy="100" rx="8" ry="7" fill="${glv}"/>
  <ellipse cx="19" cy="97" rx="6" ry="3" fill="rgba(255,255,255,.15)"/>

  <!-- ═══ 오른팔 ═══ -->
  <rect x="82" y="65" width="20" height="11" rx="6" fill="${bp.a}"/>
  <rect x="96" y="74" width="10" height="24" rx="5" fill="${bp.a}"/>
  <rect x="96" y="74" width="10" height="4" fill="${bp.c}" opacity=".3" rx="2"/>
  <!-- 오른장갑 -->
  <ellipse cx="101" cy="100" rx="8" ry="7" fill="${glv}"/>
  <ellipse cx="101" cy="97" rx="6" ry="3" fill="rgba(255,255,255,.15)"/>

  <!-- ═══ 무기 (오른손이 쥔 위치에서 그림) ═══ -->
  ${wp ? (wp.type === 'sword' ? `
    <g transform="rotate(-15, 101, 100)">
      <!-- 손잡이: 손 중앙(101,100)에서 위로 -->
      <rect x="98" y="88" width="6" height="16" rx="2" fill="${wp.b}"/>
      <rect x="99" y="88" width="2" height="16" fill="rgba(255,255,255,.25)"/>
      <!-- 날밑(가드) -->
      <rect x="92" y="84" width="18" height="5" rx="2" fill="${wp.b}"/>
      <rect x="99" y="85" width="4" height="3" fill="#FFD700" opacity=".8"/>
      <!-- 칼날: 손잡이 위에서 쭉 올라감 -->
      <rect x="99" y="40" width="4" height="46" rx="1" fill="${wp.a}"/>
      <rect x="99" y="40" width="2" height="46" fill="rgba(255,255,255,.35)"/>
      <!-- 칼끝 -->
      <polygon points="99,40 103,40 101,28" fill="${wp.a}"/>
      <polygon points="100,40 102,40 101,32" fill="rgba(255,255,255,.4)"/>
    </g>
  ` : `
    <g transform="rotate(5, 101, 100)">
      <!-- 지팡이 몸체: 손 위치에서 아래로 조금, 위로 길게 -->
      <rect x="99" y="42" width="4" height="70" rx="2" fill="${wp.b}"/>
      <rect x="100" y="42" width="2" height="70" fill="rgba(255,255,255,.2)"/>
      <!-- 손잡이 부분 강조 -->
      <rect x="98" y="88" width="6" height="14" rx="3" fill="${wp.b}" opacity=".8"/>
      <rect x="98" y="88" width="6" height="4" rx="2" fill="rgba(255,255,255,.15)"/>
      <!-- 오브 -->
      <circle cx="101" cy="36" r="11" fill="${wp.b}"/>
      <circle cx="101" cy="36" r="8" fill="${wp.a}"/>
      <circle cx="101" cy="36" r="4" fill="white" opacity=".45"/>
      <circle cx="98" cy="33" r="2" fill="white" opacity=".3"/>
    </g>
  `) : ''}

  <!-- ═══ 목 ═══ -->
  <rect x="54" y="56" width="12" height="10" rx="3" fill="${skin}"/>

  <!-- ═══ 얼굴 (둥근 픽셀 스타일) ═══ -->
  <rect x="38" y="28" width="44" height="32" rx="10" fill="${skin}"/>
  <rect x="36" y="34" width="4" height="16" rx="3" fill="${skin}"/>
  <rect x="80" y="34" width="4" height="16" rx="3" fill="${skin}"/>
  <rect x="38" y="26" width="44" height="8" rx="8" fill="${skin}"/>
  <!-- 얼굴 하이라이트 -->
  <rect x="40" y="30" width="10" height="8" rx="4" fill="rgba(255,255,255,.12)"/>
  <!-- 볼 홍조 -->
  <ellipse cx="46" cy="46" rx="5" ry="3" fill="#FF8A80" opacity=".35"/>
  <ellipse cx="74" cy="46" rx="5" ry="3" fill="#FF8A80" opacity=".35"/>

  <!-- ═══ 눈 ═══ -->
  <!-- 흰자 -->
  <rect x="47" y="35" width="10" height="8" rx="3" fill="white"/>
  <rect x="63" y="35" width="10" height="8" rx="3" fill="white"/>
  <!-- 눈동자 -->
  <rect x="50" y="36" width="5" height="6" rx="2" fill="${s.charType===2?'#7B1FA2':s.charType===3?'#1565C0':s.charType===4?'#2E7D32':'#3E2723'}"/>
  <rect x="66" y="36" width="5" height="6" rx="2" fill="${s.charType===2?'#7B1FA2':s.charType===3?'#1565C0':s.charType===4?'#2E7D32':'#3E2723'}"/>
  <!-- 눈빛 -->
  <rect x="51" y="37" width="2" height="2" rx="1" fill="white" opacity=".8"/>
  <rect x="67" y="37" width="2" height="2" rx="1" fill="white" opacity=".8"/>

  <!-- ═══ 코 ═══ -->
  <rect x="58" y="44" width="4" height="3" rx="1" fill="${skinD}"/>

  <!-- ═══ 입 ═══ -->
  ${isFemale
    ? `<rect x="54" y="50" width="12" height="3" rx="2" fill="#EF9A9A"/>
       <rect x="56" y="50" width="8" height="2" rx="1" fill="#E57373"/>`
    : `<rect x="54" y="50" width="12" height="3" rx="2" fill="${skinD}"/>
       <rect x="56" y="51" width="8" height="1" rx="1" fill="rgba(0,0,0,.1)"/>`}

  <!-- ═══ 머리카락 ═══ -->
  ${isFemale ? `
    <rect x="38" y="16" width="44" height="16" rx="8" fill="${hair}"/>
    <rect x="34" y="24" width="8" height="28" rx="4" fill="${hair}"/>
    <rect x="78" y="24" width="8" height="28" rx="4" fill="${hair}"/>
    <rect x="38" y="14" width="44" height="8" rx="6" fill="${hairH}" opacity=".5"/>
    <rect x="42" y="16" width="12" height="4" rx="2" fill="rgba(255,255,255,.15)"/>
  ` : `
    <rect x="38" y="16" width="44" height="16" rx="8" fill="${hair}"/>
    <rect x="36" y="22" width="6" height="14" rx="4" fill="${hair}"/>
    <rect x="78" y="22" width="6" height="14" rx="4" fill="${hair}"/>
    <rect x="38" y="14" width="44" height="8" rx="6" fill="${hairH}" opacity=".5"/>
    <rect x="42" y="16" width="14" height="3" rx="2" fill="rgba(255,255,255,.15)"/>
  `}

  <!-- ═══ 투구 (머리카락 위) ═══ -->
  ${helmSvg}

</svg>`;
}

function renderCharCard(svgWrapId, cnameId, jobId, combatId, equipId, abilityId, s) {
  const svgWrap = document.getElementById(svgWrapId);
  if (svgWrap) svgWrap.innerHTML = buildCharSVG(s);
  document.getElementById(cnameId).textContent = s.name;
  document.getElementById(jobId).textContent   = '⚗️ ' + (s.job || '');
  const combatNames = {atk:'공격력',def:'방어력',mag:'마력',spd:'속도'};
  document.getElementById(combatId).innerHTML = Object.entries(s.combat||{}).map(([k,v]) =>
    `<div class="combat-stat"><span>${combatNames[k]||k}</span><span class="combat-val">${v}</span></div>`
  ).join('');
  const slotDefs = [{k:'head',icon:'🪖',l:'머리'},{k:'body',icon:'🥋',l:'옷'},
    {k:'weapon',icon:'⚔️',l:'무기'},{k:'glove',icon:'🧤',l:'장갑'},{k:'shoe',icon:'👟',l:'신발'}];
  document.getElementById(equipId).innerHTML = slotDefs.map(sl => {
    const eqId   = s.equipmentIds?.[sl.k];
    const eqItem = eqId ? GAME_DATA.getItemById(eqId) : null;
    const name   = eqItem ? eqItem.name : (s.equipment?.[sl.k] || '');
    return `<div class="equip-slot ${name?'has':''}" onclick="openModal('m-inv');renderInv()">
      <span class="eslot-icon">
        ${eqId ? buildEquipIcon(sl.k, eqId) : `<span style="font-size:1.4rem">${sl.icon}</span>`}
      </span>
      <div class="eslot-info">
        <div class="eslot-type">${sl.l}</div>
        <div class="eslot-name">${name||'없음'}</div>
      </div>
    </div>`;
  }).join('');
  const abDefs = [{k:'read',l:'독서',c:'ab-read'},{k:'study',l:'학습',c:'ab-study'},
    {k:'art',l:'예술',c:'ab-art'},{k:'value',l:'가치',c:'ab-moral'},{k:'health',l:'건강',c:'ab-health'},
    {k:'life',l:'생활',c:'ab-life'}];
  const maxV = Math.max(10, ...Object.values(s.stats||{}));
  document.getElementById(abilityId).innerHTML =
    // 독서 (특수 능력치)
    `<div style="font-size:.6rem;color:var(--txt3);letter-spacing:.05em;margin-bottom:.25rem;opacity:.7">
      ✨ 특수 능력치</div>` +
    abDefs.filter(ab => ab.k === 'read').map(ab => {
      const v = s.stats?.[ab.k]||0;
      const display = Number.isInteger(v) ? v : v.toFixed(1);
      return `<div class="ab-row ${ab.c}" style="opacity:.85">
        <span class="ab-name" style="color:var(--sky)">${ab.l}</span>
        <div class="ab-bar" style="background:rgba(93,173,226,.12)">
          <div class="ab-fill" style="width:${Math.min(100,v/maxV*100)}%;background:var(--sky)"></div>
        </div>
        <span class="ab-val" style="color:var(--sky)">${display}</span>
      </div>`;
    }).join('') +
    // 구분선
    `<div style="height:1px;background:rgba(255,255,255,.07);margin:.45rem 0"></div>
    <div style="font-size:.6rem;color:var(--txt3);letter-spacing:.05em;margin-bottom:.25rem;opacity:.7">
      ⚔️ 전투 활동 능력치</div>` +
    // 나머지 능력치
    abDefs.filter(ab => ab.k !== 'read').map(ab => {
      const v = s.stats?.[ab.k]||0;
      const display = Number.isInteger(v) ? v : v.toFixed(1);
      return `<div class="ab-row ${ab.c}">
        <span class="ab-name">${ab.l}</span>
        <div class="ab-bar"><div class="ab-fill" style="width:${Math.min(100,v/maxV*100)}%"></div></div>
        <span class="ab-val">${display}</span>
      </div>`;
    }).join('');
}

function renderMobile() {
  const s = CUR;
  renderCharCard('mob-char-svg-wrap','mob-char-cname','mob-char-job','mob-char-combat','mob-equip-grid','mob-ability-bars', s);
  document.getElementById('mob-main-tab').innerHTML = buildMainHTML();
}

function renderMain() {
  try {
    document.getElementById('main-area').innerHTML = buildMainHTML();
  } catch(e) {
    console.error('renderMain 오류:', e);
    document.getElementById('main-area').innerHTML = `
      <div style="padding:2rem;text-align:center;color:var(--txt2)">
        <div style="font-size:2rem;margin-bottom:.5rem">⚠️</div>
        <div style="font-size:.85rem">화면 로딩 중 오류가 발생했어요</div>
        <div style="font-size:.72rem;color:var(--txt3);margin-top:.3rem">${e.message}</div>
        <button onclick="renderAll()" style="margin-top:1rem;padding:.5rem 1rem;border-radius:8px;
          background:var(--gold);color:#1a1a1a;border:none;font-weight:700;cursor:pointer">다시 시도</button>
      </div>`;
  }
}

function buildMainHTML() {
  const s        = CUR;
  const settings = DB.getSettings();
  const db       = DB.load();
  const pendingCount  = (s.pendingRewards||[]).length;
  const approvedCount = (s.pendingRewards||[]).filter(r=>r.approved===true).length;
  const waitingCount  = pendingCount - approvedCount;
  const canFight      = Utils.canFightMonster(s);
  const attemptsLeft  = Utils.monsterAttemptsLeft(s);
  const farmReady     = hasFarmReady();
  const isFriday      = new Date().getDay() === 5;
  const canPromo      = Utils.isPromotionLevel(s.level) && !s.promotionPending && !(s.promotedLevels||[]).includes(s.level)
                        && !DB.getPromotionRequests().find(r=>r.studentId===s.id);
  const monsterLimit  = Utils._getBattleLimit();

  // ── 긴급 알림 배너 ──
  const alerts = [];

  if (waitingCount > 0)
    alerts.push(`<div class="reward-banner" style="margin-bottom:.6rem;opacity:.85">
      <div class="rb-icon">⏳</div>
      <div class="rb-body"><div class="rb-title" style="color:var(--sky)">퀘스트 승인 대기중 ${waitingCount}건</div>
      <div class="rb-desc">${(s.pendingRewards||[]).filter(r=>!r.approved).map(r=>r.label).join(' · ')}</div></div>
      <div style="font-size:.72rem;color:var(--txt3);flex-shrink:0;padding:.4rem .6rem">선생님 확인 중</div>
    </div>`);
  if (canPromo)
    alerts.push(`<div class="promo-banner" onclick="openModal('m-promo')" style="cursor:pointer;margin-bottom:.6rem">
      <div class="rb-icon">⬆️</div>
      <div class="rb-body"><div class="rb-title gold">승급 가능! Lv.${s.level}</div>
      <div class="rb-desc">승급 신청을 해보세요!</div></div>
      <button class="btn-gold" style="padding:.4rem .9rem;font-size:.78rem;flex-shrink:0">신청</button>
    </div>`);
  if (isFriday && settings.bossActive)
    alerts.push(`<div class="boss-banner" onclick="openBoss()" style="margin-bottom:.6rem">
      <div style="font-size:2rem">${settings.bossIcon||'🧌'}</div>
      <div style="flex:1"><div style="font-weight:900;color:var(--red)">${settings.bossName||'금요일 보스'} 출현!</div>
      <div style="font-size:.76rem;color:var(--txt2)">보상: 💰${settings.bossGold||150}G + 특별 씨앗</div></div>
      <button class="bb-btn">도전!</button>
    </div>`);

  // ── 오늘의 감정 카드 ──
  const today = Utils.todayStr();
  const weekStart = Utils.weekStartStr();
  const amEmo = DB_EMOTION.get(s.id, today, 'am');
  const pmEmo = DB_EMOTION.get(s.id, today, 'pm');
  const claimableRewards = getClaimableEmotionRewards(s, weekStart);
  const rewardBtns = claimableRewards.length > 0
    ? `<div style="margin-top:.7rem;border-top:1px solid rgba(255,255,255,.08);padding-top:.6rem">
        <div style="font-size:.72rem;color:var(--gold);font-weight:700;margin-bottom:.4rem">🎁 받을 수 있는 보상</div>
        ${claimableRewards.map(r => `
          <div style="display:flex;align-items:center;gap:.6rem;padding:.35rem 0">
            <div style="flex:1">
              <div style="font-size:.78rem;font-weight:700">${r.label}</div>
              <div style="font-size:.68rem;color:var(--txt3)">${r.desc} · +${r.exp}EXP +${r.gold}G</div>
            </div>
            <button onclick="claimEmotionReward('${r.id}')"
              style="padding:.3rem .7rem;border-radius:8px;background:var(--gold);color:#1a1a1a;
              border:none;font-size:.72rem;font-weight:700;cursor:pointer;font-family:inherit">받기</button>
          </div>`).join('')}
      </div>` : '';
  const emotionCard = `
  <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);
    border-radius:16px;padding:.9rem;margin-bottom:.8rem">
    <div style="font-size:.8rem;font-weight:700;color:var(--gold);margin-bottom:.7rem">💭 오늘의 감정</div>
    <div style="display:flex;gap:.6rem">
      <div onclick="openEmotionModal('am')" style="flex:1;border-radius:12px;padding:.6rem;text-align:center;cursor:pointer;
        background:${amEmo ? 'rgba(46,204,113,.12)' : 'rgba(255,255,255,.04)'};
        border:1.5px solid ${amEmo ? 'rgba(46,204,113,.3)' : 'rgba(255,255,255,.1)'}">
        <div style="font-size:.7rem;color:var(--txt3);margin-bottom:.3rem">🌅 오전</div>
        ${amEmo
          ? `<div style="font-size:1.4rem">${amEmo.emotionIcon}</div>
             <div style="font-size:.72rem;font-weight:700;margin-top:.2rem">${amEmo.emotionLabel}</div>
             <div style="font-size:.65rem;color:var(--txt3)">${amEmo.levelLabel}</div>`
          : `<div style="font-size:1.4rem">○</div>
             <div style="font-size:.7rem;color:var(--txt3)">입력하기</div>`}
      </div>
      <div onclick="openEmotionModal('pm')" style="flex:1;border-radius:12px;padding:.6rem;text-align:center;cursor:pointer;
        background:${pmEmo ? 'rgba(93,173,226,.12)' : 'rgba(255,255,255,.04)'};
        border:1.5px solid ${pmEmo ? 'rgba(93,173,226,.3)' : 'rgba(255,255,255,.1)'}">
        <div style="font-size:.7rem;color:var(--txt3);margin-bottom:.3rem">🌇 오후</div>
        ${pmEmo
          ? `<div style="font-size:1.4rem">${pmEmo.emotionIcon}</div>
             <div style="font-size:.72rem;font-weight:700;margin-top:.2rem">${pmEmo.emotionLabel}</div>
             <div style="font-size:.65rem;color:var(--txt3)">${pmEmo.levelLabel}</div>`
          : `<div style="font-size:1.4rem">○</div>
             <div style="font-size:.7rem;color:var(--txt3)">입력하기</div>`}
      </div>
    </div>
    ${rewardBtns}
  </div>`;

  // ── 오늘 할 일 카드 ──
  const todos = [];

  // 승인된 보상은 자동 지급됨 (받기 버튼 단계 제거)
  if (waitingCount > 0)
    todos.push({type:'info', icon:'⏳', badge:waitingCount,
      title:`퀘스트 승인 대기중 ${waitingCount}건`,
      sub:(s.pendingRewards||[]).filter(r=>!r.approved).slice(0,2).map(r=>r.label).join(' · '),
      action:null, btnLabel:'대기중'});

  // 2순위: 시든 작물 경고
  const witheredCount = (s.farm||[]).filter(p=>{
    const sd=Utils.getSeedByCrop(p.crop);
    return sd && Utils.cropReady(p.planted,sd.growHours) && (Date.now()-p.planted) > sd.growHours*3600000*3;
  }).length;
  if (witheredCount > 0)
    todos.push({type:'urgent', icon:'🍂', badge:null,
      title:`작물 ${witheredCount}개가 시들고 있어요!`,
      sub:'수확이 늦으면 60%만 받아요. 지금 바로 수확하세요',
      action:"openModal('m-farm');renderFarmModal()", btnLabel:'수확'});

  // 3순위: 일반 수확
  if (farmReady && witheredCount === 0) {
    const readyCount = (s.farm||[]).filter(p=>{
      const sd=Utils.getSeedByCrop(p.crop); return sd&&Utils.cropReady(p.planted,sd.growHours);
    }).length;
    todos.push({type:'farm urgent', icon:'🌾', badge:readyCount,
      title:`작물 ${readyCount}개 수확 가능!`,
      sub:'지금 바로 수확하러 가기',
      action:"openModal('m-farm');renderFarmModal()", btnLabel:'수확'});
  }

  // 4순위: 승급 가능
  if (canPromo)
    todos.push({type:'promo', icon:'⬆️', badge:null,
      title:`Lv.${s.level} 승급 신청 가능!`,
      sub:'선생님 승인 후 특별 보상을 받을 수 있어요',
      action:"openModal('m-promo')", btnLabel:'신청'});

  // 5순위: 몬스터 도전
  if (canFight)
    todos.push({type:'monster', icon:'⚔️', badge:attemptsLeft,
      title:`몬스터 도전 ${attemptsLeft}회 남았어요`,
      sub:`오늘 ${monsterLimit}회 중 ${monsterLimit-attemptsLeft}회 완료`,
      action:"openMonsterModal()", btnLabel:'도전'});

  // 6순위: 퀘스트 → 미션 섹션으로 통합했으므로 제거

  // 7순위: 힌트성
  const todayBook = (s.books||[]).find(b=>b.date===Utils.todayStr());
  if (!todayBook)
    todos.push({type:'hint', icon:'📚', badge:null,
      title:'오늘 독서 기록 없음',
      sub:'읽은 책을 기록하면 독서 스탯이 올라요',
      action:"openModal('m-house');renderHouse()", btnLabel:null});

  const hasSeed = (s.inventory||[]).some(i=>GAME_DATA.seeds.find(sd=>sd.id===i.id));
  if ((s.farm||[]).length === 0 && hasSeed)
    todos.push({type:'farm', icon:'🌱', badge:null,
      title:'농장이 비어있어요',
      sub:'씨앗을 심으면 골드를 벌 수 있어요',
      action:"openModal('m-farm');renderFarmModal()", btnLabel:'심기'});

  if (todos.length === 0)
    todos.push({type:'done', icon:'🌟', badge:null,
      title:'오늘 할 일 완료!',
      sub:'정말 열심히 했어요. 내일도 파이팅! 💪',
      action:'', btnLabel:null});

  const todoHtml = todos.map(t=>`
    <div class="todo-card ${t.type}" onclick="${t.action}" style="${t.action?'cursor:pointer':''}">
      <div class="todo-icon">${t.icon}</div>
      <div class="todo-body">
        <div class="todo-title">${t.title}${t.badge!=null?`<span class="todo-badge">${t.badge}</span>`:''}</div>
        <div class="todo-sub">${t.sub}</div>
      </div>
      ${t.btnLabel ? `<button class="todo-btn ${t.type}" onclick="event.stopPropagation();${t.action}">${t.btnLabel}</button>` : t.action ? '<div class="todo-arrow">›</div>' : ''}
    </div>`).join('');

  // ── 오늘의 미션 (퀘스트 인라인 체크리스트) ──
  const boardQuests = (db.boardQuests||[]).filter(q=>q.active!==false);
  // 날짜 기반 완료 판단 - 일일은 오늘, 주간은 이번주, 과제/특별은 영구
  const _allQuests = db.quests||[];
  const isDoneByType = (qId, qType) => {
    if (typeof Utils.isQuestDoneToday === 'function') {
      return Utils.isQuestDoneToday(_allQuests, s.id, qId, qType);
    }
    // 폴백: 단순 완료 여부만 체크
    return _allQuests.some(q => q.studentId===s.id && q.boardQuestId===qId);
  };
  const activeBQIds = new Set(boardQuests.map(q=>q.id));
  const questLogs   = db.quests || [];

  const missionHtml = boardQuests.length > 0
    ? boardQuests.map(q=>{
        const status  = Utils.questStatus(s.id, q.id, q.type, questLogs, s.pendingRewards, activeBQIds);
        const done    = status === 'done';
        const pending = status === 'pending';
        const typeLabel = {daily:'📋 일일',weekly:'📅 주간',special:'✏️ 과제',event:'⭐ 특별'}[q.type]||'📋';
        return `
        <div class="mission-row ${done?'done':pending?'pending':''}"
          onclick="${(!done&&!pending)?`submitQuestFromMain('${q.id}')`:''}"
          style="cursor:${(!done&&!pending)?'pointer':'default'}">
          <div class="mission-check ${done?'done':pending?'wait':''}">
            ${done?'✓':pending?'⏳':''}
          </div>
          <span style="font-size:1rem;flex-shrink:0">${q.icon||'📋'}</span>
          <div style="flex:1;min-width:0">
            <div class="mission-name">${q.name}</div>
            <div style="font-size:.68rem;color:var(--txt3)">${typeLabel}${q.dueDate?` · 마감 ${q.dueDate}`:''}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.15rem;flex-shrink:0">
            <span class="mission-reward">+${q.exp}EXP</span>
            ${done?`<span style="font-size:.65rem;color:var(--emerald);font-weight:700">완료!</span>`
              :pending?`<span style="font-size:.65rem;color:var(--gold)">확인중...</span>`
              :`<span style="font-size:.65rem;color:var(--txt3)">탭하면 신청</span>`}
          </div>
        </div>`;
      }).join('')
    : `<div style="font-size:.78rem;color:var(--txt3);padding:1rem 0;text-align:center">
        선생님이 퀘스트를 올리면 여기에 표시돼요 📋
      </div>`;

  const allStudents = DB.getStudents().filter(st=>st.id!==s.id);
  const {cols:_fc, rows:_fr} = getFarmLayout(s.level||1);
  const farmCells   = buildFarmMiniCells(_fc * _fr, _fc);
  const _allMons    = getActiveMonsters();
  const alive       = _allMons.filter(m=>!(s.monsterLog||[]).includes(m.name));
  const recMon      = alive.find(m=>m.recLv<=s.level)||alive[0]||_allMons[0];

  // 첫 번째 할 일은 강조, 나머지는 요약
  const topTodo   = todos[0];
  const restTodos = todos.slice(1);

  const topTodoHtml = topTodo ? `
    <div class="todo-card ${topTodo.type}" onclick="${topTodo.action}" style="${topTodo.action?'cursor:pointer':''}
      border:2px solid rgba(255,215,0,.4);background:rgba(255,215,0,.07);padding:.9rem 1rem;">
      <div class="todo-icon" style="font-size:1.5rem">${topTodo.icon}</div>
      <div class="todo-body">
        <div class="todo-title" style="font-size:.92rem;font-weight:800">${topTodo.title}${topTodo.badge!=null?`<span class="todo-badge">${topTodo.badge}</span>`:''}</div>
        <div class="todo-sub">${topTodo.sub}</div>
      </div>
      ${topTodo.btnLabel
        ? `<button class="todo-btn ${topTodo.type}" onclick="event.stopPropagation();${topTodo.action}"
            style="font-size:.82rem;padding:.45rem .9rem;font-weight:800">${topTodo.btnLabel}</button>`
        : topTodo.action ? '<div class="todo-arrow" style="font-size:1.3rem">›</div>' : ''}
    </div>` : '';

  const restTodoHtml = restTodos.length > 0 ? restTodos.map(t=>`
    <div class="todo-card ${t.type}" onclick="${t.action}" style="${t.action?'cursor:pointer':''}opacity:.8;">
      <div class="todo-icon">${t.icon}</div>
      <div class="todo-body">
        <div class="todo-title" style="font-size:.78rem">${t.title}${t.badge!=null?`<span class="todo-badge">${t.badge}</span>`:''}</div>
      </div>
      ${t.btnLabel ? `<button class="todo-btn ${t.type}" style="font-size:.68rem;padding:.3rem .6rem" onclick="event.stopPropagation();${t.action}">${t.btnLabel}</button>` : t.action ? '<div class="todo-arrow">›</div>' : ''}
    </div>`).join('') : '';

  return `
    <!-- 오늘의 링크 — 최상단 -->
    ${(()=>{
      const todayLinks = (DB.getSettings().todayLinks||[]).filter(l=>l.url&&l.title);
      if (!todayLinks.length) return '';
      return `<div style="background:rgba(93,173,226,.07);border:1px solid rgba(93,173,226,.2);
        border-radius:12px;padding:.65rem .9rem;margin-bottom:.5rem">
        <div style="font-size:.7rem;font-weight:700;color:var(--sky);margin-bottom:.4rem">🔗 오늘의 링크</div>
        ${todayLinks.map(l=>`
          <a href="${l.url}" target="_blank" rel="noopener"
            style="display:flex;align-items:center;gap:.5rem;padding:.3rem 0;
              text-decoration:none;border-bottom:1px solid rgba(255,255,255,.05)">
            <span style="font-size:.8rem;color:var(--sky);font-weight:600">${l.title}</span>
            <span style="font-size:.63rem;color:var(--txt3);margin-left:auto">열기 →</span>
          </a>`).join('')}
      </div>`;
    })()}

    <!-- 이번 주 목표 카드 -->
    ${(()=>{
      const wk   = Utils.weekKey();
      const goal = DB.getWeeklyGoal(s.id, wk);
      if (!goal) return `
        <div onclick="openWeeklyModal('monday')" style="cursor:pointer;
          background:rgba(93,173,226,.06);border:1.5px dashed rgba(93,173,226,.25);
          border-radius:12px;padding:.6rem .9rem;margin-bottom:.5rem;
          display:flex;align-items:center;gap:.6rem">
          <span style="font-size:1.2rem">📅</span>
          <div style="flex:1">
            <div style="font-size:.75rem;font-weight:700;color:var(--sky)">이번 주 목표</div>
            <div style="font-size:.72rem;color:var(--txt3)">이번 주 다짐을 아직 쓰지 않았어요</div>
          </div>
          <span style="font-size:.72rem;color:var(--sky);font-weight:700;
            background:rgba(93,173,226,.15);border-radius:8px;padding:.2rem .6rem;white-space:nowrap">작성하기</span>
        </div>`;
      return `
        <div onclick="openHouseTab('weekly')" style="cursor:pointer;
          background:rgba(93,173,226,.07);border:1.5px solid rgba(93,173,226,.2);
          border-radius:12px;padding:.65rem .9rem;margin-bottom:.5rem">
          <div style="font-size:.68rem;font-weight:700;color:var(--sky);margin-bottom:.45rem">
            📅 이번 주 목표 · 이번 주 다짐을 기억해봐요
          </div>
          <div style="display:flex;gap:1rem;flex-wrap:wrap">
            <span style="font-size:.8rem;color:var(--txt1)">💪 <b>${goal.focusArea||''}</b></span>
            <span style="font-size:.8rem;color:var(--txt1)">🎯 <b>${goal.goalText||''}</b></span>
            <span style="font-size:.8rem;color:var(--txt1)">🌟 <b>${goal.mindset||''}</b></span>
          </div>
        </div>`;
    })()}
    ${alerts.join('')}

    <!-- ① 핵심 할 일 1개 강조 + 나머지 요약 -->
    <div class="sec-label">✅ 오늘 할 일</div>
    ${topTodoHtml}
    ${restTodos.length > 0 ? `
      <div id="rest-todo-wrap" style="display:none">${restTodoHtml}</div>
      <button onclick="toggleRestTodo()"
        id="rest-todo-btn"
        style="width:100%;padding:.35rem;background:none;border:1px solid rgba(255,255,255,.08);
          border-radius:8px;color:var(--txt3);font-size:.72rem;cursor:pointer;
          font-family:inherit;margin-top:.3rem;margin-bottom:.3rem">
        ▼ 할 일 더보기 (${restTodos.length}개)
      </button>` : ''}

    <!-- ② 주요 메뉴 4개 -->
    <div class="sec-label">🎮 메뉴</div>
    <div class="menu-grid" style="margin-bottom:.5rem">
      <div class="menu-tile mt-quest" onclick="openQuestModal()">
        ${pendingCount>0?`<div class="tile-notif">${pendingCount}</div>`:''}
        <div class="tile-icon">📋</div><div class="tile-name">퀘스트</div>
        <div class="tile-desc">확인 · 보상</div>
      </div>
      <div class="menu-tile mt-monster" onclick="openMonsterModal()">
        ${canFight?`<div class="tile-notif">${attemptsLeft}회</div>`:''}
        <div class="tile-icon">⚔️</div><div class="tile-name">몬스터</div>
        <div class="tile-desc">${canFight?`${attemptsLeft}회 남음`:'오늘 완료'}</div>
      </div>
      <div class="menu-tile mt-shop" onclick="openModal('m-shop');renderShop()">
        <div class="tile-icon">🏪</div><div class="tile-name">상점</div>
        <div class="tile-desc">장비·씨앗</div>
      </div>
      <div class="menu-tile mt-farm" onclick="openModal('m-farm');renderFarmModal()">
        ${farmReady?'<div class="tile-notif">수확!</div>':''}
        <div class="tile-icon">🌱</div><div class="tile-name">농장</div>
        <div class="tile-desc">심기 · 수확</div>
      </div>
      <div class="menu-tile" onclick="openModal('m-inv');renderInv()"
        style="border-color:rgba(255,255,255,.1)">
        <div class="tile-icon">🎒</div><div class="tile-name">인벤토리</div>
        <div class="tile-desc">아이템</div>
      </div>
      <div class="menu-tile" onclick="openModal('m-rank');renderRankingModal()"
        style="border-color:rgba(255,215,0,.2)">
        <div class="tile-icon">🏆</div><div class="tile-name">랭킹</div>
        <div class="tile-desc">우리반 순위</div>
      </div>
    </div>

    <!-- 내집 섹션 -->
    <div class="sec-label">🏠 내 집</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem;margin-bottom:.5rem">
      <div onclick="openHouseTab('stats')"
        style="padding:.5rem .2rem;text-align:center;border-radius:10px;cursor:pointer;
          background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)">
        <div style="font-size:1.1rem">📊</div>
        <div style="font-size:.63rem;color:var(--txt2);margin-top:.12rem">기록</div>
      </div>
      <div onclick="openHouseTab('weekly')"
        style="padding:.5rem .2rem;text-align:center;border-radius:10px;cursor:pointer;
          background:rgba(255,255,255,.04);border:1px solid rgba(93,173,226,.2)">
        <div style="font-size:1.1rem">📅</div>
        <div style="font-size:.63rem;color:var(--sky);margin-top:.12rem;font-weight:700">주간 다짐</div>
      </div>
      <div onclick="openHouseTab('book')"
        style="padding:.5rem .2rem;text-align:center;border-radius:10px;cursor:pointer;
          background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)">
        <div style="font-size:1.1rem">📚</div>
        <div style="font-size:.63rem;color:var(--txt2);margin-top:.12rem">독서</div>
      </div>
      <div onclick="openHouseTab('deco')"
        style="padding:.5rem .2rem;text-align:center;border-radius:10px;cursor:pointer;
          background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)">
        <div style="font-size:1.1rem">🌸</div>
        <div style="font-size:.63rem;color:var(--txt2);margin-top:.12rem">인테리어</div>
      </div>
      <div onclick="openHouseTab('artwork')"
        style="padding:.5rem .2rem;text-align:center;border-radius:10px;cursor:pointer;
          background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)">
        <div style="font-size:1.1rem">🖼️</div>
        <div style="font-size:.63rem;color:var(--txt2);margin-top:.12rem">작품</div>
      </div>
      <div onclick="openHouseTab('memory')"
        style="padding:.5rem .2rem;text-align:center;border-radius:10px;cursor:pointer;
          background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)">
        <div style="font-size:1.1rem">📸</div>
        <div style="font-size:.63rem;color:var(--txt2);margin-top:.12rem">추억</div>
      </div>
      <div onclick="openHouseTab('emotion')"
        style="padding:.5rem .2rem;text-align:center;border-radius:10px;cursor:pointer;
          background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)">
        <div style="font-size:1.1rem">💭</div>
        <div style="font-size:.63rem;color:var(--txt2);margin-top:.12rem">감정</div>
      </div>
      <div onclick="openHouseTab('ach')"
        style="padding:.5rem .2rem;text-align:center;border-radius:10px;cursor:pointer;
          position:relative;
          background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)">
        <div id="ach-tile-notif" class="tile-notif" style="display:none">!</div>
        <div style="font-size:1.1rem">🏅</div>
        <div style="font-size:.63rem;color:var(--txt2);margin-top:.12rem">업적</div>
      </div>
      <div onclick="toast('🎵 리코더 기록장은 곧 열릴 예정이에요')"
        style="padding:.5rem .2rem;text-align:center;border-radius:10px;cursor:pointer;
          position:relative;opacity:.5;
          background:rgba(255,255,255,.03);border:1px dashed rgba(255,255,255,.1)">
        <div style="font-size:1.1rem;filter:grayscale(.4)">🎵</div>
        <div style="font-size:.63rem;color:var(--txt3);margin-top:.12rem">리코더</div>
        <span style="position:absolute;top:-3px;right:-2px;font-size:.5rem;font-weight:800;
          background:#e67e22;color:#fff;border-radius:5px;padding:.05rem .25rem;line-height:1.4">예정</span>
      </div>
      <div onclick="openHouseTab('vocab')"
        style="padding:.5rem .2rem;text-align:center;border-radius:10px;cursor:pointer;
          background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)">
        <div style="font-size:1.1rem">🔤</div>
        <div style="font-size:.63rem;color:var(--txt2);margin-top:.12rem">영어 단어장</div>
      </div>
    </div>

    <!-- ④ 퀘스트 목록 (기본 접힘) -->
    ${boardQuests.length>0 ? `
    <button onclick="toggleSection('quest-section','quest-arrow')"
      style="width:100%;padding:.4rem .7rem;border-radius:8px;background:rgba(255,255,255,.03);
        border:1px solid rgba(255,255,255,.07);color:var(--txt2);font-size:.78rem;
        cursor:pointer;font-family:inherit;display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem">
      <span>📋 퀘스트
        <span style="font-size:.7rem;color:var(--txt3);margin-left:.4rem">
          ${boardQuests.filter(q=>Utils.questStatus(s.id,q.id,q.type,questLogs,s.pendingRewards,activeBQIds)==='done').length}/${boardQuests.length} 완료
        </span>
      </span>
      <span id="quest-arrow" style="font-size:.7rem">▼</span>
    </button>
    <div id="quest-section" style="display:none">
      <div class="mission-list" style="margin-bottom:.6rem">${missionHtml}</div>
    </div>` : ''}

    <!-- ⑥ 하단 정보 — 기본 접힘 -->
    <button onclick="toggleSection('bottom-section','bottom-arrow')"
      style="width:100%;padding:.4rem .7rem;border-radius:8px;background:rgba(255,255,255,.03);
        border:1px solid rgba(255,255,255,.07);color:var(--txt3);font-size:.72rem;
        cursor:pointer;font-family:inherit;display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem">
      <span>📅 감정 · 최근 활동 · 친구 방문</span>
      <span id="bottom-arrow" style="font-size:.7rem">▼</span>
    </button>
    <div id="bottom-section" style="display:none">
      ${emotionCard}
      <div class="today-grid" style="margin-bottom:.5rem">
        <div class="today-card" style="overflow-y:auto;max-height:160px;grid-column:1/-1">
          <div class="tc-label">📜 최근 활동</div>
          ${(()=>{
            const db2=DB.load();
            const myQ=(db2.quests||[]).filter(q=>q.studentId===s.id).slice(-5).reverse();
            const myB=(s.books||[]).slice(-3).reverse();
            const logs=[
              ...myQ.map(q=>({icon:q.icon||'📋',text:q.name,color:'var(--gold)'})),
              ...myB.map(b=>({icon:'📚',text:'「'+b.title+'」',color:'var(--sky)'})),
              ...(s.monsterLog||[]).slice(-2).reverse().map(m=>({icon:'⚔️',text:m+' 처치',color:'var(--red)'}))
            ];
            if(logs.length===0) return '<div style="font-size:.72rem;color:var(--txt3)">아직 기록 없어요</div>';
            return logs.slice(0,6).map(l=>`<div style="display:flex;align-items:center;gap:.35rem;padding:.2rem 0;border-bottom:1px solid rgba(255,255,255,.04)">
              <span style="font-size:.85rem">${l.icon}</span>
              <span style="font-size:.7rem;color:${l.color};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.text}</span>
            </div>`).join('');
          })()}
        </div>
        <div class="today-card" style="grid-column:1/-1">
          <div class="tc-label">👥 친구 방문</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem">
          ${allStudents.map(f=>`<div class="friend-row" onclick="visitFriend('${f.id}')">
            <span>${f.avatar} ${f.name}</span>
            <span style="font-size:.7rem;color:var(--txt3)">Lv.${f.level} →</span>
          </div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
}
// ══ 보상 받기 ══
function toggleRestTodo() {
  const wrap = document.getElementById('rest-todo-wrap');
  const btn  = document.getElementById('rest-todo-btn');
  if (!wrap) return;
  const open = wrap.style.display === 'none';
  wrap.style.display = open ? '' : 'none';
  if (btn) btn.textContent = open
    ? `▲ 할 일 접기`
    : `▼ 할 일 더보기 (${wrap.querySelectorAll('.todo-card').length}개)`;
}

function toggleSection(sectionId, arrowId) {
  const sec = document.getElementById(sectionId);
  const arrow = document.getElementById(arrowId);
  if (!sec) return;
  const open = sec.style.display === 'none';
  sec.style.display = open ? '' : 'none';
  if (arrow) arrow.textContent = open ? '▲' : '▼';
}

function toggleSideSection(sectionId, arrowId) {
  const sec = document.getElementById(sectionId);
  const arrow = document.getElementById(arrowId);
  if (!sec) return;
  const open = sec.style.display === 'none';
  sec.style.display = open ? '' : 'none';
  if (arrow) arrow.textContent = open ? '▲' : '▼';
}

function toggleExtraMenu() {
  const grid = document.getElementById('extra-menu-grid');
  const arrow = document.getElementById('extra-menu-arrow');
  if (!grid) return;
  const open = grid.style.display === 'none' || grid.style.display === '';
  grid.style.display = open ? 'block' : 'none';
  if (arrow) arrow.textContent = open ? '▲' : '▼';
}

function claimRewards() {
  const pending = CUR.pendingRewards || [];
  // 승인된 보상만 수령 (approved:true)
  const approved = pending.filter(r => r.approved === true);
  if (!approved.length) {
    toast('아직 선생님이 승인한 보상이 없어요!');
    return;
  }
  let totalExp = 0, totalGold = 0;
  approved.forEach(r => {
    totalExp  += r.exp  || 0;
    totalGold += r.gold || 0;
    if (r.stat && r.statVal) {
      CUR.stats = CUR.stats || {};
      CUR.stats[r.stat] = Math.round(((CUR.stats[r.stat]||0) + r.statVal) * 10) / 10;
    }
    // questLog는 관리자 approveReward에서 이미 저장됨 → 여기서 중복 저장 제거
  });
  // 승인된 것만 제거, 대기중인 것은 유지
  CUR.pendingRewards = pending.filter(r => r.approved !== true);
  const oldLv = CUR.level;
  CUR.gold += totalGold;
  CUR.totalGold = (CUR.totalGold||0) + totalGold;
  CUR.exp  += totalExp;
  CUR.level = Utils.levelFromExp(CUR.exp);
  DB.saveStudent(CUR);
  if (CUR.level > oldLv) triggerLevelUp(CUR.level);
  checkAchievements();
  renderAll();
  toast(`💰+${totalGold}G  ⚡+${totalExp}EXP 획득!`);
}

// ══ 상점 ══
function buildEquipIcon(slot, itemId) {
  const BODY_PAL = {
    none:{a:'#5C7AEA',b:'#3A5BCC',c:'#8FA8FF'},
    e_b1:{a:'#BDBDBD',b:'#9E9E9E',c:'#E0E0E0'}, e_b2:{a:'#8D6E63',b:'#6D4C41',c:'#A1887F'},
    e_b3:{a:'#9C27B0',b:'#7B1FA2',c:'#CE93D8'}, e_b4:{a:'#78909C',b:'#546E7A',c:'#B0BEC5'},
    e_b5:{a:'#7E57C2',b:'#5E35B1',c:'#B39DDB'}, e_b6:{a:'#455A64',b:'#263238',c:'#78909C'},
    e_b7:{a:'#4A148C',b:'#311B92',c:'#9C27B0'}, e_b8:{a:'#F9A825',b:'#F57F17',c:'#FFF176'},
    e_b9:{a:'#37474F',b:'#1C313A',c:'#546E7A'}, e_b10:{a:'#880E4F',b:'#560027',c:'#C2185B'},
  };
  const HEAD_PAL = {
    e_h1:{a:'#BDBDBD',b:'#9E9E9E',type:'cloth'}, e_h2:{a:'#8D6E63',b:'#6D4C41',type:'leather'},
    e_h3:{a:'#9C27B0',b:'#7B1FA2',type:'magic'},  e_h4:{a:'#78909C',b:'#546E7A',type:'helm'},
    e_h5:{a:'#7E57C2',b:'#5E35B1',type:'magic'},  e_h6:{a:'#455A64',b:'#263238',type:'helm'},
    e_h7:{a:'#4A148C',b:'#311B92',type:'magic'},  e_h8:{a:'#F9A825',b:'#F57F17',type:'helm'},
    e_h9:{a:'#37474F',b:'#1C313A',type:'helm'},   e_h10:{a:'#FFD700',b:'#FF8F00',type:'crown'},
  };
  const WEAPON_PAL = {
    e_w1:{a:'#A1887F',b:'#6D4C41',type:'sword'}, e_w2:{a:'#90A4AE',b:'#546E7A',type:'sword'},
    e_w3:{a:'#CE93D8',b:'#9C27B0',type:'staff'}, e_w4:{a:'#B0BEC5',b:'#78909C',type:'sword'},
    e_w5:{a:'#B39DDB',b:'#7E57C2',type:'staff'}, e_w6:{a:'#90CAF9',b:'#1976D2',type:'sword'},
    e_w7:{a:'#E1BEE7',b:'#7B1FA2',type:'staff'}, e_w8:{a:'#FFE082',b:'#F9A825',type:'sword'},
    e_w9:{a:'#B0BEC5',b:'#37474F',type:'sword'}, e_w10:{a:'#F48FB1',b:'#880E4F',type:'sword'},
  };
  const GLOVE_PAL = {
    e_g1:'#795548', e_g2:'#6D4C41', e_g3:'#9C27B0', e_g4:'#546E7A',
    e_g5:'#7E57C2', e_g6:'#455A64', e_g7:'#4A148C', e_g8:'#F9A825',
    e_g9:'#37474F', e_g10:'#880E4F',
  };
  const SHOE_PAL = {
    e_s1:'#5D4037', e_s2:'#795548', e_s3:'#7B1FA2', e_s4:'#37474F',
    e_s5:'#5E35B1', e_s6:'#1A237E', e_s7:'#4A148C', e_s8:'#E65100',
    e_s9:'#1C313A', e_s10:'#880E4F',
  };

  const W = 56, H = 56;
  let shapes = '';

  if (slot === 'body') {
    const p = BODY_PAL[itemId] || BODY_PAL.none;
    shapes = `
      <rect x="14" y="16" width="28" height="26" rx="5" fill="${p.a}"/>
      <rect x="14" y="16" width="28" height="6" rx="5" fill="${p.c}" opacity=".4"/>
      <rect x="8"  y="18" width="8"  height="18" rx="4" fill="${p.a}"/>
      <rect x="40" y="18" width="8"  height="18" rx="4" fill="${p.a}"/>
      <rect x="26" y="20" width="4"  height="18" rx="2" fill="${p.b}" opacity=".4"/>
      <rect x="14" y="38" width="28" height="4"  rx="2" fill="${p.b}" opacity=".5"/>`;
  } else if (slot === 'head') {
    const p = HEAD_PAL[itemId];
    if (!p) return `<svg width="${W}" height="${H}" viewBox="0 0 56 56"><text x="28" y="36" text-anchor="middle" font-size="28">🪖</text></svg>`;
    if (p.type === 'crown') {
      shapes = `
        <rect x="10" y="28" width="36" height="12" rx="3" fill="${p.a}"/>
        <polygon points="10,28 16,14 22,28" fill="${p.a}"/>
        <polygon points="24,28 28,16 32,28" fill="${p.a}"/>
        <polygon points="34,28 40,14 46,28" fill="${p.a}"/>
        <rect x="12" y="32" width="32" height="6" fill="${p.b}" opacity=".5"/>
        <circle cx="28" cy="16" r="2.5" fill="#FFD700" opacity=".9"/>`;
    } else if (p.type === 'magic') {
      shapes = `
        <polygon points="28,2 12,38 44,38" fill="${p.a}"/>
        <polygon points="28,2 26,38 30,38" fill="${p.b}" opacity=".6"/>
        <rect x="10" y="35" width="36" height="9" rx="4" fill="${p.a}"/>
        <rect x="10" y="35" width="36" height="4" fill="${p.b}" opacity=".4"/>
        <circle cx="28" cy="2" r="3" fill="${p.b}" opacity=".7"/>`;
    } else {
      shapes = `
        <rect x="10" y="16" width="36" height="26" rx="9" fill="${p.a}"/>
        <rect x="10" y="16" width="36" height="12" rx="9" fill="${p.b}"/>
        <rect x="12" y="36" width="10" height="7" rx="2" fill="${p.b}"/>
        <rect x="34" y="36" width="10" height="7" rx="2" fill="${p.b}"/>
        <rect x="13" y="18" width="7" height="3" rx="1" fill="rgba(255,255,255,.3)"/>`;
    }
  } else if (slot === 'weapon') {
    const p = WEAPON_PAL[itemId];
    if (!p) return `<svg width="${W}" height="${H}" viewBox="0 0 56 56"><text x="28" y="36" text-anchor="middle" font-size="28">⚔️</text></svg>`;
    if (p.type === 'staff') {
      shapes = `
        <rect x="26" y="8" width="4" height="40" rx="2" fill="${p.b}"/>
        <rect x="27" y="8" width="2" height="40" fill="rgba(255,255,255,.2)"/>
        <circle cx="28" cy="12" r="8" fill="${p.b}"/>
        <circle cx="28" cy="12" r="5" fill="${p.a}"/>
        <circle cx="28" cy="12" r="2" fill="white" opacity=".5"/>`;
    } else {
      shapes = `
        <rect x="26" y="14" width="4" height="32" rx="1" fill="${p.a}"/>
        <rect x="27" y="14" width="2" height="32" fill="rgba(255,255,255,.3)"/>
        <rect x="18" y="26" width="20" height="4" rx="2" fill="${p.b}"/>
        <rect x="25" y="26" width="6" height="4" fill="#FFD700" opacity=".7"/>
        <polygon points="25,14 31,14 28,6" fill="${p.a}"/>`;
    }
  } else if (slot === 'glove') {
    const c = GLOVE_PAL[itemId] || '#795548';
    shapes = `
      <ellipse cx="28" cy="28" rx="16" ry="18" fill="${c}"/>
      <ellipse cx="28" cy="22" rx="12" ry="8" fill="rgba(255,255,255,.15)"/>
      <rect x="20" y="40" width="4" height="8" rx="2" fill="${c}"/>
      <rect x="26" y="40" width="4" height="9" rx="2" fill="${c}"/>
      <rect x="32" y="40" width="4" height="8" rx="2" fill="${c}"/>`;
  } else if (slot === 'shoe') {
    const c = SHOE_PAL[itemId] || '#4E342E';
    shapes = `
      <rect x="10" y="26" width="36" height="16" rx="6" fill="${c}"/>
      <rect x="10" y="26" width="36" height="6" rx="6" fill="rgba(255,255,255,.12)"/>
      <rect x="8"  y="36" width="40" height="12" rx="5" fill="${c}"/>
      <rect x="8"  y="44" width="40" height="4"  rx="3" fill="rgba(0,0,0,.2)"/>`;
  }

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated">${shapes}</svg>`;
}

function renderShop() {
  document.getElementById('shop-gold-disp').textContent = CUR.gold;
  const cat = SHOP_TAB;
  let items = [];

  if (['head','body','weapon','glove','shoe'].includes(cat)) {
    // body 탭: 속성별 필터 UI 포함
    const bodyFilterBar = cat === 'body' ? `
      <div style="display:flex;gap:.3rem;margin-bottom:.5rem;align-items:center">
        <span style="font-size:.68rem;color:var(--txt2)">속성:</span>
        ${['all','fire','water','grass'].map(e => {
          const label = {all:'전체',fire:'🔥불',water:'💧물',grass:'🌿풀'}[e];
          const active = (SHOP_BODY_ELEM||'all') === e;
          return `<button onclick="setBodyElemFilter('${e}')"
            style="padding:.18rem .5rem;border-radius:10px;border:1px solid;font-size:.7rem;cursor:pointer;
            ${active
              ? 'background:rgba(255,215,0,.2);border-color:var(--gold);color:var(--gold)'
              : 'background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.12);color:var(--txt2)'}">
            ${label}</button>`;
        }).join('')}
      </div>` : '';

    // body: 속성 필터 적용
    let equipList = GAME_DATA.equipment[cat];
    if (cat === 'body') {
      const ef = SHOP_BODY_ELEM || 'all';
      if (ef !== 'all') equipList = equipList.filter(i => i.element === ef);
    }

    items = equipList.map(item => {
      const check   = canBuyEquipment(CUR, item);
      const isEquip = (CUR.equipmentIds||{})[cat] === item.id;
      const inInv   = (CUR.inventory||[]).some(i => i.id === item.id);
      const owned   = isEquip || inInv;

      // 상태 배지
      let badge = '';
      if (isEquip) badge = `<span style="color:var(--emerald);font-size:.62rem"> 장착중</span>`;
      else if (inInv) badge = `<span style="color:var(--sky);font-size:.62rem"> 보유중</span>`;

      // 구매 불가 사유 표시
      let reasonHtml = '';
      if (!owned && !check.ok) {
        reasonHtml = `<div style="font-size:.62rem;color:var(--red);margin-top:.15rem">🔒 ${check.reason}</div>`;
      }

      // element 뱃지 (body만)
      const elemBadge = item.element
        ? `<span style="font-size:.6rem;padding:.1rem .35rem;border-radius:6px;margin-left:.3rem;
            background:${item.element==='fire'?'rgba(231,76,60,.25)':item.element==='water'?'rgba(52,152,219,.25)':'rgba(39,174,96,.25)'};
            color:${item.element==='fire'?'#FF8A80':item.element==='water'?'#7ec8e3':'#6fd49d'}">
            ${{fire:'🔥불',water:'💧물',grass:'🌿풀'}[item.element]}</span>`
        : '';

      const clickFn = owned ? `equipFromShop('${item.id}')` : `buyEquip('${item.id}')`;

      return `<div class="item-card ${!check.ok&&!owned?'cant-afford':''} shop-row-card"
        onclick="${clickFn}" style="${!check.ok&&!owned?'opacity:.6':''}">
        <div style="display:flex;align-items:center;gap:.6rem;width:100%">
          <div style="flex-shrink:0">${buildEquipIcon(cat, item.id)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:.78rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${item.name}${elemBadge}${badge}
            </div>
            <div class="ic-stats" style="margin-top:.06rem">${Utils.statText(item.stats)}</div>
            ${reasonHtml}
          </div>
          <div style="flex-shrink:0;text-align:right;display:flex;flex-direction:column;gap:.18rem;align-items:flex-end">
            <div style="font-size:.8rem;font-weight:700;color:var(--gold)">💰${item.price}G</div>
            <div style="font-size:.58rem;color:var(--txt3)">Lv.${item.lv}</div>
            <div style="font-size:.58rem;color:${check.ok||owned?'var(--emerald)':'var(--red)'}">
              ${check.ok||owned?'✅':'🔒'} ${Utils.condText(item.cond)}
            </div>
          </div>
        </div>
      </div>`;
    });

    document.getElementById('shop-items').innerHTML = bodyFilterBar + (() => {
      // weapon 탭: 검/스태프 섹션 헤더 삽입 (그리드 구조 유지)
      if (cat === 'weapon') {
        const secHdr = (label) => `<div style="grid-column:1/-1;font-size:.75rem;font-weight:700;
          color:var(--txt2);padding:.3rem .6rem;background:rgba(255,255,255,.04);
          border-radius:8px;margin-bottom:.2rem">${label}</div>`;
        // 검: e_w1,w2,w4,w6,w8,w9,w10 / 스태프: e_w3,w5,w7 + e_ws1~ws10
        const swordItems = equipList.filter(i => !i.id.startsWith('e_ws'));
        const staffItems = equipList.filter(i =>  i.id.startsWith('e_ws'));
        const renderItem  = (item) => {
          const check   = canBuyEquipment(CUR, item);
          const isEquip = (CUR.equipmentIds||{})[cat] === item.id;
          const inInv   = (CUR.inventory||[]).some(i => i.id === item.id);
          const owned   = isEquip || inInv;
          let badge = '';
          if (isEquip) badge = `<span style="color:var(--emerald);font-size:.62rem"> 장착중</span>`;
          else if (inInv) badge = `<span style="color:var(--sky);font-size:.62rem"> 보유중</span>`;
          let reasonHtml = '';
          if (!owned && !check.ok) reasonHtml = `<div style="font-size:.62rem;color:var(--red);margin-top:.15rem">🔒 ${check.reason}</div>`;
          const clickFn = owned ? `equipFromShop('${item.id}')` : `buyEquip('${item.id}')`;
          return `<div class="item-card ${!check.ok&&!owned?'cant-afford':''} shop-row-card"
            onclick="${clickFn}" style="${!check.ok&&!owned?'opacity:.6':''}">
            <div style="display:flex;align-items:center;gap:.6rem;width:100%">
              <div style="flex-shrink:0">${buildEquipIcon(cat, item.id)}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:.78rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                  ${item.name}${badge}
                </div>
                <div class="ic-stats" style="margin-top:.06rem">${Utils.statText(item.stats)}</div>
                ${reasonHtml}
              </div>
              <div style="flex-shrink:0;text-align:right;display:flex;flex-direction:column;gap:.18rem;align-items:flex-end">
                <div style="font-size:.8rem;font-weight:700;color:var(--gold)">💰${item.price}G</div>
                <div style="font-size:.58rem;color:var(--txt3)">Lv.${item.lv}</div>
                <div style="font-size:.58rem;color:${check.ok||owned?'var(--emerald)':'var(--red)'}">
                  ${check.ok||owned?'✅':'🔒'} ${Utils.condText(item.cond)}
                </div>
              </div>
            </div>
          </div>`;
        };
        return secHdr('⚔️ 검 계열') + swordItems.map(renderItem).join('')
             + secHdr('🪄 스태프 계열') + staffItems.map(renderItem).join('');
      }
      return items.join('');
    })();
    return;

  } else if (cat === 'skill') {
    // 마스터리북 탭
    const typeGroups = ['normal','fire','water','grass'];
    const typeLabel  = {normal:'⚔️ 기본 공격',fire:'🔥 화염',water:'💧 냉기',grass:'🌿 자연'};
    // ★ 스킬 UI와 완전히 같은 색 기준
    const typeColor  = {normal:'var(--gold)',fire:'#FF8A80',water:'#7ec8e3',grass:'#6fd49d'};
    const typeBg     = {
      normal:'rgba(255,215,0,.07)',
      fire:  'rgba(255,138,128,.07)',
      water: 'rgba(126,200,227,.07)',
      grass: 'rgba(111,212,157,.07)',
    };
    const typeBorder = {
      normal:'rgba(255,215,0,.25)',
      fire:  'rgba(255,138,128,.25)',
      water: 'rgba(126,200,227,.25)',
      grass: 'rgba(111,212,157,.25)',
    };

    let html = '';
    typeGroups.forEach(type => {
      const books = SKILL_BOOKS.filter(b => b.type === type);
      const curLv = (CUR.skillLevels||{})[type] ?? 0;
      const tc = typeColor[type];
      html += `<div style="margin-bottom:1rem">
        <div style="font-size:.75rem;font-weight:700;color:${tc};margin-bottom:.4rem;
          padding:.3rem .6rem;background:${typeBg[type]};border:1px solid ${typeBorder[type]};border-radius:8px">
          ${typeLabel[type]} — 현재 Lv.${curLv}
        </div>`;
      books.forEach(book => {
        const check = canBuySkillBook(CUR, book);
        const alreadyHave = curLv >= book.targetLevel;
        if (alreadyHave) {
          html += `<div style="display:flex;align-items:center;gap:.6rem;padding:.45rem .7rem;
            background:${typeBg[type]};border:1px solid ${typeBorder[type]};
            border-radius:8px;margin-bottom:.3rem;opacity:.55">
            <div style="width:28px;height:28px;border-radius:6px;background:${tc};opacity:.85;
              display:flex;align-items:center;justify-content:center;font-size:.75rem;color:#111;font-weight:700;flex-shrink:0">
              📖</div>
            <div style="flex:1;font-size:.78rem;color:${tc}">${book.name}</div>
            <span style="font-size:.68rem;color:var(--emerald)">✅ 습득완료</span>
          </div>`;
        } else {
          const clickFn = check.ok ? `buySkillBook('${book.id}')` : `toast('${check.reason}')`;
          html += `<div onclick="${clickFn}" style="display:flex;align-items:center;gap:.6rem;padding:.5rem .7rem;
            background:${check.ok ? typeBg[type] : 'rgba(255,255,255,.03)'};
            border:1.5px solid ${check.ok ? typeBorder[type] : 'rgba(255,255,255,.06)'};
            border-radius:8px;margin-bottom:.3rem;cursor:pointer;opacity:${check.ok?'1':'.55'};transition:all .2s"
            onmouseover="if(${check.ok})this.style.borderColor='${tc}'"
            onmouseout="this.style.borderColor='${check.ok ? typeBorder[type] : 'rgba(255,255,255,.06)'}'">
            <div style="width:28px;height:28px;border-radius:6px;background:${tc};
              display:flex;align-items:center;justify-content:center;font-size:.75rem;color:#111;font-weight:700;flex-shrink:0">
              📖</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:.78rem;font-weight:600;color:${tc}">${book.name}</div>
              <div style="font-size:.65rem;color:var(--txt3)">${book.desc} · Lv.${book.reqPlayerLevel}+</div>
              ${!check.ok ? `<div style="font-size:.62rem;color:var(--red)">🔒 ${check.reason}</div>` : ''}
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:.75rem;color:var(--gold);font-weight:700">💰 ${book.price}G</div>
            </div>
          </div>`;
        }
      });
      html += `</div>`;
    });
    document.getElementById('shop-items').innerHTML = html;
    return;

  } else if (cat === 'seed') {
    const lv = CUR.level || 1;

    // ── 일반 씨앗 카드 ──
    const normalCards = GAME_DATA.seeds.map(s => {
      const locked = lv < (s.reqLv||1);
      const lockFn = locked ? `toast('Lv${s.reqLv} 이상이 되어야 구매할 수 있어요!')` : `buySeed('${s.id}')`;
      return `<div class="item-card" onclick="${lockFn}" style="opacity:${locked?.55:1}">
        <div class="ic-icon">${s.icon}${locked?'<span style="font-size:.7rem">🔒</span>':''}</div>
        <div class="ic-name">${s.name}${locked?`<span style="color:var(--txt3);font-size:.62rem"> Lv${s.reqLv}+</span>`:''}</div>
        <div class="ic-stats">${s.growHours}h → ${s.sellPrice}G (순익 +${s.sellPrice-s.price}G)</div>
        <div class="ic-price">💰 ${s.price}G</div>
      </div>`;
    });

    // ── 돌연변이 씨앗 카드 (구분선 + 별도 스타일) ──
    const mutantCards = GAME_DATA.mutantSeeds.map(s => {
      const locked = lv < (s.reqLv||1);
      const lockFn = locked ? `toast('Lv${s.reqLv} 이상이 되어야 구매할 수 있어요!')` : `buySeed('${s.id}')`;
      const pct = Math.round(s.successRate*100);
      const successG = s.baseSellPrice * 2;
      return `<div class="item-card" onclick="${lockFn}"
        style="opacity:${locked?.55:1};border:1px solid rgba(255,165,0,.35);
          background:linear-gradient(135deg,rgba(255,140,0,.08),rgba(255,80,0,.05))">
        <div class="ic-icon">${s.icon}${locked?'<span style="font-size:.7rem">🔒</span>':''}</div>
        <div class="ic-name" style="color:#FFA500">${s.name}
          <span style="font-size:.6rem;background:rgba(255,140,0,.2);color:#FFA500;
            border-radius:4px;padding:.05rem .3rem;margin-left:.2rem">위험</span>
          ${locked?`<span style="color:var(--txt3);font-size:.62rem"> Lv${s.reqLv}+</span>`:''}
        </div>
        <div class="ic-stats" style="color:var(--txt2)">${s.growHours}h · ${s.desc}</div>
        <div class="ic-stats" style="color:rgba(255,165,0,.8);font-size:.62rem">
          성공 ${pct}% → +${successG}G / 실패 → 0G
        </div>
        <div class="ic-price">💰 ${s.price}G</div>
      </div>`;
    });

    const divider = `<div style="grid-column:1/-1;display:flex;align-items:center;gap:.5rem;
      margin:.3rem 0;font-size:.72rem;font-weight:700;color:rgba(255,165,0,.8)">
      <div style="flex:1;height:1px;background:rgba(255,165,0,.2)"></div>
      ⚡ 돌연변이 씨앗 — 성공 시 2배 / 실패 시 0G
      <div style="flex:1;height:1px;background:rgba(255,165,0,.2)"></div>
    </div>`;

    document.getElementById('shop-items').innerHTML =
      normalCards.join('') + divider + mutantCards.join('');
    return; // 아래 items.join() 건너뜀
  } else {
    items = GAME_DATA.decorations.filter(d => d.price > 0).map(d => {
      const lv = CUR.level || 1;
      const locked = lv < (d.reqLv||1);
      const rl = {common:'⚪',rare:'🔵',epic:'🟣',legend:'🟡'}[d.rarity||'common']||'';
      const catBadge = d.cat==='yard'
        ? `<span style="color:#7ec850;font-size:.62rem">🌿 마당</span>`
        : `<span style="color:#C8A87A;font-size:.62rem">🏠 집 안</span>`;
      const lockMsg = locked ? `toast('Lv${d.reqLv} 이상이 되어야 구매할 수 있어요!')` : `buyDeco('${d.id}')`;
      return `<div class="item-card" onclick="${lockMsg}" style="opacity:${locked?.55:1}">
        <div class="ic-icon">${d.icon}${locked?'<span style="font-size:.7rem">🔒</span>':''}</div>
        <div class="ic-name">${rl} ${d.name}</div>
        <div class="ic-stats">${catBadge}${locked?` <span style="color:var(--txt3);font-size:.6rem">Lv${d.reqLv}+</span>`:''}</div>
        <div class="ic-price">💰 ${d.price}G</div>
      </div>`;
    });
  }
  document.getElementById('shop-items').innerHTML = items.join('');
}

function shopTab(tab, el) {
  SHOP_TAB = tab;
  document.querySelectorAll('#m-shop .mtab').forEach(t => t.classList.remove('on'));
  el.classList.add('on'); renderShop();
}

let SHOP_BODY_ELEM = 'all'; // body 탭 속성 필터

function setBodyElemFilter(elem) {
  SHOP_BODY_ELEM = elem;
  renderShop();
}

// 이미 보유한 장비를 상점에서 클릭했을 때 → 장착만
function equipFromShop(itemId) {
  const item = GAME_DATA.getItemById(itemId);
  if (!item) return;
  const slot   = GAME_DATA.getSlotForItem(itemId);
  const isEquip = (CUR.equipmentIds||{})[slot] === itemId;
  if (isEquip) { toast('이미 장착 중이에요!'); return; }
  if (!Utils.condMet(CUR, item.cond)) { toast('🔒 착용 조건 미충족\n' + Utils.condText(item.cond)); return; }
  const oldId = (CUR.equipmentIds||{})[slot];
  if (oldId && oldId !== itemId) returnEquipToInv(oldId);
  // 인벤에서 차감
  const inv = CUR.inventory || [];
  const invItem = inv.find(i => i.id === itemId);
  if (invItem) {
    invItem.qty--;
    if (invItem.qty <= 0) CUR.inventory = inv.filter(i => i.id !== itemId);
  }
  Utils.equipItem(CUR, item);
  DB.saveStudent(CUR); renderAll(); renderShop();
  toast(`✅ ${item.name} 장착!`);
}

// 마스터리북 구매 (UI 함수 — 실제 로직은 gamedata.js의 buySkillBookLogic)
function buySkillBook(bookId) {
  const book = SKILL_BOOKS.find(b => b.id === bookId);
  if (!book) return;
  const typeLabel = {normal:'기본 공격',fire:'화염',water:'냉기',grass:'자연'}[book.type]||book.type;
  if (!confirm(`📚 ${book.name}\n${typeLabel} Lv.${book.targetLevel} 습득 (${book.price}G)?`)) return;
  const result = buySkillBookLogic(CUR, bookId);
  if (!result.ok) { toast(`🔒 ${result.reason}`); return; }
  DB.saveStudent(CUR);
  renderShop();
  renderHUD();
  toast(`✅ ${book.name} 구매! ${typeLabel} Lv.${book.targetLevel} 습득!`);
}

// ══ 장비 구매 — canBuyEquipment 기반 (기존 인벤/착용 구조 유지) ══
function buyEquip(itemId) {
  const item = GAME_DATA.getItemById(itemId);
  if (!item) return;
  const slot   = GAME_DATA.getSlotForItem(itemId);
  const inInv  = (CUR.inventory||[]).some(i => i.id === itemId);
  const isEquip = (CUR.equipmentIds||{})[slot] === itemId;

  // 이미 보유 중이면 equipFromShop으로 전환
  if (inInv || isEquip) { equipFromShop(itemId); return; }

  const check = canBuyEquipment(CUR, item);
  if (!check.ok) { toast(`🔒 ${check.reason}`); return; }
  if (!confirm(`${item.icon} ${item.name} 구매 (${item.price}G)?`)) return;

  CUR.gold -= item.price;
  // 기존 착용 장비 인벤 반환
  const oldId = (CUR.equipmentIds||{})[slot];
  if (oldId && oldId !== itemId) returnEquipToInv(oldId);
  Utils.equipItem(CUR, item);
  DB.saveStudent(CUR); renderAll(); renderShop();
  checkAchievements();
  toast(`✅ ${item.name} 구매 및 장착!`);
}

function returnEquipToInv(itemId) {
  CUR.inventory = CUR.inventory || [];
  const ex = CUR.inventory.find(i => i.id === itemId);
  if (ex) ex.qty++; else CUR.inventory.push({id: itemId, qty: 1});
}

function buySeed(id) {
  const seed = Utils.getSeedById(id);
  if (!seed || CUR.gold < seed.price) { toast('💸 골드 부족!'); return; }
  CUR.gold -= seed.price;
  CUR.inventory = CUR.inventory || [];
  const ex = CUR.inventory.find(i => i.id === id);
  if (ex) ex.qty++; else CUR.inventory.push({id, qty:1});
  DB.saveStudent(CUR); renderShop(); renderHUD();
  toast(`✅ ${seed.name} 구매!`);
}

function buyDeco(id) {
  const deco = GAME_DATA.decorations.find(d => d.id === id);
  if (!deco || CUR.gold < deco.price) { toast('💸 골드 부족!'); return; }
  CUR.gold -= deco.price;
  CUR.inventory = CUR.inventory || [];
  const ex = CUR.inventory.find(i => i.id === id);
  if (ex) ex.qty++; else CUR.inventory.push({id, qty:1});
  DB.saveStudent(CUR); renderShop(); renderHUD();
  toast(`✅ ${deco.name} 구매!`);
}

// ══ 몬스터 ══
// ── 현재 열린 사냥터 zone ──
let CUR_ZONE = 'beginner';

// 사냥터 탭 클릭
function openZone(zone, btn) {
  CUR_ZONE = zone;
  document.querySelectorAll('[id^="zone-btn-"]').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  renderMonsterOffers(zone);
}

// 사냥터 후보 3마리 렌더
function renderMonsterOffers(zone) {
  const el = document.getElementById('monster-offers');
  if (!el) return;

  const canFight     = Utils.canFightMonster(CUR);

  if (!canFight) {
    const limit = (typeof BATTLE_CONSTS !== 'undefined') ? BATTLE_CONSTS.dailyBattleLimit : 3;
    el.innerHTML = `<div style="text-align:center;padding:1.5rem;color:var(--txt2);font-size:.85rem">
      오늘 전투 횟수(${limit}회)를 모두 사용했어요!<br>
      <span style="font-size:.72rem;color:var(--txt3)">내일 다시 도전하세요 💪</span>
    </div>`;
    return;
  }

  // ── 리롤 방지: 오늘의 후보를 zone별로 캐시 ──────────────────
  const today = Utils.todayStr();

  // battleOffersByZone 초기화 (없거나 날짜 바뀌면 리셋)
  if (!CUR.battleOffersByZone || CUR.battleOffersByZone.dateKey !== today) {
    CUR.battleOffersByZone = { dateKey: today, beginner: null, intermediate: null, advanced: null };
  }

  let offers;
  if (CUR.battleOffersByZone[zone]) {
    const saved = CUR.battleOffersByZone[zone];
    if (Array.isArray(saved) && saved.length > 0 && typeof saved[0] === 'string') {
      offers = saved.map(id => GAME_DATA.monsters.find(m => m.id === id)).filter(Boolean);
    } else {
      offers = saved;
    }
    // 복원 결과가 3마리 미만이면 캐시 무효화 후 새로 생성
    if (!offers || offers.length < 3) {
      CUR.battleOffersByZone[zone] = null;
      offers = null;
    }
  }

  if (!offers) {
    // 새로 생성
    offers = generateBattleOffers(CUR, zone);
    if (offers.length) {
      CUR.battleOffersByZone[zone] = offers.map(m => m.id);
      DB.saveStudent(CUR);
    }
  }

  if (!offers || !offers.length) {
    el.innerHTML = `<div style="text-align:center;padding:1.5rem;color:var(--txt3);font-size:.82rem">
      이 사냥터에 도전할 몬스터가 없어요
    </div>`;
    return;
  }

  const elemLabel  = { fire:'🔥 불', water:'💧 물', grass:'🌿 풀' };
  const rarityLabel= { common:'일반', rare:'희귀', legend:'전설' };
  const rarityClass= { common:'ob-rarity-common', rare:'ob-rarity-rare', legend:'ob-rarity-legend' };
  const slotLabels = ['① 안정 몬스터', '② 도전 몬스터', '③ 고급 몬스터'];

  // [STUDENT-COPY-1A] 표시 전용 안내 — 카드 클릭(startBattle) 직후 기회가 차감됨을 사전 고지.
  //                   문구만 추가하며 전투/차감/저장 로직은 일절 건드리지 않음.
  const battleCostNotice = `<div style="text-align:center;font-size:.72rem;color:var(--txt3);margin-bottom:.5rem">⚔️ 도전하면 오늘 전투 기회 1회를 사용해요.</div>`;

  el.innerHTML = battleCostNotice + offers.map((m, i) => {
    const isKilled = (CUR.monsterLog || []).includes(m.name);
    const badges = [
      m.element ? `<span class="offer-badge ob-elem-${m.element}">${elemLabel[m.element]||m.element}</span>` : '',
      m.rarity  ? `<span class="offer-badge ${rarityClass[m.rarity]||'ob-rarity-common'}">${rarityLabel[m.rarity]||m.rarity}</span>` : '',
      m.trait==='ghost' ? `<span class="offer-badge ob-ghost">👻 유령형</span>` : '',
      isKilled ? `<span class="offer-badge ob-done">✓ 처치완료</span>` : `<span class="offer-badge ob-new">NEW</span>`,
    ].filter(Boolean).join('');

    return `
      <div>
        <div class="offer-slot-label">${slotLabels[i] || ''}</div>
        <div class="offer-card" onclick="startBattle('${m.id}')">
          <div class="offer-icon">${iconImg(m, 'monsters', '2rem')}</div>
          <div class="offer-body">
            <div class="offer-name">${m.name}</div>
            <div class="offer-meta">
              <span style="color:var(--txt3)">Lv.${m.level}</span>
              <span style="color:var(--gold)">💰 ${m.gold}G</span>
              ${badges}
            </div>
          </div>
          <div class="offer-arrow">›</div>
        </div>
      </div>`;
  }).join('');
}

// 도감 펼치기/접기
function renderMonsterDexInline() { renderMonsters(); }

// ── 학생 포트폴리오 일일퀘스트 기록 ──────────────────────
let _dqPortView = 'week';
function setDqPortView(v, btn) {
  _dqPortView = v;
  ['dq-port-week-btn','dq-port-month-btn'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const isActive = (id==='dq-port-week-btn' && v==='week') || (id==='dq-port-month-btn' && v==='month');
    el.style.background = isActive ? 'var(--gold)' : 'transparent';
    el.style.color = isActive ? '#1a1a1a' : 'var(--txt3)';
    el.style.border = isActive ? 'none' : '1px solid rgba(255,255,255,.2)';
  });
  renderDqPortfolio();
}

function renderDqPortfolio() {
  const wrap = document.getElementById('dq-portfolio-wrap');
  if (!wrap || !CUR) return;
  const db = DB.load();

  function getWeekKey(dateStr) {
    const d = new Date(dateStr); d.setHours(12);
    const day = d.getDay();
    const mon = new Date(d); mon.setDate(d.getDate()-(day===0?6:day-1));
    return mon.toISOString().slice(0,10);
  }
  const keyFn = _dqPortView==='week' ? getWeekKey : (d=>d.slice(0,7));
  const periodLabel = k => {
    if (_dqPortView==='month') { const [y,m]=k.split('-'); return y+'년 '+parseInt(m)+'월'; }
    const end = new Date(k); end.setDate(end.getDate()+6);
    return k.slice(5)+' ~ '+end.toISOString().slice(5,10);
  };

  const allBq = (db.boardQuests||[]).filter(q=>q.type==='daily'&&q.date);
  const myLogs = Object.values(db.questLogs||{})
    .filter(l=>l&&l.studentId===CUR.id&&(l.type==='daily'||l.boardQuestType==='daily')&&l.date);

  // questDateMap[period][name] = Set<dates 올라온 날>
  const questDateMap = {};
  allBq.forEach(q => {
    const k = keyFn(q.date);
    if (!questDateMap[k]) questDateMap[k] = {};
    if (!questDateMap[k][q.name]) questDateMap[k][q.name] = new Set();
    questDateMap[k][q.name].add(q.date);
  });
  // doneDateMap[period][name] = Set<dates 내가 완료한 날>
  const doneDateMap = {};
  myLogs.forEach(l => {
    const k = keyFn(l.date);
    if (!doneDateMap[k]) doneDateMap[k] = {};
    if (!doneDateMap[k][l.name]) doneDateMap[k][l.name] = new Set();
    doneDateMap[k][l.name].add(l.date);
  });

  const periods = Object.keys({...questDateMap,...doneDateMap}).sort().reverse().slice(0,8);
  if (periods.length===0) {
    wrap.innerHTML = '<div style="font-size:.78rem;color:var(--txt3);padding:.5rem 0">일일퀘스트 기록이 없어요</div>';
    return;
  }

  wrap.innerHTML = periods.map(k => {
    const qMap  = questDateMap[k] || {};
    const dMap  = doneDateMap[k]  || {};
    const names = Object.keys(qMap);
    const totalAvail = names.reduce((a,n)=>(a+(qMap[n]?.size||0)), 0);
    const totalDone  = names.reduce((a,n)=>(a+(dMap[n]?.size||0)), 0);
    const pct = totalAvail > 0 ? Math.round(totalDone/totalAvail*100) : 0;
    const color = pct===100?'var(--emerald)':pct>=60?'var(--gold)':'var(--txt3)';
    return `
    <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);
      border-radius:10px;padding:.55rem .7rem;margin-bottom:.4rem">
      <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.3rem">
        <span style="font-size:.72rem;color:var(--txt3)">${periodLabel(k)}</span>
        <span style="font-size:.75rem;font-weight:700;color:${color};margin-left:auto">
          ${totalDone}/${totalAvail}일 완료</span>
        ${pct===100?'<span style="font-size:.7rem">✨</span>':''}
      </div>
      <div style="height:5px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden;margin-bottom:.4rem">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width .5s"></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:.15rem">
        ${names.map(n=>{
          const avail = qMap[n]?.size||0;
          const done  = dMap[n]?.size||0;
          const c = done===avail&&avail>0?'var(--emerald)':done>0?'var(--gold)':'rgba(255,255,255,.2)';
          return `<div style="display:flex;align-items:center;gap:.4rem;font-size:.72rem">
            <span style="min-width:30px;font-weight:700;color:${c};flex-shrink:0">${done}/${avail}일</span>
            <span style="color:${done>0?'var(--txt1)':'var(--txt3)'}">${n}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
}

function toggleMonsterDex() {
  const el = document.getElementById('monster-dex-inline');
  if (!el) return;
  if (el.style.display === 'none') {
    el.style.display = '';
    renderMonsters();
  } else {
    el.style.display = 'none';
  }
}

function renderMonsters() {
  const killed = CUR.monsterLog||[];
  const canFight = Utils.canFightMonster(CUR);
  const attemptsLeft = Utils.monsterAttemptsLeft(CUR);
  document.getElementById('monster-list').innerHTML = getActiveMonsters().map(m => {
    const isKilled = killed.includes(m.name);
    const isLocked = (m.level || m.recLv || 0) > CUR.level + 3;
    const canChallenge = canFight && !isKilled && !isLocked;
    return `<div class="mon-card ${isKilled?'killed':''} ${isLocked?'locked':''}"
      onclick="${canChallenge?`startBattle('${m.id}')`:''}"
      style="${isKilled||isLocked?'cursor:default':''}">
      <div class="mc-icon">${iconImg(m, 'monsters', '1.6rem')}</div>
      <div class="mc-name">${m.name}</div>
      <div class="mc-lv">Lv.${m.level||m.recLv}</div>
      <div class="mc-gold">💰 ${m.gold}G</div>
      ${isKilled?'<span class="mc-tag tag-done">처치완료</span>'
        : isLocked?'<span class="mc-tag tag-done">🔒 레벨 부족</span>'
        : !canFight?`<span class="mc-tag tag-done">남은 ${attemptsLeft}회</span>`
        : '<span class="mc-tag tag-new">도전!</span>'}
    </div>`;
  }).join('');
}

// ══ 전투 ══
function startBattle(monId) {
  const mon = GAME_DATA.monsters.find(m => m.id === monId)
           || getActiveMonsters().find(m => m.id === monId);
  if (!mon) return;

  // ★ 이미 진행 중인 전투가 있으면 차단
  if (CUR.battleInProgress) {
    toast('⚠️ 이미 진행 중인 전투가 있어요!\n전투를 먼저 완료해 주세요.');
    return;
  }

  // 전투 횟수 체크 (battleDaily 3회 기준)
  normalizeBattleDaily(CUR);
  if (!Utils.canFightMonster(CUR)) {
    const limit = (typeof BATTLE_CONSTS !== 'undefined') ? BATTLE_CONSTS.dailyBattleLimit : 3;
    toast(`오늘 전투 횟수(${limit}회)를 모두 사용했어요!`); return;
  }

  // ★ 전투 시작 즉시: 횟수 차감 + 진행 중 상태 저장 (창 닫기/새로고침 방지)
  CUR.battleDaily.used = (CUR.battleDaily.used || 0) + 1;
  if ((CUR.lastMonsterDate || '') !== Utils.todayStr()) CUR.monsterDailyCount = 0;
  CUR.lastMonsterDate  = Utils.todayStr();
  CUR.monsterDailyCount = (CUR.monsterDailyCount || 0) + 1;
  CUR.battleInProgress = { monId: mon.id, monName: mon.name, startedAt: Date.now() };
  DB.saveStudent(CUR);  // 즉시 저장 — 이후 창 닫아도 횟수는 소모됨

  // 1단계 신규 필드가 없는 몬스터면 구형 로직으로 fallback 표시
  const isNewMonster = mon.hp != null;

  BATTLE_MON  = mon;
  BATTLE_TRIES = 0;
  BATTLE_DONE  = false;
  BATTLE_MENU  = 'main';
  BATTLE_STATE = isNewMonster ? startBattleEngine(CUR, mon) : null;

  closeModal('m-monster');
  openModal('m-battle');
  document.getElementById('battle-title').textContent = `⚔️ ${mon.name} 출현!`;

  if (BATTLE_STATE) {
    if (BATTLE_STATE.turn === 'monster') {
      BATTLE_STATE.log.push(`<span style="color:#ef9a9a;font-weight:700">선공: 몬스터</span>`);
      BATTLE_STATE = performMonsterTurn(BATTLE_STATE);
      // ★ 방어: 선공 몬스터 처리 후 전투가 안 끝났으면 반드시 플레이어 턴 보장
      if (!BATTLE_STATE.finished) BATTLE_STATE.turn = 'player';
    } else {
      BATTLE_STATE.log.push(`<span style="color:#4fc3f7;font-weight:700">선공: 나</span>`);
    }
    renderBattleNew();
  } else {
    renderBattle('ready');
  }
}

// ── 새 턴제 전투 화면 렌더 ──
function renderBattleNew() {
  const s     = BATTLE_STATE;
  const mon   = s.monster;
  const player = CUR;
  const arenaEl = document.getElementById('battle-arena');
  if (!arenaEl) return;

  const playerHpPct  = Math.max(0, Math.round(s.playerHp  / s.playerHpMax  * 100));
  const monsterHpPct = Math.max(0, Math.round(s.monsterHp / s.monsterHpMax * 100));
  const recentLog    = s.log.slice(-4).join('<br>');

  // 공격 버튼 — 장착 스킬 4슬롯 기준
  const typeColors = {
    normal: ['rgba(255,255,255,.08)','rgba(255,215,0,.12)','rgba(255,215,0,.2)','rgba(255,215,0,.35)'],
    fire:   ['rgba(255,107,53,.08)','rgba(255,107,53,.15)','rgba(255,107,53,.25)','rgba(255,107,53,.4)'],
    water:  ['rgba(79,195,247,.08)','rgba(79,195,247,.15)','rgba(79,195,247,.25)','rgba(79,195,247,.4)'],
    grass:  ['rgba(102,187,106,.08)','rgba(102,187,106,.15)','rgba(102,187,106,.25)','rgba(102,187,106,.4)'],
  };
  const typeBorder    = { normal:'rgba(255,215,0,.3)', fire:'rgba(255,107,53,.45)', water:'rgba(79,195,247,.45)', grass:'rgba(102,187,106,.45)' };
  const typeTextColor = { normal:'var(--gold)', fire:'#FF8A80', water:'#7ec8e3', grass:'#6fd49d' };
  const typeLabels    = { normal:'⚔️ 일반 공격', fire:'🔥 화염 공격', water:'💧 냉기 공격', grass:'🌿 자연 공격' };

  // equippedSkills: null 슬롯은 버튼 없음, 중복 제거
  const equippedTypes = [...new Set((CUR.equippedSkills || ['normal',null,null,null]).filter(Boolean))];
  // 아무것도 없으면 노말 기본 보장
  const battleBtnTypes = equippedTypes.length > 0 ? equippedTypes : ['normal'];

  const btns = battleBtnTypes.map(type => {
    const lvl    = (s.skillLevels[type] || 0);
    const canUse = lvl >= 1;
    const tier   = _skillEffectTier(lvl) - 1;
    const bg     = canUse ? (typeColors[type]||typeColors.normal)[tier] : 'rgba(255,255,255,.04)';
    const bc     = canUse ? (typeBorder[type]||'rgba(255,215,0,.3)') : 'rgba(255,255,255,.1)';
    const tc     = canUse ? (typeTextColor[type]||'var(--gold)') : 'var(--txt3)';
    const disabled = (!canUse || s.finished || s.turn !== 'player') ? 'disabled' : '';
    return `<button class="btn-sm" ${disabled} onclick="doAttack('${type}')"
      style="flex:1;min-width:0;font-size:.76rem;padding:.4rem .2rem;border-radius:8px;
             border:1.5px solid ${bc};background:${bg};color:${tc};
             ${!canUse?'opacity:.35':''}">
      ${typeLabels[type]||type}<br>
      <span style="font-size:.6rem">${canUse ? `Lv${lvl}` : '미습득'}</span>
    </button>`;
  }).join('');

  // ── 2단계 액션 메뉴 ─────────────────────────────────
  const SKILL2_INFO = {
    heal:     { label:'💊 응급치료',    desc:'HP 30% 회복' },
    prep:     { label:'🎯 일격 준비',   desc:'다음 공격 ×2.3' },
    reckless: { label:'⚡ 무리한 공격', desc:'50% 확률 ×2.2' },
    guard:    { label:'🛡️ 방어',       desc:'피해 50% 감소' },
    counter:  { label:'⚔️ 최후의 반격',desc:'HP40%↓ / 50% 반사' },
    rush:     { label:'🔥 몰아치기',   desc:'2턴 공격력↑' },
  };

  let actionHtml = '';
  if (!s.finished && s.turn === 'player') {
    const hasSkill2 = (s.equippedSkill2 || []).filter(Boolean).some(id => !s.skill2Used?.[id]);

    if (BATTLE_MENU === 'main') {
      actionHtml = `<div class="bat-actions">
        <button class="bat-btn-attack" onclick="BATTLE_MENU='attack';renderBattleNew()">⚔️ 공격</button>
        <button class="bat-btn-skill" onclick="BATTLE_MENU='skill';renderBattleNew()"
          ${!hasSkill2?'disabled':''}>✨ 스킬</button>
      </div>`;

    } else if (BATTLE_MENU === 'attack') {
      const attackBtns = battleBtnTypes.map(type => {
        const lvl = s.skillLevels[type] || 0;
        const canUse = lvl >= 1;
        const tier = _skillEffectTier(lvl) - 1;
        const bg = canUse ? (typeColors[type]||typeColors.normal)[tier] : 'rgba(255,255,255,.04)';
        const bc = canUse ? (typeBorder[type]||'rgba(255,215,0,.3)') : 'rgba(255,255,255,.1)';
        const tc = canUse ? (typeTextColor[type]||'var(--gold)') : 'var(--txt3)';
        return `<button class="bat-sub-btn" ${!canUse?'disabled':''} onclick="BATTLE_MENU='main';doAttack('${type}')"
          style="border:1.5px solid ${bc};background:${bg};color:${tc};${!canUse?'opacity:.35':''}">
          ${typeLabels[type]||type}<br>
          <span style="font-size:.58rem">${canUse?`Lv${lvl}`:'미습득'}</span>
        </button>`;
      }).join('');
      actionHtml = `<div>
        <button class="bat-back-btn" onclick="BATTLE_MENU='main';renderBattleNew()">← 뒤로 &nbsp;<span style="color:var(--gold);font-size:.7rem">⚔️ 공격 선택</span></button>
        <div class="bat-sub-row">${attackBtns}</div>
      </div>`;

    } else if (BATTLE_MENU === 'skill') {
      const skillBtns = (s.equippedSkill2 || []).filter(Boolean).map(id => {
        const info = SKILL2_INFO[id]; if (!info) return '';
        const used = !!(s.skill2Used?.[id]);
        const condFail = (id === 'counter' && s.playerHp / s.playerHpMax > 0.4);
        const off = used || condFail;
        return `<button class="bat-sub-btn" ${off?'disabled':''} onclick="BATTLE_MENU='main';doSkill2('${id}')"
          style="border:1.5px solid rgba(93,173,226,.35);background:rgba(93,173,226,.08);
            color:var(--sky);${off?'opacity:.4':''}">
          ${info.label}<br>
          <span style="font-size:.56rem;color:var(--txt3)">${used?'사용완료':info.desc}</span>
        </button>`;
      }).join('');
      actionHtml = `<div>
        <button class="bat-back-btn" onclick="BATTLE_MENU='main';renderBattleNew()">← 뒤로 &nbsp;<span style="color:var(--sky);font-size:.7rem">✨ 스킬 선택</span></button>
        <div class="bat-sub-row">${skillBtns}</div>
      </div>`;
    }
  }

  // ── 결과 박스 ──
  let resultHtml = '';
  if (s.finished) {
    if (s.win) {
      resultHtml = `<div class="ba-result-box ba-result-win">
        <div style="font-size:1.6rem;font-weight:900;color:var(--gold);margin-bottom:.3rem">🏆 승리!</div>
        <div style="font-size:.85rem;color:var(--gold)">+${mon.gold}G 획득</div>
      </div>`;
    } else {
      resultHtml = `<div class="ba-result-box ba-result-lose">
        <div style="font-size:1.6rem;font-weight:900;color:#FF8A80;margin-bottom:.3rem">💀 패배...</div>
        <div style="font-size:.78rem;color:var(--txt3)">전투 기회 1회 소모</div>
      </div>`;
    }
  }

  // ── 배틀 헤더 서브 텍스트 업데이트 ──
  const subEl = document.getElementById('battle-sub');
  if (subEl) {
    const attLeft = Utils.monsterAttemptsLeft(CUR);
    const lim = Utils._getBattleLimit();
    subEl.textContent = `오늘 ${attLeft}/${lim}번 남아있어요`;
  }

  arenaEl.innerHTML = `
    <!-- 대치 무대 -->
    <div class="ba-stage">
      <!-- 플레이어 -->
      <div class="ba-fighter">
        <div class="ba-fighter-name" style="color:#7ec8e3">${player.name}</div>
        <div class="ba-fighter-icon" style="width:80px;height:100px;margin:0 auto" id="ba-char-emoji">${buildCharSVG(player)}</div>
        <div style="width:100%">
          <div class="ba-hp-bar-bg" style="height:10px"><div class="ba-hp-bar-fill ba-char-hp" style="width:${playerHpPct}%"></div></div>
          <div class="ba-hp-txt">${s.playerHp} / ${s.playerHpMax}</div>
        </div>
        <div class="ba-stats-txt">ATK ${s.playerStats.atk} · MAG ${s.playerStats.mag}<br>DEF ${s.playerStats.def} · SPD ${s.playerStats.spd}</div>
      </div>
      <!-- 가운데 VS -->
      <div class="ba-vs-center">
        <div class="ba-vs-bolt">⚡</div>
        <div class="ba-vs-label">VS</div>
      </div>
      <!-- 몬스터 -->
      <div class="ba-fighter">
        <div class="ba-fighter-name" style="color:#FF8A80">${mon.name}</div>
        <div class="ba-emoji" id="ba-mon-emoji">${iconImg(mon, 'monsters', '3.8rem')}</div>
        <div style="width:100%">
          <div class="ba-hp-bar-bg" style="height:10px"><div class="ba-hp-bar-fill ba-mon-hp" style="width:${monsterHpPct}%"></div></div>
          <div class="ba-hp-txt">${s.monsterHp} / ${s.monsterHpMax}</div>
        </div>
        <div class="ba-stats-txt">ATK ${mon.atk} · DEF ${mon.def} · SPD ${mon.spd}<br>
          ${mon.element?`<span style="color:${mon.element==='fire'?'#FF8A80':mon.element==='water'?'#7ec8e3':'#6fd49d'}">${{fire:'🔥 불꽃',water:'💧 냉기',grass:'🌿 자연'}[mon.element]||mon.element}</span>`:''}
          ${mon.trait==='ghost'?' <span style="color:#bbb">👻 유령</span>':''}
        </div>
      </div>
    </div>
    <!-- 전투 로그 -->
    <div class="ba-log-wrap">
      <div class="ba-log-title">BATTLE LOG</div>
      <div class="ba-log" id="ba-log">${recentLog || '<span style="color:#aaa">전투 시작!</span>'}</div>
    </div>
    <!-- 결과 or 행동 -->
    ${resultHtml}
    ${s.finished
      ? `<button class="btn-ok" style="width:100%" onclick="closeBattle()">✅ 확인</button>`
      : actionHtml
    }`;

}

// ── 스킬 레벨 → 이펙트 티어 ──
function _skillEffectTier(lv) {
  if (lv <= 1) return 1;
  if (lv <= 3) return 2;
  if (lv <= 5) return 3;
  return 4;
}

// ── 속성별 이펙트 이모지/색 ──
const SKILL_EFFECT = {
  normal: { t1:'💥', t2:'💥💥', t3:'✨💥✨', t4:'⚡🌟⚡', color:['#FFD700','#FFE44D','#FFF176','#FFFF99'] },
  fire:   { t1:'🔥', t2:'🔥🔥', t3:'🔥💥🔥', t4:'🌋🔥🌋', color:['#FF6B35','#FF8A50','#FFA070','#FFB89A'] },
  water:  { t1:'💧', t2:'💧💧', t3:'🌊💧🌊', t4:'❄️🌊❄️', color:['#4FC3F7','#70D0FF','#90DCFF','#B0EEFF'] },
  grass:  { t1:'🌿', t2:'🍃🌿', t3:'🌿🌸🌿', t4:'🌳💚🌳', color:['#66BB6A','#7ECB7E','#96DB94','#AEEBA8'] },
};

// ── 공격 버튼 클릭 ──
function doAttack(attackType) {
  if (!BATTLE_STATE || BATTLE_STATE.finished || BATTLE_STATE.turn !== 'player') return;
  document.querySelectorAll('#battle-arena button').forEach(b => b.disabled = true);

  // ── 1단계: 플레이어 공격 계산 (수치만, 연출 아직 안 함) ──
  BATTLE_STATE = performPlayerTurn(BATTLE_STATE, attackType);
  const pa = BATTLE_STATE.lastPlayerAction;

  const tier     = _skillEffectTier(pa.skillLv);
  const eff      = SKILL_EFFECT[attackType] || SKILL_EFFECT.normal;
  const effEmoji = eff[`t${tier}`] || eff.t1;
  const effColor = eff.color[tier - 1] || eff.color[0];
  const isCrit   = pa.crit;
  const isHeavy  = isCrit || (pa.skill2Label && pa.skill2Label.includes('일격'));
  const typeNames = { normal:'일반 공격', fire:'화염 공격', water:'냉기 공격', grass:'자연 공격' };

  // 캐릭터 전진
  const charEl = document.getElementById('ba-char-emoji');
  if (charEl) {
    charEl.style.transition = 'transform .15s';
    charEl.style.transform  = 'translateX(22px) scale(1.1)';
    setTimeout(() => { if (charEl) charEl.style.transform = ''; }, 220);
  }

  // 행동 문구 먼저 로그에 표시
  _updateBattleLog(BATTLE_STATE);

  // 0.35초 후 — 데미지/HP 반영
  setTimeout(() => {
    if (pa.miss) {
      spawnDmgFloat('공격이 빗나갔다!', '#888', 'top');
      _updateBattleHpBars(BATTLE_STATE);
      // 빗나감: 0.45초 후 몬스터 턴
      setTimeout(() => _doMonsterTurn(), 450);
    } else {
      // 몬스터 피격 애니
      const monEl = document.getElementById('ba-mon-emoji');
      if (monEl) {
        monEl.classList.remove('ba-mon-hit'); void monEl.offsetWidth;
        monEl.classList.add('ba-mon-hit');
        setTimeout(() => monEl.classList.remove('ba-mon-hit'), 400);
      }
      // 급소면 0.35초 더 대기 후 피해 표시
      const hitDelay = isCrit ? 350 : 0;
      if (isCrit) spawnDmgFloat('급소!', '#FFD700', 'top');
      setTimeout(() => {
        spawnDmgFloat(`${effEmoji} -${pa.dmg}`, isCrit ? '#FFD700' : effColor);
        if (pa.isGhost)          spawnDmgFloat('유령 저항!', '#bbb', 'top');
        else if (pa.elemMult > 1.0) spawnDmgFloat('효과 굉장함!', '#FF8C00', 'top');
        else if (pa.elemMult < 1.0) spawnDmgFloat('효과 별로...', '#888', 'top');
        _updateBattleHpBars(BATTLE_STATE);
        // 중요한 공격은 0.55초, 일반은 0.45초 후 몬스터 턴
        const afterDelay = isHeavy ? 550 : 450;
        if (BATTLE_STATE.finished) {
          setTimeout(() => _finishBattle(), afterDelay);
        } else {
          setTimeout(() => _doMonsterTurn(), afterDelay);
        }
      }, hitDelay);
    }
  }, 350);
}

// ── 몬스터 턴 실행 (doAttack/doSkill2 공통) ──
function _doMonsterTurn() {
  if (!BATTLE_STATE || BATTLE_STATE.finished) return;

  BATTLE_STATE = performMonsterTurn(BATTLE_STATE);
  const ma = BATTLE_STATE.lastMonsterAction;

  // 몬스터 전진
  const monEl2 = document.getElementById('ba-mon-emoji');
  if (monEl2) {
    monEl2.style.transition = 'transform .15s';
    monEl2.style.transform  = 'translateX(-22px) scale(1.1)';
    setTimeout(() => { if (monEl2) monEl2.style.transform = ''; }, 220);
  }

  // 로그 먼저 표시
  _updateBattleLog(BATTLE_STATE);

  // 0.4초 후 — 데미지 적용
  setTimeout(() => {
    if (ma.miss) {
      spawnDmgFloat('빗나감!', '#888', 'top');
      _updateBattleHpBars(BATTLE_STATE);
      setTimeout(() => _afterMonsterTurn(), 450);
    } else {
      const charEl2 = document.getElementById('ba-char-emoji');
      // 강공이면 문구 먼저
      const isHeavyMon = ma.roleLabel === '강공!' || ma.crit;
      const hitDelay = isHeavyMon ? 300 : 0;
      if (isHeavyMon && ma.roleLabel) spawnDmgFloat(ma.roleLabel, '#e74c3c', 'top');
      if (ma.crit && !ma.roleLabel)   spawnDmgFloat('몬스터 급소!', '#ef9a9a', 'top');

      setTimeout(() => {
        if (charEl2) {
          charEl2.classList.remove('ba-player-hit'); void charEl2.offsetWidth;
          charEl2.classList.add('ba-player-hit');
          setTimeout(() => charEl2.classList.remove('ba-player-hit'), 400);
        }
        spawnDmgFloat(`⚔️ -${ma.dmg}`, ma.crit ? '#ef9a9a' : '#E74C3C');
        if (ma.crit && ma.roleLabel)   spawnDmgFloat('몬스터 급소!', '#ef9a9a', 'top');
        if (ma.armorMult < 1.0)  spawnDmgFloat('방어 상성 유리!', '#4fc3f7', 'top');
        if (ma.armorMult > 1.0)  spawnDmgFloat('방어 상성 불리!', '#ef9a9a', 'top');
        _updateBattleHpBars(BATTLE_STATE);
        const afterDelay = isHeavyMon ? 550 : 450;
        setTimeout(() => _afterMonsterTurn(), afterDelay);
      }, hitDelay);
    }
  }, 400);
}

// ── 몬스터 턴 종료 후 처리 ──
function _afterMonsterTurn() {
  if (BATTLE_STATE.finished) {
    setTimeout(() => _finishBattle(), 300);
  } else {
    BATTLE_MENU = 'main';
    setTimeout(() => renderBattleNew(), 300);
  }
}

// HP 바만 업데이트 (innerHTML 재생성 없이)
function _updateBattleHpBars(state) {
  const charHpPct = Math.max(0, Math.round(state.playerHp  / state.playerHpMax  * 100));
  const monHpPct  = Math.max(0, Math.round(state.monsterHp / state.monsterHpMax * 100));

  const charBar = document.querySelector('.ba-char-hp');
  const monBar  = document.querySelector('.ba-mon-hp');
  const charTxt = document.querySelector('.ba-char-hp')?.closest('.ba-hp-bar-bg')?.nextElementSibling;
  const monTxt  = document.querySelector('.ba-mon-hp')?.closest('.ba-hp-bar-bg')?.nextElementSibling;

  if (charBar) charBar.style.width = charHpPct + '%';
  if (monBar)  monBar.style.width  = monHpPct  + '%';
  if (charTxt) charTxt.textContent = `${state.playerHp} / ${state.playerHpMax}`;
  if (monTxt)  monTxt.textContent  = `${state.monsterHp} / ${state.monsterHpMax}`;
}

// 로그만 업데이트
function _updateBattleLog(state) {
  const logEl  = document.getElementById('ba-log');
  const wrapEl = logEl?.closest('.ba-log-wrap');
  if (!logEl) return;
  logEl.innerHTML = state.log.slice(-8).join('<br>') || '';
  // 자동 스크롤 — 최신 로그가 보이게
  if (wrapEl) requestAnimationFrame(() => { wrapEl.scrollTop = wrapEl.scrollHeight; });
}

// 전투 종료 처리
function _finishBattle() {
  // ── 무한배틀 분기 ──
  if (BATTLE_STATE.isInfinite) {
    _finishInfiniteBattle();
    return;
  }

  const oldLv = CUR.level;
  const mon   = BATTLE_STATE.monster;
  const win   = BATTLE_STATE.win;
  finalizeBattle(CUR, mon, win);
  CUR.battleInProgress = null;
  CUR.level = Utils.levelFromExp(CUR.exp);
  BATTLE_DONE = true;
  DB.saveStudent(CUR);
  renderHUD();
  if (CUR.level > oldLv) setTimeout(() => triggerLevelUp(CUR.level), 400);
  setTimeout(() => checkAchievements(), 600);
  // 도감 보상 알림
  if (CUR._dexBonusLog && CUR._dexBonusLog.length > 0) {
    const bonuses = CUR._dexBonusLog;
    CUR._dexBonusLog = [];
    setTimeout(() => {
      bonuses.forEach(b => {
        if (b.type === 'firstKill') toast(`📖 첫 처치 보너스! +${b.gold}G`);
        if (b.type === 'zoneComplete') toast(`🏆 도감 완성!\n${b.zone} +${b.gold}G${b.title?' · '+b.title:''}`);
      });
    }, 800);
  }
  renderBattleNew();
}

function renderBattle(phase) {
  const mon = BATTLE_MON, s = CUR;
  const charHpPct = phase === 'lose' ? 10 : 100;
  const monHpPct  = phase === 'win'  ? 0  : phase === 'ready' ? 100 : 45;

  let logHtml = '';
  if (phase === 'ready') {
    logHtml = `<span class="info">${mon.icon} ${mon.name}이(가) 나타났다!</span><br>도전 버튼을 눌러 전투를 시작하세요.`;
  } else if (phase === 'win') {
    logHtml = `<span class="good">⚡ 공격 성공!</span><br><span class="good">💥 ${mon.name}을(를) 물리쳤다!</span><br><span class="good">💰 +${mon.gold}G 획득!</span>`;
  } else {
    logHtml = `<span class="bad">💔 ${mon.name}의 반격!</span><br><span class="bad">패배했습니다...</span>`;
  }

  document.getElementById('battle-arena').innerHTML = `
    <div class="ba-vs">
      <div class="ba-side">
        <div class="ba-emoji" id="ba-char-emoji" style="font-size:0;width:70px;height:90px;margin:0 auto">
          ${buildCharSVG(s)}
        </div>
        <div style="font-size:.75rem;font-weight:700">${s.name}</div>
        <div class="ba-hp-wrap">
          <div class="ba-hp-bar-bg"><div class="ba-hp-bar-fill ba-char-hp" id="ba-char-hp" style="width:${charHpPct}%"></div></div>
          <div class="ba-hp-txt">HP ${charHpPct}%</div>
        </div>
      </div>
      <div class="ba-vs-icon">⚡</div>
      <div class="ba-side">
        <div class="ba-emoji" id="ba-mon-emoji">${iconImg(mon, 'monsters', '3.8rem')}</div>
        <div style="font-size:.75rem;font-weight:700">${mon.name}</div>
        <div class="ba-hp-wrap">
          <div class="ba-hp-bar-bg"><div class="ba-hp-bar-fill ba-mon-hp" id="ba-mon-hp" style="width:${monHpPct}%"></div></div>
          <div class="ba-hp-txt">HP ${monHpPct}%</div>
        </div>
      </div>
    </div>
    <div class="ba-log" id="ba-log">${logHtml}</div>
    ${phase !== 'ready' ? `<div class="ba-result ${phase}">${phase==='win'?'🏆 승리!':'💀 패배...'}</div>` : ''}
    ${BATTLE_DONE
      ? `<button class="btn-ok" onclick="closeBattle()">✅ 확인</button>`
      : `<button class="btn-battle" id="btn-fight" onclick="doFight()">⚔️ 도전!</button>`}`;
}

function doFight() {
  const mon = BATTLE_MON, s = CUR;
  const settings = DB.getSettings();
  const playerStat = s.combat[mon.reqStat] || 0;
  const winRate = (playerStat >= mon.reqVal ? (settings.monsterWinRate||80) : 10) / 100;
  const win = Math.random() < winRate;
  BATTLE_TRIES++;

  const btn = document.getElementById('btn-fight');
  if (btn) btn.disabled = true;

  function setHp(id, pct) {
    const el = document.getElementById(id);
    if (el) el.style.width = Math.max(0, pct) + '%';
    const txt = el?.parentElement?.nextElementSibling;
    if (txt) txt.textContent = 'HP ' + Math.max(0, pct) + '%';
  }
  function setLog(html) {
    const el = document.getElementById('ba-log');
    if (el) el.innerHTML = html;
  }

  const rounds = win ? [
    {delay:0,    charMove:true,  log:`<span class="info">⚔️ ${s.name} 공격!</span>`},
    {delay:1000, monShake:true,  log:`<span class="good">💥 타격! 몬스터 체력 감소!</span>`,  monHp:65},
    {delay:2200, monAtk:true,    log:`<span class="bad">😤 ${mon.name} 반격!</span>`},
    {delay:3200, charFx:true,    log:`<span class="info">🛡️ 막았다!</span>`},
    {delay:4400, charMove:true,  log:`<span class="info">⚔️ 연속 공격!</span>`},
    {delay:5400, monShake:true,  log:`<span class="good">💥 치명타!</span>`,               monHp:30},
    {delay:6600, charMove:true,  log:`<span class="info">⚔️ 마지막 일격!</span>`},
    {delay:7600, monShake:true,  log:`<span class="good">💥 ${mon.name} 쓰러졌다!</span>`, monHp:0},
    {delay:9000, end:true, win:true},
  ] : [
    {delay:0,    charMove:true,  log:`<span class="info">⚔️ ${s.name} 공격!</span>`},
    {delay:1000, miss:true,      log:`<span style="color:#888">💨 빗나감!</span>`},
    {delay:2200, monAtk:true,    log:`<span class="bad">😈 ${mon.name} 반격!</span>`},
    {delay:3200, charShake:true, log:`<span class="bad">💔 피해! 체력 감소...</span>`,     charHp:65},
    {delay:4400, charMove:true,  log:`<span class="info">⚔️ 다시 공격!</span>`},
    {delay:5400, miss:true,      log:`<span style="color:#888">💨 또 빗나감!</span>`},
    {delay:6600, monAtk:true,    log:`<span class="bad">😈 강한 반격!</span>`},
    {delay:7800, charShake:true, log:`<span class="bad">💔 치명타! 쓰러졌다...</span>`,    charHp:0},
    {delay:9200, end:true, win:false},
  ];

  const charEl = () => document.getElementById('ba-char-emoji');
  const monEl  = () => document.getElementById('ba-mon-emoji');

  rounds.forEach(r => {
    setTimeout(() => {
      if (r.log) setLog(r.log);
      if (r.monHp !== undefined) setHp('ba-mon-hp', r.monHp);
      if (r.charHp !== undefined) setHp('ba-char-hp', r.charHp);
      if (r.charMove && charEl()) {
        charEl().style.transition='transform .2s';
        charEl().style.transform='translateX(18px) scale(1.08)';
        setTimeout(()=>{ if(charEl()) charEl().style.transform=''; }, 250);
      }
      if (r.monShake && monEl()) {
        monEl().classList.add('hit');
        monEl().style.transition='transform .15s';
        monEl().style.transform='translateX(-10px)';
        setTimeout(()=>{ if(monEl()){ monEl().style.transform=''; monEl().classList.remove('hit'); }}, 300);
        spawnDmgFloat('💥', '#FF4444');
      }
      if (r.monAtk && monEl()) {
        monEl().style.transition='transform .2s';
        monEl().style.transform='translateX(-20px) scale(1.08)';
        setTimeout(()=>{ if(monEl()) monEl().style.transform=''; }, 250);
        spawnDmgFloat('⚡', '#E74C3C');
      }
      if (r.charShake && charEl()) {
        charEl().classList.add('shake');
        spawnDmgFloat('💔', '#E74C3C');
        setTimeout(()=>{ if(charEl()) charEl().classList.remove('shake'); }, 450);
      }
      if (r.miss) spawnDmgFloat('💨 빗나감', '#888');
      if (r.end) {
        BATTLE_DONE = true;
        if (r.win) {
          CUR.gold += mon.gold;
          CUR.totalGold = (CUR.totalGold||0) + mon.gold;
          const oldLv = CUR.level;
          CUR.level = Utils.levelFromExp(CUR.exp);
          if (!(CUR.monsterLog||[]).includes(mon.name)) CUR.monsterLog = [...(CUR.monsterLog||[]), mon.name];
        }
        // ★ 횟수 차감은 startBattle()에서 완료 — 여기서는 battleInProgress 정리만
        CUR.battleInProgress = null;
        DB.saveStudent(CUR);
        renderBattle(r.win ? 'win' : 'lose'); renderHUD();
        if (r.win) { const oldLv2 = Utils.levelFromExp(CUR.exp - mon.gold); if (CUR.level > oldLv2) setTimeout(() => triggerLevelUp(CUR.level), 600); }
        setTimeout(() => checkAchievements(), 800);
      }
    }, r.delay);
  });
}

function spawnDmgFloat(text, color, pos) {
  const arena = document.getElementById('battle-arena');
  if (!arena) return;
  const rect = arena.getBoundingClientRect();
  const el   = document.createElement('div');
  el.innerHTML = text;
  const topY = pos === 'top'
    ? rect.top + 10
    : rect.top + Math.floor(rect.height * 0.35);
  el.style.cssText = `position:fixed;left:${rect.left + rect.width/2 - 50}px;top:${topY}px;
    color:${color};font-size:${pos==='top'?'.9rem':'1.15rem'};font-weight:900;pointer-events:none;z-index:9999;
    text-shadow:0 2px 8px rgba(0,0,0,.7);animation:dmgFloat ${pos==='top'?'.8s':'1s'} ease forwards;
    white-space:nowrap;max-width:120px;text-align:center;`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), pos === 'top' ? 900 : 1100);
}

// ── 전투창 닫기 요청 (전투 중이면 확인 다이얼로그) ──
function requestCloseBattle() {
  // 무한배틀 종료 화면
  if (BATTLE_DONE && BATTLE_STATE?.isInfinite) {
    _endInfiniteBattleSession(false);
    return;
  }
  // 전투가 이미 끝났으면 그냥 닫기
  if (BATTLE_DONE || (!BATTLE_STATE && !BATTLE_MON)) {
    closeBattle();
    return;
  }
  // 무한배틀 진행 중 포기
  if (BATTLE_STATE?.isInfinite) {
    if (confirm('무한배틀을 포기하시겠습니까?\n지금까지의 기록은 저장됩니다.')) {
      _endInfiniteBattleSession(true);
    }
    return;
  }
  // 일반 전투 진행 중: 포기 확인
  if (confirm('지금 전투를 포기하면 패배 처리되며,\n이미 사용한 기회는 복구되지 않습니다.\n\n전투를 포기하시겠습니까?')) {
    CUR.battleInProgress = null;
    DB.saveStudent(CUR);
    closeBattle();
    toast('💀 전투를 포기했습니다. 기회는 이미 소모되었습니다.');
  }
}

function openSkill2SlotPicker(slotIndex) {
  const eq2 = CUR.equippedSkill2 || ['heal','guard','counter'];
  const ALL_SKILL2 = [
    { id:'heal',     label:'💊 응급치료',    desc:'HP 30% 회복', color:'#6fd49d' },
    { id:'prep',     label:'🎯 일격 준비',   desc:'다음 공격 ×2.3', color:'#FFD700' },
    { id:'reckless', label:'⚡ 무리한 공격', desc:'50% 확률 ×2.2', color:'#FF8A80' },
    { id:'guard',    label:'🛡️ 방어',       desc:'피해 50% 감소', color:'#7ec8e3' },
    { id:'counter',  label:'⚔️ 최후의 반격',desc:'HP40%↓ / 50% 반사', color:'#c39bd3' },
    { id:'rush',     label:'🔥 몰아치기',   desc:'2턴 공격력↑', color:'#f39c12' },
  ];
  const usedInOther = eq2.filter((id, i) => i !== slotIndex && id);

  const optHtml = [
    `<div onclick="setSkill2Slot(${slotIndex},null)"
      style="padding:.55rem .8rem;border-radius:8px;cursor:pointer;
        border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);
        font-size:.82rem;color:var(--txt3);margin-bottom:.35rem;text-align:center">비우기</div>`,
    ...ALL_SKILL2.map(s => {
      const current = eq2[slotIndex] === s.id;
      const taken   = usedInOther.includes(s.id);
      return `<div onclick="${taken?'':` setSkill2Slot(${slotIndex},'${s.id}')`}"
        style="padding:.55rem .8rem;border-radius:8px;margin-bottom:.35rem;
          cursor:${taken?'not-allowed':'pointer'};opacity:${taken?.4:1};
          border:1.5px solid ${current?s.color:'rgba(255,255,255,.1)'};
          background:${current?'rgba(255,255,255,.08)':'rgba(255,255,255,.03)'};
          display:flex;justify-content:space-between;align-items:center">
        <div>
          <span style="font-size:.85rem;font-weight:700;color:${s.color}">${s.label}</span>
          <div style="font-size:.67rem;color:var(--txt3)">${s.desc}</div>
        </div>
        <span style="font-size:.7rem;color:var(--txt3)">${current?'✓':taken?'다른 슬롯':''}</span>
      </div>`;
    }),
  ].join('');

  const existing = document.getElementById('skill2-slot-picker');
  if (existing) existing.remove();

  const card = document.getElementById(`skill2-slot-card-${slotIndex}`);
  if (!card) return;

  card.style.gridColumn = '1 / -1';
  card.style.textAlign = 'left';
  card.style.padding = '.6rem';
  card.onclick = null;
  card.onmouseenter = null;
  card.onmouseleave = null;

  card.innerHTML = `
    <div style="font-size:.75rem;font-weight:700;color:var(--txt1);margin-bottom:.5rem">
      슬롯 ${slotIndex+1} 전투 스킬 선택
    </div>
    <div onclick="setSkill2Slot(${slotIndex},null)"
      style="padding:.45rem .7rem;border-radius:8px;cursor:pointer;margin-bottom:.3rem;
        border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);
        font-size:.78rem;color:var(--txt3);text-align:center">비우기</div>
    ${ALL_SKILL2.map(s => {
      const current = eq2[slotIndex] === s.id;
      const taken   = (eq2[0]===s.id||eq2[1]===s.id||eq2[2]===s.id) && !current;
      return `<div onclick="${taken ? '' : `setSkill2Slot(${slotIndex},'${s.id}')`}"
        style="padding:.45rem .7rem;border-radius:8px;margin-bottom:.3rem;
          cursor:${taken ? 'not-allowed' : 'pointer'};
          opacity:${taken ? '.4' : '1'};
          border:1.5px solid ${current ? s.color : 'rgba(255,255,255,.1)'};
          background:${current ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.03)'};
          display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:.8rem;font-weight:700;color:${s.color}">${s.label}</div>
          <div style="font-size:.68rem;color:var(--txt3)">${s.desc}</div>
        </div>
        <span style="font-size:.68rem;color:var(--txt3)">${current?'✓':taken?'다른 슬롯':''}</span>
      </div>`;
    }).join('')}
    <button onclick="renderInv()"
      style="width:100%;padding:.4rem;border-radius:8px;background:rgba(255,255,255,.06);
        border:1px solid rgba(255,255,255,.1);color:var(--txt2);font-size:.75rem;
        font-family:inherit;cursor:pointer;margin-top:.1rem">취소</button>`;
}

function setSkill2Slot(slotIndex, skill2Id) {
  document.getElementById('skill2-slot-picker')?.remove();
  if (!CUR.equippedSkill2 || !Array.isArray(CUR.equippedSkill2)) {
    CUR.equippedSkill2 = ['heal','guard','counter'];
  }
  while (CUR.equippedSkill2.length < 3) CUR.equippedSkill2.push(null);
  CUR.equippedSkill2[slotIndex] = skill2Id || null;
  DB.saveStudent(CUR);
  renderInv();
}

function openSkillSlotPicker(slotIndex) {
  // 슬롯 1(index 0)은 노말 고정 — 선택 불가
  if (slotIndex === 0) return;

  const sl  = CUR.skillLevels || DEFAULT_SKILL_LEVELS;
  const eq  = CUR.equippedSkills || ['normal', null, null];
  // 슬롯 2~3은 속성(불/물/풀)만 선택 가능
  const elementTypes = [
    { type:'fire',  label:'🔥 화염 마법', color:'#FF8A80' },
    { type:'water', label:'💧 냉기 마법', color:'#7ec8e3' },
    { type:'grass', label:'🌿 자연 마법', color:'#6fd49d' },
  ];
  // 다른 슬롯에 이미 장착된 속성 (중복 방지)
  const otherSlot = slotIndex === 1 ? 2 : 1;
  const usedType  = eq[otherSlot];

  const optHtml = [
    `<div onclick="setSkillSlot(${slotIndex},null)"
      style="padding:.6rem .8rem;border-radius:8px;cursor:pointer;
        border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);
        font-size:.82rem;color:var(--txt3);margin-bottom:.4rem;text-align:center">비우기</div>`,
    ...elementTypes.map(t => {
      const lv      = sl[t.type] ?? 0;
      const current = eq[slotIndex] === t.type;
      const taken   = t.type === usedType; // 다른 슬롯에서 이미 사용 중
      if (lv < 1) return ''; // 미습득 스킬은 표시 안 함
      return `<div onclick="${taken ? '' : `setSkillSlot(${slotIndex},'${t.type}')`}"
        style="padding:.6rem .8rem;border-radius:8px;margin-bottom:.4rem;
          cursor:${taken ? 'not-allowed' : 'pointer'};
          opacity:${taken ? '.35' : '1'};
          border:1.5px solid ${current ? t.color : 'rgba(255,255,255,.1)'};
          background:${current ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.03)'};
          display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:.85rem;font-weight:700;color:${t.color}">${t.label}</span>
        <span style="font-size:.72rem;color:var(--txt3)">
          Lv.${lv}${current?' ✓':''}${taken?' (다른 슬롯에 장착됨)':''}
        </span>
      </div>`;
    }),
  ].join('');

  const existing = document.getElementById('skill-slot-picker');
  if (existing) existing.remove();

  const card = document.getElementById(`skill-slot-card-${slotIndex}`);
  if (!card) return;

  // 카드 원래 크기 유지하면서 선택 UI로 교체
  card.style.gridColumn = '1 / -1'; // 3칸 전체 너비 사용
  card.style.textAlign = 'left';
  card.style.padding = '.6rem';
  card.onclick = null;
  card.onmouseenter = null;
  card.onmouseleave = null;

  card.innerHTML = `
    <div style="font-size:.75rem;font-weight:700;color:var(--txt1);margin-bottom:.5rem">
      슬롯 ${slotIndex+1} 속성 스킬 선택
    </div>
    <div onclick="setSkillSlot(${slotIndex},null)"
      style="padding:.45rem .7rem;border-radius:8px;cursor:pointer;margin-bottom:.3rem;
        border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);
        font-size:.78rem;color:var(--txt3);text-align:center">비우기</div>
    ${elementTypes.map(t => {
      const lv      = sl[t.type] ?? 0;
      const current = eq[slotIndex] === t.type;
      const taken   = t.type === usedType;
      if (lv < 1) return '';
      return `<div onclick="${taken ? '' : `setSkillSlot(${slotIndex},'${t.type}')`}"
        style="padding:.45rem .7rem;border-radius:8px;margin-bottom:.3rem;
          cursor:${taken ? 'not-allowed' : 'pointer'};
          opacity:${taken ? '.35' : '1'};
          border:1.5px solid ${current ? t.color : 'rgba(255,255,255,.1)'};
          background:${current ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.03)'};
          display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:.8rem;font-weight:700;color:${t.color}">${t.label}</span>
        <span style="font-size:.68rem;color:var(--txt3)">Lv.${lv}${current?' ✓':taken?' (다른 슬롯)':''}</span>
      </div>`;
    }).join('')}
    <button onclick="renderInv()"
      style="width:100%;padding:.4rem;border-radius:8px;background:rgba(255,255,255,.06);
        border:1px solid rgba(255,255,255,.1);color:var(--txt2);font-size:.75rem;
        font-family:inherit;cursor:pointer;margin-top:.1rem">취소</button>`;
}

function setSkillSlot(slotIndex, skillType) {
  document.getElementById('skill-slot-picker')?.remove();
  if (!CUR.equippedSkills || !Array.isArray(CUR.equippedSkills)) {
    CUR.equippedSkills = ['normal', null, null];
  }
  // 슬롯 0은 항상 노말 고정
  if (slotIndex === 0) return;
  CUR.equippedSkills[slotIndex] = skillType || null;
  // 슬롯 0 항상 normal 보장
  CUR.equippedSkills[0] = 'normal';
  DB.saveStudent(CUR);
  renderInv();
}

// ── 스킬2 사용 ──
// 스킬2 캐릭터 이펙트
function playSkill2Effect(skill2Id) {
  const charEl = document.getElementById('ba-char-emoji');
  if (!charEl) return;

  const fxMap = {
    heal:     { cls:'skill-fx-heal',    flash:'rgba(111,212,157,.25)', label:'💊', txt:'#6fd49d' },
    guard:    { cls:'skill-fx-guard',   flash:'rgba(126,200,227,.22)', label:'🛡️', txt:'#7ec8e3' },
    counter:  { cls:'skill-fx-counter', flash:'rgba(195,155,211,.22)', label:'⚔️', txt:'#c39bd3' },
    prep:     { cls:'skill-fx-prep',    flash:'rgba(255,215,0,.25)',   label:'🎯', txt:'#FFD700' },
    reckless: { cls:'skill-fx-ki',      flash:'rgba(255,100,0,.25)',   label:'⚡', txt:'#FF8A80' },
    rush:     { cls:'skill-fx-rush',    flash:'rgba(243,156,18,.22)',  label:'🔥', txt:'#f39c12' },
  };
  const fx = fxMap[skill2Id];
  if (!fx) return;

  // 캐릭터 애니메이션
  charEl.classList.remove(fx.cls);
  void charEl.offsetWidth;
  charEl.classList.add(fx.cls);
  setTimeout(() => charEl.classList.remove(fx.cls), 800);

  // 플래시 오버레이
  const flash = document.createElement('div');
  flash.className = 'skill-flash-overlay';
  flash.style.background = fx.flash;
  charEl.style.position = 'relative';
  charEl.appendChild(flash);
  setTimeout(() => flash.remove(), 550);

  // 스킬 이름 큰 글씨 팝업
  const popup = document.createElement('div');
  popup.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    font-size:1.6rem;font-weight:900;color:${fx.txt};z-index:999;pointer-events:none;
    text-shadow:0 0 12px ${fx.txt},0 2px 4px rgba(0,0,0,.8);
    animation:skill-flash .65s ease-out forwards;white-space:nowrap;`;
  popup.textContent = fx.label;
  const arena = document.getElementById('battle-arena');
  if (arena) { arena.style.position='relative'; arena.appendChild(popup); setTimeout(()=>popup.remove(),700); }
}

function doSkill2(skill2Id) {
  if (!BATTLE_STATE || BATTLE_STATE.finished || BATTLE_STATE.turn !== 'player') return;
  if (BATTLE_STATE.skill2Used?.[skill2Id]) return;
  document.querySelectorAll('#battle-arena button').forEach(b => b.disabled = true);

  // 이펙트 먼저 재생
  playSkill2Effect(skill2Id);

  if (skill2Id === 'reckless') {
    setTimeout(() => {
      BATTLE_STATE = performSkill2(BATTLE_STATE, 'reckless');
      _updateBattleLog(BATTLE_STATE);
      setTimeout(() => _showRecklessSkillPicker(), 300);
    }, 250);
    return;
  }

  setTimeout(() => {
    BATTLE_STATE = performSkill2(BATTLE_STATE, skill2Id);
    _updateBattleLog(BATTLE_STATE);

    setTimeout(() => {
      _updateBattleHpBars(BATTLE_STATE);
      if (BATTLE_STATE.finished) {
        setTimeout(() => _finishBattle(), 400);
        return;
      }
      if (BATTLE_STATE.turn === 'monster') {
        setTimeout(() => _doMonsterTurn(), 300);
      } else {
        BATTLE_MENU = 'main';
        renderBattleNew();
      }
    }, 350);
  }, 250);
}

function _showRecklessSkillPicker() {
  const sl = BATTLE_STATE.skillLevels || {};
  const equippedTypes = [...new Set((CUR.equippedSkills||['normal']).filter(Boolean))];
  const typeNames = { normal:'⚔️ 일반 공격', fire:'🔥 화염 공격', water:'💧 냉기 공격', grass:'🌿 자연 공격' };

  // battle-arena 안 actionHtml 자리에 인라인으로 렌더
  const arenaEl = document.getElementById('battle-arena');
  if (!arenaEl) return;

  // 기존 피커가 있으면 제거
  document.getElementById('reckless-picker')?.remove();

  const picker = document.createElement('div');
  picker.id = 'reckless-picker';
  picker.innerHTML = `
    <div style="margin-top:.2rem">
      <div style="font-size:.72rem;color:var(--txt3);margin-bottom:.4rem;font-weight:700">
        ⚡ 무리한 공격 — 스킬 선택
      </div>
      ${equippedTypes.map(type => `
        <div onclick="doReckless('${type}')"
          style="padding:.5rem .8rem;border-radius:10px;cursor:pointer;margin-bottom:.35rem;
            border:1.5px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);
            display:flex;justify-content:space-between;align-items:center;
            transition:background .15s"
          onmouseenter="this.style.background='rgba(255,255,255,.1)'"
          onmouseleave="this.style.background='rgba(255,255,255,.05)'">
          <span style="font-size:.82rem;font-weight:700">${typeNames[type]||type}</span>
          <span style="font-size:.7rem;color:var(--txt3)">Lv.${sl[type]||0}</span>
        </div>`).join('')}
    </div>`;

  // battle-arena 마지막에 붙이기
  arenaEl.appendChild(picker);
}

function doReckless(attackType) {
  document.getElementById('reckless-picker')?.remove();
  BATTLE_STATE = performRecklessAttack(BATTLE_STATE, attackType);
  _updateBattleLog(BATTLE_STATE);

  // 0.35초 후 결과 연출
  setTimeout(() => {
    const pa = BATTLE_STATE.lastPlayerAction;
    if (pa && pa.dmg > 0) {
      const monEl = document.getElementById('ba-mon-emoji');
      if (monEl) { monEl.classList.remove('ba-mon-hit'); void monEl.offsetWidth; monEl.classList.add('ba-mon-hit'); setTimeout(()=>monEl.classList.remove('ba-mon-hit'),400); }
      spawnDmgFloat(`⚡ -${pa.dmg}`, '#FFD700');
    }
    _updateBattleHpBars(BATTLE_STATE);
    if (BATTLE_STATE.finished) { setTimeout(()=>_finishBattle(),400); return; }
    // 0.45초 후 몬스터 턴
    setTimeout(() => {
      if (BATTLE_STATE.turn === 'monster') _doMonsterTurn();
      else { BATTLE_MENU='main'; renderBattleNew(); }
    }, 450);
  }, 350);
}

function closeBattle() {
  closeModal('m-battle');
  if (BATTLE_DONE && CUR.battleOffersByZone) {
    CUR.battleOffersByZone[CUR_ZONE] = null;
    DB.saveStudent(CUR);
  }
  // 전투 후 사냥터로 돌아갈 때 몬스터 선택 화면 다시 렌더
  MONSTER_STEP = 'monster';
  renderMonsterStep();
  renderMain(); renderMobile();
}

// 사냥터 모달 열기 (기본 zone은 플레이어 레벨 기준 자동 선택)
// ── 사냥터 모달 ──────────────────────────────────────────
let MONSTER_STEP = 'zone'; // 'zone' | 'monster' | 'dex'
let MONSTER_DEX_ZONE = 'beginner';
let MONSTER_TAB = 'normal'; // 'normal' | 'infinite'

function setMonsterTab(tab) {
  MONSTER_TAB = tab;
  ['normal','infinite'].forEach(t => {
    const btn = document.getElementById(`mon-tab-${t}`);
    if (!btn) return;
    const active = t === tab;
    btn.style.background = active ? 'rgba(255,215,0,.15)' : 'rgba(255,255,255,.06)';
    btn.style.color = active ? 'var(--gold)' : 'var(--txt3)';
    btn.style.borderColor = active ? 'rgba(255,215,0,.4)' : 'rgba(255,255,255,.15)';
  });
  if (tab === 'infinite') {
    document.getElementById('monster-modal-title').textContent = '♾️ 무한배틀';
    renderInfiniteBattleZoneSelect();
  } else {
    document.getElementById('monster-modal-title').textContent = '⚔️ 사냥터';
    MONSTER_STEP = 'zone';
    renderMonsterStep();
  }
}

function openMonsterModal() {
  MONSTER_STEP = 'zone';
  MONSTER_TAB = 'normal';
  openModal('m-monster');
  // 탭 초기 스타일
  setMonsterTab('normal');
}

// ══════════════════════════════════════════════════════
// ♾️ 무한배틀 시스템
// ══════════════════════════════════════════════════════

// 무한배틀 세션 상태 (전투 간 유지)
let IB = {
  zone: null,       // 'beginner' | 'intermediate' | 'advanced'
  kills: 0,
  gold: 0,
  active: false,
  playerHp: 0,      // 세션 간 체력 유지
  playerHpMax: 0,
};

// 존별 보상/확률 테이블
const IB_CONFIG = {
  beginner:     { baseGold:10, prob:{ common:89, rare:10, legend:1  } },
  intermediate: { baseGold:18, prob:{ common:84, rare:14, legend:2  } },
  advanced:     { baseGold:32, prob:{ common:79, rare:18, legend:3  } },
};

// 무한배틀 하루 제한 횟수 가져오기
function _ibDailyLimit() {
  const bs = (typeof BATTLE_CONSTS !== 'undefined' && BATTLE_CONSTS.infiniteBattleLimit !== undefined)
    ? BATTLE_CONSTS.infiniteBattleLimit
    : 1;
  return bs;
}

// 오늘 무한배틀 사용 여부 체크
function ibUsedToday() {
  const today = Utils.todayStr();
  const d = CUR.infiniteBattleDaily || {};
  if (d.dateKey !== today) return false;
  const limit = _ibDailyLimit();
  return (d.used || 0) >= limit;
}

// 무한배틀 구역 선택 화면 렌더
function renderInfiniteBattleZoneSelect() {
  const body = document.getElementById('monster-modal-body');
  if (!body) return;
  const used = ibUsedToday();
  const limit = _ibDailyLimit();
  const today = Utils.todayStr();
  const prevD = CUR.infiniteBattleDaily || {};
  const usedCount = prevD.dateKey === today ? (prevD.used || 0) : 0;
  const remaining = Math.max(0, limit - usedCount);
  const best = CUR.infiniteBattleBest || { beginner:0, intermediate:0, advanced:0 };

  const lv = CUR.level || 1;
  const zones = [
    { id:'beginner',     icon:'🌿', name:'초급 사냥터', color:'#6fd49d', border:'rgba(111,212,157,.35)', bg:'rgba(111,212,157,.07)', gold:'10G / 마리', minLv:1  },
    { id:'intermediate', icon:'🔥', name:'중급 사냥터', color:'#FF8A80', border:'rgba(255,138,128,.35)', bg:'rgba(255,138,128,.07)', gold:'18G / 마리', minLv:1  },
    { id:'advanced',     icon:'⚡', name:'고급 사냥터', color:'#7ec8e3', border:'rgba(126,200,227,.35)', bg:'rgba(126,200,227,.07)', gold:'32G / 마리', minLv:21 },
  ];

  body.innerHTML = `
    <div style="padding:.6rem 0 .4rem">
      <div style="font-size:.8rem;color:var(--txt2);line-height:1.7;margin-bottom:.9rem;
        background:rgba(255,255,255,.04);border-radius:10px;padding:.6rem .8rem">
        선택한 사냥터에서 <b style="color:var(--gold)">죽을 때까지 연속 전투</b>합니다.<br>
        몬스터를 처치할 때마다 <b style="color:#6fd49d">최대 체력의 20%</b>를 회복합니다.<br>
        <span style="color:var(--txt3);font-size:.72rem">경험치 없음 · 소량 골드 지급 · 하루 ${limit}회</span>
      </div>
      ${used
        ? `<div style="text-align:center;padding:1.2rem;background:rgba(255,255,255,.04);
            border-radius:12px;color:var(--txt3);font-size:.85rem">
            ♾️ 오늘 무한배틀 도전을 모두 완료했어요!<br>
            <span style="font-size:.72rem">내일 다시 도전할 수 있어요</span>
          </div>`
        : `<div style="text-align:right;font-size:.72rem;color:var(--txt3);margin-bottom:.5rem">
            오늘 남은 도전: <b style="color:var(--gold)">${remaining}회</b> / ${limit}회
          </div>
          <div style="display:flex;flex-direction:column;gap:.5rem">
            ${zones.map(z => {
              const locked = lv < z.minLv;
              return `<button onclick="${locked
                  ? `toast('⚡ 고급 사냥터는 Lv.21부터 입장할 수 있어요!')`
                  : `startInfiniteBattle('${z.id}')`}"
                style="display:flex;align-items:center;gap:.8rem;padding:.75rem 1rem;
                  border-radius:12px;border:1px solid ${locked ? 'rgba(255,255,255,.1)' : z.border};
                  background:${locked ? 'rgba(255,255,255,.03)' : z.bg};
                  cursor:pointer;font-family:inherit;text-align:left;width:100%;
                  opacity:${locked ? '.5' : '1'}">
                <span style="font-size:1.6rem">${locked ? '🔒' : z.icon}</span>
                <div style="flex:1">
                  <div style="font-size:.88rem;font-weight:700;color:${locked ? 'var(--txt3)' : z.color}">
                    ${z.name}${locked ? ` <span style="font-size:.68rem">(Lv.${z.minLv} 필요)</span>` : ''}
                  </div>
                  <div style="font-size:.7rem;color:var(--txt3);margin-top:.1rem">
                    ${locked ? `현재 Lv.${lv} · Lv.${z.minLv}부터 입장 가능` : `${z.gold} · rare/legend 확률 상승`}
                  </div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:.65rem;color:var(--txt3)">최고기록</div>
                  <div style="font-size:.88rem;font-weight:700;color:${locked ? 'var(--txt3)' : z.color}">${best[z.id] || 0}마리</div>
                </div>
              </button>`;
            }).join('')}
          </div>`
      }
    </div>`;
}

// 무한배틀 시작
function startInfiniteBattle(zone) {
  if (ibUsedToday()) { toast('오늘은 이미 무한배틀을 완료했어요!'); return; }
  if (zone === 'advanced' && (CUR.level || 1) < 21) {
    toast('⚡ 고급 사냥터는 Lv.21부터 입장할 수 있어요!'); return;
  }

  IB = {
    zone,
    kills: 0,
    gold: 0,
    active: true,
    playerHp: 0,
    playerHpMax: 0,
  };

  // 하루 사용 기록 (used를 숫자로 누적)
  const today = Utils.todayStr();
  const prev = CUR.infiniteBattleDaily || {};
  const prevUsed = prev.dateKey === today ? (prev.used || 0) : 0;
  CUR.infiniteBattleDaily = { dateKey: today, used: prevUsed + 1 };
  DB.saveStudent(CUR);

  closeModal('m-monster');
  _ibNextMonster();
}

// 가중치 랜덤으로 희귀도 결정
function _ibPickRarity(zone) {
  const prob = IB_CONFIG[zone].prob;
  const r = Math.random() * 100;
  if (r < prob.legend) return 'legend';
  if (r < prob.legend + prob.rare) return 'rare';
  return 'common';
}

// 무한배틀용 몬스터 랜덤 선택
function _ibPickMonster(zone) {
  const pool = GAME_DATA.monsters.filter(m => m.zone === zone);
  let rarity = _ibPickRarity(zone);

  // fallback: 해당 희귀도 없으면 하위로
  let candidates = pool.filter(m => m.rarity === rarity);
  if (!candidates.length && rarity === 'legend') { rarity = 'rare'; candidates = pool.filter(m => m.rarity === rarity); }
  if (!candidates.length) candidates = pool.filter(m => m.rarity === 'common');
  if (!candidates.length) candidates = pool;
  if (!candidates.length) return null;

  return { ...candidates[Math.floor(Math.random() * candidates.length)], _ibRarity: rarity };
}

// 다음 몬스터 생성 및 전투 시작
function _ibNextMonster() {
  const mon = _ibPickMonster(IB.zone);
  if (!mon) { toast('몬스터를 찾을 수 없어요'); return; }

  const playerStats = getPlayerBattleStats(CUR);
  const hpMult  = BATTLE_CONSTS?.monsterHpMult  || 1.0;
  const atkMult = BATTLE_CONSTS?.monsterAtkMult || 1.0;

  BATTLE_STATE = {
    ...startBattleEngine(CUR, mon),
    isInfinite: true,
    ibRarity: mon._ibRarity,
  };

  // 첫 전투면 체력 초기화, 이후엔 세션 체력 유지
  if (IB.kills === 0) {
    IB.playerHpMax = BATTLE_STATE.playerHpMax;
    IB.playerHp   = BATTLE_STATE.playerHpMax;
  } else {
    // 이전 전투 체력 이어받기
    BATTLE_STATE.playerHp = IB.playerHp;
  }

  BATTLE_DONE  = false;
  BATTLE_MENU  = 'main';
  document.getElementById('battle-title').textContent =
    `♾️ 무한배틀 — ${IB.kills + 1}번째`;
  document.getElementById('battle-sub').textContent =
    `${IB.zone === 'beginner' ? '초급' : IB.zone === 'intermediate' ? '중급' : '고급'} · 처치 ${IB.kills}마리 · 누적 ${IB.gold}G`;

  const rarityBanner = mon._ibRarity === 'legend'
    ? `<div style="text-align:center;color:#FFD700;font-weight:800;font-size:.82rem;margin-bottom:.3rem">
        ✨ 전설 몬스터 등장! ✨</div>`
    : mon._ibRarity === 'rare'
    ? `<div style="text-align:center;color:#c39bd3;font-weight:700;font-size:.78rem;margin-bottom:.3rem">
        💜 희귀 몬스터 등장!</div>`
    : '';

  openModal('m-battle');
  // 기존 battle-arena에 희귀도 배너 삽입 후 renderBattleNew 호출
  setTimeout(() => {
    if (rarityBanner) {
      const arenaEl = document.getElementById('battle-arena');
      if (arenaEl) {
        const banner = document.createElement('div');
        banner.innerHTML = rarityBanner;
        arenaEl.prepend(banner);
      }
    }
  }, 100);

  if (BATTLE_STATE.turn === 'monster') {
    renderBattleNew();
    setTimeout(() => _doMonsterTurn(), 800);
  } else {
    renderBattleNew();
  }
}

// 무한배틀 전투 1회 종료 처리
function _finishInfiniteBattle() {
  const win = BATTLE_STATE.win;

  if (win) {
    // 처치 성공
    IB.kills++;
    const cfg = IB_CONFIG[IB.zone];
    let gold = cfg.baseGold;
    if (BATTLE_STATE.ibRarity === 'rare')   gold = Math.floor(gold * 1.5);
    if (BATTLE_STATE.ibRarity === 'legend') gold = Math.floor(gold * 2.0);
    IB.gold += gold;

    // 최대 체력 20% 회복 (세션 체력 갱신)
    const heal = Math.floor(IB.playerHpMax * 0.2);
    IB.playerHp = Math.min(IB.playerHpMax, BATTLE_STATE.playerHp + heal);

    // 도감 기록 (monsterLog)
    const monId = BATTLE_STATE.monster.id;
    if (!(CUR.monsterLog || []).includes(monId)) {
      CUR.monsterLog = [...(CUR.monsterLog || []), monId];
    }

    // 짧은 결과 표시 후 다음 몬스터
    const arenaEl = document.getElementById('battle-arena');
    if (arenaEl) {
      arenaEl.innerHTML = `
        <div style="text-align:center;padding:1.4rem .8rem">
          <div style="font-size:1.6rem;margin-bottom:.3rem">🏆</div>
          <div style="font-size:.95rem;font-weight:800;color:#6fd49d;margin-bottom:.2rem">처치!</div>
          <div style="font-size:.82rem;color:var(--gold);margin-bottom:.1rem">+${gold}G · 체력 +${heal}</div>
          <div style="font-size:.72rem;color:var(--txt3)">다음 몬스터 등장 중...</div>
        </div>`;
    }
    DB.saveStudent(CUR);

    // 10승 달성 시 자동 종료
    if (IB.kills >= 10) {
      const arenaEl2 = document.getElementById('battle-arena');
      if (arenaEl2) {
        arenaEl2.innerHTML = `
          <div style="text-align:center;padding:1.4rem .8rem">
            <div style="font-size:2rem;margin-bottom:.3rem">🏆</div>
            <div style="font-size:1rem;font-weight:800;color:var(--gold);margin-bottom:.2rem">배틀 완료!</div>
            <div style="font-size:.82rem;color:var(--txt3)">10마리 처치 달성!</div>
          </div>`;
      }
      setTimeout(() => _endInfiniteBattleSession(false), 1600);
    } else {
      setTimeout(() => _ibNextMonster(), 1400);
    }

  } else {
    // 패배 — 세션 종료
    IB.playerHp = 0;
    _endInfiniteBattleSession(false);
  }
}

// 무한배틀 세션 최종 종료 (패배 or 포기)
function _endInfiniteBattleSession(forfeit) {
  // 기록 저장
  const best = CUR.infiniteBattleBest || { beginner:0, intermediate:0, advanced:0 };
  const isNewBest = IB.kills > (best[IB.zone] || 0);
  if (isNewBest) best[IB.zone] = IB.kills;

  CUR.infiniteBattleBest   = best;
  CUR.infiniteBattleTotalKills = (CUR.infiniteBattleTotalKills || 0) + IB.kills;
  CUR.gold += IB.gold;
  CUR.totalGold = (CUR.totalGold || 0) + IB.gold;
  CUR.infiniteBattleLastResult = {
    zone: IB.zone, kills: IB.kills, gold: IB.gold,
    forfeit, endedAt: Date.now(),
  };
  CUR.battleInProgress = null;
  BATTLE_DONE = true;
  IB.active = false;

  DB.saveStudent(CUR);
  renderHUD();
  checkAchievements();

  const zoneNames = { beginner:'🌿 초급', intermediate:'🔥 중급', advanced:'⚡ 고급' };
  const arenaEl = document.getElementById('battle-arena');
  if (arenaEl) {
    arenaEl.innerHTML = `
      <div style="text-align:center;padding:1rem .8rem">
        <div style="font-size:1.8rem;margin-bottom:.4rem">${IB.kills > 0 ? '⚔️' : '💀'}</div>
        <div style="font-size:1rem;font-weight:800;color:var(--gold);margin-bottom:.6rem">
          무한배틀 종료${forfeit ? ' (포기)' : ''}
        </div>
        <div style="background:rgba(255,255,255,.05);border-radius:12px;padding:.7rem;margin-bottom:.6rem">
          <div style="font-size:.78rem;color:var(--txt3);margin-bottom:.3rem">${zoneNames[IB.zone]} 사냥터</div>
          <div style="font-size:1.3rem;font-weight:800;color:var(--gold)">${IB.kills}마리 처치</div>
          <div style="font-size:.88rem;color:#6fd49d;margin-top:.1rem">+${IB.gold}G 획득</div>
          ${isNewBest ? `<div style="font-size:.75rem;color:#FFD700;margin-top:.3rem;font-weight:700">
            ✨ 최고 기록 갱신!</div>` : `<div style="font-size:.72rem;color:var(--txt3);margin-top:.2rem">
            최고 기록: ${best[IB.zone]}마리</div>`}
        </div>
        <button onclick="closeModal('m-battle');renderMain();renderMobile()"
          style="padding:.55rem 2rem;border-radius:12px;font-family:inherit;font-size:.88rem;
            cursor:pointer;border:1px solid rgba(255,215,0,.3);
            background:rgba(255,215,0,.12);color:var(--gold);font-weight:700">
          ✅ 확인
        </button>
      </div>`;
  }
}

function renderMonsterStep() {
  const body  = document.getElementById('monster-modal-body');
  const title = document.getElementById('monster-modal-title');
  if (!body) return;
  const lv = CUR.level || 1;
  const canFight = Utils.canFightMonster(CUR);
  const attemptsLeft = Utils.monsterAttemptsLeft(CUR);
  const limit = Utils._getBattleLimit();
  const killed = CUR.monsterLog || [];

  // ── 1단계: 구역 선택 ──────────────────────────────────
  if (MONSTER_STEP === 'zone') {
    title.textContent = '⚔️ 사냥터';
    const ZONE_INFO = [
      { id:'beginner',     icon:'🌿', name:'초급 사냥터', sub:'Lv 1 ~ 10',  minLv:1,
        color:'#6fd49d', bg:'linear-gradient(150deg,#0a2318,#152e1e)', border:'rgba(111,212,157,.4)',
        desc:'안전하게 시작하기 좋은 구역', reward:'10 ~ 50G' },
      { id:'intermediate', icon:'🔥', name:'중급 사냥터', sub:'Lv 11 ~ 20', minLv:1,
        color:'#FF8A80', bg:'linear-gradient(150deg,#2a0d0d,#401515)', border:'rgba(255,138,128,.4)',
        desc:'강한 몬스터, 두둑한 보상', reward:'30 ~ 120G' },
      { id:'advanced',     icon:'⚡', name:'고급 사냥터', sub:'Lv 21 ~ 30', minLv:21,
        color:'#7ec8e3', bg:'linear-gradient(150deg,#0a1828,#162840)', border:'rgba(126,200,227,.4)',
        desc:'극한의 도전, 최강 보상', reward:'80 ~ 250G' },
    ];
    const allMons = GAME_DATA.monsters;

    const zoneCards = ZONE_INFO.map(z => {
      const locked = lv < z.minLv;
      const mons   = allMons.filter(m => m.zone === z.id);
      const kCount = mons.filter(m => killed.includes(m.name)).length;
      const pct    = mons.length ? Math.round(kCount/mons.length*100) : 0;
      const preview = mons.slice(0,3).map(m =>
        `<div style="text-align:center">
          <div style="font-size:1.5rem">${iconImg(m, 'monsters', '1.5rem')}</div>
          <div style="font-size:.52rem;color:var(--txt3)">Lv${m.level||m.recLv}</div>
        </div>`).join('');

      return `<div class="zone-card ${locked?'zone-locked':''}"
        onclick="${locked?`toast('Lv.${z.minLv} 이상 필요해요!')`:`selectZoneCard('${z.id}')`}"
        style="background:${z.bg};border:2px solid ${locked?'rgba(255,255,255,.08)':z.border};
          border-radius:18px;padding:1.2rem;cursor:${locked?'not-allowed':'pointer'};
          opacity:${locked?.4:1};transition:transform .18s,box-shadow .18s;
          position:relative;overflow:hidden;display:flex;flex-direction:column;gap:.7rem">
        ${!locked?'<div class="zone-shine"></div>':''}
        <div style="display:flex;align-items:center;gap:.6rem">
          <span style="font-size:1.8rem">${z.icon}</span>
          <div style="flex:1">
            <div style="font-size:.95rem;font-weight:800;color:${locked?'var(--txt3)':z.color}">${z.name}</div>
            <div style="font-size:.65rem;color:var(--txt3)">${z.sub}</div>
          </div>
          ${locked?`<span style="font-size:.65rem;color:var(--red);background:rgba(231,76,60,.15);
            border-radius:6px;padding:.2rem .45rem;white-space:nowrap">🔒 Lv.${z.minLv}</span>`:''}
        </div>
        <div style="font-size:.68rem;color:var(--txt3)">${z.desc}</div>
        <div style="display:flex;gap:.4rem;align-items:center">
          ${preview}
          <div style="font-size:.6rem;color:var(--txt3);margin-left:auto">외 ${Math.max(0,mons.length-3)}마리</div>
        </div>
        <div style="border-top:1px solid rgba(255,255,255,.07);padding-top:.6rem;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:.68rem;color:${locked?'var(--txt3)':z.color}">💰 ${z.reward}</span>
          <span style="font-size:.62rem;color:var(--txt3)">${kCount}/${mons.length} 처치</span>
        </div>
        <div style="height:4px;background:rgba(255,255,255,.07);border-radius:2px">
          <div style="height:100%;width:${pct}%;background:${z.color};border-radius:2px"></div>
        </div>
        ${!locked&&canFight?`<div style="text-align:center;background:${z.color};color:#111;
          font-size:.75rem;font-weight:800;border-radius:10px;padding:.35rem">입장 →</div>`:''}
      </div>`;
    }).join('');

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.9rem">
        <div>
          <div style="font-size:.92rem;font-weight:700">구역을 선택하세요</div>
          <div style="font-size:.68rem;color:var(--txt3);margin-top:.1rem">선택 후 돌아올 수 없어요</div>
        </div>
        ${canFight
          ? `<div style="text-align:right">
               <div style="font-size:1.2rem;font-weight:800;color:var(--gold)">${attemptsLeft}
                 <span style="font-size:.65rem;font-weight:400;color:var(--txt3)">/${limit}회</span>
               </div>
               <div style="font-size:.6rem;color:var(--txt3)">오늘 남은 전투</div>
             </div>`
          : `<div style="font-size:.75rem;color:var(--txt3)">오늘 완료 ✅</div>`}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.9rem">${zoneCards}</div>
      <div style="text-align:center;margin-top:.9rem">
        <button onclick="MONSTER_STEP='dex';MONSTER_DEX_ZONE='beginner';renderMonsterStep()"
          style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;
            color:var(--txt3);font-size:.73rem;padding:.4rem 1.2rem;cursor:pointer;font-family:inherit">
          📖 몬스터 도감 보기
        </button>
      </div>`;
  }

  // ── 2단계: 몬스터 선택 ──────────────────────────────────
  else if (MONSTER_STEP === 'monster') {
    const zoneNames  = { beginner:'🌿 초급 사냥터', intermediate:'🔥 중급 사냥터', advanced:'⚡ 고급 사냥터' };
    const zoneColors = { beginner:'#6fd49d', intermediate:'#FF8A80', advanced:'#7ec8e3' };
    const zoneBgs    = { beginner:'linear-gradient(150deg,#0a2318,#152e1e)', intermediate:'linear-gradient(150deg,#2a0d0d,#401515)', advanced:'linear-gradient(150deg,#0a1828,#162840)' };
    title.textContent = zoneNames[CUR_ZONE] || '⚔️ 사냥터';
    const zc = zoneColors[CUR_ZONE] || '#FF8A80';

    // offers 로드
    const today = Utils.todayStr();
    if (!CUR.battleOffersByZone || CUR.battleOffersByZone.dateKey !== today)
      CUR.battleOffersByZone = { dateKey: today, beginner: null, intermediate: null, advanced: null };
    let offers;
    const saved = CUR.battleOffersByZone[CUR_ZONE];
    if (saved) {
      offers = Array.isArray(saved) && typeof saved[0] === 'string'
        ? saved.map(id => GAME_DATA.monsters.find(m => m.id === id)).filter(Boolean) : saved;
      if (!offers || offers.length < 3) { CUR.battleOffersByZone[CUR_ZONE] = null; offers = null; }
    }
    if (!offers) {
      offers = generateBattleOffers(CUR, CUR_ZONE);
      if (offers.length) { CUR.battleOffersByZone[CUR_ZONE] = offers.map(m => m.id); DB.saveStudent(CUR); }
    }

    const slotLabels = ['① 안정', '② 도전', '③ 특별'];

    const monCards = (offers||[]).map((mon, i) => {
      const isKilled  = killed.includes(mon.name);
      const isSpecial = i === 2 || mon.rarity === 'legend' || mon.rarity === 'rare';
      const isLegend  = mon.rarity === 'legend';
      const bdColor   = isLegend ? 'rgba(255,215,0,.7)' : isSpecial ? 'rgba(200,120,255,.6)' : 'rgba(231,76,60,.3)';
      const glow      = isLegend ? '0 0 22px rgba(255,215,0,.35)' : isSpecial ? '0 0 18px rgba(200,120,255,.25)' : 'none';
      const badgeTxt  = isLegend ? '✨ 전설' : isSpecial ? '💫 특별' : '';
      const badgeColor= isLegend ? '#FFD700' : '#d070ff';
      const elemE     = {fire:'🔥',water:'💧',grass:'🌿'}[mon.element||''] || '';
      return `<div class="mon-select-card ${canFight?'':'mon-select-dim'}"
        onclick="${canFight?`selectMonsterCard('${mon.id}')`:''}"
        style="background:${zoneBgs[CUR_ZONE]};border:2px solid ${bdColor};
          box-shadow:${isSpecial&&canFight?glow:'none'};
          border-radius:16px;padding:1.2rem .8rem 1rem;text-align:center;
          cursor:${canFight?'pointer':'default'};
          transition:transform .18s,box-shadow .18s;position:relative;overflow:hidden">
        ${isSpecial&&canFight?'<div class="zone-shine"></div>':''}
        ${badgeTxt?`<div style="position:absolute;top:.45rem;right:.45rem;
          font-size:.58rem;font-weight:700;color:${badgeColor};
          background:rgba(0,0,0,.4);border:1px solid ${badgeColor};
          border-radius:6px;padding:.12rem .35rem">${badgeTxt}</div>`:''}
        <div style="font-size:.58rem;color:var(--txt3);margin-bottom:.3rem">${slotLabels[i]||''}</div>
        <div style="font-size:2.3rem;margin-bottom:.3rem">${iconImg(mon, 'monsters', '2.3rem')}</div>
        <div style="font-size:.85rem;font-weight:800;color:${isKilled?'var(--txt3)':isSpecial?'#fff':'var(--txt1)'};margin-bottom:.2rem">${mon.name}</div>
        <div style="font-size:.63rem;color:var(--txt3)">Lv.${mon.level||mon.recLv} ${elemE}${mon.trait==='ghost'?' 👻':''}</div>
        <div style="font-size:.67rem;color:var(--gold);margin:.2rem 0">💰${mon.gold}G</div>
        <div style="margin-top:.5rem">
          ${isKilled
            ? '<div style="font-size:.63rem;color:var(--emerald);background:rgba(46,204,113,.12);border-radius:8px;padding:.2rem .5rem">✓ 처치완료</div>'
            : canFight
              ? `<div style="font-size:.72rem;font-weight:800;color:#fff;
                  background:${isSpecial?'linear-gradient(90deg,rgba(180,80,255,.8),rgba(231,76,60,.8))':'rgba(231,76,60,.75)'};
                  border-radius:10px;padding:.3rem">도전!</div>`
              : '<div style="font-size:.62rem;color:var(--txt3)">오늘 완료</div>'}
        </div>
      </div>`;
    }).join('');

    // 도감 진행도
    const zoneMons   = GAME_DATA.monsters.filter(m => m.zone === CUR_ZONE);
    const zoneKilled = zoneMons.filter(m => killed.includes(m.name)).length;
    const pct = zoneMons.length ? Math.round(zoneKilled/zoneMons.length*100) : 0;

    // 나머지 몬스터 미리보기 (오늘 후보 제외)
    const offerIds = new Set((offers||[]).map(m=>m.id));
    const others   = zoneMons.filter(m => !offerIds.has(m.id)).slice(0,6);
    const othersHtml = others.length ? `
      <div style="margin-top:1rem;padding-top:.9rem;border-top:1px solid rgba(255,255,255,.07)">
        <div style="font-size:.72rem;font-weight:700;color:var(--txt2);margin-bottom:.6rem">이 구역의 다른 몬스터</div>
        <div style="display:flex;flex-wrap:wrap;gap:.4rem">
          ${others.map(m => {
            const isK = killed.includes(m.name);
            return `<div style="display:flex;align-items:center;gap:.35rem;padding:.25rem .55rem;
              border-radius:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,${isK?'.08':'.06'});
              opacity:${isK?.65:1}">
              <span style="font-size:.85rem">${iconImg(m, 'monsters', '.85rem')}</span>
              <div>
                <div style="font-size:.63rem;font-weight:600;color:${isK?'var(--txt3)':'var(--txt2)'}">${m.name}</div>
                <div style="font-size:.56rem;color:var(--txt3)">Lv${m.level||m.recLv}${isK?' ✓':''}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>` : '';

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem">
        <div>
          <span style="font-size:.98rem;font-weight:800;color:${zc}">${zoneNames[CUR_ZONE]}</span>
          <div style="font-size:.65rem;color:var(--txt3);margin-top:.1rem">오늘의 추천 3마리</div>
        </div>
        ${canFight
          ? `<div style="text-align:right">
               <div style="font-size:1.1rem;font-weight:800;color:var(--gold)">${attemptsLeft}<span style="font-size:.6rem;color:var(--txt3)">/${limit}</span></div>
               <div style="font-size:.6rem;color:var(--txt3)">남은 전투</div>
             </div>`
          : `<div style="font-size:.72rem;color:var(--txt3)">오늘 완료 ✅</div>`}
      </div>
      <div style="margin-bottom:.8rem">
        <div style="display:flex;justify-content:space-between;font-size:.62rem;color:var(--txt3);margin-bottom:.25rem">
          <span>📖 도감 진행도</span><span>${zoneKilled}/${zoneMons.length} (${pct}%)</span>
        </div>
        <div style="height:4px;background:rgba(255,255,255,.08);border-radius:2px">
          <div style="height:100%;width:${pct}%;background:${zc};border-radius:2px"></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.9rem">${monCards}</div>
      ${othersHtml}
      <div style="text-align:center;margin-top:.9rem">
        <button onclick="MONSTER_STEP='dex';MONSTER_DEX_ZONE='${CUR_ZONE}';renderMonsterStep()"
          style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;
            color:var(--txt3);font-size:.72rem;padding:.4rem 1.2rem;cursor:pointer;font-family:inherit">
          📖 전체 도감 보기
        </button>
      </div>`;
  }

  // ── 3단계: 도감 ──────────────────────────────────────
  else if (MONSTER_STEP === 'dex') {
    title.textContent = '📖 몬스터 도감';
    const allMons = GAME_DATA.monsters;
    const dexZones = [
      { id:'beginner',     label:'🌿 초급', color:'#6fd49d' },
      { id:'intermediate', label:'🔥 중급', color:'#FF8A80' },
      { id:'advanced',     label:'⚡ 고급', color:'#7ec8e3' },
    ];
    const zc = dexZones.find(z=>z.id===MONSTER_DEX_ZONE)?.color || '#fff';
    const zoneMons = allMons.filter(m => m.zone === MONSTER_DEX_ZONE);
    const killedCount = zoneMons.filter(m => killed.includes(m.name)).length;
    const pct = zoneMons.length ? Math.round(killedCount/zoneMons.length*100) : 0;

    const tabsHtml = dexZones.map(z => {
      const kc = allMons.filter(m=>m.zone===z.id&&killed.includes(m.name)).length;
      const tot= allMons.filter(m=>m.zone===z.id).length;
      const active = MONSTER_DEX_ZONE===z.id;
      return `<button onclick="MONSTER_DEX_ZONE='${z.id}';renderMonsterStep()"
        style="flex:1;padding:.4rem .3rem;border-radius:10px;font-size:.75rem;cursor:pointer;font-family:inherit;
          border:1.5px solid ${active?z.color:'rgba(255,255,255,.1)'};
          background:${active?'rgba(255,255,255,.07)':'rgba(255,255,255,.03)'};
          color:${active?z.color:'var(--txt3)'};font-weight:${active?'700':'400'}">
        ${z.label}<br><span style="font-size:.58rem;opacity:.7">${kc}/${tot}</span>
      </button>`;
    }).join('');

    const cardsHtml = zoneMons.map(m => {
      const isKilled  = killed.includes(m.name);
      const wasMet    = isKilled || (CUR.recentBattleOffers||[]).flat().some(n=>n===m.name);
      const isSpecial = m.rarity === 'legend' || m.rarity === 'rare';

      if (isKilled) {
        const glowSpec = isSpecial ? ';box-shadow:0 0 14px rgba(255,215,0,.2)' : '';
        return `<div style="background:rgba(46,204,113,.08);border:1.5px solid rgba(46,204,113,.3);
          border-radius:12px;padding:.65rem .4rem;text-align:center${glowSpec}">
          ${isSpecial?`<div style="font-size:.52rem;color:#FFD700;font-weight:700;margin-bottom:.1rem">✨전설</div>`:''}
          <div style="font-size:1.5rem;margin-bottom:.15rem">${iconImg(m, 'monsters', '1.5rem')}</div>
          <div style="font-size:.7rem;font-weight:700;color:var(--txt1)">${m.name}</div>
          <div style="font-size:.58rem;color:var(--txt3)">Lv${m.level||m.recLv}</div>
          <div style="font-size:.55rem;color:var(--emerald);background:rgba(46,204,113,.15);
            border-radius:5px;padding:.1rem .3rem;margin-top:.25rem">✓ 처치완료</div>
        </div>`;
      } else if (wasMet) {
        return `<div style="background:rgba(255,255,255,.04);border:1.5px solid rgba(255,255,255,.12);
          border-radius:12px;padding:.65rem .4rem;text-align:center;opacity:.8">
          <div style="font-size:1.5rem;margin-bottom:.15rem;filter:grayscale(.4)">${iconImg(m, 'monsters', '1.5rem')}</div>
          <div style="font-size:.7rem;font-weight:700;color:var(--txt2)">${m.name}</div>
          <div style="font-size:.58rem;color:var(--txt3)">Lv${m.level||m.recLv}</div>
          <div style="font-size:.55rem;color:var(--txt3);background:rgba(255,255,255,.07);
            border-radius:5px;padding:.1rem .3rem;margin-top:.25rem">미처치</div>
        </div>`;
      } else {
        return `<div style="background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.05);
          border-radius:12px;padding:.65rem .4rem;text-align:center">
          <div style="font-size:1.5rem;margin-bottom:.15rem;filter:brightness(0) opacity(.4)">❓</div>
          <div style="font-size:.7rem;font-weight:700;color:rgba(255,255,255,.18)">???</div>
          <div style="font-size:.58rem;color:rgba(255,255,255,.12)">미발견</div>
          <div style="font-size:.55rem;color:rgba(255,255,255,.12);background:rgba(255,255,255,.04);
            border-radius:5px;padding:.1rem .3rem;margin-top:.25rem">🔎</div>
        </div>`;
      }
    }).join('');

    body.innerHTML = `
      <div style="display:flex;gap:.4rem;margin-bottom:.7rem">
        <button onclick="MONSTER_STEP='zone';renderMonsterStep()"
          style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:8px;
            color:var(--txt3);font-size:.73rem;padding:.3rem .7rem;cursor:pointer;font-family:inherit;flex-shrink:0">
          ← 사냥터
        </button>
        ${tabsHtml}
      </div>
      <div style="margin-bottom:.7rem">
        <div style="display:flex;justify-content:space-between;font-size:.62rem;color:var(--txt3);margin-bottom:.25rem">
          <span>처치 현황</span><span style="color:${zc};font-weight:700">${killedCount}/${zoneMons.length} (${pct}%)</span>
        </div>
        <div style="height:4px;background:rgba(255,255,255,.08);border-radius:2px">
          <div style="height:100%;width:${pct}%;background:${zc};border-radius:2px"></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.45rem">${cardsHtml}</div>`;
  }
}

function selectZoneCard(zone) {
  // 카드 클릭 이펙트 후 이동
  CUR_ZONE = zone;
  MONSTER_STEP = 'monster';
  renderMonsterStep();
}

function selectMonsterCard(monId) {
  startBattle(monId);
}

function openZone(zone, btn) {
  CUR_ZONE = zone;
  MONSTER_STEP = 'monster';
  renderMonsterStep();
}

// ══ 보스 ══
function openBoss() {
  const settings = DB.getSettings();
  openModal('m-boss');
  document.getElementById('boss-arena').innerHTML = `
    <div style="text-align:center;padding:1rem">
      <div style="font-size:5rem;animation:floatY 3s ease-in-out infinite">${settings.bossIcon||'🧌'}</div>
      <div style="font-size:1.2rem;font-weight:700;color:var(--red);margin:.5rem 0">${settings.bossName}</div>
      <div style="font-size:.82rem;color:var(--txt2);margin-bottom:1.2rem">전체 학생이 힘을 합쳐 물리쳐요!</div>
      <div style="display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap;margin-bottom:1.2rem">
        <span class="rb-tag">💰 ${settings.bossGold}G</span>
        <span class="rb-tag">+30EXP</span><span class="rb-tag">🌱 특별 씨앗</span>
      </div>
      <button class="btn-battle" onclick="doBossFight()">⚔️ 협력 공격!</button>
    </div>`;
}

function doBossFight() {
  const settings = DB.getSettings();
  const win = Math.random() > 0.35;
  document.getElementById('boss-arena').innerHTML = `
    <div style="text-align:center;padding:1rem">
      <div style="font-size:4rem">${win?'🏆':'💀'}</div>
      <div class="ba-result ${win?'win':'lose'}" style="margin:1rem 0">${win?'🎉 보스 처치 성공!':'😢 패배...'}</div>
      <div style="font-size:.85rem;color:var(--txt2);margin-bottom:1rem">
        ${win?`💰 +${settings.bossGold}G · +30EXP · 🌱 특별 씨앗!`:'다음에 다시 도전해요!'}
      </div>
      <button class="btn-ok" onclick="${win?`claimBoss(${settings.bossGold});`:''}closeModal('m-boss')">확인</button>
    </div>`;
}

function claimBoss(gold) {
  CUR.gold += gold; CUR.exp += 30;
  CUR.totalGold = (CUR.totalGold||0) + gold;
  const oldLv = CUR.level;
  CUR.level = Utils.levelFromExp(CUR.exp);
  DB.saveStudent(CUR); renderAll();
  if (CUR.level > oldLv) triggerLevelUp(CUR.level);
}

// ══ 농장 ══
function buildFarmMiniCells(count, cols) {
  const farm = CUR.farm||[];
  const cells = Array.from({length:count}, (_,i) => {
    const plot = farm.find(f => f.slot === i);
    if (plot) {
      const sd = Utils.getSeedByCrop(plot.crop);
      const ready = sd && Utils.cropReady(plot.planted, sd.growHours);
      return `<div class="fcell ${ready?'ready':'growing'}" onclick="openModal('m-farm');renderFarmModal()">${ready?sd.cropIcon:'🌱'}</div>`;
    }
    return `<div class="fcell empty" onclick="openModal('m-farm');renderFarmModal()">+</div>`;
  }).join('');
  return `<div style="display:grid;grid-template-columns:repeat(${cols||6},1fr);gap:2px">${cells}</div>`;
}

function hasFarmReady() {
  return (CUR.farm||[]).some(p => { const sd=Utils.getSeedByCrop(p.crop); return sd&&Utils.cropReady(p.planted,sd.growHours); });
}

function farmCellClick(slot) {
  const farm = CUR.farm||[];
  const plot = farm.find(f => f.slot === slot);
  if (plot) {
    const sd = Utils.getSeedByCrop(plot.crop);
    if (!sd) return;
    if (Utils.cropReady(plot.planted, sd.growHours)) {
      const elapsed = Date.now() - plot.planted;
      const maxFresh = sd.growHours * 3600000 * 3;
      const withered = elapsed > maxFresh;

      // ── 돌연변이 수확 판정 ──
      if (plot.isMutant) {
        const rate = plot.successRate ?? sd.successRate ?? 0.5;
        const success = Math.random() < rate;
        const earned = success ? (sd.baseSellPrice || sd.sellPrice) * 2 : 0;
        if (earned > 0) {
          CUR.gold += earned;
          CUR.totalGold = (CUR.totalGold||0) + earned;
        }
        CUR.farm = (CUR.farm||[]).filter(f => f.slot !== slot);
        CUR.farmHarvests = (CUR.farmHarvests||0) + 1;
        DB.saveStudent(CUR);
        checkAchievements();
        if (success) toast(`🎉 ${sd.cropIcon} 돌연변이 재배 성공! +${earned}G 획득!`);
        else         toast(`💀 ${sd.cropIcon} 돌연변이 재배 실패... 수확 보상 없음`);
        renderFarmModal(); renderHUD(); renderMain(); renderMobile();
        if (_ifMode) _drawDeco(); // 마당 농장 즉시 갱신
        return;
      }

      // ── 일반 수확 ──
      const earned = withered
        ? Math.floor(sd.sellPrice * 0.6)
        : sd.sellPrice;
      CUR.gold += earned;
      CUR.totalGold = (CUR.totalGold||0) + earned;
      CUR.farm = (CUR.farm||[]).filter(f => f.slot !== slot);
      CUR.farmHarvests = (CUR.farmHarvests||0) + 1;
      DB.saveStudent(CUR);
      checkAchievements();
      if (withered) toast(`🍂 ${sd.cropIcon} 시든 작물 수확... +${earned}G (${sd.sellPrice}G의 60%)`);
      else toast(`🌾 ${sd.cropIcon} 수확! +${earned}G`);
      renderFarmModal(); renderHUD(); renderMain(); renderMobile();
      if (_ifMode) _drawDeco(); // 마당 농장 즉시 갱신
    } else {
      const rem = sd.growHours*3600000 - (Date.now()-plot.planted);
      const h = Math.floor(rem/3600000), m = Math.floor((rem%3600000)/60000);
      toast(`🌱 ${h > 0 ? h+'시간 ' : ''}${m}분 후 수확 가능`);
    }
  } else {
    if (!SEL_SEED) { toast('씨앗을 먼저 선택해주세요!'); return; }
    const inv = CUR.inventory||[];
    const invItem = inv.find(i => i.id === SEL_SEED);
    if (!invItem || invItem.qty < 1) { toast('씨앗이 없어요!'); return; }
    // 일반 씨앗 / 돌연변이 씨앗 모두 getSeedById로 조회
    const sd = Utils.getSeedById(SEL_SEED);
    if (!sd) return;
    invItem.qty--;
    if (invItem.qty <= 0) CUR.inventory = inv.filter(i => i.id !== SEL_SEED);
    // 돌연변이 씨앗이면 isMutant:true, successRate 저장
    const plotData = {slot, crop:sd.crop, planted:Date.now()};
    if (sd.isMutant) { plotData.isMutant = true; plotData.successRate = sd.successRate; }
    CUR.farm = [...(CUR.farm||[]), plotData];
    DB.saveStudent(CUR);
    if (sd.isMutant) toast(`⚡ ${sd.name} 심었어요! 성공 확률 ${Math.round(sd.successRate*100)}% · ${sd.growHours}시간 후 판정`);
    else toast(`🌱 ${sd.name} 심었어요! ${sd.growHours}시간 후 수확`);
    renderFarmModal(); renderMain(); renderMobile();
    if (_ifMode) _drawDeco(); // 마당 농장 즉시 갱신
  }
}

function getFarmLayout(lv) {
  if (lv>=25) return {cols:6, rows:5};
  if (lv>=20) return {cols:5, rows:5};
  if (lv>=15) return {cols:5, rows:4};
  if (lv>=10) return {cols:4, rows:4};
  if (lv>=5)  return {cols:4, rows:3};
  if (lv>=3)  return {cols:3, rows:3};
  return {cols:2, rows:2};
}

function renderFarmModal() {
  const {cols, rows} = getFarmLayout(CUR.level||1);
  const farmSize = cols * rows;
  const farm = CUR.farm||[];
  const allSeedIds = new Set([...GAME_DATA.seeds, ...GAME_DATA.mutantSeeds].map(s=>s.id));
  const seeds = (CUR.inventory||[]).filter(i => allSeedIds.has(i.id) && i.qty>0);
  document.getElementById('farm-seed-select').innerHTML = seeds.length > 0
    ? seeds.map(inv => {
        const sd = Utils.getSeedById(inv.id);
        const mutTag = sd.isMutant ? '<span style="font-size:.55rem;color:#FFA500;font-weight:700"> ⚡돌연변이</span>' : '';
        return `<div class="seed-chip ${SEL_SEED===inv.id?'sel':''}" onclick="SEL_SEED='${inv.id}';renderFarmModal()">
          ${sd.icon} ${sd.name}${mutTag} x${inv.qty}</div>`;
      }).join('')
    : `<span style="font-size:.75rem;color:var(--txt3)">씨앗 없음 (상점에서 구매)</span>`;

  let gridHtml = '';
  for (let i = 0; i < farmSize; i++) {
    const plot = farm.find(f => f.slot === i);
    if (plot) {
      const sd = Utils.getSeedByCrop(plot.crop);
      const ready = sd && Utils.cropReady(plot.planted, sd.growHours);
      const pct = sd ? Utils.cropProgress(plot.planted, sd.growHours) : 100;
      const elapsed = Date.now() - plot.planted;
      const withered = ready && sd && elapsed > sd.growHours * 3600000 * 3;
      const mutantClass = plot.isMutant ? ' mutant' : '';
      gridHtml += `<div class="fm-cell${mutantClass} ${withered?'withered':ready?'ready':'growing'}" onclick="farmCellClick(${i})">
        ${withered ? '🍂' : ready ? sd.cropIcon : (plot.isMutant ? '⚡' : '🌱')}
        <div class="fm-prog"><div class="fm-prog-fill" style="width:${pct}%${plot.isMutant?';background:rgba(255,165,0,.8)':''}"></div></div>
      </div>`;
    } else {
      gridHtml += `<div class="fm-cell empty" onclick="farmCellClick(${i})">+</div>`;
    }
  }
  document.getElementById('farm-grid-wrap').innerHTML =
    `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:3px">${gridHtml}</div>`;
  document.getElementById('farm-info').textContent =
    `밭 크기: ${cols}×${rows} (${farmSize}칸) | 심은 작물: ${farm.length} | 수확 가능: ${farm.filter(p=>{const sd=Utils.getSeedByCrop(p.crop);return sd&&Utils.cropReady(p.planted,sd.growHours)}).length}`;
}

// ══ 집 ══
function houseTab(tab, el) {
  document.querySelectorAll('#m-house .mtab').forEach(t => t.classList.remove('on'));
  el.classList.add('on');
  // 탭 전환 시 스크롤 맨 위로
  document.querySelector('#m-house .house-tab-body')?.scrollTo({ top: 0, behavior: 'instant' });
  document.getElementById('house-tab-stats').style.display   = tab==='stats'   ? '' : 'none';
  document.getElementById('house-tab-weekly').style.display  = tab==='weekly'  ? '' : 'none';
  document.getElementById('house-tab-book').style.display    = tab==='book'    ? '' : 'none';
  document.getElementById('house-tab-deco').style.display    = tab==='deco'    ? '' : 'none';
  document.getElementById('house-tab-artwork').style.display = tab==='artwork' ? '' : 'none';
  document.getElementById('house-tab-memory').style.display  = tab==='memory'  ? '' : 'none';
  document.getElementById('house-tab-emotion').style.display = tab==='emotion' ? '' : 'none';
  document.getElementById('house-tab-ach').style.display     = tab==='ach'     ? '' : 'none';
  document.getElementById('house-tab-vocab').style.display   = tab==='vocab'   ? '' : 'none';
  if (tab==='weekly')  renderWeeklyTab();
  if (tab==='book')    { renderBookRecords(); initBookForm(); }
  if (tab==='stats')   renderDqPortfolio();
  if (tab==='artwork') { fillArtworkSubjectSelect(); renderArtworks(); }
  if (tab==='emotion') renderEmotionHistory();
  if (tab==='memory')  renderMyMemories();
  if (tab==='ach')     renderHouseAchievements();
  if (tab==='vocab')   {
    // 다른 탭에서 vocab으로 올 때 암기 모드 초기화
    window._vocabMemMode  = 'normal';
    window._vocabRevealed = new Set();
    window._vocabShuffled = null;
    renderVocabTab();
  }
  if (tab==='deco') { /* 버튼으로 직접 열기 */ }
}

// 포트폴리오 열고 특정 탭 바로 활성화
function openHouseTab(tab) {
  openModal('m-house');
  renderHouse();
  // 탭 버튼 찾아서 활성화
  const btn = [...document.querySelectorAll('#m-house .mtab')].find(b =>
    b.getAttribute('onclick') && b.getAttribute('onclick').includes(`'${tab}'`)
  );
  if (btn) houseTab(tab, btn);
}

function renderHouse() {
  const s = CUR;

  document.getElementById('house-grid').innerHTML = `
    <div class="house-stat">
      <div class="hs-label">📚 독서</div>
      <div class="hs-value" style="color:var(--sky)">${s.bookCount||0}권</div>
      <div class="hs-sub">읽은 책 수</div>
    </div>
    <div class="house-stat">
      <div class="hs-label">🏆 칭호</div>
      <div class="hs-value" style="color:var(--gold);font-size:.95rem">${s.title||'-'}</div>
      <div class="hs-sub">보유 ${(s.titles||[]).length}개</div>
    </div>
    <div class="house-stat">
      <div class="hs-label">📋 퀘스트</div>
      <div class="hs-value" style="color:var(--emerald)">${s.totalQuests||0}회</div>
      <div class="hs-sub">누적 완료</div>
    </div>
    <div class="house-stat">
      <div class="hs-label">⚔️ 몬스터</div>
      <div class="hs-value" style="color:var(--red)">${(s.monsterLog||[]).length}마리</div>
      <div class="hs-sub">/ ${getActiveMonsters().length}마리 처치</div>
    </div>`;

  // ── 몬스터 도감 (zone별 진행도) ─────────────────────────
  const dex = s.monsterLog || [];
  const allMons = getActiveMonsters();
  const zones = [
    { key:'beginner',     label:'🌿 초급', color:'#6fd49d', target:30 },
    { key:'intermediate', label:'🔥 중급', color:'#FF8A80', target:50 },
    { key:'advanced',     label:'⚡ 고급', color:'#c39bd3', target:20 },
  ];

  // zone별 처치 수 계산
  const zoneCount = {};
  zones.forEach(z => {
    const zoneMons = allMons.filter(m => m.zone === z.key);
    zoneCount[z.key] = {
      total: zoneMons.length || z.target,
      killed: zoneMons.filter(m => dex.includes(m.name)).length,
      mons: zoneMons,
    };
  });

  const dexRewards = (DB.getSettings().dexRewards) || {};
  const zoneProgressHtml = zones.map(z => {
    const { total, killed } = zoneCount[z.key];
    const pct = total > 0 ? Math.round(killed / total * 100) : 0;
    const claimed = s[`dexZoneClaimed_${z.key}`];
    const rewardTxt = dexRewards[z.key]?.gold > 0
      ? `🏆 ${dexRewards[z.key].gold}G${dexRewards[z.key].title ? ' · ' + dexRewards[z.key].title : ''}`
      : '';
    return `<div style="margin-bottom:.6rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.25rem">
        <span style="font-size:.78rem;font-weight:700;color:${z.color}">${z.label}</span>
        <span style="font-size:.72rem;color:var(--txt3)">${killed} / ${total}
          ${claimed ? '<span style="color:var(--emerald);margin-left:.3rem">✅</span>' : ''}
        </span>
      </div>
      <div style="background:rgba(255,255,255,.08);border-radius:5px;height:7px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${z.color};border-radius:5px;transition:width .4s"></div>
      </div>
      ${rewardTxt && !claimed ? `<div style="font-size:.65rem;color:var(--txt3);margin-top:.15rem">달성 보상: ${rewardTxt}</div>` : ''}
    </div>`;
  }).join('');

  // 처치 칩 (zone별 접이식)
  const chipsByZone = zones.map(z => {
    const killed = zoneCount[z.key].mons.filter(m => dex.includes(m.name));
    if (!killed.length) return '';
    return `<div style="margin-bottom:.5rem">
      <div style="font-size:.68rem;color:${z.color};font-weight:600;margin-bottom:.25rem">${z.label}</div>
      <div style="display:flex;flex-wrap:wrap;gap:.25rem">
        ${killed.map(m => `<span class="dex-chip">${m.icon} ${m.name}</span>`).join('')}
      </div>
    </div>`;
  }).join('');

  document.getElementById('monster-dex').innerHTML = `
    <div style="font-size:.75rem;font-weight:700;color:var(--txt1);margin-bottom:.6rem">⚔️ 몬스터 도감</div>
    ${zoneProgressHtml}
    ${dex.length > 0
      ? `<div style="margin-top:.6rem">${chipsByZone}</div>`
      : '<div style="font-size:.75rem;color:var(--txt3);padding:.5rem 0">아직 처치한 몬스터가 없어요</div>'}`;

  houseTab('stats', document.querySelector('#m-house .mtab'));
}

// ══ 인테리어 (장식 배치) ══
// ══ 집 인테리어 (탑뷰 SVG) ══
// ── 바닥 타일 시스템 ──
const FLOOR_TILES = {
  grass:      { bg:'#4a8c2a', alt:'#3f7a24', border:'rgba(255,255,255,.06)' },
  dirt:       { bg:'#8B6340', alt:'#7a5635', border:'rgba(0,0,0,.1)' },
  stone:      { bg:'#7a7a8a', alt:'#6e6e7c', border:'rgba(0,0,0,.15)' },
  sand:       { bg:'#c8a855', alt:'#b89545', border:'rgba(255,255,255,.1)' },
  wood:       { bg:'#9B6B3A', alt:'#8a5c2e', border:'rgba(0,0,0,.12)' },
  // ── 새 타일 ──
  water:      { bg:'#2a7ab8', alt:'#1e6aa0', border:'rgba(255,255,255,.1)' },
  brick:      { bg:'#9a5840', alt:'#8a4e38', border:'rgba(0,0,0,.15)' },
  gravel:     { bg:'#8a8878', alt:'#7c7a6c', border:'rgba(0,0,0,.12)' },
  dark_earth: { bg:'#5a3820', alt:'#4a2e18', border:'rgba(0,0,0,.2)' },
  flower:     { bg:'#4a8c2a', alt:'#3f7a24', border:'rgba(255,255,255,.06)' },
  stone_floor:{ bg:'#9a9898', alt:'#888686', border:'rgba(0,0,0,.15)' },
  // ── 2차 신규 타일 ──
  deck:       { bg:'#a07838', alt:'#8c6828', border:'rgba(0,0,0,.12)' },
  dry_earth:  { bg:'#c0a060', alt:'#b09050', border:'rgba(0,0,0,.1)' },
  gravel_yard:{ bg:'#989080', alt:'#888070', border:'rgba(0,0,0,.12)' },
};
const FLOOR_TILE_COLORS = {
  grass:      { bg:'rgba(74,140,42,.2)',  color:'#a8e06a', border:'rgba(74,140,42,.5)' },
  dirt:       { bg:'rgba(139,99,64,.3)',  color:'#d4a574', border:'rgba(139,99,64,.5)' },
  stone:      { bg:'rgba(120,120,140,.25)',color:'#c0c0d0',border:'rgba(120,120,140,.5)' },
  sand:       { bg:'rgba(200,168,85,.25)',color:'#f0d080', border:'rgba(200,168,85,.5)' },
  wood:       { bg:'rgba(155,107,58,.3)', color:'#d4a870', border:'rgba(155,107,58,.5)' },
  water:      { bg:'rgba(42,122,184,.3)', color:'#7ec8e3', border:'rgba(42,122,184,.6)' },
  brick:      { bg:'rgba(154,88,64,.3)',  color:'#d4987a', border:'rgba(154,88,64,.6)' },
  gravel:     { bg:'rgba(138,136,120,.3)',color:'#c8c6b0', border:'rgba(138,136,120,.5)' },
  dark_earth: { bg:'rgba(90,56,32,.4)',   color:'#a07848', border:'rgba(90,56,32,.6)' },
  flower:     { bg:'rgba(74,140,42,.2)',  color:'#f0a8d0', border:'rgba(200,100,180,.5)' },
  stone_floor:{ bg:'rgba(154,152,152,.3)',color:'#d0cece', border:'rgba(154,152,152,.5)' },
  deck:       { bg:'rgba(160,120,56,.3)', color:'#d4a870', border:'rgba(160,120,56,.5)' },
  dry_earth:  { bg:'rgba(192,160,96,.3)', color:'#e8d0a0', border:'rgba(192,160,96,.5)' },
  gravel_yard:{ bg:'rgba(152,144,128,.3)',color:'#ccc8b8', border:'rgba(152,144,128,.5)' },
};
let DECO_MODE = 'deco';   // 'deco' | 'floor'
let CUR_FLOOR_TILE = 'grass';

function setDecoMode(mode, btn) {
  DECO_MODE = mode;
  document.querySelectorAll('.deco-mode-btn').forEach(b => {
    b.style.background = 'rgba(255,255,255,.06)';
    b.style.color = 'var(--txt2)';
    b.style.borderColor = 'rgba(255,255,255,.1)';
  });
  if (btn) {
    btn.style.background = mode==='deco'?'rgba(255,215,0,.12)':'rgba(93,173,226,.12)';
    btn.style.color = mode==='deco'?'var(--gold)':'var(--sky)';
    btn.style.borderColor = mode==='deco'?'rgba(255,215,0,.4)':'rgba(93,173,226,.4)';
  }
  const floorRow = document.getElementById('floor-tile-row');
  const hint = document.getElementById('deco-mode-hint');
  if (floorRow) floorRow.style.display = mode==='floor' ? 'flex' : 'none';
  if (hint) hint.style.display = mode==='floor' ? 'none' : '';
  _drawDeco();
}

function setCurFloor(type, btn) {
  CUR_FLOOR_TILE = type;
  document.querySelectorAll('.floor-tile-btn').forEach(b => {
    b.style.background = 'rgba(255,255,255,.06)';
    b.style.color = 'var(--txt2)';
    b.style.borderColor = 'rgba(255,255,255,.1)';
  });
  if (btn) {
    const fc = FLOOR_TILE_COLORS[type]||{};
    btn.style.background = fc.bg||'rgba(255,255,255,.1)';
    btn.style.color = fc.color||'var(--gold)';
    btn.style.borderColor = fc.border||'rgba(255,255,255,.3)';
  }
}

// 셀별 바닥 타일 가져오기
function getCellFloor(r, c) {
  const key = r+'_'+c;
  return (CUR.yardFloor||{})[key] || 'grass';
}

// 장식 크기 가져오기 (없으면 1x1)
function getDecoSize(decoId) {
  const d = GAME_DATA.decorations.find(x=>x.id===decoId);
  return d?.size || {w:1,h:1};
}

// 멀티셀 장식 충돌 체크
function canPlaceDeco(r, c, w, h, area, excludeId) {
  const placed = (CUR.houseDecorations||[]).filter(p=>p.area===area && p.id!==excludeId);
  for (let dr=0; dr<h; dr++) for (let dc=0; dc<w; dc++) {
    const tr=r+dr, tc=c+dc;
    if (area==='yard') {
      if (tr>=DY.rows || tc>=DY.cols) return false;
      if (_isHC(tr,tc)) return false;
      if (_isFarmCell(tr,tc)) return false; // 농장 존에는 장식 배치 불가
    } else {
      if (tr>=DI.rows || tc>=DI.cols) return false;
    }
    // 다른 장식과 겹침 체크
    for (const p of placed) {
      const ps = getDecoSize(p.id);
      if (tr>=p.row && tr<p.row+ps.h && tc>=p.col && tc<p.col+ps.w) return false;
    }
  }
  return true;
}

let SEL_DECO = null;
let DECO_SCENE = 'yard'; // 'yard' | 'indoor'
let _dCv = null, _dCtx = null, _dC = 28, _dW = 0, _dH = 0;
let _ifMode = false; // 전체화면 인테리어 모드 여부

// ── 그리드 상수 ──
// 전체화면 모드: 셀 24px 기준으로 화면 크기에서 역산
// 일반 모드(포트폴리오 내): 기존 cols/rows 유지
const DY_NORMAL  = {cols:20, rows:14};  // 마당 일반 모드
const DY_FULL    = {cols:50, rows:28};  // 마당 전체화면 모드
const DI_NORMAL  = {cols:12, rows:8};   // 집 안 일반 모드
const DI_FULL    = {cols:50, rows:28};  // 집 안 전체화면 모드
const DH = {cols:6, rows:3};            // 집 건물 차지 영역 (우상단)

// 현재 활성 그리드 (모드에 따라 전환)
let DY = {...DY_NORMAL};
let DI = {...DI_NORMAL};

function _isHC(r,c){ return r < DH.rows && c >= (DY.cols - DH.cols); }

// ── 전체화면 인테리어 모드 ──────────────────────────────
function openInteriorFullscreen() {
  _ifMode = true;
  DY = {...DY_FULL};
  DI = {...DI_FULL};
  const fs = document.getElementById('interior-fullscreen');
  fs.style.display = 'flex';
  _dCv = null; _dCtx = null;
  _ifActiveContainer = 'if-topview';
  ifSyncScene();
  ifSyncModeBtn();
  // 레이아웃 완료 후 렌더
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      renderHouseDeco();
    });
  });
}

function closeInteriorFullscreen() {
  _ifMode = false;
  DY = {...DY_NORMAL};
  DI = {...DI_NORMAL};
  document.getElementById('interior-fullscreen').style.display = 'none';
  _dCv = null; _dCtx = null;
  _ifActiveContainer = 'house-topview';
  renderHouseDeco();
}

let _ifActiveContainer = 'house-topview'; // 현재 캔버스 컨테이너

function ifSyncScene() {
  const isYard = DECO_SCENE === 'yard';
  const sn = document.getElementById('if-scene-name');
  const sb = document.getElementById('if-scene-btn');
  const il = document.getElementById('if-inv-label');
  if (sn) sn.textContent = isYard ? '🌿 마당' : '🏠 집 안';
  if (sb) sb.textContent = isYard ? '🏠 집 안으로 →' : '🌿 마당으로 ←';
  if (il) il.textContent = isYard ? '🎒 보유 장식품 (마당)' : '🎒 보유 장식품 (집 안)';
}

function ifSyncModeBtn() {
  const isFloor = DECO_MODE === 'floor';
  const fr = document.getElementById('if-floor-row');
  if (fr) fr.style.display = isFloor ? 'flex' : 'none';
  ['if-mode-deco','if-mode-floor'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const active = (id === 'if-mode-deco' && !isFloor) || (id === 'if-mode-floor' && isFloor);
    btn.style.background = active ? 'rgba(255,215,0,.12)' : 'rgba(255,255,255,.06)';
    btn.style.color = active ? 'var(--gold)' : 'var(--txt2)';
    btn.style.borderColor = active ? 'rgba(255,215,0,.4)' : 'rgba(255,255,255,.12)';
  });
}

function ifSyncInv() {
  const el = document.getElementById('if-deco-inv');
  const srcEl = document.getElementById('house-deco-inv');
  if (el && srcEl) el.innerHTML = srcEl.innerHTML;
  // 클릭 이벤트는 SEL_DECO 변수 공유로 동작
}

// ── Canvas 헬퍼 ──
function _dc(x,y,r){_dCtx.beginPath();_dCtx.arc(x,y,r,0,Math.PI*2);}
function _drr(x,y,w,h,r){_dCtx.beginPath();_dCtx.roundRect(x,y,w,h,r);}

// ── 타일 텍스처 렌더 (바닥 색칠 후 호출) ──────────────────────
// 위치 기반 결정론적 난수 (같은 타일은 항상 같은 패턴)
function _tRng(r,c,i){ return ((r*1009+c*1013+i*997)%997)/997; }

function _drawTileTexture(type, c, r, C) {
  const px = c*C, py = r*C;
  const ctx = _dCtx;

  switch(type) {
    case 'wood': {
      // 나무결 가로줄
      ctx.strokeStyle='rgba(0,0,0,.12)'; ctx.lineWidth=Math.max(.5,C*.04);
      [.33,.66].forEach(dy=>{
        ctx.beginPath(); ctx.moveTo(px,py+C*dy); ctx.lineTo(px+C,py+C*dy); ctx.stroke();
      });
      // 나뭇결 약한 세로 변형
      ctx.strokeStyle='rgba(0,0,0,.05)'; ctx.lineWidth=Math.max(.5,C*.03);
      ctx.beginPath();
      ctx.moveTo(px+C*(_tRng(r,c,0)*.4+.1), py);
      ctx.lineTo(px+C*(_tRng(r,c,1)*.4+.15), py+C);
      ctx.stroke();
      break;
    }
    case 'water': {
      // 잔물결 — 위치마다 다른 각도/강도로 자연스럽게
      const a0 = _tRng(r,c,0); // 0~1
      const a1 = _tRng(r,c,1);
      const a2 = _tRng(r,c,2);
      // 물결 1 (짧고 약한)
      if(a0>.3){
        ctx.strokeStyle=`rgba(255,255,255,${.08+a0*.1})`; ctx.lineWidth=Math.max(.5,C*.03);
        const y1=py+C*(a0*.6+.1);
        ctx.beginPath(); ctx.moveTo(px+C*(a1*.3), y1);
        ctx.quadraticCurveTo(px+C*(a1*.3+.2), y1-C*.05, px+C*(a1*.3+.38+a2*.2), y1);
        ctx.stroke();
      }
      // 물결 2
      if(a1>.25){
        ctx.strokeStyle=`rgba(255,255,255,${.07+a1*.09})`; ctx.lineWidth=Math.max(.5,C*.025);
        const y2=py+C*(a1*.5+.35);
        ctx.beginPath(); ctx.moveTo(px+C*(a2*.4+.05), y2);
        ctx.quadraticCurveTo(px+C*(a2*.4+.25), y2+C*.04, px+C*(a2*.4+.45+a0*.15), y2);
        ctx.stroke();
      }
      // 매우 약한 반짝임 (점 1개)
      if(a2>.5){
        ctx.fillStyle=`rgba(255,255,255,${.12+a2*.08})`;
        _dc(px+C*(_tRng(r,c,3)*.7+.1), py+C*(_tRng(r,c,4)*.6+.1), C*.03); ctx.fill();
      }
      // 약한 어두운 깊이감 (가끔)
      if(_tRng(r,c,5)>.6){
        ctx.fillStyle='rgba(0,0,0,.08)';
        ctx.beginPath(); ctx.ellipse(px+C*(_tRng(r,c,6)*.6+.2), py+C*(_tRng(r,c,7)*.6+.1), C*.15, C*.08, _tRng(r,c,8)*Math.PI, 0, Math.PI*2); ctx.fill();
      }
      break;
    }
    case 'brick': {
      // 벽돌 바닥 — 채도 낮춤, 줄눈 덜 진하게, 벽돌 색 미세 변화
      const isAlt = (r+c)%2===0;
      const toneMod = _tRng(r,c,9)*.06-.03; // 칸마다 약간씩 다른 톤
      // 벽돌 면 색 (기본색보다 약간 밝게)
      ctx.fillStyle=`rgba(255,255,255,${.04+toneMod})`;
      ctx.fillRect(px, py, C, C);
      // 줄눈 (가로)
      ctx.strokeStyle='rgba(0,0,0,.18)'; ctx.lineWidth=Math.max(.8,C*.05);
      ctx.beginPath(); ctx.moveTo(px, py+C*.5); ctx.lineTo(px+C, py+C*.5); ctx.stroke();
      // 줄눈 (세로, 오프셋 패턴)
      ctx.lineWidth=Math.max(.6,C*.04);
      const vo = isAlt ? C*.5 : 0;
      if(vo>0){ ctx.beginPath(); ctx.moveTo(px+vo,py); ctx.lineTo(px+vo,py+C*.5); ctx.stroke(); }
      const vo2 = isAlt ? 0 : C*.5;
      if(vo2>0){ ctx.beginPath(); ctx.moveTo(px+vo2,py+C*.5); ctx.lineTo(px+vo2,py+C); ctx.stroke(); }
      // 벽돌 면 미세 그림자 (좌상단)
      ctx.fillStyle='rgba(0,0,0,.06)';
      ctx.fillRect(px+(vo>0?vo:0)+1, py+1, C*.48-2, C*.47-2);
      // 두 번째 벽돌 미세 밝기 차이
      ctx.fillStyle=`rgba(255,255,255,${.03+_tRng(r,c,10)*.04})`;
      ctx.fillRect(px+(vo2>0?vo2:0)+1, py+C*.52, C*.48-2, C*.46-2);
      break;
    }
    case 'gravel': {
      // 작은 자갈들 (결정론적 위치)
      ctx.fillStyle='rgba(0,0,0,.18)';
      for(let i=0;i<6;i++){
        const gx=px+_tRng(r,c,i)*C, gy=py+_tRng(r,c,i+6)*C;
        const gr=C*(.04+_tRng(r,c,i+12)*.04);
        ctx.beginPath(); ctx.ellipse(gx,gy,gr,gr*.65,_tRng(r,c,i+18)*Math.PI,0,Math.PI*2); ctx.fill();
      }
      ctx.fillStyle='rgba(255,255,255,.1)';
      for(let i=0;i<3;i++){
        const gx=px+_tRng(r,c,i+20)*C*.8+C*.1, gy=py+_tRng(r,c,i+26)*C*.8+C*.1;
        ctx.beginPath(); ctx.ellipse(gx,gy,C*.025,C*.02,0,0,Math.PI*2); ctx.fill();
      }
      break;
    }
    case 'dark_earth': {
      // 어두운 흙 — 얼룩, 눌린 질감, 미세 명암 변화
      // 기본 얼룩 (크고 불규칙)
      ctx.fillStyle='rgba(0,0,0,.14)';
      for(let i=0;i<3;i++){
        const ex=px+_tRng(r,c,i)*C*.9+C*.05, ey=py+_tRng(r,c,i+3)*C*.9+C*.05;
        const ew=C*(.15+_tRng(r,c,i+6)*.12), eh=C*(.07+_tRng(r,c,i+9)*.05);
        ctx.beginPath(); ctx.ellipse(ex,ey,ew,eh,_tRng(r,c,i+12)*Math.PI,0,Math.PI*2); ctx.fill();
      }
      // 밝은 얼룩 (돌/모래 입자)
      ctx.fillStyle='rgba(255,255,255,.07)';
      for(let i=0;i<4;i++){
        const ex=px+_tRng(r,c,i+15)*C, ey=py+_tRng(r,c,i+19)*C;
        ctx.beginPath(); ctx.ellipse(ex,ey,C*.04,C*.025,_tRng(r,c,i+23)*Math.PI,0,Math.PI*2); ctx.fill();
      }
      // 가는 균열/줄 (흙 갈라짐)
      if(_tRng(r,c,27)>.55){
        ctx.strokeStyle='rgba(0,0,0,.16)'; ctx.lineWidth=Math.max(.5,C*.03);
        const lx1=px+_tRng(r,c,28)*C, ly1=py+_tRng(r,c,29)*C;
        ctx.beginPath(); ctx.moveTo(lx1,ly1);
        ctx.lineTo(lx1+C*(_tRng(r,c,30)*.3-.15), ly1+C*(_tRng(r,c,31)*.3+.1));
        ctx.stroke();
      }
      break;
    }
    case 'flower': {
      // 잔디 + 작은 꽃점 (은은하게)
      const colors=['rgba(255,160,200,.5)','rgba(255,230,100,.45)','rgba(200,160,255,.4)'];
      for(let i=0;i<4;i++){
        const fx=px+_tRng(r,c,i)*C, fy=py+_tRng(r,c,i+4)*C;
        ctx.fillStyle=colors[Math.floor(_tRng(r,c,i+8)*3)];
        _dc(fx,fy,C*.045); ctx.fill();
      }
      break;
    }
    case 'stone_floor': {
      ctx.strokeStyle='rgba(0,0,0,.22)'; ctx.lineWidth=Math.max(.8,C*.055);
      const sx=_tRng(r,c,0)*.3+.25, sy=_tRng(r,c,1)*.3+.25;
      ctx.beginPath(); ctx.moveTo(px+C*sx, py); ctx.lineTo(px+C*(sx+.2), py+C*.5); ctx.lineTo(px+C, py+C*(sy+.2)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px, py+C*sy); ctx.lineTo(px+C*(sx+.2), py+C*.5); ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,.07)';
      ctx.beginPath(); ctx.ellipse(px+C*.25,py+C*.25,C*.18,C*.12,-.3,0,Math.PI*2); ctx.fill();
      break;
    }
    case 'deck': {
      // 목재 데크 — 가로 나무판자 결
      const dOff = _tRng(r,c,0)*.5; // 판자 오프셋
      ctx.strokeStyle='rgba(0,0,0,.14)'; ctx.lineWidth=Math.max(.8,C*.05);
      // 가로 판자 경계선 (2~3줄)
      [.33,.66].forEach(dy=>{
        ctx.beginPath(); ctx.moveTo(px,py+C*dy); ctx.lineTo(px+C,py+C*dy); ctx.stroke();
      });
      // 나뭇결 (세로 방향 약한 줄)
      ctx.strokeStyle='rgba(0,0,0,.07)'; ctx.lineWidth=Math.max(.5,C*.03);
      for(let i=0;i<3;i++){
        const gx=px+C*(_tRng(r,c,i+1)*.8+.05);
        ctx.beginPath(); ctx.moveTo(gx,py); ctx.lineTo(gx+C*(_tRng(r,c,i+4)*.1-.05),py+C*.33); ctx.stroke();
      }
      // 밝은 면 (판자 상단)
      ctx.fillStyle='rgba(255,255,255,.06)';
      [0,.33,.66].forEach(dy=>{ ctx.fillRect(px,py+C*dy,C,C*.08); });
      break;
    }
    case 'dry_earth': {
      // 마른 흙 — 균열선 + 얼룩
      ctx.strokeStyle='rgba(0,0,0,.18)'; ctx.lineWidth=Math.max(.5,C*.04);
      // 균열 패턴
      const cx1=px+_tRng(r,c,0)*C*.6+C*.2, cy1=py+_tRng(r,c,1)*C*.6+C*.2;
      ctx.beginPath(); ctx.moveTo(cx1,cy1);
      ctx.lineTo(cx1+C*(_tRng(r,c,2)*.3-.15), cy1-C*(_tRng(r,c,3)*.2+.1)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx1,cy1);
      ctx.lineTo(cx1+C*(_tRng(r,c,4)*.3+.05), cy1+C*(_tRng(r,c,5)*.2+.08)); ctx.stroke();
      if(_tRng(r,c,6)>.5){
        ctx.beginPath(); ctx.moveTo(cx1,cy1);
        ctx.lineTo(cx1-C*(_tRng(r,c,7)*.25+.05), cy1+C*(_tRng(r,c,8)*.15+.05)); ctx.stroke();
      }
      // 얼룩 (더 밝거나 어두운 부분)
      ctx.fillStyle='rgba(0,0,0,.1)';
      ctx.beginPath(); ctx.ellipse(px+_tRng(r,c,9)*C,py+_tRng(r,c,10)*C,C*.12,C*.08,_tRng(r,c,11)*Math.PI,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.08)';
      ctx.beginPath(); ctx.ellipse(px+_tRng(r,c,12)*C*.8+C*.1,py+_tRng(r,c,13)*C*.8+C*.1,C*.08,C*.05,0,0,Math.PI*2); ctx.fill();
      break;
    }
    case 'gravel_yard': {
      // 자갈마당 — 좀 더 크고 불규칙한 자갈
      ctx.fillStyle='rgba(0,0,0,.16)';
      for(let i=0;i<5;i++){
        const gx=px+_tRng(r,c,i)*C, gy=py+_tRng(r,c,i+5)*C;
        const gr=C*(.06+_tRng(r,c,i+10)*.06);
        ctx.beginPath(); ctx.ellipse(gx,gy,gr,gr*.7,_tRng(r,c,i+15)*Math.PI,0,Math.PI*2); ctx.fill();
      }
      ctx.fillStyle='rgba(255,255,255,.12)';
      for(let i=0;i<3;i++){
        const gx=px+_tRng(r,c,i+18)*C*.8+C*.1, gy=py+_tRng(r,c,i+21)*C*.8+C*.1;
        ctx.beginPath(); ctx.ellipse(gx,gy,C*.04,C*.03,_tRng(r,c,i+24)*Math.PI,0,Math.PI*2); ctx.fill();
      }
      // 그늘 (자갈 사이 틈)
      ctx.fillStyle='rgba(0,0,0,.08)';
      for(let i=0;i<2;i++){
        const gx=px+_tRng(r,c,i+26)*C, gy=py+_tRng(r,c,i+28)*C;
        ctx.beginPath(); ctx.ellipse(gx,gy,C*.08,C*.04,_tRng(r,c,i+30)*Math.PI,0,Math.PI*2); ctx.fill();
      }
      break;
    }
  }
}

// ── 마당 장식 드로우 함수 ──
function _dRose(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.72,s*.14,0,0,Math.PI*2);_dCtx.fill();
  // 녹지 바닥 (칸 전체 가득)
  _dCtx.fillStyle='#2a6a14';_drr(cx-s*.82,cy+s*.1,s*1.64,s*.68,s*.22);_dCtx.fill();
  _dCtx.fillStyle='#368a1c';_drr(cx-s*.78,cy+s*.06,s*1.56,s*.56,s*.2);_dCtx.fill();
  // 꽃들 (5개, 크고 넓게)
  [[-s*.44,-s*.38,'#e8314a'],[-s*.14,-s*.52,'#c8203a'],[s*.18,-s*.44,'#e0284a'],[s*.46,-s*.32,'#ff4466'],[s*.02,-s*.24,'#ff5566']].forEach(([dx,dy,c])=>{
    _dCtx.fillStyle=c; _dc(cx+dx,cy+dy,s*.34); _dCtx.fill();
    _dCtx.fillStyle='#ff8898'; _dc(cx+dx,cy+dy,s*.16); _dCtx.fill();
  });
}
function _dTulip(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.68,s*.13,0,0,Math.PI*2);_dCtx.fill();
  // 흙 받침
  _dCtx.fillStyle='#6B4A1E';_drr(cx-s*.72,cy+s*.36,s*1.44,s*.38,s*.12);_dCtx.fill();
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.68,cy+s*.32,s*1.36,s*.28,s*.1);_dCtx.fill();
  // 줄기 3개
  [[-s*.32,s*.08],[0,s*.06],[s*.32,s*.1]].forEach(([dx,bot])=>{
    _dCtx.strokeStyle='#3a8020';_dCtx.lineWidth=s*.1;
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+bot);_dCtx.lineTo(cx+dx,cy-s*.5);_dCtx.stroke();
  });
  // 잎
  _dCtx.strokeStyle='#2a6010';_dCtx.lineWidth=s*.08;
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.32,cy-s*.08);_dCtx.quadraticCurveTo(cx-s*.62,cy-s*.22,cx-s*.66,cy-s*.12);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.32,cy-s*.06);_dCtx.quadraticCurveTo(cx+s*.62,cy-s*.2,cx+s*.66,cy-s*.1);_dCtx.stroke();
  // 꽃봉오리 3개
  [[-s*.32,'#e84090'],[0,'#ff60a8'],[s*.32,'#c82070']].forEach(([dx,c])=>{
    _dCtx.fillStyle=c;
    _dCtx.beginPath();_dCtx.ellipse(cx+dx-s*.1,cy-s*.5,s*.18,s*.32,-.18,0,Math.PI*2);_dCtx.fill();
    _dCtx.beginPath();_dCtx.ellipse(cx+dx+s*.1,cy-s*.47,s*.16,s*.3,.18,0,Math.PI*2);_dCtx.fill();
    _dCtx.fillStyle='#ff80b8';
    _dCtx.beginPath();_dCtx.ellipse(cx+dx,cy-s*.6,s*.12,s*.2,0,0,Math.PI*2);_dCtx.fill();
  });
}
function _dTree(cx,cy,s){
  // 바닥 그림자 (2x2라 넓게)
  _dCtx.fillStyle='rgba(0,0,0,.25)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.68,s*.72,s*.15,0,0,Math.PI*2);_dCtx.fill();
  // 뿌리/기둥 받침
  _dCtx.fillStyle='#5a3a10';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.44,s*.26,s*.1,0,0,Math.PI*2);_dCtx.fill();
  // 기둥 (훨씬 두껍게)
  _dCtx.fillStyle='#6B4A1E';_drr(cx-s*.18,cy-s*.08,s*.36,s*.56,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.1,cy-s*.06,s*.14,s*.52,s*.06);_dCtx.fill();
  // 가지
  _dCtx.strokeStyle='#6B4A1E';_dCtx.lineWidth=s*.08;
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.06);_dCtx.lineTo(cx-s*.38,cy-s*.36);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.14);_dCtx.lineTo(cx+s*.38,cy-s*.42);_dCtx.stroke();
  // 크라운 (3겹, 칸을 꽉 채움)
  _dCtx.fillStyle='#2a7010';_dc(cx,cy-s*.32,s*.72);_dCtx.fill();
  _dCtx.fillStyle='#3a8818';_dc(cx-s*.1,cy-s*.38,s*.62);_dCtx.fill();
  _dCtx.fillStyle='#4a9a22';_dc(cx,cy-s*.48,s*.52);_dCtx.fill();
  _dCtx.fillStyle='#5aaa2a';_dc(cx-s*.08,cy-s*.56,s*.38);_dCtx.fill();
  // 하이라이트
  _dCtx.fillStyle='rgba(255,255,255,.1)';_dc(cx-s*.2,cy-s*.6,s*.14);_dCtx.fill();
}
function _dBench(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.6,s*.88,s*.12,0,0,Math.PI*2);_dCtx.fill();
  // 다리 4개
  [[-s*.6,-s*.22],[-s*.28,-s*.22],[s*.28,-s*.22],[s*.6,-s*.22]].forEach(([dx,baseY])=>{
    _dCtx.fillStyle='#7a5418';_drr(cx+dx-s*.07,cy+baseY,s*.14,s*.56,s*.04);_dCtx.fill();
  });
  // 앉는 판
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.72,cy-s*.14,s*1.44,s*.22,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#A07830';_drr(cx-s*.7,cy-s*.2,s*1.4,s*.16,s*.05);_dCtx.fill();
  // 판 나뭇결
  _dCtx.strokeStyle='#7a5010';_dCtx.lineWidth=s*.025;
  [-.44,-.12,.18].forEach(dx=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx*s,cy-s*.2);_dCtx.lineTo(cx+dx*s,cy-s*.04);_dCtx.stroke();});
  // 등받이 기둥
  [[-s*.58],[s*.58]].forEach(([dx])=>{
    _dCtx.fillStyle='#7a5418';_drr(cx+dx-s*.07,cy-s*.44,s*.14,s*.38,s*.04);_dCtx.fill();
  });
  // 등받이 가로 판 2개
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.68,cy-s*.56,s*1.36,s*.14,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#A07830';_drr(cx-s*.66,cy-s*.62,s*1.32,s*.1,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.68,cy-s*.42,s*1.36,s*.11,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#A07830';_drr(cx-s*.66,cy-s*.48,s*1.32,s*.08,s*.03);_dCtx.fill();
}
function _dFountain(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.28)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.7,s*.82,s*.16,0,0,Math.PI*2);_dCtx.fill();
  // 큰 분지 하단 (두께)
  _dCtx.fillStyle='#7a7868';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.5,s*.82,s*.2,0,0,Math.PI*2);_dCtx.fill();
  // 큰 분지 상단면
  _dCtx.fillStyle='#9B9880';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.36,s*.82,s*.2,0,0,Math.PI*2);_dCtx.fill();
  // 분지 안 물
  _dCtx.fillStyle='rgba(26,106,154,.9)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.3,s*.7,s*.16,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(80,160,220,.6)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.26,s*.56,s*.1,0,0,Math.PI*2);_dCtx.fill();
  // 기둥
  _dCtx.fillStyle='#8a8870';_drr(cx-s*.1,cy-s*.32,s*.2,s*.66,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#aaa890';_drr(cx-s*.06,cy-s*.3,s*.1,s*.62,s*.04);_dCtx.fill();
  // 작은 분지 (중간)
  _dCtx.fillStyle='#7a7868';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.1,s*.42,s*.1,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(26,106,154,.7)';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.14,s*.34,s*.08,0,0,Math.PI*2);_dCtx.fill();
  // 물줄기 (3개, 더 크게)
  _dCtx.strokeStyle='rgba(135,206,235,.95)';_dCtx.lineWidth=s*.1;
  [[-s*.28,-s*.88],[0,-s*.94],[s*.28,-s*.88]].forEach(([ex,ey])=>{
    _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.32);
    _dCtx.quadraticCurveTo(cx+ex*.4,cy-s*.6,cx+ex,cy+ey+s*.94);_dCtx.stroke();
  });
  // 물 튀김
  _dCtx.fillStyle='rgba(135,206,235,.7)';
  [[-s*.3,s*.32],[s*.3,s*.28],[s*.0,s*.18]].forEach(([dx,dy])=>{_dc(cx+dx,cy+dy,s*.05);_dCtx.fill();});
}
function _dLantern(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.25)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.52,s*.11,0,0,Math.PI*2);_dCtx.fill();
  // 바닥 받침
  _dCtx.fillStyle='#4a4a40';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.6,s*.36,s*.1,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#6a6a60';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.54,s*.28,s*.08,0,0,Math.PI*2);_dCtx.fill();
  // 폴
  _dCtx.fillStyle='#5a5a50';_drr(cx-s*.07,cy-s*.4,s*.14,s*1.0,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#7a7a70';_drr(cx-s*.04,cy-s*.38,s*.06,s*.96,s*.03);_dCtx.fill();
  // 등 몸체
  _dCtx.fillStyle='rgba(255,200,50,.85)';_drr(cx-s*.28,cy-s*.76,s*.56,s*.44,s*.08);_dCtx.fill();
  _dCtx.fillStyle='rgba(255,230,120,.5)';_drr(cx-s*.24,cy-s*.72,s*.48,s*.28,s*.06);_dCtx.fill();
  // 등 프레임
  _dCtx.strokeStyle='#5a5a50';_dCtx.lineWidth=s*.06;_dCtx.strokeRect(cx-s*.28,cy-s*.76,s*.56,s*.44);
  // 지붕
  _dCtx.fillStyle='#4a4a40';
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.88);_dCtx.lineTo(cx-s*.34,cy-s*.76);_dCtx.lineTo(cx+s*.34,cy-s*.76);_dCtx.closePath();_dCtx.fill();
  // 빛 반짝임
  _dCtx.fillStyle='rgba(255,240,150,.6)';_dc(cx,cy-s*.54,s*.1);_dCtx.fill();
}
function _dCactus(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.62,s*.13,0,0,Math.PI*2);_dCtx.fill();
  // 흙받침 (화분 느낌)
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.38,cy+s*.4,s*.76,s*.34,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#a07830';_drr(cx-s*.32,cy+s*.36,s*.64,s*.2,s*.06);_dCtx.fill();
  // 왼쪽 팔
  _dCtx.fillStyle='#3a7c1a';_drr(cx-s*.62,cy-s*.3,s*.34,s*.48,s*.16);_dCtx.fill();
  _dCtx.fillStyle='#4a9828';_drr(cx-s*.58,cy-s*.28,s*.16,s*.44,s*.08);_dCtx.fill();
  // 오른쪽 팔
  _dCtx.fillStyle='#3a7c1a';_drr(cx+s*.28,cy-s*.42,s*.34,s*.52,s*.16);_dCtx.fill();
  _dCtx.fillStyle='#4a9828';_drr(cx+s*.32,cy-s*.4,s*.16,s*.48,s*.08);_dCtx.fill();
  // 몸통 (크고 중앙에)
  _dCtx.fillStyle='#3a7c1a';_drr(cx-s*.24,cy-s*.72,s*.48,s*1.14,s*.22);_dCtx.fill();
  _dCtx.fillStyle='#5aac3a';_drr(cx-s*.14,cy-s*.7,s*.14,s*1.1,s*.07);_dCtx.fill();
  // 가시
  _dCtx.strokeStyle='#c8e870';_dCtx.lineWidth=s*.04;
  [[-s*.2,-s*.4],[s*.2,-s*.2],[-s*.2,s*.0],[s*.2,s*.2],[-s*.2,s*.3]].forEach(([dx,dy])=>{
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+dy);_dCtx.lineTo(cx+dx-s*.1*(dx<0?-1:1),cy+dy-s*.12);_dCtx.stroke();
  });
}
function _dStone(cx,cy,s){
  // 돌 바로 아래 짧고 얕은 그림자 (떠 보이지 않게)
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.36,s*.7,s*.08,0,0,Math.PI*2);_dCtx.fill();

  // ── 가운데 큰 돌 (불규칙 다각형) ──
  _dCtx.fillStyle='#666658';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.28,cy+s*.28);   // 좌하
  _dCtx.lineTo(cx-s*.44,cy+s*.08);   // 좌
  _dCtx.lineTo(cx-s*.38,cy-s*.14);   // 좌상
  _dCtx.lineTo(cx-s*.12,cy-s*.28);   // 상좌
  _dCtx.lineTo(cx+s*.18,cy-s*.24);   // 상우
  _dCtx.lineTo(cx+s*.4,cy-s*.06);    // 우상
  _dCtx.lineTo(cx+s*.36,cy+s*.22);   // 우하
  _dCtx.lineTo(cx+s*.06,cy+s*.32);   // 하우
  _dCtx.closePath();_dCtx.fill();
  // 중간 면 (밝음)
  _dCtx.fillStyle='#8a8878';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.38,cy-s*.1);
  _dCtx.lineTo(cx-s*.1,cy-s*.26);
  _dCtx.lineTo(cx+s*.16,cy-s*.22);
  _dCtx.lineTo(cx+s*.34,cy-s*.04);
  _dCtx.lineTo(cx+s*.28,cy+s*.18);
  _dCtx.lineTo(cx-s*.22,cy+s*.24);
  _dCtx.lineTo(cx-s*.4,cy+s*.06);
  _dCtx.closePath();_dCtx.fill();
  // 상단 하이라이트
  _dCtx.fillStyle='#a0a090';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.28,cy-s*.14);
  _dCtx.lineTo(cx-s*.06,cy-s*.24);
  _dCtx.lineTo(cx+s*.14,cy-s*.2);
  _dCtx.lineTo(cx+s*.1,cy-s*.08);
  _dCtx.lineTo(cx-s*.18,cy-s*.06);
  _dCtx.closePath();_dCtx.fill();
  // 하단 어두운 면 (접지감)
  _dCtx.fillStyle='#525040';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.28,cy+s*.28);
  _dCtx.lineTo(cx+s*.06,cy+s*.32);
  _dCtx.lineTo(cx+s*.36,cy+s*.22);
  _dCtx.lineTo(cx+s*.28,cy+s*.3);   // 살짝 낮게
  _dCtx.lineTo(cx+s*.02,cy+s*.4);
  _dCtx.lineTo(cx-s*.32,cy+s*.36);
  _dCtx.closePath();_dCtx.fill();

  // ── 왼쪽 작은 돌 ──
  _dCtx.fillStyle='#5e5e50';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.5,cy+s*.3);_dCtx.lineTo(cx-s*.62,cy+s*.14);_dCtx.lineTo(cx-s*.56,cy-s*.02);
  _dCtx.lineTo(cx-s*.34,cy-s*.04);_dCtx.lineTo(cx-s*.28,cy+s*.2);_dCtx.lineTo(cx-s*.4,cy+s*.34);
  _dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#7e7e70';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.6,cy+s*.12);_dCtx.lineTo(cx-s*.54,cy-s*.0);
  _dCtx.lineTo(cx-s*.34,cy-s*.02);_dCtx.lineTo(cx-s*.3,cy+s*.16);_dCtx.lineTo(cx-s*.48,cy+s*.26);
  _dCtx.closePath();_dCtx.fill();
  // 하단 어둠
  _dCtx.fillStyle='#464438';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.5,cy+s*.3);_dCtx.lineTo(cx-s*.4,cy+s*.34);_dCtx.lineTo(cx-s*.28,cy+s*.26);
  _dCtx.lineTo(cx-s*.34,cy+s*.34);_dCtx.lineTo(cx-s*.52,cy+s*.38);
  _dCtx.closePath();_dCtx.fill();

  // ── 오른쪽 작은 돌 ──
  _dCtx.fillStyle='#606254';
  _dCtx.beginPath();
  _dCtx.moveTo(cx+s*.44,cy+s*.28);_dCtx.lineTo(cx+s*.32,cy+s*.04);_dCtx.lineTo(cx+s*.44,cy-s*.08);
  _dCtx.lineTo(cx+s*.62,cy-s*.02);_dCtx.lineTo(cx+s*.68,cy+s*.18);_dCtx.lineTo(cx+s*.58,cy+s*.32);
  _dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#7e8070';
  _dCtx.beginPath();
  _dCtx.moveTo(cx+s*.34,cy+s*.06);_dCtx.lineTo(cx+s*.44,cy-s*.06);
  _dCtx.lineTo(cx+s*.6,cy-s*.0);_dCtx.lineTo(cx+s*.64,cy+s*.16);_dCtx.lineTo(cx+s*.5,cy+s*.26);
  _dCtx.closePath();_dCtx.fill();
  // 하단 어둠
  _dCtx.fillStyle='#484a3c';
  _dCtx.beginPath();
  _dCtx.moveTo(cx+s*.44,cy+s*.28);_dCtx.lineTo(cx+s*.58,cy+s*.32);_dCtx.lineTo(cx+s*.66,cy+s*.24);
  _dCtx.lineTo(cx+s*.62,cy+s*.34);_dCtx.lineTo(cx+s*.44,cy+s*.36);_dCtx.lineTo(cx+s*.36,cy+s*.3);
  _dCtx.closePath();_dCtx.fill();

  // ── 표면 무늬 (약하게, 자연석 느낌) ──
  _dCtx.strokeStyle='rgba(0,0,0,.12)';_dCtx.lineWidth=s*.025;
  // 균열선 느낌
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.1,cy-s*.18);_dCtx.lineTo(cx+s*.08,cy+s*.04);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.12,cy-s*.1);_dCtx.lineTo(cx+s*.22,cy+s*.08);_dCtx.stroke();
  // 이끼 (작고 약하게)
  _dCtx.fillStyle='rgba(60,100,30,.35)';
  _dc(cx+s*.2,cy+s*.14,s*.045);_dCtx.fill();
  _dc(cx-s*.14,cy+s*.16,s*.04);_dCtx.fill();
}

// ── 집 안 가구 드로우 함수 ──
function _dDesk(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.18)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.6,s*.82,s*.12,0,0,Math.PI*2);_dCtx.fill();
  // 다리 4개
  [[-s*.6,-s*.16],[-s*.28,-s*.16],[s*.28,-s*.16],[s*.6,-s*.16]].forEach(([dx,baseY])=>{
    _dCtx.fillStyle='#7a5010';_drr(cx+dx-s*.08,cy+baseY,s*.16,s*.54,s*.04);_dCtx.fill();
  });
  // 상판 (두껍게)
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.74,cy-s*.38,s*1.48,s*.32,s*.07);_dCtx.fill();
  _dCtx.fillStyle='#A07830';_drr(cx-s*.72,cy-s*.5,s*1.44,s*.2,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#c8a050';_drr(cx-s*.7,cy-s*.52,s*1.4,s*.06,s*.03);_dCtx.fill();
  // 모니터
  _dCtx.fillStyle='rgba(30,50,80,.85)';_drr(cx-s*.22,cy-s*.82,s*.44,s*.36,s*.05);_dCtx.fill();
  _dCtx.fillStyle='rgba(100,180,255,.5)';_drr(cx-s*.18,cy-s*.78,s*.36,s*.26,s*.04);_dCtx.fill();
  // 모니터 받침
  _dCtx.fillStyle='#4a4a40';_drr(cx-s*.06,cy-s*.46,s*.12,s*.06,s*.02);_dCtx.fill();
  // 키보드
  _dCtx.fillStyle='#c8c8b8';_drr(cx+s*.14,cy-s*.46,s*.54,s*.1,s*.04);_dCtx.fill();
  // 책/물건
  _dCtx.fillStyle='#e74c3c';_drr(cx-s*.66,cy-s*.46,s*.2,s*.1,s*.02);_dCtx.fill();
}
function _dSofa(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.18)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.6,s*.9,s*.12,0,0,Math.PI*2);_dCtx.fill();
  // 다리
  _dCtx.fillStyle='#3a2a10';
  [[-s*.7],[s*.7]].forEach(([dx])=>{_drr(cx+dx-s*.07,cy+s*.32,s*.14,s*.22,s*.04);_dCtx.fill();});
  // 등받이
  _dCtx.fillStyle='#5a3a7a';_drr(cx-s*.82,cy-s*.62,s*1.64,s*.56,s*.14);_dCtx.fill();
  _dCtx.fillStyle='#6b4a8e';_drr(cx-s*.78,cy-s*.58,s*1.56,s*.44,s*.12);_dCtx.fill();
  // 팔걸이
  [[-s*.82,-s*.12],[s*.66,-s*.12]].forEach(([dx,dy])=>{
    _dCtx.fillStyle='#5a3a7a';_drr(cx+dx,cy+dy,s*.2,s*.5,s*.1);_dCtx.fill();
    _dCtx.fillStyle='#7a5aaa';_drr(cx+dx+s*.02,cy+dy,s*.14,s*.36,s*.08);_dCtx.fill();
  });
  // 앉는 부분
  _dCtx.fillStyle='#6b4a8e';_drr(cx-s*.78,cy-s*.1,s*1.56,s*.44,s*.1);_dCtx.fill();
  // 쿠션 3개
  [[-s*.44],[s*.0],[s*.44]].forEach(([dx])=>{
    _dCtx.fillStyle='#8060b0';_drr(cx+dx-s*.22,cy-s*.08,s*.44,s*.36,s*.09);_dCtx.fill();
    _dCtx.fillStyle='rgba(255,255,255,.08)';_drr(cx+dx-s*.18,cy-s*.06,s*.36,s*.1,s*.04);_dCtx.fill();
  });
}
function _dClock(cx,cy,s){_dCtx.fillStyle='#D4A850';_dc(cx,cy,s*.48);_dCtx.fill();_dCtx.fillStyle='#FFF8E8';_dc(cx,cy,s*.4);_dCtx.fill();_dCtx.fillStyle='#5a3010';_dc(cx,cy,s*.06);_dCtx.fill();_dCtx.strokeStyle='#3a2008';_dCtx.lineWidth=s*.07;_dCtx.lineCap='round';_dCtx.beginPath();_dCtx.moveTo(cx,cy);_dCtx.lineTo(cx,cy-s*.27);_dCtx.stroke();_dCtx.lineWidth=s*.05;_dCtx.beginPath();_dCtx.moveTo(cx,cy);_dCtx.lineTo(cx+s*.19,cy+s*.12);_dCtx.stroke();}
function _dBookshelf(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.72,s*.12,0,0,Math.PI*2);_dCtx.fill();
  // 책장 외곽 (칸 꽉)
  _dCtx.fillStyle='#7a5010';_drr(cx-s*.72,cy-s*.86,s*1.44,s*1.62,s*.05);_dCtx.fill();
  // 선반 3칸
  [0,1,2].forEach(i=>{
    _dCtx.fillStyle='#A07830';_drr(cx-s*.68,cy-s*.78+i*s*.5,s*1.36,s*.38,s*.03);_dCtx.fill();
    // 책들
    [['#c0392b','#2980b9','#27ae60','#8e44ad','#e67e22'],
     ['#2980b9','#c0392b','#16a085','#d35400','#8e44ad'],
     ['#27ae60','#e67e22','#2980b9','#c0392b','#16a085']][i].forEach((c,ci)=>{
      _dCtx.fillStyle=c;_drr(cx-s*.66+ci*s*.27,cy-s*.78+i*s*.5,s*.23,s*.38,s*.02);_dCtx.fill();
      _dCtx.fillStyle='rgba(255,255,255,.15)';_drr(cx-s*.64+ci*s*.27,cy-s*.76+i*s*.5,s*.1,s*.06,s*.01);_dCtx.fill();
    });
  });
  // 책장 측면 패널
  _dCtx.fillStyle='#6a4010';_drr(cx-s*.72,cy-s*.86,s*.08,s*1.62,s*.02);_dCtx.fill();
  _drr(cx+s*.64,cy-s*.86,s*.08,s*1.62,s*.02);_dCtx.fill();
}
function _dLamp(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.18)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.68,s*.42,s*.09,0,0,Math.PI*2);_dCtx.fill();
  // 받침
  _dCtx.fillStyle='#5a3a10';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.58,s*.32,s*.1,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#7a5a20';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.5,s*.26,s*.08,0,0,Math.PI*2);_dCtx.fill();
  // 기둥 (두껍게)
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.1,cy-s*.16,s*.2,s*.68,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#A07830';_drr(cx-s*.06,cy-s*.14,s*.1,s*.64,s*.04);_dCtx.fill();
  // 빛 (갓 안)
  _dCtx.fillStyle='rgba(255,230,160,.6)';_dCtx.beginPath();
  _dCtx.moveTo(cx-s*.46,cy-s*.52);_dCtx.quadraticCurveTo(cx,cy-s*.14,cx+s*.46,cy-s*.52);_dCtx.closePath();_dCtx.fill();
  // 갓 (크게)
  _dCtx.fillStyle='#F5E0A0';_dCtx.beginPath();
  _dCtx.moveTo(cx-s*.5,cy-s*.58);_dCtx.quadraticCurveTo(cx,cy-s*.16,cx+s*.5,cy-s*.58);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#e8cc80';_dCtx.beginPath();
  _dCtx.moveTo(cx-s*.48,cy-s*.58);_dCtx.lineTo(cx+s*.48,cy-s*.58);_dCtx.stroke();
  // 갓 테두리
  _dCtx.strokeStyle='#c8a040';_dCtx.lineWidth=s*.04;
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.5,cy-s*.58);_dCtx.lineTo(cx+s*.5,cy-s*.58);_dCtx.stroke();
  // 갓 꼭대기
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.08,cy-s*.68,s*.16,s*.12,s*.04);_dCtx.fill();
}
function _dPiano(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.7,s*.8,s*.14,0,0,Math.PI*2);_dCtx.fill();
  // 피아노 다리
  _dCtx.fillStyle='#111';
  [[-s*.62],[s*.62]].forEach(([dx])=>{_drr(cx+dx-s*.08,cy+s*.44,s*.16,s*.3,s*.04);_dCtx.fill();});
  // 피아노 본체
  _dCtx.fillStyle='#111';_drr(cx-s*.78,cy-s*.52,s*1.56,s*.98,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#1e1e1e';_drr(cx-s*.74,cy-s*.48,s*1.48,s*.88,s*.06);_dCtx.fill();
  // 뚜껑
  _dCtx.fillStyle='#0a0a0a';_drr(cx-s*.74,cy-s*.52,s*1.48,s*.2,s*.04);_dCtx.fill();
  // 건반 (크게)
  _dCtx.fillStyle='#f0f0f0';_drr(cx-s*.7,cy-s*.24,s*1.4,s*.38,s*.04);_dCtx.fill();
  // 검은 건반
  _dCtx.fillStyle='#111';
  [-s*.56,-s*.36,-s*.08,s*.12,s*.44].forEach(dx=>{
    _drr(cx+dx,cy-s*.24,s*.17,s*.24,s*.03);_dCtx.fill();
  });
  // 건반 구분선
  _dCtx.strokeStyle='#ccc';_dCtx.lineWidth=s*.02;
  [-s*.48,-s*.28,-s*.08,s*.12,s*.32,s*.52].forEach(dx=>{
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy-s*.24);_dCtx.lineTo(cx+dx,cy+s*.14);_dCtx.stroke();
  });
  // 의자
  _dCtx.fillStyle='#2a2a2a';_drr(cx-s*.28,cy+s*.46,s*.56,s*.2,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#3a3a3a';_drr(cx-s*.26,cy+s*.44,s*.52,s*.12,s*.04);_dCtx.fill();
  [[-s*.22],[s*.22]].forEach(([dx])=>{_drr(cx+dx-s*.04,cy+s*.62,s*.08,s*.16,s*.03);_dCtx.fill();});
}
function _dPlant(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.18)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.68,s*.46,s*.1,0,0,Math.PI*2);_dCtx.fill();
  // 화분 (크게)
  _dCtx.fillStyle='#a85a28';_drr(cx-s*.32,cy+s*.02,s*.64,s*.52,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#c8783a';_drr(cx-s*.28,cy+s*.0,s*.56,s*.44,s*.07);_dCtx.fill();
  // 화분 테두리
  _dCtx.fillStyle='#a05020';_drr(cx-s*.34,cy-s*.02,s*.68,s*.1,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#d88040';_drr(cx-s*.3,cy-s*.04,s*.6,s*.07,s*.03);_dCtx.fill();
  // 흙
  _dCtx.fillStyle='#5a3a18';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.02,s*.28,s*.09,0,0,Math.PI*2);_dCtx.fill();
  // 잎들 (풍성하게)
  [[-.36,-.38,.52,.28,.4,'#3a9022'],[.2,-.44,-.48,.26,.38,'#4aaa2a'],[-.06,-.52,0,.22,.3,'#2a7818'],
   [-.44,-.2,.4,.18,.28,'#4aaa2a'],[.42,-.18,-.4,.18,.26,'#3a9022']].forEach(([dx,dy,rot,rx,ry,c])=>{
    _dCtx.fillStyle=c;_dCtx.beginPath();_dCtx.ellipse(cx+dx*s,cy+dy*s,rx*s,ry*s,rot,0,Math.PI*2);_dCtx.fill();
  });
  // 가운데 새싹
  _dCtx.fillStyle='#5aaa28';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.56,s*.14,s*.24,0,0,Math.PI*2);_dCtx.fill();
}

// ── 추가 드로우 함수 ──
function _dSunflower(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.65,s*.13,0,0,Math.PI*2);_dCtx.fill();
  // 흙 받침
  _dCtx.fillStyle='#6B4A1E';_drr(cx-s*.7,cy+s*.36,s*1.4,s*.38,s*.12);_dCtx.fill();
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.66,cy+s*.32,s*1.32,s*.24,s*.1);_dCtx.fill();
  // 줄기 왼쪽
  _dCtx.strokeStyle='#3a8020';_dCtx.lineWidth=s*.12;
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.24,cy+s*.32);_dCtx.lineTo(cx-s*.24,cy-s*.24);_dCtx.stroke();
  // 줄기 오른쪽
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.26,cy+s*.32);_dCtx.lineTo(cx+s*.26,cy-s*.32);_dCtx.stroke();
  // 잎들
  _dCtx.fillStyle='#4a9828';
  _dCtx.beginPath();_dCtx.ellipse(cx-s*.5,cy+s*.0,s*.22,s*.1,.5,0,Math.PI*2);_dCtx.fill();
  _dCtx.beginPath();_dCtx.ellipse(cx+s*.02,cy+s*.0,s*.22,s*.1,-.5,0,Math.PI*2);_dCtx.fill();
  _dCtx.beginPath();_dCtx.ellipse(cx+s*.52,cy-.04*s,s*.22,s*.1,.5,0,Math.PI*2);_dCtx.fill();
  // 꽃잎 왼쪽
  for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2;_dCtx.fillStyle='#F4C430';_dCtx.beginPath();_dCtx.ellipse(cx-s*.24+Math.cos(a)*s*.3,cy-s*.24+Math.sin(a)*s*.3,s*.12,s*.07,a,0,Math.PI*2);_dCtx.fill();}
  _dCtx.fillStyle='#5C3317';_dc(cx-s*.24,cy-s*.24,s*.18);_dCtx.fill();
  _dCtx.fillStyle='#7a4a20';_dc(cx-s*.24,cy-s*.24,s*.11);_dCtx.fill();
  // 꽃잎 오른쪽
  for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2;_dCtx.fillStyle='#F4C430';_dCtx.beginPath();_dCtx.ellipse(cx+s*.26+Math.cos(a)*s*.3,cy-s*.32+Math.sin(a)*s*.3,s*.12,s*.07,a,0,Math.PI*2);_dCtx.fill();}
  _dCtx.fillStyle='#5C3317';_dc(cx+s*.26,cy-s*.32,s*.18);_dCtx.fill();
  _dCtx.fillStyle='#7a4a20';_dc(cx+s*.26,cy-s*.32,s*.11);_dCtx.fill();
}

function _dScarecrow(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.44,s*.1,0,0,Math.PI*2);_dCtx.fill();
  // 기둥 (바닥까지 꽉)
  _dCtx.fillStyle='#7a5010';_drr(cx-s*.06,cy-s*.62,s*.12,s*1.36,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#9a6820';_drr(cx-s*.03,cy-s*.6,s*.06,s*1.32,s*.03);_dCtx.fill();
  // 팔 가로대 (더 넓게)
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.62,cy-s*.34,s*1.24,s*.1,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#A07830';_drr(cx-s*.6,cy-s*.38,s*1.2,s*.06,s*.03);_dCtx.fill();
  // 몸통 (더 크게)
  _dCtx.fillStyle='#c8783a';_drr(cx-s*.28,cy-s*.22,s*.56,s*.52,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#e0a060';_drr(cx-s*.2,cy-s*.18,s*.4,s*.16,s*.04);_dCtx.fill();
  // 바지
  _dCtx.fillStyle='#4a6090';_drr(cx-s*.22,cy+s*.08,s*.44,s*.24,s*.05);_dCtx.fill();
  [[-s*.14],[s*.14]].forEach(([dx])=>{_dCtx.fillStyle='#3a5080';_drr(cx+dx-s*.1,cy+s*.28,s*.2,s*.2,s*.04);_dCtx.fill();});
  // 머리
  _dCtx.fillStyle='#F4C430';_dc(cx,cy-s*.46,s*.22);_dCtx.fill();
  _dCtx.fillStyle='#e0b020';_dc(cx,cy-s*.46,s*.18);_dCtx.fill();
  // 모자
  _dCtx.fillStyle='#5C3317';_drr(cx-s*.26,cy-s*.72,s*.52,s*.1,s*.03);_dCtx.fill();
  _drr(cx-s*.16,cy-s*.84,s*.32,s*.18,s*.04);_dCtx.fill();
  // 얼굴
  _dCtx.fillStyle='#333';
  _dc(cx-s*.08,cy-s*.46,s*.05);_dCtx.fill();
  _dc(cx+s*.08,cy-s*.46,s*.05);_dCtx.fill();
  _dCtx.strokeStyle='#333';_dCtx.lineWidth=s*.04;
  _dCtx.beginPath();_dCtx.arc(cx,cy-s*.4,s*.08,0.1,Math.PI-.1);_dCtx.stroke();
}

function _dWindmill(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.26)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.58,s*.13,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#7a7860';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.6,s*.44,s*.14,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#9a9878';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.52,s*.38,s*.1,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#9898a0';
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.38,cy+s*.5);_dCtx.lineTo(cx+s*.38,cy+s*.5);_dCtx.lineTo(cx+s*.18,cy-s*.46);_dCtx.lineTo(cx-s*.18,cy-s*.46);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#c0c0c8';
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.32,cy+s*.48);_dCtx.lineTo(cx+s*.32,cy+s*.48);_dCtx.lineTo(cx+s*.14,cy-s*.44);_dCtx.lineTo(cx-s*.14,cy-s*.44);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='rgba(0,0,0,.12)';
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.14,cy-s*.44);_dCtx.lineTo(cx+s*.18,cy-s*.46);_dCtx.lineTo(cx+s*.38,cy+s*.5);_dCtx.lineTo(cx+s*.32,cy+s*.48);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='rgba(160,200,255,.5)';
  _drr(cx-s*.09,cy-s*.28,s*.18,s*.22,s*.05);_dCtx.fill();
  _drr(cx-s*.08,cy+s*.06,s*.16,s*.2,s*.04);_dCtx.fill();
  _dCtx.strokeStyle='rgba(80,80,100,.4)';_dCtx.lineWidth=s*.03;
  _dCtx.strokeRect(cx-s*.09,cy-s*.28,s*.18,s*.22);_dCtx.strokeRect(cx-s*.08,cy+s*.06,s*.16,s*.2);
  _dCtx.fillStyle='#8a6020';_drr(cx-s*.1,cy+s*.3,s*.2,s*.22,s*.04);_dCtx.fill();
  _dCtx.fillStyle='rgba(0,0,0,.3)';_drr(cx-s*.09,cy+s*.31,s*.18,s*.18,s*.03);_dCtx.fill();
  _dCtx.fillStyle='#6a6a58';_dc(cx,cy-s*.38,s*.12);_dCtx.fill();
  _dCtx.fillStyle='#8a8878';_dc(cx,cy-s*.38,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#e8e0c8';_dCtx.strokeStyle='#8a8870';_dCtx.lineWidth=s*.04;
  [[0,-1],[1,0],[0,1],[-1,0]].forEach(([dx,dy])=>{
    _dCtx.beginPath();
    const ox=cx+dx*s*.1, oy=cy-s*.38+dy*s*.1;
    _dCtx.moveTo(ox,oy);
    _dCtx.lineTo(cx+dx*s*.82,cy-s*.38+dy*s*.82);
    _dCtx.lineTo(cx+dx*s*.72+dy*s*.18,cy-s*.38+dy*s*.72-dx*s*.18);
    _dCtx.lineTo(ox+dy*s*.08,oy-dx*s*.08);
    _dCtx.closePath();_dCtx.fill();_dCtx.stroke();
  });
  _dCtx.fillStyle='#5a5a48';_dc(cx,cy-s*.38,s*.09);_dCtx.fill();
  _dCtx.fillStyle='#7a7a68';_dc(cx,cy-s*.38,s*.05);_dCtx.fill();
}

function _dCherryTree(cx,cy,s){
  // 바닥 그림자 (3x3이라 아주 넓게)
  _dCtx.fillStyle='rgba(0,0,0,.28)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.68,s*.88,s*.18,0,0,Math.PI*2);_dCtx.fill();
  // 뿌리 퍼짐
  _dCtx.fillStyle='#5a3a10';
  _dCtx.beginPath();_dCtx.ellipse(cx-s*.36,cy+s*.56,s*.22,s*.08,-.3,0,Math.PI*2);_dCtx.fill();
  _dCtx.beginPath();_dCtx.ellipse(cx+s*.38,cy+s*.54,s*.22,s*.08,.3,0,Math.PI*2);_dCtx.fill();
  // 기둥 (3x3답게 두껍게)
  _dCtx.fillStyle='#6B4A1E';_drr(cx-s*.26,cy-s*.08,s*.52,s*.68,s*.1);_dCtx.fill();
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.14,cy-s*.06,s*.2,s*.64,s*.06);_dCtx.fill();
  // 굵은 가지들
  _dCtx.strokeStyle='#6B4A1E';_dCtx.lineWidth=s*.14;
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.06,cy-s*.06);_dCtx.lineTo(cx-s*.6,cy-s*.4);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.06,cy-s*.06);_dCtx.lineTo(cx+s*.6,cy-s*.44);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.1);_dCtx.lineTo(cx,cy-s*.6);_dCtx.stroke();
  _dCtx.lineWidth=s*.08;
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.6,cy-s*.4);_dCtx.lineTo(cx-s*.78,cy-s*.6);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.6,cy-s*.44);_dCtx.lineTo(cx+s*.76,cy-s*.62);_dCtx.stroke();
  // 꽃구름 (3×3 전체를 꽉 채움)
  [
    [0,-s*.7,s*.52],[s*.48,-s*.54,s*.38],[-s*.48,-s*.5,s*.38],
    [s*.7,-s*.28,s*.32],[-s*.7,-s*.24,s*.32],
    [s*.28,-s*.84,s*.34],[-s*.3,-s*.82,s*.34],
    [s*.52,-s*.1,s*.28],[-s*.52,-s*.08,s*.28],
    [0,-s*.44,s*.4]
  ].forEach(([dx,dy,r])=>{
    _dCtx.fillStyle='rgba(255,182,193,.88)';_dc(cx+dx,cy+dy,r);_dCtx.fill();
  });
  // 꽃잎 점 (더 많이)
  _dCtx.fillStyle='#ff69b4';
  for(let i=0;i<20;i++){
    const a=i*.314, r=(0.15+Math.sin(i*0.7)*0.18)*s;
    _dc(cx+Math.cos(a)*r,cy-s*.5+Math.sin(a)*r*.7,s*.05);_dCtx.fill();
  }
  // 떨어지는 꽃잎 (아래쪽)
  _dCtx.fillStyle='rgba(255,182,193,.6)';
  [[-s*.4,s*.2],[-s*.2,s*.3],[s*.1,s*.15],[s*.5,s*.25]].forEach(([dx,dy])=>{
    _dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy,s*.06,s*.04,0.5,0,Math.PI*2);_dCtx.fill();
  });
}

function _dMagicStone(cx,cy,s){
  // 바닥 그림자 (마법 느낌으로 보라빛)
  _dCtx.fillStyle='rgba(100,50,180,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.66,s*.58,s*.13,0,0,Math.PI*2);_dCtx.fill();
  // 돌 기반 (더 크게)
  _dCtx.fillStyle='#5a4a7a';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.42,s*.52,s*.18,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#7a68aa';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.3,s*.46,s*.16,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#9a88c0';_dCtx.beginPath();_dCtx.ellipse(cx-s*.04,cy+s*.22,s*.4,s*.14,0,0,Math.PI*2);_dCtx.fill();
  // 보석 (훨씬 크게)
  _dCtx.fillStyle='#00d8ff';
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.56);_dCtx.lineTo(cx-s*.28,cy-s*.08);_dCtx.lineTo(cx+s*.28,cy-s*.08);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#0088cc';
  _dCtx.beginPath();_dCtx.moveTo(cx,cy+s*.2);_dCtx.lineTo(cx-s*.28,cy-s*.08);_dCtx.lineTo(cx+s*.28,cy-s*.08);_dCtx.closePath();_dCtx.fill();
  // 보석 내부 면
  _dCtx.fillStyle='rgba(120,240,255,.5)';
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.56);_dCtx.lineTo(cx-s*.1,cy-s*.08);_dCtx.lineTo(cx+s*.28,cy-s*.08);_dCtx.closePath();_dCtx.fill();
  // 빛 줄기
  _dCtx.strokeStyle='rgba(180,240,255,.9)';_dCtx.lineWidth=s*.05;
  [[-s*.42,-s*.62],[s*.44,-s*.58],[0,-s*.72],[-s*.2,-s*.28],[s*.22,-s*.3]].forEach(([dx,dy])=>{
    _dCtx.beginPath();_dCtx.moveTo(cx+dx*.7,cy+dy*.7);_dCtx.lineTo(cx+dx,cy+dy);_dCtx.stroke();
  });
  // 핵 반짝임
  _dCtx.fillStyle='rgba(255,255,255,.9)';_dc(cx-s*.08,cy-s*.38,s*.06);_dCtx.fill();
}

function _dGoldenLantern(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.25)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.5,s*.11,0,0,Math.PI*2);_dCtx.fill();
  // 바닥 받침 (넓고 안정적으로)
  _dCtx.fillStyle='#8a7010';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.6,s*.42,s*.14,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#C8A830';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.52,s*.34,s*.1,0,0,Math.PI*2);_dCtx.fill();
  // 기둥 (두껍게)
  _dCtx.fillStyle='#A08820';_drr(cx-s*.09,cy-s*.16,s*.18,s*.7,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#C8A830';_drr(cx-s*.05,cy-s*.14,s*.08,s*.66,s*.04);_dCtx.fill();
  // 등 몸체 (크게)
  _dCtx.fillStyle='rgba(255,220,50,.9)';_drr(cx-s*.3,cy-s*.72,s*.6,s*.58,s*.1);_dCtx.fill();
  _dCtx.fillStyle='rgba(255,240,120,.5)';_drr(cx-s*.26,cy-s*.68,s*.52,s*.32,s*.08);_dCtx.fill();
  // 등 프레임 격자
  _dCtx.strokeStyle='#A08820';_dCtx.lineWidth=s*.05;_dCtx.strokeRect(cx-s*.3,cy-s*.72,s*.6,s*.58);
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.72);_dCtx.lineTo(cx,cy-s*.14);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.3,cy-s*.44);_dCtx.lineTo(cx+s*.3,cy-s*.44);_dCtx.stroke();
  // 지붕 (크게)
  _dCtx.fillStyle='#C8A830';
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.92);_dCtx.lineTo(cx-s*.36,cy-s*.72);_dCtx.lineTo(cx+s*.36,cy-s*.72);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#FFD700';
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.92);_dCtx.lineTo(cx-s*.18,cy-s*.72);_dCtx.lineTo(cx+s*.18,cy-s*.72);_dCtx.closePath();_dCtx.fill();
  // 빛 반짝임
  _dCtx.fillStyle='rgba(255,240,100,.7)';_dc(cx,cy-s*.44,s*.14);_dCtx.fill();
  _dCtx.fillStyle='rgba(255,255,200,.8)';_dc(cx,cy-s*.44,s*.07);_dCtx.fill();
}

function _dFrame(cx,cy,s){
  // 액자 테두리
  _dCtx.fillStyle='#A07830';_drr(cx-s*.44,cy-s*.52,s*.88,s*.88,s*.06);_dCtx.fill();
  // 그림 내부
  _dCtx.fillStyle='#87CEEB';_drr(cx-s*.34,cy-s*.44,s*.68,s*.7,s*.03);_dCtx.fill();
  // 간단한 풍경
  _dCtx.fillStyle='#4a9822';_drr(cx-s*.34,cy+s*.06,s*.68,s*.2,s*.03);_dCtx.fill();
  _dCtx.fillStyle='#FFD700';_dc(cx-s*.1,cy-s*.22,s*.1);_dCtx.fill(); // 해
  _dCtx.fillStyle='#5c3010';_dCtx.beginPath();
  _dCtx.moveTo(cx+s*.15,cy+s*.06);_dCtx.lineTo(cx+s*.08,cy-s*.14);_dCtx.lineTo(cx+s*.22,cy-s*.14);_dCtx.closePath();_dCtx.fill();
}

function _dTV(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.18)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.6,s*.64,s*.11,0,0,Math.PI*2);_dCtx.fill();
  // 받침대
  _dCtx.fillStyle='#222';_drr(cx-s*.18,cy+s*.32,s*.36,s*.2,s*.04);_dCtx.fill();
  _drr(cx-s*.28,cy+s*.48,s*.56,s*.08,s*.04);_dCtx.fill();
  // TV 본체 (더 크고 넓게)
  _dCtx.fillStyle='#1a1a1a';_drr(cx-s*.7,cy-s*.56,s*1.4,s*.9,s*.08);_dCtx.fill();
  // 베젤
  _dCtx.fillStyle='#2a2a2a';_drr(cx-s*.68,cy-s*.54,s*1.36,s*.86,s*.06);_dCtx.fill();
  // 화면
  _dCtx.fillStyle='#0a1828';_drr(cx-s*.62,cy-s*.5,s*1.24,s*.76,s*.04);_dCtx.fill();
  // 화면 내용
  ['#e74c3c','#3498db','#2ecc71','#f39c12'].forEach((c,i)=>{
    _dCtx.fillStyle=c;_drr(cx-s*.58+i*s*.31,cy-s*.46,s*.28,s*.66,s*.03);_dCtx.fill();
  });
  // 화면 반사
  _dCtx.fillStyle='rgba(255,255,255,.06)';_drr(cx-s*.6,cy-s*.48,s*1.2,s*.28,s*.04);_dCtx.fill();
  // 전원 버튼
  _dCtx.fillStyle='#4a4a4a';_dc(cx+s*.6,cy-s*.12,s*.05);_dCtx.fill();
}

function _dBed(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.84,s*.14,0,0,Math.PI*2);_dCtx.fill();
  // 침대 프레임
  _dCtx.fillStyle='#7a5010';_drr(cx-s*.84,cy-s*.82,s*1.68,s*1.56,s*.09);_dCtx.fill();
  // 매트리스
  _dCtx.fillStyle='#e8e0d0';_drr(cx-s*.76,cy-s*.74,s*1.32,s*1.28,s*.07);_dCtx.fill();
  // 이불
  _dCtx.fillStyle='#4a6c9a';_drr(cx-s*.76,cy-s*.56,s*1.04,s*.98,s*.07);_dCtx.fill();
  _dCtx.fillStyle='#5a7caa';_drr(cx-s*.74,cy-s*.54,s*1.0,s*.86,s*.06);_dCtx.fill();
  // 이불 주름
  _dCtx.strokeStyle='rgba(255,255,255,.12)';_dCtx.lineWidth=s*.04;
  [-s*.46,-s*.16,s*.14].forEach(dx=>{
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy-s*.5);_dCtx.lineTo(cx+dx,cy+s*.42);_dCtx.stroke();
  });
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.72,cy-s*.08);_dCtx.lineTo(cx+s*.28,cy-s*.08);_dCtx.stroke();
  // 베개
  _dCtx.fillStyle='#f0e8d8';_drr(cx+s*.22,cy-s*.72,s*.5,s*.32,s*.07);_dCtx.fill();
  _dCtx.fillStyle='#e0d8c8';_drr(cx+s*.24,cy-s*.7,s*.46,s*.28,s*.05);_dCtx.fill();
  // 헤드보드
  _dCtx.fillStyle='#9a6820';_drr(cx+s*.7,cy-s*.86,s*.18,s*1.6,s*.07);_dCtx.fill();
  _dCtx.fillStyle='#c8a050';_drr(cx+s*.72,cy-s*.84,s*.06,s*1.56,s*.03);_dCtx.fill();
  // 발판
  _dCtx.fillStyle='#7a5010';_drr(cx-s*.84,cy+s*.68,s*1.68,s*.14,s*.05);_dCtx.fill();
}

function _dAquarium(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.56,s*.82,s*.12,0,0,Math.PI*2);_dCtx.fill();
  // 수조 받침
  _dCtx.fillStyle='#2a2a2a';_drr(cx-s*.74,cy+s*.4,s*1.48,s*.14,s*.04);_dCtx.fill();
  // 수조 본체
  _dCtx.fillStyle='rgba(14,60,110,.85)';_drr(cx-s*.74,cy-s*.72,s*1.48,s*1.14,s*.08);_dCtx.fill();
  // 유리 테두리
  _dCtx.strokeStyle='#5a9ad8';_dCtx.lineWidth=s*.08;_dCtx.strokeRect(cx-s*.74,cy-s*.72,s*1.48,s*1.14);
  // 물 표면 반사
  _dCtx.fillStyle='rgba(100,180,255,.25)';_drr(cx-s*.72,cy-s*.7,s*1.44,s*.26,s*.05);_dCtx.fill();
  // 물고기 5마리
  [[-s*.48,-.28,'#ff6b35'],[s*.24,-.48,'#ffd700'],[-s*.06,-.12,'#ff4488'],[s*.48,-.18,'#44aaff'],[-s*.28,-.02,'#ff8c44']].forEach(([dx,dy,c])=>{
    _dCtx.fillStyle=c;_dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy*s,s*.18,s*.1,0,0,Math.PI*2);_dCtx.fill();
    // 꼬리
    _dCtx.fillStyle=c;_dCtx.beginPath();_dCtx.moveTo(cx+dx+s*.16,cy+dy*s);_dCtx.lineTo(cx+dx+s*.28,cy+dy*s-s*.1);_dCtx.lineTo(cx+dx+s*.28,cy+dy*s+s*.1);_dCtx.closePath();_dCtx.fill();
    _dCtx.fillStyle='rgba(255,255,255,.4)';_dCtx.beginPath();_dCtx.ellipse(cx+dx-s*.06,cy+dy*s-s*.03,s*.05,s*.03,0,0,Math.PI*2);_dCtx.fill();
  });
  // 모래 바닥
  _dCtx.fillStyle='#c8b870';_drr(cx-s*.72,cy+s*.32,s*1.44,s*.16,s*.04);_dCtx.fill();
  // 해초
  _dCtx.strokeStyle='#28a870';_dCtx.lineWidth=s*.07;
  [-s*.54,-s*.22,s*.14,s*.52].forEach(dx=>{
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+s*.32);
    _dCtx.quadraticCurveTo(cx+dx+s*.1,cy+s*.04,cx+dx,cy-s*.28);_dCtx.stroke();
  });
}

function _dGoldenShelf(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.72,s*.13,0,0,Math.PI*2);_dCtx.fill();
  // 외곽 (꽉 채움)
  _dCtx.fillStyle='#a87810';_drr(cx-s*.72,cy-s*.82,s*1.44,s*1.58,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#C8A830';_drr(cx-s*.68,cy-s*.78,s*1.36,s*1.5,s*.04);_dCtx.fill();
  // 선반 3개
  [0,1,2].forEach(i=>{
    _dCtx.fillStyle='#D4B840';_drr(cx-s*.64,cy-s*.7+i*s*.48,s*1.28,s*.36,s*.03);_dCtx.fill();
    ['#e74c3c','#3498db','#2ecc71','#f39c12','#8e44ad'].forEach((c,ci)=>{
      _dCtx.fillStyle=c;_drr(cx-s*.62+ci*s*.25,cy-s*.7+i*s*.48,s*.22,s*.36,s*.02);_dCtx.fill();
      _dCtx.fillStyle='rgba(255,255,255,.2)';_drr(cx-s*.6+ci*s*.25,cy-s*.68+i*s*.48,s*.1,s*.08,s*.01);_dCtx.fill();
    });
    _dCtx.fillStyle='#C8A830';_drr(cx-s*.68,cy-s*.36+i*s*.48,s*1.36,s*.05,s*.02);_dCtx.fill();
  });
  // 테두리
  _dCtx.strokeStyle='rgba(255,240,100,.5)';_dCtx.lineWidth=s*.06;
  _dCtx.strokeRect(cx-s*.68,cy-s*.78,s*1.36,s*1.5);
  // 측면 장식
  _dCtx.fillStyle='#a87810';_drr(cx-s*.72,cy-s*.82,s*.08,s*1.58,s*.02);_dCtx.fill();
  _drr(cx+s*.64,cy-s*.82,s*.08,s*1.58,s*.02);_dCtx.fill();
}

function _dMirror(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.18)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.42,s*.09,0,0,Math.PI*2);_dCtx.fill();
  // 받침 (넓게)
  _dCtx.fillStyle='#5a3a7a';_drr(cx-s*.28,cy+s*.52,s*.56,s*.16,s*.05);_dCtx.fill();
  _drr(cx-s*.18,cy+s*.48,s*.36,s*.1,s*.04);_dCtx.fill();
  // 거울 외곽 테두리 (1x2 높이 꽉)
  _dCtx.fillStyle='#7a40c0';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.14,s*.46,s*.7,0,0,Math.PI*2);_dCtx.fill();
  // 마법 반짝임 테두리
  _dCtx.strokeStyle='#c4a0ff';_dCtx.lineWidth=s*.08;
  _dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.14,s*.46,s*.7,0,0,Math.PI*2);_dCtx.stroke();
  // 별 장식
  _dCtx.fillStyle='#e0c8ff';
  [[0,-s*.74],[s*.42,-s*.3],[-s*.42,-s*.26],[s*.36,-s*.8],[-s*.38,-s*.78]].forEach(([dx,dy])=>{
    _dCtx.font=`${s*.18}px sans-serif`;_dCtx.textAlign='center';_dCtx.textBaseline='middle';
    _dCtx.fillText('✦',cx+dx,cy+dy);
  });
  // 거울 내부
  _dCtx.fillStyle='rgba(210,240,255,.75)';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.14,s*.36,s*.6,0,0,Math.PI*2);_dCtx.fill();
  // 반사 효과
  _dCtx.fillStyle='rgba(255,255,255,.5)';_dCtx.beginPath();_dCtx.ellipse(cx-s*.14,cy-s*.46,s*.1,s*.32,-.3,0,Math.PI*2);_dCtx.fill();
  // 별빛 반사
  _dCtx.fillStyle='rgba(255,255,255,.95)';
  [[0,-s*.44],[s*.2,-s*.14],[-s*.18,-s*.2]].forEach(([dx,dy])=>{_dc(cx+dx,cy+dy,s*.05);_dCtx.fill();});
}

function _dThrone(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.56,s*.12,0,0,Math.PI*2);_dCtx.fill();
  // 다리 4개
  _dCtx.fillStyle='#a07010';
  [[-s*.44,-s*.32],[s*.28,-s*.32],[-s*.44,-s*.46],[s*.28,-s*.46]].forEach(([dx,dy])=>{
    _drr(cx+dx,cy-dy,s*.16,s*.28,s*.04);_dCtx.fill();
  });
  // 의자 바닥
  _dCtx.fillStyle='#C8A830';_drr(cx-s*.56,cy+s*.22,s*1.12,s*.2,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#D4B840';_drr(cx-s*.54,cy+s*.18,s*1.08,s*.14,s*.04);_dCtx.fill();
  // 앉는 쿠션
  _dCtx.fillStyle='#8B1a1a';_drr(cx-s*.46,cy+s*.04,s*.92,s*.2,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#a02a2a';_drr(cx-s*.44,cy+s*.02,s*.88,s*.12,s*.05);_dCtx.fill();
  // 등받이
  _dCtx.fillStyle='#C8A830';_drr(cx-s*.54,cy-s*.72,s*1.08,s*.96,s*.07);_dCtx.fill();
  // 등받이 쿠션
  _dCtx.fillStyle='#8B1a1a';_drr(cx-s*.44,cy-s*.68,s*.88,s*.72,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#a02a2a';_drr(cx-s*.42,cy-s*.66,s*.84,s*.58,s*.04);_dCtx.fill();
  // 팔걸이
  _dCtx.fillStyle='#C8A830';
  [[-s*.54,s*.08],[s*.38,s*.08]].forEach(([dx,dy])=>{_drr(cx+dx,cy+dy,s*.18,s*.22,s*.05);_dCtx.fill();});
  // 왕관 장식 (더 크게)
  _dCtx.fillStyle='#FFD700';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.28,cy-s*.72);_dCtx.lineTo(cx-s*.28,cy-s*.92);
  _dCtx.lineTo(cx-s*.1,cy-s*.82);_dCtx.lineTo(cx,cy-s*.94);
  _dCtx.lineTo(cx+s*.1,cy-s*.82);_dCtx.lineTo(cx+s*.28,cy-s*.92);
  _dCtx.lineTo(cx+s*.28,cy-s*.72);_dCtx.closePath();_dCtx.fill();
  // 왕관 보석
  _dCtx.fillStyle='#ff4444';_dc(cx,cy-s*.92,s*.07);_dCtx.fill();
  _dCtx.fillStyle='#4444ff';_dc(cx-s*.26,cy-s*.9,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#44ff44';_dc(cx+s*.26,cy-s*.9,s*.05);_dCtx.fill();
}

function _dTrophy(cx,cy,s){
  // 받침대
  _dCtx.fillStyle='#C8A830';_drr(cx-s*.26,cy+s*.42,s*.52,s*.1,s*.04);_dCtx.fill();
  _drr(cx-s*.14,cy+s*.28,s*.28,s*.16,s*.04);_dCtx.fill();
  // 컵 몸체
  _dCtx.fillStyle='#FFD700';_dCtx.beginPath();
  _dCtx.moveTo(cx-s*.36,cy-s*.52);_dCtx.lineTo(cx+s*.36,cy-s*.52);
  _dCtx.quadraticCurveTo(cx+s*.38,cy+s*.1,cx+s*.14,cy+s*.28);
  _dCtx.lineTo(cx-s*.14,cy+s*.28);
  _dCtx.quadraticCurveTo(cx-s*.38,cy+s*.1,cx-s*.36,cy-s*.52);
  _dCtx.closePath();_dCtx.fill();
  // 손잡이
  _dCtx.strokeStyle='#D4A820';_dCtx.lineWidth=s*.08;
  _dCtx.beginPath();_dCtx.arc(cx-s*.42,cy-s*.12,s*.14,Math.PI*.4,Math.PI*1.5);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.arc(cx+s*.42,cy-s*.12,s*.14,-Math.PI*.4,Math.PI*.5);_dCtx.stroke();
  // 별
  _dCtx.fillStyle='#fff';_dCtx.font=`${s*.4}px sans-serif`;_dCtx.textAlign='center';
  _dCtx.fillText('★',cx,cy-s*.04);
}

// ══════════════════════════════════════════════════════════
// ── 목재 울타리 드로우 함수 ────────────────────────────────
// ══════════════════════════════════════════════════════════

// 기둥 공통 (다른 함수에서 호출)
function _dFencePost(cx,topY,botY,s){
  const h=botY-topY;
  // 그림자 오른쪽면
  _dCtx.fillStyle='#5A2C06';_drr(cx+s*.02,topY,s*.2,h,s*.04);_dCtx.fill();
  // 기둥 본체
  _dCtx.fillStyle='#9A5A18';_drr(cx-s*.18,topY,s*.38,h,s*.06);_dCtx.fill();
  // 하이라이트 왼쪽
  _dCtx.fillStyle='#C87828';_drr(cx-s*.18,topY,s*.2,h,s*.05);_dCtx.fill();
  // 캡
  _dCtx.fillStyle='#5A2C06';
  _dCtx.beginPath();_dCtx.ellipse(cx,topY,s*.24,s*.13,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#C87828';
  _dCtx.beginPath();_dCtx.ellipse(cx-s*.02,topY-s*.02,s*.21,s*.11,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#E09838';
  _dCtx.beginPath();_dCtx.ellipse(cx-s*.06,topY-s*.05,s*.1,s*.05,0,0,Math.PI*2);_dCtx.fill();
}

// 레일 그리기 (x, y, w, s)
function _dFenceRail(rx,ry,rw,s){
  _dCtx.fillStyle='#6B3808';_drr(rx,ry+s*.02,rw,s*.21,s*.03);_dCtx.fill();
  _dCtx.fillStyle='#A86818';_drr(rx,ry,rw,s*.18,s*.03);_dCtx.fill();
  _dCtx.fillStyle='#D4A040';_drr(rx,ry-s*.02,rw,s*.1,s*.02);_dCtx.fill();
}

// d_y49: 울타리 가로형 (1×1)
function _dFenceHorz(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.17)';
  _dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.76,s*.74,s*.09,0,0,Math.PI*2);_dCtx.fill();
  // 레일 2줄 전폭 (기둥 뒤)
  _dFenceRail(cx-s*.78,cy-s*.38,s*1.56,s);
  _dFenceRail(cx-s*.78,cy-s*.04,s*1.56,s);
  // 기둥
  _dFencePost(cx,cy-s*.75,cy+s*.76,s);
}

// d_y50: 울타리 세로형 (1×1) — 기둥만
function _dFenceVert(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.14)';
  _dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.76,s*.2,s*.07,0,0,Math.PI*2);_dCtx.fill();
  _dFencePost(cx,cy-s*.8,cy+s*.8,s);
}

// d_y51: 울타리 왼쪽 코너형 (┌=└) — 판자 오른쪽
function _dFenceCornerL(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.18)';
  _dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.76,s*.4,s*.09,0,0,Math.PI*2);_dCtx.fill();
  // 판자 오른쪽 방향
  _dFenceRail(cx+s*.18,cy-s*.38,s*.6,s);
  _dFenceRail(cx+s*.18,cy-s*.04,s*.6,s);
  _dFencePost(cx,cy-s*.8,cy+s*.8,s);
}

// d_y52: 울타리 오른쪽 코너형 (┐=┘) — 판자 왼쪽
function _dFenceCornerR(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.18)';
  _dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.76,s*.4,s*.09,0,0,Math.PI*2);_dCtx.fill();
  // 판자 왼쪽 방향
  _dFenceRail(cx-s*.78,cy-s*.38,s*.6,s);
  _dFenceRail(cx-s*.78,cy-s*.04,s*.6,s);
  _dFencePost(cx,cy-s*.8,cy+s*.8,s);
}

// ══════════════════════════════════════════════════════════
// ── 2차 신규 장식 드로우 함수 ─────────────────────────────
// ══════════════════════════════════════════════════════════

// ── 건물 ──────────────────────────────────────────────────

// d_y34: 작은 창고 (2×2)
function _dSmallShed(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.26)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.78,s*.15,0,0,Math.PI*2);_dCtx.fill();
  // 기단
  _dCtx.fillStyle='#8a8070';_drr(cx-s*.72,cy+s*.34,s*1.44,s*.4,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#a09888';_drr(cx-s*.68,cy+s*.3,s*1.36,s*.26,s*.04);_dCtx.fill();
  // 벽 (회색 판자)
  _dCtx.fillStyle='#7a7870';_drr(cx-s*.7,cy-s*.38,s*1.4,s*.72,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#9a9888';_drr(cx-s*.66,cy-s*.42,s*1.32,s*.6,s*.03);_dCtx.fill();
  // 판자 선
  _dCtx.strokeStyle='#6a6860';_dCtx.lineWidth=s*.035;
  [-s*.36,s*.0,s*.36].forEach(dx=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx,cy-s*.42);_dCtx.lineTo(cx+dx,cy+s*.3);_dCtx.stroke();});
  // 문
  _dCtx.fillStyle='#5a4a18';_drr(cx-s*.16,cy-s*.12,s*.32,s*.44,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#7a6828';_drr(cx-s*.14,cy-s*.1,s*.28,s*.36,s*.03);_dCtx.fill();
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.1);_dCtx.lineTo(cx,cy+s*.26);_dCtx.strokeStyle='#5a4a18';_dCtx.lineWidth=s*.04;_dCtx.stroke();
  _dCtx.fillStyle='#d4b830';_dc(cx+s*.1,cy+s*.1,s*.04);_dCtx.fill();
  // 창문
  _dCtx.fillStyle='rgba(160,210,255,.5)';_drr(cx-s*.5,cy-s*.34,s*.22,s*.2,s*.04);_dCtx.fill();
  _dCtx.strokeStyle='#6a6860';_dCtx.lineWidth=s*.03;_dCtx.strokeRect(cx-s*.5,cy-s*.34,s*.22,s*.2);
  // 지붕
  _dCtx.fillStyle='#4a3818';_dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.82);_dCtx.lineTo(cx-s*.8,cy-s*.38);_dCtx.lineTo(cx+s*.8,cy-s*.38);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#6a5428';_dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.72);_dCtx.lineTo(cx-s*.72,cy-s*.38);_dCtx.lineTo(cx+s*.72,cy-s*.38);_dCtx.closePath();_dCtx.fill();
  _dCtx.strokeStyle='#3a2808';_dCtx.lineWidth=s*.04;
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.72);_dCtx.lineTo(cx-s*.72,cy-s*.38);_dCtx.lineTo(cx+s*.72,cy-s*.38);_dCtx.closePath();_dCtx.stroke();
  // 지붕 처마
  _dCtx.fillStyle='#3a2808';_drr(cx-s*.82,cy-s*.44,s*1.64,s*.1,s*.03);_dCtx.fill();
}

// ── 농촌 심화 ──────────────────────────────────────────────

// d_y35: 밀밭 B형 (2×2) — 더 풍성한 이삭
function _dWheatFieldB(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.74,s*.84,s*.14,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#7a5828';_drr(cx-s*.84,cy+s*.16,s*1.68,s*.6,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#8a6838';_drr(cx-s*.8,cy+s*.12,s*1.6,s*.44,s*.04);_dCtx.fill();
  _dCtx.strokeStyle='#7a6010';_dCtx.lineWidth=s*.04;
  [-s*.6,-s*.26,s*.08,s*.44].forEach(dx=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+s*.56);_dCtx.lineTo(cx+dx+s*.04,cy+s*.12);_dCtx.stroke();});
  // 풍성한 이삭 (더 둥근 형태)
  const stemsB=[
    [-s*.7,s*.08, s*.04],[-s*.48,s*.04,-s*.03],[-s*.26,s*.08, s*.05],[s*.0, s*.04,-s*.04],
    [s*.22, s*.06, s*.03],[s*.44,s*.02,-s*.04],[s*.66, s*.08, s*.04],
    [-s*.58,s*.32, s*.04],[-s*.36,s*.28,-s*.03],[-s*.14,s*.3, s*.05],[s*.08, s*.26,-s*.04],
    [s*.3,  s*.28, s*.03],[s*.52,s*.24,-s*.04],[s*.72, s*.3,  s*.04],
  ];
  stemsB.forEach(([dx,dy,lean])=>{
    _dCtx.strokeStyle='#c09818';_dCtx.lineWidth=s*.055;
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+dy);_dCtx.lineTo(cx+dx+lean,cy+dy-s*.26);_dCtx.stroke();
    // 풍성한 이삭 (타원형)
    _dCtx.fillStyle='#ddb020';_dCtx.beginPath();_dCtx.ellipse(cx+dx+lean,cy+dy-s*.36,s*.07,s*.12,lean*2,0,Math.PI*2);_dCtx.fill();
    _dCtx.fillStyle='#f0c828';_dCtx.beginPath();_dCtx.ellipse(cx+dx+lean-s*.02,cy+dy-s*.34,s*.04,s*.08,lean*2,0,Math.PI*2);_dCtx.fill();
  });
}

// d_y36: 보리밭 (2×2)
function _dBarleyField(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.74,s*.84,s*.14,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#6a5020';_drr(cx-s*.84,cy+s*.16,s*1.68,s*.6,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#7a6030';_drr(cx-s*.8,cy+s*.12,s*1.6,s*.44,s*.04);_dCtx.fill();
  _dCtx.strokeStyle='#6a5010';_dCtx.lineWidth=s*.04;
  [-s*.6,-s*.26,s*.08,s*.44].forEach(dx=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+s*.56);_dCtx.lineTo(cx+dx,cy+s*.12);_dCtx.stroke();});
  // 보리 — 길쭉하고 수염 달린 이삭
  const stemsPad=[
    [-s*.68,s*.06],[-s*.46,s*.02],[-s*.24,s*.06],[s*.02,s*.02],[s*.24,s*.06],[s*.46,s*.02],[s*.68,s*.06],
    [-s*.56,s*.3],[-s*.34,s*.26],[-s*.12,s*.3],[s*.12,s*.26],[s*.34,s*.3],[s*.56,s*.26],
  ];
  stemsPad.forEach(([dx,dy])=>{
    const lean=(dx>0?1:-1)*s*.02;
    _dCtx.strokeStyle='#a88510';_dCtx.lineWidth=s*.05;
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+dy);_dCtx.lineTo(cx+dx+lean,cy+dy-s*.28);_dCtx.stroke();
    // 보리 이삭 (길쭉)
    _dCtx.fillStyle='#c8a018';_drr(cx+dx+lean-s*.03,cy+dy-s*.44,s*.06,s*.18,s*.03);_dCtx.fill();
    // 수염 (awns)
    _dCtx.strokeStyle='#b89010';_dCtx.lineWidth=s*.02;
    [-.03,0,.03].forEach(bx=>{
      _dCtx.beginPath();_dCtx.moveTo(cx+dx+lean+bx*s,cy+dy-s*.34);_dCtx.lineTo(cx+dx+lean+bx*s+(bx>0?s*.06:-s*.06),cy+dy-s*.54);_dCtx.stroke();
    });
  });
}

// d_y37: 장작더미 B형 (1×1) — 다른 쌓기 패턴
function _dLogPileB(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.18)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.64,s*.58,s*.1,0,0,Math.PI*2);_dCtx.fill();
  const lW=s*.46, lH=s*.2;
  // 아래 단 — 2개 교차
  [[-s*.2,s*.32,-.1],[s*.16,s*.26,.12]].forEach(([dx,dy,rot])=>{
    _dCtx.fillStyle='#7a4820';_drr(cx+dx-lW*.5,cy+dy-lH*.5,lW,lH,s*.04);_dCtx.fill();
    _dCtx.fillStyle='#9a6430';_drr(cx+dx-lW*.5,cy+dy-lH*.5,lW,lH*.4,s*.03);_dCtx.fill();
    _dCtx.strokeStyle='#5a3010';_dCtx.lineWidth=s*.022;
    [.3,.6].forEach(t=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx-lW*.5+lW*t,cy+dy-lH*.5);_dCtx.lineTo(cx+dx-lW*.5+lW*t,cy+dy+lH*.5);_dCtx.stroke();});
    _dCtx.fillStyle='#5a3010';_dCtx.beginPath();_dCtx.ellipse(cx+dx+lW*.46,cy+dy,s*.08,lH*.42,0,0,Math.PI*2);_dCtx.fill();
    _dCtx.fillStyle='#c07830';_dCtx.beginPath();_dCtx.ellipse(cx+dx+lW*.46,cy+dy,s*.05,lH*.28,0,0,Math.PI*2);_dCtx.fill();
  });
  // 중간 단
  [[cx,cy+s*.06]].forEach(([mx,my])=>{
    _dCtx.fillStyle='#8a5220';_drr(mx-lW*.58,my-lH*.5,lW*1.16,lH,s*.04);_dCtx.fill();
    _dCtx.fillStyle='#aa7030';_drr(mx-lW*.58,my-lH*.5,lW*1.16,lH*.4,s*.03);_dCtx.fill();
    _dCtx.strokeStyle='#5a3010';_dCtx.lineWidth=s*.022;
    [.25,.55,.8].forEach(t=>{_dCtx.beginPath();_dCtx.moveTo(mx-lW*.58+lW*1.16*t,my-lH*.5);_dCtx.lineTo(mx-lW*.58+lW*1.16*t,my+lH*.5);_dCtx.stroke();});
    _dCtx.fillStyle='#5a3010';_dCtx.beginPath();_dCtx.ellipse(mx+lW*.54,my,s*.08,lH*.42,0,0,Math.PI*2);_dCtx.fill();
    _dCtx.fillStyle='#c07830';_dCtx.beginPath();_dCtx.ellipse(mx+lW*.54,my,s*.05,lH*.28,0,0,Math.PI*2);_dCtx.fill();
  });
  // 위 단 (1개, 조금 삐딱)
  const ty=cy-s*.22;
  _dCtx.fillStyle='#8a5220';_drr(cx-s*.06-lW*.46,ty-lH*.45,lW*.92,lH*.9,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#b07030';_drr(cx-s*.06-lW*.46,ty-lH*.45,lW*.92,lH*.36,s*.03);_dCtx.fill();
  _dCtx.strokeStyle='#5a3010';_dCtx.lineWidth=s*.022;
  [.35,.65].forEach(t=>{_dCtx.beginPath();_dCtx.moveTo(cx-s*.06-lW*.46+lW*.92*t,ty-lH*.45);_dCtx.lineTo(cx-s*.06-lW*.46+lW*.92*t,ty+lH*.45);_dCtx.stroke();});
  _dCtx.fillStyle='#5a3010';_dCtx.beginPath();_dCtx.ellipse(cx-s*.06+lW*.42,ty,s*.08,lH*.4,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#c07830';_dCtx.beginPath();_dCtx.ellipse(cx-s*.06+lW*.42,ty,s*.05,lH*.27,0,0,Math.PI*2);_dCtx.fill();
}

// d_y38: 큰 바위 B형 (2×1) — 납작한 형태
function _dLargeRockB(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.24)';_dCtx.beginPath();_dCtx.ellipse(cx+s*.06,cy+s*.58,s*.8,s*.13,0,0,Math.PI*2);_dCtx.fill();
  // 큰 납작 바위 (좌)
  _dCtx.fillStyle='#585648';
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.78,cy+s*.22);_dCtx.lineTo(cx-s*.72,cy-s*.12);_dCtx.lineTo(cx-s*.36,cy-s*.32);_dCtx.lineTo(cx+s*.1,cy-s*.28);_dCtx.lineTo(cx+s*.2,cy+s*.22);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#7a7868';
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.74,cy+s*.1);_dCtx.lineTo(cx-s*.7,cy-s*.1);_dCtx.lineTo(cx-s*.34,cy-s*.28);_dCtx.lineTo(cx+s*.08,cy-s*.24);_dCtx.lineTo(cx+s*.18,cy+s*.1);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#9a9888';_dCtx.beginPath();_dCtx.ellipse(cx-s*.36,cy-s*.12,s*.22,s*.1,-.2,0,Math.PI*2);_dCtx.fill();
  // 작은 바위 (우)
  _dCtx.fillStyle='#626058';
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.14,cy+s*.18);_dCtx.lineTo(cx+s*.2,cy-s*.08);_dCtx.lineTo(cx+s*.52,cy-s*.22);_dCtx.lineTo(cx+s*.8,cy-s*.04);_dCtx.lineTo(cx+s*.78,cy+s*.22);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#8a8878';
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.16,cy+s*.08);_dCtx.lineTo(cx+s*.22,cy-s*.06);_dCtx.lineTo(cx+s*.5,cy-s*.18);_dCtx.lineTo(cx+s*.76,cy-s*.02);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='rgba(50,110,20,.4)';_dCtx.beginPath();_dCtx.ellipse(cx+s*.5,cy+s*.08,s*.2,s*.08,.2,0,Math.PI*2);_dCtx.fill();
  // 균열
  _dCtx.strokeStyle='rgba(0,0,0,.2)';_dCtx.lineWidth=s*.03;
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.2,cy-s*.24);_dCtx.lineTo(cx-s*.06,cy+s*.1);_dCtx.stroke();
}

// ── 정적 동물 ──────────────────────────────────────────────

// d_y39: 닭 3마리 (2×1)
function _dChickens(cx,cy,s){
  // 바닥 그림자 (넓게)
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.56,s*.78,s*.13,0,0,Math.PI*2);_dCtx.fill();
  // 흙/잔디 기반 (닭들이 서 있는 땅)
  _dCtx.fillStyle='#4a7820';_drr(cx-s*.78,cy+s*.32,s*1.56,s*.26,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#5a8a28';_drr(cx-s*.74,cy+s*.28,s*1.48,s*.16,s*.06);_dCtx.fill();

  const drawChicken = (bx,by,sc,bodyCol,wingCol,combCol)=>{
    // 그림자 (개별)
    _dCtx.fillStyle='rgba(0,0,0,.15)';_dCtx.beginPath();_dCtx.ellipse(bx,by+sc*.32,sc*.28,sc*.07,0,0,Math.PI*2);_dCtx.fill();
    // 다리 (먼저 — 몸 아래에서 나오게)
    _dCtx.strokeStyle='#c89020';_dCtx.lineWidth=sc*.06;_dCtx.lineCap='round';
    _dCtx.beginPath();_dCtx.moveTo(bx-sc*.08,by+sc*.14);_dCtx.lineTo(bx-sc*.12,by+sc*.32);_dCtx.stroke();
    _dCtx.beginPath();_dCtx.moveTo(bx+sc*.06,by+sc*.12);_dCtx.lineTo(bx+sc*.1,by+sc*.32);_dCtx.stroke();
    // 발가락 (앞 2개)
    _dCtx.lineWidth=sc*.04;
    _dCtx.beginPath();_dCtx.moveTo(bx-sc*.12,by+sc*.32);_dCtx.lineTo(bx-sc*.2,by+sc*.36);_dCtx.stroke();
    _dCtx.beginPath();_dCtx.moveTo(bx-sc*.12,by+sc*.32);_dCtx.lineTo(bx-sc*.06,by+sc*.38);_dCtx.stroke();
    _dCtx.beginPath();_dCtx.moveTo(bx+sc*.1,by+sc*.32);_dCtx.lineTo(bx+sc*.18,by+sc*.36);_dCtx.stroke();
    _dCtx.beginPath();_dCtx.moveTo(bx+sc*.1,by+sc*.32);_dCtx.lineTo(bx+sc*.06,by+sc*.38);_dCtx.stroke();
    // 꼬리 깃털
    _dCtx.fillStyle=wingCol;
    _dCtx.beginPath();_dCtx.moveTo(bx+sc*.2,by-sc*.04);_dCtx.lineTo(bx+sc*.36,by-sc*.22);_dCtx.lineTo(bx+sc*.3,by-sc*.08);_dCtx.closePath();_dCtx.fill();
    _dCtx.beginPath();_dCtx.moveTo(bx+sc*.18,by-sc*.02);_dCtx.lineTo(bx+sc*.32,by-sc*.14);_dCtx.lineTo(bx+sc*.26,by+sc*.02);_dCtx.closePath();_dCtx.fill();
    // 몸통 (타원, 앞으로 기울어진 형태)
    _dCtx.fillStyle=bodyCol;_dCtx.beginPath();_dCtx.ellipse(bx,by,sc*.26,sc*.2,-.15,0,Math.PI*2);_dCtx.fill();
    // 날개
    _dCtx.fillStyle=wingCol;_dCtx.beginPath();_dCtx.ellipse(bx+sc*.04,by+sc*.06,sc*.24,sc*.14,-.2,0,Math.PI*2);_dCtx.fill();
    _dCtx.fillStyle=bodyCol;_dCtx.beginPath();_dCtx.ellipse(bx,by-sc*.02,sc*.2,sc*.14,-.15,0,Math.PI*2);_dCtx.fill();
    // 목
    _dCtx.fillStyle=bodyCol;_drr(bx-sc*.22,by-sc*.24,sc*.16,sc*.18,sc*.08);_dCtx.fill();
    // 머리
    _dCtx.fillStyle=bodyCol;_dc(bx-sc*.2,by-sc*.3,sc*.15);_dCtx.fill();
    _dCtx.fillStyle=wingCol;_dc(bx-sc*.2,by-sc*.28,sc*.12);_dCtx.fill(); // 음영
    // 볏
    _dCtx.fillStyle=combCol;
    _dCtx.beginPath();_dCtx.moveTo(bx-sc*.26,by-sc*.38);_dCtx.lineTo(bx-sc*.2,by-sc*.46);_dCtx.lineTo(bx-sc*.14,by-sc*.38);_dCtx.closePath();_dCtx.fill();
    _dCtx.beginPath();_dCtx.moveTo(bx-sc*.2,by-sc*.38);_dCtx.lineTo(bx-sc*.14,by-sc*.44);_dCtx.lineTo(bx-sc*.08,by-sc*.38);_dCtx.closePath();_dCtx.fill();
    // 부리
    _dCtx.fillStyle='#d89020';_dCtx.beginPath();_dCtx.moveTo(bx-sc*.32,by-sc*.28);_dCtx.lineTo(bx-sc*.38,by-sc*.24);_dCtx.lineTo(bx-sc*.32,by-sc*.22);_dCtx.closePath();_dCtx.fill();
    // 눈
    _dCtx.fillStyle='#f0f0f0';_dc(bx-sc*.26,by-sc*.3,sc*.05);_dCtx.fill();
    _dCtx.fillStyle='#1a1a1a';_dc(bx-sc*.27,by-sc*.3,sc*.03);_dCtx.fill();
    _dCtx.fillStyle='rgba(255,255,255,.6)';_dc(bx-sc*.28,by-sc*.32,sc*.015);_dCtx.fill();
  };

  // 닭 3마리 (왼쪽부터, 조금씩 다른 색과 크기)
  drawChicken(cx-s*.4, cy+s*.1,  s*.78, '#f0efe0','#d8d7c8','#e02010'); // 흰 닭
  drawChicken(cx+s*.06,cy+s*.12, s*.72, '#e0b820','#c89a10','#e02010'); // 황금 닭
  drawChicken(cx+s*.46,cy+s*.08, s*.68, '#c05018','#a84010','#d01808'); // 갈색 닭
}

// d_y40: 양 (2×1)
function _dSheep(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.24)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.58,s*.78,s*.13,0,0,Math.PI*2);_dCtx.fill();
  // 풀밭 기반
  _dCtx.fillStyle='#4a7820';_drr(cx-s*.8,cy+s*.34,s*1.6,s*.26,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#5a8a28';_drr(cx-s*.76,cy+s*.3,s*1.52,s*.16,s*.06);_dCtx.fill();

  // ── 다리 4개 (먼저 — 몸 아래에서 나오게) ──
  _dCtx.fillStyle='#3a3028';
  // 앞다리 2개
  _drr(cx-s*.44,cy+s*.14,s*.12,s*.28,s*.04);_dCtx.fill();
  _drr(cx-s*.28,cy+s*.14,s*.12,s*.24,s*.04);_dCtx.fill();
  // 뒷다리 2개
  _drr(cx+s*.2,cy+s*.12,s*.12,s*.28,s*.04);_dCtx.fill();
  _drr(cx+s*.36,cy+s*.12,s*.12,s*.24,s*.04);_dCtx.fill();
  // 다리 밝은 면
  _dCtx.fillStyle='#504840';
  _drr(cx-s*.42,cy+s*.14,s*.06,s*.26,s*.03);_dCtx.fill();
  _drr(cx-s*.26,cy+s*.14,s*.06,s*.22,s*.03);_dCtx.fill();
  _drr(cx+s*.22,cy+s*.12,s*.06,s*.26,s*.03);_dCtx.fill();
  _drr(cx+s*.38,cy+s*.12,s*.06,s*.22,s*.03);_dCtx.fill();
  // 발굽
  _dCtx.fillStyle='#222018';
  [cx-s*.44,cx-s*.28,cx+s*.2,cx+s*.36].forEach(lx=>{
    _drr(lx,cy+s*.38,s*.12,s*.06,s*.03);_dCtx.fill();
  });

  // ── 몸통 (두터운 울 — 겹쳐진 덩어리로 입체감) ──
  // 기저 (가장 어두운 울)
  _dCtx.fillStyle='#c0bcb0';_dCtx.beginPath();_dCtx.ellipse(cx+s*.04,cy-s*.02,s*.62,s*.36,0,0,Math.PI*2);_dCtx.fill();
  // 중간 울 덩어리들 (울퉁불퉁)
  _dCtx.fillStyle='#d8d4c8';
  [[-s*.32,-.06,s*.28,s*.22],[s*.08,-.08,s*.3,s*.24],[s*.42,-.04,s*.22,s*.2],[-s*.04,-.16,s*.26,s*.2],[s*.2,-.18,s*.22,s*.18]].forEach(([dx,dy,rx,ry])=>{
    _dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy,rx,ry,0,0,Math.PI*2);_dCtx.fill();
  });
  // 밝은 울 (상단 하이라이트)
  _dCtx.fillStyle='#eeeac0';// 크림빛 밝은 면
  _dCtx.fillStyle='#eae6da';
  [[-s*.26,-.12,s*.22,s*.16],[s*.12,-.16,s*.2,s*.15],[s*.42,-.1,s*.16,s*.14]].forEach(([dx,dy,rx,ry])=>{
    _dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy,rx,ry,0,0,Math.PI*2);_dCtx.fill();
  });

  // ── 꼬리 (뒤쪽, 작은 울 덩어리) ──
  _dCtx.fillStyle='#d8d4c8';_dCtx.beginPath();_dCtx.ellipse(cx+s*.6,cy-s*.04,s*.12,s*.1,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#eae6da';_dCtx.beginPath();_dCtx.ellipse(cx+s*.58,cy-s*.06,s*.09,s*.08,0,0,Math.PI*2);_dCtx.fill();

  // ── 목 ──
  _dCtx.fillStyle='#3a3028';_drr(cx-s*.52,cy-s*.12,s*.18,s*.22,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#504840';_drr(cx-s*.5,cy-s*.1,s*.1,s*.18,s*.04);_dCtx.fill();

  // ── 머리 (검은/어두운 갈색, 뚜렷한 형태) ──
  // 머리 기저
  _dCtx.fillStyle='#2e2820';_dCtx.beginPath();_dCtx.ellipse(cx-s*.66,cy-s*.14,s*.22,s*.17,-.1,0,Math.PI*2);_dCtx.fill();
  // 주둥이 부분 (약간 돌출)
  _dCtx.fillStyle='#3a3228';_dCtx.beginPath();_dCtx.ellipse(cx-s*.8,cy-s*.1,s*.12,s*.1,.2,0,Math.PI*2);_dCtx.fill();
  // 밝은 면
  _dCtx.fillStyle='#484038';_dCtx.beginPath();_dCtx.ellipse(cx-s*.68,cy-s*.18,s*.14,s*.1,-.2,0,Math.PI*2);_dCtx.fill();
  // 귀 (옆으로 처진)
  _dCtx.fillStyle='#3a3028';_dCtx.beginPath();_dCtx.ellipse(cx-s*.58,cy-s*.26,s*.1,s*.06,-.6,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#6a5848';_dCtx.beginPath();_dCtx.ellipse(cx-s*.58,cy-s*.26,s*.07,s*.04,-.6,0,Math.PI*2);_dCtx.fill();
  // 눈 (흰자 + 동공)
  _dCtx.fillStyle='#e8e0d0';_dc(cx-s*.74,cy-s*.16,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#1a1410';_dc(cx-s*.75,cy-s*.16,s*.04);_dCtx.fill();
  _dCtx.fillStyle='rgba(255,255,255,.7)';_dc(cx-s*.77,cy-s*.18,s*.015);_dCtx.fill();
  // 콧구멍
  _dCtx.fillStyle='#1a1208';_dc(cx-s*.84,cy-s*.06,s*.025);_dCtx.fill();
  _dc(cx-s*.8,cy-s*.06,s*.025);_dCtx.fill();
}

// ── 꽃 다양화 ──────────────────────────────────────────────

// d_y41: 라벤더 화단 (1×1)
function _dLavender(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.6,s*.11,0,0,Math.PI*2);_dCtx.fill();
  // 흙 기반
  _dCtx.fillStyle='#6a4820';_drr(cx-s*.62,cy+s*.4,s*1.24,s*.36,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#825a30';_drr(cx-s*.58,cy+s*.36,s*1.16,s*.24,s*.06);_dCtx.fill();
  // 줄기들 (7개)
  [-.54,-.36,-.18,.0,.18,.36,.54].forEach((dx,i)=>{
    const bend=(i%2?s*.04:-s*.04);
    _dCtx.strokeStyle='#5a7820';_dCtx.lineWidth=s*.06;
    _dCtx.beginPath();_dCtx.moveTo(cx+dx*s,cy+s*.36);_dCtx.quadraticCurveTo(cx+dx*s+bend,cy,cx+dx*s+bend*.5,cy-s*.42);_dCtx.stroke();
    // 라벤더 꽃 이삭
    for(let j=0;j<5;j++){
      const fy=cy-s*.22-j*s*.06;
      _dCtx.fillStyle=j<2?'#b070e0':'#9058c8';_dc(cx+dx*s+bend*.5,fy,s*.05);_dCtx.fill();
      _dCtx.fillStyle=j<2?'#c880f0':'#a068d8';_dc(cx+dx*s+bend*.5-s*.03,fy-s*.02,s*.03);_dCtx.fill();
    }
  });
}

// d_y42: 데이지 화단 (1×1)
function _dDaisy(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.6,s*.11,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#6a4820';_drr(cx-s*.62,cy+s*.4,s*1.24,s*.36,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#2a6818';_drr(cx-s*.6,cy+s*.08,s*1.2,s*.36,s*.06);_dCtx.fill();
  // 잎
  _dCtx.fillStyle='#3a8020';
  [[-s*.4,s*.2,-.3],[s*.36,s*.16,.3],[-s*.1,s*.28,0],[s*.1,s*.1,.2]].forEach(([dx,dy,rot])=>{
    _dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy,s*.14,s*.07,rot,0,Math.PI*2);_dCtx.fill();
  });
  // 데이지 꽃들 (5개)
  [[-s*.42,-s*.3],[-s*.2,-s*.42],[s*.06,-s*.36],[s*.3,-s*.28],[s*.5,-s*.44]].forEach(([dx,dy])=>{
    // 흰 꽃잎 (8개)
    for(let i=0;i<8;i++){
      const a=(i/8)*Math.PI*2;
      _dCtx.fillStyle='#f0f0e8';_dCtx.beginPath();_dCtx.ellipse(cx+dx+Math.cos(a)*s*.13,cy+dy+Math.sin(a)*s*.13,s*.07,s*.04,a,0,Math.PI*2);_dCtx.fill();
    }
    _dCtx.fillStyle='#e8c020';_dc(cx+dx,cy+dy,s*.09);_dCtx.fill();
    _dCtx.fillStyle='#f0d830';_dc(cx+dx,cy+dy,s*.06);_dCtx.fill();
  });
}

// d_y43: 장미 B형 (1×1) — 덤불형
function _dRoseB(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.62,s*.12,0,0,Math.PI*2);_dCtx.fill();
  // 잎 바탕
  _dCtx.fillStyle='#1e5a10';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.12,s*.66,s*.5,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#2a7018';_dCtx.beginPath();_dCtx.ellipse(cx-s*.12,cy+s*.04,s*.6,s*.44,0,0,Math.PI*2);_dCtx.fill();
  // 잎 디테일
  _dCtx.fillStyle='#3a8820';
  [[-s*.36,s*.06,-.3],[s*.32,s*.1,.3],[s*.0,-s*.04,0],[-s*.22,-.2,.4]].forEach(([dx,dy,rot])=>{
    _dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy,s*.16,s*.08,rot,0,Math.PI*2);_dCtx.fill();
  });
  // 장미 꽃봉오리들 (6개, 다양한 크기)
  [[-s*.32,-s*.3,'#c83a5a',s*.18],[-s*.04,-s*.44,'#d04468',s*.16],[s*.3,-s*.34,'#b03050',s*.14],
   [-s*.48,-s*.14,'#d84a60',s*.12],[s*.1,-s*.18,'#e05070',s*.11],[s*.48,-s*.18,'#c83848',s*.1]].forEach(([dx,dy,c,r])=>{
    _dCtx.fillStyle=c;_dc(cx+dx,cy+dy,r);_dCtx.fill();
    _dCtx.fillStyle='rgba(255,200,200,.3)';_dc(cx+dx-r*.3,cy+dy-r*.3,r*.4);_dCtx.fill();
  });
}

// d_y44: 튤립 B형 (1×1) — 더 넓게 피어난 형태
function _dTulipB(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.62,s*.12,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#5a3c1a';_drr(cx-s*.62,cy+s*.38,s*1.24,s*.38,s*.1);_dCtx.fill();
  _dCtx.fillStyle='#7a5430';_drr(cx-s*.58,cy+s*.34,s*1.16,s*.26,s*.08);_dCtx.fill();
  // 줄기 4개
  const tulipCols=['#e03880','#c82468','#e84898','#c02060'];
  [[-s*.44],[-s*.14],[s*.16],[s*.44]].forEach((dx,i)=>{
    _dCtx.strokeStyle='#3a8020';_dCtx.lineWidth=s*.09;
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+s*.34);_dCtx.lineTo(cx+dx+(i%2?s*.04:-s*.04),cy-s*.44);_dCtx.stroke();
  });
  // 잎
  _dCtx.fillStyle='#2a7818';
  [[-s*.28,s*.06,.4],[s*.24,s*.02,-.4]].forEach(([dx,dy,rot])=>{
    _dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy,s*.22,s*.1,rot,0,Math.PI*2);_dCtx.fill();
  });
  // 꽃 (더 활짝 핀 형태)
  [[-s*.44],[-s*.14],[s*.16],[s*.44]].forEach((dx,i)=>{
    const c=tulipCols[i], offset=(i%2?s*.04:-s*.04);
    const fx=cx+dx+offset, fy=cy-s*.46;
    // 바깥 꽃잎
    [-.3,0,.3].forEach(ang=>{
      _dCtx.fillStyle=c;_dCtx.beginPath();_dCtx.ellipse(fx+Math.sin(ang)*s*.12,fy-s*.04+Math.cos(ang)*s*.04,s*.1,s*.18,ang,0,Math.PI*2);_dCtx.fill();
    });
    _dCtx.fillStyle='rgba(255,255,255,.15)';_dc(fx-s*.04,fy-s*.1,s*.05);_dCtx.fill();
  });
}

// ── 식생/나무 ──────────────────────────────────────────────

// d_y45: 키 큰 풀숲 (1×1)
function _dTallGrass(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.18)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.52,s*.1,0,0,Math.PI*2);_dCtx.fill();
  // 풀밭 기반
  _dCtx.fillStyle='#3a6818';_drr(cx-s*.56,cy+s*.44,s*1.12,s*.32,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#4a7c20';_drr(cx-s*.52,cy+s*.4,s*1.04,s*.2,s*.06);_dCtx.fill();
  // 풀 줄기들 — height는 cy 기준 절대좌표 (s 이미 포함)
  const blades=[
    [-s*.42,s*.36,'#2a7018',s*.08, s*.04,cy-s*.44],
    [-s*.26,s*.32,'#368a20',s*.07,-s*.06,cy-s*.52],
    [-s*.1, s*.3, '#2a7018',s*.09, s*.04,cy-s*.56],
    [ s*.06,s*.32,'#3a9422',s*.08,-s*.06,cy-s*.48],
    [ s*.22,s*.28,'#2a7018',s*.07, s*.06,cy-s*.5 ],
    [ s*.38,s*.34,'#368a20',s*.08,-s*.04,cy-s*.44],
    [-s*.34,s*.24,'#1e5a10',s*.06, s*.08,cy-s*.38],
    [ s*.3, s*.22,'#1e5a10',s*.06,-s*.06,cy-s*.36],
    [-s*.18,s*.22,'#4aaa28',s*.07, s*.02,cy-s*.46],
    [ s*.14,s*.24,'#4aaa28',s*.07,-s*.04,cy-s*.42],
  ];
  blades.forEach(([bx,by,c,w,lean,tipY])=>{
    _dCtx.strokeStyle=c;_dCtx.lineWidth=w;_dCtx.lineCap='round';
    _dCtx.beginPath();
    _dCtx.moveTo(cx+bx, cy+by);
    _dCtx.quadraticCurveTo(cx+bx+lean*.4, (cy+by+tipY)*.5, cx+bx+lean, tipY);
    _dCtx.stroke();
  });
  // 씨앗 이삭
  [[-s*.42,-s*.46],[-s*.1,-s*.58],[s*.22,-s*.52],[s*.38,-s*.46]].forEach(([dx,dy])=>{
    _dCtx.fillStyle='#c8a820';_dc(cx+dx,cy+dy,s*.04);_dCtx.fill();
  });
}

// d_y46: 작은 침엽수 (2×2) — 크리스마스 트리형
function _dConifer(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.26)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.48,s*.14,0,0,Math.PI*2);_dCtx.fill();
  // 기둥
  _dCtx.fillStyle='#5a3810';_drr(cx-s*.1,cy+s*.2,s*.2,s*.56,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#7a5020';_drr(cx-s*.06,cy+s*.22,s*.1,s*.52,s*.04);_dCtx.fill();
  // 3단 삼각형 (아래서 위로 좁아짐)
  const tiers=[
    {y:s*.18, w:s*.78, h:s*.32, c:'#1a5010', c2:'#246a18'},
    {y:-s*.14, w:s*.6,  h:s*.3,  c:'#1e6012', c2:'#2a781e'},
    {y:-s*.44, w:s*.44, h:s*.28, c:'#226614', c2:'#307822'},
    {y:-s*.7,  w:s*.3,  h:s*.26, c:'#267018', c2:'#368026'},
  ];
  tiers.forEach(({y,w,h,c,c2})=>{
    _dCtx.fillStyle=c;
    _dCtx.beginPath();_dCtx.moveTo(cx,cy+y-h);_dCtx.lineTo(cx-w,cy+y+h*.3);_dCtx.lineTo(cx+w,cy+y+h*.3);_dCtx.closePath();_dCtx.fill();
    _dCtx.fillStyle=c2;
    _dCtx.beginPath();_dCtx.moveTo(cx,cy+y-h);_dCtx.lineTo(cx-w*.5,cy+y+h*.3);_dCtx.lineTo(cx+w*.5,cy+y+h*.3);_dCtx.closePath();_dCtx.fill();
  });
  // 눈 느낌 하이라이트
  _dCtx.fillStyle='rgba(255,255,255,.12)';
  tiers.forEach(({y,w,h})=>{
    _dCtx.beginPath();_dCtx.moveTo(cx,cy+y-h);_dCtx.lineTo(cx-w*.3,cy+y-h*.2);_dCtx.lineTo(cx,cy+y);_dCtx.closePath();_dCtx.fill();
  });
}

// d_y47: 둥근 큰 나무 B형 (2×2) — 넓고 둥근 실루엣
function _dRoundTreeB(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.25)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.7,s*.66,s*.15,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#5a3810';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.46,s*.18,s*.08,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#7a5020';_drr(cx-s*.16,cy-s*.1,s*.32,s*.6,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#9a7030';_drr(cx-s*.1,cy-s*.08,s*.16,s*.56,s*.06);_dCtx.fill();
  // 굵은 가지
  _dCtx.strokeStyle='#6a4020';_dCtx.lineWidth=s*.1;
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.08);_dCtx.lineTo(cx-s*.46,cy-s*.44);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.12);_dCtx.lineTo(cx+s*.5,cy-s*.5);_dCtx.stroke();
  // 크라운 (넓고 둥글게 — 올리브/짙은 초록)
  _dCtx.fillStyle='#2a5e0e';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.2,s*.8,s*.56,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#367818';_dCtx.beginPath();_dCtx.ellipse(cx-s*.08,cy-s*.3,s*.72,s*.5,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#428a20';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.4,s*.62,s*.42,0,0,Math.PI*2);_dCtx.fill();
  // 우측 하이라이트
  _dCtx.fillStyle='#4ea028';_dCtx.beginPath();_dCtx.ellipse(cx+s*.28,cy-s*.52,s*.32,s*.22,.3,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(255,255,255,.08)';_dCtx.beginPath();_dCtx.ellipse(cx+s*.22,cy-s*.58,s*.14,s*.08,-.2,0,Math.PI*2);_dCtx.fill();
}

// d_y48: 과수나무 (2×2) — 열매 달린 나무
function _dOrchard(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.25)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.7,s*.62,s*.14,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#5a3a10';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.46,s*.16,s*.08,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#7a5020';_drr(cx-s*.14,cy-s*.04,s*.28,s*.54,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#9a7030';_drr(cx-s*.08,cy-s*.02,s*.14,s*.5,s*.06);_dCtx.fill();
  _dCtx.strokeStyle='#6a4020';_dCtx.lineWidth=s*.09;
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.02);_dCtx.lineTo(cx-s*.44,cy-s*.4);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.06);_dCtx.lineTo(cx+s*.46,cy-s*.44);_dCtx.stroke();
  // 크라운 (중간 초록)
  _dCtx.fillStyle='#286010';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.22,s*.76,s*.54,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#347a18';_dCtx.beginPath();_dCtx.ellipse(cx-s*.06,cy-s*.32,s*.68,s*.48,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#3e8e20';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.42,s*.58,s*.4,0,0,Math.PI*2);_dCtx.fill();
  // 열매들 (빨간 사과)
  [[-s*.3,-s*.24],[-s*.12,-s*.42],[s*.18,-s*.28],[s*.38,-s*.44],[-s*.5,-s*.1],[s*.46,-s*.14],[-s*.22,-s*.06],[s*.14,-s*.08]].forEach(([dx,dy])=>{
    _dCtx.fillStyle='#c02020';_dc(cx+dx,cy+dy,s*.08);_dCtx.fill();
    _dCtx.fillStyle='#e03030';_dc(cx+dx-s*.02,cy+dy-s*.02,s*.05);_dCtx.fill();
    // 꼭지
    _dCtx.strokeStyle='#3a5010';_dCtx.lineWidth=s*.025;
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+dy-s*.08);_dCtx.lineTo(cx+dx,cy+dy-s*.14);_dCtx.stroke();
  });
}

// ══════════════════════════════════════════════════════════
// ── 신규 장식 드로우 함수 ──────────────────────────────────
// ══════════════════════════════════════════════════════════

// ── 공원/정원 테마 ─────────────────────────────────────────

// d_y15: 낮은 관목 (1×1)
function _dBush(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.58,s*.62,s*.13,0,0,Math.PI*2);_dCtx.fill();
  // 본체 — 3개 반구 합쳐서 칸 꽉 채움
  _dCtx.fillStyle='#1e6010';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.08,s*.72,s*.52,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#2a8018';_dCtx.beginPath();_dCtx.ellipse(cx-s*.22,cy-s*.06,s*.52,s*.42,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#2a8018';_dCtx.beginPath();_dCtx.ellipse(cx+s*.22,cy-s*.02,s*.5,s*.4,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#3a9a22';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.16,s*.56,s*.42,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#4aaa28';_dCtx.beginPath();_dCtx.ellipse(cx-s*.14,cy-s*.28,s*.36,s*.28,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#4aaa28';_dCtx.beginPath();_dCtx.ellipse(cx+s*.16,cy-s*.24,s*.34,s*.26,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(255,255,255,.08)';_dCtx.beginPath();_dCtx.ellipse(cx-s*.18,cy-s*.38,s*.1,s*.06,-.4,0,Math.PI*2);_dCtx.fill();
}

// d_y16: 큰 화단 (2×2)
function _dLargePlanter(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.74,s*.84,s*.13,0,0,Math.PI*2);_dCtx.fill();
  // 화단 테두리 — 낮은 돌 경계 (높이 줄임)
  _dCtx.fillStyle='#7a7060';_drr(cx-s*.84,cy+s*.44,s*1.68,s*.32,s*.08);_dCtx.fill();
  _dCtx.fillStyle='#9a9080';_drr(cx-s*.8,cy+s*.4,s*1.6,s*.2,s*.06);_dCtx.fill();
  // 흙
  _dCtx.fillStyle='#5a3c1e';_drr(cx-s*.76,cy-s*.02,s*1.52,s*.44,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#6a4c2a';_drr(cx-s*.72,cy-s*.04,s*1.44,s*.34,s*.04);_dCtx.fill();
  // 잎/줄기 바닥 (녹색 배경)
  _dCtx.fillStyle='#2a6818';_drr(cx-s*.7,cy-s*.24,s*1.4,s*.28,s*.04);_dCtx.fill();
  // 꽃들 — 작은 꽃 여러 송이, 덜 쨍한 색
  const flowers=[
    [-s*.58,-s*.42,'#d45080',s*.11],[-s*.32,-s*.5,'#c06840',s*.1],[-s*.06,-s*.44,'#d06050',s*.12],
    [s*.2,-s*.48,'#9050a8',s*.1],[s*.46,-s*.42,'#c0a030',s*.11],
    [-s*.46,-s*.28,'#b84068',s*.09],[-.14,-s*.3,'#a84030',s*.1],[s*.14,-s*.26,'#7848a0',s*.09],[s*.44,-s*.3,'#b89030',s*.09],
    [-s*.62,-s*.36,'#3a7830',s*.07],[s*.58,-s*.36,'#3a7830',s*.07],// 잎
  ];
  flowers.forEach(([dx,dy,c,r])=>{
    _dCtx.fillStyle=c;_dc(cx+dx,cy+dy,r);_dCtx.fill();
  });
  // 꽃 중심점 (밝게)
  [[-s*.58,-s*.42],[-s*.32,-s*.5],[-s*.06,-s*.44],[s*.2,-s*.48],[s*.46,-s*.42],[-s*.46,-s*.28],[-.14,-s*.3],[s*.14,-s*.26],[s*.44,-s*.3]].forEach(([dx,dy])=>{
    _dCtx.fillStyle='rgba(255,240,200,.6)';_dc(cx+dx,cy+dy,s*.04);_dCtx.fill();
  });
}

// d_y17: 정자 (2×2) — 한국식 정자
function _dGazebo(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.25)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.82,s*.15,0,0,Math.PI*2);_dCtx.fill();
  // 기단
  _dCtx.fillStyle='#9a9080';_drr(cx-s*.68,cy+s*.36,s*1.36,s*.38,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#b0a898';_drr(cx-s*.64,cy+s*.3,s*1.28,s*.26,s*.04);_dCtx.fill();
  // 기둥 4개
  [[-s*.56],[s*.56]].forEach(dx=>{
    _dCtx.fillStyle='#7a5010';_drr(cx+dx-s*.08,cy-s*.32,s*.16,s*.66,s*.04);_dCtx.fill();
    _dCtx.fillStyle='#9a6820';_drr(cx+dx-s*.04,cy-s*.3,s*.06,s*.62,s*.02);_dCtx.fill();
    // 기둥 접지 그림자
    _dCtx.fillStyle='rgba(0,0,0,.18)';_dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+s*.35,s*.14,s*.05,0,0,Math.PI*2);_dCtx.fill();
  });
  // 지붕 (기와형 — 2중)
  _dCtx.fillStyle='#2a5a1a';
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.98);_dCtx.lineTo(cx-s*.82,cy-s*.32);_dCtx.lineTo(cx+s*.82,cy-s*.32);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#3a7a28';
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.88);_dCtx.lineTo(cx-s*.74,cy-s*.28);_dCtx.lineTo(cx+s*.74,cy-s*.28);_dCtx.closePath();_dCtx.fill();
  // 처마 (끝 들림)
  _dCtx.fillStyle='#4a9a36';
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.84,cy-s*.32);_dCtx.lineTo(cx-s*.96,cy-s*.42);_dCtx.lineTo(cx-s*.72,cy-s*.28);_dCtx.closePath();_dCtx.fill();
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.84,cy-s*.32);_dCtx.lineTo(cx+s*.96,cy-s*.42);_dCtx.lineTo(cx+s*.72,cy-s*.28);_dCtx.closePath();_dCtx.fill();
  // 지붕 기와 선
  _dCtx.strokeStyle='rgba(0,0,0,.15)';_dCtx.lineWidth=s*.03;
  [-.5,0,.5].forEach(dx=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx*s*.8,cy-s*.32);_dCtx.lineTo(cx,cy-s*.88);_dCtx.stroke();});
  // 지붕 꼭대기
  _dCtx.fillStyle='#8a5010';_drr(cx-s*.08,cy-s*1.02,s*.16,s*.12,s*.04);_dCtx.fill();
}

// d_y18: 돌 벤치 (2×1)
function _dStoneBench(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.58,s*.7,s*.1,0,0,Math.PI*2);_dCtx.fill();
  // ★ 2×1이라 X가 2배 스케일됨 → x좌표를 절반으로 줘야 화면에서 정상 비율
  // 다리 왼쪽 (스크린상 왼쪽 끝 부근)
  _dCtx.fillStyle='#6a6858';_drr(cx-s*.46,cy+s*.08,s*.22,s*.46,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#8a8878';_drr(cx-s*.44,cy+s*.06,s*.14,s*.3,s*.04);_dCtx.fill();
  // 다리 오른쪽
  _dCtx.fillStyle='#6a6858';_drr(cx+s*.24,cy+s*.08,s*.22,s*.46,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#8a8878';_drr(cx+s*.26,cy+s*.06,s*.14,s*.3,s*.04);_dCtx.fill();
  // 좌석 판 (두꺼운 돌)
  _dCtx.fillStyle='#7a7868';_drr(cx-s*.52,cy-s*.26,s*1.04,s*.34,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#9a9888';_drr(cx-s*.5,cy-s*.34,s*1.0,s*.22,s*.05);_dCtx.fill();
  // 판 표면 질감
  _dCtx.strokeStyle='rgba(0,0,0,.12)';_dCtx.lineWidth=s*.03;
  [-s*.12,s*.14].forEach(dx=>{
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy-s*.34);_dCtx.lineTo(cx+dx,cy-s*.12);_dCtx.stroke();
  });
  // 하단 어두운 면 (두께감)
  _dCtx.fillStyle='#5a5848';_drr(cx-s*.52,cy+s*.06,s*1.04,s*.08,s*.02);_dCtx.fill();
}

// d_y19: 큰 나무 B형 (2×2) — 넓은 우산형
function _dTreeB(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.25)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.68,s*.72,s*.15,0,0,Math.PI*2);_dCtx.fill();
  // 기둥
  _dCtx.fillStyle='#5a3a10';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.44,s*.2,s*.08,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#7a5020';_drr(cx-s*.14,cy-s*.16,s*.28,s*.62,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#9a7030';_drr(cx-s*.08,cy-s*.14,s*.1,s*.58,s*.04);_dCtx.fill();
  // 크라운 — 넓은 우산형, 짙은 초록
  _dCtx.fillStyle='#1a5a08';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.12,s*.84,s*.38,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#226a10';_dCtx.beginPath();_dCtx.ellipse(cx-s*.1,cy-s*.22,s*.76,s*.34,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#2e8018';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.32,s*.68,s*.3,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#3a9020';_dCtx.beginPath();_dCtx.ellipse(cx-s*.06,cy-s*.42,s*.54,s*.24,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(255,255,255,.1)';_dCtx.beginPath();_dCtx.ellipse(cx-s*.22,cy-s*.5,s*.16,s*.08,-.3,0,Math.PI*2);_dCtx.fill();
}

// d_y20: 조형 분수 (3×3)
function _dOrnamentalFountain(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.28)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.92,s*.17,0,0,Math.PI*2);_dCtx.fill();
  // 큰 분지
  _dCtx.fillStyle='#6a6858';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.52,s*.92,s*.22,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#8a8878';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.4,s*.92,s*.22,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(30,106,180,.95)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.34,s*.8,s*.18,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(80,160,230,.6)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.3,s*.68,s*.12,0,0,Math.PI*2);_dCtx.fill();
  // 중간 단
  _dCtx.fillStyle='#7a7868';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.04,s*.46,s*.12,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#9a9888';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.02,s*.46,s*.12,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(30,106,180,.8)';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.08,s*.38,s*.09,0,0,Math.PI*2);_dCtx.fill();
  // 기둥
  _dCtx.fillStyle='#7a7868';_drr(cx-s*.09,cy-s*.46,s*.18,s*.52,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#aaa898';_drr(cx-s*.05,cy-s*.44,s*.08,s*.48,s*.04);_dCtx.fill();
  // 물줄기 (5개)
  _dCtx.strokeStyle='rgba(135,206,235,.92)';_dCtx.lineWidth=s*.09;
  [[-s*.38,-s*.92],[s*.38,-s*.9],[0,-s*.98],[-s*.22,-s*.84],[s*.22,-s*.84]].forEach(([ex,ey])=>{
    _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.44);
    _dCtx.quadraticCurveTo(cx+ex*.4,cy-s*.7,cx+ex,cy+ey+s*.98);_dCtx.stroke();
  });
  // 조각상 (위)
  _dCtx.fillStyle='#9a9888';_dc(cx,cy-s*.56,s*.12);_dCtx.fill();
  _dCtx.fillStyle='#b8b8a8';_dc(cx,cy-s*.56,s*.08);_dCtx.fill();
}

// d_y21: 장미 아치 (1×3, 세로로 긴 구조물)
function _dRoseArch(cx,cy,s){
  // 바닥 그림자 (기둥 2개 위치에 맞게 넓게)
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.84,s*.58,s*.12,0,0,Math.PI*2);_dCtx.fill();

  // ── 기둥 2개 (확실히 구분되게, 굵게) ──
  [[-s*.36],[s*.36]].forEach(dx=>{
    // 기둥 기저 (넓은 받침)
    _dCtx.fillStyle='#5a3c0e';_drr(cx+dx-s*.12,cy+s*.62,s*.24,s*.24,s*.04);_dCtx.fill();
    _dCtx.fillStyle='#7a5420';_drr(cx+dx-s*.1,cy+s*.6,s*.2,s*.18,s*.03);_dCtx.fill();
    // 기둥 몸체 (두껍게)
    _dCtx.fillStyle='#6a4a12';_drr(cx+dx-s*.1,cy-s*.82,s*.2,s*1.46,s*.05);_dCtx.fill();
    _dCtx.fillStyle='#8a6428';_drr(cx+dx-s*.07,cy-s*.8,s*.12,s*1.42,s*.04);_dCtx.fill();
    _dCtx.fillStyle='#9a7438';_drr(cx+dx-s*.05,cy-s*.76,s*.06,s*1.34,s*.03);_dCtx.fill();
  });

  // ── 아치 프레임 상단 (곡선) ──
  // 가로 직선 부분
  _dCtx.fillStyle='#6a4a12';_drr(cx-s*.42,cy-s*.86,s*.84,s*.16,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#8a6428';_drr(cx-s*.38,cy-s*.92,s*.76,s*.1,s*.05);_dCtx.fill();
  // 곡선 아치 (bezier)
  _dCtx.strokeStyle='#6a4a12';_dCtx.lineWidth=s*.14;_dCtx.lineCap='round';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.34,cy-s*.84);
  _dCtx.quadraticCurveTo(cx,cy-s*1.16,cx+s*.34,cy-s*.84);
  _dCtx.stroke();
  _dCtx.strokeStyle='#8a6428';_dCtx.lineWidth=s*.08;
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.3,cy-s*.84);
  _dCtx.quadraticCurveTo(cx,cy-s*1.1,cx+s*.3,cy-s*.84);
  _dCtx.stroke();

  // ── 덩굴/잎 (아치를 타고 오르게) ──
  _dCtx.fillStyle='#246014';
  // 왼쪽 기둥 덩굴
  [[-s*.42,-s*.62],[-s*.44,-s*.38],[-s*.4,-s*.14],[-s*.38,s*.12],[-s*.42,s*.36]].forEach(([dx,dy])=>{
    _dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy,s*.16,s*.09,(dy<0?.3:-.3),0,Math.PI*2);_dCtx.fill();
  });
  // 오른쪽 기둥 덩굴
  [[s*.42,-s*.58],[s*.44,-s*.34],[s*.4,-s*.1],[s*.38,s*.14],[s*.42,s*.38]].forEach(([dx,dy])=>{
    _dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy,s*.16,s*.09,(dy<0?-.3:.3),0,Math.PI*2);_dCtx.fill();
  });
  // 아치 상단 덩굴
  _dCtx.fillStyle='#2e7a1c';
  [[-s*.2,-s*.96],[s*.0,-s*1.06],[s*.2,-s*.96],[-s*.38,-s*.82],[s*.38,-s*.82]].forEach(([dx,dy])=>{
    _dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy,s*.14,s*.09,0,0,Math.PI*2);_dCtx.fill();
  });

  // ── 장미꽃 (기둥 + 아치 상단에 분포) ──
  // 왼쪽 기둥 꽃
  [[-s*.46,-s*.5,'#c82a42'],[-s*.4,-.1*s,'#d83650'],[-s*.44,s*.28,'#b82038']].forEach(([dx,dy,c])=>{
    _dCtx.fillStyle=c;_dc(cx+dx,cy+dy,s*.13);_dCtx.fill();
    _dCtx.fillStyle='rgba(255,180,190,.5)';_dc(cx+dx-s*.04,cy+dy-s*.04,s*.07);_dCtx.fill();
  });
  // 오른쪽 기둥 꽃
  [[s*.44,-s*.44,'#d83250'],[s*.4,-s*.06,'#c82a42'],[s*.44,s*.3,'#b81e36']].forEach(([dx,dy,c])=>{
    _dCtx.fillStyle=c;_dc(cx+dx,cy+dy,s*.13);_dCtx.fill();
    _dCtx.fillStyle='rgba(255,180,190,.5)';_dc(cx+dx-s*.04,cy+dy-s*.04,s*.07);_dCtx.fill();
  });
  // 아치 상단 꽃
  [[-s*.16,-s*.98,'#e83458'],[s*.16,-s*.96,'#d82a4a'],[s*.0,-s*1.04,'#c82040']].forEach(([dx,dy,c])=>{
    _dCtx.fillStyle=c;_dc(cx+dx,cy+dy,s*.14);_dCtx.fill();
    _dCtx.fillStyle='rgba(255,180,190,.5)';_dc(cx+dx-s*.04,cy+dy-s*.04,s*.08);_dCtx.fill();
  });
}

// ── 농촌 테마 ───────────────────────────────────────────────

// d_y22: 나무상자 (1×1)
function _dWoodenCrate(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.58,s*.58,s*.11,0,0,Math.PI*2);_dCtx.fill();
  // 상자 본체
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.52,cy-s*.38,s*1.04,s*.98,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#A07830';_drr(cx-s*.48,cy-s*.44,s*.96,s*.84,s*.05);_dCtx.fill();
  // 판자 선
  _dCtx.strokeStyle='#7a5010';_dCtx.lineWidth=s*.04;
  [-s*.14,s*.14].forEach(dx=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx,cy-s*.44);_dCtx.lineTo(cx+dx,cy+s*.42);_dCtx.stroke();});
  // 가로 띠
  _dCtx.strokeStyle='#6a4010';_dCtx.lineWidth=s*.06;
  [-s*.04,s*.24].forEach(dy=>{_dCtx.beginPath();_dCtx.moveTo(cx-s*.48,cy+dy);_dCtx.lineTo(cx+s*.48,cy+dy);_dCtx.stroke();});
  // 상단면
  _dCtx.fillStyle='#c8a050';_drr(cx-s*.48,cy-s*.5,s*.96,s*.12,s*.04);_dCtx.fill();
}

// d_y23: 장작더미 A형 (1×1)
function _dLogPile(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.64,s*.64,s*.11,0,0,Math.PI*2);_dCtx.fill();
  // 통나무 3단 쌓기 — 옆으로 눕힌 형태, 높낮이 차이
  // 맨 아래 단 (2개, 나란히)
  const logH=s*.22, logW=s*.54;
  [[-s*.24,s*.28],[s*.22,s*.22]].forEach(([dx,dy])=>{
    _dCtx.fillStyle='#7a4a18';_drr(cx+dx-logW*.5,cy+dy-logH*.5,logW,logH,s*.05);_dCtx.fill();
    _dCtx.fillStyle='#9a6428';_drr(cx+dx-logW*.5,cy+dy-logH*.5,logW,logH*.5,s*.04);_dCtx.fill();
    // 나뭇결
    _dCtx.strokeStyle='#6a3a10';_dCtx.lineWidth=s*.025;
    [.25,.5,.75].forEach(t=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx-logW*.5+logW*t,cy+dy-logH*.5);_dCtx.lineTo(cx+dx-logW*.5+logW*t,cy+dy+logH*.5);_dCtx.stroke();});
    // 끝면 (원형 단면)
    _dCtx.fillStyle='#6a3810';_dCtx.beginPath();_dCtx.ellipse(cx+dx+logW*.48,cy+dy,s*.09,logH*.44,0,0,Math.PI*2);_dCtx.fill();
    _dCtx.fillStyle='#c88040';_dCtx.beginPath();_dCtx.ellipse(cx+dx+logW*.48,cy+dy,s*.06,logH*.3,0,0,Math.PI*2);_dCtx.fill();
  });
  // 가운데 단 (1개, 약간 엇갈려)
  const mx=cx-s*.02, my=cy+s*.02;
  _dCtx.fillStyle='#8a5420';_drr(mx-logW*.55,my-logH*.5,logW*1.1,logH,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#aa7030';_drr(mx-logW*.55,my-logH*.5,logW*1.1,logH*.45,s*.04);_dCtx.fill();
  _dCtx.strokeStyle='#6a3a10';_dCtx.lineWidth=s*.025;
  [.2,.45,.7].forEach(t=>{_dCtx.beginPath();_dCtx.moveTo(mx-logW*.55+logW*1.1*t,my-logH*.5);_dCtx.lineTo(mx-logW*.55+logW*1.1*t,my+logH*.5);_dCtx.stroke();});
  _dCtx.fillStyle='#6a3810';_dCtx.beginPath();_dCtx.ellipse(mx+logW*.52,my,s*.09,logH*.44,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#c88040';_dCtx.beginPath();_dCtx.ellipse(mx+logW*.52,my,s*.06,logH*.3,0,0,Math.PI*2);_dCtx.fill();
  // 맨 위 단 (1개)
  const ty=cy-s*.28;
  _dCtx.fillStyle='#8a5420';_drr(cx-logW*.48,ty-logH*.45,logW*.96,logH*.9,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#b07838';_drr(cx-logW*.48,ty-logH*.45,logW*.96,logH*.38,s*.04);_dCtx.fill();
  _dCtx.strokeStyle='#6a3a10';_dCtx.lineWidth=s*.025;
  [.3,.6].forEach(t=>{_dCtx.beginPath();_dCtx.moveTo(cx-logW*.48+logW*.96*t,ty-logH*.45);_dCtx.lineTo(cx-logW*.48+logW*.96*t,ty+logH*.45);_dCtx.stroke();});
  _dCtx.fillStyle='#6a3810';_dCtx.beginPath();_dCtx.ellipse(cx+logW*.45,ty,s*.09,logH*.4,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#c88040';_dCtx.beginPath();_dCtx.ellipse(cx+logW*.45,ty,s*.06,logH*.28,0,0,Math.PI*2);_dCtx.fill();
}

// d_y24: 건초더미 (1×1)
function _dHayBale(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.6,s*.62,s*.12,0,0,Math.PI*2);_dCtx.fill();
  // 원통형 건초
  _dCtx.fillStyle='#c8a020';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.1,s*.56,s*.56,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#e0b828';_dCtx.beginPath();_dCtx.ellipse(cx,cy,s*.48,s*.48,0,0,Math.PI*2);_dCtx.fill();
  // 끈
  _dCtx.strokeStyle='#8a6010';_dCtx.lineWidth=s*.06;
  [-s*.2,s*.2].forEach(dx=>{_dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+s*.08,s*.06,s*.48,0,0,Math.PI*2);_dCtx.stroke();});
  // 앞면 끈
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.56,cy);_dCtx.lineTo(cx+s*.56,cy);_dCtx.stroke();
  // 짚 결
  _dCtx.strokeStyle='rgba(255,200,40,.4)';_dCtx.lineWidth=s*.02;
  for(let i=0;i<8;i++){
    _dCtx.beginPath();_dCtx.moveTo(cx-s*.46+i*s*.12,cy-s*.44);_dCtx.lineTo(cx-s*.46+i*s*.12,cy+s*.52);_dCtx.stroke();
  }
}

// d_y25: 밀밭 (2×2)
function _dWheatField(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.22)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.74,s*.84,s*.14,0,0,Math.PI*2);_dCtx.fill();
  // 흙 (밝은 갈색 기본)
  _dCtx.fillStyle='#8a6030';_drr(cx-s*.84,cy+s*.14,s*1.68,s*.62,s*.06);_dCtx.fill();
  // 흙 질감 (얼룩)
  _dCtx.fillStyle='#7a5228';_dCtx.beginPath();_dCtx.ellipse(cx-s*.4,cy+s*.36,s*.32,s*.16,-.2,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#9a7040';_dCtx.beginPath();_dCtx.ellipse(cx+s*.3,cy+s*.5,s*.28,s*.13,.2,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#7a5228';_dCtx.beginPath();_dCtx.ellipse(cx+s*.6,cy+s*.28,s*.2,s*.1,0,0,Math.PI*2);_dCtx.fill();
  // 밭고랑 선
  _dCtx.strokeStyle='#6a4820';_dCtx.lineWidth=s*.04;
  [-s*.5,-s*.16,s*.18,s*.52].forEach(dx=>{
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+s*.76);_dCtx.lineTo(cx+dx+s*.04,cy+s*.14);_dCtx.stroke();
  });
  // 밀 줄기 (약간 불규칙하게)
  const stems=[
    [-s*.62,s*.1, s*.03],[-s*.4, s*.06,-s*.02],[-s*.18,s*.1, s*.04],[s*.06, s*.06,-s*.03],
    [s*.28, s*.08, s*.02],[s*.5,  s*.04,-s*.04],[s*.7,  s*.1, s*.03],
    [-s*.5, s*.34, s*.04],[-s*.28,s*.3,-s*.02],[-s*.06,s*.32, s*.03],[s*.16, s*.28,-s*.04],
    [s*.38, s*.3,  s*.02],[s*.6,  s*.32,-s*.03],
  ];
  stems.forEach(([dx,dy,lean])=>{
    _dCtx.strokeStyle='#b89820';_dCtx.lineWidth=s*.055;
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+dy);_dCtx.lineTo(cx+dx+lean,cy+dy-s*.24);_dCtx.stroke();
    // 이삭
    _dCtx.fillStyle='#d4aa22';_drr(cx+dx+lean-s*.05,cy+dy-s*.38,s*.1,s*.16,s*.05);_dCtx.fill();
    _dCtx.fillStyle='#eecc38';_drr(cx+dx+lean-s*.03,cy+dy-s*.36,s*.06,s*.1,s*.03);_dCtx.fill();
  });
}

// d_y26: 큰 바위 (2×1)
function _dLargeRock(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.26)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.58,s*.86,s*.14,0,0,Math.PI*2);_dCtx.fill();
  // 바위 기저 (가장 어두운)
  _dCtx.fillStyle='#565448';_dCtx.beginPath();_dCtx.ellipse(cx+s*.04,cy+s*.18,s*.82,s*.44,.05,0,Math.PI*2);_dCtx.fill();
  // 메인 바위 몸체 (불규칙 다각형 느낌)
  _dCtx.fillStyle='#7a7868';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.74,cy+s*.22);
  _dCtx.lineTo(cx-s*.82,cy-s*.04);
  _dCtx.lineTo(cx-s*.6,cy-s*.26);
  _dCtx.lineTo(cx-s*.22,cy-s*.38);
  _dCtx.lineTo(cx+s*.18,cy-s*.34);
  _dCtx.lineTo(cx+s*.58,cy-s*.2);
  _dCtx.lineTo(cx+s*.8,cy+s*.04);
  _dCtx.lineTo(cx+s*.72,cy+s*.26);
  _dCtx.closePath();_dCtx.fill();
  // 중간 면 (밝게)
  _dCtx.fillStyle='#9a9888';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.72,cy-s*.02);
  _dCtx.lineTo(cx-s*.56,cy-s*.24);
  _dCtx.lineTo(cx-s*.16,cy-s*.36);
  _dCtx.lineTo(cx+s*.16,cy-s*.32);
  _dCtx.lineTo(cx+s*.54,cy-s*.18);
  _dCtx.lineTo(cx+s*.6,cy+s*.06);
  _dCtx.lineTo(cx-s*.68,cy+s*.08);
  _dCtx.closePath();_dCtx.fill();
  // 하이라이트 면 (상단 왼쪽)
  _dCtx.fillStyle='#b0ae9c';
  _dCtx.beginPath();
  _dCtx.moveTo(cx-s*.56,cy-s*.24);
  _dCtx.lineTo(cx-s*.26,cy-s*.36);
  _dCtx.lineTo(cx+s*.06,cy-s*.32);
  _dCtx.lineTo(cx-s*.06,cy-s*.2);
  _dCtx.lineTo(cx-s*.46,cy-s*.12);
  _dCtx.closePath();_dCtx.fill();
  // 균열선
  _dCtx.strokeStyle='rgba(0,0,0,.22)';_dCtx.lineWidth=s*.04;
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.1,cy-s*.32);_dCtx.lineTo(cx+s*.06,cy+s*.1);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.3,cy-s*.22);_dCtx.lineTo(cx+s*.52,cy+s*.1);_dCtx.stroke();
  // 이끼
  _dCtx.fillStyle='rgba(50,110,20,.45)';_dCtx.beginPath();_dCtx.ellipse(cx+s*.4,cy+s*.12,s*.24,s*.1,.2,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(50,110,20,.3)';_dCtx.beginPath();_dCtx.ellipse(cx-s*.5,cy+s*.1,s*.18,s*.08,-.2,0,Math.PI*2);_dCtx.fill();
}

function _dWell(cx,cy,s){
  // 바닥 그림자 (기단에 맞게)
  _dCtx.fillStyle='rgba(0,0,0,.26)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.62,s*.13,0,0,Math.PI*2);_dCtx.fill();
  // 돌 기단 — 두께감 (기존보다 작게, 구조물 부각)
  _dCtx.fillStyle='#6a6050';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.55,s*.56,s*.18,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#b0a090';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.44,s*.56,s*.18,0,0,Math.PI*2);_dCtx.fill();
  // 기단 측면 연결
  _dCtx.fillStyle='#8a7a68';_drr(cx-s*.56,cy+s*.44,s*1.12,s*.11,0);_dCtx.fill();
  _dCtx.fillStyle='#b0a090';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.44,s*.56,s*.18,0,0,Math.PI*2);_dCtx.fill();
  // 내부 (물)
  _dCtx.fillStyle='#1a4a7a';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.36,s*.42,s*.13,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#2870b0';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.33,s*.42,s*.13,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(255,255,255,.2)';_dCtx.beginPath();_dCtx.ellipse(cx-s*.14,cy+s*.31,s*.14,s*.04,0,0,Math.PI*2);_dCtx.fill();
  // 기단 테두리 질감
  _dCtx.strokeStyle='rgba(0,0,0,.15)';_dCtx.lineWidth=s*.03;
  [-s*.2,s*.2].forEach(dx=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+s*.28);_dCtx.lineTo(cx+dx,cy+s*.62);_dCtx.stroke();});
  // 기둥 접지 그림자
  _dCtx.fillStyle='rgba(0,0,0,.18)';_dCtx.beginPath();_dCtx.ellipse(cx-s*.44,cy+s*.44,s*.12,s*.04,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(0,0,0,.18)';_dCtx.beginPath();_dCtx.ellipse(cx+s*.44,cy+s*.44,s*.12,s*.04,0,0,Math.PI*2);_dCtx.fill();
  // 기둥 좌
  _dCtx.fillStyle='#7a5010';_drr(cx-s*.52,cy-s*.64,s*.18,s*1.1,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#9a6820';_drr(cx-s*.5,cy-s*.62,s*.1,s*1.06,s*.04);_dCtx.fill();
  // 기둥 우
  _dCtx.fillStyle='#7a5010';_drr(cx+s*.34,cy-s*.64,s*.18,s*1.1,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#9a6820';_drr(cx+s*.36,cy-s*.62,s*.1,s*1.06,s*.04);_dCtx.fill();
  // 가로대
  _dCtx.fillStyle='#6a4010';_drr(cx-s*.58,cy-s*.68,s*1.16,s*.2,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#9a6820';_drr(cx-s*.56,cy-s*.74,s*1.12,s*.12,s*.04);_dCtx.fill();
  // 지붕
  _dCtx.fillStyle='#a83010';_dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.98);_dCtx.lineTo(cx-s*.64,cy-s*.68);_dCtx.lineTo(cx+s*.64,cy-s*.68);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#c84020';_dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.88);_dCtx.lineTo(cx-s*.56,cy-s*.68);_dCtx.lineTo(cx+s*.56,cy-s*.68);_dCtx.closePath();_dCtx.fill();
  _dCtx.strokeStyle='#7a2008';_dCtx.lineWidth=s*.04;
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.88);_dCtx.lineTo(cx-s*.56,cy-s*.68);_dCtx.lineTo(cx+s*.56,cy-s*.68);_dCtx.closePath();_dCtx.stroke();
  // 기와선
  [-.28,.28].forEach(dx=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx*s,cy-s*.68);_dCtx.lineTo(cx,cy-s*.88);_dCtx.stroke();});
  // 도르래
  _dCtx.fillStyle='#5a3808';_drr(cx-s*.1,cy-s*.74,s*.2,s*.1,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#7a5818';_dc(cx,cy-s*.69,s*.09);_dCtx.fill();
  _dCtx.fillStyle='#3a2008';_dc(cx,cy-s*.69,s*.04);_dCtx.fill();
  // 두레박 줄 + 두레박
  _dCtx.strokeStyle='#4a3008';_dCtx.lineWidth=s*.06;
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.64);_dCtx.lineTo(cx+s*.08,cy+s*.22);_dCtx.stroke();
  _dCtx.fillStyle='#8B6520';_drr(cx-s*.04,cy+s*.2,s*.24,s*.2,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#A07830';_drr(cx-s*.04,cy+s*.2,s*.24,s*.09,s*.03);_dCtx.fill();
  _dCtx.fillStyle='#5a3808';_drr(cx-s*.06,cy+s*.18,s*.28,s*.05,s*.02);_dCtx.fill();
}

// d_y28: 헛간 (3×2)
function _dBarn(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.28)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.62,s*.92,s*.16,0,0,Math.PI*2);_dCtx.fill();
  // 기단
  _dCtx.fillStyle='#9a9080';_drr(cx-s*.86,cy+s*.3,s*1.72,s*.34,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#b0a898';_drr(cx-s*.82,cy+s*.26,s*1.64,s*.22,s*.04);_dCtx.fill();
  // 벽면
  _dCtx.fillStyle='#9a3018';_drr(cx-s*.82,cy-s*.44,s*1.64,s*.74,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#b83c22';_drr(cx-s*.78,cy-s*.48,s*1.56,s*.62,s*.03);_dCtx.fill();
  // 판자 선
  _dCtx.strokeStyle='#8a2810';_dCtx.lineWidth=s*.04;
  [-s*.5,-s*.16,s*.18,s*.52].forEach(dx=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx,cy-s*.48);_dCtx.lineTo(cx+dx,cy+s*.26);_dCtx.stroke();});
  // 큰 문
  _dCtx.fillStyle='#5a3010';_drr(cx-s*.3,cy-s*.16,s*.6,s*.44,s*.04);_dCtx.fill();
  _dCtx.fillStyle='rgba(0,0,0,.4)';_drr(cx-s*.28,cy-s*.14,s*.56,s*.4,s*.03);_dCtx.fill();
  _dCtx.strokeStyle='#8a6020';_dCtx.lineWidth=s*.04;
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.16);_dCtx.lineTo(cx,cy+s*.28);_dCtx.stroke();
  // X 빗장
  _dCtx.strokeStyle='#8a6020';_dCtx.lineWidth=s*.06;
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.28,cy-s*.14);_dCtx.lineTo(cx,cy+s*.26);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.14);_dCtx.lineTo(cx-s*.28,cy+s*.26);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.14);_dCtx.lineTo(cx+s*.28,cy+s*.26);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.28,cy-s*.14);_dCtx.lineTo(cx,cy+s*.26);_dCtx.stroke();
  // 지붕 (삼각)
  _dCtx.fillStyle='#5a3a18';
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.92);_dCtx.lineTo(cx-s*.9,cy-s*.44);_dCtx.lineTo(cx+s*.9,cy-s*.44);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#7a5228';
  _dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.82);_dCtx.lineTo(cx-s*.8,cy-s*.44);_dCtx.lineTo(cx+s*.8,cy-s*.44);_dCtx.closePath();_dCtx.fill();
  // 지붕 선
  _dCtx.strokeStyle='#4a2a10';_dCtx.lineWidth=s*.03;
  [-.5,0,.5].forEach(dx=>{_dCtx.beginPath();_dCtx.moveTo(cx+dx*s*.7,cy-s*.44);_dCtx.lineTo(cx,cy-s*.82);_dCtx.stroke();});
  // 환기창
  _dCtx.fillStyle='#2a1808';_drr(cx-s*.12,cy-s*.76,s*.24,s*.2,s*.06);_dCtx.fill();
}

// ── 연못/물가 테마 ──────────────────────────────────────────

// d_y29: 갈대 묶음 (1×1)
function _dReed(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.62,s*.44,s*.1,0,0,Math.PI*2);_dCtx.fill();
  // 줄기들
  [[0,0,'#8a7020'],[-s*.24,.04,'#9a7828'],[s*.22,.06,'#887020'],[-s*.12,s*.02,'#9a7828'],[s*.1,.08,'#807018']].forEach(([dx,bot,c])=>{
    _dCtx.strokeStyle=c;_dCtx.lineWidth=s*.08;
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+bot+s*.32);
    _dCtx.quadraticCurveTo(cx+dx+s*.06*(dx>0?1:-1),cy-s*.2,cx+dx+s*.04*(dx>0?1:-1),cy-s*.7);
    _dCtx.stroke();
  });
  // 이삭 (솜털)
  [[0,-s*.7,'#8a6018'],[-s*.22,-s*.64,'#9a7020'],[s*.2,-s*.68,'#887018'],[-s*.1,-s*.56,'#9a7020'],[s*.08,-s*.62,'#807018']].forEach(([dx,dy,c])=>{
    _dCtx.fillStyle=c;_drr(cx+dx-s*.04,cy+dy-s*.12,s*.08,s*.18,s*.04);_dCtx.fill();
    _dCtx.fillStyle='#c0a030';_drr(cx+dx-s*.02,cy+dy-s*.1,s*.04,s*.12,s*.02);_dCtx.fill();
  });
}

// d_y30: 징검돌 (1×1)
function _dSteppingStone(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.28)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.44,s*.58,s*.12,0,0,Math.PI*2);_dCtx.fill();
  // 납작한 돌 3개
  _dCtx.fillStyle='#7a7868';_dCtx.beginPath();_dCtx.ellipse(cx-s*.2,cy+s*.04,s*.36,s*.2,-.2,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#8a8878';_dCtx.beginPath();_dCtx.ellipse(cx-s*.22,cy-s*.02,s*.3,s*.15,-.2,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#6a6858';_dCtx.beginPath();_dCtx.ellipse(cx+s*.26,cy-s*.06,s*.32,s*.18,.2,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#8a8878';_dCtx.beginPath();_dCtx.ellipse(cx+s*.24,cy-s*.1,s*.26,s*.14,.2,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#7a7868';_dCtx.beginPath();_dCtx.ellipse(cx+s*.02,cy-s*.26,s*.26,s*.14,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#9a9888';_dCtx.beginPath();_dCtx.ellipse(cx,cy-s*.3,s*.2,s*.1,0,0,Math.PI*2);_dCtx.fill();
  // 이끼
  _dCtx.fillStyle='rgba(40,120,20,.5)';_dc(cx-s*.22,cy-.02*s,s*.06);_dCtx.fill();
  _dc(cx+s*.28,cy-s*.08,s*.05);_dCtx.fill();
}

// d_y31: 작은 연못 (3×3)
function _dSmallPond(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.25)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.9,s*.16,0,0,Math.PI*2);_dCtx.fill();
  // 테두리 — 불규칙한 돌 배치로 자연스럽게
  _dCtx.fillStyle='#6a6858';_dCtx.beginPath();_dCtx.ellipse(cx-s*.06,cy+s*.16,s*.9,s*.58,-.08,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#7a7868';_dCtx.beginPath();_dCtx.ellipse(cx+s*.04,cy+s*.1,s*.84,s*.54,.06,0,Math.PI*2);_dCtx.fill();
  // 테두리 돌들 (불규칙)
  _dCtx.fillStyle='#6a6858';
  [[-s*.8,s*.2,s*.18,s*.1,-.3],[s*.76,s*.0,s*.2,s*.11,.2],
   [-s*.56,s*.5,s*.22,s*.1,-.1],[s*.52,s*.46,s*.2,s*.1,.15],
   [s*.02,s*.56,s*.26,s*.12,0],[s*.0,-s*.36,s*.22,s*.1,0]].forEach(([dx,dy,rx,ry,rot])=>{
    _dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy,rx,ry,rot,0,Math.PI*2);_dCtx.fill();
  });
  // 물 — 채도 낮춘 회청색
  _dCtx.fillStyle='#2a6882';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.06,s*.72,s*.46,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#347898';_dCtx.beginPath();_dCtx.ellipse(cx-s*.04,cy-s*.02,s*.66,s*.42,0,0,Math.PI*2);_dCtx.fill();
  // 물 반짝임 (약하게, 불규칙)
  _dCtx.fillStyle='rgba(255,255,255,.14)';_dCtx.beginPath();_dCtx.ellipse(cx-s*.2,cy-s*.12,s*.2,s*.07,-.25,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='rgba(255,255,255,.09)';_dCtx.beginPath();_dCtx.ellipse(cx+s*.18,cy+s*.08,s*.12,s*.05,.2,0,Math.PI*2);_dCtx.fill();
  // 연꽃 잎 (녹색 큰 잎 + 분홍 꽃)
  [[-s*.22,-s*.14,'#f08878'],[s*.2,-s*.04,'#e8a088'],[s*.0,s*.18,'#d8b898']].forEach(([dx,dy,c])=>{
    _dCtx.fillStyle='#2a7018';_dCtx.beginPath();_dCtx.ellipse(cx+dx,cy+dy,s*.13,s*.09,dx*.3,0,Math.PI*2);_dCtx.fill();
    _dCtx.fillStyle=c;_dc(cx+dx,cy+dy,s*.07);_dCtx.fill();
    _dCtx.fillStyle='rgba(255,220,160,.7)';_dc(cx+dx,cy+dy,s*.03);_dCtx.fill();
  });
  // 갈대 (가장자리 자연스럽게)
  [[-s*.72,s*.12],[-s*.48,s*.5],[s*.6,-s*.06]].forEach(([dx,dy])=>{
    _dCtx.strokeStyle='#7a6818';_dCtx.lineWidth=s*.05;
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy+dy+s*.22);
    _dCtx.quadraticCurveTo(cx+dx+s*.04*(dx>0?1:-1),cy+dy,cx+dx+s*.02*(dx>0?1:-1),cy+dy-s*.3);_dCtx.stroke();
    _dCtx.fillStyle='#9a8820';_drr(cx+dx-s*.03,cy+dy-s*.32,s*.06,s*.13,s*.03);_dCtx.fill();
  });
}

// d_y32: 오리 가족 (2×1)
function _dDuckFamily(cx,cy,s){
  // 바닥 그림자
  _dCtx.fillStyle='rgba(0,0,0,.2)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.58,s*.76,s*.12,0,0,Math.PI*2);_dCtx.fill();
  // 물 영역 (2×1 칸 전체에 걸쳐 넓게)
  _dCtx.fillStyle='#2a6882';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.42,s*.8,s*.28,0,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#347898';_dCtx.beginPath();_dCtx.ellipse(cx-s*.04,cy+s*.36,s*.74,s*.24,0,0,Math.PI*2);_dCtx.fill();
  // 물 잔물결
  _dCtx.strokeStyle='rgba(255,255,255,.18)';_dCtx.lineWidth=s*.04;
  _dCtx.beginPath();_dCtx.moveTo(cx-s*.42,cy+s*.36);_dCtx.quadraticCurveTo(cx-s*.2,cy+s*.28,cx,cy+s*.36);_dCtx.stroke();
  _dCtx.beginPath();_dCtx.moveTo(cx+s*.1,cy+s*.42);_dCtx.quadraticCurveTo(cx+s*.34,cy+s*.34,cx+s*.58,cy+s*.42);_dCtx.stroke();

  // ── 엄마 오리 (왼쪽, 크게) ──
  // 몸통
  _dCtx.fillStyle='#c8a018';_dCtx.beginPath();_dCtx.ellipse(cx-s*.38,cy+s*.14,s*.32,s*.22,-.1,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#e0b820';_dCtx.beginPath();_dCtx.ellipse(cx-s*.4,cy+s*.1,s*.28,s*.19,-.1,0,Math.PI*2);_dCtx.fill();
  // 날개 (어두운 갈색)
  _dCtx.fillStyle='#a07808';_dCtx.beginPath();_dCtx.ellipse(cx-s*.38,cy+s*.14,s*.28,s*.16,-.1,0,Math.PI);_dCtx.fill();
  // 목+머리
  _dCtx.fillStyle='#c8a018';_drr(cx-s*.6,cy-s*.14,s*.14,s*.32,s*.07);_dCtx.fill();
  _dCtx.fillStyle='#1a3a10';_dc(cx-s*.58,cy-s*.22,s*.18);_dCtx.fill(); // 머리 (초록 광택)
  _dCtx.fillStyle='#2a5a18';_dc(cx-s*.6,cy-s*.26,s*.14);_dCtx.fill();
  // 부리
  _dCtx.fillStyle='#e07020';_drr(cx-s*.74,cy-s*.26,s*.18,s*.08,s*.04);_dCtx.fill();
  // 눈
  _dCtx.fillStyle='#fff';_dc(cx-s*.62,cy-s*.3,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#1a1a1a';_dc(cx-s*.62,cy-s*.3,s*.03);_dCtx.fill();

  // ── 아기 오리 1 (중간) ──
  _dCtx.fillStyle='#e8c820';_dCtx.beginPath();_dCtx.ellipse(cx+s*.1,cy+s*.2,s*.22,s*.16,-.05,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#f0d030';_dCtx.beginPath();_dCtx.ellipse(cx+s*.08,cy+s*.16,s*.18,s*.13,-.05,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#f0d030';_dc(cx-s*.04,cy+s*.08,s*.14);_dCtx.fill();
  _dCtx.fillStyle='#e07020';_drr(cx-s*.16,cy+s*.06,s*.14,s*.07,s*.03);_dCtx.fill();
  _dCtx.fillStyle='#1a1a1a';_dc(cx-s*.08,cy+s*.04,s*.025);_dCtx.fill();

  // ── 아기 오리 2 (오른쪽) ──
  _dCtx.fillStyle='#e8c820';_dCtx.beginPath();_dCtx.ellipse(cx+s*.5,cy+s*.24,s*.2,s*.15,-.05,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#f0d030';_dCtx.beginPath();_dCtx.ellipse(cx+s*.48,cy+s*.2,s*.16,s*.12,-.05,0,Math.PI*2);_dCtx.fill();
  _dCtx.fillStyle='#f0d030';_dc(cx+s*.36,cy+s*.13,s*.12);_dCtx.fill();
  _dCtx.fillStyle='#e07020';_drr(cx+s*.26,cy+s*.11,s*.12,s*.06,s*.03);_dCtx.fill();
}

// ── 건물 테마 ───────────────────────────────────────────────

// d_y33: 나무 오두막 (2×2)
function _dWoodCabin(cx,cy,s){
  _dCtx.fillStyle='rgba(0,0,0,.28)';_dCtx.beginPath();_dCtx.ellipse(cx,cy+s*.72,s*.84,s*.16,0,0,Math.PI*2);_dCtx.fill();
  // 기단
  _dCtx.fillStyle='#8a8070';_drr(cx-s*.74,cy+s*.32,s*1.48,s*.42,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#aaa090';_drr(cx-s*.7,cy+s*.28,s*1.4,s*.28,s*.04);_dCtx.fill();
  // 벽
  _dCtx.fillStyle='#8B5020';_drr(cx-s*.72,cy-s*.42,s*1.44,s*.74,s*.06);_dCtx.fill();
  _dCtx.fillStyle='#A06030';_drr(cx-s*.68,cy-s*.46,s*1.36,s*.62,s*.05);_dCtx.fill();
  // 통나무 줄 (가로)
  _dCtx.strokeStyle='#7a4810';_dCtx.lineWidth=s*.04;
  [-s*.22,s*.04,s*.3].forEach(dy=>{_dCtx.beginPath();_dCtx.moveTo(cx-s*.68,cy+dy);_dCtx.lineTo(cx+s*.68,cy+dy);_dCtx.stroke();});
  // 창문 (2개)
  [[-s*.36],[s*.36]].forEach(dx=>{
    _dCtx.fillStyle='#1a3a5a';_drr(cx+dx-s*.2,cy-s*.38,s*.4,s*.34,s*.05);_dCtx.fill();
    _dCtx.fillStyle='rgba(135,206,235,.55)';_drr(cx+dx-s*.18,cy-s*.36,s*.36,s*.3,s*.04);_dCtx.fill();
    _dCtx.strokeStyle='#8a6030';_dCtx.lineWidth=s*.04;_dCtx.strokeRect(cx+dx-s*.18,cy-s*.36,s*.36,s*.3);
    _dCtx.beginPath();_dCtx.moveTo(cx+dx,cy-s*.36);_dCtx.lineTo(cx+dx,cy-s*.06);_dCtx.stroke();
    _dCtx.beginPath();_dCtx.moveTo(cx+dx-s*.18,cy-s*.22);_dCtx.lineTo(cx+dx+s*.18,cy-s*.22);_dCtx.stroke();
  });
  // 문
  _dCtx.fillStyle='#5a3010';_drr(cx-s*.14,cy-s*.16,s*.28,s*.46,s*.05);_dCtx.fill();
  _dCtx.fillStyle='#7a4820';_drr(cx-s*.12,cy-s*.14,s*.24,s*.38,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#FFD700';_dc(cx+s*.08,cy+s*.08,s*.04);_dCtx.fill();
  // 지붕
  _dCtx.fillStyle='#4a3010';_dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.9);_dCtx.lineTo(cx-s*.82,cy-s*.42);_dCtx.lineTo(cx+s*.82,cy-s*.42);_dCtx.closePath();_dCtx.fill();
  _dCtx.fillStyle='#6a4a20';_dCtx.beginPath();_dCtx.moveTo(cx,cy-s*.8);_dCtx.lineTo(cx-s*.74,cy-s*.42);_dCtx.lineTo(cx+s*.74,cy-s*.42);_dCtx.closePath();_dCtx.fill();
  // 지붕 처마
  _dCtx.fillStyle='#3a2008';_drr(cx-s*.86,cy-s*.5,s*1.72,s*.1,s*.03);_dCtx.fill();
  // 굴뚝
  _dCtx.fillStyle='#6a5040';_drr(cx+s*.42,cy-s*.92,s*.2,s*.52,s*.04);_dCtx.fill();
  _dCtx.fillStyle='#8a7060';_drr(cx+s*.4,cy-s*.94,s*.16,s*.1,s*.03);_dCtx.fill();
  // 연기
  _dCtx.fillStyle='rgba(200,200,200,.3)';_dc(cx+s*.5,cy-s*1.0,s*.08);_dCtx.fill();
  _dc(cx+s*.46,cy-s*1.12,s*.06);_dCtx.fill();
  _dc(cx+s*.52,cy-s*1.22,s*.05);_dCtx.fill();
}
const _DFN = {
  // 마당
  d_y1:_dRose,         // 장미 꽃밭
  d_y2:_dTulip,        // 튤립
  d_y3:_dCactus,       // 선인장
  d_y4:_dStone,        // 정원석
  d_y5:_dBench,        // 정원 벤치
  d_y6:_dLantern,      // 가로등
  d_y7:_dSunflower,    // 해바라기 화단
  d_y8:_dScarecrow,    // 허수아비
  d_y9:_dTree,         // 작은 나무
  d_y10:_dFountain,    // 분수
  d_y11:_dWindmill,    // 풍차
  d_y12:_dCherryTree,  // 벚나무
  d_y13:_dMagicStone,  // 마법 정원석
  d_y14:_dGoldenLantern, // 황금 석등
  // 집 안
  d_i1:_dPlant,        // 화분
  d_i2:_dLamp,         // 램프
  d_i3:_dClock,        // 시계
  d_i4:_dFrame,        // 그림 액자
  d_i5:_dDesk,         // 책상
  d_i6:_dBookshelf,    // 책장
  d_i7:_dTV,           // TV
  d_i8:_dSofa,         // 소파
  d_i9:_dPiano,        // 피아노
  d_i10:_dBed,         // 침대
  d_i11:_dAquarium,    // 수족관
  d_i12:_dGoldenShelf, // 황금 책장
  d_i13:_dMirror,      // 마법 거울
  d_i14:_dThrone,      // 왕의 의자
  // 업적 전용
  deco_trophy:_dTrophy,
  deco_bookshelf:_dGoldenShelf,
  deco_garden:_dCherryTree,
  // ── 공원/정원 테마 ─────────────────────────────────
  d_y15:_dBush,              // 낮은 관목
  d_y16:_dLargePlanter,      // 큰 화단
  d_y17:_dGazebo,            // 정자
  d_y18:_dStoneBench,        // 돌 벤치
  d_y19:_dTreeB,             // 큰 나무 B
  d_y20:_dOrnamentalFountain,// 조형 분수
  d_y21:_dRoseArch,          // 장미 아치
  // ── 농촌 테마 ──────────────────────────────────────
  d_y22:_dWoodenCrate,       // 나무상자
  d_y23:_dLogPile,           // 장작더미
  d_y24:_dHayBale,           // 건초더미
  d_y25:_dWheatField,        // 밀밭
  d_y26:_dLargeRock,         // 큰 바위
  d_y27:_dWell,              // 우물
  d_y28:_dBarn,              // 헛간
  // ── 연못/물가 테마 ────────────────────────────────
  d_y29:_dReed,              // 갈대 묶음
  d_y30:_dSteppingStone,     // 징검돌
  d_y32:_dDuckFamily,        // 오리 가족
  // ── 건물 테마 ──────────────────────────────────────
  d_y33:_dWoodCabin,         // 나무 오두막
  // ── 2차: 건물 ─────────────────────────────────────────
  d_y34:_dSmallShed,         // 작은 창고
  // ── 2차: 농촌 심화 ────────────────────────────────────
  d_y35:_dWheatFieldB,       // 밀밭 B형
  d_y36:_dBarleyField,       // 보리밭
  d_y37:_dLogPileB,          // 장작더미 B형
  d_y38:_dLargeRockB,        // 큰 바위 B형
  // ── 2차: 정적 동물 ────────────────────────────────────
  d_y39:_dChickens,          // 닭 3마리
  d_y40:_dSheep,             // 양
  // ── 2차: 꽃 다양화 ────────────────────────────────────
  d_y41:_dLavender,          // 라벤더
  d_y42:_dDaisy,             // 데이지
  d_y43:_dRoseB,             // 장미 B형
  d_y44:_dTulipB,            // 튤립 B형
  // ── 2차: 식생/나무 ────────────────────────────────────
  d_y45:_dTallGrass,         // 키 큰 풀숲
  d_y46:_dConifer,           // 작은 침엽수
  d_y47:_dRoundTreeB,        // 둥근 나무 B형
  d_y48:_dOrchard,           // 과수나무
  // ── 목재 울타리 4종 ────────────────────────────────────
  d_y49:_dFenceHorz,         // 울타리 가로형
  d_y50:_dFenceVert,         // 울타리 세로형
  d_y51:_dFenceCornerL,      // 울타리 왼쪽 코너
  d_y52:_dFenceCornerR,      // 울타리 오른쪽 코너
};

// ── 메인 렌더 ──
function renderHouseDeco() {
  _initDeco();
  _drawDeco();
  renderDecoInv();
  if (_ifMode) { ifSyncScene(); ifSyncInv(); }
}

function _initDeco() {
  const containerId = _ifActiveContainer || 'house-topview';
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!_dCv) {
    el.innerHTML = '';
    _dCv = document.createElement('canvas');
    _dCv.id = 'deco-canvas';
    _dCv.style.cssText = 'display:block;cursor:pointer;touch-action:none';
    el.appendChild(_dCv);
    // 터치: touchstart로 처리 + preventDefault로 click 중복 차단
    _dCv.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      _decoClick({ clientX: t.clientX, clientY: t.clientY, target: e.target });
    }, { passive: false });
    // 마우스(PC)용
    _dCv.addEventListener('click', _decoClick);
  }
  // 전체화면 모드면 window 크기 직접 사용, 아니면 컨테이너 너비
  let W, maxH;
  if (_ifMode) {
    // 상단바(~50px) + 바닥타일줄(~48px, 바닥모드일 때) + 하단인벤(~120px) 제외
    const topH = DECO_MODE === 'floor' ? 98 : 50;
    W    = window.innerWidth;
    maxH = window.innerHeight - topH - 120;
  } else {
    W    = el.offsetWidth || 340;
    maxH = 600;
  }
  const cols = DECO_SCENE === 'yard' ? DY.cols : DI.cols;
  const rows = DECO_SCENE === 'yard' ? DY.rows : DI.rows;
  const C = Math.floor(W / cols);
  const H = Math.min(C * rows, maxH);
  _dW = W; _dH = H; _dC = C;
  _dCv.width  = W * 2;
  _dCv.height = H * 2;
  _dCv.style.width  = W + 'px';
  _dCv.style.height = H + 'px';
  _dCtx = _dCv.getContext('2d');
  _dCtx.scale(2, 2);
}

let _drawDecoRaf = null;
function _drawDeco() {
  if (!_dCtx) return;
  if (_drawDecoRaf) return; // 이미 RAF 예약됨 — 중복 방지
  _drawDecoRaf = requestAnimationFrame(() => {
    _drawDecoRaf = null;
    if (!_dCtx) return;
    _dCtx.clearRect(0, 0, _dW, _dH);
    if (DECO_SCENE === 'yard') _drawYard();
    else _drawIndoor();
  });
}

function _drawYard() {
  const C = _dC, W = _dW, H = _dH;
  const hx = (DY.cols - DH.cols) * C, hh = DH.rows * C, hw = DH.cols * C;

  // 셀별 바닥 타일
  for(let r=0;r<DY.rows;r++) for(let c=0;c<DY.cols;c++){
    if(_isHC(r,c)) continue;
    const tkey = r+'_'+c;
    const ttype = (CUR.yardFloor||{})[tkey]||'grass';
    const tile = FLOOR_TILES[ttype]||FLOOR_TILES.grass;
    _dCtx.fillStyle = (r+c)%2===0 ? tile.bg : tile.alt;
    _dCtx.fillRect(c*C, r*C, C, C);
    _drawTileTexture(ttype, c, r, C);
  }
  // 나무 타일은 가로줄 추가 (무늬) — texture 함수로 통합했으므로 기존 loop 삭제

  // ══════════════════════════════════════════════════════
  // 집 건물 (우상단, DH: 6칸×3칸)
  // ══════════════════════════════════════════════════════
  {
    const lx=hx, ly=0, lw=hw, lh=hh; // left-x, top-y, width, height

    // ── 지붕 (삼각 + 처마) ────────────────────────────────
    // 처마 그림자
    _dCtx.fillStyle='rgba(0,0,0,.22)';
    _dCtx.fillRect(lx, lh - C*2.05, lw, C*.12);
    // 지붕 본체 (짙은 회청 기와 느낌)
    _dCtx.fillStyle='#3a4a58';
    _dCtx.beginPath();
    _dCtx.moveTo(lx-C*.1, lh-C*2.0);
    _dCtx.lineTo(lx+lw/2, ly+C*.05);
    _dCtx.lineTo(lx+lw+C*.1, lh-C*2.0);
    _dCtx.closePath(); _dCtx.fill();
    // 지붕 밝은 면
    _dCtx.fillStyle='#4a5e70';
    _dCtx.beginPath();
    _dCtx.moveTo(lx+lw*.1, lh-C*2.0);
    _dCtx.lineTo(lx+lw/2, ly+C*.1);
    _dCtx.lineTo(lx+lw*.9, lh-C*2.0);
    _dCtx.closePath(); _dCtx.fill();
    // 지붕 능선
    _dCtx.strokeStyle='#2a3848'; _dCtx.lineWidth=C*.08;
    _dCtx.beginPath(); _dCtx.moveTo(lx+lw*.2,lh-C*2.0); _dCtx.lineTo(lx+lw/2,ly+C*.1); _dCtx.stroke();
    _dCtx.beginPath(); _dCtx.moveTo(lx+lw*.8,lh-C*2.0); _dCtx.lineTo(lx+lw/2,ly+C*.1); _dCtx.stroke();
    _dCtx.beginPath(); _dCtx.moveTo(lx+lw*.5,lh-C*2.0); _dCtx.lineTo(lx+lw/2,ly+C*.1); _dCtx.stroke();
    // 처마 (지붕 하단 돌출)
    _dCtx.fillStyle='#2e3c4a';
    _dCtx.fillRect(lx-C*.05, lh-C*2.08, lw+C*.1, C*.14);
    _dCtx.fillStyle='#4a5e70';
    _dCtx.fillRect(lx-C*.05, lh-C*2.08, lw+C*.1, C*.06);
    // 굴뚝
    _dCtx.fillStyle='#5a4830';
    _dCtx.fillRect(lx+lw*.7, ly+C*.18, C*.4, C*.6);
    _dCtx.fillStyle='#7a6848';
    _dCtx.fillRect(lx+lw*.7, ly+C*.18, C*.4, C*.12);
    _dCtx.fillStyle='#3a2818';
    _dCtx.fillRect(lx+lw*.68, ly+C*.12, C*.44, C*.1);
    // 굴뚝 연기 (약하게)
    _dCtx.fillStyle='rgba(200,200,200,.18)';
    _dc(lx+lw*.9, ly+C*.05, C*.12); _dCtx.fill();
    _dc(lx+lw*.88, ly-C*.04, C*.09); _dCtx.fill();
    _dCtx.fillStyle='rgba(200,200,200,.12)';
    _dc(lx+lw*.92, ly-C*.12, C*.07); _dCtx.fill();

    // ── 벽면 ─────────────────────────────────────────────
    // 기본 벽 (따뜻한 베이지/크림)
    _dCtx.fillStyle='#c8a878';
    _dCtx.fillRect(lx, lh-C*2.0, lw, C*2.0);
    // 벽 밝은 톤
    _dCtx.fillStyle='#d4b888';
    _dCtx.fillRect(lx+C*.06, lh-C*1.94, lw-C*.12, C*.9);
    // 허리 띠 (처마 아래 줄 → 분할감)
    _dCtx.fillStyle='#a88050';
    _dCtx.fillRect(lx, lh-C*1.06, lw, C*.06);
    // 하단 기단 (어두운)
    _dCtx.fillStyle='#8a6840';
    _dCtx.fillRect(lx, lh-C*.28, lw, C*.28);
    _dCtx.fillStyle='#a08058';
    _dCtx.fillRect(lx, lh-C*.28, lw, C*.1);
    // 세로 판자선 (벽 분할)
    _dCtx.strokeStyle='rgba(0,0,0,.08)'; _dCtx.lineWidth=C*.04;
    [lw/3, lw*2/3].forEach(ox=>{
      _dCtx.beginPath(); _dCtx.moveTo(lx+ox, lh-C*1.94); _dCtx.lineTo(lx+ox, lh-C*.28); _dCtx.stroke();
    });

    // ── 창문 2개 ─────────────────────────────────────────
    [[lx+C*.3, lh-C*1.82],[lx+lw-C*1.3, lh-C*1.82]].forEach(([wx,wy])=>{
      const ww=C*.88, wh=C*.68;
      // 창틀 외부
      _dCtx.fillStyle='#7a5828'; _drr(wx-C*.05,wy-C*.05,ww+C*.1,wh+C*.1,4); _dCtx.fill();
      // 유리
      _dCtx.fillStyle='#a8d4e8'; _dCtx.globalAlpha=.8;
      _drr(wx,wy,ww,wh,3); _dCtx.fill(); _dCtx.globalAlpha=1;
      // 창틀 십자
      _dCtx.strokeStyle='#7a5828'; _dCtx.lineWidth=C*.06;
      _dCtx.beginPath(); _dCtx.moveTo(wx+ww/2,wy); _dCtx.lineTo(wx+ww/2,wy+wh); _dCtx.stroke();
      _dCtx.beginPath(); _dCtx.moveTo(wx,wy+wh/2); _dCtx.lineTo(wx+ww,wy+wh/2); _dCtx.stroke();
      // 창문 반사 (하이라이트)
      _dCtx.fillStyle='rgba(255,255,255,.28)';
      _drr(wx+C*.04,wy+C*.04,ww*.4,wh*.35,2); _dCtx.fill();
      // 창틀 상단 장식
      _dCtx.fillStyle='#8a6838'; _drr(wx-C*.05,wy-C*.12,ww+C*.1,C*.1,2); _dCtx.fill();
      // 창 밖 화분 (왼쪽 창에만)
      if(wx < lx+lw/2){
        _dCtx.fillStyle='#a05020'; _drr(wx+ww*.1,wy+wh+C*.02,ww*.35,C*.1,2); _dCtx.fill();
        _dCtx.fillStyle='#2a7810'; _dc(wx+ww*.27,wy+wh+C*.0,C*.08); _dCtx.fill();
      }
    });

    // ── 문 (중앙, 크고 명확하게) ─────────────────────────
    const doorW=C*.88, doorH=C*1.05;
    const doorX=lx+lw/2-doorW/2, doorY=lh-C*.28-doorH;
    // 현관 계단
    _dCtx.fillStyle='#9a8868'; _drr(doorX-C*.14,lh-C*.1,doorW+C*.28,C*.1,2); _dCtx.fill();
    _dCtx.fillStyle='#b0a07a'; _drr(doorX-C*.08,lh-C*.2,doorW+C*.16,C*.12,2); _dCtx.fill();
    _dCtx.fillStyle='#c4b48e'; _drr(doorX-C*.02,lh-C*.3,doorW+C*.04,C*.12,2); _dCtx.fill();
    // 현관등
    _dCtx.fillStyle='#c8a030'; _drr(doorX+doorW+C*.06,doorY+C*.08,C*.14,C*.22,2); _dCtx.fill();
    _dCtx.fillStyle='rgba(255,220,100,.7)'; _dc(doorX+doorW+C*.13,doorY+C*.16,C*.07); _dCtx.fill();
    _dCtx.fillStyle='rgba(255,220,100,.3)'; _dc(doorX+doorW+C*.13,doorY+C*.16,C*.14); _dCtx.fill();
    // 문 틀
    _dCtx.fillStyle='#5a3a10'; _drr(doorX-C*.08,doorY-C*.06,doorW+C*.16,doorH+C*.06,5); _dCtx.fill();
    // 문 본체
    _dCtx.fillStyle='#6b4820'; _drr(doorX,doorY,doorW,doorH,4); _dCtx.fill();
    _dCtx.fillStyle='#7e5828'; _drr(doorX,doorY,doorW,doorH*.45,4); _dCtx.fill();
    // 문 패널 장식
    _dCtx.fillStyle='#5a3810';
    _drr(doorX+C*.08,doorY+C*.06,doorW-C*.16,doorH*.36,3); _dCtx.fill();
    _drr(doorX+C*.08,doorY+doorH*.46,doorW-C*.16,doorH*.46,3); _dCtx.fill();
    _dCtx.fillStyle='rgba(255,200,100,.08)';
    _drr(doorX+C*.1,doorY+C*.08,doorW-C*.2,doorH*.3,2); _dCtx.fill();
    // 문 손잡이
    _dCtx.fillStyle='#d4a820'; _dc(doorX+doorW*.72,doorY+doorH*.52,C*.07); _dCtx.fill();
    _dCtx.fillStyle='#f0c030'; _dc(doorX+doorW*.72,doorY+doorH*.52,C*.045); _dCtx.fill();
    // 우체통 (문 왼쪽)
    _dCtx.fillStyle='#b82020'; _drr(doorX-C*.44,lh-C*.54,C*.24,C*.26,2); _dCtx.fill();
    _dCtx.fillStyle='#d83030'; _drr(doorX-C*.44,lh-C*.54,C*.24,C*.1,2); _dCtx.fill();
    _dCtx.fillStyle='#902010'; _drr(doorX-C*.46,lh-C*.56,C*.28,C*.06,2); _dCtx.fill();
    // 우체통 기둥
    _dCtx.fillStyle='#606060'; _drr(doorX-C*.34,lh-C*.28,C*.06,C*.28,2); _dCtx.fill();
    // 들어가기 텍스트
    _dCtx.fillStyle='rgba(255,255,255,.65)'; _dCtx.font=`500 ${Math.max(C*.17,8)}px sans-serif`; _dCtx.textAlign='center';
    _dCtx.fillText('들어가기', doorX+doorW/2, doorY-C*.14);

    // ── 집 이름 (지붕 위) ────────────────────────────────
    _dCtx.fillStyle='rgba(255,255,255,.7)'; _dCtx.font=`700 ${Math.max(C*.22,10)}px sans-serif`; _dCtx.textAlign='center';
    _dCtx.fillText(CUR.name ? `🏠 ${CUR.name}의 집` : '🏠 내 집', lx+lw/2, lh-C*2.24);

    // ── 경계선 ────────────────────────────────────────────
    _dCtx.strokeStyle='#3a2808'; _dCtx.lineWidth=2.5;
    _dCtx.beginPath(); _dCtx.moveTo(hx,0); _dCtx.lineTo(hx,hh); _dCtx.stroke();
    _dCtx.beginPath(); _dCtx.moveTo(hx,hh); _dCtx.lineTo(W,hh); _dCtx.stroke();
  }

  // 격자 (집 영역 제외)
  _dCtx.strokeStyle='rgba(255,255,255,.12)'; _dCtx.lineWidth=.5;
  for(let r=0;r<=DY.rows;r++){
    _dCtx.beginPath();
    if(r<=DH.rows){ _dCtx.moveTo(0,r*C); _dCtx.lineTo(hx,r*C); }
    else { _dCtx.moveTo(0,r*C); _dCtx.lineTo(W,r*C); }
    _dCtx.stroke();
  }
  for(let c=0;c<=DY.cols;c++){
    const x=c*C; _dCtx.beginPath();
    if(x>hx){ _dCtx.moveTo(x,hh); _dCtx.lineTo(x,H); }
    else { _dCtx.moveTo(x,0); _dCtx.lineTo(x,H); }
    _dCtx.stroke();
  }

  // 선택 하이라이트 (장식 모드 vs 바닥 모드)
  if(DECO_MODE==='floor'){
    for(let r=0;r<DY.rows;r++) for(let c=0;c<DY.cols;c++){
      if(_isHC(r,c)) continue;
      _dCtx.strokeStyle='rgba(255,255,255,.18)'; _dCtx.lineWidth=.5;
      _dCtx.strokeRect(c*C+.5,r*C+.5,C-1,C-1);
    }
  } else if(SEL_DECO) {
    const sd = GAME_DATA.decorations.find(x=>x.id===SEL_DECO);
    if(sd?.cat==='yard') {
      const ssz = sd.size||{w:1,h:1};
      // 빈 칸마다 footprint 프리뷰 표시
      for(let r=0;r<DY.rows;r++) for(let c=0;c<DY.cols;c++){
        if(_isHC(r,c)) continue;
        if(canPlaceDeco(r,c,ssz.w,ssz.h,'yard',null)){
          // 배치 가능한 footprint 영역 강조
          _dCtx.fillStyle='rgba(255,255,255,.1)';
          _dCtx.fillRect(c*C+1,r*C+1,ssz.w*C-2,ssz.h*C-2);
          _dCtx.strokeStyle='rgba(255,255,150,.35)'; _dCtx.lineWidth=1;
          _dCtx.strokeRect(c*C+1,r*C+1,ssz.w*C-2,ssz.h*C-2);
        }
      }
    }
  }

  // 배치된 마당 장식 - footprint 전체를 채우는 bounding box 렌더
  (CUR.houseDecorations||[]).filter(p=>p.area==='yard').forEach(p=>{
    const fn=_DFN[p.id], d=GAME_DATA.decorations.find(x=>x.id===p.id);
    if(!d) return;
    const sz=d.size||{w:1,h:1};
    const px=p.col*C, py=p.row*C;
    const bw=sz.w*C, bh=sz.h*C;
    const cx=px+bw/2, cy=py+bh/2;
    // s = bounding box의 절반 (fn 함수는 ±s 범위로 그림)
    const s = Math.min(bw, bh) * 0.62;
    if(fn){
      // 멀티셀이면 bounding box 크기에 맞게 scale 변환
      if(sz.w>1||sz.h>1){
        _dCtx.save();
        _dCtx.translate(cx, cy);
        _dCtx.scale(sz.w > sz.h ? sz.w/sz.h : 1, sz.h > sz.w ? sz.h/sz.w : 1);
        fn(0, 0, s);
        _dCtx.restore();
      } else {
        fn(cx, cy, s);
      }
      return;
    }
    // 커스텀 함수 없는 경우 - offscreen canvas로 bounding box 채우기
    const oc=document.createElement('canvas');
    const base=Math.max(bw,bh)*2;
    oc.width=oc.height=base;
    const ox=oc.getContext('2d');
    ox.font=`${base*0.85}px sans-serif`;
    ox.textAlign='center'; ox.textBaseline='middle';
    ox.fillText(d.icon,base/2,base/2);
    const pad=2;
    _dCtx.drawImage(oc, px+pad, py+pad, bw-pad*2, bh-pad*2);
  });

  // 문 클릭 좌표 저장 (새 문 위치 기준)
  {
    const _hw=hw, _hh=hh, _hx=hx;
    const _doorW=C*.88, _doorH=C*1.05;
    const _doorX=_hx+_hw/2-_doorW/2, _doorY=_hh-C*.28-_doorH;
    _dCv._doorX=_doorX; _dCv._doorY=_doorY; _dCv._doorW=_doorW; _dCv._doorH=_doorH;
  }
  _dCv._hx=hx; _dCv._hh=hh;

  // ── 마당 농장 존 렌더링 (우하단, 읽기 전용) ──────────────
  _drawYardFarm(C);
}

// ── 마당 농장 존 렌더 + 판정 헬퍼 ──────────────────────────
function _getFarmZone() {
  const {cols:fc, rows:fr} = getFarmLayout(CUR.level || 1);
  // DY.rows/cols 대신 실제 캔버스에 보이는 칸 수 기준
  const visibleCols = Math.floor(_dW / _dC);
  const visibleRows = Math.floor(_dH / _dC);
  const startCol = visibleCols - fc - 1;
  const startRow = visibleRows - fr - 1;
  return { startCol, startRow, cols: fc, rows: fr };
}

function _isFarmCell(r, c) {
  const {startCol, startRow, cols, rows} = _getFarmZone();
  return r >= startRow && r < startRow + rows && c >= startCol && c < startCol + cols;
}

function _drawYardFarm(C) {
  const farm = CUR.farm || [];
  const {startCol, startRow, cols, rows} = _getFarmZone();
  const ctx = _dCtx;

  // 농장 외곽 배경
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(startCol*C - 2, startRow*C - 2, cols*C + 4, rows*C + 4);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const gc = startCol + c;
      const gr = startRow + r;
      const px = gc * C, py = gr * C;
      const slot = r * cols + c;
      const plot = farm.find(f => f.slot === slot);

      // ── 바닥: 항상 모래색 (체크무늬) ──
      ctx.fillStyle = (r + c) % 2 === 0 ? '#c8a855' : '#b89545';
      ctx.fillRect(px+1, py+1, C-2, C-2);

      if (plot) {
        const sd = Utils.getSeedByCrop(plot.crop);
        if (!sd) continue;
        const ready    = Utils.cropReady(plot.planted, sd.growHours);
        const elapsed  = Date.now() - plot.planted;
        const withered = ready && elapsed > sd.growHours * 3600000 * 3;
        const pct      = Utils.cropProgress(plot.planted, sd.growHours);

        // ── 수확 가능 시 살짝 밝은 오버레이 ──
        if (ready && !withered) {
          ctx.fillStyle = 'rgba(39,174,96,.25)';
          ctx.fillRect(px+1, py+1, C-2, C-2);
        }

        // ── 진행바 (하단) ──
        const barH = Math.max(2, C * .12);
        ctx.fillStyle = 'rgba(0,0,0,.3)';
        ctx.fillRect(px+1, py + C - barH - 1, C-2, barH);
        ctx.fillStyle = ready
          ? (withered ? '#a0806a' : '#2ecc71')
          : (plot.isMutant ? '#FFA500' : '#27ae60');
        ctx.fillRect(px+1, py + C - barH - 1, (C-2) * (pct/100), barH);

        // ── 작물 아이콘 ──
        const icon = withered ? '🍂' : ready ? sd.cropIcon : (plot.isMutant ? '⚡' : '🌱');
        const fs = Math.max(C * .55, 8);
        ctx.font = `${fs}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, px + C/2, py + C/2 - barH/2);
      }
    }
  }

  // 농장 테두리
  ctx.strokeStyle = 'rgba(255,180,0,.6)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(startCol*C, startRow*C, cols*C, rows*C);
  // 저장용
  _dCv._farmZone = {startCol, startRow, cols, rows};
}

function _drawIndoor() {
  const C = _dC, W = _dW, H = _dH;
  const offX = Math.floor((W - DI.cols*C)/2);
  const offY = Math.max(Math.floor(C*.9), Math.floor((H - DI.rows*C)/2));

  // 벽
  _dCtx.fillStyle='#8B6520'; _dCtx.fillRect(0,0,W,H);
  // 바닥
  _dCtx.fillStyle='#C4955A'; _dCtx.fillRect(offX,offY,DI.cols*C,DI.rows*C);
  for(let r=0;r<DI.rows;r++){_dCtx.fillStyle=r%2?'rgba(255,255,255,.03)':'rgba(0,0,0,.05)';_dCtx.fillRect(offX,offY+r*C,DI.cols*C,C);}

  // 창문 (위쪽 벽)
  if(offY > 14){
    const wh=Math.min(offY*.55, C*.7);
    [offX+C, offX+C*4.5, offX+C*8.5].forEach(wx=>{
      _dCtx.fillStyle='#87CEEB'; _dCtx.globalAlpha=.7;
      _drr(wx, offY*.28, C*.88, wh, 3); _dCtx.fill(); _dCtx.globalAlpha=1;
      _dCtx.strokeStyle='#5a3510'; _dCtx.lineWidth=1; _dCtx.strokeRect(wx, offY*.28, C*.88, wh);
      _dCtx.beginPath(); _dCtx.moveTo(wx+C*.44, offY*.28); _dCtx.lineTo(wx+C*.44, offY*.28+wh); _dCtx.stroke();
    });
  }

  // 격자
  _dCtx.strokeStyle='rgba(0,0,0,.1)'; _dCtx.lineWidth=.5;
  for(let c=0;c<=DI.cols;c++){_dCtx.beginPath();_dCtx.moveTo(offX+c*C,offY);_dCtx.lineTo(offX+c*C,offY+DI.rows*C);_dCtx.stroke();}
  for(let r=0;r<=DI.rows;r++){_dCtx.beginPath();_dCtx.moveTo(offX,offY+r*C);_dCtx.lineTo(offX+DI.cols*C,offY+r*C);_dCtx.stroke();}

  // 선택 하이라이트
  if(SEL_DECO && GAME_DATA.decorations.find(x=>x.id===SEL_DECO)?.cat==='indoor'){
    _dCtx.fillStyle='rgba(255,220,100,.09)';
    for(let r=0;r<DI.rows;r++) for(let c=0;c<DI.cols;c++){
      if(!(CUR.houseDecorations||[]).find(p=>p.area==='indoor'&&p.row===r&&p.col===c))
        _dCtx.fillRect(offX+c*C+1,offY+r*C+1,C-2,C-2);
    }
  }

  // 배치된 가구
  (CUR.houseDecorations||[]).filter(p=>p.area==='indoor').forEach(p=>{
    const fn=_DFN[p.id], d=GAME_DATA.decorations.find(x=>x.id===p.id);
    if(!d) return;
    const sz=d.size||{w:1,h:1};
    const px=offX+p.col*C, py=offY+p.row*C;
    const bw=sz.w*C, bh=sz.h*C;
    const cx=px+bw/2, cy=py+bh/2;
    const s = Math.min(bw, bh) * 0.62;
    if(fn){
      if(sz.w>1||sz.h>1){
        _dCtx.save();
        _dCtx.translate(cx, cy);
        _dCtx.scale(sz.w > sz.h ? sz.w/sz.h : 1, sz.h > sz.w ? sz.h/sz.w : 1);
        fn(0, 0, s);
        _dCtx.restore();
      } else {
        fn(cx, cy, s);
      }
    } else {
      const oc=document.createElement('canvas');
      const base=Math.max(bw,bh)*2;
      oc.width=oc.height=base;
      const ox=oc.getContext('2d');
      ox.font=`${base*0.85}px sans-serif`;
      ox.textAlign='center'; ox.textBaseline='middle';
      ox.fillText(d.icon,base/2,base/2);
      _dCtx.drawImage(oc, px+2, py+2, bw-4, bh-4);
    }
  });

  // 나가기 문
  const dx=offX+DI.cols*C/2-C*.35, dy=offY+DI.rows*C-C*.75;
  _dCtx.fillStyle='#5a3010'; _drr(dx,dy,C*.7,C*.75,3); _dCtx.fill();
  _dCtx.strokeStyle='#3a1e08'; _dCtx.lineWidth=1.5; _dCtx.strokeRect(dx,dy,C*.7,C*.75);
  _dCtx.fillStyle='#FFD700'; _dc(dx+C*.58,dy+C*.38,C*.07); _dCtx.fill();
  _dCtx.fillStyle='rgba(255,255,255,.72)'; _dCtx.font=`${Math.max(C*.18,8)}px sans-serif`; _dCtx.textAlign='center';
  _dCtx.fillText('나가기', dx+C*.35, dy-C*.1);

  _dCv._doorX=dx; _dCv._doorY=dy; _dCv._doorW=C*.7; _dCv._doorH=C*.75;
  _dCv._offX=offX; _dCv._offY=offY;
}

function _decoClick(e) {
  if(!_dCv||!_dCtx) return;
  const rect=_dCv.getBoundingClientRect();
  const mx=(e.clientX-rect.left)*(_dW/rect.width);
  const my=(e.clientY-rect.top)*(_dH/rect.height);
  const C=_dC;

  // 문 클릭 체크
  const {_doorX:dx,_doorY:dy,_doorW:dw,_doorH:dh}=_dCv;
  if(dx!==undefined&&mx>=dx&&mx<=dx+dw&&my>=dy&&my<=dy+dh){ toggleDecoScene(); return; }

  if(DECO_SCENE==='yard'){
    const c=Math.floor(mx/C), r=Math.floor(my/C);
    if(c<0||c>=DY.cols||r<0||r>=DY.rows) return;
    if(_isHC(r,c)){ toast('집 영역에는 배치할 수 없어요!'); return; }
    // 농장 존 클릭 차단 (수확은 농장 탭에서만)
    if(_isFarmCell(r,c)){ toast('🌾 수확은 농장 탭에서 해주세요!'); return; }
    if(DECO_MODE==='floor') { _paintFloor(r,c); return; }
    _decoPlace('yard',r,c);
  } else {
    const {_offX:ox,_offY:oy}=_dCv;
    const c=Math.floor((mx-ox)/C), r=Math.floor((my-oy)/C);
    if(c<0||c>=DI.cols||r<0||r>=DI.rows) return;
    _decoPlace('indoor',r,c);
  }
}

function _paintFloor(r, c) {
  CUR.yardFloor = CUR.yardFloor||{};
  const key = r+'_'+c;
  if(CUR.yardFloor[key] === CUR_FLOOR_TILE) {
    delete CUR.yardFloor[key]; // 같은 타일이면 기본(잔디)으로
  } else {
    CUR.yardFloor[key] = CUR_FLOOR_TILE;
  }
  DB.saveStudent(CUR);
  _drawDeco();
}

function _decoPlace(area,row,col){
  const placed=CUR.houseDecorations||[];

  // 클릭한 칸에 있는 장식 찾기 (멀티셀 고려)
  const existing=placed.find(p=>{
    if(p.area!==area) return false;
    const sz=getDecoSize(p.id);
    return row>=p.row&&row<p.row+sz.h&&col>=p.col&&col<p.col+sz.w;
  });
  if(existing){
    const d=GAME_DATA.decorations.find(x=>x.id===existing.id);
    CUR.houseDecorations=placed.filter(p=>!(p.area===area&&p.row===existing.row&&p.col===existing.col));
    DB.saveStudent(CUR); _drawDeco();
    toast(`${d?d.icon:'🌸'} 제거됨`); return;
  }
  if(!SEL_DECO){ toast('먼저 아래 장식품을 선택해주세요!'); return; }
  const d=GAME_DATA.decorations.find(x=>x.id===SEL_DECO);
  if(!d) return;
  if(d.cat!==area){ toast(`이 장식은 ${d.cat==='yard'?'🌿 마당':'🏠 집 안'}에만 배치할 수 있어요!`); return; }
  const sz=d.size||{w:1,h:1};
  const used=placed.filter(p=>p.id===SEL_DECO).length;
  const inv=(CUR.inventory||[]).find(i=>i.id===SEL_DECO);
  if(!inv||inv.qty-used<=0){ toast('보유 수량이 부족해요!'); return; }
  if(!canPlaceDeco(row,col,sz.w,sz.h,area,null)){ toast('여기엔 배치할 수 없어요!'); return; }
  CUR.houseDecorations=[...placed,{id:SEL_DECO,area,row,col}];
  DB.saveStudent(CUR); _drawDeco(); renderDecoInv();
  toast(`✅ ${d.icon} ${d.name} 배치!`);
}

function toggleDecoScene(){
  DECO_SCENE=DECO_SCENE==='yard'?'indoor':'yard';
  SEL_DECO=null;
  const isYard=DECO_SCENE==='yard';
  // 일반 모드 UI
  const sBtn = document.getElementById('deco-scene-btn');
  const sName = document.getElementById('deco-scene-name');
  const iLabel = document.getElementById('deco-inv-label');
  if(sBtn)   sBtn.textContent  = isYard?'🏠 집 안으로 →':'🌿 마당으로 ←';
  if(sName)  sName.textContent = isYard?'🌿 마당':'🏠 집 안';
  if(iLabel) iLabel.textContent= isYard?'🎒 보유 장식품':'🎒 보유 장식품 (집 안)';
  _dCv=null; _dCtx=null;
  renderHouseDeco();
  if(_ifMode) ifSyncScene();
  toast(isYard?'🌿 마당이에요! 집은 우상단 문으로 들어가요.':'🏠 집 안이에요! 나가기 문으로 마당에 나가요.');
}

function renderDecoInv(){
  const placed=CUR.houseDecorations||[];
  const inv=(CUR.inventory||[]).filter(i=>GAME_DATA.decorations.find(d=>d.id===i.id));
  const el=document.getElementById('house-deco-inv');
  if(!inv.length){
    el.innerHTML=`<div style="font-size:.78rem;color:var(--txt3)">보유한 장식품이 없어요. 상점에서 구매하세요! 🏪</div>`;
    if(_ifMode) ifSyncInv();
    return;
  }
  const RL={common:'⚪',rare:'🔵',epic:'🟣',legend:'🟡'};
  el.innerHTML=inv.map(i=>{
    const d=GAME_DATA.decorations.find(x=>x.id===i.id); if(!d) return '';
    const used=placed.filter(p=>p.id===i.id).length;
    const avail=i.qty-used;
    const isSel=SEL_DECO===i.id;
    const isMatch=d.cat===DECO_SCENE;
    const rl=RL[d.rarity||'common']||'';
    return `<div onclick="selectDeco('${i.id}')" style="
      background:${isSel?'rgba(255,215,0,.18)':'rgba(255,255,255,.05)'};
      border:2px solid ${isSel?'var(--gold)':isMatch?'rgba(255,255,255,.15)':'rgba(255,255,255,.06)'};
      border-radius:10px;padding:.45rem .6rem;cursor:${avail>0?'pointer':'default'};
      text-align:center;opacity:${avail>0?isMatch?1:.45:.25};min-width:58px;transition:all .2s;
      transform:${isSel?'scale(1.06)':'scale(1)'}">
      <div style="font-size:1.4rem">${d.icon}</div>
      <div style="font-size:.6rem;color:var(--txt2);margin-top:.1rem;line-height:1.2">${rl} ${d.name}</div>
      <div style="font-size:.58rem;margin-top:.08rem">${d.cat==='yard'?'🌿':'🏠'} ×${avail}</div>
    </div>`;
  }).join('');
  if(_ifMode) ifSyncInv();
}

function selectDeco(id){
  SEL_DECO=(SEL_DECO===id)?null:id;
  _drawDeco(); renderDecoInv();
  if(SEL_DECO){
    const d=GAME_DATA.decorations.find(x=>x.id===id);
    if(d&&d.cat!==DECO_SCENE) toast(`${d.icon} 이 장식은 ${d.cat==='yard'?'🌿 마당':'🏠 집 안'} 전용이에요!`);
    else toast(`${d?.icon} 선택됨 — 원하는 칸에 클릭!`);
  }
}

// 구버전 호환
function placeHouseDeco(id){ selectDeco(id); }
function removeHouseDeco(slot){
  const item=(CUR.houseDecorations||[]).find(p=>p.slot===slot||(p.col!==undefined&&p.col===slot%3));
  if(item) _decoPlace(item.area||'yard', item.row||0, item.col||0);
}
// ══ 작품 전시 (Storage 업로드) ══

// 이미지 미리보기
function previewArtwork(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  document.getElementById('aw-file-text').textContent = '📷 ' + file.name;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('aw-preview-img').src = e.target.result;
    document.getElementById('aw-preview-wrap').style.display = '';
  };
  reader.readAsDataURL(file);
}

// 이미지 리사이징 (최대 800px, 용량 절약)
function resizeImage(file, maxSize=800) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let {width, height} = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = height/width*maxSize; width = maxSize; }
          else { width = width/height*maxSize; height = maxSize; }
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.8);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// 작품 제출
async function submitArtwork() {
  const title   = document.getElementById('aw-title-input').value.trim();
  const desc    = document.getElementById('aw-desc-input').value.trim();
  const subject = document.getElementById('aw-subject-input').value || '';
  const fileInput = document.getElementById('aw-file-input');

  if (!title) { toast('작품 제목을 입력해주세요!'); return; }
  if (!fileInput.files || !fileInput.files[0]) { toast('사진을 선택해주세요!'); return; }

  // 중복 차단: 같은 제목으로 이미 대기중이거나 전시중인 작품
  const dupPending = (CUR.pendingRewards||[]).some(r => r.type==='artwork' && (r.artTitle||'').trim() === title.trim());
  const dupArtwork = DB.getArtworks(CUR.id).some(a => (a.title||a.artTitle||'').trim() === title.trim());
  if (dupPending) { toast(`🎨 "${title}"은 이미 승인 대기중이에요!`); return; }
  if (dupArtwork) { toast(`🎨 "${title}"은 이미 전시중인 작품이에요!`); return; }

  // 업로드 UI 표시
  document.getElementById('aw-upload-progress').style.display = '';
  document.getElementById('aw-progress-bar').style.width = '10%';
  document.getElementById('aw-progress-text').textContent = '이미지 압축 중...';

  try {
    // 이미지 리사이징
    const blob = await resizeImage(fileInput.files[0]);
    document.getElementById('aw-progress-bar').style.width = '30%';
    document.getElementById('aw-progress-text').textContent = '업로드 중...';

    // Firebase Storage 업로드
    const storage  = firebase.storage();
    const filename = `artworks/${CUR.id}_${Date.now()}.jpg`;
    const ref      = storage.ref(filename);
    const task     = ref.put(blob);

    task.on('state_changed',
      snap => {
        const pct = Math.round(30 + (snap.bytesTransferred/snap.totalBytes)*60);
        document.getElementById('aw-progress-bar').style.width = pct + '%';
      },
      err => {
        console.error(err);
        toast('업로드 실패: ' + err.message);
        document.getElementById('aw-upload-progress').style.display = 'none';
      },
      async () => {
        const url = await ref.getDownloadURL();
        document.getElementById('aw-progress-bar').style.width = '100%';
        document.getElementById('aw-progress-text').textContent = '완료! 선생님 확인 대기 중...';

        // pendingRewards에 작품 승인 요청 추가
        CUR.pendingRewards = CUR.pendingRewards || [];
        CUR.pendingRewards.push({
          id: 'art_' + Date.now(),
          type: 'artwork',
          label: `🎨 "${title}" 작품 제출`,
          artTitle: title,
          artDesc: desc,
          artUrl: url,
          subject: subject,
          exp: 30, gold: 20,
          icon: '🎨',
          date: Utils.todayStr(),
        });
        DB.saveStudent(CUR);

        // 폼 초기화
        setTimeout(() => {
          document.getElementById('aw-title-input').value  = '';
          document.getElementById('aw-desc-input').value   = '';
          document.getElementById('aw-file-input').value   = '';
          document.getElementById('aw-file-text').textContent = '📷 사진 선택하기';
          document.getElementById('aw-preview-wrap').style.display = 'none';
          document.getElementById('aw-upload-progress').style.display = 'none';
          document.getElementById('aw-progress-bar').style.width = '0%';
          toast('🎨 작품 제출 완료! 선생님 확인 후 전시돼요');
          renderArtworks();
          renderMain(); renderMobile();
        }, 800);
      }
    );
  } catch(e) {
    toast('오류 발생: ' + e.message);
    document.getElementById('aw-upload-progress').style.display = 'none';
  }
}

// ══ 추억 사진 ══
let _memFiles = []; // 선택된 파일 목록

document.addEventListener('DOMContentLoaded', () => {
  const zone = document.getElementById('mem-drop-zone');
  if (zone) zone.onclick = () => document.getElementById('mem-file-input').click();
});

function onMemDrop(e) {
  e.preventDefault();
  document.getElementById('mem-drop-zone').style.borderColor = 'rgba(255,255,255,.2)';
  onMemFilesSelect(e.dataTransfer.files);
}

function onMemFilesSelect(files) {
  if (!files || !files.length) return;
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    if (_memFiles.find(x => x.name===f.name && x.size===f.size)) continue;
    _memFiles.push(f);
  }
  renderMemPreviews();
}

function renderMemPreviews() {
  const wrap = document.getElementById('mem-preview-wrap');
  if (!wrap) return;
  if (_memFiles.length === 0) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = _memFiles.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `<div style="position:relative;width:70px;height:70px">
      <img src="${url}" style="width:70px;height:70px;object-fit:cover;border-radius:8px">
      <button onclick="removeMemFile(${i})" style="position:absolute;top:-4px;right:-4px;
        background:rgba(231,76,60,.85);border:none;color:#fff;border-radius:50%;
        width:18px;height:18px;font-size:.65rem;cursor:pointer;line-height:1;
        display:flex;align-items:center;justify-content:center">✕</button>
    </div>`;
  }).join('');
}

function removeMemFile(idx) {
  _memFiles.splice(idx, 1);
  renderMemPreviews();
}

// 이미지 압축 — 표시용(1600px, q0.78) / 썸네일(500px, q0.7)
function compressMemImage(file, maxSize, quality) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let {width:w, height:h} = img;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = h/w*maxSize; w = maxSize; }
          else { w = w/h*maxSize; h = maxSize; }
        }
        canvas.width = Math.round(w); canvas.height = Math.round(h);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => resolve(b), 'image/jpeg', quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function submitMemories() {
  const folder = document.getElementById('mem-folder-input')?.value.trim() || '';
  if (!folder)           { toast('📁 폴더 이름을 입력해주세요!'); return; }
  if (_memFiles.length === 0) { toast('📷 사진을 선택해주세요!'); return; }

  const total = _memFiles.length;
  const progWrap = document.getElementById('mem-upload-progress');
  const progBar  = document.getElementById('mem-progress-bar');
  const progTxt  = document.getElementById('mem-progress-text');
  progWrap.style.display = '';

  let done = 0;
  const storage = firebase.storage();
  const monthKey = Utils.todayStr().slice(0,7);

  for (const file of [..._memFiles]) {
    progTxt.textContent = `업로드 중 ${done+1}/${total}...`;
    progBar.style.width = `${Math.round(done/total*80)+5}%`;
    try {
      const [imgBlob, thumbBlob] = await Promise.all([
        compressMemImage(file, 1600, 0.78),
        compressMemImage(file, 500,  0.70),
      ]);
      const ts = Date.now() + done;
      const imgRef   = storage.ref(`memories/${CUR.id}_${ts}.jpg`);
      const thumbRef = storage.ref(`memories/${CUR.id}_${ts}_thumb.jpg`);
      await imgRef.put(imgBlob);
      await thumbRef.put(thumbBlob);
      const [imageUrl, thumbUrl] = await Promise.all([imgRef.getDownloadURL(), thumbRef.getDownloadURL()]);

      // 제목 = 폴더이름 (장수 > 1이면 번호 붙임), 파일명은 절대 사용 안함
      const title = total > 1 ? `${folder} (${done+1})` : folder;
      DB.saveMemory({
        id: 'mem_' + ts + '_' + CUR.id,
        studentId: CUR.id,
        studentName: CUR.name,
        uploadedBy: 'student',
        title,
        desc: folder,          // 설명도 폴더명으로
        imageUrl, thumbUrl,
        visibilityType: 'class',
        approvalStatus: 'pending',
        monthKey,
        createdAt: ts,
        date: Utils.todayStr(),
      });
      done++;
    } catch(e) {
      toast('업로드 실패: ' + e.message);
    }
  }

  progBar.style.width = '100%';
  progTxt.textContent = `${done}장 제출 완료!`;
  setTimeout(() => {
    document.getElementById('mem-folder-input').value = '';
    document.getElementById('mem-file-input').value = '';
    _memFiles = [];
    renderMemPreviews();
    progWrap.style.display = 'none';
    progBar.style.width = '0%';
    toast(`📸 ${done}장 제출! 선생님 확인 후 공유돼요`);
    renderMyMemories();
  }, 800);
}

// 구버전 호환
async function submitMemory() { await submitMemories(); }

function editMemTitle(memId, currentTitle) {
  if (currentTitle === undefined) { // 호출부는 id만 전달 (제목을 onclick 인자로 넘기면 따옴표/HTML 주입 위험)
    const m = (DB.getMemories('all') || []).find(x => x.id === memId);
    currentTitle = (m && m.title) || '';
  }
  const newTitle = prompt('폴더 이름을 입력해주세요\n(파일명 대신 보여집니다)', currentTitle);
  if (newTitle === null) return;          // 취소
  if (!newTitle.trim()) { toast('이름을 입력해주세요'); return; }
  DB.saveMemory({ id: memId, title: newTitle.trim(), desc: newTitle.trim() });
  toast('✅ 이름 변경 완료!');
  renderMyMemories();
}

function renderMyMemories() {
  const el = document.getElementById('mem-record-list');
  if (!el) return;
  const all = DB.getMemories('all');
  // 내 사진 + 관리자 전체공개
  const mine   = all.filter(m => m.studentId === CUR.id);
  const pubAdm = all.filter(m => m.uploadedBy === 'admin' && m.visibilityType === 'public');
  const approved = all.filter(m =>
    m.approvalStatus === 'approved' && m.visibilityType === 'class' && m.studentId !== CUR.id
  );
  const list = [...mine, ...pubAdm.filter(m => !mine.find(x=>x.id===m.id)),
                ...approved.filter(m => !mine.find(x=>x.id===m.id))];
  list.sort((a,b) => (b.createdAt||0)-(a.createdAt||0));

  if (list.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:1.5rem;color:var(--txt3);font-size:.8rem">
      아직 추억 사진이 없어요 📸</div>`;
    return;
  }

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.45rem">
      ${list.map((m,i) => {
        const myPending = m.studentId===CUR.id && m.approvalStatus==='pending';
        return `<div style="position:relative;cursor:pointer;border-radius:10px;overflow:hidden;
          aspect-ratio:1;background:rgba(255,255,255,.05);transition:transform .2s"
          onclick="openMemLightbox(${i})"
          onmouseenter="this.style.transform='scale(1.03)'"
          onmouseleave="this.style.transform='scale(1)'">
          <img src="${m.thumbUrl||m.imageUrl}" style="width:100%;height:100%;object-fit:cover;display:block"
            loading="lazy">
          <div style="position:absolute;bottom:0;left:0;right:0;padding:.3rem .45rem;
            background:linear-gradient(transparent,rgba(0,0,0,.72));
            font-size:.6rem;color:rgba(255,255,255,.9);
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${escHtml(m.title||'')}
          </div>
          ${myPending?`<div style="position:absolute;top:4px;right:4px;font-size:.55rem;
            background:rgba(255,180,0,.85);color:#1a1a1a;padding:.1rem .3rem;border-radius:4px;font-weight:700">확인중</div>`:''}
          ${m.studentId===CUR.id?`<button onclick="event.stopPropagation();editMemTitle('${m.id}')"
            style="position:absolute;top:4px;left:4px;background:rgba(0,0,0,.55);border:none;
              color:#fff;font-size:.65rem;padding:.1rem .35rem;border-radius:4px;cursor:pointer">✏️</button>`:''}
        </div>`;
      }).join('')}
    </div>`;
  window._memLightboxList = list;
}

let _memLbIdx = 0;
function openMemLightbox(idx) {
  const list = window._memLightboxList || [];
  if (!list.length) return;
  _memLbIdx = idx;
  // 추억 전용 라이트박스 (작품 lb-img와 분리)
  let lb = document.getElementById('mem-lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'mem-lightbox';
    lb.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.93);z-index:99999;flex-direction:column;align-items:center;justify-content:center';
    lb.onclick = e => { if (e.target === lb) lb.style.display='none'; };
    lb.innerHTML = `
      <button onclick="document.getElementById('mem-lightbox').style.display='none'"
        style="position:absolute;top:1rem;right:1.2rem;background:rgba(255,255,255,.15);border:none;
          color:#fff;font-size:1.6rem;cursor:pointer;border-radius:8px;width:40px;height:40px;
          display:flex;align-items:center;justify-content:center">✕</button>
      <img id="mem-lb-img" style="max-width:90vw;max-height:72vh;border-radius:14px;object-fit:contain;
        box-shadow:0 8px 40px rgba(0,0,0,.6)">
      <div id="mem-lb-cap" style="color:rgba(255,255,255,.9);font-size:.85rem;margin-top:.7rem;
        text-align:center;max-width:80vw;line-height:1.5"></div>
      <div id="mem-lb-counter" style="color:rgba(255,255,255,.4);font-size:.72rem;margin-top:.2rem"></div>
      <div style="display:flex;gap:1.2rem;margin-top:.8rem">
        <button onclick="navMemLb(-1);event.stopPropagation()"
          style="background:rgba(255,255,255,.15);border:none;color:#fff;font-size:1.8rem;
            padding:.35rem 1.2rem;border-radius:10px;cursor:pointer;transition:.15s"
          onmouseenter="this.style.background='rgba(255,255,255,.25)'"
          onmouseleave="this.style.background='rgba(255,255,255,.15)'">‹</button>
        <button onclick="navMemLb(1);event.stopPropagation()"
          style="background:rgba(255,255,255,.15);border:none;color:#fff;font-size:1.8rem;
            padding:.35rem 1.2rem;border-radius:10px;cursor:pointer;transition:.15s"
          onmouseenter="this.style.background='rgba(255,255,255,.25)'"
          onmouseleave="this.style.background='rgba(255,255,255,.15)'">›</button>
      </div>`;
    document.body.appendChild(lb);
  }
  _renderMemLb();
  lb.style.display = 'flex';
}

function _renderMemLb() {
  const list = window._memLightboxList || [];
  const m = list[_memLbIdx];
  if (!m) return;
  document.getElementById('mem-lb-img').src = m.imageUrl || m.thumbUrl;
  document.getElementById('mem-lb-cap').textContent =
    (m.title||'') + (m.desc ? ' — '+m.desc : '') + (m.date ? '  '+m.date : '');
  document.getElementById('mem-lb-counter').textContent = `${_memLbIdx+1} / ${list.length}`;
}

function navMemLb(dir) {
  const list = window._memLightboxList || [];
  _memLbIdx = (_memLbIdx + dir + list.length) % list.length;
  _renderMemLb();
}

// ══ 작품 탭 ══
function openLightbox(imgs, idx) {
  _lbImgs = imgs; _lbIdx = idx;
  _renderLightbox();
  document.getElementById('artwork-lightbox').style.display = 'flex';
}
function closeLightbox() {
  document.getElementById('artwork-lightbox').style.display = 'none';
}
function _renderLightbox() {
  const a = _lbImgs[_lbIdx];
  document.getElementById('lb-img').src = a.url;
  document.getElementById('lb-title').textContent = a.title;
  document.getElementById('lb-desc').textContent  = a.desc || '';
  document.getElementById('lb-counter').textContent = (_lbIdx+1) + ' / ' + _lbImgs.length;
  document.getElementById('lb-prev').style.opacity = _lbIdx > 0 ? '1' : '0.3';
  document.getElementById('lb-next').style.opacity = _lbIdx < _lbImgs.length-1 ? '1' : '0.3';
}
function lbPrev() { if (_lbIdx > 0) { _lbIdx--; _renderLightbox(); } }
function lbNext() { if (_lbIdx < _lbImgs.length-1) { _lbIdx++; _renderLightbox(); } }


// ══ 작품 과목 ══
let CUR_ART_SUBJECT = '전체';

function getStudentSubjects() {
  const db = DB.load();
  const s = (db.settings || {});
  const DEFAULT_SUBJECTS = ['국어','수학','사회','과학','음악','미술','체육','영어','창체'];
  return s.activeSubjects && s.activeSubjects.length > 0 ? s.activeSubjects : DEFAULT_SUBJECTS;
}

function renderArtworkSubjectTabs() {
  const subjects = getStudentSubjects();
  const el = document.getElementById('artwork-subject-tabs');
  if (!el) return;
  const tabs = ['전체', ...subjects];
  el.innerHTML = tabs.map(t => {
    const active = CUR_ART_SUBJECT === t;
    return `<button onclick="selectArtSubject('${t}')"
      style="font-size:.72rem;padding:.22rem .65rem;border-radius:20px;cursor:pointer;
        border:1.5px solid ${active?'var(--gold)':'rgba(255,255,255,.1)'};
        background:${active?'var(--gold)':'rgba(255,255,255,.04)'};
        color:${active?'#1a1a1a':'var(--txt3)'};
        font-weight:${active?'800':'500'};
        font-family:inherit;transition:all .15s">
      ${t}
    </button>`;
  }).join('');
}

function selectArtSubject(subject) {
  CUR_ART_SUBJECT = subject;
  renderArtworkSubjectTabs();
  renderArtworks();
}

function fillArtworkSubjectSelect() {
  const sel = document.getElementById('aw-subject-input');
  if (!sel) return;
  const subjects = getStudentSubjects();
  sel.innerHTML = '<option value="">과목 선택 (선택사항)</option>' +
    subjects.map(s => `<option value="${s}">${s}</option>`).join('');
}

function renderArtworks() {
  const el = document.getElementById('artwork-list');
  if (!el) return;
  renderArtworkSubjectTabs();
  fillArtworkSubjectSelect();
  let approved = DB.getArtworks(CUR.id);
  let pending  = (CUR.pendingRewards||[]).filter(p=>p.type==='artwork');
  if (CUR_ART_SUBJECT !== '전체') {
    approved = approved.filter(a => (a.subject||'') === CUR_ART_SUBJECT);
    pending  = pending.filter(a => (a.subject||'') === CUR_ART_SUBJECT);
  }
  if (approved.length === 0 && pending.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:2.5rem 0;color:var(--txt3);font-size:.82rem;line-height:2">
      아직 등록된 작품이 없어요 🎨<br>
      <span style="font-size:.72rem">위에서 첫 번째 작품을 올려보세요!</span></div>`;
    return;
  }
  const lbImgs = approved.filter(a=>a.artUrl||a.link).map(a=>({url:a.artUrl||a.link, title:a.title||a.artTitle||'', desc:a.comment||a.artDesc||''}));
  window._artLbImgs = lbImgs;

  const pendingHtml = pending.map(a => `
    <div style="background:rgba(255,255,255,.04);border:1.5px solid rgba(255,215,0,.2);
      border-radius:14px;overflow:hidden;margin-bottom:.8rem">
      ${a.artUrl?`<img src="${a.artUrl}" style="width:100%;max-height:200px;object-fit:cover;display:block">`:''}
      <div style="padding:.75rem .9rem">
        <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.35rem;flex-wrap:wrap">
          <span style="font-size:.65rem;font-weight:800;padding:.18rem .55rem;border-radius:20px;
            background:rgba(255,215,0,.18);color:var(--gold);border:1px solid rgba(255,215,0,.3)">⏳ 확인중</span>
          ${a.subject?`<span style="font-size:.65rem;padding:.18rem .5rem;border-radius:20px;
            background:rgba(255,255,255,.07);color:var(--txt3);border:1px solid rgba(255,255,255,.1)">${a.subject}</span>`:''}
        </div>
        <div style="font-size:.92rem;font-weight:800;color:var(--txt1);margin-bottom:.25rem">${a.artTitle||''}</div>
        ${a.artDesc?`<div style="font-size:.75rem;color:var(--txt2);line-height:1.55;
          display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${a.artDesc}</div>`:''}
      </div>
    </div>`).join('');

  const approvedHtml = approved.map((a,i) => {
    const url = a.artUrl||a.link||'';
    const lbIdx = lbImgs.findIndex(x=>x.url===url);
    const title = a.title||a.artTitle||'';
    const desc = a.comment||a.artDesc||'';
    return `
    <div style="background:rgba(255,255,255,.04);border:1.5px solid rgba(46,204,113,.15);
      border-radius:14px;overflow:hidden;margin-bottom:.8rem">
      ${url?`<div style="position:relative;cursor:pointer" onclick="openLightbox(window._artLbImgs,${lbIdx})">
        <img src="${url}" style="width:100%;max-height:220px;object-fit:cover;display:block"
          onerror="this.parentElement.style.display='none'">
        <div style="position:absolute;inset:0;background:rgba(0,0,0,0);transition:background .2s"
          onmouseover="this.style.background='rgba(0,0,0,.15)'" onmouseout="this.style.background='rgba(0,0,0,0)'">
          <span style="position:absolute;top:.5rem;right:.5rem;background:rgba(0,0,0,.45);
            border-radius:20px;padding:.15rem .5rem;font-size:.65rem;color:#fff">🔍 크게보기</span>
        </div>
      </div>`:''}
      <div style="padding:.75rem .9rem">
        <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.35rem;flex-wrap:wrap">
          <span style="font-size:.65rem;font-weight:800;padding:.18rem .55rem;border-radius:20px;
            background:rgba(46,204,113,.15);color:var(--emerald);border:1px solid rgba(46,204,113,.25)">✓ 전시중</span>
          ${a.subject?`<span style="font-size:.65rem;padding:.18rem .5rem;border-radius:20px;
            background:rgba(255,255,255,.07);color:var(--txt3);border:1px solid rgba(255,255,255,.1)">${a.subject}</span>`:''}
        </div>
        <div style="font-size:.92rem;font-weight:800;color:var(--txt1);margin-bottom:.25rem">${title}</div>
        ${desc?`<div style="font-size:.75rem;color:var(--txt2);line-height:1.55;margin-bottom:.3rem;
          display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${desc}</div>`:''}
        <div style="font-size:.65rem;color:var(--txt3);text-align:right">${a.date||''}</div>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = pendingHtml + approvedHtml;
}


// ══ 감정 돌아보기 팝업 ══
let _refCandidate = null;

function tryShowReflectionPopup() {
  if (!CUR) return;
  if (!canShowReflectionPopup(CUR.id)) return;
  const candidate = getReflectionCandidate(CUR.id);
  if (!candidate) return;
  _refCandidate = candidate;

  // 질문 문장 생성
  const pastText = EMOTION_PAST_TEXT[candidate.emotionLabel] || `${candidate.emotionLabel}했다고`;
  const dateStr  = candidate.date.slice(5).replace('-', '/');
  let question;
  if (candidate.reason && candidate.reason !== '없음') {
    question = `${CUR.name}님, ${dateStr}에 "${candidate.reason}"라고 적었고, 그때는 마음이 ${pastText} 했어요. 지금은 어떤가요?`;
  } else {
    question = `${CUR.name}님, ${dateStr}에는 마음이 ${pastText} 했어요. 오늘은 어떤가요?`;
  }

  document.getElementById('ref-question').textContent = question;
  document.getElementById('ref-step1').style.display         = '';
  document.getElementById('ref-step2').style.display         = 'none';
  document.getElementById('ref-step-custom').style.display   = 'none';
  openModal('m-reflection');
}

function onReflectionResponse(type) {
  if (!_refCandidate) return;

  const msgs = {
    better: ['다행이에요. 마음이 조금 나아졌군요. 😊', '좋아졌다고 알려줘서 고마워요.', '스스로 돌아본 것이 정말 좋아요.'],
    same:   ['아직 비슷하게 느껴지는군요.', '그 마음이 계속되고 있네요.', '괜찮아요. 천천히 달라질 수도 있어요.'],
    worse:  ['더 힘들어졌군요.', '그렇게 느낄 수 있어요.', '혼자 참지 않아도 괜찮아요.'],
    later:  ['괜찮아요. 나중에 다시 생각해봐도 돼요.', '지금 답하지 않아도 괜찮아요.'],
  };

  if (type === 'later') {
    updateReflectionStats(CUR.id, 'later');
    saveEmotionReflection(CUR.id, _refCandidate, 'later', '', false);
    closeModal('m-reflection');
    return;
  }

  if (type === 'custom') {
    document.getElementById('ref-step1').style.display       = 'none';
    document.getElementById('ref-step-custom').style.display = '';
    return;
  }

  const msg = msgs[type][Math.floor(Math.random() * msgs[type].length)];
  document.getElementById('ref-followup-msg').textContent = msg;
  document.getElementById('ref-step1').style.display = 'none';
  document.getElementById('ref-step2').style.display = '';

  const actionsEl = document.getElementById('ref-followup-actions');

  if (type === 'worse') {
    // 나빠졌어요 → 2차 선택지
    actionsEl.innerHTML = `
      <button onclick="finalizeReflection('worse','',false)"
        class="btn-sm outline" style="text-align:left;padding:.55rem .9rem">괜찮아요, 기록만 할게요</button>
      <button onclick="finalizeReflection('worse','',true)"
        class="btn-sm outline" style="text-align:left;padding:.55rem .9rem;color:var(--sky);border-color:rgba(93,173,226,.3)">
        선생님께 말하고 싶어요</button>`;
  } else {
    // better / same → 부정 반복 체크
    actionsEl.innerHTML = `<button onclick="finalizeReflection('${type}','',false)"
      class="btn-sm success" style="padding:.55rem .9rem">확인</button>`;

    // 부정 연속 체크
    if (shouldShowTeacherOption(CUR.id)) {
      actionsEl.innerHTML += `
        <div style="margin-top:.5rem;padding:.6rem;background:rgba(93,173,226,.06);border-radius:10px;
          border:1px solid rgba(93,173,226,.15)">
          <div style="font-size:.78rem;color:var(--sky);margin-bottom:.4rem">
            요즘 마음이 계속 힘든 것 같아요. 선생님께 이야기하고 싶나요?
          </div>
          <div style="display:flex;gap:.5rem">
            <button onclick="finalizeReflection('${type}','',false)"
              style="flex:1;padding:.4rem;border-radius:8px;background:rgba(255,255,255,.06);
                border:1px solid rgba(255,255,255,.12);color:var(--txt);font-size:.78rem;cursor:pointer;font-family:inherit">괜찮아요</button>
            <button onclick="finalizeReflection('${type}','',true)"
              style="flex:1;padding:.4rem;border-radius:8px;background:rgba(93,173,226,.15);
                border:1px solid rgba(93,173,226,.3);color:var(--sky);font-size:.78rem;cursor:pointer;font-family:inherit">이야기하고 싶어요</button>
          </div>
        </div>`;
    }
  }
}

function submitReflectionCustom(teacherRequest) {
  const text = document.getElementById('ref-custom-text').value.trim();
  finalizeReflection('custom', text, teacherRequest);
}

function finalizeReflection(responseType, responseText, teacherRequest) {
  if (!_refCandidate) return;
  updateReflectionStats(CUR.id, responseType);
  saveEmotionReflection(CUR.id, _refCandidate, responseType, responseText, teacherRequest);
  closeModal('m-reflection');
  if (teacherRequest) toast('선생님께 전달됐어요. 고마워요 💙');
  _refCandidate = null;
}

function dismissReflection() {
  updateReflectionStats(CUR.id, 'later');
  saveEmotionReflection(CUR.id, _refCandidate, 'later', '', false);
  closeModal('m-reflection');
  _refCandidate = null;
}

function shouldShowTeacherOption(studentId) {
  const db = DB.load();
  const reflections = Object.values(db.emotionReflections || {})
    .filter(r => r && r.studentId === studentId)
    .sort((a,b) => b.createdAt - a.createdAt)
    .slice(0, 3);
  const badCount = reflections.filter(r =>
    r.responseType === 'worse' || r.responseType === 'same'
  ).length;
  return badCount >= 2;
}

// ══ 오늘의 감정 ══

let _emoScoreChart = null;
let _emoDistChart  = null;

function renderEmotionHistory() {
  // 월 셀렉트 초기화
  const sel = document.getElementById('emo-month-sel');
  if (!sel) return;
  const today = Utils.todayStr();
  const curYear  = parseInt(today.slice(0,4));
  const curMonth = parseInt(today.slice(5,7));
  if (sel.options.length === 0) {
    for (let m = curMonth; m >= Math.max(1, curMonth-5); m--) {
      const opt = document.createElement('option');
      const mm = String(m).padStart(2,'0');
      opt.value = `${curYear}-${mm}`;
      opt.textContent = `${curYear}년 ${m}월`;
      sel.appendChild(opt);
    }
  }
  const selectedMonth = sel.value || `${curYear}-${String(curMonth).padStart(2,'0')}`;

  // 해당 월 기록 가져오기
  const allRecords = DB_EMOTION.getByStudent(CUR.id)
    .filter(r => r.date.startsWith(selectedMonth));

  // ── 요약 ──
  const pos = allRecords.filter(r=>r.group==='positive').length;
  const neu = allRecords.filter(r=>r.group==='neutral').length;
  const neg = allRecords.filter(r=>r.group==='negative').length;
  const total = allRecords.length;
  const summaryEl = document.getElementById('emo-month-summary');
  if (summaryEl) {
    summaryEl.innerHTML = [
      {label:'총 기록', value:`${total}회`, color:'var(--sky)'},
      {label:'😊 긍정', value:`${pos}회`, color:'var(--emerald)'},
      {label:'😶 보통', value:`${neu}회`, color:'var(--txt2)'},
      {label:'😢 부정', value:`${neg}회`, color:'var(--red)'},
    ].map(s=>`<div style="flex:1;min-width:60px;background:rgba(255,255,255,.04);border-radius:10px;
      padding:.45rem .5rem;text-align:center">
      <div style="font-size:.65rem;color:var(--txt3)">${s.label}</div>
      <div style="font-size:1rem;font-weight:700;color:${s.color}">${s.value}</div>
    </div>`).join('');
  }

  // ── 날짜별 score 꺾은선 ──
  const byDate = {};
  allRecords.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push(r.score);
  });
  const dateLabels = Object.keys(byDate).sort();
  const scoreData  = dateLabels.map(d => {
    const scores = byDate[d];
    return +(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1);
  });

  if (_emoScoreChart) _emoScoreChart.destroy();
  const scoreCtx = document.getElementById('emo-score-chart');
  if (scoreCtx && dateLabels.length > 0) {
    _emoScoreChart = new Chart(scoreCtx, {
      type: 'line',
      data: {
        labels: dateLabels.map(d => d.slice(5)),
        datasets: [{
          data: scoreData,
          borderColor: '#FFD700',
          backgroundColor: 'rgba(255,215,0,.1)',
          pointBackgroundColor: scoreData.map(s => s>0?'#2ecc71':s<0?'#e74c3c':'#aaa'),
          tension: 0.3, fill: true, pointRadius: 4,
        }]
      },
      options: {
        responsive:true, plugins:{legend:{display:false}},
        scales:{
          y:{min:-3,max:3,grid:{color:'rgba(255,255,255,.08)'},ticks:{color:'#aaa',font:{size:10}}},
          x:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#aaa',font:{size:9}}}
        }
      }
    });
  } else if (scoreCtx) {
    const ctx2 = scoreCtx.getContext('2d');
    ctx2.clearRect(0,0,scoreCtx.width,scoreCtx.height);
    ctx2.fillStyle='rgba(255,255,255,.3)';
    ctx2.font='14px Noto Sans KR';
    ctx2.textAlign='center';
    ctx2.fillText('아직 기록이 없어요', scoreCtx.width/2, 60);
  }

  // ── 감정 분포 도넛 ──
  if (_emoDistChart) _emoDistChart.destroy();
  const distCtx = document.getElementById('emo-dist-chart');
  if (distCtx && total > 0) {
    _emoDistChart = new Chart(distCtx, {
      type: 'doughnut',
      data: {
        labels: ['긍정','보통','부정'],
        datasets:[{data:[pos,neu,neg], backgroundColor:['#2ecc71','#95a5a6','#e74c3c'], borderWidth:0}]
      },
      options:{responsive:true,plugins:{legend:{position:'right',labels:{color:'#ccc',font:{size:11}}}}}
    });
  }

  // ── TOP5 감정 ──
  const freq = {};
  allRecords.forEach(r => { freq[r.emotionKey] = (freq[r.emotionKey]||0)+1; });
  const top5 = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const top5El = document.getElementById('emo-top5');
  if (top5El) {
    if (top5.length === 0) {
      top5El.innerHTML = '<div style="color:var(--txt3);font-size:.8rem">아직 기록이 없어요</div>';
    } else {
      const maxCount = top5[0][1];
      top5El.innerHTML = top5.map(([key, count]) => {
        const e = EMOTION_DATA.find(x=>x.key===key);
        const pct = Math.round(count/maxCount*100);
        return `<div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.4rem">
          <span style="font-size:1.2rem">${e?.icon||'?'}</span>
          <span style="font-size:.78rem;min-width:60px">${e?.label||key}</span>
          <div style="flex:1;height:8px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:var(--gold);border-radius:4px"></div>
          </div>
          <span style="font-size:.72rem;color:var(--txt3)">${count}회</span>
        </div>`;
      }).join('');
    }
  }

  // ── 달력 렌더 ──
  const calEl = document.getElementById('emo-calendar');
  if (calEl) {
    const [year, month] = selectedMonth.split('-').map(Number);
    const firstDay = new Date(year, month-1, 1).getDay(); // 0=일
    const lastDate  = new Date(year, month, 0).getDate();
    const days = ['일','월','화','수','목','금','토'];
    let calHtml = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px">
      ${days.map(d=>`<div style="text-align:center;font-size:.65rem;color:var(--txt3);padding:2px">${d}</div>`).join('')}
    </div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">`;
    for (let i=0;i<firstDay;i++) calHtml += `<div></div>`;
    for (let d=1;d<=lastDate;d++) {
      const dateStr = `${selectedMonth}-${String(d).padStart(2,'0')}`;
      const am = allRecords.find(r=>r.date===dateStr&&r.period==='am');
      const pm = allRecords.find(r=>r.date===dateStr&&r.period==='pm');
      const hasRecord = am||pm;
      const isToday = dateStr === Utils.todayStr();
      calHtml += `<div onclick="showEmotionDetail('${dateStr}')"
        style="border-radius:8px;padding:3px 2px;text-align:center;cursor:${hasRecord?'pointer':'default'};
          background:${isToday?'rgba(255,215,0,.15)':'rgba(255,255,255,.03)'};
          border:1px solid ${isToday?'rgba(255,215,0,.4)':'rgba(255,255,255,.06)'}">
        <div style="font-size:.65rem;color:var(--txt3);margin-bottom:1px">${d}</div>
        <div style="font-size:.75rem;line-height:1">${am?am.emotionIcon:'·'}</div>
        <div style="font-size:.75rem;line-height:1">${pm?pm.emotionIcon:''}</div>
      </div>`;
    }
    calHtml += '</div>';
    calEl.innerHTML = calHtml;
  }

  // ── 감정 일기 타임라인 ──
  const listEl = document.getElementById('emo-daily-list');
  if (listEl) {
    const sorted = [...allRecords].sort((a,b)=>b.date.localeCompare(a.date)||a.period.localeCompare(b.period));
    if (sorted.length === 0) {
      listEl.innerHTML = '<div style="color:var(--txt3);font-size:.8rem;padding:.5rem">이번 달 기록이 없어요</div>';
    } else {
      const groupColor = {positive:'var(--emerald)',neutral:'var(--txt2)',negative:'var(--red)'};
      const groupBg    = {positive:'rgba(46,204,113,.08)',neutral:'rgba(255,255,255,.04)',negative:'rgba(231,76,60,.08)'};
      // 날짜별로 묶기
      const byDate = {};
      sorted.forEach(r => { if(!byDate[r.date]) byDate[r.date]=[]; byDate[r.date].push(r); });
      listEl.innerHTML = Object.entries(byDate).map(([date, recs]) => {
        const weekDay = ['일','월','화','수','목','금','토'][new Date(date).getDay()];
        return `<div style="margin-bottom:.8rem">
          <div style="font-size:.72rem;color:var(--txt3);font-weight:700;margin-bottom:.4rem;
            padding-bottom:.3rem;border-bottom:1px solid rgba(255,255,255,.08)">
            ${date.slice(5).replace('-','/')} (${weekDay})
          </div>
          ${recs.map(r=>`
            <div style="display:flex;gap:.7rem;align-items:flex-start;margin-bottom:.4rem;
              background:${groupBg[r.group]};border-radius:10px;padding:.5rem .7rem">
              <div style="font-size:.7rem;color:var(--txt3);min-width:32px;padding-top:2px">
                ${r.period==='am'?'🌅 오전':'🌇 오후'}
              </div>
              <div style="font-size:1.4rem;flex-shrink:0">${r.emotionIcon}</div>
              <div style="flex:1">
                <div style="display:flex;align-items:center;gap:.4rem">
                  <span style="font-size:.85rem;font-weight:700">${r.emotionLabel}</span>
                  <span style="font-size:.68rem;color:${groupColor[r.group]};background:${groupBg[r.group]};
                    border-radius:8px;padding:.05rem .35rem">${r.levelLabel}</span>
                </div>
                ${r.reason&&r.reason!=='없음'
                  ? `<div style="font-size:.76rem;color:var(--txt2);margin-top:.25rem">💬 ${escHtml(r.reason)}</div>`
                  : ''}
              </div>
              <button onclick="editEmotionRecord('${r.date}','${r.period}')"
                style="background:none;border:1px solid rgba(255,255,255,.1);color:var(--txt3);
                  border-radius:6px;font-size:.62rem;padding:.15rem .4rem;cursor:pointer;flex-shrink:0">
                수정
              </button>
            </div>`).join('')}
        </div>`;
      }).join('');
    }
  }
}

function showEmotionDetail(date) {
  const records = DB_EMOTION.getByStudent(CUR.id).filter(r=>r.date===date);
  if (!records.length) return;
  const wrap = document.getElementById('emo-detail-wrap');
  const dateEl = document.getElementById('emo-detail-date');
  const contentEl = document.getElementById('emo-detail-content');
  if (!wrap||!dateEl||!contentEl) return;
  const weekDay = ['일','월','화','수','목','금','토'][new Date(date).getDay()];
  dateEl.textContent = `${date.slice(5).replace('-','/')} (${weekDay}) 감정 기록`;
  const groupColor = {positive:'var(--emerald)',neutral:'var(--txt2)',negative:'var(--red)'};
  contentEl.innerHTML = ['am','pm'].map(period => {
    const r = records.find(x=>x.period===period);
    if (!r) return `<div style="padding:.4rem 0;color:var(--txt3);font-size:.8rem">
      ${period==='am'?'🌅 오전':'🌇 오후'} — 기록 없음</div>`;
    return `<div style="display:flex;gap:.7rem;align-items:flex-start;padding:.5rem 0;
      border-bottom:1px solid rgba(255,255,255,.06)">
      <div style="font-size:.72rem;color:var(--txt3);min-width:40px">${period==='am'?'🌅 오전':'🌇 오후'}</div>
      <div style="font-size:1.5rem">${r.emotionIcon}</div>
      <div style="flex:1">
        <div style="font-size:.9rem;font-weight:700">${r.emotionLabel} · <span style="color:${groupColor[r.group]};font-size:.78rem">${r.levelLabel}</span></div>
        ${r.reason&&r.reason!=='없음'?`<div style="font-size:.78rem;color:var(--txt2);margin-top:.2rem">💬 ${escHtml(r.reason)}</div>`:''}
      </div>
      <button onclick="editEmotionRecord('${r.date}','${r.period}')"
        style="background:none;border:1px solid rgba(255,255,255,.12);color:var(--txt3);
          border-radius:6px;font-size:.68rem;padding:.2rem .5rem;cursor:pointer">수정</button>
    </div>`;
  }).join('');
  wrap.style.display = '';
  wrap.scrollIntoView({behavior:'smooth', block:'nearest'});
}

function editEmotionRecord(date, period) {
  // 기존 감정 모달 재활용 (수정 모드)
  _emoCurrentPeriod = period;
  _emoSelectedKey   = null;
  _emoSelectedLevel = null;
  const existing = DB_EMOTION.get(CUR.id, date, period);
  const title = `✏️ ${date.slice(5).replace('-','/')} ${period==='am'?'오전':'오후'} 수정`;
  document.getElementById('emotion-modal-title').textContent = title;
  document.getElementById('emotion-step1').style.display = '';
  document.getElementById('emotion-step2').style.display = 'none';
  document.getElementById('emotion-reason-input').value = existing?.reason || '';
  // 날짜를 오늘이 아닌 해당 날짜로 임시 저장
  _emoEditDate = date;
  const grid = document.getElementById('emotion-grid');
  grid.innerHTML = EMOTION_DATA.map(e => {
    const isSelected = existing?.emotionKey === e.key;
    return `<button onclick="selectEmotion('${e.key}')"
      style="display:flex;flex-direction:column;align-items:center;gap:2px;
        padding:.45rem .2rem;border-radius:10px;cursor:pointer;font-family:inherit;
        border:1.5px solid ${isSelected?'var(--gold)':'rgba(255,255,255,.1)'};
        background:${isSelected?'rgba(255,215,0,.12)':'rgba(255,255,255,.04)'};transition:all .15s">
      <span style="font-size:1.3rem">${e.icon}</span>
      <span style="font-size:.6rem;color:var(--txt2)">${e.label}</span>
    </button>`;
  }).join('');
  openModal('m-emotion');
}



function claimEmotionReward(rewardId) {
  const weekStart = Utils.weekStartStr();
  const reward = EMOTION_REWARDS.find(r => r.id === rewardId);
  if (!reward) return;

  // 이미 수령 여부 재확인
  const claimed = (CUR.emotionRewardsClaimed || {})[weekStart] || [];
  if (claimed.includes(rewardId)) { toast('이미 받은 보상이에요!'); return; }

  // 지급
  CUR.exp   = (CUR.exp||0)   + reward.exp;
  CUR.gold  = (CUR.gold||0)  + reward.gold;
  CUR.totalGold = (CUR.totalGold||0) + reward.gold;
  CUR.level = Utils.levelFromExp(CUR.exp);

  // 수령 기록 저장
  CUR.emotionRewardsClaimed = CUR.emotionRewardsClaimed || {};
  CUR.emotionRewardsClaimed[weekStart] = [...claimed, rewardId];

  // questLog 기록
  DB.saveQuestLog({
    studentId: CUR.id,
    boardQuestId: null,
    boardQuestType: 'emotion',
    type: 'emotion',
    name: reward.label,
    exp:  reward.exp,
    gold: reward.gold,
    stat: '', statVal: 0,
    icon: '💭',
    date: Utils.todayStr(),
    approved: true,
  });

  DB.saveStudent(CUR);
  renderAll();
  toast(`🎉 ${reward.label} +${reward.exp}EXP +${reward.gold}G!`);
}
let _emoCurrentPeriod = 'am';
let _emoSelectedKey   = null;
let _emoSelectedLevel = null;

function openEmotionModal(period) {
  _emoCurrentPeriod = period;
  _emoSelectedKey   = null;
  _emoSelectedLevel = null;

  const today = Utils.todayStr();
  const existing = DB_EMOTION.get(CUR.id, today, period);
  const title = period === 'am' ? '🌅 오전 감정' : '🌇 오후 감정';
  document.getElementById('emotion-modal-title').textContent =
    (existing ? '✏️ 수정: ' : '💭 ') + title;

  // step1 표시
  document.getElementById('emotion-step1').style.display = '';
  document.getElementById('emotion-step2').style.display = 'none';
  document.getElementById('emotion-reason-input').value = existing?.reason || '';

  // 감정 그리드 렌더
  const grid = document.getElementById('emotion-grid');
  grid.innerHTML = EMOTION_DATA.map(e => {
    const isSelected = existing?.emotionKey === e.key;
    return `<button onclick="selectEmotion('${e.key}')"
      style="display:flex;flex-direction:column;align-items:center;gap:2px;
        padding:.45rem .2rem;border-radius:10px;cursor:pointer;font-family:inherit;
        border:1.5px solid ${isSelected ? 'var(--gold)' : 'rgba(255,255,255,.1)'};
        background:${isSelected ? 'rgba(255,215,0,.12)' : 'rgba(255,255,255,.04)'};
        transition:all .15s">
      <span style="font-size:1.3rem">${e.icon}</span>
      <span style="font-size:.6rem;color:var(--txt2);line-height:1.2">${e.label}</span>
    </button>`;
  }).join('');

  openModal('m-emotion');
}

function selectEmotion(key) {
  _emoSelectedKey = key;
  const e = EMOTION_DATA.find(x => x.key === key);

  // step2로 전환
  document.getElementById('emotion-step1').style.display = 'none';
  document.getElementById('emotion-step2').style.display = '';
  document.getElementById('emotion-selected-display').textContent = e.icon;
  document.getElementById('emotion-selected-label').textContent   = e.label;

  // 강도 버튼 초기화
  _emoSelectedLevel = null;
  [1,2,3].forEach(v => {
    const btn = document.getElementById('elv-'+v);
    btn.classList.remove('success'); btn.classList.add('outline');
  });
  document.getElementById('emotion-submit-btn').disabled = true;
}

function selectEmotionLevel(level) {
  _emoSelectedLevel = level;
  [1,2,3].forEach(v => {
    const btn = document.getElementById('elv-'+v);
    if (v === level) { btn.classList.add('success'); btn.classList.remove('outline'); }
    else             { btn.classList.remove('success'); btn.classList.add('outline'); }
  });
  document.getElementById('emotion-submit-btn').disabled = false;
}

let _emoEditDate = null; // 수정 모드일 때 날짜

function submitEmotion(reason) {
  if (!_emoSelectedKey || !_emoSelectedLevel) {
    toast('감정과 강도를 선택해주세요!'); return;
  }
  const saveDate = _emoEditDate || Utils.todayStr();
  DB_EMOTION.save(CUR.id, saveDate, _emoCurrentPeriod, _emoSelectedKey, _emoSelectedLevel,
    reason.trim() || '없음');
  _emoEditDate = null; // 초기화
  closeModal('m-emotion');
  // 오늘 날짜면 홈 카드 갱신, 아니면 감정 탭 갱신
  if (saveDate === Utils.todayStr()) {
    renderMain(); renderMobile();
  } else {
    renderEmotionHistory();
  }
  toast(`💭 감정 기록 완료!`);
}

// ══ 인벤토리 ══// ══ 인벤토리 ══
function renderInv() {
  const tab = INV_TAB, inv = CUR.inventory||[];
  let html = '';

  if (tab === 'skill') {
    const sl  = CUR.skillLevels || DEFAULT_SKILL_LEVELS;
    const eq  = CUR.equippedSkills || ['normal', null, null];
    const typeInfo = [
      { type:'normal', label:'⚔️ 기본 공격', color:'var(--gold)',  maxLv:7 },
      { type:'fire',   label:'🔥 화염 마법',  color:'#FF8A80',    maxLv:7 },
      { type:'water',  label:'💧 냉기 마법',  color:'#7ec8e3',    maxLv:7 },
      { type:'grass',  label:'🌿 자연 마법',  color:'#6fd49d',    maxLv:7 },
    ];

    // ── 장착 슬롯 3칸 ──────────────────────────────────────
    const slotLabels = ['슬롯 1', '슬롯 2', '슬롯 3'];
    const typeColors = { normal:'var(--gold)', fire:'#FF8A80', water:'#7ec8e3', grass:'#6fd49d', null:'var(--txt3)' };
    const typeIcons  = { normal:'⚔️', fire:'🔥', water:'💧', grass:'🌿' };
    const typeNames  = { normal:'기본', fire:'화염', water:'냉기', grass:'자연' };

    html += `<div style="font-size:.8rem;font-weight:700;color:var(--txt1);margin-bottom:.5rem">⚔️ 전투 장착 스킬</div>`;
    html += `<div style="font-size:.7rem;color:var(--txt3);margin-bottom:.7rem">슬롯 2~3을 눌러 속성 스킬을 장착하세요. 전투에서 장착된 스킬만 버튼으로 표시됩니다.</div>`;
    html += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem;margin-bottom:1rem">`;

    const slotConfigs = [
      { label:'슬롯 1', locked: true,  desc:'기본 공격 (고정)' },
      { label:'슬롯 2', locked: false, desc:'속성 스킬 선택' },
      { label:'슬롯 3', locked: false, desc:'속성 스킬 선택' },
    ];
    const typeColors2 = { normal:'var(--gold)', fire:'#FF8A80', water:'#7ec8e3', grass:'#6fd49d' };
    const typeIcons2  = { normal:'⚔️', fire:'🔥', water:'💧', grass:'🌿' };
    const typeNames2  = { normal:'기본', fire:'화염', water:'냉기', grass:'자연' };

    slotConfigs.forEach((cfg, i) => {
      const skillType = eq[i];
      const tc = skillType ? (typeColors2[skillType]||'var(--gold)') : 'var(--txt3)';
      const lv = skillType ? (sl[skillType] ?? 0) : 0;
      const clickable = !cfg.locked;
      html += `<div id="skill-slot-card-${i}" ${clickable ? `onclick="openSkillSlotPicker(${i})"` : ''}
        style="background:${cfg.locked ? 'rgba(255,215,0,.06)' : 'rgba(255,255,255,.04)'};
          border:1.5px solid ${skillType ? tc : (cfg.locked ? 'rgba(255,215,0,.25)' : 'rgba(255,255,255,.1)')};
          border-radius:10px;padding:.6rem .3rem;text-align:center;
          cursor:${clickable ? 'pointer' : 'default'};transition:.2s"
        ${clickable ? 'onmouseenter="this.style.background=\'rgba(255,255,255,.08)\'" onmouseleave="this.style.background=\'rgba(255,255,255,.04)\'"' : ''}>
        <div style="font-size:.58rem;color:var(--txt3);margin-bottom:.2rem">${cfg.label}</div>
        <div style="font-size:1.3rem;margin-bottom:.15rem">${skillType ? typeIcons2[skillType] : (cfg.locked ? '⚔️' : '＋')}</div>
        <div style="font-size:.65rem;font-weight:700;color:${tc}">${skillType ? typeNames2[skillType] : (cfg.locked ? '기본(고정)' : '비어있음')}</div>
        <div style="font-size:.58rem;color:var(--txt3)">${lv > 0 ? 'Lv'+lv : ''}</div>
      </div>`;
    });
    html += `</div>`;

    // ── 스킬 현황 카드 ──────────────────────────────────────
    html += `<div style="font-size:.78rem;font-weight:700;color:var(--txt1);margin-bottom:.5rem">📖 보유 스킬 현황</div>`;
    html += `<div style="font-size:.7rem;color:var(--txt3);margin-bottom:.6rem">마스터리북을 구매하면 레벨이 오릅니다. 상점 → 📚 마스터리북 탭</div>`;
    html += typeInfo.map(({ type, label, color, maxLv }) => {
      const lv   = sl[type] ?? 0;
      const pct  = Math.round(lv / maxLv * 100);
      const mult = type === 'normal'
        ? (SKILL_MULTIPLIERS.normal[lv] ?? 1.0)
        : (SKILL_MULTIPLIERS.element[lv] ?? 0.0);
      const multTxt  = lv === 0 ? '미습득' : `×${mult.toFixed(2)}`;
      const isEquipped = eq.includes(type);
      const nextBook = SKILL_BOOKS.find(b => b.type === type && b.targetLevel === lv + 1);
      const nextTxt  = lv >= maxLv
        ? '<span style="color:var(--emerald);font-size:.68rem">✅ MAX</span>'
        : nextBook ? `<span style="font-size:.68rem;color:var(--txt3)">${nextBook.name} (${nextBook.price}G)</span>` : '';

      return `<div style="background:rgba(255,255,255,.04);border:1px solid ${isEquipped ? color : 'rgba(255,255,255,.07)'};
        border-radius:12px;padding:.7rem;margin-bottom:.45rem">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.3rem">
          <span style="font-weight:700;font-size:.85rem;color:${color}">${label}
            ${isEquipped ? '<span style="font-size:.62rem;background:'+color+';color:#111;border-radius:4px;padding:.05rem .3rem;margin-left:.3rem">장착중</span>' : ''}
          </span>
          <span style="font-size:.72rem;font-weight:700;color:${lv>0?color:'var(--txt3)'}">
            ${lv === 0 ? '미습득' : `Lv.${lv} / ${maxLv}`}
          </span>
        </div>
        <div style="background:rgba(255,255,255,.08);border-radius:5px;height:6px;overflow:hidden;margin-bottom:.3rem">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:5px;transition:width .4s ease"></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:.68rem;color:var(--txt3)">계수 <strong style="color:${color}">${multTxt}</strong></span>
          ${nextTxt}
        </div>
      </div>`;
    }).join('');

    // ── 스킬2 장착 슬롯 ────────────────────────────────────
    const eq2 = CUR.equippedSkill2 || ['heal','guard','counter'];
    const ALL_SKILL2 = [
      { id:'heal',     label:'💊 응급치료',    desc:'HP 30% 회복', color:'#6fd49d' },
      { id:'prep',     label:'🎯 일격 준비',   desc:'다음 공격 ×2.3', color:'#FFD700' },
      { id:'reckless', label:'⚡ 무리한 공격', desc:'50% 확률 ×2.2', color:'#FF8A80' },
      { id:'guard',    label:'🛡️ 방어',       desc:'피해 50% 감소', color:'#7ec8e3' },
      { id:'counter',  label:'⚔️ 최후의 반격',desc:'HP40%↓ / 반사', color:'#c39bd3' },
      { id:'rush',     label:'🔥 몰아치기',   desc:'2턴 공격력↑', color:'#f39c12' },
    ];

    html += `<div style="font-size:.8rem;font-weight:700;color:var(--txt1);margin:.8rem 0 .4rem">🎮 전투 스킬 장착 (3칸)</div>`;
    html += `<div style="font-size:.7rem;color:var(--txt3);margin-bottom:.7rem">슬롯을 눌러 전투 스킬을 선택하세요. 각 스킬은 전투당 1회 사용 가능합니다.</div>`;
    html += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem;margin-bottom:.8rem">`;
    [0,1,2].forEach(i => {
      const sid  = eq2[i] || null;
      const info = ALL_SKILL2.find(s => s.id === sid);
      const tc   = info ? info.color : 'var(--txt3)';
      html += `<div id="skill2-slot-card-${i}" onclick="openSkill2SlotPicker(${i})"
        style="background:rgba(255,255,255,.04);border:1.5px solid ${info ? tc : 'rgba(255,255,255,.1)'};
          border-radius:10px;padding:.6rem .3rem;text-align:center;cursor:pointer;transition:.2s"
        onmouseenter="this.style.background='rgba(255,255,255,.08)'"
        onmouseleave="this.style.background='rgba(255,255,255,.04)'">
        <div style="font-size:.6rem;color:var(--txt3);margin-bottom:.15rem">슬롯 ${i+1}</div>
        <div style="font-size:1.1rem;margin-bottom:.15rem">${info ? info.label.split(' ')[0] : '＋'}</div>
        <div style="font-size:.62rem;font-weight:700;color:${tc}">${info ? info.label.slice(info.label.indexOf(' ')+1) : '비어있음'}</div>
        <div style="font-size:.56rem;color:var(--txt3);margin-top:.1rem">${info ? info.desc : ''}</div>
      </div>`;
    });
    html += `</div>`;

    document.getElementById('inv-slots').innerHTML = html;
    return;
  }

  if (tab === 'equip') {
    // 현재 장착 슬롯
    const slots = [
      {k:'head',icon:'🪖',l:'머리'},{k:'body',icon:'🥋',l:'옷'},{k:'weapon',icon:'⚔️',l:'무기'},
      {k:'glove',icon:'🧤',l:'장갑'},{k:'shoe',icon:'👟',l:'신발'}
    ];
    html += `<div style="font-size:.72rem;color:var(--txt3);margin-bottom:.5rem">⚔️ 현재 장착 장비</div>`;
    html += `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.35rem;margin-bottom:1rem">`;
    html += slots.map(sl => {
      const eqId   = CUR.equipmentIds?.[sl.k];
      const eqItem = eqId ? GAME_DATA.getItemById(eqId) : null;
      return `<div style="background:rgba(255,215,0,.07);border:1px solid rgba(255,215,0,.2);
        border-radius:10px;padding:.5rem .3rem;text-align:center">
        <div style="display:flex;justify-content:center;align-items:center;height:40px">
          ${eqItem ? buildEquipIcon(sl.k, eqItem.id) : `<span style="font-size:1.4rem">${sl.icon}</span>`}
        </div>
        <div style="font-size:.58rem;color:var(--txt3);margin:.15rem 0">${sl.l}</div>
        <div style="font-size:.6rem;color:var(--gold);font-weight:600;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 .1rem">
          ${eqItem?eqItem.name:'없음'}</div>
      </div>`;
    }).join('');
    html += `</div>`;

    // 부위별 탭
    const slotTabs = [
      {k:'all',  icon:'📦', l:'전체'},
      {k:'head', icon:'🪖', l:'머리'},
      {k:'body', icon:'🥋', l:'옷'},
      {k:'weapon',icon:'⚔️',l:'무기'},
      {k:'glove',icon:'🧤', l:'장갑'},
      {k:'shoe', icon:'👟', l:'신발'},
    ];
    html += `<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.6rem">`;
    slotTabs.forEach(t => {
      const active = CUR_EQUIP_SLOT === t.k;
      // 해당 부위 보유 수량
      const cnt = t.k === 'all'
        ? inv.filter(i => GAME_DATA.getItemById(i.id)).length
        : inv.filter(i => { const item = GAME_DATA.getItemById(i.id); return item && (item.slot === t.k || Object.keys(GAME_DATA.equipment).find(s=>s===t.k&&GAME_DATA.equipment[s]?.find(x=>x.id===i.id))); }).length;
      html += `<button onclick="CUR_EQUIP_SLOT='${t.k}';renderInv()"
        style="font-size:.7rem;padding:.22rem .55rem;border-radius:20px;cursor:pointer;
          border:1.5px solid ${active?'var(--gold)':'rgba(255,255,255,.1)'};
          background:${active?'var(--gold)':'rgba(255,255,255,.04)'};
          color:${active?'#1a1a1a':'var(--txt2)'};font-weight:${active?'800':'500'};
          font-family:inherit">${t.icon} ${t.l}${cnt>0?` <span style="font-size:.62rem;opacity:.7">${cnt}</span>`:''}</button>`;
    });
    html += `</div>`;

    // 보관 장비 목록 (부위 필터 적용)
    let equipInv = inv.filter(i => GAME_DATA.getItemById(i.id));
    if (CUR_EQUIP_SLOT !== 'all') {
      equipInv = equipInv.filter(i => {
        const item = GAME_DATA.getItemById(i.id);
        return item && (item.slot === CUR_EQUIP_SLOT ||
          Object.keys(GAME_DATA.equipment).find(s => s === CUR_EQUIP_SLOT && GAME_DATA.equipment[s]?.find(x => x.id === i.id)));
      });
    }

    if (equipInv.length === 0) {
      html += `<div style="font-size:.8rem;color:var(--txt3);padding:1.2rem 0;text-align:center">
        ${CUR_EQUIP_SLOT==='all'?'보관중인 장비가 없어요':'해당 부위 장비가 없어요'}</div>`;
    } else {
      html += `<div style="display:flex;flex-direction:column;gap:.5rem">` + equipInv.map(i => {
        const item = GAME_DATA.getItemById(i.id);
        if (!item) return '';
        const sellPrice = Math.floor(item.price / 2);
        const statStr   = Utils.statText(item.stats);
        const slotKey   = item.slot || Object.keys(GAME_DATA.equipment).find(s=>GAME_DATA.equipment[s]?.find(x=>x.id===item.id)) || 'body';
        return `<div style="display:flex;align-items:center;gap:.8rem;
          background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
          border-radius:10px;padding:.7rem .9rem">
          <div style="flex-shrink:0;width:48px;height:48px;display:flex;align-items:center;justify-content:center">
            ${buildEquipIcon(slotKey, item.id)}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:.88rem">${item.name}</div>
            <div style="font-size:.72rem;color:var(--sky);margin:.15rem 0">${statStr}</div>
            <div style="font-size:.68rem;color:var(--txt3)">×${i.qty}개 보유</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:.4rem;flex-shrink:0;min-width:60px">
            <button class="btn-gold" style="padding:.35rem .6rem;font-size:.74rem;
              border-radius:8px;white-space:nowrap;width:100%"
              onclick="equipFromInv('${i.id}')">⚔️ 장착</button>
            <button style="background:rgba(231,76,60,.15);border:1px solid rgba(231,76,60,.35);
              color:var(--red);border-radius:8px;padding:.35rem .6rem;font-size:.74rem;
              cursor:pointer;white-space:nowrap;width:100%;font-family:inherit"
              onclick="sellEquip('${i.id}')">💰${sellPrice}G</button>
          </div>
        </div>`;
      }).join('') + `</div>`;
    }

  } else if (tab === 'seed') {
    const seedInv = inv.filter(i => GAME_DATA.seeds.find(s=>s.id===i.id));
    const blanks  = Math.max(0, 12 - seedInv.length);
    html = `<div class="inv-slots">` +
      seedInv.map(i => {
        const s = Utils.getSeedById(i.id);
        return `<div class="inv-slot filled">
          <div class="inv-icon">${s.icon}</div>
          <div class="inv-name">${s.name}</div>
          <div class="inv-qty">x${i.qty}</div>
        </div>`;
      }).join('') + Array(blanks).fill('<div class="inv-slot"></div>').join('') + `</div>`;
  } else {
    // 장식 탭
    const decoInv = inv.filter(i => GAME_DATA.decorations.find(d=>d.id===i.id));
    const placed  = CUR.houseDecorations||[];
    const blanks  = Math.max(0, 12 - decoInv.length);
    html = `<div style="font-size:.72rem;color:var(--txt2);margin-bottom:.6rem">
      💡 내 집 탭에서 장식품을 배치할 수 있어요!</div>
      <div class="inv-slots">` +
      decoInv.map(i => {
        const d = GAME_DATA.decorations.find(x=>x.id===i.id);
        const used = placed.filter(p=>p.id===i.id).length;
        return `<div class="inv-slot filled">
          <div class="inv-icon">${d.icon}</div>
          <div class="inv-name">${d.name}</div>
          <div class="inv-qty">x${i.qty} <span style="color:var(--txt3)">(배치:${used})</span></div>
        </div>`;
      }).join('') + Array(blanks).fill('<div class="inv-slot"></div>').join('') + `</div>`;
  }

  document.getElementById('inv-slots').innerHTML = html;
}

// ══ 장비 판매 (절반값) ══
function sellEquip(itemId) {
  const item = GAME_DATA.getItemById(itemId);
  if (!item) return;
  const sellPrice = Math.floor(item.price / 2);
  if (!confirm(`${item.icon} ${item.name}을(를) ${sellPrice}G에 판매할까요?\n(구매가의 절반)`)) return;
  const inv = CUR.inventory || [];
  const invItem = inv.find(i=>i.id===itemId);
  if (!invItem || invItem.qty < 1) { toast('판매할 아이템이 없어요!'); return; }
  invItem.qty--;
  if (invItem.qty <= 0) CUR.inventory = inv.filter(i=>i.id!==itemId);
  CUR.gold += sellPrice;
  CUR.totalGold = (CUR.totalGold||0) + sellPrice;
  DB.saveStudent(CUR);
  renderInv(); renderHUD();
  toast(`💰 ${item.name} 판매! +${sellPrice}G`);
}

function equipFromInv(itemId) {
  const item = GAME_DATA.getItemById(itemId);
  if (!item) return;
  const slot  = GAME_DATA.SLOT_MAP[itemId];
  const oldId = CUR.equipmentIds?.[slot];
  if (oldId === itemId) { toast('이미 장착중이에요!'); return; }
  if (!Utils.condMet(CUR, item.cond)) { toast('🔒 착용 조건 미충족\n' + Utils.condText(item.cond)); return; }
  // 기존 장비 인벤 반환
  if (oldId) returnEquipToInv(oldId);
  // 인벤에서 차감
  const invItem = (CUR.inventory||[]).find(i=>i.id===itemId);
  if (invItem) { invItem.qty--; if(invItem.qty<=0) CUR.inventory=CUR.inventory.filter(i=>i.id!==itemId); }
  Utils.equipItem(CUR, item);
  DB.saveStudent(CUR); renderAll(); renderInv();
  toast(`✅ ${item.name} 장착!`);
}

function invTab(tab, el) {
  INV_TAB = tab;
  document.querySelectorAll('#m-inv .mtab').forEach(t => t.classList.remove('on'));
  el.classList.add('on'); renderInv();
}

// ══ 퀘스트 탭 전환 ══
function questTab(tab, el) {
  document.querySelectorAll('#m-quest .mtab').forEach(t => t.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('quest-tab-board').style.display   = tab === 'board'   ? '' : 'none';
  document.getElementById('quest-tab-rewards').style.display = tab === 'rewards' ? '' : 'none';
  if (tab === 'board')   renderQuestBoard();
  if (tab === 'rewards') renderQuestModal();
}

// ══ 퀘스트 게시판 ══
function renderQuestBoard() {
  const db = DB.load();
  // ★ 공통 기준: active !== false 인 것만
  const activeQuests = (db.boardQuests||[]).filter(q => q && q.active !== false);
  const activeBQIds  = new Set(activeQuests.map(q=>q.id));
  const questLogs    = db.quests || [];

  const container = document.getElementById('quest-board-list');
  if (activeQuests.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:2rem 0;color:var(--txt3);font-size:.83rem">
      아직 올라온 퀘스트가 없어요 🙁<br>
      <span style="font-size:.72rem">선생님이 퀘스트를 등록하면 여기에 표시돼요</span>
    </div>`;
    return;
  }

  container.innerHTML = activeQuests.map(q => {
    // ★ 공통 상태 계산
    const status  = Utils.questStatus(CUR.id, q.id, q.type, questLogs, CUR.pendingRewards, activeBQIds);
    const done    = status === 'done';
    const pending = status === 'pending';
    return `<div style="background:rgba(255,255,255,.04);border:1px solid ${done?'rgba(46,204,113,.3)':pending?'rgba(255,215,0,.25)':'rgba(255,255,255,.08)'};
      border-radius:12px;padding:.9rem 1rem;margin-bottom:.6rem;${done?'opacity:.6':''}">
      <div style="display:flex;align-items:flex-start;gap:.7rem">
        <div style="font-size:1.6rem;flex-shrink:0">${q.icon||'📋'}</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:.88rem;margin-bottom:.2rem">${q.name}</div>
          <div style="font-size:.72rem;color:var(--txt3);margin-bottom:.5rem">
            ${q.type==='daily'?'📅 일일':q.type==='weekly'?'📆 주간':q.type==='special'?'⭐ 과제':'🎉 특별'} 퀘스트
            ${q.dueDate?` · 마감 ${q.dueDate}`:''}
          </div>
          <div style="display:flex;gap:.4rem;flex-wrap:wrap">
            <span style="font-size:.72rem;background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.2);
              border-radius:8px;padding:.1rem .45rem;color:var(--gold)">+${q.exp}EXP</span>
            <span style="font-size:.72rem;background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.2);
              border-radius:8px;padding:.1rem .45rem;color:var(--gold)">+${q.gold}G</span>
            ${q.stat?`<span style="font-size:.72rem;background:rgba(93,173,226,.08);border:1px solid rgba(93,173,226,.2);
              border-radius:8px;padding:.1rem .45rem;color:var(--sky)">${GAME_DATA.statNames[q.stat]||q.stat} +${q.statVal||1}</span>`:''}
          </div>
        </div>
        <div style="flex-shrink:0;text-align:right">
          <div style="font-size:.75rem;color:${done?'var(--emerald)':pending?'var(--gold)':'var(--txt3)'};font-weight:700;margin-bottom:.3rem">
            ${done?'✅ 완료':pending?'⏳ 대기중':'⭕ 진행중'}
          </div>
          ${!done&&!pending ? `<button class="btn-sm success" style="font-size:.7rem;padding:.25rem .6rem"
            onclick="submitQuestFromMain('${q.id}');renderQuestBoard()">신청</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

// 메인 화면에서 바로 퀘스트 완료 신청
function submitQuestFromMain(questId) {
  const db = DB.load();
  const q = (db.boardQuests||[]).find(x=>x.id===questId && x.active!==false);
  if (!q) return; // 삭제/닫힌 퀘스트면 무시

  // db.quests = 정규화된 배열 (questLogs 기반)
  const questLogs = db.quests || [];
  const status = Utils.questStatus(
    CUR.id, questId, q.type, questLogs, CUR.pendingRewards,
    new Set((db.boardQuests||[]).filter(x=>x.active!==false).map(x=>x.id))
  );
  if (status === 'done' || status === 'pending') return;

  CUR.pendingRewards = CUR.pendingRewards || [];
  CUR.pendingRewards.push({
    id: 'pr_'+Date.now(),
    boardQuestId: questId,
    boardQuestType: q.type||'special',
    label: q.name,
    exp: q.exp, gold: q.gold, stat: q.stat||'', statVal: q.stat ? (parseFloat(q.statVal)||1) : 0,
    icon: q.icon||'📋',
    date: Utils.todayStr(),
  });
  DB.saveStudent(CUR);
  toast(`📌 "${q.name}" 완료 신청! 선생님 확인 후 보상이 지급돼요`);
  renderMain(); renderMobile();
}

// 퀘스트 모달 열 때 게시판 탭이 기본
function openQuestModal() {
  openModal('m-quest');
  const firstTab = document.querySelector('#m-quest .mtab');
  questTab('board', firstTab);
}
// ══ 독서 기록 ══
// ── 독서 기록 제출 (승인 요청) ──
// ── 독서 폼 초기화 (탭 열릴 때 호출) ──
let _bookRating = 0;
let _bookCategory = '';

function initBookForm() {
  // 칩 버튼 렌더
  const chipsEl = document.getElementById('book-category-chips');
  if (chipsEl && chipsEl.children.length === 0) {
    ['우정','가족','용기','배려','꿈·성장','자연·생명','직접입력'].forEach(c => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'book-chip';
      btn.textContent = c;
      btn.style.cssText = 'padding:.28rem .7rem;border-radius:20px;font-size:.72rem;cursor:pointer;border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:var(--txt2);font-family:inherit;transition:all .15s';
      btn.onclick = () => selectBookCategory(btn, c);
      chipsEl.appendChild(btn);
    });
  }
  // 별점 렌더
  const starsEl = document.getElementById('book-rating-stars');
  if (starsEl && starsEl.children.length === 0) {
    [1,2,3,4,5].forEach(n => {
      const span = document.createElement('span');
      span.textContent = '⭐';
      span.dataset.star = n;
      span.style.cssText = 'font-size:1.5rem;cursor:pointer;opacity:.28;transition:opacity .15s';
      span.onclick = () => selectBookRating(n);
      starsEl.appendChild(span);
    });
  }
}

function selectBookCategory(el, cat) {
  _bookCategory = cat;
  document.querySelectorAll('.book-chip').forEach(b => {
    b.style.background = 'rgba(255,255,255,.05)';
    b.style.borderColor = 'rgba(255,255,255,.15)';
    b.style.color = 'var(--txt2)';
  });
  el.style.background = 'rgba(255,215,0,.18)';
  el.style.borderColor = 'var(--gold)';
  el.style.color = 'var(--gold)';
  const customInput = document.getElementById('book-custom-category-input');
  if (customInput) customInput.style.display = cat === '직접입력' ? '' : 'none';
}

function selectBookRating(n) {
  _bookRating = n;
  document.querySelectorAll('#book-rating-stars span').forEach(s => {
    s.style.opacity = parseInt(s.dataset.star) <= n ? '1' : '.25';
  });
}

function submitBookRecord() {
  const title      = document.getElementById('book-title-input')?.value.trim() || '';
  const summary    = document.getElementById('book-summary-input')?.value.trim() || '';
  const reflection = document.getElementById('book-reflection-input')?.value.trim() || '';
  const date       = document.getElementById('book-date-input')?.value || Utils.todayStr();
  const customCat  = document.getElementById('book-custom-category-input')?.value.trim() || '';
  const charName   = document.getElementById('book-char-name-input')?.value.trim() || '';
  const charReason = document.getElementById('book-char-reason-input')?.value.trim() || '';

  if (!title)   { toast('책 제목을 입력해주세요!'); return; }
  if (!summary) { toast('줄거리를 써주세요!'); return; }
  if (!reflection) { toast('느낀 점을 써주세요!'); return; }

  const dupPending = (CUR.pendingRewards||[]).some(r => r.type==='book' && (r.bookTitle||'').trim() === title);
  const dupBooks   = (CUR.books||[]).some(b => (b.title||'').trim() === title);
  if (dupPending || dupBooks) { toast(`📚 "${title}"은 이미 등록된 책이에요!`); return; }

  CUR.pendingRewards = CUR.pendingRewards || [];
  CUR.pendingRewards.push({
    id: 'book_' + Date.now(),
    type: 'book',
    label: `📖 "${title}" 독서 기록`,
    bookTitle: title,
    category: _bookCategory,
    customCategory: _bookCategory === '직접입력' ? customCat : '',
    rating: _bookRating,
    characterName: charName,
    characterReason: charReason,
    summary,
    reflection,
    bookReview: summary + (charName ? `\n[인물: ${charName}${charReason?' — '+charReason:''}]` : '') + '\n' + reflection,
    bookDate: date,
    exp: 30, gold: 0,
    stat: '', statVal: 0,
    icon: '📚',
    date: Utils.todayStr(),
    createdAt: Date.now(),
    teacherChecked: false,
    teacherComment: '',
  });
  DB.saveStudent(CUR);

  // 폼 초기화
  ['book-title-input','book-custom-category-input','book-char-name-input','book-char-reason-input','book-summary-input','book-reflection-input'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const ci = document.getElementById('book-custom-category-input');
  if (ci) ci.style.display = 'none';
  document.querySelectorAll('.book-chip').forEach(b => {
    b.style.background='rgba(255,255,255,.05)'; b.style.borderColor='rgba(255,255,255,.15)'; b.style.color='var(--txt2)';
  });
  document.querySelectorAll('#book-rating-stars span').forEach(s => s.style.opacity = '.25');
  _bookRating = 0; _bookCategory = '';
  document.getElementById('book-date-input').value = '';

  toast('📚 독서 기록 제출! 선생님 확인 후 EXP가 지급돼요');
  renderBookRecords();
  renderMain(); renderMobile();
}

// ── 독서 기록 목록 렌더링 ──
function renderBookRecords() {
  const el = document.getElementById('book-record-list');
  if (!el) return;

  const books   = CUR.books || [];
  const pending = (CUR.pendingRewards||[]).filter(p=>p.type==='book');

  renderBookMonthlyChart(books);

  if (books.length === 0 && pending.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:1.5rem 0;color:var(--txt3);font-size:.8rem">
      아직 독서 기록이 없어요.<br>위에서 첫 번째 책을 기록해보세요! 📖</div>`;
    return;
  }

  const starStr = n => n ? '⭐'.repeat(n) : '';
  const catLabel = b => b.category === '직접입력' && b.customCategory ? b.customCategory : (b.category || '');

  const allRecords = [
    ...pending.map(p => ({ ...p, _status:'pending' })),
    ...books.slice().reverse().map(b => ({ ...b, _status:'done', bookTitle:b.title }))
  ];

  el.innerHTML = allRecords.map(r => {
    const isPending = r._status === 'pending';
    const cat = catLabel(r);

    // 구 형식(bookReview만 있는 경우) → 파싱
    let charName = r.characterName, charReason = r.characterReason;
    let summary = r.summary, reflection = r.reflection;
    const raw = r.bookReview || r.review || '';
    if (!summary && !reflection && raw) {
      const charMatch = raw.match(/\[인물:\s*([^\n\]—–-]+?)(?:\s*[—–-]\s*([^\n\]]+))?\]/);
      if (charMatch) { charName = charName || charMatch[1]?.trim(); charReason = charReason || (charMatch[2]?.trim()||''); }
      const cleanRaw = raw.replace(/\[인물:[^\]]*\]/g,'').trim();
      const lines = cleanRaw.split('\n').filter(l=>l.trim());
      if (lines.length >= 2) {
        summary    = lines.slice(0, Math.ceil(lines.length/2)).join('\n');
        reflection = lines.slice(Math.ceil(lines.length/2)).join('\n');
      } else { summary = cleanRaw; }
    }

    return `
    <div style="background:rgba(255,255,255,.04);
      border:1px solid ${isPending?'rgba(255,215,0,.2)':'rgba(46,204,113,.2)'};
      border-radius:12px;padding:.8rem .9rem;margin-bottom:.5rem">
      <!-- 헤더 -->
      <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem">
        <span style="font-size:.68rem;font-weight:700;
          background:${isPending?'rgba(255,215,0,.12)':'rgba(46,204,113,.12)'};
          color:${isPending?'var(--gold)':'var(--emerald)'};
          border-radius:20px;padding:.1rem .5rem;flex-shrink:0">
          ${isPending?'확인중':'✓ 완료'}</span>
        <span style="font-weight:700;font-size:.88rem;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${r.bookTitle||r.title||''}</span>
        ${cat?`<span style="font-size:.65rem;background:rgba(93,173,226,.12);color:var(--sky);border-radius:10px;padding:.1rem .45rem;flex-shrink:0">${cat}</span>`:''}
        ${r.rating?`<span style="font-size:.75rem;flex-shrink:0">${starStr(r.rating)}</span>`:''}
        <span style="font-size:.66rem;color:var(--txt3);flex-shrink:0">${r.bookDate||r.date||''}</span>
      </div>
      <!-- 내용 (항상 표시) -->
      <div style="display:flex;flex-direction:column;gap:.35rem;font-size:.78rem;color:var(--txt2);line-height:1.6">
        ${charName?`<div><b style="color:var(--txt3)">🧑 인상 깊은 인물:</b> ${charName}${charReason?' — '+charReason:''}</div>`:''}
        ${summary?`<div><b style="color:var(--txt3)">📖 줄거리:</b><div style="margin-top:.1rem;white-space:pre-wrap">${summary}</div></div>`:''}
        ${reflection?`<div><b style="color:var(--txt3)">💬 느낀 점:</b><div style="margin-top:.1rem;white-space:pre-wrap">${reflection}</div></div>`:''}
      </div>
      ${r.teacherComment?`<div style="margin-top:.45rem;font-size:.72rem;color:var(--emerald);
        background:rgba(46,204,113,.08);border-radius:8px;padding:.3rem .5rem">
        💬 선생님: ${r.teacherComment}</div>`:''}
    </div>`;
  }).join('');
}

// 월별 독서 막대그래프
function renderBookMonthlyChart(books) {
  const chartEl  = document.getElementById('book-monthly-chart');
  const labelEl  = document.getElementById('book-monthly-labels');
  if (!chartEl || !labelEl) return;

  // 3월~12월 고정
  const now = new Date();
  const months = [];
  for (let mo=3; mo<=12; mo++) {
    months.push({ key: now.getFullYear()+'-'+mo, label: mo+'월', count: 0 });
  }
  books.forEach(b => {
    if (!b.date) return;
    const parts = b.date.split('-');
    if (parts.length < 2) return;
    const key = parts[0]+'-'+parseInt(parts[1]);
    const mo = months.find(x=>x.key===key);
    if (mo) mo.count++;
  });

  const max = Math.max(...months.map(m=>m.count), 1);
  const barW = 'calc('+(100/months.length)+'% - 4px)';

  chartEl.innerHTML = months.map(m => {
    const h = Math.max(4, Math.round((m.count/max)*72));
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px">
      ${m.count>0?`<span style="font-size:.65rem;color:var(--gold);font-weight:700">${m.count}</span>`:''}
      <div style="width:100%;height:${h}px;border-radius:4px 4px 0 0;
        background:${m.count>0?'rgba(255,215,0,.6)':'rgba(255,255,255,.08)'};transition:height .3s"></div>
    </div>`;
  }).join('');

  labelEl.innerHTML = months.map(m =>
    `<div style="flex:1;text-align:center;font-size:.62rem;color:var(--txt3)">${m.label}</div>`
  ).join('');
}

// 구버전 toggleBookAdd/addBook/removeBook — 호환성 유지
function toggleBookAdd() {}
function addBook() {}
function removeBook(idx) {}

function renderQuestModal() {
  const quests = DB.getQuests().filter(q => q.studentId === CUR.id);
  const pending = CUR.pendingRewards||[];
  const all = [
    ...pending.map(p => ({
      name:p.label, status: p.selfApplied ? 'self' : 'claim',
      exp:p.exp, gold:p.gold, date:p.date||'오늘', icon:p.icon||'🎉'
    })),
    ...quests.slice(-10).reverse().map(q => ({
      name:q.name, status:'done', exp:q.exp, gold:q.gold, date:q.date, icon:q.icon||'📋'
    }))
  ];
  const claimBtn = ''; // 보상 자동 지급으로 받기 버튼 제거
  const statusLabel = {
    claim: `<span class="qr-status approved">🎁 받기 가능</span>`,
    self:  `<span class="qr-status waiting">📨 신청중</span>`,
    done:  `<span class="qr-status approved">✅ 완료</span>`,
  };
  document.getElementById('quest-list').innerHTML = (claimBtn||'') + (all.length > 0
    ? all.map(q => `<div class="quest-row">
        <div class="qr-icon">${q.icon}</div>
        <div class="qr-body"><div class="qr-name">${q.name}</div><div class="qr-desc">${q.date||''}</div></div>
        <div class="qr-right">
          ${statusLabel[q.status]||statusLabel.done}
          <span class="qr-rewards">${q.exp>0?`+${q.exp}EXP · `:''}${q.gold>0?`+${q.gold}G`:q.status==='self'?'보상 대기':''}</span>
        </div>
      </div>`).join('')
    : `<div style="color:var(--txt3);font-size:.82rem;padding:1rem 0">아직 활동 내역이 없어요<br>
       <span style="font-size:.72rem">✏️ 활동 신청 탭에서 오늘 활동을 알려주세요!</span></div>`);
}

// ══ 승급 시스템 ══
function openPromoModal() { openModal('m-promo'); renderPromoModal(); }

function renderPromoModal() {
  const s = CUR;
  const alreadyRequested = DB.getPromotionRequests().find(r => r.studentId === s.id);
  document.getElementById('promo-body').innerHTML = alreadyRequested ? `
    <div class="promo-emoji">⌛</div>
    <div style="font-weight:700;font-size:1.1rem;color:var(--gold);margin-bottom:.5rem">승급 신청 완료!</div>
    <div style="font-size:.85rem;color:var(--txt2)">선생님이 확인 후 승급을 승인해 드릴 거예요.</div>
    <div style="font-size:.75rem;color:var(--txt3);margin-top:.5rem">현재 레벨: Lv.${s.level}</div>
  ` : `
    <div class="promo-emoji">⬆️</div>
    <div style="font-weight:700;font-size:1.1rem;color:var(--gold);margin-bottom:.5rem">Lv.${s.level} 승급 가능!</div>
    <div style="font-size:.85rem;color:var(--txt2);margin-bottom:1rem">
      선생님께 승급을 신청하면 확인 후 승급이 완료돼요.<br>승급 시 특별 보상을 받을 수 있어요! 🎉
    </div>
    <button class="btn-gold" onclick="requestPromotion()" style="padding:.7rem 2rem">📨 승급 신청하기</button>
  `;
}

function requestPromotion() {
  const req = { id: Utils.uid(), studentId: CUR.id, studentName: CUR.name, level: CUR.level, date: Utils.todayStr() };
  const ok = DB.addPromotionRequest(req);
  if (!ok) { toast('이미 승급 신청이 되어 있어요.'); return; }
  CUR.promotionPending = true;
  DB.saveStudent(CUR);
  renderPromoModal();
  renderMain(); renderMobile(); renderHUD();
  toast('📨 승급 신청 완료! 선생님의 확인을 기다려주세요.');
}

// ── 친구 방문 전체화면 (읽기 전용) ─────────────────────
let _ffFriend = null;
let _ffScene  = 'yard';

function openFriendFullscreen(friendId) {
  const friend = typeof friendId === 'string' ? DB.getStudent(friendId) : friendId;
  if (!friend) return;
  _ffFriend = friend;
  _ffScene  = 'yard';
  const fs = document.getElementById('friend-fullscreen');
  fs.style.display = 'flex';
  document.getElementById('ff-title').textContent = friend.avatar + ' ' + friend.name + '의 집';
  document.getElementById('ff-friend-info').textContent =
    `Lv.${friend.level} · ${friend.job||'학생'} · 📚 ${friend.bookCount||0}권`;
  document.getElementById('ff-scene-btn').textContent = '🏠 집 안 보기 →';
  requestAnimationFrame(() => requestAnimationFrame(() => _renderFriendCanvas()));
}

function closeFriendFullscreen() {
  document.getElementById('friend-fullscreen').style.display = 'none';
  _ffFriend = null;
}

function toggleFriendScene() {
  _ffScene = _ffScene === 'yard' ? 'indoor' : 'yard';
  const isYard = _ffScene === 'yard';
  document.getElementById('ff-scene-btn').textContent = isYard ? '🏠 집 안 보기 →' : '🌿 마당 보기 ←';
  document.getElementById('ff-topview').innerHTML = '';
  requestAnimationFrame(() => _renderFriendCanvas());
}

function _renderFriendCanvas() {
  if (!_ffFriend) return;
  const el = document.getElementById('ff-topview');
  if (!el) return;

  const prevCUR   = CUR;
  const prevScene = DECO_SCENE;
  const prevCv    = _dCv;
  const prevCtx   = _dCtx;
  const prevW     = _dW;
  const prevH     = _dH;
  const prevC     = _dC;
  const prevIfMode = _ifMode;
  const prevCont  = _ifActiveContainer;

  // 전체화면 그리드 크기 임시 적용
  DY = {...DY_FULL};
  DI = {...DI_FULL};
  CUR        = _ffFriend;
  DECO_SCENE = _ffScene;
  _ifMode    = true;

  el.innerHTML = '';
  const cv = document.createElement('canvas');
  cv.style.cssText = 'display:block;cursor:default;touch-action:none';
  el.appendChild(cv);

  const topH = 50;
  const W    = window.innerWidth;
  const maxH = window.innerHeight - topH - 48;
  const cols = _ffScene === 'yard' ? DY.cols : DI.cols;
  const rows = _ffScene === 'yard' ? DY.rows : DI.rows;
  const C    = Math.floor(W / cols);
  const H    = Math.min(C * rows, maxH);

  _dCv  = cv; _dW = W; _dH = H; _dC = C;
  cv.width  = W * 2; cv.height = H * 2;
  cv.style.width  = W + 'px'; cv.style.height = H + 'px';
  _dCtx = cv.getContext('2d');
  _dCtx.scale(2, 2);
  _dCtx.clearRect(0, 0, W, H);
  if (_ffScene === 'yard') _drawYard();
  else _drawIndoor();

  // 복원
  CUR        = prevCUR;
  DECO_SCENE = prevScene;
  _dCv       = prevCv;
  _dCtx      = prevCtx;
  _dW        = prevW;
  _dH        = prevH;
  _dC        = prevC;
  _ifMode    = prevIfMode;
  _ifActiveContainer = prevCont;
  DY = _ifMode ? {...DY_FULL} : {...DY_NORMAL};
  DI = _ifMode ? {...DI_FULL} : {...DI_NORMAL};
}
function visitFriend(id) {
  const f = DB.getStudent(id);
  if (!f) return;
  const db = DB.load();
  const artworks = (db.artworks||[]).filter(a=>a.studentId===f.id);
  const books    = f.books||[];
  // 작품 라이트박스 목록 — 7264의 window._artLbImgs 패턴과 동일 (JSON을 onclick 속성에 직접 넣으면 따옴표로 속성이 깨짐)
  const friendArtLb = artworks.filter(x=>x.artUrl).map(x=>({url:x.artUrl,title:x.title||'',desc:x.comment||''}));
  window._friendArtLbImgs = friendArtLb;

  // 읽기 전용 Canvas 렌더러 — 기존 꾸미기 렌더러 재사용
  function renderDecoCanvas(area, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    // 임시로 전역 상태 교체
    const prevCUR       = CUR;
    const prevScene     = DECO_SCENE;
    const prevCv        = _dCv;
    const prevCtx       = _dCtx;
    const prevW         = _dW;
    const prevH         = _dH;
    const prevC         = _dC;

    CUR = f;
    DECO_SCENE = area;

    // 새 canvas 생성
    el.innerHTML = '';
    const cv = document.createElement('canvas');
    cv.style.cssText = 'width:100%;border-radius:12px;display:block';
    el.appendChild(cv);

    const cols = area==='yard' ? DY.cols : DI.cols;
    const rows = area==='yard' ? DY.rows : DI.rows;
    const W = el.offsetWidth || 340;
    const C = Math.floor(W / cols);
    const H = C * rows;

    _dCv  = cv;
    _dW   = W;
    _dH   = H;
    _dC   = C;
    cv.width  = W * 2;
    cv.height = H * 2;
    cv.style.height = H + 'px';
    _dCtx = cv.getContext('2d');
    _dCtx.scale(2, 2);

    // 렌더 (편집 이벤트 없이)
    _dCtx.clearRect(0, 0, W, H);
    if (area === 'yard') _drawYard();
    else _drawIndoor();

    // 전역 상태 복원
    CUR       = prevCUR;
    DECO_SCENE = prevScene;
    _dCv      = prevCv;
    _dCtx     = prevCtx;
    _dW       = prevW;
    _dH       = prevH;
    _dC       = prevC;
  }

  const modalId = 'visit-modal-'+id;

  const el = document.createElement('div');
  el.className = 'overlay open';
  el.id = modalId+'-overlay';
  el.innerHTML = `<div class="modal" style="max-width:460px">
    <div class="modal-hd">
      <div class="modal-title">${f.avatar} ${f.name}의 집</div>
      <button class="modal-close" onclick="this.closest('.overlay').remove()">✕</button>
    </div>
    <!-- 프로필 -->
    <div style="display:flex;align-items:center;gap:.9rem;padding:.75rem;
      background:rgba(255,255,255,.04);border-radius:12px;margin-bottom:.8rem">
      <div style="font-size:2.8rem">${f.avatar}</div>
      <div>
        <div style="font-weight:700">${f.name}
          ${f.title?`<span style="font-size:.72rem;color:var(--gold);margin-left:.3rem">[${f.title}]</span>`:''}
        </div>
        <div style="font-size:.76rem;color:var(--txt2);margin-top:.2rem">
          Lv.${f.level} · 📚${f.bookCount||0}권 · ⚔️${(f.monsterLog||[]).length}마리
        </div>
      </div>
    </div>
    <!-- 탭 -->
    <div class="modal-tabs" style="margin-bottom:.8rem" id="${modalId}-tabs">
      <button class="mtab on" onclick="openFriendFullscreen('${id}')">🌸 인테리어 보기</button>
      <button class="mtab"    onclick="vfTab('${modalId}','books',this)">📚 독서</button>
      <button class="mtab"    onclick="vfTab('${modalId}','artwork',this)">🖼️ 작품</button>
    </div>
    <!-- 인테리어 탭 (전체화면으로 열림) -->
    <div id="${modalId}-deco">
      <div style="text-align:center;padding:1.5rem 0;color:var(--txt3);font-size:.82rem">
        위의 "🌸 인테리어 보기" 버튼을 눌러주세요
      </div>
    </div>
    <!-- 독서 탭 -->
    <div id="${modalId}-books" style="display:none">
      ${books.length===0
        ? '<div style="text-align:center;padding:1.5rem;color:var(--txt3);font-size:.8rem">아직 독서 기록이 없어요 📚</div>'
        : books.slice().reverse().map((b,i)=>`
          <div style="display:flex;align-items:flex-start;gap:.6rem;padding:.5rem 0;
            border-bottom:1px solid rgba(255,255,255,.05)">
            <span style="font-size:.7rem;color:var(--txt3);min-width:24px;flex-shrink:0">#${books.length-i}</span>
            <div style="flex:1">
              <div style="font-size:.86rem;font-weight:600">${escHtml(b.title)}</div>
              ${b.review?`<div style="font-size:.72rem;color:var(--txt2);margin-top:.15rem;line-height:1.5">
                ${escHtml(b.review.length>80?b.review.slice(0,80)+'...':b.review)}</div>`:''}
            </div>
            <span style="font-size:.68rem;color:var(--txt3);flex-shrink:0">${b.date||''}</span>
          </div>`).join('')}
    </div>
    <!-- 작품 탭 -->
    <div id="${modalId}-artwork" style="display:none">
      ${artworks.length===0
        ? '<div style="text-align:center;padding:1.5rem;color:var(--txt3);font-size:.8rem">전시된 작품이 없어요 🎨</div>'
        : `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.6rem">
            ${artworks.map((a,i)=>a.artUrl?`
              <div style="border-radius:10px;overflow:hidden;cursor:pointer"
                onclick="openLightbox(window._friendArtLbImgs,${friendArtLb.findIndex(x=>x.url===a.artUrl)})">
                <img src="${a.artUrl}" style="width:100%;aspect-ratio:1;object-fit:cover">
                <div style="padding:.3rem .4rem;font-size:.72rem;font-weight:600;background:rgba(255,255,255,.04)">${escHtml(a.title||'')}</div>
              </div>`:''
            ).join('')}
           </div>`}
    </div>
  </div>`;

  el.addEventListener('click', e => { if(e.target===el) el.remove(); });
  document.body.appendChild(el);
  // DOM에 붙은 후 canvas 렌더 (offsetWidth 계산 위해 requestAnimationFrame)
  requestAnimationFrame(() => {
    renderDecoCanvas('yard',   `${modalId}-yard`);
    renderDecoCanvas('indoor', `${modalId}-indoor`);
  });
}

function vfTab(modalId, tab, btn) {
  ['deco','books','artwork'].forEach(t => {
    const el = document.getElementById(modalId+'-'+t);
    if (el) el.style.display = t===tab ? '' : 'none';
  });
  document.querySelectorAll('#'+modalId+'-tabs .mtab').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
}

// ══ 레이아웃 모드 토글 ══
const STORAGE_KEYS = Object.freeze({
  LAYOUT_MODE: 'layoutMode',
  SCALE_MODE:  'scaleMode',
});
let LAYOUT_MODE = localStorage.getItem(STORAGE_KEYS.LAYOUT_MODE) || 'desktop';
let SCALE_MODE  = localStorage.getItem(STORAGE_KEYS.SCALE_MODE) === 'true'; // 비율 스케일링 on/off
const SCALE_BASE_WIDTH = 2560; // QHD 모니터 기준

function applyScale() {
  const game = document.getElementById('s-game');
  if (!game) return;
  if (SCALE_MODE && LAYOUT_MODE === 'desktop') {
    const ratio = Math.min(window.innerWidth / SCALE_BASE_WIDTH, 1); // 1440px 이상은 스케일 안함
    const h = window.innerHeight / ratio;
    game.style.transformOrigin = 'top left';
    game.style.transform = `scale(${ratio})`;
    game.style.width  = SCALE_BASE_WIDTH + 'px';
    game.style.height = h + 'px';
  } else {
    game.style.transform = '';
    game.style.width  = '';
    game.style.height = '';
  }
}

function applyLayout(mode) {
  LAYOUT_MODE = mode;
  localStorage.setItem(STORAGE_KEYS.LAYOUT_MODE, mode);
  const game = document.getElementById('s-game');
  const btn  = document.getElementById('layout-toggle-btn');
  if (!game) return;

  game.classList.remove('force-mobile', 'force-desktop');
  if (mode === 'mobile') {
    game.classList.add('force-mobile');
    if (btn) btn.textContent = '📱 모바일';
    const mainTab = document.getElementById('mob-main-tab');
    if (mainTab) {
      document.querySelectorAll('.main-tab-content, .mobile-char-panel').forEach(el => el.classList.remove('active-tab'));
      mainTab.classList.add('active-tab');
      document.querySelectorAll('.btab').forEach(b => b.classList.remove('active'));
      const homeBtn = document.getElementById('bt-home');
      if (homeBtn) homeBtn.classList.add('active');
    }
  } else {
    if (btn) btn.textContent = '🖥️ 데스크탑';
  }
  applyScale();
}

function toggleLayout() {
  applyLayout(LAYOUT_MODE === 'desktop' ? 'mobile' : 'desktop');
}

function toggleScaleMode() {
  SCALE_MODE = !SCALE_MODE;
  localStorage.setItem(STORAGE_KEYS.SCALE_MODE, SCALE_MODE);
  const btn = document.getElementById('scale-mode-btn');
  if (btn) btn.textContent = SCALE_MODE ? '🔍 비율고정 ON' : '🔍 비율고정';
  applyScale();
}

// 창 크기 바뀔 때 자동 재계산
window.addEventListener('resize', applyScale);


function triggerLevelUp(newLv) {
  const fx = document.getElementById('lup-fx');
  document.getElementById('lup-sub').textContent = `Lv.${newLv}이 되었습니다!`;
  const isPromo = Utils.isPromotionLevel(newLv);
  document.getElementById('lup-promo').textContent = isPromo ? '🎊 승급 가능 레벨 도달! HUD에서 승급 신청을 해보세요!' : '';
  fx.classList.add('show');
  const pw = document.getElementById('lup-particles');
  pw.innerHTML = '';
  const colors = ['#FFD700','#FF8C00','#2ECC71','#5DADE2','#9B59B6','#E74C3C'];
  for (let i=0;i<24;i++) {
    const p = document.createElement('div'); p.className = 'particle';
    p.style.cssText = `left:50%;top:50%;background:${colors[i%colors.length]};
      --tx:${(Math.random()-.5)*500}px;--ty:${(Math.random()-1)*500}px;
      animation-delay:${Math.random()*.3}s;animation-duration:${1.5+Math.random()}s;`;
    pw.appendChild(p);
  }
  setTimeout(() => fx.classList.remove('show'), 3000);
}

// ══ 업적 ══
// ══ 랭킹 ══
function buildRankingHTML(students) {
  const medals = ['🥇','🥈','🥉'];
  const categories = [
    { label:'레벨',   key: s => s.level||0,       fmt: (s,v) => `Lv.${v}` },
    { label:'퀘스트', key: s => s.totalQuests||0,  fmt: (s,v) => `${v}개` },
    { label:'골드',   key: s => _totalGold(s),     fmt: (s,v) => `${v.toLocaleString()}G` },
    { label:'독서',   key: s => s.bookCount||0,    fmt: (s,v) => `${v}권` },
  ];
  const rows = categories.map(cat => {
    const top3 = students.slice().sort((a,b) => cat.key(b)-cat.key(a)).slice(0,3);
    const items = top3.map((s,i) => `
      <div style="display:flex;align-items:center;gap:.5rem;padding:.5rem .7rem;
        background:rgba(255,255,255,.05);border-radius:10px;flex:1;min-width:0">
        <span style="font-size:1.3rem;flex-shrink:0">${medals[i]}</span>
        <span style="font-size:1rem;flex-shrink:0">${s.avatar||''}</span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.name}</div>
          <div style="font-size:.73rem;color:var(--gold);font-weight:700">${cat.fmt(s,cat.key(s))}</div>
        </div>
      </div>`).join('');
    return `<div style="margin-bottom:.9rem">
      <div style="font-size:.7rem;color:var(--txt3);font-weight:700;margin-bottom:.35rem;padding-left:.1rem">${cat.label}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.35rem">${items}</div>
    </div>`;
  }).join('');
  return rows;
}

function _totalGold(s) {
  // totalGold 필드 우선, 없으면 현재 gold (하위 호환)
  return s.totalGold || s.gold || 0;
}

function renderRankingModal() {
  const students = DB.getStudents();
  const el = document.getElementById('rank-modal-body');
  if (el) el.innerHTML = buildRankingHTML(students);
}

function renderAchievements() {
  const earned = new Set(CUR.achievements || []);
  const doneList   = ACHIEVEMENTS.filter(a =>  earned.has(a.id));
  const lockedList = ACHIEVEMENTS.filter(a => !earned.has(a.id));
  const el = document.getElementById('ach-list');

  const rewardText = a => {
    const parts = [];
    if (a.reward.exp)   parts.push(`+${a.reward.exp}EXP`);
    parts.push('+20G');
    if (a.reward.title) parts.push(`칭호 "${a.reward.title}"`);
    if (a.reward.deco)  parts.push('특별 장식');
    return parts.join(' · ');
  };

  const render = (list, locked) => list.map(a => `
    <div class="ach-item ${locked?'locked':''}">
      <div class="ach-icon">${a.icon}</div>
      <div class="ach-body">
        <div class="ach-name">${a.name}</div>
        <div class="ach-desc">${a.desc}</div>
        <div class="ach-reward">🎁 ${rewardText(a)}</div>
      </div>
      <div class="ach-badge ${locked?'locked':'done'}">${locked?'🔒':'✅'}</div>
    </div>`).join('');

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
      <div style="font-size:.82rem;color:var(--txt2)">달성 <span style="color:var(--gold);font-weight:700">${doneList.length}</span> / 전체 ${ACHIEVEMENTS.length}</div>
      <div style="font-size:.72rem;color:var(--txt3)">업적 달성 시 EXP·골드·칭호 획득!</div>
    </div>
    <div style="height:6px;background:rgba(255,255,255,.07);border-radius:3px;margin-bottom:1.2rem;overflow:hidden">
      <div style="height:100%;width:${Math.round(doneList.length/ACHIEVEMENTS.length*100)}%;background:linear-gradient(90deg,var(--gold),var(--gold2));border-radius:3px;transition:width .6s ease"></div>
    </div>
    ${doneList.length > 0 ? `<div style="font-size:.72rem;color:var(--txt3);margin-bottom:.5rem">✅ 달성한 업적 (${doneList.length})</div>${render(doneList, false)}` : ''}
    <div style="font-size:.72rem;color:var(--txt3);margin:.8rem 0 .5rem">🔒 미달성 업적 (${lockedList.length})</div>
    ${render(lockedList, true)}`;
}

// 포트폴리오 내 업적 탭 전용 렌더 (house-ach-list에 출력)
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
        <div style="font-size:.82rem;color:var(--txt2);margin-bottom:.3rem">🏖️ 주말: ${g.weekendText||''}</div>
        <div style="font-size:.82rem;color:var(--txt2);margin-bottom:.3rem">😊 기분: ${g.weekendMood||''}</div>
        <div style="font-size:.82rem;color:var(--txt2);margin-bottom:.3rem">💪 노력할 것: ${g.focusArea||''}</div>
        <div style="font-size:.82rem;color:var(--txt2);margin-bottom:.3rem">🎯 목표: ${g.goalText||''}</div>
        <div style="font-size:.82rem;color:var(--txt2)">🌟 마음가짐: ${g.mindset||''}</div>
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

  const focusQ   = goal ? `이번 주 나는 <strong style="color:var(--sky)">'${goal.focusArea}'</strong>를 얼마나 노력했나요?` : '이번 주 얼마나 노력했나요?';
  const goalQ    = goal ? `이번 주 나는 <strong style="color:var(--sky)">'${goal.goalText}'</strong>를 어떻게 해냈나요?` : '이번 주 목표를 어떻게 해냈나요?';
  const mindsetQ = goal ? `이번 주 나는 <strong style="color:var(--sky)">'${goal.mindset||"마음가짐"}'</strong>으로 지내려고 얼마나 노력했나요?` : '이번 주 마음가짐을 얼마나 지켰나요?';

  return `
    <div style="padding:.8rem 1rem;display:flex;flex-direction:column;gap:1.1rem">
      ${goal ? `
      <div style="background:rgba(255,215,0,.07);border:1px solid rgba(255,215,0,.2);
        border-radius:12px;padding:.8rem;font-size:.8rem">
        <div style="font-size:.72rem;color:var(--gold);font-weight:700;margin-bottom:.5rem">📅 이번 주 월요일 다짐</div>
        <div style="color:var(--txt2);margin-bottom:.2rem">🏖️ 주말에 한 일: <b>${goal.weekendText||''}</b></div>
        <div style="color:var(--txt2);margin-bottom:.2rem">😊 주말 기분: <b>${goal.weekendMood||''}</b></div>
        <div style="color:var(--txt2);margin-bottom:.2rem">💪 노력할 것: <b>${goal.focusArea||''}</b></div>
        <div style="color:var(--txt2);margin-bottom:.2rem">🎯 목표: <b>${goal.goalText||''}</b></div>
        <div style="color:var(--txt2)">🌟 마음가짐: <b>${goal.mindset||''}</b></div>
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
        <div style="color:var(--txt2);margin-bottom:.2rem">💪 ${goal.focusArea}</div>
        <div style="color:var(--txt2)">🎯 ${goal.goalText}</div>
      </div>` : ''}
      <div style="background:rgba(46,204,113,.07);border:1px solid rgba(46,204,113,.2);
        border-radius:12px;padding:.9rem;margin-bottom:.7rem">
        <div style="font-size:.72rem;color:var(--emerald);font-weight:700;margin-bottom:.6rem">✅ 이번 주 돌아보기 완료</div>
        <div style="font-size:.82rem;color:var(--txt2);margin-bottom:.3rem">📊 노력: ${ref.focusReflection||''}</div>
        <div style="font-size:.82rem;color:var(--txt2);margin-bottom:.3rem">🎯 목표: ${ref.goalReflection||''}</div>
        <div style="font-size:.82rem;color:var(--txt2);margin-bottom:.3rem">🌟 마음가짐: ${ref.mindsetReflection||''}</div>
        <div style="font-size:.82rem;color:var(--txt2);margin-bottom:.3rem">⭐ 잘한 것: ${ref.bestMoment||''}</div>
        <div style="font-size:.82rem;color:var(--txt2)">➡️ 다음 주: ${ref.nextWeekGoal||''}</div>
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
  if (!mindsetReflection) { toast('마음가짐 성찰을 선택해주세요!'); return; }
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
          <div style="margin-bottom:.2rem">🏖️ ${goal.weekendText||''} <span style="color:var(--txt3)">(${goal.weekendMood||''})</span></div>
          <div style="margin-bottom:.2rem">💪 노력할 것: <b>${goal.focusArea||''}</b></div>
          <div style="margin-bottom:.2rem">🎯 목표: <b>${goal.goalText||''}</b></div>
          <div>🌟 마음가짐: <b>${goal.mindset||''}</b></div>
        </div>`:'<div style="font-size:.75rem;color:var(--txt3);padding:.3rem 0">월요일 다짐 없음</div>'}
        ${ref?`<div style="font-size:.78rem;color:var(--txt2);padding:.6rem;
          background:rgba(46,204,113,.05);border-radius:8px;border:1px solid rgba(46,204,113,.1)">
          <div style="font-size:.68rem;color:var(--emerald);font-weight:700;margin-bottom:.35rem">📅 금요일 돌아보기</div>
          <div style="margin-bottom:.2rem">📊 노력: ${ref.focusReflection||''}</div>
          <div style="margin-bottom:.2rem">🎯 목표: ${ref.goalReflection||''}</div>
          <div style="margin-bottom:.2rem">🌟 마음가짐: ${ref.mindsetReflection||''}</div>
          <div style="margin-bottom:.2rem">⭐ 잘한 것: ${ref.bestMoment||''}</div>
          <div>➡️ 다음 주: ${ref.nextWeekGoal||''}</div>
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

// ══════════════════════════════════════════════════════
//  영어 단어장 + 팝업 퀴즈
// ══════════════════════════════════════════════════════

const VOCAB_CATEGORIES = ['school','people','family','food','drink','animal','body','clothes','nature',
  'time','place','transport','adjective','verb','number','color','home','position','question','greeting','basic','subject','activity','quantity'];
const VOCAB_POS = ['noun','verb','adjective','adverb','pronoun','preposition','conjunction','interjection','number','other'];

// ── 포트폴리오 단어장 탭 렌더 ─────────────────────────
function renderVocabTab() {
  const el = document.getElementById('vocab-tab-content');
  if (!el) return;
  const ws       = DB.getActiveWordSet();
  const allWords = DB.getAllVocabWords();
  const records  = DB.getQuizRecords(CUR.id);
  const wrongIds = [...new Set(records.flatMap(r => r.wrongWordIds || []))];
  const wrongWords = wrongIds.map(id => allWords.find(w => w.id === id)).filter(Boolean);
  const setWords   = ws ? (ws.wordIds || []).map(id => allWords.find(w => w.id === id)).filter(Boolean) : [];

  // 통계
  const totalQuiz  = records.length;
  const totalRight = records.reduce((s, r) => s + r.correct, 0);
  const totalQ     = records.reduce((s, r) => s + r.total, 0);
  const accuracy   = totalQ > 0 ? Math.round(totalRight / totalQ * 100) : 0;

  // 현재 내부 탭 (없으면 기본 '단어')
  if (!window._vocabSubTab) window._vocabSubTab = 'words';

  const subTabStyle = (t) =>
    `padding:.3rem .9rem;border-radius:20px;font-size:.78rem;font-family:inherit;cursor:pointer;border:none;font-weight:700;` +
    (window._vocabSubTab === t
      ? `background:var(--gold);color:#1a1a1a;`
      : `background:rgba(255,255,255,.07);color:var(--txt3);`);

  // 내부 탭 콘텐츠
  function subContent() {
    if (window._vocabSubTab === 'words') {
      if (setWords.length === 0) return `
        <div style="text-align:center;padding:2rem 0;color:var(--txt3);font-size:.82rem">
          선생님이 단어 세트를 지정하면 여기에 표시돼요</div>`;

      // 암기 모드 상태 초기화
      if (!window._vocabMemMode) window._vocabMemMode = 'normal';
      if (!window._vocabShuffled) window._vocabShuffled = [...setWords];
      if (!window._vocabRevealed) window._vocabRevealed = new Set();

      const words = window._vocabShuffled;
      const mode  = window._vocabMemMode;

      const modeBtn = (m, label, active) =>
        `<button onclick="setVocabMemMode('${m}')"
          style="font-size:.75rem;padding:.3rem .8rem;border-radius:20px;border:none;
            cursor:pointer;font-family:inherit;font-weight:700;transition:.15s;
            background:${active?'var(--sky)':'rgba(255,255,255,.08)'};
            color:${active?'#0a1628':'var(--txt3)'}">
          ${label}
        </button>`;

      const cardRows = words.map((w, i) => {
        const revealed = window._vocabRevealed.has(w.id);

        if (mode === 'hide-meaning') {
          // 단어 보임 / 뜻 가림
          return `<div onclick="toggleVocabReveal('${w.id}')" style="cursor:pointer;
            background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);
            border-radius:12px;padding:.6rem .8rem;display:flex;align-items:center;
            gap:.6rem;transition:.15s;user-select:none"
            onmouseenter="this.style.background='rgba(255,255,255,.09)'"
            onmouseleave="this.style.background='rgba(255,255,255,.04)'"
            title="탭하면 뜻 보기">
            <div style="flex:1;min-width:0">
              <div style="font-weight:800;font-size:.95rem;color:var(--sky)">${w.word}</div>
              <div style="font-size:.8rem;margin-top:.15rem;${revealed?'color:var(--gold)':'background:rgba(255,255,255,.08);border-radius:6px;color:transparent;user-select:none'}">
                ${w.meaning.split(',')[0]}
              </div>
            </div>
            <span style="font-size:.8rem;color:${revealed?'var(--gold)':'var(--txt3)'}">${revealed?'👁️':'🙈'}</span>
          </div>`;

        } else if (mode === 'hide-word') {
          // 뜻 보임 / 단어 첫글자만
          const first = w.word[0];
          const rest  = '_'.repeat(Math.max(0, w.word.length - 1));
          return `<div onclick="toggleVocabReveal('${w.id}')" style="cursor:pointer;
            background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);
            border-radius:12px;padding:.6rem .8rem;display:flex;align-items:center;
            gap:.6rem;transition:.15s;user-select:none"
            onmouseenter="this.style.background='rgba(255,255,255,.09)'"
            onmouseleave="this.style.background='rgba(255,255,255,.04)'"
            title="탭하면 단어 보기">
            <div style="flex:1;min-width:0">
              <div style="font-weight:800;font-size:.95rem;
                color:${revealed?'var(--sky)':'var(--txt1)'}">
                ${revealed ? w.word : `<span style="color:var(--sky)">${first}</span><span style="color:var(--txt3);letter-spacing:.1em">${rest}</span>`}
              </div>
              <div style="font-size:.8rem;color:var(--gold);margin-top:.15rem">${w.meaning.split(',')[0]}</div>
            </div>
            <span style="font-size:.8rem;color:${revealed?'var(--sky)':'var(--txt3)'}">${revealed?'👁️':'🙈'}</span>
          </div>`;

        } else {
          // 일반 모드
          return `<div onclick="speakWord('${w.word.replace(/'/g, "\\'")}')"
            style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);
              border-radius:12px;padding:.55rem .75rem;display:flex;align-items:center;gap:.5rem;
              cursor:pointer;transition:.15s"
            onmouseenter="this.style.background='rgba(255,255,255,.09)'"
            onmouseleave="this.style.background='rgba(255,255,255,.04)'"
            title="탭하면 발음">
            <span style="font-size:.8rem;flex-shrink:0">🔊</span>
            <div style="flex:1;min-width:0">
              <div style="font-weight:800;font-size:.88rem;color:var(--sky)">${w.word}</div>
              <div style="font-size:.72rem;color:var(--txt3)">${w.meaning.split(',')[0]}</div>
            </div>
          </div>`;
        }
      });

      return `
        <!-- 암기 모드 선택 -->
        <div style="display:flex;gap:.35rem;flex-wrap:wrap;margin-bottom:.7rem;align-items:center">
          ${modeBtn('normal',      '📖 일반',        mode==='normal')}
          ${modeBtn('hide-meaning','🙈 뜻 가리기',   mode==='hide-meaning')}
          ${modeBtn('hide-word',   '🔤 단어 가리기', mode==='hide-word')}
          ${mode !== 'normal' ? `
          <button onclick="shuffleVocabWords()" title="순서 바꾸기"
            style="font-size:.75rem;padding:.3rem .8rem;border-radius:20px;border:none;
              cursor:pointer;font-family:inherit;background:rgba(255,255,255,.06);
              color:var(--txt3);margin-left:auto">
            🔀 순서 바꾸기
          </button>` : ''}
        </div>
        <!-- 단어 그리드 -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem">
          ${cardRows.join('')}
        </div>`;

    } else if (window._vocabSubTab === 'wrong') {
      if (wrongWords.length === 0) return `
        <div style="text-align:center;padding:2rem 0;color:var(--txt3);font-size:.82rem">
          🎉 아직 틀린 단어가 없어요!</div>`;
      return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem">
        ${wrongWords.map(w => `
          <div onclick="speakWord('${w.word.replace(/'/g, "\\'")}')"
            style="background:rgba(231,76,60,.07);border:1px solid rgba(231,76,60,.18);
              border-radius:12px;padding:.55rem .75rem;display:flex;align-items:center;gap:.5rem;
              cursor:pointer;transition:.15s"
            onmouseenter="this.style.background='rgba(231,76,60,.13)'"
            onmouseleave="this.style.background='rgba(231,76,60,.07)'"
            title="탭하면 발음">
            <span style="font-size:.8rem;flex-shrink:0">🔊</span>
            <div style="flex:1;min-width:0">
              <div style="font-weight:800;font-size:.88rem;color:var(--red);
                overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${w.word}</div>
              <div style="font-size:.72rem;color:var(--txt3)">${w.meaning.split(',')[0]}</div>
            </div>
          </div>`).join('')}
      </div>`;

    } else { // records
      if (records.length === 0) return `
        <div style="text-align:center;padding:2rem 0;color:var(--txt3);font-size:.82rem">
          아직 퀴즈 기록이 없어요</div>`;
      return `<div style="display:flex;flex-direction:column;gap:.35rem">
        ${records.slice(0, 20).map(r => {
          const pct = Math.round(r.correct / r.total * 100);
          const col = pct === 100 ? 'var(--emerald)' : pct >= 60 ? 'var(--gold)' : 'var(--red)';
          return `<div style="display:flex;align-items:center;gap:.6rem;padding:.4rem .6rem;
            background:rgba(255,255,255,.03);border-radius:10px">
            <span style="font-size:.7rem;color:var(--txt3);min-width:72px">${r.date}</span>
            <div style="flex:1;height:7px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${col};border-radius:4px;transition:width .4s"></div>
            </div>
            <span style="font-size:.8rem;font-weight:700;color:${col};min-width:36px;text-align:right">
              ${r.correct}/${r.total}</span>
            ${pct === 100 ? '<span style="font-size:.7rem">✨</span>' : ''}
          </div>`;
        }).join('')}
      </div>`;
    }
  }

  el.innerHTML = `
  <!-- ─── 헤더 영역 ─── -->
  <div style="margin-bottom:1rem">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:.6rem">
      <div>
        <div style="font-size:.7rem;color:var(--sky);font-weight:700;margin-bottom:.15rem">🔤 영어 단어장</div>
        <div style="font-size:1rem;font-weight:800;color:var(--txt1)">
          ${ws ? ws.title : '단어 세트 없음'}</div>
        ${ws ? `<div style="font-size:.7rem;color:var(--txt3);margin-top:.1rem">이번 학습 단어 ${setWords.length}개</div>` : ''}
      </div>
      ${wrongWords.length > 0 ? `
      <button onclick="window._vocabSubTab='wrong';renderVocabTab()"
        style="font-size:.7rem;padding:.25rem .65rem;border-radius:10px;border:1px solid rgba(231,76,60,.35);
          background:rgba(231,76,60,.1);color:var(--red);cursor:pointer;font-family:inherit;white-space:nowrap">
        🔁 틀린 단어 ${wrongWords.length}개
      </button>` : ''}
    </div>

    <!-- 큰 퀴즈 시작 버튼 -->
    ${ws ? `<button onclick="startVocabQuiz()"
      style="width:100%;background:linear-gradient(135deg,var(--gold),#e67e22);border:none;
        color:#1a1a1a;font-weight:800;font-size:.95rem;padding:.75rem;
        border-radius:14px;cursor:pointer;font-family:inherit;letter-spacing:.02em;
        box-shadow:0 4px 16px rgba(255,215,0,.3)">
      📝 퀴즈 시작 — ${setWords.length}개 단어
    </button>` : `<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
      border-radius:12px;padding:.8rem;text-align:center;color:var(--txt3);font-size:.8rem">
      선생님이 단어 세트를 지정하면 퀴즈를 풀 수 있어요</div>`}
  </div>

  <!-- ─── 요약 카드 3개 ─── -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-bottom:1rem">
    <div style="background:rgba(255,255,255,.06);border-radius:12px;padding:.65rem;text-align:center">
      <div style="font-size:1.4rem;font-weight:800;color:var(--gold)">${totalQuiz}</div>
      <div style="font-size:.65rem;color:var(--txt3);margin-top:.1rem">총 퀴즈</div>
    </div>
    <div style="background:rgba(255,255,255,.06);border-radius:12px;padding:.65rem;text-align:center">
      <div style="font-size:1.4rem;font-weight:800;color:var(--emerald)">${accuracy}%</div>
      <div style="font-size:.65rem;color:var(--txt3);margin-top:.1rem">정답률</div>
    </div>
    <div style="background:rgba(255,255,255,.06);border-radius:12px;padding:.65rem;text-align:center">
      <div style="font-size:1.4rem;font-weight:800;color:var(--red)">${wrongIds.length}</div>
      <div style="font-size:.65rem;color:var(--txt3);margin-top:.1rem">헷갈린 단어</div>
    </div>
  </div>

  <!-- ─── 내부 탭 ─── -->
  <div style="display:flex;gap:.35rem;margin-bottom:.7rem">
    <button onclick="window._vocabSubTab='words';renderVocabTab()" style="${subTabStyle('words')}">
      학습 단어</button>
    <button onclick="window._vocabSubTab='wrong';renderVocabTab()" style="${subTabStyle('wrong')}">
      틀린 단어 ${wrongWords.length > 0 ? `<span style="background:var(--red);color:#fff;border-radius:10px;padding:.05rem .35rem;font-size:.65rem;margin-left:.2rem">${wrongWords.length}</span>` : ''}</button>
    <button onclick="window._vocabSubTab='records';renderVocabTab()" style="${subTabStyle('records')}">
      퀴즈 기록</button>
  </div>

  <!-- ─── 내부 탭 콘텐츠 ─── -->
  <div id="vocab-sub-content">
    ${subContent()}
  </div>`;
}


// ── 암기 모드 ─────────────────────────────────────────
function setVocabMemMode(mode) {
  window._vocabMemMode  = mode;
  window._vocabRevealed = new Set();
  // 모드 진입 시 항상 셔플
  const ws = DB.getActiveWordSet();
  const allWords = DB.getAllVocabWords();
  const setWords = ws ? (ws.wordIds||[]).map(id=>allWords.find(w=>w.id===id)).filter(Boolean) : [];
  window._vocabShuffled = [...setWords].sort(()=>Math.random()-.5);
  renderVocabTab();
}

function shuffleVocabWords() {
  window._vocabRevealed = new Set();
  window._vocabShuffled = [...(window._vocabShuffled||[])].sort(()=>Math.random()-.5);
  renderVocabTab();
}

function toggleVocabReveal(wordId) {
  if (!window._vocabRevealed) window._vocabRevealed = new Set();
  if (window._vocabRevealed.has(wordId)) {
    window._vocabRevealed.delete(wordId);
  } else {
    window._vocabRevealed.add(wordId);
  }
  // 전체 재렌더 대신 해당 카드만 토글 (성능)
  renderVocabTab();
}
function speakWord(word) {
  if (!word) return;
  if (!window.speechSynthesis) { toast('이 기기는 발음 기능을 지원하지 않아요'); return; }
  // 이전 발음 중단
  window.speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(word);
  utter.lang = 'en-US';
  utter.rate = 0.85;   // 약간 느리게 — 학생이 듣기 좋게
  utter.pitch = 1.0;

  // 가장 자연스러운 영어 음성 선택
  const voices = window.speechSynthesis.getVoices();
  const preferred = [
    'Samantha','Alex','Daniel','Karen','Moira', // 좋은 영어 음성들
    'Google US English','Microsoft Zira','Microsoft David'
  ];
  const enVoices = voices.filter(v => v.lang.startsWith('en'));
  let best = null;
  for (const name of preferred) {
    best = enVoices.find(v => v.name.includes(name));
    if (best) break;
  }
  if (!best && enVoices.length > 0) best = enVoices[0];
  if (best) utter.voice = best;

  window.speechSynthesis.speak(utter);
}

// 음성 목록 미리 로드 (일부 브라우저 필요)
if (window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
function checkVocabQuizTrigger() {
  if (!CUR) return;
  const ws = DB.getActiveWordSet();
  if (!ws || !ws.wordIds || ws.wordIds.length < 3) return;
  const today = Utils.todayStr();
  const lastKey = `vocab_quiz_shown_${CUR.id}_${today}`;
  if (localStorage.getItem(lastKey)) return; // 하루 1회
  // 로그인 10초 후 팝업
  setTimeout(() => {
    if (document.getElementById('m-vocab-quiz')?.style.display === 'flex') return;
    startPopupQuiz(); // 바로 퀴즈 시작 (선택 화면 없음)
  }, 10000);
}

// ── 팝업 강제 퀴즈 (3문제 객관식, 닫기 불가) ────────────
function startPopupQuiz() {
  const ws = DB.getActiveWordSet();
  if (!ws) return;
  const allWords = DB.getAllVocabWords();
  const quizWords = (ws.wordIds||[]).map(id=>allWords.find(w=>w.id===id)).filter(Boolean);
  if (quizWords.length < 3) return;

  const records = DB.getQuizRecords(CUR.id);
  const recentWrongIds = new Set(records.slice(0,5).flatMap(r=>r.wrongWordIds||[]));
  const weighted = quizWords.flatMap(w =>
    Array(recentWrongIds.has(w.id)?3:2).fill(w)
  );

  // 3문제 선택
  const picked = [];
  const used = new Set();
  for (const w of [...weighted].sort(()=>Math.random()-.5)) {
    if (!used.has(w.id)) { picked.push(w); used.add(w.id); }
    if (picked.length >= 3) break;
  }
  while (picked.length < 3) {
    const w = quizWords.find(w=>!used.has(w.id));
    if (!w) break;
    picked.push(w); used.add(w.id);
  }

  // 3문제 모두 객관식 (mc_meaning / mc_word 랜덤)
  const types = ['mc_meaning','mc_meaning','mc_word'].sort(()=>Math.random()-.5);

  VOCAB_QUIZ = {
    questions: picked.map((w,i)=>({word:w, type:types[i]||'mc_meaning'})),
    cur:0, correct:0, wrongIds:[],
    wordIds: picked.map(w=>w.id),
    isPopup: true  // 팝업 퀴즈 플래그
  };

  // 닫기 버튼 숨기기 + 오버레이 클릭 차단
  const closeBtn = document.getElementById('vq-close-btn');
  if (closeBtn) closeBtn.style.display = 'none';
  const overlay = document.getElementById('m-vocab-quiz');
  if (overlay) overlay.onclick = null; // 클릭해도 안 닫힘

  // 하루 1회 기록
  localStorage.setItem(`vocab_quiz_shown_${CUR.id}_${Utils.todayStr()}`, '1');

  openModal('m-vocab-quiz');
  renderVocabQuestion();
}

function showVocabQuizPrompt() { startPopupQuiz(); } // 구버전 호환

// ── 퀴즈 생성 + 진행 ────────────────────────────────
let VOCAB_QUIZ = { questions:[], cur:0, correct:0, wrongIds:[] };

function startVocabQuiz() {
  const ws = DB.getActiveWordSet();
  if (!ws) { toast('선생님이 단어 세트를 지정하지 않았어요'); return; }
  const allWords = DB.getAllVocabWords();
  const quizWords = (ws.wordIds||[]).map(id=>allWords.find(w=>w.id===id)).filter(Boolean);
  if (quizWords.length < 3) { toast('단어가 3개 이상 있어야 퀴즈를 시작할 수 있어요'); return; }

  // 최근 틀린 단어 가중치
  const records = DB.getQuizRecords(CUR.id);
  const recentWrongIds = new Set(records.slice(0,5).flatMap(r=>r.wrongWordIds||[]));

  // 최근 3일 퀴즈 단어 (가중치 낮춤)
  const recentDate = new Date(Date.now()-3*86400000).toISOString().slice(0,10);
  const recentQuizIds = new Set(
    records.filter(r=>r.date>=recentDate).flatMap(r=>r.wordIds||[])
  );

  // 가중치 계산
  const weighted = quizWords.flatMap(w => {
    const times = recentWrongIds.has(w.id) ? 3 : recentQuizIds.has(w.id) ? 1 : 2;
    return Array(times).fill(w);
  });

  // 10문제 선택 (중복 없이)
  const picked = [];
  const used = new Set();
  const shuffled = [...weighted].sort(()=>Math.random()-.5);
  for (const w of shuffled) {
    if (!used.has(w.id)) { picked.push(w); used.add(w.id); }
    if (picked.length >= 10) break;
  }
  // 부족하면 나머지에서 채우기
  if (picked.length < 10) {
    for (const w of quizWords) {
      if (!used.has(w.id)) { picked.push(w); used.add(w.id); }
      if (picked.length >= 10) break;
    }
  }

  // 문제 유형 배분: mc_meaning×4, mc_word×2, short_meaning×2, spelling×2
  const types = ['mc_meaning','mc_meaning','mc_meaning','mc_meaning',
                 'mc_word','mc_word','short_meaning','short_meaning',
                 'spelling','spelling'].sort(()=>Math.random()-.5);

  VOCAB_QUIZ = {
    questions: picked.map((w,i)=>({word:w, type:types[i]||'mc_meaning'})),
    cur:0, correct:0, wrongIds:[],
    wordIds: picked.map(w=>w.id),
    isPopup: false  // 자체 시작 퀴즈
  };

  // 닫기 버튼 복원 + 오버레이 클릭 기본 동작
  const closeBtn = document.getElementById('vq-close-btn');
  if (closeBtn) closeBtn.style.display = '';
  const overlay = document.getElementById('m-vocab-quiz');
  if (overlay) overlay.onclick = e => { if(e.target===overlay) closeModal('m-vocab-quiz'); };

  // 하루 1회 표시 기록
  localStorage.setItem(`vocab_quiz_shown_${CUR.id}_${Utils.todayStr()}`, '1');

  openModal('m-vocab-quiz');
  renderVocabQuestion();
}

function renderVocabQuestion() {
  const body = document.getElementById('vq-body');
  const titleEl = document.getElementById('vq-title');
  if (!body) return;
  const { questions, cur } = VOCAB_QUIZ;
  if (cur >= questions.length) { finishVocabQuiz(); return; }
  const q = questions[cur];
  const { word, type } = q;

  titleEl.textContent = VOCAB_QUIZ.isPopup
    ? `🔔 오늘의 단어 확인 ${cur+1}/${questions.length}`
    : `📖 단어 퀴즈 ${cur+1}/${questions.length}`;
  const allWords = DB.getAllVocabWords();

  if (type === 'mc_meaning') {
    // 영어 → 한글 뜻 객관식
    const choices = buildVocabChoices(word, allWords, 'meaning', 4);
    body.innerHTML = `
      <div style="padding:.8rem 1rem">
        <div style="font-size:.72rem;color:var(--txt3);margin-bottom:.4rem">영어 단어의 뜻은?</div>
        <div style="font-size:1.6rem;font-weight:800;color:var(--gold);text-align:center;
          margin:.8rem 0 1rem;letter-spacing:.05em;cursor:pointer"
          onclick="speakWord('${word.word}')" title="탭하면 발음">
          ${word.word} <span style="font-size:.9rem">🔊</span></div>
        <div style="display:flex;flex-direction:column;gap:.4rem">
          ${choices.map((c,i)=>`
            <button onclick="submitVocabAnswer('${c.meaning.replace(/'/g,"\\'")}')"
              style="text-align:left;padding:.55rem .9rem;border-radius:10px;font-size:.85rem;
                font-family:inherit;cursor:pointer;border:1.5px solid rgba(255,255,255,.12);
                background:rgba(255,255,255,.05);color:var(--txt1);transition:.15s"
              onmouseenter="this.style.background='rgba(255,255,255,.1)'"
              onmouseleave="this.style.background='rgba(255,255,255,.05)'">
              ${['①','②','③','④'][i]} ${c.meaning}
            </button>`).join('')}
        </div>
      </div>`;
    // 단어 자동 발음
    setTimeout(() => speakWord(word.word), 300);

  } else if (type === 'mc_word') {
    // 한글 뜻 → 영어 객관식
    const choices = buildVocabChoices(word, allWords, 'word', 4);
    body.innerHTML = `
      <div style="padding:.8rem 1rem">
        <div style="font-size:.72rem;color:var(--txt3);margin-bottom:.4rem">한글 뜻에 맞는 영어 단어는?</div>
        <div style="font-size:1.3rem;font-weight:800;color:var(--sky);text-align:center;
          margin:.8rem 0 1rem">${word.meaning}</div>
        <div style="display:flex;flex-direction:column;gap:.4rem">
          ${choices.map((c,i)=>`
            <button onclick="submitVocabAnswer('${c.word.replace(/'/g,"\\'")}')"
              style="text-align:left;padding:.55rem .9rem;border-radius:10px;font-size:.85rem;
                font-family:inherit;cursor:pointer;border:1.5px solid rgba(255,255,255,.12);
                background:rgba(255,255,255,.05);color:var(--txt1);transition:.15s"
              onmouseenter="this.style.background='rgba(255,255,255,.1)'"
              onmouseleave="this.style.background='rgba(255,255,255,.05)'">
              ${['①','②','③','④'][i]} ${c.word}
            </button>`).join('')}
        </div>
      </div>`;

  } else if (type === 'short_meaning') {
    // 영어 → 한글 뜻 주관식
    body.innerHTML = `
      <div style="padding:.8rem 1rem">
        <div style="font-size:.72rem;color:var(--txt3);margin-bottom:.4rem">영어 단어의 한글 뜻을 쓰세요</div>
        <div style="font-size:1.6rem;font-weight:800;color:var(--gold);text-align:center;
          margin:.8rem 0 1rem;cursor:pointer"
          onclick="speakWord('${word.word}')" title="탭하면 발음">
          ${word.word} <span style="font-size:.9rem">🔊</span></div>
        <input id="vq-input" type="text" placeholder="한글 뜻 입력..."
          style="width:100%;box-sizing:border-box;padding:.5rem .8rem;border-radius:10px;font-size:.9rem;
            border:1.5px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);
            color:var(--txt1);font-family:inherit"
          onkeydown="if(event.key==='Enter')checkVocabShortAnswer()">
        <button class="btn-gold" onclick="checkVocabShortAnswer()"
          style="width:100%;margin-top:.6rem;padding:.5rem;border-radius:10px;font-size:.85rem">
          확인 →
        </button>
      </div>`;
    setTimeout(()=>document.getElementById('vq-input')?.focus(), 100);

  } else {
    // spelling: 한글 뜻 → 영어 스펠링
    body.innerHTML = `
      <div style="padding:.8rem 1rem">
        <div style="font-size:.72rem;color:var(--txt3);margin-bottom:.4rem">한글 뜻을 보고 영어 단어를 쓰세요</div>
        <div style="font-size:1.3rem;font-weight:800;color:var(--sky);text-align:center;
          margin:.8rem 0 1rem">${word.meaning}</div>
        <input id="vq-input" type="text" placeholder="영어로 입력..."
          style="width:100%;box-sizing:border-box;padding:.5rem .8rem;border-radius:10px;font-size:.9rem;
            border:1.5px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);
            color:var(--txt1);font-family:inherit;text-transform:lowercase"
          onkeydown="if(event.key==='Enter')checkVocabSpelling()">
        <button class="btn-gold" onclick="checkVocabSpelling()"
          style="width:100%;margin-top:.6rem;padding:.5rem;border-radius:10px;font-size:.85rem">
          확인 →
        </button>
      </div>`;
    setTimeout(()=>document.getElementById('vq-input')?.focus(), 100);
  }
}

function buildVocabChoices(word, allWords, field, count) {
  const need = count - 1; // 정답 제외 오답 수
  const wrong = allWords.filter(w => w.id !== word.id);
  const usedVals = new Set([word[field]]);
  const picked = [];

  // 1순위: 같은 category에서 랜덤으로 뽑기
  const sameCat = wrong.filter(w => w.category === word.category)
    .sort(() => Math.random() - .5);
  for (const w of sameCat) {
    if (picked.length >= need) break;
    if (!usedVals.has(w[field])) { picked.push(w); usedVals.add(w[field]); }
  }

  // 2순위: 부족하면 같은 pos에서 보충
  if (picked.length < need) {
    const samePos = wrong.filter(w => w.pos === word.pos && w.category !== word.category)
      .sort(() => Math.random() - .5);
    for (const w of samePos) {
      if (picked.length >= need) break;
      if (!usedVals.has(w[field])) { picked.push(w); usedVals.add(w[field]); }
    }
  }

  // 3순위: 그래도 부족하면 나머지 전체에서 보충
  if (picked.length < need) {
    const rest = wrong.filter(w => w.pos !== word.pos && w.category !== word.category)
      .sort(() => Math.random() - .5);
    for (const w of rest) {
      if (picked.length >= need) break;
      if (!usedVals.has(w[field])) { picked.push(w); usedVals.add(w[field]); }
    }
  }

  return [word, ...picked].sort(() => Math.random() - .5);
}

function submitVocabAnswer(chosen) {
  const q = VOCAB_QUIZ.questions[VOCAB_QUIZ.cur];
  const type = q.type;
  const isCorrect = type === 'mc_meaning'
    ? chosen === q.word.meaning
    : chosen === q.word.word;
  showVocabFeedback(isCorrect, q.word);
}

function checkVocabShortAnswer() {
  const val = document.getElementById('vq-input')?.value.trim() || '';
  const q   = VOCAB_QUIZ.questions[VOCAB_QUIZ.cur];
  // 뜻의 첫 번째 키워드와 비교 (쉼표 앞 첫 단어)
  const correct = q.word.meaning.split(/[,，]/)[0].trim();
  const isCorrect = val === correct || val === q.word.meaning;
  showVocabFeedback(isCorrect, q.word, val);
}

function checkVocabSpelling() {
  const val = (document.getElementById('vq-input')?.value.trim()||'').toLowerCase();
  const q   = VOCAB_QUIZ.questions[VOCAB_QUIZ.cur];
  const isCorrect = val === q.word.word.toLowerCase();
  showVocabFeedback(isCorrect, q.word, val);
}

function showVocabFeedback(isCorrect, word, userAnswer) {
  if (isCorrect) VOCAB_QUIZ.correct++;
  else           VOCAB_QUIZ.wrongIds.push(word.id);

  const body = document.getElementById('vq-body');
  body.innerHTML = `
    <div style="padding:1rem;text-align:center">
      <div style="font-size:2rem;margin-bottom:.3rem">${isCorrect ? '✅' : '❌'}</div>
      <div style="font-size:.95rem;font-weight:700;color:${isCorrect?'var(--emerald)':'var(--red)'};margin-bottom:.5rem">
        ${isCorrect ? '맞았어요!' : '틀렸어요'}</div>
      <div style="font-size:1.1rem;font-weight:800;color:var(--gold);margin-bottom:.2rem;
        cursor:pointer" onclick="speakWord('${word.word}')">${word.word} 🔊</div>
      <div style="font-size:.88rem;color:var(--txt2);margin-bottom:.15rem">${word.meaning}</div>
      ${!isCorrect && userAnswer ? `<div style="font-size:.75rem;color:var(--txt3)">내 답: ${userAnswer}</div>` : ''}
      <button class="btn-gold" onclick="nextVocabQuestion()"
        style="margin-top:.9rem;padding:.5rem 1.8rem;border-radius:12px;font-size:.88rem">
        ${VOCAB_QUIZ.cur+1 < VOCAB_QUIZ.questions.length ? '다음 →' : '결과 보기'}
      </button>
    </div>`;
}

function nextVocabQuestion() {
  VOCAB_QUIZ.cur++;
  renderVocabQuestion();
}

function finishVocabQuiz() {
  const { correct, questions, wrongIds, wordIds } = VOCAB_QUIZ;
  const total = questions.length;
  // 퀴즈 기록 저장 — 틀린 문제 상세 포함
  const wrongDetails = questions
    .filter(q => VOCAB_QUIZ.wrongIds.includes(q.word.id))
    .map(q => ({ wordId: q.word.id, type: q.type }));
  DB.saveQuizRecord({
    id: `quiz_${Utils.todayStr()}_${CUR.id}_${Date.now()}`,
    studentId: CUR.id,
    date: Utils.todayStr(),
    total, correct,
    wrongWordIds: [...new Set(wrongIds)],
    wrongDetails,
    wordIds: wordIds || []
  });

  const body = document.getElementById('vq-body');
  const titleEl = document.getElementById('vq-title');
  titleEl.textContent = '📖 퀴즈 완료!';

  // 팝업 퀴즈면 닫기 버튼 복원
  if (VOCAB_QUIZ.isPopup) {
    const closeBtn = document.getElementById('vq-close-btn');
    if (closeBtn) closeBtn.style.display = '';
    const overlay = document.getElementById('m-vocab-quiz');
    if (overlay) overlay.onclick = e => { if(e.target===overlay) closeModal('m-vocab-quiz'); };
  }

  // 틀린 문제 상세: 유형에 따라 무엇이 정답인지 표시
  const typeLabel = { mc_meaning:'영어→뜻', mc_word:'뜻→영어', short_meaning:'뜻 쓰기', spelling:'스펠링' };
  const wrongDetailHTML = wrongIds.length > 0 ? `
    <div style="background:rgba(231,76,60,.07);border:1px solid rgba(231,76,60,.15);
      border-radius:10px;padding:.6rem .7rem;margin-bottom:.8rem;text-align:left">
      <div style="font-size:.68rem;color:var(--red);font-weight:700;margin-bottom:.45rem">
        🔁 틀린 문제 — 정답 확인
      </div>
      ${[...new Set(wrongIds)].map(id => {
        const w = DB.getAllVocabWords().find(x=>x.id===id);
        if (!w) return '';
        // 이 단어를 어떤 유형으로 틀렸는지 찾기
        const detail = (wrongDetails||[]).find(d=>d.wordId===id);
        const type = detail?.type || 'mc_meaning';
        let answerLine = '';
        if (type === 'mc_meaning' || type === 'short_meaning') {
          answerLine = `<span style="color:var(--txt3);font-size:.72rem">영어 </span>
            <b style="color:var(--gold)">${w.word}</b>
            <span style="color:var(--txt3);font-size:.72rem"> → 뜻: </span>
            <b style="color:var(--emerald)">${w.meaning}</b>`;
        } else if (type === 'mc_word') {
          answerLine = `<span style="color:var(--txt3);font-size:.72rem">뜻 </span>
            <b style="color:var(--sky)">${w.meaning}</b>
            <span style="color:var(--txt3);font-size:.72rem"> → 영어: </span>
            <b style="color:var(--emerald)">${w.word}</b>`;
        } else { // spelling
          answerLine = `<span style="color:var(--txt3);font-size:.72rem">뜻 </span>
            <b style="color:var(--sky)">${w.meaning}</b>
            <span style="color:var(--txt3);font-size:.72rem"> → 스펠링: </span>
            <b style="color:var(--emerald);font-size:.9rem;letter-spacing:.05em">${w.word}</b>`;
        }
        return `<div style="font-size:.78rem;color:var(--txt2);padding:.3rem .2rem;
          border-bottom:1px solid rgba(255,255,255,.05);display:flex;align-items:center;
          gap:.5rem;flex-wrap:wrap">
          <span style="font-size:.6rem;background:rgba(255,255,255,.07);color:var(--txt3);
            padding:.05rem .3rem;border-radius:4px">${typeLabel[type]||type}</span>
          ${answerLine}
          <span onclick="event.stopPropagation();speakWord('${w.word.replace(/'/g,"\\'")}')"
            style="cursor:pointer;font-size:.72rem" title="발음 듣기">🔊</span>
        </div>`;
      }).join('')}
    </div>` : '';

  body.innerHTML = `
    <div style="padding:1.2rem 1rem;text-align:center">
      <div style="font-size:2.5rem;margin-bottom:.4rem">
        ${correct===total?'🎉':correct>=total*.7?'😊':'💪'}
      </div>
      <div style="font-size:1.5rem;font-weight:800;color:var(--gold);margin-bottom:.3rem">
        ${correct} / ${total}
      </div>
      <div style="font-size:.85rem;color:var(--txt2);margin-bottom:.8rem">
        ${correct===total?'완벽해요! 모두 맞혔어요 ✨':correct>=Math.ceil(total*.7)?'잘했어요! 조금만 더 연습해봐요':'괜찮아요, 틀린 단어 정답을 확인하고 복습해봐요'}
      </div>
      ${wrongDetailHTML}
      <button onclick="closeModal('m-vocab-quiz');if(document.getElementById('house-tab-vocab')?.style.display!=='none')renderVocabTab()"
        style="padding:.5rem 1.5rem;border-radius:12px;font-family:inherit;font-size:.85rem;cursor:pointer;
          border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:var(--txt1)">
        닫기</button>
    </div>`;

  if (document.getElementById('house-tab-vocab')?.style.display !== 'none') renderVocabTab();
}

function renderHouseAchievements() {
  const earned = new Set(CUR.achievements || []);
  const doneList   = ACHIEVEMENTS.filter(a =>  earned.has(a.id));
  const lockedList = ACHIEVEMENTS.filter(a => !earned.has(a.id));
  const el = document.getElementById('house-ach-list');
  if (!el) return;

  const rewardText = a => {
    const parts = [];
    if (a.reward.exp)   parts.push(`+${a.reward.exp}EXP`);
    parts.push('+20G');
    if (a.reward.title) parts.push(`칭호 "${a.reward.title}"`);
    if (a.reward.deco)  parts.push('특별 장식');
    return parts.join(' · ');
  };

  const render = (list, locked) => list.map(a => `
    <div class="ach-item ${locked?'locked':''}">
      <div class="ach-icon">${a.icon}</div>
      <div class="ach-body">
        <div class="ach-name">${a.name}</div>
        <div class="ach-desc">${a.desc}</div>
        <div class="ach-reward">🎁 ${rewardText(a)}</div>
      </div>
      <div class="ach-badge ${locked?'locked':'done'}">${locked?'🔒':'✅'}</div>
    </div>`).join('');

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.8rem">
      <div style="font-size:.82rem;color:var(--txt2)">달성 <span style="color:var(--gold);font-weight:700">${doneList.length}</span> / ${ACHIEVEMENTS.length}</div>
      <div style="font-size:.72rem;color:var(--txt3)">EXP·골드·칭호 획득!</div>
    </div>
    <div style="height:6px;background:rgba(255,255,255,.07);border-radius:3px;margin-bottom:1rem;overflow:hidden">
      <div style="height:100%;width:${Math.round(doneList.length/ACHIEVEMENTS.length*100)}%;background:linear-gradient(90deg,var(--gold),var(--gold2));border-radius:3px;transition:width .6s ease"></div>
    </div>
    ${doneList.length > 0 ? `<div style="font-size:.72rem;color:var(--txt3);margin-bottom:.5rem">✅ 달성 (${doneList.length})</div>${render(doneList, false)}` : ''}
    <div style="font-size:.72rem;color:var(--txt3);margin:.7rem 0 .4rem">🔒 미달성 (${lockedList.length})</div>
    ${render(lockedList, true)}`;
}

function checkAchievements() {
  const newOnes = AchievementUtils.checkNew(CUR);
  if (newOnes.length === 0) return;
  DB.saveStudent(CUR);
  // 업적 달성 팝업 (순서대로)
  let idx = 0;
  const showNext = () => {
    if (idx >= newOnes.length) { renderAll(); return; }
    const a = newOnes[idx++];
    const rewardParts = [];
    if (a.reward.exp)   rewardParts.push(`+${a.reward.exp} EXP`);
    rewardParts.push('+20 골드');
    if (a.reward.title) rewardParts.push(`칭호 "${a.reward.title}" 획득!`);
    document.getElementById('ach-popup-icon').textContent   = a.icon;
    document.getElementById('ach-popup-name').textContent   = a.name;
    document.getElementById('ach-popup-desc').textContent   = a.desc;
    document.getElementById('ach-popup-reward').textContent = '🎁 ' + rewardParts.join('  ');
    document.getElementById('ach-popup').style.display      = 'block';
    document.getElementById('ach-popup-bg').style.display   = 'block';
    // 알림 타일 빨간점
    const notif = document.getElementById('ach-tile-notif');
    if (notif) notif.style.display = '';
    // 3초 후 자동 닫기 (다음 업적)
    setTimeout(() => { closeAchPopup(); setTimeout(showNext, 300); }, 3000);
  };
  showNext();
}

function closeAchPopup() {
  document.getElementById('ach-popup').style.display    = 'none';
  document.getElementById('ach-popup-bg').style.display = 'none';
}
function openPwReset() {
  const selId = SEL_STUDENT;
  if (!selId) { alert('먼저 이름을 선택해주세요!'); return; }
  const s = DB.getStudent(selId);
  if (!s) return;
  if (confirm(`선생님께 비밀번호 초기화를 요청할까요?\n(선생님이 확인 후 새 비밀번호를 알려드려요)`)) {
    DB.addPwResetRequest({ id: Utils.uid(), studentId: s.id, name: s.name, date: Utils.todayStr() });
    alert('요청이 전달됐어요! 선생님께 말씀드리세요 🙋');
  }
}

// ══ 일일 퀘스트 자동 마감 (게임 진입 시 실행) ══
function autoCloseDailyQuests() {
  const db = DB.load();
  const today = Utils.todayStr();
  let changed = false;
  (db.boardQuests||[]).forEach(q => {
    if (q.active && q.type === 'daily' && q.date && q.date !== today) {
      q.active = false;
      changed = true;
    }
  });
  if (changed) DB._fbRef.child('boardQuests').set(db.boardQuests);
}
function switchMobTab(tab, el) {
  MOB_TAB = tab;
  document.querySelectorAll('.btab').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('mob-char-tab').classList.toggle('active-tab', tab==='char');
  document.getElementById('mob-main-tab').classList.toggle('active-tab', tab==='home');
  if (tab === 'home') document.getElementById('mob-main-tab').classList.add('active-tab');
}

// 초기 모바일 탭 설정
window.addEventListener('load', () => {
  document.getElementById('mob-main-tab').classList.add('active-tab');
});

// ══ 모달 헬퍼 ══
function openModal(id) {
  document.getElementById(id).classList.add('open');
  if (id==='m-house') renderHouse();
  if (id==='m-promo') renderPromoModal();
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.overlay').forEach(o => {
  o.addEventListener('click', e => { if(e.target===o) o.classList.remove('open'); });
});

// ══ 토스트 ══ (스타일 태그 중복 추가 버그 수정)
const _toastStyle = document.createElement('style');
_toastStyle.textContent = `
  @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
  @keyframes toastOut{to{opacity:0;transform:translateX(-50%) translateY(10px)}}
  .toast-msg{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:rgba(22,33,62,.95);border:1px solid rgba(255,215,0,.3);border-radius:12px;
    padding:.65rem 1.2rem;font-size:.82rem;color:#fff;z-index:9999;white-space:pre-line;
    text-align:center;pointer-events:none;box-shadow:0 8px 30px rgba(0,0,0,.4);
    animation:toastIn .3s ease,toastOut .3s 2s ease forwards;}`;
document.head.appendChild(_toastStyle);

function toast(msg) {
  const isMobile = window.innerWidth <= 700;
  const t = document.createElement('div');
  t.className = 'toast-msg';
  t.textContent = msg;
  // 모바일: 바텀탭(65px) 위에, 데스크탑: 하단 20px
  t.style.bottom = isMobile ? '75px' : '20px';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}
