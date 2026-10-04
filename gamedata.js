// ====================================================
//  우리반 성장 RPG — 공유 게임 데이터 v3 (gamedata.js)
//  ★ 밸런스 v2: 인성→가치, EXP/골드/농장 전면 조정
// ====================================================

// ── [GAMEDATA-SPLIT-1] 여기 있던 'data' 덩어리(835줄)는 gamedata/data.js 로 옮겼다 — 글자 그대로 ──
// ─── Firebase 설정 ────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCV_u6yKdGInPuCJanK4bzBfnLJuvIbyX4",
  authDomain: "class-rpg-6f409.firebaseapp.com",
  databaseURL: "https://class-rpg-6f409-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "class-rpg-6f409",
  storageBucket: "class-rpg-6f409.firebasestorage.app",
  messagingSenderId: "408824743154",
  appId: "1:408824743154:web:382fdd431f7e2dbce13c6b"
};

// ─── Firebase DB (실시간 동기화) ──────────────────────
const DB = {
  KEY: 'classRPG_v3',
  ADMIN_KEY: 'classRPG_adminPw',
  _cache: null,
  _fbRef: null,
  _fbAdminRef: null,
  _onChangeCb: null,
  _saving: false,
  // [SYNC-MERGE-2] 학생 기록 합치기 상태 — 설계 docs/sync_merge_design.md
  _stuBase: {},          // 학생 id → 이 기기가 서버(내 쓰기 포함)에서 마지막으로 본 값(깊은 복사 · 화면 코드가 못 건드림)
  _stuBaseCb: null,      // onDataChange 콜백이 도는 동안만: 이번 판 **전** 기준(출신 모르는 깊은 복사 CUR 용)
  _stuRaw: {},           // 학생 id → 지난 판 서버 원문(JSON) — 안 바뀐 학생은 다시 재지 않는다
  _stuKeyed: null,       // students/<id> 키에 진짜 기록이 있는 학생 id 모음(없으면 칸 저장 대신 통째 set)
  _stuOrigin: new WeakMap(),   // 학생 객체 → 그 객체가 맞춰져 있는 서버 값(안 보낸 고침 = 객체 − 이것)
  _stuNext: new WeakMap(),     // 받은 판에 밀린 옛 학생 객체 → 그 자리를 이은 새 객체(옛 객체를 저장하면 새 객체로 넘긴다)
  _snapLatest: null, _snapQueued: false, _held: null,

  async init(opts) {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    this._fbRef = firebase.database().ref(this.KEY);
    this._fbAdminRef = firebase.database().ref(this.ADMIN_KEY);
    this._profile = (opts && opts.profile) || null;   // [STUDENT-COLD-1] 'student' = 학생 기기

    // 실시간 동기화 리스너 — 다른 기기 변경사항 반영
    //   [STUDENT-COLD-1] root 판은 root on('value') 로, 학생 판은 노드별 구독을 합친 "가상 root 스냅샷"으로 **같은 함수**를 부른다.
    //   [SYNC-MERGE-2] 받은 판은 적어 두기만 하고 **마이크로태스크에서 마지막 판 하나만** 처리한다.
    //     SDK 는 이 기기의 set/update **안에서** 이 콜백을 동기로 부른다. 'CUR.gold += g → DB.logGold() → DB.saveStudent(CUR)'
    //     한가운데서 캐시를 갈아 끼우면 CUR 이 옛 값으로 바뀌어 번 골드가 사라졌다(M1). 한 덩어리 코드가 다 돈 뒤에 바꾼다.
    //     SDK 는 내 쓰기를 판에 겹쳐 보여 주므로 마지막 판이 앞의 판을 다 담고 있다.
    const liveHandler = (snap) => {
      this._snapLatest = snap;
      if (this._snapQueued) return;
      this._snapQueued = true;
      Promise.resolve().then(() => {
        this._snapQueued = false;
        const s = this._snapLatest;
        this._snapLatest = null;
        if (s) this._onSnap(s);
      });
    };
    this._liveHandler = liveHandler;

    if (this._profile === 'student' && await this._initStudentNodes()) return;

    // 초기 데이터 로드 — [INIT-SINGLE-LOAD-1] once('value') 대신 on('value') 의 첫 스냅샷.
    //   once 가 끝나면 SDK 가 그 구독을 내리고 캐시를 버려, 곧이어 건 on 이 root 를 **통째로 한 번 더** 받았다
    //   (에뮬레이터 + SDK 9.23 실측 2배). 첫 리스너를 붙여 둔 채 아래 실시간 리스너를 걸면 SDK 캐시에서 바로 받는다.
    let firstLoadResolve = null;
    const firstLoad = (s) => { if (firstLoadResolve) { firstLoadResolve(s); firstLoadResolve = null; } };
    const snap = await new Promise((resolve, reject) => {
      firstLoadResolve = resolve;
      this._fbRef.on('value', firstLoad, reject);
    });
    let data = snap.val();

    if (!data) {
      data = this._defaultData();
      if (this._profile !== 'student') await this._rootSet(data);   // [STUDENT-COLD-1] G1 — 빈 DB 설치는 교사 화면만
    }
    this._cache = this._ingest(data);   // [SYNC-MERGE-2] 정규화 + 학생 기준 적기

    // 첫 리스너는 아래 실시간 리스너를 건 **뒤**에 뗀다 — 먼저 떼면 구독이 끊겨 root 를 다시 통째로 받는다
    setTimeout(() => this._fbRef.off('value', firstLoad), 0);

    this._fbRef.on('value', liveHandler);
  },

  // ── [SYNC-MERGE-2] 받은 판 처리 ──────────────────────────────
  //  학생은 판마다 새 객체(예전과 같음)인데, 이전 객체에 아직 안 보낸 고침이 있으면 새 서버 값 위에 다시 얹는다(_stuAdopt).
  //  서버 원문이 안 바뀐 학생은 이전 객체를 그대로 쓴다.
  //  저장 창(_saving: 작품 고치기·설정 저장·비번 요청이 연다) 동안에도 학생 기록·settings 는 바로 반영한다.
  //  예전엔 창 동안 온 판을 settings 말고 **버려서**, 학생이 계속 저장하면 교사 승인이 영영 안 보이고(R2)
  //  다음 통째 저장이 승인 전 값으로 덮었다(M2). 나머지 노드는 창이 닫힐 때(_endSaving) 그 사이 마지막 판으로 바꾼다.
  _onSnap(snap) {
    const d = snap.val();
    if (!d) return;
    const prevBase = this._stuBase;
    const next = this._ingest(d);
    if (this._saving && this._cache) {
      const sameSettings = JSON.stringify(next.settings) === JSON.stringify(this._cache.settings);
      this._cache.students = next.students;
      if (!sameSettings) this._cache.settings = next.settings;
      this._held = next;
    } else {
      this._held = null;
      this._cache = next;
    }
    this._fireChange(prevBase);
  },

  // 저장 창을 닫는 자리(창을 여는 곳마다 setTimeout 으로 부른다). 창 동안 받아 둔 판이 있으면 지금 캐시로.
  _endSaving() {
    this._saving = false;
    const held = this._held;
    this._held = null;
    if (!held || !this._cache) return;
    held.students = this._cache.students;   // 학생·설정은 창 동안 이미 반영(그 뒤 이 기기 저장까지 들어 있다)
    held.settings = this._cache.settings;
    this._cache = held;
    this._fireChange(this._stuBase);
  },

  // onDataChange 콜백 — 도는 동안만 '이번 판 전 기준'을 열어 둔다. student.js 콜백 첫머리의 decoFlush('스냅샷') 이
  //   아직 안 바뀐 **깊은 복사 CUR**(로그인 때 만든 것, 출신 모름)을 저장할 때 방금 온 남의 변경을 되돌리지 않게.
  _fireChange(prevBase) {
    if (!this._onChangeCb) return;
    this._stuBaseCb = prevBase;
    try { this._onChangeCb(); } finally { this._stuBaseCb = null; }
  },

  // 서버 판(d) → 캐시 모양. 학생 기준·출신을 적고 이전 캐시의 학생 객체를 이어 쓴다. d 는 이 함수가 바꾼다(정규화).
  _ingest(d) {
    const raw = d && d.students;
    const keyed = new Set(), rawStr = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const k of Object.keys(raw)) {
        const v = raw[k];
        if (v && typeof v === 'object' && v.id === k) { keyed.add(k); rawStr[k] = JSON.stringify(v); }
      }
    }
    const next = this._migrate(this._normalizeArrays(d));
    this._stuKeyed = keyed;
    this._stuAdopt(next.students, rawStr);
    return next;
  },

  _stuAdopt(list, rawStr) {
    const prev = new Map();
    for (const s of ((this._cache && this._cache.students) || [])) if (s && s.id) prev.set(s.id, s);
    const oldBase = this._stuBase || {}, oldRaw = this._stuRaw || {};
    const base = {};
    for (let i = 0; i < list.length; i++) {
      const N = list[i], id = N.id, O = prev.get(id);
      // 서버 원문이 지난 판과 같으면 이 학생은 그대로(안 보낸 고침도 그대로 둔다)
      if (O && O !== N && rawStr[id] !== undefined && rawStr[id] === oldRaw[id] && oldBase[id] && this._stuOrigin.has(O)) {
        base[id] = oldBase[id];
        list[i] = O;
        continue;
      }
      const nb = this._clone(N);
      base[id] = nb;
      this._stuOrigin.set(N, nb);
      if (!O || O === N) continue;
      // 옛 객체(O)는 건드리지 않고 **새 객체(N)** 를 캐시에 둔다 — 예전처럼 판마다 새 객체라 화면 코드의 'CUR = fresh' 앞뒤 비교
      //   (#1161 선생님 승인 레벨업 축하: prevLv = CUR.level → CUR = fresh)가 그대로 맞는다.
      //   O 에 안 보낸 고침이 있으면 N 이 **넘겨받는다**(셈 칸은 차이 · 보상은 id · 그 밖은 내 값을 N 에 얹고, O 는 고침 없음으로).
      //   O 를 나중에 저장하면(스냅샷 콜백 첫머리 decoFlush 가 옛 CUR 을 저장) N 으로 넘겨 저장한다(_stuNext) — 한 번만 나간다.
      const orig = this._stuOrigin.get(O) || oldBase[id];
      const edits = orig ? this._stuDiff(orig, O) : null;
      if (edits && !this._opsEmpty(edits)) this._assign(N, this._stuApply(nb, edits));
      this._stuOrigin.set(O, this._clone(O));
      this._stuNext.set(O, N);
    }
    this._stuBase = base;
    this._stuRaw = rawStr;
  },

  // ── [STUDENT-COLD-1] 학생 기기 부분 캐시 ─────────────────────
  //  설계: 클로드코드/보고_20260915/설계_S2_부분캐시가드_rf.md
  //  학생 기기는 큰데 남의 것은 안 쓰는 노드를 root 구독에서 빼고(COLD), 로그인 뒤 내 것만 키 범위로 받는다(MINE).
  //  교사(admin)·키오스크는 지금처럼 root 통째. 이 판에서는 캐시가 **부분**이므로 root 통째 저장을 막는다(G1).
  //  quests 는 _normalizeArrays 가 questLogs 에서 늘 다시 만들어 서버 값을 안 쓴다(옛 롤백이 남긴 사본).
  //  goldDaily 는 학생 화면이 읽지 않고 logGold 가 한 칸 increment 로 쓰기만 한다. 학생 기기가 이 경로를 **들으면**
  //  logGold 의 update() 가 동기 value 이벤트를 띄워 onDataChange 가 CUR 을 옛 캐시로 바꾸고 다음 saveStudent 가
  //  골드 빠진 학생을 저장했다(골드 유실 M1). 안 들으면 이벤트가 안 뜬다 — [STUDENT-GOLDDAILY-COLD-1] 실제 SDK 로 확인.
  STUDENT_COLD: ['quests', 'quizRecords', 'emotionLogs', 'emotionReflections', 'backups', 'goldDaily'],
  STUDENT_MINE: ['emotionLogs', 'emotionReflections'],   // 키가 `<sid>_…` 로 시작 → orderByKey 범위, 색인 불필요
  //  지금 운영에 없어도(null) 학생 화면이 읽는 노드 — 나중에 생기면 바로 받도록 미리 구독(null 구독은 비용 0)
  STUDENT_KNOWN: ['settings', 'students', 'questLogs', 'boardQuests', 'artworks', 'memories', 'memoryAlbums',
    'promotionRequests', 'pwResetRequests', 'weeklyGoals', 'weeklyReflections', 'customProblems', 'customWords',
    'teacherWordSets', 'recorderLogs', 'recorderSongs', 'problemRecords', 'studentNotes', 'emotionPromptStats',
    'emotionAlerts', 'customMonsters', 'customQuestTemplates', 'hiddenQuestTemplates'],

  // G1: 부분 캐시로 root 통째 저장하면 빠진 노드가 운영에서 지워진다
  _rootSet(data) {
    if (this._profile === 'student') throw new Error('[STUDENT-COLD-1] 학생 기기는 root 통째 저장 금지(부분 캐시)');
    return this._fbRef.set(data);
  },

  _studentVal() {
    const d = {};
    for (const k of Object.keys(this._snaps || {})) { const v = this._snaps[k] && this._snaps[k].val(); if (v != null) d[k] = v; }
    return d;
  },
  _studentEmit() { if (this._liveHandler) this._liveHandler({ val: () => this._studentVal() }); },

  // 노드 이름: shallow REST(수백 바이트) ∪ STUDENT_KNOWN − STUDENT_COLD. 실패하면 false → root 판으로
  async _initStudentNodes() {
    let names;
    try {
      const base = new URL(firebase.app().options.databaseURL);
      const u = new URL(base.origin + base.pathname.replace(/\/+$/, '') + '/' + this.KEY + '.json');
      base.searchParams.forEach((v, k) => u.searchParams.set(k, v));   // 에뮬레이터 ?ns= 유지
      u.searchParams.set('shallow', 'true');
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const t = ctl ? setTimeout(() => ctl.abort(), 8000) : 0;
      const res = await fetch(u.toString(), ctl ? { signal: ctl.signal } : undefined);
      if (t) clearTimeout(t);
      if (!res.ok) return false;
      const top = await res.json();
      if (!top || typeof top !== 'object') return false;   // 빈 DB → root 판(학생은 기본값도 안 씀)
      names = [...new Set([...Object.keys(top), ...this.STUDENT_KNOWN])].filter(n => !this.STUDENT_COLD.includes(n));
    } catch (e) { return false; }

    this._snaps = {};
    this._studentReady = false;
    await Promise.all(names.map(name => new Promise((resolve, reject) => {
      let first = true;
      this._fbRef.child(name).on('value', (s) => {
        this._snaps[name] = s;
        if (first) { first = false; resolve(); return; }
        if (this._studentReady) this._studentEmit();
      }, reject);
    })));
    this._cache = this._ingest(this._studentVal());   // [SYNC-MERGE-2] 정규화 + 학생 기준 적기
    this._studentReady = true;
    return true;
  },

  // 학생 로그인 직후, 첫 화면 그리기 전에 부른다(G3). 학생이 바뀌면 이전 구독을 떼고 비운다(G7).
  attachMine(sid) {
    if (!this._snaps) return Promise.resolve();          // root 판이면 이미 전부 있음
    (this._mineOffs || []).forEach(off => off());
    this._mineOffs = [];
    for (const n of this.STUDENT_MINE) { delete this._snaps[n]; if (this._cache) this._cache[n] = {}; }
    if (!sid) return Promise.resolve();
    const one = (name) => new Promise((resolve) => {
      const q = this._fbRef.child(name).orderByKey().startAt(sid + '_').endAt(sid + '_\uf8ff');
      let first = true;
      const cb = (s) => {
        this._snaps[name] = s;
        if (first) { first = false; resolve(); } else if (this._studentReady) this._studentEmit();
      };
      q.on('value', cb);
      this._mineOffs.push(() => q.off('value', cb));
    });
    const loaded = Promise.all(this.STUDENT_MINE.map(one)).then(() => {
      // 첫 판은 캐시에 바로 넣는다 — 로그인 순간 _saving 이면 핸들러가 settings 만 보고 돌아가기 때문
      //   (emotionLogs·emotionReflections 는 _normalizeArrays 에서 키 객체 그대로라 같은 모양)
      for (const n of this.STUDENT_MINE) if (this._cache) this._cache[n] = (this._snaps[n] && this._snaps[n].val()) || {};
      if (this._onChangeCb) this._onChangeCb();
    });
    // 8초 안에 안 오면 전체를 한 번 받아 내 것만 거른다(느려도 틀리지 않게)
    const slow = new Promise(r => setTimeout(r, 8000)).then(() => Promise.all(this.STUDENT_MINE.map(n =>
      this._snaps[n] ? null : this._fbRef.child(n).once('value').then(s => {
        const all = s.val() || {}, mine = {};
        for (const k of Object.keys(all)) if (k.startsWith(sid + '_')) mine[k] = all[k];
        if (this._cache && !this._snaps[n]) this._cache[n] = mine;
      })))).catch(() => {});
    return Promise.race([loaded, slow]);
  },

  onDataChange(fn) { this._onChangeCb = fn; },

  _defaultData() {
    return {
      students: JSON.parse(JSON.stringify(GAME_DATA.defaultStudents)),
      quests: [], promotionRequests: [], boardQuests: [],
      artworks: [], pwResetRequests: [],
      settings: {
        className:'우리반', bossActive:false, bossName:'거대 트롤',
        bossIcon:'🧌', bossGold:150, monsterWinRate:80,
        baseExp:80, baseGold:50, monsterDailyLimit:2,
      }
    };
  },

  // Firebase는 배열을 객체로 저장 → 다시 배열로 변환
  _normalizeArrays(data) {
    const toArr = v => v == null ? [] : Array.isArray(v) ? v : Object.values(v);
    data.students          = toArr(data.students).map(s => {
      if (!s) return null;
      s.farm             = toArr(s.farm);
      s.inventory        = toArr(s.inventory);
      s.books            = toArr(s.books);
      s.houseDecorations = toArr(s.houseDecorations);
      s.achievements     = toArr(s.achievements);
      s.titles           = toArr(s.titles);
      s.monsterLog       = toArr(s.monsterLog);
      s.pendingRewards   = toArr(s.pendingRewards);
      return s;
    }).filter(s => s && s.id && s.name); // id/name 없는 껍데기 학생 노드 제외 (렌더 불가)
    // 중복 학생 제거 후 ID 기준 정렬 (순서 항상 고정)
    //
    // [DUP-STUDENT-1] students 에는 같은 학생이 두 벌 있다.
    //   2026-03-14 까지 students/<배열인덱스> 로 저장하다가(1cd703d)
    //   03-15 부터 students/<id> 로 바꿨는데(b46f0b0) 옛 숫자 키 노드를 옮기거나 지우지 않았다.
    //   운영 DB 에 지금도 숫자 키(낡은 스냅샷) + id 키(현재 본)가 함께 있다.
    //
    //   아래 seen.set 은 "나중 것 승"이라 낡은 본이 이길 것처럼 보이지만 그렇지 않다.
    //   Object.keys/values 는 **정수형 키를 항상 먼저(오름차순), 문자열 키를 그 뒤에** 돌려준다
    //   (OrdinaryOwnPropertyKeys). 학생 id 는 항상 's' 로 시작하므로
    //   (doAddStudents: 's' + Date.now(), 기본 학생 s1~s6) 정수형 키가 될 수 없다.
    //   → 숫자 키가 먼저, id 키가 뒤 → id 본이 **항상** 이긴다. 우연이 아니라 명세다.
    //
    //   ⚠️ 다만 이 정확성은 **그 순서에 기대고 있다.**
    //     여기에 키 정렬을 넣거나, 학생 id 형식을 숫자로 바꾸거나, Map·배열 등 다른 자료구조로
    //     옮기면 **조용히 깨진다**(낡은 레벨·골드가 이겨 화면이 과거로 보이고, 그 상태로
    //     저장되면 진행이 사라진다). 에러는 안 난다.
    //     scripts/smoke-test.mjs 의 "학생 중복 시 id 키 본 우선" 검사가 이 자리를 지킨다.
    const seen = new Map();
    data.students.forEach(s => seen.set(s.id, s));
    data.students = Array.from(seen.values())
      .sort((a, b) => {
        const na = parseInt((a.id||'').replace(/\D/g,'')) || 0;
        const nb = parseInt((b.id||'').replace(/\D/g,'')) || 0;
        return na - nb;
      });
    // questLogs가 완료 판정의 단일 소스 (quests 배열 인덱스 충돌 방지)
    data.quests = Object.values(data.questLogs || {})
      .filter(q => q != null && typeof q === 'object' && q.studentId);
    data.promotionRequests  = toArr(data.promotionRequests);
    data.boardQuests        = toArr(data.boardQuests);
    data.artworks           = toArr(data.artworks);
    // memories 중복 제거 — 같은 id가 여러 경로로 저장된 경우
    // 앨범 지정된 것(albumId 있는 것) 우선 보존
    {
      const raw = toArr(data.memories);
      const seen = new Map();
      raw.forEach(m => {
        if (!m || !m.id) return;
        const prev = seen.get(m.id);
        // 앨범 지정된 것 또는 처음 등장한 것 저장
        if (!prev || (m.albumId && !prev.albumId)) seen.set(m.id, m);
      });
      data.memories = Array.from(seen.values());
    }
    data.memoryAlbums       = toArr(data.memoryAlbums);
    data.recorderLogs       = toArr(data.recorderLogs);
    data.recorderSongs      = toArr(data.recorderSongs);
    data.weeklyGoals        = toArr(data.weeklyGoals);
    data.weeklyReflections  = toArr(data.weeklyReflections);
    data.customWords        = toArr(data.customWords);
    data.teacherWordSets    = toArr(data.teacherWordSets);
    data.quizRecords        = toArr(data.quizRecords);
    data.pwResetRequests    = toArr(data.pwResetRequests);
    data.customProblems     = toArr(data.customProblems);
    // emotionLogs·problemRecords는 키 기반 객체 유지 (배열 변환 금지)
    if (Array.isArray(data.emotionLogs)) data.emotionLogs = {};
    data.emotionLogs = data.emotionLogs || {};
    if (Array.isArray(data.problemRecords)) data.problemRecords = {};
    data.problemRecords = data.problemRecords || {};
    return data;
  },

  _migrate(data) {
    data.students = data.students.map(s => {
      if (s.stats && s.stats.moral !== undefined && s.stats.value === undefined) {
        s.stats.value = s.stats.moral; delete s.stats.moral;
      }
      const merged = {
        books:[], equipmentIds:{}, promotionPending:false,
        lastMonsterDate:'', monsterDailyCount:0,
        houseDecorations:[], achievements:[], farmHarvests:0,
        // 전투 시스템 기본값 (없는 경우만 채움)
        skillLevels:{ normal:1, fire:0, water:0, grass:0 },
        equippedSkills: ['normal', null, null], // 장착 스킬 3슬롯
        recentBattleOffers:[],
        battleOffersByZone:{ dateKey:'', beginner:null, intermediate:null, advanced:null },
        battleInProgress: null,
        ...s,
        houseDecorations: (s.houseDecorations||[]).map(p => {
          if (p.row !== undefined && p.col !== undefined) return p;
          const area = p.area || 'yard';
          const oldCols = area==='yard' ? 5 : 3;
          const slot = p.slot || 0;
          return {id:p.id, area, row:Math.floor(slot/oldCols), col:slot%oldCols};
        }),
      };
      // skillLevels: 기존 데이터 있으면 병합 (덮어쓰기 금지)
      if (s.skillLevels) merged.skillLevels = { normal:1, fire:0, water:0, grass:0, ...s.skillLevels };
      // equippedSkills: 없으면 기본값, 있으면 유지
      if (s.equippedSkills) merged.equippedSkills = s.equippedSkills;
      // 기본값 자동 보정: 항상 4칸, 노말은 항상 슬롯1에 보장
      if (!merged.equippedSkills || !Array.isArray(merged.equippedSkills)) {
        merged.equippedSkills = ['normal', null, null];
      }
      if (merged.equippedSkills.length < 3) {
        while (merged.equippedSkills.length < 3) merged.equippedSkills.push(null);
      }
      // 4칸 → 3칸 마이그레이션 (기존 4칸 데이터 잘라내기)
      if (merged.equippedSkills.length > 3) merged.equippedSkills = merged.equippedSkills.slice(0, 3);
      // battleDaily: 없으면 기본값
      if (!merged.battleDaily) {
        const today = new Date(Date.now()+9*3600000).toISOString().slice(0,10);
        merged.battleDaily = { dateKey: today, used: 0 };
      }
      // monsterLog: 이름/id 혼재 → id로 통일 + 중복 제거
      // (일반 전투=이름, 무한배틀=id로 저장되던 이력 정리 — 도감 UI/구역보상(이름 판정)과
      //  업적(id 판정)이 서로 어긋나던 버그 수정. 매핑 안 되는 항목(옛 커스텀 이름 등)은 원본 유지.)
      if (Array.isArray(merged.monsterLog) && merged.monsterLog.length) {
        const nameToId = {};
        GAME_DATA.monsters.forEach(m => { nameToId[m.name] = m.id; });
        const seen = new Set();
        merged.monsterLog = merged.monsterLog.reduce((out, e) => {
          const id = nameToId[e] || e;
          if (!seen.has(id)) { seen.add(id); out.push(id); }
          return out;
        }, []);
      }
      return merged;
    });
    return data;
  },

  load() { return this._cache; },

  // ── 부분 저장 (충돌 방지) ──
  // 저장 실패를 조용히 삼키지 않도록: 콘솔 로깅 + 각 화면이 정의한 훅 호출(있으면 사용자 안내)
  _onSaveError(e) {
    console.error('[DB] 저장 실패:', e);
    try { if (typeof window !== 'undefined' && typeof window.onDbSaveError === 'function') window.onDbSaveError(e); } catch(_) {}
  },

  // ── [SYNC-MERGE-2] 학생 저장 = 바뀐 칸만 ─────────────────────
  //  예전: students/<id> 통째 set → 마지막 저장이 이겨, 그사이 교사 승인·다른 탭·키오스크가 바꾼 골드·보상이 사라졌다(M2,
  //    운영 2명 5,293G). 지금: 이 객체가 맞춰져 있던 서버 값(출신)과 비교해 **바뀐 것만** 보낸다.
  //   · 셈 칸(STU_COUNTERS)은 차이를 ServerValue.increment 로 — 두 기기가 동시에 더해도 둘 다 남는다
  //   · pendingRewards 는 id 로 더한 것·뺀 것·바뀐 것을 transaction 으로 서버의 지금 목록에 합친다(배열 모양 그대로)
  //   · 그 밖은 바뀐 칸만 update(칸 단위). 안 바뀐 칸은 안 보낸다 — 바뀐 게 없으면 쓰기 0
  //   · 처음 보는 학생(새 학생)·students/<id> 키에 진짜 기록이 없는 학생(옛 숫자 키만)은 지금처럼 통째 set(껍데기 노드 방지)
  //  호출부(student.js·admin.js)는 그대로 — 객체를 고치고 saveStudent(객체). 학생 기록은 받을 때 합치므로(_stuAdopt)
  //  저장 창(_saving)을 열지 않는다.
  //  돌려주는 값: 이번 저장의 쓰기가 **모두** 끝나면 풀리는 약속(바뀐 게 없으면 바로 풀림). 실패는 _onSaveError 로도 알린다.
  //   관리 화면이 '승인 완료' 알림을 저장 뒤에 띄울 때 쓴다(쓰기가 update·transaction 여럿일 수 있어 한 약속으로 묶는다).
  STU_COUNTERS: ['gold', 'totalGold', 'exp'],

  //  opt.atomic: 교사 승인 — 보상 빼기와 골드·EXP 더하기를 students/<id> transaction 하나로(_stuSendAtomic).
  //
  //  ⚠️ CUR 별칭 규칙(검토 #7): 받은 판마다 학생은 **새 객체**다(_stuAdopt) — 자기 저장 뒤에도 곧 CUR 이 새 객체로 바뀐다.
  //   그래서 `const s = CUR` 로 잡아 두고 await·setTimeout·then 을 건넌 뒤 s 를 고치면, 그 고침은 saveStudent(CUR)(새 객체)로는
  //   안 나간다. 비동기 경계 뒤에는 CUR 을 다시 읽어 고칠 것(옛 객체를 saveStudent(옛 객체)로 저장하면 _stuNext 로 넘겨지긴 한다).
  //   검사: scripts/unit/cur-alias-check.mjs(precheck 'cur-alias').
  saveStudent(student, opt) {
    // 받은 판에 밀린 옛 객체면: 밀린 뒤에 그 객체에서 고친 것만 이은 객체(지금 캐시)에 얹고, 이은 객체를 저장한다.
    //   옛 객체 자신은 안 바꾼다(콜백이 그 옛 값과 새 값을 견준다). 밀릴 때의 고침은 이미 이은 객체가 넘겨받았다.
    if (this._stuNext.has(student)) {
      let next = this._stuNext.get(student);
      while (this._stuNext.has(next)) next = this._stuNext.get(next);
      const late = this._stuDiff(this._stuOrigin.get(student) || {}, student);
      if (!this._opsEmpty(late)) {
        this._assign(next, this._stuApply(next, late));
        this._stuOrigin.set(student, this._clone(student));
      }
      return this.saveStudent(next, opt);
    }
    const db = this.load();
    const idx = db.students.findIndex(s => s.id === student.id);
    // 출신을 모르는 객체(로그인 때 깊은 복사한 CUR)는 기준으로 본다 — onDataChange 콜백 안이면 이번 판 전 기준
    const origin = this._stuOrigin.get(student) || (this._stuBaseCb || this._stuBase)[student.id] || null;
    if (idx >= 0) db.students[idx] = student; else db.students.push(student);
    this._cache = db;
    const ref = this._fbRef.child('students/' + student.id);
    if (!origin || !this._stuKeyed || !this._stuKeyed.has(student.id)) {
      const whole = this._clone(student);
      this._stuOrigin.set(student, whole);
      this._stuBase[student.id] = whole;
      if (this._stuKeyed) this._stuKeyed.add(student.id);
      const p = ref.set(student);   // id 키 기반 저장 (인덱스 충돌 방지)
      p.catch(e => this._onSaveError(e));
      return p;
    }
    const ops = this._stuDiff(origin, student);
    const expected = this._stuApply(this._stuBase[student.id] || origin, ops);
    // 레벨: 경험치를 더하기로 보낼 때, 이 기기가 레벨을 경험치로 맞춰 쓰는 중이면 **합친 경험치**로 다시 맞춘다
    //   (두 곳이 동시에 경험치를 더해 문턱을 넘으면 각자 낮은 레벨을 쓰던 자리)
    const levelTrack = ops.inc.exp !== undefined && typeof Utils !== 'undefined' && student.level === Utils.levelFromExp(student.exp);
    if (levelTrack) {
      const lv = Utils.levelFromExp(expected.exp);
      if (lv !== expected.level) { expected.level = lv; ops.set.level = lv; }
    }
    this._assign(student, this._clone(expected));   // 이 객체도 서버 최신 + 내 고침으로(그사이 온 남의 변경 포함)
    this._stuOrigin.set(student, expected);
    this._stuBase[student.id] = expected;
    if (this._opsEmpty(ops)) return Promise.resolve();
    if (opt && opt.atomic && ops.pr && ops.pr.del.length) return this._stuSendAtomic(student.id, ops, levelTrack);
    return this._stuSend(student.id, ops);
  },

  // ── [TX-RETRY-1] transaction 다시 돌리기 ─────────────────────
  //  SDK 9.23: 보내 놓고 답을 못 받은 transaction 은 연결이 끊기면 'disconnect' 로 끝내고 **다시 보내지 않는다**
  //   (PersistentConnection.cancelSentTransactions_). 보통 쓰기(set·update·increment)는 다시 이어질 때 다시 보낸다(restoreState_).
  //   그래서 교사 승인의 골드(update)만 들어가고 보상 빼기(transaction)는 취소돼 보상이 되살아나거나(두 번 승인),
  //   서버엔 들어간 신청이 실패로 보여 아이가 다시 신청했다.
  //  같은 일감으로 다시 돌린다 — 보상 일감은 id 합치기(있으면 안 더함·없으면 안 뺌), 승인 transaction 은 '보상이 있을 때만'이라
  //   이미 서버에 들어간 것을 다시 돌려도 한 번 돈 것과 같다. 끊긴 동안 시작한 transaction 은 SDK 가 다시 이어질 때 보낸다.
  //  'set': 이 기기의 다른 쓰기가 같은 자리를 덮어 SDK 가 버린 것(서버엔 안 들어감) — 이것도 다시 돈다.
  TX_RETRY: 5,
  _txRetry(ref, fn, left, onRetry) {
    const n = left == null ? this.TX_RETRY : left;
    return ref.transaction(fn).catch(e => {
      const why = e && e.message;
      if (n > 0 && (why === 'disconnect' || why === 'set')) {
        if (onRetry) onRetry(why);
        return this._txRetry(ref, fn, n - 1, onRetry);
      }
      throw e;
    });
  },
  //  pendingRewards id 합치기 transaction — 학생 저장·addPendingReward·키오스크 신청/취소·수채화 작품 제출이 모두 이것을 쓴다.
  //   ref = 그 학생의 pendingRewards 자리(키오스크·수채화는 자기 ref 를 넘긴다) · ops = _prApply 일감
  prTransaction(ref, ops) {
    return this._txRetry(ref, cur => this._prApply(cur, ops)).then(r => {
      if (r && r.committed === false) throw new Error('[SYNC-MERGE-2] pendingRewards 합치기를 못 함');
      return r;
    });
  },

  // ── [APPROVE-ATOMIC-1] 승인 = students/<id> transaction 하나 ──────────
  //  예전(바뀐 칸 update + 보상 transaction 둘)은 하나만 실패하면 골드만 들어가고 보상이 남거나(두 번 승인),
  //   보상만 빠지고 골드가 안 들어갔다(검토 F2). 이제 **빼려는 보상이 서버에 모두 있을 때만** 빼면서 골드·EXP·그 밖을 함께 얹는다.
  //  보상이 이미 없으면(다른 탭·다른 기기가 먼저 승인 · 학생이 취소) 아무것도 안 바꾸고 code 'REWARD_GONE' 으로 실패 —
  //   같은 보상을 두 번 주지 않는다(검토 D2 교사 두 기기). 'disconnect'·'set' 이면 같은 일감으로 다시(_txRetry · 이미 들어갔으면 보상이 없어 멈춤).
  //  관리 화면은 보상마다 한 번씩 부른다(approveAndSave — 한 학생의 여러 보상을 한 쓰기로 묶으면 하나가 사라질 때 나머지도 막힌다).
  //  학생 기록 전체를 보내는 쓰기라(예전 통째 set 과 같은 크기) 승인에만 쓴다. 학생 기기가 아주 잦게 저장해 서버 값이 계속 바뀌면
  //   SDK 가 통째 기록을 25번까지 다시 보낸다(검토 실측 391KB·3.5초) — 그래서 일감이 ATOMIC_RUNS 번을 넘게 불리면 그만두고
  //   _stuSendGated(작은 보상 transaction 으로 그 보상을 실제로 뺐을 때만 골드·EXP update)로 보낸다. SDK 'maxretry' 도 같은 길.
  ATOMIC_RUNS: 4,
  _rewardGone() { const e = new Error('REWARD_GONE: 이미 처리된 보상이라 아무것도 안 바꿈'); e.code = 'REWARD_GONE'; return e; },
  _stuSendAtomic(id, ops, levelTrack) {
    const ref = this._fbRef.child('students/' + id);
    const gate = ops.pr.del.slice();
    let runs = 0, busy = false, sawDisc = false;
    const fn = cur => {
      if (++runs > this.ATOMIC_RUNS) { busy = true; return; }   // 계속 낡음 → 그만(아래에서 작은 쓰기로)
      if (cur == null) return null;   // 이 기기에 아직 값이 없을 때 — SDK 가 서버 값과 다르면 서버 값으로 다시 부른다
      const have = new Set(this._prList(cur.pendingRewards).map(r => this._prKey(r)));
      if (gate.some(k => !have.has(k))) return;   // 이미 없음 → 그만(아무것도 안 바꿈)
      const out = this._stuApply(cur, ops);
      if (levelTrack && typeof Utils !== 'undefined') out.level = Utils.levelFromExp(out.exp);
      return out;
    };
    //  끊김은 **한 번이라도** 있었는지 기억한다(검토 Y6: 끊김 뒤 다시 → 'set' 으로 또 다시 → 마지막 이유만 보면 '이미 처리'로 잘못 알림)
    const onRetry = why => { if (why === 'disconnect') sawDisc = true; runs = 0; busy = false; };
    const p = this._txRetry(ref, fn, null, onRetry).then(r => {
      //  들어갔으면(committed) 그걸로 끝 — '그만'은 들어가지 않았을 때만 폴백으로
      if (busy && !(r && r.committed)) return this._stuSendGated(id, ops, false);   // 폴백은 자기 끊김만 본다 — 앞 transaction 의 끊김을 넘기면 그 쓰기가 들어갔는데 골드를 또 보낼 수 있다(3차 검토 #3)
      if (!r || r.committed === false || (r.snapshot && typeof r.snapshot.val === 'function' && r.snapshot.val() == null)) {
        //  끊김('disconnect') 뒤 다시 돌렸더니 보상이 없음 = 거의 늘 **내 첫 쓰기가 서버에 들어갔는데 답만 못 받은 것** → 승인 끝으로 본다
        //   (드물게 그 몇 초 사이 다른 기기가 승인했거나 학생이 취소했어도 두 번 주지는 않는다 — 설계 문서 '남은 위험')
        if (sawDisc) { console.warn('[APPROVE-ATOMIC-1] 끊긴 뒤 다시 보니 이미 들어가 있음:', id); return r; }
        throw this._rewardGone();
      }
      return r;
    }, e => {
      if (e && e.message === 'maxretry') return this._stuSendGated(id, ops, false);   // 폴백은 자기 끊김만 본다 — 앞 transaction 의 끊김을 넘기면 그 쓰기가 들어갔는데 골드를 또 보낼 수 있다(3차 검토 #3)
      throw e;
    });
    //  REWARD_GONE 은 저장 실패가 아니라 일부러 안 바꾼 것 — '인터넷 연결 확인' 알림 대신 승인 화면이 따로 알린다
    p.catch(e => { if (e && e.code === 'REWARD_GONE') console.warn('[APPROVE-ATOMIC-1]', id, e.message); else if (!(e && e._told)) this._onSaveError(e); });
    return p;
  },
  //  승인 폴백: 보상 transaction(작은 pendingRewards 자리)으로 빼려는 보상이 **모두 있을 때만** 빼고, 그게 된 뒤에만 골드·EXP 등을 update.
  //   '있을 때만'은 지킨다(다른 교사 기기와 겹쳐도 한 번 — 검토 Y4). 두 쓰기라 둘 사이(왕복 하나)에 update 가 거부되거나 창이 닫히면 보상만 빠진다(설계 문서 §5).
  //   끊김 뒤 다시 보니 보상이 없으면 내 첫 보상 쓰기가 들어간 것으로 보고 update 를 보낸다(_stuSendAtomic 과 같은 가정).
  _stuSendGated(id, ops, sawDisc) {
    const gate = ops.pr.del.slice();
    let had = false, disc = !!sawDisc;
    const prRef = this._fbRef.child('students/' + id + '/pendingRewards');
    return this._txRetry(prRef, cur => {
      if (cur == null) { had = false; return null; }   // 값이 없으면 null(SDK 가 서버 값으로 다시 부름 · 정말 없으면 아무것도 안 바뀜)
      const have = new Set(this._prList(cur).map(r => this._prKey(r)));
      had = gate.every(k => have.has(k));
      return had ? this._prApply(cur, ops.pr) : undefined;
    }, null, why => { if (why === 'disconnect') disc = true; }).then(r => {
      if (!(r && r.committed !== false && had) && !disc) throw this._rewardGone();
      const rest = { set: ops.set, inc: ops.inc, pr: null };
      //  _stuSend 는 실패를 스스로 알린다(_onSaveError) — 두 번 안 알리게 표시
      return this._opsEmpty(rest) ? r : this._stuSend(id, rest).catch(e => { if (e && typeof e === 'object') e._told = true; throw e; });
    });
  },

  //  보낼 일감 → 쓰기. 셈 칸은 increment, 그 밖은 칸 update, 보상은 id 합치기 transaction.
  _stuSend(id, ops) {
    const ps = [];
    try {
      const ref = this._fbRef.child('students/' + id);
      const SV = (typeof firebase !== 'undefined' && firebase.database && firebase.database.ServerValue) || null;
      const up = {};
      for (const k of Object.keys(ops.set)) up[k] = ops.set[k];
      for (const k of Object.keys(ops.inc)) {
        const d = ops.inc[k];
        if (SV && SV.increment) up[k] = SV.increment(d);
        else ps.push(this._fbRef.child('students/' + id + '/' + k).transaction(v => ((typeof v === 'number' && isFinite(v)) ? v : 0) + d));
      }
      if (Object.keys(up).length) ps.push(ref.update(up));
      if (ops.pr) ps.push(this.prTransaction(this._fbRef.child('students/' + id + '/pendingRewards'), ops.pr));
    } catch (e) { this._onSaveError(e); }
    const all = Promise.all(ps);
    all.catch(e => this._onSaveError(e));
    return all;
  },

  //  기준(a) → 지금(b) 사이 바뀐 것 = 보낼 일감 { set, inc, pr }. 순수 함수.
  _stuDiff(a, b) {
    const ops = { set: {}, inc: {}, pr: null };
    a = a || {}; b = b || {};
    for (const k of new Set(Object.keys(a).concat(Object.keys(b)))) {
      if (k === 'id') continue;
      const av = a[k], bv = b[k];
      if (this._same(av, bv)) continue;
      if (k === 'pendingRewards') { ops.pr = this._prDiff(av, bv); continue; }
      if (this._badNum(bv)) { console.error('[SYNC-MERGE-2] 숫자가 아닌 값(NaN·Infinity)이라 이 칸은 안 보냄:', k); continue; }
      if (this.STU_COUNTERS.includes(k) && typeof bv === 'number' && (av == null || (typeof av === 'number' && isFinite(av)))) {
        ops.inc[k] = bv - (av || 0);
        continue;
      }
      ops.set[k] = bv === undefined ? null : this._clone(bv);
    }
    return ops;
  },
  //  학생 값 s 에 일감을 얹은 새 값(s 는 안 바꾼다). 셈 칸은 서버 increment 와 같은 셈(숫자가 아니면 0 에서).
  _stuApply(s, ops) {
    const out = this._clone(s || {}) || {};
    for (const k of Object.keys(ops.set)) { const v = ops.set[k]; if (v == null) delete out[k]; else out[k] = this._clone(v); }
    for (const k of Object.keys(ops.inc)) { const c = out[k]; out[k] = ((typeof c === 'number' && isFinite(c)) ? c : 0) + ops.inc[k]; }
    if (ops.pr) out.pendingRewards = this._prApply(out.pendingRewards, ops.pr);
    return out;
  },
  _opsEmpty(ops) { return !ops || (!Object.keys(ops.set).length && !Object.keys(ops.inc).length && !ops.pr); },
  //  o 를 src 와 같게 **제자리로** 맞춘다(바뀐 칸만 갈아 끼움 · src 에 없는 칸은 지움). src 값은 o 가 가져간다.
  _assign(o, src) {
    for (const k of Object.keys(o)) if (!(k in src)) delete o[k];
    for (const k of Object.keys(src)) if (!this._same(o[k], src[k])) o[k] = src[k];
  },
  _clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); },
  //  같은 값인가 — undefined·null 은 같게(Firebase 에서 둘 다 '없음'), 키 순서가 달라도 같게(서버는 키를 정렬해 준다)
  _same(a, b) {
    if (a === b) return true;
    const ja = a === undefined ? 'null' : JSON.stringify(a), jb = b === undefined ? 'null' : JSON.stringify(b);
    if (ja === jb) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    return this._canon(a) === this._canon(b);
  },
  _canon(v) {
    return JSON.stringify(v, (k, x) => {
      if (!x || typeof x !== 'object' || Array.isArray(x)) return x;
      const o = {};
      for (const key of Object.keys(x).sort()) o[key] = x[key];
      return o;
    });
  },
  _badNum(v) {
    if (typeof v === 'number') return !isFinite(v);
    if (!v || typeof v !== 'object') return false;
    for (const k of Object.keys(v)) if (this._badNum(v[k])) return true;
    return false;
  },

  // ── [SYNC-MERGE-2] pendingRewards id 합치기 (배열 모양 그대로) ──
  //  열쇠 = 보상 id(옛 보상에 id 가 없으면 내용 전체). 순수 함수 — 키오스크·수채화도 transaction 안에서 부른다(DB 상태 안 씀).
  _prKey(r) { return (r && typeof r === 'object' && r.id != null && r.id !== '') ? 'i:' + r.id : 'j:' + this._canon(r); },
  _prList(v) { return (v == null ? [] : Array.isArray(v) ? v : Object.values(v)).filter(x => x != null); },
  _prDiff(a, b) {
    const am = new Map(), bm = new Map();
    for (const r of this._prList(a)) am.set(this._prKey(r), r);
    for (const r of this._prList(b)) bm.set(this._prKey(r), r);
    const del = [], add = [], put = [];
    for (const k of am.keys()) if (!bm.has(k)) del.push(k);
    for (const [k, r] of bm) {
      if (!am.has(k)) add.push(this._clone(r));
      else if (!this._same(am.get(k), r)) put.push(this._clone(r));
    }
    return (del.length || add.length || put.length) ? { del, add, put } : null;
  },
  //  서버의 지금 목록(cur)에 일감을 얹은 새 배열. del: 열쇠로 빼기 · drop: 조건으로 빼기 · put: 있으면 바꾸기(없으면 안 살림) · add: 없으면 더하기
  _prApply(cur, ops) {
    let list = this._prList(cur);
    if (!ops) return list;
    if (ops.del && ops.del.length) { const d = new Set(ops.del); list = list.filter(r => !d.has(this._prKey(r))); }
    if (typeof ops.drop === 'function') list = list.filter(r => !ops.drop(r));
    for (const r of (ops.put || [])) { const k = this._prKey(r); list = list.map(x => (this._prKey(x) === k ? this._clone(r) : x)); }
    for (const r of (ops.add || [])) { const k = this._prKey(r); if (!list.some(x => this._prKey(x) === k)) list.push(this._clone(r)); }
    return list;
  },

  saveQuestLog(log) {
    const db = this.load();
    db.quests = db.quests || [];
    db.quests.push(log);
    this._cache = db;
    // questLogs에 고유 키로 저장 (완료 판정 기준)
    // [B16] Date.now()만 쓰면 [전체 승인]의 동기 루프에서 같은 밀리초에 같은 키가 만들어져
    //       기록 1건이 덮어써진다(특히 boardQuestId 없는 빠른보상은 둘 다 'manual').
    //       지급 자체는 두 번 되지만 활동 내역·능력치 내역·집계에서 건수가 누락됐다.
    const logId = log.studentId + '_' + (log.boardQuestId||'manual') + '_' + Date.now()
                + '_' + Math.random().toString(36).slice(2, 7);
    log._id = logId;
    this._fbRef.child('questLogs/' + logId).set(log).catch(e => this._onSaveError(e));
  },

  // ── 골드 수입 기록 (GOLD-LOG-1) ──────────────────────────────
  //  goldDaily/<studentId>_<date> 에 **경로별 하루 합계만** 쌓는다.
  //
  //  왜 이벤트마다가 아니라 하루 요약인가 (2026-09-10 실측):
  //    학생 1인이 하루에 만드는 골드 이벤트가 약 25건(농장 3 · 전투 3 · 무한배틀 10 · 퀘스트 8…)이다.
  //    이벤트마다 남기면 1년 약 3.2MB, 하루 요약이면 151KB — 21배 차이다.
  //    DB.init() 이 루트에 on('value') 를 걸어 두어서, 루트가 커지면 접속한 모든 학생이 그 비용을 나눠 진다.
  //
  //  왜 ServerValue.increment 인가:
  //    필드 하나만 서버에서 더한다. 통짜 set 도 transaction 도 안 쓴다 — 여러 명이 같은 순간에
  //    올려도 서버 원자 연산이라 어긋나지 않는다(Q1 의 통짜 set 경합 문제가 여기선 생기지 않는다).
  //
  //  왜 실패를 무시하는가:
  //    이 기록은 **통계용**이고 진실의 원본은 학생의 gold/totalGold 다.
  //    로그가 안 남았다고 해서 수확이 취소되거나 아이 화면이 멈추면 안 된다.
  //
  //  왜 BACKUP_NODES 에 넣지 않는가:
  //    잃어도 다시 쌓이는 통계다. 넣으면 백업이 또 커진다 —
  //    2026-09-10 기준 backups 가 이미 루트 7.6MB 의 73%(5.6MB)를 차지하고 있다.
  GOLD_SOURCES: ['farm', 'battle', 'infinite', 'quest', 'study', 'artwork', 'english'],

  //  교사 승인 보상의 종류(boardQuestType/type) → 위 경로 이름.
  //  · daily·weekly·special 은 다 '퀘스트'라 quest 로 묶는다. 감사 때 셋을 나눠 볼 일이 없었다.
  //  · book·emotion·promotion 은 **일부러 뺐다.** 7경로에 없고, 셋 다 questLogs 에 이미 남는다
  //    (2026-09-10 실측 기준 셋을 합쳐 1,705G — 학급 누적 254,422G 의 0.7%).
  //    나중에 넣기로 하면 GOLD_SOURCES 에 이름 하나 추가하고 이 표에 한 줄 더하면 된다.
  GOLD_SOURCE_BY_TYPE: {
    quest: 'quest', daily: 'quest', weekly: 'quest', special: 'quest',
    study: 'study', artwork: 'artwork', english: 'english',
  },
  //  모르는 종류면 null 을 준다 → logGold 가 조용히 넘어간다(기록 안 함, 지급은 정상).
  goldSourceOf(type) { return this.GOLD_SOURCE_BY_TYPE[type] || null; },
  logGold(studentId, source, amount) {
    try {
      const amt = Math.round(Number(amount) || 0);
      if (!studentId || amt <= 0) return;
      if (!this.GOLD_SOURCES.includes(source)) return;
      const inc = (typeof firebase !== 'undefined')
        && firebase.database && firebase.database.ServerValue
        && firebase.database.ServerValue.increment;
      if (!inc || !this._fbRef) return;
      const day = Utils.todayStr();
      this._fbRef.child('goldDaily/' + studentId + '_' + day)
        .update({ s: studentId, d: day, [source]: inc(amt) })
        .catch(() => {});          // 통계 실패는 조용히 넘어간다
    } catch (e) { /* 위와 같은 이유 — 게임 진행을 막지 않는다 */ }
  },

  // ── 골드 지출 기록 (GOLD-SPEND-1) ────────────────────────────
  //  수입(logGold)과 **같은 레코드** goldDaily/<studentId>_<date> 에 지출 필드를 더한다.
  //  필드 이름은 x_ 로 시작한다 — 수입 7경로와 섞여 합산되는 사고를 막으려고 앞머리로 가른다.
  //
  //  왜 필요한가 (2026-09-14 첫 실측):
  //    학생 B farm 7,250G = 밭 25칸 × 딸기 판매가 290G. 그런데 씨앗값 25 × 60G = 1,500G 가
  //    어디에도 안 남아 순수익(5,750G)을 볼 수 없었다. 수입만으로는 인플레이션을 잴 수 없다.
  //
  //  logGold 와 따로 둔 이유: 이미 운영 중인 수입 기록 코드를 건드리지 않기 위해서다
  //    (고치다가 새로 만든 실수를 피한다). 원칙은 똑같다 — increment 필드 하나, 실패는 무시.
  //
  //  3D 마을은 골드를 쓰지 않는다(2026-09-15 확인, 사용자 결정으로 무료). 여기에 경로 없음.
  SPEND_SINKS: ['equip', 'skill', 'seed', 'deco'],
  logSpend(studentId, sink, amount) {
    try {
      const amt = Math.round(Number(amount) || 0);
      if (!studentId || amt <= 0) return;
      if (!this.SPEND_SINKS.includes(sink)) return;
      const inc = (typeof firebase !== 'undefined')
        && firebase.database && firebase.database.ServerValue
        && firebase.database.ServerValue.increment;
      if (!inc || !this._fbRef) return;
      // [GOLD-SPEND-2] 학생 노드별 구독 판(_snaps)에서만 쓴다. root 를 통째로 구독하는 판에서는 이 update() 가
      //   동기 value 이벤트를 띄워 CUR 이 옛 캐시로 바뀌고, 이어진 saveStudent 가 **골드 차감을 지워 구매가 공짜**가 된다
      //   (#218 revert 원인, real-sdk --profile=root FREE_ITEM). 학생 기기도 시작 REST 확인이 실패하면 root 판으로 떨어지므로
      //   profile 이 아니라 실제 구독 모드(_snaps)로 가른다. 골드 유실 수정(#288)이 root 판을 막으면 이 줄을 풀어도 된다.
      if (!this._snaps) return;
      const day = Utils.todayStr();
      this._fbRef.child('goldDaily/' + studentId + '_' + day)
        .update({ s: studentId, d: day, ['x_' + sink]: inc(amt) })
        .catch(() => {});          // 통계 실패는 조용히 넘어간다 — 구매는 이미 끝났다
    } catch (e) { /* 게임 진행을 막지 않는다 */ }
  },

  // ── 학생 쪽지 (NOTES-1) ────────────────────────────────────
  //  studentNotes/<studentId>/<noteId> 개별 경로로만 읽고 쓴다.
  //  학생 객체 필드로 두지 않는 이유: saveStudent 는 students/<id> 를 통짜 set 하고
  //  호출처가 64곳(student.js 37 · admin.js 25 · 여기 2)이라 대부분 학생 브라우저에서 돈다.
  //  쪽지를 모르는 낡은 학생 사본이 한 번만 저장돼도 교사가 쓴 쪽지가 통째로 사라진다
  //  — Q1(boardQuests 통짜 set)과 같은 실패 방식이다.
  //  같은 이유로 여기서도 studentNotes 통짜 set 을 하지 않는다(쪽지 하나씩 개별 경로).
  getStudentNotes(studentId) {
    const mine = (this.load().studentNotes || {})[studentId] || {};
    return Object.keys(mine)
      .filter(k => mine[k] && typeof mine[k] === 'object')
      .map(k => ({ ...mine[k], id: k }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },
  saveStudentNote(studentId, note) {
    const db = this.load();
    db.studentNotes = db.studentNotes || {};
    db.studentNotes[studentId] = db.studentNotes[studentId] || {};
    const id  = note.id || ('n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
    const now = Date.now();
    const rec = { ...note, id, updatedAt: now, createdAt: note.createdAt || now };
    db.studentNotes[studentId][id] = rec;
    this._cache = db;
    this._fbRef.child('studentNotes/' + studentId + '/' + id).set(rec)
      .catch(e => this._onSaveError(e));
    return rec;
  },
  deleteStudentNote(studentId, noteId) {
    const db = this.load();
    if (db.studentNotes && db.studentNotes[studentId]) delete db.studentNotes[studentId][noteId];
    this._cache = db;
    this._fbRef.child('studentNotes/' + studentId + '/' + noteId).remove()
      .catch(e => this._onSaveError(e));
  },

  saveArtwork(artwork) {
    const db = this.load();
    db.artworks = db.artworks || [];
    // 필드명 통일: title/comment/subject 기준으로 저장
    const normalized = {
      ...artwork,
      title:   artwork.title   || artwork.artTitle || '',
      comment: artwork.comment || artwork.artDesc  || '',
      subject: artwork.subject || '',
    };
    db.artworks.push(normalized);
    this._cache = db;
    this._fbRef.child('artworks/' + normalized.id).set(normalized).catch(e => this._onSaveError(e));
  },

  // [ART-RAW-KEY-1] 작품이 실제로 저장된 키들. 운영 artworks 는 옛 배열(숫자 키 0,1,2…)이라
  //   `artworks/<작품id>/…` 에 쓰면 진짜 작품은 그대로이고 유령 조각만 생겼다(내리기가 학생 화면에 안 먹음).
  //   서버 판에서 value.id 가 같은 키를 모두 찾는다(숫자 키·id 키 둘 다 있으면 둘 다). 없으면 id 키.
  //   root 구독이 이미 받아 둔 판이라 once 는 SDK 캐시에서 바로 온다(추가 다운로드 없음).
  _artworkKeys(id) {
    return this._fbRef.child('artworks').once('value').then(snap => {
      const raw = snap.val() || {};
      const keys = Object.keys(raw).filter(k => raw[k] && raw[k].id === id);
      return keys.length ? keys : [id];
    }, () => [id]);
  },

  updateArtwork(id, patch) {
    const db = this.load();
    const idx = (db.artworks||[]).findIndex(a => a.id === id);
    if (idx < 0) return false;
    db.artworks[idx] = { ...db.artworks[idx], ...patch };
    this._cache = db;
    this._saving = true;
    const rec = db.artworks[idx];
    return this._artworkKeys(id).then(keys => Promise.all(keys.map(k => this._fbRef.child('artworks/' + k).set(rec)))).catch(e => this._onSaveError(e)).finally(() => {
      setTimeout(() => this._endSaving(), 300);   // [SYNC-MERGE-2] 창 동안 받은 판을 버리지 않고 이때 반영
    });
  },

  getStudents()    { return this.load().students; },
  getStudent(id)   { return this.load().students.find(s => s.id === id); },

  getSettings()    { return this.load().settings; },
  saveSettings(s)  {
    const db = this.load();
    db.settings = s;
    this._cache = db;
    this._saving = true;
    // settings 노드만 부분 저장 (root 전체 set 방지)
    this._fbRef.child('settings').set(s).catch(e => this._onSaveError(e)).finally(() => {
      setTimeout(() => this._endSaving(), 500);   // [SYNC-MERGE-2] 창 동안 받은 판을 버리지 않고 이때 반영
    });
  },

  getQuests()      { return this.load().quests || []; },

  // [AUTO-DAILY-REWARD-1] 자동 일일 퀘스트 1개 보상. 교사 설정(autoDailyExp·autoDailyGold)이 없으면 예전 고정값 35EXP·25G.
  //   옛 키 baseExp·baseGold 는 읽지 않는다 — 운영에 기본값(80/50·30)이 저장돼 있어 읽으면 배포 순간 지급이 바뀐다.
  //   0 은 값으로 받는다(보상 없이 올리기). 글자·음수는 기본값, 지나친 값은 1000 에서 자른다(오타 막기).
  autoDailyReward(settings) {
    const s = settings || {};
    const pick = (v, def) => { const n = Math.floor(Number(v)); return (v === '' || v == null || !Number.isFinite(n) || n < 0) ? def : Math.min(n, 1000); };
    return { exp: pick(s.autoDailyExp, 35), gold: pick(s.autoDailyGold, 25) };
  },

  // ── 오늘 일일퀘스트 자동 등록 (앱 로드 시 1회) ──
  // [Q-2A] admin.checkAutoDailyQuests()의 핵심 로직을 공용 DB helper로 이전.
  //        호출처: admin.js window.onload + student.js enterGame() ([Q-2B]).
  ensureDailyQuests() {
    const settings = this.getSettings();
    const autoItems = settings.autoDailyQuests;
    if (!autoItems || autoItems.length === 0) return;

    const today = Utils.todayStr();
    if (settings.autoDailyLastDate === today) return; // 오늘 이미 처리됨

    // [Q1] boardQuests 통짜 set 금지.
    //   학생 여러 명이 아침에 동시 접속하면 각자 자기 기기의 낡은 목록으로 전체를 덮어써,
    //   그 사이 교사가 추가한 퀘스트가 소리 없이 사라졌다.
    //   인덱스 부분 저장도 안 된다 — 배열 인덱스는 기기마다 가리키는 퀘스트가 다르다.
    //   서버의 현재 목록 위에 적용하는 transaction으로 처리한다(경합 시 Firebase가 재시도).
    const reward = this.autoDailyReward(settings);   // [AUTO-DAILY-REWARD-1]
    const applyDaily = (list) => {
      const next = (list || []).slice();
      // 어제 일일퀘스트 중 아직 active인 것 내리기
      for (let i = 0; i < next.length; i++) {
        const q = next[i];
        if (q && q.type === 'daily' && q.active !== false && q.date !== today) {
          next[i] = { ...q, active: false };
        }
      }
      // 오늘 자동 등록
      autoItems.forEach((item, i) => {
        if (next.find(q => q && q.name === item.name && q.active !== false)) return;
        next.push({
          id: 'bq_auto_' + today + '_' + i,
          name: item.name,
          type: 'daily',
          exp: reward.exp, gold: reward.gold,
          icon: '📋',
          stat: item.stat || '',
          statVal: item.statVal || 0,
          dueDate: '', date: today,
          active: true,
        });
      });
      return next;
    };

    const db = this.load();
    db.boardQuests = applyDaily(db.boardQuests); // 화면 즉시 반영용 로컬 캐시
    this._cache = db;
    this._fbRef.child('boardQuests').transaction(cur => applyDaily(cur));

    // 오늘 날짜 기록 — [DAILY-DATE-FIELD-1] 이 한 칸만 쓴다.
    //   예전엔 saveSettings 로 settings 통째 set 이라, 학생 기기가 아침에 이걸 부르는 순간(왕복 시간 안)
    //   교사가 바꾼 설정(보스 켜기 등)을 옛 캐시 값으로 되돌렸다.
    settings.autoDailyLastDate = today;
    this._fbRef.child('settings/autoDailyLastDate').set(today).catch(e => this._onSaveError(e));
  },

  getPromotionRequests()     { return (this.load().promotionRequests || []).filter(Boolean); },   // 빈 칸(null)이 끼면 r.id 읽다 깨짐
  // [PROMO-PER-ID-1] 승급 신청은 id 키 한 건씩 쓴다.
  //   예전엔 기기 캐시의 배열을 통째로 set 해서, 두 학생이 거의 동시에 신청하면 한 명이 사라지고
  //   교사 승인 직후 옛 캐시 기기가 신청하면 승인한 신청이 되살아났다(다시 승인하면 보상 중복).
  //   읽기는 _normalizeArrays 의 toArr(Object.values) 그대로. 모음 전체를 쓸 때도 반드시 _promoObj 로.
  _promoObj(arr) {
    const o = {};
    (arr || []).forEach(r => { if (r && r.id) o[r.id] = r; });
    return o;
  },
  savePromotionRequests(arr) {
    const db = this.load(); db.promotionRequests = arr; this._cache = db;
    this._fbRef.child('promotionRequests').set(this._promoObj(arr));
  },
  addPromotionRequest(r) {
    const db = this.load();
    db.promotionRequests = db.promotionRequests || [];
    // 중복 차단: 동일 studentId + level
    const exists = db.promotionRequests.some(x => x && x.studentId === r.studentId && Number(x.level) === Number(r.level));
    if (exists) return false;
    db.promotionRequests.push(r);
    this._cache = db;
    // 한 건만 쓰므로 다른 기기의 신청·승인을 덮지 않는다 → _saving 창도 필요 없음
    this._fbRef.child('promotionRequests/' + r.id).set(r).catch(e => this._onSaveError(e));
    return true;
  },
  removePromotionRequest(id) {
    const db = this.load();
    db.promotionRequests = (db.promotionRequests || []).filter(r => r && r.id !== id);
    this._cache = db;
    const node = this._fbRef.child('promotionRequests');
    node.child(id).remove().catch(e => this._onSaveError(e));
    // 안전띠: 옛 판 기기·옛 백업이 배열(숫자 키)로 써 둔 게 있으면 이 기회에 id 키로 옮긴다.
    //   숫자 키만 지우면 배열에 구멍(null)이 생겨 r.id 읽는 화면이 깨지므로, 지운 신청 말고는 id 키로 다시 넣는다.
    node.once('value').then(snap => {
      const v = snap.val();
      if (!v || typeof v !== 'object') return;
      const upd = {};
      // 이 기기가 그사이 지운 신청은 되살리지 않도록 지금 캐시에 남아 있는 것만 옮긴다
      const keep = new Set((this.load().promotionRequests || []).map(r => r && r.id));
      Object.keys(v).forEach(k => {
        const r = v[k];
        if (!/^\d+$/.test(k)) return;
        upd[k] = null;
        if (r && r.id && r.id !== id && keep.has(r.id)) upd[r.id] = r;
      });
      if (Object.keys(upd).length) return node.update(upd);
    }).catch(e => this._onSaveError(e));
  },

  async getAdminPw() {
    const snap = await this._fbAdminRef.once('value');
    return snap.val() || 'teacher1234';
  },
  setAdminPw(pw) { this._fbAdminRef.set(pw); },

  getArtworks(studentId) { return (this.load().artworks||[]).filter(a => a.studentId === studentId); },
  // [ARTFREE-1] 학생 통짜 set 대신 pendingRewards 한 갈래만 쓴다.
  //   기존 submitArtwork가 saveStudent(CUR)로 학생 전체를 덮어써서, 그 사이 다른 곳에서 바뀐
  //   값(경험치·골드 등)을 되돌리는 자리였다. 여기서는 students/<id>/pendingRewards만 건드린다.
  addPendingReward(student, reward) {
    const db = this.load();
    const s = (db.students || []).find(x => x.id === student.id) || student;
    s.pendingRewards = [...(s.pendingRewards || []), reward];
    this._cache = db;
    if (student !== s) student.pendingRewards = s.pendingRewards;
    // [SYNC-MERGE-2] 배열 통째 set → 이 보상 하나만 id 로 더하는 transaction. 그사이 교사가 승인해 뺀 보상을 되살리거나
    //   다른 기기가 막 넣은 신청을 지우지 않는다. 보낸 것으로 적어 두어(출신·기준) 뒤의 saveStudent 가 다시 더하지 않게.
    const pr = { del: [], add: [this._clone(reward)], put: [] };
    const ops = { set: {}, inc: {}, pr };
    for (const o of new Set([s, student])) { const og = this._stuOrigin.get(o); if (og) this._stuOrigin.set(o, this._stuApply(og, ops)); }
    if (this._stuBase[s.id]) this._stuBase[s.id] = this._stuApply(this._stuBase[s.id], ops);
    return this.prTransaction(this._fbRef.child('students/' + s.id + '/pendingRewards'), pr)
      .then(() => {}).catch(e => this._onSaveError(e));
  },

  // [ARTFREE-1] 좋아요 — artworks/<id>/likes/<studentId> 한 칸만 쓴다(작품 통짜 set 금지).
  setArtworkLike(artId, studentId, on) {
    const db = this.load();
    const a = (db.artworks || []).find(x => x.id === artId);
    if (!a) return Promise.resolve();
    a.likes = a.likes || {};
    if (on) a.likes[studentId] = true; else delete a.likes[studentId];
    this._cache = db;
    return this._artworkKeys(artId).then(keys => Promise.all(keys.map(k => {   // [ART-RAW-KEY-1]
      const ref = this._fbRef.child('artworks/' + k + '/likes/' + studentId);
      return on ? ref.set(true) : ref.remove();
    }))).catch(e => this._onSaveError(e));
  },

  // [ART-KEY-FIX-1] artworks 서버 판(raw) → "작품 id = 키" 로 맞추는 **바뀔 키만** 담은 update 객체(순수 함수, 쓰기 없음).
  //   · 옛 숫자 키 작품은 id 키로 옮기고, 그 id 키에 쓰여 있던 유령 조각(hidden·likes)은 합친다
  //   · 같은 작품이 id 키에 이미 있으면 숫자 키만 지운다 · keep(a) 가 false 면 지운다(그 작품의 유령 조각도)
  //   · 이미 제 모양인 키(그 순간 올라온 새 작품)는 건드리지 않는다
  //   숫자 키 하나만 지우면 배열에 null 구멍이 생겨 `a.id` 를 읽는 화면이 깨지므로, 지울 때도 이걸로 모양을 같이 맞춘다.
  _artworkKeyFix(raw, keep) {
    raw = raw || {};
    const keys = Object.keys(raw);
    const upd = {};
    const mergedGhost = new Set();
    let moved = 0, removed = 0;
    const hasRealAt = k => !!(raw[k] && raw[k].id === k);
    for (const k of keys) {
      const a = raw[k];
      if (!a || !a.id) continue;                               // id 없는 것은 아래에서
      if (a.id === k) {                                        // 이미 제 모양
        if (!keep(a)) { upd[k] = null; removed++; }
        continue;
      }
      upd[k] = null;                                           // 키가 id 가 아님(옛 숫자 키 등)
      if (!keep(a)) { removed++; continue; }
      if (hasRealAt(a.id) || (upd[a.id] && upd[a.id].id)) { removed++; continue; }   // 같은 작품이 이미 id 키에 → 중복
      const piece = raw[a.id] && !raw[a.id].id ? raw[a.id] : {};                    // 유령 조각
      const rec = { ...a, ...piece, likes: { ...(a.likes || {}), ...(piece.likes || {}) } };
      if (!Object.keys(rec.likes).length) delete rec.likes;
      upd[a.id] = rec; mergedGhost.add(a.id); moved++;
    }
    for (const k of keys) {                                    // id 없는 레코드: 옮긴 작품에 합쳐진 조각이 아니면 버린다
      const a = raw[k];
      if (a && a.id) continue;
      if (mergedGhost.has(k)) continue;
      upd[k] = null; removed++;
    }
    return { upd, moved, removed };
  },

  // [ARTFREE-1] 작품 내리기 — 갤러리에서만 감춘다(지우지 않는다). hidden 한 칸만 쓴다.
  hideArtwork(id, hidden) {
    const db = this.load();
    const a = (db.artworks || []).find(x => x.id === id);
    if (a) { a.hidden = !!hidden; this._cache = db; }
    return this._artworkKeys(id)   // [ART-RAW-KEY-1] 숫자 키 판이어도 진짜 작품(들)에 쓴다
      .then(keys => Promise.all(keys.map(k => this._fbRef.child('artworks/' + k + '/hidden').set(!!hidden))))
      .catch(e => this._onSaveError(e));
  },

  deleteArtwork(id) {
    const db = this.load();
    db.artworks = (db.artworks||[]).filter(a => a && a.id !== id);
    this._cache = db;
    // [ART-KEY-FIX-1] 캐시 판 통째 set 대신 서버 판에서 바뀔 키만 — 그 순간 올라온 작품을 지우지 않고,
    //   숫자 키 판이면 모양도 같이 맞춰 null 구멍을 안 남긴다
    const node = this._fbRef.child('artworks');
    return node.once('value').then(snap => {
      const { upd } = this._artworkKeyFix(snap.val(), a => a.id !== id);
      if (Object.keys(upd).length) return node.update(upd);
    }).catch(e => this._onSaveError(e));
  },

  // ── 추억 사진 ────────────────────────────────────────
  getMemories(filter) {
    // filter: 'public' = 전체공개, 'all' = 전체, studentId = 해당학생
    const db = this.load();
    const mems = db.memories || [];
    if (filter === 'public') {
      return mems.filter(m => m.approvalStatus === 'approved' &&
        (m.visibilityType === 'public' ||
         (m.visibilityType === 'class' && m.approvalStatus === 'approved')));
    }
    if (filter === 'all') return mems;
    if (filter) return mems.filter(m => m.studentId === filter || m.visibilityType === 'public');
    return mems;
  },
  saveMemory(mem) {
    const db = this.load();
    db.memories = db.memories || [];
    const idx = db.memories.findIndex(m => m.id === mem.id);
    if (idx >= 0) db.memories[idx] = { ...db.memories[idx], ...mem };
    else db.memories.push(mem);
    this._cache = db;
    // 전체 배열로 덮어쓰기 — 경로별 set은 배열 인덱스와 키가 섞여 중복 발생
    this._fbRef.child('memories').set(db.memories);
  },
  deleteMemory(id) {
    const db = this.load();
    db.memories = (db.memories||[]).filter(m => m.id !== id);
    this._cache = db;
    // 전체 배열 덮어쓰기 — 배열 인덱스 경로와 문자열 키 경로 모두 정리
    this._fbRef.child('memories').set(db.memories);
  },

  // ── 주간 다짐 (월요일 목표 + 금요일 성찰) ─────────────
  // 월요일: { id, studentId, studentName, weekKey, type:'monday_goal',
  //   weekendText, weekendMood, focusArea, goalText, mindset,
  //   createdAt, updatedAt }
  // 금요일: { id, studentId, studentName, weekKey, type:'friday_reflection',
  //   mondayGoalId, focusReflection, goalReflection, mindsetReflection,
  //   bestMoment, nextWeekGoal, createdAt, updatedAt }
  getWeeklyGoals(studentId) {
    return (this.load().weeklyGoals||[]).filter(r => r.studentId === studentId);
  },
  getWeeklyGoal(studentId, weekKey) {
    return (this.load().weeklyGoals||[]).find(r => r.studentId===studentId && r.weekKey===weekKey) || null;
  },
  getAllWeeklyGoals() { return this.load().weeklyGoals || []; },
  saveWeeklyGoal(goal) {
    const db = this.load();
    db.weeklyGoals = db.weeklyGoals || [];
    const idx = db.weeklyGoals.findIndex(r => r.id === goal.id);
    if (idx >= 0) db.weeklyGoals[idx] = { ...db.weeklyGoals[idx], ...goal, updatedAt: Date.now() };
    else db.weeklyGoals.push({ ...goal, updatedAt: Date.now() });
    this._cache = db;
    this._fbRef.child('weeklyGoals/' + goal.id).set(db.weeklyGoals.find(r=>r.id===goal.id));
  },
  getWeeklyReflection(studentId, weekKey) {
    return (this.load().weeklyReflections||[]).find(r => r.studentId===studentId && r.weekKey===weekKey) || null;
  },
  getAllWeeklyReflections() { return this.load().weeklyReflections || []; },
  saveWeeklyReflection(ref) {
    const db = this.load();
    db.weeklyReflections = db.weeklyReflections || [];
    const idx = db.weeklyReflections.findIndex(r => r.id === ref.id);
    if (idx >= 0) db.weeklyReflections[idx] = { ...db.weeklyReflections[idx], ...ref, updatedAt: Date.now() };
    else db.weeklyReflections.push({ ...ref, updatedAt: Date.now() });
    this._cache = db;
    this._fbRef.child('weeklyReflections/' + ref.id).set(db.weeklyReflections.find(r=>r.id===ref.id));
  },

  // ── 리코더 곡 목록 ─────────────────────────────────
  // { id, title, grade, memo, order, isFocusSong, active, createdAt, updatedAt }
  getRecorderSongs() {
    return (this.load().recorderSongs || [])
      .sort((a,b) => (a.order??99) - (b.order??99));
  },
  getActiveRecorderSongs() {
    return this.getRecorderSongs().filter(s => s.active !== false);
  },
  saveRecorderSong(song) {
    const db = this.load();
    db.recorderSongs = db.recorderSongs || [];
    const idx = db.recorderSongs.findIndex(s => s.id === song.id);
    const now = Date.now();
    if (idx >= 0) {
      db.recorderSongs[idx] = { ...db.recorderSongs[idx], ...song, updatedAt: now };
    } else {
      db.recorderSongs.push({
        order: db.recorderSongs.length, active: true, isFocusSong: false,
        ...song, createdAt: now, updatedAt: now
      });
    }
    this._cache = db;
    this._fbRef.child('recorderSongs').set(db.recorderSongs);
  },
  deleteRecorderSong(id) {
    const db = this.load();
    db.recorderSongs = (db.recorderSongs || []).filter(s => s.id !== id);
    this._cache = db;
    this._fbRef.child('recorderSongs').set(db.recorderSongs);
  },

  // ── 리코더 기록 ─────────────────────────────────────
  // 저장 단위: 학생 + 곡 + 날짜 = 1레코드
  // { id, studentId, studentName, songId, songTitle, date,
  //   practiceCount(0~5), recordingUrl, recordingName,
  //   reflection, bestToday, difficultPart, selfRating(1~5),
  //   teacherComment, createdAt, updatedAt }
  getAllRecorderLogs() { return this.load().recorderLogs || []; },
  getRecorderLogs(studentId) {
    return (this.load().recorderLogs || []).filter(r => r.studentId === studentId);
  },
  getRecorderLog(studentId, songId, date) {
    return (this.load().recorderLogs || []).find(
      r => r.studentId===studentId && r.songId===songId && r.date===date
    ) || null;
  },
  saveRecorderLog(log) {
    const db = this.load();
    db.recorderLogs = db.recorderLogs || [];
    const idx = db.recorderLogs.findIndex(r => r.id === log.id);
    const now = Date.now();
    if (idx >= 0) {
      db.recorderLogs[idx] = { ...db.recorderLogs[idx], ...log, updatedAt: now };
    } else {
      db.recorderLogs.push({ ...log, createdAt: now, updatedAt: now });
    }
    this._cache = db;
    this._fbRef.child('recorderLogs/' + log.id).set(
      db.recorderLogs.find(r => r.id === log.id)
    );
  },
  deleteRecorderLog(id) {
    const db = this.load();
    db.recorderLogs = (db.recorderLogs || []).filter(r => r.id !== id);
    this._cache = db;
    this._fbRef.child('recorderLogs/' + id).remove();
  },

  // ── 교육과정 문제 은행 (curriculum.js의 BASE_PROBLEMS + 교사 추가분) ──
  // customProblems: { id, unitId, type, q, a, choices?, alt?, hint?, level, createdAt }
  getCustomProblems()     { return this.load().customProblems || []; },
  saveCustomProblem(p) {
    const db = this.load();
    db.customProblems = db.customProblems || [];
    const idx = db.customProblems.findIndex(x => x.id === p.id);
    if (idx >= 0) db.customProblems[idx] = { ...db.customProblems[idx], ...p };
    else db.customProblems.push({ ...p, createdAt: Date.now() });
    this._cache = db;
    this._fbRef.child('customProblems').set(db.customProblems).catch(e => this._onSaveError(e));
  },
  deleteCustomProblem(id) {
    const db = this.load();
    db.customProblems = (db.customProblems || []).filter(x => x.id !== id);
    this._cache = db;
    this._fbRef.child('customProblems').set(db.customProblems).catch(e => this._onSaveError(e));
  },
  // 문제 풀이 기록: { id, studentId, unitId, date, total, correct, wrongIds[] }
  getProblemRecords(studentId) {
    const all = Object.values(this.load().problemRecords || {});
    return studentId ? all.filter(r => r && r.studentId === studentId) : all;
  },
  saveProblemRecord(rec) {
    const db = this.load();
    db.problemRecords = db.problemRecords || {};
    db.problemRecords[rec.id] = rec;
    this._cache = db;
    this._fbRef.child('problemRecords/' + rec.id).set(rec).catch(e => this._onSaveError(e));
  },

  // [VOCAB-REMOVE-1] RPG 안 영어 단어장은 폐기(영어는 영어앱으로 일원화).
  //   읽고 쓰던 헬퍼와 BASE_WORDS 500개를 지웠다.
  //   다만 데이터 노드 customWords · teacherWordSets · quizRecords 는 **지우지 않았고**
  //   BACKUP_NODES 에서도 빼지 않았다 — 되돌릴 여지를 남기기 위해서다.

  // ── 앨범 (그룹) ────────────────────────────────────────
  // { id, name, date, desc, createdAt }
  getAlbums()      { return this.load().memoryAlbums || []; },
  saveAlbum(a) {
    const db = this.load();
    db.memoryAlbums = db.memoryAlbums || [];
    const idx = db.memoryAlbums.findIndex(x=>x.id===a.id);
    if (idx>=0) db.memoryAlbums[idx] = {...db.memoryAlbums[idx],...a};
    else db.memoryAlbums.push({...a, createdAt:Date.now()});
    this._cache=db;
    this._fbRef.child('memoryAlbums').set(db.memoryAlbums);
  },
  deleteAlbum(id) {
    const db = this.load();
    db.memoryAlbums = (db.memoryAlbums||[]).filter(a=>a.id!==id);
    // 해당 앨범 사진들 앨범 해제
    (db.memories||[]).forEach(m=>{ if(m.albumId===id){ m.albumId=null; m.albumName=''; } });
    this._cache=db;
    this._fbRef.child('memoryAlbums').set(db.memoryAlbums);
    this._fbRef.child('memories').set(db.memories);
  },
  addPwResetRequest(r) {
    const db = this.load();
    db.pwResetRequests = [...(db.pwResetRequests || []), r];
    this._cache = db;
    this._saving = true;
    // 요청 단위 부분 저장 (root 전체 set 방지, id 키 기반)
    this._fbRef.child('pwResetRequests/' + r.id).set(r).finally(() => {
      setTimeout(() => this._endSaving(), 500);   // [SYNC-MERGE-2] 창 동안 받은 판을 버리지 않고 이때 반영
    });
  },
  removePwResetRequest(id) {
    const db = this.load();
    db.pwResetRequests = (db.pwResetRequests || []).filter(r => r.id !== id);
    this._cache = db;
    this._saving = true;
    // 요청 단위 삭제 (root 전체 set 방지)
    this._fbRef.child('pwResetRequests/' + id).remove().finally(() => {
      setTimeout(() => this._endSaving(), 500);   // [SYNC-MERGE-2] 창 동안 받은 판을 버리지 않고 이때 반영
    });
  },
  getPwResetRequests()    { return this.load().pwResetRequests || []; },
};

// ─── 유틸리티 ────────────────────────────────────────
const Utils = {

  // [ZERO-OK-1] 교사가 넣은 숫자 칸 읽기 — 0 은 0 으로 받고, 빈칸·글자·음수만 기본값(DB.autoDailyReward 의 pick 과 같은 규칙).
  //   예전 `parseInt(v) || 기본값` 은 0 을 넣어도 기본값(예: 0G → 30G)이 됐다. 위 끝(1000 자르기)은 두지 않는다 — 지금 받는 값 그대로.
  intOr(v, def) {
    const n = Math.floor(Number(v));
    return (v === '' || v == null || !Number.isFinite(n) || n < 0) ? def : n;
  },

  levelFromExp(exp) {
    const t = GAME_DATA.expTable;
    for (let i = t.length - 1; i >= 0; i--) { if (exp >= t[i]) return i + 1; }
    return 1;
  },
  expForLevel(lv)    { return GAME_DATA.expTable[Math.min(lv-1, GAME_DATA.expTable.length-1)]; },
  expForNextLevel(lv){ return GAME_DATA.expTable[Math.min(lv,   GAME_DATA.expTable.length-1)]; },

  expPct(s) {
    const cur  = s.exp - this.expForLevel(s.level);
    const need = this.expForNextLevel(s.level) - this.expForLevel(s.level);
    if (need <= 0) return 100;
    return Math.max(0, Math.min(100, (cur / need) * 100));
  },

  // ★ 장비 장착: 이전 스탯 제거 후 새 스탯 적용
  equipItem(student, item) {
    const slot = GAME_DATA.getSlotForItem(item.id);
    if (!slot) return;
    student.equipmentIds = student.equipmentIds || {};
    student.combat = student.combat || {};
    const oldId = student.equipmentIds[slot];
    if (oldId) {
      const old = GAME_DATA.getItemById(oldId);
      if (old) Object.entries(old.stats).forEach(([k,v]) => {
        student.combat[k] = Math.max(0, (student.combat[k]||0) - v);
      });
    }
    student.equipmentIds[slot] = item.id;
    student.equipment = student.equipment || {};
    student.equipment[slot] = item.name;
    Object.entries(item.stats).forEach(([k,v]) => {
      student.combat[k] = (student.combat[k]||0) + v;
    });
  },

  cropReady(planted, growHours)    { return Date.now() - planted >= growHours * 3600000; },
  cropProgress(planted, growHours) { return Math.min(100, ((Date.now()-planted)/(growHours*3600000))*100); },

  getSeedById(id)    { return GAME_DATA.seeds.find(s => s.id === id) || GAME_DATA.mutantSeeds.find(s => s.id === id); },
  getSeedByCrop(crop){ return GAME_DATA.seeds.find(s => s.crop === crop) || GAME_DATA.mutantSeeds.find(s => s.crop === crop); },

  condMet(student, cond) {
    return Object.entries(cond).every(([stat,val]) => (student.stats[stat]||0) >= val);
  },
  condText(cond) {
    const n = GAME_DATA.statNames;
    return Object.entries(cond).map(([s,v]) => `${n[s]||s} ${v}`).join(' + ') || '조건 없음';
  },
  statText(stats) {
    const n = GAME_DATA.combatNames;
    return Object.entries(stats).map(([s,v]) => `${n[s]||s} +${v}`).join(' · ');
  },

  charEmoji(type)       { return {1:'🧑‍🦱',2:'👧',3:'🧑',4:'👩'}[type]||'🧑'; },
  isPromotionLevel(lv)  { return GAME_DATA.promotionLevels.includes(lv); },

  // ★ 공용 퀘스트 상태 계산 (관리자/학생/키오스크 3화면 공통)
  // 반환값: 'done' | 'pending' | 'none'
  questStatus(studentId, questId, questType, questLogs, pendingRewards, activeBoardQuestIds) {
    // 삭제된 boardQuest 참조는 무시
    if (activeBoardQuestIds && !activeBoardQuestIds.has(questId)) return 'none';

    // 완료 판정
    const done = this.isQuestDoneToday(questLogs, studentId, questId, questType);
    if (done) return 'done';

    // 승인된 pending도 done 취급
    const approved = (pendingRewards||[]).some(r=>
      r && r.boardQuestId===questId && r.approved===true
    );
    if (approved) return 'done';

    // 대기중
    const pending = (pendingRewards||[]).some(r=>
      r && r.boardQuestId===questId && !r.approved
    );
    if (pending) return 'pending';

    return 'none';
  },

  // 장래희망 + 레벨로 직업명 생성
  getJobTitle(dream, level) {
    if (!dream) dream = '직장인';
    // 장래희망에서 핵심 단어 추출
    const core = dream
      .replace(/미래의?\s*/,'').replace(/꿈꾸는\s*/,'').replace(/되고싶은\s*/,'')
      .replace(/장래희망\s*/,'').replace(/최고의\s*/,'').trim() || dream;

    if (level < 5)  return '초등학생';
    if (level < 10) return '중학생';
    if (level < 15) return '고등학생';
    if (level < 20) return '대학생';
    if (level < 25) return `${core} 지망생`;
    if (level < 30) return core;
    return `위대한 ${core}`;
  },
  todayStr() {
    // KST(UTC+9) 기준 날짜
    return new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  },
  weekStartStr() {
    // KST 기준 이번 주 일요일 (일요일 자정 리셋)
    const d = new Date(Date.now()+9*3600000);
    const day = d.getUTCDay(); // 0=일, 1=월 ...
    const sun = new Date(d);
    sun.setUTCDate(d.getUTCDate() - day); // 이번 주 일요일
    return sun.toISOString().slice(0,10);
  },
  // ISO 주차 키: 2026-W14 형태 (월요일 기준)
  weekKey() {
    const d = new Date(Date.now()+9*3600000);
    const day = d.getUTCDay(); // 0=일
    // 이번 주 월요일 찾기
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setUTCDate(d.getUTCDate() + diff);
    // ISO 주차 계산
    const jan1 = new Date(Date.UTC(mon.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((mon - jan1) / 86400000 + jan1.getUTCDay() + 1) / 7);
    return `${mon.getUTCFullYear()}-W${String(weekNum).padStart(2,'0')}`;
  },
  isQuestDoneToday(quests, studentId, boardQuestId, questType) {
    const today = this.todayStr();
    const weekStart = this.weekStartStr();
    return (quests||[]).some(q => {
      if (q.studentId!==studentId || q.boardQuestId!==boardQuestId) return false;
      if (!q.date) return true;
      if (questType==='daily')  return q.date===today;
      if (questType==='weekly') return q.date>=weekStart;
      return true;
    });
  },
  uid()                 { return 'id_'+Date.now()+'_'+Math.random().toString(36).slice(2,7); },

  // ★ 몬스터 하루 도전 횟수 체크 — DB settings에서 직접 읽어 항상 최신값 보장
  _getBattleLimit() {
    if (typeof DB !== 'undefined') {
      const bs = (DB.getSettings()?.customBattleSettings) || {};
      if (bs.dailyBattleLimit !== undefined) return bs.dailyBattleLimit;
    }
    return BATTLE_CONSTS?.dailyBattleLimit ?? 3;
  },
  canFightMonster(student) {
    const limit = this._getBattleLimit();
    const today = this.todayStr();
    const bd = student.battleDaily || {};
    if (bd.dateKey !== today) return true;
    return (bd.used || 0) < limit;
  },
  monsterAttemptsLeft(student) {
    const limit = this._getBattleLimit();
    const today = this.todayStr();
    const bd = student.battleDaily || {};
    if (bd.dateKey !== today) return limit;
    return Math.max(0, limit - (bd.used || 0));
  },
};

// ── [GAMEDATA-SPLIT-1] 여기 있던 'rules' 덩어리(397줄)는 gamedata/rules.js 로 옮겼다 — 글자 그대로 ──
// ── [GAMEDATA-SPLIT-1] 여기 있던 'emotion' 덩어리(217줄)는 gamedata/emotion.js 로 옮겼다 — 글자 그대로 ──
// ── [GAMEDATA-SPLIT-1] 여기 있던 'battle' 덩어리(717줄)는 gamedata/battle.js 로 옮겼다 — 글자 그대로 ──
// ── [GAMEDATA-SPLIT-1] 여기 있던 'reflect' 덩어리(136줄)는 gamedata/emotion.js 로 옮겼다 — 글자 그대로 ──
