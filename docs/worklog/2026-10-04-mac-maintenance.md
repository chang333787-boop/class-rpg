# 2026-10-04 (기기: 맥북) — 전체 평가 뒤 정비 · 리팩토링 (사용자 외출 중 위임)

> 사용자 지시(10-04 저녁): "평가 2~7번을 묻지 말고 해결 · 학교 말고 맥북이 해도 됨 · 리팩토링도 계획 세워서 알아서 · 꾸미기 말고도 할 여지 있으면 하라 · 절대 멈추지 말 것".
> 보안(평가 1번: 로그인·DB 규칙·평문 비번)은 **사용자 결정으로 내년**(올해 = 프로토). 이번 정비에서 다루지 않았다.
> 모든 PR: 운영 DB 접속 0(가짜 프로젝트 + DB 주소 차단 헤드리스) · 다른 눈 검토 · 넣기 전 확인 장치(gate: 학생 문 54개·폰 하단 탭·관리 탭 35개·키오스크·학습 앱 9개를 실제로 누름) · squash 머지 · 운영 반영(deploycheck) · 운영 사이트 로드 확인.

## ① 들어간 PR

| PR | 평가 번호 | 무엇 |
|---|---|---|
| #1158 | 4 | 학생 화면 버그 아홉 — 감정 수정 날짜 · 학습 창 바깥 눌러 닫힘 · 금요일 보스 주 1회 · 업적/감정 보상 표시 = 실제 지급 · 퀘스트 '내 보상' 상태 · 접속 시간 안내 · 쪽지 할 일 · 폰 하단 탭 빈 화면 |
| #1159 | 7 | 검사 도구 — precheck 가 하위 앱 시험·esc-parity·전역 이름 겹침까지 · 하위 앱 버스터 검사 · getActiveSubjects(잘못된 판) 삭제 · README/CLAUDE.md/docs 색인 · CI 설정(`scripts/ci/check.yml`, **아직 꺼짐** — workflow 권한 필요) |
| #1160 | 3·5 | 관리 화면 — `${...}` 글자로 나오던 고장 칸 셋(칭호·스킬 계수·도감 보상) · 기본 일일 보상 칸 연결(기본값 그대로 35/25) · 전체 승인 확인창 + 작품·독서 제외 · 반려 확인 · 승인 알림은 저장 뒤 · 감정 대화 요청 배너 · **학습 앱 기록 모음(교사 화면 7개 링크)** · 초기화/가져오기 글자 확인 + 먼저 백업 · **백업·내보내기에 학습 앱 루트** · 백업 키에 시각 |
| #1161 | 6 | 아이 화면 정리 — 배우고 만들기 NEW 7개 떼기·매일 문 먼저 · 오늘의 학습 과목 먼저(앱은 아래 묶음) · 할 일 수에 열린 선생님 퀘스트(3개까지 펼침, 누르면 퀘스트 창) · 승인 레벨업 축하 · HUD 헷갈리는 두 단추 제거 · 리코더 탭 → 음악실 · 명화 탐정 돋보기 숫자 → 쉬운 말(판정과 같은 셈) · 학습 앱 바닥글 성취기준 번호 → 교사 화면 · '명도' → '밝기' |
| #1162 | 2 | **골드·보상 유실 0** — 학생 기록 바뀐 칸만 저장 · 골드/EXP/누적 골드 increment · 보상 목록 id 합치기 transaction(끊김 재시도) · 승인 = 학생 기록 transaction 하나(보상이 있을 때만) · 기록 쓰기는 저장 뒤 · 학생 상세 창 바뀐 칸만. gold-sync-sim 무작위 200판 22,930G → 0G · 교사 승인 학생 화면 반영 10초+ → 0.15초 · real-sdk 16/16. 설계 = `docs/sync_merge_design.md`(남은 위험 §5). 옛 #288 닫음 |
| #1163 | 7 | **student.js 나누기** 16,774 → 3,131줄 + `student/{char,battle,deco,art,emotion,reading,weekly,study}.js` — 글자 그대로(다시 끼우면 원본과 같음) · 시험은 `scripts/unit/student-sources.mjs` 로 읽음 |
| #1164 | 7 | 학습 앱 공통 뼈대 `common/`(util · Firebase 설정 · 선생님 문 · 공통 css) — 앱 8개 40화면 픽셀까지 같음 |
| #1165 | 7 | 첫 로딩 −22%(1,409 → 1,095KB) — 꾸미기 `student/deco.js`·Chart.js·영어앱 Firestore 는 쓸 때만 불러오기(진입점 정적 검사 `deco-lazy-check`) · 홈 처음 구역 아이마다 기억 |
| #1166 | — | 관리 감정 현황 [오늘] 단추 ReferenceError |
| #1167 | 7 | **admin.js 나누기** 6,589 → 627줄 + `admin/*.js` 9개 — 글자 그대로 · 시험은 `admin-sources.mjs` |
| #1168 | 7 | **gamedata.js 나누기** 3,779 → 1,482줄(DB 저장층·Utils 통째) + `gamedata/{data,rules,emotion,battle}.js` — html 네 곳(student·admin·kiosk·watercolor) 같은 순서·같은 ?v= · 밤에 머지(옛 html+새 js 10분 위험) |

