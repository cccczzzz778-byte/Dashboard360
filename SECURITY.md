# Dashboard360 Security Policy

Dashboard360 is an internal healthcare management system. Security and privacy defects are treated as production incidents.

## Never disclose in GitHub issues, commits, screenshots or logs
- passwords, API keys, bearer tokens, session/CSRF cookies;
- PostgreSQL or Redis connection strings;
- OneID/DMED credentials;
- passport/JShShIR identifiers;
- patient names, phone numbers, addresses, diagnoses or other identifiable clinical data.

Use synthetic or redacted data when reproducing a problem.

## Production controls
- Production authentication requires a scrypt password hash; plaintext password fallback is development-only.
- Sessions use Secure/HttpOnly/SameSite cookies, absolute and idle expiry, CSRF protection and role checks.
- Login brute-force protection is distributed through Redis with a local fail-safe limiter.
- Security-relevant events are sanitized and persisted in PostgreSQL audit history.
- Browser security policy includes HSTS, CSP, frame denial, permissions restrictions and same-origin write validation.
- Dynamic authenticated responses are not cacheable.
- The application container runs as an unprivileged user and production dependencies are pruned.
- `/api/health` is liveness; `/api/ready` verifies required dependencies without revealing credentials.

## Incident response
1. Revoke or rotate any exposed credential immediately.
2. Preserve audit records and deployment logs.
3. Identify the affected user, endpoint, institution and time range without copying patient data into tickets.
4. Patch and verify with automated tests before production deployment.
5. Rotate sessions/credentials when authentication material may have been exposed.

## AI safety boundary
AI features must not receive raw OneID/DMED credentials, session cookies or unnecessary patient identifiers. AI access must be scoped to the minimum fields needed for the requested management analysis, with authorization and audit controls applied before data leaves the application boundary.
