// gamedata/data.js — 게임 상수 표 — BALANCE(전투·사냥터 계수 원본) · 장비/몬스터/경험치표 만들기 · GAME_DATA · 씨앗·장식 가격 · 꾸미기 무료 기간 · 돌연변이 씨앗 · 스킬 계수·마스터리북
//  gamedata.js 에서 떼어 옮긴 클래식 스크립트 [GAMEDATA-SPLIT-1] — 글자 그대로 · 전역 그대로 · html 네 곳에서 gamedata.js 바로 뒤에 부른다(gamedata/data.js → gamedata/rules.js → gamedata/emotion.js → gamedata/battle.js).
// ── [GAMEDATA-SPLIT-1] 'data' — 원래 gamedata.js 6~840줄 ──
// ═══════════════════════════════════════════════════════
//  BALANCE — 전투·사냥터 계수의 **코드 기본값** 한 곳 (B-2, 공식 설명: docs/rpg_balance_model.md)
//  ★ 여기 값은 원본이다. 런타임 표(SKILL_MULTIPLIERS·ELEMENT_CHART·BATTLE_CONSTS)는 이것을 복사해 만들고,
//    관리자 설정(applyBattleSettings)은 그 런타임 표만 덮는다. BALANCE 자체를 코드에서 바꾸지 말 것.
//  ★ 운영 값(몬스터 HP×1.5 · ATK×1.6 · 하루 5회)은 관리자 설정이지 여기 기본값이 아니다.
//  ★ 값을 바꾸면 아이가 보는 전투가 바뀐다 — scripts/balance/gate.mjs 로 전후 표를 먼저 볼 것.
//    구조만 옮길 때는 scripts/balance/identity.mjs 가 "출력 100% 동일"을 확인한다.
// ═══════════════════════════════════════════════════════
const BALANCE = {
  // 플레이어 HP = hpBase + 레벨 × hpPerLevel (ATK/MAG/DEF/SPD는 장비 합산)
  player: { hpBase: 80, hpPerLevel: 12 },

  // 경험치표 (B-2i, B-1 §2.1) — expTable[k] = expTable[k−1] + need(k), need(1) = firstNeed,
  //   need(k) = need(k−1) + steps 중 k 이상인 마지막 증가폭 + incAdjust[k]. 초반 빠르게(+60) · Lv12~ 완만하게(+100) · 끝 두 칸만 크게.
  //   ★ 값을 바꾸면 모든 아이의 레벨 속도가 바뀐다(사용자 결정). 이미 쌓인 EXP 는 안 바뀌고 레벨 표시가 바뀐다.
  exp: { firstNeed: 100, steps: [[2, 40], [3, 60], [11, 80], [12, 100]], incAdjust: { 29: +80, 30: +320 }, maxIndex: 30 },

  // 장비 등급 1~10 을 여는 레벨 — 머리·몸통·무기·장갑·신발 전 슬롯 공통 (B-1 §4.3)
  // 장비 가격 (B-2e, B-1 §4.3) — 독립 50종: price = round(c × 능력치합^p) + 줄의 priceAdj · 복사 30종(물·풀 몸통·스태프)은 원본 가격을 따른다
  //   ★ 곡선은 칸별 로그 회귀(B-1). priceAdj 는 옛 손값을 100% 그대로 두는 차이 — 없애면 아이가 보는 가격이 바뀐다(사용자 결정).
  equipment: {
    tierLevels: [1, 5, 7, 10, 13, 16, 20, 24, 28, 30],
    price: { head: { c: 7.34, p: 1.212 }, body: { c: 3.24, p: 1.477 }, weapon: { c: 1.24, p: 1.351 }, glove: { c: 2.8, p: 1.461 }, shoe: { c: 1.47, p: 1.756 } },
  },

  // 몬스터 능력치 (B-2c, B-1 §4.1) — _mon(shape, 줄, 보정)이 쓴다
  //   레벨 기본값 BASE(L)[s] = round(a + b·L) + baseAdjust[s][L]
  //   몬스터 능력치 = round(BASE(L)[s] × shapes[shape][s]) + 그 몬스터 줄의 보정
  //   ★ shape(능력치 모양)는 role(전투 기믹)과 따로다 — 탱커 기믹인데 기본 모양 5종, 속공 모양인데 normal·dealer 3종
  //   ★ 보정(±1~2)은 손으로 친 옛 표를 100% 그대로 두려고 남긴 반올림 차이다. 없애면 아이가 보는 능력치가 바뀐다(B-4 결정).
  monsterStats: {
    base: { hp: { a: 27.44, b: 6.53 }, atk: { a: 4.95, b: 1.55 }, def: { a: 1.78, b: 0.86 }, spd: { a: 0.95, b: 0.51 } },
    baseAdjust: { hp: { 3: +1, 7: +1, 11: +1, 15: +1, 21: -1, 25: -1, 29: -1 }, atk: { 30: +1 }, def: { 3: +1 }, spd: { 1: +1, 11: -1, 15: -1, 19: -1, 23: -1, 27: -1 } },
    shapes: {
      base: { hp: 1, atk: 1, def: 1, spd: 1 },
      tank: { hp: 1.25, atk: 0.9, def: 1.2, spd: 0.9 },    // 탱커형 18종
      fast: { hp: 0.85, atk: 1, def: 0.85, spd: 1.25 },    // 속공형 12종
    },
  },

  // 몬스터 골드 (B-2d, B-1 §4.2) — gold = round((a + b·L) × rarity[희귀도]) + 그 몬스터 줄의 보정 gold
  //   ★ 곡선은 100종 제곱오차 최소로 고른 값(5,570G → 곡선만 쓰면 5,572G). 보정은 옛 손값을 100% 그대로 두는 차이.
  //   ★ 보정을 0으로 하면 아이가 보는 골드가 바뀐다 — docs/rpg_balance_gold_curve_20260915.md (G1 전부 0 · G2 이상치 11종만 0) 는 사용자 결정.
  monsterGold: { base: { a: 10.5, b: 2.4 }, rarity: { common: 1, rare: 1.15, legend: 1.75 } },

  // 돌연변이 씨앗 (B-2f) — 같은 등급 일반 씨앗의 성장시간·판매가·레벨을 쓰고, 가격 = round(일반 × priceMult) + 줄의 priceAdj,
  //   성공률 = floor((successBase − successPerTier × 등급) × 100) / 100. 성공 시 판매가 ×2 는 student.js 수확 코드.
  mutantSeed: { priceMult: 1.6, successBase: 0.55, successPerTier: 0.025 },

  // 일반 씨앗 판매가 (B-2g) — sellPrice = round(price × (ratioBase + ratioPerTier × 등급)) + 줄의 sellAdj. 등급이 오를수록 이윤율이 오른다(B-1 §3.4).
  seedSell: { ratioBase: 3.33, ratioPerTier: 0.375 },
  // 속성 마스터리북 가격 (B-2g) — 화염 n권 price = round(노말 n권 price × elementPriceRatio) + 줄의 priceAdj (냉기·자연은 화염 복사)
  //   노말 n권 가격 (B-2j) = 1권 first, 간격 firstInc 에서 시작해 incSteps(권 번호 이상이면 그 폭씩) 만큼 벌어짐 → 60·90·130·180·250·340·450
  bookPrice: { elementPriceRatio: 0.8, normal: { first: 60, firstInc: 30, incSteps: [[3, 10], [5, 20]] } },
  // 장식 가격 (B-2h) — 유료 장식 price = decoPrice[희귀도] + 줄의 priceAdj (희귀도별 가운데 값을 5G 단위로). 업적 장식(price 0)은 그대로.
  //   ★ 장식은 취향값이라 곡선 대신 기준가만 둔다. priceAdj 를 줄이면 아이가 보는 가격이 바뀐다(사용자 결정 — docs/rpg_balance_deco_price_20260915.md).
  decoPrice: { common: 20, rare: 70, epic: 210, legend: 375 },

  // 스킬 계수 — 7단계 밸런스 조정: 노말 계수 +10% (1.00→1.10 base)
  // 이유: 시뮬레이션에서 초급 비유령 몬스터도 6-7라운드로 체감이 느림
  skill: {
    maxLevel: 7,
    normal:  { 1:1.10, 2:1.18, 3:1.27, 4:1.36, 5:1.46, 6:1.56, 7:1.65 },
    element: { 0:0.00, 1:1.00, 2:1.10, 3:1.20, 4:1.30, 5:1.40, 6:1.50, 7:1.60 },
  },

  // 속성 상성 (공격) — water > fire > grass > water
  element: { advantage: 1.4, disadvantage: 0.8, same: 1.0 },

  // 피해 공통: 공격 × defScale / (defScale + 방어), 최소 minDamage
  damage: { defScale: 100, minDamage: 1 },

  // 플레이어 → 몬스터
  playerAttack: {
    hit:  { base: 0.93, perSpd: 0.01, min: 0.85, max: 0.97 },   // 명중 = base − (몬스터SPD − 내SPD) × perSpd
    crit: { rate: 0.10, mult: 1.5 },
    levelGap: { perLevel: 0.08, floor: 0.45 },                  // 몬스터가 높을 때만: max(floor, 1 − 차 × perLevel)
  },

  // 몬스터 → 플레이어
  monsterAttack: {
    hit:  { base: 0.93, perSpd: 0.01, min: 0.88, max: 0.97 },   // 명중 = base − (내SPD − 몬스터SPD) × perSpd
    crit: { rate: 0.06, mult: 1.4 },
  },

  // 몬스터 데이터에 hp/atk가 없을 때 · SPD 같을 때 플레이어 선공 확률
  monster: { hpFallback: 10, atkFallback: 5, firstTurnTie: 0.5 },

  // 몬스터 역할 기믹 (performPlayerTurn · performMonsterTurn)
  role: {
    tank:   { hpRatio: 0.6, damageTaken: 0.6, counterBuff: 1.15 },  // HP 60% 이하 첫 피격 40% 경감 → 다음 공격 ×1.15
    fast:   { hpRatio: 0.7, extraHitMult: 0.6 },                    // HP 70% 이하 첫 도달 → 다음 몬스터 턴 추가타(급소 없음) ×0.6
    dealer: { maxStacks: 3, perStack: 0.10 },                       // 몬스터 턴마다 +10%, 최대 3
    normal: { onMonsterTurn: 2, buff: 1.6 },                        // monsterTurnCount===2 에 준비 → 다음 공격 ×1.6
  },

  // 전투 스킬 (skill2)
  skill2: {
    healRatio: 0.30,
    prepMult: 2.3,
    rush: { turns: 2, multMin: 1.15, multSpread: 0.20, damageTaken: 1.15 },
    guardMult: 0.5,
    counter: { chance: 0.5, reflectMult: 1.5 },
    reckless: { chance: 0.5, mult: 2.2 },
  },

  // 관리자 설정이 덮을 수 있는 값의 기본 (BATTLE_CONSTS 초기값 · 설정이 없을 때 되돌아갈 값)
  settingsDefaults: {
    ghostNormalMult: 0.55,     // ★ 7단계 조정: 0.35→0.55 (노말 원툴 방지는 유지하되 "불가능" 수준은 아니게)
    dailyBattleLimit: 3,
    infiniteBattleLimit: 1,
    monsterHpMult: 1.0,
    monsterAtkMult: 1.0,
    defAdvMult: 0.85,          // 몸통 방어 상성 유리 (받는 피해 배율)
    defDisMult: 1.15,          // 몸통 방어 상성 불리
    elemDisadvantageFallback: 0.8,   // 관리자 elemChart에 advantageMult만 있을 때 불리 배율
  },

  // 사냥터 카드 3장 (generateBattleOffers)
  offers: {
    zoneRanges: {
      beginner:     { min:1,  max:10 },
      intermediate: { min:11, max:20 },
      advanced:     { min:21, max:30 },
    },
    rarityWeights: [
      { common:1.0, rare:0.2, legend:0.0 }, // 슬롯 0 [P−1, P]
      { common:1.0, rare:1.4, legend:0.0 }, // 슬롯 1 [P, P+1]
      { common:1.0, rare:1.6, legend:2.0 }, // 슬롯 2 [P+1, P+2]
    ],
    unseenWeight: 1.5,                                                          // 도감에 없는 몬스터 우대
    recent: { justNow: 3, justNowWeight: 0.3, lately: 9, latelyWeight: 0.6 },   // 최근 제시 이름이 끝에서 몇 번째인지
    recentKeep: 4,                                                              // recentBattleOffers 이전 4회 + 이번 1회
    maxGhosts: 2,
    thirdSlot: { returnChance: 0.2, maxLevelAbovePlayer: 3 },   // 3번 카드: 20% 확률로 놓친 희귀/전설 복귀, Lv+3까지
  },
};

