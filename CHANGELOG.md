# Changelog

## v0.1.0 (09.07.2026, 16:31 Uhr)

### Neu
- **Materialkatalog aus Excel** — Katalog wird aus `MatCombo.xlsx` importiert, nach Kategorie gruppiert und angezeigt (Material, Type, Fach, Soll-Menge).
- **Suche mit Vorschlägen** — Suchfeld im Katalog, Umlaut-tolerant, ab 2 Zeichen mit Vorschlagsliste.
- **Nachbestell-Korb** — Katalog-Posten mit Menge, Notiz und optionalem Foto (Kamera) in den Korb legen, bearbeiten und entfernen.
- **Freitext-Posten** — Material, das nicht im Katalog steht, frei mit Material/Type/Kategorie/Menge/Notiz/Foto erfassen.
- **Nachbestell-Mail mit ZIP** — Versand per Button "Nachbestellung senden": Empfänger ankreuzbar, ZIP (Excel-Liste + Fotos) wird heruntergeladen, Mailprogramm öffnet sich mit vorausgefülltem Betreff/Text (ZIP muss manuell angehängt werden).
- **Excel-Import/Vorlage** — Materialliste in den Einstellungen austauschbar ("Materialliste importieren"), Vorlage zum Bearbeiten herunterladbar.
- **PWA/offline** — Installierbar auf dem Startbildschirm, Service Worker mit Network-first-Strategie, funktioniert ohne Internetverbindung.
