# ADR-001: Allow API egress to OpenRouter for VLM classification

## Status
Accepted

## Context
The original design spec restricted the `api` service to zero outbound network access (no egress). This kept the API as a pure internal microservice. However, the project requirements (Fase 2, §1.1.c) ask for "Frequência por tipo de praga ou anomalia" as a dashboard metric, which benefits from AI-powered pest classification rather than manual user input alone.

Additionally, keeping the VLM call in the FastAPI service creates a cleaner separation: the web app handles UI, state, and persistence, while the API handles all AI-related computation (HSV severity + VLM classification).

## Decision
Grant the `api` service outbound access to `openrouter.ai` only. This allows the VLM classification endpoint (`POST /classify`) to call Gemini 2.5 Flash Lite via OpenRouter for pest type detection.

The `web` service retains full egress (needed for OpenRouter LLM recommendations).

## Consequences
- **Pro:** Unified AI surface — both HSV severity and VLM pest type live in the FastAPI service
- **Pro:** VLM results are cacheable server-side (in-memory by SHA-256), reducing latency for duplicate images
- **Pro:** Simpler web app — no direct AI calls from Next.js Server Actions
- **Con:** API service is no longer fully isolated — depends on OpenRouter availability
- **Mitigation:** The classification service includes a graceful fallback: when OpenRouter is unreachable, returns `nao_identificado` with 0.0 confidence and a message telling the user to select manually. Upload flow is never blocked by VLM failure.