// ─── 장비 표 만들기 (B-2b) ─────────────────────────────────
// 등급 i(0~9) 장비의 레벨 = BALANCE.equipment.tierLevels[i]. 키 순서는 옛 표와 같게(id·name·lv·stats·cond·price·icon·element).
// 칸별 가격 곡선 — 능력치 합(atk·def·mag·spd)에 대한 거듭제곱
function _equipPrice(slot, stats) {
  const c = BALANCE.equipment.price[slot];
  const sum = Object.values(stats).reduce((a, v) => a + v, 0);
  return Math.round(c.c * Math.pow(sum, c.p));
}
function _equipTiers(slot, rows) {
  return rows.map((r, i) => {
    const item = { id: r.id, name: r.name, lv: BALANCE.equipment.tierLevels[i], stats: r.stats, cond: r.cond, price: _equipPrice(slot, r.stats) + (r.priceAdj || 0), icon: r.icon };
    if (r.element !== undefined) item.element = r.element;
    return item;
  });
}
// 계열 복사: 같은 등급 원본 줄의 레벨·능력치·가격을 쓰고 id·name·cond·icon 은 줄마다 따로 (B-1 §4.3)
//   opt.element — 몸통 속성 · opt.mirror(stats) — 스태프처럼 능력치를 바꿔 쓸 때
function _equipCopy(source, opt, rows) {
  return rows.map((r, i) => {
    const src = source[i];
    const item = { id: r.id, name: r.name, lv: src.lv, stats: opt.mirror ? opt.mirror(src.stats) : { ...src.stats }, cond: r.cond, price: src.price, icon: r.icon };
    if (opt.element !== undefined) item.element = opt.element;
    return item;
  });
}
const _EQUIP_BODY_FIRE = _equipTiers('body', [
  {id:'e_b1', name:'천 옷 (불)',          stats:{def:5},              cond:{},                      priceAdj:+10,    icon:'👕', element:'fire'},
  {id:'e_b2', name:'가죽 갑옷 (불)',      stats:{def:9},              cond:{health:2,life:1},       priceAdj:-18,   icon:'🥋', element:'fire'},
  {id:'e_b3', name:'견습 로브 (불)',      stats:{mag:6, def:4},       cond:{health:4,life:2},       priceAdj:-2,   icon:'🧥', element:'fire'},
  {id:'e_b4', name:'철 갑옷 (불)',        stats:{def:14},             cond:{health:6,life:4},       priceAdj:-20,   icon:'🛡️', element:'fire'},
  {id:'e_b5', name:'연구 로브 (불)',      stats:{mag:11, def:6},      cond:{health:8,life:6},       priceAdj:-13,   icon:'🔬', element:'fire'},
  {id:'e_b6', name:'기사 갑옷 (불)',      stats:{def:20},             cond:{health:10,life:8},      priceAdj:+10,   icon:'⚔️', element:'fire'},
  {id:'e_b7', name:'대마법 로브 (불)',    stats:{mag:18, def:8},      cond:{health:13,life:10},     priceAdj:-19,   icon:'✨', element:'fire'},
  {id:'e_b8', name:'황금 갑옷 (불)',      stats:{def:27},             cond:{health:16,life:13},     priceAdj:+69,   icon:'💛', element:'fire'},
  {id:'e_b9', name:'전설 갑옷 (불)',      stats:{def:34},             cond:{health:19,life:15},     priceAdj:+33,  icon:'🌟', element:'fire'},
  {id:'e_b10',name:'왕의 갑옷 (불)',      stats:{def:40},             cond:{health:21,life:17},     priceAdj:+22,  icon:'👑', element:'fire'},
]);
const _EQUIP_SWORD = _equipTiers('weapon', [
  {id:'e_w1', name:'나무검',     stats:{atk:8,  mag:5},  cond:{},                 priceAdj:+5,    icon:'🗡️'},
  {id:'e_w2', name:'철검',       stats:{atk:12, mag:8},  cond:{health:2,life:1},  priceAdj:-1,   icon:'⚔️'},
  {id:'e_w3', name:'마법검',     stats:{atk:16, mag:11}, cond:{health:4,life:2},  priceAdj:-6,   icon:'🔷'},
  {id:'e_w4', name:'강철검',     stats:{atk:22, mag:15}, cond:{health:6,life:4},  priceAdj:-13,   icon:'🔱'},
  {id:'e_w5', name:'기사검',     stats:{atk:28, mag:19}, cond:{health:8,life:6},  priceAdj:-15,   icon:'🏹'},
  {id:'e_w6', name:'용사검',     stats:{atk:35, mag:23}, cond:{health:10,life:8}, priceAdj:+1,   icon:'⚔️'},
  {id:'e_w7', name:'용기사검',   stats:{atk:43, mag:29}, cond:{health:13,life:10},priceAdj:-1,   icon:'🌟'},
  {id:'e_w8', name:'황금검',     stats:{atk:52, mag:35}, cond:{health:16,life:13},priceAdj:+8,  icon:'✨'},
  {id:'e_w9', name:'전설검',     stats:{atk:62, mag:41}, cond:{health:19,life:15},priceAdj:+25,  icon:'💎'},
  {id:'e_w10',name:'영웅의 검',  stats:{atk:72, mag:48}, cond:{health:21,life:17},priceAdj:+51,  icon:'🌈'},
]);


// ─── 몬스터 능력치 (B-2c) ─────────────────────────────────
// 줄에 적힌 키 순서를 그대로 두고 gold 앞에 hp·atk·def·spd 를 끼운다(옛 표와 같은 순서).
function _monBaseStat(level, stat) {
  const c = BALANCE.monsterStats.base[stat];
  return Math.round(c.a + c.b * level) + (BALANCE.monsterStats.baseAdjust[stat][level] || 0);
}
// ─── 경험치표 (B-2i) ─────────────────────────────────────
function _expTable() {
  const c = BALANCE.exp, t = [0];
  let need = c.firstNeed;
  for (let k = 1; k <= c.maxIndex; k++) {
    if (k > 1) { let add = 0; for (const [from, a] of c.steps) if (k >= from) add = a; need += add + (c.incAdjust[k] || 0); }
    t.push(t[k - 1] + need);
  }
  return t;
}

function _mon(shape, row, adjust) {
  const k = BALANCE.monsterStats.shapes[shape];
  const adj = adjust || {};
  const out = { ...row };
  ['hp', 'atk', 'def', 'spd'].forEach(s => { out[s] = Math.round(_monBaseStat(row.level, s) * k[s]) + (adj[s] || 0); });
  const g = BALANCE.monsterGold;
  out.gold = Math.round((g.base.a + g.base.b * row.level) * g.rarity[row.rarity]) + (adj.gold || 0);
  return out;
}

