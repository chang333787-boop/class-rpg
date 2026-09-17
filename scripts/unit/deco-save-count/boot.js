// 가짜(없는) 프로젝트 + 오프라인 — 통신 0. gamedata.js 보다 먼저.
(function () {
  firebase.initializeApp({ apiKey: 'x', projectId: 'rf-deco-none', databaseURL: 'https://rf-deco-none-default-rtdb.firebaseio.com' });
  const db = firebase.database();
  db.goOffline();
  const sid = 's1773621060761';
  const seed = {
    students: { [sid]: { id: sid, name: '시험1', pw: 'x', charType: 1, level: 5, exp: 500, gold: 9999, totalGold: 9999,
      inventory: [{ id: 'd_y1', qty: 30 }], houseDecorations: [], yardFloor: {}, monsterLog: [] } },
    settings: { className: '시험', accessStart: '00:00', accessEnd: '23:59' },
    questLogs: {}, boardQuests: [],
  };
  db.ref('classRPG_v3').set(seed);
  db.ref('classRPG_adminPw').set('x');
  window.__RF = { sid, db, log: [] };
  const rf = new URLSearchParams(location.search).get('profile') || 'root';
  const realFetch = window.fetch;
  window.fetch = (u, o) => String(u).includes('shallow=true') ? Promise.reject(new Error('root 판')) : realFetch(u, o);
})();
