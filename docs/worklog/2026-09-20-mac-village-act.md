# 2026-09-19 ~ 09-20 (기기: 맥북) — 우리 마을 · 주민 연기 담당 세션

> 담당: 주민(folks)이 **사는 모습**(걷기·멈추기·들고 가기·인사·아이)이 눈에 보이게. 보스 세션이 검증·머지한다. **이 세션은 아무것도 머지하지 않았다.**
> 일감의 출처: `docs/creator_notes/2026-09-20.md`(창조자의 눈 1회) + 보스가 2회 보고에서 더한 것.
> 기준 판: `origin/feat/village-45` 의 `village/index.html`(CRLF). 전부 `?sid=guest&dev=1&cb=<숫자>` 로만 열었다(운영 DB 미접속 · 외부 요청 0 확인).
> 원칙(사용자): 시뮬의 단위는 집, 걷는 사람은 표본·연기자 / 기본은 평온과 기쁨 / 그림·몸짓으로 / 확률로 판정하지 않는다 / 새 규칙은 `window.VRULES.<이름>` 블록.

## ① PR (전부 base `feat/village-45` · 스택 아님 · 기존 줄 수정 0)

| PR | 무엇 | 상태(09-20 기준) | 스위치 · 시험 훅 |
|---|---|---|---|
| [#482](https://github.com/chang333787-boop/class-rpg/pull/482) ACT-DOOR | 밤에 이미 자기 집 문 앞에 선 사람은 곧장 집에 든다. 같은 저장본: 집안 0·밖 14 → 집안 14·밖 0 | **머지됨** | `VRULES.doorStep` · `__doorStep()` |
| [#492](https://github.com/chang333787-boop/class-rpg/pull/492) ACT-BESIDE | 지붕 없는 곳(우물·분수·연못·놀이터·꿈나무·꽃밭 가족·광장·의자)에서는 사라지지 않고 곁에 서/앉는다 + 우물에서 나오면 **물동이를 들고 집으로** | **머지됨** | `VRULES.beside` · `__beside()` |
| [#500](https://github.com/chang333787-boop/class-rpg/pull/500) ACT-PATH | 걷다가 순간이동 0번 + 이미 일터·학교 앞이면 그 자리에서 들어간다 | **머지됨** | `VRULES.pathKeep` · `__pathKeep()` |
| [#502](https://github.com/chang333787-boop/class-rpg/pull/502) | 이 worklog 1부 | **머지됨** | 문서 |
| [#505](https://github.com/chang333787-boop/class-rpg/pull/505) ACT-LOOK | 돌아서는 새 이웃이 집 앞에서 3초 둘러보고, 풍선을 마을 밖까지 | **머지됨** | `VRULES.lookAround` · `__look()` |
| [#511](https://github.com/chang333787-boop/class-rpg/pull/511) ACT-GREET | 이사 온 다음 날 아침, 옆집 사람 하나가 새 집 앞에 들러 👋 | **머지됨** | `VRULES.greet` · `__greet()` |
| [#518](https://github.com/chang333787-boop/class-rpg/pull/518) ACT-NIGHT | 밤 귀갓길은 칸을 잡지 않고 서로 지나친다 — 새벽 4시 밖 0~1명(전 절반) | **머지됨** | `VRULES.nightHome` · `__nightHome()` |
| [#521](https://github.com/chang333787-boop/class-rpg/pull/521) ACT-LAMP | 가로등 없는 집 식구는 밤 귀가 때 종종걸음, 있는 집 식구는 가로등 아래서 한 번 멈춤 | **머지됨** | `VRULES.lampWalk` · `__lampWalk()` |
| [#525](https://github.com/chang333787-boop/class-rpg/pull/525) ACT-KID | 작은 사람(⅔ 키) — 이웃 마을 아이 구경꾼부터. `isSmall()` 한 곳 | **머지됨** | `VRULES.kid` · `__kid()` |
| [#527](https://github.com/chang333787-boop/class-rpg/pull/527) ACT-PLAZA | 정자 지붕 아래 · 축제 날 광장 가운데를 보고 둥글게 · 길목 사람은 가장자리로 한 발 | **머지됨** | `VRULES.plazaRing` · `__plaza()` |
| [#529](https://github.com/chang333787-boop/class-rpg/pull/529) ACT-KIDS | 2층 이상 집엔 아이 — 오후엔 놀 곳으로 뛰어가고 저녁 18시부터 먼저 집에 | **머지됨** | `VRULES.kids` · `__kids()` |
| [#530](https://github.com/chang333787-boop/class-rpg/pull/530) ACT-UMB | 우산은 든 사람 머리 위에(4.3 → 2.56) · 손잡이 · 아이 높이 · 곁에 선 사람도 | 열림 | `VRULES.umbrella` · `__umbrella()` |
| [#532](https://github.com/chang333787-boop/class-rpg/pull/532) ACT-GAP | 끊긴 길(1~2칸 빈틈) 끝에 근처 주민이 와서 멈칫, 건너편을 바라본다 | 열림 | `VRULES.gapLook` · `__gap()` |
| (이 PR) | worklog 2부 + 가게 앞 쓰레기 제안 한 장 [`docs/village_act_litter_proposal.md`](../village_act_litter_proposal.md) | 열림 | 문서 |

## ② 고친 줄 지도 — 월요일 3-way 용 (`grep -n "ACT-" village/index.html` 로 전부 찾는다)

**기존 줄을 고친 곳은 없다.** 전부 '새 블록 + 고리 한 줄씩'이다. 위치는 머지 전 base 기준의 **이웃 줄**로 적는다(줄 번호는 밀린다).

| 표식 | 새 블록 위치 | 고리(한 줄씩) |
|---|---|---|
| `[ACT-DOOR]` 19줄 | `function tickFolks(dt, now) {` 바로 위 | `tickFolks` 안 `if (!f.visitor && rhythmTick(f, i, now) && …` **바로 위** : `if (actDoorStep(f, i)) continue;` |
| `[ACT-PATH]` 41줄 | `function tickFolks` 바로 위(ACT-DOOR 블록 아래) | 같은 `rhythmTick` 줄 **바로 위**(ACT-DOOR 고리 아래) : `if (actPathBefore(f, i)) continue;` / **바로 아래** : `actPathAfter(f, i);` |
| `[ACT-BESIDE]` 121줄 | `/* ═══ … 저장 — 지금은 이 컴퓨터(localStorage)…` 배너 바로 위(= `drawFolks` 뒤) | ① `tickFolks` 안 `f.base = roadBeside(rec);` **바로 아래** ② 루프의 `drawFolks(…); drawFaces(…); drawUmbrellas(); rainTick(real);` **바로 아래** ③ `whatDoing` 안 `if (f.state === 'inside') {…` **바로 위** |

| `[ACT-NIGHT]` 37줄 | `const SCHOOL_MAX = 12;` 바로 위 | `tickFolks` 안 `if (actDoorStep(f, i)) continue;` **바로 위** : `if (actNightHome(f, i, now, dt)) continue;` |
| `[ACT-LAMP]` 38줄 | `function syncFolks() {` 바로 위 | `tickFolks` 안 `if (!rec) continue;` **바로 아래** : `if (actLampTick(f, i, now, dt)) continue;` |
| `[ACT-UMB]` 44줄(#530) | `function syncFolks() {` 바로 위(ACT-LAMP 블록 아래) | 루프 `drawClock(); applyDaylight();` **바로 위** : `actUmbrellaDraw(…)` |
| `[ACT-LOOK]` 21줄 | `[ACT-DOOR]` 배너 바로 위 | `tickFolks` 의 `for (…) { const f = folks[i];` **바로 아래** : `if (actLookTick(f, i, now)) continue;` |
| `[ACT-GAP]` 64줄(#532) | `[ACT-DOOR]` 배너 바로 위(ACT-LOOK 블록 아래) | `tickFolks` 안 `if (actGreetTick(f, i, now)) continue;` **바로 위** : `if (actGapTick(f, i, now)) continue;` |
| `[ACT-GREET]` 80줄 | `/* 우산(F13) — 사람마다 하나…` 바로 위 | ① `tickFolks` 안 `if (f.state === 'idle') {` **바로 위** : `if (actGreetTick(…)) continue;` ② 루프 `drawClock(); applyDaylight();` **바로 아래** : `actGreetDraw(…)` |
| `[ACT-PLAZA]` 52줄 | `/* 우산(F13)…` 바로 위(ACT-GREET 블록 아래) | ① `tickFolks` 안 ACT-BESIDE 고리 **바로 아래** : `actPlazaTick(f, i, now);` ② 루프 `actBesideDraw(…)` **바로 위** : `actPlazaDraw();` |
| `[ACT-KID]` 36줄 | `/* ═══ … 저장 — …` 배너 바로 위(ACT-BESIDE 블록 아래) | ① 루프 `actBesideDraw(…)` **바로 아래** : `actKidDraw(…)` ② `tickFolks` 안 `if (f.state === 'walk') {` **바로 위** : `if (f.state === 'walk') actKidTick(f, dt);` |
| `[ACT-KIDS]` 68줄 | `/* ═══ … 저장 — …` 배너 바로 위(ACT-KID 블록 아래) | `tickFolks` 안 `if (f.state === 'inside') {` + `const b = cells[f.inside.root];` **바로 위** : `if (actKidsTick(f, i, now, dt)) continue;` · 그리고 `[ACT-KID]` 의 `actKidDraw` 안에 한 줄 더함(`else if (f.festSpot …)`) — 내 블록 |

**`tickFolks` 고리 순서(전부 머지된 뒤 — 순서가 뜻을 가진다):**
`for … const f = folks[i];` → **LOOK** → `const rec…; if (!rec) continue;` → **LAMP** → `f.base = …` → **BESIDE** → **PLAZA** → **KIDS** → (`inside` 처리 블록) → **NIGHT** → **DOOR** → **PATH before** → `rhythmTick` 줄 → **PATH after** → (`mill` 블록) → **GAP** → **GREET** → (`idle` 블록) → **KID(걸음)** → (`walk` 블록).
**루프 그리기 순서:** `drawFolks…drawUmbrellas(); rainTick` → **BESIDE**(#492 은 이 줄 바로 아래였고 그 위에 **PLAZA**) → **KID** → **UMB** → `drawClock(); applyDaylight();` → **GREET**. (PLAZA → BESIDE → KID 순서가 중요: KID 는 앞의 둘이 쓴 행렬을 발밑 기준으로 줄인다.)

주민 객체에 붙인 임시 필드(저장 안 함): `f.beside{root,k,mode,slot,x,z,dir,drop,ring}` · `f.carry{phase,tries,cells,until}` · `f.inside.act` · `f.look` · `f.greet` · `f.nh` · `f.lamp` · `f.festSpot` · `f.kid` · `f.kidHome` · `f.kidRun` · `f.gap`.

## ③ 찾은 것 (원인까지 확인한 것만)

1. **문 앞에 밤새 서 있기(A)** — `rhythmTick → pathTo` 의 `here === goal`: 이미 집 앞 칸이면 걷는 상태가 안 돼 `enterPlace` 고리에 영영 안 닿는다. 밤 도착자뿐 아니라 **밤에 마을을 연 순간의 모든 주민**(`syncFolks` 가 전원을 문 앞에 세운다). → #482.
2. **걷다가 순간이동(B)** — `pathTo`·`pathToBuilding` 은 '지금 경로의 끝'에서 길을 잡고 `step=0`. 걷는 도중에 리듬이 바뀌면(20시·9시·8시) 옛 경로 끝으로 튄다. 사흘에 31~68번, 최대 7.5칸. → #500.
3. **일터·학교 앞에 서 있기(D)** — 1번의 낮 판(`pathToBuilding` 의 `goal === here`). 가게에 닿은 칸에 선 직원이 일하는 시간 내내 밖에 서 있다. → #500.
4. **밤에 헤맴(C) — #500 에선 안 고쳤다 → #518 로 고침.** 밤 `pathTo` 는 '남을 피한 길'만 찾고, 없으면 평소 목적지 고르기로 떨어진다(밤에 긴의자·놀이터에 들어감). '막힌 칸까지 넣어 집으로'를 두 가지로 해 봤더니 **외길에서 마주 선 둘이 안 비켜 귀가가 71 → 27 · 50~59** 로 줄었다. 헤맴과 '딴 건물에 들어가기'가 외길의 숨통이다. **좁은 길에서 비켜 가는 규칙(`claim`)이 먼저** — 프로그램 담당 구역.
5. **밤 귀가는 원래 붐빔에 약하다** — 고리 모양 마을(33명)에서 고치기 전에도 사흘 밤 99번 중 65~89번만 집에 닿는다. 큰길(두 자리)을 쓰면 나아질 것(안 재 봄).
6. 물동이 귀갓길도 같은 뿌리: '남을 피한 길'만 찾으면 65번 중 28번만 집에 닿았다 → 막힌 칸 포함 재시도(`pathHomeAnyway`, #492 안)로 100%. 낮에는 마주 서도 평소 목적지 고르기가 풀어 줘서 문제 없었다.

## ④ 월요일 학교 세션에게 부탁

1. 학교 PC 의 뒤 판과 3-way 할 때 위 ② 표의 **이웃 줄**이 학교 판에서 바뀌었는지 먼저 본다. 바뀌었으면 고리 한 줄을 같은 뜻의 자리로 옮기면 된다(블록은 어디 있어도 된다 — 단 `tickFolks` 보다 위, `[ACT-BESIDE]` 는 `drawFolks`·`folkDummy` 선언보다 아래여도 위여도 무방: 부를 때만 쓴다).
2. **크롬북 실기**에서 볼 것: ⓐ 물동이가 기본 확대(44px/칸)에서 보이는가(지금 5px 남짓) ⓑ 의자에 앉은 사람이 '앉은 것'으로 읽히는가 ⓒ 밤 8시에 사람이 튀지 않는가.
3. 아이들 반응을 적어 달라: 물동이 든 사람을 알아보는가 · "우물이 멀어서 오래 걷네"를 스스로 말하는가(이 일감의 핵심 가설).
4. `pathTo`·`pathToBuilding` 의 `here = 경로의 끝` · `goal === here` 두 곳은 **원본을 고치는 게 더 깨끗하다**(지금은 3-way 때문에 바깥에서 막았다). 원본이 저장소로 정리되면 안쪽에서 고치고 `[ACT-DOOR]`·`[ACT-PATH]` 의 해당 부분을 걷어 내도 된다.

## ⑤ 디자인 담당에게 넘긴 것 (거친 임시 모양)
- 물동이: 원통 하나(갈색 0x8a5a33 · 물 0x6ec6f0 · 64△ · 묶음 1). 손잡이·테·크기.
- 앉은 몸: 몸 전체를 0.42 내리기만 했다. 앉은 자세 모델이 생기면 `actBesideDraw` 의 `drop` 자리에.
- 서는 자리 수치 `VRULES.beside.inset` — 모델 크기가 바뀌면 같이.

## ⑥ 다음 (보스가 정한 순서) — 09-20 저녁 기준
ACT-PATH ✔ → 광장·정자 ✔(#527) → 돌아서는 사람 ✔(#505) → 새 이웃 인사 ✔(#511) → 밤 귀갓길 ✔(#518 · 창조자의 눈 3회 🟢1) → 밤길과 가로등 ✔(#521) → 이웃 마을 아이 ✔(#525) → 아이 ✔(#529) → 끊긴 길 멈칫 ✔(#532 열림) → 우산 ✔(#530 열림) → **가게 앞 쓰레기 = 제안 한 장만**([`docs/village_act_litter_proposal.md`](../village_act_litter_proposal.md) · 보스 판단 대기 — 구현 안 함).
- 남은 판단 거리(보스): ⓐ '이사는 낮에만'(#505 본문 — 추천: 그대로) ⓑ 밤 귀갓길이 외길 마을의 붐빔 수치를 조금 올린다(#518 본문 — `crowdTick` 이 밤 귀갓길을 빼고 셀지는 프로그램 담당) ⓒ 쓰레기 제안의 네 질문.

## ⑦ 도구 함정 (다음 맥북 세션이 다시 밟을 것)
- 8765 포트는 다른 세션 서버가 쓴다 — 이 세션은 `.claude/launch.json`(커밋 안 함)으로 8791.
- `__setHour(h)` 는 **같은 날 안에서** 시각을 옮긴다 → 뒤로 가면 주민의 `until` 이 전부 미래가 돼 다들 멈춘다(고장 아님). 앞으로만 가거나 `__setTime(ms)` 로 다음 날을.
- `window.__act` 는 이미 있는 훅이다(덮어쓰지 말 것). 디버그 사본엔 `__dbg` 같은 이름을.
- 확대: `__view(16~30)`(숫자가 클수록 가까이). 카메라를 어떤 칸에 맞추려면 `__pan(100,0)`·`__pan(0,100)` 으로 기저를 재서 푼다(화면 px ≠ 세계 좌표).
- 같은 저장본 전/후: 고치기 전 판을 `git show <base>:village/index.html > village/_before.html`(커밋 안 함)로 두고, `__importText` → 다시 열기. 저장본의 `clock.speed` 가 0 이면 멈춘 채 열린다 → 1 로.
- 밤 붐빔 지표(귀가 수·길찾기 호출)는 **돌릴 때마다 ±20% 흔들린다** — 한 번 재고 결론 내지 말 것(세 번 이상).


---

# 2부 (09-20 오후~저녁) — 일감 3~5 · 창조자의 눈 2·3회에서 더해진 것

## ⑧ 찾은 것 (원인까지 확인)
7. **둘째 밤부터 주민 절반이 새벽까지 밖**(창조자의 눈 3회 🟢1) — 4번(C)과 같은 뿌리. 밤 8시에 온 마을이 한꺼번에 집으로 가면 '남을 피한 길'이 안 잡혀 낮처럼 아무 데나 간다. 밤이 갈수록 나빠진다(32명: 새벽 4시 밖 6 → 2 → 11 → 18). '막힌 칸까지 넣어 집으로'는 외길에서 서로 안 비켜 더 나빠진다 → **밤에 집으로 가는 걸음만 칸을 잡지 않게**(#518). 길찾기 호출도 절반이 됐다.
8. **아침 6시 문 앞 칸에 그 집 식구가 서 있다** — 인사하러 온 옆집 사람이 세 시간 동안 못 닿았다(#511 첫 시도 0/1). '바로 옆 칸이면 닿은 것'으로 넓혀 해결 — 덕분에 마주 보는 장면이 됐다.
9. **저녁에 긴의자·놀이터에 든 사람은 2시간 넘게 머문다**(`STAY_MAX` 20초 = 2.7 시간) — 아이를 19시에 부르면 절반이 20시 전에 못 온다 → 아이는 18시에 부르고, 들어가 있던 곳에서도 일어나게(#529).
10. **걷다가 막혀 멈추면 원래 걷기 규칙이 목표를 버린다**(`WAIT_LIMIT` → idle) — 내 연기 블록이 목표를 따로 들고 있지 않으면 사람이 딴 데로 샌다. 물동이(#492)·아이 귀가(#529)는 멈춘 뒤 다시 길을 잡게 했다. 새 연기 블록을 쓸 때 늘 확인할 것.
11. **우산 갓 높이 4.3 은 사람 모델 키(2.21)의 두 배** — 모델에서 재어 맞췄다(#530).

## ⑨ 월요일 학교 세션에게 (1부 ④에 더해)
5. 고리 순서(위 ② 표 아래)를 지키면 3-way 가 쉽다. 특히 **루프 그리기의 PLAZA → BESIDE → KID → UMB 순서**가 바뀌면 아이가 어른 크기로 그려지거나 우산이 엉뚱한 자리에 뜬다.
6. **크롬북 실기에서 볼 것(더함)**: ⓓ 아이(⅔ 키)가 기본 확대에서 '아이'로 읽히는가 ⓔ 밤에 좁은 길에서 두 사람이 겹쳐 지나가는 게 거슬리는가(#518) ⓕ 축제 날 광장이 차 보이는가 ⓖ 비 오는 날 우산.
7. 아이들 반응 가설(적어 달라): "놀이터를 2층 집 가까이 놓았더니 오후에 작은 사람이 모인다" · "가로등을 놓았더니 밤에 뛰던 사람이 걷는다" · "길을 이었더니 끝에 서 있던 사람이 안 나타난다".

## ⑩ 디자인 담당에게 넘긴 것(더함)
- 종종걸음의 모양(잰 발걸음·움츠린 몸) · 가로등 빛 웅덩이(#521).
- 아이 몸(머리 비율·가방) — 지금은 어른을 ⅔ 로 줄였을 뿐(#525).
- 👋 풍선 그림(그림문자 대신 마을 색으로 · #511).
- 우산 갓·손잡이 · 접힌 우산(#530).
- '닳은 풀' — `__gap().곳` 이 끊긴 빈칸 위치를 준다(#532).

## ⑪ 도구 함정(더함)
- 두 PR 이 **같은 줄 바로 아래**에 고리를 넣으면 git 이 충돌로 본다(#521 과 #525 가 `if (!rec) continue;` 아래에서 부딪쳤다). 새 고리는 다른 PR 이 안 쓰는 이웃 줄에 — 올리기 전에 열린 PR 들을 로컬에서 한꺼번에 합쳐 본다(`git merge` 여러 번 → `node --check`).
- 새 블록이 다른 블록의 `VRULES.*` 표를 읽거나 고칠 때, 그 표가 **파일에서 더 아래**에 있으면 모듈이 읽히는 순간엔 아직 없다(#527 의 정자 등록) — 첫 틱에 한 번 하게.
- `typeof isSmall === 'function'` 처럼 다른 블록의 `const` 함수를 부르는 건 **그리기·틱 안에서만**(모듈 읽는 도중엔 TDZ).

---

# 3부 (09-20 밤) — 말 · 겹침 · 정원 · 쓰레기

## ⑫ PR (전부 base `feat/village-45`)
| PR | 무엇 | 상태 | 스위치 · 훅 |
|---|---|---|---|
| [#530](https://github.com/chang333787-boop/class-rpg/pull/530) ACT-UMB | 우산은 든 사람 머리 위(4.3 → 2.56) · 손잡이 · 아이 높이 | 머지됨 | `VRULES.umbrella` · `__umbrella()` |
| [#532](https://github.com/chang333787-boop/class-rpg/pull/532) ACT-GAP | 끊긴 길 끝에서 멈칫, 건너편을 본다 | 머지됨 | `VRULES.gapLook` · `__gap()` |
| [#537](https://github.com/chang333787-boop/class-rpg/pull/537) ACT-WORDS | 학교에 배우러 · 도서관에 책 읽으러 · 박물관 구경 | 머지됨 | `VRULES.words` |
| [#540](https://github.com/chang333787-boop/class-rpg/pull/540) ACT-PASS | 한 칸을 같이 지나는 둘은 어깨를 스치듯 비켜 그린다(pop88 겹친 쌍 밤 629→182) | 머지됨 | `VRULES.passBy` · `__passBy()` |
| [#546](https://github.com/chang333787-boop/class-rpg/pull/546) ACT-GARDEN | 정원(길에 닿은 문 + 닫힌 땅)에 저녁마다 이웃이 들어와 자갈길 한 바퀴 · 의자에 앉았다 나온다 | 머지됨 | `VRULES.gardenVisit` · `__garden()` |
| [#554](https://github.com/chang333787-boop/class-rpg/pull/554) ACT-LITTER | 가게 앞 쓰레기 — 가게 단위·하루 한 번 · 두리번 🗑️? · 통을 놓는 순간 🗑️✓ + 한 단계 | 머지됨 | `VRULES.litter` · `__litter()` |
| [#556](https://github.com/chang333787-boop/class-rpg/pull/556) ACT-GATESAY | 정원 문을 누르면 '왜 아무도 안 오나' 한 줄(열린 칸 반짝) | 머지됨 | `VRULES.gateSay` · `__gateSay(x,y)` |
| [#559](https://github.com/chang333787-boop/class-rpg/pull/559) ACT-LITTER 후속 | 조각을 길 청크 기하에(draw call +0) · 1단계 문턱 6 → 5 | 열림 | 〃 |
| (이 PR) | worklog 3부 | 열림 | 문서 |

## ⑬ 고친 줄 지도(더함)
| 표식 | 새 블록 위치 | 고리 |
|---|---|---|
| `[ACT-WORDS]` | `function whatDoing(f) {` 바로 위 | `whatDoing` 안 ACT-BESIDE 고리 **바로 아래** |
| `[ACT-PASS]` | `/* 사람 그리기 — …` 주석 바로 위 | 루프 `actKidDraw(…)` **바로 아래** · `[ACT-UMB]` 안에 한 줄(비켜 선 사람의 우산) |
| `[ACT-GARDEN]` | `[ACT-DOOR]` 배너 바로 위(ACT-GAP 아래) | `tickFolks` 의 ACT-LOOK 고리 **바로 아래** · `whatDoing` 의 `if (f.arriving) …` **바로 위** |
| `[ACT-GATESAY]` | `[ACT-DOOR]` 배너 바로 위(ACT-GARDEN 아래) | `act()` 의 `if (rec && rec.k === 'sign') …` **바로 아래** |
| `[ACT-LITTER]` | `function syncFolks() {` 바로 위(ACT-UMB 아래) | `tickFolks` 의 ACT-LAMP 고리 **바로 아래** · 루프 `actGreetDraw(…)` **바로 아래** · (#559) `buildChunk` 의 `for (const name in MAT) {` **바로 위** |
- **`buildChunk` 에 남의 함수 안 고리가 처음 생긴다(#559).** 청크 기하 합치기는 디자인·프로그램 담당이 자주 만지는 곳 — 3-way 때 이 한 줄의 자리(메시 만들기 루프 바로 앞)만 지키면 된다.
- 그리기 순서(루프): PLAZA → BESIDE → KID → **PASS** → UMB → (drawClock) → GREET → **LITTER**.

## ⑭ 찾은 것(더함)
12. **밤 겹침은 밤만의 일이 아니었다** — 큰길(한 칸 둘)·가로등 아래 멈춤·줄 선 사람. 낮에 겹친 쌍이 밤의 네 배(2,440). #540 이 같이 풀었다.
13. **한 바퀴는 짧아야** — 하루가 3분이라 한 칸 걷기가 시뮬 15분 남짓. 정원 한 바퀴(자갈 여섯 · 느린 걸음)가 3시간을 넘어 8시 전에 의자까지 못 갔다 → 자갈 넷 · 16:30 부터.
14. **큰 마을은 손님이 흩어진다** — pop167(184명)은 가게 하나 하루 손님 1~5, pop88(100명)은 4~11. 절대 문턱 하나로 두 판을 맞추면 5 가 '절반쯤'. 2단계(12)는 어느 판에서도 안 나온다.
15. 판 전체(65,536칸)를 훑는 것이 둘 생겼다(정원 찾기 · 가게 찾기) — 하루 한 번 · 놓을 때 2초에 한 번. 문·가게 목록을 따로 들면 없앨 수 있다(급하지 않음).

## ⑮ 다음
- 축제 다음 날 광장(쓰레기 둘째 PR · 보스 답 ④) — #559 머지 뒤 새 브랜치(같은 청크 합치기를 쓴다).
- 월요일 학교 세션: 1부 ④·2부 ⑨ 그대로 + **정원 하나를 만들어 저녁에 누가 오는지 · 문을 눌러 까닭이 읽히는지** 아이 반응을 적어 달라.
