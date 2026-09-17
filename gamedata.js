// ====================================================
//  우리반 성장 RPG — 공유 게임 데이터 v3 (gamedata.js)
//  ★ 밸런스 v2: 인성→가치, EXP/골드/농장 전면 조정
// ====================================================

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
    {id:'d_y7', name:'해바라기 화단', icon:'🌻', priceAdj:+5, cat:'yard',   rarity:'rare',   reqLv:1},
    {id:'d_y8', name:'허수아비',      icon:'🧹', priceAdj:+25, cat:'yard',   rarity:'rare',   reqLv:1},
    // 🟣 영웅 Lv10+
    {id:'d_y9', name:'작은 나무',     icon:'🌲', size:{w:2,h:2}, priceAdj:-60, cat:'yard',   rarity:'epic',   reqLv:1},
    {id:'d_y10',name:'분수',          icon:'⛲', size:{w:2,h:2}, priceAdj:-23, cat:'yard',   rarity:'epic',   reqLv:1},
    {id:'d_y11',name:'풍차',          icon:'🌀', size:{w:2,h:2}, priceAdj:+15, cat:'yard',   rarity:'epic',   reqLv:1},
    // 🟡 전설 Lv20+
    {id:'d_y12',name:'벚나무',        icon:'🌸', size:{w:3,h:3}, priceAdj:-75, cat:'yard',   rarity:'legend', reqLv:1},
    {id:'d_y13',name:'마법 정원석',   icon:'💎', priceAdj:0, cat:'yard',   rarity:'legend', reqLv:1},
    {id:'d_y14',name:'황금 석등',     icon:'🌟', priceAdj:+75, cat:'yard',   rarity:'legend', reqLv:1},

    // ── 공원/정원 테마 ─────────────────────────────────────
    {id:'d_y15',name:'낮은 관목',     icon:'🌿', priceAdj:-3,  cat:'yard',   rarity:'common', reqLv:1},
    {id:'d_y16',name:'큰 화단',       icon:'🌺', size:{w:2,h:2}, priceAdj:0, cat:'yard', rarity:'rare',   reqLv:1},
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
    {id:'d_y31',name:'작은 연못',     icon:'🪷', size:{w:3,h:3}, priceAdj:+10, cat:'yard', rarity:'epic',   reqLv:1},
    {id:'d_y32',name:'오리 가족',     icon:'🦆', size:{w:2,h:1}, priceAdj:-5, cat:'yard', rarity:'rare',   reqLv:1},

    // ── 건물 테마 ───────────────────────────────────────────
    {id:'d_y33',name:'나무 오두막',   icon:'🏠', size:{w:2,h:2}, priceAdj:-135, cat:'yard', rarity:'legend', reqLv:1},

    // ── 2차 확장: 건물/생활 ─────────────────────────────────
    {id:'d_y34',name:'작은 창고',     icon:'🏚️', size:{w:2,h:2}, priceAdj:0, cat:'yard', rarity:'epic',   reqLv:1},

    // ── 2차 확장: 농촌 심화 ─────────────────────────────────
    {id:'d_y35',name:'밀밭 B형',      icon:'🌾', size:{w:2,h:2}, priceAdj:-5,  cat:'yard', rarity:'rare',   reqLv:1},
    {id:'d_y36',name:'보리밭',        icon:'🌾', size:{w:2,h:2}, priceAdj:-5,  cat:'yard', rarity:'rare',   reqLv:1},
    {id:'d_y37',name:'장작더미 B형',  icon:'🪵', priceAdj:+15,       cat:'yard', rarity:'common', reqLv:1},
    {id:'d_y38',name:'큰 바위 B형',   icon:'🪨', size:{w:2,h:1}, priceAdj:-10,  cat:'yard', rarity:'rare',   reqLv:1},

    // ── 2차 확장: 정적 동물 ─────────────────────────────────
    {id:'d_y39',name:'닭 3마리',      icon:'🐔', size:{w:2,h:1}, priceAdj:0,  cat:'yard', rarity:'rare',   reqLv:1},
    {id:'d_y40',name:'양',            icon:'🐑', size:{w:2,h:1}, priceAdj:+30, cat:'yard', rarity:'rare',   reqLv:1},

    // ── 2차 확장: 꽃 다양화 ─────────────────────────────────
    {id:'d_y41',name:'라벤더 화단',   icon:'💜', priceAdj:-2,       cat:'yard', rarity:'common', reqLv:1},
    {id:'d_y42',name:'데이지 화단',   icon:'🌼', priceAdj:-2,       cat:'yard', rarity:'common', reqLv:1},
    {id:'d_y43',name:'장미 B형',      icon:'🌹', priceAdj:-2,       cat:'yard', rarity:'common', reqLv:1},
    {id:'d_y44',name:'튤립 B형',      icon:'🌷', priceAdj:-2,       cat:'yard', rarity:'common', reqLv:1},

    // ── 2차 확장: 식생/나무 ─────────────────────────────────
    {id:'d_y45',name:'키 큰 풀숲',    icon:'🌿', priceAdj:-5,       cat:'yard', rarity:'common', reqLv:1},
    {id:'d_y46',name:'작은 침엽수',   icon:'🌲', size:{w:2,h:2}, priceAdj:+50, cat:'yard', rarity:'rare',   reqLv:1},
    {id:'d_y47',name:'둥근 나무 B형', icon:'🌳', size:{w:2,h:2}, priceAdj:+60, cat:'yard', rarity:'rare',   reqLv:1},
    {id:'d_y48',name:'과수나무',      icon:'🍎', size:{w:2,h:2}, priceAdj:+120, cat:'yard', rarity:'common', reqLv:1},

    // ── 목재 울타리 4종 ─────────────────────────────────────
    {id:'d_y49',name:'울타리 가로형',  icon:'🪵', priceAdj:-10, cat:'yard', rarity:'common', reqLv:1},
    {id:'d_y50',name:'울타리 세로형',  icon:'🪵', priceAdj:-10, cat:'yard', rarity:'common', reqLv:1},
    {id:'d_y51',name:'울타리 왼쪽 코너', icon:'🪵', priceAdj:-10, cat:'yard', rarity:'common', reqLv:1},
    {id:'d_y52',name:'울타리 오른쪽 코너', icon:'🪵', priceAdj:-10, cat:'yard', rarity:'common', reqLv:1},

    // ── 3차 확장: 걷는 동물 (DECO-ANIM-1) — 낱마리라 마당을 돌아다닐 수 있다
    {id:'d_y53',name:'강아지',        icon:'🐶', priceAdj:0,  cat:'yard', rarity:'rare',   reqLv:1, newUntil:'2026-09-27'},
    {id:'d_y54',name:'고양이',        icon:'🐱', priceAdj:0,  cat:'yard', rarity:'rare',   reqLv:1, newUntil:'2026-09-27'},
    {id:'d_y55',name:'닭 한 마리',    icon:'🐔', priceAdj:-30, cat:'yard', rarity:'rare',   reqLv:1, newUntil:'2026-09-27'},
    {id:'d_y56',name:'오리 한 마리',  icon:'🦆', priceAdj:-30, cat:'yard', rarity:'rare',   reqLv:1, newUntil:'2026-09-27'},
    {id:'d_y57',name:'양 한 마리',    icon:'🐑', priceAdj:-30, cat:'yard', rarity:'rare',   reqLv:1, newUntil:'2026-09-27'},
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
    {id:'d_i12',name:'황금 책장',     icon:'📖', size:{w:2,h:2}, priceAdj:-75, cat:'indoor', rarity:'legend', reqLv:1},
    {id:'d_i13',name:'마법 거울',     icon:'🪞', size:{w:1,h:2}, priceAdj:0, cat:'indoor', rarity:'legend', reqLv:1},
    {id:'d_i14',name:'왕의 의자',     icon:'👑', size:{w:1,h:2}, priceAdj:+75, cat:'indoor', rarity:'legend', reqLv:1},
    // ── 러그 (layer:'floor' = 가구·캐릭터 뒤 바닥 레이어에 그림, FLOOR-SVG-1) ──
    {id:'d_i15',name:'둥근 러그',     icon:'🟠', size:{w:2,h:2}, priceAdj:+20,  cat:'indoor', rarity:'rare',   reqLv:1, layer:'floor'},
    {id:'d_i16',name:'네모 러그',     icon:'🟦', size:{w:3,h:2}, priceAdj:+50, cat:'indoor', rarity:'rare',   reqLv:1, layer:'floor'},
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

// ─── Firebase 설정 ────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCV_u6yKdGInPuCJanK4bzBfnLJuvIbyX4",
  authDomain: "class-rpg-6f409.firebaseapp.com",
  databaseURL: "https://class-rpg-6f409-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "class-rpg-6f409",
  storageBucket: "class-rpg-6f409.firebasestorage.app",
  messagingSenderId: "408824743154",
  appId: "1:408824743154:web:382fdd431f7e2dbce13c6b"
};

