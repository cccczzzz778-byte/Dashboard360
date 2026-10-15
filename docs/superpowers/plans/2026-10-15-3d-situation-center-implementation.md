# Buxoro SSB 360 — 3D Situatsion Markaz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-ready, full-screen 3D Situatsion markaz to Dashboard360 with a MapLibre-based Buxoro map, scoped executive panels, risk-aware institution markers, TV/fullscreen behavior, safe fallbacks, and direct access to the existing Muassasa 360° view.

**Architecture:** Keep the existing Leaflet operator map untouched. Add a dedicated authenticated `/situation-center` page backed by focused `/api/v1/situation-center/*` endpoints. PostgreSQL and the existing repositories remain the source of truth; the browser receives only scoped executive aggregates and map-safe institution metadata. MapLibre is self-hosted as browser ESM assets. The default basemap is a local style definition using the existing OSM-compatible raster tiles; optional vector/3D building layers are enabled only when an approved compatible HTTPS style/source is explicitly configured.

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
- MapLibre runtime assets are self-hosted; no CDN runtime dependency.
- MapLibre v6 browser entry is ESM: `maplibre-gl.mjs`; the same-origin worker and shared module must be available beside it.
- Do not expose credentials, patient identifiers, JShShIR, passport data, tokens or connection strings.
- Existing `/api/ready`, CSP, audit and security behavior must remain intact.
- WebGL/map failure must degrade to a safe list/panel fallback without blocking executive information.
- Production gate remains: tests + TypeScript build + `npm audit --audit-level=high`.

## Review Focus

- **Scope escape:** district/institution-scoped users must never see another scope’s institutions through bootstrap, direct-ID or trend endpoints. Covered in Tasks 2–3.
- **Missing risk/statistics:** no-data institutions render neutral/N/A, never green or zero. Covered in Tasks 2, 6 and 7.
- **Map/WebGL failure:** the page remains usable with list/panel fallback if MapLibre cannot initialize. Covered in Task 8.
- **Approximate coordinates:** institution focus cards surface `district-center`/`city-center` accuracy rather than implying exact location. Covered in Tasks 2 and 6.
- **Large TV display:** 16:9 Full HD/4K layouts avoid panel overlap and preserve a dominant central map. Covered in Task 5.

---

## File Structure

New focused files:

- `src/situation-center/types.ts` — DTOs for summary, institution map records, alerts and trends.
- `src/situation-center/service.ts` — scoped aggregation and map payload construction.
- `src/situation-center/router.ts` — `/api/v1/situation-center/*` endpoints.
- `src/situation-center/map-config.ts` — safe raster/vector style configuration.
- `src/views/situation-center.ts` — full-screen HTML shell.
- `src/vendor/maplibre-assets.ts` — copy/verify MapLibre ESM runtime assets into public vendor directory.
- `public/js/situation-center.js` — browser ESM controller, MapLibre, filters, panels and fallback.
- `public/css/situation-center.css` — command-center layout for desktop/TV.
- `tests/situation-center/service.test.ts`
- `tests/situation-center/router.test.ts`
- `tests/situation-center/view.test.ts`
- `tests/situation-center/maplibre-assets.test.ts`
- `tests/situation-center/client-contract.test.ts`
- `tests/situation-center/fallback.test.ts`

Existing files modified:

- `package.json` — add exact `maplibre-gl` dependency.
- `src/app.ts` — wire page route, service/router and MapLibre vendor assets.
- `src/views/dashboard.ts` — add a `3D Situatsion markaz` entry point.
- `src/security/http.ts` — permit only required map requests and same-origin workers; keep existing restrictive directives.
- `.env.example` — document optional approved vector style settings, disabled by default.
- `README.md` — document new route, API and fallback behavior.

---

### Task 1: Add and self-host MapLibre GL v6 ESM assets

**Files:**
- Modify: `package.json`
- Create: `src/vendor/maplibre-assets.ts`
- Test: `tests/situation-center/maplibre-assets.test.ts`

