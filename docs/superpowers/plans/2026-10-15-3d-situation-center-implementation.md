# Buxoro SSB 360 — 3D Situatsion Markaz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-ready, full-screen 3D Situatsion markaz to Dashboard360 with a MapLibre-based Buxoro map, scoped executive panels, risk-aware institution markers, TV/fullscreen behavior, safe fallbacks, and direct access to the existing Muassasa 360° view.

**Architecture:** Keep the existing Leaflet operator map untouched. Add a dedicated authenticated `/situation-center` page backed by focused `/api/v1/situation-center/*` endpoints. PostgreSQL and existing repositories remain the source of truth; the browser receives only scoped executive aggregates and map-safe institution metadata. MapLibre assets are self-hosted, while the first-release map style uses a local style definition with an OSM-compatible raster fallback; optional vector/3D building layers are enabled only when an approved compatible style/source is configured.

**Tech Stack:** Node.js 22, Express 5, TypeScript 5.9, PostgreSQL, Redis, MapLibre GL JS `6.14.0`, existing Leaflet map retained, Node test runner + supertest, Railway, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-15-3d-situation-center-design.md`

## Global Constraints

- Existing Dashboard360 operator map and Muassasa 360° must continue to work.
- New page route: `GET /situation-center`.
- New APIs live under `/api/v1/situation-center/*`.
- Authentication, role permission and institution/district scope enforcement are mandatory.
- Missing statistics remain `N/A`; no fabricated zeroes or synthetic rankings.
- Marker colors reflect only available approved risk state; unavailable risk is neutral.
- Approximate coordinates must be labeled as district/city-center, never presented as exact GPS.
- MapLibre assets are self-hosted; no CDN runtime dependency.
- Do not expose credentials, patient identifiers, JShShIR, passport data, tokens or connection strings.
- Existing `/api/ready`, CSP, audit and security behavior must remain intact.
- WebGL/map failure must degrade to a safe 2D/list fallback without blocking executive panels.
- Production gate remains: tests + TypeScript build + `npm audit --audit-level=high`.

## Review Focus

- **Scope escape:** district/institution-scoped users must never see another scope’s institutions through bootstrap, direct-ID or trend endpoints. Covered in Tasks 3–4.
- **Missing risk/statistics:** no-data institutions render neutral/N/A, never green or zero. Covered in Tasks 2, 6 and 8.
- **Map/WebGL failure:** the page must remain usable with list/panel fallback if MapLibre cannot initialize. Covered in Task 8.
- **Approximate coordinates:** institution focus cards must surface `district-center`/`city-center` accuracy rather than implying exact location. Covered in Tasks 2 and 7.
- **Large TV display:** 16:9 Full HD/4K layouts must avoid panel overlap and preserve readable map area. Covered in Task 6.

---

## File Structure

New files:

- `src/situation-center/types.ts` — DTOs for summary, institution map records, alerts and trends.
- `src/situation-center/service.ts` — scoped aggregation and map payload construction.
- `src/situation-center/router.ts` — `/api/v1/situation-center/*` endpoints.
- `src/views/situation-center.ts` — full-screen HTML shell.
- `src/vendor/maplibre-assets.ts` — copy/verify MapLibre runtime assets into public vendor directory.
- `public/js/situation-center.js` — MapLibre controller, filters, interactions, fallback and presentation mode.
- `public/css/situation-center.css` — command-center layout for desktop/TV.
- `tests/situation-center/service.test.ts`
- `tests/situation-center/router.test.ts`
- `tests/situation-center/view.test.ts`
- `tests/situation-center/maplibre-assets.test.ts`
- `tests/situation-center/client-contract.test.ts`
- `tests/situation-center/fallback.test.ts`

Existing files modified:

- `package.json` — add exact `maplibre-gl` dependency.
- `src/app.ts` — wire page route, router and situation-center dependencies.
- `src/views/dashboard.ts` — add a `3D Situatsion markaz` entry point.
- `src/security/http.ts` — allow only the required OSM tile host in `connect-src` for MapLibre raster requests; keep all existing directives.
- `.env.example` — document optional approved vector style configuration, disabled by default.
- `README.md` — document new route and fallback behavior.

---

### Task 1: Add and self-host MapLibre GL assets

**Files:**
- Modify: `package.json`
- Create: `src/vendor/maplibre-assets.ts`
- Test: `tests/situation-center/maplibre-assets.test.ts`

**Interfaces:**
- Produces: `ensureMapLibreVendorAssets(root?: string): Promise<void>`.
- Public runtime paths: `/vendor/maplibre/maplibre-gl.css`, `/vendor/maplibre/maplibre-gl.js` (generated/copied from installed package at application startup or build-safe bootstrap).

- [ ] **Step 1: Write the failing asset contract test** asserting `maplibre-gl` is pinned exactly to `6.14.0` and `ensureMapLibreVendorAssets()` copies a JS bundle and CSS into `public/vendor/maplibre` without using a CDN URL.
- [ ] **Step 2: Run** `npm test -- tests/situation-center/maplibre-assets.test.ts` and verify failure because the dependency/helper does not exist.
- [ ] **Step 3: Add** exact dependency `maplibre-gl: "6.14.0"` and implement `ensureMapLibreVendorAssets(root?: string): Promise<void>` using package-local `dist` assets only.
- [ ] **Step 4: Run** `npm test -- tests/situation-center/maplibre-assets.test.ts` and `npm audit --audit-level=high`; both must pass.
- [ ] **Step 5: Commit** `feat: self-host maplibre assets`.

### Task 2: Build scoped Situation Center domain payloads

**Files:**
- Create: `src/situation-center/types.ts`
- Create: `src/situation-center/service.ts`
- Test: `tests/situation-center/service.test.ts`

**Interfaces:**
- Consumes: institution repository/catalog, `StoredRisk[]`, `StoredAlert[]`, integration health, existing latest metrics.
- Produces: `createSituationCenterService(deps)` with `buildBootstrap(principal)`, `buildDistrict(principal, districtKey)`, `buildInstitution(principal, institutionId)`, `buildTrend(principal, query)`.

- [ ] **Step 1: Write failing tests** for `buildBootstrap()` asserting only accessible institutions are returned; no-data risk is `unavailable`; approximate coordinates retain `locationAccuracy`; totals only use present numeric values and expose unavailable aggregates as `null`.
- [ ] **Step 2: Run** `npm test -- tests/situation-center/service.test.ts` and confirm failure.
- [ ] **Step 3: Implement** DTOs and `createSituationCenterService(deps)` with explicit null/N/A semantics and no direct database access in view/client code.
- [ ] **Step 4: Add tests** proving rankings exclude missing metric values instead of assigning zero and that alert counts are scoped to visible institutions.
- [ ] **Step 5: Run** the focused test file; expect PASS.
- [ ] **Step 6: Commit** `feat: add situation center service`.

### Task 3: Add protected bootstrap and institution APIs

**Files:**
- Create: `src/situation-center/router.ts`
- Modify: `src/app.ts`
- Test: `tests/situation-center/router.test.ts`

**Interfaces:**
- Routes:
  - `GET /api/v1/situation-center/bootstrap`
  - `GET /api/v1/situation-center/districts/:districtKey`
  - `GET /api/v1/situation-center/institutions/:institutionId`
- Uses existing `requireAuth`, `requirePermission('institution.view')`, `canAccessInstitution` through service/route boundary.

- [ ] **Step 1: Write failing router tests** for unauthenticated `401`, valid authorized `200`, and direct-ID out-of-scope `403`/not-visible behavior.
- [ ] **Step 2: Run** `npm test -- tests/situation-center/router.test.ts` and confirm failure.
- [ ] **Step 3: Implement** `createSituationCenterRouter(deps)` and wire it under `/api/v1/situation-center` in `src/app.ts`.
- [ ] **Step 4: Run** the focused router tests; expect PASS.
- [ ] **Step 5: Commit** `feat: expose scoped situation center api`.

### Task 4: Add trend API with bounded period queries

**Files:**
- Modify: `src/situation-center/service.ts`
- Modify: `src/situation-center/router.ts`
- Test: `tests/situation-center/router.test.ts`

**Interfaces:**
- Route: `GET /api/v1/situation-center/trends?metricKey=<key>&institutionId=<id?>&districtKey=<key?>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>`.
- Returns approved available period points only; missing baseline is not converted to zero.

- [ ] **Step 1: Add failing tests** for authorized series, invalid/unbounded dates `400`, scope escape `403`, and empty series returning `{items:[]}` rather than invented values.
- [ ] **Step 2: Run** the focused tests and verify the new cases fail.
- [ ] **Step 3: Implement** bounded date parsing and trend aggregation against available metric history/current store without widening scope.
- [ ] **Step 4: Run** focused tests; expect PASS.
- [ ] **Step 5: Commit** `feat: add scoped situation center trends`.

### Task 5: Add the authenticated Situation Center page and dashboard entry point

**Files:**
- Create: `src/views/situation-center.ts`
- Modify: `src/app.ts`
- Modify: `src/views/dashboard.ts`
- Test: `tests/situation-center/view.test.ts`

**Interfaces:**
- Page: `GET /situation-center` protected by existing session auth.
- Dashboard control links to `/situation-center`.

- [ ] **Step 1: Write failing view tests** asserting unauthenticated redirect to `/login`, authenticated page contains `situationMap`, left/right executive panel anchors, fullscreen control, return link, and self-hosted MapLibre asset paths.
- [ ] **Step 2: Run** `npm test -- tests/situation-center/view.test.ts`; confirm failure.
- [ ] **Step 3: Implement** `situationCenterHtml()` and protected route; add a visible `3D Situatsion markaz` entry point in the existing dashboard without changing current navigation semantics.
- [ ] **Step 4: Run** view tests; expect PASS.
- [ ] **Step 5: Commit** `feat: add 3d situation center page shell`.

### Task 6: Build the command-center 16:9/TV layout

**Files:**
- Create: `public/css/situation-center.css`
- Modify: `src/views/situation-center.ts`
- Test: `tests/situation-center/view.test.ts`

**Interfaces:**
- Stable element IDs for client rendering: `situationMap`, `situationSummary`, `situationRanking`, `situationAlerts`, `situationActivity`, `situationTrend`, `situationStatus`.

- [ ] **Step 1: Add failing markup/style contract assertions** for a three-column command-center grid, full viewport sizing, 16:9 desktop breakpoints, 1920×1080 and wide-screen safe panel widths, and mobile/unsupported fallback class hooks.
- [ ] **Step 2: Run** view tests and verify failure.
- [ ] **Step 3: Implement** dark blue glass-panel visual system matching the reference direction while keeping readable contrast and reserving the largest area for the map.
- [ ] **Step 4: Run** view tests; expect PASS.
- [ ] **Step 5: Commit** `feat: style situation center tv layout`.

### Task 7: Initialize MapLibre map and risk-aware institution layers

**Files:**
- Create: `public/js/situation-center.js`
- Modify: `src/views/situation-center.ts`
- Modify: `src/security/http.ts`
- Test: `tests/situation-center/client-contract.test.ts`

**Interfaces:**
- Client fetches `/api/v1/situation-center/bootstrap`.
- Local map style factory defaults to OSM-compatible raster tiles; optional approved vector style is disabled unless explicitly configured server-side.
- Marker states: `red`, `amber`, `green`, `neutral`; `unavailable` always maps to `neutral`.

- [ ] **Step 1: Write failing client contract tests** asserting no CDN reference, neutral fallback for unavailable risk, coordinate accuracy text, local MapLibre assets, and required OSM tile host included in CSP `connect-src` without relaxing other directives.
- [ ] **Step 2: Run** `npm test -- tests/situation-center/client-contract.test.ts`; confirm failure.
- [ ] **Step 3: Implement** MapLibre initialization with Buxoro-centered pitched camera, GeoJSON institution source/layer, selected halo layer, district filtering hooks and local raster style fallback.
- [ ] **Step 4: Implement** marker click to show compact institution card including official name, type, district, risk state, source completeness and coordinate accuracy.
- [ ] **Step 5: Run** client contract tests; expect PASS.
- [ ] **Step 6: Commit** `feat: add maplibre institution map`.

### Task 8: Render executive panels and cross-filter interactions

**Files:**
- Modify: `public/js/situation-center.js`
- Test: `tests/situation-center/client-contract.test.ts`

**Interfaces:**
- District/ranking/alert selection calls shared `focusDistrict(key)` / `focusInstitution(id)` controller functions.
- `360° ochish` delegates to `/` with an institution deep-link mechanism or existing Muassasa 360° opener path without duplicating the 360° implementation.

- [ ] **Step 1: Add failing tests** for rendering summary cards, TOP-10 only from real values, scoped alert list, activity N/A states, district filter, marker/ranking focus and existing 360° opening contract.
- [ ] **Step 2: Run** focused tests and confirm failure.
- [ ] **Step 3: Implement** panel rendering and shared focus state; ensure map and panels update from the same selected district/institution state.
- [ ] **Step 4: Implement** trend selector with clear `Ma’lumot yetarli emas` state for empty series.
- [ ] **Step 5: Run** focused tests; expect PASS.
- [ ] **Step 6: Commit** `feat: add situation center executive panels`.

### Task 9: Add fullscreen, presentation mode and WebGL/map fallback

**Files:**
- Modify: `public/js/situation-center.js`
- Modify: `public/css/situation-center.css`
- Test: `tests/situation-center/fallback.test.ts`

**Interfaces:**
- `toggleFullscreen()` uses standard Fullscreen API when available.
- `startPresentation(intervalMs)` defaults to a safe 20-second client-side cycle; any pointer/keyboard interaction stops it.
- Fallback container: `situationFallback`.

- [ ] **Step 1: Write failing tests** for missing WebGL/MapLibre, map initialization exception, Fullscreen API absence, presentation pause on interaction and no write API calls.
- [ ] **Step 2: Run** `npm test -- tests/situation-center/fallback.test.ts`; confirm failure.
- [ ] **Step 3: Implement** safe map failure boundary that keeps executive panels/list visible and shows a district/institution fallback navigator.
- [ ] **Step 4: Implement** fullscreen and read-only presentation mode; never submit mutations from presentation cycling.
- [ ] **Step 5: Run** fallback tests; expect PASS.
- [ ] **Step 6: Commit** `feat: harden situation center presentation mode`.

### Task 10: Integrate optional approved vector/3D building style safely

**Files:**
- Modify: `src/situation-center/service.ts` or focused config helper `src/situation-center/map-config.ts`
- Modify: `.env.example`
- Modify: `public/js/situation-center.js`
- Test: `tests/situation-center/client-contract.test.ts`

**Interfaces:**
- Optional env: `SITUATION_MAP_STYLE_URL`.
- Default: absent/disabled, local raster style used.
- External style host must be validated against an explicit server-side allowlist/config and never expose secrets in client payloads.

- [ ] **Step 1: Add failing tests** proving default mode does not contact an unknown external style host and configured style URLs are rejected unless HTTPS and allowlisted.
- [ ] **Step 2: Run** focused tests and confirm failure.
- [ ] **Step 3: Implement** safe optional style configuration and enable building extrusion only when the loaded style exposes compatible building geometry/source metadata; otherwise retain pitched map without fake buildings.
- [ ] **Step 4: Run** focused tests; expect PASS.
- [ ] **Step 5: Commit** `feat: add optional approved 3d map style`.

### Task 11: Regression, documentation and production verification

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Test: existing full suite plus situation-center suite.

**Interfaces:**
- No new runtime interface beyond documented page/API routes.

- [ ] **Step 1: Update documentation** with `/situation-center`, API endpoints, self-hosted MapLibre, raster fallback, optional vector style and N/A/risk semantics.
- [ ] **Step 2: Run** `npm test` and require all tests PASS.
- [ ] **Step 3: Run** `npm run build` and require TypeScript compilation PASS.
- [ ] **Step 4: Run** `npm audit --audit-level=high` and require no high/critical blocking vulnerability.
- [ ] **Step 5: Verify** existing `/`, Leaflet map, Muassasa 360°, `/api/ready` and `/api/v1/executive/today` regressions remain green.
- [ ] **Step 6: Create a feature branch/PR, wait for GitHub Actions success, review diff, then merge only after final branch verification.
- [ ] **Step 7: After merge, verify Railway deployment reaches SUCCESS, `/api/ready` returns healthy dependencies, and authenticated `/situation-center` loads its self-hosted MapLibre assets without console/runtime errors.
- [ ] **Step 8: Commit** documentation/verification adjustments as needed with `docs: document 3d situation center`.

## Delivery Result

After these tasks, Dashboard360 has two complementary operating surfaces:

`Operator/Admin Dashboard (Leaflet + forms) → existing daily work`

`3D Situatsion Markaz (MapLibre + executive panels) → large-screen leadership monitoring`

Both use the same authenticated, scoped, provenance-aware data model. The 3D layer never creates statistics or location certainty that the underlying system does not possess.