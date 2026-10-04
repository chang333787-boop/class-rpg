// ══════════════════════════════════════════════════
//  HTML 이스케이프 (학생 입력 문자열 → innerHTML/onclick 삽입용)
// ══════════════════════════════════════════════════
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
// onclick="fn('...')" 처럼 HTML 속성 안 JS 문자열 인자용 (JS 이스케이프 → HTML 이스케이프 순)
function escJsAttr(s) {
  return escHtml(String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
}

// 링크·오디오 주소 검사 (Q3-URL-2) — student.js safeUrl 과 같은 규칙. http/https 만, 다른 스킴은 빈 문자열.
//  브라우저가 주소 속 탭·줄바꿈을 무시하므로 제어 문자(코드 0~31, 127)를 먼저 지운다.
function safeUrl(u) {
  const s = [...String(u == null ? '' : u)].filter(ch => ch.charCodeAt(0) > 31 && ch.charCodeAt(0) !== 127).join('').trim();
  if (!s) return '';
  if (/^https?:[/][/]/i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return '';
  return 'https://' + s.replace(/^[/]+/, '');
}

// ══════════════════════════════════════════════════
//  ADMIN LOGIN
// ══════════════════════════════════════════════════
async function adminLogin() {
  const input = document.getElementById('admin-pw-input').value;
  const pw = await DB.getAdminPw();
  if (input === pw) {
    document.getElementById('admin-login-screen').style.display = 'none';
    document.getElementById('admin-app').style.display = 'grid';
    renderAll();
    updatePendingBadge();
    updatePromoBadge();
    updatePwResetBadge();
    populateSelectStudents();
    autoBackupOnLogin(); // 오늘 백업 없으면 자동 저장
  } else {
    document.getElementById('admin-login-err').textContent = '❌ 비밀번호가 틀렸어요';
  }
}

function changeAdminPw() {
  const newPw = document.getElementById('set-admin-pw').value.trim();
  if (!newPw || newPw.length < 4) { notify('비밀번호는 4자 이상이어야 해요', 'error'); return; }
  DB.setAdminPw(newPw);
  document.getElementById('set-admin-pw').value = '';
  notify('🔑 관리자 비밀번호 변경 완료!');
}

// ══════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════
window.onload = async () => {
  const loading = document.getElementById('loading-screen');
  try {
    await DB.init();
    applyShopOverrides();
    applyBattleSettings();
    checkAutoDailyQuests(); // 일일퀘스트 자동 등록 체크
    DB.onDataChange(() => {
      applyShopOverrides(); // 설정 변경 시 실시간 반영
      applyBattleSettings(); // 전투 설정 변경 시 실시간 반영
      // 관리자 로그인 상태일 때만 재렌더
      if (document.getElementById('admin-app').style.display !== 'none') {
        _adminLive = true; // [LIVE-INPUT-1] 이 안의 다시 그리기 = 실시간 경로
        try {
          renderAll();
          updatePendingBadge();
          updatePromoBadge();
          updatePwResetBadge();
          // 현재 열려 있는 탭도 재렌더
          try {
            const activePage = document.querySelector('.page.active')?.id?.replace('p-','');
            if (activePage === 'weekly')   renderWeeklyAdminPage();
            if (activePage === 'books'    && !adminLiveBusy('books-list'))    renderBooksPage();
            if (activePage === 'memories' && !adminLiveBusy('memories-list')) renderMemoriesPage();
            if (activePage === 'activity') renderActivityPage();
            if (activePage === 'study' && !adminLiveBusy('study-scope-body')) renderStudyScopePage();
            if (activePage === 'stats')    renderStatsPage();
            if (activePage === 'emotion')  renderEmotionPage();
            if (activePage === 'emotionalerts') renderEmotionAlerts(); // [LIVE-INPUT-1] 아이의 '선생님과 이야기' 요청이 바로 뜨게
          } catch(e) { console.warn('탭 재렌더 오류:', e.message); }
        } finally { _adminLive = false; }
      }
    });
  } catch(e) {
    console.error('Firebase 연결 실패:', e);
    alert('서버 연결에 실패했습니다. 인터넷 연결을 확인해주세요.');
  }
  loading.style.display = 'none';
  loading.remove();
  document.getElementById('admin-pw-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') adminLogin();
  });
};

