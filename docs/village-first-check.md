# 우리 마을 온라인 저장 — 운영 첫 확인 절차서

> **언제**: Firebase 규칙 게시 → PR #214(마을 45차) 머지 → GitHub Pages 배포가 끝난 **직후 한 번.**
> **왜**: 에뮬레이터로 전부 확인했지만 에뮬레이터 ≠ 운영입니다(CORS · keepalive · 규칙 실제 적용). 아이들이 쓰기 전에 시험 계정으로 한 바퀴.
> **누가**: 로그인·비밀번호·클릭 = **선생님** · 읽기(GET) 확인 = **보스/조수** · 실패하면 되돌리기 판단 = **보스**.
> 걸리는 시간: 약 15분. 준비물: 교사 PC 1대 + (5번용) 크롬북 1대 또는 같은 PC의 시크릿 창.

시험 계정: **"시험"** · sid **`s1774671589091`** (아래 명령의 `SID`).
읽기 명령은 저장소 폴더의 Git Bash 에서 복사해 쓰면 됩니다. 전부 **GET** 이라 운영에 아무것도 안 씁니다.
```bash
DB=https://class-rpg-6f409-default-rtdb.asia-southeast1.firebasedatabase.app
SID=s1774671589091
```

---

## 0. 문 열기 전 확인 (보스)
| 확인 | 명령 | 합격 |
|---|---|---|
| 규칙이 게시됐다 | 선생님이 콘솔 규칙 탭에 `classRPG_villages` 조각이 보이는지 한 번 봄 | 보임 |
| #214 가 main 에 들어갔다 | `gh pr view 214 --json state -q .state` | `MERGED` |
| Pages 가 그 커밋으로 배포됐다 | `gh api repos/chang333787-boop/class-rpg/pages/builds/latest -q '.status+" "+.commit[0:7]'` | `built <main 끝 커밋>` |
| 배포된 마을이 45차다 | `curl -s https://funclassrpg.kr/village/index.html \| sha256sum` | `a3ae9d35…` 로 시작 |
| 배포된 sync.js 가 저장소 원본이다 | `curl -s https://funclassrpg.kr/village/sync.js \| sha256sum` | `cedd2743…` 로 시작 |
| 시작 전 비어 있다 | `curl -s "$DB/classRPG_villages/$SID.json"` | `null` (이미 있으면 적어 두고 진행) |

## 1. 백업 먼저 (보스)
```bash
node scripts/village-backup.mjs --out "<백업을 둘 폴더>"
```
합격: `되읽기 확인: 받은 것과 같음 ✅`. 파일 이름을 적어 둡니다.

## 2. 첫 열기 (선생님 → 보스)
1. **선생님**: 교사 PC 에서 `funclassrpg.kr/student.html` → 시험 계정 로그인 → 홈 **🏘️ 우리 마을** → 마을이 모달로 뜸
2. **보스**: 3초 뒤
   ```bash
   curl -s "$DB/classRPG_villages/$SID/session.json"
   curl -s "$DB/classRPG_villages/$SID/meta.json"
   ```

| 합격 | 불합격이면 |
|---|---|
| `session` 에 `dev`(`d-…`) · `at`(숫자) | `null` → 브라우저 개발자 도구 콘솔에서 `VillageSync.boot` 경고 확인 → **5-1 로** |
| `meta` 가 `null` 이어도 됨(아직 아무것도 안 지음 — 새 판은 지을 때 올라감) | `meta` 에 에러 문자열 → 규칙 거부. **5-2 로** |

## 3. 짓기 → 올라가는지 (선생님 → 보스)
1. **선생님**: 길을 10칸쯤 긋고 **5초 가만히** 둠
2. **보스**:
   ```bash
   curl -s "$DB/classRPG_villages/$SID/plots.json?shallow=true"
   curl -s "$DB/classRPG_villages/$SID/meta/savedAt.json"
   curl -s "$DB/classRPG_villages/$SID/meta/palette.json"
   ```

| 합격 | 불합격이면 |
|---|---|
| 구역 키가 1개 이상(`{"4_4":true}` 같은 모양) | `null` → 5-2(규칙 거부) 또는 5-1(CORS) |
| `savedAt` 이 지금 시각 근처 숫자(13자리) | |
| `palette` 에 `"road"` | |

교사 화면 → **🏘️ 우리 마을** 새로고침: 시험 계정이 **있음 · 구역 1+ · 🟢 열려 있음**.

## 4. 닫기 직전 변경이 도착하는지 — keepalive (선생님 → 보스)
1. **보스**: 지금 값 적기 — `curl -s "$DB/classRPG_villages/$SID/meta/savedAt.json"`
2. **선생님**: 길을 한 줄 더 긋고 **1초 안에 ✕** 로 닫음
3. **보스**: 3초 뒤 같은 명령을 다시

