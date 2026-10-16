import * as maplibregl from '/vendor/maplibre/maplibre-gl.mjs';

maplibregl.setWorkerUrl('/vendor/maplibre/maplibre-gl-worker.mjs');

const BUKHARA_REGION_CAMERA = { center: [64.34, 39.82], zoom: 8.35, pitch: 52, bearing: -12 };
const FALLBACK_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const BUILDING_HALF_WIDTH = 0.00018;
const BUILDING_HALF_HEIGHT = 0.00011;

const state = {
  map: null,
  bootstrap: null,
  institutions: [],
  hospitalMarkers: []
};

const riskTone = severity => severity === 'red' ? 'red' : severity === 'amber' ? 'amber' : severity === 'green' ? 'green' : 'neutral';

function institutionVisualHeight(severity, type = '') {
  const base = severity === 'red' ? 30 : severity === 'amber' ? 24 : severity === 'green' ? 18 : 21;
  const normalizedType = String(type).toLowerCase();
  const isLargeHospital = /markaz|shifoxona|hospital|kompleks|ko‘p tarmoqli|ko'p tarmoqli/.test(normalizedType);
  return isLargeHospital ? Math.min(32, base + 2) : base;
}

function pointCollection(institutions) {
  return {
    type: 'FeatureCollection',
    features: institutions.flatMap(item => {
      if (!Number.isFinite(item.longitude) || !Number.isFinite(item.latitude)) return [];
      return [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [item.longitude, item.latitude] },
        properties: {
          id: item.id,
          officialName: item.officialName,
          districtKey: item.districtKey,
          type: item.type,
          riskTone: riskTone(item.risk?.severity),
          locationAccuracy: item.locationAccuracy ?? 'unknown'
        }
      }];
    })
  };
}

function visualizationFootprint(longitude, latitude) {
  return [
    [longitude - BUILDING_HALF_WIDTH, latitude - BUILDING_HALF_HEIGHT],
    [longitude + BUILDING_HALF_WIDTH, latitude - BUILDING_HALF_HEIGHT],
    [longitude + BUILDING_HALF_WIDTH, latitude + BUILDING_HALF_HEIGHT],
    [longitude - BUILDING_HALF_WIDTH, latitude + BUILDING_HALF_HEIGHT],
    [longitude - BUILDING_HALF_WIDTH, latitude - BUILDING_HALF_HEIGHT]
  ];
}

function institutionBuildingCollection(institutions) {
  return {
    type: 'FeatureCollection',
    features: institutions.flatMap(item => {
      if (!Number.isFinite(item.longitude) || !Number.isFinite(item.latitude)) return [];
      const severity = item.risk?.severity ?? 'unavailable';
      return [{
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [visualizationFootprint(item.longitude, item.latitude)]
        },
        properties: {
          id: item.id,
          officialName: item.officialName,
          districtKey: item.districtKey,
          type: item.type,
          riskTone: riskTone(severity),
          severity,
          locationAccuracy: item.locationAccuracy ?? 'unknown',
          visualizationFootprint: true,
          visualizationHeight: institutionVisualHeight(severity, item.type)
        }
      }];
    })
  };
}

function statusColorExpression() {
  return ['match', ['get', 'riskTone'],
    'red', '#ff5d72',
    'amber', '#ffc857',
    'green', '#2ce7b0',
    '#35d8ff'
  ];
}

function addSafetyBasemap(map) {
  if (map.getSource('ssb-safety-basemap')) return;
  const style = map.getStyle();
  const beforeId = (style.layers ?? []).find(layer => layer.type !== 'background')?.id;
  try {
    map.addSource('ssb-safety-basemap', {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors'
    });
    map.addLayer({
      id: 'ssb-safety-basemap',
      type: 'raster',
      source: 'ssb-safety-basemap',
      paint: {
        'raster-opacity': 0.86,
        'raster-saturation': -0.28,
        'raster-contrast': 0.05,
        'raster-brightness-min': 0.08,
        'raster-brightness-max': 0.92
      }
    }, beforeId);
  } catch (error) {
    console.warn('Safety basemap unavailable', error);
  }
}

function addNativeBuildingExtrusion(map) {
  if (map.getLayer('ssb-native-buildings-3d')) return;
  const style = map.getStyle();
  const vectorSource = Object.entries(style.sources ?? {}).find(([, source]) => source?.type === 'vector');
  if (!vectorSource) return;
  const [sourceId] = vectorSource;
  const firstSymbol = (style.layers ?? []).find(layer => layer.type === 'symbol')?.id;
  try {
    map.addLayer({
      id: 'ssb-native-buildings-3d',
      type: 'fill-extrusion',
      source: sourceId,
      'source-layer': 'building',
      minzoom: 13.2,
      paint: {
        'fill-extrusion-color': ['interpolate', ['linear'], ['zoom'], 13.2, '#b7c9d3', 16, '#d8edf4'],
        'fill-extrusion-height': ['coalesce', ['to-number', ['get', 'render_height']], ['to-number', ['get', 'height']], 8],
        'fill-extrusion-base': ['coalesce', ['to-number', ['get', 'render_min_height']], ['to-number', ['get', 'min_height']], 0],
        'fill-extrusion-opacity': 0.76,
        'fill-extrusion-vertical-gradient': true
      }
    }, firstSymbol);
  } catch (error) {
    console.warn('Native Bukhara building extrusion unavailable', error);
  }
}

