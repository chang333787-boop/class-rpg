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

// ══ 링크 주소 검사 (Q3-URL-1) — 교사가 적은 주소를 href 에 넣기 전에 ══
//  http/https 만 연다. javascript:·data: 같은 다른 스킴은 빈 문자열(링크를 그리지 않음).
//  스킴이 없으면(naver.com) https:// 를 붙인다 — 교사 화면 오늘의 링크와 같은 규칙.
//  브라우저가 주소 속 탭·줄바꿈을 무시하므로(java<탭>script:) 제어 문자를 먼저 지운다.
function safeUrl(u) {
  const s = String(u == null ? '' : u).replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[a-z][a-z0-9+.\-]*:/i.test(s)) return '';
  return 'https://' + s.replace(/^\/+/, '');
}

// ══ 바깥 스크립트 한 번만 불러오기 (LAZY-SDK-1) ══
//  첫 화면에서 안 쓰는 큰 스크립트(Chart.js·영어앱 Firestore SDK·꾸미기 student/deco.js)는 html 태그 대신 처음 필요할 때 여기서 부른다.
//  같은 주소는 한 번만(부르는 중이면 같은 약속을 돌려준다). 실패하면 기록을 지워 다음에 다시 시도할 수 있다(오프라인 → 다시 누르기).
const _scriptOnce = new Map();   // 주소 → Promise
function loadScriptOnce(url) {
  let p = _scriptOnce.get(url);
  if (p) return p;
  p = new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload = () => ok();
    s.onerror = () => { _scriptOnce.delete(url); s.remove(); no(new Error('스크립트를 못 받음: ' + url)); };
    document.head.appendChild(s);
  });
  _scriptOnce.set(url, p);
  return p;
}

// monsterLog 항목(id) → 표시용 이름 (매핑 실패 시 원본 그대로 — 옛 커스텀 이름 등)
function monsterNameById(id) {
  const mon = getActiveMonsters().find(m => m.id === id);
  return mon ? mon.name : id;
}

// ── 이미지 아이콘 + 이모지 폴백 ──
function iconImg(entity, kind, sizeCss, fileId, fallbackIcon) {
  const icon = escHtml(fallbackIcon || entity?.icon || '❓');
  const size = /^(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|%)$/.test(String(sizeCss)) ? String(sizeCss) : '1.5rem';
  const assetId = fileId || entity?.id;
  const collection = GAME_DATA[kind];
  const collectionItems = Array.isArray(collection) ? collection : Object.values(collection || {}).flat();
  const isBaseEntity = assetId && (fileId || collectionItems.some(item => item.id === entity?.id));
  if (!isBaseEntity) return `<span style="display:inline-grid;place-items:center;width:${size};height:${size}">${icon}</span>`;

  return `<span style="display:inline-grid;place-items:center;width:${size};height:${size}">`
    + `<img src="./assets/${escHtml(kind)}/${escHtml(assetId)}.png" alt="${escHtml(entity?.name || '')}" `
    + `style="display:block;width:100%;height:100%;object-fit:contain" `
    + `onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">`
    + `<span style="display:none">${icon}</span></span>`;
}

