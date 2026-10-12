// 차시 그물 — 진단·연습 엔진이 쓰는 노드는 '차시'다.
//   문항을 만드는 법은 '가족(fam)'에 있다: js/concepts/*.js 의 72개 개념 + 학년 파일(g1~g6)이 더한 가족
//   차시 정의 = { id, name, kid, fam?, gen, is?, make?, steps?, prev, pre, hint, tip?, sec?, timed?, s? }
//     id    'u:n' (catalog.js의 단원·차시)          name  칩에 쓰는 짧은 이름          kid  아이에게 보이는 말
//     gen   그 차시 유형만 내는 params                is(p)  params가 이 차시 유형인가 (같은 가족 안에서 서로 겹치지 않게)
//     prev  짧은 줄: 같은 단원에서 이 차시를 배우기 전에 꼭 있어야 하는 차시 (없으면 null)
//     pre   긴 줄: 옛 단원의 차시 id 배열 또는 (p) => 배열
//     steps (p) => [{ c: 차시 id 또는 가족 id, p, why }] — 같은 숫자로 쪼갠 단계 (가족 id면 is(p)로 차시를 찾는다)
import { CONCEPTS as BASE, SEC, HINT } from '../concepts/index.js';
import { CATALOG, UNITS, SKIPPED, unitById } from './catalog.js';
import { blankCount } from '../tokens.js';
import { rng } from '../math.js';
import { FAMS as OPS, ALIAS, ALIAS_DEFAULT, KIND } from './ops.js';
import G1 from './g1.js';
import G2 from './g2.js';
import G3 from './g3.js';
import G4 from './g4.js';
import G5 from './g5.js';
import G6 from './g6.js';

const GRADEFILES = { g1: G1, g2: G2, g3: G3, g4: G4, g5: G5, g6: G6 };

// 가족
export const FAM = Object.fromEntries(BASE.map((c) => [c.id, c]));
for (const g of [{ FAMS: OPS }, ...Object.values(GRADEFILES)]) for (const f of g.FAMS || []) {
  if (FAM[f.id]) throw new Error(`가족 id 겹침: ${f.id}`);
  FAM[f.id] = { sec: 20, ...f, hint: f.hint || f.tip };
}

export const STRANDS = [
  ['N', '수'], ['A', '덧셈·뺄셈'], ['M', '곱셈'], ['D', '나눗셈'], ['X', '혼합 계산'], ['F', '분수'], ['DEC', '소수'], ['G', '약수·배수'], ['R', '규칙·대응·비'],
];
export const GRADES = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2', '5-1', '5-2', '6-1', '6-2'];
export const gradeIdx = (g) => GRADES.indexOf(g);
export { UNITS, CATALOG, SKIPPED, unitById };

const CAT = Object.fromEntries(CATALOG.map((l) => [l.id, l]));
const shortTitle = (t) => t.replace(/를 알아볼까요|을 알아볼까요|를 구해 볼까요|을 구해 볼까요|해 볼까요|어 볼까요|아볼까요|볼까요/g, '').replace(/\s+/g, ' ').trim();

function build(def, file) {
  const cat = CAT[def.id];
  if (!cat) throw new Error(`${file}: 차시 목록에 없는 id ${def.id}`);
  const fam = def.fam ? FAM[def.fam] : null;
  if (def.fam && !fam) throw new Error(`${def.id}: 없는 가족 ${def.fam}`);
  const timed = def.timed ?? (fam ? fam.timed : false);
  return {
    id: def.id, u: cat.u, n: cat.n, span: cat.span, title: cat.title, g: cat.g, src: cat.src, file,
    name: def.name || shortTitle(cat.title), kid: def.kid || def.name || shortTitle(cat.title),
    s: def.s || (fam && fam.s) || 'N', fam: def.fam || null,
    gen: def.gen, is: def.is || null, def: !!def.def,
    makeRaw: def.make || (fam ? (p) => fam.make(p) : null),
    stepsRaw: def.steps || (fam && fam.steps ? (p) => fam.steps(p) : null),
    prev: def.prev || null, preRaw: def.pre || [],
    tip: def.tip || (fam && fam.tip) || '', hint: def.hint || (fam && (HINT[fam.id] || fam.hint)) || def.tip || '',
    bridge: def.bridge || (fam && fam.bridge) || '',
    sec: def.sec || (fam && (SEC[fam.id] || fam.sec)) || 20, timed: !!timed, fact: !!timed,
  };
}

export const NODES = [];
for (const [file, g] of Object.entries(GRADEFILES)) for (const d of g.LESSONS || []) NODES.push(build(d, file));
const uOrder = (u) => { const [a, b, c] = u.split('-'); return (Number(a) * 10 + Number(b)) * 10 + Number(c); };
NODES.sort((a, b) => uOrder(a.u) - uOrder(b.u) || a.n - b.n);
export const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
export const CONCEPTS = NODES; // 예전 이름 (화면 코드 호환)

