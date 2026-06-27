#!/usr/bin/env bash
# Validation and not-found errors are OpenAI-shaped.
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tests/lib.sh
. "$DIR/lib.sh"

section "error envelopes"

status=$(curl -s -o /tmp/router-test-err1.json -w "%{http_code}" \
  -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{}')
assert_eq "empty body -> 400" "400" "$status"
assert_eq "empty body error.type" "invalid_request_error" "$(bunx jq -r .error.type /tmp/router-test-err1.json)"
assert_eq "empty body error.code" "invalid_request"       "$(bunx jq -r .error.code /tmp/router-test-err1.json)"

status=$(curl -s -o /tmp/router-test-err2.json -w "%{http_code}" \
  -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"hi"}]}')
assert_eq "unknown model -> 404" "404" "$status"
assert_eq "unknown model error.code" "model_not_found" "$(bunx jq -r .error.code /tmp/router-test-err2.json)"

status=$(curl -s -o /tmp/router-test-err3.json -w "%{http_code}" \
  "$BASE_URL/v1/generation/does-not-exist")
assert_eq "generation lookup miss -> 404" "404" "$status"
assert_eq "generation miss error.code" "not_found" "$(bunx jq -r .error.code /tmp/router-test-err3.json)"

status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[]}')
assert_eq "empty messages array -> 400" "400" "$status"

status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"alien","content":"x"}]}')
assert_eq "invalid role -> 400" "400" "$status"
