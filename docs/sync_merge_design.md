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

### 2-4 교사 승인 = `students/<id>` transaction 하나 (APPROVE-ATOMIC-1 · 검토 #2)
`approveReward`(admin.js)가 교사 캐시 객체에 `exp/gold/totalGold` 를 더하고 보상을 빼고 stats·books·totalQuests·level 을 바꾸는 것은 그대로다.
승인 네 곳(`approveSingle`·`approveAll`·`gridApprove`·`approveArtwork`, `approveAllByQuest` 는 approveSingle)이 **보상 하나마다** `approveAndSave(s, 보상)` →
`saveStudent(s, { atomic: true })` 로 저장하면
`_stuSendAtomic` 이 2-2 와 같은 일감(셈 칸 차이 · 바뀐 칸 · 보상 id 빼기)을 **`students/<id>` transaction 하나**로 서버의 그때 값 위에 얹는다(레벨은 합친 EXP 로 다시).
- **빼려는 보상이 서버에 모두 있을 때만** 바꾼다. 이미 없으면(다른 탭·다른 기기가 먼저 승인 · 학생이 취소) 아무것도 안 바꾸고 `code 'REWARD_GONE'` → 관리 화면이 "이미 다른 곳에서 처리된 보상이에요 — 한 번만 지급했어요". 같은 보상을 두 번 주지 않는다(검토 D2: 전 1100 → 후 1050).
- **[전체 승인]도 보상마다 한 쓰기**다(2차 검토 #1). 처음엔 학생 한 명의 보상을 한 쓰기로 묶어 '모두 있어야' 바꿨는데, 그중 하나가 사라지면(키오스크 취소·다른 교사 기기) **같은 학생의 다른 보상까지** 안 들어갔고,
  기록은 남아 다시 승인하면 A1 중복 막이가 0G 로 지웠다 — 검토 Y8(키오스크 청소 취소 ↔ 전체 승인, 기대 1030): **1000**(실제 SDK 도 1000) → 지금 **1030**, Y9(교사 두 기기, 기대 1050): **1020** → **1050**.
  한 학생의 보상이 여럿이면 쓰기도 여럿이다(SDK 가 같은 자리 transaction 을 차례로 보낸다 · 크기는 보상 수 × 학생 기록).
- **기록 쓰기(goldDaily · 작품 전시 · 퀘스트 기록)는 저장이 된 뒤에만** 한다(APPROVE-AFTER-1 · 2차 검토 #3). `approveReward(s, 보상, later)` 가 쓰기를 `later.run` 에 모으고,
  `approveAndSave` 가 학생 저장이 풀린 뒤 돌린다. 'REWARD_GONE'·실패면 안 돌린다 — 검토 Y2(교사 두 기기 같은 작품): 작품 2 · 기록 2 · goldDaily 40 → **1 · 1 · 20**,
  Y3(학생이 취소하는 순간 승인): 골드 0 인데 작품 전시 1 · 기록 1 · goldDaily 20 → **0 · 0 · 0**. 작품 승인의 "전시 완료!"도 저장 결과를 본 뒤 띄운다("이미 처리"·"실패"면 그 말로).
  같은 묶음 안의 A1 중복 막이는 아직 안 보낸 기록(`later.logs`)도 함께 본다.
- 하나라서 반만 들어가는 일이 없다(검토 F2: 전 = update 만 거부되면 보상은 빠지고 골드 그대로 → 후 = 거부되면 둘 다 그대로).
- 끊김(`disconnect`)·`set` 이면 같은 일감으로 다시(2-5). 끊긴 뒤 다시 돌렸더니 보상이 이미 없으면 = 거의 늘 내 첫 쓰기가 들어간 것 → 승인 끝으로 본다.
  끊김은 **한 번이라도** 있었는지 기억한다(검토 Y6: 끊김 → 'set' 으로 또 다시 → 마지막 이유만 보면 '이미 처리'로 잘못 알렸다).
- 학생 기록 전체를 보내는 쓰기다(예전 통째 set 과 같은 크기) — 그래서 승인에만 쓴다. 학생이 아주 잦게 저장해 서버 값이 계속 바뀌면 SDK 는 통째 기록을 25번까지 다시 보낸다
  (2차 검토 실측 391KB · 3.5초). 그래서 일감이 **`ATOMIC_RUNS`(4)번을 넘게 불리면** 그만두고(들어가지 않았을 때만) `_stuSendGated` 로 보낸다 — SDK `maxretry` 도 같은 길.
  `_stuSendGated` = 작은 보상 transaction 으로 **그 보상을 실제로 뺐을 때만** 골드·EXP 등 update(교사 두 기기와 겹쳐도 한 번 — 검토 Y4: 전 1100 → 1050). 두 쓰기라 둘 사이(왕복 하나)에 update 가 거부되거나 창이 닫히면 보상만 빠진다(§5).
- 반려(`rejectSingle`)는 보상 빼기만이라 2-2 의 보상 transaction 그대로.

### 2-5 다른 pendingRewards 쓰기
- `DB.addPendingReward` → 그 보상 하나 id 더하기 transaction(+ 출신·기준에 "보냄"으로 적어, 교사 승인 뒤 되살아나지 않게).
- 키오스크 신청 → id 더하기 transaction · 취소 → 그 퀘스트 신청 빼기 transaction(서버 지금 목록 위). 화면 먼저 반영·실패 때 되돌림은 그대로.
- 수채화 작품 제출 → id 더하기 transaction.
- 합치기 규칙은 순수 함수 `DB._prApply(목록, {add, del, put, drop})` 하나(`_normalizeArrays` 처럼 DB 상태를 안 쓴다).
- **보상 transaction 은 모두 `DB.prTransaction(ref, 일감)` 하나로 보낸다**(학생 저장 · addPendingReward · 키오스크 신청/취소 · 수채화 제출 — TX-RETRY-1 · 검토 #1).
  SDK 9.23 은 보내 놓고 답을 못 받은 transaction 을 연결이 끊기면 `Error('disconnect')` 로 끝내고 **다시 보내지 않는다**(`PersistentConnection.cancelSentTransactions_` — 보낸 put 중 `h`(해시)가 있는 것만).
  보통 쓰기(set·update·increment)는 다시 이어질 때 다시 보낸다(`restoreState_`). 그래서 전에는 승인의 골드(update)만 들어가고 보상 빼기는 취소돼 보상이 되살아나거나(sim X2: 보상 남음),
  서버엔 들어간 신청이 실패로 보여 다시 눌러 신청이 둘이 되거나(X3), 안 들어간 신청이 그냥 사라졌다(X4·X5).
  `_txRetry` 가 `disconnect`·`set` 이면 같은 일감으로 **5번까지** 다시 돌린다. 빼기(승인 · 취소)는 '있을 때만'이라 이미 들어간 것을 다시 돌려도 한 번과 같다.
  **더하기(신청)는 아니다** — 끊긴 사이 다른 기기가 그 신청을 이미 승인해 뺐으면, 다시 돌린 더하기가 그 신청을 **되살린다**(2차 검토 #2 · §5).
  끊긴 동안 시작한 transaction 은 SDK 가 다시 이어질 때 보낸다. 권한 거부·그 밖의 실패는 그대로 실패.

### 2-6 학생 상세 창 = 바뀐 칸만
`saveStudentDetail` 은 칸마다 **연 때 값(input.defaultValue)과 다를 때만** 쓴다. 골드는 "바꾼 만큼"(지금 값 + (적은 값 − 연 때 값), 0 아래로 안 감)을 더한다. 레벨·EXP 는 둘 중 하나라도 바꿨을 때만 지금 규칙(레벨 기준 맞춤) 그대로. 칭호 select 는 처음 고른 항목과 다를 때만.

### 2-7 ⚠️ CUR 별칭 규칙 (검토 #7)
받은 판마다 학생은 새 객체라(2-3) **자기 저장 뒤에도 곧(마이크로태스크) CUR 이 새 객체로 바뀐다.** 그래서
`const s = CUR` 로 잡아 두고 `await`·`setTimeout`·`.then`·`onload` 를 건넌 뒤 `s` 를 고치면, 그 고침은 `saveStudent(CUR)`(새 객체)로는 **안 나간다**
(검토자가 실제 SDK 로 재현: `O = CUR; CUR.gold += 1; save; await 0; O.gold += 7; save(CUR)` → +7 사라짐). 옛 객체를 `saveStudent(옛 객체)` 로 저장하면 `_stuNext` 로 넘겨지긴 한다.
- **규칙: 비동기 경계 뒤에는 CUR 을 다시 읽어 고칠 것. 별칭은 경계 앞에서만.** `prev = CUR; CUR = 친구; … CUR = prev` 되돌리기도 경계 앞에서.
- 지금 학생 코드(student.js + student/*.js 9파일)의 별칭 11곳은 모두 경계 앞에서만 쓴다(그리기 함수 · 친구 마당 그리기).
- 검사: `scripts/unit/cur-alias-check.mjs`(precheck 'cur-alias', 기준선 0 — 새로 생기면 FAIL). 줄 단위 글자 검사라 인자로 넘긴 CUR·안쪽 함수 범위는 못 가린다.

## 3. 바뀌는 쓰기 경로

| 경로 | 전 | 후 |
|---|---|---|
| `DB.saveStudent(s)` (student.js 35 · admin.js 27 · gamedata 내부) | `students/<id>` 통째 `set` + `_saving` 0.5초 · 돌려주는 값 없음 | 바뀐 칸만 `students/<id>` `update`(셈 칸은 `increment`) + 보상은 `students/<id>/pendingRewards` `transaction`. 바뀐 게 없으면 쓰기 0. 새 학생·숫자 키 학생만 통째 `set` · 쓰기 전부의 약속을 돌려줌 |
| 교사 승인(`approveSingle`·`approveAll`·`gridApprove`·`approveArtwork`) | `students/<id>` 통째 `set` · 기록 쓰기 먼저 | 보상마다 `students/<id>` `transaction` 하나(보상이 있을 때만 · 4번 넘게 낡거나 `maxretry` 면 보상 transaction → 뺐을 때만 update) · 기록 쓰기는 저장 뒤 |
| `DB.addPendingReward` | `students/<id>/pendingRewards` 배열 통째 `set` | 같은 경로 `transaction`(id 더하기 · 끊기면 다시) |
| kiosk.js `requestQuest` · `cancelQuest` | 같은 경로 배열 통째 `set` | 같은 경로 `transaction`(id 더하기 · 그 퀘스트 빼기 · 끊기면 다시) |
| watercolor/index.html `rpgSubmitArtwork` | 같은 경로 배열 통째 `set` | 같은 경로 `transaction`(id 더하기 · 끊기면 다시) |
| admin.js `saveStudentDetail` | 모든 칸을 연 때 값으로 | 바뀐 칸만, 골드는 차이 |
| value 리스너(`DB.init` · 학생 판 노드 구독) | 동기 처리 · `_saving` 중이면 settings 말고 버림 · 캐시 통째 교체 | 마이크로태스크로 미뤄 마지막 판만 · 학생은 새 객체 + 안 보낸 고침 넘겨받기 · `_saving` 중 나머지는 창 닫힐 때 |

## 4. 안 바뀌는 것
- 데이터 모양: `students/<id>` 칸 이름·모양, `pendingRewards` **배열**(객체맵 전환 없음), 숫자 키·id 키 공존 규칙(DUP-STUDENT-1), root 구조. 마이그레이션·운영 데이터 정리 없음.
- 호출부: student.js(+student/*.js) 는 한 줄도 안 바뀐다. admin.js 는 상세 창 · 승인 네 곳(보상마다 `approveAndSave` · 기록 쓰기를 저장 뒤로 · '이미 처리' 알림)만.
- `_normalizeArrays` · `_migrate` 는 그대로 순수 함수(키오스크가 빌려 씀).
- 학생 기기 부분 캐시(STUDENT-COLD-1: 노드별 구독·`attachMine`·G1 root 저장 금지), 로컬 폴백(root 판), 키오스크 자체 구독, 수채화 손님 모드.
- 경제 수치(가격·보상·확률), `logGold`·`logSpend` 기록 방식, DECO-LIFE 잎 쓰기.

## 5. 남는 한계 (정직하게)
- 셈 칸·보상 말고는 **칸 단위 마지막 저장 승**이다. 같은 칸을 두 기기가 같은 순간에 바꾸면 한쪽이 진다(예: 두 탭이 같은 순간 서로 다른 장식을 놓음 → `houseDecorations` 한쪽). 전에는 학생 기록 **전체**에서 그랬다.
- 셈 칸을 더하기로 바꿨기 때문에, **같은 학생이 두 기기에서 같은 낡은 화면으로 같은 일을 1초 안에** 하면 두 번 들어갈 수 있다 — 검토 D3: 두 탭이 같은 다 자란 작물을 0.02초 차이로 수확(40G) → **1080(기대 1040, +40)**. 전에는 한쪽이 통째로 사라졌다(유실). 스냅샷을 받으면 곧바로 화면이 맞춰지므로 창은 왕복 시간(0.1~0.5초)이다. **감수**(보스 결정).
  교사 두 기기가 같은 보상을 동시에 승인하는 것(D2)은 2-4 로 막았다(1100 → 1050).
- **골드가 0 아래로 갈 수 있다** — 검토 N1: 학생 100G 로 100G 물건 구매 ↔ 교사 [골드 지급 −80] 같은 순간 → **−80**(전: 0 또는 20 — 한쪽이 사라졌다). 둘 다 자기 화면에선 0 이상을 보고 차이만 보낸다. **감수**(다음 판매·지급에서 다시 0 이상으로 · 화면은 음수 그대로 보임).
- **성능**: 자기 저장마다 받은 판을 한 번 합치고 화면(onDataChange → renderMain)을 한 번 더 그린다(전에는 `_saving` 창이 자기 에코를 버려 안 그렸다). 검토 측정 **+15ms 쯤** —
  다시 잼(헤드리스 크롬 · 큰 반: 학생 기록 54KB · 26명 · 퀘스트 기록 3000 · CPU 4배 느림 · 저장 12번 중앙값): 저장 동기 부분 **22.7 → 4.2ms**(통째 직렬화가 없어 빨라짐),
  콜백까지 **26.8 → 36.9ms(+10ms · 최대 +30ms)**, 꾸미기 창 저장 **25.8 → 38.5ms(+13ms)**. 작은 반(1KB · 느리게 안 함)은 12번에 콜백 합 16~18ms(한 번 ~1.4ms). **감수**(보스 결정).
- 보통 쓰기의 increment 는 SDK 가 다시 이어질 때 다시 보낸다 — 서버엔 들어갔는데 답만 못 받은 그 순간에 끊기면 **두 번 더해질 수 있다**(RTDB 의 성질 · 창은 끊김 순간 한 번의 왕복). 승인은 2-4 로 한 번만이다.
- 끊긴 뒤 다시 돌린 승인이 '보상이 이미 없음'을 보면 승인 끝으로 본다(2-4). 그 몇 초 사이 학생이 신청을 취소했으면 실제로는 골드가 안 들어갔는데 "승인 완료"로 보이고 기록 쓰기도 돈다(드묾 · 두 번 주지는 않음).
- **끊긴 뒤 다시 돌린 신청(더하기)이 승인된 신청을 되살릴 수 있다**(2차 검토 #2). 키오스크·학생 기기·수채화의 신청이 서버엔 들어갔는데 답 전에 끊기고, 다시 이어지기 전에 교사가 그 신청을 승인하면,
  다시 돌린 더하기가 그 신청을 다시 넣는다(id 가 없으니 '새 신청'으로 보임). 교사가 또 승인하면 두 번 지급될 수 있다 — 실제 SDK 실험에서 **1040**(기대 1020, 퀘스트가 아닌 학습 보상).
  퀘스트 신청이면 두 번째 승인은 A1 중복 막이가 0G 로 지운다(sim Y1b 1020). 창 = 끊김 순간 + 다시 이어질 때까지의 몇 초 · 그 사이 교사 승인. 오늘은 문서만(되살림을 막으려면 승인한 보상 id 를 따로 적어 두는 등 데이터 모양이 늘어난다).
- 기록 쓰기를 저장 뒤로 미뤘으므로(2-4), 같은 퀘스트의 **다른** 신청 두 개를 따로따로(묶음이 아닌 단추 두 번) 왕복 한 번 안에 승인하면 A1 중복 막이가 아직 첫 기록을 못 봐 둘 다 지급될 수 있다(전에는 첫 기록이 바로 캐시에 들어가 둘째를 0G 로 지웠다). [전체 승인] 한 번 안에서는 `later.logs` 로 본다.
- 승인 폴백(`_stuSendGated`, 2-4)은 보상 빼기와 골드 update 두 쓰기다 — 둘 사이(왕복 하나)에 update 만 거부되거나 탭이 닫히면 보상만 빠지고 골드가 안 들어간다. 학생이 아주 잦게 저장할 때(4번 넘게 낡음)만 이 길로 간다.
- 같은 이유로 두 탭이 같은 순간 서로 다른 물건을 사면 골드는 둘 다 빠지고 `inventory` 는 한쪽만 남을 수 있다(인벤토리는 칸 단위).
- 이 배포 전에 열려 있던 탭(옛 JS)은 새로고침 전까지 통째 set 을 한다 — 캐시버스터는 새로 연 탭부터 먹는다. 검토 G(학생 0.3초마다 7G · 교사 승인 50G, 기대 1127):
  옛 학생 탭 + 옛/새 교사 = 1064(−63) · 새 학생 + 옛 교사 탭 = 1120(−7) · 새 + 새 = 1127. 아침에 새로 연 탭부터 0.
- `logSpend` 는 여전히 학생 판(`_snaps`)에서만 쓴다(GOLD-SPEND-2 의 막음은 이 PR 이 root 판 에코를 막았으니 풀어도 되지만, 기록 범위가 바뀌는 일이라 따로).

## 6. 확인
- `node scripts/unit/gold-sync-sim.mjs --expect-fixed` — 실제 gamedata.js·admin.js(승인·상세 창·골드 지급)·kiosk.js(신청) 를 vm 에 올리고 가짜 RTDB 로 여러 기기. 가짜 서버의 transaction 은 실제 SDK 처럼 **서버에 닿을 때 서버 값으로 다시 계산**한다.
  더한 시나리오: F1·F2(상세 창) · K1~K3(키오스크) · P1(학생 보상 신청) · M3·M4(꾸미기 묶음 저장 대기 중 깊은 복사 CUR + 교사 골드 지급·승인) · L1(꾸미기 저장 대기 중 레벨 오르는 승인 → 콜백이 레벨 오름을 한 번 봄, #1161). `GOLD_SIM_ROOT=<옛 체크아웃>` 으로 수정 전 코드에 같은 시험.
  끊김·거부(검토 #1·#2): 가짜 서버가 SDK 처럼 transaction 을 먼저 이 기기 값으로 돌려 보고(undefined 면 안 보냄) 서버에서 undefined 면 committed false, `c.inject` 로 끊김(들어감/안 들어감)·거부·maxretry 를 넣는다.
  X1·X2(승인 중 끊김) · X3·X4(키오스크 신청 중 끊김) · X5(학생 작품 신청 중 끊김) · X6(승인 maxretry) · D2(교사 두 기기 같은 보상) · F3(승인 쓰기 거부 → 아무것도 안 바뀜).
  2차 검토: Y8(키오스크 취소 ↔ 전체 승인 → 1030 · 기록 책정리 하나) · Y9(교사 두 기기 하나 승인 ↔ 전체 승인 → 1050) · Y2(같은 작품 두 기기 → 작품·기록·goldDaily 한 번) ·
  Y3(학생 취소 순간 승인 → 작품·기록·goldDaily 0) · Y4(폴백 ↔ 다른 교사 기기 → 1050) · Y6(끊김 → set → 승인 완료). `check(학생, root)` 로 서버의 기록까지 본다.
  가짜 기기의 로컬 겹쳐 보이기는 SDK 처럼 **보낼 때 한 번 낸 결과**를 쓴다(보낸 transaction 일감을 다시 부르지 않는다 — 부르는 횟수를 ATOMIC_RUNS 가 센다).
- `node scripts/unit/gold-loss-real-sdk/run.mjs --profile=both --expect-fixed` — 실제 student.html + firebase SDK 9.23(가짜 프로젝트·오프라인). 맥에서는 `BROWSER=<크롬 헤드리스>`. `study` 케이스 = 실제 `grantStudyReward`(M1′). `Q1_REPO=<옛 체크아웃>` 으로 수정 전.
- `node scripts/unit/run.mjs` 의 'gamedata 학생 기록 합치기(SYNC-MERGE-2)' — `_prApply`·`_stuDiff`·`_stuApply`·saveStudent 쓰기 모양·받은 판 새 객체 넘겨받기·밀린 옛 객체 저장(순수 셈).
- `node scripts/unit/run.mjs` 의 '끊김 다시 돌리기 · 승인 한 쓰기' — disconnect 다시·거부 그대로·5번까지·승인 일감(서버 값 + 더하기 + 그 보상만 빼기 · 없으면 undefined)·REWARD_GONE·끊김 뒤 끝·
  maxretry 폴백(보상 뺀 뒤에만 골드 · 이미 없으면 골드 안 보냄)·일감 ATOMIC_RUNS 번 넘으면 그만·끊김 → set 뒤에도 끝. 'CUR 별칭 검사' — 시험 폴더로 잡힘/안 잡힘.
- `node scripts/unit/cur-alias-check.mjs` — 2-7.
- 꾸미기 하네스(`deco-save-count`)는 구매 쓰기 1번을 set·update 로 센다(옛 판 set 1 · 지금 판 update 1).
- promo-sync-sim · deco-life-sync-sim · settings-field-sim · deco-save-real-sdk · precheck.

## 7. 되돌리는 법
- 이 PR 의 커밋을 `git revert` → 통째 set 으로 돌아간다. 데이터 모양을 안 바꿨으므로 **운영 데이터 정리는 필요 없다**(이 판이 쓴 `update`·`transaction` 결과는 통째 set 이 쓰던 것과 같은 모양).
- 되돌릴 때 gamedata.js 를 부르는 네 html(student·admin·kiosk·watercolor)과 admin.js·kiosk.js 버스터를 다시 올린다.
- 부분만 끄고 싶으면: `saveStudent` 의 통째 set 갈래 조건(`!origin || …`)을 늘 참으로 — 예전처럼 통째 `set` 만 한다(받을 때 합치기·보상 transaction 은 그대로 둬도 안전).
