import { ArrowLeft, ArrowRight, Fingerprint, KeyRound, Plus, ShieldCheck, Users, X } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { errorText, type CreateResult, type VaultData } from "../lib/api";
import type { Member } from "../lib/types";
import { Avatar } from "./Avatar";

interface Props {
  helloSupported: boolean;
  onCreate: (password: string, data: VaultData, enableHello: boolean) => Promise<CreateResult>;
  onDone: (result: CreateResult) => void;
}

const HUES = [228, 340, 150, 32, 270, 190, 8, 95];
const MIN_LENGTH = 10;

/** Grobe Einschätzung – reicht für eine ehrliche Rückmeldung beim Anlegen. */
function strength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (pw.length < MIN_LENGTH) return { score: 0, label: `Mindestens ${MIN_LENGTH} Zeichen` };
  let variety = 0;
  if (/[a-zäöüß]/.test(pw)) variety++;
  if (/[A-ZÄÖÜ]/.test(pw)) variety++;
  if (/\d/.test(pw)) variety++;
  if (/[^\wäöüßÄÖÜ]/.test(pw)) variety++;
  const points = Math.min(pw.length, 24) / 4 + variety;
  if (points >= 8) return { score: 3, label: "Stark" };
  if (points >= 6) return { score: 2, label: "Gut" };
  return { score: 1, label: "Schwach – länger ist besser" };
}

export function SetupScreen({ helloSupported, onCreate, onDone }: Props) {
  const [step, setStep] = useState(0);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [noted, setNoted] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState("");
  const [useHello, setUseHello] = useState(helloSupported);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const s = useMemo(() => strength(pw), [pw]);
  const pwOk = s.score > 0 && pw === pw2 && noted;

  function addMember(e?: FormEvent) {
    e?.preventDefault();
    const n = name.trim();
    if (!n || members.some((m) => m.name.toLowerCase() === n.toLowerCase())) return;
    setMembers((list) => [...list, { id: crypto.randomUUID(), name: n, hue: HUES[list.length % HUES.length] }]);
    setName("");
    nameRef.current?.focus();
  }

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const result = await onCreate(pw, { version: 1, members, entries: [] }, helloSupported && useHello);
      onDone(result);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <div className="lock">
      <div className="setup-card">
        <div className="steps" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="step-dot" data-active={i === step || undefined} data-done={i < step || undefined} />
          ))}
        </div>

        {step === 0 && (
          <form
            className="setup-step"
            key="s0"
            onSubmit={(e) => {
              e.preventDefault();
              if (pwOk) setStep(1);
            }}
          >
            <div className="setup-icon">
              <KeyRound size={22} strokeWidth={1.8} />
            </div>
            <h1 className="setup-title">Master-Passwort festlegen</h1>
            <p className="setup-sub">
              Damit kommst du immer in den Tresor – auch wenn Windows Hello einmal nicht funktioniert.
            </p>

            <label className="label">Master-Passwort</label>
            <input
              className="input"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoFocus
              autoComplete="new-password"
            />
            <div className="meter" data-score={s.score}>
              <span />
              <span />
              <span />
            </div>
            <div className="meter-label">{pw ? s.label : `Mindestens ${MIN_LENGTH} Zeichen, gern ein ganzer Satz.`}</div>

            <label className="label">Wiederholen</label>
            <input
              className="input"
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password"
              aria-invalid={!!pw2 && pw !== pw2}
            />
            <div className="meter-label" data-warn={(!!pw2 && pw !== pw2) || undefined}>
              {pw2 && pw !== pw2 ? "Stimmt nicht überein" : " "}
            </div>

            <label className="check">
              <input type="checkbox" checked={noted} onChange={(e) => setNoted(e.target.checked)} />
              <span>
                Ich habe das Passwort notiert und sicher aufbewahrt. Ohne es lässt sich der Tresor nicht
                wiederherstellen.
              </span>
            </label>

            <div className="setup-actions">
              <span />
              <button className="primary-btn" type="submit" disabled={!pwOk}>
                Weiter
                <ArrowRight size={15} />
              </button>
            </div>
          </form>
        )}

        {step === 1 && (
          <div className="setup-step" key="s1">
            <div className="setup-icon">
              <Users size={22} strokeWidth={1.8} />
            </div>
            <h1 className="setup-title">Wer gehört zur Familie?</h1>
            <p className="setup-sub">Jeden Eintrag kannst du später einer oder mehreren Personen zuordnen.</p>

            <form className="add-row" onSubmit={addMember}>
              <input
                ref={nameRef}
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name, z. B. Patrick"
                autoFocus
                maxLength={30}
              />
              <button className="ghost-btn ghost-btn--boxed" type="submit" disabled={!name.trim()}>
                <Plus size={15} />
                Hinzufügen
              </button>
            </form>

            <div className="member-list">
              {members.length === 0 && <div className="member-empty">Noch niemand hinzugefügt.</div>}
              {members.map((m) => (
                <div className="member-row" key={m.id}>
                  <Avatar member={m} size={26} />
                  <span className="member-name">{m.name}</span>
                  <button
                    className="icon-btn"
                    onClick={() => setMembers((list) => list.filter((x) => x.id !== m.id))}
                    aria-label={`${m.name} entfernen`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="setup-actions">
              <button className="ghost-btn" onClick={() => setStep(0)}>
                <ArrowLeft size={15} />
                Zurück
              </button>
              <button className="primary-btn" onClick={() => setStep(2)} disabled={members.length === 0}>
                Weiter
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="setup-step" key="s2">
            <div className="setup-icon">
              <ShieldCheck size={22} strokeWidth={1.8} />
            </div>
            <h1 className="setup-title">Schnell entsperren</h1>
            <p className="setup-sub">
              Mit Windows Hello entsperrst du den Tresor per PIN, Fingerabdruck oder Gesicht. Der Schlüssel
              dafür liegt im Sicherheitschip dieses PCs.
            </p>

            <label className="toggle-row" data-disabled={!helloSupported || undefined}>
              <span className="toggle-icon">
                <Fingerprint size={18} />
              </span>
              <span className="toggle-text">
                <span className="toggle-title">Windows Hello verwenden</span>
                <span className="toggle-sub">
                  {helloSupported
                    ? "Windows fragt gleich zweimal nach: einmal zum Einrichten, einmal zum Bestätigen."
                    : "Auf diesem PC ist Windows Hello nicht eingerichtet."}
                </span>
              </span>
              <input
                type="checkbox"
                className="switch"
                checked={helloSupported && useHello}
                disabled={!helloSupported}
                onChange={(e) => setUseHello(e.target.checked)}
              />
            </label>

            <p className="form-error" role="alert" data-visible={!!error || undefined}>
              {error ?? " "}
            </p>

            <div className="setup-actions">
              <button className="ghost-btn" onClick={() => setStep(1)} disabled={busy}>
                <ArrowLeft size={15} />
                Zurück
              </button>
              <button className="primary-btn" onClick={finish} disabled={busy}>
                <span className="btn-content" data-busy={busy || undefined}>
                  {busy ? "Tresor wird angelegt…" : "Tresor anlegen"}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="lock-foot">Alle Daten bleiben verschlüsselt auf diesem PC.</p>
    </div>
  );
}
