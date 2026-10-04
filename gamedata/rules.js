// gamedata/rules.js — 업적(ACHIEVEMENTS·AchievementUtils) · 관리자 설정 덮기(getActiveMonsters·applyShopOverrides·applyBattleSettings·BATTLE_CONSTS)
//  gamedata.js 에서 떼어 옮긴 클래식 스크립트 [GAMEDATA-SPLIT-1] — 글자 그대로 · 전역 그대로 · html 네 곳에서 gamedata.js 바로 뒤에 부른다(gamedata/data.js → gamedata/rules.js → gamedata/emotion.js → gamedata/battle.js).
// ── [GAMEDATA-SPLIT-1] 'rules' — 원래 gamedata.js 2313~2709줄 ──
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
  { id:'ach_rar_com5',  icon:'🔵', name:'일반 몬스터 발견자', desc:'일반 몬스터 5종', check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.rarity==='common').map(m=>m.id);return (s.monsterLog||[]).filter(id=>ms.includes(id)).length>=5;},  reward:{exp:20,gold:15,title:null,deco:null} },
  { id:'ach_rar_com20', icon:'🔵', name:'일반 수집가',        desc:'일반 몬스터 20종',check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.rarity==='common').map(m=>m.id);return (s.monsterLog||[]).filter(id=>ms.includes(id)).length>=20;}, reward:{exp:50,gold:30,title:null,deco:null} },
  { id:'ach_rar_com42', icon:'🔵', name:'일반 도감 완성',     desc:'일반 몬스터 전부',check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.rarity==='common').map(m=>m.id);return ms.every(id=>(s.monsterLog||[]).includes(id));}, reward:{exp:100,gold:60,title:null,deco:null} },
  { id:'ach_rar_rare3', icon:'🟣', name:'희귀 몬스터 발견자', desc:'희귀 몬스터 첫 발견',check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.rarity==='rare').map(m=>m.id);return (s.monsterLog||[]).some(id=>ms.includes(id));}, reward:{exp:40,gold:30,title:null,deco:null} },
  { id:'ach_rar_rare20',icon:'🟣', name:'희귀 수집가',        desc:'희귀 몬스터 20종', check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.rarity==='rare').map(m=>m.id);return (s.monsterLog||[]).filter(id=>ms.includes(id)).length>=20;}, reward:{exp:80,gold:60,title:null,deco:null} },
  { id:'ach_rar_leg1',  icon:'🌟', name:'전설의 발견자',      desc:'전설 몬스터 첫 발견',check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.rarity==='legend').map(m=>m.id);return (s.monsterLog||[]).some(id=>ms.includes(id));}, reward:{exp:80,gold:60,title:'전설 목격자',deco:null} },
  { id:'ach_rar_leg10', icon:'🌟', name:'전설 추적자',        desc:'전설 몬스터 10종',check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.rarity==='legend').map(m=>m.id);return (s.monsterLog||[]).filter(id=>ms.includes(id)).length>=10;}, reward:{exp:150,gold:100,title:'전설 추적자',deco:null} },
  { id:'ach_rar_leg21', icon:'💫', name:'전설 완성자',        desc:'전설 몬스터 전부',check: s=>{const ms=GAME_DATA.monsters.filter(m=>m.rarity==='legend').map(m=>m.id);return ms.every(id=>(s.monsterLog||[]).includes(id));}, reward:{exp:250,gold:180,title:'전설의 사냥꾼',deco:'deco_trophy'} },

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
// [GLOBAL-DUP-1] getActiveSubjects 는 admin.js 에만 둔다(settings.activeSubjects 를 읽음).
//   여기 있던 옛 판(d.activeSubjects 를 읽음)은 admin 에서 늘 덮였고 학생·키오스크는 부르지 않아 지웠다.

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

