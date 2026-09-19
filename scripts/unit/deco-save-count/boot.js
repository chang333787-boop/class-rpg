// 가짜(없는) 프로젝트 + 오프라인 — 통신 0. gamedata.js 보다 먼저.
(function () {
  //  [DECO-HARNESS-RAF-1] 헤드리스 가상 시간에서는 requestAnimationFrame 이 몇 초씩 늦거나 아예 안 돈다(직접 쟀다: 3초 넘게 0번).
  //  꾸미기는 여는 쪽이 rAF 두 번 뒤에 판을 그리고 _decoViewRestore(배율·자리를 바꾸고 캔버스를 새로 잡음)를 부르는데,
  //  그 콜백이 **다음 시험 도중**에 끼어들어 가끔 false 가 났다(핀치 17회 중 1회 · 구경뒤_내자리 3~4회 중 1회).
  //  기다리는 것(rafSettle)으로는 '4초보다 더 늦는 경우'를 못 막는다 → 이 하네스 안에서는 rAF 를 16ms 타이머로 돌린다.
  //  시험이 보는 것은 값·상태이고 프레임 박자가 아니다. 제품 코드는 그대로다(놀이판 play-boot.js 는 안 건드린다 — 거기는 진짜 rAF).
  let rafId = 0; const rafMap = new Map();
  window.requestAnimationFrame = cb => { const id = ++rafId; rafMap.set(id, setTimeout(() => { rafMap.delete(id); cb(performance.now()); }, 16)); return id; };
  window.cancelAnimationFrame = id => { clearTimeout(rafMap.get(id)); rafMap.delete(id); };
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
