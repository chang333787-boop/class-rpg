# 2026-09-15 (기기: 학교 Windows) — 수채화 앱 이름·성찰 글 escHtml (WATERCOLOR-ESC-1)

> 담당: 학습 조수(`st`). 작전_20260915 배정표(14:40) 학습 ① — 기타3 점검에서 나온 누락 2곳.

- **브랜치**: `fix/watercolor-esc` · **변경**: `watercolor/index.html` 한 파일(+6/−4). 캐시버스터 대상 아님(페이지 자체).

## 무엇이 새었나
| 줄 | 들어가는 값 | 출처 |
|---|---|---|
| 학생 고르기 `g.innerHTML` | `s.name`·`s.avatar`·`s.id` | 운영 students(교사 입력) |
| 내 기록 `body.innerHTML` | 성찰 `why`(아이가 친 글)·`mood` | localStorage + `classRPG_watercolor/<id>` 동기화 |
| 내 기록 오류 | `e.message` | IndexedDB 오류 |

## 재현 → 수정 → 재현 안 됨
Firebase 스크립트를 뺀 복사본(운영 접근 0)에서 수정 전/후 같은 스크립트:
- **재현(수정 전)**: 이름 `<img src=x onerror=…>`·성찰 글 `<i>…` → 학생 칸·기록 제목에 태그가 실제로 생기고 **onerror 2회 실행**. 주소 `?sid=x"]`면 `querySelector` 예외로 학생 고르기 창이 안 열림.
- **수정**: 페이지에 `escHtml`(student.js와 같은 함수)을 두고 위 값 모두 감쌈. `?sid` 미리 선택은 선택자 문자열 대신 `dataset.id ===` 비교.
- **재현 안 됨**: 태그 0·실행 0, 글자는 그대로 보임. 창 열림.
- 정상 경로: `?sid=s2`로 미리 선택 → 비밀번호 → 로그인 `김하나 · RPG 연결` 확인.
- `verify-safety` PASS 18 · REVIEW 1 · FAIL 0 / `smoke-test` PASS 28 · REVIEW 0 · FAIL 0
