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

    //  ⑤ 끌어서 연달아 놓기·칠하기(DECO-DRAG-1) — 판에 있을 때만
    if (typeof _decoStrokeApply === 'function') {
      closeInteriorFullscreen(); await sleep(300); openInteriorFullscreen(); await sleep(1200);
      if (!_dCv) { renderHouseDeco(); await sleep(300); }
      out('캔버스있나', !!_dCv);
      const pt = (r, c) => {
        const cv = _dCv;
        const rect = cv.getBoundingClientRect();
        const bx = c * _dC + _dC / 2 - _dPanX, by = r * _dC + _dC / 2 - _dPanY;
        return { clientX: rect.left + bx * rect.width / _dW, clientY: rect.top + by * rect.height / _dH };
      };
      const fire = (type, r, c, id) => _dCv.dispatchEvent(new PointerEvent(type, Object.assign({ pointerId: id || 1, pointerType: 'mouse', bubbles: true }, pt(r, c))));
      const clickAt = (r, c) => _dCv.dispatchEvent(new MouseEvent('click', Object.assign({ bubbles: true }, pt(r, c))));

      //  바닥: 한 줄 10칸 끌기
      setDecoMode('floor'); CUR_FLOOR_TILE = 'brick'; await sleep(200);
      const u0 = _decoUndo.length;
      saves = 0;
      fire('pointerdown', 5, 2);
      for (let c = 3; c <= 11; c++) fire('pointermove', 5, c);
      fire('pointerup', 5, 11); clickAt(5, 11);   // 마우스는 뗄 때 click 이 온다 — 끌기 뒤라 무시돼야 한다
      await sleep(900);
      let painted = 0; for (let c = 2; c <= 11; c++) if ((CUR.yardFloor || {})['5_' + c] === 'brick') painted++;
      out('끌어칠하기_10칸', painted);
      out('끌어칠하기_쓰기', saves);
      out('끌어칠하기_되돌리기단계', _decoUndo.length - u0);
      decoUndo();
      let left = 0; for (let c = 2; c <= 11; c++) if ((CUR.yardFloor || {})['5_' + c] === 'brick') left++;
      out('끌어칠하기_되돌린뒤', left);

      //  빠르게 끌기: 한 번에 8칸 뛰어도 사이가 채워지나
      fire('pointerdown', 7, 2); fire('pointermove', 7, 10); fire('pointerup', 7, 10);
      await sleep(100);
      let gap = 0; for (let c = 2; c <= 10; c++) if ((CUR.yardFloor || {})['7_' + c] !== 'brick') gap++;
      out('빠른끌기_빈칸', gap);
      decoUndo();

      //  장식: 6칸 끌어 놓기
      setDecoMode('deco'); SEL_DECO = 'd_y1'; await sleep(200);
      const n0 = (CUR.houseDecorations || []).length, u1 = _decoUndo.length;
      fire('pointerdown', 12, 2);
      for (let c = 3; c <= 7; c++) fire('pointermove', 12, c);
      fire('pointerup', 12, 7); clickAt(12, 7);
      await sleep(200);
      out('끌어놓기_6개', (CUR.houseDecorations || []).length - n0);
      out('끌어놓기_되돌리기단계', _decoUndo.length - u1);
      decoUndo();
      out('끌어놓기_되돌린뒤', (CUR.houseDecorations || []).length - n0);

      //  빈손 끌기는 여전히 화면 이동(놓인 것 0)
      SEL_DECO = null; await sleep(100);
      const n1 = (CUR.houseDecorations || []).length;
      fire('pointerdown', 14, 2); for (let c = 3; c <= 9; c++) fire('pointermove', 14, c); fire('pointerup', 14, 9); clickAt(14, 9);
      await sleep(200);
      out('빈손끌기_놓인것', (CUR.houseDecorations || []).length - n1);

      //  한 번 누르기(끌지 않음)는 예전처럼 하나
      SEL_DECO = 'd_y1';
      const n2 = (CUR.houseDecorations || []).length;
      fire('pointerdown', 16, 4); fire('pointerup', 16, 4); clickAt(16, 4);
      await sleep(200);
      out('한번누르기_놓인것', (CUR.houseDecorations || []).length - n2);

      //  터치 흉내: 터치는 누르는 순간(touchstart) 첫 칸이 이미 처리된다 → 끌기가 첫 칸을 두 번 하지 않고,
      //  되돌리기도 한 단계로 합쳐져야 한다.
      setDecoMode('floor'); CUR_FLOOR_TILE = 'sand'; await sleep(200);
      const u2 = _decoUndo.length;
      clickAt(9, 2);                         // touchstart 가 부르는 것과 같은 _decoClick
      fire('pointerdown', 9, 2, 7);
      for (let c = 3; c <= 6; c++) fire('pointermove', 9, c, 7);
      fire('pointerup', 9, 6, 7);
      await sleep(100);
      let sand = 0; for (let c = 2; c <= 6; c++) if ((CUR.yardFloor || {})['9_' + c] === 'sand') sand++;
      out('터치끌기_5칸', sand);
      out('터치끌기_되돌리기단계', _decoUndo.length - u2);
      decoUndo();
      let sandLeft = 0; for (let c = 2; c <= 6; c++) if ((CUR.yardFloor || {})['9_' + c] === 'sand') sandLeft++;
      out('터치끌기_되돌린뒤', sandLeft);
      setDecoMode('deco');
    }

    //  ⑥ 장식 찾기(DECO-FIND-1) — 판에 있을 때만
    if (typeof _decoFindMatch === 'function') {
      //  장식 79종을 전부 1개씩 가진 아이로
      const all = GAME_DATA.decorations.filter(d => d.price > 0 && !d.hidden);
      CUR.inventory = all.map(d => ({ id: d.id, qty: 2 }));
      if (DECO_SCENE !== 'indoor') { toggleDecoScene(); await sleep(400); }
      _decoFind.sceneOnly = true; _decoFind.q = '';
      renderDecoInv(); await sleep(100);
      const cnt = () => document.querySelectorAll('#if-deco-inv .deco-card').length;
      out('집안_이장소만', cnt());
      decoFindSet('sceneOnly'); await sleep(50);
      out('집안_다보기', cnt());
      decoFindSet('sceneOnly'); await sleep(50);
      toggleDecoScene(); await sleep(400);
      out('마당_이장소만', cnt());
      decoFindSet('q', '울타리'); await sleep(50);
      out('검색_울타리', cnt());
      decoFindSet('q', '없는이름'); await sleep(50);
      const emp = document.getElementById('if-deco-empty');
      out('없는이름_빈칸글', emp && !emp.hidden ? emp.textContent : '(안 보임)');
      decoFindSet('q', ''); await sleep(50);
      //  최근 놓은 것
      SEL_DECO = all.find(d => d.cat === 'yard' && !(d.size && (d.size.w > 1 || d.size.h > 1)) && !(CUR.houseDecorations || []).some(p => p.id === d.id) && !(typeof ANIM_DECO !== 'undefined' && ANIM_DECO[d.id])).id;
      const before = (CUR.houseDecorations || []).length;
      _decoPlace('yard', 25, 4); await sleep(100);
      out('최근용_놓였나', (CUR.houseDecorations || []).length - before);
      out('최근_저장값', localStorage.getItem('rpg.deco.recent'));
      const quick = document.getElementById('if-deco-quick');
      out('최근줄_보임', !!(quick && !quick.hidden));
      out('최근줄_카드', quick ? quick.querySelectorAll('.deco-card').length : 0);
      //  서랍 펼치기
      const body = document.getElementById('if-deco-body');
      const h0 = body.getBoundingClientRect().height;
      decoDrawerToggle(); await sleep(100);
      const h1 = body.getBoundingClientRect().height;
      out('서랍_접힘높이', Math.round(h0));
      out('서랍_펼침높이', Math.round(h1));
      decoDrawerToggle();
      out('DB쓰기_찾기동안', 'localStorage만');
    }
    done();
  })().catch(e => { out('ERR', String(e && e.stack || e).slice(0, 300)); done(); });
  function done() { const pre = document.createElement('pre'); pre.id = 'rf-out'; pre.textContent = R.log.join('\n'); document.body.appendChild(pre); document.title = 'RF_DONE'; }
})();
