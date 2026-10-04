// admin/records.js — 랭킹(공용 빌더) · 능력치 내역 · 활동 내역(일일퀘스트 주간/월간 기록) · renderRank
//  admin.js 에서 떼어 옮긴 클래식 스크립트 [ADMIN-SPLIT-1] — 글자 그대로 · 전역 그대로 · admin.html 에서 admin.js 바로 뒤에 부른다.
// ── [ADMIN-SPLIT-1] 'records' — 원래 admin.js 1953~2418줄 ──
// ══════════════════════════════════════════════════
//  RANK
// ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════
//  공용 랭킹 빌더 (관리자/학생 공통 사용)
// ══════════════════════════════════════════════════
function buildRankingHTML(students) {
  const medals = ['🥇','🥈','🥉'];
  const categories = [
    { label:'레벨',   key: s => s.level||0,            fmt: (s,v) => `Lv.${v}` },
    { label:'퀘스트', key: s => s.totalQuests||0,       fmt: (s,v) => `${v}개` },
    { label:'독서',   key: s => s.bookCount||0,         fmt: (s,v) => `${v}권` },
  ];

  const rows = categories.map(cat => {
    const top3 = students.slice().sort((a,b) => cat.key(b)-cat.key(a)).slice(0,3);
    const items = top3.map((s,i) => {
      const val = cat.key(s);
      return `<div style="display:flex;align-items:center;gap:.5rem;padding:.5rem .8rem;
        background:rgba(255,255,255,.04);border-radius:10px;flex:1;min-width:0">
        <span style="font-size:1.3rem;flex-shrink:0">${medals[i]}</span>
        <span style="font-size:1.1rem;flex-shrink:0">${s.avatar||''}</span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(s.name)}</div>
          <div style="font-size:.75rem;color:var(--gold);font-weight:700">${cat.fmt(s,val)}</div>
        </div>
      </div>`;
    }).join('');
    return `<div class="mb-08">
      <div style="font-size:.72rem;color:var(--txt3);font-weight:700;margin-bottom:.4rem;padding-left:.2rem">${cat.label}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem">${items}</div>
    </div>`;
  }).join('');

  return `<div style="background:rgba(255,255,255,.04);border-radius:16px;padding:1rem">
    <div style="font-size:1rem;font-weight:900;margin-bottom:.8rem">🏆 우리반 랭킹</div>
    ${rows}
  </div>`;
}

