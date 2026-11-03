# Tresor

Lokaler Passwort- und Kundennummern-Tresor für die Familie. Windows-Desktop-App (Tauri + React).

## Stand

- **Etappe 1 (fertig):** Gerüst, Design-System, Oberfläche
- **Etappe 2 (fertig):** Rust-Kern – Verschlüsselung (AES-256-GCM, Argon2id), Windows Hello (TPM), Master-Passwort, Ersteinrichtung
- **Etappe 3 (fertig):** Einträge anlegen/bearbeiten/löschen, Familie verwalten, Einstellungen (Hello, Master-Passwort)
- **Etappe 4 (fertig):** Startseite mit Sicherheitscheck, Auto-Sperre, Sperren beim Minimieren, sichere Zwischenablage, verschlüsseltes Backup
- Etappe 5: Feinschliff, Release

## Installer bekommen

Bei jedem Push auf `main` baut GitHub Actions den Windows-Installer.
Repo → **Actions** → letzter Lauf „Windows-Build“ → unten unter **Artifacts** `Tresor-Installer` herunterladen.

## Lokal entwickeln (optional)

```bash
npm install
npm run dev        # nur Oberfläche im Browser
npx tauri dev      # komplette App (braucht Rust + VS Build Tools)
```

## Hinweise

- Anbieter-Logos werden über den Favicon-Dienst von Google geladen. Dabei wird nur die Domain übertragen, niemals Zugangsdaten.

## Sicherheit

- Tresor-Datei: `%APPDATA%\de.coregenetic.tresor\tresor.json` (+ `tresor.json.bak` als vorherige Version)
- Daten: AES-256-GCM mit zufälligem 256-Bit-Tresorschlüssel
- Master-Passwort: Argon2id (64 MiB, 3 Durchläufe) → hüllt den Tresorschlüssel ein
- Windows Hello: TPM-gebundener Schlüssel signiert eine Challenge, daraus wird eine zweite Hülle abgeleitet
- Entschlüsselte Daten und Schlüssel existieren nur im Arbeitsspeicher, solange der Tresor offen ist
- Zwischenablage: Kopieren über die Win32-API ohne Zwischenablageverlauf/Cloud, Leeren nach 30 s (nur wenn nichts anderes kopiert wurde)
- Backup: gleiche Verschlüsselung wie der Tresor, aber mit eigenem Backup-Passwort (`.tresor`-Datei)
- Browser-Entwicklung (`npm run dev`): Demo-Tresor, Master-Passwort `demo-passwort`, `?setup` für die Ersteinrichtung