// 가족 → 차시
const byFam = {};
NODES.forEach((n) => { if (n.fam) (byFam[n.fam] = byFam[n.fam] || []).push(n); });
const safeIs = (n, p) => { try { return !!n.is(p); } catch (e) { return false; } };
// id(차시·가족·예전 개념)와 params → { c: 차시 id, p: 그 차시 params }
export function resolve(id, p) {
  if (!id) return { c: null, p };
  if (byId[id]) return { c: id, p };
  if (ALIAS[id]) { if (p == null) return { c: ALIAS_DEFAULT[id] || null, p: null }; const t = ALIAS[id](p); return resolve(t.c, t.p); }
  // 사칙 가족은 분류기가 차시를 정한다 (정의 안 된 차시면 null → '아직 없음')
  if (KIND[id] && p != null) { const k = KIND[id](p); const q = p.fam ? p : { ...p, fam: id }; return { c: byId[k] ? k : null, p: q, want: k }; }
  const cs = byFam[id];
  if (!cs || !cs.length) return { c: null, p };
  if (p != null) { const hit = cs.find((n) => n.is && safeIs(n, p)); if (hit) return { c: hit.id, p }; }
  return { c: (cs.find((n) => n.def) || cs[cs.length - 1]).id, p };
}
export const toLesson = (id, p) => resolve(id, p).c;
export const lessonsOfFam = (fam) => (byFam[fam] || []).map((n) => n.id);

// 문항
export function makeItem(cid, p) {
  const c = byId[cid];
  const it = c.makeRaw(p);
  const check = it.check;
  it.check = (vals, raws) => {
    const res = check.call(it, vals, raws);
    if (res && res.bug && res.bug.to) {
      const to = [].concat(res.bug.to).map((x) => toLesson(x, null)).filter((x) => x && x !== cid);
      return { ...res, bug: { ...res.bug, to: to.length > 1 ? to : to[0] || null } };
    }
    return res;
  };
  it.c = cid; it.p = p;
  it.nBlanks = it.choices ? 0 : blankCount(it.prompt);
  it.timed = !!(c.timed && it.timed !== false);
  return it;
}
export function genItem(cid, seed) { const r = rng(seed); return makeItem(cid, byId[cid].gen(r)); }
export function stepsOf(cid, p) {
  const c = byId[cid];
  if (!c || !c.stepsRaw) return [];
  return c.stepsRaw(p).filter(Boolean).map((s) => ({ ...s, ...resolve(s.c, s.p) })).filter((s) => s.c && byId[s.c]);
}
export function preOf(cid, p) {
  const c = byId[cid];
  if (!c) return [];
  const raw = typeof c.preRaw === 'function' ? c.preRaw(p) : c.preRaw;
  return [...new Set([c.prev, ...(raw || [])].map((x) => toLesson(x, null)).filter((x) => x && x !== cid && byId[x]))];
}
const preCache = {}, coreCache = {};
export function allPre(cid) {
  if (preCache[cid]) return preCache[cid];
  const c = byId[cid], set = new Set(preOf(cid, null));
  if (typeof c.preRaw === 'function') { const r = rng(7); for (let i = 0; i < 40; i++) preOf(cid, c.gen(r)).forEach((x) => set.add(x)); }
  return (preCache[cid] = [...set]);
}
export function corePre(cid) {
  if (coreCache[cid]) return coreCache[cid];
  const c = byId[cid];
  if (typeof c.preRaw !== 'function') return (coreCache[cid] = preOf(cid, null));
  const r = rng(11); let set = null;
  for (let i = 0; i < 40; i++) { const s = new Set(preOf(cid, c.gen(r))); set = set ? new Set([...set].filter((x) => s.has(x))) : s; }
  return (coreCache[cid] = [...set]);
}
export const nextOf = (cid) => NODES.filter((c) => allPre(c.id).includes(cid)).map((c) => c.id);
export const sortByGrade = (ids) => ids.slice().sort((a, b) => uOrder(byId[a].u) - uOrder(byId[b].u) || byId[a].n - byId[b].n);
export const lessonsOfUnit = (u) => NODES.filter((n) => n.u === u).map((n) => n.id);
export const unitLabel = (u) => { const x = unitById[u]; return x ? `${x.g} ${x.nm}` : u; };
export const lessonLabel = (id, { title = true } = {}) => { const c = byId[id] || CAT[id]; if (!c) return id; return `${unitLabel(c.u)} ${c.span || c.n}차시${title ? ` · ${c.title}` : ''}`; };