const GAME_DATA = {

  // ─── EXP 레벨 테이블 (밸런스 조정: 초반 빠르게, 후반 완만하게) ───
  // 하루 퀘스트 2~3개(각 30~50EXP) 기준 → 초반 매일 레벨업, Lv10+ 3~5일에 1번
  // expTable[i] = Lv(i+1)이 되기 위한 누적 EXP
  expTable: _expTable(),   // B-2i: BALANCE.exp 에서 계산 (0, 100, 240, 440, … 34000, 37000)

  // ─── 초기 학생 데이터 (가치 스탯, 새 EXP 기준) ──────────────
  defaultStudents: [
    { id:'s1', name:'학생1', avatar:'👦', pw:'1234', charType:1, dream:'미래를 꿈꾸는 학생', job:'학생',
      level:1, exp:0, gold:0, title:'', titles:[],
      stats:{read:0,study:0,art:0,value:0,health:0,life:0}, combat:{atk:0,def:0,mag:0,spd:0},
      equipment:{}, equipmentIds:{}, inventory:[], farm:[], books:[],
      monsterLog:[], monsterDailyCount:0, lastMonsterDate:'', totalQuests:0, bookCount:0,
      pendingRewards:[], promotionPending:false, houseDecorations:[], yardFloor:{}, lastAttendDate:'', achievements:[]
    },
    { id:'s2', name:'학생2', avatar:'👧', pw:'1234', charType:2, dream:'미래를 꿈꾸는 학생', job:'학생',
      level:1, exp:0, gold:0, title:'', titles:[],
      stats:{read:0,study:0,art:0,value:0,health:0,life:0}, combat:{atk:0,def:0,mag:0,spd:0},
      equipment:{}, equipmentIds:{}, inventory:[], farm:[], books:[],
      monsterLog:[], monsterDailyCount:0, lastMonsterDate:'', totalQuests:0, bookCount:0,
      pendingRewards:[], promotionPending:false, houseDecorations:[], yardFloor:{}, lastAttendDate:'', achievements:[]
    },
    { id:'s3', name:'학생3', avatar:'👦', pw:'1234', charType:1, dream:'미래를 꿈꾸는 학생', job:'학생',
      level:1, exp:0, gold:0, title:'', titles:[],
      stats:{read:0,study:0,art:0,value:0,health:0,life:0}, combat:{atk:0,def:0,mag:0,spd:0},
      equipment:{}, equipmentIds:{}, inventory:[], farm:[], books:[],
      monsterLog:[], monsterDailyCount:0, lastMonsterDate:'', totalQuests:0, bookCount:0,
      pendingRewards:[], promotionPending:false, houseDecorations:[], yardFloor:{}, lastAttendDate:'', achievements:[]
    },
    { id:'s4', name:'학생4', avatar:'👧', pw:'1234', charType:2, dream:'미래를 꿈꾸는 학생', job:'학생',
      level:1, exp:0, gold:0, title:'', titles:[],
      stats:{read:0,study:0,art:0,value:0,health:0,life:0}, combat:{atk:0,def:0,mag:0,spd:0},
      equipment:{}, equipmentIds:{}, inventory:[], farm:[], books:[],
      monsterLog:[], monsterDailyCount:0, lastMonsterDate:'', totalQuests:0, bookCount:0,
      pendingRewards:[], promotionPending:false, houseDecorations:[], yardFloor:{}, lastAttendDate:'', achievements:[]
    },
    { id:'s5', name:'학생5', avatar:'👦', pw:'1234', charType:1, dream:'미래를 꿈꾸는 학생', job:'학생',
      level:1, exp:0, gold:0, title:'', titles:[],
      stats:{read:0,study:0,art:0,value:0,health:0,life:0}, combat:{atk:0,def:0,mag:0,spd:0},
      equipment:{}, equipmentIds:{}, inventory:[], farm:[], books:[],
      monsterLog:[], monsterDailyCount:0, lastMonsterDate:'', totalQuests:0, bookCount:0,
      pendingRewards:[], promotionPending:false, houseDecorations:[], yardFloor:{}, lastAttendDate:'', achievements:[]
    },
    { id:'s6', name:'학생6', avatar:'👧', pw:'1234', charType:2, dream:'미래를 꿈꾸는 학생', job:'학생',
      level:1, exp:0, gold:0, title:'', titles:[],
      stats:{read:0,study:0,art:0,value:0,health:0,life:0}, combat:{atk:0,def:0,mag:0,spd:0},
      equipment:{}, equipmentIds:{},
      inventory:[],
      farm:[], books:[],
      monsterLog:[], monsterDailyCount:0, lastMonsterDate:'', totalQuests:0, bookCount:0,
      pendingRewards:[], promotionPending:false, houseDecorations:[], yardFloor:{}, lastAttendDate:'', achievements:[]
    },
  ],

  // ─── 장비 (4단계: 가격/조건 정비, body 30개, 기존 ID 완전 유지) ────────────
  // ★ cond = 구매 조건 (slot 규칙 반영), 기존 보유 장비엔 cond 미적용
  // 머리=가치+생활, 불몸통=건강+생활, 물몸통=학습+생활, 풀몸통=예술+생활
  // 검=건강+생활, 지팡이=학습+예술, 장갑=가치+건강, 신발=예술+건강
  // ★ B-2b: 등급 i 의 레벨 = BALANCE.equipment.tierLevels[i] (_equipTiers) ·
  //   물·풀 몸통 = 불 몸통 복사, 스태프 = 검 거울 (_equipCopy) — 능력치·가격은 원본 줄 하나만 고치면 따라온다
  equipment: {
    head: _equipTiers('head', [
      {id:'e_h1', name:'천 모자',        stats:{def:3},              cond:{},                      priceAdj:+7,    icon:'🎩'},
      {id:'e_h2', name:'가죽 모자',      stats:{def:5, spd:1},       cond:{value:2,life:1},        priceAdj:-14,   icon:'🪖'},
      {id:'e_h3', name:'견습 마법 모자', stats:{mag:4, def:3},       cond:{value:4,life:2},        priceAdj:-3,   icon:'🧙'},
      {id:'e_h4', name:'기사 투구',      stats:{def:10, spd:2},      cond:{value:6,life:4},        priceAdj:-39,   icon:'⛑️'},
      {id:'e_h5', name:'학자의 모자',    stats:{mag:8, def:4},       cond:{value:8,life:6},        priceAdj:+11,   icon:'🎓'},
      {id:'e_h6', name:'수호 투구',      stats:{def:15, spd:3},      cond:{value:10,life:8},       priceAdj:-19,   icon:'🛡️'},
      {id:'e_h7', name:'대마법 모자',    stats:{mag:13, def:5},      cond:{value:13,life:10},      priceAdj:+66,   icon:'🔮'},
      {id:'e_h8', name:'황금 투구',      stats:{def:21, spd:4},      cond:{value:16,life:13},      priceAdj:+47,   icon:'👑'},
      {id:'e_h9', name:'전설 투구',      stats:{def:26, spd:5},      cond:{value:19,life:15},      priceAdj:+54,  icon:'💎'},
      {id:'e_h10',name:'왕관',           stats:{def:30,mag:8,spd:6}, cond:{value:21,life:17},      priceAdj:-70,  icon:'👑'},
    ]),
    body: [
      // ★ e_b1~e_b10 = 불(fire) — 기존 ID 완전 유지, 조건=건강+생활 (능력치·가격 원본: _EQUIP_BODY_FIRE)
      ..._EQUIP_BODY_FIRE,
      // ★ e_b11~e_b20 = 물(water) — 신규, 조건=학습+생활 · 레벨·능력치·가격은 같은 등급 불 몸통
      ..._equipCopy(_EQUIP_BODY_FIRE, { element:'water' }, [
        {id:'e_b11',name:'물의 천 옷',          cond:{},                      icon:'🩵'},
        {id:'e_b12',name:'물의 가죽 갑옷',      cond:{study:2,life:1},        icon:'💧'},
        {id:'e_b13',name:'물의 견습 로브',      cond:{study:4,life:2},        icon:'🌊'},
        {id:'e_b14',name:'물의 철 갑옷',        cond:{study:6,life:4},        icon:'🐚'},
        {id:'e_b15',name:'물의 연구 로브',      cond:{study:8,life:6},        icon:'🔵'},
        {id:'e_b16',name:'물의 기사 갑옷',      cond:{study:10,life:8},       icon:'🌀'},
        {id:'e_b17',name:'물의 대마법 로브',    cond:{study:13,life:10},      icon:'🫧'},
        {id:'e_b18',name:'물의 황금 갑옷',      cond:{study:16,life:13},      icon:'🔷'},
        {id:'e_b19',name:'물의 전설 갑옷',      cond:{study:19,life:15},      icon:'❄️'},
        {id:'e_b20',name:'물의 왕의 갑옷',      cond:{study:21,life:17},      icon:'🌊'},
      ]),
      // ★ e_b21~e_b30 = 풀(grass) — 신규, 조건=예술+생활 · 레벨·능력치·가격은 같은 등급 불 몸통
      ..._equipCopy(_EQUIP_BODY_FIRE, { element:'grass' }, [
        {id:'e_b21',name:'풀의 천 옷',          cond:{},                      icon:'🌿'},
        {id:'e_b22',name:'풀의 가죽 갑옷',      cond:{art:2,life:1},          icon:'🍃'},
        {id:'e_b23',name:'풀의 견습 로브',      cond:{art:4,life:2},          icon:'🌱'},
        {id:'e_b24',name:'풀의 철 갑옷',        cond:{art:6,life:4},          icon:'🍀'},
        {id:'e_b25',name:'풀의 연구 로브',      cond:{art:8,life:6},          icon:'🌾'},
        {id:'e_b26',name:'풀의 기사 갑옷',      cond:{art:10,life:8},         icon:'🌲'},
        {id:'e_b27',name:'풀의 대마법 로브',    cond:{art:13,life:10},        icon:'🌳'},
        {id:'e_b28',name:'풀의 황금 갑옷',      cond:{art:16,life:13},        icon:'🍁'},
        {id:'e_b29',name:'풀의 전설 갑옷',      cond:{art:19,life:15},        icon:'🌺'},
        {id:'e_b30',name:'풀의 왕의 갑옷',      cond:{art:21,life:17},        icon:'🌸'},
      ]),
    ],
    weapon: [
      // 검 계열(홀수-짝수 섞임): 건강+생활 / 지팡이 계열: 학습+예술
      // ── 검 계열 10개 (ATK:MAG ≈ 3:2) — 원본: _EQUIP_SWORD ──
      ..._EQUIP_SWORD,
      // ── 스태프 계열 10개 (MAG:ATK ≈ 3:2) — 완전 대칭: 같은 등급 검의 ATK↔MAG, 레벨·가격 같음 ──
      ..._equipCopy(_EQUIP_SWORD, { mirror: st => ({ mag: st.atk, atk: st.mag }) }, [
        {id:'e_ws1', name:'나무 스태프',    cond:{},                  icon:'🪄'},
        {id:'e_ws2', name:'철 스태프',      cond:{study:2,art:1},     icon:'🔮'},
        {id:'e_ws3', name:'수정 스태프',    cond:{study:4,art:2},     icon:'💜'},
        {id:'e_ws4', name:'강철 스태프',    cond:{study:6,art:4},     icon:'🌀'},
        {id:'e_ws5', name:'현자의 스태프',  cond:{study:8,art:6},     icon:'⭐'},
        {id:'e_ws6', name:'마법사의 지팡이',cond:{study:10,art:8},    icon:'🔯'},
        {id:'e_ws7', name:'고대 스태프',    cond:{study:13,art:10},   icon:'🌙'},
        {id:'e_ws8', name:'황금 스태프',    cond:{study:16,art:13},   icon:'⚡'},
        {id:'e_ws9', name:'전설 스태프',    cond:{study:19,art:15},   icon:'🌠'},
        {id:'e_ws10',name:'영웅의 스태프',  cond:{study:21,art:17},   icon:'🔯'},
      ]),
    ],
    glove: _equipTiers('glove', [
      {id:'e_g1', name:'천 장갑',         stats:{atk:2, spd:2},      cond:{},                      priceAdj:+4,    icon:'🧤'},
      {id:'e_g2', name:'가죽 장갑',       stats:{atk:3, spd:2, mag:2},cond:{value:2,health:1},     priceAdj:-13,    icon:'🥊'},
      {id:'e_g3', name:'마법 장갑',       stats:{mag:4, spd:3},      cond:{value:4,health:2},      priceAdj:+2,   icon:'✋'},
      {id:'e_g4', name:'철 장갑',         stats:{atk:5, spd:4},      cond:{value:6,health:4},      priceAdj:+1,   icon:'⚙️'},
      {id:'e_g5', name:'연구 장갑',       stats:{mag:7, spd:5},      cond:{value:8,health:6},      priceAdj:-6,   icon:'🔬'},
      {id:'e_g6', name:'기사 장갑',       stats:{atk:8, spd:6},      cond:{value:10,health:8},     priceAdj:+8,   icon:'🏆'},
      {id:'e_g7', name:'마도 장갑',       stats:{mag:10, spd:8},     cond:{value:13,health:10},    priceAdj:-1,   icon:'💫'},
      {id:'e_g8', name:'황금 장갑',       stats:{atk:11, spd:9},     cond:{value:16,health:13},    priceAdj:+27,   icon:'💛'},
      {id:'e_g9', name:'전설 장갑',       stats:{atk:13, spd:11},    cond:{value:19,health:15},    priceAdj:+29,   icon:'💎'},
      {id:'e_g10',name:'영웅 장갑',       stats:{atk:16,spd:12,mag:4},cond:{value:21,health:17},  priceAdj:-43,   icon:'🌟'},
    ]),
    shoe: _equipTiers('shoe', [
      {id:'e_s1', name:'천 신발',         stats:{spd:4, def:1},      cond:{},                      priceAdj:+5,    icon:'👟'},
      {id:'e_s2', name:'가죽 신발',       stats:{spd:6, def:2},      cond:{art:2,health:1},        priceAdj:-15,    icon:'👠'},
      {id:'e_s3', name:'마법 신발',       stats:{spd:6, mag:2},      cond:{art:4,health:2},        priceAdj:+3,   icon:'✨'},
      {id:'e_s4', name:'철 부츠',         stats:{spd:8, def:3},      cond:{art:6,health:4},        priceAdj:-14,   icon:'🥾'},
      {id:'e_s5', name:'연구 부츠',       stats:{spd:9, mag:3},      cond:{art:8,health:6},        priceAdj:+5,   icon:'🔬'},
      {id:'e_s6', name:'기사 부츠',       stats:{spd:11, def:4},     cond:{art:10,health:8},       priceAdj:-1,   icon:'⚔️'},
      {id:'e_s7', name:'마도 부츠',       stats:{spd:13, mag:4},     cond:{art:13,health:10},      priceAdj:+22,   icon:'💫'},
      {id:'e_s8', name:'황금 부츠',       stats:{spd:15, def:5},     cond:{art:16,health:13},      priceAdj:+27,   icon:'💛'},
      {id:'e_s9', name:'전설 부츠',       stats:{spd:18, def:6},     cond:{art:19,health:15},      priceAdj:+5,   icon:'💎'},
      {id:'e_s10',name:'영웅 부츠',       stats:{spd:20, def:8},     cond:{art:21,health:17},      priceAdj:-21,   icon:'🌈'},
    ]),
  },
  // ─── 씨앗 (성장 시간 대폭 단축: 수업 시간 기준) ──────────
  // 수업 중 2~3번 접속 기준: 감자는 쉬는시간에 심으면 점심에 수확 가능
  seeds: [
    // reqLv: 해당 레벨 이상이어야 상점에서 구매 가능
    // 고급 씨앗일수록 시간당 수익이 더 높음 → 레벨업 동기 강화
    {id:'i_potato_seed',    name:'감자 씨앗',  icon:'🥔', price:12,  growHours:20, sellAdj:0,  crop:'potato',     cropIcon:'🥔', reqLv:1},
    {id:'i_carrot_seed',    name:'당근 씨앗',  icon:'🥕', price:20,  growHours:24, sellAdj:+1,  crop:'carrot',     cropIcon:'🥕', reqLv:3},
    {id:'i_corn_seed',      name:'옥수수 씨앗',icon:'🌽', price:30,  growHours:36, sellAdj:+3, crop:'corn',       cropIcon:'🌽', reqLv:5},
    {id:'i_tomato_seed',    name:'토마토 씨앗',icon:'🍅', price:40,  growHours:48, sellAdj:+2, crop:'tomato',     cropIcon:'🍅', reqLv:8},
    {id:'i_strawberry_seed',name:'딸기 씨앗',  icon:'🍓', price:60, growHours:72, sellAdj:0, crop:'strawberry', cropIcon:'🍓', reqLv:12},
  ],

  // ── 돌연변이 씨앗 (일반 씨앗과 별도 관리) ───────────────────────────
  // 수확 시 성공/실패 판정: 성공=baseSellPrice*2, 실패=0G
  // isMutant:true 로 일반 씨앗과 구분
  // ★ B-2f: 값은 GAME_DATA 정의 바로 뒤 _mutantSeeds() 가 일반 씨앗 + BALANCE.mutantSeed 로 채운다(키 순서 옛 표와 같음)
  mutantSeeds: [],

  // ─── 장식물 ────────────────────────────────────────────
  decorations: [
    // ── 마당 (yard) ──
    // ⚪ 일반 Lv1+
    {id:'d_y1', name:'장미 꽃밭',    icon:'🌹', priceAdj:-8,  cat:'yard',   rarity:'common', reqLv:1},
    {id:'d_y2', name:'튤립',          icon:'🌷', priceAdj:-3,  cat:'yard',   rarity:'common', reqLv:1},
    {id:'d_y3', name:'선인장',        icon:'🌵', priceAdj:0,  cat:'yard',   rarity:'common', reqLv:1},
    {id:'d_y4', name:'정원석',        icon:'🪨', priceAdj:+5,  cat:'yard',   rarity:'common', reqLv:1},
    // 🔵 희귀 Lv5+
    {id:'d_y5', name:'정원 벤치',     icon:'🪑', size:{w:2,h:1}, priceAdj:-20, cat:'yard',   rarity:'rare',   reqLv:1},
    {id:'d_y6', name:'가로등',        icon:'🏮', priceAdj:-8, cat:'yard',   rarity:'rare',   reqLv:1},
    {id:'d_y7', name:'해바라기', icon:'🌻', priceAdj:+5, cat:'yard',   rarity:'rare',   reqLv:1},
    {id:'d_y8', name:'허수아비',      icon:'🧹', priceAdj:+25, cat:'yard',   rarity:'rare',   reqLv:1},
    // 🟣 영웅 Lv10+
    {id:'d_y9', name:'작은 나무',     icon:'🌲', size:{w:2,h:2}, priceAdj:-60, cat:'yard',   rarity:'epic',   reqLv:1},
    {id:'d_y10',name:'분수',          icon:'⛲', size:{w:2,h:2}, priceAdj:-23, cat:'yard',   rarity:'epic',   reqLv:1},
    {id:'d_y11',name:'풍차',          icon:'🌀', size:{w:2,h:2}, priceAdj:+15, cat:'yard',   rarity:'epic',   reqLv:1},
    // 🟡 전설 Lv20+
    {id:'d_y12',name:'벚나무',        icon:'🌸', size:{w:3,h:3}, priceAdj:-75, cat:'yard',   rarity:'legend', reqLv:1},
    {id:'d_y13',name:'마법석',   icon:'💎', priceAdj:0, cat:'yard',   rarity:'legend', reqLv:1},
    {id:'d_y14',name:'황금 석등',     icon:'🌟', priceAdj:+75, cat:'yard',   rarity:'legend', reqLv:1},

    // ── 공원/정원 테마 ─────────────────────────────────────
    {id:'d_y15',name:'낮은 관목',     icon:'🌿', priceAdj:-3,  cat:'yard',   rarity:'common', reqLv:1},
    {id:'d_y16',name:'큰 화단',       icon:'🌺', size:{w:2,h:2}, priceAdj:0, cat:'yard', rarity:'rare',   reqLv:1, hidden:true},   // [DECO-RETIRE-2] 상점에서만 뺀다(가진 것·놓은 것은 그대로) — 대신 정원 바닥 + 벽돌 마감
    {id:'d_y17',name:'정자',          icon:'⛩️', size:{w:2,h:2}, priceAdj:+40, cat:'yard', rarity:'rare',   reqLv:1},
    {id:'d_y18',name:'돌 벤치',       icon:'🪑', size:{w:2,h:1}, priceAdj:-10, cat:'yard', rarity:'rare',   reqLv:1},
    {id:'d_y19',name:'큰 나무 B',     icon:'🌳', size:{w:2,h:2}, priceAdj:-80, cat:'yard', rarity:'epic',   reqLv:1},
    {id:'d_y20',name:'조형 분수',     icon:'⛲', size:{w:3,h:3}, priceAdj:+50, cat:'yard', rarity:'epic',   reqLv:1},
    {id:'d_y21',name:'장미 아치',     icon:'🌹', size:{w:1,h:3}, priceAdj:+20, cat:'yard', rarity:'rare',   reqLv:1},

    // ── 농촌 테마 ───────────────────────────────────────────
    {id:'d_y22',name:'나무상자',      icon:'📦', priceAdj:+2,  cat:'yard',   rarity:'common', reqLv:1},
    {id:'d_y23',name:'장작더미',      icon:'🪵', priceAdj:+10,  cat:'yard',   rarity:'common', reqLv:1},
    {id:'d_y24',name:'건초더미',      icon:'🌾', priceAdj:0,  cat:'yard',   rarity:'common', reqLv:1},
    {id:'d_y25',name:'밀밭',          icon:'🌾', size:{w:2,h:2}, priceAdj:-10, cat:'yard', rarity:'rare',   reqLv:1},
    {id:'d_y26',name:'큰 바위',       icon:'🪨', size:{w:2,h:1}, priceAdj:-15, cat:'yard', rarity:'rare',   reqLv:1},
    {id:'d_y27',name:'우물',          icon:'🪣', size:{w:2,h:2}, priceAdj:+25, cat:'yard', rarity:'rare',   reqLv:1},
    {id:'d_y28',name:'헛간',          icon:'🏚️', size:{w:3,h:2}, priceAdj:-35, cat:'yard', rarity:'legend', reqLv:1},

    // ── 연못/물가 테마 ──────────────────────────────────────
    {id:'d_y29',name:'갈대 묶음',     icon:'🌿', priceAdj:0,  cat:'yard',   rarity:'common', reqLv:1},
    {id:'d_y30',name:'징검돌',        icon:'🪨', priceAdj:-5,  cat:'yard',   rarity:'common', reqLv:1},
    {id:'d_y31',name:'작은 연못',     icon:'🪷', size:{w:3,h:3}, priceAdj:+10, cat:'yard', rarity:'epic',   reqLv:1, hidden:true},   // [DECO-RETIRE-2] 상점에서만 뺀다(가진 것·놓은 것은 그대로) — 대신 🖌 물 바닥(+물가)
    {id:'d_y32',name:'오리 가족',     icon:'🦆', size:{w:2,h:1}, priceAdj:-5, cat:'yard', rarity:'rare',   reqLv:1},

    // ── 건물 테마 ───────────────────────────────────────────
    {id:'d_y33',name:'오두막',   icon:'🏠', size:{w:2,h:2}, priceAdj:-135, cat:'yard', rarity:'legend', reqLv:1},

    // ── 2차 확장: 건물/생활 ─────────────────────────────────
    {id:'d_y34',name:'작은 창고',     icon:'🏚️', size:{w:2,h:2}, priceAdj:0, cat:'yard', rarity:'epic',   reqLv:1},

    // ── 2차 확장: 농촌 심화 ─────────────────────────────────
    {id:'d_y35',name:'밀밭 B형',      icon:'🌾', size:{w:2,h:2}, priceAdj:-5,  cat:'yard', rarity:'rare',   reqLv:1, hidden:true},   // [DECO-RETIRE-2] 상점에서만 뺀다(가진 것·놓은 것은 그대로) — 대신 밀밭 d_y25
    {id:'d_y36',name:'보리밭',        icon:'🌾', size:{w:2,h:2}, priceAdj:-5,  cat:'yard', rarity:'rare',   reqLv:1},
    {id:'d_y37',name:'장작더미 2',  icon:'🪵', priceAdj:+15,       cat:'yard', rarity:'common', reqLv:1, hidden:true},   // [DECO-RETIRE-2] 상점에서만 뺀다(가진 것·놓은 것은 그대로) — 대신 장작더미 d_y23
    {id:'d_y38',name:'큰 바위 2',   icon:'🪨', size:{w:2,h:1}, priceAdj:-10,  cat:'yard', rarity:'rare',   reqLv:1, hidden:true},   // [DECO-RETIRE-2] 상점에서만 뺀다(가진 것·놓은 것은 그대로) — 대신 큰 바위 d_y26

    // ── 2차 확장: 정적 동물 ─────────────────────────────────
    {id:'d_y39',name:'닭 3마리',      icon:'🐔', size:{w:2,h:1}, priceAdj:0,  cat:'yard', rarity:'rare',   reqLv:1},
    {id:'d_y40',name:'양',            icon:'🐑', size:{w:2,h:1}, priceAdj:+30, cat:'yard', rarity:'rare',   reqLv:1},

    // ── 2차 확장: 꽃 다양화 ─────────────────────────────────
    {id:'d_y41',name:'라벤더',   icon:'💜', priceAdj:-2,       cat:'yard', rarity:'common', reqLv:1},
    {id:'d_y42',name:'데이지',   icon:'🌼', priceAdj:-2,       cat:'yard', rarity:'common', reqLv:1},
    {id:'d_y43',name:'장미 B형',      icon:'🌹', priceAdj:-2,       cat:'yard', rarity:'common', reqLv:1},
    {id:'d_y44',name:'튤립 B형',      icon:'🌷', priceAdj:-2,       cat:'yard', rarity:'common', reqLv:1},

    // ── 2차 확장: 식생/나무 ─────────────────────────────────
    {id:'d_y45',name:'키 큰 풀숲',    icon:'🌿', priceAdj:-5,       cat:'yard', rarity:'common', reqLv:1},
    {id:'d_y46',name:'침엽수',   icon:'🌲', size:{w:2,h:2}, priceAdj:+50, cat:'yard', rarity:'rare',   reqLv:1},
    {id:'d_y47',name:'둥근 나무 2', icon:'🌳', size:{w:2,h:2}, priceAdj:+60, cat:'yard', rarity:'rare',   reqLv:1, hidden:true},   // [DECO-RETIRE-2] 상점에서만 뺀다(가진 것·놓은 것은 그대로) — 대신 작은 나무 d_y9
    {id:'d_y48',name:'과수나무',      icon:'🍎', size:{w:2,h:2}, priceAdj:+120, cat:'yard', rarity:'common', reqLv:1},

    // ── 목재 울타리 — 한 종만 상점에 둔다(놓으면 이웃을 보고 네 모양 중 맞는 것으로 그려진다, DECO-FENCE-1)
    //    옛 4종은 hidden:true 로 상점에서만 감춘다 — 아이가 이미 산 것은 가방에서 그대로 놓인다
    {id:'d_y70',name:'울타리',        icon:'🚧', priceAdj:-10, cat:'yard', rarity:'common', reqLv:1, autoFence:true, newUntil:'2026-09-27'},
    // 아래로 꺾이는 모퉁이 두 장 — **그림 전용**(값 0·hidden 이라 상점에 안 뜬다). 자동 이음이 id 로 찾아 쓴다
    {id:'d_y71',name:'울타리 모퉁이 ┌', icon:'🚧', priceAdj:-20, cat:'yard', rarity:'common', reqLv:1, hidden:true},
    {id:'d_y72',name:'울타리 모퉁이 ┐', icon:'🚧', priceAdj:-20, cat:'yard', rarity:'common', reqLv:1, hidden:true},
    // ── 목재 울타리 4종 ─────────────────────────────────────
    {id:'d_y49',name:'가로 울타리',  icon:'🪵', priceAdj:-10, cat:'yard', rarity:'common', reqLv:1, hidden:true},
    {id:'d_y50',name:'세로 울타리',  icon:'🪵', priceAdj:-10, cat:'yard', rarity:'common', reqLv:1, hidden:true},
    {id:'d_y51',name:'왼쪽 코너', icon:'🪵', priceAdj:-10, cat:'yard', rarity:'common', reqLv:1, hidden:true},
    {id:'d_y52',name:'오른쪽 코너', icon:'🪵', priceAdj:-10, cat:'yard', rarity:'common', reqLv:1, hidden:true},

    // ── 3차 확장: 걷는 동물 (DECO-ANIM-1) — 낱마리라 마당을 돌아다닐 수 있다
    {id:'d_y53',name:'강아지',        icon:'🐶', priceAdj:0,  cat:'yard', rarity:'rare',   reqLv:1, newUntil:'2026-09-27'},
    {id:'d_y54',name:'고양이',        icon:'🐱', priceAdj:0,  cat:'yard', rarity:'rare',   reqLv:1, newUntil:'2026-09-27'},
    {id:'d_y55',name:'닭 1마리',    icon:'🐔', priceAdj:-30, cat:'yard', rarity:'rare',   reqLv:1, newUntil:'2026-09-27'},
    {id:'d_y56',name:'오리 1마리',  icon:'🦆', priceAdj:-30, cat:'yard', rarity:'rare',   reqLv:1, newUntil:'2026-09-27'},
    {id:'d_y57',name:'양 1마리',    icon:'🐑', priceAdj:-30, cat:'yard', rarity:'rare',   reqLv:1, newUntil:'2026-09-27'},

    // ── 4차 확장: 넓어진 마당용 큰 장식 (DECO-LAND-1 뒤) — pen 은 동물이 안에서만 돌아다니는 우리
    {id:'d_y58',name:'닭장',          icon:'🐔', size:{w:4,h:3}, priceAdj:0, cat:'yard', rarity:'epic',   reqLv:1, pen:true, newUntil:'2026-09-27'},
    {id:'d_y59',name:'큰 연못',       icon:'🦆', size:{w:5,h:4}, priceAdj:0, cat:'yard', rarity:'legend', reqLv:1, pen:true, penWater:true, newUntil:'2026-09-27', hidden:true},   // [DECO-RETIRE-2] 상점에서만 뺀다(가진 것·놓은 것은 그대로) — 대신 🖌 물 바닥(+물가)
    {id:'d_y60',name:'양 목장',       icon:'🐑', size:{w:5,h:4}, priceAdj:0, cat:'yard', rarity:'legend', reqLv:1, pen:true, newUntil:'2026-09-27'},
    {id:'d_y61',name:'꽃길',     icon:'🌸', size:{w:3,h:1}, priceAdj:0, cat:'yard', rarity:'common', reqLv:1, hidden:true, newUntil:'2026-09-27'},   // [DECO-RETIRE-1] 🖌 바닥(꽃밭·자갈)으로 같은 것을 칠할 수 있어 상점에서만 뺀다 — 가진 것·놓은 것은 그대로
    {id:'d_y62',name:'강아지 마당',   icon:'🐶', size:{w:4,h:3}, priceAdj:0, cat:'yard', rarity:'epic',   reqLv:1, pen:true, newUntil:'2026-09-27'},
    {id:'d_y63',name:'놀이터',        icon:'🛝', size:{w:4,h:4}, priceAdj:-75, cat:'yard', rarity:'legend', reqLv:1, newUntil:'2026-09-27'},
    {id:'d_y64',name:'과수원',        icon:'🍎', size:{w:4,h:4}, priceAdj:-75, cat:'yard', rarity:'legend', reqLv:1, newUntil:'2026-09-27', hidden:true},   // [DECO-RETIRE-2] 상점에서만 뺀다(가진 것·놓은 것은 그대로) — 대신 과수나무 d_y48 넷
    {id:'d_y65',name:'자갈길',   icon:'🪨', size:{w:3,h:1}, priceAdj:0, cat:'yard', rarity:'common', reqLv:1, hidden:true, newUntil:'2026-09-27'},   // [DECO-RETIRE-1] 🖌 바닥(꽃밭·자갈)으로 같은 것을 칠할 수 있어 상점에서만 뺀다 — 가진 것·놓은 것은 그대로
    {id:'d_y66',name:'큰 헛간',       icon:'🏚️', size:{w:4,h:3}, priceAdj:-150, cat:'yard', rarity:'legend', reqLv:1, newUntil:'2026-09-27', hidden:true},   // [DECO-RETIRE-2] 상점에서만 뺀다(가진 것·놓은 것은 그대로) — 대신 헛간 d_y28
    {id:'d_y67',name:'온실',          icon:'🪴', size:{w:4,h:3}, priceAdj:0, cat:'yard', rarity:'epic',   reqLv:1, newUntil:'2026-09-27'},
    {id:'d_y68',name:'캠프파이어', icon:'🔥', size:{w:3,h:3}, priceAdj:0, cat:'yard', rarity:'epic',   reqLv:1, newUntil:'2026-09-27'},

    // ── 쓰는 방식 1차 — 놓으면 동물이 모이는 물건 (모이는 규칙은 움직임 코드)
    {id:'d_y69',name:'먹이통',        icon:'🥣', priceAdj:0, cat:'yard', rarity:'common', reqLv:1, feeder:true, newUntil:'2026-09-27'},

    // ── 다듬은 나무(토피어리) 7모양 — 1×1, 위로 솟음. kind/group 은 서랍 묶음(아직 코드가 안 읽음 → 무시됨)
    //    colors: 같은 그림 파일 안의 잎색(주소 뒤 #lime·#autumn). 색 고르기 코드가 붙기 전엔 기본 초록으로만 보인다
    //    곰·오리는 살 수 없는 도감 선물(price:0 → 상점에 안 뜸). gift 는 받는 조건 — 도감 코드가 붙기 전엔 아무도 못 받는다
    {id:'d_y85',name:'공 나무',   icon:'🌳', priceAdj:0,   cat:'yard', rarity:'rare', reqLv:1, kind:'plant', group:'topiary', colors:['lime','autumn'], newUntil:'2026-09-27'},
    {id:'d_y86',name:'원뿔 나무', icon:'🌲', priceAdj:0,   cat:'yard', rarity:'rare', reqLv:1, kind:'plant', group:'topiary', colors:['lime','autumn'], newUntil:'2026-09-27'},
    {id:'d_y87',name:'원통 나무', icon:'🌳', priceAdj:0,   cat:'yard', rarity:'rare', reqLv:1, kind:'plant', group:'topiary', colors:['lime','autumn'], newUntil:'2026-09-27'},
    {id:'d_y88',name:'나선 나무', icon:'🌳', priceAdj:0,   cat:'yard', rarity:'rare', reqLv:1, kind:'plant', group:'topiary', colors:['lime','autumn'], newUntil:'2026-09-27'},
    {id:'d_y89',name:'토끼 나무', icon:'🐰', priceAdj:+30, cat:'yard', rarity:'rare', reqLv:1, kind:'plant', group:'topiary', colors:['lime','autumn'], newUntil:'2026-09-27'},
    {id:'d_y90',name:'곰 나무 (선물)',  icon:'🐻', price:0, cat:'yard', rarity:'epic', reqLv:1, kind:'plant', group:'topiary', colors:['lime','autumn'], gift:{need:'topiary', count:5}},
    {id:'d_y91',name:'오리 나무 (선물)', icon:'🦆', price:0, cat:'yard', rarity:'epic', reqLv:1, kind:'plant', group:'topiary', colors:['lime','autumn'], gift:{need:'plant', count:12}},
    // ── 집 안 (indoor) ──
    // ⚪ 일반 Lv1+
    {id:'d_i1', name:'화분',          icon:'🪴', priceAdj:-5,  cat:'indoor', rarity:'common', reqLv:1},
    {id:'d_i2', name:'램프',          icon:'💡', priceAdj:0,  cat:'indoor', rarity:'common', reqLv:1},
    {id:'d_i3', name:'시계',          icon:'🕰️', priceAdj:+5,  cat:'indoor', rarity:'common', reqLv:1},
    {id:'d_i4', name:'그림 액자',     icon:'🖼️', priceAdj:+10,  cat:'indoor', rarity:'common', reqLv:1},
    // 🔵 희귀 Lv5+
    {id:'d_i5', name:'책상',          icon:'🖥️', size:{w:2,h:1}, priceAdj:-20, cat:'indoor', rarity:'rare',   reqLv:1},
    {id:'d_i6', name:'책장',          icon:'📚', size:{w:1,h:2}, priceAdj:0, cat:'indoor', rarity:'rare',   reqLv:1},
    {id:'d_i7', name:'TV',            icon:'📺', size:{w:2,h:1}, priceAdj:+10, cat:'indoor', rarity:'rare',   reqLv:1},
    {id:'d_i8', name:'소파',          icon:'🛋️', size:{w:3,h:1}, priceAdj:+25, cat:'indoor', rarity:'rare',   reqLv:1},
    // 🟣 영웅 Lv10+
    {id:'d_i9', name:'피아노',        icon:'🎹', size:{w:2,h:2}, priceAdj:-60, cat:'indoor', rarity:'epic',   reqLv:1},
    {id:'d_i10',name:'침대',          icon:'🛏️', size:{w:2,h:2}, priceAdj:-23, cat:'indoor', rarity:'epic',   reqLv:1},
    {id:'d_i11',name:'수족관',        icon:'🐠', size:{w:3,h:1}, priceAdj:+15, cat:'indoor', rarity:'epic',   reqLv:1},
    // 🟡 전설 Lv20+
    {id:'d_i12',name:'금빛 책장',     icon:'📖', size:{w:2,h:2}, priceAdj:-75, cat:'indoor', rarity:'legend', reqLv:1},
    {id:'d_i13',name:'마법 거울',     icon:'🪞', size:{w:1,h:2}, priceAdj:0, cat:'indoor', rarity:'legend', reqLv:1},
    {id:'d_i14',name:'왕의 의자',     icon:'👑', size:{w:1,h:2}, priceAdj:+75, cat:'indoor', rarity:'legend', reqLv:1},
    // ── 러그 (layer:'floor' = 가구·캐릭터 뒤 바닥 레이어에 그림, FLOOR-SVG-1) ──
    {id:'d_i15',name:'둥근 러그',     icon:'🟠', size:{w:2,h:2}, priceAdj:+20,  cat:'indoor', rarity:'rare',   reqLv:1, layer:'floor'},
    {id:'d_i16',name:'네모 러그',     icon:'🟦', size:{w:3,h:2}, priceAdj:+50, cat:'indoor', rarity:'rare',   reqLv:1, layer:'floor'},
    // ── 집 안 두꺼운 벽 묶음 (DECO-INDOOR-ITEMS-1 · 디자인 docs/indoor_walls_20260923.md · 값은 사용자 승인 09-24: 벽걸이 = 액자 값대 · 긴 탁자 = 소파 값대 · 의자 = 램프 값대) ──
    {id:'in_w_curtain',   name:'커튼 창',   icon:'🪟', priceAdj:+10, cat:'indoor', rarity:'common', reqLv:1},
    {id:'in_w_window2',   name:'긴 창',     icon:'🪟', size:{w:2,h:1}, priceAdj:+10, cat:'indoor', rarity:'common', reqLv:1},
    {id:'in_w_clock',     name:'벽시계',    icon:'🕗', priceAdj:+10, cat:'indoor', rarity:'common', reqLv:1},
    {id:'in_w_board',     name:'게시판',    icon:'📌', size:{w:2,h:1}, priceAdj:+10, cat:'indoor', rarity:'common', reqLv:1},
    {id:'in_w_shelf',     name:'벽 선반',   icon:'🧺', priceAdj:+10, cat:'indoor', rarity:'common', reqLv:1},
    {id:'in_w_bookshelf', name:'걸이 책장', icon:'📚', priceAdj:+10, cat:'indoor', rarity:'common', reqLv:1},
    {id:'in_table_long',  name:'긴 탁자',   icon:'🪵', size:{w:4,h:2}, priceAdj:+25, cat:'indoor', rarity:'rare',   reqLv:1},
    {id:'in_chair_front', name:'의자(앞)',  icon:'🪑', priceAdj:0,  cat:'indoor', rarity:'common', reqLv:1},
    {id:'in_chair_back',  name:'의자(뒤)',  icon:'🪑', priceAdj:0,  cat:'indoor', rarity:'common', reqLv:1},
    // ── 업적 전용 (상점 미판매, price:0) ──
    {id:'deco_trophy',    name:'트로피 (업적)',    icon:'🏆', price:0, cat:'yard',   rarity:'legend', reqLv:1},
    {id:'deco_bookshelf', name:'황금 책장 (업적)', icon:'📚', price:0, cat:'indoor', rarity:'legend', reqLv:1},
    {id:'deco_garden',    name:'비밀 정원 (업적)', icon:'🌺', price:0, cat:'yard',   rarity:'legend', reqLv:1},
  ],

  // ─── 몬스터 (밸런스 v4: 1학기 18주 기준 EXP 재조정) ─────────────
  // 저레벨 몬스터 EXP 대폭 상향 → 초반 레벨업 빠르게, 후반은 완만하게
  // ─── 몬스터 100마리 (5단계 최종 확정) ─────────────────────────────
  // ★ m1~m20: 기존 ID/이름/icon 완전 유지 (monsterLog 호환)
  // ★ m21~m100: 신규 추가
  // 유령형 31마리: 초급3 / 중급20 / 고급8
  // ★ B-2c: 능력치는 _mon('base'|'tank'|'fast', 줄, 보정) — BALANCE.monsterStats 에서 계산
  // ★ B-2d: 골드도 _mon 이 BALANCE.monsterGold 곡선으로 계산 — 줄의 { gold: ±n } 은 옛 손값과의 차이
  monsters: [
    // ══ 초급 beginner Lv1~10 (30마리) ══════════════════════════
    // Lv1
    _mon('base', {id:'m1', name:'슬라임',         icon:'🟢',recLv:1, reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:1,  element:'grass',rarity:'common', role:'normal', trait:null}, { gold: +5 }),
    _mon('fast', {id:'m21',name:'불씨 참새',       icon:'🐦',recLv:1, reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:1,  element:'fire', rarity:'common', role:'normal', trait:null}, { gold: +5 }),
    _mon('base', {id:'m22',name:'물방울 젤리',     icon:'🫧',recLv:1, reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:1,  element:'water',rarity:'common', role:'normal', trait:null}, { gold: +5 }),
    // Lv2
    _mon('base', {id:'m2', name:'아기 멧돼지',     icon:'🐗',recLv:2, reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:2,  element:'fire', rarity:'common', role:'normal', trait:null}, { gold: +4 }),
    _mon('base', {id:'m23',name:'거품 개구리',     icon:'🐸',recLv:2, reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:2,  element:'water',rarity:'common', role:'normal', trait:null}, { gold: +4 }),
    _mon('fast', {id:'m24',name:'새싹 다람쥐',     icon:'🐿️',recLv:2, reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:2,  element:'grass',rarity:'common', role:'normal', trait:null}, { gold: +4 }),
    // Lv3
    _mon('fast', {id:'m25',name:'꼬마 화염벌',     icon:'🐝',recLv:3, reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:3,  element:'fire', rarity:'common', role:'fast',   trait:null}, { gold: +2 }),
    _mon('tank', {id:'m26',name:'조약돌 게',       icon:'🦀',recLv:3, reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:3,  element:'water',rarity:'common', role:'tank',   trait:null}, { gold: +2 }),
    _mon('base', {id:'m27',name:'덩굴 병아리',     icon:'🐣',recLv:3, reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:3,  element:'grass',rarity:'common', role:'normal', trait:null}, { gold: +2 }),
    // Lv4
    _mon('base', {id:'m28',name:'불꽃 강아지',     icon:'🐕',recLv:4, reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:4,  element:'fire', rarity:'common', role:'normal', trait:null}, { gold: +1 }),
    _mon('fast', {id:'m4', name:'들쥐',           icon:'🐭',recLv:4, reqStat:'spd',reqVal:0, exp:0, zone:'beginner',    level:4,  element:'water',rarity:'common', role:'fast',   trait:null}, { gold: +1 }),
    _mon('base', {id:'m29',name:'이끼 버섯이',     icon:'🍄',recLv:4, reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:4,  element:'grass',rarity:'common', role:'normal', trait:null}, { gold: +1 }),
    // Lv5
    _mon('fast', {id:'m30',name:'재털이 고양이',   icon:'🐈',recLv:5, reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:5,  element:'fire', rarity:'common', role:'fast',   trait:null}, { gold: -1 }),
    _mon('tank', {id:'m5', name:'돌거북',         icon:'🐢',recLv:5, reqStat:'def',reqVal:0, exp:0, zone:'beginner',    level:5,  element:'water',rarity:'common', role:'tank',   trait:null}, { gold: -1 }),
    _mon('base', {id:'m31',name:'잎새 사슴벌레',   icon:'🦋',recLv:5, reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:5,  element:'grass',rarity:'common', role:'normal', trait:null}, { gold: -1 }),
    // Lv6
    _mon('base', {id:'m6', name:'고블린',         icon:'👺',recLv:6, reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:6,  element:'fire', rarity:'common', role:'normal', trait:null}, { gold: -1 }),
    _mon('base', {id:'m32',name:'안개 오리',       icon:'🦆',recLv:6, reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:6,  element:'water',rarity:'common', role:'normal', trait:null}, { gold: -1 }),
    _mon('tank', {id:'m33',name:'덩굴 두더지',     icon:'🦔',recLv:6, reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:6,  element:'grass',rarity:'common', role:'tank',   trait:null}, { def: +1, gold: -1 }),
    // Lv7
    _mon('fast', {id:'m34',name:'불꽃 박쥐',       icon:'🦇',recLv:7, reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:7,  element:'fire', rarity:'rare',   role:'normal', trait:'ghost'}, { gold: +3 }),
    _mon('base', {id:'m3', name:'마법 애벌레',     icon:'🐛',recLv:7, reqStat:'mag',reqVal:0, exp:0, zone:'beginner',    level:7,  element:'water',rarity:'rare',   role:'dealer', trait:'ghost'}, { gold: +3 }),
    _mon('fast', {id:'m7', name:'숲 늑대',        icon:'🐺',recLv:7, reqStat:'spd',reqVal:0, exp:0, zone:'beginner',    level:7,  element:'grass',rarity:'rare',   role:'fast',   trait:null}, { gold: +3 }),
    // Lv8
    _mon('base', {id:'m35',name:'유황 두더지',     icon:'🐀',recLv:8, reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:8,  element:'fire', rarity:'rare',   role:'tank',   trait:null}, { gold: +2 }),
    _mon('base', {id:'m8', name:'마도 고양이',     icon:'🐱',recLv:8, reqStat:'mag',reqVal:0, exp:0, zone:'beginner',    level:8,  element:'water',rarity:'rare',   role:'normal', trait:null}, { gold: +2 }),
    _mon('tank', {id:'m36',name:'껍질 사슴',       icon:'🦌',recLv:8, reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:8,  element:'grass',rarity:'rare',   role:'tank',   trait:null}, { gold: +2 }),
    // Lv9
    _mon('base', {id:'m37',name:'재의 기사견',     icon:'🐩',recLv:9, reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:9,  element:'fire', rarity:'rare',   role:'normal', trait:null}, { gold: +1 }),
    _mon('tank', {id:'m38',name:'소용돌이 거북',   icon:'🐠',recLv:9, reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:9,  element:'water',rarity:'rare',   role:'tank',   trait:null}, { gold: +1 }),
    _mon('tank', {id:'m9', name:'강철 딱정벌레',   icon:'🪲',recLv:9, reqStat:'def',reqVal:0, exp:0, zone:'beginner',    level:9,  element:'grass',rarity:'rare',   role:'tank',   trait:null}, { gold: +1 }),
    // Lv10
    _mon('base', {id:'m10',name:'오크 전사',       icon:'👹',recLv:10,reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:10, element:'fire', rarity:'legend', role:'dealer', trait:null}, { hp: -9, atk: +6 }),
    _mon('base', {id:'m39',name:'심연 망령어',     icon:'🐟',recLv:10,reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:10, element:'water',rarity:'rare',   role:'normal', trait:'ghost'}, { gold: +20 }),
    _mon('tank', {id:'m40',name:'고목 수호자',     icon:'🌳',recLv:10,reqStat:'atk',reqVal:0, exp:0, zone:'beginner',    level:10, element:'grass',rarity:'rare',   role:'tank',   trait:null}, { def: +1, gold: +20 }),
    // ══ 중급 intermediate Lv11~20 (50마리) ══════════════════════
    // Lv11
    _mon('base', {id:'m41',name:'화염 멧토끼',     icon:'🐇',recLv:11,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:11, element:'fire', rarity:'common', role:'normal', trait:null}, { gold: -2 }),
    _mon('base', {id:'m42',name:'재그늘 사냥개',   icon:'🐕‍🦺',recLv:11,reqStat:'atk',reqVal:0,exp:0, zone:'intermediate',level:11, element:'fire', rarity:'common', role:'fast',   trait:null}, { gold: -2 }),
    _mon('base', {id:'m43',name:'물결 족제비',     icon:'🦦',recLv:11,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:11, element:'water',rarity:'common', role:'fast',   trait:null}, { gold: -2 }),
    _mon('base', {id:'m11',name:'그림자 늑대',     icon:'🦊',recLv:11,reqStat:'spd',reqVal:0, exp:0, zone:'intermediate',level:11, element:'grass',rarity:'common', role:'normal', trait:'ghost'}, { gold: -2 }),
    _mon('fast', {id:'m44',name:'잎날 도마뱀',     icon:'🦎',recLv:11,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:11, element:'grass',rarity:'common', role:'fast',   trait:null}, { spd: +1, gold: -2 }),
    // Lv12
    _mon('base', {id:'m45',name:'불사슴',         icon:'🦌',recLv:12,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:12, element:'fire', rarity:'common', role:'dealer', trait:null}, { gold: -2 }),
    _mon('tank', {id:'m12',name:'철 골렘',        icon:'🤖',recLv:12,reqStat:'def',reqVal:0, exp:0, zone:'intermediate',level:12, element:'water',rarity:'common', role:'tank',   trait:null}, { hp: -1, atk: -1, gold: -2 }),
    _mon('base', {id:'m46',name:'안개 수비병',     icon:'👤',recLv:12,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:12, element:'water',rarity:'common', role:'normal', trait:'ghost'}, { gold: -2 }),
    _mon('fast', {id:'m47',name:'가시 까마귀',     icon:'🐦‍⬛',recLv:12,reqStat:'atk',reqVal:0,exp:0, zone:'intermediate',level:12, element:'grass',rarity:'common', role:'fast',   trait:null}, { gold: -2 }),
    _mon('base', {id:'m48',name:'숲그림 버섯병',   icon:'🍄',recLv:12,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:12, element:'grass',rarity:'common', role:'normal', trait:null}, { gold: -2 }),
    // Lv13
    _mon('base', {id:'m13',name:'마도 정령',       icon:'💨',recLv:13,reqStat:'mag',reqVal:0, exp:0, zone:'intermediate',level:13, element:'fire', rarity:'rare',   role:'dealer', trait:'ghost'}, { gold: +14 }),
    _mon('base', {id:'m49',name:'숯늑대',         icon:'🐺',recLv:13,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:13, element:'fire', rarity:'common', role:'fast',   trait:'ghost'}, { gold: -4 }),
    _mon('base', {id:'m50',name:'늪지 거미',       icon:'🕷️',recLv:13,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:13, element:'water',rarity:'common', role:'fast',   trait:null}, { gold: -4 }),
    _mon('tank', {id:'m51',name:'조개 갑옷병',     icon:'🐚',recLv:13,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:13, element:'water',rarity:'common', role:'tank',   trait:null}, { atk: -1, gold: +20 }),
    _mon('base', {id:'m52',name:'이끼 순찰자',     icon:'🌿',recLv:13,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:13, element:'grass',rarity:'common', role:'normal', trait:null}, { gold: -4 }),
    // Lv14
    _mon('base', {id:'m53',name:'재안개 맹수',     icon:'🐆',recLv:14,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:14, element:'fire', rarity:'rare',   role:'dealer', trait:'ghost'}, { gold: +13 }),
    _mon('tank', {id:'m54',name:'불가시 멧양',     icon:'🐑',recLv:14,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:14, element:'fire', rarity:'rare',   role:'tank',   trait:null}, { spd: +1, gold: -11 }),
    _mon('base', {id:'m55',name:'거품 두꺼비',     icon:'🐊',recLv:14,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:14, element:'water',rarity:'common', role:'tank',   trait:null}, { gold: -4 }),
    _mon('base', {id:'m14',name:'트롤',           icon:'🧌',recLv:14,reqStat:'spd',reqVal:0, exp:0, zone:'intermediate',level:14, element:'grass',rarity:'common', role:'normal', trait:null}, { gold: -4 }),
    _mon('base', {id:'m56',name:'망령 덩굴수',     icon:'👻',recLv:14,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:14, element:'grass',rarity:'rare',   role:'normal', trait:'ghost'}, { gold: -11 }),
    // Lv15
    _mon('base', {id:'m57',name:'화염 장창병',     icon:'🗡️',recLv:15,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:15, element:'fire', rarity:'rare',   role:'normal', trait:null}, { gold: -11 }),
    _mon('fast', {id:'m15',name:'독 거미',        icon:'🕷️',recLv:15,reqStat:'spd',reqVal:0, exp:0, zone:'intermediate',level:15, element:'water',rarity:'rare',   role:'fast',   trait:null}, { spd: +2, gold: +13 }),
    _mon('base', {id:'m58',name:'물안개 창게',     icon:'🦀',recLv:15,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:15, element:'water',rarity:'rare',   role:'normal', trait:null}, { gold: -11 }),
    _mon('base', {id:'m59',name:'버섯 전갈',       icon:'🦂',recLv:15,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:15, element:'grass',rarity:'rare',   role:'dealer', trait:null}, { gold: -11 }),
    _mon('base', {id:'m60',name:'그림자 잎사수',   icon:'🌲',recLv:15,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:15, element:'grass',rarity:'rare',   role:'normal', trait:'ghost'}, { gold: -11 }),
    // Lv16
    _mon('base', {id:'m16',name:'화염 정령',       icon:'🔥',recLv:16,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:16, element:'fire', rarity:'rare',   role:'dealer', trait:'ghost'}, { gold: +11 }),
    _mon('base', {id:'m61',name:'붉은 갈기수',     icon:'🦁',recLv:16,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:16, element:'fire', rarity:'rare',   role:'dealer', trait:null}, { gold: -13 }),
    _mon('base', {id:'m62',name:'소나기 뱀',       icon:'🐍',recLv:16,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:16, element:'water',rarity:'rare',   role:'fast',   trait:null}, { gold: -13 }),
    _mon('base', {id:'m63',name:'청류 망령새',     icon:'🦅',recLv:16,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:16, element:'water',rarity:'rare',   role:'normal', trait:'ghost'}, { gold: -13 }),
    _mon('tank', {id:'m64',name:'고사리 곰',       icon:'🐻',recLv:16,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:16, element:'grass',rarity:'rare',   role:'tank',   trait:null}, { gold: -13 }),
    // Lv17
    _mon('base', {id:'m65',name:'재의 유격병',     icon:'⚔️', recLv:17,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:17, element:'fire', rarity:'rare',   role:'fast',   trait:'ghost'}, { gold: +10 }),
    _mon('fast', {id:'m66',name:'화산 독수리',     icon:'🦅',recLv:17,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:17, element:'fire', rarity:'rare',   role:'dealer', trait:null}, { gold: -14 }),
    _mon('base', {id:'m67',name:'안개 기린도마뱀', icon:'🦎',recLv:17,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:17, element:'water',rarity:'rare',   role:'normal', trait:'ghost'}, { gold: -14 }),
    _mon('base', {id:'m68',name:'망령 포자초',     icon:'👻',recLv:17,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:17, element:'grass',rarity:'rare',   role:'normal', trait:'ghost'}, { gold: +10 }),
    _mon('tank', {id:'m69',name:'껍질 사수',       icon:'🏹',recLv:17,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:17, element:'grass',rarity:'rare',   role:'tank',   trait:null}, { hp: -1, gold: -14 }),
    // Lv18
    _mon('base', {id:'m70',name:'열기 수문장',     icon:'🛡️',recLv:18,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:18, element:'fire', rarity:'rare',   role:'normal', trait:null}, { gold: -15 }),
    _mon('base', {id:'m71',name:'거울 장어',       icon:'🐟',recLv:18,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:18, element:'water',rarity:'rare',   role:'normal', trait:'ghost'}, { gold: +9 }),
    _mon('tank', {id:'m72',name:'물결 수비병',     icon:'🌊',recLv:18,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:18, element:'water',rarity:'rare',   role:'tank',   trait:null}, { gold: -15 }),
    _mon('tank', {id:'m17',name:'바위 거인',       icon:'🗿',recLv:18,reqStat:'def',reqVal:0, exp:0, zone:'intermediate',level:18, element:'grass',rarity:'rare',   role:'tank',   trait:null}, { gold: +9 }),
    _mon('base', {id:'m73',name:'그림자 가시목',   icon:'🌵',recLv:18,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:18, element:'grass',rarity:'rare',   role:'normal', trait:'ghost'}, { gold: -15 }),
    // Lv19
    _mon('base', {id:'m74',name:'재가면 기사',     icon:'🎭',recLv:19,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:19, element:'fire', rarity:'rare',   role:'normal', trait:'ghost'}, { gold: +8 }),
    _mon('tank', {id:'m75',name:'화산 멧수소',     icon:'🐃',recLv:19,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:19, element:'fire', rarity:'rare',   role:'tank',   trait:null}, { spd: +1, gold: -17 }),
    _mon('base', {id:'m18',name:'폭풍 늑대',       icon:'⚡',recLv:19,reqStat:'spd',reqVal:0, exp:0, zone:'intermediate',level:19, element:'water',rarity:'legend', role:'normal', trait:'ghost'}, { gold: -2 }),
    _mon('tank', {id:'m76',name:'해류 망치게',     icon:'🦞',recLv:19,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:19, element:'water',rarity:'rare',   role:'tank',   trait:null}, { spd: +1, gold: -17 }),
    _mon('fast', {id:'m77',name:'숲그늘 암살자',   icon:'🗡️',recLv:19,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:19, element:'grass',rarity:'rare',   role:'fast',   trait:'ghost'}, { spd: +1, gold: +8 }),
    // Lv20
    _mon('base', {id:'m78',name:'불꽃 허수아비',   icon:'🎃',recLv:20,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:20, element:'fire', rarity:'legend', role:'normal', trait:null}, { gold: +8 }),
    _mon('base', {id:'m79',name:'심연 망령게',     icon:'🦀',recLv:20,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:20, element:'water',rarity:'rare',   role:'normal', trait:'ghost'}, { gold: -17 }),
    _mon('tank', {id:'m80',name:'대지 수호목',     icon:'🌳',recLv:20,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:20, element:'grass',rarity:'rare',   role:'tank',   trait:null}, { gold: +43 }),
    _mon('base', {id:'m81',name:'열기 순찰장',     icon:'🔱',recLv:20,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:20, element:'fire', rarity:'rare',   role:'normal', trait:'ghost'}, { gold: -17 }),
    _mon('base', {id:'m82',name:'안개 사제',       icon:'🧙',recLv:20,reqStat:'atk',reqVal:0, exp:0, zone:'intermediate',level:20, element:'water',rarity:'rare',   role:'normal', trait:'ghost'}, { gold: +8 }),
    // ══ 고급 advanced Lv21~30 (20마리) ══════════════════════════
    // Lv21
    _mon('base', {id:'m19',name:'암흑 기사',       icon:'🖤',recLv:21,reqStat:'mag',reqVal:0, exp:0, zone:'advanced',    level:21, element:'fire', rarity:'rare',   role:'dealer', trait:'ghost'}, { gold: +30 }),
    _mon('tank', {id:'m83',name:'청해 수호자',     icon:'🐬',recLv:21,reqStat:'atk',reqVal:0, exp:0, zone:'advanced',    level:21, element:'water',rarity:'rare',   role:'tank',   trait:null}, { spd: -1 }),
    // Lv22
    _mon('base', {id:'m84',name:'월광 덩굴수',     icon:'🌙',recLv:22,reqStat:'atk',reqVal:0, exp:0, zone:'advanced',    level:22, element:'grass',rarity:'rare',   role:'normal', trait:'ghost'}),
    _mon('base', {id:'m85',name:'용암 망령검사',   icon:'🌋',recLv:22,reqStat:'atk',reqVal:0, exp:0, zone:'advanced',    level:22, element:'fire', rarity:'rare',   role:'dealer', trait:'ghost'}),
    // Lv23
    _mon('base', {id:'m86',name:'심해 창병',       icon:'🔱',recLv:23,reqStat:'atk',reqVal:0, exp:0, zone:'advanced',    level:23, element:'water',rarity:'rare',   role:'normal', trait:null}, { gold: +32 }),
    _mon('base', {id:'m87',name:'고목 주술사',     icon:'🧙',recLv:23,reqStat:'atk',reqVal:0, exp:0, zone:'advanced',    level:23, element:'grass',rarity:'rare',   role:'dealer', trait:null}),
    // Lv24
    _mon('base', {id:'m88',name:'열풍 맹금',       icon:'🦅',recLv:24,reqStat:'atk',reqVal:0, exp:0, zone:'advanced',    level:24, element:'fire', rarity:'rare',   role:'fast',   trait:null}),
    _mon('base', {id:'m89',name:'서리 망령장어',   icon:'❄️',recLv:24,reqStat:'atk',reqVal:0, exp:0, zone:'advanced',    level:24, element:'water',rarity:'rare',   role:'normal', trait:'ghost'}),
    // Lv25
    _mon('base', {id:'m90',name:'대지 갑옷병',     icon:'🛡️',recLv:25,reqStat:'atk',reqVal:0, exp:0, zone:'advanced',    level:25, element:'grass',rarity:'rare',   role:'tank',   trait:null}),
    _mon('base', {id:'m91',name:'붉은 재사자',     icon:'🦁',recLv:25,reqStat:'atk',reqVal:0, exp:0, zone:'advanced',    level:25, element:'fire', rarity:'legend', role:'dealer', trait:'ghost'}, { gold: -42 }),
    // Lv26
    _mon('base', {id:'m92',name:'해일 기사',       icon:'🌊',recLv:26,reqStat:'atk',reqVal:0, exp:0, zone:'advanced',    level:26, element:'water',rarity:'rare',   role:'normal', trait:null}),
    _mon('base', {id:'m93',name:'가시왕 사슴',     icon:'🦌',recLv:26,reqStat:'atk',reqVal:0, exp:0, zone:'advanced',    level:26, element:'grass',rarity:'legend', role:'tank',   trait:null}, { gold: -9 }),
    // Lv27
    _mon('base', {id:'m94',name:'용암 골렘',       icon:'🌋',recLv:27,reqStat:'atk',reqVal:0, exp:0, zone:'advanced',    level:27, element:'fire', rarity:'legend', role:'tank',   trait:null}, { gold: -9 }),
    _mon('base', {id:'m95',name:'청류 파수꾼',     icon:'💠',recLv:27,reqStat:'atk',reqVal:0, exp:0, zone:'advanced',    level:27, element:'water',rarity:'rare',   role:'normal', trait:'ghost'}),
    // Lv28
    _mon('base', {id:'m96',name:'고대 나무정령',   icon:'🌲',recLv:28,reqStat:'atk',reqVal:0, exp:0, zone:'advanced',    level:28, element:'grass',rarity:'legend', role:'normal', trait:null}, { gold: -47 }),
    _mon('base', {id:'m97',name:'화산 근위대장',   icon:'⚔️', recLv:28,reqStat:'atk',reqVal:0, exp:0, zone:'advanced',    level:28, element:'fire', rarity:'legend', role:'dealer', trait:'ghost'}, { gold: -9 }),
    // Lv29
    _mon('base', {id:'m98',name:'심연 파도룡',     icon:'🐲',recLv:29,reqStat:'atk',reqVal:0, exp:0, zone:'advanced',    level:29, element:'water',rarity:'legend', role:'dealer', trait:null}, { gold: -9 }),
    _mon('base', {id:'m99',name:'흑림 사신목',     icon:'☠️',recLv:29,reqStat:'atk',reqVal:0, exp:0, zone:'advanced',    level:29, element:'grass',rarity:'legend', role:'normal', trait:'ghost'}, { gold: -48 }),
    // Lv30
    _mon('base', {id:'m100',name:'태양 심판자',    icon:'☀️',recLv:30,reqStat:'atk',reqVal:0, exp:0, zone:'advanced',    level:30, element:'fire', rarity:'legend', role:'dealer', trait:null}, { gold: +76 }),
    _mon('base', {id:'m20',name:'고대 드래곤',     icon:'🐉',recLv:30,reqStat:'atk',reqVal:0, exp:0, zone:'advanced',    level:30, element:'water',rarity:'legend', role:'normal', trait:null}, { gold: +76 }),
  ],

  // ─── 칭호·승급 ────────────────────────────────────────
  titles: ['독서왕','학습왕','예술왕','가치왕','건강왕','도전왕','성실왕','친절왕'],
  promotionLevels: [5, 10, 15, 20, 25, 30],

  // ─── 이름 매핑 ★ 인성 → 가치 ─────────────────────────
  statNames:   { read:'독서', study:'학습', art:'예술', value:'가치', health:'건강', life:'생활' },
  combatNames: { atk:'공격력', def:'방어력', mag:'마력', spd:'속도' },

  // ─── 장비 id → 슬롯 맵 (lazy) ────────────────────────
  get SLOT_MAP() {
    if (this._slotMap) return this._slotMap;
    this._slotMap = {};
    Object.entries(this.equipment).forEach(([slot, items]) => {
      items.forEach(item => { this._slotMap[item.id] = slot; });
    });
    return this._slotMap;
  },

  getItemById(id) {
    for (const items of Object.values(this.equipment)) {
      const found = items.find(i => i.id === id);
      if (found) return found;
    }
    return null;
  },
  getSlotForItem(id) { return this.SLOT_MAP[id] || null; },
};

