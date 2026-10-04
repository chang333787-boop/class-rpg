// RPG 저장소 — 학급 RPG 와 같은 Firebase Realtime Database(compat 9.23)의 classRPG_thinkboard 아래(사용자 승인 10-03).
//  모양은 store.js(로컬)와 같다: list · create · get · findByCode · subscribe · watchAll · patch · remove · templates · saveTemplates
//  판 변경 = 점 경로 패치 → ref.update({ 'cards/c1': … }) — 점을 슬래시로만 바꾼다(model.js 와 1:1).
//  [안전] 이 앱이 쓰는 곳은 classRPG_thinkboard 하나. RPG 본 데이터(classRPG_v3)는 읽지도 쓰지도 않는다.
//         (선생님 화면을 열 때 관리자 비밀번호 확인용으로 classRPG_adminPw 를 한 번 읽는 것만 예외 — app.js → common/rpg-firebase.js)
import { toast } from './util.js';
import { withDefaults } from './settings.js';
import { rpgDb } from '../../common/rpg-firebase.js';   // 학급 RPG 설정 · 앱 만들기(하위 앱 공통) [SUBAPP-COMMON-1]

export const ROOT = 'classRPG_thinkboard';
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
// [THINKBOARD-HOME-1] 아이 홈 카드 · 아이 판 목록용 작은 목록 — listed/<판 id> = { t 제목 · c 만든 때 · o 쓰기 열림 · p 질문 · i 그림 }
//  아이 화면은 판 전체(카드·기록)를 받지 않고 이것만 본다. '아이들에게 보여요'를 끈 판은 빠진다.
//  쓰는 곳은 선생님 쪽뿐: 판 만들기 · 설정 바꾸기 · 지우기 · 선생님 화면을 열 때 맞추기(reconcileIndex).
export function indexEntry(b) {
  if (!b) return null;
  const st = withDefaults(b.settings);
  if (st.listed === false) return null;
  return { t: String(b.title || '').slice(0, 60), c: Number(b.created) || 0, o: st.open !== false, p: String(st.prompt || '').slice(0, 80), i: String(b.template?.icon || '').slice(0, 4) };
}
const canon = o => JSON.stringify(Object.keys(o || {}).sort().map(k => [k, o[k] && o[k].t, o[k] && o[k].c, !!(o[k] && o[k].o), (o[k] && o[k].p) || '', (o[k] && o[k].i) || '']));
const safeId = id => /^[\w-]{1,40}$/.test(id);

// 점 경로 → 슬래시 경로 · undefined 는 지우기(null)로
export const toSlash = patch => Object.fromEntries(Object.entries(patch).map(([k, v]) => [k.split('.').join('/'), v === undefined ? null : v]));
const plain = v => JSON.parse(JSON.stringify(v));   // undefined 빼기(RTDB 는 undefined 를 못 받는다)

export function createRtdbStore(fb = globalThis.firebase) {
  if (!fb) throw new Error('Firebase SDK 가 없어요');
  const db = rpgDb(fb), root = db.ref(ROOT), boards = root.child('boards'), listed = root.child('listed');
  const soft = e => console.warn('[thinkboard] 목록', e);
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
    async create(board) { await boards.child(board.id).set(plain(board)).catch(fail); listed.child(board.id).set(indexEntry(board)).catch(soft); return board; },
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
    async patch(id, patch) {
      if (!Object.keys(patch).length) return;
      await boards.child(id).update(plain(toSlash(patch))).catch(fail);
      if (Object.keys(patch).some(k => k === 'title' || k === 'settings' || k.startsWith('settings.'))) await this.syncIndex(id);
    },
    async remove(id) { await boards.child(id).remove().catch(fail); await listed.child(id).remove().catch(soft); },
    async syncIndex(id) { try { await listed.child(id).set(indexEntry(await this.get(id))); } catch (e) { soft(e); } },
    // 아이 판 목록 — 제목 목록만 읽는다(DB 는 누구나 쓸 수 있으니 판 id 는 글자·숫자만)
    async listOpen() {
      const v = (await listed.once('value')).val() || {};
      return Object.entries(v).filter(([id, e]) => safeId(id) && e && e.t)
        .map(([id, e]) => ({ id, title: String(e.t), created: Number(e.c) || 0, open: e.o !== false, prompt: String(e.p || ''), icon: String(e.i || '') }));
    },
    watchOpen(cb) {   // 처음 한 번은 부르는 쪽이 그리므로 건너뛴다(watchAll 과 같게)
      let first = true;
      const f = () => { if (first) { first = false; return; } cb(); };
      listed.on('value', f, e => console.warn('[thinkboard]', e));
      return () => listed.off('value', f);
    },
    // 선생님 화면을 열 때 판 목록과 맞춘다 — 다를 때만 쓴다(같으면 쓰기 0)
    async reconcileIndex(list) {
      try {
        const want = {};
        for (const b of list || await this.list()) { const e = indexEntry(b); if (e && safeId(b.id)) want[b.id] = e; }
        const cur = (await listed.once('value')).val() || {};
        if (canon(cur) !== canon(want)) await listed.set(Object.keys(want).length ? want : null);
      } catch (e) { soft(e); }
    },
    async templates() { return arr((await root.child('templates').once('value')).val()); },
    async saveTemplates(list) { await root.child('templates').set(plain(list)).catch(fail); },
  };
}
