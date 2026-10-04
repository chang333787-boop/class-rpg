// 판 화면 — 왼쪽 = 문제(이야기 · 목표 먹색 · 농담 자 · 꼬리 · 한지) · 오른쪽 = 답(먹물 · 물 · 접시 · 붓 도구 · 할 일)
//  틀린 답마다 무엇이 달랐는지(너무 진함 · 너무 옅음 · 양 · 예상 · 차례 · 먹 없음)를 센다 → 선생님 헷갈림 지도.
import { h, modal, lsGet, lsSet } from './util.js';
import { inkRgb, hex, lightOf, TONES } from './inkcolor.js';
import { judgeMix, judgeCell, chainStars, judgeBrush, readStroke } from './judge.js';
import { CHAPTERS, stOf } from './stages.js';
import { makeDish, POTS } from './dish.js';
import { makeBrush } from './brush.js';

export const HOST = '../assets/monsters/m49.png';   // 숯늑대 — 먹 연구소 조수(먹은 나무를 태운 그을음으로 만든다)
const STAR = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const sleep = ms => new Promise(r => setTimeout(r, ms));
export const hx = d => { const c = d && inkRgb(d.ink, d.water); return c ? hex(c) : null; };
const starsByWrong = w => (w === 0 ? 3 : w <= 2 ? 2 : 1);
// 섞기 전 접시 — 먹물 방울 · 물방울이 아직 따로따로(부채꼴)
const splitBg = d => { const cols = [...Array(d.ink).fill(POTS[0].drop), ...Array(d.water).fill(POTS[1].drop)], step = 100 / cols.length; return `conic-gradient(${cols.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(',')})`; };

// 농담 자 — 진한 먹(왼쪽)부터 종이(오른쪽)까지 눈 밝기(L*) 그대로 늘어놓은 띠 · 먹색 다섯 눈금 · 목표 ▼ · 방금 낸 먹색 ▲
const L0 = 4, L1 = 95, at = L => Math.max(0, Math.min(100, (L - L0) / (L1 - L0) * 100));
const SHORT = { t1: '진한', t2: '조금 진한', t3: '중간', t4: '옅은', paper: '종이' };
export function toneRuler() {
  const tm = h('span', { class: 'tr-m t' }, '▼ 목표'), mm = h('span', { class: 'tr-m m' }, '▲ 방금 낸 먹색');
  const stops = TONES.map(t => `${hx(t)} ${at(lightOf(t.ink, t.water)).toFixed(1)}%`).join(',');
  const el = h('div', { class: 'truler' }, h('div', { class: 'tr-top' }, tm), h('div', { class: 'tr-bar', style: { background: `linear-gradient(90deg, #121417 0%, ${stops}, #f4efe4 100%)` } },
    ...TONES.map(t => h('span', { class: 'tr-tick', style: { left: at(lightOf(t.ink, t.water)) + '%' } }))),
  h('div', { class: 'tr-bot' }, mm), h('div', { class: 'tr-names' }, ...TONES.map(t => h('span', { style: { left: at(lightOf(t.ink, t.water)) + '%' } }, SHORT[t.k]))));
  return {
    el,
    set(T, M) {
      tm.style.display = T == null ? 'none' : ''; if (T != null) tm.style.left = at(T) + '%';
      mm.style.display = M == null ? 'none' : ''; if (M != null) mm.style.left = at(M) + '%';
    },
  };
}
const meterEl = () => {
  const fill = h('span', { class: 'm-fill' }), txt = h('span', { class: 'm-t' }, '가까움 —');
  const el = h('div', { class: 'meter' }, h('div', { class: 'm-bar' }, fill, h('span', { class: 'm-pass', title: '여기 넘으면 통과' })), txt);
  return { el, set(p) { fill.style.width = p + '%'; fill.classList.toggle('pass', p >= 80); txt.textContent = `가까움 ${p}%`; } };
};
function compareCard(T, name) {
  const m = h('div', { class: 'cmp-m is-empty' }, h('span', { class: 'cmp-e' }, '접시에서 섞어요'));
  const el = h('div', { class: 'cmp' }, h('div', { class: 'cmp-row' }, h('div', { class: 'cmp-t', style: { background: T } }), m),
    h('div', { class: 'cmp-lab' }, h('span', {}, `목표 · ${name}`), h('span', {}, '내 먹색')));
  return { el, set(c) { m.style.background = c || ''; m.classList.toggle('is-empty', !c); } };
}
const stripShow = cols => h('div', { class: 'win-ladder' }, ...cols.map(c => h('span', { style: { background: c } })));

