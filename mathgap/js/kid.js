// 아이 화면 — 오늘 할 일(탑) · 하는 법 · 탑 살펴보기 · 불 켜기(연습) · 같이 풀기 · 불이 켜짐 · 불 점검 · 오늘 끝
//  흐름 계산은 today.js(시험 있음) — 여기는 그리기와 저장만. 문항마다 저장하므로 창을 닫아도 다음에 같은 문제로 이어진다.
import { h, modal, toast } from './util.js';
import { byId } from './core/lessons/index.js';
import { toHTML } from './core/tokens.js';
import { P as josa } from './core/concepts/kit.js';
import { parseNum } from './core/math.js';
import { towerEl, fire, unitName } from './tower.js';
import {
  todayOf, towerOf, cardOf, dayKey, startScan, finishScan, startFloor, finishFloor, startReview, currentReview, answerReview,
  addTime, addExtra, markLit, pruneDays, currentItem, answer, currentPractice, answerPractice, workedSteps, RULE, exampleOf, noteBug,
} from './today.js';

const html = (s) => { const d = document.createElement('div'); d.innerHTML = s; return [...d.childNodes]; };
const sec = (ms) => Math.max(0, Math.ceil(ms / 1000));
const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export function mountKid(app, ctx) {
  const { store } = ctx;
  let kid = ctx.kid, cfg = ctx.cfg;
  const name = store.me.name;
  let busy = false;

  // ── 저장 ──
  const save = async (full = false) => {
    try { await store.save(kid, { full, day: dayKey(), card: cardOf(kid, cfg) }); }
    catch (e) { console.warn('[mathgap] 저장 실패', e); toast('저장이 늦어지고 있어요 — 인터넷을 확인해 주세요'); }
  };

  // ── 공통 조각 ──
  const bar = (what, { tone = '', right = [] } = {}) => h('div', { class: `kbar ${tone}` },
    h('span', { class: 'now' }, '지금 할 일'), h('span', { class: 'what' }, what),
    h('span', { class: 'right' }, ...right));
  const helpBtn = () => h('button', { class: 'qbtn', 'aria-label': '하는 법 다시 보기', onclick: () => howModal() }, '?');
  const stopBtn = () => h('button', { class: 'stopbtn', onclick: () => askStop() }, '오늘은 그만');
  const screen = (...kids) => { app.replaceChildren(...kids.filter(Boolean)); window.scrollTo(0, 0); };
  const backToRPG = () => {
    try { if (window.parent !== window) window.parent.postMessage({ type: 'rpg:embed-close', app: 'mathgap' }, location.origin); } catch (e) { /* */ }
    toast('위쪽의 ✕ 를 눌러도 RPG 로 돌아가요');
  };
  const T = () => todayOf(kid, cfg);

  // ── 첫 화면: 오늘 할 일과 내 탑 ──
  function home() {
    const t = T();
    if (t.stage === 'none') return screen(bar('선생님이 단원을 고르면 시작해요', { right: [helpBtn()] }),
      h('div', { class: 'kcenter' }, h('div', { class: 'fade-in', style: { maxWidth: '560px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '18px' } },
        h('div', { class: 'big-t' }, '아직 열린 탑이 없어요'), h('p', { class: 'lead' }, '선생님이 지금 배우는 단원을 고르면 그 단원 탑이 생겨요.'),
        h('button', { class: 'kbtn ghost', onclick: backToRPG }, 'RPG로 돌아가기'))));
    if (t.stage === 'intro') return intro();
    const tw = t.tower, hi = name ? `안녕, ${name}!` : '안녕!';
    const next = tw.next, nextLabel = next ? `${next.base ? '기초' : next.no + '층'} ${next.name}` : '';
    const plan = {
      scan: t.resume ? ['어제 살펴보던 데서 이어서 해요', '이어서 살펴보기'] : [`오늘은 ${unitName(cfg.unit)} 탑을 살펴봐요`, '탑 살펴보기 시작'],
      prac: t.resume ? [`${t.run_c || nextLabel}에 불을 켜던 중이에요`, '이어서 불 켜기'] : [`오늘은 ${nextLabel}에 불을 켜요`, '불 켜러 가기'],
      review: t.resume ? ['불 점검을 이어서 해요', '이어서 점검'] : t.warm ? [`먼저 불 점검 ${t.n}문제, 그다음 ${nextLabel}`, '불 점검 시작'] : [`탑 완성! 오늘은 불 점검 ${t.n}문제`, '불 점검 시작'],
      top: ['오늘 수학 끝! 탑이 환해요', null], done: ['오늘 10분 끝! 내일 또 만나요', null], wait: ['남은 층은 선생님이랑 같이 켜요', null],
    }[t.stage] || ['', null];
    if (t.stage === 'prac' && t.resume && kid.run && kid.run.c) plan[0] = `${floorLabel(kid.run.c)}에 불을 켜던 중이에요`;
    const go = () => { if (t.stage === 'scan') return runScan(); if (t.stage === 'prac') return runFloor(); if (t.stage === 'review') return runReview(); };
    const minLeft = Math.ceil(t.left / 60000);
    screen(
      bar(plan[1] ? `'${plan[1]}'${josa(plan[1], '을', '를')} 눌러요` : '오늘은 여기까지예요', { tone: plan[1] ? '' : 'green', right: [h('span', {}, plan[1] ? `오늘 남은 시간 ${minLeft}분` : ''), helpBtn()] }),
      h('div', { class: 'kwrap' },
        h('div', { class: 'kside', style: { flexBasis: '400px' } }, towerEl(tw, { order: tw.scanned })),
        h('div', { class: 'kmain', style: { justifyContent: 'center', gap: '22px', maxWidth: '640px' } },
          h('div', { class: 'big-t fade-in' }, hi, h('br'), h('span', { class: plan[1] ? 'gold' : 'green' }, plan[0])),
          tw.scanned ? h('div', { class: 'pills' }, h('span', { class: 'pill on' }, `불 켜진 층 ${tw.lit}`), tw.total - tw.lit ? h('span', { class: 'pill dk' }, `불 켤 층 ${tw.total - tw.lit}`) : null) : null,
          t.stage === 'prac' && next ? h('div', { class: 'panel lead' }, h('b', {}, nextLabel), h('br'), byId[next.c].hint || '') : null,
          t.stage === 'scan' && !t.resume ? h('div', { class: 'panel lead' }, '층마다 문제가 나와요. 맞았는지는 끝에 탑으로 한꺼번에 보여 줘요. 모르면 ', h('b', {}, "'아직 몰라요'"), '를 눌러도 괜찮아요.') : null,
          t.stage === 'wait' ? h('div', { class: 'panel lead' }, '연습을 많이 했는데 아직 불이 안 켜진 층이 있어요. 선생님께 같이 보자고 말해 주세요!') : null,
          h('div', { class: 'btnrow' },
            plan[1] ? h('button', { class: 'kbtn', onclick: go }, plan[1]) : null,
            t.stage === 'done' ? h('button', { class: 'kbtn ghost', onclick: () => { addExtra(kid); save(); home(); } }, '5분만 더 할래요') : null,
            !plan[1] ? h('button', { class: 'kbtn green', onclick: backToRPG }, 'RPG로 돌아가기') : null))));
  }
  const floorLabel = (c) => { const tw = towerOf(cfg.unit, kid), f = tw.all.find((x) => x.c === c); return f ? `${f.base ? '기초' : f.no + '층'} ${f.name}` : byId[c].kid; };

  // ── 하는 법(처음 한 번 · ? 단추) ──
  function howPanels() {
    const mini = (states) => { const t = h('div', { class: 'tower small', style: { width: '170px' } }); states.forEach((s, i) => t.append(h('div', { class: `fl ${s}` }, h('span', { class: 'no' }, s === 'q' ? '?' : `${i + 1}층`)))); return t; };
    const fires = h('div', { class: 'fires' }, fire(), fire(), fire(), fire('off'), fire('off'));
    return h('div', { class: 'how' },
      h('div', { class: 'pan' }, h('div', { class: 'pic2' }, mini(['q', 'q', 'q', 'q', 'q'])), h('div', { class: 'ttl' }, h('span', { class: 'n' }, '1'), '문제를 풀며 탑을 살펴봐요'),
        h('p', {}, '층마다 문제가 나와요. 모르면 ', h('b', {}, "'아직 몰라요'"), '를 눌러도 괜찮아요.')),
      h('div', { class: 'pan' }, h('div', { class: 'pic2' }, mini(['on', 'dk', 'on', 'dk', 'dk'])), h('div', { class: 'ttl' }, h('span', { class: 'n' }, '2'), '불 꺼진 층이 보여요'),
        h('p', {}, '불 켜진 층은 이미 잘하는 곳, ', h('b', {}, '불 꺼진 층은 더 연습할 곳'), '이에요.')),
      h('div', { class: 'pan' }, h('div', { class: 'pic2', style: { alignItems: 'center' } }, fires), h('div', { class: 'ttl' }, h('span', { class: 'n' }, '3'), `불씨 ${RULE.streak}개면 불이 켜져요`),
        h('p', {}, '시간 안에 맞히면 불씨 하나, 틀리면 하나 꺼져요. 불 꺼진 층부터 ', h('b', {}, '한 층씩'), ' 켜며 올라가요.')));
  }
  function intro() {
    screen(bar("세 가지만 보고 '알겠어요'를 눌러요", { right: [h('span', {}, '처음 한 번만 나와요')] }),
      h('div', { class: 'kwrap', style: { flexDirection: 'column' } },
        h('div', { class: 'big-t' }, '오늘의 수학은 ', h('span', { class: 'gold' }, '탑에 불을 켜는'), ' 놀이예요'),
        howPanels(),
        h('div', { class: 'btnrow', style: { alignItems: 'center' } }, h('span', { class: 'muted', style: { flex: '1', fontSize: '15px' } }, `하루 ${cfg.minutes}분 · 다 못 하면 다음 날 이어서 해요`),
          h('button', { class: 'kbtn', style: { flex: '0 0 auto' }, onclick: () => { kid.seen.intro = Date.now(); save(true); home(); } }, '알겠어요, 시작!'))));
  }
  const howModal = () => modal('오늘의 수학 하는 법', howPanels(), [{ label: '알겠어요', primary: true }], { wide: true });
  function askStop() {
    modal('오늘은 여기까지 할까요?', h('p', {}, '푼 데까지 저장돼요. 다음에 열면 같은 자리에서 이어서 해요.'), [
      { label: '계속 풀기' }, { label: '그만할래요', primary: true, onclick: (close) => { close(); save(true); done(); } }]);
  }

  // ── 문제 그리기(숫자판 · 빈칸 · 보기) ──
  //  onAnswer({ vals, raws } | { idk }) · 보기 문제는 누르면 바로 답
  function problemEl(item, { tag = '', tagR = '', onAnswer, idkLabel = '아직 몰라요', tone = '' }) {
    const math = h('div', { class: 'math', html: toHTML(item.prompt) });
    const msg = h('div', { class: 'msg', role: 'alert' });
    const paper = h('div', { class: 'paper' + (tone ? ' ' + tone : '') }, h('div', { class: 'ptag' }, h('span', {}, tag), h('span', { class: 'r' }, tagR)), math, msg);
    const blanks = [...math.querySelectorAll('.blank')].sort((a, b) => a.dataset.i - b.dataset.i);
    let focused = blanks[0] || null;
    blanks.forEach((b) => { if (COARSE) b.setAttribute('inputmode', 'none'); b.addEventListener('focus', () => { focused = b; }); });
    const submit = (a) => { if (busy) return; onAnswer(a); };
    const okClick = () => {
      const raws = blanks.map((b) => b.value.trim());
      if (raws.some((x) => !x)) { msg.textContent = '빈칸을 모두 채워 주세요. 모르면 아래 단추를 눌러요.'; paper.classList.remove('shake'); void paper.offsetWidth; paper.classList.add('shake'); (blanks.find((b) => !b.value.trim()) || blanks[0]).focus(); return; }
      const vals = raws.map(parseNum);
      if (vals.some((v) => Number.isNaN(v))) { msg.textContent = '숫자로 써 주세요.'; return; }
      submit({ vals, raws });
    };
    blanks.forEach((b, i) => b.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); if (i < blanks.length - 1 && !blanks[i + 1].value) blanks[i + 1].focus(); else okClick(); }
    }));
    let choices = null;
    if (item.choices) {
      choices = h('div', { class: 'choices' }, ...item.choices.map((ch, k) => h('button', { type: 'button', onclick: () => submit({ vals: [k] }) }, h('span', { class: 'math', html: toHTML(ch, { static: true }) }))));
      paper.append(choices);
    }
    const actions = h('div', { class: 'btnrow' },
      h('button', { class: 'kbtn ghost', onclick: () => submit({ idk: true }) }, idkLabel),
      item.choices ? null : h('button', { class: 'kbtn' + (tone === 'blue' ? ' blue' : ''), onclick: okClick }, '확인'));
    const press = (k) => {
      if (!focused) return;
      if (k === 'del') focused.value = focused.value.slice(0, -1);
      else if (k === 'next') { const i = blanks.indexOf(focused); if (i < blanks.length - 1) blanks[i + 1].focus(); else okClick(); return; }
      else if (focused.value.length < 8) focused.value += k;
      focused.dispatchEvent(new Event('input', { bubbles: true }));
      if (!COARSE) focused.focus();
    };
    const pad = item.choices ? null : h('div', { class: 'kpad' },
      h('div', { class: 'keys' }, ...['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0'].map((k) => h('button', { class: 'key', type: 'button', onmousedown: (e) => e.preventDefault(), onclick: () => press(k) }, k)),
        h('button', { class: 'key sm', type: 'button', 'aria-label': '지우기', onmousedown: (e) => e.preventDefault(), onclick: () => press('del') }, '지우기'),
        h('button', { class: 'key sm wide', type: 'button', onmousedown: (e) => e.preventDefault(), onclick: () => press('next') }, blanks.length > 1 ? '다음 칸 →' : '확인')),
      h('div', { class: 'padnote' }, '키보드로 써도 돼요', h('br'), blanks.length > 1 ? 'Tab = 다음 칸 · Enter = 확인' : 'Enter = 확인'));
    // 빈칸 너비 — 긴 답이면 넓게
    blanks.forEach((b) => b.addEventListener('input', () => b.classList.toggle('wide', b.value.length > 2)));
    return { paper, actions, pad, math, msg, focus: () => { if (focused && !COARSE) focused.focus(); } };
  }

  // ── 탑 살펴보기 ──
  async function runScan() {
    if (!kid.run || kid.run.kind !== 'scan' || kid.run.unit !== cfg.unit) { startScan(kid, cfg.unit, 'scan-' + Date.now()); await save(); }
    scanItem();
  }
  function scanItem() {
    const S = kid.run.S, q = currentItem(S);
    if (!q) return scanEnd();
    const tw = towerOf(cfg.unit, kid), inUnit = tw.floors.some((f) => f.c === q.c);
    const seen = new Set(S.log.map((l) => l.c));
    const n = S.log.length, est = Math.max(12, n + 2);
    const prog = h('span', { class: 'prog', 'aria-label': `${n + 1}번째 문제` }, ...Array.from({ length: Math.min(est, 14) }, (_, i) => h('i', { class: i < n ? 'on' : i === n ? 'cur' : '' })));
    const shown = performance.now();
    const P = problemEl(q.item, {
      tag: inUnit ? `${tw.floors.find((f) => f.c === q.c).no}층 · ${byId[q.c].kid}` : `기초 살펴보기 · ${byId[q.c].kid}`,
      onAnswer: async (a) => {
        busy = true;
        const ms = Math.round(performance.now() - shown);
        if (!a.idk) { const r = q.item.check(a.vals || [], a.raws || []); if (!r.ok) noteBug(kid, q.c, r.bug); }
        answer(S, { ...a, ms, t: Date.now() }); addTime(kid, ms);
        await save();
        busy = false;
        if (S.done) return scanEnd();
        if (T().day.ms >= T().budget) return done();
        // 담담하게 다음으로 — 맞고 틀림은 끝에 탑으로
        app.querySelector('.paper')?.classList.add('fade-out');
        scanItem();
      },
    });
    const side = h('div', { class: 'kside hide-n' }, h('div', { class: 'mid-t', style: { fontSize: '19px', color: '#d9c9ae' } }, `${unitName(cfg.unit)} 탑`),
      towerEl({ ...tw, base: inUnit ? [] : [{ c: q.c, name: byId[q.c].kid, st: 'q', base: true }] }, { cur: q.c, seen, small: false, title: false }),
      h('div', { class: 'padnote' }, '맞았는지는 끝에 탑으로 한꺼번에 보여 줘요.'));
    screen(bar('문제를 풀어 탑을 살펴봐요', { right: [prog, helpBtn(), stopBtn()] }),
      h('div', { class: 'kwrap' }, side, h('div', { class: 'kmain fade-in' }, P.paper, P.actions), P.pad));
    P.focus();
  }
  async function scanEnd() {
    const before = towerOf(cfg.unit, kid);
    const tw = finishScan(kid, cfg.unit, kid.run.S);
    await save(true);
    const t = T(), canGo = t.stage === 'prac', allLit = tw.lit === tw.total;
    screen(bar(allLit ? '탑이 다 켜져 있어요!' : canGo ? "내 탑을 보고 '불 켜러 가기'를 눌러요" : '오늘은 여기까지 — 내일 이어서 불을 켜요', { tone: allLit || !canGo ? 'green' : '', right: [h('span', {}, canGo ? `오늘 남은 시간 ${Math.ceil(t.left / 60000)}분` : '')] }),
      h('div', { class: 'kwrap', style: { gap: '48px' } },
        h('div', { class: 'kside', style: { flexBasis: '430px' } }, towerEl(tw, { order: true, reveal: true })),
        h('div', { class: 'kmain', style: { justifyContent: 'center', gap: '20px', maxWidth: '620px' } },
          h('div', { class: 'big-t fade-in' }, '살펴보기 끝!', h('br'), h('span', { class: 'gold' }, allLit ? '와, 탑에 불이 다 켜져 있어요' : tw.lit ? `벌써 ${tw.lit}층이나 불이 켜져 있어요` : '이제 아래부터 불을 켜 봐요')),
          h('div', { class: 'pills' }, h('span', { class: 'pill on' }, `불 켜진 층 ${tw.lit}`), tw.total - tw.lit ? h('span', { class: 'pill dk' }, `불 켤 층 ${tw.total - tw.lit}`) : null),
          allLit ? h('div', { class: 'panel lead' }, '이제는 점검할 날이 오면 몇 문제로 불이 잘 켜져 있는지만 봐요.')
            : h('div', { class: 'panel lead' }, '숫자 순서대로 불을 켜요. ', tw.base.length ? h('b', {}, "맨 아래 '기초'부터") : h('b', {}, '아래층부터'), ' — 아래층이 밝아야 위층 불도 잘 켜져요.'),
          h('div', { class: 'btnrow' },
            canGo ? h('button', { class: 'kbtn ghost', onclick: () => done() }, '내일 할래요') : null,
            canGo ? h('button', { class: 'kbtn', onclick: () => runFloor() }, h('span', { class: 'no' }, '1'), `${tw.next.base ? '기초' : tw.next.no + '층'}에 불 켜러 가기`)
              : h('button', { class: 'kbtn green', onclick: () => done() }, '오늘 끝')))));
    void before;
  }

  // ── 한 층 불 켜기 ──
  let tick = null;
  const stopTick = () => { if (tick) { clearInterval(tick); tick = null; } };
  async function runFloor() {
    const t = T();
    if (!kid.run || kid.run.kind !== 'prac' || kid.run.unit !== cfg.unit) {
      if (t.stage !== 'prac') return home();
      startFloor(kid, cfg.unit, t.floor.c, 'f-' + Date.now()); await save();
      return floorIntro();
    }
    pracItem();
  }
  function floorIntro() {
    const c = kid.run.c, L = byId[c], tw = towerOf(cfg.unit, kid);
    screen(bar(`${floorLabel(c)}에 불을 켜요`, { right: [helpBtn()] }),
      h('div', { class: 'kwrap', style: { gap: '48px' } },
        h('div', { class: 'kside', style: { flexBasis: '380px' } }, towerEl(tw, { cur: c })),
        h('div', { class: 'kmain', style: { justifyContent: 'center', gap: '20px', maxWidth: '600px' } },
          h('div', { class: 'big-t fade-in' }, floorLabel(c)),
          L.hint ? h('div', { class: 'panel lead' }, h('b', {}, '이렇게 해요 · '), L.hint) : null,
          exampleEl(c),
          h('div', { class: 'fires', style: { justifyContent: 'flex-start' } }, ...Array.from({ length: RULE.streak }, () => fire('off'))),
          h('p', { class: 'lead' }, `${limitText(c)} 안에 맞히면 불씨 하나 · ${RULE.streak}개 모으면 불이 켜져요. 틀리면 불씨 하나가 꺼지고 같이 풀어 봐요.`),
          h('div', { class: 'btnrow' }, h('button', { class: 'kbtn', onclick: () => pracItem() }, '시작')))));
  }
  // 예제 — 같은 단계로 푼 문제 하나(Math Academy · ALEKS 의 '예제 먼저'). 단계가 없는 차시는 문제와 답만
  function exampleEl(c) {
    let ex; try { ex = exampleOf(c, (kid.run && kid.run.P ? kid.run.P.id : c).length * 97 + 5); } catch (e) { return null; }
    const ans = (it) => h('div', { class: 'math', style: { fontSize: '26px', color: '#f3e8d6', justifyContent: 'flex-start' }, html: toHTML(it.prompt, { static: true, vals: it.sol.map(String) }) });
    return h('div', { class: 'panel', style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
      h('div', { style: { fontSize: '14px', fontWeight: '800', color: '#7cc0f0' } }, '예제 — 이렇게 풀어요'),
      ...ex.steps.map((s, i) => h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' } },
        h('span', { style: { fontSize: '14px', color: '#d9c9ae', minWidth: '0', flex: '1 1 180px' } }, `${i + 1}. ${s.why}`), ans(s.item))),
      h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', borderTop: ex.steps.length ? '1px solid #3d3024' : '0', paddingTop: ex.steps.length ? '8px' : '0' } },
        h('span', { style: { fontSize: '14px', color: '#ffc766', fontWeight: '700' } }, ex.steps.length ? '그래서' : '예'), ans(ex.item)));
  }
  const limitText = (c) => `${Math.round(byId[c].sec * RULE.fastX)}초`;
  function flamesEl(n, { pop = -1, gone = -1 } = {}) {
    return h('div', { class: 'fires', role: 'img', 'aria-label': `불씨 ${RULE.streak}개 중 ${n}개` },
      ...Array.from({ length: RULE.streak }, (_, i) => { const f = i < n ? fire('on') : i === gone ? fire('gone') : fire('off'); if (i === pop) f.classList.add('pop'); return f; }));
  }
  function ringEl(limit) {
    const C = 2 * Math.PI * 82;
    const wrap = h('div', { class: 'ring' });
    wrap.innerHTML = `<svg width="190" height="190" viewBox="0 0 190 190" aria-hidden="true"><circle cx="95" cy="95" r="82" fill="#1f1812" stroke="#3d3024" stroke-width="14"/><circle class="arc" cx="95" cy="95" r="82" fill="none" stroke="#f2a93b" stroke-width="14" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="0" transform="rotate(-90 95 95)"/></svg>`;
    const num = h('div', { class: 'num' }, h('b', {}, String(limit)), h('span', {}, '초 남았어요'));
    wrap.append(num);
    const t0 = performance.now(), arc = wrap.querySelector('.arc');
    const upd = () => {
      const left = limit * 1000 - (performance.now() - t0);
      if (left <= 0) { wrap.classList.add('over'); num.firstChild.textContent = '시간 지남'; num.lastChild.textContent = '그래도 풀 수 있어요'; arc.style.strokeDashoffset = String(C); arc.style.stroke = '#6b5640'; stopTick(); return; }
      num.firstChild.textContent = String(sec(left)); wrap.classList.toggle('low', left <= 3000);
      arc.style.strokeDashoffset = String(C * (1 - left / (limit * 1000)));
    };
    stopTick(); tick = setInterval(upd, 200); setTimeout(upd, 30);
    return wrap;
  }
  function pracItem(extra = {}) {
    const P = kid.run.P, q = currentPractice(P);
    if (!q) return floorEnd();
    const c = q.c, tw = towerOf(cfg.unit, kid);
    const shown = performance.now();
    const pe = problemEl(q.item, {
      tag: floorLabel(c), tagR: `${q.n}번째 문제`, idkLabel: '모르겠어요',
      onAnswer: async (a) => {
        busy = true; stopTick();
        const ms = Math.round(performance.now() - shown);
        const fb = answerPractice(P, { ...a, ms, t: Date.now() }); addTime(kid, ms);
        if (!fb.ok && !a.idk) noteBug(kid, q.c, fb.bug);
        await save();
        busy = false;
        if (P.done) return floorEnd(fb);
        if (!fb.ok) return helpScreen(q, a, fb, flamesBefore);
        if (T().day.ms >= T().budget) return okFlash(fb, flamesBefore, () => done());
        okFlash(fb, flamesBefore, () => pracItem());
      },
    });
    const flamesBefore = q.streak;
    const side = h('div', { class: 'kside timer', style: { alignItems: 'center', gap: '16px' } }, ringEl(q.limit),
      flamesEl(q.streak, extra), h('div', { class: 'fcount' }, `불씨 ${q.streak} / ${RULE.streak}`),
      h('div', { style: { marginTop: 'auto', width: '100%' } }, towerEl(tw, { cur: c, small: true, title: false })));
    screen(bar(`시간 안에 맞히면 불씨 하나 · ${RULE.streak}개 모으면 이 층에 불이 켜져요`, { right: [helpBtn(), stopBtn()] }),
      h('div', { class: 'kwrap' }, side, h('div', { class: 'kmain fade-in' }, pe.paper, pe.actions), pe.pad));
    pe.focus();
  }
  // 맞았을 때 — 잠깐 보여 주고 다음 문제(불씨가 생기면 반짝)
  function okFlash(fb, before, next) {
    const main = app.querySelector('.kmain');
    const band = fb.fast ? h('div', { class: 'fb ok fade-in' }, fire('on', '#ffc766'), `맞았어요! 불씨 하나 (${fb.dots} / ${RULE.streak})`)
      : h('div', { class: 'fb late fade-in' }, `맞았어요! ${fb.limit}초가 지나서 불씨는 그대로예요. 다음엔 시간 안에!`);
    if (main) main.prepend(band);
    const fl = app.querySelector('.kside .fires'); if (fl && fb.fast) fl.replaceWith(flamesEl(fb.dots, { pop: fb.dots - 1 }));
    app.querySelectorAll('.kmain button, .kpad button').forEach((b) => { b.disabled = true; });
    setTimeout(next, fb.fast ? 900 : 1700);
  }

  // ── 같이 풀기(틀렸을 때) — 같은 숫자로 한 단계씩, 시간 재지 않음 ──
  function helpScreen(q, a, fb, before) {
    const steps = workedSteps(q.c, q.p);
    let k = 0;
    const after = Math.max(0, before - 1);
    const mineEl = a.idk ? h('span', { class: 'mine' }, '모르겠어요') : h('span', { class: 'mine' }, h('span', { class: 'math', style: { fontSize: '30px', color: '#8a5a20' }, html: toHTML(answerOnly(q.item.prompt), { static: true, vals: a.vals || [] }) }), '내 답');
    const left = h('div', { class: 'kside', style: { flexBasis: '360px', gap: '16px' } },
      h('div', { class: 'mid-t' }, a.idk ? '괜찮아요!' : '아까워요!', h('br'), h('span', { class: 'blue' }, '같이 한 번 풀어 볼까요?')),
      h('div', { class: 'paper', style: { flex: 'none', minHeight: '0', padding: '44px 18px 18px', gap: '12px' } }, h('div', { class: 'ptag' }, h('span', {}, '아까 문제')),
        h('div', { class: 'math', style: { fontSize: '30px' }, html: toHTML(q.item.prompt, { static: true, vals: [] }) }), mineEl,
        fb.bug && fb.bug.name ? h('div', { class: 'msg', style: { color: '#5d4a36', fontWeight: '500' } }, `혹시 — ${fb.bug.name}?`) : null,
        bugHint(fb.bug, q.c)),
      h('div', { class: 'panel', style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px', marginTop: 'auto' } },
        flamesEl(after, { gone: before > 0 ? after : -1 }),
        h('div', { style: { fontSize: '14px', lineHeight: '1.5', color: '#d9c9ae' } }, before > 0 ? `불씨가 하나만 꺼졌어요 (${before} → ${after}).` : '불씨는 0개 그대로예요.', h('br'), '방법을 알았으니 금방 다시 모여요!')));
    const list = h('div', { class: 'steps' });
    const right = h('div', { class: 'kmain', style: { gap: '14px' } }, list);
    const padBox = h('div', { class: 'kpad', style: { flexBasis: '220px' } });
    screen(bar('같은 숫자로 한 단계씩 같이 풀어 봐요', { tone: 'blue', right: [h('span', {}, '여기선 시간을 재지 않아요')] }), h('div', { class: 'kwrap' }, left, right, padBox));
    const finish = () => {
      padBox.remove();
      right.querySelectorAll('.btnrow').forEach((x) => x.remove());
      list.append(h('div', { class: 'step done fade-in' }, h('span', { class: 'sn' }, '✓'), h('div', { class: 'why' }, '그래서 답은'), h('div', { class: 'math', style: { color: '#f3e8d6' }, html: toHTML(q.item.prompt, { static: true, vals: q.item.sol.map(String) }) })));
      right.append(h('div', { class: 'btnrow fade-in', style: { marginTop: 'auto' } }, h('button', { class: 'kbtn blue', onclick: () => { if (T().day.ms >= T().budget) done(); else pracItem(); } }, '새 문제로 다시 해 볼게요')));
      right.querySelector('.kbtn').focus();
    };
    if (!steps.length) { list.append(h('div', { class: 'panel lead' }, byId[q.c].hint || '')); return finish(); }
    const drawStep = () => {
      list.replaceChildren(...steps.map((s, i) => {
        if (i < k) return h('div', { class: 'step done' }, h('span', { class: 'sn' }, '✓'), h('div', { class: 'why' }, s.why), h('div', { class: 'math', html: toHTML(s.item.prompt, { static: true, vals: s.sol.map(String) }) }));
        if (i > k) return h('div', { class: 'step wait' }, h('span', { class: 'sn' }, String(i + 1)), h('div', { class: 'why' }, s.why));
        return null;
      }).filter(Boolean));
      if (k >= steps.length) return finish();
      const s = steps[k];
      const pe = problemEl(s.item, { tone: 'blue', idkLabel: '모르겠어요 — 알려 줘요', onAnswer: (ans) => {
        const r = ans.idk ? { ok: false } : s.item.check(ans.vals || [], ans.raws || []);
        if (r.ok) { k++; return drawStep(); }
        tries++;
        if (ans.idk || tries >= 2) { toast('이렇게 돼요 — 보고 다음 단계로'); k++; tries = 0; return drawStep(); }
        pe.msg.textContent = '한 번 더 생각해 봐요';
      } });
      pe.msg.style.flexBasis = '100%';
      const now = h('div', { class: 'step now fade-in' }, h('span', { class: 'sn' }, String(k + 1)), h('div', { class: 'why' }, s.why), pe.math, pe.msg);
      list.insertBefore(now, list.children[k] || null);
      const acts = pe.actions; acts.style.marginTop = '4px';
      right.querySelectorAll('.btnrow').forEach((x) => x.remove());
      right.append(acts);
      padBox.replaceChildren(...(pe.pad ? pe.pad.childNodes : []));
      pe.focus();
    };
    let tries = 0;
    drawStep();
  }
  // 그 실수가 가리키는 차시의 생각 한 줄 — '이건 ○○에서 배운 생각이에요'
  function bugHint(bug, c) {
    const to = bug && bug.to ? [].concat(bug.to).find((x) => byId[x] && x !== c && byId[x].hint) : null;
    if (!to) return null;
    const hint = byId[to].hint.length > 90 ? byId[to].hint.slice(0, 88) + '…' : byId[to].hint;
    return h('div', { style: { fontSize: '14px', lineHeight: '1.55', color: '#5d4a36', background: '#efe4cf', borderRadius: '10px', padding: '8px 10px' } }, h('b', {}, `'${byId[to].kid}'에서 배운 생각이에요 · `), hint);
  }
  // 답 칸만 보여 줄 때(내 답) — 문제 글에서 빈칸이 든 마지막 덩어리만
  const answerOnly = (prompt) => { const i = prompt.findIndex((t) => t && typeof t === 'object' && ('b' in t || (t.f && t.f.some((x) => x && typeof x === 'object')) || (t.m && t.m.some((x) => x && typeof x === 'object')))); return i >= 0 ? prompt.slice(i).filter((t) => typeof t === 'object' || /\S/.test(t)).slice(0, 4) : prompt; };

  // ── 한 층이 끝남(켜짐 · 선생님과) ──
  async function floorEnd() {
    stopTick();
    const P = kid.run.P, c = P.plan[0];
    const r = finishFloor(kid, P);
    if (r.lit) markLit(kid, c);
    await save(true);
    const tw = towerOf(cfg.unit, kid), t = T(), more = t.stage === 'prac';
    const nextL = tw.next ? floorLabel(tw.next.c) : '';
    if (r.teacher) {
      return screen(bar('이 층은 선생님이랑 같이 켜요', { tone: 'blue' }),
        h('div', { class: 'kwrap', style: { gap: '48px' } }, h('div', { class: 'kside', style: { flexBasis: '380px' } }, towerEl(tw, { order: true })),
          h('div', { class: 'kmain', style: { justifyContent: 'center', gap: '18px', maxWidth: '600px' } },
            h('div', { class: 'big-t' }, '열심히 했어요!', h('br'), h('span', { class: 'blue' }, `${floorLabel(c)}은 선생님이랑 같이 켜요`)),
            h('p', { class: 'lead' }, '여러 번 풀어 봤는데 아직 불이 안 켜졌어요. 선생님이 알 수 있게 표시해 둘게요.'),
            h('div', { class: 'btnrow' }, more ? h('button', { class: 'kbtn', onclick: () => runFloor() }, `다음: ${nextL}`) : h('button', { class: 'kbtn green', onclick: () => done() }, '오늘 끝')))));
    }
    const all = tw.lit === tw.total;
    screen(bar(all ? '탑 꼭대기까지 불이 켜졌어요!' : more ? '다음 층으로 올라가요' : '오늘은 여기까지 — 내일 다음 층으로', { tone: all || !more ? 'green' : '', right: [h('span', {}, more ? `오늘 남은 시간 ${Math.ceil(t.left / 60000)}분` : '')] }),
      h('div', { class: 'kwrap', style: { gap: '56px', alignItems: 'center' } },
        h('div', { class: 'kside', style: { flexBasis: '380px' } }, towerEl(tw, { justLit: c, order: !all })),
        h('div', { class: 'kmain', style: { justifyContent: 'center', gap: '20px', maxWidth: '600px' } },
          fire('on', '#ffc766', 'fire big-fire'),
          h('div', { class: 'big-t fade-in' }, `${floorLabel(c).split(' ')[0]}에`, h('br'), h('span', { class: 'gold2' }, '불이 켜졌어요!')),
          h('p', { class: 'lead' }, r.slow ? '시간이 좀 걸렸지만 끝까지 맞혔어요. 다음엔 조금 더 빠르게!' : `불씨 ${RULE.streak}개를 다 모았어요.`, all ? ' 이제 탑이 다 환해요!' : tw.next ? [h('br'), '다음은 ', h('b', {}, nextL), '예요.'] : ''),
          h('div', { class: 'btnrow' },
            more ? h('button', { class: 'kbtn ghost', onclick: () => done() }, '오늘은 여기까지') : null,
            more ? h('button', { class: 'kbtn', onclick: () => runFloor() }, `${nextL.split(' ')[0]} 불 켜러 가기`) : h('button', { class: 'kbtn green', onclick: () => done() }, all ? '탑 완성!' : '오늘 끝')))));
    const bf = app.querySelector('.big-fire'); if (bf) { bf.style.width = '78px'; bf.style.height = '78px'; }
  }

  // ── 불 점검(점검 날이 된 켠 층 · 연습하는 날 2문제 · 탑 완성 뒤 3문제) ──
  async function runReview() {
    if (!kid.run || kid.run.kind !== 'review') { startReview(kid, cfg.unit, 'rv-' + Date.now()); await save(); }
    reviewItem();
  }
  function reviewItem(note = null) {
    const R = kid.run && kid.run.R, q = R && currentReview(R);
    if (!q) return done();
    const shown = performance.now(), i = R.out.length;
    const N = R.total || 3;
    const pe = problemEl(q.item, { tag: `불 점검 · ${floorLabel(q.c)}`, tagR: `${Math.min(i + 1, N)} / ${N}`, idkLabel: '모르겠어요', onAnswer: async (a) => {
      busy = true;
      const ms = Math.round(performance.now() - shown);
      const fb = answerReview(kid, R, a); addTime(kid, ms);
      await save(!!fb.done);
      busy = false;
      const msg = fb.ok ? '맞았어요! 불이 잘 켜져 있어요.' : fb.again ? '아까워요 — 같은 층 문제를 하나 더 볼게요.' : `이 층 불이 꺼졌어요. 다음에 다시 켜요. (답: ${fb.ans})`;
      if (fb.done) return reviewDone(fb.out);
      reviewItem(msg);
    } });
    screen(bar(`예전에 켠 층이 아직 잘 켜져 있는지 ${N}문제로 확인해요`, { right: [helpBtn()] }),
      h('div', { class: 'kwrap' }, h('div', { class: 'kside hide-n' }, towerEl(towerOf(cfg.unit, kid), { cur: q.c, small: true })),
        h('div', { class: 'kmain fade-in' }, note ? h('div', { class: 'fb ' + (note.startsWith('맞') ? 'ok' : 'no') }, note) : null, pe.paper, pe.actions), pe.pad));
    pe.focus();
  }
  function reviewDone(out) {
    const off = out.filter((x) => !x.ok).map((x) => floorLabel(x.c));
    const t = T(), more = t.stage === 'prac';
    const nextL = more ? floorLabel(t.floor.c) : '';
    screen(bar(more ? `이제 '${nextL.split(' ')[0]} 불 켜러 가기'를 눌러요` : off.length ? '꺼진 층은 다음에 다시 켜요' : '불 점검 끝!', { tone: more ? '' : 'green' }),
      h('div', { class: 'kcenter' }, h('div', { class: 'fade-in', style: { display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '620px' } },
        h('div', { class: 'big-t' }, off.length ? '불 점검 끝!' : '불이 다 잘 켜져 있어요!'),
        off.length ? h('p', { class: 'lead' }, h('b', {}, off.join(', ')), more ? ' 불이 꺼졌어요. 아래층부터 다시 켜요.' : ' 불이 꺼졌어요. 다음 시간에 다시 켜요.')
          : h('p', { class: 'lead' }, more ? '좋아요. 이제 오늘 켤 층으로 가요.' : '오늘 수학 끝. 다음에 또 확인해요.'),
        h('div', { class: 'btnrow' }, more ? h('button', { class: 'kbtn', onclick: () => runFloor() }, `${nextL.split(' ')[0]} 불 켜러 가기`) : h('button', { class: 'kbtn green', onclick: () => done() }, '오늘 끝')))));
  }

  // ── 오늘 끝 ──
  function done() {
    stopTick();
    pruneDays(kid); save(true);
    const t = T(), tw = t.tower, d = t.day;
    const lit = (d.lit || []).map(floorLabel);
    const next = tw.next ? floorLabel(tw.next.c) : null;
    const tags = Object.fromEntries((d.lit || []).map((c) => [c, '오늘 켬']));
    if (tw.next) tags[tw.next.c] = tags[tw.next.c] || '다음';
    screen(bar('오늘은 끝! RPG로 돌아가요', { tone: 'green' }),
      h('div', { class: 'kwrap', style: { gap: '56px', alignItems: 'center' } },
        h('div', { class: 'kmain', style: { justifyContent: 'center', gap: '22px', maxWidth: '620px' } },
          h('div', { class: 'big-t fade-in' }, '오늘 수학 ', h('span', { class: 'green' }, '끝!')),
          h('div', { class: 'panel', style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
            h('div', { class: 'muted', style: { fontSize: '14px', fontWeight: '700' } }, `오늘 한 일 · ${Math.max(1, Math.round(d.ms / 60000))}분 · ${d.n}문제`),
            kid.scans[cfg.unit] && dayKey(kid.scans[cfg.unit].t) === dayKey() ? h('div', { class: 'check' }, h('span', { class: 'ck' }, '✓'), '탑을 끝까지 살펴봤어요') : null,
            ...lit.map((x) => h('div', { class: 'check' }, h('span', { class: 'ck' }, '✓'), `${x}에 불을 켰어요`)),
            d.review ? h('div', { class: 'check' }, h('span', { class: 'ck' }, '✓'), '불 점검을 했어요') : null,
            kid.run && kid.run.kind === 'prac' ? h('div', { class: 'check muted' }, h('span', { class: 'ck no' }), `${floorLabel(kid.run.c)}은 불씨 ${currentPractice(kid.run.P) ? currentPractice(kid.run.P).streak : 0}개까지 모았어요`) : null,
            kid.run && kid.run.kind === 'scan' ? h('div', { class: 'check muted' }, h('span', { class: 'ck no' }), '탑 살펴보기는 다음에 이어서 해요') : null),
          next ? h('div', { class: 'panel', style: { display: 'flex', alignItems: 'center', gap: '14px', border: '2px solid #f2a93b' } },
            h('div', {}, h('div', { class: 'muted', style: { fontSize: '13px' } }, '다음에 할 일'), h('div', { class: 'mid-t gold2', style: { fontSize: '23px' } }, `${next}에 불 켜기`))) : null,
          h('div', { class: 'btnrow' }, h('button', { class: 'kbtn green', onclick: backToRPG }, 'RPG로 돌아가기'))),
        h('div', { class: 'kside', style: { flexBasis: '380px' } }, towerEl(tw, { tags, small: false }))));
  }

  home();
  return () => stopTick();
}
