// 아이 화면: 판 하나. 카드 · ❔ · 화살표 · 구역 · 우편함 · 결과물.
//  [설정 틀] 판 모양(자유 배치 · 칸 나누기 · 담벼락 · 한 줄 · 그림에 핀 꽂기 · 이야기 줄 · 나무)과 쓰기 · 보기 · 반응 설정을 따른다(settings.js 표).
//  [THINKBOARD-STORY-1] 이야기 줄 = 사건 중심(사건 카드를 차례로 잇고 고르는 장면에서 갈림 · 인물 · 장소는 선반에서 사건에 붙임 · 이야기로 읽어 보기)
//                       나무 = 노션처럼 주제 밑에 넣고 접고 편다(들여쓰기 · 내어쓰기 · 위아래)
//  teacher: 선생님이 보는 판(이름 늘 보임 · 허락 · 가리기 · 맨 앞 고정) · tv: 교실 TV(크게 · 보기만)
import { h, toast } from './util.js';
import { ops, REASONS, storyGraph, storyCoach, optLetter, treeOf, matZonesOf, lineZoneOf } from './model.js';
import { zoneLayout, zoneAt, slotIn, freeSpot, estH, evalHints, ZW, ZHEAD, CW } from './templates.js';
import { withDefaults, zoneNames, COLORS, SEQ_WORDS } from './settings.js';
import { keyOf } from './util.js';
import { icon } from './icons.js';

const NS = 'http://www.w3.org/2000/svg';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const COLOR_NAME = { '': '기본', yellow: '노랑', pink: '분홍', green: '초록', blue: '파랑', purple: '보라' };