export function mountStage(root, ctx, s) {
  const ch = CHAPTERS.find(c => c.id === s.ch), list = stOf(s.ch), idx = list.indexOf(s), next = list[idx + 1] || null;
  let wrong = 0, done = false, solved = false, alive = true, cleanup = null;
  const msg = h('div', { class: 'msg' });
  const say = (t, kind = '') => { msg.textContent = t; msg.className = 'msg ' + kind; };
  const hintBtn = h('button', { class: 'btn small hint', onclick: () => modal('💡 힌트', h('p', {}, s.hint)) }, '💡 힌트');
  hintBtn.style.display = s.kind === 'brush' ? '' : 'none';   // 붓 놀이는 틀림이 없어 힌트를 늘 보여 준다
  const over = h('div', { class: 'over' });
  const Q = h('div', { class: 'q-body' }), A = h('div', { class: 'a-body' });
  root.replaceChildren(
    ctx.topBar(`${s.id} · ${s.title}`, { back: '#/', right: [h('span', { class: 'chip c-ch' }, `${ch.id}장 ${ch.title}`)] }),
    h('div', { class: 'pz' + (s.kind === 'brush' ? ' wide' : '') },
      h('section', { class: 'q' }, h('div', { class: 'story' }, h('img', { src: HOST, alt: '' }), h('div', {}, h('b', {}, s.title), h('p', {}, s.story))), Q),
      h('section', { class: 'a' }, A, h('div', { class: 'foot-row' }, msg, h('span', { class: 'sp' }), hintBtn)),
      over));

  function miss(mistake) {
    wrong++;
    if (wrong >= 2) hintBtn.style.display = '';
    ctx.store.saveTry(s.id, { ok: false, mistake: mistake || 'etc' }).catch(e => console.warn(e));
  }
  //  stars = null → 붓 놀이(별 없이 ✓)
  async function finish(text, stars, { c = null, show = null } = {}) {
    if (done) return;
    done = true;
    say('🎉 ' + text, 'good');
    try { await ctx.store.saveTry(s.id, { ok: true, n: wrong, stars: stars || 0, c }); } catch (e) { console.warn(e); }
    ctx.onProgress && ctx.onProgress();
    await sleep(stars == null ? 600 : 1000);
    if (!alive) return;
    over.style.display = 'grid';
    over.replaceChildren(h('div', { class: 'win-card' },
      h('img', { src: HOST, alt: '' }), h('div', { class: 'stars' }, stars == null ? '✓' : STAR(stars)), h('b', {}, '해냈어요!'), show, h('p', {}, text),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => { over.style.display = 'none'; } }, stars == null ? '더 그리기' : '다시 보기'),
        next ? h('button', { class: 'btn primary', onclick: () => ctx.go('#/s/' + next.id) }, '다음 판 →') : h('button', { class: 'btn primary', onclick: () => ctx.go('#/') }, `${s.ch}장 끝! 목록으로`))));
  }
  const put = (el, ...kids) => el.replaceChildren(...kids.flat().filter(Boolean));
  const goBtn = (label, fn) => h('button', { class: 'btn primary go', onclick: fn }, label);

  // ── 섞으면 어떤 먹색? — 예상 먼저 · 맞히면 접시가 실제로 섞인다 ──
  function predict() {
    const well = h('div', { class: 'well' }); well.style.background = splitBg(s.drops);
    const res = h('div', { class: 'qres' }, '?');
    put(Q, h('div', { class: 'stage-row' },
      h('div', { class: 'pv' }, h('div', { class: 'bowl big' }, well), h('div', { class: 'cap c' }, `먹물 ${s.drops.ink}방울 + 물 ${s.drops.water}방울`)),
      h('div', { class: 'arrow' }, h('b', {}, '→')), res), h('p', { class: 'cap c' }, '섞으면 어떤 먹색이 될까요? 먼저 예상해요.'));
    const btns = s.opts.map((x, i) => h('button', { class: 'choice sw', 'data-i': i, onclick: () => pick(i) }, h('span', { class: 'swatch', style: { background: hx(x.d) } }), h('b', {}, x.n)));
    put(A, h('p', { class: 'a-q' }, '어떤 먹색이 될까요?'), h('div', { class: 'choices4' }, ...btns));
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

  // ── 목표 먹색 만들기 — 농담 자에 목표 ▼ · 낼 때마다 내 먹색 ▲(섞는 동안은 견줌 칸만 — 자는 답을 낸 뒤에 읽는다) ──
  function mixStage() {
    const T = hx(s.target.d), TL = lightOf(s.target.d.ink, s.target.d.water), cmp = compareCard(T, s.target.n), ruler = toneRuler(), meter = meterEl();
    const dish = makeDish({ onChange: () => cmp.set(dish.hex()) });
    put(Q, h('div', { class: 'hanji' }, cmp.el, ruler.el), s.min ? h('p', { class: 'need' }, `먹물 · 물 모두 ${s.min}방울 이상으로`) : null);
    put(A, dish.el, h('div', { class: 'go-row' }, meter.el, goBtn('이 먹색으로 할래요', submit)));
    ruler.set(TL, null);
    function submit() {
      if (solved) return;
      const r = judgeMix(s.target.d, dish.get(), { min: s.min || 0, misses: wrong });
      if (r.empty) { say(r.say, 'bad'); return; }
      meter.set(r.close); ruler.set(TL, r.L);
      if (r.ok) { solved = true; dish.lock(true); finish(s.why, r.stars, { c: dish.hex(), show: stripShow([T, dish.hex()]) }); return; }
      miss(r.kind); say(`${r.say} (가까움 ${r.close}%)`, 'bad');
    }
  }

  // ── 농담 꼬리 잇기 — 첫 칸 진한 먹(주어짐) · 접시를 비우지 않고 물을 더해 가며 한 칸씩 옅게 ──
  function chain() {
    const cells = [{ ink: 1, water: 0 }, ...Array(s.cells - 1).fill(null)];
    let active = 1;
    const strip = h('div', { class: 'ladder chain n' + s.cells });
    const undoBtn = h('button', { class: 'btn small', onclick: () => { if (solved || active <= 1) return; active--; cells[active] = null; say(`${active + 1}번 칸을 지웠어요 — 다시 칠해요`); render(); } }, '↶ 한 칸 지우기');
    const dish = makeDish({ onChange: () => render() });
    function render() {
      strip.replaceChildren(...cells.map((d, i) => {
        const preview = i === active && !d && !solved ? dish.hex() : null, col = d ? hx(d) : preview;
        return h('div', { class: 'rung' + (i === 0 ? ' base' : '') + (i === active && !solved ? ' on' : '') + (col ? '' : ' is-empty') + (preview ? ' pre' : ''), 'data-i': i, style: { background: col || '' } },
          h('span', { class: 'rn' }, i === 0 ? '진한 먹' : String(i + 1)), d && i > 0 ? h('span', { class: 'rr' }, `${d.ink} : ${d.water}`) : null);
      }));
      undoBtn.disabled = solved || active <= 1;
    }
    put(Q, h('div', { class: 'ladder-wrap' }, strip, h('div', { class: 'ladder-cap' }, h('span', {}, '진하게'), h('span', {}, '한 칸마다 더 옅게 →'))),
      h('p', { class: 'cap c' }, '금색 칸에 지금 접시의 먹색이 미리 보여요'));
    put(A, dish.el, h('div', { class: 'go-row' }, undoBtn, h('span', { class: 'sp' }), goBtn('이 칸에 칠하기', place)));
    render();
    function place() {
      if (solved) return;
      const r = judgeCell(cells, active, dish.get());
      if (r.empty) { say(r.say, 'bad'); return; }
      if (!r.ok) { miss(r.kind); say(r.say, 'bad'); return; }
      cells[active] = dish.get();
      if (active < cells.length - 1) { say(`${active + 1}번 칸을 칠했어요! 다음 칸은 더 옅게 — 접시에 물을 더해 봐요`, 'good'); active++; render(); return; }
      solved = true; dish.lock(true); render();
      finish(s.why, chainStars(cells), { c: cells.map(hx), show: stripShow(cells.map(hx)) });
    }
  }

  // ── 붓 놀이 — 한지에 그어 보고, 붓 자국을 읽어 준다(할 일을 다 하면 끝 · 별 없음) ──
  function brushStage() {
    const TOOLS = { dots: ['tone'], lines: ['tone'], dry: ['tone', 'load'], wet: ['tone', 'water'], free: ['tone', 'load', 'water'] }[s.task];
    const strokes = [], paperWrap = h('div', { class: 'paper-wrap' });
    let tone = TONES[0], load = 'full', wet = false;
    const brush = makeBrush(paperWrap, { onStroke: st => { strokes.push(st); say('🖌 ' + readStroke(st), ''); check(); } });
    cleanup = () => brush.destroy();
    const todo = h('ul', { class: 'todo' });
    const seg = (key, opts, get, set) => h('div', { class: 'seg', 'data-seg': key }, ...opts.map(([v, label]) =>
      h('button', { class: 'segb' + (get() === v ? ' on' : ''), 'data-v': String(v), onclick: e => { set(v); e.currentTarget.parentNode.querySelectorAll('.segb').forEach(b => b.classList.toggle('on', b === e.currentTarget)); } }, label)));
    const toneBtns = h('div', { class: 'tones' }, ...TONES.filter(t => t.ink).map(t => h('button', { class: 'tone' + (t === tone ? ' on' : ''), 'data-t': t.k, onclick: e => { tone = t; brush.setTone(t); e.currentTarget.parentNode.querySelectorAll('.tone').forEach(b => b.classList.toggle('on', b === e.currentTarget)); } },
      h('span', { class: 'tone-c', style: { background: hx(t) } }), h('b', {}, t.name), h('span', { class: 'muted small' }, t.water ? `1 : ${t.water}` : '먹만'))));
    put(Q, paperWrap);
    put(A,
      h('p', { class: 'a-q' }, '먹색'), toneBtns,
      TOOLS.includes('load') ? [h('p', { class: 'a-q' }, '붓에 먹을'), seg('load', [['full', '듬뿍 묻히기'], ['dry', '조금 묻히기(마른 붓)']], () => load, v => { load = v; brush.setLoad(v); })] : null,
      TOOLS.includes('water') ? [h('p', { class: 'a-q' }, '붓에 물을'), seg('water', [[false, '적게(또렷하게)'], [true, '많이(번지게)']], () => wet, v => { wet = v; brush.setWet(v); })] : null,
      h('div', { class: 'todo-box' }, h('b', {}, '할 일'), todo),
      h('div', { class: 'go-row' }, h('button', { class: 'btn small', onclick: () => { brush.clear(); say('새 한지를 깔았어요.'); } }, '🧻 새 한지'), h('span', { class: 'sp' }),
        h('span', { class: 'muted small' }, '붓을 누르고 있으면 점이 커져요')));
    function check() {
      const r = judgeBrush(s.task, strokes);
      todo.replaceChildren(...r.parts.map(p => h('li', { class: p.ok ? 'ok' : '' }, h('span', { class: 'tk' }, p.ok ? '✓' : '○'), p.label)));
      if (r.done && !done) { solved = true; finish(s.why, null); }
    }
    check();
  }

  const RUN = { predict, mix: mixStage, chain, brush: brushStage };
  RUN[s.kind]();
  // 장 안내(처음 한 번)
  if (idx === 0 && !lsGet('ink.intro.' + ch.id, false)) { lsSet('ink.intro.' + ch.id, true); modal(`${ch.id}장 · ${ch.title}`, h('div', {}, h('p', {}, ch.intro))); }
  if (globalThis.location && /[?&]debug=1/.test(location.search)) globalThis.__ink = { s, state: () => ({ done, solved, wrong, msg: msg.textContent }) };
  return { unmount() { alive = false; cleanup && cleanup(); } };
}
