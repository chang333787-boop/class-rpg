// 꾸미기 저장 묶기(DECO-SAVE-1) 검사 — 실제 student.html + 실제 SDK(오프라인)
//  ① 쓰기 횟수(묶음이 끝난 뒤까지 센다) ② 잃는 것 0(대기 중 나가는 네 경우) ③ 스냅샷 경합
(function () {
  const R = window.__RF, out = (k, v) => R.log.push(k + '=' + JSON.stringify(v));
  //  [DECO-BUNDLE-1] 그림 주소가 blob: 이면 묶음 안 경로로 되짚어 파일 이름을 본다
  const artIs = (src, re) => { src = String(src || ''); if (re.test(src)) return true;
    if (typeof _ART === 'undefined') return false; const u = src.split('#')[0];
    for (const [p, b] of _ART.urls) if (b === u && re.test(p)) return true; return false; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  //  헤드리스 가상 시간에서는 rAF 가 한참 늦게 돈다. openInteriorFullscreen() 은 rAF 두 번 뒤에 판을 그리고
  //  _decoViewRestore(캔버스를 새로 잡음)를 부르는데, 그게 **다음 시험 도중**에 끼어들어 가끔 false 가 났다
  //  (⑬ 핀치 도중 캔버스가 바뀜 · ⑭ 비교 사이에 배율이 바뀜). 연 뒤에는 그 rAF 가 실제로 돌 때까지 기다린다.
  const rafSettle = (ms) => new Promise(r => { let fin = false; const go = () => { if (!fin) { fin = true; r(); } };
    requestAnimationFrame(() => requestAnimationFrame(go)); setTimeout(go, ms || 4000); });
  //  [DECO-VIEW-FIT-1] 예전 '전체'(마당 0.625 · 집 안 1 · 왼쪽 위) — '전체'가 판 전체 맞춤으로 바뀐 뒤에도 옛 구역(그림 지문·칸 누르기)이
  //   main 과 같은 배율로 재게. '전체' 자체를 재는 곳(㉖)만 decoZoomFit 을 부른다.
  const fitOld = () => { const yd = DECO_SCENE === 'yard'; _decoSetZoom(yd ? Math.min(DY_BASE.cols, DY.cols) / DY.cols : 1, 0, 0); _dPanX = 0; _dPanY = 0; _decoClampPan(); _drawDeco(); };
  const t0 = Date.now();
  //  [DECO-DAYNIGHT-1] 시험은 실제 시각 대신 낮으로 — 헤드리스 시계(UTC)가 밤이면 동물이 자서 먹이통 시험이 흔들렸다(단추로 바꾼 값은 그대로 따른다)
  try { if (typeof _decoPhase === 'function') _decoPhase = function () { return _decoPhaseOv || 'day'; }; } catch (e) {}
  //  [DECO-SEASON-1] 계절도 날짜 대신 여름(바탕 그림)으로 — 그림 지문·조각 수 시험이 달마다 바뀌지 않게(시험에서 바꾼 값은 그대로 따른다)
  try { if (typeof _decoSeason === 'function') _decoSeason = function () { return _decoSeasonOv || 'summer'; }; } catch (e) {}
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

    //  ⑨ 먹는 장(DECO-EAT-1 → DECO-ANIM-LIVE-1) — 먹이통(d_y69, 9/20 머지)은 시험에서만 표에 넣는다
    if (typeof _animSrcFor === 'function') {
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
      //  먹이통 바로 옆 닭 — 생각하면 고리 안이라 그 자리에서 먹이통을 보고 쫀다(쪼기 그림은 _peck, 없으면 옛 _eat)
      //  (화면 밖 동물은 쉰다[DECO-ANIM-LIVE-1] — 그 닭이 가운데 오게 층을 맞춘다)
      if (hen) _animSyncLayer(host, CUR, DECO_SCENE, _dC, _dW, _dH, hen.cur.col * _dC - _dW / 2, hen.cur.row * _dC - _dH / 2);
      if (hen) { hen.nextAt = 0; hen.gathered = true; _animTick(Date.now()); }
      out('먹이통옆_닭_먹는장', !!(hen && artIs(_animSrcFor(hen, 'peck'), /d_y55_(peck|eat)\.svg/)));
      out('먹이통옆_닭_먹이통봄', !!(hen && hen.dir === -1 && !hen.seg));
      out('먹는장_파일있음', !!(_animArt['d_y55'] && (_animArt['d_y55'].peck || _animArt['d_y55'].eat)));
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
        st.seg = null; st.path = []; st.goal = null; st.nextAt = Infinity;   // 걸음을 멈추고 그 칸에 세운다
        st.cur = { row: 30, col }; st.fx = col; st.fy = 30;
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
      fitOld(); await sleep(100);
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
      fitOld(); await sleep(50);
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
      //  [DECO-ANIM-LIVE-1] 동물마다 타이머가 아니라 한 돌림 — 돌고 있으면 1
      const timers = () => (_animRaf || _animWakeT) ? 1 : 0;
      const keep = CUR.houseDecorations;
      CUR.houseDecorations = (keep || []).filter(p => p.id !== 'd_y53' && p.id !== 'd_y55').concat([{ id: 'd_y53', area: 'yard', row: 20, col: 6 }, { id: 'd_y55', area: 'yard', row: 21, col: 9 }]);
      _drawDeco(); await sleep(200);
      out('열려있을때_동물층', _animLayers.size + '층·타이머 ' + timers());
      out('열려있을때_동물_걷는다', _animLayers.size === 1 && timers() === 1);
      closeInteriorFullscreen(); await sleep(300);
      out('닫은뒤_동물층_0', _animLayers.size === 0 && timers() === 0 && !document.querySelector('.deco-anim'));
      openInteriorFullscreen(); await sleep(400);
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      out('다시열면_동물_돌아옴', _animLayers.size === 1 && timers() === 1);
      CUR.houseDecorations = keep; _drawDeco(); await sleep(100);
    }

    //  ⑪ 헤엄 장·밭은 공간 1 만·다 썼을 때 어느 공간(DECO-SWIM-1·DECO-PT-3)
    if (typeof _animProbeArt === 'function') {
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
      if (duck) _animSyncLayer(host, CUR, DECO_SCENE, _dC, _dW, _dH, duck.cur.col * _dC - _dW / 2, duck.cur.row * _dC - _dH / 2);   // 화면 밖이면 쉰다 — 가운데로
      const img = duck && duck.el.querySelector('img');
      out('물위오리_헤엄장', !!(img && artIs(img.src, /d_y56_swim\.svg/)));
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
      fitOld(); await sleep(100); _decoSetZoom(1); await sleep(100);
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
      fitOld(); await sleep(100);
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
      fitOld(); await sleep(100);
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
          //  [DECO-FLOOR-BAKE-1] 칸 조각은 한 장으로 구워 그린다 → 굽기 전에 모은 조각 수로 센다(없으면 drawImage 횟수)
          const drawsFor = (fx3) => { CUR.yardFloor = fx3; let n = 0;
            if (typeof _floorPaint === 'function') { const o = _floorPaint; _floorPaint = function (pc) { n += pc.length; return o.apply(this, arguments); }; try { _drawYard(); } finally { _floorPaint = o; } return n; }
            const o = _dCtx.drawImage; _dCtx.drawImage = function () { n++; return o.apply(this, arguments); }; try { _drawYard(); } finally { _dCtx.drawImage = o; } return n; };
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
      fitOld(); await sleep(100);

      //  옛 집 안(겹침 없음): 윗줄 둘 · 크기 다른 가구 · 러그 둘 — 놓는 길을 거치지 않고 저장본처럼 바로 넣는다(main 에서도 같은 줄이 나오게)
      //  [INDOOR-WALL-1] 0번 줄 액자(d_i4)는 이 PR 부터 **일부러** 한 칸 위 벽 띠로 올라가 그려진다(indoor_look_rules §4) →
      //   그 하나는 ⑳ 에서 따로 재고, 여기는 '그 밖은 한 픽셀도 안 바뀐다'를 지키게 윗줄 둘째를 마법 거울(d_i13)로 둔다.
      CUR.inventory = GAME_DATA.decorations.filter(d => d.cat === 'indoor').map(d => ({ id: d.id, qty: 3 }));
      CUR.houseDecorations = [
        { id: 'd_i3', area: 'indoor', row: 0, col: 2 }, { id: 'd_i13', area: 'indoor', row: 0, col: 4 },
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
      //  [DECO-GPU-1] 그래픽칩(Metal)은 SVG 를 바로 그릴 때 첫 번째와 두 번째부터(캐시된 결)의 픽셀이 조금 다르다
      //   (집 안 마루·벽지 · 최대 36/255 · CPU 그리기에선 없음) → 한 번 데우고 잰다. 지문은 같은 '그래픽'끼리만 견준다.
      await print();
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
      document.getElementById('if-mode-floor').click(); await sleep(250); fitOld(); await sleep(150);
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
    //  ⑳ 벽걸이를 벽 띠에(INDOOR-WALL-1) — 공간 3 에서
    if (typeof _isWallDeco === 'function') {
      decoSpaceSet(3); await sleep(150);
      if (DECO_SCENE !== 'indoor') { toggleDecoScene(); await sleep(300); }
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      CUR.inventory = (CUR.inventory || []).filter(i => !/^d_i(3|4|8)$/.test(i.id)).concat([{ id: 'd_i3', qty: 2 }, { id: 'd_i4', qty: 2 }, { id: 'd_i8', qty: 2 }]);
      setDecoMode('deco'); _decoUndoClear(); fitOld(); await sleep(100);
      const list = () => _decoList(CUR).filter(p => p.area === 'indoor').map(p => p.id + '@' + p.row + ',' + p.col).sort().join(' ');
      const k = () => document.querySelector('#if-topview canvas').getBoundingClientRect();
      const tap = (r, c) => { _dSuppressClick = false; const b = k(); _decoClick({ clientX: b.left + _dCv._offX + (c + .5) * _dC - _dPanX, clientY: b.top + _dCv._offY + (r + .5) * _dC - _dPanY }); };
      out('벽걸이_괘종시계는_가구', !_isWallDeco('d_i3') && _isWallDeco('d_i4'));
      SEL_DECO = 'd_i3'; tap(5, 3);
      out('벽걸이_괘종시계_아무줄에나', /d_i3@5,3/.test(list()));
      SEL_DECO = 'd_i4'; tap(-1, 6);                                       // 벽 띠를 눌러 건다 → 저장은 0번 줄
      out('벽걸이_벽띠눌러_걸림_저장0줄', /d_i4@0,6/.test(list()));
      SEL_DECO = 'd_i4'; tap(4, 9);
      out('벽걸이_바닥에는_안걸림', !/d_i4@4,9/.test(list()));
      SEL_DECO = 'd_i8'; tap(0, 5);                                        // 소파(3×1)가 액자 아래 바닥(0줄 5~7칸)에
      out('벽걸이_아래바닥에_가구', /d_i8@0,5/.test(list()));
      //  그리기: 액자는 벽 띠에 벽걸이 판으로 · 가구는 제 칸에 · 액자 칸의 고정 창은 생략
      const drawn = []; const oI = _decoImg, oS = _drawDecoSVG;
      _drawDecoSVG = (id, px, py, bw, bh) => { drawn.push(id + ':' + Math.round((py - _dCv._offY) / _dC)); return oS(id, px, py, bw, bh); };
      _decoImg = id => { if (/_wall$/.test(id)) drawn.push(id); return oI(id); };
      try { _dCtx.setTransform(2, 0, 0, 2, 0, 0); _drawIndoor(); } finally { _decoImg = oI; _drawDecoSVG = oS; }
      out('벽걸이_벽띠에_벽걸이판', drawn.indexOf('d_i4_wall') >= 0 && !drawn.some(x => /^d_i4:/.test(x)) && drawn.some(x => /^d_i8:/.test(x)));
      //  빈손: 0줄 6칸 바닥 = 소파(맨 위) → 소파 치움 · 다시 = 액자 아래 빈 바닥 → 안 치움 · 벽 띠 6칸 = 액자 치움
      SEL_DECO = null; tap(0, 6); const a1 = list();
      tap(0, 6); const a2 = list();
      tap(-1, 6); const a3 = list();
      out('벽걸이_바닥누르면_가구먼저', !/d_i8/.test(a1) && /d_i4@0,6/.test(a1));
      out('벽걸이_액자아래빈바닥_안치움', a2 === a1);
      out('벽걸이_벽띠누르면_액자치움', !/d_i4/.test(a3));
      decoUndo(); out('벽걸이_↩되살림', /d_i4@0,6/.test(list()));
      //  스포이드 · 오른쪽 클릭도 벽 띠 = 액자 · 바닥 칸 = 액자 아님
      out('벽걸이_벽띠_칸찾기', (() => { const b = k(), c = _decoCellAt(b.left + _dCv._offX + 6.5 * _dC - _dPanX, b.top + _dCv._offY - .5 * _dC - _dPanY); return !!c && c.band && c.r === 0 && c.c === 6; })());
      out('벽걸이_골드불변', typeof CUR.gold === 'number');
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      _decoUndoClear(); SEL_DECO = null; toggleDecoScene(); await sleep(300); decoSpaceSet(1); await sleep(150);
    }
    //  ㉑ 네모로 방 만들기(INDOOR-ROOMS-1 · IN-3) — 공간 3 에서
    if (typeof _inRoomAdd === 'function') {
      decoSpaceSet(3); await sleep(150);
      if (DECO_SCENE !== 'indoor') { toggleDecoScene(); await sleep(300); }
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      const keep = CUR.indoor ? JSON.parse(JSON.stringify(CUR.indoor)) : undefined;
      delete CUR.indoor; _decoUndoClear();
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      const rs = () => (CUR.indoor && CUR.indoor[3] && CUR.indoor[3].rooms) || null;
      out('방_없으면_큰방그대로', _inRooms(CUR).length === 0 && !CUR.indoor);
      setDecoMode('floor'); ifSyncModeBtn(); _inPk.tab = 'room'; _inPk.tool = ''; _inLookRender(); await sleep(100);
      out('방_탭_크기칩셋', [...document.querySelectorAll('#if-floor-picker .fpk-row[data-row=fams] .pk-chip')].filter(e => /작은 방|보통 방|큰 방/.test(e.textContent)).length === 3);
      out('방_네모끌기_모드', _inRoomDragMode() && getComputedStyle(document.getElementById('if-hand-btn')).display !== 'none');
      _inRoomAdd(_inRoomFrom(3, 3, 9, 12));
      out('방_만들기_저장', JSON.stringify(rs()) === '{"a":"3,3,10,7,,"}');
      out('방_겹치면_막힘', !_inRoomAdd(_inRoomFrom(8, 8, 12, 15)) && Object.keys(rs()).length === 1);
      out('방_작으면_막힘', !!_inRoomWhy(_inRooms(CUR), { r: 20, c: 30, w: 3, h: 2 }) && !!_inRoomWhy(_inRooms(CUR), { r: 10, c: 20, w: 21, h: 4 }));
      _inPk.tool = 's0'; _inTap(3, 13);                                    // 작은 방 6×4 를 오른쪽에 붙인다
      out('방_크기칩_붙임', rs() && rs().b === '3,13,6,4,,');
      out('방_붙이면_문', JSON.stringify(_inRoomDoors(_inRooms(CUR))) === '[{"col":13,"r0":4,"r1":6}]');
      _inPk.tool = ''; _inPk.tab = 'wall'; _inPk.wall = { name: 'star', color: 'sky' }; _inTap(5, 15);
      out('방_벽지는_그방만', rs().b === '3,13,6,4,,star#sky' && rs().a === '3,3,10,7,,');
      _inTap(2, 16);                                                        // 벽 띠를 눌러도 그 방
      out('방_벽띠눌러도_그방', rs().b === '3,13,6,4,,star#sky');
      const t0 = [...document.querySelectorAll('.toast-msg')].length; _inTap(20, 40);
      out('방_빈터누르면_안내', /방 밖은 빈 터/.test([...document.querySelectorAll('.toast-msg')].slice(-1)[0].textContent) && rs().a === '3,3,10,7,,');
      _inPk.tab = 'floor'; _inPk.floor = { name: 'carpet', color: 'pink' }; _inTap(6, 6);
      out('방_바닥도_그방만', rs().a === '3,3,10,7,carpet#pink,');
      //  [DECO-RULE-R3] 가구는 방 벽을 가로지르지 않는다 — 놓기도, 새 방의 벽이 있는 가구를 가르는 것도
      setDecoMode('deco');
      CUR.inventory = (CUR.inventory || []).filter(i => i.id !== 'd_i8').concat([{ id: 'd_i8', qty: 3 }]);
      const sofas = () => _decoList(CUR).filter(p => p.id === 'd_i8').map(p => p.row + ',' + p.col).sort().join(' ');
      SEL_DECO = 'd_i8'; _decoPlace('indoor', 6, 11);                   // 방 a(3~12칸)의 오른벽을 가로지름(11~13)
      out('R3_벽가로지르면_안놓임', sofas() === '' && /벽에 걸려요/.test([...document.querySelectorAll('.toast-msg')].slice(-1)[0].textContent));
      _decoPlace('indoor', 6, 9);                                           // 9~11 = 방 안
      _decoPlace('indoor', 15, 20);                                         // 빈 터 — [DECO-INDOOR-RULE-1] 보스 결정 ① 방이 있으면 방 밖은 안 된다
      out('R3_방안은_놓임_방밖은_안됨', sofas() === '6,9' && /방 밖은 마당/.test([...document.querySelectorAll('.toast-msg')].slice(-1)[0].textContent));
      //  옛 저장본엔 방 밖 가구가 있을 수 있다(그대로 둔다) — 새 방의 벽이 그것을 가르는지 보려고 하나 넣는다
      CUR.houseDecorations.push(Object.assign(_decoNew('d_i8', 'indoor', 15, 20)));
      SEL_DECO = null;
      const cutWhy = _inRoomWhy(_inRooms(CUR), _inRoomFrom(13, 21, 18, 30));
      out('R3_새방벽이_가구가르면_막힘', /소파.*가르게 돼요/.test(cutWhy));
      out('R3_가르지않는_새방은_됨', _inRoomWhy(_inRooms(CUR), _inRoomFrom(13, 24, 18, 32)) === '');
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => !(p.sp === 3 && p.id === 'd_i8'));
      setDecoMode('floor');
      //  벽걸이: 방 윗줄(3줄)에 걸리고 벽 띠(2줄)에 그려진다 · 방 밖 가운데 줄엔 안 걸린다
      setDecoMode('deco'); ifSyncModeBtn();
      CUR.inventory = (CUR.inventory || []).filter(i => i.id !== 'd_i4').concat([{ id: 'd_i4', qty: 3 }]);
      out('방_윗줄은_벽줄', _inIsWallRow(3, 15) && !_inIsWallRow(4, 15) && !_inIsWallRow(20, 40));
      SEL_DECO = 'd_i4'; _decoPlace('indoor', 3, 15); _decoPlace('indoor', 20, 40); SEL_DECO = null;
      out('방_윗벽에_액자', _decoList(CUR).some(p => p.id === 'd_i4' && p.row === 3 && p.col === 15) && !_decoList(CUR).some(p => p.id === 'd_i4' && p.row === 20));
      //  방을 없애도 가구는 그대로 · ↩ 로 되살아난다
      const nDeco = _decoList(CUR).length;
      setDecoMode('floor'); ifSyncModeBtn(); _inPk.tab = 'room'; _inPk.tool = 'erase'; _inTap(5, 5);
      out('방_없애도_가구그대로', !rs().a && _decoList(CUR).length === nDeco);
      decoUndo(); out('방_↩되살림', rs().a === '3,3,10,7,carpet#pink,');
      //  [DECO-RULE-R4] 벽걸이가 걸린 방을 없애면 그 액자는 가방으로(바닥 한가운데 서 있지 않게) · ↩ 면 방과 액자가 같이
      const hung = () => _decoList(CUR).filter(p => p.id === 'd_i4' && p.row === 3 && p.col === 15).length;
      const bagN = () => { const inv = (CUR.inventory || []).find(i => i.id === 'd_i4'); return inv.qty - (CUR.houseDecorations || []).filter(p => p.id === 'd_i4').length; };
      const bag0 = bagN(), u0 = _decoUndo.length;
      _inTap(5, 15);                                                        // 액자가 걸린 방 b 를 없앤다
      out('R4_방없애면_액자는가방', !rs().b && hung() === 0 && bagN() === bag0 + 1 && /가방으로/.test([...document.querySelectorAll('.toast-msg')].slice(-1)[0].textContent));
      out('R4_벽밖에_선액자없음', !_decoList(CUR).some(p => p.area === 'indoor' && _isWallDeco(p.id) && !_inIsWallRow(p.row, p.col)));
      out('R4_한단계', _decoUndo.length === u0 + 1);
      decoUndo(); out('R4_↩방과액자같이', rs().b === '3,13,6,4,,star#sky' && hung() === 1 && bagN() === bag0);
      _inPk.tool = 'erase';
      //  못 읽는 값·판 밖·겹침은 읽을 때 버린다(그리기가 안 깨진다)
      const bad = _inRooms({ indoor: { 3: { rooms: { a: '1,1,5,4,,', b: '2,2,5,4,,', c: 'x,y', d: '25,45,10,10,,', e: '10,20,6,4,zzz,star#bogus' } } } }, 3);
      out('방_못읽는값_버림', bad.map(r => r.id).join('') === 'ae' && bad[1].floor === null && bad[1].wall.color === '');
      //  그리기: 방이 있으면 빈 터(도면) 위에 방 · 나가기 문은 가장 아래 방 아래 벽
      _drawDeco(); await sleep(120);
      //  (그림 문[DECO-EXIT-DOOR-1]이면 누르는 자리가 벽선 바로 밖, 옛 네모 문이면 벽선 안쪽 0.75칸 — 어느 쪽이든 그 벽에 붙는다)
      const wallY = _dCv._offY + (3 + 7) * _dC;
      out('방_나가기문_아래방', Math.abs(_dCv._doorY - (_decoImg('in_exit_door') ? wallY - _dC * .04 : wallY - _dC * .75)) < 1);
      //  전체 = 방 둘레
      out('방_전체는_방둘레', _inFitRooms() && _dZoom > 1);
      //  모든 방을 없애면 필드째 사라지고 큰 방으로
      _inRoomsCommit([], ''); out('방_다없애면_큰방', !CUR.indoor);
      out('방_골드불변', typeof CUR.gold === 'number');
      if (keep !== undefined) CUR.indoor = keep; else delete CUR.indoor;
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      _inPk.tab = 'wall'; _inPk.tool = ''; setDecoMode('deco'); ifSyncModeBtn(); _decoUndoClear();
      toggleDecoScene(); await sleep(300); decoSpaceSet(1); await sleep(150);
    }
    //  ㉒ 바닥을 칠할 때도 놓을 때의 규칙(DECO-RULE-R1R2) — 공간 3 마당에서
    if (typeof _floorPaintBlock === 'function') {
      decoSpaceSet(3); await sleep(150);
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(300); }
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      if (CUR.yardFloors) delete CUR.yardFloors[3];
      CUR.inventory = (CUR.inventory || []).filter(i => !/^d_y(9|55|56|29)$/.test(i.id)).concat(['d_y9', 'd_y55', 'd_y56', 'd_y29'].map(id => ({ id, qty: 3 })));
      setDecoMode('deco'); _decoUndoClear(); fitOld(); await sleep(100);
      SEL_DECO = 'd_y9'; _decoPlace('yard', 10, 10);                      // 작은 나무 2×2 → 10~11줄 · 10~11칸
      SEL_DECO = 'd_y55'; _decoPlace('yard', 14, 14);                     // 닭(땅)
      SEL_DECO = 'd_y56'; _decoPlace('yard', 14, 20);                     // 오리(물도 됨)
      SEL_DECO = 'd_y29'; _decoPlace('yard', 16, 20);                     // 갈대(물가 것)
      SEL_DECO = null; setDecoMode('floor'); const fl = () => _yardFloorGet(CUR); const u0 = _decoUndo.length;
      const last = () => [...document.querySelectorAll('.toast-msg')].slice(-1)[0].textContent;
      CUR_FLOOR_TILE = 'water';
      _paintFloor(10, 10);
      out('R1_나무칸_물로안칠함', !fl()['10_10'] && /작은 나무.*물로 못 칠해요/.test(last()) && _decoUndo.length === u0);
      _paintFloor(14, 14);
      out('R2_닭칸_물로안칠함', !fl()['14_14'] && /닭.*물로 못 칠해요/.test(last()));
      CUR_FLOOR_TILE = 'stone'; _paintFloor(14, 14);
      out('R2_닭칸_돌도안칠함', !fl()['14_14'] && /그 바닥으로 못 칠해요/.test(last()));
      CUR_FLOOR_TILE = 'water'; _paintFloor(14, 20); _paintFloor(16, 20); _paintFloor(12, 10);
      out('R1R2_오리·갈대·빈칸은_칠함', fl()['14_20'] === 'water' && fl()['16_20'] === 'water' && fl()['12_10'] === 'water');
      //  끌어서 한 줄(10줄 7~13칸) — 나무 칸 둘만 건너뛰고, 알림은 끝에 한 번
      const st = { start: { area: 'yard', r: 10, c: 7 }, last: { area: 'yard', r: 10, c: 7 }, active: false, stroke: [], mode: null };
      _decoStrokeBegin(st); for (let c = 8; c <= 13; c++) _decoStrokeApply({ area: 'yard', r: 10, c }, st); _decoStrokeEnd(st);
      const row = [7, 8, 9, 10, 11, 12, 13].map(c => fl()['10_' + c] === 'water' ? 1 : 0).join('');
      out('R1_끌기_나무칸만건너뜀', row === '1110011' && /물로 못 칠해요/.test(last()));
      decoUndo();
      out('R1_끌기_↩한번에', [7, 8, 9, 12, 13].every(c => !fl()['10_' + c]));
      //  네모(9~12줄 · 8~12칸) — 나무 칸 넷은 건너뛴다
      const cv = document.querySelector('#if-topview canvas').getBoundingClientRect();
      const at = (r, c) => ({ x: cv.left + (c + .5) * _dC - _dPanX, y: cv.top + (r + .5) * _dC - _dPanY });
      const keepTool = DECO_FLOOR_TOOL; decoFloorTool('rect');
      const rst = { start: { area: 'yard', r: 9, c: 8 }, active: false, stroke: [] }, q = at(12, 12);
      _decoRectMove(rst, q.x, q.y); _decoRectCommit(rst);
      out('R1_네모_나무칸만건너뜀', !fl()['10_10'] && !fl()['11_11'] && fl()['9_8'] === 'water' && fl()['12_12'] === 'water' && /물로 못 칠해요/.test(last()));
      decoFloorTool(keepTool);
      out('R1R2_장식은그대로', _decoList(CUR).filter(p => /^d_y(9|55|56|29)$/.test(p.id)).length === 4);
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      if (CUR.yardFloors) delete CUR.yardFloors[3];
      CUR_FLOOR_TILE = 'grass'; setDecoMode('deco'); _decoUndoClear(); decoSpaceSet(1); await sleep(150);
    }

    //  ㉙ 고름 풀기(DECO-SEL-A5 · 창조자 27회 ⓐ5) — 다 놓으면 · ×0 카드 · 다시 누름(까닭을 말함) · Escape · 카드를 든 채 동물 누름 = 쓰다듬기
    if (typeof _decoSelClear === 'function') {
      decoSpaceSet(3); await sleep(150);
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(300); }
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      const placedN = id => (CUR.houseDecorations || []).filter(p => p.id === id).length;
      CUR.inventory = (CUR.inventory || []).filter(i => !/^d_y(2|54)$/.test(i.id)).concat([{ id: 'd_y2', qty: placedN('d_y2') + 3 }, { id: 'd_y54', qty: placedN('d_y54') + 1 }]);
      setDecoMode('deco'); _decoUndoClear(); renderDecoInv();
      const last = () => [...document.querySelectorAll('.toast-msg')].slice(-1)[0].textContent;
      selectDeco('d_y54'); _decoPlace('yard', 12, 12);
      out('고름_다놓으면_내려놓기', SEL_DECO === null && /다 놓/.test(last()));
      selectDeco('d_y2'); selectDeco('d_y54');                               // 든 카드가 있는데 ×0 카드를 누름
      out('고름_×0카드_누르면_풀림', SEL_DECO === null);
      selectDeco('d_y2'); selectDeco('d_y2');
      out('고름_다시누름_말로', SEL_DECO === null && /내려놓았어요/.test(last()));
      _decoPlace('yard', 14, 8);
      out('고름_방금풀었으면_까닭', /내려놓아서 놓지 않았어요/.test(last()) && !_decoList(CUR).some(p => p.id === 'd_y2' && p.row === 14));
      selectDeco('d_y2'); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      out('고름_Escape', !_ifMode || SEL_DECO === null);
      //  카드를 든 채 보이는 동물을 누르면 — 그 발밑에 놓지 않는다(쓰다듬기)
      _drawDeco(); await sleep(300);
      const rec = _animLayers.get(_ifActiveContainer || 'house-topview'), cat = rec && [...rec.items.values()].find(s => s.id === 'd_y54');
      if (cat) {
        const n0 = placedN('d_y2'), cv = _dCv.getBoundingClientRect();
        selectDeco('d_y2'); _dSuppressClick = false;
        _decoClick({ clientX: cv.left + ((cat.cur.col + .5) * _dC - _dPanX) * cv.width / _dW, clientY: cv.top + ((cat.cur.row + .5) * _dC - _dPanY) * cv.height / _dH });
        out('고름_든채_동물누름_안놓임', placedN('d_y2') === n0 && SEL_DECO === 'd_y2');
      } else out('고름_든채_동물누름_안놓임', '동물층없음(건너뜀)');
      //  좁은 화면(이 하네스 창)은 최근 '줄' — 머리줄 칩은 넓은 화면(901px~)에서만
      out('고름_좁은화면_최근칩숨김', innerWidth >= 901 || document.getElementById('if-deco-quick-head').hidden);
      _decoSelClear(); _decoSelOff = null;
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      _decoUndoClear(); decoSpaceSet(1); await sleep(150);
    }

    //  ㉔ 말 ↔ 실제(DECO-WORDS-1) — 알림이 까닭을 말하고, 처음 아이에게 맞는 말을 한다
    if (typeof _decoCantWhy === 'function') {
      decoSpaceSet(3); await sleep(100);
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(300); }
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      SEL_DECO = 'd_y12';
      out('말_판끝', /판 끝이라/.test(_decoCantWhy(42, 78, 3, 3, 'yard')));
      out('말_집에걸림', /집에 걸려요/.test(_decoCantWhy(1, 42, 3, 3, 'yard')));
      { const k = DECO_SPACE; DECO_SPACE = 1; const fz = _getFarmZone(); out('말_밭에걸림', /밭에 걸려요/.test(_decoCantWhy(fz.startRow - 1, fz.startCol - 1, 3, 3, 'yard'))); DECO_SPACE = k; }   // 밭은 공간 1 에만
      const keepInv = CUR.inventory;
      CUR.inventory = (keepInv || []).filter(i => !GAME_DATA.decorations.some(d => d.id === i.id));
      out('말_장식0이면_상점으로', /상점에서 골라/.test(_decoPickFirstWhy('yard')));
      CUR.inventory = keepInv; SEL_DECO = null;
      out('말_가졌으면_서랍에서', /아래에서 놓을 장식을 먼저/.test(_decoPickFirstWhy('yard')));
      //  처음 아이(마당 장식 0)에게는 '넓어졌어요'를 안 띄운다
      try { localStorage.removeItem('rpg.deco.landHint'); } catch (e) {}
      const keepHD = CUR.houseDecorations; CUR.houseDecorations = (keepHD || []).filter(p => p.area !== 'yard');
      const n0 = [...document.querySelectorAll('.toast-msg')].filter(e => /넓어졌어요/.test(e.textContent)).length;
      _decoLandHint();
      out('말_처음아이_넓어졌어요없음', [...document.querySelectorAll('.toast-msg')].filter(e => /넓어졌어요/.test(e.textContent)).length === n0);
      CUR.houseDecorations = keepHD;
      decoSpaceSet(1); await sleep(100);
    }

    //  ㉕ 동물은 키 큰 장식 바로 뒷줄(솟은 그림 밑)에 서지 않는다(DECO-RULE-R5 · 디자인 D6) — 공간 3
    if (typeof _decoOverflowCells === 'function') {
      decoSpaceSet(3); await sleep(100);
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(300); }
      for (let i = 0; i < 40 && !_decoBBox; i++) await sleep(50);            // 그림 상자 표가 올 때까지
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      const nOf = id => (CUR.houseDecorations || []).filter(p => p.id === id).length;   // 앞 시험이 놓아 둔 수 + 3
      CUR.inventory = (CUR.inventory || []).filter(i => !/^d_y(12|53|1)$/.test(i.id)).concat(['d_y12', 'd_y53', 'd_y1'].map(id => ({ id, qty: nOf(id) + 3 })));
      setDecoMode('deco');
      SEL_DECO = 'd_y12'; _decoPlace('yard', 10, 10);                        // 벚나무 3×3(10~12줄) — 그림이 약 0.9칸 솟는다
      SEL_DECO = 'd_y1'; _decoPlace('yard', 20, 10);                         // 장미(낮다 — 안 솟는다)
      const tree = _decoList(CUR).find(p => p.id === 'd_y12');
      out('R5_벚나무_뒷줄한줄', JSON.stringify(_decoOverflowCells(tree)) === '[[9,10],[9,11],[9,12]]');
      out('R5_낮은꽃은_안막음', _decoOverflowCells(_decoList(CUR).find(p => p.id === 'd_y1')).length === 0);
      const free = _animFreeMaker(CUR, DY.rows, DY.cols);
      out('R5_뒷줄엔_안걸음', !free(9, 11, 1, 1, 'd_y53', false) && free(8, 11, 1, 1, 'd_y53', false) && free(13, 11, 1, 1, 'd_y53', false));
      SEL_DECO = 'd_y53'; _decoPlace('yard', 9, 11);
      out('R5_뒷줄엔_안놓임', !_decoList(CUR).some(p => p.id === 'd_y53') && /바로 뒤라/.test([...document.querySelectorAll('.toast-msg')].slice(-1)[0].textContent));
      _decoPlace('yard', 13, 11); SEL_DECO = null;
      out('R5_앞줄엔_놓임', _decoList(CUR).some(p => p.id === 'd_y53' && p.row === 13));
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      _decoUndoClear(); decoSpaceSet(1); await sleep(100);
    }

    //  ㉖ 화면 맞춤(DECO-VIEW-FIT-1) — '전체'는 폭·높이 둘 다 · 판이 작으면 가운데 · 집 안 방은 판 끝에 붙어도 가운데
    if (typeof _decoWholeZoom === 'function') {
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(300); }
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      decoZoomFit(); await sleep(100);
      const bw = DY.cols * _dC, bh = DY.rows * _dC;
      out('맞춤_전체_판이화면안', bw <= _dW && bh <= _dH + 1);
      out('맞춤_전체_가운데', Math.abs((-_dPanX) - (_dW - bw) / 2) < 1.5);
      toggleDecoScene(); await sleep(300); decoSpaceSet(3); await sleep(150);
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      const keepIn = CUR.indoor ? JSON.parse(JSON.stringify(CUR.indoor)) : undefined;
      _inRoomsSet(CUR, [{ id: 'a', r: 1, c: 0, w: 10, h: 8, floor: null, wall: null }]); _inFitRooms(); await sleep(100);
      const mid = _dCv._offX + 5 * _dC - _dPanX;
      out('맞춤_집안_판끝방도_가운데', Math.abs(mid - _dW / 2) < _dC * 1.5);
      if (keepIn !== undefined) CUR.indoor = keepIn; else delete CUR.indoor;
      decoSpaceSet(1); await sleep(100); toggleDecoScene(); await sleep(300);
    }

    //  ㉗ 내 집 그림(DECO-HOUSE-ART-1) — 디자인 #858 yard_house.svg 로 그린다 · 문 자리는 집 그림 안 · 문을 누르면 집 안
    if (typeof _drawYardHouseArt === 'function') {
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(300); }
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      for (let i = 0; i < 20 && !_decoImg('yard_house'); i++) await sleep(100);
      _drawDeco(); await sleep(50);
      out('집그림_불러옴', !!_decoImg('yard_house'));
      const C = _dC, hx = _houseCol0() * C, { _doorX: dx, _doorY: dy, _doorW: dw, _doorH: dh } = _dCv;
      out('집그림_문은_집안쪽', dx > hx && dx + dw < hx + DH.cols * C && dy + dh <= DH.rows * C);
      const s0 = DECO_SCENE, r = _dCv.getBoundingClientRect();
      _dSuppressClick = false;   // (앞 시험의 끌기가 남긴 '클릭 무시' — 실제로는 손을 떼면 풀린다)
      _decoClick({ clientX: r.left + (dx + dw / 2 - _dPanX) * r.width / _dW, clientY: r.top + (dy + dh / 2 - _dPanY) * r.height / _dH }); await sleep(300);
      out('집그림_문누르면_집안', s0 === 'yard' && DECO_SCENE === 'indoor');
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(300); }
    }

    //  ㉘ 집 안 나가기 문 그림(DECO-EXIT-DOOR-1) — in_exit_door.svg · 누르는 자리는 방 아래 벽 밖 · 발판 칸은 가구를 놓을 수 있다
    if (typeof _drawExitDoorArt === 'function') {
      if (DECO_SCENE !== 'indoor') { toggleDecoScene(); await sleep(300); }
      decoSpaceSet(3); await sleep(150);
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      const keepIn = CUR.indoor ? JSON.parse(JSON.stringify(CUR.indoor)) : undefined, keepDeco = (CUR.houseDecorations || []).slice();
      _inRoomsSet(CUR, [{ id: 'a', r: 3, c: 8, w: 12, h: 8, floor: null, wall: null }]); _inFitRooms();
      for (let i = 0; i < 20 && !_decoImg('in_exit_door'); i++) await sleep(100);
      _drawDeco(); await sleep(50);
      out('나가기문_그림불러옴', !!_decoImg('in_exit_door'));
      const C = _dC, wallY = _dCv._offY + 11 * C, { _doorX: dx, _doorY: dy, _doorW: dw, _doorH: dh } = _dCv;
      out('나가기문_누르는자리는_벽밖', dy >= wallY - C * .1 && Math.abs(dx + dw / 2 - (_dCv._offX + 14 * C)) < 1);
      //  (누를 때마다 캔버스 자리를 다시 잰다 — 좁은 화면은 놓은 뒤 '최근' 줄이 생겨 캔버스가 움직인다)
      const at = (x, y) => { const k = _dCv.getBoundingClientRect(); return { clientX: k.left + (x - _dPanX) * k.width / _dW, clientY: k.top + (y - _dPanY) * k.height / _dH }; };
      SEL_DECO = 'd_i5'; setDecoMode('deco'); _dSuppressClick = false;
      _decoClick(at(dx + dw / 2, wallY - C * .5)); await sleep(150);   // 발판 칸(방 맨 아랫줄)
      //  [DECO-INDOOR-RULE-1] 보스 결정 ② 발판 칸은 비워 둔다(뒤집음 — 전엔 가구가 놓였다)
      out('나가기문_발판칸은_비움', DECO_SCENE === 'indoor' && !_decoList(CUR).some(p => p.id === 'd_i5' && p.row === 10)
        && /나가는 길/.test([...document.querySelectorAll('.toast-msg')].slice(-1)[0].textContent));
      SEL_DECO = null; _dSuppressClick = false;
      _decoClick(at(dx + dw / 2, dy + dh / 2)); await sleep(300);
      out('나가기문_누르면_마당', DECO_SCENE === 'yard');
      CUR.houseDecorations = keepDeco; if (keepIn !== undefined) CUR.indoor = keepIn; else delete CUR.indoor;
      _decoUndoClear(); decoSpaceSet(1); await sleep(100);
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(300); }
    }

    //  ㉚ 알림 한 번에 하나(DECO-TOAST-1 · 계획 U2) — 꾸미기 전체화면에서 둘이 겹치지 않고, 서랍 카드를 안 가린다
    if (_ifMode) {
      toast('하나'); toast('둘');
      const ts = [...document.querySelectorAll('.toast-msg')], dr = document.getElementById('if-deco-drawer').getBoundingClientRect();
      out('알림_하나만', ts.length === 1 && ts[0].textContent === '둘');
      out('알림_서랍위', ts.length > 0 && ts[0].getBoundingClientRect().bottom <= dr.top + 1);
    }

    //  ㉝ 살아 있는 동물(DECO-ANIM-LIVE-1) — 돌림 하나 · 상태 그림 · 동물 제자리는 놓을 곳 표시에서 빈 네모로 안 남는다(ⓑ58)
    if (typeof _animBfs === 'function') {
      decoSpaceSet(3); await sleep(150);
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(300); }
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      CUR.houseDecorations.push({ id: 'd_y54', area: 'yard', row: 12, col: 12, sp: 3 });
      _drawDeco(); await sleep(200);
      const host = _ifActiveContainer || 'house-topview';
      _animSyncLayer(host, CUR, DECO_SCENE, _dC, _dW, _dH, 12 * _dC - _dW / 2, 12 * _dC - _dH / 2);
      out('동물_돌림하나', !!(_animRaf || _animWakeT));
      const cat = [..._animLayers.get(host).items.values()].find(x => x.id === 'd_y54');
      await sleep(600);
      out('동물_상태그림', !!(cat && artIs(cat.img.src, /d_y54(_idle|_walk|_peck|_happy)?\.svg/) && cat.el.classList.contains('live') === !!(_animArt.d_y54 && _animArt.d_y54.idle)));
      SEL_DECO = 'd_y2';
      out('동물제자리_놓을곳덩어리', _decoAnimHomeCells().has('12_12') && !_decoOkCells('yard').has('12_12'));
      SEL_DECO = null; CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      decoSpaceSet(1); await sleep(150);
    }

    //  ㊶ 땅(DECO-GROUND-1 · 창조자 31회 ⓑ71) — 모눈은 고를 때만 · 잔디 얼룩 무늬 · 잔디 위 물건엔 밑동 그림자(돌길 위엔 없음)
    if (typeof _decoGroundPatch === 'function') {
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(300); }
      decoSpaceSet(3); await sleep(150);
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      CUR.houseDecorations.push({ id: 'd_y9', area: 'yard', row: 6, col: 6, sp: 3 }, { id: 'd_y5', area: 'yard', row: 10, col: 6, sp: 3 });
      if (!CUR.yardFloors) CUR.yardFloors = {}; CUR.yardFloors[3] = { '10_6': 'stone', '10_7': 'stone' };
      ['grass_patch_dark', 'grass_patch_light', 'ground_tuft_a', 'ground_tuft_b'].forEach(n => _floorImg(n));
      for (let i = 0; i < 20 && !(_floorImg('grass_patch_dark') && _floorImg('ground_tuft_b')); i++) await sleep(100);
      const spy = () => { const o = { grid: 0, ell: 0 }, st = _dCtx.stroke, sh = _decoGroundShadow;
        _dCtx.stroke = function () { if (String(this.strokeStyle).indexOf('0.12') >= 0) o.grid++; return st.apply(this, arguments); };
        _decoGroundShadow = function () { o.ell++; return sh.apply(this, arguments); };
        try { _drawYard(); } finally { _dCtx.stroke = st; _decoGroundShadow = sh; } return o; };
      SEL_DECO = null; setDecoMode('deco');
      const off = spy(); SEL_DECO = 'd_y2'; const on = spy(); SEL_DECO = null;
      out('땅_모눈은_고를때만', off.grid === 0 && on.grid > 0);
      out('땅_얼룩무늬', !!_groundPatterns(_dC));
      out('땅_밑동그림자_잔디위만', off.ell === 1 || off.ell);   // 나무(잔디) 1 · 벤치(돌길) 0
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3); delete CUR.yardFloors[3];
      decoSpaceSet(1); await sleep(150);
    }

    //  ㊽ 친해지기 저장 칸(DECO-LIFE-1) — 내 마당 동물을 누르면 하루 한 마리 하트 +1 · 잎 쓰기만(통째 저장 0) · 골드 불변
    if (typeof _lifePet === 'function') {
      decoSpaceSet(3); await sleep(100);
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(300); }
      setDecoMode('deco'); _decoSelClear && _decoSelClear(); SEL_DECO = null;
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      const placedN = id => (CUR.houseDecorations || []).filter(p => p.id === id).length;
      CUR.inventory = (CUR.inventory || []).filter(i => i.id !== 'd_y53').concat([{ id: 'd_y53', qty: placedN('d_y53') + 1 }]);
      SEL_DECO = 'd_y53'; _decoPlace('yard', 20, 30); SEL_DECO = null; decoFlush('시험'); await sleep(900);
      _drawDeco(); await sleep(400);
      const petDog = async () => {
        const rec = _animLayers.get(_ifActiveContainer || 'house-topview'), dog = rec && [...rec.items.values()].find(x => x.id === 'd_y53' && x.home.row === 20 && x.home.col === 30);
        if (!dog) return false;
        const cv = _dCv.getBoundingClientRect(); _dSuppressClick = false;
        _decoClick({ clientX: cv.left + ((dog.cur.col + .5) * _dC - _dPanX) * cv.width / _dW, clientY: cv.top + ((dog.cur.row + .5) * _dC - _dPanY) * cv.height / _dH });
        return true;
      };
      const friend = () => { const L = _lifeGet(CUR); const u = Object.keys(L.a).find(k => L.a[k].k === 'd_y53' && L.a[k].r === 20 && L.a[k].c === 30 && L.a[k].sp === 3); return u ? L.a[u] : null; };
      const gold0 = CUR.gold, w0 = _lifeWrites; saves = 0; sets = 0;
      const ok1 = await petDog(); await sleep(300); const ok2 = await petDog(); await sleep(900);
      const f1 = friend();
      out('친해지기_두번쓰다듬기_하트1', ok1 && ok2 ? (!!f1 && f1.h === 1 && f1.d === _lifeDay()) : '동물층없음');
      out('친해지기_잎쓰기1_통째저장0', { 잎: _lifeWrites - w0, saveStudent: saves, sdkSet: sets, 맞나: _lifeWrites - w0 === 1 && saves === 0 && sets === 0 });
      const srv = await new Promise(r => DB._fbRef.child('students/' + CUR.id + '/decoLife').once('value', sn => r(sn.val())));
      const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.keys(x).sort().reduce((o, kk) => (o[kk] = x[kk], o), {}) : x);   // 서버는 키를 차례로 돌려준다
      out('친해지기_서버같음', canon(srv) === canon(CUR.decoLife) ? true : { srv, cur: CUR.decoLife });
      //  다음 날 + 단계 오름(하트 3 = '알아봄') — 날을 하루 민다
      const od = _lifeDay; _lifeDay = t => od(t) + 1;
      try {
        const u = Object.keys(_lifeGet(CUR).a).find(k => _lifeGet(CUR).a[k] === friend());
        _lifeWrite(CUR, { ['a/' + u + '/h']: 2 }); await sleep(300);
        document.querySelectorAll('.toast-msg').forEach(e => e.remove());
        await petDog(); await sleep(600);
        const f2 = friend(), last = [...document.querySelectorAll('.toast-msg')].map(e => e.textContent).join(' ');
        out('친해지기_다음날_+1_단계알림', !!f2 && f2.h === 3 && /알아봄/.test(last) && (_lifeGet(CUR).g.sticker || 0) >= 1 && _lifeGet(CUR).p >= 1);
        out('친해지기_단계알림_볼곳', /선물 상자에서 봐요/.test(last));
      } finally { _lifeDay = od; }
      //  [DECO-LIFE-2] 카드 — 누르면 뜬다 · 이름 고르기(칩) = 잎 쓰기 1 · 통째 저장 0 · 판을 누르면 닫힘 · Escape
      if (typeof _lifeCardOpen === 'function') {
        _lifeCardClose(); await petDog(); await sleep(300);
        out('카드_누르면_뜸', !!_lifeCard && !!document.querySelector('.deco-life-card .dlc-hearts'));
        const w1 = _lifeWrites; saves = 0; sets = 0;
        document.querySelector('.dlc-namebtn').click(); await sleep(100);
        const chips = [...document.querySelectorAll('.dlc-chip')].map(b => b.textContent);
        out('카드_이름칩_강아지다섯_더보기', chips.slice(0, 5).join(',') === '콩이,보리,호두,초코,뭉치' && /더 보기/.test(chips[5] || ''));
        document.querySelector('.dlc-chip[data-n="2"]').click(); await sleep(700);
        const f3 = friend();
        out('카드_이름고르기_잎쓰기1_통째0', { n: f3 && f3.n, 잎: _lifeWrites - w1, saveStudent: saves, sdkSet: sets, 맞나: !!f3 && f3.n === 2 && _lifeWrites - w1 === 1 && saves === 0 && sets === 0 });
        out('카드_이름보임', !!_lifeCard && /보리/.test(document.querySelector('.deco-life-card .dlc-nm').textContent));
        const cv = _dCv.getBoundingClientRect(); _dSuppressClick = false;
        _decoClick({ clientX: cv.left + 5, clientY: cv.top + cv.height - 5 });
        out('카드_판누르면_닫힘', !_lifeCard && !document.querySelector('.deco-life-card'));
        await petDog(); await sleep(200); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        out('카드_Escape_닫힘', !_lifeCard);
        //  [DECO-LIFE-4] 같은 날 또 쓰다듬으면 한 줄(ⓑ97) · 이름을 지었으면 알림도 이름으로(ⓑ99)
        await petDog(); await sleep(200);
        out('카드_같은날_또_한줄', /오늘은 벌써 쓰다듬었어요/.test((document.querySelector('.deco-life-card') || {}).textContent || ''));
        _lifeCardClose();
      }
      //  [DECO-LIFE-3] 작은 선물 — 4단계 닭은 매일 · 누르면 받음 = 잎 쓰기 1 · 통째 0 · 선물 상자 · 친구 구경엔 없음
      if (typeof _lifeGiftTake === 'function') {
        CUR.inventory = (CUR.inventory || []).filter(i => i.id !== 'd_y55').concat([{ id: 'd_y55', qty: placedN('d_y55') + 1 }]);
        SEL_DECO = 'd_y55'; _decoPlace('yard', 22, 34); SEL_DECO = null; decoFlush('시험'); await sleep(900);
        const t0 = _lifeDay(), egg0 = +(_lifeGet(CUR).g.egg || 0);
        _lifeWrite(CUR, { 'a/a90': { k: 'd_y55', r: 22, c: 34, sp: 3, m: t0 - 30, h: 16, d: t0 - 1 } }); await sleep(400);
        _drawDeco(); await sleep(400);
        const gift = () => document.querySelector('.deco-gift');
        out('선물_땅에있음', !!gift());
        const w2 = _lifeWrites; saves = 0; sets = 0;
        if (gift()) gift().click(); await sleep(900);
        const L2 = _lifeGet(CUR);
        out('선물_알림_누가줬나', /닭이 준 선물/.test([...document.querySelectorAll('.toast-msg')].map(e => e.textContent).join(' ')));
        out('선물_받기_잎쓰기1_통째0', { egg: L2.g.egg, 잎: _lifeWrites - w2, saveStudent: saves, sdkSet: sets, 맞나: L2.g.egg === egg0 + 1 && L2.a.a90.gd === t0 && _lifeWrites - w2 === 1 && saves === 0 && sets === 0 });
        _drawDeco(); await sleep(300);
        out('선물_받으면_없어짐', !gift());
        decoGiftBox(true);
        const cellTxt = [...document.querySelectorAll('#deco-giftbox .dgb-cell')].map(e => e.textContent.trim());
        out('선물상자_개수·물음표·골드아님', cellTxt[0] === '×' + (egg0 + 1) && cellTxt.includes('?') && /골드가 아니에요/.test(document.getElementById('deco-giftbox').textContent));
        out('선물상자_사진틀_조각칸', !!document.querySelector('#deco-giftbox .dgb-frame canvas') && /사진 조각 \d \/ 6/.test(document.getElementById('deco-giftbox').textContent));
        decoGiftBox(false);
        out('선물상자_닫힘', !document.getElementById('deco-giftbox'));
        //  [DECO-LIFE-5] 쓰다듬어 단계가 올라 오늘 선물이 생기면 곧바로 땅에(55-ⓑ104) · 누르는 자리 44px 이상(55-ⓒ90)
        _lifeWrite(CUR, { 'a/a90/h': 11, 'a/a90/d': t0 - 1, 'a/a90/gd': null }); await sleep(300);
        document.querySelectorAll('.deco-gift').forEach(e => e.remove()); const rg = _animLayers.get(_ifActiveContainer || 'house-topview'); if (rg && rg.gifts) rg.gifts.clear();
        const hen = rg && [...rg.items.values()].find(x => x.id === 'd_y55' && x.home.row === 22 && x.home.col === 34);
        if (hen) { const cv = _dCv.getBoundingClientRect(); _dSuppressClick = false; _lifeCardClose && _lifeCardClose();
          _decoClick({ clientX: cv.left + ((hen.cur.col + .5) * _dC - _dPanX) * cv.width / _dW, clientY: cv.top + ((hen.cur.row + .5) * _dC - _dPanY) * cv.height / _dH }); }
        await sleep(400);
        const g2 = document.querySelector('.deco-gift');
        out('선물_단계오른즉시_땅에', hen ? (!!g2 && _lifeGet(CUR).a.a90.h === 12) : '동물층없음');
        out('선물_누르는자리_44px', !!g2 && g2.getBoundingClientRect().width >= 43.5 && g2.getBoundingClientRect().height >= 43.5);
      }
      out('친해지기_골드불변', CUR.gold === gold0);
      out('친해지기_자리객체그대로', !(CUR.houseDecorations || []).some(p => 'u' in p));
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      _decoUndoClear(); decoSpaceSet(1); await sleep(150);
    }

    //  ㊾ 동물 누르기 — 그려진 몸으로(DECO-ANIM-HIT-2 · 창조자 43-ⓑ93) · 바로 아래 칸에 닭이 서 있어도 강아지 가운데를 누르면 강아지
    if (typeof _animAtPt === 'function') {
      decoSpaceSet(3); await sleep(100);
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(300); }
      setDecoMode('deco'); SEL_DECO = null;
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      const n3 = id => (CUR.houseDecorations || []).filter(p => p.id === id).length;
      CUR.inventory = (CUR.inventory || []).filter(i => !/^d_y5[35]$/.test(i.id)).concat([{ id: 'd_y53', qty: n3('d_y53') + 1 }, { id: 'd_y55', qty: n3('d_y55') + 1 }]);
      SEL_DECO = 'd_y55'; _decoPlace('yard', 16, 40); SEL_DECO = 'd_y53'; _decoPlace('yard', 15, 40); SEL_DECO = null;
      _drawDeco(); await sleep(400);
      const host = _ifActiveContainer || 'house-topview', rec = _animLayers.get(host);
      const pokes = []; const oPoke = _animPoke; _animPoke = function (st, c) { pokes.push(st.id); return oPoke.apply(this, arguments); };
      try {
        const still = () => rec.items.forEach(st => { st.seg = null; st.path = []; st.cur = { row: st.home.row, col: st.home.col }; st.fx = st.home.col; st.fy = st.home.row; st.jx = 0; st.jy = 0; st.nextAt = Date.now() + 60000; _animPlace(st); });
        const tapImg = (id) => { const st = [...rec.items.values()].find(x => x.id === id && x.home.col === 40); const im = st.img.getBoundingClientRect();
          if (typeof _lifeCardClose === 'function') _lifeCardClose(); _dSuppressClick = false; pokes.length = 0;
          _decoClick({ clientX: im.left + im.width / 2, clientY: im.top + im.height / 2 }); return pokes.slice(); };
        still(); await sleep(50);
        out('누르기_강아지가운데_아래닭있어도_강아지', tapImg('d_y53').join('/') === 'd_y53');
        still(); await sleep(50);
        out('누르기_닭가운데_닭', tapImg('d_y55').join('/') === 'd_y55');
        if (typeof _lifeCardOpen === 'function') {   // 카드가 동물을 덮었을 때 — 단추 아닌 곳을 누르면 닫혀 다시 누를 수 있다
          still(); await sleep(50); tapImg('d_y55'); await sleep(200);
          const card = document.querySelector('.deco-life-card');
          if (card) card.querySelector('.dlc-next').click();
          out('카드_단추아닌곳_누르면_닫힘', !!card && !_lifeCard && !document.querySelector('.deco-life-card'));
        }
      } finally { _animPoke = oPoke; }
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      _decoUndoClear(); decoSpaceSet(1); await sleep(150);
    }

    //  ㊷ 집 안 두꺼운 벽(DECO-INDOOR-WALL-1 · 시안 A) — 위아래 방 문 · 사이 벽은 하나 · 나가기 자리 · 그리기 오류 0
    if (typeof _inWallGeom === 'function') {
      if (DECO_SCENE !== 'indoor') { toggleDecoScene(); await sleep(300); }
      decoSpaceSet(3); await sleep(150);
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      const keepIn = CUR.indoor ? JSON.parse(JSON.stringify(CUR.indoor)) : undefined;
      _inRoomsSet(CUR, [{ id: 'a', r: 3, c: 4, w: 12, h: 8, floor: null, wall: null }, { id: 'b', r: 3, c: 16, w: 9, h: 8, floor: null, wall: null }, { id: 'c', r: 12, c: 6, w: 10, h: 6, floor: null, wall: null }]);
      const R = _inRooms(CUR), D = _inRoomDoors(R), G = _inWallGeom(R, _dCv._offX || 0, _dCv._offY || 0, _dC), ex = _inExitSpot(R);
      out('벽_옆문_위아래문', D.some(d => d.col === 16) && D.some(d => d.row === 11 && d.c1 - d.c0 === 2));
      out('벽_사이벽은_하나', G.shared.length > 0 && !G.back.some(r => Math.abs(r.y + G.T - ((_dCv._offY || 0) + 11 * _dC)) < 1 && r.x >= (_dCv._offX || 0) + 6 * _dC - G.T && r.x < (_dCv._offX || 0) + 16 * _dC));
      out('벽_나가기는_아래방_가운데', ex.room && ex.room.id === 'c' && ex.c0 === 10 && ex.wallRow === 18);
      let err = ''; try { _drawIndoor(); } catch (e) { err = String(e); }
      out('벽_그리기_오류0', !err || err);
      //  [DECO-INDOOR-WALL-2] 떨어져 따로 둔 방에도 나가기 문(창조자 29-ⓑ63) — 첫 문은 그대로 · 그 문 앞 발판 비움 · 누르면 마당으로
      if (typeof _inExitSpots === 'function') {
        _inRoomsSet(CUR, R.map(o => ({ id: o.id, r: o.r, c: o.c, w: o.w, h: o.h, floor: null, wall: null })).concat([{ id: 'd', r: 3, c: 29, w: 6, h: 5, floor: null, wall: null }]));
        const R2 = _inRooms(CUR), E = _inExitSpots(R2), ed = E.find(e => e.room.id === 'd');
        out('벽_따로방도_나가기문', E.length === 2 && E[0].room.id === 'c' && !!ed && ed.wallRow === 8 && ed.c0 === 31);
        out('벽_따로방_발판비움', /나가는 길/.test(_decoRuleWhy('d_i1', 'indoor', ed.matRow, ed.c0, 1, 1) || ''));
        _drawDeco(); await sleep(250);
        const dd = (_dCv._doors || []).find(d => Math.abs(d.x - ((_dCv._offX || 0) + (ed.c0 + 1) * _dC - .64 * _dC)) < 1), k = _dCv.getBoundingClientRect();
        let went = false;
        if (dd) { _dSuppressClick = false; _decoClick({ clientX: k.left + (dd.x + dd.w / 2 - _dPanX) * k.width / _dW, clientY: k.top + (dd.y + dd.h / 2 - _dPanY) * k.height / _dH }); await sleep(300); went = DECO_SCENE === 'yard'; if (went) { toggleDecoScene(); await sleep(300); } }
        out('벽_따로방_문누르면_마당', went);
        //  [DECO-INDOOR-FIT-2] 방이 있으면 벽걸이 안내는 '방의 윗벽' 하나(54-ⓑ103) · 방을 만든 직후 양옆에 다음 방 자리(54-ⓒ89)
        const wm = _decoRuleWhy('in_w_clock', 'indoor', 6, 8, 1, 1) || '';
        out('벽걸이안내_방있으면_방윗벽만', /방의 윗벽/.test(wm) && !/맨 윗줄/.test(wm));
        _inRoomsSet(CUR, []); _inRoomAdd(_inRoomFrom(4, 10, 9, 17)); await sleep(300);
        { const rm = _inRooms(CUR)[0], ox = _dCv._offX || 0, L = (ox + rm.c * _dC - _dPanX) / _dC, Rr = (_dW - (ox + (rm.c + rm.w) * _dC - _dPanX)) / _dC;
          out('방만든직후_양옆여백', L >= 2.5 && Rr >= 2.5 ? true : { L: +L.toFixed(1), R: +Rr.toFixed(1) }); }
      }
      if (keepIn !== undefined) CUR.indoor = keepIn; else delete CUR.indoor;
      decoSpaceSet(1); await sleep(100); toggleDecoScene(); await sleep(300);
    }

    //  ㊸ 집 안 규칙(DECO-INDOOR-RULE-1 · 보스 결정 ①②) — 방이 있으면 방 밖엔 가구·벽걸이 안 됨 · 방이 없으면 어디나 · 위아래 문 통로엔 벽걸이 안 걸림 · 이미 놓인 것은 그대로
    if (typeof _inExitSpot === 'function') {
      if (DECO_SCENE !== 'indoor') { toggleDecoScene(); await sleep(300); }
      decoSpaceSet(3); await sleep(150);
      const keepIn = CUR.indoor ? JSON.parse(JSON.stringify(CUR.indoor)) : undefined;
      if (CUR.indoor) delete CUR.indoor;
      out('규칙_방없으면_어디나', _decoRuleWhy('d_i5', 'indoor', 20, 30, 2, 1) === '');
      _inRoomsSet(CUR, [{ id: 'a', r: 3, c: 4, w: 12, h: 8, floor: null, wall: null }, { id: 'c', r: 12, c: 6, w: 10, h: 6, floor: null, wall: null }]);
      out('규칙_방밖_가구안됨', /방 밖은 마당/.test(_decoRuleWhy('d_i5', 'indoor', 20, 30, 2, 1)));
      out('규칙_방안_가구됨', _decoRuleWhy('d_i5', 'indoor', 5, 6, 2, 1) === '');
      out('규칙_방밖_벽걸이안됨', /방의 윗벽/.test(_decoRuleWhy('d_i4', 'indoor', 0, 30, 1, 1)) && _decoRuleWhy('d_i4', 'indoor', 3, 6, 1, 1) === '');
      const door = _inRoomDoors(_inRooms(CUR)).find(d => d.row === 11);
      out('규칙_위아래문_통로엔_벽걸이안됨', !!door && !_inIsWallRow(12, door.c0) && _inIsWallRow(12, door.c0 - 2));
      if (keepIn !== undefined) CUR.indoor = keepIn; else delete CUR.indoor;
      decoSpaceSet(1); await sleep(100); toggleDecoScene(); await sleep(300);
    }

    //  ㊹ 새 9종(DECO-INDOOR-ITEMS-1 · 사용자 승인 값) — 표 줄 · 벽걸이 등록 · 두 칸 게시판은 방 윗벽에 · 긴 탁자는 방 안에
    if (GAME_DATA.decorations.some(d => d.id === 'in_table_long')) {
      const g = id => GAME_DATA.decorations.find(d => d.id === id) || {};
      //  값은 '같은 값대' 로 승인 — 벽걸이 = 그림 액자 · 긴 탁자 = 소파 · 의자 = 램프(표를 읽을 때 priceAdj 가 price 로 풀린다)
      out('새9종_표', ['in_w_curtain', 'in_w_window2', 'in_w_clock', 'in_w_board', 'in_w_shelf', 'in_w_bookshelf'].every(id => g(id).price === g('d_i4').price && g(id).rarity === 'common' && g(id).cat === 'indoor' && DECO_WALL[id])
        && g('in_w_window2').size.w === 2 && g('in_w_board').size.w === 2 && g('in_table_long').price === g('d_i8').price && g('in_table_long').rarity === 'rare'
        && g('in_table_long').size.w === 4 && g('in_chair_front').price === g('d_i2').price && g('in_chair_back').rarity === 'common');
      if (DECO_SCENE !== 'indoor') { toggleDecoScene(); await sleep(300); }
      decoSpaceSet(3); await sleep(150);
      const keepIn = CUR.indoor ? JSON.parse(JSON.stringify(CUR.indoor)) : undefined;
      _inRoomsSet(CUR, [{ id: 'a', r: 3, c: 4, w: 14, h: 8, floor: null, wall: null }]);
      out('새9종_게시판은_윗벽', _decoRuleWhy('in_w_board', 'indoor', 3, 6, 2, 1) === '' && _decoRuleWhy('in_w_board', 'indoor', 6, 6, 2, 1) !== '');
      out('새9종_긴탁자_방안', _decoRuleWhy('in_table_long', 'indoor', 6, 8, 4, 2) === '' && _decoRuleWhy('in_table_long', 'indoor', 6, 16, 4, 2) !== '');
      if (keepIn !== undefined) CUR.indoor = keepIn; else delete CUR.indoor;
      decoSpaceSet(1); await sleep(100); toggleDecoScene(); await sleep(300);
    }

    //  ㊿ 그림 묶음(DECO-BUNDLE-1) — 받았으면 blob 주소 · 묶음에 **없는** 그림(새로 더한 SVG)은 반드시 낱장 파일로(보스 조건 ④)
    if (typeof _artSrc === 'function') {
      for (let i = 0; i < 40 && _ART.state === 'loading'; i++) await sleep(100);
      out('묶음_받음', _ART.state);
      if (_ART.state === 'ready') {
        const id = 'd_y3';
        delete _ART.files['deco/' + id + '.svg']; delete _DECO_IMG[id];   // 묶음을 만든 뒤 새로 더한 그림인 셈
        _decoImg(id); for (let i = 0; i < 30 && !(_DECO_IMG[id] && _DECO_IMG[id].ok); i++) await sleep(100);
        const rec = _DECO_IMG[id];
        out('묶음에없는그림_낱장으로', !!rec && rec.ok && /\/assets\/deco\/d_y3\.svg$/.test(rec.img.src));
        out('묶음에있는그림_blob', !!_decoImg('d_y1') && /^blob:/.test(_DECO_IMG.d_y1.img.src));
      }
    }

    //  ㉛ 처음 아이 카드(DECO-FIRST-1 · 계획 U3) — 가진 장식 0 이면 서랍에 큰 카드 하나 · 누르면 🛒 상점
    if (_ifMode) {
      const keepInv = CUR.inventory;
      CUR.inventory = (keepInv || []).filter(i => !GAME_DATA.decorations.some(d => d.id === i.id)); renderDecoInv();
      const card = document.querySelector('#if-deco-inv .deco-first-card');
      out('처음아이_카드', !!card);
      if (card) card.click(); await sleep(200);
      out('처음아이_카드누르면_상점', DECO_TAB === 'shop' && document.querySelectorAll('#if-deco-shop .deco-scard').length > 0);
      decoTab('own'); CUR.inventory = keepInv; renderDecoInv(); await sleep(100);

    }

    //  ㉜ 새 아이 첫 마당 본보기(DECO-FIRST-YARD-1 · 디자인 ⑭ (A) 보여주기만) — 마당 장식 0 · 바닥 0 이면 보이고, 저장 0 · 누르기는 판으로 · 놓으면 사라짐
    if (typeof _decoTplSync === 'function' && _ifMode) {
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(300); }
      const keep = { hd: CUR.houseDecorations, yf: CUR.yardFloor, yfs: CUR.yardFloors };
      CUR.houseDecorations = (keep.hd || []).filter(p => p.area !== 'yard'); CUR.yardFloor = {}; CUR.yardFloors = {};
      const snap = JSON.stringify([CUR.houseDecorations, CUR.yardFloor, CUR.yardFloors]);
      _drawDeco(); await sleep(120);
      out('본보기_처음아이에게_보임', _decoTplOn && _decoTplCv && _decoTplCv.style.display === 'block');
      out('본보기_누르기는_판으로', !!_decoTplCv && getComputedStyle(_decoTplCv).pointerEvents === 'none');
      out('본보기_저장0', JSON.stringify([CUR.houseDecorations, CUR.yardFloor, CUR.yardFloors]) === snap);
      CUR.inventory = (CUR.inventory || []).filter(i => i.id !== 'd_y2').concat([{ id: 'd_y2', qty: 5 }]);
      SEL_DECO = 'd_y2'; _decoPlace('yard', 12, 12); await sleep(80);
      out('본보기_놓으면_사라짐', !_decoTplOn && _decoTplCv.classList.contains('is-gone'));
      SEL_DECO = null; CUR.houseDecorations = keep.hd; CUR.yardFloor = keep.yf; CUR.yardFloors = keep.yfs; _decoUndoClear(); _drawDeco(); await sleep(100);
    }

    //  ㉞ 밭 그림(DECO-FARM-ART-1 · 디자인 D12 · #453) — 흙 타일 두 장 · 단계 그림
    if (typeof _farmImg === 'function') {
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(300); }
      decoSpaceSet(1); await sleep(100);
      ['tile_soil_a', 'tile_soil_b', 'stage_sprout', 'stage_grow', 'stage_wither'].forEach(_farmImg);
      for (let i = 0; i < 20 && !(_farmImg('tile_soil_a') && _farmImg('stage_wither')); i++) await sleep(100);
      out('밭그림_불러옴', ['tile_soil_a', 'tile_soil_b', 'stage_sprout', 'stage_grow', 'stage_wither'].every(n => !!_farmImg(n)));
      _drawDeco(); await sleep(60);
      out('밭그림_밭자리그대로', !!(_dCv._farmZone && _dCv._farmZone.cols > 0));
    }

    //  ㉟ 판 위 잔디 띠(DECO-TOP-PAD-1 · 디자인 D7) — 두 칸 위까지 밀 수 있다 · 거기는 놓는 칸이 아니다
    if (typeof DECO_YARD_TOP !== 'undefined') {
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(300); }
      _decoSetZoom(2); _dPanY = -9999; _decoClampPan();
      out('위띠_두칸까지', Math.abs(_dPanY + DECO_YARD_TOP * _dC) < 1);
      out('위띠_놓는칸아님', _decoCellAt(_dCv.getBoundingClientRect().left + 5, _dCv.getBoundingClientRect().top + 5) === null);
      _dPanY = 0; _decoClampPan(); _drawDeco();
    }
    //  ㉟-2 배율을 바꿔도 잔디에 칸마다 줄이 없다(DECO-LAWN-SEAM-1 · 창조자 59-ⓑ105) — 옮기는 값이 406.248 같은 소수여도
    //   잔디 칸끼리 맞닿은 이음새(가로·세로 가운데 3픽셀씩)의 캔버스 알파가 255 · main 은 128~203 이었다
    if (typeof DECO_YARD_TOP !== 'undefined') {
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(300); }
      _decoSetZoom(1.017); _dPanX = 415.633; _dPanY = 106.248; _decoClampPan(); _drawDeco(); await sleep(150);
      const fl = _yardFloorGet(CUR), W = _dCv.width, H = _dCv.height, d = _dCtx.getImageData(0, 0, W, H).data, C = _dC;
      const grass = (r, c) => r >= 0 && c >= 0 && r < DY.rows && c < DY.cols && !_isHC(r, c) && _floorIsGrass(_floorParse(fl[r + '_' + c]).name);
      const A = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 255 : d[(y * W + x) * 4 + 3];
      let n = 0, low = 0;
      for (let r = 1; r < DY.rows; r++) for (let c = 1; c < DY.cols; c++) {
        if (!grass(r, c) || !grass(r - 1, c) || !grass(r, c - 1)) continue;
        const x = (c * C - _dPanX) * 2, y = (r * C - _dPanY) * 2, mx = Math.round(x + C), my = Math.round(y + C);
        if (x < 2 || y < 2 || x + 2 * C > W - 2 || y + 2 * C > H - 2) continue;
        n++;
        for (const k of [-1, 0, 1]) if (A(mx, Math.round(y) + k) < 255 || A(Math.round(x) + k, my) < 255) { low++; break; }
      }
      out('잔디_이음새_불투명', n > 50 && low === 0 && (_dPanX * 2) % 1 !== 0);
      _decoSetZoom(1); _dPanX = 0; _dPanY = 0; _decoClampPan(); _drawDeco();
    }

    //  ㊱ 움직임 층(DECO-MOTION-1 · 계획 C2) — 풍차는 몸통을 캔버스에, 날개는 DOM 층에서 돈다 · 집 안으로 가면 층이 없다
    if (typeof _decoMotionSync === 'function' && _ifMode) {
      decoSpaceSet(3); await sleep(150);
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(300); }
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      CUR.houseDecorations.push({ id: 'd_y11', area: 'yard', row: 8, col: 8, sp: 3 });
      _decoSetZoom(1.4); _dPanX = 4 * _dC; _dPanY = 4 * _dC; _decoClampPan(); _drawDeco();
      for (let i = 0; i < 40 && !_decoMotionBody('d_y11'); i++) { await sleep(100); _drawDeco(); }
      await sleep(150);
      out('움직임_몸통으로그림', _decoMotionBody('d_y11') === 'd_y11_body');
      out('움직임_날개층', document.querySelectorAll('#if-topview .deco-mv-rotate').length === 1);
      //  꾸미기 판 · 친구 구경 판이 아닌 캔버스(사진처럼 판 밖)는 층이 없다 → 본 그림(날개까지)으로 — 몸통을 쓰지 않는다
      //  (친구 구경 판은 [DECO-FRIEND-MOTION-1] 부터 층이 있다 — ㊲ '구경_풍차층')
      { const k = _dCv, fake = document.createElement('canvas'); document.body.appendChild(fake); _dCv = fake;
        out('움직임_판밖캔버스는_본그림', _decoMotionBody('d_y11') === ''); _dCv = k; fake.remove(); }
      toggleDecoScene(); await sleep(300);
      out('움직임_집안엔_층없음', !document.querySelector('.deco-mv-layer'));
      toggleDecoScene(); await sleep(300);
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      decoSpaceSet(1); await sleep(150);
    }

    //  ㊲ 친구 구경 확대·이동·동물 누르기(DECO-FRIEND-VIEW-1 · 계획 C9) — 읽기 전용: 친구 저장본 한 글자도 안 바뀜 · 내 화면 자리 그대로
    if (typeof _ffZoomAt === 'function') {
      const fr = JSON.parse(JSON.stringify(CUR)); fr.id = 'friend-h'; fr.name = '친구'; fr.avatar = '🧒';
      fr.houseDecorations = [{ id: 'd_y53', area: 'yard', row: 6, col: 6 }, { id: 'd_y9', area: 'yard', row: 9, col: 9 }];
      const snap = JSON.stringify(fr), mine = [_dPanX, _dPanY, _dZoom, _dC].join(',');
      openFriendFullscreen(fr); await sleep(400);
      _ffZoomAt(2, 0, 0); await sleep(120);
      out('구경_확대', _ffView.zoom === 2 && _ffView.C === Math.max(4, Math.round(_ffView.C0 * 2)));
      _ffView.panX = 99999; _ffView.panY = 99999; _renderFriendCanvas();
      out('구경_이동은_판안', _ffView.panX === 80 * _ffView.C - _ffView.W || _ffView.panX === Math.max(0, DY_FULL.cols * _ffView.C - _ffView.W));
      _ffView.panX = 0; _ffView.panY = 0; _renderFriendCanvas(); await sleep(100);
      const dog = [..._animLayers.get('ff-topview').items.values()].find(x => x.id === 'd_y53');
      if (dog) _ffTap((dog.cur.col + .5) * _ffView.C, (dog.cur.row + .5) * _ffView.C);
      out('구경_동물누르면_반응', !!document.querySelector('#ff-topview .deco-anim-say'));
      {   //  💗 가 말풍선 왼쪽 밖 — 한 칸 동물에서 '왈!'을 덮던 것(main 은 266px² 겹침)
        const a = document.querySelector('#ff-topview .deco-anim-say'), h = document.querySelector('#ff-topview .deco-anim-heart');
        const A = a && a.getBoundingClientRect(), H = h && h.getBoundingClientRect();
        out('구경_하트는_말풍선밖', !!(A && H && A.width > 0 && Math.max(0, Math.min(A.right, H.right) - Math.max(A.left, H.left)) * Math.max(0, Math.min(A.bottom, H.bottom) - Math.max(A.top, H.top)) === 0));
      }
      closeFriendFullscreen(); await sleep(100);
      out('구경_친구저장본_그대로', JSON.stringify(fr) === snap);
      out('구경뒤_내화면값_그대로', [_dPanX, _dPanY, _dZoom, _dC].join(',') === mine);
      //  친구 마당에서도 풍차가 돈다(DECO-FRIEND-MOTION-1 · 창조자 63-ⓑ107) · 닫으면 층이 없다
      if (typeof _decoMvOf === 'function' && !_animReduced()) {
        const fm = JSON.parse(JSON.stringify(CUR)); fm.id = 'friend-m'; fm.name = '친구';
        fm.houseDecorations = [{ id: 'd_y11', area: 'yard', row: 3, col: 3 }];
        openFriendFullscreen(fm); await sleep(500); _ffRender(); await sleep(300);
        out('구경_풍차층', document.querySelectorAll('#ff-topview .deco-mv').length === 1);
        closeFriendFullscreen(); await sleep(100);
        out('구경_닫으면_층없음', !document.querySelector('#ff-topview .deco-mv-layer'));
      }
    }

    //  ㊳ 내 마당 사진(DECO-PHOTO-1 · 묶음 6) — 한 장이 나오고 화면 상태·저장본은 그대로(내려받기는 시험에서 안 누른다)
    if (typeof decoPhoto === 'function' && _ifMode) {
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(300); }
      const st0 = JSON.stringify([_dPanX, _dPanY, _dZoom, _dC, _dW, _dH, SEL_DECO, DECO_MODE]), sv0 = JSON.stringify(CUR.houseDecorations || []);
      const pc = await decoPhoto({ canvas: true });
      out('사진_한장', !!pc && pc.width >= 24 * 12 && pc.height > 14 * 12);
      out('사진뒤_화면값_저장본_그대로', JSON.stringify([_dPanX, _dPanY, _dZoom, _dC, _dW, _dH, SEL_DECO, DECO_MODE]) === st0 && JSON.stringify(CUR.houseDecorations || []) === sv0);
      toggleDecoScene(); await sleep(300);
      out('사진_집안에선_안내', (await decoPhoto({ canvas: true })) === null && /마당에서 찍어요/.test([...document.querySelectorAll('.toast-msg')].slice(-1)[0].textContent));
      toggleDecoScene(); await sleep(300);
    }

    //  ㊴ 방 크기 바꾸기(DECO-ROOM-RESIZE-1 · 계획 C8) — ⬛ 방에서 오른쪽 변을 3칸 끌면 가로 +3 · ↩ 한 번에 돌아옴
    if (typeof _inRoomEdgeAt === 'function') {
      if (DECO_SCENE !== 'indoor') { toggleDecoScene(); await sleep(300); }
      decoSpaceSet(3); await sleep(150);
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      const keepIn = CUR.indoor ? JSON.parse(JSON.stringify(CUR.indoor)) : undefined;
      _inRoomsSet(CUR, [{ id: 'a', r: 4, c: 6, w: 8, h: 5, floor: null, wall: null }]); _inFitRooms();
      setDecoMode('floor'); _inPk.tab = 'room'; _inPk.tool = ''; _decoUndoClear(); _drawDeco(); await sleep(100);
      const cv = document.querySelector('#if-topview canvas'), k = cv.getBoundingClientRect();
      const at = (r, c) => ({ clientX: k.left + (_dCv._offX + c * _dC - _dPanX) * k.width / _dW, clientY: k.top + (_dCv._offY + r * _dC - _dPanY) * k.height / _dH });
      const pe = (type, p, b) => cv.dispatchEvent(new PointerEvent(type, Object.assign({ pointerId: 41, pointerType: 'mouse', button: 0, buttons: b, bubbles: true, cancelable: true }, p)));
      const a = at(6.5, 14), z = _dC * k.width / _dW;
      out('방크기_가장자리찾음', !!(_inRoomEdgeAt(a.clientX, a.clientY) || {}).R);
      pe('pointerdown', a, 1); for (let i = 1; i <= 6; i++) pe('pointermove', { clientX: a.clientX + z * 3 * i / 6, clientY: a.clientY }, 1);
      pe('pointerup', { clientX: a.clientX + z * 3, clientY: a.clientY }, 0); await sleep(80);
      const w1 = (_inRooms(CUR)[0] || {}).w;
      out('방크기_오른쪽변_끌면_가로+3', w1 === 11);
      decoUndo(); await sleep(50);
      out('방크기_↩한번', (_inRooms(CUR)[0] || {}).w === 8);
      setDecoMode('deco'); _inPk.tab = 'wall'; _decoUndoClear();
      if (keepIn !== undefined) CUR.indoor = keepIn; else delete CUR.indoor;
      decoSpaceSet(1); await sleep(100); toggleDecoScene(); await sleep(300);
    }

    //  ㊺ 낮·저녁·밤(DECO-DAYNIGHT-1) — 단추로 차례대로 · 저녁/밤이면 색 막 · 다시 열면 실제 시각 · 저장 0
    if (typeof decoPhaseCycle === 'function' && _ifMode) {
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(300); }
      const sv0 = JSON.stringify([CUR.houseDecorations, CUR.yardFloor, CUR.indoor]);
      _decoPhaseOv = 'day'; decoPhaseCycle();
      out('낮밤_단추_차례', _decoPhase() === 'evening' && document.getElementById('if-phase-btn').textContent === '🌇');
      decoPhaseCycle();
      const fills = []; const fr = _dCtx.fillRect, fs = () => String(_dCtx.fillStyle);
      _dCtx.fillRect = function () { fills.push(fs()); return fr.apply(this, arguments); };
      try { _drawYard(); } finally { _dCtx.fillRect = fr; }
      out('낮밤_밤이면_색막', _decoPhase() === 'night' && fills.some(f => /rgba\(20, 30, 80/.test(f)) && document.getElementById('if-topview').classList.contains('is-night'));
      closeInteriorFullscreen(); await sleep(200); openInteriorFullscreen(); await sleep(400);
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      out('낮밤_다시열면_실제시각', _decoPhaseOv === null);
      out('낮밤_저장0', JSON.stringify([CUR.houseDecorations, CUR.yardFloor, CUR.indoor]) === sv0);
      //  친구 구경도 밤이면 동물 층이 같은 결로(캔버스 색 막만 깔리고 동물이 밝게 떠 보이던 것)
      _decoPhaseOv = 'night';
      { const fr = JSON.parse(JSON.stringify(CUR)); fr.id = 'friend-n'; fr.name = '친구';
        openFriendFullscreen(fr); await sleep(300);
        const fh = document.getElementById('ff-topview');
        out('낮밤_친구구경도_밤', !!fh && fh.classList.contains('is-night'));
        closeFriendFullscreen(); await sleep(100); }
      //  밤 사진 — 동물은 색 막 뒤에 그리니 화면 동물 층과 같은 필터로(안 하면 밤 사진에 동물만 밝게 떴다)
      if (typeof decoPhoto === 'function') {
        const pet = { id: 'd_y53', area: 'yard', row: 20, col: 3 }; CUR.houseDecorations.push(pet);
        const orig = _drawDecoSVG; let fl = null;
        _drawDecoSVG = function (id) { if (id === 'd_y53' && _decoPhotoMode) fl = String(_dCtx.filter); return orig.apply(this, arguments); };
        try { await decoPhoto({ canvas: true }); } finally { _drawDecoSVG = orig; CUR.houseDecorations.splice(CUR.houseDecorations.indexOf(pet), 1); }
        out('낮밤_밤사진_동물도_어둡게', !!fl && /brightness\(0?\.58\)/.test(fl));
        _drawDeco();
      }
      _decoPhaseOv = null;
    }

    //  ㊻ 바람 한 줄기(DECO-WIND-1) — 지나는 동안 풀·꽃이 기울고 끝나면 0 · 흔들 것이 아닌 장식은 늘 0
    if (typeof _decoWindGust === 'function' && _ifMode) {
      if (DECO_SCENE !== 'yard') { toggleDecoScene(); await sleep(300); }
      decoSpaceSet(3); await sleep(150);
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      const sun = { id: 'd_y7', area: 'yard', row: 6, col: 6, sp: 3 }, bench = { id: 'd_y5', area: 'yard', row: 8, col: 6, sp: 3 };
      CUR.houseDecorations.push(sun, bench);
      _decoSetZoom(1.5); _dPanX = 0; _dPanY = 0; _decoClampPan();
      _decoWindGust(); _decoWind.t0 = performance.now() - 600;   // 줄기 시작 뒤 0.6초 — 왼쪽 해바라기는 흔들리는 중
      out('바람_지나면_기움', Math.abs(_decoWindAngle(sun)) > 0 && _decoWindAngle(bench) === 0);
      _decoWind.t0 = performance.now() - 20000;
      out('바람_지나간뒤_0', _decoWindAngle(sun) === 0);
      if (_decoWind.raf) { cancelAnimationFrame(_decoWind.raf); _decoWind.raf = 0; } _decoWind.set = new Map();
      CUR.houseDecorations = (CUR.houseDecorations || []).filter(p => p.sp !== 3);
      decoSpaceSet(1); await sleep(150);
    }

    //  ㊼ 계절(DECO-SEASON-1) — 달로 고른다 · 겨울 꽃밭은 겨울 바탕에 꽃잎 가장자리 없음 · 풀 번짐 계절색 · 나무는 계절 그림 · 저장 0
    if (typeof _seaHash === 'function') {
      const seaOf = m => { const d = new Date(2026, m - 1, 15), mm = d.getMonth() + 1; return mm >= 3 && mm <= 5 ? 'spring' : mm >= 6 && mm <= 8 ? 'summer' : mm >= 9 && mm <= 11 ? 'autumn' : 'winter'; };
      out('계절_달표', seaOf(1) === 'winter' && seaOf(4) === 'spring' && seaOf(8) === 'summer' && seaOf(11) === 'autumn');
      const sv0 = JSON.stringify([CUR.houseDecorations, CUR.yardFloor, CUR.yardFloors]);
      const names = [], o = _floorImg;
      _floorImg = function (n, c) { names.push(n + (c ? '#' + c : '')); return o.apply(this, arguments); };
      try {
        _decoSeasonOv = 'winter';
        _drawFloorSVG('tulipbed', 5, 5, 0, 0, 20, () => 'grass', 'red'); _drawFloorSVG('stone', 5, 5, 0, 0, 20, () => 'grass');
        _drawFloorSVG('water', 5, 5, 0, 0, 20, () => 'water');
      } finally { _floorImg = o; }
      //  ⑥ 꽃 장식 · ⑦ 우리 — 겨울에만 #winter(다른 철엔 바탕 그림 그대로)
      const amb = [], oa = _ambImg;
      _ambImg = function (n, c) { amb.push(n + (c ? '#' + c : '')); return oa.apply(this, arguments); };
      try {
        _drawDecoSVG('d_y1', 0, 0, 20, 20); _drawDecoSVG('d_y58', 0, 0, 80, 60);
        _decoSeasonOv = 'spring'; _drawDecoSVG('d_y2', 0, 0, 20, 20);
      } finally { _ambImg = oa; }
      out('계절_겨울꽃밭_겨울바탕_꽃잎없음', names.some(n => /^tile_bed_winter_[ab]$/.test(n)) && !names.some(n => /^bed_/.test(n)));
      out('계절_겨울_풀번짐_눈테', names.some(n => /^fringe_grass_.*#winter$/.test(n)));
      out('계절_겨울물_얼음', names.some(n => /^tile_water_[ab]#winter$/.test(n)));
      out('계절_꽃우리_겨울만_눈', amb.includes('d_y1#winter') && amb.includes('d_y58#winter') && !amb.some(n => n.startsWith('d_y2')));
      //  흩뿌림은 나무 둘레에만(디자인 #1083 · 보스) — 나무가 없으면 0 · 벚나무 하나면 그 둘레(가로 반 + 3칸 · 세로 반 + 2칸 × 1.3) 안에만
      {
        const keepH = CUR.houseDecorations, cells = [], marked = new WeakSet(), ofb = _floorBmp, odi = _dCtx.drawImage;
        _decoSeasonOv = 'spring';
        for (let i = 0; i < 30 && !(_floorImg('season_petals_a') && _floorImg('season_petals_b')); i++) await sleep(100);
        _floorBmp = function (n) { const b = ofb.apply(this, arguments); if (/^season_petals_/.test(n)) marked.add(b); return b; };
        _dCtx.drawImage = function (img, x, y) { if (marked.has(img)) cells.push([Math.round(y / _dC), Math.round(x / _dC)]); return odi.apply(this, arguments); };
        let none = -1, tree = null;
        try {
          CUR.houseDecorations = keepH.filter(p => p.area !== 'yard');
          _decoGroundPatch(0, 0, 30, 60, () => true); none = cells.length;
          CUR.houseDecorations = CUR.houseDecorations.concat([{ id: 'd_y12', area: 'yard', row: 12, col: 20 }]); cells.length = 0;
          _decoGroundPatch(0, 0, 30, 60, () => true); tree = cells.slice();
        } finally { _floorBmp = ofb; _dCtx.drawImage = odi; CUR.houseDecorations = keepH; }
        const z = getDecoSize('d_y12'), cx = 20 + z.w / 2, cy = 12 + z.h / 2, rx = (z.w / 2 + 3) * 1.3 + .5, ry = (z.h / 2 + 2) * 1.3 + .5;
        out('계절_흩뿌림_나무없으면0', none === 0);
        out('계절_흩뿌림_나무둘레만', tree.length > 3 && tree.every(([r, c]) => Math.abs(c + .5 - cx) <= rx && Math.abs(r + .5 - cy) <= ry));
      }
      _decoSeasonOv = null;
      out('계절_저장0', JSON.stringify([CUR.houseDecorations, CUR.yardFloor, CUR.yardFloors]) === sv0);
    }

    //  ㉓ 막 누르기 한 판(DECO-FUZZ-1) — 놓기·치우기·칠하기·방·벽지·되돌리기·공간·장면을 섞어 900번(시드 고정) 뒤
    //    놓인 것마다 규칙 검사 · 가진 수 · 서버 = 화면 · 골드 불변. 상용 계획(docs/deco_commercial_plan.md) §1-3·4·5 의 잣대.
    //    (맨 끝에 둔다 — 마당·집 안·공간 1~3 을 다 흔든다)
    {
      let seed = 7; const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
      const yard = GAME_DATA.decorations.filter(d => d.cat === 'yard' && !d.hidden).map(d => d.id);
      const indoor = GAME_DATA.decorations.filter(d => d.cat === 'indoor' && !d.hidden).map(d => d.id);
      //  가진 수 = 앞 시험이 이미 놓아 둔 수 + 3 (앞 시험 몫을 '초과'로 세지 않게)
      const placedN = id => (CUR.houseDecorations || []).filter(p => p.id === id).length;
      CUR.inventory = (CUR.inventory || []).filter(i => !GAME_DATA.decorations.some(d => d.id === i.id)).concat(yard.concat(indoor).map(id => ({ id, qty: placedN(id) + 3 })));
      const tiles = ['water', 'stone', 'sand', 'brick', 'tulipbed#red+picket', 'hydrangea', 'grass'];
      if (!_dCv) { renderHouseDeco(); await sleep(200); }
      const gold0 = CUR.gold, errs = [];
      for (let i = 0; i < 900; i++) {
        const k = rnd(20), area = DECO_SCENE;
        try {
          if (k < 11) { setDecoMode('deco'); SEL_DECO = (area === 'yard' ? yard : indoor)[rnd(area === 'yard' ? yard.length : indoor.length)];
            _decoPlace(area, rnd(area === 'yard' ? DY.rows : DI.rows), rnd(area === 'yard' ? DY.cols : DI.cols)); }
          else if (k < 12) { setDecoMode('erase'); _decoPlace(area, rnd(30), rnd(40)); setDecoMode('deco'); }
          else if (k < 15 && area === 'yard') { setDecoMode('floor'); CUR_FLOOR_TILE = tiles[rnd(tiles.length)]; const r = rnd(40), c = rnd(70); if (!_isHC(r, c) && !_isFarmCell(r, c)) _paintFloor(r, c); setDecoMode('deco'); }
          else if (k < 16 && area !== 'yard') _inRoomAdd(_inRoomFrom(rnd(22), rnd(40), rnd(22) + 3, rnd(40) + 4));
          else if (k < 17 && area !== 'yard') { _inPk.tab = rnd(2) ? 'wall' : 'floor'; _inPk.wall = { name: 'star', color: 'sky' }; _inPk.floor = { name: 'carpet', color: 'pink' }; setDecoMode('floor'); _inTap(rnd(25), rnd(45)); setDecoMode('deco'); }
          else if (k < 18 && area !== 'yard') { _inPk.tab = 'room'; _inPk.tool = 'erase'; setDecoMode('floor'); _inTap(rnd(25), rnd(45)); _inPk.tool = ''; setDecoMode('deco'); }
          else if (k < 19 && rnd(3) === 0) decoUndo();
          else if (k < 19) toggleDecoScene();
          else decoSpaceSet(1 + rnd(3));
        } catch (e) { errs.push(i + ' ' + String(e).slice(0, 60)); }
      }
      for (let i = 0; i < 20; i++) decoUndo();                              // 되돌리기 20번까지 몰아서
      SEL_DECO = null; setDecoMode('deco'); _inPk.tab = 'wall'; _inPk.tool = '';
      const bad = [], keepSp = DECO_SPACE;
      for (let sp = 1; sp <= 3; sp++) {
        DECO_SPACE = sp;
        const list = _decoList(CUR), fl = _yardFloorGet(CUR);
        list.forEach((p, i) => {
          const d = GAME_DATA.decorations.find(x => x.id === p.id), z = getDecoSize(p.id), R = p.area === 'yard' ? DY_FULL : DI_FULL;
          if (p.row < 0 || p.col < 0 || p.row + z.h > R.rows || p.col + z.w > R.cols) bad.push('판밖');
          if (d && d.cat !== p.area) bad.push('장소');
          for (let dr = 0; dr < z.h; dr++) for (let dc = 0; dc < z.w; dc++) {
            const r = p.row + dr, c = p.col + dc;
            if (p.area === 'yard' && _isHC(r, c)) bad.push('집칸');
            if (p.area === 'yard' && _isFarmCell(r, c)) bad.push('밭칸');
            if (p.area === 'yard' && typeof _floorPaintBlock === 'function' && _floorPaintBlock(r, c, fl[r + '_' + c] || 'grass') === p) bad.push('바닥규칙(' + p.id + ')');
          }
          if (p.area === 'indoor' && _isWallDeco(p.id) && !_inIsWallRow(p.row, p.col)) bad.push('벽밖액자');
          if (p.area === 'indoor' && !_isWallDeco(p.id) && typeof _inCrossesWall === 'function' && _inCrossesWall(p.row, p.col, z.w, z.h, _inRooms(CUR))) bad.push('벽가로지름');
          list.forEach((q, j) => { if (j <= i || q.area !== p.area) return; const zq = getDecoSize(q.id);
            if (p.row < q.row + zq.h && q.row < p.row + z.h && p.col < q.col + zq.w && q.col < p.col + z.w && !_decoOverlapOk(p.id, q) && !_decoOverlapOk(q.id, p)) bad.push('겹침'); });
        });
      }
      DECO_SPACE = keepSp;
      const overIds = (CUR.inventory || []).filter(i => (CUR.houseDecorations || []).filter(p => p.id === i.id).length > i.qty).map(i => i.id), over = overIds.length;
      decoFlush('막 누르기'); await sleep(800);
      const sv = (await R.db.ref('classRPG_v3/students/' + R.sid).once('value')).val() || {};
      const norm = v => JSON.stringify(v || null, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.keys(x).sort().reduce((o, kk) => (o[kk] = x[kk], o), {}) : x);
      const arr = v => Array.isArray(v) ? v : Object.values(v || {});
      out('막누르기_오류없음', errs.length === 0 ? true : errs.slice(0, 2).join(' / '));
      out('막누르기_규칙어김0', bad.length === 0 ? true : [...new Set(bad)].join(','));
      out('막누르기_가진수안', over === 0 ? true : overIds.join(','));
      out('막누르기_골드불변', CUR.gold === gold0);
      out('막누르기_서버같음', norm(arr(sv.houseDecorations)) === norm(CUR.houseDecorations) && norm(sv.yardFloor) === norm(CUR.yardFloor)
        && [1, 2, 3].every(k => norm((sv.yardFloors || {})[k]) === norm((CUR.yardFloors || {})[k]) && norm((sv.indoor || {})[k]) === norm((CUR.indoor || {})[k])));
      out('막누르기_놓인수', (CUR.houseDecorations || []).length);
      decoSpaceSet(1); await sleep(100);
    }
    done();
  })().catch(e => { out('ERR', String(e && e.stack || e).slice(0, 300)); done(); });
  function done() { R.log.push('걸린시간_초=' + Math.round((Date.now() - t0) / 1000)); const pre = document.createElement('pre'); pre.id = 'rf-out'; pre.textContent = R.log.join('\n'); document.body.appendChild(pre); document.title = 'RF_DONE';
    try { fetch('/__done', { method: 'POST', body: pre.textContent, keepalive: true }); } catch (e) {} }
})();