// ══ 초기화 ══
window.onload = async () => {
  const loading = document.getElementById('loading-screen');
  try {
    await DB.init({ profile: 'student' });   // [STUDENT-COLD-1] 남의 감정 기록 등 큰 노드는 안 받는다(로그인 뒤 내 것만)
    applyShopOverrides(); // 상점 오버라이드 적용
    applyBattleSettings(); // 전투 밸런스 오버라이드 적용
    DB.onDataChange(() => {
      invalidateMastery();   // [MASTERY-1] 기록이 바뀌면 별·복습일을 다시 센다
      applyShopOverrides();
      applyBattleSettings();
      if (typeof CUR !== 'undefined' && CUR) {
        // [DECO-SAVE-1] CUR 을 통째 교체하기 **직전에** 묶여 있던 꾸미기 변경을 보낸다.
        //  (보내고 나서 교체하므로 순서는 지금과 같다 — 서버 값이 이긴다)
        if (typeof decoFlush === 'function') decoFlush('스냅샷');
        const prevId = CUR.id, prevLv = CUR.level || 1;
        const fresh = DB.getStudent(CUR.id);
        if (fresh) CUR = fresh;
        _remoteLevelUpCheck(prevId, prevLv);   // [UX-TRIM-G4] 선생님 승인으로 오른 레벨 — 한 번만 축하

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
    alert('연결이 안 됐어요. 인터넷이 켜져 있는지 확인해 주세요.');
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

// [TITLE-BOARD-1] 첫 화면 칠판 오른쪽 위 = 오늘 날짜 (한국 시각 — 접속 시간 검사와 같은 셈)
function fillTitleDate() {
  const el = document.getElementById('tb-date');
  if (!el) return;
  const k = new Date(Date.now() + 9 * 3600000);
  el.innerHTML = `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일<br>${'일월화수목금토'[k.getUTCDay()]}요일`;
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fillTitleDate);
else fillTitleDate();

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

// [ACCESS-MSG-1] '16:00' → '오후 4:00' (아이 화면용)
function accessTimeLabel(hhmm) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  if (!Number.isFinite(h)) return String(hhmm || '');
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = (h % 12) || 12;
  return `${ampm} ${h12}:${String(Number.isFinite(m) ? m : 0).padStart(2, '0')}`;
}

function doLogin() {
  if (!SEL_STUDENT) { document.getElementById('login-err').textContent = '이름을 선택해주세요!'; return; }
  if (doLogin._pending) return;              // [STUDENT-COLD-1] 내 기록 받는 중 엔터 두 번 → enterGame 두 번 막기

  // 접속 시간 체크 (선생님이 정한 시간만 허용)
  if (checkAccessTime()) {
    //  [ACCESS-MSG-1] 안내 문구도 선생님 설정(accessStart/accessEnd)을 따른다 — 전엔 8:30~4:00 고정이었다
    const st = DB.getSettings() || {};
    document.getElementById('login-err').textContent =
      `⏰ 접속 가능 시간: ${accessTimeLabel(st.accessStart || '08:30')} ~ ${accessTimeLabel(st.accessEnd || '16:00')}`;
    return;
  }

  const student = DB.getStudent(SEL_STUDENT);
  if (document.getElementById('pw-input').value !== student.pw) {
    document.getElementById('login-err').textContent = '비밀번호가 틀렸어요!'; return;
  }
  CUR = JSON.parse(JSON.stringify(student));
  // [STUDENT-COLD-1] G3 — 내 감정 기록·되돌아보기를 받은 뒤에 첫 화면(오늘 감정·팝업 판정)을 그린다
  doLogin._pending = true;
  const btn = document.querySelector('#s-login button[onclick*="doLogin"]');
  if (btn) btn.disabled = true;
  DB.attachMine(CUR.id).then(() => {
    doLogin._pending = false;
    if (btn) btn.disabled = false;
    if (!CUR.charType) {
      hideScreen('s-login');
      showScreen('s-charsel');
    } else {
      hideScreen('s-login');
      enterGame();
    }
  });
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
    if (checkAccessTime() && !(typeof classLiveIsOpen === 'function' && classLiveIsOpen())) {   // [CLASS-LIVE-1] 수업 중엔 내보내지 않음(끝난 뒤 다음 검사에서)
      clearInterval(_accessTimer);
      _accessTimer = null;
      // 데이터 저장 후 로그아웃
      DB.saveStudent(CUR);
      CUR = null;
      // [EMBED-LOGOUT-1] 열려 있던 창을 닫는다. #m-embed(영어·수채화·데생)와 .overlay 모달은
      //   s-game 밖(body)에 붙어 있어서 s-game 을 숨겨도 로그인 화면 위에 그대로 남았다 —
      //   접속 시간이 끝나도 앱을 계속 쓸 수 있었다.
      //   CUR = null 뒤에 닫는다: 영어 창을 닫을 때 부르는 syncEnglishRewards 가 CUR 이 없으면
      //   바로 돌아가므로, 로그아웃 순간에 새 쓰기가 끼어들지 않는다(다음 로그인 때 동기화된다).
      //   .overlay 를 닫는 것은 바깥을 눌러 닫는 것(overlay click)과 같은 동작이다.
      try { closeExternalEmbed(); } catch (e) {}
      document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open'));
      document.getElementById('s-game').classList.remove('active');
      hideScreen('s-game');
      showScreen('s-login');
      document.getElementById('login-err').textContent = '⏰ 접속 시간이 종료됐어요. 내일 다시 만나요!';
    }
  }, 30000); // 30초마다 체크
}

// ══════════════════════════════════════════════════
//  영어 복습앱 연동 (ENGLISH-LINK-1)
//  · 영어 학습은 별도 앱(https://jeongrim-english.firebaseapp.com · 옛 web.app 주소는 09-28 SSL 실패)에서 하고, RPG는 그 기록을
//    **읽어서** 보상만 준다. 영어앱이 RPG DB에 쓰는 일은 없다(규칙·저장 경로 불변).
//  · 영어앱 기록은 다른 Firebase 프로젝트(jeongrim-equip)의 Firestore에 있으므로
//    compat SDK로 두 번째 앱('english')을 띄워 읽는다. 기본 앱/RTDB와 완전히 분리.
//  · 보상은 CUR.pendingRewards에 **approved:false**로 push → 교사가 admin 승인 대기열에서
//    승인(approveReward)하면 지급. (approved:true로 넣으면 수령 경로가 없어 영원히 안 들어온다)
//    이미 만든 보상은 CUR.englishRewards[key]=true 로 막는다(학생 레코드 필드 1개 추가).
//  · 실패(오프라인·이름 불일치·SDK 미로드)는 조용히 건너뛰고 게임 진입을 막지 않는다.
// ══════════════════════════════════════════════════
const ENGLISH_APP = {
  url: 'https://jeongrim-english.firebaseapp.com/',   // [ENGLISH-DOMAIN-1] 09-28 web.app 주소가 SSL 연결 실패(수업 중 영어 안 열림) → 같은 앱의 firebaseapp.com 주소
  pass: '1234',                       // 영어앱 반 비밀번호(자동 입장 링크에 사용)
  cls: 'jeongrim',                    // 영어앱 Firestore 문서 접두어
  firebase: {
    apiKey: 'AIzaSyBCUbY4A-wiWJFV35l966Dz6VvrJ7mI3Gc', authDomain: 'jeongrim-equip.firebaseapp.com',
    projectId: 'jeongrim-equip', storageBucket: 'jeongrim-equip.firebasestorage.app',
    messagingSenderId: '714906976935', appId: '1:714906976935:web:a745b77bf747cc9218d182',
  },
  reward: {                           // 단가 — 퀵승인 기본(30/30)보다 살짝 낮게
    daily:  { exp: 20, gold: 15, label: '🔤 영어 복습 하루 목표 달성' },
    test:   { exp: 30, gold: 20, label: '🔤 영어 테스트 90% 이상' },
    lesson: { exp: 80, gold: 50, label: '🔤 영어 단원 마스터' },
  },
  lessonName: { L1:'1단원', L2:'2단원', L3:'3단원', L4:'4단원', L5:'5단원', L6:'6단원', L7:'7단원',
                Bweek:'요일', Bnum:'숫자', Bcolor:'색깔', Bmonth:'달', Bfamily:'가족' },
};

function englishAppLink() {
  const name = (CUR && CUR.name) ? CUR.name : '';
  return ENGLISH_APP.url + '?name=' + encodeURIComponent(name) + '&k=' + encodeURIComponent(ENGLISH_APP.pass);
}

// ── [ENGLISH-EMBED-1] 외부 학습 앱 전체화면 모달 (iframe) ──
//   · 새 탭으로 나가면 "영어만 다른 사이트"로 보인다는 학생 반응 → RPG 화면 안에서 연다.
//   · allow="autoplay; microphone": 듣기·말하기가 iframe 안에서 막히지 않게.
//   · 닫기 버튼 · ESC · 브라우저 뒤로가기(popstate) 모두로 닫힌다 — 아이가 갇히지 않게.
//   · 8초 안에 load가 안 오거나 오프라인이면 "새 탭으로 열기" 링크를 크게 보여 준다(폴백).
//   · 마크업은 처음 열 때 만든다(student.html 수정 최소화). 수채화 등 다른 앱은 다음 Phase.
// 외부 학습 앱 목록 — 오늘의 학습 과목 선택 화면의 카드이자, 모달(openExternalEmbed)이 여는 대상.
//   다음 앱은 여기 한 줄만 추가. embed:true면 RPG 안 전체화면 모달, 아니면 새 탭.
//   [WATERCOLOR-EMBED-1] 수채화·데생도 모달로(같은 도메인이라 소리·카메라·기록 모두 iframe 안에서 그대로 동작).
function externalStudyItems() {
  const sid = encodeURIComponent((typeof CUR !== 'undefined' && CUR && CUR.id) || '');
  return [
    { key: 'english', icon: '🔤', title: '영어 복습앱',
      sub: '단어·표현·듣기·말하기 · 공부하면 선생님 승인 후 경험치·골드',
      href: englishAppLink(), border: 'rgba(255,215,0,.35)', bg: 'rgba(255,215,0,.08)',
      embed: true },   // [ENGLISH-EMBED-1] 새 탭 대신 RPG 안 전체화면 모달로
    // [THINKBOARD-1] 생각판 — 선생님이 연 판에 생각 카드를 붙인다(RPG 로그인 이름 그대로 · 저장 = classRPG_thinkboard · 보상과 묶지 않음)
    { key: 'thinkboard', icon: '🧠', title: '생각판',
      sub: '선생님이 연 판에 내 생각을 붙이고 친구 생각을 봐요',
      href: 'thinkboard/index.html?rpg=1&sid=' + sid + '&n=' + encodeURIComponent((typeof CUR !== 'undefined' && CUR && CUR.name) || ''),
      border: 'rgba(53,99,233,.35)', bg: 'rgba(53,99,233,.07)', embed: true },
    // [MUSIC-ROOM-1] 음악실 — 작곡 · 리코더 연습(흘러가는 음표 + 운지) · 리듬 게임(키보드). 저장 = classRPG_music · 보상과 묶지 않음
    //   autoFocus: 리듬 게임 키(A S D F J K L ;)가 iframe 에 바로 들어가게(마을과 같은 이유)
    { key: 'music', icon: '🎵', title: '음악실',
      sub: '가락을 짓고 · 리코더로 따라 불고 · 키보드 리듬 게임',
      href: 'music/index.html?sid=' + sid + '&n=' + encodeURIComponent((typeof CUR !== 'undefined' && CUR && CUR.name) || ''),
      border: 'rgba(240,140,46,.40)', bg: 'rgba(240,140,46,.08)', embed: true, autoFocus: true },
    // [CODING-ROOM-1] 기초 코딩 — 블록으로 몬스터(도감 몬스터마다 아는 명령이 다름)를 움직이고 불씨 참새로 그림 · 1~4단원 34판 · 선생님 막힘 지도(#/t)
    //   저장 = classRPG_coding · 보상과 묶지 않음 · Blockly(구글)는 coding/index.html 이 싣는다
    { key: 'coding', icon: '🧩', title: '기초 코딩',
      sub: '블록으로 몬스터에게 명령해요 · 불씨 참새 그림 코딩',
      href: 'coding/index.html?sid=' + sid + '&n=' + encodeURIComponent((typeof CUR !== 'undefined' && CUR && CUR.name) || ''),
      border: 'rgba(61,139,253,.40)', bg: 'rgba(61,139,253,.08)', embed: true, autoFocus: true },
    // [PATTERN-1] 무늬 공방 — 도장을 밀고 · 뒤집고 · 돌려 무늬 만들기(4학년 수학 '평면도형의 이동' + 미술) · 5장 28판 · 선생님 헷갈림 지도(#/t)
    //   저장 = classRPG_pattern · 보상과 묶지 않음
    { key: 'pattern', icon: '🦋', title: '무늬 공방',
      sub: '도장을 밀고 · 뒤집고 · 돌려서 무늬를 만들어요',
      href: 'pattern/index.html?sid=' + sid + '&n=' + encodeURIComponent((typeof CUR !== 'undefined' && CUR && CUR.name) || ''),
      border: 'rgba(142,91,208,.45)', bg: 'rgba(142,91,208,.09)', embed: true },
    // [PAINT-1] 물감 연구소 — 빨강 · 노랑 · 파랑 + 흰색 · 검정을 한 방울씩 섞어 색 만들기(예상 → 섞기 → 견주기 · 보색 · 자연의 색 · 느낌의 색 모자이크) · 5장 33판 · 선생님 헷갈림 지도(#/t)
    //   저장 = classRPG_paint · 보상과 묶지 않음 · 진짜 물감 연습은 아래 수채화 기초(색 섞기 · 색상환 차시)와 이어짐
    { key: 'paint', icon: '🖌️', title: '물감 연구소',
      sub: '세 물감을 한 방울씩 섞어 색을 만들어요',
      href: 'paint/index.html?sid=' + sid + '&n=' + encodeURIComponent((typeof CUR !== 'undefined' && CUR && CUR.name) || ''),
      border: 'rgba(53,163,220,.42)', bg: 'rgba(53,163,220,.08)', embed: true },
    // [ART-1] 명화 탐정 — 저작권이 끝난 옛 그림 열두 장(김홍도 · 브뤼헐 · 모네 …)에서 숨은 것 찾기 · 단서로 생각하기 · 느낌 · 질문 만들기([4미03-01] 감상)
    //   저장 = classRPG_art · 보상과 묶지 않음 · 그림 출처 = art/CREDITS.md
    { key: 'art', icon: '🔎', title: '명화 탐정',
      sub: '옛 그림 속 숨은 것을 찾고 질문을 만들어요',
      href: 'art/index.html?sid=' + sid + '&n=' + encodeURIComponent((typeof CUR !== 'undefined' && CUR && CUR.name) || ''),
      border: 'rgba(201,167,232,.42)', bg: 'rgba(201,167,232,.08)', embed: true },
    // [INK-1] 먹 연구소 — 먹물 · 물 방울로 먹색(농담) 만들기 · 농담 꼬리 잇기 · 한지에 붓 놀이(점 · 선 · 마른 붓 · 번짐) · [PANBON-1] 3장 판본체 쓰기 · 4장 = 명화 탐정 수묵 사건
    //   저장 = classRPG_ink · 보상과 묶지 않음 · 교과서 9종 모두 3학년에 먹 · 수묵화가 있어 만듦(docs/art34_analysis.md · docs/ink_lab_design.md)
    { key: 'ink', icon: '🖋️', title: '먹 연구소',
      sub: '먹물과 물로 먹색을 만들고 한지에 붓으로 긋고 판본체를 써요',
      href: 'ink/index.html?sid=' + sid + '&n=' + encodeURIComponent((typeof CUR !== 'undefined' && CUR && CUR.name) || ''),
      border: 'rgba(170,170,180,.42)', bg: 'rgba(170,170,180,.08)', embed: true },
    // [PRINT-1] 판화 놀이 — 나무판을 새기고(세모칼 · 둥근칼) 롤러 · 바렌으로 찍어 보며 판화의 원리(좌우가 바뀐다 · 파낸 곳은 하얗게 · 여러 장)
    //   · 4장 = 명화 탐정 판화 사건(뒤러 코뿔소 · 훈민정음 해례본 · 호쿠사이) · 저장 = classRPG_print · 보상과 묶지 않음(docs/print_lab_design.md)
    { key: 'print', icon: '🪞', title: '판화 놀이',
      sub: '나무판을 새기고 찍으면 거울처럼',
      href: 'print/index.html?sid=' + sid + '&n=' + encodeURIComponent((typeof CUR !== 'undefined' && CUR && CUR.name) || ''),
      border: 'rgba(214,176,128,.45)', bg: 'rgba(214,176,128,.09)', embed: true },
    { key: 'watercolor', icon: '🎨', title: '수채화 기초',
      sub: '태블릿 보며 진짜 종이에 연습 · 작품 사진은 선생님 확인 후 전시',
      href: 'watercolor/index.html?sid=' + sid,
      border: 'rgba(155,120,220,.45)', bg: 'rgba(155,120,220,.10)', embed: true },
    { key: 'drawing', icon: '✏️', title: '데생 기초',
      sub: '연필로 선·명암·형태 익히기 10차시 · 작품 사진은 선생님 확인 후 전시',
      href: 'watercolor/index.html?course=drawing&sid=' + sid,
      border: 'rgba(200,200,210,.40)', bg: 'rgba(200,200,210,.08)', embed: true },
    // [VILLAGE-DOOR-1] 미니 세상 마을(G5 ②). 공부가 아니라 "오늘의 학습" 카드에서는 뺀다(study:false) —
    //   홈 메뉴의 🏘️ 타일이 여는 문이다. 저장은 아직 이 기기 localStorage(rpg.village.<sid>).
    //   autoFocus: 3D 조작 키(R·스페이스·Ctrl+Z)가 캔버스를 한 번 누르기 전에는 부모로 샜다(G5 설계 §1 실측).
    { key: 'village', icon: '🏘️', title: '우리 마을',
      sub: '집을 짓고 주민이 이사 오는 미니 세상',
      href: 'village/index.html?sid=' + sid,
      border: 'rgba(120,200,140,.40)', bg: 'rgba(120,200,140,.08)', embed: true, study: false, autoFocus: true },
  ];
}
// ── [THINKBOARD-HOME-1] 선생님이 연 생각판을 홈 '오늘'의 우리 반 소식에([HOME-C-1]) — 한 번 누르면 그 판으로 ──
//   classRPG_thinkboard/listed = { <판 id>: { t 제목 · c 만든 때 · o 쓰기 열림 · p 질문 } } — 생각판 선생님 쪽이 맞춰 둔다.
//   판 내용(카드·기록)은 받지 않고 이 작은 목록 하나에만 붙는다. 수업 중에 판을 열면 아이 홈에 바로 뜬다.
//   누구나 쓸 수 있는 DB 라 글은 escHtml, 판 id 는 글자·숫자·_·- 만 받는다.
let _tbHome = null, _tbHomeOn = false;
function watchThinkboardHome() {
  if (_tbHomeOn) return;
  try {
    if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) return;
    _tbHomeOn = true;
    firebase.database().ref('classRPG_thinkboard/listed').on('value', snap => {
      _tbHome = snap.val() || null;
      document.querySelectorAll('.home-thinkboard').forEach(el => { el.innerHTML = thinkboardHomeCards(); });
    }, e => console.warn('[THINKBOARD-HOME-1]', e));
  } catch (e) { console.warn('[THINKBOARD-HOME-1]', e); }
}
const _tbSafeId = id => /^[\w-]{1,40}$/.test(String(id || ''));
function thinkboardHomeCards() {
  const list = Object.entries(_tbHome || {})
    .filter(([id, b]) => _tbSafeId(id) && b && b.t)
    .sort((a, z) => (Number(z[1].c) || 0) - (Number(a[1].c) || 0));
  // 넷 이상(모둠마다 판 등)이면 둘 + '모두 보기' 하나 — 내 모둠 판이 밀려 안 보이는 일이 없게
  const shown = list.length > 3 ? list.slice(0, 2) : list;
  const more = list.length > 3 ? `
    <div class="today-card" onclick="openExternalEmbed('thinkboard')"
      style="cursor:pointer;grid-column:1/-1;border:1px solid rgba(110,150,240,.4);margin-bottom:.5rem">
      <div style="display:flex;align-items:center;gap:.6rem">
        <span style="font-size:1.4rem">🧠</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:.85rem;font-weight:800;color:var(--gold)">생각판 · 열린 판 ${list.length}개 모두 보기</div>
          <div style="font-size:.7rem;color:var(--txt3);margin-top:.15rem">내 모둠 판을 골라 들어가요</div>
        </div>
        <span style="color:var(--txt3)">▶</span>
      </div>
    </div>` : '';
  return shown.map(([id, b]) => `
    <div class="today-card" onclick="openThinkboardBoard('${id}')"
      style="cursor:pointer;grid-column:1/-1;border:1px solid rgba(110,150,240,.4);margin-bottom:.5rem">
      <div style="display:flex;align-items:center;gap:.6rem">
        <span style="font-size:1.4rem">🧠</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:.85rem;font-weight:800;color:var(--gold)">생각판 · ${escHtml(String(b.t).slice(0, 40))}</div>
          <div style="font-size:.7rem;color:var(--txt3);margin-top:.15rem">${b.p ? escHtml(String(b.p).slice(0, 60)) : (b.o === false ? '선생님이 연 판 · 보기만 해요' : '선생님이 연 판에 내 생각을 붙여요')}</div>
        </div>
        <span style="color:var(--txt3)">▶</span>
      </div>
    </div>`).join('') + more;
}
function openThinkboardBoard(id) {
  if (!_tbSafeId(id)) return;
  openExternalEmbed('thinkboard', '#/b/' + id);
}
let _embedState = null;   // { key, href, loaded, timer }
let _lupAfterEmbed = 0;   // [UX-TRIM-G4b] 학습 앱 창이 열린 동안 미룬 레벨업 축하(레벨) — 창을 닫으면 띄운다
function _embedEl() {
  let el = document.getElementById('m-embed');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'm-embed';
  el.style.cssText = 'position:fixed;inset:0;z-index:9000;background:#0f1424;display:none;flex-direction:column';
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:.6rem;padding:.45rem .7rem;background:#16213E;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0">
      <span id="embed-title" style="font-weight:700;color:var(--gold);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></span>
      <a id="embed-newtab" href="#" target="_blank" rel="noopener"
        style="font-size:.78rem;color:var(--txt3);text-decoration:none;border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:.25rem .55rem">새 탭으로 열기 ↗</a>
      <button onclick="closeExternalEmbed()" aria-label="닫기"
        style="background:none;border:none;color:var(--txt);font-size:1.35rem;cursor:pointer;padding:.1rem .4rem;font-family:inherit">✕</button>
    </div>
    <div id="embed-body" style="flex:1;position:relative;min-height:0">
      <iframe id="embed-frame" title="외부 학습 앱" allow="autoplay; microphone; camera; fullscreen"
        style="position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff"></iframe>
      <div id="embed-fallback" style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;flex-direction:column;gap:.9rem;background:#0f1424;color:var(--txt);text-align:center;padding:1.5rem">
        <div style="font-size:2.2rem">📡</div>
        <div style="font-size:1.05rem;font-weight:700">앱을 불러오지 못했어요</div>
        <div style="font-size:.9rem;color:var(--txt3)">인터넷 연결을 확인하거나 아래 버튼으로 새 탭에서 열어 보세요.</div>
        <a id="embed-fallback-link" href="#" target="_blank" rel="noopener"
          style="background:var(--gold);color:#1a1a1a;font-weight:700;border-radius:12px;padding:.7rem 1.2rem;text-decoration:none">새 탭으로 열기 ↗</a>
        <button onclick="closeExternalEmbed()" style="background:none;border:1px solid rgba(255,255,255,.2);color:var(--txt3);border-radius:10px;padding:.5rem 1rem;cursor:pointer;font-family:inherit">닫기</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.querySelector('#embed-frame').addEventListener('load', () => {
    if (_embedState) { _embedState.loaded = true; clearTimeout(_embedState.timer); }
    // [VILLAGE-DOOR-1] autoFocus 인 앱만 iframe 에 포커스를 넘긴다. 다른 앱(영어·수채화·데생)은 그대로 둔다 —
    //   포커스가 iframe 으로 가면 부모의 Esc 닫기가 안 들린다.
    if (_embedState && _embedState.autoFocus && !(typeof classLiveIsOpen === 'function' && classLiveIsOpen())) { try { el.querySelector('#embed-frame').contentWindow.focus(); } catch (e) {} }   // [CLASS-LIVE-1] 수업 덮개 위로 포커스를 뺏지 않게
  });
  return el;
}
function openExternalEmbed(key, hash) {
  const x = externalStudyItems().find(i => i.key === key && i.embed);
  if (!x) return;
  const item = { title: x.icon + ' ' + x.title, href: x.href + (hash || '') };   // hash: 생각판 판 하나로 바로(#/b/<id>)
  // 같은 도메인(수채화·데생)이면 no-cors가 아니라 보통 HEAD로 확인해 상태 코드까지 본다(404 페이지도 폴백)
  let sameOrigin = false;
  try { sameOrigin = new URL(item.href, location.href).origin === location.origin; } catch (e) {}
  const el = _embedEl();
  const frame = el.querySelector('#embed-frame'), fb = el.querySelector('#embed-fallback');
  el.querySelector('#embed-title').textContent = item.title;
  el.querySelector('#embed-newtab').href = item.href;
  el.querySelector('#embed-fallback-link').href = item.href;
  fb.style.display = 'none';
  const st = { key, href: item.href, loaded: false, timer: null, token: Date.now(), autoFocus: !!x.autoFocus };
  _embedState = st;
  frame.src = item.href;
  el.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  // 뒤로가기로 닫히게 — 히스토리 한 칸 추가 (이미 embed 상태면 또 쌓지 않는다)
  try { if (!(history.state && history.state.embed)) history.pushState({ embed: key }, '', location.href); } catch (e) {}
  // 폴백 판정: iframe의 load는 오류 페이지에서도 발생하므로 믿지 않는다.
  //   ① 오프라인이면 즉시 ② 도달 가능 여부를 no-cors fetch로 확인(6초 안에 실패/타임아웃 → 폴백)
  const showFb = () => { if (_embedState === st) fb.style.display = 'flex'; };
  if (navigator.onLine === false) { showFb(); return; }
  try {
    const ctrl = ('AbortController' in window) ? new AbortController() : null;
    st.timer = setTimeout(() => { try { ctrl && ctrl.abort(); } catch (e) {} showFb(); }, 6000);
    const opts = sameOrigin ? { method: 'HEAD', cache: 'no-store' } : { mode: 'no-cors', cache: 'no-store' };
    fetch(item.href, { ...opts, signal: ctrl ? ctrl.signal : undefined })
      .then(r => { clearTimeout(st.timer); if (sameOrigin && r && !r.ok) showFb(); })
      .catch(() => { clearTimeout(st.timer); showFb(); });
  } catch (e) { showFb(); }
}
function closeExternalEmbed(fromPop) {
  const el = document.getElementById('m-embed');
  if (!el || el.style.display === 'none') return;
  const closedKey = _embedState && _embedState.key;
  if (_embedState) clearTimeout(_embedState.timer);
  el.querySelector('#embed-frame').src = 'about:blank';   // 소리·타이머 정지
  el.style.display = 'none';
  document.body.style.overflow = '';
  _embedState = null;
  if (!fromPop && history.state && history.state.embed) {
    // 우리가 쌓은 한 칸을 되돌린다. popstate가 뒤늦게 와도 이미 닫혀 있어 무해(idempotent).
    try { history.back(); } catch (e) {}
  }
  // 돌아오면 영어 보상 동기화 한 번 더 (방금 공부한 것 반영). 수채화·데생의 작품 제출은
  // iframe이 같은 RTDB의 students/<key>/pendingRewards에 직접 쓰고, DB.onDataChange가 CUR을 갱신한다.
  if (closedKey === 'english') { try { syncEnglishRewards(true); } catch (e) {} }
  if (_lupAfterEmbed) { const lv = _lupAfterEmbed; _lupAfterEmbed = 0; setTimeout(() => triggerLevelUp(lv), 300); }   // [UX-TRIM-G4b]
}
window.addEventListener('popstate', () => {
  if (typeof classLiveIsOpen === 'function' && classLiveIsOpen()) return;   // [CLASS-LIVE-1] 수업 덮개 밑의 학습 앱 창은 뒤로 연타에도 안 닫는다(덮개가 한 칸을 다시 쌓음 — student/assign.js)
  // 모달이 열려 있는데 embed 상태가 사라졌다면(뒤로가기) 닫는다
  if (!(history.state && history.state.embed)) closeExternalEmbed(true);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeExternalEmbed(); });

let _englishFs = null;       // 두 번째 앱의 Firestore 핸들
let _englishLastSync = 0;
//  [LAZY-SDK-1] 영어앱 기록 읽기에만 쓰는 Firestore SDK — 첫 화면 태그에서 빼고 syncEnglishRewards 가 처음 필요할 때 부른다.
//  student.html 의 firebase-app-compat 과 같은 9.23.0(앱이 먼저 떠 있어야 붙는다 — 로그인 뒤라 늘 그렇다).
const ENGLISH_FS_SDK = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js';
function _englishStore() {
  if (_englishFs) return _englishFs;
  if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') return null;
  let app = null;
  try { app = firebase.app('english'); } catch (e) { app = firebase.initializeApp(ENGLISH_APP.firebase, 'english'); }
  _englishFs = firebase.firestore(app);
  return _englishFs;
}

// 영어앱 기록 → 보상. 로그인 직후 1회, 이후 5분마다(renderAll 등에서 호출돼도 안전).
async function syncEnglishRewards(force) {
  if (!CUR || !CUR.name) return;
  const now = Date.now();
  if (!force && now - _englishLastSync < 5 * 60 * 1000) return;
  _englishLastSync = now;
  //  [LAZY-SDK-1] SDK 가 아직 없으면 한 번 받는다 — 실패(오프라인 등)하면 예전처럼 조용히 건너뜀(5분 뒤·영어 창을 닫을 때 다시)
  if (typeof firebase !== 'undefined' && typeof firebase.firestore !== 'function') {
    try { await loadScriptOnce(ENGLISH_FS_SDK); } catch (e) { return; }
    if (!CUR || !CUR.name) return;   // 받는 사이 로그아웃
  }
  const fs = _englishStore();
  if (!fs) return;
  let data = null;
  try {
    const snap = await fs.collection('english').doc(ENGLISH_APP.pass).collection('students')
      .doc(ENGLISH_APP.cls + '_' + CUR.name).get();
    if (!snap.exists) return;              // 영어앱에 같은 이름이 없음 — 조용히 종료
    data = snap.data() || {};
  } catch (e) { console.warn('영어앱 기록 읽기 실패:', e); return; }

  const today = Utils.todayStr();
  const given = CUR.englishRewards || {};
  const adds = [];
  const push = (key, r, extra) => {
    if (given[key]) return;
    given[key] = true;
    adds.push({
      id: 'r_eng_' + key.replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + now,
      studentId: CUR.id, boardQuestId: null, boardQuestType: 'english', type: 'english',
      name: r.label + (extra ? ' ' + extra : ''), label: r.label + (extra ? ' ' + extra : ''),
      exp: r.exp, gold: r.gold, stat: '', statVal: 0, icon: '🔤', date: today, approved: false,
    });
  };

  // ① 오늘 영어앱 "하루 목표"(기본 20문제, 영어앱 설정값)를 채웠을 때만 하루 1회
  //    — 한 문제만 풀고 보상 받는 일이 없도록 기준을 명확히 한다. (영어앱이 today/todayN/goal을 올려 준다)
  const goal = Math.max(10, Number(data.goal) || 20);
  if (data.today === today && Number(data.todayN || 0) >= goal)
    push('daily_' + today, ENGLISH_APP.reward.daily, '(' + data.todayN + '/' + goal + '문제)');
  // ② 테스트 90% 이상 — 회차마다 1회
  const tests = data.tests || {};
  Object.keys(tests).forEach(k => {
    (tests[k] || []).forEach((t, i) => {
      if (t && t.total > 0 && t.ok / t.total >= 0.9)
        push('test_' + k + '_' + i, ENGLISH_APP.reward.test, '(' + t.ok + '/' + t.total + ')');
    });
  });
  // ③ 단원 숙달 100% — 단원당 1회
  const lessons = data.lessons || {};
  Object.keys(lessons).forEach(k => {
    if (lessons[k] === 100) push('lesson_' + k, ENGLISH_APP.reward.lesson, ENGLISH_APP.lessonName[k] || k);
  });

  if (!adds.length) return;
  CUR.englishRewards = given;
  CUR.pendingRewards = [...(CUR.pendingRewards || []), ...adds];
  DB.saveStudent(CUR);
  renderAll();
  const exp = adds.reduce((n, r) => n + r.exp, 0), gold = adds.reduce((n, r) => n + r.gold, 0);
  toast(`🔤 영어 복습 보상 ${adds.length}개 신청됐어요 (+${exp}EXP +${gold}G) · 선생님이 확인하면 받아요`);
}

// [UX-TRIM-G4] 선생님 승인(관리 화면)처럼 **이 기기 밖에서** 레벨이 오르면 축하 연출이 없었다.
//   이 기기에서 올린 레벨(보스 · 학습 보상 등)은 CUR 을 먼저 고치고 저장하므로 스냅샷과 같아 여기 안 걸린다(중복 없음).
//   로그인 직후 몇 초는 늦게 온 내 기록이 덮이는 때라 축하하지 않고 기준만 맞춘다. 이미 축하한 레벨은 다시 안 한다.
let _lvSeen = null;   // { id, lv, at } — 이 탭에서 본 가장 높은 레벨 · 들어온 시각
function _remoteLevelUpCheck(prevId, prevLv) {
  if (!CUR || CUR.id !== prevId) return;
  const lv = CUR.level || 1;
  if (!_lvSeen || _lvSeen.id !== CUR.id) _lvSeen = { id: CUR.id, lv: prevLv, at: 0 };
  if (lv <= prevLv || lv <= _lvSeen.lv) { if (lv > _lvSeen.lv) _lvSeen.lv = lv; return; }
  _lvSeen.lv = lv;
  if (Date.now() - _lvSeen.at < 6000) return;   // 로그인 직후 — 오연출 막기
  if (typeof triggerLevelUp === 'function') setTimeout(() => triggerLevelUp(lv), 300);
}

function enterGame() {
  if (CUR) _lvSeen = { id: CUR.id, lv: CUR.level || 1, at: Date.now() };   // [UX-TRIM-G4]
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

  loadCharDolls();   // [CHAR-DOLL-1] 캐릭터 SVG 84장 미리 받기(실패해도 게임 진행에 영향 없음)
  watchThinkboardHome();   // [THINKBOARD-HOME-1] 선생님이 연 생각판을 홈에 바로

  // ★ 미완료 전투 감지: 전투 도중 창을 닫고 재접속한 경우
  // 횟수는 startBattle()에서 이미 차감됐으므로 상태만 정리 (패배 처리)
  if (CUR.battleInProgress) {
    const monName = CUR.battleInProgress.monName || '몬스터';
    CUR.battleInProgress = null;
    DB.saveStudent(CUR);
    // 게임 화면 진입 후 안내 (renderAll 이후에 보여야 잘 보임)
    setTimeout(() => toast(`⚠️ [${monName}] 전투 중에 꺼져서 진 걸로 쳤어요.\n이미 쓴 전투 기회는 돌아오지 않아요.`), 500);
  }

  document.getElementById('s-game').classList.add('active');
  setHomeSec(_homeSecSaved());   // [HOME-C-1] 지난번에 보던 홈 구역(처음이면 '오늘') · [HOME-SEC-PER-STUDENT] 이 아이 것
  applyLayout(LAYOUT_MODE);
  // 화면 맞춤 버튼 초기 상태 복원
  const sBtn = document.getElementById('scale-mode-btn');
  if (sBtn) sBtn.textContent = SCALE_MODE ? hudBtnText('🔍', '화면 맞춤 ON') : hudBtnText('🔍', '화면 맞춤');
  applyScale();
  renderAll();
  startAccessTimer();
  if (typeof asgEnter === 'function') asgEnter();   // [CLASS-ASSIGN-1] 선생님 과제 · 수업 — 내 칸 구독 · 수업 중이면 바로 덮개(student/assign.js)
  // [ENGLISH-LINK-1] 영어 복습앱 기록 → 보상 (실패해도 진입에 영향 없음)
  setTimeout(() => { try { syncEnglishRewards(true); } catch (e) { console.warn('영어앱 연동:', e); } }, 800);
  // [DAILY-STUDY-1] 로그인 직후 자동 팝업 3종(주간다짐 1.5초·단어퀴즈 20초·회고 30초) 폐기.
  //   기습적으로 학습을 끊고 튀어나와 실제 도움이 안 된다는 운영 판단.
  //   할 일은 홈 카드에서 학생이 눌러서 시작한다(오늘의 학습 카드 / 할 일 목록).
  //   [REFLECT-CUT-1] 그때 남겨 둔 자동 팝업 함수(checkWeeklyRoutine·tryShowReflectionPopup)는 부르는 곳이 없어 10-05 걷어냈다.
  //   주간 다짐은 홈·내 집의 주간 다짐 칸에서 연다. 감정 돌아보기 팝업은 통째로 없앴다(운영 기록은 그대로).
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

// ── [SPLIT-1] 여기 있던 'char' 덩어리(517줄)는 student/char.js 로 옮겼다 — 글자 그대로 ──
function renderMobile() {
  const s = CUR;
  renderCharCard('mob-char-svg-wrap','mob-char-cname','mob-char-job','mob-char-combat','mob-equip-grid','mob-ability-bars', s);
  document.getElementById('mob-main-tab').innerHTML = buildMainHTML();
  _restoreHomeOpen(document.getElementById('mob-main-tab'));   // [HOME-KEEP-OPEN-1]
}

function renderMain() {
  try {
    document.getElementById('main-area').innerHTML = buildMainHTML();
    _restoreHomeOpen(document.getElementById('main-area'));    // [HOME-KEEP-OPEN-1]
    renderRail();                                              // [HOME-C-1] 레일 배지
  } catch(e) {
    console.error('renderMain 오류:', e);
    document.getElementById('main-area').innerHTML = `
      <div style="padding:2rem;text-align:center;color:var(--txt2)">
        <div style="font-size:2rem;margin-bottom:.5rem">⚠️</div>
        <div style="font-size:.85rem">화면을 여는 중에 문제가 생겼어요</div>
        <div style="font-size:.72rem;color:var(--txt3);margin-top:.3rem">${e.message}</div>
        <button onclick="renderAll()" style="margin-top:1rem;padding:.5rem 1rem;border-radius:8px;
          background:var(--gold);color:#1a1a1a;border:none;font-weight:700;cursor:pointer">다시 시도</button>
      </div>`;
  }
}

// ══ 내 쪽지 (NOTES-1) ══════════════════════════════════════════
//  교사가 studentNotes/<sid>/<noteId> 에 써 준 쪽지를 읽기만 한다.
//  학생 쓰기 없음 — 새 쪽지 확인 시각만 그 기기 localStorage 에 남긴다(#183 과 같은 방식).
//  비밀번호 항목은 없다(교사 화면에서 아예 받지 않는다).
const NOTE_SEEN_PREFIX = 'rpg.noteSeen.';

function _noteSeenAt(sid) {
  let v = null;
  try { v = localStorage.getItem(NOTE_SEEN_PREFIX + sid); } catch (e) {}
  if (v && Number(v) > 0) return Number(v);
  const t = new Date(); t.setHours(0, 0, 0, 0);   // 처음이면 오늘 0시부터
  return t.getTime();
}

function getMyNotes() {
  return (DB.getStudentNotes ? DB.getStudentNotes(CUR.id) : []);
}

function getUnseenNotes() {
  const seen = _noteSeenAt(CUR.id);
  return getMyNotes().filter(n => (n.updatedAt || 0) > seen);
}

// 확인 — 교사 기기와 시계가 어긋나도 확실히 닫히게 max 를 쓴다(#183 과 같은 이유).
function dismissNoteSeen() {
  const shown = getUnseenNotes();
  const last  = shown.reduce((m, n) => Math.max(m, n.updatedAt || 0), 0);
  try { localStorage.setItem(NOTE_SEEN_PREFIX + CUR.id, String(Math.max(Date.now(), last))); } catch (e) {}
  renderAll();
}

function openNoteList() { openModal('m-note'); renderNoteList(); }

// 클립보드가 막힌 크롬북에서도 쓸 수 있게, 실패하면 그 칸을 선택해 준다.
function copyNoteText(el, text) {
  const done = () => toast('✅ 복사했어요!');
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => selectNoteText(el));
      return;
    }
  } catch (e) {}
  selectNoteText(el);
}
function selectNoteText(el) {
  const target = el && el.parentElement && el.parentElement.querySelector('[data-note-val]');
  if (!target) { toast('길게 눌러서 복사해 주세요.'); return; }
  try {
    const r = document.createRange(); r.selectNodeContents(target);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    toast('선택했어요 — 길게 눌러 복사하세요.');
  } catch (e) { toast('길게 눌러서 복사해 주세요.'); }
}

