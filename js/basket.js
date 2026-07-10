// js/basket.js
// Nachbestell-Korb: Posten aus Katalog/Freitext erfassen, Korb-Ansicht
// (Bearbeiten/Entfernen), Badge. Versand-Flow folgt in Block D (D3).
// Siehe Plan-Datei docs/superpowers/plans/2026-07-09-e1-material.md, Tasks C2-C4.

const Basket = (() => {
  // ── Gemeinsamer Erfassungs-/Bearbeitungs-Dialog (C2/C3/C4) ──────────────

  let _mode = null;        // 'katalog-add' | 'freitext-add' | 'edit'
  let _draftPosten = null; // Basis-Posten (Item-Felder bzw. bestehender Posten)
  let _photoBlob = null;   // aktuell gewaehlter Foto-Blob (oder null)
  let _photoObjectUrl = null;
  let _onSaved = null;      // Callback nach erfolgreichem Speichern

  function el(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isFreitextContext() {
    return _mode === 'freitext-add' || (_mode === 'edit' && _draftPosten && _draftPosten.quelle === 'freitext');
  }

  // Skaliert ein aufgenommenes Foto vor dem Speichern auf max. 1600px Kantenlaenge
  // herunter und exportiert es als JPEG (~0.8 Qualitaet), damit ZIP/Mailanhang
  // klein bleiben. Ist das Bild schon kleiner, bleibt es unveraendert.
  function downscaleImage(file) {
    const MAX_DIM = 1600;
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); }; // Fallback: Original behalten
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.width, h = img.height;
        if (w <= MAX_DIM && h <= MAX_DIM) { resolve(file); return; }
        if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
        else { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.8);
      };
      img.src = url;
    });
  }

  function renderPhotoSlot() {
    const slot = el('posten-photo-slot');
    if (!slot) return;
    if (_photoObjectUrl) { URL.revokeObjectURL(_photoObjectUrl); _photoObjectUrl = null; }
    if (_photoBlob) {
      _photoObjectUrl = URL.createObjectURL(_photoBlob);
      slot.innerHTML = `<img src="${_photoObjectUrl}" alt="Foto"><button type="button" class="remove-photo" id="posten-photo-remove" title="Foto entfernen">&times;</button>`;
      const rm = el('posten-photo-remove');
      if (rm) {
        rm.addEventListener('click', (e) => {
          e.stopPropagation();
          _photoBlob = null;
          renderPhotoSlot();
        });
      }
    } else {
      slot.innerHTML = '<div class="placeholder">Foto aufnehmen</div>';
    }
  }

  function openDialog(opts) {
    _mode = opts.mode;
    _onSaved = opts.onSaved || null;
    _draftPosten = opts.posten || {};
    _photoBlob = (_draftPosten && _draftPosten.foto_blob) || null;

    const titleEl = el('posten-modal-title');
    if (titleEl) titleEl.textContent = opts.title || 'Posten erfassen';

    const readonlyInfo = el('posten-readonly-info');
    const editableFields = el('posten-editable-fields');

    if (isFreitextContext()) {
      readonlyInfo.style.display = 'none';
      editableFields.style.display = 'block';
      el('posten-input-material').value = _draftPosten.material || '';
      el('posten-input-type').value = _draftPosten.type || '';
      el('posten-input-kategorie').value = _draftPosten.kategorie || 'Sonstiges';
    } else {
      editableFields.style.display = 'none';
      readonlyInfo.style.display = 'block';
      el('posten-readonly-material').textContent = _draftPosten.material || '';
      const subParts = [];
      if (_draftPosten.type) subParts.push(_draftPosten.type);
      if (_draftPosten.position) subParts.push('Fach ' + _draftPosten.position);
      if (_draftPosten.kategorie) subParts.push(_draftPosten.kategorie);
      el('posten-readonly-sub').textContent = subParts.join(' · ');
    }

    el('posten-input-menge').value = _draftPosten.nachbestell_menge ?? (_draftPosten.menge_num ?? 1);
    el('posten-input-notiz').value = _draftPosten.notiz || '';

    const mengeLabel = el('posten-menge-label');
    if (mengeLabel) {
      mengeLabel.textContent = _draftPosten.menge_soll
        ? `Nachbestell-Menge (Soll: ${_draftPosten.menge_soll})`
        : 'Nachbestell-Menge';
    }

    renderPhotoSlot();

    const modal = el('modal-posten');
    if (modal) modal.style.display = 'flex';
  }

  function closeDialog() {
    const modal = el('modal-posten');
    if (modal) modal.style.display = 'none';
    if (_photoObjectUrl) { URL.revokeObjectURL(_photoObjectUrl); _photoObjectUrl = null; }
    _mode = null;
    _draftPosten = null;
    _photoBlob = null;
    _onSaved = null;
  }

  async function handleSave() {
    const mengeInput = Number(el('posten-input-menge').value);
    const notiz = el('posten-input-notiz').value.trim();

    let material, type, kategorie, position, bemerkung_katalog, menge_soll;

    if (isFreitextContext()) {
      material = el('posten-input-material').value.trim();
      if (!material) {
        showToast('Material ist Pflichtfeld.');
        return;
      }
      type = el('posten-input-type').value.trim();
      kategorie = el('posten-input-kategorie').value.trim() || 'Sonstiges';
      position = _draftPosten.position || '';
      bemerkung_katalog = _draftPosten.bemerkung_katalog || '';
      menge_soll = _draftPosten.menge_soll;
    } else {
      material = _draftPosten.material;
      type = _draftPosten.type;
      kategorie = _draftPosten.kategorie;
      position = _draftPosten.position;
      bemerkung_katalog = _draftPosten.bemerkung_katalog;
      menge_soll = _draftPosten.menge_soll;
    }

    const nachbestell_menge = Number.isFinite(mengeInput) && mengeInput > 0
      ? mengeInput
      : (_draftPosten.nachbestell_menge ?? 1);

    if (_mode === 'edit') {
      const posten = {
        ..._draftPosten,
        material, type, kategorie, position, bemerkung_katalog, menge_soll,
        nachbestell_menge, notiz,
      };
      if (_photoBlob) posten.foto_blob = _photoBlob; else delete posten.foto_blob;
      await DB.updatePosten(posten);
      closeDialog();
      await refreshBadge();
      showToast('Posten aktualisiert.');
      if (typeof _onSaved === 'function') _onSaved();
      return;
    }

    const posten = {
      id: crypto.randomUUID(),
      quelle: _mode === 'freitext-add' ? 'freitext' : 'katalog',
      kategorie, position, material, type, bemerkung_katalog, menge_soll,
      nachbestell_menge, notiz,
      erfasst_am: new Date().toISOString(),
    };
    if (_photoBlob) posten.foto_blob = _photoBlob;

    await DB.addPosten(posten);
    closeDialog();
    await refreshBadge();
    showToast(`"${material}" zur Bestellung hinzugefügt.`);
    if (typeof _onSaved === 'function') _onSaved();
  }

  function wireDialogControls() {
    const input = el('posten-photo-input');
    if (input && !input.dataset.wired) {
      input.dataset.wired = '1';
      input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        input.value = ''; // erneute Auswahl derselben Datei erlauben
        if (!file) return;
        _photoBlob = await downscaleImage(file);
        renderPhotoSlot();
      });
    }
    const saveBtn = el('posten-modal-save');
    if (saveBtn && !saveBtn.dataset.wired) {
      saveBtn.dataset.wired = '1';
      saveBtn.addEventListener('click', () => handleSave());
    }
  }

  document.addEventListener('DOMContentLoaded', wireDialogControls);

  // ── C2: Posten aus Katalog in den Korb ───────────────────────────────

  function addFromItem(item) {
    openDialog({
      mode: 'katalog-add',
      title: 'Zur Bestellung hinzufügen',
      posten: {
        kategorie: item.kategorie,
        position: item.position,
        material: item.material,
        type: item.type,
        bemerkung_katalog: item.bemerkung,
        menge_num: item.menge_num,
        menge_soll: item.menge_soll,
        nachbestell_menge: item.menge_num ?? 1,
      },
    });
  }

  // ── C3: Freitext-Posten ───────────────────────────────────────────────

  function addFreitext(prefill) {
    const posten = { kategorie: 'Sonstiges', nachbestell_menge: 1 };
    if (prefill && prefill.material) posten.material = prefill.material;
    openDialog({
      mode: 'freitext-add',
      title: 'Freitext-Posten',
      posten,
    });
  }

  // ── C4: Korb-Ansicht (bearbeiten/entfernen) + Badge ──────────────────

  function editPosten(posten) {
    openDialog({
      mode: 'edit',
      title: 'Posten bearbeiten',
      posten,
      onSaved: () => {
        const view = document.getElementById('view-korb');
        if (view && view.classList.contains('active')) renderInto(view);
      },
    });
  }

  async function removePosten(posten) {
    const ok = confirm(`"${posten.material}" aus der Bestellung entfernen?`);
    if (!ok) return;
    await DB.deletePosten(posten.id);
    await refreshBadge();
    showToast('Posten entfernt.');
    const view = document.getElementById('view-korb');
    if (view && view.classList.contains('active')) renderInto(view);
  }

  function postenRowHtml(posten) {
    const subParts = [];
    if (posten.type) subParts.push(escapeHtml(posten.type));
    if (posten.kategorie) subParts.push(escapeHtml(posten.kategorie));
    subParts.push('Menge: ' + escapeHtml(String(posten.nachbestell_menge ?? '-')));
    const notizHtml = posten.notiz
      ? `<div class="card-sub" style="margin-top:2px;">Notiz: ${escapeHtml(posten.notiz)}</div>`
      : '';
    const freitextChip = posten.quelle === 'freitext'
      ? ' <span class="count-badge" style="vertical-align:middle;">Freitext</span>'
      : '';
    return `
      <div class="card" data-posten-id="${escapeHtml(posten.id)}" style="cursor:default; display:flex; align-items:center; gap:8px;">
        <div class="korb-thumb" data-posten-thumb="${escapeHtml(posten.id)}" style="width:48px; height:48px; border-radius:8px; overflow:hidden; flex-shrink:0; background:#FAFAFA; display:flex; align-items:center; justify-content:center; font-size:1.3rem;">
          ${posten.foto_blob ? '' : '&#128230;'}
        </div>
        <div style="flex:1; min-width:0;">
          <div class="card-title">${escapeHtml(posten.material)}${freitextChip}</div>
          <div class="card-sub">${subParts.join(' &middot; ')}</div>
          ${notizHtml}
        </div>
        <div class="card-actions">
          <button class="btn-icon btn-posten-edit" data-posten-id="${escapeHtml(posten.id)}" type="button" title="Bearbeiten">&#9998;</button>
          <button class="btn-icon btn-icon-danger btn-posten-remove" data-posten-id="${escapeHtml(posten.id)}" type="button" title="Entfernen">&#128465;</button>
        </div>
      </div>`;
  }

  // Object-URLs der Korb-Thumbnails; werden vor jedem Neu-Rendern freigegeben,
  // um Speicherlecks zu vermeiden.
  let _thumbUrls = [];

  function revokeThumbUrls() {
    _thumbUrls.forEach(u => URL.revokeObjectURL(u));
    _thumbUrls = [];
  }

  async function renderInto(containerEl) {
    revokeThumbUrls();
    const posten = await DB.allPosten();
    posten.sort((a, b) => (b.erfasst_am || '').localeCompare(a.erfasst_am || ''));

    const header = `
      <div class="action-bar" style="margin-bottom:10px;">
        <button class="btn btn-outline btn-sm" id="btn-freitext-posten" type="button">+ Freitext-Posten</button>
        <button class="btn btn-primary btn-sm" id="btn-send-nachbestellung" type="button" ${posten.length === 0 ? 'disabled' : ''}>Nachbestellung senden</button>
      </div>`;

    if (posten.length === 0) {
      containerEl.innerHTML = header + '<div class="empty-state"><div class="icon">&#128722;</div><p>Die Bestellung ist leer.</p></div>';
    } else {
      containerEl.innerHTML = header + '<div id="korb-list">' + posten.map(postenRowHtml).join('') + '</div>';
    }

    // Foto-Thumbnails erst nach dem Einfuegen ins DOM setzen (Object-URL braucht Ziel-Element).
    posten.forEach(p => {
      if (!p.foto_blob) return;
      const thumbEl = containerEl.querySelector(`[data-posten-thumb="${CSS.escape(p.id)}"]`);
      if (!thumbEl) return;
      const url = URL.createObjectURL(p.foto_blob);
      _thumbUrls.push(url);
      thumbEl.innerHTML = `<img src="${url}" alt="Foto" style="width:100%; height:100%; object-fit:cover;">`;
    });

    const btnFreitext = containerEl.querySelector('#btn-freitext-posten');
    if (btnFreitext) btnFreitext.addEventListener('click', () => addFreitext());

    const btnSend = containerEl.querySelector('#btn-send-nachbestellung');
    if (btnSend) btnSend.addEventListener('click', () => openSendDialog());

    containerEl.querySelectorAll('.btn-posten-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = posten.find(x => x.id === btn.dataset.postenId);
        if (p) editPosten(p);
      });
    });
    containerEl.querySelectorAll('.btn-posten-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = posten.find(x => x.id === btn.dataset.postenId);
        if (p) removePosten(p);
      });
    });
  }

  async function refreshBadge() {
    const posten = await DB.allPosten();
    const badge = document.getElementById('korb-badge');
    if (!badge) return;
    const count = posten.length;
    badge.textContent = String(count);
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }

  // Badge beim App-Start aktualisieren (Persistenz ueber Reload hinweg).
  document.addEventListener('DOMContentLoaded', () => { refreshBadge(); });

  // ── D3: Versand-Flow (Empfaenger ankreuzen, senden, Korb leeren) ─────

  function openSendDialog() {
    const listEl = el('send-empfaenger-list');
    const empfaenger = (typeof Settings !== 'undefined') ? Settings.getEmpfaenger() : [];
    if (listEl) {
      if (empfaenger.length === 0) {
        listEl.innerHTML = '<p class="hint">Keine Empfänger hinterlegt — unter Einstellungen anlegen, oder unten eine Adresse eintragen.</p>';
      } else {
        listEl.innerHTML = empfaenger.map((e, i) => `
          <label class="send-recipient-row">
            <input type="checkbox" class="send-empfaenger-check" data-idx="${i}" checked>
            <span>${escapeHtml(e.name)} (${escapeHtml(e.mail)})</span>
          </label>`).join('');
      }
    }
    const extraInput = el('send-extra-mail');
    if (extraInput) extraInput.value = '';

    const modal = el('modal-send-nachbestellung');
    if (modal) modal.style.display = 'flex';
  }

  function closeSendDialog() {
    const modal = el('modal-send-nachbestellung');
    if (modal) modal.style.display = 'none';
  }

  async function confirmSend() {
    const posten = await DB.allPosten();
    if (posten.length === 0) {
      showToast('Die Bestellung ist leer.');
      closeSendDialog();
      return;
    }

    const empfaenger = (typeof Settings !== 'undefined') ? Settings.getEmpfaenger() : [];
    const mails = [];
    document.querySelectorAll('.send-empfaenger-check').forEach(cb => {
      if (cb.checked) {
        const idx = Number(cb.dataset.idx);
        if (empfaenger[idx]) mails.push(empfaenger[idx].mail);
      }
    });

    const extraMail = (el('send-extra-mail')?.value || '').trim();
    if (extraMail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extraMail)) {
        showToast('Zusätzliche Adresse ist ungültig.');
        return;
      }
      mails.push(extraMail);
    }

    const monteur = (typeof Settings !== 'undefined') ? Settings.getMonteur() : '';

    try {
      const zipBlob = await Exporter.buildZip(posten, monteur);
      const zipFileName = 'Nachbestellung_' + Exporter.sanitizeFilename(monteur || 'E1Material') + '.zip';
      Exporter.downloadBlob(zipBlob, zipFileName);

      const mailto = Exporter.buildMailto(posten, monteur, mails);
      showToast('ZIP heruntergeladen — bitte manuell anhängen.');
      setTimeout(() => { window.location.href = mailto; }, 400);
    } catch (e) {
      console.error('Versand fehlgeschlagen:', e);
      showToast('Versand fehlgeschlagen — bitte erneut versuchen');
      return;
    }

    closeSendDialog();

    setTimeout(async () => {
      const ok = confirm('Bestellung jetzt leeren?');
      if (ok) {
        await DB.clearKorb();
        await refreshBadge();
        const view = document.getElementById('view-korb');
        if (view && view.classList.contains('active')) renderInto(view);
        showToast('Bestellung geleert.');
      }
    }, 600);
  }

  function wireSendDialogControls() {
    const sendBtn = el('btn-send-confirm');
    if (sendBtn && !sendBtn.dataset.wired) {
      sendBtn.dataset.wired = '1';
      sendBtn.addEventListener('click', () => confirmSend());
    }
  }

  document.addEventListener('DOMContentLoaded', wireSendDialogControls);

  return { addFromItem, addFreitext, renderInto, refreshBadge, closeDialog, closeSendDialog };
})();
