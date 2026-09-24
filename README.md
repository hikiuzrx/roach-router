<p align="center">
  <img src="docs/images/logo.svg" alt="roach-router" width="320" />
</p>

<h1 align="center">roach-router</h1>

<p align="center">
  OpenAI-compatible  LLM gateway that routes between <b>Qwen</b> and <b>Kimi</b>.<br/>
  Drop-in <code>base_url</code> for the OpenAI SDK, LangChain, CrewAI, Agno.
</p>

<p align="center">
  <img alt="runtime" src="https://img.shields.io/badge/runtime-Bun-000000?logo=bun&logoColor=white" />
  <img alt="server" src="https://img.shields.io/badge/server-Fastify-000000?logo=fastify&logoColor=white" />
  <img alt="cache" src="https://img.shields.io/badge/cache-Valkey-c93b3b?logo=redis&logoColor=white" />
  <img alt="tests" src="https://img.shields.io/badge/tests-58%2F58_passing-2ea043" />
  <img alt="status" src="https://img.shields.io/badge/phase-1%E2%80%932_complete-blue" />
</p>

---

> **Viewing the diagrams.** All `mermaid` blocks below render as live SVGs on **github.com** and any Mermaid-aware viewer (GitLab, Obsidian, Notion, VS Code with the *Markdown Preview Mermaid Support* extension). In viewers without Mermaid the source shows as fenced code, which is still the canonical truth and editable in place.

---

## How routing decides

The gateway picks a provider per request based on **what's in the prompt** and **how the client asked**. Three inputs in priority order:

```mermaid
flowchart LR
    A([Incoming request]) --> B{Did the client name a model?}
    B -- "explicit catalog id<br/>(e.g. qwen-plus)" --> C[Use it as-is<br/>reason: explicit]
    B -- "alias 'fast'" --> D[qwen-turbo<br/>reason: alias:fast]
    B -- "alias 'smart'" --> E[moonshot-v1-32k<br/>reason: alias:smart]
    B -- "alias 'auto'" --> F[Rule-based router]

    F --> G{Prompt chars}
    G -- ">= 50000" --> H[moonshot-v1-128k<br/>reason: auto:very_long_context]
    G -- "< 50000" --> I{Looks like code?}
    I -- "yes" --> J[qwen3-coder-plus<br/>reason: auto:code_detected]
    I -- "no" --> K{chars >= 8000?}
    K -- "yes" --> L[moonshot-v1-32k<br/>reason: auto:long_context]
    K -- "no" --> M[moonshot-v1-32k<br/>reason: auto:default]
```

### What the router looks at

| Signal | How it's computed | Why it matters |
| ------ | ----------------- | -------------- |
| **Prompt size** | sum of `content.length` across all messages | long prompts need long-context windows (Kimi 128k) |
| **Code detection** | regex set over message content: \`\`\` fences, `function`/`class`/`import`/`def`, SQL `SELECT...FROM`, language names | code questions go to Qwen's code-specialized model |
| **Client intent** | `model` field on the request body | explicit ids and aliases trump heuristics |

### What it does **not** look at (yet)

These are slated for later phases — see `plan.md`:

- Embedding-based semantic similarity to past prompts (Phase 4)
- Live provider latency / error-rate signals
- Per-token cost minimization
- Tool-call complexity scoring
- Vision / multimodal hints

### Routing rules in source

The rules live in one file: `src/core/router.ts`. To change them, edit `routeRuleBased(req)` — it returns `{ catalogId, reason }`. The `reason` string is what shows up on every response as `X-Router-Reason` and in every log line.

```ts
// src/core/router.ts (excerpt)
if (chars >= VERY_LONG_CONTEXT_THRESHOLD_CHARS) {
  return { catalogId: "moonshot-v1-128k", reason: `very_long_context:${chars}` };
}
if (looksLikeCode(req)) {
  return { catalogId: "qwen3-coder-plus", reason: "code_detected" };
}
if (chars >= LONG_CONTEXT_THRESHOLD_CHARS) {
  return { catalogId: "moonshot-v1-32k", reason: `long_context:${chars}` };
}
return { catalogId: "moonshot-v1-32k", reason: "default" };
```

---

## High Level Architecture Overview

```mermaid
flowchart TD
    Client["Client / Agent SDK"]
    GW["API Gateway (Fastify)"]
    GWDB[(Models Cache)]
    Auth["Auth Middleware"]
    Resolver["Model Resolver"]
    Router["Routing Service"]
    Catalog[(Model Catalog)]
    Registry["Provider Registry"]
    QwenP["Qwen Provider"]
    KimiP["Kimi Provider"]
    Cost["Cost & Metering"]
    Valkey[(Valkey - Generation Log)]

    QwenAPI["Qwen API"]
    KimiAPI["Kimi API"]

    Client -->|"POST /v1/chat/completions"| GW
    GW -->|"GET /v1/models"| GWDB
    GW --> Auth
    Auth -->|"Bearer ok"| Resolver
    Resolver -->|"alias / explicit"| Catalog
    Resolver -->|"auto"| Router
    Router -->|"ResolvedModel"| Registry
    Registry --> QwenP
    Registry --> KimiP
    QwenP -->|"REST"| QwenAPI
    KimiP -->|"REST"| KimiAPI
    QwenP -->|"usage"| Cost
    KimiP -->|"usage"| Cost
    Cost -->|"SET generation"| Valkey
    Client <-->|"/v1/generation/:id"| Valkey

    classDef store fill:#fff,stroke:#333,stroke-width:1px;
    classDef service fill:#fff,stroke:#333,stroke-width:1px;
    class GWDB,Catalog,Valkey store
    class GW,Auth,Resolver,Router,Registry,QwenP,KimiP,Cost,QwenAPI,KimiAPI service
