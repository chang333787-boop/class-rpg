// ====================================================
//  우리반 성장 RPG — 공유 게임 데이터 v3 (gamedata.js)
//  ★ 밸런스 v2: 인성→가치, EXP/골드/농장 전면 조정
// ====================================================

const GAME_DATA = {

  // ─── EXP 레벨 테이블 (밸런스 조정: 초반 빠르게, 후반 완만하게) ───
  // 하루 퀘스트 2~3개(각 30~50EXP) 기준 → 초반 매일 레벨업, Lv10+ 3~5일에 1번
  // expTable[i] = Lv(i+1)이 되기 위한 누적 EXP
  expTable: [
      0,  100,  240,  440,  700, 1020, 1400, 1840, 2340, 2900,  // Lv 1~10
   3520, 4220, 5020, 5920, 6920, 8020, 9220,10520,11920,13420,  // Lv11~20
  15020,16720,18520,20420,22420,24520,26720,29020,31420,34000,37000 // Lv21~31
  ],

  // ─── 초기 학생 데이터 (가치 스탯, 새 EXP 기준) ──────────────
  defaultStudents: [
    { id:'s1', name:'학생1', avatar:'👦', pw:'1234', charType:1, dream:'미래를 꿈꾸는 학생', job:'학생',
      level:1, exp:0, gold:0, title:'', titles:[],
      stats:{read:0,study:0,art:0,value:0,health:0}, combat:{atk:0,def:0,mag:0,spd:0},
      equipment:{}, equipmentIds:{}, inventory:[], farm:[], books:[],
      monsterLog:[], monsterDailyCount:0, lastMonsterDate:'', totalQuests:0, bookCount:0,
      pendingRewards:[], promotionPending:false, houseDecorations:[], yardFloor:{}, lastAttendDate:'', achievements:[]
    },
    { id:'s2', name:'학생2', avatar:'👧', pw:'1234', charType:2, dream:'미래를 꿈꾸는 학생', job:'학생',
      level:1, exp:0, gold:0, title:'', titles:[],
      stats:{read:0,study:0,art:0,value:0,health:0}, combat:{atk:0,def:0,mag:0,spd:0},
      equipment:{}, equipmentIds:{}, inventory:[], farm:[], books:[],
      monsterLog:[], monsterDailyCount:0, lastMonsterDate:'', totalQuests:0, bookCount:0,
      pendingRewards:[], promotionPending:false, houseDecorations:[], yardFloor:{}, lastAttendDate:'', achievements:[]
    },
    { id:'s3', name:'학생3', avatar:'👦', pw:'1234', charType:1, dream:'미래를 꿈꾸는 학생', job:'학생',
      level:1, exp:0, gold:0, title:'', titles:[],
      stats:{read:0,study:0,art:0,value:0,health:0}, combat:{atk:0,def:0,mag:0,spd:0},
      equipment:{}, equipmentIds:{}, inventory:[], farm:[], books:[],
      monsterLog:[], monsterDailyCount:0, lastMonsterDate:'', totalQuests:0, bookCount:0,
      pendingRewards:[], promotionPending:false, houseDecorations:[], yardFloor:{}, lastAttendDate:'', achievements:[]
    },
    { id:'s4', name:'학생4', avatar:'👧', pw:'1234', charType:2, dream:'미래를 꿈꾸는 학생', job:'학생',
      level:1, exp:0, gold:0, title:'', titles:[],
      stats:{read:0,study:0,art:0,value:0,health:0}, combat:{atk:0,def:0,mag:0,spd:0},
      equipment:{}, equipmentIds:{}, inventory:[], farm:[], books:[],
      monsterLog:[], monsterDailyCount:0, lastMonsterDate:'', totalQuests:0, bookCount:0,
      pendingRewards:[], promotionPending:false, houseDecorations:[], yardFloor:{}, lastAttendDate:'', achievements:[]
    },
    { id:'s5', name:'학생5', avatar:'👦', pw:'1234', charType:1, dream:'미래를 꿈꾸는 학생', job:'학생',
      level:1, exp:0, gold:0, title:'', titles:[],
      stats:{read:0,study:0,art:0,value:0,health:0}, combat:{atk:0,def:0,mag:0,spd:0},
      equipment:{}, equipmentIds:{}, inventory:[], farm:[], books:[],
      monsterLog:[], monsterDailyCount:0, lastMonsterDate:'', totalQuests:0, bookCount:0,
      pendingRewards:[], promotionPending:false, houseDecorations:[], yardFloor:{}, lastAttendDate:'', achievements:[]
    },
    { id:'s6', name:'학생6', avatar:'👧', pw:'1234', charType:2, dream:'미래를 꿈꾸는 학생', job:'학생',
      level:1, exp:0, gold:5000, title:'', titles:[],
      stats:{read:0,study:0,art:0,value:0,health:0}, combat:{atk:0,def:0,mag:0,spd:0},
      equipment:{}, equipmentIds:{},
      inventory:[{id:'d_y1',qty:3},{id:'d_y2',qty:3},{id:'d_y3',qty:3},{id:'d_y4',qty:3},{id:'d_y5',qty:3},{id:'d_y6',qty:3},{id:'d_y7',qty:3},{id:'d_y8',qty:3},{id:'d_y9',qty:3},{id:'d_y10',qty:3},{id:'d_y11',qty:3},{id:'d_y12',qty:3},{id:'d_y13',qty:3},{id:'d_y14',qty:3},{id:'d_i1',qty:3},{id:'d_i2',qty:3},{id:'d_i3',qty:3},{id:'d_i4',qty:3},{id:'d_i5',qty:3},{id:'d_i6',qty:3},{id:'d_i7',qty:3},{id:'d_i8',qty:3},{id:'d_i9',qty:3},{id:'d_i10',qty:3},{id:'d_i11',qty:3},{id:'d_i12',qty:3},{id:'d_i13',qty:3},{id:'d_i14',qty:3}],
      farm:[], books:[],
      monsterLog:[], monsterDailyCount:0, lastMonsterDate:'', totalQuests:0, bookCount:0,
      pendingRewards:[], promotionPending:false, houseDecorations:[], yardFloor:{}, lastAttendDate:'', achievements:[]
    },
  ],

  // ─── 장비 (밸런스 v3: spd → 신발+장갑, def → 머리+몸통) ────────────────
  // 핵심 원칙: 해당 레벨 풀셋 기준으로 몬스터 조건 달성 가능
  equipment: {
    head: [
      {id:'e_h1', name:'천 모자',        lv:3,  stats:{def:3},               cond:{},                           price:80,   icon:'🎩'},
      {id:'e_h2', name:'가죽 모자',      lv:5,  stats:{def:5, spd:1},        cond:{health:3},                   price:120,  icon:'🪖'},
      {id:'e_h3', name:'견습 마법 모자', lv:7,  stats:{mag:4, def:3},        cond:{art:4},                      price:160,  icon:'🧙'},
      {id:'e_h4', name:'기사 투구',      lv:10, stats:{def:10, spd:2},       cond:{health:6},                   price:220,  icon:'⛑️'},
      {id:'e_h5', name:'학자의 모자',    lv:13, stats:{mag:8, def:4},        cond:{study:7},                    price:320,  icon:'🎓'},
      {id:'e_h6', name:'수호 투구',      lv:16, stats:{def:15, spd:3},       cond:{health:10,value:5},          price:420,  icon:'🛡️'},
      {id:'e_h7', name:'대마법 모자',    lv:20, stats:{mag:13, def:5},       cond:{art:12,study:8},             price:600,  icon:'🔮'},
      {id:'e_h8', name:'황금 투구',      lv:24, stats:{def:21, spd:4},       cond:{health:14,value:8},          price:650,  icon:'👑'},
      {id:'e_h9', name:'전설 투구',      lv:28, stats:{def:26, spd:5},       cond:{health:18,value:12},         price:850,  icon:'💎'},
      {id:'e_h10',name:'왕관',           lv:30, stats:{def:30,mag:8,spd:6},  cond:{read:15,study:15,value:15},  price:1100, icon:'👑'},
    ],
    body: [
      {id:'e_b1', name:'천 옷',          lv:3,  stats:{def:5},               cond:{},                           price:80,   icon:'👕'},
      {id:'e_b2', name:'가죽 갑옷',      lv:5,  stats:{def:9},               cond:{health:3},                   price:120,  icon:'🥋'},
      {id:'e_b3', name:'견습 로브',      lv:7,  stats:{mag:6, def:4},        cond:{art:4},                      price:160,  icon:'🧥'},
      {id:'e_b4', name:'철 갑옷',        lv:10, stats:{def:14},              cond:{health:6},                   price:220,  icon:'🛡️'},
      {id:'e_b5', name:'연구 로브',      lv:13, stats:{mag:11, def:6},       cond:{study:7},                    price:320,  icon:'🔬'},
      {id:'e_b6', name:'기사 갑옷',      lv:16, stats:{def:20},              cond:{health:10,value:5},          price:420,  icon:'⚔️'},
      {id:'e_b7', name:'대마법 로브',    lv:20, stats:{mag:18, def:8},       cond:{art:12,study:8},             price:600,  icon:'✨'},
      {id:'e_b8', name:'황금 갑옷',      lv:24, stats:{def:27},              cond:{health:14,value:8},          price:650,  icon:'💛'},
      {id:'e_b9', name:'전설 갑옷',      lv:28, stats:{def:34},              cond:{health:18,value:12},         price:850,  icon:'🌟'},
      {id:'e_b10',name:'왕의 갑옷',      lv:30, stats:{def:40},              cond:{health:20,value:15,study:10},price:1100, icon:'👑'},
    ],
    weapon: [
      {id:'e_w1', name:'나무검',         lv:3,  stats:{atk:5},               cond:{},                           price:80,   icon:'🗡️'},
      {id:'e_w2', name:'철검',           lv:5,  stats:{atk:8, mag:2},         cond:{health:3},                   price:120,  icon:'⚔️'},
      {id:'e_w3', name:'마법 지팡이',    lv:7,  stats:{mag:10},              cond:{art:4},                      price:160,  icon:'🪄'},
      {id:'e_w4', name:'강철검',         lv:10, stats:{atk:15},              cond:{health:6},                   price:220,  icon:'🔱'},
      {id:'e_w5', name:'학자의 지팡이',  lv:13, stats:{mag:16},              cond:{study:7},                    price:320,  icon:'📿'},
      {id:'e_w6', name:'기사검',         lv:16, stats:{atk:21},              cond:{health:10,value:5},          price:420,  icon:'🏹'},
      {id:'e_w7', name:'대마법 지팡이',  lv:20, stats:{mag:23},              cond:{art:12,study:8},             price:600,  icon:'⚡'},
      {id:'e_w8', name:'황금검',         lv:24, stats:{atk:28},              cond:{health:14,value:8},          price:650,  icon:'✨'},
      {id:'e_w9', name:'전설검',         lv:28, stats:{atk:34},              cond:{health:18,value:12},         price:850,  icon:'💎'},
      {id:'e_w10',name:'영웅의 검',      lv:30, stats:{atk:40},              cond:{health:20,value:15,read:10}, price:1100, icon:'🌈'},
    ],
    glove: [
      // ★ 장갑: 공격/마력 + 속도 동시 부여 (속도 분산 핵심)
      {id:'e_g1', name:'천 장갑',        lv:3,  stats:{atk:2, spd:2},        cond:{},                           price:80,   icon:'🧤'},
      {id:'e_g2', name:'가죽 장갑',      lv:5,  stats:{atk:3, spd:2, mag:2}, cond:{health:3},                   price:120,  icon:'🥊'},
      {id:'e_g3', name:'마법 장갑',      lv:7,  stats:{mag:4, spd:3},        cond:{art:4},                      price:160,  icon:'✋'},
      {id:'e_g4', name:'철 장갑',        lv:10, stats:{atk:5, spd:4},        cond:{health:6},                   price:220,  icon:'⚙️'},
      {id:'e_g5', name:'연구 장갑',      lv:13, stats:{mag:7, spd:5},        cond:{study:7},                    price:320,  icon:'🔬'},
      {id:'e_g6', name:'기사 장갑',      lv:16, stats:{atk:8, spd:6},        cond:{health:10,value:5},          price:420,  icon:'🏆'},
      {id:'e_g7', name:'마도 장갑',      lv:20, stats:{mag:10, spd:8},       cond:{art:12,study:8},             price:600,  icon:'💫'},
      {id:'e_g8', name:'황금 장갑',      lv:24, stats:{atk:11, spd:9},       cond:{health:14,value:8},          price:650,  icon:'💛'},
      {id:'e_g9', name:'전설 장갑',      lv:28, stats:{atk:13, spd:11},      cond:{health:18,value:12},         price:850,  icon:'💎'},
      {id:'e_g10',name:'영웅 장갑',      lv:30, stats:{atk:16,spd:12,mag:4}, cond:{health:20,value:15,study:10},price:1100, icon:'🌟'},
    ],
    shoe: [
      // ★ 신발: 속도 메인 + def/mag 보조
      {id:'e_s1', name:'천 신발',        lv:3,  stats:{spd:4, def:1},        cond:{},                           price:80,   icon:'👟'},
      {id:'e_s2', name:'가죽 신발',      lv:5,  stats:{spd:6, def:2},        cond:{health:3},                   price:120,  icon:'👠'},
      {id:'e_s3', name:'마법 신발',      lv:7,  stats:{spd:6, mag:2},        cond:{art:4},                      price:160,  icon:'✨'},
      {id:'e_s4', name:'철 부츠',        lv:10, stats:{spd:8, def:3},        cond:{health:6},                   price:220,  icon:'🥾'},
      {id:'e_s5', name:'연구 부츠',      lv:13, stats:{spd:9, mag:3},        cond:{study:7},                    price:320,  icon:'🔬'},
      {id:'e_s6', name:'기사 부츠',      lv:16, stats:{spd:11, def:4},       cond:{health:10,value:5},          price:420,  icon:'⚔️'},
      {id:'e_s7', name:'마도 부츠',      lv:20, stats:{spd:13, mag:4},       cond:{art:12,study:8},             price:600,  icon:'💫'},
      {id:'e_s8', name:'황금 부츠',      lv:24, stats:{spd:15, def:5},       cond:{health:14,value:8},          price:650,  icon:'💛'},
      {id:'e_s9', name:'전설 부츠',      lv:28, stats:{spd:18, def:6},       cond:{health:18,value:12},         price:850,  icon:'💎'},
      {id:'e_s10',name:'영웅 부츠',      lv:30, stats:{spd:20, def:8},       cond:{health:20,value:15,read:10}, price:1100, icon:'🌈'},
    ],
  },
  // ─── 씨앗 (성장 시간 대폭 단축: 수업 시간 기준) ──────────
  // 수업 중 2~3번 접속 기준: 감자는 쉬는시간에 심으면 점심에 수확 가능
  seeds: [
    // reqLv: 해당 레벨 이상이어야 상점에서 구매 가능
    // 고급 씨앗일수록 시간당 수익이 더 높음 → 레벨업 동기 강화
    {id:'i_potato_seed',    name:'감자 씨앗',  icon:'🥔', price:25,  growHours:20, sellPrice:40,  crop:'potato',     cropIcon:'🥔', reqLv:1},
    {id:'i_carrot_seed',    name:'당근 씨앗',  icon:'🥕', price:40,  growHours:24, sellPrice:75,  crop:'carrot',     cropIcon:'🥕', reqLv:3},
    {id:'i_corn_seed',      name:'옥수수 씨앗',icon:'🌽', price:60,  growHours:36, sellPrice:125, crop:'corn',       cropIcon:'🌽', reqLv:5},
    {id:'i_tomato_seed',    name:'토마토 씨앗',icon:'🍅', price:80,  growHours:48, sellPrice:180, crop:'tomato',     cropIcon:'🍅', reqLv:8},
    {id:'i_strawberry_seed',name:'딸기 씨앗',  icon:'🍓', price:120, growHours:72, sellPrice:290, crop:'strawberry', cropIcon:'🍓', reqLv:12},
  ],

  // ─── 장식물 ────────────────────────────────────────────
  decorations: [
    // ── 마당 (yard) ──
    // ⚪ 일반 Lv1+
    {id:'d_y1', name:'장미 꽃밭',    icon:'🌹', price:50,   cat:'yard',   rarity:'common', reqLv:1},
    {id:'d_y2', name:'튤립',          icon:'🌷', price:70,   cat:'yard',   rarity:'common', reqLv:1},
    {id:'d_y3', name:'선인장',        icon:'🌵', price:80,   cat:'yard',   rarity:'common', reqLv:1},
    {id:'d_y4', name:'정원석',        icon:'🪨', price:100,  cat:'yard',   rarity:'common', reqLv:1},
    // 🔵 희귀 Lv5+
    {id:'d_y5', name:'정원 벤치',     icon:'🪑', size:{w:2,h:1}, price:200,  cat:'yard',   rarity:'rare',   reqLv:5},
    {id:'d_y6', name:'가로등',        icon:'🏮', price:250,  cat:'yard',   rarity:'rare',   reqLv:5},
    {id:'d_y7', name:'해바라기 화단', icon:'🌻', price:300,  cat:'yard',   rarity:'rare',   reqLv:5},
    {id:'d_y8', name:'허수아비',      icon:'🧹', price:380,  cat:'yard',   rarity:'rare',   reqLv:5},
    // 🟣 영웅 Lv10+
    {id:'d_y9', name:'작은 나무',     icon:'🌲', size:{w:2,h:2}, price:600,  cat:'yard',   rarity:'epic',   reqLv:10},
    {id:'d_y10',name:'분수',          icon:'⛲', size:{w:2,h:2}, price:750,  cat:'yard',   rarity:'epic',   reqLv:10},
    {id:'d_y11',name:'풍차',          icon:'🌀', size:{w:2,h:2}, price:900,  cat:'yard',   rarity:'epic',   reqLv:10},
    // 🟡 전설 Lv20+
    {id:'d_y12',name:'벚나무',        icon:'🌸', size:{w:3,h:3}, price:1200, cat:'yard',   rarity:'legend', reqLv:20},
    {id:'d_y13',name:'마법 정원석',   icon:'💎', price:1500, cat:'yard',   rarity:'legend', reqLv:20},
    {id:'d_y14',name:'황금 석등',     icon:'🌟', price:1800, cat:'yard',   rarity:'legend', reqLv:20},
    // ── 집 안 (indoor) ──
    // ⚪ 일반 Lv1+
    {id:'d_i1', name:'화분',          icon:'🪴', price:60,   cat:'indoor', rarity:'common', reqLv:1},
    {id:'d_i2', name:'램프',          icon:'💡', price:80,   cat:'indoor', rarity:'common', reqLv:1},
    {id:'d_i3', name:'시계',          icon:'🕰️', price:100,  cat:'indoor', rarity:'common', reqLv:1},
    {id:'d_i4', name:'그림 액자',     icon:'🖼️', price:120,  cat:'indoor', rarity:'common', reqLv:1},
    // 🔵 희귀 Lv5+
    {id:'d_i5', name:'책상',          icon:'🖥️', size:{w:2,h:1}, price:200,  cat:'indoor', rarity:'rare',   reqLv:5},
    {id:'d_i6', name:'책장',          icon:'📚', size:{w:1,h:2}, price:280,  cat:'indoor', rarity:'rare',   reqLv:5},
    {id:'d_i7', name:'TV',            icon:'📺', size:{w:2,h:1}, price:320,  cat:'indoor', rarity:'rare',   reqLv:5},
    {id:'d_i8', name:'소파',          icon:'🛋️', size:{w:3,h:1}, price:380,  cat:'indoor', rarity:'rare',   reqLv:5},
    // 🟣 영웅 Lv10+
    {id:'d_i9', name:'피아노',        icon:'🎹', size:{w:2,h:2}, price:600,  cat:'indoor', rarity:'epic',   reqLv:10},
    {id:'d_i10',name:'침대',          icon:'🛏️', size:{w:2,h:2}, price:750,  cat:'indoor', rarity:'epic',   reqLv:10},
    {id:'d_i11',name:'수족관',        icon:'🐠', size:{w:3,h:1}, price:900,  cat:'indoor', rarity:'epic',   reqLv:10},
    // 🟡 전설 Lv20+
    {id:'d_i12',name:'황금 책장',     icon:'📖', size:{w:2,h:2}, price:1200, cat:'indoor', rarity:'legend', reqLv:20},
    {id:'d_i13',name:'마법 거울',     icon:'🪞', size:{w:1,h:2}, price:1500, cat:'indoor', rarity:'legend', reqLv:20},
    {id:'d_i14',name:'왕의 의자',     icon:'👑', size:{w:1,h:2}, price:1800, cat:'indoor', rarity:'legend', reqLv:20},
    // ── 업적 전용 (상점 미판매, price:0) ──
    {id:'deco_trophy',    name:'트로피 (업적)',    icon:'🏆', price:0, cat:'yard',   rarity:'legend', reqLv:1},
    {id:'deco_bookshelf', name:'황금 책장 (업적)', icon:'📚', price:0, cat:'indoor', rarity:'legend', reqLv:1},
    {id:'deco_garden',    name:'비밀 정원 (업적)', icon:'🌺', price:0, cat:'yard',   rarity:'legend', reqLv:1},
  ],

  // ─── 몬스터 (밸런스 v4: 1학기 18주 기준 EXP 재조정) ─────────────
  // 저레벨 몬스터 EXP 대폭 상향 → 초반 레벨업 빠르게, 후반은 완만하게
  monsters: [
    {id:'m1', name:'슬라임',       icon:'🟢',recLv:1, reqStat:'atk',reqVal:0, gold:25,  exp:25},  // Lv1: 장비없어도 가능
    {id:'m2', name:'아기 멧돼지',  icon:'🐗',recLv:3, reqStat:'atk',reqVal:6, gold:32,  exp:30},
    {id:'m3', name:'마법 애벌레',  icon:'🐛',recLv:7, reqStat:'mag',reqVal:20,gold:35,  exp:33},  // mag 상향 (풀셋26)
    {id:'m4', name:'들쥐',         icon:'🐭',recLv:4, reqStat:'spd',reqVal:5, gold:38,  exp:33},
    {id:'m5', name:'돌거북',       icon:'🐢',recLv:5, reqStat:'def',reqVal:8, gold:42,  exp:36},
    {id:'m6', name:'고블린',       icon:'👺',recLv:6, reqStat:'atk',reqVal:9, gold:46,  exp:39},
    {id:'m7', name:'숲 늑대',      icon:'🐺',recLv:7, reqStat:'spd',reqVal:7, gold:50,  exp:42},
    {id:'m8', name:'마도 고양이',  icon:'🐱',recLv:8, reqStat:'mag',reqVal:22,gold:54,  exp:45},  // mag 상향 (풀셋26)
    {id:'m9', name:'강철 딱정벌레',icon:'🪲',recLv:9, reqStat:'def',reqVal:6, gold:58,  exp:48},
    {id:'m10',name:'오크 전사',    icon:'👹',recLv:10,reqStat:'atk',reqVal:14,gold:62,  exp:53},
    {id:'m11',name:'그림자 늑대',  icon:'🦊',recLv:11,reqStat:'spd',reqVal:12,gold:68,  exp:57},
    {id:'m12',name:'철 골렘',      icon:'🤖',recLv:12,reqStat:'def',reqVal:20,gold:74,  exp:61}, // def 상향 (풀셋27)
    {id:'m13',name:'마도 정령',    icon:'💨',recLv:13,reqStat:'mag',reqVal:35,gold:80,  exp:66}, // mag 대폭 상향 (풀셋45)
    {id:'m14',name:'트롤',         icon:'🧌',recLv:14,reqStat:'spd',reqVal:12,gold:86,  exp:71},
    {id:'m15',name:'독 거미',      icon:'🕷️',recLv:15,reqStat:'spd',reqVal:13,gold:92,  exp:76},
    {id:'m16',name:'화염 정령',    icon:'🔥',recLv:16,reqStat:'atk',reqVal:22,gold:98,  exp:80}, // atk 상향 (풀셋29)
    {id:'m17',name:'바위 거인',    icon:'🗿',recLv:18,reqStat:'def',reqVal:30,gold:108, exp:86}, // def 상향 (풀셋39)
    {id:'m18',name:'폭풍 늑대',    icon:'⚡',recLv:19,reqStat:'spd',reqVal:18,gold:118, exp:92}, // spd 상향 (풀셋20)
    {id:'m19',name:'암흑 기사',    icon:'🖤',recLv:20,reqStat:'mag',reqVal:50,gold:128, exp:99}, // mag 대폭 상향 (풀셋68)
    {id:'m20',name:'고대 드래곤',  icon:'🐉',recLv:30,reqStat:'atk',reqVal:45,gold:220, exp:120}, // atk 상향 (풀셋56)
  ],

  // ─── 칭호·승급 ────────────────────────────────────────
  titles: ['독서왕','학습왕','예술왕','가치왕','건강왕','도전왕','성실왕','친절왕'],
  promotionLevels: [5, 10, 15, 20, 25, 30],

  // ─── 이름 매핑 ★ 인성 → 가치 ─────────────────────────
  statNames:   { read:'독서', study:'학습', art:'예술', value:'가치', health:'건강' },
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

  async init() {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    this._fbRef = firebase.database().ref(this.KEY);
    this._fbAdminRef = firebase.database().ref(this.ADMIN_KEY);

    // 초기 데이터 로드
    const snap = await this._fbRef.once('value');
    let data = snap.val();

    if (!data) {
      data = this._defaultData();
      await this._fbRef.set(data);
    }
    this._cache = this._migrate(this._normalizeArrays(data));

    // 실시간 동기화 리스너 — 다른 기기 변경사항 반영
    this._fbRef.on('value', (snap) => {
      if (this._saving) return; // 내가 저장 중일 때는 무시
      const d = snap.val();
      if (d) {
        this._cache = this._migrate(this._normalizeArrays(d));
        if (this._onChangeCb) this._onChangeCb();
      }
    });
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
    }).filter(Boolean);
    // 중복 학생 제거 (같은 id가 여러 번 있을 경우 마지막 것 유지)
    const seen = new Map();
    data.students.forEach(s => seen.set(s.id, s));
    data.students = Array.from(seen.values());
    // questLogs가 완료 판정의 단일 소스 (quests 배열 인덱스 충돌 방지)
    data.quests = Object.values(data.questLogs || {})
      .filter(q => q != null && typeof q === 'object' && q.studentId);
    data.promotionRequests  = toArr(data.promotionRequests);
    data.boardQuests        = toArr(data.boardQuests);
    data.artworks           = toArr(data.artworks);
    data.pwResetRequests    = toArr(data.pwResetRequests);
    return data;
  },

  _migrate(data) {
    data.students = data.students.map(s => {
      if (s.stats && s.stats.moral !== undefined && s.stats.value === undefined) {
        s.stats.value = s.stats.moral; delete s.stats.moral;
      }
      return {
        books:[], equipmentIds:{}, promotionPending:false,
        lastMonsterDate:'', monsterDailyCount:0,
        houseDecorations:[], achievements:[], farmHarvests:0,
        ...s,
        houseDecorations: (s.houseDecorations||[]).map(p => {
          if (p.row !== undefined && p.col !== undefined) return p;
          const area = p.area || 'yard';
          const oldCols = area==='yard' ? 5 : 3;
          const slot = p.slot || 0;
          return {id:p.id, area, row:Math.floor(slot/oldCols), col:slot%oldCols};
        }),
      };
    });
    return data;
  },

  load() { return this._cache; },

  save(data) {
    this._cache = data;
    this._saving = true;
    this._fbRef.set(data).finally(() => {
      setTimeout(() => { this._saving = false; }, 500);
    });
  },

  // ── 부분 저장 (충돌 방지) ──
  saveStudent(student) {
    const db = this.load();
    const idx = db.students.findIndex(s => s.id === student.id);
    if (idx >= 0) db.students[idx] = student; else db.students.push(student);
    this._cache = db;
    this._saving = true;
    // id 키 기반 저장 (인덱스 충돌 방지)
    this._fbRef.child('students/' + student.id).set(student).finally(() => {
      setTimeout(() => { this._saving = false; }, 500);
    });
  },

  saveQuestLog(log) {
    const db = this.load();
    db.quests = db.quests || [];
    db.quests.push(log);
    this._cache = db;
    // questLogs에 고유 키로 저장 (완료 판정 기준)
    const logId = log.studentId + '_' + (log.boardQuestId||'manual') + '_' + Date.now();
    log._id = logId;
    this._fbRef.child('questLogs/' + logId).set(log);
  },

  saveArtwork(artwork) {
    const db = this.load();
    db.artworks = db.artworks || [];
    db.artworks.push(artwork);
    this._cache = db;
    this._fbRef.child('artworks/' + artwork.id).set(artwork);
  },

  getStudents()    { return this.load().students; },
  getStudent(id)   { return this.load().students.find(s => s.id === id); },

  getSettings()    { return this.load().settings; },
  saveSettings(s)  { const db = this.load(); db.settings = s; this.save(db); },

  getQuests()      { return this.load().quests || []; },
  addQuest(q)      { const db = this.load(); db.quests = [...(db.quests||[]), q]; this.save(db); },

  getPromotionRequests()     { return this.load().promotionRequests || []; },
  addPromotionRequest(r)     { const db = this.load(); db.promotionRequests = [...(db.promotionRequests||[]), r]; this.save(db); },
  removePromotionRequest(id) { const db = this.load(); db.promotionRequests = (db.promotionRequests||[]).filter(r=>r.id!==id); this.save(db); },

  async getAdminPw() {
    const snap = await this._fbAdminRef.once('value');
    return snap.val() || 'teacher1234';
  },
  setAdminPw(pw) { this._fbAdminRef.set(pw); },

  getArtworks(studentId) { return (this.load().artworks||[]).filter(a => a.studentId === studentId); },
  addArtwork(a)          { const db=this.load(); db.artworks=[...(db.artworks||[]),a]; this.save(db); },
  deleteArtwork(id)      { const db=this.load(); db.artworks=(db.artworks||[]).filter(a=>a.id!==id); this.save(db); },

  getPwResetRequests()    { return this.load().pwResetRequests || []; },
  addPwResetRequest(r)    { const db=this.load(); db.pwResetRequests=[...(db.pwResetRequests||[]),r]; this.save(db); },
  removePwResetRequest(id){ const db=this.load(); db.pwResetRequests=(db.pwResetRequests||[]).filter(r=>r.id!==id); this.save(db); },
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

  getSeedById(id)    { return GAME_DATA.seeds.find(s => s.id === id); },
  getSeedByCrop(crop){ return GAME_DATA.seeds.find(s => s.crop === crop); },

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

  // ★ 몬스터 하루 도전 횟수 체크 (2회)
  canFightMonster(student) {
    const settings = DB.getSettings();
    const limit = settings.monsterDailyLimit || 2;
    if ((student.lastMonsterDate||'') !== this.todayStr()) return true;
    return (student.monsterDailyCount||0) < limit;
  },
  monsterAttemptsLeft(student) {
    const settings = DB.getSettings();
    const limit = settings.monsterDailyLimit || 2;
    if ((student.lastMonsterDate||'') !== this.todayStr()) return limit;
    return Math.max(0, limit - (student.monsterDailyCount||0));
  },
};

