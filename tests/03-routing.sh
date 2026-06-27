#!/usr/bin/env bash
# Routing decisions surfaced via X-Router-* headers.
# We don't depend on upstream success — we read headers from the response.
# Even on upstream failure, the headers we set BEFORE calling upstream are
# not visible for non-stream, so we use the curl `-m` timeout trick and parse
# what we can. Easier: rely on the fact that headers are set on success or 502.
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tests/lib.sh
. "$DIR/lib.sh"

section "routing decisions"

probe() {
  local label="$1" body="$2" expected_provider="$3" expected_catalog="$4" expected_reason_substr="$5"
  local headers_file="/tmp/router-test-headers-$$.txt"
  curl -s -o /dev/null -D "$headers_file" \
    -X POST "$BASE_URL/v1/chat/completions" \
    -H "Content-Type: application/json" \
    --max-time 30 \
    -d "$body" || true

  local provider catalog reason
  provider=$(awk 'BEGIN{IGNORECASE=1} /^x-router-provider:/{print $2}' "$headers_file" | tr -d '\r')
  catalog=$(awk 'BEGIN{IGNORECASE=1} /^x-router-catalog-id:/{print $2}' "$headers_file" | tr -d '\r')
  reason=$(awk 'BEGIN{IGNORECASE=1} /^x-router-reason:/{print $2}' "$headers_file" | tr -d '\r')

  assert_eq "$label provider"  "$expected_provider" "$provider"
  assert_eq "$label catalogId" "$expected_catalog"  "$catalog"
  assert_contains "$label reason contains '$expected_reason_substr'" "$expected_reason_substr" "$reason"
  rm -f "$headers_file"
}

probe "auto+plain"  '{"model":"auto","messages":[{"role":"user","content":"hi"}]}'                                                  "kimi" "moonshot-v1-32k"  "default"
probe "auto+code"   '{"model":"auto","messages":[{"role":"user","content":"```ts\nfunction add(a:number,b:number){return a+b}\n```"}]}' "qwen" "qwen3-coder-plus" "code_detected"
probe "fast alias"  '{"model":"fast","messages":[{"role":"user","content":"hi"}]}'                                                  "qwen" "qwen-turbo"       "alias:fast"
probe "smart alias" '{"model":"smart","messages":[{"role":"user","content":"hi"}]}'                                                 "kimi" "moonshot-v1-32k"  "alias:smart"
probe "explicit qwen-plus" '{"model":"qwen-plus","messages":[{"role":"user","content":"hi"}]}'                                      "qwen" "qwen-plus"        "explicit"

# Long-context routing: build a >= 50k char message.
long_payload=$(bunx --bun bun -e '
const big = "lorem ".repeat(11000);
console.log(JSON.stringify({ model: "auto", messages: [{ role: "user", content: big }] }));
')
probe "auto+very_long" "$long_payload" "kimi" "moonshot-v1-128k" "very_long_context"
