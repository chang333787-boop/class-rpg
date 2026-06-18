# AGENTS.md — 우리반 성장 RPG 작업 진입점 (Codex CLI)

> 이 파일은 **Codex CLI가 세션 시작 시 자동으로 읽는다.**
> 규칙은 **도구와 무관하게 동일하다.** Codex도 Claude Code와 똑같은 규칙·검증·정지 규칙을 지킨다.
> 이 파일은 진입점일 뿐, 세부 규칙의 원본은 아래 문서들이다.

## 0. 먼저 읽을 것 (규칙의 원본)

작업 전 아래를 **반드시 먼저 읽고 그대로 따른다:**

- `CLAUDE.md` — 작업 진입점(요약·나침반). 이 파일과 짝을 이룬다
- `README.md` — 프로젝트 구조 · 작업 원칙 · 고위험 영역
- `docs/rpg_refactor_safety_rules.md` — **현행 안전 규칙** (저장·날짜·캐시·검증 절차)
- `docs/rpg_refactor_codex_handoff.md` — 감독 역할 · 표준 지시문 형식 · 보고 형식

## 1. 절대 원칙 (CLAUDE.md와 동일)

```
조사 먼저, 수정 나중.
수정은 작은 Phase 하나씩.
범위 밖 리팩토링 금지.
git add . 금지 (변경한 특정 파일만 add).
Firebase 데이터 직접 수정 금지 / 운영 write 버튼 클릭 금지.
검증 전 자동 머지 금지.
보고 후 반드시 정지 (다음 Phase 자동 진행 금지).
```

## 2. 시작·검증 루틴 (CLAUDE.md와 동일)

- 시작: `git checkout main && git pull --ff-only` → 최신화, working tree clean 확인
- read-only 조사 먼저 → 수정 Phase면 새 브랜치(`refactor/...`)
- 시작/끝 검증: `node scripts/verify-safety.mjs` (FAIL이면 중단 / 기대값 `PASS 18 · REVIEW 1 · FAIL 0`)
- JS 변경 시 `node --check <file>.js`
- 검증은 **Firebase write 없이** (로드·정적·typeof·grep으로 대체)
- JS/CSS 수정 시 해당 HTML의 `?v=` 캐시버스터 갱신 검토

## 3. 두 기기에서 작업할 때 (충돌 방지)

- **앉으면 `git pull --ff-only`, 끝나면 push.**
- 한 기기에서 작업 중이면 다른 기기에서 같은 브랜치를 동시에 만지지 않는다.
- 도구 구분(2026-06): 윈도우 = Codex + Claude Code 작업자 / 맥북 = GPT 감독 + Claude Code 작업자(추후 Codex 이전 예정).
- 작업 내용·다음 할 일은 `docs/worklog/`에 날짜별로 남긴다.