// ─── Firebase DB (실시간 동기화) ──────────────────────
const DB = {
  KEY: 'classRPG_v3',
  ADMIN_KEY: 'classRPG_adminPw',
  _cache: null,
  _fbRef: null,
  _fbAdminRef: null,
  _onChangeCb: null,
  _saving: false,

  async init(opts) {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    this._fbRef = firebase.database().ref(this.KEY);
    this._fbAdminRef = firebase.database().ref(this.ADMIN_KEY);
    this._profile = (opts && opts.profile) || null;   // [STUDENT-COLD-1] 'student' = 학생 기기

    // 실시간 동기화 리스너 — 다른 기기 변경사항 반영
    //   [STUDENT-COLD-1] 본문은 그대로 두고 이름만 붙였다: root 판은 root on('value') 로,
    //   학생 판은 노드별 구독을 합친 "가상 root 스냅샷"으로 **같은 함수**를 부른다.
    const liveHandler = (snap) => {
      const d = snap.val();
      if (!d) return;

      if (this._saving) {
        // 내가 저장 중일 때도 settings 변경은 반드시 처리
        const newSettings = d.settings;
        const oldSettings = (this._cache || {}).settings;
        if (JSON.stringify(newSettings) === JSON.stringify(oldSettings)) return;
        if (this._cache) this._cache.settings = newSettings;
        if (this._onChangeCb) this._onChangeCb();
        return;
      }

      this._cache = this._migrate(this._normalizeArrays(d));
      if (this._onChangeCb) this._onChangeCb();
    };
    this._liveHandler = liveHandler;

    if (this._profile === 'student' && await this._initStudentNodes()) return;

    // 초기 데이터 로드 — [INIT-SINGLE-LOAD-1] once('value') 대신 on('value') 의 첫 스냅샷.
    //   once 가 끝나면 SDK 가 그 구독을 내리고 캐시를 버려, 곧이어 건 on 이 root 를 **통째로 한 번 더** 받았다
    //   (에뮬레이터 + SDK 9.23 실측 2배). 첫 리스너를 붙여 둔 채 아래 실시간 리스너를 걸면 SDK 캐시에서 바로 받는다.
    let firstLoadResolve = null;
    const firstLoad = (s) => { if (firstLoadResolve) { firstLoadResolve(s); firstLoadResolve = null; } };
    const snap = await new Promise((resolve, reject) => {
      firstLoadResolve = resolve;
      this._fbRef.on('value', firstLoad, reject);
    });
    let data = snap.val();

    if (!data) {
      data = this._defaultData();
      if (this._profile !== 'student') await this._rootSet(data);   // [STUDENT-COLD-1] G1 — 빈 DB 설치는 교사 화면만
    }
    this._cache = this._migrate(this._normalizeArrays(data));

    // 첫 리스너는 아래 실시간 리스너를 건 **뒤**에 뗀다 — 먼저 떼면 구독이 끊겨 root 를 다시 통째로 받는다
    setTimeout(() => this._fbRef.off('value', firstLoad), 0);

    this._fbRef.on('value', liveHandler);
  },

  // ── [STUDENT-COLD-1] 학생 기기 부분 캐시 ─────────────────────
  //  설계: 클로드코드/보고_20260915/설계_S2_부분캐시가드_rf.md
  //  학생 기기는 큰데 남의 것은 안 쓰는 노드를 root 구독에서 빼고(COLD), 로그인 뒤 내 것만 키 범위로 받는다(MINE).
  //  교사(admin)·키오스크는 지금처럼 root 통째. 이 판에서는 캐시가 **부분**이므로 root 통째 저장을 막는다(G1).
  //  quests 는 _normalizeArrays 가 questLogs 에서 늘 다시 만들어 서버 값을 안 쓴다(옛 롤백이 남긴 사본).
  //  goldDaily 는 학생 화면이 읽지 않고 logGold 가 한 칸 increment 로 쓰기만 한다. 학생 기기가 이 경로를 **들으면**
  //  logGold 의 update() 가 동기 value 이벤트를 띄워 onDataChange 가 CUR 을 옛 캐시로 바꾸고 다음 saveStudent 가
  //  골드 빠진 학생을 저장했다(골드 유실 M1). 안 들으면 이벤트가 안 뜬다 — [STUDENT-GOLDDAILY-COLD-1] 실제 SDK 로 확인.
  STUDENT_COLD: ['quests', 'quizRecords', 'emotionLogs', 'emotionReflections', 'backups', 'goldDaily'],
  STUDENT_MINE: ['emotionLogs', 'emotionReflections'],   // 키가 `<sid>_…` 로 시작 → orderByKey 범위, 색인 불필요
  //  지금 운영에 없어도(null) 학생 화면이 읽는 노드 — 나중에 생기면 바로 받도록 미리 구독(null 구독은 비용 0)
  STUDENT_KNOWN: ['settings', 'students', 'questLogs', 'boardQuests', 'artworks', 'memories', 'memoryAlbums',
    'promotionRequests', 'pwResetRequests', 'weeklyGoals', 'weeklyReflections', 'customProblems', 'customWords',
    'teacherWordSets', 'recorderLogs', 'recorderSongs', 'problemRecords', 'studentNotes', 'emotionPromptStats',
    'emotionAlerts', 'customMonsters', 'customQuestTemplates', 'hiddenQuestTemplates'],

  // G1: 부분 캐시로 root 통째 저장하면 빠진 노드가 운영에서 지워진다
  _rootSet(data) {
    if (this._profile === 'student') throw new Error('[STUDENT-COLD-1] 학생 기기는 root 통째 저장 금지(부분 캐시)');
    return this._fbRef.set(data);
  },

  _studentVal() {
    const d = {};
    for (const k of Object.keys(this._snaps || {})) { const v = this._snaps[k] && this._snaps[k].val(); if (v != null) d[k] = v; }
    return d;
  },
  _studentEmit() { if (this._liveHandler) this._liveHandler({ val: () => this._studentVal() }); },

  // 노드 이름: shallow REST(수백 바이트) ∪ STUDENT_KNOWN − STUDENT_COLD. 실패하면 false → root 판으로
  async _initStudentNodes() {
    let names;
    try {
      const base = new URL(firebase.app().options.databaseURL);
      const u = new URL(base.origin + base.pathname.replace(/\/+$/, '') + '/' + this.KEY + '.json');
      base.searchParams.forEach((v, k) => u.searchParams.set(k, v));   // 에뮬레이터 ?ns= 유지
      u.searchParams.set('shallow', 'true');
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const t = ctl ? setTimeout(() => ctl.abort(), 8000) : 0;
      const res = await fetch(u.toString(), ctl ? { signal: ctl.signal } : undefined);
      if (t) clearTimeout(t);
      if (!res.ok) return false;
      const top = await res.json();
      if (!top || typeof top !== 'object') return false;   // 빈 DB → root 판(학생은 기본값도 안 씀)
      names = [...new Set([...Object.keys(top), ...this.STUDENT_KNOWN])].filter(n => !this.STUDENT_COLD.includes(n));
    } catch (e) { return false; }

    this._snaps = {};
    this._studentReady = false;
    await Promise.all(names.map(name => new Promise((resolve, reject) => {
      let first = true;
      this._fbRef.child(name).on('value', (s) => {
        this._snaps[name] = s;
        if (first) { first = false; resolve(); return; }
        if (this._studentReady) this._studentEmit();
      }, reject);
    })));
    this._cache = this._migrate(this._normalizeArrays(this._studentVal()));
    this._studentReady = true;
    return true;
  },

  // 학생 로그인 직후, 첫 화면 그리기 전에 부른다(G3). 학생이 바뀌면 이전 구독을 떼고 비운다(G7).
  attachMine(sid) {
    if (!this._snaps) return Promise.resolve();          // root 판이면 이미 전부 있음
    (this._mineOffs || []).forEach(off => off());
    this._mineOffs = [];
    for (const n of this.STUDENT_MINE) { delete this._snaps[n]; if (this._cache) this._cache[n] = {}; }
    if (!sid) return Promise.resolve();
    const one = (name) => new Promise((resolve) => {
      const q = this._fbRef.child(name).orderByKey().startAt(sid + '_').endAt(sid + '_\uf8ff');
      let first = true;
      const cb = (s) => {
        this._snaps[name] = s;
        if (first) { first = false; resolve(); } else if (this._studentReady) this._studentEmit();
      };
      q.on('value', cb);
      this._mineOffs.push(() => q.off('value', cb));
    });
    const loaded = Promise.all(this.STUDENT_MINE.map(one)).then(() => {
      // 첫 판은 캐시에 바로 넣는다 — 로그인 순간 _saving 이면 핸들러가 settings 만 보고 돌아가기 때문
      //   (emotionLogs·emotionReflections 는 _normalizeArrays 에서 키 객체 그대로라 같은 모양)
      for (const n of this.STUDENT_MINE) if (this._cache) this._cache[n] = (this._snaps[n] && this._snaps[n].val()) || {};
      if (this._onChangeCb) this._onChangeCb();
    });
    // 8초 안에 안 오면 전체를 한 번 받아 내 것만 거른다(느려도 틀리지 않게)
    const slow = new Promise(r => setTimeout(r, 8000)).then(() => Promise.all(this.STUDENT_MINE.map(n =>
      this._snaps[n] ? null : this._fbRef.child(n).once('value').then(s => {
        const all = s.val() || {}, mine = {};
        for (const k of Object.keys(all)) if (k.startsWith(sid + '_')) mine[k] = all[k];
        if (this._cache && !this._snaps[n]) this._cache[n] = mine;
      })))).catch(() => {});
    return Promise.race([loaded, slow]);
  },

  onDataChange(fn) { this._onChangeCb = fn; },

  _defaultData() {
    return {
      students: JSON.parse(JSON.stringify(GAME_DATA.defaultStudents)),
      quests: [], promotionRequests: [], boardQuests: [],
      artworks: [], pwResetRequests: [],
      settings: {
        className:'우리반', bossActive:false, bossName:'거대 트롤',
        bossIcon:'🧌', bossGold:150, monsterWinRate:80,
        baseExp:80, baseGold:50, monsterDailyLimit:2,
      }
    };
  },

  // Firebase는 배열을 객체로 저장 → 다시 배열로 변환
  _normalizeArrays(data) {
    const toArr = v => v == null ? [] : Array.isArray(v) ? v : Object.values(v);
    data.students          = toArr(data.students).map(s => {
      if (!s) return null;
      s.farm             = toArr(s.farm);
      s.inventory        = toArr(s.inventory);
      s.books            = toArr(s.books);
      s.houseDecorations = toArr(s.houseDecorations);
      s.achievements     = toArr(s.achievements);
      s.titles           = toArr(s.titles);
      s.monsterLog       = toArr(s.monsterLog);
      s.pendingRewards   = toArr(s.pendingRewards);
      return s;
    }).filter(s => s && s.id && s.name); // id/name 없는 껍데기 학생 노드 제외 (렌더 불가)
    // 중복 학생 제거 후 ID 기준 정렬 (순서 항상 고정)
    //
    // [DUP-STUDENT-1] students 에는 같은 학생이 두 벌 있다.
    //   2026-03-14 까지 students/<배열인덱스> 로 저장하다가(1cd703d)
    //   03-15 부터 students/<id> 로 바꿨는데(b46f0b0) 옛 숫자 키 노드를 옮기거나 지우지 않았다.
    //   운영 DB 에 지금도 숫자 키(낡은 스냅샷) + id 키(현재 본)가 함께 있다.
    //
    //   아래 seen.set 은 "나중 것 승"이라 낡은 본이 이길 것처럼 보이지만 그렇지 않다.
    //   Object.keys/values 는 **정수형 키를 항상 먼저(오름차순), 문자열 키를 그 뒤에** 돌려준다
    //   (OrdinaryOwnPropertyKeys). 학생 id 는 항상 's' 로 시작하므로
    //   (doAddStudents: 's' + Date.now(), 기본 학생 s1~s6) 정수형 키가 될 수 없다.
    //   → 숫자 키가 먼저, id 키가 뒤 → id 본이 **항상** 이긴다. 우연이 아니라 명세다.
    //
    //   ⚠️ 다만 이 정확성은 **그 순서에 기대고 있다.**
    //     여기에 키 정렬을 넣거나, 학생 id 형식을 숫자로 바꾸거나, Map·배열 등 다른 자료구조로
    //     옮기면 **조용히 깨진다**(낡은 레벨·골드가 이겨 화면이 과거로 보이고, 그 상태로
    //     저장되면 진행이 사라진다). 에러는 안 난다.
    //     scripts/smoke-test.mjs 의 "학생 중복 시 id 키 본 우선" 검사가 이 자리를 지킨다.
    const seen = new Map();
    data.students.forEach(s => seen.set(s.id, s));
    data.students = Array.from(seen.values())
      .sort((a, b) => {
        const na = parseInt((a.id||'').replace(/\D/g,'')) || 0;
        const nb = parseInt((b.id||'').replace(/\D/g,'')) || 0;
        return na - nb;
      });
    // questLogs가 완료 판정의 단일 소스 (quests 배열 인덱스 충돌 방지)
    data.quests = Object.values(data.questLogs || {})
      .filter(q => q != null && typeof q === 'object' && q.studentId);
    data.promotionRequests  = toArr(data.promotionRequests);
    data.boardQuests        = toArr(data.boardQuests);
    data.artworks           = toArr(data.artworks);
    // memories 중복 제거 — 같은 id가 여러 경로로 저장된 경우
    // 앨범 지정된 것(albumId 있는 것) 우선 보존
    {
      const raw = toArr(data.memories);
      const seen = new Map();
      raw.forEach(m => {
        if (!m || !m.id) return;
        const prev = seen.get(m.id);
        // 앨범 지정된 것 또는 처음 등장한 것 저장
        if (!prev || (m.albumId && !prev.albumId)) seen.set(m.id, m);
      });
      data.memories = Array.from(seen.values());
    }
    data.memoryAlbums       = toArr(data.memoryAlbums);
    data.recorderLogs       = toArr(data.recorderLogs);
    data.recorderSongs      = toArr(data.recorderSongs);
    data.weeklyGoals        = toArr(data.weeklyGoals);
    data.weeklyReflections  = toArr(data.weeklyReflections);
    data.customWords        = toArr(data.customWords);
    data.teacherWordSets    = toArr(data.teacherWordSets);
    data.quizRecords        = toArr(data.quizRecords);
    data.pwResetRequests    = toArr(data.pwResetRequests);
    data.customProblems     = toArr(data.customProblems);
    // emotionLogs·problemRecords는 키 기반 객체 유지 (배열 변환 금지)
    if (Array.isArray(data.emotionLogs)) data.emotionLogs = {};
    data.emotionLogs = data.emotionLogs || {};
    if (Array.isArray(data.problemRecords)) data.problemRecords = {};
    data.problemRecords = data.problemRecords || {};
    return data;
  },

  _migrate(data) {
    data.students = data.students.map(s => {
      if (s.stats && s.stats.moral !== undefined && s.stats.value === undefined) {
        s.stats.value = s.stats.moral; delete s.stats.moral;
      }
      const merged = {
        books:[], equipmentIds:{}, promotionPending:false,
        lastMonsterDate:'', monsterDailyCount:0,
        houseDecorations:[], achievements:[], farmHarvests:0,
        // 전투 시스템 기본값 (없는 경우만 채움)
        skillLevels:{ normal:1, fire:0, water:0, grass:0 },
        equippedSkills: ['normal', null, null], // 장착 스킬 3슬롯
        recentBattleOffers:[],
        battleOffersByZone:{ dateKey:'', beginner:null, intermediate:null, advanced:null },
        battleInProgress: null,
        ...s,
        houseDecorations: (s.houseDecorations||[]).map(p => {
          if (p.row !== undefined && p.col !== undefined) return p;
          const area = p.area || 'yard';
          const oldCols = area==='yard' ? 5 : 3;
          const slot = p.slot || 0;
          return {id:p.id, area, row:Math.floor(slot/oldCols), col:slot%oldCols};
        }),
      };
      // skillLevels: 기존 데이터 있으면 병합 (덮어쓰기 금지)
      if (s.skillLevels) merged.skillLevels = { normal:1, fire:0, water:0, grass:0, ...s.skillLevels };
      // equippedSkills: 없으면 기본값, 있으면 유지
      if (s.equippedSkills) merged.equippedSkills = s.equippedSkills;
      // 기본값 자동 보정: 항상 4칸, 노말은 항상 슬롯1에 보장
      if (!merged.equippedSkills || !Array.isArray(merged.equippedSkills)) {
        merged.equippedSkills = ['normal', null, null];
      }
      if (merged.equippedSkills.length < 3) {
        while (merged.equippedSkills.length < 3) merged.equippedSkills.push(null);
      }
      // 4칸 → 3칸 마이그레이션 (기존 4칸 데이터 잘라내기)
      if (merged.equippedSkills.length > 3) merged.equippedSkills = merged.equippedSkills.slice(0, 3);
      // battleDaily: 없으면 기본값
      if (!merged.battleDaily) {
        const today = new Date(Date.now()+9*3600000).toISOString().slice(0,10);
        merged.battleDaily = { dateKey: today, used: 0 };
      }
      // monsterLog: 이름/id 혼재 → id로 통일 + 중복 제거
      // (일반 전투=이름, 무한배틀=id로 저장되던 이력 정리 — 도감 UI/구역보상(이름 판정)과
      //  업적(id 판정)이 서로 어긋나던 버그 수정. 매핑 안 되는 항목(옛 커스텀 이름 등)은 원본 유지.)
      if (Array.isArray(merged.monsterLog) && merged.monsterLog.length) {
        const nameToId = {};
        GAME_DATA.monsters.forEach(m => { nameToId[m.name] = m.id; });
        const seen = new Set();
        merged.monsterLog = merged.monsterLog.reduce((out, e) => {
          const id = nameToId[e] || e;
          if (!seen.has(id)) { seen.add(id); out.push(id); }
          return out;
        }, []);
      }
      return merged;
    });
    return data;
  },

  load() { return this._cache; },

  // ── 부분 저장 (충돌 방지) ──
  // 저장 실패를 조용히 삼키지 않도록: 콘솔 로깅 + 각 화면이 정의한 훅 호출(있으면 사용자 안내)
  _onSaveError(e) {
    console.error('[DB] 저장 실패:', e);
    try { if (typeof window !== 'undefined' && typeof window.onDbSaveError === 'function') window.onDbSaveError(e); } catch(_) {}
  },

  saveStudent(student) {
    const db = this.load();
    const idx = db.students.findIndex(s => s.id === student.id);
    if (idx >= 0) db.students[idx] = student; else db.students.push(student);
    this._cache = db;
    this._saving = true;
    // id 키 기반 저장 (인덱스 충돌 방지)
    this._fbRef.child('students/' + student.id).set(student).catch(e => this._onSaveError(e)).finally(() => {
      setTimeout(() => { this._saving = false; }, 500);
    });
  },

  saveQuestLog(log) {
    const db = this.load();
    db.quests = db.quests || [];
    db.quests.push(log);
    this._cache = db;
    // questLogs에 고유 키로 저장 (완료 판정 기준)
    // [B16] Date.now()만 쓰면 [전체 승인]의 동기 루프에서 같은 밀리초에 같은 키가 만들어져
    //       기록 1건이 덮어써진다(특히 boardQuestId 없는 빠른보상은 둘 다 'manual').
    //       지급 자체는 두 번 되지만 활동 내역·능력치 내역·집계에서 건수가 누락됐다.
    const logId = log.studentId + '_' + (log.boardQuestId||'manual') + '_' + Date.now()
                + '_' + Math.random().toString(36).slice(2, 7);
    log._id = logId;
    this._fbRef.child('questLogs/' + logId).set(log).catch(e => this._onSaveError(e));
  },

  // ── 골드 수입 기록 (GOLD-LOG-1) ──────────────────────────────
  //  goldDaily/<studentId>_<date> 에 **경로별 하루 합계만** 쌓는다.
  //
  //  왜 이벤트마다가 아니라 하루 요약인가 (2026-09-10 실측):
  //    학생 1인이 하루에 만드는 골드 이벤트가 약 25건(농장 3 · 전투 3 · 무한배틀 10 · 퀘스트 8…)이다.
  //    이벤트마다 남기면 1년 약 3.2MB, 하루 요약이면 151KB — 21배 차이다.
  //    DB.init() 이 루트에 on('value') 를 걸어 두어서, 루트가 커지면 접속한 모든 학생이 그 비용을 나눠 진다.
  //
  //  왜 ServerValue.increment 인가:
  //    필드 하나만 서버에서 더한다. 통짜 set 도 transaction 도 안 쓴다 — 여러 명이 같은 순간에
  //    올려도 서버 원자 연산이라 어긋나지 않는다(Q1 의 통짜 set 경합 문제가 여기선 생기지 않는다).
  //
  //  왜 실패를 무시하는가:
  //    이 기록은 **통계용**이고 진실의 원본은 학생의 gold/totalGold 다.
  //    로그가 안 남았다고 해서 수확이 취소되거나 아이 화면이 멈추면 안 된다.
  //
  //  왜 BACKUP_NODES 에 넣지 않는가:
  //    잃어도 다시 쌓이는 통계다. 넣으면 백업이 또 커진다 —
  //    2026-09-10 기준 backups 가 이미 루트 7.6MB 의 73%(5.6MB)를 차지하고 있다.
  GOLD_SOURCES: ['farm', 'battle', 'infinite', 'quest', 'study', 'artwork', 'english'],

  //  교사 승인 보상의 종류(boardQuestType/type) → 위 경로 이름.
  //  · daily·weekly·special 은 다 '퀘스트'라 quest 로 묶는다. 감사 때 셋을 나눠 볼 일이 없었다.
  //  · book·emotion·promotion 은 **일부러 뺐다.** 7경로에 없고, 셋 다 questLogs 에 이미 남는다
  //    (2026-09-10 실측 기준 셋을 합쳐 1,705G — 학급 누적 254,422G 의 0.7%).
  //    나중에 넣기로 하면 GOLD_SOURCES 에 이름 하나 추가하고 이 표에 한 줄 더하면 된다.
  GOLD_SOURCE_BY_TYPE: {
    quest: 'quest', daily: 'quest', weekly: 'quest', special: 'quest',
    study: 'study', artwork: 'artwork', english: 'english',
  },
  //  모르는 종류면 null 을 준다 → logGold 가 조용히 넘어간다(기록 안 함, 지급은 정상).
  goldSourceOf(type) { return this.GOLD_SOURCE_BY_TYPE[type] || null; },
  logGold(studentId, source, amount) {
    try {
      const amt = Math.round(Number(amount) || 0);
      if (!studentId || amt <= 0) return;
      if (!this.GOLD_SOURCES.includes(source)) return;
      const inc = (typeof firebase !== 'undefined')
        && firebase.database && firebase.database.ServerValue
        && firebase.database.ServerValue.increment;
      if (!inc || !this._fbRef) return;
      const day = Utils.todayStr();
      this._fbRef.child('goldDaily/' + studentId + '_' + day)
        .update({ s: studentId, d: day, [source]: inc(amt) })
        .catch(() => {});          // 통계 실패는 조용히 넘어간다
    } catch (e) { /* 위와 같은 이유 — 게임 진행을 막지 않는다 */ }
  },

  // ── 골드 지출 기록 (GOLD-SPEND-1) ────────────────────────────
  //  수입(logGold)과 **같은 레코드** goldDaily/<studentId>_<date> 에 지출 필드를 더한다.
  //  필드 이름은 x_ 로 시작한다 — 수입 7경로와 섞여 합산되는 사고를 막으려고 앞머리로 가른다.
  //
  //  왜 필요한가 (2026-09-14 첫 실측):
  //    강지원 farm 7,250G = 밭 25칸 × 딸기 판매가 290G. 그런데 씨앗값 25 × 60G = 1,500G 가
  //    어디에도 안 남아 순수익(5,750G)을 볼 수 없었다. 수입만으로는 인플레이션을 잴 수 없다.
  //
  //  logGold 와 따로 둔 이유: 이미 운영 중인 수입 기록 코드를 건드리지 않기 위해서다
  //    (고치다가 새로 만든 실수를 피한다). 원칙은 똑같다 — increment 필드 하나, 실패는 무시.
  //
  //  3D 마을은 골드를 쓰지 않는다(2026-09-15 확인, 사용자 결정으로 무료). 여기에 경로 없음.
  SPEND_SINKS: ['equip', 'skill', 'seed', 'deco'],
  logSpend(studentId, sink, amount) {
    try {
      const amt = Math.round(Number(amount) || 0);
      if (!studentId || amt <= 0) return;
      if (!this.SPEND_SINKS.includes(sink)) return;
      const inc = (typeof firebase !== 'undefined')
        && firebase.database && firebase.database.ServerValue
        && firebase.database.ServerValue.increment;
      if (!inc || !this._fbRef) return;
      // [GOLD-SPEND-2] 학생 노드별 구독 판(_snaps)에서만 쓴다. root 를 통째로 구독하는 판에서는 이 update() 가
      //   동기 value 이벤트를 띄워 CUR 이 옛 캐시로 바뀌고, 이어진 saveStudent 가 **골드 차감을 지워 구매가 공짜**가 된다
      //   (#218 revert 원인, real-sdk --profile=root FREE_ITEM). 학생 기기도 시작 REST 확인이 실패하면 root 판으로 떨어지므로
      //   profile 이 아니라 실제 구독 모드(_snaps)로 가른다. 골드 유실 수정(#288)이 root 판을 막으면 이 줄을 풀어도 된다.
      if (!this._snaps) return;
      const day = Utils.todayStr();
      this._fbRef.child('goldDaily/' + studentId + '_' + day)
        .update({ s: studentId, d: day, ['x_' + sink]: inc(amt) })
        .catch(() => {});          // 통계 실패는 조용히 넘어간다 — 구매는 이미 끝났다
    } catch (e) { /* 게임 진행을 막지 않는다 */ }
  },

  // ── 학생 쪽지 (NOTES-1) ────────────────────────────────────
  //  studentNotes/<studentId>/<noteId> 개별 경로로만 읽고 쓴다.
  //  학생 객체 필드로 두지 않는 이유: saveStudent 는 students/<id> 를 통짜 set 하고
  //  호출처가 64곳(student.js 37 · admin.js 25 · 여기 2)이라 대부분 학생 브라우저에서 돈다.
  //  쪽지를 모르는 낡은 학생 사본이 한 번만 저장돼도 교사가 쓴 쪽지가 통째로 사라진다
  //  — Q1(boardQuests 통짜 set)과 같은 실패 방식이다.
  //  같은 이유로 여기서도 studentNotes 통짜 set 을 하지 않는다(쪽지 하나씩 개별 경로).
  getStudentNotes(studentId) {
    const mine = (this.load().studentNotes || {})[studentId] || {};
    return Object.keys(mine)
      .filter(k => mine[k] && typeof mine[k] === 'object')
      .map(k => ({ ...mine[k], id: k }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },
  saveStudentNote(studentId, note) {
    const db = this.load();
    db.studentNotes = db.studentNotes || {};
    db.studentNotes[studentId] = db.studentNotes[studentId] || {};
    const id  = note.id || ('n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
    const now = Date.now();
    const rec = { ...note, id, updatedAt: now, createdAt: note.createdAt || now };
    db.studentNotes[studentId][id] = rec;
    this._cache = db;
    this._fbRef.child('studentNotes/' + studentId + '/' + id).set(rec)
      .catch(e => this._onSaveError(e));
    return rec;
  },
  deleteStudentNote(studentId, noteId) {
    const db = this.load();
    if (db.studentNotes && db.studentNotes[studentId]) delete db.studentNotes[studentId][noteId];
    this._cache = db;
    this._fbRef.child('studentNotes/' + studentId + '/' + noteId).remove()
      .catch(e => this._onSaveError(e));
  },

  saveArtwork(artwork) {
    const db = this.load();
    db.artworks = db.artworks || [];
    // 필드명 통일: title/comment/subject 기준으로 저장
    const normalized = {
      ...artwork,
      title:   artwork.title   || artwork.artTitle || '',
      comment: artwork.comment || artwork.artDesc  || '',
      subject: artwork.subject || '',
    };
    db.artworks.push(normalized);
    this._cache = db;
    this._fbRef.child('artworks/' + normalized.id).set(normalized).catch(e => this._onSaveError(e));
  },

  // [ART-RAW-KEY-1] 작품이 실제로 저장된 키들. 운영 artworks 는 옛 배열(숫자 키 0,1,2…)이라
  //   `artworks/<작품id>/…` 에 쓰면 진짜 작품은 그대로이고 유령 조각만 생겼다(내리기가 학생 화면에 안 먹음).
  //   서버 판에서 value.id 가 같은 키를 모두 찾는다(숫자 키·id 키 둘 다 있으면 둘 다). 없으면 id 키.
  //   root 구독이 이미 받아 둔 판이라 once 는 SDK 캐시에서 바로 온다(추가 다운로드 없음).
  _artworkKeys(id) {
    return this._fbRef.child('artworks').once('value').then(snap => {
      const raw = snap.val() || {};
      const keys = Object.keys(raw).filter(k => raw[k] && raw[k].id === id);
      return keys.length ? keys : [id];
    }, () => [id]);
  },

  updateArtwork(id, patch) {
    const db = this.load();
    const idx = (db.artworks||[]).findIndex(a => a.id === id);
    if (idx < 0) return false;
    db.artworks[idx] = { ...db.artworks[idx], ...patch };
    this._cache = db;
    this._saving = true;
    const rec = db.artworks[idx];
    return this._artworkKeys(id).then(keys => Promise.all(keys.map(k => this._fbRef.child('artworks/' + k).set(rec)))).catch(e => this._onSaveError(e)).finally(() => {
      setTimeout(() => { this._saving = false; }, 300);
    });
  },

  getStudents()    { return this.load().students; },
  getStudent(id)   { return this.load().students.find(s => s.id === id); },

  getSettings()    { return this.load().settings; },
  saveSettings(s)  {
    const db = this.load();
    db.settings = s;
    this._cache = db;
    this._saving = true;
    // settings 노드만 부분 저장 (root 전체 set 방지)
    this._fbRef.child('settings').set(s).catch(e => this._onSaveError(e)).finally(() => {
      setTimeout(() => { this._saving = false; }, 500);
    });
  },

  getQuests()      { return this.load().quests || []; },

  // ── 오늘 일일퀘스트 자동 등록 (앱 로드 시 1회) ──
  // [Q-2A] admin.checkAutoDailyQuests()의 핵심 로직을 공용 DB helper로 이전.
  //        호출처: admin.js window.onload + student.js enterGame() ([Q-2B]).
  ensureDailyQuests() {
    const settings = this.getSettings();
    const autoItems = settings.autoDailyQuests;
    if (!autoItems || autoItems.length === 0) return;

    const today = Utils.todayStr();
    if (settings.autoDailyLastDate === today) return; // 오늘 이미 처리됨

    // [Q1] boardQuests 통짜 set 금지.
    //   학생 여러 명이 아침에 동시 접속하면 각자 자기 기기의 낡은 목록으로 전체를 덮어써,
    //   그 사이 교사가 추가한 퀘스트가 소리 없이 사라졌다.
    //   인덱스 부분 저장도 안 된다 — 배열 인덱스는 기기마다 가리키는 퀘스트가 다르다.
    //   서버의 현재 목록 위에 적용하는 transaction으로 처리한다(경합 시 Firebase가 재시도).
    const applyDaily = (list) => {
      const next = (list || []).slice();
      // 어제 일일퀘스트 중 아직 active인 것 내리기
      for (let i = 0; i < next.length; i++) {
        const q = next[i];
        if (q && q.type === 'daily' && q.active !== false && q.date !== today) {
          next[i] = { ...q, active: false };
        }
      }
      // 오늘 자동 등록
      autoItems.forEach((item, i) => {
        if (next.find(q => q && q.name === item.name && q.active !== false)) return;
        next.push({
          id: 'bq_auto_' + today + '_' + i,
          name: item.name,
          type: 'daily',
          exp: 35, gold: 25,
          icon: '📋',
          stat: item.stat || '',
          statVal: item.statVal || 0,
          dueDate: '', date: today,
          active: true,
        });
      });
      return next;
    };

    const db = this.load();
    db.boardQuests = applyDaily(db.boardQuests); // 화면 즉시 반영용 로컬 캐시
    this._cache = db;
    this._fbRef.child('boardQuests').transaction(cur => applyDaily(cur));

    // 오늘 날짜 기록 — [DAILY-DATE-FIELD-1] 이 한 칸만 쓴다.
    //   예전엔 saveSettings 로 settings 통째 set 이라, 학생 기기가 아침에 이걸 부르는 순간(왕복 시간 안)
    //   교사가 바꾼 설정(보스 켜기 등)을 옛 캐시 값으로 되돌렸다.
    settings.autoDailyLastDate = today;
    this._fbRef.child('settings/autoDailyLastDate').set(today).catch(e => this._onSaveError(e));
  },

  getPromotionRequests()     { return (this.load().promotionRequests || []).filter(Boolean); },   // 빈 칸(null)이 끼면 r.id 읽다 깨짐
  // [PROMO-PER-ID-1] 승급 신청은 id 키 한 건씩 쓴다.
  //   예전엔 기기 캐시의 배열을 통째로 set 해서, 두 학생이 거의 동시에 신청하면 한 명이 사라지고
  //   교사 승인 직후 옛 캐시 기기가 신청하면 승인한 신청이 되살아났다(다시 승인하면 보상 중복).
  //   읽기는 _normalizeArrays 의 toArr(Object.values) 그대로. 모음 전체를 쓸 때도 반드시 _promoObj 로.
  _promoObj(arr) {
    const o = {};
    (arr || []).forEach(r => { if (r && r.id) o[r.id] = r; });
    return o;
  },
  savePromotionRequests(arr) {
    const db = this.load(); db.promotionRequests = arr; this._cache = db;
    this._fbRef.child('promotionRequests').set(this._promoObj(arr));
  },
  addPromotionRequest(r) {
    const db = this.load();
    db.promotionRequests = db.promotionRequests || [];
    // 중복 차단: 동일 studentId + level
    const exists = db.promotionRequests.some(x => x && x.studentId === r.studentId && Number(x.level) === Number(r.level));
    if (exists) return false;
    db.promotionRequests.push(r);
    this._cache = db;
    // 한 건만 쓰므로 다른 기기의 신청·승인을 덮지 않는다 → _saving 창도 필요 없음
    this._fbRef.child('promotionRequests/' + r.id).set(r).catch(e => this._onSaveError(e));
    return true;
  },
  removePromotionRequest(id) {
    const db = this.load();
    db.promotionRequests = (db.promotionRequests || []).filter(r => r && r.id !== id);
    this._cache = db;
    const node = this._fbRef.child('promotionRequests');
    node.child(id).remove().catch(e => this._onSaveError(e));
    // 안전띠: 옛 판 기기·옛 백업이 배열(숫자 키)로 써 둔 게 있으면 이 기회에 id 키로 옮긴다.
    //   숫자 키만 지우면 배열에 구멍(null)이 생겨 r.id 읽는 화면이 깨지므로, 지운 신청 말고는 id 키로 다시 넣는다.
    node.once('value').then(snap => {
      const v = snap.val();
      if (!v || typeof v !== 'object') return;
      const upd = {};
      // 이 기기가 그사이 지운 신청은 되살리지 않도록 지금 캐시에 남아 있는 것만 옮긴다
      const keep = new Set((this.load().promotionRequests || []).map(r => r && r.id));
      Object.keys(v).forEach(k => {
        const r = v[k];
        if (!/^\d+$/.test(k)) return;
        upd[k] = null;
        if (r && r.id && r.id !== id && keep.has(r.id)) upd[r.id] = r;
      });
      if (Object.keys(upd).length) return node.update(upd);
    }).catch(e => this._onSaveError(e));
  },

  async getAdminPw() {
    const snap = await this._fbAdminRef.once('value');
    return snap.val() || 'teacher1234';
  },
  setAdminPw(pw) { this._fbAdminRef.set(pw); },

  getArtworks(studentId) { return (this.load().artworks||[]).filter(a => a.studentId === studentId); },
  // [ARTFREE-1] 학생 통짜 set 대신 pendingRewards 한 갈래만 쓴다.
  //   기존 submitArtwork가 saveStudent(CUR)로 학생 전체를 덮어써서, 그 사이 다른 곳에서 바뀐
  //   값(경험치·골드 등)을 되돌리는 자리였다. 여기서는 students/<id>/pendingRewards만 건드린다.
  addPendingReward(student, reward) {
    const db = this.load();
    const s = (db.students || []).find(x => x.id === student.id) || student;
    s.pendingRewards = [...(s.pendingRewards || []), reward];
    this._cache = db;
    if (student !== s) student.pendingRewards = s.pendingRewards;
    return this._fbRef.child('students/' + s.id + '/pendingRewards').set(s.pendingRewards)
      .catch(e => this._onSaveError(e));
  },

  // [ARTFREE-1] 좋아요 — artworks/<id>/likes/<studentId> 한 칸만 쓴다(작품 통짜 set 금지).
  setArtworkLike(artId, studentId, on) {
    const db = this.load();
    const a = (db.artworks || []).find(x => x.id === artId);
    if (!a) return Promise.resolve();
    a.likes = a.likes || {};
    if (on) a.likes[studentId] = true; else delete a.likes[studentId];
    this._cache = db;
    return this._artworkKeys(artId).then(keys => Promise.all(keys.map(k => {   // [ART-RAW-KEY-1]
      const ref = this._fbRef.child('artworks/' + k + '/likes/' + studentId);
      return on ? ref.set(true) : ref.remove();
    }))).catch(e => this._onSaveError(e));
  },

  // [ART-KEY-FIX-1] artworks 서버 판(raw) → "작품 id = 키" 로 맞추는 **바뀔 키만** 담은 update 객체(순수 함수, 쓰기 없음).
  //   · 옛 숫자 키 작품은 id 키로 옮기고, 그 id 키에 쓰여 있던 유령 조각(hidden·likes)은 합친다
  //   · 같은 작품이 id 키에 이미 있으면 숫자 키만 지운다 · keep(a) 가 false 면 지운다(그 작품의 유령 조각도)
  //   · 이미 제 모양인 키(그 순간 올라온 새 작품)는 건드리지 않는다
  //   숫자 키 하나만 지우면 배열에 null 구멍이 생겨 `a.id` 를 읽는 화면이 깨지므로, 지울 때도 이걸로 모양을 같이 맞춘다.
  _artworkKeyFix(raw, keep) {
    raw = raw || {};
    const keys = Object.keys(raw);
    const upd = {};
    const mergedGhost = new Set();
    let moved = 0, removed = 0;
    const hasRealAt = k => !!(raw[k] && raw[k].id === k);
    for (const k of keys) {
      const a = raw[k];
      if (!a || !a.id) continue;                               // id 없는 것은 아래에서
      if (a.id === k) {                                        // 이미 제 모양
        if (!keep(a)) { upd[k] = null; removed++; }
        continue;
      }
      upd[k] = null;                                           // 키가 id 가 아님(옛 숫자 키 등)
      if (!keep(a)) { removed++; continue; }
      if (hasRealAt(a.id) || (upd[a.id] && upd[a.id].id)) { removed++; continue; }   // 같은 작품이 이미 id 키에 → 중복
      const piece = raw[a.id] && !raw[a.id].id ? raw[a.id] : {};                    // 유령 조각
      const rec = { ...a, ...piece, likes: { ...(a.likes || {}), ...(piece.likes || {}) } };
      if (!Object.keys(rec.likes).length) delete rec.likes;
      upd[a.id] = rec; mergedGhost.add(a.id); moved++;
    }
    for (const k of keys) {                                    // id 없는 레코드: 옮긴 작품에 합쳐진 조각이 아니면 버린다
      const a = raw[k];
      if (a && a.id) continue;
      if (mergedGhost.has(k)) continue;
      upd[k] = null; removed++;
    }
    return { upd, moved, removed };
  },

  // [ARTFREE-1] 작품 내리기 — 갤러리에서만 감춘다(지우지 않는다). hidden 한 칸만 쓴다.
  hideArtwork(id, hidden) {
    const db = this.load();
    const a = (db.artworks || []).find(x => x.id === id);
    if (a) { a.hidden = !!hidden; this._cache = db; }
    return this._artworkKeys(id)   // [ART-RAW-KEY-1] 숫자 키 판이어도 진짜 작품(들)에 쓴다
      .then(keys => Promise.all(keys.map(k => this._fbRef.child('artworks/' + k + '/hidden').set(!!hidden))))
      .catch(e => this._onSaveError(e));
  },

  deleteArtwork(id) {
    const db = this.load();
    db.artworks = (db.artworks||[]).filter(a => a && a.id !== id);
    this._cache = db;
    // [ART-KEY-FIX-1] 캐시 판 통째 set 대신 서버 판에서 바뀔 키만 — 그 순간 올라온 작품을 지우지 않고,
    //   숫자 키 판이면 모양도 같이 맞춰 null 구멍을 안 남긴다
    const node = this._fbRef.child('artworks');
    return node.once('value').then(snap => {
      const { upd } = this._artworkKeyFix(snap.val(), a => a.id !== id);
      if (Object.keys(upd).length) return node.update(upd);
    }).catch(e => this._onSaveError(e));
  },

  // ── 추억 사진 ────────────────────────────────────────
  getMemories(filter) {
    // filter: 'public' = 전체공개, 'all' = 전체, studentId = 해당학생
    const db = this.load();
    const mems = db.memories || [];
    if (filter === 'public') {
      return mems.filter(m => m.approvalStatus === 'approved' &&
        (m.visibilityType === 'public' ||
         (m.visibilityType === 'class' && m.approvalStatus === 'approved')));
    }
    if (filter === 'all') return mems;
    if (filter) return mems.filter(m => m.studentId === filter || m.visibilityType === 'public');
    return mems;
  },
  saveMemory(mem) {
    const db = this.load();
    db.memories = db.memories || [];
    const idx = db.memories.findIndex(m => m.id === mem.id);
    if (idx >= 0) db.memories[idx] = { ...db.memories[idx], ...mem };
    else db.memories.push(mem);
    this._cache = db;
    // 전체 배열로 덮어쓰기 — 경로별 set은 배열 인덱스와 키가 섞여 중복 발생
    this._fbRef.child('memories').set(db.memories);
  },
  deleteMemory(id) {
    const db = this.load();
    db.memories = (db.memories||[]).filter(m => m.id !== id);
    this._cache = db;
    // 전체 배열 덮어쓰기 — 배열 인덱스 경로와 문자열 키 경로 모두 정리
    this._fbRef.child('memories').set(db.memories);
  },

  // ── 주간 다짐 (월요일 목표 + 금요일 성찰) ─────────────
  // 월요일: { id, studentId, studentName, weekKey, type:'monday_goal',
  //   weekendText, weekendMood, focusArea, goalText, mindset,
  //   createdAt, updatedAt }
  // 금요일: { id, studentId, studentName, weekKey, type:'friday_reflection',
  //   mondayGoalId, focusReflection, goalReflection, mindsetReflection,
  //   bestMoment, nextWeekGoal, createdAt, updatedAt }
  getWeeklyGoals(studentId) {
    return (this.load().weeklyGoals||[]).filter(r => r.studentId === studentId);
  },
  getWeeklyGoal(studentId, weekKey) {
    return (this.load().weeklyGoals||[]).find(r => r.studentId===studentId && r.weekKey===weekKey) || null;
  },
  getAllWeeklyGoals() { return this.load().weeklyGoals || []; },
  saveWeeklyGoal(goal) {
    const db = this.load();
    db.weeklyGoals = db.weeklyGoals || [];
    const idx = db.weeklyGoals.findIndex(r => r.id === goal.id);
    if (idx >= 0) db.weeklyGoals[idx] = { ...db.weeklyGoals[idx], ...goal, updatedAt: Date.now() };
    else db.weeklyGoals.push({ ...goal, updatedAt: Date.now() });
    this._cache = db;
    this._fbRef.child('weeklyGoals/' + goal.id).set(db.weeklyGoals.find(r=>r.id===goal.id));
  },
  getWeeklyReflection(studentId, weekKey) {
    return (this.load().weeklyReflections||[]).find(r => r.studentId===studentId && r.weekKey===weekKey) || null;
  },
  getAllWeeklyReflections() { return this.load().weeklyReflections || []; },
  saveWeeklyReflection(ref) {
    const db = this.load();
    db.weeklyReflections = db.weeklyReflections || [];
    const idx = db.weeklyReflections.findIndex(r => r.id === ref.id);
    if (idx >= 0) db.weeklyReflections[idx] = { ...db.weeklyReflections[idx], ...ref, updatedAt: Date.now() };
    else db.weeklyReflections.push({ ...ref, updatedAt: Date.now() });
    this._cache = db;
    this._fbRef.child('weeklyReflections/' + ref.id).set(db.weeklyReflections.find(r=>r.id===ref.id));
  },

  // ── 리코더 곡 목록 ─────────────────────────────────
  // { id, title, grade, memo, order, isFocusSong, active, createdAt, updatedAt }
  getRecorderSongs() {
    return (this.load().recorderSongs || [])
      .sort((a,b) => (a.order??99) - (b.order??99));
  },
  getActiveRecorderSongs() {
    return this.getRecorderSongs().filter(s => s.active !== false);
  },
  saveRecorderSong(song) {
    const db = this.load();
    db.recorderSongs = db.recorderSongs || [];
    const idx = db.recorderSongs.findIndex(s => s.id === song.id);
    const now = Date.now();
    if (idx >= 0) {
      db.recorderSongs[idx] = { ...db.recorderSongs[idx], ...song, updatedAt: now };
    } else {
      db.recorderSongs.push({
        order: db.recorderSongs.length, active: true, isFocusSong: false,
        ...song, createdAt: now, updatedAt: now
      });
    }
    this._cache = db;
    this._fbRef.child('recorderSongs').set(db.recorderSongs);
  },
  deleteRecorderSong(id) {
    const db = this.load();
    db.recorderSongs = (db.recorderSongs || []).filter(s => s.id !== id);
    this._cache = db;
    this._fbRef.child('recorderSongs').set(db.recorderSongs);
  },

  // ── 리코더 기록 ─────────────────────────────────────
  // 저장 단위: 학생 + 곡 + 날짜 = 1레코드
  // { id, studentId, studentName, songId, songTitle, date,
  //   practiceCount(0~5), recordingUrl, recordingName,
  //   reflection, bestToday, difficultPart, selfRating(1~5),
  //   teacherComment, createdAt, updatedAt }
  getAllRecorderLogs() { return this.load().recorderLogs || []; },
  getRecorderLogs(studentId) {
    return (this.load().recorderLogs || []).filter(r => r.studentId === studentId);
  },
  getRecorderLog(studentId, songId, date) {
    return (this.load().recorderLogs || []).find(
      r => r.studentId===studentId && r.songId===songId && r.date===date
    ) || null;
  },
  saveRecorderLog(log) {
    const db = this.load();
    db.recorderLogs = db.recorderLogs || [];
    const idx = db.recorderLogs.findIndex(r => r.id === log.id);
    const now = Date.now();
    if (idx >= 0) {
      db.recorderLogs[idx] = { ...db.recorderLogs[idx], ...log, updatedAt: now };
    } else {
      db.recorderLogs.push({ ...log, createdAt: now, updatedAt: now });
    }
    this._cache = db;
    this._fbRef.child('recorderLogs/' + log.id).set(
      db.recorderLogs.find(r => r.id === log.id)
    );
  },
  deleteRecorderLog(id) {
    const db = this.load();
    db.recorderLogs = (db.recorderLogs || []).filter(r => r.id !== id);
    this._cache = db;
    this._fbRef.child('recorderLogs/' + id).remove();
  },

  // ── 교육과정 문제 은행 (curriculum.js의 BASE_PROBLEMS + 교사 추가분) ──
  // customProblems: { id, unitId, type, q, a, choices?, alt?, hint?, level, createdAt }
  getCustomProblems()     { return this.load().customProblems || []; },
  saveCustomProblem(p) {
    const db = this.load();
    db.customProblems = db.customProblems || [];
    const idx = db.customProblems.findIndex(x => x.id === p.id);
    if (idx >= 0) db.customProblems[idx] = { ...db.customProblems[idx], ...p };
    else db.customProblems.push({ ...p, createdAt: Date.now() });
    this._cache = db;
    this._fbRef.child('customProblems').set(db.customProblems).catch(e => this._onSaveError(e));
  },
  deleteCustomProblem(id) {
    const db = this.load();
    db.customProblems = (db.customProblems || []).filter(x => x.id !== id);
    this._cache = db;
    this._fbRef.child('customProblems').set(db.customProblems).catch(e => this._onSaveError(e));
  },
  // 문제 풀이 기록: { id, studentId, unitId, date, total, correct, wrongIds[] }
  getProblemRecords(studentId) {
    const all = Object.values(this.load().problemRecords || {});
    return studentId ? all.filter(r => r && r.studentId === studentId) : all;
  },
  saveProblemRecord(rec) {
    const db = this.load();
    db.problemRecords = db.problemRecords || {};
    db.problemRecords[rec.id] = rec;
    this._cache = db;
    this._fbRef.child('problemRecords/' + rec.id).set(rec).catch(e => this._onSaveError(e));
  },

  // [VOCAB-REMOVE-1] RPG 안 영어 단어장은 폐기(영어는 영어앱으로 일원화).
  //   읽고 쓰던 헬퍼와 BASE_WORDS 500개를 지웠다.
  //   다만 데이터 노드 customWords · teacherWordSets · quizRecords 는 **지우지 않았고**
  //   BACKUP_NODES 에서도 빼지 않았다 — 되돌릴 여지를 남기기 위해서다.

  // ── 앨범 (그룹) ────────────────────────────────────────
  // { id, name, date, desc, createdAt }
  getAlbums()      { return this.load().memoryAlbums || []; },
  saveAlbum(a) {
    const db = this.load();
    db.memoryAlbums = db.memoryAlbums || [];
    const idx = db.memoryAlbums.findIndex(x=>x.id===a.id);
    if (idx>=0) db.memoryAlbums[idx] = {...db.memoryAlbums[idx],...a};
    else db.memoryAlbums.push({...a, createdAt:Date.now()});
    this._cache=db;
    this._fbRef.child('memoryAlbums').set(db.memoryAlbums);
  },
  deleteAlbum(id) {
    const db = this.load();
    db.memoryAlbums = (db.memoryAlbums||[]).filter(a=>a.id!==id);
    // 해당 앨범 사진들 앨범 해제
    (db.memories||[]).forEach(m=>{ if(m.albumId===id){ m.albumId=null; m.albumName=''; } });
    this._cache=db;
    this._fbRef.child('memoryAlbums').set(db.memoryAlbums);
    this._fbRef.child('memories').set(db.memories);
  },
  addPwResetRequest(r) {
    const db = this.load();
    db.pwResetRequests = [...(db.pwResetRequests || []), r];
    this._cache = db;
    this._saving = true;
    // 요청 단위 부분 저장 (root 전체 set 방지, id 키 기반)
    this._fbRef.child('pwResetRequests/' + r.id).set(r).finally(() => {
      setTimeout(() => { this._saving = false; }, 500);
    });
  },
  removePwResetRequest(id) {
    const db = this.load();
    db.pwResetRequests = (db.pwResetRequests || []).filter(r => r.id !== id);
    this._cache = db;
    this._saving = true;
    // 요청 단위 삭제 (root 전체 set 방지)
    this._fbRef.child('pwResetRequests/' + id).remove().finally(() => {
      setTimeout(() => { this._saving = false; }, 500);
    });
  },
  getPwResetRequests()    { return this.load().pwResetRequests || []; },
};

// ─── 유틸리티 ────────────────────────────────────────
const Utils = {

  levelFromExp(exp) {
    const t = GAME_DATA.expTable;
    for (let i = t.length - 1; i >= 0; i--) { if (exp >= t[i]) return i + 1; }
    return 1;
  },
  expForLevel(lv)    { return GAME_DATA.expTable[Math.min(lv-1, GAME_DATA.expTable.length-1)]; },
  expForNextLevel(lv){ return GAME_DATA.expTable[Math.min(lv,   GAME_DATA.expTable.length-1)]; },

  expPct(s) {
    const cur  = s.exp - this.expForLevel(s.level);
    const need = this.expForNextLevel(s.level) - this.expForLevel(s.level);
    if (need <= 0) return 100;
    return Math.max(0, Math.min(100, (cur / need) * 100));
  },

  // ★ 장비 장착: 이전 스탯 제거 후 새 스탯 적용
  equipItem(student, item) {
    const slot = GAME_DATA.getSlotForItem(item.id);
    if (!slot) return;
    student.equipmentIds = student.equipmentIds || {};
    student.combat = student.combat || {};
    const oldId = student.equipmentIds[slot];
    if (oldId) {
      const old = GAME_DATA.getItemById(oldId);
      if (old) Object.entries(old.stats).forEach(([k,v]) => {
        student.combat[k] = Math.max(0, (student.combat[k]||0) - v);
      });
    }
    student.equipmentIds[slot] = item.id;
    student.equipment = student.equipment || {};
    student.equipment[slot] = item.name;
    Object.entries(item.stats).forEach(([k,v]) => {
      student.combat[k] = (student.combat[k]||0) + v;
    });
  },

  cropReady(planted, growHours)    { return Date.now() - planted >= growHours * 3600000; },
  cropProgress(planted, growHours) { return Math.min(100, ((Date.now()-planted)/(growHours*3600000))*100); },

  getSeedById(id)    { return GAME_DATA.seeds.find(s => s.id === id) || GAME_DATA.mutantSeeds.find(s => s.id === id); },
  getSeedByCrop(crop){ return GAME_DATA.seeds.find(s => s.crop === crop) || GAME_DATA.mutantSeeds.find(s => s.crop === crop); },

  condMet(student, cond) {
    return Object.entries(cond).every(([stat,val]) => (student.stats[stat]||0) >= val);
  },
  condText(cond) {
    const n = GAME_DATA.statNames;
    return Object.entries(cond).map(([s,v]) => `${n[s]||s} ${v}`).join(' + ') || '조건 없음';
  },
  statText(stats) {
    const n = GAME_DATA.combatNames;
    return Object.entries(stats).map(([s,v]) => `${n[s]||s} +${v}`).join(' · ');
  },

  charEmoji(type)       { return {1:'🧑‍🦱',2:'👧',3:'🧑',4:'👩'}[type]||'🧑'; },
  isPromotionLevel(lv)  { return GAME_DATA.promotionLevels.includes(lv); },

  // ★ 공용 퀘스트 상태 계산 (관리자/학생/키오스크 3화면 공통)
  // 반환값: 'done' | 'pending' | 'none'
  questStatus(studentId, questId, questType, questLogs, pendingRewards, activeBoardQuestIds) {
    // 삭제된 boardQuest 참조는 무시
    if (activeBoardQuestIds && !activeBoardQuestIds.has(questId)) return 'none';

    // 완료 판정
    const done = this.isQuestDoneToday(questLogs, studentId, questId, questType);
    if (done) return 'done';

    // 승인된 pending도 done 취급
    const approved = (pendingRewards||[]).some(r=>
      r && r.boardQuestId===questId && r.approved===true
    );
    if (approved) return 'done';

    // 대기중
    const pending = (pendingRewards||[]).some(r=>
      r && r.boardQuestId===questId && !r.approved
    );
    if (pending) return 'pending';

    return 'none';
  },

  // 장래희망 + 레벨로 직업명 생성
  getJobTitle(dream, level) {
    if (!dream) dream = '직장인';
    // 장래희망에서 핵심 단어 추출
    const core = dream
      .replace(/미래의?\s*/,'').replace(/꿈꾸는\s*/,'').replace(/되고싶은\s*/,'')
      .replace(/장래희망\s*/,'').replace(/최고의\s*/,'').trim() || dream;

    if (level < 5)  return '초등학생';
    if (level < 10) return '중학생';
    if (level < 15) return '고등학생';
    if (level < 20) return '대학생';
    if (level < 25) return `${core} 지망생`;
    if (level < 30) return core;
    return `위대한 ${core}`;
  },
  todayStr() {
    // KST(UTC+9) 기준 날짜
    return new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  },
  weekStartStr() {
    // KST 기준 이번 주 일요일 (일요일 자정 리셋)
    const d = new Date(Date.now()+9*3600000);
    const day = d.getUTCDay(); // 0=일, 1=월 ...
    const sun = new Date(d);
    sun.setUTCDate(d.getUTCDate() - day); // 이번 주 일요일
    return sun.toISOString().slice(0,10);
  },
  // ISO 주차 키: 2026-W14 형태 (월요일 기준)
  weekKey() {
    const d = new Date(Date.now()+9*3600000);
    const day = d.getUTCDay(); // 0=일
    // 이번 주 월요일 찾기
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setUTCDate(d.getUTCDate() + diff);
    // ISO 주차 계산
    const jan1 = new Date(Date.UTC(mon.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((mon - jan1) / 86400000 + jan1.getUTCDay() + 1) / 7);
    return `${mon.getUTCFullYear()}-W${String(weekNum).padStart(2,'0')}`;
  },
  isQuestDoneToday(quests, studentId, boardQuestId, questType) {
    const today = this.todayStr();
    const weekStart = this.weekStartStr();
    return (quests||[]).some(q => {
      if (q.studentId!==studentId || q.boardQuestId!==boardQuestId) return false;
      if (!q.date) return true;
      if (questType==='daily')  return q.date===today;
      if (questType==='weekly') return q.date>=weekStart;
      return true;
    });
  },
  uid()                 { return 'id_'+Date.now()+'_'+Math.random().toString(36).slice(2,7); },

  // ★ 몬스터 하루 도전 횟수 체크 — DB settings에서 직접 읽어 항상 최신값 보장
  _getBattleLimit() {
    if (typeof DB !== 'undefined') {
      const bs = (DB.getSettings()?.customBattleSettings) || {};
      if (bs.dailyBattleLimit !== undefined) return bs.dailyBattleLimit;
    }
    return BATTLE_CONSTS?.dailyBattleLimit ?? 3;
  },
  canFightMonster(student) {
    const limit = this._getBattleLimit();
    const today = this.todayStr();
    const bd = student.battleDaily || {};
    if (bd.dateKey !== today) return true;
    return (bd.used || 0) < limit;
  },
  monsterAttemptsLeft(student) {
    const limit = this._getBattleLimit();
    const today = this.todayStr();
    const bd = student.battleDaily || {};
    if (bd.dateKey !== today) return limit;
    return Math.max(0, limit - (bd.used || 0));
  },
};

// ─── 업적 시스템 ─────────────────────────────────────
const ACHIEVEMENTS = [
  // ══ A. 퀘스트 ══════════════════════════════════════════
  { id:'ach_quest1',   icon:'📋', name:'첫 번째 발걸음',  desc:'첫 퀘스트 완료',           check: s=>(s.totalQuests||0)>=1,   reward:{exp:20,gold:10,title:null,deco:null} },
  { id:'ach_quest5',   icon:'📋', name:'퀘스트 입문자',   desc:'퀘스트 5회 완료',          check: s=>(s.totalQuests||0)>=5,   reward:{exp:30,gold:15,title:null,deco:null} },
  { id:'ach_quest10',  icon:'📜', name:'퀘스트 마스터',   desc:'퀘스트 10회 완료',         check: s=>(s.totalQuests||0)>=10,  reward:{exp:50,gold:30,title:null,deco:null} },
  { id:'ach_quest30',  icon:'🏅', name:'믿음직한 해결사', desc:'퀘스트 30회 완료',         check: s=>(s.totalQuests||0)>=30,  reward:{exp:100,gold:60,title:'해결사',deco:null} },
  { id:'ach_quest50',  icon:'🏆', name:'만능 해결사',     desc:'퀘스트 50회 완료',         check: s=>(s.totalQuests||0)>=50,  reward:{exp:150,gold:100,title:'만능 해결사',deco:'deco_trophy'} },
  { id:'ach_quest_approv', icon:'✅', name:'승인왕',      desc:'퀘스트 승인 20회 이상',    check: s=>(s.totalQuests||0)>=20,  reward:{exp:60,gold:40,title:null,deco:null} },

  // ══ B. 전투 / 몬스터 ════════════════════════════════════
  { id:'ach_mon1',     icon:'⚔️', name:'첫 사냥',         desc:'첫 몬스터 처치',           check: s=>(s.monsterLog||[]).length>=1,  reward:{exp:20,gold:10,title:null,deco:null} },
  { id:'ach_mon5',     icon:'🗡️', name:'초보 헌터',       desc:'몬스터 5종 처치',          check: s=>(s.monsterLog||[]).length>=5,  reward:{exp:40,gold:20,title:null,deco:null} },
  { id:'ach_mon15',    icon:'⚔️', name:'숙련 헌터',       desc:'몬스터 15종 처치',         check: s=>(s.monsterLog||[]).length>=15, reward:{exp:70,gold:40,title:'헌터',deco:null} },
  { id:'ach_mon30',    icon:'🏹', name:'베테랑 헌터',     desc:'몬스터 30종 처치',         check: s=>(s.monsterLog||[]).length>=30, reward:{exp:100,gold:60,title:'베테랑 헌터',deco:null} },
  { id:'ach_mon60',    icon:'🔱', name:'전설의 헌터',     desc:'몬스터 60종 처치',         check: s=>(s.monsterLog||[]).length>=60, reward:{exp:150,gold:100,title:'전설의 헌터',deco:'deco_trophy'} },

  // 도감 — 초급 (30종)
  { id:'ach_dex_beg5',  icon:'🗺️', name:'초급 탐험 시작', desc:'초급 몬스터 5종 발견',    check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.zone==='beginner').map(m=>m.id);return (s.monsterLog||[]).filter(id=>ms.includes(id)).length>=5;},  reward:{exp:30,gold:20,title:null,deco:null} },
  { id:'ach_dex_beg15', icon:'📖', name:'초급 수집가',    desc:'초급 몬스터 15종 발견',   check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.zone==='beginner').map(m=>m.id);return (s.monsterLog||[]).filter(id=>ms.includes(id)).length>=15;}, reward:{exp:60,gold:40,title:null,deco:null} },
  { id:'ach_dex_beg30', icon:'🏆', name:'초급 도감 완성', desc:'초급 몬스터 30종 모두 발견',check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.zone==='beginner').map(m=>m.id);return ms.every(id=>(s.monsterLog||[]).includes(id));}, reward:{exp:100,gold:80,title:'초급 도감 마스터',deco:null} },

  // 도감 — 중급 (50종)
  { id:'ach_dex_mid10', icon:'🗺️', name:'중급 탐험 시작', desc:'중급 몬스터 10종 발견',   check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.zone==='intermediate').map(m=>m.id);return (s.monsterLog||[]).filter(id=>ms.includes(id)).length>=10;}, reward:{exp:50,gold:30,title:null,deco:null} },
  { id:'ach_dex_mid25', icon:'📖', name:'중급 수집가',    desc:'중급 몬스터 25종 발견',   check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.zone==='intermediate').map(m=>m.id);return (s.monsterLog||[]).filter(id=>ms.includes(id)).length>=25;}, reward:{exp:80,gold:60,title:null,deco:null} },
  { id:'ach_dex_mid50', icon:'🏆', name:'중급 도감 완성', desc:'중급 몬스터 50종 모두 발견',check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.zone==='intermediate').map(m=>m.id);return ms.every(id=>(s.monsterLog||[]).includes(id));}, reward:{exp:150,gold:100,title:'중급 도감 마스터',deco:'deco_trophy'} },

  // 도감 — 고급 (20종)
  { id:'ach_dex_adv5',  icon:'🗺️', name:'고급 탐험 시작', desc:'고급 몬스터 5종 발견',    check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.zone==='advanced').map(m=>m.id);return (s.monsterLog||[]).filter(id=>ms.includes(id)).length>=5;},  reward:{exp:60,gold:50,title:null,deco:null} },
  { id:'ach_dex_adv10', icon:'📖', name:'고급 수집가',    desc:'고급 몬스터 10종 발견',   check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.zone==='advanced').map(m=>m.id);return (s.monsterLog||[]).filter(id=>ms.includes(id)).length>=10;}, reward:{exp:100,gold:80,title:null,deco:null} },
  { id:'ach_dex_adv20', icon:'👑', name:'고급 도감 완성', desc:'고급 몬스터 20종 모두 발견',check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.zone==='advanced').map(m=>m.id);return ms.every(id=>(s.monsterLog||[]).includes(id));}, reward:{exp:200,gold:150,title:'고급 도감 마스터',deco:'deco_trophy'} },

  // 도감 — 전체
  { id:'ach_dex_25',   icon:'🔍', name:'도감 수집가',    desc:'전체 몬스터 25종 발견',    check: s=>(s.monsterLog||[]).length>=25,  reward:{exp:60,gold:40,title:null,deco:null} },
  { id:'ach_dex_50',   icon:'🗺️', name:'도감 탐험가',    desc:'전체 몬스터 50종 발견',    check: s=>(s.monsterLog||[]).length>=50,  reward:{exp:120,gold:80,title:'탐험가',deco:null} },
  { id:'ach_mon_all',  icon:'👑', name:'도감 완성자',    desc:'전체 몬스터 100종 모두 발견',check: s=>(s.monsterLog||[]).length>=GAME_DATA.monsters.length, reward:{exp:300,gold:200,title:'도감 마스터',deco:'deco_trophy'} },

  // 희귀도 업적 — common(42) / rare(62) / legend(21)
  { id:'ach_rar_com5',  icon:'🔵', name:'일반 몬스터 발견자', desc:'일반(common) 몬스터 5종', check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.rarity==='common').map(m=>m.id);return (s.monsterLog||[]).filter(id=>ms.includes(id)).length>=5;},  reward:{exp:20,gold:15,title:null,deco:null} },
  { id:'ach_rar_com20', icon:'🔵', name:'일반 수집가',        desc:'일반(common) 몬스터 20종',check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.rarity==='common').map(m=>m.id);return (s.monsterLog||[]).filter(id=>ms.includes(id)).length>=20;}, reward:{exp:50,gold:30,title:null,deco:null} },
  { id:'ach_rar_com42', icon:'🔵', name:'일반 도감 완성',     desc:'일반(common) 몬스터 전부',check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.rarity==='common').map(m=>m.id);return ms.every(id=>(s.monsterLog||[]).includes(id));}, reward:{exp:100,gold:60,title:null,deco:null} },
  { id:'ach_rar_rare3', icon:'🟣', name:'희귀 몬스터 발견자', desc:'희귀(rare) 몬스터 첫 발견',check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.rarity==='rare').map(m=>m.id);return (s.monsterLog||[]).some(id=>ms.includes(id));}, reward:{exp:40,gold:30,title:null,deco:null} },
  { id:'ach_rar_rare20',icon:'🟣', name:'희귀 수집가',        desc:'희귀(rare) 몬스터 20종', check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.rarity==='rare').map(m=>m.id);return (s.monsterLog||[]).filter(id=>ms.includes(id)).length>=20;}, reward:{exp:80,gold:60,title:null,deco:null} },
  { id:'ach_rar_leg1',  icon:'🌟', name:'전설의 발견자',      desc:'전설(legend) 몬스터 첫 발견',check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.rarity==='legend').map(m=>m.id);return (s.monsterLog||[]).some(id=>ms.includes(id));}, reward:{exp:80,gold:60,title:'전설 목격자',deco:null} },
  { id:'ach_rar_leg10', icon:'🌟', name:'전설 추적자',        desc:'전설(legend) 몬스터 10종',check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.rarity==='legend').map(m=>m.id);return (s.monsterLog||[]).filter(id=>ms.includes(id)).length>=10;}, reward:{exp:150,gold:100,title:'전설 추적자',deco:null} },
  { id:'ach_rar_leg21', icon:'💫', name:'전설 완성자',        desc:'전설(legend) 몬스터 전부',check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.rarity==='legend').map(m=>m.id);return ms.every(id=>(s.monsterLog||[]).includes(id));}, reward:{exp:250,gold:180,title:'전설의 사냥꾼',deco:'deco_trophy'} },

  // 속성 업적 (element: fire/water/grass)
  { id:'ach_el_fire',  icon:'🔥', name:'불꽃 탐험가',     desc:'불꽃 속성 몬스터 5종 이상', check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.element==='fire').map(m=>m.id);return (s.monsterLog||[]).filter(id=>ms.includes(id)).length>=5;}, reward:{exp:50,gold:30,title:null,deco:null} },
  { id:'ach_el_water', icon:'💧', name:'물결 탐험가',     desc:'물 속성 몬스터 5종 이상',   check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.element==='water').map(m=>m.id);return (s.monsterLog||[]).filter(id=>ms.includes(id)).length>=5;}, reward:{exp:50,gold:30,title:null,deco:null} },
  { id:'ach_el_grass', icon:'🌿', name:'숲의 탐험가',     desc:'풀 속성 몬스터 5종 이상',   check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.element==='grass').map(m=>m.id);return (s.monsterLog||[]).filter(id=>ms.includes(id)).length>=5;}, reward:{exp:50,gold:30,title:null,deco:null} },
  { id:'ach_el_all',   icon:'🌈', name:'속성 수집가',     desc:'모든 속성 몬스터 각 3종 이상',check: s=>{const ml=s.monsterLog||[];const mons=GAME_DATA.monsters;return ['fire','water','grass'].every(el=>ml.filter(id=>mons.find(m=>m.id===id&&m.element===el)).length>=3);}, reward:{exp:80,gold:60,title:'속성 마스터',deco:null} },

  // ══ C. 농장 ══════════════════════════════════════════════
  { id:'ach_farm1',    icon:'🌱', name:'씨앗의 시작',     desc:'첫 씨앗 심기',              check: s=>(s.farmHarvests||0)>=1,   reward:{exp:15,gold:10,title:null,deco:null} },
  { id:'ach_farm5',    icon:'🌿', name:'초보 농부',        desc:'농장 수확 5회',             check: s=>(s.farmHarvests||0)>=5,   reward:{exp:30,gold:20,title:null,deco:null} },
  { id:'ach_farm15',   icon:'🌾', name:'부지런한 농부',   desc:'농장 수확 15회',            check: s=>(s.farmHarvests||0)>=15,  reward:{exp:60,gold:40,title:null,deco:null} },
  { id:'ach_farm20',   icon:'🚜', name:'베테랑 농부',     desc:'농장 수확 20회',            check: s=>(s.farmHarvests||0)>=20,  reward:{exp:80,gold:60,title:'농부',deco:'deco_garden'} },
  { id:'ach_farm40',   icon:'🏡', name:'대농장주',        desc:'농장 수확 40회',            check: s=>(s.farmHarvests||0)>=40,  reward:{exp:120,gold:100,title:'대농장주',deco:null} },

  // ══ D. 장비 / 성장 ═══════════════════════════════════════
  { id:'ach_equip1',   icon:'🗡️', name:'첫 장착',         desc:'장비 1개 장착',             check: s=>Object.values(s.equipmentIds||{}).some(v=>v), reward:{exp:15,gold:10,title:null,deco:null} },
  { id:'ach_equip3',   icon:'⚔️', name:'장비 입문자',     desc:'장비 3개 슬롯 장착',        check: s=>Object.values(s.equipmentIds||{}).filter(v=>v).length>=3, reward:{exp:30,gold:20,title:null,deco:null} },
  { id:'ach_equip',    icon:'🛡️', name:'완전무장',         desc:'5개 슬롯 모두 장착',        check: s=>['head','body','weapon','glove','shoe'].every(k=>(s.equipmentIds||{})[k]), reward:{exp:50,gold:40,title:'전사',deco:null} },
  { id:'ach_equip_col',icon:'💎', name:'장비 수집가',     desc:'보관 장비 5종 이상',        check: s=>(s.inventory||[]).filter(i=>GAME_DATA.getItemById(i.id)).length>=5, reward:{exp:40,gold:30,title:null,deco:null} },
  { id:'ach_lv5',      icon:'⬆️', name:'첫 번째 도약',    desc:'레벨 5 달성',               check: s=>s.level>=5,  reward:{exp:30,gold:20,title:null,deco:null} },
  { id:'ach_lv10',     icon:'🌟', name:'숙련자',           desc:'레벨 10 달성',              check: s=>s.level>=10, reward:{exp:80,gold:50,title:'숙련자',deco:'deco_trophy'} },
  { id:'ach_lv20',     icon:'💫', name:'전설의 시작',     desc:'레벨 20 달성',              check: s=>s.level>=20, reward:{exp:150,gold:100,title:'전설',deco:null} },
  { id:'ach_lv30',     icon:'👑', name:'전설의 경지',     desc:'레벨 30 달성',              check: s=>s.level>=30, reward:{exp:250,gold:200,title:'전설의 모험가',deco:'deco_trophy'} },
  { id:'ach_gold1000', icon:'💰', name:'골드 모으기',     desc:'누적 골드 1000G 이상',      check: s=>(s.totalGold||s.gold||0)>=1000, reward:{exp:30,gold:0,title:null,deco:null} },
  { id:'ach_gold5000', icon:'💎', name:'부자 모험가',     desc:'누적 골드 5000G 이상',      check: s=>(s.totalGold||s.gold||0)>=5000, reward:{exp:80,gold:0,title:'부자',deco:null} },

  // ══ E. 독서 ══════════════════════════════════════════════
  { id:'ach_book1',    icon:'📖', name:'첫 독서',          desc:'책 1권 읽기',               check: s=>(s.bookCount||0)>=1,  reward:{exp:15,gold:10,title:null,deco:'deco_bookshelf'} },
  { id:'ach_book3',    icon:'📗', name:'독서왕 입문',      desc:'책 3권 읽기',               check: s=>(s.bookCount||0)>=3,  reward:{exp:30,gold:20,title:null,deco:null} },
  { id:'ach_book5',    icon:'📚', name:'꾸준한 독서가',   desc:'책 5권 읽기',               check: s=>(s.bookCount||0)>=5,  reward:{exp:50,gold:30,title:null,deco:null} },
  { id:'ach_book10',   icon:'📚', name:'생각하는 독자',   desc:'책 10권 읽기',              check: s=>(s.bookCount||0)>=10, reward:{exp:80,gold:60,title:'독서가',deco:null} },
  { id:'ach_book15',   icon:'🎓', name:'지식의 탑',        desc:'책 15권 읽기',              check: s=>(s.bookCount||0)>=15, reward:{exp:120,gold:80,title:'지식인',deco:null} },
  { id:'ach_book_char',icon:'🧑', name:'인물 탐험가',     desc:'인상 깊은 인물 기록 3회',   check: s=>(s.books||[]).filter(b=>b.characterName).length>=3, reward:{exp:30,gold:20,title:null,deco:null} },
  { id:'ach_book_rate',icon:'⭐', name:'별점 남기기',      desc:'독서 별점 5회 이상',        check: s=>(s.books||[]).filter(b=>b.rating>=1).length>=5, reward:{exp:20,gold:15,title:null,deco:null} },

  // ══ F. 작품 ══════════════════════════════════════════════
  { id:'ach_art1',     icon:'🎨', name:'첫 작품',          desc:'첫 작품 등록',              check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return (db.artworks||[]).filter(a=>a.studentId===s.id).length>=1;}, reward:{exp:20,gold:15,title:null,deco:null} },
  { id:'ach_art3',     icon:'🖼️', name:'창작의 시작',     desc:'작품 3개 등록',             check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return (db.artworks||[]).filter(a=>a.studentId===s.id).length>=3;}, reward:{exp:40,gold:25,title:null,deco:null} },
  { id:'ach_art7',     icon:'🖼️', name:'작은 전시회',     desc:'작품 7개 등록',             check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return (db.artworks||[]).filter(a=>a.studentId===s.id).length>=7;}, reward:{exp:70,gold:50,title:'예술가',deco:'deco_garden'} },
  { id:'ach_art15',    icon:'🏛️', name:'창작 수집가',     desc:'작품 15개 등록',            check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return (db.artworks||[]).filter(a=>a.studentId===s.id).length>=15;}, reward:{exp:120,gold:80,title:'창작가',deco:null} },
  { id:'ach_art_desc', icon:'✍️', name:'설명하는 작가',   desc:'작품 설명 3개 이상',        check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return (db.artworks||[]).filter(a=>a.studentId===s.id&&a.comment&&a.comment.length>5).length>=3;}, reward:{exp:25,gold:15,title:null,deco:null} },

  // ══ G. 추억 ══════════════════════════════════════════════
  { id:'ach_mem1',     icon:'📸', name:'첫 추억',          desc:'첫 추억 사진 등록',         check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return (db.memories||[]).filter(m=>m.studentId===s.id).length>=1;}, reward:{exp:20,gold:15,title:null,deco:null} },
  { id:'ach_mem5',     icon:'🗃️', name:'추억 수집가',     desc:'추억 5개 등록',             check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return (db.memories||[]).filter(m=>m.studentId===s.id).length>=5;}, reward:{exp:40,gold:30,title:null,deco:null} },
  { id:'ach_mem10',    icon:'📷', name:'우리 반 기록가',  desc:'추억 10개 등록',            check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return (db.memories||[]).filter(m=>m.studentId===s.id).length>=10;}, reward:{exp:70,gold:50,title:'기록가',deco:null} },
  { id:'ach_mem_desc', icon:'📝', name:'사진 설명가',     desc:'설명 있는 추억 3개 이상',   check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return (db.memories||[]).filter(m=>m.studentId===s.id&&m.desc&&m.desc.length>3).length>=3;}, reward:{exp:25,gold:15,title:null,deco:null} },
  { id:'ach_mem_pub',  icon:'🌐', name:'공개 추억 1호',   desc:'공개 추억 첫 등록',         check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return (db.memories||[]).filter(m=>m.studentId===s.id).some(m=>m.visibilityType==='class'||m.visibilityType==='public');}, reward:{exp:30,gold:20,title:null,deco:null} },

  // ══ H. 감정 / 주간 루틴 ══════════════════════════════════
  { id:'ach_emo1',     icon:'💭', name:'오늘의 마음',     desc:'첫 감정 기록',              check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return Object.values(db.emotionLogs||{}).filter(r=>r&&r.studentId===s.id).length>=1;}, reward:{exp:15,gold:10,title:null,deco:null} },
  { id:'ach_emo5',     icon:'💬', name:'마음 일기 시작', desc:'감정 기록 5회',             check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return Object.values(db.emotionLogs||{}).filter(r=>r&&r.studentId===s.id).length>=5;}, reward:{exp:30,gold:20,title:null,deco:null} },
  { id:'ach_emo15',    icon:'🌈', name:'감정 탐험가',     desc:'감정 기록 15회',            check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return Object.values(db.emotionLogs||{}).filter(r=>r&&r.studentId===s.id).length>=15;}, reward:{exp:60,gold:40,title:null,deco:null} },
  { id:'ach_week_mon', icon:'📅', name:'월요일 다짐 시작',desc:'첫 월요일 다짐 작성',       check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return (db.weeklyGoals||[]).some(g=>g.studentId===s.id);}, reward:{exp:20,gold:15,title:null,deco:null} },
  { id:'ach_week_fri', icon:'📅', name:'금요일 돌아보기 시작',desc:'첫 금요일 돌아보기',   check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return (db.weeklyReflections||[]).some(r=>r.studentId===s.id);}, reward:{exp:20,gold:15,title:null,deco:null} },
  { id:'ach_week_both',icon:'🗓️', name:'한 주 완성',     desc:'같은 주 월+금 모두 작성',   check: s=>{const db=typeof DB!=='undefined'?DB.load():{};const gs=new Set((db.weeklyGoals||[]).filter(g=>g.studentId===s.id).map(g=>g.weekKey));return (db.weeklyReflections||[]).some(r=>r.studentId===s.id&&gs.has(r.weekKey));}, reward:{exp:40,gold:30,title:null,deco:null} },
  { id:'ach_week_3',   icon:'📆', name:'3주 루틴',        desc:'3주 이상 다짐 작성',        check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return [...new Set((db.weeklyGoals||[]).filter(g=>g.studentId===s.id).map(g=>g.weekKey))].length>=3;}, reward:{exp:70,gold:50,title:'루틴러',deco:null} },

  // ══ I. 리코더 ════════════════════════════════════════════
  { id:'ach_rec1',     icon:'🎵', name:'첫 연습',          desc:'리코더 첫 연습 기록',       check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return (db.recorderLogs||[]).some(r=>r.studentId===s.id);}, reward:{exp:20,gold:15,title:null,deco:null} },
  { id:'ach_rec5',     icon:'🎶', name:'리듬의 시작',     desc:'리코더 연습 5회 이상',      check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return (db.recorderLogs||[]).filter(r=>r.studentId===s.id).length>=5;}, reward:{exp:40,gold:25,title:null,deco:null} },
  { id:'ach_rec_sound',icon:'🎙️', name:'첫 녹음',          desc:'녹음 파일 첫 업로드',       check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return (db.recorderLogs||[]).some(r=>r.studentId===s.id&&r.recordingUrl);}, reward:{exp:50,gold:35,title:null,deco:null} },
  { id:'ach_rec_song2',icon:'🎼', name:'곡 수집가',        desc:'2곡 이상 연습 기록',        check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return [...new Set((db.recorderLogs||[]).filter(r=>r.studentId===s.id).map(r=>r.songId))].length>=2;}, reward:{exp:40,gold:30,title:null,deco:null} },
  { id:'ach_rec_refl', icon:'💭', name:'성장의 귀',        desc:'느낀점 있는 연습 기록 3회', check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return (db.recorderLogs||[]).filter(r=>r.studentId===s.id&&r.reflection&&r.reflection.length>2).length>=3;}, reward:{exp:30,gold:20,title:null,deco:null} },

  // ══ J. 영어 단어장 ════════════════════════════════════════
  { id:'ach_voc1',     icon:'🔤', name:'오늘의 5문제',    desc:'첫 영어 퀴즈 완료',         check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return (db.quizRecords||[]).some(r=>r.studentId===s.id);}, reward:{exp:20,gold:15,title:null,deco:null} },
  { id:'ach_voc5',     icon:'📝', name:'영어 워밍업',     desc:'퀴즈 5회 완료',             check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return (db.quizRecords||[]).filter(r=>r.studentId===s.id).length>=5;}, reward:{exp:40,gold:25,title:null,deco:null} },
  { id:'ach_voc_perfect',icon:'⭐',name:'5문제 만점',    desc:'퀴즈 5개 전부 정답',        check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return (db.quizRecords||[]).some(r=>r.studentId===s.id&&r.correct===r.total);}, reward:{exp:50,gold:40,title:null,deco:null} },
  { id:'ach_voc_10',   icon:'🏅', name:'영어 발자국',     desc:'퀴즈 10회 완료',            check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return (db.quizRecords||[]).filter(r=>r.studentId===s.id).length>=10;}, reward:{exp:70,gold:50,title:'영어 친구',deco:null} },

  // ══ K. 집꾸미기 / 인테리어 ═══════════════════════════════
  { id:'ach_deco1',    icon:'🏠', name:'내 방 첫 꾸미기', desc:'장식품 첫 배치',            check: s=>(s.houseDecorations||[]).length>=1, reward:{exp:20,gold:15,title:null,deco:null} },
  { id:'ach_deco3',    icon:'🪴', name:'작은 변화',       desc:'장식품 3개 배치',           check: s=>(s.houseDecorations||[]).length>=3, reward:{exp:30,gold:20,title:null,deco:null} },
  // [WORDS-1] 아래 보상 칭호 '인테리어'는 화면 말을 '꾸미기'로 바꿀 때도 그대로 둔다.
  //   s.titles 는 문자열 배열로 저장되고(아래 checkNew) 이미 받은 학생 데이터에
  //   그 문자열이 들어 있다. 이름만 바꾸면 옛 칭호가 남은 채 새 칭호가 하나 더 붙는다.
  //   바꿀 거면 학생 데이터 마이그레이션이 같이 가야 한다.
  { id:'ach_deco7',    icon:'🎨', name:'분위기 만들기',   desc:'장식품 7개 배치',           check: s=>(s.houseDecorations||[]).length>=7, reward:{exp:60,gold:40,title:'인테리어',deco:null} },

  // ══ L. 메타 업적 ══════════════════════════════════════════
  { id:'ach_meta_balance', icon:'⚖️', name:'균형 잡힌 모험가', desc:'퀘스트+전투+독서 모두 달성', check: s=>(s.totalQuests||0)>=5&&(s.monsterLog||[]).length>=5&&(s.bookCount||0)>=3, reward:{exp:100,gold:80,title:'균형 모험가',deco:null} },
  { id:'ach_meta_record',  icon:'📒', name:'기록하는 사람',    desc:'독서+작품+추억 모두 달성',   check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return (s.bookCount||0)>=1&&(db.artworks||[]).filter(a=>a.studentId===s.id).length>=1&&(db.memories||[]).filter(m=>m.studentId===s.id).length>=1;}, reward:{exp:60,gold:40,title:'기록가',deco:null} },
  { id:'ach_meta_port',    icon:'💼', name:'내 기록 시작',  desc:'감정+주간다짐+독서 모두 달성',check: s=>{const db=typeof DB!=='undefined'?DB.load():{};return Object.values(db.emotionLogs||{}).filter(r=>r&&r.studentId===s.id).length>=1&&(s.bookCount||0)>=1&&(db.weeklyGoals||[]).some(g=>g.studentId===s.id);}, reward:{exp:80,gold:60,title:null,deco:null} },
  { id:'ach_meta_10ach',   icon:'🏅', name:'업적 수집가',      desc:'업적 10개 달성',             check: s=>(s.achievements||[]).length>=10, reward:{exp:80,gold:60,title:null,deco:null} },
  { id:'ach_meta_20ach',   icon:'🏆', name:'업적 마스터',      desc:'업적 20개 달성',             check: s=>(s.achievements||[]).length>=20, reward:{exp:150,gold:100,title:'업적 마스터',deco:'deco_trophy'} },
  { id:'ach_meta_all',     icon:'🌟', name:'만능 학생',         desc:'모든 카테고리 달성',          check: s=>{
    const db=typeof DB!=='undefined'?DB.load():{};
    return (s.totalQuests||0)>=1
      && (s.monsterLog||[]).length>=1
      && (s.farmHarvests||0)>=1
      && (s.bookCount||0)>=1
      && (db.artworks||[]).filter(a=>a.studentId===s.id).length>=1
      && (db.memories||[]).filter(m=>m.studentId===s.id).length>=1
      && Object.values(db.emotionLogs||{}).filter(r=>r&&r.studentId===s.id).length>=1
      && (db.weeklyGoals||[]).some(g=>g.studentId===s.id);
  }, reward:{exp:300,gold:200,title:'만능 학생',deco:'deco_trophy'} },
];


