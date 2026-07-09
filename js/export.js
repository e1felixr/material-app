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

  // ── D2: buildMailto — Betreff + Body (Posten gruppiert nach Kategorie) ──

  function buildMailto(posten, monteur, empfaengerMails) {
    const list = posten || [];
    const now = new Date();
    const datum = formatDatum(now);
    const subject = `Materialnachbestellung — ${monteur || ''} — ${datum}`;

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
    lines.push('Liste und Fotos als ZIP anbei — bitte manuell anhängen.');

    let body = lines.join('\n');
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

  return { buildZip, buildMailto, downloadBlob, sanitizeFilename };
})();
