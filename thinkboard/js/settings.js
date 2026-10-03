// 판 설정 — 패들렛처럼 선생님이 이것저것 고르는 '만능 설정 틀'.
//  설정 하나 = 아래 표 한 줄. 선생님 설정판(teacher.js)은 이 표를 보고 저절로 그려진다 → 새 설정은 여기 한 줄만 더한다.
//  판 틀(templates.js)의 settings 는 이 표의 값을 미리 골라 둔 것(달라진 점 찾기 · 출구 카드 …).
//
//  연구 원칙(바꾸지 말 것):
//   · 우편함(AI 카드 → 아이 판단 → 카드)은 설정으로 없앨 수 없다. 'off' 는 'AI 카드를 보내지 않음'일 뿐이다.
//   · '선생님이 허락한 카드만'은 아이가 직접 쓴 카드에만 걸린다(우편함에서 판단해 붙인 카드는 그대로).
//   · 공감 수는 기록만 한다 — RPG 골드 · 보상과 묶지 않는다(묶을지는 사용자 결정).
//   · 설정을 바꾸면 log 에 남는다(model.js setSettings) — 발판을 언제 줄였는지가 연구 자료다.
import { h } from './util.js';

export const LAYOUTS = { canvas: '자유 배치(끌어서 어디든)', columns: '칸 나누기', wall: '담벼락(차곡차곡)', stream: '한 줄로', pins: '그림에 핀 꽂기' };
export const BGS = { paper: '종이', sky: '하늘', mint: '민트', peach: '살구', grape: '포도', night: '밤' };
export const COLORS = ['', 'yellow', 'pink', 'green', 'blue', 'purple'];   // '' = 기본(출처 색)

// type: select(options) · toggle · text · list(쉼표로 나눔) · images(주소 둘)
// show(설정값) — 이 판 모양에서만 보이는 칸
export const SCHEMA = [
  { sec: '🖼 모양', items: [
    { key: 'layout', label: '판 모양', type: 'select', options: LAYOUTS, def: 'canvas' },
    { key: 'cols', label: '칸 이름', type: 'list', def: [], show: s => s.layout === 'columns' || s.layout === 'canvas',
      help: '쉼표로 나눠 적어요(예: 좋은 점, 아쉬운 점). 비우면 판 틀의 칸을 써요.' },
    { key: 'prompt', label: '질문 · 안내(판 맨 위)', type: 'text', def: '', help: '예: 두 그림에서 달라진 곳을 찾아 핀을 꽂아요' },
    { key: 'images', label: '그림(주소 · 2장까지)', type: 'images', def: [], help: '그림에 핀 꽂기 · 질문 그림으로 써요. https:// 주소' },
    { key: 'bg', label: '바탕', type: 'select', options: BGS, def: 'paper' },
  ] },
  { sec: '✏️ 쓰기', items: [
    { key: 'open', label: '아이들이 쓸 수 있어요', type: 'toggle', def: true, help: '끄면 보기만 해요(쓰기 쉬는 시간)' },
    { key: 'limit', label: '한 사람이 쓰는 카드', type: 'select', options: { 0: '마음껏', 1: '1장', 2: '2장', 3: '3장', 5: '5장' }, def: 0, num: true },
    { key: 'maxLen', label: '카드 글자 수', type: 'select', options: { 40: '40자', 80: '80자', 140: '140자', 200: '200자' }, def: 40, num: true },
    { key: 'colors', label: '카드 색 고르기', type: 'toggle', def: false },
    { key: 'unknown', label: '❔ 모르는 것 카드', type: 'toggle', def: true },
    { key: 'links', label: '🔗 화살표 잇기', type: 'toggle', def: true, show: s => s.layout === 'canvas' },
    { key: 'move', label: '카드 옮기기', type: 'select', options: { all: '누구나', own: '내 카드만', none: '못 옮겨요' }, def: 'all', show: s => s.layout === 'canvas' || s.layout === 'columns' },
    { key: 'edit', label: '고치기 · 지우기', type: 'select', options: { all: '누구나(모둠 판)', own: '내 카드만' }, def: 'all' },
  ] },
  { sec: '👀 보기', items: [
    { key: 'names', label: '쓴 사람 이름', type: 'select', options: { off: '안 보여요', show: '보여요', anon: '친구에겐 익명(선생님은 봐요)' }, def: 'off' },
    { key: 'others', label: '친구 카드 보기', type: 'toggle', def: true, help: '끄면 자기 카드만 보여요(출구 카드 · 비밀 답)' },
    { key: 'approve', label: '선생님이 허락한 카드만 친구에게 보여요', type: 'toggle', def: false, help: '아이가 직접 쓴 카드에만 걸려요' },
    { key: 'sort', label: '카드 순서', type: 'select', options: { old: '먼저 쓴 것이 앞', new: '새 것이 앞' }, def: 'old', show: s => s.layout !== 'canvas' },
  ] },
  { sec: '❤️ 반응', items: [
    { key: 'react', label: '공감', type: 'select', options: { off: '없음', heart: '❤️ 공감' }, def: 'off', help: '공감 수는 기록만 해요 — 보상과 묶지 않아요' },
  ] },
  { sec: '🪜 도움(발판)', items: [
    { key: 'mail', label: '우편함(AI 카드)', type: 'select', options: { qs: '질문 + 제안', q: '질문만', off: '보내지 않아요' }, def: 'qs',
      help: 'AI 카드는 늘 우편함으로 오고, 아이가 판단해야 판에 붙어요. 발판은 줄여 가요.' },
    { key: 'zones', label: '구역 틀 보이기', type: 'toggle', def: true, show: s => s.layout === 'canvas' },
    { key: 'hints', label: '바로 뜨는 힌트', type: 'toggle', def: true },
  ] },
];

