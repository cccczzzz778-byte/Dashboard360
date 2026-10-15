# Buxoro SSB 360 — Manual Data Ingestion & Evidence Center Design

**Date:** 2026-10-15  
**Status:** Proposed / user-approved concept, awaiting written-spec review  
**Repository:** `cccczzzz778-byte/Dashboard360`

## 1. Purpose

Until official read-only APIs are available for DMED, Ona-bola and other external systems, Buxoro SSB 360 must support a safe, auditable and statistically correct manual data workflow.

The system must let authorized users:

1. enter structured indicators manually;
2. import structured data from Excel/CSV;
3. attach Word/PDF/TXT documents as evidence/reference material;
4. validate and approve imported values before they affect dashboards;
5. preserve who uploaded what, when, for which institution and period;
6. retain revision history instead of silently overwriting prior submissions;
7. show source provenance (`Manual`, `Excel import`, later `Live API`) on every published metric;
8. compute statistics from approved structured values only;
9. keep missing values as `N/A`, never fabricate zeroes;
10. transition to API-based sources later without losing manual history.

## 2. Scope

### In scope

- New sidebar section: **Ma’lumot yuklash**.
- Institution, reporting period and monitoring module selection.
- Manual indicator entry.
- Excel (`.xlsx`, `.xls`) and CSV (`.csv`) upload and parsing.
- Word (`.docx`, `.doc`), PDF (`.pdf`) and text (`.txt`) attachment as evidence.
- Upload validation and preview.
- Draft → validated → approved/rejected workflow.
- File metadata, checksum, version history and audit trail.
- Object-storage based file persistence.
- Publishing approved rows into the existing 360° metric surface.
- Statistical aggregation with explicit aggregation rules.
- RBAC and institution-scope enforcement.
- Safe error handling and limits.

### Out of scope for this phase

- OCR of scanned PDFs/images.
- AI extraction of arbitrary Word/PDF content into official statistics.
- Automatic login/session scraping of DMED or Ona-bola.
- Patient-level identifiers or medical records ingestion.
- Editing source Office/PDF files inside the dashboard.

These can be added later as separate, explicitly approved phases.

## 3. Core Principle

**Files are evidence; structured approved values are statistics.**

A Word/PDF attachment must never automatically create a numeric KPI. Excel/CSV rows may be parsed into a staging area, but they affect dashboards only after validation and approval.

Missing data remains `N/A`. A file upload must never imply a value of `0`.

## 4. User Flow

### 4.1 Entry point

Sidebar:

`Ma’lumot yuklash`

Page header:

`Ma’lumot yuklash markazi`

Required context:

- Muassasa
- Davr
- Modul
- Kiritish usuli

Input methods:

1. **Qo‘lda kiritish**
2. **Excel / CSV import**
3. **Word / PDF / TXT hujjat biriktirish**

### 4.2 Manual entry

User selects institution, period and module, then fills:

- indicator/metric;
- value;
- unit;
- optional note;
- optional evidence file.

The value is first stored as a draft revision. It becomes visible in production statistics only after approval.

### 4.3 Excel/CSV import

Preferred template columns:

| Column | Meaning |
| --- | --- |
| `metric_key` | canonical indicator key |
| `metric_name` | human-readable name |
| `value` | numeric/text value |
| `unit` | unit |
| `period` | reporting period |
| `numerator` | optional numerator for ratios |
| `denominator` | optional denominator for ratios |
| `note` | optional explanation |

The system provides downloadable templates per monitoring module.

For non-standard spreadsheets, the user can map detected columns to the canonical fields once before validation.

Import stages:

`Uploaded → Parsed → Preview → Validated → Approved → Published`

Any invalid row remains unpublished and is shown with a clear error reason.

### 4.4 Word/PDF/TXT attachment

Accepted as evidence/reference material. The user must still enter or approve the structured metrics separately.

`.docx` may later support safe text preview. Legacy `.doc` is accepted as an attachment only in this phase.

