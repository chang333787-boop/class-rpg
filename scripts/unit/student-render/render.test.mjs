#!/usr/bin/env node
// 우리반 성장 RPG — 학생 화면 그려 보기 시험 (STUDENT-RENDER-1, read-only · 브라우저 없음 · 운영 통신 0)
//
//  10-04 student.js 를 student/*.js 로 나눴다(클래식 <script> · 전역 공유). 전역 이름 하나만 빠져도(파일 한 줄 빠짐 · 함수 이름 틀림)
//  홈이 '화면을 여는 중에 문제가 생겼어요'로 바뀌는데, smoke 는 글자만 보고 런타임은 안 본다. 이 시험이 그 빈 곳을 막는다.
//
//  하는 일:
//   1) node vm 한 칸에 student.html 의 <script src> 를 **실제 순서대로** 싣는다
//      (gamedata*.js = gamedata-sources.mjs · curriculum 류 = html 태그 · student.js + student/*.js = student-sources.mjs, 늦게 부르는 deco.js 는 맨 뒤).
//      클래식 스크립트끼리 let/const 를 나눠 보는 것도 브라우저와 같다(같은 vm 칸의 전역 어휘 환경).
//   2) 최소 DOM 흉내(getElementById 가 같은 id 면 같은 가짜 요소 · innerHTML 을 담아 둠) · 타이머는 시험이 부를 때만 돎 · firebase 는 다 받아 넘기는 흉내.
//   3) DB._cache 에 견본 학급(_defaultData → _normalizeArrays → _migrate) · CUR = 견본 학생(장비·책·퀘스트·보상 대기 조금).
//   4) 홈(renderAll → buildMainHTML 네 구역)·상점·인벤·사냥터·퀘스트·승급·감정·주간·독서·공부·작품 그리기 함수를 불러
//      **예외 0** 과 결과 HTML 의 기대 조각을 본다. 싣는 중 오류·console.error·처리 안 된 약속 거절도 FAIL.
//   5) 감정 보상 · 업적 보상으로 레벨이 오르면 축하(triggerLevelUp)가 한 번 — 스냅샷이 돌아와도 두 번 안 뜸 [LVUP-FX-1].
//  사용: node scripts/unit/student-render/render.test.mjs   (FAIL 이면 exit 1 · precheck 가 저절로 모은다)
//  옵션(시험의 시험): --drop <파일>  그 파일을 빼고 싣는다(예: --drop student/battle.js → FAIL 이어야 맞다)

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { studentScriptFiles, LAZY_STUDENT_FILES } from '../student-sources.mjs';
import { gamedataScriptFiles } from '../gamedata-sources.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const argv = process.argv.slice(2);
const DROP = new Set(argv.flatMap((a, i) => (a === '--drop' ? [argv[i + 1]] : [])));

