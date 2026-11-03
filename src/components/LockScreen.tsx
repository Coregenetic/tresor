import { ArrowRight, Check, Fingerprint, KeyRound, Lock } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { errorText } from "../lib/api";

interface Props {
  helloEnabled: boolean;
  /** Beim Start automatisch Windows Hello anfragen */
  autoHello: boolean;
  onUnlockHello: () => Promise<void>;
  onUnlockPassword: (password: string) => Promise<void>;
  onUnlocked: () => void;
}

type State = "idle" | "verifying" | "done";

export function LockScreen({ helloEnabled, autoHello, onUnlockHello, onUnlockPassword, onUnlocked }: Props) {
  const [mode, setMode] = useState<"hello" | "password">(helloEnabled ? "hello" : "password");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [password, setPassword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const autoTried = useRef(false);

  async function run(action: () => Promise<void>) {
    if (state !== "idle") return;
    setError(null);
    setState("verifying");
    try {
      await action();
      setState("done");
      window.setTimeout(onUnlocked, 300);
    } catch (e) {
      setState("idle");
      setError(errorText(e));
      setShake((n) => n + 1);
      if (mode === "password") {
        inputRef.current?.select();
      }
    }
  }

  const hello = () => run(onUnlockHello);

  function submitPassword(e: FormEvent) {
    e.preventDefault();
    if (!password) return;
    run(() => onUnlockPassword(password));
  }

  useEffect(() => {
    if (autoHello && helloEnabled && !autoTried.current) {
      autoTried.current = true;
      hello();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode === "password") inputRef.current?.focus();
  }, [mode]);

  const badgeIcon = mode === "hello" ? <Fingerprint size={30} strokeWidth={1.6} /> : <Lock size={28} strokeWidth={1.7} />;

  return (
    <div className="lock" data-state={state}>
      <div className="lock-card">
        <div className="lock-badge" data-state={state}>
          <span className="swap swap--lg" data-state={state === "done" ? "b" : "a"}>
            <span className="swap-a">{badgeIcon}</span>
            <Check size={30} strokeWidth={2.2} className="swap-b" />
          </span>
        </div>
        <h1 className="lock-title">Tresor ist gesperrt</h1>

        {mode === "hello" ? (
          <>
            <p className="lock-sub">Entsperre mit Windows Hello – PIN, Fingerabdruck oder Gesicht.</p>
            <button className="primary-btn primary-btn--lg" onClick={hello} disabled={state !== "idle"} autoFocus>
              <span className="btn-content" data-busy={state === "verifying" || undefined}>
                {state === "verifying" ? "Warte auf Windows Hello…" : "Mit Windows Hello entsperren"}
              </span>
            </button>
          </>
        ) : (
          <>
            <p className="lock-sub">Gib dein Master-Passwort ein.</p>
            <form className="pw-form" onSubmit={submitPassword} key={shake} data-shake={shake > 0 || undefined}>
              <input
                ref={inputRef}
                className="input input--lg"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Master-Passwort"
                autoComplete="current-password"
                disabled={state !== "idle"}
                aria-invalid={!!error}
              />
              <button
                className="primary-btn pw-submit"
                type="submit"
                disabled={state !== "idle" || !password}
                aria-label="Entsperren"
              >
                <ArrowRight size={17} strokeWidth={2.2} />
              </button>
            </form>
          </>
        )}

        <p className="form-error" role="alert" data-visible={!!error || undefined}>
          {error ?? " "}
        </p>

        {helloEnabled && (
          <button
            className="link-btn"
            onClick={() => {
              setError(null);
              setMode(mode === "hello" ? "password" : "hello");
            }}
            disabled={state !== "idle"}
          >
            {mode === "hello" ? <KeyRound size={13} /> : <Fingerprint size={13} />}
            {mode === "hello" ? "Mit Master-Passwort entsperren" : "Mit Windows Hello entsperren"}
          </button>
        )}
      </div>
      <p className="lock-foot">Alle Daten bleiben verschlüsselt auf diesem PC.</p>
    </div>
  );
}