function toggleNotePw(el) {   // 값 가림/보임 토글 (아이디처럼 남에게 안 보이게)
  const v = el.querySelector('[data-note-val]');
  if (!v) return;
  const real = v.getAttribute('data-note-val');
  const hidden = v.textContent.indexOf(String.fromCharCode(9679)) === 0;
  v.textContent = hidden ? real : String.fromCharCode(9679, 9679, 9679, 9679, 9679, 9679);
}

function renderNoteList() {
  const el = document.getElementById('note-body');
  if (!el) return;
  const notes = getMyNotes();
  el.innerHTML = notes.length ? notes.map(n => `
    <div style="border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:.6rem .7rem;margin-bottom:.5rem">
      <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.3rem">
        <span style="font-size:1.05rem">${n.kind === 'account' ? '🔑' : '📝'}</span>
        <b style="font-size:.9rem;flex:1">${escHtml(n.site || '쪽지')}</b>
        ${safeUrl(n.url) ? `<a href="${escHtml(safeUrl(n.url))}" target="_blank" rel="noopener"
          class="btn-gold" style="display:inline-block;padding:.25rem .6rem;font-size:.72rem;
          font-weight:700;text-decoration:none;border-radius:50px;box-shadow:none;animation:none">🔗 사이트 열기</a>` : ''}
      </div>
      ${n.loginId ? `<div onclick="toggleNotePw(this)"
          style="display:flex;align-items:center;gap:.4rem;font-size:.84rem;padding:.25rem 0;cursor:pointer">
        <span style="color:var(--txt2);font-size:.76rem;width:3rem">아이디</span>
        <span data-note-val="${escHtml(n.loginId)}" style="flex:1">${escHtml(n.loginId)}</span>
        <button class="btn-gold" style="padding:.2rem .5rem;font-size:.7rem"
          onclick="event.stopPropagation();copyNoteText(this, ${JSON.stringify(n.loginId)})">📋 복사</button>
      </div>` : ''}
      ${n.memo ? `<div style="font-size:.82rem;color:var(--txt);margin-top:.25rem;white-space:pre-wrap">${escHtml(n.memo)}</div>` : ''}
    </div>`).join('')
    : '<div style="font-size:.8rem;color:var(--txt3);padding:.6rem .2rem">아직 받은 쪽지가 없어요.</div>';
}

// ══ 내 보상 목록 (REWARD-LIST-1) ═══════════════════════════════
//  대기 배너·승인 배너를 누르면 "기다리는 중 / 최근 받은 보상"을 한 화면에서 본다.
//  읽기만 한다 — 학생 스키마 변경·Firebase 쓰기 없음.
//  홈의 "📜 최근 활동"(접힌 칸)은 그대로 두고 여기서 링크만 건다.
const REWARD_LIST_MAX = 20;

function openRewardList() { openModal('m-reward'); renderRewardList(); }

function _rewardAmountHTML(exp, gold) {
  const parts = [];
  if (exp)  parts.push(`<span style="color:var(--gold)">+${exp} EXP</span>`);
  if (gold) parts.push(`<span style="color:var(--gold)">+${gold} G</span>`);
  return parts.join(' ');
}

function _rewardRowHTML(icon, name, exp, gold, right) {
  return `<div style="display:flex;align-items:center;gap:.5rem;padding:.45rem .2rem;
      border-bottom:1px solid rgba(255,255,255,.05)">
    <span style="font-size:1.05rem;flex-shrink:0">${escHtml(icon || '📋')}</span>
    <span style="flex:1;min-width:0;font-size:.88rem;overflow:hidden;text-overflow:ellipsis;
      white-space:nowrap">${escHtml(name || '')}</span>
    <span style="font-size:.76rem;flex-shrink:0">${_rewardAmountHTML(exp, gold)}</span>
    ${right ? `<span style="font-size:.7rem;color:var(--txt3);flex-shrink:0">${escHtml(right)}</span>` : ''}
  </div>`;
}

function renderRewardList() {
  const el = document.getElementById('reward-list-body');
  if (!el) return;
  const s = CUR;

  const waiting = (s.pendingRewards || []).filter(r => !r.approved);
  const done = (DB.load().quests || [])
    .filter(q => q && q.studentId === s.id && q.approved === true)
    .sort((a, b) => _questLogTime(b) - _questLogTime(a))
    .slice(0, REWARD_LIST_MAX);

  const sec = (title, count, inner) => `
    <div style="margin-bottom:.9rem">
      <div style="font-size:.78rem;color:var(--txt2);margin-bottom:.3rem">${title} ${count}개</div>
      ${inner}
    </div>`;
  const empty = msg => `<div style="font-size:.78rem;color:var(--txt3);padding:.5rem .2rem">${msg}</div>`;

  el.innerHTML =
    sec('⏳ 선생님 확인 기다리는 중', waiting.length,
        waiting.length
          ? waiting.map(r => _rewardRowHTML(r.icon, r.label, r.exp, r.gold, '')).join('')
          : empty('지금 기다리는 게 없어요.'))
    + sec('✅ 받은 보상', done.length,
        done.length
          ? done.map(q => _rewardRowHTML(q.icon, q.name, q.exp, q.gold, q.approvedAt || q.date || '')).join('')
            + (done.length >= REWARD_LIST_MAX
                ? `<div style="font-size:.7rem;color:var(--txt3);padding:.4rem .2rem">최근 ${REWARD_LIST_MAX}개만 보여요.</div>` : '')
          : empty('아직 받은 보상이 없어요.'))
    + `<button onclick="closeModal('m-reward');setHomeSec('me');_openHomeSection('bottom-section','bottom-arrow')"
        style="width:100%;padding:.45rem;border-radius:8px;background:rgba(255,255,255,.04);
          border:1px solid rgba(255,255,255,.08);color:var(--txt2);font-size:.76rem;
          cursor:pointer;font-family:inherit">📜 전체 기록 보기 (최근 활동)</button>`;
}

// ══ 보상 승인 알림 (REWARD-STATUS-1) ═══════════════════════════
//  문제: 교사가 승인하면 pendingRewards 에서 사라지고 EXP·골드만 조용히 늘어,
//        학생 입장에서 "내가 낸 게 어떻게 됐지"가 영영 닫히지 않았다.
//        승인 이력은 접혀 있는 "📜 최근 활동" 5개뿐이라 눈에 띄지 않는다.
//  방법: 승인된 questLog 중 아직 안 본 것을 홈 배너로 보여주고, 닫으면 시각을 남긴다.
//  · 학생 스키마 변경·Firebase 쓰기 없음. 확인 시각은 그 기기 localStorage 에만 둔다.
//  · [DAILY-STUDY-1] 에서 로그인 자동 팝업 3종을 폐기했으므로 모달이 아니라 홈 카드로 낸다.
const REWARD_SEEN_PREFIX = 'rpg.rewardSeen.';

// 이 기기에서 마지막으로 확인한 시각(ms). 처음이면 오늘 0시부터 본다.
//   (0으로 두면 지난 학기 승인까지 한꺼번에 쏟아진다)
function _rewardSeenAt(sid) {
  let v = null;
  try { v = localStorage.getItem(REWARD_SEEN_PREFIX + sid); } catch (e) {}
  if (v && Number(v) > 0) return Number(v);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return t.getTime();
}

// questLog 하나의 승인 시각(ms).
//   approvedAt 은 날짜 문자열(YYYY-MM-DD)뿐이라 같은 날 안에서는 순서를 못 가린다.
//   DB.saveQuestLog 가 만드는 _id 에 Date.now() 가 들어 있어 그걸 쓴다:
//     `${studentId}_${boardQuestId|manual}_${Date.now()}_${rand5}`
//   studentId·boardQuestId 에 '_' 가 들어갈 수 있으므로(예: bq_auto_2026-09-04_0)
//   앞에서 세지 않고 **뒤에서 두 번째** 조각을 쓴다.
function _questLogTime(q) {
  const parts = String((q && q._id) || '').split('_');
  const ms = parts.length >= 2 ? Number(parts[parts.length - 2]) : NaN;
  if (ms > 0) return ms;
  const d = Date.parse((q && (q.approvedAt || q.date)) || '');   // _id 없는 옛 기록
  return d > 0 ? d : 0;
}

function getUnseenApprovals(s) {
  const seen = _rewardSeenAt(s.id);
  return (DB.load().quests || [])
    .filter(q => q && q.studentId === s.id && q.approved === true && _questLogTime(q) > seen)
    .sort((a, b) => _questLogTime(a) - _questLogTime(b));
}

// 확인 버튼 — 시각만 남기고 다시 그린다. 서버에 쓰지 않는다.
//   교사 PC와 학생 크롬북의 시계가 어긋나면 승인 시각이 학생 기준 "미래"일 수 있다.
//   그때 Date.now()만 넣으면 그 항목이 안 지워져 배너가 영영 남는다(고치려던 문제가 되돌아온다).
//   지금 화면에 보여준 것 중 가장 늦은 시각까지 확실히 넘긴다.
function dismissRewardSeen() {
  const shown = getUnseenApprovals(CUR);
  const last  = shown.length ? _questLogTime(shown[shown.length - 1]) : 0;
  const at    = Math.max(Date.now(), last);
  try { localStorage.setItem(REWARD_SEEN_PREFIX + CUR.id, String(at)); } catch (e) {}
  renderAll();
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

  // 선생님이 확인해 준 것 — 아직 안 본 것만. 확인을 누르면 사라진다.
  //   name 은 학생이 쓴 제목(작품 등)이 들어오므로 반드시 escHtml.
  const approvedNew = getUnseenApprovals(s);
  if (approvedNew.length)
    alerts.push(`<div class="reward-banner" onclick="openRewardList()" style="margin-bottom:.6rem;cursor:pointer">
      <div class="rb-icon">✅</div>
      <div class="rb-body">
        <div class="rb-title green">선생님이 확인해 주셨어요 · ${approvedNew.length}개</div>
        ${approvedNew.slice(0,5).map(q=>`<div class="rb-desc" style="font-size:.88rem;color:var(--txt)">${escHtml(q.icon||'📋')} ${escHtml(q.name||'')}${(q.exp||0)?` <span style="color:var(--gold)">+${q.exp} EXP</span>`:''}${(q.gold||0)?` <span style="color:var(--gold)">+${q.gold} G</span>`:''}</div>`).join('')}
        ${approvedNew.length>5?`<div class="rb-desc">…외 ${approvedNew.length-5}개</div>`:''}
      </div>
      <button class="btn-gold" onclick="event.stopPropagation();dismissRewardSeen()" style="padding:.4rem .9rem;font-size:.78rem;flex-shrink:0">확인</button>
    </div>`);

  // [UI375-3] '선생님 확인 기다리는 중'은 여기(배너) 한 곳에만 둔다.
  //   전에는 '오늘 할 일' 카드에도 같은 문장이 있어 홈에 두 번 나왔고,
  //   학생이 할 일이 두 개인 줄 알았다(UI 점검 P0-4).
  //   배너를 남기는 쪽을 골랐다 — 신청이 접수됐는지 알리는 것이 이 안내의 목적이고,
  //   배너는 '할 일 더보기'를 펼치지 않아도 보인다.
  //   '오늘 할 일'에는 학생이 지금 할 수 있는 것만 남긴다(기다리는 중은 할 게 없다).
  if (waitingCount > 0)
    alerts.push(`<div class="reward-banner" onclick="openRewardList()" style="margin-bottom:.6rem;opacity:.85;cursor:pointer">
      <div class="rb-icon">⏳</div>
      <div class="rb-body"><div class="rb-title" style="color:var(--sky)">선생님 확인 기다리는 중 ${waitingCount}개</div>
      <div class="rb-desc" style="font-size:.88rem;color:var(--txt)">${(s.pendingRewards||[]).filter(r=>!r.approved).map(r=>escHtml(r.label||'')).join(' · ')}</div></div>
      <div style="font-size:.72rem;color:var(--txt3);flex-shrink:0;padding:.4rem .6rem">보기 ›</div>
    </div>`);
  // 새로 온 쪽지 — 보상 배너 아래(지시). 확인을 누르면 사라진다. 학생 쓰기 없음.
  const newNotes = getUnseenNotes();
  if (newNotes.length)
    alerts.push(`<div class="reward-banner" onclick="openNoteList()" style="margin-bottom:.6rem;cursor:pointer">
      <div class="rb-icon">📝</div>
      <div class="rb-body">
        <div class="rb-title gold">선생님이 쪽지를 줬어요 · ${newNotes.length}개</div>
        <div class="rb-desc" style="font-size:.88rem;color:var(--txt)">${
          newNotes.slice(0,3).map(n=>escHtml(n.site||n.memo||'쪽지')).join(' · ')}</div>
      </div>
      <button class="btn-gold" onclick="event.stopPropagation();dismissNoteSeen()"
        style="padding:.4rem .9rem;font-size:.78rem;flex-shrink:0">확인</button>
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
      <div style="font-size:2rem">${escHtml(settings.bossIcon||'🧌')}</div>
      <div style="flex:1"><div style="font-weight:900;color:var(--red)">${escHtml(settings.bossName||'금요일 보스')} 출현!</div>
      <div style="font-size:.76rem;color:var(--txt2)">${bossClaimedThisWeek(s) ? '이번 주 보상 받음 ✓' : `보상: 💰${Utils.intOr(settings.bossGold, 150)}G + 30EXP`}</div></div>
      <button class="bb-btn">${bossClaimedThisWeek(s) ? '보기' : '도전!'}</button>
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

  // [NOTE-TODO-1] 쪽지는 '할 일'로 내지 않는다. 전엔 쪽지가 한 번이라도 오면 매일 첫 할 일(금테)로 떴다.
  //   새 쪽지는 위 쪽지 배너('선생님이 쪽지를 줬어요 · N개')가 알리고, 지난 쪽지는 '나의 공간'의 [선생님 쪽지]로 본다.

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
  //   '선생님 확인 기다리는 중'도 여기 두지 않는다 — 위 배너 한 곳에서만 알린다([UI375-3]).

  // 7순위: 힌트성
  const todayBook = (s.books||[]).find(b=>b.date===Utils.todayStr());
  if (!todayBook)
    todos.push({type:'hint', icon:'📚', badge:null,
      title:'오늘 독서 기록 없음',
      sub:'읽은 책을 기록하면 독서 능력치가 올라요',
      action:"openModal('m-house');renderHouse()", btnLabel:null});

  const hasSeed = (s.inventory||[]).some(i=>GAME_DATA.seeds.find(sd=>sd.id===i.id));
  if ((s.farm||[]).length === 0 && hasSeed)
    todos.push({type:'farm', icon:'🌱', badge:null,
      title:'농장이 비어있어요',
      sub:'씨앗을 심으면 골드를 벌 수 있어요',
      action:"openModal('m-farm');renderFarmModal()", btnLabel:'심기'});

  // [UX-TRIM-G4] '오늘 할 일' 수 = 할 일 카드 + 남은 오늘의 학습 + 아직 신청 안 한 선생님 퀘스트.
  //   '완료!' 카드는 이 셋이 모두 0 일 때만 — 전엔 학습이 남아도 카드가 떠 '할 일 1개' 제목과 어긋났다.
  const studyRecs = typeof CurriculumUtils !== 'undefined' ? getTodayStudyRecords(s.id) : [];
  const studyDone = studyRecs.reduce((n, r) => n + (r.total || 0), 0);
  const studyLeft = typeof CurriculumUtils !== 'undefined' && studyDone < STUDY_PER_DAY;
  const boardQuests = (db.boardQuests||[]).filter(q=>q.active!==false);
  const activeBQIds = new Set(boardQuests.map(q=>q.id));
  const questLogs   = db.quests || [];
  const questStat   = q => Utils.questStatus(s.id, q.id, q.type, questLogs, s.pendingRewards, activeBQIds);
  const openQuests  = boardQuests.filter(q => questStat(q) === 'none');   // questStatus: done · pending · none(=아직 안 함)
  const assignLeft = typeof assignTodoCount === 'function' ? assignTodoCount() : 0;   // [CLASS-ASSIGN-1] 안 끝낸 선생님 과제
  if (todos.length === 0 && !studyLeft && openQuests.length === 0 && !assignLeft)
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

  // ── 오늘의 미션 (퀘스트 인라인 체크리스트) ── 날짜 기반 완료 판단(일일=오늘 · 주간=이번 주 · 과제/특별=영구)은 Utils.questStatus
  const missionRow = q=>{
        const status  = questStat(q);
        const done    = status === 'done';
        const pending = status === 'pending';
        const typeLabel = {daily:'📋 일일',weekly:'📅 주간',special:'✏️ 과제',event:'⭐ 특별'}[q.type]||'📋';
        return `
        <div class="mission-row ${done?'done':pending?'pending':''}"
          onclick="${(!done&&!pending)?`openQuestModal('${q.id}')`:''}"
          style="cursor:${(!done&&!pending)?'pointer':'default'}">
          <div class="mission-check ${done?'done':pending?'wait':''}">
            ${done?'✓':pending?'⏳':''}
          </div>
          <span style="font-size:1rem;flex-shrink:0">${escHtml(q.icon||'📋')}</span>
          <div style="flex:1;min-width:0">
            <div class="mission-name">${escHtml(q.name)}</div>
            <div style="font-size:.68rem;color:var(--txt3)">${typeLabel}${q.dueDate?` · 마감 ${q.dueDate}`:''}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.15rem;flex-shrink:0">
            <span class="mission-reward">+${q.exp}EXP</span>
            ${done?`<span style="font-size:.65rem;color:var(--emerald);font-weight:700">완료!</span>`
              :pending?`<span style="font-size:.65rem;color:var(--gold)">확인 중…</span>`
              :`<span style="font-size:.65rem;color:var(--txt3)">열어 보기 ›</span>`}
          </div>
        </div>`;
      };
  // [UX-TRIM-G4] 아직 신청 안 한 퀘스트는 위에 펼쳐 두고, 신청했거나 끝난 것만 아래 접힌 칸에
  //   [UX-TRIM-G4b] 줄을 누르면 바로 신청되지 않고 퀘스트 창(그 퀘스트)이 열린다 — 신청은 창의 '신청' 단추(전과 같은 흐름).
  //   펼치는 건 셋까지 — 퀘스트가 많아도 첫 할 일 카드가 화면 안에 남게. 나머지는 '퀘스트 N개 더 보기'(펼침 상태는 다시 그려도 유지)
  const OPEN_Q_SHOW = 3;
  const openQuestHtml = openQuests.slice(0, OPEN_Q_SHOW).map(missionRow).join('');
  const openQuestMore = openQuests.slice(OPEN_Q_SHOW).map(missionRow).join('');
  const closedQuests  = boardQuests.filter(q => questStat(q) !== 'none');
  const missionHtml   = closedQuests.map(missionRow).join('');

  const allStudents = DB.getStudents().filter(st=>st.id!==s.id);
  const {cols:_fc, rows:_fr} = getFarmLayout(s.level||1);
  const farmCells   = buildFarmMiniCells(_fc * _fr, _fc);
  const _allMons    = getActiveMonsters();
  const alive       = _allMons.filter(m=>!(s.monsterLog||[]).includes(m.id));
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

  // ══ [HOME-C-1] 홈 = 네 구역(오늘 · 배우고 만들기 · 나의 공간 · 모험). 사용자 10-03 시안 C 선택.
  //   네 구역을 다 그리고 데스크톱(701px↑)은 CSS 가 고른 구역 하나만 보인다(#s-game[data-home-sec]).
  //   폰(#mob-main-tab)은 지금처럼 위에서 아래로 다 보인다 — 어느 입구도 빠지지 않게.
  //   다른 코드가 기대는 id(today-links · rest-todo-* · quest-section · bottom-section · ach-tile-notif)와
  //   .home-thinkboard · [onclick*="openHouseTab"] 는 한 벌씩 그대로 둔다.
  const ZOOM = { 'deco/d_y22.svg': 2.3, 'deco/deco_garden.svg': 2.1, 'deco/d_y34.svg': 1.8, 'deco/d_y36.svg': 1.4, 'deco/deco_trophy.svg': 1.8,
    'deco/deco_bookshelf.svg': 1.5, 'deco/in_w_clock.svg': 1.2, 'deco/d_i9.svg': 1.2, 'deco/d_i5.svg': 1.2, 'deco/guest_owl.svg': 1.3 };
  const asset = (f, cls = 'hc-art') => `<img class="${cls}" src="./assets/${f}" alt="" loading="lazy"${ZOOM[f] && cls === 'hc-art' ? ` style="--z:${ZOOM[f]}"` : ''}>`;
  const dateKo = (() => { const k = new Date(Date.now() + 9 * 3600000); return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${'일월화수목금토'[k.getUTCDay()]}요일`; })();
  const realTodos = todos.filter(t => t.type !== 'done' && t.type !== 'hint' && t.type !== 'info').length + (studyLeft ? 1 : 0) + openQuests.length + assignLeft;
  _homeCounts = { todo: realTodos, attemptsLeft: canFight ? attemptsLeft : 0, farmReady, pendingCount };
  // 우리 반 소식 — 이미 있는 데이터만(새 저장소 없음)
  const newsRows = [];
  const weekArt = galleryArtworks().filter(a => (a.date || '') >= weekStart);
  if (weekArt.length) {
    const nm = id => { const st = DB.getStudent(id); return st ? st.name : ''; };
    newsRows.push(`<div class="hc-news" onclick="openArtFree('class')">${asset('deco/ui_photo_frame.svg', 'hc-news-art')}
      <div><b>이번 주 새 작품 ${weekArt.length}점</b><span>${weekArt.slice(0, 2).map(a => escHtml((a.title || '작품') + (nm(a.studentId) ? ' · ' + nm(a.studentId) : ''))).join(' / ')}</span></div></div>`);
  }
  const newQuests = boardQuests.filter(q => q.date === today);
  if (newQuests.length) newsRows.push(`<div class="hc-news" onclick="openQuestModal()">${asset('deco/gift_sticker.svg', 'hc-news-art')}
      <div><b>선생님이 새 퀘스트를 올렸어요</b><span>${newQuests.slice(0, 2).map(q => escHtml(q.name || '')).join(' · ')}</span></div></div>`);
  // 입구 하나(그림 · 이름 · 한 줄 · 배지)
  const door = (art, name, sub, action, badge = '', cls = '') => `
    <div class="hc-door ${cls}" onclick="${action}">${badge ? `<span class="hc-badge">${badge}</span>` : ''}
      ${art}<b>${name}</b><span>${sub}</span></div>`;
  const ext = key => externalStudyItems().find(x => x.key === key);

  return `
  <section class="home-sec hs-today" data-sec="today">
    <div class="hs-cols">
      <div class="hs-main">
        <div class="hs-head"><span class="hs-date">${dateKo}</span><h2>${realTodos ? `오늘 할 일 ${realTodos}개` : '오늘 할 일 다 했어요'}</h2></div>
        ${typeof buildAssignCardsHTML === 'function' ? buildAssignCardsHTML() : ''}
        ${alerts.join('')}
        ${buildStudyTaskHTML(s)}
        ${openQuests.length ? `
        <div class="home-quest-open">
          <div style="font-size:.78rem;font-weight:800;color:var(--gold);margin:.2rem 0 .35rem">📋 선생님 퀘스트 ${openQuests.length}개 · 다 하면 눌러서 신청해요</div>
          <div class="mission-list" style="margin-bottom:.6rem">${openQuestHtml}</div>
          ${openQuestMore ? `
          <div id="quest-open-more" class="mission-list" style="display:none;margin-bottom:.6rem">${openQuestMore}</div>
          <button class="home-quest-more" onclick="toggleSection('quest-open-more','quest-open-more-arrow')">
            <span>📋 퀘스트 ${openQuests.length - OPEN_Q_SHOW}개 더 보기</span><span id="quest-open-more-arrow">▼</span>
          </button>` : ''}
        </div>` : ''}
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
            <span style="font-size:.8rem;color:var(--txt1)">💪 <b>${escHtml(goal.focusArea||'')}</b></span>
            <span style="font-size:.8rem;color:var(--txt1)">🎯 <b>${escHtml(goal.goalText||'')}</b></span>
            <span style="font-size:.8rem;color:var(--txt1)">🌟 <b>${escHtml(goal.mindset||'')}</b></span>
          </div>
        </div>`;
    })()}
        ${emotionCard}
    <!-- ④ 신청했거나 끝난 퀘스트 (기본 접힘) — 열린 퀘스트는 위에 펼쳐 둔다 [UX-TRIM-G4] -->
    ${closedQuests.length>0 ? `
    <button onclick="toggleSection('quest-section','quest-arrow')"
      style="width:100%;padding:.4rem .7rem;border-radius:8px;background:rgba(255,255,255,.03);
        border:1px solid rgba(255,255,255,.07);color:var(--txt2);font-size:.78rem;
        cursor:pointer;font-family:inherit;display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem">
      <span>📋 퀘스트
        <span style="font-size:.7rem;color:var(--txt3);margin-left:.4rem">
          ${boardQuests.filter(q=>questStat(q)==='done').length}/${boardQuests.length} 완료
        </span>
      </span>
      <span id="quest-arrow" style="font-size:.7rem">▼</span>
    </button>
    <div id="quest-section" style="display:none">
      <div class="mission-list" style="margin-bottom:.6rem">${missionHtml}</div>
    </div>` : ''}
      </div>
      <aside class="hs-news">
        <div class="sec-label">우리 반 소식</div>
    ${(()=>{
      const todayLinks = (DB.getSettings().todayLinks||[]).filter(l=>safeUrl(l.url)&&l.title);
      if (!todayLinks.length) return '';
      return `<div style="background:rgba(93,173,226,.07);border:1px solid rgba(93,173,226,.2);
        border-radius:12px;padding:.55rem .9rem;margin-bottom:.5rem">
        <button onclick="toggleSection('today-links','today-links-arrow')"
          style="width:100%;background:none;border:none;padding:0;cursor:pointer;font-family:inherit;
            display:flex;align-items:center;gap:.4rem;color:var(--sky)">
          <span style="font-size:.75rem;font-weight:700">🔗 오늘의 링크</span>
          <span style="font-size:.68rem;color:var(--txt3)">${todayLinks.length}개</span>
          <span id="today-links-arrow" style="margin-left:auto;font-size:.7rem;color:var(--txt3)">▼</span>
        </button>
        <div id="today-links" style="display:none;margin-top:.4rem">
        ${todayLinks.map(l=>`
          <a href="${escHtml(safeUrl(l.url))}" target="_blank" rel="noopener"
            style="display:flex;align-items:center;gap:.5rem;padding:.3rem 0;
              text-decoration:none;border-bottom:1px solid rgba(255,255,255,.05)">
            <span style="font-size:.8rem;color:var(--sky);font-weight:600">${escHtml(l.title)}</span>
            <span style="font-size:.63rem;color:var(--txt3);margin-left:auto">열기 →</span>
          </a>`).join('')}
        </div>
      </div>`;
    })()}
        ${buildThinkboardSlotHTML()}
        ${newsRows.join('')}
        ${!newsRows.length && !_tbHome ? '<div class="hc-empty">새 소식이 오면 여기에 떠요. 선생님이 생각판을 열거나 친구가 작품을 올리면 보여요.</div>' : ''}
      </aside>
    </div>
  </section>

  <section class="home-sec hs-learn" data-sec="learn">
    <div class="hs-head"><h2>배우고 만들기</h2><span class="hs-sub">문제 풀고 · 생각 나누고 · 만들어요</span></div>
    <div class="hc-grid">
      <!-- [UX-TRIM-G4] 매일 쓰는 문(학습 · 생각판 · 보상 있는 영어 · 독서 · 우리 반 작품)이 앞 — 1366×610 첫 화면 안. 학습 앱 일곱은 뒤 · 늘 붙던 NEW 뗌 -->
      ${door(asset('deco/d_i5.svg'), '오늘의 학습', typeof CurriculumUtils === 'undefined' ? '교과 문제' : studyLeft ? `하루 ${STUDY_PER_DAY}문제 · ${studyDone}문제 했어요` : '오늘 공부 끝!', 'openStudyModal()', studyLeft ? '오늘' : '')}
      ${door(asset('deco/in_w_board.svg'), '생각판', '선생님이 연 판에 내 생각을 붙여요', "openExternalEmbed('thinkboard')")}
      ${ext('english') ? door(asset('deco/guest_owl.svg'), '영어 복습', '단어 · 표현 · 듣기 · 말하기', "openExternalEmbed('english')") : ''}
      ${door(asset('deco/in_w_bookshelf.svg'), '독서 기록', `읽은 책 ${(s.books || []).length}권`, "openHouseTab('book')")}
      ${door(asset('deco/d_i4_wall.svg'), '우리 반 작품', '그린 그림을 올리고 친구 작품도 봐요', "openArtFree('class')")}
      ${door(asset('deco/d_i9.svg'), '음악실', '작곡 · 리코더 연습 · 리듬 게임', "openExternalEmbed('music')")}
      ${door(asset('monsters/m1.png'), '기초 코딩', '블록으로 몬스터에게 명령해요', "openExternalEmbed('coding')")}
      ${door(asset('monsters/m3.png'), '무늬 공방', '밀고 · 뒤집고 · 돌려서 무늬 만들기', "openExternalEmbed('pattern')")}
      ${door(asset('monsters/m22.png'), '물감 연구소', '세 물감으로 색 섞기 · 보색 · 느낌의 색', "openExternalEmbed('paint')")}
      ${door(asset('monsters/m30.png'), '명화 탐정', '옛 그림 속 숨은 것 찾기 · 질문 만들기', "openExternalEmbed('art')")}
      ${door(asset('monsters/m49.png'), '먹 연구소', '먹색 · 붓 놀이 · 판본체 글씨 · 수묵화', "openExternalEmbed('ink')")}
      ${door(asset('monsters/m71.png'), '판화 놀이', '새기고 찍으면 거울처럼 · 판화 읽기', "openExternalEmbed('print')")}
      ${ext('watercolor') ? door(asset('deco/gift_photo.svg'), '수채화 기초', '태블릿 보며 진짜 종이에 연습', "openExternalEmbed('watercolor')") : ''}
      ${ext('drawing') ? door(asset('deco/gift_feather.svg'), '데생 기초', '연필로 선 · 명암 · 형태', "openExternalEmbed('drawing')") : ''}
    </div>
  </section>

  <section class="home-sec hs-me" data-sec="me">
    <div class="hs-head"><h2>나의 공간</h2><span class="hs-sub">내 캐릭터 · 내 집 · 내 기록</span></div>
    <div class="hc-grid small">
      ${door(asset('deco/d_y22.svg'), '가방', '아이템 · 장비', "openModal('m-inv');renderInv()")}
      ${door(asset('deco/deco_garden.svg'), '꾸미기', '마당 · 방 꾸미기', "openHouseTab('deco')")}
      ${door(asset('deco/heart_full.svg'), '주간 다짐', '이번 주 다짐 · 돌아보기', "openHouseTab('weekly')")}
      ${door(asset('deco/heart_empty.svg'), '감정', '내 감정 기록', "openHouseTab('emotion')")}
      ${door(asset('deco/deco_bookshelf.svg'), '독서', '읽은 책 기록', "openHouseTab('book')")}
      ${door(asset('deco/d_i4_wall.svg'), '내 작품', '내가 올린 그림', "openHouseTab('artwork')")}
      ${door(asset('deco/gift_photo.svg'), '추억', '우리 반 사진', "openHouseTab('memory')")}
      <div class="hc-door" onclick="openHouseTab('ach')"><div id="ach-tile-notif" class="tile-notif" style="display:none">!</div>
        ${asset('deco/fx_first_meet.svg')}<b>업적</b><span>모은 업적</span></div>
      ${door(asset('deco/in_w_clock.svg'), '기록', '활동 기록 · 그래프', "openHouseTab('stats')")}
      ${door(asset('deco/d_i9.svg'), '리코더', '리코더 기록장', "openExternalEmbed('music','#/log')")}
    </div>
    <div class="hc-links">
      <button onclick="openNoteList()">선생님 쪽지</button>
      <button onclick="openRewardList()">내 보상 기록</button>
    </div>
    <!-- 최근 활동 — 기본 접힘(보상 목록의 '전체 기록 보기'가 여기를 연다) -->
    <button onclick="toggleSection('bottom-section','bottom-arrow')"
      style="width:100%;padding:.4rem .7rem;border-radius:8px;background:rgba(255,255,255,.03);
        border:1px solid rgba(255,255,255,.07);color:var(--txt3);font-size:.72rem;
        cursor:pointer;font-family:inherit;display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem">
      <span>최근 활동</span>
      <span id="bottom-arrow" style="font-size:.7rem">▼</span>
    </button>
    <div id="bottom-section" style="display:none">
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
              ...(s.monsterLog||[]).slice(-2).reverse().map(m=>({icon:'⚔️',text:monsterNameById(m)+' 처치',color:'var(--red)'}))
            ];
            if(logs.length===0) return '<div style="font-size:.72rem;color:var(--txt3)">아직 기록 없어요</div>';
            return logs.slice(0,6).map(l=>`<div style="display:flex;align-items:center;gap:.35rem;padding:.2rem 0;border-bottom:1px solid rgba(255,255,255,.04)">
              <span style="font-size:.85rem">${l.icon}</span>
              <span style="font-size:.7rem;color:${l.color};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(l.text||'')}</span>
            </div>`).join('');
          })()}
        </div>
      </div>
    </div>
  </section>

  <section class="home-sec hs-adv" data-sec="adv">
    <div class="hs-head"><h2>모험</h2><span class="hs-sub">사냥 · 상점 · 농장 · 우리 마을</span></div>
    <div class="hc-grid">
      ${door(asset('monsters/m28.png'), '몬스터', canFight ? `오늘 ${attemptsLeft}번 남았어요` : '오늘 도전 끝', 'openMonsterModal()', canFight ? `${attemptsLeft}회` : '', 'big')}
      ${door(asset('deco/gift_sticker.svg'), '퀘스트', '확인 · 보상', 'openQuestModal()', pendingCount > 0 ? String(pendingCount) : '')}
      ${door(asset('deco/d_y34.svg'), '상점', '장비 · 씨앗', "openModal('m-shop');renderShop()")}
      ${door(asset('deco/d_y36.svg'), '농장', '심기 · 수확', "openModal('m-farm');renderFarmModal()", farmReady ? '수확!' : '')}
      ${door(asset('deco/deco_trophy.svg'), '랭킹', '우리 반 순위', "openModal('m-rank');renderRankingModal()")}
      ${door(asset('deco/yard_house.svg'), '우리 마을', '짓고 · 키우기', "openExternalEmbed('village')")}
      ${canPromo ? door(asset('deco/fx_first_meet.svg'), `Lv.${s.level} 승급`, '승급 신청하기', "openModal('m-promo')", '!') : ''}
    </div>
    <div class="today-grid" style="margin-top:.6rem">
        <div class="today-card" style="grid-column:1/-1">
          <div class="tc-label">👥 친구 방문</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem">
          ${allStudents.map(f=>`<div class="friend-row" onclick="visitFriend('${f.id}')">
            <span>${f.avatar} ${escHtml(f.name)}</span>
            <span style="font-size:.7rem;color:var(--txt3)">Lv.${f.level} →</span>
          </div>`).join('')}
          </div>
        </div>
    </div>
  </section>`;
}
// ══ [HOME-C-1] 홈 네 구역 — 왼쪽 레일(student.html 고정)로 고른다. 상태는 #s-game[data-home-sec] 에 둬서
//   홈이 innerHTML 로 통째 다시 그려져도(데이터가 바뀔 때마다) 고른 구역이 그대로다. 이 기기에 기억(localStorage).
//  [HOME-SEC-PER-STUDENT] 한 크롬북을 여러 아이가 쓰므로 **아이마다** 기억한다('rpg.homeSec.<아이 id>'). 옛 키 'rpg.homeSec'(기기에 한 값 —
//   앞 아이가 보던 구역이 다음 아이에게 열렸다)는 읽지 않는다(지우지도 않음). 로그인 전에는 기억할 아이가 없어 '오늘'.
const HOME_SECS = ['today', 'learn', 'me', 'adv'];
let _homeCounts = null;
let HOME_SEC = 'today';
function _homeSecKey() { return (typeof CUR !== 'undefined' && CUR && CUR.id) ? 'rpg.homeSec.' + CUR.id : null; }
function _homeSecSaved() {   // 이 아이가 지난번에 보던 구역(처음이면 '오늘')
  const k = _homeSecKey();
  if (!k) return 'today';
  try { const v = localStorage.getItem(k); return HOME_SECS.includes(v) ? v : 'today'; } catch (e) { return 'today'; }
}
function setHomeSec(sec) {
  if (!HOME_SECS.includes(sec)) sec = 'today';
  HOME_SEC = sec;
  const k = _homeSecKey();
  if (k) { try { localStorage.setItem(k, sec); } catch (e) {} }
  const g = document.getElementById('s-game');
  if (g) g.dataset.homeSec = sec;
  document.querySelectorAll('#home-rail .hr-item').forEach(b => b.classList.toggle('on', b.dataset.sec === sec));
  const m = document.getElementById('main-area');
  if (m) m.scrollTop = 0;
}
function renderRail() {
  const c = _homeCounts || {}, set = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
  set('hr-sub-today', c.todo ? `할 일 ${c.todo}` : '다 했어요');
  set('hr-sub-learn', '학습 · 생각판 · 음악실');
  set('hr-sub-me', '가방 · 꾸미기 · 기록');
  set('hr-sub-adv', c.attemptsLeft ? `몬스터 ${c.attemptsLeft}번` : c.farmReady ? '수확할 것 있어요' : '상점 · 농장 · 마을');
}
// 펼치기만(이미 열렸으면 그대로) — 보상 목록의 '전체 기록 보기'
function _openHomeSection(sectionId, arrowId) {
  const sec = _homeEl(sectionId);
  if (sec && sec.style.display === 'none') toggleSection(sectionId, arrowId);
}

// ══ 보상 받기 ══
// [HOME-TOGGLE-MOBILE-1] buildMainHTML 은 데스크톱(#main-area)과 모바일(#mob-main-tab)에 **두 번** 그려져
//   같은 id 가 두 벌 생긴다. getElementById 는 DOM 앞쪽(#main-area, 폰에선 display:none)을 돌려줘서
//   폰에서 펼침 버튼을 누르면 안 보이는 데스크톱 쪽만 열리고 화면은 그대로였다(아이폰 "오늘의 링크" 안 눌림).
//   → 같은 id 중 **지금 보이는 판** 안의 것을 고른다. 판 밖(모달 등)에 있는 id 는 그대로 첫 번째.
function _homeEl(id) {
  const all = document.querySelectorAll('[id="' + id + '"]');
  for (const el of all) {
    const box = el.closest('#main-area, #mob-main-tab');
    if (!box || box.getClientRects().length) return el;   // display:none 조상이면 getClientRects 가 비어 있다
  }
  return all[0] || null;
}
function toggleRestTodo() {
  const wrap = _homeEl('rest-todo-wrap');
  const btn  = _homeEl('rest-todo-btn');
  if (!wrap) return;
  const open = wrap.style.display === 'none';
  wrap.style.display = open ? '' : 'none';
  if (btn) btn.textContent = open
    ? `▲ 할 일 접기`
    : `▼ 할 일 더보기 (${wrap.querySelectorAll('.todo-card').length}개)`;
  if (open) _homeOpen.set('rest-todo-wrap', '__rest-todo'); else _homeOpen.delete('rest-todo-wrap');   // [HOME-KEEP-OPEN-1]
}

function toggleSection(sectionId, arrowId) {
  const sec = _homeEl(sectionId);   // [HOME-TOGGLE-MOBILE-1]
  const arrow = _homeEl(arrowId);
  if (!sec) return;
  const open = sec.style.display === 'none';
  sec.style.display = open ? '' : 'none';
  if (arrow) arrow.textContent = open ? '▲' : '▼';
  if (open) _homeOpen.set(sectionId, arrowId); else _homeOpen.delete(sectionId);   // [HOME-KEEP-OPEN-1]
}

// [HOME-KEEP-OPEN-1] 홈 펼침 상태를 다시 그리기 뒤에도 유지한다.
//   onDataChange → renderMain·renderMobile 이 홈을 innerHTML 로 통째로 다시 그려 펼친 섹션이 기본(접힘)으로 돌아갔다.
//   교실에선 누군가 저장할 때마다(몇 초) 다시 그려져 "오늘의 링크 ▼ 가 펼쳐지지 않는다"처럼 보였다(에뮬레이터: 다른 학생 저장 첫 번에 접힘).
//   홈 섹션은 모두 기본 접힘이라 **펼친 것만** 기억한다. sectionId → arrowId (할 일 더보기는 '__rest-todo').
const _homeOpen = new Map();
function _restoreHomeOpen(box) {
  if (!box) return;
  for (const [sid, aid] of _homeOpen) {
    const sec = box.querySelector('[id="' + sid + '"]');
    if (!sec) continue;
    sec.style.display = '';
    if (aid === '__rest-todo') {
      const btn = box.querySelector('[id="rest-todo-btn"]');
      if (btn) btn.textContent = `▲ 할 일 접기`;
    } else if (aid) {
      const arrow = box.querySelector('[id="' + aid + '"]');
      if (arrow) arrow.textContent = '▲';
    }
  }
}

function toggleSideSection(sectionId, arrowId) {
  const sec = document.getElementById(sectionId);
  const arrow = document.getElementById(arrowId);
  if (!sec) return;
  const open = sec.style.display === 'none';
  sec.style.display = open ? '' : 'none';
  if (arrow) arrow.textContent = open ? '▲' : '▼';
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
      if (isEquip) badge = `<span style="color:var(--emerald);font-size:.62rem"> 장착 중</span>`;
      else if (inInv) badge = `<span style="color:var(--sky);font-size:.62rem"> 가진 것</span>`;

      // 구매 불가 사유 표시
      // [SHOP-LOCK-HINT-1] 잠금 줄 + 여는 법 + 1 모자람 표시
      const lock = owned ? { html: '', near: false } : shopLockInfo(CUR, item, check);
      const reasonHtml = lock.html;

      // element 뱃지 (body만)
      const elemBadge = item.element
        ? `<span style="font-size:.6rem;padding:.1rem .35rem;border-radius:6px;margin-left:.3rem;
            background:${item.element==='fire'?'rgba(231,76,60,.25)':item.element==='water'?'rgba(52,152,219,.25)':'rgba(39,174,96,.25)'};
            color:${item.element==='fire'?'#FF8A80':item.element==='water'?'#7ec8e3':'#6fd49d'}">
            ${{fire:'🔥불',water:'💧물',grass:'🌿풀'}[item.element]}</span>`
        : '';

      const clickFn = owned ? `equipFromShop('${item.id}')` : `buyEquip('${item.id}')`;

      return `<div class="item-card ${!check.ok&&!owned?'cant-afford':''} shop-row-card"
        onclick="${clickFn}" style="${!check.ok&&!owned?(lock.near?'opacity:.9;border-color:rgba(126,224,160,.7);box-shadow:inset 0 0 0 1px rgba(126,224,160,.25)':'opacity:.6'):''}">
        <div style="display:flex;align-items:center;gap:.6rem;width:100%">
          <div style="flex-shrink:0">${iconImg(item, 'equipment', '3rem')}</div>
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
          if (isEquip) badge = `<span style="color:var(--emerald);font-size:.62rem"> 장착 중</span>`;
          else if (inInv) badge = `<span style="color:var(--sky);font-size:.62rem"> 가진 것</span>`;
          const lock = owned ? { html: '', near: false } : shopLockInfo(CUR, item, check);   // [SHOP-LOCK-HINT-1]
          const reasonHtml = lock.html;
          const clickFn = owned ? `equipFromShop('${item.id}')` : `buyEquip('${item.id}')`;
          return `<div class="item-card ${!check.ok&&!owned?'cant-afford':''} shop-row-card"
            onclick="${clickFn}" style="${!check.ok&&!owned?(lock.near?'opacity:.9;border-color:rgba(126,224,160,.7);box-shadow:inset 0 0 0 1px rgba(126,224,160,.25)':'opacity:.6'):''}">
            <div style="display:flex;align-items:center;gap:.6rem;width:100%">
              <div style="flex-shrink:0">${iconImg(item, 'equipment', '3rem')}</div>
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
              ${iconImg(book, 'skillbooks', '1.6rem', 'cover_' + book.type, '📖')}</div>
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
              ${iconImg(book, 'skillbooks', '1.6rem', 'cover_' + book.type, '📖')}</div>
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
        <div class="ic-icon">${iconImg(s, 'seeds', '1.4rem', s.id)}${locked?'<span style="font-size:.7rem">🔒</span>':''}</div>
        <div class="ic-name">${s.name}${locked?`<span style="color:var(--txt3);font-size:.62rem"> Lv${s.reqLv}+</span>`:''}</div>
        <div class="ic-stats">${s.growHours}시간 → ${s.sellPrice}G (남는 골드 +${s.sellPrice-s.price}G)</div>
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
        <div class="ic-icon">${iconImg(s, 'seeds', '1.4rem', s.id)}${locked?'<span style="font-size:.7rem">🔒</span>':''}</div>
        <div class="ic-name" style="color:#FFA500">${s.name}
          <span style="font-size:.6rem;background:rgba(255,140,0,.2);color:#FFA500;
            border-radius:4px;padding:.05rem .3rem;margin-left:.2rem">위험</span>
          ${locked?`<span style="color:var(--txt3);font-size:.62rem"> Lv${s.reqLv}+</span>`:''}
        </div>
        <div class="ic-stats" style="color:var(--txt2)">${s.growHours}시간 · ${s.desc}</div>
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
    const decoFree = !!(GAME_DATA.decoFreeNow && GAME_DATA.decoFreeNow());   // [DECO-FREE-1]
    // [DECO-NEW-1] 새로 들어온 장식에 🆕 — 장식 표의 newUntil(YYYY-MM-DD) 까지만 붙는다.
    //  아이가 새 것을 못 찾고 지나치는 것을 막는다(장식이 84종이라 눈에 안 띈다).
    const _today = (() => { const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); })();
    items = GAME_DATA.decorations.filter(d => d.price > 0 && !d.hidden).map(d => {   // [DECO-FENCE-1] hidden 은 상점에서만 감춘다(인벤토리는 그대로)
      const lv = CUR.level || 1;
      const locked = lv < (d.reqLv||1);
      const rl = {common:'⚪',rare:'🔵',epic:'🟣',legend:'🟡'}[d.rarity||'common']||'';
      const catBadge = d.cat==='yard'
        ? `<span style="color:#7ec850;font-size:.62rem">🌿 마당</span>`
        : `<span style="color:#C8A87A;font-size:.62rem">🏠 집 안</span>`;
      const lockMsg = locked ? `toast('Lv${d.reqLv} 이상이 되어야 구매할 수 있어요!')` : `buyDeco('${d.id}')`;
      return `<div class="item-card" onclick="${lockMsg}" style="opacity:${locked?.55:1}">
        <div class="ic-icon" style="display:flex;align-items:flex-end;justify-content:center;gap:2px;min-height:44px">${_decoThumb(d, 42)}${locked?'<span style="font-size:.7rem">🔒</span>':''}</div>
        <div class="ic-name">${(d.newUntil && _today <= d.newUntil) ? '<span style="color:#7ec850;font-weight:800">🆕</span> ' : ''}${rl} ${d.name}</div>
        <div class="ic-stats">${catBadge}${locked?` <span style="color:var(--txt3);font-size:.6rem">Lv${d.reqLv}+</span>`:''}</div>
        <div class="ic-price">${decoFree ? `<span style="color:#7ec850;font-weight:800">🎁 무료</span> <span style="text-decoration:line-through;color:var(--txt3);font-size:.6rem">${d.price}G</span>` : `💰 ${d.price}G`}</div>
      </div>`;
    });
  }
  const _decoBanner = (SHOP_TAB === 'deco' && GAME_DATA.decoFreeNow && GAME_DATA.decoFreeNow())
    ? `<div style="grid-column:1/-1;background:rgba(126,200,80,.12);border:1.5px solid rgba(126,200,80,.45);
        border-radius:10px;padding:.5rem .7rem;font-size:.72rem;color:#9fe07a;font-weight:700;word-break:keep-all">
        🎁 지금은 꾸미기가 무료! ${escHtml(GAME_DATA.decoFree.label || '')} 까지 골드 없이 가질 수 있어요</div>`
    : '';
  document.getElementById('shop-items').innerHTML = _decoBanner + items.join('');
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
  DB.logSpend(CUR.id, 'skill', book.price);   // [GOLD-SPEND-2] 저장 뒤
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
  DB.saveStudent(CUR);
  DB.logSpend(CUR.id, 'equip', item.price);   // [GOLD-SPEND-2] 저장 뒤
  renderAll(); renderShop();
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
  DB.saveStudent(CUR);
  DB.logSpend(CUR.id, 'seed', seed.price);   // [GOLD-SPEND-2] 저장 뒤 · 일반·돌연변이 씨앗 모두
  renderShop(); renderHUD();
  toast(`✅ ${seed.name} 구매!`);
}

let _buyDecoArm = null;   // [DECO-PT-1] 한 번 누름 = 확인, 3초 안에 같은 카드를 한 번 더 = 산다
function buyDeco(id) {
  const deco = GAME_DATA.decorations.find(d => d.id === id);
  if (!deco) return;
  const cost = GAME_DATA.decoCost ? GAME_DATA.decoCost(deco) : deco.price;   // [DECO-FREE-1] 🎁 무료 기간이면 0
  if (cost > 0 && !(_buyDecoArm && _buyDecoArm.id === id && Date.now() - _buyDecoArm.t < 3000)) {
    _buyDecoArm = { id, t: Date.now() };
    toast(`${deco.icon} ${deco.name} 💰${cost}G — 한 번 더 누르면 사요`);
    return;
  }
  _buyDecoArm = null;
  if (CUR.gold < cost) { toast('💸 골드 부족!'); return; }
  CUR.gold -= cost;
  CUR.inventory = CUR.inventory || [];
  const ex = CUR.inventory.find(i => i.id === id);
  if (ex) ex.qty++; else CUR.inventory.push({id, qty:1});
  DB.saveStudent(CUR);
  if (cost > 0) DB.logSpend(CUR.id, 'deco', cost);   // [GOLD-SPEND-2] 저장 뒤 · 장식·가구·러그 / [DECO-FREE-1] 무료면 지출 기록 없음
  renderShop(); renderHUD();
  toast(cost === 0 ? `🎁 ${deco.name} 무료로 받았어요!` : `✅ ${deco.name} 구매!`);
}

// ── [SPLIT-1] 여기 있던 'battle' 덩어리(1710줄)는 student/battle.js 로 옮겼다 — 글자 그대로 ──
// ══ 보스 ══
//  [BOSS-WEEK-1] 이긴 보상은 학생마다 한 주에 한 번(일요일에 새 주). 전엔 '확인'을 누를 때마다 끝없이 받을 수 있었다.
//   · 주 키 = Utils.weekStartStr()(감정 보상과 같은 주 셈) · 학생 레코드 bossClaimedWeek 한 칸
//   · 보상 금액(선생님 설정 bossGold · 30EXP)은 그대로. 주지 않던 '특별 씨앗' 표시는 뺐다.
//   · 혼자 싸우는 보스라 '전체 학생이 힘을 합쳐' 문구도 고쳤다.
function bossClaimedThisWeek(s) {
  s = s || CUR;
  return !!(s && s.bossClaimedWeek === Utils.weekStartStr());
}

function openBoss() {
  const settings = DB.getSettings();
  const done = bossClaimedThisWeek();
  openModal('m-boss');
  document.getElementById('boss-arena').innerHTML = `
    <div style="text-align:center;padding:1rem">
      <div style="font-size:5rem;animation:floatY 3s ease-in-out infinite">${escHtml(settings.bossIcon||'🧌')}</div>
      <div style="font-size:1.2rem;font-weight:700;color:var(--red);margin:.5rem 0">${escHtml(settings.bossName||'금요일 보스')}</div>
      <div style="font-size:.82rem;color:var(--txt2);margin-bottom:1.2rem">${done
        ? '이번 주 보상은 벌써 받았어요 ✓<br>다음 주에 다시 만나요!'
        : '보스를 이기면 보상을 받아요! (한 주에 한 번)'}</div>
      <div style="display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap;margin-bottom:1.2rem">
        <span class="rb-tag">💰 ${Utils.intOr(settings.bossGold, 150)}G</span>
        <span class="rb-tag">+30EXP</span>
      </div>
      ${done
        ? `<button class="btn-battle" disabled style="opacity:.45;cursor:default">✓ 이번 주 보상 받음</button>`
        : `<button class="btn-battle" onclick="doBossFight()">⚔️ 공격!</button>`}
    </div>`;
}

function doBossFight() {
  if (bossClaimedThisWeek()) { toast('이번 주 보스 보상은 벌써 받았어요'); openBoss(); return; }
  const settings = DB.getSettings();
  const gold = Utils.intOr(settings.bossGold, 150);   // [ZERO-OK-1] 교사가 0 을 넣으면 0
  const win = Math.random() > 0.35;
  document.getElementById('boss-arena').innerHTML = `
    <div style="text-align:center;padding:1rem">
      <div style="font-size:4rem">${win?'🏆':'💀'}</div>
      <div class="ba-result ${win?'win':'lose'}" style="margin:1rem 0">${win?'🎉 보스 처치 성공!':'😢 패배...'}</div>
      <div style="font-size:.85rem;color:var(--txt2);margin-bottom:1rem">
        ${win?`💰 +${gold}G · +30EXP`:'다시 도전해 봐요!'}
      </div>
      <button class="btn-ok" onclick="${win?'claimBoss(this)':"closeModal('m-boss')"}">확인</button>
    </div>`;
}

function claimBoss(btn) {
  if (btn) btn.disabled = true;   // 두 번 눌러 두 번 받기 막기
  closeModal('m-boss');
  if (!CUR || bossClaimedThisWeek()) { toast('이번 주 보스 보상은 벌써 받았어요'); return; }
  const gold = Utils.intOr((DB.getSettings() || {}).bossGold, 150);   // [ZERO-OK-1]
  CUR.bossClaimedWeek = Utils.weekStartStr();
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
      return `<div class="fcell ${ready?'ready':'growing'}" onclick="openModal('m-farm');renderFarmModal()">${ready?iconImg(sd, 'crops', '.9rem', sd.crop, sd.cropIcon):'🌱'}</div>`;
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
          DB.logGold(CUR.id, 'farm', earned);   // [GOLD-LOG-1]
        }
        CUR.farm = (CUR.farm||[]).filter(f => f.slot !== slot);
        CUR.farmHarvests = (CUR.farmHarvests||0) + 1;
        DB.saveStudent(CUR);
        checkAchievements();
        if (success) toast(`🎉 ${sd.cropIcon} 돌연변이 재배 성공! +${earned}G 받았어요!`);
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
      DB.logGold(CUR.id, 'farm', earned);   // [GOLD-LOG-1]
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
    if (sd.isMutant) toast(`⚡ ${sd.name} 심었어요! 성공 확률 ${Math.round(sd.successRate*100)}% · ${sd.growHours}시간 뒤에 결과가 나와요`);
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
    : `<span style="font-size:.75rem;color:var(--txt3)">씨앗이 없어요 · 상점에서 살 수 있어요</span>`;

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
        ${withered ? '🍂' : ready ? iconImg(sd, 'crops', '1.1rem', sd.crop, sd.cropIcon) : (plot.isMutant ? '⚡' : '🌱')}
        <div class="fm-prog"><div class="fm-prog-fill" style="width:${pct}%${plot.isMutant?';background:rgba(255,165,0,.8)':''}"></div></div>
      </div>`;
    } else {
      gridHtml += `<div class="fm-cell empty" onclick="farmCellClick(${i})">+</div>`;
    }
  }
  document.getElementById('farm-grid-wrap').innerHTML =
    `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:3px">${gridHtml}</div>`;
  document.getElementById('farm-info').textContent =
    `밭 ${farmSize}칸 · 심은 작물 ${farm.length} · 거둘 수 있는 작물 ${farm.filter(p=>{const sd=Utils.getSeedByCrop(p.crop);return sd&&Utils.cropReady(p.planted,sd.growHours)}).length}`;
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
  if (tab==='weekly')  renderWeeklyTab();
  if (tab==='book')    { renderBookRecords(); initBookForm(); }
  if (tab==='stats')   renderDqPortfolio();
  if (tab==='artwork') { fillArtworkSubjectSelect(); renderArtworks(); }
  if (tab==='emotion') renderEmotionHistory();
  if (tab==='memory')  renderMyMemories();
  if (tab==='ach')     renderHouseAchievements();
  if (tab==='deco') {   // 버튼으로 직접 열기
    //  [DECO-LAZY-1] 꾸미기 탭을 보면 deco.js 를 미리 받는다(누를 즈음엔 와 있게) · 오면 그림 묶음도(openHouseTab 이 하던 미리 받기)
    if (!decoReady()) decoLoad().then(() => _artStart()).catch(() => {});
  }
}