PDF is not treated as a source of automatically extracted statistics in this phase.

## 5. Data Model

The existing `institution_metrics` table remains the published/latest metric surface for backward compatibility.

New additive tables:

### `data_uploads`

- `id uuid primary key`
- `institution_id text not null`
- `module_key text not null`
- `period date not null`
- `method text not null` (`manual`, `excel`, `csv`, `document`)
- `status text not null` (`draft`, `parsed`, `validated`, `approved`, `rejected`, `failed`)
- `created_by text not null`
- `approved_by text`
- `created_at timestamptz`
- `approved_at timestamptz`
- `note text`

### `data_upload_files`

- `id uuid primary key`
- `upload_id uuid not null`
- `storage_key text not null`
- `original_name text not null`
- `content_type text not null`
- `size_bytes bigint not null`
- `sha256 text not null`
- `extension text not null`
- `created_at timestamptz`

No raw file bytes are stored in PostgreSQL.

### `data_upload_rows`

Staging rows parsed from manual/Excel/CSV input.

- `id bigserial primary key`
- `upload_id uuid not null`
- `row_number integer`
- `metric_key text`
- `raw_value text`
- `numeric_value numeric`
- `unit text`
- `numerator numeric`
- `denominator numeric`
- `validation_status text`
- `validation_error text`
- `note text`

### `metric_revisions`

Immutable history of approved/published metric revisions.

- `id bigserial primary key`
- `institution_id text not null`
- `metric_key text not null`
- `period date not null`
- `metric_value text`
- `numeric_value numeric`
- `unit text`
- `source_type text not null`
- `source_name text`
- `upload_id uuid`
- `revision_no integer not null`
- `published_by text not null`
- `published_at timestamptz not null`
- `is_current boolean not null default true`

Publishing a new value for the same institution/metric/period marks the former revision non-current but never deletes it.

### `metric_definitions`

Defines calculation semantics.

- `metric_key text primary key`
- `module_key text not null`
- `label text not null`
- `data_type text not null` (`number`, `percent`, `text`, `boolean`)
- `unit text`
- `aggregation_method text not null`
- `min_value numeric`
- `max_value numeric`
- `requires_numerator_denominator boolean default false`

Supported aggregation methods:

- `sum`
- `latest`
- `average`
- `weighted_average`
- `ratio`
- `non_aggregatable`

## 6. Publication Contract

Only approved staging rows are published.

On publication:

1. write immutable revision to `metric_revisions`;
2. update `institution_metrics` as the current compatibility/latest value;
3. preserve source metadata;
4. create audit event;
5. trigger risk/alert recomputation only after a successful transaction.

Example provenance:

- `source_type = manual`
- `source_name = Buxoro SSB 360 · Manual`

or

- `source_type = import`
- `source_name = Excel import · <upload id>`

Future API values use `source_type = live` and do not erase historical manual/import revisions.

## 7. Statistics Rules

### 7.1 Period normalization

Reporting period is explicit. Monthly values are normalized to the first day of the month internally, e.g. October 2026 → `2026-10-01`.

Daily indicators retain a daily date where needed.

### 7.2 Aggregation correctness

Rates/percentages must not be averaged blindly.

Example:

- A: 100 / 200 = 50%
- B: 900 / 1000 = 90%

Province total must be `(100 + 900) / (200 + 1000) = 83.3%`, not `(50 + 90) / 2`.

Therefore ratio metrics store numerator and denominator where aggregation is required.

### 7.3 Trend statistics

For approved metrics the UI can calculate:

- current period;
- previous period;
- change `%`;
- year-to-date where meaningful;
- plan completion where plan metric exists;
- trend series by period.

Division-by-zero and missing-baseline cases return `N/A`, not infinity or zero.

## 8. File Storage

Files are stored in Railway-compatible S3/object storage, not the container filesystem and not PostgreSQL bytea.

The application stores only metadata and an opaque storage key.

Recommended bucket structure:

