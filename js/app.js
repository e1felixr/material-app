// js/app.js
// Bootstrapping, Ansichts-Routing, Einstellungen, Erststart.
// Block A: Ansichts-Umschaltung (Katalog/Korb/Einstellungen) + Versionsanzeige
// + Service-Worker-Registrierung. Restliche Funktionalitaet (Katalog rendern,
// Korb rendern, Erststart-Dialog, Versand) folgt in Block B/C/D.

let APP_VERSION = 'v0.3.0'; // Fallback, wird per fetch aus version.json ueberschrieben

function showToast(msg, duration = 2000) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

function isValidEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(str || '').trim());
}

// ── Settings (Block D1): Monteur-Name + Empfaengerliste ──────────────────
// localStorage-Key e1mat_settings: {monteur_name, empfaenger: [{name, mail}]}

const Settings = (() => {
  const KEY = 'e1mat_settings';

  function _load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          monteur_name: parsed.monteur_name || '',
          empfaenger: Array.isArray(parsed.empfaenger) ? parsed.empfaenger : [],
        };
      }
    } catch (e) {
      console.warn('e1mat_settings konnte nicht gelesen werden:', e);
    }
    return { monteur_name: '', empfaenger: [] };
  }

  function _save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function getMonteur() { return _load().monteur_name; }

  function setMonteur(name) {
    const data = _load();
    data.monteur_name = String(name || '').trim();
    _save(data);
  }

  function getEmpfaenger() { return _load().empfaenger; }

  function setEmpfaenger(list) {
    const data = _load();
    data.empfaenger = Array.isArray(list) ? list : [];
    _save(data);
  }

  return { getMonteur, setMonteur, getEmpfaenger, setEmpfaenger };
})();

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
    if (view === 'einstellungen') {
      renderEinstellungen();
    }
  }

  // ── Block D1: Einstellungen-Ansicht (Monteur-Name + Empfaengerliste) ────

  function escapeHtmlLocal(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderEmpfaengerList() {
    const listEl = document.getElementById('empfaenger-list');
    if (!listEl) return;
    const empfaenger = Settings.getEmpfaenger();
    if (empfaenger.length === 0) {
      listEl.innerHTML = '<p class="hint">Noch keine Empfänger hinterlegt.</p>';
      return;
    }
    listEl.innerHTML = empfaenger.map((e, i) => `
      <div class="card" style="cursor:default; display:flex; align-items:center; gap:8px;" data-empf-idx="${i}">
        <div style="flex:1; min-width:0;">
          <div class="card-title">${escapeHtmlLocal(e.name)}</div>
          <div class="card-sub">${escapeHtmlLocal(e.mail)}</div>
        </div>
        <div class="card-actions">
          <button class="btn-icon btn-icon-danger btn-empf-remove" data-empf-idx="${i}" type="button" title="Entfernen">&#128465;</button>
        </div>
      </div>`).join('');

    listEl.querySelectorAll('.btn-empf-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.empfIdx);
        const list = Settings.getEmpfaenger();
        list.splice(idx, 1);
        Settings.setEmpfaenger(list);
        renderEmpfaengerList();
        showToast('Empfänger entfernt.');
      });
    });
  }

  // ── Darstellung: Schriftgroesse ────────────────────────────────────────
  // Skaliert Schrift + Bedienelemente ueber die CSS-Variable --ui-font-size.
  const FONT_KEY = 'e1mat_font_size';
  const FONT_DEFAULT = 15, FONT_MIN = 12, FONT_MAX = 22;

  function _readFontSize() {
    let px = FONT_DEFAULT;
    try {
      const raw = parseInt(localStorage.getItem(FONT_KEY), 10);
      if (!isNaN(raw)) px = Math.min(FONT_MAX, Math.max(FONT_MIN, raw));
    } catch {}
    return px;
  }

  function applyFontSize(px) {
    document.documentElement.style.setProperty('--ui-font-size', px + 'px');
  }

  function loadFontSize() {
    const px = _readFontSize();
    applyFontSize(px);
    return px;
  }

  function syncFontSlider() {
    const slider = document.getElementById('set-fontsize');
    const label = document.getElementById('val-fontsize');
    const px = _readFontSize();
    if (slider) slider.value = px;
    if (label) label.textContent = px + 'px';
  }

  function renderEinstellungen() {
    const nameInput = document.getElementById('input-monteur-name');
    if (nameInput) nameInput.value = Settings.getMonteur();
    renderEmpfaengerList();
    syncFontSlider();
  }

  function wireEinstellungenControls() {
    const saveBtn = document.getElementById('btn-monteur-save');
    if (saveBtn && !saveBtn.dataset.wired) {
      saveBtn.dataset.wired = '1';
      saveBtn.addEventListener('click', () => {
        const val = document.getElementById('input-monteur-name').value.trim();
        if (!val) {
          showToast('Bitte einen Namen eingeben.');
          return;
        }
        Settings.setMonteur(val);
        showToast('Name gespeichert.');
      });
    }

    const addBtn = document.getElementById('btn-empfaenger-add');
    if (addBtn && !addBtn.dataset.wired) {
      addBtn.dataset.wired = '1';
      addBtn.addEventListener('click', () => {
        const nameEl = document.getElementById('input-empfaenger-name');
        const mailEl = document.getElementById('input-empfaenger-mail');
        const name = nameEl.value.trim();
        const mail = mailEl.value.trim();
        if (!name || !mail) {
          showToast('Bitte Name und E-Mail-Adresse angeben.');
          return;
        }
        if (!isValidEmail(mail)) {
          showToast('E-Mail-Adresse ist ungültig.');
          return;
        }
        const list = Settings.getEmpfaenger();
        list.push({ name, mail });
        Settings.setEmpfaenger(list);
        nameEl.value = '';
        mailEl.value = '';
        renderEmpfaengerList();
        showToast('Empfänger hinzugefügt.');
      });
    }

    const fontSlider = document.getElementById('set-fontsize');
    if (fontSlider && !fontSlider.dataset.wired) {
      fontSlider.dataset.wired = '1';
      fontSlider.addEventListener('input', () => {
        const px = fontSlider.value;
        const label = document.getElementById('val-fontsize');
        if (label) label.textContent = px + 'px';
        applyFontSize(px);
        try { localStorage.setItem(FONT_KEY, String(px)); } catch {}
      });
    }
  }

  // ── Block D1: Erststart-Pflichtdialog (Monteur-Name) ─────────────────────

  function checkErststart() {
    if (Settings.getMonteur()) return;
    const modal = document.getElementById('modal-erststart');
    if (modal) modal.style.display = 'flex';
  }

  function wireErststartControls() {
    const saveBtn = document.getElementById('erststart-save');
    if (saveBtn && !saveBtn.dataset.wired) {
      saveBtn.dataset.wired = '1';
      saveBtn.addEventListener('click', () => {
        const input = document.getElementById('erststart-input-name');
        const val = input.value.trim();
        if (!val) {
          showToast('Bitte einen Namen eingeben.');
          input.focus();
          return;
        }
        Settings.setMonteur(val);
        document.getElementById('modal-erststart').style.display = 'none';
        showToast(`Willkommen, ${val}.`);
        const active = document.querySelector('.screen.active');
        if (active && active.id === 'view-einstellungen') renderEinstellungen();
      });
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
    loadFontSize();
    loadVersion();
    registerServiceWorker();
    wireEinstellungenControls();
    wireErststartControls();

    let startView = 'katalog';
    try {
      const last = localStorage.getItem('e1mat_last_view');
      if (VIEWS.includes(last)) startView = last;
    } catch {}
    showView(startView);

    checkErststart();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { showView, loadVersion };
})();
