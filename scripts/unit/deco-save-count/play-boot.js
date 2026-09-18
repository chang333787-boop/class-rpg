// 꾸미기 놀이판 부팅 — 가짜(없는) 프로젝트 + 오프라인. 운영 DB 에 닿지 않는다. gamedata.js 보다 먼저.
(function () {
  firebase.initializeApp({ apiKey: 'x', projectId: 'play-deco-none', databaseURL: 'https://play-deco-none-default-rtdb.firebaseio.com' });
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
