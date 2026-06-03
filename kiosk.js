// ── Firebase ──
// FIREBASE_CONFIG는 gamedata.js에서 선언됨

let DB_DATA = null;
let CUR_TAB = 'daily';
let fbRef = null;
let _cancelCb = null;

// ── 초기화 ──
window.onload = async () => {
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  fbRef = firebase.database().ref('classRPG_v3');

  try {
    const snap = await fbRef.once('value');
    DB_DATA = normalizeData(snap.val());
    if (!DB_DATA) { alert('데이터가 없습니다. 관리자에서 먼저 설정해주세요.'); return; }

    // 실시간 동기화 — 디바운스로 연속 업데이트 묶어서 처리
    let _renderTimer = null;
    fbRef.on('value', snap => {
      DB_DATA = normalizeData(snap.val());
      if (_renderTimer) clearTimeout(_renderTimer);
      _renderTimer = setTimeout(() => {
        if (KIOSK_TAB === 'emotion') renderEmotionBoard();
        else if (KIOSK_TAB === 'memory') renderKioskMemory();
        else renderTable();
      }, 400);
    });

    document.getElementById('loading').style.display = 'none';
    const mainWrap = document.getElementById('main-wrap');
    mainWrap.style.display = 'flex';

    // 오늘 날짜
    const now = new Date();
    document.getElementById('today-date').textContent =
      now.getFullYear()+'년 '+(now.getMonth()+1)+'월 '+now.getDate()+'일 ('+['일','월','화','수','목','금','토'][now.getDay()]+'요일)';

    // 학급명
    const className = (DB_DATA.settings||{}).className || '우리반';
    document.getElementById('class-name').textContent = className;

    renderTable();

  } catch(e) {
    alert('서버 연결 실패: ' + e.message);
  }
};

function normalizeData(data) {
  if (!data) return null;
  // student/admin과 동일한 공유 정규화 기준 사용 (gamedata.js의 순수 함수 직접 호출)
  // → 신규 필드 추가 시 kiosk만 누락되는 위험 제거. DB._normalizeArrays/_migrate는 전달 data만 처리.
  return DB._migrate(DB._normalizeArrays(data));
}

