# 2026-09-14 ~ 09-15 (기기: 학교 Windows) — 마을 저장 운영 준비 · 학생 순서 원인 (리팩토링 조수)

> 담당: 리팩토링 조수(`rf`). 보스 2기 작전 09-15 리팩토링 절 ①~⑤.
> PR 목록과 규칙은 [2026-09-14-village-g5.md](2026-09-14-village-g5.md)(기타 2 색인)에 있다. **이 문서는 그 색인에 없는 근거·함정·데이터 대조**만 담는다.

## ① 09-15 머지된 것

| PR | 무엇 | 캐시버스터 |
|---|---|---|
| #217 | 교사 화면 🏘️ 우리 마을 탭 — REST GET 만 (VILLAGE-ADMIN-1) | admin.js 20260915rfa |
| #222 | `scripts/village-backup.mjs`(읽기만) · `village-restore.mjs`(기본 보여 주기만) · `docs/village-restore.md` (VILLAGE-BACKUP-1) | 없음 |
| #228 | 학생 순서가 바뀌던 원인 — 승급 관리의 제자리 정렬 (STUDENT-ORDER-1) | admin.js 20260915rfb |
| #229 | `docs/village-first-check.md` — #214 머지 직후 운영 첫 확인 절차서 | 없음 |

열려 있음: **#214**(마을 45차 · sync.js 연결) — 규칙 게시 뒤에만.

## ② 되살릴 때 저장 시각을 "지금"으로 바꾸는 이유 (#222)

백업 파일을 **옛 `savedAt` 그대로** 다시 쓰면, 그 학생 기기의 `sync.js` 결정표가 "원격이 더 옛것"으로 보고 `pushDirty` 로 **기기 판을 올려 복원을 덮는다.** 에뮬레이터에서 저장소 `sync.js` 그대로 재현했다.

| 되살리는 방법 | 기기가 열 때 | 원격 |
|---|---|---|
| 옛 `savedAt` 그대로 PUT | `pushDirty` | **기기 판으로 덮임** |
| `village-restore.mjs`(서버 지금 · `dev=restore-…`) | `remoteBackup` | **복원 유지** · 기기 판은 `.sync-backup` |

그리고 **마을이 열려 있으면 되살리지 않는다**(session 90초). 열린 기기가 몇 초 안에 자기 판을 올린다. 닫아도 `session` 은 90초 남는다 — `sync.js` 의 `close()` 는 session 을 지우지 않는다(`onDisconnect` 경합을 피하려고 일부러).

## ③ 학생 순서가 바뀌던 원인 (#228) — 배정 15 마무리

**원인**: `renderPromotionList()` 가 `DB.getStudents()` 가 돌려준 **캐시 배열 그 자체**를 `students.sort(레벨순)` 로 제자리 정렬했다. `renderAll()` 이 학생 표를 먼저(id순) 그린 뒤 이 함수를 부르므로 캐시가 레벨순이 되고, 쪽지 같은 쓰기가 루트 `on('value')` 를 깨우면 재정규화로 id순으로 돌아갔다 — "쪽지를 보내니 순서가 바뀌었다".

**지난 설명의 철회 이력**: 09-10 에는 "옛 숫자 키 본이 이겨서"라고 봤으나 #196 에서 스스로 철회했다(`OrdinaryOwnPropertyKeys` — 정수 키가 먼저, `s…` id 키가 뒤라 id 본이 항상 이긴다). 그래서 진짜 원인이 남아 있었다.

**함정 — 전수 검색을 두 가지로 해야 잡힌다**: `getStudents().sort(` 같은 체인 검색으로는 안 나온다. `const students = DB.getStudents();` 로 받아 **몇 줄 뒤** `students.sort(` 하기 때문이다. "식별자에 바로 `.sort(`" 를 따로 훑어야 한다. 전 파일에서 이 한 곳뿐이었다.

**남은 것**: 키오스크에서도 비슷했다는 말씀은 이 원인으로 설명되지 않는다(별도 페이지 · 학생 배열 제자리 정렬 없음). 재현 조건을 더 들어야 한다.

