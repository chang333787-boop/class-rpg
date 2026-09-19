// 꾸미기 저장 하네스 — 실제 student.html·student.js·gamedata.js + 실제 firebase SDK(가짜 프로젝트·오프라인).
//  왜: 꾸미기는 조작 한 번마다 학생 문서를 **통째로** 저장한다(_decoPlace·_paintFloor → DB.saveStudent).
//      저장을 0.4초로 묶는 변경(K3)은 **골드 유실이 났던 그 자리**라, 묶기 전후를 같은 잣대로 재려고 만든다.
//  케이스: ?case=place20 | paint20 | closeMid | teacherEdit
//    place20     장식 20개를 40ms 간격으로 놓는다        → 서버 houseDecorations 20개인가 · 쓰기 몇 번인가
//    paint20     바닥 20칸을 40ms 간격으로 칠한다         → 서버 yardFloor 20칸인가 · 쓰기 몇 번인가
//    closeMid    20칸 칠하는 도중 pagehide(창 닫기)        → 닫기 뒤에도 20칸이 다 남았나(묶여 있던 것이 사라지면 FAIL)
//    teacherEdit 칠하는 도중 교사가 골드 +100 을 써 준다   → 칠하기 저장이 그 골드를 되돌리지 않나
//  판정은 **SDK 로컬 값**(서버로 갈 값)으로 한다. 운영 통신 0.
(function () {
  const Q = window.__Q1;
  const log = {};
  const done = () => { const pre = document.createElement('pre'); pre.id = 'q1-out'; pre.textContent = JSON.stringify(log); document.body.appendChild(pre); document.title = 'Q1_DONE'; };
  const CASE = new URLSearchParams(location.search).get('case') || 'place20';
  const N = 20, GAP = 40;          // 아이가 빠르게 놓는 속도(40ms 간격)
  const t0 = Date.now();

  (function wait() {
    const ls = document.getElementById('loading-screen');
    if (!(typeof DB !== 'undefined' && DB._cache && ls && ls.style.display === 'none')) {
      if (Date.now() - t0 < 15000) return setTimeout(wait, 50); log.err = 'timeout'; return done();
    }
    // 준비: 1×1 마당 장식(동물 아님)을 25개 가진 상태로 — SDK 로컬에 직접(저장 창을 안 건드리려고)
    const deco = (GAME_DATA.decorations || []).find(d => d.cat === 'yard' && !d.size
      && !(typeof ANIM_DECO !== 'undefined' && ANIM_DECO[d.id]));
    if (!deco) { log.err = '쓸 장식 없음'; return done(); }
    log.deco = deco.id;
    Q.db.ref('classRPG_v3/students/' + Q.sid).update({ inventory: [{ id: deco.id, qty: 25 }], houseDecorations: [], yardFloor: {} });

    setTimeout(() => {
      try {
        document.getElementById('s-title').classList.add('hidden');
        CUR = JSON.parse(JSON.stringify(DB.getStudent(Q.sid)));
        hideScreen('s-login');
        enterGame();
        openModal('m-house'); if (typeof renderHouse === 'function') renderHouse();
      } catch (e) { log.enterErr = e.message; }
    }, 300);

    setTimeout(() => {
      log.savingBefore = DB._saving;
      log.goldBefore = CUR.gold;
      // 쓰기 횟수 세기: students/<id> 로 나가는 실제 SDK set/update
      let sdkWrites = 0, saveCalls = 0;
      const origChild = DB._fbRef.child.bind(DB._fbRef);
      DB._fbRef.child = (p) => {
        const r = origChild(p);
        if (String(p).startsWith('students/' + Q.sid)) {
          const s = r.set.bind(r), u = r.update.bind(r);
          r.set = (v) => { sdkWrites++; return s(v); };
          r.update = (v) => { sdkWrites++; return u(v); };
        }
        return r;
      };
      const origSave = DB.saveStudent.bind(DB);
      DB.saveStudent = (st) => { saveCalls++; return origSave(st); };

      // 꾸미기 상태 준비(실제 전역 그대로)
      SEL_DECO = deco.id; DECO_SCENE = 'yard'; CUR_FLOOR_TILE = 'dirt';
      let i = 0, closedAt = null;
      const step = () => {
        if (CASE === 'place20') _decoPlace('yard', 1 + (i % 10), 1 + Math.floor(i / 10) * 2);
        else _paintFloor(2 + (i % 10), 2 + Math.floor(i / 10));
        i++;
      };
      (function tick() {
        if (i < N) {
          step();
          if (CASE === 'closeMid' && i === 12 && !closedAt) {           // 절반쯤에서 창 닫기
            closedAt = i;
            window.dispatchEvent(new Event('pagehide'));
            document.dispatchEvent(new Event('visibilitychange'));
          }
          if (CASE === 'teacherEdit' && i === 10) {                      // 교사가 골드 +100
            Q.db.ref('classRPG_v3/students/' + Q.sid + '/gold').set((CUR.gold || 0) + 100);
          }
          return setTimeout(tick, GAP);
        }
        setTimeout(() => {
          log.case = CASE; log.closedAt = closedAt;
          log.saveStudentCalls = saveCalls; log.sdkWrites = sdkWrites;
          Q.db.ref('classRPG_v3/students/' + Q.sid).once('value').then(s => {
            const st = s.val() || {};
            const decos = st.houseDecorations ? Object.values(st.houseDecorations).filter(Boolean) : [];
            const floor = st.yardFloor ? Object.keys(st.yardFloor) : [];
            log.serverDecos = decos.length; log.serverFloor = floor.length;
            log.memDecos = (CUR.houseDecorations || []).length; log.memFloor = Object.keys(CUR.yardFloor || {}).length;
            log.goldAfter = st.gold;
            const placed = CASE === 'place20' ? log.serverDecos : log.serverFloor;
            if (CASE === 'teacherEdit') {
              log.goldExpect = (log.goldBefore || 0) + 100;
              log.VERDICT = (placed === N && st.gold === log.goldExpect) ? 'OK'
                : (placed === N ? 'GOLD_REVERTED' : 'LOST');
            } else {
              log.VERDICT = placed === N ? 'OK' : 'LOST';
              log.lost = N - placed;
            }
            done();
          });
        }, 1200);
      })();
    }, 1800);
  })();
})();
