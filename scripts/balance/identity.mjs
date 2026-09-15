#!/usr/bin/env node
// 우리반 성장 RPG — 밸런스 리팩토링 출력 동일 대조표 (B-2) · read-only · 운영 접근 0
//
//  gamedata.js 두 벌(A = 기준, B = 바꾼 것)을 각각 vm 으로 불러 **같은 씨앗·같은 입력**을 넣고
//  나오는 것을 전부 비교한다. 하나라도 다르면 exit 1.  "아이가 보는 값은 안 바뀐다"의 증거.
//
//  사용
//    node scripts/balance/identity.mjs                       A = git origin/main 의 gamedata.js, B = 작업 폴더 gamedata.js
//    node scripts/balance/identity.mjs --a <파일> --b <파일>
//    node scripts/balance/identity.mjs --a-ref <커밋>         A 를 다른 커밋에서
//
//  비교 항목
//    ① 정적 표   GAME_DATA·SKILL_BOOKS·SKILL_MULTIPLIERS·ELEMENT_CHART·BATTLE_CONSTS·RARITY_WEIGHTS·ZONE_RANGES
//                — 관리자 설정 4벌(없음·운영·전 키 극단값·극단값 뒤 없음) 적용 후 각각
//    ② 계산 함수 피해·명중·상성·유령·선공·HP 를 격자 입력으로 (난수 호출 순서까지)
//    ③ 전투 기록 몬스터 전종 × 레벨 7 × 몸통 속성 4 × 행동 대본 10 × 설정 4 — 매 행동 뒤 상태 전체(로그 문구 포함)
//    ④ 사냥터 카드 레벨 1~30 × 도감·최근 등장 3상태 × 40회 — 뽑힌 몬스터와 recentBattleOffers
//    ⑤ 경계값    난수를 코드 속 문턱값(0.06·0.1·0.2·0.5·명중 0.85~0.97) 바로 위·아래·정확히로 고정해 같은 계산 — 문턱이 1e-9만 움직여도 잡는다
//  모든 비교는 JSON 문자열의 sha256 + Math.random 호출 횟수.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { makeRng, ROOT } from './lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const srcA = arg('a') ? fs.readFileSync(path.resolve(arg('a')), 'utf8')
  : execFileSync('git', ['-C', ROOT, 'show', `${arg('a-ref', 'origin/main')}:gamedata.js`], { encoding: 'utf8', maxBuffer: 64 << 20 });
const srcB = fs.readFileSync(path.resolve(arg('b', path.join(ROOT, 'gamedata.js'))), 'utf8');

const PROD = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/balance/settings/prod-20260915.json'), 'utf8'));
// 관리자 화면이 저장할 수 있는 키 전부에 기본과 다른 값
const EXTREME = {
  normalMults: { 1: 1.3, 3: 1.5, 7: 2.0 }, elementMults: { 1: 1.2, 4: 1.7 },
  elemChart: { advantageMult: 1.7, disadvantageMult: 0.6 }, defChart: { advantageMult: 0.7, disadvantageMult: 1.3 },
  ghostNormalMult: 0.3, dailyBattleLimit: 8, infiniteBattleLimit: 2, monsterHpMult: 2.2, monsterAtkMult: 0.7,
  equipment: { e_w1: { price: 999, stats: { atk: 30 } }, e_b1: { element: 'water', cond: { value: 3 } }, e_h1: { lv: 4, name: '시험 모자' } },
  skillBooks: { sb_n1: { price: 1, reqPlayerLevel: 9, desc: '시험' } },
};
const SETTINGS_SEQ = [['없음', {}], ['운영', PROD], ['극단', EXTREME], ['극단→없음', {}]];

function world(src, seed) {
  const rng = makeRng(seed);
  let calls = 0;
  const M = Object.create(null);
  Object.getOwnPropertyNames(Math).forEach(k => { M[k] = Math[k]; });
  let forced = null;   // ⑤ 경계값 검사에서 난수를 한 값으로 고정
  M.random = () => { calls++; return forced === null ? rng() : forced; };
  const ctx = { console, Date, Math: M, JSON, Object, Array, Number, String, Boolean, setTimeout, firebase: { apps: [] } };
  vm.createContext(ctx);
  vm.runInContext(src + `\n;this.__W = { GAME_DATA, SKILL_BOOKS, SKILL_MULTIPLIERS, ELEMENT_CHART, BATTLE_CONSTS, RARITY_WEIGHTS, ZONE_RANGES,
    DEFAULT_SKILL_LEVELS, applyBattleSettings, getPlayerBattleStats, calculatePlayerDamage, calculateMonsterDamage,
    getElementMultiplier, getDefenseElementMultiplier, getTraitMultiplier, decideFirstTurn, startBattleEngine,
    performPlayerTurn, performMonsterTurn, performSkill2, performRecklessAttack, generateBattleOffers, getSlotLevelRange };`, ctx);
  const W = ctx.__W;
  W.calls = () => calls;
  W.force = v => { forced = v; };
  return W;
}

