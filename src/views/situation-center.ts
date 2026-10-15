export function situationCenterHtml() {
  return `<!doctype html>
<html lang="uz">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#031525">
  <title>Buxoro SSB 360 · 3D Situatsion markaz</title>
  <link rel="stylesheet" href="/vendor/maplibre/maplibre-gl.css">
  <link rel="stylesheet" href="/css/situation-center.css?v=20261015-1">
</head>
<body class="situation-center-page">
  <main class="situation-shell">
    <header class="situation-topbar">
      <div><span>BUXORO VILOYATI SOG‘LIQNI SAQLASH</span><h1>3D SITUATSION MARKAZ</h1></div>
      <div class="situation-actions">
        <span id="situationStatus" role="status" aria-live="polite">Ma’lumot yuklanmoqda…</span>
        <button id="situationFullscreen" type="button">To‘liq ekran</button>
        <button id="situationPresentation" type="button">Taqdimot</button>
        <a href="/">Oddiy dashboard</a>
      </div>
    </header>

    <section class="situation-layout">
      <aside class="situation-column situation-left">
        <section id="situationSummary" class="situation-panel" aria-label="Viloyat resurslari"><h2>Viloyat resurslari</h2><div class="situation-loading">N/A</div></section>
        <section id="situationRanking" class="situation-panel" aria-label="Muassasalar reytingi"><h2>TOP muassasalar</h2><div class="situation-loading">Ma’lumot kutilmoqda</div></section>
      </aside>

      <section class="situation-map-stage" aria-label="Buxoro 3D xaritasi">
        <div id="situationMap" class="situation-map"></div>
        <div id="situationFallback" class="situation-fallback" hidden>
          <h2>Xarita rejimi mavjud emas</h2>
          <p>Rahbar panellari ishlashda davom etadi. Muassasani ro‘yxatdan tanlang.</p>
          <div id="situationFallbackList"></div>
        </div>
        <div id="situationInstitutionCard" class="situation-institution-card" hidden></div>
      </section>

      <aside class="situation-column situation-right">
        <section id="situationAlerts" class="situation-panel" aria-label="Kritik signallar"><h2>Kritik signallar</h2><div class="situation-loading">N/A</div></section>
        <section id="situationActivity" class="situation-panel" aria-label="Joriy faoliyat"><h2>Joriy faoliyat</h2><div class="situation-loading">N/A</div></section>
        <section id="situationTrend" class="situation-panel" aria-label="Trend"><h2>Trend</h2><div class="situation-loading">Ma’lumot yetarli emas</div></section>
      </aside>
    </section>
  </main>
  <script type="module" src="/js/situation-center.js?v=20261015-1"></script>
</body>
</html>`;
}
