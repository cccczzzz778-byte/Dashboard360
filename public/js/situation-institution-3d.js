import * as maplibregl from '/vendor/maplibre/maplibre-gl.mjs';

maplibregl.setWorkerUrl('/vendor/maplibre/maplibre-gl-worker.mjs');

const BUKHARA_REGION_CAMERA = { center: [64.30, 39.78], zoom: 8.15, pitch: 20, bearing: 0 };
const BUKHARA_REGION_BOUNDS = [[63.45, 39.15], [65.05, 40.35]];
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

function validInstitutions(institutions) {
  return institutions.filter(item => Number.isFinite(item.longitude) && Number.isFinite(item.latitude));
}

function hasExactLocation(item) {
  return Boolean(
    item?.locationAccuracy === 'exact' &&
    Number.isFinite(item?.longitude) &&
    Number.isFinite(item?.latitude)
  );
}

function institutionVisualHeight(severity, type = '') {
  const base = severity === 'red' ? 30 : severity === 'amber' ? 24 : severity === 'green' ? 18 : 21;
  const normalizedType = String(type).toLowerCase();
  const isLargeHospital = /markaz|shifoxona|hospital|kompleks|ko‘p tarmoqli|ko'p tarmoqli/.test(normalizedType);
  return isLargeHospital ? Math.min(32, base + 2) : base;
}

function pointCollection(institutions) {
  return {
    type: 'FeatureCollection',
    features: validInstitutions(institutions).map(item => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [item.longitude, item.latitude] },
      properties: {
        id: item.id,
        officialName: item.officialName,
        districtKey: item.districtKey,
        type: item.type,
        locationAccuracy: item.locationAccuracy ?? 'unknown'
      }
    }))
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
    features: institutions.filter(hasExactLocation).map(item => {
      const severity = item.risk?.severity ?? 'unavailable';
      return {
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
          locationAccuracy: item.locationAccuracy,
          visualizationFootprint: true,
          visualizationHeight: institutionVisualHeight(severity, item.type)
        }
      };
    })
  };
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
        'raster-opacity': 0.94,
        'raster-saturation': -0.08,
        'raster-contrast': 0.01,
        'raster-brightness-min': 0.08,
        'raster-brightness-max': 0.98
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
        'fill-extrusion-opacity': 0.72,
        'fill-extrusion-vertical-gradient': true
      }
    }, firstSymbol);
  } catch (error) {
    console.warn('Native Bukhara building extrusion unavailable', error);
  }
}

