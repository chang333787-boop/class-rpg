#!/usr/bin/env node
// 우리반 성장 RPG — 전투 규칙(불변식) 시험 (BATTLE-RULES-1, read-only)
//
//  실제 공유 코드(gamedata.js + gamedata/*.js)를 vm 에 그대로 올리고, 학생 화면과 같은 순서로
//  (선공 몬스터 → 내 차례 → 몬스터 차례 …) 무작위 행동 수천 판을 싸운다. 공식은 다시 짜지 않는다.
//  행동 고르기는 화면과 같다: 공격 = 노말 + 배운 속성, 기술 = 장착 3칸 중 안 쓴 것(최후의 반격은 HP 40% 아래만),
//  무리한 공격 = 기술 뒤 공격 하나 더.
//
//  지켜야 할 규칙 (하나라도 어기면 FAIL)
//    ① 몬스터 HP 0 이하인데 전투가 안 끝난 판 0
//    ② 몬스터가 쓰러지거나 전투가 끝난 뒤 일어난 행동(HP·기록이 바뀜) 0
//    ③ 아이 HP 0 이하면 패배 · 이기면 몬스터 HP 0 이하 · 지면 아이 HP 0 이하 · 몬스터가 먼저 쓰러졌는데 패배 0
//    ④ 반격(반사)으로 쓰러뜨린 판의 보상(finalizeBattle) = 같은 몬스터를 내 공격으로 이긴 보상
//  운영 Firebase·네트워크 없음 · 난수 씨앗 고정(같은 코드면 같은 숫자).
//
//  사용: node scripts/unit/battle-rules-sim.mjs [--n 5000]
//        BATTLE_RULES_ROOT=<다른 체크아웃> node …   (고치기 전 코드로 같은 시험)
//  마지막 줄 `요약: …` 은 precheck.mjs 가 읽는 모양.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readGamedataSources } from './gamedata-sources.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = process.env.BATTLE_RULES_ROOT || HERE;
const SRC = readGamedataSources(ROOT);
const PROD = JSON.parse(fs.readFileSync(path.join(HERE, 'scripts/balance/settings/prod-20260915.json'), 'utf8'));
const argN = (() => { const i = process.argv.indexOf('--n'); return i > 0 ? Number(process.argv[i + 1]) : 5000; })();

// mulberry32 — 씨앗 고정 난수 (scripts/balance/lib.mjs 와 같은 식)
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function world(seed, settings) {
  const rng = makeRng(seed);
  const M = Object.create(null);
  Object.getOwnPropertyNames(Math).forEach(k => { M[k] = Math[k]; });
  M.random = rng;
  const ctx = { console, Date, Math: M, JSON, Object, Array, Number, String, Boolean, setTimeout, firebase: { apps: [] } };
  vm.createContext(ctx);
  vm.runInContext(SRC + `
;DB.logGold = function () {};
DB.getSettings = function () { return { dexRewards: { firstKillEnabled: true, firstKillGold: 7 } }; };
this.__W = { GAME_DATA, applyBattleSettings, startBattleEngine, performPlayerTurn, performMonsterTurn,
  performSkill2, performRecklessAttack, finalizeBattle };`, ctx);
  const W = ctx.__W;
  W.applyBattleSettings({ settings: { customBattleSettings: JSON.parse(JSON.stringify(settings)) } });
  W.rng = rng;
  return W;
}

const ATTACKS = ['normal', 'fire', 'water', 'grass'];
const SKILL2 = ['heal', 'prep', 'reckless', 'guard', 'counter', 'rush'];

function makeStudent(r) {
  const level = 1 + Math.floor(r() * 30);
  const pick3 = r() < 0.5 ? ['heal', 'guard', 'counter']
    : [...SKILL2].sort(() => r() - 0.5).slice(0, 2).concat('counter');   // 반격은 늘 장착(기본 장착 기술)
  return {
    id: 'sim', level, gold: 100, totalGold: 100, monsterLog: [],
    combat: { atk: Math.floor(r() * (6 + level * 3)), def: Math.floor(r() * (3 + level * 2)), mag: Math.floor(r() * (6 + level * 3)), spd: Math.floor(r() * 12) },
    skillLevels: { normal: 1 + Math.floor(r() * 7), fire: Math.floor(r() * 4), water: Math.floor(r() * 4), grass: Math.floor(r() * 4) },
    equippedSkill2: pick3,
  };
}