```

---

## Request Flow Overview

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant Auth
    participant Resolver
    participant Router
    participant Provider
    participant Upstream
    participant Cache

    Client->>Auth: POST /v1/chat/completions + Bearer key
    Auth->>Resolver: req.apiKeyId = k_xxxx
    Resolver->>Router: model="auto"?
    Router-->>Resolver: ResolvedModel { catalogId, reason }
    Resolver->>Provider: chat(body, upstreamModel)
    Provider->>Upstream: POST /chat/completions
    Upstream-->>Provider: ChatResponse + usage
    Provider-->>Resolver: response
    Resolver->>Cache: SET router:generation:id EX 3600
    Resolver-->>Client: 200 + X-Router-* headers + body
```

---

## Auto Routing Decision Flow

```mermaid
sequenceDiagram
    autonumber
    participant ChatRoute
    participant Resolver
    participant RuleEngine
    participant Catalog

    ChatRoute->>Resolver: resolveModel("auto", autoSelector)
    Resolver->>RuleEngine: routeRuleBased(req)
    RuleEngine->>RuleEngine: chars >= 50000?
    RuleEngine->>RuleEngine: looks like code?
    RuleEngine->>RuleEngine: chars >= 8000?
    RuleEngine-->>Resolver: { catalogId, reason }
    Resolver->>Catalog: findModel(catalogId)
    Catalog-->>Resolver: ModelInfo
    Resolver-->>ChatRoute: ResolvedModel
```

---

## Upstream Failure → Sanitized Envelope

```mermaid
sequenceDiagram
    autonumber
    participant ChatRoute
    participant Provider
    participant Upstream
    participant UpstreamError
    participant ErrorHandler
    participant Client

    ChatRoute->>Provider: chat(body, model)
    Provider->>Upstream: POST /chat/completions
    Upstream-->>Provider: 429 body with ak-xxxxx
    Provider->>UpstreamError: new UpstreamError("kimi", 429, body)
    UpstreamError->>UpstreamError: sanitize ak-/sk-/org- ids
    UpstreamError-->>Provider: envelope { error: { message, type, code } }
    Provider-->>ErrorHandler: throw
    ErrorHandler-->>Client: 429 sanitized envelope + X-Router-* headers
```

---

## Endpoints

| Method | Path                       | Notes                                      |
| ------ | -------------------------- | ------------------------------------------ |
| `GET`  | `/health`                  | liveness                                   |
| `GET`  | `/ready`                   | reports cache connectivity                 |
| `GET`  | `/v1/models`               | OpenRouter-shaped catalog (cached)         |
| `POST` | `/v1/chat/completions`     | non-stream or SSE; tools passthrough       |
| `GET`  | `/v1/generation/:id`       | retrieve stats for a recent generation     |

## Models

Direct catalog ids: `qwen-turbo`, `qwen-plus`, `qwen-max`, `qwen3-coder-plus`, `moonshot-v1-8k`, `moonshot-v1-32k`, `moonshot-v1-128k`, `kimi-k2-0711-preview`.

Aliases:

| Alias  | Meaning                                |
| ------ | -------------------------------------- |
| `auto` | router picks per request               |
| `fast` | `qwen-turbo`                           |
| `smart`| `moonshot-v1-32k`                      |

`auto` rule-based routing:

- ≥ 50k chars of prompt → `moonshot-v1-128k`
- code detected → `qwen3-coder-plus`
- ≥ 8k chars → `moonshot-v1-32k`
- otherwise → `moonshot-v1-32k`

## Response headers

Every non-streaming completion (and the SSE preamble) carries:

