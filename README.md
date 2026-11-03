# Tresor

Lokaler Passwort- und Kundennummern-Tresor für die Familie. Windows-Desktop-App (Tauri + React).

## Stand

- **Etappe 1 (fertig):** Gerüst, Design-System, Oberfläche mit Demodaten
- Etappe 2: Rust-Kern – Verschlüsselung (AES-256-GCM, Argon2id), Windows Hello, DPAPI, Master-Passwort
- Etappe 3: Einträge anlegen/bearbeiten, Familienprofile verwalten
- Etappe 4: Passwort-Generator, Auto-Sperre, Zwischenablage-Timeout, Export/Import
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