// 포트폴리오 열고 특정 탭 바로 활성화
function openHouseTab(tab) {
  if (typeof _artStart === 'function') _artStart();   // [DECO-BUNDLE-1] 그림 묶음을 미리 받기 시작(꾸미기를 열 즈음엔 와 있다)
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
      killed: zoneMons.filter(m => dex.includes(m.id)).length,
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
    const killed = zoneCount[z.key].mons.filter(m => dex.includes(m.id));
    if (!killed.length) return '';
    return `<div style="margin-bottom:.5rem">
      <div style="font-size:.68rem;color:${z.color};font-weight:600;margin-bottom:.25rem">${z.label}</div>
      <div style="display:flex;flex-wrap:wrap;gap:.25rem">
        ${killed.map(m => `<span class="dex-chip">${escHtml(m.icon)} ${escHtml(m.name)}</span>`).join('')}
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

// ── [SPLIT-1] 여기 있던 'deco' 덩어리(7830줄)는 student/deco.js 로 옮겼다 — 글자 그대로 ──

// ══ 꾸미기 늦게 불러오기 (DECO-LAZY-1) ══════════════════════
//  student/deco.js(꾸미기 마당·집 안 + 친구 마당 구경 · 약 530KB = 학생 JS 의 절반)는 첫 화면에서 받지 않는다.
//  꾸미기·친구 마당을 열 때 한 번만 부른다(집 허브 꾸미기 탭을 열면 미리) — decoLoad().
//  · 바깥(student.js·student/*.js·html)이 deco.js 이름을 부르는 자리는 셋 중 하나여야 한다:
//    ① 아래 자리 지킴이  ② typeof 가드  ③ 불러온 뒤에만 열리는 자리(꾸미기·친구 전체화면 안 단추 · _ifMode 가 켜졌을 때).
//    scripts/unit/deco-lazy-check.mjs 가 전부 센다(precheck) — 새로 부르는 자리가 생기면 거기서 FAIL.
//  · 자리 지킴이는 꼭 `window.이름 = function` 꼴. 같은 이름을 function 선언으로 두면 시험(run.mjs sliceFn)이 진짜 대신 지킴이를
//    잘라 가고 global-dup 이 덮어쓰기로 본다. deco.js 가 불리면 그쪽 function 선언이 같은 전역 이름을 진짜로 바꿔 끼운다.
//  · deco.js 를 고치면 아래 DECO_SRC 의 ?v= 를 올린다(그러면 student.js 도 바뀌니 student.html 의 student.js ?v= 도) — buster-check 가 본다.
const DECO_SRC = './student/deco.js?v=20261004r6b';
let DECO_SCENE = 'yard'; // 'yard' | 'indoor'  — [DECO-LAZY-1] deco.js 에서 옮김: 집 허브 '집 안 꾸미기' 단추가 불러오기 전에 값을 넣는다
let _ifMode = false; // 전체화면 인테리어 모드 여부 — [DECO-LAZY-1] deco.js 에서 옮김: 농장·토스트가 불러오기 전에도 읽는다
function decoReady() { return typeof _decoReadyMark !== 'undefined'; }   // deco.js 가 맨 끝 줄까지 돌았나
function decoLoad() {
  if (decoReady()) return Promise.resolve();
  return loadScriptOnce(DECO_SRC).then(() => { if (!decoReady()) throw new Error('deco.js 가 끝까지 안 돎'); });
}
//  열기 지킴이 — 0.3초 넘게 걸리면 '…펴는 중…' 한 줄 · 다 오면 진짜 함수로 이어 부름 · 못 받으면 토스트(다시 누르면 다시 받는다).
//  받는 동안 또 누르면 한 번만 연다(마지막에 누른 것으로).
const _decoStubs = {}, _decoWaiting = {};
function _decoLazyOpen(name, args, waitMsg, failMsg) {
  const first = !(name in _decoWaiting);
  _decoWaiting[name] = args;
  if (!first) return;
  let tip = null;
  const timer = setTimeout(() => {
    tip = document.createElement('div');
    tip.className = 'toast-msg';
    tip.textContent = waitMsg;
    tip.style.animation = 'toastIn .3s ease';   // 보통 토스트는 2초 뒤 사라진다 — 다 받을 때까지 그대로
    tip.style.bottom = window.innerWidth <= 700 ? '75px' : '20px';
    document.body.appendChild(tip);
  }, 300);
  const end = () => { clearTimeout(timer); if (tip) tip.remove(); const a = _decoWaiting[name]; delete _decoWaiting[name]; return a; };
  decoLoad().then(() => {
    const a = end(), real = window[name];
    if (typeof real === 'function' && real !== _decoStubs[name]) real.apply(null, a);
  }, () => { end(); toast(failMsg); });
}
_decoStubs.openInteriorFullscreen = window.openInteriorFullscreen = function () {
  _decoLazyOpen('openInteriorFullscreen', [...arguments], '꾸미기를 펴는 중…', '꾸미기를 불러오지 못했어요. 인터넷을 확인하고 다시 눌러 주세요.');
};
_decoStubs.visitFriend = window.visitFriend = function () {
  _decoLazyOpen('visitFriend', [...arguments], '친구 마당을 펴는 중…', '친구 마당을 불러오지 못했어요. 인터넷을 확인하고 다시 눌러 주세요.');
};
//  상점 꾸미기 탭 썸네일 — 불러오기 전엔 이모지(진짜 _decoThumb 가 그림 묶음을 받는 동안 쓰는 것과 같은 모양) · 받으면 상점을 한 번 다시 그린다
let _decoThumbWait = false;
_decoStubs._decoThumb = window._decoThumb = function (d, px) {
  if (!_decoThumbWait) {
    _decoThumbWait = true;
    decoLoad().then(() => {
      _decoThumbWait = false;
      if (CUR && SHOP_TAB === 'deco' && document.getElementById('m-shop')?.classList.contains('open')) renderShop();
    }, () => { _decoThumbWait = false; });
  }
  return `<span style="font-size:${Math.round(px * 0.8)}px;display:block;text-align:center">${escHtml(d.icon || '🌸')}</span>`;
};
// ── [SPLIT-1] 여기 있던 'art' 덩어리(546줄)는 student/art.js 로 옮겼다 — 글자 그대로 ──
// ── [SPLIT-1] 여기 있던 'emotion' 덩어리(522줄)는 student/emotion.js 로 옮겼다 — 글자 그대로 ──
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
    html += `<div style="font-size:.7rem;color:var(--txt3);margin-bottom:.7rem">2~3번 칸을 눌러 불·물·풀 스킬을 끼워요. 끼운 스킬만 전투 버튼으로 나와요.</div>`;
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
    html += `<div style="font-size:.7rem;color:var(--txt3);margin-bottom:.6rem">마스터리북을 사면 레벨이 올라요. 상점의 마스터리북 탭에서 살 수 있어요.</div>`;
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
            ${isEquipped ? '<span style="font-size:.62rem;background:'+color+';color:#111;border-radius:4px;padding:.05rem .3rem;margin-left:.3rem">장착 중</span>' : ''}
          </span>
          <span style="font-size:.72rem;font-weight:700;color:${lv>0?color:'var(--txt3)'}">
            ${lv === 0 ? '미습득' : `Lv.${lv} / ${maxLv}`}
          </span>
        </div>
        <div style="background:rgba(255,255,255,.08);border-radius:5px;height:6px;overflow:hidden;margin-bottom:.3rem">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:5px;transition:width .4s ease"></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:.68rem;color:var(--txt3)">세기 <strong style="color:${color}">${multTxt}</strong></span>
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
      { id:'counter',  label:'⚔️ 최후의 반격',desc:'HP 40% 아래면 반사', color:'#c39bd3' },
      { id:'rush',     label:'🔥 몰아치기',   desc:'2턴 공격력↑', color:'#f39c12' },
    ];

    html += `<div style="font-size:.8rem;font-weight:700;color:var(--txt1);margin:.8rem 0 .4rem">🎮 전투 스킬 장착 (3칸)</div>`;
    html += `<div style="font-size:.7rem;color:var(--txt3);margin-bottom:.7rem">칸을 눌러 전투 스킬을 골라요. 스킬은 전투 한 번에 한 번씩 쓸 수 있어요.</div>`;
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
    html += `<div style="font-size:.72rem;color:var(--txt3);margin-bottom:.5rem">현재 장착 장비</div>`;
    html += `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.35rem;margin-bottom:1rem">`;
    html += slots.map(sl => {
      const eqId   = CUR.equipmentIds?.[sl.k];
      const eqItem = eqId ? GAME_DATA.getItemById(eqId) : null;
      return `<div style="background:rgba(255,215,0,.07);border:1px solid rgba(255,215,0,.2);
        border-radius:10px;padding:.5rem .3rem;text-align:center">
        <div style="display:flex;justify-content:center;align-items:center;height:40px">
          ${eqItem ? iconImg(eqItem, 'equipment', '2.2rem') : `<span style="font-size:1.4rem">${sl.icon}</span>`}   <!-- [EQUIP-ICON-1] -->
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
            ${iconImg(item, 'equipment', '3rem')}
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
          <div class="inv-icon">${iconImg(s, 'seeds', '1.5rem', s.id)}</div>
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
          <div class="inv-qty">${i.qty}개 <span style="color:var(--txt3)">· 놓은 것 ${used}</span></div>
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
  if (oldId === itemId) { toast('이미 끼고 있어요!'); return; }
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
    return `<div data-qid="${escHtml(String(q.id))}" style="background:rgba(255,255,255,.04);border:1px solid ${done?'rgba(46,204,113,.3)':pending?'rgba(255,215,0,.25)':'rgba(255,255,255,.08)'};
      border-radius:12px;padding:.9rem 1rem;margin-bottom:.6rem;${done?'opacity:.6':''}">
      <div style="display:flex;align-items:flex-start;gap:.7rem">
        <div style="font-size:1.6rem;flex-shrink:0">${escHtml(q.icon||'📋')}</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:.88rem;margin-bottom:.2rem">${escHtml(q.name)}</div>
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
//  [UX-TRIM-G4b] focusId — 홈 '선생님 퀘스트' 줄에서 누른 퀘스트를 창 가운데로 · 테두리(신청은 창의 '신청' 단추로만)
function openQuestModal(focusId) {
  openModal('m-quest');
  const firstTab = document.querySelector('#m-quest .mtab');
  questTab('board', firstTab);
  if (typeof focusId !== 'string' || !focusId) return;
  const card = [...document.querySelectorAll('#quest-board-list [data-qid]')].find(el => el.dataset.qid === focusId);
  if (!card) return;
  card.classList.add('q-focus');
  try { card.scrollIntoView({ block: 'center' }); } catch (e) {}
}
// ── [SPLIT-1] 여기 있던 'reading' 덩어리(292줄)는 student/reading.js 로 옮겼다 — 글자 그대로 ──
// ── [SPLIT-1] 여기 있던 'friend' 덩어리(354줄)는 student/deco.js 로 옮겼다 — 글자 그대로 ──
// ══ 레이아웃 모드 토글 ══
const STORAGE_KEYS = Object.freeze({
  LAYOUT_MODE: 'layoutMode',
  SCALE_MODE:  'scaleMode',
});
let LAYOUT_MODE = localStorage.getItem(STORAGE_KEYS.LAYOUT_MODE) || 'desktop';
let SCALE_MODE  = localStorage.getItem(STORAGE_KEYS.SCALE_MODE) === 'true'; // 비율 스케일링 on/off
// [UX-TRIM-G4] HUD 의 '넓게 보기'·'화면 맞춤' 단추를 뺐다(이름과 반대로 폰 배치가 되고 기기에 저장됐다 · 1366 에선 맞춤이 안 걸렸다).
//   단추가 없으니 예전에 눌러 저장된 값은 되돌릴 길이 없다 → 넓은 화면(701px↑)에선 폰 배치를 기본으로 되돌리고, 맞춤도 끈다.
//   폰(700px↓)은 폭 미디어쿼리가 폰 배치를 고르므로 저장값을 건드리지 않는다. 함수(toggleLayout · toggleScaleMode)는 남긴다.
try {
  if (LAYOUT_MODE === 'mobile' && window.innerWidth >= 701) { LAYOUT_MODE = 'desktop'; localStorage.setItem(STORAGE_KEYS.LAYOUT_MODE, 'desktop'); }
  if (SCALE_MODE) { SCALE_MODE = false; localStorage.removeItem(STORAGE_KEYS.SCALE_MODE); }
} catch (e) {}
const SCALE_BASE_WIDTH = 2560; // QHD 모니터 기준

// [HUDBTN-1] 좁은 화면에서는 화면 맞춤을 무시한다.
//   2560px 기준으로 깔고 줄이는 기능이라 375px에서는 배율이 0.146이 되어 글자를 못 읽는다.
//   폰에서는 이 버튼을 숨기므로(student.css), 예전에 켜 둔 기기가 되돌릴 수단 없이 갇히지 않도록
//   여기서 스케일을 걷어내고 나간다 → 다음 접속에 저절로 정상으로 돌아온다.
//   설정값(SCALE_MODE) 자체는 지우지 않는다. 큰 화면으로 가면 다시 살아난다.
const SCALE_MIN_WIDTH = 701;   // student.css의 배치 분기점(700/701)과 같은 값

// [SCALEMIN-1] 너무 작게 줄여야 하면 아예 적용하지 않는다.
//   기준 폭이 2560px이라 화면이 좁을수록 배율이 뚝 떨어진다 — 701px에서 0.274,
//   768px에서 0.300이다. 폰만큼은 아니어도 작은 태블릿에서 켜면 역시 글자를 못 읽는다.
//   하한을 0.6으로 두면 2560 × 0.6 = 1536px 이상에서만 실제로 걸린다.
//   두 값은 상수로 둔다(나중에 조정 가능하게).
const SCALE_MIN_RATIO = 0.6;
const SCALE_MIN_RATIO_WIDTH = Math.ceil(SCALE_BASE_WIDTH * SCALE_MIN_RATIO);   // 1536px
let _scaleBlockedNoticed = false;   // 알림은 한 번만 (applyScale은 resize마다 불린다)

function applyScale() {
  const game = document.getElementById('s-game');
  if (!game) return;
  const clear = () => {
    game.style.transform = '';
    game.style.width  = '';
    game.style.height = '';
  };
  if (window.innerWidth < SCALE_MIN_WIDTH) { clear(); return; }
  if (SCALE_MODE && LAYOUT_MODE === 'desktop') {
    const ratio = Math.min(window.innerWidth / SCALE_BASE_WIDTH, 1); // 1440px 이상은 스케일 안함
    // [SCALEMIN-1] 하한에 걸리면 걷어내고 한 번 알린다.
    //   아무 일도 안 일어나면 아이는 버튼이 고장 났다고 느낀다.
    if (ratio < SCALE_MIN_RATIO) {
      clear();
      if (!_scaleBlockedNoticed) {
        _scaleBlockedNoticed = true;
        if (typeof toast === 'function') toast('이 화면에서는 화면 맞춤이 적용되지 않아요');
      }
      return;
    }
    const h = window.innerHeight / ratio;
    game.style.transformOrigin = 'top left';
    game.style.transform = `scale(${ratio})`;
    game.style.width  = SCALE_BASE_WIDTH + 'px';
    game.style.height = h + 'px';
  } else {
    clear();
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
    if (btn) btn.textContent = hudBtnText('📱', '좁게 보기');
    const mainTab = document.getElementById('mob-main-tab');
    if (mainTab) {
      document.querySelectorAll('.main-tab-content, .mobile-char-panel').forEach(el => el.classList.remove('active-tab'));
      mainTab.classList.add('active-tab');
      document.querySelectorAll('.btab').forEach(b => b.classList.remove('active'));
      const homeBtn = document.getElementById('bt-home');
      if (homeBtn) homeBtn.classList.add('active');
    }
  } else {
    if (btn) btn.textContent = hudBtnText('🖥️', '넓게 보기');
  }
  applyScale();
}

// [UI375-1] 375px 상단 줄이 오른쪽으로 잘린다(🖥️ 넓게 보기가 잘리고 🔍 화면 맞춤은 안 보임).
//   숨기면 폰에서 넓게 보기로 돌아갈 길이 없어지므로 글자만 빼고 아이콘은 남긴다.
//   폭이 바뀌면(가로/세로 돌리기) 다시 맞춘다.
const HUD_NARROW_PX = 430;
function hudBtnText(icon, label) {   // [DESLOP-3] 이모지 없이 글자만 — 좁은 화면은 '보기'를 뺀 짧은 말
  return window.innerWidth <= HUD_NARROW_PX ? label.replace(' 보기', '') : label;
}
function syncHudButtons() {
  const lb = document.getElementById('layout-toggle-btn');
  if (lb) lb.textContent = LAYOUT_MODE === 'mobile'
    ? hudBtnText('📱', '좁게 보기') : hudBtnText('🖥️', '넓게 보기');
  const sb = document.getElementById('scale-mode-btn');
  if (sb) sb.textContent = SCALE_MODE
    ? hudBtnText('🔍', '화면 맞춤 ON') : hudBtnText('🔍', '화면 맞춤');
}
window.addEventListener('resize', syncHudButtons);

function toggleLayout() {
  applyLayout(LAYOUT_MODE === 'desktop' ? 'mobile' : 'desktop');
}

function toggleScaleMode() {
  SCALE_MODE = !SCALE_MODE;
  _scaleBlockedNoticed = false;   // [SCALEMIN-1] 누를 때마다 결과를 알려 준다
  localStorage.setItem(STORAGE_KEYS.SCALE_MODE, SCALE_MODE);
  const btn = document.getElementById('scale-mode-btn');
  if (btn) btn.textContent = SCALE_MODE ? hudBtnText('🔍', '화면 맞춤 ON') : hudBtnText('🔍', '화면 맞춤');
  applyScale();
}

// 창 크기 바뀔 때 자동 재계산
window.addEventListener('resize', applyScale);


function triggerLevelUp(newLv) {
  if (typeof classLiveDefer === 'function' && classLiveDefer(newLv)) return;   // [CLASS-LIVE-1] 수업 덮개 동안 미룸 — 끝나면 한 번
  // [UX-TRIM-G4b] 학습 앱 창(z 9000)이 열려 있으면 축하(999)가 그 밑에 가려진다 → 창을 닫은 뒤 한 번(그동안 오른 가장 높은 레벨)
  if (_embedState) { _lupAfterEmbed = Math.max(_lupAfterEmbed || 0, newLv); return; }
  if (_fxBusy()) { _fxWhenFree(() => triggerLevelUp(newLv)); return; }   // [BATTLE-V2] 배틀·업적 카드가 끝난 뒤
  const fx = document.getElementById('lup-fx');
  document.getElementById('lup-sub').textContent = `Lv.${newLv}이 됐어요!`;
  const isPromo = Utils.isPromotionLevel(newLv);
  document.getElementById('lup-promo').textContent = isPromo ? '🎊 승급할 수 있어요! 화면 위 ⬆ 승급 가능을 눌러 보세요!' : '';
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
      <div class="rk-item">
        <span class="rk-medal">${medals[i]}</span>
        <span class="rk-ava">${escHtml(s.avatar||'')}</span>
        <div class="rk-body">
          <div class="rk-name">${escHtml(s.name)}</div>
          <div class="rk-val">${cat.fmt(s,cat.key(s))}</div>
        </div>
      </div>`).join('');
    return `<div class="rk-group">
      <div class="rk-label">${cat.label}</div>
      <div class="rk-grid">${items}</div>
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

// 포트폴리오 내 업적 탭 전용 렌더 (house-ach-list에 출력)
// ── [SPLIT-1] 여기 있던 'weekly' 덩어리(386줄)는 student/weekly.js 로 옮겼다 — 글자 그대로 ──
// ── [SPLIT-1] 여기 있던 'vocab' 덩어리(128줄)는 student/study.js 로 옮겼다 — 글자 그대로 ──
function renderHouseAchievements() {
  const earned = new Set(CUR.achievements || []);
  const doneList   = ACHIEVEMENTS.filter(a =>  earned.has(a.id));
  const lockedList = ACHIEVEMENTS.filter(a => !earned.has(a.id));
  const el = document.getElementById('house-ach-list');
  if (!el) return;

  const rewardText = a => {
    const parts = [];
    if (a.reward.exp)   parts.push(`+${a.reward.exp}EXP`);
    parts.push(`+${achRewardGold(a)}G`);   // [ACH-GOLD-1] 실제 지급과 같은 값
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
      <div style="font-size:.72rem;color:var(--txt3)">경험치·골드·칭호를 받았어요!</div>
    </div>
    <div style="height:6px;background:rgba(255,255,255,.07);border-radius:3px;margin-bottom:1rem;overflow:hidden">
      <div style="height:100%;width:${Math.round(doneList.length/ACHIEVEMENTS.length*100)}%;background:linear-gradient(90deg,var(--gold),var(--gold2));border-radius:3px;transition:width .6s ease"></div>
    </div>
    ${doneList.length > 0 ? `<div style="font-size:.72rem;color:var(--txt3);margin-bottom:.5rem">✅ 달성 (${doneList.length})</div>${render(doneList, false)}` : ''}
    <div style="font-size:.72rem;color:var(--txt3);margin:.7rem 0 .4rem">🔒 미달성 (${lockedList.length})</div>
    ${render(lockedList, true)}`;
}

// [BATTLE-V2] 연출 줄 세우기 — 배틀 창 · 업적 카드 · 레벨업이 서로 위에 덮지 않게 하나씩
function _fxBusy() {
  const bat = document.getElementById('m-battle'), ach = document.getElementById('ach-popup'), lup = document.getElementById('lup-fx');
  return !!((bat && bat.classList.contains('open')) || (ach && ach.style.display === 'block') || (lup && lup.classList.contains('show'))
    || (typeof classLiveIsOpen === 'function' && classLiveIsOpen()));   // [CLASS-LIVE-1] 수업 덮개 동안 업적 카드도 기다림
}
function _fxWhenFree(fn, tries) { tries = tries || 0; if (!_fxBusy() || tries > 450) return fn(); setTimeout(() => _fxWhenFree(fn, tries + 1), 400); }

function checkAchievements(opts) {
  const oldLv = CUR.level || 1;   // [LVUP-FX-1] 업적 EXP 로 오른 레벨도 축하 — checkNew 가 그 자리에서 level 을 바꾼다
  const newOnes = AchievementUtils.checkNew(CUR);
  if (newOnes.length === 0) return [];
  const newLv = CUR.level || 1;
  DB.saveStudent(CUR);
  if (opts && opts.inline) {   // 배틀 결과 카드가 직접 보여 준다 — 알림 빨간 점만
    document.querySelectorAll('[id="ach-tile-notif"]').forEach(n => { n.style.display = ''; });
    if (newLv > oldLv) triggerLevelUp(newLv);   // [LVUP-FX-1] 배틀 창이 닫힌 뒤(_fxWhenFree)
    return newOnes;
  }
  // 업적 달성 팝업 (순서대로)
  let idx = 0;
  const showNext = () => {
    if (idx >= newOnes.length) { renderAll(); if (newLv > oldLv) triggerLevelUp(newLv); return; }   // [LVUP-FX-1] 팝업이 다 끝난 뒤
    const a = newOnes[idx++];
    const rewardParts = [];
    if (a.reward.exp)   rewardParts.push(`+${a.reward.exp} EXP`);
    rewardParts.push(`+${achRewardGold(a)} 골드`);   // [ACH-GOLD-1]
    if (a.reward.title) rewardParts.push(`칭호 "${a.reward.title}" 획득!`);
    document.getElementById('ach-popup-icon').textContent   = a.icon;
    document.getElementById('ach-popup-name').textContent   = a.name;
    document.getElementById('ach-popup-desc').textContent   = a.desc;
    document.getElementById('ach-popup-reward').textContent = '🎁 ' + rewardParts.join('  ');
    document.getElementById('ach-popup').style.display      = 'block';
    document.getElementById('ach-popup-bg').style.display   = 'block';
    // 알림 타일 빨간점
    document.querySelectorAll('[id="ach-tile-notif"]').forEach(n => { n.style.display = ''; });   // [HOME-TOGGLE-MOBILE-1] 두 판 모두
    // 3초 후 자동 닫기 (다음 업적)
    setTimeout(() => { closeAchPopup(); setTimeout(showNext, 300); }, 3000);
  };
  _fxWhenFree(showNext);
  return newOnes;
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
  if (confirm(`선생님께 비밀번호를 새로 받을까요?\n(선생님이 확인 후 새 비밀번호를 알려드려요)`)) {
    DB.addPwResetRequest({ id: Utils.uid(), studentId: s.id, name: s.name, date: Utils.todayStr() });
    alert('요청이 전달됐어요! 선생님께 말씀드리세요 🙋');
  }
}

// ══ 일일 퀘스트 자동 마감 (게임 진입 시 실행) ══
function autoCloseDailyQuests() {
  // [Q1] boardQuests 통짜 set 금지 — 학생 기기의 낡은 목록으로 전체를 덮어쓰면
  //   그 사이 교사가 추가한 퀘스트가 사라진다. 배열 인덱스도 기기마다 다르므로
  //   서버의 현재 목록 위에 적용하는 transaction으로 처리한다.
  const today = Utils.todayStr();
  const closeStale = (list) => {
    let changed = false;
    const next = (list || []).map(q => {
      if (q && q.active && q.type === 'daily' && q.date && q.date !== today) {
        changed = true;
        return { ...q, active: false };
      }
      return q;
    });
    return changed ? next : null;
  };
  const db = DB.load();
  const local = closeStale(db.boardQuests);
  if (!local) return;
  db.boardQuests = local; // 화면 즉시 반영용 로컬 캐시
  DB._fbRef.child('boardQuests').transaction(cur => closeStale(cur) || undefined);
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
function closeModal(id) { document.getElementById(id).classList.remove('open'); _afterModalClose(id); }
// [MODAL-CLOSE-1] 창이 닫힌 뒤 뒷정리 — ✕ 단추와 바깥 누르기 둘 다 여기를 지난다
//   · 감정: 지난 날 수정 날짜를 비운다(다음 '오늘 감정'이 지난 날로 저장되던 것 [EMO-DATE-1])
//   · 폰 하단 탭의 농장·상점·가방: 창을 닫으면 홈으로 돌아간다(빈 화면이 남던 것 [MOB-TAB-HOME-1])
const _MOB_TAB_MODAL = { farm: 'm-farm', shop: 'm-shop', inv: 'm-inv' };
function _afterModalClose(id) {
  if (id === 'm-emotion') _emoEditDate = null;
  if (_MOB_TAB_MODAL[MOB_TAB] === id) {
    const bt = document.getElementById('bt-home');
    if (bt) switchMobTab('home', bt);
  }
}
//   [BATTLE-V2] 배틀은 '나가기'로만 · [STUDY-CLOSE-1] 오늘의 학습은 바깥을 눌러도 안 닫힌다(✕ 로만 — 푼 문제가 한 번에 사라지던 것)
const _NO_BACKDROP_CLOSE = ['m-battle', 'm-study'];
document.querySelectorAll('.overlay').forEach(o => {
  o.addEventListener('click', e => {
    if (e.target !== o || _NO_BACKDROP_CLOSE.includes(o.id)) return;
    o.classList.remove('open');
    _afterModalClose(o.id);
  });
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
  //  [DECO-TOAST-1] 꾸미기 전체화면: 알림은 한 번에 하나(앞 것을 바로 치운다 — '골랐어요'와 '놓았어요'가 한 자리에 겹쳐 뭉개졌다)
  //  · 자리는 서랍 바로 위(전엔 서랍 카드 둘째 줄을 2.4초 가렸다) · 산 뒤 손끝 안내가 떠 있으면 그 위
  if (typeof _ifMode !== 'undefined' && _ifMode) {
    document.querySelectorAll('.toast-msg').forEach(e => e.remove());
    const fs = document.getElementById('interior-fullscreen'), tip = document.getElementById('deco-hand-tip');
    const dh = fs ? parseFloat(getComputedStyle(fs).getPropertyValue('--deco-drawer-h')) || 0 : 0;
    t.style.bottom = Math.round(dh + 10 + (tip && tip.offsetParent ? tip.offsetHeight + 8 : 0)) + 'px';
  }
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

// [ER-2] DB 저장 실패 시 학생에게 안내 (gamedata의 _onSaveError 훅 — #110을 학생 화면까지 완성)
window.onDbSaveError = () => toast('⚠️ 저장에 실패했어요. 인터넷을 확인하고 다시 해주세요.');

// ── [SPLIT-1] 여기 있던 'study' 덩어리(10줄)는 student/study.js 로 옮겼다 — 글자 그대로 ──
// ── [SPLIT-1] 여기 있던 'artfree' 덩어리(237줄)는 student/art.js 로 옮겼다 — 글자 그대로 ──
// ── [SPLIT-1] 여기 있던 'mastery' 덩어리(1123줄)는 student/study.js 로 옮겼다 — 글자 그대로 ──
