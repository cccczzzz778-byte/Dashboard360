(() => {
  const drawer = document.getElementById('institution360');
  const header = document.getElementById('institutionHeader');
  const tabs = document.getElementById('moduleTabs');
  const content = document.getElementById('moduleContent');
  let current = null;
  const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function renderModule(key) {
    const module = current?.modules?.find(x => x.key === key);
    [...tabs.querySelectorAll('button')].forEach(b => b.classList.toggle('active', b.dataset.module === key));
    if (!module) return content.innerHTML = '<div class="empty">Ma’lumot ulanmagan</div>';
    content.innerHTML = `<h2>${escape(module.label)}</h2><div class="metric-grid">${module.metrics.map(metric => `<article class="metric"><div class="label">${escape(metric.label)}</div><div class="value">${metric.value == null ? 'N/A' : escape(metric.value)} ${escape(metric.unit ?? '')}</div><div><span class="source-badge ${escape(metric.sourceStatus)}">${metric.sourceStatus === 'unavailable' ? 'Ma’lumot ulanmagan' : escape(metric.sourceStatus)}</span></div></article>`).join('')}</div>`;
  }
  async function openInstitution(id) {
    const response = await fetch(`/api/institutions/${encodeURIComponent(id)}/summary`);
    if (response.status === 401) return location.href = '/login';
    if (!response.ok) return;
    current = await response.json();
    const x = current.institution;
    header.innerHTML = `<h1>${escape(x.officialName)}</h1><p>${escape(x.type)} · ${escape(x.districtKey)} · ${escape(x.leaderName ?? 'Rahbar ma’lumoti ulanmagan')}</p>`;
    drawer.hidden = false;
    renderModule(current.modules?.[0]?.key ?? 'passport');
  }
  tabs.addEventListener('click', e => { const key = e.target.closest('button')?.dataset.module; if (key) renderModule(key); });
  document.getElementById('close360').addEventListener('click', () => drawer.hidden = true);
  window.SSB360 = { openInstitution };
})();
