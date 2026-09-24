# village-sim — 마을을 3D 없이 돌리는 도구

`village/index.html` 을 **한 줄도 안 고치고** node 에 통째로 싣는다. 저장본을 N일 돌려 표를 뽑는다.
(엔진 제안서 ① · `docs/village_engine_proposal.md`)

- three 는 진짜를 쓴다(계산만). 렌더러·DOM 은 무엇을 불러도 빈 값을 돌려주는 가짜다. `Math.random` 은 시드를 받는다 → **같은 시드면 같은 값**이다.
- **벽시계는 멈춘다**(MAC-SIMCLOCK · 09-24): 싣는 순간부터 `performance.now`·`Date.now` 는 한 값이다. 시뮬 동안 진짜 시간은 흐르지 않는다.
  - 이것이 없을 때는 부하가 크면 값이 흔들렸다. 싣기 끝의 첫 그리기(loop)가 싣는 데 걸린 시간만큼 틱을 미리 돌렸고(1~2틱), 땅 고르기가 '진짜 30초' 뒤 저절로 열렸다.
  - 틱 시간은 진짜 시계로 따로 잰다(`__tickBench` 의 `틱평균ms` · run.mjs 끝줄 '틱 시간').
  - 벽시계를 일부러 빨리 돌려 보는 시험 도구가 `wallclock.mjs` 다(`NODE_OPTIONS=--import=…/wallclock.mjs` · test.mjs '벽시계를 흔들어도 판정 값이 같다').
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
| `--vs '옛: root=<폴더>'` | 다른 **뿌리**(그 폴더의 `village/` — index.html·판 파일·vendor 모두 그것)로 돌린 판. `html=` 은 index.html 만 바꿔서 **판 파일 변화가 가려진다**. 저장본(`save=`)은 늘 이 저장소 것(같은 입력) — MAC-VSREF |
| `--save <json>` | 저장본(`__exportText` 꼴 v2). 없으면 빈 땅. 저장본에 **판 전용 종류**(field·villtree·pier…)가 있는데 그 판(`--stage` · vs 칸 `stage=`)이 없으면 ⚠ 로 크게 알린다(그 물건은 빠진 채 돈다 · 표 첫머리에 '못 살린 것 N개') — MAC-STAGEKINDS |
| `--days N` · `--seeds 1-5` | 며칠 · 어느 시드(`1,3,7` 도 된다) |
| `--lookseed N` | **그림 난수만** 따로 시드(MAC-SIMRAND). 판정(사람 발길·드나듦·바람·이웃)은 `simRand` 줄기라 `--seeds` 로만 움직인다 — 그림 PR 이 판정을 건드렸는지 재기: `--vs '그림흔듦: lookseed=99'` 가 다른 값 0 이어야 한다. vs 칸에도 `lookseed=` |
| `--rules 'a.b=v,…'` | 불러온 뒤 `VRULES` 를 덮는다. 없는 키면 멈춘다 |
| `--do '…; …'` | 한 수: `put <종류> <x> <y> <rot>` · `put <종류> @jobs\|@crowd\|@need:물 <개수>` (그런 집들의 가운데서 가장 가까운 놓을 수 있는 자리) · `put <종류> @at:<x>,<y> <개수>` (그 점에서 가장 가까운 자리) · `road <x1> <y1> <x2> <y2>` (가로·세로 곧은 길 긋기 — 이미 길인 칸은 건너뜀) · `widen @crowd <n>` (붐비는 집 n채의 문 앞 길을 큰길로 — 바꿔 깔기) · `widen @point <n>` (붐빔 ✨ 가 짚는 칸에 큰길을 n번 — MAC-CROWDPOINT) · `del <x> <y>` |
| `--vs '이름: do=…; rules=…; save=…'` | 나란히 돌릴 판. 여러 번 줄 수 있다. 첫 판(`기본`)과 같은 시드끼리 비교한다. do 여러 수는 `\|` 로 잇는다 |
| `--show` · `--watch` | 표에 낼 지표 · 비교 표 지표 |
| `--by 1` | 비교에서 '좋아졌다'로 칠 문턱 |
| `--every 150` · `--warm 300` · `--hash 'hour=10'` | 재는 간격(틱) · 한 수 전에 돌릴 틱 · 마을 주소 해시 |
| `--json <파일>` | 모든 표본을 파일로 남긴다 |
| `--voice` | 끝 날의 **동네 바람표**(MAC-VOICE · 동네 × 원하는 것 채 수 · 시드 평균)와 '가장 많은 셋'이 시드마다 같은지 |

**마을 PR 검사 한 줄 — `scripts/village-check.mjs`**(MAC-CHECK): module `node --check` · verify-safety · village-paint · village-sim 시험 · 판 검사 · **vsref**(판정) · **village-look**(그림)을 차례로 하나씩 돌려 한 표로 — 끝값 0/1/2. `--quick`(vsref 하루·시드 1 · look default 장면만 · 잰 값 약 1분 50초 · 전부는 3~4분) · `--skip look,vsref` · `--ref HEAD~1` · `--allow`.

