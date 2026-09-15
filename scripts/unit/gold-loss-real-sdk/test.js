// renderBattleNew 가 가짜 BATTLE_STATE 로 에러를 내는 것은 저장 뒤라 판정과 무관(savedAfter_saving=true 로 확인).
// 케이스(기대값):
//   ?case=battle   실제 _finishBattle 승리 10G                     → NO_LOSS
//   ?case=buySeed  실제 buySeed(첫 씨앗)                           → OK (골드 차감 + 씨앗 1)
//   ?case=farm     실제 farmCellClick 으로 다 자란 작물 수확        → NO_LOSS (운영 증상: 농장 5,220G 유실)
//   ?case=infinite 실제 _endInfiniteBattleSession(무한배틀 15G)    → NO_LOSS (운영 증상: 무한배틀 73G 유실)
// 흐름: SDK 로컬에 준비(업적 전부·밭) → 로그인 → 한가(_saving 풀림) → 케이스 실행 → SDK 로컬 값으로 판정.
(function () {
  const Q = window.__Q1;
  const out = (k, v) => { Q.log.push(k + '=' + JSON.stringify(v)); };
  const CASE = new URLSearchParams(location.search).get('case') || 'battle';
  const KNOWN = ['battle', 'buySeed', 'farm', 'infinite'];
  const t0 = Date.now();
  (function wait() {
    const ls = document.getElementById('loading-screen');
    if (!(typeof DB !== 'undefined' && DB._cache && ls && ls.style.display === 'none')) {
      if (Date.now() - t0 < 15000) return setTimeout(wait, 50);
      out('ERR', 'timeout'); return done();
    }
    if (!KNOWN.includes(CASE)) { out('ERR', 'unknown case ' + CASE); return done(); }
    let sd = null;
    // 준비는 DB.saveStudent 가 아니라 **SDK 로컬 데이터에 직접** 넣는다.
    //  · DB.saveStudent 로 넣으면 오프라인에서 set() 약속이 안 끝나 _saving 이 영영 안 풀린다(한가한 상태를 못 만듦).
    //  · 캐시에만 넣으면 SDK 데이터와 어긋나, 스냅샷이 캐시를 갈아 끼울 때 업적이 사라져 **업적 골드가 다시 지급되며
    //    유실을 가린다**(2차판에서 farm 1050·infinite 1040 으로 겪음).
    const achIds = (typeof ACHIEVEMENTS !== 'undefined') ? ACHIEVEMENTS.map(a => a.id) : [];
    const prep = { achievements: achIds };
    if (CASE === 'farm') {
      sd = (GAME_DATA.seeds || []).find(s => !s.isMutant) || GAME_DATA.seeds[0];
      prep.farm = [{ slot: 0, crop: sd.crop, planted: Date.now() - sd.growHours * 3600000 - 1000 }];   // 딱 익은 시각
    }
    Q.db.ref('classRPG_v3/students/' + Q.sid).update(prep);
    setTimeout(() => {
      try {
        document.getElementById('s-title').classList.add('hidden');
        CUR = JSON.parse(JSON.stringify(DB.getStudent(Q.sid)));
        out('prepOk', (CUR.achievements || []).length === achIds.length && (CASE !== 'farm' || (CUR.farm || []).length === 1));
        hideScreen('s-login');
        enterGame();
      } catch (e) { out('enterErr', e.message); }
    }, 300);

    // 준비 저장들이 끝나고 _saving 이 풀릴 때까지 기다린다
    setTimeout(() => {
      out('savingBefore', DB._saving);
      out('totalGoldBefore', CUR.totalGold || 0);
      let changes = 0; const prev = DB._onChangeCb; DB._onChangeCb = function () { changes++; return prev && prev.apply(this, arguments); };
      const before = CUR.totalGold || 0;
      const goldBefore = CUR.gold || 0;
      const objBefore = CUR;
      let seedId = null, invBefore = 0, expectGain = 0;
      try {
        if (CASE === 'buySeed') {
          const s0 = (GAME_DATA.seeds || [])[0]; seedId = s0.id;
          invBefore = ((CUR.inventory || []).find(i => i.id === seedId) || { qty: 0 }).qty;
          out('seed', { id: s0.id, price: s0.price });
          buySeed(seedId);
        } else if (CASE === 'farm') {
          expectGain = sd.sellPrice;
          out('crop', { crop: sd.crop, sellPrice: sd.sellPrice });
          farmCellClick(0);
        } else if (CASE === 'infinite') {
          expectGain = 15;
          IB = { zone: 'beginner', kills: 3, gold: 15, active: true, playerHp: 10, playerHpMax: 10 };
          _endInfiniteBattleSession(false);
        } else {
          expectGain = 10;
          BATTLE_STATE = { isInfinite: false, monster: { id: 'mon_q1', name: '시험몹', gold: 10 }, win: true, finished: true };
          _finishBattle();
        }
      } catch (e) { out('caseErr', String(e.stack || e.message).split(String.fromCharCode(10)).slice(0, 3).join(' | ')); }
      out('savedAfter_saving', DB._saving);
      out('onDataChangeCalls', changes);
      out('CURswapped', CUR !== objBefore);
      out('CUR.totalGold', CUR.totalGold);

      Q.db.ref('classRPG_v3/students/' + Q.sid).once('value').then(s => {
        const st = s.val() || {};
        out('sdkLocal.gold', st.gold); out('sdkLocal.totalGold', st.totalGold);
        if (CASE === 'buySeed') {
          const price = (GAME_DATA.seeds || [])[0].price;
          const qty = ((st.inventory ? Object.values(st.inventory) : []).find(i => i && i.id === seedId) || { qty: 0 }).qty;
          out('sdkLocal.seedQty', qty);
          out('VERDICT', (st.gold === goldBefore - price && qty === invBefore + 1) ? 'OK'
            : (qty === invBefore + 1 && st.gold === goldBefore) ? 'FREE_ITEM' : 'BROKEN');
        } else {
          if (CASE === 'farm') out('sdkLocal.farmLeft', st.farm ? Object.values(st.farm).length : 0);
          out('expectTotal', before + expectGain);
          out('VERDICT', (st.totalGold >= before + expectGain) ? 'NO_LOSS' : 'LOSS');
        }
        return Q.db.ref('classRPG_v3/goldDaily').once('value');
      }).then(s => { out('goldDaily', s.val()); done(); });
    }, 1800);
  })();
  function done() {
    const pre = document.createElement('pre'); pre.id = 'q1-out'; pre.textContent = Q.log.join('\n');
    document.body.appendChild(pre); document.title = 'Q1_DONE';
  }
})();