// [LIVE-INPUT-1] 학생 저장 → onDataChange → 다시 그리기가 교사가 쓰던 칸(선생님 한마디·독서 코멘트·추억 제목·학습 보상)을
//  지우지 않게. 실시간 경로에서만, 그 영역 안에 쓰는 중(포커스)이거나 고친 뒤 아직 저장 안 한 칸이 있으면 이번 그리기를 미룬다.
//  교사가 직접 누른 단추 뒤의 renderAll() 은 그대로 다시 그린다. 배지·대시보드·승인 격자는 가드 없이 늘 실시간.
let _adminLive = false;
const _adminTyped = new WeakSet();
document.addEventListener('input', e => {
  const t = e.target;
  // 스스로 저장하는 칸(onchange·onblur 저장)은 '저장 안 한 값'으로 치지 않는다 — 포커스 동안만 지킨다
  if (t && t.matches && t.matches('input,textarea,select') && !t.hasAttribute('onchange') && !t.hasAttribute('onblur')) _adminTyped.add(t);
}, true);
function adminLiveBusy(boxId) {
  if (!_adminLive) return false;
  const box = document.getElementById(boxId);
  if (!box) return false;
  const a = document.activeElement;
  if (a && box.contains(a) && a.matches('input,textarea,select')) return true;
  return [...box.querySelectorAll('input,textarea,select')].some(el => _adminTyped.has(el));
}

function renderAll() {
  // 각 함수를 개별 try/catch로 감싸서 한 곳 실패해도 나머지 계속 실행
  const safe = (fn, name) => { try { fn(); } catch(e) { console.error('renderAll 오류 ['+name+']:', e); } };
  safe(renderDashboard,       'dashboard');
  safe(renderStudentTable,    'students');
  safe(renderApproveList,     'approveList');
  safe(renderApproveGrid,     'approveGrid');
  safe(renderRank,            'rank');
  safe(renderBoardQuestList,  'questList');
  safe(renderAutoDailyStatus, 'autoDailyStatus');
  safe(renderMonsters,        'monsters');
  safe(renderPromotionList,   'promotion');
  safe(loadSettings,          'settings');
  safe(updatePwResetBadge,    'pwBadge');
  safe(updateEmotionAlertBadge,'emotionBadge');
  safe(() => { if (!adminLiveBusy('artwork-pending-list')) renderArtworkPending(); }, 'artPending');
  safe(renderArtworkAdmin,    'artAdmin');
  try {
    const students = DB.getStudents();
    const el = document.getElementById('sb-count');
    if (el) el.textContent = `학생 수: ${students.length}명`;
  } catch(e) {}
}

function updatePwResetBadge() {
  const reqs = DB.getPwResetRequests();
  const badge = document.getElementById('pwreset-badge');
  if (!badge) return;
  if (reqs.length > 0) { badge.textContent = reqs.length; badge.style.display = ''; }
  else badge.style.display = 'none';
}

// ══════════════════════════════════════════════════
//  NAV
// ══════════════════════════════════════════════════
const pages = ['dashboard','students','approve','rank','quests','reward','artwork','books','memories','recorder','weekly','study','monsters','settings','promotion','pwreset','activity','stats','emotion','emotionalerts','villages','thinkboard','learnapps'];
const titles = {thinkboard:'생각판', learnapps:'학습 앱 기록',dashboard:'대시보드',students:'학생 목록',approve:'활동 승인',
  rank:'랭킹',quests:'퀘스트 관리',reward:'보상 지급',artwork:'작품 관리', books:'독서 현황', villages:'우리 마을',
  memories:'추억 관리',
  recorder:'리코더 관리',
  weekly:'주간 다짐', study:'학습 범위',
  monsters:'몬스터',settings:'설정',promotion:'승급 관리',pwreset:'비번 초기화',activity:'활동 내역', stats:'능력치 내역', emotion:'감정 현황', emotionalerts:'감정 대화 요청'};

// [DESLOP-3] 왼쪽 메뉴 그림 — 이모지 대신 같은 굵기(2) 선 그림 한 벌 · 색은 글자색(admin.html 은 .nav-icon[data-i] 자리만 둔다)
const NAV_ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  students: '<path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7.5" r="3.5"/><path d="M22 20v-1.5a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8"/>',
  approve: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12.5 3 3 5-6"/>',
  promotion: '<circle cx="12" cy="12" r="9"/><path d="M12 16.5v-9M8 11l4-4 4 4"/>',
  rank: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  activity: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  emotion: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
  emotionalerts: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  quests: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
  reward: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8.5h14V12M12 8v12.5M12 8S10.5 3.5 8 4.5 9 8 12 8zM12 8s1.5-4.5 4-3.5S15 8 12 8z"/>',
  stats: '<path d="M4 20V11M10 20V5M16 20v-7M2.5 20.5h19"/>',
  artwork: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m21 16-5-5-9 9"/>',
  thinkboard: '<path d="M4 4h16v12H9l-5 4z"/><path d="M8 9h8M8 12.5h5"/>',
  learnapps: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><path d="M17.25 13.5v7.5M13.5 17.25H21"/>',
  villages: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  books: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5zM4 19.5A1.5 1.5 0 0 0 5.5 21H20"/>',
  memories: '<path d="M4 7.5h3l1.8-2.5h6.4L17 7.5h3a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  weekly: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M9 15l2 2 4-4"/>',
  study: '<path d="M2.5 5.5h6A3.5 3.5 0 0 1 12 9v11a2.5 2.5 0 0 0-2.5-2.5h-7zM21.5 5.5h-6A3.5 3.5 0 0 0 12 9v11a2.5 2.5 0 0 1 2.5-2.5h7z"/>',
  recorder: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  monsters: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/>',
  pwreset: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14.5 8.5l2 2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'
};
function fillNavIcons() {
  document.querySelectorAll('.nav-icon[data-i]').forEach(el => {
    const d = NAV_ICONS[el.getAttribute('data-i')];
    if (d) el.innerHTML = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  });
}
fillNavIcons();

