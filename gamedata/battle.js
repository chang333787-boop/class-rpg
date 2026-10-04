// gamedata/battle.js — 전투 — 장비/마스터리북 구매 판정 · 턴제 전투 엔진(데미지·상성·스킬2·종료 처리) · 사냥터 3마리 제시
//  gamedata.js 에서 떼어 옮긴 클래식 스크립트 [GAMEDATA-SPLIT-1] — 글자 그대로 · 전역 그대로 · html 네 곳에서 gamedata.js 바로 뒤에 부른다(gamedata/data.js → gamedata/rules.js → gamedata/emotion.js → gamedata/battle.js).
// ── [GAMEDATA-SPLIT-1] 'battle' — 원래 gamedata.js 2927~3643줄 ──
// ═══════════════════════════════════════════════════════
//  전투 시스템 4단계 — 장비/스킬북 구매 공용 함수
// ═══════════════════════════════════════════════════════

// 장비 구매 가능 여부 판정
// 반환: { ok:bool, reason:string }
function canBuyEquipment(student, item) {
  const inv = student.inventory || [];
  // 이미 인벤토리에 있는지 (보유 = 구매 불가)
  if (inv.some(i => i.id === item.id)) return { ok:false, reason:'이미 보유 중' };
  // 현재 착용 장비도 보유로 간주
  const slot = GAME_DATA.getSlotForItem(item.id);
  if (slot && (student.equipmentIds||{})[slot] === item.id) return { ok:false, reason:'이미 장착 중' };
  // 골드
  if ((student.gold||0) < item.price) return { ok:false, reason:`골드 부족 (${item.price}G 필요)` };
  // 레벨
  if ((student.level||1) < (item.lv||1)) return { ok:false, reason:`Lv.${item.lv} 이상 필요` };
  // 스탯 조건 (0값은 조건 없음으로 처리 — 관리자가 조건 제거 시 0 저장)
  if (item.cond && Object.keys(item.cond).length > 0) {
    const stats = student.stats || {};
    for (const [stat, val] of Object.entries(item.cond)) {
      if (!val || val <= 0) continue; // 0 = 조건 없음
      if ((stats[stat]||0) < val) {
        const sName = (GAME_DATA.statNames||{})[stat] || stat;
        return { ok:false, reason:`${sName} ${val} 필요` };
      }
    }
  }
  return { ok:true, reason:'' };
}

// 스킬북 구매 가능 여부 판정
function canBuySkillBook(student, book) {
  const current = (student.skillLevels || {})[book.type] ?? 0;
  if (current >= book.targetLevel) return { ok:false, reason:'이미 습득' };
  if (current !== book.targetLevel - 1) return { ok:false, reason:`이전 단계(Lv.${book.targetLevel-1}) 먼저 필요` };
  if ((student.level||1) < (book.reqPlayerLevel||1)) return { ok:false, reason:`레벨 ${book.reqPlayerLevel} 이상 필요` };
  if ((student.gold||0) < book.price) return { ok:false, reason:`골드 부족 (${book.price}G 필요)` };
  return { ok:true, reason:'' };
}

// 스킬북 구매 처리 (공용 로직 — 저장은 호출자에서)
// 반환: { ok:bool, reason:string }
function buySkillBookLogic(student, bookId) {
  const book = SKILL_BOOKS.find(b => b.id === bookId);
  if (!book) return { ok:false, reason:'책을 찾을 수 없음' };
  const check = canBuySkillBook(student, book);
  if (!check.ok) return check;
  student.skillLevels = student.skillLevels || { ...DEFAULT_SKILL_LEVELS };
  student.gold -= book.price;
  student.skillLevels[book.type] = book.targetLevel;   // 지출 기록(logSpend)은 저장 뒤 호출자(buySkillBook)에서 [GOLD-SPEND-2]
  return { ok:true, reason:'', book };
}

// ═══════════════════════════════════════════════════════
//  전투 시스템 2단계 — 턴제 전투 엔진
//  기존 저장 데이터와 완전 호환 (새 필드만 추가)
// ═══════════════════════════════════════════════════════

// ── 날짜 키 ──
function getTodayKey() {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
}

// ── battleDaily 보정 (날짜 바뀌면 used 초기화) ──
function normalizeBattleDaily(student) {
  const today = getTodayKey();
  if (!student.battleDaily || student.battleDaily.dateKey !== today) {
    student.battleDaily = { dateKey: today, used: 0 };
  }
  return student.battleDaily;
}

// ── 플레이어 전투 스탯 계산 ──
// HP = BALANCE.player.hpBase + level × hpPerLevel (80 + level*12), ATK/MAG/DEF/SPD = 장비 합산
function getPlayerBattleStats(student) {
  const c = student.combat || {};
  const hp  = BALANCE.player.hpBase + (student.level || 1) * BALANCE.player.hpPerLevel;
  const atk = c.atk || 0;
  const mag = c.mag || 0;
  const def = c.def || 0;
  const spd = c.spd || 0;

  // 몸통 속성 읽기
  let armorElement = null;
  const bodyId = (student.equipmentIds || {}).body;
  if (bodyId) {
    const bodyItem = GAME_DATA.getItemById(bodyId);
    if (bodyItem && bodyItem.element) armorElement = bodyItem.element;
  }

  return { hp, atk, mag, def, spd, armorElement, level: student.level || 1 };
}