**기준 ① 한 줄 — `vsref.mjs`**(MAC-VSREF): 지금 작업 트리와 그 ref(기본 `origin/main`)를 **같은 시드끼리 · 모든 표본 · 모든 지표**로 견주고, 덤으로 **그림 흔들기**(`lookseed 99` — 판정이 그림 난수를 안 먹는지 · #926)도 본다. 옛 쪽은 그 ref 의 `village/` 를 `git archive` 로 통째로 푼 자리(`root=`)라 **판 파일 변화까지** 잡는다.
```
node scripts/village-sim/vsref.mjs
```
(표준 판 열둘 — 기본+pop88 · 기본+pop167 · farm+mid36 · farm · city · town3 · town3-origin · origin · sea · mountain · proto-flow · proto-vote · 2일 · 시드 1-3.) `--ref HEAD~1` · `--boards …` · `--days 1 --seeds 1` · `--no-look` · `--allow`(의도한 차이 — PR 에 적는다) · `--json`. 끝값 0 PASS · 1 옛과 다름(--allow 없이) 또는 흔들기에 다른 값 · 2 못 돎. 그림 쪽은 `scripts/village-look/shots.mjs --vs-ref origin/main`(화면 회귀)과 짝이다.

**지표**(`measure`): 인구 · 사는집 · 웃는집(😊) · 찡그린집(😟) · 붐빔집 · 일먼집 · 일닿음%(사는 집 중 일할 곳이 닿는 비율) · 2층이상 · 3층 · 찬자리 · 일자리 · 목표(이룬 수) · 돌아선집 · `없음:<필요>`. 낮을수록 좋은 것: 붐빔집·일먼집·돌아선집·찡그린집·없음:*.

**체득 지표**(보스 09-20 · 사회시뮬 잣대에서 먼저 둘)
- **선택 대비**: 같은 시드에서 `기본` 과 한 수 둔 판의 끝 값 차이(좋아진 쪽이 +), 몇 시드에서 좋아졌나.
- **인과 지연**: 한 수 뒤 `기본` 보다 `--by` 이상 좋아져서 **끝까지 그대로인** 첫 순간(시뮬 시간). 재는 간격(`--every`)만큼 거칠다. 다른 저장본끼리는 뜻이 없어 `—` 로 둔다.
- 현상 발생률 · 관찰 밀도는 다음에.

## 첫 30초 탐지기 `--first30` (docs/village_first_screen.md)

원본 마을(저장본)을 **여는 시각 여럿**에서 열어 **300틱(1× 30초 = 시뮬 4시간)** 을 돌리고, 첫 화면의 어설픔을 표 + PASS/FAIL 로 말한다.

```bash
node scripts/village-sim/run.mjs --save village/stages/boards/pop88.json --first30 7.5,8,10 --seeds 1-3
node scripts/village-sim/run.mjs --stage farm --save village/stages/boards/mid36.json --first30 8
```

| 묶음 | 칸 | PASS 기준(`first30.mjs` 의 `F30_PASS`) |
|---|---|---|
| ① 사는 모습 셋 | 머무는 사람(곁·앉음·광장) · 놀이터 아이 · 문 밖 일꾼 | 머무는 사람 ≥ 5 가 30표본 중 15 · 아이 ≥ 1 이 15 · 일꾼 ≥ 1 이 5 |
| ② 어수선 | 걱정 칩 🏠·💼 · 붐빔 멈칫 · 떠나는 풍선 · 빈 선반(흐름 판) | 칩 0 · 풍선 0 · 멈칫 평균 ≤ 0.5 · 빈 선반 0 |
| ③ 연기의 어설픔 | 겹쳐 지나감 · 건물·나무 통과 · 제자리 떨림 · 순간이동(· 상태가 바뀌며 튐) · 이웃 인사 | 통과 0 · 순간이동 0 (겹침·떨림은 **기준 아직 없음** — 표에만) |

- 시각마다 **시드 전부가 통과해야 PASS**. 값 = 평균 / 가장 많을 때 / 보인 표본(30 중).
- ③은 틱마다 `window.__folkPos()`(읽기 훅 · `[ACT-FIRST30]`)로 사람 자리를 읽는다. 자리는 **시뮬 좌표**다(브라우저는 틱 사이를 보간하고 몸짓을 더한다). 그 훅이 없는 옛 index.html 이면 ③은 '못 잰다'.
- **통과** = 사람 발 자리가 그 칸 물건의 **몸 높이(0.6~1.5)에 걸친 부위 상자** 안에 들었나(칸 방향대로 돌려서). 칸 전체로 치면 2×2 집의 **문 앞 마당**(벽 밖 1.2)에 선 새 이웃까지 '집 안'으로 센다 — 처음 판이 그랬다(09-23 고침). 곁 자리(우물가·가게 앞·일꾼)는 일부러 세운 자리라 통과에서 뺀다. 통과 칸에는 '종류:상태'와 첫 예 셋(칸 자리)이 붙는다 — **실화면으로 확인할 후보**다.
- **못 재는 것**: 비켜섬 · 우물가 수다 · 반딧불(그리는 쪽에서 정해진다) · 걱정 얼굴. 표에 '못 잰다'로 나온다.
- **겹침(포갬)·줄 세움은 시뮬로 판정하지 않는다.** 시뮬은 그림 틀을 안 돌려, 같은 칸 둘을 벌리는 ACT-PASS 와 서 있는 사람을 비켜 세우는 ACT-SPACE(그림만)가 0 이다 — 표의 겹침은 **셈 자리**다. 화면판 기준(2026-09-23 · ACT-SPACE 와 함께 정함): **포갬쌍(그려진 자리 0.6 안) 평균 ≤ 0.5/프레임 · 가장 가까운 두 사람이 정확히 4.00 인 프레임 0**. 잰 값: town3 4.00 704/704 → 0 · 도시+mid36 포갬 7.4 → 0.34.
- `--json 결과.json` 으로 표본 전부를 남긴다.

## 사냥 하네스 `scripts/village-hunt/hunt.mjs` — 화면판 (창조자 25회 3절)

`--first30` 이 시뮬로 못 재는 것(그림 층의 포갬·줄 세움 · 프레임 사이의 튐)을 **진짜 브라우저의 그려진 자리**로 잰다. 판 여럿 × N초(기본 여섯 × 60초 · 아침 8시).

```bash
node scripts/village-hunt/hunt.mjs
node scripts/village-hunt/hunt.mjs --boards town3,farm+village/stages/boards/mid36.json --sec 30 --json out.json
```

- 판 하나 = `판이름` 또는 `판이름+저장본`(`기본` = 판 없음). 빈 시작 땅은 사람이 0 이라 잴 게 없다(REVIEW) — 기본 일곱은 `기본+pop167 · origin(원본 마을 · 시작 저장본) · town3 · farm/city/sea/mountain+mid36`.
- 브라우저는 **스스로 띄운 헤드리스 하나**(ms-playwright 의 chrome-headless-shell · 없으면 `CHROME=<경로>`) · 정적 서버도 스스로(127.0.0.1 · 빈 포트). `sid=guest` · 운영 DB·구글 주소는 막는다 · 판마다 localStorage 를 비운다 · 끝나면 브라우저·서버·임시 프로필을 닫는다. 남과 나눠 쓰는 Playwright 창은 안 쓴다.
- **3D 는 GPU(ANGLE Metal)로 그린다**(09-24 발열 · 보스 실측): 예전 swiftshader 는 CPU 로 그려 한 벌이 CPU 평균 584%(최대 768) — 지금 평균 16~17%. 창은 크롬북 크기 1366×610 · 틀 수 상한 30 · 판 사이 5초 쉼. GPU 가 안 잡히는 기기만 `--soft`. 표 아래 '그린 것:' 줄이 렌더러 이름이다. `--view 1366,610` · `--fps 30` · `--rest 5`.
- ⚠ 무겁다(판마다 60초) — **사람·연기를 건드린 PR 에서만** 돌린다.
- FAIL: **오래 포갬**(같은 둘이 그려진 자리 0.6 안에 1초 넘게 · 20프레임 넘게 — 긴 프레임이 몰리면 프레임마다 벌리는 간격이 못 따라온다) · 줄 세움(정확히 4.00) · 벽 통과(`--first30` 과 같은 몸 높이 부위 상자) · 튐(같은 상태로 한 프레임 2.0 넘게 · 100ms 넘는 긴 프레임 뒤는 '긴 프레임'으로 따로) · 갇힘(`__stuck` — until 로 나오는 '들름'만 · 집·일터·학교는 시각으로 나와 뺀다) · 오류(페이지 예외 + `__errors` 의 삼킨 오류·덮개).
- 시각을 바꾸면(`--hour`, 기본 8) `--warm` 초(기본 2) 기다린 뒤 잰다 — 건너뛴 직후 몇 프레임은 한꺼번에 나오는 사람이 벽 안에 그려진다(09-23 farm · 0.26초 안).
- 포갬 평균은 **주의**로만 둔다 — 대부분이 0.3초 안에 풀리는 스침이다(mountain 320쌍 중 317쌍). 괄호 안이 스침 수. '한 칸 박자'(서 있는 사람 가운데 가장 가까운 서 있는 이웃이 3.6~4.4 인 몫 · `__folkSpace().그린자리`) > 0.5 도 주의.
- 주의(판정 아님): 포갬 평균 · 한 칸 박자 · 우표 마을(물건 화면 폭 ÷ 창 폭 < 0.4) · 빈 30초(아무것도 안 누른 첫 30초의 말 0) · 프레임 > 20ms(소프트웨어 GL 이라 참고만).
- 안 잰다(입력이 필요하다): 말 충돌 · 반응 ms · 흰 공. `(셈 포갬 표본)` 은 창조자 25회 표와 견주려는 셈 자리(2.0 안) 값이다.
- 시뮬 난수가 매번 달라 **벽 통과·튐은 판마다 0~2 로 들쭉날쭉**하다 — FAIL 한 칸은 표의 예(종류:상태 (자리) @초)로 실화면을 확인할 후보다.

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
