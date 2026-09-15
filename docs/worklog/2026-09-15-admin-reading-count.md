# 2026-09-15 (기기: 학교 Windows) — 교사 화면 단원 문항 수에 독해 지문 포함 (ADMIN-READING-COUNT-1)

> 담당: 학습 조수(`st`). 작전_20260915 학습 후보 ① (보스가 #225 리뷰에서 목록에 넣으라 함).

- **변경**: `admin.html` script 한 줄 — `curriculum_reading.js?v=20260915sta`(student.html과 같은 값, 파일 내용 변경 없음).
- **재현**: 교사 "학습 범위" 화면의 단원별 문항 수(`CurriculumUtils.problemsByUnit`)가 curriculum.js만 보고 셌다. 학생 앱은 독해 지문 문항을 함께 낸다.
  | 단원 | 교사 화면 | 학생이 실제로 받는 풀 |
  |---|---|---|
  | 1학기 국어 6단원 | 각 30 | 각 38 |
  | 2학기 · 비교하며 읽어요 / 우리말, 우리글 / 매체 단원 | 30 | 46 |
  | 2학기 나머지 5단원 | 30 | 42 |
- **수정**: admin.html이 curriculum_reading.js도 불러 `allProblems()`에 READING_ITEMS가 합류.
- **재현 안 됨**: 같은 계산이 38/46/42로 학생 쪽과 일치.
- 이름 충돌 확인: curriculum_reading.js의 최상위 이름은 `READING_PASSAGES`·`READING_ITEMS` 둘뿐, admin.js·gamedata.js·curriculum.js에 없음. gamedata+curriculum+reading 한 문맥 적재 OK.
- admin.js가 문항을 쓰는 곳은 단원 수 세기 한 곳뿐(grep) → 다른 교사 화면 영향 없음.
- `verify-safety` PASS 18 · REVIEW 1 · FAIL 0 / `smoke-test` PASS 28 · REVIEW 0 · FAIL 0 (공유 파일 3개 일치: `curriculum_reading.js=20260915sta×2`)
