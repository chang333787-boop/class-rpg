// 꾸미기 놀이판 부팅 — 가짜(없는) 프로젝트 + 오프라인. 운영 DB 에 닿지 않는다. gamedata.js 보다 먼저.
(function () {
  firebase.initializeApp({ apiKey: 'x', projectId: 'play-deco-none', databaseURL: 'https://play-deco-none-default-rtdb.firebaseio.com' });
  //  [LAZY-SDK-1] 영어앱 Firestore SDK 는 이제 html 태그가 아니라 syncEnglishRewards 가 처음 필요할 때 부른다.
  //  run 이 태그를 빼던 것과 같게 '이미 있는 것'으로 막는다 — 받지 않고 firestore() 가 null → 조용히 건너뜀(운영 영어앱 읽기 0).
  firebase.firestore = function () { return null; };
  const db = firebase.database();
  db.goOffline();
  const sid = 's_play_test';
  window.__PLAY = { sid, db };
  //  장식은 gamedata 가 읽힌 뒤에 채운다(play-enter.js) — 여기서는 빈 학생만
  const seed = {
    students: { [sid]: { id: sid, name: '시험', pw: 'x', charType: 1, level: 12, exp: 0, gold: 5000, totalGold: 5000,
      inventory: [], houseDecorations: [], yardFloor: {}, monsterLog: [], farm: [] } },
    settings: { className: '시험반', accessStart: '00:00', accessEnd: '23:59' },
    questLogs: {}, boardQuests: [],
  };
  db.ref('classRPG_v3').set(seed);
  db.ref('classRPG_adminPw').set('x');
  const realFetch = window.fetch;
  window.fetch = (u, o) => String(u).includes('shallow=true') ? Promise.reject(new Error('root 판')) : realFetch(u, o);
})();
