// 음악실 리듬 과제 — 선생님이 정한 판 · 결과를 과제 칸 모양으로 [ASSIGN-MUSIC-1]
//  DOM · firebase 없음(노드 시험이 그대로 읽는다). 화면은 app.js(과제 불러오기 · 길 막기) · rhythm.js(정한 판으로 치기 · 끝나면 보내기).
//  계약 = common/assign.js 머리 · 설계 = docs/class_assign_design.md §7-4
//   · 난이도 · 키 수 · 빠르기는 선생님 것(아이 기기 localStorage 무시) — 반 전체가 같은 판
//   · 점수(score) = 가장 좋은 정확도(0~100, 반올림) / 100 — 늘 때만 써진다(AssignCore.appPatch)
//   · detail.best  = 가장 좋은 판(rank = 점수 — 더 클 때만 덮음)
//   · detail.first = 처음 끝까지 친 판(rank 0 — 한 번 써지면 안 덮임) · 선생님 물음 '처음 판이냐 가장 좋은 판이냐'(설계 §17 Q6)를 둘 다 보이게
//   · done = 친 음표가 1개 이상인 판을 끝까지(아무것도 안 치고 끝까지 둔 것은 '끝'이 아님 — 반박 #15)

export const LEVEL_KEYS = ['easy', 'normal', 'hard', 'expert'];

//  과제 정의(normDef 를 거친 것) → 리듬 판 설정 · 음악 과제가 아니면 null
export function rhythmSettings(def) {
  const m = def && def.kind === 'music' && def.content && def.content.music;
  if (!m || typeof m.song !== 'string' || !m.song) return null;
  return {
    song: m.song,
    level: LEVEL_KEYS.includes(m.level) ? m.level : 'easy',
    keys: [4, 6, 8].includes(Number(m.keys)) ? Number(m.keys) : 0,   // 0 = 난이도 기본
    tempo: Number(m.tempo) === 0.8 ? 0.8 : 1,
  };
}

const int = v => Math.max(0, Math.floor(Number(v) || 0));
//  리듬 한 판 결과(rhythm.js finish) → reportAssign 에 넘길 patch
//   res = { score(0~1,000,000), acc(0~100 · 소수 한 자리), grade, maxCombo, perfect, great, good, miss }
export function rhythmPatch(res) {
  if (!res || typeof res !== 'object') return null;
  const perfect = int(res.perfect), great = int(res.great), good = int(res.good), miss = int(res.miss);
  const hit = perfect + great + good;
  const acc = Math.max(0, Math.min(100, Math.round((Number(res.acc) || 0) * 10) / 10));
  const score = Math.max(0, Math.min(1000000, Math.round(Number(res.score) || 0)));
  const grade = /^[SABCD]$/.test(String(res.grade)) ? String(res.grade) : 'D';
  const rec = { score, acc, grade, maxCombo: int(res.maxCombo), perfect, great, good, miss };
  const p = { attempt: true, score: Math.round(acc), total: 100, detail: { best: { rank: score, ...rec } } };
  if (hit > 0) { p.done = true; p.detail.first = { rank: 0, ...rec }; }
  return p;
}

//  내 결과 칸(classRPG_assign/results/<과제>/<나>) → 아이 화면에 보일 줄 하나('가장 좋은 기록 · 몇 번 쳤는지')
export function myLine(cell) {
  const app = cell && typeof cell === 'object' && cell.app && typeof cell.app === 'object' ? cell.app : null;
  const b = app && app.detail && app.detail.best;
  if (!b) return '';
  return `내 가장 좋은 기록 · 정확도 ${Number(b.acc) || 0}% (${String(b.grade || '')}) · ${int(app.attempts)}번 쳤어요`;
}