// ── 속성 상성 (공격) ──
// water > fire > grass > water / normal = 1.0
// 런타임 표 — BALANCE.element 로 만든다 (관리자 elemChart가 이 표를 덮는다)
const ELEMENT_CHART = {
  water: { fire: BALANCE.element.advantage, grass: BALANCE.element.disadvantage, water: BALANCE.element.same },
  fire:  { grass: BALANCE.element.advantage, water: BALANCE.element.disadvantage, fire: BALANCE.element.same },
  grass: { water: BALANCE.element.advantage, fire: BALANCE.element.disadvantage, grass: BALANCE.element.same },
};
function getElementMultiplier(attackType, targetElement) {
  if (!attackType || attackType === 'normal' || !targetElement) return 1.0;
  return (ELEMENT_CHART[attackType] || {})[targetElement] || 1.0;
}

// ── 몸통 방어속성 (몬스터 공격 → 플레이어 받을 때) ──
function getDefenseElementMultiplier(monsterElement, armorElement) {
  if (!armorElement || !monsterElement) return 1.0;
  // 몸통 속성이 몬스터 속성에 유리하면 경감
  const adv = ELEMENT_CHART[armorElement];
  if (!adv) return 1.0;
  const rel = adv[monsterElement];
  // ★ 1.4/0.8 정확 비교 금지 — 관리자가 공격 상성 값을 바꾸면 방어 상성이 통째로 사라졌음 (밸런스 감사 B2)
  const bc = (typeof BATTLE_CONSTS !== 'undefined') ? BATTLE_CONSTS : {};
  if (rel > 1.0) return (bc.defAdvMult !== undefined) ? bc.defAdvMult : BALANCE.settingsDefaults.defAdvMult; // 유리
  if (rel < 1.0) return (bc.defDisMult !== undefined) ? bc.defDisMult : BALANCE.settingsDefaults.defDisMult; // 불리
  return 1.0;
}

// ── 특수형 처리 (ghost: normal 55%) ──
// ★ 기본값은 BALANCE.settingsDefaults.ghostNormalMult (7단계 0.35→0.55 이력은 그쪽 주석)
// ★ 8단계: BATTLE_CONSTS.ghostNormalMult 참조 → 관리자에서 조정 가능
function getTraitMultiplier(monster, attackType) {
  if (monster.trait === 'ghost' && attackType === 'normal') {
    return (typeof BATTLE_CONSTS !== 'undefined') ? BATTLE_CONSTS.ghostNormalMult : BALANCE.settingsDefaults.ghostNormalMult;
  }
  return 1.0;
}

// ── 플레이어 → 몬스터 데미지 ──
function calculatePlayerDamage(playerStats, monster, attackType, skillLevels) {
  const lvl  = (skillLevels || {})[attackType] || 0;
  if (attackType !== 'normal' && lvl < 1) return { dmg:0, miss:false, crit:false };
  const skillTable = attackType === 'normal'
    ? SKILL_MULTIPLIERS.normal
    : SKILL_MULTIPLIERS.element;
  const skillMult = skillTable[Math.min(lvl, BALANCE.skill.maxLevel)] || 1.0;
  const stat = (attackType === 'normal') ? playerStats.atk : playerStats.mag;
  const PA = BALANCE.playerAttack, DS = BALANCE.damage.defScale;
  const defFactor = DS / (DS + (monster.def || 0));
  const elemMult  = getElementMultiplier(attackType, monster.element);
  const traitMult = getTraitMultiplier(monster, attackType);
  // 레벨차 보정
  const playerLevel  = playerStats.level || 1;
  const monsterLevel = monster.level || monster.recLv || 1;
  const gap       = monsterLevel - playerLevel;
  const levelMult = gap > 0 ? Math.max(PA.levelGap.floor, 1 - gap * PA.levelGap.perLevel) : 1.0;

  // ★ 빗나감 판정 (기본 93%, SPD 차이로 ±3% 보정, 85~97% 범위)
  const spdDiff   = (monster.spd || 0) - (playerStats.spd || 0);
  const hitRate   = Math.min(PA.hit.max, Math.max(PA.hit.min, PA.hit.base - spdDiff * PA.hit.perSpd));
  const miss      = Math.random() > hitRate;
  if (miss) return { dmg: 0, miss: true, crit: false };

  // ★ 급소 판정 (기본 10%, 급소 시 1.5배)
  const critRate  = PA.crit.rate;
  const crit      = Math.random() < critRate;
  const critMult  = crit ? PA.crit.mult : 1.0;

  const dmg = Math.max(BALANCE.damage.minDamage, Math.round(stat * skillMult * defFactor * elemMult * traitMult * levelMult * critMult));
  return { dmg, miss: false, crit };
}