// ══ [ADMIN-TPL-1] admin.html 은 정적 HTML 이다 ══════════════════════
//  예전엔 칭호 선택지·스킬 계수 칸·도감 보상 칸·독서 주제 선택지를 HTML 안에 `${...}` JS 템플릿으로 적어 두어
//  (3월 첫 업로드부터) 화면에 글자 그대로 나왔다 — 칭호는 '${t}' 하나, 계수 칸은 id 'bs-nm-${lv}' 하나뿐이라
//  저장하면 battleNum 이 칸을 못 찾아 계수가 기본값으로 덮였고, 도감 보상 칸은 없어서 loadDexSettings 가 깨졌다.
//  이제 여기서 한 번 그린다(admin.js 는 body 끝에서 읽혀 칸 자리가 이미 있다).
const BOOK_CATEGORIES = ['우정', '가족', '용기', '배려', '꿈·성장', '자연·생명'];   // student.js 독서 기록 주제와 같다
const DEX_ZONES = [
  { z: 'beginner',     label: '🌿 초급', n: 30 },
  { z: 'intermediate', label: '🔥 중급', n: 50 },
  { z: 'advanced',     label: '⚡ 고급', n: 20 },
];
function fillStaticTemplates() {
  const titleSel = document.getElementById('rw-title');
  if (titleSel && titleSel.options.length <= 1) {
    (GAME_DATA.titles || []).forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t; titleSel.appendChild(o); });
  }
  const multCell = (pre, lv) => `
              <div class="text-center">
                <div style="font-size:.7rem;color:var(--txt3);margin-bottom:.2rem">Lv${lv}</div>
                <input class="form-input" type="number" id="${pre}-${lv}" step="0.01"
                  style="width:68px;text-align:center;font-size:.8rem">
              </div>`;
  const nmWrap = document.getElementById('bs-nm-wrap');
  if (nmWrap && !nmWrap.children.length) nmWrap.innerHTML = [1, 2, 3, 4, 5, 6, 7].map(lv => multCell('bs-nm', lv)).join('');
  const elWrap = document.getElementById('bs-el-wrap');
  if (elWrap && !elWrap.children.length) elWrap.innerHTML = [0, 1, 2, 3, 4, 5, 6, 7].map(lv => multCell('bs-el', lv)).join('');
  const dexWrap = document.getElementById('dex-zone-wrap');
  if (dexWrap && !dexWrap.children.length) dexWrap.innerHTML = DEX_ZONES.map(({ z, label, n }) => `
            <div style="background:rgba(255,255,255,.03);border-radius:8px;padding:.7rem">
              <div style="font-size:.8rem;font-weight:700;margin-bottom:.5rem">${label} (${n}마리 완성)</div>
              <div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">
                <span class="text-muted-base">달성 골드:</span>
                <input class="form-input w-80" type="number" id="dex-${z}-gold" value="100" min="0">
                <span class="text-muted-base">G</span>
                <span class="text-muted-base">칭호:</span>
                <input class="form-input" id="dex-${z}-title" placeholder="없음" style="width:100px;font-size:.78rem">
              </div>
            </div>`).join('');
  const catSel = document.getElementById('books-cat-filter');
  if (catSel && catSel.options.length <= 1) {
    BOOK_CATEGORIES.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; catSel.appendChild(o); });
  }
}
fillStaticTemplates();

// ══ [NARROW-1] 좁은 화면 메뉴 서랍 ════════════════════════════
//  768px 이하에서만 의미가 있다. 넓은 화면에서는 햄버거 버튼이 CSS 로 숨겨져 있어
//  이 함수들이 호출될 일이 없고, 호출돼도 .is-open 클래스는 넓은 화면 규칙에 영향을 주지 않는다.
//  메뉴 항목은 기존 .nav-item 그대로라 nav(page, el) 을 그대로 쓴다 — 고르면 서랍만 닫는다.
//  body 스크롤 잠금은 넣지 않는다(모달이 아니고, 되돌리는 자리에서 버그가 나기 쉽다).
function _navEls() {
  return {
    sidebar:  document.getElementById('admin-sidebar'),
    backdrop: document.getElementById('nav-backdrop'),
    btn:      document.getElementById('nav-toggle-btn'),
  };
}
function openNav() {
  const { sidebar, backdrop, btn } = _navEls();
  sidebar?.classList.add('is-open');
  backdrop?.classList.add('is-open');
  btn?.setAttribute('aria-expanded', 'true');
}
function closeNav() {
  const { sidebar, backdrop, btn } = _navEls();
  sidebar?.classList.remove('is-open');
  backdrop?.classList.remove('is-open');
  btn?.setAttribute('aria-expanded', 'false');
}
function toggleNav() {
  const { sidebar } = _navEls();
  if (sidebar?.classList.contains('is-open')) closeNav(); else openNav();
}
// 닫는 방법 3가지: 바깥(백드롭) 클릭 · ESC · 메뉴 고르기
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });
document.addEventListener('DOMContentLoaded', () => {
  // 항목 21개에 각각 onclick 을 더하지 않고 사이드바 한 곳에서 위임받는다.
  document.getElementById('admin-sidebar')?.addEventListener('click', e => {
    if (e.target.closest('.nav-item')) closeNav();
  });
});

