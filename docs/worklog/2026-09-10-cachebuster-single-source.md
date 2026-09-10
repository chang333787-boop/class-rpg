# 2026-09-10 (기기: 학교 Windows) — 캐시버스터 단일 출처화 (BUSTER-1)

> 담당: 학습 조수 세션. 보스 2기 배정 35. 내가 제안하고 보스가 채택했다.
> 계기: 이날 rebase 8번 중 거의 전부가 **캐시버스터 충돌**이었다(#204에서는 `git checkout --ours`로 gamedata 캐시버스터가 통째로 날아가 smoke 34→31/3이 났다).

- **브랜치**: `chore/cachebuster-single-source` (worktree `C:\Users\USER\projects\class-rpg-wt-buster`, base `origin/main` ecebac5 = #204 포함)
- **변경**: `scripts/smoke-test.mjs` **한 파일뿐**. 앱 파일 무변경 → **캐시버스터 올릴 것 없음**.
- **smoke 기준선 34 → 28** (아래 ③ 참고)

## ① 무엇이 문제였나
캐시버스터를 올릴 때마다 **네 곳**을 같이 고쳐야 했다 — html 1곳 + `smoke-test.mjs` 3곳(요청 목록·`cssVer`·`jsVer`).
같은 줄을 여러 브랜치가 동시에 만지니 **rebase 충돌이 거의 매번 그 자리에서** 났고, 충돌을 푸는 과정에서 값이 날아가는 사고도 났다.

## ② 어떻게 바꿨나 — html이 단일 출처
`smoke-test.mjs`에서 하드코딩 3곳을 없앴다. 이제 **html에 적힌 것이 정답**이고 스크립트가 html에서 읽어 온다.

```js
const localRefs = (html) => [...html.matchAll(/(?:src|href)="([^"]+)"/g)] … // 외부 URL·data:·# 제외
// → { raw, file, ver } 로 쪼개 자산(js·css)과 페이지 링크(html)를 나눈다
```
HTTP 200 확인 목록도 이 파싱 결과로 만든다(전에는 14개를 손으로 적어 뒀다 → 지금도 14/14, 손으로 적지 않는다).

## ③ 검사를 잃지 않았다 — 오히려 강해졌다
단일 출처가 되면 "값이 스냅샷과 같은가"는 **자동 통과**라 무의미하다. 그 3종(파일당 3개 × 3파일 = 9개)을 버리고
**실제로 깨지는 자리** 세 가지를 본다(3개). 그래서 항목 수가 **34 → 28**로 줄었다. 숫자는 줄었지만 잡는 힘은 늘었다.

| | 새 검사 | 왜 필요한가 |
|---|---|---|
| ① | 여러 html이 같은 파일을 참조하면 **버전도 같아야** 한다 | `gamedata.js`를 student·admin·kiosk 셋이 참조한다. 한 곳만 올리고 빠뜨리면 **그 화면만 옛 코드**를 물고 돌아 재현이 어려운 버그가 된다 |
| ② | 참조한 파일이 **저장소에 실제로 있어야** 한다 | 경로 오타 방어 |
| ③ | js·css 참조에는 **`?v=`가 반드시 있어야** 한다 | 빠지면 학생 브라우저가 옛 파일을 계속 쓴다(배포해도 안 바뀌는 것처럼 보인다) |

**전에는 이 셋이 다 `REVIEW`였다** — REVIEW는 최종 결과를 막지 않아 그냥 지나간다. 이제 **`FAIL`**이라 막힌다.

## 검증 결과 — 일부러 깨뜨려 잡히는지 확인
통과만 보고 끝내지 않았다. 세 가지를 각각 깨뜨려 **FAIL이 뜨는 것을 보고** 되돌렸다.

| 깨뜨린 것 | 결과 |
|---|---|
| kiosk.html의 gamedata만 `?v=20260909z`로 | ❌ `공유 파일 캐시버스터 불일치: gamedata.js → student.html:20260910e / admin.html:20260910e / kiosk.html:20260909z` → PASS 27 · FAIL 1 |
| student.html에서 `figures.js` → `figuers.js` | ❌ `없는 파일 참조: student.html → ./figuers.js?v=20260903a` + ❌ `로컬 HTTP 비정상 1건: /figuers.js…(404)` → PASS 26 · FAIL 2 |
| admin.html의 `admin.css?v=…` → `admin.css` | ❌ `캐시버스터 없는 참조: admin.html → ./admin.css` → PASS 27 · FAIL 1 |

셋 다 되돌린 뒤 **PASS 28 · REVIEW 0 · FAIL 0** 복귀 확인. `git status`로 앱 파일에 잔여 변경이 없는 것도 확인했다.

- `node --check scripts/smoke-test.mjs` — 통과
- `node scripts/verify-safety.mjs` — **PASS 18 · REVIEW 1 · FAIL 0**(변동 없음)
- 통과 시 출력:
  - `공유 파일 2개의 캐시버스터가 html 사이에서 일치 (gamedata.js=20260910e×3, curriculum.js=20260909e×2)`
  - `html이 참조하는 로컬 파일 17건 모두 존재`
  - `js·css 참조 14건 모두 ?v= 캐시버스터 있음`

## 앞으로
**캐시버스터를 올릴 때 고칠 곳은 html 한 곳뿐이다.** `scripts/`는 건드리지 않는다.
여러 html이 쓰는 파일(`gamedata.js`·`curriculum.js`)은 **세 곳을 같이** 올려야 한다 — 빠뜨리면 ①이 FAIL로 잡는다.
