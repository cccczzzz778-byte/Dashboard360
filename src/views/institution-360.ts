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
    <div class="drawer-layout">
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
