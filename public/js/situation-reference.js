const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

const state = { bootstrap: null };

function riskCounts(context) {
  const rows = Array.isArray(context?.institutions) ? context.institutions : [];
  const counts = { red: 0, amber: 0, green: 0, neutral: 0 };
  for (const row of rows) {
    const severity = row?.risk?.severity;
    if (severity === 'red' || severity === 'amber' || severity === 'green') counts[severity] += 1;
    else counts.neutral += 1;
  }
  return { counts, total: rows.length };
}

function donutBackground(counts, total) {
  if (!total) return 'conic-gradient(#5d9ab5 0deg 360deg)';
  const red = (counts.red / total) * 360;
  const amber = red + (counts.amber / total) * 360;
  const green = amber + (counts.green / total) * 360;
  return `conic-gradient(#ff5d72 0deg ${red}deg, #ffc857 ${red}deg ${amber}deg, #2ce7b0 ${amber}deg ${green}deg, #5d9ab5 ${green}deg 360deg)`;
}

function renderRiskDistribution(context) {
  const target = $('situationRiskDistribution');
  if (!target) return;
  const { counts, total } = riskCounts(context);
  const available = counts.red + counts.amber + counts.green;
  const center = available ? `${Math.round((available / Math.max(total, 1)) * 100)}%` : 'N/A';
  const row = (tone, label, value) => `<div class="sc-risk-legend-row"><span class="sc-risk ${tone}"></span><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`;
  target.innerHTML = `<h2>Risk taqsimoti</h2><div class="sc-risk-distribution">
    <div class="sc-risk-donut" style="background:${donutBackground(counts, total)}"><div class="sc-risk-donut-center">${escapeHtml(center)}</div></div>
    <div class="sc-risk-legend">
      ${row('red', 'Yuqori', counts.red)}
      ${row('amber', 'O‘rta', counts.amber)}
      ${row('green', 'Past', counts.green)}
      ${row('neutral', 'N/A', counts.neutral)}
    </div>
  </div>`;
}

function renderToday(context) {
  const target = $('situationToday');
  if (!target) return;
  const summary = context?.summary ?? {};
  const value = summary.todayVisits ?? summary.todayAdmissions ?? null;
  const display = value == null ? 'N/A' : String(value);
  const caption = value == null ? 'Manba ulanmagan' : 'Bugungi qabul';
  target.innerHTML = `<h2>Bugungi qabul</h2><div class="sc-today-wrap"><div><div class="sc-today-number">${escapeHtml(display)}</div><div class="sc-today-caption">${escapeHtml(caption)}</div></div></div>`;
}

function renderReference(context) {
  renderRiskDistribution(context);
  renderToday(context);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (response.status === 401) {
    location.href = '/login';
    return null;
  }
  if (!response.ok) return null;
  return response.json();
}

async function focusDistrictReference(key) {
  if (!key) {
    if (state.bootstrap) renderReference(state.bootstrap);
    return;
  }
  const context = await fetchJson(`/api/v1/situation-center/districts/${encodeURIComponent(key)}`);
  if (context) renderReference(context);
}

function focusInstitutionReference(id) {
  const item = state.bootstrap?.institutions?.find(row => row.id === id);
  if (item) renderRiskDistribution({ institutions: [item] });
}

async function boot() {
  const bootstrap = await fetchJson('/api/v1/situation-center/bootstrap');
  if (!bootstrap) return;
  state.bootstrap = bootstrap;
  renderReference(bootstrap);

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const districtButton = target.closest('[data-focus-district]');
    if (districtButton) {
      void focusDistrictReference(districtButton.dataset.focusDistrict ?? '');
      return;
    }
    const institutionId = target.closest('[data-focus-institution]')?.dataset.focusInstitution;
    if (institutionId) focusInstitutionReference(institutionId);
  });
}

window.SSB360SituationReference = { renderRiskDistribution, renderToday };
void boot();
