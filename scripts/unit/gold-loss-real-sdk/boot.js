// 실제 firebase SDK 를 쓰되 가짜(존재하지 않는) 프로젝트 + 오프라인. gamedata.js 보다 먼저 실행된다 → DB.init 은 이 앱을 그대로 쓴다.
(function () {
  firebase.initializeApp({ apiKey: 'x', projectId: 'q1-probe-none', databaseURL: 'https://q1-probe-none-default-rtdb.firebaseio.com' });
  const db = firebase.database();
  db.goOffline();
  const sid = 's1773621060761';
  const seed = {
    students: { [sid]: { id: sid, name: '시험1', pw: 'x', charType: 1, level: 5, exp: 500, gold: 1000, totalGold: 1000, monsterLog: [] } },
    settings: { className: '시험', accessStart: '00:00', accessEnd: '23:59' },
    questLogs: {}, boardQuests: [],
  };
  db.ref('classRPG_v3').set(seed);          // 로컬에 노드 완성 → once/on 이 오프라인에서도 뜬다
  db.ref('classRPG_adminPw').set('x');
  // [STUDENT-COLD-1] ?profile=student → 학생 판(노드별 구독)으로 돌린다: DB.init 이 부르는 shallow REST 만 여기서 답한다(네트워크 0).
  //   ?profile=root(기본) → shallow 를 실패시켜 root 판(교사·옛 학생)으로. 오프라인이라 둘 다 실제 SDK 로컬 판에서 돈다.
  const PROFILE = new URLSearchParams(location.search).get('profile') || 'root';
  const realFetch = window.fetch;
  window.fetch = (u, o) => {
    if (!String(u).includes('shallow=true')) return realFetch(u, o);
    if (PROFILE !== 'student') return Promise.reject(new Error('q1: root 판 강제'));
    return Promise.resolve(new Response(JSON.stringify(Object.fromEntries(Object.keys(seed).map(k => [k, true]))), { status: 200 }));
  };
  window.__Q1 = { sid, db, log: [], profile: PROFILE };
})();
