// renderBattleNew 가 가짜 BATTLE_STATE 로 에러를 내는 것은 저장 뒤라 판정과 무관(savedAfter_saving=true 로 확인).
// 실제 student.js 흐름: 로그인 → 한가한 상태(0.8초) → _finishBattle(승리 10G) → SDK 로컬 값 확인
(function () {
  const Q = window.__Q1;
  const out = (k, v) => { Q.log.push(k + '=' + JSON.stringify(v)); };
  const t0 = Date.now();
  (function wait() {
    const ls = document.getElementById('loading-screen');
    if (!(typeof DB !== 'undefined' && DB._cache && ls && ls.style.display === 'none')) {
      if (Date.now() - t0 < 15000) return setTimeout(wait, 50);
      out('ERR', 'timeout'); return done();
    }
    try {
      document.getElementById('s-title').classList.add('hidden');
      CUR = JSON.parse(JSON.stringify(DB.getStudent(Q.sid)));
      hideScreen('s-login');
      enterGame();
    } catch (e) { out('enterErr', e.message); }
    // enterGame 안의 저장들이 끝나고 _saving 이 풀릴 때까지 기다린다
    setTimeout(() => {
      out('savingBefore', DB._saving);
      let changes = 0; const prev = DB._onChangeCb; DB._onChangeCb = function () { changes++; return prev && prev.apply(this, arguments); };
      const before = CUR.totalGold;
      const objBefore = CUR;
      try {
        BATTLE_STATE = { isInfinite: false, monster: { id: 'mon_q1', name: '시험몹', gold: 10 }, win: true, finished: true };
        _finishBattle();
      } catch (e) { out('finishErr', String(e.stack || e.message).split(String.fromCharCode(10)).slice(0, 3).join(' | ')); }
      out('savedAfter_saving', DB._saving);
      out('onDataChangeCalls', changes);
      out('CURswapped', CUR !== objBefore);
      out('CUR.totalGold', CUR.totalGold);
      Q.db.ref('classRPG_v3/students/' + Q.sid + '/totalGold').once('value').then(s => {
        out('sdkLocal.totalGold', s.val());
        return Q.db.ref('classRPG_v3/goldDaily').once('value');
      }).then(s => {
        out('goldDaily', s.val());
        out('VERDICT', (before + 10) === CUR.totalGold ? 'NO_LOSS' : 'LOSS');
        done();
      });
    }, 1500);
  })();
  function done() {
    const pre = document.createElement('pre'); pre.id = 'q1-out'; pre.textContent = Q.log.join('\n');
    document.body.appendChild(pre); document.title = 'Q1_DONE';
  }
})();