// ─── 업적 시스템 ─────────────────────────────────────
const ACHIEVEMENTS = [
  // 퀘스트
  { id:'ach_quest1',  icon:'📋', name:'첫 번째 발걸음',   desc:'첫 퀘스트 완료',          check: s => (s.totalQuests||0) >= 1,   reward:{ title:null, deco:null,  exp:20 } },
  { id:'ach_quest10', icon:'📜', name:'퀘스트 마스터',    desc:'퀘스트 10회 완료',         check: s => (s.totalQuests||0) >= 10,  reward:{ title:null, deco:null, exp:50 } },
  { id:'ach_quest30', icon:'🏅', name:'전설의 모험가',     desc:'퀘스트 30회 완료',         check: s => (s.totalQuests||0) >= 30,  reward:{ title:null, deco:null,  exp:100 } },
  // 독서
  { id:'ach_book1',   icon:'📖', name:'첫 독서',          desc:'책 1권 읽기',              check: s => (s.bookCount||0) >= 1,    reward:{ title:null, deco:'deco_bookshelf', exp:15 } },
  { id:'ach_book5',   icon:'📚', name:'독서왕 입문',       desc:'책 5권 읽기',              check: s => (s.bookCount||0) >= 5,    reward:{ title:null, deco:null,  exp:40 } },
  { id:'ach_book15',  icon:'🎓', name:'지식의 탑',         desc:'책 15권 읽기',             check: s => (s.bookCount||0) >= 15,   reward:{ title:null, deco:null,  exp:80 } },
  // 몬스터
  { id:'ach_mon1',    icon:'⚔️', name:'첫 사냥',           desc:'첫 몬스터 처치',           check: s => (s.monsterLog||[]).length >= 1,  reward:{ title:null, deco:null, exp:20 } },
  { id:'ach_mon5',    icon:'🗡️', name:'몬스터 사냥꾼',     desc:'몬스터 5종 처치',          check: s => (s.monsterLog||[]).length >= 5,  reward:{ title:null, deco:null, exp:60 } },
  { id:'ach_mon_all', icon:'👑', name:'몬스터 도감 완성',  desc:'모든 일반 몬스터 처치',    check: s => (s.monsterLog||[]).length >= GAME_DATA.monsters.length, reward:{ title:null, deco:'deco_trophy', exp:150 } },
  // 농장
  { id:'ach_farm5',   icon:'🌱', name:'초보 농부',          desc:'농장 수확 5회',            check: s => (s.farmHarvests||0) >= 5,  reward:{ title:null, deco:null, exp:30 } },
  { id:'ach_farm20',  icon:'🌾', name:'베테랑 농부',        desc:'농장 수확 20회',           check: s => (s.farmHarvests||0) >= 20, reward:{ title:null, deco:null, exp:70 } },
  // 장비
  { id:'ach_equip',   icon:'🛡️', name:'완전무장',           desc:'5개 슬롯 모두 장착',       check: s => {
      const ids = s.equipmentIds||{};
      return ['head','body','weapon','glove','shoe'].every(k => ids[k]);
    }, reward:{ title:null, deco:null, exp:50 } },
  // 레벨
  { id:'ach_lv5',     icon:'⬆️', name:'첫 번째 도약',       desc:'레벨 5 달성',              check: s => s.level >= 5,   reward:{ title:null, deco:null, exp:30 } },
  { id:'ach_lv10',    icon:'🌟', name:'숙련자',              desc:'레벨 10 달성',             check: s => s.level >= 10,  reward:{ title:null, deco:'deco_trophy', exp:80 } },
  { id:'ach_lv20',    icon:'💫', name:'전설의 시작',         desc:'레벨 20 달성',             check: s => s.level >= 20,  reward:{ title:null, deco:null, exp:150 } },
];