**Interfaces:**
- Produces: `ensureMapLibreVendorAssets(root?: string): Promise<void>`.
- Public runtime directory: `/vendor/maplibre/`.
- Required files: `maplibre-gl.mjs`, `maplibre-gl-worker.mjs`, `maplibre-gl-shared.mjs`, `maplibre-gl.css`.

- [ ] **Step 1: Write the failing test** `self_hosts_maplibre_v6_esm_assets` with assertions:
  ```ts
  assert.equal(pkg.dependencies['maplibre-gl'], '6.14.0');
  assert.ok(existsSync('public/vendor/maplibre/maplibre-gl.mjs'));
  assert.ok(existsSync('public/vendor/maplibre/maplibre-gl-worker.mjs'));
  assert.ok(existsSync('public/vendor/maplibre/maplibre-gl-shared.mjs'));
  assert.ok(existsSync('public/vendor/maplibre/maplibre-gl.css'));
  ```
- [ ] **Step 2: Run** `npm test -- tests/situation-center/maplibre-assets.test.ts`; expected FAIL because the dependency/helper/assets do not exist.
- [ ] **Step 3: Add** exact dependency `maplibre-gl: "6.14.0"` and implement `ensureMapLibreVendorAssets(root?: string): Promise<void>` by copying the required matching files from `node_modules/maplibre-gl/dist`.
- [ ] **Step 4: Run** the focused test and `npm audit --audit-level=high`; expected PASS.
- [ ] **Step 5: Commit** `feat: self-host maplibre esm assets`.

### Task 2: Build scoped Situation Center executive payloads

**Files:**
- Create: `src/situation-center/types.ts`
- Create: `src/situation-center/service.ts`
- Test: `tests/situation-center/service.test.ts`

**Interfaces:**
- Consumes: institution repository/catalog, latest institution metrics, `StoredRisk[]`, `StoredAlert[]`, integration health.
- Produces: `createSituationCenterService(deps)` with:
  - `buildBootstrap(principal: UserPrincipal): Promise<SituationBootstrap>`
  - `buildDistrict(principal: UserPrincipal, districtKey: string): Promise<SituationDistrict>`
  - `buildInstitution(principal: UserPrincipal, institutionId: string): Promise<SituationInstitution>`
  - `buildTrend(principal: UserPrincipal, query: TrendQuery): Promise<TrendSeries>`

- [ ] **Step 1: Write failing tests** `bootstrap_is_scope_filtered_and_null_safe` and `ranking_excludes_missing_values` with assertions:
  ```ts
  assert.deepEqual(result.institutions.map(x => x.id), ['allowed-1']);
  assert.equal(result.institutions[0].risk.severity, 'unavailable');
  assert.equal(result.summary.doctors, null);
  assert.equal(result.institutions[0].locationAccuracy, 'district-center');
  assert.ok(!result.rankings.some(x => x.value === 0 && x.sourceState === 'unavailable'));
  ```
- [ ] **Step 2: Run** `npm test -- tests/situation-center/service.test.ts`; expected FAIL.
- [ ] **Step 3: Implement** DTOs and service aggregation with explicit `null`/unavailable semantics and existing authorization scope helpers.
- [ ] **Step 4: Add** scoped alert aggregation test proving alerts for hidden institutions are excluded.
- [ ] **Step 5: Run** focused tests; expected PASS.
- [ ] **Step 6: Commit** `feat: add situation center service`.

### Task 3: Add protected Situation Center APIs and bounded trends

**Files:**
- Create: `src/situation-center/router.ts`
- Modify: `src/app.ts`
- Test: `tests/situation-center/router.test.ts`

**Interfaces:**
- Routes:
  - `GET /api/v1/situation-center/bootstrap`
  - `GET /api/v1/situation-center/districts/:districtKey`
  - `GET /api/v1/situation-center/institutions/:institutionId`
  - `GET /api/v1/situation-center/trends?metricKey=<key>&institutionId=<id?>&districtKey=<key?>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>`