// ── 몬스터 → 플레이어 데미지 ──
function calculateMonsterDamage(playerStats, monster) {
  const MA = BALANCE.monsterAttack, DS = BALANCE.damage.defScale;
  const defFactor  = DS / (DS + (playerStats.def || 0));
  const armorMult  = getDefenseElementMultiplier(monster.element, playerStats.armorElement);

  // ★ 몬스터 빗나감: 기본 명중 93%, 플레이어 SPD 높을수록 최대 2% 추가 회피, 범위 88~97%
  const spdDiff = (playerStats.spd || 0) - (monster.spd || 0);
  const hitRate = Math.min(MA.hit.max, Math.max(MA.hit.min, MA.hit.base - spdDiff * MA.hit.perSpd));
  const miss    = Math.random() > hitRate;
  if (miss) return { dmg: 0, miss: true, crit: false };

  // ★ 몬스터 급소: 기본 6% (플레이어 10%보다 낮게), 급소 시 1.4배
  const crit    = Math.random() < MA.crit.rate;
  const critMult = crit ? MA.crit.mult : 1.0;

  const dmg = Math.max(BALANCE.damage.minDamage, Math.round((monster.atk || BALANCE.monster.atkFallback) * defFactor * armorMult * critMult));
  return { dmg, miss: false, crit };
}

// ── 선턴 결정 (SPD) ──
function decideFirstTurn(playerSpd, monsterSpd) {
  if (playerSpd > monsterSpd) return 'player';
  if (monsterSpd > playerSpd) return 'monster';
  return Math.random() < BALANCE.monster.firstTurnTie ? 'player' : 'monster';
}

// ── 전투 시작: state 객체 반환 ──
function startBattleEngine(student, monster) {
  const playerStats = getPlayerBattleStats(student);
  const firstTurn   = decideFirstTurn(playerStats.spd, monster.spd || 0);

  // ★ 난이도 배율 적용 (원본 monster 객체는 건드리지 않음)
  const hpMult  = (typeof BATTLE_CONSTS !== 'undefined') ? (BATTLE_CONSTS.monsterHpMult  || 1.0) : 1.0;
  const atkMult = (typeof BATTLE_CONSTS !== 'undefined') ? (BATTLE_CONSTS.monsterAtkMult || 1.0) : 1.0;
  const scaledMonster = {
    ...monster,
    hp:  Math.round((monster.hp  || BALANCE.monster.hpFallback) * hpMult),
    atk: Math.round((monster.atk || BALANCE.monster.atkFallback)  * atkMult),
  };

  return {
    playerStats,
    playerHp:    playerStats.hp,
    playerHpMax: playerStats.hp,
    monsterHp:    scaledMonster.hp,
    monsterHpMax: scaledMonster.hp,
    monster:      scaledMonster, // 배율 적용된 복사본
    skillLevels:  { ...DEFAULT_SKILL_LEVELS, ...(student.skillLevels || {}) },
    equippedSkill2: (student.equippedSkill2 || ['heal','guard','counter']).slice(0,3),
    firstTurn,
    turn:     firstTurn,
    turnCount: 0,       // 전체 턴 수
    monsterTurnCount: 0, // 몬스터 턴 수
    log:      [],
    finished: false,
    win:      false,

    // ── 몬스터 role 특성 상태 ──────────────────────
    roleUsed:   false,       // 전투당 1회 발동 여부
    roleBuff:   null,        // 다음 공격 강화 배율 {mult, label}
    dealerStacks: 0,         // dealer 누적 스택 (최대 3)
    fastTriggered: false,    // fast 발동 여부
    fastPending:   false,    // fast 추가타 예약
    tankTriggered: false,    // tank 발동 여부
    normalPrepared: false,   // normal 강공 준비 여부

    // ── 스킬2 상태 ────────────────────────────────
    skill2Used:  {},         // {heal:true, guard:true, ...} 사용 완료
    prepActive:  false,      // 일격 준비 활성
    guardActive: false,      // 방어 활성 (이번 턴)
    rushTurns:   0,          // 몰아치기 남은 플레이어 공격 횟수
    counterReady: false,     // 최후의 반격 대기
  };
}

