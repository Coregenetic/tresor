# Tresor

Lokaler Passwort- und Kundennummern-Tresor für die Familie. Windows-Desktop-App (Tauri + React).

## Stand

- **Etappe 1 (fertig):** Gerüst, Design-System, Oberfläche
- **Etappe 2 (fertig):** Rust-Kern – Verschlüsselung (AES-256-GCM, Argon2id), Windows Hello (TPM), Master-Passwort, Ersteinrichtung
- **Etappe 3 (fertig):** Einträge anlegen/bearbeiten/löschen, Familie verwalten, Einstellungen (Hello, Master-Passwort)
- **Etappe 4 (fertig):** Startseite mit Sicherheitscheck, Auto-Sperre, Sperren beim Minimieren, sichere Zwischenablage, verschlüsseltes Backup
- **Etappe 5 (fertig):** Midnight-Design, Tray, automatische Updates, PIN/IBAN/Vertragsende/Sicherheitsfragen, Passwort-Generator

## Installer bekommen

- **Testversion:** Jeder Push auf `main` baut den Installer → Repo → **Actions** → letzter Lauf → **Artifacts** → `Tresor-Installer`.
- **Release (mit automatischem Update):** Version in `package.json`, `src-tauri/tauri.conf.json` und `src-tauri/Cargo.toml` erhöhen, committen, dann
  ```bash
  git tag v0.5.0
  git push origin v0.5.0
  ```
  GitHub veröffentlicht ein Release. Installierte Apps finden es beim nächsten Entsperren und aktualisieren sich.

## Updates einrichten (einmalig)

Updates werden signiert, damit die App nur echte Versionen installiert.

1. Repo muss **öffentlich** sein (sonst kann die App das Release nicht abrufen).
2. Repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `TAURI_SIGNING_PRIVATE_KEY` = kompletter Inhalt der Datei `tresor-updater.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = das zugehörige Passwort
3. Schlüssel und Passwort sicher aufbewahren (z. B. als Notiz im Tresor). Ohne sie lassen sich keine Updates mehr veröffentlichen.

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