function sharedAnchorGroups(institutions) {
  const groups = new Map();
  for (const item of validInstitutions(institutions)) {
    const key = `${Number(item.longitude).toFixed(6)}:${Number(item.latitude).toFixed(6)}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function visualOffsetForSharedAnchor(index, count) {
  if (count <= 1) return { x: 0, y: 0 };
  const columns = Math.min(3, count);
  const rows = Math.ceil(count / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);
  return {
    x: Math.round((column - (columns - 1) / 2) * 34),
    y: Math.round((row - (rows - 1) / 2) * 30)
  };
}

function createHospitalMarkerElement(item, sharedIndex = 0, sharedCount = 1) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'ssb-hospital-marker';
  element.dataset.tone = riskTone(item.risk?.severity);
  element.dataset.institutionId = String(item.id);
  element.dataset.locationAccuracy = item.locationAccuracy ?? 'unknown';
  element.dataset.sharedAnchor = sharedCount > 1 ? 'true' : 'false';
  const offset = visualOffsetForSharedAnchor(sharedIndex, sharedCount);
  element.style.setProperty('--marker-offset-x', `${offset.x}px`);
  element.style.setProperty('--marker-offset-y', `${offset.y}px`);
  element.title = item.locationAccuracy === 'exact'
    ? (item.officialName ?? 'Tibbiyot muassasasi')
    : `${item.officialName ?? 'Tibbiyot muassasasi'} · taxminiy markaz`;
  element.setAttribute('aria-label', `${item.officialName ?? 'Tibbiyot muassasasi'} 3D marker`);

  const visual = document.createElement('span');
  visual.className = 'ssb-hospital-marker-visual';
  const ring = document.createElement('span');
  ring.className = 'ssb-hospital-marker-ring';
  const building = document.createElement('span');
  building.className = 'ssb-hospital-building';
  const cross = document.createElement('span');
  cross.className = 'ssb-hospital-cross';
  cross.textContent = '+';
  building.appendChild(cross);
  visual.append(ring, building);
  element.appendChild(visual);

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

  for (const items of sharedAnchorGroups(institutions)) {
    items.forEach((item, index) => {
      const element = createHospitalMarkerElement(item, index, items.length);
      const marker = new maplibregl.Marker({ element, anchor: 'bottom' })
        .setLngLat([item.longitude, item.latitude])
        .addTo(state.map);
      state.hospitalMarkers.push({ marker, element });
    });
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
    minzoom: 11.8,
    paint: {
      'fill-extrusion-color': ['match', ['get', 'riskTone'],
        'red', '#d83d55',
        'amber', '#d99b24',
        'green', '#159b77',
        '#1686a6'
      ],
      'fill-extrusion-height': ['get', 'visualizationHeight'],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.82,
      'fill-extrusion-vertical-gradient': true
    }
  });

  map.addLayer({
    id: 'institution-enhanced-label',
    type: 'symbol',
    source: 'institutions-enhanced',
    minzoom: 11.8,
    filter: ['==', ['get', 'locationAccuracy'], 'exact'],
    layout: {
      'text-field': ['get', 'officialName'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 11.8, 9, 15, 12],
      'text-offset': [0, 2.5],
      'text-anchor': 'top',
      'text-max-width': 18,
      'text-allow-overlap': false
    },
    paint: {
      'text-color': '#103348',
      'text-halo-color': 'rgba(255,255,255,.96)',
      'text-halo-width': 1.8
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
  const valid = validInstitutions(institutions);
  if (!valid.length) return null;
  const bounds = new maplibregl.LngLatBounds();
  for (const item of valid) bounds.extend([item.longitude, item.latitude]);
  return bounds;
}

function provincePadding() {
  return window.innerWidth <= 900
    ? { top: 72, bottom: 52, left: 34, right: 34 }
    : { top: 105, bottom: 72, left: 150, right: 150 };
}

function resetProvinceView(duration = 0) {
  if (!state.map) return;
  state.map.fitBounds(BUKHARA_REGION_BOUNDS, {
    padding: provincePadding(),
    maxZoom: 8.8,
    pitch: 20,
    bearing: 0,
    duration
  });
}

function fitInstitutions(institutions, duration = 0) {
  const bounds = boundsFor(institutions);
  if (!bounds || !state.map) return;
  state.map.fitBounds(bounds, {
    padding: provincePadding(),
    maxZoom: 9.8,
    pitch: 20,
    bearing: 0,
    duration
  });
}

function focusInstitution(id) {
  const item = state.bootstrap?.institutions?.find(row => row.id === id) ?? state.institutions.find(row => row.id === id);
  if (!item || !state.map || !Number.isFinite(item.longitude) || !Number.isFinite(item.latitude)) return;
  const center = [item.longitude, item.latitude];
  if (hasExactLocation(item)) {
    state.map.easeTo({ center, zoom: Math.max(state.map.getZoom(), 15.2), pitch: 58, bearing: -16, duration: 850 });
  } else {
    state.map.easeTo({ center, zoom: Math.max(state.map.getZoom(), 11.2), pitch: 24, bearing: 0, duration: 700 });
  }
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

function addProvinceControl(map) {
  const container = document.createElement('div');
  container.className = 'maplibregl-ctrl maplibregl-ctrl-group ssb-province-control';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Viloyat';
  button.title = 'Buxoro viloyati ko‘rinishi';
  button.setAttribute('aria-label', 'Buxoro viloyati ko‘rinishiga qaytish');
  button.addEventListener('click', () => resetProvinceView(650));
  container.appendChild(button);
  map.addControl({
    onAdd() { return container; },
    onRemove() { container.remove(); }
  }, 'top-right');
}

function wireLayerInteraction(map) {
  map.on('mouseenter', 'institution-buildings-3d', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'institution-buildings-3d', () => { map.getCanvas().style.cursor = ''; });
  map.on('click', 'institution-buildings-3d', event => {
    const id = event.features?.[0]?.properties?.id;
    if (id) focusInstitution(String(id));
  });

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
      resetProvinceView(700);
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
    maxBounds: BUKHARA_REGION_BOUNDS,
    antialias: true,
    attributionControl: true,
    maxPitch: 70
  });
  state.map = map;
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  addProvinceControl(map);
  map.on('load', () => {
    addSafetyBasemap(map);
    addNativeBuildingExtrusion(map);
    addInstitution3dLayers(map, bootstrap.institutions ?? []);
    syncHospitalMarkers(bootstrap.institutions ?? []);
    wireLayerInteraction(map);
    map.on('zoom', updateHospitalMarkerDetail);
    resetProvinceView(0);
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
  hasExactLocation,
  validInstitutions,
  sharedAnchorGroups,
  visualOffsetForSharedAnchor,
  updateEnhancedData,
  fitInstitutions,
  resetProvinceView,
  focusInstitution,
  syncHospitalMarkers
};

void boot();
