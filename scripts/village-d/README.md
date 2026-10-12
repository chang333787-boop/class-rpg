# village-d — 마을 화면 시험 틀 (dcheck)

헤드리스 크롬 하나로 마을 판을 열어 **스크린샷 · 접근성 단추 · 바깥 주소 시도 · 탐침 값**을 잰다.
틀(크롬 · 정적 서버 · 바깥 주소 막기 · 가짜 시계)은 화면 회귀(`scripts/village-look`)와 한 벌이다 — `scripts/village-look/lib.mjs`.

```
node scripts/village-d/dcheck.mjs --self                               # 틀이 도는지: 기본 마을 스크린샷 1 · 단추 ≥ 1 · 가짜 시계
node scripts/village-d/dcheck.mjs --stage town3 --eval 'window.__sim()'  # 판을 열고 탐침 하나
node scripts/village-d/dcheck.mjs --scene <이름>                        # scenes/<이름>.mjs
node scripts/village-d/dcheck.mjs --scene tray                          # [MAC-TRAY] 판 트레이 — 카드 · 탭 · 값 줄 · 오른쪽 누름 · 길게 누름 · 끌어 치우기(임시 판을 쓰고 지움)
node scripts/village-d/dcheck.mjs --save village/stages/boards/pop88.json --eval 'window.__state().사람'   # 저장본을 넣고 엶
node scripts/village-d/dcheck.mjs --dc                                 # [PA-03] TL-0 판별 draw call 표(판 다섯 + @base) → out/dc_baseline.json
node scripts/village-d/dcheck.mjs --scene start-card                    # [MAC-CLOCK] 시계 쥐기 — 카드 전 틱 0 · 카드 동안 가짜 60초 틱 그대로(+[시작] 양성 대조) · Space · ❓ 여는 조건 · 쥐는 이 겹침 · 4× · 모형 ⏸ 단추 · 다시 보기 카드 · 첫 안내 → 카드 틱 0 · module 이 죽어도 8초 안전망
node scripts/village-d/dcheck.mjs --help                               # 옵션 전부
```
- `--save <경로>` — 저장소 안 저장본(.json)을 판 밖 쪽(rules.json)에서 그 판의 저장 키(`rpg.village.guest` · 판이면 `.<판>`)에 넣고 연다(village-look 의 `기본+pop88` 꼴 · 판의 `시작` 땅 대신).
  `--save` 를 `--stage` 와 함께 쓰면 그 판이 허락하는 물건만 실린다(예: pop88 을 `--stage lesson0` 로 — 물건 285 → 255 · 사람 88 그대로 · 저장 키 `rpg.village.guest.lesson0`).
- `--dc <판,판>` — 판 id 또는 `@base`(기본 마을 + pop88). [시작] 뒤 첫 화면(시작칸 배율)에서 — 판 카드를 닫은 뒤에 — 10시 · 20시 차례로(앞으로만) 시각을 맞추고,
  **300장(판 시계 ≥ 5초 = 1배속 300장) 흘린 뒤** 60장 간격으로 `__state().drawCalls`(본 패스 · 그림자 제외) 다섯 번 → 가운데 값(표) · [최소, 최대](`_참고` 의 `낮범위` · `밤범위`).
  `__setHour` 로 시각을 건너뛴 직후엔 사람마다 다음 풍선 때가 한 프레임에 몰려 풍선(종류 하나 = draw call 하나)이 한꺼번에 뜬다(4초 안에 짐) — 그 몰림이 진 뒤에 읽는다(낮 · 밤 같은 규칙).
  기대: 판 열림 · [시작] 누름(카드가 있는 판) · 읽은 시각(`__sim().시`)이 낮 7~18시 · 밤 20~5시 · 첫 읽기가 300장 · 판 시계 5초 뒤 · 다섯 번씩 숫자.
  🗺️ 모형이 첫 화면인 동네 판은 시작칸에 가장 가까운 동네 단추로 마을 화면을 잰다(모형 · 전체 보기 값은 `_참고`).
