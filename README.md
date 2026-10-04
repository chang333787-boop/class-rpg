# 우리반 성장 RPG

초등 학급 운영용 웹앱. 학생들이 퀘스트를 수행하고 경험치·골드·레벨·스탯을 쌓으며
캐릭터·농장·전투 등으로 성장하는 "학급 성장 RPG"다.

기술적으로는 **정적 HTML + 바닐라 JavaScript + Firebase Realtime Database** 기반이다.
빌드 도구·번들러·프레임워크·`package.json`이 **없다**. 브라우저가 HTML을 열고,
HTML이 외부 JS/CSS와 Firebase SDK(CDN)를 직접 불러오는 단순 구조다.

> ⚠️ 이 저장소는 RPG 프로젝트 단독이다. (사내 다른 "가지(branch)" 프로젝트와는 **완전 별개**이며,
> RPG에는 AI 기능이 없다.)

---

## 프로젝트 개요

- 대상: 초등 학급(소수 인원, 교사 주도 운영)
- 데이터: Firebase Realtime Database 단일 트리(`classRPG_v3`)에 학급 전체 상태 저장
- 외부 의존성(전부 CDN, npm 설치 없음):
  - Firebase 9.23.0 compat SDK (`app` / `database` / `storage`)
  - Chart.js 4.4.0 (student/admin 통계 차트)
