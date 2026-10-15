import { moduleDefinitions, type InstitutionModulePayload } from '../domain/modules.js';

export function institution360Html() {
  return `
    <aside id="institution360" class="drawer" hidden>
      <button id="close360" class="drawer-close" aria-label="Yopish">×</button>
      <div id="institutionHeader"></div>
      <nav id="moduleTabs" class="module-tabs">
        ${moduleDefinitions.map(m => `<button data-module="${m.key}">${m.label}</button>`).join('')}
      </nav>
      <section id="moduleContent"></section>
    </aside>`;
}
