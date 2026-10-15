import { institution360Html } from './institution-360.js';
import { executiveTodayHtml } from './executive-today.js';

export function dashboardHtml() {
  return `<!doctype html>
<html lang="uz">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#07131f">
  <title>Buxoro SSB 360 · Yagona nazorat markazi</title>
  <link rel="stylesheet" href="/vendor/leaflet/leaflet.css">
  <link rel="stylesheet" href="/css/app.css?v=20261015-2">
  <link rel="stylesheet" href="/css/map.css?v=20261015-2">
  <link rel="stylesheet" href="/css/institution-pro.css?v=20261015-2">
  <link rel="stylesheet" href="/css/view-mode.css?v=20261015-3">
  <link rel="stylesheet" href="/css/light-mode-hardening.css?v=20261015-4">
  <link rel="stylesheet" href="/css/executive-today.css?v=20261015-1">
</head>
<body data-view-mode="dark">
<div class="app-shell">
  <aside class="sidebar">
    <div class="brand"><div class="brand-mark">+</div><div><strong>BUXORO SSB</strong><span>360° nazorat markazi</span></div></div>
    <nav class="sidebar-nav" aria-label="Asosiy menyu">
      <button class="nav-item active" data-target="executiveTodaySection"><span>◎</span>Bugun</button>
      <button class="nav-item" data-target="mapSection"><span>⌖</span>Xarita nazorati</button>
      <button class="nav-item" data-target="institutionsPanel"><span>▦</span>Muassasalar</button>
      <button class="nav-item" data-target="controlSection"><span>◈</span>Yo‘nalishlar</button>
      <button class="nav-item" data-target="integrationsSection"><span>⇄</span>Integratsiyalar</button>
      <button class="nav-item" data-target="sourcesSection"><span>●</span>Manbalar holati</button>
    </nav>
    <div class="sidebar-info"><span class="live-dot"></span><div><strong>Production</strong><small id="systemStatus">Tizim tekshirilmoqda...</small></div></div>
  </aside>

  <div class="workspace">
    <header class="topbar">
      <div><span class="eyebrow">Buxoro viloyati sog‘liqni saqlash boshqarmasi</span><h1>Rahbar nazorati</h1><p>Xarita → hudud → muassasa → 360° nazorat</p></div>
      <div class="topbar-actions">
        <div id="viewModeControl" class="view-mode-control" role="group" aria-label="Ko‘rinish rejimi">
          <button class="view-mode-btn active" type="button" data-view-mode="dark" aria-pressed="true" title="Tungi rejim"><span class="mode-icon">☾</span><span class="mode-label">Tungi</span></button>
          <button class="view-mode-btn" type="button" data-view-mode="light" aria-pressed="false" title="Kunduzgi rejim"><span class="mode-icon">☀</span><span class="mode-label">Kunduzgi</span></button>
          <button class="view-mode-btn" type="button" data-view-mode="tv" aria-pressed="false" title="Rahbar / TV rejimi"><span class="mode-icon">▣</span><span class="mode-label">Rahbar / TV</span></button>
        </div>
        <div class="timebox"><span>Oxirgi yangilanish</span><strong id="clock">—</strong></div>
        <a class="btn secondary" href="/logout">Chiqish</a>
      </div>
    </header>

    <main class="page-content">
      ${executiveTodayHtml()}

      <section class="summary-grid" aria-label="Umumiy ko‘rsatkichlar">
        <article class="summary-card"><div class="summary-icon teal">▦</div><div><span>Muassasalar</span><strong id="summaryInstitutions">—</strong><small>nazorat katalogida</small></div></article>
        <article class="summary-card"><div class="summary-icon blue">⌖</div><div><span>Hududlar</span><strong id="summaryDistricts">—</strong><small>tuman va shahar</small></div></article>
        <article class="summary-card"><div class="summary-icon amber">⇄</div><div><span>Manbalar</span><strong id="summarySources">—</strong><small>sozlangan / jami</small></div></article>
        <article class="summary-card"><div class="summary-icon red">!</div><div><span>Kritik signal</span><strong id="summaryAlerts">N/A</strong><small>real manba ulanmaguncha</small></div></article>
      </section>

      <section id="mapSection" class="dashboard-grid">
        <article class="card map-card">
          <div class="card-head">
            <div><span class="eyebrow">Geografik monitoring</span><h2>Buxoro viloyati xaritasi</h2><p>Hududni yoki muassasani tanlang. Marker koordinatalari aniq GPS bo‘lmasa hudud markazini bildiradi.</p></div>
            <div class="map-tools"><button id="resetMap" class="btn secondary" type="button">Viloyatga qaytish</button></div>
          </div>
          <div id="buxoroMap" class="leaflet-host" aria-label="Buxoro viloyati tibbiyot muassasalari xaritasi"></div>
          <div id="districtFallback" class="district-fallback" role="listbox" aria-label="Buxoro tuman va shaharlari"></div>
          <div class="map-legend"><span><i class="legend-dot district"></i>Hudud</span><span><i class="legend-dot institution"></i>Muassasa</span><span class="map-note">OpenStreetMap fon xaritasi</span></div>
        </article>

        <aside id="institutionsPanel" class="card institutions-card">
          <div class="card-head compact"><div><span class="eyebrow">Muassasalar</span><h2 id="districtTitle">Barcha muassasalar</h2><p id="institutionCount">Yuklanmoqda...</p></div></div>
          <div class="filters"><input id="institutionSearch" type="search" placeholder="Muassasa qidirish..." aria-label="Muassasa qidirish"><select id="districtSelect" aria-label="Hudud"><option value="">Barcha hududlar</option></select></div>
          <div id="institutionList" class="institution-list"><div class="skeleton-list"><i></i><i></i><i></i></div></div>
        </aside>
      </section>

      <section id="controlSection" class="section-block">
        <div class="section-title"><div><span class="eyebrow">Muassasa 360°</span><h2>Nazorat arxitekturasi</h2><p>Har bir muassasa quyidagi bloklar bo‘yicha kuzatiladi. Ulanmagan ma’lumotlar N/A bo‘lib qoladi.</p></div><span id="moduleCountBadge" class="pill">— modul</span></div>
        <div id="controlGroups" class="control-groups"></div>
      </section>

      <section class="lower-grid">
        <article id="integrationsSection" class="card section-card">
          <div class="card-head"><div><span class="eyebrow">Tashqi tizimlar</span><h2>Integratsiyalar</h2><p>DMED va registrlarga xavfsiz o‘tish. Login ma’lumotlari ushbu saytda saqlanmaydi.</p></div></div>
          <div id="integrationList" class="integration-list"></div>
        </article>
        <article id="sourcesSection" class="card section-card">
          <div class="card-head"><div><span class="eyebrow">Data observability</span><h2>Ma’lumot manbalari</h2><p>Qaysi manba ulanganini va qaysi biri kutayotganini ko‘rsatadi.</p></div></div>
          <div id="sourceList" class="source-list"></div>
        </article>
      </section>

      <section class="notice-bar"><strong>Ma’lumot siyosati:</strong><span>Soxta statistika yaratilmaydi. Real manba yo‘q bo‘lsa qiymat N/A. Qo‘lda kiritilgan raqam alohida “Manual” belgisi bilan saqlanadi.</span></section>
    </main>
  </div>
</div>
${institution360Html()}
<script src="/vendor/leaflet/leaflet.js"></script>
<script src="/js/view-mode.js?v=20261015-3" defer></script>
<script src="/js/map.js?v=20261015-2" defer></script>
<script src="/js/executive-today.js?v=20261015-1" defer></script>
<script src="/js/institution-360.js?v=20261015-2" defer></script>
</body>
</html>`;
}
