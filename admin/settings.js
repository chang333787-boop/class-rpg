// admin/settings.js — 상점 관리(+감정 보상 설정) · 과목 관리(+감정 대화 요청) · 감정 현황(차트) · 백업·되돌리기 · 설정(오늘의 링크·저장·초기화·내보내기)
//  admin.js 에서 떼어 옮긴 클래식 스크립트 [ADMIN-SPLIT-1] — 글자 그대로 · 전역 그대로 · admin.html 에서 admin.js 바로 뒤에 부른다.
// ── [ADMIN-SPLIT-1] 'settings' — 원래 admin.js 5418~6330줄 ──
// ══════════════════════════════════════════════════
//  SHOP MANAGEMENT
// ══════════════════════════════════════════════════
let CUR_SHOP_TAB = 'seed';

function switchShopTab(tab, btn) {
  CUR_SHOP_TAB = tab;
  ['seed','equip','deco'].forEach(t => {
    const b = document.getElementById('shop-tab-'+t);
    if (b) { b.classList.remove('success'); b.classList.add('outline'); }
  });
  if (btn) { btn.classList.remove('outline'); btn.classList.add('success'); }
  renderShopManage();
}

function renderShopManage() {
  const db = DB.load();
  const ov = (db.settings || {}).shopOverrides || {};
  const el = document.getElementById('shop-manage-body');
  if (!el) return;

  if (CUR_SHOP_TAB === 'seed') {
    const seedOv = ov.seeds || {};
    el.innerHTML = `<div style="font-size:.72rem;color:var(--txt3);margin-bottom:.4rem;display:grid;grid-template-columns:1fr 80px 80px 80px;gap:.3rem;padding:0 .3rem">
      <span>씨앗</span><span class="text-center">구매가(G)</span><span class="text-center">수확가(G)</span><span class="text-center">성장(h)</span>
    </div>` +
    GAME_DATA.seeds.map(s => {
      const o = seedOv[s.id] || {};
      return `<div style="display:grid;grid-template-columns:1fr 80px 80px 80px;gap:.3rem;align-items:center;padding:.35rem .3rem;border-bottom:1px solid rgba(255,255,255,.04)">
        <span style="font-size:.82rem">${s.icon} ${s.name}</span>
        <input class="form-input" type="number" id="sov-price-${s.id}" value="${o.price??s.price}" style="padding:.2rem .4rem;font-size:.78rem;text-align:center" placeholder="${s.price}">
        <input class="form-input" type="number" id="sov-sell-${s.id}" value="${o.sellPrice??s.sellPrice}" style="padding:.2rem .4rem;font-size:.78rem;text-align:center" placeholder="${s.sellPrice}">
        <input class="form-input" type="number" id="sov-grow-${s.id}" value="${o.growHours??s.growHours}" style="padding:.2rem .4rem;font-size:.78rem;text-align:center" placeholder="${s.growHours}">
      </div>`;
    }).join('');

  } else if (CUR_SHOP_TAB === 'equip') {
    const eqOv = ov.equipment || {};
    const slotNames = {head:'머리',body:'몸통',weapon:'무기',glove:'장갑',shoe:'신발'};
    const statKeys = ['atk','def','spd','mag'];
    el.innerHTML = Object.entries(GAME_DATA.equipment).map(([slot, items]) =>
      `<div style="font-size:.75rem;font-weight:700;color:var(--gold);margin:.6rem 0 .3rem">${slotNames[slot]||slot}</div>` +
      items.map(item => {
        const o = eqOv[item.id] || {};
        const os = o.stats || {};
        const statInputs = statKeys.filter(k => item.stats[k] !== undefined).map(k =>
          `<span class="text-muted-xs">${k}</span>
           <input class="form-input" type="number" id="sov-stat-${item.id}-${k}" value="${os[k]??item.stats[k]}" style="width:48px;padding:.15rem .3rem;font-size:.75rem;text-align:center">`
        ).join('');
        return `<div style="display:flex;align-items:center;gap:.5rem;padding:.35rem .3rem;border-bottom:1px solid rgba(255,255,255,.04);flex-wrap:wrap">
          <span style="font-size:.82rem;min-width:90px">${item.icon} ${item.name}</span>
          <span class="text-muted-xs">가격</span>
          <input class="form-input" type="number" id="sov-price-${item.id}" value="${o.price??item.price}" style="width:60px;padding:.15rem .3rem;font-size:.75rem;text-align:center">
          <span class="text-muted-xs">Lv</span>
          <input class="form-input" type="number" id="sov-lv-${item.id}" value="${o.lv??item.lv}" style="width:40px;padding:.15rem .3rem;font-size:.75rem;text-align:center">
          ${statInputs}
        </div>`;
      }).join('')
    ).join('');

  } else if (CUR_SHOP_TAB === 'deco') {
    const decoOv = ov.decorations || {};
    el.innerHTML = GAME_DATA.decorations.filter(d=>d.price>0).map(d => {
      const o = decoOv[d.id] || {};
      return `<div style="display:flex;align-items:center;gap:.5rem;padding:.35rem .3rem;border-bottom:1px solid rgba(255,255,255,.04)">
        <span style="font-size:1.1rem">${d.icon}</span>
        <span style="font-size:.82rem;flex:1">${d.name}</span>
        <span class="text-muted-xs">가격</span>
        <input class="form-input" type="number" id="sov-price-${d.id}" value="${o.price??d.price}" style="width:70px;padding:.2rem .4rem;font-size:.78rem;text-align:center">
        <span class="text-muted-xs">G</span>
      </div>`;
    }).join('');
  }
}

function saveEmotionRewardSettings() {
  const db = DB.load();
  db.settings = db.settings || {};
  const enabled = document.getElementById('emo-reward-enabled')?.checked ?? true;
  const lbl  = document.getElementById('emo-reward-enabled-label');
  const body = document.getElementById('emo-reward-settings-body');
  if (lbl)  lbl.textContent = enabled ? '켜짐' : '꺼짐';
  if (body) body.style.opacity = enabled ? '1' : '0.4';
  // [ZERO-OK-1] EXP·골드 칸은 0 을 0 으로(Utils.intOr). 며칠 기준 칸은 0 이 뜻이 없어 그대로(빈칸·0 → 기본값).
  db.settings.emotionRewards = {
    enabled,
    participate: parseInt(document.getElementById('emo-reward-participate')?.value) || 4,
    participateExp:  Utils.intOr(document.getElementById('emo-reward-participate-exp')?.value, 20),
    participateGold: Utils.intOr(document.getElementById('emo-reward-participate-gold')?.value, 15),
    steady:      parseInt(document.getElementById('emo-reward-steady')?.value) || 8,
    steadyExp:   Utils.intOr(document.getElementById('emo-reward-steady-exp')?.value, 50),
    steadyGold:  Utils.intOr(document.getElementById('emo-reward-steady-gold')?.value, 40),
    reflect:     parseInt(document.getElementById('emo-reward-reflect')?.value) || 3,
    reflectExp:  Utils.intOr(document.getElementById('emo-reward-reflect-exp')?.value, 30),
    reflectGold: Utils.intOr(document.getElementById('emo-reward-reflect-gold')?.value, 20),
  };
  DB._cache = db;
  DB._fbRef.child('settings').set(db.settings);
  notify(enabled ? '✅ 감정 보상 켜짐!' : '✅ 감정 보상 꺼짐!');
}

