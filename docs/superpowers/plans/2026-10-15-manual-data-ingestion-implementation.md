# Buxoro SSB 360 Manual Data Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, auditable “Ma’lumot yuklash markazi” where authorized users can enter structured metrics and narrative reports manually, import `.xlsx/.xls/.csv`, attach `.docx/.doc/.pdf/.txt` evidence, validate/approve revisions, and publish statistically correct values into Muassasa 360° without waiting for DMED/Ona-bola APIs.

**Architecture:** PostgreSQL remains the system of record for upload metadata, staging rows, immutable metric revisions and published compatibility values. File bytes live only in Railway S3-compatible object storage and pass through quarantine + malware scanning before parsing/download; a focused `/api/v1/uploads` router enforces session, RBAC, institution scope and CSRF. Existing map, Enterprise Core and `/api/admin/metrics` remain backward-compatible until the new center is proven in production.

**Tech Stack:** Node.js 22, Express 5, TypeScript 5.9, PostgreSQL, Redis, Railway object storage (S3-compatible), Node test runner + supertest, existing GitHub Actions security gate. New runtime libraries may include `@aws-sdk/client-s3`, `busboy`, `file-type`, `csv-parse`, and one audited parser that supports both `.xlsx` and `.xls`; no dependency may weaken the current `npm audit --audit-level=high` gate.

**Spec:** `docs/superpowers/specs/2026-10-15-manual-data-ingestion-design.md`

## Global Constraints

- Maximum upload size is **30 MB per file**; one multipart request accepts one file.
- Allowed file extensions are `.xlsx`, `.xls`, `.csv`, `.docx`, `.doc`, `.pdf`, `.txt` only.
- Reject executable/script/HTML/SVG/archive and macro-enabled Office formats (`.xlsm`, `.xltm`, `.docm`, `.dotm`).
- File-based content is quarantined and **must fail closed** until malware scan status is `clean`.
- Raw file bytes are never stored in PostgreSQL or the web-service filesystem.
- Uploaded Office formulas/macros are never executed; formula cells are rejected from statistical import.
- Workbook parsing limits: max 5 sheets, 10,000 data rows total, 50 columns per sheet, 250,000 parsed cells total, and 10,000 characters per cell.
- Patient-level JShShIR, passport number, phone number, medical-record ID and unnecessary personal health data are out of scope; the UI must warn users before upload.
- Only **approved structured rows** affect statistics. Narrative text and Word/PDF/TXT evidence are context only.
- Missing data remains `N/A`, never implicit `0`.
- Published metric keys remain namespaced as `<moduleKey>.<metricKey>`.
- Reporting period is explicit; monthly periods normalize to the first day of the month.
- Corrections create immutable new revisions; approved history is never overwritten/deleted.
- Every write requires authentication, permission, institution scope, same-origin/CSRF protection and audit logging.
- Existing map, light/dark/TV modes, Enterprise Core APIs, Redis/Postgres readiness and security headers must remain green.
- Build acceptance remains `npm test`, `npm run build`, and `npm audit --audit-level=high` with zero failing high/critical findings.

## Review Focus

- **OOXML/decompression bomb:** a small `.xlsx/.docx` that expands beyond parser limits must be rejected before resource exhaustion. Covered in Task 6.
- **MIME/extension mismatch:** a renamed executable/HTML/ZIP must never become a trusted document or downloadable file. Covered in Task 4.
- **Concurrent/double approval:** two approval requests for one upload must create one publication outcome and one current revision per institution/metric/period. Covered in Task 8.
- **Scanner/storage outage:** file-based uploads remain quarantined/unpublished, while text-only drafts can still work. Covered in Tasks 4 and 5.
- **Scope escape by guessed ID:** a district/institution-scoped user cannot read, upload, approve or download another institution’s data. Covered in Tasks 2, 7 and 9.

---

## File Structure

New focused files:

