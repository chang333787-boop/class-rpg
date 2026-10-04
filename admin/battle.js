// admin/battle.js — 몬스터·전투 설정(일괄 조정·장비·마스터리북·도감 보상) · getActiveMonsters(관리 화면 판 — gamedata.js 판을 덮는다) · 몬스터 편집
//  admin.js 에서 떼어 옮긴 클래식 스크립트 [ADMIN-SPLIT-1] — 글자 그대로 · 전역 그대로 · admin.html 에서 admin.js 바로 뒤에 부른다.
// ── [ADMIN-SPLIT-1] 'battle' — 원래 admin.js 4839~5417줄 ──
// ══════════════════════════════════════════════════
//  MONSTERS
// ══════════════════════════════════════════════════
// ── 배틀 허브 서브탭 전환 ──
let BATTLE_TAB = 'monster';
function battleTab(tab, btn) {
  BATTLE_TAB = tab;
  ['monster','balance','equip','skillbook','dex'].forEach(t => {
    document.getElementById('btab-'+t)?.classList.remove('on');
    const p = document.getElementById('bp-'+t);
    if (p) p.style.display = 'none';
  });
  btn.classList.add('on');
  const panel = document.getElementById('bp-'+tab);
  if (panel) panel.style.display = '';
  if (tab === 'monster')   renderMonsters();
  if (tab === 'balance')   { loadBattleSettings(); updateBattleSettingsSummary(); }
  if (tab === 'equip')     renderEquipAdmin();
  if (tab === 'skillbook') renderSkillBookAdmin();
  if (tab === 'dex')       loadDexSettings();
}

// ── 현재 설정 요약 카드 업데이트 ──
function updateBattleSettingsSummary() {
  const el = document.getElementById('bs-summary-content');
  if (!el) return;
  const bs = (DB.getSettings().customBattleSettings) || {};
  const limit = bs.dailyBattleLimit ?? 3;
  const ghost = bs.ghostNormalMult ?? 0.55;
  const adv   = bs.elemChart?.advantageMult ?? 1.4;
  const dis   = bs.elemChart?.disadvantageMult ?? 0.8;
  const nm    = bs.normalMults || SKILL_MULTIPLIERS.normal;
  const dr    = DB.getSettings().dexRewards || {};
  const nmStr = [1,2,3,4,5,6,7].map(lv => nm[lv]??SKILL_MULTIPLIERS.normal[lv]).join(' / ');
  const modified = Object.keys(bs).length > 0 ? '⚠️ 바꾼 값 적용 중' : '✅ 기본값';
  el.innerHTML = `
    <span style="background:rgba(255,215,0,.12);border-radius:6px;padding:.15rem .5rem">⚔️ 하루전투: <strong>${limit}회</strong></span>
    <span style="background:rgba(255,215,0,.12);border-radius:6px;padding:.15rem .5rem">👻 유령배율: <strong>${ghost}</strong></span>
    <span style="background:rgba(255,215,0,.12);border-radius:6px;padding:.15rem .5rem">속성유리: <strong>×${adv}</strong></span>
    <span style="background:rgba(255,215,0,.12);border-radius:6px;padding:.15rem .5rem">속성불리: <strong>×${dis}</strong></span>
    <span style="background:rgba(255,215,0,.12);border-radius:6px;padding:.15rem .5rem">기본 공격 계수: <strong>${nmStr}</strong></span>
    <span style="background:rgba(255,215,0,.12);border-radius:6px;padding:.15rem .5rem">도감첫처치: <strong>${dr.firstKillEnabled?`ON(${dr.firstKillGold}G)`:'OFF'}</strong></span>
    <span style="font-size:.7rem;color:var(--txt3);align-self:center">${modified}</span>`;
}

