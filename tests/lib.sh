#!/usr/bin/env bash
# Shared test helpers. No external deps beyond curl + bun (for jq via `bunx jq`).
# Source me from each test file.

set -u

BASE_URL="${BASE_URL:-http://localhost:3000}"
ROUTER_API_KEY="${ROUTER_API_KEY:-}"

# Counters survive across `source`d files in the same shell.
: "${PASS_COUNT:=0}"
: "${FAIL_COUNT:=0}"
: "${FAIL_NAMES:=}"

_log() { printf "[%s] %s\n" "$1" "$2" >&2; }

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    PASS_COUNT=$((PASS_COUNT + 1))
    _log PASS "$label"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAIL_NAMES="${FAIL_NAMES}${label}\n"
    _log FAIL "$label (expected='$expected' actual='$actual')"
  fi
}

assert_contains() {
  local label="$1" needle="$2" haystack="$3"
  if printf "%s" "$haystack" | grep -q -- "$needle"; then
    PASS_COUNT=$((PASS_COUNT + 1))
    _log PASS "$label"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAIL_NAMES="${FAIL_NAMES}${label}\n"
    _log FAIL "$label (missing '$needle')"
    _log FAIL "       haystack: $(printf "%s" "$haystack" | head -c 240)"
  fi
}

# auth_header — emits "-H Authorization: Bearer <key>" if ROUTER_API_KEY is set.
auth_header_args() {
  if [ -n "$ROUTER_API_KEY" ]; then
    printf -- "-H\nAuthorization: Bearer %s" "$ROUTER_API_KEY"
  fi
}

# Section banner for readability.
section() { _log SECTION "$1"; }

# Pretty summary; returns non-zero exit if any test failed.
summary() {
  printf "\n----------------------------------------\n" >&2
  printf "Passed: %s   Failed: %s\n" "$PASS_COUNT" "$FAIL_COUNT" >&2
  if [ "$FAIL_COUNT" -gt 0 ]; then
    printf "Failures:\n" >&2
    printf -- "$FAIL_NAMES" >&2
    return 1
  fi
  return 0
}
