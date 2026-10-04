// student/battle.js — 몬스터 · 사냥터 · 전투(보스는 student.js)
//  student.js 에서 떼어 옮긴 클래식 스크립트 [SPLIT-1] — 글자 그대로 · 전역 그대로 · student.html 에서 student.js 바로 뒤에 부른다.
// ── [SPLIT-1] 'battle' — 원래 student.js 2535~4244줄 ──
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
  document.getElementById('battle-title').textContent = BV2_ZONE[mon.zone] || '사냥터';

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

// ══ [BATTLE-V2] 무대형 배틀 화면 ══════════════════════════════════════
//  계산·저장·횟수는 그대로(gamedata.js 엔진 · startBattle · _finishBattle · finalizeBattle · 무한배틀 규칙). 그리는 것만 새로.
//  무대는 전투(BATTLE_STATE)마다 한 번 그리고, 차례마다는 체력·차례·단추·소식만 바꾼다 — 등장 연출이 다시 돌지 않게.
//  크롬북 1366×610 에서 스크롤 없이: 위 띠 46 · 무대 · 아래 행동판. 업적은 결과 카드 안 한 줄(위에 덮지 않음).
const BV2_ZONE = { beginner: '초급 사냥터', intermediate: '중급 사냥터', advanced: '고급 사냥터' };
const BV2_EL = { fire: { name: '불꽃', c: '#FF9A7A' }, water: { name: '냉기', c: '#8fd3ff' }, grass: { name: '자연', c: '#7fe08f' } };
const BV2_ATK = {
  normal: { t: '일반 공격', c: '#F2D27C', g: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/>' },
  fire:   { t: '화염 공격', c: '#FF7A45', g: '<path d="M12 22c4.4 0 7-2.9 7-6.6 0-3.2-2-5.6-4-7.6.2 2-1 3.4-2.3 3.4C11.4 11.2 11 9 12.5 6 9 7.5 5 11 5 15.4 5 19.1 7.6 22 12 22z"/>' },
  water:  { t: '냉기 공격', c: '#5CC8FF', g: '<path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11"/><path d="M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5"/>' },
  grass:  { t: '자연 공격', c: '#5FD27A', g: '<path d="M5 19C5 10 11 4 20 4c0 9-6 15-15 15z"/><path d="M5 19 13 11"/>' },
};
const BV2_SK = {
  heal:     { t: '응급치료',   d: '체력 30% 회복',    g: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>' },
  guard:    { t: '방어',       d: '받는 피해 절반',   g: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z"/>' },
  counter:  { t: '최후의 반격', d: '체력 40% 아래일 때', g: '<path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5"/>' },
  prep:     { t: '일격 준비',   d: '다음 공격 ×2.3',   g: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/>' },
  reckless: { t: '무리한 공격', d: '반반 확률 ×2.2',   g: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>' },
  rush:     { t: '몰아치기',   d: '2턴 공격력↑',      g: '<path d="m5 6 6 6-6 6M13 6l6 6-6 6"/>' },
};
const _bv2Svg = (d, s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
// 받침에 맞는 조사 — '슬라임이' · '골렘이' · '박쥐가'
function _bv2Jong(w) { const s = String(w || ''), c = s.charCodeAt(s.length - 1); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0; }
const _bv2J = (w, a, b) => String(w) + (_bv2Jong(w) ? a : b);
// 엔진 기록 한 줄 → 소식 글: 태그 · 앞 그림문자를 빼고 '이(가)' 같은 조사를 받침에 맞게
function _bv2Text(html) {
  let t = String(html || '').replace(/<[^>]+>/g, '').replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '').trim();
  return t.replace(/([가-힣A-Za-z0-9]+)(이\(가\)|을\(를\)|은\(는\)|와\(과\))/g, (m, w, p) => { const [a, b] = p.replace(')', '').split('('); return w + (_bv2Jong(w) ? a : b); });
}
function _bv2Expect(type, s) {   // [BATTLE-V2] 이 공격의 예상 피해 — 계산식은 엔진(calculatePlayerDamage)과 같고 급소·빗나감만 뺀다
  const mon = s.monster, ps = s.playerStats || {}, lv = (s.skillLevels || {})[type] || 0;
  if (type !== 'normal' && lv < 1) return 0;
  const tab = type === 'normal' ? SKILL_MULTIPLIERS.normal : SKILL_MULTIPLIERS.element;
  const stat = type === 'normal' ? (ps.atk || 0) : (ps.mag || 0);
  const gap = (mon.level || mon.recLv || 1) - (ps.level || 1);
  const lvMult = gap > 0 ? Math.max(BALANCE.playerAttack.levelGap.floor, 1 - gap * BALANCE.playerAttack.levelGap.perLevel) : 1;
  const d = stat * (tab[Math.min(lv, BALANCE.skill.maxLevel)] || 1) * (BALANCE.damage.defScale / (BALANCE.damage.defScale + (mon.def || 0)))
    * getElementMultiplier(type, mon.element) * getTraitMultiplier(mon, type) * lvMult;
  return Math.max(BALANCE.damage.minDamage, Math.round(d));
}
function _bv2Match(type, mon) {   // 공격 속성이 이 몬스터에게 강한가(관리자 상성표를 따르는 ELEMENT_CHART 그대로)
  if (!mon || type === 'normal' || !mon.element || typeof ELEMENT_CHART === 'undefined') return 1;
  return (ELEMENT_CHART[type] && ELEMENT_CHART[type][mon.element]) || 1;
}
function _bv2StageHTML(s, mon) {
  const zone = BV2_ZONE[mon.zone] ? mon.zone : 'beginner';
  const el = BV2_EL[mon.element];
  const rar = s.ibRarity === 'legend' ? '<span class="bv2-tag gold">전설</span>' : s.ibRarity === 'rare' ? '<span class="bv2-tag rare">희귀</span>' : '';
  const hp = k => `<div class="bv2-hp ${k}"><i class="trail"></i><i class="fill"></i></div>`;
  return `<div class="bv2-stage" data-zone="${zone}" id="bv2-stage">
    <div class="bv2-bg bv2-sky"></div>
    <div class="bv2-bg bv2-far"><svg viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 210 C140 120 260 150 380 170 S620 90 760 140 1020 110 1200 160 V300 H0Z" fill="var(--bv2-h1)" opacity=".75"/>
      <path d="M0 250 C160 190 300 220 460 230 S760 170 920 210 1100 200 1200 220 V300 H0Z" fill="var(--bv2-h2)" opacity=".85"/>
      <path d="M0 285 C200 250 420 270 600 265 S980 245 1200 268 V300 H0Z" fill="var(--bv2-h3)"/></svg></div>
    <div class="bv2-deco" aria-hidden="true"><svg viewBox="0 0 1200 430" preserveAspectRatio="xMidYMax slice">
      <g class="z zb"><g opacity=".62"><rect x="173" y="226" width="9" height="46" rx="3" fill="#5b4632"/><circle cx="160" cy="214" r="26" fill="#4f9a4f"/><circle cx="196" cy="206" r="30" fill="#5aa957"/><circle cx="178" cy="186" r="26" fill="#6bb862"/>
        <rect x="1003" y="222" width="10" height="50" rx="3" fill="#5b4632"/><circle cx="988" cy="210" r="30" fill="#4f9a4f"/><circle cx="1028" cy="202" r="33" fill="#5aa957"/><circle cx="1008" cy="178" r="29" fill="#6bb862"/>
        <circle cx="250" cy="258" r="16" fill="#58a654"/><circle cx="266" cy="262" r="12" fill="#4f9a4f"/><circle cx="1066" cy="258" r="15" fill="#58a654"/></g>
        <g fill="#fff" opacity=".75"><ellipse cx="300" cy="70" rx="58" ry="16"/><ellipse cx="336" cy="62" rx="36" ry="18"/><ellipse cx="860" cy="96" rx="70" ry="15"/><ellipse cx="900" cy="88" rx="40" ry="17"/></g></g>
      <g class="z zi" opacity=".7"><path d="M120 270 150 150 178 270Z M200 270 214 196 232 270Z M960 270 992 132 1024 270Z M1044 270 1060 200 1078 270Z" fill="#3a1610"/>
        <g fill="#ffb26b" opacity=".75"><circle cx="420" cy="120" r="2.4"/><circle cx="640" cy="80" r="2"/><circle cx="760" cy="150" r="2.6"/><circle cx="540" cy="190" r="1.8"/><circle cx="880" cy="60" r="2.2"/></g></g>
      <g class="z za"><g fill="#fff"><circle cx="120" cy="60" r="1.6"/><circle cx="260" cy="110" r="1.2"/><circle cx="420" cy="40" r="1.8"/><circle cx="560" cy="90" r="1.1"/><circle cx="700" cy="50" r="1.5"/><circle cx="820" cy="120" r="1.2"/><circle cx="1080" cy="80" r="1.7"/><circle cx="340" cy="170" r="1"/><circle cx="640" cy="150" r="1.2"/></g>
        <path d="M985 70a36 36 0 1 0 30 56 30 30 0 1 1-30-56z" fill="#f4ecff" opacity=".85"/>
        <g fill="#15133a" opacity=".85"><rect x="150" y="160" width="26" height="110"/><rect x="140" y="150" width="46" height="12"/><rect x="1010" y="170" width="24" height="100"/><rect x="1000" y="160" width="44" height="12"/></g></g>
    </svg></div>
    <div class="bv2-bg bv2-ground"></div>
    <div class="bv2-spot me"></div><div class="bv2-spot foe"></div>
    <div class="bv2-bg bv2-light"></div><div class="bv2-bg bv2-vig"></div>
    <div class="bv2-plate me"><div class="bv2-prow"><b>${escHtml(CUR.name || '나')}</b><span>Lv.${CUR.level || 1}</span></div>${hp('me')}<div class="bv2-pnum"><span>체력</span><b class="bv2-hpn-me"></b></div></div>
    <div class="bv2-plate foe"><div class="bv2-prow"><b>${escHtml(mon.name)}</b><span>Lv.${mon.level || 1}</span>${rar}${el ? `<span class="bv2-tag" style="color:${el.c}">${el.name}</span>` : ''}${mon.trait === 'ghost' ? '<span class="bv2-tag">유령</span>' : ''}</div>${hp('foe')}<div class="bv2-pnum"><span></span><b class="bv2-hpn-foe"></b></div></div>
    <div class="bv2-turn" id="bv2-turn"></div>
    <div class="bv2-fighter me idle" id="ba-char-emoji">${charSVG(CUR)}</div>
    <div class="bv2-fighter foe idle" id="ba-mon-emoji">${iconImg(mon, 'monsters', '100%')}</div>
    <div class="bv2-fx" id="bv2-fx"></div>
    <div class="bv2-banner" id="bv2-banner"></div>
    <div class="bv2-ticker" id="ba-log"></div>
    <div class="bv2-result" id="bv2-result"></div>
  </div>
  <div class="bv2-actions" id="bv2-actions"><div class="bv2-atk-row" id="bv2-atk-row"></div><div class="bv2-sk-row" id="bv2-sk-row"></div></div>`;
}
// 체력바: 채움은 바로, 깎인 자리 잔상은 조금 늦게
function _updateBattleHpBars(state) {
  const st = state || BATTLE_STATE; if (!st) return;
  const set = (k, hp, max) => {
    const bar = document.querySelector('.bv2-hp.' + k); if (!bar) return;
    const pct = Math.max(0, Math.min(100, hp / Math.max(1, max) * 100));
    bar.classList.toggle('low', pct <= 30);
    bar.querySelector('.fill').style.width = pct + '%'; bar.querySelector('.trail').style.width = pct + '%';
    const n = document.querySelector('.bv2-hpn-' + k); if (n) n.textContent = `${Math.max(0, hp)} / ${max}`;
  };
  set('me', st.playerHp, st.playerHpMax); set('foe', st.monsterHp, st.monsterHpMax);
}
function _bv2Turn() {
  const s = BATTLE_STATE, t = document.getElementById('bv2-turn'); if (!s || !t) return;
  const mine = s.turn === 'player', txt = s.finished ? '' : mine ? '내 차례' : `${s.monster.name} 차례`;
  if (t.textContent === txt) return;
  t.textContent = txt; t.classList.toggle('foe-turn', !mine); t.classList.toggle('off', !txt);
  t.classList.remove('swap'); void t.offsetWidth; t.classList.add('swap');
}
function _bv2Actions() {
  const s = BATTLE_STATE, mon = s && s.monster;
  const row = document.getElementById('bv2-atk-row'), sk = document.getElementById('bv2-sk-row'), box = document.getElementById('bv2-actions');
  if (!s || !row || !sk) return;
  box.classList.toggle('done', !!s.finished);
  const myTurn = !s.finished && s.turn === 'player', reck = BATTLE_MENU === 'reckless';
  const types = [...new Set((CUR.equippedSkills || ['normal', null, null, null]).filter(Boolean))];
  const list = types.length ? types : ['normal'];
  row.style.setProperty('--n', list.length);
  // 상성만 보면 '강한' 공격이 실제로는 더 약할 수 있다(일반 = 공격력, 속성 = 마력) → 예상 피해로 정직하게
  const exp = Object.fromEntries(list.map(t => [t, _bv2Expect(t, s)]));
  const top = Math.max(...Object.values(exp));
  row.innerHTML = list.map(type => {
    const a = BV2_ATK[type] || BV2_ATK.normal, lv = (s.skillLevels || {})[type] || 0, can = lv >= 1, m = _bv2Match(type, mon);
    const badge = can && exp[type] === top && list.filter(t => exp[t] === top).length === 1 && list.length > 1 ? '<span class="bv2-badge">가장 세요</span>' : '';
    const why = !can ? '' : m > 1 ? ' · 상성 좋음' : m < 1 ? ' · 상성 나쁨' : '';
    const go = reck ? `doReckless('${type}')` : `doAttack('${type}')`;
    return `<button class="bv2-atk" style="--ec:${a.c}" ${can && myTurn ? '' : 'disabled'} onclick="BATTLE_MENU='main';${go}">${badge}
      <span class="bv2-gl">${_bv2Svg(a.g, 26)}</span><span><span class="bv2-at">${a.t}</span><span class="bv2-as">${can ? '예상 ' + exp[type] + why : '아직 못 배웠어요'}</span></span></button>`;
  }).join('');
  sk.innerHTML = reck ? '<div class="bv2-hint">무리한 공격 — 어떤 공격으로 할까요?</div>'
    : (s.equippedSkill2 || []).filter(Boolean).map(id => {
      const k = BV2_SK[id]; if (!k) return '';
      const used = !!(s.skill2Used && s.skill2Used[id]), cond = id === 'counter' && s.playerHp / s.playerHpMax > 0.4;
      return `<button class="bv2-sk" ${used || cond || !myTurn ? 'disabled' : ''} onclick="doSkill2('${id}')">${_bv2Svg(k.g, 17)}${k.t}<small>${used ? '썼어요' : k.d}</small></button>`;
    }).join('');
}
function _bv2Say(html) { const t = document.getElementById('ba-log'); if (t) t.innerHTML = html; }
function _updateBattleLog(state) {   // 엔진 기록의 마지막 줄을 소식 한 줄로(글은 escHtml 거친 엔진 문장)
  const st = state || BATTLE_STATE; if (!st || !st.log.length) return;
  _bv2Say(escHtml(_bv2Text(st.log[st.log.length - 1])));
}
// ── 효과: 번쩍 · 밀림 · 흔들림 · 파편 · 숫자
function _bv2El(k) { return document.getElementById(k === 'me' ? 'ba-char-emoji' : 'ba-mon-emoji'); }
function _bv2At(k) {
  const el = _bv2El(k), st = document.getElementById('bv2-stage'); if (!el || !st) return { x: 0, y: 0 };
  const r = el.getBoundingClientRect(), s = st.getBoundingClientRect();
  return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height * 0.42 };
}
function _bv2Fx() { return document.getElementById('bv2-fx'); }
function _bv2Burst(k, color, n, big) {
  const fx = _bv2Fx(); if (!fx || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const at = _bv2At(k);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = (big ? 110 : 70) + Math.random() * 60, sp = document.createElement('i');
    sp.className = 'bv2-spark';
    sp.style.cssText = `left:${at.x}px;top:${at.y}px;--c:${color};--s:${5 + Math.random() * 7}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 20}px`;
    fx.appendChild(sp); setTimeout(() => sp.remove(), 650);
  }
  const ring = document.createElement('i'); ring.className = 'bv2-ring'; ring.style.cssText = `left:${at.x}px;top:${at.y}px;--c:${color}`;
  fx.appendChild(ring); setTimeout(() => ring.remove(), 500);
}
function _bv2Num(k, text, o) {
  const fx = _bv2Fx(); if (!fx) return; o = o || {};
  const at = _bv2At(k), n = document.createElement('div');
  n.className = 'bv2-num' + (o.crit ? ' crit' : '') + (o.small ? ' small' : '');
  n.style.cssText = `left:${at.x + (Math.random() * 30 - 15)}px;top:${at.y - 30}px;--o:${o.outline || '#5a2410'}`;
  n.innerHTML = (o.tag ? `<span class="tag">${escHtml(o.tag)}</span>` : '') + escHtml(String(text));
  fx.appendChild(n); setTimeout(() => n.remove(), 1000);
}
function _bv2Chip(k, text, bg) {
  const fx = _bv2Fx(); if (!fx) return;
  const at = _bv2At(k), c = document.createElement('div');
  c.className = 'bv2-chip'; c.style.cssText = `left:${at.x}px;top:${at.y - 110}px;--b:${bg}`; c.textContent = text;
  fx.appendChild(c); setTimeout(() => c.remove(), 1250);
}
function _bv2Shake(big) {
  const st = document.getElementById('bv2-stage'); if (!st) return;
  st.classList.remove('shake', 'shake-big'); void st.offsetWidth; st.classList.add(big ? 'shake-big' : 'shake');
}
function _bv2Hit(k) { const el = _bv2El(k); if (!el) return; el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
function _bv2Dash(k) {
  const el = _bv2El(k); if (!el) return;
  el.classList.remove('idle'); el.classList.add('dash');
  setTimeout(() => { el.classList.remove('dash'); el.classList.add('idle'); }, 190);
}
function _bv2Banner(text, lose) {
  const b = document.getElementById('bv2-banner'); if (!b) return;
  b.className = 'bv2-banner' + (lose ? ' lose' : ''); b.textContent = text; void b.offsetWidth; b.classList.add('show');
}
function _bv2Result(html) {
  const r = document.getElementById('bv2-result'), st = document.getElementById('bv2-stage'); if (!r) return;
  r.innerHTML = html; st && st.classList.add('done');
  const b = document.getElementById('bv2-banner'); b && b.classList.add('up');
  setTimeout(() => {
    r.classList.add('show');
    r.querySelectorAll('[data-count]').forEach(el => {
      const to = +el.dataset.count || 0, t0 = performance.now();
      const f = t => { const k = Math.min(1, (t - t0) / 700); el.textContent = '+' + Math.round(to * (1 - Math.pow(1 - k, 3))) + 'G'; if (k < 1) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    });
    r.querySelectorAll('.bv2-bar i').forEach(i => { i.style.width = i.dataset.w || '0%'; });
  }, 180);
}
// 무대 첫 그림 — 몬스터가 들어오고, 몬스터가 먼저였으면 그 한 대를 보여 준 뒤 숫자를 맞춘다
function _bv2Enter(s) {
  const mon = s.monster, foe = _bv2El('foe');
  if (foe && foe.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches)
    foe.animate([{ transform: 'translateX(140px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.2,.9,.3,1)' });
  const first = s.firstTurn === 'monster' && s.lastMonsterAction && !s.lastPlayerAction;
  if (s.ibRarity === 'legend' || s.ibRarity === 'rare') setTimeout(() => _bv2Chip('foe', s.ibRarity === 'legend' ? '전설 몬스터 등장!' : '희귀 몬스터 등장!', '#F6D27A'), 520);
  if (!first) { _bv2Say(`${_bv2J(mon.name, '이', '가')} 나타났어요!${s.firstTurn === 'player' ? ' 내가 먼저예요' : ''}`); return; }
  const ma = s.lastMonsterAction, hp = s.playerHp;
  s.playerHp = Math.min(s.playerHpMax, hp + (ma.dmg || 0)); _updateBattleHpBars(s); s.playerHp = hp;   // 맞기 전 숫자로 잠깐
  _bv2Say(`${_bv2J(mon.name, '이', '가')} 먼저 덤벼요!`);
  setTimeout(() => {
    _bv2Dash('foe');
    setTimeout(() => {
      if (ma.miss) _bv2Num('me', '피했어요!', { small: true });
      else { _bv2Hit('me'); _bv2Shake(false); _bv2Num('me', ma.dmg, { outline: '#6a1010' }); }
      _updateBattleHpBars(s);
    }, 200);
  }, 700);
}
// 화면: 같은 전투면 바뀐 것만, 새 전투(또는 무한배틀 다음 몬스터)면 무대부터
function renderBattleNew() {
  const s = BATTLE_STATE; if (!s) return;
  const mon = s.monster, arenaEl = document.getElementById('battle-arena'); if (!arenaEl) return;
  if (!s._v2key) s._v2key = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  if (arenaEl.dataset.bv2 !== s._v2key || !document.getElementById('bv2-stage')) {
    arenaEl.dataset.bv2 = s._v2key;
    arenaEl.innerHTML = _bv2StageHTML(s, mon);
    _updateBattleHpBars(s); _bv2Enter(s);
  } else _updateBattleHpBars(s);
  _bv2Turn(); _bv2Actions();
  const subEl = document.getElementById('battle-sub');
  if (subEl && !s.isInfinite) subEl.textContent = `오늘 남은 도전 ${Utils.monsterAttemptsLeft(CUR)}번`;
  if (s.finished && !s.isInfinite) _bv2End();
}
// ── 끝: 이겼을 때 · 졌을 때(한 번만)
function _bv2End() {
  const s = BATTLE_STATE; if (!s || s._v2ended) return; s._v2ended = true;
  const mon = s.monster, me = _bv2El('me'), foe = _bv2El('foe');
  if (s.win) {
    setTimeout(() => { if (foe) { foe.classList.remove('idle'); foe.classList.add('down'); } _bv2Burst('foe', '#ffe7a0', 24, true); }, 250);
    setTimeout(() => { _bv2Banner('승리!'); _bv2Say(`${_bv2J(mon.name, '을', '를')} 물리쳤어요!`); }, 850);
    setTimeout(() => _bv2Result(_bv2WinCard(s, mon)), 1650);
  } else {
    setTimeout(() => { if (me) { me.classList.remove('idle'); me.classList.add('down'); } }, 120);
    setTimeout(() => { _bv2Banner('아쉬워요', true); _bv2Say('다음엔 이길 수 있어요'); }, 520);
    setTimeout(() => _bv2Result(_bv2LoseCard(s, mon)), 1150);
  }
}
function _bv2AchRows(list) {
  return (list || []).map(a => `<div class="bv2-ri ach">업적 달성 — ${escHtml(a.name)}<b>+${(a.reward && a.reward.gold) || 20}G${a.reward && a.reward.exp ? ' · +' + a.reward.exp + 'EXP' : ''}</b></div>`).join('');
}
function _bv2Again(left) {
  return left > 0 ? `<button onclick="closeBattle();openMonsterModal()">다른 몬스터와 (남은 ${left}번)</button>` : '';
}
function _bv2WinCard(s, mon) {
  const zm = GAME_DATA.monsters.filter(m => m.zone === mon.zone), log = CUR.monsterLog || [];
  const seen = zm.filter(m => log.includes(m.id)).length, all = zm.length || 1;
  const rows = [`<div class="bv2-ri">골드<b data-count="${mon.gold || 0}">+0G</b></div>`];
  (s._v2dex || []).forEach(b => {
    if (b.type === 'firstKill') rows.push(`<div class="bv2-ri">처음 만난 몬스터 보너스<b>+${b.gold}G</b></div>`);
    if (b.type === 'zoneComplete') rows.push(`<div class="bv2-ri ach">도감 완성!${b.title ? ' · ' + escHtml(b.title) : ''}<b>+${b.gold}G</b></div>`);
  });
  if (BV2_ZONE[mon.zone]) rows.push(`<div class="bv2-ri">${BV2_ZONE[mon.zone]} 도감<span class="bv2-bar"><i data-w="${Math.round(seen / all * 100)}%"></i></span><b>${seen} / ${zm.length}</b></div>`);
  return `<div class="bv2-rh">${iconImg(mon, 'monsters', '56px')}<div><div class="bv2-rt">${escHtml(_bv2J(mon.name, '을', '를'))} 물리쳤어요!</div><div class="bv2-rs">남은 체력 ${s.playerHp} / ${s.playerHpMax}</div></div></div>
    <div class="bv2-rl">${rows.join('')}${_bv2AchRows(s._v2ach)}</div>
    <div class="bv2-rb">${_bv2Again(Utils.monsterAttemptsLeft(CUR))}<button class="pri" onclick="closeBattle()">확인</button></div>`;
}
function _bv2LoseCard(s, mon) {   // 귀띔은 예상 피해로(상성만 보면 틀릴 수 있다 — 일반=공격력, 속성=마력)
  const worn = [...new Set((CUR.equippedSkills || ['normal']).filter(Boolean))];
  const all = ['normal', 'fire', 'water', 'grass'].map(t => ({ t, e: _bv2Expect(t, s), learned: t === 'normal' || ((s.skillLevels || {})[t] || 0) >= 1, worn: worn.includes(t) }));
  const bestWorn = all.filter(a => a.worn && a.learned).sort((a, b) => b.e - a.e)[0] || all[0];
  const better = all.filter(a => a.learned && !a.worn && a.e > bestWorn.e).sort((a, b) => b.e - a.e)[0];
  const tip = better
    ? `이 몬스터에게는 <b>${BV2_ATK[better.t].t}</b>(예상 ${better.e})이 가장 세요. 가방의 스킬 칸에 끼워 보세요.`
    : `이 몬스터에게 가장 센 공격은 <b>${BV2_ATK[bestWorn.t].t}</b>(예상 ${bestWorn.e})이에요. 체력이 반쯤 남았을 때 <b>응급치료</b>를 쓰면 더 오래 버텨요.`;
  return `<div class="bv2-rh">${iconImg(mon, 'monsters', '56px')}<div><div class="bv2-rt">${escHtml(_bv2J(mon.name, '이', '가'))} 이번엔 더 셌어요</div><div class="bv2-rs">남긴 체력 ${Math.max(0, s.monsterHp)} / ${s.monsterHpMax} · 쓴 기회는 1번이에요</div></div></div>
    <div class="bv2-tip">${tip}</div>${s._v2ach && s._v2ach.length ? `<div class="bv2-rl">${_bv2AchRows(s._v2ach)}</div>` : ''}
    <div class="bv2-rb">${_bv2Again(Utils.monsterAttemptsLeft(CUR))}<button class="pri" onclick="closeBattle()">확인</button></div>`;
}
// 무한배틀: 한 마리 처치(다음 몬스터가 들어오기 전 잠깐)
function _bv2IbKill(gold, heal, last) {
  const foe = _bv2El('foe');
  if (foe) { foe.classList.remove('idle'); foe.classList.add('down'); }
  _bv2Burst('foe', '#ffe7a0', 18, true);
  _bv2Chip('foe', `처치! +${gold}G`, '#F6D27A');
  _bv2Say(last ? '10마리를 모두 물리쳤어요!' : `체력 +${heal} · 다음 몬스터가 오고 있어요`);
  document.getElementById('bv2-actions')?.classList.add('done');
}
function _bv2IbEndHTML(forfeit, isNewBest, best, ach) {
  return `<div class="bv2-rh"><div class="bv2-rbig">${IB.kills}</div><div><div class="bv2-rt">무한배틀 끝${forfeit ? ' (그만둠)' : ''} — ${IB.kills}마리 처치</div><div class="bv2-rs">${BV2_ZONE[IB.zone] || ''}</div></div></div>
    <div class="bv2-rl"><div class="bv2-ri">모은 골드<b data-count="${IB.gold}">+0G</b></div>
      <div class="bv2-ri${isNewBest ? ' ach' : ''}">${isNewBest ? '최고 기록 새로!' : '최고 기록'}<b>${best}마리</b></div>${_bv2AchRows(ach)}</div>
    <div class="bv2-rb"><button class="pri" onclick="closeModal('m-battle');renderMain();renderMobile()">확인</button></div>`;
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

// ── 공격 버튼 클릭 ── [BATTLE-V2] 계산 순서는 그대로(performPlayerTurn → 맞힘 → 끝났나 · 몬스터 차례), 연출만 새로
function doAttack(attackType) {
  if (!BATTLE_STATE || BATTLE_STATE.finished || BATTLE_STATE.turn !== 'player') return;
  document.querySelectorAll('#battle-arena button').forEach(b => b.disabled = true);
  BATTLE_STATE = performPlayerTurn(BATTLE_STATE, attackType);
  const pa = BATTLE_STATE.lastPlayerAction, mon = BATTLE_STATE.monster;
  const a = BV2_ATK[attackType] || BV2_ATK.normal;
  const isCrit = pa.crit, isHeavy = isCrit || (pa.skill2Label && pa.skill2Label.includes('일격'));
  _bv2Dash('me');
  setTimeout(() => {
    if (pa.miss) {
      _bv2Num('foe', '빗나감', { small: true }); _bv2Say('공격이 빗나갔어요!');
      _updateBattleHpBars(BATTLE_STATE);
      setTimeout(() => _doMonsterTurn(), 650);
      return;
    }
    setTimeout(() => {   // 맞는 순간 아주 잠깐 멈춤(급소는 더 길게)
      _bv2Hit('foe'); _bv2Shake(isCrit); _bv2Burst('foe', a.c, isCrit ? 22 : 14, isCrit);
      _bv2Num('foe', pa.dmg, { crit: isCrit, tag: isCrit ? '급소!' : '', outline: isCrit ? '#8a5a00' : '#5a2410' });
      if (pa.isGhost) _bv2Chip('foe', '유령이라 덜 아파요', '#cfc8d8');
      else if (pa.elemMult > 1) _bv2Chip('foe', '효과가 굉장해요!', '#F6D27A');
      else if (pa.elemMult < 1) _bv2Chip('foe', '효과가 별로예요', '#bcae9a');
      _bv2Say(`${escHtml(mon.name)}에게 <span class="hl">${pa.dmg}</span> 피해${isCrit ? ' · 급소!' : ''}${pa.elemMult > 1 ? ' · 상성이 좋아요' : ''}`);
      _updateBattleHpBars(BATTLE_STATE);
      if (BATTLE_STATE.finished) setTimeout(() => _finishBattle(), isHeavy ? 550 : 450);
      else setTimeout(() => _doMonsterTurn(), isHeavy ? 800 : 700);
    }, isCrit ? 130 : 50);
  }, 190);
}

// ── 몬스터 턴 실행 (doAttack/doSkill2/doReckless 공통)
function _doMonsterTurn() {
  if (!BATTLE_STATE || BATTLE_STATE.finished) return;
  const before = BATTLE_STATE.log.length;
  BATTLE_STATE = performMonsterTurn(BATTLE_STATE);
  const ma = BATTLE_STATE.lastMonsterAction, mon = BATTLE_STATE.monster;
  const extra = BATTLE_STATE.log.slice(before).map(_bv2Text).join(' ');
  const t = document.getElementById('bv2-turn');
  if (t) { t.textContent = `${mon.name} 차례`; t.classList.add('foe-turn'); t.classList.remove('off'); }
  setTimeout(() => {
    _bv2Dash('foe');
    setTimeout(() => {
      if (ma.counterKill) {   // [COUNTER-WIN-1] 반격이 받아쳐 몬스터가 쓰러짐 — 나는 안 다치고, 끝은 _afterMonsterTurn → _finishBattle(내 공격 승리와 같은 길)
        _bv2Chip('me', '반격!', '#d3a6ff');
        _bv2Hit('foe'); _bv2Shake(true); _bv2Burst('foe', '#d3a6ff', 18, true);
        _bv2Num('foe', ma.reflectDmg, { crit: true, tag: '반격', outline: '#4a2a6a' });
        _bv2Say(`반격 성공! ${escHtml(mon.name)}에게 <span class="hl">${ma.reflectDmg}</span> 피해를 돌려줬어요`);
        _updateBattleHpBars(BATTLE_STATE);
        setTimeout(() => _afterMonsterTurn(extra), 600);
        return;
      }
      if (ma.miss) {
        _bv2Num('me', '피했어요!', { small: true }); _bv2Say(`${escHtml(mon.name)}의 공격을 피했어요!`);
        _updateBattleHpBars(BATTLE_STATE);
        setTimeout(() => _afterMonsterTurn(extra), 500);
        return;
      }
      const heavy = ma.roleLabel === '강공!' || ma.crit;
      setTimeout(() => {
        _bv2Hit('me'); _bv2Shake(heavy); _bv2Burst('me', '#ff6a5a', 10);
        _bv2Num('me', ma.dmg, { outline: '#6a1010', tag: ma.roleLabel ? ma.roleLabel.replace(/!$/, '') : (ma.crit ? '급소' : '') });
        if (ma.armorMult < 1) _bv2Chip('me', '옷 상성이 좋아요', '#bfe7ff');
        else if (ma.armorMult > 1) _bv2Chip('me', '옷 상성이 안 좋아요', '#ffb0a2');
        _bv2Say(`${escHtml(_bv2J(mon.name, '이', '가'))} <span class="warn">${ma.dmg}</span> 피해를 줬어요`);
        _updateBattleHpBars(BATTLE_STATE);
        setTimeout(() => _afterMonsterTurn(extra), heavy ? 600 : 500);
      }, heavy ? 120 : 40);
    }, 190);
  }, 380);
}

// ── 몬스터 턴 종료 후 처리 — 다음에 올 큰 공격은 미리 알려 준다(무엇을 할지 고르게)
function _afterMonsterTurn(extra) {
  if (BATTLE_STATE.finished) { setTimeout(() => _finishBattle(), 300); return; }
  const mon = BATTLE_STATE.monster, sk = BATTLE_STATE.equippedSkill2 || [], used = BATTLE_STATE.skill2Used || {};
  BATTLE_MENU = 'main';
  setTimeout(() => {
    renderBattleNew();
    if (extra && /강한 일격을 준비/.test(extra))
      _bv2Say(`${escHtml(_bv2J(mon.name, '이', '가'))} 강한 일격을 준비해요${sk.includes('guard') && !used.guard ? ' — <span class="good">방어</span>를 써 보세요' : '!'}`);
    else if (extra && /한 번 더/.test(extra)) _bv2Say(`${escHtml(_bv2J(mon.name, '이', '가'))} 재빠르게 한 번 더 덤볐어요!`);
    else if (extra && /버텨/.test(extra)) _bv2Say(`${escHtml(_bv2J(mon.name, '이', '가'))} 단단히 버티며 반격을 노려요`);
  }, 300);
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
  // 전투는 EXP 0(설계: 레벨은 학급퀘스트로만) → 레벨업 없음. 헛도는 레벨업 연출 트리거 제거 (DI-5).
  // [BATTLE-V2] 업적 · 도감 보너스는 위에 덮는 팝업 대신 결과 카드 안 한 줄로
  BATTLE_STATE._v2ach = checkAchievements({ inline: true }) || [];
  BATTLE_STATE._v2dex = CUR._dexBonusLog || [];
  CUR._dexBonusLog = [];
  renderHUD();
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
    { id:'counter',  label:'⚔️ 최후의 반격',desc:'HP 40% 아래면 50% 반사', color:'#c39bd3' },
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
function playSkill2Effect(skill2Id) {   // [BATTLE-V2] 기술 이름 + 빛 파편(내 캐릭터 둘레)
  const k = BV2_SK[skill2Id]; if (!k) return;
  const col = { heal: '#7fe08f', guard: '#8fd3ff', counter: '#d3a6ff', prep: '#F6D27A', reckless: '#ff9a7a', rush: '#ffb26b' }[skill2Id] || '#8fd3ff';
  _bv2Burst('me', col, 12, false); _bv2Chip('me', k.t + '!', col);
  const el = _bv2El('me'); if (el) { el.classList.remove('cast'); void el.offsetWidth; el.classList.add('cast'); setTimeout(() => el.classList.remove('cast'), 700); }
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

function _showRecklessSkillPicker() {   // [BATTLE-V2] 아래 공격 단추가 '무리한 공격 — 어떤 공격으로?' 고르기로
  BATTLE_MENU = 'reckless';
  renderBattleNew();
}

function doReckless(attackType) {
  if (!BATTLE_STATE || BATTLE_STATE.finished) return;
  BATTLE_MENU = 'main';
  document.querySelectorAll('#battle-arena button').forEach(b => b.disabled = true);
  const hpBefore = BATTLE_STATE.monsterHp;
  BATTLE_STATE = performRecklessAttack(BATTLE_STATE, attackType);
  const dmg = Math.max(0, hpBefore - BATTLE_STATE.monsterHp);   // 실패·빗나감이면 0 (예전엔 지난 공격 숫자가 다시 떴다)
  _bv2Dash('me');
  setTimeout(() => {
    if (dmg > 0) {
      _bv2Hit('foe'); _bv2Shake(true); _bv2Burst('foe', (BV2_ATK[attackType] || BV2_ATK.normal).c, 20, true);
      _bv2Num('foe', dmg, { crit: true, tag: '무리한 공격', outline: '#8a5a00' });
      _bv2Say(`${escHtml(BATTLE_STATE.monster.name)}에게 <span class="hl">${dmg}</span> 피해 · 무리한 공격 성공!`);
    } else {
      _bv2Num('foe', '실패', { small: true }); _bv2Say('무리한 공격이 실패했어요');
    }
    _updateBattleHpBars(BATTLE_STATE);
    if (BATTLE_STATE.finished) { setTimeout(() => _finishBattle(), 450); return; }
    setTimeout(() => {
      if (BATTLE_STATE.turn === 'monster') _doMonsterTurn();
      else { BATTLE_MENU = 'main'; renderBattleNew(); }
    }, 650);
  }, 230);
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
    document.getElementById('monster-modal-title').textContent = '무한배틀';
    renderInfiniteBattleZoneSelect();
  } else {
    document.getElementById('monster-modal-title').textContent = '사냥터';
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
    { id:'beginner',     icon:'🌿', name:'초급 사냥터', color:'#6fd49d', border:'rgba(111,212,157,.35)', bg:'rgba(111,212,157,.07)', gold:'마리당 ' + IB_CONFIG.beginner.baseGold + 'G', minLv:1  },
    { id:'intermediate', icon:'🔥', name:'중급 사냥터', color:'#FF8A80', border:'rgba(255,138,128,.35)', bg:'rgba(255,138,128,.07)', gold:'마리당 ' + IB_CONFIG.intermediate.baseGold + 'G', minLv:1  },
    { id:'advanced',     icon:'⚡', name:'고급 사냥터', color:'#7ec8e3', border:'rgba(126,200,227,.35)', bg:'rgba(126,200,227,.07)', gold:'마리당 ' + IB_CONFIG.advanced.baseGold + 'G', minLv:21 },
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
                    ${locked ? `현재 Lv.${lv} · Lv.${z.minLv}부터 입장 가능` : `${z.gold} · 희귀·전설 몬스터가 더 자주 나와요`}
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
    `무한배틀 — ${IB.kills + 1}번째`;
  document.getElementById('battle-sub').textContent =
    `${IB.zone === 'beginner' ? '초급' : IB.zone === 'intermediate' ? '중급' : '고급'} · 처치 ${IB.kills}마리 · 모은 골드 ${IB.gold}G`;

  openModal('m-battle');   // [BATTLE-V2] 희귀·전설은 무대 이름표 꼬리표 + 등장 알림(_bv2Enter)

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

    // 짧은 결과 표시 후 다음 몬스터 — [BATTLE-V2] 무대 위에서 쓰러지고 다음이 들어온다
    _bv2IbKill(gold, heal, IB.kills >= 10);
    DB.saveStudent(CUR);

    // 10승 달성 시 자동 종료
    if (IB.kills >= 10) {
      setTimeout(() => _bv2Banner('10마리 처치!'), 500);
      setTimeout(() => _endInfiniteBattleSession(false), 1700);
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
  const ach = checkAchievements({ inline: true }) || [];   // [BATTLE-V2] 업적은 결과 카드 안

  const arenaEl = document.getElementById('battle-arena');
  if (arenaEl && !document.getElementById('bv2-stage'))
    arenaEl.innerHTML = '<div class="bv2-stage solo" id="bv2-stage" data-zone="' + (BV2_ZONE[IB.zone] ? IB.zone : 'beginner') + '"><div class="bv2-bg bv2-sky"></div><div class="bv2-bg bv2-vig"></div><div class="bv2-banner" id="bv2-banner"></div><div class="bv2-result" id="bv2-result"></div></div>';
  document.getElementById('bv2-actions')?.classList.add('done');
  _bv2Result(_bv2IbEndHTML(forfeit, isNewBest, best[IB.zone] || 0, ach));
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
    title.textContent = '사냥터';
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
    title.textContent = zoneNames[CUR_ZONE] || '사냥터';
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