// ── 일괄 조정 ──────────────────────────────────────────
function applyBulkMonsterAdjust() {
  const scope = document.getElementById('bulk-scope')?.value || 'all';
  const stat  = document.getElementById('bulk-stat')?.value  || 'hp';
  const delta = parseInt(document.getElementById('bulk-delta')?.value) || 0;
  if (delta === 0) { notify('±값을 입력해 주세요', 'error'); return; }

  const db = DB.load();
  db.customMonsters = db.customMonsters || {};
  let count = 0;

  GAME_DATA.monsters.forEach(m => {
    // 범위 필터
    const inScope =
      scope === 'all'          ? true :
      scope === 'ghost'        ? m.trait === 'ghost' :
      scope === 'common'       ? m.rarity === 'common' :
      scope === 'rare'         ? m.rarity === 'rare' :
      scope === 'legend'       ? m.rarity === 'legend' :
      m.zone === scope;
    if (!inScope) return;

    // 현재 값 (커스텀 오버라이드 있으면 그 값 기준)
    const cur = db.customMonsters[m.id] || { ...m };
    const base = cur[stat] ?? m[stat] ?? 0;
    const newVal = Math.max(1, base + delta); // 최소 1
    if (!db.customMonsters[m.id]) db.customMonsters[m.id] = { ...m };
    db.customMonsters[m.id][stat] = newVal;
    db.customMonsters[m.id]._custom = true;
    count++;
  });

  DB._cache = db;
  DB._fbRef.child('customMonsters').set(db.customMonsters);
  renderMonsters();
  notify(`✅ ${count}마리 ${stat.toUpperCase()} ${delta>0?'+':''}${delta} 적용 완료`);
}

function renderMonsters() {
  const students = DB.getStudents();
  const allMonsters = getActiveMonsters();
  const statNames = { atk:'공격력', def:'방어력', mag:'마력', spd:'이동속도' };

  // 처치 현황
  const killTbl = document.getElementById('monster-kill-table');
  if (killTbl) killTbl.innerHTML = students.map(s => `
    <tr>
      <td>${s.avatar} <strong>${escHtml(s.name)}</strong></td>
      <td style="color:var(--red);font-weight:700">${(s.monsterLog||[]).length} / ${allMonsters.length}</td>
      <td style="font-size:.72rem;color:var(--txt2)">${(s.monsterLog||[]).map(e=>{const mm=allMonsters.find(m=>m.id===e);return mm?mm.name:e;}).join(', ')||'-'}</td>
    </tr>`).join('');

  // 필터 적용
  const zoneF   = document.getElementById('mf-zone')?.value   || 'all';
  const elemF   = document.getElementById('mf-elem')?.value   || 'all';
  const rarityF = document.getElementById('mf-rarity')?.value || 'all';
  const ghostF  = document.getElementById('mf-ghost')?.checked || false;

  let filtered = allMonsters;
  if (zoneF   !== 'all') filtered = filtered.filter(m => m.zone   === zoneF);
  if (elemF   !== 'all') filtered = filtered.filter(m => m.element=== elemF);
  if (rarityF !== 'all') filtered = filtered.filter(m => m.rarity === rarityF);
  if (ghostF)            filtered = filtered.filter(m => m.trait  === 'ghost');

  const el = document.getElementById('mon-edit-list');
  if (!el) return;
  const zoneLabel = {beginner:'🌿초급',intermediate:'🔥중급',advanced:'⚡고급'};
  const rarityColor= {common:'var(--txt3)',rare:'#7ec8e3',legend:'#c39bd3'};
  el.innerHTML = filtered.length
    ? filtered.map(m => {
      const isCustom = !!m._custom;
      return `<div style="display:flex;align-items:center;gap:.6rem;padding:.55rem 1rem;
        border-bottom:1px solid rgba(255,255,255,.05);${isCustom?'background:rgba(255,215,0,.02)':''}">
        <div style="font-size:1.5rem;width:32px;text-align:center">${iconImg(m, 'monsters', '1.5rem')}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:.85rem">${escHtml(m.name)}
            ${isCustom?'<span style="font-size:.62rem;color:var(--gold);margin-left:.3rem">✏️ 바꾼 값</span>':''}
            ${m.trait==='ghost'?'<span style="font-size:.62rem;color:#ccc;margin-left:.2rem">👻</span>':''}
          </div>
          <div class="text-muted-tiny">
            ${zoneLabel[m.zone]||m.zone||''} Lv.${m.level||m.recLv}
            · <span style="color:${rarityColor[m.rarity]||'var(--txt3)'}">${m.rarity||''}</span>
            · HP:${m.hp||'?'} ATK:${m.atk||'?'} DEF:${m.def||'?'} SPD:${m.spd||'?'}
            · 💰${m.gold}G
          </div>
        </div>
        <button class="btn-sm outline" style="font-size:.7rem;flex-shrink:0"
          onclick="openEditMonsterModal('${m.id}')">✏️</button>
      </div>`;
    }).join('')
    : `<div style="padding:1.5rem;text-align:center;color:var(--txt3);font-size:.82rem">조건에 맞는 몬스터가 없어요</div>`;
}