`uploads/<institution>/<year>/<month>/<upload-id>/<safe-file-name>`

Original names are retained only as metadata; storage filenames are server-generated.

## 9. File Security

Default maximum size: **30 MB per file**.

Allowed types:

- `.xlsx`
- `.xls`
- `.csv`
- `.docx`
- `.doc`
- `.pdf`
- `.txt`

Rejected examples:

- executables;
- scripts;
- HTML/SVG active content;
- archives in this phase (`.zip`, `.rar`, `.7z`);
- files whose extension and detected MIME/type conflict materially.

Controls:

- server-side allowlist;
- content-type and magic-signature inspection where practical;
- filename sanitization;
- server-generated storage key;
- SHA-256 checksum;
- 30 MB hard limit;
- bounded parser resources;
- spreadsheet formula cells treated as data/formula metadata, never executed;
- no macros executed;
- no uploaded HTML rendered inline;
- downloads served with safe `Content-Disposition`;
- RBAC and institution scope checked before upload and download;
- audit log for upload, validation, approval, rejection, download and publication.

## 10. Excel/CSV Validation

Validation layers:

1. file-level validation;
2. sheet-level validation;
3. row schema validation;
4. metric key validation against `metric_definitions`;
5. data-type validation;
6. min/max range validation where configured;
7. duplicate institution/metric/period detection;
8. ratio denominator validation;
9. user scope validation.

The import preview shows:

- valid rows;
- warning rows;
- rejected rows;
- total counts;
- exact error reason per row.

No partial silent import. Approved rows are explicit.

## 11. Approval Workflow

Statuses:

`draft → parsed → validated → approved`

Alternative endings:

`rejected` or `failed`.

Rules:

- uploader may save draft;
- validation may be automatic;
- approval requires an authorized approver role/permission;
- uploader and approver can initially be the same super-admin, but the data model supports separation;
- approved revision is immutable;
- correction creates a new revision.

## 12. RBAC

Extend existing permission model with:

- `upload.create`
- `upload.view`
- `upload.approve`
- `upload.download`

Institution and district scopes remain enforced.

A district-scoped user cannot upload or inspect files for another district even with a guessed direct ID.

## 13. API Surface

Proposed endpoints:

- `POST /api/v1/uploads`
- `POST /api/v1/uploads/:id/file`
- `POST /api/v1/uploads/:id/manual-row`
- `POST /api/v1/uploads/:id/parse`
- `GET /api/v1/uploads/:id`
- `GET /api/v1/uploads/:id/rows`
- `POST /api/v1/uploads/:id/validate`
- `POST /api/v1/uploads/:id/approve`
- `POST /api/v1/uploads/:id/reject`
- `GET /api/v1/uploads/:id/files/:fileId`
- `GET /api/v1/institutions/:id/metrics/history`

All write endpoints require authenticated session, permission, institution scope and CSRF protection.

## 14. UI Design

### Main upload center

Top filters:

- Muassasa
- Davr
- Modul

Three action cards:

- `Qo‘lda kiritish`
- `Excel / CSV import`
- `Word / PDF / TXT`

Upload list columns:

- Muassasa
- Davr
- Modul
- Usul
- Fayl
- Holat
- Yuklagan
- Sana
- Tasdiqlagan
- Amallar

### Import preview

Summary cards:

- Jami qator
- To‘g‘ri
- Ogohlantirish
- Xato

Rows with errors are highlighted and show the reason.

### Institution 360°

Metric cards continue to show value plus provenance badge:

- `Manual`
- `Excel import`
- later `Jonli`
- `N/A`

History action shows revisions for the selected metric.

## 15. Object Storage Failure Behavior

If object storage is unavailable:

- manual values without evidence can still be saved as draft if policy allows;
- file-based imports are not published;
- upload status becomes `failed` or remains draft with a clear error;
- no database record claims the file is safely stored when upload failed.

If database publication fails after file storage succeeds, the file remains unreferenced only until a cleanup/retry routine resolves it. Publication is transactional at database level.