const ITEMS = SCHEMA.flatMap(s => s.items);
export const DEFAULTS = Object.fromEntries(ITEMS.map(i => [i.key, i.def]));
export const withDefaults = s => ({ ...DEFAULTS, ...(s || {}) });

// 판의 칸 이름 — 설정 칸 이름이 있으면 그것, 없으면 판 틀의 구역
export const zoneNames = b => (b.settings?.cols?.length ? b.settings.cols : b.template?.zones || []);

// 선생님 설정판: 표를 보고 그린다. read() = 지금 고른 값
export function settingsForm(current) {
  const s = withDefaults(current);
  const inputs = new Map(), rows = [];
  const val = () => {
    const out = {};
    for (const it of ITEMS) {
      const el = inputs.get(it.key);
      if (it.type === 'toggle') out[it.key] = el.checked;
      else if (it.type === 'list') out[it.key] = el.value.split(/[,，]/).map(x => x.trim()).filter(Boolean).slice(0, 8);
      else if (it.type === 'images') out[it.key] = el.map(i => i.value.trim()).filter(u => /^(https?:\/\/|\/|\.\.?\/)/.test(u)).slice(0, 2);
      else if (it.num) out[it.key] = +el.value;
      else out[it.key] = el.value;
    }
    return out;
  };
  const refresh = () => { const v = val(); for (const [it, row] of rows) row.style.display = !it.show || it.show(v) ? '' : 'none'; };
  const field = it => {
    let el;
    if (it.type === 'select') el = h('select', { onchange: refresh }, Object.entries(it.options).map(([v, l]) => h('option', { value: v, selected: String(s[it.key]) === String(v) }, l)));
    else if (it.type === 'toggle') el = h('input', { type: 'checkbox', checked: !!s[it.key], onchange: refresh });
    else if (it.type === 'list') { el = h('input', { placeholder: '쉼표로 나눠요', oninput: refresh }); el.value = (s[it.key] || []).join(', '); }
    else if (it.type === 'images') el = [0, 1].map(i => { const x = h('input', { placeholder: `그림 ${i + 1} 주소 https://…` }); x.value = (s[it.key] || [])[i] || ''; return x; });
    else { el = h('input', { placeholder: it.help || '' }); el.value = s[it.key] || ''; }
    inputs.set(it.key, el);
    const row = it.type === 'toggle'
      ? h('label', { class: 'set-row tog' }, el, h('span', {}, it.label), it.help ? h('span', { class: 'set-help' }, it.help) : null)
      : h('label', { class: 'set-row' }, h('span', { class: 'set-lab' }, it.label), h('span', { class: 'set-in' }, el), it.help && it.type !== 'text' ? h('span', { class: 'set-help' }, it.help) : null);
    rows.push([it, row]);
    return row;
  };
  const el = h('div', { class: 'set-form' }, SCHEMA.map(sec => h('fieldset', { class: 'set-sec' }, h('legend', {}, sec.sec), sec.items.map(field))));
  refresh();
  return { el, read: val };
}
