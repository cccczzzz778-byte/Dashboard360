export function executiveTodayHtml() {
  return `
      <section id="executiveTodaySection" class="executive-today" aria-labelledby="executiveTodayTitle">
        <div class="executive-today-head">
          <div>
            <span class="eyebrow">RAHBAR UCHUN TEZKOR NAZORAT</span>
            <h2 id="executiveTodayTitle">Bugun</h2>
            <p>Risk, kritik signal va ma’lumot manbalari holati — faqat mavjud real ma’lumotlar asosida.</p>
          </div>
          <div class="executive-today-meta">
            <span id="executiveTodayState" class="executive-state" role="status" aria-live="polite">Yuklanmoqda…</span>
            <button id="executiveTodayRefresh" class="btn secondary" type="button">Yangilash</button>
          </div>
        </div>

        <div class="executive-kpi-grid" aria-label="Bugungi asosiy holat">
          <article class="executive-kpi-card"><span>Ko‘rinadigan muassasalar</span><strong id="todayInstitutions">N/A</strong><small>foydalanuvchi vakolati doirasida</small></article>
          <article class="executive-kpi-card danger"><span>Kritik alertlar</span><strong id="todayCriticalAlerts">N/A</strong><small>faol kritik signal</small></article>
          <article class="executive-kpi-card warning"><span>E’tibor talab qiladi</span><strong id="todayAttentionInstitutions">N/A</strong><small>risk amber / red</small></article>
          <article class="executive-kpi-card info"><span>Risk data qamrovi</span><strong id="todayRiskCoverage">N/A</strong><small>muassasalar bo‘yicha</small></article>
        </div>

        <div class="executive-today-grid">
          <article class="card executive-panel executive-attention-panel">
            <div class="executive-panel-head"><div><span class="eyebrow">USTUVORLIK</span><h3>Top e’tibor talab qiladigan muassasalar</h3></div><span class="executive-badge">TOP 10</span></div>
            <div id="todayAttentionList" class="executive-list" aria-live="polite"><p class="executive-empty">Yuklanmoqda…</p></div>
          </article>

          <article class="card executive-panel">
            <div class="executive-panel-head"><div><span class="eyebrow">RISK TAQSIMOTI</span><h3>Viloyat holati</h3></div></div>
            <div id="todayRiskDistribution" class="risk-distribution" aria-live="polite">
              <div><span class="risk-dot red"></span><b>Qizil</b><strong id="todayRiskRed">N/A</strong></div>
              <div><span class="risk-dot amber"></span><b>Sariq</b><strong id="todayRiskAmber">N/A</strong></div>
              <div><span class="risk-dot green"></span><b>Yashil</b><strong id="todayRiskGreen">N/A</strong></div>
              <div><span class="risk-dot neutral"></span><b>N/A</b><strong id="todayRiskUnavailable">N/A</strong></div>
            </div>
            <div class="executive-coverage"><span>Metric qamrovi</span><strong id="todayMetricCoverage">N/A</strong></div>
          </article>

          <article class="card executive-panel">
            <div class="executive-panel-head"><div><span class="eyebrow">KRITIK SIGNAL</span><h3>Faol alertlar</h3></div></div>
            <div id="todayCriticalList" class="executive-list compact" aria-live="polite"><p class="executive-empty">Yuklanmoqda…</p></div>
          </article>

          <article class="card executive-panel">
            <div class="executive-panel-head"><div><span class="eyebrow">DATA HEALTH</span><h3>E’tibor talab qiladigan manbalar</h3></div></div>
            <div id="todaySourceList" class="executive-list compact" aria-live="polite"><p class="executive-empty">Yuklanmoqda…</p></div>
          </article>
        </div>
      </section>`;
}
