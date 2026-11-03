import { Fingerprint, KeyRound, Check } from "lucide-react";
import { useState } from "react";

interface Props {
  onUnlock: () => void;
}

/**
 * Etappe 1: Oberfläche. Ab Etappe 2 ruft der Button Windows Hello im Rust-Kern auf.
 */
export function LockScreen({ onUnlock }: Props) {
  const [state, setState] = useState<"idle" | "verifying" | "done">("idle");

  function unlock() {
    if (state !== "idle") return;
    setState("verifying");
    // Platzhalter für den Windows-Hello-Dialog
    window.setTimeout(() => {
      setState("done");
      window.setTimeout(onUnlock, 280);
    }, 650);
  }

  return (
    <div className="lock" data-state={state}>
      <div className="lock-card">
        <div className="lock-badge" data-state={state}>
          <span className="swap swap--lg" data-state={state === "done" ? "b" : "a"}>
            <Fingerprint size={30} strokeWidth={1.6} className="swap-a" />
            <Check size={30} strokeWidth={2.2} className="swap-b" />
          </span>
        </div>
        <h1 className="lock-title">Tresor ist gesperrt</h1>
        <p className="lock-sub">Entsperre mit Windows Hello – PIN, Fingerabdruck oder Gesicht.</p>

        <button className="primary-btn primary-btn--lg" onClick={unlock} disabled={state !== "idle"} autoFocus>
          <span className="btn-content" data-busy={state === "verifying" || undefined}>
            {state === "verifying" ? "Warte auf Windows Hello…" : "Mit Windows Hello entsperren"}
          </span>
        </button>

        <button className="link-btn">
          <KeyRound size={13} />
          Mit Master-Passwort entsperren
        </button>
      </div>
      <p className="lock-foot">Alle Daten bleiben verschlüsselt auf diesem PC.</p>
    </div>
  );
}
