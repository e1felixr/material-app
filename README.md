# E1 Material

Progressive Web App (PWA) zur mobilen Nachbestellung von Fahrzeug-Material. Ein Monteur tippt auf der Baustelle leeres Material im Katalog an (oder trägt einen Freitext-Posten ein), sammelt die Posten in einem Korb und erzeugt daraus eine Nachbestell-Mail mit ZIP-Anhang. Läuft komplett im Browser, funktioniert offline und kann auf dem Smartphone wie eine native App installiert werden.

**App starten / installieren:** [https://e1felixr.github.io/material-app/](https://e1felixr.github.io/material-app/) _(aktiv, sobald das Repo `material-app` deployt und GitHub Pages aktiviert ist)_

**aktuelle Version:** v0.1.0

## Installation auf dem Smartphone

Die App-URL im Browser öffnen und dann je nach Browser installieren:

**Chrome (Android) — empfohlen:**
1. Menü (drei Punkte oben rechts) antippen
2. "Zum Startbildschirm hinzufügen" oder "App installieren" wählen
3. Namen bestätigen > "Hinzufügen"

**Edge (Android):**
1. Menü (drei Punkte unten mittig) antippen
2. "Zum Smartphone hinzufügen" wählen
3. "Installieren" bestätigen

**Samsung Internet:**
1. Menü (drei Striche unten rechts) antippen
2. "Seite hinzufügen zu" > "Startbildschirm" wählen
3. Namen bestätigen > "Hinzufügen"

Die App erscheint danach als Icon auf dem Startbildschirm und öffnet sich ohne Browser-Leiste im Vollbildmodus.

## Updates & Versionierung

Die App nutzt eine **Network-first-Strategie**: Solange das Gerät online ist, werden bei jedem Öffnen automatisch die aktuellsten Dateien vom Server geladen (Service Worker `sw.js`). Updates werden **automatisch** angewendet, ein manuelles Eingreifen ist im Normalfall nicht nötig.

Die aktuelle Version wird im Header der App angezeigt (aus `version.json`).

**Wann muss ich neu installieren?** Nur wenn sich die `manifest.json` ändert (z.B. App-Name, Icons). Das ist selten und wird im Changelog vermerkt. Vorgehen: App vom Startbildschirm entfernen, Seite im Browser neu öffnen, erneut zum Startbildschirm hinzufügen — dabei gehen keine Daten verloren.

## Datenspeicherung

| Was | Wo | Überlebt Neuinstallation? |
|-----|-----|---------------------------|
| Materialkatalog | localStorage (`e1mat_catalog`) | Ja |
| Einstellungen (Monteur-Name, Empfänger) | localStorage (`e1mat_settings`) | Ja |
| Nachbestell-Korb (Posten, Mengen, Notizen) | IndexedDB (`e1material` / Store `korb`) | Ja |
| Fotos zu Korb-Posten | IndexedDB (als Blob im Posten) | Ja |
| App-Dateien (HTML, CSS, JS) | Service Worker Cache | Nein (wird automatisch neu geladen) |

Alle Daten bleiben lokal auf dem Gerät. Es gibt **keinen Server, keine Anmeldung und keine automatische Datenübertragung** nach außen — der Versand erfolgt bewusst manuell per E-Mail (siehe unten).

## Ablauf einer Nachbestellung

### 1. Erststart

Beim ersten Öffnen fragt die App nach dem **Namen des Monteurs** (Pflichtfeld). Der Name wird lokal gespeichert und taucht später in Betreff und Text der Nachbestell-Mail auf. Änderbar jederzeit unter **Einstellungen**.

### 2. Material finden

Im Tab **Katalog** ist das Material nach Kategorie gruppiert (aufklappbare Listen). Über das Suchfeld oben lässt sich direkt nach Material oder Type suchen (ab 2 Zeichen erscheinen Vorschläge, Umlaut-tolerant — z.B. findet "muell" auch "Mülltüten").

### 3. Posten erfassen

Auf einen Katalog-Posten **"+ In Korb"** tippen öffnet einen Dialog: Nachbestell-Menge (vorbelegt mit der Soll-Menge aus dem Katalog, änderbar), optionale Notiz, optionales Foto (Kamera direkt aus dem Dialog). Speichern legt den Posten im Korb ab.

Fehlt ein Material im Katalog, legt **"+ Freitext-Posten"** (im Korb) einen freien Eintrag an: Material (Pflicht), Type und Kategorie frei eingebbar, plus Menge/Notiz/Foto wie oben.

### 4. Korb prüfen

Im Tab **Korb** (Badge zeigt die Postenzahl) lassen sich alle erfassten Posten ansehen, bearbeiten (Menge/Notiz/Foto) oder entfernen.

### 5. Nachbestellung senden

Button **"Nachbestellung senden"** öffnet einen Dialog zur Auswahl der Empfänger (aus der in den Einstellungen hinterlegten Empfängerliste, ankreuzbar) plus einem Feld für eine zusätzliche Adresse. Nach Bestätigung:

1. Eine **ZIP-Datei** wird heruntergeladen (Nachbestell-Liste als Excel-Tabelle + alle Fotos).
2. Das **Mailprogramm** öffnet sich automatisch mit vorausgefülltem Betreff, Empfängern und Text.
3. **Wichtig:** Die heruntergeladene ZIP-Datei muss **manuell an die E-Mail angehängt** werden — ein automatischer Anhang ist aus einem `mailto`-Link heraus technisch nicht möglich.

Danach fragt die App, ob der Korb geleert werden soll.

## Stammdaten-Pflege in Excel

Der Materialkatalog stammt aus einer Excel-Datei `MatCombo.xlsx`. Sie kann jederzeit angepasst werden:

1. `MatCombo.xlsx` öffnen (Vorlage über **Einstellungen > "Vorlage herunterladen"** beziehbar, falls die Datei nicht mehr vorliegt).
2. Zeilen bearbeiten, ergänzen oder entfernen und die Datei speichern.
3. In der App unter **Einstellungen > "Materialliste importieren"** die bearbeitete Datei auswählen. Der Import **ersetzt den kompletten Katalog** — vor der Übernahme zeigt die App eine Bestätigung mit der Anzahl gefundener Posten.

**Struktur der Excel-Datei** (erstes Tabellenblatt):

- Die **Kopfzeile steht in Zeile 3** (Zeilen 1–2 sind für Titel/Hinweise reserviert und werden ignoriert).
- Spalten ab Zeile 4: **Kategorie**, **Position** (Fach im Fahrzeug), **Material**, **Type**, **Menge** (Soll-Menge; Zahl oder Text wie "i.o."), **Bemerkung**.
- Zeilen ohne Eintrag in der Spalte **Material** werden beim Import übersprungen.

Passt die Struktur nicht (z.B. Kopfzeile verschoben, Spalte "Material" fehlt), meldet die App das mit einer klaren Fehlermeldung statt den Katalog stillschweigend zu leeren.

## Checkliste vor dem Einsatz

- [ ] App auf dem Gerät installiert (siehe [Installation](#installation-auf-dem-smartphone))
- [ ] App einmal online geöffnet, damit der aktuelle Materialkatalog geladen ist
- [ ] Monteur-Name eingetragen
- [ ] Mindestens ein Empfänger in den Einstellungen hinterlegt
- [ ] Bei Bedarf: aktualisierte `MatCombo.xlsx` importiert

## Hilfe / Probleme

Eine kompakte Kurzanleitung mit FAQ steht in der App selbst über den Info-Button (&#9432;) im Header — siehe [`hilfe/index.html`](hilfe/index.html).