// ── 전투 밸런스 설정 로드/저장 ──────────────────────────────
function loadBattleSettings() {
  const bs = (DB.getSettings().customBattleSettings) || {};
  const nm = bs.normalMults || SKILL_MULTIPLIERS.normal;
  const el = bs.elementMults || SKILL_MULTIPLIERS.element;
  // 기본값 채우기
  document.getElementById('bs-daily-limit').value = bs.dailyBattleLimit ?? 3;
  document.getElementById('bs-infinite-limit').value = bs.infiniteBattleLimit ?? 1;
  document.getElementById('bs-ghost-mult').value  = bs.ghostNormalMult  ?? 0.55;
  document.getElementById('bs-adv-mult').value    = bs.elemChart?.advantageMult    ?? 1.4;
  document.getElementById('bs-dis-mult').value    = bs.elemChart?.disadvantageMult ?? 0.8;
  document.getElementById('bs-def-adv').value     = bs.defChart?.advantageMult     ?? 0.85;
  document.getElementById('bs-def-dis').value     = bs.defChart?.disadvantageMult  ?? 1.15;
  document.getElementById('bs-mon-hp-mult').value  = bs.monsterHpMult  ?? 1.0;
  document.getElementById('bs-mon-atk-mult').value = bs.monsterAtkMult ?? 1.0;
  [1,2,3,4,5,6,7].forEach(lv => {
    const el2 = document.getElementById(`bs-nm-${lv}`);
    if (el2) el2.value = nm[lv] ?? SKILL_MULTIPLIERS.normal[lv];
  });
  [0,1,2,3,4,5,6,7].forEach(lv => {
    const el2 = document.getElementById(`bs-el-${lv}`);
    if (el2) el2.value = el[lv] ?? SKILL_MULTIPLIERS.element[lv];
  });
}

// [BATTLE-SET-NAN-1] 칸 값 읽기. 빈 칸·글자는 기본값.
//   예전 `parseInt(무한배틀 칸) ?? 1` 은 NaN 을 못 걸러(?? 는 null/undefined 만) set 에 NaN 이 들어갔고,
//   SDK 가 "value argument contains NaN" 으로 **던져 전투 설정 저장이 통째로 실패**했다(칸을 지우고 저장하면).
//   zeroOk: 0 을 값으로 받는 칸(무한배틀 0회 = 막기). 나머지는 예전 `|| 기본값` 처럼 0 이하 → 기본값.
function battleNum(id, def, opts) {
  const int = !!(opts && opts.int), zeroOk = !!(opts && opts.zeroOk);
  const el = document.getElementById(id);
  const n = el ? (int ? parseInt(el.value, 10) : parseFloat(el.value)) : NaN;
  return Number.isFinite(n) && (zeroOk ? n >= 0 : n > 0) ? n : def;
}

function saveBattleSettings() {
  const db = DB.load();
  db.settings = db.settings || {};
  const normalMults = {};
  [1,2,3,4,5,6,7].forEach(lv => {
    normalMults[lv] = battleNum(`bs-nm-${lv}`, SKILL_MULTIPLIERS.normal[lv]);
  });
  const elementMults = {};
  [0,1,2,3,4,5,6,7].forEach(lv => {
    elementMults[lv] = battleNum(`bs-el-${lv}`, SKILL_MULTIPLIERS.element[lv]);
  });
  // [BATTLE-SET-1] 장비·스킬북 조정값(equipment·skillBooks)은 다른 화면이 같은 노드 아래 저장한다.
  //   통째로 새 객체를 만들면 set 이 그것들을 운영에서 지웠다 → 기존 값을 먼저 펼친다.
  db.settings.customBattleSettings = {
    ...(db.settings.customBattleSettings || {}),
    dailyBattleLimit:    battleNum('bs-daily-limit', 3, { int: true }),
    infiniteBattleLimit: battleNum('bs-infinite-limit', 1, { int: true, zeroOk: true }),
    ghostNormalMult:  battleNum('bs-ghost-mult', 0.55),
    monsterHpMult:    battleNum('bs-mon-hp-mult', 1.0),
    monsterAtkMult:   battleNum('bs-mon-atk-mult', 1.0),
    normalMults,
    elementMults,
    elemChart: {
      advantageMult:    battleNum('bs-adv-mult', 1.4),
      disadvantageMult: battleNum('bs-dis-mult', 0.8),
    },
    defChart: {
      advantageMult:    battleNum('bs-def-adv', 0.85),
      disadvantageMult: battleNum('bs-def-dis', 1.15),
    },
  };
  DB._cache = db;
  DB._fbRef.child('settings/customBattleSettings').set(db.settings.customBattleSettings);
  applyBattleSettings(db);
  notify('✅ 전투 설정 저장 완료! 학생 화면에 바로 반영돼요.');
}

