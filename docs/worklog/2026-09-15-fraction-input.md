# 2026-09-15 (기기: 학교 Windows) — 분수 입력칸 (FRACTION-INPUT-1)

> 담당: 학습 조수(`st`). 설계안 `보고_20260915\학습_분수입력칸_설계_20260915.md` → 보스 판정(09-15): ① 진행 ② 값이 같으면 **정답 인정 + 안내**, 플래그로 교사가 뒤집을 수 있게.

- **변경**: `curriculum.js` — `FRACTION_REQUIRE_MIXED = false` 플래그 · `CurriculumUtils.parseFraction`/`fractionMatch` · `isCorrect` fraction 분기 · 수학 4-2 1단원 calc 18문항 `type:'choice'` → `'fraction'`(choices 삭제, id·a 그대로) / `student.js` — 입력칸 분기·`submitFractionInputs`·결과 화면 안내 / `scripts/unit/fraction-grade.mjs` 새 회귀 / 버스터 `student.js`·`curriculum.js` `20260915stm`.
- **저장 경로 무관**, 기록 스키마 변경 0 — 제출값은 지금 기록과 같은 문자열(`'4와 2/5'`, 조사는 자연수 끝자리로 와/과).

## 재현 → 수정 → 재현 안 됨
- **재현**: 분수 답 문항이 전부 보기 고르기 → 찍어서 맞힐 수 있고, 받아올림을 빠뜨린 값을 스스로 써 보는 연습이 안 됨. 입력칸은 하나(`inputmode="numeric"`)라 `/`·`와`를 칠 수 없어 입력형으로 못 바꿨다.
- **수정**: 자연수·분자·분모 세 칸(모두 숫자 키패드, 자연수 칸 비우면 진분수). 채점은 모양이 같으면 정답, **값만 같으면(22/5·3과 7/5·1/2↔3/6) 플래그 false일 때 정답 + "값이 같아요! 대분수로 바꿔 써 볼까요?"(가분수 모양일 때) / "문제에서 쓰는 모양으로도 써 봐요."** 와 정답 모양을 보여 줌. 분모 빈칸·0, 분자 빈칸은 제출 전에 알림.
- **재현 안 됨**: 18문항 세 칸·숫자 키패드 표시, 자기 정답 18/18, 22/5·3과 7/5·1/2 정답+안내, 4와 3/5 오답, 빈 분모 "분모를 써 주세요".
- 옛 캐시(student.js 옛 판 + 새 curriculum.js)는 텍스트 입력칸으로 떨어지는데, `4와 2/5`·`22/5`로 쳐도 새 `isCorrect`가 채점한다.

## 검증
- `node scripts/unit/fraction-grade.mjs` — 13가지 입력 × 플래그 false/true + 문항 자기 정답 PASS (true면 모양이 같은 답만 정답)
- 전체 문항 회귀: fraction 외 2,342문항 자기 정답 통과 그대로
- 렌더 하네스(운영 write 0): 수학 4-2 210문항 채점 불변(정답 210·오답 거부 210), 분수 18문항은 세 칸(옛 하네스의 "입력칸 없음" 18건은 단일 입력칸을 찾는 검사라 예상된 결과)
- `verify-safety` PASS 18 · REVIEW 1 · FAIL 0 / `smoke-test` PASS 29 · REVIEW 0 · FAIL 0 / `scripts/unit/run.mjs` 그대로

## 사용자 결정 카드에 올릴 것 (보스)
- 기본값 = **값이 같으면 정답 인정**. 교과서 모양만 인정하려면 `curriculum.js`의 `FRACTION_REQUIRE_MIXED`를 `true`로.
