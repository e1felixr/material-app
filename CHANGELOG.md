# Changelog

## v0.3.0 (10.07.2026, 14:53 Uhr)

### Verbessert
- **Senden ohne Hand-Anhängen (Android)** — Beim Senden öffnet sich der System-Teilen-Dialog; ein **PDF-Bericht** (die Posten samt Fotos) und die **Liste als CSV** (für Excel) hängen bereits an. Man wählt nur noch Mail-App und Empfänger — das lästige manuelle Anhängen entfällt. Wo Datei-Teilen fehlt (etwa mancher Desktop-Browser), bleibt der bisherige Weg — ZIP-Download plus Mailprogramm — als Rückfallebene erhalten. (Hintergrund: Chrome teilt weder ZIP- noch Excel-Dateien, wohl aber PDF und CSV.)
- **Klarere Beschriftung** — Der Knopf heißt jetzt „Liste senden" statt „Nachbestellung senden". Der frühere Name klang nach einer endgültigen Bestellung; tatsächlich bereitet der Knopf nur den Versand als E-Mail vor.

## v0.2.0 (10.07.2026, 11:02 Uhr)

### Neu
- **Schriftgröße einstellbar** — In den Einstellungen skaliert der Schieber „Schriftgröße" Text und Bedienelemente der ganzen App (12–22 px, Standard 15 px). Die Einstellung bleibt auf dem Gerät gespeichert.

### Verbessert
- **„Bestellung" statt „Korb"** — Der Reiter und alle zugehörigen Texte (Knopf „+ Bestellen", Meldungen, Hilfe) des Nachbestell-Korbs heißen jetzt „Bestellung".
- **E1-Grün als App-Farbe** — Die Oberfläche trägt jetzt durchgängig das E1-Grün (Kopfzeile, Tab-Leiste, Buttons, Akzente) statt des zuvor verwendeten Blaus.
- **Neues App-Icon** — Griffiges Werkzeug-Symbol (Schraubendreher + Schraubenschlüssel) in E1-Grün statt des blauen Pakets.

### Intern
- **Totes Vorbild-CSS entfernt** — Aus dem Schwesterprojekt geerbte, in dieser App nie genutzte CSS-Klassen (Heizkörper-/Beleuchtungs-Chips, Modul-Umschalter, Rechner-Buttons, Hilfe-Bildmodal u. a.) aus dem Stylesheet entfernt: 1210 → 642 Zeilen (~24,5 → 13,8 KB), keine sichtbare Änderung.

## v0.1.0 (09.07.2026, 16:31 Uhr)

### Neu
- **Materialkatalog aus Excel** — Katalog wird aus `MatCombo.xlsx` importiert, nach Kategorie gruppiert und angezeigt (Material, Type, Fach, Soll-Menge).
- **Suche mit Live-Filter** — Suchfeld im Katalog, Umlaut-tolerant, filtert die Kartenliste ab dem ersten Zeichen; ohne Treffer direkter Sprung in die Freitext-Erfassung mit vorbelegtem Suchbegriff.
- **Nachbestell-Korb** — Katalog-Posten mit Menge, Notiz und optionalem Foto (Kamera) in den Korb legen, bearbeiten und entfernen.
- **Freitext-Posten** — Material, das nicht im Katalog steht, frei mit Material/Type/Kategorie/Menge/Notiz/Foto erfassen.
- **Nachbestell-Mail mit ZIP** — Versand per Button "Nachbestellung senden": Empfänger ankreuzbar, ZIP (Excel-Liste + Fotos) wird heruntergeladen, Mailprogramm öffnet sich mit vorausgefülltem Betreff/Text (ZIP muss manuell angehängt werden).
- **Excel-Import/Vorlage** — Materialliste in den Einstellungen austauschbar ("Materialliste importieren"), Vorlage zum Bearbeiten herunterladbar.
- **PWA/offline** — Installierbar auf dem Startbildschirm, Service Worker mit Network-first-Strategie, funktioniert ohne Internetverbindung.

### Intern
- **Review-Nachbesserung vor Erstauslieferung** — Blau-Thema statt E1-Grün auf allen Modul-Farbvariablen; robusterer Katalog-Ladepfad (kaputtes localStorage fällt sauber auf den Bundle-Katalog zurück); Click-Listener-Leak beim Katalog-Tab-Wechsel behoben; mailto-Body wird bei langen Postenlisten auf eine Kurzfassung gekürzt; Service-Worker cacht jetzt auch die Hilfe-Seite und hat einen korrigierten Offline-Fallback für `version.json`; Versand fängt ZIP/Mailto-Fehler jetzt ab; Fotos werden vor dem Speichern auf max. 1600px/JPEG ~0.8 herunterskaliert.