// ── 탭 전환 ──
// ── 테이블 렌더 ──
function renderTable() {
  if (!DB_DATA) return;
  const students  = DB_DATA.students || [];
  const allQuests = DB_DATA.quests || [];
  const el = document.getElementById('kiosk-content');

  const today = new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  const weekStart = (() => {
    const d=new Date(Date.now()+9*3600000);
    const day=d.getUTCDay();
    const sun=new Date(d);
    sun.setUTCDate(d.getUTCDate()-day);
    return sun.toISOString().slice(0,10);
  })();

  const allActive = (DB_DATA.boardQuests||[]).filter(q => q.active!==false);
  const activeBQIds = new Set(allActive.map(q=>q.id));

  function getStatus(studentId, questId, questType) {
    const s = students.find(x=>x.id===studentId);
    if (!s) return 'none';
    if (!activeBQIds.has(questId)) return 'none';
    const done = allQuests.filter(Boolean).some(q => {
      if (!q || q.studentId!==studentId || q.boardQuestId!==questId) return false;
      if (!q.date) return true;
      if (questType==='daily')  return q.date===today;
      if (questType==='weekly') return q.date>=weekStart;
      return true;
    });
    if (done) return 'done';
    if ((s.pendingRewards||[]).some(r => r && r.boardQuestId===questId && r.approved===true)) return 'done';
    if ((s.pendingRewards||[]).some(r => r && r.boardQuestId===questId && !r.approved)) return 'pending';
    return 'none';
  }

  // 스탯 아이콘/색상 정의
  const STAT_BADGE = {
    read:   { icon:'📚', label:'독서',  color:'rgba(52,152,219,.25)',  border:'rgba(52,152,219,.5)'  },
    study:  { icon:'✏️', label:'학습',  color:'rgba(155,89,182,.2)',   border:'rgba(155,89,182,.5)'  },
    art:    { icon:'🎨', label:'예술',  color:'rgba(230,126,34,.2)',   border:'rgba(230,126,34,.5)'  },
    value:  { icon:'💎', label:'가치',  color:'rgba(241,196,15,.2)',   border:'rgba(241,196,15,.5)'  },
    health: { icon:'💪', label:'건강',  color:'rgba(231,76,60,.2)',    border:'rgba(231,76,60,.5)'   },
    life:   { icon:'🏠', label:'생활',  color:'rgba(46,204,113,.2)',   border:'rgba(46,204,113,.5)'  },
  };

  function statBadge(stat, statVal) {
    if (!stat || !STAT_BADGE[stat]) return '';
    const b = STAT_BADGE[stat];
    return `<span style="font-size:.62rem;padding:.1rem .4rem;border-radius:6px;
      background:${b.color};border:1px solid ${b.border};color:#fff;font-weight:700;white-space:nowrap">
      ${b.icon} ${b.label} +${statVal||1}
    </span>`;
  }

  // 섹션 정의
  const sections = [
    { type:'daily',   label:'📋 일일 퀘스트', color:'rgba(74,144,226,.15)',  border:'rgba(74,144,226,.3)' },
    { type:'weekly',  label:'📅 주간 퀘스트', color:'rgba(46,204,113,.12)',  border:'rgba(46,204,113,.3)' },
    { type:'special', label:'✏️ 과제',        color:'rgba(255,215,0,.1)',    border:'rgba(255,215,0,.3)'  },
    { type:'event',   label:'⭐ 특별 퀘스트', color:'rgba(155,89,182,.12)', border:'rgba(155,89,182,.3)' },
  ];

  let totalHtml = '';
  let hasAny = false;

  sections.forEach(sec => {
    const quests = allActive.filter(q => q.type === sec.type);
    if (quests.length === 0) return;
    hasAny = true;

    // 일일/주간 퀘스트는 스탯별로 서브섹션 분리
    if (sec.type === 'daily' || sec.type === 'weekly') {
      // 스탯별 그룹핑
      const statGroups = {};
      const noStat = [];
      quests.forEach(q => {
        if (q.stat && STAT_BADGE[q.stat]) {
          if (!statGroups[q.stat]) statGroups[q.stat] = [];
          statGroups[q.stat].push(q);
        } else {
          noStat.push(q);
        }
      });

      // 섹션 헤더
      totalHtml += `<div style="font-size:.9rem;font-weight:900;color:var(--gold);
        padding:.5rem .8rem;margin-top:.6rem;background:${sec.color};
        border-left:3px solid ${sec.border};border-radius:0 8px 8px 0;">
        ${sec.label}
      </div>`;

      // 하나의 table로 합치기 - 그룹 구분은 tr 헤더 행으로
      totalHtml += `<table id="kiosk-table" style="margin-bottom:.3rem">
        <thead><tr>
          <th class="quest-th">할 일</th>
          ${students.map(s=>`<th style="font-size:.8rem">
            <div style="font-size:1.2rem">${s.avatar}</div>
            <div style="font-size:.72rem;margin-top:2px">${s.name}</div>
          </th>`).join('')}
        </tr></thead><tbody>`;

      const addQuestRows = (questList) => {
        questList.forEach(q => {
          totalHtml += `<tr><td class="quest-name">
            <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
              ${q.icon||'📋'} ${q.name}
              ${statBadge(q.stat, q.statVal)}
            </div>
            <div class="quest-reward">+${q.exp}EXP · +${q.gold}G</div>
            ${(()=>{
              const info=getDeadlineInfo(q);
              if(!info) return '';
              const color=info.urgent==='expired'?'#999':info.urgent==='critical'?'#ff4444':info.urgent==='warning'?'#ffaa00':'var(--txt2)';
              const prefix=info.urgent==='critical'?'🔴 ':info.urgent==='warning'?'🟡 ':'⏰ ';
              const suffix=info.urgent==='critical'?' — 곧 마감!':info.urgent==='warning'?' — 임박!':'';
              return `<div style="font-size:.66rem;color:${color};margin-top:.15rem;font-weight:${info.urgent?'700':'400'}">${prefix}${info.deadline}까지${suffix}</div>`;
            })()}
          </td>`;
          students.forEach(s => {
            const status = getStatus(s.id, q.id, q.type);
            if (status === 'done') {
              totalHtml += `<td><div class="cell-btn done">✓<span style="font-size:.6rem">완료</span></div></td>`;
            } else if (status === 'pending') {
              totalHtml += `<td><div class="cell-btn pending" onclick="requestCancel('${s.id}','${q.id}','${s.name}','${q.name}')">
                ⏳<span style="font-size:.55rem">신청중</span></div></td>`;
            } else {
              totalHtml += `<td><div class="cell-btn" onclick="requestQuest('${s.id}','${q.id}',this)">
                <span style="font-size:1rem">○</span></div></td>`;
            }
          });
          totalHtml += '</tr>';
        });
      };

      // 스탯별 그룹 헤더 행 + 퀘스트 행
      Object.entries(statGroups).forEach(([stat, qs]) => {
        const b = STAT_BADGE[stat];
        totalHtml += `<tr><td colspan="${students.length+1}"
          style="padding:.3rem .7rem;background:${b.color};border-left:2px solid ${b.border};
            font-size:.72rem;font-weight:700;color:#fff">
          ${b.icon} ${b.label} 퀘스트
        </td></tr>`;
        addQuestRows(qs);
      });

      if (noStat.length > 0) {
        totalHtml += `<tr><td colspan="${students.length+1}"
          style="padding:.3rem .7rem;background:rgba(255,255,255,.05);
            font-size:.72rem;font-weight:700;color:var(--txt2)">
          📋 기타
        </td></tr>`;
        addQuestRows(noStat);
      }

      totalHtml += '</tbody></table>';
      return;
    }

    // 일반 섹션 (과제/특별) - 기존 방식 유지
    totalHtml += `
      <div style="font-size:.9rem;font-weight:900;color:var(--gold);
        padding:.5rem .8rem;margin-top:.6rem;background:${sec.color};
        border-left:3px solid ${sec.border};border-radius:0 8px 8px 0;">
        ${sec.label}
      </div>`;

    totalHtml += `<table id="kiosk-table" style="margin-bottom:.3rem">
      <thead><tr>
        <th class="quest-th">할 일</th>
        ${students.map(s=>`<th style="font-size:.8rem">
          <div style="font-size:1.2rem">${s.avatar}</div>
          <div style="font-size:.72rem;margin-top:2px">${s.name}</div>
        </th>`).join('')}
      </tr></thead>
      <tbody>`;

    quests.forEach(q => {
      totalHtml += `<tr>
        <td class="quest-name">
          <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
            ${q.icon||'📋'} ${q.name}
            ${statBadge(q.stat, q.statVal)}
          </div>
          <div class="quest-reward">+${q.exp}EXP · +${q.gold}G</div>
          ${(()=>{
            const info=getDeadlineInfo(q);
            if(!info) return '';
            const color = info.urgent==='expired'?'#999':info.urgent==='critical'?'#ff4444':info.urgent==='warning'?'#ffaa00':'var(--txt2)';
            const prefix = info.urgent==='critical'?'🔴 ':info.urgent==='warning'?'🟡 ':'⏰ ';
            const suffix = info.urgent==='critical'?' — 곧 마감!':info.urgent==='warning'?' — 임박!':'';
            return `<div style="font-size:.66rem;color:${color};margin-top:.15rem;font-weight:${info.urgent?'700':'400'}">${prefix}${info.deadline}까지${suffix}</div>`;
          })()}
        </td>`;

      students.forEach(s => {
        const status = getStatus(s.id, q.id, q.type);
        if (status === 'done') {
          totalHtml += `<td><div class="cell-btn done">✓<span style="font-size:.6rem">완료</span></div></td>`;
        } else if (status === 'pending') {
          totalHtml += `<td><div class="cell-btn pending" onclick="requestCancel('${s.id}','${q.id}','${s.name}','${q.name}')">
            ⏳<span style="font-size:.55rem">신청중</span>
          </div></td>`;
        } else {
          totalHtml += `<td><div class="cell-btn" onclick="requestQuest('${s.id}','${q.id}',this)">
            <span style="font-size:1rem">○</span>
          </div></td>`;
        }
      });
      totalHtml += '</tr>';
    });

    totalHtml += '</tbody></table>';
  });

  if (!hasAny) {
    el.innerHTML = `<div id="empty-msg">
      <div style="font-size:3rem">📭</div>
      <div style="font-size:1rem;font-weight:700">등록된 퀘스트가 없어요</div>
      <div style="font-size:.82rem">선생님이 퀘스트를 올리면 여기에 표시됩니다</div>
    </div>`;
    return;
  }

  el.innerHTML = totalHtml;
}

