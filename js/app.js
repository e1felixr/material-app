// js/app.js
// Bootstrapping, Ansichts-Routing, Einstellungen, Erststart.
// Block A: Ansichts-Umschaltung (Katalog/Korb/Einstellungen) + Versionsanzeige
// + Service-Worker-Registrierung. Restliche Funktionalitaet (Katalog rendern,
// Korb rendern, Erststart-Dialog, Versand) folgt in Block B/C/D.

let APP_VERSION = 'v0.1.0'; // Fallback, wird per fetch aus version.json ueberschrieben

function showToast(msg, duration = 2000) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

const App = (() => {
  const VIEWS = ['katalog', 'korb', 'einstellungen'];

  function showView(view) {
    if (!VIEWS.includes(view)) view = 'katalog';

    VIEWS.forEach(v => {
      const el = document.getElementById('view-' + v);
      if (el) el.classList.toggle('active', v === view);
    });

    document.querySelectorAll('.tab-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    try { localStorage.setItem('e1mat_last_view', view); } catch {}

    // Hook fuer Block B/C: Katalog- bzw. Korb-Ansicht bei Wechsel neu rendern.
    if (view === 'katalog' && typeof Catalog !== 'undefined' && typeof Catalog.renderInto === 'function') {
      Catalog.renderInto(document.getElementById('view-katalog'));
    }
    if (view === 'korb' && typeof Basket !== 'undefined' && typeof Basket.renderInto === 'function') {
      Basket.renderInto(document.getElementById('view-korb'));
    }
  }

  async function loadVersion() {
    try {
      const resp = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.version) APP_VERSION = data.version;
      }
    } catch (e) {
      console.warn('version.json konnte nicht geladen werden:', e);
    }
    const versionEl = document.getElementById('header-version');
    if (versionEl) versionEl.textContent = APP_VERSION;
  }

  // ── Service Worker Registrierung ──
  let swRegistration = null;

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      swRegistration = await navigator.serviceWorker.register('sw.js');

      swRegistration.addEventListener('updatefound', () => {
        const newWorker = swRegistration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Neue Version verfuegbar — automatisch aktivieren.
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    } catch (e) {
      console.error('SW-Registration fehlgeschlagen:', e);
    }
  }

  function init() {
    loadVersion();
    registerServiceWorker();

    let startView = 'katalog';
    try {
      const last = localStorage.getItem('e1mat_last_view');
      if (VIEWS.includes(last)) startView = last;
    } catch {}
    showView(startView);
  }

  document.addEventListener('DOMContentLoaded', init);

  return { showView, loadVersion };
})();