class Sink {
  constructor() { this.h = crypto.createHash('sha256'); this.n = 0; }
  add(v) { this.h.update(JSON.stringify(v) + '\n'); this.n++; }
  done() { return this.h.digest('hex').slice(0, 16); }
}

const ELEMS = [null, 'fire', 'water', 'grass'];
const LEVELS = [1, 5, 10, 15, 20, 25, 30];
// 행동 대본: 첫 몇 턴의 행동, 그 뒤는 마지막 행동 반복. 'r:<type>' = 무리한 공격 후 그 속성으로
const SCRIPTS = [
  ['normal'], ['fire'], ['water'], ['grass'],
  ['heal', 'normal', 'normal', 'heal', 'normal'],
  ['prep', 'normal'], ['guard', 'fire', 'guard', 'fire'],
  ['counter', 'normal', 'counter', 'normal'], ['rush', 'normal'], ['reckless', 'r:water', 'reckless', 'r:normal', 'normal'],
];

function student(W, level, elem) {
  const bodies = W.GAME_DATA.equipment.body;
  const body = elem ? bodies.find(b => b.element === elem && b.lv <= level) : null;
  return {
    id: 'sim', level, combat: { atk: 4 + level * 2, def: 3 + level, mag: 5 + level * 2, spd: level % 7 },
    equipmentIds: body ? { body: body.id } : {},
    skillLevels: { normal: Math.min(7, 1 + (level >> 4)), fire: 3, water: (level % 8), grass: 7 },
    equippedSkill2: ['heal', 'guard', 'counter'],
  };
}

function battles(W, sink) {
  for (const mon of W.GAME_DATA.monsters) for (const lv of LEVELS) for (const el of ELEMS) for (const sc of SCRIPTS) {
    let s = W.startBattleEngine(student(W, lv, el), mon);
    sink.add(['start', s, W.calls()]);
    for (let t = 0; t < 60 && !s.finished; t++) {
      if (s.turn === 'monster') { s = W.performMonsterTurn(s); sink.add(['m', s.playerHp, s.monsterHp, s.turn, s.monsterTurnCount, W.calls()]); continue; }
      const act = sc[Math.min(t, sc.length - 1)];
      if (act.startsWith('r:')) s = W.performRecklessAttack(s, act.slice(2));
      else if (['normal', 'fire', 'water', 'grass'].includes(act)) s = W.performPlayerTurn(s, act);
      else { const before = s.turn; s = W.performSkill2(s, act); if (s.turn === before && !s.recklessReady) s = W.performPlayerTurn(s, 'normal'); }
      sink.add(['p', act, s.playerHp, s.monsterHp, s.turn, s.monsterTurnCount, W.calls()]);
    }
    sink.add(['end', s, W.calls()]);
  }
}

function formulas(W, sink) {
  const mons = W.GAME_DATA.monsters.filter((m, i) => i % 7 === 0);
  for (const lv of LEVELS) for (const el of ELEMS) {
    const ps = W.getPlayerBattleStats(student(W, lv, el));
    sink.add(['stats', ps]);
    for (const m of mons) {
      for (const at of ['normal', 'fire', 'water', 'grass']) sink.add(['pd', at, W.calculatePlayerDamage(ps, m, at, { normal: 3, fire: 2, water: 0, grass: 7 }), W.getElementMultiplier(at, m.element), W.getTraitMultiplier(m, at), W.calls()]);
      sink.add(['md', W.calculateMonsterDamage(ps, m), W.getDefenseElementMultiplier(m.element, el), W.decideFirstTurn(ps.spd, m.spd), W.calls()]);
    }
  }
}

function offers(W, sink) {
  const mons = W.GAME_DATA.monsters;
  for (let lv = 1; lv <= 30; lv++) for (const zone of Object.keys(W.ZONE_RANGES)) for (const mode of ['새내기', '절반', '전부']) {
    const p = { level: lv, monsterLog: mode === '새내기' ? [] : mode === '절반' ? mons.filter((m, i) => i % 2).map(m => m.id) : mons.map(m => m.id), recentBattleOffers: [] };
    for (let k = 0; k < 40; k++) sink.add(['o', W.generateBattleOffers(p, zone).map(m => m.id), p.recentBattleOffers, W.calls()]);
    for (let i = 0; i < 3; i++) sink.add(['r', W.getSlotLevelRange(lv, i, W.ZONE_RANGES[zone].min, W.ZONE_RANGES[zone].max)]);
  }
}