- 현재 상태: 리팩토링 1차 마감(2026-07) 뒤 **2026-09부터 기능 개발 재개.** 학습(국어·수학·사회 문항·받아쓰기·지문·별과 복습)·작품·쪽지·미니 세상 마을이 더해졌다. 아래 [현재 안정화 상태](#현재-안정화-상태) 참고.

---

## 화면 구성

세 개의 독립 HTML이 각각 다른 사용자/용도를 담당한다. 셋 다 같은 Firebase 트리를 공유한다.

| 화면 | 파일 | 용도 |
|---|---|---|
| 학생 | `student.html` | 학생 본인 화면. 캐릭터·퀘스트·보상 수령·농장·전투·작품 등 |
| 관리(교사) | `admin.html` | 교사용 관리 화면. 학생 관리, 퀘스트/보상 승인, 설정, 백업/복원/초기화 |
| 키오스크 | `kiosk.html` | 교실 공용 "할 일 체크판". 학생이 퀘스트 신청/취소(부분 저장 위주) |
| 우리 마을 | `village/index.html` | 미니 세상 마을(three.js). 학생 홈 🏘️ 타일이 iframe으로 연다(`?sid=<학생id>`). 교과 연결 없음 |
| 수채화·데생 | `watercolor/index.html` | 수채화 16차시·데생 10차시 앱. 학생 홈에서 iframe으로 연다 |

### 하위 앱 (폴더마다 `index.html` 하나)

학생 홈에서 iframe 으로 열고 주소에 `?sid=<학생id>&n=<이름>` 을 붙인다(없으면 손님 — 그 기기에만 저장).
학습 앱은 **자기 저장 루트만** 쓰고 RPG 본 데이터(`classRPG_v3`)는 쓰지 않는다(선생님 화면 비밀번호 확인용 `classRPG_adminPw` 읽기만).
선생님 화면 = `<폴더>/index.html?teacher=1#/t` (관리 비밀번호를 한 번 묻는다). ES 모듈 + import map 이라 버스터는 **import map 의 `?v=` 숫자**를 올린다.
공통 뼈대는 `common/`(아래 표 첫 줄) — 고치면 그 파일을 부르는 **모든** 앱 index.html 의 `"../common/…"` 값을 같게 올린다(`buster-check` 가 다르면 FAIL).

| 폴더 | 이름 | 하는 일 | 저장 루트 | 시험 |
|---|---|---|---|---|
| `common/` | 하위 앱 공통 뼈대 | `util.js`(h · toast · modal · lsGet … — 6앱 `js/util.js` 는 다시 내보내기만 · 음악실은 + 자기 것) · `rpg-firebase.js`(학급 RPG 설정 하나 · 앱 만들기 · 관리자 비밀번호 확인 — 8앱) · `teacher-gate.js`(선생님 화면 문 — 7앱 · 키 `<앱>.teacher` 그대로) · `subapp.css`(바탕 · 단추 · 창 · 윗줄 — 6앱, 앱 css 보다 **먼저** 부른다). 생각판 util · 음악실 · 생각판 css 는 모양이 달라 따로 | 없음 | `scripts/unit/common/common.test.mjs` |
| `art/` | 명화 탐정 | 옛 명화를 자세히 보며 찾기 → 단서 → 느낌 → 질문 · 조형 요소 돋보기 카드 | `classRPG_art` | `scripts/unit/art/cases.test.mjs` |
| `coding/` | 기초 코딩 | 블록 코딩(Blockly) — 몬스터에게 명령하기(길 찾기) · 그림 그리기 · 선생님 막힘 지도 | `classRPG_coding` | `scripts/unit/coding/stages.test.mjs` |
| `ink/` | 먹 연구소 | 먹색(농담) 만들기 · 한지에 붓 긋기 · 판본체 쓰기 | `classRPG_ink` | `scripts/unit/ink/stages.test.mjs` |
| `music/` | 음악실 | 작곡 · 리코더 연습 · 리듬 게임 · 우리 반 음악회 · 리코더 기록장 | `classRPG_music` | — |
| `paint/` | 물감 연구소 | 삼원색 섞기 · 밝게 어둡게 · 보색 · 느낌의 색 모자이크 | `classRPG_paint` | `scripts/unit/paint/stages.test.mjs` |
| `pattern/` | 무늬 공방 | 밀기 · 뒤집기 · 돌리기(4학년 수학 '평면도형의 이동')로 무늬 만들기 · 우리 반 무늬 전시 · 친구 무늬 맞히기 | `classRPG_pattern` | `scripts/unit/pattern/stages.test.mjs` |
| `print/` | 판화 놀이 | 판을 새기고 잉크를 발라 찍기 — 좌우가 바뀐다 · 파낸 곳은 하얗게 · 여러 장 | `classRPG_print` | `scripts/unit/print/stages.test.mjs` |
| `thinkboard/` | 생각판 | 사건 중심 이야기 줄 · 나무 · 정리본. 관리 화면 안에서도 연다(`thinkboard/index.html?rpg=1#/t`) | `classRPG_thinkboard` | `scripts/unit/thinkboard/rtdb.test.mjs` · `story.test.mjs` |
| `watercolor/` | 수채화 · 데생 | 차시별 따라 하기 · 내 기록 · TV 수업. 선생님 모드는 화면 위 [선생님] 단추 | `classRPG_watercolor` | — |
| `scan/` | 학습지 스캔 | 카메라로 학습지를 찍어 JPEG 를 학생 화면에 돌려준다(postMessage) | 없음 | — |
| `village/` | 우리 마을 | three.js 마을. **다른 세션 구역** — 여기서 고치지 않는다 | `classRPG_villages/<sid>` | `scripts/village-sync/` |

`watercolor/index.html` 은 루트 `../gamedata.js` 도 부른다 → gamedata 버스터는 **html 네 곳**(student · admin · kiosk · watercolor) 같은 값.

---

## 파일 구조

루트에 앱 파일이 평면(flat)으로 놓여 있다.

```
gamedata.js        공유 데이터 + DB 레이어 (게임 상수, Utils, Firebase 연결/정규화/저장 helper)
student.html  / student.js  / student.css     학생 화면 (student.js = 홈·집 허브·농장·상점·보스·HUD 등 바탕)
student/*.js                                   student.js 에서 떼어 옮긴 학생 화면 조각 8개(char·battle·deco·art·emotion·reading·weekly·study) — 클래식, student.js 바로 뒤
admin.html    / admin.js    / admin.css       관리(교사) 화면 (admin.js = 로그인·초기화·메뉴·대시보드·우리 마을·공용 도구 바탕)
admin/*.js                                     admin.js 에서 떼어 옮긴 관리 화면 조각 9개(students·approve·records·works·memories·quests·battle·settings·study) — 클래식, admin.js 바로 뒤
kiosk.html    / kiosk.js    / kiosk.css        키오스크(할 일 체크판) 화면
curriculum.js / curriculum_review.js           학습 문항 은행(국어·수학·사회) + 복습 문항 · CurriculumUtils
curriculum_reading.js                          국어 지문 세트(READING_PASSAGES·READING_ITEMS, 지문 20편×4문항)
figures.js                                     수학 문항 그림(SVG)
assets/monsters/                               몬스터 이미지 100장 (iconImg()가 이모지 폴백과 함께 표시)
assets/char · deco · floor · seeds · crops …   캐릭터 종이인형 84 · 장식 SVG · 바닥 타일 · 씨앗 등
village/                                       우리 마을: index.html · sync.js(원격 저장층) · vendor/three.module.js
watercolor/                                    수채화·데생 앱
art/ coding/ ink/ music/ paint/ pattern/ print/ thinkboard/ scan/ common/   하위 앱 · 공통 뼈대(위 표)
scripts/verify-safety.mjs                      저장 안전 정적 검증 스크립트 (Node 기본 모듈만)
scripts/smoke-test.mjs                         로컬 HTTP/정적 구조 smoke-test (캐시버스터는 html에서 읽어 교차검증)
scripts/unit/run.mjs                           student.js(+student/*.js) 순수 함수 단위 테스트(함수 본문만 떼어 vm 실행)
scripts/unit/student-sources.mjs               학생 코드 읽기 단일 출처(student.html 의 script 순서) — 학생 코드를 읽는 시험은 이걸로
scripts/unit/precheck.mjs [--no-deco]          PR 전 검사 한 번에(아래 검사 전부 + 하위 앱 시험을 저절로 모음)
scripts/unit/buster-check.mjs [base] [head]    캐시버스터 누락 검사(머지 뒤 값 기준, git 읽기만 · 하위 앱 index.html · common/ 포함)
scripts/unit/global-dup-check.mjs              한 페이지 클래식 스크립트끼리 최상위 function/const 이름 겹침
scripts/unit/esc-parity.mjs                    escHtml · escJsAttr · safeUrl 복사본들이 같은 결과를 내나
scripts/unit/<앱>/*.test.mjs                   하위 앱 시험(art · coding · ink · paint · pattern · print · thinkboard · common)
scripts/ci/check.yml                           CI 설정(node 22, 브라우저 없는 검사만) — .github/workflows/ 로 옮기면 켜짐
scripts/unit/whole-set-check.mjs               모음 통째 set 이 기준선보다 늘면 FAIL(동시 쓰기 유실 막기)
scripts/unit/gold-sync-sim.mjs · gold-loss-real-sdk/  골드 유실 재현(수정 뒤 --expect-fixed 로 0 확인)
scripts/unit/promo-sync-sim.mjs · settings-field-sim.mjs  승급 신청·설정 동시 쓰기 시뮬
scripts/village-backup.mjs · village-restore.mjs      마을 백업(읽기만)·한 학생 되살리기
scripts/village-sync/                          sync.js 가짜 RTDB 대조 시험
docs/                                          문서 — 색인은 docs/README.md
CNAME                                          GitHub Pages 커스텀 도메인 (funclassrpg.kr)
```

### 각 파일 역할

- **`gamedata.js`** — 모든 화면이 가장 먼저 로드하는 공유 레이어.
  - `GAME_DATA`: 게임 상수(기본 학생, 장비/몬스터/씨앗, expTable 등)
  - `Utils`: 공통 유틸. 날짜는 `Utils.todayStr()`(KST, `YYYY-MM-DD`), 주 시작은 `Utils.weekStartStr()`(KST, 일요일 시작)로 **단일 소스 통일**
  - `DB`: Firebase 연결·실시간 구독·정규화(`_normalizeArrays`/`_migrate`)·저장 helper(`saveStudent` 등)
- **`student.js` + `student/*.js`** — 학생 화면 로직. 2026-10-04 에 덩어리째 떼어 옮겼다(글자 그대로 · 전역 그대로 · [docs/module_architecture.md §16](docs/module_architecture.md)). student.js = 바탕(초기화·홈·쪽지·보상·상점·보스·농장·집 허브·인벤토리·퀘스트·업적·토스트) · `student/char.js` 캐릭터 그림 · `battle.js` 사냥·전투 · `deco.js` 꾸미기+친구 마당(html 태그 없이 꾸미기를 열 때 불러온다 — §17) · `art.js` 작품 · `emotion.js` 감정 · `reading.js` 독서 · `weekly.js` 주간 다짐 · `study.js` 단어장·오늘의 학습·숙달도
- **`admin.js` + `admin/*.js`** — 교사 관리 로직. 학생 편집, 퀘스트/보상 승인, 설정, 백업/가져오기/롤백/초기화. 덩어리째 떼어 옮겼다(글자 그대로 · 전역 그대로 · [docs/module_architecture.md §17](docs/module_architecture.md)). admin.js = 바탕(로그인·초기화·메뉴·대시보드·우리 마을·closeModal/notify) · `admin/students.js` 학생 목록·상세 창·학생 추가 · `admin/approve.js` 승인·승급 · `admin/records.js` 랭킹·능력치·활동 내역 · `admin/works.js` 작품·독서 · `admin/memories.js` 추억·리코더·업적 재계산·주간 다짐·데이터 정리 · `admin/quests.js` 비번 초기화·퀘스트·가져오기·개별 보상 · `admin/battle.js` 몬스터·전투 설정 · `admin/settings.js` 상점·과목·감정·백업·설정 · `admin/study.js` 학습 범위·생각판·학습 앱
- **`kiosk.js`** — 키오스크 로직. 퀘스트 신청/취소를 학생의 `pendingRewards` 경로만 **부분 저장**(전체 학생 객체 클로버 방지)
- **CSS 3종(`student.css` / `admin.css` / `kiosk.css`)** — 각 화면 전용 스타일. HTML에 인라인 `<style>` 없음
- **`scripts/verify-safety.mjs`** — 저장 안전/구조 정적 검증(아래 [안전 검증](#안전-검증))
- **`docs/`** — [참고 문서](#참고-문서)

### 로드 구조 (중요)

세 HTML 모두 **클래식 스크립트**로 로드한다 — `type="module"`/`async`/`defer`를 쓰지 않는다.

```
(Firebase compat SDK, Chart.js)  →  ./gamedata.js  →  ./<화면>.js
                                    student.html 은 ./student.js → ./student/char.js … ./student/study.js (8개, 모두 클래식)
```

- HTML에 인라인 `onclick`/`ontouchstart` 등 전역 함수·전역 변수에 의존하는 핸들러가 많다.
  → 스크립트를 모듈화하거나 `defer`로 바꾸면 **전역이 깨진다.** 평면 전역 스코프를 유지해야 한다.
- 캐시 무효화: 모든 JS/CSS에 `?v=<날짜><접미>`를 붙인다(예: `student.js?v=20260915q1a`).
  - **html 한 곳만 고친다**(smoke-test가 html에서 읽는다, #205).
  - `gamedata.js`·`curriculum.js`처럼 여러 화면이 쓰는 파일은 student·admin·kiosk html(gamedata 는 `watercolor/index.html` 까지)에서 **같은 값으로 함께** 올린다. `buster-check` 가 다르면 FAIL 을 낸다.
  - 한 페이지의 클래식 스크립트는 전역 하나를 나눠 쓴다 → 다른 파일과 같은 최상위 `function` 이름을 쓰면 뒤 파일이 말없이 덮는다(`global-dup-check` 가 잡음).
  - 충돌이 안 났어도 main보다 앞선 값인지 눈으로 확인한다(같은 값으로 조용히 병합되면 옛 캐시가 배포된다).

---

## 실행 방법

빌드 단계가 없다. 정적 파일을 그대로 브라우저가 열면 된다.

로컬 확인은 간단한 정적 서버 사용을 권장한다(상대경로/브라우저 보안정책 안정):

```bash
python3 -m http.server 8800
# → http://localhost:8800/student.html (admin.html / kiosk.html)
```

### `file://` 직접 열기 주의점

- 상대경로 스크립트(`./gamedata.js`)는 `file://`에서도 로드되지만, 정적 서버로 여는 편이 안정적이다.
- **더 중요한 주의**: 로컬에서 열든 운영에서 열든, 앱은 **동일한 실제 운영 Firebase DB(`classRPG_v3`)에 연결**된다.
  별도 로컬/모의 DB가 없다. 따라서 로컬에서 저장·승인·초기화 등을 실행하면 **운영 데이터가 그대로 바뀐다.**
  코드 검증은 읽기/정적 점검 위주로 하고, 쓰기 동작은 실행하지 않는다.

---

## 운영/배포

- **GitHub Pages**로 배포된다. 저장소: `chang333787-boop/class-rpg`
- 커스텀 도메인: **`funclassrpg.kr`** (루트 `CNAME` 파일에 지정됨)
- `main` 브랜치에 머지하면 GitHub Pages가 갱신된다(반영까지 보통 1~3분 지연).
- 운영 반영 확인은 캐시버스터로 한다(쓰기·버튼 클릭 없이 GET만):

```bash
curl -s "https://funclassrpg.kr/student.js?v=20260602&cb=$(date +%s)"
```

---

## Firebase 데이터 구조 요약

루트 키 `classRPG_v3` 아래에 학급 전체 상태가 모여 있다(주요 노드):

| 노드 | 내용 |
|---|---|
| `students` | 학생별 객체(경험치·골드·레벨·스탯·인벤토리·집/농장·작품 등). **`pendingRewards`는 학생 객체 내부의 배열** |
| `questLogs` | 퀘스트 수행 로그 |
| `boardQuests` | 게시판(공용) 퀘스트 |
| `promotionRequests` / `pwResetRequests` | 승급 요청 / 비밀번호 재설정 요청 |
| `artworks` | 학생 작품 |
| `emotionLogs` | 감정 기록 |
| `settings` | 학급 설정(반 이름, 보스, 보상 기준 등) |
| `customMonsters` / `customQuestTemplates` / `hiddenQuestTemplates` | 교사 커스텀/숨김 항목 |
| `studentNotes` | 교사가 학생마다 써 준 쪽지(`studentNotes/<sid>/<noteId>`, 비밀번호 칸 없음) |
| `backups` | **옛 위치**(읽기 폴백만). 새 백업은 루트 밖 `classRPG_backups`에 쓴다 |

- `classRPG_v3` 밖의 루트 키: `classRPG_adminPw`(관리자 인증값) · `classRPG_backups`(백업 스냅샷, BACKUP_NODES 23개 노드) · `classRPG_villages/<sid>`(마을 원격 저장 — `village/sync.js`, 2026-09-14 VILLAGE-45 로 연결) · `classRPG_<앱>`(하위 앱마다 하나, [하위 앱](#하위-앱-폴더마다-indexhtml-하나) 표).
- **비밀번호 값은 문서·쪽지·커밋 어디에도 적지 않는다.**
- REST로 직접 읽을 때: 배열 필드는 객체맵으로 올 수 있다(`Array.isArray` 확인 후 `Object.values`). `students`는 숫자 키 옛 사본과 id 키 본이 함께 있으니 **id로 중복 제거**한다.
- **저장 안전 원칙**: 루트 전체 쓰기(`_fbRef.set/remove/update`)는 학생 데이터 클로버 위험(footgun)이라 일반 작업에서 금지한다.
  단일 노드만 바꿀 땐 `child('...')` 부분 저장을 쓴다(예: kiosk의 `child('students/<id>/pendingRewards').set(...)`).
- **루트 쓰기가 허용되는 곳은 의도된 게이팅 경로뿐**: 데이터 가져오기(import) / 백업 롤백 / 전체 초기화(reset, 비밀번호 확인) / 전체 수치 초기화 / 빈 DB 최초 부트스트랩.
  이 경로들은 검증 스크립트에서 수동 확인 대상(REVIEW)으로 남는다.

---

## 안전 검증

저장 footgun과 구조 회귀를 막기 위한 정적 검증 스크립트가 있다(외부 의존성 0, Node 기본 모듈만):

```bash
node scripts/verify-safety.mjs
```

- 작업 **시작과 끝**에 실행한다. `FAIL`이 1개라도 있으면 중단한다.
- 현재 기대 결과: **`PASS 35 · REVIEW 1 · FAIL 0`** (exit code 0 · student 나누기로 18→26 = `node --check` student/*.js 8개 · admin 나누기(R3)로 26→35 = admin/*.js 9개)
- 함께 돌리는 것: `node scripts/smoke-test.mjs` → **`PASS 31 · REVIEW 0 · FAIL 0`** · `node scripts/unit/run.mjs` → **`PASS 331 · FAIL 0`** (2026-10-04 기준 · smoke 30번째 = student/ 폴더 js 가 모두 student.html 에 있나 [SPLIT-1] · 31번째 = admin/ 폴더 js 가 모두 admin.html 에 있나 [ADMIN-SPLIT-1])
- **PR 전 한 번에**: `node scripts/unit/precheck.mjs --no-deco` → **`PASS 26 · REVIEW 1 · FAIL 0 · SKIP 1`** (약 10초 · R5 공통 뼈대 시험 · cur-alias · deco-lazy 검사가 더해져 26 · admin 나누기 뒤에도 같음).
  smoke · verify-safety · unit · buster-check · whole-set · save-order · char-combo · deco-bundle · global-dup · 시뮬 다섯(esc-parity 포함) · 밸런스 둘 ·
  하위 앱 시험 9개(공통 뼈대 포함)를 따로 프로세스로 돌려 한 줄씩 보여 준다. REVIEW 1 = save-order 11곳 기준선. SKIP 1 = 꾸미기 하네스(헤드리스 크롬, `--deco` 로 켬 · 꾸미기 파일을 고치면 저절로 켜짐).
  저장 경로를 건드렸으면 `--gold` 도(골드 유실 시뮬 · 지금 main 에서는 REPRO 가 정상이라 REVIEW).
- 하위 앱 시험만: `for f in $(find scripts/unit -name '*.test.mjs' | sort); do node "$f" | tail -1; done` → 9개 모두 FAIL 0(2026-10-04 · 하위 앱 382 + 공통 뼈대 46 = 428개).
- **CI(준비됨 · 아직 꺼짐)**: `scripts/ci/check.yml` — PR · main push 마다 verify-safety · smoke-test · precheck --no-deco · 하위 앱 시험(node 22 · 비밀값 없음 · 브랜치 보호 없음 — 결과만 보여 줌).
  GitHub 은 `.github/workflows/` 안의 파일만 돌린다. 세션 토큰에 `workflow` 권한이 없어 거기로 못 올렸으니, 켤 때 사용자가 `git mv scripts/ci/check.yml .github/workflows/check.yml` 뒤 push(또는 웹에서 새 파일).
- 남은 `REVIEW 1`건 = 루트 쓰기 후보(`gamedata.js` 1 + `admin.js` 4). 전부 위의 **의도된 게이팅 경로**다.
  0으로 강제하지 않는다 — 강제하면 새로 추가되는 진짜 루트 쓰기를 못 잡는 사각이 생긴다. **안전 알림으로 유지**한다.

검증 시 점검하는 주요 항목: 필수 파일 존재, `node --check` 문법, `DB.save(`/`this.save(` 0건,
kiosk `pendingRewards` 부분 저장, HTML 로드 순서/클래식 로드, 날짜 helper Utils 통일, kiosk 정규화 통일,
HTML 인라인 `<script>`/`<style>` 잔여 등.

---

## 작업 원칙

리팩토링/안정화 작업은 다음 규칙을 따른다(상세는 `docs/rpg_refactor_safety_rules.md`).

- **협업 방식**(2026-09~): 학교 Windows에서 Claude Code "보스" 세션이 조율하고 조수 세션들이 worktree에서 PR을 올린다. **머지는 보스만.** 사용자 결정(가격·로그인·데이터 삭제·규칙 게시)은 사용자가 한다. 맥북 쪽은 GPT 감독(CLAUDE.md §3).
- 메인 clone은 항상 `main`, 작업은 `git worktree`로 따로.
- **한 작업 = 한 목표**. 기능 추가와 리팩토링을 한 작업에 섞지 않는다.
- `git checkout main && git pull --ff-only`로 시작, read-only 조사 먼저, 작은 수정, 시작/끝 검증.
- `git add .` **금지** — 변경한 특정 파일만 add 한다.
- PR 생성 후 **자동 머지 금지**. 사용자/GPT 승인 후 머지하고, **보고 후 정지**한다.
- Firebase write·운영 버튼 클릭으로 검증하지 않는다. 로드/정적/`typeof`/grep으로 대체한다.
- `gh` CLI가 PATH에 없을 수 있다 → PR 작업은 `~/bin/gh`를 우선 사용한다.

---

## 고위험 주의 영역

아래는 건드리기 전에 별도 승인 + 조사가 필요한 영역이다(현재 보류).

- **Firebase 루트 구조 변경 / 실데이터 마이그레이션**
- `pendingRewards` 배열 → 객체맵 전환(student/admin/kiosk 광범위 영향)
- `student.js`의 `buildMainHTML`(메인 화면, 길고 강결합) 분해
- 전투/몬스터 로직, canvas/SVG 렌더(픽셀 회귀 위험)
- `GAME_DATA`/데이터 상수 대구조, `_normalizeArrays`/`_migrate` 내부 로직 대수정(kiosk가 함수만 빌려 씀 — 순수성 유지 필요)
- 대규모 인라인 `onclick` → `addEventListener` 전환(전역 핸들러 다수)

---

## 참고 문서

- `docs/rpg_refactor_safety_rules.md` — **현행 안전 규칙**(저장 규칙·날짜/정규화·캐시 버전·고위험 보류·검증 절차)
- `docs/rpg_teacher_operation_guide.md` — 교사용 운영 가이드(마을·쪽지·작품·국어·별과 복습 포함)
- `docs/worklog/` — 날짜별 작업 기록. `docs/worklog/README.md`에 커밋 제목으로 못 찾는 기록 색인
- `docs/rpg_refactor_codex_handoff.md` — 과거 인수인계/이력 배경(참고용, 일부 옛 기준 포함)

---

## 현재 안정화 상태

- 리팩토링 1차 마감 commit: `7c3350e` (2026-07)
- 2026-10-04 main 기준: `verify-safety` 18/1/0 · `smoke-test` 29/0/0 · `unit/run` 279/0 · `whole-set-check` 14/0 · `buster-check` FAIL 0 · `global-dup-check` FAIL 0 · `precheck --no-deco` 23/1/0/SKIP 1 · 하위 앱 시험 380/0
- 알려진 미해결: `gold-sync-sim` 은 지금 코드에서 🔴 REPRO(골드 유실 재현 — 2026-10-04 에 다시 돌려도 같음). 수정 PR(#288) 뒤 `--expect-fixed` 로 0 확인
- 마을 서버 저장: #214(마을 45차 · sync.js 연결)는 '규칙 게시 뒤 머지' 조건으로 2026-09-14 main 에 들어갔다(VILLAGE-45). 실제 규칙 상태는 Firebase 콘솔에서만 확인한다(저장소 검사로는 못 봄)
- JS/CSS 외부화 완료, HTML 인라인 `<script>`/`<style>` 잔여 **0건**
- `DB.save(`/`this.save(` 0건, 루트 저장 위험 정리됨
- 날짜 기준·kiosk 정규화 단일 소스 통일 완료
- 보안 Phase1(익명 Auth + 규칙)은 설계 단계, 결정은 사용자
