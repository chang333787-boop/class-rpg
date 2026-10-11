// 학습지 인쇄(10-11 · 교사 '막히는 곳은 간단한 개념과 반복 풀이로 · 인쇄 모드도') — 선생님 화면에서만
//  층(차시)마다: 이렇게 해요(힌트) · 예제(같은 단계로 푼 문제) · 연습 8문제(계산 차시면 그중 2문제는 같은 숫자의 문장제) · 맨 끝에 정답
//  화면에 숨은 #mg-print 에 그려 window.print() — 나머지는 인쇄 CSS(mathgap.css @media print)가 숨긴다 · 아무것도 저장하지 않음
import { byId, makeItem } from './core/lessons/index.js';
import { toHTML, toText } from './core/tokens.js';
import { rng } from './core/math.js';
import { hasWords, storyOf } from './core/words.js';
import { exampleOf } from './today.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// 글 속 분수(4/7 · 1 2/7) → 세로 분수(kid.js rich 와 같은 규칙)
const FRX = /(\d+) (\d+)\/(\d+)|(\d+)\/(\d+)/g;
function richHTML(s) {
  const t = String(s || ''), out = []; let last = 0;
  for (const m of t.matchAll(FRX)) { if (m.index > last) out.push(t.slice(last, m.index)); out.push(m[1] ? { m: [m[1], m[2], m[3]] } : { f: [m[4], m[5]] }); last = m.index + m[0].length; }
  if (last < t.length) out.push(t.slice(last));
  return toHTML(out, { static: true });
}
const filled = (it) => (it.choices ? toHTML(it.choices[it.sol[0]], { static: true }) : toHTML(it.prompt, { static: true, vals: it.sol.map(String) }));
const NUMS = '①②③④⑤⑥';
const answerText = (it) => (it.choices ? `${NUMS[it.sol[0]] || ''} ${toText(it.choices[it.sol[0]])}` : toText(it.prompt, it.sol.map(String)).replace(/^답\s*/, ''));

// 한 층의 연습 문제 — 같은 문제 두 번 없음 · 계산 차시면 4번 · 8번이 문장제
export function sheetProblems(c, seed, n = 8) {
  const L = byId[c], r = rng(seed), out = [], seen = new Set(), words = hasWords(c);
  for (let i = 0; i < n * 6 && out.length < n; i++) {
    let p; try { p = L.gen(r); } catch (e) { continue; }
    if (words && (out.length === 3 || out.length === 7)) {
      const s = storyOf(c, p, seed + i * 7919);
      if (s) { out.push({ story: s.story, item: s.item, ans: answerText(s.item) }); continue; }
    }
    const it = makeItem(c, p), key = toText(it.prompt) + (it.choices || []).map((x) => toText(x)).join('|');
    if (seen.has(key)) continue;
    seen.add(key); out.push({ item: it, ans: answerText(it) });
  }
  return out;
}

// floors = [{ c, label }] · who = 이름(없으면 빈 줄) · title = 맨 위 제목
export function sheetHTML({ title, who = '', floors, seed = Date.now() % 100000 }) {
  const parts = [], keys = [];
  floors.forEach((f, k) => {
    const L = byId[f.c];
    let ex = null; try { ex = exampleOf(f.c, seed + k * 31); } catch (e) { /* */ }
    const ps = sheetProblems(f.c, seed + k * 977);
    keys.push(`<div class="pak"><b>${esc(f.label)}</b> ${ps.map((x, i) => `<span>${i + 1}) ${esc(x.ans)}</span>`).join(' ')}</div>`);
    parts.push(`<section class="pfl">
      <h2>${esc(f.label)}</h2>
      ${L.hint ? `<div class="pk"><b>이렇게 풀어요</b> ${richHTML(L.hint)}</div>` : ''}
      ${ex ? `<div class="pex"><b>예제</b>${ex.steps.map((s, i) => `<div class="prow"><span>${i + 1}. ${richHTML(s.why)}</span><span class="math">${filled(s.item)}</span></div>`).join('')}<div class="prow"><span>${ex.steps.length ? '그래서' : '예'}</span><span class="math">${filled(ex.item)}</span></div></div>` : ''}
      <ol class="pq">${ps.map((x) => `<li class="${x.story ? 'wide' : ''}">${x.story ? `<div class="pst">${toHTML(x.story, { static: true })}</div>` : ''}<span class="math">${toHTML(x.item.prompt, { static: true })}</span>${x.item.choices ? `<div class="ch">${x.item.choices.map((ch, i) => `<span>${NUMS[i]} <span class="math">${toHTML(ch, { static: true })}</span></span>`).join('')}</div>` : ''}</li>`).join('')}</ol>
    </section>`);
  });
  const today = new Date().toLocaleDateString('ko-KR');
  return `<div class="ps">
    <header><h1>${esc(title)}</h1><div class="who"><span>이름 <u>${who ? esc(who) : '　　　　　　'}</u></span><span>날짜 <u>${today}</u></span></div></header>
    ${parts.join('')}
    <section class="pans"><h2>정답</h2>${keys.join('')}</section>
  </div>`;
}

export function printSheet(opts) {
  let el = document.getElementById('mg-print');
  if (!el) { el = document.createElement('div'); el.id = 'mg-print'; document.body.append(el); }
  el.innerHTML = sheetHTML(opts);
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); el.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 80);
}
