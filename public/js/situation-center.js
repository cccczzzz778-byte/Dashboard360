import * as maplibregl from '/vendor/maplibre/maplibre-gl.mjs';

maplibregl.setWorkerUrl('/vendor/maplibre/maplibre-gl-worker.mjs');

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const displayValue = value => value == null || value === '' ? 'N/A' : String(value);
const riskTone = severity => severity === 'red' ? 'red' : severity === 'amber' ? 'amber' : severity === 'green' ? 'green' : severity === 'unavailable' ? 'neutral' : 'neutral';
const accuracyLabel = accuracy => ({
  exact: 'Aniq GPS',
  'district-center': 'Tuman markazi koordinatasi',
  'city-center': 'Shahar markazi koordinatasi',
  unknown: 'Koordinata aniqligi tasdiqlanmagan'
}[accuracy] ?? 'Koordinata aniqligi tasdiqlanmagan');

const DEFAULT_VECTOR_STYLE = 'https://tiles.openfreemap.org/styles/dark';
const BUKHARA_CITY_CAMERA = { center: [64.4286, 39.7681], zoom: 13.35, pitch: 62, bearing: -18 };
const REGION_CAMERA = { center: [64.34, 39.82], zoom: 8.35, pitch: 48, bearing: -12 };

const state = {
  bootstrap: null,
  context: null,
  map: null,
  selectedInstitutionId: null,
  selectedDistrictKey: null,
  trendMetric: 'kpi.score',
  presentationTimer: null,
  presentationIndex: 0
};

function featureCollection(institutions) {
  return {
    type: 'FeatureCollection',
    features: institutions.flatMap(item => {
      if (!Number.isFinite(item.longitude) || !Number.isFinite(item.latitude)) return [];
      const severity = item.risk?.severity ?? 'unavailable';
      return [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [item.longitude, item.latitude] },
        properties: {
          id: item.id,
          officialName: item.officialName,
          type: item.type,
          districtKey: item.districtKey,
          severity,
          riskTone: riskTone(severity),
          riskScore: item.risk?.score ?? null,
          dataCompleteness: item.dataCompleteness ?? null,
          locationAccuracy: item.locationAccuracy ?? 'unknown'
        }
      }];
    })
  };
}

function currentInstitutions() {
  return state.context?.institutions ?? state.bootstrap?.institutions ?? [];
}

function renderInstitutionCard(item) {
  const card = $('situationInstitutionCard');
  if (!card || !item) return;
  const tone = riskTone(item.risk?.severity ?? 'unavailable');
  const score = displayValue(item.risk?.score);
  const completeness = item.dataCompleteness == null ? 'N/A' : `${item.dataCompleteness}%`;
  card.hidden = false;
  card.innerHTML = `
    <div class="sc-list">
      <div><span class="sc-risk ${escapeHtml(tone)}"></span> <strong>${escapeHtml(item.officialName)}</strong></div>
      <small>${escapeHtml(item.type)} · ${escapeHtml(item.districtKey)}</small>
      <small>Risk: ${escapeHtml(score)} · Data: ${escapeHtml(completeness)}</small>
      <small>${escapeHtml(accuracyLabel(item.locationAccuracy))}</small>
      <a class="sc-open-360" href="/?institution=${encodeURIComponent(item.id)}">360° ochish</a>
    </div>`;
}

function updateMapData(institutions) {
  const source = state.map?.getSource('institutions');
  if (source) source.setData(featureCollection(institutions));
}

function setSelectedHalo(id) {
  state.selectedInstitutionId = id;
  if (state.map?.getLayer('institution-halo')) {
    state.map.setFilter('institution-halo', ['==', ['get', 'id'], id ?? '__none__']);
  }
}

function boundsFor(institutions) {
  const points = institutions.filter(item => Number.isFinite(item.longitude) && Number.isFinite(item.latitude));
  if (!points.length) return null;
  const bounds = new maplibregl.LngLatBounds();
  for (const item of points) bounds.extend([item.longitude, item.latitude]);
  return bounds;
}

async function focusDistrict(key) {
  if (!key) {
    state.selectedDistrictKey = null;
    state.selectedInstitutionId = null;
    state.context = state.bootstrap;
    setSelectedHalo(null);
    updateMapData(currentInstitutions());
    renderPanels(state.context);
    state.map?.easeTo({ ...REGION_CAMERA, duration: 850 });
    await loadTrend();
    return;
  }
  const response = await fetch(`/api/v1/situation-center/districts/${encodeURIComponent(key)}`, { headers: { accept: 'application/json' } });
  if (response.status === 401) { location.href = '/login'; return; }
  if (!response.ok) return;
  state.selectedDistrictKey = key;
  state.selectedInstitutionId = null;
  state.context = await response.json();
  setSelectedHalo(null);
  updateMapData(currentInstitutions());
  renderPanels(state.context);
  const bounds = boundsFor(currentInstitutions());
  if (bounds && state.map) state.map.fitBounds(bounds, { padding: { top: 115, bottom: 90, left: 380, right: 380 }, maxZoom: 13.7, pitch: 58, bearing: -16, duration: 850 });
  await loadTrend();
}