// ── 실을 파일 목록: student.html 의 로컬 <script src> 순서 그대로(바깥 CDN 제외) ──
function pageScripts() {
  const html = read('student.html');
  const tags = [];
  for (const m of html.matchAll(/<script\b([^>]*)>/g)) {
    const src = (m[1].match(/\bsrc="([^"]+)"/) || [])[1];
    if (!src || /^https?:/.test(src)) continue;
    const f = src.split('?')[0].replace(/^\.\//, '');
    if (!tags.includes(f)) tags.push(f);
  }
  const gd = gamedataScriptFiles(ROOT), st = studentScriptFiles(ROOT);
  const lazy = st.filter(f => LAZY_STUDENT_FILES.includes(f));
  // gamedata 묶음·학생 묶음은 시험 공용 목록(단일 출처)을 쓰고, 나머지 태그(curriculum 류)는 html 자리 그대로
  const out = [];
  for (const f of tags) {
    if (gd.includes(f)) { if (f === 'gamedata.js') out.push(...gd); continue; }
    if (st.includes(f)) { if (f === 'student.js') out.push(...st.filter(x => !lazy.includes(x))); continue; }
    out.push(f);
  }
  if (!out.includes('student.js')) throw new Error('student.html 에 student.js 태그가 없음');
  return [...out, ...lazy];   // 늦게 부르는 파일(deco.js)은 페이지에서도 다른 파일이 다 돈 뒤
}

// ── 흉내 도구 ──
const ANY = new Proxy(function () {}, {
  get(t, k) {
    if (k === Symbol.toPrimitive) return () => '';
    if (k === Symbol.iterator) return function* () {};
    if (k === 'then') return (a, b) => Promise.resolve(undefined).then(a, b);
    if (k === 'length') return 0;
    if (k === 'toString' || k === 'valueOf') return () => '';
    return ANY;
  },
  apply() { return ANY; },
  construct() { return ANY; },
  set() { return true; },
});

function makeStyle() {
  const st = { cssText: '' };
  st.setProperty = (k, v) => { st[k] = v; };
  st.removeProperty = (k) => { delete st[k]; };
  st.getPropertyValue = (k) => st[k] || '';
  return st;
}
function makeClassList() {
  const s = new Set();
  return {
    add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)),
    toggle: (c, f) => { const on = f === undefined ? !s.has(c) : !!f; on ? s.add(c) : s.delete(c); return on; },
    contains: (c) => s.has(c), replace: (a, b) => { s.delete(a); s.add(b); }, get length() { return s.size; },
    forEach: (fn) => s.forEach(fn), toString: () => [...s].join(' '),
  };
}
const RECT = { x: 0, y: 0, top: 0, left: 0, right: 1366, bottom: 610, width: 1366, height: 610 };
function makeEl(tag, id) {
  const attrs = {};
  const el = {
    tagName: String(tag || 'div').toUpperCase(), nodeName: String(tag || 'div').toUpperCase(), nodeType: 1,
    id: id || '', className: '', innerHTML: '', outerHTML: '', textContent: '', innerText: '', value: '', src: '', href: '',
    checked: false, disabled: false, hidden: false, scrollTop: 0, scrollLeft: 0, scrollHeight: 0, scrollWidth: 0,
    offsetWidth: 1366, offsetHeight: 610, clientWidth: 1366, clientHeight: 610, width: 300, height: 150,
    style: makeStyle(), classList: makeClassList(), dataset: {}, children: [], childNodes: [], options: [],
    firstChild: null, lastChild: null, firstElementChild: null, nextElementSibling: null, previousElementSibling: null,
    parentNode: null, parentElement: null, files: [],
    appendChild: (c) => c, append() {}, prepend() {}, insertBefore: (c) => c, removeChild: (c) => c, replaceChild: (c) => c,
    remove() {}, replaceChildren() {}, before() {}, after() {}, replaceWith() {},
    setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => (k in attrs ? attrs[k] : null),
    removeAttribute: (k) => { delete attrs[k]; }, hasAttribute: (k) => k in attrs, toggleAttribute() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
    querySelector: () => makeEl('div'), querySelectorAll: () => [], getElementsByTagName: () => [], getElementsByClassName: () => [],
    closest: () => null, matches: () => false, contains: () => false,
    getBoundingClientRect: () => ({ ...RECT }), getClientRects: () => [],
    focus() {}, blur() {}, click() {}, select() {}, scrollTo() {}, scrollBy() {}, scrollIntoView() {},
    insertAdjacentHTML(pos, h) { el.innerHTML += h; }, insertAdjacentElement: (p, c) => c,
    cloneNode: () => makeEl(tag), getContext: () => ANY, toDataURL: () => 'data:,', toBlob() {},
    play: () => Promise.resolve(), pause() {}, load() {}, reset() {}, submit() {}, showModal() {}, close() {},
    animate: () => ANY, attachShadow: () => makeEl('div'),
  };
  return el;
}