// [BATTLE-RESET-KEEP-1] "기본값으로 초기화"는 **전투 배율만** 되돌린다.
//   예전엔 customBattleSettings 를 통째 remove 해서 하루 전투 횟수(운영 5 → 3)·무한배틀 횟수·장비·스킬북 조정까지 사라졌다.
const BATTLE_RESET_KEYS = ['ghostNormalMult', 'monsterHpMult', 'monsterAtkMult', 'normalMults', 'elementMults', 'elemChart', 'defChart'];
function resetBattleSettings() {
  if (!confirm('전투 배율(스킬 계수·상성·몬스터 체력/공격·유령 배율)을 기본값으로 되돌릴까요?\n\n하루 전투 횟수·무한배틀 횟수·장비·스킬북 조정은 그대로 둡니다.')) return;
  const db = DB.load();
  db.settings = db.settings || {};
  const cbs = db.settings.customBattleSettings || {};
  BATTLE_RESET_KEYS.forEach(k => { delete cbs[k]; });
  db.settings.customBattleSettings = cbs;
  DB._cache = db;
  DB._fbRef.child('settings/customBattleSettings').update(Object.fromEntries(BATTLE_RESET_KEYS.map(k => [k, null])));
  applyBattleSettings(db);
  loadBattleSettings();
  notify('🔄 전투 배율을 기본값으로 — 횟수·장비·스킬북은 그대로 (학생 화면은 새로고침 뒤 완전히 반영)');
}

