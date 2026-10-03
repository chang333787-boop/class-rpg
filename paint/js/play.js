// 판 화면 — 왼쪽 = 문제(이야기 · 목표 · 그림 · 색 바퀴 · 상자) · 오른쪽 = 답(보기 · 팔레트 · 이 색으로 할래요)
//  틀린 답마다 무엇이 달랐는지(밝기 · 선명함 · 색깔 · 비율 · 예상 · 보색 자리 · 따뜻함 · 진하기 차례)를 센다 → 선생님 헷갈림 지도.
import { h, modal, lsGet, lsSet, toast } from './util.js';
import { mix, hex, WHEEL, complementOf, WARMTH, recipeText, readColor, TUBES } from './color.js';
import { judgeMix, judgeBetween, judgeRung, ladderStars, BINS } from './judge.js';
import { CHAPTERS, stOf, tubesOf, WHY_CHIPS } from './stages.js';
import { makeMixer } from './mixer.js';
import { wheelSvg, compareCard, sceneEl } from './draw.js';
import { mosaicEl } from './feel.js';

export const HOST = '../assets/monsters/m22.png';   // 물방울 젤리 — 물감 연구소 조수(물 + 물감)
const STAR = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hx = d => hex(mix(d));
const jo = (w, a, b) => { const c = String(w).charCodeAt(String(w).length - 1); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? a : b; };   // 받침이 있으면 a(은) · 없으면 b(는)
const starsByWrong = w => (w === 0 ? 3 : w <= 2 ? 2 : 1);
const tubeCss = k => TUBES.find(t => t.k === k).css;
// 섞기 전 팔레트 — 넣은 물감이 아직 따로따로(부채꼴)
const splitBg = drops => { const cols = Object.entries(drops).flatMap(([k, n]) => Array(n).fill(tubeCss(k))), step = 100 / cols.length; return `conic-gradient(${cols.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(',')})`; };
// 1장에서 만든 내 색 → 색 바퀴 칸
export function myWheel(progress, ST) {
  const mine = {};
  for (const s of ST.filter(s => s.ch === 1)) {
    const p = progress[s.id]; if (!p || !p.c) continue;
    if (s.wheel != null && typeof p.c === 'string') mine[s.wheel] = p.c;
    if (s.slots && Array.isArray(p.c)) s.slots.forEach((i, j) => { if (p.c[j]) mine[i] = p.c[j]; });
  }
  return mine;
}
const meterEl = () => {
  const fill = h('span', { class: 'm-fill' }), txt = h('span', { class: 'm-t' }, '가까움 —');
  const el = h('div', { class: 'meter' }, h('div', { class: 'm-bar' }, fill, h('span', { class: 'm-pass', title: '여기 넘으면 통과' })), txt);
  return { el, set(p) { fill.style.width = p + '%'; fill.classList.toggle('pass', p >= 80); txt.textContent = `가까움 ${p}%`; } };
};
const pairShow = (a, b, close) => h('div', { class: 'win-pair' }, h('span', { style: { background: a } }), h('span', { style: { background: b } }), close != null ? h('em', {}, `가까움 ${close}%`) : null);

