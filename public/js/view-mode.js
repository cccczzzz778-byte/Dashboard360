(() => {
  const STORAGE_KEY = 'ssb360:view-mode';
  const allowed = new Set(['dark','light','tv']);
  const root = document.body;
  const control = document.getElementById('viewModeControl');
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  function readSavedMode() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return allowed.has(saved) ? saved : 'dark';
    } catch {
      return 'dark';
    }
  }

  function updateButtons(mode) {
    control?.querySelectorAll('[data-view-mode]').forEach(button => {
      const active = button.dataset.viewMode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function applyMode(mode, persist = true) {
    const next = allowed.has(mode) ? mode : 'dark';
    root.dataset.viewMode = next;
    root.classList.toggle('executive-tv-mode', next === 'tv');
    document.documentElement.style.colorScheme = next === 'light' ? 'light' : 'dark';
    if (themeMeta) themeMeta.setAttribute('content', next === 'light' ? '#f3f6f9' : '#07131f');
    updateButtons(next);
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    }
    window.dispatchEvent(new CustomEvent('ssb360:view-mode', { detail: { mode: next } }));
    setTimeout(() => window.dispatchEvent(new Event('resize')), 80);
  }

  control?.addEventListener('click', event => {
    const button = event.target.closest('[data-view-mode]');
    if (!button) return;
    applyMode(button.dataset.viewMode);
  });

  applyMode(readSavedMode(), false);
  window.SSB360ViewMode = { applyMode, getMode: () => root.dataset.viewMode || 'dark' };
})();
