import { Download, Fingerprint, KeyRound, Minimize2, RefreshCw, ShieldCheck, Sparkles, Timer, Upload } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api, errorText, type VaultData } from "../lib/api";
import type { Settings } from "../lib/types";
import { appVersion, checkForUpdate, type AvailableUpdate } from "../lib/system";
import { Modal } from "./Modal";
import { Segmented } from "./Segmented";

interface Props {
  settings: Settings;
  onSettingsChange: (s: Settings) => void;
  helloSupported: boolean;
  helloEnabled: boolean;
  onHelloChanged: (enabled: boolean) => void;
  /** Importierte Daten zusammenführen; liefert, wie viel neu dazukam */
  onImport: (data: VaultData) => { entries: number; members: number };
  onClose: () => void;
}

type Tab = "security" | "backup" | "password" | "info";

const LOCK_OPTIONS = [
  { value: 1, label: "1 Min." },
  { value: 5, label: "5 Min." },
  { value: 15, label: "15 Min." },
  { value: 30, label: "30 Min." },
  { value: 0, label: "Nie" },
];

export function SettingsDialog(props: Props) {
  const { settings, onSettingsChange, helloSupported, helloEnabled, onHelloChanged, onImport, onClose } = props;
  const [tab, setTab] = useState<Tab>("security");

  return (
    <Modal title="Einstellungen" onClose={onClose} width={480}>
      <div className="modal-body">
        <Segmented
          label="Bereich"
          role="tablist"
          full
          value={tab}
          onChange={setTab}
          options={[
            { value: "security", label: "Sicherheit" },
            { value: "backup", label: "Backup" },
            { value: "password", label: "Passwort" },
            { value: "info", label: "Info" },
          ]}
        />

        {tab === "security" && (
          <SecurityTab
            settings={settings}
            onSettingsChange={onSettingsChange}
            helloSupported={helloSupported}
            helloEnabled={helloEnabled}
            onHelloChanged={onHelloChanged}
          />
        )}
        {tab === "backup" && <BackupTab onImport={onImport} />}
        {tab === "password" && <PasswordTab />}
        {tab === "info" && <InfoTab />}
      </div>
    </Modal>
  );
}

/* ── Sicherheit ───────────────────────────── */

function SecurityTab({
  settings,
  onSettingsChange,
  helloSupported,
  helloEnabled,
  onHelloChanged,
}: Pick<Props, "settings" | "onSettingsChange" | "helloSupported" | "helloEnabled" | "onHelloChanged">) {
  const [helloBusy, setHelloBusy] = useState(false);

  async function toggleHello(on: boolean) {
    setHelloBusy(true);
    try {
      if (on) {
        await api.enableHello();
        toast.success("Windows Hello eingerichtet");
      } else {
        await api.disableHello();
        toast("Windows Hello ausgeschaltet", { description: "Entsperren geht jetzt nur noch mit dem Master-Passwort." });
      }
      onHelloChanged(on);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setHelloBusy(false);
    }
  }

  return (
    <div className="settings-tab">
      <div className="setting-block">
        <div className="setting-head">
          <span className="toggle-icon">
            <Timer size={18} />
          </span>
          <span className="toggle-text">
            <span className="toggle-title">Automatisch sperren</span>
            <span className="toggle-sub">Nach dieser Zeit ohne Maus- oder Tastatureingabe.</span>
          </span>
        </div>
        <Segmented
          label="Automatisch sperren"
          full
          size="sm"
          value={settings.autoLockMinutes}
          onChange={(v) => onSettingsChange({ ...settings, autoLockMinutes: v })}
          options={LOCK_OPTIONS}
        />
      </div>

      <label className="toggle-row">
        <span className="toggle-icon">
          <Minimize2 size={18} />
        </span>
        <span className="toggle-text">
          <span className="toggle-title">Beim Minimieren sperren</span>
          <span className="toggle-sub">Schließen schickt Tresor in den Infobereich und sperrt immer.</span>
        </span>
        <input
          type="checkbox"
          className="switch"
          checked={settings.lockOnMinimize}
          onChange={(e) => onSettingsChange({ ...settings, lockOnMinimize: e.target.checked })}
        />
      </label>

      <label className="toggle-row" data-disabled={!helloSupported || helloBusy || undefined}>
        <span className="toggle-icon">
          <Fingerprint size={18} />
        </span>
        <span className="toggle-text">
          <span className="toggle-title">Windows Hello</span>
          <span className="toggle-sub">
            {helloSupported
              ? helloEnabled
                ? "Entsperren per PIN, Fingerabdruck oder Gesicht."
                : "Aus – Entsperren nur mit dem Master-Passwort."
              : "Auf diesem PC ist Windows Hello nicht eingerichtet."}
          </span>
        </span>
        <input
          type="checkbox"
          className="switch"
          checked={helloEnabled}
          disabled={!helloSupported || helloBusy}
          onChange={(e) => toggleHello(e.target.checked)}
        />
      </label>

      <p className="settings-note">
        <ShieldCheck size={14} />
        Kopierte Passwörter werden nach 30 Sekunden gelöscht und erscheinen nicht im Windows-Zwischenablageverlauf.
      </p>
    </div>
  );
}