// ── vm 칸 만들기 ──
function buildSandbox(errors) {
  const els = new Map();
  const byId = (id) => { if (!els.has(id)) els.set(id, makeEl('div', id)); return els.get(id); };
  const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } }; };
  const document = {
    getElementById: byId, querySelector: () => makeEl('div'), querySelectorAll: () => [],
    getElementsByTagName: () => [], getElementsByClassName: () => [], getElementsByName: () => [],
    createElement: (t) => makeEl(t), createElementNS: (ns, t) => makeEl(t), createTextNode: (t) => ({ textContent: t }),
    createDocumentFragment: () => makeEl('fragment'),
    body: makeEl('body'), head: makeEl('head'), documentElement: makeEl('html'), activeElement: null,
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
    hidden: false, visibilityState: 'visible', readyState: 'complete', cookie: '', title: '',
    fonts: { ready: Promise.resolve(), load: () => Promise.resolve([]) },
    exitFullscreen: () => Promise.resolve(), fullscreenElement: null,
  };
  const noop = () => {};
  let timerId = 0;
  const timers = [];   // setTimeout 은 저절로 안 돈다 — 시험이 __flushTimers(n) 로 n 바퀴 돌린다(그 전 것은 __dropTimers 로 버림)
  const sb = {
    document, console: { log: noop, info: noop, debug: noop, warn: noop, error: (...a) => errors.push('console.error: ' + a.map(x => (x && typeof x === 'object' && 'message' in x ? errText(x) : String(x))).join(' ').slice(0, 300)) },
    setTimeout: (fn) => { if (typeof fn === 'function') timers.push(fn); return ++timerId; }, clearTimeout: noop, setInterval: () => ++timerId, clearInterval: noop,
    requestAnimationFrame: () => ++timerId, cancelAnimationFrame: noop, queueMicrotask: (f) => queueMicrotask(f),
    localStorage: store(), sessionStorage: store(),
    navigator: { userAgent: 'node-render-test', maxTouchPoints: 0, onLine: true, language: 'ko-KR', vibrate: () => false, clipboard: { writeText: () => Promise.resolve() } },
    location: { href: 'http://localhost/student.html', origin: 'http://localhost', protocol: 'http:', host: 'localhost', hostname: 'localhost', pathname: '/student.html', search: '', hash: '', reload: noop, replace: noop, assign: noop },
    history: { state: null, length: 1, pushState: noop, replaceState: noop, back: noop, forward: noop, go: noop },
    screen: { width: 1366, height: 768, orientation: { type: 'landscape-primary', addEventListener: noop } },
    innerWidth: 1366, innerHeight: 610, outerWidth: 1366, outerHeight: 700, devicePixelRatio: 1, scrollX: 0, scrollY: 0, pageYOffset: 0,
    matchMedia: () => ({ matches: false, media: '', addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop }),
    getComputedStyle: () => makeStyle(), scrollTo: noop, open: () => null, focus: noop, print: noop,
    addEventListener: noop, removeEventListener: noop, dispatchEvent: () => true, postMessage: noop,
    alert: noop, confirm: () => false, prompt: () => null,
    fetch: () => Promise.reject(new Error('시험: 네트워크 없음')),
    Image: function () { return makeEl('img'); }, Audio: function () { return makeEl('audio'); },
    AudioContext: function () { return ANY; }, webkitAudioContext: function () { return ANY; },
    ResizeObserver: function () { return { observe: noop, unobserve: noop, disconnect: noop }; },
    IntersectionObserver: function () { return { observe: noop, unobserve: noop, disconnect: noop }; },
    MutationObserver: function () { return { observe: noop, disconnect: noop, takeRecords: () => [] }; },
    CustomEvent: function (t, o) { return { type: t, detail: o && o.detail }; }, Event: function (t) { return { type: t }; },
    HTMLElement: function () {}, HTMLCanvasElement: function () {}, Node: { ELEMENT_NODE: 1 },
    Blob: globalThis.Blob, URL: globalThis.URL, URLSearchParams: globalThis.URLSearchParams,
    TextEncoder, TextDecoder, structuredClone, performance: { now: () => Date.now() }, crypto: globalThis.crypto,
    Intl, atob, btoa,
    firebase: ANY, Chart: ANY,
  };
  sb.__dropTimers = () => { timers.length = 0; };
  sb.__flushTimers = (n) => { for (let i = 0; i < n; i++) timers.splice(0).forEach(f => f()); };
  sb.window = sb; sb.self = sb; sb.globalThis = sb; sb.top = sb; sb.parent = sb;
  vm.createContext(sb);
  return { sb, els };
}

