# AgroSmart Fase 2

Production-minded dashboard for plant disease analysis, image uploads, SQLite persistence, and agronomy recommendations.

## Setup

Project setup instructions will be finalized during implementation.

## Architecture

- Next.js 16 dashboard and server actions
- FastAPI image analysis service
- SQLite with Drizzle ORM
- Docker Compose deployment with Caddy reverse proxy

## Deployment

Deployment and operations steps will be documented in detail in Phase 7.

## Known limitations

- Shared upload volume between web and api is accepted for the MVP
- `/admin/audit` is intentionally public for the demo, with hashed identifiers