function nav(page, el) {
  pages.forEach(p => document.getElementById('p-'+p)?.classList.remove('active'));
  document.getElementById('p-'+page)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el?.classList.add('active');
  document.getElementById('topbar-title').textContent = titles[page] || page;
  // 페이지 전환 시 스크롤 최상단으로
  document.querySelector('.main').scrollTop = 0;
  if (page === 'thinkboard') openThinkboardInline();   // [THINKBOARD-2] 관리 화면 안에서
  if (page === 'learnapps')  renderLearnAppsPage();    // [LEARN-APPS-1]
  if (page === 'reward')   populateRewardStudents();
  if (page === 'artwork')  { renderArtworkPending(); renderArtworkAdmin(); }
  if (page === 'books')    renderBooksPage();
  if (page === 'memories') { renderMemoriesPage(); renderBulkRenameList(); }
  if (page === 'recorder') renderRecorderPage();
  if (page === 'weekly')   renderWeeklyAdminPage();
  if (page === 'study')    renderStudyScopePage();
  if (page === 'settings') setTimeout(initAchRecalcSelect, 100);
  if (page === 'pwreset')  renderPwResetList();
  if (page === 'quests')   initQuestPage();
  if (page === 'activity')  renderActivityPage();
  if (page === 'stats')     renderStatsPage();
  if (page === 'promotion') renderPromotionList();
  if (page === 'rank')      renderRank();
  if (page === 'settings')  {
    renderBackupList();
    renderSubjectManage();
    loadEmotionRewardSettings();
    setTimeout(() => switchShopTab('seed', document.getElementById('shop-tab-seed')), 50);
  }
  if (page === 'emotion')        renderEmotionPage();
  if (page === 'emotionalerts')  renderEmotionAlerts();
  if (page === 'villages')       renderVillagesPage();
}

