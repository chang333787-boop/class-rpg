// 저장소 — 학급 RPG 와 같은 Firebase RTDB(compat 9.23)의 classRPG_music 아래만 쓴다.
//  RPG 본 데이터(classRPG_v3)는 읽지도 쓰지도 않는다(선생님 화면에서 관리자 비밀번호 확인용 classRPG_adminPw 한 번 읽기만 예외).
//  songs/<sid>/<곡id>        = 곡 전체
//  songlog/<sid>/<곡id>/<때> = 저장할 때마다 한 줄 { ev new|save, nn 음 수, bars, pub } — 지우지 않고 쌓는다(만든 과정)
//  concert/<sid>_<곡id>      = 우리 반 음악회 목록 한 줄 { sid, n 이름, t 제목, u 고친 때, beats, sub, bars, scale, hide }
//  practice/<sid>/<곡키>     = 리코더 기록장 { n 횟수, last, stars, t 제목 } + log/<자동키> = { t 때, sp 빠르기, st 별 }  (지우지 않고 쌓는다)
//  rhythm/<곡키>/<sid>       = 리듬 게임 최고 기록 { best, acc, combo, grade, t 때, n 이름 }
//  sid 가 없으면(손님 · 파일로 열기) 이 기기 localStorage 에만.
import { uid, keyOf, lsGet, lsSet } from './util.js';
import { songBad } from './safety.js';
const clean = s => { const b = songBad(s); return !b.title.length && !b.lyrics.length; };

export const ROOT = 'classRPG_music';
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
const plain = v => JSON.parse(JSON.stringify(v));   // undefined 빼기
const vals = o => o && typeof o === 'object' ? Object.values(o) : [];
const songOut = s => plain({ ...s, notes: s.notes.map(n => n.w ? n : { s: n.s, d: n.d, p: n.p }) });

export function createStore({ sid, name, fb = globalThis.firebase, offline = false } = {}) {
  sid = sid ? keyOf(sid) : '';
  if (sid && fb && !offline) return rtdbStore(fb, sid, name);
  return localStore(sid || 'guest', name || '나');
}

function rtdbStore(fb, sid, name) {
  if (!fb.apps.length) fb.initializeApp(CONFIG);
  const db = fb.database(), root = db.ref(ROOT);
  const concertKey = id => keyOf(sid + '_' + id);
  const st = {
    me: { sid, name: name || '', guest: false }, online: true, db,
    async listMySongs() { return vals((await root.child('songs/' + sid).once('value')).val()).sort((a, z) => (z.updated || 0) - (a.updated || 0)); },
    async getSong(owner, id) { return (await root.child(`songs/${keyOf(owner)}/${keyOf(id)}`).once('value')).val(); },
    async saveSong(song) {
      const t = Date.now();
      if (!song.id) { song.id = uid('s'); song.created = t; }
      song.by = sid; song.byName = name || ''; song.updated = t; song.rev = (song.rev || 0) + 1;
      const up = {};
      up[`songs/${sid}/${song.id}`] = songOut(song);
      up[`songlog/${sid}/${song.id}/${t}`] = { t, ev: song.rev === 1 ? 'new' : 'save', nn: song.notes.length, bars: song.bars, pub: !!song.pub };   // 지우지 않고 쌓는 기록(연구용)
      up[`concert/${concertKey(song.id)}`] = song.pub && clean(song)
        ? { sid, n: name || '', id: song.id, t: song.title || '제목 없음', u: t, beats: song.beats, sub: song.sub, bars: song.bars, scale: song.scale, nn: song.notes.length }
        : null;
      await root.update(up);
      return song;
    },
    async deleteSong(id) { await root.update({ [`songs/${sid}/${keyOf(id)}`]: null, [`concert/${concertKey(id)}`]: null, [`songlog/${sid}/${keyOf(id)}/${Date.now()}`]: { t: Date.now(), ev: 'delete' } }); },
    async listConcert() { return vals((await root.child('concert').once('value')).val()).filter(c => c && !c.hide && c.t).sort((a, z) => (z.u || 0) - (a.u || 0)); },
    watchConcert(cb) { const r = root.child('concert'); const fn = s => cb(vals(s.val()).filter(c => c && !c.hide && c.t).sort((a, z) => (z.u || 0) - (a.u || 0))); r.on('value', fn, e => console.warn('[music]', e)); return () => r.off('value', fn); },
    async addPractice(key, title, { sp = 1, stars = 0 } = {}) {
      const ref = root.child(`practice/${sid}/${keyOf(key)}`), t = Date.now();
      await ref.child('log').push({ t, sp, st: stars });
      const cur = (await ref.once('value')).val() || {};
      const n = (cur.n || 0) + 1;
      await ref.update({ n, last: t, stars, t: String(title || '').slice(0, 30) });
      return n;
    },
    async listPractice() { const v = (await root.child('practice/' + sid).once('value')).val() || {}; return Object.entries(v).map(([k, x]) => ({ key: k, ...x, log: vals(x.log) })); },
    async saveRhythm(key, r) {
      const ref = root.child(`rhythm/${keyOf(key)}/${sid}`);
      const prev = (await ref.once('value')).val();
      if (prev && prev.best >= r.score) return { newBest: false, prev: prev.best };
      await ref.set({ best: r.score, acc: r.acc, combo: r.maxCombo, grade: r.grade, t: Date.now(), n: name || '' });
      return { newBest: true, prev: prev ? prev.best : 0 };
    },
    async topRhythm(key, n = 5) { return Object.entries((await root.child('rhythm/' + keyOf(key)).once('value')).val() || {}).map(([s, x]) => ({ sid: s, ...x })).sort((a, z) => z.best - a.best).slice(0, n); },
    // ── 선생님 ──
    async teacherOK(pw) { const real = (await db.ref('classRPG_adminPw').once('value')).val(); return real != null && String(pw) === String(real); },
    async allSongs() { return (await root.child('songs').once('value')).val() || {}; },
    async allPractice() { return (await root.child('practice').once('value')).val() || {}; },
    async allConcert() { return vals((await root.child('concert').once('value')).val()); },
    async setHidden(owner, id, hide) { await root.child(`concert/${keyOf(owner + '_' + id)}/hide`).set(hide ? true : null); },
  };
  return st;
}