const AchievementUtils = {
  // 학생의 새 업적 체크 → 새로 달성한 업적 배열 반환 (소급 포함)
  checkNew(student) {
    const earned = new Set(student.achievements || []);
    const newOnes = [];
    ACHIEVEMENTS.forEach(a => {
      if (!earned.has(a.id)) {
        try { if (a.check(student)) { earned.add(a.id); newOnes.push(a); } }
        catch(e) { /* 조건 오류 무시 */ }
      }
    });
    if (newOnes.length > 0) {
      student.achievements = [...earned];
      newOnes.forEach(a => {
        student.exp  = (student.exp||0)  + (a.reward.exp||0);
        student.gold = (student.gold||0) + (a.reward.gold||20);
        student.totalGold = (student.totalGold||0) + (a.reward.gold||20);
        if (a.reward.title && !(student.titles||[]).includes(a.reward.title)) {
          student.titles = [...(student.titles||[]), a.reward.title];
          if (!student.title) student.title = a.reward.title;
        }
        if (a.reward.deco) {
          student.inventory = student.inventory || [];
          const ex = student.inventory.find(i => i.id === a.reward.deco);
          if (ex) ex.qty++; else student.inventory.push({ id: a.reward.deco, qty: 1 });
        }
      });
      student.level = Utils.levelFromExp(student.exp);
    }
    return newOnes;
  },

  // 전체 학생 업적 일괄 재계산 (관리자용)
  recalcAll(onProgress) {
    if (typeof DB === 'undefined') return;
    const students = DB.getStudents();
    let done = 0;
    students.forEach(s => {
      const newOnes = this.checkNew(s);
      DB.saveStudent(s);
      done++;
      if (onProgress) onProgress(done, students.length, s.name, newOnes.length);
    });
    return done;
  },

  // 업적 진행도 (0~1)
  progress(student, ach) {
    try { return ach.check(student) ? 1 : 0; } catch(e) { return 0; }
  },

  // 카테고리별 업적 분류
  categories: {
    '퀘스트':   ['ach_quest1','ach_quest5','ach_quest10','ach_quest30','ach_quest50','ach_quest_approv'],
    '전투/도감': ['ach_mon1','ach_mon5','ach_mon15','ach_mon30','ach_mon60','ach_dex_beg5','ach_dex_beg15','ach_dex_beg30','ach_dex_mid10','ach_dex_mid25','ach_dex_mid50','ach_dex_adv5','ach_dex_adv10','ach_dex_adv20','ach_dex_25','ach_dex_50','ach_mon_all','ach_rar_com5','ach_rar_com20','ach_rar_com42','ach_rar_rare3','ach_rar_rare20','ach_rar_leg1','ach_rar_leg10','ach_rar_leg21','ach_el_fire','ach_el_water','ach_el_grass','ach_el_all'],
    '농장':      ['ach_farm1','ach_farm5','ach_farm15','ach_farm20','ach_farm40'],
    '장비/성장': ['ach_equip1','ach_equip3','ach_equip','ach_equip_col','ach_lv5','ach_lv10','ach_lv20','ach_lv30','ach_gold1000','ach_gold5000'],
    '독서':      ['ach_book1','ach_book3','ach_book5','ach_book10','ach_book15','ach_book_char','ach_book_rate'],
    '작품':      ['ach_art1','ach_art3','ach_art7','ach_art15','ach_art_desc'],
    '추억':      ['ach_mem1','ach_mem5','ach_mem10','ach_mem_desc','ach_mem_pub'],
    '감정/주간': ['ach_emo1','ach_emo5','ach_emo15','ach_week_mon','ach_week_fri','ach_week_both','ach_week_3'],
    '리코더':    ['ach_rec1','ach_rec5','ach_rec_sound','ach_rec_song2','ach_rec_refl'],
    '영어단어':  ['ach_voc1','ach_voc5','ach_voc_perfect','ach_voc_10'],
    '집꾸미기':  ['ach_deco1','ach_deco3','ach_deco7'],
    '메타':      ['ach_meta_balance','ach_meta_record','ach_meta_port','ach_meta_10ach','ach_meta_20ach','ach_meta_all'],
  },
};

