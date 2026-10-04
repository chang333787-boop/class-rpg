// 학급 RPG Firebase — 하위 앱 공통 [SUBAPP-COMMON-1]
//  학습 앱 8개(명화 탐정 · 기초 코딩 · 먹 연구소 · 음악실 · 물감 연구소 · 무늬 공방 · 판화 놀이 · 생각판)가 RPG 와 같은 프로젝트의
//  Realtime Database(compat 9.23, index.html 이 전역 firebase 로 싣는다)에 저장한다. 앱마다 쓰는 곳은 자기 classRPG_<앱> 하나뿐 — 각 앱 store.js.
//  설정 값은 gamedata.js FIREBASE_CONFIG 와 같다(학급 RPG 프로젝트). 고치면 import map 의 "../common/rpg-firebase.js" ?v= 를 여덟 곳 같은 값으로.

export const RPG_FIREBASE = {
  apiKey: 'AIzaSyCV_u6yKdGInPuCJanK4bzBfnLJuvIbyX4',
  authDomain: 'class-rpg-6f409.firebaseapp.com',
  databaseURL: 'https://class-rpg-6f409-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'class-rpg-6f409',
  storageBucket: 'class-rpg-6f409.firebasestorage.app',
  messagingSenderId: '408824743154',
  appId: '1:408824743154:web:382fdd431f7e2dbce13c6b',
};

// 기본 앱이 아직 없으면 학급 RPG 프로젝트로 만들고 그 데이터베이스를 돌려준다(이미 있으면 있는 것 그대로).
export function rpgDb(fb) {
  if (!fb.apps.length) fb.initializeApp(RPG_FIREBASE);
  return fb.database();
}

// 선생님 화면 비밀번호 확인 — 관리자 비밀번호(classRPG_adminPw)를 한 번 읽어 견준다. 쓰기 없음.
//  RPG 본 데이터(classRPG_v3)는 읽지도 쓰지도 않는다 — 학습 앱이 루트 밖에서 읽는 곳은 이것 하나(+ 먹 · 판화의 명화 탐정 기록 읽기).
export async function adminPwOK(db, pw) {
  const real = (await db.ref('classRPG_adminPw').once('value')).val();
  return real != null && String(pw) === String(real);
}
