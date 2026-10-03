// 판 데이터와 동작(ops).
// 판은 맵(키 = id) 구조라서, 모든 변경을 '점 경로 패치'로 표현한다: { 'cards.c1': {...}, 'log.l9': {...} }
// → 로컬 저장소와 나중의 Firestore(updateDoc 점 경로) 둘 다 같은 패치를 쓴다. 값 null = 지우기.
//
// 연구 원칙(바꾸지 말 것):
//  ① AI가 만든 것은 판에 바로 붙지 않는다 — 우편함(mail)에 도착하고, 아이가 판단해야 카드가 된다.
//  ② 카드 출처(src)는 아이가 고를 수 없다 — 'me'(직접) / 'ai-edit'(AI 카드를 고침) / 'ai-keep'(AI 카드 그대로).
//     'ai-keep' 카드의 글을 고치면 'ai-edit'이 된다. 'me'는 끝까지 'me'.
//  ③ 판단에는 이유가 붙는다(이대로 쓰면 충분해 · 내 생각과 달라 · 필요 없어 · 이미 있어 …).
//  ④ 모든 동작은 log에 시각과 함께 남는다. 결과물이 붙은 뒤의 추가·수정은 ar(결과 보고 고침) 표시.
import { uid, now, code4, keyOf } from './util.js';
import { withDefaults, zoneNames } from './settings.js';

export const SRC = { me: '내가 씀', 'ai-edit': 'AI 카드를 고침', 'ai-keep': 'AI 카드 그대로' };

export const REASONS = {
  keep: ['이대로 쓰면 충분해', '일단 넣고 나중에 고칠래'],
  drop: ['내 생각과 달라', '필요 없어', '이미 있어'],
  qdrop: ['이미 정했어', '필요 없어'],
};

export function newBoard({ title, template, unit }) {
  const t = now();
  return {
    id: uid('b'), code: code4(), title, created: t,
    template: JSON.parse(JSON.stringify(template)),
    unit: unit || template.unit || 'group',
    // [설정 틀] 표(settings.js)의 기본값 ← 판 틀의 settings(달라진 점 찾기 · 출구 카드 …)
    settings: withDefaults({ mail: template.mail || 'qs', zones: true, hints: true, ...(template.settings || {}) }),
    meta: { lastResultAt: 0 },
    cards: {}, links: {}, mail: {}, results: {}, log: {},
  };
}

export function applyPatch(board, patch) {
  for (const [path, val] of Object.entries(patch)) {
    const ks = path.split('.');
    let o = board;
    for (let i = 0; i < ks.length - 1; i++) { o[ks[i]] ??= {}; o = o[ks[i]]; }
    const last = ks[ks.length - 1];
    if (val === null) delete o[last]; else o[last] = val;
  }
  return board;
}

// sid = 학급 RPG 학생 id(연구 자료를 RPG 학생과 잇는 열쇠 · 이름은 보여 주기용). 로컬 시험에는 없다.
const log = (by, op, data, sid) => ({ ['log.' + uid('l')]: { t: now(), by: by || '?', ...(sid ? { sid } : {}), op, ...data } });
const after = (b, t) => (b.meta?.lastResultAt && t > b.meta.lastResultAt ? { ar: true } : {});

