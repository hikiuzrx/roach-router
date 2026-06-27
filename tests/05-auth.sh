#!/usr/bin/env bash
# Auth path. Only runs if ROUTER_AUTH_TEST=1 — needs a server started with
# ROUTER_API_KEYS set. The runner handles spinning up a second server on a
# different port for this stage.
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tests/lib.sh
. "$DIR/lib.sh"

if [ "${ROUTER_AUTH_TEST:-0}" != "1" ]; then
  _log SKIP "auth tests (set ROUTER_AUTH_TEST=1 and AUTH_BASE_URL=...)"
  return 0 2>/dev/null || exit 0
fi

AUTH_URL="${AUTH_BASE_URL:-$BASE_URL}"
GOOD_KEY="${ROUTER_GOOD_KEY:-sk-test-1}"
BAD_KEY="sk-not-a-real-key"

section "auth gate"

status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$AUTH_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"hi"}]}')
assert_eq "no header -> 401" "401" "$status"

status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$AUTH_URL/v1/chat/completions" \
  -H "Authorization: Bearer $BAD_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"hi"}]}')
assert_eq "bad key -> 401" "401" "$status"

# Good key should at least get past auth; upstream may 502.
status=$(curl -s -o /tmp/router-test-auth-good.json -w "%{http_code}" \
  -X POST "$AUTH_URL/v1/chat/completions" \
  -H "Authorization: Bearer $GOOD_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"hi"}]}' \
  --max-time 30)

case "$status" in
  401)
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAIL_NAMES="${FAIL_NAMES}good key -> not 401\n"
    _log FAIL "good key returned 401 (auth misconfigured?)"
    ;;
  *)
    PASS_COUNT=$((PASS_COUNT + 1))
    _log PASS "good key passed auth (status=$status)"
    ;;
esac