// ══════════════════════════════════════════════════
//  STATS (능력치 내역)
// ══════════════════════════════════════════════════
function renderStatsPage() {
  const db       = DB.load();
  const students = DB.getStudents();
  const el       = document.getElementById('stats-page-body');
  if (!el) return;

  // 학생 셀렉트 초기화
  const sel = document.getElementById('sp-student');
  if (sel && sel.options.length === 1) {
    students.forEach(s => {
      const o = document.createElement('option');
      o.value = s.id; o.textContent = s.avatar + ' ' + s.name;
      sel.appendChild(o);
    });
  }

  const stuId = sel?.value || '';
  if (!stuId) {
    el.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--txt3);font-size:.85rem">학생을 선택해주세요</div>';
    return;
  }

  const s = students.find(x => x.id === stuId);
  if (!s) return;

  // boardQuests 맵 (stat 참조용)
  const bqStatMap = {};
  (db.boardQuests||[]).forEach(q => { if (q && q.stat) bqStatMap[q.id] = q.stat; });

  // questLogs - stat 없으면 boardQuest에서 가져오기
  const questLogs = (db.quests || [])
    .filter(q => q && q.studentId === stuId)
    .map(q => ({
      ...q,
      stat: q.stat || (q.boardQuestId ? bqStatMap[q.boardQuestId] : '') || ''
    }))
    .filter(q => q.stat); // stat 있는 것만

  // pendingRewards 중 stat 있는 것
  const pendingLogs = (s.pendingRewards||[])
    .filter(r => r && r.stat)
    .map(r => ({ name: r.label||r.name||'', stat: r.stat, statVal: r.statVal||1, date: r.date||'' }));

  const logs = [...questLogs, ...pendingLogs]
    .filter((v,i,a) => a.findIndex(x => x.name===v.name && x.date===v.date && x.stat===v.stat) === i);

  const statDefs = [
    { key:'read',   label:'📚 독서',  color:'#e67e22' },
    { key:'study',  label:'✏️ 학습',  color:'var(--sky)' },
    { key:'art',    label:'🎨 예술',  color:'#9b59b6' },
    { key:'value',  label:'💎 가치',  color:'var(--gold)' },
    { key:'health', label:'💪 건강',  color:'var(--emerald)' },
    // [B8] 생활(life)이 빠져 있어 🏠생활 퀘스트 기록이 이 화면에서 통째로 안 보였다
    { key:'life',   label:'🏠 생활',  color:'#5dade2' },
  ];

  const statCards = statDefs.map(def => {
    const entries = logs.filter(q => q.stat === def.key)
      .sort((a,b) => (b.date||'').localeCompare(a.date||''));
    const total = s.stats?.[def.key] || 0;

    // 기록은 없지만 스탯은 있는 경우 → "기록 확인 불가" 표시
    if (entries.length === 0 && total === 0) return '';

    const rows = entries.map(q => `
      <tr style="border-bottom:1px solid rgba(255,255,255,.04)">
        <td style="padding:.4rem .8rem;font-size:.75rem;color:var(--txt3);white-space:nowrap">${q.date||''}</td>
        <td style="padding:.4rem .8rem;font-size:.82rem;font-weight:600">${escHtml(q.name||'')}</td>
        <td style="padding:.4rem .8rem;text-align:center;font-size:.75rem;color:${def.color};font-weight:700">+${q.statVal||1}</td>
      </tr>`).join('');

    return `<div class="table-card mb-1">
      <div class="tc-header">
        <div class="tc-title" style="color:${def.color}">${def.label}</div>
        <div style="font-size:.8rem;color:var(--txt2)">현재 <strong style="color:${def.color}">${total}</strong>점 · ${entries.length}건</div>
      </div>
      ${entries.length === 0
        ? `<div style="padding:.8rem 1.2rem;font-size:.8rem;color:var(--txt3)">
            현재 <strong style="color:${def.color}">${total}점</strong> 보유 · 상세 기록은 오늘 이후 퀘스트부터 기록됩니다
           </div>`
        : `<table style="width:100%;border-collapse:collapse">
            <thead><tr style="background:var(--bg3)">
              <th style="padding:.4rem .8rem;text-align:left;font-size:.75rem;color:var(--txt3);width:100px">날짜</th>
              <th style="padding:.4rem .8rem;text-align:left;font-size:.75rem;color:var(--txt3)">퀘스트명</th>
              <th style="padding:.4rem .8rem;text-align:center;font-size:.75rem;color:var(--txt3);width:60px">획득</th>
            </tr></thead>
            <tbody>${rows}</tbody>
           </table>`}
    </div>`;
  }).join('');

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:.8rem;padding:.75rem 1rem;
      background:rgba(255,255,255,.04);border-radius:12px;margin-bottom:1rem">
      <span style="font-size:2rem">${s.avatar}</span>
      <div>
        <div style="font-weight:700">${escHtml(s.name)} <span style="font-size:.76rem;color:var(--txt3)">Lv.${s.level}</span></div>
        <div style="font-size:.75rem;color:var(--txt2);margin-top:.15rem">
          📚${s.stats?.read||0} ✏️${s.stats?.study||0} 🎨${s.stats?.art||0} 💎${s.stats?.value||0} 💪${s.stats?.health||0} 🏠${s.stats?.life||0}
        </div>
      </div>
    </div>
    ${statCards || '<div style="padding:1rem;color:var(--txt3);font-size:.83rem">능력치 획득 기록이 없어요</div>'}`;
}

// ══════════════════════════════════════════════════
//  ACTIVITY (활동 내역)
// ══════════════════════════════════════════════════
// ── 일일퀘스트 주간/월간 기록 ─────────────────────────
let _dqView = 'week';
// [RPG-ADMIN-UX-2B] 일일퀘스트 기록 상세 펼침 상태 (표시 전용·저장 안 함, 재렌더 시 기본 접힘)
let _dqExpandAll = false;

function setDqExpandAll(v) {
  _dqExpandAll = !!v;
  renderDqSummary();
}

// [RPG-ADMIN-UX-3B] 기간 블록 전체 펼침 상태 (표시 전용·저장 안 함, 기본=최근 기간만 펼침)
let _dqPeriodExpandAll = false;

function setDqPeriodExpandAll(v) {
  _dqPeriodExpandAll = !!v;
  renderDqSummary();
}

function setDqView(v, btn) {
  _dqView = v;
  document.querySelectorAll('#dq-view-week,#dq-view-month').forEach(b => {
    b.style.background = 'rgba(255,255,255,.07)'; b.style.color = 'var(--txt2)'; b.className = 'btn-sm outline';
  });
  btn.style.background = 'var(--gold)'; btn.style.color = '#1a1a1a'; btn.className = 'btn-sm';
  renderDqSummary();
}

function renderDqSummary() {
  const wrap = document.getElementById('dq-summary-wrap');
  if (!wrap) return;
  const db = DB.load();
  const students = DB.getStudents();

  // 학생 필터 셀렉트 초기화
  const stuSel = document.getElementById('dq-stu-filter');
  if (stuSel && stuSel.options.length === 1) {
    students.forEach(s => {
      const o = document.createElement('option');
      o.value = s.id; o.textContent = s.avatar + ' ' + s.name;
      stuSel.appendChild(o);
    });
  }
  const stuFilter = stuSel?.value || 'all';

  const allBq = db.boardQuests || [];
  const dailyBq = allBq.filter(q => q.type === 'daily' && q.date);
  const logs = Object.values(db.questLogs || {})
    .filter(q => q && (q.type === 'daily' || q.boardQuestType === 'daily') && q.studentId && q.date);

  const filteredStudents = stuFilter === 'all' ? students : students.filter(s=>s.id===stuFilter);

  function getWeekKey(dateStr) {
    const d = new Date(dateStr); d.setHours(12);
    const day = d.getDay();
    const mon = new Date(d); mon.setDate(d.getDate()-(day===0?6:day-1));
    return mon.toISOString().slice(0,10);
  }
  const keyFn = _dqView==='week' ? getWeekKey : (d=>d.slice(0,7));

  // 기간별 + 퀘스트명별 → 올라온 날짜 Set
  // questDateMap[period][questName] = Set of dates
  const questDateMap = {};
  dailyBq.forEach(q => {
    const k = keyFn(q.date);
    if (!questDateMap[k]) questDateMap[k] = {};
    if (!questDateMap[k][q.name]) questDateMap[k][q.name] = new Set();
    questDateMap[k][q.name].add(q.date);
  });

  // 기간별 + 학생별 + 퀘스트명별 → 완료한 날짜 Set
  // logDateMap[period][studentId][questName] = Set of dates
  const logDateMap = {};
  logs.forEach(l => {
    const k = keyFn(l.date);
    if (!logDateMap[k]) logDateMap[k] = {};
    if (!logDateMap[k][l.studentId]) logDateMap[k][l.studentId] = {};
    if (!logDateMap[k][l.studentId][l.name]) logDateMap[k][l.studentId][l.name] = new Set();
    logDateMap[k][l.studentId][l.name].add(l.date);
  });

  const periods = Object.keys({...questDateMap,...logDateMap}).sort().reverse().slice(0,12);

  if (periods.length === 0) {
    wrap.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--txt3)">일일퀘스트 기록이 없어요</div>';
    return;
  }

  const periodLabel = k => {
    if (_dqView==='month') { const [y,m]=k.split('-'); return y+'년 '+parseInt(m)+'월'; }
    const end = new Date(k); end.setDate(end.getDate()+6);
    return k.slice(5)+'~'+end.toISOString().slice(5,10);
  };

  // [RPG-ADMIN-UX-2B] 상단 전체 펼치기/접기 (표시 전용)
  const dqToolbar = `
    <div style="display:flex;gap:.4rem;justify-content:flex-end;flex-wrap:wrap;padding:.2rem .8rem .1rem">
      <button class="btn-sm outline" style="font-size:.72rem" onclick="setDqPeriodExpandAll(true)">기간 전체 펼치기</button>
      <button class="btn-sm outline" style="font-size:.72rem" onclick="setDqPeriodExpandAll(false)">기간 전체 접기</button>
      <button class="btn-sm outline" style="font-size:.72rem" onclick="setDqExpandAll(true)">학생 상세 전체 펼치기</button>
      <button class="btn-sm outline" style="font-size:.72rem" onclick="setDqExpandAll(false)">학생 상세 전체 접기</button>
    </div>`;

  wrap.innerHTML = dqToolbar + periods.map((k, pIdx) => {
    const questMap = questDateMap[k] || {};          // questName → Set<dates>
    const questNames = Object.keys(questMap);
    const logMap    = logDateMap[k] || {};            // studentId → questName → Set<dates>

    // [RPG-ADMIN-UX-3B] 기간 헤더 요약 + 기본 접힘(최근 기간만 펼침). 기존 집계식 재사용, 변경 없음.
    const periodAvail  = questNames.reduce((a,n)=>(a+(questMap[n]?.size||0)), 0);
    const studentCount = filteredStudents.length;
    let periodDoneSum = 0;
    filteredStudents.forEach(s => {
      const sl = logMap[s.id] || {};
      periodDoneSum += questNames.reduce((a,n)=>(a+(sl[n]?.size||0)), 0);
    });
    const periodPct  = (periodAvail>0 && studentCount>0) ? Math.round(periodDoneSum/(periodAvail*studentCount)*100) : 0;
    const periodOpen = (pIdx === 0) || _dqPeriodExpandAll;

    return `
    <div class="dq-period" style="margin:.4rem 1rem .6rem;border-radius:10px;border:1px solid rgba(255,255,255,.08);overflow:hidden">
      <div class="dq-period-head" style="background:rgba(255,255,255,.05);padding:.45rem .8rem;font-size:.75rem;
        font-weight:700;color:var(--gold);border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;gap:.5rem">
        <span style="flex:1">📋 ${periodLabel(k)}
          <span style="font-weight:400;color:var(--txt3);font-size:.68rem;margin-left:.4rem">퀘스트 ${questNames.length}종 · 학생 ${studentCount}명 · 평균 ${periodPct}%</span>
        </span>
        <button class="btn-sm outline" style="font-size:.66rem;padding:.1rem .4rem;white-space:nowrap"
          onclick="var b=this.closest('.dq-period').querySelector('.dq-period-body');var open=b.style.display!=='none';b.style.display=open?'none':'block';this.textContent=open?'펼치기':'접기'">${periodOpen?'접기':'펼치기'}</button>
      </div>
      <div class="dq-period-body" style="display:${periodOpen?'block':'none'}">
      <!-- 퀘스트 이름 + 올라온 날수 -->
      <div style="padding:.45rem .8rem;display:flex;flex-wrap:wrap;gap:.3rem;border-bottom:1px solid rgba(255,255,255,.06)">
        ${questNames.map((n,i)=>`<span style="font-size:.68rem;padding:.15rem .5rem;border-radius:8px;
          background:rgba(255,255,255,.07);color:var(--txt2)">
          <b style="color:var(--gold)">${i+1}</b> ${n}
          <span style="color:var(--txt3)">(${questMap[n].size}일)</span></span>`).join('')}
      </div>
      <!-- 학생별: 퀘스트별 n/m일 -->
      <div style="padding:.35rem 0">
        ${filteredStudents.map(s => {
          const stuLog = logMap[s.id] || {};
          // 전체 완료일수 / 전체 가능일수
          const totalAvail = questNames.reduce((a,n)=>(a+(questMap[n]?.size||0)), 0);
          const totalDone  = questNames.reduce((a,n)=>(a+(stuLog[n]?.size||0)), 0);
          const allDone = totalDone === totalAvail && totalAvail > 0;
          const color = allDone?'var(--emerald)':totalDone>0?'var(--gold)':'var(--txt3)';
          // [RPG-ADMIN-UX-2B] 요약줄 보조 정보 (기존 totalDone/totalAvail 재사용, 집계 변경 없음)
          const undone = Math.max(0, totalAvail - totalDone);
          const pct    = totalAvail > 0 ? Math.round(totalDone/totalAvail*100) : 0;
          return `<div class="dq-stu" style="border-bottom:1px solid rgba(255,255,255,.04);padding:.4rem .8rem">
            <div style="display:flex;align-items:center;gap:.5rem">
              <span>${s.avatar}</span>
              <span style="font-size:.82rem;font-weight:700;flex:1">${escHtml(s.name)}</span>
              <span style="font-size:.7rem;color:var(--txt3)">미완료 ${undone}일 · ${pct}%</span>
              <span style="font-size:.73rem;font-weight:700;color:${color};min-width:48px;text-align:right">${totalDone}/${totalAvail}일</span>
              <button class="btn-sm outline" style="font-size:.66rem;padding:.1rem .4rem;white-space:nowrap"
                onclick="var d=this.closest('.dq-stu').querySelector('.dq-detail');var open=d.style.display!=='none';d.style.display=open?'none':'flex';this.textContent=open?'자세히':'접기'">${_dqExpandAll?'접기':'자세히'}</button>
            </div>
            <div class="dq-detail" style="flex-direction:column;gap:.1rem;padding-left:1.6rem;margin-top:.3rem;display:${_dqExpandAll?'flex':'none'}">
              ${questNames.map(n => {
                const avail = questMap[n]?.size || 0;
                const done  = stuLog[n]?.size  || 0;
                const c = done===avail&&avail>0?'var(--emerald)':done>0?'var(--gold)':'rgba(255,255,255,.2)';
                return `<div style="font-size:.7rem;display:flex;align-items:center;gap:.4rem">
                  <span style="min-width:32px;font-weight:700;color:${c}">${done}/${avail}일</span>
                  <span style="color:${done>0?'var(--txt2)':'var(--txt3)'}">${n}</span>
                </div>`;
              }).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
      </div>
    </div>`;
  }).join('');
}