function loadEmotionRewardSettings() {
  const db = DB.load();
  const emo = (db.settings || {}).emotionRewards || {};
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set('emo-reward-participate',      emo.participate      || 4);
  set('emo-reward-participate-exp',  Utils.intOr(emo.participateExp, 20));
  set('emo-reward-participate-gold', Utils.intOr(emo.participateGold, 15));
  set('emo-reward-steady',           emo.steady           || 8);
  set('emo-reward-steady-exp',       Utils.intOr(emo.steadyExp, 50));
  set('emo-reward-steady-gold',      Utils.intOr(emo.steadyGold, 40));
  set('emo-reward-reflect',          emo.reflect          || 3);
  set('emo-reward-reflect-exp',      Utils.intOr(emo.reflectExp, 30));
  set('emo-reward-reflect-gold',     Utils.intOr(emo.reflectGold, 20));
  // enabled 체크박스
  const enabled = emo.enabled !== false; // 기본 true
  const chk = document.getElementById('emo-reward-enabled');
  const lbl = document.getElementById('emo-reward-enabled-label');
  const body = document.getElementById('emo-reward-settings-body');
  if (chk) chk.checked = enabled;
  if (lbl) lbl.textContent = enabled ? '켜짐' : '꺼짐';
  if (body) body.style.opacity = enabled ? '1' : '0.4';
}

function saveShopOverrides() {
  const db = DB.load();
  db.settings = db.settings || {};
  db.settings.shopOverrides = db.settings.shopOverrides || {};
  const ov = db.settings.shopOverrides;

  if (CUR_SHOP_TAB === 'seed') {
    ov.seeds = ov.seeds || {};
    GAME_DATA.seeds.forEach(s => {
      ov.seeds[s.id] = {
        price:     parseInt(document.getElementById(`sov-price-${s.id}`)?.value) || s.price,
        sellPrice: parseInt(document.getElementById(`sov-sell-${s.id}`)?.value)  || s.sellPrice,
        growHours: parseInt(document.getElementById(`sov-grow-${s.id}`)?.value)  || s.growHours,
      };
    });
  } else if (CUR_SHOP_TAB === 'equip') {
    ov.equipment = ov.equipment || {};
    Object.values(GAME_DATA.equipment).flat().forEach(item => {
      const price = parseInt(document.getElementById(`sov-price-${item.id}`)?.value);
      const lv    = parseInt(document.getElementById(`sov-lv-${item.id}`)?.value);
      const stats = {};
      ['atk','def','spd','mag'].forEach(k => {
        const el = document.getElementById(`sov-stat-${item.id}-${k}`);
        if (el) stats[k] = parseInt(el.value);
      });
      ov.equipment[item.id] = { price, lv, stats };
    });
  } else if (CUR_SHOP_TAB === 'deco') {
    ov.decorations = ov.decorations || {};
    GAME_DATA.decorations.filter(d=>d.price>0).forEach(d => {
      const price = parseInt(document.getElementById(`sov-price-${d.id}`)?.value);
      ov.decorations[d.id] = { price };
    });
  }

  DB._cache = db;
  DB._fbRef.child('settings').set(db.settings);
  applyShopOverrides(db); // 즉시 반영
  notify('✅ 상점 설정 저장! 학생 화면에도 바로 반영돼요');
}

function resetShopOverrides() {
  // [RESET-SCOPE-1] 이 탭 한 칸만 지운다. 예전엔 settings **전체**를 교사 캐시 판으로 set 해서
  //   그사이 바뀐 다른 설정(아침 자동등록 날짜·오늘의 링크 등)을 되돌릴 수 있었다.
  const node = { seed: 'seeds', equip: 'equipment', deco: 'decorations' }[CUR_SHOP_TAB];
  if (!node) return;
  const label = { seed: '씨앗', equip: '장비', deco: '장식' }[CUR_SHOP_TAB];
  if (!confirm(`상점 ${label} 탭의 가격·수치 조정을 기본값으로 되돌릴까요?\n\n다른 탭과 다른 설정은 그대로 둡니다.`)) return;
  const db = DB.load();
  db.settings = db.settings || {};
  db.settings.shopOverrides = db.settings.shopOverrides || {};
  delete db.settings.shopOverrides[node];
  DB._cache = db;
  DB._fbRef.child('settings/shopOverrides/' + node).remove();
  // GAME_DATA를 기본값으로 재로드 (페이지 새로고침 필요)
  notify('↩️ 기본값으로 초기화됐어요. 새로고침하면 반영돼요');
  setTimeout(() => location.reload(), 1500);
}

// ══════════════════════════════════════════════════
//  SUBJECT MANAGEMENT (과목 관리)
// ══════════════════════════════════════════════════
const DEFAULT_SUBJECTS = ['국어','수학','사회','과학','음악','미술','체육','영어','창체'];

function getActiveSubjects(db) {
  const d = db || DB.load();
  const s = d.settings || {};
  if (s.activeSubjects && s.activeSubjects.length > 0) return s.activeSubjects;
  return DEFAULT_SUBJECTS; // 설정 없으면 기본 전체
}

function renderSubjectManage() {
  const db = DB.load();
  const settings = db.settings || {};
  const active = settings.activeSubjects || DEFAULT_SUBJECTS;
  const customs = settings.customSubjects || [];
  const el = document.getElementById('subject-manage-list');
  if (!el) return;

  const allSubjects = [...DEFAULT_SUBJECTS, ...customs];
  el.innerHTML = allSubjects.map(s => `
    <div style="display:flex;align-items:center;gap:.6rem;padding:.35rem .5rem;
      background:rgba(255,255,255,.03);border-radius:8px">
      <input type="checkbox" id="subj-chk-${s}" value="${s}"
        ${active.includes(s) ? 'checked' : ''}
        style="width:15px;height:15px;accent-color:var(--emerald)">
      <label for="subj-chk-${s}" style="flex:1;font-size:.85rem;cursor:pointer">${s}</label>
      ${customs.includes(s) ? `<button onclick="deleteCustomSubject('${s}')"
        style="background:none;border:none;color:var(--txt3);cursor:pointer;font-size:.8rem">✕</button>` : ''}
    </div>`).join('');
}

