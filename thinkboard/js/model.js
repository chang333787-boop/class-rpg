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
import { withDefaults } from './settings.js';

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
};

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