- `src/uploads/schema.ts` — additive upload/revision/definition tables and indexes.
- `src/uploads/types.ts` — upload, file, staging-row, revision and statistics types.
- `src/uploads/metric-definitions.ts` — canonical metric metadata and aggregation semantics.
- `src/uploads/repository.ts` — upload/file/row/history persistence primitives.
- `src/uploads/file-policy.ts` — extension, size, signature, safe-name and checksum rules.
- `src/uploads/storage.ts` — object-storage interface + S3 implementation and quarantine promotion.
- `src/uploads/scanner.ts` — scanner interface + ClamAV INSTREAM adapter with timeouts.
- `src/uploads/multipart.ts` — bounded single-file multipart reader.
- `src/uploads/parser.ts` — Excel/CSV parsing, mapping and resource limits.
- `src/uploads/validator.ts` — row/type/range/ratio validation.
- `src/uploads/publisher.ts` — transactional approval, revisioning and `institution_metrics` publication.
- `src/uploads/statistics.ts` — trends, change %, YTD and safe district/province aggregation.
- `src/uploads/router.ts` — `/api/v1/uploads` and metric-history endpoints.
- `src/views/data-upload.ts` — server-rendered upload-center shell.
- `public/js/data-upload.js` — upload-center client state, forms, preview and approval.
- `public/css/data-upload.css` — responsive dark/light UI.

Existing files modified:

- `src/db/enterprise-schema.ts` — invoke upload schema bootstrap.
- `src/auth/authorization.ts` — add `upload.create`, `upload.view`, `upload.approve`, `upload.download` permissions.
- `src/domain/modules.ts` — expose canonical metric templates for definition seeding without duplicating labels/units.
- `src/domain/institution.ts` — allow published import provenance consistently.
- `src/db/index.ts` — explicit-period compatibility upsert used by publisher.
- `src/app.ts` — wire repositories, storage/scanner, upload router and feature availability.
- `src/views/dashboard.ts` — add “Ma’lumot yuklash” navigation/section/assets.
- `src/views/institution-360.ts` and `public/js/institution-360.js` — provenance/history actions; keep legacy quick editor working.
- `.env.example` — object-storage/scanner variable names only, never real secrets.
- `package.json` — audited parser/storage/multipart dependencies.
- `README.md` — documented manual ingestion workflow.

---

### Task 1: Add additive upload/revision schema

**Files:**
- Create: `src/uploads/schema.ts`
- Modify: `src/db/enterprise-schema.ts`
- Test: `tests/uploads/schema.test.ts`

**Interfaces:**
- Consumes: `Pool` from `pg`.
- Produces: `ensureUploadSchema(pool: Pool): Promise<void>`.

- [ ] **Step 1: Write the failing schema contract test** asserting additive creation of `data_uploads`, `data_upload_files`, `data_upload_rows`, `metric_revisions`, `metric_definitions`, required foreign keys/indexes/status checks, and no `DROP`/`TRUNCATE`.
- [ ] **Step 2: Run** `npm test -- tests/uploads/schema.test.ts`; expected FAIL because upload schema does not exist.
- [ ] **Step 3: Implement** `ensureUploadSchema(pool)` and call it from `ensureEnterpriseSchema(pool)` after existing enterprise tables.
- [ ] **Step 4: Run** the focused test, then `npm test`; expected PASS with existing schema tests unchanged.
- [ ] **Step 5: Commit** `feat: add manual ingestion schema`.

### Task 2: Extend RBAC and institution-scope authorization

**Files:**
- Modify: `src/auth/authorization.ts`
- Test: `tests/auth/upload-rbac.test.ts`

**Interfaces:**
- Produces new `EnterprisePermission` values: `upload.create`, `upload.view`, `upload.approve`, `upload.download`.
- Role policy: `super_admin` all four; `regional_specialist` all four; `district_manager` create/view/approve/download within scope; `institution_manager` create/view/download within scope; `executive` view/download only; `viewer` view only.

