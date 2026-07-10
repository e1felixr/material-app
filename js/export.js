// js/export.js
// ZIP-Bau (Nachbestell-Liste + Fotos) + mailto-Erzeugung.
// ZIP-Technik 1:1 gespiegelt aus 260225_Datenaufnahme/js/export.js: ein
// selbstgeschriebener minimaler ZIP-Builder (Store-Methode, CRC32-Pruefsumme,
// keine externe Lib/kein CDN). Die Nachbestell-Liste wird — wie im Vorbild —
// als .xlsx via SheetJS (globales XLSX aus lib/xlsx.mini.min.js) gebaut.
// Siehe Plan-Datei docs/superpowers/plans/2026-07-09-e1-material.md, Task D2/D3.

const Exporter = (() => {

  // ── Hilfsfunktionen ──────────────────────────────────────────────────

  function pad2(n) { return String(n).padStart(2, '0'); }

  function formatDatum(d) {
    return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  function formatErfasstAm(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('de-DE', {
      timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function sanitizeFilename(name) {
    return String(name || '').replace(/[\/\\:*?"<>|]/g, '').replace(/\s+/g, '_');
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Minimaler ZIP-Builder (Store-Methode, kein Komprimieren fuer JPEGs noetig) ──
  // Gespiegelt aus Vorbild js/export.js: DOS-Zeitstempel, lokale Datei-Header,
  // zentrales Verzeichnis, EOCD — alles ohne externe Abhaengigkeit.

  function dosDateTime(input) {
    if (input == null) return { date: 0, time: 0 };
    const d = (input instanceof Date) ? input : new Date(input);
    if (isNaN(d.getTime()) || d.getFullYear() < 1980) return { date: 0, time: 0 };
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    return { date, time };
  }

  const crc32Table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();

  function crc32(data) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) c = crc32Table[(c ^ data[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function buildZipBytes(files) {
    // files: Array von { name: string, data: Uint8Array, mtime?: number|Date }
    const entries = [];
    let offset = 0;

    const localParts = [];
    for (const file of files) {
      const nameBytes = new TextEncoder().encode(file.name);
      const { date: dosDate, time: dosTime } = dosDateTime(file.mtime);
      const header = new ArrayBuffer(30);
      const hv = new DataView(header);
      hv.setUint32(0, 0x04034b50, true);
      hv.setUint16(4, 20, true);
      hv.setUint16(6, 0x0800, true);
      hv.setUint16(8, 0, true);
      hv.setUint16(10, dosTime, true);
      hv.setUint16(12, dosDate, true);
      hv.setUint32(14, crc32(file.data), true);
      hv.setUint32(18, file.data.length, true);
      hv.setUint32(22, file.data.length, true);
      hv.setUint16(26, nameBytes.length, true);
      hv.setUint16(28, 0, true);

      entries.push({ offset, nameBytes, file, dosDate, dosTime });
      localParts.push(new Uint8Array(header), nameBytes, file.data);
      offset += 30 + nameBytes.length + file.data.length;
    }

    const centralParts = [];
    let centralSize = 0;
    for (const entry of entries) {
      const cd = new ArrayBuffer(46);
      const cv = new DataView(cd);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, entry.dosTime, true);
      cv.setUint16(14, entry.dosDate, true);
      cv.setUint32(16, crc32(entry.file.data), true);
      cv.setUint32(20, entry.file.data.length, true);
      cv.setUint32(24, entry.file.data.length, true);
      cv.setUint16(28, entry.nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, entry.offset, true);

      centralParts.push(new Uint8Array(cd), entry.nameBytes);
      centralSize += 46 + entry.nameBytes.length;
    }

    const eocd = new ArrayBuffer(22);
    const ev = new DataView(eocd);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    const allParts = [...localParts, ...centralParts, new Uint8Array(eocd)];
    const totalSize = allParts.reduce((s, p) => s + p.length, 0);
    const result = new Uint8Array(totalSize);
    let pos = 0;
    for (const part of allParts) {
      result.set(part, pos);
      pos += part.length;
    }
    return result;
  }

  // ── D2: buildZip — Nachbestell-Liste (.xlsx) + Foto-Blobs ────────────

  async function buildZip(posten, monteur) {
    const list = posten || [];
    const wb = XLSX.utils.book_new();
    const headers = ['Kategorie', 'Fach', 'Material', 'Type', 'Menge', 'Notiz', 'Foto', 'Erfasst am'];
    const rows = list.map((p, i) => [
      p.kategorie || '',
      p.position || '',
      p.material || '',
      p.type || '',
      p.nachbestell_menge != null ? p.nachbestell_menge : '',
      p.notiz || '',
      p.foto_blob ? `foto_${i + 1}.jpg` : '',
      formatErfasstAm(p.erfasst_am),
    ]);
    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = headers.map((h, i) => ({
      wch: Math.max(h.length, ...rows.map(r => String(r[i] || '').length), 10),
    }));
    XLSX.utils.book_append_sheet(wb, ws, 'Nachbestellung');
    const xlsxBytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    const now = Date.now();
    const zipFiles = [
      { name: 'Nachbestellung.xlsx', data: new Uint8Array(xlsxBytes), mtime: now },
    ];

    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!p.foto_blob) continue;
      const buf = await p.foto_blob.arrayBuffer();
      const mtime = p.erfasst_am ? new Date(p.erfasst_am).getTime() : now;
      zipFiles.push({ name: `foto_${i + 1}.jpg`, data: new Uint8Array(buf), mtime });
    }

    const zipBytes = buildZipBytes(zipFiles);
    return new Blob([zipBytes], { type: 'application/zip' });
  }

  // ── D2: Betreff + Body (Posten gruppiert nach Kategorie) ──

  function buildSubject(monteur, datum) {
    return `Materialnachbestellung — ${monteur || ''} — ${datum}`;
  }

  function buildBody(list, monteur, datum, schlusshinweis) {
    const byKategorie = new Map();
    for (const p of list) {
      const kat = p.kategorie || 'Sonstiges';
      if (!byKategorie.has(kat)) byKategorie.set(kat, []);
      byKategorie.get(kat).push(p);
    }

    const lines = [];
    lines.push(`Monteur: ${monteur || ''}`);
    lines.push(`Datum: ${datum}`);
    lines.push('');
    for (const [kat, items] of byKategorie) {
      lines.push(`${kat}:`);
      for (const p of items) {
        const typeStr = p.type ? ' ' + p.type : '';
        const notizStr = p.notiz ? ` [${p.notiz}]` : '';
        lines.push(`- ${p.material}${typeStr} — Menge: ${p.nachbestell_menge ?? ''}${notizStr}`);
      }
      lines.push('');
    }
    if (schlusshinweis) lines.push(schlusshinweis);
    return lines.join('\n');
  }

  // buildMailto — Fallback (Desktop / Browser ohne Datei-Share): ZIP separat, manuell anhängen.
  function buildMailto(posten, monteur, empfaengerMails) {
    const list = posten || [];
    const datum = formatDatum(new Date());
    const subject = buildSubject(monteur, datum);

    let body = buildBody(list, monteur, datum, 'Liste und Fotos als ZIP anbei — bitte manuell anhängen.');
    const MAX_BODY_LEN = 1500;
    if (body.length > MAX_BODY_LEN) {
      // Lange Postenlisten sprengen manche mailto-Limits (v.a. iOS Mail) — Kurzfassung statt Kappen mitten im Text.
      body = [
        `Monteur: ${monteur || ''}`,
        `Datum: ${datum}`,
        '',
        `${list.length} Posten — vollständige Liste + Fotos im ZIP-Anhang.`,
      ].join('\n');
    }
    const to = (empfaengerMails || []).join(',');
    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  // buildShare — Betreff + Body für den Teilen-Dialog. Der Empfänger lässt sich über Web Share
  // technisch nicht vorbelegen, daher als "An:"-Zeile im Body, damit der Monteur ihn kennt und
  // in der Mail-App bequem übernehmen kann. Die eigentlichen Anhänge (PDF + CSV) kommen separat.
  function buildShare(posten, monteur, empfaengerMails) {
    const list = posten || [];
    const datum = formatDatum(new Date());
    const title = buildSubject(monteur, datum);

    const mails = (empfaengerMails || []).filter(Boolean);
    const empfaengerZeile = mails.length ? `An: ${mails.join(', ')}\n\n` : '';
    const text = empfaengerZeile + buildBody(list, monteur, datum, '');
    return { title, text };
  }

  // ── Web-Share-Anhänge: CSV (Daten für Excel) + PDF (Bericht mit Fotos) ──
  // Chrome teilt WEDER .zip NOCH .xlsx (beide stehen nicht auf der Freigabe-Liste der Web Share
  // API). Erlaubt sind u.a. PDF, CSV, Bilder. Darum werden zum Teilen ein PDF-Bericht und eine
  // CSV-Liste angehängt — beide teilbar, zusammen ein handlicher Ersatz für das ZIP.

  function csvEscape(v) {
    const s = String(v == null ? '' : v);
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function buildCsv(posten) {
    const list = posten || [];
    const headers = ['Kategorie', 'Fach', 'Material', 'Type', 'Menge', 'Notiz', 'Foto', 'Erfasst am'];
    const rows = list.map((p, i) => [
      p.kategorie || '',
      p.position || '',
      p.material || '',
      p.type || '',
      p.nachbestell_menge != null ? p.nachbestell_menge : '',
      p.notiz || '',
      p.foto_blob ? `foto_${i + 1}.jpg` : '',
      formatErfasstAm(p.erfasst_am),
    ]);
    const lines = [headers, ...rows].map(r => r.map(csvEscape).join(';'));
    // UTF-8-BOM, damit Excel Umlaute korrekt liest; Semikolon = deutsches Excel-Trennzeichen.
    return '﻿' + lines.join('\r\n');
  }

  // Foto-Blob in ein geladenes <img> überführen (für jsPDF.addImage + Seitenverhältnis).
  function loadImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht geladen werden')); };
      img.src = url;
    });
  }

  async function buildPdf(posten, monteur) {
    if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('jsPDF nicht geladen');
    const list = posten || [];
    const datum = formatDatum(new Date());
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = margin;
    const platzSchaffen = (noetig) => { if (y + noetig > pageH - margin) { doc.addPage(); y = margin; } };

    doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text('Materialnachbestellung', margin, y); y += 8;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    doc.text('Monteur: ' + (monteur || '-'), margin, y); y += 6;
    doc.text('Datum: ' + datum, margin, y); y += 6;
    doc.text('Posten: ' + list.length, margin, y); y += 9;

    const byKat = new Map();
    for (const p of list) {
      const kat = p.kategorie || 'Sonstiges';
      if (!byKat.has(kat)) byKat.set(kat, []);
      byKat.get(kat).push(p);
    }
    doc.setFontSize(11);
    for (const [kat, items] of byKat) {
      platzSchaffen(10);
      doc.setFont('helvetica', 'bold'); doc.text(kat, margin, y); y += 6;
      doc.setFont('helvetica', 'normal');
      for (const p of items) {
        const typeStr = p.type ? ' ' + p.type : '';
        const notizStr = p.notiz ? ' [' + p.notiz + ']' : '';
        const line = '- ' + (p.material || '') + typeStr + '  Menge: ' + (p.nachbestell_menge ?? '') + notizStr;
        const wrapped = doc.splitTextToSize(line, pageW - 2 * margin);
        platzSchaffen(wrapped.length * 5 + 1);
        doc.text(wrapped, margin, y); y += wrapped.length * 5 + 1;
      }
      y += 3;
    }

    const mitFoto = list.map((p, i) => ({ p, i })).filter(x => x.p.foto_blob);
    if (mitFoto.length) {
      doc.addPage(); y = margin;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
      doc.text('Fotos', margin, y); y += 8;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      for (const { p, i } of mitFoto) {
        let loaded;
        try { loaded = await loadImage(p.foto_blob); } catch (_) { continue; }
        const { img, url } = loaded;
        const maxW = pageW - 2 * margin;
        const maxH = 90;
        let w = maxW, h = img.naturalHeight / img.naturalWidth * w;
        if (h > maxH) { h = maxH; w = img.naturalWidth / img.naturalHeight * h; }
        platzSchaffen(h + 8);
        const caption = 'foto_' + (i + 1) + '.jpg - ' + (p.material || '') + (p.type ? ' ' + p.type : '');
        doc.text(doc.splitTextToSize(caption, maxW), margin, y); y += 4;
        try { doc.addImage(img, 'JPEG', margin, y, w, h); } catch (_) {}
        URL.revokeObjectURL(url);
        y += h + 6;
      }
    }

    return doc.output('blob');
  }

  // buildShareFiles — die teilbaren Anhänge (PDF-Bericht + CSV-Liste) als File-Objekte.
  async function buildShareFiles(posten, monteur) {
    const list = posten || [];
    const safe = sanitizeFilename(monteur || 'E1Material');
    const pdfBlob = await buildPdf(list, monteur);
    const csvStr = buildCsv(list);
    return [
      new File([pdfBlob], 'Nachbestellung_' + safe + '.pdf', { type: 'application/pdf' }),
      new File([csvStr], 'Nachbestellung_' + safe + '.csv', { type: 'text/csv' }),
    ];
  }

  return { buildZip, buildMailto, buildShare, buildShareFiles, downloadBlob, sanitizeFilename };
})();
