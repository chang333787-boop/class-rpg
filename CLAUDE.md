# CLAUDE.md — 우리반 성장 RPG 작업 진입점

> 이 파일은 Claude Code가 세션 시작 시 자동으로 읽는다.
> 목적: **어느 기기(맥북·학교 Windows)에서, 어느 세션을 열든 같은 규칙으로 시작**하게 만든다.
> 작업 방향이 세션마다 흔들리지 않게 하는 나침반이다.

## 0. 먼저 읽을 것 (이 repo가 규칙의 원본)

작업 전 아래 문서를 **반드시 먼저 읽고 그 규칙을 따른다.** 이 CLAUDE.md는 요약·진입점일 뿐,
세부 규칙의 원본은 아래에 있다.

- `README.md` — 프로젝트 구조 · 작업 원칙 · 고위험 영역
- `docs/rpg_refactor_safety_rules.md` — **현행 안전 규칙** (저장·날짜·캐시·검증 절차)
- `docs/rpg_refactor_codex_handoff.md` — 감독 역할 · 표준 지시문 형식 · 보고 형식

## 1. 절대 원칙 (요약 — 원본은 handoff §1.1)

```
조사 먼저, 수정 나중.
수정은 작은 Phase 하나씩.
범위 밖 리팩토링 금지.
git add . 금지 (변경한 특정 파일만 add).
Firebase 데이터 직접 수정 금지 / 운영 write 버튼 클릭 금지.
검증 전 자동 머지 금지.
보고 후 반드시 정지 (다음 Phase 자동 진행 금지).
```

## 2. 시작·검증 루틴

- 시작: `git checkout main && git pull --ff-only` → 최신화, working tree clean 확인
- read-only 조사 먼저 → 수정 Phase면 새 브랜치(`refactor/...`)
- 시작/끝 검증: `node scripts/verify-safety.mjs` (FAIL이면 중단 / 기대값 `PASS 18 · REVIEW 1 · FAIL 0`)
- JS 변경 시 `node --check <file>.js`
- 검증은 **Firebase write 없이** (로드·정적·typeof·grep으로 대체)
- JS/CSS 수정 시 해당 HTML의 `?v=` 캐시버스터 갱신 검토

## 3. 감독 역할은 환경별로 다르다 (중요)

- **무엇을·어떻게(안전 규칙 · 지시문 형식 · 보고 형식 · 정지 규칙)는 양쪽 기기가 동일하다.** ← 절대 안 어긋나는 부분
- **누가 감독이냐만 환경별로 다르다:**
  - 맥북: GPT(별도 앱) 감독 + Claude Code 작업자
  - 학교 Windows: Claude Code 내부 Codex 감독 (자세히는 그 기기의 `CLAUDE.local.md`)
- 누가 감독이든 `docs/` 규칙과 아래 보고/지시문 형식은 똑같이 적용한다.

## 4. 두 기기에서 작업할 때 (충돌 방지)

- **앉으면 `git pull --ff-only`, 끝나면 push.** (시작 pull / 끝 push)
- 한 기기에서 작업 중이면 다른 기기에서 같은 브랜치를 동시에 만지지 않는다.
- 작업 내용·다음 할 일은 `docs/worklog/`에 날짜별로 남긴다 → 반대쪽에서 이어받고, Obsidian에서 본다.
- **⚠️ 새 작업 전, `docs/worklog/`의 가장 최근 날짜 파일을 먼저 읽는다.** 거기 "🤝 핸드오프 + 담당 분담"이 있으면 그대로 따라 **같은 파일을 두 기기가 동시에 만지지 않도록** 한다.

### 4.1 현재 담당 분담 (2026-07-13 기준 — 상세는 `docs/worklog/2026-07-13.md`)

- **🏫 학교(Windows):** 에셋(스킬북/장비 등) + **`student.js` 후속 전담**(DI-5 전투 데드코드·ED-2 농작물 시듦·openZone 등 죽은코드·학생 저장실패 토스트 훅).
- **💻 맥북:** `student.js` **외** — 백업 커버리지(ER-3)·보안(S-1/S-2, 고위험)·admin/kiosk/gamedata resilience·분석.
- **규칙:** `student.js`는 당분간 **학교만** 편집. JS 변경 시 **자기 파일 캐시버스터만** 올리고 smoke-test 맵 동기화(다른 파일 값 보존).

## 5. 지시문·보고 형식

- Claude Code에 주는 작업 명령문 표준 형식: handoff §10
  (`[목표] [수정 대상] [절대 금지] [사전 확인] [작업 원칙] [정적 검증] [자동 브라우저 검증] [운영 데이터 안전] [자동 머지 조건] [보고 형식] [정지 조건]`)
- 완료/조사 보고서 형식: handoff §13
- 자동 머지 허용 기준: handoff §11 (전 조건 충족 시에만, 하나라도 이상하면 머지 금지·보고)

## 6. 고위험 영역 (건드리기 전 조사 + 별도 승인)

Firebase 루트 구조/마이그레이션, `pendingRewards` 배열→객체맵, `buildMainHTML` 분해,
전투/몬스터 로직, canvas/SVG 렌더, `GAME_DATA`/`_normalizeArrays`/`_migrate` 내부 대수정,
대규모 인라인 onclick 전환, 학생 삭제/계정/비밀번호 정책. (상세: README · safety_rules §10)