- [ ] **Step 1: Write failing permission tests** for every role and a direct-ID scope escape case.
- [ ] **Step 2: Run** `npm test -- tests/auth/upload-rbac.test.ts`; expected FAIL for unknown upload permissions.
- [ ] **Step 3: Extend** `ENTERPRISE_PERMISSIONS` and `permissionsByRole` only; reuse `canAccessInstitution` for geographic scope.
- [ ] **Step 4: Run** RBAC tests and existing auth suite; expected PASS.
- [ ] **Step 5: Commit** `feat: add upload permissions`.

### Task 3: Define canonical metric metadata and aggregation rules

**Files:**
- Modify: `src/domain/modules.ts`
- Create: `src/uploads/metric-definitions.ts`
- Test: `tests/uploads/metric-definitions.test.ts`

**Interfaces:**
- Modify modules to export read-only `moduleMetricTemplates` or `listModuleMetricTemplates(moduleKey)`.
- Produce `MetricDefinition`, `buildMetricDefinitions()`, `getMetricDefinition(moduleKey, metricKey)`.

Rules:
- count/currency units (`ta`, `nafar`, `birlik`, `so‘m`) default to `sum`;
- percent metrics accept 0–100; cross-institution aggregation is `ratio` only when numerator+denominator exist, otherwise `non_aggregatable`;
- textual/`holat`/rank and ambiguous averages default to `latest` or `non_aggregatable`, never blind averaging;
- metric keys stored as namespaced keys.

- [ ] **Step 1: Write failing tests** covering count, percent, textual and duplicate local keys such as `appeals.overdue` vs `execution.overdue`.
- [ ] **Step 2: Run** focused test; expected FAIL.
- [ ] **Step 3: Export canonical templates and implement definition builder/lookup** without duplicating the 30-module labels.
- [ ] **Step 4: Run** module + definition tests; expected PASS.
- [ ] **Step 5: Commit** `feat: define import metric semantics`.

### Task 4: Add bounded file policy, checksum and multipart intake

**Files:**
- Modify: `package.json`
- Create: `src/uploads/file-policy.ts`
- Create: `src/uploads/multipart.ts`
- Test: `tests/uploads/file-policy.test.ts`
- Test: `tests/uploads/multipart.test.ts`

**Interfaces:**
- Produce `validateUploadFile(input): Promise<ValidatedFile>` with `{originalName, extension, contentType, sizeBytes, sha256, buffer}`.
- Produce `readSingleUpload(req, { maxBytes: 31_457_280 }): Promise<IncomingUploadFile>`.

- [ ] **Step 1: Add failing tests** for 30 MB boundary, second-file rejection, macro/executable/HTML/archive rejection, sanitized filename, SHA-256 and extension/signature mismatch.
- [ ] **Step 2: Add only the minimum multipart/signature dependencies** (`busboy`, `file-type` or audited equivalents), run `npm audit --audit-level=high`; do not continue if it fails.
- [ ] **Step 3: Implement bounded multipart and file policy**; never write temp bytes to disk.
- [ ] **Step 4: Run focused tests + full test/build/audit**.
- [ ] **Step 5: Commit** `feat: validate bounded upload files`.

### Task 5: Add Railway object storage and quarantine/scanner adapters

**Files:**
- Create: `src/uploads/storage.ts`
- Create: `src/uploads/scanner.ts`
- Modify: `.env.example`
- Modify: `package.json`
- Test: `tests/uploads/storage.test.ts`
- Test: `tests/uploads/scanner.test.ts`

**Interfaces:**
- `ObjectStorage.putQuarantine(input): Promise<{storageKey:string}>`
- `ObjectStorage.promote(quarantineKey, finalKey): Promise<void>`
- `ObjectStorage.get(key): Promise<Buffer>`
- `ObjectStorage.delete(key): Promise<void>`
- `FileScanner.scan(buffer): Promise<{status:'clean'|'infected'|'error'; engine:string}>`

- [ ] **Step 1: Write failing tests** for server-generated keys, quarantine prefix, storage failure, scanner timeout/unavailable and infected-file rejection.
- [ ] **Step 2: Add `@aws-sdk/client-s3` (or audited compatible client), run security audit**.
- [ ] **Step 3: Implement S3 adapter** using Railway S3-compatible endpoint/bucket credentials supplied only through environment variables.
- [ ] **Step 4: Implement ClamAV INSTREAM adapter using `node:net`** with bounded buffer and timeout; scanner errors must not return clean.
- [ ] **Step 5: Run focused + full verification and commit** `feat: add quarantined object storage`.

