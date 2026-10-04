# 학생 기록 동시 저장 합치기 설계 (SYNC-MERGE-2 · 묶음 3 g3)

> 골드·EXP·보상 유실을 **DB 층(gamedata.js) 안에서** 막는다. 데이터 모양은 그대로(마이그레이션 없음),
> 호출부(student.js `DB.saveStudent(CUR)` 35곳 · admin.js `DB.saveStudent` 21곳 + #1160 의 `saveStudentAwait` 6곳)는 고치지 않는다.
> 옛 시도: PR #288(SYNC-MERGE-1, 에코 표시·스냅샷 미루기 일부). 학생 기기 M1 은 #342(STUDENT-GOLDDAILY-COLD-1)로 이미 처리.

## 1. 문제 (지금 main)

| # | 어디 | 무엇이 사라지나 | 왜 |
|---|---|---|---|
| M1 | 학생 화면 `CUR.gold += g → DB.logGold() / saveQuestLog() → DB.saveStudent(CUR)` | 방금 번 골드 | SDK 가 이 기기의 set/update **안에서** value 콜백을 동기로 부른다 → 캐시가 새 객체로 바뀌고 `CUR = fresh`(옛 값) → 이어진 통째 저장이 옛 값을 쓴다. 학생 판은 goldDaily 를 안 들어 logGold 에선 안 뜨지만 questLogs 등 듣는 노드에 쓰면 똑같다(감정 보상·공부 보상) |
| M1′ | `grantStudyReward`(오늘의 공부 보상, 자동 지급) — `CUR.exp/gold += … → logGold → saveQuestLog → CUR.studyRewards[오늘] = … → saveStudent(CUR)` | 공부 보상 EXP·골드 전부, 첫 보상이면 **TypeError**로 함수가 멈춤 | M1 과 같은 부류(기록 쓰기 → 동기 value 이벤트 → CUR 되돌림). saveQuestLog 의 이벤트가 CUR 을 서버 값(보상 전, `studyRewards` 없음)으로 바꿔 `CUR.studyRewards[오늘]` 에서 TypeError. 학생 판·root 판 둘 다(검토자 재현 → real-sdk `study` 케이스로 main 에서 BROKEN·EXP 500/550 확인). `_saving` 창이 닫혀 있을 때 난다. 같은 모양: `claimEmotionReward`, save-order-check 가 적는 11곳 |
| M2 | `saveStudent` = `students/<id>` **통째 set** | 그사이 다른 기기가 바꾼 모든 칸 | 마지막 저장이 이긴다. 교사 승인(+골드) ↔ 학생 전투·수확 저장, 같은 학생 두 탭, 교사 학생 상세 저장 |
| R2 | `_saving` 창(저장 뒤 0.5초) 동안 들어온 스냅샷을 settings 말고 **버림** | 교사 승인이 학생 화면에 안 보임 → 다음 통째 저장이 승인 전 값으로 덮음 | 학생이 0.4초마다 저장하면 창이 계속 열려 영영 못 받는다(sim R2: 10초 안에 안 보임) |
| P | `pendingRewards` 배열 통째 set — `DB.addPendingReward`, 키오스크 신청·취소(kiosk.js 2곳), 수채화 작품 제출 | 막 넣은 신청이 사라지거나, 교사가 승인해 뺀 보상이 **되살아나 두 번 지급** | 각 기기가 자기 캐시의 배열로 전체를 덮는다 |
| D | 관리 화면 학생 상세 창(`openStudentDetail` → `saveStudentDetail`) | 창을 연 뒤 학생이 번 골드·EXP | 열 때 값으로 칸을 채우고 저장 때 **모든 칸**을 그 값으로 되쓴다 |

운영 기록: 2명 5,293G 유실(docs/worklog/2026-09-15-boss-day.md:26). sim 기준 main: M1 10 · A 63 · B 30 · C 66 · D 122 · E 14G, 무작위 200판 모두 유실 22,930G.

## 2. 방식

### 2-1 기준(base)과 출신(origin)
- `DB._stuBase[id]` = 이 기기가 **서버에서 마지막으로 본** 그 학생 값(정규화·마이그레이션 뒤, 내 쓰기 포함). 깊은 복사본이라 화면 코드가 못 건드린다.
- `DB._stuOrigin` (WeakMap: 학생 객체 → 그 객체가 맞춰져 있는 서버 값). 캐시가 내준 객체(`DB.getStudent` → `CUR`·관리 화면 `s`)마다 붙는다.
- **안 보낸 고침** = 객체 − 출신. 저장할 때도, 새 스냅샷을 받을 때도 이 차이만 다룬다.
- 출신이 없는 객체(로그인 때 `JSON.parse(JSON.stringify())` 한 `CUR`)는 기준을 출신으로 본다. 단 onDataChange 콜백 안에서는 **이번 판 전 기준**(`_stuBaseCb`)을 쓴다 — 콜백 첫머리 `decoFlush('스냅샷')` 이 아직 안 바뀐 깊은 복사 `CUR` 을 저장할 때 방금 온 교사 골드를 되돌리지 않게.

### 2-2 저장 = 바뀐 칸만 (`saveStudent`)
`_stuDiff(출신, 객체)` → 일감 세 갈래:
- **셈 칸**(`gold`·`totalGold`·`exp`): 차이를 `ServerValue.increment(차이)` 로. 두 기기가 동시에 더해도 둘 다 남는다.
- **pendingRewards**: id 로 더한 것/뺀 것/바뀐 것을 `students/<id>/pendingRewards` **transaction** 으로 서버의 지금 목록 위에 합친다(배열 그대로). id 없는 옛 보상은 내용 전체를 열쇠로.
- **그 밖의 칸**: 바뀐 칸만 `students/<id>` `update()` 로 칸 통째(칸 단위 마지막 저장 승). 안 바뀐 칸은 아예 안 보낸다.
- 레벨: 경험치를 더하기로 보내면, 이 기기가 레벨을 경험치로 맞춰 쓰고 있을 때(레벨 = levelFromExp(경험치)) **합친 경험치**로 레벨을 다시 맞춰 같이 보낸다(두 곳이 동시에 경험치를 더해 문턱을 넘는 경우).
- 처음 보는 학생(교사가 새로 만든 학생)·`students/<id>` 키에 진짜 기록이 없는 학생(옛 배열 숫자 키만 있음)은 **지금처럼 통째 set** — 껍데기 노드를 만들지 않는다.
- 저장한 객체는 "서버 최신 + 내 고침"으로 제자리 갱신하고, 그것을 새 출신·기준으로 적는다.
- `_saving` 창은 학생 저장에서 더는 열지 않는다(학생 기록은 아래 2-3 으로 합치므로 창이 필요 없다).
- **돌려주는 값**: 이번 저장의 쓰기(update·transaction 여럿일 수 있음)가 **모두** 끝나면 풀리는 약속 하나(바뀐 게 없으면 바로 풀림). 실패는 `_onSaveError` 로도 알린다.
  관리 화면 `saveStudentAwait`(#1160 APPROVE-AWAIT-1)는 약속이 오면 그것을 쓰고, 안 오면 `students/<id>` 의 첫 set/update 만 옆에서 잡았다 — 승인 쓰기가 update + 보상 transaction 둘이 되므로 약속으로 둘 다 기다리게 했다.

### 2-3 받기 = 합치기 (스냅샷 처리)
- **미루기·묶기**: value 콜백은 일감만 적고 마이크로태스크에서 **마지막 스냅샷 하나**만 처리한다. `CUR.gold += g → logGold → saveStudent(CUR)` 같이 한 덩어리로 도는 코드가 끝난 뒤에 캐시가 바뀐다(M1·M1′). SDK 는 내 쓰기를 스냅샷에 겹쳐 보여 주므로 마지막 것이 앞의 것을 다 담는다.
  → 그래서 한 함수 안에서 **기록 쓰기(logGold·logSpend·saveQuestLog)가 saveStudent 보다 앞에 있어도** 더는 CUR 이 중간에 바뀌지 않는다. 호출 순서를 하나하나 바꾸지 않고 DB 층 한 곳에서 부류 전체를 막는다(save-order-check 의 11곳은 기준선 그대로 두고 REVIEW 로 남긴다 — 순서 검사 자체는 새 자리 추가를 막는 데 계속 쓴다).
- **새 객체 + 넘겨받기**: 예전처럼 판마다 학생은 **새 객체**다(화면 코드의 `CUR = fresh` 앞뒤 비교가 그대로 맞는다 — #1161 선생님 승인 레벨업 축하가 `prevLv = CUR.level` 을 읽고 바꾼다).
  옛 객체에 안 보낸 고침이 있으면 새 객체가 **넘겨받는다**(새 서버 값 위에 셈 칸은 차이, 보상은 id, 그 밖은 내 값). 옛 객체는 값을 안 바꾸고 "고침 없음"으로 적고, `_stuNext`(옛 → 새)를 남긴다.
  옛 객체를 나중에 저장하면(스냅샷 콜백 첫머리 `decoFlush('스냅샷')` 이 아직 안 바뀐 CUR 을 저장) **새 객체로 넘겨** 저장한다 — 밀린 뒤 옛 객체에 고친 것만 새 객체에 얹는다. 그래서 고침은 한 번만 나가고(두 번 지급 없음) 사라지지도 않는다.
  (처음엔 같은 객체를 제자리로 바꿨는데, 그러면 콜백이 읽는 `CUR.level` 이 이미 새 값이라 #1161 축하가 안 떴다 — 그래서 바꿨다.)
- 서버 원문이 지난번과 같은 학생은 건너뛴다(원문 JSON 문자열 비교 — 반 전체 학생을 매번 다시 재지 않게).
- **저장 창(`_saving`) 동안에도** 학생 기록·settings 는 바로 반영하고(R2), 나머지 노드는 창이 닫힐 때(`_endSaving`) 그 사이 마지막 판으로 바꾼다(버리지 않는다). 창을 여는 곳: 작품 고치기·설정 저장·비번 초기화 요청(4곳, 그대로).

### 2-4 교사 승인도 같은 원리
`approveReward`(admin.js)는 고치지 않는다. 교사 캐시 객체에 `exp/gold/totalGold` 를 더하고 보상을 빼고 `saveStudent` → 위 2-2 로 `increment` + 보상 id 빼기 transaction + 바뀐 칸(stats·books·totalQuests·level). 학생이 그사이 번 골드·새 신청은 그대로 남는다.

### 2-5 다른 pendingRewards 쓰기
- `DB.addPendingReward` → 그 보상 하나 id 더하기 transaction(+ 출신·기준에 "보냄"으로 적어, 교사 승인 뒤 되살아나지 않게).
- 키오스크 신청 → id 더하기 transaction · 취소 → 그 퀘스트 신청 빼기 transaction(서버 지금 목록 위). 화면 먼저 반영·실패 때 되돌림은 그대로.
- 수채화 작품 제출 → id 더하기 transaction.
- 합치기 규칙은 순수 함수 `DB._prApply(목록, {add, del, put, drop})` 하나(키오스크·수채화도 이걸 부른다 — `_normalizeArrays` 처럼 DB 상태를 안 쓴다).

### 2-6 학생 상세 창 = 바뀐 칸만
`saveStudentDetail` 은 칸마다 **연 때 값(input.defaultValue)과 다를 때만** 쓴다. 골드는 "바꾼 만큼"(지금 값 + (적은 값 − 연 때 값), 0 아래로 안 감)을 더한다. 레벨·EXP 는 둘 중 하나라도 바꿨을 때만 지금 규칙(레벨 기준 맞춤) 그대로. 칭호 select 는 처음 고른 항목과 다를 때만.

## 3. 바뀌는 쓰기 경로

| 경로 | 전 | 후 |
|---|---|---|
| `DB.saveStudent(s)` (student.js 35 · admin.js 27 · gamedata 내부) | `students/<id>` 통째 `set` + `_saving` 0.5초 · 돌려주는 값 없음 | 바뀐 칸만 `students/<id>` `update`(셈 칸은 `increment`) + 보상은 `students/<id>/pendingRewards` `transaction`. 바뀐 게 없으면 쓰기 0. 새 학생·숫자 키 학생만 통째 `set` · 쓰기 전부의 약속을 돌려줌 |
| `DB.addPendingReward` | `students/<id>/pendingRewards` 배열 통째 `set` | 같은 경로 `transaction`(id 더하기) |
| kiosk.js `requestQuest` · `cancelQuest` | 같은 경로 배열 통째 `set` | 같은 경로 `transaction`(id 더하기 · 그 퀘스트 빼기) |
| watercolor/index.html `rpgSubmitArtwork` | 같은 경로 배열 통째 `set` | 같은 경로 `transaction`(id 더하기) |
| admin.js `saveStudentDetail` | 모든 칸을 연 때 값으로 | 바뀐 칸만, 골드는 차이 |
| value 리스너(`DB.init` · 학생 판 노드 구독) | 동기 처리 · `_saving` 중이면 settings 말고 버림 · 캐시 통째 교체 | 마이크로태스크로 미뤄 마지막 판만 · 학생은 새 객체 + 안 보낸 고침 넘겨받기 · `_saving` 중 나머지는 창 닫힐 때 |

## 4. 안 바뀌는 것
- 데이터 모양: `students/<id>` 칸 이름·모양, `pendingRewards` **배열**(객체맵 전환 없음), 숫자 키·id 키 공존 규칙(DUP-STUDENT-1), root 구조. 마이그레이션·운영 데이터 정리 없음.
- 호출부: student.js 는 한 줄도 안 바뀐다. admin.js 는 상세 창 한 함수만.
- `_normalizeArrays` · `_migrate` 는 그대로 순수 함수(키오스크가 빌려 씀).
- 학생 기기 부분 캐시(STUDENT-COLD-1: 노드별 구독·`attachMine`·G1 root 저장 금지), 로컬 폴백(root 판), 키오스크 자체 구독, 수채화 손님 모드.
- 경제 수치(가격·보상·확률), `logGold`·`logSpend` 기록 방식, DECO-LIFE 잎 쓰기.

## 5. 남는 한계 (정직하게)
- 셈 칸·보상 말고는 **칸 단위 마지막 저장 승**이다. 같은 칸을 두 기기가 같은 순간에 바꾸면 한쪽이 진다(예: 두 탭이 같은 순간 서로 다른 장식을 놓음 → `houseDecorations` 한쪽). 전에는 학생 기록 **전체**에서 그랬다.
- 셈 칸을 더하기로 바꿨기 때문에, **같은 학생이 두 기기에서 같은 낡은 화면으로 같은 일을 1초 안에** 하면 두 번 들어갈 수 있다(예: 두 탭이 같은 밭을 동시에 수확 → 골드 두 번, 교사 두 기기가 같은 보상을 동시에 승인 → 두 번). 전에는 한쪽이 통째로 사라졌다(유실). 스냅샷을 받으면 곧바로 화면이 맞춰지므로 창은 왕복 시간(0.1~0.5초)이다.
- 같은 이유로 두 탭이 같은 순간 서로 다른 물건을 사면 골드는 둘 다 빠지고 `inventory` 는 한쪽만 남을 수 있다(인벤토리는 칸 단위).
- 교사 승인은 `update`(골드) 와 `transaction`(보상 빼기) 두 번의 쓰기다. 둘 중 하나만 실패하면(권한 오류 등) `onDbSaveError` 훅으로 알린다. 같은 기기 안에서 보상 transaction 을 깨는 통째 set 은 새 학생·root 복원뿐이다.
- 이 배포 전에 열려 있던 탭(옛 JS)은 새로고침 전까지 통째 set 을 한다 — 캐시버스터는 새로 연 탭부터 먹는다.
- `logSpend` 는 여전히 학생 판(`_snaps`)에서만 쓴다(GOLD-SPEND-2 의 막음은 이 PR 이 root 판 에코를 막았으니 풀어도 되지만, 기록 범위가 바뀌는 일이라 따로).

## 6. 확인
- `node scripts/unit/gold-sync-sim.mjs --expect-fixed` — 실제 gamedata.js·admin.js(승인·상세 창·골드 지급)·kiosk.js(신청) 를 vm 에 올리고 가짜 RTDB 로 여러 기기. 가짜 서버의 transaction 은 실제 SDK 처럼 **서버에 닿을 때 서버 값으로 다시 계산**한다.
  더한 시나리오: F1·F2(상세 창) · K1~K3(키오스크) · P1(학생 보상 신청) · M3·M4(꾸미기 묶음 저장 대기 중 깊은 복사 CUR + 교사 골드 지급·승인) · L1(꾸미기 저장 대기 중 레벨 오르는 승인 → 콜백이 레벨 오름을 한 번 봄, #1161). `GOLD_SIM_ROOT=<옛 체크아웃>` 으로 수정 전 코드에 같은 시험.
- `node scripts/unit/gold-loss-real-sdk/run.mjs --profile=both --expect-fixed` — 실제 student.html + firebase SDK 9.23(가짜 프로젝트·오프라인). 맥에서는 `BROWSER=<크롬 헤드리스>`. `study` 케이스 = 실제 `grantStudyReward`(M1′). `Q1_REPO=<옛 체크아웃>` 으로 수정 전.
- `node scripts/unit/run.mjs` 의 'gamedata 학생 기록 합치기(SYNC-MERGE-2)' — `_prApply`·`_stuDiff`·`_stuApply`·saveStudent 쓰기 모양·받은 판 새 객체 넘겨받기·밀린 옛 객체 저장(순수 셈).
- 꾸미기 하네스(`deco-save-count`)는 구매 쓰기 1번을 set·update 로 센다(옛 판 set 1 · 지금 판 update 1).
- promo-sync-sim · deco-life-sync-sim · settings-field-sim · deco-save-real-sdk · precheck.

## 7. 되돌리는 법
- 이 PR 의 커밋을 `git revert` → 통째 set 으로 돌아간다. 데이터 모양을 안 바꿨으므로 **운영 데이터 정리는 필요 없다**(이 판이 쓴 `update`·`transaction` 결과는 통째 set 이 쓰던 것과 같은 모양).
- 되돌릴 때 gamedata.js 를 부르는 네 html(student·admin·kiosk·watercolor)과 admin.js·kiosk.js 버스터를 다시 올린다.
- 부분만 끄고 싶으면: `saveStudent` 의 통째 set 갈래 조건(`!origin || …`)을 늘 참으로 — 예전처럼 통째 `set` 만 한다(받을 때 합치기·보상 transaction 은 그대로 둬도 안전).