// ── 시험 틀 ──
const results = [];
// 오류 한 줄: '이름: 뜻 @ 파일:줄' (vm 오류의 stack 첫 줄은 자리만 있어 뜻이 빠진다)
const errText = (e) => {
  if (!e || typeof e !== 'object') return String(e);
  const at = (String(e.stack || '').match(/\(?((?:student|gamedata|curriculum|figures)[\w./-]*\.js:\d+)/) || [])[1] || '';
  return `${e.name || 'Error'}: ${e.message}${at ? ' @ ' + at : ''}`.slice(0, 300);
};
function check(name, fn) {
  try { const r = fn(); results.push([r === true || r === undefined ? 'PASS' : 'FAIL', name, r === true || r === undefined ? '' : String(r)]); }
  catch (e) { results.push(['FAIL', name, errText(e)]); }
}
const need = (html, frags) => {
  const miss = frags.filter(f => !String(html || '').includes(f));
  return miss.length ? `기대 조각 없음: ${miss.map(m => JSON.stringify(m)).join(', ')} (길이 ${String(html || '').length})` : true;
};

const errors = [];
const onRej = (e) => errors.push('처리 안 된 약속 거절: ' + errText(e));
process.on('unhandledRejection', onRej);

const { sb, els } = buildSandbox(errors);
const run = (code, file) => vm.runInContext(code, sb, { filename: file || 'test' });
const html = (id) => (els.get(id) || {}).innerHTML || '';

// 1) 싣기
const FILES = pageScripts().filter(f => !DROP.has(f));
check(`싣기 — student.html 순서 ${FILES.length}개(${FILES.filter(f => f.startsWith('student')).length} 학생 · ${FILES.filter(f => f.startsWith('gamedata')).length} 공유)`, () => {
  const bad = [];
  for (const f of FILES) { try { run(read(f), f); } catch (e) { bad.push(`${f}: ${errText(e)}`); } }
  return bad.length ? bad.join(' / ') : true;
});
check('학생 파일 목록에 battle·emotion·weekly·reading·study·char·art 가 다 있음', () => {
  const want = ['student.js', 'student/char.js', 'student/battle.js', 'student/art.js', 'student/emotion.js', 'student/reading.js', 'student/weekly.js', 'student/study.js', 'student/deco.js'];
  const miss = want.filter(f => !FILES.includes(f));
  return miss.length ? '빠짐: ' + miss.join(', ') : true;
});

// 2) 견본 학급 · 학생
check('견본 학급 넣기(DB._cache · CUR)', () => {
  run(`
    DB._fbRef = firebase; DB._fbAdminRef = firebase;
    DB._cache = DB._migrate(DB._normalizeArrays(DB._defaultData()));
    (function () {
      const s = DB._cache.students[0];
      s.exp = 300; s.level = Utils.levelFromExp(s.exp); s.gold = 1234; s.totalGold = 2000;
      s.pw = 'x'; s.title = '견본'; s.titles = ['견본'];
      const eq = (GAME_DATA.equipment || [])[0];
      if (eq) s.inventory = [{ id: eq.id, qty: 1 }];
      s.books = [{ id: 'b1', title: '견본 책', author: '누구', date: Utils.todayStr(), rating: 4, review: '재밌다' }];
      s.pendingRewards = [{ id: 'p1', label: '견본 보상', exp: 10, gold: 5, approved: false, date: Utils.todayStr() }];
      s.monsterLog = []; s.farm = [];
      DB._cache.questLogs = {};
      DB._cache.quests = [{ id: 'q1', studentId: s.id, name: '견본 퀘스트', exp: 20, gold: 10, date: Utils.todayStr(), approved: true, icon: '📋' }];
      DB._cache.emotionLogs = {};
      DB._cache.weeklyGoals = []; DB._cache.weeklyReflections = [];
      CUR = s; SEL_STUDENT = s.id;
    })();
  `, 'fixture');
  return run('!!(CUR && CUR.id && DB.getStudent(CUR.id) === CUR)') || 'CUR 이 학급에 없음';
});

// 3) 그리기 — 이름 · 부르는 글 · 볼 곳(돌려준 글 또는 요소 id) · 기대 조각
const CASES = [
  ['홈 네 구역 buildMainHTML', 'buildMainHTML()', null, ['data-sec="today"', 'data-sec="learn"', 'data-sec="me"', 'data-sec="adv"']],
  ['홈 전체 renderAll(HUD·본문·폰)', 'renderAll()', null, null, () => {
    for (const id of ['main-area', 'mob-main-tab']) {
      const h = html(id);
      if (h.includes('문제가 생겼어요')) return id + ' 가 오류 화면: ' + h.replace(/\s+/g, ' ').slice(0, 200);
      const r = need(h, ['data-sec="today"', 'data-sec="adv"']); if (r !== true) return id + ' ' + r;
    }
    return true;
  }],
  ['HUD 레벨·골드', 'renderHUD()', null, null, () => (els.get('hud-gold').textContent == 1234 ? true : 'hud-gold ' + els.get('hud-gold').textContent)],
  ['상점 renderShop', 'renderShop()', 'shop-items', ['onclick=']],
  ['인벤 renderInv', 'renderInv()', 'inv-slots', ['<']],
  ['사냥터 renderMonsterStep(구역 고르기)', 'MONSTER_STEP = "zone"; renderMonsterStep()', 'monster-modal-body', ['onclick=']],
  ['퀘스트 창 renderQuestModal', 'renderQuestModal()', 'quest-list', ['견본 보상', '견본 퀘스트']],
  ['퀘스트 게시판 renderQuestBoard', 'renderQuestBoard()', 'quest-board-list', ['<']],
  ['보상 목록 renderRewardList', 'renderRewardList()', 'reward-list-body', ['견본 보상']],
  ['승급 창 renderPromoModal', 'renderPromoModal()', 'promo-body', ['<']],
  ['감정 기록 renderEmotionHistory', 'renderEmotionHistory()', 'emo-month-summary', ['<']],
  ['감정 창 openEmotionModal', 'openEmotionModal("am")', 'emotion-grid', ['selectEmotion(']],
  ['주간 탭 renderWeeklyTab', 'renderWeeklyTab()', 'weekly-tab-content', ['<']],
  ['독서 기록 renderBookRecords', 'renderBookRecords()', 'book-record-list', ['견본 책']],
  ['공부 카드 buildStudyCardHTML', 'buildStudyCardHTML(CUR)', null, ['<']],
  ['공부 과목 renderStudySubjectPick', 'renderStudySubjectPick()', 'study-body', ['onclick=']],
  ['캐릭터 그림 buildCharSVG', 'buildCharSVG(CUR)', null, ['<svg']],
  ['작품 renderArtworks', 'renderArtworks()', 'artwork-list', ['<']],
  ['랭킹 buildRankingHTML', 'buildRankingHTML(DB.getStudents())', null, ['Lv.']],
  ['농장 창 renderFarmModal', 'renderFarmModal()', 'farm-seed-select', ['<']],
  ['집 renderHouse', 'renderHouse()', 'house-grid', ['<']],
  ['업적 renderHouseAchievements', 'renderHouseAchievements()', 'house-ach-list', ['달성']],
];
for (const [name, code, where, frags, extra] of CASES) {
  check(name, () => {
    const before = errors.length;
    const out = run(code, name);
    if (errors.length > before) return errors.splice(before).join(' / ');
    if (extra) return extra();
    if (!frags) return true;
    return need(where ? html(where) : out, frags);
  });
}

// 4) 레벨업 축하 — 감정 보상 · 업적 보상으로 레벨이 오르면 triggerLevelUp 이 한 번 [LVUP-FX-1]
check('감정 보상으로 레벨이 오르면 축하 한 번(스냅샷이 돌아와도 한 번) · 안 오르면 0', () => {
  return run(`(function () {
    const calls = []; const real = triggerLevelUp; triggerLevelUp = (lv) => calls.push(lv);
    try {
      const r = EMOTION_REWARDS[0];
      const ws = Utils.weekStartStr();
      const orig = getClaimableEmotionRewards;
      getClaimableEmotionRewards = () => [{ ...r, label: r.label || '견본', exp: 1000, gold: 0 }];
      CUR.emotionRewardsClaimed = {};
      _lvSeen = { id: CUR.id, lv: CUR.level, at: 0 }; __dropTimers();   // 들어온 지 오래된 탭
      const lv0 = CUR.level; claimEmotionReward(r.id);
      const up = CUR.level > lv0;
      _remoteLevelUpCheck(CUR.id, CUR.level);   // 내 저장이 스냅샷으로 돌아옴(onDataChange 와 같은 인자) — 또 축하하면 안 된다
      __flushTimers(2);
      CUR.emotionRewardsClaimed = {}; getClaimableEmotionRewards = () => [{ ...r, label: r.label || '견본', exp: 0, gold: 0 }];
      claimEmotionReward(r.id);
      getClaimableEmotionRewards = orig;
      if (!up) return '견본 보상으로 레벨이 안 올랐다';
      return calls.length === 1 && calls[0] === CUR.level ? true : '축하 ' + JSON.stringify(calls);
    } finally { triggerLevelUp = real; }
  })()`, 'lvup-emotion');
});
check('업적 보상으로 레벨이 오르면 축하 한 번(inline·팝업 둘 다)', () => {
  return run(`(function () {
    const calls = []; const real = triggerLevelUp; triggerLevelUp = (lv) => calls.push(lv);
    const realCheck = AchievementUtils.checkNew;
    try {
      AchievementUtils.checkNew = (s) => { s.exp += 5000; s.level = Utils.levelFromExp(s.exp); return [{ id: 'x', icon: '🏆', name: '견본', desc: '', reward: { exp: 5000 } }]; };
      const lv0 = CUR.level; checkAchievements({ inline: true });
      if (!(CUR.level > lv0) || calls.length !== 1 || calls[0] !== CUR.level) return 'inline 축하 ' + JSON.stringify(calls);
      calls.length = 0; __dropTimers();
      checkAchievements();   // 팝업 길: 팝업(3초)이 다 끝난 뒤 — 지금은 아직 0
      if (calls.length) return '팝업 전에 축하가 먼저 뜸';
      __flushTimers(3);
      if (calls.length !== 1 || calls[0] !== CUR.level) return '팝업 뒤 축하 ' + JSON.stringify(calls);
      calls.length = 0;
      AchievementUtils.checkNew = () => [];
      checkAchievements();
      return calls.length === 0 ? true : '업적 없는데 축하';
    } finally { triggerLevelUp = real; AchievementUtils.checkNew = realCheck; }
  })()`, 'lvup-ach');
});

// 5) [CLASS-ASSIGN-1] 선생님 과제 카드 · 과제함 실행기(문항 형식마다) · 수업 덮개 열고 닫기 — 예외 0 · 기대 조각 · 밑 상태 그대로
check('과제: 홈 카드 · 실행기가 형식마다(보기 · OX · 수 · 글 · 분수 · 받아쓰기 · 영어 글 · 영어 듣기 · 그림 · 지문) 그려짐', () => run(`(function () {
  const all = CurriculumUtils.allProblems();
  const pick = [p => p.type === 'choice' && p.cat !== 'ox' && !p.fig && !p.passageId && !p.audio, p => p.cat === 'ox', p => p.type === 'number' && String(p.unitId).startsWith('ma'),
    p => p.type === 'short' && String(p.unitId).startsWith('ko') && p.cat !== 'dictation', p => p.type === 'fraction', p => p.cat === 'dictation',
    p => String(p.unitId).startsWith('en') && p.type === 'short' && !p.audio, p => String(p.unitId).startsWith('en') && p.type === 'choice' && p.audio, p => !!p.fig, p => !!p.passageId].map(f => all.find(f));
  if (pick.some(x => !x)) return '은행에서 형식을 못 찾음';
  const psg = READING_PASSAGES.find(r => r.id === pick[9].passageId);
  const def = AssignCore.normDef({ id: 'aRender1', kind: 'quiz', title: '견본 과제', content: { quiz: { subject: 'math', items: pick.map(p => AssignCore.snapItem(p)), passages: { [psg.id]: { id: psg.id, title: psg.title, text: psg.text } } } }, createdAt: 1 }, 'aRender1');
  _ASG.booted = true; _ASG.db = firebase.database(); _ASG.sid = CUR.id; _ASG.open = { aRender1: def }; _ASG.cells = { aRender1: null }; _ASG.cellReady = { aRender1: true }; _ASG.cellOffs = { aRender1: () => {} };
  const card = buildAssignCardsHTML();
  if (!card.includes('견본 과제') || !card.includes('asgOpenInbox(') || assignTodoCount() !== 1) return '카드 ' + card.slice(0, 200);
  //  소리 문항: 이 시험 칸에는 speechSynthesis 가 없다 → '소리가 나오지 않아요 · 건너뛰기'(영어도) 쪽이 맞다
  const want = ['asg-opt', 'st-ox-btn', 'asgi-input', 'asgi-input', 'asgi-fn', 'asgSkip(', 'lang="en"', 'asgSkip(', 'st-fig', 'asg-psg'];
  const els = []; const answers = {};
  for (let i = 0; i < def.n; i++) {
    _ASG.cells.aRender1 = { answers: Object.assign({}, answers) };
    _asgInstStart('i', 'aRender1');
    const h = document.getElementById('asgi-body').innerHTML;
    if (!h.includes('asg-q') || !h.includes(want[i])) els.push(i + ':' + want[i]);
    answers['q' + i] = { a: 'x', ok: i % 2 === 0, at: 1 + i };
  }
  if (els.length) return '문항 화면 조각 없음 ' + els.join(',');
  //  수학 과제 — 연습장 캔버스(id 따로)
  _ASG.cells.aRender1 = null; _asgInstStart('i', 'aRender1');
  if (!document.getElementById('asgi-body').innerHTML.includes('asgi-scratch')) return '연습장 없음';
  //  답 내기(보기 정답) → 피드백
  const it0 = def.content.quiz.items[0];
  asgPick('i', 0, it0.choices.indexOf(it0.a)); _asgRender('i', true);
  if (!document.getElementById('asgi-body').innerHTML.includes('맞았어요')) return '피드백 ' + document.getElementById('asgi-body').innerHTML.slice(0, 120);
  //  다 낸 뒤 — 결과 화면
  _ASG.inst.i.fb = null; _ASG.cells.aRender1 = { answers }; _asgRender('i', true);
  if (!document.getElementById('asgi-body').innerHTML.includes('asg-score')) return '끝 화면';
  asgCloseInbox();
  return true;
})()`, 'assign-render'));
check('수업 덮개: 열면 밑의 학습 세션 · 학습 앱 창을 안 건드림 · 한 문제씩 화면 · 끝나면 걷힘 · 레벨업은 덮개 동안 미룸', () => run(`(function () {
  const sGame = document.getElementById('s-game'); sGame.classList.add('active');
  const ss = { subjectKey: 'math', questions: [{ id: 'z' }], cur: 0, answers: [] }; STUDY_SESSION = ss;
  const now = Date.now();
  const def = _ASG.open.aRender1;
  def.pacing = 'step';
  _ASG.hosts = { h1: { on: true, at: now - 1000 } }; _ASG.offset = 0; _ASG.connected = true;
  _ASG.live = { on: true, aid: 'aRender1', kind: 'quiz', pacing: 'step', step: -1, phase: 'lobby', startedAt: now, resumeAt: now, endsAt: now + 40 * 60000, rev: 1 };
  _ASG.cells.aRender1 = null;
  _asgLiveSync();
  if (!classLiveIsOpen()) return '안 열림 ' + JSON.stringify(_asgLiveState());
  if (!document.getElementById('asgl-body').innerHTML.includes('곧 시작해요')) return '로비';
  _ASG.live = { ..._ASG.live, step: 0, phase: 'answer' }; _asgLiveSync();
  if (!document.getElementById('asgl-body').innerHTML.includes('asg-opt')) return '묻기';
  _ASG.live = { ..._ASG.live, phase: 'reveal', revealAt: { q0: now } }; _asgLiveSync();
  if (!document.getElementById('asgl-body').innerHTML.includes('못 냈어요')) return '공개';
  const calls = []; const real = triggerLevelUp;
  if (!classLiveDefer(7)) return '레벨업 미룸 안 됨';
  _ASG.live = { ..._ASG.live, on: false }; _asgLiveSync();
  if (classLiveIsOpen()) return '안 닫힘';
  if (STUDY_SESSION !== ss || STUDY_SESSION.cur !== 0) return '학습 세션이 바뀜';
  return true;
})()`, 'assign-live'));
check('싣기·그리기 중 console.error · 약속 거절 0', () => (errors.length ? errors.slice(0, 5).join(' / ') : true));

process.off('unhandledRejection', onRej);
await new Promise(r => setImmediate(r));
const fails = results.filter(r => r[0] === 'FAIL');
for (const r of results) console.log(`${r[0] === 'PASS' ? '✅' : '❌'} ${r[0]}  ${r[1]}${r[2] ? '  — ' + r[2] : ''}`);
console.log(`학생 화면 그려 보기 시험 — PASS ${results.length - fails.length} · FAIL ${fails.length}`);
process.exit(fails.length ? 1 : 0);