// ── 플레이어 턴 처리 ──
function performPlayerTurn(state, attackType) {
  if (state.finished) return state;

  // ── 스킬2 배율 계산 ──
  let skill2Mult = 1.0;
  let skill2Label = '';
  if (state.prepActive) {
    skill2Mult  = BALANCE.skill2.prepMult;
    skill2Label = ' <span style="color:#FFD700;font-size:.78rem">준비한 일격이 터졌다!</span>';
    state.prepActive = false;
  }
  if (state.rushTurns > 0) {
    const rushMult = BALANCE.skill2.rush.multMin + Math.random() * BALANCE.skill2.rush.multSpread; // 115~135%
    skill2Mult = Math.max(skill2Mult, rushMult); // prep와 중첩 시 높은 쪽
    skill2Label += ` <span style="color:#f39c12;font-size:.78rem">거세게 몰아친다!</span>`;
    state.rushTurns--;
  }

  const result = calculatePlayerDamage(state.playerStats, state.monster, attackType, state.skillLevels);
  const skillLv    = (state.skillLevels[attackType] || 0);
  const typeNames  = { normal:'일반', fire:'화염', water:'냉기', grass:'자연' };
  const typeName   = typeNames[attackType] || attackType;

  // 빗나감
  if (result.miss) {
    state.lastPlayerAction = { attackType, skillLv, dmg:0, elemMult:1, isGhost:false, miss:true, crit:false };
    state.log.push(`<span class="info">${typeName} 공격 Lv${skillLv}!</span> <span style="color:#888">빗나감!</span>`);
    state.turn = 'monster';
    state.monsterTurnCount++;
    return state;
  }

  const { crit } = result;
  let dmg = Math.max(1, Math.round(result.dmg * skill2Mult));

  // ── role 특성: tank — HP 60% 이하 피격 시 40% 경감 (전투 1회) ──
  const mon = state.monster;
  if (mon.role === 'tank' && mon.trait !== 'ghost' && !state.tankTriggered &&
      state.monsterHp / state.monsterHpMax <= BALANCE.role.tank.hpRatio) {
    state.tankTriggered = true;
    dmg = Math.max(1, Math.round(dmg * BALANCE.role.tank.damageTaken));
    state.log.push(`<span style="color:#e74c3c;font-size:.78rem">🛡️ ${mon.name}이(가) 단단히 버텨냈다! 반격 태세를 갖춘다!</span>`);
    state.roleBuff = { mult: BALANCE.role.tank.counterBuff, label: '반격 강화!' };
  }

  state.monsterHp = Math.max(0, state.monsterHp - dmg);

  // ── role 특성: fast(속공) — HP 70% 이하 첫 도달 시 다음 몬스터 턴에 추가타 예약 ──
  const monF = state.monster;
  if (monF.role === 'fast' && monF.trait !== 'ghost' && !state.fastTriggered && !state.fastPending &&
      state.monsterTurnCount > 0 && state.monsterHp / state.monsterHpMax <= BALANCE.role.fast.hpRatio) {
    state.fastPending = true;
  }

  const elemMult  = attackType !== 'normal' ? getElementMultiplier(attackType, state.monster.element) : 1.0;
  const isGhost   = state.monster.trait === 'ghost' && attackType === 'normal';
  state.lastPlayerAction = { attackType, skillLv, dmg, elemMult, isGhost, miss:false, crit };

  let effectSpan = skill2Label;
  if (crit)                effectSpan += '<span style="color:#FFD700;font-size:.78rem"> 급소!</span>';
  if (isGhost)             effectSpan += '<span style="color:#bbb;font-size:.78rem"> 유령 저항!</span>';
  else if (elemMult > 1.0) effectSpan += '<span style="color:#FF8C00;font-size:.78rem"> 효과 굉장함!</span>';
  else if (elemMult < 1.0) effectSpan += '<span style="color:#888;font-size:.78rem"> 효과 별로...</span>';

  state.log.push(
    `<span class="info">${typeName} 공격 Lv${skillLv}!</span>` +
    ` <span class="good">-${dmg}</span>${effectSpan}`
  );

  if (state.monsterHp <= 0) {
    state.finished = true; state.win = true; state.turn = null;
  } else {
    state.turn = 'monster';
    state.monsterTurnCount++;
  }
  return state;
}

