// 연구 자료 — 생각판 기록을 학급 RPG 학생(id)과 이어 표로 만든다(선생님 화면 '연구 자료 내보내기').
//  학생별 요약 · 카드 · 기록(시간순) 세 표 + 전체 JSON. 가명(S01 …)을 고르면 이름 칸이 가명이 되고 글 속 이름은 그대로 두지 않는다(글은 빼기 선택).
//  연구 원칙: 출처 색 · 공감 수는 성과가 아니라 흔적 — 표는 '이유 있는 선택'을 보려고 만든다.
const iso = t => (t ? new Date(t).toISOString() : '');
const kidCard = c => c.src === 'me' && !c.via;

// roster = [{ id, name }] (RPG 학생 명단 · 없으면 판에서 모은다). 반환: { key(sid|이름) → { id, name, label } }
export function people(boards, roster = [], { pseudo = true } = {}) {
  const m = new Map();
  for (const r of roster) if (r && (r.id || r.name)) m.set(r.id || r.name, { id: r.id || '', name: r.name || '' });
  for (const b of boards) for (const x of [...Object.values(b.cards || {}), ...Object.values(b.log || {})]) {
    const k = x.sid || x.by; if (!k || k === 'teacher' || x.by === 'teacher') continue;
    if (!m.has(k)) m.set(k, { id: x.sid || '', name: x.by || '' });
    else if (!m.get(k).name && x.by) m.get(k).name = x.by;
  }
  const list = [...m.entries()].sort((a, z) => (a[1].name || '').localeCompare(z[1].name || '', 'ko', { numeric: true }));
  const out = new Map();
  list.forEach(([k, v], i) => out.set(k, { ...v, key: k, label: pseudo ? 'S' + String(i + 1).padStart(2, '0') : v.name || k }));
  return out;
}
const keyOfX = x => x.sid || x.by;

export function studentRows(boards, roster, opts = {}) {
  const P = people(boards, roster, opts), acc = new Map([...P.keys()].map(k => [k, {
    boards: new Set(), cards: 0, fromMail: 0, unknownMade: 0, resolved: 0, edits: 0, deletes: 0, moves: 0, links: 0,
    reactsGiven: 0, reactsGot: 0, keep: 0, editMail: 0, drop: 0, answer: 0, unknownMail: 0, afterResult: 0, reasons: {}, first: 0, last: 0 }]));
  const A = k => acc.get(k);
  for (const b of boards) {
    for (const c of Object.values(b.cards || {})) {
      const a = A(keyOfX(c)); if (!a) continue;
      a.boards.add(b.id); if (kidCard(c)) a.cards++; if (c.via) a.fromMail++; if (c.ar) a.afterResult++;
      a.reactsGot += Object.keys(c.react || {}).length;
    }
    for (const l of Object.values(b.log || {})) {
      const a = A(keyOfX(l)); if (!a) continue;
      a.boards.add(b.id); a.first = a.first ? Math.min(a.first, l.t) : l.t; a.last = Math.max(a.last, l.t || 0);
      if (l.op === 'add' && l.kind === 'unknown') a.unknownMade++;
      if (l.op === 'resolve') a.resolved++;
      if (l.op === 'edit') a.edits++;
      if (l.op === 'delete') a.deletes++;
      if (l.op === 'zone') a.moves++;
      if (l.op === 'link') a.links++;
      if (l.op === 'react') a.reactsGiven++;
      if (l.op === 'unreact') a.reactsGiven--;
      if (l.op === 'judge') {
        ({ keep: () => a.keep++, edit: () => a.editMail++, drop: () => a.drop++, answer: () => a.answer++, unknown: () => { a.unknownMail++; a.unknownMade++; } })[l.action]?.();
        if (l.reason) a.reasons[l.reason] = (a.reasons[l.reason] || 0) + 1;
      }
    }
  }
  return [...P.values()].map(p => { const a = A(p.key); return {
    학생: p.label, RPG학생id: opts.pseudo === false ? p.id : '', 참여판수: a.boards.size, 직접쓴카드: a.cards, 우편함에서붙인카드: a.fromMail,
    모르는것만듦: a.unknownMade, 정했어요: a.resolved, 고침: a.edits, 지움: a.deletes, 칸옮김: a.moves, 화살표: a.links,
    공감한수: a.reactsGiven, 공감받은수: a.reactsGot, 우편함_그대로: a.keep, 우편함_고쳐서: a.editMail, 우편함_버림: a.drop, 우편함_답함: a.answer, 우편함_모름으로: a.unknownMail,
    결과보고고침: a.afterResult, 판단이유: Object.entries(a.reasons).map(([r, n]) => `${r} ${n}`).join(' / '), 처음: iso(a.first), 마지막: iso(a.last) }; });
}

export function cardRows(boards, roster, opts = {}) {
  const P = people(boards, roster, opts), rows = [];
  for (const b of boards) for (const c of Object.values(b.cards || {}).sort((a, z) => a.t - z.t)) rows.push({
    판: b.title, 판틀: b.template?.name || '', 판id: b.id, 카드id: c.id, 학생: P.get(keyOfX(c))?.label || (c.by === 'teacher' ? '선생님' : ''),
    종류: c.kind === 'unknown' ? '모르는 것' : '생각', 출처: { me: '내가 씀', 'ai-edit': 'AI 카드를 고침', 'ai-keep': 'AI 카드 그대로' }[c.src] || c.src, 칸: c.zone || '',
    글: opts.text === false ? '' : c.text, 공감: Object.keys(c.react || {}).length, 가림: c.hidden ? 'O' : '', 허락: c.ok ? 'O' : '', 결과보고고침: c.ar ? 'O' : '',
    만든때: iso(c.t), 고친때: iso(c.ut) });
  return rows;
}

export function logRows(boards, roster, opts = {}) {
  const P = people(boards, roster, opts), rows = [];
  for (const b of boards) for (const l of Object.values(b.log || {})) rows.push({
    때: iso(l.t), 판: b.title, 판id: b.id, 학생: l.by === 'teacher' ? '선생님' : P.get(keyOfX(l))?.label || '', 동작: l.op,
    카드id: l.card || '', 종류: l.kind || l.type || '', 출처: l.src || '', 판단: l.action || '', 이유: l.reason || '',
    글: opts.text === false ? '' : (l.text || '') });
  return rows.sort((a, z) => a.때.localeCompare(z.때));
}

export function toCSV(rows) {
  if (!rows.length) return '﻿';
  const cols = Object.keys(rows[0]), q = v => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '﻿' + [cols.join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\r\n');
}
