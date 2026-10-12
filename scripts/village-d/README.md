# village-d — 마을 화면 시험 틀 (dcheck)

헤드리스 크롬 하나로 마을 판을 열어 **스크린샷 · 접근성 단추 · 바깥 주소 시도 · 탐침 값**을 잰다.
틀(크롬 · 정적 서버 · 바깥 주소 막기 · 가짜 시계)은 화면 회귀(`scripts/village-look`)와 한 벌이다 — `scripts/village-look/lib.mjs`.

```
node scripts/village-d/dcheck.mjs --self                               # 틀이 도는지: 기본 마을 스크린샷 1 · 단추 ≥ 1 · 가짜 시계
node scripts/village-d/dcheck.mjs --stage town3 --eval 'window.__sim()'  # 판을 열고 탐침 하나
node scripts/village-d/dcheck.mjs --scene <이름>                        # scenes/<이름>.mjs
node scripts/village-d/dcheck.mjs --scene tray                          # [MAC-TRAY] 판 트레이 — 카드 · 탭 · 값 줄 · 오른쪽 누름 · 길게 누름 · 끌어 치우기(임시 판을 쓰고 지움)
node scripts/village-d/dcheck.mjs --help                               # 옵션 전부
```

## 지키는 것
- **sid 는 늘 guest** — 운영 저장본 · 운영 DB 에 닿지 않는다. 판(`?stage=`)은 원격 동기를 끈다(엔진) — dcheck 가 그것도 확인한다.
- **바깥 주소는 전부 막는다**(이 서버와 `data:` · `blob:`만 통과). 막은 채 **시도를 주소째 적는다**(`result.json` 의 `바깥시도`). `?stage=` 페이지는 바깥 시도 0 이 기대다.
- **크롬 동시 실행 금지**(발열) — village-look · village-check · gate 와 같은 때 돌리지 않는다. 끝나면 브라우저 · 서버를 닫는다.
- 크롬 = `CHROME=` 가 먼저 · 없으면 ms-playwright 캐시의 chrome-headless-shell 가운데 가장 새 빌드 · 맥은 Metal GPU.

## 시계
가짜 시계는 `requestAnimationFrame` · `performance.now` 만 멈춘다. `setTimeout` · `setInterval` · `Date.now` 는 진짜 시간이다.
- `ctx.pump(n)` — 프레임 n 장(1/60초씩)만. 시뮬 틱 · 그리기만 흐른다.
- `ctx.advance(ms)` — 프레임과 진짜 시간을 **함께** ms 만큼. 시작 카드(600ms 타이머) · 토스트(2.1초) · 💬(2초 간격)처럼 진짜 타이머가 끼는 장면은 이것으로.
- 'N초 동안 틱이 그대로' 같은 시험은 흘린 뒤 값을 보고, **양성 대조**(멈춤을 풀면 틱이 는다)를 함께 둔다 — 아무것도 안 흘리면 늘 참이 된다.

## 장면 꼴
```js
// scripts/village-d/scenes/<이름>.mjs
export default async function (ctx) {
  await ctx.advance(1000);                 // 판은 이미 열려 있다(ctx.open({ stage, hash }) 로 다시 열 수 있음)
  await ctx.shot('첫 화면');                // <out>/<장면>/첫_화면.png
  ctx.expect(await ctx.probe('window.__sim().틱') > 0, '틱이 흐름');
  return { 단추: (await ctx.ax()).length };  // result.json 의 장면값
}
```
`ctx` = `open · shot · ax · probe · expect · pump · advance · sleep · evaluate · send · result · dir · BASE`.

## 옵션 요약
`--size 1366x610` · `--hour 10` · `--gfx fixed` · `--lookseed 1`(그림 난수) · `--simrand tool|stage`(tool = 판정 난수도 이 틀이 심음 · stage = 심지 않아 판 파일의 시드 길을 그대로) ·
`--frames 60` · `--reduce-motion` · `--voice`(읽어 주기 흉내 — `window.__dVoice`) · `--net-delay <ms>[:<글자>]`(서버 응답 늦춤 · 학교망 흉내) · `--out tmp/village-d` · `--keep`.

## 출력
`tmp/village-d/<장면>/` 스크린샷 · `result.json`(탐침 · 접근성 단추 · 바깥 시도 · 페이지 오류 · 기대). 끝값 0 = 기대대로 · 1 = 기대 어긋남 · 2 = 돌리지 못함.