## ④ 학생 이중화 — 옛 숫자 키를 지워도 되나 (운영 GET 대조, 값 출력 없이)

`classRPG_v3/students` 에 숫자 키 8개(0~7) + id 키 7개. **삭제는 사용자 결정 게이트**라 대조만 했다.

| 숫자 키 | 결과 |
|---|---|
| 0 | **껍데기**(id·이름 없음). 정규화에서 이미 빠짐. 필드: battleDaily · pendingRewards 2건 등 |
| 1~7 | 전부 id 키에 짝 있음 · 레벨·골드 **옛 본 ≤ 현재 본** |
| 옛 본에만 있는 필드 | 4·5 의 `farm`(옛 20 / 현재 0 — 현재 본이 진실) · 7 의 `pendingRewards` |

**⚠ "3월 이후 얼어 있다"는 가정이 틀렸다.** 키 7 과 키 0 에 **2026-06-15 날짜 보상 대기**(9건 · 2건)가 있다. 6월에도 옛 숫자 경로에 쓴 코드가 있었다는 뜻이다(6월 승인 누락 사건과 같은 날).
- 키 7 의 9건 = 같은 학생의 06-15 **승인 기록 9건과 이름·EXP·골드까지 전부 짝**. 9/10 되살리기로 이미 들어가 승인됨 → **지워도 손실 0**.
- 키 0 의 2건("줄넘기 100회" · "친구에게 도움되는 행동하기")은 `studentId` 가 없고, 그날 **7명 모두** 같은 퀘스트가 승인돼 있어 주인을 특정할 수 없다.

## ⑤ 리코더 관리 (배정 14 남은 것)

운영 `recorderLogs` · `recorderSongs` **둘 다 `null`** → 교사 페이지를 한 번도 안 썼다. 학생 화면에는 "🎵 리코더 기록장은 곧 열릴 예정" 카드만 있다. 아이가 보는 약속이라 **제거 여부는 사용자 결정**으로 넘김.

## ⑥ 에뮬레이터·도구 함정 (다음 사람이 다시 밟을 것)

- **firebase-tools 15.x 는 Java 21 이상**을 요구해 JDK 17 로는 `emulators:start` 가 거절된다. **에뮬레이터 jar 는 JDK 17 로 직접 실행하면 된다**:
  `java -jar firebase-database-emulator-v4.11.2.jar --host 127.0.0.1 --port 9000` · 요청에 `?ns=<이름>` · 규칙은 `PUT /.settings/rules.json` + `Authorization: Bearer owner`.
- **에뮬레이터는 없는 경로에도 `200 null`** 을 준다. "읽기 실패" 시험을 경로로 만들면 실패가 안 난다 — 서버 없음(다른 포트)이나 규칙 401 로 만든다.
- **EventSource 의 `patch` 이벤트는 조각만** 온다(`{at}`). `put` 처럼 통째로 바꾸면 필드를 잃는다(`sync.js` 에서 실제로 잡음).
- **keepalive 없는 fetch 는 닫히는 페이지에서 도착하지 않는다.** keepalive 는 64KB 넘으면 브라우저가 거절.
- **Windows 의 Node 24 는 `fetch` 직후 `process.exit()` 에서 libuv assertion 으로 종료 코드 127** 을 낸다(성공인데). `process.exitCode` 로 자연 종료할 것.
- 셸에서 `node … | tail` 뒤의 `$?` 는 **tail 의 종료 코드**다. 스크립트 종료 코드를 볼 땐 파이프를 빼거나 `PIPESTATUS`.

## ⑦ 기준선

```
verify-safety  PASS 18 · REVIEW 1 · FAIL 0
smoke-test     PASS 28 · REVIEW 0 · FAIL 0
```
판정 요청 하나: smoke 에 "학생 캐시를 제자리 정렬하지 않는다" 검사를 넣으면 기준선 28 → 29.