// ── 탭 전환 ──
let KIOSK_TAB = 'quest';
function switchKioskTab(tab) {
  KIOSK_TAB = tab;
  const isQuest  = tab === 'quest';
  const isEmotion= tab === 'emotion';
  const isMemory = tab === 'memory';

  const qBtn = document.getElementById('kiosk-tab-quest');
  const eBtn = document.getElementById('kiosk-tab-emotion');
  const mBtn = document.getElementById('kiosk-tab-memory');
  [qBtn, eBtn, mBtn].forEach(b => { if(b){ b.style.background='transparent'; b.style.color='var(--txt2)'; b.style.border='1.5px solid rgba(255,255,255,.25)'; }});
  const activeBtn = isQuest?qBtn : isEmotion?eBtn : mBtn;
  if (activeBtn) { activeBtn.style.background='var(--gold)'; activeBtn.style.color='#1a1a1a'; activeBtn.style.border='none'; }

  document.getElementById('table-wrap').style.display         = isQuest  ? '' : 'none';
  document.getElementById('kiosk-emotion-wrap').style.display = isEmotion ? '' : 'none';
  document.getElementById('kiosk-memory-wrap').style.display  = isMemory  ? '' : 'none';

  if (isEmotion) renderEmotionBoard();
  if (isMemory)  renderKioskMemory();
}

