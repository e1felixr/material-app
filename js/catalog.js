// js/catalog.js
// Materialkatalog: Excel-Import (SheetJS), Parsen, Katalog-Speicher (localStorage),
// gruppierte Anzeige, Suche mit Vorschlaegen, Import/Vorlage-Download.
// Siehe Plan-Datei docs/superpowers/plans/2026-07-09-e1-material.md, Tasks B1-B4.

const Catalog = (() => {
  const KEY = 'e1mat_catalog';
  const HEADER_ROW = 2; // 0-indexiert: Kopfzeile in Excel-Zeile 3

  // ── B1: Parser + Speicher ──────────────────────────────────────────────

  function parseWorkbook(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const items = [];
    for (let i = HEADER_ROW + 1; i < rows.length; i++) {
      const r = rows[i];
      const material = String(r[2] ?? '').trim();
      if (!material) continue;
      const mengeRaw = String(r[4] ?? '').trim();
      const num = Number(mengeRaw.replace(',', '.'));
      items.push({
        kategorie: String(r[0] ?? '').trim() || 'Sonstiges',
        position: String(r[1] ?? '').trim(),
        material,
        type: String(r[3] ?? '').trim(),
        menge_soll: mengeRaw,
        menge_num: Number.isFinite(num) && mengeRaw !== '' ? num : null,
        bemerkung: String(r[5] ?? '').trim(),
      });
    }
    return items;
  }

  function save(items) { localStorage.setItem(KEY, JSON.stringify(items)); }

  async function load() {
    const cached = localStorage.getItem(KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.warn('e1mat_catalog ist beschaedigt, falle auf Bundle-Katalog zurueck:', e);
        localStorage.removeItem(KEY);
      }
    }
    try {
      const buf = await fetch('data/MatCombo.xlsx').then(r => r.arrayBuffer());
      const items = parseWorkbook(buf);
      save(items);
      return items;
    } catch (e) {
      console.error('Materialkatalog (Bundle) konnte nicht geladen werden:', e);
      if (typeof showToast === 'function') showToast('Materialkatalog konnte nicht geladen werden.');
      return [];
    }
  }

  function groupByKategorie(items) {
    const m = new Map();
    for (const it of items) {
      if (!m.has(it.kategorie)) m.set(it.kategorie, []);
      m.get(it.kategorie).push(it);
    }
    return m;
  }

  // ── B2: gruppierte Ansicht ──────────────────────────────────────────────

  // Merkt sich ueber Re-Renders hinweg, welche Kategorien aufgeklappt sind.
  const _openCategories = new Set();
  let _currentItems = [];

  function addToBasket(item) {
    if (typeof Basket !== 'undefined' && typeof Basket.addFromItem === 'function') {
      Basket.addFromItem(item);
    } else {
      showToast('Bestellung folgt in Kürze');
    }
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function itemRowHtml(item, idx) {
    return `
      <div class="card" data-item-idx="${idx}" style="cursor:default; display:flex; align-items:center; gap:8px;">
        <div style="flex:1; min-width:0;">
          <div class="card-title">${escapeHtml(item.material)}</div>
          <div class="card-sub">
            ${item.type ? escapeHtml(item.type) + ' &middot; ' : ''}Fach ${escapeHtml(item.position || '-')} &middot; Soll: ${escapeHtml(item.menge_soll || '-')}
          </div>
        </div>
        <div class="card-actions">
          <button class="btn btn-module btn-sm btn-add-korb" data-item-idx="${idx}" type="button">+ Bestellen</button>
        </div>
      </div>`;
  }

  function renderGroupedList(listEl, items) {
    _currentItems = items;
    const groups = groupByKategorie(items);
    if (groups.size === 0) {
      listEl.innerHTML = '<div class="empty-state"><div class="icon">&#128230;</div><p>Kein Material im Katalog.</p></div>';
      return;
    }
    const html = [];
    // Globaler Index in _currentItems, damit Buttons das Item wiederfinden.
    let idx = 0;
    const indexByItem = new Map();
    items.forEach((it, i) => indexByItem.set(it, i));

    for (const [kategorie, kItems] of groups) {
      const open = _openCategories.has(kategorie);
      html.push(`
        <details class="card" style="padding:0;" ${open ? 'open' : ''} data-kategorie="${escapeHtml(kategorie)}">
          <summary style="padding:10px 12px; font-weight:600; cursor:pointer; list-style:none; display:flex; justify-content:space-between; align-items:center;">
            <span>${escapeHtml(kategorie)}</span>
            <span class="count-badge">${kItems.length}</span>
          </summary>
          <div style="padding:0 8px 8px;">
            ${kItems.map(it => itemRowHtml(it, indexByItem.get(it))).join('')}
          </div>
        </details>`);
    }
    listEl.innerHTML = html.join('');

    // Aufklapp-Status merken
    listEl.querySelectorAll('details[data-kategorie]').forEach(det => {
      det.addEventListener('toggle', () => {
        const kat = det.dataset.kategorie;
        if (det.open) _openCategories.add(kat); else _openCategories.delete(kat);
      });
    });

    wireAddButtons(listEl, items);
  }

  function renderFlatList(listEl, results, allItems, query) {
    _currentItems = allItems;
    if (results.length === 0) {
      const q = escapeHtml(query || '');
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="icon">&#128269;</div>
          <p>Keine Treffer.</p>
          <button class="btn btn-outline btn-sm" id="btn-freitext-from-search" type="button">+ „${q}“ als Freitext erfassen</button>
        </div>`;
      const btn = listEl.querySelector('#btn-freitext-from-search');
      if (btn) {
        btn.addEventListener('click', () => {
          if (typeof Basket !== 'undefined' && typeof Basket.addFreitext === 'function') {
            Basket.addFreitext({ material: query || '' });
          }
        });
      }
      return;
    }
    const indexByItem = new Map();
    allItems.forEach((it, i) => indexByItem.set(it, i));
    listEl.innerHTML = results.map(it => `
      <div style="margin-bottom:2px;">
        <div class="import-info">${escapeHtml(it.kategorie)}</div>
        ${itemRowHtml(it, indexByItem.get(it))}
      </div>`).join('');
    wireAddButtons(listEl, allItems);
  }

  function wireAddButtons(listEl, items) {
    listEl.querySelectorAll('.btn-add-korb').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const idx = Number(btn.dataset.itemIdx);
        const item = items[idx];
        if (item) addToBasket(item);
      });
    });
  }

  async function renderInto(containerEl) {
    const items = await load();
    containerEl.innerHTML = `
      <div class="filter-bar">
        <input type="text" id="katalog-search" placeholder="Material oder Type suchen..." autocomplete="off">
      </div>
      <div id="katalog-list"></div>
    `;

    const searchInput = containerEl.querySelector('#katalog-search');
    const listEl = containerEl.querySelector('#katalog-list');

    renderGroupedList(listEl, items);

    // Live-gefilterte Kartenliste — keine zusaetzliche Vorschlags-Ueberlagerung
    // (nur eine Trefferliste, filtert ab dem ersten Zeichen).
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim();
      if (!q) {
        renderGroupedList(listEl, items);
      } else {
        renderFlatList(listEl, search(q, items), items, q);
      }
    });
  }

  // ── B3: Suche + Vorschlaege ──────────────────────────────────────────────

  function normalize(str) {
    return String(str ?? '')
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss');
  }

  function search(query, items) {
    const q = normalize(query).trim();
    if (!q) return items.slice();
    const scored = [];
    for (const it of items) {
      const hay = normalize((it.material || '') + ' ' + (it.type || ''));
      const idx = hay.indexOf(q);
      if (idx === -1) continue;
      const wordStart = idx === 0 || hay[idx - 1] === ' ';
      scored.push({ it, idx, wordStart });
    }
    scored.sort((a, b) => {
      if (a.wordStart !== b.wordStart) return a.wordStart ? -1 : 1;
      if (a.idx !== b.idx) return a.idx - b.idx;
      return a.it.material.localeCompare(b.it.material);
    });
    return scored.map(s => s.it);
  }

  // ── B4: Import + Vorlage-Download ───────────────────────────────────────

  async function importFromFile(file) {
    let buf;
    try {
      buf = await file.arrayBuffer();
    } catch (e) {
      showToast('Datei konnte nicht gelesen werden.');
      return { count: 0 };
    }

    let items;
    try {
      items = parseWorkbook(buf);
    } catch (e) {
      showToast('Struktur passt nicht — Kopfzeile in Zeile 3, Spalte "Material" nötig.');
      return { count: 0 };
    }

    if (items.length === 0) {
      showToast('Struktur passt nicht — Kopfzeile in Zeile 3, Spalte "Material" nötig.');
      return { count: 0 };
    }

    const ok = confirm(`${items.length} Posten gefunden — Katalog ersetzen?`);
    if (!ok) return { count: items.length, cancelled: true };

    save(items);
    const view = document.getElementById('view-katalog');
    if (view && view.classList.contains('active')) renderInto(view);
    showToast(`${items.length} Posten importiert.`);
    return { count: items.length };
  }

  async function downloadTemplate() {
    try {
      const resp = await fetch('data/MatCombo.xlsx');
      if (!resp.ok) throw new Error('fetch failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'MatCombo.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      showToast('Vorlage konnte nicht geladen werden.');
    }
  }

  function initSettingsUI() {
    const btnVorlage = document.getElementById('btn-katalog-vorlage');
    const inputImport = document.getElementById('input-katalog-import');
    if (btnVorlage && !btnVorlage.dataset.wired) {
      btnVorlage.dataset.wired = '1';
      btnVorlage.addEventListener('click', () => downloadTemplate());
    }
    if (inputImport && !inputImport.dataset.wired) {
      inputImport.dataset.wired = '1';
      inputImport.addEventListener('change', async () => {
        const file = inputImport.files && inputImport.files[0];
        inputImport.value = ''; // erlaubt erneuten Import derselben Datei
        if (!file) return;
        await importFromFile(file);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', initSettingsUI);

  return {
    parseWorkbook,
    load,
    save,
    groupByKategorie,
    renderInto,
    search,
    importFromFile,
    downloadTemplate,
    initSettingsUI,
    KEY,
  };
})();
