import { institution360Html } from './institution-360.js';
import { districtKeys } from '../map/district-map.js';

export function dashboardHtml() {
  return `<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Buxoro SSB 360</title><link rel="stylesheet" href="/css/app.css"><link rel="stylesheet" href="/css/map.css"></head>
  <body><header><div><h1>Buxoro SSB · 360° nazorat markazi</h1><p>Xarita → hudud → muassasa → 360°</p></div><div class="header-tools"><span id="clock"></span><a href="/logout">Chiqish</a></div></header>
  <main><section class="map-panel"><div class="panel-head"><div><h2>Buxoro viloyati</h2><p>Hududni tanlang</p></div><input id="institutionSearch" placeholder="Muassasa qidirish..." aria-label="Muassasa qidirish"></div>
  <div id="map" role="listbox" aria-label="Buxoro tuman va shaharlari"></div></section>
  <aside class="institutions-panel"><div class="panel-head"><div><h2 id="districtTitle">Muassasalar</h2><p id="institutionCount">Hudud tanlanmagan</p></div></div><div id="institutionList" class="institution-list"><div class="empty">Xaritadan hududni tanlang</div></div></aside></main>
  ${institution360Html()}
  <script>window.BUXORO_DISTRICTS=${JSON.stringify(districtKeys)}</script><script src="/js/map.js" defer></script><script src="/js/institution-360.js" defer></script></body></html>`;
}