// ── 몬스터 턴 처리 (role 특성 포함) ──
function performMonsterTurn(state) {
  if (state.finished) return state;
  const mon = state.monster;
  const role = mon.role || 'normal';
  const isGhostMon = mon.trait === 'ghost';

  // ── role 특성: dealer(전투 가속) — 매 몬스터 턴마다 스택 증가 ──
  if (!isGhostMon && role === 'dealer' && state.dealerStacks < BALANCE.role.dealer.maxStacks) {
    state.dealerStacks++;
    const stackLabels = ['점점 공격이 거세진다!','공격 기세가 오른다!','최고조의 공격 태세!'];
    state.log.push(`<span style="color:#e74c3c;font-size:.78rem">⬆ ${stackLabels[state.dealerStacks-1]}</span>`);
  }

  // ── 몬스터 공격 계산 ──────────────────────────────────────────
  const dealerMult = (!isGhostMon && role === 'dealer') ? (1 + state.dealerStacks * BALANCE.role.dealer.perStack) : 1.0;
  // ★ roleBuff를 normal role 세팅 이전에 읽어서 소모
  // → 준비 턴(monsterTurnCount===2)엔 ×1.0으로 정상 공격, 다음 턴에 ×1.6 적용
  const roleBuff = state.roleBuff;
  state.roleBuff = null;
  const roleAttackMult = (roleBuff ? roleBuff.mult : 1.0) * dealerMult;

  // ── role 특성: normal(강공) — 2번째 몬스터 턴 시 준비 문구 + 다음 턴에 ×1.6 ──
  if (!isGhostMon && role === 'normal' && !state.roleUsed && state.monsterTurnCount === BALANCE.role.normal.onMonsterTurn) {
    state.log.push(`<span style="color:#e74c3c;font-size:.78rem">⚡ ${mon.name}이(가) 강한 일격을 준비한다!</span>`);
    state.roleBuff = { mult: BALANCE.role.normal.buff, label: '강공!' }; // ★ 다음 턴에 소모됨
    state.roleUsed = true;
    // 이번 턴은 roleAttackMult = 1.0으로 정상 공격 진행
  }

  const result    = calculateMonsterDamage(state.playerStats, mon);
  const armorMult = getDefenseElementMultiplier(mon.element, state.playerStats.armorElement);

  // ── skill2: 방어 (guardActive) — 이번 피해 50% 감소 ──────────
  const guardMult = state.guardActive ? BALANCE.skill2.guardMult : 1.0;
  if (state.guardActive) {
    state.log.push(`<span style="color:#4fc3f7;font-size:.78rem">🛡️ 피해를 줄였다!</span>`);
    state.guardActive = false;
  }

  // ── skill2: 몰아치기 피해증가 (rushTurns > 0일 때 받는 피해 15% 증가) ──
  const rushDmgMult = (state.rushTurns > 0) ? BALANCE.skill2.rush.damageTaken : 1.0;

  // 빗나감
  if (result.miss) {
    state.lastMonsterAction = { dmg: 0, armorMult, miss: true, crit: false, roleLabel:'' };
    state.log.push(`<span class="bad">${mon.name}의 공격!</span> <span style="color:#888">몬스터 공격 빗나감!</span>`);
    // fast 추가타도 빗나감 처리 후 건너뜀
    state.turn = 'player';
    state.monsterTurnCount++;
    return state;
  }

  const { crit } = result;
  const finalDmg = Math.max(1, Math.round(result.dmg * roleAttackMult * guardMult * rushDmgMult));
  state.lastMonsterAction = { dmg: finalDmg, armorMult, miss:false, crit, roleLabel: roleBuff?.label || '' };

  // ── skill2: 최후의 반격 판정 ───────────────────────────────
  if (state.counterReady) {
    state.counterReady = false;
    const counterSuccess = Math.random() < BALANCE.skill2.counter.chance;
    if (counterSuccess) {
      const reflectDmg = Math.max(1, Math.round(finalDmg * BALANCE.skill2.counter.reflectMult));
      state.monsterHp = Math.max(0, state.monsterHp - reflectDmg);
      state.log.push(`<span class="good">⚡ 반격 성공! 몬스터에게 -${reflectDmg} 반사!</span>`);
      // [COUNTER-WIN-1] 반사로 쓰러뜨리면 그 자리에서 승리 — 내 공격으로 이긴 것과 같은 끝(finished·win·turn).
      //   몬스터가 먼저 쓰러졌으니 이번 몬스터 공격은 없다(아이 HP 그대로). 보상·기록은 화면의 _finishBattle → finalizeBattle 이 같은 길로.
      if (state.monsterHp <= 0) {
        state.lastMonsterAction = { dmg: 0, armorMult, miss: false, crit: false, roleLabel: '', counterKill: true, reflectDmg };
        state.finished = true; state.win = true; state.turn = null;
        return state;
      }
    } else {
      state.log.push(`<span style="color:#888;font-size:.78rem">반격 실패...</span>`);
    }
    // 플레이어는 그대로 맞음
  }

  // 실제로 깎이는 값 — 아래 HP 차감과 표시 문구가 같은 값을 쓰도록 따로 둔다.
  let actualDmg = finalDmg;

  state.playerHp = Math.max(0, state.playerHp - actualDmg);

  let effectSpan = '';
  if (roleBuff)            effectSpan += `<span style="color:#e74c3c;font-size:.78rem"> ${roleBuff.label}</span>`;
  if (crit)                effectSpan += '<span style="color:#ef9a9a;font-size:.78rem"> 몬스터 급소!</span>';
  if (armorMult < 1.0)     effectSpan += '<span style="color:#4fc3f7;font-size:.78rem"> 방어 상성 유리!</span>';
  if (armorMult > 1.0)     effectSpan += '<span style="color:#ef9a9a;font-size:.78rem"> 방어 상성 불리!</span>';
  if (dealerMult > 1.0)    effectSpan += `<span style="color:#e74c3c;font-size:.78rem"> [강화 ${Math.round(dealerMult*100)}%]</span>`;

  state.log.push(
    `<span class="bad">${mon.name}의 공격!</span>` +
    ` <span class="bad">-${actualDmg}</span>${effectSpan}`
  );

  // ── role 특성: fast(속공) — fastPending이면 이번 턴 종료 후 추가타 ──
  if (!isGhostMon && role === 'fast' && state.fastPending) {
    state.fastPending = false;
    state.fastTriggered = true;
    state.log.push(`<span style="color:#e74c3c;font-size:.78rem">💨 ${mon.name}이(가) 재빠르게 한 번 더 덤빈다!</span>`);
    if (state.playerHp > 0) {
      // ★ fast 추가타: 빗나감 적용, 급소 적용 안 함 (calculateMonsterDamage 쓰면 급소 포함되므로 직접 계산)
      const fastHit = calculateMonsterDamage(state.playerStats, mon);
      if (!fastHit.miss) {
        // 급소 배율 제거: fastHit.dmg에서 crit이 baked-in된 경우 역산 필요
        // → 간단하게 기본 피해(crit 없이) 직접 계산
        const defFactor  = BALANCE.damage.defScale / (BALANCE.damage.defScale + (state.playerStats.def || 0));
        const armorMult2 = getDefenseElementMultiplier(mon.element, state.playerStats.armorElement);
        const baseDmg    = Math.max(1, Math.round((mon.atk || BALANCE.monster.atkFallback) * defFactor * armorMult2));
        const fastDmg    = Math.max(1, Math.round(baseDmg * BALANCE.role.fast.extraHitMult * guardMult * rushDmgMult));
        state.playerHp   = Math.max(0, state.playerHp - fastDmg);
        state.log.push(`<span class="bad">💨 추가타! -${fastDmg}</span>`);
      } else {
        state.log.push(`<span style="color:#888;font-size:.78rem">추가타 빗나감!</span>`);
      }
    }
  }

  if (state.playerHp <= 0) {
    state.finished = true; state.win = false; state.turn = null;
  } else {
    state.turn = 'player';
    state.monsterTurnCount++;
  }
  return state;
}