### Task 6: Parse Excel/CSV safely and produce preview rows

**Files:**
- Create: `src/uploads/parser.ts`
- Create: `src/uploads/template.ts`
- Test: `tests/uploads/parser.test.ts`
- Test: `tests/uploads/template.test.ts`

**Interfaces:**
- `parseStructuredFile(input: {extension, buffer, mapping?}): Promise<ParsedUpload>`
- `buildModuleTemplate(moduleKey): Buffer|string`
- `ParsedUpload.rows` contains `rowNumber, metricKey, rawValue, numericValue, unit, numerator, denominator, note, formulaDetected`.

- [ ] **Step 1: Write failing tests** for `.xlsx`, `.xls`, `.csv`, standard headers and explicit non-standard column mapping.
- [ ] **Step 2: Add tests** that reject formula cells, >5 sheets, >10,000 rows, >50 columns, >250,000 cells, >10,000-character cells and malformed workbooks.
- [ ] **Step 3: Select one `.xlsx/.xls` parser only if its installed version passes the existing high-severity audit gate**; never disable the gate. Add `csv-parse` or an audited equivalent.
- [ ] **Step 4: Implement parser + module template generation** with no formula evaluation and no implicit zeroes.
- [ ] **Step 5: Run focused tests, full suite/build/audit and commit** `feat: parse spreadsheet imports safely`.

### Task 7: Persist upload drafts, narrative reports, files and staging rows

**Files:**
- Create: `src/uploads/types.ts`
- Create: `src/uploads/repository.ts`
- Test: `tests/uploads/repository.test.ts`

**Interfaces:**
- `createUpload(input): Promise<DataUpload>`
- `saveNarrative(uploadId, body): Promise<void>`
- `recordFile(input): Promise<DataUploadFile>`
- `replaceRows(uploadId, rows): Promise<void>`
- `getUpload(id)`, `listUploads(scope)`, `listRows(id)`, `transitionStatus(id, from, to)`.

- [ ] **Step 1: Write failing repository tests** asserting SQL parameterization, explicit period, narrative remains non-statistical, file scan metadata and valid status transitions.
- [ ] **Step 2: Add a concurrency/status test** showing an invalid backward transition cannot silently reopen an approved upload.
- [ ] **Step 3: Implement focused repository methods**; use `crypto.randomUUID()` in the application rather than database-specific UUID defaults.
- [ ] **Step 4: Run tests and commit** `feat: persist upload drafts and evidence metadata`.

### Task 8: Validate and transactionally publish approved metric revisions

**Files:**
- Create: `src/uploads/validator.ts`
- Create: `src/uploads/publisher.ts`
- Modify: `src/db/index.ts`
- Test: `tests/uploads/validator.test.ts`
- Test: `tests/uploads/publisher.test.ts`

**Interfaces:**
- `validateRows(upload, rows, definitions): ValidationSummary`
- `publishUpload(pool, uploadId, actor): Promise<PublishResult>`
- Add `upsertMetricForPeriod(pool, {institutionId, metricKey, value, unit, sourceType, sourceName, period})`.

- [ ] **Step 1: Write failing validator tests** for unknown metric, wrong module, invalid numeric/percent/range, zero ratio denominator, missing value and dirty file scan.
- [ ] **Step 2: Write failing publisher tests** for validated-only publication, explicit period, immutable revision numbers, prior `is_current=false`, import/manual provenance and no narrative publication.
- [ ] **Step 3: Add concurrent/double-approval test** using transaction row locking/idempotent status transition; expected one publication result.
- [ ] **Step 4: Implement validator and publisher** in one DB transaction; audit/optional risk recompute fires only after successful commit.
- [ ] **Step 5: Run focused + full verification and commit** `feat: validate and publish metric revisions`.