async function focusInstitution(id) {
  const item = (state.bootstrap?.institutions ?? []).find(row => row.id === id) ?? currentInstitutions().find(row => row.id === id);
  if (!item) return;
  setSelectedHalo(id);
  renderInstitutionCard(item);
  if (state.map && Number.isFinite(item.longitude) && Number.isFinite(item.latitude)) {
    state.map.easeTo({ center: [item.longitude, item.latitude], zoom: Math.max(state.map.getZoom(), 15.2), pitch: 64, bearing: -22, duration: 900 });
  }
  await loadTrend();
}

function summaryCard(label, value, suffix = '') {
  return `<article class="sc-kpi"><span>${escapeHtml(label)}</span><strong>${escapeHtml(displayValue(value))}${value == null ? '' : escapeHtml(suffix)}</strong></article>`;
}

function renderSummary(context) {
  const target = $('situationSummary');
  if (!target) return;
  const summary = context?.summary ?? {};
  target.innerHTML = `<h2>Viloyat resurslari</h2><div class="sc-kpi-grid">
    ${summaryCard('Muassasalar', summary.institutions)}
    ${summaryCard('Shifokorlar', summary.doctors)}
    ${summaryCard('Hamshiralar', summary.nurses)}
    ${summaryCard('Koykalar', summary.beds)}
    ${summaryCard('Data qamrovi', summary.dataCompleteness, '%')}
  </div>`;
}

function renderRanking(context) {
  const target = $('situationRanking');
  if (!target) return;
  const rows = context?.rankings ?? [];
  target.innerHTML = `<h2>TOP muassasalar · risk</h2>${rows.length ? `<div class="sc-list">${rows.map((row, index) => `
    <div class="sc-row"><span class="sc-rank">${index + 1}</span><button type="button" data-focus-institution="${escapeHtml(row.institutionId)}">${escapeHtml(row.name)}</button><span class="sc-value">${escapeHtml(row.value)}</span></div>`).join('')}</div>` : '<div class="sc-empty">Risk reytingi uchun ma’lumot yetarli emas</div>'}`;
}

function renderAlerts(context) {
  const target = $('situationAlerts');
  if (!target) return;
  const alerts = context?.alerts?.items ?? [];
  target.innerHTML = `<h2>Kritik signallar</h2><div class="sc-kpi-grid">
    ${summaryCard('Kritik', context?.alerts?.critical)}
    ${summaryCard('Ogohlantirish', context?.alerts?.warning)}
  </div>${alerts.length ? `<div class="sc-list">${alerts.slice(0, 8).map(alert => `
    <div class="sc-row"><span class="sc-risk ${alert.severity === 'critical' ? 'red' : 'amber'}"></span>${alert.institutionId ? `<button type="button" data-focus-institution="${escapeHtml(alert.institutionId)}">${escapeHtml(alert.title)}</button>` : `<span>${escapeHtml(alert.title)}</span>`}<span class="sc-value">${escapeHtml(alert.severity)}</span></div>`).join('')}</div>` : '<div class="sc-empty">Faol signal yo‘q yoki manba ulanmagan</div>'}`;
}

function renderActivity(context) {
  const target = $('situationActivity');
  if (!target) return;
  const summary = context?.summary ?? {};
  const integrations = context?.integrations ?? [];
  const problemSources = integrations.filter(item => ['stale', 'offline', 'degraded', 'auth_required'].includes(item.status));
  target.innerHTML = `<h2>Joriy faoliyat va data health</h2><div class="sc-kpi-grid">
    ${summaryCard('Data qamrovi', summary.dataCompleteness, '%')}
    ${summaryCard('Muassasalar', summary.institutions)}
    ${summaryCard('Muammoli manbalar', problemSources.length || null)}
    ${summaryCard('Jami manbalar', integrations.length || null)}
  </div>${problemSources.length ? `<div class="sc-list">${problemSources.slice(0, 6).map(item => `<div class="sc-row"><span class="sc-risk ${item.status === 'offline' ? 'red' : 'amber'}"></span><span>${escapeHtml(item.label ?? item.sourceKey)}</span><span class="sc-value">${escapeHtml(item.status)}</span></div>`).join('')}</div>` : '<div class="sc-empty">Muammoli integratsiya signali mavjud emas</div>'}`;
}