// ── 스킬2 처리 ───────────────────────────────────────────────
function performSkill2(state, skill2Id) {
  if (state.finished || state.turn !== 'player') return state;
  if (state.skill2Used[skill2Id]) return state;

  state.skill2Used[skill2Id] = true;

  switch (skill2Id) {
    case 'heal': {
      const healAmt = Math.floor(state.playerHpMax * BALANCE.skill2.healRatio);
      state.playerHp = Math.min(state.playerHpMax, state.playerHp + healAmt);
      state.log.push(`<span class="good">💊 응급치료! +${healAmt}HP</span>`);
      state.turn = 'monster';
      state.monsterTurnCount++;
      break;
    }
    case 'prep': {
      state.prepActive = true;
      state.log.push(`<span class="info">🎯 일격을 준비한다!</span>`);
      state.turn = 'monster';
      state.monsterTurnCount++;
      break;
    }
    case 'reckless': {
      // 무리한 공격: 스킬1 선택 후 50% 성공
      // 실제 공격은 doSkill2Reckless(attackType)에서 처리
      state.recklessReady = true;
      state.log.push(`<span class="info">⚡ 무리한 공격 시도!</span>`);
      // 아직 턴 소모 안 함 — 스킬1 선택 대기
      break;
    }
    case 'guard': {
      state.guardActive = true;
      state.log.push(`<span class="info">🛡️ 방어 자세를 취했다!</span>`);
      state.turn = 'monster';
      state.monsterTurnCount++;
      break;
    }
    case 'counter': {
      state.counterReady = true;
      state.log.push(`<span class="info">⚔️ 최후의 반격을 노린다!</span>`);
      state.turn = 'monster';
      state.monsterTurnCount++;
      break;
    }
    case 'rush': {
      state.rushTurns = BALANCE.skill2.rush.turns;
      state.log.push(`<span style="color:#f39c12">🔥 몰아치기 시작!</span>`);
      state.turn = 'monster';
      state.monsterTurnCount++;
      break;
    }
  }
  return state;
}

// 무리한 공격 — 스킬1 선택 후 50% 판정
function performRecklessAttack(state, attackType) {
  if (!state.recklessReady) return state;
  state.recklessReady = false;
  if (Math.random() < BALANCE.skill2.reckless.chance) {
    // 성공: BALANCE.skill2.reckless.mult (2.2배) 적용
    const result = calculatePlayerDamage(state.playerStats, state.monster, attackType, state.skillLevels);
    if (!result.miss) {
      const dmg = Math.max(1, Math.round(result.dmg * BALANCE.skill2.reckless.mult));
      state.monsterHp = Math.max(0, state.monsterHp - dmg);
      const elemMult = attackType !== 'normal' ? getElementMultiplier(attackType, state.monster.element) : 1.0;
      const isGhost  = state.monster.trait === 'ghost' && attackType === 'normal';
      let fx = '<span style="color:#FFD700;font-size:.78rem"> 성공!</span>';
      if (isGhost) fx += '<span style="color:#bbb;font-size:.78rem"> 유령 저항!</span>';
      else if (elemMult > 1.0) fx += '<span style="color:#FF8C00;font-size:.78rem"> 효과 굉장함!</span>';
      state.log.push(`<span class="good">⚡ 무리한 공격! -${dmg}</span>${fx}`);
      state.lastPlayerAction = { attackType, skillLv:0, dmg, elemMult, isGhost, miss:false, crit:false };
      if (state.monsterHp <= 0) { state.finished = true; state.win = true; state.turn = null; return state; }
    } else {
      state.log.push(`<span style="color:#888">⚡ 무리한 공격 — 빗나감!</span>`);
    }
  } else {
    state.log.push(`<span style="color:#888">⚡ 무리한 공격 실패...</span>`);
  }
  state.turn = 'monster';
  state.monsterTurnCount++;
  return state;
}

