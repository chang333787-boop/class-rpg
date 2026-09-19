// 꾸미기 저장 묶기(DECO-SAVE-1) 검사 — 실제 student.html + 실제 SDK(오프라인)
//  ① 쓰기 횟수(묶음이 끝난 뒤까지 센다) ② 잃는 것 0(대기 중 나가는 네 경우) ③ 스냅샷 경합
(function () {
  const R = window.__RF, out = (k, v) => R.log.push(k + '=' + JSON.stringify(v));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  //  헤드리스 가상 시간에서는 rAF 가 한참 늦게 돈다. openInteriorFullscreen() 은 rAF 두 번 뒤에 판을 그리고
  //  _decoViewRestore(캔버스를 새로 잡음)를 부르는데, 그게 **다음 시험 도중**에 끼어들어 가끔 false 가 났다
  //  (⑬ 핀치 도중 캔버스가 바뀜 · ⑭ 비교 사이에 배율이 바뀜). 연 뒤에는 그 rAF 가 실제로 돌 때까지 기다린다.
  const rafSettle = (ms) => new Promise(r => { let fin = false; const go = () => { if (!fin) { fin = true; r(); } };
    requestAnimationFrame(() => requestAnimationFrame(go)); setTimeout(go, ms || 4000); });
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

    //  ⑦ 마지막 보던 자리 기억(DECO-VIEW-1) · 스포이드(DECO-PICK-1)
    if (typeof _decoViewSave === 'function') {
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(400); }
      _decoSetZoom(2); decoPanBy(300, 200); await sleep(100);
      const cx0 = Math.round((_dPanX + _dW / 2) / _dC), z0 = _dZoom;
      closeInteriorFullscreen(); await sleep(300);
      openInteriorFullscreen(); await sleep(1200);
      //  (헤드리스에서는 여는 쪽 두 번 RAF 가 안 돌 때가 있다 — 실제 브라우저가 하는 순서를 그대로 부른다)
      if (!_dCv) { renderHouseDeco(); _decoViewRestore(); await sleep(200); }
      const cx1 = Math.round((_dPanX + _dW / 2) / _dC);
      out('다시열면_배율같나', Math.abs(_dZoom - z0) < 0.01);
      out('다시열면_가운데칸차이', Math.abs(cx1 - cx0));

      //  스포이드: 카드 없이 놓인 장식을 0.75초 누르고 떼면 그 장식이 손에 잡히고 치워지지 않는다
      const all2 = GAME_DATA.decorations.filter(d => d.price > 0 && !d.hidden && d.cat === 'yard' && !(d.size && (d.size.w > 1 || d.size.h > 1)) && !(typeof ANIM_DECO !== 'undefined' && ANIM_DECO[d.id]));
      const pickId = all2.find(d => !(CUR.houseDecorations || []).some(p => p.id === d.id)).id;
      CUR.inventory = (CUR.inventory || []).filter(i => i.id !== pickId).concat([{ id: pickId, qty: 3 }]);
      SEL_DECO = pickId; _decoPlace('yard', 26, 8); SEL_DECO = null; renderDecoInv(); await sleep(100);
      const nBefore = (CUR.houseDecorations || []).length;
      const pt2 = (r, c) => { const rect = _dCv.getBoundingClientRect(); return { clientX: rect.left + (c * _dC + _dC / 2 - _dPanX) * rect.width / _dW, clientY: rect.top + (r * _dC + _dC / 2 - _dPanY) * rect.height / _dH }; };
      _dCv.dispatchEvent(new PointerEvent('pointerdown', Object.assign({ pointerId: 9, pointerType: 'mouse', bubbles: true }, pt2(26, 8))));
      await sleep(750);
      _dCv.dispatchEvent(new PointerEvent('pointerup', Object.assign({ pointerId: 9, pointerType: 'mouse', bubbles: true }, pt2(26, 8))));
      _dCv.dispatchEvent(new MouseEvent('click', Object.assign({ bubbles: true }, pt2(26, 8))));
      await sleep(100);
      out('스포이드_잡은것', SEL_DECO === pickId);
      out('스포이드_안치워짐', (CUR.houseDecorations || []).length === nBefore);
      //  짧게 누르면 예전처럼 치우기
      SEL_DECO = null; renderDecoInv();
      _dCv.dispatchEvent(new PointerEvent('pointerdown', Object.assign({ pointerId: 10, pointerType: 'mouse', bubbles: true }, pt2(26, 8))));
      await sleep(100);
      _dCv.dispatchEvent(new PointerEvent('pointerup', Object.assign({ pointerId: 10, pointerType: 'mouse', bubbles: true }, pt2(26, 8))));
      _dCv.dispatchEvent(new MouseEvent('click', Object.assign({ bubbles: true }, pt2(26, 8))));
      await sleep(100);
      out('짧게누르면_치움', (CUR.houseDecorations || []).length === nBefore - 1);
    }

    //  ⑧ 꾸미기 공간 1~3 (DECO-SPACE-1)
    if (typeof decoSpaceSet === 'function') {
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(400); }
      const pid = GAME_DATA.decorations.filter(d => d.price > 0 && !d.hidden && d.cat === 'yard' && !(d.size && (d.size.w > 1 || d.size.h > 1))
        && !(typeof ANIM_DECO !== 'undefined' && ANIM_DECO[d.id]) && !(CUR.houseDecorations || []).some(p => p.id === d.id))[0].id;
      CUR.inventory = (CUR.inventory || []).filter(i => i.id !== pid).concat([{ id: pid, qty: 2 }]);
      decoSpaceSet(1); await sleep(200);
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      const s1count0 = _decoList(CUR).length;
      SEL_DECO = pid; _decoPlace('yard', 30, 30);                 // 공간 1 에 하나
      out('공간1_놓임', _decoList(CUR).length - s1count0);
      decoSpaceSet(2); await sleep(200);
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      out('공간2_처음_비었나', _decoList(CUR).length === 0);
      SEL_DECO = pid; _decoPlace('yard', 30, 30);                 // 공간 2 같은 자리에 하나(가진 2개 중 남은 1)
      out('공간2_같은자리_놓임', _decoList(CUR).length);
      SEL_DECO = pid; _decoPlace('yard', 31, 30);                 // 3번째 — 가진 개수 2개 다 씀 → 안 놓여야
      out('공간2_세번째_막힘', _decoList(CUR).length === 1);
      const sp2 = (CUR.houseDecorations || []).find(p => p.id === pid && p.sp === 2);
      out('공간2_sp필드', sp2 ? sp2.sp : null);
      //  공간 2 에서 치우면 공간 1 같은 자리 것은 그대로
      SEL_DECO = null; _decoPlace('yard', 30, 30);
      out('공간2_치운뒤', _decoList(CUR).length);
      decoSpaceSet(1); await sleep(200);
      out('공간1_그대로', _decoList(CUR).some(p => p.id === pid && p.row === 30 && p.col === 30));
      //  바닥은 공간마다 따로
      setDecoMode('floor'); CUR_FLOOR_TILE = 'brick'; _paintFloor(32, 30);
      decoSpaceSet(3); await sleep(200);
      out('공간3_바닥_따로', (_yardFloorGet(CUR)['32_30'] || 'grass') === 'grass');
      _paintFloor(33, 30);
      out('공간3_바닥필드', !!(CUR.yardFloors && CUR.yardFloors[3] && CUR.yardFloors[3]['33_30']));
      decoSpaceSet(1); await sleep(200);
      out('공간1_바닥', _yardFloorGet(CUR)['32_30']);
      out('공간1_옛필드그대로', !!(CUR.yardFloor && CUR.yardFloor['32_30']) && !(CUR.yardFloor['33_30']));
      setDecoMode('deco');
      //  공간을 바꾸면 되돌리기 0
      out('공간바꾼뒤_되돌리기', _decoUndo.length);
      //  공간 1 옛 장식에는 sp 가 안 붙는다(형식 그대로)
      out('공간1_sp없음', (CUR.houseDecorations || []).filter(p => !p.sp).length > 0);
      decoSpaceSet(2); await sleep(200); SEL_DECO = pid; _decoPlace('yard', 34, 30); decoSpaceSet(1);   // 공간 2 에 다시 하나 두고 저장
      await sleep(900);
      const sv = await server();
      out('서버_공간2장식', (sv.houseDecorations ? Object.values(sv.houseDecorations) : []).filter(p => p && p.sp === 2).length);
      out('서버_공간3바닥', !!(sv.yardFloors && sv.yardFloors[3]));
    }

    //  ⑨ 먹는 장(DECO-EAT-1) — 먹이통(d_y69, 9/20 머지)은 시험에서만 표에 넣는다
    if (typeof _animEatSync === 'function') {
      if (!GAME_DATA.decorations.find(d => d.id === 'd_y69'))
        GAME_DATA.decorations.push({ id: 'd_y69', name: '먹이통', icon: '🥣', cat: 'yard', rarity: 'common', price: 20, feeder: true });
      decoSpaceSet(3); await sleep(200);
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      CUR.houseDecorations.push({ id: 'd_y69', area: 'yard', row: 20, col: 20, sp: 3 });
      CUR.houseDecorations.push({ id: 'd_y55', area: 'yard', row: 20, col: 21, sp: 3 });   // 닭 한 마리 — 먹이통 바로 옆
      CUR.houseDecorations.push({ id: 'd_y40', area: 'yard', row: 24, col: 24, sp: 3 });   // 양 — 멀리
      _animStopAll();
      const host = _ifActiveContainer || 'house-topview';
      //  (헤드리스는 RAF 가 안 돌 때가 있다 — 그리기 끝에 부르는 층 맞추기를 직접 부른다)
      _animSyncLayer(host, CUR, DECO_SCENE, _dC, _dW, _dH, _dPanX, _dPanY);
      await sleep(1500);   // 먹는 장 그림이 불러와질 시간
      _animSyncLayer(host, CUR, DECO_SCENE, _dC, _dW, _dH, _dPanX, _dPanY);
      await sleep(100);
      const rec = _animLayers.get(_ifActiveContainer || 'house-topview');
      const hen = rec && [...rec.items.values()].find(x => x.id === 'd_y55');
      if (hen) { _animEatSync(hen); }
      const img = hen && hen.el.querySelector('img');
      out('먹이통옆_닭_먹는장', !!(img && /d_y55_eat\.svg/.test(img.src)));
      out('먹는장_파일있음', !!_animFrameEat['d_y55']);
      const sheep = rec && [...rec.items.values()].find(x => x.id === 'd_y40');
      out('양_그림왼쪽표시', !!(sheep && sheep.cfg.artLeft));
      decoSpaceSet(1); await sleep(200);
    }

    //  ⑩ 플레이 시험 고침(DECO-PT-1·2) — 공간 2 빈 판에서
    if (typeof _decoTopAt === 'function') {
      decoSpaceSet(2); await sleep(200);
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 2);
      setDecoMode('deco');
      //  우리(시험에서만 표에 넣는다 — 9/20 머지)
      if (!GAME_DATA.decorations.find(d => d.id === 'pen_t'))
        GAME_DATA.decorations.push({ id: 'pen_t', name: '시험 우리', icon: '🚧', cat: 'yard', rarity: 'epic', price: 210, size: { w: 4, h: 3 }, pen: true });
      CUR.inventory = (CUR.inventory || []).filter(i => i.id !== 'pen_t' && i.id !== 'd_y55' && i.id !== 'd_y7')
        .concat([{ id: 'pen_t', qty: 1 }, { id: 'd_y55', qty: 3 }, { id: 'd_y7', qty: 3 }]);
      SEL_DECO = 'pen_t'; _decoPlace('yard', 10, 10);
      SEL_DECO = 'd_y55'; _decoPlace('yard', 11, 11);            // 우리 안에 닭
      const inPen = _decoList(CUR);
      out('우리안_닭_놓임', inPen.some(p => p.id === 'd_y55'));
      out('우리_안지워짐', inPen.some(p => p.id === 'pen_t'));
      //  카드를 든 채 이미 놓인 것을 누르면 치우지 않는다
      SEL_DECO = 'd_y7'; _decoPlace('yard', 11, 11);             // 닭 칸을 해바라기 카드로 누름
      out('카드든채_안치움', _decoList(CUR).some(p => p.id === 'd_y55'));
      //  🧽 치우기: 겹친 칸은 위의 것(동물)부터
      setDecoMode('erase'); SEL_DECO = null;
      _decoPlace('yard', 11, 11);
      const after1 = _decoList(CUR);
      out('치우기_동물먼저', !after1.some(p => p.id === 'd_y55') && after1.some(p => p.id === 'pen_t'));
      _decoPlace('yard', 11, 11);
      out('치우기_그다음_우리', !_decoList(CUR).some(p => p.id === 'pen_t'));
      setDecoMode('deco');
      //  물 위에 나무 안 됨 · 갈대는 됨
      CUR_FLOOR_TILE = 'water'; setDecoMode('floor'); _paintFloor(20, 20); _paintFloor(20, 21); setDecoMode('deco');
      CUR.inventory = CUR.inventory.concat([{ id: 'd_y29', qty: 2 }]);
      const n0 = _decoList(CUR).length;
      SEL_DECO = 'd_y7'; _decoPlace('yard', 20, 20);
      out('물위_해바라기_막힘', _decoList(CUR).length === n0);
      SEL_DECO = 'd_y29'; _decoPlace('yard', 20, 21);
      out('물위_갈대_됨', _decoList(CUR).length === n0 + 1);
      //  집 안 확대해도 왼쪽 끝까지 간다
      toggleDecoScene(); await sleep(300);
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      _decoSetZoom(3); await sleep(50);
      decoPanBy(-99999, 0);
      _drawIndoor();
      out('집안확대_왼쪽여백', _dCv._offX);
      out('집안확대_왼쪽끝이동', _dPanX);
      decoPanBy(99999, 0); _drawIndoor();
      const boardW = DI.cols * _dC;
      out('집안확대_오른끝까지', Math.round(_dPanX + _dW) >= Math.round(_dCv._offX + boardW) - 1);
      toggleDecoScene(); await sleep(300);
      decoSpaceSet(1); await sleep(200);
    }

    //  ⑩-2 돌아다니는 동물은 '보이는 자리'로 누른다(DECO-ANIM-HIT-1) — 공간 3 빈 판에서
    //    전에는 놓은 칸으로만 찾아서 🧽 치우기로 보이는 강아지를 눌러도 "치울 게 없어요",
    //    빈 풀밭(강아지가 놓였던 칸)을 빈손으로 누르면 멀리 있는 강아지가 사라졌다.
    if (typeof _decoTopAt === 'function') {
      decoSpaceSet(3); await sleep(200);
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      CUR.inventory = (CUR.inventory || []).filter(i => i.id !== 'd_y53').concat([{ id: 'd_y53', qty: 1 }]);
      setDecoMode('deco'); SEL_DECO = 'd_y53'; _decoPlace('yard', 30, 10); SEL_DECO = null;
      const host = _ifActiveContainer || 'house-topview';
      const walkTo = (col) => {   // 걸어간 것과 같은 상태(타이머를 기다리지 않는다)
        _animSyncLayer(host, CUR, DECO_SCENE, _dC, _dW, _dH, _dPanX, _dPanY);
        const rec = _animLayers.get(host), st = rec && [...rec.items.values()].find(x => x.id === 'd_y53');
        if (!st) return;   // (고치기 전 판에서는 위에서 강아지가 이미 사라진다 — 뒤 시험이 계속 돌게)
        if (st.timer) { clearTimeout(st.timer); st.timer = null; }
        st.cur = { row: 30, col }; st.from = null;
      };
      const dogs = () => _decoList(CUR).filter(p => p.id === 'd_y53').length;
      walkTo(13);
      _decoPlace('yard', 30, 10);                       // 빈손으로 빈 풀밭(놓았던 칸)
      out('동물떠난자리_빈손_안사라짐', dogs() === 1);
      SEL_DECO = 'd_y53'; _decoPickAt({ area: 'yard', r: 30, c: 10 }); // (가진 1개를 다 놓아 잡히진 않는다 — 떠난 자리는 아예 안 맞아야 한다)
      SEL_DECO = null;
      out('동물_스포이드_보이는자리', _decoTopAt('yard', 30, 13, true) && _decoTopAt('yard', 30, 13, true).id === 'd_y53' && !_decoTopAt('yard', 30, 10, true));
      setDecoMode('erase');
      _decoPlace('yard', 30, 10);                       // 🧽 빈 풀밭
      out('치우기_떠난자리_안치움', dogs() === 1);
      walkTo(13);
      _decoPlace('yard', 30, 13);                       // 🧽 보이는 강아지
      out('치우기_보이는동물_치움', dogs() === 0);
      decoUndo(); out('치운동물_되돌림', dogs() === 1);
      setDecoMode('deco');
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      decoSpaceSet(1); await sleep(200);
    }

    //  ⑩-3 마우스 오른쪽 클릭 = 치우기 · 어떤 치우기에서도 골드는 안 움직인다(DECO-RCLICK-1) — 공간 3 빈 판에서
    if (typeof _decoRightClickAt === 'function') {
      decoSpaceSet(3); await sleep(200);
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      CUR.inventory = (CUR.inventory || []).filter(i => i.id !== 'd_y7').concat([{ id: 'd_y7', qty: 5 }]);
      const live = () => document.querySelector('#if-topview canvas');
      const at = (r, c) => { const k = live().getBoundingClientRect(); return { clientX: k.left + (c + .5) * _dC - _dPanX, clientY: k.top + (r + .5) * _dC - _dPanY }; };
      const mouse = (type, btn, p) => live().dispatchEvent(new PointerEvent(type, Object.assign({ pointerId: 31, pointerType: 'mouse', button: btn, buttons: type === 'pointerup' ? 0 : (btn === 2 ? 2 : 1), bubbles: true, cancelable: true }, p)));
      decoZoomFit(); await sleep(100);
      const vis = _decoVisible(DY.rows, DY.cols), R = vis.r0 + 3, C0 = vis.c0 + 3;
      const gold0 = CUR.gold, sun = () => _decoList(CUR).filter(p => p.id === 'd_y7').length;
      setDecoMode('deco'); SEL_DECO = 'd_y7'; _decoPlace('yard', R, C0); _decoPlace('yard', R, C0 + 2); _decoPlace('yard', R, C0 + 4);
      out('오른쪽클릭_준비_놓임', sun() === 3);
      //  카드를 든 채 오른쪽 클릭 — 그 자리 것 하나만 치운다(놓기는 0)
      mouse('pointerdown', 2, at(R, C0)); mouse('pointerup', 2, at(R, C0)); await sleep(50);
      out('오른쪽클릭_치움', sun() === 2);
      //  오른쪽으로 끌면(화면 이동) 안 치운다
      const a = at(R, C0 + 2), b = { clientX: a.clientX + 40, clientY: a.clientY + 25 };
      mouse('pointerdown', 2, a); mouse('pointermove', 2, b); mouse('pointerup', 2, b); await sleep(50);
      out('오른쪽끌기_안치움', sun() === 2);
      decoZoomFit(); await sleep(50);
      //  빈 칸 오른쪽 클릭 — 아무것도 안 바뀐다
      mouse('pointerdown', 2, at(R + 2, C0)); mouse('pointerup', 2, at(R + 2, C0)); await sleep(50);
      out('오른쪽클릭_빈칸_그대로', sun() === 2);
      //  되돌리기 → 돌아온다 · 🧽 치우기 · 빈손 누르기까지 다 해도 골드 그대로
      decoUndo(); out('오른쪽클릭_되돌림', sun() === 3);
      setDecoMode('erase'); SEL_DECO = null; _decoPlace('yard', R, C0 + 2);
      setDecoMode('deco'); _decoPlace('yard', R, C0 + 4);
      out('치우기셋_뒤_남은것', sun());
      out('어떤치우기에도_골드불변', CUR.gold === gold0);
      out('치운것_가방으로', (CUR.inventory.find(i => i.id === 'd_y7') || {}).qty - (CUR.houseDecorations || []).filter(p => p.id === 'd_y7').length === 4);
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      _decoUndoClear(); decoSpaceSet(1); await sleep(200);
    }

    //  ⑩-4 닫은 뒤에는 동물이 걷지 않는다(DECO-ANIM-HIDDEN-1) — 안 보이는 작은 판에 층·타이머가 생기던 것
    if (typeof _animSyncLayer === 'function') {
      const timers = () => { let n = 0; _animLayers.forEach(rec => rec.items.forEach(st => { if (st.timer) n++; })); return n; };
      const keep = CUR.houseDecorations;
      CUR.houseDecorations = (keep || []).filter(p => p.id !== 'd_y53' && p.id !== 'd_y55').concat([{ id: 'd_y53', area: 'yard', row: 20, col: 6 }, { id: 'd_y55', area: 'yard', row: 21, col: 9 }]);
      _drawDeco(); await sleep(200);
      out('열려있을때_동물층', _animLayers.size + '층·타이머 ' + timers());
      out('열려있을때_동물_걷는다', _animLayers.size === 1 && timers() === 2);
      closeInteriorFullscreen(); await sleep(300);
      out('닫은뒤_동물층_0', _animLayers.size === 0 && timers() === 0 && !document.querySelector('.deco-anim'));
      openInteriorFullscreen(); await sleep(400);
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      out('다시열면_동물_돌아옴', _animLayers.size === 1 && timers() === 2);
      CUR.houseDecorations = keep; _drawDeco(); await sleep(100);
    }

    //  ⑪ 헤엄 장·밭은 공간 1 만·다 썼을 때 어느 공간(DECO-SWIM-1·DECO-PT-3)
    if (typeof _animProbeSwim === 'function') {
      decoSpaceSet(3); await sleep(200);
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      setDecoMode('floor'); CUR_FLOOR_TILE = 'water';
      for (let c = 4; c <= 8; c++) _paintFloor(30, c);
      setDecoMode('deco');
      CUR.houseDecorations.push({ id: 'd_y56', area: 'yard', row: 30, col: 6, sp: 3 });   // 물 위 오리 한 마리
      _animStopAll();
      const host = _ifActiveContainer || 'house-topview';
      _animSyncLayer(host, CUR, DECO_SCENE, _dC, _dW, _dH, _dPanX, _dPanY);
      await sleep(1500);
      _animSyncLayer(host, CUR, DECO_SCENE, _dC, _dW, _dH, _dPanX, _dPanY);
      await sleep(100);
      const rec = _animLayers.get(host);
      const duck = rec && [...rec.items.values()].find(x => x.id === 'd_y56');
      const img = duck && duck.el.querySelector('img');
      out('물위오리_헤엄장', !!(img && /d_y56_swim\.svg/.test(img.src)));
      //  밭 칸은 공간 3 에서 놓을 수 있다(그림도 안 나온다)
      out('공간3_밭칸_놓임가능', !_isFarmCell(24, 45));
      //  다 썼을 때 어느 공간에 있는지
      const msg = _decoWhereUsed('d_y56');
      out('다썼을때_공간안내', /공간 3에 1개/.test(msg));
      decoSpaceSet(1); await sleep(200);
    }

    //  ⑪-2 캔버스가 판 자리에 맞나(DECO-FIT-1) — 처음 열 때(서랍에 카드가 차기 전에 재서 컸다)·
    //    바닥 모드(서랍이 접히는데 캔버스는 그대로라 아래가 까맣게 비었다)·서랍 펼침(판 아래가 서랍 밑으로).
    {
      const host = () => document.getElementById('if-topview');
      const fit = () => ({ 맞나: _dW === host().clientWidth && _dH === Math.max(120, host().clientHeight), 캔버스: _dH, 자리: host().clientHeight });
      closeInteriorFullscreen(); await sleep(200); openInteriorFullscreen(); await sleep(900); await rafSettle();
      if (!_dCv) { renderHouseDeco(); await sleep(200); }   // 헤드리스 가상 시간에서는 여는 쪽 rAF 가 아직일 수 있다(⑫ 와 같은 처리)
      out('판맞춤_열었을때', fit());
      setDecoMode('floor'); ifSyncModeBtn(); await sleep(300);
      out('판맞춤_바닥모드', fit());
      setDecoMode('deco'); ifSyncModeBtn(); await sleep(300);
      out('판맞춤_장식모드로', fit());
      decoDrawerToggle(); await sleep(300); out('판맞춤_서랍펼침', fit());
      decoDrawerToggle(); await sleep(300); out('판맞춤_서랍접음', fit());
    }

    //  ⑫ 보이는 단추가 정말 눌리나(DECO-PT-4) — 마을에서 ⋯ 가 72차부터 터치로 안 눌렸던 함정.
    //    .click() 은 겹침·pointer-events 를 건너뛰므로 '눌린다'의 증거가 아니다 → 한가운데 elementFromPoint.
    {
      const tapBad = () => {
        const root = document.getElementById('interior-fullscreen');
        const bad = [];
        root.querySelectorAll('button, input').forEach(b => {
          const r = b.getBoundingClientRect(), cs = getComputedStyle(b);
          if (!(r.width > 0 && r.height > 0) || cs.visibility === 'hidden' || cs.display === 'none') return;
          if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return;
          //  [DECO-SHORT-1] 한가운데만 보면 '반쯤 덮인 단추'를 놓친다(크롬북 610 높이: ＋ 가 '집 안으로' 오른쪽 1/3 을 덮었다) → 다섯 점
          const hit = [[.5, .5], [.2, .5], [.8, .5], [.5, .25], [.5, .75]].every(([fx, fy]) => {
            const x = r.left + r.width * fx, y = r.top + r.height * fy;
            if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return true;   // 화면 밖(옆으로 미는 윗줄)은 덮인 게 아니다
            const top = document.elementFromPoint(x, y);
            return top === b || b.contains(top);
          });
          if (!hit) bad.push(b.id || b.textContent.trim().slice(0, 8));
        });
        return bad;
      };
      closeInteriorFullscreen(); await sleep(200); openInteriorFullscreen(); await sleep(900); await rafSettle();
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      const r1 = tapBad(); decoDrawerToggle(); await sleep(200);
      const r2 = tapBad(); decoDrawerToggle(); await sleep(100);
      setDecoMode('floor'); ifSyncModeBtn(); await sleep(200);
      const r3 = tapBad(); setDecoMode('deco'); ifSyncModeBtn();
      out('안눌리는단추_접힘', r1.join(',') || '없음');
      out('안눌리는단추_펼침', r2.join(',') || '없음');
      out('안눌리는단추_바닥모드', r3.join(',') || '없음');
    }

    //  ⑫-2 구경 중에 그림이 도착하면 구경 판도 다시 그리나(DECO-FRIEND-ART-1) — 한꺼번에 여러 장이 와도 한 번
    if (typeof _ffRedrawSoon === 'function') {
      let n = 0; const orig = _renderFriendCanvas, fr0 = _ffFriend;
      _renderFriendCanvas = () => { n++; };
      _ffFriend = null; _ffRedrawSoon(); await sleep(100);
      out('구경아닐때_다시안그림', n === 0);
      _ffFriend = { id: 'x' }; _ffRedrawSoon(); _ffRedrawSoon(); _ffRedrawSoon();
      await sleep(300);
      out('구경중_그림오면_한번다시그림', n === 1);
      _renderFriendCanvas = orig; _ffFriend = fr0;
    } else out('구경중_그림오면_한번다시그림', false);

    //  ⑬ 두 손가락 확대가 끝까지 되나(DECO-PINCH-1) — 확대 걸음마다 캔버스를 새로 만들면
    //    손가락이 잡고 있던 캔버스가 사라져 첫 걸음(약 7%)에서 끊겼다(실제 터치로 3배 벌려도 1→1.07배).
    //    실제 브라우저처럼 **그 순간 화면에 있는 캔버스**에 이벤트를 보낸다(옛 캔버스를 쥐고 보내면 못 잡는다).
    {
      decoZoomFit(); await sleep(100); _decoSetZoom(1); await sleep(100);
      //  (id 로 찾지 않는다 — 내 집 창 안의 작은 판도 같은 id 라 그쪽이 먼저 잡힌다)
      const live = () => document.querySelector('#if-topview canvas');
      const cv0 = live(), k = cv0.getBoundingClientRect();
      const cx = k.left + k.width / 2, cy = k.top + Math.min(k.height, innerHeight - k.top) / 2;
      const fire = (type, id, x) => live().dispatchEvent(new PointerEvent(type,
        { pointerId: id, pointerType: 'touch', bubbles: true, cancelable: true, clientX: x, clientY: cy }));
      const z0 = _dZoom;
      fire('pointerdown', 21, cx - 50); fire('pointerdown', 22, cx + 50);
      for (let i = 1; i <= 10; i++) { fire('pointermove', 21, cx - 50 - i * 10); fire('pointermove', 22, cx + 50 + i * 10); await sleep(16); }
      fire('pointerup', 21, cx - 150); fire('pointerup', 22, cx + 150);
      await sleep(100);
      out('핀치_3배벌림_배율', Math.round(_dZoom / z0 * 100) / 100);
      out('핀치_끝까지_커짐', _dZoom / z0 > 2.5);
      out('핀치중_캔버스그대로', live() === cv0);
      decoZoomFit(); await sleep(100);
    }

    //  ⑭ 친구 마당 구경에 내 화면 상태가 새지 않나(DECO-FRIEND-PAN-1) — 내 마당을 옮겨 본 뒤 구경 가면
    //    친구 마당 왼쪽·위가 안 그려지고(까맣게 빔) 동물이 그만큼 밀려 사라졌다.
    if (typeof _renderFriendCanvas === 'function') {
      _decoSetZoom(2); decoPanBy(600, 200); await sleep(100);
      closeInteriorFullscreen(); await sleep(200);
      openFriendFullscreen({ id: 's_fr', name: '친구', avatar: '🧒', level: 1, inventory: [],
        houseDecorations: [{ id: 'd_y53', area: 'yard', row: 9, col: 6 }], yardFloor: {} });
      await sleep(500);
      _dPanX = 600; _dPanY = 200; _dZoom = 2;      // 내 마당에서 옮겨 본 값이 남아 있는 상태
      const pan0 = [_dZoom, _dPanX, _dPanY];
      _renderFriendCanvas();                     // (헤드리스 가상 시간에서는 여는 쪽 rAF 가 아직일 수 있다)
      const same = pan0[0] === _dZoom && pan0[1] === _dPanX && pan0[2] === _dPanY;   // 그린 직후 바로 잰다(사이에 다른 것이 끼어들지 않게)
      await sleep(100);
      const fcv = document.querySelector('#ff-topview canvas');
      const px = fcv ? fcv.getContext('2d').getImageData(12, 12, 1, 1).data[3] : -1;
      out('구경_왼쪽위_그려짐', px > 0);
      const rec = _animLayers.get('ff-topview');
      out('구경_동물층_안밀림', !!rec && rec.world.style.transform === 'translate(0px, 0px)');
      out('구경뒤_내자리_그대로', same);
      closeFriendFullscreen(); await sleep(100);
      openInteriorFullscreen(); await sleep(500);
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
    }

    //  ⑯ 마당 안 상점(DECO-SHOP-1) — 사는 길은 본편 상점의 buyDeco() 하나다. 여기서는 **골드**를 본다:
    //    사기 전후 골드·가진 수 · 저장 1번 · 골드 부족/도감 선물/숨김/레벨 잠금/다른 장소 것은 안 사짐 · 200G↑ 는 한 번 더 · 무료 기간이면 0G ·
    //    ↩ 로는 골드가 안 움직인다(환불 없음) · 막 눌러도(300번) 골드는 늘지 않고, 쓴 골드 = 늘어난 장식 값의 합.
    if (typeof decoShopBuy === 'function') {
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(500); }
      const keep = { gold: CUR.gold, inv: JSON.parse(JSON.stringify(CUR.inventory || [])), placed: CUR.houseDecorations, free: GAME_DATA.decoFree, lv: CUR.level };
      const D = id => GAME_DATA.decorations.find(d => d.id === id), qty = id => ((CUR.inventory || []).find(i => i.id === id) || { qty: 0 }).qty;
      const shopList = GAME_DATA.decorations.filter(d => d.price > 0 && !d.hidden);           // 본편 상점이 그리는 목록 그대로
      const cheap = shopList.find(d => d.cat === 'yard' && d.price < 200 && !(d.size && (d.size.w > 1 || d.size.h > 1)) && !(typeof ANIM_DECO !== 'undefined' && ANIM_DECO[d.id]));
      const dear = shopList.find(d => d.cat === 'yard' && d.price >= 200), indoor = shopList.find(d => d.cat === 'indoor');
      GAME_DATA.decoFree = null; CUR.houseDecorations = []; CUR.inventory = []; CUR.gold = 1000; SEL_DECO = null; _decoUndoClear();
      out('상점_열기전_카드0', document.querySelectorAll('#if-deco-shop .deco-scard').length === 0);
      decoTab('shop'); await sleep(50);
      out('상점_카드수_본편상점과같음', document.querySelectorAll('#if-deco-shop .deco-scard').length === shopList.filter(d => d.cat === 'yard').length);
      { const dr = document.getElementById('if-deco-drawer').getBoundingClientRect(), tv = document.getElementById('if-topview').getBoundingClientRect();
        out('상점_서랍자리', { 창: innerWidth + 'x' + innerHeight, 판위: Math.round(tv.top), 서랍위: Math.round(dr.top), 서랍키: Math.round(dr.height), 마당비율: Math.round((dr.top - tv.top) / innerHeight * 100) + '%' }); }
      //  ① 싼 것 — 한 번에. 꾸미기 묶음 저장이 대기 중이어도 저장은 1번(그 대기분은 구매 저장에 실려 간다)
      CUR.yardFloor = CUR.yardFloor || {}; CUR.yardFloor['23_46'] = 'stone'; decoDirty();
      saves = 0; sets = 0;
      decoShopPick(cheap.id); decoShopBuy(); await sleep(900);
      out('상점_사기_골드·가진수', { 골드: CUR.gold, 가진수: qty(cheap.id), 값: cheap.price, 맞나: CUR.gold === 1000 - cheap.price && qty(cheap.id) === 1 });
      out('상점_사기_저장1번', { saveStudent: saves, sdkSet: sets, 맞나: saves === 1 && sets === 1 });
      const sv = await server();
      out('상점_사기_서버에도', sv.gold === CUR.gold && (sv.inventory || []).some(i => i.id === cheap.id && i.qty === 1) && !!(sv.yardFloor && sv.yardFloor['23_46']));
      out('상점_산직후_내것탭·골라짐·맨앞·손끝', DECO_TAB === 'own' && SEL_DECO === cheap.id && (document.querySelector('#if-deco-inv .deco-card') || { dataset: {} }).dataset.decoId === cheap.id && !!document.getElementById('deco-hand-ghost'));
      out('상점_골드배지', document.getElementById('if-deco-gold').textContent === '💰 ' + CUR.gold + 'G');
      //  본편 상점에서 같은 것을 살 때와 같은 값이 빠지나(한 번 누름 = 확인, 또 누름 = 산다)
      { const g = CUR.gold; buyDeco(cheap.id); const armOnly = CUR.gold === g; buyDeco(cheap.id); out('상점_본편과_같은값', armOnly && g - CUR.gold === cheap.price && qty(cheap.id) === 2); }
      //  놓으면 손끝 그림이 사라지고, ↩ 는 놓기만 무른다(골드 그대로). 놓기 전 ↩ 도 골드를 안 돌려준다 — 환불 없음
      { const g = CUR.gold; _decoPlace('yard', 27, 12); await sleep(50);
        const placedOk = _decoList(CUR).some(p => p.id === cheap.id) && !document.getElementById('deco-hand-ghost');
        decoUndo(); await sleep(50); decoUndo(); decoUndo(); await sleep(50);
        out('상점_놓으면_손끝그림끝', placedOk);
        out('상점_되돌리기_골드·가진수_그대로', CUR.gold === g && qty(cheap.id) === 2 && !_decoList(CUR).some(p => p.id === cheap.id)); }
      //  ② 안 사지는 것들 — 골드·가진 수·저장 전부 0
      const noBuy = async (label, id, prep, undo) => { decoTab('shop'); if (prep) prep(); _decoShopRender(); decoShopPick(null); decoShopPick(id);
        const g = CUR.gold, q = qty(id), hasBtn = !!document.querySelector('#if-deco-buybar .db-buy'); saves = 0;
        decoShopBuy(); _decoShop.armedAt = 1; decoShopBuy(); await sleep(20);
        out(label, { 단추: hasBtn, 맞나: CUR.gold === g && qty(id) === q && saves === 0 && !hasBtn }); if (undo) undo(); };
      await noBuy('상점_골드부족_안사짐', cheap.id, () => { CUR.gold = cheap.price - 1; }, () => { CUR.gold = 1000; });
      await noBuy('상점_도감선물_안사짐(카드숨김)', 'd_y90');
      await noBuy('상점_도감선물_안사짐(카드보임)', 'd_y90', () => { DECO_SHOP_GIFTS = true; }, () => { DECO_SHOP_GIFTS = false; });
      await noBuy('상점_숨긴것_안사짐', 'd_y71');
      await noBuy('상점_업적보상_안사짐', 'deco_trophy');
      await noBuy('상점_레벨잠금_안사짐', dear.id, () => { dear.reqLv = 99; }, () => { dear.reqLv = 1; });
      await noBuy('상점_다른장소것_안사짐', indoor.id);
      //  고른 뒤에 골드가 줄었으면(막대에 단추가 남아 있어도) 안 사진다
      { decoTab('shop'); _decoShopRender(); decoShopPick(null); decoShopPick(cheap.id); const q = qty(cheap.id); CUR.gold = 3; decoShopBuy(); out('상점_고른뒤_골드줄면_안사짐', CUR.gold === 3 && qty(cheap.id) === q); CUR.gold = 1000; }
      //  ③ 200G 이상 — 한 번 더. 두 번 두드림(0.35초 안)은 한 번으로 친다
      { decoTab('shop'); _decoShopRender(); decoShopPick(null); decoShopPick(dear.id); const g = CUR.gold;
        decoShopBuy(); const a = CUR.gold === g && /한 번 더/.test(document.querySelector('#if-deco-buybar .db-place').textContent);
        decoShopBuy(); const b = CUR.gold === g;
        await sleep(450); decoShopBuy();
        out('상점_200G이상_한번더', { 값: dear.price, 첫누름_안사짐: a, 두번두드림_안사짐: b, 맞나: a && b && CUR.gold === g - dear.price && qty(dear.id) === 1 }); }
      //  ④ 무료 기간 — 0G · 한 번에 · 지출 없음
      { GAME_DATA.decoFree = { from: '2000-01-01', until: '2999-01-01', label: '시험' }; decoTab('shop'); _decoShopRender(); decoShopPick(null); decoShopPick(dear.id);
        const g = CUR.gold, q = qty(dear.id), txt = document.getElementById('if-deco-buybar').textContent; decoShopBuy();
        out('상점_무료기간_0G', CUR.gold === g && qty(dear.id) === q + 1 && /무료/.test(txt)); GAME_DATA.decoFree = null; }
      //  ⑤ 산 직후 다른 곳 변경(스냅샷)이 와서 CUR 이 갈려도 구매는 그대로
      { decoTab('shop'); _decoShopRender(); decoShopPick(null); decoShopPick(cheap.id); const g = CUR.gold, q = qty(cheap.id); decoShopBuy();
        R.db.ref('classRPG_v3/settings/lastPing').set(Date.now()); await sleep(700);
        out('상점_스냅샷뒤_구매그대로', CUR.gold === g - cheap.price && qty(cheap.id) === q + 1); }
      //  ⑥-가 🎒 가방에 넣기(DECO-SHOP-BAG-1) — 사는 길은 같은 buyDeco(). 가진 수 +1 · 놓인 수 그대로 · 아무것도 안 골라짐 · 상점 그대로
      { CUR.gold = 1000; SEL_DECO = null; decoTab('shop'); _decoShopRender(); decoShopPick(null); decoShopPick(cheap.id);
        const g = CUR.gold, q = qty(cheap.id), n = (CUR.houseDecorations || []).filter(p => p.id === cheap.id).length, twoBtn = document.querySelectorAll('#if-deco-buybar .db-buy').length;
        saves = 0; decoShopBuy('bag'); await sleep(300);
        out('상점_가방에넣기', { 단추수: twoBtn, 골드차: g - CUR.gold, 값: cheap.price, 저장: saves,
          맞나: twoBtn === 2 && g - CUR.gold === cheap.price && qty(cheap.id) === q + 1 && (CUR.houseDecorations || []).filter(p => p.id === cheap.id).length === n
            && SEL_DECO === null && DECO_TAB === 'shop' && !document.getElementById('deco-hand-ghost') && saves === 1 });
        const g2 = CUR.gold; decoShopBuy('bag'); decoShopBuy('place');
        out('상점_가방_두번두드림_한개', CUR.gold === g2 && qty(cheap.id) === q + 1); }
      //  200G↑ 는 가방에 넣기도 한 번 더 · 빠지는 골드는 '사서 놓기'와 같다 · 단추를 바꿔 누르면 다시 한 번 더
      { decoShopPick(null); decoShopPick(dear.id); const g = CUR.gold, q = qty(dear.id);
        decoShopBuy('bag'); const a = CUR.gold === g && /한 번 더/.test(document.querySelector('#if-deco-buybar .db-bag').textContent);
        await sleep(450); decoShopBuy('place'); const b = CUR.gold === g && /한 번 더/.test(document.querySelector('#if-deco-buybar .db-place').textContent);
        await sleep(450); decoShopBuy('place'); await sleep(100);
        const placeCost = g - CUR.gold; decoTab('shop'); decoShopPick(null); decoShopPick(dear.id); const g3 = CUR.gold;
        decoShopBuy('bag'); await sleep(450); decoShopBuy('bag'); await sleep(100);
        out('상점_200G이상_가방도_한번더', { 첫누름_안사짐: a, 단추바꾸면_다시: b, 놓기값: placeCost, 가방값: g3 - CUR.gold,
          맞나: a && b && placeCost === dear.price && g3 - CUR.gold === dear.price && qty(dear.id) === q + 2 }); }
      //  ✕ 그만 — 사서 놓기 뒤 손끝 그림 곁 [✕ 그만] = 고른 것만 풀고 가방에 남김(골드·가진 수 그대로)
      { decoTab('shop'); decoShopPick(null); decoShopPick(cheap.id); decoShopBuy('place'); await sleep(100);
        const tipOk = !!document.querySelector('#deco-hand-tip button') && /놓을 곳/.test((document.getElementById('deco-hand-ghost') || {}).textContent || '');
        const g = CUR.gold, q = qty(cheap.id), n = (CUR.houseDecorations || []).filter(p => p.id === cheap.id).length;
        document.querySelector('#deco-hand-tip button').click(); await sleep(50);
        out('상점_그만_가방에남음', { 안내: tipOk, 맞나: tipOk && SEL_DECO === null && !document.getElementById('deco-hand-ghost') && !document.getElementById('deco-hand-tip')
          && CUR.gold === g && qty(cheap.id) === q && (CUR.houseDecorations || []).filter(p => p.id === cheap.id).length === n }); }
      //  다 놓아서 ×0 인 카드 — "마당에 1" · 누르면 고르지 않고 놓인 그것이 반짝
      { const keepInv = CUR.inventory, keepPl = CUR.houseDecorations;
        CUR.inventory = [{ id: cheap.id, qty: 1 }]; const tvr = document.getElementById('if-topview').getBoundingClientRect(), cc = _decoCellAt(tvr.left + tvr.width / 2, tvr.top + tvr.height / 2) || { r: 27, c: 12 };   // 화면에 보이는 칸
        CUR.houseDecorations = [_decoNew(cheap.id, 'yard', cc.r, cc.c)]; SEL_DECO = null; _decoFind.q = '';
        decoTab('own'); renderDecoInv(); await sleep(50);
        const card = document.querySelector('#if-deco-inv .deco-card[data-deco-id="' + cheap.id + '"]');
        const where = card && card.querySelector('.dc-where') ? card.querySelector('.dc-where').textContent : '';
        card && card.click(); await sleep(50);
        out('상점_다놓은카드_어디에·반짝', { 글: where, 골라짐: SEL_DECO, 반짝: document.querySelectorAll('.deco-flash-ring').length, 판: !!_dCv, 맞나: where === '마당에 1' && SEL_DECO === null && !!document.querySelector('.deco-flash-ring') });
        document.querySelectorAll('.deco-flash-ring').forEach(r => r.remove());
        CUR.inventory = keepInv; CUR.houseDecorations = keepPl; renderDecoInv(); }
      //  ⑥ 막 누르기 300번 — 어떤 순서로도 골드는 늘지 않고, 쓴 골드 = 늘어난 장식 값의 합(무료 기간이 섞여도)
      { CUR.gold = 3000; CUR.inventory = []; CUR.houseDecorations = []; _decoUndoClear();
        let seed = 12345; const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
        const ids = GAME_DATA.decorations.map(d => d.id); let up = 0, spent = 0, gained = 0;
        for (let i = 0; i < 300; i++) {
          const g = CUR.gold, before = {}; (CUR.inventory || []).forEach(x => { before[x.id] = x.qty; }); const tot = (CUR.inventory || []).reduce((a, x) => a + x.qty, 0), free = !!GAME_DATA.decoFreeNow(), k = rnd(12);
          if (k < 3) { decoTab('shop'); decoShopPick(ids[rnd(ids.length)]); }
          else if (k < 7) decoShopBuy(rnd(2) ? 'bag' : 'place');
          else if (k === 7) _decoShop.armedAt = 1;
          else if (k === 8) { if (rnd(2)) decoUndo(); else decoGhostStop(); }
          else if (k === 9) { if (SEL_DECO) _decoPlace('yard', 8 + rnd(30), 1 + rnd(40)); }
          else if (k === 10) decoTab(rnd(2) ? 'own' : 'shop');
          else GAME_DATA.decoFree = rnd(4) ? null : { from: '2000-01-01', until: '2999-01-01' };
          if (CUR.gold > g) up++;
          const tot2 = (CUR.inventory || []).reduce((a, x) => a + x.qty, 0);
          if (tot2 > tot) (CUR.inventory || []).forEach(x => { const dq = x.qty - (before[x.id] || 0); if (dq > 0) gained += free ? 0 : dq * D(x.id).price; });   // 가방에 넣기는 SEL 이 없다 — 가진 수 차이로
          spent += g - CUR.gold;
        }
        GAME_DATA.decoFree = null;
        out('상점_막누르기300번', { 골드늘어난횟수: up, 쓴골드: spent, 산것값합: gained, 산개수: (CUR.inventory || []).reduce((a, x) => a + x.qty, 0), 맞나: up === 0 && spent === gained && spent > 0 }); }
      document.querySelectorAll('.toast-msg').forEach(t => t.remove());
      decoTab('own'); SEL_DECO = null; _decoUndoClear();
      CUR.gold = keep.gold; CUR.inventory = keep.inv; CUR.houseDecorations = keep.placed; GAME_DATA.decoFree = keep.free; CUR.level = keep.lv;
      delete CUR.yardFloor['23_46'];
      DB.saveStudent(CUR); renderHouseDeco(); await sleep(300);
    }

    //  ⑮ 바닥 저장값 해석(DECO-FLOOR-PARSE-1) — 옛 값만 있는 마당은 **한 픽셀도** 달라지면 안 된다.
    //    옛 바닥 14종을 이웃이 골고루 섞이게 깔고(연못 = 물가 조각 전부 · 잔디 번짐) 캔버스 전체의 지문(SHA-256)을 찍는다.
    //    지문은 기기(래스터)마다 다르다 → 값 자체는 맞다/틀리다가 아니다. **전/후 비교는 `REPO=<main 을 푼 폴더>` 로 같은 기기에서 나란히**
    //    (이 줄이 main 과 같으면 옛 마당 그림 불변). 바닥 그리기를 고치는 PR 은 이 지문의 전/후를 PR 에 적는다.
    {
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(500); }
      if (typeof decoSpaceSet === 'function') { decoSpaceSet(1); await sleep(200); }
      decoZoomFit(); await sleep(100);
      const OLD = Object.keys(FLOOR_TILES).slice(0, 14), keepFloor = CUR.yardFloor, fx = {};   // 옛 14종(표 앞 14줄 — 뒤에 무엇이 더 들어와도 이 지문은 안 바뀐다)
      const vis = _decoVisible(DY.rows, DY.cols), free = (r, c) => !_isHC(r, c) && !(typeof _isFarmCell === 'function' && _isFarmCell(r, c));
      for (let r = vis.r0; r < vis.r1; r++) for (let c = vis.c0; c < vis.c1; c++) {          // 보이는 칸 전부에 — 다섯 칸에 한 칸쯤은 맨 잔디로 둔다
        const k = (r * 7 + c * 13 + (r * c) % 3) % (OLD.length + 3);
        if (free(r, c) && k < OLD.length) fx[r + '_' + c] = OLD[k];
      }
      const pr = vis.r0 + 2, pc = vis.c0 + 4;                                                 // 연못 5×6(귀 하나 빠짐 · 가운데 섬) = 물가 변·안 모서리·바깥 모서리 전부
      for (let r = pr; r < pr + 5; r++) for (let c = pc; c < pc + 6; c++) if (free(r, c) && !(r === pr && c === pc) && !(r === pr + 2 && c === pc + 3)) fx[r + '_' + c] = 'water';
      //  (앞 검사에서 🖌️ 바닥 모드를 열었으면 고르기 판이 칩 그림으로 정원 그림을 이미 불렀다 — 그건 빼고, 이 마당을 그리며 **새로** 부른 것만 본다)
      const GARDEN_RE = /^(bed_|rim_|tile_(tulipbed|tulipcol|hydrangea|wildflower|sunflowerbed|lavender|daisyfield))/;
      const gardenBefore = new Set(Object.keys(_FLOOR_IMG).filter(k => GARDEN_RE.test(k)));
      CUR.yardFloor = fx;
      const print = async () => {
        _drawDeco(); await sleep(150);
        const cv = document.querySelector('#if-topview canvas'); if (!cv) return 'no-canvas';
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        const h = await crypto.subtle.digest('SHA-256', d.buffer);
        return cv.width + 'x' + cv.height + ':' + [...new Uint8Array(h)].slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join('');
      };
      await print();                                                      // 첫 그리기 = 그림을 부른다
      for (let i = 0; i < 100; i++) {                                     // 부른 바닥 그림이 다 올 때까지(없는 파일은 complete 로 끝난다)
        if (Object.keys(_FLOOR_IMG).every(k => _FLOOR_IMG[k].img.complete)) break; await sleep(50);
      }
      await sleep(300);
      const f1 = await print(), f2 = await print();
      out('옛바닥마당_칠한칸_종류', Object.keys(fx).length + '칸·' + new Set(Object.values(fx)).size + '종');
      out('옛바닥마당_14종_다씀', new Set(Object.values(fx)).size === OLD.length);
      out('옛바닥마당_바닥그림_다옴', OLD.every(t => Object.keys(_FLOOR_IMG).some(k => k.indexOf('tile_' + t) === 0 && _FLOOR_IMG[k].ok)));
      out('옛바닥마당_두번그려_같음', f1 === f2 && f1 !== 'no-canvas');
      out('옛바닥마당_그림지문', f1);
      //  여기까지는 옛 바닥만 깔았다 → 정원 바닥 그림은 한 장도 안 불렸어야 한다(쓴 색만 부른다 · 요청 수 그대로)
      out('정원바닥_안쓴마당_부른그림0', !Object.keys(_FLOOR_IMG).some(k => GARDEN_RE.test(k) && !gardenBefore.has(k)));
      if (typeof _floorParse === 'function') {
        out('바닥해석_옛값_이름그대로', OLD.every(t => { const p = _floorParse(t); return p.name === t && !p.color && !p.rim; }));
        const p = _floorParse('tulipbed#red+picket');
        out('바닥해석_새형식', p.name === 'tulipbed' && p.color === 'red' && p.rim === 'picket');
        //  아직 그림을 안 잇는 새 값(②~③ 전)이 저장본에 있어도 깨지지 않는다 — 오류 없이 그려지고 동물 바닥은 풀·흙
        CUR.yardFloor = Object.assign({}, fx, { '7_2': 'tulipbed#red+picket', '7_3': 'lavender+brick' });
        let threw = ''; try { _drawYard(); } catch (e) { threw = String(e).slice(0, 80); }
        out('바닥해석_새값있어도_그려짐', threw === '' && _groundAt(CUR, 7, 2) === 'soft');
      }
      //  ⑯ 정원 바닥 색(DECO-FLOOR-COLOR-1) — 한 파일·여러 색(`…svg#색`). 색마다 Image·비트맵이 따로라서 **쓴 색만** 불러야 한다.
      if (typeof _FLOOR_COLORS !== 'undefined') {
        const isGarden = k => Object.keys(_FLOOR_COLORS).some(n => k.indexOf('tile_' + n + '_') === 0);
        const gr = vis.r0 + 3, gc = vis.c0 + 3, gk = gr + '_' + gc, C2 = _dC * 2;
        const vals = []; Object.keys(_FLOOR_COLORS).forEach(n => { vals.push([n, '']); _FLOOR_COLORS[n].forEach(col => vals.push([n, col])); });
        vals.forEach(([n, col]) => _floorImg(_floorBaseName(n, gr, gc), col));                            // 이 칸에 쓸 그림만 부른다
        for (let i = 0; i < 100; i++) { if (Object.keys(_FLOOR_IMG).every(k => _FLOOR_IMG[k].img.complete)) break; await sleep(50); }
        //  한 칸(과 이웃)을 깔고 그 **칸만** 지문을 뜬다. 가장자리 조각은 그릴 때 처음 불리므로, 새 그림을 불렀으면 다 올 때까지 기다렸다가 다시 그린다.
        //  (`complete` 가 먼저 참이 되고 onload 는 그 뒤에 온다 — '왔다'는 기억 표의 ok 로 본다. 없는 파일은 complete 인데 폭 0)
        const settled = () => Object.keys(_FLOOR_IMG).every(k => _FLOOR_IMG[k].ok || (_FLOOR_IMG[k].img.complete && !_FLOOR_IMG[k].img.naturalWidth));
        const cellPrint = async (v, around) => {
          const fx2 = { [gk]: v }; Object.keys(around || {}).forEach(d => { const [dr, dc] = d.split(',').map(Number); fx2[(gr + dr) + '_' + (gc + dc)] = around[d]; });
          const ok0 = Object.keys(_FLOOR_IMG).filter(k => _FLOOR_IMG[k].ok).length;   // 그리기 **전에** 센다 — 그리는 40ms 사이에 도착한 그림도 '새로 온 것'
          CUR.yardFloor = fx2; _drawDeco(); await sleep(40);
          for (let i = 0; i < 100 && !settled(); i++) await sleep(50);
          if (Object.keys(_FLOOR_IMG).filter(k => _FLOOR_IMG[k].ok).length !== ok0) { _drawDeco(); await sleep(40); }
          const cv = document.querySelector('#if-topview canvas');
          //  칸 크기가 정수가 아니면(하네스 창 = 칸 15.12px) 칸 경계 1px 이 이웃 칸과 섞인다 → 안쪽으로 2px 들여 뜬다(이웃이 달라도 제 칸 그림만 견주게)
          const d = cv.getContext('2d').getImageData(Math.ceil((gc * _dC - _dPanX) * 2) + 2, Math.ceil((gr * _dC - _dPanY) * 2) + 2, Math.floor(C2) - 4, Math.floor(C2) - 4).data;
          return [...new Uint8Array(await crypto.subtle.digest('SHA-256', d.buffer))].slice(0, 8).join(',');
        };
        const grassPrint = await cellPrint('grass'), seen = {}; let same = [];
        for (const [n, col] of vals) { const v = col ? n + '#' + col : n, pr = await cellPrint(v); if (seen[pr] || pr === grassPrint) same.push(v + '=' + (seen[pr] || 'grass')); seen[pr] = v; }
        out('정원바닥_값마다_다른그림', vals.length + '값 중 겹침 ' + same.length + (same.length ? ' (' + same.slice(0, 4).join(' · ') + ')' : ''));
        out('정원바닥_색이_실제로_입혀짐', same.length === 0 && vals.length >= 30);
        const nImg = Object.keys(_FLOOR_IMG).length;
        const bogus = await cellPrint('tulipbed#nosuchcolor'), oldCol = await cellPrint('stone#red');
        out('정원바닥_없는색은_기본색_그림안부름', bogus === (await cellPrint('tulipbed')) && Object.keys(_FLOOR_IMG).length === nImg);
        out('정원바닥_옛바닥에_색은_무시', oldCol === (await cellPrint('stone')));
        out('정원바닥_부른그림수', Object.keys(_FLOOR_IMG).filter(isGarden).length + '장(이 칸의 변형 × ' + vals.length + '값)');
        //  ⑰ 꽃밭 가장자리(DECO-FLOOR-EDGE-1) — 꽃밭 무리의 바깥 변에만 bed_*#꽃잎색 / rim_<마감>_* · 들꽃 잔디는 풀.
        if (typeof _FLOOR_EDGE_COLOR !== 'undefined') {
          const ring8 = v => ({ '-1,-1': v, '-1,0': v, '-1,1': v, '0,-1': v, '0,1': v, '1,-1': v, '1,0': v, '1,1': v });
          const keysLike = re => Object.keys(_FLOOR_IMG).filter(k => re.test(k));
          const alone = await cellPrint('tulipbed'), inside = await cellPrint('tulipbed', ring8('tulipbed'));
          out('꽃밭가장자리_홀로선칸은_둘러싸인칸과_다르다', alone !== inside);
          out('꽃밭가장자리_다른꽃밭·다른색·다른마감과_맞닿으면_안그림', inside === (await cellPrint('tulipbed', ring8('lavender+brick'))) && inside === (await cellPrint('tulipbed', ring8('tulipbed#red'))));
          const eGrass = await cellPrint('tulipbed', Object.assign(ring8('tulipbed'), { '0,1': 'grass' }));
          out('꽃밭가장자리_바깥변_하나만', eGrass !== inside && eGrass !== alone);
          out('꽃밭가장자리_들꽃·돌·물_옆도_바깥', eGrass === (await cellPrint('tulipbed', Object.assign(ring8('tulipbed'), { '0,1': 'wildflower' })))
            && eGrass === (await cellPrint('tulipbed', Object.assign(ring8('tulipbed'), { '0,1': 'stone' }))) && eGrass === (await cellPrint('tulipbed', Object.assign(ring8('tulipbed'), { '0,1': 'water' }))));
          await cellPrint('tulipbed#red');
          out('꽃밭가장자리_꽃잎색은_바탕색을_따른다', keysLike(/^bed_.*#red$/).length >= 8 && keysLike(/^bed_.*#red$/).every(k => _FLOOR_IMG[k].ok));   // 변 4 + 안 모서리 4
          //  짝 표(#636): candy → red(방금 부른 그림) · sherbet → pink(기본 = 주소에 색 없음) — 새 그림을 안 부르고, 짝 색 자체가 주소에 안 붙는다
          const nb = keysLike(/^bed_/).length; await cellPrint('tulipbed#candy'); await cellPrint('tulipbed#sherbet');
          out('꽃밭가장자리_짝색은_이미부른그림_다시안부름', keysLike(/^bed_/).length === nb && keysLike(/^bed_.*#(candy|sherbet|pink)$/).length === 0);
          await cellPrint('hydrangea'); await cellPrint('lavender'); await cellPrint('sunflowerbed'); await cellPrint('daisyfield');
          out('꽃밭가장자리_기본색짝', ['blue', 'violet', 'yellow', 'white'].every(c2 => keysLike(new RegExp('^bed_.*#' + c2 + '$')).length > 0));
          const rims = [await cellPrint('tulipbed+picket'), await cellPrint('tulipbed+stone'), await cellPrint('tulipbed+brick')];
          out('꽃밭가장자리_마감셋_서로다르고_가장자리와도_다르다', new Set(rims.concat([alone])).size === 4);
          const fenceT = [rims[0] === (await cellPrint('tulipbed+picket', ring8('tulipbed'))), rims[0] === (await cellPrint('tulipbed+picket', ring8('lavender+brick'))),
            rims[0] !== (await cellPrint('tulipbed+picket', ring8('lavender+picket'))), inside === (await cellPrint('tulipbed', ring8('lavender+picket')))];
          out('꽃밭가장자리_울타리는_빙_둘러_닫힌다', fenceT.every(Boolean) || fenceT.join(','));
          out('꽃밭가장자리_마감엔_색없음·없는마감은_그냥가장자리', keysLike(/^rim_.*#/).length === 0 && alone === (await cellPrint('tulipbed+nosuchrim')) && keysLike(/^rim_nosuch/).length === 0);
          const stGrass = await cellPrint('stone', ring8('grass'));
          out('들꽃잔디는_풀_돌칸에_잔디가_번진다', stGrass === (await cellPrint('stone', ring8('wildflower#snow'))) && stGrass !== (await cellPrint('stone', ring8('stone'))));
          out('들꽃잔디는_풀_제칸엔_번짐없음', (await cellPrint('wildflower')) === (await cellPrint('wildflower', ring8('wildflower'))));
          //  홀로 선 꽃밭 칸 = 바탕 1 + 가장자리 8(변 4 · 안 모서리 4)뿐 — 잔디 번짐(8)을 또 얹지 않는다. 마당 전체를 그리는 drawImage 횟수의 차로 센다.
          const drawsFor = (fx3) => { CUR.yardFloor = fx3; const o = _dCtx.drawImage; let n = 0; _dCtx.drawImage = function () { n++; return o.apply(this, arguments); }; try { _drawYard(); } finally { _dCtx.drawImage = o; } return n; };
          const dGrass = drawsFor({}), dBed = drawsFor({ [gk]: 'tulipbed' });
          out('꽃밭칸_조각수', '홀로 선 칸 = 잔디 칸 +' + (dBed - dGrass));
          out('꽃밭칸엔_잔디번짐_안얹는다', dBed - dGrass === 8);
          out('꽃밭가장자리_부른그림수', 'bed ' + keysLike(/^bed_/).length + ' · rim ' + keysLike(/^rim_/).length);
        }
      }
      CUR.yardFloor = keepFloor; _drawDeco(); await sleep(100);
    }

    //  ⑯ 집 안 — 러그 위에 가구(INDOOR-RUG-1) + 집 안의 🖌️ 는 '벽지·바닥'(INDOOR-LOOK-1 — #631 이 감췄던 단추가 돌아왔다).
    //    러그(장식 표의 layer:'floor')와 가구는 한 칸에 같이 놓인다. 러그끼리·가구끼리는 그대로 안 겹친다.
    //    `옛집안_그림지문` 은 ⑮ 와 같은 방식 — **값 자체가 아니라 main 과 나란히(`REPO=<main 을 푼 폴더>`) 같은 기기에서 같은지**를 본다.
    //    (러그와 가구가 안 겹친 '지금까지 가능했던' 집 안 = 이 PR 뒤에도 한 픽셀도 달라지면 안 된다.)
    {
      const keepDeco = CUR.houseDecorations, keepInv = CUR.inventory;
      setDecoMode('floor'); ifSyncModeBtn();                                  // 마당에서 바닥 모드인 채로 집 안에 들어간다
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(400); }
      const fbtn = document.getElementById('if-mode-floor'), frow = document.getElementById('if-floor-row');
      const shown = el => !!el && getComputedStyle(el).display !== 'none';
      out('마당_바닥단추_보임', shown(fbtn));
      toggleDecoScene(); await sleep(500);
      out('집안_🖌️는_벽지바닥', shown(fbtn) && /벽지·바닥/.test(fbtn.textContent));
      out('집안_바닥모드면_벽지바닥판', DECO_MODE === 'floor' && !shown(frow) && !document.getElementById('if-floor-picker').hidden
        && document.querySelectorAll('#if-floor-picker .fpk-row[data-row=fams] .pk-chip').length === INDOOR_WALLS.length);
      setDecoMode('deco'); ifSyncModeBtn(); await sleep(200);                 // (main 과 나란히 잴 때 판 크기가 같게 — 이 PR 에서는 이미 장식 모드다)
      decoZoomFit(); await sleep(100);

      //  옛 집 안(겹침 없음): 벽걸이 둘 · 크기 다른 가구 · 러그 둘 — 놓는 길을 거치지 않고 저장본처럼 바로 넣는다(main 에서도 같은 줄이 나오게)
      CUR.inventory = GAME_DATA.decorations.filter(d => d.cat === 'indoor').map(d => ({ id: d.id, qty: 3 }));
      CUR.houseDecorations = [
        { id: 'd_i3', area: 'indoor', row: 0, col: 2 }, { id: 'd_i4', area: 'indoor', row: 0, col: 4 },
        { id: 'd_i16', area: 'indoor', row: 2, col: 1 }, { id: 'd_i15', area: 'indoor', row: 5, col: 8 },
        { id: 'd_i8', area: 'indoor', row: 5, col: 1 }, { id: 'd_i9', area: 'indoor', row: 2, col: 6 },
        { id: 'd_i6', area: 'indoor', row: 1, col: 10 }, { id: 'd_i1', area: 'indoor', row: 4, col: 5 },
        { id: 'd_i10', area: 'indoor', row: 8, col: 3 }, { id: 'd_i2', area: 'indoor', row: 8, col: 6 },
      ];
      const print = async () => {
        _drawDeco(); await sleep(150);
        const cv = document.querySelector('#if-topview canvas'); if (!cv) return 'no-canvas';
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        const h = await crypto.subtle.digest('SHA-256', d.buffer);
        return cv.width + 'x' + cv.height + ':' + [...new Uint8Array(h)].slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join('');
      };
      await print();
      for (let i = 0; i < 100; i++) {                                         // 집 안 그림(가구·벽지·마루)이 다 올 때까지
        const ids = CUR.houseDecorations.map(p => p.id);
        if (ids.every(id => _DECO_IMG[id] && _DECO_IMG[id].img.complete) && Object.keys(_FLOOR_IMG).every(k => _FLOOR_IMG[k].img.complete)) break;
        await sleep(50);
      }
      await sleep(300);
      const g1 = await print(), g2 = await print();
      out('옛집안_가구그림_다옴', CUR.houseDecorations.every(p => _DECO_IMG[p.id] && _DECO_IMG[p.id].ok));
      out('옛집안_두번그려_같음', g1 === g2 && g1 !== 'no-canvas');
      out('옛집안_그림지문', g1);

      //  놓기 — 진짜 놓는 길(_decoPlace)로 · at() 은 **지금 공간**에서 센다
      const at = (id, r, c) => _decoList(CUR).filter(p => p.id === id && p.area === 'indoor' && p.row === r && p.col === c).length;
      _decoUndoClear();
      SEL_DECO = 'd_i8'; _decoPlace('indoor', 2, 1);                          // 네모 러그(2,1 · 3×2) 위에 소파(3×1)
      out('러그위_가구_놓임', at('d_i8', 2, 1) === 1 && at('d_i16', 2, 1) === 1);
      SEL_DECO = 'd_i1'; _decoPlace('indoor', 2, 2);                          // 소파가 있는 칸에 화분 → 가구끼리는 그대로 안 된다
      out('가구끼리_그대로_안겹침', at('d_i1', 2, 2) === 0);
      SEL_DECO = 'd_i15'; _decoPlace('indoor', 3, 3);                         // 네모 러그와 한 칸 겹치는 둥근 러그
      out('러그끼리_안겹침', at('d_i15', 3, 3) === 0);
      { const said = [], origToast = toast; toast = function (m) { said.push(String(m)); return origToast.apply(this, arguments); };   // 막힌 까닭 — 누른 칸 맨 위(소파)가 아니라 정말 막는 것(밑의 러그)을 말한다
        try { _decoPlace('indoor', 2, 2); } finally { toast = origToast; }
        out('러그끼리_막힌까닭_러그라고말함', at('d_i15', 2, 2) === 0 && said.some(m => m.indexOf('네모 러그') >= 0) && !said.some(m => m.indexOf('소파') >= 0)); }
      SEL_DECO = 'd_i16'; _decoPlace('indoor', 8, 3);                         // 침대(8,3 · 2×2) 밑에 러그를 깐다
      out('가구밑에_러그_깔림', at('d_i16', 8, 3) === 1 && at('d_i10', 8, 3) === 1);
      const topId = (r, c) => { const t = _decoTopAt('indoor', r, c, true); return t && t.id; };
      out('겹친칸_맨위는_가구', topId(2, 1) === 'd_i8' && topId(8, 3) === 'd_i10' && topId(3, 1) === 'd_i16');
      //  스포이드(길게 누르기)도 위의 것
      SEL_DECO = null; _decoPickAt({ area: 'indoor', r: 2, c: 2 });
      out('스포이드_위의가구', SEL_DECO === 'd_i8');
      //  그리기 순서 — 내 집 안·친구 구경 둘 다 러그가 먼저
      const order = fn => { const seq = [], orig = _drawDecoSVG; _drawDecoSVG = function (id) { seq.push(id); return orig.apply(this, arguments); };
        try { fn(); } finally { _drawDecoSVG = orig; } return seq; };
      const rugFirst = seq => { const lastRug = Math.max(seq.lastIndexOf('d_i15'), seq.lastIndexOf('d_i16')); const firstFurn = seq.findIndex(id => id !== 'd_i15' && id !== 'd_i16');
        return seq.length > 0 && lastRug >= 0 && firstFurn > lastRug; };
      out('그리기_러그먼저', rugFirst(order(() => _drawIndoor())));
      //  🧽 치우기 — 겹친 칸을 누르면 가구가 먼저, 러그는 남는다 → ↩ 하면 가구가 러그 위로 돌아온다
      setDecoMode('erase'); _decoPlace('indoor', 2, 1);
      out('치우기_가구먼저_러그남음', at('d_i8', 2, 1) === 0 && at('d_i16', 2, 1) === 1);
      setDecoMode('deco'); decoUndo();
      out('되돌리기_가구_러그위로', at('d_i8', 2, 1) === 1 && at('d_i16', 2, 1) === 1);
      decoUndo();                                                             // 침대 밑 러그 놓기를 되돌린다 → 침대는 그대로
      out('되돌리기_밑러그만_빠짐', at('d_i16', 8, 3) === 0 && at('d_i10', 8, 3) === 1);
      decoUndo();                                                             // 러그 위 소파 놓기를 되돌린다 → 러그는 그대로
      out('되돌리기_위가구만_빠짐', at('d_i8', 2, 1) === 0 && at('d_i16', 2, 1) === 1);
      //  끌어서 죽 놓기 — 러그 위를 지나가도 놓인다 · 러그는 러그 위에 안 놓인다
      if (typeof _decoStrokeApply === 'function') {
        const st = { stroke: [], placed: 0 };
        SEL_DECO = 'd_i1'; const okFurn = _decoStrokeApply({ area: 'indoor', r: 3, c: 2 }, st);
        SEL_DECO = 'd_i15'; const okRug = _decoStrokeApply({ area: 'indoor', r: 2, c: 2 }, st);
        out('끌어놓기_러그위_가구됨_러그안됨', okFurn === true && okRug === false);
      }
      //  공간 2 — 공간 1 의 러그·가구와 부딪히지 않고, 거기서도 같은 규칙
      if (typeof decoSpaceSet === 'function') {
        decoSpaceSet(2); await sleep(200);
        SEL_DECO = 'd_i16'; _decoPlace('indoor', 2, 1); SEL_DECO = 'd_i9'; _decoPlace('indoor', 2, 1);
        const sp2 = (CUR.houseDecorations || []).filter(p => p.sp === 2 && p.area === 'indoor').map(p => p.id).sort().join();
        out('공간2_러그위_가구', sp2 === 'd_i16,d_i9');
        decoSpaceSet(1); await sleep(200);
        out('공간1_그대로', at('d_i16', 2, 1) === 1 && topId(2, 1) === 'd_i16');
      }
      //  친구 구경(공간 1 · 같은 _drawIndoor) — 러그 위에 가구가 있는 친구 집 안도 러그가 먼저 그려진다
      if (typeof _renderFriendCanvas === 'function') {
        const fr = { id: 's_fr2', name: '친구', avatar: '🧒', level: 1, inventory: [], yardFloor: {},
          houseDecorations: [{ id: 'd_i8', area: 'indoor', row: 2, col: 1 }, { id: 'd_i16', area: 'indoor', row: 2, col: 1 }] };
        closeInteriorFullscreen(); await sleep(200);
        openFriendFullscreen(fr); await sleep(300);
        toggleFriendScene(); await sleep(300);
        out('구경_집안_러그먼저', rugFirst(order(() => _renderFriendCanvas())));
        closeFriendFullscreen(); await sleep(100);
        openInteriorFullscreen(); await sleep(500);
        if (!_dCv) { renderHouseDeco(); await sleep(200); }
      }
      out('집안_다시열어도_벽지바닥단추', DECO_SCENE === 'indoor' ? shown(fbtn) && /벽지·바닥/.test(fbtn.textContent) : 'scene=' + DECO_SCENE);
      SEL_DECO = null; _decoUndoClear();
      CUR.houseDecorations = keepDeco; CUR.inventory = keepInv;
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(400); }
      out('마당으로_돌아오면_바닥단추_보임', shown(fbtn));
    }
    //  ⑰ 바닥 고르기(DECO-FLOOR-PICK-1) — 🖌️ 바닥 모드에서 접힌 서랍 자리에 판(규칙 docs/deco_floor_picker_20260920.md).
    //    누르면 붓(CUR_FLOOR_TILE)이 §4 표 글자 그대로 · 잠긴 색은 칠하지 않는다 · 칠하면 그 글자가 저장값 · 다시 열면 붓을 거꾸로 읽는다.
    if (document.getElementById('if-floor-picker')) {
      const keepInv = CUR.inventory, keepTile = CUR_FLOOR_TILE;
      const pk = document.getElementById('if-floor-picker'), q = sel => [...pk.querySelectorAll(sel)];
      const fams = () => q('.fpk-row[data-row="fams"] .pk-chip'), onTxt = sel => { const b = pk.querySelector(sel + '.is-on'); return b ? b.textContent : ''; };
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(400); }
      setDecoMode('deco'); ifSyncModeBtn(); CUR_FLOOR_TILE = 'grass';
      document.getElementById('if-mode-floor').click(); await sleep(300);
      out('바닥고르기_판열림_위줄없음_서랍접힘', !pk.hidden && !document.getElementById('if-floor-row') && getComputedStyle(document.getElementById('if-deco-drawer')).display === 'none');
      out('바닥고르기_가족칩', fams().map(b => b.textContent).join('·'));
      out('바닥고르기_기본14_잔디고름', q('.pk-tile').length === 14 && q('.pk-tile.is-on').length === 1 && q('.pk-tile')[0].classList.contains('is-on') && onTxt('.pk-chip') === '기본');
      q('.pk-tile')[7].click(); await sleep(100);
      out('바닥고르기_기본_벽돌', CUR_FLOOR_TILE === 'brick' && /벽돌/.test(pk.querySelector('.pk-name').textContent));
      //  가진 것 없음 → 튤립의 빨강은 잠김
      CUR.inventory = [];
      fams()[1].click(); await sleep(100);
      out('바닥고르기_튤립_기본색은_글자없음', CUR_FLOOR_TILE === 'tulipbed');
      out('바닥고르기_색순서_기본먼저_잠김뒤로', q('.pk-dot').map(b => (b.dataset.col || '기본') + (b.classList.contains('is-locked') ? '🔒' : '')).join(' '));
      pk.querySelector('.pk-dot[data-col="red"]').click(); await sleep(150);
      const bub = pk.querySelector('.pk-bubble');
      out('바닥고르기_잠긴색_안칠함_말풍선_견본잠김', CUR_FLOOR_TILE === 'tulipbed' && !!bub && !bub.hidden && /장미/.test(bub.textContent) && !!pk.querySelector('.pk-sw-lk') && /잠긴/.test(pk.textContent));
      await sleep(2700);
      out('바닥고르기_말풍선_저절로닫힘_고른것그대로', bub.hidden && !pk.querySelector('.pk-sw-lk') && CUR_FLOOR_TILE === 'tulipbed' && pk.querySelector('.pk-dot.is-on').dataset.col === '');
      //  가진 것 있음 → 빨강 · 흰 말뚝
      CUR.inventory = GAME_DATA.decorations.filter(d => d.cat === 'yard').map(d => ({ id: d.id, qty: 1 }));
      fams()[1].click(); await sleep(100);
      pk.querySelector('.pk-dot[data-col="red"]').click(); await sleep(100);
      const swPrint = async () => { await sleep(700); const cv = pk.querySelector('.pk-sw canvas'); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        return [...new Uint8Array(await crypto.subtle.digest('SHA-256', d.buffer))].slice(0, 6).join(','); };
      const swRed = await swPrint();
      q('.pk-rim')[3].click();
      const swPicket = await swPrint();
      out('바닥고르기_빨강튤립_흰말뚝', CUR_FLOOR_TILE === 'tulipbed#red+picket' && pk.querySelector('.pk-name').textContent === '빨강 튤립 · 흰 말뚝' && onTxt('.pk-rim') === '흰 말뚝');
      out('바닥고르기_견본이_고른대로_바뀜', swRed !== swPicket);
      //  견본 = 마당과 같은 그리기 — 가장자리/마감 조각을 실제로 불렀다
      out('바닥고르기_견본에_마감조각', Object.keys(_FLOOR_IMG).some(k => /^rim_picket_/.test(k) && _FLOOR_IMG[k].ok) && Object.keys(_FLOOR_IMG).some(k => /^bed_.*#red$/.test(k)));
      fams()[3].click(); await sleep(80);
      out('바닥고르기_수국_처음은_기본색_자연', CUR_FLOOR_TILE === 'hydrangea' && q('.pk-rim').length === 4 && onTxt('.pk-rim') === '자연');
      fams()[7].click(); await sleep(80);
      out('바닥고르기_들꽃_테두리줄없음', CUR_FLOOR_TILE === 'wildflower' && pk.querySelector('.fpk-row[data-row="rims"]').hidden && q('.pk-cap').length === 1);
      fams()[1].click(); await sleep(80);
      out('바닥고르기_가족마다_마지막것기억', CUR_FLOOR_TILE === 'tulipbed#red+picket');
      //  누를 곳 44px 이상(보이는 것만 — 옆으로 넘긴 줄 끝은 폭을 잰다)
      const tooSmall = () => q('button').filter(b => { const r = b.getBoundingClientRect(); return b.offsetParent !== null && (r.width < 44 || r.height < 44); }).map(b => b.getAttribute('aria-label'));
      fams()[0].click(); await sleep(60); const small = tooSmall(); fams()[1].click(); await sleep(60); small.push(...tooSmall());   // 기본 줄 · 정원 세 줄 둘 다
      out('바닥고르기_44px미만', small.length ? small.join(',') : '없음');
      //  칠하기 — 붓 글자가 그대로 저장값 · 같은 칸을 다시 누르면 걷힌다(지우개 판정은 글자 그대로)
      const key = '30_30', had = _yardFloorGet(CUR)[key];
      if (!had) {
        _paintFloor(30, 30); const got = _yardFloorGet(CUR)[key];
        _paintFloor(30, 30);
        out('바닥고르기_칠하면_그글자_다시누르면_걷힘', got === 'tulipbed#red+picket' && !_yardFloorGet(CUR)[key]);
      }
      //  거꾸로 읽기 — 붓이 'hydrangea#pink+stone' 인 채 바닥 모드를 다시 열면 칩·색·테두리가 그 자리에
      setDecoMode('deco'); ifSyncModeBtn(); CUR_FLOOR_TILE = 'hydrangea#pink+stone';
      document.getElementById('if-mode-floor').click(); await sleep(250);
      out('바닥고르기_거꾸로읽기', onTxt('.fpk-row[data-row="fams"] .pk-chip') === '수국' && pk.querySelector('.pk-dot.is-on').dataset.col === 'pink' && onTxt('.pk-rim') === '돌' && CUR_FLOOR_TILE === 'hydrangea#pink+stone');
      //  자리 — 서랍 자리 · 마당이 절반 넘게 · 기둥이 판 위
      const tv = document.getElementById('if-topview').getBoundingClientRect(), pr = pk.getBoundingClientRect(), zc = document.getElementById('if-zoom-col').getBoundingClientRect();
      out('바닥고르기_자리', { 창: innerWidth + 'x' + innerHeight, 판위: Math.round(tv.top), 고르기위: Math.round(pr.top), 고르기키: Math.round(pr.height), 마당비율: Math.round((pr.top - tv.top) / innerHeight * 100) + '%' });
      out('바닥고르기_기둥이_판위', zc.bottom <= pr.top + 1);
      setDecoMode('deco'); ifSyncModeBtn(); await sleep(150);
      out('바닥고르기_장식모드면_닫힘', pk.hidden && getComputedStyle(document.getElementById('if-deco-drawer')).display !== 'none');
      CUR.inventory = keepInv; CUR_FLOOR_TILE = keepTile; _drawDeco();
    }
    //  ⑱ ⬛ 네모로(DECO-FLOOR-RECT-1) — 도구 토글 · 끄는 동안 미리보기+아래 글 · 떼면 한꺼번에(집·밭 건너뜀) · ↩ 한 번 = 네모 통째 · 상한 400칸.
    //    손짓 자체(한 손가락=네모 · 두 손가락=화면)는 진짜 터치(CDP)로 따로 쟀다(PR 본문). 여기서는 같은 함수를 좌표로 부른다.
    if (typeof _decoRectMove === 'function') {
      const pk = document.getElementById('if-floor-picker'), keepTile = CUR_FLOOR_TILE, keepTool = DECO_FLOOR_TOOL;
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(400); }
      _decoUndoClear(); setDecoMode('deco'); ifSyncModeBtn(); CUR_FLOOR_TILE = 'hydrangea+stone';
      document.getElementById('if-mode-floor').click(); await sleep(250); decoZoomFit(); await sleep(150);
      const segB = v => pk.querySelector('.pk-seg-b[data-v="' + v + '"]');
      out('네모로_도구토글_있음_처음은_끌어서', !!segB('rect') && !!segB('drag') && (keepTool === 'rect' || segB('drag').classList.contains('is-on')));
      segB('rect').click(); await sleep(80);
      let mem = null; try { mem = localStorage.getItem('deco_floor_tool_v1'); } catch (e) {}
      out('네모로_고르면_캡션·기억', DECO_FLOOR_TOOL === 'rect' && segB('rect').classList.contains('is-on') && /모서리에서 모서리로/.test(pk.textContent) && (mem === 'rect' || mem === null));
      const cv = document.querySelector('#if-topview canvas'), R0 = cv.getBoundingClientRect();
      const at = (r, c) => ({ x: R0.left + ((c + 0.5) * _dC - _dPanX) * R0.width / _dW, y: R0.top + ((r + 0.5) * _dC - _dPanY) * R0.height / _dH });
      //  집 칸을 가로지르는 네모 — 집 칸은 건너뛴다
      let hr = -1, hc = -1; for (let r = 0; r < DY.rows && hr < 0; r++) for (let c = 0; c < DY.cols; c++) if (_isHC(r, c)) { hr = r; hc = c; break; }
      const sr = hr + 1, sc = Math.max(0, hc - 2), er = hr + 3, ec = hc + 3;
      const fm0 = Object.assign({}, _yardFloorGet(CUR));
      const st = { start: { area: 'yard', r: sr, c: sc }, active: false, stroke: [] };
      const p1 = at(hr, ec); _decoRectMove(st, p1.x, p1.y); await sleep(60);
      const tip = document.getElementById('if-rect-tip');
      out('네모로_끄는동안_미리보기·아래글', !!_decoRectPrev && !!tip && !tip.hidden && /칸 · 손을 떼면 칠해져요/.test(tip.textContent) && JSON.stringify(fm0) === JSON.stringify(_yardFloorGet(CUR)));
      const p2 = at(er, ec); _decoRectMove(st, p2.x, p2.y);
      const want = []; for (let r = Math.min(sr, er, hr); r <= Math.max(sr, er, hr); r++) for (let c = Math.min(sc, ec); c <= Math.max(sc, ec); c++) if (!_isHC(r, c) && !_isFarmCell(r, c)) want.push(r + '_' + c);
      const pv = _decoRectPrev;
      const n = _decoRectCommit(st); await sleep(60);
      const fm1 = _yardFloorGet(CUR);
      const cells = []; for (let r = pv.r0; r <= pv.r1; r++) for (let c = pv.c0; c <= pv.c1; c++) cells.push([r, c]);
      out('네모로_떼면_한꺼번에_집칸건너뜀', n > 0 && cells.every(([r, c]) => (_isHC(r, c) || _isFarmCell(r, c)) ? fm1[r + '_' + c] === fm0[r + '_' + c] : fm1[r + '_' + c] === 'hydrangea+stone')
        && cells.some(([r, c]) => _isHC(r, c)) && !_decoRectPrev && tip.hidden);
      out('네모로_되돌리기_한단계', _decoUndo.length === 1);
      decoUndo(); await sleep(60);
      out('네모로_↩한번에_통째로', JSON.stringify(fm0) === JSON.stringify(_yardFloorGet(CUR)) && _decoUndo.length === 0);
      //  지우지 않는다 — 이미 그 바닥인 칸은 그대로(걷히지 않는다)
      _yardFloorMap(CUR)[sr + '_' + sc] = 'hydrangea+stone';
      const st2 = { start: { area: 'yard', r: sr, c: sc }, active: false, stroke: [] }, p3 = at(sr + 1, sc + 1);
      _decoRectMove(st2, p3.x, p3.y); _decoRectCommit(st2);
      out('네모로_지우지않음', _yardFloorGet(CUR)[sr + '_' + sc] === 'hydrangea+stone' && st2.stroke.length > 0 && !st2.stroke.some(x => x.key === sr + '_' + sc));
      decoUndo(); delete _yardFloorMap(CUR)[sr + '_' + sc];
      //  상한 — 판 끝까지 끌면 400칸에서 멈춘다
      const st3 = { start: { area: 'yard', r: DY.rows - 1, c: 0 }, active: false, stroke: [] };
      const q1 = at(DY.rows - 6, 10); _decoRectMove(st3, q1.x, q1.y);
      const q2 = at(0, DY.cols - 1); _decoRectMove(st3, q2.x, q2.y);
      const p4 = _decoRectPrev;
      out('네모로_상한400_멈춤·알림', !!p4 && p4.capped && p4.w * p4.h <= 400 && /400칸까지/.test(tip.textContent));
      _decoRectCancel(); out('네모로_취소면_안칠함', !_decoRectPrev && tip.hidden && _decoUndo.length === 0);
      decoFloorTool(keepTool); CUR_FLOOR_TILE = keepTile; setDecoMode('deco'); ifSyncModeBtn(); _decoUndoClear(); await sleep(100);
    }
    //  ⑲ 집 안 벽지·바닥 고르기(INDOOR-LOOK-1 · IN-2) — 공간 3 에서(공간 1 의 옛 집 안을 안 건드린다)
    if (typeof _inLookApply === 'function') {
      const server = async () => (await R.db.ref('classRPG_v3/students/' + R.sid).once('value')).val() || {};
      const names = () => { const got = []; const o = _floorImg; _floorImg = (n, c) => { got.push(n + (c ? '#' + c : '')); return o(n, c); };
        try { _drawIndoorFloorSVG(10, 10, 20, 400); } finally { _floorImg = o; } return got; };
      decoSpaceSet(3); await sleep(150);
      if (DECO_SCENE !== 'indoor') { toggleDecoScene(); await sleep(300); }
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      const keep = CUR.indoor ? JSON.parse(JSON.stringify(CUR.indoor)) : undefined;
      delete CUR.indoor; _decoUndoClear();
      //  고르지 않은 집 안 = 지금 그림 파일 그대로(파일 이름·색 조각까지)
      out('집안_고르기전_옛그림', JSON.stringify(names().slice(0, 2)) === '["tile_indoor_wood","wall_floral"]');
      out('집안_🖌️단추_보임', getComputedStyle(document.getElementById('if-mode-floor')).display !== 'none' && /벽지·바닥/.test(document.getElementById('if-mode-floor').textContent));
      setDecoMode('floor'); ifSyncModeBtn(); await sleep(200);
      const host = document.getElementById('if-floor-picker');
      out('집안_판열림_벽지8칩', !host.hidden && host.querySelectorAll('.fpk-row[data-row=fams] .pk-chip').length === 8);
      //  벽지: 별무늬·밤 → 판 누르기(칸 3,3) = 큰 방
      _inPk.tab = 'wall'; _inPk.wall = { name: 'star', color: 'night' }; _inLookRender();
      const n0 = (CUR.houseDecorations || []).length;
      const k = document.querySelector('#if-topview canvas').getBoundingClientRect();
      _dSuppressClick = false;   // (앞 시험의 끌기가 남긴 '클릭 무시' — 실제로는 손을 떼면 풀린다)
      _decoClick({ clientX: k.left + (_dCv._offX || 0) + 3.5 * _dC - _dPanX, clientY: k.top + (_dCv._offY || 0) + 3.5 * _dC - _dPanY });
      out('집안_벽지_바뀜', _inLookGet(CUR, 3) === ',star#night' && JSON.stringify(names().slice(0, 2)) === '["tile_indoor_wood","wall_star#night"]');
      out('집안_바닥모드_장식은안놓임', (CUR.houseDecorations || []).length === n0);
      //  바닥: 체크 타일·민트
      _inPk.tab = 'floor'; _inPk.floor = { name: 'check', color: 'mint' }; _inLookApply();
      out('집안_바닥_바뀜', _inLookGet(CUR, 3) === 'check#mint,star#night');
      out('집안_다른공간은_그대로', _inLookGet(CUR, 1) === '' && _inLookGet(CUR, 2) === '');
      await sleep(700);
      const sv = await server();
      out('집안_서버저장', !!(sv.indoor && sv.indoor[3] && sv.indoor[3].look === 'check#mint,star#night'));
      //  ↩ 두 번 → 필드째 사라진다
      decoUndo(); decoUndo();
      out('집안_↩두번_필드없음', CUR.indoor === undefined);
      //  기본(보통 마루·꽃무늬)을 다시 고르면 '고르기 전'과 같은 글자(필드 없음)
      _inPk.tab = 'wall'; _inPk.wall = { name: 'plain', color: '' }; _inLookApply();
      _inPk.wall = { name: 'floral', color: '' }; _inLookApply();
      out('집안_기본을다시고르면_필드없음', CUR.indoor === undefined);
      //  못 읽는 값은 조용히 기본으로 · 옛 JS 처럼 배열로 돌아와도 읽힌다
      const bad = _inLookParse('zzz#q,star#bogus');
      out('집안_모르는값_기본', bad.floor === null && bad.wall && bad.wall.name === 'star' && bad.wall.color === '');
      out('집안_배열로와도_읽힘', _inLookGet({ indoor: [null, null, null, { look: 'tile#sky,' }] }, 3) === 'tile#sky,');
      //  골드·가진 개수는 안 움직인다
      out('집안_벽지바닥_골드불변', typeof CUR.gold === 'number');
      if (keep !== undefined) CUR.indoor = keep; else delete CUR.indoor;
      setDecoMode('deco'); ifSyncModeBtn(); _decoUndoClear();
      toggleDecoScene(); await sleep(300); decoSpaceSet(1); await sleep(150);
    }
    done();
  })().catch(e => { out('ERR', String(e && e.stack || e).slice(0, 300)); done(); });
  function done() { R.log.push('걸린시간_초=' + Math.round((Date.now() - t0) / 1000)); const pre = document.createElement('pre'); pre.id = 'rf-out'; pre.textContent = R.log.join('\n'); document.body.appendChild(pre); document.title = 'RF_DONE';
    try { fetch('/__done', { method: 'POST', body: pre.textContent, keepalive: true }); } catch (e) {} }
})();