export function mountStage(root, ctx, s) {
  const ch = CHAPTERS.find(c => c.id === s.ch), list = stOf(s.ch), idx = list.indexOf(s), next = list[idx + 1] || null;
  let wrong = 0, done = false, solved = false, alive = true;
  const msg = h('div', { class: 'msg' });
  const say = (t, kind = '') => { msg.textContent = t; msg.className = 'msg ' + kind; };
  const hintBtn = h('button', { class: 'btn small hint', onclick: () => modal('💡 힌트', h('p', {}, s.hint)) }, '💡 힌트');
  hintBtn.style.display = 'none';
  const over = h('div', { class: 'over' });
  const Q = h('div', { class: 'q-body' }), A = h('div', { class: 'a-body' });
  root.replaceChildren(
    ctx.topBar(`${s.id} · ${s.title}`, { back: '#/', right: [h('span', { class: 'chip c-ch' }, `${ch.id}장 ${ch.title}`)] }),
    h('div', { class: 'pz' },
      h('section', { class: 'q' }, h('div', { class: 'story' }, h('img', { src: HOST, alt: '' }), h('div', {}, h('b', {}, s.title), h('p', {}, s.story))), Q),
      h('section', { class: 'a' }, A, h('div', { class: 'foot-row' }, msg, h('span', { class: 'sp' }), hintBtn)),
      over));

  function miss(mistake) {
    wrong++;
    if (wrong >= 2) hintBtn.style.display = '';
    ctx.store.saveTry(s.id, { ok: false, mistake: mistake || 'etc' }).catch(e => console.warn(e));
  }
  async function finish(text, stars, { c = null, show = null } = {}) {
    if (done) return;
    done = true;
    say('🎉 ' + text, 'good');
    try { await ctx.store.saveTry(s.id, { ok: true, n: wrong, stars, c }); } catch (e) { console.warn(e); }
    ctx.onProgress && ctx.onProgress();
    await sleep(1000);
    if (!alive) return;
    over.style.display = 'grid';
    over.replaceChildren(h('div', { class: 'win-card' },
      h('img', { src: HOST, alt: '' }), h('div', { class: 'stars' }, STAR(stars)), h('b', {}, '해냈어요!'), show, h('p', {}, text),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => { over.style.display = 'none'; } }, '그림 다시 보기'),
        next ? h('button', { class: 'btn primary', onclick: () => ctx.go('#/s/' + next.id) }, '다음 판 →') : h('button', { class: 'btn primary', onclick: () => ctx.go('#/') }, `${s.ch}장 끝! 목록으로`))));
  }
  const put = (el, ...kids) => el.replaceChildren(...kids.flat().filter(Boolean));
  const goBtn = (label, fn) => h('button', { class: 'btn primary go', onclick: fn }, label);

  // ── 섞으면 무슨 색? — 예상 먼저 · 맞히면 팔레트가 실제로 섞인다 ──
  function predict() {
    const well = h('div', { class: 'well' }); well.style.background = splitBg(s.drops);
    const res = h('div', { class: 'qres' }, '?');
    put(Q, h('div', { class: 'stage-row' },
      h('div', { class: 'pv' }, h('div', { class: 'bowl big' }, well), h('div', { class: 'cap c' }, s.dropsLabel || recipeText(s.drops).replace(/ · /g, ' + '))),
      h('div', { class: 'arrow' }, h('b', {}, '→')), res), h('p', { class: 'cap c' }, '섞으면 무슨 색이 될까요? 먼저 예상해요.'));
    const btns = s.opts.map((x, i) => h('button', { class: 'choice sw', 'data-i': i, onclick: () => pick(i) }, h('span', { class: 'swatch', style: { background: hx(x.d) } }), h('b', {}, x.n)));
    put(A, h('p', { class: 'a-q' }, '어떤 색이 될까요?'), h('div', { class: 'choices4' }, ...btns));
    async function pick(i) {
      const b = btns[i];
      if (solved || b.classList.contains('bad')) return;
      if (i !== s.answer) { b.classList.add('bad'); miss('pick'); say(`${s.opts[i].say} 다시 골라 봐요.`, 'bad'); return; }
      solved = true; b.classList.add('ok'); say('섞어 볼게요…');
      well.classList.add('swirl'); await sleep(950);
      well.classList.remove('swirl'); well.style.background = hx(s.drops);
      res.textContent = ''; res.style.background = hx(s.drops); res.classList.add('shown');
      finish(s.why, starsByWrong(wrong));
    }
  }

  // ── 목표 색 만들기(그림 속 빈 곳 · 물감 넉넉히 판도 여기) ──
  function mixStage() {
    const T = hx(s.target.d), tubes = tubesOf(s), meter = meterEl();
    const cmp = compareCard(T, s.target.n), scene = s.scene ? sceneEl(s.scene, s.target.n, T) : null;
    const mixer = makeMixer({ tubes, onChange: () => { const c = mixer.hex(); cmp.set(c); if (scene) scene.paint(c); } });
    put(Q, ...(scene ? [scene.el, h('div', { class: 'cmp-wrap small' }, cmp.el)] : [h('div', { class: 'cmp-wrap' }, cmp.el)]),
      s.min ? h('p', { class: 'need' }, `물감 ${s.min}방울 이상으로`) : null);
    put(A, mixer.el, h('div', { class: 'go-row' }, meter.el, goBtn('이 색으로 할래요', submit)));
    cmp.set(null);
    function submit() {
      if (solved) return;
      const r = judgeMix(s.target.d, mixer.get(), { min: s.min || 0, tubes, misses: wrong });
      if (r.empty) { say(r.say, 'bad'); return; }
      meter.set(r.close);
      if (r.ok) { solved = true; mixer.lock(true); finish(s.why, r.stars, { c: mixer.hex(), show: pairShow(T, mixer.hex(), r.close) }); return; }
      miss(r.kind); say(`${r.say} (가까움 ${r.close}%)`, 'bad');
    }
    return mixer;
  }

  // ── 색 바퀴 빈 칸 — 사이 색(목표는 숨김 · 칠할 칸에 내 색이 미리 보임) ──
  function fillWheel() {
    const mine = myWheel(ctx.progress(), ctx.ST), got = {}, misses = {}, tubes = tubesOf(s);
    let active = s.slots[0];
    const box = h('div', { class: 'wheel-box' }), slotsEl = h('div', { class: 'slot-list' });
    const mixer = makeMixer({ tubes, onChange: () => render() });
    function render() {
      const cols = WHEEL.map(([, d], i) => mine[i] || hx(d));   // 이웃 칸은 늘 보여야 사이 색을 생각한다(1장 기록이 없으면 본래 색)
      for (const i of s.slots) cols[i] = got[i] || (i === active && !solved ? mixer.hex() : null);
      box.replaceChildren(wheelSvg({ colors: cols, size: 320, active: solved ? -1 : active, onPick: i => { if (solved || !s.slots.includes(i)) return; active = i; render(); say(`‘${WHEEL[i][0]}’ 칸 — 양옆 ‘${WHEEL[(i + 11) % 12][0]}’와 ‘${WHEEL[(i + 1) % 12][0]}’ 사이 색을 만들어요`); } }));
      slotsEl.replaceChildren(...s.slots.map(i => h('button', { class: 'slot' + (i === active ? ' on' : '') + (got[i] ? ' done' : ''), 'data-i': i, onclick: () => { if (!solved) { active = i; render(); } } },
        h('span', { class: 'slot-c', style: { background: got[i] || '' } }), h('b', {}, WHEEL[i][0]), h('span', { class: 'muted small' }, got[i] ? '칠했어요' : `${WHEEL[(i + 11) % 12][0]} ↔ ${WHEEL[(i + 1) % 12][0]}`))));
    }
    put(Q, box, h('p', { class: 'cap c' }, '빈 칸을 누르면 그 칸을 칠해요 — 지금 섞는 색이 칸에 미리 보여요'));
    put(A, slotsEl, mixer.el, h('div', { class: 'go-row' }, h('span', { class: 'sp' }), goBtn('이 칸에 칠하기', place)));
    render();
    function place() {
      if (solved) return;
      const r = judgeBetween(active, mixer.get(), { tubes, misses: misses[active] || 0 });
      if (r.empty) { say(r.say, 'bad'); return; }
      if (!r.ok) { misses[active] = (misses[active] || 0) + 1; miss(r.kind); say(`${r.say} (가까움 ${r.close}%)`, 'bad'); return; }
      got[active] = mixer.hex(); got[`st${active}`] = r.stars;
      const left = s.slots.filter(i => !got[i]);
      say(`‘${WHEEL[active][0]}’ 칸을 칠했어요! (가까움 ${r.close}%)` + (left.length ? ` 다음은 ‘${WHEEL[left[0]][0]}’` : ''), 'good');
      if (left.length) { active = left[0]; mixer.clear(); render(); return; }
      solved = true; mixer.lock(true); render();
      const stars = Math.round(s.slots.reduce((a, i) => a + got[`st${i}`], 0) / s.slots.length);
      finish(s.why, stars, { c: s.slots.map(i => got[i]), show: h('div', { class: 'win-wheel' }, wheelSvg({ colors: WHEEL.map(([, d], i) => got[i] || mine[i] || hx(d)), size: 170, labels: false })) });
    }
  }

  // ── 진하기 띠 — 가운데 = 물감 그대로 · 왼쪽으로 연하게 · 오른쪽으로 진하게 ──
  function fillLadder() {
    const base = mix(s.base), slots = [null, null, base, null, null], tubes = tubesOf(s);
    let active = 1;
    const strip = h('div', { class: 'ladder' });
    const mixer = makeMixer({ tubes, onChange: () => render() });
    function render() {
      strip.replaceChildren(...slots.map((c, i) => {
        const preview = i === active && !c && !solved ? mixer.hex() : null, col = c ? hex(c) : preview;
        return h('button', { class: 'rung' + (i === 2 ? ' base' : '') + (i === active && !solved ? ' on' : '') + (col ? '' : ' is-empty') + (preview ? ' pre' : ''), 'data-i': i, disabled: i === 2 || solved, style: { background: col || '' },
          onclick: () => { active = i; render(); } }, h('span', { class: 'rn' }, i === 2 ? '파랑 그대로' : String(i + 1)));
      }));
    }
    put(Q, h('div', { class: 'ladder-wrap' }, strip, h('div', { class: 'ladder-cap' }, h('span', {}, '← 연하게(밝게)'), h('span', {}, '진하게(어둡게) →'))),
      h('p', { class: 'cap c' }, '칸을 누르고 섞어서 칠해요 — 칠한 칸도 다시 누르면 고쳐 칠할 수 있어요'));
    put(A, mixer.el, h('div', { class: 'go-row' }, h('span', { class: 'sp' }), goBtn('이 칸에 칠하기', place)));
    render();
    function place() {
      if (solved) return;
      const r = judgeRung(slots, active, mixer.rgb(), base);
      if (r.empty) { say(r.say, 'bad'); return; }
      if (!r.ok) { miss(r.kind); say(r.say, 'bad'); return; }
      slots[active] = mixer.rgb();
      const left = [0, 1, 3, 4].filter(i => !slots[i]);
      say(`${active + 1}번 칸을 칠했어요!` + (left.length ? ` 남은 칸 ${left.map(i => i + 1).join(' · ')}` : ''), 'good');
      if (left.length) { active = left[0]; mixer.clear(); render(); return; }
      solved = true; mixer.lock(true); render();
      finish(s.why, ladderStars(slots), { c: slots.map(c => hex(c)), show: h('div', { class: 'win-ladder' }, ...slots.map(c => h('span', { style: { background: hex(c) } }))) });
    }
  }

  // ── 보색 자리 — 바퀴에서 마주 보는 칸 누르기 ──
  function wheelPick() {
    const cols = WHEEL.map(([, d]) => hx(d)), found = [];
    let k = 0;
    const box = h('div', { class: 'wheel-box' }), side = h('div', { class: 'pairs' }), ask = h('p', { class: 'a-q' });
    function render() {
      box.replaceChildren(wheelSvg({ colors: cols, size: 330, active: solved ? -1 : s.of[k], mark: found.flat(), lines: found, onPick }));
      ask.textContent = solved ? '보색 짝을 다 찾았어요!' : `‘${WHEEL[s.of[k]][0]}’의 보색은 어디일까요?`;
      side.replaceChildren(...s.of.map((a, j) => h('div', { class: 'pair' + (j < found.length ? ' done' : '') },
        h('span', { class: 'pc', style: { background: cols[a] } }), h('b', {}, WHEEL[a][0]), h('span', {}, '↔'),
        j < found.length ? h('span', { class: 'pc', style: { background: cols[complementOf(a)] } }) : h('span', { class: 'pc q' }, '?'), j < found.length ? h('b', {}, WHEEL[complementOf(a)][0]) : null)));
    }
    function onPick(i) {
      if (solved) return;
      const a = s.of[k], want = complementOf(a);
      if (i === want) {
        found.push([a, i]); k++;
        if (k === s.of.length) { solved = true; render(); finish(s.why, starsByWrong(wrong)); return; }
        render(); say(`맞아요! ${WHEEL[a][0]} ↔ ${WHEEL[i][0]}. 다음은 ‘${WHEEL[s.of[k]][0]}’`, 'good'); return;
      }
      if (i === a) { say('그 칸은 문제의 색이에요 — 바퀴 건너편을 봐요', 'bad'); return; }
      const gap = Math.min(Math.abs(i - a), 12 - Math.abs(i - a));
      miss('wheel');
      say(`그 칸은 ‘${WHEEL[i][0]}’ — ${gap <= 2 ? '이웃한 색이에요' : '정반대가 아니에요'}. 가운데를 지나 똑바로 건너편!`, 'bad');
    }
    put(Q, box);
    put(A, ask, side, h('p', { class: 'muted' }, '보색 = 색 바퀴에서 서로 마주 보는 두 색. 가운데를 지나는 선을 그으면 반대편 끝이에요.'));
    render();
  }

  // ── 가장 또렷한 바탕(보색 대비) ──
  function contrast() {
    const fg = hx(s.fg);
    put(Q, h('div', { class: 'ball-solo' }, h('span', { class: 'ball', style: { background: fg } })), h('p', { class: 'cap c' }, '이 주황 공을 어느 바탕에 둘까요?'));
    const btns = s.opts.map((x, i) => h('button', { class: 'choice bg', 'data-i': i, onclick: () => pick(i) }, h('span', { class: 'bgcard', style: { background: hx(x.d) } }, h('span', { class: 'ball', style: { background: fg } })), h('b', {}, x.n + ' 바탕')));
    put(A, h('p', { class: 'a-q' }, '공이 가장 또렷하게 보이는 바탕은?'), h('div', { class: 'choices4' }, ...btns));
    function pick(i) {
      const b = btns[i];
      if (solved || b.classList.contains('bad')) return;
      if (i === s.answer) { solved = true; b.classList.add('ok'); finish(s.why, starsByWrong(wrong)); return; }
      b.classList.add('bad'); miss('contrast'); say(s.opts[i].say, 'bad');
    }
  }

  // ── 따뜻한 · 차가운 · 그 사이 나누기 ──
  function sortStage() {
    const REASON = { warm: '해 · 불처럼 따뜻한 쪽이에요', cool: '물 · 얼음처럼 차가운 쪽이에요', mid: '따뜻하지도 차갑지도 않은 그 사이 색이에요(중성색)' };
    const placed = { warm: [], cool: [], mid: [] }, left = [...s.items];
    let sel = null;
    const binEls = {}, cards = h('div', { class: 'cards' });
    const bins = h('div', { class: 'bins' }, ...BINS.map(([k, t, sub]) => (binEls[k] = h('button', { class: 'bin', 'data-b': k, onclick: () => drop(k) }, h('b', {}, t), h('span', { class: 'muted small' }, sub), h('div', { class: 'bin-in' })))));
    function render() {
      for (const [k] of BINS) binEls[k].querySelector('.bin-in').replaceChildren(...placed[k].map(i => h('span', { class: 'chipc', style: { background: hx(WHEEL[i][1]) }, title: WHEEL[i][0] })));
      cards.replaceChildren(...left.map(i => h('button', { class: 'ccol' + (sel === i ? ' on' : ''), 'data-i': i, onclick: () => { sel = i; render(); } }, h('span', { class: 'swatch', style: { background: hx(WHEEL[i][1]) } }), h('b', {}, WHEEL[i][0]))));
    }
    function drop(k) {
      if (solved) return;
      if (sel == null) { say('먼저 아래(오른쪽) 색 카드를 골라요', ''); return; }
      const want = WARMTH[sel], name = WHEEL[sel][0];
      if (want !== k) { miss('sort'); binEls[k].classList.remove('bad'); void binEls[k].offsetWidth; binEls[k].classList.add('bad'); say(`‘${name}’${jo(name, '은', '는')} ${REASON[want]}`, 'bad'); return; }
      placed[k].push(sel); left.splice(left.indexOf(sel), 1); sel = null; render();
      if (!left.length) { solved = true; finish(s.why, starsByWrong(wrong)); return; }
      say(`맞아요 — ‘${name}’${jo(name, '은', '는')} ${BINS.find(b => b[0] === k)[1]}`, 'good');
    }
    put(Q, bins);
    put(A, h('p', { class: 'a-q' }, '색 카드를 누르고, 알맞은 상자를 눌러요'), cards);
    render();
  }

  // ── 느낌의 색 — 정답 없음 · 까닭 칩 · 우리 반 모자이크 ──
  async function feel() {
    const mineP = ctx.progress()[s.id];
    const chips = new Set();
    const big = h('div', { class: 'feel-big' }), read = h('p', { class: 'feel-read' }), mos = h('div', { class: 'mos-box' });
    const mixer = makeMixer({ tubes: 'RYBWK', onChange: () => paint() });
    function paint() {
      const c = mixer.hex();
      big.style.background = c || ''; big.classList.toggle('is-empty', !c);
      if (!c) { read.textContent = '물감을 섞어 내 느낌의 색을 만들어요'; return; }
      const r = readColor(mix(mixer.get()));
      read.textContent = `이 색은 — ${[r.light, r.name.startsWith('연한') ? '' : r.vivid, r.name].filter(Boolean).join(' · ')}`;
    }
    const chipBtns = WHY_CHIPS.map(([k, t]) => h('button', { class: 'wchip', 'data-w': k, onclick: e => { if (chips.has(k)) chips.delete(k); else { if (chips.size >= 2) { toast('까닭은 둘까지 골라요'); return; } chips.add(k); } e.currentTarget.classList.toggle('on', chips.has(k)); } }, t));
    async function showMosaic() {
      put(mos, h('p', { class: 'muted' }, '우리 반 모자이크 불러오는 중…'));
      try {
        const { feel, names } = await ctx.store.feelOf(s.id);
        if (!alive) return;
        put(mos, h('b', { class: 'mos-t' }, `우리 반이 만든 ‘${s.title}’`), mosaicEl(feel, names, { me: ctx.store.me.sid }),
          ctx.store.me.guest ? h('p', { class: 'muted small' }, '학급 RPG에서 열면 우리 반 친구들 색이 함께 보여요.') : null);
      } catch (e) { console.warn(e); put(mos, h('p', { class: 'muted' }, '모자이크를 못 불러왔어요 — 잠시 뒤 다시 열어 봐요.')); }
    }
    async function submit() {
      const c = mixer.hex();
      if (!c) { say('물감을 섞어 색을 먼저 만들어요', 'bad'); return; }
      if (!chips.size) { say('이 색을 고른 까닭을 하나 골라요', 'bad'); return; }
      try { await ctx.store.saveFeel(s.id, { c, w: [...chips].join(',') }); } catch (e) { console.warn(e); say('붙이지 못했어요 — 인터넷을 확인하고 다시 눌러요', 'bad'); return; }
      ctx.onProgress && ctx.onProgress();
      done = true;
      say('🎨 우리 반 모자이크에 붙였어요! 친구들은 어떤 색으로 느꼈을까요?', 'good');
      nextRow.style.display = '';
      showMosaic();
    }
    const nextRow = h('div', { class: 'go-row' }, h('span', { class: 'sp' }), next ? h('button', { class: 'btn', onclick: () => ctx.go('#/s/' + next.id) }, '다음 판 →') : h('button', { class: 'btn', onclick: () => ctx.go('#/') }, `${s.ch}장 끝! 목록으로`));
    nextRow.style.display = mineP ? '' : 'none';
    put(Q, h('div', { class: 'feel-l' }, h('div', { class: 'feel-me' }, big, read), mos));
    put(A, mixer.el, h('div', { class: 'why-row' }, h('span', { class: 'muted small' }, '이 색을 고른 까닭(하나나 둘)'), h('div', { class: 'wchips' }, ...chipBtns)),
      h('div', { class: 'go-row' }, h('span', { class: 'sp' }), goBtn(mineP ? '내 색 바꿔 붙이기' : '우리 반 모자이크에 붙이기', submit)), nextRow);
    paint();
    if (mineP) { showMosaic(); say('이미 붙였어요 — 다시 만들어 바꿔 붙여도 돼요.', ''); }
    else put(mos, h('p', { class: 'muted mos-wait' }, '내 색을 붙이면 친구들이 만든 색이 여기 보여요 — 먼저 내 느낌대로!'));
  }

  const RUN = { predict, mix: mixStage, fill: () => (s.layout === 'ladder' ? fillLadder() : fillWheel()), wheel: wheelPick, contrast, sort: sortStage, feel };
  RUN[s.kind]();
  // 장 안내(처음 한 번)
  if (idx === 0 && !lsGet('paint.intro.' + ch.id, false)) { lsSet('paint.intro.' + ch.id, true); modal(`${ch.id}장 · ${ch.title}`, h('div', {}, h('p', {}, ch.intro))); }
  if (globalThis.location && /[?&]debug=1/.test(location.search)) globalThis.__paint = { s, state: () => ({ done, solved, wrong, msg: msg.textContent }) };
  return { unmount() { alive = false; } };
}

