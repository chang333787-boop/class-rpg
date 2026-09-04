# 2026-09-04 (기기: 학교 Windows) — 퀘스트판 유실 버그 Q1 수정

> 담당: 보스 조수 세션. 1학기 작업 감사 → 1순위로 지목된 Q1을 수정.
> **이 기록을 따로 남기는 이유**: 수정이 PR #164에 deco 작업과 함께 squash 머지되어,
> 커밋 제목이 `fix(deco): 깊이 정렬 기준을 시작 줄 → 발밑 줄로 (#164)`다.
> `git log --grep=퀘스트` 로도 `--grep=boardQuests` 로도 **안 잡힌다.** 여기가 유일한 색인이다.

- **반영 commit**: `c3803c2` (PR #164, 2026-09-04 14:56 +0900) — 제목은 deco, 본문에 Q1 설명 포함
- **대상 파일**: `gamedata.js`(`ensureDailyQuests`), `student.js`(`autoCloseDailyQuests`), 캐시버스터 3 HTML + `scripts/smoke-test.mjs` 맵
- **안 건드림**: admin.js · kiosk.* · Firebase 루트 구조 · DB 규칙

## 무엇이 문제였나 (Q1)

`docs/rpg_feature_overhaul_plan_2026_summer.md`가 **"최우선 확정 버그"**로 지목했던 것.

- `DB.ensureDailyQuests()`(gamedata.js)와 `autoCloseDailyQuests()`(student.js)가
  `boardQuests` **배열 전체를 통짜 `set()`** 했다.
- 아침에 학생 여러 명이 거의 동시에 접속하면, 각자 **자기 기기의 낡은 목록**으로 서버 전체를 덮어쓴다.
- 그 사이 교사가 추가·수정한 퀘스트가 **소리 없이 사라진다.** 오류도 토스트도 안 뜬다.

## 어떻게 고쳤나

두 경로 모두 **Firebase `transaction`** 으로 전환. 서버의 현재 목록을 읽어 그 위에 적용하고,
경합이 나면 Firebase가 콜백을 재시도한다 → 낡은 캐시가 서버를 덮지 못한다.

- `gamedata.js:830` — `this._fbRef.child('boardQuests').transaction(cur => applyDaily(cur));`
- `student.js:10413` — `DB._fbRef.child('boardQuests').transaction(cur => closeStale(cur) || undefined);`

`[Q-2B]`(교사가 admin을 열지 않아도 학생 첫 접속 시 오늘 일일퀘스트가 생성되는 동작)는 **그대로 유지**했다.
로컬 캐시(`this._cache` / `db.boardQuests`)는 화면 즉시 반영용으로 종전처럼 갱신한다.

## ⚠️ 함정 — 배열 인덱스 부분 저장은 금지

계획서 ②안(`boardQuests/<i>/active` 개별 경로 저장)을 **먼저 시도했다가 폐기**했다.

**배열 인덱스는 기기마다 가리키는 퀘스트가 다르다.**
학생의 낡은 캐시에서 `index 1`이 서버에서는 다른 퀘스트였고,
`boardQuests/1/active = false`가 **엉뚱한 교사 퀘스트를 닫아버렸다.**
2인 동시접속 시뮬레이션에서 재현 확인:

```
[1] t2 / 교사B / active=false   ← 닫으려던 건 어제 일일퀘스트(t3)였다
```

→ 통짜 `set`을 피하려다 인덱스 부분 저장으로 가면 **버그 종류만 바뀐다.**
`boardQuests`가 배열인 한, 안전한 부분 저장은 **없다.** transaction 아니면 id 객체맵이다.

## 검증

Firebase write 없이 정적 검증 + 격리 시뮬레이션만. 운영 데이터 미접촉.

- `node --check gamedata.js` / `node --check student.js` → OK
- `node scripts/verify-safety.mjs` → **PASS 18 · REVIEW 1 · FAIL 0** (기준선과 동일, root write 후보 4건도 동일)
- `node scripts/smoke-test.mjs` → **PASS 33 · REVIEW 0 · FAIL 0**
- **2인 동시접속 시뮬레이션** (gamedata.js를 vm에 로드, Firebase ref 스텁. 학생 2명이 t2가 빠진 낡은 캐시로 접속):

  | 항목 | 수정 전 (HEAD) | 수정 후 |
  |---|---|---|
  | 교사 퀘스트 t2 | **소실** | 보존 |
  | 어제 일일퀘스트 t3 | 내려감 | 내려감 |
  | 오늘 자동 일일퀘스트 | 1개 | 1개 (중복 없음) |
  | 총 항목 | 3개 (1개 유실) | 4개 |

- 실기기(브라우저 실로그인) 검증은 **안 했다.** 운영 Firebase write가 필요하다.
  → 배포 후 교사가 admin에서 퀘스트 하나 올려둔 채 학생 계정으로 접속해 1회 확인 권장.

## 미처리 (후속)

1. **`admin.js`의 `boardQuests` 통짜 `set` 6곳** — L3865 · L3979 · L4149 · L4294 · L4324 · L4340.
   교사 단독 조작이라 경합 위험이 낮아 이번 범위에서 제외. 학생 쪽 유실 경로는 이미 막혔다.
2. **`ensureDailyQuests`의 `saveSettings` 통짜 저장** (계획서 ③안) — `settings` 노드 전체를 낡은 사본으로 덮는다.
   `settings/autoDailyLastDate` 단일 키 저장으로 바꿔야 한다. 단, `saveSettings`의 저장실패 처리(ER-2)를 잃지 않게 주의.
3. **`boardQuests` 배열 → id 객체맵 전환** — 위 1·2를 근본적으로 없애는 유일한 길.
   **`CLAUDE.md` §6 고위험 영역이라 별도 승인 필요.** 마음대로 진행 금지.

## 다음 할 일

- 위 미처리 3건은 보스 판단 대기.
- 배포 후 교사 실기기 확인 1회.
