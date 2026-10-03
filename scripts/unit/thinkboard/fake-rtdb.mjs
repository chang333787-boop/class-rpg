// 시험용 가짜 Firebase RTDB(메모리) — 운영 DB 에 쓰지 않는다. 빈 객체는 지우고 배열은 번호 키 객체로(진짜처럼).
export function fakeFirebase() {
  const tree = {}, writes = [], listeners = [];
  const seg = p => p.split('/').filter(Boolean);
  const getAt = p => seg(p).reduce((o, k) => (o == null ? undefined : o[k]), tree);
  const toRt = v => { if (v === null || v === undefined) return null; if (Array.isArray(v)) v = Object.fromEntries(v.map((x, i) => [i, x])); if (typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) { const y = toRt(x); if (y !== null) o[k] = y; } return Object.keys(o).length ? o : null; } return v; };
  const prune = (o = tree) => { for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object') { prune(o[k]); if (!Object.keys(o[k]).length) delete o[k]; } };
  const setAt = (p, v) => { const ks = seg(p); let o = tree; for (const k of ks.slice(0, -1)) { o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}; o = o[k]; } const r = toRt(v); if (r === null) delete o[ks.at(-1)]; else o[ks.at(-1)] = r; prune(); };
  const clone = v => v === undefined ? null : JSON.parse(JSON.stringify(v));
  const fire = () => listeners.forEach(l => l.f({ val: () => clone(getAt(l.p)), exists: () => getAt(l.p) !== undefined }));
  const ref = p => ({
    child: c => ref(p + '/' + c),
    set: async v => { writes.push(p); setAt(p, v); fire(); },
    update: async u => { const keys = Object.keys(u); for (const a of keys) for (const b of keys) if (a !== b && b.startsWith(a + '/')) throw new Error('겹치는 경로 ' + a + ' · ' + b); for (const [k, v] of Object.entries(u)) { writes.push(p + '/' + k); setAt(p + '/' + k, v); } fire(); },
    remove: async () => { writes.push(p); setAt(p, null); fire(); },
    once: async () => ({ val: () => clone(getAt(p)), exists: () => getAt(p) !== undefined }),
    on: (ev, f) => { listeners.push({ p, f }); f({ val: () => clone(getAt(p)), exists: () => getAt(p) !== undefined }); },
    off: (ev, f) => { const i = listeners.findIndex(l => l.f === f); if (i >= 0) listeners.splice(i, 1); },
  });
  return { apps: [], initializeApp() { this.apps.push(1); }, database: () => ({ ref }), _tree: tree, _writes: writes };
}