// ══════════════════════════════════════════════════
//  [VILLAGE-ADMIN-1] 우리 마을 — 읽기만
// ══════════════════════════════════════════════════
//  classRPG_villages(루트 밖, village/sync.js 가 쓰는 자리)를 **REST GET 으로만** 읽는다. 쓰기 0.
//  · SDK once('value') 로 통째로 받지 않는다 — 구역 문자열까지 받으면 학생당 최대 약 135KB.
//    대신 ① 목록은 ?shallow=true ② 학생마다 meta(수 KB) · plots?shallow=true(키만) · session 만.
//  · 구경 링크는 아직 두지 않는다. 마을(index.html)이 ?visit= 를 받지 않는다(44·45차 확인).
//    ?sid=<학생> 링크도 두지 않는다 — 교사 기기가 session 주인이 되어 학생 쪽이 구경 모드로 밀려난다.
const VILLAGE_STALE_MS = 90000;   // village/sync.js 의 staleMs 와 같다 — 이 안에 박동이 있으면 "열려 있음"
async function renderVillagesPage() {
  const tbody = document.getElementById('villages-table');
  const sum = document.getElementById('villages-summary');
  const note = document.getElementById('villages-note');
  if (!tbody) return;
  const students = [];
  const seen = new Set();
  (DB.getStudents() || []).forEach(s => { if (s && s.id && !seen.has(s.id)) { seen.add(s.id); students.push(s); } });
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--txt3)">불러오는 중…</td></tr>`;
  sum.textContent = ''; note.textContent = '';

  const base = FIREBASE_CONFIG.databaseURL + '/classRPG_villages';
  const getJSON = async path => { const r = await fetch(base + path); if (!r.ok) throw new Error(r.status); return r.json(); };
  let list;
  try { list = await getJSON('.json?shallow=true') || {}; }
  catch (e) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--red)">마을 목록을 읽지 못했어요 (${escHtml(String(e.message || e))})</td></tr>`; return; }

  const rows = await Promise.all(students.map(async s => {
    if (!list[s.id]) return { s, has: false };
    const enc = encodeURIComponent(s.id);
    try {
      const [meta, plots, session] = await Promise.all([
        getJSON('/' + enc + '/meta.json'), getJSON('/' + enc + '/plots.json?shallow=true'), getJSON('/' + enc + '/session.json')]);
      const houses = meta && meta.houses && typeof meta.houses === 'object' ? Object.values(meta.houses) : [];
      return { s, has: true, plots: plots ? Object.keys(plots).length : 0, houses: houses.length,
               people: houses.reduce((n, h) => n + (Array.isArray(h) ? (h[0] | 0) : 0), 0),
               savedAt: meta && typeof meta.savedAt === 'number' ? meta.savedAt : null,
               open: !!(session && typeof session.at === 'number' && Date.now() - session.at < VILLAGE_STALE_MS) };
    } catch (e) { return { s, has: true, error: String(e.message || e) }; }
  }));

  const fmt = ms => { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const muted = t => `<span style="color:var(--txt3)">${t}</span>`;
  tbody.innerHTML = rows.map(r => {
    const name = escHtml(r.s.name || r.s.id);
    if (!r.has) return `<tr><td>${name}</td><td>${muted('아직 없음')}</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td></tr>`;
    if (r.error) return `<tr><td>${name}</td><td>있음</td><td colspan="5" style="color:var(--red)">읽기 실패 (${escHtml(r.error)})</td></tr>`;
    return `<tr><td>${name}</td><td>있음</td><td>${r.plots}</td><td>${r.houses}</td><td>${r.people}</td>`
         + `<td>${r.savedAt ? fmt(r.savedAt) : muted('-')}</td><td>${r.open ? '🟢 열려 있음' : muted('닫힘')}</td></tr>`;
  }).join('') || `<tr><td colspan="7" style="text-align:center;color:var(--txt3)">학생이 없어요</td></tr>`;

  const n = rows.filter(r => r.has).length;
  const orphan = Object.keys(list).filter(id => !seen.has(id));
  sum.textContent = `${students.length}명 중 ${n}명 저장됨`;
  note.innerHTML = (n === 0 ? '아직 온라인에 저장된 마을이 없어요. 서버 저장이 켜진 뒤부터 쌓여요.<br>' : '')
    + (orphan.length ? `학생 목록에 없는 마을 ${orphan.length}개: ${orphan.map(escHtml).join(', ')}<br>` : '')
    + '마을 구경 링크는 마을 쪽에서 구경 모드(?visit=)를 지원한 뒤 붙입니다.';
}

