// 꾸미기 저장 묶기(DECO-SAVE-1) 검사 — 실제 student.html + 실제 SDK(오프라인)
//  ① 쓰기 횟수(묶음이 끝난 뒤까지 센다) ② 잃는 것 0(대기 중 나가는 네 경우) ③ 스냅샷 경합
(function () {
  const R = window.__RF, out = (k, v) => R.log.push(k + '=' + JSON.stringify(v));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const t0 = Date.now();
  (async () => {
    while (!(typeof DB !== 'undefined' && DB._cache && document.getElementById('loading-screen')?.style.display === 'none')) {
      if (Date.now() - t0 > 20000) { out('ERR', 'timeout'); return done(); } await sleep(50);
    }
    document.getElementById('s-title')?.classList.add('hidden');
    CUR = JSON.parse(JSON.stringify(DB.getStudent(R.sid)));
    hideScreen('s-login'); enterGame();
    await sleep(600);
    // 저장 횟수 세기: DB.saveStudent 와 실제 SDK set 둘 다
    let saves = 0, sets = 0;
    const origSave = DB.saveStudent.bind(DB);
    DB.saveStudent = (s) => { saves++; return origSave(s); };
    const ref = DB._fbRef.child('students/' + R.sid);
    const origSet = ref.set.bind(ref);
    DB._fbRef.child = ((orig) => (p) => { const r = orig(p); if (String(p).startsWith('students/')) { const os = r.set.bind(r); r.set = (v) => { sets++; return os(v); }; } return r; })(DB._fbRef.child.bind(DB._fbRef));
    // 꾸미기 화면 열기(전체화면 인테리어)
    openHouseTab('deco'); await sleep(300);
    openInteriorFullscreen(); await sleep(800);
    out('scene', DECO_SCENE);
    out('묶기ms', typeof DECO_SAVE_MS === 'number' ? DECO_SAVE_MS : '없음(묶기 전 판)');
    //  묶음이 끝날 때까지 기다린 뒤 센다(묶기 전 판에서는 그대로 즉시 값이 나온다)
    const t = async (label, fn) => { saves = 0; sets = 0; fn(); await sleep(900); out(label, { saveStudent: saves, sdkSet: sets }); };
    // ① 바닥 20칸 칠하기 (마당, 왼쪽 위 20칸 — 집·농장 칸 피함)
    await t('바닥20칸', () => { for (let i = 0; i < 20; i++) _paintFloor(10 + Math.floor(i / 10), 2 + (i % 10)); });
    // ② 장식 10개 놓기
    SEL_DECO = 'd_y1';
    await t('장식10개놓기', () => { for (let i = 0; i < 10; i++) _decoPlace('yard', 30, 2 + i); });
    out('놓인수', (CUR.houseDecorations || []).length);
    // ③ 장식 5개 치우기
    await t('장식5개치우기', () => { for (let i = 0; i < 5; i++) _decoPlace('yard', 30, 2 + i); });
    out('놓인수뒤', (CUR.houseDecorations || []).length);
    out('바닥칸수', Object.keys(CUR.yardFloor || {}).length);
    await sleep(900);
    const server = async () => (await R.db.ref('classRPG_v3/students/' + R.sid).once('value')).val() || {};

    //  ② 잃는 것 0 — 칠한 직후(묶음 대기 중)에 나가는 네 경우
    const lost = {};
    const caseTest = async (name, key, leave) => {
      CUR.yardFloor = CUR.yardFloor || {};
      CUR.yardFloor[key] = 'stone';
      if (typeof decoDirty === 'function') decoDirty(); else DB.saveStudent(CUR);
      await sleep(50);
      try { leave(); } catch (e) { out('ERR_' + name, String(e).slice(0, 120)); }
      await sleep(700);
      const s = await server();
      lost[name] = !!(s.yardFloor && s.yardFloor[key]);
    };
    await caseTest('씬바꿈', '21_41', () => toggleDecoScene());
    if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(500); }
    await caseTest('전체화면닫기', '21_42', () => closeInteriorFullscreen());
    openInteriorFullscreen(); await sleep(700);
    await caseTest('앱가려짐', '21_43', () => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    await caseTest('페이지닫힘', '21_44', () => dispatchEvent(new Event('pagehide')));
    out('잃는것0', lost);

    //  ③ 스냅샷 경합 — 칠한 직후 다른 곳 변경이 와서 CUR 이 갈릴 때 내 칸이 사나
    CUR.yardFloor['22_45'] = 'stone';
    if (typeof decoDirty === 'function') decoDirty(); else DB.saveStudent(CUR);
    await sleep(50);
    R.db.ref('classRPG_v3/settings/lastPing').set(Date.now());   // 오프라인이라 await 하면 안 온다(걸려 버린다)
    await sleep(900);
    const s2 = await server();
    out('스냅샷뒤_내칸', !!(s2.yardFloor && s2.yardFloor['22_45']));
    out('학생문서B', JSON.stringify(s2).length);

    //  ④ 되돌리기(DECO-UNDO-1) — 판에 있을 때만
    if (typeof decoUndo === 'function') {
      closeInteriorFullscreen(); await sleep(300); openInteriorFullscreen(); await sleep(700);
      out('다시열면_단계', _decoUndo.length);
      const gold0 = CUR.gold;
      const n0 = (CUR.houseDecorations || []).length;
      SEL_DECO = 'd_y1';
      for (let i = 0; i < 3; i++) _decoPlace('yard', 34, 10 + i);
      out('놓기3_뒤', (CUR.houseDecorations || []).length - n0);
      saves = 0;
      decoUndo(); decoUndo(); decoUndo();
      await sleep(900);
      out('되돌리기3_뒤', (CUR.houseDecorations || []).length - n0);
      out('되돌리기3_쓰기', saves);
      //  치우기 되돌리기
      _decoPlace('yard', 35, 10); SEL_DECO = null;
      const before = (CUR.houseDecorations || []).length;
      _decoPlace('yard', 35, 10);                 // 치우기
      out('치운뒤', (CUR.houseDecorations || []).length - before);
      decoUndo();
      out('치우기되돌림', (CUR.houseDecorations || []).length - before);
      //  바닥 되돌리기
      const key = '36_10'; const prevT = (CUR.yardFloor || {})[key];
      CUR_FLOOR_TILE = 'stone'; _paintFloor(36, 10);
      out('칠한뒤', CUR.yardFloor[key]);
      decoUndo();
      out('바닥되돌림_같나', (CUR.yardFloor || {})[key] === prevT);
      //  20단계 상한
      for (let i = 0; i < 25; i++) _paintFloor(37, i);
      out('25번뒤_단계', _decoUndo.length);
      out('골드그대로', CUR.gold === gold0);
      //  씬 바꾸면 0
      toggleDecoScene(); await sleep(300);
      out('씬바꾼뒤_단계', _decoUndo.length);
      toggleDecoScene(); await sleep(300);
    }
    done();
  })().catch(e => { out('ERR', String(e && e.stack || e).slice(0, 300)); done(); });
  function done() { const pre = document.createElement('pre'); pre.id = 'rf-out'; pre.textContent = R.log.join('\n'); document.body.appendChild(pre); document.title = 'RF_DONE'; }
})();
