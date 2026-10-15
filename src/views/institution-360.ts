export function institution360Html() {
  return `
  <div id="drawerBackdrop" class="drawer-backdrop" hidden></div>
  <aside id="institutionDrawer" class="institution-drawer" aria-label="Muassasa 360" hidden>
    <div class="drawer-topbar">
      <div id="institutionHeader" class="institution-header"></div>
      <div class="drawer-actions">
        <button id="openOnMap" class="btn secondary" type="button">Xaritada ko‘rsatish</button>
        <button id="close360" class="icon-btn" type="button" aria-label="Yopish">×</button>
      </div>
    </div>

    <div class="drawer-commandbar">
      <div class="drawer-breadcrumb"><strong>Buxoro SSB</strong><span>›</span><span>Muassasa 360°</span><span>›</span><span id="institutionBreadcrumb">Nazorat</span></div>
      <div id="institutionDataHealth" class="drawer-data-health"><i class="health-dot"></i><span>Ma’lumot holati tekshirilmoqda...</span></div>
    </div>

    <div id="institutionExecutiveStats" class="drawer-kpi-strip" aria-label="Muassasa asosiy holati"></div>

    <div class="drawer-main">
      <nav id="moduleTabs" class="module-navigation" aria-label="Nazorat yo‘nalishlari"></nav>
      <section class="module-workspace">
        <div id="moduleSummary" class="module-summary"></div>
        <div id="moduleContent" class="module-content"></div>
      </section>
    </div>
  </aside>

  <dialog id="metricEditor" class="metric-dialog">
    <form id="metricForm" method="dialog">
      <div class="dialog-head"><div><span class="eyebrow">Qo‘lda kiritish</span><h3 id="metricEditorTitle">Ko‘rsatkich</h3></div><button id="metricEditorClose" class="icon-btn" type="button">×</button></div>
      <input type="hidden" name="institutionId"><input type="hidden" name="metricKey">
      <label>Qiymat<input name="value" autocomplete="off" placeholder="Qiymatni kiriting"></label>
      <label>O‘lchov birligi<input name="unit" autocomplete="off" placeholder="%, ta, nafar, so‘m..."></label>
      <p class="dialog-note">Qo‘lda kiritilgan qiymat manbasi alohida belgilanadi va jonli integratsiya ma’lumoti sifatida ko‘rsatilmaydi.</p>
      <div class="dialog-actions"><button id="metricCancel" class="btn secondary" type="button">Bekor qilish</button><button class="btn primary" type="submit">Saqlash</button></div>
    </form>
  </dialog>`;
}