### Task 9: Add upload/history/statistics API with complete security checks

**Files:**
- Create: `src/uploads/statistics.ts`
- Create: `src/uploads/router.ts`
- Modify: `src/app.ts`
- Test: `tests/api/uploads-v1.test.ts`
- Test: `tests/uploads/statistics.test.ts`

**Interfaces:**
- Router mounted under `/api/v1`.
- Endpoints from the approved spec: create upload, manual row, narrative, file, parse, get/rows, validate, approve/reject, secure download, metric history and template download.
- `buildMetricStatistics(...)` returns current, previous, changePct, YTD and trend; `aggregateMetric(...)` returns ratio only from summed numerator/denominator.

- [ ] **Step 1: Write failing API tests** for auth, permission, CSRF and institution-scope checks on every write/read family.
- [ ] **Step 2: Write statistics tests** for `(100+900)/(200+1000)=83.33%`, missing baseline → `N/A`, denominator zero → `N/A`, and non-aggregatable percentage → `N/A` at province level.
- [ ] **Step 3: Implement router composition and statistics service**; return safe generic errors only.
- [ ] **Step 4: Add secure file download** with `Content-Disposition: attachment`, `nosniff`, clean-scan requirement and audit event.
- [ ] **Step 5: Run API/security suites and commit** `feat: expose secure ingestion api`.

### Task 10: Build Ma’lumot yuklash center UI

**Files:**
- Create: `src/views/data-upload.ts`
- Create: `public/js/data-upload.js`
- Create: `public/css/data-upload.css`
- Modify: `src/views/dashboard.ts`
- Test: `tests/ui/data-upload.test.ts`

**Interfaces:**
- New sidebar target `dataUploadSection`.
- Four entry methods: `Qo‘lda ko‘rsatkich`, `Yozma hisobot`, `Excel / CSV import`, `Word / PDF / TXT`.

- [ ] **Step 1: Write failing markup test** for sidebar item, institution/period/module selectors, four action cards, patient-data warning, upload history and assets.
- [ ] **Step 2: Implement server-rendered shell** as `dataUploadHtml()` and wire it into dashboard.
- [ ] **Step 3: Implement client flow** using bootstrap institutions/modules, CSRF token, upload list, manual/narrative draft forms, file progress, parser preview, row errors and approve/reject actions.
- [ ] **Step 4: Implement dark/light responsive CSS**; TV mode must not expose editing controls by default.
- [ ] **Step 5: Run UI + existing light/map/view-mode tests and commit** `feat: add data upload center ui`.

### Task 11: Add import mapping, templates and revision/provenance UX

**Files:**
- Modify: `public/js/data-upload.js`
- Modify: `src/views/institution-360.ts`
- Modify: `public/js/institution-360.js`
- Modify: `public/css/institution-pro.css`
- Test: `tests/ui/import-preview.test.ts`
- Test: `tests/ui/institution-history.test.ts`

**Interfaces:**
- Mapping UI maps detected source columns to `metric_key`, `value`, `unit`, `period`, `numerator`, `denominator`, `note`.
- Metric history action requests `/api/v1/institutions/:id/metrics/history?metricKey=<namespaced>`.

- [ ] **Step 1: Write failing tests** for mapping controls, valid/error preview counts, template download and history/provenance labels.
- [ ] **Step 2: Implement preview/mapping**; invalid rows cannot expose an Approve-success state.
- [ ] **Step 3: Update 360° badge copy** so `source_type=imported` from this subsystem shows `Excel import`/source name rather than being confused with the institution catalog.
- [ ] **Step 4: Add revision-history dialog** showing period, revision, source, publisher and timestamp without exposing file/storage secrets.
- [ ] **Step 5: Run UI/full dashboard regression tests and commit** `feat: show import provenance and history`.

### Task 12: Wire audit, privacy and operational failure states

**Files:**
- Modify: `src/audit/store.ts` only if additional metadata sanitization is required by failing tests.
- Modify: `src/uploads/router.ts`
- Test: `tests/audit/upload-audit.test.ts`
- Test: `tests/security/upload-security.test.ts`