- All use existing `requireAuth` and `requirePermission('institution.view')`.

- [ ] **Step 1: Write failing tests** `requires_auth`, `blocks_direct_id_scope_escape`, `rejects_unbounded_or_invalid_trend_period`, and `empty_trend_does_not_invent_zero`:
  ```ts
  await request(app).get('/api/v1/situation-center/bootstrap').expect(401);
  await request(scopedApp).get('/api/v1/situation-center/institutions/hidden').set('Cookie', cookie).expect(403);
  await request(app).get('/api/v1/situation-center/trends?metricKey=kpi.score').set('Cookie', cookie).expect(400);
  assert.deepEqual(emptyTrend.body.items, []);
  ```
- [ ] **Step 2: Run** the focused router tests; expected FAIL.
- [ ] **Step 3: Implement** `createSituationCenterRouter(deps)` and wire it under `/api/v1/situation-center`.
- [ ] **Step 4: Implement** bounded date parsing and service calls without widening institution scope.
- [ ] **Step 5: Run** focused tests; expected PASS.
- [ ] **Step 6: Commit** `feat: expose scoped situation center api`.

### Task 4: Add authenticated page shell and dashboard entry point

**Files:**
- Create: `src/views/situation-center.ts`
- Modify: `src/app.ts`
- Modify: `src/views/dashboard.ts`
- Test: `tests/situation-center/view.test.ts`

**Interfaces:**
- Page: `GET /situation-center`, protected by existing session auth.
- Browser script: `<script type="module" src="/js/situation-center.js"></script>`.
- Self-hosted stylesheet: `/vendor/maplibre/maplibre-gl.css`.

- [ ] **Step 1: Write failing test** `renders_authenticated_situation_center_shell`:
  ```ts
  assert.match(html, /id="situationMap"/);
  assert.match(html, /id="situationSummary"/);
  assert.match(html, /id="situationAlerts"/);
  assert.match(html, /type="module"[^>]+situation-center\.js/);
  assert.doesNotMatch(html, /unpkg|jsdelivr|cdnjs/);
  ```
- [ ] **Step 2: Add** unauthenticated redirect assertion for `/situation-center` → `/login`.
- [ ] **Step 3: Run** `npm test -- tests/situation-center/view.test.ts`; expected FAIL.
- [ ] **Step 4: Implement** `situationCenterHtml()` and route; add visible `3D Situatsion markaz` link/button to existing dashboard.
- [ ] **Step 5: Run** focused tests; expected PASS.
- [ ] **Step 6: Commit** `feat: add situation center page shell`.

### Task 5: Build the 16:9 command-center visual layout

**Files:**
- Create: `public/css/situation-center.css`
- Modify: `src/views/situation-center.ts`
- Test: `tests/situation-center/view.test.ts`

**Interfaces:**
- Stable client anchors: `situationMap`, `situationSummary`, `situationRanking`, `situationAlerts`, `situationActivity`, `situationTrend`, `situationStatus`, `situationFallback`.

- [ ] **Step 1: Add failing style/markup contract test** `tv_layout_has_dominant_map_and_safe_panels`:
  ```ts
  assert.match(css, /100vh/);
  assert.match(css, /grid-template-columns/);
  assert.match(css, /@media[^\{]*min-width:\s*1900px/);
  assert.match(html, /id="situationFallback"/);
  ```
- [ ] **Step 2: Run** focused view tests; expected FAIL.
- [ ] **Step 3: Implement** dark navy/blue glass-panel layout inspired by the supplied reference: central dominant map, left resource/ranking panels, right alert/activity/trend panels, top title/clock/fullscreen controls.
- [ ] **Step 4: Add** responsive rules for ordinary desktop and narrow/mobile fallback without overlaying panels on the map.
- [ ] **Step 5: Run** focused tests; expected PASS.
- [ ] **Step 6: Commit** `feat: style situation center tv layout`.