```
X-Request-Id
X-Router-Provider     qwen | kimi
X-Router-Model        upstream model name
X-Router-Catalog-Id   gateway catalog id
X-Router-Reason       routing decision reason
X-Router-Latency-Ms
X-Router-Cost-Usd     (non-stream only)
```

## Run locally

```sh
bun install
cp .env.example .env       # fill QWEN_API and KIMI_API
bun index.ts
```

Listens on `http://localhost:3000`. Without `REDIS_URL` the gateway fails open — caching + generation lookup are disabled and a warning is logged.

## Run with Docker Compose

```sh
docker compose up --build
```

Spins up Valkey + the gateway. Env is read from `.env`. The router talks to Valkey over the compose network at `redis://valkey:6379`.

## Authenticated mode

Comma-separated list of API keys; clients must send `Authorization: Bearer <key>`:

```
ROUTER_API_KEYS=sk-yours-1,sk-yours-2
```

Each key gets a short fingerprint that is logged with every request. Plaintext keys are never logged.

## Testing

```sh
bash tests/run.sh           # 58/58 pass, spawns its own gateway
bunx tsc --noEmit           # type check
```

Manual probes:

```sh
curl localhost:3000/health
curl localhost:3000/v1/models | jq .

bash examples/curl/chat.sh
bash examples/curl/stream.sh
bash examples/curl/tools.sh

curl localhost:3000/v1/generation/<id-from-previous-response>
```

## Project layout

```
src/
├── config.ts                env loading
├── server.ts                fastify bootstrap + hooks
├── types.ts                 shared types
├── utils/{errors,ids}.ts
├── infra/
│   ├── logger.ts            pino options (redaction, serializers)
│   └── cache.ts             Valkey/Redis wrapper (fail-open)
├── core/
│   ├── catalog.ts           model catalog + aliases
│   ├── resolution.ts        request model -> ResolvedModel
│   ├── router.ts            rule-based auto routing
│   └── cost.ts              per-token cost calc
├── providers/
│   ├── base.ts              Provider interface
│   ├── openai-compatible.ts shared upstream client
│   ├── qwen.ts kimi.ts      instances
│   └── registry.ts          ProviderName -> Provider
└── api/
    ├── schemas.ts           zod
    ├── middleware/auth.ts   API-key gate
    └── routes/{chat,models,generation}.ts
examples/
├── curl/                    chat, stream, tools
├── langchain/               TS via @langchain/openai
└── crewai/                  Python via LiteLLM
tests/
├── lib.sh                   assertion helpers
├── 01..06-*.sh              focused test files
└── run.sh                   master runner
```

## Logging

Pino JSON, level via `LOG_LEVEL`. Dev (`NODE_ENV != production`) is colorized via `pino-pretty`. Every routed request logs at least once with `routed` (resolved model + reason) and once with `completed` or `failed` (latency, status, usage, cost). `req.headers.authorization` and provider API keys are redacted. No request bodies are persisted.

Generation stats are cached in Valkey for `GENERATION_CACHE_TTL_SECONDS` (default 1h) to power `/v1/generation/:id`.

---

## Deeper docs

- [`docs/OVERVIEW.md`](docs/OVERVIEW.md) — same diagrams as above, standalone
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — 31 diagrams (C4, class, sequence, flow, state, ER)

<!-- BEGIN:RENDERED-DIAGRAMS -->

## Diagrams (rendered)

Image versions of every Mermaid block above — visible in any markdown viewer, no extension required.

### How routing decides

