# Buxoro SSB 360 — 3D Situatsion Markaz Design

**Date:** 2026-10-15  
**Status:** User-approved direction; written specification for review  
**Repository:** `cccczzzz778-byte/Dashboard360`

## 1. Purpose

Add a full-screen **3D Situatsion markaz** mode to Buxoro SSB 360 for executive monitoring on large displays and TV/command-center screens.

The new mode must visually resemble a modern health command center: a central 3D map of Buxoro with institution markers and executive statistical panels around it. It must reuse the existing Dashboard360 data, permissions, Muassasa 360° view, risk/alert infrastructure, and source provenance rules.

The current operator/admin dashboard remains available and unchanged in purpose.

## 2. Success Criteria

The feature is successful when an authorized user can:

1. open a dedicated full-screen 3D Situatsion markaz mode from Dashboard360;
2. see Buxoro province in a dark command-center map style;
3. see authorized institutions on the map with risk/source-aware markers;
4. select a district or institution and immediately focus the map and surrounding panels;
5. open the existing Muassasa 360° workspace from a map marker or ranking item;
6. see executive totals, rankings, alerts, trends and data freshness from real approved data only;
7. see `N/A` when data is unavailable rather than fabricated zeroes;
8. use the screen on common 16:9 displays, Full HD/4K TV displays and ordinary desktop browsers;
9. fall back safely if 3D rendering or map tiles fail;
10. keep existing authorization, audit, CSP and production quality gates intact.

## 3. Recommended Technical Approach

Use **MapLibre GL JS** as the dedicated Situatsion markaz map renderer.

Reasons:

- true WebGL pitch/bearing and 3D building extrusion support;
- lightweight enough for the current Node/Express application;
- can coexist with the existing Leaflet map rather than requiring a risky replacement;
- supports GeoJSON-driven institution/district overlays;
- works well for TV-style animated camera transitions and dark map styles;
- avoids the extra complexity of a full globe/terrain stack such as CesiumJS for a province-level command center.

The existing Leaflet map remains the normal operator map. MapLibre is used only inside the new 3D mode.

## 4. Product Modes

Dashboard360 will expose four visual modes/concepts:

1. **Kunduzgi** — current light operator view.
2. **Tungi** — current dark operator view.
3. **Rahbar / TV** — current executive TV styling.
4. **3D Situatsion markaz** — new full-screen command-center route/view.

The 3D Situatsion markaz is a dedicated page/route, not merely a CSS skin over the existing dashboard.

Recommended route:

`GET /situation-center`

Protected by the same authenticated session and institution visibility scope as the rest of Dashboard360.

## 5. Visual Layout

### 5.1 Top bar

- `BUXORO VILOYATI SOG‘LIQNI SAQLASH — 3D SITUATSION MARKAZ`
- current date/time;
- data freshness state;
- fullscreen toggle;
- return to normal dashboard;
- optional auto-rotation/presentation mode toggle.

### 5.2 Left upper panel — regional resource overview

Cards derived from approved/available metrics only:

- visible institutions;
- doctors;
- nurses;
- beds;
- optional available computers/IT assets;
- source coverage / completeness.

If an aggregate cannot be calculated correctly, show `N/A`.

### 5.3 Left middle/bottom — ranking and comparison

- TOP-10 institutions by selected approved metric or risk state;
- district comparison bars;
- selectable ranking mode: KPI / risk / data completeness / selected metric where available.

No synthetic ranking is generated if the underlying metric is unavailable.

### 5.4 Center — Buxoro 3D map

Default camera:

- province-centered;
- moderate pitch around 50–60°;
- slight bearing for 3D perspective;
- dark navy/blue basemap.

Layers:

- district boundaries where authoritative geometry is available;
- institution point markers;
- selected institution halo;
- optional 3D building extrusion where the basemap provides usable building geometry;
- district/risk heat overlay only from real aggregated data.

Institution marker semantic state:

- red — critical/highest risk state from approved risk engine;
- amber — attention/risk state;
- green/teal — healthy/normal known state;
- neutral blue/gray — risk unavailable or insufficient data.

Marker color must never imply medical quality if the risk engine has no approved/available inputs.

### 5.5 Right upper — critical alerts

Show:

- active critical alert count;
- warning count;
- stale source count;
- top unresolved items;
- institution and timestamp where authorized.

Selecting an alert focuses the institution on the map when it has an institution ID.

### 5.6 Right middle — current activity

Display only available approved metrics such as:

- current/monthly admissions;
- inpatient occupancy;
- appeals;
- QR rating;
- DMED activity;
- KPI score;
- maternity/child indicators.

The exact card set is dynamic. Missing values remain `N/A`.

### 5.7 Right lower — trend chart

Default trend selector may include:

- admissions;
- inpatient activity;
- KPI;
- appeals;
- QR ratings;
- data completeness.

The chart uses approved periodic history from the metric revision/statistics layer when available. Before historical storage exists for a metric, the chart shows a clear `Ma’lumot yetarli emas` state.

## 6. Interaction Model

### District selection