function addCustomSubject() {
  const inp = document.getElementById('subject-custom-input');
  const name = inp.value.trim();
  if (!name) return;
  const db = DB.load();
  db.settings = db.settings || {};
  db.settings.customSubjects = db.settings.customSubjects || [];
  if (!db.settings.customSubjects.includes(name) && !DEFAULT_SUBJECTS.includes(name)) {
    db.settings.customSubjects.push(name);
    DB._cache = db;
    DB._fbRef.child('settings').set(db.settings);
    inp.value = '';
    renderSubjectManage();
  } else {
    notify('이미 있는 과목이에요', 'error');
  }
}

function deleteCustomSubject(name) {
  const db = DB.load();
  db.settings = db.settings || {};
  db.settings.customSubjects = (db.settings.customSubjects||[]).filter(s=>s!==name);
  db.settings.activeSubjects = (db.settings.activeSubjects||DEFAULT_SUBJECTS).filter(s=>s!==name);
  DB._cache = db;
  DB._fbRef.child('settings').set(db.settings);
  renderSubjectManage();
}

function saveSubjects() {
  const db = DB.load();
  db.settings = db.settings || {};
  const customs = db.settings.customSubjects || [];
  const all = [...DEFAULT_SUBJECTS, ...customs];
  db.settings.activeSubjects = all.filter(s => {
    const chk = document.getElementById(`subj-chk-${s}`);
    return chk && chk.checked;
  });
  DB._cache = db;
  DB._fbRef.child('settings').set(db.settings);
  notify('✅ 과목 설정 저장!');
}

function updateEmotionAlertBadge() {
  const db = DB.load();
  const alerts = Object.values(db.emotionAlerts || {}).filter(a => a && !a.read);
  const badge = document.getElementById('emotion-alert-badge');
  if (!badge) return;
  if (alerts.length > 0) { badge.textContent = alerts.length; badge.style.display = ''; }
  else badge.style.display = 'none';
}

function renderEmotionAlerts() {
  const db = DB.load();
  const alerts = Object.values(db.emotionAlerts || {})
    .filter(a => a)
    .sort((a,b) => b.createdAt - a.createdAt);
  const el = document.getElementById('emotion-alerts-list');
  if (!el) return;

  if (alerts.length === 0) {
    el.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--txt3);font-size:.85rem">감정 대화 요청이 없어요 ✅</div>';
    return;
  }

  const typeLabel = {worse:'😔 나빠졌어요', custom:'✏️ 직접 입력', same:'😐 비슷해요'};
  el.innerHTML = alerts.map(a => `
    <div style="padding:.8rem 1.2rem;border-bottom:1px solid rgba(255,255,255,.05);
      background:${a.read?'':'rgba(93,173,226,.04)'}">
      <div style="display:flex;align-items:center;gap:.7rem;margin-bottom:.4rem">
        <span style="font-size:1.1rem">${escHtml(a.studentAvatar||'?')}</span>
        <span style="font-weight:700">${escHtml(a.studentName||'?')}</span>
        <span style="font-size:.72rem;background:rgba(93,173,226,.12);color:var(--sky);
          border-radius:8px;padding:.1rem .4rem">${typeLabel[a.responseType]||a.responseType}</span>
        <span style="font-size:.7rem;color:var(--txt3);margin-left:auto">${a.promptDate||''}</span>
      </div>
      <div style="font-size:.8rem;color:var(--txt2);margin-bottom:.3rem">
        과거 감정: ${a.promptEmotionLabel||''}
        ${a.promptReason&&a.promptReason!=='없음'?` · "${escHtml(a.promptReason)}"`:''}
      </div>
      ${a.responseText?`<div style="font-size:.78rem;color:var(--txt2);padding:.4rem .6rem;
        background:rgba(255,255,255,.04);border-radius:8px;margin-bottom:.3rem">
        💬 ${escHtml(a.responseText)}</div>`:''}
      <button onclick="markEmotionAlertRead('${a.id}')"
        style="font-size:.7rem;background:none;border:1px solid rgba(255,255,255,.15);
          color:var(--txt3);border-radius:6px;padding:.2rem .5rem;cursor:pointer">
        ${a.read?'확인됨':'✅ 확인'}</button>
    </div>`).join('');
}

function markEmotionAlertRead(id) {
  const db = DB.load();
  if (db.emotionAlerts && db.emotionAlerts[id]) {
    db.emotionAlerts[id].read = true;
    DB._cache = db;
    DB._fbRef.child('emotionAlerts/' + id + '/read').set(true);
    renderEmotionAlerts();
    updateEmotionAlertBadge();
  }
}