// ── 과목 목록 ────────────────────────────────────────
// DEFAULT_SUBJECTS는 각 HTML 파일에서 선언

function getActiveSubjects(db) {
  const d = db || (typeof DB !== 'undefined' ? DB.load() : {});
  const s = d.activeSubjects;
  if (!s) return (typeof DEFAULT_SUBJECTS !== 'undefined' ? DEFAULT_SUBJECTS : ['국어','수학','사회','과학','음악','미술','체육','영어','창체']);
  return s;
}

// ── 커스텀 몬스터 포함 전체 목록 ──────────────────────────
function getActiveMonsters(db) {
  const d = db || (typeof DB !== 'undefined' ? DB.load() : {});
  const customs = d.customMonsters || {};
  const base = GAME_DATA.monsters.map(m => {
    const ov = customs[m.id];
    return ov ? { ...m, ...ov } : m;
  });
  const added = Object.values(customs).filter(c => c && c._new);
  return [...base, ...added].sort((a,b) => (a.recLv||0)-(b.recLv||0));
}

// ── 상점 오버라이드 ────────────────────────────────────────
// DB settings.shopOverrides 값으로 GAME_DATA 실제 값을 패치
// 관리자/학생/키오스크 모두 동일한 GAME_DATA를 읽으므로 자동 반영
function applyShopOverrides(db) {
  const d = db || (typeof DB !== 'undefined' ? DB.load() : {});
  const ov = (d.settings || {}).shopOverrides || {};

  // 씨앗
  if (ov.seeds) {
    GAME_DATA.seeds.forEach(s => {
      const patch = ov.seeds[s.id];
      if (!patch) return;
      if (patch.price     !== undefined) s.price     = patch.price;
      if (patch.sellPrice !== undefined) s.sellPrice = patch.sellPrice;
      if (patch.growHours !== undefined) s.growHours = patch.growHours;
    });
  }

  // 장비 (전 슬롯)
  if (ov.equipment) {
    Object.values(GAME_DATA.equipment).forEach(slot => {
      slot.forEach(item => {
        const patch = ov.equipment[item.id];
        if (!patch) return;
        if (patch.price !== undefined) item.price = patch.price;
        if (patch.lv    !== undefined) item.lv    = patch.lv;
        if (patch.stats) Object.assign(item.stats, patch.stats);
      });
    });
  }

  // 장식
  if (ov.decorations) {
    GAME_DATA.decorations.forEach(d => {
      const patch = ov.decorations[d.id];
      if (!patch) return;
      if (patch.price !== undefined) d.price = patch.price;
    });
  }
}

