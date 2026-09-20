/* 일자리 — 마을 시뮬의 한 조각 (엔진 제안서 ④ 걸음 1 · docs/village_sim_move_plan.md)
   index.html 에서 `await import('./sim/jobs.js?v=…')` 한 뒤 `init(ctx)` 로 문을 건네받는다. 서로 import 하지 않는다.
   ctx(들어오는 것): 판(cells·K·idx·inb·cX·cY) · 셈(folks·population·roadBFS·isAdult — 늦게 만들어지는 것은 getter) · 고리(hookable).
   내보내는 것: JOB_POP · jobCount · jobStats · jobsTick · joblessHome · joblessRatio · jobText — **이름·모양 그대로**(연기·시험 훅·도구가 읽는다).
   여기 코드는 옮기기만 했다 — 한 글자도 고치지 않았다(증거: 옛/새 같은 시드 표본 일치). */
export function init(ctx) {
  const { cells, K, idx, inb, cX, cY } = ctx;                 // 일찍 만들어지는 것은 그대로
  const folks = () => ctx.folks, roadBFS = (...a) => ctx.roadBFS(...a), population = () => ctx.population(), isAdult = f => ctx.isAdult(f);

  const JOB_POP = 20;   // 43차: 인구 20 부터(10 은 첫 성장을 막았다 — G1 실측)   이 인구부터 "일할 곳이 없어요"를 따진다(첫 집 몇 채에서 바로 😐 가 되지 않게)
  const jobCount = new Map();                           // 일터 root → 붙은 어른 수
  const jobStats = { 일자리: 0, 찬자리: 0, 일없는어른: 0, 출근: 0 };
  let jobRR = 0;

  function jobsTick() {
    jobCount.clear(); let total = 0;
    cells.forEach((rec, i) => { if (rec && rec.root === i && K[rec.k].jobs) { total += K[rec.k].jobs; jobCount.set(i, 0); } });
    folks().forEach(f => { if (f.job != null && !jobCount.has(f.job)) f.job = null; if (f.job != null) jobCount.set(f.job, jobCount.get(f.job) + 1); });
    /* 일 없는 어른 둘씩 — 집 앞 길에서 40칸 안 일터 중 빈 자리 있는 곳, 가까운 순 */
    const idle = folks().filter(f => isAdult(f) && f.job == null && f.base >= 0);
    for (let t = 0; t < 2 && idle.length; t++) {
      const f = idle[(jobRR++) % idle.length];
      const { reach } = roadBFS(f.base);
      let got = -1;
      for (const i of reach) {
        const x = cX(i), y = cY(i);
        for (let k = 0; k < 4 && got < 0; k++) {
          const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
          if (!inb(nx, ny)) continue;
          const c = cells[idx(nx, ny)]; if (!c || !K[c.k].jobs) continue;
          if ((jobCount.get(c.root) || 0) < K[c.k].jobs) got = c.root;
        }
        if (got >= 0) break;
      }
      if (got >= 0) { f.job = got; jobCount.set(got, jobCount.get(got) + 1); idle.splice(idle.indexOf(f), 1); }
    }
    let filled = 0; jobCount.forEach(v => filled += v);
    jobStats.일자리 = total; jobStats.찬자리 = filled; jobStats.일없는어른 = folks().filter(f => isAdult(f) && f.job == null).length;
  }
  /* 이 집 어른이 모두 일자리가 없나(인구 10 부터) */
  function joblessHome(root) {
    if (population() < JOB_POP) return false;
    let adults = 0, jobless = 0; folks().forEach(f => { if (f.home === root && isAdult(f)) { adults++; if (f.job == null) jobless++; } });
    return adults > 0 && jobless === adults;
  }
  const joblessRatio = () => { let a = 0, j = 0; folks().forEach(f => { if (isAdult(f)) { a++; if (f.job == null) j++; } }); return a ? j / a : 0; };
  const jobText = rec => K[rec.k].jobs ? '일자리 ' + (jobCount.get(rec.root) || 0) + '/' + K[rec.k].jobs : '';

  /* 규칙이 붙는 자리는 그대로 — 바깥에서 전처럼 hookAdd('jobsTick', …) 하면 된다(#700) */
  return { JOB_POP, jobCount, jobStats, jobText, joblessRatio,
    jobsTick: ctx.hookable('jobsTick', jobsTick), joblessHome: ctx.hookable('joblessHome', joblessHome) };
}
