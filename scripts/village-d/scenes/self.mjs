// 장면 self — 틀이 도는지 스스로 본다(dcheck --self): 기본 마을 스크린샷 하나 · 접근성 단추 ≥ 1 · 가짜 시계가 프레임을 돌리나.
// 장면 꼴(뒤 장면도 같음): export default async (ctx) => 결과 — ctx = { open · shot · ax · probe · expect · pump · advance · sleep · evaluate · send · result · dir · BASE }.
export default async function self(ctx) {
  const f = await ctx.shot('self');
  ctx.result.접근성단추 = await ctx.ax();
  ctx.expect(ctx.result.스크린샷.length === 1 && ctx.result.스크린샷[0].바이트 > 1000, '스크린샷 1');
  ctx.expect(ctx.result.접근성단추.length >= 1, '접근성 단추 ≥ 1');
  const t0 = await ctx.probe('performance.now()'); await ctx.pump(30); const t1 = await ctx.probe('performance.now()');   /* 가짜 시계 — 30장이면 500ms */
  ctx.expect(Math.round(t1 - t0) === 500, '가짜 시계가 프레임 30장 = 500ms 로 흐름');
  return { 그림: f.split('/').slice(-2).join('/'), 가짜시계ms: Math.round(t1 - t0) };
}