export function mountBoard(root, { store, boardId, me, meId = '', home, teacher = false, tv = false, roster = [] }) {   // meId = RPG 학생 id(연구 자료 열쇠)
  let B = null, S = withDefaults(), zones = [];
  const view = { x: 24, y: 16, s: 1 };
  let sel = null;            // 고른 카드
  let linkFrom = null;       // 잇기: null(꺼짐) · ''(첫 카드 기다림) · 카드 id
  let pinMode = false;       // 그림에 핀 꽂기: 그림을 누르면 그 자리에 카드
  let busy = 0, pending = false, first = true;
  let panel = null;          // 'mail' | 'res' | null
  let lastNew = -1;
  const pick = new Map();    // 우편함 카드 id → 'keep'|'drop'|'qdrop' (이유 고르는 중)
  const folded = new Set();  // [나무] 접은 항목(이 화면에서만)
  const cardEls = new Map();

  root.innerHTML = '';
  root.classList.toggle('tv', tv); root.classList.toggle('teacher-view', teacher);
  const top = h('div', { class: 'tb-top' });
  const promptBar = h('div', { class: 'tb-prompt' });
  const stage = h('div', { class: 'tb-stage' });
  const world = h('div', { class: 'tb-world' });
  const layerZ = h('div', { class: 'layer' });
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'tb-links'); svg.setAttribute('width', '1'); svg.setAttribute('height', '1');
  const layerC = h('div', { class: 'layer' });
  world.append(layerZ, svg, layerC);
  stage.append(world);
  const flow = h('div', { class: 'tb-flow' });
  const fab = h('div', { class: 'tb-fab' });
  const banner = h('div', { class: 'tb-banner' });
  const drawer = h('div', { class: 'tb-drawer' });
  const legend = h('div', { class: 'tb-legend' },
    h('span', { class: 'lg src-me' }, '내가 씀'),
    h('span', { class: 'lg src-ai-edit' }, 'AI 카드를 고침'),
    h('span', { class: 'lg src-ai-keep' }, 'AI 카드 그대로'),
    h('span', { class: 'lg unknown' }, '❔ 아직 모름'));
  root.append(top, promptBar, stage, flow, fab, banner, drawer, legend);

  let flashId = null;        // 방금 생긴 카드 — 잠깐 반짝
  const act = async (name, args) => {
    const r = ops[name](B, { ...args, by: teacher ? 'teacher' : me, ...(teacher || !meId ? {} : { sid: meId }) });
    if (r.id && (name === 'addCard' || name === 'judgeMail')) { flashId = r.id; setTimeout(() => { if (flashId === r.id) flashId = null; }, 1800); }
    await store.patch(boardId, r.patch);
    return r;
  };
  const flush = () => { if (!busy && pending) { pending = false; render(); } };

  // ─────────── 설정으로 정해지는 것
  const canvasMode = () => S.layout === 'canvas';
  const mine = c => (meId && c.sid ? c.sid === meId : c.by === me);   // RPG 에선 학생 id 로, 로컬 시험에선 이름으로
  const kidCard = c => c.src === 'me' && !c.via;                     // 아이가 직접 쓴 카드(허락이 걸리는 카드)
  const waiting = c => S.approve && kidCard(c) && !c.ok;               // 선생님 허락을 기다리는 카드
  function visible(c) {
    if (teacher) return true;
    if (c.hidden) return false;
    if (!S.others && !mine(c)) return false;
    if (waiting(c) && !mine(c)) return false;
    return true;
  }
  const nameOf = c => teacher ? (c.by || '') : S.names === 'show' ? (c.by || '') : S.names === 'anon' ? (mine(c) ? '나' : '친구') : '';
  const open = () => teacher || (S.open && !tv);
  const canEdit = c => !tv && (teacher || (S.open && (S.edit === 'all' || mine(c))));
  const canMove = c => !tv && (teacher || (S.open && (S.move === 'all' || (S.move === 'own' && mine(c)))));
  const myCount = () => Object.values(B.cards).filter(c => mine(c) && kidCard(c)).length;
  function canAdd(say) {
    if (tv) return false;
    if (teacher) return true;
    if (!S.open) { if (say) toast('지금은 쓰기를 쉬어요'); return false; }
    if (S.limit > 0 && myCount() >= S.limit) { if (say) toast(`한 사람 ${S.limit}장까지 쓸 수 있어요`); return false; }
    return true;
  }
  const colNames = () => zoneNames(B);
  const sorted = list => list.sort((a, z) => (z.top ? 1 : 0) - (a.top ? 1 : 0) || (S.sort === 'new' ? z.t - a.t : a.t - z.t));

  // ─────────── 그리기
  function render() {
    if (!B) { root.innerHTML = ''; root.append(h('div', { class: 'empty' }, '판을 찾을 수 없어요. ', h('a', { href: '#/' }, '처음으로'))); return; }
    S = withDefaults(B.settings);
    root.dataset.bg = S.bg; root.dataset.layout = S.layout;
    if (!canvasMode()) { linkFrom = null; }
    if (S.layout !== 'pins') pinMode = false;
    zones = zoneLayout(B);
    if (sel && !B.cards[sel]) sel = null;
    renderTop(); renderPrompt(); renderFab();
    stage.style.display = canvasMode() ? '' : 'none';
    flow.style.display = canvasMode() ? 'none' : '';
    if (canvasMode()) {
      renderZones(); renderCards(); renderLinks();
      if (first) { first = false; fit(); } else applyView();
    } else renderFlow();
    renderPanel();
    const showLegend = S.mail !== 'off' || Object.values(B.cards).some(c => c.src !== 'me');
    legend.style.display = showLegend && !tv ? '' : 'none';
    root.classList.toggle('src-on', !!showLegend);   // 출처 색은 우편함을 쓰는 판에서만(연구) — 아니면 종이 카드
    const n = Object.values(B.mail).filter(m => m.status === 'new').length;
    if (!teacher && !tv && lastNew >= 0 && n > lastNew) toast('📬 우편함에 카드가 왔어요!');
    lastNew = n;
  }

  // 위 줄: 판 이름 · 조용한 도구(우편함 · 결과물 · 잇기 · 확대) · 나
  const tbtn = (ic, label, on, fn, extra = '') => h('button', { class: 'tbtn' + (on ? ' on' : '') + extra, onclick: fn, title: label }, icon(ic), h('span', {}, label));
  function renderTop() {
    const nNew = Object.values(B.mail).filter(m => m.status === 'new').length;
    const showMail = !tv && (S.mail !== 'off' || Object.keys(B.mail).length);
    const writers = new Set(Object.values(B.cards).filter(kidCard).map(c => c.sid || c.by)).size;
    const sub = B.template.name && B.template.name !== B.title ? B.template.name : '';
    top.innerHTML = '';
    top.append(...[
      tv ? null : h('button', { class: 'ibtn', title: '처음으로', onclick: home }, icon(teacher ? 'back' : 'home')),
      h('div', { class: 'tb-title' }, h('b', {}, B.title), sub ? h('span', { class: 'sub' }, sub) : null),
      h('div', { class: 'grow' }),
      !teacher && !tv && !S.open ? h('span', { class: 'pill warn' }, icon('lock', 15), '보기만 해요') : null,
      teacher && roster.length ? h('button', { class: 'tbtn' + (panel === 'who' ? ' on' : ''), onclick: () => togglePanel('who'), title: '누가 썼나' }, icon('users'), h('span', {}, `${writers} / ${roster.length}명 · ${Object.values(B.cards).filter(visible).length}장`))
        : (teacher || tv) ? h('span', { class: 'pill' }, icon('users', 15), `${writers}명 · ${Object.values(B.cards).filter(visible).length}장`) : null,
      open() && canvasMode() && S.links ? tbtn('link', '잇기', linkFrom !== null, () => setLink(linkFrom === null ? '' : null)) : null,
      S.layout === 'story' ? tbtn('book', '이야기로 읽어 보기', false, () => readStory()) : null,
      showMail ? h('button', { class: 'tbtn' + (panel === 'mail' ? ' on' : '') + (nNew ? ' has' : ''), onclick: () => togglePanel('mail'), title: '우편함' },
        icon('inbox'), h('span', {}, '우편함'), nNew ? h('span', { class: 'badge' }, nNew) : null) : null,
      tv || !(teacher || S.mail !== 'off' || Object.keys(B.results).length) ? null : h('button', { class: 'tbtn' + (panel === 'res' ? ' on' : ''), onclick: () => togglePanel('res'), title: '결과물' },
        icon('clip'), h('span', {}, '결과물'), Object.keys(B.results).length ? h('span', { class: 'badge soft' }, Object.keys(B.results).length) : null),
      canvasMode() ? h('div', { class: 'zoom' },
        h('button', { class: 'ibtn', onclick: () => zoomBy(1 / 1.2), title: '작게' }, icon('minus')),
        h('button', { class: 'ibtn', onclick: fit, title: '한눈에' }, icon('fit')),
        h('button', { class: 'ibtn', onclick: () => zoomBy(1.2), title: '크게' }, icon('plus'))) : null,
      tv ? null : h('span', { class: 'me' }, teacher ? '선생님' : me)].filter(Boolean));   // DOM append 는 null 을 글자로 쓴다
  }

  // 오른쪽 아래: 쓰기 단추(주 동작 하나) + 모르는 것
  function renderFab() {
    fab.innerHTML = '';
    if (!open()) return;
    const add = canAdd(false), left = !teacher && S.limit > 0 ? ` ${myCount()}/${S.limit}` : '';
    if (S.unknown) fab.append(h('button', { class: 'fab-2' + (add ? '' : ' dim'), onclick: () => { if (canAdd(true)) addIn('', 'unknown'); } }, icon('help'), h('span', {}, '모르는 것')));
    const selC = sel && B.cards[sel];
    fab.append(S.layout === 'pins'
      ? h('button', { class: 'fab' + (pinMode ? ' on' : '') + (add ? '' : ' dim'), onclick: () => { if (canAdd(true)) setPin(!pinMode); } }, icon(pinMode ? 'x' : 'mapPin', 20), h('span', {}, pinMode ? '그만' : '핀 꽂기' + left))
      : S.layout === 'story' ? h('button', { class: 'fab' + (add ? '' : ' dim'), onclick: () => { if (canAdd(true)) addNext(fabAfter()); } }, icon('plus', 20), h('span', {}, (storyGraph(B, visible).start ? '사건 더하기' : '첫 사건 쓰기') + left))
      : S.layout === 'tree' ? h('button', { class: 'fab' + (add ? '' : ' dim'), onclick: () => { if (canAdd(true)) addChildOf(selC && selC.kind !== 'unknown' ? selC.id : ''); } }, icon(selC ? 'sub' : 'plus', 20), h('span', {}, (selC ? '밑에 넣기' : '주제 더하기') + left))
      : h('button', { class: 'fab' + (add ? '' : ' dim'), onclick: () => { if (canAdd(true)) addIn(''); } }, icon('plus', 20), h('span', {}, '생각 쓰기' + left)));
  }

  function renderPrompt() {   // 자유 배치는 위 띠, 흐르는 판은 판 맨 위(renderFlow)
    promptBar.innerHTML = '';
    const on = !!S.prompt && canvasMode();
    root.classList.toggle('has-prompt', on);
    if (on) promptBar.append(h('span', {}, S.prompt));
  }

  // 카드 속 아래 줄: 이름 · 표시(허락 기다림 · 가림 · 고정) · 공감
  function cardMeta(c) {
    const nm = nameOf(c), rk = Object.keys(c.react || {}).length, mineR = !!(c.react && c.react[keyOf(teacher ? 'teacher' : (meId || me))]);
    const tags = [];
    if (c.top) tags.push(h('span', { class: 'tag' }, icon('pinTop', 13), '맨 앞'));
    if (waiting(c)) tags.push(h('span', { class: 'tag wait' }, teacher ? '허락 기다림' : '선생님이 보고 있어요'));
    if (teacher && c.hidden) tags.push(h('span', { class: 'tag hid' }, icon('eyeOff', 13), '가림'));
    const heart = S.react === 'heart'
      ? h('button', { class: 'heart' + (mineR ? ' on' : ''), disabled: tv, title: '공감', onpointerdown: e => e.stopPropagation(),
          onclick: e => { e.stopPropagation(); act('react', { id: c.id }); } }, icon('heart', 16), rk ? h('span', {}, rk) : null)
      : null;
    if (!nm && !heart && !tags.length) return null;
    return h('div', { class: 'cmeta' }, nm ? h('span', { class: 'who' }, nm) : null, ...tags, h('span', { class: 'grow' }), heart);
  }

  function cardClass(c, extra = '') {
    return `card src-${c.src}${c.kind === 'unknown' ? ' unknown' : ''}${c.color ? ' c-' + c.color : ''}${sel === c.id ? ' sel' : ''}`
      + `${linkFrom === c.id ? ' linkfrom' : ''}${flashId === c.id ? ' flash' : ''}${mine(c) && !teacher ? ' mine' : ''}`
      + `${teacher && (c.hidden || waiting(c)) ? ' dimmed' : ''}${extra}`;
  }
  const cardText = c => h('div', { class: 'ctext' }, c.kind === 'unknown' ? '❔ ' : '', c.text);
  const cardBadges = c => (c.ar || (c.via && B.mail[c.via]?.type === 'question' && c.src === 'me'))
    ? h('div', { class: 'cbadges' }, c.ar ? h('span', { title: '결과 보고 고침' }, '🔁') : null,
      c.via && B.mail[c.via]?.type === 'question' && c.src === 'me' ? h('span', { title: '질문에 답한 카드' }, '💬') : null)
    : null;

  function zoneHeight() {
    let bottom = 0;
    for (const c of Object.values(B.cards)) if (c.zone && visible(c)) bottom = Math.max(bottom, c.y + estH(c));
    return Math.max(560, bottom + 120);
  }

  // ─────────── 자유 배치(캔버스)
  function renderZones() {
    layerZ.innerHTML = '';
    const hints = evalHints(B), H = zoneHeight();
    for (const z of zones) {
      layerZ.append(h('div', { class: 'zone', style: { left: z.x + 'px', top: z.y + 'px', width: ZW + 'px', height: H + 'px' } },
        h('div', { class: 'zone-head', style: { height: ZHEAD + 'px' } },
          h('span', {}, z.name),
          open() ? h('button', { class: 'zadd', title: `${z.name}에 카드 더하기`, onclick: () => { if (canAdd(true)) addIn(z.name); } }, icon('plus', 16)) : null),
        hints[z.name] ? h('div', { class: 'hint' }, hints[z.name]) : null));
    }
  }

  function renderCards() {
    layerC.innerHTML = '';
    cardEls.clear();
    const list = Object.values(B.cards).filter(visible).sort((a, z) => a.t - z.t);
    for (const c of list) {
      const el = h('div', { class: cardClass(c), style: { left: c.x + 'px', top: c.y + 'px', width: CW + 'px' } },
        cardText(c), cardBadges(c), cardMeta(c), sel === c.id ? cardTools(c) : null);
      bindCard(el, c.id);
      layerC.append(el);
      cardEls.set(c.id, el);
    }
  }

  // 고른 카드의 동작 — 카드 안에 펼친다(다른 것을 덮지 않게)
  function cardTools(c) {
    const stop = e => e.stopPropagation();
    const edit = canEdit(c), cols = colNames();
    const b = (ic, label, fn, cls = '', bare = false) => h('button', { class: 'abtn ' + cls + (bare ? ' bare' : ''), title: label, 'aria-label': label, onclick: e => { e.stopPropagation(); fn(); } }, icon(ic, 15), bare ? null : h('span', {}, label));
    const items = [
      edit ? b('edit', '고치기', () => editCard(c.id)) : null,
      edit && canvasMode() && S.links ? b('link', '화살표 잇기', () => setLink(c.id), '', true) : null,
      edit && c.kind === 'unknown' ? b('check', '정했어요', () => act('resolveCard', { id: c.id })) : null,
      canMove(c) && S.layout === 'columns' && cols.length > 1
        ? h('label', { class: 'abtn sel-wrap', onclick: stop }, icon('move', 15), h('select', { onchange: e => { act('moveCard', { id: c.id, x: c.x, y: c.y, zone: e.target.value }); } },
          cols.map(z => h('option', { value: z, selected: c.zone === z }, z)))) : null,
      teacher && waiting(c) ? b('check', '허락', () => act('moderate', { id: c.id, ok: true }), 'ok') : null,
      teacher ? b(c.hidden ? 'eye' : 'eyeOff', c.hidden ? '다시 보이기' : '아이들에게 가리기', () => act('moderate', { id: c.id, hidden: !c.hidden }), '', true) : null,
      teacher && !canvasMode() ? b('pinTop', c.top ? '맨 앞 고정 풀기' : '맨 앞에 고정', () => act('moderate', { id: c.id, top: !c.top }), c.top ? 'on' : '', true) : null,
      edit ? b('trash', '지우기', () => { if (confirm('이 카드를 지울까요?')) act('deleteCard', { id: c.id }); }, 'danger', true) : null,
    ].filter(Boolean);
    return items.length ? h('div', { class: 'card-tools', onpointerdown: stop }, items) : null;
  }

  function renderLinks() {
    svg.innerHTML = '<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#64748b"/></marker></defs>';
    const box = el => ({ cx: el.offsetLeft + el.offsetWidth / 2, cy: el.offsetTop + el.offsetHeight / 2, hw: el.offsetWidth / 2 + 6, hh: el.offsetHeight / 2 + 6 });
    const edge = (b, tx, ty) => {
      const dx = tx - b.cx, dy = ty - b.cy;
      const k = 1 / Math.max(Math.abs(dx) / b.hw, Math.abs(dy) / b.hh, 1e-6);
      return [b.cx + dx * k, b.cy + dy * k];
    };
    for (const l of Object.values(B.links)) {
      const ea = cardEls.get(l.from), eb = cardEls.get(l.to);
      if (!ea || !eb) continue;
      const a = box(ea), b = box(eb);
      const [x1, y1] = edge(a, b.cx, b.cy), [x2, y2] = edge(b, a.cx, a.cy);
      const d = `M${x1},${y1} L${x2},${y2}`;
      const line = document.createElementNS(NS, 'path');
      line.setAttribute('d', d); line.setAttribute('class', 'tb-link'); line.setAttribute('marker-end', 'url(#arr)');
      const hit = document.createElementNS(NS, 'path');
      hit.setAttribute('d', d); hit.setAttribute('class', 'tb-link-hit');
      hit.addEventListener('click', () => { if (open() && confirm('이 화살표를 지울까요?')) act('deleteLink', { id: l.id }); });
      svg.append(line, hit);
    }
  }

  // ─────────── 칸 나누기 · 담벼락 · 한 줄 · 그림에 핀 꽂기(흐르는 판)
  function flowCard(c, num) {
    const t = sel === c.id ? cardTools(c) : null;
    const el = h('div', { class: cardClass(c, ' fcard') },
      num ? h('span', { class: 'pnum' }, num) : null, cardText(c), cardBadges(c), cardMeta(c), t);
    el.addEventListener('click', e => { if (e.target.closest('.card-tools, .heart')) return; tapCard(c.id); });
    return el;
  }

  // 담벼락: 순서대로 왼쪽→오른쪽 칸에 돌려 담는다 — 새 글이 맨 앞(왼쪽 위)에서 읽히고 높이는 제각각
  function wall(els) {
    const w = (flow.clientWidth || innerWidth) - 56, cw = tv ? 320 : 250, gap = 16;
    const n = Math.max(1, Math.floor((w + gap) / (cw + gap)));
    const cols = Array.from({ length: n }, () => h('div', { class: 'fl-wcol' }));
    els.forEach((el, i) => cols[i % n].append(el));
    return h('div', { class: 'fl-wall' }, cols);
  }

  function renderFlow() {
    const keep = flow.scrollTop;
    flow.innerHTML = '';
    const list = sorted(Object.values(B.cards).filter(visible));
    const hiddenOthers = !teacher && !S.others ? Object.values(B.cards).filter(c => !mine(c) && !c.hidden).length : 0;
    if (S.prompt) flow.append(h('div', { class: 'fl-hero' }, h('div', { class: 'q' }, S.prompt)));
    if (S.layout === 'story') { renderStory(); flow.scrollTop = keep; return; }
    if (S.layout === 'tree') { renderTree(); flow.scrollTop = keep; return; }
    const empty = () => h('div', { class: 'fl-empty' }, open() ? '아직 카드가 없어요. 오른쪽 아래에서 첫 생각을 써 볼까요?' : '아직 카드가 없어요');
    if (S.layout === 'columns') {
      const names = colNames(), hints = S.hints ? evalHints({ ...B, settings: { ...B.settings, zones: true } }) : {};
      const extra = list.filter(c => !names.includes(c.zone));
      const cols = names.map(n => [n, list.filter(c => c.zone === n)]);
      if (extra.length) cols.push(['기타', extra]);
      flow.append(h('div', { class: 'fl-cols' }, cols.map(([n, cs]) => h('section', { class: 'fl-col' },
        h('header', { class: 'fl-head' }, h('span', { class: 'nm' }, n), h('span', { class: 'cnt' }, cs.length)),
        hints[n] ? h('div', { class: 'hint flow' }, hints[n]) : null,
        h('div', { class: 'fl-list' }, cs.map(c => flowCard(c)),
          open() && n !== '기타' ? h('button', { class: 'fl-add', onclick: () => { if (canAdd(true)) addIn(n); } }, icon('plus', 16), '여기에 붙이기') : null)))));
    } else if (S.layout === 'pins') {
      const order = Object.values(B.cards).sort((a, z) => a.t - z.t), numOf = new Map(order.map((c, i) => [c.id, i + 1]));
      const imgs = S.images || [];
      flow.append(h('div', { class: 'fl-pins' + (pinMode ? ' picking' : '') },
        imgs.length ? h('div', { class: 'pin-imgs' + (imgs.length > 1 ? ' two' : '') }, imgs.map((src, i) => {
          const box = h('div', { class: 'pin-img' }, h('img', { src, alt: `그림 ${i + 1}`, draggable: 'false' }),
            list.filter(c => c.pin && c.pin.i === i).map(c => h('button', {
              class: 'pin' + (mine(c) && !teacher ? ' mine' : '') + (sel === c.id ? ' sel' : ''), style: { left: c.pin.x + '%', top: c.pin.y + '%' },
              title: c.text, onclick: e => { e.stopPropagation(); tapCard(c.id); } }, numOf.get(c.id))));
          box.addEventListener('click', e => {
            if (!pinMode || e.target.closest('.pin')) return;
            const r = box.getBoundingClientRect();
            const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
            setPin(false); addIn('', 'idea', { i, x, y });
          });
          return box;
        })) : h('div', { class: 'fl-empty' }, teacher ? '설정 → 그림에 그림 주소를 넣어 주세요' : '선생님이 그림을 넣으면 여기에 보여요'),
        list.length ? wall(list.map(c => flowCard(c, numOf.get(c.id)))) : empty()));
    } else {
      flow.append(list.length ? (S.layout === 'stream' ? h('div', { class: 'fl-stream' }, list.map(c => flowCard(c))) : wall(list.map(c => flowCard(c)))) : empty());
    }
    if (hiddenOthers) flow.append(h('div', { class: 'fl-empty small' }, `친구 카드 ${hiddenOthers}장은 선생님만 봐요`));
    flow.scrollTop = keep;
  }

  // ─────────── [THINKBOARD-STORY-1] 이야기 줄 — 사건 중심
  //  사건 카드를 위에서 아래로 차례대로(책 읽듯 · 크롬북 1366×610 에서 옆으로 밀지 않게) · 길이 둘 이상 나가면 갈림길(옆으로 나란히)
  //  카드 위 = 이어 주는 말(그러던 어느 날 · 그래서 …) · 카드 안 = 붙인 인물 · 장소 · 끝 · 줄 끝마다 '+ 다음 사건'
  const LANE = 230, SR = 34;   // 갈래 너비(카드 204 + 사이) · 사건 사이(화살표 자리)
  let storyScroll = 0;
  const seqWords = () => SEQ_WORDS[S.seqWords] || [];
  const lineZone = () => lineZoneOf(B) || '사건';
  // 다음 사건에 권할 말 — 첫 사건 · 두 번째 · 갈림길 뒤 · 그 밖
  function nextWord(after, g) {
    const w = seqWords();
    if (!w.length) return '';
    if (!after) return w[0];
    const p = g.pos.get(after), col = p ? p.col + 1 : 1, story = S.seqWords !== 'steps';
    if (story) return col === 1 ? w[1] : col === 2 ? w[2] : (B.cards[after] || {}).zone === '선택' ? '' : '그래서';
    return w[Math.min(col, 1)];
  }
  // 오른쪽 아래 단추가 붙일 곳: 고른 카드가 줄 끝이면 그 뒤 · 아니면 첫 줄의 끝
  function fabAfter() {
    const g = storyGraph(B, visible);
    if (sel && g.leaves.some(c => c.id === sel)) return sel;
    let cur = g.start ? g.start.id : '';
    for (let i = 0; cur && i < 999; i++) { const o = g.out.get(cur) || []; if (!o.length) break; cur = o[0].to; }
    return cur;
  }
  const spot = (after, g) => { const p = g && after ? g.pos.get(after) : null; return freeSpot(B, ((p ? p.col : -1) + 1) * 210, 80 + (p ? p.row : 0) * 150); };   // 자유 배치로 바꿔도 줄 모양으로
  function addNext(after) {
    const g = storyGraph(B, visible), a = after && B.cards[after] ? after : '';
    if (a && B.cards[a].end) { toast('끝으로 정한 사건이에요 — 끝을 풀면 이어 쓸 수 있어요'); return; }
    const w = nextWord(a, g);
    openEditor({ title: a ? '다음 사건' : '첫 사건', placeholder: a ? '무슨 일이 일어났나요?' : '누가, 어디에서, 어떻게 지냈나요?', spines: seqWords(), spine: w,
      onSave: (text, o) => { const p = spot(a, g); act('addAfter', { after: a, text, spine: o.spine || '', zone: lineZone(), x: p.x, y: p.y }); } });
  }
  function addBranchAfter(after) {
    const g = storyGraph(B, visible);
    if (after && B.cards[after]?.end) { toast('끝으로 정한 사건이에요 — 끝을 풀면 이어 쓸 수 있어요'); return; }
    openBranch({ onSave: (q, opts) => { const p = spot(after, g); act('addBranch', { after, q, opts, x: p.x, y: p.y }); } });
  }
  function addOption(choice) {
    const g = storyGraph(B, visible);
    if ((g.out.get(choice) || []).length >= 4) { toast('고를 것은 넷까지예요'); return; }
    openEditor({ title: '고를 것 더하기', placeholder: '예: 혼자 몰래 간다', onSave: text => { const p = spot(choice, g); act('addAfter', { after: choice, text, zone: lineZone(), x: p.x, y: p.y }); } });
  }
  function insertOn(link) {
    openEditor({ title: '사이에 사건 넣기', placeholder: '그 사이에 무슨 일이?', spines: seqWords(), spine: '',
      onSave: (text, o) => { const l = B.links[link], f = l && B.cards[l.from]; act('insertBetween', { link, text, spine: o.spine || '', x: f ? f.x + 30 : 40, y: f ? f.y + 40 : 40 }); } });
  }
  function attachLoose(id) {   // 안 이은 카드 → 첫 줄 끝에
    const end = fabAfter();
    if (!end || end === id) return act('addLink', { from: id, to: id });
    if (B.cards[end]?.end) return toast('첫 줄이 끝났어요 — 끝을 풀거나, 줄 끝 카드를 골라 이어 주세요');
    act('addLink', { from: end, to: id });
  }

  function storyTools(c, g) {
    const edit = canEdit(c), leaf = !(g.out.get(c.id) || []).length, choice = c.zone === '선택' || (g.out.get(c.id) || []).length > 1;
    const b = (ic, label, fn, cls = '', bare = false) => h('button', { class: 'abtn ' + cls + (bare ? ' bare' : ''), title: label, 'aria-label': label, onclick: e => { e.stopPropagation(); fn(); } }, icon(ic, 15), bare ? null : h('span', {}, label));
    const words = seqWords();
    const items = [
      edit ? b('edit', '고치기', () => editCard(c.id)) : null,
      edit && words.length && !choice ? h('label', { class: 'abtn sel-wrap', title: '이어 주는 말', onclick: e => e.stopPropagation() }, icon('next', 15),
        h('select', { onchange: e => act('setSpine', { id: c.id, spine: e.target.value }) }, ['', ...words].map(w => h('option', { value: w, selected: (c.spine || '') === w }, w || '(이어 주는 말 없음)')))) : null,
      edit && leaf && !c.end && open() ? b('next', '다음 사건', () => addNext(c.id)) : null,
      edit && leaf && !c.end && open() && S.branch ? b('branch', '갈림길', () => addBranchAfter(c.id)) : null,
      edit && choice && open() ? b('plus', '고를 것 더하기', () => addOption(c.id)) : null,
      edit && leaf ? b('flag', c.end ? '끝 풀기' : '끝', () => act('setEnd', { id: c.id, end: !c.end }), c.end ? 'on' : '') : null,
      teacher && waiting(c) ? b('check', '허락', () => act('moderate', { id: c.id, ok: true }), 'ok') : null,
      teacher ? b(c.hidden ? 'eye' : 'eyeOff', c.hidden ? '다시 보이기' : '아이들에게 가리기', () => act('moderate', { id: c.id, hidden: !c.hidden }), '', true) : null,
      edit ? b('trash', '지우기', () => { if (confirm('이 사건을 지울까요? 앞뒤 사건은 다시 이어 줘요.')) act('removeInLine', { id: c.id }); }, 'danger', true) : null,
    ].filter(Boolean);
    const mz = matZonesOf(B);
    return h('div', { class: 'card-tools', onpointerdown: e => e.stopPropagation() }, items,
      edit && mz.length && !choice ? h('div', { class: 'st-taghint' }, icon('tag', 13), `왼쪽 선반의 ${mz.join(' · ')}을(를) 누르면 이 사건에 붙어요`) : null);
  }

  function storyCard(c, g) {
    const L = optLetter(g, c.id), choice = c.zone === '선택';
    const tags = Object.keys(c.tags || {}).map(k => B.cards[k]).filter(t => t && visible(t));
    const el = h('div', { class: cardClass(c, ' scard' + (choice ? ' choice' : '') + (c.end ? ' end' : '')), 'data-id': c.id },
      (c.spine || L || choice) ? h('div', { class: 'sc-top' }, L ? h('span', { class: 'opt' }, L) : null, choice ? h('span', { class: 'spine q' }, '고르는 장면') : c.spine ? h('span', { class: 'spine' }, c.spine) : null) : null,
      cardText(c),
      tags.length ? h('div', { class: 'sc-tags' }, tags.map(t => h('span', { class: 'mtag' }, t.text))) : null,
      c.end ? h('div', { class: 'sc-end' }, icon('flag', 13), '끝') : null,
      cardBadges(c), cardMeta(c), sel === c.id ? storyTools(c, g) : null);
    el.addEventListener('click', e => { if (e.target.closest('.card-tools, .heart')) return; tapCard(c.id); });
    return el;
  }

  function renderStory() {
    const g = storyGraph(B, visible), mz = matZonesOf(B), selNode = sel && g.pos.has(sel) ? sel : '';
    // 선반 — 인물 · 장소(사건을 고른 채 누르면 그 사건에 붙는다) · ❔ · 안 이은 카드
    const matChip = m => {
      const on = selNode && B.cards[selNode]?.tags?.[m.id];
      const el = h('div', { class: cardClass(m, ' mchip' + (on ? ' tagged' : '') + (selNode ? ' can-tag' : '')) }, cardText(m), cardMeta(m), sel === m.id ? cardTools(m) : null);
      el.addEventListener('click', e => {
        if (e.target.closest('.card-tools, .heart')) return;
        if (selNode && canEdit(B.cards[selNode])) { act('tagCard', { id: selNode, mat: m.id, on: !on }); return; }
        tapCard(m.id);
      });
      return el;
    };
    const used = id => g.nodes.some(c => c.tags && c.tags[id]);
    const shelf = h('aside', { class: 'st-shelf' },
      ...mz.map(z => h('section', { class: 'st-sec' },
        h('header', {}, h('b', {}, z), h('span', { class: 'cnt' }, g.mats.filter(m => m.zone === z).length), open() ? h('button', { class: 'zadd', title: `${z} 더하기`, onclick: () => { if (canAdd(true)) addIn(z); } }, icon('plus', 15)) : null),
        h('div', { class: 'st-mats' }, g.mats.filter(m => m.zone === z).map(m => { const el = matChip(m); if (!used(m.id) && g.nodes.length) el.title = '아직 어느 사건에도 안 나와요'; return el; })),
        !g.mats.some(m => m.zone === z) ? h('div', { class: 'st-none' }, open() ? `＋로 ${z}을(를) 적어요` : '아직 없어요') : null)),
      g.unk.length ? h('section', { class: 'st-sec' }, h('header', {}, h('b', {}, '❔ 아직 안 정한 것')), h('div', { class: 'st-mats' }, g.unk.map(c => flowCard(c)))) : null,
      g.loose.length ? h('section', { class: 'st-sec loose' }, h('header', {}, h('b', {}, '아직 줄에 안 이은 카드')),
        h('div', { class: 'st-mats' }, g.loose.map(c => h('div', { class: 'st-loose' }, flowCard(c), open() && canEdit(c) ? h('button', { class: 'btn small', onclick: () => attachLoose(c.id) }, icon('next', 14), '줄 끝에 잇기') : null)))) : null);
    // 줄 — 두 번 그리기(먼저 놓고 높이를 잰 뒤 자리 잡기)
    const scroller = h('div', { class: 'st-scroll' }), area = h('div', { class: 'st-area' }), lay = h('div', { class: 'st-layer' });
    const sv = document.createElementNS(NS, 'svg'); sv.setAttribute('class', 'st-links');
    area.append(sv, lay); scroller.append(area);
    const coach = S.hints ? storyCoach(B, g) : [];
    flow.append(h('div', { class: 'st-wrap' }, shelf, h('div', { class: 'st-main' }, scroller,
      coach.length ? h('div', { class: 'st-coach' }, coach.map(t => h('span', {}, t))) : null)));
    const els = new Map(), ghosts = [];
    for (const c of g.nodes) if (g.pos.has(c.id)) { const el = storyCard(c, g); lay.append(el); els.set(c.id, el); }
    if (!g.start) {
      lay.append(open() ? h('button', { class: 'st-first', onclick: () => { if (canAdd(true)) addNext(''); } }, icon('plus', 20),
        h('b', {}, seqWords()[0] ? `${seqWords()[0]}…` : '첫 사건'), h('span', {}, S.seqWords === 'steps' ? '첫 단계를 써요' : '이야기의 처음 — 누가, 어디에서 지냈나요?')) : h('div', { class: 'fl-empty' }, '아직 사건이 없어요'));
      return;
    }
    if (open()) for (const c of g.leaves) if (!c.end && canAdd(false)) {
      const w = nextWord(c.id, g);
      const gh = h('div', { class: 'st-ghost' },
        h('button', { class: 'gh-main', onclick: () => { if (canAdd(true)) addNext(c.id); } }, icon('plus', 16), h('span', {}, w ? `${w}…` : '다음 사건')),
        S.branch && c.zone !== '선택' ? h('button', { class: 'gh-br', title: '여기서 길이 갈라져요', onclick: () => { if (canAdd(true)) addBranchAfter(c.id); } }, icon('branch', 15), '갈림길') : null);
      lay.append(gh); ghosts.push([c.id, gh]);
    }
    //  자리 — 차례(pos.col) = 아래로 · 갈래(pos.row) = 옆으로. 차례마다 그 줄에서 가장 큰 카드 높이만큼
    const depthH = [];
    const grow = (d, hh) => { depthH[d] = Math.max(depthH[d] || 0, hh); };
    for (const [id, el] of els) grow(g.pos.get(id).col, el.offsetHeight);
    for (const [id, gh] of ghosts) grow(g.pos.get(id).col + 1, gh.offsetHeight);
    const depthY = []; let y = 6;
    for (let d = 0; d < depthH.length; d++) { depthY[d] = y; y += (depthH[d] || 0) + SR; }
    let maxLane = 0;
    const at = (el, depth, lane) => { el.style.left = 8 + lane * LANE + 'px'; el.style.top = depthY[depth] + 'px'; maxLane = Math.max(maxLane, lane); };
    for (const [id, el] of els) { const p = g.pos.get(id); at(el, p.col, p.row); }
    for (const [id, gh] of ghosts) { const p = g.pos.get(id); at(gh, p.col + 1, p.row); }
    const W = 8 + (maxLane + 1) * LANE + 30, H = y + 10;
    area.style.width = W + 'px'; area.style.height = H + 'px'; sv.setAttribute('width', W); sv.setAttribute('height', H);
    // 화살표 — 아래 가운데 → 위 가운데(갈래가 다르면 꺾어서) · 화살표 위 '+' = 사이에 넣기
    sv.innerHTML = '<defs><marker id="sarr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#94a3b8"/></marker></defs>';
    for (const l of g.links) {
      const a = els.get(l.from), z = els.get(l.to);
      if (!a || !z) continue;
      const x1 = a.offsetLeft + a.offsetWidth / 2, y1 = a.offsetTop + a.offsetHeight, x2 = z.offsetLeft + z.offsetWidth / 2, y2 = z.offsetTop;
      const back = y2 <= y1;   // 앞 사건으로 돌아가는 화살표(자유 배치에서 만든 것) — 오른쪽으로 둘러 간다
      const ym = y1 + Math.min(14, (y2 - y1) / 2);
      const d = back ? `M${a.offsetLeft + a.offsetWidth},${y1 - 16} C${a.offsetLeft + a.offsetWidth + 60},${y1} ${z.offsetLeft + z.offsetWidth + 60},${y2 + 16} ${z.offsetLeft + z.offsetWidth},${y2 + 16}`
        : x1 === x2 ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} L${x1},${ym} L${x2},${ym} L${x2},${y2}`;
      const path = document.createElementNS(NS, 'path'); path.setAttribute('d', d); path.setAttribute('class', 'st-link'); path.setAttribute('marker-end', 'url(#sarr)');
      sv.append(path);
      if (open() && !back && canAdd(false)) {
        const plus = h('button', { class: 'st-ins', title: '사이에 사건 넣기', style: { left: x2 + 14 + 'px', top: (x1 === x2 ? (y1 + y2) / 2 : (ym + y2) / 2) - 10 + 'px' }, onclick: e => { e.stopPropagation(); if (canAdd(true)) insertOn(l.id); } }, icon('plus', 12));
        lay.append(plus);
      }
    }
    scroller.scrollLeft = storyScroll;
    scroller.addEventListener('scroll', () => { storyScroll = scroller.scrollLeft; }, { passive: true });
    //  방금 쓴 사건이 화면 밖이면 보이게(긴 이야기 · 갈림길 아래)
    const fresh = flashId && els.get(flashId);
    if (fresh) requestAnimationFrame(() => { try { fresh.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); } catch {} });
  }

  // 이야기로 읽어 보기 — 책처럼 한 사건씩 · 갈림길에서 직접 고른다 · 길이 멈추면 '아직 끝이 없어요'
  function readStory() {
    const g = storyGraph(B, visible);
    if (!g.start) { toast('아직 사건이 없어요'); return; }
    let cur = g.start.id, trail = [];
    const page = h('div', { class: 'rd-page' });
    const wrap = h('div', { class: 'rd-wrap', onpointerdown: e => { if (e.target === wrap) close(); } }, h('div', { class: 'rd-book' },
      h('div', { class: 'rd-head' }, h('b', {}, B.title), h('button', { class: 'ibtn', title: '닫기', onclick: () => close() }, icon('x'))), page));
    const close = () => { wrap.remove(); removeEventListener('keydown', onK, true); };
    const onK = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    addEventListener('keydown', onK, true);
    const go = id => { trail.push(cur); cur = id; show(); };
    function show() {
      const c = B.cards[cur]; if (!c) return close();
      const outs = (g.out.get(cur) || []).filter(l => B.cards[l.to] && visible(B.cards[l.to]));
      const tags = Object.keys(c.tags || {}).map(k => B.cards[k]).filter(t => t && visible(t));
      const choice = c.zone === '선택' || outs.length > 1;
      page.replaceChildren(...[   // replaceChildren 은 null 을 글자로 쓴다 — 거른다
        c.spine && !choice ? h('div', { class: 'rd-spine' }, c.spine) : null,
        h('p', { class: 'rd-text' + (choice ? ' q' : '') }, c.text),
        tags.length ? h('div', { class: 'sc-tags' }, tags.map(t => h('span', { class: 'mtag' }, t.text))) : null,
        choice ? h('div', { class: 'rd-opts' }, outs.map((l, i) => h('button', { class: 'rd-opt', onclick: () => go(l.to) }, h('span', { class: 'opt' }, 'ABCD'[i] || ''), B.cards[l.to].text)))
          : outs.length ? h('div', { class: 'rd-row' }, h('button', { class: 'btn primary', onclick: () => go(outs[0].to) }, '다음', icon('next', 16)))
          : h('div', { class: 'rd-endbox' + (c.end ? ' done' : '') }, c.end ? '— 끝 —' : '여기서 이야기가 멈췄어요. 아직 끝이 없어요.',
            h('div', { class: 'rd-row' }, h('button', { class: 'btn', onclick: () => { trail = []; cur = g.start.id; show(); } }, '처음부터 다시'), g.nodes.some(n => (g.out.get(n.id) || []).length > 1) ? h('span', { class: 'help' }, '다른 길도 골라 봐요') : null)),
        trail.length ? h('div', { class: 'rd-back' }, h('button', { class: 'btn ghost small', onclick: () => { cur = trail.pop(); show(); } }, icon('back', 14), '앞으로')) : null].filter(Boolean));
    }
    document.body.append(wrap); show();
  }

  // 갈림길 쓰기 — 고르는 장면 하나 + 고를 것 둘(셋째는 나중에 '고를 것 더하기')
  function openBranch({ onSave }) {
    busy++;
    const max = S.maxLen || 40;
    const q = h('input', { maxlength: max, placeholder: '고르는 장면 — 예: 별을 살리려면?' });
    const a = h('input', { maxlength: max, placeholder: 'A — 예: 얼음 동굴의 요정에게 간다' }), b2 = h('input', { maxlength: max, placeholder: 'B — 예: 숲 친구들을 모은다' });
    const close = () => { wrap.remove(); busy--; flush(); };
    const save = () => { const v = [q, a, b2].map(x => x.value.trim().replace(/\s+/g, ' ')); if (!v[0]) return q.focus(); if (!v[1] || !v[2]) return (v[1] ? b2 : a).focus(); close(); onSave(v[0], [v[1], v[2]]); };
    const wrap = h('div', { class: 'editor-wrap', onpointerdown: e => { if (e.target === wrap) close(); } },
      h('div', { class: 'editor' }, h('div', { class: 'ed-title' }, '갈림길 — 여기서 길이 갈라져요'),
        h('div', { class: 'br-form' }, q, h('div', { class: 'br-opts' }, a, b2)),
        h('div', { class: 'ed-row' }, h('span', { class: 'help' }, '고른 다음 어떻게 되는지는 길마다 이어 써요'), h('div', { class: 'grow' }),
          h('button', { class: 'btn', onclick: close }, '취소'), h('button', { class: 'btn primary', onclick: save }, '저장'))));
    [q, a, b2].forEach(x => x.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save(); } if (e.key === 'Escape') close(); }));
    document.body.append(wrap); setTimeout(() => q.focus(), 30);
  }

  // ─────────── [THINKBOARD-STORY-1] 나무 — 노션처럼 주제 밑에 넣기 · 접고 펴기
  function addChildOf(parent, after = '') {
    const T = treeOf(B, visible), depth = (() => { let d = 0; for (let p = parent; p && d < 20; p = (B.cards[p] || {}).parent || '') d++; return d; })();
    openEditor({ title: parent ? `'${(B.cards[parent] || {}).text || ''}' 밑에 넣기` : after ? '같은 층에 더하기' : '주제 더하기', placeholder: parent ? '이 주제 밑에 들어갈 생각' : '큰 주제 하나',
      onSave: text => { const n = T.items.length; act('addChild', { parent, after, text, x: 40 + depth * 40, y: 40 + n * 56 }); if (parent) folded.delete(parent); } });
  }
  function treeTools(c, T) {
    const edit = canEdit(c), sibs = T.kids(c.parent && B.cards[c.parent] ? c.parent : ''), i = sibs.indexOf(c);
    const prev = sibs[i - 1], next = sibs[i + 1], par = c.parent && B.cards[c.parent] ? B.cards[c.parent] : null;
    const b = (ic, label, fn, cls = '', bare = false) => h('button', { class: 'abtn ' + cls + (bare ? ' bare' : ''), title: label, 'aria-label': label, onclick: e => { e.stopPropagation(); fn(); } }, icon(ic, 15), bare ? null : h('span', {}, label));
    const ordAfter = (list, j) => { const a = list[j] ? list[j].ord || 0 : 0, n = list[j + 1]; return n ? (a + (n.ord || 0)) / 2 : a + 1; };
    const items = [
      edit ? b('edit', '고치기', () => editCard(c.id)) : null,
      edit && open() ? b('sub', '밑에 넣기', () => { if (canAdd(true)) addChildOf(c.id); }) : null,
      edit && open() ? b('plus', '아래에 같은 층', () => { if (canAdd(true)) addChildOf(par ? par.id : '', c.id); }) : null,
      edit && prev ? b('indent', '들여쓰기', () => { const k = T.kids(prev.id); act('treeMove', { id: c.id, parent: prev.id, ord: (k.length ? k[k.length - 1].ord || 0 : 0) + 1 }); folded.delete(prev.id); }, '', true) : null,
      edit && par ? b('outdent', '내어쓰기', () => { const up = T.kids(par.parent && B.cards[par.parent] ? par.parent : ''); act('treeMove', { id: c.id, parent: par.parent || '', ord: ordAfter(up, up.indexOf(par)) }); }, '', true) : null,
      edit && prev ? b('up', '위로', () => { const pp = sibs[i - 2]; act('treeMove', { id: c.id, parent: c.parent || '', ord: pp ? ((pp.ord || 0) + (prev.ord || 0)) / 2 : (prev.ord || 0) - 1 }); }, '', true) : null,
      edit && next ? b('down', '아래로', () => { const nn = sibs[i + 2]; act('treeMove', { id: c.id, parent: c.parent || '', ord: nn ? ((next.ord || 0) + (nn.ord || 0)) / 2 : (next.ord || 0) + 1 }); }, '', true) : null,
      teacher && waiting(c) ? b('check', '허락', () => act('moderate', { id: c.id, ok: true }), 'ok') : null,
      teacher ? b(c.hidden ? 'eye' : 'eyeOff', c.hidden ? '다시 보이기' : '아이들에게 가리기', () => act('moderate', { id: c.id, hidden: !c.hidden }), '', true) : null,
      edit ? b('trash', '지우기', () => { if (confirm('이 항목을 지울까요? 밑에 있던 것은 한 칸 위로 올라가요.')) act('removeInTree', { id: c.id }); }, 'danger', true) : null,
    ].filter(Boolean);
    return h('div', { class: 'card-tools', onpointerdown: e => e.stopPropagation() }, items);
  }
  function renderTree() {
    const T = treeOf(B, visible), list = h('div', { class: 'tr-list' });
    const row = (c, depth) => {
      const kids = T.kids(c.id), f = folded.has(c.id);
      const el = h('div', { class: 'tr-row', style: { paddingLeft: depth * 30 + 'px' } },
        h('button', { class: 'tr-fold' + (kids.length ? '' : ' leaf'), title: kids.length ? (f ? '펴기' : '접기') : '', onclick: e => { e.stopPropagation(); if (!kids.length) return; if (f) folded.delete(c.id); else folded.add(c.id); render(); } }, kids.length ? (f ? '▸' : '▾') : '•'),
        h('div', { class: cardClass(c, ' tcard' + (depth === 0 ? ' root' : '')) }, cardText(c), f && kids.length ? h('span', { class: 'tr-cnt' }, `밑에 ${kids.length}`) : null, cardBadges(c), cardMeta(c), sel === c.id ? treeTools(c, T) : null));
      el.querySelector('.tcard').addEventListener('click', e => { if (e.target.closest('.card-tools, .heart')) return; tapCard(c.id); });
      list.append(el);
      if (!f) kids.forEach(k => row(k, depth + 1));
    };
    const roots = T.kids('');
    roots.forEach(c => row(c, 0));
    const unk = Object.values(B.cards).filter(visible).filter(c => c.kind === 'unknown');
    const empties = S.hints && roots.length > 1 ? roots.filter(r => !T.kids(r.id).length && roots.some(o => T.kids(o.id).length)) : [];
    flow.append(h('div', { class: 'tr-wrap' },
      roots.length ? list : h('div', { class: 'fl-empty' }, open() ? '큰 주제부터 하나 써 볼까요? 오른쪽 아래 [주제 더하기]' : '아직 주제가 없어요'),
      empties.length ? h('div', { class: 'st-coach' }, empties.map(r => h('span', {}, `'${r.text.slice(0, 12)}' 밑이 아직 비어 있어요`))) : null,
      unk.length ? h('div', { class: 'tr-unk' }, h('b', {}, '❔ 아직 안 정한 것'), h('div', { class: 'st-mats' }, unk.map(c => flowCard(c)))) : null));
  }

  // ─────────── 카드 끌기 · 누르기(자유 배치)
  function bindCard(el, id) {
    el.addEventListener('pointerdown', e => {
      if (e.button > 0 || e.target.closest('.card-tools, .heart')) return;
      e.stopPropagation();
      const c = B.cards[id];
      const sx = e.clientX, sy = e.clientY, ox = c.x, oy = c.y, mv0 = canMove(c);
      let moved = false;
      try { el.setPointerCapture(e.pointerId); } catch {}
      const mv = ev => {
        if (!mv0) return;
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        if (!moved) { moved = true; busy++; el.classList.add('drag'); }
        el.style.left = ox + (ev.clientX - sx) / view.s + 'px';
        el.style.top = oy + (ev.clientY - sy) / view.s + 'px';
        renderLinks();
      };
      const up = async ev => {
        el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
        if (!moved) return tapCard(id);
        el.classList.remove('drag');
        const x = Math.round(ox + (ev.clientX - sx) / view.s), y = Math.round(oy + (ev.clientY - sy) / view.s);
        const zone = zoneAt(zones, x + CW / 2, y + el.offsetHeight / 2);
        busy--;
        await act('moveCard', { id, x, y, zone });
        flush();
      };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
  }

  function tapCard(id) {
    if (tv) return;
    if (linkFrom !== null) {
      if (linkFrom === '') { linkFrom = id; banner.textContent = '이제 이어질 카드를 누르세요 · Esc = 그만'; render(); return; }
      if (linkFrom !== id) act('addLink', { from: linkFrom, to: id });
      setLink(null);
      return;
    }
    if (sel === id) { if (canEdit(B.cards[id])) editCard(id); return; }
    sel = id; render();
  }

  function setLink(v) {
    linkFrom = v; sel = null;
    banner.textContent = v === null ? '' : v === '' ? '🔗 화살표가 시작할 카드를 누르세요 · Esc = 그만' : '이제 이어질 카드를 누르세요 · Esc = 그만';
    banner.classList.toggle('on', v !== null);
    render();
  }
  function setPin(v) {
    pinMode = v; sel = null;
    banner.textContent = v ? '📍 그림에서 찾은 곳을 누르세요 · Esc = 그만' : '';
    banner.classList.toggle('on', v);
    render();
  }

  // ─────────── 바탕: 끌어서 보기 · 두 손가락 확대 · 휠(자유 배치)
  const pts = new Map();
  let pan = null, pinch = null;
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('.card, .zone-head, .tb-link-hit')) return;
    try { stage.setPointerCapture(e.pointerId); } catch {}
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) pan = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
    else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: view.s, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      pan = null;
    }
  });
  stage.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      zoomAt(pinch.cx, pinch.cy, pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d);
    } else if (pan) {
      const dx = e.clientX - pan.sx, dy = e.clientY - pan.sy;
      if (Math.hypot(dx, dy) > 4) pan.moved = true;
      view.x = pan.vx + dx; view.y = pan.vy + dy; applyView();
    }
  });
  const endPt = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pan && !pan.moved && pts.size === 0) { // 바탕 누름 = 고르기 풀기
      if (linkFrom !== null) setLink(null);
      else if (sel) { sel = null; render(); }
    }
    if (pts.size < 2) pinch = null;
    if (pts.size === 0) pan = null;
  };
  stage.addEventListener('pointerup', endPt);
  stage.addEventListener('pointercancel', endPt);
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey) zoomAt(e.clientX, e.clientY, view.s * Math.exp(-e.deltaY * 0.01));
    else { view.x -= e.deltaX; view.y -= e.deltaY; applyView(); }
  }, { passive: false });
  flow.addEventListener('click', e => { if (sel && !e.target.closest('.card, .pin')) { sel = null; render(); } });

  function applyView() { world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`; }
  function zoomAt(px, py, s) {
    const r = stage.getBoundingClientRect();
    s = clamp(s, 0.3, 2.2);
    const wx = (px - r.left - view.x) / view.s, wy = (py - r.top - view.y) / view.s;
    view.s = s; view.x = px - r.left - wx * s; view.y = py - r.top - wy * s;
    applyView();
  }
  function zoomBy(k) { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, view.s * k); }
  function fit() {
    const r = stage.getBoundingClientRect();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x, y, w, hh) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + hh); };
    for (const z of zones) add(z.x, z.y - 48, ZW, 468); // 위 48 = 힌트 말풍선 자리
    for (const c of Object.values(B.cards)) if (visible(c)) add(c.x, c.y, CW, 70);
    if (!isFinite(x0)) { view.s = 1; view.x = r.width / 2 - CW / 2; view.y = r.height / 3; return applyView(); }
    const pad = 40;
    view.s = clamp(Math.min((r.width - pad * 2) / (x1 - x0), (r.height - pad * 2) / (y1 - y0)), 0.4, 1.15);
    view.x = (r.width - (x1 - x0) * view.s) / 2 - x0 * view.s;
    view.y = pad - y0 * view.s;
    applyView();
  }

  // ─────────── 글 쓰기 창
  //  colors: 색 고르기 · cols: 칸 고르기(칸 나누기에서 위 ＋로 쓸 때) · spines: 이어 주는 말 고르기(이야기 줄 — 글 앞에 붙는 말)
  function openEditor({ title, text = '', placeholder = '', color = '', zone = '', cols = null, spines = null, spine = '', onSave }) {
    busy++;
    const max = S.maxLen || 40;
    const ta = h('textarea', { maxlength: max, placeholder, rows: max > 80 ? 4 : 3 });
    ta.value = text;
    const cnt = h('span', { class: 'cnt' });
    const upd = () => { cnt.textContent = `${ta.value.length}/${max}`; };
    ta.addEventListener('input', upd); upd();
    let col = color;
    const dots = S.colors ? h('div', { class: 'ed-colors' }, COLORS.map(cv => h('button', {
      class: 'dot' + (cv ? ' c-' + cv : ' c-none') + (cv === col ? ' on' : ''), title: COLOR_NAME[cv], type: 'button',
      onclick: e => { col = cv; dots.querySelectorAll('.dot').forEach(d => d.classList.remove('on')); e.currentTarget.classList.add('on'); } }))) : null;
    const zsel = cols && cols.length ? h('select', { class: 'ed-zone' }, cols.map(z => h('option', { value: z, selected: z === zone }, z))) : null;
    let sp = spine;
    const spRow = spines && spines.length ? h('div', { class: 'ed-spines' }, h('span', { class: 'sub' }, '이어 주는 말'), ['', ...spines].map(w => h('button', { type: 'button', class: 'chip' + (w === sp ? ' on' : ''),
      onclick: e => { sp = w; spRow.querySelectorAll('.chip').forEach(x => x.classList.remove('on')); e.currentTarget.classList.add('on'); ta.focus(); } }, w || '없음'))) : null;
    const close = () => { wrap.remove(); busy--; flush(); };
    const save = () => { const v = ta.value.trim().replace(/\s+/g, ' '); if (!v) return ta.focus(); close(); onSave(v, { color: col, zone: zsel ? zsel.value : zone, spine: sp }); };
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); save(); }
      if (e.key === 'Escape') close();
    });
    const wrap = h('div', { class: 'editor-wrap', onpointerdown: e => { if (e.target === wrap) close(); } },
      h('div', { class: 'editor' },
        title ? h('div', { class: 'ed-title' }, title) : null,
        zsel ? h('div', { class: 'ed-row' }, h('span', { class: 'sub' }, '어느 칸에?'), zsel) : null,
        spRow, ta, dots,
        h('div', { class: 'ed-row' }, cnt, h('div', { class: 'grow' }),
          h('button', { class: 'btn', onclick: close }, '취소'),
          h('button', { class: 'btn primary', onclick: save }, '저장'))));
    document.body.append(wrap);
    setTimeout(() => ta.focus(), 30);
  }

  function viewCenter() {
    const r = stage.getBoundingClientRect();
    if (!r.width) return freeSpot(B, 40, 40);   // 흐르는 판: 자유 배치로 바꿀 때를 위한 자리만
    return freeSpot(B, Math.round((r.width / 2 - view.x) / view.s - CW / 2), Math.round((r.height / 2 - view.y) / view.s - 30));
  }
  const placeFor = zone => (zone && canvasMode() && slotIn(B, zones, zone)) || viewCenter();
  const zoneOf = (p, zone) => zone || (canvasMode() ? zoneAt(zones, p.x + CW / 2, p.y + 30) : '');

  function addIn(zone, kind = 'idea', pin = null) {
    const cols = S.layout === 'columns' && !zone ? colNames() : null;
    openEditor({
      title: kind === 'unknown' ? '❔ 아직 안 정한 것' : pin ? `📍 ${pin.i + 1}번 그림에 핀` : zone ? `${zone}에 카드 더하기` : '새 카드',
      placeholder: kind === 'unknown' ? '예: 괴물이 나올까? 아직 모르겠어' : pin ? '무엇이 달라졌나요?' : '짧게, 한 가지만',
      cols, zone: cols ? cols[0] : zone,
      onSave: (text, o) => { const z = o.zone || zone; const p = placeFor(z); act('addCard', { text, kind, x: p.x, y: p.y, zone: zoneOf(p, z), color: o.color || undefined, pin: pin || undefined }); },
    });
  }
  function editCard(id) {
    const c = B.cards[id];
    openEditor({ title: '카드 고치기', text: c.text, color: c.color || '', onSave: (text, o) => {
      act('editCard', { id, text });
      if (S.colors && (o.color || '') !== (c.color || '')) store.patch(boardId, { ['cards.' + id + '.color']: o.color || null });
    } });
  }

  // ─────────── 우편함 · 결과물
  function togglePanel(p) { panel = panel === p ? null : p; render(); if (canvasMode()) requestAnimationFrame(fit); }

  function renderPanel() {
    drawer.classList.toggle('open', !!panel);
    root.classList.toggle('panel-open', !!panel);
    drawer.innerHTML = '';
    if (!panel) return;
    drawer.append(h('div', { class: 'dr-head' }, panel === 'mail' ? '우편함' : panel === 'who' ? '누가 썼나' : '결과물',
      h('button', { class: 'x', onclick: () => togglePanel(panel) }, '✕')));
    if (panel === 'mail') renderMail(); else if (panel === 'who') renderWho(); else renderResults();
  }

  async function judge(m, action, extra = {}) {
    const z = m.zone && zoneNames(B).includes(m.zone) ? m.zone : '';
    const p = placeFor(z);
    pick.delete(m.id);
    const r = await act('judgeMail', { id: m.id, action, x: p.x, y: p.y, zone: zoneOf(p, z) || z, ...extra });
    if (r.id) toast('판에 붙였어요');
  }

  function renderMail() {
    const all = Object.values(B.mail).sort((a, z) => a.t - z.t);
    const fresh = all.filter(m => m.status === 'new'), old = all.filter(m => m.status !== 'new');
    if (!fresh.length) drawer.append(h('div', { class: 'dr-empty' }, '새 카드가 없어요'));
    for (const m of fresh) {
      const p = pick.get(m.id);
      const btn = (label, fn, cls = '') => h('button', { class: 'mbtn ' + cls, onclick: fn }, label);
      const chips = (list, action) => h('div', { class: 'chips' },
        h('div', { class: 'chips-q' }, '왜 그렇게 했나요?'),
        list.map(r => btn(r, () => judge(m, action, { reason: r }), 'chip')),
        btn('← 다시', () => { pick.delete(m.id); renderPanel(); }, 'back'));
      let actions;
      if (teacher) actions = h('div', { class: 'sub' }, '아이들이 판단해요');   // 판단은 아이 몫(연구 원칙)
      else if (m.type === 'suggest') {
        actions = p === 'keep' ? chips(REASONS.keep, 'keep')
          : p === 'drop' ? chips(REASONS.drop, 'drop')
          : h('div', { class: 'mbtns' },
            btn('가져오기', () => { pick.set(m.id, 'keep'); renderPanel(); }),
            btn('고쳐서 가져오기', () => openEditor({ title: '우리 말로 고치기', text: m.text, onSave: text => judge(m, 'edit', { text }) })),
            btn('버리기', () => { pick.set(m.id, 'drop'); renderPanel(); }, 'ghost'));
      } else {
        actions = p === 'qdrop' ? chips(REASONS.qdrop, 'drop')
          : h('div', { class: 'mbtns' },
            btn('답하기', () => openEditor({ title: '❓ ' + m.text, placeholder: '우리 생각을 짧게', onSave: text => judge(m, 'answer', { text }) })),
            btn('❔로 남기기', () => judge(m, 'unknown', { reason: '아직 모르겠어' })),
            btn('필요 없어요', () => { pick.set(m.id, 'qdrop'); renderPanel(); }, 'ghost'));
      }
      drawer.append(h('div', { class: 'mail ' + m.type },
        h('div', { class: 'mail-kind' }, m.type === 'question' ? '❓ 질문' : '💡 제안', m.zone ? h('span', { class: 'zchip' }, m.zone) : null),
        h('div', { class: 'mail-text' }, m.text),
        m.why ? h('div', { class: 'mail-why' }, '└ 왜? ', m.why) : null,
        actions));
    }
    if (old.length) {
      const lbl = { keep: '그대로 가져옴', edit: '고쳐서 가져옴', drop: '버림', answer: '답함', unknown: '❔로 남김' };
      drawer.append(h('details', { class: 'mail-old' }, h('summary', {}, `지난 카드 ${old.length}장`),
        old.map(m => h('div', { class: 'old' }, m.type === 'question' ? '❓ ' : '💡 ', m.text,
          h('span', { class: 'st' }, ` → ${lbl[m.status] || m.status}${m.reason ? ` · ${m.reason}` : ''}`)))));
    }
  }

  // 선생님: RPG 명단으로 아직 안 쓴 아이 · 쓴 아이(장수)
  function renderWho() {
    const n = new Map();
    for (const c of Object.values(B.cards)) if (kidCard(c)) { const k = c.sid || c.by; n.set(k, (n.get(k) || 0) + 1); }
    const yet = roster.filter(r => !n.has(r.id) && !n.has(r.name)), did = roster.filter(r => n.has(r.id) || n.has(r.name));
    drawer.append(h('div', { class: 'who-sec' }, h('div', { class: 'who-h' }, `아직 안 쓴 아이 ${yet.length}명`),
      yet.length ? h('div', { class: 'who-list' }, yet.map(r => h('span', { class: 'who-chip yet' }, r.name))) : h('div', { class: 'dr-empty' }, '모두 썼어요')));
    drawer.append(h('div', { class: 'who-sec' }, h('div', { class: 'who-h' }, `쓴 아이 ${did.length}명`),
      h('div', { class: 'who-list' }, did.map(r => h('span', { class: 'who-chip' }, r.name, h('b', {}, n.get(r.id) || n.get(r.name)))))));
  }

  function renderResults() {
    const list = Object.values(B.results).sort((a, z) => z.t - a.t);
    if (!list.length) drawer.append(h('div', { class: 'dr-empty' }, '아직 붙인 결과물이 없어요'));
    for (const r of list) drawer.append(h('a', { class: 'res', href: r.url, target: '_blank', rel: 'noopener' }, '🔗 ', r.title || r.url));
    if (!open()) return;
    const t = h('input', { placeholder: '이름 (예: 1차 이야기)' }), u = h('input', { placeholder: '주소 https://…' });
    drawer.append(h('div', { class: 'res-add' }, t, u, h('button', {
      class: 'btn', onclick: () => {
        const url = u.value.trim();
        if (!/^https?:\/\//.test(url)) return toast('https:// 로 시작하는 주소를 넣어 주세요');
        act('addResult', { url, title: t.value.trim() });
      },
    }, '결과물 붙이기')));
  }

  // 구독은 맨 끝에 — 로컬 저장소는 바로 한 번 부르므로, 위의 const 도구들이 먼저 서 있어야 한다
  const unsub = store.subscribe(boardId, b => {
    B = b;
    if (busy) pending = true; else render();
  });

  const onKey = e => {
    if (e.key === 'Escape' && !document.querySelector('.editor-wrap')) {
      if (pinMode) setPin(false); else if (linkFrom !== null) setLink(null); else if (sel) { sel = null; render(); }
    }
  };
  window.addEventListener('keydown', onKey);
  const onResize = () => { if (canvasMode()) applyView(); else if (B && (S.layout === 'wall' || S.layout === 'pins')) render(); };
  window.addEventListener('resize', onResize);

  return () => { unsub(); root.classList.remove('panel-open', 'tv', 'teacher-view', 'has-prompt'); window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); document.querySelector('.editor-wrap')?.remove(); };
}