// 이 기기에만(손님) — 같은 모양
function localStore(sid, name) {
  const K = 'music.local';
  const load = () => lsGet(K, { songs: {}, practice: {}, rhythm: {} });
  const save = d => lsSet(K, d);
  const st = {
    me: { sid, name, guest: true }, online: false,
    async listMySongs() { return vals(load().songs).sort((a, z) => (z.updated || 0) - (a.updated || 0)); },
    async getSong(owner, id) { return load().songs[id] || null; },
    async saveSong(song) {
      const d = load(), t = Date.now();
      if (!song.id) { song.id = uid('s'); song.created = t; }
      song.by = sid; song.byName = name; song.updated = t; song.rev = (song.rev || 0) + 1;
      d.songs[song.id] = songOut(song); save(d); return song;
    },
    async deleteSong(id) { const d = load(); delete d.songs[id]; save(d); },
    async listConcert() { return vals(load().songs).filter(s => s.pub).map(s => ({ sid, n: name, id: s.id, t: s.title || '제목 없음', u: s.updated, beats: s.beats, sub: s.sub, bars: s.bars, scale: s.scale, nn: (s.notes || []).length })); },
    watchConcert(cb) { st.listConcert().then(cb); return () => {}; },
    async addPractice(key, title, { sp = 1, stars = 0 } = {}) {
      const d = load(), k = keyOf(key), cur = d.practice[k] || { n: 0, log: [] };
      cur.n++; cur.last = Date.now(); cur.stars = stars; cur.t = title; cur.log = [...(cur.log || []), { t: cur.last, sp, st: stars }].slice(-200);
      d.practice[k] = cur; save(d); return cur.n;
    },
    async listPractice() { return Object.entries(load().practice).map(([k, x]) => ({ key: k, ...x })); },
    async saveRhythm(key, r) {
      const d = load(), k = keyOf(key), prev = d.rhythm[k];
      if (prev && prev.best >= r.score) return { newBest: false, prev: prev.best };
      d.rhythm[k] = { best: r.score, acc: r.acc, combo: r.maxCombo, grade: r.grade, t: Date.now(), n: name }; save(d);
      return { newBest: true, prev: prev ? prev.best : 0 };
    },
    async topRhythm(key) { const x = load().rhythm[keyOf(key)]; return x ? [{ sid, ...x }] : []; },
    async teacherOK() { return true; },
    async allSongs() { return { [sid]: load().songs }; },
    async allPractice() { return { [sid]: load().practice }; },
    async allConcert() { return st.listConcert(); },
    async setHidden() {},
  };
  return st;
}