**Interfaces:**
- Audit events: `upload_created`, `file_uploaded`, `file_scan_started`, `file_scan_clean`, `file_scan_rejected`, `upload_parsed`, `upload_validated`, `upload_approved`, `upload_rejected`, `metric_revision_published`, `file_downloaded`.

- [ ] **Step 1: Write failing audit tests** proving file bytes, passwords, cookies, credentials, storage secrets and patient identifiers are not persisted to audit metadata.
- [ ] **Step 2: Write failure-state tests** for storage unavailable, scanner unavailable, parser failure and database publication rollback.
- [ ] **Step 3: Implement missing audit/failure handling** with user-safe status codes and request IDs.
- [ ] **Step 4: Run security/audit/full suite and commit** `security: harden manual ingestion audit flow`.

### Task 13: Provision Railway storage/scanner and feature configuration

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Railway resources/config only; no secrets committed.

**Interfaces / configuration names:**
- `UPLOADS_ENABLED`
- `UPLOAD_S3_ENDPOINT`
- `UPLOAD_S3_REGION`
- `UPLOAD_S3_BUCKET`
- `UPLOAD_S3_ACCESS_KEY_ID`
- `UPLOAD_S3_SECRET_ACCESS_KEY`
- `CLAMAV_HOST`
- `CLAMAV_PORT`

- [ ] **Step 1: Create a Railway object-storage bucket** and bind service variables using Railway references rather than copied secrets.
- [ ] **Step 2: Provision a private-network malware-scanner service** (ClamAV/equivalent) with no public TCP exposure; configure host/port references.
- [ ] **Step 3: Keep `UPLOADS_ENABLED=false` until storage + scanner readiness checks pass**, then enable it.
- [ ] **Step 4: Verify redeploy persistence** by uploading a harmless test document, redeploying web, and confirming authorized download still works.
- [ ] **Step 5: Document the workflow and operational recovery steps** and commit documentation changes if needed.

### Task 14: Production verification and controlled rollout

**Files:**
- Test: `tests/smoke/manual-ingestion.test.ts`
- Modify existing smoke tests only where new stable assertions belong.

- [ ] **Step 1: Add a smoke flow**: login → create manual draft → validate → approve → 360 summary shows source/value; narrative does not alter metric; unauthorized scope is blocked.
- [ ] **Step 2: Run locally/CI:** `npm test`, `npm run build`, `npm audit --audit-level=high`; expected all PASS and zero high/critical vulnerabilities.
- [ ] **Step 3: Open PR from an isolated implementation branch** and require GitHub “Security and quality gate” success before merge.
- [ ] **Step 4: Merge only after review, wait for Railway production deployment `SUCCESS`, and check `/api/ready`, runtime logs, PostgreSQL, Redis, object storage/scanner behavior and zero current warning/critical issues.
- [ ] **Step 5: Execute production acceptance sample** with non-sensitive dummy aggregate data for manual, narrative, CSV/XLSX and evidence upload; verify history/provenance/N/A semantics, then leave the feature enabled.

---

## Self-Review Result

- **Spec coverage:** schema, manual/narrative input, Excel/CSV, Word/PDF/TXT evidence, quarantine/scan, RBAC, audit, immutable revisioning, correct aggregation, N/A, UI, object storage, failure behavior and future API compatibility all map to tasks above.
- **Type/interface consistency:** namespaced metric keys and explicit reporting period flow from definition → staging → validation → publisher → history/statistics.
- **Security:** no file is parsed/downloaded/published before `clean`; no secret or patient identifier belongs in audit/log payloads; direct-ID scope checks remain server-side.
- **Backward compatibility:** current `/api/admin/metrics`, map and Muassasa 360° remain operational during rollout; new flow is feature-gated until production dependencies are ready.
- **Dependency risk:** the `.xls/.xlsx` parser is a hard audit gate. If no parser meeting the current high-severity policy is available at execution time, stop that task and revise the dependency choice; do not weaken the security gate.