// ── 전투 종료 처리 (학생 데이터 저장) ──
// ★ 횟수 차감은 startBattle()에서 이미 완료 — 여기서는 골드/도감만 처리
// battleInProgress 해제는 호출자(doAttack)에서 처리
function finalizeBattle(student, monster, win) {
  if (win) {
    // 골드 지급
    student.gold      = (student.gold || 0) + monster.gold;
    student.totalGold = (student.totalGold || 0) + monster.gold;
    if (typeof DB !== 'undefined') DB.logGold(student.id, 'battle', monster.gold);   // [GOLD-LOG-1]

    // 도감 기록 + 도감 보상 지급
    const isFirstKill = !(student.monsterLog || []).includes(monster.id);
    if (isFirstKill) {
      student.monsterLog = [...(student.monsterLog || []), monster.id];

      // 최초 처치 보상 (settings.dexRewards 참조)
      const dexRewards = (typeof DB !== 'undefined')
        ? ((DB.getSettings() || {}).dexRewards || {}) : {};
      if (dexRewards.firstKillEnabled && dexRewards.firstKillGold > 0) {
        student.gold      += dexRewards.firstKillGold;
        student.totalGold  = (student.totalGold || 0) + dexRewards.firstKillGold;
        DB.logGold(student.id, 'battle', dexRewards.firstKillGold);   // [GOLD-LOG-1]
        student._dexBonusLog = (student._dexBonusLog || []);
        student._dexBonusLog.push({ type:'firstKill', name:monster.name, gold:dexRewards.firstKillGold });
      }

      // zone 완성 보상 체크
      if (monster.zone && dexRewards[monster.zone]) {
        const zoneMons = (typeof GAME_DATA !== 'undefined')
          ? GAME_DATA.monsters.filter(m => m.zone === monster.zone) : [];
        const killed   = student.monsterLog || [];
        const allDone  = zoneMons.length > 0 && zoneMons.every(m => killed.includes(m.id));
        const claimedKey = `dexZoneClaimed_${monster.zone}`;
        if (allDone && !student[claimedKey]) {
          student[claimedKey] = true;
          const zr = dexRewards[monster.zone];
          if (zr.gold > 0) {
            student.gold      += zr.gold;
            student.totalGold  = (student.totalGold || 0) + zr.gold;
            DB.logGold(student.id, 'battle', zr.gold);   // [GOLD-LOG-1]
          }
          if (zr.title) {
            student.titles = [...new Set([...(student.titles || []), zr.title])];
          }
          student._dexBonusLog = (student._dexBonusLog || []);
          student._dexBonusLog.push({ type:'zoneComplete', zone:monster.zone, gold:zr.gold, title:zr.title||'' });
        }
      }
    }
  }
  // 패배: 저장 데이터 초기화 금지 — 골드/장비/스킬 일절 건드리지 않음
  return student;
}

// ═══════════════════════════════════════════════════════
//  전투 시스템 3단계 — 사냥터 3마리 제시 로직
// ═══════════════════════════════════════════════════════

// 사냥터 구간 정의 — BALANCE.offers.zoneRanges
const ZONE_RANGES = BALANCE.offers.zoneRanges;

// 슬롯별 레벨 범위 계산 (사냥터 min/max 내로 클램프)
function getSlotLevelRange(playerLevel, slotIndex, zoneMin, zoneMax) {
  const base = playerLevel + slotIndex - 1; // 0→P-1, 1→P, 2→P+1
  const lo = Math.max(zoneMin, base);
  const hi = Math.min(zoneMax, base + 1);
  return { lo, hi };
}

// 희귀도 가중치 (슬롯별) — BALANCE.offers.rarityWeights
const RARITY_WEIGHTS = BALANCE.offers.rarityWeights;
function getRarityWeight(monster, slotIndex) {
  return (RARITY_WEIGHTS[slotIndex] || RARITY_WEIGHTS[0])[monster.rarity] ?? 1.0;
}

// 미획득 몬스터 우대 (monsterLog는 id 배열 기준 — _migrate에서 통일)
function getDiscoveryWeight(player, monster) {
  return (player.monsterLog || []).includes(monster.id) ? 1.0 : BALANCE.offers.unseenWeight;
}

