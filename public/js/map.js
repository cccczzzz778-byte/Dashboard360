(() => {
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const state = { bootstrap:null, district:'', query:'', map:null, districtMarkers:new Map(), institutionLayer:null };
  const districtLabel = key => state.bootstrap?.districts.find(x => x.key === key)?.label ?? key;

  function tickClock() {
    const el = $('clock');
    if (el) el.textContent = new Intl.DateTimeFormat('uz-UZ',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date());
  }
  tickClock(); setInterval(tickClock, 30000);

  function renderSummary() {
    const b = state.bootstrap;
    $('summaryInstitutions').textContent = b.summary.institutions;
    $('summaryDistricts').textContent = b.summary.districts;
    $('summarySources').textContent = `${b.summary.configuredSources} / ${b.summary.totalSources}`;
    $('summaryAlerts').textContent = 'N/A';
    $('systemStatus').textContent = 'Online · ma’lumot manbalari kuzatilmoqda';
    $('moduleCountBadge').textContent = `${b.modules.length} modul`;
  }

  function renderDistrictSelect() {
    const select = $('districtSelect');
    select.innerHTML = '<option value="">Barcha hududlar</option>' + state.bootstrap.districts.map(d => `<option value="${escape(d.key)}">${escape(d.label)}</option>`).join('');
    select.addEventListener('change', () => selectDistrict(select.value, true));
  }

  function currentInstitutions() {
    const query = state.query.trim().toLowerCase();
    return state.bootstrap.institutions.filter(item => {
      const districtOk = !state.district || item.districtKey === state.district;
      const queryOk = !query || `${item.officialName} ${item.type} ${districtLabel(item.districtKey)}`.toLowerCase().includes(query);
      return districtOk && queryOk;
    });
  }

  function renderInstitutionList() {
    const rows = currentInstitutions();
    $('districtTitle').textContent = state.district ? districtLabel(state.district) : 'Barcha muassasalar';
    $('institutionCount').textContent = `${rows.length} ta muassasa`;
    $('institutionList').innerHTML = rows.length ? rows.map(item => `
      <button class="institution" type="button" data-id="${escape(item.id)}">
        <div class="institution-top"><strong>${escape(item.officialName)}</strong><span class="type">${escape(item.type)}</span></div>
        <div class="institution-meta"><span>⌖ ${escape(districtLabel(item.districtKey))}</span><span>Rahbar: ${escape(item.leaderName ?? 'N/A')}</span></div>
        <div class="institution-location">Joylashuv: ${item.locationAccuracy === 'exact' ? 'aniq GPS' : 'hudud markazi bo‘yicha'}</div>
      </button>`).join('') : '<div class="empty">Mos muassasa topilmadi</div>';
  }

  function renderGroups() {
    const groups = new Map();
    for (const module of state.bootstrap.modules) {
      if (!groups.has(module.category)) groups.set(module.category, []);
      groups.get(module.category).push(module);
    }
    $('controlGroups').innerHTML = [...groups.entries()].map(([category,modules]) => `<article class="control-group"><h3>${escape(category)}</h3><div class="module-chips">${modules.map(m => `<button type="button" class="module-chip" data-module-key="${escape(m.key)}">${escape(m.label)}</button>`).join('')}</div></article>`).join('');
  }

  function renderIntegrations() {
    $('integrationList').innerHTML = state.bootstrap.integrations.map(item => `<a class="integration-item" href="${escape(item.url)}" target="_blank" rel="noopener noreferrer"><div><strong>${escape(item.label)}</strong><span>${escape(item.group)} · ${item.auth === 'browser-session' ? 'brauzer sessiyasi orqali' : 'tashqi tizim'}</span></div><b class="integration-arrow">↗</b></a>`).join('');
  }

  function renderSources() {
    const labels = {configured:'Sozlangan','browser-auth':'Brauzer auth','external':'Tashqi','unavailable':'Ulanmagan'};
    $('sourceList').innerHTML = state.bootstrap.sources.map(source => `<div class="source-row"><div><strong>${escape(source.label)}</strong><small>${source.status === 'unavailable' ? 'Endpoint yoki ruxsat kutilmoqda' : 'Manba konfiguratsiyasi mavjud'}</small></div><span class="status-badge ${escape(source.status)}">${escape(labels[source.status] ?? source.status)}</span></div>`).join('');
  }

  function renderFallback() {
    const fallback = $('districtFallback');
    fallback.innerHTML = state.bootstrap.districts.map(d => `<button type="button" class="fallback-district" data-district="${escape(d.key)}">${escape(d.label)}</button>`).join('');
    fallback.addEventListener('click', event => { const key = event.target.closest('[data-district]')?.dataset.district; if (key) selectDistrict(key,true); });
  }

  function markerHtml(label, selected=false) {
    return `<div class="district-marker${selected ? ' selected':''}">${escape(label)}</div>`;
  }

  function initMap() {
    renderFallback();
    if (!window.L) { $('buxoroMap').hidden = true; $('districtFallback').classList.add('visible'); return; }
    const L = window.L;
    state.map = L.map('buxoroMap',{zoomControl:true,minZoom:7,maxZoom:15,attributionControl:true}).setView([39.82,64.34],8.35);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(state.map);
    state.institutionLayer = L.layerGroup().addTo(state.map);
    for (const district of state.bootstrap.districts) {
      const count = state.bootstrap.institutions.filter(x => x.districtKey === district.key).length;
      const icon = L.divIcon({className:'health-div-icon',html:markerHtml(count),iconSize:[34,34],iconAnchor:[17,17]});
      const marker = L.marker([district.latitude,district.longitude],{icon,title:district.label}).addTo(state.map);
      marker.bindTooltip(`${district.label} · ${count} ta muassasa`,{direction:'top'});
      marker.on('click',() => selectDistrict(district.key,true));
      state.districtMarkers.set(district.key,marker);
    }
  }

  function renderInstitutionMarkers(rows) {
    if (!state.map || !state.institutionLayer) return;
    const L = window.L;
    state.institutionLayer.clearLayers();
    rows.slice(0,80).forEach((item,index) => {
      if (item.latitude == null || item.longitude == null) return;
      const angle = (index * 137.508) * Math.PI / 180;
      const ring = Math.floor(index / 7) + 1;
      const radius = item.locationAccuracy === 'exact' ? 0 : Math.min(.008 * ring,.045);
      const lat = item.latitude + Math.sin(angle) * radius;
      const lng = item.longitude + Math.cos(angle) * radius;
      const icon = L.divIcon({className:'health-div-icon',html:'<div class="institution-marker">+</div>',iconSize:[20,20],iconAnchor:[10,10]});
      const marker = L.marker([lat,lng],{icon,title:item.officialName}).addTo(state.institutionLayer);
      marker.bindTooltip(item.officialName,{direction:'top'});
      marker.bindPopup(`<div class="map-popup"><strong>${escape(item.officialName)}</strong><span>${escape(item.type)} · ${escape(districtLabel(item.districtKey))}</span><span>${item.locationAccuracy === 'exact' ? 'Aniq GPS' : 'Marker hudud markaziga nisbatan joylashtirilgan'}</span><button type="button" data-open-institution="${escape(item.id)}">360° ochish</button></div>`);
      marker.on('popupopen',event => {
        const node = event.popup.getElement();
        node?.querySelector('[data-open-institution]')?.addEventListener('click',() => window.SSB360?.openInstitution(item.id));
      });
    });
  }

  function selectDistrict(key, moveMap=false) {
    state.district = key || '';
    $('districtSelect').value = state.district;
    for (const [districtKey,marker] of state.districtMarkers.entries()) {
      const district = state.bootstrap.districts.find(x => x.key === districtKey);
      const count = state.bootstrap.institutions.filter(x => x.districtKey === districtKey).length;
      marker.setIcon(window.L.divIcon({className:'health-div-icon',html:markerHtml(count,districtKey===state.district),iconSize:[34,34],iconAnchor:[17,17]}));
      if (moveMap && key === districtKey && district) state.map?.flyTo([district.latitude,district.longitude],10,{duration:.6});
    }
    const rows = currentInstitutions();
    renderInstitutionList();
    renderInstitutionMarkers(rows);
  }

  function focusInstitution(id) {
    const item = state.bootstrap?.institutions.find(x => x.id === id);
    if (!item) return;
    if (item.latitude != null && item.longitude != null && state.map) state.map.flyTo([item.latitude,item.longitude],12,{duration:.6});
  }

  function wireUi() {
    $('institutionSearch').addEventListener('input', event => { state.query = event.target.value; renderInstitutionList(); renderInstitutionMarkers(currentInstitutions()); });
    $('institutionList').addEventListener('click', event => { const id = event.target.closest('[data-id]')?.dataset.id; if (id) window.SSB360?.openInstitution(id); });
    $('resetMap').addEventListener('click',() => { state.district=''; $('districtSelect').value=''; renderInstitutionList(); renderInstitutionMarkers(currentInstitutions()); state.map?.flyTo([39.82,64.34],8.35,{duration:.6}); });
    document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click',() => { document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active')); button.classList.add('active'); document.getElementById(button.dataset.target)?.scrollIntoView({behavior:'smooth',block:'start'}); }));
    $('controlGroups').addEventListener('click',() => { $('institutionsPanel').scrollIntoView({behavior:'smooth',block:'center'}); });
  }

  async function boot() {
    try {
      const response = await fetch('/api/bootstrap',{headers:{accept:'application/json'}});
      if (response.status === 401) return location.href='/login';
      if (!response.ok) throw new Error(`bootstrap_${response.status}`);
      state.bootstrap = await response.json();
      window.SSB360_STATE = state;
      renderSummary(); renderDistrictSelect(); renderGroups(); renderIntegrations(); renderSources(); initMap(); renderInstitutionList(); renderInstitutionMarkers(currentInstitutions()); wireUi();
    } catch (error) {
      $('systemStatus').textContent = 'Yuklashda xato';
      $('institutionList').innerHTML = '<div class="empty">Dashboard ma’lumotlarini yuklab bo‘lmadi. Sahifani yangilang.</div>';
      console.error(error);
    }
  }

  window.SSB360Map = { focusInstitution, selectDistrict };
  boot();
})();
