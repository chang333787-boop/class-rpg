# village-sim — 마을을 3D 없이 돌리는 도구

`village/index.html` 을 **한 줄도 안 고치고** node 에 통째로 싣는다. 저장본을 N일 돌려 표를 뽑는다.
(엔진 제안서 ① · `docs/village_engine_proposal.md`)

- three 는 진짜를 쓴다(계산만). 렌더러·DOM 은 무엇을 불러도 빈 값을 돌려주는 가짜다. `Math.random` 은 시드를 받는다 → **같은 시드면 같은 값**이다.
- **운영에 안 닿는다**: `fetch`·XHR·WebSocket 을 모두 거절한다(쓰려 한 횟수는 결과 `네트워크` 에 센다 — 0 이어야 한다). sync.js 는 싣지 않는다. sid 는 늘 guest.
- 모델 glb 도 불러오지 못한다 → 프리미티브 모양으로 돈다. 모양만 다르고 셈은 같다.
- 판마다 새 node 프로세스를 띄운다(모듈 상태가 전역이라서). 기본 동시 6개. 하루(1800틱)에 약 2초.

## 쓰는 법
```bash
# 한 판 · 이틀 · 시드 1~5
node scripts/village-sim/run.mjs --save village/stages/boards/pop167.json --days 2 --seeds 1-5

# 한 수 비교 — '우물 하나 = +20명' 재기를 한 줄로
node scripts/village-sim/run.mjs --save village/stages/boards/pop167.json --days 2 --seeds 1-5 --watch 일먼집,인구 \
  --vs '가게1: do=put shop @jobs 1' --vs '가게3: do=put shop @jobs 3'

# 규칙 켜기/끄기 비교
node scripts/village-sim/run.mjs --save village/stages/boards/pop88.json --vs '일자리끔: rules=jobsHomes.on=false,jobAway.on=false'

# 두 저장본 나란히
node scripts/village-sim/run.mjs --save village/stages/boards/pop88.json --vs 'pop167: save=village/stages/boards/pop167.json'

node scripts/village-sim/test.mjs     # 도구 시험 (약 15초)
node scripts/village-sim/stages.mjs   # 판 파일 검사 (village/stages/README.md)
```

| 인자 | 뜻 |
|---|---|
| `--stage <id>` | 판 파일 `village/stages/<id>.json` 으로 연다(`?stage=` 와 같은 길 · 시작 땅·규칙·목표). 판 파일만 디스크에서 읽어 주고 다른 주소는 여전히 거절 · 지표에 `판목표`(이룬 판 목표 수) |
| `--html <파일>` | 다른 `index.html` 을 싣는다(vendor·판 파일은 이 저장소 것) — **고침 전/후가 같은지** 재기: `--vs '옛: html=/tmp/old.html'` 로 같은 시드끼리 나란히 · `--json` 으로 표본을 떠서 비교 |
| `--save <json>` | 저장본(`__exportText` 꼴 v2). 없으면 빈 땅 |
| `--days N` · `--seeds 1-5` | 며칠 · 어느 시드(`1,3,7` 도 된다) |
| `--rules 'a.b=v,…'` | 불러온 뒤 `VRULES` 를 덮는다. 없는 키면 멈춘다 |
| `--do '…; …'` | 한 수: `put <종류> <x> <y> <rot>` · `put <종류> @jobs\|@crowd\|@need:물 <개수>` (그런 집들의 가운데서 가장 가까운 놓을 수 있는 자리) · `put <종류> @at:<x>,<y> <개수>` (그 점에서 가장 가까운 자리) · `road <x1> <y1> <x2> <y2>` (가로·세로 곧은 길 긋기 — 이미 길인 칸은 건너뜀) · `widen @crowd <n>` (붐비는 집 n채의 문 앞 길을 큰길로 — 바꿔 깔기) · `del <x> <y>` |
| `--vs '이름: do=…; rules=…; save=…'` | 나란히 돌릴 판. 여러 번 줄 수 있다. 첫 판(`기본`)과 같은 시드끼리 비교한다. do 여러 수는 `\|` 로 잇는다 |
| `--show` · `--watch` | 표에 낼 지표 · 비교 표 지표 |
| `--by 1` | 비교에서 '좋아졌다'로 칠 문턱 |
| `--every 150` · `--warm 300` · `--hash 'hour=10'` | 재는 간격(틱) · 한 수 전에 돌릴 틱 · 마을 주소 해시 |
| `--json <파일>` | 모든 표본을 파일로 남긴다 |
| `--voice` | 끝 날의 **동네 바람표**(MAC-VOICE · 동네 × 원하는 것 채 수 · 시드 평균)와 '가장 많은 셋'이 시드마다 같은지 |

**지표**(`measure`): 인구 · 사는집 · 웃는집(😊) · 찡그린집(😟) · 붐빔집 · 일먼집 · 일닿음%(사는 집 중 일할 곳이 닿는 비율) · 2층이상 · 3층 · 찬자리 · 일자리 · 목표(이룬 수) · 돌아선집 · `없음:<필요>`. 낮을수록 좋은 것: 붐빔집·일먼집·돌아선집·찡그린집·없음:*.

**체득 지표**(보스 09-20 · 사회시뮬 잣대에서 먼저 둘)
- **선택 대비**: 같은 시드에서 `기본` 과 한 수 둔 판의 끝 값 차이(좋아진 쪽이 +), 몇 시드에서 좋아졌나.
- **인과 지연**: 한 수 뒤 `기본` 보다 `--by` 이상 좋아져서 **끝까지 그대로인** 첫 순간(시뮬 시간). 재는 간격(`--every`)만큼 거칠다. 다른 저장본끼리는 뜻이 없어 `—` 로 둔다.
- 현상 발생률 · 관찰 밀도는 다음에.

## 조심
- 문 방향처럼 **카메라를 읽는 규칙**은 가짜 카메라(늘 0) 기준으로 돈다.
- 토스트·칩·목표판 같은 DOM 은 빈 동작이다. 그래도 상태는 남는다.
- index.html 에 새 브라우저 API 가 들어오면 불러오기에서 `LOAD ERR … index.html N줄 무렵` 으로 멈춘다 → `load.mjs` 의 `fakeGlobals` 에 한 줄 더하면 된다.
- 틱 ms 는 가짜 그림까지 포함한 node 값이라 브라우저 값과 다르다. 성능은 브라우저에서 잰다.
- `village/stages/boards/pop88.json`·`pop167.json` 은 창조자의 눈 세션에서 아이 역할로 지은 판이다(실제 학생 자료 아님 · 이름 없음).
- `village/stages/boards/mid36.json` 은 **실학급 크기 시험 판**이다(집 36채 = 보통 집 33 + 아파트 3 · 사는 집 31 · 인구 74 · 주민 연기 담당이 지음 · 실제 학생 자료 아님).
  큰 줄 한 줄에 시설을 모아 **붐빔이 실제로 난다**. 아파트 셋 중 **하나는 비어 있다**(저장 왕복 시험용). 밭·헛간이 있어 **흐름은 `--stage farm` 으로** 잰다:
  `node scripts/village-sim/run.mjs --stage farm --save village/stages/boards/mid36.json --days 3 --seeds 1-5` — `--save` 와 `--stage` 를 함께 주면 저장본이 판 칸에도 들어간다.
  판 없이 열면 밭·헛간은 모르는 종류로 빠지고(흐름 꺼짐) 붐빔·돌아섬은 그대로 잰다.