function thresholds(W, sink) {
  const base = [0, 0.06, 0.1, 0.2, 0.5, 0.3, 0.15, 0.35, 1];
  for (let h = 85; h <= 97; h++) base.push(h / 100);
  for (let h = -20; h <= 20; h++) base.push(0.93 - h * 0.01);
  const probes = [...new Set(base.flatMap(v => [v - 1e-9, v, v + 1e-9]))].filter(v => v >= 0 && v < 1).sort((a, b) => a - b);
  const mons = W.GAME_DATA.monsters.filter((m, i) => i % 11 === 0);
  for (const v of probes) {
    W.force(v);
    for (const m of mons) for (const spd of [0, 3, 6, 9, 14, 20, 30]) {
      const ps = W.getPlayerBattleStats({ level: 12, combat: { atk: 30, def: 12, mag: 25, spd } });
      sink.add(['t', v, W.calculatePlayerDamage(ps, m, 'normal', { normal: 4 }), W.calculateMonsterDamage(ps, m), W.decideFirstTurn(spd, spd)]);
    }
    for (const sc of SCRIPTS) {
      let s = W.startBattleEngine(student(W, 12, 'water'), W.GAME_DATA.monsters[40]);
      for (let t = 0; t < 12 && !s.finished; t++) {
        if (s.turn === 'monster') { s = W.performMonsterTurn(s); continue; }
        const act = sc[Math.min(t, sc.length - 1)];
        if (act.startsWith('r:')) s = W.performRecklessAttack(s, act.slice(2));
        else if (['normal', 'fire', 'water', 'grass'].includes(act)) s = W.performPlayerTurn(s, act);
        else { const before = s.turn; s = W.performSkill2(s, act); if (s.turn === before && !s.recklessReady) s = W.performPlayerTurn(s, 'normal'); }
      }
      sink.add(['tb', v, s]);
    }
    const p = { level: 9, monsterLog: [], recentBattleOffers: [] };
    sink.add(['to', v, W.generateBattleOffers(p, 'beginner').map(m => m.id)]);
  }
  W.force(null);
}

function run(src) {
  const rows = {};
  const W = world(src, 20260915);
  for (const [name, settings] of SETTINGS_SEQ) {
    W.applyBattleSettings({ settings: { customBattleSettings: JSON.parse(JSON.stringify(settings)) } });
    const st = new Sink();
    st.add({ GAME_DATA: W.GAME_DATA, SKILL_BOOKS: W.SKILL_BOOKS, SKILL_MULTIPLIERS: W.SKILL_MULTIPLIERS, ELEMENT_CHART: W.ELEMENT_CHART,
      BATTLE_CONSTS: W.BATTLE_CONSTS, RARITY_WEIGHTS: W.RARITY_WEIGHTS, ZONE_RANGES: W.ZONE_RANGES, DEFAULT_SKILL_LEVELS: W.DEFAULT_SKILL_LEVELS });
    rows[`① 정적 표 · ${name}`] = st;
    const f = new Sink(); formulas(W, f); rows[`② 계산 함수 · ${name}`] = f;
    const b = new Sink(); battles(W, b); rows[`③ 전투 기록 · ${name}`] = b;
    const o = new Sink(); offers(W, o); rows[`④ 사냥터 카드 · ${name}`] = o;
    const t = new Sink(); thresholds(W, t); rows[`⑤ 경계값 · ${name}`] = t;
    // 다음 설정으로 가기 전 난수 호출 수도 대조에 넣는다
    const c = String(W.calls()); rows[`   난수 호출 누계 · ${name}`] = { n: 1, done: () => c };
  }
  return Object.fromEntries(Object.entries(rows).map(([k, s]) => [k, { n: s.n, h: s.done() }]));
}

const A = run(srcA), B = run(srcB);
const lines = ['| 항목 | 비교 건수 | A (기준) | B (변경) | 같음 |', '|---|---|---|---|---|'];
let diff = 0;
for (const k of Object.keys(A)) {
  const same = A[k].h === B[k].h && A[k].n === B[k].n;
  if (!same) diff++;
  lines.push(`| ${k} | ${A[k].n.toLocaleString()} | \`${A[k].h}\` | \`${B[k].h}\` | ${same ? '✅' : '❌'} |`);
}
console.log(lines.join('\n'));
console.log(`\n${diff === 0 ? '✅ 출력 100% 동일' : `❌ 다른 항목 ${diff}개`} (A ${arg('a') || arg('a-ref', 'origin/main') + ':gamedata.js'} · B ${arg('b', 'gamedata.js')})`);
process.exit(diff === 0 ? 0 : 1);
