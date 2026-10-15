# Buxoro SSB 360 Enterprise — Architecture Design

Date: 2026-10-15
Status: Proposed / approved in chat, pending written-spec review
Repository: `cccczzzz778-byte/Dashboard360`

## 1. Purpose

Buxoro viloyati sog‘liqni saqlash boshqarmasi uchun mavjud xarita → hudud → muassasa → Muassasa 360° oqimini enterprise rahbar nazorati platformasiga kengaytirish.

Platforma rahbar va vakolatli mutaxassisga real ma’lumot manbalari asosida muassasa holatini ko‘rish, xavfni oldindan aniqlash, topshiriq berish, ijroni kuzatish, muassasalarni taqqoslash, integratsiyalarni nazorat qilish va keyinchalik xavfsiz AI yordamchisidan foydalanish imkonini beradi.

## 2. Non-goals

- Soxta yoki taxminiy statistikani “real” sifatida ko‘rsatish yo‘q.
- DMED/OneID login paroli, JShShIR, pasport ma’lumoti yoki session cookie’larini saqlash yo‘q.
- Birinchi bosqichda individual bemor darajasidagi klinik qaror beruvchi AI yo‘q.
- Rasmiy API bo‘lmagan tizimga access-control bypass qilinmaydi.

## 3. Existing baseline

Mavjud production arxitektura:

- Node.js 22 + Express 5 + TypeScript
- PostgreSQL — system of record
- Redis — rate limiting / ephemeral security state
- Leaflet + OpenStreetMap
- Secure HttpOnly session cookie
- CSP, HSTS, SameSite, CSRF, same-origin guard
- PostgreSQL audit events
- `/api/health` va `/api/ready`
- GitHub Actions test/build/npm audit quality gate
- Railway production deploy

Mavjud 360° nazorat modullari saqlanadi va yangi enterprise qatlamlar bilan bog‘lanadi.

## 4. Target architecture

Platforma 4 asosiy qatlamga bo‘linadi:

### Layer A — Data & Integrations

Vazifa: tashqi va ichki manbalardan ma’lumotni olish, normalizatsiya qilish, manba holatini va yangilanish vaqtini saqlash.

Components:

- `integration_sources`
- `integration_runs`
- `metric_snapshots`
- `data_freshness`
- source adapters: KPI / QR / Murojaatlar / DMED / Ona-bola / manual input
- source-specific credentials faqat server-side environment/secrets orqali

Har metric quyidagiga ega bo‘ladi:

- institution_id
- module_key
- metric_key
- value
- unit
- source
- source_timestamp
- ingested_at
- quality_state (`live`, `manual`, `catalog`, `stale`, `unavailable`)

### Layer B — Risk & Alert Engine

Vazifa: real metriclardan risk, anomaly va alert hosil qilish.

Components:

- rule engine
- weighted risk score
- anomaly detector
- alert deduplication
- escalation policy
- acknowledgement / resolution state

Risk score 0–100 bo‘ladi, lekin faqat mavjud metriclar bo‘yicha hisoblanadi. Yetishmayotgan metriclar avtomatik 0 deb olinmaydi. Score bilan birga `coverage_pct` majburiy ko‘rsatiladi.

Default severity:

- 0–39: green
- 40–69: amber
- 70–100: red

Bu thresholdlar admin konfiguratsiya orqali keyin o‘zgartirilishi mumkin.

### Layer C — Workflow & Control

Vazifa: signalni real boshqaruv harakatiga aylantirish.

Components:

- tasks / assignments
- SLA rules
- escalation
- comments
- status history
- evidence attachments metadata
- incident mode

Task lifecycle:

`open → accepted → in_progress → awaiting_review → resolved → closed`

Kritik alertdan avtomatik task yaratish imkoniyati bo‘ladi, lekin default holatda admin sozlamasi bilan boshqariladi.

### Layer D — Executive Analytics & AI

Vazifa: rahbar uchun qisqa xulosa, taqqoslash, trend, heatmap va keyinchalik AI yordamchi.

Components:

- Today / Executive brief
- institution comparison
- ranking
- trend analytics
- map heat layers
- report center
- AI query layer (later phase)

AI faqat ruxsat etilgan agregat va de-identifikatsiya qilingan ma’lumot bilan ishlaydi.

## 5. Enterprise feature set — 20 capabilities

### 5.1 Risk Score