// 일반 씨앗 판매가 (B-2g) — sellAdj 자리에 sellPrice 를 넣는다(키 순서 옛 표와 같음). 돌연변이 씨앗이 이 값을 읽으므로 그보다 먼저.
GAME_DATA.seeds = GAME_DATA.seeds.map((s, t) => {
  const c = BALANCE.seedSell, out = {};
  for (const k of Object.keys(s)) { if (k === 'sellAdj') out.sellPrice = Math.round(s.price * (c.ratioBase + c.ratioPerTier * t)) + s.sellAdj; else out[k] = s[k]; }
  return out;
});

// 돌연변이 씨앗 (B-2f) — i 번째 줄 = i 번째 일반 씨앗의 돌연변이
// 장식 가격 (B-2h) — priceAdj 자리에 price = BALANCE.decoPrice[희귀도] + priceAdj 를 넣는다(키 순서 옛 표와 같음)
GAME_DATA.decorations = GAME_DATA.decorations.map(d => {
  if (!('priceAdj' in d)) return d;
  const out = {};
  for (const k of Object.keys(d)) { if (k === 'priceAdj') out.price = BALANCE.decoPrice[d.rarity] + d.priceAdj; else out[k] = d[k]; }
  return out;
});

// ═══════════════════════════════════════════════════════
//  🎁 꾸미기 무료 기간 (사용자 지시 2026-09-17 · 3일)
//  기간만 보고 값을 0으로 바꿔 주는 것이고, 원래 가격(price)은 그대로 둔다 →
//  기간이 지나면 저절로 원래 가격으로 돌아온다(되돌리는 패치가 필요 없다).
//  from 0시 ~ until 0시 전까지(기기 시각 기준). 2026-09-17·18·19 사흘.
// ═══════════════════════════════════════════════════════
GAME_DATA.decoFree = { from: '2026-09-17', until: '2026-09-20', label: '9월 19일' };