Clicking a district or district list item:

1. camera flies to district center/bounds;
2. institution markers filter/highlight to that district;
3. side panels recalculate for the user's visible institutions in the district;
4. breadcrumb shows the selected district.

### Institution selection

Clicking a marker or ranking item:

1. camera flies to the institution coordinate;
2. marker receives a focus halo;
3. compact institution card appears with official name, type, district, source completeness and risk status;
4. `360° ochish` opens the existing Muassasa 360° workspace.

If coordinates are only district/city-center approximations, the institution card must show that accuracy explicitly.

### Presentation mode

Optional TV auto-presentation:

- rotate through districts or selected institutions;
- deterministic interval, e.g. 15–30 seconds configurable client-side;
- pause immediately on manual interaction;
- never submit writes or modify data.

## 7. Architecture

Data flow:

`PostgreSQL / existing repositories → Situation Center service → protected /api/v1/situation-center endpoints → MapLibre GL + panels → Muassasa 360°`

The 3D page must not query PostgreSQL directly from browser code.

New focused components:

- `src/situation-center/service.ts` — executive aggregation and scope filtering;
- `src/situation-center/router.ts` — protected `/api/v1/situation-center/*` endpoints;
- `src/views/situation-center.ts` — page HTML shell;
- `public/js/situation-center.js` — map/UI controller;
- `public/css/situation-center.css` — command-center styling;
- `public/vendor/maplibre/*` — self-hosted MapLibre assets where licensing/package structure permits;
- `tests/situation-center/*` — aggregation, authorization and rendering contracts.

Existing components reused:

- session/auth middleware;
- `canAccessInstitution`/scope filtering;
- institution catalog/repository;
- risk repository;
- alerts repository;
- integration health repository;
- existing metric/module data;
- Muassasa 360° route/UI entry points;
- audit/security headers.

## 8. API Design

Recommended endpoints:

### `GET /api/v1/situation-center/bootstrap`

Returns authorized, non-sensitive executive bootstrap payload:

- generatedAt;
- user-visible districts;
- visible institutions with map coordinates/accuracy;
- current risk state;
- high-level summary;
- alert summary;
- source/data coverage metadata;
- available panel definitions.

### `GET /api/v1/situation-center/districts/:districtKey`

Returns district-scoped aggregate state for visible institutions only.

### `GET /api/v1/situation-center/institutions/:institutionId`

Returns compact executive details for one authorized institution.

### `GET /api/v1/situation-center/trends`

Query parameters:

- metric key;
- optional institution or district;
- bounded date period.

Returns approved period series only.

All endpoints require authentication and appropriate `institution.view`/alert/integration permissions. Direct-ID scope escape must return forbidden/not-visible.

## 9. Data and Statistical Rules

The 3D interface is a presentation layer, not a new statistical source.

Rules:

- use approved current metrics/revisions only;
- use server-calculated aggregates;
- missing values stay `N/A`;
- rates use numerator/denominator where required;
- no blind averaging of percentages;
- manual/import/live provenance remains visible;
- no derived risk color when risk is unavailable;
- no patient-level data;
- no patient identifiers in map tooltips or panels.

When Manual Data Ingestion is later implemented, approved manual/Excel values automatically become available to this view through the same published metric layer.

## 10. Map Data Rules

### Institution coordinates

Use existing institution coordinates and `locationAccuracy`.

- `exact` may be shown as an exact location;
- `district-center` and `city-center` are clearly labeled approximate;
- `unknown` is not plotted as an invented exact point.

### District boundaries

Prefer authoritative or reputable GeoJSON for Buxoro district boundaries. Until verified geometry is available, district interaction may use district center points and existing catalog coordinates.

### Buildings

Do not fabricate institution building models.

If the chosen vector basemap exposes building footprints/heights, generic city buildings can be extruded for visual context. This must not be presented as an authoritative model of the medical institution.

## 11. Basemap and External Dependency Policy

MapLibre assets should be self-hosted in the application bundle or served from installed package assets rather than arbitrary CDN script tags.

Basemap configuration must be replaceable by environment/configuration without code rewrite.

Possible initial source categories:

- OpenStreetMap-compatible vector/raster provider;
- a provider that permits required usage/licensing and 3D building layers;
- later, an internal/government map service if officially provided.

No private API token is embedded into public source code. If a map provider requires a browser-visible token, it must be a restricted public-style token with origin/usage restrictions and no other privileges.

## 12. 3D Failure and Fallback Behavior

If WebGL/MapLibre cannot initialize:

- the page still loads;
- show a clear `3D xarita mavjud emas` message;
- render a 2D fallback map or institution list using existing data;
- executive panels remain usable;
- never blank the entire command center.

If basemap tiles fail:

- institution overlays/panels should still degrade gracefully where possible;
- display map connection status;
- avoid repeated aggressive retries.

If data APIs fail:

- panel displays error/N/A state;
- previously rendered data is not silently relabeled as current;
- timestamps/freshness make stale state explicit.

## 13. Security