// ── 키오스크 추억 앨범 ──
let _kioskMemView = 'all'; // 'all' | monthKey
let _kioskMemLbIdx = 0;
let _kioskMemList = [];

function renderKioskMemory() {
  const el = document.getElementById('kiosk-memory-content');
  if (!el || !DB_DATA) return;

  const all = (DB_DATA.memories || []).filter(m =>
    m.approvalStatus === 'approved' &&
    (m.visibilityType === 'public' || m.visibilityType === 'class')
  );
  all.sort((a,b) => (b.createdAt||0)-(a.createdAt||0));
  _kioskMemList = all;

  // 앨범 목록 수집
  const albums = DB_DATA.memoryAlbums || [];
  albums.sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  // 현재 뷰 필터
  let filtered;
  if (_kioskMemView === 'all') {
    filtered = all;
  } else if (_kioskMemView === 'none') {
    filtered = all.filter(m=>!m.albumId);
  } else {
    filtered = all.filter(m=>m.albumId===_kioskMemView);
  }

  el.innerHTML = `
    <div style="font-size:.9rem;font-weight:900;color:var(--gold);padding:.4rem .2rem .5rem;
      border-bottom:2px solid rgba(255,215,0,.2);margin-bottom:.7rem">
      📸 우리 반 추억 앨범
    </div>

    <!-- 앨범 탭 -->
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.9rem">
      <button onclick="setKioskMemView('all')"
        style="font-size:.78rem;padding:.35rem .9rem;border-radius:20px;cursor:pointer;
          font-family:inherit;font-weight:700;border:2px solid transparent;
          background:${_kioskMemView==='all'?'var(--gold)':'rgba(255,255,255,.1)'};
          color:${_kioskMemView==='all'?'#1a1a1a':'var(--txt1)'}">
        📷 전체 (${all.length})</button>
      ${albums.map(a => {
        const cnt = all.filter(m=>m.albumId===a.id).length;
        return `<button onclick="setKioskMemView('${a.id}')"
          style="font-size:.78rem;padding:.35rem .9rem;border-radius:20px;cursor:pointer;
            font-family:inherit;font-weight:700;border:2px solid transparent;
            background:${_kioskMemView===a.id?'var(--gold)':'rgba(255,255,255,.1)'};
            color:${_kioskMemView===a.id?'#1a1a1a':'var(--txt1)'}">
          📁 ${a.name} (${cnt})</button>`;
      }).join('')}
      ${all.filter(m=>!m.albumId).length>0 ? `
      <button onclick="setKioskMemView('none')"
        style="font-size:.78rem;padding:.35rem .9rem;border-radius:20px;cursor:pointer;
          font-family:inherit;font-weight:700;border:2px solid transparent;
          background:${_kioskMemView==='none'?'var(--gold)':'rgba(255,255,255,.1)'};
          color:${_kioskMemView==='none'?'#1a1a1a':'var(--txt1)'}">
        기타 (${all.filter(m=>!m.albumId).length})</button>` : ''}
    </div>

    ${filtered.length === 0
      ? `<div style="text-align:center;padding:3rem;color:var(--txt3)">아직 추억 사진이 없어요 📸</div>`
      : `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.8rem">
          ${filtered.map((m,i) => `
            <div onclick="openKioskMemLightbox(${i},${JSON.stringify(_kioskMemView).replace(/"/g,"'")})"
              style="cursor:pointer;border-radius:12px;overflow:hidden;
                background:rgba(255,255,255,.05);aspect-ratio:1;position:relative;transition:transform .2s"
              onmouseenter="this.style.transform='scale(1.03)'"
              onmouseleave="this.style.transform='scale(1)'">
              <img src="${m.thumbUrl||m.imageUrl}" loading="lazy"
                style="width:100%;height:100%;object-fit:cover;display:block">
              <div style="position:absolute;bottom:0;left:0;right:0;padding:.3rem .5rem;
                background:linear-gradient(transparent,rgba(0,0,0,.7));font-size:.65rem;color:#fff;
                overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.title||''}</div>
            </div>`).join('')}
        </div>`}`;

  // 라이트박스용 목록 업데이트
  window._kioskLbFiltered = filtered;

  if (!document.getElementById('kiosk-lb')) {
    const lb = document.createElement('div');
    lb.id = 'kiosk-lb';
    lb.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;flex-direction:column;align-items:center;justify-content:center;cursor:pointer';
    lb.innerHTML = `
      <button onclick="document.getElementById('kiosk-lb').style.display='none'"
        style="position:absolute;top:1.2rem;right:1.5rem;background:rgba(255,255,255,.15);border:none;
          color:#fff;font-size:1.8rem;cursor:pointer;border-radius:8px;width:44px;height:44px">✕</button>
      <a id="kiosk-lb-download" href="" download target="_blank" title="다운로드"
        style="position:absolute;top:1.2rem;right:4.5rem;background:rgba(255,255,255,.15);border:none;
          color:#fff;font-size:1.1rem;border-radius:8px;width:44px;height:44px;
          display:flex;align-items:center;justify-content:center;text-decoration:none">⬇️</a>
      <img id="kiosk-lb-img" style="max-width:90vw;max-height:72vh;border-radius:14px;object-fit:contain">
      <div id="kiosk-lb-cap" style="color:#fff;font-size:.88rem;margin-top:.8rem;text-align:center;max-width:80vw;line-height:1.5"></div>
      <div id="kiosk-lb-counter" style="color:rgba(255,255,255,.4);font-size:.72rem;margin-top:.2rem"></div>
      <div style="display:flex;gap:1.2rem;margin-top:.8rem">
        <button onclick="navKioskLb(-1);event.stopPropagation()"
          style="background:rgba(255,255,255,.15);border:none;color:#fff;font-size:1.6rem;
            padding:.4rem 1.1rem;border-radius:10px;cursor:pointer">‹</button>
        <button onclick="navKioskLb(1);event.stopPropagation()"
          style="background:rgba(255,255,255,.15);border:none;color:#fff;font-size:1.6rem;
            padding:.4rem 1.1rem;border-radius:10px;cursor:pointer">›</button>
      </div>`;
    document.body.appendChild(lb);
  }
}