### Task 6: Initialize MapLibre, same-origin worker and risk-aware map layers

**Files:**
- Create: `public/js/situation-center.js`
- Create: `src/situation-center/map-config.ts`
- Modify: `src/views/situation-center.ts`
- Modify: `src/security/http.ts`
- Test: `tests/situation-center/client-contract.test.ts`

**Interfaces:**
- Browser ESM imports `* as maplibregl` from `/vendor/maplibre/maplibre-gl.mjs`.
- Calls `maplibregl.setWorkerUrl('/vendor/maplibre/maplibre-gl-worker.mjs')` before map creation.
- Client fetches `/api/v1/situation-center/bootstrap`.
- Default style is generated locally with an OSM-compatible raster source.
- Marker states: `red`, `amber`, `green`, `neutral`; `unavailable` maps to `neutral`.

- [ ] **Step 1: Write failing test** `maplibre_client_is_self_hosted_and_null_safe`:
  ```ts
  assert.match(js, /\/vendor\/maplibre\/maplibre-gl\.mjs/);
  assert.match(js, /setWorkerUrl\(['"]\/vendor\/maplibre\/maplibre-gl-worker\.mjs/);
  assert.doesNotMatch(js, /unpkg|jsdelivr|cdnjs/);
  assert.match(js, /unavailable[^\n]*neutral|neutral[^\n]*unavailable/);
  assert.match(httpSecurity, /worker-src\s+'self'/);
  ```
- [ ] **Step 2: Run** `npm test -- tests/situation-center/client-contract.test.ts`; expected FAIL.
- [ ] **Step 3: Implement** local raster map style, Buxoro-centered pitched camera, GeoJSON institution source, risk-aware circle/symbol layer and selected halo layer.
- [ ] **Step 4: Extend CSP** minimally with `worker-src 'self'` and required OSM tile origin in `connect-src`; do not remove existing restrictions.
- [ ] **Step 5: Implement** selected institution popup/card showing official name, type, district, risk state, data completeness and `locationAccuracy` label.
- [ ] **Step 6: Run** focused tests; expected PASS.
- [ ] **Step 7: Commit** `feat: add maplibre situation map`.

### Task 7: Render executive panels, filters, trends and Muassasa 360° handoff

**Files:**
- Modify: `public/js/situation-center.js`
- Modify: `src/app.ts` or existing dashboard deep-link handling if needed
- Test: `tests/situation-center/client-contract.test.ts`

**Interfaces:**
- Shared controller functions: `focusDistrict(key)`, `focusInstitution(id)`, `renderPanels(state)`.
- `360° ochish` reuses the existing Muassasa 360° implementation through a stable deep-link/query mechanism such as `/?institution=<id>`; it must not duplicate the 360° drawer implementation.

- [ ] **Step 1: Add failing test** `panels_use_real_values_and_share_selection_state`:
  ```ts
  assert.match(js, /focusDistrict/);
  assert.match(js, /focusInstitution/);
  assert.match(js, /Ma’lumot yetarli emas/);
  assert.match(js, /360° ochish|360°/);
  assert.doesNotMatch(js, /\|\|\s*0\b/); // unavailable must not silently become zero
  ```
- [ ] **Step 2: Run** focused tests; expected FAIL.
- [ ] **Step 3: Implement** summary cards, TOP-10 ranking from available values only, scoped alert list, activity cards and data freshness indicators.
- [ ] **Step 4: Implement** district/ranking/alert click cross-filtering through shared focus state.
- [ ] **Step 5: Implement** trend selector and empty-series `Ma’lumot yetarli emas` state.
- [ ] **Step 6: Implement** stable handoff to existing Muassasa 360° drawer and add a regression test that the normal dashboard can open the deep-linked institution.
- [ ] **Step 7: Run** focused + existing institution-360 tests; expected PASS.
- [ ] **Step 8: Commit** `feat: add situation center executive interactions`.

