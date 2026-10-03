// 저장소 어댑터. 지금은 로컬(이 브라우저의 localStorage + 탭끼리 BroadcastChannel 실시간).
// 나중에 Firebase 어댑터를 같은 모양으로 더한다: list · create · get · findByCode · subscribe · patch · remove · templates.
// 판 변경은 항상 patch(점 경로) 하나로 — model.js 참고.
import { applyPatch } from './model.js';

const K = id => 'tb.board.' + id;
const IDX = 'tb.index';
const TPL = 'tb.templates';

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export function createLocalStore() {
  const bc = new BroadcastChannel('tb');
  const subs = new Map(); // id → Set(cb)
  const all = new Set();  // 아무 판이나 바뀌면(선생님 화면)
  const fire = id => {
    const b = read(K(id), null);
    for (const cb of subs.get(id) || []) cb(b);
    for (const cb of all) cb(id);
  };
  bc.onmessage = e => fire(e.data.id);
  const idx = () => read(IDX, []);

  return {
    kind: 'local',
    async list() { return idx().map(id => read(K(id), null)).filter(Boolean); },
    async create(board) {
      write(K(board.id), board);
      write(IDX, [...idx(), board.id]);
      fire(board.id); bc.postMessage({ id: board.id }); return board;
    },
    async get(id) { return read(K(id), null); },
    async findByCode(code) {
      code = code.trim().toUpperCase();
      return (await this.list()).find(b => b.code === code) || null;
    },
    subscribe(id, cb) {
      if (!subs.has(id)) subs.set(id, new Set());
      subs.get(id).add(cb);
      cb(read(K(id), null));
      return () => subs.get(id).delete(cb);
    },
    watchAll(cb) { all.add(cb); return () => all.delete(cb); },
    async patch(id, patch) {
      if (!Object.keys(patch).length) return;
      const b = read(K(id), null);
      if (!b) return;
      write(K(id), applyPatch(b, patch));
      fire(id);
      bc.postMessage({ id });
    },
    async remove(id) {
      localStorage.removeItem(K(id));
      write(IDX, idx().filter(x => x !== id));
      fire(id); bc.postMessage({ id });
    },
    // 교사가 더한 판 틀
    async templates() { return read(TPL, []); },
    async saveTemplates(list) { write(TPL, list); },
  };
}