function setKioskMemView(v) {
  _kioskMemView = v;
  renderKioskMemory();
}

function openKioskMemLightbox(idx) {
  const filtered = window._kioskLbFiltered || _kioskMemList;
  _kioskMemLbIdx = idx;
  const m = filtered[idx]; if (!m) return;
  const lb = document.getElementById('kiosk-lb'); if (!lb) return;
  lb.style.display = 'flex';
  document.getElementById('kiosk-lb-img').src = m.imageUrl || m.thumbUrl;
  document.getElementById('kiosk-lb-cap').textContent =
    (m.title||'') + (m.albumName?' ['+m.albumName+']':'') + (m.date?' · '+m.date:'');
  const counter = document.getElementById('kiosk-lb-counter');
  if (counter) counter.textContent = `${idx+1} / ${filtered.length}`;
  const dlBtn = document.getElementById('kiosk-lb-download');
  if (dlBtn) dlBtn.href = m.imageUrl || m.thumbUrl;
  lb.onclick = e => { if(e.target===lb) lb.style.display='none'; };
}

function navKioskLb(dir) {
  const filtered = window._kioskLbFiltered || _kioskMemList;
  _kioskMemLbIdx = (_kioskMemLbIdx + dir + filtered.length) % filtered.length;
  openKioskMemLightbox(_kioskMemLbIdx);
}

// ── 감정 체크판 ──
let _kioskEmoStep = null; // { studentId, period }