function renderActivityPage() {
  renderDqSummary();
  const db       = DB.load();
  const students = DB.getStudents();

  // 학생 필터 셀렉트 초기화
  const stuSel = document.getElementById('act-student');
  if (stuSel && stuSel.options.length === 1) {
    students.forEach(s => {
      const o = document.createElement('option');
      o.value = s.id; o.textContent = s.avatar + ' ' + s.name;
      stuSel.appendChild(o);
    });
  }

  const stuFilter  = stuSel?.value || 'all';
  const typeFilter = document.getElementById('act-type')?.value || 'all';
  const dateFrom   = document.getElementById('act-date-from')?.value || '';
  const dateTo     = document.getElementById('act-date-to')?.value || '';

  // questLogs 전체 수집
  const logs = Object.values(db.questLogs || {})
    .filter(q => q && q.studentId && q.date)
    .sort((a, b) => (b.date||'').localeCompare(a.date||''));

  // boardQuests 맵 (id → quest)
  const bqMap = {};
  (db.boardQuests||[]).forEach(q => { bqMap[q.id] = q; });

  // 필터 적용
  const filtered = logs.filter(log => {
    if (stuFilter !== 'all' && log.studentId !== stuFilter) return false;
    const isQuest = log.boardQuestId != null;
    if (typeFilter === 'quest'  && !isQuest) return false;
    if (typeFilter === 'other'  && isQuest)  return false;
    if (dateFrom && log.date < dateFrom) return false;
    if (dateTo   && log.date > dateTo)   return false;
    return true;
  });

  const el = document.getElementById('activity-table-wrap');
  if (!el) return;

  if (filtered.length === 0) {
    el.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--txt3);font-size:.85rem">활동 내역이 없어요</div>';
    return;
  }

  const typeLabel = { daily:'일일', weekly:'주간', special:'과제', event:'특별', attendance:'출석', quest:'퀘스트', book:'독서', artwork:'작품' };
  const typeColor = { daily:'var(--emerald)', weekly:'var(--sky)', special:'var(--gold)', event:'var(--purple)', attendance:'var(--txt2)', book:'#e67e22', artwork:'#e91e8c' };

  el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:.82rem">
    <thead>
      <tr style="background:var(--bg3);position:sticky;top:0">
        <th style="padding:.55rem .8rem;text-align:left;border-bottom:1px solid var(--border2);white-space:nowrap">날짜</th>
        <th style="padding:.55rem .8rem;text-align:left;border-bottom:1px solid var(--border2);white-space:nowrap">학생</th>
        <th style="padding:.55rem .8rem;text-align:left;border-bottom:1px solid var(--border2);white-space:nowrap">유형</th>
        <th style="padding:.55rem .8rem;text-align:left;border-bottom:1px solid var(--border2)">활동명</th>
        <th style="padding:.55rem .8rem;text-align:center;border-bottom:1px solid var(--border2);white-space:nowrap">EXP</th>
        <th style="padding:.55rem .8rem;text-align:center;border-bottom:1px solid var(--border2);white-space:nowrap">골드</th>
        <th style="padding:.55rem .8rem;text-align:center;border-bottom:1px solid var(--border2);white-space:nowrap">복사</th>
      </tr>
    </thead>
    <tbody>
      ${filtered.map((log, i) => {
        const s    = students.find(x => x.id === log.studentId);
        const bq   = log.boardQuestId ? bqMap[log.boardQuestId] : null;
        const qtype = bq?.type || log.type || 'quest';
        const isQuest = log.boardQuestId != null;
        const label = typeLabel[qtype] || qtype;
        const color = typeColor[qtype] || 'var(--txt2)';
        const rowBg = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)';
        return `<tr style="background:${rowBg};border-bottom:1px solid rgba(255,255,255,.04)">
          <td style="padding:.45rem .8rem;white-space:nowrap;color:var(--txt2)">${log.date||''}</td>
          <td style="padding:.45rem .8rem;white-space:nowrap">${s ? s.avatar+' '+escHtml(s.name) : escHtml(log.studentId)}</td>
          <td style="padding:.45rem .8rem">
            <span style="font-size:.72rem;padding:.15rem .45rem;border-radius:8px;
              background:rgba(255,255,255,.06);color:${color};font-weight:700;white-space:nowrap">
              ${isQuest ? '📋 퀘스트' : '🎯 '+label}
            </span>
          </td>
          <td style="padding:.45rem .8rem;max-width:240px">
            <div style="font-weight:600">${escHtml(log.name||'')}</div>
            ${bq ? `<div style="font-size:.7rem;color:var(--txt3);margin-top:.1rem">${label} · 게시일 ${bq.date||''}</div>` : ''}
          </td>
          <td style="padding:.45rem .8rem;text-align:center;color:var(--emerald);font-weight:700">+${log.exp||0}</td>
          <td style="padding:.45rem .8rem;text-align:center;color:var(--gold);font-weight:700">+${log.gold||0}G</td>
          <td style="padding:.45rem .8rem;text-align:center">
            ${log.type==='artwork' ? '<span style="font-size:1.1rem" title="작품">🎨</span>'
            : log.type==='book'    ? '<span style="font-size:1.1rem" title="독서">📚</span>'
            : log.name ? `<button onclick="copyToQuestForm('${escJsAttr(log.name||'')}');this.textContent='✅';setTimeout(()=>this.textContent='📋',1500)"
              style="background:none;border:1px solid rgba(255,255,255,.15);border-radius:6px;
              color:var(--txt3);cursor:pointer;font-size:.75rem;padding:.2rem .45rem"
              title="복사 + 직접입력에 붙여넣기">📋</button>` : ''}
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  <div style="padding:.6rem 1rem;font-size:.75rem;color:var(--txt3);border-top:1px solid var(--border2)">
    총 ${filtered.length}건
  </div>`;
}

function clearActivityFilter() {
  document.getElementById('act-student').value  = 'all';
  document.getElementById('act-type').value     = 'all';
  document.getElementById('act-date-from').value = '';
  document.getElementById('act-date-to').value   = '';
  renderActivityPage();
}

function copyToQuestForm(text) {
  // 클립보드 복사
  navigator.clipboard?.writeText(text).catch(() => {
    const t = document.createElement('textarea');
    t.value = text; document.body.appendChild(t);
    t.select(); document.execCommand('copy');
    document.body.removeChild(t);
  });
  // 퀘스트 페이지로 이동 후 직접입력 탭 열고 이름 채우기
  nav('quests', document.querySelector('[onclick*="\'quests\'"]'));
  setTimeout(() => {
    switchQuestTab('custom'); // nav 이후 실행해야 탭 초기화 안 됨
    setTimeout(() => {
      const inp = document.getElementById('nq-name');
      if (inp) { inp.value = text; inp.focus(); }
    }, 50);
  }, 100);
  notify(`📋 "${text}" → 직접입력 탭에 붙여넣기 완료!`);
}

function renderRank() {
  const students = DB.getStudents();
  const el = document.getElementById('admin-ranking-wrap');
  if (el) el.innerHTML = buildRankingHTML(students);
}

