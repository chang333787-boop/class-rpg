// RPG 저장소 — 학급 RPG 와 같은 Firebase Realtime Database(compat 9.23)의 classRPG_thinkboard 아래(사용자 승인 10-03).
//  모양은 store.js(로컬)와 같다: list · create · get · findByCode · subscribe · watchAll · patch · remove · templates · saveTemplates
//  판 변경 = 점 경로 패치 → ref.update({ 'cards/c1': … }) — 점을 슬래시로만 바꾼다(model.js 와 1:1).
//  [안전] 이 앱이 쓰는 곳은 classRPG_thinkboard 하나. RPG 본 데이터(classRPG_v3)는 읽지도 쓰지도 않는다.
//         (선생님 화면을 열 때 관리자 비밀번호 확인용으로 classRPG_adminPw 를 한 번 읽는 것만 예외 — app.js)
import { toast } from './util.js';

export const ROOT = 'classRPG_thinkboard';
// gamedata.js FIREBASE_CONFIG 와 같은 값(학급 RPG 프로젝트)
const CONFIG = {
  apiKey: 'AIzaSyCV_u6yKdGInPuCJanK4bzBfnLJuvIbyX4',
  authDomain: 'class-rpg-6f409.firebaseapp.com',
  databaseURL: 'https://class-rpg-6f409-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'class-rpg-6f409',
  storageBucket: 'class-rpg-6f409.firebasestorage.app',
  messagingSenderId: '408824743154',
  appId: '1:408824743154:web:382fdd431f7e2dbce13c6b',
};

// RTDB 는 빈 객체를 지우고, 배열을 번호 키 객체로 돌려줄 때가 있다 → 판 모양으로 되돌린다
const arr = v => Array.isArray(v) ? v.filter(x => x != null) : v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map(k => v[k]) : [];
export function normBoard(b) {
  if (!b) return null;
  const o = { ...b };
  for (const k of ['cards', 'links', 'mail', 'results', 'log', 'meta', 'settings']) o[k] = o[k] || {};
  o.template = { ...(o.template || {}) };
  o.template.zones = arr(o.template.zones); o.template.hints = arr(o.template.hints);
  o.settings = { ...o.settings };
  if (o.settings.cols) o.settings.cols = arr(o.settings.cols);
  if (o.settings.images) o.settings.images = arr(o.settings.images);
  return o;
}
// 점 경로 → 슬래시 경로 · undefined 는 지우기(null)로
export const toSlash = patch => Object.fromEntries(Object.entries(patch).map(([k, v]) => [k.split('.').join('/'), v === undefined ? null : v]));
const plain = v => JSON.parse(JSON.stringify(v));   // undefined 빼기(RTDB 는 undefined 를 못 받는다)

export function createRtdbStore(fb = globalThis.firebase) {
  if (!fb) throw new Error('Firebase SDK 가 없어요');
  if (!fb.apps.length) fb.initializeApp(CONFIG);
  const db = fb.database(), root = db.ref(ROOT), boards = root.child('boards');
  let warned = false;
  const fail = e => {
    console.warn('[thinkboard]', e);
    if (!warned) {
      warned = true;
      toast(/permission/i.test(String(e && (e.code || e.message || e)))
        ? '저장이 막혔어요 — 선생님: Firebase 규칙에서 classRPG_thinkboard 쓰기를 허용해 주세요'
        : '저장하지 못했어요. 인터넷 연결을 확인해 주세요', 5000);
      setTimeout(() => { warned = false; }, 15000);
    }
    throw e;
  };
  return {
    kind: 'rtdb',
    db,
    async list() { const s = await boards.once('value'); return Object.values(s.val() || {}).map(normBoard).filter(Boolean); },
    async create(board) { await boards.child(board.id).set(plain(board)).catch(fail); return board; },
    async get(id) { return normBoard((await boards.child(id).once('value')).val()); },
    async findByCode(code) { code = String(code).trim().toUpperCase(); return (await this.list()).find(b => b.code === code) || null; },
    subscribe(id, cb) {
      const r = boards.child(id), f = s => cb(normBoard(s.val()));
      r.on('value', f, e => console.warn('[thinkboard]', e));
      return () => r.off('value', f);
    },
    watchAll(cb) {   // 선생님 판 목록 — 처음 한 번은 list() 가 그리므로 건너뛴다
      let first = true;
      const f = () => { if (first) { first = false; return; } cb(); };
      boards.on('value', f, e => console.warn('[thinkboard]', e));
      return () => boards.off('value', f);
    },
    async patch(id, patch) { if (!Object.keys(patch).length) return; await boards.child(id).update(plain(toSlash(patch))).catch(fail); },
    async remove(id) { await boards.child(id).remove().catch(fail); },
    async templates() { return arr((await root.child('templates').once('value')).val()); },
    async saveTemplates(list) { await root.child('templates').set(plain(list)).catch(fail); },
  };
}