function createHospitalMarkerElement(item) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'ssb-hospital-marker';
  element.dataset.tone = riskTone(item.risk?.severity);
  element.dataset.institutionId = String(item.id);
  element.title = item.officialName ?? 'Tibbiyot muassasasi';
  element.setAttribute('aria-label', `${item.officialName ?? 'Tibbiyot muassasasi'} 3D marker`);

  const ring = document.createElement('span');
  ring.className = 'ssb-hospital-marker-ring';
  const building = document.createElement('span');
  building.className = 'ssb-hospital-building';
  const cross = document.createElement('span');
  cross.className = 'ssb-hospital-cross';
  cross.textContent = '+';
  building.appendChild(cross);
  element.append(ring, building);
  element.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    focusInstitution(String(item.id));
  });
  return element;
}

function updateHospitalMarkerDetail() {
  const close = (state.map?.getZoom() ?? 0) >= 12.5;
  for (const entry of state.hospitalMarkers) entry.element.classList.toggle('is-close', close);
}

function syncHospitalMarkers(institutions) {
  for (const entry of state.hospitalMarkers) entry.marker.remove();
  state.hospitalMarkers = [];
  if (!state.map) return;

  for (const item of institutions) {
    if (!Number.isFinite(item.longitude) || !Number.isFinite(item.latitude)) continue;
    const element = createHospitalMarkerElement(item);
    const marker = new maplibregl.Marker({ element, anchor: 'bottom' })
      .setLngLat([item.longitude, item.latitude])
      .addTo(state.map);
    state.hospitalMarkers.push({ marker, element });
  }
  updateHospitalMarkerDetail();
}

function addInstitution3dLayers(map, institutions) {
  map.addSource('institutions-enhanced', { type: 'geojson', data: pointCollection(institutions) });
  map.addSource('institution-buildings', { type: 'geojson', data: institutionBuildingCollection(institutions) });

  map.addLayer({
    id: 'institution-buildings-3d',
    type: 'fill-extrusion',
    source: 'institution-buildings',
    minzoom: 11.5,
    paint: {
      'fill-extrusion-color': ['match', ['get', 'riskTone'],
        'red', '#d83d55',
        'amber', '#d99b24',
        'green', '#159b77',
        '#1686a6'
      ],
      'fill-extrusion-height': ['get', 'visualizationHeight'],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.94,
      'fill-extrusion-vertical-gradient': true
    }
  });

  map.addLayer({
    id: 'institution-status-glow',
    type: 'circle',
    source: 'institutions-enhanced',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 8, 10, 11, 14, 17],
      'circle-color': statusColorExpression(),
      'circle-opacity': 0.16,
      'circle-blur': 0.72
    }
  });

  map.addLayer({
    id: 'institution-status-ring',
    type: 'circle',
    source: 'institutions-enhanced',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 5.5, 10, 8, 14, 12],
      'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': statusColorExpression(),
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 7, 1.8, 14, 3.2],
      'circle-stroke-opacity': 0.98
    }
  });

  map.addLayer({
    id: 'institution-enhanced-center',
    type: 'circle',
    source: 'institutions-enhanced',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 2.6, 14, 4.8],
      'circle-color': '#f4ffff',
      'circle-stroke-color': statusColorExpression(),
      'circle-stroke-width': 1.8
    }
  });

  map.addLayer({
    id: 'institution-enhanced-label',
    type: 'symbol',
    source: 'institutions-enhanced',
    minzoom: 11.3,
    layout: {
      'text-field': ['get', 'officialName'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 11.3, 10, 15, 12],
      'text-offset': [0, 1.35],
      'text-anchor': 'top',
      'text-max-width': 18,
      'text-allow-overlap': false
    },
    paint: {
      'text-color': '#f2ffff',
      'text-halo-color': 'rgba(0,15,28,.94)',
      'text-halo-width': 1.6
    }
  });
}

function updateEnhancedData(institutions) {
  state.institutions = institutions;
  const pointSource = state.map?.getSource('institutions-enhanced');
  const buildingSource = state.map?.getSource('institution-buildings');
  if (pointSource) pointSource.setData(pointCollection(institutions));
  if (buildingSource) buildingSource.setData(institutionBuildingCollection(institutions));
  syncHospitalMarkers(institutions);
}