function renderEmotionBoard() {
  const el = document.getElementById('kiosk-emotion-content');
  if (!el || !DB_DATA) return;
  const students = DB_DATA.students || [];
  const today = new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  const emoLogs = DB_DATA.emotionLogs || {};

  // 오늘 특정 학생/시간대 감정 조회
  function getEmo(studentId, period) {
    return emoLogs[`${studentId}_${today}_${period}`] || null;
  }

  el.innerHTML = `
    <div style="font-size:.9rem;font-weight:900;color:var(--gold);padding:.4rem .2rem .6rem;
      border-bottom:2px solid rgba(255,215,0,.2);margin-bottom:.6rem">
      💭 오늘의 감정 현황
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="padding:.5rem;font-size:.8rem;background:var(--bg2);border:1px solid var(--border);text-align:left">학생</th>
        <th style="padding:.5rem;font-size:.8rem;background:var(--bg2);border:1px solid var(--border);text-align:center">🌅 오전</th>
        <th style="padding:.5rem;font-size:.8rem;background:var(--bg2);border:1px solid var(--border);text-align:center">🌇 오후</th>
      </tr></thead>
      <tbody>
        ${students.map(s => {
          const am = getEmo(s.id, 'am');
          const pm = getEmo(s.id, 'pm');
          return `<tr>
            <td style="padding:.6rem;border:1px solid var(--border);font-size:.88rem;font-weight:700">
              ${s.avatar} ${s.name}
            </td>
            <td style="padding:.4rem;border:1px solid var(--border);text-align:center">
              ${am
                ? `<div style="font-size:1.4rem">${am.emotionIcon}</div>
                   <div style="font-size:.68rem;color:var(--txt2)">${am.emotionLabel}</div>
                   <div style="font-size:.6rem;color:var(--txt3)">${am.levelLabel}</div>
                   <button onclick="openKioskEmotion('${s.id}','am')"
                     style="font-size:.6rem;background:none;border:1px solid rgba(255,255,255,.15);
                     color:var(--txt3);border-radius:6px;padding:.1rem .4rem;cursor:pointer;margin-top:.2rem">수정</button>`
                : `<button onclick="openKioskEmotion('${s.id}','am')"
                     style="width:100%;padding:.6rem;background:rgba(255,255,255,.04);
                     border:1.5px dashed rgba(255,255,255,.2);border-radius:10px;
                     color:var(--txt3);cursor:pointer;font-size:.82rem">입력</button>`}
            </td>
            <td style="padding:.4rem;border:1px solid var(--border);text-align:center">
              ${pm
                ? `<div style="font-size:1.4rem">${pm.emotionIcon}</div>
                   <div style="font-size:.68rem;color:var(--txt2)">${pm.emotionLabel}</div>
                   <div style="font-size:.6rem;color:var(--txt3)">${pm.levelLabel}</div>
                   <button onclick="openKioskEmotion('${s.id}','pm')"
                     style="font-size:.6rem;background:none;border:1px solid rgba(255,255,255,.15);
                     color:var(--txt3);border-radius:6px;padding:.1rem .4rem;cursor:pointer;margin-top:.2rem">수정</button>`
                : `<button onclick="openKioskEmotion('${s.id}','pm')"
                     style="width:100%;padding:.6rem;background:rgba(255,255,255,.04);
                     border:1.5px dashed rgba(255,255,255,.2);border-radius:10px;
                     color:var(--txt3);cursor:pointer;font-size:.82rem">입력</button>`}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

// ── 키오스크 감정 입력 팝업 ──
let _kEmoStudentId = null, _kEmoPeriod = null;
let _kEmoKey = null, _kEmoLevel = null;

function openKioskEmotion(studentId, period) {
  _kEmoStudentId = studentId; _kEmoPeriod = period;
  _kEmoKey = null; _kEmoLevel = null;

  const today = new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  const existing = (DB_DATA?.emotionLogs || {})[`${studentId}_${today}_${period}`] || null;
  const s = (DB_DATA.students||[]).find(x=>x.id===studentId);
  const label = period==='am'?'🌅 오전':'🌇 오후';

  let pop = document.getElementById('kiosk-emo-popup');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'kiosk-emo-popup';
    pop.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center';
    document.body.appendChild(pop);
  }

  pop.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:20px;
      padding:1.2rem;width:90%;max-width:460px;max-height:90vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.8rem">
        <div style="font-weight:700">${s?.avatar} ${s?.name} · ${label}</div>
        <button onclick="document.getElementById('kiosk-emo-popup').style.display='none'"
          style="background:none;border:none;color:var(--txt2);font-size:1.2rem;cursor:pointer">✕</button>
      </div>
      <!-- 감정 그리드 -->
      <div id="k-emo-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:.4rem;margin-bottom:.8rem">
        ${EMOTION_DATA.map(e => `
          <button onclick="kSelectEmotion('${e.key}')"
            id="ke-${e.key}"
            style="display:flex;flex-direction:column;align-items:center;gap:2px;
              padding:.5rem .2rem;border-radius:10px;cursor:pointer;font-family:inherit;
              border:1.5px solid ${existing?.emotionKey===e.key?'var(--gold)':'rgba(255,255,255,.1)'};
              background:${existing?.emotionKey===e.key?'rgba(255,215,0,.12)':'rgba(255,255,255,.04)'}">
            <span style="font-size:1.3rem">${e.icon}</span>
            <span style="font-size:.58rem;color:var(--txt2)">${e.label}</span>
          </button>`).join('')}
      </div>
      <!-- 강도 -->
      <div id="k-emo-level-wrap" style="display:none;margin-bottom:.8rem">
        <div style="font-size:.8rem;color:var(--txt2);margin-bottom:.4rem">얼마나 그런가요?</div>
        <div style="display:flex;gap:.5rem">
          ${[1,2,3].map(v=>`<button id="k-elv-${v}" onclick="kSelectLevel(${v})"
            style="flex:1;padding:.5rem;border-radius:10px;cursor:pointer;font-family:inherit;
              border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.04);
              color:var(--txt);font-size:.85rem">${['조금','보통','많이'][v-1]}</button>`).join('')}
        </div>
      </div>
      <!-- 이유 -->
      <div id="k-emo-reason-wrap" style="display:none">
        <input id="k-emo-reason" placeholder="이유 (선택사항)"
          style="width:100%;padding:.6rem .8rem;border-radius:10px;
            background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);
            color:var(--txt);font-size:.85rem;font-family:inherit;margin-bottom:.5rem">
        <div style="display:flex;gap:.5rem">
          <button onclick="kSubmitEmotion('')"
            style="flex:1;padding:.55rem;border-radius:10px;cursor:pointer;font-family:inherit;
              border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:var(--txt)">없음</button>
          <button id="k-emo-submit" onclick="kSubmitEmotion(document.getElementById('k-emo-reason').value)"
            style="flex:2;padding:.55rem;border-radius:10px;cursor:pointer;font-family:inherit;
              background:var(--gold);color:#1a1a1a;border:none;font-weight:700" disabled>저장</button>
        </div>
      </div>
    </div>`;
  pop.style.display = 'flex';
}

function kSelectEmotion(key) {
  _kEmoKey = key;
  // 선택 표시
  EMOTION_DATA.forEach(e => {
    const btn = document.getElementById('ke-'+e.key);
    if (!btn) return;
    btn.style.border = e.key===key ? '1.5px solid var(--gold)' : '1.5px solid rgba(255,255,255,.1)';
    btn.style.background = e.key===key ? 'rgba(255,215,0,.12)' : 'rgba(255,255,255,.04)';
  });
  document.getElementById('k-emo-level-wrap').style.display  = '';
  document.getElementById('k-emo-reason-wrap').style.display = 'none';
  _kEmoLevel = null;
  [1,2,3].forEach(v => {
    const b = document.getElementById('k-elv-'+v);
    if (b) { b.style.background='rgba(255,255,255,.04)'; b.style.borderColor='rgba(255,255,255,.15)'; }
  });
}

function kSelectLevel(level) {
  _kEmoLevel = level;
  [1,2,3].forEach(v => {
    const b = document.getElementById('k-elv-'+v);
    if (!b) return;
    b.style.background   = v===level ? 'var(--gold)' : 'rgba(255,255,255,.04)';
    b.style.color        = v===level ? '#1a1a1a'     : 'var(--txt)';
    b.style.borderColor  = v===level ? 'var(--gold)' : 'rgba(255,255,255,.15)';
  });
  document.getElementById('k-emo-reason-wrap').style.display = '';
  document.getElementById('k-emo-submit').disabled = false;
}

function kSubmitEmotion(reason) {
  if (!_kEmoKey || !_kEmoLevel) { return; }
  const today = new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  const e = EMOTION_DATA.find(x => x.key === _kEmoKey);
  const key = `${_kEmoStudentId}_${today}_${_kEmoPeriod}`;
  const record = {
    id: key, studentId: _kEmoStudentId, date: today, period: _kEmoPeriod,
    emotionKey: _kEmoKey, emotionLabel: e.label, emotionIcon: e.icon, group: e.group,
    level: _kEmoLevel, levelLabel: ['조금','보통','많이'][_kEmoLevel-1],
    score: EMOTION_GROUP_VALUE[e.group] * _kEmoLevel,
    reason: reason.trim() || '없음', updatedAt: Date.now(),
  };
  fbRef.child('emotionLogs/' + key).set(record);
  document.getElementById('kiosk-emo-popup').style.display = 'none';
  renderEmotionBoard();
}

// ── 퀘스트 신청 ──
function requestQuest(studentId, questId, btn) {
  // 1. UI 레벨 연타 방지 (즉시 잠금)
  if (btn?.dataset.requesting === '1') return;
  if (btn) btn.dataset.requesting = '1';

  const data = DB_DATA;
  const s = data.students.find(x=>x.id===studentId);
  const q = (data.boardQuests||[]).find(x=>x.id===questId);
  if (!s || !q) { if (btn) delete btn.dataset.requesting; return; }

  // 2. 완료/신청중 판정 — student·admin과 동일한 Utils.questStatus(일요일 주 시작) 기준으로 통일
  //    'done'(완료 또는 승인됨) 또는 'pending'(신청중)이면 중복이므로 차단
  const qStatus = Utils.questStatus(studentId, questId, q.type, DB_DATA.quests, s.pendingRewards, null);
  if (qStatus !== 'none') {
    if (btn) delete btn.dataset.requesting; // 중복이면 잠금 해제
    return;
  }

  s.pendingRewards = s.pendingRewards || [];
  s.pendingRewards.push({
    id: 'pr_'+Date.now()+'_'+studentId,
    boardQuestId: questId,
    boardQuestType: q.type||'special',
    label: q.name,
    exp: q.exp, gold: q.gold,
    stat: q.stat||'', statVal: q.stat?1:0,
    icon: q.icon||'📋',
    date: Utils.todayStr(),
  });

  // Firebase 저장 — pendingRewards 경로만 부분 저장 (학생 exp/gold 등 다른 필드 클로버 방지)
  // 저장 성공 후에만 완료 토스트 — 실패 시 실패 안내 + 버튼 잠금 복구
  fbRef.child('students/'+s.id+'/pendingRewards').set(s.pendingRewards)
    .then(() => { showToast(`✅ ${s.name} · ${q.name} 신청 완료!`); })
    .catch(() => { if (btn) delete btn.dataset.requesting; showToast(`⚠️ ${s.name} 신청 저장 실패 — 다시 시도해주세요`); });
}

// ── 신청 취소 확인 팝업 ──
function requestCancel(studentId, questId, studentName, questName) {
  document.getElementById('cancel-popup-sub').textContent =
    `${studentName} · ${questName}`;
  _cancelCb = () => cancelQuest(studentId, questId);
  document.getElementById('cancel-confirm-btn').onclick = () => {
    _cancelCb && _cancelCb();
    closeCancelPopup();
  };
  document.getElementById('cancel-popup').style.display = 'flex';
}

function closeCancelPopup() {
  document.getElementById('cancel-popup').style.display = 'none';
  _cancelCb = null;
}

function cancelQuest(studentId, questId) {
  const data = DB_DATA;
  const s = data.students.find(x=>x.id===studentId);
  if (!s) return;
  s.pendingRewards = (s.pendingRewards||[]).filter(r=>r.boardQuestId!==questId);
  const canIdx = DB_DATA.students.findIndex(x=>x.id===studentId);
  if (canIdx >= 0) {
    // pendingRewards 경로만 부분 저장 — 저장 성공 후에만 취소 완료 토스트
    fbRef.child('students/'+s.id+'/pendingRewards').set(s.pendingRewards)
      .then(() => { showToast('↩️ 신청이 취소됐어요'); })
      .catch(() => { showToast('⚠️ 취소 저장 실패 — 다시 시도해주세요'); });
  }
}


// ── 마감일 계산 + 임박 여부 ──
function getDeadlineInfo(quest) {
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  const fmt = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());

  let deadline = null;
  let deadlineTime = null;

  if (quest.type === 'daily') {
    // 오늘 오후 4시 (방과후)
    deadlineTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0, 0);
    deadline = fmt(now) + ' 방과후';
  } else if (quest.type === 'weekly') {
    const day = now.getDay();
    const diff = day <= 5 ? 5 - day : 6;
    const fri = new Date(now);
    fri.setDate(now.getDate() + diff);
    deadlineTime = new Date(fri.getFullYear(), fri.getMonth(), fri.getDate(), 16, 0, 0);
    deadline = fmt(fri) + ' 방과후';
  } else if (quest.dueDate) {
    deadline = quest.dueDate;
    deadlineTime = new Date(quest.dueDate + 'T16:00:00');
  }

  if (!deadline) return null;

  const diffMs = deadlineTime ? deadlineTime - now : null;
  const diffHr = diffMs ? diffMs / 3600000 : null;

  let urgent = null;
  if (diffHr !== null) {
    if (diffHr < 0)       urgent = 'expired';   // 마감 지남
    else if (diffHr < 1)  urgent = 'critical';  // 1시간 미만
    else if (diffHr < 3)  urgent = 'warning';   // 3시간 미만
  }

  return { deadline, urgent, diffHr };
}

// 구버전 호환
function getDeadline(quest) {
  const info = getDeadlineInfo(quest);
  return info ? info.deadline : null;
}
// ── 토스트 ──
let _toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.style.display='none'; }, 2000);
}