## 16. Parsing Dependencies

Likely implementation dependencies:

- `multer` or equivalent bounded multipart handler;
- `xlsx`-compatible parser for Excel;
- CSV parser with strict limits;
- optional safe `.docx` text extraction library only for preview, not statistics;
- content-signature/MIME validation helper.

Dependency choice must pass the existing high-severity npm audit gate. If a package introduces unacceptable vulnerabilities, use a safer alternative or reduce scope.

## 17. Audit Events

New events include:

- `upload_created`
- `file_uploaded`
- `upload_parsed`
- `upload_validated`
- `upload_approved`
- `upload_rejected`
- `metric_revision_published`
- `file_downloaded`

Audit metadata must never store file bytes, passwords, cookies, tokens or patient identifiers.

## 18. Privacy Rules

This ingestion phase is designed for **institution-level aggregate operational statistics**.

Do not upload patient-level exports containing JShShIR, passport numbers, phone numbers, medical record IDs or unnecessary personal health data.

If a future workflow truly requires patient-level data, it must be designed as a separate privacy/security phase with explicit authorization and field-level controls.

## 19. Testing Strategy

TDD is required.

Test groups:

1. schema is additive;
2. RBAC and direct-ID scope blocking;
3. file extension/type/size rejection;
4. checksum and storage-key generation;
5. Excel/CSV parsing;
6. formula cells are never executed;
7. malformed rows stay unpublished;
8. approval publishes only validated rows;
9. revision history is immutable;
10. correction creates new revision;
11. percentage aggregation uses numerator/denominator;
12. missing values remain `N/A`;
13. audit events contain no secrets;
14. object-storage failure does not publish data;
15. current map/360/security regression suite remains green.

## 20. Rollout

### Phase A — Foundation

- schema;
- permissions;
- upload metadata;
- object storage adapter;
- manual structured entry;
- revision history.

### Phase B — Excel/CSV

- templates;
- parser;
- preview;
- validation;
- approval/publish.

### Phase C — Document evidence

- Word/PDF/TXT attachments;
- secure download;
- metadata/history.

### Phase D — Statistics UX

- period comparison;
- trends;
- province/district aggregation;
- revision/source display.

### Phase E — Future API migration

When official DMED/Ona-bola API access is issued:

- add source adapters;
- publish `live` revisions;
- keep manual/import history intact;
- display source priority and freshness;
- never silently rewrite historical approved records.

## 21. Rollback Strategy

All schema changes are additive. Existing manual metric APIs and current 360° rendering remain functional during rollout.

New upload UI and routes can be feature-gated. If the feature is disabled, existing dashboard behavior remains unchanged.

Object storage can be disconnected without deleting metric history; file-based imports simply become unavailable until restored.

## 22. Acceptance Criteria

The phase is accepted when:

1. authorized user can choose institution, period and module;
2. user can enter manual structured values;
3. user can upload Excel/CSV and preview parsed rows;
4. invalid rows cannot reach production statistics;
5. user can attach Word/PDF/TXT evidence;
6. files survive web-service redeploys;
7. uploads and approvals are auditable;
8. corrections preserve previous revisions;
9. approved values appear in Muassasa 360° with correct source badge;
10. province/district percentages aggregate correctly where numerator/denominator are available;
11. missing values remain `N/A`;
12. users cannot access institutions outside their scope;
13. executable/active-content uploads are blocked;
14. existing security, enterprise-core and map tests remain green;
15. production readiness and Railway health checks remain successful.

## 23. Recommended First Release

The first production release should include:

- manual structured input;
- `.xlsx/.xls/.csv` import;
- `.docx/.doc/.pdf/.txt` evidence upload;
- 30 MB file limit;
- Railway object storage;
- draft/validate/approve workflow;
- revision history;
- provenance badges;
- module templates;
- audit and RBAC.

AI extraction and official DMED/Ona-bola API integration remain later phases.
