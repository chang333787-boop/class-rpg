// 판 → 글(Claude가 읽는 모양) · AI 지시문 · AI 답(JSON) → 우편함 카드
// 아이 이름은 내보내지 않는다(개인정보) — 카드 글과 출처만.
import { SRC } from './model.js';

const srcTag = c => (c.kind === 'unknown' ? '❔' : SRC[c.src] || c.src) + (c.ar ? ' · 결과 보고 고침' : '');

export function boardToText(b) {
  const cards = Object.values(b.cards).sort((a, z) => a.y - z.y || a.x - z.x);
  const name = id => (b.cards[id] ? `"${b.cards[id].text}"` : '(지운 카드)');
  const L = [`# ${b.title} — ${b.template.name}`, ''];
  const zones = b.template.zones || [];
  for (const z of zones) {
    L.push(`## ${z}`);
    const list = cards.filter(c => c.zone === z && c.kind !== 'unknown');
    L.push(...(list.length ? list.map(c => `- ${c.text} [${srcTag(c)}]`) : ['- (비어 있음)']), '');
  }
  const loose = cards.filter(c => !zones.includes(c.zone) && c.kind !== 'unknown');
  if (loose.length || !zones.length) {
    L.push(zones.length ? '## (구역 밖)' : '## 카드');
    L.push(...(loose.length ? loose.map(c => `- ${c.text} [${srcTag(c)}]`) : ['- (비어 있음)']), '');
  }
  const unk = cards.filter(c => c.kind === 'unknown');
  L.push('## ❔ 아직 안 정한 것', ...(unk.length ? unk.map(c => `- ${c.text}${c.zone ? ` (${c.zone})` : ''}`) : ['- (없음)']), '');
  const links = Object.values(b.links);
  if (links.length) L.push('## 화살표(이어짐)', ...links.map(l => `- ${name(l.from)} → ${name(l.to)}`), '');
  const judged = Object.values(b.mail).filter(m => m.status !== 'new').sort((a, z) => a.t - z.t);
  if (judged.length) {
    const act = { keep: '그대로 가져옴', edit: '고쳐서 가져옴', drop: '버림', answer: '답함', unknown: '❔로 남김' };
    L.push('## 지난 우편함(아이들의 판단)');
    for (const m of judged) {
      const c = m.card && b.cards[m.card];
      L.push(`- ${m.type === 'question' ? '질문' : '제안'} "${m.text}" → ${act[m.status] || m.status}${m.reason ? ` (${m.reason})` : ''}${c && (m.status === 'edit' || m.status === 'answer') ? `: "${c.text}"` : ''}`);
    }
    L.push('');
  }
  const res = Object.values(b.results);
  if (res.length) L.push('## 결과물', ...res.map(r => `- ${r.title || r.url} ${r.url}`), '');
  return L.join('\n');
}

export const COMMON_RULES = `너는 초등학생 모둠의 '생각판'을 읽고, 아이들이 자기 생각을 스스로 완성하도록 돕는 질문자야.
[반드시 지킬 것]
- 아이들이 아직 정하지 않은 것만 다룬다. ❔ 카드, 비어 있는 구역, 끊긴 화살표를 먼저 본다.
- 판에 없는 새 인물·장소·규칙·설정을 지어내지 않는다. 결말이나 정답을 대신 정하지 않는다.
- 제안은 판에 이미 있는 카드 사이의 빈 곳을 잇는 것만, 꼭 필요할 때만 한다. 제안마다 왜 필요한지 한 줄(why)을 붙인다.
- 아이들이 이미 버린 제안·이미 답한 질문을 다시 하지 않는다.
- 카드 글은 25자 이내, 초등 4학년이 읽기 쉬운 해요체. 칭찬이나 설명 문단 없이 카드만.`;

export function promptFor(b) {
  const zones = b.template.zones || [];
  const qOnly = b.settings.mail === 'q';
  return `${COMMON_RULES}
- 질문 1~2개${qOnly ? '. 이번에는 제안을 하지 않는다(질문만).' : ', 제안 0~2개.'}

[이번 활동] ${b.template.ai || ''}

[생각판]
${boardToText(b)}
[답 형식] 아래 JSON만 출력한다(다른 글 없이).
{"cards":[{"type":"question","text":"…","zone":"…"}${qOnly ? '' : ',{"type":"suggest","text":"…","zone":"…","why":"…"}'}]}
zone은 ${zones.length ? zones.map(z => `"${z}"`).join(' · ') + ' 중 하나, 해당 없으면 ""' : '""'}.`;
}

// AI 답 → 우편함 카드. 형식이 틀리면 고치거나 버리고, 이유를 알려 준다.
export function parseMail(text, b) {
  const zones = b.template.zones || [];
  const m = String(text).match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!m) return { ok: false, items: [], notes: ['JSON을 찾지 못했어요'] };
  let j;
  try { j = JSON.parse(m[0]); } catch { return { ok: false, items: [], notes: ['JSON 모양이 깨졌어요'] }; }
  const arr = Array.isArray(j) ? j : j.cards;
  if (!Array.isArray(arr)) return { ok: false, items: [], notes: ['"cards" 목록이 없어요'] };
  const notes = [], items = [];
  for (const it of arr) {
    const type = it.type === 'suggest' ? 'suggest' : it.type === 'question' ? 'question' : null;
    const text = String(it.text || '').trim();
    if (!type || !text) { notes.push('종류나 글이 없는 카드 하나를 뺐어요'); continue; }
    if (type === 'suggest' && b.settings.mail === 'q') { notes.push(`질문만 받는 판이라 제안 "${text}"을 뺐어요`); continue; }
    if (text.length > 40) { notes.push(`너무 긴 카드를 뺐어요: "${text.slice(0, 20)}…"`); continue; }
    const zone = zones.includes(it.zone) ? it.zone : '';
    items.push({ type, text, zone, why: type === 'suggest' ? String(it.why || '').trim().slice(0, 60) : '' });
  }
  if (items.length > 4) { notes.push(`카드가 많아 앞의 4장만 넣어요`); items.length = 4; }
  return { ok: items.length > 0, items, notes };
}