- Same session cookie and server-side authorization as Dashboard360.
- No public unauthenticated situation-center API.
- CSP updated only for the exact required self-hosted assets and chosen map tile/style origins.
- No `unsafe-eval` introduced for MapLibre or chart rendering.
- No credentials, DMED login data, connection strings or patient identifiers in browser payloads.
- API responses include only institution-level aggregate/operational data allowed by role/scope.
- Selection/navigation actions are read-only and do not require write permissions.
- Any future configuration write uses existing CSRF/same-origin protections.

## 14. Performance

Target behavior on a modern desktop/TV browser:

- initial command-center shell renders quickly before data finishes;
- institution markers use a single GeoJSON/vector-style source rather than one heavy DOM object per marker where practical;
- side panels avoid full rerender of the map on every minor filter;
- district/institution fly-to animations bounded to short durations;
- large trend payloads are server-bounded;
- no patient-level datasets are shipped to browser.

For dozens to a few hundred institutions, MapLibre symbol/circle layers are sufficient without clustering unless field testing shows a need.

## 15. Responsive / Display Targets

Primary:

- 1920×1080 16:9 executive monitor;
- 3840×2160 4K TV;
- desktop 1366×768 and above.

Secondary:

- tablet landscape.

Mobile portrait is supported as a usable fallback but is not the primary command-center presentation target. On narrow screens, panels stack/collapse and map remains navigable.

## 16. Styling Direction

Visual language:

- dark navy/blue background;
- cyan/teal luminous borders and accents;
- high-contrast numeric KPIs;
- transparent glass panels;
- restrained glow, not excessive animation;
- red/amber/green only for semantically valid status;
- subtle map/grid HUD styling;
- Uzbek labels by default.

The inspiration image is a visual reference, not a pixel-for-pixel copy. The implementation uses original layout/styling appropriate to Buxoro SSB.

## 17. Testing Strategy

TDD is required.

Test groups:

1. situation-center route requires authentication;
2. district/institution scope filtering prevents direct-ID escape;
3. unavailable data stays `N/A` and never becomes `0`;
4. risk marker state remains neutral when risk is unavailable;
5. approximate coordinates expose their accuracy label;
6. aggregate percentages use valid weighted/ratio semantics where available;
7. trend endpoint enforces bounded inputs and returns approved history only;
8. page contains MapLibre host and executive panels;
9. WebGL/map initialization failure exposes fallback UI contract;
10. current Leaflet operator map and Muassasa 360° tests remain green;
11. CSP has only required map/style origins;
12. `npm test`, TypeScript build and high-severity audit remain green.

## 18. Rollout

### Phase A — Shell and API foundation

- protected `/situation-center` route;
- sidebar/topbar entry point;
- situation-center bootstrap service/router;
- executive panel placeholders fed by real APIs;
- no 3D dependency yet until API contracts are green.

### Phase B — MapLibre 3D map

- self-hosted MapLibre JS/CSS;
- Buxoro-centered dark map;
- institution GeoJSON layer;
- pitch/bearing/fly-to;
- risk/source-aware marker styling;
- fallback behavior.

### Phase C — Executive panels

- regional resource summary;
- TOP-10/rankings;
- alerts;
- activity metrics;
- trends;
- data freshness.

### Phase D — Interaction and TV presentation

- district focus;
- institution focus;
- Muassasa 360° launch;
- fullscreen;
- optional auto-presentation.

### Phase E — Real manual/live data expansion

As the Manual Data Ingestion subsystem and future DMED/Ona-bola APIs become available, the command center consumes them through the published metric layer without redesigning the UI architecture.

## 19. Rollback Strategy

The feature is additive.

- Existing `/` dashboard and Leaflet map remain unchanged as primary operator flow.
- New route/API can be disabled or removed without deleting business data.
- No destructive DB migration is required for Phase A/B.
- If MapLibre or map source has production issues, the dedicated route can fall back to 2D/list mode while the rest of Dashboard360 stays online.

## 20. Acceptance Criteria

The initial production release is accepted when:

1. `3D Situatsion markaz` entry appears for authorized users;
2. `/situation-center` is protected by authentication;
3. Buxoro-centered 3D map renders on supported WebGL browsers;
4. visible institutions appear with correct scope filtering;
5. marker state uses real risk/source status or neutral unavailable state;
6. district/institution selection updates map and panels;
7. institution selection can open existing Muassasa 360°;
8. left/right executive panels show real approved values or `N/A`;
9. data freshness/source information is visible;
10. map/WebGL failure does not break the full page;
11. normal Dashboard360 Leaflet map continues to work;
12. desktop Full HD layout matches the intended command-center visual hierarchy;
13. tests/build/security audit pass;
14. Railway readiness remains healthy after deployment.

## 21. Deferred Features

Not required for the first release:

- photorealistic institution-specific 3D models;
- drone/satellite photogrammetry;
- patient-level geospatial visualization;
- live ambulance GPS;
- animated traffic data;
- AI narration;
- DMED/Ona-bola scraping without official integration.

These require separate authorization/data sources and should not block the core Situatsion markaz.