function renderDistrictNavigator(context) {
  const target = $('situationFallbackList');
  if (!target) return;
  const districts = state.bootstrap?.districts ?? context?.districts ?? [];
  target.innerHTML = `<div class="sc-list"><button type="button" class="sc-nav-button" data-focus-district="">Viloyat</button>${districts.map(row => `<button type="button" class="sc-nav-button" data-focus-district="${escapeHtml(row.key)}">${escapeHtml(row.key)} · ${escapeHtml(row.institutions)} ta</button>`).join('')}</div>`;
}

function renderPanels(context) {
  renderSummary(context);
  renderRanking(context);
  renderAlerts(context);
  renderActivity(context);
  renderDistrictNavigator(context);
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

async function loadTrend() {
  const target = $('situationTrend');
  if (!target) return;
  const to = new Date();
  const from = new Date(to.getTime() - 180 * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({ metricKey: state.trendMetric, from: dateOnly(from), to: dateOnly(to) });
  if (state.selectedInstitutionId) params.set('institutionId', state.selectedInstitutionId);
  else if (state.selectedDistrictKey) params.set('districtKey', state.selectedDistrictKey);
  try {
    const response = await fetch(`/api/v1/situation-center/trends?${params.toString()}`, { headers: { accept: 'application/json' } });
    if (response.status === 401) { location.href = '/login'; return; }
    if (!response.ok) throw new Error(`trend_${response.status}`);
    const data = await response.json();
    const items = data.items ?? [];
    if (!items.length) {
      target.innerHTML = '<h2>Trend · KPI</h2><div class="sc-empty">Ma’lumot yetarli emas</div>';
      return;
    }
    const numeric = items.filter(item => Number.isFinite(item.value));
    const max = numeric.length ? Math.max(...numeric.map(item => item.value)) : null;
    target.innerHTML = `<h2>Trend · KPI</h2>${numeric.length ? `<div class="sc-trend">${numeric.map(item => {
      const width = max && max > 0 ? Math.max(4, Math.round((item.value / max) * 100)) : 4;
      return `<div class="sc-trend-row"><span>${escapeHtml(item.period)}</span><i style="width:${width}%"></i><b>${escapeHtml(item.value)}</b></div>`;
    }).join('')}</div>` : '<div class="sc-empty">Ma’lumot yetarli emas</div>'}`;
  } catch (error) {
    target.innerHTML = '<h2>Trend · KPI</h2><div class="sc-empty">Ma’lumot yetarli emas</div>';
    console.error(error);
  }
}

function addBuildingExtrusion(map) {
  if (map.getLayer('ssb-buildings-3d')) return;
  const style = map.getStyle();
  const vectorSource = Object.entries(style.sources ?? {}).find(([, source]) => source?.type === 'vector');
  if (!vectorSource) return;
  const [sourceId] = vectorSource;
  const firstSymbol = (style.layers ?? []).find(layer => layer.type === 'symbol')?.id;
  const layer = {
    id: 'ssb-buildings-3d',
    type: 'fill-extrusion',
    source: sourceId,
    'source-layer': 'building',
    minzoom: 13,
    paint: {
      'fill-extrusion-color': ['interpolate', ['linear'], ['zoom'], 13, '#123a59', 16, '#3c8faf'],
      'fill-extrusion-height': ['coalesce', ['to-number', ['get', 'render_height']], ['to-number', ['get', 'height']], 8],
      'fill-extrusion-base': ['coalesce', ['to-number', ['get', 'render_min_height']], ['to-number', ['get', 'min_height']], 0],
      'fill-extrusion-opacity': 0.86,
      'fill-extrusion-vertical-gradient': true
    }
  };
  try {
    map.addLayer(layer, firstSymbol);
  } catch (error) {
    console.warn('3D building layer unavailable', error);
  }
}

function initInstitutionLayers(map, bootstrap) {
  map.addSource('institutions', { type: 'geojson', data: featureCollection(bootstrap.institutions ?? []) });
  map.addLayer({
    id: 'institution-halo',
    type: 'circle',
    source: 'institutions',
    filter: ['==', ['get', 'id'], '__none__'],
    paint: {
      'circle-radius': 17,
      'circle-color': 'rgba(40,224,255,.08)',
      'circle-stroke-color': '#28e0ff',
      'circle-stroke-width': 2.5,
      'circle-blur': 0.3
    }
  });
  map.addLayer({
    id: 'institution-points',
    type: 'circle',
    source: 'institutions',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 5, 11, 7, 15, 10],
      'circle-color': ['match', ['get', 'riskTone'], 'red', '#ff5d72', 'amber', '#ffc857', 'green', '#2ce7b0', '#35d8ff'],
      'circle-stroke-color': '#eafcff',
      'circle-stroke-width': 1.4,
      'circle-opacity': 0.98
    }
  });
  map.on('mouseenter', 'institution-points', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'institution-points', () => { map.getCanvas().style.cursor = ''; });
  map.on('click', 'institution-points', event => {
    const id = event.features?.[0]?.properties?.id;
    if (id) void focusInstitution(String(id));
  });
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}

