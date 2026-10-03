// 힘겨루기 가위바위보 — 상성은 배수 · 서로의 '힘 × 상성'을 견줘 이김/비김/짐 (산불은 컵 물로 못 끈다)
import { loadWorld, makeStudent, makeRng, zoneOf } from '../scripts/balance/lib.mjs';
const W = loadWorld({ seed: 5 }); const G = W.GAME_DATA; const rng = makeRng(77), R = () => rng();
const EL = ['fire', 'water', 'grass'], beats = { water: 'fire', fire: 'grass', grass: 'water' };
const rel = (a, b) => a === b ? 0 : beats[a] === b ? 1 : -1;
function run(cfg) {
  const { adv, dis, winAt, loseAt, mHp, mAtk, mPow } = cfg; const own = cfg.own || 0.5;
  const em = (a, b) => { const r = rel(a, b); return r > 0 ? adv : r < 0 ? dis : 1; };
  function fight(L, mon, strat, armor) {
    const st = makeStudent(W, L, '풀장비'), c = st.combat;
    const power = c.atk + c.mag + 4 + L * 0.6, def = c.def || 0, hpMax = 80 + 12 * L;
    let hp = hpMax, mhp = Math.round(mon.hp * mHp), t = 0, gauge = 0, upsets = 0, advRounds = 0;
    const df = 100 / (100 + (mon.def || 0)), pf = 100 / (100 + def);
    while (hp > 0 && mhp > 0 && t < 40) {
      t++; const big = t % 3 === 0;
      const mc = big ? mon.element : (R() < own ? mon.element : EL.filter(e => e !== mon.element)[R() < .5 ? 0 : 1]);
      const other = EL.filter(e => e !== mc)[R() < .5 ? 0 : 1], hint = big ? [mc] : [mc, other];
      let pick;
      if (strat === 'smart' && gauge >= 100) pick = 'ult';
      else if (strat === 'smart' && big) pick = EL.find(e => beats[e] === mc);
      else if (strat === 'smart') { const [a, b] = hint; pick = beats[a] === b ? a : b; }
      else if (strat === 'counter') pick = gauge >= 100 ? 'ult' : EL.find(e => beats[e] === mon.element);   // 힌트 안 보고 '불 몬스터면 물'만
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
  for (const gap of [-3, 0, 2, 4, 6]) for (const strat0 of ['random', 'smart']) { const strat = cfg.__counter && strat0 === 'smart' ? 'counter' : strat0;
    let w = 0, k = 0, tt = 0, up = 0, ad = 0;
    for (const L of [5, 8, 12, 15, 18, 22, 25]) {
      const ml = L + gap; const mons = G.monsters.filter(m => m.level === ml); if (!mons.length) continue;
      for (const m of mons) for (let i = 0; i < 80; i++) { const r = fight(L, m, strat, EL[i % 3]); k++; tt += r.t; up += r.upsets; ad += r.advRounds; if (r.win) w++; }
    }
    out[gap + '|' + strat0] = { win: w / k, t: tt / k, upset: ad ? up / ad : 0 };
  }
  return out;
}
const pct = x => Math.round(x * 100) + '%';
for (const own of [0.5, 0.7, 0.85]) {
  const cfg = { adv: 1.5, dis: 0.67, winAt: 1.25, loseAt: 0.8, mHp: 2.2, mAtk: 2.0, mPow: 2.3, own };
  const strats = ['random', 'counter', 'smart'];
  const res = {};
  for (const st of strats) {
    // run() 은 random/smart 만 돌리므로 counter 를 smart 자리에 넣어 한 번 더 돈다
  }
  const o = run(cfg);
  const o2 = run({ ...cfg, __counter: true });
  console.log(`\n### 몬스터가 자기 속성을 낼 확률 ${Math.round(own * 100)}%`);
  console.log('| 레벨 차 | 아무거나 | 힌트 안 보고 상성만 | 힌트 읽기 |');
  for (const gap of [0, 2, 4]) { const a = o[gap + '|random'], b = o2[gap + '|smart'], c = o[gap + '|smart']; console.log(`| ${gap ? '+' + gap : gap} | ${pct(a.win)} | ${pct(b.win)} | ${pct(c.win)} |`); }
}
