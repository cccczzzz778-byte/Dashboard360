(() => {
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const drawer = $('institutionDrawer');
  const backdrop = $('drawerBackdrop');
  const header = $('institutionHeader');
  const tabs = $('moduleTabs');
  const summary = $('moduleSummary');
  const content = $('moduleContent');
  const executiveStats = $('institutionExecutiveStats');
  const dataHealth = $('institutionDataHealth');
  const breadcrumb = $('institutionBreadcrumb');
  const dialog = $('metricEditor');
  const form = $('metricForm');
  let current = null;
  let activeKey = 'passport';

  const statusLabels = {live:'Jonli',manual:'Manual',imported:'Katalog',unavailable:'Ulanmagan',error:'Xato'};
  const protectedKeys = new Set(['officialName','type','district','address','leader','phone']);

  const hasValue = metric => metric.value !== null && metric.value !== '';

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

  function renderExecutiveStats() {
    if (!current) return;
    const metrics = current.modules.flatMap(module => module.metrics);
    const total = metrics.length;
    const available = metrics.filter(hasValue).length;
    const live = metrics.filter(metric => metric.sourceStatus === 'live' && hasValue(metric)).length;
    const manual = metrics.filter(metric => metric.sourceStatus === 'manual' && hasValue(metric)).length;
    const unavailable = metrics.filter(metric => !hasValue(metric)).length;
    const completeness = total ? Math.round((available / total) * 100) : 0;
    const healthClass = completeness >= 70 ? '' : completeness >= 35 ? 'warning' : 'critical';

    dataHealth.className = `drawer-data-health ${healthClass}`.trim();
    dataHealth.innerHTML = `<i class="health-dot"></i><span>${available} / ${total} ko‘rsatkichda ma’lumot · to‘liqlik ${completeness}%</span>`;

    executiveStats.innerHTML = `
      <article class="exec-kpi"><div class="kpi-icon">%</div><div><span class="kpi-label">Ma’lumot to‘liqligi</span><strong class="kpi-value">${completeness}%</strong><small class="kpi-meta">${available} / ${total} ko‘rsatkich</small></div></article>
      <article class="exec-kpi blue"><div class="kpi-icon">↻</div><div><span class="kpi-label">Jonli manba</span><strong class="kpi-value">${live}</strong><small class="kpi-meta">integratsiyadan olingan</small></div></article>
      <article class="exec-kpi amber"><div class="kpi-icon">✎</div><div><span class="kpi-label">Manual qiymat</span><strong class="kpi-value">${manual}</strong><small class="kpi-meta">qo‘lda tasdiqlangan</small></div></article>
      <article class="exec-kpi muted"><div class="kpi-icon">—</div><div><span class="kpi-label">Ulanmagan / N/A</span><strong class="kpi-value">${unavailable}</strong><small class="kpi-meta">real manba kutilmoqda</small></div></article>`;
  }

  function renderModule(key) {
    if (!current) return;
    activeKey = key;
    renderTabs();
    const module = current.modules.find(x => x.key === key);
    if (!module) { content.innerHTML='<div class="empty">Modul topilmadi</div>'; return; }
    const available = module.metrics.filter(hasValue).length;
    const percent = module.metrics.length ? Math.round((available / module.metrics.length) * 100) : 0;
    breadcrumb.textContent = module.label;
    summary.innerHTML = `<div class="module-summary-copy"><span class="eyebrow">${escape(module.category)}</span><h2>${escape(module.label)}</h2><p>${available} / ${module.metrics.length} ko‘rsatkichda qiymat mavjud</p></div><div class="module-completeness"><div class="module-completeness-top"><span class="source-badge ${escape(module.status)}">${escape(statusLabels[module.status] ?? module.status)}</span><strong>${percent}%</strong></div><div class="module-progress"><i style="width:${percent}%"></i></div></div>`;
    content.innerHTML = `<div class="metric-grid">${module.metrics.map(metric => {
      const present = hasValue(metric);
      const editable = !protectedKeys.has(metric.key) && metric.sourceStatus !== 'live';
      const status = metric.sourceStatus ?? 'unavailable';
      return `<article class="metric metric-${escape(status)}" data-metric="${escape(metric.key)}"><div class="label">${escape(metric.label)}</div><div class="value ${present?'':'na'}">${present?escape(metric.value):'N/A'}${present && metric.unit ? ` <small>${escape(metric.unit)}</small>` : ''}</div><div class="meta">${sourceBadge(metric)}${editable?`<button class="edit-metric" type="button" data-edit="${escape(metric.key)}">${present?'Tahrirlash':'Kiritish'}</button>`:''}</div><div class="metric-source-note">${escape(metric.sourceName ?? (present?'Manba ko‘rsatilmagan':'Real manba ulanmagan'))}${metric.fetchedAt?` · ${escape(new Date(metric.fetchedAt).toLocaleString('uz-UZ'))}`:''}</div></article>`;
    }).join('')}</div>`;
    const workspace = drawer.querySelector('.module-workspace');
    if (workspace) workspace.scrollTop = 0;
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
    header.innerHTML = `<span class="eyebrow">Muassasa 360° · boshqaruv profili</span><h2 title="${escape(x.officialName)}">${escape(x.officialName)}</h2><p>${escape(x.type)} · ${escape(districtLabel(x.districtKey))}</p><div class="header-badges"><span class="status-badge configured">${escape(location)}</span><span class="status-badge ${x.leaderName?'configured':'unavailable'}">Rahbar: ${escape(x.leaderName ?? 'N/A')}</span></div>`;
  }

  async function openInstitution(id) {
    drawer.hidden=false;
    backdrop.hidden=false;
    document.body.classList.add('institution-360-open');
    document.body.style.overflow='hidden';
    header.innerHTML='<span class="eyebrow">Muassasa 360°</span><h2>Yuklanmoqda...</h2>';
    dataHealth.className='drawer-data-health';
    dataHealth.innerHTML='<i class="health-dot"></i><span>Ma’lumot holati tekshirilmoqda...</span>';
    executiveStats.innerHTML='<article class="exec-kpi"><div class="kpi-icon">…</div><div><span class="kpi-label">Yuklanmoqda</span><strong class="kpi-value">—</strong><small class="kpi-meta">muassasa ma’lumoti</small></div></article>';
    tabs.innerHTML='';
    content.innerHTML='<div class="skeleton-list"><i></i><i></i><i></i></div>';
    try {
      current = await fetchInstitution(id);
      if (!current) return;
      activeKey='passport';
      renderHeader();
      renderExecutiveStats();
      renderModule(activeKey);
      requestAnimationFrame(() => $('close360')?.focus({preventScroll:true}));
    } catch (error) {
      dataHealth.className='drawer-data-health critical';
      dataHealth.innerHTML='<i class="health-dot"></i><span>Muassasa ma’lumotini yuklab bo‘lmadi</span>';
      content.innerHTML='<div class="empty">Muassasa ma’lumotini yuklab bo‘lmadi.</div>';
      console.error(error);
    }
  }

  function closeDrawer() {
    drawer.hidden=true;
    backdrop.hidden=true;
    document.body.classList.remove('institution-360-open');
    document.body.style.overflow='';
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
    const submit=form.querySelector('[type="submit"]');
    submit.disabled=true;
    submit.textContent='Saqlanmoqda...';
    try {
      const payload={institutionId:form.elements.institutionId.value,moduleKey:activeKey,metricKey:form.elements.metricKey.value,value:form.elements.value.value,unit:form.elements.unit.value};
      const response=await fetch('/api/admin/metrics',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(payload)});
      if (response.status===401) return location.href='/login';
      if (!response.ok) throw new Error(`save_${response.status}`);
      dialog.close();
      current=await fetchInstitution(current.institution.id);
      renderHeader();
      renderExecutiveStats();
      renderModule(activeKey);
    } catch(error) {
      alert('Qiymatni saqlashda xato. PostgreSQL ulanishini tekshiring.');
      console.error(error);
    } finally {
      submit.disabled=false;
      submit.textContent='Saqlash';
    }
  }

  tabs.addEventListener('click',event => {
    const key=event.target.closest('[data-module]')?.dataset.module;
    if(key) renderModule(key);
  });
  content.addEventListener('click',event => {
    const key=event.target.closest('[data-edit]')?.dataset.edit;
    if(key) editMetric(key);
  });
  $('close360').addEventListener('click',closeDrawer);
  backdrop.addEventListener('click',closeDrawer);
  $('openOnMap').addEventListener('click',() => {
    if(current) {
      closeDrawer();
      window.SSB360Map?.focusInstitution(current.institution.id);
    }
  });
  $('metricEditorClose').addEventListener('click',() => dialog.close());
  $('metricCancel').addEventListener('click',() => dialog.close());
  form.addEventListener('submit',saveMetric);
  document.addEventListener('keydown',event => {
    if(event.key==='Escape' && !drawer.hidden && !dialog.open) closeDrawer();
  });

  window.SSB360={openInstitution,closeDrawer};
})();