### Task 8: Add fullscreen, TV presentation, WebGL fallback and optional vector 3D style

**Files:**
- Modify: `public/js/situation-center.js`
- Modify: `public/css/situation-center.css`
- Modify: `src/situation-center/map-config.ts`
- Modify: `.env.example`
- Test: `tests/situation-center/fallback.test.ts`

**Interfaces:**
- `toggleFullscreen()` uses standard Fullscreen API when available.
- `startPresentation(intervalMs = 20000)` cycles read-only district/institution focus and stops on any manual interaction.
- Optional env: `SITUATION_MAP_STYLE_URL`; absent by default.
- External vector style must be HTTPS and match an explicit configured allowlist/approved host policy before being returned to the browser.

- [ ] **Step 1: Write failing tests** `webgl_failure_keeps_panels_usable`, `presentation_is_read_only_and_pauses_on_input`, and `external_style_is_fail_closed`:
  ```ts
  assert.match(js, /situationFallback/);
  assert.match(js, /20000/);
  assert.doesNotMatch(js, /fetch\([^\n]*method:\s*['"]POST['"]/);
  assert.equal(resolveMapStyle({url:'http://bad.example/style.json'}).external, false);
  assert.equal(resolveMapStyle({url:'https://unknown.example/style.json'}).external, false);
  ```
- [ ] **Step 2: Run** `npm test -- tests/situation-center/fallback.test.ts`; expected FAIL.
- [ ] **Step 3: Implement** safe MapLibre/WebGL initialization boundary; on failure show list/navigation fallback while panels remain live.
- [ ] **Step 4: Implement** fullscreen and 20-second read-only presentation mode; stop immediately on pointer, keyboard or selection interaction.
- [ ] **Step 5: Implement** optional approved vector style configuration; enable building extrusion only if compatible building geometry exists. Otherwise keep pitched map and never synthesize buildings.
- [ ] **Step 6: Run** focused tests; expected PASS.
- [ ] **Step 7: Commit** `feat: harden 3d presentation and fallback`.

### Task 9: Regression, documentation, PR and Railway production verification

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Test: full existing suite plus `tests/situation-center/**`.

**Interfaces:**
- No new runtime interface beyond documented page/API routes.

- [ ] **Step 1: Update documentation** with `/situation-center`, `/api/v1/situation-center/*`, self-hosted MapLibre ESM assets, raster fallback, optional vector style, risk marker semantics and N/A rules.
- [ ] **Step 2: Run** `npm test`; expected all tests PASS.
- [ ] **Step 3: Run** `npm run build`; expected TypeScript compilation PASS.
- [ ] **Step 4: Run** `npm audit --audit-level=high`; expected no blocking high/critical vulnerability.
- [ ] **Step 5: Re-run regressions** covering `/`, Leaflet map, Muassasa 360°, `/api/ready` and `/api/v1/executive/today`; all must stay green.
- [ ] **Step 6: Create a feature branch and PR**, wait for GitHub Actions success, inspect the complete diff, and do not merge a red workflow.
- [ ] **Step 7: After merge**, verify Railway deployment reaches SUCCESS, `/api/ready` reports healthy dependencies, and authenticated `/situation-center` loads the self-hosted `.mjs`, worker and CSS assets without runtime errors.
- [ ] **Step 8: Commit** final documentation/verification adjustments as `docs: document 3d situation center` if needed before merge.

## Delivery Result

After completion Dashboard360 has two complementary surfaces:

`Operator/Admin Dashboard (Leaflet + forms) → daily operational work`

`3D Situatsion Markaz (MapLibre + executive panels) → large-screen leadership monitoring`

Both use the same authenticated, scoped, provenance-aware data. The 3D layer never invents statistics, risk certainty, GPS accuracy or building geometry that the underlying sources do not provide.