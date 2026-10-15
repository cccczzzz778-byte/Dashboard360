(() => {
  const labels = {
    'buxoro-shahar': 'Buxoro shahri', 'buxoro-tumani': 'Buxoro tumani', gijduvon: "G‘ijduvon tumani", jondor: 'Jondor tumani',
    'kogon-shahar': 'Kogon shahri', 'kogon-tumani': 'Kogon tumani', olot: 'Olot tumani', peshku: 'Peshku tumani', qorakol: 'Qorako‘l tumani',
    qorovulbozor: 'Qorovulbozor tumani', romitan: 'Romitan tumani', shofirkon: 'Shofirkon tumani', vobkent: 'Vobkent tumani'
  };
  const map = document.getElementById('map');
  const list = document.getElementById('institutionList');
  const title = document.getElementById('districtTitle');
  const count = document.getElementById('institutionCount');
  const search = document.getElementById('institutionSearch');
  let institutions = [];
  const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function renderInstitutions() {
    const q = search.value.toLowerCase();
    const visible = institutions.filter(x => x.officialName.toLowerCase().includes(q));
    count.textContent = `${visible.length} ta muassasa`;
    list.innerHTML = visible.length ? visible.map(x => `<button class="institution" data-id="${escape(x.id)}"><strong>${escape(x.officialName)}</strong><span>${escape(x.type)} · ${escape(x.leaderName ?? 'Rahbar ulanmagan')}</span></button>`).join('') : '<div class="empty">Ushbu hudud bo‘yicha muassasa ma’lumoti ulanmagan</div>';
  }
  async function selectDistrict(key) {
    document.querySelectorAll('.district-shape').forEach(x => x.classList.toggle('selected', x.dataset.key === key));
    title.textContent = labels[key] ?? key;
    count.textContent = 'Yuklanmoqda...'; list.innerHTML = '';
    const response = await fetch(`/api/institutions?district=${encodeURIComponent(key)}`);
    if (response.status === 401) return location.href = '/login';
    institutions = response.ok ? await response.json() : [];
    renderInstitutions();
    document.dispatchEvent(new CustomEvent('district:selected', { detail: { key, institutions } }));
  }
  for (const key of window.BUXORO_DISTRICTS ?? []) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'district-shape'; button.dataset.key = key;
    button.setAttribute('role', 'option'); button.innerHTML = `<span>${escape(labels[key] ?? key)}</span>`;
    button.addEventListener('click', () => selectDistrict(key)); map.appendChild(button);
  }
  search.addEventListener('input', renderInstitutions);
  list.addEventListener('click', e => { const button = e.target.closest('[data-id]'); if (button) window.SSB360?.openInstitution(button.dataset.id); });
  setInterval(() => { const c = document.getElementById('clock'); if (c) c.textContent = new Date().toLocaleString('uz-UZ'); }, 1000);
})();