// 최근 등장 억제 (recentBattleOffers는 최근 5회 제시 이름 평탄화 배열)
function getRecentWeight(player, monster) {
  const recent = player.recentBattleOffers || [];
  // 평탄화: 배열of배열 또는 배열of문자열 모두 지원
  const flat = recent.flat ? recent.flat() : [].concat(...recent);
  const idx = flat.lastIndexOf(monster.name);
  if (idx < 0) return 1.0;
  // 직전(최신 3개 안) 등장 여부 확인
  const distFromEnd = flat.length - 1 - idx;
  const R = BALANCE.offers.recent;
  if (distFromEnd < R.justNow) return R.justNowWeight; // 직전 출현
  if (distFromEnd < R.lately)  return R.latelyWeight;  // 최근 3회 내 (3마리×3회)
  return 1.0;
}

// 중복 / 유령 과다 방지
function canPickMonster(candidate, pickedMonsters) {
  // 동일 몬스터 중복 금지
  if (pickedMonsters.some(p => p.id === candidate.id)) return false;
  // 유령형 최대 2마리
  const ghostCount = pickedMonsters.filter(p => p.trait === 'ghost').length;
  if (candidate.trait === 'ghost' && ghostCount >= BALANCE.offers.maxGhosts) return false;
  return true;
}

// 가중치 기반 1개 랜덤 선택
function weightedPick(candidates) {
  const total = candidates.reduce((s, c) => s + (c._w || 0), 0);
  if (total <= 0) return candidates[Math.floor(Math.random() * candidates.length)] || null;
  let r = Math.random() * total;
  for (const c of candidates) {
    r -= (c._w || 0);
    if (r <= 0) return c;
  }
  return candidates[candidates.length - 1];
}

// 3번 슬롯 후보: 80% 현재 범위 / 20% 과거 미획득 희귀/레어 복귀
function getThirdSlotCandidates(player, zoneMonsters, currentRange) {
  const inRange = zoneMonsters.filter(m => m.level >= currentRange.lo && m.level <= currentRange.hi);
  // ★ 레벨 상한: 플레이어 레벨 +3까지만 (저레벨이 고레벨 만나는 문제 방지)
  const maxLevel = (player.level || 1) + BALANCE.offers.thirdSlot.maxLevelAbovePlayer;
  // 복귀 후보: 같은 사냥터 안, 미획득, rare/legend, 레벨 상한 이하
  const missed = zoneMonsters.filter(m =>
    (m.rarity === 'rare' || m.rarity === 'legend') &&
    !(player.monsterLog || []).includes(m.id) &&
    !inRange.includes(m) &&
    (m.level || 1) <= maxLevel   // ★ 레벨 상한 적용
  );
  // 20% 확률로 복귀 후보 사용 (없으면 현재 범위)
  if (missed.length > 0 && Math.random() < BALANCE.offers.thirdSlot.returnChance) return missed;
  return inRange.length > 0 ? inRange : zoneMonsters.filter(m => (m.level||1) <= maxLevel);
}

// ── 메인: 사냥터 3마리 후보 생성 ──
function generateBattleOffers(player, zone) {
  const zoneRange = ZONE_RANGES[zone];
  if (!zoneRange) return [];
  const allMonsters = (typeof GAME_DATA !== 'undefined') ? GAME_DATA.monsters : [];
  const zoneMonsters = allMonsters.filter(m => m.zone === zone);
  if (!zoneMonsters.length) return [];

  const picked = [];

  for (let slotIndex = 0; slotIndex < 3; slotIndex++) {
    // 슬롯별 레벨 범위 계산
    let range, pool;
    if (slotIndex === 2) {
      // 3번 슬롯: 복귀 출현 로직
      range = getSlotLevelRange(player.level, slotIndex, zoneRange.min, zoneRange.max);
      pool  = getThirdSlotCandidates(player, zoneMonsters, range);
    } else {
      range = getSlotLevelRange(player.level, slotIndex, zoneRange.min, zoneRange.max);
      pool  = zoneMonsters.filter(m => m.level >= range.lo && m.level <= range.hi);
      if (!pool.length) pool = zoneMonsters; // fallback
    }

    // 중복/유령 필터 + 가중치 부여
    const candidates = pool
      .filter(m => canPickMonster(m, picked))
      .map(m => ({
        ...m,
        _w: getRarityWeight(m, slotIndex)
             * getDiscoveryWeight(player, m)
             * getRecentWeight(player, m),
      }));

    // 후보 없으면 zone 전체에서 중복만 피해서 fallback
    const fallbackPool = candidates.length > 0 ? candidates
      : zoneMonsters
          .filter(m => canPickMonster(m, picked))
          .map(m => ({ ...m, _w: 1 }));

    if (!fallbackPool.length) continue; // zone 전체에도 없으면 어쩔 수 없음
    const chosen = weightedPick(fallbackPool);
    if (chosen) {
      // _w 필드는 내부용이므로 제거
      const { _w, ...clean } = chosen;
      picked.push(clean);
    }
  }

  // recentBattleOffers 업데이트 (최근 5회 배열of배열 유지)
  if (picked.length > 0) {
    const names = picked.map(m => m.name);
    const prev  = (player.recentBattleOffers || []).slice(-BALANCE.offers.recentKeep); // 이전 4회 유지
    player.recentBattleOffers = [...prev, names];              // 5번째 추가
  }

  return picked;
}

