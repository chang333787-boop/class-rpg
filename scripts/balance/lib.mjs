// 우리반 성장 RPG — 밸런스 시뮬 공용 (B-3) · read-only
//
//  gamedata.js 를 Node vm 으로 **그대로** 불러 앱의 전투 엔진 함수로 싸운다. 공식을 다시 짜지 않는다.
//  운영 계수는 앱의 applyBattleSettings() 로 넣는다(재구현 금지 — 실제 코드 경로를 검증한다).
//  공식의 설명은 docs/rpg_balance_model.md (B-1).
//
//  난수는 **씨앗을 고정**한다. 게이트는 돌릴 때마다 같은 표가 나와야 한다
//  (Math.random 이면 칸마다 ±2~3%p 흔들려 "인접 레벨 차 15%p 이하" 같은 판정이 들쭉날쭉해진다).

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// mulberry32 — 32비트 씨앗 고정 난수
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * gamedata.js 를 불러 전투 세계 하나를 만든다.
 * @param {object} opt
 * @param {string} [opt.gamedata] gamedata.js 경로(기본: 저장소 것). 옛 커밋과 비교할 때 바꾼다.
 * @param {object} [opt.settings] settings.customBattleSettings 와 같은 모양. 비우면 코드 기본값.
 * @param {object} [opt.balance] BALANCE 덮기(깊은 병합, 배열은 통째 교체) — B-4 계수 제안을 코드 수정 없이 시뮬할 때.
 *        메모리에서만 `const BALANCE = {…}` 를 병합식으로 감싼다(파일은 안 바꿈).
 * @param {number} [opt.seed]
 */
export function loadWorld({ gamedata = path.join(ROOT, 'gamedata.js'), settings = {}, balance = null, patches = null, seed = 20260915 } = {}) {
  const rng = makeRng(seed);
  const M = Object.create(null);
  Object.getOwnPropertyNames(Math).forEach(k => { M[k] = Math[k]; });
  M.random = rng;
  const ctx = { console, Date, Math: M, JSON, Object, Array, Number, String, Boolean, setTimeout, firebase: { apps: [] } };
  vm.createContext(ctx);
  let src = fs.readFileSync(gamedata, 'utf8');
  if (balance) src = wrapBalance(src, balance);
  // patches = [[원문, 바꿀 글], …] — **구조 제안**(코드에 아직 없는 식)을 메모리에서만 시험. 원문이 정확히 1번 있어야 한다.
  for (const [from, to] of patches || []) {
    const n = src.split(from).length - 1;
    if (n !== 1) throw new Error(`patch 원문 ${n}번: ${from.slice(0, 60)}`);
    src = src.replace(from, () => to);
  }
  vm.runInContext(src + `\n;this.__W = { GAME_DATA, SKILL_BOOKS, BATTLE_CONSTS,
    applyBattleSettings: typeof applyBattleSettings === 'function' ? applyBattleSettings : null,
    startBattleEngine, performPlayerTurn, performMonsterTurn, performSkill2, getPlayerBattleStats,
    SKILL_MULTIPLIERS, getElementMultiplier, getTraitMultiplier };`, ctx);
  const W = ctx.__W;
  if (W.applyBattleSettings) W.applyBattleSettings({ settings: { customBattleSettings: settings } });
  W.rng = rng;
  return W;
}

// ── 학생 만들기 ────────────────────────────────────────────────
//  맨몸   : 장비 없음 (combat {0,0,0,0}), 노말 1권
//           ★ B-4 정정: 처음엔 def 기본 6 을 줬는데, 실학생 6명 combat 은 **장비 합과 정확히 같다**(DB.equipItem 은 더하기만,
//             def 6 은 admin.js 초기화 버튼에서만 생김). 그래서 0 으로 맞춤.
//  무기만 : 그 레벨에서 살 수 있는 가장 좋은 검 1개, 노말 스킬북 최고 권
//  풀장비 : 5칸 모두 그 레벨의 가장 좋은 **물리형** 장비, 노말 스킬북 최고 권
//           — 노말 공격은 ATK 로 치므로 마력형 등급(Lv7·13·20, B-1 §4.3)은 고르지 않는다.
//             "최신 장비를 따라 사면 약해지는" 함정은 게이트 대상이 아니라 표시 문제라 따로 둔다.
export const GEAR = ['맨몸', '무기만', '풀장비'];

const isMagic = i => (i.stats.mag || 0) > (i.stats.def || 0) + (i.stats.atk || 0);

