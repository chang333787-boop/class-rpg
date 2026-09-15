#!/usr/bin/env node
// 우리반 성장 RPG — 밸런스 시뮬 게이트 (B-3) · read-only · 운영 접근 0
//
//  승률 Lv1~20 × 장비 3등급(맨몸·무기만·풀장비) × 몬스터 레벨 차(−1·0·+1·+2·+3)와 골드 흐름을 표로 내고,
//  목표 곡선(작전 2026-09-15 제안값)에 맞는지 판정한다. 공식 설명은 docs/rpg_balance_model.md.
//
//  사용
//    node scripts/balance/gate.mjs                                   코드 기본 계수
//    node scripts/balance/gate.mjs --settings scripts/balance/settings/prod-20260915.json   운영 계수
//    node scripts/balance/gate.mjs --gamedata <옛 gamedata.js 경로>   옛 커밋과 비교
//    node scripts/balance/gate.mjs --proposal scripts/balance/proposals/<안>.json  B-4 계수 세트(메모리에서만 적용)
//    옵션: --n 400(칸당 판 수) · --seed 20260915 · --max 20(최대 레벨) · --strict
//    proposal JSON = { name, settings(관리자 설정 — --settings 위에 덮음), balance(BALANCE 덮기),
//                      patches([원문, 바꿀 글] — 코드에 없는 구조 제안), growth({atk:[기본, 레벨당]} — 코드에 없는 구조 제안) }
//
//  판정 (G1~G5, 목표는 "제안" — 운영 값 변경은 사용자 결정)
//    G1 같은 Lv 풀장비 65~80%        G2 같은 Lv 무기만 45~60%        G3 같은 Lv 맨몸 25~40%
//    G4 같은 Lv 승률의 인접 레벨 차 15%p 이하(장비 3등급 모두, 절벽 0)
//    G5 Lv+3 풀장비 30~45% (사냥터 안에서 제시될 수 있는 레벨만)
//
//  종료 코드: 기본은 **보고만**(exit 0). --strict 면 G1~G5 중 하나라도 어긋나면 exit 1.
//   지금 계수는 목표를 못 맞춘다 — 이 게이트는 B-4 계수 제안이 통과해야 할 기준선이다.

import fs from 'node:fs';
import path from 'node:path';
import { loadWorld, makeStudent, winRate, GEAR, GEAR_REF, ROOT } from './lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const flag = k => process.argv.includes('--' + k);
const N = Number(arg('n', 400));
const SEED = Number(arg('seed', 20260915));
const MAX = Number(arg('max', 20));
const settingsPath = arg('settings', null);
const proposalPath = arg('proposal', null);
const proposal = proposalPath ? JSON.parse(fs.readFileSync(path.resolve(proposalPath), 'utf8')) : {};
const settings = { ...(settingsPath ? JSON.parse(fs.readFileSync(path.resolve(settingsPath), 'utf8')) : {}), ...(proposal.settings || {}) };
const gamedata = arg('gamedata', path.join(ROOT, 'gamedata.js'));
const OFFSETS = [-1, 0, 1, 2, 3];
const TARGET = { 풀장비: [0.65, 0.80], 무기만: [0.45, 0.60], 맨몸: [0.25, 0.40] };
const CLIFF = 0.15, PLUS3 = [0.30, 0.45];

const W = loadWorld({ gamedata, settings, balance: proposal.balance || null, patches: proposal.patches || null, seed: SEED });

