# 넣기 전 확인 장치 [GATE-1]

PR 을 main 에 넣기 전에 **실제 화면을 눌러 보는** 확인. 헤드리스 크롬(창 없음)이 가짜 RTDB 서버(`scripts/unit/fake-rtdb/`) 위에서
학생 · 관리 · 키오스크 · 학습 앱 화면을 열고 누르며, 페이지 예외 · `console.error` 가 하나라도 나면 NOT CLEAN 이다. 운영 Firebase 는 건드리지 않는다.

## 한 번에 (PR 전)

```
scripts/gate/checkall.sh <작업 폴더> [이름표]          # 약 80초
GPP=8972 GDP=9652 scripts/gate/checkall.sh <작업 폴더>  # 다른 세션과 함께 돌릴 때는 포트를 바꾼다
```

차례: 바뀐 JS `node --check` → verify-safety → smoke-test → precheck --no-deco → buster-check → `scripts/unit/**/*.test.mjs`(실패만) →
gold-sync-sim --expect-fixed → 확인 장치(처음부터 뒤에서 함께 돈다). 끝줄 `결과: ✅ 모두 통과` / `결과: ❌ 실패 — …`(exit 0 / 1).
전체 출력은 `$TMPDIR/class-rpg-checkall/<이름표>/`. git 은 읽기만(fetch 도 안 함 — 기준을 새로 하려면 먼저 `git fetch origin`).

## 확인 장치만

```
node scripts/gate/gate.mjs [--only student,admin,kiosk,apps] [--repo <체크아웃>] [--serial] [-v] [--no-cdn-cache]
```

| 줄 | 하는 일 |
|---|---|
| 학생 | `student.html?as=s1` · **1366×610**(학교 크롬북) · 홈 네 구역 + HUD 의 누를 것(`[onclick]` · `[role=button]` · `button`)을 DOM 에서 찾아 하나씩 **마우스로** → 열린 창 닫기(✕ · Esc) → 다음. 학습 앱 문은 화면 안 창(iframe)이 뜰 때까지 기다린다 |
| 학생 폰 | 390×800 · 아래 탭 다섯 |
| 관리 | `admin.html?auto` · 왼쪽 메뉴 전부 + 그 안의 탭(`…Tab(` 단추) · 그린 글에 `${` · `undefined` · `NaN` 이 보이면 adminLiteral |
| 키오스크 | `kiosk.html` 첫 화면 + 위 탭 |
| 학습 앱 | 앱 폴더마다 `index.html` 첫 화면 + 선생님 화면(`?teacher=1#/t` · `<앱>.teacher` 키를 미리 넣음) · 음악실은 `#/compose/new` `#/pick/practice` `#/pick/rhythm` `#/beat` 도 |

FAIL 로 세는 것: 페이지 예외 · `console.error`(FIREBASE WARNING · favicon 은 '무시'로 수만) · 같은 출처 파일 400 넘는 응답 ·
**운영 Firebase 주소 요청(막힌 시도까지)** · adminLiteral · 화면이 안 뜸 / 연 창이 안 닫힘.
끝줄 `CLEAN — 예외 0 · console.error 0 · …`(exit 0) · `NOT CLEAN — …`(exit 1) · 돌리지 못함(포트 · 크롬 · 시간 초과 · 자기 시험 실패) exit 2.
찾은 것은 `[예외] 학생 › 모험 › "상점 장비 · 씨앗" — ReferenceError … @ /student.js:1669` 처럼 **어느 화면에서 무엇을 누를 때**와 함께 나온다.

## 지키는 것

- **포트**: PP(가짜 서버 · 기본 8971) · DP(크롬 · 기본 9651) — `GPP` · `GDP` 가 있으면 그것. 이미 누가 쓰고 있으면 바로 멈춘다(lsof · 접속 시험).
  옛 장치는 다른 세션이 띄운 서버를 모르고 시험했다. 크롬도 디버깅 포트의 pid 가 '내가 띄운 것' 인지 본다. 서버는 `student.js` 가 이 저장소 파일과 같은지 본다.
- **운영 DB 0**: 가짜 서버의 shim(운영 RTDB 주소 → 가짜 서버) + 크롬 이름 풀기 막기(`--host-resolver-rules`) + 요청 막기(`Network.setBlockedURLs`).
  그래도 운영 주소로 가려던 요청은 하나하나 FAIL. 바깥 주소로 여는 문(영어 복습앱 = 운영 사이트)과 `<a href>` 링크는 누르지 않고 `건너뜀` 으로 보여 준다.
- **자기 시험**: 시작할 때 일부러 예외 · console.error(같은 출처 iframe 안 포함) · 404 · 운영 주소 요청 · adminLiteral 를 내 보고 모두 잡히나 본다.
  하나라도 못 잡으면 exit 2 — 크롬 · CDP 가 바뀌어 장치가 눈을 감은 채 CLEAN 을 내는 일을 막는다.
- **시간**: 장치 안에 175초 제한(`GATE_LIMIT_S`) — 넘으면 크롬 · 서버를 끄고 exit 2. 보통 약 80초(다섯 줄을 함께 · `--serial` 은 차례로).
- **CDN 저장본**: Blockly · Firebase SDK · 글꼴은 처음 받은 것을 `~/Library/Caches/class-rpg-gate/cdn`(저장소 밖 · `GATE_CACHE`)에 두고 쓴다 —
  브라우저 문맥마다 새로 받느라 학습 앱 창이 15초씩 걸렸다. 없으면 크롬이 그대로 받고 뒤에서 저장한다. `<head>` 를 막는 바깥 CSS 를 3초 안에 못 받으면
  빈 CSS 를 준다(글꼴 모양만 다름 · 참고로 적음). `--no-cdn-cache` 면 진짜 CDN.
- 크롬 = `~/Library/Caches/ms-playwright/chromium_headless_shell-1243/…/chrome-headless-shell`(헤드리스만 · `CHROME=` 로 바꿈) · 맥은 GPU(Metal)로 그린다.

## 알아 둘 것

- 오류는 '그때 누르던 것'에 붙는다. 늦게 나는 오류(타이머 등)는 다음 단추에 붙을 수 있다.
- 가짜 서버가 못 내는 것(보안 규칙 · 인증 · Firestore · Storage)은 여기서도 안 보인다 — `scripts/unit/fake-rtdb/README.md`.
- 2026-10-10 main(`c7f13f54`) 기준: 학생 doors `{"today":12,"adv":10,"learn":13,"me":13,"hud":1,"phone":5}` · 학습 앱 창 12 ·
  관리 메뉴 23 + 안 탭 17 · 학습 앱 첫 화면 12 · 선생님 화면 9 · 음악 길 4 → CLEAN · 약 77초.
  일부러 심은 고장 다섯(상점 ReferenceError · 음악 `#/beat` TypeError · 키오스크 console.error · 없는 그림 404 · 관리 NaN)을 모두 그 화면 · 그 단추에 붙여 잡았다.
