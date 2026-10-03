// 아이 화면: 판 하나. 카드 · ❔ · 화살표 · 구역 · 우편함 · 결과물.
//  [설정 틀] 판 모양(자유 배치 · 칸 나누기 · 담벼락 · 한 줄 · 그림에 핀 꽂기)과 쓰기 · 보기 · 반응 설정을 따른다(settings.js 표).
//  teacher: 선생님이 보는 판(이름 늘 보임 · 허락 · 가리기 · 맨 앞 고정) · tv: 교실 TV(크게 · 보기만)
import { h, toast } from './util.js';
import { ops, REASONS } from './model.js';
import { zoneLayout, zoneAt, slotIn, freeSpot, estH, evalHints, ZW, ZHEAD, CW } from './templates.js';
import { withDefaults, zoneNames, COLORS } from './settings.js';
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
    fab.append(S.layout === 'pins'
      ? h('button', { class: 'fab' + (pinMode ? ' on' : '') + (add ? '' : ' dim'), onclick: () => { if (canAdd(true)) setPin(!pinMode); } }, icon(pinMode ? 'x' : 'mapPin', 20), h('span', {}, pinMode ? '그만' : '핀 꽂기' + left))
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
  //  colors: 색 고르기 · cols: 칸 고르기(칸 나누기에서 위 ＋로 쓸 때)
  function openEditor({ title, text = '', placeholder = '', color = '', zone = '', cols = null, onSave }) {
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
    const close = () => { wrap.remove(); busy--; flush(); };
    const save = () => { const v = ta.value.trim().replace(/\s+/g, ' '); if (!v) return ta.focus(); close(); onSave(v, { color: col, zone: zsel ? zsel.value : zone }); };
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); save(); }
      if (e.key === 'Escape') close();
    });
    const wrap = h('div', { class: 'editor-wrap', onpointerdown: e => { if (e.target === wrap) close(); } },
      h('div', { class: 'editor' },
        title ? h('div', { class: 'ed-title' }, title) : null,
        zsel ? h('div', { class: 'ed-row' }, h('span', { class: 'sub' }, '어느 칸에?'), zsel) : null,
        ta, dots,
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