// ── 전투 밸런스 설정 오버라이드 적용 ──────────────────────────────
// DB settings.customBattleSettings 값으로 전투 관련 상수를 패치
// applyShopOverrides()와 동일한 패턴 — DB.init() 후 및 onDataChange() 때 호출
//
// ★ 장비 원본 데이터 백업 (첫 호출 시 1회만 실행)
// 이유: applyBattleSettings는 onDataChange마다 반복 호출됨.
//       패치를 누적하지 않으려면 매번 "원본→패치" 순서로 적용해야 함.
let _EQUIP_ORIGINALS = null;
function _backupEquipOrigins() {
  if (_EQUIP_ORIGINALS) return; // 이미 백업됨
  _EQUIP_ORIGINALS = {};
  Object.entries(GAME_DATA.equipment).forEach(([slot, items]) => {
    items.forEach(item => {
      _EQUIP_ORIGINALS[item.id] = {
        price:   item.price,
        lv:      item.lv,
        name:    item.name,
        stats:   { ...item.stats },
        cond:    { ...(item.cond || {}) },
        element: item.element,
      };
    });
  });
}

function applyBattleSettings(db) {
  const d = db || (typeof DB !== 'undefined' ? DB.load() : {});
  const bs = (d.settings || {}).customBattleSettings || {};

  // 1. 노말 스킬 계수 오버라이드
  if (bs.normalMults) {
    Object.assign(SKILL_MULTIPLIERS.normal, bs.normalMults);
  }
  // 2. 속성 스킬 계수 오버라이드
  if (bs.elementMults) {
    Object.assign(SKILL_MULTIPLIERS.element, bs.elementMults);
  }
  // 3. 공격 상성 배율 오버라이드
  if (bs.elemChart) {
    if (bs.elemChart.advantageMult !== undefined) {
      ['water','fire','grass'].forEach(atk => {
        ['fire','grass','water'].forEach(target => {
          if (ELEMENT_CHART[atk] && ELEMENT_CHART[atk][target] !== undefined
              && ELEMENT_CHART[atk][target] > 1.0) {
            ELEMENT_CHART[atk][target] = bs.elemChart.advantageMult;
          }
          if (ELEMENT_CHART[atk] && ELEMENT_CHART[atk][target] !== undefined
              && ELEMENT_CHART[atk][target] < 1.0) {
            ELEMENT_CHART[atk][target] = bs.elemChart.disadvantageMult || BALANCE.settingsDefaults.elemDisadvantageFallback;
          }
        });
      });
    }
  }
  // 4. 유령형 노말 감소 배율
  if (bs.ghostNormalMult !== undefined) {
    BATTLE_CONSTS.ghostNormalMult = bs.ghostNormalMult;
  }
  // 4-b. 하루 전투 횟수 오버라이드
  if (bs.dailyBattleLimit !== undefined) {
    BATTLE_CONSTS.dailyBattleLimit = bs.dailyBattleLimit;
  }
  // 4-b2. 무한배틀 하루 횟수 오버라이드 (관리자 저장값이 실제로 읽히도록 — 밸런스 감사 B2)
  if (Number.isFinite(bs.infiniteBattleLimit)) { // 숫자일 때만 (NaN/문자 방어 — NaN이면 횟수 비교가 항상 false=무제한이 됨)
    BATTLE_CONSTS.infiniteBattleLimit = bs.infiniteBattleLimit;
  }
  // 4-c. 몬스터 HP/공격력 배율 (난이도 조절)
  BATTLE_CONSTS.monsterHpMult  = (bs.monsterHpMult  !== undefined) ? bs.monsterHpMult  : BALANCE.settingsDefaults.monsterHpMult;
  BATTLE_CONSTS.monsterAtkMult = (bs.monsterAtkMult !== undefined) ? bs.monsterAtkMult : BALANCE.settingsDefaults.monsterAtkMult;
  // 4-d. 몸통 방어 상성 배율 (관리자 defChart — 저장만 되고 안 읽히던 값, 밸런스 감사 B2)
  BATTLE_CONSTS.defAdvMult = (bs.defChart && bs.defChart.advantageMult    !== undefined) ? bs.defChart.advantageMult    : BALANCE.settingsDefaults.defAdvMult;
  BATTLE_CONSTS.defDisMult = (bs.defChart && bs.defChart.disadvantageMult !== undefined) ? bs.defChart.disadvantageMult : BALANCE.settingsDefaults.defDisMult;
  // 5. 장비 오버라이드 ─────────────────────────────────────────
  // ★ 핵심: 매 호출마다 원본 복원 후 패치 적용 (누적 방지)
  _backupEquipOrigins(); // 최초 1회만 실행됨
  const eq = bs.equipment || {};
  Object.values(GAME_DATA.equipment).forEach(slot => {
    slot.forEach(item => {
      const orig  = _EQUIP_ORIGINALS[item.id];
      if (!orig) return;

      // 1단계: 원본 복원 (이전 패치 제거)
      item.price   = orig.price;
      item.lv      = orig.lv;
      item.name    = orig.name;
      item.stats   = { ...orig.stats };
      item.cond    = { ...orig.cond };
      item.element = orig.element;

      // 2단계: 커스텀 패치 적용 (있을 때만)
      const patch = eq[item.id];
      if (!patch) return;
      if (patch.price   !== undefined) item.price = patch.price;
      if (patch.lv      !== undefined) item.lv    = patch.lv;
      if (patch.name    !== undefined) item.name  = patch.name;
      if (patch.stats   && Object.keys(patch.stats).length)  Object.assign(item.stats, patch.stats);
      // cond: patch.cond가 있으면 완전 교체 (0값 포함하여 원본 cond 무시)
      if (patch.cond !== undefined) item.cond = { ...patch.cond };
      if (patch.element !== undefined) item.element = patch.element || undefined;
    });
  });
  // SLOT_MAP 캐시 무효화 (body 30개 추가로 슬롯맵 갱신 필요할 수 있음)
  GAME_DATA._slotMap = null;

  // 6. 스킬북 오버라이드
  const sbOv = bs.skillBooks || {};
  SKILL_BOOKS.forEach(book => {
    const patch = sbOv[book.id];
    if (!patch) return;
    if (patch.price           !== undefined) book.price = patch.price;
    if (patch.reqPlayerLevel  !== undefined) book.reqPlayerLevel = patch.reqPlayerLevel;
    if (patch.desc            !== undefined) book.desc = patch.desc;
  });
}

