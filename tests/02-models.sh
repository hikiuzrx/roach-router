#!/usr/bin/env bash
# Catalog shape.
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tests/lib.sh
. "$DIR/lib.sh"

section "/v1/models catalog"

status=$(curl -s -o /tmp/router-test-models.json -w "%{http_code}" "$BASE_URL/v1/models")
assert_eq "GET /v1/models -> 200" "200" "$status"

assert_eq "object field is 'list'" "list" "$(bunx jq -r .object /tmp/router-test-models.json)"

count=$(bunx jq -r '.data | length' /tmp/router-test-models.json)
if [ "$count" -ge 11 ]; then
  PASS_COUNT=$((PASS_COUNT + 1))
  _log PASS "data length >= 11 (got $count)"
else
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAIL_NAMES="${FAIL_NAMES}data length\n"
  _log FAIL "data length < 11 (got $count)"
fi

assert_eq "auto alias present"  "auto"  "$(bunx jq -r '[.data[] | select(.id=="auto")][0].id'  /tmp/router-test-models.json)"
assert_eq "fast alias present"  "fast"  "$(bunx jq -r '[.data[] | select(.id=="fast")][0].id'  /tmp/router-test-models.json)"
assert_eq "smart alias present" "smart" "$(bunx jq -r '[.data[] | select(.id=="smart")][0].id' /tmp/router-test-models.json)"

assert_eq "qwen-turbo present"        "qwen-turbo"        "$(bunx jq -r '[.data[] | select(.id=="qwen-turbo")][0].id'        /tmp/router-test-models.json)"
assert_eq "qwen-plus present"         "qwen-plus"         "$(bunx jq -r '[.data[] | select(.id=="qwen-plus")][0].id'         /tmp/router-test-models.json)"
assert_eq "qwen3-coder-plus present"  "qwen3-coder-plus"  "$(bunx jq -r '[.data[] | select(.id=="qwen3-coder-plus")][0].id'  /tmp/router-test-models.json)"
assert_eq "moonshot-v1-32k present"   "moonshot-v1-32k"   "$(bunx jq -r '[.data[] | select(.id=="moonshot-v1-32k")][0].id'   /tmp/router-test-models.json)"
assert_eq "moonshot-v1-128k present"  "moonshot-v1-128k"  "$(bunx jq -r '[.data[] | select(.id=="moonshot-v1-128k")][0].id'  /tmp/router-test-models.json)"

# Required OpenRouter-ish fields on a catalog entry.
entry='[.data[] | select(.id=="qwen-plus")][0]'
assert_eq "qwen-plus has context_length"      "131072"  "$(bunx jq -r "$entry.context_length"           /tmp/router-test-models.json)"
assert_eq "qwen-plus has pricing.prompt"      "true"    "$(bunx jq -r "$entry.pricing.prompt | type == \"string\"" /tmp/router-test-models.json)"
assert_eq "qwen-plus has top_provider"        "object"  "$(bunx jq -r "$entry.top_provider | type"      /tmp/router-test-models.json)"
assert_eq "qwen-plus supported_parameters[]"  "array"   "$(bunx jq -r "$entry.supported_parameters | type" /tmp/router-test-models.json)"
assert_eq "qwen-plus owned_by"                "qwen"    "$(bunx jq -r "$entry.owned_by"                /tmp/router-test-models.json)"