function initMap(bootstrap) {
  const style = bootstrap.mapStyle?.external && bootstrap.mapStyle.styleUrl
    ? bootstrap.mapStyle.styleUrl
    : DEFAULT_VECTOR_STYLE;
  const map = new maplibregl.Map({
    container: 'situationMap',
    style,
    ...BUKHARA_CITY_CAMERA,
    antialias: true,
    attributionControl: true,
    maxPitch: 75
  });
  state.map = map;
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.on('load', () => {
    addBuildingExtrusion(map);
    initInstitutionLayers(map, bootstrap);
  });
  return map;
}

function showFallback(message) {
  const fallback = $('situationFallback');
  if (!fallback) return;
  fallback.hidden = false;
  const paragraph = fallback.querySelector('p');
  if (paragraph && message) paragraph.textContent = message;
  renderDistrictNavigator(state.context);
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      if (document.exitFullscreen) await document.exitFullscreen();
      return;
    }
    const target = document.documentElement;
    if (target?.requestFullscreen) await target.requestFullscreen();
  } catch (error) {
    console.error(error);
  }
}

function stopPresentation() {
  if (state.presentationTimer) {
    clearInterval(state.presentationTimer);
    state.presentationTimer = null;
  }
  const button = $('situationPresentation');
  if (button) {
    button.textContent = 'Taqdimot';
    button.setAttribute('aria-pressed', 'false');
  }
}

function startPresentation(intervalMs = 20000) {
  stopPresentation();
  const districts = () => state.bootstrap?.districts ?? [];
  const cycle = () => {
    const rows = districts();
    if (!rows.length) return;
    const district = rows[state.presentationIndex % rows.length];
    state.presentationIndex = (state.presentationIndex + 1) % rows.length;
    void focusDistrict(district.key);
  };
  cycle();
  state.presentationTimer = setInterval(cycle, intervalMs);
  const button = $('situationPresentation');
  if (button) {
    button.textContent = 'Taqdimotni to‘xtatish';
    button.setAttribute('aria-pressed', 'true');
  }
}

function wirePanelClicks() {
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const institutionId = target.closest('[data-focus-institution]')?.dataset.focusInstitution;
    if (institutionId) { void focusInstitution(institutionId); return; }
    const districtButton = target.closest('[data-focus-district]');
    if (districtButton) void focusDistrict(districtButton.dataset.focusDistrict ?? '');
  });
}

function wirePresentationControls() {
  $('situationFullscreen')?.addEventListener('click', () => { void toggleFullscreen(); });
  $('situationPresentation')?.addEventListener('click', () => {
    if (state.presentationTimer) stopPresentation();
    else startPresentation(20000);
  });
  document.addEventListener('pointerdown', stopPresentation, { passive: true });
  document.addEventListener('keydown', stopPresentation);
}

async function boot() {
  const status = $('situationStatus');
  wirePanelClicks();
  wirePresentationControls();
  try {
    const response = await fetch('/api/v1/situation-center/bootstrap', { headers: { accept: 'application/json' } });
    if (response.status === 401) { location.href = '/login'; return; }
    if (!response.ok) throw new Error(`bootstrap_${response.status}`);
    state.bootstrap = await response.json();
    state.context = state.bootstrap;
    renderPanels(state.context);
    void loadTrend();
    if (status) status.textContent = `Yangilandi · ${new Date(state.bootstrap.generatedAt).toLocaleString('uz-UZ')}`;
    if (!supportsWebGL()) {
      showFallback('WebGL mavjud emas. Rahbar panellari va ro‘yxat rejimi ishlashda davom etadi.');
      return;
    }
    try {
      initMap(state.bootstrap);
    } catch (error) {
      console.error(error);
      showFallback('3D xaritani ishga tushirib bo‘lmadi. Rahbar panellari ishlashda davom etadi.');
    }
  } catch (error) {
    if (status) status.textContent = 'Ma’lumot yuklashda xato';
    showFallback('Situatsion markaz ma’lumotlarini yuklab bo‘lmadi.');
    console.error(error);
  }
}

window.SSB360Situation = { focusDistrict, focusInstitution, renderPanels, supportsWebGL, toggleFullscreen, startPresentation, stopPresentation };
boot();