function boundsFor(institutions) {
  const valid = institutions.filter(item => Number.isFinite(item.longitude) && Number.isFinite(item.latitude));
  if (!valid.length) return null;
  const bounds = new maplibregl.LngLatBounds();
  for (const item of valid) bounds.extend([item.longitude, item.latitude]);
  return bounds;
}

function fitInstitutions(institutions, duration = 0) {
  const bounds = boundsFor(institutions);
  if (!bounds || !state.map) return;
  state.map.fitBounds(bounds, {
    padding: { top: 115, bottom: 70, left: 340, right: 340 },
    maxZoom: 10.8,
    pitch: 52,
    bearing: -12,
    duration
  });
}

function focusInstitution(id) {
  const item = state.bootstrap?.institutions?.find(row => row.id === id) ?? state.institutions.find(row => row.id === id);
  if (!item || !state.map || !Number.isFinite(item.longitude) || !Number.isFinite(item.latitude)) return;
  state.map.easeTo({ center: [item.longitude, item.latitude], zoom: Math.max(state.map.getZoom(), 15.2), pitch: 63, bearing: -20, duration: 850 });
  window.SSB360Situation?.focusInstitution?.(id);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`enhanced_map_${response.status}`);
  return response.json();
}

function createEnhancedContainer() {
  const stage = document.querySelector('.situation-map-stage');
  if (!stage || document.getElementById('situationMapEnhanced')) return null;
  const container = document.createElement('div');
  container.id = 'situationMapEnhanced';
  container.className = 'situation-map-enhanced';
  container.setAttribute('aria-label', 'Buxoro muassasalari 3D xaritasi');
  stage.appendChild(container);
  return container;
}

function wireLayerInteraction(map) {
  for (const layerId of ['institution-status-ring', 'institution-enhanced-center', 'institution-buildings-3d']) {
    map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
    map.on('click', layerId, event => {
      const id = event.features?.[0]?.properties?.id;
      if (id) focusInstitution(String(id));
    });
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const institutionId = target.closest('[data-focus-institution]')?.dataset.focusInstitution;
    if (institutionId) {
      focusInstitution(institutionId);
      return;
    }
    const districtButton = target.closest('[data-focus-district]');
    if (!districtButton) return;
    const districtKey = districtButton.dataset.focusDistrict ?? '';
    if (!districtKey) {
      updateEnhancedData(state.bootstrap?.institutions ?? []);
      fitInstitutions(state.bootstrap?.institutions ?? [], 700);
      return;
    }
    void fetchJson(`/api/v1/situation-center/districts/${encodeURIComponent(districtKey)}`)
      .then(context => {
        if (!context) return;
        updateEnhancedData(context.institutions ?? []);
        fitInstitutions(context.institutions ?? [], 700);
      })
      .catch(error => console.warn('District 3D map update unavailable', error));
  });
}

function initEnhancedMap(bootstrap) {
  const container = createEnhancedContainer();
  if (!container) return null;
  const style = bootstrap.mapStyle?.external && bootstrap.mapStyle.styleUrl
    ? bootstrap.mapStyle.styleUrl
    : FALLBACK_STYLE;
  const map = new maplibregl.Map({
    container,
    style,
    ...BUKHARA_REGION_CAMERA,
    antialias: true,
    attributionControl: true,
    maxPitch: 75
  });
  state.map = map;
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.on('load', () => {
    addSafetyBasemap(map);
    addNativeBuildingExtrusion(map);
    addInstitution3dLayers(map, bootstrap.institutions ?? []);
    syncHospitalMarkers(bootstrap.institutions ?? []);
    wireLayerInteraction(map);
    map.on('zoom', updateHospitalMarkerDetail);
    fitInstitutions(bootstrap.institutions ?? [], 0);
    document.body.classList.add('institution-3d-active');
  });
  map.on('error', event => {
    if (!document.body.classList.contains('institution-3d-active')) {
      console.warn('Enhanced 3D institution map unavailable; base map remains active', event?.error ?? event);
    }
  });
  return map;
}

async function boot() {
  try {
    const bootstrap = await fetchJson('/api/v1/situation-center/bootstrap');
    if (!bootstrap) return;
    state.bootstrap = bootstrap;
    state.institutions = bootstrap.institutions ?? [];
    initEnhancedMap(bootstrap);
  } catch (error) {
    console.warn('Enhanced 3D institution layer unavailable; base map remains active', error);
  }
}

window.SSB360Institution3D = {
  institutionBuildingCollection,
  institutionVisualHeight,
  updateEnhancedData,
  fitInstitutions,
  focusInstitution,
  syncHospitalMarkers
};

void boot();