const AchievementUtils = {
  // 학생의 새 업적 체크 → 새로 달성한 업적 배열 반환
  checkNew(student) {
    const earned = new Set(student.achievements || []);
    const newOnes = [];
    ACHIEVEMENTS.forEach(a => {
      if (!earned.has(a.id) && a.check(student)) {
        earned.add(a.id);
        newOnes.push(a);
      }
    });
    if (newOnes.length > 0) {
      student.achievements = [...earned];
      // 보상 지급
      newOnes.forEach(a => {
        student.exp  = (student.exp||0)  + (a.reward.exp||0);
        student.gold = (student.gold||0) + 20; // 업적 달성 보너스 골드
        if (a.reward.title && !(student.titles||[]).includes(a.reward.title)) {
          student.titles = [...(student.titles||[]), a.reward.title];
          if (!student.title) student.title = a.reward.title;
        }
        // 장식 보상 인벤토리 추가
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

  // 업적 진행도 (0~1)
  progress(student, ach) {
    try { return ach.check(student) ? 1 : 0; } catch(e) { return 0; }
  },
};

// ── 과목 목록 ────────────────────────────────────────
const DEFAULT_SUBJECTS = ['국어','수학','사회','과학','음악','미술','체육','영어','창체'];

function getActiveSubjects(db) {
  const d = db || (typeof DB !== 'undefined' ? DB.load() : {});
  const s = d.activeSubjects;
  if (!s) return DEFAULT_SUBJECTS; // 설정 없으면 기본 전체
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
