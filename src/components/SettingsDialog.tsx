import { Fingerprint, KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api, errorText } from "../lib/api";
import { Modal } from "./Modal";

interface Props {
  helloSupported: boolean;
  helloEnabled: boolean;
  onHelloChanged: (enabled: boolean) => void;
  onClose: () => void;
}

export function SettingsDialog({ helloSupported, helloEnabled, onHelloChanged, onClose }: Props) {
  const [helloBusy, setHelloBusy] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

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

  const mismatch = !!next2 && next !== next2;
  const canChange = current.length > 0 && next.length >= 10 && next === next2 && !pwBusy;

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (!canChange) return;
    setPwBusy(true);
    setPwError(null);
    try {
      await api.changePassword(current, next);
      toast.success("Master-Passwort geändert", { description: "Bitte die neue Notiz sicher aufbewahren." });
      setCurrent("");
      setNext("");
      setNext2("");
    } catch (err) {
      setPwError(errorText(err));
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <Modal title="Einstellungen" onClose={onClose} width={460}>
      <div className="modal-body">
        <label className="toggle-row" data-disabled={!helloSupported || helloBusy || undefined}>
          <span className="toggle-icon">
            <Fingerprint size={18} />
          </span>
          <span className="toggle-text">
            <span className="toggle-title">Windows Hello</span>
            <span className="toggle-sub">
              {helloSupported
                ? helloEnabled
                  ? "Entsperren per PIN, Fingerabdruck oder Gesicht ist aktiv."
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

        <form className="settings-section" onSubmit={changePassword}>
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
                setPwError(null);
              }}
              autoComplete="current-password"
            />
          </label>
          <label className="form-field">
            <span className="field-label">Neues Passwort (mind. 10 Zeichen)</span>
            <input
              className="input"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
            />
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
          <p className="form-error" role="alert" data-visible={!!(pwError || mismatch) || undefined}>
            {pwError ?? (mismatch ? "Stimmt nicht überein" : " ")}
          </p>
          <div className="modal-foot modal-foot--end">
            <button type="submit" className="primary-btn" disabled={!canChange}>
              <span className="btn-content" data-busy={pwBusy || undefined}>
                {pwBusy ? "Wird geändert…" : "Passwort ändern"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
