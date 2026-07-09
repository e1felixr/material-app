# Changelog

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
