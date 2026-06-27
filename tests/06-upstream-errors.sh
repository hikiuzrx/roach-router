#!/usr/bin/env bash
# Upstream errors must be:
#   - clean OpenAI envelope { error: { message, type, code } }
#   - free of provider account fingerprints (ak-/sk-/org- ids)
#   - never wrapped in "<provider> upstream <code>: ..." prose
# Depends on the test accounts in .env actually returning a non-2xx (suspended /
# free-tier exhausted). On a healthy account these tests are skipped.
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tests/lib.sh
. "$DIR/lib.sh"

section "upstream error envelope"

body_file="/tmp/router-test-upstream-err.json"
status=$(curl -s -o "$body_file" -w "%{http_code}" \
  -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"hi"}]}')

if [ "$status" = "200" ]; then
  _log SKIP "upstream returned 200 (account healthy) — nothing to check"
  return 0 2>/dev/null || exit 0
fi

if [ "$status" -lt 400 ] || [ "$status" -ge 600 ]; then
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAIL_NAMES="${FAIL_NAMES}unexpected upstream status\n"
  _log FAIL "expected 4xx/5xx, got $status"
  return 0 2>/dev/null || exit 0
fi

# Shape: must parse as JSON and have .error.{message,type,code}.
message=$(bunx jq -r '.error.message // ""' "$body_file" 2>/dev/null || printf "")
type_field=$(bunx jq -r '.error.type // ""' "$body_file" 2>/dev/null || printf "")
code_field=$(bunx jq -r '.error.code // ""' "$body_file" 2>/dev/null || printf "")

if [ -n "$message" ]; then PASS_COUNT=$((PASS_COUNT + 1)); _log PASS "envelope has error.message"; else FAIL_COUNT=$((FAIL_COUNT + 1)); FAIL_NAMES="${FAIL_NAMES}error.message missing\n"; _log FAIL "error.message missing"; fi
if [ -n "$type_field" ]; then PASS_COUNT=$((PASS_COUNT + 1)); _log PASS "envelope has error.type ($type_field)"; else FAIL_COUNT=$((FAIL_COUNT + 1)); FAIL_NAMES="${FAIL_NAMES}error.type missing\n"; _log FAIL "error.type missing"; fi
if [ -n "$code_field" ]; then PASS_COUNT=$((PASS_COUNT + 1)); _log PASS "envelope has error.code ($code_field)"; else FAIL_COUNT=$((FAIL_COUNT + 1)); FAIL_NAMES="${FAIL_NAMES}error.code missing\n"; _log FAIL "error.code missing"; fi

# Must NOT be wrapped in "<name> upstream <status>:".
if printf "%s" "$message" | grep -qE '^(qwen|kimi) upstream [0-9]+:'; then
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAIL_NAMES="${FAIL_NAMES}message is wrapped\n"
  _log FAIL "error.message is still wrapped: $message"
else
  PASS_COUNT=$((PASS_COUNT + 1))
  _log PASS "error.message is not wrapped"
fi

# Must NOT contain provider account fingerprints in cleartext.
if printf "%s" "$message" | grep -qE '\b(ak|sk|org)-[a-z0-9]{8,}'; then
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAIL_NAMES="${FAIL_NAMES}account id leak\n"
  _log FAIL "account id pattern leaked: $message"
else
  PASS_COUNT=$((PASS_COUNT + 1))
  _log PASS "no account id leak in error.message"
fi

# Routing headers must still be present even on upstream failure.
header_file="/tmp/router-test-upstream-err-headers.txt"
curl -s -D "$header_file" -o /dev/null \
  -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"hi"}]}'

provider=$(awk 'BEGIN{IGNORECASE=1} /^x-router-provider:/{print $2}' "$header_file" | tr -d '\r')
catalog=$(awk 'BEGIN{IGNORECASE=1} /^x-router-catalog-id:/{print $2}' "$header_file" | tr -d '\r')
assert_eq "X-Router-Provider present on upstream failure" "kimi" "$provider"
assert_eq "X-Router-Catalog-Id present on upstream failure" "moonshot-v1-32k" "$catalog"
