<!-- project: 260709_App David -->
<!-- status: aktiv -->
# E1 Material — Design-Spec

**Datum:** 09.07.2026
**Projekt:** 260709_App David
**Arbeitstitel:** E1 Material
**Schwesterprojekt (Vorbild):** 260225_Datenaufnahme ("E1 Begehung")

## Zweck

Mobile App fuer Monteure: Verbraucht ein Monteur auf der Baustelle Material aus
seinem Fahrzeug und der Vorrat ist danach leer, markiert er den Posten in der App.
Die App sammelt alle leeren Posten und erzeugt daraus eine Nachbestell-/Erinnerungs-Mail.

Kern-Prinzip: **Der Monteur entscheidet, was leer ist** — es gibt keine Live-Bestandsfuehrung,
keine Zaehlerei. Die App ist ein schneller Erfassungs- und Mail-Generator, kein Warenwirtschaftssystem.

## Leitentscheidungen (aus dem Brainstorming)

1. **Infrastruktur = Zwilling von Datenaufnahme.** Reine Browser-PWA, offline-faehig,
   aufs Smartphone installierbar, Daten lokal, Versand ueber `mailto` + ZIP-Anhang.
   Gleiche CSS-/Header-/Einstellungs-Muster fuer optische und bedientechnische Paritaet.
2. **Empfaenger waehlbar, Sammelliste.** Empfaenger pro Versand ankreuzbar (verwaltbare
   Liste in Einstellungen + freie Eingabe); eine Mail mit der gesammelten Nachbestell-Liste.
3. **Erfassung: volle Liste + Suche mit Autovervollstaendigung + Freitext-Posten.**
   Katalog nach Kategorie gruppiert, Suchfeld mit Vorschlaegen, zusaetzlich Freitext
   fuer nicht gelistetes Material.
4. **Stammdaten pflegt der Monteur selbst in Excel.** Die App liest die `MatCombo.xlsx`
   ein ("oeffnen, bearbeiten, speichern, laden") — keine In-App-Bearbeitung des Katalogs,
   kein Code, kein CSV-Frickeln. Vorerst eine Liste, Struktur aber mehr-Fahrzeug-faehig angelegt.
5. **Fotos: optional je Posten.** ZIP-Anhang-Mechanik wie beim Schwesterprojekt.
6. **Name: E1 Material.**

## Infrastruktur & Datei-Struktur

Gespiegelt von Datenaufnahme:

| Datei / Ordner | Zweck |
|---|---|
| `index.html` | Single-Page-App, alle Ansichten |
| `js/app.js` | Hauptlogik (Katalog, Korb, Ansichten, Einstellungen) |
| `js/db.js` | IndexedDB-Wrapper (Korb-Posten inkl. Foto-Blobs) |
| `js/export.js` | Nachbestell-Mail: ZIP bauen (Liste + Fotos) + `mailto` oeffnen |
| `js/catalog.js` | Materialkatalog: Excel-Import (SheetJS), Parsen, lokal ablegen, Suche |
| `css/style.css` | Optik, uebernommen/angepasst aus Datenaufnahme |
| `lib/xlsx.mini.min.js` | SheetJS — Excel parsen (bereits im Schwesterprojekt erprobt) |
| `manifest.json` | PWA-Manifest (`name`/`short_name` = "E1 Material") |
| `sw.js` | Service Worker, Network-first (wie Datenaufnahme) |
| `version.json` | Versionsanzeige im Header |
| `icons/` | icon-192.png, icon-512.png (E1-Icon) |
| `data/MatCombo.xlsx` | eingebaute Start-Materialliste (Auslieferung) |
| `hilfe/` | Kurz-Hilfe (In-App) |
| `changelog.md` / `CHANGELOG.md` | Versionshistorie (E1-Konvention) |
| `README.md` | Installations-/Bedienanleitung (wie Datenaufnahme) |

Kein Server, keine Anmeldung, keine Datenuebertragung nach aussen. Hosting: eigenes
GitHub-Pages-Repo (analog e1felixr.github.io/datenaufnahme).

## Datenmodell

### Materialkatalog (aus Excel)
Quelle: `MatCombo.xlsx`, Kopfzeile in Zeile 3 (0-indexiert Zeile 2). Spalten:

| Spalte | Bedeutung | Nutzung |
|---|---|---|
| Kategorie | Gruppierung (Elektroinstallation, Werkzeug, Kabel, …) | Katalog-Gruppen |
| Position | Lagerort/Fach im Fahrzeug (1–15, "Cockpit") | Anzeige, Sortierung |
| Material | Bezeichnung | Suchfeld, Titel |
| Type | Typ/Spezifikation (z.B. "16er lang", "PDL 4 S/L/L/PE") | Anzeige, Suche |
| Menge | Soll-Bestand (Zahl oder "i.o" = Schuettgut) | Vorschlag Nachbestell-Menge |
| Bemerkung | frei | Anzeige |

