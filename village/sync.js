/* ══════════════════════════════════════════════════════════════
   village/sync.js — 우리 마을 원격 저장층 (G5 ④ · VILLAGE-SYNC-1)

   설계: 성장rpg_3d/G5_4_RTDB_설계확정_20260914.md
   원본: 이 파일은 **저장소가 원본**이다. 디자인 폴더에는 시험용 복사본만 둔다.

   마을(index.html)과 만나는 곳은 셋뿐이다.
     1) <script src="./sync.js"></script>                         ← 모듈보다 먼저
     2) if (window.VillageSync) await VillageSync.boot({ sid: SID }) ← loadSaved() 바로 앞
     3) if (window.VillageSync) VillageSync.attach()                ← 모듈 맨 끝(마을의 pagehide 뒤에 붙도록)
   그 밖에는 마을 내부를 모른다. 마을이 localStorage 에 써 둔 저장본(v2)만 읽고, 원격 판은 그 자리에 써 준다.

   왜 "바뀐 구역 키"를 마을에서 받지 않고 문자열을 직접 비교하나 (44차 대조에서 확인)
     44차 palette 는 **지금 있는 종류를 정렬한 목록**이다. road 만 있던 판에 bush 를 하나 놓으면
     road 의 번호가 0→1 로 밀려 **손대지 않은 구역의 문자열까지 바뀐다.** 마을이 알려 주는 구역만 올리면
     원격의 그 구역이 새 palette 로 읽혀 **길이 전부 bush 가 된다.** 그래서 마지막으로 올린 문자열의
     해시와 지금 문자열을 비교해 달라진 구역을 모두 올린다(palette 와 한 번에).

   하지 않는 일
     · 구역 문자열을 만들거나 풀지 않는다(나르기만)
     · sid 가 guest 면 네트워크를 한 번도 쓰지 않는다
     · onDisconnect 를 쓰지 않는다(옛 기기 연결이 끊길 때 새 주인의 session 을 지우는 경합)
   ══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const DEFAULTS = {
    dbUrl: 'https://class-rpg-6f409-default-rtdb.asia-southeast1.firebasedatabase.app',
    pollMs: 1000,         // 마을 저장본을 이만큼마다 들여다본다
    quietMs: 2000,        // 저장본이 이만큼 안 바뀌면 올린다
    maxWaitMs: 10000,     // 계속 바뀌어도 이만큼마다는 올린다
    heartbeatMs: 60000,   // session/at 갱신
    staleMs: 90000,       // 이보다 오래 소식 없는 session 은 비었다고 본다
    keepaliveLimit: 60000 // keepalive 본문 한도(브라우저 64KB 아래로)
  };
  const SV = { '.sv': 'timestamp' };

  /* ── 44차 저장본 ↔ 원격 모양 ── */
  const cKeys = o => { const r = {}; if (o && typeof o === 'object') for (const k in o) if (o[k] != null) r[/^c/.test(k) ? k : 'c' + k] = o[k]; return r; };
  const unC = o => { const r = {}; if (o && typeof o === 'object') for (const k in o) if (o[k] != null) r[k.replace(/^c/, '')] = o[k]; return r; };
  const arr = v => Array.isArray(v) ? v.filter(x => x != null) : (v && typeof v === 'object') ? Object.keys(v).sort((a, b) => a - b).map(k => v[k]) : [];
  const objOrArr = v => { if (Array.isArray(v)) { const o = {}; v.forEach((x, i) => { if (x != null) o['c' + i] = x; }); return o; } return (v && typeof v === 'object') ? v : {}; };

  // [VILLAGE-NAME-1] 65차 마을 이름(meta.name) — 문자열 12자까지, 비었으면 키를 아예 안 둔다
  //   (이름 없는 마을의 meta 모양·해시가 그대로라 이 변경만으로 다시 올리지 않는다)
  const NAME_MAX = 12;
  const cleanName = v => (typeof v === 'string' && v.trim()) ? Array.from(v.trim()).slice(0, NAME_MAX).join('') : '';

  function fromVillage(d) {                       // 마을 v2(평평함) → { meta, plots }
    if (!d || typeof d !== 'object' || d.v < 2 || !d.plotStr) return null;
    const name = cleanName(d.name);
    return {
      meta: { v: d.v, w: d.w, h: d.h, palette: d.palette || [], clock: d.clock || null, houses: cKeys(d.houses), signs: cKeys(d.signs),
              unlocked: d.unlocked || [], goals: d.goals || [], festSeen: !!d.festSeen, dream: d.dream || '',
              plotsOpen: d.plots || [], plotsEarned: d.plotsEarned || 0, hist: d.hist || [], ...(name ? { name } : {}) },
      plots: Object.assign({}, d.plotStr)
    };
  }
  function toVillage(r) {                          // 원격 { meta, plots } → 마을 v2
    const m = r.meta;
    const name = cleanName(m.name);
    return { ...(name ? { name } : {}), v: m.v || 2, w: m.w, h: m.h, palette: arr(m.palette), plotStr: Object.assign({}, r.plots || {}),
             clock: m.clock || { t: 0, speed: 1 }, houses: unC(objOrArr(m.houses)), unlocked: arr(m.unlocked), goals: arr(m.goals),
             festSeen: !!m.festSeen, dream: m.dream || '', plots: arr(m.plotsOpen), plotsEarned: m.plotsEarned || 0,
             signs: unC(objOrArr(m.signs)), hist: arr(m.hist) };
  }
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + s.length; }
  const metaHash = m => { const c = Object.assign({}, m); delete c.savedAt; delete c.dev; return hash(JSON.stringify(c)); };

  function create(opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const sid = o.sid;
    const doFetch = o.fetch || (root.fetch && root.fetch.bind(root));
    const storage = o.storage || root.localStorage;
    const nowFn = o.now || (() => Date.now());
    const setT = o.setTimeout || root.setTimeout.bind(root);
    const clearT = o.clearTimeout || root.clearTimeout.bind(root);
    const watchFn = o.watch || defaultWatch;
    const ask = o.ask || (t => Promise.resolve(root.confirm ? root.confirm(t) : false));
    const notice = o.notice || defaultNotice;
    const GUEST = !sid || sid === 'guest';

    const KEY = 'rpg.village.' + sid;
    const BOOK = KEY + '.sync';            // { h:{구역:해시}, m:meta해시, baseAt }
    const BACKUP = KEY + '.sync-backup';   // 원격이 이겼을 때 로컬 원문. 마을 [가져오기] 의 .backup 과 따로 둔다

    const st = {
      owner: false, viewOnly: false, dev: devId(), book: null, offset: 0,
      lastRaw: null, lastChange: 0, pendingSince: 0,
      pollT: 0, beatT: 0, unwatch: null, sending: false, closed: false, attached: false, hiddenRaw: null,
      stats: { patches: 0, puts: 0, gets: 0, keepalive: 0, failed: 0 }
    };

    function devId() {
      try { let d = storage.getItem('rpg.village.dev'); if (!d) { d = 'd-' + Math.random().toString(36).slice(2, 14); storage.setItem('rpg.village.dev', d); } return d; }
      catch (e) { return 'd-nostore'; }
    }
    const readRaw = () => { try { return storage.getItem(KEY); } catch (e) { return null; } };
    function readLocal() {                         // { raw, snap } · snap=null 이면 v1 또는 없음
      const raw = readRaw(); if (!raw) return { raw: null, snap: null, v1: false };
      try { const d = JSON.parse(raw); const snap = fromVillage(d); return { raw, snap, v1: !snap && Array.isArray(d && d.items) }; }
      catch (e) { return { raw, snap: null, v1: false }; }
    }
    function loadBook() { try { const b = JSON.parse(storage.getItem(BOOK) || 'null'); if (b && b.h && typeof b.h === 'object') return b; } catch (e) {} return null; }
    function saveBook() { try { storage.setItem(BOOK, JSON.stringify(st.book)); } catch (e) {} }
    function bookFrom(snap, baseAt) { const h = {}; for (const k in snap.plots) h[k] = hash(snap.plots[k]); return { h, m: metaHash(snap.meta), baseAt: baseAt == null ? null : baseAt }; }

    /* 마지막으로 올린 것과 지금 로컬의 차이 */
    function diff(snap, book) {
      if (!snap) return { plots: [], removed: [], meta: false, any: false };
      if (!book) { const plots = Object.keys(snap.plots); return { plots, removed: [], meta: true, any: true }; }
      const plots = Object.keys(snap.plots).filter(k => book.h[k] !== hash(snap.plots[k]));
      const removed = Object.keys(book.h).filter(k => !(k in snap.plots));
      const meta = book.m !== metaHash(snap.meta);
      return { plots, removed, meta, any: !!(plots.length || removed.length || meta) };
    }

    /* ── REST ── */
    const url = p => o.dbUrl + '/classRPG_villages/' + encodeURIComponent(sid) + (p ? '/' + p : '') + '.json' + (o.query || '');   // query: 에뮬레이터용(?ns=…) — 운영에서는 비워 둔다
    const serverNow = () => nowFn() + st.offset;
    const learnOffset = ms => { if (typeof ms === 'number' && ms > 0) st.offset = ms - nowFn(); };
    async function getJSON(path, withEtag) {
      st.stats.gets++;
      const r = await doFetch(url(path), withEtag ? { headers: { 'X-Firebase-ETag': 'true' } } : {});
      if (!r.ok) throw new Error('GET ' + r.status);
      return { data: await r.json(), etag: r.headers && r.headers.get ? r.headers.get('ETag') : null };
    }
    function normRemote(d) {
      if (!d || typeof d !== 'object' || !d.meta) return null;
      return { meta: d.meta, plots: (d.plots && typeof d.plots === 'object' && !Array.isArray(d.plots)) ? d.plots : {}, session: d.session || null };
    }

    /* ── 결정표(설계 §3 + §3-0 보강) — 순수 함수 ── */
    function decide(local, dirtyAny, book, remote, dev) {
      if (local.v1) return remote ? 'remoteBackup' : 'new';      // v1 은 마을이 곧 v2 로 바꾼다 — 그 뒤 첫 비교에서 올린다
      if (!local.snap && !remote) return 'new';
      if (!local.snap) return 'remote';
      if (!remote) return 'uploadAll';
      if (!dirtyAny) return 'remote';
      if (remote.meta.dev === dev) return 'pushDirty';               // 원격 마지막 쓰기가 이 기기(닫힐 때 keepalive 도착)
      if (book && book.baseAt != null && (remote.meta.savedAt || 0) <= book.baseAt) return 'pushDirty';
      return 'remoteBackup';
    }

    /* ── session ── */
    async function claim(force) {
      const g = await getJSON('session', true);
      const s = g.data;
      const free = !s || s.dev === st.dev || typeof s.at !== 'number' || serverNow() - s.at > o.staleMs;
      if (!free && !force) return 'ask';
      st.stats.puts++;
      const r = await doFetch(url('session'), { method: 'PUT', headers: force ? {} : { 'if-match': g.etag || 'null_etag' }, body: JSON.stringify({ dev: st.dev, at: SV }) });
      if (r.status === 412) return 'ask';
      if (!r.ok) { st.stats.failed++; return 'error'; }
      try { const b = await r.json(); if (b) learnOffset(b.at); } catch (e) {}
      st.owner = true; st.viewOnly = false;
      startBeat();
      if (!st.unwatch) st.unwatch = watchFn(url('session'), onSession);
      return 'owner';
    }
    function loseOwner() {
      if (!st.owner) return;
      st.owner = false; st.viewOnly = true;
      clearT(st.beatT); st.beatT = 0;
      notice('다른 기기에서 마을을 열었어요. 여기서 바꾼 것은 이 기기에만 남아요', 'warn');
    }
    function onSession(s) {
      if (st.closed) return;
      if (s == null) { if (st.owner) claim(true).catch(() => {}); return; }
      if (s.dev && s.dev !== st.dev) loseOwner();
    }
    function startBeat() {
      clearT(st.beatT);
      st.beatT = setT(async function beat() {
        if (!st.owner || st.closed) return;
        try { st.stats.patches++; await doFetch(url('session'), { method: 'PATCH', body: JSON.stringify({ at: SV }) }); } catch (e) { st.stats.failed++; }   // at 만 — dev 는 안 쓴다
        if (st.owner && !st.closed) st.beatT = setT(beat, o.heartbeatMs);
      }, o.heartbeatMs);
    }

    /* ── 쓰기 ── */
    function bodyFor(snap, d) {
      const body = { meta: JSON.parse(JSON.stringify(Object.assign({}, snap.meta, { savedAt: SV, dev: st.dev }))) };
      d.plots.forEach(k => { body['plots/' + k] = snap.plots[k]; });
      d.removed.forEach(k => { body['plots/' + k] = null; });
      return body;
    }
    async function flush() {
      if (GUEST || !st.owner || st.closed || st.sending) return 'skip';
      const { snap } = readLocal();
      const d = diff(snap, st.book);
      if (!d.any) { st.pendingSince = 0; return 'clean'; }
      st.sending = true;
      try {
        st.stats.patches++;
        const r = await doFetch(url(''), { method: 'PATCH', body: JSON.stringify(bodyFor(snap, d)) });
        if (!r.ok) { st.stats.failed++; return 'failed'; }
        let savedAt = null; try { const b = await r.json(); savedAt = b && b.meta && b.meta.savedAt; } catch (e) {}
        learnOffset(savedAt);
        // 보낸 것만 장부에 적는다 — 보내는 사이 바뀐 것은 다음 비교에서 또 잡힌다
        const book = st.book || { h: {}, m: null, baseAt: null };
        d.plots.forEach(k => { book.h[k] = hash(snap.plots[k]); });
        d.removed.forEach(k => { delete book.h[k]; });
        book.m = metaHash(snap.meta);
        book.baseAt = typeof savedAt === 'number' ? savedAt : serverNow();
        st.book = book; saveBook();
        st.pendingSince = 0;
        return 'ok';
      } catch (e) { st.stats.failed++; return 'failed'; }
      finally { st.sending = false; }
    }
    function poll() {
      if (st.closed) return;
      const raw = readRaw(), t = nowFn();
      if (raw !== st.lastRaw) { st.lastRaw = raw; st.lastChange = t; if (!st.pendingSince) st.pendingSince = t; }
      const due = st.pendingSince && (t - st.lastChange >= o.quietMs || t - st.pendingSince >= o.maxWaitMs);
      const go = due && st.owner ? flush() : null;
      Promise.resolve(go).finally(() => { if (!st.closed) st.pollT = setT(poll, o.pollMs); });
    }

    /* ── 1) boot: 마을이 저장본을 읽기 전에 ── */
    async function boot() {
      if (GUEST) return { mode: 'local' };
      st.book = loadBook();
      const local = readLocal();
      let remote;
      try { remote = normRemote((await getJSON('', false)).data); }
      catch (e) { return { mode: 'offline' }; }                         // 못 읽으면 로컬로 · 쓰기도 안 함

      let who = await claim(false).catch(() => 'error');
      if (who === 'ask') who = (await ask('다른 기기에서 마을이 열려 있어요. 여기서 계속할까요?')) ? await claim(true).catch(() => 'error') : 'view';
      if (who !== 'owner') {
        st.viewOnly = true;
        if (remote) writeVillage(remote, local, false);                  // 구경: 원격을 보여 준다(로컬은 사본으로)
        return { mode: who === 'view' ? 'view' : 'error' };
      }
      const d = diff(local.snap, st.book);
      const act = decide(local, d.any, st.book, remote, st.dev);
      if (act === 'remote') { writeVillage(remote, local, false); st.book = bookFrom(fromVillage(toVillage(remote)), remote.meta.savedAt || null); saveBook(); }
      else if (act === 'remoteBackup') { writeVillage(remote, local, true); st.book = bookFrom(fromVillage(toVillage(remote)), remote.meta.savedAt || null); saveBook(); notice('이 기기에만 남은 마을이 있어요 — 선생님께 말하면 되살릴 수 있어요', 'warn'); }
      else if (act === 'uploadAll') { st.book = null; await flush(); }
      else if (act === 'pushDirty') { await flush(); }
      st.lastRaw = readRaw();
      return { mode: 'owner', act };
    }
    function writeVillage(remote, local, backup) {
      try {
        if (local.raw && (backup || local.v1)) storage.setItem(BACKUP, JSON.stringify({ at: nowFn(), raw: local.raw }));
        storage.setItem(KEY, JSON.stringify(toVillage(remote)));
      } catch (e) {}
    }

    /* ── 2) attach: 마을이 뜬 뒤 ── */
    function attach() {
      if (GUEST || st.attached) return;
      st.attached = true;
      st.lastRaw = readRaw();
      st.pollT = setT(poll, o.pollMs);
      if (root.addEventListener) root.addEventListener('pagehide', onPageHide);   // 마을의 pagehide(로컬 저장) 뒤에 붙는다
      const doc = root.document;                                                   // [SYNC-HIDDEN-1] 가려질 때도 — 마을의 visibilitychange(로컬 저장) 뒤에 붙는다
      if (doc && doc.addEventListener) doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'hidden') onHidden(); });
    }

    /* ── 닫힐 때 — 전부 아니면 하나도 안 보냄 ── */
    function onPageHide() {
      if (GUEST || !st.owner) return 'skip';
      const r = readRaw() === st.hiddenRaw ? 'same' : pushOnHide();   // 방금 가려질 때 같은 내용을 보냈으면 데이터는 다시 안 보낸다(세션은 놓는다)
      releaseSession();
      return r;
    }
    // [SYNC-HIDDEN-1] 가려질 때(앱 바꾸기·홈 버튼·탭 전환) — 태블릿·크롬북은 그 뒤 OS 가 탭을 죽이면 pagehide 가 안 온다.
    //   그러면 마지막 quietMs(2초)분이 다른 기기로 안 갔다(같은 기기에선 다음 열기에 올라감). 데이터만 keepalive 로 보내고
    //   **세션은 놓지 않는다** — 다시 보이면 이 기기가 그대로 주인이고 poll 이 이어 간다. 같은 내용이면 다시 안 보낸다.
    function onHidden() {
      if (GUEST || !st.owner || st.closed) return 'skip';
      const raw = readRaw(); if (raw === st.hiddenRaw) return 'same';
      const r = pushOnHide(); if (r === 'sent' || r === 'clean') st.hiddenRaw = raw; st.stats.hidden = (st.stats.hidden || 0) + 1;
      return r;
    }
    function pushOnHide() {
      const { snap } = readLocal(); const d = diff(snap, st.book);
      if (!d.any) return 'clean';
      const body = JSON.stringify(bodyFor(snap, d));
      // 일부 구역만 보내면 palette 가 바뀐 경우 나머지 구역이 새 palette 로 잘못 읽힌다 → 한도를 넘으면 보내지 않고 다음 열기에 맡긴다
      if (body.length > o.keepaliveLimit) return 'too-big';
      try { st.stats.keepalive++; doFetch(url(''), { method: 'PATCH', keepalive: true, body }); } catch (e) {}
      return 'sent';   // 응답을 못 기다리니 장부는 그대로. 다음 열기에서 원격 meta.dev 가 이 기기면 로컬을 믿는다
    }
    // [SYNC-SESSION-RELEASE-1] 닫힐 때 session 을 "오래된 것"으로 만든다(at=0). dev 는 그대로 둔다.
    //   전에는 닫아도 session 이 90초 남아, 곧바로 다른 기기에서 열면 "다른 기기에서 열려 있어요" 물음이 떴고
    //   되살리기(village-restore)도 90초를 기다려야 했다.
    //   · 주인일 때만 보낸다 — 주인을 이미 잃은 기기는 onPageHide 첫 줄에서 돌아가므로 새 주인을 건드리지 않는다.
    //   · onDisconnect 가 아니라 이 기기가 스스로 닫힐 때 한 번이라, 옛 기기 연결이 늦게 끊겨 새 주인을 지우는 경합이 없다.
    //   · dev 를 남기므로 규칙(session 에 dev·at 필수)도 통과한다. keepalive 가 막히면 예전처럼 90초 뒤 풀린다.
    function releaseSession() {
      try { st.stats.keepalive++; doFetch(url('session'), { method: 'PATCH', keepalive: true, body: JSON.stringify({ at: 0 }) }); } catch (e) {}
      st.owner = false;
      clearT(st.beatT); st.beatT = 0;
    }

    function close() { st.closed = true; clearT(st.pollT); clearT(st.beatT); if (st.unwatch) { try { st.unwatch(); } catch (e) {} st.unwatch = null; } }

    function defaultWatch(u, cb) {
      if (!root.EventSource) return null;
      const es = new root.EventSource(u); let cur = null;
      // put  = 그 자리를 통째로 바꿈 · patch = 그 자리에 **조각만** 합침(에뮬레이터 실측: 심장박동 PATCH 는 {at} 만 온다)
      //   patch 를 put 처럼 받으면 dev 를 잃는다
      const apply = (e, merge) => {
        try {
          const m = JSON.parse(e.data), key = m.path.replace(/^\/+/, '');
          if (!key) cur = merge ? Object.assign({}, cur || {}, m.data || {}) : m.data;
          else { cur = Object.assign({}, cur || {}); if (merge) cur[key] = Object.assign({}, cur[key] || {}, m.data || {}); else cur[key] = m.data; }
          cb(cur);
        } catch (err) {}
      };
      es.addEventListener('put', e => apply(e, false)); es.addEventListener('patch', e => apply(e, true));
      return () => es.close();
    }
    function defaultNotice(text) {
      if (!root.document || !root.document.body) return;
      const el = root.document.createElement('div');
      el.textContent = text;
      el.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:99999;background:#3a2f12;color:#ffe9a8;padding:.55rem .9rem;border-radius:10px;font:14px sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.4)';
      root.document.body.appendChild(el); setT(() => el.remove(), 6000);
    }

    return { boot, attach, flush, poll, onPageHide, onHidden, close, decide, diff, state: st, _claim: claim };
  }

  /* 마을에서 쓰는 모양: VillageSync.boot({sid}) → 한 개만 만든다 */
  let single = null;
  const api = {
    DEFAULTS, create, fromVillage, toVillage, hash,
    boot(opts) { single = create(opts); return single.boot(); },
    attach() { if (single) single.attach(); },
    get current() { return single; }
  };
  root.VillageSync = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