// 모든 op: (board, args) → { patch, id? }
export const ops = {
  addCard(b, { text, kind = 'idea', x, y, zone = '', by, sid, src = 'me', via, color, pin }) {
    const id = uid('c'), t = now();
    const card = { id, text, kind, x, y, zone, src, by, ...(sid ? { sid } : {}), t, ut: t, ...(via ? { via } : {}), ...(color ? { color } : {}), ...(pin ? { pin } : {}), ...after(b, t) };
    return { id, patch: { ['cards.' + id]: card, ...log(by, 'add', { card: id, kind, src, zone, text }, sid) } };
  },

  // 고치기 · 옮기기 · 정했어요는 카드 통째가 아니라 바뀐 칸만 쓴다 — 여럿이 동시에 쓸 때 남의 공감 · 선생님 가림 · 허락을 덮지 않게
  editCard(b, { id, text, by, sid }) {
    const c = b.cards[id];
    if (!c || c.text === text) return { patch: {} };
    const t = now(), P = 'cards.' + id + '.';
    const src = c.src === 'ai-keep' ? 'ai-edit' : c.src;
    const patch = { [P + 'text']: text, [P + 'src']: src, [P + 'ut']: t };
    if (c.orig === undefined && c.src === 'ai-keep') patch[P + 'orig'] = c.text;
    if (after(b, t).ar) patch[P + 'ar'] = true;
    return { patch: { ...patch, ...log(by, 'edit', { card: id, from: c.text, text, src }, sid) } };
  },

  moveCard(b, { id, x, y, zone = '', by, sid }) {
    const c = b.cards[id];
    if (!c) return { patch: {} };
    const P = 'cards.' + id + '.';
    const patch = { [P + 'x']: x, [P + 'y']: y, [P + 'zone']: zone };
    if (zone !== c.zone) Object.assign(patch, log(by, 'zone', { card: id, from: c.zone, zone }, sid));
    return { patch };
  },

  deleteCard(b, { id, by, sid }) {
    const c = b.cards[id];
    if (!c) return { patch: {} };
    const patch = { ['cards.' + id]: null, ...log(by, 'delete', { card: id, text: c.text, src: c.src, kind: c.kind }, sid) };
    for (const l of Object.values(b.links)) if (l.from === id || l.to === id) patch['links.' + l.id] = null;
    return { patch };
  },

  // ❔ 카드 → 정했어요
  resolveCard(b, { id, by, sid }) {
    const c = b.cards[id];
    if (!c || c.kind !== 'unknown') return { patch: {} };
    const t = now(), P = 'cards.' + id + '.';
    return { patch: { [P + 'kind']: 'idea', [P + 'ut']: t, [P + 'resolved']: t, ...log(by, 'resolve', { card: id, text: c.text }, sid) } };
  },

  addLink(b, { from, to, by, sid }) {
    if (from === to || !b.cards[from] || !b.cards[to]) return { patch: {} };
    if (Object.values(b.links).some(l => l.from === from && l.to === to)) return { patch: {} };
    const id = uid('k');
    return { id, patch: { ['links.' + id]: { id, from, to, by, ...(sid ? { sid } : {}), t: now() }, ...log(by, 'link', { from, to }, sid) } };
  },

  deleteLink(b, { id, by, sid }) {
    const l = b.links[id];
    if (!l) return { patch: {} };
    return { patch: { ['links.' + id]: null, ...log(by, 'unlink', { from: l.from, to: l.to }, sid) } };
  },

  // 우편함에 AI 카드 넣기(교사 또는 서버). items = [{ type: 'question'|'suggest', text, zone, why }]
  addMail(b, { items, by = 'teacher', batch }) {
    const t = now(), bt = batch || uid('m');
    const patch = {};
    for (const it of items) {
      const id = uid('m');
      patch['mail.' + id] = { id, type: it.type, text: it.text, zone: it.zone || '', why: it.why || '', status: 'new', t, batch: bt };
    }
    Object.assign(patch, log(by, 'mail', { batch: bt, n: items.length }));
    return { patch };
  },

  // 아이의 판단. action:
  //  제안: keep(그대로) · edit(고쳐서, text) · drop(버림)
  //  질문: answer(답 카드, text) · unknown(❔로 남기기) · drop(필요 없어)
  judgeMail(b, { id, action, reason = '', text, x, y, zone = '', by, sid }) {
    const m = b.mail[id];
    if (!m || m.status !== 'new') return { patch: {} };
    const t = now();
    let patch = {}, cardId = null;
    const mk = (args) => { const r = ops.addCard(b, { x, y, zone, by, sid, ...args }); cardId = r.id; Object.assign(patch, r.patch); };
    if (action === 'keep') mk({ text: m.text, src: 'ai-keep', via: id });
    else if (action === 'edit') { mk({ text, src: 'ai-edit', via: id }); patch['cards.' + cardId].orig = m.text; }
    else if (action === 'answer') mk({ text, src: 'me', via: id });
    else if (action === 'unknown') mk({ text: m.text, kind: 'unknown', src: 'ai-keep', via: id });
    patch['mail.' + id] = { ...m, status: action, reason, by, ...(sid ? { sid } : {}), jt: t, ...(cardId ? { card: cardId } : {}) };
    Object.assign(patch, log(by, 'judge', { mail: id, type: m.type, action, reason, ...(text ? { text } : {}) }, sid));
    return { id: cardId, patch };
  },

  addResult(b, { url, title, by, sid }) {
    const id = uid('r'), t = now();
    return { id, patch: { ['results.' + id]: { id, url, title, by, ...(sid ? { sid } : {}), t }, 'meta.lastResultAt': t, ...log(by, 'result', { url, title }, sid) } };
  },

  // ❤️ 공감 — 한 사람 한 번(다시 누르면 거둠). 수는 기록만(보상과 묶지 않음)
  react(b, { id, by, sid }) {
    const c = b.cards[id];
    if (!c || !by) return { patch: {} };
    const k = keyOf(sid || by), on = !(c.react && c.react[k]);   // 공감 키 = 학생 id(없으면 이름)
    return { patch: { ['cards.' + id + '.react.' + k]: on ? 1 : null, ...log(by, on ? 'react' : 'unreact', { card: id }, sid) } };
  },

  // 선생님: 허락(ok) · 가리기(hidden) · 맨 앞 고정(top) — 넘긴 것만 바꾼다
  moderate(b, { id, ok, hidden, top, by = 'teacher' }) {
    const c = b.cards[id];
    if (!c) return { patch: {} };
    const ch = {};
    if (ok !== undefined) ch.ok = ok ? true : null;
    if (hidden !== undefined) ch.hidden = hidden ? true : null;
    if (top !== undefined) ch.top = top ? true : null;
    const patch = {};
    for (const [k, v] of Object.entries(ch)) patch['cards.' + id + '.' + k] = v;
    Object.assign(patch, log(by, 'moderate', { card: id, ...Object.fromEntries(Object.entries(ch).map(([k, v]) => [k, !!v])) }));
    return { patch };
  },

  setSettings(b, { settings, by = 'teacher' }) {
    return { patch: { settings: { ...b.settings, ...settings }, ...log(by, 'settings', settings) } };
  },

  // ── [THINKBOARD-STORY-1] 이야기 줄(사건 중심) — 사건 카드를 화살표로 잇는다. 한 카드에서 화살표가 둘 이상 나가면 갈림길.
  //   카드 칸: spine(이어 주는 말 '그러던 어느 날' · '그래서' …) · end(끝) · tags.<인물/장소 카드 id>(누가 · 어디서)
  //   묶음 동작은 패치 하나로(카드 + 화살표가 따로 가다 한쪽만 남지 않게)
  addAfter(b, { after = '', text, kind = 'idea', zone = '사건', spine = '', x = 0, y = 0, by, sid }) {
    const r = ops.addCard(b, { text, kind, x, y, zone, by, sid });
    if (spine) r.patch['cards.' + r.id].spine = spine;
    if (after && b.cards[after]) Object.assign(r.patch, linkPatch(b, after, r.id, by, sid));
    return r;
  },
  // 화살표 사이에 끼워 넣기 — a→b 를 a→새→b 로
  insertBetween(b, { link, text, spine = '', x = 0, y = 0, by, sid }) {
    const l = b.links[link];
    if (!l) return { patch: {} };
    const r = ops.addCard(b, { text, x, y, zone: '사건', by, sid });
    if (spine) r.patch['cards.' + r.id].spine = spine;
    Object.assign(r.patch, { ['links.' + link]: null }, linkPatch(b, l.from, r.id, by, sid), linkPatch(b, r.id, l.to, by, sid), log(by, 'insert', { card: r.id, from: l.from, to: l.to }, sid));
    return r;
  },
  // 갈림길 — 고르는 장면(선택 카드) + 고를 것 둘. after 가 있으면 그 사건 뒤에
  addBranch(b, { after = '', q, opts = [], x = 0, y = 0, by, sid }) {
    const qc = ops.addCard(b, { text: q, x, y, zone: '선택', by, sid }), patch = { ...qc.patch };
    if (after && b.cards[after]) Object.assign(patch, linkPatch(b, after, qc.id, by, sid));
    const ids = [];
    opts.filter(Boolean).slice(0, 4).forEach((t, i) => {
      const oc = ops.addCard(b, { text: t, x: x + 24 * (i + 1), y: y + 24 * (i + 1), zone: '사건', by, sid });
      Object.assign(patch, oc.patch, linkPatch(b, qc.id, oc.id, by, sid, i));
      ids.push(oc.id);
    });
    return { id: qc.id, ids, patch };
  },
  // 줄에서 빼기 — 앞 카드와 뒤 카드를 이어 준다(줄이 끊기지 않게)
  removeInLine(b, { id, by, sid }) {
    const c = b.cards[id];
    if (!c) return { patch: {} };
    const ins = Object.values(b.links).filter(l => l.to === id), outs = Object.values(b.links).filter(l => l.from === id);
    const { patch } = ops.deleteCard(b, { id, by, sid });
    for (const i of ins) for (const o of outs) if (!Object.values(b.links).some(l => l.from === i.from && l.to === o.to)) Object.assign(patch, linkPatch(b, i.from, o.to, by, sid));
    return { patch };
  },
  setSpine(b, { id, spine = '', by, sid }) {
    const c = b.cards[id];
    if (!c || (c.spine || '') === spine) return { patch: {} };
    return { patch: { ['cards.' + id + '.spine']: spine || null, ...log(by, 'spine', { card: id, spine }, sid) } };
  },
  setEnd(b, { id, end, by, sid }) {
    const c = b.cards[id];
    if (!c || !!c.end === !!end) return { patch: {} };
    return { patch: { ['cards.' + id + '.end']: end ? true : null, ...log(by, 'end', { card: id, end: !!end }, sid) } };
  },
  tagCard(b, { id, mat, on, by, sid }) {
    const c = b.cards[id];
    if (!c || !b.cards[mat] || id === mat) return { patch: {} };
    return { patch: { ['cards.' + id + '.tags.' + mat]: on ? 1 : null, ...log(by, on ? 'tag' : 'untag', { card: id, mat }, sid) } };
  },

  // ── [THINKBOARD-STORY-1] 나무(노션처럼) — 카드마다 parent(위 항목 · '' = 맨 위) · ord(형제 차례)
  addChild(b, { parent = '', after = '', text, kind = 'idea', x = 0, y = 0, by, sid }) {
    const sibs = Object.values(b.cards).filter(c => (c.parent || '') === parent);
    let ord = sibs.reduce((m, c) => Math.max(m, c.ord || 0), 0) + 1;
    if (after && b.cards[after]) {   // 바로 아래에 — 다음 형제와의 사이
      const a = b.cards[after].ord || 0, nx = sibs.map(c => c.ord || 0).filter(o => o > a).sort((p, q) => p - q)[0];
      ord = nx === undefined ? a + 1 : (a + nx) / 2;
    }
    const r = ops.addCard(b, { text, kind, x, y, by, sid });
    Object.assign(r.patch['cards.' + r.id], { parent, ord });
    return r;
  },
  treeMove(b, { id, parent = '', ord, by, sid }) {
    const c = b.cards[id];
    if (!c) return { patch: {} };
    for (let p = parent; p; p = (b.cards[p] || {}).parent || '') if (p === id) return { patch: {} };   // 제 밑으로는 못 간다
    const P = 'cards.' + id + '.';
    return { patch: { [P + 'parent']: parent, [P + 'ord']: ord, ...log(by, 'tree', { card: id, parent, ord }, sid) } };
  },
  // 나무에서 빼기 — 밑 항목은 한 칸 위로 올려 같은 자리에 둔다(지워지지 않게)
  removeInTree(b, { id, by, sid }) {
    const c = b.cards[id];
    if (!c) return { patch: {} };
    const { patch } = ops.deleteCard(b, { id, by, sid });
    const kids = Object.values(b.cards).filter(k => k.parent === id).sort((p, q) => (p.ord || 0) - (q.ord || 0));
    const o = c.ord || 0, nx = Object.values(b.cards).filter(k => (k.parent || '') === (c.parent || '') && k.id !== id && (k.ord || 0) > o).reduce((m, k) => Math.min(m, k.ord || 0), o + 1);
    kids.forEach((k, i) => { patch['cards.' + k.id + '.parent'] = c.parent || ''; patch['cards.' + k.id + '.ord'] = o + (nx - o) * (i + 1) / (kids.length + 1); });   // 지운 자리(다음 형제 앞)에
    return { patch };
  },
};