| 합격 | 불합격이면 |
|---|---|
| `savedAt` 이 1에서 적은 값보다 **커짐** | 그대로면 keepalive 가 운영에서 막힌 것. **데이터는 안 잃습니다** — 다음에 열 때 올라갑니다(설계상 성립). 6번에서 그 줄이 보이면 통과로 봄. 보고에 "keepalive 운영 미도착" 적기 |

## 5. 다른 기기에서 같은 마을 (선생님)
1. 크롬북(또는 같은 PC **시크릿 창** — 기기 저장소가 따로라 다른 기기 흉내가 됩니다)에서 시험 계정 로그인 → 🏘️
2. 교사 PC 에서 ✕ 로 닫았으면 **물음 없이** 바로 열림(닫을 때 `session/at` 을 0 으로 비움). 창을 닫지 않았거나 닫기 신호가 막혔으면 **"다른 기기에서 마을이 열려 있어요. 여기서 계속할까요?"** → **확인** (보고에 "닫기 신호 미도착" 적기)

| 합격 | 불합격이면 |
|---|---|
| **3·4번에서 그은 길이 그대로** 보임 | 빈 판 → 원격을 못 받음. 보스가 3번 명령으로 원격에 구역이 있는지부터 |
| 교사 PC 창(열어 뒀다면)에 "다른 기기에서 마을을 열었어요" | 안 뜨면 실시간 감시(EventSource) 문제 — 쓰기는 멈추므로 데이터 위험은 없음, 보고만 |

## 6. 되돌아가서 한 번 더 (선생님 → 보스)
1. 5번 기기에서 나무 몇 개 놓고 5초 기다린 뒤 닫기
2. 교사 PC 에서 다시 🏘️ → **5번의 나무가 보이면 합격**(교사 PC 는 "원격이 더 새것"을 받음)
3. **보스**: `curl -s "$DB/classRPG_villages/$SID/meta/palette.json"` → `road` 뒤에 새 종류가 **붙어** 있음(순서가 바뀌지 않음)

## 7. 끝내기 (보스)
- 교사 화면 🏘️ 우리 마을: 시험 계정 **있음 · 닫힘**(✕ 로 닫았으면 바로, 아니면 90초 뒤)
- 백업 한 번 더: `node scripts/village-backup.mjs --out …` → 시험 계정이 목록에 보임
- 시험 계정 마을은 **그대로 둡니다**(지우기는 데이터 삭제 — 필요하면 사용자 판단)
- 결과를 표로 보고: 0~6 각 칸 합격/불합격 + 불합격이면 무엇이 보였는지

---

## 문제가 생기면
### 5-1. 요청 자체가 안 나감 / CORS 에러
- 콘솔에 `blocked by CORS` · `Failed to fetch` → 운영 RTDB 가 브라우저 요청을 막는 것. **아이들에게 열기 전 멈춤.**
- 되돌리기: #214 를 되돌리는 PR(마을을 44차로). `sync.js` 는 남아도 44차 마을은 부르지 않습니다.

### 5-2. 규칙이 거부함(401 · `Permission denied`)
- 콘솔 규칙 플레이그라운드로 같은 경로·같은 데이터를 넣어 어느 줄이 막는지 확인.
- 흔한 원인: 조각을 붙이면서 따옴표·쉼표가 바뀜 · `classRPG_villages` 가 `rules` 안이 아니라 밖에 붙음.
- 규칙을 고칠 때까지 아이들 마을은 **기기 안에만 저장**됩니다(원격만 실패, 놀이는 계속).

### 5-3. 마을이 이상하게 됐다(물건이 섞임·사라짐)
- **학생 기기 저장소에 사본이 남습니다**(`rpg.village.<sid>.sync-backup`).
- 원격은 1번 백업으로: `docs/village-restore.md` 절차(마을 ✕ 로 닫은 뒤 — 닫기 신호가 막혔으면 90초 뒤, 보여 주기만 → `--apply --yes-production`).

---

## 이 절차가 확인하는 것 — 에뮬레이터에서 이미 본 것과의 대응
| 운영에서 볼 것 | 에뮬레이터 결과(2026-09-14) |
|---|---|
| 첫 열기 session 가져가기 | ✅ ETag·412 동작 |
| 짓기 → 바뀐 구역만 올림 | ✅ PATCH 여러 경로 · 규칙 걸고 실패 0 |
| 닫기 직전 keepalive | ✅ 도착(없으면 안 옴) |
| 다른 기기 → 같은 마을 · 옛 기기 구경 모드 | ✅ 69개 누락 0 · 1.5초 안에 구경 모드 |
| palette 뒤에 붙음 | ✅ `[road, tree, bush]` |