// 화면에서 지금 누를 수 있는 것 중 하나 (최후의 반격은 되도록 고른다 — 이 시험의 과녁)
function chooseAction(s, r) {
  const used = s.skill2Used || {};
  const sk = (s.equippedSkill2 || []).filter(id => !used[id] && !(id === 'counter' && s.playerHp / s.playerHpMax > 0.4));
  if (sk.includes('counter') && r() < 0.8) return 'counter';
  const atks = ATTACKS.filter(t => t === 'normal' || (s.skillLevels[t] || 0) >= 1);
  const all = atks.concat(sk);
  return all[Math.floor(r() * all.length)];
}

const snap = (s) => JSON.stringify([s.playerHp, s.monsterHp, s.finished, s.win, s.turn, s.log.length]);

function rewardOf(W, base, monster, win) {
  const st = W.finalizeBattle(JSON.parse(JSON.stringify(base)), monster, win);
  return JSON.stringify([st.gold, st.totalGold, st.monsterLog, st._dexBonusLog || []]);
}

const C = { battles: 0, counterKills: 0, r1: 0, r2: 0, r3: 0, r3first: 0, r4: 0, stuck: 0 };
const firstBad = {};
const note = (k, msg) => { if (!firstBad[k]) firstBad[k] = msg; };

function oneBattle(W, r, tag) {
  const stu = makeStudent(r);
  const mons = W.GAME_DATA.monsters;
  const mon = mons[Math.floor(r() * mons.length)];
  let s = W.startBattleEngine(stu, mon);
  // 학생 화면(startBattle)과 같이: 선공 몬스터 한 대 → 안 끝났으면 내 차례
  if (s.turn === 'monster') { s = W.performMonsterTurn(s); if (!s.finished) s.turn = 'player'; }
  C.battles++;
  let monDeadAt = -1, counterKilled = false, bad1 = false, bad2 = false;
  const check = (step, before, act) => {
    // ② 몬스터가 이미 쓰러졌거나 끝났는데 무언가 일어났나
    if ((before.mDead || before.fin) && before.key !== snap(s)) { if (!bad2) { bad2 = true; C.r2++; note('r2', `${tag} ${mon.id} 걸음 ${step} '${act}' — 몬스터 HP ${s.monsterHp} 인데 행동이 일어남`); } }
    if (s.monsterHp <= 0 && monDeadAt < 0) monDeadAt = step;
    // ① 몬스터 HP 0 이하인데 안 끝남
    if (s.monsterHp <= 0 && !s.finished) { if (!bad1) { bad1 = true; C.r1++; note('r1', `${tag} ${mon.id} 걸음 ${step} '${act}' 뒤 몬스터 HP ${s.monsterHp} · finished=${s.finished} · turn=${s.turn}`); } }
  };
  for (let step = 0; step < 300 && !s.finished; step++) {
    const before = { mDead: s.monsterHp <= 0, fin: s.finished, key: snap(s) };
    let act;
    if (s.turn === 'monster') {
      act = 'monster';
      const mBefore = s.monsterHp, rBefore = s.counterReady;
      s = W.performMonsterTurn(s);
      if (rBefore && mBefore > 0 && s.monsterHp <= 0) counterKilled = true;
    } else if (s.turn === 'player') {
      act = chooseAction(s, r);
      if (ATTACKS.includes(act)) s = W.performPlayerTurn(s, act);
      else {
        s = W.performSkill2(s, act);
        if (act === 'reckless') s = W.performRecklessAttack(s, ATTACKS[Math.floor(r() * 4)]);
      }
    } else { C.stuck++; note('stuck', `${tag} ${mon.id} 걸음 ${step} turn=${s.turn} 인데 안 끝남`); break; }
    check(step, before, act);
  }
  if (!s.finished) { C.stuck++; note('stuck', `${tag} ${mon.id} 300걸음 넘게 안 끝남 (몬스터 HP ${s.monsterHp} · 아이 HP ${s.playerHp})`); }
  // ② 끝난 뒤 모든 행동을 눌러 봐도 바뀌는 것 없음
  if (s.finished) {
    const k = snap(s);
    for (const a of ATTACKS) W.performPlayerTurn(s, a);
    for (const a of SKILL2) W.performSkill2(s, a);
    W.performRecklessAttack(s, 'normal');
    W.performMonsterTurn(s);
    if (snap(s) !== k && !bad2) { bad2 = true; C.r2++; note('r2', `${tag} ${mon.id} 끝난 뒤 행동이 상태를 바꿈`); }
  }
  // ③ 끝 판정이 HP 와 맞나
  const r3 = (s.playerHp <= 0 && !(s.finished && !s.win)) || (s.finished && s.win && s.monsterHp > 0) || (s.finished && !s.win && s.playerHp > 0);
  if (r3) { C.r3++; note('r3', `${tag} ${mon.id} 끝: win=${s.win} · 아이 HP ${s.playerHp} · 몬스터 HP ${s.monsterHp}`); }
  if (s.finished && !s.win && monDeadAt >= 0) { C.r3first++; note('r3first', `${tag} ${mon.id} 몬스터가 걸음 ${monDeadAt} 에 먼저 쓰러졌는데 패배`); }
  // ④ 반격으로 쓰러뜨린 판의 보상 = 내 공격으로 이긴 보상
  if (counterKilled) {
    C.counterKills++;
    const got = s.finished ? rewardOf(W, stu, s.monster, s.win) : rewardOf(W, stu, s.monster, false);
    const want = rewardOf(W, stu, s.monster, true);
    if (got !== want) { C.r4++; note('r4', `${tag} ${mon.id} 반격 승리 보상 ${got} ≠ 일반 승리 ${want}`); }
  }
}