Parse-Regeln: Zeilen ohne `Material` werden verworfen. `Menge`: numerisch →
Vorschlagswert; nicht-numerisch ("i.o", "x", "5m", …) → als Text uebernehmen, kein
numerischer Default. Robust gegen leere Zellen und Umlaute.

### Nachbestell-Posten (Korb-Eintrag)
```
{
  id, quelle: "katalog" | "freitext",
  kategorie, position, material, type, bemerkung_katalog,
  nachbestell_menge,       // vorbelegt = Soll-Menge, editierbar
  notiz,                   // optionale Monteur-Bemerkung
  foto_blob?,              // optional, in IndexedDB
  erfasst_am
}
```

### Einstellungen (localStorage)
- `monteur_name` (Pflichtfeld beim ersten Start, wie "Erfasser")
- `empfaenger[]` (verwaltbare Empfaengerliste, Name + Mailadresse)
- ggf. Schriftgroesse (wie Datenaufnahme), falls uebernommen

### Persistenz
- Materialkatalog + Einstellungen: `localStorage`
- Laufender Korb inkl. Foto-Blobs: `IndexedDB` (`db.js`), uebersteht App-Neustart

## Ansichten & Ablauf

1. **Erststart:** Monteur-Name abfragen (Pflicht). Eingebaute Start-Materialliste ist
   sofort verfuegbar.
2. **Katalog-Ansicht (Hauptansicht):**
   - Suchfeld oben mit Autovervollstaendigung/Vorschlaegen (Treffer aus Material + Type).
   - Darunter Katalog nach Kategorie gruppiert (aufklappbar), Posten mit Material, Type,
     Position, Soll-Menge.
   - Antippen eines Postens → in den Nachbestell-Korb (Nachbestell-Menge = Soll-Menge
     vorbelegt, editierbar; optional Notiz; optional Foto aufnehmen).
   - Button "Freitext-Posten" → nicht gelistetes Material per Hand hinzufuegen.
   - Badge/Zaehler zeigt Anzahl Posten im Korb.
3. **Korb-Ansicht:** Liste aller markierten Posten; je Posten editier-/entfernbar
   (Menge, Notiz, Foto). Button "Nachbestellung senden".
4. **Versand:** Empfaenger ankreuzen (Einstellungsliste + freie Eingabe) →
   `export.js` baut ZIP (Nachbestell-Liste als Excel/Text + Fotos), laedt sie herunter,
   oeffnet `mailto` mit Betreff + Empfaengern + formatiertem Text (Posten-Liste).
   ZIP wird — wie bei Datenaufnahme — **manuell angehaengt**. Nach Versand: Korb nach
   Rueckfrage leeren.
5. **Einstellungen:** Monteur-Name, Empfaengerliste pflegen, "Materialliste importieren",
   "Vorlage herunterladen", ggf. "Alle Daten zuruecksetzen".

### Mail-Inhalt (Vorschlag)
- **Betreff:** `Materialnachbestellung — <Monteur> — <Datum>`
- **Text:** Kopfzeile (Monteur, Datum), dann Posten-Liste gruppiert nach Kategorie:
  `<Material> <Type> — Menge: <nachbestell_menge>  [Notiz]`. Hinweis, dass die
  Detail-Liste + Fotos als ZIP anhaengen.

## Stammdaten-Pflege durch Monteure

- **Import:** Einstellungen → "Materialliste importieren" → `.xlsx` waehlen → SheetJS parst
  → Katalog ersetzen (mit Vorschau/Anzahl-Bestaetigung). Fehlertolerant; klare Meldung bei
  unpassender Struktur.
- **Vorlage:** "Vorlage herunterladen" liefert die aktuelle/leere `MatCombo.xlsx`-Struktur,
  damit der Aufbau erhalten bleibt.
- **Auslieferung:** `data/MatCombo.xlsx` als Startliste eingebettet — App laeuft sofort,
  Import ueberschreibt.

## Bewusst NICHT enthalten (YAGNI)

- Keine Live-Bestandsfuehrung / Mengenzaehlung.
- Keine In-App-Bearbeitung des Stammkatalogs (das macht Excel).
- Keine Versand-Historie (spaeter nachruestbar).
- Keine Mehr-Fahrzeug-Auswahl im UI (Struktur aber offen gehalten).
- Kein zentrales Nutzerkonto / Backend.

## Offene Detailpunkte fuer die Umsetzung

- Exaktes Format der ZIP-Beilage (Excel wie Datenaufnahme-Export vs. schlichte Textliste)
  — in der Umsetzung an der `export.js`-Vorlage ausrichten.
- Uebernahme der Schriftgroessen-Einstellung und Hilfe-Seiten aus Datenaufnahme
  (1:1 vs. reduziert) — beim Bau entscheiden.
