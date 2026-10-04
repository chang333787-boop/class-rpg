// 사건 화면 — 왼쪽 그림(확대 · 짚기) · 오른쪽 탐정 수첩(① 찾기 → ② 생각 → ③ 느낌 → ④ 질문 → 사건 해결)
//  [4미03-01] 작품을 자세히 보고(찾기) · 무엇을 보고 그렇게 생각했는지 단서로 말하고(생각) · 느낌을 고르고 · 작품과 화가에게 질문을 만든다
import { h, modal, toast } from './util.js';
import { makeViewer } from './viewer.js';
import { FEELS, BECAUSE } from './cases.js';
import { kindsFor, kindOf, questionText, partAt, inRect } from './ask.js';
import { COLOR_NAMES, colorShare, judgeColors } from './colors.js';
import { MAX_ASK } from './store.js';

export const HOST = '../assets/monsters/m30.png';   // 재털이 고양이 — 명화 탐정(파적도의 고양이와 같은 고양이 무리)
const STEPS = [['find', '찾기'], ['think', '생각'], ['feel', '느낌'], ['ask', '질문']];
const STAR = n => '★'.repeat(n) + '☆'.repeat(3 - n);
export const starsOf = (miss, hint) => { const v = miss + hint * 2; return v <= 2 ? 3 : v <= 6 ? 2 : 1; };
const FEEL_WORD = Object.fromEntries(FEELS), BEC_WORD = Object.fromEntries(BECAUSE), COLOR_WORD = Object.fromEntries(COLOR_NAMES.map(c => [c[0], c[1]]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const r1 = v => Math.round(v * 10) / 10;

// 반 셈 — { sid: { key: 'a,b' } } → { a: n, b: n }
const tally = (obj, key) => { const cnt = {}; for (const v of Object.values(obj || {})) for (const k of String((v || {})[key] || '').split(',').filter(Boolean)) cnt[k] = (cnt[k] || 0) + 1; return cnt; };
function bars(cnt, word, mine = []) {
  const list = Object.entries(cnt).sort((a, z) => z[1] - a[1]), max = Math.max(1, ...list.map(x => x[1]));
  if (!list.length) return h('p', { class: 'muted small' }, '아직 아무도 고르지 않았어요.');
  return h('div', { class: 'bars' }, ...list.slice(0, 6).map(([k, n]) => h('div', { class: 'bar' + (mine.includes(k) ? ' me' : '') },
    h('span', { class: 'bl' }, word(k)), h('span', { class: 'bb' }, h('i', { style: { width: (100 * n / max) + '%' } })), h('b', {}, n + '명'))));
}

export function mountCase(root, ctx, c) {
  const solvedBefore = !!ctx.progress()[c.id], me = ctx.store.me.sid;
  let step = 0, open = solvedBefore ? 3 : 0, alive = true, finished = false;
  let miss = 0, hints = 0, missSince = 0, hintMark = null;
  const found = c.finds.map(() => new Set());
  const doneFind = i => found[i].size >= (c.finds[i].need || 1);
  const requiredDone = () => c.finds.every((f, i) => f.bonus || doneFind(i));
  let thinkDone = false, feelDone = false, board = null;
  // 생각
  let tChoice = c.think.mode === 'evidence' && c.think.opts.length === 1 ? 0 : -1, tEv = new Set(), tShown = false, tPick = null, tColors = new Set(), tShare = null;
  // 느낌 · 질문
  const fPick = new Set(); let fBec = '', aPart = -1, aKind = '', aPos = null, aSel = '';

  const viewer = makeViewer({ src: `img/${c.img}.webp`, w: c.w, h: c.h, alt: `${c.artist} 「${c.title}」`, onTap: t => onTap(t) });
  const msg = h('div', { class: 'msg' });
  const say = (t, k = '') => { msg.textContent = t; msg.className = 'msg ' + k; };
  const tabs = h('div', { class: 'steps' }), body = h('div', { class: 'cp-body' });
  const hintBtn = h('button', { class: 'btn small hint', onclick: () => showHint() }, '💡 힌트');
  hintBtn.style.display = 'none';
  const footNext = h('span', { class: 'foot-next' });   // 그 단계를 마치면 '다음 →'(수첩이 길어 아래로 밀려도 늘 보이는 자리)
  const over = h('div', { class: 'over' });
  const info = () => modal(`${c.artist} 「${c.title}」`, h('div', {}, h('p', {}, `${c.year} · ${c.where}`), h('p', {}, c.intro),
    h('p', { class: 'muted small' }, c.id === 'chochungdo' ? '그림 파일: 위키미디어 공용 · 국립중앙박물관 공공누리 제1유형(출처 표시)' : '그림 파일: 위키미디어 공용 · 퍼블릭 도메인(저작권이 끝난 그림)')));
  root.replaceChildren(
    ctx.topBar(c.title, { back: '#/', right: [h('span', { class: 'chip who-art' }, `${c.artist} · ${c.year}`), h('button', { class: 'btn small', onclick: info }, 'ℹ 그림 정보')] }),
    h('div', { class: 'case' },
      h('section', { class: 'cv' }, viewer.el),
      h('section', { class: 'cp' }, tabs, body, h('div', { class: 'foot-row' }, msg, h('span', { class: 'sp' }), hintBtn, footNext)),
      over));

  async function loadBoard() {
    try { board = await ctx.store.board(c.id); } catch (e) { console.warn(e); board = board || { think: {}, feel: {}, ask: {}, like: {}, names: {} }; }
    //  전에 붙인 생각 · 느낌은 그대로 인정(다시 고르면 바꿔 붙는다)
    if (board.think[me]) thinkDone = true;
    if (board.feel[me]) feelDone = true;
  }
  const guestNote = () => (ctx.store.me.guest ? h('p', { class: 'muted small' }, '학급 RPG에서 열면 우리 반 친구들의 생각도 함께 보여요.') : null);

  // ── 표시(찾은 곳 · 단서 · 힌트 · 질문 핀) ──
  function paint() {
    const list = [];
    //  찾은 곳 표시는 찾기 단계에서만 — 생각 · 질문 때는 그림을 깨끗하게(흑백 실험에서 해를 가리지 않게)
    if (step === 0) c.finds.forEach((f, i) => f.r.forEach((r, k) => { if (found[i].has(k)) list.push({ r, kind: 'found', label: String(i + 1) }); }));
    if (hintMark && step === 0) list.push({ r: hintMark, kind: 'hint' });
    if (step === 1) {
      const t = c.think;
      if (t.mode === 'evidence' && tChoice >= 0) {
        //  내 생각의 단서 = 이름표 · 다른 생각의 단서 = 흐린 점선(이름표가 겹치지 않게)
        t.opts.forEach((o, i) => o.ev.forEach((e, j) => {
          if (i === tChoice && (tShown || tEv.has(j))) list.push({ r: e, kind: 'ev', label: e[4] });
          else if (tShown && !t.opts[tChoice].ev.some(x => x.slice(0, 4).join() === e.slice(0, 4).join())) list.push({ r: e, kind: 'ev2' });
        }));
      }
      if (t.mode === 'pick' && tPick) list.push({ r: tPick.r || [tPick.x - 3, tPick.y - 3, tPick.x + 3, tPick.y + 3], kind: 'ev', label: tPick.label });
      if (t.mode === 'colors' && tShare) list.push({ r: t.region, kind: 'region' });
      if (t.mode === 'gray' && tShown) { list.push({ r: t.sun, kind: 'ev', label: '해' }); for (const s of t.sky) list.push({ r: s, kind: 'region' }); }
    }
    if (step === 3) {
      const qs = askList();
      qs.forEach((q, i) => list.push({ x: q.x, y: q.y, n: i + 1, me: q.s === me, on: q.id === aSel }));
      if (aPos && aPart >= 0) list.push({ x: aPos.x, y: aPos.y, n: '?', me: true, on: true });
    }
    viewer.setMarks(list);
  }
  function renderTabs() {
    tabs.replaceChildren(...STEPS.map(([k, t], i) => {
      const done = [requiredDone(), thinkDone, feelDone, askMine().length > 0][i];
      return h('button', { class: 'tab' + (i === step ? ' on' : '') + (done ? ' done' : ''), disabled: i > open, onclick: () => goStep(i) }, h('span', {}, done ? '✓' : String(i + 1)), t);
    }));
  }
  async function goStep(i) {
    step = i; hintMark = null; hintBtn.style.display = 'none'; body.scrollTop = 0;
    if (i > 0 && !board) await loadBoard();
    if (!alive) return;
    if (i !== 1 && viewer.gray) viewer.setGray(false);
    say(['그림을 자세히 보고 찾아서 짚어요.', '무슨 일일까요? 그림에서 단서를 찾아요.', '이 그림의 느낌을 골라요.', '궁금한 곳을 짚어 질문을 만들어요.'][i]);
    render();
  }
  function render() { renderTabs(); [renderFind, renderThink, renderFeel, renderAsk][step](); renderNext(); paint(); }
  function renderNext() {
    const ready = [requiredDone(), thinkDone && thinkShownNow(), feelDone, askMine().length > 0 && requiredDone() && thinkDone && feelDone][step];
    const [label, fn] = [['② 생각하기 →', () => goStep(1)], ['③ 느낌 고르기 →', () => goStep(2)], ['④ 질문 만들기 →', () => goStep(3)], ['🔎 사건 해결!', () => finish()]][step];
    footNext.replaceChildren(...(ready ? [h('button', { class: 'btn primary', 'data-act': step === 3 ? 'solve' : 'next', onclick: fn }, label)] : []));
  }
  //  생각 단계는 결과(해설)까지 본 뒤에 다음으로 — 전에 붙인 생각이 있어도 이번에 다시 해 보게
  const thinkShownNow = () => { const m = c.think.mode; return m === 'pick' ? thinkDone : m === 'colors' ? !!tShare : tShown; };
  function unlock(i) { if (open < i) { open = i; renderTabs(); } }

  function onTap(t) {
    if (finished && over.style.display === 'grid') return;
    if (step === 0) return tapFind(t);
    if (step === 1) return tapThink(t);
    if (step === 3) return tapAsk(t);
    if (step === 2) say('느낌은 오른쪽에서 골라요 — 그림은 마음껏 확대해 봐요.');
  }

  // ── ① 찾기 — 차례 없이 아무것부터 · 헛짚으면 셈 · 두 번 헛짚으면 힌트 ──
  function renderFind() {
    const cur = c.finds.findIndex((f, i) => !f.bonus && !doneFind(i));
    body.replaceChildren(...[
      h('p', { class: 'lead' }, '그림을 자세히 보고 찾아서 짚어요. ＋ 단추 · 마우스 휠 · 두 손가락으로 크게 볼 수 있어요.'),
      h('ol', { class: 'finds' }, ...c.finds.map((f, i) => h('li', { class: (doneFind(i) ? 'done ' : '') + (i === cur ? 'cur ' : '') + (f.bonus ? 'bonus' : ''), 'data-i': i },
        h('span', { class: 'fn' }, doneFind(i) ? '✓' : String(i + 1)),
        h('div', {}, h('b', {}, f.q), f.need > 1 ? h('span', { class: 'cnt' }, ` ${found[i].size} / ${f.need}`) : null, f.bonus && !doneFind(i) ? h('span', { class: 'tag' }, '숨은 보너스') : null,
          doneFind(i) && f.say ? h('p', { class: 'fsay' }, f.say) : null)))),
      requiredDone() && c.finds.some((f, i) => f.bonus && !doneFind(i)) ? h('p', { class: 'muted small' }, '숨은 보너스는 찾아도 되고, 아래 ‘② 생각하기’로 넘어가도 돼요.') : null,
    ].filter(Boolean));
  }
  function tapFind({ x, y }) {
    //  짚은 자리를 품은 '아직 못 찾은 곳' 가운데 가장 작은 곳(큰 사람 그림 안의 도장처럼 겹치면 작은 쪽을 찾은 것으로)
    let i = -1, j = -1, best = Infinity;
    c.finds.forEach((f, a) => { if (doneFind(a)) return; f.r.forEach((r, k) => { const ar = (r[2] - r[0]) * (r[3] - r[1]); if (!found[a].has(k) && inRect(x, y, r, 1.2) && ar < best) { best = ar; i = a; j = k; } }); });
    if (i >= 0) {
      const f = c.finds[i], before = requiredDone();
      found[i].add(j); missSince = 0; hintMark = null; hintBtn.style.display = 'none';
      viewer.ripple(x, y, 'good'); ctx.store.tap(c.id, 'ok').catch(e => console.warn(e));
      if (doneFind(i)) say(`찾았어요! ${f.say || ''}`.trim(), 'good'); else say(`맞아요 — ${(f.need || 1) - found[i].size}개 더 있어요!`, 'good');
      if (!before && requiredDone()) { unlock(1); say('다 찾았어요! 이제 ② 생각하기로 가요.', 'good'); }
      render(); return;
    }
    if (c.finds.some((f, i) => f.r.some((r, k) => found[i].has(k) && inRect(x, y, r, 1.2)))) { say('거기는 벌써 찾았어요.'); return; }
    miss++; missSince++; viewer.ripple(x, y, 'bad'); ctx.store.tap(c.id, 'miss').catch(e => console.warn(e));
    say(missSince >= 2 ? '거기엔 없어요 — 💡 힌트를 눌러 봐도 돼요.' : '거기엔 없어요 — 크게 확대해서 더 자세히 봐요.', 'bad');
    if (missSince >= 2) hintBtn.style.display = '';
  }
  function showHint() {
    let i = c.finds.findIndex((f, k) => !f.bonus && !doneFind(k));
    if (i < 0) i = c.finds.findIndex((f, k) => !doneFind(k));
    if (i < 0) return;
    const f = c.finds[i], r = f.r.find((_, k) => !found[i].has(k));
    //  정답보다 넓은 동그라미를 가운데에서 살짝 비켜 — '어디쯤'만 알려 준다
    const rx = Math.max(10, (r[2] - r[0]) * 1.4), ry = rx * c.w / c.h, cx = (r[0] + r[2]) / 2 + rx * 0.2, cy = (r[1] + r[3]) / 2 - ry * 0.15;
    const cl = v => Math.max(0, Math.min(100, v));
    hintMark = [cl(cx - rx), cl(cy - ry), cl(cx + rx), cl(cy + ry)];
    hints++; missSince = 0; hintBtn.style.display = 'none'; ctx.store.tap(c.id, 'hint').catch(e => console.warn(e));
    viewer.zoomTo(hintMark, 2.2); paint();
    say(`💡 ‘${f.q}’ — 점선 동그라미 안 어딘가에 있어요.`);
  }

  // ── ② 생각 — 고르고 단서 짚기 · 하고 싶은 놀이 · 흑백 실험 · 색 점 세기 ──
  function thinkTally(word) { return board ? h('div', { class: 'tally' }, h('b', {}, '우리 반은 이렇게 생각했어요'), bars(tally(board.think, 'o'), word, [String(myThink())]), guestNote()) : null; }
  const myThink = () => (board && board.think[me] ? board.think[me].o : '');
  async function saveThink(o) {
    try { await ctx.store.think(c.id, o); } catch (e) { console.warn(e); }
    await loadBoard(); thinkDone = true; unlock(2);
  }
  function renderThink() {
    const t = c.think, rev = () => h('div', { class: 'reveal' }, h('img', { src: HOST, alt: '' }), h('p', {}, t.reveal));
    const parts = [h('p', { class: 'q' }, t.q)];
    if (t.mode === 'evidence') {
      if (tChoice < 0) {
        parts.push(h('p', { class: 'lead' }, '정답이 하나가 아닐 수 있어요. 생각을 하나 고르고, 그렇게 생각한 단서를 그림에서 짚어요.'),
          h('div', { class: 'opts' }, ...t.opts.map((o, i) => h('button', { class: 'opt', 'data-o': i, onclick: () => { tChoice = i; tEv = new Set(); say('그렇게 생각한 단서를 그림에서 짚어요.'); render(); } }, o.t))));
      } else {
        const o = t.opts[tChoice];
        parts.push(h('div', { class: 'picked' }, h('span', { class: 'muted small' }, '내 생각'), h('b', {}, o.t)),
          h('p', { class: 'lead' }, tShown ? '다른 생각의 단서까지 모두 그림에 표시했어요.' : `단서를 짚어요 — ${tEv.size} / ${o.ev.length}`),
          h('ul', { class: 'evs' }, ...[...tEv].map(j => h('li', {}, '🔍 ' + o.ev[j][4]))));
        if (!tShown) parts.push(h('div', { class: 'go-row' }, t.opts.length > 1 ? h('button', { class: 'btn small', onclick: () => { tChoice = -1; tEv = new Set(); render(); } }, '다른 생각 고르기') : null,
          h('span', { class: 'sp' }), tEv.size ? h('button', { class: 'btn primary', onclick: async () => { tShown = true; await saveThink(tChoice); say('단서를 모았어요! 다른 생각의 단서도 그림에 함께 보여요.', 'good'); render(); } }, '단서를 다 짚었어요') : null));
        else parts.push(rev(), thinkTally(k => (t.opts[+k] || {}).t || k));
      }
    }
    if (t.mode === 'pick') {
      parts.push(h('p', { class: 'lead' }, tPick ? `고른 놀이: ${tPick.label}` : '그림에서 놀이 하나를 짚어요.'));
      if (tPick && !thinkDone) parts.push(h('div', { class: 'go-row' }, h('span', { class: 'sp' }), h('button', { class: 'btn primary', onclick: async () => { await saveThink(tPick.label); say('골랐어요! 친구들은 어떤 놀이를 골랐을까요?', 'good'); render(); } }, '이 놀이로 할래요')));
      if (thinkDone) parts.push(rev(), thinkTally(k => k));
    }
    if (t.mode === 'gray') {
      if (tChoice < 0) parts.push(h('div', { class: 'opts' }, ...t.opts.map((o, i) => h('button', { class: 'opt', 'data-o': i, onclick: () => { tChoice = i; render(); } }, o))));
      else {
        parts.push(h('div', { class: 'picked' }, h('span', { class: 'muted small' }, '내 예상'), h('b', {}, t.opts[tChoice])),
          h('div', { class: 'go-row' }, h('button', { class: 'btn' + (viewer.gray ? '' : ' primary'), 'data-act': 'gray', onclick: () => grayTest() }, viewer.gray ? '🎨 색으로 다시 보기' : '⚫ 흑백으로 바꿔 보기')));
        if (tShown) parts.push(h('div', { class: 'measure' }, h('b', {}, '재어 보니(사람 눈 밝기 0~100)'), h('p', {}, `해 ${Math.round(tShare.sun)} · 둘레 하늘 ${Math.round(tShare.sky)}`),
          h('p', { class: tChoice === t.answer ? 'good' : 'bad' }, tChoice === t.answer ? '예상이 맞았어요!' : '예상과 달랐어요 — 그래서 실험이 재미있어요.')), rev(), thinkTally(k => t.opts[+k] || k));
      }
    }
    if (t.mode === 'colors') {
      parts.push(h('div', { class: 'chips' }, ...COLOR_NAMES.map(([k, n, css]) => h('button', { class: 'cchip' + (tColors.has(k) ? ' on' : ''), 'data-c': k, disabled: !!tShare, onclick: () => { tColors.has(k) ? tColors.delete(k) : tColors.add(k); render(); } }, h('i', { style: { background: css } }), n))));
      if (!tShare) parts.push(h('div', { class: 'go-row' }, h('span', { class: 'sp' }), h('button', { class: 'btn primary', disabled: tColors.size < 1, 'data-act': 'count', onclick: () => colorTest() }, '🔬 점 세어 보기')));
      else {
        const j = judgeColors([...tColors], tShare);
        parts.push(h('div', { class: 'measure' }, h('b', {}, '그림의 점을 세어 보니'),
          h('div', { class: 'cbar' }, ...COLOR_NAMES.filter(([k]) => tShare[k] >= 0.5).map(([k, n, css]) => h('i', { style: { background: css, flex: String(tShare[k]) }, title: `${n} ${tShare[k]}%` }))),
          h('p', { class: 'small' }, COLOR_NAMES.filter(([k]) => (tShare[k] || 0) >= 1).sort((a, z) => tShare[z[0]] - tShare[a[0]]).map(([k, n]) => `${n} ${tShare[k]}%`).join(' · ')),
          h('p', { class: j.ok ? 'good' : 'bad' }, j.ok ? `맞혔어요 — ${j.hit.map(k => COLOR_WORD[k]).join(' · ')}` : '조금 더 크게 봐요 — 파랑 말고도 섞인 색이 있어요', j.missed.length ? h('span', { class: 'muted' }, ` · 놓친 색: ${j.missed.map(k => COLOR_WORD[k]).join(' · ')}`) : null)),
          rev(), thinkTally(k => k.split(',').map(x => COLOR_WORD[x] || x).join(' · ')));
      }
    }
    body.replaceChildren(...parts.filter(Boolean));
  }
  function tapThink({ x, y }) {
    const t = c.think;
    if (t.mode === 'evidence') {
      if (tChoice < 0) { say('먼저 오른쪽에서 생각을 하나 골라요.'); return; }
      if (tShown) return;
      const o = t.opts[tChoice], j = o.ev.findIndex(e => inRect(x, y, e, 1.5));
      if (j >= 0) { if (!tEv.has(j)) { tEv.add(j); viewer.ripple(x, y, 'good'); say(`🔍 단서: ${o.ev[j][4]}`, 'good'); render(); } else say('벌써 짚은 단서예요.'); return; }
      viewer.ripple(x, y, 'bad'); ctx.store.tap(c.id, 'tmiss').catch(e => console.warn(e));
      say('그곳은 이 생각의 단서로 보기 어려워요 — 다른 곳을 짚어 봐요.', 'bad');
    }
    if (t.mode === 'pick' && !thinkDone) {
      const sp = t.spots.find(s => inRect(x, y, s[1], 1));
      tPick = sp ? { label: sp[0], r: sp[1] } : { label: t.other, x, y };
      viewer.ripple(x, y, 'good'); render();
    }
  }
  async function grayTest() {
    const t = c.think, on = !viewer.gray;
    say(on ? '흑백으로 바꾸는 중…' : '');
    await viewer.setGray(on);
    if (on && !tShown) { tShare = { sun: await viewer.lightOf([t.sun]), sky: await viewer.lightOf(t.sky) }; tShown = true; await saveThink(tChoice); }
    if (!alive) return;
    say(on ? '해가 어떻게 보이나요?' : '다시 색으로 봐요 — 해가 또렷해졌어요.', on ? 'good' : '');
    render();
  }
  async function colorTest() {
    const t = c.think;
    viewer.zoomTo(t.region, 6);
    tShare = colorShare(await viewer.sample(t.region));
    await saveThink([...tColors].join(','));
    if (!alive) return;
    say('확대한 곳을 자세히 봐요 — 점마다 색이 달라요.', 'good');
    render();
  }

  // ── ③ 느낌 — 둘까지 · 까닭 하나 · 우리 반 셈 ──
  function renderFeel() {
    const mine = board && board.feel[me];
    const parts = [h('p', { class: 'q' }, '이 그림을 보면 어떤 느낌이 드나요? (둘까지)'),
      h('div', { class: 'chips' }, ...FEELS.map(([k, n]) => h('button', { class: 'wchip' + (fPick.has(k) ? ' on' : ''), 'data-f': k, onclick: () => { if (fPick.has(k)) fPick.delete(k); else { if (fPick.size >= 2) { toast('느낌은 둘까지 골라요'); return; } fPick.add(k); } render(); } }, n))),
      h('p', { class: 'q small' }, '무엇 때문에 그렇게 느꼈나요?'),
      h('div', { class: 'chips' }, ...BECAUSE.map(([k, n]) => h('button', { class: 'wchip' + (fBec === k ? ' on' : ''), 'data-b': k, onclick: () => { fBec = fBec === k ? '' : k; render(); } }, n))),
      h('div', { class: 'go-row' }, h('span', { class: 'sp' }), h('button', { class: 'btn primary', disabled: !fPick.size || !fBec, 'data-act': 'feel', onclick: async () => {
        try { await ctx.store.feel(c.id, [...fPick].join(','), fBec); } catch (e) { console.warn(e); say('저장하지 못했어요 — 인터넷을 확인하고 다시 눌러요', 'bad'); return; }
        await loadBoard(); feelDone = true; unlock(3); say('붙였어요! 친구들은 어떻게 느꼈을까요?', 'good'); render();
      } }, mine ? '느낌 다시 붙이기' : '느낌 붙이기'))];
    if (feelDone || mine) {
      parts.push(h('div', { class: 'tally' }, h('b', {}, '우리 반이 느낀 것'), bars(tally(board.feel, 'f'), k => FEEL_WORD[k] || k, String((mine || {}).f || '').split(',')),
        h('b', { class: 'sub' }, '그렇게 느낀 까닭'), bars(tally(board.feel, 'b'), k => BEC_WORD[k] || k, [(mine || {}).b || '']), guestNote()));
    }
    body.replaceChildren(...parts);
  }

  // ── ④ 질문 — 짚은 곳(이름) + 갈래 → 문장 · 질문판(핀) · 나도 궁금해요 ──
  function askList() {
    if (!board) return [];
    return Object.entries(board.ask || {}).map(([id, q]) => ({ id, ...q })).filter(q => c.parts[q.p] && kindOf(q.k) && isFinite(q.x) && isFinite(q.y))
      .map(q => ({ ...q, likes: Object.keys((board.like || {})[q.id] || {}).length, liked: !!((board.like || {})[q.id] || {})[me] }))
      .sort((a, z) => z.likes - a.likes || a.t - z.t);
  }
  const askMine = () => askList().filter(q => q.s === me);
  function renderAsk() {
    const qs = askList(), mineN = askMine().length;
    const parts = [h('p', { class: 'q' }, '이 그림에서 무엇이 궁금한가요?')];
    if (mineN < MAX_ASK) {
      if (aPart < 0) parts.push(h('p', { class: 'lead' }, `궁금한 사람 · 동물 · 물건을 그림에서 짚어요. (내 질문 ${mineN} / ${MAX_ASK})`));
      else {
        const p = c.parts[aPart];
        parts.push(h('div', { class: 'picked' }, h('span', { class: 'muted small' }, '📍 짚은 곳'), h('b', {}, p.n)),
          h('div', { class: 'qkinds' }, ...kindsFor(p).map(kd => h('button', { class: 'qk' + (aKind === kd.k ? ' on' : ''), 'data-k': kd.k, onclick: () => { aKind = kd.k; render(); } }, h('span', { class: 'lv' }, kd.name), kd.make(p)))),
          h('div', { class: 'go-row' }, h('button', { class: 'btn small', onclick: () => { aPart = -1; aPos = null; aKind = ''; render(); } }, '다시 짚기'), h('span', { class: 'sp' }),
            h('button', { class: 'btn primary', disabled: !aKind, 'data-act': 'ask', onclick: () => postAsk() }, '질문판에 붙이기')));
      }
    } else parts.push(h('p', { class: 'lead' }, `질문 ${MAX_ASK}개를 다 붙였어요. 친구들 질문에 ‘나도 궁금해요’를 눌러 봐요.`));
    parts.push(h('div', { class: 'qboard' }, h('b', {}, `우리 반 질문판 ${qs.length}`),
      qs.length ? h('ol', { class: 'qs' }, ...qs.map((q, i) => h('li', { class: (q.s === me ? 'me ' : '') + (q.id === aSel ? 'on' : ''), onclick: () => { aSel = q.id; viewer.zoomTo([q.x - 8, q.y - 8, q.x + 8, q.y + 8], 2); paint(); render(); } },
        h('span', { class: 'qn' }, String(i + 1)), h('span', { class: 'qt' }, questionText(c, q.k, q.p)),
        h('button', { class: 'like' + (q.liked ? ' on' : ''), title: '나도 궁금해요', disabled: q.s === me, onclick: async e => { e.stopPropagation(); try { await ctx.store.like(c.id, q.id, !q.liked); } catch (er) { console.warn(er); } await loadBoard(); render(); } }, `♥ ${q.likes}`),
        q.s === me ? h('button', { class: 'del', title: '내 질문 지우기', onclick: async e => { e.stopPropagation(); try { await ctx.store.unask(c.id, q.id); } catch (er) { console.warn(er); } await loadBoard(); render(); } }, '✕') : null)))
        : h('p', { class: 'muted small' }, '아직 질문이 없어요 — 첫 질문을 붙여 봐요!'), guestNote()));
    if (mineN > 0 && !(requiredDone() && thinkDone && feelDone)) parts.push(h('p', { class: 'muted small' }, '찾기 · 생각 · 느낌을 마치면 아래에서 사건을 해결할 수 있어요.'));
    body.replaceChildren(...parts);
  }
  function tapAsk({ x, y }) {
    if (askMine().length >= MAX_ASK) { say(`질문은 한 그림에 ${MAX_ASK}개까지예요.`); return; }
    const p = partAt(c, x, y);
    if (p < 0) { viewer.ripple(x, y, 'bad'); say('그곳엔 이름 붙은 것이 없어요 — 사람 · 동물 · 물건을 짚어 봐요.', 'bad'); return; }
    aPart = p; aPos = { x: r1(x), y: r1(y) }; aKind = '';
    viewer.ripple(x, y, 'good'); say(`📍 ${c.parts[p].n} — 어떤 질문을 할까요?`, 'good'); render();
  }
  async function postAsk() {
    if (aPart < 0 || !aKind) return;
    try { await ctx.store.ask(c.id, { k: aKind, p: aPart, x: aPos.x, y: aPos.y }); } catch (e) { console.warn(e); say('붙이지 못했어요 — 인터넷을 확인하고 다시 눌러요', 'bad'); return; }
    aPart = -1; aPos = null; aKind = '';
    await loadBoard(); if (!alive) return;
    say('질문판에 붙였어요! 그림 위 번호를 눌러 친구들 질문도 봐요.', 'good'); render();
  }

  // ── 사건 해결 ──
  async function finish() {
    if (finished) { over.style.display = 'grid'; return; }
    finished = true;
    const st = starsOf(miss, hints);
    try { await ctx.store.solve(c.id, { st, n: miss, h: hints }); } catch (e) { console.warn(e); }
    ctx.onProgress && ctx.onProgress();
    await sleep(300); if (!alive) return;
    over.style.display = 'grid';
    over.replaceChildren(h('div', { class: 'win-card' },
      h('img', { src: HOST, alt: '' }), h('div', { class: 'stars' }, STAR(st)), h('b', {}, '사건 해결!'),
      h('p', { class: 'small muted' }, `헛짚음 ${miss} · 힌트 ${hints}`),
      h('div', { class: 'look' }, h('b', {}, '그림 읽기 한마디'), h('p', {}, c.look)),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => { over.style.display = 'none'; } }, '그림 더 보기'),
        h('button', { class: 'btn primary', onclick: () => ctx.go('#/') }, '다른 그림 →'))));
  }

  goStep(0);
  if (globalThis.location && /[?&]debug=1/.test(location.search)) globalThis.__art = { c, viewer, tap: t => onTap(t), state: () => ({ step, open, miss, hints, thinkDone, feelDone, mine: askMine().length, finished, msg: msg.textContent }) };
  return { unmount() { alive = false; viewer.destroy(); } };
}
