# Examples

All examples treat the gateway as an **OpenAI-compatible base URL**. No custom adapter.

| Folder            | Stack                                | What it shows                                               | Verified |
| ----------------- | ------------------------------------ | ----------------------------------------------------------- | -------- |
| `curl/`           | Plain HTTP                           | chat, streaming SSE, tool-call passthrough                  | yes      |
| `langchain/`      | TypeScript + `@langchain/openai`     | `ChatOpenAI` against the gateway                            | yes      |
| `crewai/main.py`  | Python + CrewAI + LiteLLM            | Two-agent crew routed through the gateway                   | syntax   |
| `crewai/smoke_test.py` | Python stdlib (urllib)         | Proves the OpenAI v1 protocol path without crewai installed | yes      |

By default everything points at `http://localhost:3000`. Override with `ROUTER_BASE_URL` / `ROUTER_API_KEY`. If `ROUTER_API_KEYS` is set on the gateway, the key in `ROUTER_API_KEY` must match one of them.

---

## Quick verify

Start the gateway:

```sh
bun index.ts
```

Run all working examples in one shot:

```sh
ROUTER_BASE_URL=http://localhost:3000/v1 ROUTER_API_KEY=dev bash examples/curl/chat.sh
ROUTER_BASE_URL=http://localhost:3000/v1 ROUTER_API_KEY=dev bash examples/curl/stream.sh
ROUTER_BASE_URL=http://localhost:3000/v1 ROUTER_API_KEY=dev bash examples/curl/tools.sh

cd examples/langchain && bun install
ROUTER_BASE_URL=http://localhost:3000/v1 ROUTER_API_KEY=dev bun examples/langchain/index.ts

ROUTER_BASE_URL=http://localhost:3000/v1 ROUTER_API_KEY=dev python3 examples/crewai/smoke_test.py
```

Each call surfaces routing metadata in `X-Router-*` response headers — clients see which provider handled the request, why, and how much it cost.

---

## CrewAI (full example)

`crewai/main.py` runs a two-agent crew (researcher + writer), both wired to the gateway via LiteLLM:

```sh
cd examples/crewai
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

ROUTER_BASE_URL=http://localhost:3000/v1 ROUTER_API_KEY=dev python main.py
```

CrewAI uses LiteLLM under the hood; LiteLLM speaks OpenAI-compatible when the model name is prefixed `openai/` and `OPENAI_API_BASE` / `OPENAI_API_KEY` are set. The script handles both.