// ── --quick: PR 사전 검사용 회귀 경보(몇 초) ─────────────────────
//  목표 곡선(G1~G5) 판정이 아니라 "전투가 크게 망가졌나"만 본다. 기준은 2026-09-15 main 운영 설정에서 여유 있게 통과하는 값.
//   Q1 같은 Lv 물리 풀장비 승률 최저 ≥ 50%   (지금 운영 최저 77%, "장비 맞춰도 못 이김" 회귀)
//   Q2 Lv1·Lv2 풀장비 ≥ 90%                 (지금 100%, #172 B1 Lv1~2 0% 같은 회귀)
//   Q3 풀장비 인접 레벨 절벽 ≤ 35%p          (지금 최대 23%p)
//  사용: node scripts/balance/gate.mjs --quick --settings scripts/balance/settings/prod-20260915.json
if (flag('quick')) {
  const NQ = Number(arg('n', 40));
  const full = [], wpn = [];
  for (let lv = 1; lv <= MAX; lv++) {
    full[lv] = winRate(W, makeStudent(W, lv, '풀장비'), lv, NQ).win;
    wpn[lv] = winRate(W, makeStudent(W, lv, '무기만'), lv, NQ).win;
  }
  const fails = [];
  const minLv = full.indexOf(Math.min(...full.slice(1)));
  if (full[minLv] < 0.5) fails.push(`Q1 Lv${minLv} 풀장비 ${Math.round(full[minLv] * 100)}% < 50%`);
  [1, 2].forEach(lv => { if (full[lv] < 0.9) fails.push(`Q2 Lv${lv} 풀장비 ${Math.round(full[lv] * 100)}% < 90%`); });
  let maxJump = 0, jumpAt = 2;
  for (let lv = 2; lv <= MAX; lv++) { const d = Math.abs(full[lv] - full[lv - 1]); if (d > maxJump) { maxJump = d; jumpAt = lv; } }
  if (maxJump > 0.35) fails.push(`Q3 풀장비 Lv${jumpAt - 1}→${jumpAt} ${Math.round(maxJump * 100)}%p > 35%p`);
  const row = a => a.slice(1).map(v => Math.round(v * 100)).join(' ');
  console.log(`밸런스 게이트 quick · 몬스터 HP×${W.BATTLE_CONSTS.monsterHpMult} ATK×${W.BATTLE_CONSTS.monsterAtkMult} · 칸당 ${NQ}판`);
  console.log(`풀장비 같은Lv  ${row(full)}`);
  console.log(`무기만 같은Lv  ${row(wpn)}  (참고)`);
  fails.forEach(f => console.log('❌ ' + f));
  console.log(`요약: ${fails.length ? 'FAIL' : 'PASS'} · 풀장비 최저 Lv${minLv} ${Math.round(full[minLv] * 100)}% · Lv1/2 ${Math.round(full[1] * 100)}/${Math.round(full[2] * 100)}% · 최대 절벽 ${Math.round(maxJump * 100)}%p (quick)`);
  process.exit(fails.length ? 1 : 0);
}
const bc = W.BATTLE_CONSTS;
const pct = r => (r == null ? '—' : `${Math.round(r.win * 100)}%`);
const out = [];
const P = s => out.push(s);

P(`# 밸런스 게이트 — ${new Date().toISOString().slice(0, 10)}`);
P(`계수: 몬스터 HP×${bc.monsterHpMult} · 공격력×${bc.monsterAtkMult} · 하루 전투 ${bc.dailyBattleLimit}회 · 유령 노말×${bc.ghostNormalMult}` +
  ` · 출처 ${settingsPath ? path.basename(settingsPath) : '코드 기본값'}${proposalPath ? ` + 제안 ${proposal.name || path.basename(proposalPath)}` : ''} · gamedata ${gamedata.startsWith(ROOT) ? path.relative(ROOT, gamedata) : path.basename(gamedata) + ' (저장소 밖)'} · 칸당 ${N}판 · 씨앗 ${SEED}`);

// ── 1. 승률 표 ─────────────────────────────────────────────────
const table = {};   // table[gear][lv][offset] = {win,turns}
for (const gear of [...GEAR, ...GEAR_REF]) {
  table[gear] = {};
  P(`\n## 승률 — ${gear}${GEAR_REF.includes(gear) ? ' (참고 · 판정 밖 — 칸마다 최근 등급·스태프·속성 스킬, 몬스터마다 가장 센 공격)' : ''}`);
  P('| Lv | ATK/DEF/HP | 노말 | Lv−1 | **같은 Lv** | Lv+1 | Lv+2 | Lv+3 |');
  P('|---|---|---|---|---|---|---|---|');
  for (let lv = 1; lv <= MAX; lv++) {
    const st = makeStudent(W, lv, gear, proposal.growth || null);
    const hp = W.getPlayerBattleStats(st).hp;
    table[gear][lv] = {};
    for (const o of OFFSETS) table[gear][lv][o] = winRate(W, st, lv + o, N);
    const row = OFFSETS.map(o => (o === 0 ? `**${pct(table[gear][lv][o])}**` : pct(table[gear][lv][o])));
    P(`| ${lv} | ${st.combat.atk}/${st.combat.def}/${hp}${GEAR_REF.includes(gear) ? ` (MAG ${st.combat.mag})` : ''} | ${st.skillLevels.normal} | ${row.join(' | ')} |`);
  }
}
P('\n`—` = 그 레벨이 같은 사냥터(1~10·11~20·21~30) 밖이라 카드로 제시되지 않음.');

// ── 2. 카드별 (B-1 §1.12: 카드1 [P−1,P] · 카드2 [P,P+1] · 카드3 [P+1,P+2]) ──
P('\n## 카드별 평균 승률 (Lv1~' + MAX + ' 평균, 사냥터 밖 칸 제외)');
P('| 장비 | 카드1 [P−1,P] | 카드2 [P,P+1] | 카드3 [P+1,P+2] |');
P('|---|---|---|---|');
const cardAvg = (gear, offs) => {
  const vals = [];
  for (let lv = 1; lv <= MAX; lv++) for (const o of offs) { const r = table[gear][lv][o]; if (r) vals.push(r.win); }
  return vals.length ? `${Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100)}%` : '—';
};
for (const gear of [...GEAR, ...GEAR_REF]) P(`| ${gear} | ${cardAvg(gear, [-1, 0])} | ${cardAvg(gear, [0, 1])} | ${cardAvg(gear, [1, 2])} |`);