// ══════════════════════════════════════════════════
//  EMOTION PAGE
// ══════════════════════════════════════════════════
function renderEmotionPage() {
  const db = DB.load();
  const students = DB.getStudents();

  // 날짜 필터 초기화
  const dateSel = document.getElementById('emo-date-filter');
  if (!dateSel.value) dateSel.value = Utils.todayStr();
  const date = dateSel.value;

  // 학생 필터 셀렉트 초기화
  const stuSel = document.getElementById('emo-student-filter');
  if (stuSel && stuSel.options.length === 1) {
    students.forEach(s => {
      const o = document.createElement('option');
      o.value = s.id; o.textContent = s.avatar + ' ' + s.name;
      stuSel.appendChild(o);
    });
  }

  const stuFilter    = stuSel?.value || 'all';
  const periodFilter = document.getElementById('emo-period-filter')?.value || 'all';

  // 해당 날짜 감정 기록 가져오기
  let records = DB_EMOTION.getByDate(date);
  if (stuFilter !== 'all')    records = records.filter(r => r.studentId === stuFilter);
  if (periodFilter !== 'all') records = records.filter(r => r.period === periodFilter);

  // 요약
  const pos = records.filter(r => r.group === 'positive').length;
  const neu = records.filter(r => r.group === 'neutral').length;
  const neg = records.filter(r => r.group === 'negative').length;
  const total = records.length;
  const summaryEl = document.getElementById('emotion-summary');
  if (summaryEl) {
    summaryEl.innerHTML = [
      { label:'총 기록', value:total+'건', color:'var(--sky)' },
      { label:'😊 긍정', value:pos+'건', color:'var(--emerald)' },
      { label:'😶 보통', value:neu+'건', color:'var(--txt2)' },
      { label:'😢 부정', value:neg+'건', color:'var(--red)' },
      { label:'미입력', value:(students.length*2 - total)+'칸', color:'var(--txt3)' },
    ].map(s => `<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
      border-radius:10px;padding:.5rem .9rem;text-align:center">
      <div class="text-muted-tiny">${s.label}</div>
      <div style="font-size:1.1rem;font-weight:700;color:${s.color}">${s.value}</div>
    </div>`).join('');
  }

  // 목록
  const el = document.getElementById('emotion-list');
  if (!el) return;

  if (records.length === 0) {
    el.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--txt3);font-size:.85rem">
      ${date} 감정 기록이 없어요</div>`;
    return;
  }

  // 학생별 그룹핑
  const byStudent = {};
  records.forEach(r => {
    if (!byStudent[r.studentId]) byStudent[r.studentId] = [];
    byStudent[r.studentId].push(r);
  });

  const groupColor = { positive:'var(--emerald)', neutral:'var(--txt2)', negative:'var(--red)' };
  const groupLabel = { positive:'긍정', neutral:'보통', negative:'부정' };

  el.innerHTML = Object.entries(byStudent).map(([sid, recs]) => {
    const s = students.find(x => x.id === sid);
    return `<div style="padding:.8rem 1.2rem;border-bottom:1px solid rgba(255,255,255,.05)">
      <div style="font-size:.88rem;font-weight:700;margin-bottom:.5rem">
        ${s?.avatar||'?'} ${escHtml(s?.name||'?')}
      </div>
      <div style="display:flex;gap:.6rem;flex-wrap:wrap">
        ${recs.sort((a,b)=>a.period.localeCompare(b.period)).map(r => `
          <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
            border-radius:12px;padding:.6rem .9rem;min-width:140px">
            <div style="font-size:.7rem;color:var(--txt3);margin-bottom:.3rem">
              ${r.period==='am'?'🌅 오전':'🌇 오후'}
            </div>
            <div style="display:flex;align-items:center;gap:.5rem">
              <span style="font-size:1.6rem">${r.emotionIcon}</span>
              <div>
                <div style="font-size:.85rem;font-weight:700">${r.emotionLabel}</div>
                <div style="font-size:.72rem;color:${groupColor[r.group]}">
                  ${groupLabel[r.group]} · ${r.levelLabel}
                </div>
              </div>
            </div>
            ${r.reason && r.reason !== '없음'
              ? `<div style="font-size:.72rem;color:var(--txt2);margin-top:.4rem;
                  padding:.3rem .5rem;background:rgba(255,255,255,.04);border-radius:6px">
                  💬 ${escHtml(r.reason)}</div>` : ''}
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');

  // ── 그래프 ──
  renderEmotionCharts(date);
}

let _adminScoreChart = null;
let _adminDistChart  = null;

function renderEmotionCharts(baseDate) {
  const db = DB.load();
  const students = DB.getStudents();
  // 최근 14일 날짜 배열
  const dates = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() + 9*3600000 - i*86400000);
    dates.push(d.toISOString().slice(0,10));
  }
  // 날짜별 평균 score
  const scoreByDate = dates.map(d => {
    const recs = DB_EMOTION.getByDate(d);
    if (!recs.length) return null;
    return +(recs.reduce((s,r)=>s+r.score,0)/recs.length).toFixed(1);
  });

  // 점수 꺾은선
  if (_adminScoreChart) _adminScoreChart.destroy();
  const scoreCtx = document.getElementById('admin-emo-score-chart');
  if (scoreCtx) {
    _adminScoreChart = new Chart(scoreCtx, {
      type:'line',
      data:{
        labels: dates.map(d=>d.slice(5)),
        datasets:[{
          label:'반 평균 감정 점수',
          data: scoreByDate,
          borderColor:'#FFD700', backgroundColor:'rgba(255,215,0,.1)',
          pointBackgroundColor: scoreByDate.map(s => s===null?'transparent':s>0?'#2ecc71':s<0?'#e74c3c':'#aaa'),
          tension:0.3, fill:true, pointRadius:4, spanGaps:true,
        }]
      },
      options:{
        responsive:true,
        plugins:{legend:{display:false}},
        scales:{
          y:{min:-3,max:3,grid:{color:'rgba(255,255,255,.08)'},ticks:{color:'#aaa',font:{size:10}}},
          x:{grid:{color:'rgba(255,255,255,.05)'},ticks:{color:'#aaa',font:{size:9}}}
        }
      }
    });
  }

  // 오늘 감정 분포 도넛
  const todayRecs = DB_EMOTION.getByDate(baseDate);
  const pos = todayRecs.filter(r=>r.group==='positive').length;
  const neu = todayRecs.filter(r=>r.group==='neutral').length;
  const neg = todayRecs.filter(r=>r.group==='negative').length;
  if (_adminDistChart) _adminDistChart.destroy();
  const distCtx = document.getElementById('admin-emo-dist-chart');
  if (distCtx && (pos+neu+neg) > 0) {
    _adminDistChart = new Chart(distCtx, {
      type:'doughnut',
      data:{
        labels:['긍정','보통','부정'],
        datasets:[{data:[pos,neu,neg],backgroundColor:['#2ecc71','#95a5a6','#e74c3c'],borderWidth:0}]
      },
      options:{responsive:true,plugins:{legend:{position:'right',labels:{color:'#ccc',font:{size:11}}}}}
    });
  } else if (distCtx) {
    const ctx2 = distCtx.getContext('2d');
    ctx2.clearRect(0,0,distCtx.width,distCtx.height);
    ctx2.fillStyle='rgba(255,255,255,.3)';
    ctx2.font='13px Noto Sans KR';
    ctx2.textAlign='center';
    ctx2.fillText('아직 데이터 없음', distCtx.width/2, 70);
  }
}

// ══════════════════════════════════════════════════
//  BACKUP & ROLLBACK
// ══════════════════════════════════════════════════
const BACKUP_KEEP_DAYS = 14; // 최근 14개 보관 (구독 범위 밖이라 용량 부담이 없어 7→14로 확대) · [BACKUP-KEY-1] 날짜 14일 → 백업 14개

// [BACKUP-KEY-1] 백업 키 = 'YYYY-MM-DD_HHMMSS'(한국 시각).
//   예전엔 날짜 한 칸('YYYY-MM-DD')이라 같은 날 [💾 백업]을 누르면 그날 아침 자동 백업을 덮었다
//   (문제가 생긴 걸 알고 눌러도 '문제 전' 본이 사라졌다). 이제 누를 때마다 새 칸이 생긴다.
//   옛 날짜 키도 그대로 목록·롤백에 나온다 — 정렬하면 같은 날의 옛 키가 시각 키보다 앞(더 이른 것)이다.
function backupKeyNow() {
  const iso = new Date(Date.now() + 9 * 3600000).toISOString();   // Utils.todayStr 와 같은 KST
  return iso.slice(0, 10) + '_' + iso.slice(11, 19).replace(/:/g, '');
}
function backupKeyLabel(k) {
  const m = /^(\d{4}-\d{2}-\d{2})(?:_(\d{2})(\d{2})(\d{2}))?$/.exec(String(k));
  if (!m) return String(k);
  return m[2] ? `${m[1]} ${m[2]}:${m[3]}` : m[1];
}

// [BACKUP-ROOTS-1] RPG 본 루트(classRPG_v3) 밖에 따로 저장하는 학습 앱 루트들 — 예전 백업·내보내기에는 생각판만(백업) 또는 아무것도(내보내기) 없었다.
//   이름은 각 앱 store.js 의 ROOT 와 같다(watercolor/drawing 은 watercolor/index.html 이 'classRPG_' + 과정 키로 쓴다).
//   생각판은 예전처럼 백업의 thinkboard 칸에, 나머지는 apps.<루트> 칸에 담는다.
//   마을(classRPG_villages)은 **자동 백업에서 뺀다** — 학생마다 구역 문자열이 커서(학생당 최대 약 135KB, renderVillagesPage 주석)
//   반 전체 크기를 미리 알 수 없고, 로그인마다 도는 자동 백업 14개에 그대로 쌓이면 무료 저장 한도를 위협한다.
//   마을은 [데이터 내보내기](파일로 받기)에만 담는다. 마을 전용 백업은 scripts/village-backup.mjs.
const BACKUP_APP_ROOTS = ['classRPG_music', 'classRPG_coding', 'classRPG_pattern', 'classRPG_paint', 'classRPG_art',
  'classRPG_ink', 'classRPG_print', 'classRPG_watercolor', 'classRPG_drawing', 'classRPG_mathgap'];
const EXPORT_ROOTS = ['classRPG_thinkboard', ...BACKUP_APP_ROOTS, 'classRPG_villages'];
const EXPORT_FORMAT = 'classRPG-export-2';

// 루트 하나를 한 번 읽는다. 오래 걸리면(오프라인 등) 건너뛴다 — 백업·내보내기 전체가 멈추지 않게.
function readRootOnce(root, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('시간 초과')), ms || 15000);
    firebase.database().ref(root).once('value').then(snap => { clearTimeout(t); resolve(snap.val()); }, e => { clearTimeout(t); reject(e); });
  });
}

// [BACKUP-KEY-1] 백업 키 목록만 받는다(shallow REST — 백업 본문을 내려받지 않는다). 안 되면 예전처럼 SDK 로 통째 읽어 키만.
//   예전 renderBackupList 는 로그인할 때마다 백업 전체(14개 × 약 1.6MB)를 내려받았다.
async function backupKeysAt(path, sdkRef) {
  try {
    const base = new URL(firebase.app().options.databaseURL);
    const u = new URL(base.origin + base.pathname.replace(/\/+$/, '') + '/' + path + '.json');
    base.searchParams.forEach((v, k) => u.searchParams.set(k, v));
    u.searchParams.set('shallow', 'true');
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), 8000) : 0;
    const res = await fetch(u.toString(), ctl ? { signal: ctl.signal } : undefined);
    if (t) clearTimeout(t);
    if (!res.ok) throw new Error(res.status);
    const j = await res.json();
    return j && typeof j === 'object' ? Object.keys(j) : [];
  } catch (e) {
    const snap = await sdkRef.once('value');
    return Object.keys(snap.val() || {});
  }
}
async function listBackupKeys() {
  return (await backupKeysAt('classRPG_backups', backupsRef())).sort();
}

// [ER-4] 백업은 실시간 구독 루트(classRPG_v3) **밖**에 저장한다.
//   같은 루트 안에 두면 학생이 한 번 저장할 때마다 접속 중인 모든 기기가 백업 전체를
//   다시 내려받는다. 실측: 전체 6.4MB 중 백업이 4.9MB(75%) — 무료 티어 전송량의 주범.
//   앱은 평소 백업을 읽지 않으므로(롤백 때만) 밖으로 빼도 동작에 영향이 없다.
function backupsRef()       { return firebase.database().ref('classRPG_backups'); }
// 이전 위치 — 마이그레이션 전 백업을 계속 읽기 위한 폴백(쓰기는 하지 않음)
function legacyBackupsRef() { return DB._fbRef.child('backups'); }

// 새 위치 + 옛 위치를 합쳐 반환(같은 날짜 키는 새 위치 우선)
async function loadAllBackups() {
  const [cur, old] = await Promise.all([
    backupsRef().once('value'),
    legacyBackupsRef().once('value'),
  ]);
  return { ...(old.val() || {}), ...(cur.val() || {}) };
}
async function readBackup(dateKey) {
  const cur = await backupsRef().child(dateKey).once('value');
  if (cur.exists()) return cur.val();
  const old = await legacyBackupsRef().child(dateKey).once('value');
  return old.exists() ? old.val() : null;
}

// [ER-3] 백업 대상 노드. 기존엔 아래 8개만 담겨 감정기록·독서(추억)·주간다짐·리코더·
//   어휘·설정은 **백업조차 되지 않아** 롤백해도 복원되지 않았다.
const BACKUP_NODES = [
  'students', 'questLogs', 'boardQuests', 'customMonsters', 'customQuestTemplates',
  'hiddenQuestTemplates', 'promotionRequests', 'artworks',
  // 이번에 추가된 누락 노드
  'settings', 'memories', 'memoryAlbums', 'emotionLogs', 'emotionReflections',
  'emotionAlerts', 'emotionPromptStats', 'weeklyGoals', 'weeklyReflections',
  'recorderLogs', 'recorderSongs', 'quizRecords', 'customWords', 'teacherWordSets',
  'studentNotes',   // [NOTES-1] 교사가 학생에게 준 쪽지 — 잃으면 안 되는 데이터
  // [BACKUP-3N] 날짜별 롤백으로 되살릴 수 없던 세 노드(09-15 기타 2 발견). 운영 실측 크기(GET):
  //   problemRecords 214KB(176건) · goldDaily 0.2KB · customProblems 없음 → 백업 1회 1,387KB → 약 1,601KB(+15%).
  //   롤백은 아래 노드별 set 이라 셋 다 그대로 되돌아간다. 마을(classRPG_villages)은 여전히 밖(scripts/village-backup.mjs).
  'problemRecords',  // 학습 풀이 기록 — 별(숙달도)·복습 날짜의 근거. 키 객체 그대로
  'goldDaily',       // 골드 하루 기록(경로별 수입)
  'customProblems',  // 교사가 만든 문제
];

// auto: 알림 없이(자동·초기화 전·가져오기 전). kind: 백업 칸에 남기는 까닭(목록에 보인다).
//   돌려주는 값: 만든 백업 키. 저장이 실패하면 던진다(초기화·가져오기는 이때 멈춘다).
async function saveBackup(auto, kind) {
  const db = DB.load();
  const key = backupKeyNow();   // [BACKUP-KEY-1]
  const snapshot = { savedAt: new Date().toISOString(), kind: kind || (auto ? '자동' : '수동') };
  BACKUP_NODES.forEach(k => {
    if (db[k] !== undefined && db[k] !== null) snapshot[k] = db[k];
  });
  // [THINKBOARD-2] 생각판(classRPG_thinkboard)도 같은 백업에 담는다 — 연구 자료가 RPG 기록과 함께 남게.
  //   되돌리기(롤백)는 BACKUP_NODES 만 되살린다 — 생각판은 백업에서 꺼내 볼 수만 있다(수업 중 판이 갑자기 되감기지 않게).
  let skippedTb = false;   // 생각판을 못 읽었으면 appsSkipped 에 같이 적는다(백업에서 빠진 걸 알 수 있게)
  try { const tb = await readRootOnce('classRPG_thinkboard'); if (tb != null) snapshot.thinkboard = tb; } catch (e) { console.warn('생각판 백업 건너뜀', e); skippedTb = true; }
  // [BACKUP-ROOTS-1] 학습 앱 루트도 담는다(롤백은 하지 않는다 — 생각판과 같은 까닭). 못 읽은 루트는 appsSkipped 에 적는다.
  const apps = {}, skipped = skippedTb ? ['classRPG_thinkboard'] : [];
  await Promise.all(BACKUP_APP_ROOTS.map(async r => {
    try { const v = await readRootOnce(r); if (v != null) apps[r] = v; }
    catch (e) { console.warn('학습 앱 백업 건너뜀', r, e); skipped.push(r); }
  }));
  if (Object.keys(apps).length) snapshot.apps = apps;
  if (skipped.length) snapshot.appsSkipped = skipped.sort();
  try {
    await backupsRef().child(key).set(snapshot);
  } catch (e) {
    if (!auto) notify('⚠️ 백업 저장에 실패했어요. 인터넷 연결을 확인해 주세요.', 'error');
    throw e;
  }

  // 보관 개수 초과분 자동 삭제 (새 위치만 — 옛 위치는 건드리지 않는다) · 키 목록만 받아 오래된 것부터
  try {
    const allKeys = await listBackupKeys();
    const toDelete = allKeys.slice(0, Math.max(0, allKeys.length - BACKUP_KEEP_DAYS));
    for (const k of toDelete) if (k !== key) await backupsRef().child(k).remove();
  } catch (e) { console.warn('오래된 백업 정리 건너뜀', e); }

  if (!auto) { notify(`💾 ${backupKeyLabel(key)} 백업 완료!`); renderBackupList(); }
  return key;
}

async function renderBackupList() {
  const el = document.getElementById('backup-list-wrap');
  if (!el) return;
  // [BACKUP-KEY-1] 키만 받는다(새 위치 + 옛 위치). 옛 위치는 shallow 가 안 되면 건너뛴다(본문을 받지 않게).
  let keys = [];
  try {
    const [cur, old] = await Promise.all([
      listBackupKeys(),
      backupKeysAt(DB.KEY + '/backups', legacyBackupsRef()).catch(() => []),
    ]);
    keys = [...new Set([...cur, ...old])].sort().reverse();
  } catch (e) { el.textContent = '백업 목록을 읽지 못했어요'; return; }
  if (keys.length === 0) {
    el.textContent = '저장된 백업 없음';
  } else {
    el.innerHTML = `저장된 백업: <span style="color:var(--gold);font-weight:700">${keys.length}개</span>
      <span style="margin-left:.4rem">(${escHtml(backupKeyLabel(keys[keys.length-1]))} ~ ${escHtml(backupKeyLabel(keys[0]))})</span>`;
  }
}

async function openRollbackModal() {
  const data = await loadAllBackups();
  const keys = Object.keys(data).sort().reverse();

  const el = document.getElementById('rollback-date-list');
  if (keys.length === 0) {
    el.innerHTML = '<div style="color:var(--txt3);font-size:.8rem">저장된 백업이 없어요. 먼저 백업을 실행해주세요.</div>';
  } else {
    // [BACKUP-KEY-1] 키 = 날짜(옛) 또는 날짜_시각(새). 같은 날 여러 개가 있을 수 있어 까닭(kind)도 보인다.
    el.innerHTML = keys.map(k => `
      <label style="display:flex;align-items:center;gap:.6rem;padding:.5rem .7rem;
        background:rgba(255,255,255,.04);border-radius:8px;cursor:pointer;
        border:1px solid rgba(255,255,255,.08)">
        <input type="radio" name="rb-date" value="${escHtml(k)}" style="accent-color:var(--gold)">
        <span style="font-weight:600">${escHtml(backupKeyLabel(k).slice(0, 10))}</span>
        ${data[k] && data[k].kind ? `<span style="font-size:.68rem;color:var(--gold);border:1px solid rgba(255,215,0,.3);border-radius:8px;padding:0 .35rem">${escHtml(data[k].kind)}</span>` : ''}
        <span style="font-size:.72rem;color:var(--txt3);margin-left:auto">
          ${data[k] && data[k].savedAt ? new Date(data[k].savedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) : ''} 저장
        </span>
      </label>`).join('');
  }
  document.getElementById('rollback-confirm-input').value = '';
  document.getElementById('rollback-pw-input').value = '';
  document.getElementById('m-rollback').classList.add('open');
}

async function confirmRollback() {
  const selected = document.querySelector('input[name="rb-date"]:checked')?.value;
  if (!selected) { notify('복원할 날짜를 선택해주세요', 'error'); return; }
  if (document.getElementById('rollback-confirm-input').value !== 'ROLLBACK') {
    notify('ROLLBACK 을 정확히 입력해주세요', 'error'); return;
  }
  const pw = document.getElementById('rollback-pw-input').value;
  const adminPw = await DB.getAdminPw();
  if (pw !== adminPw) { notify('❌ 비밀번호가 틀렸어요', 'error'); return; }

  // 백업 데이터 불러와서 복원 (새 위치 → 없으면 옛 위치)
  const backup = await readBackup(selected);
  if (!backup) { notify('백업 데이터를 찾을 수 없어요', 'error'); return; }

  // 백업에 담긴 노드만 개별 경로로 복원한다.
  //   기존엔 정규화 캐시를 통째로 root에 set 해서 ① 파생 배열 quests(약 450KB)가 실제로
  //   저장되고 ② 백업에 없던 노드까지 캐시 값으로 덮어써졌다. 개별 set으로 바꿔 부작용 제거.
  const nodes = BACKUP_NODES.filter(k => backup[k] !== undefined && backup[k] !== null);
  for (const k of nodes) {
    // [PROMO-PER-ID-1] 백업은 캐시(배열)라 그대로 쓰면 숫자 키 — 승급 신청만 id 키로 되돌린다
    const v = k === 'promotionRequests'
      ? DB._promoObj(Array.isArray(backup[k]) ? backup[k] : Object.values(backup[k]))
      : backup[k];
    await DB._fbRef.child(k).set(v);
  }
  // [BACKUP-ROOTS-1] 학습 앱 기록(생각판·음악실 등)은 백업에 들어 있어도 롤백하지 않는다 — 안내만
  const appNote = (backup.thinkboard || backup.apps) ? ' · 학습 앱 기록은 그대로 둬요' : '';
  notify(`✅ ${backupKeyLabel(selected)} 데이터로 롤백 완료 (${nodes.length}개 항목${appNote}) — 곧 새로고침돼요`);
  setTimeout(() => location.reload(), 1500);
}

// [ER-4] 옛 위치(classRPG_v3/backups)의 백업을 새 위치(classRPG_backups)로 **복사**한다.
//   복사만 하고 옛 데이터는 지우지 않는다 — 검증 후 별도로 정리(안전 우선).
//   이전이 끝나면 실시간 구독 대상에서 백업이 빠져 접속 시 받는 데이터가 크게 줄어든다.
async function migrateBackupsToNewLocation() {
  const oldSnap = await legacyBackupsRef().once('value');
  const oldData = oldSnap.val() || {};
  const oldKeys = Object.keys(oldData);
  if (oldKeys.length === 0) { notify('이전할 옛 백업이 없어요 (이미 정리됨)'); return; }

  const curSnap = await backupsRef().once('value');
  const curKeys = new Set(Object.keys(curSnap.val() || {}));
  const todo = oldKeys.filter(k => !curKeys.has(k));
  if (todo.length === 0) { notify(`이미 ${oldKeys.length}개 모두 이전되어 있어요`); return; }

  if (!confirm(`백업 ${todo.length}개를 새 위치로 복사할까요?\n\n` +
    `· 옛 백업은 그대로 두고 복사만 합니다(데이터 삭제 없음)\n` +
    `· 복사 후에도 롤백 목록은 똑같이 보입니다`)) return;

  let done = 0;
  const failed = [];
  for (const k of todo) {
    try { await backupsRef().child(k).set(oldData[k]); done++; }
    catch (e) { console.error('[backup migrate]', k, e); failed.push(k); }
  }

  // 복사본이 실제로 저장됐는지 확인
  const verifySnap = await backupsRef().once('value');
  const verified = Object.keys(verifySnap.val() || {}).length;
  renderBackupList();

  if (failed.length === 0) {
    notify(`📦 ${done}개 복사 완료 (새 위치 총 ${verified}개). 옛 백업은 그대로 남아 있어요.`);
  } else {
    notify(`⚠️ ${done}개 복사, ${failed.length}개 실패 — 다시 시도해주세요`, 'error');
  }
}

// [ER-4] 실시간 전송량 줄이기 — 앱이 읽지 않는 중복/불필요 데이터 정리.
//   `quests`는 questLogs에서 매 로드마다 재생성되는 **파생 배열**인데, 과거 롤백이
//   정규화 캐시를 root에 통째로 저장하면서 DB에 실제로 남았다(낡은 스냅샷).
//   _normalizeArrays가 항상 questLogs 기준으로 덮어쓰므로 지워도 동작에 영향이 없다.
async function cleanupDerivedNodes() {
  const snap = await DB._fbRef.child('quests').once('value');
  if (!snap.exists()) { notify('정리할 중복 데이터가 없어요 ✅'); return; }
  const v = snap.val();
  const cnt = Array.isArray(v) ? v.length : Object.keys(v || {}).length;
  const kb  = Math.round(JSON.stringify(v).length / 1024);

  if (!confirm(
    `중복 저장된 옛 퀘스트 목록 ${cnt}건(약 ${kb}KB)을 지울까요?\n\n` +
    `· 이 데이터는 활동 기록에서 매번 자동으로 다시 만들어집니다\n` +
    `· 지워도 기록·통계·완료 판정에 영향이 없습니다\n` +
    `· 접속할 때마다 오가던 데이터가 그만큼 줄어듭니다`)) return;

  await DB._fbRef.child('quests').remove();
  notify(`🧹 중복 데이터 ${kb}KB 정리 완료! 새로고침하면 적용돼요`);
}

// 관리자 로그인 시 자동 백업
async function autoBackupOnLogin() {
  // [BACKUP-KEY-1] 오늘 날짜로 시작하는 키(옛 날짜 키 또는 오늘_시각 키)가 하나라도 있으면 건너뛴다 — 키 목록만 본다.
  const today = Utils.todayStr();
  try {
    const keys = await listBackupKeys();
    if (!keys.some(k => k === today || k.startsWith(today + '_'))) await saveBackup(true, '자동'); // 오늘 백업 없으면 자동 저장
  } catch (e) { console.warn('자동 백업 건너뜀', e); }
  renderBackupList();
}

// ══════════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════════
// [LIVE-INPUT-1] 설정 칸 채우기 — 교사가 쓰는 중(포커스)이거나, 지난번 채운 값에서 고쳐 놓고 아직 저장 안 한 칸은 건드리지 않는다.
//  학생 저장마다 renderAll → loadSettings 가 돌아 쓰던 학급명·보스·접속 시간이 옛 값으로 돌아가던 것. 저장된 값이 바뀌었고
//  교사가 손대지 않은 칸만 새 값으로 바뀐다.
//  [LIVE-INPUT-2] force = 설정 저장 직후. 저장값은 정리돼 칸 값과 다를 수 있으니(0회→3회 등) 모든 칸을 실제 저장값으로 다시 채운다.
function _fillSettingField(el, val, prop = 'value', force = false) {
  if (!el) return;
  const v = prop === 'checked' ? !!val : String(val);
  const cur = el[prop];
  if (!force && document.activeElement === el) return;
  if (!force && el.dataset.filled !== undefined && String(cur) !== el.dataset.filled && String(cur) !== String(v)) return;
  el[prop] = v;
  el.dataset.filled = String(v);
}

function loadSettings(force = false) {
  const s = DB.getSettings();
  const $ = id => document.getElementById(id);
  const fill = (el, val, prop = 'value') => _fillSettingField(el, val, prop, force);   // [LIVE-INPUT-2]
  fill($('set-classname'),   s.className||'우리반');
  fill($('set-boss-active'), s.bossActive||false, 'checked');
  fill($('set-boss-name'),   s.bossName||'거대 트롤');
  fill($('set-boss-icon'),   s.bossIcon||'🧌');
  fill($('set-boss-gold'),   Utils.intOr(s.bossGold, 150));   // [ZERO-OK-1]
  // [AUTO-DAILY-REWARD-1] 이 두 칸 = 자동 일일 퀘스트 보상(예전 baseExp·baseGold 는 읽는 곳이 없던 값이라 안 쓴다)
  const _adr = DB.autoDailyReward(s);
  fill($('set-base-exp'),  _adr.exp);
  fill($('set-base-gold'), _adr.gold);
  const _adrTxt = document.getElementById('auto-daily-reward-txt');
  if (_adrTxt) _adrTxt.textContent = `${_adr.exp}EXP + ${_adr.gold}G`;
  fill($('set-monster-rate'), s.monsterWinRate||80);
  // [BATTLE-SET-1] 이 칸은 예전에 settings.monsterDailyLimit(읽는 곳 0)에 썼다. 실제 전투가 읽는 키로 통일.
  fill($('set-monster-limit'), (s.customBattleSettings || {}).dailyBattleLimit ?? 3);
  fill($('set-access-start'), s.accessStart||'08:30');
  fill($('set-access-end'),   s.accessEnd  ||'16:00');
  renderTodayLinksList();
}

// ── 오늘의 링크 ──────────────────────────────────────
let _todayLinks = [];

function renderTodayLinksList() {
  _todayLinks = [...(DB.getSettings().todayLinks||[])];
  const el = document.getElementById('today-links-list');
  if (!el) return;
  if (_todayLinks.length === 0) {
    el.innerHTML = `<div class="text-muted-base">등록된 링크가 없어요</div>`;
    return;
  }
  el.innerHTML = _todayLinks.map((l,i) => `
    <div style="display:flex;align-items:center;gap:.4rem;padding:.35rem .5rem;
      background:rgba(93,173,226,.08);border:1px solid rgba(93,173,226,.2);border-radius:8px">
      <span style="font-size:.8rem">🔗</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:.8rem;font-weight:600;color:var(--sky)">${escHtml(l.title)}</div>
        <div style="font-size:.65rem;color:var(--txt3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(l.url)}</div>
      </div>
      <button onclick="removeTodayLink(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.8rem">🗑️</button>
    </div>`).join('');
}

function addTodayLink() {
  const title = document.getElementById('link-title-input')?.value.trim();
  let   url   = document.getElementById('link-url-input')?.value.trim();
  if (!title || !url) { notify('제목과 URL을 모두 입력해주세요'); return; }
  if (!url.startsWith('http')) url = 'https://' + url;
  // DB에서 최신 상태로 초기화 보장
  if (_todayLinks.length === 0) _todayLinks = [...(DB.getSettings().todayLinks||[])];
  _todayLinks.push({ title, url });
  document.getElementById('link-title-input').value = '';
  document.getElementById('link-url-input').value = '';
  // 즉시 저장
  const prev = DB.getSettings();
  DB.saveSettings({ ...prev, todayLinks: _todayLinks });
  renderTodayLinksList();
  notify('🔗 링크 추가됨! (자동 저장)');
}

function removeTodayLink(idx) {
  _todayLinks.splice(idx, 1);
  const prev = DB.getSettings();
  DB.saveSettings({ ...prev, todayLinks: _todayLinks });
  renderTodayLinksList();
}

function saveTodayLinks() {
  const prev = DB.getSettings();
  DB.saveSettings({ ...prev, todayLinks: _todayLinks });
  notify('🔗 오늘의 링크 저장!');
}

function saveSettings() {
  const prev = DB.getSettings();
  const limitEl = document.getElementById('set-monster-limit');
  DB.saveSettings({
    ...prev,
    className:        document.getElementById('set-classname').value,
    bossActive:       document.getElementById('set-boss-active').checked,
    bossName:         document.getElementById('set-boss-name').value,
    bossIcon:         document.getElementById('set-boss-icon').value,
    bossGold:         Utils.intOr(document.getElementById('set-boss-gold').value, 150),   // [ZERO-OK-1]
    // [AUTO-DAILY-REWARD-1] 빈 칸·글자는 기본값(35/25) — 검사·자르기는 DB.autoDailyReward 한 곳에서
    ...(() => { const r = DB.autoDailyReward({ autoDailyExp: document.getElementById('set-base-exp').value, autoDailyGold: document.getElementById('set-base-gold').value });
               return { autoDailyExp: r.exp, autoDailyGold: r.gold }; })(),
    monsterWinRate:   parseInt(document.getElementById('set-monster-rate').value)||80,
    ...(limitEl ? { customBattleSettings: { ...(prev.customBattleSettings || {}), dailyBattleLimit: parseInt(limitEl.value) || 3 } } : {}),   // [BATTLE-SET-1]
    accessStart: document.getElementById('set-access-start')?.value || '08:30',
    accessEnd:   document.getElementById('set-access-end')?.value   || '16:00',
  });
  loadSettings(true);   // [LIVE-INPUT-2] 정리된 저장값(0회→3회·5000→1000 등)을 칸에 되돌려 화면 = 실제 값
  notify('⚙️ 설정 저장 완료!');
}

function confirmReset() {
  if (!confirm('⚠️ 모든 데이터를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다!\n\n취소하려면 [아니오], 계속하려면 [예]를 누르세요.')) return;
  const pw = prompt('교사 비밀번호를 입력하세요:');
  if (pw === null) return; // 취소
  DB.getAdminPw().then(adminPw => {
    if (pw !== adminPw) { notify('❌ 비밀번호가 틀렸어요', 'error'); return; }
    DB._fbRef.remove().then(() => { notify('✅ 초기화 완료'); setTimeout(() => location.reload(), 800); });
  });
}

// [EXPORT-ROOTS-1] 내보내기 = RPG 본 데이터(classRPG_v3) + 루트 밖 학습 앱·마을(EXPORT_ROOTS) 한 파일.
//   예전엔 classRPG_v3 만 담아 생각판·음악실 등 학습 앱 기록과 마을이 파일에 없었다(운영 안내서는 '마을 뺀 전체'라고 잘못 적혀 있었다).
//   새 형식: { format:'classRPG-export-2', exportedAt, rpgRoot, rpg:<예전 파일 내용>, roots:{ 루트이름: 값 }, missing:[못 읽은 루트] }
//   가져오기(importData)는 옛 형식(classRPG_v3 만)도 그대로 받는다.
async function exportData() {
  notify('📁 내보내기 준비 중… 학습 앱·마을 기록도 함께 담아요');
  const roots = {}, missing = [];
  await Promise.all(EXPORT_ROOTS.map(async r => {
    try { const v = await readRootOnce(r, 30000); if (v != null) roots[r] = v; }
    catch (e) { console.warn('내보내기 건너뜀', r, e); missing.push(r); }
  }));
  const data = { format: EXPORT_FORMAT, exportedAt: new Date().toISOString(), rpgRoot: DB.KEY, rpg: DB.load(), roots, missing: missing.sort() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `classRPG_${Utils.todayStr()}.json`;
  a.click();
  notify(missing.length
    ? `📁 내보내기 완료 — 못 담은 것 ${missing.length}개(${missing.map(r => r.replace('classRPG_', '')).join(', ')})`
    : '📁 데이터 내보내기 완료! (RPG + 학습 앱 + 마을)', missing.length ? 'error' : undefined);
}

