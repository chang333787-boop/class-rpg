// 반 명단 — 학습 앱 선생님 화면 공통 [APP-ROSTER-1]
//  기초 코딩 · 무늬 공방 · 물감 연구소 · 명화 탐정 · 먹 연구소 · 판화 놀이 · 음악실의 선생님 화면(#/t)은 '그 앱에 기록이 있는 아이'만 보여 줘서
//  한 번도 안 연 아이가 표에 없었다(누가 안 했는지 모름). → '반 명단 ∪ 기록 있는 아이'로 줄을 만들고, 명단에만 있는 아이는 회색 '아직 안 했어요' 줄.
//  명단 = RPG 본 데이터 classRPG_v3/students 를 한 번 읽어 id · name 만 뽑는다 — 비밀번호 등 다른 칸은 들고 있지 않는다. 쓰기 없음.
//  손님(이 기기에만) · 못 읽음(끊김 · 규칙) · 늦음이면 빈 목록 → 지금과 똑같이(기록 있는 아이만).
//  생각판은 명단을 따로 읽는다(thinkboard/js/app.js loadRoster — '누가 썼나' 칸 · 연구 자료). 수채화는 공통 뼈대를 쓰지 않는다.
//  여기를 고치면 이것을 부르는 앱 index.html import map 의 "../common/roster.js" ?v= 를 모두 같은 값으로(scripts/unit/buster-check.mjs).
import { h, keyOf } from './util.js';

export const ROSTER_PATH = 'classRPG_v3/students';

// students 값(배열이든 객체든) → [{ sid, name }]. sid 는 앱 저장 키와 같은 꼴(keyOf — 앱 store 가 ?sid= 를 keyOf 로 바꿔 쓴다).
//  같은 학생 두 벌(옛 숫자 키 + id 키)은 하나로 — 뒤 것(= id 키 본)이 이긴다(gamedata.js [DUP-STUDENT-1] 과 같은 차례).
//  이름 · id 없는 껍데기 · deleted · hidden 은 뺀다(생각판 명단과 같은 거르기).
export function rosterOf(students) {
  const m = new Map();
  for (const x of Object.values(students && typeof students === 'object' ? students : {})) {
    if (!x || typeof x !== 'object' || x.id == null || x.id === '' || !x.name || x.deleted || x.hidden) continue;
    m.set(keyOf(x.id), String(x.name));
  }
  return [...m].map(([sid, name]) => ({ sid, name }));
}

// 명단 한 번 읽기 — 실패 · ms 안에 안 오면 [](선생님 화면이 명단 때문에 멈추지 않게)
export async function loadRoster(db, { ms = 5000 } = {}) {
  if (!db || typeof db.ref !== 'function') return [];
  let timer = null;
  try {
    const late = new Promise(r => { timer = setTimeout(() => r(null), ms); });
    const snap = await Promise.race([db.ref(ROSTER_PATH).once('value'), late]);
    return snap ? rosterOf(snap.val()) : [];
  } catch (e) { console.warn('[roster] 반 명단을 못 읽었어요', e); return []; }
  finally { clearTimeout(timer); }
}

// 앱 store 로 — 손님(이 기기에만) · 오프라인이면 읽지 않는다
export function rosterFor(store, opts) {
  if (!store || !store.me || store.me.guest || !store.online || !store.db) return Promise.resolve([]);
  return loadRoster(store.db, opts);
}

// 이름표 — 앱 이름표(names/<sid>) 위에 명단 이름(RPG 에서 이름을 고쳤으면 새 이름으로)
export const rosterNames = (names, roster) => Object.assign({}, names || {}, ...roster.map(r => ({ [r.sid]: r.name })));

// 표 줄 — 기록 있는 아이(kids · 앱 차례 그대로) 뒤에 명단에만 있는 아이(이름 차례). idle = 그 아이들(회색 줄)
export function rosterRows(kids, roster) {
  const have = new Set(kids);
  const idle = roster.filter(r => !have.has(r.sid) && r.sid !== 'teacher')
    .sort((a, z) => a.name.localeCompare(z.name, 'ko')).map(r => r.sid);
  return { rows: [...kids, ...idle], idle: new Set(idle) };
}

// 회색 줄 하나 — 이름 칸 + 나머지 칸을 하나로 합친 '아직 안 했어요'(.tmap 표 · 꼴은 common/subapp.css)
export const idleRow = (name, span) => h('tr', { class: 'idle' }, h('td', { class: 'nm' }, name), h('td', { class: 'idle-msg', colspan: span }, '아직 안 했어요'));