/* ── Backup ───────────────────────────────── */

function BackupTab({ onImport }: Pick<Props, "onImport">) {
  const [mode, setMode] = useState<"idle" | "export" | "import">("idle");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [importPath, setImportPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMode("idle");
    setPw("");
    setPw2("");
    setImportPath(null);
    setError(null);
  }

  async function doExport(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 10 || pw !== pw2) return;
    setError(null);
    const path = await api.pickExportPath().catch(() => null);
    if (!path) return;
    setBusy(true);
    try {
      await api.exportBackup(path, pw);
      toast.success("Backup gespeichert", { description: "Bewahre Datei und Backup-Passwort getrennt auf." });
      reset();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function chooseImport() {
    setError(null);
    const path = await api.pickImportPath().catch(() => null);
    if (!path) return;
    setImportPath(path);
    setMode("import");
  }

  async function doImport(e: FormEvent) {
    e.preventDefault();
    if (!importPath || !pw) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api.importBackup(importPath, pw);
      const added = onImport(data);
      toast.success("Backup importiert", {
        description:
          added.entries + added.members === 0
            ? "Alles war schon vorhanden."
            : `${added.entries} Einträge und ${added.members} Personen hinzugefügt.`,
      });
      reset();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-tab">
      <p className="settings-intro">
        Ein Backup ist eine verschlüsselte Datei mit allen Einträgen. Es hat ein eigenes Passwort und lässt sich
        auch nach einer Windows-Neuinstallation wieder einlesen.
      </p>

      {mode === "idle" && (
        <div className="backup-actions">
          <button className="backup-card" onClick={() => setMode("export")}>
            <span className="toggle-icon">
              <Download size={18} />
            </span>
            <span className="toggle-text">
              <span className="toggle-title">Backup erstellen</span>
              <span className="toggle-sub">Z. B. auf einen USB-Stick speichern.</span>
            </span>
          </button>
          <button className="backup-card" onClick={chooseImport}>
            <span className="toggle-icon">
              <Upload size={18} />
            </span>
            <span className="toggle-text">
              <span className="toggle-title">Backup einlesen</span>
              <span className="toggle-sub">Fehlende Einträge werden ergänzt, nichts wird überschrieben.</span>
            </span>
          </button>
        </div>
      )}

      {mode === "export" && (
        <form className="settings-form" onSubmit={doExport}>
          <label className="form-field">
            <span className="field-label">Backup-Passwort (mind. 10 Zeichen)</span>
            <input
              className="input"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoFocus
              autoComplete="new-password"
            />
          </label>
          <label className="form-field">
            <span className="field-label">Wiederholen</span>
            <input
              className="input"
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password"
              aria-invalid={!!pw2 && pw !== pw2}
            />
          </label>
          <p className="form-error" role="alert" data-visible={!!(error || (pw2 && pw !== pw2)) || undefined}>
            {error ?? (pw2 && pw !== pw2 ? "Stimmt nicht überein" : " ")}
          </p>
          <div className="modal-foot modal-foot--end">
            <button type="button" className="ghost-btn" onClick={reset} disabled={busy}>
              Abbrechen
            </button>
            <button type="submit" className="primary-btn" disabled={busy || pw.length < 10 || pw !== pw2}>
              <span className="btn-content" data-busy={busy || undefined}>
                {busy ? "Wird verschlüsselt…" : "Speicherort wählen…"}
              </span>
            </button>
          </div>
        </form>
      )}

      {mode === "import" && (
        <form className="settings-form" onSubmit={doImport}>
          <div className="file-pill" title={importPath ?? ""}>
            {importPath?.split(/[\\/]/).pop()}
          </div>
          <label className="form-field">
            <span className="field-label">Backup-Passwort</span>
            <input
              className="input"
              type="password"
              value={pw}
              onChange={(e) => {
                setPw(e.target.value);
                setError(null);
              }}
              autoFocus
              autoComplete="off"
            />
          </label>
          <p className="form-error" role="alert" data-visible={!!error || undefined}>
            {error ?? " "}
          </p>
          <div className="modal-foot modal-foot--end">
            <button type="button" className="ghost-btn" onClick={reset} disabled={busy}>
              Abbrechen
            </button>
            <button type="submit" className="primary-btn" disabled={busy || !pw}>
              <span className="btn-content" data-busy={busy || undefined}>
                {busy ? "Wird entschlüsselt…" : "Einlesen"}
              </span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ── Master-Passwort ──────────────────────── */

function PasswordTab() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = !!next2 && next !== next2;
  const canChange = current.length > 0 && next.length >= 10 && next === next2 && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canChange) return;
    setBusy(true);
    setError(null);
    try {
      await api.changePassword(current, next);
      toast.success("Master-Passwort geändert", { description: "Bitte die neue Notiz sicher aufbewahren." });
      setCurrent("");
      setNext("");
      setNext2("");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="settings-tab settings-form" onSubmit={submit}>
      <div className="settings-title">
        <KeyRound size={15} />
        Master-Passwort ändern
      </div>
      <label className="form-field">
        <span className="field-label">Aktuelles Passwort</span>
        <input
          className="input"
          type="password"
          value={current}
          onChange={(e) => {
            setCurrent(e.target.value);
            setError(null);
          }}
          autoComplete="current-password"
        />
      </label>
      <label className="form-field">
        <span className="field-label">Neues Passwort (mind. 10 Zeichen)</span>
        <input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
      </label>
      <label className="form-field">
        <span className="field-label">Neues Passwort wiederholen</span>
        <input
          className="input"
          type="password"
          value={next2}
          onChange={(e) => setNext2(e.target.value)}
          autoComplete="new-password"
          aria-invalid={mismatch}
        />
      </label>
      <p className="form-error" role="alert" data-visible={!!(error || mismatch) || undefined}>
        {error ?? (mismatch ? "Stimmt nicht überein" : " ")}
      </p>
      <div className="modal-foot modal-foot--end">
        <button type="submit" className="primary-btn" disabled={!canChange}>
          <span className="btn-content" data-busy={busy || undefined}>
            {busy ? "Wird geändert…" : "Passwort ändern"}
          </span>
        </button>
      </div>
    </form>
  );
}

/* ── Info & Updates ───────────────────────── */

function InfoTab() {
  const [version, setVersion] = useState("…");
  const [state, setState] = useState<"idle" | "checking" | "none" | "found" | "installing" | "error">("idle");
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    appVersion().then(setVersion).catch(() => setVersion("?"));
  }, []);

  async function check() {
    setState("checking");
    setError(null);
    try {
      const u = await checkForUpdate();
      setUpdate(u);
      setState(u ? "found" : "none");
    } catch (e) {
      setError(errorText(e));
      setState("error");
    }
  }

  async function install() {
    if (!update) return;
    setState("installing");
    try {
      await update.install(setProgress);
    } catch (e) {
      setError(errorText(e));
      setState("error");
    }
  }

  return (
    <div className="settings-tab">
      <div className="about">
        <div className="brand-mark brand-mark--lg">
          <KeyRound size={22} strokeWidth={2.2} />
        </div>
        <div className="toggle-text">
          <span className="toggle-title">Tresor</span>
          <span className="toggle-sub">Version {version}</span>
        </div>
      </div>

      <div className="setting-block">
        <div className="setting-head">
          <span className="toggle-icon">
            <Sparkles size={18} />
          </span>
          <span className="toggle-text">
            <span className="toggle-title">
              {state === "found" && update
                ? `Version ${update.version} ist da`
                : state === "none"
                  ? "Du hast die neueste Version"
                  : state === "installing"
                    ? "Update wird installiert…"
                    : "Updates"}
            </span>
            <span className="toggle-sub">
              {state === "installing"
                ? "Tresor startet danach neu. Dein Tresor bleibt unverändert."
                : "Tresor sucht beim Entsperren automatisch nach neuen Versionen."}
            </span>
          </span>
        </div>
        {state === "installing" && (
          <div className="progress">
            <span style={{ transform: `scaleX(${progress})` }} />
          </div>
        )}
        {error && <p className="form-error" data-visible>{error}</p>}
        <div className="modal-foot modal-foot--end">
          {state === "found" ? (
            <button className="primary-btn" onClick={install}>
              <Download size={15} />
              Jetzt aktualisieren
            </button>
          ) : (
            <button className="ghost-btn ghost-btn--boxed" onClick={check} disabled={state === "checking" || state === "installing"}>
              <RefreshCw size={14} className={state === "checking" ? "spin" : undefined} />
              Nach Updates suchen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