for (const [tag, settings, seed] of [['기본', {}, 20261004], ['운영', PROD, 20261005]]) {
  const W = world(seed, settings);
  for (let i = 0; i < argN; i++) oneBattle(W, W.rng, tag);
}

const rows = [
  ['① 몬스터 HP 0 이하인데 안 끝난 판', C.r1],
  ['② 쓰러진·끝난 뒤 일어난 행동이 있는 판', C.r2],
  ['③ 끝 판정이 HP 와 어긋난 판', C.r3],
  ['③ 몬스터가 먼저 쓰러졌는데 패배한 판', C.r3first],
  ['④ 반격 승리 보상 ≠ 일반 승리 보상', C.r4],
  ['   끝나지 않은 판(300걸음)', C.stuck],
];
console.log(`전투 규칙 시험 · ${ROOT === HERE ? '이 폴더' : ROOT} · ${C.battles.toLocaleString()}판(기본·운영 설정 각 ${argN}) · 반격으로 쓰러뜨린 판 ${C.counterKills.toLocaleString()}`);
for (const [k, v] of rows) console.log(`${v ? '❌' : '✅'} ${k}: ${v}`);
for (const [k, v] of Object.entries(firstBad)) console.log(`   예 [${k}] ${v}`);
const fail = C.r1 + C.r2 + C.r3 + C.r3first + C.r4 + C.stuck;
if (C.counterKills < 50) console.log(`❌ 반격으로 쓰러뜨린 판이 너무 적음(${C.counterKills}) — 시험이 과녁을 못 맞힘`);
const ok = fail === 0 && C.counterKills >= 50;
console.log(`요약: ${ok ? 'PASS' : 'FAIL'} · ①${C.r1} ②${C.r2} ③${C.r3 + C.r3first} ④${C.r4} · 반격 승리 ${C.counterKills}판 / ${C.battles}판`);
process.exit(ok ? 0 : 1);