// 전투 관련 런타임 상수 (applyBattleSettings에서 패치 가능) — 초기값은 BALANCE.settingsDefaults
const BATTLE_CONSTS = {
  ghostNormalMult:     BALANCE.settingsDefaults.ghostNormalMult,     // 유령형 노말 배율
  dailyBattleLimit:    BALANCE.settingsDefaults.dailyBattleLimit,    // 하루 전투 횟수
  infiniteBattleLimit: BALANCE.settingsDefaults.infiniteBattleLimit, // 무한배틀 하루 횟수
  monsterHpMult:       BALANCE.settingsDefaults.monsterHpMult,       // 몬스터 HP 배율 (난이도 조절)
  monsterAtkMult:      BALANCE.settingsDefaults.monsterAtkMult,      // 몬스터 공격력 배율 (난이도 조절)
  defAdvMult:          BALANCE.settingsDefaults.defAdvMult,          // 몸통 방어 상성 유리 (받는 피해 배율)
  defDisMult:          BALANCE.settingsDefaults.defDisMult,          // 몸통 방어 상성 불리
};

// ══════════════════════════════════════════════════
//  EMOTION SYSTEM — 오늘의 감정
// ══════════════════════════════════════════════════

const EMOTION_DATA = [
  // 긍정 (positive)
  { key:'happy',      label:'행복하다',   group:'positive', icon:'😄' },
  { key:'excited',    label:'신나다',     group:'positive', icon:'🤩' },
  { key:'joyful',     label:'즐겁다',     group:'positive', icon:'😊' },
  { key:'thrilled',   label:'설레다',     group:'positive', icon:'🥰' },
  { key:'fun',        label:'재미있다',   group:'positive', icon:'😆' },
  { key:'calm',       label:'편안하다',   group:'positive', icon:'😌' },
  { key:'glad',       label:'기쁘다',     group:'positive', icon:'😁' },
  { key:'proud',      label:'뿌듯하다',   group:'positive', icon:'🥳' },
  { key:'satisfied',  label:'만족하다',   group:'positive', icon:'😀' },
  // 보통 (neutral)
  { key:'lonely',     label:'외롭다',     group:'neutral',  icon:'😶' },
  { key:'flustered',  label:'당황하다',   group:'neutral',  icon:'😳' },
  { key:'sorry',      label:'미안하다',   group:'neutral',  icon:'😔' },
  { key:'shameful',   label:'창피하다',   group:'neutral',  icon:'😳' },
  { key:'shy',        label:'부끄럽다',   group:'neutral',  icon:'😊' },
  { key:'surprised',  label:'놀라다',     group:'neutral',  icon:'😲' },
  { key:'annoyed',    label:'알밉다',     group:'neutral',  icon:'😒' },
  // 부정 (negative)
  { key:'scared',     label:'무섭다',     group:'negative', icon:'😨' },
  { key:'sad',        label:'슬프다',     group:'negative', icon:'😢' },
  { key:'irritated',  label:'짜증나다',   group:'negative', icon:'😤' },
  { key:'angry',      label:'화나다',     group:'negative', icon:'😠' },
  { key:'unfair',     label:'억울하다',   group:'negative', icon:'😤' },
  { key:'frustrated', label:'답답하다',   group:'negative', icon:'😩' },
  { key:'worried',    label:'걱정되다',   group:'negative', icon:'😟' },
  { key:'jealous',    label:'샘나다',     group:'negative', icon:'😒' },
  { key:'disappointed',label:'실망하다',  group:'negative', icon:'😞' },
  { key:'tearful',    label:'울고싶다',   group:'negative', icon:'😭' },
  { key:'upset',      label:'속상하다',   group:'negative', icon:'😣' },
  { key:'depressed',  label:'우울하다',   group:'negative', icon:'😔' },
  { key:'hurt',       label:'서운하다',   group:'negative', icon:'🥺' },
  { key:'anxious',    label:'불안하다',   group:'negative', icon:'😰' },
  { key:'gloomy',     label:'쓸쓸하다',   group:'negative', icon:'😕' },
  { key:'nervous',    label:'신경질나다', group:'negative', icon:'😡' },
  { key:'regretful',  label:'아쉽다',     group:'negative', icon:'😣' },
  { key:'vexed',      label:'약오르다',   group:'negative', icon:'😤' },
  { key:'remorseful', label:'후회되다',   group:'negative', icon:'😞' },
];