Har muassasaga 0–100 risk score, severity, coverage va top sabablar.

### 5.2 Smart Alert Center

KPI pasayishi, stale data, integration outage, overdue task, kritik metric va anomaly alertlari.

### 5.3 Alert Escalation

Alert vaqtida acknowledge/resolved bo‘lmasa yuqori rolga ko‘tariladi.

### 5.4 Task Management

Muassasa yoki alert bo‘yicha topshiriq, mas’ul, muddat, prioritet, status.

### 5.5 SLA Control

Har task/alert turiga vaqt normasi; overdue va breach state.

### 5.6 Executive “Bugun” Panel

Bugun e’tibor talab qiladigan muassasalar, top alertlar, overdue tasklar, offline source va risk o‘zgarishlari.

### 5.7 Institution Comparison

2–5 ta muassasani yonma-yon metric, risk, trend va coverage bo‘yicha solishtirish.

### 5.8 Ranking

Muassasa va hudud reytingi; faqat coverage yetarli bo‘lsa score/rank chiqariladi.

### 5.9 Trend Analytics

Kunlik/haftalik/oylik trend, delta va moving average.

### 5.10 Anomaly Detection

Keskin o‘zgarishlarni rule-based/statistical usulda flag qilish. Birinchi versiya deterministic bo‘ladi.

### 5.11 Data Freshness

Har source va metricning oxirgi yangilanish va stale holati.

### 5.12 Integration Health Center

Online / degraded / offline / auth-required / stale status; latency va last-success metadata.

### 5.13 Audit Center

Login, failed login, admin change, metric change, task state change va security eventlarni filter bilan ko‘rish.

### 5.14 Users & Roles (RBAC)

Minimum rollar:

- super_admin
- executive
- regional_specialist
- district_manager
- institution_manager
- viewer

Access institution/district scope bilan cheklanadi.

### 5.15 MFA / 2FA

TOTP enrollment, backup codes va privileged role’lar uchun majburiy MFA.

### 5.16 Session Management

Active sessions, device fingerprint metadata, last seen, revoke single/all sessions.

### 5.17 Report Center

PDF/Excel export, scheduled reports, selected period, district/institution scope.

### 5.18 Heatmap Map

Risk, KPI, appeal, staffing, equipment va boshqa metriclar uchun map layer.

### 5.19 Incident Mode

Favqulodda vaziyat uchun alohida workspace: incident, affected institutions, owner, timeline, status, actions.

### 5.20 AI Executive Assistant — guarded foundation

Natural-language question layer keyingi fazada. U quyidagi guardrail’lar bilan ishlaydi:

- no raw credentials
- no session cookies
- no unnecessary patient identifiers
- aggregate-first data access
- prompt/action audit trail
- role-scoped retrieval
- no unsupported clinical diagnosis

## 6. Data model additions

Planned core tables:

- `users`
- `roles`
- `user_scopes`
- `mfa_credentials`
- `sessions`
- `integration_sources`
- `integration_runs`
- `metric_snapshots`
- `risk_scores`
- `risk_factors`
- `alerts`
- `alert_events`
- `tasks`
- `task_events`
- `sla_policies`
- `incidents`
- `incident_events`
- `report_jobs`
- `audit_events` (existing; expanded indexes/query layer)

All mutable business entities have timestamps and actor metadata.

## 7. API design

Versioned enterprise API namespace:

- `GET /api/v1/executive/today`
- `GET /api/v1/risk`
- `GET /api/v1/risk/:institutionId`
- `GET /api/v1/alerts`
- `POST /api/v1/alerts/:id/ack`
- `POST /api/v1/alerts/:id/resolve`
- `GET /api/v1/tasks`
- `POST /api/v1/tasks`
- `PATCH /api/v1/tasks/:id`
- `GET /api/v1/compare`
- `GET /api/v1/rankings`
- `GET /api/v1/trends`
- `GET /api/v1/integrations/health`
- `GET /api/v1/audit`
- `GET /api/v1/users`
- `POST /api/v1/users`
- `POST /api/v1/mfa/enroll`
- `POST /api/v1/mfa/verify`
- `GET /api/v1/sessions`
- `DELETE /api/v1/sessions/:id`
- `POST /api/v1/reports`
- `GET /api/v1/incidents`

Existing API remains backward-compatible until migration completes.

## 8. Security architecture

### Authentication

