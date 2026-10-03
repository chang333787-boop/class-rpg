// 힘겨루기 가위바위보 — 상성은 배수 · 서로의 '힘 × 상성'을 견줘 이김/비김/짐 (산불은 컵 물로 못 끈다)
import { loadWorld, makeStudent, makeRng, zoneOf } from '../scripts/balance/lib.mjs';
const W = loadWorld({ seed: 5 }); const G = W.GAME_DATA; const rng = makeRng(77), R = () => rng();
const EL = ['fire', 'water', 'grass'], beats = { water: 'fire', fire: 'grass', grass: 'water' };
const rel = (a, b) => a === b ? 0 : beats[a] === b ? 1 : -1;
function run(cfg) {
  const { adv, dis, winAt, loseAt, mHp, mAtk, mPow } = cfg;
  const em = (a, b) => { const r = rel(a, b); return r > 0 ? adv : r < 0 ? dis : 1; };
  function fight(L, mon, strat, armor) {
    const st = makeStudent(W, L, '풀장비'), c = st.combat;
    const power = c.atk + c.mag + 4 + L * 0.6, def = c.def || 0, hpMax = 80 + 12 * L;
    let hp = hpMax, mhp = Math.round(mon.hp * mHp), t = 0, gauge = 0, upsets = 0, advRounds = 0;
    const df = 100 / (100 + (mon.def || 0)), pf = 100 / (100 + def);
    while (hp > 0 && mhp > 0 && t < 40) {
      t++; const big = t % 3 === 0;
      const mc = big ? mon.element : (R() < .5 ? mon.element : EL.filter(e => e !== mon.element)[R() < .5 ? 0 : 1]);
      const other = EL.filter(e => e !== mc)[R() < .5 ? 0 : 1], hint = big ? [mc] : [mc, other];
      let pick;
      if (strat === 'smart' && gauge >= 100) pick = 'ult';
      else if (strat === 'smart' && big) pick = EL.find(e => beats[e] === mc);
      else if (strat === 'smart') { const [a, b] = hint; pick = beats[a] === b ? a : b; }
      else pick = EL[Math.floor(R() * 3)];
      const mAttack = mon.atk * mAtk * (big ? 2 : 1);
      if (pick === 'ult') { gauge = 0; mhp -= Math.round(power * 2.4 * df); hp -= Math.round(mAttack * .6 * pf); continue; }
      const mine = power * em(pick, mc) * (pick === armor ? 1.25 : 1), theirs = mon.atk * mPow * em(mc, pick) * (big ? 2 : 1);
      const r = mine / theirs, out = r >= winAt ? 1 : r <= loseAt ? -1 : 0;
      if (rel(pick, mc) > 0) { advRounds++; if (out < 1) upsets++; }
      gauge = Math.min(100, gauge + (out > 0 ? 34 : out === 0 ? 15 : 0));
      mhp -= Math.max(1, Math.round(power * (pick === armor ? 1.25 : 1) * (out > 0 ? 1.6 : out === 0 ? 1 : .5) * df));
      if (mhp <= 0) break;
      hp -= Math.max(1, Math.round(mAttack * (out > 0 ? .5 : out === 0 ? 1 : 1.6) * pf));
    }
    return { win: mhp <= 0 && hp > 0, t, upsets, advRounds };
  }
  const out = {};
  for (const gap of [-3, 0, 2, 4, 6]) for (const strat of ['random', 'smart']) {
    let w = 0, k = 0, tt = 0, up = 0, ad = 0;
    for (const L of [5, 8, 12, 15, 18, 22, 25]) {
      const ml = L + gap; const mons = G.monsters.filter(m => m.level === ml); if (!mons.length) continue;
      for (const m of mons) for (let i = 0; i < 80; i++) { const r = fight(L, m, strat, EL[i % 3]); k++; tt += r.t; up += r.upsets; ad += r.advRounds; if (r.win) w++; }
    }
    out[gap + '|' + strat] = { win: w / k, t: tt / k, upset: ad ? up / ad : 0 };
  }
  return out;
}
const pct = x => Math.round(x * 100) + '%';
for (const cfg of [
  { name: '상성만(지금 시제품)', adv: 1e6, dis: 1e-6, winAt: 1, loseAt: 1, mHp: 2.2, mAtk: 2.0, mPow: 2.3 },
  { name: '힘겨루기 1.5/0.67', adv: 1.5, dis: 0.67, winAt: 1.25, loseAt: 0.8, mHp: 2.2, mAtk: 2.0, mPow: 2.3 },
  { name: '힘겨루기 1.3/0.77', adv: 1.3, dis: 0.77, winAt: 1.25, loseAt: 0.8, mHp: 2.2, mAtk: 2.0, mPow: 2.3 },
]) {
  const o = run(cfg);
  console.log(`\n### ${cfg.name}`);
  console.log('| 몬스터 레벨 차 | 아무거나 승률 | 생각하며 승률 · 차례 | 상성 유리했는데 못 이긴 차례 |');
  for (const gap of [-3, 0, 2, 4, 6]) { const a = o[gap + '|random'], b = o[gap + '|smart']; if (!a) continue; console.log(`| ${gap > 0 ? '+' + gap : gap} | ${pct(a.win)} | ${pct(b.win)} · ${b.t.toFixed(1)} | ${pct(b.upset)} |`); }
}
