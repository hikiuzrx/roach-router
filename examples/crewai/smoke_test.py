"""
Stdlib-only smoke test. Proves the gateway speaks OpenAI v1 over plain HTTP.
If this passes, CrewAI / LiteLLM / openai-sdk will work too — they all speak
the same protocol.

Usage:
    ROUTER_BASE_URL=http://localhost:3000/v1 \\
    ROUTER_API_KEY=dev \\
    python3 examples/crewai/smoke_test.py
"""

import json
import os
import sys
import urllib.error
import urllib.request

BASE_URL = os.environ.get("ROUTER_BASE_URL", "http://localhost:3000/v1")
API_KEY = os.environ.get("ROUTER_API_KEY", "dev")


def call() -> dict:
    payload = json.dumps(
        {
            "model": "auto",
            "messages": [
                {
                    "role": "user",
                    "content": "Write a python function add(a, b). Code only.",
                }
            ],
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        f"{BASE_URL}/chat/completions",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=60) as resp:
        body = json.loads(resp.read().decode("utf-8"))
        return {
            "status": resp.status,
            "provider": resp.headers.get("X-Router-Provider"),
            "model": resp.headers.get("X-Router-Model"),
            "reason": resp.headers.get("X-Router-Reason"),
            "cost_usd": resp.headers.get("X-Router-Cost-Usd"),
            "body": body,
        }


def main() -> int:
    print(f"Calling {BASE_URL}/chat/completions with model=auto")
    try:
        result = call()
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"HTTP {e.code}: {body[:500]}", file=sys.stderr)
        return 1

    print(f"  status      : {result['status']}")
    print(f"  provider    : {result['provider']}")
    print(f"  model       : {result['model']}")
    print(f"  reason      : {result['reason']}")
    print(f"  cost (USD)  : {result['cost_usd']}")
    choice = result["body"].get("choices", [{}])[0]
    content = choice.get("message", {}).get("content", "")
    print("---")
    print(content)
    print("---")
    return 0


if __name__ == "__main__":
    sys.exit(main())