// 화살표 패치(묶음 동작 안에서) — 같은 화살표가 이미 있으면 빈 패치 · i = 갈림길 안 차례(고를 것 A · B …)
function linkPatch(b, from, to, by, sid, i) {
  if (from === to || Object.values(b.links).some(l => l.from === from && l.to === to)) return {};
  const id = uid('k');
  return { ['links.' + id]: { id, from, to, by, ...(sid ? { sid } : {}), t: now() + (i || 0), ...(i !== undefined ? { i } : {}) }, ...log(by, 'link', { from, to }, sid) };
}

// ── [THINKBOARD-STORY-1] 이야기 줄 읽기 — 그리기 · 읽어 보기 · 정리본 · AI 글이 같이 쓴다
//  재료 = 줄 칸(사건 · 선택 · 단계)이 아닌 판 칸의 카드(인물 · 장소 · 준비물 …) → 선반 · 줄 = 나머지(❔ 빼고)
//  시작 = 들어오는 화살표가 없는 카드 가운데 먼저 쓴 것
export const LINE_Z = new Set(['사건', '선택', '단계']);
export const matZonesOf = b => zoneNames(b).filter(z => !LINE_Z.has(z));
export const lineZoneOf = b => zoneNames(b).find(z => z === '사건' || z === '단계') || '';
export function storyGraph(b, keep = () => true) {
  const MZ = new Set(matZonesOf(b)), all = Object.values(b.cards).filter(keep);
  const mats = all.filter(c => MZ.has(c.zone)), unk = all.filter(c => c.kind === 'unknown' && !MZ.has(c.zone));
  const nodes = all.filter(c => !MZ.has(c.zone) && c.kind !== 'unknown');
  const ids = new Set(nodes.map(c => c.id));
  const links = Object.values(b.links).filter(l => ids.has(l.from) && ids.has(l.to));
  const out = new Map(nodes.map(c => [c.id, []])), inn = new Map(nodes.map(c => [c.id, []]));
  for (const l of links.sort((p, q) => (p.i ?? 0) - (q.i ?? 0) || p.t - q.t)) { out.get(l.from).push(l); inn.get(l.to).push(l); }
  const roots = nodes.filter(c => !inn.get(c.id).length).sort((p, q) => p.t - q.t);
  const start = roots.find(c => out.get(c.id).length) || roots[0] || null;
  const lines = roots.filter(c => c === start || out.get(c.id).length);   // 화살표로 이어진 줄들(첫 줄 = 시작)
  const loose = roots.filter(c => !lines.includes(c));                      // 아직 안 이은 카드
  // 자리: 줄마다 왼쪽에서 오른쪽(차례) · 갈림길은 아래로 줄을 더한다
  const pos = new Map(); let row = 0;
  const place = (id, col) => {
    pos.set(id, { col, row });
    const kids = out.get(id).map(l => l.to).filter(k => !pos.has(k));
    if (!kids.length) { row++; return; }
    kids.forEach(k => place(k, col + 1));
  };
  for (const r of lines) place(r.id, 0);
  for (const c of nodes.slice().sort((p, q) => p.t - q.t)) if (!pos.has(c.id) && !loose.includes(c)) { lines.push(c); place(c.id, 0); }   // 빙 도는 화살표(자유 배치에서 만든 것)도 빠짐없이
  const leaves = nodes.filter(c => pos.has(c.id) && !out.get(c.id).length);
  return { nodes, mats, unk, links, out, inn, start, lines, loose, pos, rows: row, leaves };
}
// 갈림길 안 고를 것 이름(A · B …) — 화살표가 둘 이상 나가는 카드의 뒤 카드
export const optLetter = (g, id) => { const l = g.inn.get(id) || []; if (l.length !== 1) return ''; const sib = g.out.get(l[0].from) || []; return sib.length > 1 ? 'ABCD'[sib.indexOf(l[0])] || '' : ''; };
// 코치(바로 뜨는 힌트) — 결말 없는 길 · 고를 것 하나뿐인 갈림길 · 안 이은 카드 · 누가 나오는지
export function storyCoach(b, g = storyGraph(b)) {
  const out = [];
  if (!g.nodes.length) return out;
  for (const c of g.nodes) if (g.out.get(c.id).length === 1 && c.zone === '선택') out.push(`갈림길 '${c.text.slice(0, 14)}'에 고를 것이 하나뿐이에요`);
  const open = g.leaves.filter(c => !c.end);
  if (open.length) {
    const names = open.map(c => { const L = optLetterUp(g, c.id); return L ? `${L} 길` : '이 줄'; });
    out.push(`${[...new Set(names)].join(' · ')}에 아직 끝이 없어요 — 마지막 사건에서 '끝'을 눌러요`);
  }
  if (g.loose.length) out.push(`아직 줄에 안 이은 카드 ${g.loose.length}장`);
  if (g.mats.some(m => m.zone === '인물') && !g.nodes.some(c => Object.keys(c.tags || {}).some(k => (b.cards[k] || {}).zone === '인물'))) out.push('사건에 누가 나오는지 인물을 붙여 봐요');
  return out;
}
// 이 카드가 속한 갈림길 이름(거슬러 올라가며 처음 만나는 A · B)
function optLetterUp(g, id) {
  const seen = new Set();
  for (let cur = id; cur && !seen.has(cur); ) { seen.add(cur); const L = optLetter(g, cur); if (L) return L; const l = (g.inn.get(cur) || [])[0]; cur = l ? l.from : ''; }
  return '';
}
// 나무 — 형제 차례대로 · 없는 위 항목을 가리키면 맨 위로
export function treeOf(b, keep = () => true) {
  const items = Object.values(b.cards).filter(keep).filter(c => c.kind !== 'unknown');
  const ids = new Set(items.map(c => c.id));
  const kids = new Map([['', []]]);
  for (const c of items) { const p = c.parent && ids.has(c.parent) ? c.parent : ''; if (!kids.has(p)) kids.set(p, []); kids.get(p).push(c); }
  for (const l of kids.values()) l.sort((p, q) => (p.ord || 0) - (q.ord || 0) || p.t - q.t);
  return { kids: id => kids.get(id) || [], items };
}

