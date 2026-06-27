#!/usr/bin/env bash
# Liveness + readiness.
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tests/lib.sh
. "$DIR/lib.sh"

section "health endpoints"

status=$(curl -s -o /tmp/router-test-health.json -w "%{http_code}" "$BASE_URL/health")
assert_eq "GET /health -> 200" "200" "$status"
assert_eq "GET /health body status field" "ok" "$(bunx jq -r .status /tmp/router-test-health.json)"

status=$(curl -s -o /tmp/router-test-ready.json -w "%{http_code}" "$BASE_URL/ready")
assert_eq "GET /ready -> 200" "200" "$status"
assert_eq "GET /ready body status field" "ok" "$(bunx jq -r .status /tmp/router-test-ready.json)"
cache_state=$(bunx jq -r .cache /tmp/router-test-ready.json)
case "$cache_state" in
  connected|disabled)
    PASS_COUNT=$((PASS_COUNT + 1))
    _log PASS "GET /ready cache field is connected|disabled (got '$cache_state')"
    ;;
  *)
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAIL_NAMES="${FAIL_NAMES}/ready cache field\n"
    _log FAIL "GET /ready cache field unexpected: '$cache_state'"
    ;;
esac
