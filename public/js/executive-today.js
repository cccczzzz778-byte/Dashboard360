(() => {
  const $ = id => document.getElementById(id);
  const setText = (id, value) => { const node = $(id); if (node) node.textContent = value == null ? 'N/A' : String(value); };
  const state = { loading: false };

  function setState(message, kind = 'neutral') {
    const node = $('executiveTodayState');
    if (!node) return;
    node.textContent = message;
    node.dataset.state = kind;
  }

  function emptyMessage(container, message = 'Ma’lumot yo‘q') {
    container.replaceChildren();
    const p = document.createElement('p');
    p.className = 'executive-empty';
    p.textContent = message;
    container.appendChild(p);
  }

  function badge(text, className) {
    const span = document.createElement('span');
    span.className = `executive-row-badge ${className}`;
    span.textContent = text;
    return span;
  }

  function renderAttention(items) {
    const container = $('todayAttentionList');
    if (!container) return;
    container.replaceChildren();
    if (!Array.isArray(items) || !items.length) return emptyMessage(container, 'Ma’lumot yo‘q — e’tibor talab qiladigan risk aniqlanmagan');
    items.forEach(item => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'executive-row attention-row';
      row.dataset.institutionId = item.institutionId || '';

      const main = document.createElement('span');
      main.className = 'executive-row-main';
      const title = document.createElement('strong');
      title.textContent = item.officialName || item.institutionId || 'N/A';
      const meta = document.createElement('small');
      meta.textContent = `${item.districtKey || 'N/A'} · qamrov ${item.coveragePct == null ? 'N/A' : `${item.coveragePct}%`}`;
      main.append(title, meta);

      const side = document.createElement('span');
      side.className = 'executive-row-side';
      side.append(badge(item.severity === 'red' ? 'QIZIL' : 'SARIQ', item.severity || 'neutral'));
      const score = document.createElement('strong');
      score.textContent = item.score == null ? 'N/A' : String(item.score);
      side.appendChild(score);
      row.append(main, side);
      row.addEventListener('click', () => {
        if (item.institutionId && window.SSB360?.openInstitution) window.SSB360.openInstitution(item.institutionId);
      });
      container.appendChild(row);
    });
  }

  function renderAlerts(items) {
    const container = $('todayCriticalList');
    if (!container) return;
    container.replaceChildren();
    if (!Array.isArray(items) || !items.length) return emptyMessage(container, 'Ma’lumot yo‘q — faol kritik alert mavjud emas');
    items.slice(0, 10).forEach(item => {
      const row = document.createElement('div');
      row.className = 'executive-row';
      const main = document.createElement('span');
      main.className = 'executive-row-main';
      const title = document.createElement('strong');
      title.textContent = item.title || item.alertType || 'Kritik alert';
      const meta = document.createElement('small');
      meta.textContent = item.reason || 'Tafsilot mavjud emas';
      main.append(title, meta);
      row.append(main, badge('KRITIK', 'red'));
      container.appendChild(row);
    });
  }

  function renderSources(items) {
    const container = $('todaySourceList');
    if (!container) return;
    container.replaceChildren();
    if (!Array.isArray(items) || !items.length) return emptyMessage(container, 'Ma’lumot yo‘q — stale/offline manba aniqlanmagan');
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'executive-row';
      const main = document.createElement('span');
      main.className = 'executive-row-main';
      const title = document.createElement('strong');
      title.textContent = item.label || item.key || 'N/A';
      const meta = document.createElement('small');
      meta.textContent = item.lastSuccessAt ? `Oxirgi muvaffaqiyat: ${new Date(item.lastSuccessAt).toLocaleString('uz-UZ')}` : 'Oxirgi muvaffaqiyat N/A';
      main.append(title, meta);
      row.append(main, badge(String(item.status || 'N/A').toUpperCase(), item.status === 'offline' ? 'red' : 'amber'));
      container.appendChild(row);
    });
  }

  function render(data) {
    const summary = data?.summary || {};
    const coverage = data?.dataCoverage || {};
    const distribution = data?.riskDistribution || {};

    setText('todayInstitutions', summary.institutions);
    setText('todayCriticalAlerts', summary.criticalAlerts);
    setText('todayAttentionInstitutions', summary.attentionInstitutions);
    setText('todayRiskCoverage', coverage.riskCoveragePct == null ? null : `${coverage.riskCoveragePct}%`);
    setText('todayMetricCoverage', coverage.averageMetricCoveragePct == null ? null : `${coverage.averageMetricCoveragePct}%`);
    setText('todayRiskRed', distribution.red);
    setText('todayRiskAmber', distribution.amber);
    setText('todayRiskGreen', distribution.green);
    setText('todayRiskUnavailable', distribution.unavailable);

    renderAttention(data?.topAttention);
    renderAlerts(data?.criticalAlerts);
    renderSources(data?.attentionSources);

    const existing = $('summaryAlerts');
    if (existing) existing.textContent = summary.criticalAlerts == null ? 'N/A' : String(summary.criticalAlerts);

    const generatedAt = data?.generatedAt ? new Date(data.generatedAt) : null;
    const label = generatedAt && Number.isFinite(generatedAt.getTime())
      ? `Yangilandi · ${generatedAt.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}`
      : 'Yangilandi';
    setState(label, 'ok');
  }

  function renderError() {
    ['todayInstitutions','todayCriticalAlerts','todayAttentionInstitutions','todayRiskCoverage','todayMetricCoverage','todayRiskRed','todayRiskAmber','todayRiskGreen','todayRiskUnavailable'].forEach(id => setText(id, null));
    const attention = $('todayAttentionList'); if (attention) emptyMessage(attention, 'Xatolik — ma’lumotni yuklab bo‘lmadi');
    const alerts = $('todayCriticalList'); if (alerts) emptyMessage(alerts, 'Xatolik — alertlar yuklanmadi');
    const sources = $('todaySourceList'); if (sources) emptyMessage(sources, 'Xatolik — manbalar holati yuklanmadi');
    setState('Xatolik · qayta urinib ko‘ring', 'error');
  }

  async function load() {
    if (state.loading) return;
    state.loading = true;
    setState('Yuklanmoqda…', 'loading');
    const button = $('executiveTodayRefresh');
    if (button) button.disabled = true;
    try {
      const response = await fetch('/api/v1/executive/today', { headers: { accept: 'application/json' } });
      if (response.status === 401) { location.href = '/login'; return; }
      if (!response.ok) throw new Error(`executive_today_${response.status}`);
      render(await response.json());
    } catch (error) {
      console.error('executive_today_error', error);
      renderError();
    } finally {
      state.loading = false;
      if (button) button.disabled = false;
    }
  }

  $('executiveTodayRefresh')?.addEventListener('click', load);
  document.addEventListener('DOMContentLoaded', load, { once: true });
  if (document.readyState !== 'loading') load();
})();
