#!/usr/bin/env bash
# Master runner. Starts the gateway on a free port, runs all tests against it,
# then a second gateway with ROUTER_API_KEYS for the auth suite.
#
# Usage:
#   bash tests/run.sh                    # run everything (spawns its own servers)
#   BASE_URL=http://localhost:3000 \
#     SKIP_SPAWN=1 bash tests/run.sh     # against an already-running server
#
set -u

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"
SKIP_SPAWN="${SKIP_SPAWN:-0}"

start_server() {
  local port="$1"
  local api_keys="${2:-}"
  cd "$ROOT"
  ROUTER_API_KEYS="$api_keys" PORT="$port" NODE_ENV=production LOG_LEVEL=warn REDIS_URL="" \
    bun index.ts >/tmp/router-test-server-"$port".log 2>&1 &
  local pid=$!
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if curl -sf "http://localhost:$port/health" >/dev/null 2>&1; then
      printf "%s" "$pid"
      return 0
    fi
    sleep 0.3
  done
  printf "server on :%s failed to start; log:\n" "$port" >&2
  cat /tmp/router-test-server-"$port".log >&2
  kill "$pid" 2>/dev/null
  return 1
}

stop_server() {
  local pid="$1"
  [ -z "$pid" ] && return 0
  kill "$pid" 2>/dev/null
  wait "$pid" 2>/dev/null
}

# Source lib once into the runner shell so counters are shared.
# shellcheck source=tests/lib.sh
. "$DIR/lib.sh"

MAIN_PID=""
AUTH_PID=""

cleanup() {
  stop_server "$MAIN_PID"
  stop_server "$AUTH_PID"
}
trap cleanup EXIT INT TERM

if [ "$SKIP_SPAWN" = "0" ]; then
  printf "[INFO] starting main server on :38010\n" >&2
  MAIN_PID=$(start_server 38010) || exit 1
  export BASE_URL="http://localhost:38010"
fi

. "$DIR/01-health.sh"
. "$DIR/02-models.sh"
. "$DIR/03-routing.sh"
. "$DIR/04-errors.sh"
. "$DIR/06-upstream-errors.sh"

if [ "$SKIP_SPAWN" = "0" ]; then
  printf "[INFO] starting auth server on :38011\n" >&2
  AUTH_PID=$(start_server 38011 "sk-test-1,sk-test-2") || exit 1
  export AUTH_BASE_URL="http://localhost:38011"
  export ROUTER_AUTH_TEST=1
  export ROUTER_GOOD_KEY="sk-test-1"
fi

. "$DIR/05-auth.sh"

summary
