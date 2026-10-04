// 질문 만들기 — 그림에서 짚은 곳(이름) + 질문 갈래 → 문장(조사 자동). 글 입력 없음(학급 DB 가 열려 있어 낱말을 고르게만 한다)
//  [4미03-01] '미술 작품을 자세히 보고 작품과 미술가에 관해 질문할 수 있다'(고시 원문) — 갈래 = 질문 사다리(1 보이는 것 · 2 까닭 · 마음 · 3 상상 · 4 화가에게)
//  해설: '작품 정보를 활용한 질문, 작품의 내용이나 형식에 관한 질문, 작가의 입장이 되어 던지는 질문 등' → 화가에게 갈래
const batchim = w => { const c = String(w).charCodeAt(String(w).length - 1); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0; };
export const jo = (w, a, b) => w + (batchim(w) ? a : b);

export const KINDS = [
  { k: 'see', name: '보이는 것', level: 1, make: p => `${jo(p.n, '은', '는')} 무엇을 하고 있을까?`, ok: p => p.who === 1 },
  { k: 'what', name: '보이는 것', level: 1, make: p => `${jo(p.n, '은', '는')} 무엇으로 만들었을까?`, ok: p => !p.who },
  { k: 'why', name: '까닭', level: 2, make: p => `${jo(p.n, '은', '는')} 왜 ${p.act || '여기에 있을까'}?` },
  { k: 'heart', name: '마음', level: 2, make: p => `${jo(p.n, '은', '는')} 지금 어떤 마음일까?`, ok: p => p.who === 1 },
  { k: 'sense', name: '소리 · 느낌', level: 3, make: p => (p.who === 2 ? `${jo(p.n, '을', '를')} 보면 어떤 느낌이 들까?` : `${p.n} 쪽에서는 어떤 소리가 들릴까?`) },
  { k: 'next', name: '다음 일', level: 3, make: p => `${p.n}에게는 잠시 뒤 무슨 일이 일어날까?`, ok: p => p.who === 1 },
  { k: 'look', name: '보이는 것', level: 1, make: p => `${jo(p.n, '은', '는')} 무슨 색으로 보일까?`, ok: p => p.who === 2 },
  { k: 'ifnot', name: '만약', level: 3, make: p => `만약 ${jo(p.n, '이', '가')} 없다면 그림이 어떻게 달라질까?` },
  { k: 'artist', name: '화가에게', level: 4, make: p => `화가는 왜 ${jo(p.n, '을', '를')} 이렇게 그렸을까?` },
];
export const LEVELS = { 1: '보이는 것', 2: '까닭 · 마음', 3: '상상', 4: '화가에게' };
export const kindOf = k => KINDS.find(x => x.k === k);
export const kindsFor = p => KINDS.filter(x => !x.ok || x.ok(p));
export const questionText = (c, k, pi) => { const p = c.parts[pi], kd = kindOf(k); return p && kd ? kd.make(p) : ''; };

// 짚은 자리 → 이름 붙은 곳(겹치면 가장 작은 곳 — 사람 안의 물건을 고를 수 있게)
export const inRect = (x, y, r, pad = 0) => x >= r[0] - pad && x <= r[2] + pad && y >= r[1] - pad && y <= r[3] + pad;
const area = r => (r[2] - r[0]) * (r[3] - r[1]);
export function partAt(c, x, y) {
  let best = -1;
  c.parts.forEach((p, i) => { if (inRect(x, y, p.r, 1) && (best < 0 || area(p.r) < area(c.parts[best].r))) best = i; });
  return best;
}