// 연구용 요약 수치 — 성과지표가 아니라 '흔적'(파랑이 늘면 좋다는 뜻이 아님)
export function stats(b) {
  const cards = Object.values(b.cards), mail = Object.values(b.mail), logs = Object.values(b.log);
  const by = (arr, f) => arr.reduce((a, x) => { const k = f(x); a[k] = (a[k] || 0) + 1; return a; }, {});
  return {
    cards: cards.length,
    src: by(cards, c => c.src),
    unknownNow: cards.filter(c => c.kind === 'unknown').length,
    unknownMade: logs.filter(l => l.op === 'add' && l.kind === 'unknown').length + mail.filter(m => m.status === 'unknown').length,
    resolved: logs.filter(l => l.op === 'resolve').length,
    afterResult: logs.filter(l => (l.op === 'add' || l.op === 'edit') && b.meta?.lastResultAt && l.t > b.meta.lastResultAt).length,
    mailNew: mail.filter(m => m.status === 'new').length,
    judged: by(mail.filter(m => m.status !== 'new'), m => m.status),
    reasons: by(mail.filter(m => m.reason), m => m.reason),
    reacts: cards.reduce((n, c) => n + Object.keys(c.react || {}).length, 0),   // 기록만
    writers: new Set(cards.filter(c => c.src === 'me' && !c.via).map(c => c.sid || c.by)).size,
  };
}