## ② 기준 숫자 (10-04 밤 main)
verify-safety PASS 39 · REVIEW 1 · FAIL 0 · smoke PASS 32 · precheck --no-deco PASS 26 · REVIEW 1 · FAIL 0 · SKIP 1 · unit 331 · buster-check FAIL 0 · gold-sync-sim --expect-fixed ✅ · 하위 앱 시험 + common 시험 전부 FAIL 0.

줄 수: student.js 3,227 + student/*.js 8개(deco 8,191 · battle 1,713 · study 1,266 · art 787 · emotion 558 · char 520 · weekly 389 · reading 295) · admin.js 627 + admin/*.js 9개(각 239~931) · gamedata.js 1,482 + gamedata/*.js 4개(data 838 · battle 720 · rules 400 · emotion 357).

## ③ 🤝 핸드오프 (학교 세션·다른 세션)
- **student.js · admin.js · gamedata.js 를 고치던 갈래는 다시 얹어야 한다.** 코드는 글자 그대로 `student/*.js`·`admin/*.js` 로 옮겼고, 원래 자리에 `// ── [SPLIT-1] 여기 있던 '<이름>' 덩어리…`(admin 은 `[ADMIN-SPLIT-1]`, gamedata 는 `[GAMEDATA-SPLIT-1]`) 표시와 새 파일 머리에 `원래 … a~b줄` 이 있다. 열린 PR #1120·#1118·#1117·#379·#336 에 안내 댓글을 달았다.
- 꾸미기 `student/deco.js` 는 html 태그가 없다 — 고치면 student.js 의 `DECO_SRC` `?v=` 를 올린다(buster-check 가 잡음).
- `common/` 파일을 고치면 부르는 모든 하위 앱 index.html 의 값을 같이 올린다(buster-check FAIL 로 잡음).
- 저장 규칙: CUR 을 비동기 콜백에서 별칭으로 붙잡아 저장하지 말 것(`cur-alias-check` 가 잡음, 설계 문서 §2-7).
- CI 를 켜려면 `scripts/ci/check.yml` 을 `.github/workflows/` 로 옮겨 workflow 권한 있는 계정으로 push.

## ④ 안 한 것 · 다음 후보
- 보안(평가 1) — 사용자 결정: 내년. 경제 수치(농장 상한 등) — 사용자 결정. 학생 삭제 기능 — 설계 필요. village/ — 마을 세션 구역.
- 꾸미기 `student/deco.js`(8,188줄) 안 더 쪼개기 · `curriculum.js`(171KB gz) 늦게 불러오기 · `firebase-storage-compat`(작품 올리기만) 늦게 불러오기 · 학습 앱 교사 화면에 반 명단 기준 '안 한 아이' 보이기 · 수채화가 DB 통째 받기(학생 판으로) · 키오스크 감정판 공개 범위(설계 확인).
- 크롬북 실기기에서 첫 로딩·꾸미기 첫 열기 시간 재기.
