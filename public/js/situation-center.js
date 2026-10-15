import * as maplibregl from '/vendor/maplibre/maplibre-gl.mjs';

maplibregl.setWorkerUrl('/vendor/maplibre/maplibre-gl-worker.mjs');

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const riskTone = severity => severity === 'red' ? 'red' : severity === 'amber' ? 'amber' : severity === 'green' ? 'green' : severity === 'unavailable' ? 'neutral' : 'neutral';
const accuracyLabel = accuracy => ({
  exact: 'Aniq GPS',
  'district-center': 'Tuman markazi koordinatasi',
  'city-center': 'Shahar markazi koordinatasi',
  unknown: 'Koordinata aniqligi tasdiqlanmagan'
}[accuracy] ?? 'Koordinata aniqligi tasdiqlanmagan');

const localRasterStyle = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors'
    }
  },
  layers: [{
    id: 'osm',
    type: 'raster',
    source: 'osm',
    paint: {
      'raster-saturation': -0.58,
      'raster-contrast': 0.3,
      'raster-brightness-min': 0.08,
      'raster-brightness-max': 0.56
    }
  }]
};

const state = { bootstrap: null, map: null, selectedInstitutionId: null };

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

function showInstitutionCard(properties) {
  const card = $('situationInstitutionCard');
  if (!card) return;
  const score = properties.riskScore == null || properties.riskScore === '' ? 'N/A' : properties.riskScore;
  const completeness = properties.dataCompleteness == null || properties.dataCompleteness === '' ? 'N/A' : `${properties.dataCompleteness}%`;
  card.hidden = false;
  card.innerHTML = `
    <div class="sc-list">
      <div><span class="sc-risk ${escapeHtml(properties.riskTone)}"></span> <strong>${escapeHtml(properties.officialName)}</strong></div>
      <small>${escapeHtml(properties.type)} · ${escapeHtml(properties.districtKey)}</small>
      <small>Risk: ${escapeHtml(score)} · Data: ${escapeHtml(completeness)}</small>
      <small>${escapeHtml(accuracyLabel(properties.locationAccuracy))}</small>
    </div>`;
}

function selectInstitution(id, properties) {
  state.selectedInstitutionId = id;
  if (state.map?.getLayer('institution-halo')) {
    state.map.setFilter('institution-halo', ['==', ['get', 'id'], id]);
  }
  if (properties) showInstitutionCard(properties);
}

function initInstitutionLayers(map, bootstrap) {
  map.addSource('institutions', { type: 'geojson', data: featureCollection(bootstrap.institutions ?? []) });
  map.addLayer({
    id: 'institution-halo',
    type: 'circle',
    source: 'institutions',
    filter: ['==', ['get', 'id'], '__none__'],
    paint: {
      'circle-radius': 15,
      'circle-color': 'rgba(40,224,255,.12)',
      'circle-stroke-color': '#28e0ff',
      'circle-stroke-width': 2.5,
      'circle-blur': 0.25
    }
  });
  map.addLayer({
    id: 'institution-points',
    type: 'circle',
    source: 'institutions',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 5, 11, 9],
      'circle-color': ['match', ['get', 'riskTone'], 'red', '#ff5d72', 'amber', '#ffc857', 'green', '#2ce7b0', '#5d8295'],
      'circle-stroke-color': '#dffaff',
      'circle-stroke-width': 1.25,
      'circle-opacity': 0.96
    }
  });
  map.on('mouseenter', 'institution-points', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'institution-points', () => { map.getCanvas().style.cursor = ''; });
  map.on('click', 'institution-points', event => {
    const feature = event.features?.[0];
    if (!feature?.properties?.id) return;
    selectInstitution(String(feature.properties.id), feature.properties);
    if (feature.geometry?.type === 'Point') {
      map.easeTo({ center: feature.geometry.coordinates, zoom: Math.max(map.getZoom(), 10.5), duration: 700 });
    }
  });
}

function initMap(bootstrap) {
  const map = new maplibregl.Map({
    container: 'situationMap',
    style: localRasterStyle,
    center: [64.34, 39.82],
    zoom: 8.35,
    pitch: 55,
    bearing: -12,
    antialias: true,
    attributionControl: true
  });
  state.map = map;
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.on('load', () => initInstitutionLayers(map, bootstrap));
  return map;
}

function showFallback(message) {
  const fallback = $('situationFallback');
  if (!fallback) return;
  fallback.hidden = false;
  const paragraph = fallback.querySelector('p');
  if (paragraph && message) paragraph.textContent = message;
}

async function boot() {
  const status = $('situationStatus');
  try {
    const response = await fetch('/api/v1/situation-center/bootstrap', { headers: { accept: 'application/json' } });
    if (response.status === 401) { location.href = '/login'; return; }
    if (!response.ok) throw new Error(`bootstrap_${response.status}`);
    state.bootstrap = await response.json();
    if (status) status.textContent = `Yangilandi · ${new Date(state.bootstrap.generatedAt).toLocaleString('uz-UZ')}`;
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

boot();
