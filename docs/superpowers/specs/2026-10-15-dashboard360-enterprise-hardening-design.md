# Dashboard360 Enterprise Hardening Design

## Goal
Dashboard360 must remain usable during infrastructure faults while protecting medical-management data, administrator access and future AI integrations. The production architecture should be secure-by-default, observable, horizontally scalable and recoverable without changing the existing dashboard UX.

## Architecture
- Keep PostgreSQL as the system of record for institutions, metrics and durable audit events.
- Add Redis as an optional-but-preferred shared infrastructure service for distributed login throttling and future shared session/cache workloads.
- Keep the existing in-memory protections as a fail-safe so Redis failure does not remove brute-force protection.
- Add explicit liveness (`/api/health`) and dependency readiness (`/api/ready`) probes without leaking credentials or topology.
- Persist security-relevant audit events to PostgreSQL while continuing structured console logs for Railway observability.
- Harden the container with a multi-stage build, production-only dependencies and a non-root runtime user.
- Add graceful HTTP shutdown/timeouts and Railway tracing/restart policy.
- Add CI security gates and Dependabot. No AI feature may receive DMED/OneID credentials or patient identifiers by default.

## Security controls
1. Existing hashed admin password, strict cookie, RBAC, CSRF, CSP, HSTS and same-origin protections remain mandatory.
2. Login throttling must work across replicas when Redis is available and still work locally when Redis is unavailable.
3. Audit metadata must never contain passwords, session tokens, CSRF tokens, connection strings or raw IP addresses.
4. Readiness responses must expose only boolean service health, not hostnames, passwords or connection strings.
5. The application must run as an unprivileged OS user.
6. Production startup must fail safely when required configuration is absent rather than silently using a weak default.

## Reliability controls
- Database and Redis checks use short timeouts.
- SIGTERM/SIGINT trigger graceful connection draining.
- Restart policy is ON_FAILURE.
- Existing successful deployment remains active until a new build passes tests and healthcheck.

## Deferred controls
- User enrollment for TOTP/MFA (requires deliberate administrator setup).
- External SSO/OneID for Dashboard360 itself.
- PostgreSQL PITR/backups where Railway account-level backup controls are required.
- AI/RAG access to clinical data until data minimization and authorization boundaries are finalized.
