#!/usr/bin/env bash
# Streams a completion as Server-Sent Events.
# Defaults to "auto" so the gateway picks a provider based on prompt content.
set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:3000}"
API_KEY="${ROUTER_API_KEY:-dev}"

curl -N "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "auto",
    "stream": true,
    "messages": [
      {"role": "user", "content": "Write a python function add(a, b). Just the code."}
    ]
  }'