GAME_DATA.decoFreeNow = function (now) {
  const f = GAME_DATA.decoFree;
  if (!f || !f.from || !f.until) return false;
  const d = now || new Date();
  const ymd = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  return ymd >= f.from && ymd < f.until;
};

// 지금 실제로 받을 값 — 무료 기간이면 0. 장식 구매는 반드시 이걸 쓴다(price 를 직접 빼지 말 것).
GAME_DATA.decoCost = function (deco) {
  if (!deco) return 0;
  return GAME_DATA.decoFreeNow() ? 0 : (deco.price || 0);
};

GAME_DATA.mutantSeeds = [
    { id:'i_m_potato_seed', name:'⚡ 번개 감자', icon:'⚡🥔', priceAdj:+1, crop:'m_potato', cropIcon:'⚡🥔', desc:'특별 씨앗 입문' },
    { id:'i_m_carrot_seed', name:'✨ 황금 당근', icon:'✨🥕', crop:'m_carrot', cropIcon:'✨🥕', desc:'행운의 씨앗' },
    { id:'i_m_corn_seed', name:'🌈 무지개 옥수수', icon:'🌈🌽', priceAdj:-1, crop:'m_corn', cropIcon:'🌈🌽', desc:'신비한 씨앗' },
    { id:'i_m_tomato_seed', name:'🔥 불꽃 토마토', icon:'🔥🍅', priceAdj:+1, crop:'m_tomato', cropIcon:'🔥🍅', desc:'희귀 씨앗' },
    { id:'i_m_strawberry_seed', name:'🌟 별빛 딸기', icon:'🌟🍓', priceAdj:+1, crop:'m_strawberry', cropIcon:'🌟🍓', desc:'전설의 씨앗' },
].map((r, t) => {
  const s = GAME_DATA.seeds[t], c = BALANCE.mutantSeed;
  return { id: r.id, name: r.name, icon: r.icon, price: Math.round(s.price * c.priceMult) + (r.priceAdj || 0), growHours: s.growHours,
    baseSellPrice: s.sellPrice, successRate: Math.floor((c.successBase - c.successPerTier * t) * 100 + 1e-9) / 100,
    crop: r.crop, cropIcon: r.cropIcon, reqLv: s.reqLv, desc: r.desc, isMutant: true };
});

