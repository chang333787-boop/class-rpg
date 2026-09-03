# 2026-09-03 (기기: 학교 Windows) — 사회 4-1 문항 재구성: OX·상황·추론 90문항 (SOCIAL-TYPES-1)

> 담당: 영어앱 세션(대장 = RPG 인수인계 세션이 배정). 사용자 요청 요지: "사회는 영어를 벤치마킹해서 OX를 명확하게, O를 고르는 것보다 **상황으로 판단**·**논리적으로 따져보는** 문제가 있으면 좋겠다."

- **브랜치**: `feat/social-types` (worktree `C:\Users\USER\projects\class-rpg-wt-social`, base `origin/main` f2ea87d — 배정 메시지의 4237ea4보다 최신 main)
- **대상 파일**: `curriculum.js` **사회 문항 구간(`so4-1-*`)만** — 기존 300문항 뒤에 90문항 추가. 상단 형식 주석·수학 구간·`CurriculumUtils`는 대장 세션이 동시에 수정 중이므로 **손대지 않음**.
- **안 건드림**: student.js · admin.js · gamedata.js · Firebase.

## 설계 (영어앱 벤치마킹 판단)
- 영어앱은 **입력 방식**(고르기/빈칸/받아쓰기)으로 유형을 갈랐지만, 사회는 대장 설계대로 **사고 방식**으로 가르는 게 맞다: `ox`(참/거짓 판별) · `situation`(상황에 지식 적용) · `reason`(원인→결과, 까닭). 기존 `concept`/`apply`는 유지.
- 영어앱에서 가져온 원칙 2가지: ① **오답도 그럴듯하게**(같은 범주 안에서만 보기 구성, 정답이 튀지 않게) ② **상황 문제는 반드시 앞뒤 상황이 답을 결정**하게(암기로 못 풀게). 영어앱의 "왜 그럴까" 해설은 `hint`에 짧게 담음(학생 화면이 오답 시 hint를 보여 줌).
- OX는 문장이 명확히 참/거짓인 것만. "대부분", "보통" 같은 애매한 표현 배제.

## 분량·id
- 단원당 ox 10 · situation 10 · reason 10 → 총 90. id `p_so41<단원>_ox01~10 / _si01~10 / _re01~10`.
- level: ox 1~2, situation 2, reason 2~3.

## 검증
- `node --check curriculum.js`
- 정합성 스크립트(스크래치 `check_social.mjs`): id 중복 0 · ox는 `choices` 정확히 `['O','X']`이고 `a`가 그중 하나 · situation/reason은 choices 4개·정답 포함·보기 중복 없음 · 고아 unitId 0 · 새 문항 90개 카운트.
- verify-safety · smoke-test (데이터 변경이라 그대로 통과 기대).
- 브라우저 검증은 대장 세션이 통합 후 수행.

## 검증 결과 (2026-09-03)
- `node --check curriculum.js` → OK
- 정합성(Node vm으로 BASE_PROBLEMS 실제 로드): 전체 1,170문항(사회 390 = 기존 300 + 새 90) · 단원×cat 각 10개씩 9묶음 · **id 중복 0 · 형식 위반 0 · 고아 unitId 0**
- `verify-safety` **PASS 18 · REVIEW 1 · FAIL 0** · `smoke-test` **PASS 33 · FAIL 0**
- 변경 파일: curriculum.js(사회 구간 끝, `p_so413_182` 바로 뒤에 90문항 블록 추가), 본 worklog. 다른 구간 미접촉.
- 브라우저 검증: 대장 세션이 통합 후 수행(학생 화면 cat 모드 선택은 대장 쪽 구현).

## 다음 할 일
- PR 생성 → 대장 세션 머지.