// ── 3. 골드 흐름 ───────────────────────────────────────────────
//  전투: 하루 전투 횟수 × 같은 Lv 승률(풀장비) × 그 레벨 몬스터 평균 골드
//  다음 장비: 다음 물리형 등급 5칸을 여는 레벨까지 필요한 값
P('\n## 골드 흐름 — 풀장비 학생, 같은 Lv 몬스터만 상대');
P('| Lv | 몬스터 평균 골드 | 같은 Lv 승률 | 하루 전투 골드 | 이 레벨 새 장비(5칸) | 전투만으로 며칠 |');
P('|---|---|---|---|---|---|');
const G = W.GAME_DATA;
for (let lv = 1; lv <= MAX; lv++) {
  const mons = G.monsters.filter(m => m.level === lv);
  const avgGold = mons.reduce((a, m) => a + m.gold, 0) / mons.length;
  const r = table['풀장비'][lv][0];
  const daily = bc.dailyBattleLimit * (r ? r.win : 0) * avgGold;
  const newSet = Object.entries(G.equipment).map(([slot, items]) =>
    items.filter(i => i.lv === lv && !isMagicItem(i) && (slot !== 'body' || i.element === 'fire') && (slot !== 'weapon' || !i.id.startsWith('e_ws'))))
    .flat().reduce((a, i) => a + i.price, 0);
  P(`| ${lv} | ${Math.round(avgGold)}G | ${pct(r)} | ${Math.round(daily)}G | ${newSet ? newSet + 'G' : '—'} | ${newSet && daily ? (newSet / daily).toFixed(1) + '일' : '—'} |`);
}
function isMagicItem(i) { return (i.stats.mag || 0) > (i.stats.def || 0) + (i.stats.atk || 0); }
P('\n(농장·퀘스트 수입은 여기 넣지 않았다 — 전투 계수만의 영향을 보려고. 전체 경제는 docs/rpg_balance_check_20260915.md ④.)');

// ── 4. 판정 ────────────────────────────────────────────────────
P('\n## 판정 (목표 = 작전 제안값)');
P('| # | 기준 | 통과 레벨 | 결과 | 벗어난 곳 |');
P('|---|---|---|---|---|');
const results = [];
const inRange = (v, [lo, hi]) => v >= lo - 1e-9 && v <= hi + 1e-9;
function judge(id, label, cells, test, fmt) {
  const bad = cells.filter(c => !test(c));
  const ok = bad.length === 0;
  results.push({ id, ok });
  P(`| ${id} | ${label} | ${cells.length - bad.length}/${cells.length} | ${ok ? '✅ PASS' : '❌ FAIL'} | ${bad.slice(0, 8).map(fmt).join(', ')}${bad.length > 8 ? ` 외 ${bad.length - 8}` : ''} |`);
}
const same = gear => Array.from({ length: MAX }, (_, i) => ({ lv: i + 1, r: table[gear][i + 1][0] })).filter(c => c.r);
[['G1', '풀장비'], ['G2', '무기만'], ['G3', '맨몸']].forEach(([id, gear]) =>
  judge(id, `같은 Lv ${gear} ${TARGET[gear].map(x => x * 100).join('~')}%`, same(gear), c => inRange(c.r.win, TARGET[gear]), c => `Lv${c.lv} ${pct(c.r)}`));
const cliffCells = [];
for (const gear of GEAR) for (let lv = 2; lv <= MAX; lv++) {
  const a = table[gear][lv - 1][0], b = table[gear][lv][0];
  if (a && b) cliffCells.push({ gear, lv, d: b.win - a.win });
}
judge('G4', `인접 Lv 차 ≤ ${CLIFF * 100}%p (3등급)`, cliffCells, c => Math.abs(c.d) <= CLIFF + 1e-9,
  c => `${c.gear} Lv${c.lv - 1}→${c.lv} ${c.d > 0 ? '+' : ''}${Math.round(c.d * 100)}%p`);
const p3 = Array.from({ length: MAX }, (_, i) => ({ lv: i + 1, r: table['풀장비'][i + 1][3] })).filter(c => c.r);
judge('G5', `Lv+3 풀장비 ${PLUS3.map(x => x * 100).join('~')}%`, p3, c => inRange(c.r.win, PLUS3), c => `Lv${c.lv} ${pct(c.r)}`);

const pass = results.filter(r => r.ok).length;
P(`\n**${pass}/${results.length} 통과**${flag('strict') ? ' (--strict)' : ' — 보고 모드, exit 0'}`);

const text = out.join('\n');
console.log(text);
if (flag('strict') && pass < results.length) process.exit(1);