// ── 자유 실험실 — 판 없이 마음대로 섞고, 이 색이 어떤 색인지 읽어 준다 ──
export function mountLab(root, ctx) {
  const big = h('div', { class: 'feel-big is-empty' }), read = h('div', { class: 'lab-read' }), wheelBox = h('div', { class: 'lab-wheel' });
  const mixer = makeMixer({ tubes: 'RYBWK', onChange: () => paint() });
  function paint() {
    const c = mixer.hex(); big.style.background = c || ''; big.classList.toggle('is-empty', !c);
    if (!c) { read.replaceChildren(h('p', { class: 'muted' }, '물감 통을 눌러 마음대로 섞어 봐요. 어떤 색이 되는지 읽어 줄게요.')); wheelBox.replaceChildren(wheelSvg({ colors: WHEEL.map(([, d]) => hx(d)), size: 200, labels: false })); return; }
    const r = readColor(mix(mixer.get()));
    read.replaceChildren(
      h('p', {}, h('b', {}, r.name), r.wheel >= 0 ? h('span', { class: 'muted' }, r.name === WHEEL[r.wheel][0] ? ' — 색 바퀴의 이 칸(표시)과 가장 가까워요' : ` — 색 바퀴에서 ‘${WHEEL[r.wheel][0]}’ 칸과 가장 가까워요`) : h('span', { class: 'muted' }, ' — 색깔이 거의 없는 색(무채색)')),
      h('p', {}, '밝기: ', h('b', {}, r.light), r.vivid ? [' · 선명함: ', h('b', {}, r.vivid)] : null, r.warm !== 'none' ? [' · ', h('b', {}, { warm: '따뜻한 색', cool: '차가운 색', mid: '그 사이(중성색)' }[r.warm])] : null),
      h('p', { class: 'muted small' }, recipeText(mixer.get())));
    wheelBox.replaceChildren(wheelSvg({ colors: WHEEL.map(([, d]) => hx(d)), size: 200, labels: false, mark: r.wheel >= 0 ? [r.wheel] : [], center: c }));
  }
  root.replaceChildren(ctx.topBar('자유 실험실', { back: '#/' }),
    h('div', { class: 'pz' },
      h('section', { class: 'q' }, h('div', { class: 'story' }, h('img', { src: HOST, alt: '' }), h('div', {}, h('b', {}, '자유 실험실'), h('p', {}, '정답 없이 마음대로 섞어 봐요. 같은 비율이면 양을 늘려도 같은 색일까? 세 색을 다 섞으면? 실험해 봐요.'))),
        h('div', { class: 'q-body' }, h('div', { class: 'lab-top' }, big, wheelBox), read)),
      h('section', { class: 'a' }, h('div', { class: 'a-body' }, mixer.el))));
  paint();
  return { unmount() {} };
}
