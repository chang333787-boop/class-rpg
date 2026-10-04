// 작은 도구 모음 — 빌드 없음, ES 모듈. 공통(uid · keyOf · clamp · h · toast · modal · lsGet · lsSet)은 ../../common/util.js 를 다시 내보낸다 [SUBAPP-COMMON-1]
//  여기에는 음악실에만 있는 것만: esc · svg(악보 · 리코더 그림) · 시작 준비 3 · 2 · 1
export * from '../../common/util.js';
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function svg(tag, attrs = {}, ...kids) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) el.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : String(k));
  return el;
}

//  [MUSIC-READY-1] 시작 준비(사용자 10-03 '시작하자마자 내려와 · 준비 시간 3 2 1') — 반주보다 먼저 3 · 2 · 1(초)을 크게 세고,
//  그다음 한 마디는 딸깍 소리와 같이 '하나 둘 셋 넷'을 센다. 리듬 게임 · 리코더 연습이 같이 쓴다.
//  t = 첫 음까지 남은 시간의 음수(초) · off = 한 마디 세기 길이 · beat = 한 박 길이 · (cx, cy) = 글 가운데
export const READY_SEC = 3;
const COUNT_WORDS = ['하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟'];
export function readyCount(g, t, off, beat, beats, cx, cy) {
  g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
  if (t < -off) {
    const x = -t - off, n = Math.min(READY_SEC, Math.ceil(x)), pop = 1 + Math.max(0, (x % 1) - 0.8);   // 숫자가 바뀌는 순간 살짝 커짐
    g.fillStyle = 'rgba(255,255,255,.95)'; g.font = `900 ${Math.round(110 * pop)}px "Noto Sans KR",sans-serif`; g.fillText(String(n), cx, cy);
    g.fillStyle = 'rgba(255,255,255,.72)'; g.font = '800 18px "Noto Sans KR",sans-serif'; g.fillText('준비해요', cx, cy + 76);
  } else {
    const i = Math.min(beats - 1, Math.max(0, Math.floor((t + off) / beat)));
    g.fillStyle = 'rgba(255,228,143,.95)'; g.font = '900 64px "Noto Sans KR",sans-serif'; g.fillText(COUNT_WORDS[i] || String(i + 1), cx, cy);
  }
  g.restore();
}