const EMOTION_LEVEL = [
  { value:1, label:'조금' },
  { value:2, label:'보통' },
  { value:3, label:'많이' },
];

const EMOTION_GROUP_VALUE = { positive:1, neutral:0, negative:-1 };

// score = groupValue × level
function calcEmotionScore(emotionKey, level) {
  const e = EMOTION_DATA.find(x => x.key === emotionKey);
  if (!e) return 0;
  return EMOTION_GROUP_VALUE[e.group] * level;
}

// ── DB 감정 함수 ──────────────────────────────────
// key 고정 구조: studentId_date_period → 중복 불가
const DB_EMOTION = {
  _ref(db) {
    return (typeof DB !== 'undefined' ? DB._fbRef : null);
  },

  // 저장 (있으면 덮어쓰기)
  save(studentId, date, period, emotionKey, level, reason) {
    const key = `${studentId}_${date}_${period}`;
    const e = EMOTION_DATA.find(x => x.key === emotionKey);
    if (!e) return;
    const record = {
      id:           key,
      studentId,
      date,
      period,           // 'am' | 'pm'
      emotionKey,
      emotionLabel:  e.label,
      emotionIcon:   e.icon,
      group:         e.group,
      level,            // 1~3
      levelLabel:    EMOTION_LEVEL.find(x=>x.value===level)?.label || '',
      score:         calcEmotionScore(emotionKey, level),
      reason:        reason || '',
      updatedAt:     Date.now(),
    };
    // 캐시 갱신
    const db = (typeof DB !== 'undefined') ? DB.load() : {};
    db.emotionLogs = db.emotionLogs || {};
    db.emotionLogs[key] = record;
    if (typeof DB !== 'undefined') {
      DB._cache = db;
      DB._fbRef.child('emotionLogs/' + key).set(record);
    }
    return record;
  },

  // 단건 조회
  get(studentId, date, period) {
    const key = `${studentId}_${date}_${period}`;
    const db = (typeof DB !== 'undefined') ? DB.load() : {};
    return (db.emotionLogs || {})[key] || null;
  },

  // 날짜별 전체 조회
  getByDate(date) {
    const db = (typeof DB !== 'undefined') ? DB.load() : {};
    if (typeof DB !== 'undefined' && DB._snaps) console.warn('[STUDENT-COLD-1] 학생 기기 캐시엔 내 감정 기록만 있음 — getByDate 는 교사·키오스크용');   // G6
    return Object.values(db.emotionLogs || {}).filter(r => r && r.date === date);
  },

  // 학생별 전체 조회
  getByStudent(studentId) {
    const db = (typeof DB !== 'undefined') ? DB.load() : {};
    return Object.values(db.emotionLogs || {})
      .filter(r => r && r.studentId === studentId)
      .sort((a,b) => a.date.localeCompare(b.date));
  },

  // 주간 요약 (보상 계산용)
  getWeeklySummary(studentId, weekStart) {
    const records = this.getByStudent(studentId)
      .filter(r => r.date >= weekStart);
    return {
      total:      records.length,
      amCount:    records.filter(r => r.period==='am').length,
      pmCount:    records.filter(r => r.period==='pm').length,
      reasonCount:records.filter(r => r.reason && r.reason !== '없음').length,
      avgScore:   records.length ? (records.reduce((s,r)=>s+r.score,0)/records.length).toFixed(2) : 0,
    };
  },
};

