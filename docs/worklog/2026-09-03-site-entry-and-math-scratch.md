# 2026-09-03 (학교 Windows) — 사이트 첫 화면 정리 + 수학 풀이 연습장

2학기 첫 세션. 맥북 마지막 작업(`71c114f`, 07-31) 이어받음.

## 1. funclassrpg.kr 접속 시 개발 문서가 뜨던 문제

**원인:** 루트에 `index.html`이 없었다. GitHub Pages는 그럴 때 `README.md`를
사이트 첫 화면으로 렌더링한다. 같은 이유로 저장소의 **.md 26개가 전부 공개 웹페이지**가 돼 있었다
(`/docs/rpg_teacher_operation_guide`, `/CLAUDE`, worklog 전부 200 응답 확인).

**조치**
- `index.html` 신설 — 주소만 치면 `student.html`로 보낸다.
  JS `location.replace` + `meta refresh` + 수동 버튼 3중 (JS 막혀도 넘어감).
- `_config.yml` 신설 — `README.md` · `CLAUDE.md` · `AGENTS.md` · `docs` · `scripts`를
  Pages 빌드에서 제외. 앱이 이 경로들을 참조하지 않는 것은 grep으로 확인함.

**⚠️ 과장하지 말 것:** 이걸로 비밀번호가 가려지는 게 아니다.
`gamedata.js:865`가 관리자 기본값 `'teacher1234'`를, 학생 기본 `pw:'1234'`를
**소스에 그대로 갖고 있고 정적 사이트라 브라우저에 다 내려간다.** 실질 방어는
운영 비밀번호를 바꿔 둔 것(사용자 확인 완료, DB `classRPG_adminPw`).
`_config.yml`의 실제 값은 **감사 문서·운영 런북·worklog·DB 구조 메모가 웹에 안 올라가는 것**이다.
저장소가 public이라 github.com 에서는 여전히 보인다.

**배포 후 확인 필요(머지 전엔 검증 불가 — Pages는 main만 빌드한다)**
- `https://funclassrpg.kr/` → 학생 화면으로 이동
- `https://funclassrpg.kr/docs/rpg_teacher_operation_guide` → 404
- `https://funclassrpg.kr/student.html` · `/admin.html` · `/kiosk.html` 정상

## 2. 수학 풀이 연습장 (사용자 요청)

수학은 세로셈을 손으로 써야 풀린다. **문제 아래에 필기 공간**을 뒀다.
요청대로 기능은 둘뿐 — **필기 · 지우기**. 저장하지 않는다.

- `STUDY_SESSION.subjectKey === 'math'` 일 때만 나온다(영어·사회는 그대로).
- 다음 문제로 넘어가면 `renderStudyQuestion` 재렌더로 **새 종이**가 된다.
- pointer 이벤트라 마우스·손가락·스타일러스 다 된다. `touch-action:none`으로
  손가락으로 그릴 때 페이지가 같이 스크롤되지 않게 했다.
- dpr 보정(최대 2배)으로 선이 흐리지 않게. 창 크기가 바뀌면 그림을 보존한 채 다시 맞춘다.
- 어두운 화면 위 밝은 '종이' + 26px 모눈(자리 맞추기 용).

**중간에 잡은 버그:** `fit()`이 크기가 같으면 `SCRATCH_CTX`를 세팅하지 않고 빠져나가,
같은 캔버스에 `initStudyScratch()`를 다시 부르면 필기가 죽었다.
실제 문제 넘김 흐름에선 캔버스가 매번 새로 생겨 안 걸리지만, 멱등하게 고침.

## 검증

- `node --check student.js` OK · **verify-safety 18/1/0** · **smoke 33/0/0**
- **브라우저 실렌더** — Firebase 없는 격리 하네스(스크래치패드)로 진행,
  **운영 DB 쓰기 0건**. student.html을 직접 열지 않았다.
  - 필기: 잉크 픽셀 0 → 1224 / 지우기 버튼 → 0 (모눈은 남음)
  - 좌표 정확도: y=120에 그은 가로선이 118~121행에 찍힘(선 굵기 2.6 범위 내)
  - 크롬북 1366×610에서 `scrollHeight === clientHeight` — **스크롤 없이 답 입력칸까지 보임**
  - 1100×780 · 태블릿 768×1024 리사이즈 왕복 후에도 필기 보존, 캔버스 해상도 CSS와 일치
  - 연습장 없는 화면에서 `initStudyScratch()`/`clearStudyScratch()` 호출해도 안 터짐
  - 콘솔 오류 0
- gamedata / admin / kiosk / curriculum **무변경**
- 캐시버스터: `student.js 20260903a` · `student.css 20260903a` + smoke 맵 동기화

## 🤝 핸드오프 — 담당 분담 다시 정해야 함

07-13에 정한 "`student.js`는 학교 전담"이 **07-31 맥북 작업(#139·#141·#142·#143)으로 이미 깨졌다.**
학습게임이 통째로 student.js에 들어갔기 때문. 이번 세션도 student.js를 만졌다.
**다음에 양쪽이 동시에 붙기 전에 lane을 다시 합의할 것.**

## 남은 것

- 07-30 worklog의 교사 버튼 3건이 아직 실행 안 된 것으로 보임
  (**[📦 이전]** · **[🧹 정리]** · 확인 후 옛 `classRPG_v3/backups` 삭제 → 전송량 6.4MB→1.3MB).
- `settings.activeProblemUnits`가 비어 있어 **1학기 전 범위 1,080문항이 학생에게 나간다.**
  2학기 진도에 맞춰 교사 화면 **📚 학습 범위**에서 단원을 켤 것.
- 코덱스 클론(`바탕화면\클로드코드\class-rpg`)은 `feat/asset-pr4-equipment`에 멈춰 있고
  untracked 에셋(`assets/characters/`·`assets/skillbooks/`)이 있다. 이번 세션에선 건드리지 않음.
