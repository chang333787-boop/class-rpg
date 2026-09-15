# 밸런스 시뮬 게이트 (B-3)

앱의 `gamedata.js` 를 Node vm 으로 그대로 불러 **실제 전투 엔진 함수**로 싸우고, 승률·골드 흐름 표와 목표 곡선 판정을 낸다.
운영 Firebase 접근 0 · 쓰기 0. 공식 설명은 [`docs/rpg_balance_model.md`](../../docs/rpg_balance_model.md).

```
node scripts/balance/gate.mjs                                                   # 코드 기본 계수
node scripts/balance/gate.mjs --settings scripts/balance/settings/prod-20260915.json   # 운영 계수(09-15 읽기)
node scripts/balance/gate.mjs --gamedata <옛 gamedata.js>                        # 옛 커밋과 비교
```

옵션 `--n 400`(칸당 판 수) · `--seed 20260915` · `--max 20` · `--strict`(G1~G5 하나라도 어긋나면 exit 1). 약 12초.
난수 씨앗을 고정하므로 같은 입력이면 **같은 표**가 나온다.

## 무엇을 재나
- 장비 3등급: **맨몸**(장비 0, 노말 1) · **무기만**(그 레벨 최고 검 + 노말 최고 권) · **풀장비**(5칸 그 레벨 최고 물리형 + 노말 최고 권)
- 몬스터 레벨 차 −1·0·+1·+2·+3 (같은 사냥터 밖은 `—`), 카드1·2·3 평균, 풀장비 기준 하루 전투 골드 vs 새 장비값
- 싸움: 노말 공격만, HP 35% 아래에서 응급치료 1회, 80턴 넘으면 패배

## 판정 (목표는 작전 2026-09-15 **제안값** — 운영 값 변경은 사용자 결정)
| # | 기준 |
|---|---|
| G1 | 같은 Lv 풀장비 65~80% |
| G2 | 같은 Lv 무기만 45~60% |
| G3 | 같은 Lv 맨몸 25~40% |
| G4 | 같은 Lv 승률의 인접 레벨 차 15%p 이하 (3등급 모두) |
| G5 | Lv+3 풀장비 30~45% |

## 기준선 (2026-09-15 B-4 정정 뒤, main 9d1448c, 칸당 400판)
| 계수 | G1 | G2 | G3 | G4 | G5 | 통과 |
|---|---|---|---|---|---|---|
| 코드 기본값 | 0/20 | 0/20 | 0/20 | 57/57 ✅ | 1/14 | 1/5 |
| 운영(HP×1.5·ATK×1.6) | 1/20 | 2/20 | 0/20 | 44/57 | 3/14 | 0/5 |
| (#173 이전 gamedata, 기본, Lv1~10, 200판) | 0/10 | 0/10 | 0/10 | 25/27 (Lv2→3 +100%p) | 1/7 | 0/5 |

B-4 정정: 학생 기본 def 를 6→0 으로(실학생 combat = 장비 합). 운영 행이 G2 3→2 · G4 46→44 로 바뀜.
지금 계수로는 목표를 못 맞춘다. **B-4 결론: G1~G3 동시 목표는 이 전투 구조에서 계수로 도달 불가** — `docs/rpg_balance_b4_proposal_20260915.md`.
G3(맨몸)은 계수만으로는 불가 — ATK 가 장비에서만 나오고 최소 피해가 1이라 맨몸 승률은 0% 고정(B-1 §1).

## 계수 제안 시뮬 (B-4)
```
node scripts/balance/gate.mjs --settings scripts/balance/settings/prod-20260915.json --proposal scripts/balance/proposals/s1-difficulty-2x.json
```
`proposals/*.json` = `{ name, settings, balance, patches, growth }` — 전부 **메모리에서만** 적용(gamedata.js·운영 설정은 안 바뀜).
`balance` 는 `BALANCE` 깊은 병합, `patches`·`growth` 는 코드에 아직 없는 **구조 제안**이라 적용하려면 코드 PR 이 필요하다.

## 출력 동일 대조표 (B-2 구조 리팩토링용)

```
node scripts/balance/identity.mjs                      # A = origin/main gamedata.js, B = 작업 폴더 gamedata.js
node scripts/balance/identity.mjs --a <파일> --b <파일>
```

같은 씨앗·같은 입력으로 두 벌을 돌려 **① 정적 표 ② 계산 함수 ③ 전투 기록(매 행동 뒤 상태·로그 문구) ④ 사냥터 카드 ⑤ 경계값(난수를 문턱값 ±1e-9로 고정)** 과
Math.random 호출 횟수를 관리자 설정 4벌(없음·운영·전 키 극단값·극단값 뒤 없음)마다 sha256 으로 비교한다. 하나라도 다르면 exit 1. 약 25초.
감도 확인: 급소율 0.10→0.11, 0.10→0.1000001, 최근 등장 가중 0.6→0.61 세 변형을 모두 ❌ 로 잡는다.
계수를 옮기거나 파생식으로 바꾸는 PR은 이 표가 전부 ✅ 여야 한다.

## 참고 프로필 — 최신장비 (판정 밖)
칸마다 **그 레벨의 가장 최근 등급**(Lv7·13·20 마력형 포함)·스태프·불 몸통, 노말·속성 스킬북 그 레벨 최고 권, 몬스터마다 **기대 피해가 가장 큰 공격**.
실학생 절반이 마력형이라 합성 "물리 풀장비"만으로는 현실과 어긋나서 넣었다(아이 데이터는 안 쓰고 규칙으로만). G1~G5 판정·기존 표에는 안 들어간다(기존 표 바이트 동일 확인).
운영 설정 카드1/2/3 평균: 물리 풀장비 99/91/70% · **최신장비 100/97/85%**, S1(×2.0)에서도 최신장비 93/78/57% — **속성 3종을 다 배우면 늘 유리 상성(×1.4)을 골라 쳐서 물리보다 훨씬 세다**(Lv7 이후 마력형 등급에서 MAG 가 크게 뛴다).

## PR 사전 검사용 빠른 모드 (--quick)
| 명령 | 시간 | 보는 것 | exit |
|---|---|---|---|
| `node scripts/balance/identity.mjs --quick` | 약 2초 | main 대비 **밸런스 출력 동일**(GAME_DATA 전체·스킬북·계산 함수·전투 기록 일부·카드·경계값, 설정 없음·운영 2벌) | 다르면 1 |
| `node scripts/balance/identity.mjs --quick --review` | 〃 | 같은 비교, **값을 일부러 바꾸는 PR** 용 — 다르면 `요약: REVIEW` | 늘 0 |
| `node scripts/balance/gate.mjs --quick --settings scripts/balance/settings/prod-20260915.json` | 약 1.5초 | **회귀 경보** Q1 같은 Lv 물리 풀장비 최저 ≥50% · Q2 Lv1·2 ≥90% · Q3 절벽 ≤35%p | 걸리면 1 |

감도 확인(2026-09-15): identity quick — 장비 가격 1G(`priceAdj +7→+8`) ❌2항목 · 급소율 +1e-7 ❌7항목. gate quick — #173 이전 gamedata(Lv1~2 0%) ❌Q2·Q3 · 몬스터 HP 곡선 기울기 6.53→9 ❌Q3. main 은 둘 다 ✅.
마지막 줄 `요약: …` 은 `scripts/unit/precheck.mjs` 가 읽는 모양(연결은 precheck 담당 세션).