// ── 장비 편집 ──────────────────────────────────────────
function renderEquipAdmin() {
  const slot = document.getElementById('eq-slot-filter')?.value || 'head';
  const items = GAME_DATA.equipment[slot] || [];
  const db = DB.load();
  const saved = ((db.settings||{}).customBattleSettings||{}).equipment || {};
  const el = document.getElementById('equip-admin-list');
  if (!el) return;
  const statNames  = {atk:'ATK',def:'DEF',mag:'MAG',spd:'SPD'};
  const condKeys   = ['read','study','art','value','health','life'];
  const condLabels = {read:'독서',study:'학습',art:'예술',value:'가치',health:'건강',life:'생활'};

  el.innerHTML = items.map(item => {
    const ov = saved[item.id] || {};
    // 현재 유효한 cond (오버라이드 우선)
    const currentCond = { ...item.cond, ...(ov.cond||{}) };

    const elemSelect = slot === 'body'
      ? `<select id="eq-el-${item.id}" class="form-select" style="width:70px;font-size:.72rem">
          <option value="">없음</option>
          <option value="fire"${(ov.element||item.element)==='fire'?' selected':''}>🔥불</option>
          <option value="water"${(ov.element||item.element)==='water'?' selected':''}>💧물</option>
          <option value="grass"${(ov.element||item.element)==='grass'?' selected':''}>🌿풀</option>
        </select>` : '';

    const statsHtml = Object.entries(item.stats).map(([k,v]) =>
      `<span class="text-muted-xs">${statNames[k]||k}:</span>
       <input type="number" id="eq-s-${item.id}-${k}" value="${ov.stats?.[k]??v}"
         style="width:50px;font-size:.72rem;padding:.12rem .25rem;border-radius:4px;
         background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:var(--txt);text-align:center">`
    ).join('');

    // cond 편집 (스탯별 조건값, 없으면 0)
    const condHtml = condKeys.map(k =>
      `<span style="font-size:.68rem;color:var(--sky)">${condLabels[k]}:</span>
       <input type="number" id="eq-c-${item.id}-${k}" value="${currentCond[k]||0}" min="0" max="30"
         style="width:40px;font-size:.70rem;padding:.12rem .2rem;border-radius:4px;
         background:rgba(52,152,219,.08);border:1px solid rgba(52,152,219,.2);color:var(--txt);text-align:center">`
    ).join('');

    return `<div style="padding:.6rem 1rem;border-bottom:1px solid rgba(255,255,255,.04)">
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;flex-wrap:wrap">
        <div style="font-size:1.1rem">${item.icon}</div>
        <div style="font-size:.82rem;font-weight:600;min-width:120px">${item.name}</div>
        <span class="text-muted-xs">가격:</span>
        <input type="number" id="eq-p-${item.id}" value="${ov.price??item.price}"
          style="width:62px;font-size:.72rem;padding:.12rem .25rem;border-radius:4px;
          background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:var(--txt);text-align:center">
        <span class="text-muted-xs">요구Lv:</span>
        <input type="number" id="eq-lv-${item.id}" value="${ov.lv??item.lv}" min="1" max="30"
          style="width:44px;font-size:.72rem;padding:.12rem .25rem;border-radius:4px;
          background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:var(--txt);text-align:center">
        ${statsHtml}
        ${elemSelect}
        <button class="btn-sm success" style="font-size:.66rem;padding:.18rem .45rem"
          onclick="saveEquipItem('${item.id}','${slot}')">저장</button>
      </div>
      <div style="display:flex;align-items:center;gap:.35rem;flex-wrap:wrap;
        background:rgba(52,152,219,.04);border-radius:6px;padding:.35rem .5rem">
        <span style="font-size:.68rem;font-weight:600;color:var(--sky);min-width:60px">구매조건:</span>
        ${condHtml}
      </div>
    </div>`;
  }).join('');
}

function saveEquipItem(itemId, slot) {
  const item = GAME_DATA.getItemById(itemId);
  if (!item) return;
  const db = DB.load();
  db.settings = db.settings || {};
  db.settings.customBattleSettings = db.settings.customBattleSettings || {};
  db.settings.customBattleSettings.equipment = db.settings.customBattleSettings.equipment || {};

  const patch = {
    price: parseInt(document.getElementById(`eq-p-${itemId}`)?.value) || item.price,
    lv:    parseInt(document.getElementById(`eq-lv-${itemId}`)?.value) || item.lv,
    stats: {},
    // ★ cond: 0값도 저장 (0 = 조건 없음으로 완전 교체)
    // applyBattleSettings에서 patch.cond로 원본 cond를 덮어씀
    cond: {},
  };

  // 전투 수치
  Object.keys(item.stats).forEach(k => {
    const v = parseFloat(document.getElementById(`eq-s-${itemId}-${k}`)?.value);
    if (!isNaN(v)) patch.stats[k] = v;
  });

  // 구매 조건 — 0값 포함 전부 저장 (0이면 해당 조건 제거 효과)
  ['read','study','art','value','health','life'].forEach(k => {
    const v = parseInt(document.getElementById(`eq-c-${itemId}-${k}`)?.value) || 0;
    patch.cond[k] = v; // 0 포함 저장
  });

  // body 속성
  if (slot === 'body') {
    const elVal = document.getElementById(`eq-el-${itemId}`)?.value;
    if (elVal !== undefined) patch.element = elVal;
  }

  db.settings.customBattleSettings.equipment[itemId] = patch;
  DB._cache = db;
  DB._fbRef.child(`settings/customBattleSettings/equipment/${itemId}`).set(patch);
  applyBattleSettings(db);
  notify(`✅ ${item.name} 수정 완료 (구매조건·속성 반영)`);
}

