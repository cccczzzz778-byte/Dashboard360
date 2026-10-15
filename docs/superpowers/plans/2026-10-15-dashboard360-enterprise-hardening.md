# Dashboard360 Enterprise Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden Dashboard360 production infrastructure without changing the core dashboard UX.

**Architecture:** PostgreSQL remains the durable system of record. Redis provides shared login throttling and future distributed state; failures degrade to existing memory protections. The web process adds readiness, durable audit records, graceful shutdown, non-root containers, tracing and CI security gates.

**Tech Stack:** Node.js 22, TypeScript, Express 5, PostgreSQL, Redis 8.2, Railway, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-15-dashboard360-enterprise-hardening-design.md`

## Global Constraints
- Never log secrets, raw passwords, session tokens, CSRF tokens, connection strings or raw IP addresses.
- Existing dashboard behavior and public URL must remain unchanged.
- New infrastructure must fail safely and not fabricate health or application data.
- Every runtime behavior change gets a failing test before implementation.

## Review Focus
- Redis unavailable: login remains protected by memory throttle and application stays usable.
- PostgreSQL unavailable: readiness becomes unhealthy without exposing connection details.
- Cross-replica brute-force attempts: Redis counter enforces shared threshold.
- Container runtime: process runs as non-root and carries only production dependencies/source artifacts.
- Shutdown during active traffic: server stops accepting new connections and exits cleanly.

---

### Task 1: Shared Redis login throttling
**Files:** create `src/security/redis-rate-limit.ts`; modify `src/security/rate-limit.ts`, `src/app.ts`, `package.json`; test `tests/security/redis-rate-limit.test.ts`.
- [ ] Write a failing test for shared threshold behavior and fail-safe fallback.
- [ ] Implement a Redis-backed limiter behind the current limiter interface.
- [ ] Configure production from `REDIS_URL`; memory limiter remains fallback.
- [ ] Run full test/build.

### Task 2: Durable audit trail
**Files:** create `src/audit/store.ts`; modify `src/db/index.ts`, `src/app.ts`; test `tests/audit/store.test.ts`.
- [ ] Write failing tests for sanitized metadata and DB persistence calls.
- [ ] Add `audit_events` table and bounded metadata persistence.
- [ ] Record login, failed login, throttling, logout and metric writes without blocking requests on audit failure.
- [ ] Run full test/build.

### Task 3: Readiness and dependency health
**Files:** create `src/health/readiness.ts`; modify `src/app.ts`; test `tests/health/readiness.test.ts`.
- [ ] Write failing tests for healthy and unhealthy dependency probes.
- [ ] Add `/api/ready` with safe boolean output and short timeouts.
- [ ] Keep `/api/health` as lightweight liveness.
- [ ] Run full test/build.

### Task 4: Process and container hardening
**Files:** modify `src/server.ts`, `Dockerfile`, `.env.example`; test `tests/smoke/runtime-hardening.test.ts`.
- [ ] Write failing/static assertions for timeouts and non-root runtime.
- [ ] Add graceful shutdown and bounded HTTP timeouts.
- [ ] Convert Dockerfile to multi-stage, production-only, non-root runtime.
- [ ] Run full test/build.

### Task 5: Supply-chain and CI gates
**Files:** create `.github/workflows/security.yml`, `.github/dependabot.yml`.
- [ ] Add test/build/high-severity npm audit workflow.
- [ ] Add weekly npm and GitHub Actions Dependabot updates.
- [ ] Verify workflow YAML structure.

### Task 6: Railway production controls
**Infrastructure:** Redis, web variables, tracing, readiness healthcheck, restart policy.
- [ ] Deploy verified Redis template.
- [ ] Inject `REDIS_URL` by Railway reference without exposing its value.
- [ ] Enable tracing/auto-instrumentation.
- [ ] Switch healthcheck to `/api/ready` only after code is deployed healthy.
- [ ] Set restart policy to `ON_FAILURE`.
- [ ] Verify web, Postgres and Redis are online with no active critical issue.
