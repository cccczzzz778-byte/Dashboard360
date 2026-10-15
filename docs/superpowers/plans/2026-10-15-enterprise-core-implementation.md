# Buxoro SSB 360 Enterprise Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1 of the approved enterprise architecture: database/RBAC foundations, persistent scoped sessions, deterministic risk scoring, deduplicated alerts, source freshness/integration health, and an Executive “Bugun” experience without breaking the existing map or Muassasa 360° flow.

**Architecture:** Keep PostgreSQL as the system of record and Redis as ephemeral security/cache infrastructure. Add enterprise functionality under focused domain/repository/router files and versioned `/api/v1` endpoints, leaving the current `/api/*` routes backward-compatible. All risk and alert calculations must preserve source/coverage semantics: missing data stays unavailable and never silently becomes zero.

**Tech Stack:** Node.js 22, Express 5, TypeScript 5.9, PostgreSQL, Redis 5.x client, Leaflet 1.9.4, Node test runner + supertest, Railway, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-15-enterprise-control-platform-design.md`

## Global Constraints

- Keep existing map and Muassasa 360° flows working throughout rollout.
- Additive database changes only; no destructive migration of current `institutions`, `institution_metrics`, or `audit_events` data.
- Unavailable metrics render and calculate as `N/A`, never `0`.
- Manual metrics remain explicitly `manual`; live values retain source/timestamp metadata.
- No DMED/OneID password, JShShIR, passport value, session cookie, connection string, or unnecessary patient identifier may enter application logs, audit metadata, or AI-facing payloads.
- Production authentication uses hashed passwords only.
- Protected writes require authenticated session, role/scope authorization, same-origin/CSRF protection, and audit logging.
- `/api/ready` must continue checking PostgreSQL and Redis.
- Mandatory tests, TypeScript build, and `npm audit --audit-level=high` must remain deployment gates.

## Review Focus

- **Partial data:** one institution has only 2 of 10 risk inputs; score must include `coveragePct` and must not treat 8 missing values as zero. Covered in Task 5 tests.
- **Scope escape:** district-scoped user requests another district’s institution directly by ID; server must return forbidden/not-visible even if the ID is valid. Covered in Task 4 tests.
- **Stale source:** last successful integration run exceeds its freshness threshold; status must become `stale` without deleting the last known value. Covered in Task 6 tests.
- **Duplicate alert storm:** repeated evaluation of the same active condition must update/retain one open alert instead of creating duplicates. Covered in Task 7 tests.
- **Session race/expiry:** expired, revoked, or idle-expired persisted session must fail authentication across replicas. Covered in Task 3 tests.

---

## File Structure

New focused files:

- `src/db/enterprise-schema.ts` — additive enterprise tables/indexes and bootstrap migration.
- `src/auth/types.ts` — enterprise roles, scopes, authenticated principal/session types.
- `src/auth/session-store.ts` — PostgreSQL-backed opaque session storage.
- `src/auth/authorization.ts` — permission and geographic/institution scope checks.
- `src/users/repository.ts` — user/role/scope reads and admin bootstrap.
- `src/risk/types.ts` — risk inputs/results.
- `src/risk/engine.ts` — deterministic score + coverage calculation.
- `src/risk/repository.ts` — risk score/factor persistence.
- `src/integrations/freshness.ts` — source freshness state calculation.
- `src/integrations/repository.ts` — integration source/run persistence and health queries.
- `src/alerts/engine.ts` — deterministic alert candidates and dedup key generation.
- `src/alerts/repository.ts` — alert upsert/list/ack primitives.
- `src/executive/service.ts` — Executive Today aggregate.
- `src/enterprise/router.ts` — `/api/v1` route composition only.
- `src/views/executive-today.ts` — server-rendered shell additions for the Bugun section.
- `public/js/executive-today.js` — client rendering/fetching for the Bugun page.
- `public/css/executive-today.css` — existing dark/light/TV-compatible enterprise UI styles.

Existing files modified:

- `src/db/index.ts` — invoke enterprise schema bootstrap; keep existing repositories intact.
- `src/auth/session.ts` — retain password hashing helpers; legacy in-memory manager remains test/backward compatibility only until persistent store cutover is complete.
- `src/auth/middleware.ts` — async persisted-session authentication and principal attachment.
- `src/app.ts` — wire repositories, session store, enterprise router, and Executive Today navigation.
- `src/views/dashboard.ts` — add `Bugun` navigation/section and enterprise asset references.
- `tests/**` — focused unit/integration/smoke tests for each task.

---

### Task 1: Add additive enterprise database schema

**Files:**
- Create: `src/db/enterprise-schema.ts`
- Modify: `src/db/index.ts`
- Test: `tests/db/enterprise-schema.test.ts`

**Interfaces:**
- Consumes: existing `Pool` from `pg`.
- Produces: `ensureEnterpriseSchema(pool: Pool): Promise<void>`.

- [ ] **Step 1: Write the failing schema contract test** asserting the migration SQL creates `users`, `user_scopes`, `sessions`, `integration_sources`, `integration_runs`, `risk_scores`, `risk_factors`, `alerts`, and the required status/date indexes without dropping current tables.
- [ ] **Step 2: Run** `npm test -- tests/db/enterprise-schema.test.ts` and verify the new contract fails because `ensureEnterpriseSchema` does not exist.
- [ ] **Step 3: Implement** `ensureEnterpriseSchema(pool: Pool): Promise<void>` with additive `create table if not exists` / `create index if not exists` statements and no destructive DDL.
- [ ] **Step 4: Wire** `ensureEnterpriseSchema` into the existing startup schema bootstrap after current institution/audit schema creation.
- [ ] **Step 5: Run** `npm test && npm run build`; expected PASS.
- [ ] **Step 6: Commit** `feat: add enterprise database schema`.

### Task 2: Add users, roles, and scope model

**Files:**
- Create: `src/auth/types.ts`
- Create: `src/users/repository.ts`
- Test: `tests/auth/users-rbac.test.ts`

**Interfaces:**
- Consumes: `Pool` and current env-backed admin identity for one-time bootstrap compatibility.
- Produces:
  - `EnterpriseRole = 'super_admin' | 'executive' | 'regional_specialist' | 'district_manager' | 'institution_manager' | 'viewer'`
  - `UserScope { districtKey?: string; institutionId?: string }`
  - `UserPrincipal { id: string; username: string; role: EnterpriseRole; scopes: UserScope[] }`
  - `createUserRepository(pool: Pool)` with `findByUsername(username)`, `findPrincipalById(id)`, `ensureBootstrapAdmin(input)`.

- [ ] **Step 1: Write failing repository tests** for admin bootstrap, principal hydration, disabled-user rejection, and duplicate username protection.
- [ ] **Step 2: Run** the focused test and verify failure.
- [ ] **Step 3: Implement** the types and repository with parameterized SQL only; store password hash, never plaintext.
- [ ] **Step 4: Add bootstrap compatibility** so the current configured admin can be materialized as `super_admin` without changing the user’s existing login flow yet.
- [ ] **Step 5: Run** focused tests, full test suite, and build.
- [ ] **Step 6: Commit** `feat: add enterprise users roles and scopes`.

### Task 3: Replace production in-memory sessions with persistent opaque sessions

**Files:**
- Create: `src/auth/session-store.ts`
- Modify: `src/auth/middleware.ts`
- Modify: `src/app.ts`
- Test: `tests/auth/persistent-session.test.ts`
- Test: `tests/auth/session-replica.test.ts`

**Interfaces:**
- Consumes: `Pool`, `UserPrincipal`.
- Produces `SessionStore` with:
  - `create(principal, metadata?): Promise<{ token: string; csrfToken: string; expiresAt: Date }>`
  - `get(token): Promise<PersistedSession | null>`
  - `verifyCsrf(token, candidate): Promise<boolean>`
  - `revoke(token): Promise<void>`
  - `revokeAllForUser(userId): Promise<void>`
- Tokens are random opaque values; database stores only a SHA-256 token hash.

- [ ] **Step 1: Write failing tests** for cross-instance session visibility, 8-hour absolute expiry, 30-minute idle expiry, explicit revoke, CSRF validation, and unknown token rejection.
- [ ] **Step 2: Run** focused tests and verify failure.
- [ ] **Step 3: Implement** PostgreSQL-backed `SessionStore` with hashed tokens and atomic last-seen update.
- [ ] **Step 4: Convert** `requireAuth`/`requireCsrf` middleware to async persisted-session lookups while keeping response semantics stable.
- [ ] **Step 5: Update login/logout** to create/revoke persisted sessions; rotate token on every successful login.
- [ ] **Step 6: Run** all auth/security tests, full tests, build, audit.
- [ ] **Step 7: Commit** `feat: persist secure sessions in postgres`.

### Task 4: Enforce role and geographic/institution scope server-side

**Files:**
- Create: `src/auth/authorization.ts`
- Modify: `src/auth/middleware.ts`
- Modify: `src/app.ts`
- Test: `tests/auth/scoped-authorization.test.ts`

**Interfaces:**
- Consumes: `UserPrincipal`, institution `{ id, districtKey }`.
- Produces:
  - `can(principal, permission): boolean`
  - `canAccessInstitution(principal, institution): boolean`
  - `requirePermission(permission)` Express middleware.

- [ ] **Step 1: Write failing permission matrix tests** for all six roles, including direct-ID scope escape attempts.
- [ ] **Step 2: Run** focused tests and verify failure.
- [ ] **Step 3: Implement** explicit permission map and district/institution scope evaluation; `super_admin` has global scope, other roles do not unless granted.
- [ ] **Step 4: Apply scope checks** to institution summary/modules/manual metric writes and new `/api/v1` endpoints.
- [ ] **Step 5: Run** authorization + smoke tests and build.
- [ ] **Step 6: Commit** `feat: enforce enterprise rbac scopes`.

### Task 5: Implement deterministic risk scoring with coverage

**Files:**
- Create: `src/risk/types.ts`
- Create: `src/risk/engine.ts`
- Create: `src/risk/repository.ts`
- Test: `tests/risk/risk-engine.test.ts`
- Test: `tests/risk/risk-repository.test.ts`

**Interfaces:**
- Produces:
  - `RiskFactorInput { key: string; weight: number; normalizedRisk: number | null; sourceState: string }`
  - `RiskResult { score: number | null; severity: 'green' | 'amber' | 'red' | 'unavailable'; coveragePct: number; factors: RiskFactorResult[] }`
  - `calculateRisk(inputs: RiskFactorInput[]): RiskResult`
  - `saveRiskResult(pool, institutionId, result, calculatedAt): Promise<void>`
- Severity thresholds: green `0–39`, amber `40–69`, red `70–100`.

- [ ] **Step 1: Write failing tests** for complete data, partial coverage, all-unavailable inputs, weights, threshold boundaries, and invalid normalized input rejection/clamping policy.
- [ ] **Step 2: Run** focused tests and verify failure.
- [ ] **Step 3: Implement** weighted scoring using available factors only; `coveragePct` uses total configured weight as denominator; all missing returns `score: null` and `unavailable`.
- [ ] **Step 4: Implement** persistence of score plus individual factors in one transaction.
- [ ] **Step 5: Run** risk tests, full tests, build.
- [ ] **Step 6: Commit** `feat: add coverage-aware risk engine`.

### Task 6: Add data freshness and Integration Health Center backend

**Files:**
- Create: `src/integrations/freshness.ts`
- Create: `src/integrations/repository.ts`
- Test: `tests/integrations/freshness.test.ts`
- Test: `tests/integrations/repository.test.ts`

**Interfaces:**
- Produces:
  - `SourceHealthStatus = 'online' | 'degraded' | 'offline' | 'auth_required' | 'stale' | 'unavailable'`
  - `evaluateFreshness({ lastSuccessAt, now, staleAfterMs, lastError }): SourceHealthStatus`
  - repository methods `recordRun`, `listHealth`, `upsertSource`.

- [ ] **Step 1: Write failing tests** covering fresh success, stale success, failed run after prior success, never-configured source, auth-required source, and clock boundary exactly at stale threshold.
- [ ] **Step 2: Run** focused tests and verify failure.
- [ ] **Step 3: Implement** freshness state as a pure deterministic function.
- [ ] **Step 4: Implement** integration source/run repository with parameterized SQL and last-success/latency metadata.
- [ ] **Step 5: Run** integration tests, full tests, build.
- [ ] **Step 6: Commit** `feat: add integration freshness health model`.

### Task 7: Implement deduplicated Smart Alert engine

**Files:**
- Create: `src/alerts/engine.ts`
- Create: `src/alerts/repository.ts`
- Test: `tests/alerts/alert-engine.test.ts`
- Test: `tests/alerts/alert-repository.test.ts`

**Interfaces:**
- Produces:
  - `AlertCandidate { institutionId?: string; sourceKey?: string; type: string; severity: 'info' | 'warning' | 'critical'; title: string; reason: string; dedupKey: string }`
  - `buildAlertCandidates(context): AlertCandidate[]`
  - `upsertActiveAlert(pool, candidate): Promise<AlertRecord>`
  - `listActiveAlerts(pool, scope): Promise<AlertRecord[]>`
- Active dedup uniqueness is based on `dedupKey` while status is open/acknowledged.

- [ ] **Step 1: Write failing tests** for red-risk alert, stale/offline source alert, no alert for unavailable/no-evidence data, deterministic dedup key, and repeated evaluation producing one active record.
- [ ] **Step 2: Run** focused tests and verify failure.
- [ ] **Step 3: Implement** candidate generation as pure rules; do not infer missing facts.
- [ ] **Step 4: Implement** transactional alert upsert/list behavior with deduplication.
- [ ] **Step 5: Run** alert tests, full tests, build.
- [ ] **Step 6: Commit** `feat: add deduplicated smart alerts`.

### Task 8: Add `/api/v1` enterprise router and Phase 1 endpoints

**Files:**
- Create: `src/enterprise/router.ts`
- Modify: `src/app.ts`
- Test: `tests/api/enterprise-v1.test.ts`

**Interfaces:**
- Consumes: session/authz middleware and enterprise repositories/services from Tasks 2–7.
- Produces endpoints:
  - `GET /api/v1/risk`
  - `GET /api/v1/risk/:institutionId`
  - `GET /api/v1/alerts`
  - `GET /api/v1/integrations/health`
  - `GET /api/v1/executive/today` (service wired in Task 9)

- [ ] **Step 1: Write failing endpoint tests** for unauthenticated 401, scope filtering, valid payload schemas, N/A/coverage behavior, and forbidden direct-ID access.
- [ ] **Step 2: Run** focused tests and verify failure.
- [ ] **Step 3: Implement** a focused router factory that receives dependencies instead of importing global state.
- [ ] **Step 4: Mount** under `/api/v1` in `src/app.ts`; leave existing `/api/*` routes unchanged.
- [ ] **Step 5: Run** API tests, smoke tests, full tests, build.
- [ ] **Step 6: Commit** `feat: expose enterprise v1 read api`.

### Task 9: Build Executive “Bugun” aggregate service

**Files:**
- Create: `src/executive/service.ts`
- Test: `tests/executive/today-service.test.ts`

**Interfaces:**
- Produces `buildExecutiveToday(input): ExecutiveToday` with:
  - province summary counts
  - top attention institutions (max 10)
  - critical alerts
  - stale/offline sources
  - risk distribution
  - `generatedAt`
  - explicit data coverage metadata.

- [ ] **Step 1: Write failing tests** for ranking attention by severity/score, max-10 truncation, no-data state, scoped user filtering, and stale integration inclusion.
- [ ] **Step 2: Run** focused tests and verify failure.
- [ ] **Step 3: Implement** deterministic aggregate builder; no hidden AI or fabricated narrative.
- [ ] **Step 4: Wire** service to `GET /api/v1/executive/today`.
- [ ] **Step 5: Run** executive/API tests, full tests, build.
- [ ] **Step 6: Commit** `feat: add executive today aggregate`.

### Task 10: Add Executive “Bugun” production UI

**Files:**
- Create: `src/views/executive-today.ts`
- Create: `public/js/executive-today.js`
- Create: `public/css/executive-today.css`
- Modify: `src/views/dashboard.ts`
- Test: `tests/smoke/executive-today-ui.test.ts`

**Interfaces:**
- Consumes: `GET /api/v1/executive/today`.
- Produces: navigation item `Bugun` and an accessible executive section compatible with current dark/light/TV modes.

- [ ] **Step 1: Write failing UI smoke tests** asserting the new navigation/section/assets exist, preserve existing map/360 markup, expose no fake default numeric values, and retain responsive controls.
- [ ] **Step 2: Run** focused UI test and verify failure.
- [ ] **Step 3: Implement** the server-rendered section shell and navigation entry without restructuring current map/360 DOM contracts.
- [ ] **Step 4: Implement** client fetch/render states: loading, populated, N/A/no-data, API error.
- [ ] **Step 5: Implement** dark/light/TV-compatible styling using existing design tokens/classes where possible.
- [ ] **Step 6: Run** UI smoke tests, full tests, build.
- [ ] **Step 7: Commit** `feat: add executive today dashboard`.

### Task 11: Add enterprise recomputation orchestration without a worker service

**Files:**
- Create: `src/enterprise/recompute.ts`
- Modify: `src/enterprise/router.ts`
- Test: `tests/enterprise/recompute.test.ts`

**Interfaces:**
- Produces `recomputeInstitutionState(deps, institutionId): Promise<{ risk: RiskResult; alerts: AlertRecord[] }>`.
- Phase 1 remains request/admin-triggered and idempotent; no new Railway worker yet.

- [ ] **Step 1: Write failing orchestration tests** for risk calculation, persistence, alert dedup, all-unavailable data, and transaction/error behavior.
- [ ] **Step 2: Run** focused tests and verify failure.
- [ ] **Step 3: Implement** orchestration using Task 5/7 interfaces only; do not duplicate scoring/alert rules.
- [ ] **Step 4: Add** privileged `POST /api/v1/risk/:institutionId/recompute` protected by permission + CSRF + audit logging.
- [ ] **Step 5: Run** enterprise, security, full tests, build, audit.
- [ ] **Step 6: Commit** `feat: orchestrate enterprise risk and alerts`.

### Task 12: Production migration, compatibility, and release verification

**Files:**
- Modify: `README.md`
- Modify: `docs/ENTERPRISE-HARDENING.md` if present, otherwise create `docs/ENTERPRISE-OPERATIONS.md`
- Test: `tests/smoke/enterprise-production.test.ts`

**Interfaces:**
- Consumes all previous tasks.
- Produces a release candidate that preserves existing URLs and adds Phase 1 enterprise functionality.

- [ ] **Step 1: Write release smoke test** asserting `/api/health`, `/api/ready`, login, existing dashboard/map/360 paths, and new `/api/v1` authenticated endpoints coexist.
- [ ] **Step 2: Run** `npm test`; expected all tests PASS.
- [ ] **Step 3: Run** `npm run build`; expected PASS.
- [ ] **Step 4: Run** `npm audit --audit-level=high`; expected no high/critical gate failure.
- [ ] **Step 5: Update operations docs** with schema rollout, rollback semantics, new endpoints, session persistence, risk coverage semantics, and explicit account-level controls still outside code.
- [ ] **Step 6: Commit** `docs: document enterprise core operations`.
- [ ] **Step 7: Verify Railway deployment** reaches SUCCESS and `/api/ready` succeeds against PostgreSQL + Redis before declaring Phase 1 complete.

---

## Follow-on Plans (not implemented in this plan)

The approved spec is intentionally split so each delivery is independently testable:

1. **Enterprise Core — this plan:** RBAC, persistent sessions, risk, alerts, freshness/health, Executive Today.
2. **Control Workflow:** tasks, SLA, escalation, Audit Center UI, session management, MFA.
3. **Executive Analytics:** comparison, ranking, trends, heatmap, report center.
4. **Incident + AI Foundation:** incident workspace, aggregate-safe AI query layer, privacy/audit gates, then assistant UI.

Each follow-on plan must reference the same approved architecture spec and preserve the Global Constraints above.
