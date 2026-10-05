// 가짜 RTDB 서버 끼움 [FAKE-RTDB-1] — server.mjs 가 html 을 내줄 때 끼운다(저장소 html 은 그대로).
//  ① <head> 맨 앞(Firebase SDK 보다 먼저): 운영 RTDB 주소로 가는 WebSocket·fetch·XHR·EventSource 를 이 서버로 돌리고,
//     Firestore·Storage·인증 주소는 막는다. SDK 는 실을 때 WebSocket 을 붙잡아 두므로 꼭 먼저 돌아야 한다.
//  ② database SDK 태그 바로 뒤 __FAKE_RTDB.init(): 가짜 프로젝트로 initializeApp(databaseURL = 이 서버) — gamedata.js·
//     kiosk.js·common/rpg-firebase.js 는 '앱이 이미 있으면' 그대로 쓴다. WebSocket 만 쓰게(긴 폴링 끔).
//  ③ student.html?as=<학생 id 또는 이름> → 그 학생으로 바로 입장 · admin.html?auto → 관리 화면 바로 입장(가짜 DB 의 비밀번호).
(function () {
  if (window.__FAKE_RTDB) return;
  const ORIGIN = location.origin;
  const WS_ORIGIN = ORIGIN.replace(/^http/, 'ws');
  const FAKE_URL = ORIGIN + '/?ns=fake-rpg';
  const PROD_DB = /(^|\.)(firebaseio\.com|firebasedatabase\.app)$/i;
  const BLOCK = /(^|\.)((firestore|firebasestorage|identitytoolkit|securetoken|firebaseinstallations|firebaseremoteconfig|firebase)\.googleapis\.com|cloudfunctions\.net)$/i;
  const stats = { redirected: 0, blocked: 0 };

  //  운영 RTDB 주소 → 이 서버 · 막을 주소 → null
  function reroute(url, ws) {
    let u; try { u = new URL(String(url), location.href); } catch (e) { return String(url); }
    if (PROD_DB.test(u.hostname)) { stats.redirected++; return ws ? WS_ORIGIN + '/.ws' + u.search : ORIGIN + '/.rtdb' + u.pathname + u.search; }
    if (BLOCK.test(u.hostname)) { stats.blocked++; return null; }
    return String(url);
  }

  const NativeWS = window.WebSocket;
  if (NativeWS) {
    const W = function WebSocket(url, protocols) {
      const t = reroute(url, true);
      if (t == null) throw new Error('가짜 서버: 막은 주소');
      return protocols === undefined ? new NativeWS(t) : new NativeWS(t, protocols);
    };
    W.prototype = NativeWS.prototype;
    for (const k of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) W[k] = NativeWS[k];
    window.WebSocket = W;
  }
  const nativeFetch = window.fetch && window.fetch.bind(window);
  if (nativeFetch) {
    window.fetch = function (input, init) {
      const isReq = typeof Request !== 'undefined' && input instanceof Request;
      const t = reroute(isReq ? input.url : input, false);
      if (t == null) return Promise.reject(new TypeError('가짜 서버: 막은 주소'));
      if (isReq) return t === input.url ? nativeFetch(input, init) : nativeFetch(new Request(t, input), init);
      return nativeFetch(t, init);
    };
  }
  const xopen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, url, ...rest) {
    const t = reroute(url, false);
    return xopen.call(this, m, t == null ? 'about:blank#blocked' : t, ...rest);
  };
  if (window.EventSource) {
    const NES = window.EventSource;
    const E = function EventSource(url, opts) { const t = reroute(url, false); if (t == null) throw new Error('가짜 서버: 막은 주소'); return new NES(t, opts); };
    E.prototype = NES.prototype;
    window.EventSource = E;
  }

  function init() {
    const fb = window.firebase;
    if (!fb || init.done) return;
    init.done = true;
    //  어떤 앱이든 databaseURL 은 이 서버로(영어앱 같은 두 번째 앱 포함)
    const realInit = fb.initializeApp.bind(fb);
    fb.initializeApp = function (cfg, name) {
      const c = Object.assign({}, cfg || {});
      if (c.databaseURL) c.databaseURL = FAKE_URL;
      return realInit(c, name);
    };
    if (!fb.apps.length) fb.initializeApp({ apiKey: 'fake', projectId: 'fake-rpg-local', appId: 'fake', databaseURL: FAKE_URL });
    try { fb.database.INTERNAL.forceWebSockets(); } catch (e) {}
    //  Firestore(영어앱 보상 읽기)·Storage(사진 올리기)는 없음 — firestore() 가 null 이면 student.js 가 조용히 건너뜀
    fb.firestore = function () { return null; };
    fb.storage = function () { throw new Error('시연용 가짜 서버에서는 사진 올리기가 안 돼요'); };
  }

  function badge() {
    if (document.getElementById('fake-rtdb-badge')) return;
    const tag = document.createElement('div');
    tag.id = 'fake-rtdb-badge';
    tag.textContent = '🧪 시연용 — 진짜 기록 아님';
    tag.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:2147483647;background:#7a2;color:#fff;font:700 11px sans-serif;padding:3px 7px;border-radius:6px;pointer-events:none;opacity:.85';
    document.body.appendChild(tag);
  }
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (e) {} await sleep(60); } return false; }
  //  관리 화면은 다 읽은 뒤 loading-screen 을 지운다(없음 = 다 읽음)
  const loaded = () => { const ls = document.getElementById('loading-screen'); return typeof DB !== 'undefined' && !!DB._cache && (!ls || ls.style.display === 'none'); };

  async function autoEnter() {
    const q = new URLSearchParams(location.search);
    const page = location.pathname.replace(/^.*\//, '') || 'index.html';
    if (page === 'student.html' && q.get('as')) {
      if (!await until(loaded, 20000)) return;
      const want = q.get('as');
      const s = DB.getStudent(want) || (DB.getStudents() || []).find(x => x && x.name === want);
      if (!s) { console.warn('[가짜 RTDB] 그런 학생이 없어요:', want); return; }
      document.getElementById('s-title')?.classList.add('hidden');
      // eslint-disable-next-line no-undef
      SEL_STUDENT = s.id;
      const pw = document.getElementById('pw-input'); if (pw) pw.value = s.pw;
      // eslint-disable-next-line no-undef
      doLogin();
    }
    if (page === 'admin.html' && q.has('auto')) {
      if (!await until(loaded, 20000)) return;
      const el = document.getElementById('admin-pw-input');
      if (el) { el.value = await DB.getAdminPw(); adminLogin(); }   // eslint-disable-line no-undef
    }
  }

  window.__FAKE_RTDB = { init, stats, url: FAKE_URL };
  document.addEventListener('DOMContentLoaded', () => { badge(); autoEnter(); });
})();