// ── 감정 보상 기준 ──────────────────────────────────
const EMOTION_REWARDS = [
  {
    id:       'emo_participate',
    label:    '💭 감정 참여 보상',
    desc:     '이번 주 감정 4회 이상 기록',
    condition:(summary) => summary.total >= 4,
    exp:      20,
    gold:     15,
  },
  {
    id:       'emo_steady',
    label:    '💪 꾸준한 감정 기록',
    desc:     '이번 주 감정 8회 이상 기록',
    condition:(summary) => summary.total >= 8,
    exp:      50,
    gold:     40,
  },
  {
    id:       'emo_reflect',
    label:    '🤔 성찰 보상',
    desc:     '이번 주 이유 3회 이상 입력',
    condition:(summary) => summary.reasonCount >= 3,
    exp:      30,
    gold:     20,
  },
];

// 이번 주에 수령 가능한 감정 보상 목록 반환
function getClaimableEmotionRewards(student, weekStart) {
  const db = (typeof DB !== 'undefined' ? DB.load() : {});
  const cfg = ((db.settings || {}).emotionRewards || {});
  // 감정 보상 기능 꺼져있으면 빈 배열
  if (cfg.enabled === false) return [];
  const summary = DB_EMOTION.getWeeklySummary(student.id, weekStart);
  const claimed  = (student.emotionRewardsClaimed || {})[weekStart] || [];
  const thresholds = {
    emo_participate: cfg.participate || 4,
    emo_steady:      cfg.steady      || 8,
    emo_reflect:     cfg.reflect     || 3,
  };
  const rewards = {
    emo_participate: { exp: cfg.participateExp  || 20, gold: cfg.participateGold || 15 },
    emo_steady:      { exp: cfg.steadyExp       || 50, gold: cfg.steadyGold      || 40 },
    emo_reflect:     { exp: cfg.reflectExp      || 30, gold: cfg.reflectGold     || 20 },
  };
  return EMOTION_REWARDS.filter(r => {
    if (claimed.includes(r.id)) return false;
    if (r.id === 'emo_participate') return summary.total >= thresholds.emo_participate;
    if (r.id === 'emo_steady')      return summary.total >= thresholds.emo_steady;
    if (r.id === 'emo_reflect')     return summary.reasonCount >= thresholds.emo_reflect;
    return r.condition(summary);
  }).map(r => {
    const thresh = thresholds[r.id];
    const rwd    = rewards[r.id] || { exp: r.exp, gold: r.gold };
    let desc = r.desc;
    if (r.id === 'emo_participate') desc = `이번 주 감정 ${thresh}회 이상 기록`;
    if (r.id === 'emo_steady')      desc = `이번 주 감정 ${thresh}회 이상 기록`;
    if (r.id === 'emo_reflect')     desc = `이번 주 이유 ${thresh}회 이상 입력`;
    return { ...r, desc, exp: rwd.exp, gold: rwd.gold, summary };
  });
}


// ══════════════════════════════════════════════════
//  EMOTION REFLECTION (감정 돌아보기 팝업)
// ══════════════════════════════════════════════════

const EMOTION_PAST_TEXT = {
  "무섭다":"무서웠다고","슬프다":"슬펐다고","외롭다":"외로웠다고",
  "짜증나다":"짜증났다고","화나다":"화가 났다고","신나다":"신났다고",
  "행복하다":"행복했다고","당황하다":"당황했다고","미안하다":"미안했다고",
  "창피하다":"창피했다고","억울하다":"억울했다고","즐겁다":"즐거웠다고",
  "답답하다":"답답했다고","걱정되다":"걱정됐다고","설레다":"설렜다고",
  "샘나다":"샘이 났다고","실망하다":"실망했다고","울고싶다":"울고 싶었다고",
  "부끄럽다":"부끄러웠다고","재미있다":"재미있었다고","편안하다":"편안했다고",
  "기쁘다":"기뻤다고","알밉다":"밉게 느껴졌다고","속상하다":"속상했다고",
  "뿌듯하다":"뿌듯했다고","우울하다":"우울했다고","서운하다":"서운했다고",
  "만족하다":"만족스러웠다고","불안하다":"불안했다고","놀라다":"놀랐다고",
  "쓸쓸하다":"쓸쓸했다고","신경질나다":"신경질이 났다고","아쉽다":"아쉬웠다고",
  "약오르다":"약이 올랐다고","후회되다":"후회됐다고",
};

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

// ═══════════════════════════════════════════════════════
//  감정 시스템
function getReflectionCandidate(studentId) {
  const db = (typeof DB !== 'undefined') ? DB.load() : {};
  const logs = db.emotionLogs || {};
  const today = (typeof Utils !== 'undefined') ? Utils.todayStr()
    : new Date(Date.now()+9*3600000).toISOString().slice(0,10);

  // 2~7일 사이 기록 (오늘 제외)
  const candidates = Object.values(logs).filter(r => {
    if (!r || r.studentId !== studentId) return false;
    if (r.date === today) return false;
    const diff = (new Date(today) - new Date(r.date)) / 86400000;
    return diff >= 1 && diff <= 7;
  });
  if (!candidates.length) return null;

  // 이미 사용한 기록 제외
  const reflections = db.emotionReflections || {};
  const usedIds = new Set(
    Object.values(reflections)
      .filter(r => r && r.studentId === studentId)
      .map(r => r.promptSourceId)
  );

  // 부정 감정 우선, 이유 있는 것 우선
  const available = candidates.filter(r => !usedIds.has(r.id));
  if (!available.length) return null;

  available.sort((a, b) => {
    const gScore = {negative:2, neutral:1, positive:0};
    const gs = (gScore[b.group]||0) - (gScore[a.group]||0);
    if (gs !== 0) return gs;
    const hasReasonA = a.reason && a.reason !== '없음' ? 1 : 0;
    const hasReasonB = b.reason && b.reason !== '없음' ? 1 : 0;
    return hasReasonB - hasReasonA;
  });

  return available[0];
}

// 팝업 노출 가능 여부 체크
function canShowReflectionPopup(studentId) {
  const db = (typeof DB !== 'undefined') ? DB.load() : {};
  const today = (typeof Utils !== 'undefined') ? Utils.todayStr()
    : new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  const weekStart = (typeof Utils !== 'undefined') ? Utils.weekStartStr()
    : today.slice(0,8)+'01';

  const stats = (db.emotionPromptStats || {})[studentId] || {};

  // 오늘 이미 했으면 금지
  if (stats.lastShownDate === today) return false;
  // 이번 주 2회 이상이면 금지
  if ((stats.weekCount || {})[weekStart] >= 2) return false;
  // 감정 기록 3개 이상이어야
  const logCount = Object.values(db.emotionLogs || {})
    .filter(r => r && r.studentId === studentId).length;
  if (logCount < 3) return false;

  return true;
}

// 팝업 통계 업데이트
function updateReflectionStats(studentId, type) {
  const db = (typeof DB !== 'undefined') ? DB.load() : {};
  const today = (typeof Utils !== 'undefined') ? Utils.todayStr()
    : new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  const weekStart = (typeof Utils !== 'undefined') ? Utils.weekStartStr()
    : today.slice(0,8)+'01';

  db.emotionPromptStats = db.emotionPromptStats || {};
  db.emotionPromptStats[studentId] = db.emotionPromptStats[studentId] || {};
  const stats = db.emotionPromptStats[studentId];

  if (type !== 'later') {
    stats.lastShownDate = today;
    stats.weekCount = stats.weekCount || {};
    stats.weekCount[weekStart] = (stats.weekCount[weekStart] || 0) + 1;
  } else {
    stats.lastShownDate = today; // later도 오늘은 재노출 금지
  }

  if (typeof DB !== 'undefined') {
    DB._cache = db;
    DB._fbRef.child('emotionPromptStats/' + studentId).set(stats);
  }
}

// Reflection 저장
function saveEmotionReflection(studentId, candidate, responseType, responseText, teacherRequest) {
  const db = (typeof DB !== 'undefined') ? DB.load() : {};
  const today = (typeof Utils !== 'undefined') ? Utils.todayStr()
    : new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  const weekStart = (typeof Utils !== 'undefined') ? Utils.weekStartStr()
    : today.slice(0,8)+'01';
  const key = `${studentId}_${today}_${Date.now()}`;

  const record = {
    id: key,
    studentId,
    promptSourceId:    candidate.id,
    promptDate:        candidate.date,
    promptPeriod:      candidate.period,
    promptEmotionKey:  candidate.emotionKey,
    promptEmotionLabel:candidate.emotionLabel,
    promptEmotionGroup:candidate.group,
    promptEmotionScore:candidate.score,
    promptReason:      candidate.reason || '',
    responseType,
    responseText:      responseText || '',
    teacherRequest:    !!teacherRequest,
    createdAt:         Date.now(),
    weekKey:           weekStart,
  };

  if (typeof DB !== 'undefined') {
    db.emotionReflections = db.emotionReflections || {};
    db.emotionReflections[key] = record;
    DB._cache = db;
    DB._fbRef.child('emotionReflections/' + key).set(record);

    // 관리자 알림
    if (teacherRequest) {
      const student = DB.getStudent(studentId);
      DB._fbRef.child('emotionAlerts/' + key).set({
        ...record,
        studentName: student?.name || '',
        studentAvatar: student?.avatar || '',
        read: false,
      });
    }
  }
  return record;
}