- 기준표(`out/dc_baseline.json` · `--dc-out <파일>`)는 기대가 다 맞을 때만 쓰고, **덮어쓰지 않고 잰 판의 줄만 바꿔 넣는다**(머리 `_조건` · 잰때는 새로 · 줄마다 `_참고.<판>.잰때`).
  남는 줄과 조건(창 · 그래픽 · 단계 · lookseed · simrand · 렌더러 · 시각 · 읽기)이 다르면 섞지 않고 FAIL — 그 판까지 함께 재거나, 견주기만 할 땐 `--dc-out tmp/…`.

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
`--frames 60` · `--reduce-motion` · `--voice`(읽어 주기 흉내 — `window.__dVoice`) · `--net-delay <ms>[:<글자>]`(서버 응답 늦춤 · 학교망 흉내) · `--out tmp/village-d` · `--keep` ·
`--save <경로>` · `--dc [판,판]` · `--dc-out <파일>`.

## 출력
`tmp/village-d/<장면>/` 스크린샷 · `result.json`(탐침 · 접근성 단추 · 바깥 시도 · 페이지 오류 · 기대). 끝값 0 = 기대대로 · 1 = 기대 어긋남 · 2 = 돌리지 못함.

## 장면 lk — 같은 모습 잣대 · 카드 틀 하나 ([LK-CARD] · PA-09)
```
node scripts/village-d/dcheck.mjs --scene lk     # 약 1분 반 — 카드가 뜨는 판 전부(교과 · "카드": true) × 시작 · 끝 · 되묻기
```
- **틀 지문**: `getComputedStyle` {카드 바탕 · 모서리 · 글꼴 · 주 단추 바탕 · 높이 · 초점 테 색(CDP 로 `:focus-visible` 을 걸어 잼)} = 시작 카드 지문(끝 · 시험 kind) · 되묻기 = 둘째 지문(주 단추 `--vk-warn` · 금 테 2px) · 셋 다 틀 표지(`.vk-dim` · `data-vcard`).
- **넘침**: `card.scrollHeight ≤ clientHeight` + 주 단추([시작] · [닫기] · [↺]) `bottom ≤ innerHeight` — 보통 · 크게(`__lookKit({ big })`) 두 번. CSS `max-height` 때문에 '카드 높이 ≤ 586'은 늘 참이라 쓰지 않는다(H17 #13).
- **겹침**: 카드가 뜬 동안 `#cv` 보임 · 막 불투명도 < 1 · 화면 사진의 카드 밖 점 색 ≥ 8가지(마을 그림).
- **되묻기 손**: 처음 초점 = 그만두기 · Tab · Shift+Tab 이 카드 안에서 돎 · Esc · 바깥 누름 = 그만두기(진짜 키 · 마우스).
- **💬 · ❓**(자유 모드 · 판 카드만 한 시험 카드): 1366×610 보통 · 크게 겹친 넓이 0 · 900×610 은 넓이를 적기만 · 늘 카드 단추 · 🔊 자리가 맨 위. H16 '수업 판 💬 0'은 PA-07 뒤라 대기(수만 적음).
- **되돌리기**: `VRULES.lookKit.on = false` → 끝 카드 · 되묻기가 옛 꼴(틀 표지 0) · 지문 같음.
- **양성 대조**(헛 PASS 막기): 긴 글 → 넘침 잡음 · 모서리 한 칸 → 지문 잡음 · 막을 불투명하게 → 마을 그림 잣대 잡음 · 크게가 실제로 글(15 → 18.75px)과 사진(320 → 240)을 바꿈 · 몸 안 단추는 카드를 안 닫음(단추 명시적 묶기).
- 재는 동안 CSS 전환 · 움직임을 끈다(`.card` 의 `transition: .1s` 가 잰 값을 흔든다). 사진은 help-places · town3 두 판만.
