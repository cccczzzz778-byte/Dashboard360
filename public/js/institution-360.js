(() => {
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const drawer = $('institutionDrawer');
  const backdrop = $('drawerBackdrop');
  const header = $('institutionHeader');
  const tabs = $('moduleTabs');
  const summary = $('moduleSummary');
  const content = $('moduleContent');
  const dialog = $('metricEditor');
  const form = $('metricForm');
  let current = null;
  let activeKey = 'passport';

  const statusLabels = {live:'Jonli',manual:'Manual',imported:'Katalog',unavailable:'Ulanmagan',error:'Xato'};
  const protectedKeys = new Set(['officialName','type','district','address','leader','phone']);

  function districtLabel(key) {
    return window.SSB360_STATE?.bootstrap?.districts?.find(x => x.key === key)?.label ?? key;
  }

  function sourceBadge(metric) {
    const status = metric.sourceStatus ?? 'unavailable';
    return `<span class="source-badge ${escape(status)}">${escape(statusLabels[status] ?? status)}</span>`;
  }

  function renderTabs() {
    if (!current) return;
    let lastCategory = '';
    tabs.innerHTML = current.modules.map(module => {
      const heading = module.category !== lastCategory ? `<span class="module-category">${escape(module.category)}</span>` : '';
      lastCategory = module.category;
      return `${heading}<button type="button" data-module="${escape(module.key)}" class="${module.key===activeKey?'active':''}">${escape(module.label)}</button>`;
    }).join('');
  }

  function renderModule(key) {
    if (!current) return;
    activeKey = key;
    renderTabs();
    const module = current.modules.find(x => x.key === key);
    if (!module) { content.innerHTML='<div class="empty">Modul topilmadi</div>'; return; }
    const available = module.metrics.filter(x => x.value !== null && x.value !== '').length;
    summary.innerHTML = `<div><span class="eyebrow">${escape(module.category)}</span><h2>${escape(module.label)}</h2><p>${available} / ${module.metrics.length} ko‘rsatkichda qiymat mavjud</p></div><span class="source-badge ${escape(module.status)}">${escape(statusLabels[module.status] ?? module.status)}</span>`;
    content.innerHTML = `<div class="metric-grid">${module.metrics.map(metric => {
      const hasValue = metric.value !== null && metric.value !== '';
      const editable = !protectedKeys.has(metric.key) && metric.sourceStatus !== 'live';
      return `<article class="metric" data-metric="${escape(metric.key)}"><div class="label">${escape(metric.label)}</div><div class="value ${hasValue?'':'na'}">${hasValue?escape(metric.value):'N/A'}${hasValue && metric.unit ? ` <small>${escape(metric.unit)}</small>` : ''}</div><div class="meta">${sourceBadge(metric)}${editable?`<button class="edit-metric" type="button" data-edit="${escape(metric.key)}">${hasValue?'Tahrirlash':'Kiritish'}</button>`:''}</div><div class="metric-source-note">${escape(metric.sourceName ?? (hasValue?'Manba ko‘rsatilmagan':'Real manba ulanmagan'))}${metric.fetchedAt?` · ${escape(new Date(metric.fetchedAt).toLocaleString('uz-UZ'))}`:''}</div></article>`;
    }).join('')}</div>`;
  }

  async function fetchInstitution(id) {
    const response = await fetch(`/api/institutions/${encodeURIComponent(id)}/summary`,{headers:{accept:'application/json'}});
    if (response.status===401) { location.href='/login'; return null; }
    if (!response.ok) throw new Error(`institution_${response.status}`);
    return response.json();
  }

  function renderHeader() {
    const x = current.institution;
    const location = x.locationAccuracy === 'exact' ? 'Aniq GPS' : 'Hudud markazi koordinatasi';
    header.innerHTML = `<span class="eyebrow">Muassasa 360°</span><h2>${escape(x.officialName)}</h2><p>${escape(x.type)} · ${escape(districtLabel(x.districtKey))}</p><div class="header-badges"><span class="status-badge configured">${escape(location)}</span><span class="status-badge ${x.leaderName?'configured':'unavailable'}">Rahbar: ${escape(x.leaderName ?? 'N/A')}</span></div>`;
  }

  async function openInstitution(id) {
    drawer.hidden=false; backdrop.hidden=false; document.body.style.overflow='hidden';
    header.innerHTML='<span class="eyebrow">Muassasa 360°</span><h2>Yuklanmoqda...</h2>';
    tabs.innerHTML=''; content.innerHTML='<div class="skeleton-list"><i></i><i></i><i></i></div>';
    try {
      current = await fetchInstitution(id);
      if (!current) return;
      activeKey='passport'; renderHeader(); renderModule(activeKey);
    } catch (error) {
      content.innerHTML='<div class="empty">Muassasa ma’lumotini yuklab bo‘lmadi.</div>'; console.error(error);
    }
  }

  function closeDrawer() {
    drawer.hidden=true; backdrop.hidden=true; document.body.style.overflow='';
  }

  function editMetric(key) {
    const module = current?.modules.find(x => x.key===activeKey);
    const metric = module?.metrics.find(x => x.key===key);
    if (!metric || protectedKeys.has(key)) return;
    $('metricEditorTitle').textContent=metric.label;
    form.elements.institutionId.value=current.institution.id;
    form.elements.metricKey.value=metric.key;
    form.elements.value.value=metric.value ?? '';
    form.elements.unit.value=metric.unit ?? '';
    dialog.showModal();
    setTimeout(() => form.elements.value.focus(),0);
  }

  async function saveMetric(event) {
    event.preventDefault();
    const submit=form.querySelector('[type="submit"]'); submit.disabled=true; submit.textContent='Saqlanmoqda...';
    try {
      const payload={institutionId:form.elements.institutionId.value,metricKey:form.elements.metricKey.value,value:form.elements.value.value,unit:form.elements.unit.value};
      const response=await fetch('/api/admin/metrics',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(payload)});
      if (response.status===401) return location.href='/login';
      if (!response.ok) throw new Error(`save_${response.status}`);
      dialog.close();
      current=await fetchInstitution(current.institution.id); renderHeader(); renderModule(activeKey);
    } catch(error) { alert('Qiymatni saqlashda xato. PostgreSQL ulanishini tekshiring.'); console.error(error); }
    finally { submit.disabled=false; submit.textContent='Saqlash'; }
  }

  tabs.addEventListener('click',event => { const key=event.target.closest('[data-module]')?.dataset.module; if(key) renderModule(key); });
  content.addEventListener('click',event => { const key=event.target.closest('[data-edit]')?.dataset.edit; if(key) editMetric(key); });
  $('close360').addEventListener('click',closeDrawer); backdrop.addEventListener('click',closeDrawer);
  $('openOnMap').addEventListener('click',() => { if(current) { closeDrawer(); window.SSB360Map?.focusInstitution(current.institution.id); } });
  $('metricEditorClose').addEventListener('click',() => dialog.close()); $('metricCancel').addEventListener('click',() => dialog.close()); form.addEventListener('submit',saveMetric);
  document.addEventListener('keydown',event => { if(event.key==='Escape' && !drawer.hidden && !dialog.open) closeDrawer(); });

  window.SSB360={openInstitution,closeDrawer};
})();
