// 메모리 가짜 RTDB(REST 흉내) + 가상 시계. 네트워크 0.
// 흉내 내는 것: GET / PUT / PATCH(슬래시 키 여러 경로) / X-Firebase-ETag · if-match → 412 /
//   {".sv":"timestamp"} / null 쓰기 = 지우기 / 빈 객체·빈 배열은 남지 않음 / 촘촘한 정수 키는 배열로 읽힘 /
//   경로 감시(EventSource 대신 콜백) / keepalive 표시 / 실패 주입
// 흉내 내지 않는 것(=진짜 RTDB 에서 따로 확인할 것): 규칙, 응답 본문의 정확한 모양, keepalive+PATCH 의 브라우저 동작

export function makeClock() {
  let t = 1_700_000_000_000, id = 0;
  const timers = new Map();
  const clock = {
    get t() { return t; },
    setTimeout(fn, ms) { const k = ++id; timers.set(k, { at: t + ms, fn }); return k; },
    clearTimeout(k) { timers.delete(k); },
    async settle() { for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r)); },
    async advance(ms) {
      const end = t + ms;
      for (;;) {
        let next = null;
        for (const [k, v] of timers) if (v.at <= end && (!next || v.at < next[1].at)) next = [k, v];
        if (!next) break;
        timers.delete(next[0]); t = next[1].at;
        next[1].fn(); await clock.settle();
      }
      t = end; await clock.settle();
    },
    pending() { return timers.size; },
  };
  return clock;
}

export function makeRTDB(clock) {
  let tree = null;
  const watchers = [];
  const log = [];
  let failNext = 0, dropKeepalive = false;

  const split = p => p.split('/').filter(Boolean);
  function get(path) { let n = tree; for (const s of split(path)) { if (!n || typeof n !== 'object') return null; n = n[s]; } return n === undefined ? null : n; }
  function resolve(v) {
    if (v && typeof v === 'object') {
      if (v['.sv'] === 'timestamp') return clock.t;
      if (Array.isArray(v)) { const o = {}; v.forEach((x, i) => { const r = resolve(x); if (r != null) o[i] = r; }); return Object.keys(o).length ? o : null; }
      const o = {}; for (const k in v) { const r = resolve(v[k]); if (r != null) o[k] = r; }
      return Object.keys(o).length ? o : null;
    }
    return v === undefined ? null : v;
  }
  function prune(n) { if (!n || typeof n !== 'object') return n; for (const k in n) { n[k] = prune(n[k]); if (n[k] == null) delete n[k]; } return Object.keys(n).length ? n : null; }
  function set(path, val) {
    const s = split(path); val = resolve(val);
    if (!s.length) { tree = val; return; }
    if (!tree || typeof tree !== 'object') tree = {};
    let n = tree;
    for (let i = 0; i < s.length - 1; i++) { if (!n[s[i]] || typeof n[s[i]] !== 'object') n[s[i]] = {}; n = n[s[i]]; }
    if (val == null) delete n[s[s.length - 1]]; else n[s[s.length - 1]] = val;
    tree = prune(tree);
  }
  // 촘촘한 정수 키 객체는 배열로 읽힌다(RTDB 읽기 규칙 흉내)
  function readShape(n) {
    if (!n || typeof n !== 'object') return n;
    const ks = Object.keys(n);
    if (ks.length && ks.every(k => /^(0|[1-9][0-9]*)$/.test(k))) {
      const max = Math.max(...ks.map(Number));
      if (ks.length * 2 > max + 1) { const a = []; ks.forEach(k => { a[+k] = readShape(n[k]); }); return a; }
    }
    const o = {}; for (const k of ks) o[k] = readShape(n[k]); return o;
  }
  const clone = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const etagOf = n => n == null ? 'null_etag' : 'e' + [...JSON.stringify(n)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

  function notify() {
    for (const w of watchers) {
      const cur = JSON.stringify(get(w.path));
      if (cur !== w.last) { w.last = cur; const v = clone(get(w.path)); queueMicrotask(() => w.cb(v)); }
    }
  }
  function res(status, body, headers = {}) {
    return { ok: status >= 200 && status < 300, status, headers: { get: k => headers[k] ?? null }, json: async () => clone(body) };
  }

  async function fetch(url, init = {}) {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname.replace(/\.json$/, ''));
    const method = (init.method || 'GET').toUpperCase();
    const hdr = init.headers || {};
    log.push({ t: clock.t, method, path, keepalive: !!init.keepalive, body: init.body ? JSON.parse(init.body) : null });
    await Promise.resolve();
    if (method === 'GET') {
      const n = get(path);
      return res(200, readShape(clone(n)), hdr['X-Firebase-ETag'] ? { ETag: etagOf(n) } : {});
    }
    if (init.keepalive && dropKeepalive) return res(0, null);         // 닫히는 페이지에서 도착 못 함
    if (method !== 'GET' && failNext > 0) { failNext--; return res(500, { error: 'fail' }); }
    if (method === 'PUT') {
      if (hdr['if-match'] && hdr['if-match'] !== etagOf(get(path))) return res(412, { error: 'ETag mismatch' });
      set(path, JSON.parse(init.body)); notify();
      return res(200, clone(get(path)));
    }
    if (method === 'PATCH') {
      const body = JSON.parse(init.body); const out = {};
      for (const k in body) { set(path + '/' + k, body[k]); }
      for (const k in body) out[k] = clone(get(path + '/' + k));
      notify();
      // 응답: 쓴 자리의 값(서버 시각 풀린 것). meta.savedAt 을 읽을 수 있게 meta 는 객체로
      return res(200, out);
    }
    return res(405, null);
  }

  return {
    fetch, log, get: p => clone(get(p)), set: (p, v) => { set(p, v); notify(); },
    watch(url, cb) { const path = decodeURIComponent(new URL(url).pathname.replace(/\.json$/, '')); const w = { path, cb, last: JSON.stringify(get(path)) }; watchers.push(w); queueMicrotask(() => cb(clone(get(path)))); return () => { const i = watchers.indexOf(w); if (i >= 0) watchers.splice(i, 1); }; },
    failPatches(n) { failNext = n; }, dropKeepalive(on) { dropKeepalive = on; },
  };
}

export function makeStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m };
}

export function makeVillage(initial) {
  const v = {
    data: initial ? JSON.parse(JSON.stringify(initial)) : null,
    applied: [], notices: [], view: false, askAnswer: false, asked: 0,
    snapshot() { return v.data ? JSON.parse(JSON.stringify(v.data)) : null; },
    apply(r) { v.applied.push(JSON.parse(JSON.stringify(r))); v.data = { meta: r.meta, plots: r.plots }; },
    notice(t, kind) { v.notices.push(t); },
    viewOnly(on) { v.view = on; },
    async ask() { v.asked++; return v.askAnswer; },
    edit(key, str) { if (!v.data) v.data = { meta: { v: 2, w: 256, h: 256, palette: ['road'] }, plots: {} }; if (str == null) delete v.data.plots[key]; else v.data.plots[key] = str; },
  };
  return v;
}