- password hash only
- secure HttpOnly cookie
- CSRF for state-changing browser requests
- MFA for privileged roles
- session rotation on login and privilege elevation

### Authorization

Every protected endpoint checks:

1. authenticated session
2. role permission
3. geographic/institution scope
4. action permission

### Audit

Audit events must not contain:

- password
- token
- cookie
- authorization header
- connection string
- API key
- JShShIR/passport unless explicitly required by approved policy (default prohibited)

### Network / runtime

- non-root container
- readiness includes PostgreSQL + Redis
- bounded HTTP timeouts
- graceful shutdown
- no external JS CDN
- strict CSP

## 9. Data quality policy

Every displayed number must carry a source state.

Rules:

- unavailable → N/A
- stale → value may display with STALE warning
- manual → MANUAL badge
- live → source + timestamp
- catalog → static metadata only

Rankings and risk calculations must expose coverage percentage so incomplete data cannot look authoritative.

## 10. UI architecture

New top-level navigation:

- Bugun
- Xarita
- Muassasa 360°
- Risk & Alertlar
- Topshiriqlar
- Taqqoslash
- Reyting
- Integratsiyalar
- Audit
- Hisobotlar
- Incident
- Admin

Executive Today page:

- province risk summary
- top 10 attention institutions
- critical alerts
- overdue tasks
- data-source status
- trend deltas
- quick map

Muassasa 360° remains the deep-dive page.

## 11. Performance and reliability

- PostgreSQL indexes for institution/date/status queries
- Redis cache for executive aggregates with short TTL
- background jobs for risk recomputation and report generation in a later worker process
- API pagination for alerts/tasks/audit
- idempotent integration ingestion
- database transactions for state transitions

Initial target: one Railway web service + PostgreSQL + Redis. Worker service is introduced only when scheduled ingestion/report load justifies it.

## 12. Observability

- request ID
- structured logs
- readiness/liveness
- integration run status
- alert/task transition audit
- error rate and latency summary endpoint or provider metrics

No PHI/credential content in application logs.

## 13. Delivery phases

### Phase 1 — Enterprise core

- RBAC foundations
- persistent sessions
- risk engine
- alerts
- executive today
- data freshness
- integration health

### Phase 2 — Control workflow

- tasks
- SLA
- escalation
- audit center
- session management
- MFA

### Phase 3 — Analytics

- compare
- ranking
- trends
- heatmap
- report center

### Phase 4 — Incident + AI foundation

- incident mode
- AI-safe aggregate query service
- AI assistant UI only after privacy/security review

## 14. Testing strategy

Mandatory test categories:

- unit tests for risk, SLA, anomaly and permissions
- integration tests for PostgreSQL repositories
- endpoint auth/RBAC tests
- CSRF and session tests
- audit redaction tests
- migration tests
- smoke tests for dashboard
- build gate and `npm audit --audit-level=high`

Production deployment cannot proceed if mandatory tests fail.

## 15. Migration strategy

No destructive rewrite of existing production data.

- additive schema migrations first
- existing `institutionCatalog` and 360 modules remain
- new enterprise endpoints introduced under `/api/v1`
- old UI remains available during rollout
- switch navigation progressively
- rollback possible by reverting app version; additive DB tables remain harmless

## 16. Acceptance criteria

Enterprise core is accepted when:

1. Admin can log in securely.
2. Role/scope is enforced server-side.
3. Each institution can produce a risk score only from available data and show coverage.
4. Critical conditions generate deduplicated alerts.
5. Executive Today page shows real/no-fake states.
6. PostgreSQL/Redis readiness is green in production.
7. Audit events persist without secrets.
8. Failed tests block deployment.
9. Existing map and Muassasa 360° continue working.
10. No AI receives patient credentials or unnecessary identifiers.

## 17. Open account-level controls

These are outside ordinary application code and remain tracked separately:

- repository private visibility
- main branch protection
- GitHub secret scanning / push protection
- collaborator least privilege
- Railway PostgreSQL backup/PITR + restore test
- administrator MFA enrollment

## 18. Recommended implementation order

1. database migrations + RBAC model
2. persistent sessions + scoped auth middleware
3. risk engine
4. alert engine
5. executive today API/UI
6. source freshness + integration health
7. tasks + SLA
8. audit center
9. MFA/session management
10. compare/ranking/trend/heatmap/report/incident
11. AI only after security and privacy gates pass