// BALANCE 원문 블록(`const BALANCE = {` … 줄 머리 `};`)을 __merge(원문, 덮기) 로 바꾼다
export function wrapBalance(src, balance) {
  const head = 'const BALANCE = {';
  const start = src.indexOf(head);
  if (start < 0) throw new Error('BALANCE 블록 없음 — balance 덮기는 B-2a 이후 gamedata.js 에서만');
  const endRe = /\r?\n\};/g;
  endRe.lastIndex = start;
  const m = endRe.exec(src);
  if (!m) throw new Error('BALANCE 블록 끝 없음');
  const close = m.index + m[0].indexOf('}');       // "}" 위치
  const merge = 'function __merge(a,b){for(const k of Object.keys(b)){const v=b[k];' +
    'if(v&&typeof v==="object"&&!Array.isArray(v)&&a[k]&&typeof a[k]==="object"&&!Array.isArray(a[k]))__merge(a[k],v);else a[k]=v;}return a;}\n';
  return src.slice(0, start) + merge + 'const BALANCE = __merge({' + src.slice(start + head.length, close + 1) +
    ', ' + JSON.stringify(balance) + ');' + src.slice(close + 2);
}

// growth = { atk:[기본, 레벨당], def:[…] } — **코드에 아직 없는 구조 제안**(레벨 따라 오르는 기본 능력치)을 시뮬할 때만
export function makeStudent(W, level, gear, growth = null) {
  const G = W.GAME_DATA;
  const best = (arr, f = () => true) => arr.filter(i => i.lv <= level && f(i)).sort((a, b) => b.lv - a.lv || b.price - a.price)[0];
  let items = [];
  if (gear === '무기만') items = [best(G.equipment.weapon, i => !i.id.startsWith('e_ws'))];
  if (gear === '풀장비') items = [
    best(G.equipment.head, i => !isMagic(i)),
    best(G.equipment.body, i => i.element === 'fire' && !isMagic(i)),
    best(G.equipment.weapon, i => !i.id.startsWith('e_ws')),
    best(G.equipment.glove, i => !isMagic(i)),
    best(G.equipment.shoe, i => !isMagic(i)),
  ];
  items = items.filter(Boolean);
  const combat = { atk: 0, def: 0, mag: 0, spd: 0 };
  items.forEach(i => Object.entries(i.stats).forEach(([k, v]) => { combat[k] = (combat[k] || 0) + v; }));
  if (growth) Object.entries(growth).forEach(([k, [b, per]]) => { combat[k] = (combat[k] || 0) + Math.round(b + per * level); });
  const body = items.find(i => G.equipment.body.includes(i));
  const normal = gear === '맨몸' ? 1
    : Math.max(1, ...W.SKILL_BOOKS.filter(b => b.type === 'normal' && b.reqPlayerLevel <= level).map(b => b.targetLevel));
  return { level, combat, equipmentIds: body ? { body: body.id } : {},
    skillLevels: { normal, fire: 0, water: 0, grass: 0 }, equippedSkill2: ['heal', 'guard', 'counter'], _items: items };
}

// ── 한 판 ──────────────────────────────────────────────────────
//  노말 공격만 쓰고, HP 35% 아래로 내려가면 응급치료 1회. 80턴 넘으면 패배로 본다.
export function fight(W, student, monster) {
  let s = W.startBattleEngine(student, monster);
  if (s.turn === 'monster') { s = W.performMonsterTurn(s); if (!s.finished) s.turn = 'player'; }
  let t = 0;
  while (!s.finished && t < 80) {
    if (!s.skill2Used.heal && s.playerHp / s.playerHpMax < 0.35) s = W.performSkill2(s, 'heal');
    else s = W.performPlayerTurn(s, 'normal');
    if (s.finished) break;
    s = W.performMonsterTurn(s);
    t++;
  }
  return { win: !!s.win, turns: t };
}

export const zoneOf = lv => (lv <= 10 ? 'beginner' : lv <= 20 ? 'intermediate' : 'advanced');

/** 그 레벨·같은 사냥터 몬스터 전부를 상대로 n 판씩 → 승률. 그 레벨이 사냥터 밖이면 null */
export function winRate(W, student, monLevel, n) {
  if (zoneOf(monLevel) !== zoneOf(student.level) || monLevel < 1) return null;
  const mons = W.GAME_DATA.monsters.filter(m => m.level === monLevel);
  if (!mons.length) return null;
  let w = 0, turns = 0, k = 0;
  for (const m of mons) for (let i = 0; i < n; i++) { const r = fight(W, student, m); if (r.win) w++; turns += r.turns; k++; }
  return { win: w / k, turns: turns / k, battles: k };
}
