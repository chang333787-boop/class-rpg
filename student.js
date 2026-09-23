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
  if (doLogin._pending) return;              // [STUDENT-COLD-1] 내 기록 받는 중 엔터 두 번 → enterGame 두 번 막기

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
    if (checkAccessTime()) {
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
//  · 영어 학습은 별도 앱(https://jeongrim-english.web.app)에서 하고, RPG는 그 기록을
//    **읽어서** 보상만 준다. 영어앱이 RPG DB에 쓰는 일은 없다(규칙·저장 경로 불변).
//  · 영어앱 기록은 다른 Firebase 프로젝트(jeongrim-equip)의 Firestore에 있으므로
//    compat SDK로 두 번째 앱('english')을 띄워 읽는다. 기본 앱/RTDB와 완전히 분리.
//  · 보상은 CUR.pendingRewards에 **approved:false**로 push → 교사가 admin 승인 대기열에서
//    승인(approveReward)하면 지급. (approved:true로 넣으면 수령 경로가 없어 영원히 안 들어온다)
//    이미 만든 보상은 CUR.englishRewards[key]=true 로 막는다(학생 레코드 필드 1개 추가).
//  · 실패(오프라인·이름 불일치·SDK 미로드)는 조용히 건너뛰고 게임 진입을 막지 않는다.
// ══════════════════════════════════════════════════
const ENGLISH_APP = {
  url: 'https://jeongrim-english.web.app/',
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
let _embedState = null;   // { key, href, loaded, timer }
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
    if (_embedState && _embedState.autoFocus) { try { el.querySelector('#embed-frame').contentWindow.focus(); } catch (e) {} }
  });
  return el;
}
function openExternalEmbed(key) {
  const x = externalStudyItems().find(i => i.key === key && i.embed);
  if (!x) return;
  const item = { title: x.icon + ' ' + x.title, href: x.href };
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
}
window.addEventListener('popstate', () => {
  // 모달이 열려 있는데 embed 상태가 사라졌다면(뒤로가기) 닫는다
  if (!(history.state && history.state.embed)) closeExternalEmbed(true);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeExternalEmbed(); });

let _englishFs = null;       // 두 번째 앱의 Firestore 핸들
let _englishLastSync = 0;
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

  loadCharDolls();   // [CHAR-DOLL-1] 캐릭터 SVG 84장 미리 받기(실패해도 게임 진행에 영향 없음)

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
  applyLayout(LAYOUT_MODE);
  // 화면 맞춤 버튼 초기 상태 복원
  const sBtn = document.getElementById('scale-mode-btn');
  if (sBtn) sBtn.textContent = SCALE_MODE ? hudBtnText('🔍', '화면 맞춤 ON') : hudBtnText('🔍', '화면 맞춤');
  applyScale();
  renderAll();
  startAccessTimer();
  // [ENGLISH-LINK-1] 영어 복습앱 기록 → 보상 (실패해도 진입에 영향 없음)
  setTimeout(() => { try { syncEnglishRewards(true); } catch (e) { console.warn('영어앱 연동:', e); } }, 800);
  // [DAILY-STUDY-1] 로그인 직후 자동 팝업 3종(주간다짐 1.5초·단어퀴즈 20초·회고 30초) 폐기.
  //   기습적으로 학습을 끊고 튀어나와 실제 도움이 안 된다는 운영 판단.
  //   할 일은 홈 카드에서 학생이 눌러서 시작한다(오늘의 학습 카드 / 할 일 목록).
  //   각 기능 자체는 살아 있고 진입점만 바뀜: checkWeeklyRoutine·startPopupQuiz·
  //   tryShowReflectionPopup 함수는 보존(수동 호출·교사 안내용).
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
    // [CHAR-PAL-1] 물(e_b11~20)·풀(e_b21~30) 몸통 30종이 팔레트에 없어
    //   BODY_PAL.none(기본 파란 옷)으로 그려지고 있었다. 등급이 오를수록 진해진다.
    e_b11:  {a:'#B3E5FC',b:'#4FC3F7',c:'#E1F5FE',belt:'#0277BD'},
    e_b12:  {a:'#81D4FA',b:'#29B6F6',c:'#E1F5FE',belt:'#01579B'},
    e_b13:  {a:'#4FC3F7',b:'#039BE5',c:'#B3E5FC',belt:'#01579B'},
    e_b14:  {a:'#29B6F6',b:'#0288D1',c:'#81D4FA',belt:'#014A7F'},
    e_b15:  {a:'#039BE5',b:'#0277BD',c:'#4FC3F7',belt:'#013A63'},
    e_b16:  {a:'#0288D1',b:'#01579B',c:'#29B6F6',belt:'#FFD54F'},
    e_b17:  {a:'#0277BD',b:'#014A7F',c:'#039BE5',belt:'#FFD54F'},
    e_b18:  {a:'#01579B',b:'#013A63',c:'#0288D1',belt:'#FFC107'},
    e_b19:  {a:'#014A7F',b:'#002F4B',c:'#0277BD',belt:'#FFD700'},
    e_b20:  {a:'#003D66',b:'#00243D',c:'#0288D1',belt:'#FFD700'},
    e_b21:  {a:'#C8E6C9',b:'#81C784',c:'#E8F5E9',belt:'#33691E'},
    e_b22:  {a:'#A5D6A7',b:'#66BB6A',c:'#E8F5E9',belt:'#2E7D32'},
    e_b23:  {a:'#81C784',b:'#4CAF50',c:'#C8E6C9',belt:'#2E7D32'},
    e_b24:  {a:'#66BB6A',b:'#43A047',c:'#A5D6A7',belt:'#1B5E20'},
    e_b25:  {a:'#4CAF50',b:'#388E3C',c:'#81C784',belt:'#1B5E20'},
    e_b26:  {a:'#43A047',b:'#2E7D32',c:'#66BB6A',belt:'#FFD54F'},
    e_b27:  {a:'#388E3C',b:'#1B5E20',c:'#4CAF50',belt:'#FFD54F'},
    e_b28:  {a:'#2E7D32',b:'#155A1A',c:'#43A047',belt:'#FFC107'},
    e_b29:  {a:'#1B5E20',b:'#0D3D12',c:'#388E3C',belt:'#FFD700'},
    e_b30:  {a:'#14501A',b:'#08300D',c:'#2E7D32',belt:'#FFD700'},
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
    // [CHAR-PAL-1] 스태프 10종이 팔레트에 없어 무기가 아예 안 그려지고 있었다.
    e_ws1:{a:'#C5A880',b:'#8D6E63',type:'staff'},
    e_ws2:{a:'#B0BEC5',b:'#607D8B',type:'staff'},
    e_ws3:{a:'#CE93D8',b:'#8E24AA',type:'staff'},
    e_ws4:{a:'#90CAF9',b:'#1E88E5',type:'staff'},
    e_ws5:{a:'#A5D6A7',b:'#43A047',type:'staff'},
    e_ws6:{a:'#FFCC80',b:'#FB8C00',type:'staff'},
    e_ws7:{a:'#F48FB1',b:'#D81B60',type:'staff'},
    e_ws8:{a:'#B39DDB',b:'#5E35B1',type:'staff'},
    e_ws9:{a:'#80DEEA',b:'#00ACC1',type:'staff'},
    e_ws10:{a:'#FFE082',b:'#FFA000',type:'staff'},
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

// ══ 캐릭터 종이인형 (CHAR-DOLL-1) ══════════════════════════════
//  assets/char/ 의 SVG 84장을 겹쳐 캐릭터를 그린다.
//  합성 규칙 원본: 클로드코드\성장rpg_svg\char\README.md "합성 (코드)" 절.
//  · buildCharSVG(기존 코드 그림)는 한 줄도 건드리지 않는다. 에셋이 안 오면 그대로 폴백.
//  · 파일은 로그인 직후 한 번에 받아 문자열로 캐시한다(84장 약 183KB).
//  · CHAR_DOLL 을 false 로 두면 즉시 예전 그림으로 돌아간다.
const CHAR_DOLL = true;

const _CHAR_SVG = {};        // 'base_1' | 'body_e_b3' ... → 바깥 <svg> 벗긴 내용
let _charDollReady = false;
let _charDollLoading = false;
let _charDollFailed = false;   // [CHAR-FIRST-1] 84장을 못 받았을 때만 true → 그때만 옛 그림(buildCharSVG)
const _CHAR_DOLL_WAIT_MS = 15000;   // 이보다 오래 안 오면 일단 옛 그림, 뒤늦게 오면 다시 종이인형

// 바깥 <svg …> … </svg> 벗기기
function _charInner(txt) {
  return String(txt).replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
}
// class 로만 구분된 그룹 하나를 집어오기 / 떼어내기 (그룹 안에 중첩 <g> 없음이 보장됨)
function _charGroupRe(cls) {
  return new RegExp('<g class="' + cls + '"[^>]*>[\\s\\S]*?<\\/g>');
}
function _grabGroup(svg, cls) { const m = svg.match(_charGroupRe(cls)); return m ? m[0] : ''; }
function _dropGroup(svg, cls) { return svg.replace(_charGroupRe(cls), ''); }

// 받아올 84장의 이름
function _charFileNames() {
  const out = [];
  for (let i = 1; i <= 4;  i++) out.push('base_' + i);
  for (let i = 1; i <= 30; i++) out.push('body_e_b' + i);
  for (let i = 1; i <= 10; i++) out.push('head_e_h' + i, 'glove_e_g' + i, 'shoe_e_s' + i,
                                         'weapon_e_w' + i, 'weapon_e_ws' + i);
  return out;
}

// 로그인 직후 1회. 실패한 파일은 그 슬롯만 빠지고 나머지는 그대로 그린다.
function loadCharDolls() {
  if (!CHAR_DOLL || _charDollLoading || _charDollReady) return;
  _charDollLoading = true;
  const names = _charFileNames();
  Promise.all(names.map(n =>
    fetch('./assets/char/' + n + '.svg')
      .then(r => r.ok ? r.text() : null)
      .then(t => { if (t) _CHAR_SVG[n] = _charInner(t); })
      .catch(() => {})
  )).then(() => {
    // base 가 하나도 없으면 종이인형을 쓸 수 없다 — 그때만 예전 그림
    const anyBase = ['base_1','base_2','base_3','base_4'].some(b => _CHAR_SVG[b]);
    if (!anyBase) { console.warn('캐릭터 에셋 로드 실패 — 기존 그림 유지'); _charDollFailed = true; _redrawCharSpots(); return; }
    _charDollReady = true; _charDollFailed = false;
    _redrawCharSpots();   // [CHAR-FIRST-1] 화면 전체(renderAll)가 아니라 캐릭터 자리만
  });
  // 느린 망: 너무 오래 안 오면 빈 자리 대신 옛 그림을 보인다. 뒤늦게 오면 위 then 이 다시 종이인형으로 바꾼다.
  setTimeout(() => { if (!_charDollReady && !_charDollFailed) { _charDollFailed = true; _redrawCharSpots(); } }, _CHAR_DOLL_WAIT_MS);
}
// [CHAR-FIRST-1] 로그인 전 페이지 로드 직후부터 받기 시작한다(로그인 화면 동안 84장이 미리 온다).
try { loadCharDolls(); } catch (e) { /* fetch 없는 환경이면 로그인 뒤 호출이 다시 시도한다 */ }

// [CHAR-FIRST-1] 84장이 오기 전 자리 — 그림자와 흐린 실루엣만. 옛 그림을 먼저 보이지 않는다.
function _charPlaceholderSVG() {
  return '<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">'
       + '<ellipse cx="60" cy="151" rx="26" ry="5" fill="#000" opacity=".28"/>'
       + '<g fill="#fff" opacity=".07"><circle cx="60" cy="42" r="22"/><rect x="40" y="60" width="40" height="44" rx="6"/>'
       + '<rect x="43" y="100" width="15" height="32" rx="5"/><rect x="62" y="100" width="15" height="32" rx="5"/></g></svg>';
}
// [CHAR-FIRST-1] 캐릭터가 그려지는 자리만 다시 그린다(캐릭터 카드·모바일 카드·전투 무대). 없는 자리는 건너뛴다.
function _redrawCharSpots() {
  if (typeof CUR === 'undefined' || !CUR) return;
  ['char-svg-wrap', 'mob-char-svg-wrap', 'ba-char-emoji'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    try { el.innerHTML = charSVG(CUR); } catch (e) { /* 그 자리만 건너뛴다 */ }
  });
}

// 종이인형 합성. base 가 없으면 null 을 돌려 호출부가 폴백하게 한다.
function buildCharDoll(s) {
  const ct = (s && s.charType >= 1 && s.charType <= 4) ? s.charType : 1;
  let base = _CHAR_SVG['base_' + ct];
  if (!base) return null;

  const eq = (s && s.equipmentIds) || {};
  const pick = (slot, id) => (id && id !== 'none') ? (_CHAR_SVG[slot + '_' + id] || '') : '';

  // 머리: 투구를 쓰면 base 의 정수리(hair-top)를 뺀다. 왕관처럼 정수리를 안 덮는 것은 남긴다.
  const headSvg = pick('head', eq.head);
  if (headSvg && headSvg.indexOf('keep-hair-top') === -1) base = _dropGroup(base, 'hair-top');

  // 손: 손가락(fingers-front)은 무기 자루 앞에 다시 그려야 해서 따로 떼어 둔다.
  let fingers = _grabGroup(base, 'fingers-front');
  base = _dropGroup(base, 'fingers-front');

  let out = base + pick('shoe', eq.shoe) + pick('body', eq.body);

  const gloveSvg = pick('glove', eq.glove);
  if (gloveSvg) {                       // 장갑이 있으면 손가락도 장갑 것을 쓴다
    fingers = _grabGroup(gloveSvg, 'fingers-front');
    out += _dropGroup(gloveSvg, 'fingers-front');
  }

  out += headSvg + pick('weapon', eq.weapon) + fingers;
  return '<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg" '
       + 'style="width:100%;height:100%">' + out + '</svg>';
}

// 화면이 쓰는 입구. 에셋이 준비됐으면 종이인형, 아니면 예전 그림.
function charSVG(s) {
  if (CHAR_DOLL && _charDollReady) {
    const doll = buildCharDoll(s);
    if (doll) return doll;
  }
  if (CHAR_DOLL && !_charDollFailed) return _charPlaceholderSVG();   // [CHAR-FIRST-1] 받는 중 — 옛 그림을 먼저 보이지 않는다
  return buildCharSVG(s);
}

function renderCharCard(svgWrapId, cnameId, jobId, combatId, equipId, abilityId, s) {
  const svgWrap = document.getElementById(svgWrapId);
  if (svgWrap) svgWrap.innerHTML = charSVG(s);
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
        ${eqItem ? iconImg(eqItem, 'equipment', '2.2rem') : `<span style="font-size:1.4rem">${sl.icon}</span>`}   <!-- [EQUIP-ICON-1] 상점·가방과 같은 PNG(셀셰이딩) -->
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
  _restoreHomeOpen(document.getElementById('mob-main-tab'));   // [HOME-KEEP-OPEN-1]
}

function renderMain() {
  try {
    document.getElementById('main-area').innerHTML = buildMainHTML();
    _restoreHomeOpen(document.getElementById('main-area'));    // [HOME-KEEP-OPEN-1]
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
    + `<button onclick="closeModal('m-reward');toggleSection('bottom-section','bottom-arrow')"
        style="width:100%;padding:.45rem;border-radius:8px;background:rgba(255,255,255,.04);
          border:1px solid rgba(255,255,255,.08);color:var(--txt2);font-size:.76rem;
          cursor:pointer;font-family:inherit">📜 전체 기록 보기 (감정 · 최근 활동)</button>`;
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

  // 쪽지 — 있으면 언제든 다시 볼 수 있게
  const myNoteCount = getMyNotes().length;
  if (myNoteCount > 0)
    todos.push({type:'info', icon:'📝', badge:myNoteCount,
      title:`내 쪽지 ${myNoteCount}개`,
      sub:'선생님이 준 안내를 다시 볼 수 있어요',
      action:"openNoteList()", btnLabel:'보기'});

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
          <span style="font-size:1rem;flex-shrink:0">${escHtml(q.icon||'📋')}</span>
          <div style="flex:1;min-width:0">
            <div class="mission-name">${escHtml(q.name)}</div>
            <div style="font-size:.68rem;color:var(--txt3)">${typeLabel}${q.dueDate?` · 마감 ${q.dueDate}`:''}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.15rem;flex-shrink:0">
            <span class="mission-reward">+${q.exp}EXP</span>
            ${done?`<span style="font-size:.65rem;color:var(--emerald);font-weight:700">완료!</span>`
              :pending?`<span style="font-size:.65rem;color:var(--gold)">확인 중…</span>`
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

  return `
    <!-- 오늘의 링크 — 기본 접힘 (HOME-PLACE-1)
         링크가 8개면 278px를 먹어 크롬북(1366×610)에서 학습·퀘스트가 전부 화면 밖으로
         밀려났다. 헤더만 남기고 접어 둔다. 개수는 헤더에 표시. -->
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
            <span style="font-size:.8rem;color:var(--txt1)">💪 <b>${escHtml(goal.focusArea||'')}</b></span>
            <span style="font-size:.8rem;color:var(--txt1)">🎯 <b>${escHtml(goal.goalText||'')}</b></span>
            <span style="font-size:.8rem;color:var(--txt1)">🌟 <b>${escHtml(goal.mindset||'')}</b></span>
          </div>
        </div>`;
    })()}
    ${alerts.join('')}

    <!-- ① 오늘의 학습 — 매일 하는 핵심 기능이라 할 일보다 위 (HOME-PLACE-1) -->
    <div class="sec-label">📚 오늘의 공부</div>
    ${buildStudyCardHTML(s)}

    <!-- ② 핵심 할 일 1개 강조 + 나머지 요약 -->
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

    <!-- ③ 주요 메뉴 4개 -->
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
        <div class="tile-icon">🎒</div><div class="tile-name">가방</div>
        <div class="tile-desc">아이템</div>
      </div>
      <div class="menu-tile" onclick="openModal('m-rank');renderRankingModal()"
        style="border-color:rgba(255,215,0,.2)">
        <div class="tile-icon">🏆</div><div class="tile-name">랭킹</div>
        <div class="tile-desc">우리반 순위</div>
      </div>
      <!-- [VILLAGE-DOOR-1] 3칸 격자에 6개가 꽉 차 있어 7번째는 한 줄 전체로 둔다(하나만 덩그러니 남지 않게). -->
      <div class="menu-tile" onclick="openExternalEmbed('village')"
        style="grid-column:1/-1;border-color:rgba(120,200,140,.35)">
        <div class="tile-icon">🏘️</div><div class="tile-name">우리 마을</div>
        <div class="tile-desc">짓고 · 키우기</div>
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
        <div style="font-size:.63rem;color:var(--txt2);margin-top:.12rem">꾸미기</div>
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
              ...(s.monsterLog||[]).slice(-2).reverse().map(m=>({icon:'⚔️',text:monsterNameById(m)+' 처치',color:'var(--red)'}))
            ];
            if(logs.length===0) return '<div style="font-size:.72rem;color:var(--txt3)">아직 기록 없어요</div>';
            return logs.slice(0,6).map(l=>`<div style="display:flex;align-items:center;gap:.35rem;padding:.2rem 0;border-bottom:1px solid rgba(255,255,255,.04)">
              <span style="font-size:.85rem">${l.icon}</span>
              <span style="font-size:.7rem;color:${l.color};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(l.text||'')}</span>
            </div>`).join('');
          })()}
        </div>
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
    </div>`;
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
        <div class="ic-icon">${iconImg(s, 'seeds', '1.4rem', s.id)}${locked?'<span style="font-size:.7rem">🔒</span>':''}</div>
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

// ══ 몬스터 ══
// ── 현재 열린 사냥터 zone ──
let CUR_ZONE = 'beginner';

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

function renderMonsters() {
  const killed = CUR.monsterLog||[];
  const canFight = Utils.canFightMonster(CUR);
  const attemptsLeft = Utils.monsterAttemptsLeft(CUR);
  document.getElementById('monster-list').innerHTML = getActiveMonsters().map(m => {
    const isKilled = killed.includes(m.id);
    const isLocked = (m.level || m.recLv || 0) > CUR.level + 3;
    const canChallenge = canFight && !isKilled && !isLocked;
    return `<div class="mon-card ${isKilled?'killed':''} ${isLocked?'locked':''}"
      onclick="${canChallenge?`startBattle('${m.id}')`:''}"
      style="${isKilled||isLocked?'cursor:default':''}">
      <div class="mc-icon">${iconImg(m, 'monsters', '1.6rem')}</div>
      <div class="mc-name">${escHtml(m.name)}</div>
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
        <div class="ba-fighter-name" style="color:#7ec8e3">${escHtml(player.name)}</div>
        <div class="ba-fighter-icon" style="width:80px;height:100px;margin:0 auto" id="ba-char-emoji">${charSVG(player)}</div>
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
        <div class="ba-fighter-name" style="color:#FF8A80">${escHtml(mon.name)}</div>
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

  const mon   = BATTLE_STATE.monster;
  const win   = BATTLE_STATE.win;
  finalizeBattle(CUR, mon, win);
  CUR.battleInProgress = null;
  CUR.level = Utils.levelFromExp(CUR.exp);
  BATTLE_DONE = true;
  DB.saveStudent(CUR);
  renderHUD();
  // 전투는 EXP 0(설계: 레벨은 학급퀘스트로만) → 레벨업 없음. 헛도는 레벨업 연출 트리거 제거 (DI-5).
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
    logHtml = `<span class="info">${escHtml(mon.icon)} ${escHtml(mon.name)}이(가) 나타났다!</span><br>도전 버튼을 눌러 전투를 시작하세요.`;
  } else if (phase === 'win') {
    logHtml = `<span class="good">⚡ 공격 성공!</span><br><span class="good">💥 ${escHtml(mon.name)}을(를) 물리쳤다!</span><br><span class="good">💰 +${mon.gold}G 획득!</span>`;
  } else {
    logHtml = `<span class="bad">💔 ${escHtml(mon.name)}의 반격!</span><br><span class="bad">이번엔 졌어요…</span>`;
  }

  document.getElementById('battle-arena').innerHTML = `
    <div class="ba-vs">
      <div class="ba-side">
        <div class="ba-emoji" id="ba-char-emoji" style="font-size:0;width:70px;height:90px;margin:0 auto">
          ${charSVG(s)}
        </div>
        <div style="font-size:.75rem;font-weight:700">${escHtml(s.name)}</div>
        <div class="ba-hp-wrap">
          <div class="ba-hp-bar-bg"><div class="ba-hp-bar-fill ba-char-hp" id="ba-char-hp" style="width:${charHpPct}%"></div></div>
          <div class="ba-hp-txt">HP ${charHpPct}%</div>
        </div>
      </div>
      <div class="ba-vs-icon">⚡</div>
      <div class="ba-side">
        <div class="ba-emoji" id="ba-mon-emoji">${iconImg(mon, 'monsters', '3.8rem')}</div>
        <div style="font-size:.75rem;font-weight:700">${escHtml(mon.name)}</div>
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
    {delay:0,    charMove:true,  log:`<span class="info">⚔️ ${escHtml(s.name)} 공격!</span>`},
    {delay:1000, monShake:true,  log:`<span class="good">💥 타격! 몬스터 체력 감소!</span>`,  monHp:65},
    {delay:2200, monAtk:true,    log:`<span class="bad">😤 ${escHtml(mon.name)} 반격!</span>`},
    {delay:3200, charFx:true,    log:`<span class="info">🛡️ 막았다!</span>`},
    {delay:4400, charMove:true,  log:`<span class="info">⚔️ 연속 공격!</span>`},
    {delay:5400, monShake:true,  log:`<span class="good">💥 치명타!</span>`,               monHp:30},
    {delay:6600, charMove:true,  log:`<span class="info">⚔️ 마지막 일격!</span>`},
    {delay:7600, monShake:true,  log:`<span class="good">💥 ${escHtml(mon.name)} 쓰러졌다!</span>`, monHp:0},
    {delay:9000, end:true, win:true},
  ] : [
    {delay:0,    charMove:true,  log:`<span class="info">⚔️ ${escHtml(s.name)} 공격!</span>`},
    {delay:1000, miss:true,      log:`<span style="color:#888">💨 빗나감!</span>`},
    {delay:2200, monAtk:true,    log:`<span class="bad">😈 ${escHtml(mon.name)} 반격!</span>`},
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
          DB.logGold(CUR.id, 'battle', mon.gold);   // [GOLD-LOG-1]
          CUR.level = Utils.levelFromExp(CUR.exp);
          if (!(CUR.monsterLog||[]).includes(mon.id)) CUR.monsterLog = [...(CUR.monsterLog||[]), mon.id];
        }
        // ★ 횟수 차감은 startBattle()에서 완료 — 여기서는 battleInProgress 정리만
        CUR.battleInProgress = null;
        DB.saveStudent(CUR);
        renderBattle(r.win ? 'win' : 'lose'); renderHUD();
        // 전투는 EXP 0(설계) → 레벨업 없음. exp−gold 단위혼동으로 가짜 레벨업 뜨던 트리거 제거 (DI-5).
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
    if (confirm('무한배틀을 그만할까요?\n지금까지 기록은 남아요.')) {
      _endInfiniteBattleSession(true);
    }
    return;
  }
  // 일반 전투 진행 중: 포기 확인
  if (confirm('지금 그만두면 진 걸로 쳐요.\n쓴 기회는 돌아오지 않아요.\n\n그만할까요?')) {
    CUR.battleInProgress = null;
    DB.saveStudent(CUR);
    closeBattle();
    toast('💀 전투를 그만뒀어요. 기회 1번을 썼어요.');
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

// [ZONE-GOLD-TEXT-1] 사냥터 카드의 "💰 보상" 범위는 그 구역 몬스터의 실제 골드(mon.gold — 이긴 뒤 그대로 지급)에서 만든다.
//   예전엔 "10 ~ 50G" 같은 글자를 적어 둬서 몬스터 표가 바뀌면 어긋났다(09-15: 실제 18~60 · 35~110 · 70~220G).
//   몬스터가 없거나 골드가 숫자가 아니면 적어 둔 글자(fallback)를 쓴다.
function zoneGoldRangeText(mons, fallback) {
  const golds = (mons || []).map(m => Number(m && m.gold)).filter(Number.isFinite);
  if (!golds.length) return fallback;
  const lo = Math.min(...golds), hi = Math.max(...golds);
  return lo === hi ? `${lo}G` : `${lo} ~ ${hi}G`;
}

// ══ 상점 장비 잠금 줄 (SHOP-LOCK-HINT-1) ══════════════════════════════
//  디자인 A-2(클로드코드\rpg_게임디자인_A\A2_신발_예술조건_20260915.md) 시안 그대로 — 값·구매 규칙은 안 바꾸고 보여 주는 말만.
//   · 능력치 조건마다 "필요 (지금 n)", 이미 채운 조건은 ✅ — 하나 채우고 또 막히는 실망을 막는다
//   · 여는 법 한 줄(능력치별) — 레벨도 모자라고 조건이 둘 이상 모자라면(아주 멀면) 생략
//   · 골드·레벨은 괜찮고 조건 하나가 딱 1 모자라면 초록 테두리 + "퀘스트 하나면 열려요!"
//  구매 판정(canBuyEquipment)은 그대로 쓰고, 이 함수는 표시만 만든다.
const SHOP_STAT_HOW = {
  art:    { ic: '🎨', how: '그림·만들기·악기 퀘스트로 예술이 올라요' },
  health: { ic: '💪', how: '운동 퀘스트로 건강이 올라요' },
  study:  { ic: '📚', how: '공부 퀘스트로 학습이 올라요' },
  value:  { ic: '💝', how: '선행 퀘스트로 가치가 올라요' },
  life:   { ic: '🏠', how: '생활 퀘스트로 생활이 올라요' },
  read:   { ic: '📖', how: '책을 읽고 기록하면 독서가 올라요' },
};
function shopLockInfo(student, item, check) {
  if (!check || check.ok) return { html: '', near: false };
  const st = (student && student.stats) || {};
  const names = (GAME_DATA && GAME_DATA.statNames) || {};
  const goldShort  = (student.gold || 0) < item.price;
  const levelShort = (student.level || 1) < (item.lv || 1);
  const conds = Object.entries(item.cond || {}).filter(([, v]) => v && v > 0)
    .map(([k, v]) => ({ k, need: v, have: st[k] || 0, name: names[k] || k }));
  const unmet = conds.filter(c => c.have < c.need);
  // 능력치 조건이 다 찼으면(골드·레벨·보유 때문에 막힘) 예전 문구 그대로
  if (!unmet.length) return { html: `<div style="font-size:.62rem;color:var(--red);margin-top:.15rem">🔒 ${escHtml(check.reason)}</div>`, near: false };
  const parts = [];
  if (goldShort)  parts.push(escHtml(`골드 부족 (${item.price}G 필요)`));
  if (levelShort) parts.push(escHtml(`Lv.${item.lv} 이상 필요`));
  for (const c of conds) {
    parts.push(c.have >= c.need
      ? `<span style="color:var(--emerald)">✅ ${escHtml(c.name)} ${c.need}</span>`
      : `${escHtml(c.name)} ${c.need} 필요 <span style="color:var(--txt3)">(지금 ${c.have})</span>`);
  }
  const near = !goldShort && !levelShort && unmet.length === 1 && unmet[0].need - unmet[0].have === 1;
  const first = unmet[0], how = SHOP_STAT_HOW[first.k];
  let howLine = '';
  if (near) howLine = `${how ? how.ic : '⭐'} 퀘스트 하나면 열려요!`;
  else if (how && !(levelShort && unmet.length >= 2)) howLine = `${how.ic} ${how.how}`;
  return {
    html: `<div style="font-size:.62rem;color:var(--red);margin-top:.15rem">🔒 ${parts.join(' · ')}</div>`
        + (howLine ? `<div style="font-size:.62rem;color:var(--emerald);margin-top:.1rem">${howLine}</div>` : ''),
    near,
  };
}

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
    { id:'beginner',     icon:'🌿', name:'초급 사냥터', color:'#6fd49d', border:'rgba(111,212,157,.35)', bg:'rgba(111,212,157,.07)', gold:IB_CONFIG.beginner.baseGold + 'G / 마리', minLv:1  },
    { id:'intermediate', icon:'🔥', name:'중급 사냥터', color:'#FF8A80', border:'rgba(255,138,128,.35)', bg:'rgba(255,138,128,.07)', gold:IB_CONFIG.intermediate.baseGold + 'G / 마리', minLv:1  },
    { id:'advanced',     icon:'⚡', name:'고급 사냥터', color:'#7ec8e3', border:'rgba(126,200,227,.35)', bg:'rgba(126,200,227,.07)', gold:IB_CONFIG.advanced.baseGold + 'G / 마리', minLv:21 },
  ];

  body.innerHTML = `
    <div style="padding:.6rem 0 .4rem">
      <div style="font-size:.8rem;color:var(--txt2);line-height:1.7;margin-bottom:.9rem;
        background:rgba(255,255,255,.04);border-radius:10px;padding:.6rem .8rem">
        선택한 사냥터에서 <b style="color:var(--gold)">쓰러질 때까지 계속 싸워요</b>.<br>
        몬스터를 처치할 때마다 <b style="color:#6fd49d">최대 체력의 20%</b>를 되찾아요.<br>
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
    `${IB.zone === 'beginner' ? '초급' : IB.zone === 'intermediate' ? '중급' : '고급'} · 처치 ${IB.kills}마리 · 모은 골드 ${IB.gold}G`;

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
  DB.logGold(CUR.id, 'infinite', IB.gold);   // [GOLD-LOG-1] 세션 누적분을 한 번에
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
      const kCount = mons.filter(m => killed.includes(m.id)).length;
      const pct    = mons.length ? Math.round(kCount/mons.length*100) : 0;
      const preview = mons.slice(0,3).map(m =>
        `<div class="zn-mon">
          <div class="zn-mon-ico">${iconImg(m, 'monsters', '1.5rem')}</div>
          <div class="zn-mon-lv">Lv${m.level||m.recLv}</div>
        </div>`).join('');

      return `<div class="zone-card ${locked?'zone-locked':''}"
        onclick="${locked?`toast('Lv.${z.minLv} 이상 필요해요!')`:`selectZoneCard('${z.id}')`}"
        style="--zbg:${z.bg};--zb:${z.border};--zc:${z.color}">
        ${!locked?'<div class="zone-shine"></div>':''}
        <div class="zn-head">
          <span class="zn-ico">${z.icon}</span>
          <div class="zn-title">
            <div class="zn-name">${z.name}</div>
            <div class="zn-sub">${z.sub}</div>
          </div>
          ${locked?`<span class="zn-lock">🔒 Lv.${z.minLv}</span>`:''}
        </div>
        <div class="zn-desc">${z.desc}</div>
        <div class="zn-prev">
          ${preview}
          <div class="zn-more">외 ${Math.max(0,mons.length-3)}마리</div>
        </div>
        <div class="zn-foot">
          <span class="zn-reward">💰 ${zoneGoldRangeText(mons, z.reward)}</span>
          <span class="zn-kill">${kCount}/${mons.length} 처치</span>
        </div>
        <div class="zn-bar">
          <div class="zn-bar-fill" style="width:${pct}%"></div>
        </div>
        ${!locked&&canFight?`<div class="zn-enter">입장 →</div>`:''}
      </div>`;
    }).join('');

    body.innerHTML = `
      <div class="zn-top">
        <div>
          <div class="zn-top-title">구역을 선택하세요</div>
          <div class="zn-top-sub">선택 후 돌아올 수 없어요</div>
        </div>
        ${canFight
          ? `<div class="zn-left">
               <div class="zn-left-n">${attemptsLeft}
                 <span class="zn-left-of">/${limit}회</span>
               </div>
               <div class="zn-left-lbl">오늘 남은 전투</div>
             </div>`
          : `<div class="zn-done">오늘 완료 ✅</div>`}
      </div>
      <div class="zn-grid">${zoneCards}</div>
      <div class="zn-dex-wrap">
        <button onclick="MONSTER_STEP='dex';MONSTER_DEX_ZONE='beginner';renderMonsterStep()" class="zn-dex">
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
      const isKilled  = killed.includes(mon.id);
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
        <div style="font-size:.85rem;font-weight:800;color:${isKilled?'var(--txt3)':isSpecial?'#fff':'var(--txt1)'};margin-bottom:.2rem">${escHtml(mon.name)}</div>
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
    const zoneKilled = zoneMons.filter(m => killed.includes(m.id)).length;
    const pct = zoneMons.length ? Math.round(zoneKilled/zoneMons.length*100) : 0;

    // 나머지 몬스터 미리보기 (오늘 후보 제외)
    const offerIds = new Set((offers||[]).map(m=>m.id));
    const others   = zoneMons.filter(m => !offerIds.has(m.id)).slice(0,6);
    const othersHtml = others.length ? `
      <div style="margin-top:1rem;padding-top:.9rem;border-top:1px solid rgba(255,255,255,.07)">
        <div style="font-size:.72rem;font-weight:700;color:var(--txt2);margin-bottom:.6rem">이 구역의 다른 몬스터</div>
        <div style="display:flex;flex-wrap:wrap;gap:.4rem">
          ${others.map(m => {
            const isK = killed.includes(m.id);
            return `<div style="display:flex;align-items:center;gap:.35rem;padding:.25rem .55rem;
              border-radius:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,${isK?'.08':'.06'});
              opacity:${isK?.65:1}">
              <span style="font-size:.85rem">${iconImg(m, 'monsters', '.85rem')}</span>
              <div>
                <div style="font-size:.63rem;font-weight:600;color:${isK?'var(--txt3)':'var(--txt2)'}">${escHtml(m.name)}</div>
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
    const killedCount = zoneMons.filter(m => killed.includes(m.id)).length;
    const pct = zoneMons.length ? Math.round(killedCount/zoneMons.length*100) : 0;

    const tabsHtml = dexZones.map(z => {
      const kc = allMons.filter(m=>m.zone===z.id&&killed.includes(m.id)).length;
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
      const isKilled  = killed.includes(m.id);
      const wasMet    = isKilled || (CUR.recentBattleOffers||[]).flat().some(n=>n===m.name);
      const isSpecial = m.rarity === 'legend' || m.rarity === 'rare';

      if (isKilled) {
        const glowSpec = isSpecial ? ';box-shadow:0 0 14px rgba(255,215,0,.2)' : '';
        return `<div style="background:rgba(46,204,113,.08);border:1.5px solid rgba(46,204,113,.3);
          border-radius:12px;padding:.65rem .4rem;text-align:center${glowSpec}">
          ${isSpecial?`<div style="font-size:.52rem;color:#FFD700;font-weight:700;margin-bottom:.1rem">✨전설</div>`:''}
          <div style="font-size:1.5rem;margin-bottom:.15rem">${iconImg(m, 'monsters', '1.5rem')}</div>
          <div style="font-size:.7rem;font-weight:700;color:var(--txt1)">${escHtml(m.name)}</div>
          <div style="font-size:.58rem;color:var(--txt3)">Lv${m.level||m.recLv}</div>
          <div style="font-size:.55rem;color:var(--emerald);background:rgba(46,204,113,.15);
            border-radius:5px;padding:.1rem .3rem;margin-top:.25rem">✓ 처치완료</div>
        </div>`;
      } else if (wasMet) {
        return `<div style="background:rgba(255,255,255,.04);border:1.5px solid rgba(255,255,255,.12);
          border-radius:12px;padding:.65rem .4rem;text-align:center;opacity:.8">
          <div style="font-size:1.5rem;margin-bottom:.15rem;filter:grayscale(.4)">${iconImg(m, 'monsters', '1.5rem')}</div>
          <div style="font-size:.7rem;font-weight:700;color:var(--txt2)">${escHtml(m.name)}</div>
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

// ══ 보스 ══
function openBoss() {
  const settings = DB.getSettings();
  openModal('m-boss');
  document.getElementById('boss-arena').innerHTML = `
    <div style="text-align:center;padding:1rem">
      <div style="font-size:5rem;animation:floatY 3s ease-in-out infinite">${escHtml(settings.bossIcon||'🧌')}</div>
      <div style="font-size:1.2rem;font-weight:700;color:var(--red);margin:.5rem 0">${escHtml(settings.bossName)}</div>
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
  if (tab==='weekly')  renderWeeklyTab();
  if (tab==='book')    { renderBookRecords(); initBookForm(); }
  if (tab==='stats')   renderDqPortfolio();
  if (tab==='artwork') { fillArtworkSubjectSelect(); renderArtworks(); }
  if (tab==='emotion') renderEmotionHistory();
  if (tab==='memory')  renderMyMemories();
  if (tab==='ach')     renderHouseAchievements();
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
  document.body.classList.toggle('deco-floor-mode', mode === 'floor');   // [DECO-PT-2] 바닥 모드면 장식 서랍 접기
  _floorPickShow(mode === 'floor');   // [DECO-FLOOR-PICK-1] 접힌 서랍 자리에 바닥 고르기 판
  if (_decoRectPrev) { _decoRectPrev = null; _decoRectTip(); }   // [DECO-FLOOR-RECT-1]
  setTimeout(() => { try { _decoPillarSync(); } catch (e) {} }, 0);
  document.body.classList.toggle('deco-erase-mode', mode === 'erase');
  if (mode === 'erase') { SEL_DECO = null; if (typeof renderDecoInv === 'function') renderDecoInv(); }
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

// ══ 바닥 고르기 화면 (DECO-FLOOR-PICK-1 · 정원 바닥 연결 ④-1) ══════════════
//  규칙 원본: docs/deco_floor_picker_20260920.md — (다) 견본 판 + 가족 칩 · 색 · 테두리 세 줄. 칠하기는 지금의 '끌어서' 그대로(④-2 에서 '네모로').
//  · 저장값은 `_floorJoin` 한 곳에서만 만든다 — 늘 `이름#색+마감` 순서 · 기본색이면 `#` 없이 · 자연(마감 없음)이면 `+` 없이.
//    지우개 판정 네 곳이 저장값을 **글자 그대로** 비교하므로(같은 바닥을 다시 칠하면 걷힌다) 한 조합 = 한 글자여야 한다.
//  · 견본·칩·동그라미 그림은 마당과 같은 `_drawFloorSVG` 로 그린다(가장자리·마감까지 칠해질 모습 그대로).
//  · 판·칩·동그라미·말풍선 모양은 `_pk*` 로 떼어 두었다 — 집 안 벽지·바닥 고르기(IN-2)가 그림 그리는 함수만 바꿔 같은 말투로 쓰게.
function _floorJoin(name, color, rim) {
  name = String(name || '');
  if (!/^[a-z][a-z0-9_]*$/.test(name)) return 'grass';
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const cols = own(_FLOOR_COLORS, name) ? _FLOOR_COLORS[name] : null;
  const col = (color && cols && cols.indexOf(color) >= 0) ? color : '';                       // 기본색·모르는 색 → 글자 없음
  const rm = (rim && _FLOOR_EDGE_COLOR[name] && _FLOOR_RIMS.indexOf(rim) >= 0) ? rim : '';    // 꽃밭 무리만 마감(들꽃·옛 바닥은 없음)
  return name + (col ? '#' + col : '') + (rm ? '+' + rm : '');
}
//  기본 14바닥 — 지금 단추 순서·글자 그대로(보스 ⓓ: 쓰던 바닥이 사라져 보이면 안 된다)
const _FLOOR_BASIC = [['grass', '🌿 잔디'], ['dirt', '🟫 흙'], ['dark_earth', '⬛ 어두운 흙'], ['stone', '🪨 돌'], ['stone_floor', '🪟 돌바닥'],
  ['sand', '🏜️ 모래'], ['gravel', '🔘 자갈'], ['brick', '🧱 벽돌'], ['wood', '🪵 나무'], ['water', '🔵 물'], ['flower', '🌸 꽃밭'],
  ['deck', '🪵 데크'], ['dry_earth', '🟡 마른 흙'], ['gravel_yard', '⬜ 자갈마당']];
//  가족 칩 — 순서 고정 · [이름, 칩 글자, 기본 색(그림 파일의 기본 · 저장값에는 안 붙는다)]
const _FLOOR_FAMS = [['tulipbed', '튤립', 'pink'], ['tulipcol', '세로 튤립', 'pink'], ['hydrangea', '수국', 'blue'], ['lavender', '라벤더', 'violet'],
  ['sunflowerbed', '해바라기', 'yellow'], ['daisyfield', '데이지', 'white'], ['wildflower', '들꽃', '']];
const _FLOOR_COLOR_KO = { pink: '분홍', red: '빨강', yellow: '노랑', white: '흰', violet: '보라', orange: '주황', blue: '파랑',
  candy: '사탕', sherbet: '복숭아', night: '검보라', duo: '두 빛', moon: '달빛', lemon: '레몬', rainbow: '무지개', snow: '눈꽃' };
const _FLOOR_RIM_ORDER = [['', '자연'], ['brick', '벽돌'], ['stone', '돌'], ['picket', '흰 말뚝']];

//  잠긴 색 — docs/deco_garden_family_20260920.md '열린 색 / 잠긴 색' 표. 열렸으면 '' · 잠겼으면 아이 말 두 줄.
//  ⚠️ 문턱은 원래 '가진 적 있음'(도감)인데 도감 기록이 아직 없다 → 지금은 **지금 가진 것**(인벤토리)으로 본다.
//     팔면 그 색이 다시 잠기지만, 이미 칠한 칸은 그대로 남는다(저장값은 안 건드린다). 도감 코드가 붙으면 `_floorHas` 만 바꾼다.
//  라벤더·해바라기·데이지는 표에 문턱이 없어 전부 열림.
function _floorHas(id) { return _decoQtyOf(id) > 0; }
//  [DECO-RETIRE-2] '가진 것'은 상점에서 뺀(hidden) 것도 센다 — 장식을 상점에서 빼도 그걸 가진 아이의 색이 다시 잠기지 않게.
//  '전부'는 **지금 상점에 있는 것 전부**(뺀 것은 더 살 수 없으니 목표에서 뺀다).
function _floorKindCount(kind) {
  const yard = GAME_DATA.decorations.filter(d => d.cat === 'yard' && _decoShopKind(d) === kind), shop = yard.filter(d => !d.hidden);
  return { have: yard.filter(d => _floorHas(d.id)).length, all: shop.length, allHave: shop.filter(d => _floorHas(d.id)).length };
}
function _floorLockWhy(name, color) {
  const fam = name === 'tulipcol' ? 'tulipbed' : name;
  const any = ids => ids.some(_floorHas);
  const need = (kind, n, what, icon) => { const k = _floorKindCount(kind), ok = n ? k.have >= n : k.allHave >= k.all;
    return ok ? '' : `${icon} ${what} 장식을 ${n ? n + '가지' : '전부'} 모으면 열려요!\n지금 ${n ? k.have + '가지' : k.allHave + '/' + k.all} · 🛒 상점에서 찾아볼 수 있어요`; };
  const one = (ids, what) => any(ids) ? '' : `${what} 장식을 가져 보면 열려요!\n🛒 상점에서 찾아볼 수 있어요`;
  if (fam === 'tulipbed') {
    if (color === 'red') return one(['d_y1', 'd_y21', 'd_y43'], '🌹 장미');
    if (color === 'white') return one(['d_y42'], '🌼 데이지');
    if (color === 'violet') return one(['d_y41'], '💜 라벤더');
    if (color === 'orange') return one(['d_y7'], '🌻 해바라기');
    if (color === 'candy') return need('plant', 8, '꽃·풀', '🌷');
    if (color === 'sherbet') return need('plant', 12, '꽃·풀', '🌷');
    if (color === 'night') return need('plant', 0, '꽃·풀', '🌷');
  }
  if (fam === 'hydrangea') {
    if (color === 'violet' || color === 'pink' || color === 'white') return need('water', 2, '물', '💧');
    if (color === 'duo') return need('water', 0, '물', '💧');
    if (color === 'moon') return any(['d_y6', 'd_y14']) ? '' : '🏮 가로등이나 석등을 가져 보면 열려요!\n밤에 피는 꽃이에요';
  }
  if (fam === 'wildflower') {
    if (color === 'rainbow') return need('animal', 6, '동물', '🐾');
    if (color === 'snow') return need('tree', 5, '나무', '🌳');
  }
  return '';
}

// ── 고르기 화면 공용 조각(마당·집 안) ── draw(ctx, w, h) 는 CSS 픽셀 좌표로 그린다(2배 판에 알아서 맞춘다)
function _pkCanvas(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * 2); cv.height = Math.round(h * 2);
  cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.setAttribute('aria-hidden', 'true');
  cv._pkDraw = draw; cv._pkW = w; cv._pkH = h; _pkPaint(cv);
  return cv;
}
function _pkPaint(cv) {
  const ctx = cv.getContext('2d'); if (!ctx) return;
  ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.clearRect(0, 0, cv._pkW, cv._pkH);
  try { cv._pkDraw(ctx, cv._pkW, cv._pkH); } catch (e) {}
}
function _pkButton(cls, label, on, onTap, extra) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = cls + (on ? ' is-on' : ''); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  if (label) b.setAttribute('aria-label', label);
  b.addEventListener('click', e => { e.stopPropagation(); onTap(b); });
  if (extra) extra(b);
  return b;
}
//  칩 = 그림 + 짧은 이름 · 동그라미 = 그림만(잠기면 🔒) · 네모 = 그림만
function _pkChip(name, w, h, draw, on, onTap, cls) {
  return _pkButton('pk-chip' + (cls ? ' ' + cls : ''), name, on, onTap, b => { b.appendChild(_pkCanvas(w, h, draw)); const s = document.createElement('span'); s.textContent = name; b.appendChild(s); });
}
function _pkDot(label, size, draw, on, locked, onTap) {
  return _pkButton('pk-dot' + (locked ? ' is-locked' : ''), label + (locked ? ' (잠김)' : ''), on, onTap, b => {
    b.appendChild(_pkCanvas(size, size, draw));
    if (locked) { const l = document.createElement('span'); l.className = 'pk-lk'; l.textContent = '🔒'; b.appendChild(l); }
  });
}
function _pkTile(label, size, draw, on, onTap) {
  return _pkButton('pk-tile', label, on, onTap, b => b.appendChild(_pkCanvas(size, size, draw)));
}
//  견본 판 — 그림 + 이름 줄 + 캡션(줄마다) · locked 면 어둡게 + 가운데 🔒
function _pkSwatch(box, w, h, draw, name, caps, locked) {
  box.textContent = '';
  const f = document.createElement('div'); f.className = 'pk-sw';
  f.appendChild(_pkCanvas(w, h, (ctx, W, H) => { draw(ctx, W, H); if (locked) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, W, H); } }));
  if (locked) { const l = document.createElement('span'); l.className = 'pk-sw-lk'; l.textContent = '🔒'; f.appendChild(l); }
  box.appendChild(f);
  const n = document.createElement('div'); n.className = 'pk-name'; n.textContent = name; box.appendChild(n);
  caps.forEach(t => { const c = document.createElement('div'); c.className = 'pk-cap'; c.textContent = t; box.appendChild(c); });
}
//  [DECO-FLOOR-RECT-1] 둘 중 하나 고르기(도구 토글) — items = [[값, 글자]…]
function _pkSeg(items, cur, onTap, label) {
  const g = document.createElement('div'); g.className = 'pk-seg'; g.setAttribute('role', 'group'); if (label) g.setAttribute('aria-label', label);
  items.forEach(([v, t]) => { const b = _pkButton('pk-seg-b', t, v === cur, () => onTap(v)); b.dataset.v = v; b.textContent = t; g.appendChild(b); });
  return g;
}
//  말풍선 — anchor 위에 한 줄(두 줄까지). host 는 position:relative 인 판
function _pkBubble(host, anchor, text) {
  let bb = host.querySelector('.pk-bubble');
  if (!bb) { bb = document.createElement('div'); bb.className = 'pk-bubble'; bb.setAttribute('role', 'status'); host.appendChild(bb); }
  if (!anchor || !text) { bb.hidden = true; return; }
  bb.textContent = text; bb.hidden = false;
  const hr = host.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
  const bw = bb.offsetWidth, x = Math.max(6, Math.min(hr.width - bw - 6, ar.left - hr.left + ar.width / 2 - bw / 2));
  bb.style.left = x + 'px'; bb.style.top = (ar.top - hr.top - bb.offsetHeight - 10) + 'px';
  bb.style.setProperty('--pk-tail', (ar.left - hr.left + ar.width / 2 - x) + 'px');
}

// ── 마당 바닥 그림: 작은 판을 마당과 같은 그리기로 ──
//  cellAt(r,c) → 저장값. 판 밖은 '경계 없음'(마당의 격자 밖과 같다) — 둘레를 보이려면 판 안에 잔디 테를 둔다.
function _floorBoard(ctx, cols, rows, C, ox, oy, cellAt) {
  const keep = _dCtx;
  _dCtx = ctx;
  try {
    ctx.save(); ctx.translate(ox, oy);
    const typeAt = (rr, cc, wantRim) => (rr < 0 || cc < 0 || rr >= rows || cc >= cols) ? null : _floorParse(cellAt(rr, cc))[wantRim ? 'rim' : 'name'];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const p = _floorParse(cellAt(r, c));
      if (FLOOR_SVG && _drawFloorSVG(p.name, r, c, c * C, r * C, C, typeAt, p.color, p.rim)) continue;
      const t = FLOOR_TILES[p.name] || FLOOR_TILES.grass;     // 그림이 아직 안 왔으면 단색(오면 다시 그린다)
      ctx.fillStyle = t.bg; ctx.fillRect(c * C, r * C, C, C);
    }
    ctx.restore();
  } finally { _dCtx = keep; }
}
//  값 v 를 잔디 가운데 (bw×bh) 로 깐 판 — 테 두께 m 칸. 캔버스 W×H 에 가로로 맞추고 세로는 가운데 자른다.
const _floorBedDraw = (v, bw, bh, m) => (ctx, W, H) => {
  const cols = bw + 2, rows = bh + 2, C = W / (bw + 2 * m);
  _floorBoard(ctx, cols, rows, C, -(1 - m) * C, (H - (bh + 2 * m) * C) / 2 - (1 - m) * C,
    (r, c) => (r >= 1 && r <= bh && c >= 1 && c <= bw) ? v : 'grass');
};
const _floorCellDraw = v => (ctx, W) => _floorBoard(ctx, 1, 1, W, 0, 0, () => v);
//  테두리 단추 그림 = 꽃밭 모퉁이를 확대해 자른 것(그 마감이 둘러진 모습)
const _floorCornerDraw = v => (ctx, W) => { const C = W / 1.45; _floorBoard(ctx, 3, 3, C, -0.55 * C, -0.55 * C, (r, c) => (r >= 1 && c >= 1) ? v : 'grass'); };

// ── 상태 · 그리기 ──
const _fpk = { fam: 'basic', basic: 'grass', col: {}, rim: {}, peek: null, peekT: 0, soon: 0 };
function _floorPickRead(v) {   // 거꾸로 읽기 — 지금 붓(CUR_FLOOR_TILE)을 칩·색·테두리로
  const p = _floorParse(v || 'grass');
  if (_FLOOR_FAMS.some(f => f[0] === p.name)) { _fpk.fam = p.name; _fpk.col[p.name] = p.color; _fpk.rim[p.name] = p.rim; }
  else { _fpk.fam = 'basic'; _fpk.basic = _FLOOR_BASIC.some(b => b[0] === p.name) ? p.name : 'grass'; }
}
function _floorPickValue() { return _fpk.fam === 'basic' ? _fpk.basic : _floorJoin(_fpk.fam, _fpk.col[_fpk.fam] || '', _fpk.rim[_fpk.fam] || ''); }
function _floorPickName(v) {
  const p = _floorParse(v), b = _FLOOR_BASIC.find(x => x[0] === p.name);
  if (b) return b[1];
  const f = _FLOOR_FAMS.find(x => x[0] === p.name); if (!f) return p.name;
  const col = _FLOOR_COLOR_KO[p.color || f[2]] || '';
  const rim = p.rim ? ' · ' + (_FLOOR_RIM_ORDER.find(x => x[0] === p.rim) || ['', p.rim])[1] : '';
  return (col ? col + ' ' : '') + f[1] + rim;
}
function _floorPickTap(patch, anchor) {
  _floorPickPeekEnd(false);
  if (patch.fam !== undefined) {
    _fpk.fam = patch.fam;
    if (patch.fam !== 'basic' && _floorLockWhy(patch.fam, _fpk.col[patch.fam] || '')) _fpk.col[patch.fam] = '';   // 마지막 색이 그 새 잠겼으면 기본색
  }
  if (patch.basic !== undefined) _fpk.basic = patch.basic;
  if (patch.rim !== undefined) _fpk.rim[_fpk.fam] = patch.rim;
  if (patch.col !== undefined) {
    const why = _floorLockWhy(_fpk.fam, patch.col);
    if (why) {   // 잠긴 색 — 칠하지 않는다. 견본만 그 색으로 어둡게 + 말풍선. 고른 것은 누르기 전 그대로
      _fpk.peek = { col: patch.col, why };
      _floorPickRender();
      const host = document.getElementById('if-floor-picker');
      const dot = host && host.querySelector('.pk-dot[data-col="' + patch.col + '"]');
      if (host) _pkBubble(host, dot, why);
      _fpk.peekT = setTimeout(() => _floorPickPeekEnd(true), 2500);
      return;
    }
    _fpk.col[_fpk.fam] = patch.col;
  }
  CUR_FLOOR_TILE = _floorPickValue();
  _floorPickRender();
}
function _floorPickPeekEnd(redraw) {
  if (_fpk.peekT) { clearTimeout(_fpk.peekT); _fpk.peekT = 0; }
  if (!_fpk.peek) return;
  _fpk.peek = null;
  const host = document.getElementById('if-floor-picker'); if (host) _pkBubble(host, null, '');
  if (redraw) _floorPickRender();
}
function _floorPickRender() {
  if (DECO_SCENE !== 'yard') return _inLookRender();   // [INDOOR-LOOK-1] 집 안이면 같은 판에 벽지·바닥
  const host = document.getElementById('if-floor-picker');
  if (!host || host.hidden) return;
  const colLab = host.querySelector('.fpk-row[data-row="cols"] .fpk-lab'); if (colLab) colLab.textContent = '색';   // 집 안의 '톤'을 되돌린다
  const wide = innerWidth >= 1200, small = innerWidth < 900;
  const fam = _fpk.fam, isBed = !!_FLOOR_EDGE_COLOR[fam], famRow = _FLOOR_FAMS.find(f => f[0] === fam);
  const peekV = _fpk.peek ? _floorJoin(fam, _fpk.peek.col, _fpk.rim[fam] || '') : '';
  const v = peekV || _floorPickValue();
  //  견본 180×112(좁으면 150×96) — 잔디 7×5 가운데 5×3 을 고른 조합으로
  const sw = host.querySelector('.fpk-side'), swW = small ? 150 : 180, swH = small ? 96 : 112;
  const caps = [_fpk.peek ? '🔒 아직 잠긴 색이에요' : DECO_FLOOR_TOOL === 'rect' ? '모서리에서 모서리로 끌어요' : '이렇게 칠해져요'];
  if (isBed && !_fpk.peek) caps.push('테두리는 저절로 둘러져요');
  _pkSwatch(sw, swW, swH, _floorBedDraw(v, 5, 3, 1), _floorPickName(v), caps, !!_fpk.peek);
  //  [DECO-FLOOR-RECT-1] 도구 토글 — 폭 1200 이상은 가족 칩 줄 맨 앞(가는 세로줄로 가름), 미만은 견본 아래
  const seg = _pkSeg([['drag', '✏️ 끌어서'], ['rect', '⬛ 네모로']], DECO_FLOOR_TOOL, t => decoFloorTool(t), '칠하는 도구');
  const slot = host.querySelector('.fpk-tool');
  if (slot) { slot.textContent = ''; slot.hidden = !wide; if (wide) slot.appendChild(seg); }
  if (!wide || !slot) sw.appendChild(seg);
  const keepX = {};
  host.querySelectorAll('.fpk-scroll').forEach(el => { keepX[el.dataset.row] = el.scrollLeft; });
  const row = (name, items) => {
    const r = host.querySelector('.fpk-row[data-row="' + name + '"]'); if (!r) return;
    r.hidden = !items; if (!items) return;
    const sc = r.querySelector('.fpk-scroll'); sc.textContent = ''; items.forEach(el => sc.appendChild(el));
    if (keepX[name]) sc.scrollLeft = keepX[name];
  };
  //  1줄: 가족 칩(그림 = 3×2 꽃밭 + 자연 가장자리 · 기본 칩은 벽돌)
  const cw = wide ? 52 : 54, ch = wide ? 34 : 40;
  row('fams', [['basic', '기본', 'brick']].concat(_FLOOR_FAMS.map(f => [f[0], f[1], f[0]])).map(([id, name, pic]) =>
    _pkChip(name, cw, ch, _floorBedDraw(pic, 3, 2, 0.35), fam === id, () => _floorPickTap({ fam: id }))));
  if (fam === 'basic') {
    row('cols', null); row('rims', null);
    row('basics', _FLOOR_BASIC.map(([id, lab]) => _pkTile(lab, 40, _floorCellDraw(id), _fpk.basic === id, () => _floorPickTap({ basic: id }))));
  } else {
    row('basics', null);
    //  2줄: 색 — 기본 색 먼저 · 열린 색 · 잠긴 색은 뒤로
    const cur = _fpk.col[fam] || '', all = [''].concat(_FLOOR_COLORS[fam] || []);
    const open = all.filter(c => !_floorLockWhy(fam, c)), shut = all.filter(c => _floorLockWhy(fam, c));
    row('cols', open.concat(shut).map(c => {
      const shutC = shut.indexOf(c) >= 0, name = (_FLOOR_COLOR_KO[c || (famRow && famRow[2])] || '기본') + ' ' + (famRow ? famRow[1] : '');
      const b = _pkDot(name, 40, _floorCellDraw(_floorJoin(fam, c, '')), cur === c, shutC, () => _floorPickTap({ col: c }));
      b.dataset.col = c; return b;
    }));
    //  3줄: 테두리(꽃밭 무리만 — 들꽃은 없다)
    row('rims', isBed ? _FLOOR_RIM_ORDER.map(([id, lab]) => _pkChip(lab, 40, 40, _floorCornerDraw(_floorJoin(fam, cur, id)),
      (_fpk.rim[fam] || '') === id, () => _floorPickTap({ rim: id }), 'pk-rim')) : null);
  }
}
//  그림이 늦게 오면 판만 다시 칠한다(단추는 그대로 — 누르는 도중에 단추가 바뀌면 눌림이 사라진다). 몰려와도 한 번.
function _floorPickSoon(rebuild) {
  const host = document.getElementById('if-floor-picker');
  if (!host || host.hidden || _fpk.soon) return;
  _fpk.soon = setTimeout(() => { _fpk.soon = 0; if (rebuild) _floorPickRender(); else host.querySelectorAll('canvas').forEach(_pkPaint); }, 80);
}
function _floorPickShow(on) {
  const host = document.getElementById('if-floor-picker'); if (!host) return;
  if (!on) { _floorPickPeekEnd(false); host.hidden = true; return; }
  host.hidden = false;
  if (DECO_SCENE !== 'yard') { _inLookShow(); return; }   // [INDOOR-LOOK-1]
  _floorPickRead(CUR_FLOOR_TILE);
  _floorPickRender();
}
if (typeof window !== 'undefined') {
  addEventListener('resize', () => { if (DECO_MODE === 'floor') _floorPickSoon(true); });   // 폭 1200·900 에서 칩·견본 크기가 바뀐다
  //  말풍선은 다른 곳을 누르면 닫힌다(고른 것은 그대로). 판 안 단추는 제 click 에서 닫는다(여기서 다시 그리면 그 click 이 사라진다)
  addEventListener('pointerdown', e => { if (_fpk.peek && !(e.target.closest && e.target.closest('#if-floor-picker'))) _floorPickPeekEnd(true); }, true);
}

// ══ 집 안 벽지·바닥 고르기 (INDOOR-LOOK-1 · IN-2) ══════════════
//  규칙 원본: docs/indoor_look_rules_20260920.md §3 · 저장: docs/indoor_rooms_proposal_20260920.md (나)
//  · 저장은 새 필드 하나 — `indoor["<공간>"].look = "바닥,벽지"`, 각 값은 마당 바닥과 같은 `이름#색`(기본색이면 `#` 없음).
//    배열이 아니라 객체 맵이라 `_normalizeArrays` 를 안 탄다 · 옛 JS 는 모르는 필드를 `...s` 로 싣고 통째 저장에 그대로 내보낸다.
//  · **고르지 않은 집 안은 지금 그림 그대로**(`tile_indoor_wood` + `wall_floral` — 파일 이름까지 같다 = 한 픽셀도 안 바뀐다).
//    보통 마루·꽃무늬를 다시 고르면 저장값에서 그 칸을 비운다(둘 다 기본이면 필드째 지운다) — '고르기 전'과 같은 글자가 되게.
//  · 표에 없는 이름·색은 조용히 기본으로(마당 `_floorParse` 와 같은 태도).
//  · 방이 없는 지금은 판 어디를 눌러도 큰 방 하나가 바뀐다(방 만들기 IN-3 은 아직).
const INDOOR_WALLS = [['plain', '민무늬', []], ['stripe', '줄무늬', []], ['floral', '꽃무늬', []],
  ['star', '별무늬', ['sky', 'night', 'pink']], ['gingham', '체크', ['blue', 'green', 'yellow']],
  ['wood', '나무 판벽', ['light', 'dark', 'white']], ['tile', '타일 벽', ['mint', 'sky', 'pink']], ['brick', '벽돌 벽', ['white', 'gray']]];
const INDOOR_FLOORS = [['plank', '마루', ['light', 'dark']], ['tile', '타일', ['white', 'sky', 'terra']],
  ['check', '체크 타일', ['mint', 'pink', 'blue']], ['carpet', '카펫', ['blue', 'pink', 'green']]];
//  색 이름 — '' 는 그 그림 파일의 기본색(파일마다 다르다)
const _IN_COLOR_KO = { sky: '하늘', night: '밤', pink: '분홍', blue: '파랑', green: '초록', yellow: '노랑', light: '밝은', dark: '짙은',
  white: '흰', mint: '민트', gray: '회색', terra: '벽돌빛' };
const _IN_BASE_KO = { wall: { star: '크림', gingham: '다홍', wood: '나무', tile: '아이보리', brick: '붉은' },
  floor: { plank: '보통', tile: '베이지', check: '밤색', carpet: '베이지' } };
const _inTable = kind => kind === 'wall' ? INDOOR_WALLS : INDOOR_FLOORS;
//  한 쪽 값 'star#sky' → { name, color } · 못 읽으면 null(= 기본)
function _inPartParse(kind, v) {
  const m = /^([a-z]+)(?:#([a-z]+))?$/.exec(String(v || ''));
  if (!m) return null;
  const row = _inTable(kind).find(x => x[0] === m[1]);
  if (!row) return null;
  return { name: row[0], color: (m[2] && row[2].indexOf(m[2]) >= 0) ? m[2] : '' };
}
//  기본(보통 마루·꽃무늬)이면 '' — 저장값에서 그 칸을 비운다
function _inPartJoin(kind, p) {
  if (!p || (kind === 'floor' ? p.name === 'plank' : p.name === 'floral') && !p.color) return '';
  return p.name + (p.color ? '#' + p.color : '');
}
function _inLookParse(v) {
  const a = String(v || '').split(',');
  return { floor: _inPartParse('floor', a[0]), wall: _inPartParse('wall', a[1]) };
}
function _inLookJoin(floor, wall) {
  const f = _inPartJoin('floor', floor), w = _inPartJoin('wall', wall);
  return (f || w) ? f + ',' + w : '';
}
//  그 공간의 look 글자(없으면 '') — 읽기만, 필드를 만들지 않는다
function _inLookGet(student, sp) {
  const m = student && student.indoor, e = m && m[sp || DECO_SPACE];
  return (e && typeof e.look === 'string') ? e.look : '';
}
//  쓰기 — '' 면 지우고, 빈 것이 남으면 필드째 지운다(Firebase 는 빈 객체를 어차피 지운다)
function _inLookSet(student, v, sp) {
  sp = sp || DECO_SPACE;
  if (v) {
    student.indoor = (student.indoor && typeof student.indoor === 'object') ? student.indoor : {};
    const e = (student.indoor[sp] && typeof student.indoor[sp] === 'object') ? student.indoor[sp] : (student.indoor[sp] = {});
    e.look = v;
    return;
  }
  const m = student.indoor, e = m && m[sp];
  if (!e || typeof e !== 'object') return;
  delete e.look;
  if (!Object.keys(e).length) delete m[sp];
  if (!Object.keys(m).some(k => m[k] != null)) delete student.indoor;
}
//  그릴 그림 파일 — 고르지 않았으면 지금 그림(옛 파일 이름 그대로)
function _inLookArt(kind, p) {
  if (kind === 'floor') return (p && !(p.name === 'plank' && !p.color)) ? ['tile_in_' + p.name, p.color] : ['tile_indoor_wood', ''];
  return (p && !(p.name === 'floral' && !p.color)) ? ['wall_' + p.name, p.color] : ['wall_floral', ''];
}
function _inPartName(kind, p) {
  const row = _inTable(kind).find(x => x[0] === (p ? p.name : (kind === 'floor' ? 'plank' : 'floral')));
  if (!row) return '';
  if (!row[2].length) return row[1];
  const c = p && p.color ? _IN_COLOR_KO[p.color] : (_IN_BASE_KO[kind][row[0]] || '');
  return (c ? c + ' ' : '') + row[1];
}

// ══ 집 안 방 만들기 (INDOOR-ROOMS-1 · IN-3) ══════════════════
//  제안서 (나) 네모로 끌어 방 만들기 · 겉모습 규칙 docs/indoor_look_rules_20260920.md §1·§2.
//  · 저장: indoor["<공간>"].rooms = { "a": "r,c,w,h,바닥,벽지" } — 객체 맵 + 짧은 문자열(방 하나 ≈ 28B). 문은 저절로 나서 저장 0.
//  · 좌표·판(50×28)은 그대로 — 있는 가구는 한 칸도 안 움직인다. 방이 하나도 없으면 **지금 큰 방 그대로**(한 픽셀도 안 바뀐다).
//  · 방이 생기면 방 밖은 '빈 터'(INDOOR_OUTSIDE — 확정 'blueprint' 어두운 도면). 가구는 방 안·빈 터 어디나 놓인다(막다른 길 0).
//  · 방의 벽 띠 = 방 윗줄 바로 위 한 줄(그 줄의 벽걸이는 거기 걸린다). 방끼리는 벽 띠 줄까지 안 겹친다.
//  · 못 읽는 값·판 밖·겹치는 방은 조용히 버린다(읽는 쪽에서) — 저장본이 무엇이든 그리기가 깨지지 않게.
const INDOOR_OUTSIDE = 'blueprint';   // 'blueprint' | 'oldfloor' | 'concrete' — 지금은 'blueprint' 만 그린다(나머지는 스위치 자리)
const ROOM_MIN = [4, 3], ROOM_MAX = [20, 12], ROOM_MAX_N = 8, ROOM_IDS = 'abcdefghijklmnop';
const ROOM_SIZES = [['작은 방', 6, 4], ['보통 방', 9, 5], ['큰 방', 13, 7]];
function _inRoomOverlap(a, b) {   // 벽 띠 줄(r-1)까지 방의 몫
  return a.r - 1 <= b.r + b.h - 1 && b.r - 1 <= a.r + a.h - 1 && a.c <= b.c + b.w - 1 && b.c <= a.c + a.w - 1;
}
//  그 공간의 방들 [{id,r,c,w,h,floor,wall}] — 한 번 읽은 글자는 기억(칸마다·그릴 때마다 불린다)
function _inRooms(student, sp) {
  const m = student && student.indoor, e = m && m[sp || DECO_SPACE], raw = e && e.rooms;
  if (!raw || typeof raw !== 'object') return [];
  const key = JSON.stringify(raw), M = _inRooms._m || (_inRooms._m = new Map());
  if (M.has(key)) return M.get(key);
  const out = [];
  Object.keys(raw).sort().forEach(id => {
    const a = String(raw[id] || '').split(','), n = a.slice(0, 4).map(x => parseInt(x, 10));
    if (n.some(x => !isFinite(x))) return;
    const rm = { id, r: n[0], c: n[1], w: n[2], h: n[3], floor: _inPartParse('floor', a[4]), wall: _inPartParse('wall', a[5]) };
    if (rm.r < 0 || rm.c < 0 || rm.r + rm.h > DI_FULL.rows || rm.c + rm.w > DI_FULL.cols) return;
    if (rm.w < ROOM_MIN[0] || rm.h < ROOM_MIN[1] || rm.w > ROOM_MAX[0] || rm.h > ROOM_MAX[1]) return;
    if (out.length >= ROOM_MAX_N || out.some(o => _inRoomOverlap(o, rm))) return;
    out.push(Object.freeze(rm));
  });
  if (M.size > 50) M.clear();
  M.set(key, out);
  return out;
}
function _inRoomStr(rm) { return [rm.r, rm.c, rm.w, rm.h, _inPartJoin('floor', rm.floor), _inPartJoin('wall', rm.wall)].join(','); }
//  쓰기 — 빈 방 목록이면 rooms 를 지우고, 빈 것이 남으면 필드째 지운다
function _inRoomsSet(student, list, sp) {
  sp = sp || DECO_SPACE;
  if (list && list.length) {
    student.indoor = (student.indoor && typeof student.indoor === 'object') ? student.indoor : {};
    const e = (student.indoor[sp] && typeof student.indoor[sp] === 'object') ? student.indoor[sp] : (student.indoor[sp] = {});
    e.rooms = {}; list.forEach(rm => { e.rooms[rm.id] = _inRoomStr(rm); });
    return;
  }
  const m = student.indoor, e = m && m[sp];
  if (!e || typeof e !== 'object') return;
  delete e.rooms;
  if (!Object.keys(e).length) delete m[sp];
  if (!Object.keys(m).some(k => m[k] != null)) delete student.indoor;
}
//  (r,c) 가 어느 방 안(band=false)·어느 방 벽 띠(band=true)인가
function _inRoomAt(r, c, student) {
  for (const rm of _inRooms(student || CUR)) {
    if (c < rm.c || c >= rm.c + rm.w) continue;
    if (r >= rm.r && r < rm.r + rm.h) return { rm, band: false };
    if (r === rm.r - 1) return { rm, band: true };
  }
  return null;
}
//  벽걸이가 걸리는 줄인가 — 판 맨 윗줄(큰 방의 벽) 또는 어느 방의 윗줄
function _inIsWallRow(r, c) { if (r === 0) return true; const h = _inRoomAt(r, c); return !!(h && !h.band && h.rm.r === r); }
//  [DECO-RULE-R3] (r,c,w,h) 가 방 벽을 가로지르나 — 칸마다 '어느 방 안인가'(벽 띠·빈 터는 '밖')가 하나여야 한다.
//  반은 방 안·반은 빈 터(또는 옆 방)면 벽이 가구를 가른다.
function _inCrossesWall(r, c, w, h, rooms) {
  if (!rooms.length) return false;
  let zone = null;
  for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) {
    const rr = r + dr, cc = c + dc;
    const rm = rooms.find(o => rr >= o.r && rr < o.r + o.h && cc >= o.c && cc < o.c + o.w);
    const z = rm ? rm.id : '-';
    if (zone === null) zone = z; else if (z !== zone) return true;
  }
  return false;
}
//  새 방을 놓아도 되나 — 안 되면 아이 말
function _inRoomWhy(rooms, nr, skipId) {
  if (nr.w < ROOM_MIN[0] || nr.h < ROOM_MIN[1]) return `방은 가로 ${ROOM_MIN[0]}칸 · 세로 ${ROOM_MIN[1]}칸보다 커야 해요`;
  if (nr.w > ROOM_MAX[0] || nr.h > ROOM_MAX[1]) return `방은 가로 ${ROOM_MAX[0]}칸 · 세로 ${ROOM_MAX[1]}칸까지예요`;
  const others = rooms.filter(o => o.id !== skipId);
  if (others.length >= ROOM_MAX_N) return `방은 ${ROOM_MAX_N}개까지 만들 수 있어요`;
  if (others.some(o => _inRoomOverlap(o, nr))) return '다른 방과 겹쳐요 — 방 사이에 벽 한 줄이 필요해요';
  //  [DECO-RULE-R3] 벽이 이미 놓인 가구를 가르면 — 가구를 옮기지 않는다(아이 것은 그 자리) · 네모를 옮기게 말한다
  const next = others.concat([Object.assign({ id: '~' }, nr)]);
  const cut = _decoList(CUR).find(p => p.area === 'indoor' && !_isWallDeco(p.id)
    && _inCrossesWall(p.row, p.col, getDecoSize(p.id).w, getDecoSize(p.id).h, next));
  if (cut) { const d = GAME_DATA.decorations.find(x => x.id === cut.id); return `벽이 ${d ? d.icon + ' ' + d.name : '가구'}${_josa(d ? d.name : '가구', '을', '를')} 가르게 돼요 — 네모를 조금 옮겨 보세요`; }
  return '';
}
//  네모(r0,c0)~(r1,c1) → 판 안으로 자른 방(맨 윗줄은 벽 띠가 들어갈 자리가 필요 없다 — 판 위 여백이 벽이다)
function _inRoomFrom(r0, c0, r1, c1) {
  const r = Math.max(0, Math.min(r0, r1)), c = Math.max(0, Math.min(c0, c1));
  return { r, c, w: Math.min(DI_FULL.cols, Math.max(c0, c1) + 1) - c, h: Math.min(DI_FULL.rows, Math.max(r0, r1) + 1) - r };
}
//  저절로 난 문 — 옆으로 맞닿은 두 방의 벽 가운데 2줄 [{x 칸 경계, r0, r1}]
function _inRoomDoors(rooms) {
  const out = [];
  rooms.forEach(a => rooms.forEach(b => {
    if (a === b || a.c + a.w !== b.c) return;
    const top = Math.max(a.r, b.r), bot = Math.min(a.r + a.h, b.r + b.h);
    if (bot - top < 2) return;
    const mid = Math.floor((top + bot) / 2);
    out.push({ col: b.c, r0: mid - 1, r1: mid + 1 });
  }));
  return out;
}
//  방 목록을 바꾸고 ↩ 한 단계로 적는다
function _inRoomsCommit(list, msg) {
  const prev = JSON.stringify(_inRooms(CUR)), next = JSON.stringify(list);
  if (prev === next) return false;
  _inRoomsSet(CUR, list);
  //  [DECO-RULE-R4] 방이 없어져 **벽이 사라진 벽걸이**는 가방으로 — 액자가 빈 바닥 한가운데 서 있지 않게.
  //  (벽걸이 규칙 `_decoRuleWhy` 로는 이미 '안 되는 자리'다.) 같은 ↩ 한 단계에 담아, 되돌리면 방과 액자가 같이 돌아온다.
  const bag = _decoList(CUR).filter(p => p.area === 'indoor' && _isWallDeco(p.id) && !_inIsWallRow(p.row, p.col));
  if (bag.length) CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => bag.indexOf(p) < 0);
  _decoUndoPush({ t: 'rooms', sp: DECO_SPACE, prev, next, bag: bag.map(p => Object.assign({}, p)) });
  decoDirty(); _drawDeco(); renderDecoInv(); _inLookRender();
  if (bag.length) {
    const d = GAME_DATA.decorations.find(x => x.id === bag[0].id), nm = d ? d.icon + ' ' + d.name : '벽걸이';
    msg = (msg || '').replace(/ \(↩ 되돌리기\)$/, '') + ` · 🎒 벽에 걸려 있던 ${nm}${bag.length > 1 ? ' 등 ' + bag.length + '개' : ''}${_josa(d ? d.name : '벽걸이', '은', '는')} 가방으로 (↩ 되돌리기)`;
  }
  if (msg) toast(msg);
  return true;
}
function _inRoomAdd(nr) {
  const rooms = _inRooms(CUR), why = _inRoomWhy(rooms, nr);
  if (why) { toast('🧱 ' + why); return false; }
  const id = ROOM_IDS.split('').find(x => !rooms.some(o => o.id === x));
  const first = !rooms.length;
  _inRoomsCommit(rooms.concat([Object.assign({ id, floor: null, wall: null }, nr)]),
    `🧱 ${nr.w} × ${nr.h} 방이 생겼어요${first ? ' — 방 밖은 빈 터예요(가구는 어디나 놓여요)' : ''} (↩ 되돌리기)`);
  return true;
}
//  가구 둘레로 첫 방 — 이미 가구가 있는 아이가 '내 가구가 밖에 버려진' 느낌 없이 시작하게
function _inRoomAroundFurniture() {
  const list = _decoList(CUR).filter(p => p.area === 'indoor');
  if (!list.length) { toast('🪑 집 안에 가구가 아직 없어요 — 크기를 고르거나 네모로 끌어 보세요'); return; }
  let r0 = 99, c0 = 99, r1 = -1, c1 = -1;
  list.forEach(p => { const z = getDecoSize(p.id); r0 = Math.min(r0, p.row); c0 = Math.min(c0, p.col); r1 = Math.max(r1, p.row + z.h - 1); c1 = Math.max(c1, p.col + z.w - 1); });
  const nr = _inRoomFrom(r0 - 1, c0 - 1, Math.max(r1 + 1, r0 - 1 + ROOM_MIN[1] - 1), Math.max(c1 + 1, c0 - 1 + ROOM_MIN[0] - 1));
  if (nr.w > ROOM_MAX[0] || nr.h > ROOM_MAX[1]) { toast(`🪑 가구가 너무 넓게 퍼져 있어요 — 방은 ${ROOM_MAX[0]} × ${ROOM_MAX[1]}칸까지라, 네모로 끌어 나눠 만들어 보세요`); return; }
  _inRoomAdd(nr);
}
//  네모 끄는 동안 미리 보기(그리기는 _drawIndoor 가 · 아래 글은 마당 네모로와 같은 자리)
let _inRoomPrev = null;
function _inRoomPrevSet(p) {
  _inRoomPrev = p;
  const host = document.getElementById('if-topview'); if (!host) return;
  let el = document.getElementById('if-rect-tip');
  if (!p) { if (el) el.hidden = true; _drawDeco(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'if-rect-tip'; el.className = 'deco-rect-tip'; el.setAttribute('role', 'status'); host.appendChild(el); }
  el.hidden = false;
  el.classList.toggle('is-capped', !!p.why);
  el.textContent = p.why ? `${p.w} × ${p.h}칸 · ${p.why}` : `${p.w} × ${p.h}칸 — 손을 떼면 방이 돼요 · 잘못하면 ↩`;
  _drawDeco();
}
//  방 둘레에 맞춰 보기(열 때·'전체') — 방이 없으면 false
function _inFitRooms() {
  const rooms = _inRooms(CUR);
  if (DECO_SCENE === 'yard' || !rooms.length || !_dCv) return false;
  let r0 = 99, c0 = 99, r1 = -1, c1 = -1;
  rooms.forEach(rm => { r0 = Math.min(r0, rm.r - 1); c0 = Math.min(c0, rm.c); r1 = Math.max(r1, rm.r + rm.h); c1 = Math.max(c1, rm.c + rm.w); });
  const bw = c1 - c0 + 1, bh = r1 - r0 + 1, C0 = Math.floor(_dW / DI.cols);
  const z = Math.max(DECO_ZOOM_MIN, Math.min(DECO_ZOOM_MAX, Math.min(_dW / (bw * C0), _dH / (bh * C0)) * 0.95));
  _dZoom = z; _initDeco();
  const C = _dC, offX = Math.max(0, Math.floor((_dW - DI.cols * C) / 2)), offY = Math.max(Math.floor(C * .9), Math.floor((_dH - DI.rows * C) / 2));
  _dPanX = offX + c0 * C - Math.max(0, (_dW - bw * C) / 2);
  _dPanY = offY + r0 * C - Math.max(0, (_dH - bh * C) / 2);
  _decoClampPan(); _drawDeco();
  return true;
}
//  집 안에 들어올 때 — 방이 있으면 방 둘레로, 없으면 지금처럼(폰은 크게)
function _decoIndoorStart() { if (!_inFitRooms()) _decoPhoneStart(); }

//  방 누르기(🖌️ 벽지·바닥 판이 열려 있을 때)
function _inTap(r, c) {
  const kind = _inPk.tab, hit = _inRoomAt(r, c), rooms = _inRooms(CUR);
  if (kind === 'room') {
    if (_inPk.tool === 'erase') {
      if (!hit) { toast('🗑️ 없앨 방을 눌러 주세요'); return; }
      _inRoomsCommit(rooms.filter(o => o.id !== hit.rm.id), '🗑️ 방을 없앴어요 — 가구는 그 자리에 그대로예요 (↩ 되돌리기)');
      return;
    }
    const sz = ROOM_SIZES[_inPk.tool === 's1' ? 1 : _inPk.tool === 's2' ? 2 : _inPk.tool === 's0' ? 0 : -1];
    if (!sz) { toast('⬛ 빈 곳을 네모로 끌거나, 방 크기를 고르고 눌러 주세요'); return; }
    const rr = Math.max(0, r);
    _inRoomAdd(_inRoomFrom(rr, c, rr + sz[2] - 1, c + sz[1] - 1));
    return;
  }
  if (!rooms.length) { _inLookApply(); return; }   // 방이 없으면 큰 방(IN-2)
  if (!hit) { toast('방을 눌러 주세요 — 방 밖은 빈 터예요'); return; }
  const part = _inPk[kind], cur = hit.rm[kind];
  if (_inPartJoin(kind, part) === _inPartJoin(kind, cur)) { toast(kind === 'wall' ? '🧱 이미 이 벽지예요' : '🟫 이미 이 바닥이에요'); return; }
  _inRoomsCommit(rooms.map(o => o.id === hit.rm.id ? Object.assign({}, o, { [kind]: part }) : o),
    (kind === 'wall' ? '🧱 벽지가' : '🟫 바닥이') + ' 바뀌었어요 — ' + _inPartName(kind, part) + ' · 이 방만 (↩ 되돌리기)');
}

// ── 고르기 판 — 마당 바닥 고르기와 같은 판(#if-floor-picker)·같은 조각(_pk*) ──
//  붓 = 탭마다 고른 것(미리 보기). 판(방)을 누르면 지금 탭 쪽만 그 방에 바뀐다.
const _inPk = { tab: 'wall', wall: null, floor: null, tool: '' };   // tool = [INDOOR-ROOMS-1] 's0'·'s1'·'s2'(크기 칩) · 'erase'(방 없애기) · ''(네모 끌기)
//  작은 방 그림: 위 한 줄 벽 띠(벽지 + 걸레받이) · 아래 floorRows 줄 바닥 · 벽에 액자(있으면)
function _inRoomDraw(wall, floor, floorRows, frame) {
  return (ctx, W, H) => {
    const rows = 1 + floorRows, C = H / rows, cols = Math.ceil(W / C);
    const [fa, fc] = _inLookArt('floor', floor), [wa, wc] = _inLookArt('wall', wall);
    const fi = _floorImg(fa, fc), wi = _floorImg(wa, wc), bb = _floorImg('wall_baseboard');
    ctx.fillStyle = '#C4955A'; ctx.fillRect(0, C, W, H - C);
    ctx.fillStyle = '#8B6520'; ctx.fillRect(0, 0, W, C);
    for (let c = 0; c < cols; c++) {
      if (wi) ctx.drawImage(wi, c * C, 0, C, C);
      if (bb) ctx.drawImage(bb, c * C, 0, C, C);
      if (fi) for (let r = 1; r < rows; r++) ctx.drawImage(fi, c * C, r * C, C, C);
    }
    const fr = frame && _decoImg('d_i4_wall');
    if (fr) ctx.drawImage(fr, Math.floor(cols / 2) * C, 0, C, C);
  };
}
//  칩·동그라미 그림: 그 벽지(걸레받이까지) 또는 그 바닥을 rows 줄로 채운다
function _inTileDraw(kind, part, rows) {
  return (ctx, W, H) => {
    const C = H / rows, cols = Math.ceil(W / C), [a, c] = _inLookArt(kind, part);
    const im = _floorImg(a, c), bb = kind === 'wall' ? _floorImg('wall_baseboard') : null;
    ctx.fillStyle = kind === 'wall' ? '#8B6520' : '#C4955A'; ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < rows; r++) for (let x = 0; x < cols; x++) {
      if (im) ctx.drawImage(im, x * C, r * C, C, C);
      if (bb) ctx.drawImage(bb, x * C, r * C, C, C);
    }
  };
}
function _inLookShow() {
  const cur = _inLookParse(_inLookGet(CUR));
  _inPk.wall = cur.wall; _inPk.floor = cur.floor;   // 거꾸로 읽기 — 지금 방의 것을 고른 상태로
  _inLookRender();
}
function _inLookRender() {
  const host = document.getElementById('if-floor-picker');
  if (!host || host.hidden) return;
  _decoHandSync();   // [INDOOR-ROOMS-1] 탭·크기 칩이 바뀌면 한 손가락 끌기가 '네모'↔'화면 이동'으로 바뀐다 → ✋ 도 따라간다
  const wide = innerWidth >= 1200, small = innerWidth < 900, kind = _inPk.tab;
  if (kind === 'room') return _inRoomRender(host, wide, small);   // [INDOOR-ROOMS-1]
  const saved = _inLookParse(_inLookGet(CUR));
  const wall = kind === 'wall' ? _inPk.wall : saved.wall, floor = kind === 'floor' ? _inPk.floor : saved.floor;
  //  견본 — 고른 쪽은 붓, 다른 쪽은 지금 방의 것
  const sw = host.querySelector('.fpk-side');
  _pkSwatch(sw, small ? 150 : 180, small ? 96 : 112, _inRoomDraw(wall, floor, 3, true), _inPartName(kind, _inPk[kind]), ['방을 누르면 이렇게 바뀌어요']);
  const seg = _inSeg(kind);
  const slot = host.querySelector('.fpk-tool');
  if (slot) { slot.textContent = ''; slot.hidden = !wide; if (wide) slot.appendChild(seg); }
  if (!wide || !slot) sw.appendChild(seg);
  const row = (name, items, lab) => {
    const r = host.querySelector('.fpk-row[data-row="' + name + '"]'); if (!r) return;
    r.hidden = !items; if (!items) return;
    const l = r.querySelector('.fpk-lab'); if (l && lab) l.textContent = lab;
    const sc = r.querySelector('.fpk-scroll'); sc.textContent = ''; items.forEach(el => sc.appendChild(el));
  };
  row('rims', null); row('basics', null);
  const pick = _inPk[kind], pickName = pick ? pick.name : (kind === 'floor' ? 'plank' : 'floral');
  const cw = wide ? 52 : 54, ch = wide ? 34 : 40;
  //  1줄: 종류 칩 — 벽지 = 벽 띠 조각 + 걸레받이 · 바닥 = 바닥 두 줄
  row('fams', _inTable(kind).map(([id, lab]) => _pkChip(lab, cw, ch,
    _inTileDraw(kind, { name: id, color: '' }, kind === 'wall' ? 1 : 2),
    pickName === id, () => { _inPk[kind] = { name: id, color: (_inPk[kind] && _inPk[kind].name === id) ? _inPk[kind].color : '' }; _inLookRender(); })));
  //  2줄: 색(마루는 '톤') — 동그라미 44px + 아래 이름 10px(벽지 색은 그림만으로 헷갈린다) · 색이 없는 종류는 줄을 감춘다
  const tRow = _inTable(kind).find(x => x[0] === pickName), cols = tRow ? tRow[2] : [];
  if (!cols.length) { row('cols', null); return; }
  const order = pickName === 'plank' ? ['light', '', 'dark'] : [''].concat(cols);
  row('cols', order.map(c => {
    const part = { name: pickName, color: c }, name = _inPartName(kind, part);
    const w = document.createElement('div'); w.className = 'pk-dotn';
    const dot = _pkDot(name, 40, _inTileDraw(kind, part, 1), (pick ? pick.color : '') === c, false, () => { _inPk[kind] = part; _inLookRender(); });
    dot.dataset.col = c;
    const t = document.createElement('span'); t.textContent = (c ? _IN_COLOR_KO[c] : (_IN_BASE_KO[kind][pickName] || '기본'));
    w.appendChild(dot); w.appendChild(t);
    return w;
  }), pickName === 'plank' ? '톤' : '색');
}
//  [INDOOR-ROOMS-1] 탭 셋 — 벽지 · 바닥 · 방 만들기
function _inSeg(kind) {
  return _pkSeg([['wall', '🧱 벽지'], ['floor', '🟫 바닥'], ['room', '⬛ 방']], kind, t => { _inPk.tab = t; _inRoomPrevSet(null); _inLookRender(); }, '무엇을 할까');
}
//  방 탭: 견본 = 도면 위의 방 · 크기 칩 셋 + (가구 둘레로) + 방 없애기
function _inRoomDrawSmall(w, h) {
  return (ctx, W, H) => {
    ctx.fillStyle = '#161b28'; ctx.fillRect(0, 0, W, H);
    const C = Math.min(W / (w + 2), H / (h + 2.2)), ox = (W - w * C) / 2, oy = (H - (h + 1) * C) / 2 + C;
    ctx.strokeStyle = 'rgba(140,170,220,.18)'; ctx.lineWidth = .5;
    for (let x = ox % C; x < W; x += C) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = oy % C; y < H; y += C) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const fi = _floorImg('tile_indoor_wood'), wi = _floorImg('wall_floral'), bb = _floorImg('wall_baseboard');
    ctx.fillStyle = '#C4955A'; ctx.fillRect(ox, oy, w * C, h * C);
    for (let c = 0; c < w; c++) {
      if (wi) ctx.drawImage(wi, ox + c * C, oy - C, C, C);
      if (bb) ctx.drawImage(bb, ox + c * C, oy - C, C, C);
      if (fi) for (let r = 0; r < h; r++) ctx.drawImage(fi, ox + c * C, oy + r * C, C, C);
    }
    const t = Math.max(2, C * .16);
    ctx.fillStyle = '#5b3a20';
    ctx.fillRect(ox - t / 2, oy - C - t / 2, w * C + t, t); ctx.fillRect(ox - t / 2, oy - C, t, (h + 1) * C);
    ctx.fillRect(ox + w * C - t / 2, oy - C, t, (h + 1) * C); ctx.fillRect(ox - t / 2, oy + h * C - t / 2, w * C + t, t);
  };
}
function _inRoomRender(host, wide, small) {
  const rooms = _inRooms(CUR), tool = _inPk.tool;
  const sw = host.querySelector('.fpk-side');
  const caps = tool === 'erase' ? ['없앨 방을 눌러요', '가구는 그 자리에 남아요']
    : tool ? ['빈 곳을 누르면 그 자리에 놓여요', '방끼리 붙이면 문이 저절로 나요'] : ['빈 곳을 네모로 끌면 방이 돼요', '방끼리 붙이면 문이 저절로 나요'];
  const szI = tool === 's0' ? 0 : tool === 's1' ? 1 : tool === 's2' ? 2 : 1;
  _pkSwatch(sw, small ? 150 : 180, small ? 96 : 112, _inRoomDrawSmall(ROOM_SIZES[szI][1], ROOM_SIZES[szI][2]),
    tool === 'erase' ? '🗑️ 방 없애기' : tool ? ROOM_SIZES[szI][0] + ' ' + ROOM_SIZES[szI][1] + '×' + ROOM_SIZES[szI][2] : '⬛ 네모로 방 만들기', caps);
  const seg = _inSeg('room'), slot = host.querySelector('.fpk-tool');
  if (slot) { slot.textContent = ''; slot.hidden = !wide; if (wide) slot.appendChild(seg); }
  if (!wide || !slot) sw.appendChild(seg);
  ['cols', 'rims', 'basics'].forEach(n => { const r = host.querySelector('.fpk-row[data-row="' + n + '"]'); if (r) r.hidden = true; });
  const r = host.querySelector('.fpk-row[data-row="fams"]'); if (!r) return;
  r.hidden = false;
  const sc = r.querySelector('.fpk-scroll'); sc.textContent = '';
  const cw = wide ? 52 : 54, ch = wide ? 34 : 40, pickT = t => { _inPk.tool = _inPk.tool === t ? '' : t; _inLookRender(); };
  ROOM_SIZES.forEach(([lab, w, h], i) => sc.appendChild(_pkChip(lab, cw, ch, _inRoomDrawSmall(w, h), tool === 's' + i, () => pickT('s' + i))));
  if (!rooms.length && _decoList(CUR).some(p => p.area === 'indoor'))
    sc.appendChild(_pkButton('pk-chip', '가구 둘레로 첫 방 만들기', false, () => _inRoomAroundFurniture(), b => { b.textContent = '🪑 가구 둘레로'; }));
  if (rooms.length) sc.appendChild(_pkButton('pk-chip', '방 없애기', tool === 'erase', () => pickT('erase'), b => { b.textContent = '🗑️ 방 없애기'; }));
}
//  판을 누르면 — 지금 탭 쪽만 그 방에(방이 없으면 큰 방). 같으면 아무 일 없음 · ↩ 한 단계
function _inLookApply() {
  const kind = _inPk.tab, prev = _inLookGet(CUR), saved = _inLookParse(prev);
  const next = kind === 'wall' ? _inLookJoin(saved.floor, _inPk.wall) : _inLookJoin(_inPk.floor, saved.wall);
  if (next === prev) { toast(kind === 'wall' ? '🧱 이미 이 벽지예요' : '🟫 이미 이 바닥이에요'); return false; }
  _inLookSet(CUR, next);
  _decoUndoPush({ t: 'look', sp: DECO_SPACE, prev, next });
  decoDirty(); _drawDeco(); _inLookRender();
  toast((kind === 'wall' ? '🧱 벽지가' : '🟫 바닥이') + ' 바뀌었어요 — ' + _inPartName(kind, _inPk[kind]) + ' (↩ 되돌리기)');
  return true;
}

// 장식 크기 가져오기 (없으면 1x1)
function getDecoSize(decoId) {
  const d = GAME_DATA.decorations.find(x=>x.id===decoId);
  return d?.size || {w:1,h:1};
}

// 멀티셀 장식 충돌 체크
// ══ 꾸미기 공간 1~3 (DECO-SPACE-1) ═══════════════════════════════
//  선생님: "지금 꾸미기를 공간 1 이라 하고 공간 3 까지 줘도 돼. 공간 1 에서 쓴 것은 소모된 상태로
//  다른 공간에서 쓰는 거지." → 장식은 한 목록(houseDecorations)에 두고 **공간 번호(sp)만 붙인다.**
//  · 공간 1 은 지금 그대로(sp 없음 = 1) → **있는 꾸미기는 한 글자도 안 바뀐다.**
//  · 가진 개수는 **모든 공간을 합쳐** 센다(공간 1 에 놓은 것은 다른 공간에서 못 쓴다).
//  · 바닥은 공간 1 = yardFloor(그대로), 공간 2·3 = yardFloors["2"|"3"] (새 필드, 있을 때만).
//  · 농장은 공간 1 에만 있다(작물은 하나다). 친구가 구경 오면 공간 1 을 본다.
//  저장 형식은 **추가만**(sp · yardFloors) — 옛 판이 새 저장본을 읽어도 공간 1 은 그대로 열린다.
const DECO_SPACES = 3;
let DECO_SPACE = 1;
function _decoSpaceOf(p) { return (p && p.sp) || 1; }
function _decoList(student) {
  return ((student && student.houseDecorations) || []).filter(p => _decoSpaceOf(p) === DECO_SPACE);
}
function _decoNew(id, area, row, col) {
  const o = { id, area, row, col };
  if (DECO_SPACE !== 1) o.sp = DECO_SPACE;
  return o;
}
//  읽기용(없으면 빈 것 — 필드를 만들지 않는다)
function _yardFloorGet(student) {
  if (!student) return {};
  if (DECO_SPACE === 1) return student.yardFloor || {};
  return (student.yardFloors && student.yardFloors[DECO_SPACE]) || {};
}
//  쓰기용(없으면 만든다)
function _yardFloorMap(student) {
  if (DECO_SPACE === 1) { student.yardFloor = student.yardFloor || {}; return student.yardFloor; }
  student.yardFloors = student.yardFloors || {};
  student.yardFloors[DECO_SPACE] = student.yardFloors[DECO_SPACE] || {};
  return student.yardFloors[DECO_SPACE];
}

function decoSpaceSet(n) {
  n = Math.max(1, Math.min(DECO_SPACES, n | 0));
  if (n === DECO_SPACE) return;
  decoFlush('공간 바꿈');
  _decoUndoClear();
  _decoViewSave();
  DECO_SPACE = n;
  try { localStorage.setItem('rpg.deco.space', String(n)); } catch (e) {}
  _decoSpaceSync();
  _animStopAll();
  _dCv = null; _dCtx = null;
  renderHouseDeco();
  const used = _decoList(CUR).length;
  toast('🏡 공간 ' + n + (used ? '' : ' — 비어 있어요. 새로 꾸며 보세요!'));
}
function _decoSpaceSync() {
  for (let i = 1; i <= DECO_SPACES; i++) {
    const b = document.getElementById('if-space-' + i);
    if (b) { b.classList.toggle('is-on', i === DECO_SPACE); b.setAttribute('aria-pressed', String(i === DECO_SPACE)); }
  }
}

// [DECO-PT-2] 말이 되게 — 물 위에는 물에 사는 것·물가 것만, 벽에 거는 것은 벽(맨 윗줄)에만
//  (디자인2 플레이 시험: "연못 한가운데 나무가 자라!" · "그림 액자가 방바닥 한가운데 있어")
const DECO_WATER_OK = { d_y29: 1, d_y30: 1 };   // 갈대 묶음 · 징검돌 (+ 물을 좋아하는 동물은 동물 규칙이 본다)
//  [INDOOR-WALL-1] 벽걸이 — 괘종시계(d_i3)는 서 있는 시계라 뺐다(그림에 바닥 그림자 · docs/indoor_look_rules_20260920.md §4, 보스 승인).
//  벽걸이는 저장은 **0번 줄 그대로**, 그림만 한 칸 위 벽 띠에 그린다(`DECO_WALL_ART` 의 벽걸이 판 · 없으면 몸통을 띠에).
const DECO_WALL = { d_i4: 1 };                   // 그림 액자
const DECO_WALL_ART = { d_i4: 'd_i4_wall' };     // 벽 띠에 그릴 그림(assets/deco/<이름>.svg — 못·끈·벽 그림자까지 그린 판)
function _isWallDeco(id) { return !!DECO_WALL[id]; }
function _decoRuleWhy(id, area, r, c, w, h) {
  if (!id) return '';
  if (area === 'yard' && !(typeof ANIM_DECO !== 'undefined' && ANIM_DECO[id]) && !DECO_WATER_OK[id]) {
    const fl = _yardFloorGet(CUR);
    for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++)
      if (fl[(r + dr) + '_' + (c + dc)] === 'water') return '🌊 물 위에는 놓을 수 없어요 — 물가 풀밭에 놓아 보세요';
  }
  //  [DECO-RULE-R5] 동물을 키 큰 장식 바로 뒷줄(솟은 그림 밑)에 놓으면 지붕·나무 위에 선 것처럼 보인다
  if (area === 'yard' && typeof ANIM_DECO !== 'undefined' && ANIM_DECO[id]) {
    for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) {
      const t = _decoOverflowAt(CUR, r + dr, c + dc);
      if (t) { const d = GAME_DATA.decorations.find(x => x.id === t.id); return `${d ? d.icon + ' ' + d.name : '큰 장식'} 바로 뒤라 동물이 올라선 것처럼 보여요 — 앞쪽이나 옆에 놓아요`; }
    }
  }
  if (area === 'indoor' && DECO_WALL[id] && !_inIsWallRow(r, c)) return '🖼️ 벽에 거는 거예요 — 위쪽 벽(맨 윗줄이나 방의 윗벽)을 눌러 걸어 주세요';
  //  [DECO-RULE-R3] 가구가 방 벽을 가로지르면(반은 방 안·반은 밖) 안 놓는다
  if (area === 'indoor' && !DECO_WALL[id] && _inCrossesWall(r, c, w, h, _inRooms(CUR))) return '🧱 벽에 걸려요 — 방 안이나 밖에 다 들어가게 놓아 주세요';
  return '';
}

//  [DECO-PT-2] 우리(pen)와 동물은 서로 겹쳐도 된다 — 우리 안에 동물을 넣고, 동물이 있는 자리에 우리를 두른다
function _decoOverlapOk(placingId, other) {
  if (!placingId || !other) return false;
  const isAnim = id => typeof ANIM_DECO !== 'undefined' && !!ANIM_DECO[id];
  if (other.area === 'indoor' && _isRugDeco(placingId) !== _isRugDeco(other.id)) return true;   // [INDOOR-RUG-1] 깔개 ↔ 가구
  //  [INDOOR-WALL-1] 벽에 건 것 ↔ 그 앞 바닥의 가구 — 액자는 벽 띠에 걸려 있어 0번 줄 바닥 칸을 차지하지 않는다
  if (other.area === 'indoor' && _inIsWallRow(other.row, other.col) && _isWallDeco(placingId) !== _isWallDeco(other.id)) return true;   // [INDOOR-ROOMS-1] 방 윗줄도
  return (isAnim(placingId) && _isPenDeco(other.id)) || (_isPenDeco(placingId) && isAnim(other.id));
}
// [INDOOR-RUG-1] 깔개(러그) = 장식 표의 layer:'floor' — 그릴 때 먼저 그려지던 바로 그 표시다(_isFloorLayerDeco 와 같은 잣대 · id 목록을 따로 두지 않는다).
//  깔개와 가구는 한 칸에 같이 놓인다(깔개 위에 소파 · 소파 밑에 깔개). **깔개끼리·가구끼리는 지금처럼 안 겹친다.**
//  저장 형식 변경 0 — 같은 칸에 기록이 둘 생길 뿐이고, 옛 JS 도 러그를 먼저 그리니 같은 그림이 나온다.
function _isRugDeco(id) { return !!id && _isFloorLayerDeco({ id }); }
//  이 자리(r,c,w,h)에 placingId 를 못 놓게 막는 놓인 것 하나(없으면 null) — "여기엔 이미 ○○" 의 ○○ 를 바르게 말하려고
function _decoBlockerAt(r, c, w, h, area, placingId) {
  return _decoList(CUR).find(p => {
    if (p.area !== area || _decoOverlapOk(placingId, p)) return false;
    const ps = getDecoSize(p.id);
    return r < p.row + ps.h && r + h > p.row && c < p.col + ps.w && c + w > p.col;
  }) || null;
}

function canPlaceDeco(r, c, w, h, area, excludeId, placingId) {
  if (placingId === undefined) placingId = SEL_DECO;   // [DECO-PT-2] 무엇을 놓는지(우리·동물 겹침 판단용)
  const placed = _decoList(CUR).filter(p=>p.area===area && p.id!==excludeId);   // [DECO-SPACE-1] 이 공간만
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
      if (tr>=p.row && tr<p.row+ps.h && tc>=p.col && tc<p.col+ps.w) {
        if (_decoOverlapOk(placingId, p)) continue;   // [DECO-PT-2] 우리 안 동물
        return false;
      }
    }
  }
  return true;
}

let SEL_DECO = null;
let DECO_SCENE = 'yard'; // 'yard' | 'indoor'
let _dCv = null, _dCtx = null, _dC = 28, _dW = 0, _dH = 0;
// [DECO-ZOOM-1] 꾸미기 확대/축소·화면 이동 — 판은 격자 좌표 그대로 그리고, 보이는 창만 옮긴다.
//  _dZoom 1 = 지금까지 보던 크기. 칸 크기 C = 기준칸 × _dZoom.
//  _dPanX/_dPanY = 보이는 창의 왼쪽 위가 판의 어디인지(판 픽셀). 저장하지 않는다(화면 상태).
const DECO_ZOOM_MIN = 0.5, DECO_ZOOM_MAX = 3, DECO_ZOOM_STEP = 1.25;
const DY_BASE = { cols: 50, rows: 28 };   // 집·농장 자리를 재는 기준 판(넓혀도 자리가 안 움직이게)
let _dZoom = 1, _dPanX = 0, _dPanY = 0;
let _ifMode = false; // 전체화면 인테리어 모드 여부

// ── 그리드 상수 ──
// 전체화면 모드: 셀 24px 기준으로 화면 크기에서 역산
// 일반 모드(포트폴리오 내): 기존 cols/rows 유지
const DY_NORMAL  = {cols:20, rows:14};  // 마당 일반 모드
const DY_FULL    = {cols:80, rows:44};  // 마당 전체화면 모드 — [DECO-LAND-1] 50×28 → 80×44(2.2배). 좌표는 그대로라 있는 마당은 안 움직인다
const DI_NORMAL  = {cols:12, rows:8};   // 집 안 일반 모드
const DI_FULL    = {cols:50, rows:28};  // 집 안 전체화면 모드
const DH = {cols:6, rows:3};            // 집 건물 차지 영역 (우상단)

// 현재 활성 그리드 (모드에 따라 전환)
let DY = {...DY_NORMAL};
let DI = {...DI_NORMAL};

// [DECO-ZOOM-1] 집은 기준 판(50칸) 오른쪽 위에 고정한다 — 마당을 넓혀도 집·문이 제자리.
function _houseCol0(){ return Math.min(DY.cols, DY_BASE.cols) - DH.cols; }
function _isHC(r,c){ const c0=_houseCol0(); return r < DH.rows && c >= c0 && c < c0 + DH.cols; }

// ── 전체화면 인테리어 모드 ──────────────────────────────
function openInteriorFullscreen() {
  _ifMode = true;
  _dZoom = 1; _dPanX = 0; _dPanY = 0;   // [DECO-ZOOM-1]
  try { const sp = +localStorage.getItem('rpg.deco.space'); if (sp >= 1 && sp <= DECO_SPACES) DECO_SPACE = sp; } catch (e) {}   // [DECO-SPACE-1]
  setTimeout(_decoSpaceSync, 0);
  _decoUndoClear();   // [DECO-UNDO-1] 다시 열면 0단계
  DY = {...DY_FULL};
  DI = {...DI_FULL};
  const fs = document.getElementById('interior-fullscreen');
  fs.style.display = 'flex';
  setTimeout(() => { try { _decoPillarSync(); } catch (e) {} }, 0);   // [DECO-PT-4] 보이게 된 뒤 기둥 자리
  _dCv = null; _dCtx = null;
  _ifActiveContainer = 'if-topview';
  ifSyncScene();
  ifSyncModeBtn();
  // 레이아웃 완료 후 렌더
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!_ifMode) return;   // [DECO-RCLICK-1·정리] 그사이 닫혔으면(탭이 가려져 rAF 가 멈춘 사이 등) 닫힌 판을 전체화면 값으로 다시 그리지 않는다
      renderHouseDeco();
      if (!_decoViewRestore()) (DECO_SCENE === 'yard' ? _decoPhoneStart() : _decoIndoorStart());   // [DECO-VIEW-1] 지난번 보던 자리로 · [DECO-PT-1] 처음이면 폰은 크게 · [INDOOR-ROOMS-1] 집 안은 방 둘레
      _decoLandHint();
    });
  });
}

// [DECO-LAND-1] 마당이 넓어진 것을 한 번만 알려 준다(기기에만 기록 — DB 쓰기 0)
//  [DECO-WORDS-1] '넓어졌어요'는 **좁은 옛 마당을 본 아이**에게만 맞는 말이다 — 마당에 장식이 하나도 없는 처음 아이에게는
//  안 띄우고(그대로 한 번 본 것으로 적는다), 집 안으로 곧장 들어왔을 때는 마당에 나올 때까지 미룬다.
function _decoLandHint() {
  if (DECO_SCENE !== 'yard') return;
  try {
    if (localStorage.getItem('rpg.deco.landHint') === '1') return;
    localStorage.setItem('rpg.deco.landHint', '1');
  } catch (e) { return; }
  if (!(CUR.houseDecorations || []).some(p => p.area === 'yard')) return;
  toast('🌿 마당이 넓어졌어요! 두 손가락으로 모으거나 "전체"를 누르면 넓게 보여요');
}

function closeInteriorFullscreen() {
  decoFlush('전체화면 닫기');   // [DECO-SAVE-1]
  _decoViewSave();   // [DECO-VIEW-1]
  _animStopAll();   // [DECO-ANIM-1] 타이머 남기지 않기
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
  if (sn) sn.textContent = isYard ? '🌿 마당' : '🏠 집 안';
  if (sb) sb.textContent = isYard ? '🏠 집 안으로 →' : '🌿 마당으로 ←';
  // [INDOOR-LOOK-1] 집 안에서는 같은 자리가 '🖌️ 벽지·바닥'(#631 이 감춰 두었던 단추가 돌아온다). 바닥 모드인 채 장면을 바꾸면 판도 그 장면 것으로.
  const fb = document.getElementById('if-mode-floor');
  if (fb) { fb.style.display = ''; fb.textContent = isYard ? '🖌️ 바닥' : '🖌️ 벽지·바닥'; }
  if (DECO_MODE === 'floor') _floorPickShow(true);
}

function ifSyncModeBtn() {
  ['if-mode-deco','if-mode-floor','if-mode-erase'].forEach(id => {   // [DECO-PT-2] 🧽 치우기
    const btn = document.getElementById(id);
    if (!btn) return;
    const active = id === 'if-mode-' + DECO_MODE;
    btn.style.background = active ? 'rgba(255,215,0,.12)' : 'rgba(255,255,255,.06)';
    btn.style.color = active ? 'var(--gold)' : 'var(--txt2)';
    btn.style.borderColor = active ? 'rgba(255,215,0,.4)' : 'rgba(255,255,255,.12)';
  });
  _decoFit();   // [DECO-FIT-1] 바닥 줄이 생기고 서랍이 접히면 판 자리가 달라진다
}

function ifSyncInv() {
  const el = document.getElementById('if-deco-inv');
  const srcEl = document.getElementById('house-deco-inv');
  if (el && srcEl) el.innerHTML = srcEl.innerHTML;
  try { _decoPillarSync(); } catch (e) {}   // [DECO-PT-4]
  try { _decoFit(); } catch (e) {}          // [DECO-FIT-1] 서랍 키가 바뀌면 판 자리도(처음 열 때·최근 줄이 생길 때)
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
  d_y31:_dSmallPond,         // 작은 연못 (3×3) — 그리는 함수만 있고 표에서 빠져 있었다
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
      //  [DECO-PICK-1] 카드 없이 놓인 장식을 누르면 '치우기'인데, 길게 누르면 스포이드다 →
      //  그 경우만 손을 뗄 때(짧았을 때) 치운다. 나머지는 지금처럼 누르는 순간 처리.
      const cell = _decoCellAt(t.clientX, t.clientY);
      const onDeco = !SEL_DECO && DECO_MODE !== 'floor' && cell && _decoList(CUR).some(p => {
        if (p.area !== cell.area) return false; const sz = getDecoSize(p.id);
        return cell.r >= p.row && cell.r < p.row + sz.h && cell.c >= p.col && cell.c < p.col + sz.w;
      });
      if (onDeco) { _dCv._pendingTap = { clientX: t.clientX, clientY: t.clientY, t0: Date.now() }; return; }
      //  [DECO-FLOOR-RECT-1] ⬛ 네모로: 누르는 순간 칠하지 않고 뗄 때 — 끌었으면(네모) 한 칸이 아니었고, 두 손가락이면 화면이었다.
      //  (누르는 순간 칠하면 네모마다 첫 칸이 따로 저장되고, 두 손가락 확대에도 한 칸이 칠해졌다)
      //  [INDOOR-LOOK-1] 집 안 벽지·바닥도 뗄 때 — 한 손가락 끌기는 화면 이동이다
      if (DECO_MODE === 'floor' && (DECO_FLOOR_TOOL === 'rect' || DECO_SCENE !== 'yard') && e.touches.length === 1) {
        _dCv._pendingTap = { clientX: t.clientX, clientY: t.clientY, t0: Date.now(), rect: true }; return;
      }
      _decoClick({ clientX: t.clientX, clientY: t.clientY, target: e.target });
    }, { passive: false });
    _dCv.addEventListener('touchend', e => {
      const pt = _dCv && _dCv._pendingTap; if (!pt) return;
      _dCv._pendingTap = null;
      if (pt.rect) { if (!_dSuppressClick && DECO_MODE === 'floor') _decoClick({ clientX: pt.clientX, clientY: pt.clientY, target: e.target }); return; }
      if (Date.now() - pt.t0 >= DECO_PICK_MS) return;   // 길게였다 — 스포이드가 이미 처리
      _decoClick({ clientX: pt.clientX, clientY: pt.clientY, target: e.target });
    }, { passive: false });
    // 마우스(PC)용
    _dCv.addEventListener('click', _decoClick);
    _decoAttachGestures(_dCv);   // [DECO-ZOOM-1] 핀치·두 손가락 이동·빈손 끌기·휠
  }
  _decoFitWatch(el);   // [DECO-FIT-1] 판 자리가 달라지면(서랍·바닥 모드·창 크기) 캔버스도 따라간다
  // 전체화면 모드면 window 크기 직접 사용, 아니면 컨테이너 너비
  let W, maxH;
  if (_ifMode) {
    // 상단바(~50px) + 바닥타일줄(~48px, 바닥모드일 때) + 하단인벤(~120px) 제외
    const topH = DECO_MODE === 'floor' ? 98 : 50;
    //  [DECO-PT-1] 서랍(머리줄·최근 줄)이 커지면 어림값(−120)이 틀려 판이 서랍 밑으로 들어갔다 → 실제 남는 자리로
    W    = el.clientWidth  || window.innerWidth;
    maxH = el.clientHeight || (window.innerHeight - topH - 120);
  } else {
    W    = el.offsetWidth || 340;
    maxH = 600;
  }
  const cols = DECO_SCENE === 'yard' ? DY.cols : DI.cols;
  const rows = DECO_SCENE === 'yard' ? DY.rows : DI.rows;
  // [DECO-ZOOM-1] 기준 칸은 '기준 판'(50칸) 기준이라 판을 넓혀도 처음 보이는 크기가 그대로다.
  const baseCols = Math.min(cols, DECO_SCENE === 'yard' ? DY_BASE.cols : DI.cols);
  const baseC = Math.floor(W / baseCols);
  const C = Math.max(4, Math.round(baseC * _dZoom));
  const H = _ifMode ? Math.max(120, maxH) : Math.min(Math.max(C * rows, 120), maxH);   // [DECO-PT-1]
  _dW = W; _dH = H; _dC = C;
  _decoClampPan();
  //  [DECO-PINCH-1] 크기가 같으면 버퍼를 다시 잡지 않는다(확대 중에는 칸 크기만 바뀐다 — 매 걸음 지우고 새로 잡지 않게)
  if (_dCv.width !== W * 2)  _dCv.width  = W * 2;
  if (_dCv.height !== H * 2) _dCv.height = H * 2;
  _dCv.style.width  = W + 'px';
  _dCv.style.height = H + 'px';
  _dCtx = _dCv.getContext('2d');
  _dCtx.setTransform(2, 0, 0, 2, 0, 0);   // scale(2,2) 와 같은 값 — 버퍼를 안 바꾼 때 거듭 곱해지지 않게
}

let _drawDecoRaf = null;

// [DECO-FIT-1] 캔버스 크기는 '잡는 순간' 판 자리(#if-topview)로 정해지는데, 그 자리는 그 뒤에도 바뀐다 —
//  ① 처음 열 때는 서랍에 카드가 차기 전에 재서 캔버스가 컸다(1366×610: 479 vs 보이는 327 →
//     마당 맨 아래 5줄이 서랍 밑에 들어가 어떻게 해도 안 보였다 · 지난번 자리 기억이 없는 기기에서)
//  ② 🖌️ 바닥 모드는 서랍을 접는데 캔버스는 그대로라 판 아래가 까맣게 비었다(1366×610: 화면의 30%)
//  ③ 🕘 최근 줄이 생기거나 ⌃ 서랍을 펼치면 판 아래가 서랍 밑으로 들어갔다 · 창 크기·화면 돌리기도 같다
//  → 판 자리 크기가 바뀌면 캔버스 크기만 다시 맞춘다(보던 왼쪽 위는 그대로 · 저장·DB 쓰기 0).
//  자리가 바뀌는 줄 아는 곳(서랍 다시 그림·모드 바꿈·서랍 펼침)에서는 바로 부르고, 창 크기·화면 돌리기는 지켜본다.
let _decoFitObs = null, _decoFitHost = null;
function _decoFit() {
  if (!_ifMode || !_dCv || !_dCv.parentNode) return false;
  const el = _dCv.parentNode, w = el.clientWidth, h = el.clientHeight;
  if (!w || !h) return false;   // 안 보이는 동안(전체화면 닫힘)
  if (w === _dW && Math.max(120, h) === _dH) return false;
  _initDeco();
  _drawDeco();
  return true;
}
function _decoFitWatch(el) {
  if (typeof ResizeObserver === 'undefined' || _decoFitHost === el) return;
  if (_decoFitObs) _decoFitObs.disconnect();
  _decoFitHost = el;
  _decoFitObs = new ResizeObserver(() => { if (_dCv && _dCv.parentNode === el) _decoFit(); });
  _decoFitObs.observe(el);
}

// ══ 꾸미기 확대/축소·화면 이동 (DECO-ZOOM-1) ══════════════════
//  · 판(격자)은 지금 코드가 쓰는 좌표 그대로 그린다. 캔버스 변환으로 보이는 창만 옮긴다.
//  · 보이는 칸만 그린다(컬링) → 판을 넓혀도 한 번 그리는 비용이 늘지 않는다.
//  · 줌·이동은 화면 상태다. DB 에 쓰지 않는다.
function _decoBoardPx() {
  const cols = DECO_SCENE === 'yard' ? DY.cols : DI.cols;
  const rows = DECO_SCENE === 'yard' ? DY.rows : DI.rows;
  //  [DECO-PT-1] 집 안은 위에 벽 한 줄(약 0.9칸)이 더 있다
  if (DECO_SCENE !== 'yard') return { w: cols * _dC, h: rows * _dC + Math.ceil(_dC * 0.9) + _dC };
  return { w: cols * _dC, h: rows * _dC };
}

function _decoClampPan() {
  const b = _decoBoardPx();
  //  [DECO-VIEW-FIT-1] 집 안에 방이 있으면 판 밖도 도면이다 → 반 화면까지 더 밀 수 있다(판 끝에 붙은 방을 가운데로 — 디자인 D10)
  const extraX = (DECO_SCENE !== 'yard' && _inRooms(CUR).length) ? _dW / 2 : 0, extraY = extraX ? _dH / 2 : 0;
  const maxX = Math.max(0, b.w - _dW) + extraX, maxY = Math.max(0, b.h - _dH) + extraY;
  //  마당 판이 화면보다 작으면(전체 보기) 화면 안에서 움직일 수 있다(판이 화면 밖으로는 안 나간다) — 가운데 두기는 '전체'가 한다
  const yd = DECO_SCENE === 'yard';
  const minX = yd && b.w < _dW ? -(_dW - b.w) : -extraX, minY = yd && b.h < _dH ? -(_dH - b.h) : -extraY;
  _dPanX = Math.min(Math.max(minX, _dPanX), maxX);
  _dPanY = Math.min(Math.max(minY, _dPanY), maxY);
}
// [DECO-VIEW-FIT-1] 판 전체가 한 화면에 들어오는 배율 — '전체'는 폭만 맞춰 1366×610 에서 마당 아래(밭 포함)가 화면 밖이었다(디자인 D17)
function _decoWholeZoom() {
  if (!_dW || !_dH) return DECO_ZOOM_MIN;
  const yard = DECO_SCENE === 'yard', cols = yard ? DY.cols : DI.cols, rows = yard ? DY.rows : DI.rows + 2;   // 집 안은 위 벽 띠 몫
  const C0 = Math.floor(_dW / Math.min(cols, yard ? DY_BASE.cols : DI.cols));
  //  칸 크기를 내림으로 정한 뒤 배율로 — _initDeco 가 칸을 반올림해 판이 화면보다 몇 px 넓어지지 않게
  return Math.max(4, Math.floor(Math.min(_dW / cols, _dH / rows))) / C0;
}
//  두 손가락·－ 로 줄일 수 있는 끝 = 원래 끝(0.5)과 '판 전체' 중 작은 쪽(0.25 아래로는 안 간다)
function _decoZoomMin() { return Math.max(0.25, Math.min(DECO_ZOOM_MIN, _decoWholeZoom())); }

// 보이는 칸 범위 — 그리는 쪽에서 이 범위만 돈다
function _decoVisible(rows, cols) {
  const r0 = Math.max(0, Math.floor(_dPanY / _dC) - 1);
  const c0 = Math.max(0, Math.floor(_dPanX / _dC) - 1);
  const r1 = Math.min(rows, Math.ceil((_dPanY + _dH) / _dC) + 1);
  const c1 = Math.min(cols, Math.ceil((_dPanX + _dW) / _dC) + 1);
  return { r0, c0, r1, c1 };
}

//  화면의 한 점(창 기준 px)을 고정한 채 줌을 바꾼다 — 핀치 중심·＋－ 단추 모두 이걸 쓴다
function _decoSetZoom(z, fx, fy) {
  const prev = _dZoom;
  const next = Math.min(DECO_ZOOM_MAX, Math.max(_decoZoomMin(), z));   // [DECO-VIEW-FIT-1]
  if (Math.abs(next - prev) < 0.001) return;
  const ax = (fx === undefined ? _dW / 2 : fx), ay = (fy === undefined ? _dH / 2 : fy);
  const boardX = (_dPanX + ax) / prev, boardY = (_dPanY + ay) / prev;   // 줌 1 기준 판 좌표
  _dZoom = next;
  //  [DECO-PINCH-1] 캔버스를 새로 만들지 않는다 — 새로 만들면 손가락이 잡고 있던 캔버스가 사라져
  //  두 손가락 확대가 첫 걸음(약 7%)에서 끊겼다(실제 터치로 3배 벌려도 1→1.07배). 칸 크기만 다시 잰다.
  _initDeco();
  _dPanX = boardX * _dZoom - ax; _dPanY = boardY * _dZoom - ay;
  _decoClampPan();
  _drawDeco();
}

// [DECO-VIEW-1] 마지막 보던 자리·배율 기억 — 기기에만(localStorage), DB 쓰기 0.
//  판 픽셀은 창 크기·배율에 따라 달라지므로 '보던 한가운데 칸'과 배율로 기억한다(폰↔태블릿에서도 같은 곳).
const DECO_VIEW_KEY = 'rpg.deco.view';
function _decoViewSave() {
  if (!_dCv || DECO_SCENE !== 'yard' || !_dC) return;
  try {
    localStorage.setItem(DECO_VIEW_KEY, JSON.stringify({
      z: Math.round(_dZoom * 1000) / 1000,
      cx: Math.round(((_dPanX + _dW / 2) / _dC) * 10) / 10,
      cy: Math.round(((_dPanY + _dH / 2) / _dC) * 10) / 10,
    }));
  } catch (e) {}
}
function _decoViewRestore() {
  if (DECO_SCENE !== 'yard') return false;
  let v = null;
  try { v = JSON.parse(localStorage.getItem(DECO_VIEW_KEY) || 'null'); } catch (e) { return false; }
  if (!v || !(v.z > 0) || !isFinite(v.cx) || !isFinite(v.cy)) return false;
  _dZoom = Math.min(DECO_ZOOM_MAX, Math.max(DECO_ZOOM_MIN, v.z));
  _dCv = null; _dCtx = null;
  _initDeco();
  _dPanX = v.cx * _dC - _dW / 2; _dPanY = v.cy * _dC - _dH / 2;
  _decoClampPan();
  _drawDeco();
  return true;
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) _decoViewSave(); });
}

// [DECO-PT-1] 폰(좁은 화면)에서 처음 열면 칸이 7px 라 꽃 하나를 못 누른다 → 칸 약 16px 로 집 앞에서 연다
//  [DECO-PHONE-INDOOR-1] 집 안도 같다 — 폰 375 에서 50칸 방이 칸 7px 로 열려 가구 하나·나가기 문(7px)을 못 눌렀다.
//  집 안은 왼쪽 위(벽·창문)부터 연다.
// [DECO-VIEW-FIT-1] 처음 열 때 판이 화면 높이보다 짧으면(세로 화면 768×1024: 칸 15 · 아래가 빈 검은 띠) 높이에 맞춰 키우고 집이 보이게 민다(디자인 D13)
function _decoFillStart() {
  if (!_dC || DECO_SCENE !== 'yard' || _dW <= 600) return false;
  const C0 = _dC / _dZoom;
  if (DY.rows * _dC >= _dH) return false;
  _decoSetZoom(Math.min(DECO_ZOOM_MAX, _dH / (DY.rows * C0)), 0, 0);
  _dPanX = Math.max(0, (_houseCol0() + DH.cols + 2) * _dC - _dW); _dPanY = 0;
  _decoClampPan(); _drawDeco();
  return true;
}
function _decoPhoneStart() {
  if (_decoFillStart()) return;   // [DECO-VIEW-FIT-1] 넓은 화면인데 판이 짧으면 높이 채우기
  if (!_dC || _dW > 600) return;
  const z = Math.min(DECO_ZOOM_MAX, 16 / Math.max(1, _dC / _dZoom));
  _decoSetZoom(z, 0, 0);
  if (DECO_SCENE === 'yard') { _dPanX = (_houseCol0() - 4) * _dC; _dPanY = 0; }   // 집(기준 판 오른쪽 위) 앞이 보이게
  else { _dPanX = 0; _dPanY = 0; }
  _decoClampPan(); _drawDeco();
}

function decoZoomIn()  { _decoSetZoom(_dZoom * DECO_ZOOM_STEP); }
function decoZoomOut() { _decoSetZoom(_dZoom / DECO_ZOOM_STEP); }

// 판 전체가 보이게 (마당이 넓어져 길을 잃었을 때)
function decoZoomFit() {
  if (DECO_SCENE !== 'yard' && _inFitRooms()) return;   // [INDOOR-ROOMS-1] 집 안 '전체' = 방들 둘레
  //  [DECO-VIEW-FIT-1] 폭·높이 둘 다 맞춘다 — 마당 80×44 가 밭까지 한 화면에(1366×610: 칸 17 → 9 · 아래 줄이 더는 화면 밖이 아니다)
  const z = Math.max(_decoZoomMin(), Math.min(DECO_ZOOM_MAX, _decoWholeZoom()));
  _dPanX = 0; _dPanY = 0;
  _decoSetZoom(z, 0, 0);
  //  판이 화면보다 작으면 가운데에(왼쪽·위에 붙고 나머지가 비던 것)
  const b = _decoBoardPx();
  _dPanX = b.w < _dW ? -(_dW - b.w) / 2 : 0; _dPanY = b.h < _dH ? -(_dH - b.h) / 2 : 0;
  _decoClampPan(); _drawDeco();
}

function decoPanBy(dx, dy) {
  const bx = _dPanX, by = _dPanY;
  _dPanX += dx; _dPanY += dy;
  _decoClampPan();
  if (_dPanX !== bx || _dPanY !== by) _drawDeco();
}

// 손짓 — 두 손가락 벌리기/모으기 = 확대/축소(손가락 사이 중심 기준) · 두 손가락 끌기 = 화면 이동
//  빈손(고른 카드 없고 바닥 모드 아님) 한 손가락 끌기 = 화면 이동 · 휠 = 확대/축소(PC)
//  카드를 고른 채 한 손가락은 지금처럼 '놓기'다(탭).
let _dSuppressClick = false;
function _decoAttachGestures(cv) {
  const pts = new Map();
  let pinch = null, drag = null, paint = null;   // paint = [DECO-DRAG-1] 끌어서 칠하기·놓기
  let roomDrag = null;                            // [INDOOR-ROOMS-1] 집 안 ⬛ 방 네모 끌기

  const mid = () => {
    const a = [...pts.values()];
    return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2,
             d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) };
  };
  const local = (e) => {
    const rect = cv.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (_dW / rect.width), y: (e.clientY - rect.top) * (_dH / rect.height) };
  };

  let pickTimer = null, pickAt = null;   // [DECO-PICK-1]
  const pickCancel = () => { if (pickTimer) { clearTimeout(pickTimer); pickTimer = null; } };
  cv.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, local(e));
    pickCancel();
    if (pts.size === 1) {
      const cell = _decoCellAt(e.clientX, e.clientY);
      pickAt = { cell, x: e.clientX, y: e.clientY };
      pickTimer = setTimeout(() => {
        pickTimer = null;
        if (paint && paint.active) return;
        if (_decoPickAt(pickAt && pickAt.cell)) {
          _dSuppressClick = true;            // 뗄 때 오는 클릭은 놓기가 아니다
          if (paint) paint = null;            // 이 누름은 칠하기가 아니었다
          drag = null;
        }
      }, DECO_PICK_MS);
    }
    if (pts.size === 2) {
      drag = null;
      if (roomDrag) { roomDrag = null; _inRoomPrevSet(null); }   // [INDOOR-ROOMS-1] 두 손가락이면 화면이었다
      if (paint) { if (paint.rect) _decoRectCancel(); else _decoStrokeEnd(paint); paint = null; }   // 두 손가락이 되면 칠하기는 거기서 끝 · [DECO-FLOOR-RECT-1] 네모는 취소(안 칠함)
      const m = mid();
      pinch = { d0: m.d, z0: _dZoom, fx: m.x, fy: m.y, mx: m.x, my: m.y };
      _dSuppressClick = true;
    } else if (pts.size === 1 && (!SEL_DECO && DECO_MODE !== 'floor' || e.pointerType === 'mouse' && e.button !== 0
        || DECO_MODE === 'floor' && DECO_SCENE !== 'yard' && !_inRoomDragMode())) {   // [INDOOR-LOOK-1] 집 안 벽지·바닥: 칠할 칸이 없다 → 한 손가락 끌기 = 화면 이동
      //  [DECO-PAN-1] 마우스 오른쪽·가운데 버튼 끌기는 카드를 골랐어도 언제나 화면 이동
      const l = local(e);
      drag = { x: l.x, y: l.y, moved: 0 };
    } else if (pts.size === 1 && _inRoomDragMode()) {
      //  [INDOOR-ROOMS-1] ⬛ 방 — 끌면 네모(떼면 방)
      const k = _inCellClamp(e.clientX, e.clientY);
      roomDrag = { r0: k.r, c0: k.c, active: false };
    } else if (pts.size === 1) {
      //  [DECO-DRAG-1] 카드를 골랐거나 바닥 모드 — 끌면 칠하기·놓기
      const cell = _decoCellAt(e.clientX, e.clientY);
      if (cell) paint = { start: cell, last: cell, active: false, stroke: [], mode: null, placed: 0, outOfStock: false,
        rect: DECO_MODE === 'floor' && DECO_FLOOR_TOOL === 'rect' && cell.area === 'yard' };   // [DECO-FLOOR-RECT-1] ⬛ 네모로
    }
  });

  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, local(e));
    if (pickTimer && pickAt && Math.abs(e.clientX - pickAt.x) + Math.abs(e.clientY - pickAt.y) > 8) pickCancel();
    if (pinch && pts.size >= 2) {
      const m = mid();
      if (pinch.d0 > 8) _decoSetZoom(pinch.z0 * (m.d / pinch.d0), pinch.fx, pinch.fy);
      decoPanBy(pinch.mx - m.x, pinch.my - m.y);
      pinch.mx = m.x; pinch.my = m.y;
      return;
    }
    if (roomDrag && pts.size === 1) {   // [INDOOR-ROOMS-1] 시작 칸을 벗어나면 네모 미리 보기
      const k = _inCellClamp(e.clientX, e.clientY);
      if (!roomDrag.active && k.r === roomDrag.r0 && k.c === roomDrag.c0) return;
      roomDrag.active = true; _dSuppressClick = true;
      const nr = _inRoomFrom(roomDrag.r0, roomDrag.c0, k.r, k.c);
      _inRoomPrevSet(Object.assign(nr, { why: _inRoomWhy(_inRooms(CUR), nr) }));
      return;
    }
    if (paint && paint.rect && pts.size === 1) {   // [DECO-FLOOR-RECT-1] 시작 칸을 벗어나면 네모 미리보기(집·밭 위로도 늘어난다 — 칠할 때 건너뜀)
      const k = _decoYardCellClamp(e.clientX, e.clientY);
      if (!paint.active && k.r === paint.start.r && k.c === paint.start.c) return;
      _decoRectMove(paint, e.clientX, e.clientY);
      return;
    }
    if (paint && pts.size === 1) {
      const cell = _decoCellAt(e.clientX, e.clientY);
      if (!cell || cell.area !== paint.last.area || (cell.r === paint.last.r && cell.c === paint.last.c)) return;
      if (!paint.active) _decoStrokeBegin(paint);
      for (const k of _decoLineCells(paint.last.r, paint.last.c, cell.r, cell.c)) {
        if (cell.area === 'yard' && (_isHC(k.r, k.c) || _isFarmCell(k.r, k.c))) continue;
        _decoStrokeApply({ area: cell.area, r: k.r, c: k.c }, paint);
      }
      paint.last = cell;
      _drawDeco();
      return;
    }
    if (drag) {
      const l = local(e);
      const dx = l.x - drag.x, dy = l.y - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved > 6) _dSuppressClick = true;
      decoPanBy(-dx, -dy);
      drag.x = l.x; drag.y = l.y;
    }
  });

  const end = e => {
    //  [DECO-RCLICK-1] 마우스 오른쪽 버튼을 **안 끌고**(4px 미만) 떼면 치우기 — 끌었으면 화면 이동이었다
    if (e.type === 'pointerup' && e.pointerType === 'mouse' && e.button === 2 && drag && drag.moved < 4 && pts.has(e.pointerId)) {
      _decoRightClickAt(e.clientX, e.clientY);
    }
    pts.delete(e.pointerId);
    pickCancel();
    if (pts.size < 2) pinch = null;
    if (!pts.size) {
      if (roomDrag) {   // [INDOOR-ROOMS-1] 떼면 방(안 되면 그 까닭 한 줄)
        const pv = roomDrag.active && _inRoomPrev; roomDrag = null; _inRoomPrevSet(null);
        if (pv) { if (pv.why) toast('🧱 ' + pv.why); else _inRoomAdd({ r: pv.r, c: pv.c, w: pv.w, h: pv.h }); }
      }
      if (paint) { if (paint.rect) _decoRectCommit(paint); else _decoStrokeEnd(paint); paint = null; }
      drag = null; setTimeout(() => { _dSuppressClick = false; }, 0);
    }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('lostpointercapture', end);

  //  [DECO-SEL-HL-1] 마우스가 누르지 않은 채 움직이면 커서 칸에 놓일 모습 — 칸이 바뀔 때만 다시 그린다(터치는 hover 가 없다)
  cv.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    const k = _decoCellAt(e.clientX, e.clientY), h = _decoHover;
    if ((!k && !h) || (k && h && k.area === h.area && k.r === h.r && k.c === h.c)) return;
    _decoHover = k; if (SEL_DECO) _drawDeco();
  });
  cv.addEventListener('pointerleave', () => { if (_decoHover) { _decoHover = null; if (SEL_DECO) _drawDeco(); } });
  cv.addEventListener('contextmenu', e => e.preventDefault());   // [DECO-PAN-1] 오른쪽 끌기에 메뉴가 뜨지 않게
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const l = local(e);
    _decoSetZoom(_dZoom * (e.deltaY < 0 ? DECO_ZOOM_STEP : 1 / DECO_ZOOM_STEP), l.x, l.y);
  }, { passive: false });
}

// ══ 꾸미기 끌어서 연달아 놓기·칠하기 (DECO-DRAG-1) ══════════════
//  카드를 고른 채(또는 🖌️ 바닥 모드) **한 손가락으로 끌면** 지나간 칸마다 놓이고 칠해진다.
//  · 한 번 끈 것은 **되돌리기 한 단계**(decoUndoStroke) · 저장은 묶음(DECO-SAVE-1)이라 칸마다 저장 안 됨.
//  · 바닥: 시작 칸이 그 타일이 되면 '칠하기', 지워지면 '지우기'로 한 번 정해 그대로 간다(깜빡이지 않게).
//  · 장식: **놓기만** 한다(끌다가 치우는 일은 없다 — 망가뜨리지 않게). 못 놓는 칸은 조용히 건너뛴다.
//  · 빠르게 끌어도 칸이 비지 않게 앞 칸과 이 칸 사이를 곧은 줄로 채운다.
//  · 빈손 한 손가락 끌기는 지금처럼 화면 이동, 두 손가락은 확대·이동.
let _decoLastTap = null;   // 방금 누른 칸(터치는 누르는 순간 이미 놓인다 — 끌기 첫 칸이 두 번 되지 않게)

function _decoCellAt(clientX, clientY) {
  if (!_dCv) return null;
  const bp = _decoBoardPoint(clientX, clientY), C = _dC;
  if (DECO_SCENE === 'yard') {
    const c = Math.floor(bp.x / C), r = Math.floor(bp.y / C);
    if (c < 0 || c >= DY.cols || r < 0 || r >= DY.rows) return null;
    if (_isHC(r, c) || _isFarmCell(r, c)) return null;
    return { area: 'yard', r, c };
  }
  const ox = _dCv._offX || 0, oy = _dCv._offY || 0;
  const c = Math.floor((bp.x - ox) / C), r = Math.floor((bp.y - oy) / C);
  if (r === -1 && c >= 0 && c < DI.cols) return { area: 'indoor', r: 0, c, band: true };   // [INDOOR-WALL-1] 벽 띠 = 0번 줄의 벽
  //  [INDOOR-ROOMS-1] 방의 벽 띠 줄 — 그 칸에 서 있는 가구가 없을 때만 '벽'이다(가구가 있으면 그 가구를 누른 것)
  if (DECO_MODE !== 'floor' && c >= 0 && c < DI.cols && r >= 0 && r < DI.rows) {
    const h = _inRoomAt(r, c);
    if (h && h.band && !_decoList(CUR).some(p => p.area === 'indoor' && !_isWallDeco(p.id) && r >= p.row && r < p.row + getDecoSize(p.id).h && c >= p.col && c < p.col + getDecoSize(p.id).w))
      return { area: 'indoor', r: h.rm.r, c, band: true };
  }
  if (c < 0 || c >= DI.cols || r < 0 || r >= DI.rows) return null;
  return { area: 'indoor', r, c };
}

//  앞 칸 → 이 칸 사이 곧은 줄(Bresenham). 앞 칸은 빼고 이 칸은 넣는다 — 순수 함수(시험용)
function _decoLineCells(r0, c0, r1, c1) {
  const out = [];
  const dr = Math.abs(r1 - r0), dc = Math.abs(c1 - c0);
  const sr = r0 < r1 ? 1 : -1, sc = c0 < c1 ? 1 : -1;
  let err = dc - dr, r = r0, c = c0;
  while (!(r === r1 && c === c1)) {
    const e2 = 2 * err;
    if (e2 > -dr) { err -= dr; c += sc; }
    if (e2 < dc) { err += dc; r += sr; }
    out.push({ r, c });
  }
  return out;
}

//  한 칸 칠하기·놓기(끌기용 — 알림 없음). 바뀐 게 있으면 true
function _decoStrokeApply(cell, st) {
  if (DECO_MODE === 'floor') {
    if (cell.area !== 'yard') return false;
    const fm = _yardFloorMap(CUR);   // [DECO-SPACE-1]
    const key = cell.r + '_' + cell.c, cur = fm[key];
    if (st.mode === 'erase') {
      if (cur === undefined) return false;
      st.stroke.push({ t: 'floor', key, prev: cur }); delete fm[key];
    } else {
      if (cur === CUR_FLOOR_TILE) return false;
      const blk = _floorPaintBlock(cell.r, cell.c, CUR_FLOOR_TILE);   // [DECO-RULE-R1R2] 그 칸은 건너뛰고 끝에 한 번 말한다
      if (blk) { st.blocked = st.blocked || []; if (st.blocked.indexOf(blk) < 0) st.blocked.push(blk); return false; }
      st.stroke.push({ t: 'floor', key, prev: cur }); fm[key] = CUR_FLOOR_TILE;
    }
    decoDirty();
    return true;
  }
  if (!SEL_DECO) return false;
  const d = GAME_DATA.decorations.find(x => x.id === SEL_DECO);
  if (!d || d.cat !== cell.area) return false;
  const sz = d.size || { w: 1, h: 1 };
  const placed = CUR.houseDecorations || [];
  const inv = (CUR.inventory || []).find(i => i.id === SEL_DECO);
  if (!inv || inv.qty - placed.filter(p => p.id === SEL_DECO).length <= 0) { st.outOfStock = true; return false; }
  if (!canPlaceDeco(cell.r, cell.c, sz.w, sz.h, cell.area, null)) return false;
  if (cell.area === 'yard' && _animAt(_ifActiveContainer || 'house-topview', cell.r, cell.c)) return false;   // [DECO-SEL-A5] 돌아다니는 동물 발밑에 놓지 않는다
  if (_decoRuleWhy(SEL_DECO, cell.area, cell.r, cell.c, sz.w, sz.h)) return false;   // [DECO-PT-2]
  if (cell.area === 'yard' && typeof ANIM_DECO !== 'undefined' && ANIM_DECO[SEL_DECO]
      && !_animGroundOk(SEL_DECO, CUR, cell.r, cell.c, sz.w, sz.h)) return false;
  const np = _decoNew(SEL_DECO, cell.area, cell.r, cell.c);   // [DECO-SPACE-1]
  CUR.houseDecorations = [...placed, np];
  st.stroke.push({ t: 'place', p: Object.assign({}, np) });
  st.placed++;
  decoDirty();
  return true;
}

function _decoStrokeBegin(st) {
  const s0 = st.start;
  //  터치는 누르는 순간 첫 칸이 이미 처리됐다 → 그 되돌리기 한 줄을 이 끌기로 합친다
  const tapped = _decoLastTap && _decoLastTap.area === s0.area && _decoLastTap.r === s0.r && _decoLastTap.c === s0.c
    && Date.now() - _decoLastTap.t < 1500;
  const startKey = s0.r + '_' + s0.c;
  if (tapped) {
    if (_decoUndo.length) { const rec = _decoUndo.pop(); st.stroke.push(rec); _decoUndoSync(); if (rec.t === 'place') st.placed = (st.placed || 0) + 1; }   // [DECO-WORDS-1] 알림 수에 첫 칸도
    if (DECO_MODE === 'floor') st.mode = (_yardFloorGet(CUR)[startKey] === CUR_FLOOR_TILE) ? 'set' : 'erase';
  } else {
    if (DECO_MODE === 'floor') st.mode = (_yardFloorGet(CUR)[startKey] === CUR_FLOOR_TILE) ? 'erase' : 'set';
    _decoStrokeApply(s0, st);
  }
  st.active = true;
  _dSuppressClick = true;
}

// [DECO-PICK-1] 스포이드 — 판에 놓인 장식을 **길게 누르면(0.6초)** 그 장식 카드가 손에 잡힌다.
//  같은 것을 또 놓고 싶을 때 서랍에서 다시 찾지 않는다. 가진 게 남았을 때만 잡힌다.
//  동물을 누르면 반응하는 것(짧게)과 겹치지 않는다 — 길게일 때만. 끌기가 시작되면 취소.
const DECO_PICK_MS = 600;
function _decoPickAt(cell) {
  if (!cell) return false;
  const list = CUR.houseDecorations || [];
  let hit = _decoTopAt(cell.area, cell.r, cell.c, true, cell.band);   // [DECO-SPACE-1] 이 공간에서 · [DECO-ANIM-HIT-1] 동물은 보이는 자리로 · [INDOOR-WALL-1] 벽 띠
  if (hit && !cell.band && _decoOnWallFloor(hit, cell.area)) hit = null;   // 액자 아래 빈 바닥
  if (!hit) return false;
  const d = GAME_DATA.decorations.find(x => x.id === hit.id);
  const inv = (CUR.inventory || []).find(i => i.id === hit.id);
  const left = inv ? inv.qty - list.filter(p => p.id === hit.id).length : 0;
  if (DECO_MODE === 'floor') setDecoMode('deco');
  if (left <= 0) { toast((d ? d.icon + ' ' : '') + '이건 다 놓았어요 — 상점에서 더 살 수 있어요'); return true; }
  SEL_DECO = hit.id;
  _drawDeco(); renderDecoInv();
  toast('💧 ' + (d ? d.icon + ' ' + d.name : '') + ' 잡았어요 — 놓을 칸을 누르세요');
  return true;
}

function _decoStrokeEnd(st) {
  if (!st || !st.active) return;
  decoUndoStroke(st.stroke);
  if (st.placed && SEL_DECO) _decoRecentAdd(SEL_DECO);   // [DECO-FIND-1]
  if (DECO_MODE !== 'floor' && SEL_DECO && _decoLeft(SEL_DECO) <= 0) { SEL_DECO = null; st.outOfStock = true; }   // [DECO-SEL-A5] 다 썼으면 내려놓기
  _drawDeco(); renderDecoInv();
  if (DECO_MODE === 'floor' && st.blocked && st.blocked.length) toast(_floorPaintWhy(st.blocked[0], CUR_FLOOR_TILE, st.blocked.length));   // [DECO-RULE-R1R2]
  if (DECO_MODE !== 'floor') {
    if (st.placed && st.outOfStock) toast('✅ ' + st.placed + '개 놓았어요 — 이제 다 썼어요(카드를 내려놓았어요)');   // [DECO-PT-1] · [DECO-SEL-A5]
    else if (st.placed) toast('✅ ' + st.placed + '개 놓았어요');
    else if (st.outOfStock) toast('가진 개수가 모자라요!');
  }
}

// ══ 바닥 '⬛ 네모로' 칠하기 (DECO-FLOOR-RECT-1 · 정원 바닥 연결 ④-2) ══════════════
//  규칙: docs/deco_floor_picker_20260920.md §5. 한 손가락으로 끌면 시작 칸 ↔ 지금 칸을 모서리로 하는 네모를 미리 보여 주고,
//  손을 떼면 네모 안 칸을 **한꺼번에** 칠한다(집·밭 칸은 건너뜀) · ↩ 한 번 = 네모 하나 · 확인 창 없음 · **지우지 않는다**(칠하기만).
//  한 번 누름은 지금처럼 한 칸(끌어서와 같다) · 두 손가락은 확대·이동(네모는 취소 — 아무것도 안 칠한다).
//  한 번에 칠하는 칸은 DECO_RECT_MAX 까지 — 넘으면 네모가 그 크기에서 멈추고 아래 글에 알린다. 저장은 묶음 저장(decoDirty) 한 번.
const DECO_RECT_MAX = 400;
const DECO_TOOL_KEY = 'deco_floor_tool_v1';
let DECO_FLOOR_TOOL = 'drag';   // 'drag' | 'rect' — 고른 도구는 이 기기에 기억(편의 · 저장값 아님)
try { if (typeof localStorage !== 'undefined' && localStorage.getItem(DECO_TOOL_KEY) === 'rect') DECO_FLOOR_TOOL = 'rect'; } catch (e) {}
function decoFloorTool(t) {
  DECO_FLOOR_TOOL = t === 'rect' ? 'rect' : 'drag';
  try { localStorage.setItem(DECO_TOOL_KEY, DECO_FLOOR_TOOL); } catch (e) {}
  if (typeof _floorPickRender === 'function') _floorPickRender();
}
let _decoRectPrev = null;   // 끄는 동안의 네모 { r0, c0, r1, c1, sr, sc, capped }

//  시작 칸과 지금 칸 → 네모(상한을 넘으면 시작 칸 쪽으로 줄인다 · 순수 함수)
function _decoRectFrom(sr, sc, r, c, max) {
  let h = Math.abs(r - sr) + 1, w = Math.abs(c - sc) + 1, capped = false;
  if (w * h > max) {
    capped = true;
    if (w > max) { w = max; h = 1; }
    else h = Math.max(1, Math.floor(max / w));
  }
  const dr = r >= sr ? 1 : -1, dc = c >= sc ? 1 : -1;
  const r1 = sr + dr * (h - 1), c1 = sc + dc * (w - 1);
  return { r0: Math.min(sr, r1), r1: Math.max(sr, r1), c0: Math.min(sc, c1), c1: Math.max(sc, c1), sr, sc, w, h, capped };
}
//  창 좌표 → 마당 칸(집·밭 위여도 · 판 밖이면 가장자리 칸으로)
function _decoYardCellClamp(clientX, clientY) {
  const bp = _decoBoardPoint(clientX, clientY), C = _dC;
  return { r: Math.max(0, Math.min(DY.rows - 1, Math.floor(bp.y / C))), c: Math.max(0, Math.min(DY.cols - 1, Math.floor(bp.x / C))) };
}
function _decoRectMove(st, clientX, clientY) {
  const k = _decoYardCellClamp(clientX, clientY);
  const p = _decoRectPrev;
  let nx = _decoRectFrom(st.start.r, st.start.c, k.r, k.c, Infinity);
  //  상한을 넘으면 네모는 **마지막으로 된 크기에서 멈춘다**(처음부터 넘으면 시작 칸 쪽으로 줄인 네모)
  if (nx.w * nx.h > DECO_RECT_MAX) nx = p ? Object.assign({}, p, { capped: true }) : _decoRectFrom(st.start.r, st.start.c, k.r, k.c, DECO_RECT_MAX);
  if (p && p.r0 === nx.r0 && p.r1 === nx.r1 && p.c0 === nx.c0 && p.c1 === nx.c1 && p.capped === nx.capped) return;
  if (!st.active) { st.active = true; _dSuppressClick = true; }   // 이제 네모다 — 뗄 때 오는 '한 번 누름'은 칠하지 않는다
  _decoRectPrev = nx;
  _decoRectTip();
  _drawDeco();
}
function _decoRectCancel() { _decoRectPrev = null; _decoRectTip(); _drawDeco(); }
//  손을 뗌 — 네모 안 칸을 한꺼번에(집·밭 건너뜀 · 이미 그 바닥인 칸은 그대로). 되돌리기 한 단계 · 저장 한 번
function _decoRectCommit(st) {
  const p = _decoRectPrev;
  _decoRectPrev = null; _decoRectTip();
  if (!p || !st.active) { _drawDeco(); return 0; }
  const fm = _yardFloorMap(CUR);   // [DECO-SPACE-1]
  let n = 0; const blocked = [];
  for (let r = p.r0; r <= p.r1; r++) for (let c = p.c0; c <= p.c1; c++) {
    if (_isHC(r, c) || _isFarmCell(r, c)) continue;
    const key = r + '_' + c, cur = fm[key];
    if (cur === CUR_FLOOR_TILE) continue;
    const blk = _floorPaintBlock(r, c, CUR_FLOOR_TILE);   // [DECO-RULE-R1R2]
    if (blk) { if (blocked.indexOf(blk) < 0) blocked.push(blk); continue; }
    st.stroke.push({ t: 'floor', key, prev: cur }); fm[key] = CUR_FLOOR_TILE; n++;
  }
  if (blocked.length) toast(_floorPaintWhy(blocked[0], CUR_FLOOR_TILE, blocked.length));
  decoUndoStroke(st.stroke);
  if (st.stroke.length) decoDirty();
  _drawDeco();
  return n;
}
//  미리보기 — 칠해질 모습을 반투명(.55)으로 + 금색 점선 테 + 시작 모서리 금색 점. 바닥 그리기는 마당과 같은 _drawFloorSVG
//  (네모 안 = 고른 바닥, 밖 = 지금 마당 → 칠한 뒤 생길 가장자리·물가까지 미리 보인다). _drawDeco 가 판 좌표 변환을 건 뒤 부른다.
function _drawRectPreview() {
  const p = _decoRectPrev; if (!p || !_dCtx) return;
  const C = _dC, fl = _yardFloorGet(CUR), ctx = _dCtx;
  const inR = (r, c) => r >= p.r0 && r <= p.r1 && c >= p.c0 && c <= p.c1 && !_isHC(r, c) && !_isFarmCell(r, c);
  const valAt = (r, c) => inR(r, c) ? CUR_FLOOR_TILE : fl[r + '_' + c];
  const typeAt = (rr, cc, wantRim) => (rr < 0 || cc < 0 || rr >= DY.rows || cc >= DY.cols || _isHC(rr, cc)) ? null : _floorParse(valAt(rr, cc))[wantRim ? 'rim' : 'name'];
  ctx.save(); ctx.globalAlpha = 0.55;
  for (let r = p.r0; r <= p.r1; r++) for (let c = p.c0; c <= p.c1; c++) {
    if (!inR(r, c)) continue;
    const fp = _floorParse(CUR_FLOOR_TILE);
    if (FLOOR_SVG && _drawFloorSVG(fp.name, r, c, c * C, r * C, C, typeAt, fp.color, fp.rim)) continue;
    const t = FLOOR_TILES[fp.name] || FLOOR_TILES.grass; ctx.fillStyle = t.bg; ctx.fillRect(c * C, r * C, C, C);
  }
  ctx.restore();
  ctx.save();
  ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.strokeStyle = '#ffd866';
  ctx.strokeRect(p.c0 * C + 1.5, p.r0 * C + 1.5, (p.c1 - p.c0 + 1) * C - 3, (p.r1 - p.r0 + 1) * C - 3);
  ctx.setLineDash([]); ctx.fillStyle = '#ffd866'; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1.5;
  const x = (p.sc + (p.sc === p.c0 ? 0 : 1)) * C, y = (p.sr + (p.sr === p.r0 ? 0 : 1)) * C;
  ctx.beginPath(); ctx.arc(x, y, Math.max(4, C * 0.18), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}
//  아래 글 — '12×9칸 · 손을 떼면 칠해져요 · 잘못하면 ↩' (상한에 닿으면 알림)
function _decoRectTip() {
  const host = document.getElementById('if-topview'); if (!host) return;
  let el = document.getElementById('if-rect-tip');
  const p = _decoRectPrev;
  if (!p) { if (el) el.hidden = true; return; }
  if (!el) { el = document.createElement('div'); el.id = 'if-rect-tip'; el.className = 'deco-rect-tip'; el.setAttribute('role', 'status'); host.appendChild(el); }
  el.hidden = false;
  el.textContent = p.capped ? `${p.w}×${p.h}칸 · 한 번에 ${DECO_RECT_MAX}칸까지예요 · 손을 떼면 칠해져요`
    : `${p.w}×${p.h}칸 · 손을 떼면 칠해져요 · 잘못하면 ↩`;
  el.classList.toggle('is-capped', !!p.capped);
}

// [INDOOR-ROOMS-1] 지금 한 손가락 끌기가 '방 네모'인가 — 집 안 🖌️ 판의 ⬛ 방 탭에서 크기 칩·없애기를 안 골랐을 때
function _inRoomDragMode() { return DECO_MODE === 'floor' && DECO_SCENE !== 'yard' && _inPk.tab === 'room' && !_inPk.tool; }
function _inCellClamp(clientX, clientY) {
  const bp = _decoBoardPoint(clientX, clientY), C = _dC, ox = _dCv._offX || 0, oy = _dCv._offY || 0;
  return { r: Math.max(0, Math.min(DI.rows - 1, Math.floor((bp.y - oy) / C))), c: Math.max(0, Math.min(DI.cols - 1, Math.floor((bp.x - ox) / C))) };
}
// 창 기준 px → 판 px (클릭·핀치 공용)
function _decoBoardPoint(clientX, clientY) {
  const rect = _dCv.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (_dW / rect.width) + _dPanX,
    y: (clientY - rect.top) * (_dH / rect.height) + _dPanY,
  };
}


// ══ 꾸미기 동물 움직임 (DECO-ANIM-1) ══════════════════════
//  캔버스 위에 투명한 층을 얹고, 마당 동물만 그 층의 <img> 로 놓는다.
//  · 움직임은 CSS 전환(transition)이 한다 — 코드는 몇 초에 한 번 "다음 칸"만 정하고 손을 뗀다.
//    → requestAnimationFrame 루프 없음 · 캔버스 다시 그리기 없음.
//  · 돌아다니는 위치는 **화면에만** 있다. DB 쓰기 0 (꾸미기는 조작 한 번마다 학생 문서를
//    통째로 저장하는 구조라, 위치를 저장하면 저장이 쉬지 않는다).
//  · 캔버스는 이 동물들을 그리지 않는다(_drawYard 에서 건너뜀) — 두 마리로 보이지 않게.
//  · 친구 방 구경(ff-topview)도 같은 층을 쓴다.
//  한계(1판): 층이 캔버스 위라 키 큰 장식 뒤로 가도 앞에 보인다 → 반지름을 좁게 둔다.

//  ground: 갈 수 있는 바닥 묶음 · water:true = 물에 놓으면 물 안에서만(헤엄)
//  say: 누르면 뜨는 말 · hop: 줄 바꾸기(위·아래 한 칸 톡) 간격 ms
const ANIM_DECO = {
  d_y32: { radius: 3, wait: [4000, 8000],  ground: ['soft', 'water'], water: true,  say: '꽥!',     name: '오리' },
  d_y39: { radius: 3, wait: [3500, 7000],  ground: ['soft'],                        say: '꼬꼬댁',  name: '닭' },
  d_y40: { radius: 2, wait: [6000, 11000], ground: ['soft'],                        say: '메~',     name: '양', artLeft: true },   // 그림이 왼쪽을 본다
  d_y53: { radius: 4, wait: [2500, 5500],  ground: ['soft', 'hard'], come: true,    say: '왈!',     name: '강아지' },
  d_y54: { radius: 4, wait: [3000, 7000],  ground: ['soft', 'hard'],                say: '야옹',    name: '고양이' },
  d_y55: { radius: 3, wait: [3500, 7000],  ground: ['soft'],                        say: '꼬꼬댁',  name: '닭' },
  d_y56: { radius: 3, wait: [4000, 8000],  ground: ['soft', 'water'], water: true,  say: '꽥!',     name: '오리' },
  d_y57: { radius: 2, wait: [6000, 11000], ground: ['soft'],                        say: '메~',     name: '양' },
};

// [DECO-FENCE-1] 울타리 자동 이음 — 아이가 가로·세로·코너를 고르지 않는다.
//  장식 표에 autoFence:true 인 장식(🚧 울타리) 하나만 상점에 두고,
//  놓으면 이웃 울타리를 보고 네 그림 중 맞는 것으로 그린다(바닥 타일이 이미 그렇게 이어진다).
//  옛 4종(d_y49~52)은 표에 그대로 남는다 — 이미 산 아이가 인벤토리에서 놓을 수 있다.
//  그림 id — 방향은 **그림에서 난간이 실제로 뻗는 쪽**으로 잰 값이다(디자인 2 실측).
//   d_y49 ─(왼+오른) · d_y50 │(위+아래) · d_y51 └(위+오른) · d_y52 ┘(위+왼)
//   d_y71 ┌(아래+오른) · d_y72 ┐(아래+왼) — 아래로 꺾이는 두 장은 그림이 생기면 쓰고,
//   없으면 세로(│)로 대신한다(줄은 이어져 보이고 모퉁이만 각이 안 진다).
const FENCE_IDS = ['d_y49', 'd_y50', 'd_y51', 'd_y52', 'd_y70', 'd_y71', 'd_y72'];
const FENCE_ART = { h: 'd_y49', v: 'd_y50', ur: 'd_y51', ul: 'd_y52', dr: 'd_y71', dl: 'd_y72' };

//  그 그림이 장식 표에 있나 — 없으면 대신 쓸 것을 준다
function _fenceArtOr(id, fallback) {
  return GAME_DATA.decorations.some(x => x.id === id) ? id : fallback;
}

function _isFenceCell(student, r, c) {
  const list = _decoList(student);   // [DECO-SPACE-1]
  for (const p of list) {
    if (p.area !== 'yard' || p.row !== r || p.col !== c) continue;
    if (FENCE_IDS.indexOf(p.id) >= 0) return true;
    const d = GAME_DATA.decorations.find(x => x.id === p.id);
    if (d && d.autoFence) return true;
  }
  return false;
}

//  이웃을 보고 어느 그림으로 그릴지 — 순수 함수(단위 시험용)
//   ① 좌우로 지나가면 가로 ─ (세 갈래·네 갈래도 가로로 읽는 게 낫다)
//   ② 위아래로 지나가면 세로 │
//   ③ 한 번 꺾이면 그 모퉁이 그림 └ ┘ ┌ ┐
//   ④ 이웃이 하나면 그 방향(좌·우 → 가로 · 위·아래 → 세로) · 없으면 가로
function _fencePick(hasL, hasR, hasU, hasD) {
  if (hasL && hasR) return FENCE_ART.h;
  if (hasU && hasD) return FENCE_ART.v;
  if (hasU && hasR) return FENCE_ART.ur;
  if (hasU && hasL) return FENCE_ART.ul;
  if (hasD && hasR) return _fenceArtOr(FENCE_ART.dr, FENCE_ART.v);
  if (hasD && hasL) return _fenceArtOr(FENCE_ART.dl, FENCE_ART.v);
  if (hasU || hasD) return FENCE_ART.v;
  return FENCE_ART.h;
}

function _fenceArtFor(student, r, c) {
  return _fencePick(_isFenceCell(student, r, c - 1), _isFenceCell(student, r, c + 1),
                    _isFenceCell(student, r - 1, c), _isFenceCell(student, r + 1, c));
}

// [DECO-FEED-1] 먹이통 — 놓으면 가까운 동물이 모인다(장식 표의 feeder:true).
//  · 먹이통 칸을 기준으로 정해진 거리 안에 있는 동물만.
//  · 우리 안 동물은 그 우리 안에 있는 먹이통에만 모인다.
//  · 저장하지 않는다. 먹이·수입 같은 값은 없다(그건 밸런스 결정이다).
const FEED_RANGE = 7;
function _feedersOf(student) {
  return _decoList(student).filter(p => {   // [DECO-SPACE-1]
    if (p.area !== 'yard') return false;
    const d = GAME_DATA.decorations.find(x => x.id === p.id);
    return !!(d && d.feeder);
  });
}
//  이 동물이 갈 먹이통 — 없으면 null
function _feederFor(student, st, feeders) {
  let best = null, bestDist = 1e9;
  for (const f of feeders) {
    if (st.pen && (f.row < st.pen.r0 || f.row > st.pen.r1 || f.col < st.pen.c0 || f.col > st.pen.c1)) continue;
    const dist = Math.abs(f.row - st.home.row) + Math.abs(f.col - st.home.col);
    if (dist > (st.pen ? 99 : FEED_RANGE)) continue;
    if (dist < bestDist) { bestDist = dist; best = f; }
  }
  return best;
}

// [DECO-ANIM-3] 우리(pen) — 장식 표에 pen:true 인 장식(닭장·목장·연못 우리 등).
//  · 동물은 우리 칸을 지날 수 있다(다른 장식은 못 지난다).
//  · 우리 안에 놓인 동물은 반지름 대신 **그 우리 안**에서만 돌아다닌다 → 마당이 어지럽지 않다.
function _isPenDeco(id) {
  const d = GAME_DATA.decorations.find(x => x.id === id);
  return !!(d && d.pen);
}
//  (r,c) 를 품은 우리의 사각형을 준다. 없으면 null.
function _penAt(student, r, c) {
  const list = _decoList(student);   // [DECO-SPACE-1]
  for (const p of list) {
    if (p.area !== 'yard' || !_isPenDeco(p.id)) continue;
    const sz = getDecoSize(p.id);
    if (r >= p.row && r < p.row + sz.h && c >= p.col && c < p.col + sz.w) {
      const d = GAME_DATA.decorations.find(x => x.id === p.id);
      //  울타리 줄(footprint 가장자리)에는 서지 않는다 — 동물 층이 캔버스 위라
      //  울타리 칸에 서면 '우리 안'이 아니라 '울타리 위'로 보인다.
      //  안쪽이 한 칸도 안 남는 작은 우리는 어쩔 수 없이 footprint 전체를 쓴다.
      let r0 = p.row + 1, c0 = p.col + 1, r1 = p.row + sz.h - 2, c1 = p.col + sz.w - 2;
      if (r1 < r0 || c1 < c0) { r0 = p.row; c0 = p.col; r1 = p.row + sz.h - 1; c1 = p.col + sz.w - 1; }
      return { r0, c0, r1, c1, water: !!(d && d.penWater) };
    }
  }
  return null;
}

// [DECO-ANIM-2] 바닥 묶음 — 아이가 🖌️ 바닥으로 칠한 타일을 셋으로 본다
const GROUND_HARD = ['stone', 'brick', 'gravel', 'gravel_yard', 'wood', 'deck', 'stone_floor'];
function _groundKind(type) {
  if (type === 'water') return 'water';
  return GROUND_HARD.indexOf(type) >= 0 ? 'hard' : 'soft';   // 그 외는 풀·흙
}
function _groundAt(student, r, c) {
  return _groundKind(_floorParse(_yardFloorGet(student)[r + '_' + c]).name);   // [DECO-SPACE-1] · 색·마감이 붙은 꽃밭도 이름으로 본다
}
//  이 동물을 (r,c) 에 놓을 수 있나 — 바닥만 본다(겹침은 canPlaceDeco 가 본다)
function _animGroundOk(id, student, r, c, w, h) {
  const cfg = ANIM_DECO[id];
  if (!cfg) return true;
  for (let dr = 0; dr < (h || 1); dr++) for (let dc = 0; dc < (w || 1); dc++) {
    if (cfg.ground.indexOf(_groundAt(student, r + dr, c + dc)) < 0) return false;
  }
  return true;
}
//  왜 안 되는지 아이 말로
function _animWhyNot(id) {
  const cfg = ANIM_DECO[id];
  if (!cfg) return '여기엔 놓을 수 없어요';
  if (cfg.water) return '🦆 ' + cfg.name + '는 물이나 풀밭에 놓아 주세요';
  if (cfg.ground.indexOf('hard') >= 0) return '🐶 ' + cfg.name + '는 물에는 못 들어가요';
  return '🐑 ' + cfg.name + '은 풀밭이나 흙에 놓아 주세요';
}

// 걸음 두 번째 장(<id>_b.svg) — 있으면 걷는 동안 그 장을 쓴다. 없으면 한 장으로 그냥 걷는다(404 안전).
const _animFrameB = {};
// [DECO-EAT-1] 먹는 장(<id>_eat.svg) — 먹이통 옆에 닿으면 고개 숙인 장으로 바꾼다(헤엄 중엔 안 씀)
const _animFrameEat = {};
// [DECO-SWIM-1] 헤엄 장(<id>_swim.svg) — 물 위 오리가 다리 두 개로 걷고 발밑에 풀이 따라오던 것(플레이 시험)
const _animFrameSwim = {};
function _animProbeSwim(id) {
  if (id in _animFrameSwim) return _animFrameSwim[id];
  _animFrameSwim[id] = false;
  const img = new Image();
  img.onload = () => {
    _animFrameSwim[id] = (img.naturalWidth > 0);
    //  그림 확인이 늦게 끝나도 이미 물 위에 있는 오리를 바로 헤엄 장으로(타이머를 따로 걸지 않는다)
    if (_animFrameSwim[id]) _animLayers.forEach(rec => rec.items.forEach(st => { if (st.id === id) _animEatSync(st); }));
  };
  img.onerror = () => { _animFrameSwim[id] = false; };
  img.src = './assets/deco/' + encodeURIComponent(id) + '_swim.svg';
  return false;
}
function _animProbeEat(id) {
  if (id in _animFrameEat) return _animFrameEat[id];
  _animFrameEat[id] = false;
  const img = new Image();
  img.onload = () => { _animFrameEat[id] = (img.naturalWidth > 0); };
  img.onerror = () => { _animFrameEat[id] = false; };
  img.src = './assets/deco/' + encodeURIComponent(id) + '_eat.svg';
  return false;
}
function _animProbeFrameB(id) {
  if (id in _animFrameB) return _animFrameB[id];
  _animFrameB[id] = false;
  const img = new Image();
  img.onload = () => { _animFrameB[id] = (img.naturalWidth > 0); };
  img.onerror = () => { _animFrameB[id] = false; };
  img.src = './assets/deco/' + encodeURIComponent(id) + '_b.svg';
  return false;
}

const _animLayers = new Map();   // hostId → { layer, items: Map(key → state) }
let _animHooked = false;

function _animReduced() {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  catch (e) { return false; }
}

// 그 칸에 설 수 있나 — 판 안 · 집 영역 아님 · 농장 칸 아님 · 다른 장식 없음(동물끼리는 지나갈 수 있다)
// [DECO-RULE-R5] 키 큰 장식의 그림은 발밑 칸보다 위로 솟는다(벚나무 약 0.9칸 · 헛간 1.6칸 · 정자 0.3칸 — bbox.json 의 그린 부분 위 끝).
//  동물 층은 캔버스 위라, 솟은 부분이 덮는 칸(= 그 장식 바로 뒷줄)에 선 동물은 **지붕·나무 꼭대기 위에** 그려졌다(디자인 담당 D6).
//  그 칸에는 동물이 걷지도 놓이지도 않는다. 솟은 부분이 칸의 20% 이하로 걸치면 막지 않는다(꽃 같은 낮은 것).
//  그림 상자가 아직 안 왔으면 막지 않는다(더 막아서 아이가 헷갈리지 않게). 우리(pen)는 동물이 지나가는 것이라 뺀다.
function _decoOverflowCells(p) {
  const bb = _decoBBox && _decoBBox[p.id];
  if (!Array.isArray(bb) || !(bb[4] > 0) || !(bb[5] > 0)) return [];
  const sz = getDecoSize(p.id), per = sz.w / bb[4];             // 그림 한 단위 = 칸 몇 개(폭을 발밑에 맞춰 그린다)
  const over = (bb[5] - bb[1]) * per - sz.h;                    // 발밑 칸 위로 솟은 칸 수
  const k = Math.ceil(over - 0.2);
  if (k <= 0) return [];
  const c0 = p.col + Math.floor(bb[0] * per), c1 = p.col + Math.ceil((bb[0] + bb[2]) * per) - 1, out = [];
  for (let dr = 1; dr <= k; dr++) for (let c = Math.max(p.col, c0); c <= Math.min(p.col + sz.w - 1, c1); c++) out.push([p.row - dr, c]);
  return out;
}
//  (r,c) 가 어느 장식의 솟은 그림 밑인가 — 그 장식(없으면 null)
const _decoOverflowMemo = { key: '', map: null };
function _decoOverflowAt(student, r, c) {
  //  [DECO-SEL-HL-1] 내 마당은 상태가 같으면 한 번 센 지도를 쓴다(놓을 칸 모음이 칸마다 부른다)
  if (student === CUR) {
    const key = [DECO_SPACE, _decoStateVer, !!_decoBBox, (CUR.houseDecorations || []).length].join('|');
    if (_decoOverflowMemo.key !== key) {
      const map = new Map();
      _decoList(CUR).forEach(p => { if (p.area !== 'yard' || ANIM_DECO[p.id] || _isPenDeco(p.id)) return;
        _decoOverflowCells(p).forEach(([rr, cc]) => { if (!map.has(rr + '_' + cc)) map.set(rr + '_' + cc, p); }); });
      _decoOverflowMemo.key = key; _decoOverflowMemo.map = map;
    }
    return _decoOverflowMemo.map.get(r + '_' + c) || null;
  }
  for (const p of _decoList(student)) {
    if (p.area !== 'yard' || ANIM_DECO[p.id] || _isPenDeco(p.id)) continue;
    if (_decoOverflowCells(p).some(([rr, cc]) => rr === r && cc === c)) return p;
  }
  return null;
}

// ══ 놓을 곳 표시 (DECO-SEL-HL-1 · 디자인 D8) ══════════════════
//  전: 놓일 수 있는 **시작 칸마다** 장식 크기 네모를 겹쳐 칠해 큰 장식일수록 겹친 곳이 하얗게 얼룩졌다 · 매 프레임 보이는 칸마다 다시 셌다 ·
//      물·동물 뒷줄·방 벽 같은 규칙(_decoRuleWhy)은 안 봐서 '밝은데 안 놓이는 칸'이 있었다.
//  후: 놓을 수 있는 자리들이 덮는 칸을 **칸마다 한 번** 옅게 + 그 둘레에 한 줄 · 규칙까지 본다 · 카드·공간·장면·상태가 같으면 다시 안 센다.
//      마우스면 커서 칸에 놓일 모습을 반투명으로(놓이면 초록 점선, 안 되면 붉은 점선). 터치는 누르면 바로 놓이니 미리 보기가 없다.
let _decoStateVer = 0;
const _decoOkMemo = { key: '', cells: null };
function _decoOkCells(area) {
  const R = area === 'yard' ? DY : DI;
  const key = [SEL_DECO, area, DECO_SPACE, _decoStateVer, !!_decoBBox, R.cols, R.rows, (CUR.houseDecorations || []).length].join('|');
  if (_decoOkMemo.key === key) return _decoOkMemo.cells;
  const sz = getDecoSize(SEL_DECO), occ = new Map(), cells = new Set();
  _decoList(CUR).forEach(p => { if (p.area !== area) return; const z = getDecoSize(p.id);
    for (let dr = 0; dr < z.h; dr++) for (let dc = 0; dc < z.w; dc++) { const k = (p.row + dr) + '_' + (p.col + dc); (occ.get(k) || occ.set(k, []).get(k)).push(p); } });
  const cellOk = (r, c) => {   // canPlaceDeco 와 같은 잣대(판 안 · 집 · 밭 · 겹침 허용)를 칸 지도로
    if (area === 'yard' && (_isHC(r, c) || _isFarmCell(r, c))) return false;
    const o = occ.get(r + '_' + c);
    return !o || o.every(p => _decoOverlapOk(SEL_DECO, p));
  };
  for (let r = 0; r + sz.h <= R.rows; r++) for (let c = 0; c + sz.w <= R.cols; c++) {
    let ok = true;
    for (let dr = 0; dr < sz.h && ok; dr++) for (let dc = 0; dc < sz.w && ok; dc++) ok = cellOk(r + dr, c + dc);
    if (!ok || _decoRuleWhy(SEL_DECO, area, r, c, sz.w, sz.h)) continue;
    if (area === 'yard' && ANIM_DECO[SEL_DECO] && !_animGroundOk(SEL_DECO, CUR, r, c, sz.w, sz.h)) continue;
    for (let dr = 0; dr < sz.h; dr++) for (let dc = 0; dc < sz.w; dc++) cells.add((r + dr) + '_' + (c + dc));
  }
  _decoOkMemo.key = key; _decoOkMemo.cells = cells;
  return cells;
}
//  칸마다 한 번 옅게 + 둘레 한 줄 — (ox,oy) 는 판 왼쪽 위(집 안은 _offX/_offY), v 는 보이는 칸 범위
function _decoDrawOkCells(cells, ox, oy, C, v) {
  const ctx = _dCtx, has = (r, c) => cells.has(r + '_' + c);
  ctx.fillStyle = 'rgba(255,255,255,.1)';
  for (let r = v.r0; r < v.r1; r++) for (let c = v.c0; c < v.c1; c++) if (has(r, c)) ctx.fillRect(ox + c * C, oy + r * C, C, C);
  ctx.strokeStyle = 'rgba(255,240,150,.7)'; ctx.lineWidth = Math.max(1, C * .06); ctx.beginPath();
  for (let r = v.r0; r < v.r1; r++) for (let c = v.c0; c < v.c1; c++) {
    if (!has(r, c)) continue;
    const x = ox + c * C, y = oy + r * C;
    if (!has(r - 1, c)) { ctx.moveTo(x, y); ctx.lineTo(x + C, y); }
    if (!has(r + 1, c)) { ctx.moveTo(x, y + C); ctx.lineTo(x + C, y + C); }
    if (!has(r, c - 1)) { ctx.moveTo(x, y); ctx.lineTo(x, y + C); }
    if (!has(r, c + 1)) { ctx.moveTo(x + C, y); ctx.lineTo(x + C, y + C); }
  }
  ctx.stroke();
}
//  마우스 커서 칸에 놓일 모습(반투명) — 초록 점선 = 놓임 · 붉은 점선 = 안 됨
let _decoHover = null;
function _decoDrawGhost(area, ox, oy, C) {
  const h = _decoHover;
  if (!h || h.area !== area || !SEL_DECO) return;
  const d = GAME_DATA.decorations.find(x => x.id === SEL_DECO); if (!d || d.cat !== area) return;
  const sz = getDecoSize(SEL_DECO), ok = canPlaceDeco(h.r, h.c, sz.w, sz.h, area, null) && !_decoRuleWhy(SEL_DECO, area, h.r, h.c, sz.w, sz.h)
    && !(area === 'yard' && ANIM_DECO[SEL_DECO] && !_animGroundOk(SEL_DECO, CUR, h.r, h.c, sz.w, sz.h));
  const x = ox + h.c * C, y = oy + h.r * C, ctx = _dCtx;
  ctx.save(); ctx.globalAlpha = .55; _drawDecoSVG(SEL_DECO, x, y, sz.w * C, sz.h * C); ctx.restore();
  ctx.save(); ctx.setLineDash([Math.max(3, C * .25), Math.max(2, C * .15)]); ctx.lineWidth = 2;
  ctx.strokeStyle = ok ? 'rgba(90,220,120,.95)' : 'rgba(255,110,90,.95)'; ctx.strokeRect(x + 1, y + 1, sz.w * C - 2, sz.h * C - 2); ctx.restore();
}
function _animFreeMaker(student, rows, cols) {
  const taken = new Set();
  _decoList(student).forEach(p => {   // [DECO-SPACE-1]
    if (p.area !== 'yard' || ANIM_DECO[p.id]) return;
    if (_isPenDeco(p.id)) return;   // [DECO-ANIM-3] 우리 안은 동물이 지날 수 있다
    const sz = getDecoSize(p.id);
    for (let dr = 0; dr < sz.h; dr++) for (let dc = 0; dc < sz.w; dc++) taken.add((p.row + dr) + '_' + (p.col + dc));
    _decoOverflowCells(p).forEach(([r, c]) => taken.add(r + '_' + c));   // [DECO-RULE-R5] 솟은 그림 밑(바로 뒷줄)
  });
  //  id 를 주면 그 동물이 갈 수 있는 바닥까지 본다(DECO-ANIM-2).
  //  swim = 물에 놓인 동물이면 물에서만 다닌다.
  return function (r, c, w, h, id, swim, penWater) {
    if (r < 0 || c < 0 || r + h > rows || c + w > cols) return false;
    for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) {
      const tr = r + dr, tc = c + dc;
      if (_isHC(tr, tc)) return false;
      if (_isFarmCell(tr, tc)) return false;
      if (taken.has(tr + '_' + tc)) return false;
      if (id) {
        const g = _groundAt(student, tr, tc);
        if (penWater) { /* 물 있는 우리 안은 그 자체가 물이다 */ }
        else if (swim) { if (g !== 'water') return false; }          // 헤엄 중이면 물만
        else if (g === 'water') return false;                        // 땅 동물은 물에 안 들어간다
        else if (ANIM_DECO[id].ground.indexOf(g) < 0) return false;  // 동물마다 다니는 바닥
      }
    }
    return true;
  };
}

// 다음 칸 하나 고르기 — 순수 함수(단위 시험용)
//  home 놓은 자리 · cur 지금 자리 · radius 집에서 몇 칸까지 · isFree(r,c) · rnd() 0~1
//  이웃 네 칸 중 갈 수 있는 곳을 고른다. 갈 곳이 없으면 지금 자리 그대로.
//  [DECO-ANIM-2] 걷기는 좌우만(그림이 옆모습이라 그게 정직하다).
//  vertical=true 로 부르면 줄 바꾸기(위·아래 한 칸) 후보만 본다 — 드물게 '톡' 뛰는 용도.
function _animNextCell(home, cur, radius, isFree, rnd, vertical) {
  const cand = [];
  const dirs = vertical ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
  for (const [dr, dc] of dirs) {
    const r = cur.row + dr, c = cur.col + dc;
    if (Math.abs(r - home.row) > radius || Math.abs(c - home.col) > radius) continue;
    if (!isFree(r, c)) continue;
    cand.push({ row: r, col: c });
  }
  if (!cand.length) return { row: cur.row, col: cur.col };
  const i = Math.floor((rnd ? rnd() : Math.random()) * cand.length) % cand.length;
  return cand[i];
}

function _animStopLayer(hostId) {
  const rec = _animLayers.get(hostId);
  if (!rec) return;
  rec.items.forEach(st => { if (st.timer) clearTimeout(st.timer); st.timer = null;
    if (st.frameTimer) { clearTimeout(st.frameTimer); st.frameTimer = null; } });
  if (rec.layer && rec.layer.parentNode) rec.layer.parentNode.removeChild(rec.layer);
  _animLayers.delete(hostId);
}

function _animStopAll() { [..._animLayers.keys()].forEach(_animStopLayer); }

function _animPauseAll() {
  _animLayers.forEach(rec => rec.items.forEach(st => { if (st.timer) clearTimeout(st.timer); st.timer = null; }));
}

function _animResumeAll() {
  if (_animReduced()) return;
  _animLayers.forEach(rec => rec.items.forEach(st => { if (!st.timer) _animSchedule(st); }));
}

function _animSchedule(st) {
  const w = st.cfg.wait;
  let wait = w[0] + Math.random() * (w[1] - w[0]);
  // [DECO-FEED-1] 먹이통 옆이면 더 오래 머문다(먹는 것처럼) · 가는 길이면 빨리 걷는다
  const fd = st.feeder;
  if (fd) {
    const near = Math.abs(st.cur.row - fd.row) + Math.abs(st.cur.col - fd.col) <= 1;
    wait = near ? wait * 2 : Math.min(wait, 1800);
  }
  st.timer = setTimeout(() => _animStep(st), wait);
}

function _animStep(st) {
  st.timer = null;
  if (!st.el || !st.el.parentNode) return;
  // [DECO-ANIM-2] 좌우로 걷고, 20~35초에 한 번만 줄을 바꾼다(위·아래 한 칸 '톡')
  const now = Date.now();
  // [DECO-FEED-1] 먹이통이 있고 아직 그 옆이 아니면 그쪽으로 간다(줄도 더 자주 바꿔 붙는다)
  const fd = st.feeder;
  const atFeeder = fd && Math.abs(st.cur.row - fd.row) + Math.abs(st.cur.col - fd.col) <= 1;
  const heading = !!(fd && !atFeeder);
  const hopGap = heading ? 4000 : (20000 + Math.random() * 15000);
  const wantHop = !st.swim && (heading ? (st.cur.row !== fd.row) : true) && now - (st.lastHop || 0) > hopGap;
  const free = (r, c) => {
    if (st.pen && (r < st.pen.r0 || r > st.pen.r1 - (st.h - 1) || c < st.pen.c0 || c > st.pen.c1 - (st.w - 1))) return false;
    return st.isFree(r, c, st.w, st.h, st.id, st.swim, !!(st.pen && st.pen.water));
  };
  const radius = st.pen ? 99 : (heading ? Math.max(st.cfg.radius, FEED_RANGE) : st.cfg.radius);
  //  먹이통으로 갈 때는 그 방향 한 칸을 먼저 본다(없으면 평소처럼 아무 쪽)
  let next = null;
  if (heading) {
    if (wantHop && st.cur.row !== fd.row) {
      const rr = st.cur.row + (fd.row > st.cur.row ? 1 : -1);
      if (free(rr, st.cur.col)) next = { row: rr, col: st.cur.col };
    }
    if (!next && st.cur.col !== fd.col) {
      const cc = st.cur.col + (fd.col > st.cur.col ? 1 : -1);
      if (free(st.cur.row, cc)) next = { row: st.cur.row, col: cc };
    }
  }
  let hopped = !!(next && next.row !== st.cur.row);
  if (!next) {
    next = _animNextCell(st.home, st.cur, radius, free, Math.random, wantHop);
    hopped = wantHop && (next.row !== st.cur.row);
    if (wantHop && !hopped) next = _animNextCell(st.home, st.cur, radius, free, Math.random, false);
  }
  if (hopped) st.lastHop = now;

  if (next.row !== st.cur.row || next.col !== st.cur.col) {
    const imgEl = st.el.querySelector('img');
    if (next.col !== st.cur.col && imgEl) {
      const dir = next.col > st.cur.col ? 1 : -1;
      imgEl.style.transform = 'scaleX(' + (st.cfg.artLeft ? -dir : dir) + ')';   // [DECO-EAT-1] 왼쪽을 보는 그림은 반대로
    }
    const dur = hopped ? 300 : (900 + Math.random() * 700);
    st.from = { row: st.cur.row, col: st.cur.col }; st.fromAt = Date.now();   // [DECO-PT-1] 걷는 동안 떠난 칸도 누를 수 있게
    // 걸음 그림 두 장이 있으면 걷는 동안만 바꿔 준다(헤엄은 발이 안 보이니 안 바꾼다)
    if (imgEl && _animFrameB[st.id] && !st.swim && !hopped) {
      imgEl.src = './assets/deco/' + encodeURIComponent(st.id) + '_b.svg';
      if (st.frameTimer) clearTimeout(st.frameTimer);
      st.frameTimer = setTimeout(() => { st.frameTimer = null; if (imgEl) imgEl.src = st.srcA; st.eating = null; _animEatSync(st); }, dur);
    }
    st.el.style.transitionDuration = dur + 'ms';
    st.cur = next;
    st.el.style.transform = 'translate(' + (next.col * st.C) + 'px,' + (next.row * st.C) + 'px)';
    st.el.style.zIndex = String(next.row);
  }
  _animEatSync(st);   // [DECO-EAT-1]
  _animSchedule(st);
}

function _animEatSync(st) {
  const imgEl = st.el && st.el.querySelector('img'); if (!imgEl) return;
  const fd = st.feeder;
  const near = !!(fd && Math.abs(st.cur.row - fd.row) + Math.abs(st.cur.col - fd.col) <= 1);
  const eat = near && !st.swim && _animFrameEat[st.id];
  const swim = !!(st.swim && _animFrameSwim[st.id]);   // [DECO-SWIM-1]
  const want = eat ? './assets/deco/' + encodeURIComponent(st.id) + '_eat.svg'
             : swim ? './assets/deco/' + encodeURIComponent(st.id) + '_swim.svg' : st.srcA;
  const mode = eat ? 'eat' : swim ? 'swim' : 'rest';
  if (st.eating === mode) return;
  //  걸음 장(_b)이 도는 중이면 그 타이머가 끝날 때 다시 부른다
  if (st.frameTimer) return;
  imgEl.src = want; st.eating = mode;
  //  먹을 때는 먹이통 쪽을 본다
  if (eat && fd.col !== st.cur.col) {
    const dir = fd.col > st.cur.col ? 1 : -1;
    imgEl.style.transform = 'scaleX(' + (st.cfg.artLeft ? -dir : dir) + ')';
  }
}

// [DECO-ANIM-2] 동물을 누르면 — 말풍선 + 폴짝. 강아지는 누른 쪽으로 한 칸 다가온다.
//  손가락이 어느 동물을 눌렀는지는 '판의 칸'으로 찾는다(층은 손가락을 통과시킨다).
function _animAt(hostId, r, c) {
  const rec = _animLayers.get(hostId);
  if (!rec) return null;
  //  [DECO-PT-1] 그림은 발 칸 위로 솟는다 → 발 칸 위 한 줄까지 · 걷는 1초 남짓은 떠난 칸도 맞는다
  const hitAt = (row, col, st) => r >= row - 1 && r < row + st.h && c >= col && c < col + st.w;
  for (const st of rec.items.values()) {
    if (hitAt(st.cur.row, st.cur.col, st)) return st;
    if (st.from && Date.now() - st.fromAt < 1700 && hitAt(st.from.row, st.from.col, st)) return st;
  }
  return null;
}

function _animPoke(st, fromCol) {
  if (!st || !st.el) return false;
  // 말풍선
  const say = document.createElement('div');
  say.className = 'deco-anim-say';
  say.textContent = st.cfg.say || '…';
  st.el.appendChild(say);
  setTimeout(() => { if (say.parentNode) say.parentNode.removeChild(say); }, 1200);
  // 폴짝
  const bob = st.el.querySelector('.bob');
  if (bob) { bob.classList.remove('hop'); void bob.offsetWidth; bob.classList.add('hop'); }
  // 강아지는 부르면 온다 — 누른 쪽으로 한 칸
  if (st.cfg.come && fromCol !== undefined) {
    const dir = fromCol > st.cur.col ? 1 : (fromCol < st.cur.col ? -1 : 0);
    const to = { row: st.cur.row, col: st.cur.col + dir };
    const penOk = !st.pen || (to.col >= st.pen.c0 && to.col <= st.pen.c1 - (st.w - 1));
    if (dir && penOk && st.isFree(to.row, to.col, st.w, st.h, st.id, st.swim)) {
      const imgEl = st.el.querySelector('img');
      if (imgEl) imgEl.style.transform = 'scaleX(' + (st.cfg.artLeft ? -dir : dir) + ')';
      st.cur = to;
      st.el.style.transitionDuration = '500ms';
      st.el.style.transform = 'translate(' + (to.col * st.C) + 'px,' + (to.row * st.C) + 'px)';
    }
  }
  return true;
}

//  hostId 안(캔버스 위)에 동물 층을 맞춘다. 마당이 아니면 층을 없앤다.
//  이미 있는 동물은 그 자리를 지킨다(다시 그려도 처음부터 걷지 않게).
function _animSyncLayer(hostId, student, scene, C, W, H, panX, panY) {
  const host = document.getElementById(hostId);
  if (!host || !student) { _animStopLayer(hostId); return; }
  if (scene !== 'yard') { _animStopLayer(hostId); return; }
  //  [DECO-ANIM-HIDDEN-1] 판이 **안 보이면** 층을 만들지 않는다 — 전체화면을 닫으면 closeInteriorFullscreen 이 내 집 창 안의
  //  작은 판(안 보임)을 다시 그리는데, 거기에 동물 층이 새로 생겨 아이가 홈·학습·전투에 가 있는 내내 걷기 타이머가 돌았다.
  if (typeof host.getClientRects === 'function' && !host.getClientRects().length) { _animStopLayer(hostId); return; }

  const rows = DY.rows, cols = DY.cols;
  const list = _decoList(student).filter(p => p.area === 'yard' && ANIM_DECO[p.id]);   // [DECO-SPACE-1]
  if (!list.length) { _animStopLayer(hostId); return; }

  let rec = _animLayers.get(hostId);
  if (!rec) {
    const layer = document.createElement('div');
    layer.className = 'deco-anim-layer';
    const world = document.createElement('div');   // [DECO-ZOOM-1] 이 겹만 옮기면 동물이 판과 같이 움직인다
    world.className = 'deco-anim-world';
    layer.appendChild(world);
    rec = { layer, world, items: new Map() };
    _animLayers.set(hostId, rec);
  }
  if (rec.layer.parentNode !== host) {
    try { if (getComputedStyle(host).position === 'static') host.style.position = 'relative'; } catch (e) {}
    host.appendChild(rec.layer);
  }
  rec.layer.style.width = W + 'px';
  rec.layer.style.height = H + 'px';
  rec.world.style.transform = 'translate(' + (-(panX || 0)) + 'px,' + (-(panY || 0)) + 'px)';

  const isFree = _animFreeMaker(student, rows, cols);
  const feeders = _feedersOf(student);   // [DECO-FEED-1]
  const keep = new Set();

  list.forEach(p => {
    const d = GAME_DATA.decorations.find(x => x.id === p.id);
    if (!d) return;
    const sz = d.size || { w: 1, h: 1 };
    const key = p.id + '@' + p.row + '_' + p.col;
    keep.add(key);
    let st = rec.items.get(key);
    if (!st) {
      const el = document.createElement('div');
      el.className = 'deco-anim';
      const bob = document.createElement('div');
      bob.className = 'bob';
      const img = document.createElement('img');
      img.alt = d.name || '';
      const srcA = './assets/deco/' + encodeURIComponent(p.id) + '.svg';
      img.src = srcA;
      bob.appendChild(img);
      el.appendChild(bob);
      rec.world.appendChild(el);
      _animProbeFrameB(p.id);
      _animProbeEat(p.id);   // [DECO-EAT-1]
      _animProbeSwim(p.id);  // [DECO-SWIM-1]
      st = { el, id: p.id, srcA, home: { row: p.row, col: p.col }, cur: { row: p.row, col: p.col }, timer: null, frameTimer: null,
        lastHop: Date.now() };   // [DECO-WORDS-1] '20~35초에 한 번'을 첫 걸음부터 지킨다(0 이면 놓자마자 줄을 바꿨다)
      rec.items.set(key, st);
    }
    st.cfg = ANIM_DECO[p.id];
    st.w = sz.w; st.h = sz.h; st.C = C;
    st.isFree = isFree;
    // [DECO-ANIM-2] 물에 놓인 오리는 물에서만 다닌다(놓인 자리 바닥으로 판정)
    st.pen = _penAt(student, p.row, p.col);   // [DECO-ANIM-3] 우리 안이면 그 안에서만
    if (_animFrameSwim[p.id] || _animFrameEat[p.id]) _animEatSync(st);   // [DECO-SWIM-1] 이미 확인된 그림이면 바로
    st.feeder = _feederFor(student, st, feeders);   // [DECO-FEED-1] 갈 먹이통(없으면 null)
    //  헤엄: 바닥을 물로 칠한 자리이거나, 물 있는 우리(연못 우리) 안이면
    st.swim = !!(st.cfg.water && (_groundAt(student, p.row, p.col) === 'water' || (st.pen && st.pen.water)));
    st.el.classList.toggle('swim', st.swim);
    st.el.style.width = (sz.w * C) + 'px';
    st.el.style.height = (sz.h * C) + 'px';
    st.el.style.transitionDuration = '0ms';
    st.el.style.transform = 'translate(' + (st.cur.col * C) + 'px,' + (st.cur.row * C) + 'px)';
    st.el.style.zIndex = String(st.cur.row);
    if (!st.timer && !_animReduced() && !document.hidden) _animSchedule(st);
  });

  [...rec.items.keys()].forEach(k => {
    if (keep.has(k)) return;
    const st = rec.items.get(k);
    if (st.timer) clearTimeout(st.timer);
    if (st.frameTimer) clearTimeout(st.frameTimer);
    if (st.el && st.el.parentNode) st.el.parentNode.removeChild(st.el);
    rec.items.delete(k);
  });

  if (!_animHooked) {
    _animHooked = true;
    document.addEventListener('visibilitychange', () => { if (document.hidden) _animPauseAll(); else _animResumeAll(); });
  }
}

// ══ 장식 SVG 파이프라인 (DECO-SVG-1) ══════════════════════
//  assets/deco/<id>.svg 가 있으면 그 그림을 쓰고, 없으면 기존 _DFN 캔버스 그림을 그대로 쓴다.
//  · SVG는 "발밑 기준"으로 놓는다 — footprint 폭에 맞추고, 아래 끝을 footprint 바닥에 붙이고,
//    남는 높이는 위로 넘치게 둔다(가로등·아치처럼 위로 솟는 것을 눌러 담지 않기 위해).
//    따라서 SVG viewBox = footprint 비율 + 위로 필요한 여유. 원점은 발밑 중앙.
//  · 비율을 억지로 늘리지 않는다. 기존 _DFN 경로의 ctx.scale(w/h) 왜곡은 SVG가 들어오는
//    장식부터 자연히 사라진다(에셋이 없는 장식은 지금 모습 그대로 — 이번 변경으로 안 바뀜).
//  · <img>는 intrinsic 크기가 있어야 캔버스에 그릴 수 있으므로 SVG에 width/height 속성 필수.
// 뒤→앞 정렬 — 기준은 시작 줄이 아니라 **발밑 줄**(row + 높이).
//   세로 3칸 장미 아치를 2줄에 놓으면 발밑은 4줄이다. 시작 줄로 정렬하면
//   3줄에 있는 장식보다 먼저 그려져, 앞에 있어야 할 아치가 뒤로 밀린다.
//   같은 발밑 줄이면 왼쪽 먼저. 원본 배열은 건드리지 않는다.
function _decoFootRow(p) {
  const d = GAME_DATA.decorations.find(x => x.id === p.id);
  return (p.row || 0) + (((d && d.size) ? d.size.h : 1) - 1);
}
function _decoSorted(list) {
  return [...list].sort((a, b) => (_decoFootRow(a) - _decoFootRow(b)) || (a.col - b.col));
}
const _DECO_IMG = {};   // id → {img, ok} | {ok:false}  (없는 파일은 한 번만 시도)
function _decoImg(id) {
  const hit = _DECO_IMG[id];
  if (hit) return hit.ok ? hit.img : null;
  const img = new Image();
  const rec = { img, ok: false };
  _DECO_IMG[id] = rec;
  img.onload  = () => { rec.ok = (img.naturalWidth > 0 && img.naturalHeight > 0); if (rec.ok) { _drawDeco(); _ffRedrawSoon(); _floorPickSoon(); } };   // [DECO-FRIEND-ART-1] · [INDOOR-LOOK-1] 견본 액자
  img.onerror = () => { rec.ok = false; };
  img.src = './assets/deco/' + encodeURIComponent(id) + '.svg';
  return null;
}

// 장식 하나를 놓는다. SVG가 준비됐으면 true, 아니면 false(호출부가 기존 방식으로 그림).
function _drawDecoSVG(id, px, py, bw, bh) {
  const img = _decoImg(id);
  if (!img) return false;
  const nw = img.naturalWidth, nh = img.naturalHeight;
  if (!nw || !nh) return false;
  const w = bw;                    // 땅에 닿는 폭 = footprint 폭
  const h = w * (nh / nw);         // 비율 유지 — 늘이지 않는다
  const src = _svgBmp('d:' + id, img, w * 2, nh / nw);   // [DECO-PERF-1] 구운 비트맵
  _dCtx.drawImage(src, px, py + bh - h, w, h);   // 아래 끝을 footprint 바닥에 맞춤
  return true;
}

// ══ 바닥 SVG 파이프라인 (FLOOR-SVG-1) ══════════════════════
//  assets/floor/<name>.svg — 바닥은 100×100 조각을 셀마다 drawImage(c*C, r*C, C, C)로 찍는다.
//  · base: 바닥 이름 → tile_<이름>[_a~_d][#색]. 변형은 (r,c) 해시로 고정(다시 그려도 안 바뀜). 색은 정원 바닥만(_FLOOR_COLORS).
//  · 잔디 번짐: 잔디가 아닌 칸의 4방 이웃이 잔디면 fringe_grass_{n,e,s,w}(2종 교차),
//    두 변이 잔디면 in_<모서리>, 변은 아닌데 대각선만 잔디면 out_<모서리>. (옛 꽃밭 flower·들꽃 잔디 wildflower 는 잔디로 친다)
//  · 물가: 물 칸의 이웃이 물이 아니면 shore_{n,e,s,w} / in_* / out_*. 물가 먼저, 잔디 번짐 나중.
//  · 꽃밭 가장자리: 꽃밭 무리 칸의 이웃이 꽃밭 무리가 아니면 bed_*#꽃잎색(마감이 있으면 rim_<마감>_*). 같은 열두 조각 판정.
//    순서 = 바탕 → 가장자리/마감 → 물가 → 잔디 번짐.
//  · base 파일이 없거나 아직 안 왔으면 false → 호출부가 기존 fillRect+텍스처로 그린다(폴백).
//    오버레이 조각이 없으면 그 조각만 건너뛴다.
//  · FLOOR_SVG=false 로 두면 전부 기존 방식(단색)으로 돌아간다.
const FLOOR_SVG = true;
const _FLOOR_IMG = {};   // name[#색] → {img, ok}  (없는 파일은 한 번만 시도)
// [DECO-FLOOR-COLOR-1] 색은 한 파일 안의 `:target` 규칙이다 — 주소 끝에 `#색`. 같은 파일이라도 색마다 Image 가 따로라서
//  **그 색이 마당에 실제로 있을 때만** 부른다(미리 부르지 않는다 — 정원 바닥을 안 쓴 마당은 요청이 하나도 안 는다).
function _floorImg(name, color) {
  const key = color ? name + '#' + color : name;
  const hit = _FLOOR_IMG[key];
  if (hit) return hit.ok ? hit.img : null;
  const img = new Image();
  const rec = { img, ok: false };
  _FLOOR_IMG[key] = rec;
  img.onload  = () => { rec.ok = (img.naturalWidth > 0 && img.naturalHeight > 0); if (rec.ok) { _drawDeco(); _ffRedrawSoon(); _floorPickSoon(); } };   // [DECO-FRIEND-ART-1] · [DECO-FLOOR-PICK-1] 고르기 판 그림도
  img.onerror = () => { rec.ok = false; };
  img.src = './assets/floor/' + encodeURIComponent(name) + '.svg' + (color ? '#' + color : '');
  return null;
}
// [DECO-FLOOR-PARSE-1] 바닥 저장값 해석은 여기 한 곳 — '이름#색+마감'(예 'tulipbed#red+picket' · 'hydrangea+stone'). 옛 값('stone')은 이름뿐이다.
//  · '#'·'+' 가 없는 값은 **이름 그대로**(옛 마당은 한 픽셀도 안 바뀐다) · 빈 값·글자가 아닌 값·못 읽는 새 형식은 잔디.
//  · 색·마감은 그림 주소와 캐시 키에 들어갈 값이라 [a-z0-9_] 만 받는다.
//  · 칸마다·이웃마다 불리므로 결과를 값별로 기억한다(얼린 객체 — 받은 쪽이 고치지 않는다).
//  · 지우개 판정('같은 값이면 걷어 낸다')은 저장값 글자 그대로 비교한다 = 색·마감까지 같을 때만.
function _floorParse(v) {
  const M = _floorParse._m || (_floorParse._m = new Map());
  let p = M.get(v);
  if (p) return p;
  let name = 'grass', color = '', rim = '';
  if (v && typeof v === 'string') {
    if (v.indexOf('#') < 0 && v.indexOf('+') < 0) name = v;
    else {
      const m = /^([a-z][a-z0-9_]*)(?:#([a-z0-9_]+))?(?:\+([a-z0-9_]+))?$/.exec(v);
      if (m) { name = m[1]; color = m[2] || ''; rim = m[3] || ''; }
    }
  }
  p = Object.freeze({ name, color, rim });
  if (M.size > 300) M.clear();
  M.set(v, p);
  return p;
}
const _FLOOR_VARIANTS = { grass:4, dirt:4, stone:2, flower:2, dry_earth:2, sand:2, water:2,
  tulipbed:2, tulipcol:2, hydrangea:3, wildflower:4, sunflowerbed:2, lavender:2, daisyfield:3 };   // [DECO-FLOOR-COLOR-1] 정원 바닥 7종
// [DECO-FLOOR-COLOR-1] 종류별로 그림 파일에 **실제로 있는** 색(기본색은 색 없음 = 'tulipbed'). 표에 없는 색은 기본색으로 그린다 —
//  저장본에 엉뚱한 색이 아무리 많아도 Image·비트맵이 이 표만큼만 생긴다. 표와 그림 파일이 맞는지는 단위 검사가 본다.
const _FLOOR_COLORS = {
  tulipbed: ['red', 'yellow', 'white', 'violet', 'orange', 'candy', 'sherbet', 'night'],
  tulipcol: ['red', 'yellow', 'white', 'violet', 'orange', 'candy', 'sherbet', 'night'],
  hydrangea: ['violet', 'pink', 'white', 'duo', 'moon'],
  wildflower: ['rainbow', 'snow'], sunflowerbed: ['orange', 'lemon'], lavender: ['pink', 'white'], daisyfield: ['yellow', 'pink'],
};
// [DECO-FLOOR-EDGE-1] 꽃밭 가장자리 — 이 표에 있는 종류가 '꽃밭 무리'다(들꽃 잔디는 풀이라 없다).
//  값 = 바탕 색 → 가장자리에 떨어진 꽃잎 색(bed_*.svg 의 일곱 색 중 하나). '' = 그 종류의 기본색 짝.
//  짝은 디자인 담당의 표 그대로(docs/deco_floor_edge_colors_20260920.md · #636). `_FLOOR_COLORS` 에 색이 늘면 여기도 한 줄 —
//  표에 없는 바탕 색은 그 바닥의 기본 짝('' 줄)으로 그린다.
const _FLOOR_BED_COLORS = ['pink', 'red', 'yellow', 'white', 'violet', 'orange', 'blue'];
const _FLOOR_RIMS = ['picket', 'stone', 'brick'];
const _FLOOR_EDGE_COLOR = Object.assign(Object.create(null), {   // (물려받은 이름 'constructor' 같은 값이 꽃밭으로 읽히지 않게)
  tulipbed:     { '': 'pink', red: 'red', yellow: 'yellow', white: 'white', violet: 'violet', orange: 'orange', candy: 'red', sherbet: 'pink', night: 'violet' },
  tulipcol:     { '': 'pink', red: 'red', yellow: 'yellow', white: 'white', violet: 'violet', orange: 'orange', candy: 'red', sherbet: 'pink', night: 'violet' },
  hydrangea:    { '': 'blue', violet: 'violet', pink: 'pink', white: 'white', duo: 'violet', moon: 'yellow' },
  lavender:     { '': 'violet', pink: 'pink', white: 'white' },
  sunflowerbed: { '': 'yellow', orange: 'orange', lemon: 'yellow' },
  daisyfield:   { '': 'white', yellow: 'yellow', pink: 'pink' },
});   // wildflower 는 풀밭의 한 종류라 이 표에 없다(가장자리 없음)
function _floorBaseName(type, r, c) {
  const n = _FLOOR_VARIANTS[type] || 0;
  if (!n) return 'tile_' + type;
  return 'tile_' + type + '_' + 'abcd'[(r*3 + c*7 + (r*c)%5) % n];
}
function _floorIsGrass(t) { return t === 'grass' || t === 'flower' || t === 'wildflower'; }   // 들꽃 잔디는 풀밭의 한 종류(가장자리 없음)
// 셀 하나(base + 가장자리). typeAt(r,c) → 타입 | null(격자 밖·집 영역 = 경계 없음으로 취급)
// [DECO-PERF-1] SVG 를 캔버스에 그리면 브라우저가 매번 새로 래스터한다(확대한 화면에서 바닥 612칸에 88ms).
//  한 번 비트맵으로 구워 두고 그걸 붙인다. 크기는 계단(약 19%씩)으로 굽는다 — 두 손가락으로 확대하는 동안
//  칸 크기가 조금씩 바뀌어도 같은 비트맵을 다시 쓴다(항상 필요한 크기 이상으로 구워 흐려지지 않는다).
const _SVG_BMP = new Map();
function _bmpStep(px) { return Math.max(4, Math.ceil(Math.pow(2, Math.ceil(Math.log2(Math.max(1, px)) * 4) / 4))); }
function _svgBmp(key, img, needW, ratio) {
  if (typeof document === 'undefined') return img;
  const w = _bmpStep(needW), h = Math.max(1, Math.round(w * ratio));
  const k = key + '|' + w;
  let b = _SVG_BMP.get(k);
  if (!b) {
    if (_SVG_BMP.size > 1500) _SVG_BMP.clear();   // 메모리 상한(대략 수십 MB 아래)
    b = document.createElement('canvas'); b.width = w; b.height = h;
    b.getContext('2d').drawImage(img, 0, 0, w, h);
    _SVG_BMP.set(k, b);
  }
  return b;
}
function _floorBmp(name, img, C) { return _svgBmp('f:' + name, img, C * 2, 1); }
function _drawFloorSVG(type, r, c, px, py, C, typeAt, color, rim) {
  const bname = _floorBaseName(type, r, c);
  const col = (color && _FLOOR_COLORS[type] && _FLOOR_COLORS[type].indexOf(color) >= 0) ? color : '';   // [DECO-FLOOR-COLOR-1]
  const base = _floorImg(bname, col);
  if (!base) return false;
  _dCtx.drawImage(_floorBmp(col ? bname + '#' + col : bname, base, C), px, py, C, C);   // 같은 파일·다른 색 = 다른 비트맵
  const T = (dr, dc) => { const t = typeAt(r + dr, c + dc); return (t == null) ? type : t; };
  const put = (name, ec) => { const img = _floorImg(name, ec); if (img) _dCtx.drawImage(_floorBmp(ec ? name + '#' + ec : name, img, C), px, py, C, C); };
  //  [DECO-FLOOR-EDGE-1] 변 넷 · 안 모서리 넷 · 바깥 모서리 넷 — 물가·꽃밭 가장자리·잔디 번짐이 같은 판정, 같은 순서다.
  //  n/e/s/w = 그 변의 이웃이 '바깥'인가 · out(dr,dc) = 그 대각선 이웃이 '바깥'인가 · v = 변 조각의 변형('' | '2') · ec = 조각 색
  const ring = (pre, v, ec, n, e, s, w, out) => {
    if (n) put(pre + 'n' + v, ec);
    if (e) put(pre + 'e' + v, ec);
    if (s) put(pre + 's' + v, ec);
    if (w) put(pre + 'w' + v, ec);
    if (n && e) put(pre + 'in_ne', ec);
    if (n && w) put(pre + 'in_nw', ec);
    if (s && e) put(pre + 'in_se', ec);
    if (s && w) put(pre + 'in_sw', ec);
    if (!n && !e && out(-1, 1))  put(pre + 'out_ne', ec);
    if (!n && !w && out(-1, -1)) put(pre + 'out_nw', ec);
    if (!s && !e && out(1, 1))   put(pre + 'out_se', ec);
    if (!s && !w && out(1, -1))  put(pre + 'out_sw', ec);
  };
  const v2 = ((r*5 + c*3) % 2) ? '2' : '';
  //  꽃밭 무리(들꽃 잔디 빼고 6종): 이웃이 꽃밭 무리가 **아닌** 변에만 가장자리. 마감이 있으면 rim_<마감>_*(색 없음), 없으면 bed_*#꽃잎색.
  //  · 종류·색이 달라도 꽃밭끼리 맞닿은 변은 안 그린다 — 색을 번갈아 깔면 줄무늬 화단 하나가 된다. 잔디 번짐은 안 그린다.
  //  · 마감 있는 칸은 **같은 마감의 꽃밭**만 안쪽으로 친다 → 울타리는 늘 빙 둘러 닫힌다(마감 없는 옆 밭은 그 울타리까지 꽃이 닿는다).
  const EC = _FLOOR_EDGE_COLOR[type];
  if (EC) {
    const rimOf = x => (x && _FLOOR_RIMS.indexOf(x) >= 0) ? x : '';
    const rm = rimOf(rim);
    const out = (dr, dc) => {
      const t = typeAt(r + dr, c + dc);
      if (t == null) return false;                       // 격자 밖·집 = 경계 없음(물가와 같다)
      if (!_FLOOR_EDGE_COLOR[t]) return true;
      return !!rm && rimOf(typeAt(r + dr, c + dc, true)) !== rm;
    };
    let ec = '';
    if (!rm) { ec = (col && Object.prototype.hasOwnProperty.call(EC, col)) ? EC[col] : EC['']; if (ec === 'pink') ec = ''; }   // bed_* 의 기본색 = pink(주소에 안 붙인다)
    ring(rm ? 'rim_' + rm + '_' : 'bed_', v2, ec, out(-1, 0), out(0, 1), out(1, 0), out(0, -1), out);
    return true;
  }
  //  [DECO-WATER-ORDER-1] 물 칸은 **물가(shore_*)를 먼저, 잔디 번짐(fringe_grass_*)을 나중에** — 풀이 모래 띠 위로 번져
  //  '풀 둑 + 모래톱 + 잔물결'이 된다(디자인 담당 #503 의 새 물가 그림 전제).
  if (type === 'water') {
    const out = (dr, dc) => T(dr, dc) !== 'water';
    ring('shore_', '', '', out(-1, 0), out(0, 1), out(1, 0), out(0, -1), out);
  }
  if (!_floorIsGrass(type)) {
    const out = (dr, dc) => _floorIsGrass(T(dr, dc));
    ring('fringe_grass_', v2, '', out(-1, 0), out(0, 1), out(1, 0), out(0, -1), out);
  }
  return true;
}
// 집 안 벽 띠(벽지+걸레받이+창)와 마루. 그려졌으면 true(호출부가 구식 창문을 생략).
function _drawIndoorFloorSVG(offX, offY, C, W) {
  //  [INDOOR-LOOK-1] 고른 벽지·바닥 — 고르지 않았으면 지금 그림(파일 이름까지 같다). 친구 구경은 CUR 이 친구라 친구 것이 나온다.
  const look = _inLookParse(_inLookGet(CUR));
  const [fa, fc] = _inLookArt('floor', look.floor), [wa, wc] = _inLookArt('wall', look.wall);
  const wood = _floorImg(fa, fc);
  if (wood) for (let r = 0; r < DI.rows; r++) for (let c = 0; c < DI.cols; c++) _dCtx.drawImage(wood, offX + c*C, offY + r*C, C, C);
  const wall = _floorImg(wa, wc);
  if (!wall) return false;
  // 벽 타일의 아래 끝을 바닥 윗선(offY)에 맞추고 위로 채운다. 맨 윗줄은 잘려도 된다.
  const x0 = offX - Math.ceil(offX / C) * C;
  for (let y = offY - C; y > -C; y -= C) for (let x = x0; x < W; x += C) _dCtx.drawImage(wall, x, y, C, C);
  const bb = _floorImg('wall_baseboard');
  if (bb) for (let x = x0; x < W; x += C) _dCtx.drawImage(bb, x, offY - C, C, C);
  const win = _floorImg('wall_window');
  //  [INDOOR-WALL-1] 액자를 건 칸의 고정 창은 그리지 않는다(창 위에 액자가 겹쳐 보이지 않게)
  const hungCols = new Set(); _decoList(CUR).forEach(p => { if (p.area === 'indoor' && p.row === 0 && _isWallDeco(p.id)) for (let k = 0; k < getDecoSize(p.id).w; k++) hungCols.add(p.col + k); });
  if (win) [1, 5, 9].forEach(cc => { if (cc < DI.cols && !hungCols.has(cc)) _dCtx.drawImage(win, offX + cc*C, offY - C, C, C); });
  return true;
}
function _isFloorLayerDeco(p) {
  const d = GAME_DATA.decorations.find(x => x.id === p.id);
  return !!(d && d.layer === 'floor');
}
// ══ /FLOOR-SVG-1 ══════════════════════════════════════════

function _drawDeco() {
  try { _decoHandSync(); } catch (e) {}   // [DECO-PAN-1]
  if (!_dCtx) return;
  if (_drawDecoRaf) return; // 이미 RAF 예약됨 — 중복 방지
  _drawDecoRaf = requestAnimationFrame(() => {
    _drawDecoRaf = null;
    if (!_dCtx) return;
    // [DECO-ZOOM-1] 보이는 창만 옮긴다 — 그리는 코드는 판 좌표를 그대로 쓴다
    _dCtx.setTransform(2, 0, 0, 2, 0, 0);
    _dCtx.clearRect(0, 0, _dW, _dH);
    _dCtx.setTransform(2, 0, 0, 2, -_dPanX * 2, -_dPanY * 2);
    if (DECO_SCENE === 'yard') { _drawYard(); if (_decoRectPrev) _drawRectPreview(); }   // [DECO-FLOOR-RECT-1] 끄는 동안의 네모
    else _drawIndoor();
    if (_decoHover && SEL_DECO) _decoDrawGhost(DECO_SCENE === 'yard' ? 'yard' : 'indoor', DECO_SCENE === 'yard' ? 0 : (_dCv._offX || 0), DECO_SCENE === 'yard' ? 0 : (_dCv._offY || 0), _dC);   // [DECO-SEL-HL-1]
    // [DECO-ANIM-1] 캔버스 위 동물 층 맞추기(마당만)
    _animSyncLayer(_ifActiveContainer || 'house-topview', CUR, DECO_SCENE, _dC, _dW, _dH, _dPanX, _dPanY);
  });
}

// [DECO-HOUSE-ART-1] 마당 '내 집' 한 장 — viewBox 600×400 · 한 칸 = 100 · 발밑 y100~400(= 집 자리 3줄) · 굴뚝 끝만 한 칸 위로.
//  이름은 오른쪽 앞 푯말(글 가운데 x517·y343 · 폭 x446~588)에, '들어가기'는 문 앞 작은 표로.
function _drawYardHouseArt(img, hx, hw, C) {
  const ctx = _dCtx, y0 = -C, h = hw * (img.naturalHeight / img.naturalWidth);
  //  집 칸은 바닥 그리기가 건너뛴다(옛 그리기는 네모로 덮었다) → 그림 둘레가 비지 않게 잔디를 먼저 깐다
  const c0 = _houseCol0(), grass = () => 'grass';
  for (let r = 0; r < DH.rows; r++) for (let c = c0; c < c0 + DH.cols; c++) {
    if (!(FLOOR_SVG && _drawFloorSVG('grass', r, c, c * C, r * C, C, grass))) { ctx.fillStyle = (r + c) % 2 ? FLOOR_TILES.grass.alt : FLOOR_TILES.grass.bg; ctx.fillRect(c * C, r * C, C, C); }
  }
  ctx.drawImage(_svgBmp('d:yard_house', img, hw * 2, img.naturalHeight / img.naturalWidth), hx, y0, hw, h);
  const u = hw / 600;   // 그림 한 단위 = 캔버스 px
  const name = CUR && CUR.name ? CUR.name : '내 집';
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#3b2a18';
  let fs = Math.max(7, 26 * u); ctx.font = `700 ${fs}px sans-serif`;
  const maxW = 130 * u, tw = ctx.measureText(name).width;
  if (tw > maxW) { fs = Math.max(6, fs * maxW / tw); ctx.font = `700 ${fs}px sans-serif`; }
  ctx.fillText(name, hx + 517 * u, y0 + 343 * u);
  //  문 앞 작은 표
  const tf = Math.max(7, 20 * u); ctx.font = `700 ${tf}px sans-serif`;
  const tag = '들어가기', tw2 = ctx.measureText(tag).width + tf;
  ctx.fillStyle = 'rgba(20,24,32,.72)'; _drr(hx + 300 * u - tw2 / 2, y0 + 360 * u, tw2, tf * 1.5, tf * .5); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(tag, hx + 300 * u, y0 + 360 * u + tf * .78);
  ctx.restore();
}
function _drawYard() {
  const C = _dC, W = _dW, H = _dH;
  const hx = _houseCol0() * C, hh = DH.rows * C, hw = DH.cols * C;

  // 셀별 바닥 타일
  // [FLOOR-SVG-1] 이웃 타입 조회 — 격자 밖·집 영역은 null(경계 없음)
  const _yardTypeAt = (rr, cc, wantRim) => (rr < 0 || cc < 0 || rr >= DY.rows || cc >= DY.cols || _isHC(rr, cc))
    ? null : _floorParse(_yardFloorGet(CUR)[rr+'_'+cc])[wantRim ? 'rim' : 'name'];   // [DECO-SPACE-1] · [DECO-FLOOR-PARSE-1] 이웃 판정은 이름으로
  const _vis = _decoVisible(DY.rows, DY.cols);   // [DECO-ZOOM-1] 보이는 칸만
  const _floorCells = (v) => {
    const fl = _yardFloorGet(CUR);
    for(let r=v.r0;r<v.r1;r++) for(let c=v.c0;c<v.c1;c++){
      if(_isHC(r,c)) continue;
      const tkey = r+'_'+c;
      const fp = _floorParse(fl[tkey]), ttype = fp.name;   // [DECO-FLOOR-PARSE-1] 옛 값은 이름 그대로
      const tile = FLOOR_TILES[ttype]||FLOOR_TILES.grass;
      if (FLOOR_SVG && _drawFloorSVG(ttype, r, c, c*C, r*C, C, _yardTypeAt, fp.color, fp.rim)) continue;   // [FLOOR-SVG-1] SVG 있으면 그걸로 끝
      _dCtx.fillStyle = (r+c)%2===0 ? tile.bg : tile.alt;
      _dCtx.fillRect(c*C, r*C, C, C);
      _drawTileTexture(ttype, c, r, C);
    }
  };
  _floorCells(_vis);
  // 나무 타일은 가로줄 추가 (무늬) — texture 함수로 통합했으므로 기존 loop 삭제

  // ══════════════════════════════════════════════════════
  // 집 건물 (우상단, DH: 6칸×3칸)
  // ══════════════════════════════════════════════════════
  //  [DECO-HOUSE-ART-1] 그림(assets/deco/yard_house.svg — 디자인 #858)이 오면 그 한 장으로 그린다(판자처럼 보이던 네모+글자 · 디자인 D1).
  //   그림이 아직 안 왔으면 아래 옛 그리기 그대로.
  const _houseArt = FLOOR_SVG && _decoImg('yard_house');
  if (_houseArt) _drawYardHouseArt(_houseArt, hx, hw, C);
  else {
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
    //  [DECO-VIEW-FIT-1] 집 둘레는 집 폭까지만(마당이 80칸으로 넓어진 뒤 집 오른쪽 잔디를 판 끝까지 가로지르던 줄 — 디자인 ⑯) + 오른쪽 변
    _dCtx.beginPath(); _dCtx.moveTo(hx,hh); _dCtx.lineTo(hx+hw,hh); _dCtx.lineTo(hx+hw,0); _dCtx.stroke();
  }
  }   // [DECO-HOUSE-ART-1] 옛 그리기 끝

  // 격자 (집 영역 제외) — [DECO-VIEW-FIT-1] 판 크기까지(전엔 캔버스 크기 W·H 까지라 오른쪽·아래로 밀면 격자가 없었다 · 집 오른쪽 칸 위 3줄도)
  const BW = DY.cols*C, BH = DY.rows*C;
  _dCtx.strokeStyle='rgba(255,255,255,.12)'; _dCtx.lineWidth=.5;
  _dCtx.beginPath();
  for(let r=0;r<=DY.rows;r++){
    if(r<DH.rows){ _dCtx.moveTo(0,r*C); _dCtx.lineTo(hx,r*C); _dCtx.moveTo(hx+hw,r*C); _dCtx.lineTo(BW,r*C); }
    else { _dCtx.moveTo(0,r*C); _dCtx.lineTo(BW,r*C); }
  }
  for(let c=0;c<=DY.cols;c++){
    const x=c*C;
    if(x>hx && x<hx+hw){ _dCtx.moveTo(x,hh); _dCtx.lineTo(x,BH); }
    else { _dCtx.moveTo(x,0); _dCtx.lineTo(x,BH); }
  }
  _dCtx.stroke();

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
      // [DECO-SEL-HL-1] 놓을 수 있는 칸을 칸마다 한 번 + 둘레 한 줄 — 보이는 칸만 그린다(세는 것은 상태가 바뀔 때 한 번)
      _decoDrawOkCells(_decoOkCells('yard'), 0, 0, C, _decoVisible(DY.rows, DY.cols));
    }
  }

  // 배치된 마당 장식 - footprint 전체를 채우는 bounding box 렌더
  // [DECO-SVG-1] 뒤(윗줄)부터 그린다 — SVG가 위로 넘칠 수 있어 앞줄이 가리게 해야 한다
  _decoSorted(_decoList(CUR).filter(p=>p.area==='yard')).forEach(p=>{   // [DECO-SPACE-1]
    const fn=_DFN[p.id], d=GAME_DATA.decorations.find(x=>x.id===p.id);
    if(!d) return;
    if(ANIM_DECO[p.id]) return;   // [DECO-ANIM-1] 움직이는 동물은 캔버스 위 층에서 그린다
    const drawId = d.autoFence ? _fenceArtFor(CUR, p.row, p.col) : p.id;   // [DECO-FENCE-1]
    const sz=d.size||{w:1,h:1};
    const px=p.col*C, py=p.row*C;
    const bw=sz.w*C, bh=sz.h*C;
    if(_drawDecoSVG(drawId, px, py, bw, bh)) return;   // SVG 있으면 그걸로 끝
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
  if (_houseArt) {   // [DECO-HOUSE-ART-1] 그림 속 문 자리(viewBox x268~332 · y248~352, 한 칸 = 100)
    _dCv._doorX = hx + 2.68 * C; _dCv._doorY = -C + 2.48 * C; _dCv._doorW = 0.64 * C; _dCv._doorH = 1.04 * C;
  } else {
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
  // [DECO-ZOOM-1] 예전에는 '보이는 칸 수'(_dW/_dC)로 재서 창 크기·확대에 따라 농장이 움직였다
  //  (기기마다 자리가 달라지고, 확대하면 밭이 따라다녔다). 기준 판에 고정한다.
  const bc = Math.min(DY.cols, DY_BASE.cols), br = Math.min(DY.rows, DY_BASE.rows);
  const startCol = bc - fc - 1;
  const startRow = br - fr - 1;
  return { startCol, startRow, cols: fc, rows: fr };
}

function _isFarmCell(r, c) {
  if (DECO_SPACE !== 1) return false;   // [DECO-SPACE-1] 농장은 공간 1 에만
  const {startCol, startRow, cols, rows} = _getFarmZone();
  return r >= startRow && r < startRow + rows && c >= startCol && c < startCol + cols;
}

function _drawYardFarm(C) {
  if (DECO_SPACE !== 1) return;   // [DECO-PT-3] 밭은 공간 1 에만(그림도) — 공간 2·3 에서 장식을 가리던 것
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

// [INDOOR-ROOMS-1] 빈 터 + 방들 — 규칙 docs/indoor_look_rules_20260920.md §1(빈 터 도면) · §2(벽 띠·벽·문)
function _inDrawRooms(rooms, offX, offY, C) {
  const ctx = _dCtx, cols = DI.cols, rows = DI.rows;
  //  빈 터 — 짙은 남색 + 옅은 칸줄, 5칸마다 조금 진하게(판 밖까지 칠해 확대해 밀어도 끊기지 않게)
  ctx.fillStyle = '#161b28'; ctx.fillRect(-C * 60, -C * 60, cols * C + offX * 2 + C * 120, rows * C + offY * 2 + C * 120);
  ctx.lineWidth = 1;
  for (let c = 0; c <= cols; c++) { ctx.strokeStyle = c % 5 ? 'rgba(140,170,220,.09)' : 'rgba(140,170,220,.2)';
    ctx.beginPath(); ctx.moveTo(offX + c * C + .5, offY - C); ctx.lineTo(offX + c * C + .5, offY + rows * C); ctx.stroke(); }
  for (let r = -1; r <= rows; r++) { ctx.strokeStyle = r % 5 ? 'rgba(140,170,220,.09)' : 'rgba(140,170,220,.2)';
    ctx.beginPath(); ctx.moveTo(offX, offY + r * C + .5); ctx.lineTo(offX + cols * C, offY + r * C + .5); ctx.stroke(); }
  const t = Math.max(3, C * .16), bb = _floorImg('wall_baseboard');
  rooms.forEach(rm => {
    const [fa, fc] = _inLookArt('floor', rm.floor), [wa, wc] = _inLookArt('wall', rm.wall);
    const fi = _floorImg(fa, fc), wi = _floorImg(wa, wc), x0 = offX + rm.c * C, y0 = offY + rm.r * C;
    ctx.fillStyle = '#C4955A'; ctx.fillRect(x0, y0, rm.w * C, rm.h * C);
    ctx.fillStyle = '#8B6520'; ctx.fillRect(x0, y0 - C, rm.w * C, C);
    for (let c = 0; c < rm.w; c++) {
      if (fi) for (let r = 0; r < rm.h; r++) ctx.drawImage(fi, x0 + c * C, y0 + r * C, C, C);
      if (wi) ctx.drawImage(wi, x0 + c * C, y0 - C, C, C);
      if (bb) ctx.drawImage(bb, x0 + c * C, y0 - C, C, C);
    }
    //  벽 그림자 — 벽 띠가 바닥에서 떨어져 서 있어 보이게
    const g = ctx.createLinearGradient(0, y0, 0, y0 + C * .35);
    g.addColorStop(0, 'rgba(40,20,5,.22)'); g.addColorStop(1, 'rgba(40,20,5,0)');
    ctx.fillStyle = g; ctx.fillRect(x0, y0, rm.w * C, C * .35);
  });
  //  벽 — 칸을 차지하지 않는 막대(윗면 · 옆 · 아래) + 위쪽 밝은 줄
  rooms.forEach(rm => {
    const x0 = offX + rm.c * C, y0 = offY + (rm.r - 1) * C, x1 = offX + (rm.c + rm.w) * C, y1 = offY + (rm.r + rm.h) * C;
    ctx.fillStyle = '#5b3a20';
    ctx.fillRect(x0 - t / 2, y0 - t / 2, x1 - x0 + t, t);
    ctx.fillRect(x0 - t / 2, y0, t, y1 - y0); ctx.fillRect(x1 - t / 2, y0, t, y1 - y0);
    ctx.fillRect(x0 - t / 2, y1 - t / 2, x1 - x0 + t, t);
    ctx.fillStyle = '#8a5e36'; ctx.fillRect(x0 - t / 2, y0 - t / 2, x1 - x0 + t, t * .35);
  });
  //  저절로 난 문 — 옆으로 맞닿은 벽의 가운데 두 줄: 벽을 비우고 문턱
  _inRoomDoors(rooms).forEach(d => {
    const x = offX + d.col * C, y = offY + d.r0 * C, h = (d.r1 - d.r0) * C;
    ctx.fillStyle = '#c9a06a'; ctx.fillRect(x - t * .8, y, t * 1.6, h);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x - t * .8, y, 1.2, h); ctx.fillRect(x + t * .8 - 1.2, y, 1.2, h);
  });
}
function _drawIndoor() {
  const C = _dC, W = _dW, H = _dH;
  // [DECO-PT-1] 확대하면 (W−판)/2 가 음수가 되어 왼쪽 칸에 못 가고 오른쪽이 까맸다 → 음수면 0, 나머지는 화면 밀기가
  const offX = Math.max(0, Math.floor((W - DI.cols*C)/2));
  const offY = Math.max(Math.floor(C*.9), Math.floor((H - DI.rows*C)/2));

  //  [INDOOR-ROOMS-1] 방이 있으면 빈 터(도면) 위에 방들 — 없으면 아래 지금 그대로(한 픽셀도 안 바뀐다)
  const _rooms = _inRooms(CUR);
  let wallSvgOk = true;
  if (_rooms.length) _inDrawRooms(_rooms, offX, offY, C);
  else {
  // 벽 — [DECO-PT-1] 확대해 밀어도 벽이 끊기지 않게 판 전체 크기로 칠한다
  _dCtx.fillStyle='#8B6520'; _dCtx.fillRect(0,0,Math.max(W,offX*2+DI.cols*C),Math.max(H,offY+DI.rows*C+C));
  // 바닥
  _dCtx.fillStyle='#C4955A'; _dCtx.fillRect(offX,offY,DI.cols*C,DI.rows*C);
  for(let r=0;r<DI.rows;r++){_dCtx.fillStyle=r%2?'rgba(255,255,255,.03)':'rgba(0,0,0,.05)';_dCtx.fillRect(offX,offY+r*C,DI.cols*C,C);}

  // [FLOOR-SVG-1] 벽지·걸레받이·창 + 마루 (조각이 없으면 위 단색 그대로)
  wallSvgOk = FLOOR_SVG && _drawIndoorFloorSVG(offX, offY, C, W);
  }

  // 가구 하나 그리기 (SVG → _DFN → 이모지 순 폴백)
  const _drawIndoorItem = p => {
    const fn=_DFN[p.id], d=GAME_DATA.decorations.find(x=>x.id===p.id);
    if(!d) return;
    const sz=d.size||{w:1,h:1};
    const px=offX+p.col*C, py=offY+p.row*C;
    const bw=sz.w*C, bh=sz.h*C;
    if(_drawDecoSVG(p.id, px, py, bw, bh)) return;   // [DECO-SVG-1]
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
  };
  const _indoorPlaced = _decoList(CUR).filter(p=>p.area==='indoor');   // [DECO-SPACE-1]
  // [FLOOR-SVG-1] 바닥 레이어(러그) — 격자·가구보다 먼저
  _decoSorted(_indoorPlaced.filter(_isFloorLayerDeco)).forEach(_drawIndoorItem);

  // 창문 (위쪽 벽) — 벽 SVG가 그려졌으면 생략
  if(offY > 14 && !wallSvgOk){
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
  if(SEL_DECO && _isWallDeco(SEL_DECO)){   // [INDOOR-WALL-1] 벽걸이 카드 — 벽 띠의 빈 칸만 밝게
    _dCtx.fillStyle='rgba(255,216,102,.3)'; _dCtx.strokeStyle='rgba(255,216,102,.9)'; _dCtx.lineWidth=Math.max(1,C*.05);
    const wallRows = _rooms.length ? _rooms.map(rm => [rm.r, rm.c, rm.w]) : [[0, 0, DI.cols]];   // [INDOOR-ROOMS-1] 방이 있으면 방마다 윗벽
    wallRows.forEach(([wr, c0, w]) => { for(let c=c0;c<c0+w;c++) if(!_decoList(CUR).some(p=>p.area==='indoor'&&p.row===wr&&_isWallDeco(p.id)&&c>=p.col&&c<p.col+getDecoSize(p.id).w)){
      _dCtx.fillRect(offX+c*C+2,offY+(wr-1)*C+2,C-4,C-4); _dCtx.strokeRect(offX+c*C+2,offY+(wr-1)*C+2,C-4,C-4);
    } });
  } else if(SEL_DECO && GAME_DATA.decorations.find(x=>x.id===SEL_DECO)?.cat==='indoor'){
    // [DECO-SEL-HL-1] 크기·방 벽·깔개 규칙까지 본 '놓을 수 있는 칸' — 칸마다 한 번 + 둘레 한 줄(전엔 빈 1칸만 칠해 큰 가구가 안 들어가는 곳도 밝았다)
    _decoDrawOkCells(_decoOkCells('indoor'), offX, offY, C, { r0: 0, c0: 0, r1: DI.rows, c1: DI.cols });
  }

  // [INDOOR-WALL-1] 벽걸이 — 0번 줄에 놓인 것은 한 칸 위 벽 띠에(벽걸이 판이 있으면 그것, 없으면 몸통을 띠에). 가구보다 먼저 = 가구가 그 앞에 선다
  const _onWall = p => _isWallDeco(p.id) && _inIsWallRow(p.row, p.col);   // [INDOOR-ROOMS-1] 판 맨 윗줄 또는 방 윗줄
  _indoorPlaced.filter(_onWall).forEach(p => {
    const sz = getDecoSize(p.id), px = offX + p.col * C, py = offY + (p.row - 1) * C;
    const art = DECO_WALL_ART[p.id] && _decoImg(DECO_WALL_ART[p.id]);
    if (art) _dCtx.drawImage(art, px, py, sz.w * C, C);
    else _drawDecoSVG(p.id, px, py, sz.w * C, C);
  });
  // 배치된 가구 (바닥 레이어 제외 — 러그는 위에서 먼저 그렸다)
  _decoSorted(_indoorPlaced.filter(p=>!_isFloorLayerDeco(p) && !_onWall(p))).forEach(_drawIndoorItem);

  // 나가기 문
  const _low = _rooms.slice().sort((a, b) => (b.r + b.h) - (a.r + a.h) || a.c - b.c)[0];   // [INDOOR-ROOMS-1]
  const dx = _low ? offX + (_low.c + _low.w / 2) * C - C * .35 : offX+DI.cols*C/2-C*.35;
  const dy = _low ? offY + (_low.r + _low.h) * C - C * .75 : offY+DI.rows*C-C*.75;
  _dCtx.fillStyle='#5a3010'; _drr(dx,dy,C*.7,C*.75,3); _dCtx.fill();
  _dCtx.strokeStyle='#3a1e08'; _dCtx.lineWidth=1.5; _dCtx.strokeRect(dx,dy,C*.7,C*.75);
  _dCtx.fillStyle='#FFD700'; _dc(dx+C*.58,dy+C*.38,C*.07); _dCtx.fill();
  _dCtx.fillStyle='rgba(255,255,255,.72)'; _dCtx.font=`${Math.max(C*.18,8)}px sans-serif`; _dCtx.textAlign='center';
  _dCtx.fillText('나가기', dx+C*.35, dy-C*.1);

  _dCv._doorX=dx; _dCv._doorY=dy; _dCv._doorW=C*.7; _dCv._doorH=C*.75;
  _dCv._offX=offX; _dCv._offY=offY;
  //  [INDOOR-ROOMS-1] 끄는 중인 네모 — 방 칸 + 벽 띠 줄까지 금색 점선(안 되면 붉게)
  if (_inRoomPrev) {
    const p = _inRoomPrev, x = offX + p.c * C, y = offY + (p.r - 1) * C, w = p.w * C, h = (p.h + 1) * C;
    _dCtx.fillStyle = p.why ? 'rgba(255,110,90,.2)' : 'rgba(255,216,102,.2)'; _dCtx.fillRect(x, y, w, h);
    _dCtx.save(); _dCtx.setLineDash([Math.max(4, C * .3), Math.max(3, C * .2)]); _dCtx.lineWidth = 3;
    _dCtx.strokeStyle = p.why ? '#ff8a73' : '#ffd866'; _dCtx.strokeRect(x, y, w, h); _dCtx.restore();
  }
}

function _decoClick(e) {
  if(!_dCv||!_dCtx) return;
  if(_dSuppressClick) return;   // [DECO-ZOOM-1] 화면을 끈 직후·핀치 직후의 클릭은 놓기가 아니다
  const _bp=_decoBoardPoint(e.clientX, e.clientY);   // [DECO-ZOOM-1] 이동·확대 반영
  const mx=_bp.x, my=_bp.y;
  const C=_dC;

  // 문 클릭 체크
  const {_doorX:dx,_doorY:dy,_doorW:dw,_doorH:dh}=_dCv;
  if(dx!==undefined&&mx>=dx&&mx<=dx+dw&&my>=dy&&my<=dy+dh){ toggleDecoScene(); return; }

  if(DECO_SCENE==='yard'){
    const c=Math.floor(mx/C), r=Math.floor(my/C);
    if(c<0||c>=DY.cols||r<0||r>=DY.rows) return;
    if(_isHC(r,c)){ toast('🏠 집이 있는 자리예요 — 집 밖에 놓아요'); return; }   // [DECO-WORDS-1]
    // 농장 존 클릭 차단 (수확은 농장 탭에서만)
    if(_isFarmCell(r,c)){ toast('🌾 여기는 밭이에요 — 밭에는 장식을 놓을 수 없어요'); return; }   // [DECO-PT-1]
    _decoLastTap = { area: 'yard', r, c, t: Date.now() };   // [DECO-DRAG-1]
    if(DECO_MODE==='floor') { _paintFloor(r,c); return; }
    // [DECO-ANIM-2] 카드를 안 고른 상태에서 동물을 누르면 반응(놓기가 먼저다)
    //  [DECO-SEL-A5] 카드를 들었어도 — 보이는 동물을 누른 것은 쓰다듬기다(전엔 그 발밑에 하나가 더 놓였다 · 창조자 27회 ⓐ5)
    if(DECO_MODE!=='erase'){   // [DECO-PT-2] 치우기 모드에서는 동물도 치운다(전엔 동물을 치울 방법이 없었다)
      const pet=_animAt(_ifActiveContainer||'house-topview', r, c);
      if(pet && _animPoke(pet, c)) return;
    }
    _decoPlace('yard',r,c);
  } else {
    const {_offX:ox,_offY:oy}=_dCv;
    const c=Math.floor((mx-ox)/C), r=Math.floor((my-oy)/C);
    //  [INDOOR-LOOK-1] 🖌️ 벽지·바닥 — 방(판) 어디를 눌러도, 벽 띠를 눌러도 그 방이 바뀐다
    if(DECO_MODE==='floor'){ if(c>=0&&c<DI.cols&&r>=-1&&r<DI.rows) _inTap(r,c); return; }   // [INDOOR-ROOMS-1] 방 · 벽지 · 바닥
    //  [INDOOR-WALL-1] 벽 띠를 누르면 — 벽걸이 카드를 들었으면 거기(0번 줄)에 건다 · 빈손·🧽 이면 거기 걸린 것을 치운다
    //  판 맨 위 벽 띠 · [INDOOR-ROOMS-1] 방의 벽 띠(그 칸에 가구가 서 있지 않을 때) — 벽 줄(wr)의 벽이다
    const bandCell=_decoCellAt(e.clientX, e.clientY);
    if(bandCell && bandCell.band){
      const wr=bandCell.r;
      if(SEL_DECO && DECO_MODE!=='erase'){
        if(_isWallDeco(SEL_DECO)) _decoPlace('indoor',wr,c);
        else toast('🖼️ 벽에는 액자 같은 벽걸이만 걸 수 있어요');
        return;
      }
      const hung=_decoTopAt('indoor',wr,c,false,true);
      if(hung) _decoRemoveOne(hung);
      return;
    }
    if(c<0||c>=DI.cols||r<0||r>=DI.rows) return;
    _decoLastTap = { area: 'indoor', r, c, t: Date.now() };   // [DECO-DRAG-1]
    _decoPlace('indoor',r,c);
  }
}

// ══ 꾸미기 저장 묶기 (DECO-SAVE-1) ══════════════════════════
//  꾸미기 조작 한 번 = 학생 문서 **통째** 저장이었다(실측: 바닥 20칸 = 20번, 한 번에 평균 26KB → 약 520KB).
//  '무엇을 저장하는지'는 한 글자도 바꾸지 않는다. **'언제' 저장하는지만** 0.4초로 묶는다.
//  대상은 꾸미기 쓰기 3곳뿐(_paintFloor · _decoPlace 놓기/치우기). 골드·상점·전투·농장은 손대지 않는다.
//  잃는 것 0: 아래 자리에서 **즉시 저장(flush)** 한다 —
//   씬 바꿈 · 전체화면 닫기 · 내 집 창 닫기·다른 탭 · 앱 가려짐 · 페이지 닫힘 ·
//   **다른 곳에서 CUR 이 갈릴 때(스냅샷 직전)**.
const DECO_SAVE_MS = 400;
let _decoSaveTimer = null;

function decoDirty() {
  _decoStateVer++;   // [DECO-SEL-HL-1] 놓을 수 있는 칸 모음을 다시 세게
  if (_decoSaveTimer) clearTimeout(_decoSaveTimer);
  _decoSaveTimer = setTimeout(() => { _decoSaveTimer = null; DB.saveStudent(CUR); }, DECO_SAVE_MS);
}

//  대기 중이던 것을 지금 보낸다. 대기 중이 아니면 아무 일도 안 한다(쓰기가 늘지 않는다).
function decoFlush(why) {
  if (!_decoSaveTimer) return false;
  clearTimeout(_decoSaveTimer); _decoSaveTimer = null;
  try { DB.saveStudent(CUR); } catch (e) { console.error('꾸미기 저장 실패(' + why + ')', e); }
  return true;
}

//  [DECO-SHOP-1] 방금 **다른 통째 저장**(마당 안 상점의 구매)이 나갔다 — 대기 중이던 꾸미기 변경은 그 저장에 이미 실려 갔다.
//  대기만 푼다(쓰기 0). 구매 때문에 쓰기가 한 번 더 나가지 않게 — 구매 1번 = 저장 1번(본편 상점과 같다).
function decoSaveAbsorbed() {
  if (_decoSaveTimer) { clearTimeout(_decoSaveTimer); _decoSaveTimer = null; }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) decoFlush('가려짐'); });
  addEventListener('pagehide', () => decoFlush('페이지 닫힘'));
}

// ══ 꾸미기 되돌리기 ↩ 20단계 (DECO-UNDO-1) ═══════════════════
//  마을(3D) 규칙 그대로: 20단계 · **맨 위만** 되돌린다(기록 중간을 고치지 않는다) ·
//  **다시 열면 0단계**(기억에만 — 저장하지 않는다, 저장 형식 변경 0) · 끌어서 죽 놓은 것은 한 단계.
//  골드는 건드리지 않는다 — 장식은 환불이 없고, 가진 개수는 '놓인 수'로 세므로 되돌리면 저절로 맞는다.
//  되돌린 것도 꾸미기 묶음 저장(DECO-SAVE-1)을 탄다 → 되돌리기 때문에 쓰기가 늘지 않는다.
const DECO_UNDO_MAX = 20;
let _decoUndo = [];

function _decoUndoPush(rec) {
  _decoUndo.push(rec);
  if (_decoUndo.length > DECO_UNDO_MAX) _decoUndo.shift();
  _decoUndoSync();
}
function _decoUndoClear() { _decoUndo = []; _decoUndoSync(); }

//  끌어서 죽 놓은 것을 한 단계로(K2 가 쓴다). 빈 목록은 쌓지 않는다.
function decoUndoStroke(list) { if (list && list.length) _decoUndoPush({ t: 'stroke', list }); }

function _decoUndoSync() {
  const b = document.getElementById('if-undo-btn');
  if (!b) return;
  const n = _decoUndo.length;
  b.disabled = !n;
  b.style.opacity = n ? '1' : '.35';
  b.title = n ? '되돌리기 (' + n + ')' : '되돌릴 것이 없어요';
}

//  한 줄을 거꾸로 — 성공하면 true
function _decoUndoOne(rec) {
  if (rec.t === 'place') {
    const list = CUR.houseDecorations || [];
    const i = list.findIndex(p => p.id === rec.p.id && p.area === rec.p.area && p.row === rec.p.row && p.col === rec.p.col
      && _decoSpaceOf(p) === _decoSpaceOf(rec.p));   // [DECO-SPACE-1]
    if (i < 0) return false;
    CUR.houseDecorations = list.slice(0, i).concat(list.slice(i + 1));
    return true;
  }
  if (rec.t === 'remove') {
    const d = GAME_DATA.decorations.find(x => x.id === rec.p.id);
    if (!d) return false;
    const sz = d.size || { w: 1, h: 1 };
    const placed = CUR.houseDecorations || [];
    const used = placed.filter(p => p.id === rec.p.id).length;
    const inv = (CUR.inventory || []).find(x => x.id === rec.p.id);
    if (!inv || inv.qty - used <= 0) return false;
    if (!canPlaceDeco(rec.p.row, rec.p.col, sz.w, sz.h, rec.p.area, null, rec.p.id)) return false;   // [DECO-PT-2]
    CUR.houseDecorations = [...placed, Object.assign({}, rec.p)];   // [DECO-SPACE-1] 공간 번호째 되살린다
    return true;
  }
  if (rec.t === 'floor') {
    const fm = _yardFloorMap(CUR);   // [DECO-SPACE-1]
    if (rec.prev === undefined) delete fm[rec.key]; else fm[rec.key] = rec.prev;
    return true;
  }
  if (rec.t === 'rooms') {   // [INDOOR-ROOMS-1] 방 만들기·없애기·방 벽지/바닥 — 그 공간의 방 목록을 앞 것으로
    _inRoomsSet(CUR, JSON.parse(rec.prev || '[]'), rec.sp);
    //  [DECO-RULE-R4] 그때 가방으로 간 벽걸이를 제자리에 — 가진 수 안에서, 그 자리가 비어 있을 때만
    (rec.bag || []).forEach(p => {
      const inv = (CUR.inventory || []).find(i => i.id === p.id), used = (CUR.houseDecorations || []).filter(q => q.id === p.id).length;
      if (!inv || inv.qty - used <= 0 || !canPlaceDeco(p.row, p.col, getDecoSize(p.id).w, getDecoSize(p.id).h, 'indoor', null, p.id)) return;
      CUR.houseDecorations = (CUR.houseDecorations || []).concat([Object.assign({}, p)]);
    });
    if (DECO_MODE === 'floor' && DECO_SCENE !== 'yard') _inLookRender();
    return true;
  }
  if (rec.t === 'look') {   // [INDOOR-LOOK-1] 집 안 벽지·바닥 — 그 공간의 글자를 앞 것으로
    _inLookSet(CUR, rec.prev, rec.sp);
    if (DECO_MODE === 'floor' && DECO_SCENE !== 'yard') _inLookRender();
    return true;
  }
  if (rec.t === 'stroke') {
    let ok = false;
    for (let i = rec.list.length - 1; i >= 0; i--) ok = _decoUndoOne(rec.list[i]) || ok;
    return ok;
  }
  return false;
}

function decoUndo() {
  const rec = _decoUndo.pop();
  if (!rec) { toast('되돌릴 것이 없어요'); _decoUndoSync(); return; }
  const ok = _decoUndoOne(rec);
  _decoUndoSync();
  if (!ok) { toast(rec.t === 'remove' ? '↩ 그 자리가 이미 찼어요 — 먼저 치우고 다시 ↩' : '↩ 그건 이미 바뀌어서 되돌릴 게 없었어요'); return; }   // [DECO-WORDS-1]
  decoDirty(); _drawDeco(); renderDecoInv();
  toast('↩ 되돌렸어요');
}

if (typeof document !== 'undefined') {
  //  PC: Ctrl+Z (꾸미기 전체화면이 열려 있을 때만)
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || (e.key !== 'z' && e.key !== 'Z')) return;
    const fs = document.getElementById('interior-fullscreen');
    if (!fs || fs.style.display === 'none') return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault(); decoUndo();
  });
}

// [DECO-RULE-R1R2] 바닥을 칠할 때도 놓을 때의 규칙을 지킨다 — 그 칸에 놓인 것이 새 바닥에 설 수 없으면 그 칸은 안 칠한다.
//  (전엔 물 규칙을 놓을 때만 봐서, 나무를 놓고 발밑을 물로 칠하면 연못 한가운데 나무 · 닭 발밑을 물로 칠하면 물 위에 선 닭이 됐다)
//  · 동물은 그 동물이 다니는 바닥(ANIM_DECO.ground) · 그 밖은 물만 안 된다(갈대·징검돌 DECO_WATER_OK 는 된다) — _decoRuleWhy·_animGroundOk 와 같은 잣대.
//  · 잔디로 되돌리기(지우기)는 누구나 설 수 있어 막지 않는다. 막히는 칸을 되돌리기 줄에 남기지 않는다.
function _floorPaintBlock(r, c, v) {
  const kind = _groundKind(_floorParse(v || 'grass').name);
  for (const p of _decoList(CUR)) {
    if (p.area !== 'yard') continue;
    const z = getDecoSize(p.id);
    if (r < p.row || r >= p.row + z.h || c < p.col || c >= p.col + z.w) continue;
    const a = typeof ANIM_DECO !== 'undefined' && ANIM_DECO[p.id];
    if (a ? a.ground.indexOf(kind) < 0 : (kind === 'water' && !DECO_WATER_OK[p.id])) return p;
  }
  return null;
}
function _floorPaintWhy(p, v, n) {
  const d = GAME_DATA.decorations.find(x => x.id === p.id), nm = d ? d.icon + ' ' + d.name : '장식';
  const water = _groundKind(_floorParse(v).name) === 'water';
  return (water ? '🌊 ' : '🐾 ') + (n > 1 ? `${nm} 등 ${n}개가 있는 칸은` : `${nm}${_josa(d ? d.name : '장식', '이', '가')} 있는 칸은`)
    + ` ${water ? '물로' : '그 바닥으로'} 못 칠해요 — 먼저 옮겨 주세요`;
}

function _paintFloor(r, c, stroke) {
  const fm = _yardFloorMap(CUR);   // [DECO-SPACE-1]
  const key = r+'_'+c;
  const nextV = fm[key] === CUR_FLOOR_TILE ? undefined : CUR_FLOOR_TILE;   // 같은 타일이면 잔디로
  const blk = nextV !== undefined && _floorPaintBlock(r, c, nextV);   // [DECO-RULE-R1R2]
  if (blk) { toast(_floorPaintWhy(blk, nextV, 1)); return; }
  const undoRec = { t: 'floor', key, prev: fm[key] };   // [DECO-UNDO-1]
  if (stroke) stroke.push(undoRec); else _decoUndoPush(undoRec);
  if(fm[key] === CUR_FLOOR_TILE) {
    delete fm[key]; // 같은 타일이면 기본(잔디)으로
  } else {
    fm[key] = CUR_FLOOR_TILE;
  }
  decoDirty();   // [DECO-SAVE-1] 0.4초 묶기 — 끌어서 칠할 때 칸마다 통째 저장되지 않게
  _drawDeco();
}

//  [DECO-PT-2] 한 칸에 둘이 겹치면(우리 안 동물) 누른 것은 위의 것 — 동물 > 작은 것 > 우리
//  [DECO-PT-3] 다 썼을 때 어느 공간에 몇 개 놓였는지 — "어 왜 모자라지?"
function _decoWhereUsed(id) {
  const by = {};
  (CUR.houseDecorations || []).forEach(p => { if (p.id === id) { const k = _decoSpaceOf(p); by[k] = (by[k] || 0) + 1; } });
  const parts = Object.keys(by).sort().map(k => '공간 ' + k + '에 ' + by[k] + '개');
  return parts.length ? '다 썼어요 — ' + parts.join(', ') + ' 놓여 있어요' : '가진 개수가 모자라요!';
}

// [DECO-ANIM-HIT-1] 동물은 돌아다닌다 — 저장된 자리(놓은 칸)와 **보이는 자리**가 다르다.
//  누른 것을 찾을 때(치우기·스포이드·빈손 누르기)는 보이는 자리로 찾는다. 전에는 놓은 칸으로만 찾아서
//  ① 🧽 치우기로 보이는 강아지를 눌러도 "치울 게 없어요" ② 빈 풀밭(강아지가 놓였던 칸)을 누르면 멀리 있는 강아지가 사라졌다.
//  놓기 막기(canPlaceDeco)는 그대로 놓은 칸 기준이다 — 동물이 돌아올 자리라서.
function _decoAnimState(p) {
  if (!p || p.area !== 'yard' || typeof ANIM_DECO === 'undefined' || !ANIM_DECO[p.id]) return null;
  const rec = _animLayers.get(_ifActiveContainer || 'house-topview');
  return (rec && rec.items.get(p.id + '@' + p.row + '_' + p.col)) || null;
}
//  이 동물이 놓은 칸을 떠나 있나(층이 없으면 — 움직임 끔 등 — 떠난 게 아니다)
function _decoAnimAway(p) {
  const st = _decoAnimState(p);
  return !!st && (st.cur.row !== p.row || st.cur.col !== p.col);
}
//  (r,c) 에 **보이는** 동물의 놓인 기록. 없으면 null
function _decoAnimPlacedAt(area, r, c) {
  if (area !== 'yard') return null;
  const st = _animAt(_ifActiveContainer || 'house-topview', r, c);
  if (!st) return null;
  return _decoList(CUR).find(p => p.area === 'yard' && p.id === st.id && p.row === st.home.row && p.col === st.home.col) || null;
}

function _decoTopAt(area, row, col, seen, band) {
  if (seen) { const pet = _decoAnimPlacedAt(area, row, col); if (pet) return pet; }   // [DECO-ANIM-HIT-1] 보이는 동물 먼저
  const hits = _decoList(CUR).filter(p => {
    if (p.area !== area) return false;
    if (seen && _decoAnimAway(p)) return false;   // 떠나 있는 동물의 빈 자리는 누른 게 아니다
    const sz = getDecoSize(p.id);
    return row >= p.row && row < p.row + sz.h && col >= p.col && col < p.col + sz.w;
  });
  const rank = p => (area === 'indoor' && _isWallDeco(p.id)) ? (band ? -1 : 3)   // [INDOOR-WALL-1] 벽 띠를 눌렀으면 벽걸이 · 바닥 칸이면 그 앞 가구 먼저
    : (typeof ANIM_DECO !== 'undefined' && ANIM_DECO[p.id]) ? 0 : (_isPenDeco(p.id) || _isRugDeco(p.id)) ? 2 : 1;   // [INDOOR-RUG-1] 깔개는 맨 아래
  if (band) return hits.filter(p => _isWallDeco(p.id)).sort((a, b) => rank(a) - rank(b))[0] || null;   // 벽 띠에는 벽걸이만 걸려 있다
  hits.sort((a, b) => rank(a) - rank(b));
  return hits[0] || null;
}

// [DECO-RCLICK-1] 놓인 것 하나 치우기 — 빈손 누르기·🧽 치우기·마우스 오른쪽 클릭이 다 이 한 곳을 쓴다.
//  치운 것은 **가방으로 돌아간다**(가진 개수는 '놓인 수'로 세니 저절로 +1 · 골드는 어떤 치우기에서도 안 움직인다).
//  전 알림("제거됨")은 아이에게 '없어졌다'로 읽혔다 → 잃지 않았다는 것과 되돌리는 길을 말해 준다. 확인 창은 안 띄운다.
function _decoRemoveOne(ex) {
  const d = GAME_DATA.decorations.find(x => x.id === ex.id);
  CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p !== ex);
  _decoUndoPush({ t: 'remove', p: Object.assign({}, ex) });   // [DECO-UNDO-1]
  decoDirty(); _drawDeco(); renderDecoInv();                   // [DECO-SAVE-1]
  toast(`🎒 ${d ? d.icon + ' ' + d.name : '장식'} — 가방으로 돌아갔어요 (↩ 되돌리기)`);
}

//  마우스 오른쪽 **클릭**(안 끌고 뗌) = 그 자리 위의 것 하나 치우기. 오른쪽 **끌기**는 지금처럼 화면 이동(DECO-PAN-1).
//  터치에는 오른쪽 클릭이 없다 — 터치는 🧽 치우기·빈손 누르기 그대로(pointerType 으로 그때그때 가린다, 설정 없음).
function _decoRightClickAt(clientX, clientY) {
  const cell = _decoCellAt(clientX, clientY);
  if (!cell) return false;
  let ex = _decoTopAt(cell.area, cell.r, cell.c, true, cell.band);   // [INDOOR-WALL-1]
  if (ex && !cell.band && _decoOnWallFloor(ex, cell.area)) ex = null;   // 액자 아래 빈 바닥
  if (ex) { _decoRemoveOne(ex); return true; }
  if (DECO_MODE === 'floor' && cell.area === 'yard') {          // 바닥 모드면 칠한 바닥 한 칸을 걷어 낸다(↩ 됨)
    const fm = _yardFloorGet(CUR), key = cell.r + '_' + cell.c;
    if (fm[key] !== undefined) {
      _decoUndoPush({ t: 'floor', key, prev: fm[key] });
      delete _yardFloorMap(CUR)[key];
      decoDirty(); _drawDeco();
      return true;
    }
  }
  toast('여기엔 치울 게 없어요');
  return false;
}

// [DECO-WORDS-1] 아이가 읽는 말이 실제와 맞게 — docs/deco_commercial_plan.md §2 M1~M9
//  고를 것이 없을 때: 가진 게 아예 없으면 상점으로, 이 장소 것만 없으면 그렇게, 있으면 서랍에서 고르라고
function _decoPickFirstWhy(area) {
  const have = (CUR.inventory || []).filter(i => { const d = GAME_DATA.decorations.find(x => x.id === i.id); return d && i.qty > 0; });
  if (!have.length) return '🛒 아직 가진 장식이 없어요 — 아래 🛒 상점에서 골라 봐요';
  if (!have.some(i => (GAME_DATA.decorations.find(x => x.id === i.id) || {}).cat === area))
    return (area === 'yard' ? '🌿 마당' : '🏠 집 안') + '에 놓을 장식이 없어요 — 🛒 상점에서 골라 봐요';
  return '👇 아래에서 놓을 장식을 먼저 골라요';
}
//  놓을 수 없는 까닭 — 판 끝 · 집 · 밭 · 걸리는 장식 순
function _decoCantWhy(r, c, w, h, area) {
  const R = area === 'yard' ? DY : DI;
  if (r + h > R.rows || c + w > R.cols) return '판 끝이라 다 안 들어가요 — 조금 안쪽에 놓아 봐요';
  if (area === 'yard') for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) {
    if (_isHC(r + dr, c + dc)) return '🏠 집에 걸려요 — 집 밖에 놓아요';
    if (_isFarmCell(r + dr, c + dc)) return '🌾 밭에 걸려요 — 밭 밖에 놓아요';
  }
  const b = _decoBlockerAt(r, c, w, h, area, SEL_DECO), d = b && GAME_DATA.decorations.find(x => x.id === b.id);
  if (d) return `${d.icon} ${d.name}에 걸려요 — 빈 곳에 놓아요`;
  return '여기엔 놓을 수 없어요';
}

//  [INDOOR-WALL-1] 0번 줄 바닥 칸을 눌렀는데 맨 위 것이 벽에 건 것뿐 = 그림은 한 칸 위 벽 띠에 있다(바닥은 비어 보인다)
function _decoOnWallFloor(p, area) { return area === 'indoor' && p && _isWallDeco(p.id) && _inIsWallRow(p.row, p.col); }
function _decoPlace(area,row,col){
  const placed=CUR.houseDecorations||[];
  if(DECO_MODE==='erase'){   // [DECO-PT-2] 🧽 치우기 — 누른 칸의 위의 것 하나를 치운다(카드는 안 씀)
    let ex=_decoTopAt(area,row,col,true);   // [DECO-ANIM-HIT-1] 동물은 보이는 자리로
    if(ex && _decoOnWallFloor(ex, area)) ex=null;   // [INDOOR-WALL-1] 액자는 벽에 걸려 있다 — 그 아래 빈 바닥을 누른 것이다
    if(!ex){ toast('여기엔 치울 게 없어요'); return; }
    _decoRemoveOne(ex); return;
  }

  // 클릭한 칸에 있는 장식 찾기 (멀티셀 고려) — [DECO-SPACE-1] 이 공간 것만 · [DECO-PT-2] 겹치면 위의 것
  let existing=_decoTopAt(area,row,col);
  if(existing && !SEL_DECO && _decoOnWallFloor(existing, area)) existing=null;   // [INDOOR-WALL-1] 빈손으로 액자 아래 빈 바닥 — 액자를 치우지 않는다
  //  [DECO-PT-2] 카드를 든 채 누르면 치우지 않는다("꽃 놓으려는데 나무가 사라졌어") — 치우기는 빈손·🧽 치우기 모드에서만
  if(existing && SEL_DECO && DECO_MODE!=='erase'){
    if(!canPlaceDeco(row,col,(getDecoSize(SEL_DECO)).w,(getDecoSize(SEL_DECO)).h,area,null)){
      //  [INDOOR-RUG-1] 누른 칸 맨 위 것이 아니라 **정말 막는 것**의 이름을 말한다(러그 위 소파를 누르고 러그를 놓으려 할 때 막는 건 밑의 러그다)
      const blk=(area==='indoor' && _decoBlockerAt(row,col,(getDecoSize(SEL_DECO)).w,(getDecoSize(SEL_DECO)).h,area,SEL_DECO)) || existing;
      const ed=GAME_DATA.decorations.find(x=>x.id===blk.id);
      //  [DECO-ANIM-HIT-1] 동물이 떠나 있으면 "이미 강아지가 있어요"는 눈에 보이는 것과 다르다
      if(_decoAnimAway(existing)){ toast(`여기는 ${ed?ed.icon+' '+ed.name:'동물'} 자리예요(돌아올 곳) — 옆 칸에 놓아 보세요`); return; }
      toast(`여기엔 이미 ${ed?ed.icon+' '+ed.name:'장식'}${_josa(ed?ed.name:'장식','이','가')} 있어요 — 치우려면 🧽 치우기`); return;   // [DECO-WORDS-1]
    }
  } else if(existing && _decoAnimAway(existing)){
    //  [DECO-ANIM-HIT-1] 빈 풀밭을 눌렀는데 멀리 있는 동물이 사라지던 것 — 여기는 그 동물이 돌아올 자리일 뿐이다
    const d=GAME_DATA.decorations.find(x=>x.id===existing.id);
    toast(`여기는 ${d?d.icon+' '+d.name:'동물'} 자리예요 — 치우려면 🧽 치우기를 켜고 그 동물을 누르세요`); return;
  } else if(existing){
    _decoRemoveOne(existing); return;   // [DECO-SPACE-1] 그 한 개만(다른 공간 같은 자리 것은 그대로)
  }
  if(!SEL_DECO){ toast(_decoSelOffWhy() || _decoPickFirstWhy(area)); return; }   // [DECO-SEL-A5] 방금 내려놓았으면 그 까닭 · [DECO-WORDS-1]
  const d=GAME_DATA.decorations.find(x=>x.id===SEL_DECO);
  if(!d) return;
  if(d.cat!==area){ toast(`이 장식은 ${d.cat==='yard'?'🌿 마당':'🏠 집 안'}에만 놓을 수 있어요`); return; }   // [DECO-WORDS-1]
  const sz=d.size||{w:1,h:1};
  const used=placed.filter(p=>p.id===SEL_DECO).length;
  const inv=(CUR.inventory||[]).find(i=>i.id===SEL_DECO);
  if(!inv||inv.qty-used<=0){ toast(_decoWhereUsed(SEL_DECO)); return; }   // [DECO-PT-3]
  if(!canPlaceDeco(row,col,sz.w,sz.h,area,null)){ toast(_decoCantWhy(row,col,sz.w,sz.h,area)); return; }   // [DECO-WORDS-1] 까닭을 말한다
  const why=_decoRuleWhy(SEL_DECO,area,row,col,sz.w,sz.h); if(why){ toast(why); return; }   // [DECO-PT-2]
  // [DECO-ANIM-2] 동물은 바닥을 가린다 — 왜 안 되는지 아이 말로 알려 준다
  if(area==='yard' && ANIM_DECO[SEL_DECO] && !_animGroundOk(SEL_DECO, CUR, row, col, sz.w, sz.h)){
    toast(_animWhyNot(SEL_DECO)); return;
  }
  const np=_decoNew(SEL_DECO,area,row,col);   // [DECO-SPACE-1]
  CUR.houseDecorations=[...placed,np];
  _decoUndoPush({ t: 'place', p: Object.assign({}, np) });   // [DECO-UNDO-1]
  _decoRecentAdd(SEL_DECO);   // [DECO-FIND-1]
  //  [DECO-SEL-A5] 마지막 하나를 놓았으면 카드를 내려놓는다 — 든 채로 두면 다음 누름(동물 쓰다듬기 등)이 '또 놓기'로 읽혔다
  const out = _decoLeft(SEL_DECO) <= 0;
  if (out) SEL_DECO = null;
  decoDirty(); _drawDeco(); renderDecoInv();   // [DECO-SAVE-1]
  toast(`✅ ${d.icon} ${d.name}${_josa(d.name,'을','를')} 놓았어요` + (out ? ' — 다 놓아서 카드를 내려놓았어요' : ''));   // [DECO-WORDS-1] '배치'는 어른 말 · [DECO-SEL-A5]
}

function toggleDecoScene(){
  decoFlush('씬 바꿈');   // [DECO-SAVE-1]
  _decoUndoClear();   // [DECO-UNDO-1] 안 보이는 씬의 것을 되돌리지 않게
  if (DECO_SCENE === 'yard') _decoViewSave();   // [DECO-PT-1] 마당에서 보던 자리를 기억해 두고
  DECO_SCENE=DECO_SCENE==='yard'?'indoor':'yard';
  SEL_DECO=null;
  _dZoom=1; _dPanX=0; _dPanY=0;   // [DECO-ZOOM-1]
  const isYard=DECO_SCENE==='yard';
  // 일반 모드 UI
  const sBtn = document.getElementById('deco-scene-btn');
  const sName = document.getElementById('deco-scene-name');
  const iLabel = document.getElementById('deco-inv-label');
  if(sBtn)   sBtn.textContent  = isYard?'🏠 집 안으로 →':'🌿 마당으로 ←';
  if(sName)  sName.textContent = isYard?'🌿 마당':'🏠 집 안';
  if(iLabel) iLabel.textContent= isYard?'🎒 내 장식품':'🎒 내 장식품 (집 안)';
  _dCv=null; _dCtx=null;
  renderHouseDeco();
  if (DECO_SCENE === 'yard') _decoViewRestore();   // [DECO-PT-1] 마당으로 돌아오면 그 자리로
  else if (_ifMode) _decoIndoorStart();           // [DECO-PHONE-INDOOR-1] 폰이면 집 안도 크게 · [INDOOR-ROOMS-1] 방이 있으면 방 둘레로
  if(_ifMode) ifSyncScene();
  toast(isYard?'🌿 마당이에요! 위쪽 집 문을 누르면 들어가요.':'🏠 집 안이에요! 나가기 문으로 마당에 나가요.');
}

// ══ 장식 찾기 (DECO-FIND-1) — 이 장소만 · 이름 검색 · 최근 놓은 것 · 서랍 펼치기 ══
//  거르기만 한다 — 값·가진 개수·놓기 규칙은 손대지 않는다. 기억은 기기에만(localStorage, DB 쓰기 0).
const _decoFind = { sceneOnly: true, q: '' };
const DECO_RECENT_KEY = 'rpg.deco.recent', DECO_RECENT_MAX = 8;

function _decoRecentGet() {
  try { const a = JSON.parse(localStorage.getItem(DECO_RECENT_KEY) || '[]'); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}
function _decoRecentAdd(id) {
  try {
    const a = _decoRecentGet().filter(x => x !== id);
    a.unshift(id);
    localStorage.setItem(DECO_RECENT_KEY, JSON.stringify(a.slice(0, DECO_RECENT_MAX)));
  } catch (e) {}
}

//  이 장식이 지금 목록에 보여야 하나 — 순수 함수(시험용)
function _decoFindMatch(d, scene, f) {
  if (!d) return false;
  if (f.sceneOnly && d.cat !== scene) return false;
  const q = (f.q || '').trim();
  if (q && String(d.name || '').indexOf(q) < 0) return false;
  return true;
}

function decoFindSet(key, val) {
  if (key === 'q' && DECO_TAB === 'shop') {   // [DECO-SHOP-1] 찾기 글은 탭마다 따로
    _decoShop.q = val;
    const c = document.getElementById('if-deco-search-clear'); if (c) c.hidden = !(val || '').length;
    _decoShopRender(); return;
  }
  if (key === 'sceneOnly') _decoFind.sceneOnly = !_decoFind.sceneOnly;
  else _decoFind[key] = val;
  const chip = document.getElementById('if-deco-scene-only');
  if (chip) { chip.classList.toggle('is-on', _decoFind.sceneOnly); chip.setAttribute('aria-pressed', String(_decoFind.sceneOnly)); }
  const clr = document.getElementById('if-deco-search-clear');
  if (clr) clr.hidden = !(_decoFind.q || '').length;
  renderDecoInv();
}

// [DECO-THUMB-2] 오른쪽 확대 단추 기둥이 서랍을 펼치면 서랍 위로 겹쳤다 → 늘 서랍 바로 위에 붙인다
// [DECO-PAN-1] 한 손가락 끌기가 화면 이동이 되는 건 '카드를 안 골랐고 바닥 모드가 아닐 때'뿐이다.
//  아이는 이 기준을 모른다(카드는 놓은 뒤에도 계속 잡혀 있다) → 막혀 있을 때만 ✋ 단추를 보여 준다.
function _decoHandSync() {
  const b = typeof document !== 'undefined' && document.getElementById('if-hand-btn');
  //  [INDOOR-LOOK-1] 집 안 벽지·바닥에서는 한 손가락 끌기가 이미 화면 이동이라 ✋ 가 필요 없다
  const blocked = DECO_MODE === 'floor' ? (DECO_SCENE === 'yard' || _inRoomDragMode()) : !!SEL_DECO;   // [INDOOR-ROOMS-1]
  if (b) b.style.display = blocked ? 'flex' : 'none';
}
function decoHand() {
  if (_inRoomDragMode()) { _inPk.tab = 'wall'; _inLookRender(); }   // [INDOOR-ROOMS-1] 방 네모 끌기에서 손을 비우면 벽지 탭(한 손가락 = 화면 이동)
  if (DECO_MODE === 'floor') { setDecoMode('deco'); if (typeof ifSyncModeBtn === 'function') ifSyncModeBtn(); }
  SEL_DECO = null;
  if (typeof renderDecoInv === 'function') renderDecoInv();
  _drawDeco();
  toast('✋ 손을 비웠어요 — 이제 한 손가락으로 끌면 화면이 움직여요');
}

function _decoPillarSync() {
  //  [DECO-PT-4] 기둥 위치는 CSS 변수 하나(--deco-drawer-h)로. 서랍이 아직 안 보일 때(높이 0) 재면
  //  기둥이 서랍 머리줄(⌃ 펼치기)을 덮었다 → 보일 때만 값을 바꾸고, 안 보이면 이전 값(기본 220px)을 둔다.
  const fs = document.getElementById('interior-fullscreen');
  const pk = document.getElementById('if-floor-picker');   // [DECO-FLOOR-PICK-1] 바닥 모드면 서랍 자리 = 바닥 고르기 판
  const dr = (pk && !pk.hidden && DECO_MODE === 'floor') ? pk : document.getElementById('if-deco-drawer');
  if (!fs || !dr) return;
  //  [DECO-SHORT-1] 판 자리의 위 끝(윗줄 + 바닥 줄) — 기둥이 그 위로 못 올라가게(CSS max-height 가 쓴다)
  const host = document.getElementById('if-topview');
  if (host && fs.style.display !== 'none' && host.offsetTop > 0) fs.style.setProperty('--deco-host-top', host.offsetTop + 'px');
  const shown = fs.style.display !== 'none' && dr.offsetParent !== null;
  const h = shown ? dr.offsetHeight : 0;
  if (h > 0) fs.style.setProperty('--deco-drawer-h', h + 'px');
  else if (fs.style.display !== 'none' && dr.offsetParent === null) fs.style.setProperty('--deco-drawer-h', '0px');   // 바닥 모드(서랍 숨김)
}
if (typeof window !== 'undefined') addEventListener('resize', () => { try { _decoPillarSync(); } catch (e) {} });

function decoDrawerToggle() {
  const dr = document.getElementById('if-deco-drawer'); if (!dr) return;
  const open = !dr.classList.contains('is-open');
  dr.classList.toggle('is-open', open);
  const b = document.getElementById('if-deco-expand');
  if (b) { b.textContent = open ? '⌄' : '⌃'; b.setAttribute('aria-label', open ? '서랍 접기' : '서랍 펼치기'); }
  _decoPillarSync();
  _decoFit();   // [DECO-FIT-1]
}

// [DECO-THUMB-1] 카드에 실제 그림 — 이모지로는 뭔지 모른다("울타리 샀는데 공사 표지판이야?")
//  울타리처럼 자동 이음인 것은 가로 그림으로 보여 준다. 그림이 없으면 이모지로 돌아간다.
//  [DECO-THUMB-2] 그림 파일은 위쪽이 비어 있다(1×1 은 위 절반) → 통째로 맞추면 실제 그림이 15~20px.
//  디자인 2 가 잰 '그린 부분 상자'(assets/deco/bbox.json, [x,y,w,h,vbW,vbH])로 그 부분만 크게 보인다.
//  표가 아직 없거나 그 장식이 표에 없으면 예전처럼 통째로.
let _decoBBox = null;
if (typeof fetch === 'function') {
  fetch('./assets/deco/bbox.json').then(r => r.ok ? r.json() : null).then(j => {
    if (!j) return;
    _decoBBox = j;
    try { if (typeof renderDecoInv === 'function' && CUR) renderDecoInv(); } catch (e) {}
    try { if (typeof SHOP_TAB !== 'undefined' && SHOP_TAB === 'deco' && typeof renderShop === 'function' && CUR) renderShop(); } catch (e) {}
  }).catch(() => {});
}

function _decoThumb(d, px) {
  const id = d.autoFence ? 'd_y49' : d.id;
  const emo = escHtml(d.icon || '🌸');
  const src = './assets/deco/' + encodeURIComponent(id) + '.svg';
  const onerr = ` onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${emo}',style:'font-size:${Math.round(px * 0.8)}px'}))"`;
  //  썸네일 전용 그림(bbox.json 의 thumbArt 목록에 있으면 <id>_thumb.svg 를 통째로)
  if (_decoBBox && Array.isArray(_decoBBox.thumbArt) && _decoBBox.thumbArt.indexOf(id) >= 0) {
    return `<img class="deco-thumb" src="./assets/deco/${encodeURIComponent(id)}_thumb.svg" alt="" loading="lazy"`
      + ` style="height:${px}px;width:auto;max-width:${Math.round(px * 1.6)}px;object-fit:contain;display:block;margin:0 auto"${onerr}>`;
  }
  const bb = _decoBBox && _decoBBox[id];
  if (Array.isArray(bb) && bb[2] > 0 && bb[3] > 0) {
    const [x, y, w, h, vw, vh] = bb;
    const maxW = Math.round(px * 1.6);
    const sc = Math.min(px / h, maxW / w);
    const bw = Math.round(w * sc), bh = Math.round(h * sc);
    return `<span class="deco-thumb-box" style="display:block;width:${bw}px;height:${bh}px;overflow:hidden;margin:0 auto;position:relative">`
      + `<img class="deco-thumb" src="${src}" alt="" loading="lazy"${onerr}`
      + ` style="position:absolute;left:${-Math.round(x * sc)}px;top:${-Math.round(y * sc)}px;width:${Math.round(vw * sc)}px;height:${Math.round(vh * sc)}px;max-width:none"></span>`;
  }
  return `<img class="deco-thumb" src="${src}" alt="" loading="lazy"`
    + ` style="height:${px}px;width:auto;max-width:${Math.round(px * 1.6)}px;object-fit:contain;display:block;margin:0 auto"${onerr}>`;
}

function _decoCardHtml(i, d, avail, placedScene) {
  const RL = {common:'⚪',rare:'🔵',epic:'🟣',legend:'🟡'};
  const isSel = SEL_DECO === i.id, isMatch = d.cat === placedScene, rl = RL[d.rarity||'common'] || '';
  const where = avail <= 0 ? _decoPlacedWhere(i.id) : '';   // [DECO-SHOP-BAG-1] 다 놓았으면 어디에 몇 개
  return `<div class="deco-card${isSel?' is-sel':''}${where?' is-placed-out':''}" data-deco-id="${i.id}" data-cat="${d.cat}" onclick="selectDeco('${i.id}')" style="
      background:${isSel?'rgba(255,215,0,.18)':'rgba(255,255,255,.05)'};
      border:2px solid ${isSel?'var(--gold)':isMatch?'rgba(255,255,255,.15)':'rgba(255,255,255,.06)'};
      border-radius:10px;padding:.35rem .45rem;cursor:${avail>0||where?'pointer':'default'};flex-shrink:0;
      text-align:center;opacity:${avail>0?isMatch?1:.45:where?.6:.25};min-width:64px;max-width:92px;transition:all .2s;
      transform:${isSel?'scale(1.06)':'scale(1)'}">
      <div style="height:36px;display:flex;align-items:flex-end;justify-content:center">${_decoThumb(d, 34)}</div>
      <div class="dc-name" style="color:var(--txt2);margin-top:.1rem;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;word-break:keep-all">${rl} ${escHtml(d.name)}</div>
      <div class="dc-qty"${where?` title="${escHtml(where)}개 놓여 있어요"`:''}>${d.cat==='yard'?'🌿':'🏠'} ${where?`<span class="dc-where">${escHtml(where)}</span>`:'×'+avail}</div>
    </div>`;
}

function renderDecoInv(){
  const placed=CUR.houseDecorations||[];
  const inv=(CUR.inventory||[]).filter(i=>GAME_DATA.decorations.find(d=>d.id===i.id));
  const el=document.getElementById('house-deco-inv');
  _decoShopSync();   // [DECO-SHOP-1] 골드 배지 · 손끝 그림 끝내기 · 씬이 바뀌었으면 상점 목록도
  _decoRenderQuick(inv, placed);   // [DECO-FIND-1] 최근 놓은 것 줄
  if(!inv.length){
    el.innerHTML=`<div style="font-size:.78rem;color:var(--txt3)">가진 장식품이 없어요. 위의 🛒 상점에서 사 보세요!</div>`;
    if(_ifMode) ifSyncInv();
    return;
  }
  //  [DECO-FIND-1] 이 장소만 · 이름 검색으로 거른다(값·개수·놓기 규칙은 그대로)
  let hidden = 0;
  const shown = inv.filter(i => {
    const d = GAME_DATA.decorations.find(x => x.id === i.id);
    const ok = _decoFindMatch(d, DECO_SCENE, _decoFind);
    if (!ok) hidden++;
    return ok;
  });
  //  [DECO-SHOP-1] 방금 산 것은 골라져 있는 동안 맨 앞에(서랍 끝에 붙으면 크롬북 한 줄 서랍에서 안 보인다)
  if (_decoShop.front && SEL_DECO === _decoShop.front) shown.sort((a, b) => (b.id === SEL_DECO) - (a.id === SEL_DECO));
  else _decoShop.front = null;
  el.innerHTML = shown.map(i => {
    const d = GAME_DATA.decorations.find(x => x.id === i.id); if (!d) return '';
    const avail = i.qty - placed.filter(p => p.id === i.id).length;
    return _decoCardHtml(i, d, avail, DECO_SCENE);
  }).join('');
  const empty = document.getElementById('if-deco-empty');
  if (empty) {
    if (!shown.length) {
      empty.hidden = false;
      empty.textContent = (_decoFind.q || '').trim()
        ? '"' + _decoFind.q.trim() + '" 이름인 장식이 없어요'
        : (DECO_SCENE === 'yard' ? '마당에 놓을 장식이 없어요' : '집 안에 놓을 장식이 없어요') + ' — "이 장소만"을 끄면 다 보여요';
    } else empty.hidden = true;
  }
  if(_ifMode) ifSyncInv();
  _decoPillarSync();   // [DECO-THUMB-2] 서랍 키가 바뀌면 기둥도
}

//  [DECO-SEL-A5] 창 폭이 901px 을 넘나들면 최근 칩 ↔ 최근 줄을 바꿔 그린다
if (typeof matchMedia === 'function') { try { matchMedia('(min-width:901px)').addEventListener('change', () => { if (_ifMode) renderDecoInv(); }); } catch (e) {} }
//  최근 놓은 것 줄 — 지금 장소에 놓을 수 있고 아직 남은 것만. 비면 줄을 감춘다.
function _decoRenderQuick(inv, placed) {
  const q = document.getElementById('if-deco-quick'); if (!q) return;
  const byId = {}; inv.forEach(i => { byId[i.id] = i; });
  const cards = [], ids = [];
  for (const id of _decoRecentGet()) {
    const i = byId[id]; const d = GAME_DATA.decorations.find(x => x.id === id);
    if (!i || !d || d.cat !== DECO_SCENE) continue;
    const avail = i.qty - placed.filter(p => p.id === id).length;
    if (avail <= 0) continue;
    cards.push(_decoCardHtml(i, d, avail, DECO_SCENE)); ids.push({ i, d, avail });
  }
  //  [DECO-SEL-A5] 머리줄이 한 줄인 넓은 화면(901px~)은 머리줄 안 칩으로 — 서랍 키가 안 변한다
  const qh = document.getElementById('if-deco-quick-head');
  const wide = !!qh && typeof matchMedia === 'function' && matchMedia('(min-width:901px)').matches;
  if (qh) {
    const chips = !wide ? [] : ids.map(({ i, d, avail }) => `<button class="deco-qchip${SEL_DECO === i.id ? ' is-sel' : ''}" data-deco-id="${i.id}" onclick="selectDeco('${i.id}')"`
      + ` title="${escHtml(d.name)} ×${avail}" aria-label="최근 ${escHtml(d.name)} ${avail}개">${_decoThumb(d, 26)}<span>×${avail}</span></button>`);
    qh.hidden = !chips.length;
    qh.innerHTML = chips.length ? '<span class="deco-quick-label">🕘</span>' + chips.join('') : '';
  }
  q.hidden = wide || !cards.length;
  q.innerHTML = !wide && cards.length ? '<span class="deco-quick-label">🕘 최근</span>' + cards.join('') : '';
}

// [DECO-SEL-A5] 고름 풀기 — 창조자 27회 ⓐ5 '쓰다듬으려다 또 놓임' · ⓑ59 '먼저 고르세요인데 방금 골랐음'
//  카드는 ① 같은 카드 다시 누름 ② Escape ③ 마지막 하나를 놓음 ④ ×0 카드 누름 에서 내려놓는다.
//  방금 내려놓았는데 판을 누르면(아이는 '또 놓으려고' 누른다) "먼저 고르세요" 대신 까닭을 말한다.
let _decoSelOff = null;   // { id, t } — 마지막으로 내려놓은 카드와 때
function _decoLeft(id) {
  const iv = (CUR.inventory || []).find(x => x.id === id);
  return iv ? iv.qty - (CUR.houseDecorations || []).filter(p => p.id === id).length : 0;
}
function _decoSelClear(say) {
  if (!SEL_DECO) return;
  const d = GAME_DATA.decorations.find(x => x.id === SEL_DECO);
  _decoSelOff = { id: SEL_DECO, t: Date.now() };
  SEL_DECO = null;
  _drawDeco(); renderDecoInv();
  if (say) toast(`${d ? d.icon + ' ' : ''}카드를 내려놓았어요 — 또 놓으려면 카드를 한 번 더 눌러요`);
}
function _decoSelOffWhy() {
  const o = _decoSelOff;
  if (!o || Date.now() - o.t > 10000) return '';
  const d = GAME_DATA.decorations.find(x => x.id === o.id);
  return `${d ? d.icon + ' ' + d.name + ' ' : ''}카드를 내려놓아서 놓지 않았어요 — 또 놓으려면 카드를 한 번 더 눌러요`;
}
if (typeof document !== 'undefined') document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !_ifMode || !SEL_DECO) return;
  if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;   // 찾기 칸의 Escape 는 그 칸 몫
  _decoSelClear(true);
});

function selectDeco(id){
  //  [DECO-SHOP-BAG-1] 다 놓아서 ×0 인 카드 = 고르지 않고 놓인 그것을 보여 준다('산 게 없어졌다'로 보이지 않게)
  if (SEL_DECO !== id) {
    const iv = (CUR.inventory || []).find(x => x.id === id), n = (CUR.houseDecorations || []).filter(p => p.id === id).length;
    if (iv && n > 0 && iv.qty - n <= 0) { if (SEL_DECO) _decoSelClear(); _decoFlashPlaced(id); return; }   // [DECO-SEL-A5] 든 카드도 내려놓는다
  }
  if (DECO_MODE === 'erase') { setDecoMode('deco'); ifSyncModeBtn(); }   // [DECO-PT-2]
  if (SEL_DECO === id) { _decoSelClear(true); return; }   // [DECO-SEL-A5] 같은 카드를 다시 누름 = 내려놓기(말로 알린다)
  SEL_DECO=id;
  _decoSelOff = null;
  _drawDeco(); renderDecoInv();
  if(SEL_DECO){
    const d=GAME_DATA.decorations.find(x=>x.id===id);
    if(d&&d.cat!==DECO_SCENE) toast(`${d.icon} 이 장식은 ${d.cat==='yard'?'🌿 마당':'🏠 집 안'} 전용이에요!`);
    else toast(`${d?.icon} 골랐어요 — 놓을 칸을 누르세요 · 화면 옮기기는 두 손가락 또는 ✋`);   // [DECO-PAN-1]   // [DECO-PT-1] 폰·태블릿은 '클릭'이 아니다
  }
}
// ══ 마당 안 상점 (DECO-SHOP-1) — 서랍에 [🎒 내 것 | 🛒 상점] ═══════════════
//  화면 규칙: docs/deco_shop_home_screens_20260920.md ①. 꾸미는 화면을 떠나지 않고 산다.
//  🔴 **사는 길은 새로 만들지 않았다** — 값(`decoCost`·무료 기간)·골드 차감·인벤토리 +1·저장·지출 기록은 전부 본편 상점의
//     `buyDeco()` 가 한다. 여기는 ①무엇을 보여 줄지 ②살 수 있는지(본편 상점 카드와 같은 조건)만 본다.
//     본편 상점은 '살 수 없는 것'을 **카드를 안 그려서** 막는다(`price>0 && !hidden` · 레벨 잠금은 카드의 onclick).
//     `buyDeco()` 자체에는 그 검사가 없다 → `_decoShopState()` 가 'ok' 가 아니면 절대 부르지 않는다.
//  ↩ 되돌리기에 '사기'는 **넣지 않았다**(환불 없음 — DECO-UNDO-1 의 '골드는 건드리지 않는다' 그대로). 까닭은 PR 본문.
//  상점 카드는 🛒 를 처음 누를 때 만든다(꾸미기를 여는 값 0).
let DECO_TAB = 'own';
const DECO_SHOP_TWICE = 200;      // 이 값 이상은 '한 번 더 눌러 사기'
//  도감 선물 카드(값 0 · gift 필드)는 **도감 코드가 붙은 뒤에** 켠다 — 지금 보여 주면 받을 길이 없는 약속이 된다.
let DECO_SHOP_GIFTS = false;
const _decoShop = { kind: 'all', q: '', sel: null, armedAt: 0, front: null, scene: '', scroll: { own: 0, shop: 0 } };
//  분류 칩 — 표에 kind 가 있으면 그 값, 아직 없는 옛 장식은 놓는 방식 전수표(docs/deco_place_table.md)의 kind.
//  길·울타리는 소품 칩에(화면 규칙). 표에 kind 가 다 들어오면 이 목록은 지운다.
const DECO_SHOP_KINDS = [['all', '전체'], ['tree', '🌳 나무'], ['plant', '🌷 꽃·풀'], ['animal', '🐾 동물'], ['building', '🏠 건물'],
  ['water', '💧 물'], ['prop', '🪑 소품'], ['furniture', '🛋️ 가구'], ['decor', '🖼️ 장식']];
const _DECO_KIND_OLD = {
  tree: 'd_y9 d_y12 d_y19 d_y46 d_y47 d_y48 d_y64',
  plant: 'd_y1 d_y2 d_y3 d_y7 d_y15 d_y16 d_y21 d_y25 d_y29 d_y35 d_y36 d_y41 d_y42 d_y43 d_y44 d_y45',
  animal: 'd_y32 d_y39 d_y40 d_y53 d_y54 d_y55 d_y56 d_y57 d_y58 d_y60 d_y62 d_y69',
  building: 'd_y11 d_y17 d_y27 d_y28 d_y33 d_y34 d_y63 d_y66 d_y67 d_y68',
  water: 'd_y10 d_y20 d_y31 d_y59',
  furniture: 'd_i5 d_i6 d_i7 d_i8 d_i9 d_i10 d_i11 d_i12 d_i14',
};
let _decoKindMap = null;
function _decoShopKind(d) {
  if (!_decoKindMap) { _decoKindMap = {}; for (const k in _DECO_KIND_OLD) _DECO_KIND_OLD[k].split(' ').forEach(id => { _decoKindMap[id] = k; }); }
  const k = d.kind || _decoKindMap[d.id];
  if (d.cat === 'indoor') return k === 'furniture' ? 'furniture' : 'decor';
  return ['tree', 'plant', 'animal', 'building', 'water'].indexOf(k) >= 0 ? k : 'prop';
}

const _decoCostOf = d => GAME_DATA.decoCost ? GAME_DATA.decoCost(d) : d.price;
const _decoQtyOf = id => { const i = (CUR.inventory || []).find(x => x.id === id); return i ? i.qty : 0; };
const _decoShopName = d => String(d.name || '').replace(/\s*\((선물|업적)\)\s*$/, '');

//  살 수 있나 — 본편 상점 카드와 같은 조건. 'none' = 여기 상점에 없는 것(숨김·업적 보상·지금 장소에 못 놓는 것).
function _decoShopState(d) {
  if (!d || d.hidden || d.cat !== DECO_SCENE) return 'none';
  if (!(d.price > 0)) return (d.gift && DECO_SHOP_GIFTS) ? 'gift' : 'none';
  if ((CUR.level || 1) < (d.reqLv || 1)) return 'lock';
  return CUR.gold >= _decoCostOf(d) ? 'ok' : 'short';
}

function _decoGoldSync() {
  const b = document.getElementById('if-deco-gold'); if (!b || !CUR) return;
  //  꾸미는 중에 골드가 바뀌는 길(교사 지급 → 스냅샷 → renderHUD)을 따라간다 — HUD 숫자가 바뀌면 배지도(renderHUD 는 안 고친다)
  const hud = document.getElementById('hud-gold');
  if (hud && !_decoGoldSync._mo && typeof MutationObserver === 'function') {
    _decoGoldSync._mo = new MutationObserver(() => { if (_ifMode) _decoGoldSync(); });
    _decoGoldSync._mo.observe(hud, { childList: true, characterData: true, subtree: true });
  }
  const txt = '💰 ' + (CUR.gold || 0) + 'G';
  if (b.textContent === txt) return;
  b.textContent = txt;
  if (DECO_TAB === 'shop') _decoShopRender();   // 골드가 바뀌면 '골드 부족' 카드도 바뀐다
}
function _decoShopSync() {   // renderDecoInv 가 부른다
  _decoGoldSync(); _decoGhostCheck();
  if (DECO_TAB === 'shop' && _decoShop.scene !== DECO_SCENE) _decoShopRender();
}

function decoTab(tab) {
  tab = tab === 'shop' ? 'shop' : 'own';
  const body = document.getElementById('if-deco-body'), dr = document.getElementById('if-deco-drawer');
  if (body) _decoShop.scroll[DECO_TAB] = body.scrollTop;   // 스크롤은 탭마다 기억
  DECO_TAB = tab;
  if (dr) dr.classList.toggle('is-shop', tab === 'shop');
  ['own', 'shop'].forEach(t => { const b = document.getElementById('if-deco-tab-' + t);
    if (b) { b.classList.toggle('is-on', t === tab); b.setAttribute('aria-selected', String(t === tab)); } });
  const q = tab === 'shop' ? _decoShop.q : _decoFind.q, inp = document.getElementById('if-deco-search'), clr = document.getElementById('if-deco-search-clear');
  if (inp) { inp.value = q || ''; inp.placeholder = tab === 'shop' ? '🔍 상점에서 찾기' : '🔍 이름으로 찾기'; }
  if (clr) clr.hidden = !(q || '').length;
  if (tab === 'shop') _decoShopRender(); else _decoShopBarSync();
  if (body) body.scrollTop = _decoShop.scroll[tab] || 0;
  _decoPillarSync(); _decoFit();
}

function decoShopKind(k) { _decoShop.kind = k; _decoShopRender(); }

function _decoShopRender() {
  const el = document.getElementById('if-deco-shop'), chips = document.getElementById('if-deco-kinds');
  if (!el || !CUR) return;
  _decoShop.scene = DECO_SCENE;
  const list = GAME_DATA.decorations.filter(d => _decoShopState(d) !== 'none');
  const has = {}; list.forEach(d => { has[_decoShopKind(d)] = 1; });
  if (_decoShop.kind !== 'all' && !has[_decoShop.kind]) _decoShop.kind = 'all';   // 마당↔집 안을 오가면 그 분류가 없을 수 있다
  if (chips) chips.innerHTML = DECO_SHOP_KINDS.filter(k => k[0] === 'all' || has[k[0]]).map(k =>
    `<button class="deco-chip${_decoShop.kind === k[0] ? ' is-on' : ''}" aria-pressed="${_decoShop.kind === k[0]}" onclick="decoShopKind('${k[0]}')">${k[1]}</button>`).join('');
  const q = (_decoShop.q || '').trim(), free = !!(GAME_DATA.decoFreeNow && GAME_DATA.decoFreeNow());
  const d0 = new Date(), today = d0.getFullYear() + '-' + String(d0.getMonth() + 1).padStart(2, '0') + '-' + String(d0.getDate()).padStart(2, '0');
  const shown = list.filter(d => (_decoShop.kind === 'all' || _decoShopKind(d) === _decoShop.kind) && (!q || String(d.name || '').indexOf(q) >= 0));
  if (_decoShop.sel && !shown.some(d => d.id === _decoShop.sel)) _decoShop.sel = null;
  el.innerHTML = shown.length ? shown.map(d => {
    const st = _decoShopState(d), own = _decoQtyOf(d.id);
    const price = st === 'gift' ? '🎁 도감 선물' : st === 'lock' ? `🔒 Lv${d.reqLv}+` : free ? `🎁 무료 <s>${d.price}G</s>` : `💰 ${_decoCostOf(d)}G`;
    return `<div class="deco-scard is-${st}${free && st === 'ok' ? ' is-free' : ''}${_decoShop.sel === d.id ? ' is-sel' : ''}" data-shop-id="${d.id}" onclick="decoShopPick('${d.id}')">`
      + `<div class="ds-art">${_decoThumb(d, 34)}</div><div class="dc-name">${escHtml(_decoShopName(d))}</div><div class="ds-price">${price}</div>`
      + (own > 0 ? `<span class="ds-own">×${own}</span>` : '') + ((d.newUntil && today <= d.newUntil) ? '<span class="ds-new">NEW</span>' : '') + '</div>';
  }).join('') : `<div class="deco-empty">${q ? '"' + escHtml(q) + '" 이름인 장식이 상점에 없어요' : '여기에 놓을 장식이 상점에 없어요'}</div>`;
  _decoShopBarSync();
}

//  카드를 누른다 = 고르기(다시 누르면 풀림). 사는 것은 막대의 단추가 한다.
function decoShopPick(id) {
  _decoShop.sel = (!id || _decoShop.sel === id) ? null : id;
  _decoShop.armedAt = 0; _decoShop.armedMode = null; _decoShop.lastBuyAt = 0;
  document.querySelectorAll('#if-deco-shop .deco-scard').forEach(c => c.classList.toggle('is-sel', c.dataset.shopId === _decoShop.sel));
  _decoShopBarSync();
}

function _decoShopBarSync() {
  const bar = document.getElementById('if-deco-buybar'); if (!bar) return;
  const d = DECO_TAB === 'shop' && _decoShop.sel ? GAME_DATA.decorations.find(x => x.id === _decoShop.sel) : null;
  const st = d ? _decoShopState(d) : 'none', was = !bar.hidden;
  if (st === 'none') { bar.hidden = true; bar.innerHTML = ''; }
  else {
    const cost = _decoCostOf(d), nm = escHtml((d.icon || '') + ' ' + _decoShopName(d)), twice = st === 'ok' && cost >= DECO_SHOP_TWICE;
    let msg, btn = '';
    if (st === 'gift') {
      const g = d.gift || {}, what = { topiary: '다듬은 나무', plant: '꽃·풀', tree: '나무', animal: '동물' }[g.need] || '장식';
      msg = `🎁 ${escHtml(_decoShopName(d))}${_josa(_decoShopName(d), '은', '는')} 도감을 채우면 받아요 — ${what} ${g.count || ''}가지`;
    } else if (st === 'lock') msg = `🔒 ${nm} — Lv${d.reqLv} 이상이 되면 살 수 있어요`;
    else if (st === 'short') msg = `${nm} <b>${cost}G</b> — 골드가 ${cost - CUR.gold}G 모자라요`;
    else {
      msg = cost === 0 ? `${nm} <b>🎁 무료</b> <s>${d.price}G</s>` : `${nm} <b>💰 ${cost}G</b>`;
      //  [DECO-SHOP-BAG-1] 단추 둘 — 🎒 가방에 넣기(사고 끝) · 사서 놓기(손끝에). 사는 길은 둘 다 decoShopBuy → buyDeco() 하나.
      //  200G↑ '한 번 더'는 누른 그 단추가 받는다(다른 단추를 누르면 그 단추로 다시 '한 번 더')
      const armed = twice && _decoShop.armedAt ? (_decoShop.armedMode || 'place') : '';
      btn = `<button class="db-buy db-bag${armed === 'bag' ? ' is-armed' : ''}" onclick="decoShopBuy('bag')">${armed === 'bag' ? '🎒 한 번 더 눌러 사기' : '🎒 가방에 넣기'}</button>`
        + `<button class="db-buy db-place${armed === 'place' ? ' is-armed' : ''}" onclick="decoShopBuy('place')">${armed === 'place' ? '한 번 더 눌러 사기' : '사서 놓기 ▶'}</button>`;
    }
    bar.className = 'deco-buybar is-' + st + (twice ? ' is-twice' : '');
    bar.innerHTML = `<span class="db-msg">${msg}</span>${btn}<button class="db-x" onclick="decoShopPick(null)" aria-label="고르기 풀기">✕</button>`;
    bar.hidden = false;
  }
  if (was !== !bar.hidden) { _decoPillarSync(); _decoFit(); }   // 좁은 폭에서는 막대가 한 줄을 더 쓴다
}

function _josa(word, a, b) {   // 받침 있으면 a, 없으면 b
  const c = String(word || '').trim().slice(-1).charCodeAt(0);
  return (c >= 0xAC00 && c <= 0xD7A3) ? ((c - 0xAC00) % 28 ? a : b) : b;
}

function decoShopBuy(mode) {
  mode = mode === 'bag' ? 'bag' : 'place';
  const d = _decoShop.sel && GAME_DATA.decorations.find(x => x.id === _decoShop.sel);
  if (!d || DECO_TAB !== 'shop' || _decoShopState(d) !== 'ok') { _decoShopBarSync(); return; }
  const cost = _decoCostOf(d), now = Date.now();
  //  [DECO-SHOP-BAG-1] 가방에 넣으면 카드가 골라진 채 남는다 → 두 번 두드림(0.6초 안)이 두 개를 사지 않게. 카드를 다시 고르면 풀린다
  if (now - (_decoShop.lastBuyAt || 0) < 600) return;
  if (cost >= DECO_SHOP_TWICE) {   // 비싼 것은 한 번 더 — 첫 누름은 단추 글만 바꾼다. 두 번 두드림(0.35초 안)은 한 번으로 친다
    if (!_decoShop.armedAt || (_decoShop.armedMode && _decoShop.armedMode !== mode)) {
      _decoShop.armedAt = now; _decoShop.armedMode = mode; _decoShopBarSync(); return;
    }
    if (now - _decoShop.armedAt < 350) return;
  }
  const qty0 = _decoQtyOf(d.id), olds = new Set(document.querySelectorAll('.toast-msg'));
  //  본편 상점의 buyDeco() 를 그대로 부른다. 그 함수의 '한 번 더 누르면 사요'(3초) 걸음은 사기 막대가 이미 받았으므로 통과시킨다.
  _buyDecoArm = { id: d.id, t: now };
  try { buyDeco(d.id); } finally { _buyDecoArm = null; }
  document.querySelectorAll('.toast-msg').forEach(t => { if (!olds.has(t)) t.remove(); });   // 본편 알림 대신 아래 한 줄(겹치면 글자가 뭉개진다)
  if (_decoQtyOf(d.id) !== qty0 + 1) { toast('💸 골드가 모자라요'); _decoGoldSync(); _decoShopRender(); return; }
  decoSaveAbsorbed();   // buyDeco 가 통째 저장을 했다 — 대기 중이던 꾸미기 묶음은 거기에 실려 갔다
  _decoShop.armedAt = 0; _decoShop.armedMode = null; _decoShop.lastBuyAt = now;
  if (mode === 'bag') {   // [DECO-SHOP-BAG-1] 가방에 넣기 = 사고 끝. 상점 그대로 · 아무것도 손에 안 든다
    renderDecoInv(); _decoShopRender();
    toast(`🎒 ${_decoShopName(d)}${_josa(_decoShopName(d), '을', '를')} 가방에 넣었어요`);
    return;
  }
  //  산 직후 = 내 것 탭 · 그 카드가 맨 앞에 골라진 채 · 손끝에 그림
  _decoShop.sel = null; _decoShop.front = d.id; _decoShop.scroll.own = 0;
  _decoFind.q = '';
  if (DECO_MODE !== 'deco') { setDecoMode('deco'); ifSyncModeBtn(); }
  SEL_DECO = d.id;
  decoTab('own');
  _drawDeco(); renderDecoInv(); _decoHandSync();
  _decoGhostStart(d);
  toast(`${d.icon || ''} ${_decoShopName(d)}${_josa(_decoShopName(d), '을', '를')} ${cost === 0 ? '무료로 받았어요' : '샀어요'} — 놓을 곳을 눌러요`);
}

//  산 직후 손끝 그림 — 마우스는 따라다니고, 터치는 마당 가운데에서 기다리다가 손가락을 따라간다. 하나 놓거나 손을 비우면 끝.
let _decoGhost = null;
function _decoGhostMove(e) {
  if (!_decoGhost) return;
  _decoGhost.el.style.transform = `translate(${Math.round(e.clientX - 28)}px, ${Math.round(e.clientY - 64)}px)`;
}
function _decoGhostStart(d) {
  _decoGhostEnd();
  const fs = document.getElementById('interior-fullscreen'), host = document.getElementById('if-topview');
  if (!fs || !host || !_ifMode) return;
  const el = document.createElement('div'); el.id = 'deco-hand-ghost'; el.innerHTML = _decoThumb(d, 56) + '<div class="dg-cap">놓을 곳을 눌러요</div>';
  fs.appendChild(el);
  //  [DECO-SHOP-BAG-1] 토스트만으로는 '지금 누르면 놓인다'를 모른다 → 그림 곁 글 + 누를 수 있는 [✕ 그만](가방에 남김)
  const tip = document.createElement('div'); tip.id = 'deco-hand-tip';
  tip.innerHTML = `<span>${escHtml((d.icon || '') + ' ' + _decoShopName(d))} — 놓을 곳을 눌러요</span><button onclick="decoGhostStop()">✕ 그만</button>`;
  fs.appendChild(tip);
  _decoGhost = { id: d.id, n0: (CUR.houseDecorations || []).filter(p => p.id === d.id).length, el, tip, host };
  const r = host.getBoundingClientRect();
  _decoGhostMove({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 + 36 });
  host.addEventListener('pointermove', _decoGhostMove, { passive: true });
  host.addEventListener('pointerdown', _decoGhostMove, { passive: true });
}
function _decoGhostEnd() {
  if (!_decoGhost) return;
  _decoGhost.host.removeEventListener('pointermove', _decoGhostMove);
  _decoGhost.host.removeEventListener('pointerdown', _decoGhostMove);
  _decoGhost.el.remove(); if (_decoGhost.tip) _decoGhost.tip.remove(); _decoGhost = null;
}
//  ✕ 그만 = 고른 것만 푼다. 산 것은 가방에 그대로(되돌리기·골드와 무관)
function decoGhostStop() {
  const id = _decoGhost && _decoGhost.id, d = id && GAME_DATA.decorations.find(x => x.id === id);
  _decoGhostEnd();
  if (SEL_DECO === id) SEL_DECO = null;
  _drawDeco(); renderDecoInv(); _decoHandSync();
  if (d) toast(`🎒 ${_decoShopName(d)}${_josa(_decoShopName(d), '은', '는')} 가방에 있어요`);
}

//  [DECO-SHOP-BAG-1] 다 놓아서 ×0 인 카드 — '없어진 게 아니라 놓여 있다'. 공간별 놓인 수 글 · 누르면 놓인 그것을 잠깐 반짝
function _decoPlacedWhere(id) {
  const d = GAME_DATA.decorations.find(x => x.id === id), by = {};
  (CUR.houseDecorations || []).forEach(p => { if (p.id === id) { const k = _decoSpaceOf(p); by[k] = (by[k] || 0) + 1; } });
  const ks = Object.keys(by).sort(); if (!ks.length) return '';
  const place = d && d.cat === 'indoor' ? '집 안' : '마당';
  return (ks.length === 1 && ks[0] === '1') ? `${place}에 ${by[1]}` : ks.map(k => `공간${k}에 ${by[k]}`).join(' · ');
}
function _decoFlashPlaced(id) {
  const d = GAME_DATA.decorations.find(x => x.id === id);
  const here = _decoList(CUR).filter(p => p.id === id && p.area === DECO_SCENE);
  toast(`${(d && d.icon) || ''} ${_decoPlacedWhere(id)}개 놓여 있어요${here.length ? ' — 반짝이는 곳' : ''}`);
  if (!_dCv || !here.length) return;
  const rect = _dCv.getBoundingClientRect(), host = document.getElementById('if-topview');
  const hr = host ? host.getBoundingClientRect() : rect, sx = rect.width / _dW, sy = rect.height / _dH;
  const ox = DECO_SCENE === 'yard' ? 0 : (_dCv._offX || 0), oy = DECO_SCENE === 'yard' ? 0 : (_dCv._offY || 0);
  here.forEach(p => {
    const st = _decoAnimState(p);   // 동물은 지금 있는 자리(그 그림)를 반짝
    if (st && st.el) { st.el.classList.remove('deco-flash'); void st.el.offsetWidth; st.el.classList.add('deco-flash'); setTimeout(() => st.el.classList.remove('deco-flash'), 1800); return; }
    const sz = getDecoSize(p.id);
    const rowY = (p.area === 'indoor' && _isWallDeco(p.id) && _inIsWallRow(p.row, p.col)) ? p.row - 1 : p.row;   // [INDOOR-WALL-1] 액자는 벽 띠를 반짝
    const x = rect.left + (ox + p.col * _dC - _dPanX) * sx, y = rect.top + (oy + rowY * _dC - _dPanY) * sy, w = sz.w * _dC * sx, h = sz.h * _dC * sy;
    if (x + w < hr.left || x > hr.right || y + h < hr.top || y > hr.bottom) return;   // 화면 밖이면 글만
    const r = document.createElement('div'); r.className = 'deco-flash-ring';
    r.style.cssText = `left:${Math.round(x)}px;top:${Math.round(y)}px;width:${Math.round(w)}px;height:${Math.round(h)}px`;
    document.body.appendChild(r); setTimeout(() => r.remove(), 1800);
  });
}
function _decoGhostCheck() {
  const g = _decoGhost; if (!g) return;
  if (!_ifMode || SEL_DECO !== g.id || (CUR.houseDecorations || []).filter(p => p.id === g.id).length > g.n0) _decoGhostEnd();
}

// ══ 작품 전시 (Storage 업로드) ══

// [SCAN-LINK-1] 학습지 스캔 — scan/index.html을 전체화면 iframe으로 열고, 결과 JPEG(≤500KB)를 postMessage로 받는다.
//   받은 Blob은 submitArtwork가 사진 대신 그대로 올린다(같은 Storage 경로·같은 승인·보상·좋아요, kind:'worksheet').
let AW_SCAN_BLOB = null;
function openWorksheetScan() {
  closeWorksheetScan();
  const el = document.createElement('div');
  el.id = 'scan-overlay';
  el.style.cssText = 'position:fixed;inset:0;z-index:99990;background:#f8f6f1;display:flex;flex-direction:column';
  el.innerHTML = `<div style="display:flex;align-items:center;gap:.6rem;padding:.45rem .7rem;background:#16213E;flex-shrink:0">
      <span style="color:#fff;font-weight:700;flex:1">📄 학습지 스캔</span>
      <button onclick="closeWorksheetScan()" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:8px;padding:.35rem .8rem;font-family:inherit;cursor:pointer">✕ 닫기</button>
    </div>
    <iframe src="scan/index.html?v=20260917sta" title="학습지 스캔" allow="camera" style="flex:1;border:0;width:100%;background:#f8f6f1"></iframe>`;
  document.body.appendChild(el);
}
function closeWorksheetScan() { const el = document.getElementById('scan-overlay'); if (el) el.remove(); }
window.addEventListener('message', ev => {
  const d = ev.data;
  if (ev.origin !== location.origin || !d || d.type !== 'scan-result' || !(d.blob instanceof Blob)) return;
  if (d.blob.size > 600 * 1024 || d.blob.type !== 'image/jpeg') { toast('스캔 사진을 받지 못했어요. 다시 해 주세요.'); return; }
  AW_SCAN_BLOB = d.blob;
  const fi = document.getElementById('aw-file-input'); if (fi) fi.value = '';
  const txt = document.getElementById('aw-file-text'); if (txt) txt.textContent = '📄 스캔한 학습지 (사진을 고르면 바뀌어요)';
  const img = document.getElementById('aw-preview-img'), wrap = document.getElementById('aw-preview-wrap');
  if (img && wrap) { img.src = URL.createObjectURL(d.blob); wrap.style.display = ''; }
  closeWorksheetScan();
  toast('📄 학습지 스캔 완료! 제목을 쓰고 제출해요');
  const t = document.getElementById('aw-title-input');
  if (t && !t.value) setTimeout(() => t.focus(), 100);
});

// 이미지 미리보기
function previewArtwork(input) {
  if (!input.files || !input.files[0]) return;
  AW_SCAN_BLOB = null;   // [SCAN-LINK-1] 사진을 새로 고르면 스캔본 대신 그 사진
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
  const scanned = AW_SCAN_BLOB;   // [SCAN-LINK-1] 스캔본이 있으면 사진 대신
  if (!scanned && (!fileInput.files || !fileInput.files[0])) { toast('사진을 선택하거나 학습지를 스캔해 주세요!'); return; }

  // 중복 차단: 같은 제목으로 이미 대기중이거나 전시중인 작품
  const dupPending = (CUR.pendingRewards||[]).some(r => r.type==='artwork' && (r.artTitle||'').trim() === title.trim());
  const dupArtwork = DB.getArtworks(CUR.id).some(a => (a.title||a.artTitle||'').trim() === title.trim());
  if (dupPending) { toast(`🎨 "${title}"은 이미 선생님 확인을 기다리고 있어요!`); return; }
  if (dupArtwork) { toast(`🎨 "${title}"은 이미 전시 중인 작품이에요!`); return; }

  // 업로드 UI 표시
  document.getElementById('aw-upload-progress').style.display = '';
  document.getElementById('aw-progress-bar').style.width = '10%';
  document.getElementById('aw-progress-text').textContent = '이미지 압축 중...';

  try {
    // 이미지 리사이징
    const blob = scanned || await resizeImage(fileInput.files[0]);   // 스캔본은 이미 반듯하게 펴고 ≤500KB로 줄였다
    document.getElementById('aw-progress-bar').style.width = '30%';
    document.getElementById('aw-progress-text').textContent = '올리는 중이에요…';

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
        // [ARTFREE-1] 학생 통짜 set → pendingRewards 한 갈래만. 그 사이 바뀐 경험치·골드를 되돌리지 않는다.
        DB.addPendingReward(CUR, {
          id: 'art_' + Date.now(),
          type: 'artwork',
          kind: scanned ? 'worksheet' : 'lesson',   // [SCAN-LINK-1] 스캔한 학습지 — 승인·보상·좋아요는 작품과 같다
          label: scanned ? `📄 "${title}" 학습지 제출` : `🎨 "${title}" 작품 제출`,
          artTitle: title,
          artDesc: desc,
          artUrl: url,
          subject: subject,
          exp: 30, gold: 20,
          icon: '🎨',
          date: Utils.todayStr(),
        });

        // 폼 초기화
        setTimeout(() => {
          document.getElementById('aw-title-input').value  = '';
          document.getElementById('aw-desc-input').value   = '';
          document.getElementById('aw-file-input').value   = '';
          document.getElementById('aw-file-text').textContent = '📷 사진 선택하기';
          AW_SCAN_BLOB = null;
          document.getElementById('aw-preview-wrap').style.display = 'none';
          document.getElementById('aw-upload-progress').style.display = 'none';
          document.getElementById('aw-progress-bar').style.width = '0%';
          toast(scanned ? '📄 학습지 제출 완료! 선생님 확인 후 전시돼요' : '🎨 작품 제출 완료! 선생님 확인 후 전시돼요');
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
    progTxt.textContent = `올리는 중 ${done+1}/${total}…`;
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
            background:rgba(255,180,0,.85);color:#1a1a1a;padding:.1rem .3rem;border-radius:4px;font-weight:700">확인 중</div>`:''}
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
      ${a.artUrl?`<img src="${escHtml(a.artUrl)}" style="width:100%;max-height:200px;object-fit:cover;display:block">`:''}
      <div style="padding:.75rem .9rem">
        <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.35rem;flex-wrap:wrap">
          <span style="font-size:.65rem;font-weight:800;padding:.18rem .55rem;border-radius:20px;
            background:rgba(255,215,0,.18);color:var(--gold);border:1px solid rgba(255,215,0,.3)">⏳ 확인 중</span>
          ${a.subject?`<span style="font-size:.65rem;padding:.18rem .5rem;border-radius:20px;
            background:rgba(255,255,255,.07);color:var(--txt3);border:1px solid rgba(255,255,255,.1)">${escHtml(a.subject)}</span>`:''}
        </div>
        <div style="font-size:.92rem;font-weight:800;color:var(--txt1);margin-bottom:.25rem">${escHtml(a.artTitle||'')}</div>
        ${a.artDesc?`<div style="font-size:.75rem;color:var(--txt2);line-height:1.55;
          display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escHtml(a.artDesc)}</div>`:''}
      </div>
    </div>`).join('');

  const approvedHtml = approved.map((a,i) => {
    const url = a.artUrl||a.link||'';
    const lbIdx = lbImgs.findIndex(x=>x.url===url);
    const title = escHtml(a.title||a.artTitle||'');
    const desc = escHtml(a.comment||a.artDesc||'');
    return `
    <div style="background:rgba(255,255,255,.04);border:1.5px solid rgba(46,204,113,.15);
      border-radius:14px;overflow:hidden;margin-bottom:.8rem">
      ${url?`<div style="position:relative;cursor:pointer" onclick="openLightbox(window._artLbImgs,${lbIdx})">
        <img src="${escHtml(url)}" style="width:100%;max-height:220px;object-fit:cover;display:block"
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
            background:rgba(46,204,113,.15);color:var(--emerald);border:1px solid rgba(46,204,113,.25)">✓ 전시 중</span>
          ${a.subject?`<span style="font-size:.65rem;padding:.18rem .5rem;border-radius:20px;
            background:rgba(255,255,255,.07);color:var(--txt3);border:1px solid rgba(255,255,255,.1)">${escHtml(a.subject)}</span>`:''}
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
    toast('마음과 그 크기를 골라 주세요!'); return;
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
    html += `<div style="font-size:.7rem;color:var(--txt3);margin-bottom:.6rem">마스터리북을 사면 레벨이 올라요. 상점 → 📚 마스터리북 탭</div>`;
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
    html += `<div style="font-size:.72rem;color:var(--txt3);margin-bottom:.5rem">⚔️ 현재 장착 장비</div>`;
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
    return `<div style="background:rgba(255,255,255,.04);border:1px solid ${done?'rgba(46,204,113,.3)':pending?'rgba(255,215,0,.25)':'rgba(255,255,255,.08)'};
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

  toast('📚 독서 기록 제출! 선생님 확인 후 경험치가 지급돼요');
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
          ${isPending?'확인 중':'✓ 완료'}</span>
        <span style="font-weight:700;font-size:.88rem;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${escHtml(r.bookTitle||r.title||'')}</span>
        ${cat?`<span style="font-size:.65rem;background:rgba(93,173,226,.12);color:var(--sky);border-radius:10px;padding:.1rem .45rem;flex-shrink:0">${cat}</span>`:''}
        ${r.rating?`<span style="font-size:.75rem;flex-shrink:0">${starStr(r.rating)}</span>`:''}
        <span style="font-size:.66rem;color:var(--txt3);flex-shrink:0">${r.bookDate||r.date||''}</span>
      </div>
      <!-- 내용 (항상 표시) -->
      <div style="display:flex;flex-direction:column;gap:.35rem;font-size:.78rem;color:var(--txt2);line-height:1.6">
        ${charName?`<div><b style="color:var(--txt3)">🧑 인상 깊은 인물:</b> ${escHtml(charName)}${charReason?' — '+escHtml(charReason):''}</div>`:''}
        ${summary?`<div><b style="color:var(--txt3)">📖 줄거리:</b><div style="margin-top:.1rem;white-space:pre-wrap">${escHtml(summary)}</div></div>`:''}
        ${reflection?`<div><b style="color:var(--txt3)">💬 느낀 점:</b><div style="margin-top:.1rem;white-space:pre-wrap">${escHtml(reflection)}</div></div>`:''}
      </div>
      ${r.teacherComment?`<div style="margin-top:.45rem;font-size:.72rem;color:var(--emerald);
        background:rgba(46,204,113,.08);border-radius:8px;padding:.3rem .5rem">
        💬 선생님: ${escHtml(r.teacherComment)}</div>`:''}
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
    self:  `<span class="qr-status waiting">📨 신청 중</span>`,
    done:  `<span class="qr-status approved">✅ 완료</span>`,
  };
  document.getElementById('quest-list').innerHTML = (claimBtn||'') + (all.length > 0
    ? all.map(q => `<div class="quest-row">
        <div class="qr-icon">${q.icon}</div>
        <div class="qr-body"><div class="qr-name">${escHtml(q.name)}</div><div class="qr-desc">${q.date||''}</div></div>
        <div class="qr-right">
          ${statusLabel[q.status]||statusLabel.done}
          <span class="qr-rewards">${q.exp>0?`+${q.exp}EXP · `:''}${q.gold>0?`+${q.gold}G`:q.status==='self'?'보상 대기':''}</span>
        </div>
      </div>`).join('')
    : `<div style="color:var(--txt3);font-size:.82rem;padding:1rem 0">아직 활동 내역이 없어요<br>
       <span style="font-size:.72rem">✏️ 활동 신청 탭에서 오늘 활동을 알려주세요!</span></div>`);
}

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

// [DECO-FRIEND-ART-1] 그림(SVG)이 늦게 도착하면 _drawDeco() 는 **내** 캔버스만 다시 그린다 → 처음 가 보는 친구 마당은
//  옛 캔버스 그림(_DFN)·단색 물로 그려진 채 그대로였다(내가 이미 본 장식만 새 그림). 구경 중이면 구경 판도 다시 그린다.
//  한꺼번에 여러 장이 와도 0.05초에 한 번.
let _ffRedrawTimer = null;
function _ffRedrawSoon() {
  if (!_ffFriend || _ffRedrawTimer) return;
  _ffRedrawTimer = setTimeout(() => { _ffRedrawTimer = null; if (_ffFriend) _renderFriendCanvas(); }, 50);
}

function closeFriendFullscreen() {
  _animStopLayer('ff-topview');   // [DECO-ANIM-1]
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
  const prevSpace = DECO_SPACE; DECO_SPACE = 1;   // [DECO-SPACE-1] 친구 구경은 공간 1
  const prevCv    = _dCv;
  const prevCtx   = _dCtx;
  const prevW     = _dW;
  const prevH     = _dH;
  const prevC     = _dC;
  const prevIfMode = _ifMode;
  const prevCont  = _ifActiveContainer;
  //  [DECO-FRIEND-PAN-1] 구경 판은 옮기지 않은 채 한 장으로 그린다 — 내 마당에서 옮겨 본 값(_dPanX/Y)이 새면
  //  보이는 칸 고르기(_decoVisible)가 친구 마당 왼쪽·위를 안 그리고(까맣게 빔), 동물 층도 그만큼 밀려 사라졌다.
  const prevPanX = _dPanX, prevPanY = _dPanY, prevZoom = _dZoom;
  _dPanX = 0; _dPanY = 0; _dZoom = 1;

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
  let C    = Math.floor(W / cols);
  let H    = Math.min(C * rows, maxH);
  //  [INDOOR-ROOMS-1] 친구 집 안에 방이 있으면 방 둘레에 맞춰 한 장(아래쪽 방이 안 잘리게)
  let fpx = 0, fpy = 0;
  const fRooms = _ffScene === 'yard' ? [] : _inRooms(_ffFriend, 1);
  if (fRooms.length) {
    let r0 = 99, c0 = 99, r1 = -1, c1 = -1;
    fRooms.forEach(rm => { r0 = Math.min(r0, rm.r - 1); c0 = Math.min(c0, rm.c); r1 = Math.max(r1, rm.r + rm.h); c1 = Math.max(c1, rm.c + rm.w); });
    const bw = c1 - c0 + 1, bh = r1 - r0 + 1;
    C = Math.max(4, Math.min(Math.floor(W / bw), Math.floor(maxH / bh)));
    H = Math.max(120, Math.min(maxH, bh * C));
    const offX = Math.max(0, Math.floor((W - cols * C) / 2)), offY = Math.max(Math.floor(C * .9), Math.floor((H - rows * C) / 2));
    fpx = offX + c0 * C - Math.max(0, (W - bw * C) / 2); fpy = offY + r0 * C - Math.max(0, (H - bh * C) / 2);
  }

  _dCv  = cv; _dW = W; _dH = H; _dC = C;
  cv.width  = W * 2; cv.height = H * 2;
  cv.style.width  = W + 'px'; cv.style.height = H + 'px';
  _dCtx = cv.getContext('2d');
  _dCtx.scale(2, 2);
  _dCtx.clearRect(0, 0, W, H);
  if (fpx || fpy) _dCtx.translate(-fpx, -fpy);   // [INDOOR-ROOMS-1]
  if (_ffScene === 'yard') _drawYard();
  else _drawIndoor();
  // [DECO-ANIM-1] 친구 마당에서도 동물이 돌아다닌다
  _animSyncLayer('ff-topview', _ffFriend, _ffScene, C, W, H, 0, 0);

  // 복원
  _dPanX = prevPanX; _dPanY = prevPanY; _dZoom = prevZoom;   // [DECO-FRIEND-PAN-1]
  DECO_SPACE = prevSpace;   // [DECO-SPACE-1]
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
    //  [DECO-FRIEND-PAN-1] 내 화면 상태(옮긴 자리·배율·공간 번호)가 친구 그림에 새지 않게
    const prevPanX = _dPanX, prevPanY = _dPanY, prevZoom = _dZoom, prevSpace = DECO_SPACE;
    _dPanX = 0; _dPanY = 0; _dZoom = 1; DECO_SPACE = 1;   // 친구 구경은 공간 1

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
    _dPanX = prevPanX; _dPanY = prevPanY; _dZoom = prevZoom; DECO_SPACE = prevSpace;   // [DECO-FRIEND-PAN-1]
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
      <div class="modal-title">${f.avatar} ${escHtml(f.name)}의 집</div>
      <button class="modal-close" onclick="this.closest('.overlay').remove()">✕</button>
    </div>
    <!-- 프로필 -->
    <div style="display:flex;align-items:center;gap:.9rem;padding:.75rem;
      background:rgba(255,255,255,.04);border-radius:12px;margin-bottom:.8rem">
      <div style="font-size:2.8rem">${f.avatar}</div>
      <div>
        <div style="font-weight:700">${escHtml(f.name)}
          ${f.title?`<span style="font-size:.72rem;color:var(--gold);margin-left:.3rem">[${escHtml(f.title)}]</span>`:''}
        </div>
        <div style="font-size:.76rem;color:var(--txt2);margin-top:.2rem">
          Lv.${f.level} · 📚${f.bookCount||0}권 · ⚔️${(f.monsterLog||[]).length}마리
        </div>
      </div>
    </div>
    <!-- 탭 -->
    <div class="modal-tabs" style="margin-bottom:.8rem" id="${modalId}-tabs">
      <button class="mtab on" onclick="openFriendFullscreen('${id}')">🌸 꾸미기 보기</button>
      <button class="mtab"    onclick="vfTab('${modalId}','books',this)">📚 독서</button>
      <button class="mtab"    onclick="vfTab('${modalId}','artwork',this)">🖼️ 작품</button>
    </div>
    <!-- 인테리어 탭 (전체화면으로 열림) -->
    <div id="${modalId}-deco">
      <div style="text-align:center;padding:1.5rem 0;color:var(--txt3);font-size:.82rem">
        위의 "🌸 꾸미기 보기" 버튼을 눌러주세요
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
                <img src="${escHtml(a.artUrl)}" style="width:100%;aspect-ratio:1;object-fit:cover">
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
function hudBtnText(icon, label) {
  return window.innerWidth <= HUD_NARROW_PX ? icon : icon + ' ' + label;
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
      <div style="font-size:.72rem;color:var(--txt3)">경험치·골드·칭호를 받았어요!</div>
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
    document.querySelectorAll('[id="ach-tile-notif"]').forEach(n => { n.style.display = ''; });   // [HOME-TOGGLE-MOBILE-1] 두 판 모두
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

// [ER-2] DB 저장 실패 시 학생에게 안내 (gamedata의 _onSaveError 훅 — #110을 학생 화면까지 완성)
window.onDbSaveError = () => toast('⚠️ 저장에 실패했어요. 인터넷을 확인하고 다시 해주세요.');

// ══════════════════════════════════════════════════
//  오늘의 학습 (교과 문제 풀이) — DAILY-STUDY-1
//  · 하루 10문제. 학생이 과목을 고른다.
//  · 팝업 강제 방식을 폐기하고 홈 카드에서 학생이 눌러서 시작한다.
//  · 문항/채점은 curriculum.js(CurriculumUtils)를 그대로 쓴다.
//  · 기록은 problemRecords에 남기고, **고른 오답까지 저장**한다(혼동 진단용).
// ══════════════════════════════════════════════════

const STUDY_PER_DAY = 10;   // 하루 분량

// ══════════════════════════════════════════════════
//  [ARTFREE-1] 우리 반 작품 올리기 — 수업과 무관하게 아무 그림이나 올리는 통로
//  · 디지털 드로잉 결과물이 주 용도라 제목을 안 써도 올라간다(수업 작품은 기존 규칙 그대로).
//  · 올리면 '내 작품'에는 바로 보이고 '확인 중' 딱지가 붙는다.
//    선생님이 확인해야 '우리 반 그림'에 걸린다 — 그냥 올리는 느낌과 안전을 함께.
//  · 저장은 기존 Storage artworks/ 경로를 그대로 쓰고 파일명만 free_ 로 구분한다.
//  · 학생 통짜 set을 하지 않는다(DB.addPendingReward가 pendingRewards 한 갈래만 쓴다).
// ══════════════════════════════════════════════════
const FREE_ART_EXP = 0;          // 자유 작품 보상 — 갤러리에 걸리는 것 자체가 보상(값만 바꾸면 지급)
const FREE_ART_GOLD = 0;
const FREE_ART_MAX_DAY = 5;      // 하루 올릴 수 있는 장수
const FREE_ART_MAX_TOTAL = 30;   // 한 사람이 쌓아 둘 수 있는 장수
const FREE_ART_PX = 1200;        // 드로잉은 800px이면 선이 뭉갠다

let _afTab = 'class';            // 'class' 우리 반 그림 · 'mine' 내 작품
let _afBlob = null, _afName = '';

function myFreeArtCount() {
  const today = Utils.todayStr();
  const mine = DB.getArtworks(CUR.id).filter(a => (a.kind || 'lesson') === 'free');
  const pend = (CUR.pendingRewards || []).filter(r => r.type === 'artwork' && r.kind === 'free');
  return {
    today: mine.filter(a => a.date === today).length + pend.filter(r => r.date === today).length,
    total: mine.length + pend.length,
  };
}
// 갤러리에 거는 목록 — 승인됐고 내려지지 않은 것
function galleryArtworks() {
  return (DB.load().artworks || []).filter(a => a && !a.hidden).slice().reverse();
}
function artLikeCount(a) { return Object.keys(a.likes || {}).length; }
function iLikedArt(a) { return !!(a.likes || {})[CUR.id]; }
function toggleArtLike(id) {
  const a = (DB.load().artworks || []).find(x => x.id === id);
  if (!a) return;
  DB.setArtworkLike(id, CUR.id, !iLikedArt(a));
  renderArtFree();
}

function openArtFree(tab) {
  _afTab = tab || 'class';
  _afBlob = null; _afName = '';
  const el = _artFreeEl();
  el.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  renderArtFree();
}
function closeArtFree() {
  const el = document.getElementById('m-artfree');
  if (el) el.style.display = 'none';
  document.body.style.overflow = '';
  _afBlob = null;
  if (typeof renderArtworks === 'function' && document.getElementById('artwork-list')) renderArtworks();
}
function _artFreeEl() {
  let el = document.getElementById('m-artfree');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'm-artfree';
  el.style.cssText = 'position:fixed;inset:0;z-index:8500;background:#14130f;display:none;flex-direction:column';
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:.6rem;padding:.6rem .9rem;background:#1b1a17;
      border-bottom:1px solid rgba(255,255,255,.1);flex-shrink:0">
      <span style="font-weight:800;color:var(--gold);flex:1">🎨 우리 반 작품</span>
      <button onclick="closeArtFree()" aria-label="닫기" style="background:none;border:none;color:var(--txt);
        font-size:1.35rem;cursor:pointer;padding:.1rem .4rem;font-family:inherit">✕</button>
    </div>
    <div id="artfree-body" style="flex:1;overflow-y:auto;padding:.9rem"></div>`;
  document.body.appendChild(el);
  return el;
}

// 사진 고르기 — 찍기와 파일 고르기 둘 다
function pickArtFree(useCamera) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  if (useCamera) inp.setAttribute('capture', 'environment');
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    _afName = f.name || '';
    try {
      _afBlob = await resizeImage(f, FREE_ART_PX);
      renderArtFree('upload');
    } catch (e) { toast('사진을 읽지 못했어요'); }
  };
  inp.click();
}

async function submitArtFree() {
  if (!_afBlob) { toast('먼저 그림을 골라 주세요'); return; }
  const raw = (document.getElementById('af-title') || {}).value || '';
  const title = raw.trim() || '제목 없는 그림';
  const cnt = myFreeArtCount();
  if (cnt.today >= FREE_ART_MAX_DAY) { toast(`오늘은 ${FREE_ART_MAX_DAY}장까지 올릴 수 있어요`); return; }
  if (cnt.total >= FREE_ART_MAX_TOTAL) { toast(`작품은 ${FREE_ART_MAX_TOTAL}장까지 모을 수 있어요`); return; }

  renderArtFree('uploading');
  try {
    const filename = 'artworks/free_' + CUR.id + '_' + Date.now() + '.jpg';
    const ref = firebase.storage().ref(filename);
    const task = ref.put(_afBlob);
    task.on('state_changed',
      snap => {
        const bar = document.getElementById('af-bar');
        if (bar && snap.totalBytes) bar.style.width = Math.round(snap.bytesTransferred / snap.totalBytes * 100) + '%';
      },
      err => { console.warn('[artfree] 업로드 실패', err); renderArtFree('failed'); },
      async () => {
        try {
          const url = await ref.getDownloadURL();
          // 학생 통짜 set을 하지 않는다 — pendingRewards 한 갈래만 쓴다
          await DB.addPendingReward(CUR, {
            id: 'art_' + Date.now(),
            type: 'artwork', kind: 'free',
            label: `🎨 "${title}" 그림 올림`,
            artTitle: title, artDesc: '', artUrl: url, subject: '',
            exp: FREE_ART_EXP, gold: FREE_ART_GOLD, icon: '🎨',
            date: Utils.todayStr(),
          });
          _afBlob = null;
          _afTab = 'mine';
          renderArtFree();
          toast('🎨 올렸어요! 선생님이 확인하면 우리 반 그림에 걸려요');
          if (typeof renderMain === 'function') { renderMain(); renderMobile(); }
        } catch (e) { console.warn('[artfree] 저장 실패', e); renderArtFree('failed'); }
      }
    );
  } catch (e) { console.warn('[artfree] 올리기 오류', e); renderArtFree('failed'); }
}

function renderArtFree(mode) {
  const body = document.getElementById('artfree-body');
  if (!body) return;
  const cnt = myFreeArtCount();
  const tabs = `
    <div style="display:flex;gap:.4rem;margin-bottom:.9rem">
      ${[['class', '우리 반 그림'], ['mine', '내 작품']].map(t => `
        <button onclick="_afTab='${t[0]}';renderArtFree()"
          style="flex:1;padding:.6rem;border-radius:10px;font-family:inherit;font-size:.92rem;cursor:pointer;
            border:1px solid ${_afTab === t[0] ? 'rgba(200,150,46,.45)' : 'rgba(255,255,255,.12)'};
            background:${_afTab === t[0] ? 'rgba(200,150,46,.16)' : 'rgba(255,255,255,.04)'};
            color:${_afTab === t[0] ? 'var(--gold)' : 'var(--txt3)'};font-weight:${_afTab === t[0] ? '700' : '400'}">
          ${t[1]}</button>`).join('')}
    </div>`;

  // 올리기 칸
  let up = '';
  if (mode === 'uploading') {
    up = `<div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:1rem;margin-bottom:.9rem">
      <div style="font-weight:700;margin-bottom:.5rem">올리는 중이에요</div>
      <div style="height:9px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden">
        <div id="af-bar" style="height:100%;width:8%;background:var(--sky);border-radius:99px;transition:width .2s"></div>
      </div>
      <div style="font-size:.8rem;color:var(--txt3);margin-top:.5rem">잠깐만 기다려 주세요</div></div>`;
  } else if (mode === 'failed') {
    up = `<div style="border:1px solid rgba(210,112,90,.5);background:rgba(210,112,90,.12);border-radius:14px;padding:1rem;margin-bottom:.9rem">
      <div style="font-weight:700;color:var(--red)">😢 올리지 못했어요</div>
      <div style="font-size:.85rem;color:var(--txt3);margin:.4rem 0 .7rem">인터넷이 잠깐 끊긴 것 같아요. 고른 그림은 그대로 있어요.</div>
      <div style="display:flex;gap:.5rem">
        <button onclick="submitArtFree()" style="flex:1;padding:.7rem;border-radius:10px;border:none;
          background:var(--gold);color:#191510;font-family:inherit;font-weight:700;cursor:pointer">다시 올리기</button>
        <button onclick="renderArtFree('upload')" style="flex:1;padding:.7rem;border-radius:10px;
          border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:var(--txt);
          font-family:inherit;cursor:pointer">나중에 하기</button>
      </div></div>`;
  } else if (_afTab === 'mine' || mode === 'upload') {
    const has = !!_afBlob;
    up = `<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:1rem;margin-bottom:.9rem">
      <div style="display:flex;gap:.6rem;margin-bottom:${has ? '.8rem' : '0'}">
        <button onclick="pickArtFree(true)" style="flex:1;padding:1rem .5rem;border-radius:12px;cursor:pointer;
          border:1px dashed rgba(255,255,255,.22);background:rgba(255,255,255,.04);color:var(--txt);font-family:inherit">
          <div style="font-size:1.5rem">📷</div>사진 찍기</button>
        <button onclick="pickArtFree(false)" style="flex:1;padding:1rem .5rem;border-radius:12px;cursor:pointer;
          border:1px dashed rgba(255,255,255,.22);background:rgba(255,255,255,.04);color:var(--txt);font-family:inherit">
          <div style="font-size:1.5rem">🖼️</div>파일 고르기</button>
      </div>
      ${has ? `
        <div style="font-size:.82rem;color:var(--txt3);margin-bottom:.5rem">고른 그림: ${escHtml(_afName || '그림')}</div>
        <input id="af-title" placeholder="제목 (안 써도 괜찮아요)" maxlength="30"
          style="width:100%;padding:.75rem;border-radius:10px;border:1px solid rgba(255,255,255,.12);
            background:#191816;color:var(--txt);font-family:inherit;font-size:1rem">
        <button onclick="submitArtFree()" style="width:100%;margin-top:.7rem;padding:.9rem;border-radius:12px;
          border:none;background:var(--gold);color:#191510;font-family:inherit;font-size:1.05rem;font-weight:800;cursor:pointer">올리기</button>
        <div style="font-size:.78rem;color:var(--txt3);text-align:center;margin-top:.5rem">
          오늘 ${cnt.today}장 올렸어요 · 하루 ${FREE_ART_MAX_DAY}장까지</div>` : ''}
    </div>`;
  }

  // 목록
  const tag = (t, c, bg) => `<span style="display:inline-block;font-size:.68rem;padding:.1rem .45rem;border-radius:99px;margin-right:.25rem;background:${bg};color:${c}">${t}</span>`;
  let list = '';
  if (_afTab === 'class') {
    const arts = galleryArtworks();
    list = arts.length === 0
      ? `<div style="text-align:center;padding:2.5rem 0;color:var(--txt3);font-size:.9rem">아직 걸린 그림이 없어요 🎨</div>`
      : `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.6rem">${arts.map(a => {
          const who = (DB.getStudent(a.studentId) || {}).name || '친구';
          const liked = iLikedArt(a), n = artLikeCount(a);
          return `<div style="min-width:0;border:1px solid rgba(255,255,255,.1);border-radius:12px;overflow:hidden;background:rgba(255,255,255,.04)">
            <img src="${escHtml(a.artUrl || '')}" alt="" loading="lazy"
              style="width:100%;height:110px;object-fit:cover;display:block;background:#0f0e0c">
            <div style="padding:.5rem .55rem">
              <div style="font-size:.82rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(a.title || '제목 없는 그림')}</div>
              <div style="display:flex;align-items:center;gap:.3rem;font-size:.72rem;color:var(--txt3);margin-top:.2rem">
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(who)}</span>
                <button onclick="toggleArtLike('${a.id}')" style="background:none;border:none;cursor:pointer;
                  font-family:inherit;font-size:.75rem;padding:.1rem .2rem;color:${liked ? 'var(--red)' : 'var(--txt3)'}">
                  ${liked ? '❤️' : '🤍'} ${n}</button>
              </div>
            </div></div>`;
        }).join('')}</div>`;
  } else {
    const mine = DB.getArtworks(CUR.id).slice().reverse();
    const pend = (CUR.pendingRewards || []).filter(r => r.type === 'artwork').slice().reverse();
    const rows = [
      ...pend.map(r => ({ url: r.artUrl, title: r.artTitle, kind: r.kind || 'lesson', wait: true })),
      ...mine.map(a => ({ url: a.artUrl, title: a.title, kind: a.kind || 'lesson', wait: false, hidden: a.hidden })),
    ];
    list = rows.length === 0
      ? `<div style="text-align:center;padding:2.5rem 0;color:var(--txt3);font-size:.9rem">아직 올린 그림이 없어요<br><span style="font-size:.8rem">위에서 첫 그림을 올려 보세요</span></div>`
      : `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.6rem">${rows.map(r => `
          <div style="min-width:0;border:1px solid rgba(255,255,255,.1);border-radius:12px;overflow:hidden;background:rgba(255,255,255,.04)">
            <img src="${escHtml(r.url || '')}" alt="" loading="lazy"
              style="width:100%;height:110px;object-fit:cover;display:block;background:#0f0e0c">
            <div style="padding:.5rem .55rem">
              <div style="font-size:.82rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(r.title || '제목 없는 그림')}</div>
              <div style="margin-top:.25rem">
                ${r.kind === 'free' ? tag('자유', 'var(--sky)', 'rgba(93,173,226,.16)') : r.kind === 'worksheet' ? tag('학습지', 'var(--gold)', 'rgba(200,150,46,.16)') : tag('수업', 'var(--emerald)', 'rgba(46,204,113,.16)')}
                ${r.wait ? tag('확인 중', 'var(--gold)', 'rgba(200,150,46,.18)') : ''}
                ${r.hidden ? tag('내려짐', 'var(--txt3)', 'rgba(255,255,255,.08)') : ''}
              </div>
            </div></div>`).join('')}</div>`;
  }
  body.innerHTML = tabs + up + list;
}

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
function buildStudyCardHTML(s) {
  if (typeof CurriculumUtils === 'undefined') return '';
  const recs  = getTodayStudyRecords(s.id);
  const done  = recs.reduce((n, r) => n + (r.total || 0), 0);
  const right = recs.reduce((n, r) => n + (r.correct || 0), 0);
  const cleared = done >= STUDY_PER_DAY;
  const pct = done > 0 ? Math.round(right / done * 100) : 0;

  // [ARTFREE-1] 그림 올리기는 집 탭 안쪽에 있어 아이들이 못 찾았다 — 홈에서 바로 들어가게 한다
  const artCard = `
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

  return artCard + `
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
  STUDY_SESSION = null;
  closeModal('m-study');
  renderAll();
}

// 단원별 성취도 — 내가 푼 기록에서 단원마다 몇 개 중 몇 개를 맞혔는지
//   answers[]가 있는 기록만 집계한다(단원 정보가 거기 들어 있음).
function getUnitStats(studentId) {
  if (typeof DB.getProblemRecords !== 'function') return {};
  const st = {};
  for (const r of DB.getProblemRecords(studentId)) {
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
  if (ttl) ttl.textContent = '📚 오늘의 학습';

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
          <div style="padding:1.1rem 1.2rem;border-radius:14px;margin-bottom:.9rem;
            border:1px solid rgba(93,173,226,.4);background:rgba(93,173,226,.10)">
            <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.2rem">
              <span style="font-size:1.6rem">🔁</span>
              <span style="font-size:1.15rem;font-weight:800;color:var(--sky)">오늘 복습할 것 ${dueTotal}개</span>
            </div>
            <div style="font-size:.88rem;color:var(--txt3);margin-bottom:.8rem">한 번 푼 문제를 잊을 때쯤 다시 보여 줘요</div>
            <div style="display:grid;gap:.45rem">
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
  const externalCards = EXTERNAL_STUDY.map(x => x.embed ? `
          <button class="st-subject-card" onclick="openExternalEmbed('${x.key}')"
            style="display:flex;align-items:center;gap:1rem;width:100%;padding:1.15rem 1.2rem;
              border:1px solid ${x.border};cursor:pointer;
              background:${x.bg};color:var(--txt);font-family:inherit;text-align:left;box-sizing:border-box">
            <span style="font-size:2.2rem">${x.icon}</span>
            <span style="flex:1;min-width:0">
              <span class="st-subject" style="display:block;font-weight:700">${escHtml(x.title)}</span>
              <span class="st-subject-sub" style="display:block;color:var(--txt3);margin-top:.2rem">${escHtml(x.sub)}</span>
            </span>
            <span style="font-size:1.3rem;color:var(--txt3)">▶</span>
          </button>` : `
          <a class="st-subject-card" href="${x.href}" target="_blank" rel="noopener"
            style="display:flex;align-items:center;gap:1rem;width:100%;padding:1.15rem 1.2rem;
              border:1px solid ${x.border};cursor:pointer;text-decoration:none;
              background:${x.bg};color:var(--txt);font-family:inherit;text-align:left;box-sizing:border-box">
            <span style="font-size:2.2rem">${x.icon}</span>
            <span style="flex:1;min-width:0">
              <span class="st-subject" style="display:block;font-weight:700">${escHtml(x.title)}</span>
              <span class="st-subject-sub" style="display:block;color:var(--txt3);margin-top:.2rem">${escHtml(x.sub)}</span>
            </span>
            <span style="font-size:1.3rem;color:var(--txt3)">↗</span>
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
      <div style="display:grid;gap:.7rem">
        ${externalCards}
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
  const recent = DB.getProblemRecords(CUR.id).slice(-8);
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