// ═══════════════════════════════════════════════════════
//  스킬 데이터 (stage 1 상수 — 4단계 가격 적용)
// ═══════════════════════════════════════════════════════

const DEFAULT_SKILL_LEVELS = { normal:1, fire:0, water:0, grass:0 };

// 런타임 스킬 계수 표 — BALANCE.skill 복사본 (관리자 normalMults/elementMults가 이 표를 덮는다)
const SKILL_MULTIPLIERS = {
  normal:  { ...BALANCE.skill.normal },
  element: { ...BALANCE.skill.element },
};

// ★ 4단계 가격 반영 + reqPlayerLevel / targetLevel 추가
// 노말 마스터리북 가격 (B-2j) — BALANCE.bookPrice.normal 계단
function _normalBookPrice(n) {
  const c = BALANCE.bookPrice.normal;
  let p = c.first, inc = c.firstInc;
  for (let k = 2; k <= n; k++) { if (k > 2) { let d = 0; for (const [from, a] of c.incSteps) if (k >= from) d = a; inc += d; } p += inc; }
  return p;
}

const SKILL_BOOKS = [
  // normal 1~7 (120/180/260/360/500/680/900)
  {id:'sb_n1',name:'전투 마스터리북 1권',  type:'normal',level:1,targetLevel:1, reqPlayerLevel:1,  price:_normalBookPrice(1), icon:'📘',desc:'기본 공격 해금 (×1.10)'},
  {id:'sb_n2',name:'전투 마스터리북 2권',  type:'normal',level:2,targetLevel:2, reqPlayerLevel:3,  price:_normalBookPrice(2), icon:'📘',desc:'기본 공격력 +18%'},
  {id:'sb_n3',name:'전투 마스터리북 3권',  type:'normal',level:3,targetLevel:3, reqPlayerLevel:5,  price:_normalBookPrice(3), icon:'📘',desc:'기본 공격력 +27%'},
  {id:'sb_n4',name:'전투 마스터리북 4권',  type:'normal',level:4,targetLevel:4, reqPlayerLevel:8,  price:_normalBookPrice(4), icon:'📘',desc:'기본 공격력 +36%'},
  {id:'sb_n5',name:'전투 마스터리북 5권',  type:'normal',level:5,targetLevel:5, reqPlayerLevel:12, price:_normalBookPrice(5), icon:'📘',desc:'기본 공격력 +46%'},
  {id:'sb_n6',name:'전투 마스터리북 6권',  type:'normal',level:6,targetLevel:6, reqPlayerLevel:16, price:_normalBookPrice(6), icon:'📘',desc:'기본 공격력 +56%'},
  {id:'sb_n7',name:'전투 마스터리북 7권',  type:'normal',level:7,targetLevel:7, reqPlayerLevel:20, price:_normalBookPrice(7), icon:'📘',desc:'기본 공격력 +65%'},
  // fire 1~7 (90/140/210/290/400/540/720)
  {id:'sb_f1',name:'화염 마스터리북 1권',type:'fire',  level:1,targetLevel:1, reqPlayerLevel:2,  priceAdj:-3,  icon:'📕',desc:'화염 공격 해금'},
  {id:'sb_f2',name:'화염 마스터리북 2권',type:'fire',  level:2,targetLevel:2, reqPlayerLevel:5,  priceAdj:-2, icon:'📕',desc:'화염 공격력 +10%'},
  {id:'sb_f3',name:'화염 마스터리북 3권',type:'fire',  level:3,targetLevel:3, reqPlayerLevel:8,  priceAdj:+1, icon:'📕',desc:'화염 공격력 +20%'},
  {id:'sb_f4',name:'화염 마스터리북 4권',type:'fire',  level:4,targetLevel:4, reqPlayerLevel:12, priceAdj:+1, icon:'📕',desc:'화염 공격력 +30%'},
  {id:'sb_f5',name:'화염 마스터리북 5권',type:'fire',  level:5,targetLevel:5, reqPlayerLevel:16, priceAdj:0, icon:'📕',desc:'화염 공격력 +40%'},
  {id:'sb_f6',name:'화염 마스터리북 6권',type:'fire',  level:6,targetLevel:6, reqPlayerLevel:20, priceAdj:-2, icon:'📕',desc:'화염 공격력 +50%'},
  {id:'sb_f7',name:'화염 마스터리북 7권',type:'fire',  level:7,targetLevel:7, reqPlayerLevel:24, priceAdj:0, icon:'📕',desc:'화염 공격력 +60%'},
];
// 화염 마스터리북 가격 (B-2g) — priceAdj 자리에 price = 같은 권 노말 × elementPriceRatio + priceAdj
{
  const normal = SKILL_BOOKS.filter(b => b.type === 'normal');
  SKILL_BOOKS.forEach((b, i) => {
    if (b.type !== 'fire') return;
    const n = normal[b.level - 1], out = {};
    for (const k of Object.keys(b)) { if (k === 'priceAdj') out.price = Math.round(n.price * BALANCE.bookPrice.elementPriceRatio) + b.priceAdj; else out[k] = b[k]; }
    SKILL_BOOKS[i] = out;
  });
}
// ★ B-2f: 냉기·자연 마스터리북 = 같은 권의 화염 마스터리북 복사(권·목표 레벨·필요 레벨·가격), 이름·아이콘·설명만 따로
function _bookCopy(type, rows) {
  const fire = SKILL_BOOKS.filter(b => b.type === 'fire');
  return rows.map((r, i) => ({ id: r.id, name: r.name, type, level: fire[i].level, targetLevel: fire[i].targetLevel,
    reqPlayerLevel: fire[i].reqPlayerLevel, price: fire[i].price, icon: r.icon, desc: r.desc }));
}
SKILL_BOOKS.push(..._bookCopy('water', [
  { id:'sb_w1', name:'냉기 마스터리북 1권', icon:'📗', desc:'냉기 공격 해금' },
  { id:'sb_w2', name:'냉기 마스터리북 2권', icon:'📗', desc:'냉기 공격력 +10%' },
  { id:'sb_w3', name:'냉기 마스터리북 3권', icon:'📗', desc:'냉기 공격력 +20%' },
  { id:'sb_w4', name:'냉기 마스터리북 4권', icon:'📗', desc:'냉기 공격력 +30%' },
  { id:'sb_w5', name:'냉기 마스터리북 5권', icon:'📗', desc:'냉기 공격력 +40%' },
  { id:'sb_w6', name:'냉기 마스터리북 6권', icon:'📗', desc:'냉기 공격력 +50%' },
  { id:'sb_w7', name:'냉기 마스터리북 7권', icon:'📗', desc:'냉기 공격력 +60%' },
]));
SKILL_BOOKS.push(..._bookCopy('grass', [
  { id:'sb_g1', name:'자연 마스터리북 1권', icon:'📒', desc:'자연 공격 해금' },
  { id:'sb_g2', name:'자연 마스터리북 2권', icon:'📒', desc:'자연 공격력 +10%' },
  { id:'sb_g3', name:'자연 마스터리북 3권', icon:'📒', desc:'자연 공격력 +20%' },
  { id:'sb_g4', name:'자연 마스터리북 4권', icon:'📒', desc:'자연 공격력 +30%' },
  { id:'sb_g5', name:'자연 마스터리북 5권', icon:'📒', desc:'자연 공격력 +40%' },
  { id:'sb_g6', name:'자연 마스터리북 6권', icon:'📒', desc:'자연 공격력 +50%' },
  { id:'sb_g7', name:'자연 마스터리북 7권', icon:'📒', desc:'자연 공격력 +60%' },
]));

