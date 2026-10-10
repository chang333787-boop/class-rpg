#!/usr/bin/env bash
# 넣기 전 확인 한 번에 [GATE-1] — PR 을 main 에 넣기 전에 이것 하나를 돌린다.
#
#  사용: scripts/gate/checkall.sh <작업 폴더> [이름표]        포트: GPP(가짜 서버 · 기본 8971) · GDP(크롬 · 기본 9651)
#  작업 폴더 안에서 차례로:
#   ① 바뀐 JS 만 node --check (기준 = origin/main 과 갈라진 곳 · 아직 커밋 안 한 것 · 새 파일까지)
#   ② verify-safety  ③ smoke-test  ④ precheck --no-deco  ⑤ buster-check
#   ⑥ scripts/unit/**/*.test.mjs 하나씩(실패만 보여 줌)  ⑦ gold-sync-sim --expect-fixed(있으면 · 유실 · 중복 지급이 하나라도 있으면 FAIL)
#   ⑧ 확인 장치 scripts/gate/gate.mjs — 헤드리스 크롬으로 학생 · 관리 · 키오스크 · 학습 앱 화면을 실제로 누른다(가짜 DB · 운영 0).
#      ①~⑦ 과 함께 뒤에서 돈다(약 80초). 작업 폴더에 장치가 없으면(옛 체크아웃) 이 저장소의 장치로 --repo 를 준다.
#  끝줄: '결과: ✅ 모두 통과' 또는 '결과: ❌ 실패 — …' (exit 0 / 1). 전체 출력은 끝에 적힌 폴더(TMPDIR 아래)에.
#  git 은 읽기만 한다(fetch 도 안 함 — 기준을 새로 하려면 먼저 git -C <작업 폴더> fetch origin).
set -u
WT_IN="${1:-}"
if [ -z "$WT_IN" ] || [ ! -d "$WT_IN" ]; then echo "사용: $0 <작업 폴더> [이름표]   (포트: GPP=8971 GDP=9651)"; exit 2; fi
WT="$(cd "$WT_IN" && pwd)"
LABEL="${2:-$(basename "$WT")}"
HERE="$(cd "$(dirname "$0")" && pwd)"
GPP="${GPP:-8971}"; GDP="${GDP:-9651}"
[ -f "$WT/student.html" ] || { echo "우리반 RPG 저장소가 아니에요: $WT"; exit 2; }
GATE="$WT/scripts/gate/gate.mjs"
[ -f "$GATE" ] || GATE="$HERE/gate.mjs"
SAFE_LABEL=$(printf '%s' "$LABEL" | LC_ALL=C tr -c 'A-Za-z0-9._-' '_')
LOG="${TMPDIR:-/tmp}/class-rpg-checkall/$SAFE_LABEL"
rm -rf "$LOG"; mkdir -p "$LOG"
T0=$(date +%s)
FAILED=""
fail() { FAILED="$FAILED · $1"; }
step() { printf '  %-15s %s\n' "$1" "$2"; }
#  시간 제한 실행(맥에는 timeout 명령이 없다): 넘으면 TERM(확인 장치는 TERM 에 크롬 · 서버를 끄고 멈춤) → 5초 뒤 KILL
run_to() {
  local secs="$1" out="$2"; shift 2
  ( cd "$WT" && exec "$@" ) >"$out" 2>&1 &
  local pid=$! t=0
  while kill -0 "$pid" 2>/dev/null; do
    if [ "$t" -ge $((secs * 10)) ]; then
      kill -TERM "$pid" 2>/dev/null; sleep 5; kill -KILL "$pid" 2>/dev/null
      echo "시간 초과(${secs}초)" >>"$out"; wait "$pid" 2>/dev/null; return 124
    fi
    sleep 0.1; t=$((t + 1))
  done
  wait "$pid"
}
summary() { grep -E "$2" "$1" 2>/dev/null | tail -1 | sed -E 's/^(요약|최종 결과): ?//'; }

