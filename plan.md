# AI Model Router (Qwen + Kimi) — Architecture & Build Plan

## 1. Overview

This project is an **OpenAI-compatible LLM gateway** that routes requests between multiple models (initially Qwen and Kimi).
It is designed to be directly usable by agent frameworks such as **CrewAI** and **Agno**, as well as any OpenAI SDK-compatible client.

The system acts as an **intelligent model selection layer**, not just a proxy.

---

## 2. Core Goals

* Provide OpenAI-compatible API (`/v1/chat/completions`)
* Support multiple LLM providers (Qwen, Kimi)
* Enable intelligent routing (“auto” model selection)
* Support streaming responses (SSE)
* Support tool/function calling passthrough
* Be compatible with:

  * CrewAI
  * Agno
  * LangChain / LlamaIndex

---

## 3. High-Level Architecture

```
Client (CrewAI / Agno / Apps)
        │
        ▼
OpenAI-Compatible API Layer
        │
        ▼
Request Normalizer
        │
        ▼
Router / Policy Engine
        │
   ┌────┴────┐
   ▼         ▼
Qwen       Kimi
   │         │
   └────┬────┘
        ▼
Response Normalizer
        │
        ▼
OpenAI-Compatible Response
```

---

## 4. System Components

### 4.1 API Layer

Exposes OpenAI-compatible endpoints:

* `POST /v1/chat/completions`
* `GET /v1/models`
* (optional) `POST /v1/embeddings`

Responsibilities:

* Accept OpenAI-style requests
* Validate input
* Forward request to router

---

### 4.2 Request Normalizer

Converts all incoming requests into a unified internal format.

Key responsibilities:

* Normalize messages
* Extract model hints
* Preserve tools / tool calls
* Standardize request schema

---

### 4.3 Router / Policy Engine

This is the core intelligence layer.

Responsibilities:

* Select best model (Qwen or Kimi)
* Apply routing strategies:

  * rule-based (initial)
  * scoring-based (advanced)
  * embedding-based (future)
* Support “auto” model selection

Routing inputs:

* prompt content
* length
* domain (code, writing, reasoning)
* cost/latency constraints
* historical performance

---

### 4.4 Providers Layer

Each model is wrapped as a provider:

* Qwen Provider
* Kimi Provider

Responsibilities:

* Send API requests
* Handle authentication
* Return normalized responses
* Support streaming (if available)

All providers implement a unified interface:

```
chat()
stream()
name
```

---

### 4.5 Response Normalizer

Ensures all outputs conform to OpenAI format:

* `id`
* `object`
* `model`
* `choices[]`
* `message.content`
* tool_calls (if present)

---

### 4.6 Streaming Layer (SSE)

Required for agent frameworks.

Responsibilities:

* Stream tokens in real time
* Forward provider chunks directly
* Maintain OpenAI SSE format

---

### 4.7 Logging & Observability Layer

Stores every request:

* prompt
* model used
* latency
* tokens
* cost
* success/failure

Used for:

* routing improvement
* analytics
* future ML-based router training

---

## 5. Routing Strategies

### 5.1 Rule-Based (Initial)

Simple heuristics:

* Code → Qwen
* Long context → Kimi
* Default → Kimi

---

### 5.2 Scoring-Based (Intermediate)

Assign weighted scores:

* coding score
* reasoning score
* long-context score
* latency preference

Select model with highest score.

---

### 5.3 Learning-Based (Advanced)

Train model selection using historical logs:

Inputs:

* prompt embeddings
* metadata
* past performance

Output:

* probability(Qwen wins)
* probability(Kimi wins)

---

## 6. Model Aliases

To ensure compatibility with agent frameworks:

| Alias | Meaning        |
| ----- | -------------- |
| auto  | router decides |
| fast  | Qwen           |
| smart | Kimi           |

---

## 7. Tool Calling Support

The system must pass through:

* tools
* tool_choice
* tool_calls

No modification of schema is allowed.

This ensures compatibility with CrewAI / Agno agents.

---

## 8. Execution Flow

```
Request received
      │
      ▼
Normalize request
      │
      ▼
Resolve model alias
      │
      ▼
Router selects provider
      │
      ▼
Call model (Qwen / Kimi)
      │
      ▼
Stream or return response
      │
      ▼
Normalize output to OpenAI format
      │
      ▼
Return to client
```

---

## 9. Tech Stack (TypeScript)

* Node.js (18+)
* TypeScript
* Fastify (recommended)
* Zod (validation)
* PostgreSQL (logs)
* Redis (o ptional caching)
* SSE for streaming

---

## 10. Evolution Roadmap

### Phase 1

* OpenAI-compatible API
* Basic routing
* Qwen + Kimi integration

### Phase 2

* Streaming support
* Logging system
* Fallback handling

### Phase 3

* Scoring-based router
* Performance tracking

### Phase 4

* Embedding-based routing
* Historical optimization

### Phase 5

* Multi-model execution + judge system
* Self-improving router

---

## 11. Key Design Principle

The system is not a proxy.

It is an:

> **Adaptive model orchestration layer that behaves like a single intelligent LLM provider**

---

## 12. Integration Target

Once implemented, it should be usable as:

* CrewAI `base_url`
* Agno LLM provider
* Any OpenAI SDK replacement

No special adapters required.