![How routing decides](https://kroki.io/mermaid/svg/eNqF0VFLAkEQB_D3PsXgi_mwdSWBiBpZaaZBBD0dh6x347m4t6O7c6lI3z1uT0FT6nn_85vZmammVTyTlmH0cQEA8HAZDkxMmTIpWFzm6DiqgRAd6G6fVAI8Q4i1QsNgZIYgIaME9f23r-6CEFDB9UKrWDHEkqWmFFTSmtjrziVepVewXKERC527WsW7j-GnQ1AM0gnlfNCidGSasIeiA1xqJR1Up9JxtQSeQk9ybid0VO6jzSJ5BnCZtHvhOcyIjJsRi68bUb-dn2F8_owjc6Yd0ws_co1iIh0mYClntNGFr-j59_723VK2YCg27sqN9b3VacNdEARB6bwcjXNz2_g1T87U_EK7GWsy6Tgmw7jejVZyrUNtsB0RzR1oNUeIKcHdrQY-ukFXxl79FuuiSFh_n9Omxds4QcaYMYkOFEMlMtz6r0GnDY0gCHadhsedRn9vu2h0-rHhUZ-3_4kEpzLXHP0A8eTgjA==)

### High Level Architecture Overview

![High Level Architecture Overview](https://kroki.io/mermaid/svg/eNqVk02L2zAQhu_9FYMWSgIKZsktLQv5agjbULcJ3YPpQdhjR0SxgqQkG_CPLxrJzsf20ovH0vuORp5nXCp9zrfCONjMPgEATJXE2mUsREhgXPm4nr2yP2RYvGVsnC5hIRyexQV634R1srz0O302yXorXaCyMBX5FvtBGB_dNmP-CStZFArPwmBM-oVWqxOajFFit25lfXRe9FHWFazRnGTeJk-FE0pXsWi77LcnV9I6c8lYavRJFmi6rZj-84x1mjEfoPVE6VXuZZoxHx6lqba-S9o6-AwrdGhkXUXtt1A7vGS9EGEAC6zRCCd1Dd_pZl3hcbqMpcfp8qYq7VPdsH_DBgaDl4alP9YbSE7PSb4VLsn1_qDQF7CsgcVbJBGsi3lw7okJ6bPJjYPIdIhCzgSFQQN6x5oOxh2pYBNKCgsJ4PtByVw61rTt_5f56LQ_jmDecA1q9BYEkaoGSncU6boE7OM2wboSjafO1xvWtK2-Qr1TY8Mfc49WVOi_SFv3mPlBo0kgaT3fQNUBZ00ch1uCX8nomVyNyUgWVzO5cyWsnWEJ1mmDUEqlRk9lWXLrjN7h6Gk4HMb3wVkWbjt6Prx_eUgNv8r_J9OU8EiTx1Gmi9x5uJ8Z3oLmgShvwXBqJ6fGcd8iHknw2PP2fn8BQHdnOQ==)

### Request Flow Overview

![Request Flow Overview](https://kroki.io/mermaid/svg/eNptkU9PwkAQxe98igknFWqrJh6aUKPIgRgjAUy4maE7aTe0u2X_kBLjdze7bQ8t3NrZ35t580bT0ZJI6Z1jprAcAQCgNVLYck_K_1aoDE95hcLAvOAkzEX51Zr8orgmLYvTlSZrac2V8krJE2dXHr4rbRS15npuMM1p5MuNsSBJnJUYVl-bLYSnhzDN0YSpLKuCDJdCwwTeCBUpONDZK50gSJLObQyKjvdY8Q86LxnM4PBT13Xt0Y5xuN8hhlIyKmZjF9n4pYH8S9Br2X6xT0fDL6RosJDZkk1BEWop4G84oEsjBrfCzV6y8xRsm4Tvc-slHRckSZdTt_5wd893UNCbMc_RrElXUmiCCViNGfXbDyJq0KFpf5AYNostqCagjAQpdONjzmCxg6fnKOrLnM5fL4bHKIIJ7II2wzvICRkpdzUXwD_rKuKJ)

### Auto Routing Decision Flow

![Auto Routing Decision Flow](https://kroki.io/mermaid/svg/eNqNkcFqAjEQhu8-xeDJgoW9FMpCV6j24MHL9gmmybgGY0YniZfSdy9JdhdWpfSWzPz_l_knni6RnKKNwU7wNAMAwBjYxdMXSb6eUYJR5owuwPqAoeUY6K7Tkmd7fWBpo6UP1xl371ljQMvdLDdG9HPTDLAapJx2rMku5mmy-TIP-EmWVGB5yubBkLzjezVI4qXCO3rSC6FLLx81NwZ1QPHQvMFLVVXV6m-xZT56sOZIoFjT6p_o10fkSehvUGUzW70EIfTs4Oc2Z7-8GvbG6bKf0VVS9oopOyu3bs9TXgIOH1AP5YL9BUa4tS4=)

### Upstream Failure → Sanitized Envelope

![Upstream Failure → Sanitized Envelope](https://kroki.io/mermaid/svg/eNp1UTtPwzAQ3vsrTp1aiBUJsZDBCyCxUfGQWN34lFiJH9iXhlL1vyM7BBo19ea773V3AT87NCU-KFF5oRcAAKIjazq9RZ--TnhSpXLCENzXgl5sR3jW2Xi7U3KG8u4CefyVnms8em_Paan6JIxs52K0Cg0tUv0vEuN8DFFAWQtaba3cZ6CtxHadsGOfcT66F7B5fn2DPBLy0mrXIilrQsKPIDbRvr25gygNvaIaRMO-4rtkkAYpwGA_nXi1bJRWyyzKZUlvPfFMoHOdIIwi9Y3RNw8Ny62vGCgZZsiT1Gh22FqHcAAcpA6gMQRRYQa0d5hBaSXCEY7TURjnp8cogGpv-4Q5rUfccJdhQ2NQ-e98DR8sncqzK6hRSPThB0O42Gw=)

<!-- END:RENDERED-DIAGRAMS -->