function resetEquipSettings() {
  // [RESET-SCOPE-1] 지우는 범위를 확인창에 적는다(장비 조정만 — 전투 배율·횟수·스킬북·상점 가격은 그대로)
  if (!confirm('장비 수치 조정을 모두 기본값으로 되돌릴까요?\n\n전투 배율·하루 전투 횟수·스킬북·상점 가격은 그대로 둡니다.')) return;
  const db = DB.load();
  db.settings = db.settings || {};
  db.settings.customBattleSettings = db.settings.customBattleSettings || {};
  delete db.settings.customBattleSettings.equipment;
  DB._cache = db;
  DB._fbRef.child('settings/customBattleSettings/equipment').remove();
  applyBattleSettings(db);
  renderEquipAdmin();
  notify('🔄 장비 수치 기본값으로 초기화');
}

// ── 마스터리북 편집 ─────────────────────────────────────────
function renderSkillBookAdmin() {
  const db = DB.load();
  const saved = ((db.settings||{}).customBattleSettings||{}).skillBooks || {};
  const el = document.getElementById('skillbook-admin-list');
  if (!el) return;
  const typeColor = {normal:'var(--gold)',fire:'#FF8A80',water:'#7ec8e3',grass:'#6fd49d'};
  const typeLabel = {normal:'⚔️ 기본',fire:'🔥 화염',water:'💧 냉기',grass:'🌿 자연'};

  el.innerHTML = ['normal','fire','water','grass'].map(type => {
    const books = SKILL_BOOKS.filter(b => b.type === type);
    return `<div style="padding:.6rem 1rem;border-bottom:1px solid rgba(255,255,255,.06)">
      <div style="font-size:.78rem;font-weight:700;color:${typeColor[type]};margin-bottom:.4rem">${typeLabel[type]}</div>
      ${books.map(book => {
        const ov = saved[book.id] || {};
        return `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem;flex-wrap:wrap">
          <div style="min-width:130px;font-size:.78rem">${book.name}</div>
          <span class="text-muted-xs">가격:</span>
          <input type="number" id="sb-p-${book.id}" value="${ov.price??book.price}"
            style="width:70px;font-size:.72rem;padding:.15rem .3rem;border-radius:4px;
            background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:var(--txt);text-align:center">
          <span class="text-muted-xs">플레이어 Lv:</span>
          <input type="number" id="sb-lv-${book.id}" value="${ov.reqPlayerLevel??book.reqPlayerLevel}" min="1" max="30"
            style="width:50px;font-size:.72rem;padding:.15rem .3rem;border-radius:4px;
            background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:var(--txt);text-align:center">
          <button class="btn-sm success" style="font-size:.66rem;padding:.18rem .45rem"
            onclick="saveSkillBook('${book.id}')">저장</button>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
}

function saveSkillBook(bookId) {
  const book = SKILL_BOOKS.find(b => b.id === bookId);
  if (!book) return;
  const db = DB.load();
  db.settings = db.settings || {};
  db.settings.customBattleSettings = db.settings.customBattleSettings || {};
  db.settings.customBattleSettings.skillBooks = db.settings.customBattleSettings.skillBooks || {};
  const patch = {
    price:          parseInt(document.getElementById(`sb-p-${bookId}`)?.value)  || book.price,
    reqPlayerLevel: parseInt(document.getElementById(`sb-lv-${bookId}`)?.value) || book.reqPlayerLevel,
  };
  db.settings.customBattleSettings.skillBooks[bookId] = patch;
  DB._cache = db;
  DB._fbRef.child(`settings/customBattleSettings/skillBooks/${bookId}`).set(patch);
  applyBattleSettings(db);
  notify(`✅ ${book.name} 수정 완료`);
}

function resetSkillBookSettings() {
  // [RESET-SCOPE-1] 지우는 범위를 확인창에 적는다(스킬북 조정만)
  if (!confirm('스킬북 조정을 모두 기본값으로 되돌릴까요?\n\n전투 배율·하루 전투 횟수·장비 수치는 그대로 둡니다.')) return;
  const db = DB.load();
  db.settings = db.settings || {};
  db.settings.customBattleSettings = db.settings.customBattleSettings || {};
  delete db.settings.customBattleSettings.skillBooks;
  DB._cache = db;
  DB._fbRef.child('settings/customBattleSettings/skillBooks').remove();
  applyBattleSettings(db);
  renderSkillBookAdmin();
  notify('🔄 스킬북 기본값으로 초기화');
}

// ── 도감 보상 ────────────────────────────────────────────
function loadDexSettings() {
  const ds = (DB.getSettings().dexRewards) || {};
  document.getElementById('dex-first-kill-on').checked = ds.firstKillEnabled ?? false;
  document.getElementById('dex-first-gold').value = ds.firstKillGold ?? 10;
  ['beginner','intermediate','advanced'].forEach(z => {
    document.getElementById(`dex-${z}-gold`).value  = ds[z]?.gold  ?? 0;   // 저장 전엔 구역 보상이 없었다 — 기본 0(첫 저장에 100G×3 이 몰래 켜지지 않게)
    document.getElementById(`dex-${z}-title`).value = ds[z]?.title ?? '';
  });
}

function saveDexSettings() {
  const db = DB.load();
  db.settings = db.settings || {};
  db.settings.dexRewards = {
    firstKillEnabled: document.getElementById('dex-first-kill-on').checked,
    firstKillGold:    Utils.intOr(document.getElementById('dex-first-gold').value, 10),   // [ZERO-OK-1]
    //  구역 보상은 금액이나 칭호가 있을 때만 적는다 — 0·빈칸으로 저장하면 그 구역을 '받음'으로만 표시하고 보상은 없는 채
    //  넘어가 버려(gamedata dexZoneClaimed_*), 나중에 보상을 정해도 이미 다 깬 아이는 못 받는다.
    ...Object.fromEntries(['beginner','intermediate','advanced'].map(z => {
      const gold = parseInt(document.getElementById(`dex-${z}-gold`).value) || 0, title = document.getElementById(`dex-${z}-title`).value;
      return [z, (gold > 0 || title) ? { gold, title } : null];
    })),
  };
  DB._cache = db;
  DB._fbRef.child('settings/dexRewards').set(db.settings.dexRewards);
  notify('✅ 도감 보상 설정 저장 완료');
}

// 전체 몬스터 목록 (커스텀 오버라이드 포함)
function getActiveMonsters() {
  const db = DB.load();
  const customs = db.customMonsters || {};
  return GAME_DATA.monsters.map(m => {
    const override = customs[m.id];
    return override ? { ...m, ...override, _custom: true } : m;
  }).concat(
    Object.values(customs).filter(c => c && c._new) // 새로 추가된 몬스터
  ).sort((a,b) => (a.recLv||0) - (b.recLv||0));
}

const MONSTER_ICONS = ['🟢','🐗','🐛','🐭','🐢','👺','🐺','🐱','🪲','👹',
  '🦊','🤖','💨','🧌','🕷️','🔥','🗿','⚡','🖤','🐉','🦁','🐻','🐯','🦅',
  '🦂','🐊','🦕','🦖','🦀','🐙','🦇','🐲','👾','💀','🧟','🧛','🧜'];

function openAddMonsterModal() {
  document.getElementById('m-monster-edit-title').textContent = '🐉 새 몬스터 추가';
  document.getElementById('me-id').value = 'cm_' + Date.now();
  document.getElementById('me-name').value = '';
  document.getElementById('me-name').disabled = false;
  document.getElementById('me-name').style.opacity = '1';
  document.getElementById('me-icon').value = '🐗';
  document.getElementById('me-icon').disabled = false;
  document.getElementById('me-icon').style.opacity = '1';
  document.getElementById('me-icon-picker').style.display = '';
  document.getElementById('me-lv').value = 5;
  document.getElementById('me-gold').value = 50;
  document.getElementById('me-exp').value = 40;
  document.getElementById('me-delete-btn').style.display = 'none';
  renderIconPicker();
  document.getElementById('m-monster-edit').classList.add('open');
}

function openEditMonsterModal(monId) {
  const m = getActiveMonsters().find(x => x.id === monId);
  if (!m) return;
  document.getElementById('m-monster-edit-title').textContent = `✏️ ${m.name} 편집`;
  document.getElementById('me-id').value   = m.id;
  document.getElementById('me-name').value = m.name;
  document.getElementById('me-icon').value = m.icon;
  // 기존 몬스터는 이름/아이콘 변경 불가 (도감/이미지 에셋이 id·이름 안정성에 의존)
  const isBase = !m._new;
  document.getElementById('me-name').disabled = isBase;
  document.getElementById('me-name').style.opacity = isBase ? '.5' : '1';
  document.getElementById('me-icon-picker').style.display = isBase ? 'none' : '';
  document.getElementById('me-icon').disabled = isBase;
  document.getElementById('me-icon').style.opacity = isBase ? '.5' : '1';
  document.getElementById('me-lv').value   = m.recLv;
  document.getElementById('me-gold').value = m.gold;
  document.getElementById('me-exp').value  = m.exp;
  // 커스텀이거나 새로 추가한 것만 삭제 가능
  const deletable = m._custom;
  document.getElementById('me-delete-btn').style.display = deletable ? '' : 'none';
  renderIconPicker(m.icon);
  document.getElementById('m-monster-edit').classList.add('open');
}

function renderIconPicker(selected) {
  const el = document.getElementById('me-icon-picker');
  el.innerHTML = MONSTER_ICONS.map(ic => `
    <button onclick="selectMonsterIcon('${ic}')"
      style="font-size:1.4rem;padding:.2rem .3rem;border-radius:6px;cursor:pointer;
        background:${ic===(selected||document.getElementById('me-icon').value)?'rgba(255,215,0,.2)':'rgba(255,255,255,.05)'};
        border:1px solid ${ic===(selected||document.getElementById('me-icon').value)?'var(--gold)':'rgba(255,255,255,.1)'}">${ic}</button>`
  ).join('');
}

function selectMonsterIcon(icon) {
  document.getElementById('me-icon').value = icon;
  renderIconPicker(icon);
}

function saveMonsterEdit() {
  const id   = document.getElementById('me-id').value;
  const name = document.getElementById('me-name').value.trim();
  const icon = document.getElementById('me-icon').value.trim();
  if (!name) { notify('몬스터 이름을 입력해주세요', 'error'); return; }
  if (!icon) { notify('아이콘을 선택해주세요', 'error'); return; }

  const db = DB.load();
  db.customMonsters = db.customMonsters || {};

  const isNew = id.startsWith('cm_');
  db.customMonsters[id] = {
    id,
    name,
    icon,
    recLv: parseInt(document.getElementById('me-lv').value)||1,
    gold:  Utils.intOr(document.getElementById('me-gold').value, 30),   // [ZERO-OK-1] 0 은 0
    exp:   Utils.intOr(document.getElementById('me-exp').value, 25),
    _custom: true,
    _new: isNew,
  };

  DB._cache = db;
  DB._fbRef.child('customMonsters').set(db.customMonsters);
  closeMonsterModal();
  renderMonsters();
  notify(`✅ ${name} ${isNew?'추가':'수정'} 완료!`);
}

function deleteCustomMonster() {
  const id = document.getElementById('me-id').value;
  const db = DB.load();
  db.customMonsters = db.customMonsters || {};
  delete db.customMonsters[id];
  DB._cache = db;
  DB._fbRef.child('customMonsters').set(db.customMonsters);
  closeMonsterModal();
  renderMonsters();
  notify('몬스터 삭제 완료');
}

// [RESET-SCOPE-1] 기본 몬스터의 수치 조정만 되돌린다. 선생님이 **새로 만든 몬스터(_new)** 는 남긴다.
//   예전엔 customMonsters 를 통째 {} 로 set 해서 새로 만든 몬스터까지 지웠다. 이제 지울 id 만 update(null).
function resetCustomMonsters() {
  const db = DB.load();
  const customs = db.customMonsters || {};
  const edits = Object.keys(customs).filter(id => customs[id] && !customs[id]._new);
  const added = Object.keys(customs).length - edits.length;
  if (!edits.length) { notify('되돌릴 기본 몬스터 조정이 없어요'); return; }
  if (!confirm(`기본 몬스터 ${edits.length}마리의 수치 조정을 되돌릴까요?\n\n새로 만든 몬스터 ${added}마리는 그대로 둡니다.`)) return;
  edits.forEach(id => { delete customs[id]; });
  db.customMonsters = customs;
  DB._cache = db;
  DB._fbRef.child('customMonsters').update(Object.fromEntries(edits.map(id => [id, null])));
  renderMonsters();
  notify(`🔄 기본 몬스터 ${edits.length}마리 되돌림 · 새로 만든 몬스터는 그대로`);
}

function closeMonsterModal() {
  document.getElementById('m-monster-edit').classList.remove('open');
}

