// 속성 가위바위보 배틀 — 설계 시뮬(새 규칙 · 메모리에서만). 몬스터·장비는 진짜 데이터.
import { loadWorld, makeStudent, makeRng, zoneOf } from '../scripts/balance/lib.mjs';
const W = loadWorld({ seed: 11 }); const G = W.GAME_DATA;
const rng = makeRng(20261003), R = () => rng();
const EL = ['fire', 'water', 'grass'];
const beats = { water: 'fire', fire: 'grass', grass: 'water' };          // 물이 불을 끄고 · 불이 풀을 태우고 · 풀이 물을 마신다
const rps = (a, b) => a === b ? 0 : beats[a] === b ? 1 : -1;             // a 가 b 에게: 1 이김 · 0 비김 · -1 짐
const P = { win: 1.6, tie: 1.0, lose: 0.5, same: 1.25, big: 2.0, block: 0.2, ult: 2.4, gWin: 34, gTie: 15, gBlock: 40, crit: 0.08 };
function setup(level, gear, mHp, mAtk, armor) {
  const st = makeStudent(W, level, gear);
  const c = st.combat;
  return { power: (c.atk || 0) + (c.mag || 0) + 4 + level * 0.6, def: c.def || 0, hp: 80 + 12 * level, armor: armor || 'fire',
           elv: { fire: 1, water: 1, grass: 1 }, mHp, mAtk };
}
function fight(p, mon, strat) {
  let hp = p.hp, mhp = Math.round((mon.hp || 30) * p.mHp), turn = 0, gauge = 0, rounds = { win: 0, tie: 0, lose: 0 };
  const mOwn = mon.element || EL[Math.floor(R() * 3)];
  const df = 100 / (100 + (mon.def || 0)), pf = 100 / (100 + p.def);
  while (hp > 0 && mhp > 0 && turn < 40) {
    turn++;
    const big = turn % 3 === 0;
    const mChoice = big ? mOwn : (R() < 0.5 ? mOwn : EL.filter(e => e !== mOwn)[Math.floor(R() * 2)]);
    const other = EL.filter(e => e !== mChoice)[Math.floor(R() * 2)];
    const hint = big ? [mChoice] : [mChoice, other];                       // 둘까지 알려 줌(큰 공격은 하나)
    let pick;
    if (strat === 'smart' && gauge >= 100) pick = 'ult';
    else if (strat === 'smart' && big) pick = EL.find(e => beats[e] === mChoice);   // 큰 공격은 이기는 걸로
    else if (strat === 'smart') { const [a, b] = hint; pick = beats[a] === b ? a : b; }   // 둘 중 이기는 쪽
    else if (strat === 'armor') pick = p.armor;
    else pick = gauge >= 100 && strat === 'random+ult' ? 'ult' : EL[Math.floor(R() * 3)];
    const crit = R() < P.crit ? 1.5 : 1;
    if (pick === 'ult') { gauge = 0; mhp -= Math.round(p.power * P.ult * df * crit); hp -= Math.round(mon.atk * p.mAtk * (big ? P.big : 1) * pf * 0.6); continue; }
    const r = rps(pick, mChoice);
    rounds[r > 0 ? 'win' : r < 0 ? 'lose' : 'tie']++;
    gauge = Math.min(100, gauge + (r > 0 ? P.gWin : r === 0 ? P.gTie : 0));
    const pm = r > 0 ? P.win : r === 0 ? P.tie : P.lose, mm = r > 0 ? P.lose : r === 0 ? P.tie : P.win;
    mhp -= Math.max(1, Math.round(p.power * (1 + 0.1 * (p.elv[pick] - 1)) * (pick === p.armor ? P.same : 1) * pm * df * crit));
    if (mhp <= 0) break;
    hp -= Math.max(1, Math.round(mon.atk * p.mAtk * (big ? P.big : 1) * mm * pf));
  }
  return { win: mhp <= 0 && hp > 0, turns: turn, hpLeft: Math.max(0, hp) / p.hp, flawless: rounds.lose === 0 };
}
function cell(L, gear, off, strat, mHp, mAtk) {
  const ml = L + off; if (zoneOf(ml) !== zoneOf(L)) return null;
  const mons = G.monsters.filter(m => m.level === ml); if (!mons.length) return null;
  let w = 0, t = 0, h = 0, k = 0, f = 0;
  for (const m of mons) for (let i = 0; i < 300; i++) { const p = setup(L, gear, mHp, mAtk, EL[i % 3]); const r = fight(p, m, strat); k++; t += r.turns; if (r.win) { w++; h += r.hpLeft; if (r.flawless) f++; } }
  return { win: w / k, turns: t / k, hp: w ? h / w : 0, flaw: f / k };
}
const pct = x => Math.round(x * 100) + '%';
const N2 = 120;
function cellN(L, gear, off, strat, mh, ma) {
  const ml = L + off; if (zoneOf(ml) !== zoneOf(L)) return null;
  const mons = G.monsters.filter(m => m.level === ml); if (!mons.length) return null;
  let w = 0, t = 0, k = 0, h = 0;
  for (const m of mons) for (let i = 0; i < N2; i++) { const p = setup(L, gear, mh, ma, EL[i % 3]); const r = fight(p, m, strat); k++; t += r.turns; if (r.win) { w++; h += r.hpLeft; } }
  return { win: w / k, turns: t / k, hp: w ? h / w : 0 };
}
function avg(gear, off, strat, mh, ma) {
  let w = 0, t = 0, n = 0, h = 0;
  for (const L of [3, 6, 9, 12, 15, 18]) { const c = cellN(L, gear, off, strat, mh, ma); if (!c) continue; w += c.win; t += c.turns; h += c.hp; n++; }
  return { win: w / n, turns: t / n, hp: h / n };
}
const rows = [];
for (const mh of [2.0, 2.4, 2.8, 3.2]) for (const ma of [1.8, 2.2, 2.6, 3.0]) {
  const a = avg('풀장비', 0, 'random', mh, ma), b = avg('풀장비', 0, 'smart', mh, ma), c = avg('풀장비', 2, 'random', mh, ma), d = avg('풀장비', 2, 'smart', mh, ma), e = avg('무기만', 0, 'random', mh, ma), f = avg('무기만', 0, 'smart', mh, ma);
  rows.push({ mh, ma, a, b, c, d, e, f });
}
console.log('| 체력× | 공격× | 풀장비 같은Lv 아무거나 | 생각하며 | +2Lv 아무거나 | +2Lv 생각하며 | 무기만 아무거나 | 무기만 생각하며 |');
for (const r of rows) console.log(`| ${r.mh} | ${r.ma} | ${pct(r.a.win)} · ${r.a.turns.toFixed(1)}차례 | ${pct(r.b.win)} · ${r.b.turns.toFixed(1)} · 체력 ${pct(r.b.hp)} | ${pct(r.c.win)} | ${pct(r.d.win)} | ${pct(r.e.win)} | ${pct(r.f.win)} |`);