HEAD_SHA=$(git -C "$WT" rev-parse --short HEAD 2>/dev/null || echo '?')
BR=$(git -C "$WT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')
BASE=$(git -C "$WT" merge-base origin/main HEAD 2>/dev/null || echo '')
echo "[GATE-1] 넣기 전 확인 — $LABEL · $WT · HEAD $HEAD_SHA ($BR) · 기준 origin/main $(git -C "$WT" rev-parse --short origin/main 2>/dev/null || echo '없음') · 포트 $GPP · $GDP"

# ⑧ 확인 장치는 먼저 뒤에서 시작(가장 오래 걸린다)
( cd "$WT" && GPP="$GPP" GDP="$GDP" PP="$GPP" DP="$GDP" exec node "$GATE" --repo "$WT" ) >"$LOG/gate.txt" 2>&1 &
GATE_PID=$!

# ① 바뀐 JS node --check
if [ -z "$BASE" ]; then step "node --check" "건너뜀(origin/main 과 갈라진 곳을 못 찾음)"; else
  CH=$( { git -C "$WT" -c core.quotepath=off diff --name-only --diff-filter=ACMR "$BASE" -- '*.js' '*.mjs'; git -C "$WT" -c core.quotepath=off ls-files --others --exclude-standard -- '*.js' '*.mjs'; } | sort -u )
  n=0; bad=""
  while IFS= read -r f; do
    [ -n "$f" ] && [ -f "$WT/$f" ] || continue
    n=$((n + 1))
    if ! node --check "$WT/$f" >>"$LOG/node-check.txt" 2>&1; then bad="$bad $f"; fi
  done <<EOF
$CH
EOF
  if [ -n "$bad" ]; then step "node --check" "❌ 바뀐 JS ${n}개 중 문법 오류:$bad"; fail "node --check"; else step "node --check" "바뀐 JS ${n}개 OK"; fi
fi

# ②~⑤ 정적 검사
for spec in "verify-safety|scripts/verify-safety.mjs|120|^요약:" "smoke-test|scripts/smoke-test.mjs|120|^요약:" \
            "precheck|scripts/unit/precheck.mjs --no-deco|300|^요약:" "buster-check|scripts/unit/buster-check.mjs|120|^요약:"; do
  name="${spec%%|*}"; rest="${spec#*|}"; cmd="${rest%%|*}"; rest="${rest#*|}"; secs="${rest%%|*}"; pat="${rest#*|}"
  if [ ! -f "$WT/${cmd%% *}" ]; then step "$name" "건너뜀(${cmd%% *} 없음)"; continue; fi
  # shellcheck disable=SC2086
  run_to "$secs" "$LOG/$name.txt" node $cmd; rc=$?
  s=$(summary "$LOG/$name.txt" "$pat")
  if [ $rc -ne 0 ]; then step "$name" "❌ ${s:-exit $rc}"; fail "$name"; else step "$name" "${s:-OK}"; fi
done

# ⑥ 하위 앱 · 공통 시험 하나씩(실패만)
TOTAL=0; TF=0; TLIST=""
while IFS= read -r f; do
  [ -n "$f" ] || continue
  TOTAL=$((TOTAL + 1))
  run_to 120 "$LOG/test-one.txt" node "$f"; rc=$?
  last=$(tail -1 "$LOG/test-one.txt")
  if [ $rc -ne 0 ] || printf '%s' "$last" | grep -Eq 'FAIL [1-9]'; then
    TF=$((TF + 1)); TLIST="$TLIST
      ✗ $f — $last"
    { echo "=== $f"; cat "$LOG/test-one.txt"; } >>"$LOG/tests-failed.txt"
  fi
done <<EOF
$(cd "$WT" && find scripts/unit -name '*.test.mjs' -not -path '*/node_modules/*' | sort)
EOF
if [ "$TF" -gt 0 ]; then step "*.test.mjs" "❌ ${TOTAL}개 중 실패 ${TF}$TLIST"; fail "*.test.mjs"; else step "*.test.mjs" "${TOTAL}개 모두 FAIL 0"; fi

# ⑦ 골드 유실 시뮬(있으면) — --expect-fixed: 유실 · 중복 지급 · 보상 사라짐 · 승인 반영 2초 넘음이 하나라도 있으면 exit 1
if [ -f "$WT/scripts/unit/gold-sync-sim.mjs" ]; then
  run_to 300 "$LOG/gold-sync-sim.txt" node scripts/unit/gold-sync-sim.mjs --expect-fixed; rc=$?
  s=$(summary "$LOG/gold-sync-sim.txt" '^최종 결과:')
  if [ $rc -ne 0 ]; then step "gold-sync-sim" "❌ ${s:-exit $rc}"; fail "gold-sync-sim"; else step "gold-sync-sim" "${s:-OK}"; fi
else step "gold-sync-sim" "건너뜀(없음)"; fi

# ⑧ 확인 장치 기다리기(장치 안에 175초 제한 · 여기서는 240초까지)
while kill -0 "$GATE_PID" 2>/dev/null; do
  if [ $(( $(date +%s) - T0 )) -ge 240 ]; then
    kill -TERM "$GATE_PID" 2>/dev/null; sleep 5; kill -KILL "$GATE_PID" 2>/dev/null
    echo "NOT CLEAN — checkall 이 240초에 확인 장치를 멈춤" >>"$LOG/gate.txt"; break
  fi
  sleep 0.2
done
wait "$GATE_PID" 2>/dev/null; grc=$?
gline=$(grep -E '^(NOT CLEAN|CLEAN) — ' "$LOG/gate.txt" | tail -1)
if [ "$grc" -ne 0 ] || [ "${gline#CLEAN}" = "$gline" ]; then step "gate" "❌ ${gline:-exit $grc}"; fail "gate"; else step "gate" "$gline"; fi
grep -E '^(자기 시험|학생|관리|키오스크|학습 앱|바깥 호스트|참고)' "$LOG/gate.txt" | sed 's/^/      /'
if grep -q '^── 찾은 것 ──' "$LOG/gate.txt"; then sed -n '/^── 찾은 것 ──/,/^\(NOT \)\{0,1\}CLEAN — /p' "$LOG/gate.txt" | grep -E '^  \[' | sed 's/^/    /'; fi

SEC=$(( $(date +%s) - T0 ))
if [ -z "$FAILED" ]; then echo "결과: ✅ 모두 통과 — $LABEL · ${SEC}초"; exit 0; fi
echo "결과: ❌ 실패 —${FAILED#' ·'} · $LABEL · ${SEC}초 (전체 출력: $LOG)"
exit 1