// ══════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════
function renderDashboard() {
  const students = DB.getStudents();
  const quests   = DB.getQuests();
  const promos   = DB.getPromotionRequests();
  const pwResets = DB.getPwResetRequests();
  // [Q-3C-2] 미승인 보상 전체를 카운트/표시 (활동 승인 탭·nav 뱃지와 동일 기준).
  //          비활성/삭제 퀘스트 pending도 숨기지 않음(Q-1/Q-3D 보존 정책 정합).
  const pendingItems = students.flatMap(s =>
    (s.pendingRewards||[])
      .filter(r => !r.approved) // 승인된 것 제외
      .map(r => ({...r, student:s}))
  );
  const totalPending = pendingItems.length;
  const avgLevel = students.length
    ? (students.reduce((a,s)=>a+s.level,0)/students.length).toFixed(1) : '0';

  // ── [TEACHER-UX-1A] 첫 시작 안내 (표시 전용) ──
  //     기본 placeholder 학생(학생1~6)이 하나라도 남아 있을 때만 노출.
  //     이름을 바꾸면 자동으로 사라짐. 저장/버튼/onclick 없음.
  const startGuideEl = document.getElementById('dash-start-guide');
  if (startGuideEl) {
    const isDefaultClass = students.some(s => /^학생[1-6]$/.test(String(s.name || '').trim()));
    startGuideEl.innerHTML = isDefaultClass ? `
      <div class="dash-guide">
        <div class="dash-guide-title">🚀 처음이신가요?</div>
        <div class="dash-guide-text dash-guide-lead">지금 보이는 학생1~6은 예시예요.</div>
        <div class="dash-guide-text">
          ① 학생 목록에서 이름과 비밀번호를 우리 반 학생에 맞게 바꿔주세요.<br>
          ② 퀘스트 관리 탭에서 퀘스트를 등록하고 자동 일일퀘스트를 켜보세요.<br>
          ③ 설정에서 관리자 비밀번호를 우리 반만 아는 값으로 바꿔주세요.
        </div>
      </div>` : '';
  }

  // ── 요약 스탯 ──
  document.getElementById('stat-row').innerHTML = `
    <div class="stat-card blue" style="cursor:pointer" onclick="nav('students',document.getElementById('nav-students'))">
      <div class="sc-label">전체 학생</div>
      <div class="sc-value blue">${students.length}</div><div class="sc-sub">명</div></div>
    <div class="stat-card ${totalPending>0?'gold':'green'}" style="cursor:pointer" onclick="nav('approve',document.getElementById('nav-approve'))">
      <div class="sc-label">승인 대기</div>
      <div class="sc-value ${totalPending>0?'gold':'green'}">${totalPending}</div>
      <div class="sc-sub">${totalPending>0?'👆 클릭해서 처리':'없음'}</div></div>
    <div class="stat-card ${promos.length>0?'purple':'green'}" style="cursor:pointer" onclick="nav('promotion',document.getElementById('nav-promo'))">
      <div class="sc-label">승급 신청</div>
      <div class="sc-value ${promos.length>0?'purple':'green'}">${promos.length}</div>
      <div class="sc-sub">${promos.length>0?'👆 클릭해서 처리':'없음'}</div></div>
    <div class="stat-card blue">
      <div class="sc-label">평균 레벨</div>
      <div class="sc-value blue">${avgLevel}</div><div class="sc-sub">/ 30</div></div>`;

  // ── 긴급 배너 ──
  const urgentEl = document.getElementById('dash-urgent-banner');
  const urgentList = [];
  if (totalPending > 0) urgentList.push(`<span style="color:var(--gold)">✅ 승인 대기 ${totalPending}건</span>`);
  if (promos.length > 0) urgentList.push(`<span style="color:#c39bd3">⬆️ 승급 신청 ${promos.length}건</span>`);
  if (pwResets.length > 0) urgentList.push(`<span style="color:var(--red)">🔑 비번 초기화 ${pwResets.length}건</span>`);
  if (urgentList.length > 0) {
    urgentEl.style.display = '';
    urgentEl.innerHTML = `<div style="background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.2);
      border-radius:var(--r);padding:.75rem 1.2rem;display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
      <span style="font-size:.78rem;font-weight:700;color:var(--txt2)">📌 처리 필요</span>
      ${urgentList.map(u=>`<span style="font-size:.82rem;font-weight:700">${u}</span>`).join('<span style="color:var(--txt3)">·</span>')}
    </div>`;
  } else {
    urgentEl.style.display = 'none';
  }

  // ── [DASH-EMO-ALERT-1] 감정 대화 요청 배너 ──
  //   사이드 메뉴의 작은 숫자만으로는 놓치기 쉬웠다(대시보드에 없었음). 안 읽은 요청이 있으면 맨 위에 건수 + 바로 가기.
  //   기준은 메뉴 배지(updateEmotionAlertBadge)와 같다: emotionAlerts 중 read 가 아닌 것.
  const emoEl = document.getElementById('dash-emo-banner');
  if (emoEl) {
    const emoUnread = Object.values(DB.load().emotionAlerts || {}).filter(a => a && !a.read).length;
    if (emoUnread > 0) {
      emoEl.style.display = '';
      emoEl.innerHTML = `<div style="background:rgba(93,173,226,.08);border:1px solid rgba(93,173,226,.3);
        border-radius:var(--r);padding:.75rem 1.2rem;display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
        <span style="font-size:.82rem;font-weight:700;color:var(--sky)">🔔 감정 대화 요청 ${emoUnread}건</span>
        <span style="font-size:.76rem;color:var(--txt2)">선생님과 이야기하고 싶다고 한 학생이 있어요</span>
        <button class="btn-sm outline" style="margin-left:auto" onclick="nav('emotionalerts',document.getElementById('nav-emotionalerts'))">보러 가기</button>
      </div>`;
    } else {
      emoEl.style.display = 'none';
      emoEl.innerHTML = '';
    }
  }

  // ── 오늘 처리할 것 (보상 대기 전체) ──
  // [PANEL-1B] 표시 전용 안내: 이 목록은 닫힌/삭제된 퀘스트 보상도 포함될 수 있음.
  //            상세 분류(⚠️ 확인 필요 보상)는 renderApproveList(활동 승인 탭)에서 처리.
  const dashPendingNote = `
    <div style="padding:.5rem 1.2rem;font-size:.72rem;color:var(--txt3);line-height:1.5;
      border-bottom:1px solid rgba(255,255,255,.04)">
      닫힌/삭제된 퀘스트 보상도 포함될 수 있어요. 자세한 분류는 활동 승인 탭에서 확인할 수 있어요.
    </div>`;
  document.getElementById('dash-pending').innerHTML = pendingItems.length > 0
    ? dashPendingNote + pendingItems.map(item => `
      <div style="display:flex;align-items:flex-start;gap:.8rem;padding:.65rem 1.2rem;
        border-bottom:1px solid rgba(255,255,255,.04);transition:background .15s"
        onmouseover="this.style.background='rgba(255,255,255,.02)'"
        onmouseout="this.style.background=''">
        <div style="font-size:1.15rem;width:32px;text-align:center;padding-top:.1rem">${item.student.avatar}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.84rem;font-weight:700">${escHtml(item.student.name)}
            <span style="font-weight:400;color:var(--txt2)">· ${escHtml(item.label)}</span>
            ${item.type==='book'?`<span style="font-size:.68rem;background:rgba(93,173,226,.12);color:var(--sky);
              border-radius:8px;padding:.05rem .4rem;margin-left:.3rem">📚 독서</span>`:''}
          ${item.type==='artwork'?`<span style="font-size:.68rem;background:rgba(155,89,182,.12);color:var(--purple);
              border-radius:8px;padding:.05rem .4rem;margin-left:.3rem">🎨 작품</span>`:''}
          </div>
          <div style="font-size:.7rem;color:var(--txt3);margin-top:.1rem">
            +${item.exp}EXP${item.stat?' · '+GAME_DATA.statNames[item.stat]+' +'+(item.statVal||1):''}
            ${item.bookDate?' · '+item.bookDate:''}
          </div>
          ${item.bookReview?`<div style="font-size:.72rem;color:var(--txt2);margin-top:.3rem;
            padding:.35rem .55rem;background:rgba(255,255,255,.04);border-radius:8px;
            border-left:2px solid rgba(93,173,226,.3);line-height:1.5">
            ${escHtml(item.bookReview.length>80?item.bookReview.slice(0,80)+'...':item.bookReview)}</div>`:''}
        </div>
        <div style="display:flex;gap:.4rem;flex-shrink:0;padding-top:.1rem">
          <button class="btn-sm success" style="font-size:.72rem;padding:.3rem .7rem"
            onclick="approveSingleDash('${item.student.id}','${item.id}',this)">✅ 승인</button>
          <button class="btn-sm danger" style="font-size:.72rem;padding:.3rem .6rem"
            onclick="rejectSingleDash('${item.student.id}','${item.id}',this)">✕</button>
        </div>
      </div>`).join('')
    : `<div style="padding:1.4rem 1.2rem;font-size:.82rem;color:var(--txt3);text-align:center">
        🎉 처리할 보상이 없어요!</div>`;

  // ── 승급 대기 ──
  const promoWrap = document.getElementById('dash-promo-wrap');
  if (promos.length > 0) {
    promoWrap.style.display = '';
    document.getElementById('dash-promo-list').innerHTML = promos.map(r => {
      const s = DB.getStudent(r.studentId);
      if (!s) return '';
      // [PROMO-LV] 승급 요청에는 level 하나만 들어 있다(student.js requestPromotion:
      //   {id, studentId, studentName, level, date}). currentLevel·targetLevel 은
      //   저장하는 곳이 없어 "Lv.undefined → undefined" 로 찍히고 있었다.
      //   신청 구조는 건드리지 않는다 — 이미 저장된 요청도 그대로 보여야 한다.
      //   level 이 없는 옛 요청은 학생의 현재 레벨로 대신한다.
      const lv = (r.level != null) ? r.level : s.level;
      return `<div style="display:flex;align-items:center;gap:.8rem;padding:.65rem 1.2rem;
        border-bottom:1px solid rgba(255,255,255,.04)">
        <div style="font-size:1.1rem">${s.avatar}</div>
        <div class="flex-1">
          <div style="font-size:.84rem;font-weight:700">${escHtml(s.name)}
            <span style="background:rgba(142,68,173,.2);color:#c39bd3;font-size:.68rem;
              padding:.1rem .4rem;border-radius:10px;margin-left:.4rem">
              ${lv != null ? `Lv.${lv} ` : ''}승급
            </span>
          </div>
          <div style="font-size:.7rem;color:var(--txt3);margin-top:.1rem">${r.date||''}</div>
        </div>
        <div style="display:flex;gap:.4rem;flex-shrink:0">
          <button class="btn-sm success" style="font-size:.72rem;padding:.3rem .7rem"
            onclick="approvePromoDash('${r.id}',this)">✅ 승급</button>
          <button class="btn-sm danger" style="font-size:.72rem;padding:.3rem .6rem"
            onclick="rejectPromoDash('${r.id}',this)">✕</button>
        </div>
      </div>`;
    }).join('');
  } else {
    promoWrap.style.display = 'none';
  }

  // ── 비번 초기화 요청 ──
  const pwWrap = document.getElementById('dash-pwreset-wrap');
  if (pwResets.length > 0) {
    pwWrap.style.display = '';
    document.getElementById('dash-pwreset-list').innerHTML = pwResets.map(r => {
      const s = DB.getStudent(r.studentId);
      if (!s) return '';
      return `<div style="display:flex;align-items:center;gap:.8rem;padding:.65rem 1.2rem;
        border-bottom:1px solid rgba(255,255,255,.04)">
        <div style="font-size:1.1rem">${s.avatar}</div>
        <div class="flex-1">
          <div style="font-size:.84rem;font-weight:700">${escHtml(s.name)}</div>
          <div style="font-size:.7rem;color:var(--txt3);margin-top:.1rem">${r.date||''} 요청</div>
        </div>
        <div style="display:flex;gap:.4rem;flex-shrink:0">
          <button class="btn-sm success" style="font-size:.72rem;padding:.3rem .7rem"
            onclick="approvePwResetDash('${r.id}','${r.studentId}',this)">✅ 초기화</button>
          <button class="btn-sm danger" style="font-size:.72rem;padding:.3rem .6rem"
            onclick="rejectPwResetDash('${r.id}',this)">✕</button>
        </div>
      </div>`;
    }).join('');
  } else {
    pwWrap.style.display = 'none';
  }

  // ── 레벨 현황 ──
  //   [DASH-SORT-COPY-1] 사본을 정렬한다 — students 는 DB 캐시 배열 자체라, 제자리 정렬하면 그 뒤 학생 목록·승인 격자·선택 상자가 레벨순으로 뒤섞였다
  document.getElementById('dash-level-list').innerHTML = [...students]
    .sort((a,b) => b.level - a.level)
    .map(s => {
      const pct = Math.min(100,
        ((s.exp - Utils.expForLevel(s.level)) /
         (Utils.expForNextLevel(s.level) - Utils.expForLevel(s.level))) * 100);
      return `<div style="display:flex;align-items:center;gap:.8rem;padding:.5rem 1rem;">
        <div style="font-size:1.1rem;width:28px;text-align:center">${s.avatar}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.82rem;font-weight:600;margin-bottom:.25rem">${escHtml(s.name)}</div>
          <div style="height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden">
            <div class="dash-lv-fill" style="width:${pct}%"></div>
          </div>
        </div>
        <div style="font-size:.78rem;color:var(--accent);font-weight:700;white-space:nowrap">Lv.${s.level}</div>
      </div>`;
    }).join('');

  // ── 최근 활동 ──
  const allQuests = DB.getQuests().slice(-10).reverse();
  document.getElementById('dash-activity').innerHTML = allQuests.length > 0
    ? allQuests.map(q => {
        const s = DB.getStudent(q.studentId);
        return `<div style="display:flex;align-items:center;gap:.6rem;padding:.45rem 1rem;
          border-bottom:1px solid rgba(255,255,255,.03)">
          <span style="font-size:.95rem">${escHtml(q.icon||'📋')}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:.78rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${escHtml(s?.name||'?')} · ${escHtml(q.name)}</div>
            <div class="text-muted-xs">${q.date||''}</div>
          </div>
          <span class="tag ${q.approved?'approved':'pending'}">${q.approved?'승인':'대기'}</span>
        </div>`;
      }).join('')
    : '<div style="padding:1rem;font-size:.78rem;color:var(--txt3)">아직 표시할 활동 기록이 없어요.</div>';
}

// ── [ADMIN-SPLIT-1] 여기 있던 'students' 덩어리(526줄)는 admin/students.js 로 옮겼다 — 글자 그대로 ──
// ── [ADMIN-SPLIT-1] 여기 있던 'approve' 덩어리(831줄)는 admin/approve.js 로 옮겼다 — 글자 그대로 ──
// ── [ADMIN-SPLIT-1] 여기 있던 'records' 덩어리(466줄)는 admin/records.js 로 옮겼다 — 글자 그대로 ──
// ── [ADMIN-SPLIT-1] 여기 있던 'works' 덩어리(596줄)는 admin/works.js 로 옮겼다 — 글자 그대로 ──
// ── [ADMIN-SPLIT-1] 여기 있던 'memories' 덩어리(896줄)는 admin/memories.js 로 옮겼다 — 글자 그대로 ──
// ── [ADMIN-SPLIT-1] 여기 있던 'quests' 덩어리(928줄)는 admin/quests.js 로 옮겼다 — 글자 그대로 ──
// ── [ADMIN-SPLIT-1] 여기 있던 'battle' 덩어리(579줄)는 admin/battle.js 로 옮겼다 — 글자 그대로 ──
// ── [ADMIN-SPLIT-1] 여기 있던 'settings' 덩어리(913줄)는 admin/settings.js 로 옮겼다 — 글자 그대로 ──
// ══════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════
function closeModal() {
  document.getElementById('m-student').classList.remove('open');
}
document.getElementById('m-student').addEventListener('click', e => {
  if (e.target === document.getElementById('m-student')) closeModal();
});

function notify(msg, type) {
  const wrap = document.getElementById('notif-wrap');
  const item = document.createElement('div');
  item.className = 'notif-item' + (type === 'error' ? ' error' : type === 'gold' ? ' gold' : '');
  item.textContent = msg;
  wrap.appendChild(item);
  setTimeout(() => item.remove(), 2900);
}

// [ER-2] DB 저장 실패 시 교사에게 안내 (gamedata의 _onSaveError 훅)
window.onDbSaveError = () => notify('⚠️ 저장에 실패했어요. 인터넷 연결을 확인하고 다시 시도해주세요.', 'error');


// ── [ADMIN-SPLIT-1] 여기 있던 'study' 덩어리(236줄)는 admin/study.js 로 옮겼다 — 글자 그대로 ──
